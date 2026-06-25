class World {
  constructor(config) {
    this.size = config.size | 0;
    this.tileSize = DATA.WORLD_GEN?.tileSize ?? 8;
    this.config = config;
    this.rng = new RNG(config.seed);
    this.tiles = null;
    this.resources = [];  // { x, y, type, amount }
    this.buildings = [];
    this.roads = new Set(); // tile keys like "x,y"
    this.day = DATA.TIME?.startDay ?? 1;
    this.month = DATA.TIME?.startMonth ?? 1;
    this.year = DATA.TIME?.startYear ?? 1;
    this.dayTime = DATA.TIME?.startHour ?? 8;
    this.tick = 0;
    this.events = [];
  }

  generate() {
    Noise.seed(this.config.seed);
    const S = this.size;
    const cfg = this.config;

    // Multi-layer noise. Parameters live in data.json.
    const ncfg = DATA.WORLD_GEN?.noise || {};
    const makeNoise = (key, fallback) => {
      const n = ncfg[key] || fallback;
      const off = n.offset || [0, 0];
      return (x, y) => Noise.octave(
        x / S * n.scale + off[0],
        y / S * n.scale + off[1],
        n.octaves,
        n.persistence,
        n.lacunarity
      );
    };
    const elev = makeNoise('elevation', { scale: 3.5, octaves: 6, persistence: 0.5, lacunarity: 2.0, offset: [0, 0] });
    const moist = makeNoise('moisture', { scale: 2.8, octaves: 4, persistence: 0.55, lacunarity: 2.0, offset: [400, 400] });
    const temp = makeNoise('temperature', { scale: 2.2, octaves: 3, persistence: 0.5, lacunarity: 2.0, offset: [800, 800] });
    const forestN = makeNoise('forest', { scale: 6, octaves: 4, persistence: 0.5, lacunarity: 2.0, offset: [200, 200] });

    // Thresholds driven by config sliders. Formula values live in data.json.
    const th = DATA.WORLD_GEN?.thresholds || {};
    const waterThr = (th.waterBase ?? -0.05) + (cfg.water / 100) * (th.waterSliderMult ?? 0.30) + (th.waterOffset ?? -0.15);
    const mountainThr = (th.mountainBase ?? 0.35) + (1 - cfg.mountain / 100) * (th.mountainSliderMult ?? 0.30);
    const forestThr = (th.forestBase ?? -0.1) + (1 - cfg.forest / 100) * (th.forestSliderMult ?? 0.30);
    const desertThr = (cfg.desert / 100) * (th.desertSliderMult ?? 0.3) + (th.desertOffset ?? -0.15);

    this.tiles = new Uint8Array(S * S);
    const T = DATA.TERRAIN;

    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const e = elev(x, y);
        const m = moist(x, y);
        const t = temp(x, y);
        const f = forestN(x, y);

        let tile;
        if (e < waterThr + (DATA.WORLD_GEN?.thresholds?.deepWaterExtra ?? -0.15)) tile = T.DEEP_WATER;
        else if (e < waterThr) tile = T.WATER;
        else if (e > mountainThr + (DATA.WORLD_GEN?.thresholds?.peakExtra ?? 0.1)) tile = T.MOUNTAIN;
        else if (e > mountainThr) tile = T.HILLS;
        else if (t < desertThr + (DATA.WORLD_GEN?.thresholds?.snowExtra ?? -0.15)) tile = T.SNOW;
        else if (t > desertThr + (DATA.WORLD_GEN?.thresholds?.desertExtra ?? 0.1) && m < (DATA.WORLD_GEN?.thresholds?.dryMoisture ?? -0.2)) tile = T.DESERT;
        else if (m > (DATA.WORLD_GEN?.thresholds?.swampMoisture ?? 0.15) && e < (DATA.WORLD_GEN?.thresholds?.swampElevationMax ?? -0.05)) tile = T.SWAMP;
        else if (f > forestThr && e > waterThr) tile = T.FOREST;
        else tile = T.GRASS;

        this.tiles[y * S + x] = tile.id;
      }
    }

    // Place resources
    this.resources = [];
    const resMult = cfg.resourceAbundance / 100;
    const TERRAIN_LIST = Object.values(T);

    const rcfg = DATA.WORLD_GEN?.resources || {};
    const step = rcfg.gridStep ?? 3;
    for (let y = 2; y < S - 2; y += step) {
      for (let x = 2; x < S - 2; x += step) {
        if (this.rng.next() > resMult * (rcfg.spawnChanceMult ?? 0.4)) continue;
        const tid = this.tiles[y * S + x];
        const terr = TERRAIN_LIST.find(t => t.id === tid);
        if (!terr || !terr.passable) continue;
        let type = null;
        if (terr.wood && this.rng.next() < 0.7) type = 'wood';
        else if (terr.stone && this.rng.next() < 0.7) type = 'stone';
        else if (terr.id === T.GRASS.id && this.rng.next() < 0.5) type = 'food';
        else if (terr.id === T.HILLS.id && this.rng.next() < 0.4) type = 'stone';
        if (type) this.resources.push({ x, y, type, amount: (rcfg.amountMin ?? 50) + this.rng.int(0, rcfg.amountRandom ?? 50) });
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

  isWater(tx, ty) {
    const t = this.tileAt(tx, ty);
    return t.id === DATA.TERRAIN.WATER.id || t.id === DATA.TERRAIN.DEEP_WATER.id;
  }

  roadKey(tx, ty) {
    return `${tx},${ty}`;
  }

  hasRoad(tx, ty) {
    return this.roads.has(this.roadKey(Math.floor(tx), Math.floor(ty)));
  }

  addRoad(tx, ty) {
    tx = Math.floor(tx);
    ty = Math.floor(ty);
    if (tx < 0 || ty < 0 || tx >= this.size || ty >= this.size) return false;
    if (!this.isPassable(tx, ty)) return false;
    this.roads.add(this.roadKey(tx, ty));
    if (typeof Renderer !== 'undefined') Renderer.tileCacheDirty = true;
    return true;
  }

  addRoadLine(x1, y1, x2, y2) {
    x1 = Math.floor(x1); y1 = Math.floor(y1);
    x2 = Math.floor(x2); y2 = Math.floor(y2);
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
    let built = 0;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(x1 + (x2 - x1) * t);
      const y = Math.round(y1 + (y2 - y1) * t);
      if (this.addRoad(x, y)) built++;
    }
    return built;
  }

  findSpawnTile(hint_x, hint_y, radius) {
    const S = this.size;
    for (let r = 0; r < radius; r++) {
      const angle = this.rng.next() * Math.PI * 2;
      const dx = Math.round(Math.cos(angle) * r);
      const dy = Math.round(Math.sin(angle) * r);
      const tx = Math.max(1, Math.min(S - 2, hint_x + dx));
      const ty = Math.max(1, Math.min(S - 2, hint_y + dy));
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
        if (!this.tileAt(tx + dx, ty + dy).buildable) return false;
        if (this.getBuildingAt(tx + dx, ty + dy)) return false;
      }
    }
    return true;
  }

  getTerrainKeyAt(x, y) {
    const t = this.tileAt(Math.floor(x), Math.floor(y));
    if (t.id === DATA.TERRAIN.FOREST.id) return 'forest';
    if (t.id === DATA.TERRAIN.HILLS.id || t.id === DATA.TERRAIN.MOUNTAIN.id) return 'hills';
    if (t.id === DATA.TERRAIN.DESERT.id || t.id === DATA.TERRAIN.SAND.id) return 'desert';
    if (t.id === DATA.TERRAIN.SNOW.id) return 'snow';
    if (t.id === DATA.TERRAIN.SWAMP.id) return 'swamp';
    return 'grass';
  }

  getLocalBiomeProfile(x, y, radius = 7) {
    const profile = { forest: 0, hills: 0, desert: 0, snow: 0, swamp: 0, grass: 0 };
    let total = 0;
    const cx = Math.floor(x), cy = Math.floor(y);

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const tx = cx + dx, ty = cy + dy;
        if (tx < 0 || ty < 0 || tx >= this.size || ty >= this.size) continue;
        const key = this.getTerrainKeyAt(tx, ty);
        profile[key]++;
        total++;
      }
    }

    if (!total) {
      profile.grass = 1;
      return profile;
    }

    for (const k of Object.keys(profile)) profile[k] /= total;
    return profile;
  }

  getDominantBiomeAt(x, y, radius = 7) {
    const profile = this.getLocalBiomeProfile(x, y, radius);
    return Object.entries(profile).sort((a, b) => b[1] - a[1])[0][0];
  }

  getGeneIdealAt(x, y) {
    const profile = this.getLocalBiomeProfile(x, y, 8);
    const dominant = Object.entries(profile).sort((a, b) => b[1] - a[1])[0][0];

    const ideal = {
      speed: 1,
      stamina: 1,
      metabolism: 1,
      strength: 1,
      fertility: 1,
      workRate: 1,
      terrain: { forest: 1, hills: 1, desert: 1, snow: 1, swamp: 1, grass: 1 }
    };

    // Bias genes toward what survives best around the settlement.
    if (dominant === 'forest') {
      ideal.speed = 1.08;
      ideal.workRate = 1.18;
      ideal.metabolism = 0.92;
      ideal.terrain.forest = 1.35;
    } else if (dominant === 'hills') {
      ideal.strength = 1.18;
      ideal.stamina = 1.12;
      ideal.workRate = 1.08;
      ideal.terrain.hills = 1.35;
    } else if (dominant === 'desert') {
      ideal.stamina = 1.28;
      ideal.metabolism = 0.75;
      ideal.speed = 1.05;
      ideal.fertility = 0.92;
      ideal.terrain.desert = 1.4;
    } else if (dominant === 'snow') {
      ideal.stamina = 1.25;
      ideal.metabolism = 0.82;
      ideal.strength = 1.08;
      ideal.fertility = 0.9;
      ideal.terrain.snow = 1.4;
    } else if (dominant === 'swamp') {
      ideal.stamina = 1.2;
      ideal.metabolism = 0.86;
      ideal.speed = 0.95;
      ideal.terrain.swamp = 1.4;
    } else {
      ideal.fertility = 1.15;
      ideal.workRate = 1.08;
      ideal.terrain.grass = 1.25;
    }

    return ideal;
  }

  getEnvironmentFitness(genes, x, y) {
    if (!genes) return 1;
    const profile = this.getLocalBiomeProfile(x, y, 6);
    let terrainScore = 0;
    for (const [key, weight] of Object.entries(profile)) {
      terrainScore += weight * (genes.terrain?.[key] ?? 1);
    }

    const ideal = this.getGeneIdealAt(x, y);
    const scalarFit = (
      1.0 - Math.abs((genes.speed ?? 1) - ideal.speed) * 0.25 +
      1.0 - Math.abs((genes.stamina ?? 1) - ideal.stamina) * 0.25 +
      1.0 - Math.abs((genes.metabolism ?? 1) - ideal.metabolism) * 0.30 +
      1.0 - Math.abs((genes.workRate ?? 1) - ideal.workRate) * 0.20
    ) / 4;

    return Math.max(0.45, Math.min(1.55, terrainScore * 0.65 + scalarFit * 0.35));
  }

  getBestBoatFor(civ, villager, targetX, targetY) {
    const boats = Object.values(DATA.BOATS || {});
    let best = null;
    for (const boat of boats) {
      if (!boat) continue;
      if (villager?.job === 'SOLDIER' && boat.allowSoldiers === false) continue;
      if (villager?.job !== 'SOLDIER' && boat.allowCivilians === false) continue;
      if (boat.requiredBuilding && !civ?.getBuildingCount?.(boat.requiredBuilding)) continue;
      if (!canAfford(civ.resources, dataCost(boat))) continue;
      const d = Math.hypot(targetX - villager.x, targetY - villager.y);
      if (d < (boat.minDistance || 0)) continue;
      if (!best || (boat.speedMult || 1) > (best.speedMult || 1)) best = boat;
    }
    return best || (DATA.BOATS ? DATA.BOATS.RAFT : null);
  }

  isNearWater(x, y, radius = 5) {
    const cx = Math.floor(x), cy = Math.floor(y);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const tx = cx + dx, ty = cy + dy;
        if (tx < 0 || ty < 0 || tx >= this.size || ty >= this.size) continue;
        if (this.isWater(tx, ty)) return true;
      }
    }
    return false;
  }

  addEvent(msg, color, options = {}) {
    const event = {
      msg,
      color: color || '#c9a84c',
      tick: this.tick,
      day: this.day,
      month: this.month,
      year: this.year,
      hour: this.dayTime,
      overlay: options.overlay !== false
    };

    this.events.unshift(event);
    if (this.events.length > 300) this.events.pop();

    // Browser dev console, plus the in-game console if it exists.
    console.log(`[Y${this.year} M${this.month} D${this.day} ${String(this.dayTime).padStart(2, '0')}:00] ${msg}`);
    if (typeof UI !== 'undefined' && UI.addConsoleEvent) UI.addConsoleEvent(event);
  }
}

class Building {
  constructor(def, tx, ty, civ) {
    this.def = def;
    this.tx = tx;
    this.ty = ty;
    this.civ = civ;
    this.hp = def.hp || 100;
    this.maxHp = def.hp || 100;
    this.armor = def.armor || 0;
    this.level = def.level || 1;
    this.category = def.category || 'misc';
    this.tags = def.tags || [];
    this.built = true;
    this.id = ++Building._id;
  }

  hasTag(tag) {
    return this.tags.includes(tag);
  }
}
Building._id = 0;
