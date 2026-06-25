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

    this.resources = { ...(DATA.ECONOMY?.startingResources || { food: 1200, wood: 260, stone: 120, gold: 50, iron: 25 }) };
    this.influence = 0;
    this.relations = {};  // civId -> 'neutral'|'ally'|'war'

    this.aiTimer = 0;
    this.buildTimer = 0;
    this.warTarget = null;
    this.maxPopulation = DATA.GAME?.maxPopulationPerCiv ?? 300;
    this.stats = { born: 0, matured: 0, died: 0, battlesWon: 0, buildingsBuilt: 0 };
    this.jobTimer = 0;
  }

  get population() { return this.villagers.length; }
  get adultPopulation() { return this.villagers.filter(v => !v.dead && !v.isBaby).length; }
  get babyPopulation() { return this.villagers.filter(v => !v.dead && v.isBaby).length; }
  get alive() { return !this.dead && this.townhall !== null && !(this.townhall.hp <= 0); }

  shortName() {
    return this.name.split(' ').slice(-1)[0] || this.name;
  }

  colorName() {
    return `<span style="color:${this.color}">■ ${this.shortName()}</span>`;
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
    this.world.addEvent(`👶 ${v.name} born (${biome}) in ${this.colorName()}.`, this.color, { overlay: false });
    return v;
  }

  onVillagerDeath(v, reason) { this.stats.died++; }

  findMate(v) {
    if (!v.canReproduce()) return null;
    let best = null;
    let bestScore = -Infinity;

    for (const other of this.villagers) {
      if (other === v || other.dead) continue;
      if (!other.canReproduce()) continue;
      const d = Math.hypot(other.x - v.x, other.y - v.y);
      if (d > 5) continue;

      const mate = DATA.REPRODUCTION?.partnerScore || {};
      const score = other.health * (mate.health ?? 0.4) + (100 - other.hunger) * (mate.hunger ?? 0.2) + other.environmentFitness * (mate.envFitness ?? 30) - d * (mate.distancePenalty ?? 5);
      if (score > bestScore) { bestScore = score; best = other; }
    }
    return best;
  }

  findNearestEnemy(x, y, range = Infinity) {
    let best = null, bestDist = range;
    for (const [id, rel] of Object.entries(this.relations)) {
      if (rel !== 'war') continue;
      const enemyCiv = Game.civs.find(c => c.id === parseInt(id));
      if (!enemyCiv || enemyCiv.dead) continue;
      for (const v of enemyCiv.villagers) {
        if (v.dead) continue;
        const d = Math.hypot(v.x - x, v.y - y);
        if (d < bestDist) { bestDist = d; best = v; }
      }
    }
    return best;
  }

  findNearestEnemyBuilding(x, y, range = Infinity) {
    let best = null, bestDist = range;
    for (const b of this.world.buildings) {
      if (!b.civ || b.civ === this || b.hp <= 0) continue;
      if (this.relations[b.civ.id] !== 'war') continue;
      const cx = b.tx + b.def.width / 2;
      const cy = b.ty + b.def.height / 2;
      const d = Math.hypot(cx - x, cy - y);
      if (d < bestDist) { bestDist = d; best = b; }
    }
    return best;
  }

  getWarObjective(x, y) {
    if (!this.warTarget || this.warTarget.dead) return null;
    const nearbyEnemy = this.findNearestEnemy(x, y, 45);
    if (nearbyEnemy) return nearbyEnemy;

    const nearbyBuilding = this.findNearestEnemyBuilding(x, y, 80);
    if (nearbyBuilding) return nearbyBuilding;

    if (this.warTarget.townhall && this.warTarget.townhall.hp > 0) return this.warTarget.townhall;
    if (this.warTarget.buildings.length) return this.warTarget.buildings[0];
    return this.findNearestEnemy(x, y, Infinity);
  }

  findWorkTarget(job) {
    if (!this.townhall) return null;
    const cx = this.townhall.tx + 1.5, cy = this.townhall.ty + 1.5;
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

    for (let i = this.villagers.length - 1; i >= 0; i--) {
      if (this.villagers[i].dead) this.villagers.splice(i, 1);
    }

    if (this.villagers.length === 0 && this.world.year > 2) {
      this.dead = true;
      this.world.addEvent(`☠ ${this.colorName()} has fallen.`, this.color);
      return;
    }

    for (const v of this.villagers) {
      const wasBaby = v.isBaby;
      v.update(dt, this.rng);
      if (wasBaby && !v.isBaby) this.stats.matured++;
    }

    this._applyBuildingProduction(dt);

    const foodPressure = this.adultPopulation + this.babyPopulation * 0.25;
    this.resources.food = Math.max(0, this.resources.food - dt * foodPressure * 0.018);

    this.influence += dt * (this.adultPopulation * 0.01 + this.buildings.length * 0.02);

    this.aiTimer -= dt;
    if (this.aiTimer <= 0) {
      this.aiTimer = 4 + this.rng.next() * 6;
      this._aiDecide(allCivs);
    }

    this.buildTimer -= dt;
    if (this.buildTimer <= 0) {
      this.buildTimer = 12 + this.rng.next() * 15;
      this._tryBuild();
    }

    this.jobTimer -= dt;
    if (this.jobTimer <= 0) {
      this.jobTimer = 12;
      this._assignJobs();
    }
  }

  _assignJobs() {
    const adults = this.villagers.filter(v => !v.dead && !v.isBaby);
    const babies = this.villagers.filter(v => !v.dead && v.isBaby);
    for (const baby of babies) baby.assignJob('BABY');

    const pop = adults.length;
    if (pop === 0) return;

    const jobs = [];
    const jobCfg = DATA.AI?.jobs || {};
    const soldierRatio = this.warTarget ? (jobCfg.soldierRatioWar ?? 0.26) : (jobCfg.soldierRatioPeace ?? 0.06);
    const soldiers = Math.floor(pop * soldierRatio);
    const farmers = Math.max(1, Math.floor(pop * (jobCfg.farmerRatio ?? 0.42)));
    const woodcut = Math.max(1, Math.floor(pop * (jobCfg.woodcutRatio ?? 0.22)));
    const miners = Math.max(0, Math.floor(pop * (jobCfg.minerRatio ?? 0.12)));

    for (let i = 0; i < pop; i++) {
      if (i < soldiers) jobs.push('SOLDIER');
      else if (i < soldiers + farmers) jobs.push('FARMER');
      else if (i < soldiers + farmers + woodcut) jobs.push('WOODCUT');
      else if (i < soldiers + farmers + woodcut + miners) jobs.push('MINER');
      else jobs.push('IDLE');
    }

    for (let i = jobs.length - 1; i > 0; i--) {
      const j = this.rng.int(0, i + 1);
      [jobs[i], jobs[j]] = [jobs[j], jobs[i]];
    }

    for (let i = 0; i < adults.length; i++) {
      const job = jobs[i % jobs.length];
      if (adults[i].job !== job) adults[i].assignJob(job);
    }
  }

  _applyBuildingProduction(dt) {
    // Base gathering so a brand-new civ can survive before building everything.
    this.resources.food = Math.min(9999, this.resources.food + dt * 0.8);
    this.resources.wood = Math.min(9999, this.resources.wood + dt * 0.25);
    this.resources.stone = Math.min(9999, this.resources.stone + dt * 0.15);

    for (const b of this.buildings) {
      if (!b || b.hp <= 0 || !b.def?.produces) continue;
      for (const [resName, amount] of Object.entries(b.def.produces)) {
        this.resources[resName] = Math.min(9999, (this.resources[resName] || 0) + dt * amount);
      }
    }
  }

  _housingCapacity() {
    return this.buildings.reduce((sum, b) => sum + (b.hp > 0 ? (b.def.maxPop || 0) : 0), 0);
  }

  _hasBuilding(id) {
    return this.getBuildingCount(id) > 0;
  }

  _hasTag(tag) {
    return this.buildings.some(b => b.hp > 0 && (b.def.tags || []).includes(tag));
  }

  _buildRulePasses(plan, def) {
    const rule = plan.when || {};
    const pop = this.population;

    if (rule.minPop !== undefined && pop < rule.minPop) return false;
    if (rule.maxCount !== undefined && this.getBuildingCount(def.id) >= rule.maxCount) return false;
    if (rule.atWar && !this.warTarget) return false;
    if (rule.hasBuilding && !this._hasBuilding(rule.hasBuilding)) return false;
    if (rule.nearWater && !this.world.isNearWater(this.townhall.tx, this.townhall.ty, 10)) return false;

    if (rule.housingPressure) {
      const cap = this._housingCapacity();
      if (pop <= cap - 4) return false;
    }

    if (rule.farmsPerPop !== undefined) {
      const farmsNeeded = Math.floor(pop * rule.farmsPerPop) + 1;
      if (this.getBuildingCount(def.id) >= farmsNeeded) return false;
    }

    return true;
  }

  _chooseBuildingToBuild() {
    const plans = (DATA.AI_BUILD_PLAN || [])
      .map(plan => ({ plan, def: DATA.BUILDINGS[plan.building] }))
      .filter(x => x.def && canAfford(this.resources, dataCost(x.def)) && this._buildRulePasses(x.plan, x.def))
      .sort((a, b) => (b.plan.priority || 0) - (a.plan.priority || 0));

    return plans.length ? plans[0].def : null;
  }

  _tryBuild() {
    if (!this.townhall) return;
    const th = this.townhall;
    const cx = th.tx + Math.floor(th.def.width / 2);
    const cy = th.ty + Math.floor(th.def.height / 2);

    const def = this._chooseBuildingToBuild();
    if (!def) return;

    const radiusStart = def.category === 'defense' ? 4 : 3;
    const radiusEnd = def.category === 'defense' ? 12 : 32;

    for (let r = radiusStart; r < radiusEnd; r += 2) {
      const attempts = DATA.AI?.building?.attemptsPerRadius ?? 8;
      for (let attempt = 0; attempt < attempts; attempt++) {
        const angle = this.rng.next() * Math.PI * 2;
        let tx = Math.round(cx + Math.cos(angle) * r);
        let ty = Math.round(cy + Math.sin(angle) * r);

        // Naval buildings prefer coastlines.
        if (def.category === 'naval') {
          if (!this.world.isNearWater(tx, ty, 2)) continue;
        }

        if (this.world.isBuildable(tx, ty, def.width, def.height)) {
          const b = new Building(def, tx, ty, this);
          this.world.addBuilding(b);
          this.buildings.push(b);
          payCost(this.resources, dataCost(def));
          this.stats.buildingsBuilt++;

          if (def.roadConnect !== false) {
            this.world.addRoadLine(cx, cy, tx + def.width / 2, ty + def.height / 2);
          }

          if (def.category === 'defense' && this.warTarget) {
            this.world.addEvent(`🧱 ${this.colorName()} builds ${def.name}.`, this.color, { overlay: false });
          }
          return;
        }
      }
    }
  }

  _aiDecide(allCivs) {
    const pers = this.pers;

    if (!this.warTarget && this.adultPopulation > 10 && this.rng.next() < pers.war * 0.12) {
      const candidates = allCivs
        .filter(c => c !== this && !c.dead && this.relations[c.id] !== 'war' && c.adultPopulation > 0)
        .sort((a, b) => {
          const da = this._distToCiv(a);
          const db = this._distToCiv(b);
          return da - db;
        });
      if (candidates.length > 0) {
        const target = candidates.slice(0, Math.min(3, candidates.length))[this.rng.int(0, Math.min(2, candidates.length - 1))];
        this.declareWar(target);
      }
    }

    if (this.warTarget && this.rng.next() < 0.018) {
      if (this.adultPopulation < 7 || this.resources.food < 60 || this.rng.next() < 0.25) {
        this.makePeace(this.warTarget);
      }
    }
  }

  _distToCiv(other) {
    if (!this.townhall || !other.townhall) return Infinity;
    const ax = this.townhall.tx, ay = this.townhall.ty;
    const bx = other.townhall.tx, by = other.townhall.ty;
    return Math.hypot(ax - bx, ay - by);
  }

  declareWar(other) {
    if (!other || other.dead) return;
    this.relations[other.id] = 'war';
    other.relations[this.id] = 'war';
    this.warTarget = other;
    other.warTarget = this;
    this.world.addEvent(`⚔ ${this.colorName()} → ${other.colorName()}`, '#c84040', { overlay: false });
    this.jobTimer = 0;
    other.jobTimer = 0;
  }

  makePeace(other) {
    if (!other) return;
    this.relations[other.id] = 'neutral';
    other.relations[this.id] = 'neutral';
    if (this.warTarget === other) this.warTarget = null;
    if (other.warTarget === this) other.warTarget = null;
    this.world.addEvent(`🕊 ${this.colorName()} + ${other.colorName()} make peace.`, '#7ec850', { overlay: false });
    this.jobTimer = 0;
    other.jobTimer = 0;
  }

  getBuildingCount(type) {
    return this.buildings.filter(b => b.def.id === type && b.hp > 0).length;
  }

  getBuildingsByTag(tag) {
    return this.buildings.filter(b => b.hp > 0 && (b.def.tags || []).includes(tag));
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
