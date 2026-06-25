const UI = {
  selected: null,

  init() {
    const sliders = [
      ['sl-forest', 'lbl-forest', '%'],
      ['sl-water',  'lbl-water',  '%'],
      ['sl-mountain','lbl-mountain','%'],
      ['sl-desert', 'lbl-desert', '%'],
      ['sl-resource','lbl-resource','%'],
      ['sl-civcount','lbl-civcount',''],
      ['sl-startpop','lbl-startpop',''],
    ];
    for (const [id, lbl, suffix] of sliders) {
      const el = document.getElementById(id);
      const lb = document.getElementById(lbl);
      if (el && lb) {
        el.addEventListener('input', () => { lb.textContent = el.value + suffix; });
      }
    }

    document.getElementById('btn-generate').addEventListener('click', () => this.startGame());

    document.getElementById('btn-pause').addEventListener('click', () => { Game.paused = !Game.paused; document.getElementById('btn-pause').textContent = Game.paused ? '▶' : '⏸'; });
    document.getElementById('btn-speed1').addEventListener('click', () => this.setSpeed(1));
    document.getElementById('btn-speed2').addEventListener('click', () => this.setSpeed(2));
    document.getElementById('btn-speed4').addEventListener('click', () => this.setSpeed(4));
    document.getElementById('btn-menu').addEventListener('click', () => {
      document.getElementById('screen-game').classList.remove('active');
      document.getElementById('screen-menu').classList.add('active');
    });

    document.getElementById('gameCanvas').addEventListener('click', e => this.onCanvasClick(e));
    document.getElementById('gameCanvas').addEventListener('mousemove', e => this.onCanvasMove(e));
  },

  setSpeed(s) {
    Game.speed = s;
    ['btn-speed1','btn-speed2','btn-speed4'].forEach(id => document.getElementById(id).classList.remove('active'));
    document.getElementById(`btn-speed${s}`).classList.add('active');
  },

  startGame() {
    const seed    = parseInt(document.getElementById('sl-seed').value) || Math.floor(Math.random() * 999999);
    document.getElementById('sl-seed').value = seed;
    const config  = {
      seed,
      size:              parseInt(document.getElementById('sl-mapsize').value),
      forest:            parseInt(document.getElementById('sl-forest').value),
      water:             parseInt(document.getElementById('sl-water').value),
      mountain:          parseInt(document.getElementById('sl-mountain').value),
      desert:            parseInt(document.getElementById('sl-desert').value),
      resourceAbundance: parseInt(document.getElementById('sl-resource').value),
      civCount:          parseInt(document.getElementById('sl-civcount').value),
      startPop:          parseInt(document.getElementById('sl-startpop').value),
    };

    document.getElementById('screen-menu').classList.remove('active');
    document.getElementById('screen-game').classList.add('active');
    Game.start(config);
  },

  onCanvasClick(e) {
    if (!Game.world) return;
    const tile = Renderer.worldToTile(e.clientX, e.clientY);

    // Find clicked villager
    const TS = Game.world.tileSize;
    const z  = Renderer.cam.zoom;
    for (const civ of Game.civs) {
      for (const v of civ.villagers) {
        const vsx = (v.x * TS - Renderer.cam.x) * z;
        const vsy = (v.y * TS - Renderer.cam.y) * z;
        if (Math.hypot(vsx - e.clientX, vsy - e.clientY) < 8) {
          this.selected = { type: 'villager', obj: v };
          this.updateSidebar();
          return;
        }
      }
    }

    // Find clicked building
    const b = Game.world.getBuildingAt(tile.x, tile.y);
    if (b) {
      this.selected = { type: 'building', obj: b };
      this.updateSidebar();
      return;
    }

    this.selected = null;
    this.updateSidebar();
  },

  onCanvasMove(e) {
    if (!Game.world) return;
    const tile = Renderer.worldToTile(e.clientX, e.clientY);
    const t    = Game.world.tileAt(tile.x, tile.y);
    document.getElementById('tooltip-panel').textContent = `${t.name}  [${tile.x}, ${tile.y}]  Right-drag to pan · Scroll to zoom`;
  },

  updateSidebar() {
    const header = document.getElementById('sidebar-header');
    const body   = document.getElementById('sidebar-body');
    const sel    = this.selected;

    if (!sel) {
      header.textContent = 'Selected';
      body.innerHTML = '<span style="color:var(--muted)">Click a unit or building</span>';
      return;
    }

    if (sel.type === 'villager') {
      const v = sel.obj;
      if (v.dead) { header.textContent = 'Dead'; body.innerHTML = ''; return; }
      header.textContent = v.name;
      body.innerHTML = `
        <div class="sb-section">Health</div>
        <div class="sb-health-bar"><div class="sb-health-fill" style="width:${v.health}%"></div></div>
        <div class="sb-row"><span class="sb-label">Civilization</span><span class="sb-value" style="color:${v.civ.color}">${v.civ.name}</span></div>
        <div class="sb-row"><span class="sb-label">Age</span><span class="sb-value">${v.age.toFixed(1)}</span></div>
        <div class="sb-row"><span class="sb-label">Job</span><span class="sb-value">${v.job}</span></div>
        <div class="sb-row"><span class="sb-label">State</span><span class="sb-value">${v.state}</span></div>
        <div class="sb-row"><span class="sb-label">Hunger</span><span class="sb-value">${v.hunger.toFixed(0)}%</span></div>
        <div class="sb-row"><span class="sb-label">Energy</span><span class="sb-value">${v.energy.toFixed(0)}%</span></div>
        <div class="sb-row"><span class="sb-label">Position</span><span class="sb-value">${v.x.toFixed(1)}, ${v.y.toFixed(1)}</span></div>
      `;
    } else if (sel.type === 'building') {
      const b = sel.obj;
      header.textContent = b.def.name;
      const hpPct = (b.hp / b.maxHp * 100).toFixed(0);
      body.innerHTML = `
        <div class="sb-section">Integrity</div>
        <div class="sb-health-bar"><div class="sb-health-fill" style="width:${hpPct}%;background:${hpPct>50?'var(--accent)':'var(--danger)'}"></div></div>
        <div class="sb-row"><span class="sb-label">Owner</span><span class="sb-value" style="color:${b.civ?.color||'#fff'}">${b.civ?.name||'?'}</span></div>
        <div class="sb-row"><span class="sb-label">HP</span><span class="sb-value">${b.hp.toFixed(0)} / ${b.maxHp}</span></div>
        <div class="sb-row"><span class="sb-label">Size</span><span class="sb-value">${b.def.width}×${b.def.height}</span></div>
      `;
    }
  },

  updateCivBadges() {
    const container = document.getElementById('hud-civs');
    container.innerHTML = '';
    for (const civ of Game.civs) {
      const badge = document.createElement('div');
      badge.className = 'civ-badge' + (civ.dead ? ' dead' : '');
      badge.innerHTML = `<span class="civ-dot" style="background:${civ.color}"></span><span class="civ-name">${civ.name.split(' ').slice(-1)[0]}</span><span class="civ-pop">${civ.population}</span>`;
      badge.addEventListener('click', () => {
        if (civ.townhall) {
          const px = (civ.townhall.tx + 1) * Game.world.tileSize;
          const py = (civ.townhall.ty + 1) * Game.world.tileSize;
          Renderer.centerOn(px, py);
        }
      });
      container.appendChild(badge);
    }
  },

  updateYear() {
    document.getElementById('hud-year').textContent = `Year ${Game.world.year}`;
  }
};