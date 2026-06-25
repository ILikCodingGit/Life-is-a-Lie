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
    this.ctx = canvas.getContext("2d");
    this.resize();
    window.addEventListener("resize", () => this.resize());

    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.85 : 1.18;
      this.cam.zoom = Math.max(0.5, Math.min(20, this.cam.zoom * factor));
      this._clampCam();
    }, { passive: false });

    canvas.addEventListener("mousedown", e => {
      if (e.button === 1 || e.button === 2) {
        this._dragging = true;
        this._dragStart = { x: e.clientX, y: e.clientY };
        this._camStart = { x: this.cam.x, y: this.cam.y };
        e.preventDefault();
      }
    });

    canvas.addEventListener("mousemove", e => {
      if (this._dragging) {
        this.cam.x = this._camStart.x - (e.clientX - this._dragStart.x) / this.cam.zoom;
        this.cam.y = this._camStart.y - (e.clientY - this._dragStart.y) / this.cam.zoom;
        this._clampCam();
      }
    });

    canvas.addEventListener("mouseup", () => {
      this._dragging = false;
    });

    canvas.addEventListener("contextmenu", e => e.preventDefault());

    canvas.addEventListener("touchstart", e => {
      if (e.touches.length === 1) {
        this._dragging = true;
        this._dragStart = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY
        };
        this._camStart = { x: this.cam.x, y: this.cam.y };
      }
    }, { passive: true });

    canvas.addEventListener("touchmove", e => {
      if (this._dragging && e.touches.length === 1) {
        this.cam.x = this._camStart.x - (e.touches[0].clientX - this._dragStart.x) / this.cam.zoom;
        this.cam.y = this._camStart.y - (e.touches[0].clientY - this._dragStart.y) / this.cam.zoom;
        this._clampCam();
      }
    }, { passive: true });

    canvas.addEventListener("touchend", () => {
      this._dragging = false;
    });
  },

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.tileCacheDirty = true;
  },

  _clampCam() {
    if (!Game.world) return;

    const worldPx = Game.world.size * Game.world.tileSize;
    const maxX = Math.max(0, worldPx - this.canvas.width / this.cam.zoom);
    const maxY = Math.max(0, worldPx - this.canvas.height / this.cam.zoom);

    this.cam.x = Math.max(0, Math.min(maxX, this.cam.x));
    this.cam.y = Math.max(0, Math.min(maxY, this.cam.y));
  },

  centerOn(wx, wy) {
    this.cam.x = wx - this.canvas.width / (2 * this.cam.zoom);
    this.cam.y = wy - this.canvas.height / (2 * this.cam.zoom);
    this._clampCam();
  },

  buildTileCache(world) {
    const S = world.size;
    const TS = world.tileSize;

    const off = document.createElement("canvas");
    off.width = S * TS;
    off.height = S * TS;

    const ctx = off.getContext("2d");
    const TERRAIN = Object.values(DATA.TERRAIN);

    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const id = world.tiles[y * S + x];
        const t = TERRAIN.find(t => t.id === id) || DATA.TERRAIN.GRASS;

        const px = x * TS;
        const py = y * TS;

        ctx.fillStyle = t.color;
        ctx.fillRect(px, py, TS, TS);

        // Grass variation
        if (t.id === DATA.TERRAIN.GRASS.id) {
          if ((x * 17 + y * 31) % 5 === 0) {
            ctx.fillStyle = "rgba(255,255,255,0.035)";
            ctx.fillRect(px, py, TS, TS);
          }
        }

        // Forest details
        if (t.id === DATA.TERRAIN.FOREST.id) {
          ctx.fillStyle = "#1e4f14";
          ctx.beginPath();
          ctx.arc(px + TS * 0.35, py + TS * 0.35, TS * 0.18, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.arc(px + TS * 0.65, py + TS * 0.55, TS * 0.15, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#3f8f2a";
          ctx.fillRect(px + TS * 0.45, py + TS * 0.7, 1, 1);
        }

        // Mountain details
        if (t.id === DATA.TERRAIN.MOUNTAIN.id) {
          ctx.fillStyle = "#666";
          ctx.beginPath();
          ctx.moveTo(px + TS * 0.15, py + TS * 0.85);
          ctx.lineTo(px + TS * 0.5, py + TS * 0.15);
          ctx.lineTo(px + TS * 0.85, py + TS * 0.85);
          ctx.fill();

          ctx.fillStyle = "#aaa";
          ctx.beginPath();
          ctx.moveTo(px + TS * 0.42, py + TS * 0.3);
          ctx.lineTo(px + TS * 0.5, py + TS * 0.15);
          ctx.lineTo(px + TS * 0.58, py + TS * 0.3);
          ctx.fill();
        }

        // Hills details
        if (t.id === DATA.TERRAIN.HILLS.id) {
          ctx.fillStyle = "rgba(0,0,0,0.15)";
          ctx.beginPath();
          ctx.arc(px + TS * 0.5, py + TS * 0.55, TS * 0.3, Math.PI, 0);
          ctx.fill();
        }

        // Water sparkle
        if (
          t.id === DATA.TERRAIN.WATER.id ||
          t.id === DATA.TERRAIN.DEEP_WATER.id
        ) {
          if ((x + y) % 4 === 0) {
            ctx.fillStyle = "rgba(255,255,255,0.15)";
            ctx.fillRect(px + TS * 0.25, py + TS * 0.35, 2, 1);
          }
        }

        // Desert grain
        if (t.id === DATA.TERRAIN.DESERT.id || t.id === DATA.TERRAIN.SAND.id) {
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect(px + TS * 0.3, py + TS * 0.6, 1, 1);
        }

        // Swamp dots
        if (t.id === DATA.TERRAIN.SWAMP.id) {
          ctx.fillStyle = "rgba(0,0,0,0.2)";
          ctx.fillRect(px + TS * 0.4, py + TS * 0.4, 2, 2);
        }
      }
    }

    // Resource dots
    ctx.fillStyle = "rgba(255,255,120,0.7)";
    for (const res of world.resources) {
      if (res.amount <= 0) continue;

      ctx.beginPath();
      ctx.arc(
        res.x * TS + TS / 2,
        res.y * TS + TS / 2,
        TS * 0.18,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    this.tileCache = off;
    this.tileCacheDirty = false;
  },

  draw(world, civs) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const z = this.cam.zoom;
    const TS = world.tileSize;

    ctx.clearRect(0, 0, W, H);

    ctx.save();
    ctx.scale(z, z);
    ctx.translate(-this.cam.x, -this.cam.y);

    if (this.tileCacheDirty || !this.tileCache) {
      this.buildTileCache(world);
    }

    ctx.drawImage(this.tileCache, 0, 0);

    // Territory glow
    for (const civ of civs) {
      if (civ.dead || !civ.townhall) continue;

      const cx = (civ.townhall.tx + civ.townhall.def.width / 2) * TS;
      const cy = (civ.townhall.ty + civ.townhall.def.height / 2) * TS;

      ctx.globalAlpha = 0.08;
      ctx.fillStyle = civ.color;
      ctx.beginPath();
      ctx.arc(cx, cy, 120, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = civ.color;
      ctx.lineWidth = 1 / z;
      ctx.beginPath();
      ctx.arc(cx, cy, 120, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;

    // Buildings
    for (const b of world.buildings) {
      const bx = b.tx * TS;
      const by = b.ty * TS;
      const bw = b.def.width * TS;
      const bh = b.def.height * TS;
      const hpFrac = b.hp / b.maxHp;

      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(bx + 3, by + 3, bw, bh);

      ctx.fillStyle = b.def.color;
      ctx.fillRect(bx, by, bw, bh);

      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fillRect(bx, by, bw, bh * 0.25);

      ctx.fillStyle = "rgba(0,0,0,0.14)";
      ctx.fillRect(bx, by + bh * 0.75, bw, bh * 0.25);

      ctx.strokeStyle = b.civ ? b.civ.color : "#fff";
      ctx.lineWidth = 1.5 / z;
      ctx.strokeRect(bx, by, bw, bh);

      if (hpFrac < 1) {
        ctx.fillStyle = "#222";
        ctx.fillRect(bx, by - 3, bw, 2);

        ctx.fillStyle = hpFrac > 0.5 ? "#7ec850" : "#c84040";
        ctx.fillRect(bx, by - 3, bw * hpFrac, 2);
      }

      if (z > 2.5) {
        ctx.fillStyle = "#fff";
        ctx.font = `${Math.max(5, 7 / z)}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(b.def.name, bx + bw / 2, by + bh / 2 + 2);
      }
    }

    // Villagers
    const baseVr = Math.max(1.5, 3.5 / z);
    const time = performance.now();

    for (const civ of civs) {
      if (civ.dead) continue;

      for (const v of civ.villagers) {
        if (v.dead) continue;

        const vr = v.isBaby ? baseVr * 0.65 : baseVr;
        const bob = Math.sin(time * 0.008 + v.id) * (v.isBaby ? 0.25 : 0.45);

        const vx = v.x * TS;
        const vy = v.y * TS + bob;

        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath();
        ctx.arc(vx + 1, vy + 1, vr, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = civ.color;
        ctx.beginPath();
        ctx.arc(vx, vy, vr, 0, Math.PI * 2);
        ctx.fill();

        // Tiny head
        if (z > 2) {
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(vx, vy - vr * 0.75, vr * 0.42, 0, Math.PI * 2);
          ctx.fill();
        }

        // Job icon
        if (z > 5) {
          let icon = "";

          if (v.isBaby) icon = "🍼";
          else if (v.job === "FARMER") icon = "🌾";
          else if (v.job === "WOODCUT") icon = "🪓";
          else if (v.job === "MINER") icon = "⛏";
          else if (v.job === "SOLDIER") icon = "⚔";
          else if (v.state === "EAT") icon = "🍖";
          else if (v.state === "SLEEP") icon = "💤";

          if (icon) {
            ctx.font = `${Math.max(6, 9 / z)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.fillText(icon, vx, vy - vr - 4 / z);
          }
        }

        if (v.job === "SOLDIER") {
          ctx.strokeStyle = "#ff4444";
          ctx.lineWidth = 0.8 / z;
          ctx.beginPath();
          ctx.arc(vx, vy, vr + 1.2, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (z > 4 && v.health < 80) {
          const barW = vr * 3;

          ctx.fillStyle = "#222";
          ctx.fillRect(vx - barW / 2, vy - vr - 3, barW, 1.5);

          ctx.fillStyle = v.health > 50 ? "#7ec850" : "#c84040";
          ctx.fillRect(vx - barW / 2, vy - vr - 3, barW * (v.health / 100), 1.5);
        }
      }
    }

    this._drawCombatEffects(ctx, TS, z);

    ctx.restore();

    this._drawDayNightOverlay(ctx, world);
    this._drawEventLog(ctx, world);
  },

  _drawDayNightOverlay(ctx, world) {
    const hour = world.dayTime ?? 12;

    let darkness = 0;

    if (hour >= 18) {
      darkness = (hour - 18) / 6;
    } else if (hour < 6) {
      darkness = (6 - hour) / 6;
    }

    darkness = Math.max(0, Math.min(1, darkness));

    if (darkness <= 0) return;

    ctx.fillStyle = `rgba(0,0,40,${darkness * 0.45})`;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  },

  _effects: [],

  addEffect(x, y, color, duration) {
    this._effects.push({
      x,
      y,
      color,
      t: duration,
      maxT: duration
    });
  },

  _drawCombatEffects(ctx, TS, z) {
    for (let i = this._effects.length - 1; i >= 0; i--) {
      const e = this._effects[i];

      e.t -= 0.016;

      if (e.t <= 0) {
        this._effects.splice(i, 1);
        continue;
      }

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

    ctx.font = "11px monospace";
    ctx.textAlign = "right";

    let y = this.canvas.height - 50;

    for (let i = 0; i < Math.min(5, world.events.length); i++) {
      const ev = world.events.filter(e => e.overlay !== false)[i];
      if (!ev) continue;
      const age = world.tick - ev.tick;
      const alpha = Math.max(0, 1 - age / 600);

      ctx.globalAlpha = alpha;
      ctx.fillStyle = ev.color;
      ctx.fillText(ev.msg, W - 295, y);

      y -= 16;
    }

    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  },

  worldToTile(px, py) {
    const z = this.cam.zoom;
    const TS = Game.world ? Game.world.tileSize : 8;

    const wx = (px / z + this.cam.x) / TS;
    const wy = (py / z + this.cam.y) / TS;

    return {
      x: Math.floor(wx),
      y: Math.floor(wy)
    };
  },

  worldToPixel(tx, ty) {
    const TS = Game.world ? Game.world.tileSize : 8;

    return {
      x: tx * TS,
      y: ty * TS
    };
  }
};