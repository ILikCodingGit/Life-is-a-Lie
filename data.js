const DATA = {
  GAME: {
    timeScale: 'hour',              // 1 real second = 1 in-game hour
    dayNightDisabledAtSpeed: 10,
    maxPopulationPerCiv: 300,
  },

  TERRAIN: {
    DEEP_WATER: { id: 0, name: 'Deep Water',  color: '#1a4a7a', passable: false, buildable: false, resourceMult: 0,   moveCost: 99, water: true },
    WATER:      { id: 1, name: 'Water',       color: '#2a6aaf', passable: false, buildable: false, resourceMult: 0,   moveCost: 99, water: true },
    SAND:       { id: 2, name: 'Sand',        color: '#c9a84c', passable: true,  buildable: true,  resourceMult: 0.4, moveCost: 1.5 },
    GRASS:      { id: 3, name: 'Grassland',   color: '#5d8c3e', passable: true,  buildable: true,  resourceMult: 1.0, moveCost: 1.0 },
    FOREST:     { id: 4, name: 'Forest',      color: '#2d6a1e', passable: true,  buildable: false, resourceMult: 1.2, moveCost: 1.8, wood: true },
    HILLS:      { id: 5, name: 'Hills',       color: '#8a7a50', passable: true,  buildable: true,  resourceMult: 0.7, moveCost: 1.6, stone: true },
    MOUNTAIN:   { id: 6, name: 'Mountain',    color: '#888888', passable: false, buildable: false, resourceMult: 0,   moveCost: 99, stone: true },
    DESERT:     { id: 7, name: 'Desert',      color: '#d4a84e', passable: true,  buildable: true,  resourceMult: 0.3, moveCost: 1.3 },
    SNOW:       { id: 8, name: 'Snow',        color: '#dde8e8', passable: true,  buildable: true,  resourceMult: 0.2, moveCost: 1.6 },
    SWAMP:      { id: 9, name: 'Swamp',       color: '#3d5e38', passable: true,  buildable: false, resourceMult: 0.6, moveCost: 2.2 },
  },

  JOBS: {
    IDLE:     { id: 'IDLE',     name: 'Idle',       color: '#888' },
    FARMER:   { id: 'FARMER',   name: 'Farmer',     color: '#c9a84c' },
    WOODCUT:  { id: 'WOODCUT',  name: 'Woodcutter', color: '#5d8c3e' },
    MINER:    { id: 'MINER',    name: 'Miner',      color: '#888888' },
    BUILDER:  { id: 'BUILDER',  name: 'Builder',    color: '#d4884e' },
    SOLDIER:  { id: 'SOLDIER',  name: 'Soldier',    color: '#c84040' },
    HUNTER:   { id: 'HUNTER',   name: 'Hunter',     color: '#7a6030' },
    BABY:     { id: 'BABY',     name: 'Baby',       color: '#ffffff' },
  },

  // Building definitions are intentionally JSON-shaped.
  // Add new buildings here, then add them to AI_BUILD_PLAN if the AI should build them automatically.
  BUILDINGS: {
    TOWNHALL: {
      id: 'TOWNHALL', name: 'Town Hall', category: 'core', level: 1,
      width: 3, height: 3, color: '#d4884e', hp: 1500, armor: 3, maxPop: 25,
      cost: { wood: 30, stone: 30 }, roadConnect: true,
      tags: ['core', 'capital', 'townhall'], upgradeTo: 'TOWNHALL_II'
    },
    TOWNHALL_II: {
      id: 'TOWNHALL_II', name: 'Fortified Hall', category: 'core', level: 2,
      width: 4, height: 4, color: '#c27a45', hp: 2600, armor: 6, maxPop: 45,
      cost: { wood: 120, stone: 160, iron: 15 }, roadConnect: true,
      tags: ['core', 'capital', 'townhall', 'fortified'], upgradeTo: 'KEEP'
    },
    KEEP: {
      id: 'KEEP', name: 'Stone Keep', category: 'core', level: 3,
      width: 4, height: 4, color: '#9a6b4c', hp: 4200, armor: 10, maxPop: 70,
      cost: { wood: 200, stone: 350, iron: 40 }, roadConnect: true,
      tags: ['core', 'capital', 'townhall', 'fortified', 'keep']
    },
    HOUSE: {
      id: 'HOUSE', name: 'House', category: 'housing', level: 1,
      width: 2, height: 2, color: '#b07040', hp: 100, armor: 0, maxPop: 6,
      cost: { wood: 10 }, roadConnect: true, tags: ['housing']
    },
    FARM: {
      id: 'FARM', name: 'Farm', category: 'food', level: 1,
      width: 2, height: 2, color: '#c9a84c', hp: 55, armor: 0, maxPop: 0,
      cost: { wood: 5 }, produces: { food: 1.6 }, roadConnect: true, tags: ['food']
    },
    LUMBERCAMP: {
      id: 'LUMBERCAMP', name: 'Lumber Camp', category: 'resource', level: 1,
      width: 2, height: 2, color: '#4a7a30', hp: 80, armor: 1, maxPop: 0,
      cost: { wood: 15, stone: 5 }, produces: { wood: 0.45 }, roadConnect: true, tags: ['wood']
    },
    MINE: {
      id: 'MINE', name: 'Mine', category: 'resource', level: 1,
      width: 2, height: 2, color: '#666666', hp: 110, armor: 2, maxPop: 0,
      cost: { wood: 10, stone: 20 }, produces: { stone: 0.3 }, roadConnect: true, tags: ['stone']
    },
    BARRACKS: {
      id: 'BARRACKS', name: 'Barracks', category: 'military', level: 1,
      width: 3, height: 2, color: '#8c2020', hp: 260, armor: 3, maxPop: 0,
      cost: { wood: 25, stone: 35 }, roadConnect: true, tags: ['military']
    },
    WATCHTOWER: {
      id: 'WATCHTOWER', name: 'Watchtower', category: 'defense', level: 1,
      width: 1, height: 1, color: '#8c6040', hp: 220, armor: 5, maxPop: 0,
      cost: { wood: 12, stone: 18 }, roadConnect: true, tags: ['defense']
    },
    WALL: {
      id: 'WALL', name: 'Wall', category: 'defense', level: 1,
      width: 1, height: 1, color: '#77705f', hp: 550, armor: 9, maxPop: 0,
      cost: { stone: 6 }, roadConnect: false, tags: ['defense', 'wall'], blocksMovement: false
    },
    DOCK: {
      id: 'DOCK', name: 'Dock', category: 'naval', level: 1,
      width: 2, height: 2, color: '#8b5a2b', hp: 180, armor: 2, maxPop: 0,
      cost: { wood: 30, stone: 10 }, roadConnect: true, tags: ['naval', 'boat']
    },
  },

  // AI build plan: tweak rules here instead of editing civilization.js.
  AI_BUILD_PLAN: [
    { building: 'HOUSE',      priority: 100, when: { housingPressure: true } },
    { building: 'FARM',       priority: 90,  when: { farmsPerPop: 0.25 } },
    { building: 'LUMBERCAMP', priority: 70,  when: { maxCount: 1 } },
    { building: 'MINE',       priority: 65,  when: { maxCount: 1 } },
    { building: 'DOCK',       priority: 50,  when: { nearWater: true, minPop: 14, maxCount: 1 } },
    { building: 'BARRACKS',   priority: 45,  when: { minPop: 14, maxCount: 1 } },
    { building: 'WATCHTOWER', priority: 40,  when: { atWar: true, maxCount: 3 } },
    { building: 'WALL',       priority: 35,  when: { atWar: true, maxCount: 18, hasBuilding: 'BARRACKS' } },
  ],

  // Boat definitions are also data-driven.
  // Add new boats here. Villagers auto-pick the best available/affordable boat.
  BOATS: {
    RAFT: {
      id: 'RAFT', name: 'Raft', color: '#5f3a1c', sailColor: '#e6e1aa',
      cost: { wood: 1 }, speedMult: 0.75, cooldownHours: 180, minDistance: 7,
      requiredBuilding: null, maxPassengers: 1, allowSoldiers: true, allowCivilians: true
    },
    CANOE: {
      id: 'CANOE', name: 'Canoe', color: '#7a4a22', sailColor: '#f0d18a',
      cost: { wood: 3 }, speedMult: 1.05, cooldownHours: 120, minDistance: 5,
      requiredBuilding: 'DOCK', maxPassengers: 1, allowSoldiers: true, allowCivilians: true
    },
    LONGBOAT: {
      id: 'LONGBOAT', name: 'Longboat', color: '#8a2f2f', sailColor: '#f2eeee',
      cost: { wood: 8, iron: 1 }, speedMult: 1.25, cooldownHours: 90, minDistance: 4,
      requiredBuilding: 'DOCK', maxPassengers: 1, allowSoldiers: true, allowCivilians: false
    },
  },

  ROAD: {
    color: 'rgba(122, 92, 52, 0.85)',
    speedBonus: 1.55,
  },

  COMBAT: {
    minBuildingDamage: 1,
    wallTownHallDamageMultiplier: 0.55,
  },

  CIV_COLORS: ['#e05050', '#5080e0', '#50c050', '#e0b030', '#c050e0', '#50d0d0', '#e07030', '#a0a0ff'],

  NAME_PARTS: {
    prefixes: ['Great','New','Old','Iron','Golden','Silver','Dark','High','Lost','Ancient','United','Free','Holy','Wild'],
    roots:    ['Avon','Nord','Krath','Ember','Solian','Veth','Calder','Moros','Arken','Theln','Vorn','Ilis','Zeth','Draven'],
    suffixes: ['Empire','Republic','Kingdom','Realm','Federation','Domain','Tribe','Alliance','Pact','Order'],
    vilFirst: ['Aran','Bela','Caro','Dana','Eren','Fira','Galen','Hira','Ivan','Jora','Kael','Lena','Mira','Naran','Orin','Pira','Quil','Rena','Soren','Tara','Ulan','Vera','Wren','Xela','Yara','Zane','Alden','Bryn','Cael','Dara','Elven','Frey','Grel','Hael','Idris','Jalen','Kira','Lyra','Myron','Nora'],
    vilLast:  ['Ash','Brook','Cliff','Dale','Fen','Glen','Holt','Isle','Knoll','Lake','Mere','Nook','Oak','Pike','Reed','Stone','Thorn','Vale','Wood','Yew'],
    townPre:  ['Iron','Stone','River','Hill','Dark','Gold','Silver','Black','Green','Red','White','Storm','Sun','Moon','Star'],
    townSuf:  ['ford','haven','keep','burg','hold','gate','moor','bridge','watch','field','crest','vale','peak','rest','fall'],
  },

  PERSONALITY: {
    AGGRESSIVE:   { war: 0.85, expand: 0.6, trade: 0.2, research: 0.3 },
    ECONOMIC:     { war: 0.2,  expand: 0.5, trade: 0.9, research: 0.5 },
    SCIENTIFIC:   { war: 0.2,  expand: 0.3, trade: 0.5, research: 0.95 },
    EXPANSIONIST: { war: 0.5,  expand: 0.95,trade: 0.3, research: 0.3 },
    BALANCED:     { war: 0.5,  expand: 0.5, trade: 0.5, research: 0.5 },
  },
};

function dataCost(def) {
  return def?.cost || {
    wood: def?.costWood || 0,
    stone: def?.costStone || 0,
    gold: def?.costGold || 0,
    iron: def?.costIron || 0,
    food: def?.costFood || 0,
  };
}

function canAfford(resources, cost = {}) {
  for (const [key, amount] of Object.entries(cost)) {
    if ((resources[key] || 0) < amount) return false;
  }
  return true;
}

function payCost(resources, cost = {}) {
  for (const [key, amount] of Object.entries(cost)) {
    resources[key] = (resources[key] || 0) - amount;
  }
}

// Seeded random utility
class RNG {
  constructor(seed) {
    this._s = (seed | 0) || 12345;
  }
  next() {
    this._s = (Math.imul(this._s ^ (this._s >>> 13), 0x45d9f3b) ^ (this._s >>> 7)) | 0;
    return (this._s >>> 0) / 0x100000000;
  }
  int(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; }
  pick(arr) { return arr[this.int(0, arr.length - 1)]; }
}

function genCivName(rng) {
  const { prefixes, roots, suffixes } = DATA.NAME_PARTS;
  return `${rng.pick(prefixes)} ${rng.pick(roots)} ${rng.pick(suffixes)}`;
}
function genTownName(rng) {
  const { townPre, townSuf } = DATA.NAME_PARTS;
  return rng.pick(townPre) + rng.pick(townSuf);
}
function genVillagerName(rng) {
  const { vilFirst, vilLast } = DATA.NAME_PARTS;
  return `${rng.pick(vilFirst)} ${rng.pick(vilLast)}`;
}
