const Renderer = {
  canvas: null,
  ctx: null,
  cam: { x: 0, y: 0, zoom: 1.0 },
  _dragging: false,
  _dragStart: null,
  _camStart: null,
  tileCache: null,
  tileCacheDirty: true,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.85 : 1.18;
      this.cam.zoom = Math.max(0.5, Math.min(10, this.cam.zoom * factor));
    }, { passive: false });

    canvas.addEventListener('mousedown', e => {
      if (e.button === 1 || e.button === 2) {
        this._dragging = true;
        this._dragStart = { x: e.clientX, y: e.clientY };
        this._camStart  = { x: this.cam.x, y: this.cam.y };
        e.preventDefault();
      }
    });
    canvas.addEventListener('mousemove', e => {
      if (this._dragging) {
        this.cam.x = this._camStart.x - (e.clientX - this._dragStart.x) / this.cam.zoom;
        this.cam.y = this._camStart.y - (e.clientY - this._dragStart.y) / this.cam.zoom;
        this._clampCam();
      }
    });
    canvas.addEventListener('mouseup',    () => { this._dragging = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        this._dragging = true;
        this._dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        this._camStart  = { x: this.cam.x, y: this.cam.y };
      }
    }, { passive: true });
    canvas.addEventListener('touchmove', e => {
      if (this._dragging && e.touches.length === 1) {
        this.cam.x = this._camStart.x - (e.touches[0].clientX - this._dragStart.x) / this.cam.zoom;
        this.cam.y = this._camStart.y - (e.touches[0].clientY - this._dragStart.y) / this.cam.zoom;
        this._clampCam();
      }
    }, { passive: true });
    canvas.addEventListener('touchend', () => { this._dragging = false; });
  },

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.tileCacheDirty = true;
  },

  _clampCam() {
    if (!Game.world) return;
    const worldPx = Game.world.size * Game.world.tileSize;
    this.cam.x = Math.max(0, Math.min(worldPx - this.canvas.width / this.cam.zoom, this.cam.x));
    this.cam.y = Math.max(0, Math.min(worldPx - this.canvas.height / this.cam.zoom, this.cam.y));
  },

  centerOn(wx, wy) {
    this.cam.x = wx - this.canvas.width  / (2 * this.cam.zoom);
    this.cam.y = wy - this.canvas.height / (2 * this.cam.zoom);
    this._clampCam();
  },

  buildTileCache(world) {
    const S = world.size, TS = world.tileSize;
    const off = document.createElement('canvas');
    off.width  = S * TS;
    off.height = S * TS;
    const ctx = off.getContext('2d');
    const TERRAIN = Object.values(DATA.TERRAIN);

    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const id = world.tiles[y * S + x];
        const t  = TERRAIN.find(t => t.id === id) || DATA.TERRAIN.GRASS;
        ctx.fillStyle = t.color;
        ctx.fillRect(x * TS, y * TS, TS, TS);
      }
    }

    // Draw resource dots on the tile cache
    ctx.fillStyle = 'rgba(255,255,120,0.6)';
    for (const res of world.resources) {
      if (res.amount <= 0) continue;
      ctx.beginPath();
      ctx.arc(res.x * TS + TS/2, res.y * TS + TS/2, TS * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }

    this.tileCache = off;
    this.tileCacheDirty = false;
  },

  draw(world, civs) {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const z = this.cam.zoom;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.scale(z, z);
    ctx.translate(-this.cam.x, -this.cam.y);

    // Tile layer
    if (this.tileCacheDirty || !this.tileCache) this.buildTileCache(world);
    ctx.drawImage(this.tileCache, 0, 0);

    const TS = world.tileSize;

    // Buildings
    for (const b of world.buildings) {
      const bx = b.tx * TS, by = b.ty * TS;
      const bw = b.def.width * TS, bh = b.def.height * TS;
      const hpFrac = b.hp / b.maxHp;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(bx+2, by+2, bw, bh);

      // Body
      ctx.fillStyle = b.def.color;
      ctx.fillRect(bx, by, bw, bh);

      // Civ border
      ctx.strokeStyle = b.civ ? b.civ.color : '#fff';
      ctx.lineWidth = 1.5 / z;
      ctx.strokeRect(bx, by, bw, bh);

      // HP bar
      if (hpFrac < 1) {
        ctx.fillStyle = '#333';
        ctx.fillRect(bx, by - 3, bw, 2);
        ctx.fillStyle = hpFrac > 0.5 ? '#7ec850' : '#c84040';
        ctx.fillRect(bx, by - 3, bw * hpFrac, 2);
      }

      // Label at higher zoom
      if (z > 2.5) {
        ctx.fillStyle = '#fff';
        ctx.font = `${Math.max(5, 7/z)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(b.def.name, bx + bw/2, by + bh/2 + 2);
      }
    }

    // Villagers
    const vr = Math.max(1.5, 3.5 / z);
    for (const civ of civs) {
      if (civ.dead) continue;
      ctx.fillStyle = civ.color;
      for (const v of civ.villagers) {
        if (v.dead) continue;
        const vx = v.x * TS, vy = v.y * TS;

        // Body
        ctx.beginPath();
        ctx.arc(vx, vy, vr, 0, Math.PI * 2);
        ctx.fill();

        // Soldier ring
        if (v.job === 'SOLDIER') {
          ctx.strokeStyle = '#ff4444';
          ctx.lineWidth = 0.8 / z;
          ctx.beginPath();
          ctx.arc(vx, vy, vr + 1.2, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Health at higher zoom
        if (z > 4 && v.health < 80) {
          const barW = vr * 3;
          ctx.fillStyle = '#333';
          ctx.fillRect(vx - barW/2, vy - vr - 3, barW, 1.5);
          ctx.fillStyle = v.health > 50 ? '#7ec850' : '#c84040';
          ctx.fillRect(vx - barW/2, vy - vr - 3, barW * (v.health/100), 1.5);
        }
      }
    }

    // Combat flash effects
    this._drawCombatEffects(ctx, TS, z);

    ctx.restore();

    // HUD event log overlay
    this._drawEventLog(ctx, world);
  },

  _effects: [],
  addEffect(x, y, color, duration) {
    this._effects.push({ x, y, color, t: duration, maxT: duration });
  },
  _drawCombatEffects(ctx, TS, z) {
    for (let i = this._effects.length - 1; i >= 0; i--) {
      const e = this._effects[i];
      e.t -= 0.016;
      if (e.t <= 0) { this._effects.splice(i, 1); continue; }
      const alpha = e.t / e.maxT;
      const r = (1 - alpha) * 8;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 1 / z;
      ctx.beginPath();
      ctx.arc(e.x * TS, e.y * TS, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  },

  _drawEventLog(ctx, world) {
    if (!world.events.length) return;
    const W = this.canvas.width;
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    let y = this.canvas.height - 50;
    for (let i = 0; i < Math.min(5, world.events.length); i++) {
      const ev = world.events[i];
      const age = world.tick - ev.tick;
      const alpha = Math.max(0, 1 - age / 600);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ev.color;
      ctx.fillText(ev.msg, W - 295, y);
      y -= 16;
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  },

  worldToTile(px, py) {
    const z = this.cam.zoom;
    const TS = Game.world ? Game.world.tileSize : 8;
    const wx = (px / z + this.cam.x) / TS;
    const wy = (py / z + this.cam.y) / TS;
    return { x: Math.floor(wx), y: Math.floor(wy) };
  },

  worldToPixel(tx, ty) {
    const TS = Game.world ? Game.world.tileSize : 8;
    return { x: tx * TS, y: ty * TS };
  }
};