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
      Renderer.cam.zoom = 3;
      Renderer.centerOn((th.tx + 1.5) * this.world.tileSize, (th.ty + 1.5) * this.world.tileSize);
    }

    Renderer.tileCacheDirty = true;
    UI.updateCivBadges();
  },

  _spreadPositions(count, S, rng) {
    const positions = [];
    const margin = Math.floor(S * 0.12);
    const inner  = S - margin * 2;
    for (let i = 0; i < count; i++) {
      let best = null, bestMinDist = 0;
      for (let attempt = 0; attempt < 30; attempt++) {
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

    const rawDt = Math.min((now - this.lastTime) / 1000, 0.1);
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

    // Advance year (roughly every 60 real-seconds at 1×)
    if (this.tickAccum >= 60) {
      this.tickAccum -= 60;
      this.world.year++;
      UI.updateYear();
      this._yearlyEvents();
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

    // Random event chance
    if (rng.next() < 0.25) {
      const events = [
        { msg: '🌾 Good harvest! Food supplies increase.', effect: c => { c.resources.food = Math.min(9999, c.resources.food + 80); } },
        { msg: '🌧 Heavy rains flood the lowlands.', effect: null },
        { msg: '💰 Merchant season brings extra gold.', effect: c => { c.resources.gold = Math.min(9999, c.resources.gold + 30); } },
        { msg: '🔥 Wildfire destroys some lumber.', effect: c => { c.resources.wood = Math.max(0, c.resources.wood - 40); } },
        { msg: '💀 Plague spreads through the land.', effect: c => { for (const v of c.villagers.slice(0, 3)) v.takeDamage(50); } },
        { msg: '⚒ Mining boom — stone is plentiful!', effect: c => { c.resources.stone = Math.min(9999, c.resources.stone + 60); } },
      ];
      const ev = rng.pick(events);
      this.world.addEvent(`Year ${this.world.year}: ${ev.msg}`, '#e8a83a');
      if (ev.effect) alive.forEach(ev.effect);
    }
  }
};

// Boot
window.addEventListener('DOMContentLoaded', () => {
  Renderer.init(document.getElementById('gameCanvas'));
  UI.init();
});