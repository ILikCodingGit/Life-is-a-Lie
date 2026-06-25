class Civilization {
  constructor(id, name, color, world, rng, personality) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.world = world;
    this.rng = rng;
    this.personality = personality || 'BALANCED';
    this.pers = DATA.PERSONALITY[this.personality] || DATA.PERSONALITY.BALANCED;

    this.villagers = [];
    this.buildings = [];
    this.townhall = null;
    this.dead = false;

    this.resources = { food: 500, wood: 200, stone: 100, gold: 50, iron: 25 };
    this.influence = 0;
    this.relations = {};  // civId -> 'neutral'|'ally'|'war'

    this.aiTimer = 0;
    this.buildTimer = 0;
    this.warTarget = null;
    this.maxPopulation = 250;
    this.stats = { born: 0, matured: 0, died: 0, battlesWon: 0, buildingsBuilt: 0 };
  }

  get population() {
    return this.villagers.length;
  }

  get adultPopulation() {
    return this.villagers.filter(v => !v.dead && !v.isBaby).length;
  }

  get babyPopulation() {
    return this.villagers.filter(v => !v.dead && v.isBaby).length;
  }

  get alive() {
    return !this.dead && this.townhall !== null && !(this.townhall.hp <= 0);
  }

  spawnVillagers(count, spawnX, spawnY) {
    for (let i = 0; i < count; i++) {
      const tile = this.world.findSpawnTile(spawnX, spawnY, 15);
      if (!tile) continue;
      const genes = Villager.randomGenes(this.rng, this.world, tile.x, tile.y);
      const v = new Villager(this, this.world, this.rng, tile.x, tile.y, { genes });
      this.villagers.push(v);
      this.stats.born++;
    }
  }

  birthVillager(parentA, parentB) {
    if (this.population >= this.maxPopulation) return null;
    if (!parentA || !parentB) return null;

    const sx = (parentA.x + parentB.x) / 2;
    const sy = (parentA.y + parentB.y) / 2;
    const tile = this.world.findSpawnTile(Math.floor(sx), Math.floor(sy), 6);
    if (!tile) return null;

    const genes = Villager.inheritGenes(parentA, parentB, this.world, this.rng, tile.x, tile.y);

    const v = new Villager(this, this.world, this.rng, tile.x, tile.y, {
      isBaby: true,
      monthAge: 0,
      maturityMonths: 10,
      genes,
      parents: [parentA.id, parentB.id]
    });

    this.villagers.push(v);
    this.stats.born++;

    const biome = this.world.getDominantBiomeAt(tile.x, tile.y);
    this.world.addEvent(`👶 ${v.name} was born in ${this.name}. Genes biased toward ${biome}.`, this.color, { overlay: false });

    return v;
  }

  onVillagerDeath(v, reason) {
    this.stats.died++;
  }

  findMate(v) {
    if (!v.canReproduce()) return null;

    let best = null;
    let bestScore = -Infinity;

    for (const other of this.villagers) {
      if (other === v || other.dead) continue;
      if (!other.canReproduce()) continue;
      const d = Math.hypot(other.x - v.x, other.y - v.y);
      if (d > 4) continue;

      // Prefer healthy nearby partners with environment-suited genes.
      const score =
        other.health * 0.4 +
        (100 - other.hunger) * 0.2 +
        other.environmentFitness * 30 -
        d * 5;

      if (score > bestScore) {
        bestScore = score;
        best = other;
      }
    }

    return best;
  }

  findNearestEnemy(x, y, range) {
    let best = null, bestDist = range;
    for (const [id, rel] of Object.entries(this.relations)) {
      if (rel !== 'war') continue;
      const enemyCiv = Game.civs.find(c => c.id === parseInt(id));
      if (!enemyCiv) continue;
      for (const v of enemyCiv.villagers) {
        if (v.dead) continue;
        const d = Math.hypot(v.x - x, v.y - y);
        if (d < bestDist) { bestDist = d; best = v; }
      }
    }
    return best;
  }

  findWorkTarget(job) {
    if (!this.townhall) return null;
    const cx = this.townhall.tx + 1.5, cy = this.townhall.ty + 1.5;
    // Find nearby resource
    let best = null, bestDist = 99999;
    for (const res of this.world.resources) {
      if (res.amount <= 0) continue;
      const ok = (job === 'WOODCUT' && res.type === 'wood') ||
                 (job === 'MINER' && res.type === 'stone') ||
                 (job === 'FARMER' && res.type === 'food') ||
                 (job === 'HUNTER' && res.type === 'food');
      if (!ok) continue;
      const d = Math.hypot(res.x - cx, res.y - cy);
      if (d < bestDist) { bestDist = d; best = res; }
    }
    return best;
  }

  update(dt, allCivs) {
    if (this.dead) return;

    // Remove dead villagers
    for (let i = this.villagers.length - 1; i >= 0; i--) {
      if (this.villagers[i].dead) this.villagers.splice(i, 1);
    }

    // Check extinction
    if (this.villagers.length === 0 && this.world.year > 2) {
      this.dead = true;
      this.world.addEvent(`${this.name} has fallen.`, this.color);
      return;
    }

    // Update villagers
    for (const v of this.villagers) {
      const wasBaby = v.isBaby;
      v.update(dt, this.rng);
      if (wasBaby && !v.isBaby) this.stats.matured++;
    }

    // Passive resource generation
    this.resources.food = Math.min(9999, this.resources.food + dt * 0.5 * (this.getBuildingCount('FARM') + 1));
    this.resources.wood = Math.min(9999, this.resources.wood + dt * 0.3 * (this.getBuildingCount('LUMBERCAMP') + 1));
    this.resources.stone = Math.min(9999, this.resources.stone + dt * 0.2 * (this.getBuildingCount('MINE') + 1));

    // Food consumption. Babies count, but less than adults.
    const foodPressure = this.adultPopulation + this.babyPopulation * 0.35;
    this.resources.food = Math.max(0, this.resources.food - dt * foodPressure * 0.05);

    // Influence gain
    this.influence += dt * (this.adultPopulation * 0.01 + this.buildings.length * 0.02);

    // AI decisions
    this.aiTimer -= dt;
    if (this.aiTimer <= 0) {
      this.aiTimer = 5 + this.rng.next() * 5;
      this._aiDecide(allCivs);
    }

    // Building
    this.buildTimer -= dt;
    if (this.buildTimer <= 0) {
      this.buildTimer = 15 + this.rng.next() * 15;
      this._tryBuild();
    }

    // Assign jobs
    this._assignJobs();
  }

  _assignJobs() {
    const adults = this.villagers.filter(v => !v.dead && !v.isBaby);
    const babies = this.villagers.filter(v => !v.dead && v.isBaby);

    for (const baby of babies) baby.assignJob('BABY');

    const pop = adults.length;
    if (pop === 0) return;

    const jobs = [];
    const soldier_ratio = this.warTarget ? 0.35 : 0.15;
    const soldiers = Math.floor(pop * soldier_ratio);
    const farmers = Math.max(1, Math.floor(pop * 0.3));
    const woodcut = Math.max(1, Math.floor(pop * 0.2));
    const miners = Math.max(0, Math.floor(pop * 0.1));

    for (let i = 0; i < pop; i++) {
      if (i < soldiers) jobs.push('SOLDIER');
      else if (i < soldiers + farmers) jobs.push('FARMER');
      else if (i < soldiers + farmers + woodcut) jobs.push('WOODCUT');
      else if (i < soldiers + farmers + woodcut + miners) jobs.push('MINER');
      else jobs.push('IDLE');
    }

    // Shuffle job order a tiny bit so the same villager is not always soldier forever.
    for (let i = jobs.length - 1; i > 0; i--) {
      const j = this.rng.int(0, i + 1);
      [jobs[i], jobs[j]] = [jobs[j], jobs[i]];
    }

    for (let i = 0; i < adults.length; i++) {
      adults[i].assignJob(jobs[i % jobs.length]);
    }
  }

  _tryBuild() {
    if (!this.townhall) return;
    const th = this.townhall;
    const cx = th.tx + Math.floor(th.def.width / 2);
    const cy = th.ty + Math.floor(th.def.height / 2);
    const res = this.resources;

    // What to build?
    let toBuild = null;
    const pop = this.population;
    const houses = this.getBuildingCount('HOUSE');
    const farms = this.getBuildingCount('FARM');
    const lumber = this.getBuildingCount('LUMBERCAMP');
    const mines = this.getBuildingCount('MINE');
    const barracks = this.getBuildingCount('BARRACKS');

    if (pop > houses * 5 && res.wood >= 10) toBuild = 'HOUSE';
    else if (farms < Math.floor(pop / 5) + 1 && res.wood >= 5) toBuild = 'FARM';
    else if (lumber === 0 && res.wood >= 15 && res.stone >= 5) toBuild = 'LUMBERCAMP';
    else if (mines === 0 && res.wood >= 10 && res.stone >= 20) toBuild = 'MINE';
    else if (barracks < 1 && res.wood >= 20 && res.stone >= 20) toBuild = 'BARRACKS';

    if (!toBuild) return;
    const def = DATA.BUILDINGS[toBuild];
    if (!def) return;

    // Find empty spot
    for (let r = 3; r < 25; r += 2) {
      const angle = this.rng.next() * Math.PI * 2;
      const tx = Math.round(cx + Math.cos(angle) * r);
      const ty = Math.round(cy + Math.sin(angle) * r);
      if (this.world.isBuildable(tx, ty, def.width, def.height)) {
        const b = new Building(def, tx, ty, this);
        this.world.addBuilding(b);
        this.buildings.push(b);
        res.wood -= def.costWood || 0;
        res.stone -= def.costStone || 0;
        this.stats.buildingsBuilt++;
        return;
      }
    }
  }

  _aiDecide(allCivs) {
    const pers = this.pers;

    // Consider war
    if (!this.warTarget && this.adultPopulation > 6 && this.rng.next() < pers.war * 0.08) {
      const candidates = allCivs.filter(c => c !== this && !c.dead && this.relations[c.id] !== 'war');
      if (candidates.length > 0) {
        const target = this.rng.pick(candidates);
        this.declareWar(target);
      }
    }

    // Consider peace
    if (this.warTarget && this.rng.next() < 0.02) {
      if (this.adultPopulation < 5 || this.resources.food < 10) {
        this.makePeace(this.warTarget);
      }
    }
  }

  declareWar(other) {
    this.relations[other.id] = 'war';
    other.relations[this.id] = 'war';
    this.warTarget = other;
    other.warTarget = this;
    this.world.addEvent(`⚔ ${this.name} declares war on ${other.name}!`, '#c84040');
  }

  makePeace(other) {
    this.relations[other.id] = 'neutral';
    other.relations[this.id] = 'neutral';
    if (this.warTarget === other) this.warTarget = null;
    if (other.warTarget === this) other.warTarget = null;
    this.world.addEvent(`🕊 ${this.name} and ${other.name} make peace.`, '#7ec850');
  }

  getBuildingCount(type) {
    return this.buildings.filter(b => b.def.id === type && b.hp > 0).length;
  }

  placeInitialBuildings(cx, cy) {
    const def = DATA.BUILDINGS.TOWNHALL;
    const tx = Math.floor(cx - def.width / 2);
    const ty = Math.floor(cy - def.height / 2);
    const b = new Building(def, tx, ty, this);
    this.world.addBuilding(b);
    this.buildings.push(b);
    this.townhall = b;
  }
}
