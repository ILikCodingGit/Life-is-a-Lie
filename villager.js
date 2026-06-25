let _vid = 0;

class Villager {
  constructor(civ, world, rng, x, y) {
    this.id = ++_vid;
    this.name = genVillagerName(rng);
    this.civ = civ;
    this.world = world;

    // Position (world tile coords, fractional)
    this.x = x + rng.next();
    this.y = y + rng.next();

    // Needs (0-100)
    this.health  = 80 + rng.next() * 20;
    this.maxHealth = 100;
    this.hunger  = 20 + rng.next() * 30;
    this.energy  = 60 + rng.next() * 40;
    this.age     = rng.int(16, 35);
    this.lifeExpectancy = 50 + rng.int(0, 40);
    this.fertile = true;
    this.reproTimer = rng.int(0, 200);

    this.job = 'IDLE';
    this.state = 'WANDER';   // WANDER | WORK | EAT | SLEEP | FLEE | FIGHT | GOTO
    this.target = null;      // { x, y } or entity
    this.home = null;
    this.dead = false;

    this.speed = 1.2 + rng.next() * 0.6;   // tiles/sec
    this.attackPower = 5 + rng.int(0, 10);
    this.attackRange = 1.2;
    this.attackCooldown = 0;

    this.workTimer = 0;
    this.stateTimer = 0;
    this.wander_target = null;
  }

  // Pixel position helpers
  get px() { return (this.x + 0.5) * this.world.tileSize; }
  get py() { return (this.y + 0.5) * this.world.tileSize; }

  assignJob(job) { this.job = job; }

  update(dt, rng) {
    if (this.dead) return;

    this.hunger  += dt * 0.8;
    this.energy  -= dt * 0.5;
    this.attackCooldown -= dt;
    this.stateTimer -= dt;
    this.age += dt / 3650;  // roughly 1 year per minute at normal speed
    this.reproTimer -= dt;

    // Natural death
    if (this.age > this.lifeExpectancy) {
      const deathChance = (this.age - this.lifeExpectancy) * dt * 0.01;
      if (rng.next() < deathChance) { this.die('old age'); return; }
    }
    if (this.hunger >= 100) { this.health -= dt * 5; }
    if (this.health <= 0) { this.die('starvation'); return; }

    // Energy sleep
    if (this.energy < 10 && this.state !== 'SLEEP') {
      this.state = 'SLEEP';
      this.stateTimer = 3 + rng.next() * 2;
    }
    if (this.state === 'SLEEP') {
      this.energy = Math.min(100, this.energy + dt * 20);
      if (this.energy >= 80) this.state = 'WANDER';
      return;
    }

    // Flee from enemies
    if (this.job !== 'SOLDIER') {
      const threat = this.civ.findNearestEnemy(this.x, this.y, 8);
      if (threat) {
        this.state = 'FLEE';
        const dx = this.x - threat.x, dy = this.y - threat.y;
        const len = Math.hypot(dx, dy) || 1;
        this.target = { x: this.x + dx/len*12, y: this.y + dy/len*12 };
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
    if (this.reproTimer <= 0 && this.fertile && this.age >= 18 && this.age < 45 && this.health > 50 && this.hunger < 70) {
      const partner = this.civ.findMate(this);
      if (partner) {
        this.civ.birthVillager(this.x, this.y);
        this.reproTimer = 200 + rng.int(0, 300);
        partner.reproTimer = 200 + rng.int(0, 300);
      }
    }
  }

  _decideState(rng) {
    this.stateTimer = 2 + rng.next() * 3;

    if (this.hunger > 60) { this.state = 'EAT'; return; }

    if (this.job === 'SOLDIER') {
      const enemy = this.civ.findNearestEnemy(this.x, this.y, 20);
      if (enemy) {
        this.state = 'FIGHT';
        this.target = enemy;
      } else {
        // Patrol around town hall
        const th = this.civ.townhall;
        if (th) {
          const angle = rng.next() * Math.PI * 2;
          this.wander_target = { x: th.tx + th.def.width/2 + Math.cos(angle)*6, y: th.ty + th.def.height/2 + Math.sin(angle)*6 };
          this.state = 'GOTO';
          this.target = this.wander_target;
        }
      }
      return;
    }

    if (this.job === 'FARMER' || this.job === 'HUNTER') { this.state = 'WORK'; return; }
    if (this.job === 'WOODCUT' || this.job === 'MINER') { this.state = 'WORK'; return; }

    this.state = 'WANDER';
  }

  _doWander(dt, rng) {
    if (!this.wander_target || this._dist(this.wander_target) < 0.5) {
      const angle = rng.next() * Math.PI * 2;
      const dist  = 2 + rng.next() * 5;
      this.wander_target = { x: this.x + Math.cos(angle)*dist, y: this.y + Math.sin(angle)*dist };
    }
    this._moveTo(this.wander_target.x, this.wander_target.y, dt);
  }

  _doEat(dt) {
    if (this.hunger < 20) { this.state = 'WANDER'; return; }
    // Consume civ food stock
    const eat = Math.min(dt * 15, this.hunger, this.civ.resources.food);
    this.hunger  -= eat;
    this.civ.resources.food -= eat;
    if (this.civ.resources.food <= 0) { this.civ.resources.food = 0; }
    if (this.hunger <= 0) this.state = 'WANDER';
  }

  _doWork(dt, rng) {
    this.workTimer -= dt;
    if (this.workTimer <= 0) {
      this.workTimer = 3 + rng.next() * 2;
      const res = this.civ.resources;
      if (this.job === 'FARMER')  res.food  = Math.min(9999, res.food  + 5);
      if (this.job === 'WOODCUT') res.wood  = Math.min(9999, res.wood  + 3);
      if (this.job === 'MINER')   res.stone = Math.min(9999, res.stone + 2);
      if (this.job === 'HUNTER')  res.food  = Math.min(9999, res.food  + 3);
    }
    // Move toward a resource node
    if (!this.target || this._dist(this.target) < 1) {
      this.target = this.civ.findWorkTarget(this.job);
    }
    if (this.target) this._moveTo(this.target.x, this.target.y, dt);
    else this._doWander(dt, rng);
  }

  _doFight(dt, rng) {
    if (!this.target || this.target.dead) {
      this.target = this.civ.findNearestEnemy(this.x, this.y, 25);
      if (!this.target) { this.state = 'WANDER'; return; }
    }
    const dist = this._dist(this.target);
    if (dist > this.attackRange) {
      this._moveTo(this.target.x, this.target.y, dt);
    } else {
      if (this.attackCooldown <= 0) {
        this.target.takeDamage(this.attackPower);
        this.attackCooldown = 1.5;
      }
    }
  }

  _moveToTarget(dt) {
    if (this.target) this._moveTo(this.target.x, this.target.y, dt);
  }

  _moveTo(tx, ty, dt) {
    const dx = tx - this.x, dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.1) return;

    const terr = this.world.tileAt(Math.floor(this.x), Math.floor(this.y));
    const speed = this.speed / (terr.moveCost || 1);
    const move  = Math.min(speed * dt, dist);
    const nx = this.x + (dx / dist) * move;
    const ny = this.y + (dy / dist) * move;

    const ntx = Math.floor(nx), nty = Math.floor(ny);
    if (this.world.isPassable(ntx, nty)) {
      this.x = Math.max(0, Math.min(this.world.size - 0.01, nx));
      this.y = Math.max(0, Math.min(this.world.size - 0.01, ny));
    }
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