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

   Cells are typeset, not filled: U+25C6 and U+25C7 in the chrome's own
   monospace, so a diamond here is the same diamond the overlay this was
   cut from draws its earth with. It is a page of chrome, not the plate —
   the plate's diamonds are the GL stream, and this never reaches it.

   Nothing is drawn per frame that can be drawn once. A `sheet` is an
   offscreen canvas holding one whole rendering, tagged with the slice of
   the grid it covers; a frame is sheets blitted with a transform. That is
   what makes the drill animate — the old sheet and the new one are
   cross-faded while the viewport eases between their bounds, and neither
   is re-typeset while it moves. The dots are few and drawn last, every
   frame, over the top.                                                    */

const Towns = (() => {
  const FILL = '◆', EDGE = '◇';
  const MAX_PITCH = 22;                     // CSS px a cell may reach; past it a district is a chart
  const MIN_PITCH = 2.6;                    // CSS px below which the field is strided
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

  /* ── glyph sprites ──────────────────────────────────────────────────── */
  const sprites = new Map();
  const tok = n => getComputedStyle(document.documentElement).getPropertyValue('--' + n).trim();
  function sprite(ch, px, alpha, colour){
    const size = Math.max(1, Math.round(px * 20) / 20);
    const a = Math.max(.04, Math.min(1, Math.round(alpha * 50) / 50));
    const key = ch + '|' + size + '|' + a + '|' + colour;
    let s = sprites.get(key);
    if (s) return s;
    if (sprites.size > 400) sprites.clear();
    const em = size * 1.18, n = Math.ceil(em * 1.7) + 2;
    s = document.createElement('canvas');
    s.width = s.height = n;
    const c = s.getContext('2d');
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = em.toFixed(2) + 'px ' + tok('mono');
    c.fillStyle = colour; c.globalAlpha = a;
    c.fillText(ch, n / 2, n / 2);
    sprites.set(key, s);
    return s;
  }

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
     Three roles and no more: the thing being spoken about, the thing it
     sits inside, and everything else. Land is bone; aqua is spent only on
     the divisions, graded so the outline of where you stand is loudest,
     then what you can open, then what is beside you; flare is what is
     under the cursor and nothing else. A diamond covers a quarter of its
     cell at any size, so a cell at alpha a reads as a/4 of the colour, and
     the field is walked with a stride below MIN_PITCH with the diamond
     grown to the stride — same tone, a ninth of the work at country level.
     Boundaries are never strided: a dotted state line is not a line. */
  function sheet(sc, box, only){
    const p = document.createElement('canvas');
    p.width = W; p.height = H;
    const c = p.getContext('2d');
    const {s, ox, oy} = fit(box);
    const g = C.grid, ed = C.edge, rg = C.regionOf, st = C.stateOf;
    const cols = C.cols, rows = C.rows, d = sc.depth;
    const k = Math.max(1, Math.ceil(MIN_PITCH * DPR / s));
    const gs = s * k;
    const align = v => v + ((k - (v % k)) % k);
    const c0 = Math.max(0, Math.floor(-ox / s)), c1 = Math.min(cols - 1, Math.ceil((W - ox) / s));
    const r0 = Math.max(0, Math.floor(-oy / s)), r1 = Math.min(rows - 1, Math.ceil((H - oy) / s));
    const put = (sp, i, half) => c.drawImage(sp, (i % cols) * s + ox + s / 2 - half,
                                                 ((i / cols) | 0) * s + oy + s / 2 - half);
    const bone = tok('bone'), aqua = tok('aqua'), flare = tok('flare');
    const holds = C.holds;
    const out = {canvas: p, box: {x0: -ox / s, y0: -oy / s, x1: (W - ox) / s, y1: (H - oy) / s}};

    if (only){
      const sp = sprite(FILL, gs, 1, flare), half = sp.width / 2;
      const lo = Math.max(r0, only.r0), hi = Math.min(r1, only.r1);
      const lc = Math.max(c0, only.c0), hc = Math.min(c1, only.c1);
      for (let r = align(lo); r <= hi; r += k)
        for (let cc = align(lc); cc <= hc; cc += k){
          const i = r * cols + cc;
          if (g[i] && holds(only, i)) put(sp, i, half);
        }
      return out;
    }

    const parent = d >= 2 ? C.parentOf(sc) : null;
    const spMid = parent ? sprite(FILL, gs, d === 2 ? .22 : .26, bone) : null;
    const spIn = sprite(FILL, gs, [.62, .46, .52, .85][d], bone);
    const half = spIn.width / 2;

    /* the land beyond what you are looking at, so the subject is not a
       shape floating in nothing: a ninth of the alpha, walked coarser —
       never more than double the fine stride, never coarser than about
       seven pixels, or it stops reading as the same material */
    if (d > 0){
      const kf = Math.max(k, Math.min(2 * k, Math.round(7 * DPR / s) || 1));
      const gf = s * kf, alignF = v => v + ((kf - (v % kf)) % kf);
      const sp = sprite(FILL, gf, .09, bone), h = sp.width / 2;
      const outer = parent || sc;
      for (let r = alignF(r0); r <= r1; r += kf)
        for (let cc = alignF(c0); cc <= c1; cc += kf){
          const i = r * cols + cc;
          if (g[i] && !holds(outer, i)) put(sp, i, h);
        }
    }
    for (let r = align(r0); r <= r1; r += k)
      for (let cc = align(c0); cc <= c1; cc += k){
        const i = r * cols + cc;
        if (!g[i]) continue;
        if (holds(sc, i)) put(spIn, i, half);
        else if (parent && holds(parent, i)) put(spMid, i, half);
      }

    /* a hollow ◇ has no ink to be hollow with under nine pixels, so a
       boundary cell stays solid and aqua carries the line */
    const es = s * Math.min(k, 2), eg = es < 9 * DPR ? FILL : EDGE;
    const eLoud = sprite(eg, es, .95, aqua), eMid = sprite(eg, es, .55, aqua);
    const eSoft = sprite(eg, es, d === 1 ? .40 : .26, aqua), eFaint = sprite(eg, es, .18, aqua);
    const eHalf = eLoud.width / 2;
    /* a boundary is stored on one side of itself, so half a scope's rim
       is written on its neighbours' cells */
    const own = d === 3 ? g : rg;
    const rim = i => own[i] === sc.id || ((i % cols) + 1 < cols && own[i + 1] === sc.id) ||
                     (i + cols < own.length && own[i + cols] === sc.id);
    for (const i of C.edgeList){
      const cc = i % cols; if (cc < c0 || cc > c1) continue;
      const rr = (i / cols) | 0; if (rr < r0 || rr > r1) continue;
      const e = ed[i];
      let sp = null;
      if (d === 0) sp = (e & 4) ? eLoud : null;
      else if (d === 1) sp = st[i] === sc.id ? ((e & 2) ? eLoud : null) : ((e & 4) ? eSoft : null);
      else if (d === 2){
        if ((e & 2) && rim(i)) sp = eLoud;
        else if (rg[i] === sc.id) sp = (e & 1) ? eMid : null;
        else if (st[i] === sc.state) sp = (e & 2) ? eSoft : null;
        else sp = (e & 4) ? eFaint : null;
      } else {
        if ((e & 1) && rim(i)) sp = eLoud;
        else if (rg[i] === sc.region) sp = (e & 1) ? eSoft : null;
        else sp = (e & 2) ? eFaint : null;
      }
      if (sp) put(sp, i, eHalf);
    }
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

  function drawDots(m){
    const ds = dots(), s = m.s;
    const px = Math.max(10 * DPR, s * 1.6);
    const gold = tok('gold'), flare = tok('flare'), ground = tok('ground');
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
      const sp = sprite(FILL, px, 1, d.here ? flare : gold);
      /* a ground diamond under it, so the dot is read against the plate
         and not lost in the bone of the land */
      const under = sprite(FILL, px * 1.5, 1, ground);
      ctx.globalAlpha = 1;
      ctx.drawImage(under, x - under.width / 2, y - under.height / 2);
      ctx.drawImage(sp, x - sp.width / 2, y - sp.height / 2);
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
