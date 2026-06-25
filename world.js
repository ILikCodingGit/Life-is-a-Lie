class World {
  constructor(config) {
    this.size = config.size | 0;
    this.tileSize = 8;
    this.config = config;
    this.rng = new RNG(config.seed);
    this.tiles = null;
    this.resources = [];  // { x, y, type, amount }
    this.buildings = [];
    this.year = 1;
    this.tick = 0;
    this.events = [];
  }

  generate() {
    Noise.seed(this.config.seed);
    const S = this.size;
    const cfg = this.config;

    // Multi-layer noise
    const elev   = (x,y) => Noise.octave(x/S*3.5, y/S*3.5, 6, 0.5, 2.0);
    const moist   = (x,y) => Noise.octave(x/S*2.8 + 400, y/S*2.8 + 400, 4, 0.55, 2.0);
    const temp    = (x,y) => Noise.octave(x/S*2.2 + 800, y/S*2.2 + 800, 3, 0.5, 2.0);
    const forestN = (x,y) => Noise.octave(x/S*6 + 200, y/S*6 + 200, 4, 0.5, 2.0);

    // Thresholds driven by config sliders (0-100 mapped to 0-1)
    const waterThr    = -0.05 + (cfg.water    / 100) * 0.30 - 0.15;
    const mountainThr =  0.35 + (1 - cfg.mountain / 100) * 0.30;
    const forestThr   = -0.1  + (1 - cfg.forest   / 100) * 0.30;
    const desertThr   = (cfg.desert / 100) * 0.3 - 0.15;

    this.tiles = new Uint8Array(S * S);
    const T = DATA.TERRAIN;

    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const e = elev(x, y);
        const m = moist(x, y);
        const t = temp(x, y);
        const f = forestN(x, y);

        let tile;
        if (e < waterThr - 0.15)       tile = T.DEEP_WATER;
        else if (e < waterThr)          tile = T.WATER;
        else if (e > mountainThr + 0.1) tile = T.MOUNTAIN;
        else if (e > mountainThr)       tile = T.HILLS;
        else if (t < desertThr - 0.15)  tile = T.SNOW;
        else if (t > desertThr + 0.1 && m < -0.2) tile = T.DESERT;
        else if (m > 0.15 && e < -0.05) tile = T.SWAMP;
        else if (f > forestThr && e > waterThr) tile = T.FOREST;
        else                            tile = T.GRASS;

        this.tiles[y * S + x] = tile.id;
      }
    }

    // Place resources
    this.resources = [];
    const resMult = cfg.resourceAbundance / 100;
    const TERRAIN_LIST = Object.values(T);

    for (let y = 2; y < S-2; y += 3) {
      for (let x = 2; x < S-2; x += 3) {
        if (this.rng.next() > resMult * 0.4) continue;
        const tid = this.tiles[y * S + x];
        const terr = TERRAIN_LIST.find(t => t.id === tid);
        if (!terr || !terr.passable) continue;
        let type = null;
        if (terr.wood && this.rng.next() < 0.7) type = 'wood';
        else if (terr.stone && this.rng.next() < 0.7) type = 'stone';
        else if (terr.id === T.GRASS.id && this.rng.next() < 0.5) type = 'food';
        else if (terr.id === T.HILLS.id && this.rng.next() < 0.4) type = 'stone';
        if (type) this.resources.push({ x, y, type, amount: 50 + this.rng.int(0, 50) });
      }
    }
  }

  tileAt(x, y) {
    const S = this.size;
    if (x < 0 || y < 0 || x >= S || y >= S) return DATA.TERRAIN.MOUNTAIN;
    const id = this.tiles[y * S + x];
    return Object.values(DATA.TERRAIN).find(t => t.id === id) || DATA.TERRAIN.GRASS;
  }

  isPassable(tx, ty) {
    return this.tileAt(tx, ty).passable;
  }

  findSpawnTile(hint_x, hint_y, radius) {
    const S = this.size;
    for (let r = 0; r < radius; r++) {
      const angle = this.rng.next() * Math.PI * 2;
      const dx = Math.round(Math.cos(angle) * r);
      const dy = Math.round(Math.sin(angle) * r);
      const tx = Math.max(1, Math.min(S-2, hint_x + dx));
      const ty = Math.max(1, Math.min(S-2, hint_y + dy));
      if (this.isPassable(tx, ty)) return { x: tx, y: ty };
    }
    return null;
  }

  addBuilding(building) {
    this.buildings.push(building);
    return building;
  }

  removeBuilding(building) {
    const idx = this.buildings.indexOf(building);
    if (idx >= 0) this.buildings.splice(idx, 1);
  }

  getBuildingAt(tx, ty) {
    return this.buildings.find(b => tx >= b.tx && tx < b.tx + b.def.width && ty >= b.ty && ty < b.ty + b.def.height) || null;
  }

  isBuildable(tx, ty, w, h) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (!this.tileAt(tx+dx, ty+dy).buildable) return false;
        if (this.getBuildingAt(tx+dx, ty+dy)) return false;
      }
    }
    return true;
  }

  addEvent(msg, color) {
    this.events.unshift({ msg, color: color || '#c9a84c', tick: this.tick });
    if (this.events.length > 40) this.events.pop();
  }
}

class Building {
  constructor(def, tx, ty, civ) {
    this.def = def;
    this.tx = tx;
    this.ty = ty;
    this.civ = civ;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.built = true;
    this.id = ++Building._id;
  }
}
Building._id = 0;