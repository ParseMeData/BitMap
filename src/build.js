'use strict';
/* ── build mode ─────────────────────────────────────────────────────────
   Drag a kind out of the palette and it lands on the map as a shape that
   generates that terrain. Shapes stay live: move them, resize them, change
   what shape they are, and everything downstream — the instance buffer and
   the walk grid the game reads — is restamped from them.

   Work is organised in layers, the way a city plan is: ground, trees,
   roads, buildings. Only the active layer takes the pointer, so dragging a
   lawn can never pick up the road running across it, and layers draw in
   that order, so roads sit over grass and buildings over roads.

   Shapes snap to the lattice grid. Sub-cell positions would make the
   pattern shimmer under your hand, because a cell's look is addressed by
   where it sits inside its shape (see kinds.js). */

const Build = (() => {
  let on = false, sel = null, drag = null, armed = null, nextId = 1;
  let layer = 'roads', combined = null, lastKind = null;
  const vis = {};
  const seeVis = () => { for (const L of Kinds.layers) if (vis[L.id] === undefined) vis[L.id] = true; };
  seeVis();

  /* Which shapes are being edited is one string. Outdoors it is the town;
     inside a building it is that building's floor plan, and nothing else in
     here changes — see interior.js. */
  let KEY = 'hq.shapes';
  /* what a newly placed shape inherits. The sliders write here when nothing
     is selected, so you can dial in a look and then keep placing it. */
  const defs = {feather: 4, bright: 1, mask: false, variant: {},
                grain: 1, scale: 1, jitter: 0, scatter: 0,
                pad: 0, padFade: 0.8, padBreak: 0.3};
  const cellSize = () => (G.A ? G.A.cell : 8);
  /* Everything lands on the walk grid — the same tiles the walker steps
     between — and that grid is a whole number of lattice cells, so snapping
     to it snaps to the weave as well. */
  const grid = () => (G.terr ? G.terr.tsz : cellSize() * 4);
  const snapC = v => (Math.round(v / grid() - 0.5) + 0.5) * grid();   // onto tile centres
  const snapD = v => Math.round(v / grid()) * grid();                 // a whole-tile step
  const snapS = v => Math.max(grid(), Math.round(v / grid()) * grid());
  const WMAX = 5;                     // cells: past this a road stops being a line
  const snapW = v => {
    const c = cellSize();
    return Math.min(WMAX * c, Math.max(c, Math.round(v / c) * c));
  };
  /* A roundabout is a junction, not a ring road. The smallest one that used
     to be reachable — a tile across — is now the largest, and the default is
     the smallest there is. */
  const RMAX = 4;                     // cells, i.e. one walk tile
  const snapR = v => {
    const c = cellSize();
    return Math.min(RMAX * c, Math.max(c, Math.round(v / c) * c));
  };
  const snap = snapC;
  const MAXSPAN = () => grid() * 60;
  const layerOf = s => (Kinds.by[s.kind] || {layer: 'ground'}).layer;
  const layerIndex = id => Kinds.layers.findIndex(L => L.id === id);
  const zOf = s => (Kinds.layers.find(L => L.id === layerOf(s)) || {z: 0}).z;
  const editable = s => layerOf(s) === layer && vis[layerOf(s)];

  /* ── model ── */
  function defaults(s, type){
    const g = grid(), C0 = Kinds.geo.centre(s);
    const span = Math.max(Kinds.geo.span(s) || g * 6, g * 2);
    s.type = type;
    if (type === 'line'){
      s.pts = [[snapC(C0[0] - span / 2), snapC(C0[1])], [snapC(C0[0] + span / 2), snapC(C0[1])]];
      s.width = snapW(s.width || g * 0.5);
    } else if (type === 'ring'){
      s.x = snapC(C0[0]); s.y = snapC(C0[1]);
      s.r = snapR(cellSize());                // as small as it goes
      s.width = snapW(s.width || cellSize() * 2);
    } else {
      s.x = snapC(C0[0]); s.y = snapC(C0[1]);
      s.w = snapS(span);
      s.h = snapS(span * 0.78);
    }
    return s;
  }

  function create(kind, type, wx, wy){
    const k = Kinds.by[kind];
    if (!k) return null;
    const c = cellSize();
    const area = type !== 'line' && type !== 'ring';
    const g = grid();
    const s = {id: nextId++, kind, type, seed: (Math.random() * 1e6) | 0, rot: 0,
               x: snapC(wx), y: snapC(wy), w: snapS(g * 6), h: snapS(g * 5),
               r: snapR(cellSize()), width: snapW(cellSize() * 2),
               pts: [[snapC(wx), snapC(wy)]],
               feather: k.feather0 !== undefined ? k.feather0 : (area ? defs.feather : 0),
               bright: defs.bright * (k.bright0 || 1),
               grain: defs.grain, scale: defs.scale,
               jitter: defs.jitter, scatter: defs.scatter,
               pad: k.pad0 !== undefined ? k.pad0 : defs.pad,
               padFade: k.padFade0 !== undefined ? k.padFade0 : defs.padFade,
               padBreak: k.padBreak0 !== undefined ? k.padBreak0 : defs.padBreak,
               mask: defs.mask,
               variant: defs.variant[kind] || (k.variants ? k.variants[0] : 'mixed')};
    defaults(s, type);
    born(s, k, type, wx, wy);
    G.shapes.push(s);
    sel = s;
    layer = k.layer;
    changed(s);
    return s;
  }
  /* A kind can say how big one of it is. A district is born big because a
     district is a field of housing; a bed is born the size of a bed. */
  function born(s, k, type, wx, wy){
    const g = grid();
    if (type === 'line'){
      const d = g * (k.len0 ? k.len0 / 2 : 5);
      s.pts = [[snapC(wx - d), snapC(wy)], [snapC(wx + d), snapC(wy)]];
    } else {
      s.x = snapC(wx); s.y = snapC(wy);
      if (k.w0){ s.w = snapS(g * k.w0); s.h = snapS(g * (k.h0 || k.w0)); }
    }
  }

  function remove(s){
    const i = G.shapes.indexOf(s);
    if (i < 0) return;
    G.shapes.splice(i, 1);
    if (sel === s) sel = null;
    changed();
  }

  function moveBy(s, dx, dy){
    if (s.type === 'line'){
      for (const p of s.pts){ p[0] += dx; p[1] += dy; }
      if (s.ctrl) for (const c of s.ctrl) if (c){ c[0] += dx; c[1] += dy; }
    } else { s.x += dx; s.y += dy; }
  }

  /* What the one width slider means. A route and a ring are bands, and so is
     a room drawn with a hollow kind — for that the slider is the wall
     thickness, and the size is left to the grips and [ ], because a room
     needs both and a district only ever needed one. */
  const banded = s => s.type === 'line' || s.type === 'ring' || Kinds.hollow(s);

  /* [ and ] mean thickness on a route and size on an area */
  function scaleSel(f){
    if (!sel) return;
    const g = grid();
    if (sel.type === 'line' || sel.type === 'ring')
      sel.width = snapW(sel.width * f);
    else {
      sel.w = clamp(snapS(sel.w * f), g, MAXSPAN());
      sel.h = clamp(snapS(sel.h * f), g, MAXSPAN());
    }
    changed(sel);
  }
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);

  function retype(type){
    if (!sel || sel.type === type) return;
    if (!(Kinds.by[sel.kind].types || []).includes(type)) return;
    defaults(sel, type);
    changed(sel);
    syncUI();
  }

  /* a shape changed: only its own instances need regenerating */
  function changed(s){
    if (s){
      s._flat = null;                       // the curve may have moved
      const nb = reachBox(s), ob = s._bb || nb;
      s._buf = null;
      /* whatever this shape used to cover has to come back, and whatever it
         covers now has to go — so both footprints are invalidated */
      for (const t of G.shapes){
        if (t === s || !t._buf) continue;
        const tb = t._bb || reachBox(t);
        if (bbHit(tb, nb) || bbHit(tb, ob)) t._buf = null;
      }
    } else for (const x of G.shapes){ x._buf = null; x._flat = null; }
    rebuild();
    if (typeof restampTerrain === 'function') restampTerrain();
    save();
    syncUI();
  }

  /* ── instances, in layer order so the plan stacks correctly ── */
  const bbHit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  /* a shape's reach: its own extent plus the margin it clears, plus the
     band that margin fades and wobbles over */
  function reachBox(s){
    const b = Kinds.geo.bbox(s);
    const p = ((s.pad || 0) + (s.padBreak || 0)) * cellSize();
    return p ? [b[0] - p, b[1] - p, b[2] + p, b[3] + p] : b;
  }

  /* Roads run into one another. Nothing that connects ever clears anything
     else that connects, so a crossroads is a crossroads and not two roads
     with a hole punched where they meet. */
  function connects(a, b){
    const ka = Kinds.by[a.kind], kb = Kinds.by[b.kind];
    return !!(ka && kb && ka.connects && kb.connects);
  }

  function rebuild(){
    if (!R || R.lost || !G.A) return;
    const order = G.shapes.filter(s => vis[layerOf(s)])
      .sort((a, b) => zOf(a) - zOf(b) || a.id - b.id);
    const box = order.map(s => reachBox(s));
    let n = 0;
    for (let i = 0; i < order.length; i++){
      const s = order[i];
      if (!s._buf){
        /* everything drawn after this one takes the ground from it */
        const occ = [];
        for (let j = i + 1; j < order.length; j++)
          if (bbHit(box[i], box[j]) && !connects(s, order[j])) occ.push(order[j]);
        s._buf = Kinds.build(s, cellSize(), occ);
      }
      s._bb = box[i];
      n += s._buf.length;
    }
    if (!combined || combined.length < n) combined = new Float32Array(Math.max(n, 8192));
    let o = 0;
    for (const s of order){ combined.set(s._buf, o); o += s._buf.length; }
    R.batch('build', combined.subarray(0, n), R.gl.STATIC_DRAW);
  }

  /* ── walk grid ─────────────────────────────────────────────────────────
     Stamped in each kind's own order, not the order you drew things, so
     the rule stays predictable: blockers go down first and routes last.
     Draw a road across a lake and you have built a bridge. */
  function stamp(t){
    const order = [...Kinds.list].sort((a, b) => a.stamp - b.stamp);
    for (const k of order)
      for (const s of G.shapes){
        if (s.kind !== k.id) continue;
        /* A route thinner than a walk tile would stamp a dotted line of
           walkable tiles, so a band stamps by distance with half a tile of
           tolerance. An area-shaped route is already wider than that, and
           the same tolerance on one would lay a walkable ring right through
           the wall around it — so it stamps exactly what it covers. */
        tiles(s, t, i => {
          if (k.walk === 0){ t.walk[i] = 0; t.path[i] = 0; }
          else { t.walk[i] = 1; if (k.walk === 2) t.path[i] = 1; }
        }, k.walk === 2 && banded(s) ? t.tsz * (k.walkTol || 0.62) : 0);
      }
  }
  /* a tile counts as covered if its centre or any of its four shoulders is
     inside — a road thinner than a walk tile still has to be walkable */
  function tiles(s, t, fn, tol){
    const bb = Kinds.geo.bbox(s), z = t.tsz, o = z * 0.32, pad = (tol || 0) + z;
    const x0 = Math.max(0, Math.floor((bb[0] - pad) / z)), x1 = Math.min(t.tw - 1, Math.ceil((bb[2] + pad) / z));
    const y0 = Math.max(0, Math.floor((bb[1] - pad) / z)), y1 = Math.min(t.th - 1, Math.ceil((bb[3] + pad) / z));
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++){
        const cx = (tx + 0.5) * z, cy = (ty + 0.5) * z;
        /* a road narrower than a walk tile would otherwise stamp a dotted
           line of walkable tiles — and a roundabout you cannot get round */
        const hit = tol ? Kinds.geo.depth(s, cx, cy) > -tol
          : (Kinds.geo.inside(s, cx, cy) ||
             Kinds.geo.inside(s, cx - o, cy) || Kinds.geo.inside(s, cx + o, cy) ||
             Kinds.geo.inside(s, cx, cy - o) || Kinds.geo.inside(s, cx, cy + o));
        if (hit) fn(ty * t.tw + tx);
      }
  }

  /* ── selection overlay, drawn as entities so it needs no second shader ── */
  const FLARE = [1, 0.373, 0.635], IDLE = [0.42, 0.42, 0.5];
  const rotpt = (s, lx, ly) => {
    const c = Math.cos(s.rot || 0), sn = Math.sin(s.rot || 0);
    return {x: s.x + lx * c - ly * sn, y: s.y + lx * sn + ly * c};
  };
  const SCALE = ['nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'];
  /* Every grip says what it does: corners scale, edge grips stretch one way,
     and the one standing off the top edge turns the shape. */
  /* where a segment's curve actually passes at the halfway mark: the point
     the bend grip sits on and the point you drag to move it */
  function bendAt(s, i){
    const a = s.pts[i], b = s.pts[i + 1], c = s.ctrl && s.ctrl[i];
    if (!c) return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    return [0.25 * a[0] + 0.5 * c[0] + 0.25 * b[0],
            0.25 * a[1] + 0.5 * c[1] + 0.25 * b[1]];
  }
  function handles(s){
    if (s.type === 'line'){
      const out = s.pts.map((p, i) => ({x: p[0], y: p[1], tag: 'p' + i, kind: 'point'}));
      for (let i = 0; i < s.pts.length - 1; i++){
        const m = bendAt(s, i);
        out.push({x: m[0], y: m[1], tag: 'b' + i, kind: 'bend'});
      }
      return out;
    }
    if (s.type === 'ring') return [{x: s.x + s.r, y: s.y, tag: 'rad', kind: 'corner'}];
    const hw = s.w / 2, hh = s.h / 2, out = [];
    for (const [lx, ly, tag] of [[-hw, -hh, 'nw'], [hw, -hh, 'ne'], [hw, hh, 'se'], [-hw, hh, 'sw']])
      out.push(Object.assign(rotpt(s, lx, ly), {tag, kind: 'corner'}));
    for (const [lx, ly, tag] of [[0, -hh, 'n'], [hw, 0, 'e'], [0, hh, 's'], [-hw, 0, 'w']])
      out.push(Object.assign(rotpt(s, lx, ly), {tag, kind: 'edge'}));
    out.push(Object.assign(rotpt(s, 0, -hh - grid() * 1.4), {tag: 'rot', kind: 'rotate'}));
    return out;
  }
  function overlay(a, m, cap){
    if (!on) return m;
    for (const s of G.shapes){
      if (m > cap - 260) break;
      if (!editable(s) && s !== sel) continue;      // only the layer you are working on
      m = outline(a, m, s, s === sel);
    }
    return m;
  }
  function outline(a, m, s, isSel){
    const px = 1 / G.cam[2];
    const col = isSel ? FLARE : IDLE, al = isSel ? 0.85 : 0.3;
    const r = Math.max(2 * px, cellSize() * 0.15);
    const N = 44;
    const dot = (x, y) => { m = put(a, m, x, y, col[0], col[1], col[2], al, r, 0, 0, 0, 1); };
    const circle = (cx, cy, rad, n) => {
      for (let j = 0; j < n; j++){
        const th = j / n * 6.283185307;
        dot(cx + Math.cos(th) * rad, cy + Math.sin(th) * rad);
      }
    };
    if (s.type === 'line'){
      const F = Kinds.geo.flat(s);
      for (let i = 0; i < F.length - 1; i++){
        const A = F[i], B = F[i + 1];
        const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1;
        const nx = -dy / L * s.width / 2, ny = dx / L * s.width / 2;
        const steps = Math.max(2, Math.round(N / Math.max(1, F.length - 1)));
        for (let j = 0; j <= steps; j++){
          const t = j / steps;
          dot(A[0] + dx * t + nx, A[1] + dy * t + ny);
          dot(A[0] + dx * t - nx, A[1] + dy * t - ny);
        }
      }
    } else if (s.type === 'ring'){
      circle(s.x, s.y, s.r + s.width / 2, N * 2);
      circle(s.x, s.y, Math.max(0, s.r - s.width / 2), N * 2);
    } else if (s.type === 'ellipse'){
      for (let j = 0; j < N * 2; j++){
        const th = j / (N * 2) * 6.283185307;
        dot(s.x + Math.cos(th) * s.w / 2, s.y + Math.sin(th) * s.h / 2);
      }
    } else {
      const x0 = s.x - s.w / 2, x1 = s.x + s.w / 2, y0 = s.y - s.h / 2, y1 = s.y + s.h / 2;
      for (let j = 0; j <= N; j++){
        const t = j / N;
        dot(x0 + (x1 - x0) * t, y0); dot(x0 + (x1 - x0) * t, y1);
        dot(x0, y0 + (y1 - y0) * t); dot(x1, y0 + (y1 - y0) * t);
      }
    }
    if (isSel){
      const GOLD = [1, 0.76, 0.31], BONE = [0.93, 0.92, 0.89];
      const big = Math.max(7 * px, grid() * 0.3);
      for (const h of handles(s)){
        if (h.kind === 'rotate'){
          /* a stalk, so the turn grip reads as attached rather than floating */
          const top = rotpt(s, 0, -s.h / 2);
          for (let i = 1; i <= 4; i++)
            m = put(a, m, top.x + (h.x - top.x) * i / 5, top.y + (h.y - top.y) * i / 5,
                    GOLD[0], GOLD[1], GOLD[2], 0.45,
                    Math.max(1.6 * px, grid() * 0.06), 0, 0, 0, 1);
          m = put(a, m, h.x, h.y, GOLD[0], GOLD[1], GOLD[2], 1, big * 1.2, 1, 0, 0, 1);
        } else if (h.kind === 'bend'){
          const AQUA = [0.47, 0.88, 0.85];
          m = put(a, m, h.x, h.y, AQUA[0], AQUA[1], AQUA[2], 0.95, big * 0.85, 1, 0, 0, 1);
        } else if (h.kind === 'edge'){
          m = put(a, m, h.x, h.y, BONE[0], BONE[1], BONE[2], 0.95, big * 0.7, 0, 0, 0, 1);
        } else {
          m = put(a, m, h.x, h.y, FLARE[0], FLARE[1], FLARE[2], 1, big, 0, 0, 0, 1);
        }
      }
    }
    return m;
  }

  /* ── pointer ── */
  function toWorld(ev){
    const b = canvas.getBoundingClientRect();
    const k = VW / Math.max(1, b.width);
    return [((ev.clientX - b.left) * k - VW / 2) / G.cam[2] + G.cam[0],
            ((ev.clientY - b.top) * k - VH / 2) / G.cam[2] + G.cam[1]];
  }
  /* a road two cells wide is a handful of screen pixels: every pointer
     test gets the same screen-space margin so thin shapes stay grabbable */
  const GRAB = () => 10 / G.cam[2];
  const near = (s, p, tol) => Kinds.geo.depth(s, p[0], p[1]) > -tol;

  /* shift-click a selected road to put a bend in it */
  function addPoint(s, p){
    let best = 1, bd = Infinity;
    for (let i = 0; i < s.pts.length - 1; i++){
      const a = s.pts[i], b = s.pts[i + 1];
      const d = Math.hypot((a[0] + b[0]) / 2 - p[0], (a[1] + b[1]) / 2 - p[1]);
      if (d < bd){ bd = d; best = i + 1; }
    }
    s.pts.splice(best, 0, [snapC(p[0]), snapC(p[1])]);
    /* the split segment gives up its bend: two straight halves, which you can
       then bow independently */
    if (s.ctrl) s.ctrl.splice(best - 1, 1, null, null);
    changed(s);
  }

  function wire(){
    canvas.addEventListener('pointerdown', e => {
      if (!on || e.button !== 0 || armed) return;
      /* handles are small things to hit at low zoom; give them a target a
         pointer can actually land on */
      const p = toWorld(e), hr = 20 / G.cam[2];
      /* A marker is pinned to a spot, not to a layer, so it answers the
         pointer wherever it sits and whatever you are working on. */
      if (Markers.armed()){ Markers.place(p[0], p[1]); Markers.disarm(); syncUI(); return; }
      const mk = Markers.hit(p[0], p[1], GRAB() * 1.5);
      if (mk){
        Markers.select(mk); sel = null;
        drag = {mode: 'marker', mk};
        canvas.setPointerCapture(e.pointerId);
        syncUI(); return;
      }
      Markers.select(null);
      if (sel && editable(sel)){
        if (e.shiftKey && sel.type === 'line' && near(sel, p, GRAB())){
          addPoint(sel, p); return;
        }
        for (const h of handles(sel))
          if (Math.hypot(h.x - p[0], h.y - p[1]) < hr){
            drag = {mode: h.tag, s: sel, ox: p[0], oy: p[1]};
            canvas.setPointerCapture(e.pointerId);
            return;
          }
      }
      let hit = null;
      for (let i = G.shapes.length - 1; i >= 0; i--){
        const s = G.shapes[i];
        if (editable(s) && near(s, p, GRAB())){ hit = s; break; }
      }
      sel = hit;
      if (hit){
        lastKind = hit.kind;
        drag = {mode: 'move', s: hit, ox: p[0], oy: p[1]};
        canvas.setPointerCapture(e.pointerId);
      }
      syncUI();
    });

    addEventListener('pointermove', e => {
      if (!drag) return;
      const p = toWorld(e), s = drag.s, c = cellSize();
      if (drag.mode === 'marker'){ Markers.moveTo(drag.mk, p[0], p[1]); return; }
      if (drag.mode === 'move'){
        const dx = snapD(p[0] - drag.ox), dy = snapD(p[1] - drag.oy);
        if (!dx && !dy) return;
        moveBy(s, dx, dy);
        drag.ox += dx; drag.oy += dy;
      } else if (drag.mode === 'rot'){
        /* free rotation, held to 15° so a district still lines up with
           something. The pattern turns with the shape; with Mask on, the
           shape turns over a pattern that stays where it is. */
        const step = Math.PI / 12;
        s.rot = Math.round((Math.atan2(p[1] - s.y, p[0] - s.x) + Math.PI / 2) / step) * step;
      } else if (drag.mode === 'rad'){
        s.r = snapR(Math.hypot(p[0] - s.x, p[1] - s.y));
      } else if (SCALE.indexOf(drag.mode) >= 0){
        const l = Kinds.geo.local(s, p[0], p[1]);
        if (drag.mode !== 'n' && drag.mode !== 's')
          s.w = clamp(snapS(Math.abs(l[0]) * 2), grid(), MAXSPAN());
        if (drag.mode !== 'e' && drag.mode !== 'w')
          s.h = clamp(snapS(Math.abs(l[1]) * 2), grid(), MAXSPAN());
      } else if (drag.mode.charAt(0) === 'b'){
        /* Figma's bend: you drag the point the curve passes through, and the
           control point is worked back out from it. Drag it near the straight
           midpoint and the segment snaps back to straight. */
        const i = +drag.mode.slice(1);
        const a = s.pts[i], b = s.pts[i + 1];
        const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const M = [snapC(p[0]), snapC(p[1])];
        if (!s.ctrl) s.ctrl = s.pts.slice(0, -1).map(() => null);
        s.ctrl[i] = Math.hypot(M[0] - mid[0], M[1] - mid[1]) < grid() * 0.7
          ? null
          : [2 * M[0] - mid[0], 2 * M[1] - mid[1]];
      } else {
        s.pts[+drag.mode.slice(1)] = [snapC(p[0]), snapC(p[1])];
      }
      changed(s);
    });

    addEventListener('pointerup', e => {
      if (drag){ drag = null; return; }
      if (!armed) return;
      const a = armed;
      armed = null;
      document.body.classList.remove('arming');
      const over = document.elementFromPoint(e.clientX, e.clientY) === canvas;
      /* dropped on the map: build it there. released without travelling:
         treat it as a click and build it in front of the camera */
      if (over){ const p = toWorld(e); create(a.kind, a.type, p[0], p[1]); }
      else create(a.kind, a.type, G.cam[0], G.cam[1]);
    });

    addEventListener('keydown', e => {
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.code === 'KeyB' && !e.ctrlKey && !e.metaKey){ setOn(!on); return; }
      if (!on) return;
      if (e.code === 'Delete' || e.code === 'Backspace'){
        e.preventDefault();
        const mk = Markers.selected();
        if (mk) Markers.remove(mk); else remove(sel);
        syncUI();
      }
      else if (e.code === 'KeyC'){
        const mk = Markers.selected();
        if (mk){ Markers.cycleTint(mk); syncUI(); }
      }
      else if (e.code === 'BracketLeft') scaleSel(1 / 1.15);
      else if (e.code === 'BracketRight') scaleSel(1.15);
      else if (e.code === 'Tab' && e.shiftKey){        // step through the layers
        e.preventDefault();
        const i = layerIndex(layer);
        setLayer(Kinds.layers[(i + 1) % Kinds.layers.length].id);
      }
    });
  }

  /* ── palette ── */
  function ui(){
    const el = $('#palette');
    if (!el || el.childElementCount) return;
    el.innerHTML =
      '<div class="plabel">Layer</div><div id="klayers"></div>' +
      '<div class="plabel">Place</div><div id="kkinds" class="kgrid"></div>' +
      '<div class="plabel">Shape</div><div id="kshapes" class="kgrid"></div>' +
      '<div class="plabel" id="kvarlabel">Type</div><div id="kvariants" class="kgrid"></div>' +
      '<div class="plabel">Adjust</div><div id="ktune"></div>' +
      '<div class="kfoot"><button class="btn" id="kmask">Mask</button>' +
      '<button class="btn" id="kclearlayer">Clear layer</button></div>' +
      '<div class="plabel">Markers</div><div id="kmarkers"></div>' +
      '<input id="kmname" type="text" spellcheck="false" placeholder="name this place" hidden>' +
      '<div class="kfoot one"><button class="btn" id="kclear">Clear all</button></div>' +
      '<div class="kstate" id="kstate"></div>' +
      '<div class="knote" id="kstat"></div>';

    for (const L of Kinds.layers){
      const row = document.createElement('div');
      row.className = 'krow';
      row.innerHTML = '<span class="kname">' + L.label + '</span><span class="keye">●</span>';
      row.dataset.layer = L.id;
      row.querySelector('.kname').onclick = () => setLayer(L.id);
      row.querySelector('.keye').onclick = ev => {
        ev.stopPropagation();
        vis[L.id] = !vis[L.id];
        rebuild(); syncUI();
      };
      $('#klayers').appendChild(row);
      /* the road network is the thing everything else is arranged around, so
         it sits at the top on its own rather than in the run of terrain */
      if (L.solo){
        const sep = document.createElement('div');
        sep.className = 'ksep';
        $('#klayers').appendChild(sep);
      }
    }
    for (const sh of Kinds.shapes){
      const c = document.createElement('div');
      c.className = 'kchip'; c.textContent = sh.label; c.dataset.shape = sh.id;
      c.onclick = () => retype(sh.id);
      $('#kshapes').appendChild(c);
    }
    for (const [key, label, min, max, step] of
         [['size', 'Width', 1, 60, 1], ['feather', 'Feather', 0, 14, 1],
          ['bright', 'Bright', 40, 220, 5], ['grain', 'Grain', 1, 4, 1],
          ['scale', 'Scale', 40, 200, 5], ['jitter', 'Jitter', 0, 150, 5],
          ['scatter', 'Scatter', 0, 100, 5], ['pad', 'Clear', 0, 60, 5],
          ['padFade', 'Fade', 0, 80, 5], ['padBreak', 'Break', 0, 100, 5]])
      $('#ktune').appendChild(slider(key, label, min, max, step));
    $('#kmask').onclick = () => {
      if (sel){ sel.mask = !sel.mask; defs.mask = sel.mask; changed(sel); }
      else { defs.mask = !defs.mask; syncUI(); }
    };
    $('#kclear').onclick = () => {
      if (!G.shapes.length) return;
      G.shapes.length = 0; sel = null; changed();
    };
    $('#kclearlayer').onclick = () => {
      const keep = G.shapes.filter(s => layerOf(s) !== layer);
      if (keep.length === G.shapes.length) return;
      G.shapes = keep; sel = null; changed();
    };
    /* a marker with a name is a place you can be told you are standing
       outside of, and be told you are inside once you are */
    const nm = $('#kmname');
    nm.oninput = () => { const mk = Markers.selected(); if (mk) Markers.rename(mk, nm.value); };
    nm.onkeydown = e => { e.stopPropagation(); if (e.code === 'Enter') nm.blur(); };
    Markers.ui();
    syncUI();
  }
  /* the palette belongs to whichever registry is mounted, so it is thrown
     away and rebuilt rather than patched when the registry changes */
  function reui(){
    const el = $('#palette');
    if (el) el.innerHTML = '';
    ui();
  }

  function slider(key, label, min, max, step){
    const row = document.createElement('div');
    row.className = 'prow';
    row.innerHTML = '<label>' + label + '</label><input type="range" min="' + min +
      '" max="' + max + '" step="' + step + '"><span class="pv"></span>';
    row.dataset.key = key;
    const inp = row.querySelector('input'), out = row.querySelector('.pv');
    inp.oninput = () => applySlider(key, +inp.value);
    row._set = (v, text, live, lo, hi) => {
      if (lo !== undefined){ inp.min = lo; inp.max = hi; }
      inp.value = v; out.textContent = text; inp.disabled = !live;
      row.classList.toggle('off', !live);
    };
    return row;
  }

  /* a slider with something selected edits it; with nothing selected it
     sets what the next shape you place will be born with */
  function applySlider(key, v){
    const set = (k, val) => {
      if (sel){ sel[k] = val; changed(sel); } else { defs[k] = val; syncUI(); }
    };
    if (key === 'feather') return set('feather', v);
    if (key === 'bright')  return set('bright', v / 100);
    if (key === 'grain')   return set('grain', v);
    if (key === 'scale')   return set('scale', v / 100);
    if (key === 'jitter')  return set('jitter', v / 100);
    if (key === 'scatter') return set('scatter', v / 100);
    if (key === 'pad')     return set('pad', v / 10);
    if (key === 'padFade')  return set('padFade', v / 10);
    if (key === 'padBreak') return set('padBreak', v / 100);
    if (!sel) return;
    if (banded(sel)) sel.width = snapW(v * cellSize());
    else {
      const ratio = sel.h / Math.max(sel.w, 1);
      sel.w = clamp(snapS(v * grid()), grid(), MAXSPAN());
      sel.h = clamp(snapS(sel.w * ratio), grid(), MAXSPAN());
    }
    changed(sel);
  }

  /* a stand of trees can be all conifer or all broadleaf, a district all
     towers or all sheds — the variants a kind offers, if it offers any */
  /* The variants belong to whatever kind you are working with: the shape
     you have selected, or the last one you reached for. Choosing before you
     place has to work as well as changing after. */
  function syncVariants(){
    const box = $('#kvariants'), lab = $('#kvarlabel');
    if (!box) return;
    const id = sel ? sel.kind : lastKind;
    const k = id ? Kinds.by[id] : null;
    const list = k && k.variants;
    box.hidden = !list; lab.hidden = !list;
    box.innerHTML = '';
    if (!list) return;
    const current = sel && sel.kind === id ? sel.variant : (defs.variant[id] || list[0]);
    for (const v of list){
      const c = document.createElement('div');
      c.className = 'kchip' + (current === v ? ' sel' : '');
      c.textContent = v;
      c.onclick = () => {
        defs.variant[id] = v;
        if (sel && sel.kind === id){ sel.variant = v; changed(sel); }
        else syncUI();
      };
      box.appendChild(c);
    }
  }

  function syncTune(){
    const c = cellSize();
    document.querySelectorAll('#ktune .prow').forEach(r => {
      const key = r.dataset.key, lab = r.querySelector('label');
      if (key === 'feather'){
        const v = sel ? (sel.feather || 0) : defs.feather;
        r._set(v, v ? v + (v === 1 ? ' cell' : ' cells') : 'hard', true);
      } else if (key === 'bright'){
        const b = sel ? (sel.bright || 1) : defs.bright;
        r._set(Math.round(b * 100), b.toFixed(2) + '\u00d7', true);
      } else if (key === 'grain'){
        const v = sel ? (sel.grain || 1) : defs.grain;
        r._set(v, v === 1 ? 'full' : '1/' + v, true, 1, 4);
      } else if (key === 'scale'){
        const v = sel ? (sel.scale || 1) : defs.scale;
        r._set(Math.round(v * 100), v.toFixed(2) + '\u00d7', true, 40, 200);
      } else if (key === 'jitter'){
        const v = sel ? (sel.jitter || 0) : defs.jitter;
        r._set(Math.round(v * 100), v ? v.toFixed(2) + ' cell' : 'true', true, 0, 150);
      } else if (key === 'scatter'){
        const v = sel ? (sel.scatter || 0) : defs.scatter;
        r._set(Math.round(v * 100), v ? Math.round(v * 100) + '%' : 'solid', true, 0, 100);
      } else if (key === 'pad'){
        const v = sel ? (sel.pad || 0) : defs.pad;
        r._set(Math.round(v * 10), v ? v.toFixed(1) + ' cells' : 'none', true, 0, 60);
      } else if (key === 'padFade'){
        const v = sel ? (sel.padFade || 0) : defs.padFade;
        r._set(Math.round(v * 10), v ? v.toFixed(1) + ' cells' : 'hard', true, 0, 80);
      } else if (key === 'padBreak'){
        const v = sel ? (sel.padBreak || 0) : defs.padBreak;
        r._set(Math.round(v * 100), v ? Math.round(v * 100) + '%' : 'straight', true, 0, 100);
      } else if (!sel){
        lab.textContent = 'Size'; r._set(1, '\u2014', false, 1, 60);
      } else if (banded(sel)){
        const v = Math.max(1, Math.min(WMAX, Math.round(sel.width / c)));
        lab.textContent = 'Width'; r._set(v, v + (v === 1 ? ' cell' : ' cells'), true, 1, WMAX);
      } else {
        const v = Math.max(1, Math.round(sel.w / grid()));
        lab.textContent = 'Size'; r._set(v, v + (v === 1 ? ' tile' : ' tiles'), true, 1, 60);
      }
    });
    const mk = $('#kmask');
    if (mk) mk.classList.toggle('sel', sel ? !!sel.mask : defs.mask);
  }

  /* the kind chips belong to the active layer, so the palette only ever
     shows what you can actually place right now */
  function syncKinds(){
    const box = $('#kkinds');
    if (!box) return;
    box.innerHTML = '';
    for (const p of Kinds.palette){
      const k = Kinds.by[p.kind];
      if (!k || k.layer !== layer) continue;
      const c = document.createElement('div');
      c.className = 'kchip';
      c.innerHTML = '<i style="background:' + k.swatch + '"></i>' + p.label;
      c.addEventListener('pointerdown', ev => {
        ev.preventDefault();
        armed = {kind: p.kind, type: p.type};
        lastKind = p.kind;
        document.body.classList.add('arming');
        syncUI();
      });
      box.appendChild(c);
    }
  }

  /* ── the route ──────────────────────────────────────────────────────────
     The same list either way, because it is the same question at two
     scales: out on the town it is the rooms you walk through in order, and
     inside one it is the loci you walk past. The dot says whether the entry
     holds anything yet — a plan, or a picture — because the run the
     platformer plays is exactly the entries that do. */
  function syncRoute(){
    const panel = $('#route');
    if (panel) panel.hidden = !on;
    const box = $('#kroute'), lab = $('#krlabel'), note = $('#krnote');
    if (!box || !on) return;
    const inside = typeof Interior !== 'undefined' && Interior.inside();
    const list = Markers.ordered();
    lab.textContent = inside ? 'Loci' : 'Rooms';
    box.innerHTML = '';
    const sel = Markers.selected();
    for (const m of list){
      const row = document.createElement('div');
      row.className = 'rrow' + (m === sel ? ' sel' : '');
      const full = inside ? (typeof Loci !== 'undefined' && Loci.has(m.uid))
                          : (typeof Interior !== 'undefined' && Interior.has(m.uid));
      row.innerHTML =
        '<span class="rn">' + (m.n || '') + '</span>' +
        '<span class="rg"></span><span class="rname"></span>' +
        '<span class="rdot' + (full ? '' : ' off') + '">●</span>' +
        '<span class="rmv" data-d="-1">▲</span><span class="rmv" data-d="1">▼</span>';
      row.querySelector('.rg').textContent = Markers.glyphs()[m.gi] || '◆';
      row.querySelector('.rname').textContent =
        (m.name || '').trim() || (inside ? 'unnamed locus' : 'unnamed room');
      row.onclick = ev => {
        const mv = ev.target.closest('.rmv');
        if (mv){ ev.stopPropagation(); Markers.reorder(m, +mv.dataset.d); syncUI(); return; }
        Markers.select(m); sel2(null); syncUI();
      };
      box.appendChild(row);
    }
    if (!note) return;
    if (!list.length) note.textContent = inside ? 'no loci yet · place a marker'
                                                : 'no rooms yet · place a marker';
    else if (inside){
      const n = list.filter(m => typeof Loci !== 'undefined' && Loci.has(m.uid)).length;
      note.textContent = n + ' of ' + list.length + ' have a picture · enter opens one';
      note.classList.toggle('warn', n < list.length);
    } else {
      const n = list.filter(m => typeof Interior !== 'undefined' && Interior.has(m.uid)).length;
      note.textContent = n + ' of ' + list.length + ' have a plan · enter goes inside';
      note.classList.toggle('warn', n < list.length);
    }
  }
  const sel2 = s => { sel = s; };

  function syncUI(){
    if (!$('#palette') || !$('#klayers')) return;
    document.querySelectorAll('#klayers .krow').forEach(r => {
      r.classList.toggle('sel', r.dataset.layer === layer);
      r.classList.toggle('off', !vis[r.dataset.layer]);
    });
    syncKinds();
    syncVariants();
    syncTune();
    syncRoute();
    const allowed = sel ? (Kinds.by[sel.kind].types || []) : [];
    document.querySelectorAll('#kshapes .kchip').forEach(c => {
      c.classList.toggle('sel', !!sel && sel.type === c.dataset.shape);
      c.classList.toggle('dim', !allowed.includes(c.dataset.shape));
    });
    /* say plainly what the thing you have selected can be made to do */
    const mkSel = Markers.selected();
    const nm = $('#kmname');
    if (nm){
      nm.hidden = !mkSel;
      if (mkSel && document.activeElement !== nm) nm.value = mkSel.name || '';
    }
    const st = $('#kstate');
    if (st){
      const mk = mkSel;
      if (mk)
        st.innerHTML = '<b>marker</b> · drag to move · <b>C</b> colour · ' +
          '<b>Enter</b> goes inside · <b>del</b> removes';
      else if (!sel)
        st.innerHTML = 'nothing selected · click a shape, or drag one out of Place';
      else if (sel.type === 'line')
        st.innerHTML = '<b>drag</b> body · <b>ends</b> move · <b>◇ aqua</b> bends the segment · ' +
          '<b>shift-click</b> adds a point · <b>[ ]</b> width';
      else if (sel.type === 'ring')
        st.innerHTML = '<b>drag</b> body · <b>grip</b> sets radius · <b>[ ]</b> width';
      else
        st.innerHTML = '<b>drag</b> body · <b>corners</b> scale · <b>edges</b> stretch · ' +
          '<b>◇</b> turns' + (sel.rot ? ' · ' + Math.round(sel.rot * 180 / Math.PI) + '°' : '');
    }
    const el = $('#kstat');
    if (!el) return;
    const n = G.shapes.filter(s => layerOf(s) === layer).length;
    el.textContent = sel ? sel.kind + ' · ' + sel.type
                         : n + ' on this layer · ' + Markers.count() + ' markers';
  }

  function setLayer(id){
    layer = id;
    if (sel && layerOf(sel) !== id) sel = null;
    if (!sel){
      const first = Kinds.list.find(k => k.layer === id && k.variants);
      lastKind = first ? first.id : null;
    }
    syncUI();
  }
  function setOn(v){
    on = v;
    if (!on) sel = null;
    document.body.classList.toggle('building', on);
    const el = $('#palette');
    if (el) el.hidden = !on;
    syncUI();
  }

  /* ── persistence ── */
  function save(){
    try {
      localStorage.setItem(KEY, JSON.stringify(G.shapes.map(s => ({
        kind: s.kind, type: s.type, seed: s.seed, variant: s.variant, rot: s.rot || 0,
        feather: s.feather, bright: s.bright, mask: s.mask,
        grain: s.grain, scale: s.scale, jitter: s.jitter, scatter: s.scatter,
        pad: s.pad, padFade: s.padFade, padBreak: s.padBreak,
        x: s.x, y: s.y, w: s.w, h: s.h, r: s.r, pts: s.pts, ctrl: s.ctrl, width: s.width
      }))));
    } catch (e){}
  }
  function load(){
    let raw = [];
    try { raw = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e){}
    G.shapes = (Array.isArray(raw) ? raw : [])
      .filter(s => s && Kinds.by[s.kind])
      .map(s => {
        const t = s.type === 'stroke' ? 'line' : s.type;    // an older save
        const k = Kinds.by[s.kind];
        return Object.assign({}, s, {
          id: nextId++, _buf: null,
          type: (k.types || []).includes(t) ? t : k.types[0],
          pts: Array.isArray(s.pts) ? s.pts : [[s.x || 0, s.y || 0]],
          ctrl: Array.isArray(s.ctrl) ? s.ctrl : null, _flat: null,
          width: Math.min(s.width || 8, WMAX * cellSize()),
          rot: s.rot || 0,
          feather: s.feather === undefined ? 0 : s.feather,
          bright: s.bright || 1, mask: !!s.mask,
          grain: s.grain || 1, scale: s.scale || 1,
          jitter: s.jitter || 0, scatter: s.scatter || 0,
          pad: s.pad === undefined ? (k.pad0 || 0) : s.pad,
          padFade: s.padFade === undefined ? (k.padFade0 || 0) : s.padFade,
          padBreak: s.padBreak === undefined ? (k.padBreak0 || 0) : s.padBreak,
          r: Math.min(s.r || cellSize(), RMAX * cellSize()),
          variant: s.variant || (k.variants ? k.variants[0] : 'mixed')
        });
      });
  }

  const startLayer = () => (Kinds.layers.find(L => L.start) || Kinds.layers[0]).id;

  /* ── mounting a different set of shapes ────────────────────────────────
     One call swaps what is being edited: the registry the palette is built
     from, and the key the shapes are saved under. Commit first — whatever
     was on screen belongs to the key it came from. */
  function mount(scope, key){
    Kinds.use(scope);
    KEY = key;
    seeVis();
    sel = null; drag = null; armed = null; lastKind = null;
    document.body.classList.remove('arming');
    Markers.disarm();
    load();
    reui();
    rebuild();
    setLayer(startLayer());
    if (typeof restampTerrain === 'function') restampTerrain();
  }

  function init(){
    load();
    wire();
    ui();
    rebuild();
    setLayer(startLayer());
    setOn(false);
  }

  return {init, rebuild, stamp, overlay, setOn, mount, active: () => on,
          sync: syncUI, commit: save, key: () => KEY, count: () => G.shapes.length};
})();
