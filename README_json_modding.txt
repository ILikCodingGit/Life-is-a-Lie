LifeIsALie JSON Modding Notes
=============================

This build uses a real data.json file as the single source of moddable game data.

Run it through a local server:

  python -m http.server 8000

Then open:

  http://localhost:8000

Why? Browsers usually block fetch('data.json') when opening index.html directly through file://.

What belongs in data.json
-------------------------
- GAME: global options, max population, speed buttons
- TIME: calendar speed, hours/day, days/month, starting hour
- WORLD_GEN: tile size, noise layers, thresholds, resource spawning
- TERRAIN: terrain definitions
- RESOURCES: resource names/colors
- JOBS: job definitions
- UNITS: unit definitions
- VILLAGER: hunger, eating, sleep, work, combat, baby timing
- REPRODUCTION: mate requirements and cooldowns
- GENETICS: mutation, inheritance, environment bias
- ECONOMY: starting resources, passive output, food drain, influence
- AI: job ratios, war chances, build timers, peace rules
- AI_BUILD_PLAN: what the AI can build and when
- BUILDINGS: all buildings, HP, armor, size, cost, upgrades, production
- BOATS: all boats, costs, speed, requirements, cooldowns
- ROAD: road color and speed bonus
- COMBAT: building armor/damage rules
- TECH: tech definitions and unlocks; engine hooks can be expanded later
- EVENTS: random yearly events and effects
- RENDER: camera, day/night, territory overlay, console limits
- NAME_PARTS: generated names
- PERSONALITY: AI personalities

Adding a new building
---------------------
1. Add a new entry to BUILDINGS.
2. Add a rule to AI_BUILD_PLAN if the AI should build it.
3. Optional: add it to TECH unlocks.

Example:

  "TEMPLE": {
    "id": "TEMPLE",
    "name": "Temple",
    "category": "religion",
    "level": 1,
    "width": 2,
    "height": 2,
    "color": "#d8c06a",
    "hp": 180,
    "armor": 1,
    "maxPop": 0,
    "cost": { "wood": 40, "stone": 30 },
    "roadConnect": true,
    "tags": ["religion", "culture"]
  }

Adding a new boat
-----------------
1. Add a new entry to BOATS.
2. Set requiredBuilding if it should require a dock.
3. Set allowSoldiers / allowCivilians.

Example:

  "WARSHIP": {
    "id": "WARSHIP",
    "name": "Warship",
    "color": "#542222",
    "sailColor": "#eeeeee",
    "cost": { "wood": 20, "iron": 6 },
    "speedMult": 1.45,
    "cooldownHours": 60,
    "minDistance": 3,
    "requiredBuilding": "DOCK",
    "maxPassengers": 1,
    "allowSoldiers": true,
    "allowCivilians": false
  }

Hardcoding rule
---------------
Engine code should only hardcode logic that is truly structural, like how to loop through entities.
Numbers, names, HP, costs, tech, jobs, buildings, boats, population tuning, food, combat, and AI rules belong in data.json.
