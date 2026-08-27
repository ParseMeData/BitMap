'use strict';
/* ── the towns map ──────────────────────────────────────────────────────
   Where the towns are. The compass's fourth diamond opens a page: the
   country typeset in diamonds, cut to state › region › district, and on
   it every plate that knows where it is, as a dot with its name. Click a
   dot to stand on that plate; click the land to open what is under the
   cursor; Esc goes up a level and then out. A plate with no anchor is
   listed under the map rather than drawn, and the one you are standing
   on can be pinned to any cell of land from here.

   The graph of how plates join (`src/atlas.js`) is one picture of the
   town; this is the other. That one says which road leads where; this
   one says where on the ground each plate falls. They share `hq.atlas`,
   and nothing here writes to it except a pin.

   It is made of the plate's own material, by the rule in STYLE.md (*The
   lattice*): a lattice at the plate's pitch laid over the screen, each
   point lit by the cell of country under it, painted through
   `Title.paint`. The map zooms; the diamond never does. It is a page of
   chrome, not the plate — the plate's diamonds are the GL stream, and
   this never reaches it.

   Nothing is drawn per frame that can be drawn once. A `sheet` is an
   offscreen canvas holding one whole rendering, tagged with the slice of
   the grid it covers; a frame is sheets blitted with a transform. That is
   what makes the drill animate — the old sheet and the new one are
   cross-faded while the viewport eases between their bounds, and neither
   is re-typeset while it moves. The dots are few and drawn last, every
   frame, over the top.                                                    */

const Towns = (() => {
  const MAX_PITCH = 22;                     // CSS px a cell of country may reach; past it a district is a chart
  const DUR = 420;
  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };

  let el = null, cv = null, ctx = null, stage = null;
  let C = null;                             // the decoded country, once loaded
  let open = false, pinning = false;
  let W = 0, H = 0, DPR = 1;
  let scope = null, hover = null, hoverDot = null;
  let base = null, lit = null, from = null, fromBox = null, t0 = 0;
  let liveBox = null, targetBox = null, dirty = true, raf = 0;
  const rowFor = new Map();

  /* ── the material ──────────────────────────────────────────────────────
     STYLE.md, *The lattice*: this page draws no diamonds of its own. It
     lays a lattice over the screen at the plate's pitch — the plate's cell
     at fit-all, about three pixels — asks which cell of the country each
     lattice point falls in, and hands the lit points to `Title.paint`,
     which is the one chrome path that knows what a diamond is. The map
     zooms; the diamond does not: what changes with the level is how many
     cells of country one diamond stands for, never the diamond.

     Tokens as normalised rgb, read once from the stylesheet. */
  const tok = n => getComputedStyle(document.documentElement).getPropertyValue('--' + n).trim();
  const rgbOf = hex => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];
  let INK = null;
  const ink = () => INK || (INK = {bone: rgbOf(tok('bone')), aqua: rgbOf(tok('aqua')), flare: rgbOf(tok('flare')),
                                   gold: rgbOf(tok('gold')), ground: rgbOf(tok('ground')), dim: rgbOf(tok('dim'))});
  /* the plate's cell on screen at fit-all, in device pixels — the one
     pitch (STYLE.md); a fallback for a page with no plate yet */
  const pitch = () => (typeof G !== 'undefined' && G.A && G.fitAll ? G.A.cell * G.fitAll : 3.17) * DPR;

  /* a face for Title.paint, the size of the sheet at that pitch */
  function face(){
    const p = pitch();
    return {cols: Math.ceil(W / p), rows: Math.ceil(H / p), cells: [], p};
  }
  const cell = (f, i, j, al, rgb) => f.cells.push({x: i, y: j, al, rgb, sz: 1});

  /* ── view ───────────────────────────────────────────────────────────── */
  function boxOf(s, pad){
    const w = s.c1 - s.c0 + 1, h = s.r1 - s.r0 + 1;
    const m = Math.max(w, h) * (pad === undefined ? .05 : pad);
    return {x0: s.c0 - m, y0: s.r0 - m, x1: s.c1 + 1 + m, y1: s.r1 + 1 + m};
  }
  function fit(box){
    const s = Math.min(MAX_PITCH * DPR, Math.min(W / (box.x1 - box.x0), H / (box.y1 - box.y0)));
    return {s, ox: (W - (box.x1 - box.x0) * s) / 2 - box.x0 * s,
               oy: (H - (box.y1 - box.y0) * s) / 2 - box.y0 * s};
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const between = (a, b, t) => ({x0: lerp(a.x0, b.x0, t), y0: lerp(a.y0, b.y0, t),
                                 x1: lerp(a.x1, b.x1, t), y1: lerp(a.y1, b.y1, t)});

  /* ── sheets ─────────────────────────────────────────────────────────────
     A sheet is one whole rendering, built once per level and blitted with
     a transform while the view eases. The country's data is strided by
     the lattice itself: far out, one diamond stands for many cells; close
     in, many diamonds fill one cell. Either way the diamond is the
     plate's. */
  function sheet(sc, box, only){
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const {s, ox, oy} = fit(box);
    const g = C.grid, ed = C.edge, rg = C.regionOf, st = C.stateOf;
    const cols = C.cols, rows = C.rows, d = sc.depth;
    const holds = C.holds, K = ink();
    const f = face(), p = f.p;
    const out = {canvas: cv, box: {x0: -ox / s, y0: -oy / s, x1: (W - ox) / s, y1: (H - oy) / s}};
    /* the cell of country under a lattice point, or -1 for the sea and
       beyond the window */
    const under = (i, j) => {
      const c = Math.floor(((i + 0.5) * p - ox) / s), r = Math.floor(((j + 0.5) * p - oy) / s);
      if (c < 0 || r < 0 || c >= cols || r >= rows) return -1;
      const k = r * cols + c;
      return g[k] ? k : -1;
    };

    /* Three roles and no more: the thing being spoken about, the thing it
       sits inside, and everything else. Land is bone; aqua is spent only on
       the divisions; flare is what is under the cursor. Alphas are for a
       diamond that covers its cell (STYLE: 0.75 half-size overlaps), so
       they are the tone itself — the overlay's land peaks about .65 of
       bone, and the subject sits under that so the lines read over it. */
    if (only){
      for (let j = 0; j < f.rows; j++) for (let i = 0; i < f.cols; i++){
        const k = under(i, j);
        if (k >= 0 && holds(only, k)) cell(f, i, j, .9, K.flare);
      }
      Title.paint(cv, f, {weight: 1});
      return out;
    }
    const parent = d >= 2 ? C.parentOf(sc) : null;
    const aIn = [.30, .22, .25, .40][d], aMid = d === 2 ? .11 : .13, aOut = .05;
    for (let j = 0; j < f.rows; j++) for (let i = 0; i < f.cols; i++){
      const k = under(i, j);
      if (k < 0) continue;
      if (holds(sc, k)) cell(f, i, j, aIn, K.bone);
      else if (parent && holds(parent, k)) cell(f, i, j, aMid, K.bone);
      else if (d > 0) cell(f, i, j, aOut, K.bone);
    }

    /* Boundaries: one diamond per edge cell, snapped to the lattice point
       it falls under, so a line drawn far out — where a cell is smaller
       than a diamond — is still a line and not a sprinkle; and drawn close
       in, where a cell is many diamonds wide, still one diamond thick.
       Aqua is graded rather than uniform: loudest is the outline of where
       you are standing, then what you can open, then what is beside you. */
    const own = d === 3 ? g : rg;
    const rim = i => own[i] === sc.id || ((i % cols) + 1 < cols && own[i + 1] === sc.id) ||
                     (i + cols < own.length && own[i + cols] === sc.id);
    const c0 = Math.max(0, Math.floor(-ox / s)), c1 = Math.min(cols - 1, Math.ceil((W - ox) / s));
    const r0 = Math.max(0, Math.floor(-oy / s)), r1 = Math.min(rows - 1, Math.ceil((H - oy) / s));
    const seen = new Set();
    const LOUD = .95, MID = .6, SOFT = d === 1 ? .42 : .3, FAINT = .2;
    for (const k of C.edgeList){
      const cc = k % cols; if (cc < c0 || cc > c1) continue;
      const rr = (k / cols) | 0; if (rr < r0 || rr > r1) continue;
      const e = ed[k];
      let a = 0;
      if (d === 0) a = (e & 4) ? LOUD : 0;
      else if (d === 1) a = st[k] === sc.id ? ((e & 2) ? LOUD : 0) : ((e & 4) ? SOFT : 0);
      else if (d === 2){
        if ((e & 2) && rim(k)) a = LOUD;
        else if (rg[k] === sc.id) a = (e & 1) ? MID : 0;
        else if (st[k] === sc.state) a = (e & 2) ? SOFT : 0;
        else a = (e & 4) ? FAINT : 0;
      } else {
        if ((e & 1) && rim(k)) a = LOUD;
        else if (rg[k] === sc.region) a = (e & 1) ? SOFT : 0;
        else a = (e & 2) ? FAINT : 0;
      }
      if (!a) continue;
      /* the division is stored on the cell's right and lower sides, on the
         side that differs. Far out, a cell is smaller than the pitch and
         its one diamond lands on the lattice point under that side; close
         in, a cell is many diamonds wide, and the diamonds walk along the
         side at every lattice step — so the line is one diamond thick at
         every level and never beads. */
      const right = cc + 1 < cols && g[k + 1] && g[k + 1] !== g[k];
      const down = rr + 1 < rows && g[k + cols] && g[k + cols] !== g[k];
      const half = Math.min(s, p) / 2;
      const lay = (x, y) => {
        const i = Math.floor(x / p), j = Math.floor(y / p);
        if (i < 0 || j < 0 || i >= f.cols || j >= f.rows) return;
        const id = j * f.cols + i;
        if (seen.has(id)) return;
        seen.add(id);
        cell(f, i, j, a, K.aqua);
      };
      const x1 = (cc + 1) * s + ox - half, y1 = (rr + 1) * s + oy - half;
      if (right || !down) for (let y = rr * s + oy + half; y <= y1 + 0.01; y += Math.max(p, 0.5)) lay(x1, y);
      if (down) for (let x = cc * s + ox + half; x <= x1 + 0.01; x += Math.max(p, 0.5)) lay(x, y1);
    }
    Title.paint(cv, f, {weight: 1});
    return out;
  }

  /* ── the plates on the map ──────────────────────────────────────────────
     Every plate with an anchor, at the cell it falls in. Gold, because a
     dot is a place with something in it; the plate you are standing on in
     flare, like every selection. Read fresh from the atlas each time — a
     pin or a new plate must show without a rebuild. */
  function dots(){
    const areas = Atlas.areas(), cur = Atlas.current(), out = [];
    for (const id in areas){
      const g = Atlas.geo(id); if (!g) continue;
      const c = C.colOf(g.lon), r = C.rowOf(g.lat);
      if (c < 0 || r < 0 || c >= C.cols || r >= C.rows) continue;
      out.push({id, name: areas[id].name, c, r, i: r * C.cols + c, here: id === cur, geo: g});
    }
    return out;
  }
  const unplaced = () => Object.keys(Atlas.areas()).filter(id => !Atlas.geo(id));
  const within = (sc, d) => sc.depth === 0 || C.holds(sc, d.i);

  /* ── the roads between them ────────────────────────────────────────────
     Every link in the atlas whose two plates both have an anchor, as one
     aqua line between their dots — drawn once, from the lower id, so a
     road joined both ways is one road. Aqua because this is what the map
     is spent on: the divisions of the country and the joins of the town
     are the same kind of fact, where one place meets another. A link to a
     plate with no anchor is not drawn: a line to nowhere says nothing. */
  function drawLinks(m, ds){
    const areas = Atlas.areas(), at = {};
    for (const d of ds) at[d.id] = d;
    ctx.strokeStyle = tok('aqua'); ctx.lineWidth = Math.max(1, 1.2 * DPR); ctx.globalAlpha = .55;
    ctx.setLineDash([3 * DPR, 3 * DPR]);
    ctx.beginPath();
    for (const id in areas){
      const a = at[id]; if (!a) continue;
      for (const l of areas[id].links){
        const b = at[l.to]; if (!b || l.to < id) continue;
        const ax = a.c * m.s + m.ox + m.s / 2, ay = a.r * m.s + m.oy + m.s / 2;
        const bx = b.c * m.s + m.ox + m.s / 2, by = b.r * m.s + m.oy + m.s / 2;
        ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }

  const rhombus = (x, y, r, rgb, a) => {
    ctx.beginPath();
    ctx.moveTo(x - r, y); ctx.lineTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.closePath();
    ctx.fillStyle = 'rgba(' + Math.round(rgb[0] * 255) + ',' + Math.round(rgb[1] * 255) + ',' + Math.round(rgb[2] * 255) + ',' + a + ')';
    ctx.fill();
  };
  function drawDots(m){
    const ds = dots(), s = m.s, K = ink();
    /* a dot is a marker, not land: two of the plate's cells wide, at the
       plate's proportion, on a ground diamond so it reads over bone */
    const px = pitch() * 2;
    drawLinks(m, ds);
    ctx.font = (9 * DPR) + 'px ' + tok('mono');
    ctx.textBaseline = 'middle';
    const placed = [];
    for (const d of ds){
      const x = d.c * s + m.ox + s / 2, y = d.r * s + m.oy + s / 2;
      /* plates a cell apart share a pixel far out; their names step down
         one line each so both can be read */
      let stack = 0;
      for (const q of placed) if (Math.abs(q.x - x) < 14 * DPR && Math.abs(q.y - y) < 14 * DPR) stack++;
      placed.push({x, y});
      ctx.globalAlpha = 1;
      rhombus(x, y, px * 0.75 * 1.4, K.ground, 1);
      rhombus(x, y, px * 0.75, d.here ? K.flare : K.gold, 1);
      const on = hoverDot === d.id;
      ctx.fillStyle = on || d.here ? tok('bone') : tok('dim');
      ctx.fillText(d.name.toUpperCase(), x + px * .8, y + stack * 11 * DPR);
      d.x = x; d.y = y;
    }
    return ds;
  }
  let lastDots = [];
  function dotUnder(x, y){
    const R = 9 * DPR; let best = null, bd = R * R;
    for (const d of lastDots){
      const dx = d.x - x, dy = d.y - y, q = dx * dx + dy * dy;
      if (q < bd){ bd = q; best = d; }
    }
    return best;
  }

  /* ── the frame ──────────────────────────────────────────────────────── */
  function resize(){
    if (!stage) return;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, Math.round(stage.clientWidth * DPR));
    H = Math.max(1, Math.round(stage.clientHeight * DPR));
    cv.width = W; cv.height = H;
    base = lit = from = null; dirty = true;
  }
  function draw(){
    raf = open ? requestAnimationFrame(draw) : 0;
    if (!open || !C) return;
    const now = performance.now();
    const anim = from && now - t0 < DUR;
    if (!dirty && !anim) return;
    const t = from ? Math.min(1, (now - t0) / DUR) : 1;
    liveBox = from ? between(fromBox, targetBox, ease(t)) : targetBox;
    if (!base) base = sheet(scope, targetBox, null);
    if (hover && !lit) lit = sheet(scope, targetBox, hover);
    if (t >= 1) from = null;
    ctx.clearRect(0, 0, W, H);
    const m = fit(liveBox);
    const blit = (pl, alpha) => {
      ctx.globalAlpha = alpha;
      ctx.drawImage(pl.canvas, pl.box.x0 * m.s + m.ox, pl.box.y0 * m.s + m.oy,
                    (pl.box.x1 - pl.box.x0) * m.s, (pl.box.y1 - pl.box.y0) * m.s);
    };
    const a = from ? ease(t) : 1;
    if (from) blit(from, 1 - a);
    blit(base, a);
    if (lit) blit(lit, a);
    ctx.globalAlpha = 1;
    lastDots = drawDots(m);
    dirty = !!anim;
  }

  /* ── moving between levels ──────────────────────────────────────────── */
  function go(next){
    if (next === scope) return;
    const prev = base, prevBox = liveBox;
    scope = next; hover = null; lit = null;
    targetBox = boxOf(scope, scope.depth === 0 ? .05 : .10);
    base = sheet(scope, targetBox, null);
    from = prev; fromBox = prevBox; t0 = performance.now();
    dirty = true;
    chrome();
  }
  function rehover(h){
    if (h === hover) return;
    mark(hover, false);
    hover = h; lit = null; dirty = true;
    mark(h, true);
  }
  function mark(k, on){ const r = k && rowFor.get(k); if (r) r.classList.toggle('on', on); }
  function trail(){ const t = []; for (let s = scope; s; s = C.parentOf(s)) t.unshift(s); return t; }
  /* the scope a plate falls in at a given depth, for the list and the drill */
  function scopeAt(d, depth){
    const hit = C.at(C.lonOf(d.c), C.latOf(d.r)); if (!hit) return null;
    return depth === 1 ? hit.state : depth === 2 ? hit.region : depth === 3 ? hit.sub : C.country;
  }
  function nextFrom(hit, i){
    const d = C.holds(scope, i) ? Math.min(3, scope.depth + 1) : scope.depth;
    return d === 1 ? hit.state : d === 2 ? hit.region : d === 3 ? hit.sub : null;
  }

  /* ── chrome ─────────────────────────────────────────────────────────── */
  const $ = sel => el.querySelector(sel);
  const num = n => n.toLocaleString('en-AU');
  const km2 = a => a >= 1e6 ? (a / 1e6).toFixed(2) + 'M km²'
                : a >= 1e3 ? Math.round(a / 1e3) + 'K km²' : Math.round(a) + ' km²';
  function chrome(){
    const nav = $('#tcrumb'); nav.innerHTML = '';
    trail().forEach((p, i) => {
      if (i){ const s = document.createElement('span'); s.textContent = '›'; nav.append(s); }
      const b = document.createElement('button');
      b.textContent = p.name;
      if (p === scope) b.className = 'here'; else b.onclick = () => go(p);
      nav.append(b);
    });
    const here = dots().filter(d => within(scope, d)).length;
    $('#ttally').innerHTML = '<b>' + num(here) + '</b> ' + (here === 1 ? 'town' : 'towns') +
      ' · <b>' + num(scope.cells) + '</b> cells · <b>' + km2(scope.area) + '</b>';
    const cur = Atlas.name();
    $('#tpin').textContent = pinning ? 'click the land to pin ' + cur : 'pin ' + cur + ' here';
    $('#tpin').classList.toggle('sel', pinning);
    list();
  }
  function list(){
    const box = $('#tlist'); box.innerHTML = ''; rowFor.clear();
    const head = (t, n) => {
      const h = document.createElement('div'); h.className = 'thead';
      h.innerHTML = '<span></span><b></b>';
      h.children[0].textContent = t; h.children[1].textContent = n;
      box.append(h);
    };
    /* the towns in this scope first — they are what the page is for */
    const ds = dots().filter(d => within(scope, d));
    head('Towns', ds.length ? num(ds.length) : '—');
    for (const d of ds){
      const row = document.createElement('div');
      row.className = 'trow' + (d.here ? ' here' : '');
      const sub = scopeAt(d, 3);
      row.innerHTML = '<div class="nm"></div><div class="qt"></div>';
      row.children[0].textContent = d.name;
      row.children[1].textContent = sub ? sub.name : '';
      row.onmouseenter = () => { hoverDot = d.id; dirty = true; };
      row.onmouseleave = () => { hoverDot = null; dirty = true; };
      row.onclick = () => stand(d.id);
      box.append(row);
    }
    const un = unplaced();
    if (un.length){
      head('Unplaced', num(un.length));
      for (const id of un){
        const row = document.createElement('div');
        row.className = 'trow' + (id === Atlas.current() ? ' here' : '');
        row.innerHTML = '<div class="nm"></div><div class="qt">no anchor</div>';
        row.children[0].textContent = Atlas.areas()[id].name;
        row.onclick = () => stand(id);
        box.append(row);
      }
      box.append(chips());
    }
    const kids = C.childrenOf(scope);
    if (!kids.length){ box.append(facts(scope)); return; }
    head(['States & Territories', 'Regions', 'Districts'][scope.depth], num(kids.length));
    const top = Math.max(...kids.map(k => k.cells)) || 1;
    const all = dots();
    for (const k of kids){
      const n = all.filter(d => C.holds(k, d.i)).length;
      const row = document.createElement('div');
      row.className = 'trow' + (hover === k ? ' on' : '') + (n ? ' has' : '');
      row.innerHTML = '<div class="nm"></div><div class="qt"></div><div class="bar"><i style="width:' +
                      (k.cells / top * 100).toFixed(1) + '%"></i></div>';
      row.children[0].textContent = k.name;
      row.children[1].textContent = n ? n + (n === 1 ? ' town' : ' towns') : num(k.cells);
      row.onmouseenter = () => rehover(k);
      row.onmouseleave = () => rehover(null);
      row.onclick = () => go(k);
      rowFor.set(k, row);
      box.append(row);
    }
  }
  /* the atlas's own picture — plates laid out by which way each road went
     — kept beneath the list while any plate is off the map, because a
     plate with no anchor still joins somewhere and this is the only
     picture that can show where. Placed plates are bone, unplaced dim. */
  function chips(){
    const pos = Atlas.layout(), areas = Atlas.areas();
    const CW = 72, CH = 40;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const id in pos){ x0 = Math.min(x0, pos[id][0]); y0 = Math.min(y0, pos[id][1]); x1 = Math.max(x1, pos[id][0]); y1 = Math.max(y1, pos[id][1]); }
    const wrap = document.createElement('div'); wrap.className = 'tchips';
    const map = document.createElement('div'); map.className = 'amap';
    map.style.width = ((x1 - x0 + 1) * CW) + 'px'; map.style.height = ((y1 - y0 + 1) * CH) + 'px';
    for (const id in pos){
      const [x, y] = pos[id], a = areas[id];
      for (const l of a.links){
        const q = pos[l.to]; if (!q) continue;
        const j = document.createElement('i');
        if (q[1] === y + 1 && q[0] === x){ j.className = 'ajoin v'; j.style.left = ((x - x0) * CW + CW / 2 - 1) + 'px'; j.style.top = ((y - y0) * CH + CH - 8) + 'px'; map.append(j); }
        if (q[0] === x + 1 && q[1] === y){ j.className = 'ajoin h'; j.style.left = ((x - x0) * CW + CW - 8) + 'px'; j.style.top = ((y - y0) * CH + CH / 2 - 1) + 'px'; map.append(j); }
      }
      const c = document.createElement('div');
      c.className = 'achip' + (id === Atlas.current() ? ' sel' : '') + (Atlas.geo(id) ? '' : ' off');
      c.style.left = ((x - x0) * CW + 6) + 'px'; c.style.top = ((y - y0) * CH + 6) + 'px';
      c.textContent = a.name;
      c.onclick = () => stand(id);
      map.append(c);
    }
    wrap.append(map);
    return wrap;
  }
  function facts(r){
    const box = document.createElement('div');
    const ll = (lat, lon) => Math.abs(lat).toFixed(1) + '°' + (lat < 0 ? 'S' : 'N') + ' ' +
                             Math.abs(lon).toFixed(1) + '°' + (lon < 0 ? 'W' : 'E');
    const reg = C.regions[r.region - 1];
    const rows = [['Region', reg.name], ['Part of', reg.part || '—'],
      ['State', C.states[reg.state - 1].name], ['Cells', num(r.cells)], ['Area', km2(r.area)],
      ['Extent', ll(C.latOf(r.r0), C.lonOf(r.c0)) + ' → ' + ll(C.latOf(r.r1), C.lonOf(r.c1))]];
    for (const [k, v] of rows){
      const f = document.createElement('div'); f.className = 'tfact';
      f.innerHTML = '<span></span><span></span>';
      f.children[0].textContent = k; f.children[1].textContent = v;
      box.append(f);
    }
    if (r.clipped){
      const c = document.createElement('div'); c.className = 'tnote warn';
      c.textContent = 'Part of this district lies outside the map window.';
      box.append(c);
    }
    return box;
  }

  /* ── standing on a plate, pinning one ───────────────────────────────── */
  function stand(id){
    if (id === Atlas.current()){ close(); return; }
    if (Atlas.go(id, null)) close();
    else note('cannot change plate from inside a building');
  }
  function pin(c, r){
    Atlas.setGeo(null, C.latOf(r), C.lonOf(c));
    pinning = false; dirty = true;
    note(Atlas.name() + ' pinned');
    chrome();
  }

  /* ── pointer ────────────────────────────────────────────────────────── */
  function cellUnder(ev){
    const b = cv.getBoundingClientRect(), m = fit(liveBox);
    const x = (ev.clientX - b.left) * DPR, y = (ev.clientY - b.top) * DPR;
    const c = Math.floor((x - m.ox) / m.s), r = Math.floor((y - m.oy) / m.s);
    const ok = c >= 0 && r >= 0 && c < C.cols && r < C.rows;
    return {x, y, c, r, ok, v: ok ? C.grid[r * C.cols + c] : 0};
  }
  let lastCell = -2;
  function move(ev){
    if (!C) return;
    const cell = cellUnder(ev), read = $('#tread');
    const dot = dotUnder(cell.x, cell.y);
    const hd = dot ? dot.id : null;
    if (hd !== hoverDot){ hoverDot = hd; dirty = true; }
    cv.style.cursor = dot || pinning ? 'pointer' : '';
    const at = cell.ok ? cell.r * C.cols + cell.c : -1;
    if (at === lastCell && !dot) return;
    lastCell = at;
    if (dot){ read.innerHTML = '<b></b> · stand here'; read.children[0].textContent = dot.name.toUpperCase(); rehover(null); return; }
    if (!cell.ok){ read.innerHTML = '&nbsp;'; rehover(null); return; }
    const lat = C.latOf(cell.r), lon = C.lonOf(cell.c);
    const where = Math.abs(lat).toFixed(2) + '°' + (lat < 0 ? 'S' : 'N') + ' ' +
                  Math.abs(lon).toFixed(2) + '°' + (lon < 0 ? 'W' : 'E');
    if (!cell.v){ read.innerHTML = where + ' · <i>sea</i>'; rehover(null); return; }
    const hit = C.at(lon, lat);
    read.innerHTML = where + ' · <b></b> · <span></span>';
    read.children[0].textContent = hit.sub.name.toUpperCase();
    read.children[1].textContent = hit.region.name.toUpperCase() + ' · ' + hit.state.name.toUpperCase();
    rehover(nextFrom(hit, at));
  }
  function click(ev){
    if (!C) return;
    const cell = cellUnder(ev);
    const dot = dotUnder(cell.x, cell.y);
    if (dot && !pinning){ stand(dot.id); return; }
    if (!cell.ok || !cell.v) return;
    if (pinning){ pin(cell.c, cell.r); return; }
    const next = nextFrom(C.at(C.lonOf(cell.c), C.latOf(cell.r)), cell.r * C.cols + cell.c);
    if (next) go(next);
  }

  /* ── the page ───────────────────────────────────────────────────────── */
  function build(){
    el = document.createElement('div');
    el.id = 'towns'; el.className = 'glass'; el.hidden = true;
    el.innerHTML =
      '<div class="phead"><span class="plabel">The towns</span><nav id="tcrumb"></nav>' +
      '<span class="tally" id="ttally"></span><span class="btn" id="tclose">✕</span></div>' +
      '<div id="tmid"><div id="tstage"><canvas id="tmap"></canvas></div>' +
      '<div id="taside"><div id="tlist"></div><div class="btn" id="tpin"></div></div></div>' +
      '<div id="tfoot"><span id="tread">&nbsp;</span>' +
      '<span class="knote">click a town to stand on it · click the land to open it · esc up, then out</span></div>';
    document.body.appendChild(el);
    stage = $('#tstage'); cv = $('#tmap'); ctx = cv.getContext('2d');
    $('#tclose').onclick = close;
    $('#tpin').onclick = () => { pinning = !pinning; chrome(); };
    cv.addEventListener('mousemove', move);
    cv.addEventListener('mouseleave', () => { lastCell = -2; hoverDot = null; dirty = true; $('#tread').innerHTML = '&nbsp;'; rehover(null); });
    cv.addEventListener('click', click);
    addEventListener('resize', () => { if (open) resize(); });
  }

  function openPage(){
    if (open) return true;
    if (typeof Interior !== 'undefined' && Interior.inside()){ note('the towns are outside — leave the building first'); return false; }
    if (!el) build();
    open = true; pinning = false;
    el.hidden = false;
    document.body.classList.add('towns');
    if (!C){
      $('#tlist').innerHTML = '<div class="tnote">reading the country…</div>';
      Country.load().then(c => {
        C = c;
        if (!open) return;
        scope = C.country; targetBox = liveBox = boxOf(scope, .05);
        /* the plate you stand on is the place to start, if it is on the map */
        const here = dots().find(d => d.here);
        if (here) scope = scopeAt(here, 2) || C.country, targetBox = liveBox = boxOf(scope, .10);
        resize(); chrome();
      }).catch(e => { note('the towns map could not load: ' + e.message); close(); });
    } else {
      resize(); chrome();
    }
    if (!raf) raf = requestAnimationFrame(draw);
    return true;
  }
  function close(){
    if (!open) return false;
    open = false; pinning = false; hover = null; hoverDot = null;
    el.hidden = true;
    document.body.classList.remove('towns');
    return true;
  }
  /* Esc: a pin being aimed is dropped first; then up a level; then out */
  function back(){
    if (!open) return false;
    if (pinning){ pinning = false; chrome(); return true; }
    if (C){ const p = trail(); if (p.length > 1){ go(p[p.length - 2]); return true; } }
    return close();
  }
  const toggle = () => open ? close() : openPage();

  function init(){
    if (typeof Hud !== 'undefined') Hud.onTowns = toggle;
  }

  return {init, open: openPage, close, back, toggle, opened: () => open,
          go: id => { if (C) go(id); }, scope: () => scope};
})();
