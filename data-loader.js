/*
  Data loader for LifeIsALie.
  All moddable game content lives in data.json.
  Engine code should read values from DATA instead of hardcoding content.
*/
var DATA = null;
var RNG = null;
var DATA_LOAD_PROMISE = (async function loadGameData() {
  try {
    const response = await fetch('data.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    DATA = await response.json();
    window.DATA = DATA;
    window.dispatchEvent(new CustomEvent('lifeisalie:data-loaded', { detail: DATA }));
    return DATA;
  } catch (err) {
    const msg = [
      'Could not load data.json.',
      'Because this build uses a real JSON file, open it through a local server:',
      'python -m http.server 8000',
      'Then open http://localhost:8000',
      '',
      String(err)
    ].join('\n');
    console.error(msg);
    const box = document.createElement('pre');
    box.style.cssText = 'position:fixed;inset:20px;z-index:99999;background:#120b0b;color:#ffd0d0;border:1px solid #c84040;padding:16px;white-space:pre-wrap;font:14px monospace;';
    box.textContent = msg;
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(box));
    throw err;
  }
})();
window.DATA_LOAD_PROMISE = DATA_LOAD_PROMISE;

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

RNG = class RNG {
  constructor(seed) {
    this._s = (seed | 0) || 12345;
  }
  next() {
    this._s = (Math.imul(this._s ^ (this._s >>> 13), 0x45d9f3b) ^ (this._s >>> 7)) | 0;
    return (this._s >>> 0) / 0x100000000;
  }
  int(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; }
  pick(arr) { return arr[this.int(0, arr.length - 1)]; }
};
window.RNG = RNG;

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
