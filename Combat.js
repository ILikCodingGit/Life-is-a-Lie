const Combat = {
  update(world, civs, dt) {
    // Check soldiers attacking enemy buildings
    for (const civ of civs) {
      if (civ.dead) continue;
      for (const v of civ.villagers) {
        if (v.dead || v.job !== 'SOLDIER') continue;
        if (v.state !== 'FIGHT' && civ.warTarget) {
          const obj = civ.getWarObjective?.(v.x, v.y);
          if (obj) { v.target = obj; v.state = 'FIGHT'; }
        }
        if (v.state !== 'FIGHT') continue;

        // If no villager target, check nearby enemy buildings
        if (!v.target || v.target.dead) {
          const bld = Combat.findEnemyBuilding(civ, v.x, v.y, 3);
          if (bld) {
            const dist = Math.hypot(bld.tx + bld.def.width/2 - v.x, bld.ty + bld.def.height/2 - v.y);
            if (dist < 2) {
              if (v.attackCooldown <= 0) {
                const armor = bld.armor ?? bld.def?.armor ?? 0;
                const mult = (bld.def?.tags || []).includes('townhall') || (bld.def?.tags || []).includes('wall')
                  ? (DATA.COMBAT?.wallTownHallDamageMultiplier || 0.55)
                  : 1;
                const dmg = Math.max(DATA.COMBAT?.minBuildingDamage || 1, Math.floor((v.attackPower - armor) * mult));
                bld.hp -= dmg;
                v.attackCooldown = 1.5;
                if (bld.hp <= 0) {
                  Combat.destroyBuilding(world, civs, bld);
                }
              }
            } else {
              v._moveTo(bld.tx + bld.def.width/2, bld.ty + bld.def.height/2, dt);
            }
          }
        }
      }
    }
  },

  findEnemyBuilding(civ, x, y, range) {
    let best = null, bestDist = range;
    for (const b of Game.world.buildings) {
      if (!b.civ || b.civ === civ) continue;
      if (civ.relations[b.civ.id] !== 'war') continue;
      const cx = b.tx + b.def.width/2, cy = b.ty + b.def.height/2;
      const d = Math.hypot(cx - x, cy - y);
      if (d < bestDist) { bestDist = d; best = b; }
    }
    return best;
  },

  destroyBuilding(world, civs, b) {
    const civ = b.civ;
    const wasTownhall = (b.def.tags || []).includes('townhall');
    world.removeBuilding(b);
    if (civ) {
      const idx = civ.buildings.indexOf(b);
      if (idx >= 0) civ.buildings.splice(idx, 1);
      if (wasTownhall) {
        civ.townhall = null;
        world.addEvent(`🏚 ${civ.colorName ? civ.colorName() : civ.name}'s Town Hall has fallen!`, '#c84040');
      }
    }
  }
};