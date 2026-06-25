const DATA = {
  TERRAIN: {
    DEEP_WATER: { id: 0, name: 'Deep Water',  color: '#1a4a7a', passable: false, buildable: false, resourceMult: 0,   moveCost: 99 },
    WATER:      { id: 1, name: 'Water',        color: '#2a6aaf', passable: false, buildable: false, resourceMult: 0,   moveCost: 99 },
    SAND:       { id: 2, name: 'Sand',         color: '#c9a84c', passable: true,  buildable: true,  resourceMult: 0.4, moveCost: 1.5 },
    GRASS:      { id: 3, name: 'Grassland',    color: '#5d8c3e', passable: true,  buildable: true,  resourceMult: 1.0, moveCost: 1.0 },
    FOREST:     { id: 4, name: 'Forest',       color: '#2d6a1e', passable: true,  buildable: false, resourceMult: 1.2, moveCost: 1.8, wood: true },
    HILLS:      { id: 5, name: 'Hills',        color: '#8a7a50', passable: true,  buildable: true,  resourceMult: 0.7, moveCost: 1.6, stone: true },
    MOUNTAIN:   { id: 6, name: 'Mountain',     color: '#888888', passable: false, buildable: false, resourceMult: 0,   moveCost: 99 },
    DESERT:     { id: 7, name: 'Desert',       color: '#d4a84e', passable: true,  buildable: true,  resourceMult: 0.3, moveCost: 1.3 },
    SNOW:       { id: 8, name: 'Snow',         color: '#dde8e8', passable: true,  buildable: true,  resourceMult: 0.2, moveCost: 1.6 },
    SWAMP:      { id: 9, name: 'Swamp',        color: '#3d5e38', passable: true,  buildable: false, resourceMult: 0.6, moveCost: 2.2 },
  },

  JOBS: {
    IDLE:     { id: 'IDLE',     name: 'Idle',       color: '#888' },
    FARMER:   { id: 'FARMER',   name: 'Farmer',     color: '#c9a84c' },
    WOODCUT:  { id: 'WOODCUT',  name: 'Woodcutter', color: '#5d8c3e' },
    MINER:    { id: 'MINER',    name: 'Miner',      color: '#888888' },
    BUILDER:  { id: 'BUILDER',  name: 'Builder',    color: '#d4884e' },
    SOLDIER:  { id: 'SOLDIER',  name: 'Soldier',    color: '#c84040' },
    HUNTER:   { id: 'HUNTER',   name: 'Hunter',     color: '#7a6030' },
  },

  BUILDINGS: {
    TOWNHALL:  { id: 'TOWNHALL',  name: 'Town Hall',    width: 3, height: 3, color: '#d4884e', maxPop: 20, hp: 400, costWood: 30, costStone: 30 },
    HOUSE:     { id: 'HOUSE',     name: 'House',         width: 2, height: 2, color: '#b07040', maxPop: 6,  hp: 80,  costWood: 10, costStone: 0 },
    FARM:      { id: 'FARM',      name: 'Farm',          width: 2, height: 2, color: '#c9a84c', maxPop: 0,  hp: 40,  costWood: 5,  costStone: 0 },
    LUMBERCAMP:{ id: 'LUMBERCAMP',name: 'Lumber Camp',   width: 2, height: 2, color: '#4a7a30', maxPop: 0,  hp: 60,  costWood: 15, costStone: 5 },
    MINE:      { id: 'MINE',      name: 'Mine',          width: 2, height: 2, color: '#666666', maxPop: 0,  hp: 80,  costWood: 10, costStone: 20 },
    BARRACKS:  { id: 'BARRACKS',  name: 'Barracks',      width: 3, height: 2, color: '#8c2020', maxPop: 0,  hp: 120, costWood: 20, costStone: 20 },
    WATCHTOWER:{ id: 'WATCHTOWER',name: 'Watchtower',    width: 1, height: 1, color: '#8c6040', maxPop: 0,  hp: 60,  costWood: 12, costStone: 8 },
  },

  CIV_COLORS: ['#e05050','#5080e0','#50c050','#e0b030','#c050e0','#50d0d0','#e07030','#a0a0ff'],

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