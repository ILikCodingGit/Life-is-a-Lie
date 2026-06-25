const Game = {
  world:    null,
  civs:     [],
  paused:   false,
  speed:    1,
  lastTime: 0,
  tickAccum: 0,

  start(config) {
    // Show loading overlay
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.innerHTML = `<div>Generating world…</div><div id="loading-bar-wrap"><div id="loading-bar"></div></div>`;
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';

    setTimeout(() => {
      this._generate(config);
      overlay.style.display = 'none';
      this.lastTime = performance.now();
      requestAnimationFrame(t => this.loop(t));
    }, 80);
  },

  _generate(config) {
    const rng = new RNG(config.seed + 1);
    this.world = new World(config);
    this.world.generate();
    this.civs = [];

    const S = config.size;
    const civColors = DATA.CIV_COLORS;
    const persKeys  = Object.keys(DATA.PERSONALITY);
    const positions = this._spreadPositions(config.civCount, S, rng);

    for (let i = 0; i < config.civCount; i++) {
      const civRng = new RNG(config.seed + i * 1000 + 7);
      const name   = genCivName(civRng);
      const color  = civColors[i % civColors.length];
      const pers   = civRng.pick(persKeys);
      const civ    = new Civilization(i, name, color, this.world, civRng, pers);

      const pos    = positions[i];
      const tile   = this.world.findSpawnTile(pos.x, pos.y, 20);
      if (!tile) continue;

      civ.placeInitialBuildings(tile.x, tile.y);
      civ.spawnVillagers(config.startPop, tile.x, tile.y);
      this.civs.push(civ);
    }

    // Center camera on first civ
    if (this.civs.length > 0 && this.civs[0].townhall) {
      const th = this.civs[0].townhall;
      Renderer.cam.zoom = DATA.RENDER?.initialZoom ?? 3;
      Renderer.centerOn((th.tx + 1.5) * this.world.tileSize, (th.ty + 1.5) * this.world.tileSize);
    }

    Renderer.tileCacheDirty = true;
    UI.updateCivBadges();
    UI.updateDate();
    this.world.addEvent(`🌍 World generated with ${this.civs.length} civilizations.`, "#e8a83a", { overlay: false });
  },

  _spreadPositions(count, S, rng) {
    const positions = [];
    const margin = Math.floor(S * (DATA.WORLD_GEN?.spawn?.marginRatio ?? 0.12));
    const inner  = S - margin * 2;
    for (let i = 0; i < count; i++) {
      let best = null, bestMinDist = 0;
      for (let attempt = 0; attempt < (DATA.WORLD_GEN?.spawn?.attempts ?? 30); attempt++) {
        const cx = margin + rng.int(0, inner);
        const cy = margin + rng.int(0, inner);
        let minDist = Infinity;
        for (const p of positions) minDist = Math.min(minDist, Math.hypot(p.x - cx, p.y - cy));
        if (minDist > bestMinDist) { bestMinDist = minDist; best = { x: cx, y: cy }; }
      }
      positions.push(best || { x: margin + rng.int(0, inner), y: margin + rng.int(0, inner) });
    }
    return positions;
  },

  loop(now) {
    requestAnimationFrame(t => this.loop(t));

    const rawDt = Math.min((now - this.lastTime) / 1000, DATA.GAME?.maxFrameDt ?? 0.1);
    this.lastTime = now;

    if (!this.paused && this.world) {
      const dt = rawDt * this.speed;
      this.update(dt);
    }

    if (this.world) {
      Renderer.draw(this.world, this.civs);
    }
  },

  update(dt) {
    this.world.tick++;
    this.tickAccum += dt;

    // Time is fully data-driven in data.json.
    const time = DATA.TIME || {};
    const secondsPerHour = time.secondsPerHour ?? 1;
    const hoursPerDay = time.hoursPerDay ?? 24;
    const daysPerMonth = time.daysPerMonth ?? 30;
    const monthsPerYear = time.monthsPerYear ?? 12;

    while (this.tickAccum >= secondsPerHour) {
      this.tickAccum -= secondsPerHour;
      this.world.dayTime++;

      if (this.world.dayTime >= hoursPerDay) {
        this.world.dayTime = 0;
        this.world.day++;

        if (this.world.day > daysPerMonth) {
          this.world.day = 1;
          this.world.month++;

          if (this.world.month > monthsPerYear) {
            this.world.month = 1;
            this.world.year++;
            this._yearlyEvents();
          }
        }
      }

      UI.updateDate();
    }
    // Update civilizations
    for (const civ of this.civs) {
      civ.update(dt, this.civs);
    }

    // Combat resolution (buildings under siege)
    Combat.update(this.world, this.civs, dt);

    // UI updates (throttled)
    if (this.world.tick % 30 === 0) {
      UI.updateCivBadges();
      if (UI.selected) UI.updateSidebar();
    }
  },

  _yearlyEvents() {
    const rng = new RNG(this.world.year * 999 + 7);
    const alive = this.civs.filter(c => !c.dead);
    if (!alive.length) return;

    // Random yearly events come from data.json.
    const chance = DATA.TIME?.yearlyEventChance ?? 0.25;
    if (rng.next() < chance) {
      const events = DATA.EVENTS?.yearlyRandom || [];
      if (!events.length) return;
      const ev = rng.pick(events);
      this.world.addEvent(`Year ${this.world.year}: ${ev.msg}`, '#e8a83a');
      for (const civ of alive) this._applyEventEffects(civ, ev.effects || []);
    }
  },

  _applyEventEffects(civ, effects) {
    const maxResource = DATA.ECONOMY?.maxResource ?? 9999;
    for (const effect of effects) {
      if (effect.type === 'resource_add') {
        const key = effect.resource;
        civ.resources[key] = Math.max(0, Math.min(maxResource, (civ.resources[key] || 0) + effect.amount));
      }
      if (effect.type === 'damage_first_villagers') {
        for (const v of civ.villagers.slice(0, effect.count || 0)) v.takeDamage(effect.damage || 0);
      }
    }
  }
};

// Boot
window.addEventListener('DOMContentLoaded', async () => {
  await window.DATA_LOAD_PROMISE;
  Renderer.init(document.getElementById('gameCanvas'));
  UI.init();
});