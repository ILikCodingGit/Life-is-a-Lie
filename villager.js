let _vid = 0;

class Villager {
  // 1 sec = 1 hour
  static DAYS_PER_MONTH = 30;
  static HOURS_PER_DAY = 24;
  static SECONDS_PER_MONTH = Villager.DAYS_PER_MONTH * Villager.HOURS_PER_DAY;
  static BABY_MATURE_MONTHS = 10;

  constructor(civ, world, rng, x, y, options = {}) {
    this.id = ++_vid;
    this.name = options.name || genVillagerName(rng);
    this.civ = civ;
    this.world = world;

    // Position (world tile coords, fractional)
    this.x = x + rng.next();
    this.y = y + rng.next();

    this.genes = options.genes || Villager.randomGenes(rng, world, x, y);
    this.parents = options.parents || null;

    this.isBaby = !!options.isBaby;
    this.monthAge = options.monthAge ?? (this.isBaby ? 0 : rng.int(16 * 12, 35 * 12));
    this.matureMonths = options.matureMonths || Villager.BABY_MATURE_MONTHS;

    // Needs (0-100)
    this.health = this.isBaby ? 55 + rng.next() * 25 : 80 + rng.next() * 20;
    this.maxHealth = this.isBaby ? 70 : 100;
    this.hunger = this.isBaby ? 30 + rng.next() * 20 : 20 + rng.next() * 30;
    this.energy = this.isBaby ? 65 + rng.next() * 30 : 60 + rng.next() * 40;

    this.age = this.monthAge / 12;
    if (!this.isBaby && options.age !== undefined) this.age = options.age;

    this.lifeExpectancy = 80 + rng.int(0, 40) + (this.genes.stamina - 1) * 8;
    this.fertile = !this.isBaby;
    this.reproTimer = options.reproTimer ?? rng.int(48, 144);

    this.job = this.isBaby ? 'BABY' : 'IDLE';
    this.state = this.isBaby ? 'GROW' : 'WANDER'; // GROW | WANDER | WORK | EAT | SLEEP | FLEE | FIGHT | GOTO
    this.target = null;      // { x, y } or entity
    this.home = null;
    this.dead = false;

    this.speed = (1.2 + rng.next() * 0.6) * this.genes.speed;
    this.attackPower = Math.max(1, Math.round((5 + rng.int(0, 10)) * this.genes.strength));
    this.attackRange = 1.2;
    this.attackCooldown = 0;

    this.workTimer = 0;
    this.stateTimer = 0;
    this.wander_target = null;
    this.onBoat = false;
    this.boatCooldown = 0;
  }

  static clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  static mutate(value, rng, amount = 0.08) {
    return Villager.clamp(value + (rng.next() * 2 - 1) * amount, 0.55, 1.55);
  }

  static randomGenes(rng, world, x, y) {
    const ideal = world?.getGeneIdealAt?.(x, y) || null;
    const base = {
      speed: 0.9 + rng.next() * 0.25,
      stamina: 0.9 + rng.next() * 0.25,
      metabolism: 0.9 + rng.next() * 0.25,
      strength: 0.9 + rng.next() * 0.25,
      fertility: 0.9 + rng.next() * 0.25,
      workRate: 0.9 + rng.next() * 0.25,
      terrain: {
        forest: 1,
        hills: 1,
        desert: 1,
        snow: 1,
        swamp: 1,
        grass: 1
      }
    };

    if (!ideal) return base;

    for (const key of ['speed', 'stamina', 'metabolism', 'strength', 'fertility', 'workRate']) {
      base[key] = Villager.clamp(base[key] * 0.75 + ideal[key] * 0.25, 0.55, 1.55);
    }
    for (const key of Object.keys(base.terrain)) {
      base.terrain[key] = Villager.clamp(base.terrain[key] * 0.75 + (ideal.terrain[key] || 1) * 0.25, 0.55, 1.55);
    }
    return base;
  }

  static inheritGenes(parentA, parentB, world, rng, x, y) {
    const fitA = world.getEnvironmentFitness?.(parentA.genes, x, y) ?? 1;
    const fitB = world.getEnvironmentFitness?.(parentB.genes, x, y) ?? 1;
    const total = fitA + fitB || 1;
    const wa = fitA / total;
    const wb = fitB / total;
    const ideal = world.getGeneIdealAt?.(x, y) || Villager.randomGenes(rng, world, x, y);

    const child = {
      terrain: {}
    };

    // Parents with genes better suited to the local environment are weighted more.
    for (const key of ['speed', 'stamina', 'metabolism', 'strength', 'fertility', 'workRate']) {
      const inherited = parentA.genes[key] * wa + parentB.genes[key] * wb;
      const envBias = ideal[key] ?? 1;
      child[key] = Villager.mutate(inherited * 0.82 + envBias * 0.18, rng, 0.06);
    }

    const terrains = ['forest', 'hills', 'desert', 'snow', 'swamp', 'grass'];
    for (const key of terrains) {
      const inherited = (parentA.genes.terrain?.[key] ?? 1) * wa + (parentB.genes.terrain?.[key] ?? 1) * wb;
      const envBias = ideal.terrain?.[key] ?? 1;
      child.terrain[key] = Villager.mutate(inherited * 0.78 + envBias * 0.22, rng, 0.07);
    }

    return child;
  }

  // Pixel position helpers
  get px() { return (this.x + 0.5) * this.world.tileSize; }
  get py() { return (this.y + 0.5) * this.world.tileSize; }

  get maturityText() {
    if (!this.isBaby) return 'Adult';
    return `${this.monthAge.toFixed(1)} / ${this.matureMonths} months`;
  }

  get environmentFitness() {
    return this.world.getEnvironmentFitness?.(this.genes, this.x, this.y) ?? 1;
  }

  canReproduce() {
    return !this.dead && !this.isBaby && this.fertile && this.age >= 18 && this.age < 45 && this.health > 55 && this.hunger < 65 && this.energy > 25 && this.reproTimer <= 0;
  }

  assignJob(job) {
    if (this.isBaby) {
      this.job = 'BABY';
      return;
    }
    this.job = job;
  }

  update(dt, rng) {
    if (this.dead) return;

    this.monthAge += dt / Villager.SECONDS_PER_MONTH;
    this.age = this.monthAge / 12;

    if (this.isBaby && this.monthAge >= this.matureMonths) {
      this.mature(rng);
    }

    const fitness = Math.max(0.45, this.environmentFitness);
    const hungerRate = (this.isBaby ? 0.14 : 0.22) * this.genes.metabolism / fitness;
    const energyUse = (this.isBaby ? 0.12 : 0.28) / this.genes.stamina;

    this.hunger += dt * hungerRate;
    this.energy -= dt * energyUse;
    this.attackCooldown -= dt;
    this.stateTimer -= dt;
    this.reproTimer -= dt;
    this.boatCooldown -= dt;

    // Natural death
    if (!this.isBaby && this.age > this.lifeExpectancy) {
      const deathChance = (this.age - this.lifeExpectancy) * dt * 0.01;
      if (rng.next() < deathChance) { this.die('old age'); return; }
    }

    if (this.hunger >= 100) { this.health -= dt * (this.isBaby ? 7 : 5); }
    if (this.health <= 0) { this.die('starvation'); return; }

    // Energy sleep
    if (this.energy < 10 && this.state !== 'SLEEP') {
      this.state = 'SLEEP';
      this.stateTimer = 3 + rng.next() * 2;
    }
    if (this.state === 'SLEEP') {
      this.energy = Math.min(100, this.energy + dt * (this.isBaby ? 26 : 20));
      if (this.energy >= 80) this.state = this.isBaby ? 'GROW' : 'WANDER';
      return;
    }

    // Babies grow, eat, wander near home, and flee
    if (this.isBaby) {
      const threat = this.civ.findNearestEnemy(this.x, this.y, 8);
      if (threat) {
        this.state = 'FLEE';
        const dx = this.x - threat.x, dy = this.y - threat.y;
        const len = Math.hypot(dx, dy) || 1;
        this.target = { x: this.x + dx / len * 8, y: this.y + dy / len * 8 };
      }

      if (this.hunger > 55) this.state = 'EAT';

      if (this.state === 'FLEE') this._moveToTarget(dt);
      else if (this.state === 'EAT') this._doEat(dt);
      else this._babyWander(dt, rng);

      return;
    }

    // Flee from enemies
    if (this.job !== 'SOLDIER') {
      const threat = this.civ.findNearestEnemy(this.x, this.y, 8);
      if (threat) {
        this.state = 'FLEE';
        const dx = this.x - threat.x, dy = this.y - threat.y;
        const len = Math.hypot(dx, dy) || 1;
        this.target = { x: this.x + dx / len * 12, y: this.y + dy / len * 12 };
      }
    }

    switch (this.state) {
      case 'FLEE':   this._moveToTarget(dt); if (this.stateTimer <= 0) this.state = 'WANDER'; break;
      case 'FIGHT':  this._doFight(dt, rng); break;
      case 'GOTO':   this._moveToTarget(dt); break;
      case 'WORK':   this._doWork(dt, rng); break;
      case 'EAT':    this._doEat(dt); break;
      default:       this._doWander(dt, rng); break;
    }

    // Decide next state when wandering
    if (this.state === 'WANDER' && this.stateTimer <= 0) {
      this._decideState(rng);
    }

    // Reproduction
    if (this.canReproduce()) {
      const partner = this.civ.findMate(this);
      if (partner) {
        this.civ.birthVillager(this, partner);
        const delay = Math.round((80 + rng.int(0, 120)) / this.genes.fertility);
        this.reproTimer = delay;
        partner.reproTimer = delay + rng.int(0, 48);
      }
    }
  }

  mature(rng) {
    if (!this.isBaby) return;
    this.isBaby = false;
    this.fertile = true;
    this.age = 18;
    this.monthAge = 18 * 12;
    this.maxHealth = 100;
    this.health = Math.max(this.health, 80);
    this.job = 'IDLE';
    this.state = 'WANDER';
    this.speed = (1.2 + rng.next() * 0.6) * this.genes.speed;
    this.attackPower = Math.max(1, Math.round((5 + rng.int(0, 10)) * this.genes.strength));
    this.reproTimer = 48 + rng.int(0, 96);
    this.civ.world.addEvent(`🌱 ${this.name} matured into an adult in ${this.civ.name}.`, this.civ.color, { overlay: false });
  }

  _decideState(rng) {
    this.stateTimer = 0.2 + rng.next() * 1.2;

    if (this.hunger > 85) { this.state = 'EAT'; return; }

    if (this.job === 'SOLDIER') {
      const enemy = this.civ.findNearestEnemy(this.x, this.y, 40);
      if (enemy) {
        this.state = 'FIGHT';
        this.target = enemy;
      } else {
        const objective = this.civ.getWarObjective?.(this.x, this.y);
        if (objective) {
          this.state = 'FIGHT';
          this.target = objective;
        } else {
          // Patrol around town hall
          const th = this.civ.townhall;
          if (th) {
            const angle = rng.next() * Math.PI * 2;
            this.wander_target = { x: th.tx + th.def.width / 2 + Math.cos(angle) * 8, y: th.ty + th.def.height / 2 + Math.sin(angle) * 8 };
            this.state = 'GOTO';
            this.target = this.wander_target;
          }
        }
      }
      return;
    }

    if (this.job === 'FARMER' || this.job === 'HUNTER') { this.state = 'WORK'; return; }
    if (this.job === 'WOODCUT' || this.job === 'MINER') { this.state = 'WORK'; return; }

    this.state = 'WANDER';
  }

  _babyWander(dt, rng) {
    if (!this.wander_target || this._dist(this.wander_target) < 0.5) {
      const th = this.civ.townhall;
      const cx = th ? th.tx + th.def.width / 2 : this.x;
      const cy = th ? th.ty + th.def.height / 2 : this.y;
      const angle = rng.next() * Math.PI * 2;
      const dist = 1.5 + rng.next() * 4;
      this.wander_target = { x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist };
    }
    this._moveTo(this.wander_target.x, this.wander_target.y, dt, 0.65);
  }

  _doWander(dt, rng) {
    if (!this.wander_target || this._dist(this.wander_target) < 0.5) {
      const angle = rng.next() * Math.PI * 2;
      const dist = 2 + rng.next() * 5;
      this.wander_target = { x: this.x + Math.cos(angle) * dist, y: this.y + Math.sin(angle) * dist };
    }
    this._moveTo(this.wander_target.x, this.wander_target.y, dt);
  }

  _doEat(dt) {
    if (this.hunger < 15) { this.state = this.isBaby ? 'GROW' : 'WANDER'; return; }
    if (this.civ.resources.food <= 0) { this.state = this.isBaby ? 'GROW' : 'WANDER'; return; }
    // Consume civ food stock quickly, so villagers do not stand eating forever.
    const eatRate = this.isBaby ? 25 : 55;
    const eat = Math.min(dt * eatRate, this.hunger, this.civ.resources.food);
    this.hunger -= eat;
    this.civ.resources.food -= eat;
    if (this.civ.resources.food <= 0) { this.civ.resources.food = 0; }
    if (this.hunger <= 0) this.state = this.isBaby ? 'GROW' : 'WANDER';
  }

  _doWork(dt, rng) {
    this.workTimer -= dt;
    if (this.workTimer <= 0) {
      this.workTimer = 3 + rng.next() * 2;
      const res = this.civ.resources;
      const rate = this.genes.workRate * Math.max(0.6, this.environmentFitness);
      if (this.job === 'FARMER')  res.food  = Math.min(9999, res.food  + 20 * rate);
      if (this.job === 'WOODCUT') res.wood  = Math.min(9999, res.wood  + 30 * rate);
      if (this.job === 'MINER')   res.stone = Math.min(9999, res.stone + 10 * rate);
      if (this.job === 'HUNTER')  res.food  = Math.min(9999, res.food  + 50 * rate);
    }
    // Move toward a resource node
    if (!this.target || this._dist(this.target) < 1) {
      this.target = this.civ.findWorkTarget(this.job);
    }
    if (this.target) this._moveTo(this.target.x, this.target.y, dt);
    else this._doWander(dt, rng);
  }

  _doFight(dt, rng) {
    if (!this.target || this.target.dead || this.target.hp <= 0) {
      this.target = this.civ.findNearestEnemy(this.x, this.y, 40) || this.civ.getWarObjective?.(this.x, this.y);
      if (!this.target) { this.state = 'WANDER'; return; }
    }

    let tx = this.target.x;
    let ty = this.target.y;
    let isBuilding = false;

    if (this.target.def) {
      isBuilding = true;
      tx = this.target.tx + this.target.def.width / 2;
      ty = this.target.ty + this.target.def.height / 2;
    }

    const dist = Math.hypot(tx - this.x, ty - this.y);
    const range = isBuilding ? this.attackRange + 1.6 : this.attackRange;

    if (dist > range) {
      this._moveTo(tx, ty, dt, 1.15);
    } else if (this.attackCooldown <= 0) {
      if (isBuilding) {
        this.target.hp -= this.attackPower;
        if (typeof Renderer !== 'undefined') Renderer.addEffect(tx, ty, '#ff8844', 0.4);
        if (this.target.hp <= 0 && typeof Combat !== 'undefined') {
          Combat.destroyBuilding(this.world, Game.civs, this.target);
          this.target = null;
        }
      } else {
        this.target.takeDamage(this.attackPower);
        if (typeof Renderer !== 'undefined') Renderer.addEffect(this.target.x, this.target.y, '#ff4444', 0.35);
      }
      this.attackCooldown = 1.2 / this.genes.strength;
    }
  }

  _moveToTarget(dt) {
    if (this.target) this._moveTo(this.target.x, this.target.y, dt);
  }

  _terrainAffinity(terr) {
    if (!terr) return 1;
    if (terr.id === DATA.TERRAIN.FOREST.id) return this.genes.terrain.forest || 1;
    if (terr.id === DATA.TERRAIN.HILLS.id || terr.id === DATA.TERRAIN.MOUNTAIN.id) return this.genes.terrain.hills || 1;
    if (terr.id === DATA.TERRAIN.DESERT.id || terr.id === DATA.TERRAIN.SAND.id) return this.genes.terrain.desert || 1;
    if (terr.id === DATA.TERRAIN.SNOW.id) return this.genes.terrain.snow || 1;
    if (terr.id === DATA.TERRAIN.SWAMP.id) return this.genes.terrain.swamp || 1;
    return this.genes.terrain.grass || 1;
  }

  _moveTo(tx, ty, dt, speedMult = 1) {
    const dx = tx - this.x, dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.1) return;

    const terr = this.world.tileAt(Math.floor(this.x), Math.floor(this.y));
    const affinity = this._terrainAffinity(terr);
    const roadBonus = this.world.hasRoad?.(Math.floor(this.x), Math.floor(this.y)) ? 1.55 : 1;
    let speed = this.speed * affinity * speedMult * roadBonus / (terr.moveCost || 1);

    if (this.onBoat) speed *= 0.75;

    const move = Math.min(speed * dt, dist);
    const nx = this.x + (dx / dist) * move;
    const ny = this.y + (dy / dist) * move;

    const ntx = Math.floor(nx), nty = Math.floor(ny);

    if (this.world.isPassable(ntx, nty)) {
      this.x = Math.max(0, Math.min(this.world.size - 0.01, nx));
      this.y = Math.max(0, Math.min(this.world.size - 0.01, ny));
      this.onBoat = false;
      return;
    }

    if (this.world.isWater?.(ntx, nty) && this._shouldUseBoat(tx, ty)) {
      if (!this.onBoat && this.boatCooldown <= 0) {
        if (this.civ.resources.wood >= 1) this.civ.resources.wood -= 1;
        this.boatCooldown = 180;
      }
      this.onBoat = true;
      this.x = Math.max(0, Math.min(this.world.size - 0.01, nx));
      this.y = Math.max(0, Math.min(this.world.size - 0.01, ny));
      return;
    }

    this.wander_target = null;
    this.target = null;
    this.onBoat = false;
    if (this.state === 'GOTO' || this.state === 'FIGHT') this.state = 'WANDER';
  }

  _shouldUseBoat(tx, ty) {
    if (this.isBaby) return false;
    if (this.onBoat) return true;
    if (this.job === 'SOLDIER' && this.civ.warTarget) return true;
    if (!this.target) return false;
    return Math.hypot(tx - this.x, ty - this.y) > 7;
  }

  _dist(other) { return Math.hypot(other.x - this.x, other.y - this.y); }

  takeDamage(dmg) {
    this.health -= dmg;
    if (this.health <= 0) this.die('combat');
  }

  die(reason) {
    this.dead = true;
    this.civ.onVillagerDeath(this, reason);
  }
}
