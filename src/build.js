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
  let layer = 'roads', combined = null, lastKind = null, band = null;
  /* ── the two edit layers ────────────────────────────────────────────────
     ROOMS is the floor plan: the only things that answer the pointer are the
     room shells, and moving or resizing one lays its contents again for the
     shape it is now. FIT is everything inside them, with the shells locked.

     They are exclusive on purpose. Furniture arranged by hand would be
     thrown away by the next nudge of a wall, so the plan has to be settled
     before the fitting-out means anything — and a wall you cannot grab by
     accident is the other half of the same promise. */
  let mode = 'fit';
  const vis = {};
  const seeVis = () => { for (const L of Kinds.layers) if (vis[L.id] === undefined) vis[L.id] = true; };
  seeVis();

  /* Which shapes are being edited is one string. Outdoors it is the town;
     inside a building it is that building's floor plan, and nothing else in
     here changes — see interior.js. */
  let KEY = 'hq.shapes';
  /* what a newly placed shape inherits. The sliders write here when nothing
     is selected, so you can dial in a look and then keep placing it. */
  const defs = {feather: 4, bright: 1, mask: false, variant: {}, tone: {},
                grain: 1, scale: 1, jitter: 0, scatter: 0, fall: 0, out: 0, aim: null,
                core: 0.35, pad: 0, padFade: 0.8, padBreak: 0.3};
  /* ── telling history what just happened ────────────────────────────────
     A gesture that has ended is a step you can walk back (hstep); anything
     else is a nudge that history coalesces with whatever else happens in
     the next moment (htap), because a drag writes on every frame and a step
     per frame is a stack that holds a quarter of a second of history.

     The module is asked for by name at call time because history.js loads
     after this file — and it is asked for by one of its OWN methods rather
     than by `typeof History`, because the browser already has a History and
     that name is never undefined. A history.js that failed to load would
     otherwise be a TypeError on every frame of every drag instead of a
     feature that is quietly absent. */
  const hist = () => (typeof History !== 'undefined' &&
                      typeof History.step === 'function' ? History : null);
  const hstep = () => { const h = hist(); if (h) h.step(); };
  const htap = () => { const h = hist(); if (h) h.tap(); };

  const cellSize = () => (G.A ? G.A.cell : 8);
  /* Everything lands on the walk grid — the same tiles the walker steps
     between — and that grid is a whole number of lattice cells, so snapping
     to it snaps to the weave as well. */
  const grid = () => (G.terr ? G.terr.tsz : cellSize() * 4);
  const snapC = v => (Math.round(v / grid() - 0.5) + 0.5) * grid();   // onto tile centres
  const snapD = v => Math.round(v / grid()) * grid();                 // a whole-tile step
  const snapS = v => Math.max(grid(), Math.round(v / grid()) * grid());
  /* ── the fine grid ──────────────────────────────────────────────────────
     The walk tile is the right quantum for a thing you place: a bed sits on
     tiles, and half-tile furniture would be furniture you could never line
     up. It is the wrong quantum for a thing you aim. A wall is two lattice
     cells — half a tile — so a tool snapped to tiles cannot land on one of
     its faces, and a room resized before edges were kept on the grid can sit
     on half-tiles itself. The lattice cell is what everything here is
     actually drawn in, so it is the finest thing worth aiming at, and it
     contains the tile grid rather than competing with it. */
  const snapK = v => Math.round(v / cellSize()) * cellSize();
  /* ── how finely a shape moves ───────────────────────────────────────────
     A thing you PLACE moves in walk tiles: a bed half a tile out is a bed
     you can never line up with the wall beside it. A thing you AIM moves in
     lattice cells, because a cell is one diamond — it is the pixel of this
     drawing, and a cut is only clean if it can be put on one. The wall it
     has to land on is two cells thick, so a tile is four times too coarse to
     trim with: every correction overshoots or undershoots and there is no
     setting in between. */
  const fine = s => !!(s && ((Kinds.by[s.kind] || {}).clears || s.kind === 'door'));
  const quant = s => (fine(s) ? cellSize() : grid());
  const snapQ = (v, q) => Math.round(v / q) * q;
  const snapQS = (v, q) => Math.max(q, Math.round(v / q) * q);
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
  /* ── minimal ──────────────────────────────────────────────────────────
     A plan taken down to its walls (src/trace.js): the floor and the
     fittings are not drawn, and the fittings do not block — the floor
     still stamps, because it is the ground the walker stands on. Never
     saved; a view, not an edit, and every mount puts it back. */
  let minimal = false;
  const HIDE = {floor: 1, fixt: 1};
  const hidden = s => minimal && HIDE[layerOf(s)];
  const layerIndex = id => Kinds.layers.findIndex(L => L.id === id);
  const zOf = s => (Kinds.layers.find(L => L.id === layerOf(s)) || {z: 0}).z;
  /* A gap belongs to the plan, not to the fit-out: it is a statement about
     where a wall is not, and walls are what the plan is made of. */
  const isGap = s => (Kinds.by[s.kind] || {}).cuts;
  /* ── the third verb ─────────────────────────────────────────────────────
     A modifier is a statement ABOUT the shapes it lies over rather than a
     shape of its own. It draws nothing, stamps nothing and takes nothing:
     what it changes is how what is already there comes out. Everything that
     follows from that is spelled out where it is enforced — the occluder
     list, the walk grid, and the per-shape gathering in rebuild(). */
  const isMod = s => !!(Kinds.by[s.kind] || {}).modifies;
  /* ── the modifier that measures from the middle ────────────────────────
     A boundary is a modifier like the demolisher, so every rule above
     holds for it unchanged. What the flag buys is the handful of places
     that would otherwise offer it a control aimed at the wrong thing:
     Fall and its marker point damage at a side, and free corners shape a
     wedge, and neither of those is a question a shape measured from its
     own centre outward can be asked. It gets Core instead. */
  const isRadial = s => !!(Kinds.by[s.kind] || {}).radial;
  /* a drawn building: one size, the size it was drawn at, and no grips —
     it is placed like a print, moved whole, and that is the whole of it */
  const isPrint = s => !!(s && (Kinds.by[s.kind] || {}).glyphs);
  /* ── a road that has not joined the network ─────────────────────────
     Only the route carries the walker, and the route is one flood from
     where the walker stands. A road laid somewhere that flood does not
     reach is a road nothing can walk — not a bug in the grid, a gap in
     the drawing — so it is said, and left to you to join up. Asked of the
     walk tiles the road stamps, so it agrees with what the walker sees
     and not with what the pointer sees. */
  function stranded(s){
    const k = Kinds.by[s.kind];
    if (!k || k.walk !== 2 || !G.terr || !G.reach || Kinds.scope() !== 'map') return false;
    let any = false, hit = false;
    tiles(s, G.terr, i => { if (!G.terr.path[i]) return; any = true; if (G.reach[i]) hit = true; },
          banded(s) ? G.terr.tsz * (k.walkTol || 0.62) : 0);
    return any && !hit;
  }
  function syncStrand(){
    const el = $('#kstrand');
    if (el) el.hidden = !(sel && stranded(sel));
  }
  /* ── a warp's points ─────────────────────────────────────────────────
     Born as eight on the oval the shape was, in its own frame; `w`/`h`
     are kept as the run's own extent, the way they shadow a quad, because
     the size slider, the cell scan and every bbox test read them. */
  const blobFrom = (w, h) => {
    const out = [];
    for (let i = 0; i < 8; i++){
      const a = i / 8 * Math.PI * 2;
      out.push([Math.cos(a) * w / 2, Math.sin(a) * h / 2]);
    }
    return out;
  };
  function normBlob(s){
    if (!s.blob) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of s.blob){
      x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]);
      x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]);
    }
    s.w = Math.max(cellSize() * 2, x1 - x0); s.h = Math.max(cellSize() * 2, y1 - y0);
  }
  /* ── the choices a kind offers, however it offers them ─────────────────
     Most kinds carry a short written list. A landmark carries `glyphs`
     instead, and its list is whatever tools/glyphs.py last sliced — read
     off Glyphs rather than copied into the registry, so the sheet stays
     the one place a building is added.

     Everything downstream asks this rather than reading `k.variants`, so
     the two kinds of list are the same kind of list everywhere except the
     one place they are drawn. `variant` is still just a string on the
     shape, which is what keeps a saved town readable either way. */
  const variantsOf = k => !k ? null
    : (k.glyphs ? (typeof Glyphs === 'undefined' ? null : Glyphs.of(k.glyphs)) : k.variants) || null;
  const firstVariant = k => { const l = variantsOf(k); return l ? l[0] : 'mixed'; };
  /* ── a line whose ends are anchors ──────────────────────────────────────
     A river is one line bent in many places with its two ends staying put,
     which is the whole difference between it and a chain of creek segments.
     It is enforced by emitting the two ends as anchors rather than as
     points: they are still drawn, because an end you cannot see is an end
     you will keep trying to grab, but the hit test skips them, so there is
     nothing there to take hold of.

     The lock has a way off, because a river you can never re-anchor is a
     river you have to delete and draw again. It is held on the SELECTION and
     not on the shape: nothing about it is saved and nothing survives
     clicking elsewhere, since an end that stayed unlocked between sessions
     would be a lock that protects you right up until you forget you undid
     it. */
  let freeSel = null;
  const anchorKind = s => !!(Kinds.by[s.kind] || {}).anchored;
  /* One predicate for 'could this shape have anchors', so the control that
     offers the unlock and the code that honours it cannot disagree about
     which shapes it applies to. */
  const anchorable = s => !!s && s.type === 'line' && anchorKind(s);
  /* The unlock is held on the selection, so it has to die with the
     selection — otherwise a river unlocked, left, and come back to is still
     unlocked, which is the lock protecting you right up until you have
     forgotten you undid it. Dropped here, when the selection is seen to have
     moved on, rather than at each of the five places a selection is
     assigned: a sixth can be added later without knowing to clear it. */
  const anchored = s => {
    if (freeSel && freeSel !== sel) freeSel = null;
    return anchorable(s) && freeSel !== s;
  };
  /* What the plan is made of: the rooms, the holes knocked in them, and the
     ways between them. All three are edited at plan level and none of them
     is furniture. */
  const isPlan = s => !!s.label || !!isGap(s) || s.kind === 'door';
  /* ── what the pointer will answer to ───────────────────────────────────
     The active layer, and the modifiers, which are not on one. A modifier
     reaches every layer whatever its own is listed as, and the palette now
     offers both of them above the layer rows rather than under Roads — so
     a boundary you can see weathering the trees you are working on but
     cannot pick up without changing layers first would be the palette
     saying one thing and the plate another. They stay tied to their
     layer's eye, because that is the switch that says whether they are in
     the picture at all. */
  const editable = s => mode === 'rooms'
    ? isPlan(s)
    : (!isPlan(s) && vis[layerOf(s)] && (isMod(s) || layerOf(s) === layer));

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
      if (!(s.w > 0 && s.h > 0)){ s.w = snapS(span); s.h = snapS(span * 0.78); }
      /* coming to a warp, the oval you had becomes eight points on itself;
         leaving one, the run is dropped and its extent is the new box */
      s.blob = type === 'warp' ? blobFrom(s.w, s.h) : null;
    }
    return s;
  }

  /* ── a demolisher is born aimed ────────────────────────────────────────
     Fall runs along the shape's own +x, and the rotate grip is what points
     that anywhere else. Which leaves the question of where it should point
     the moment one lands, and 'east, always' is the one answer that is
     wrong everywhere: a demolisher put along the top of the map to thin the
     town out at its edge is eating northward, and it should not have to be
     turned by hand to say so.

     So it is aimed outward from the middle of the plate: an area sitting in
     the top of the map falls up, one down the left falls left, and the axis
     it is judged on is whichever offset is larger *in proportion to the
     plate* — otherwise a map twice as tall as it is wide would call almost
     everything on it top or bottom.

     Only at birth. Re-aiming on every move would mean an area you had
     turned by hand snapped back the first time you nudged it, and the whole
     point of the rotate grip is that your answer beats this one.

     A quarter turn is taken by swapping w and h as well, so the footprint
     you dragged out is the footprint you get: the area is aimed, not
     turned on its side. */
  function aimFall(s){
    if (!isMod(s) || !(s.fall > 0) || s.aim) return;
    const W = G.W, H = G.H;
    if (!W || !H) return;
    /* Proportional to the plate, so a map half as wide as it is tall does
       not call almost everything on it top or bottom. The marker goes on
       the side that is kept, which is the side facing the middle of the
       map — so the damage falls outward, away from the town. */
    const dx = (s.x - W / 2) / (W / 2), dy = (s.y - H / 2) / (H / 2);
    const L = Math.hypot(dx, dy);
    s.aim = L < 1e-3 ? [-1, 0] : [-dx / L * s.fall, -dy / L * s.fall];
  }

  /* ── a boundary is born as the plate ───────────────────────────────────
     Every other kind is born where you dropped it, at a size you then drag
     out, because a park is one of many and where it goes is the whole
     decision. A boundary is almost always one, and the thing it is almost
     always describing is the town — so a chip that dropped a six-tile oval
     under the pointer would be handing you a tool you have to resize past
     the edge of the screen before it does anything you can see, and the
     first thing you would learn about it is that it looks broken.

     So it arrives around the middle of the plate at most of its size, and
     you pull it in to where the town actually stops. Nine tenths rather
     than the whole: it is a frame you are meant to take hold of, and the
     grips of one born flush with the plate edge are off the side of it.

     Where you clicked is thrown away, which is the one liberty taken here.
     A boundary has one sensible starting position and it is not under the
     pointer, and the same drag that would place it is the drag you would
     immediately have to undo. */
  function framePlate(s){
    if (!isRadial(s)) return;
    const W = G.W, H = G.H;
    if (!W || !H) return;
    s.x = snapC(W / 2); s.y = snapC(H / 2);
    s.w = clamp(snapS(W * 0.9), grid(), MAXSPAN());
    s.h = clamp(snapS(H * 0.9), grid(), MAXSPAN());
  }

  function create(kind, type, wx, wy){
    const k = Kinds.by[kind];
    if (!k) return null;
    /* a road is grains and a building is blocks (src/stock.js); short of
       either, nothing is placed and the note says what it would take */
    if (typeof Stock !== 'undefined' && !Stock.pay(kind)) return null;
    const c = cellSize();
    const area = type !== 'line' && type !== 'ring';
    const g = grid();
    const s = {id: nextId++, kind, type, seed: (Math.random() * 1e6) | 0, rot: 0,
               x: snapC(wx), y: snapC(wy), w: snapS(g * 6), h: snapS(g * 5),
               r: snapR(cellSize()), width: snapW(cellSize() * 2),
               pts: [[snapC(wx), snapC(wy)]],
               feather: k.feather0 !== undefined ? k.feather0 : (area ? defs.feather : 0),
               bright: defs.bright * (k.bright0 || 1),
               grain: defs.grain, scale: defs.scale, mult: 1,
               /* a kind that draws nothing has to be born already doing
                  something, or dropping it reads as a tool that is broken */
               jitter: k.jitter0 !== undefined ? k.jitter0 : defs.jitter,
               scatter: k.scatter0 !== undefined ? k.scatter0 : defs.scatter,
               fall: k.fall0 !== undefined ? k.fall0 : defs.fall,
               out: k.out0 !== undefined ? k.out0 : defs.out, aim: null,
               core: k.core0 !== undefined ? k.core0 : defs.core,
               pad: k.pad0 !== undefined ? k.pad0 : defs.pad,
               padFade: k.padFade0 !== undefined ? k.padFade0 : defs.padFade,
               padBreak: k.padBreak0 !== undefined ? k.padBreak0 : defs.padBreak,
               mask: defs.mask,
               variant: defs.variant[kind] || firstVariant(k),
               tone: defs.tone[kind] || 'stone'};
    defaults(s, type);
    born(s, k, type, wx, wy);
    aimFall(s);
    framePlate(s);
    /* ── a print comes with its own clearing, as its own shape ──────────
       Before 2026-08-30 a print cleared its ground from INSIDE itself:
       the glyph's own '2' cells (a window, a doorway, the plinth) are
       drawn as dark cover, so the ground vanished exactly under the
       drawing and nowhere else, and there was nothing to take hold of —
       the clearing was locked to the asset and moved only when the asset
       moved.

       It is now two shapes, the way the FIRST PALACE has always been two
       (`Found.generate` lays a clearing and then the house on it): the
       print, and a `clear` under it, each an ordinary shape that selects,
       drags, resizes and deletes on its own. Placing one is still one
       gesture and one undo step — both are in `G.shapes` before the
       pointerup calls `hstep` — but from then on they are independent,
       so the ground you see through can be pushed out from under the
       asset, grown, or thrown away without touching the drawing.

       `clear` and not `demolish` (which is what the first palace uses)
       on purpose: the clearing is picky about what it eats — terrain
       only, never a print, never a road — so an asset dropped on a
       crossing does not take the road with it. A demolish would.

       The glyph's own '2' cells are untouched: the first palace has both
       too, and taking them out would change every print ever placed. */
    if (k.glyphs && !k.aesthetic) clearUnder(s);
    G.shapes.push(s);
    sel = s;
    /* A modifier is not on the layer it is listed under — it is above them
       all, which is where the palette now offers it — so reaching for one
       must not move you off whatever you were working on. Everything else
       does move you, because placing a park is the start of working on the
       trees. */
    if (!k.modifies) layer = k.layer;
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
      /* and how wide, for the same reason it can say how long: a river born
         two cells across is a ditch with the wrong name on it */
      if (k.width0) s.width = snapW(cellSize() * k.width0);
    } else {
      s.x = snapC(wx); s.y = snapC(wy);
      if (k.w0){ s.w = snapS(g * k.w0); s.h = snapS(g * (k.h0 || k.w0)); }
      glyphSize(s, k);
      if (type === 'warp') s.blob = blobFrom(s.w, s.h);
    }
  }

  /* ── a landmark is born at one lattice cell per drawn pixel ────────────
     Every other kind is born at a size measured in TILES, because a park or
     a district has no size of its own — it is however big you drag it, and
     a tile is the unit the rest of the builder snaps to.

     A landmark does have a size of its own. Its glyph is a bitmap fourteen
     or so pixels across, and there is exactly one footprint at which the
     lattice can show all of it and no smaller: one cell per pixel. Bigger
     is legible but wasteful — the same building spread over four times the
     ground, which is what a tile-measured default gave it, since a tile is
     four cells and `w0: 10` is forty cells for a fourteen-pixel glyph.
     Smaller and the lattice has fewer cells than the art has pixels, so
     detail is being thrown away before it ever reaches the screen.

     So the size is read off the glyph rather than declared: M by N pixels
     becomes M by N cells. That is the smallest a landmark can be drawn and
     still be the building you picked, and it is where placing one starts.

     Deliberately NOT snapped. snapS rounds to whole tiles, and rounding a
     fourteen-cell building to the nearest four would either lose two
     columns of it or add two of nothing — both of which are the bug this
     exists to fix. Position still snaps; only the size is exact. */
  function glyphSize(s, k){
    if (!k.glyphs || typeof Glyphs === 'undefined') return;
    const rows = Glyphs.rows(s.variant);
    if (!rows || !rows.length) return;
    const c = cellSize(), m = Math.max(1, Math.round((s.mult || 1) * 2) / 2);
    s.w = rows[0].length * c * m;
    s.h = rows.length * c * m;
  }

  /* ── the clearing a print stands on ────────────────────────────────────
     THE FIRST PALACE'S CLEARING, EXACTLY — same kind, same five numbers
     (`Found.generate` in found.js): a `demolish` at half again the
     print's own footprint, `fall: 0, out: 1, feather: 3, scatter: 0.7,
     jitter: 0.4`. Those last three are the whole point of it: the edge
     is feathered three cells and then broken up by scatter and jitter,
     which is the soft sketchy rim the founding's own clearing has. A
     `clear` was used first (2026-08-30, earlier the same day) and its
     edge is dead straight by design — "born hard, because a clearing
     with a soft edge is a demolition, and that tool already exists"
     (kinds.js) — which read as a cut rectangle under every asset. It is
     a demolition that was wanted, so it is a demolition.

     The one thing to know about the swap: a demolish is not picky the
     way a clear is, so a clearing does bite the roads and the other
     built things inside it, not only the terrain. That is what the
     founding has always done under the first palace.

     `exact` because the position is the print's, which is already
     snapped; pushed BEFORE the print, so it is under it in the array and
     the print is what a click finds first. */
  const MATE = 1.5;
  function clearUnder(s){
    if (!Kinds.by['demolish']) return null;
    return make({kind: 'demolish', type: 'rect', exact: true,
                 x: s.x, y: s.y, w: s.w * MATE, h: s.h * MATE,
                 fall: 0, out: 1, feather: 3, scatter: 0.7, jitter: 0.4});
  }

  /* ── and grows only in whole multiples of itself ───────────────────────
     Born at one cell per pixel, a landmark is crisp because every pixel is
     exactly one diamond. Drag it to one-and-a-half times that and the
     generator has to put fourteen pixels across twenty-one cells: some
     pixels get two cells and some get one, and the building comes out
     with strokes of uneven weight, different ones at every size. The only
     sizes at which it stays crisp are the ones where a pixel is a whole
     number of cells — twice, three times — so those are the only sizes a
     resize can land on.

     Applied to w and h together, from whichever of them is the tighter
     fit, because the generator fits the glyph inside the box by its own
     aspect anyway: a box that is snapped on one axis and slack on the
     other is a crisp building with a margin of nothing around it, and the
     margin is what the grips would then be moving. Returns null for a
     kind that is not a landmark, so callers can fall through to the tile
     snap everything else uses.

     There is now exactly one such size. A building drawn at fourteen
     pixels is a fourteen-pixel building: bigger is the same pixels with
     the gaps showing, smaller is detail thrown away, and a town where one
     cathedral is drawn at a different scale from the next is a town with
     no scale at all. So a print has no grips and `[`/`]` ignore it, and
     this is the backstop for the paths that still carry a size — a plan
     arriving whole, the size field — which all land back on 1×. */
  function glyphSnap(s, w, h){
    const k = Kinds.by[s.kind];
    if (!k || !k.glyphs || typeof Glyphs === 'undefined') return null;
    const rows = Glyphs.rows(s.variant);
    if (!rows || !rows.length) return null;
    const c = cellSize(), m = Math.max(1, Math.round((s.mult || 1) * 2) / 2);
    return {w: rows[0].length * c * m, h: rows.length * c * m, n: 1};
  }

  /* ── a plan arriving whole ──────────────────────────────────────────────
     The generator hands over a finished set of shapes rather than dragging
     them out one at a time, so they are built here — same defaults, same
     snapping, same everything a dragged one gets — and the expensive half
     (regenerating instances, restamping the walk grid, saving) is paid once
     at the end instead of once per shape.

     It replaces rather than appends. A generated plan is a plan, not a layer
     over whatever was there, and half of one laid over half of another is
     not something anyone asked for. */
  function lay(list){
    G.shapes.length = 0;
    sel = null;
    for (const d of list) make(d);
    changed();
    return G.shapes.length;
  }
  /* one more shape on what is there — the house the founding plants
     (src/found.js). `lay` replaces the plate and wants plain records;
     handing it the shapes already on the plate, caches and all, is what
     hung the page once. */
  function add(d){
    const s = make(d);
    if (s) changed(s);
    return s;
  }
  function make(d){
      const k = Kinds.by[d.kind];
      if (!k) return null;
      const type = d.type || (k.types || ['rect'])[0];
      const area = type !== 'line' && type !== 'ring';
      /* Snapping is for a shape being dragged: sub-cell positions make the
         pattern shimmer under your hand. A generated shape is not being
         dragged — it has been worked out against a box that is already on
         the grid — and re-snapping it is not a no-op. A centre snaps to a
         tile CENTRE, so a room an even number of tiles wide has its edges on
         tile centres, and anything derived from it by rounding lands a whole
         tile out. `exact` says this position was computed, not pointed at. */
      const sc = d.exact ? (v => v) : snapC;
      const ss = d.exact ? (v => Math.max(grid(), v)) : snapS;
      const s = {id: nextId++, kind: d.kind, type,
                 seed: d.seed === undefined ? (Math.random() * 1e6) | 0 : d.seed,
                 rot: d.rot || 0,
                 x: sc(d.x || 0), y: sc(d.y || 0),
                 w: ss(d.w || grid() * 6), h: ss(d.h || grid() * 5),
                 r: snapR(d.r || cellSize()),
                 width: snapW(d.width || cellSize() * 2),
                 pts: d.pts ? d.pts.map(q => [sc(q[0]), sc(q[1])]) : [[0, 0]],
                 ctrl: Array.isArray(d.ctrl) ? d.ctrl.map(c => (c ? [c[0], c[1]] : null)) : null,
                 feather: d.feather !== undefined ? d.feather : k.feather0 !== undefined ? k.feather0 : (area ? defs.feather : 0),
                 bright: defs.bright * (k.bright0 || 1),
                 grain: 1, scale: 1, mult: Math.max(1, Math.round((d.mult || 1) * 2) / 2),
                 jitter: d.jitter !== undefined ? d.jitter : (k.jitter0 || 0),
                 scatter: d.scatter !== undefined ? d.scatter : (k.scatter0 || 0),
                 fall: d.fall !== undefined ? d.fall : (k.fall0 || 0),
                 out: d.out !== undefined ? d.out : (k.out0 || 0), aim: null,
                 core: d.core !== undefined ? d.core : (k.core0 !== undefined ? k.core0 : 0.35),
                 pad: k.pad0 || 0, padFade: k.padFade0 || 0, padBreak: k.padBreak0 || 0,
                 mask: false,
                 variant: d.variant || firstVariant(k), tone: d.tone || 'stone',
                 blob: Array.isArray(d.blob) ? d.blob.map(q => [q[0], q[1]]) : null,
                 label: d.label || '', n: d.n || 0, room: d.room || 0};
      if (s.type === 'warp' && !s.blob) s.blob = blobFrom(s.w, s.h);
      /* a print is born the size of its glyph, laid as it is placed */
      if (k.glyphs) glyphSize(s, k);
      aimFall(s);
      G.shapes.push(s);
      return s;
  }

  /* one room's contents, replaced. Everything else — the other rooms, the
     shell this belongs to, anything drawn by hand outside it — is left
     exactly where it is. */
  function refill(room, list){
    if (!room) return 0;
    G.shapes = G.shapes.filter(s => s.room !== room || s.label);
    for (const d of list) make(d);
    if (sel && G.shapes.indexOf(sel) < 0) sel = null;
    changed();
    return G.shapes.length;
  }

  /* a shape placed at a size somebody chose, rather than at the size its
     kind is born with */
  function drop(kind, x, y, w, h){
    const s = make({kind, type: 'rect', x, y, w, h});
    if (!s) return null;
    sel = s;
    changed(s);
    return s;
  }

  function remove(s){
    const i = G.shapes.indexOf(s);
    if (i < 0) return;
    /* deleting a room deletes the room, not the four walls of one — leaving
       its bed and its rug standing in the open would be a worse answer than
       either taking them or refusing */
    if (s.label && s.room) G.shapes = G.shapes.filter(x => x.room !== s.room);
    else G.shapes.splice(i, 1);
    if (sel === s) sel = null;
    if (freeSel === s) freeSel = null;
    changed();
  }

  /* ── a room takes its contents with it ─────────────────────────────────
     Moving a room used to lay its fit-out again from scratch, which threw
     away a bed you had nudged half a tile and, worse, did it on a click that
     moved nothing at all. A room dragged across the plan is the same room:
     everything in it comes along. Only a change of SIZE is a change of what
     fits, and only that re-lays anything. */
  function carry(wall, dx, dy){
    for (const x of G.shapes){
      if (x === wall || x.room !== wall.room) continue;
      moveBy(x, dx, dy);
      x._buf = null;
    }
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
    if (!sel || isPrint(sel)) return;
    const room = sel.label && mode === 'rooms' ? sel : null;
    const g = grid();
    if (fine(sel) && sel.type !== 'line' && sel.type !== 'ring'){
      /* Trimming is not scaling. A cut you are dialling in wants one cell on
         and one cell off, not fifteen percent of whatever it happens to be —
         which on a small one is nothing and on a large one is a tile.

         Two cells of size, because this grows from the middle and so moves
         both edges: one cell off each side, which is what keeps them on the
         cell grid the cut is aimed with. */
      const c = cellSize(), d = (f > 1 ? 2 : -2) * c;
      sel.w = clamp(sel.w + d, c, MAXSPAN());
      sel.h = clamp(sel.h + d, c, MAXSPAN());
    } else if (sel.type === 'line' || sel.type === 'ring')
      sel.width = snapW(sel.width * f);
    else {
      const w0 = sel.w, h0 = sel.h;
      sel.w = clamp(snapS(sel.w * f), g, MAXSPAN());
      sel.h = clamp(snapS(sel.h * f), g, MAXSPAN());
      if (sel.blob){
        const fx = sel.w / Math.max(w0, 1), fy = sel.h / Math.max(h0, 1);
        for (const q of sel.blob){ q[0] *= fx; q[1] *= fy; }
      }
    }
    changed(sel);
    if (room && typeof Palace !== 'undefined') Palace.refit(room);
  }
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);

  function retype(type){
    if (!sel || sel.type === type) return;
    if (!(Kinds.by[sel.kind].types || []).includes(type)) return;
    /* An oval has no corners and a line is not an area, so a quad cannot
       come along — and it must not lie in wait either, because coming back
       to Rect would restore a shape you had stopped being able to see. */
    sel.quad = null;
    defaults(sel, type);
    changed(sel);
    syncUI();
  }

  /* ── a cut lands on the grid it cuts ────────────────────────────────────
     A lattice cell is removed when its CENTRE falls inside the cut, and cell
     centres sit halfway between cell boundaries. So a cut whose own edges
     land halfway too puts every centre along that edge exactly on the
     boundary of the test — and whether each one is taken comes down to
     floating point. That is the ragged edge: a wall cut a diamond too far in
     one place and a diamond short in the next. Held to whole cells, every
     centre is decisively in or decisively out. */
  function alignFine(s){
    if (!fine(s) || s.type === 'line' || s.type === 'ring') return;
    const c = cellSize();
    const x0 = Math.round((s.x - s.w / 2) / c) * c, x1 = Math.round((s.x + s.w / 2) / c) * c;
    const y0 = Math.round((s.y - s.h / 2) / c) * c, y1 = Math.round((s.y + s.h / 2) / c) * c;
    s.w = Math.max(c, x1 - x0); s.h = Math.max(c, y1 - y0);
    s.x = (x0 + x1) / 2; s.y = (y0 + y1) / 2;
  }

  /* a shape changed: only its own instances need regenerating */
  /* ── nothing is drawn past the edge of the plate ─────────────────────
     The plate is the map and the walk grid is exactly its size, so a road
     drawn past the edge is a road the walker stops short of, at a point
     that looks like the middle of nowhere. Held to the plate on every
     edit instead: a line's points stay inside it and an area's centre
     stays where its box does. The town's plate only — a floor plan has no
     edge to fall off. */
  function keepOnPlate(s){
    if (!G.W || !G.H || Kinds.scope() !== 'map' || isRadial(s)) return;
    const c = cellSize(), W = G.W, H = G.H;
    if (s.pts){
      for (const q of s.pts){ q[0] = clamp(q[0], c / 2, W - c / 2); q[1] = clamp(q[1], c / 2, H - c / 2); }
    } else {
      const hw = Math.min(s.w || 0, W) / 2, hh = Math.min(s.h || 0, H) / 2;
      s.x = clamp(s.x, hw, W - hw); s.y = clamp(s.y, hh, H - hh);
    }
  }
  function changed(s){
    if (s){
      keepOnPlate(s);
      alignFine(s);
      s._flat = null;                       // the curve may have moved
      s._span = null;                       // and so may the corners
      const nb = reachBox(s), ob = s._bb || nb;
      s._buf = null;
      /* whatever this shape used to cover has to come back, and whatever it
         covers now has to go — so both footprints are invalidated */
      /* ── except a boundary, whose reach is the plate ─────────────────
         Two footprints is the right answer for a shape that only speaks
         about the ground under it. A boundary speaks about all of it, so
         moving one a tile changes what every shape on the plate is doing —
         the ones it has just let back in and the ones it has just put
         outside — and both of those can be a long way from either
         footprint. There is nothing to intersect against, so nothing is:
         every buffer goes. */
      const all = isRadial(s);
      for (const t of G.shapes){
        if (t === s || !t._buf) continue;
        if (all){ t._buf = null; continue; }
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
  const takes = (o, s) => {
    const k = Kinds.by[o.kind];
    if (!k) return true;
    /* A modifier takes no ground from anything, ever. Occlusion is how a
       cell is made not to exist, and a demolish area that occluded would be
       a delete tool wearing the wrong name — the terrain under it has to
       survive, roads included, or none of the rest of it means anything. */
    if (k.modifies) return false;
    return !k.clears || k.clears.indexOf(s.kind) >= 0;
  };

  /* A kind says `true` to run into everything else that connects, or names
     the kinds it runs into and nothing else. Both halves have to agree, so
     naming is how a kind steps out of the arrangement without leaving it:
     a wall no longer runs into another wall, because it can fill what it
     takes and is better off occluding, but it still runs into glazing,
     which cannot. */
  const joins = (k, kind) => k.connects === true ||
    (Array.isArray(k.connects) && k.connects.indexOf(kind) >= 0);

  function connects(a, b){
    const ka = Kinds.by[a.kind], kb = Kinds.by[b.kind];
    return !!(ka && kb && joins(ka, b.kind) && joins(kb, a.kind));
  }

  function rebuild(){
    if (!R || R.lost || !G.A) return;
    const order = G.shapes.filter(s => vis[layerOf(s)] && !hidden(s))
      .sort((a, b) => zOf(a) - zOf(b) || a.id - b.id);
    const box = order.map(s => reachBox(s));
    /* what has been knocked through, and out of which shapes — hung on the
       shape so the generators can see it without being handed a second list */
    const cuts = order.filter(x => (Kinds.by[x.kind] || {}).clears);
    for (let i = 0; i < order.length; i++){
      const s = order[i], k = Kinds.by[s.kind];
      const mine = k && !k.clears
        ? cuts.filter(c => Kinds.by[c.kind].clears.indexOf(s.kind) >= 0 &&
                           bbHit(box[i], reachBox(c)))
        : [];
      const had = s._cut ? s._cut.length : 0;
      if (mine.length || had) s._buf = null;     // the hole may have moved
      s._cut = mine.length ? mine : null;
    }
    /* ── what has been demolished, and over which shapes ──────────────────
       The parallel of the cut list above, and deliberately not the same
       thing. A cut names the kinds it takes ground from; a demolish area
       names nothing, because there is nothing it cannot weather — roads
       included, and roads are the case that had to be checked, since a road
       reaches this loop through scan() like every other kind and takes the
       modifiers off the shape the same way. And it is matched by bbox rather
       than by z, because what it acts on is whatever it lies over, not what
       happens to be drawn beneath it.

       Cache invalidation is the whole difficulty, and it is answered in two
       halves. The geometric half is already done: changed() clears the
       buffer of every shape whose reach meets the moved shape's OLD or NEW
       footprint, and a demolish area is a shape like any other to that loop,
       so a drag invalidates both what it has left and what it has arrived
       over. What changed() never sees is a rebuild it was not the cause of —
       hiding the layer this area sits on drops it out of `order` entirely,
       and every shape it was weathering would keep its ruined buffer for
       ever. So the set that was in force last time is remembered, and a
       shape whose set has changed at all gives its buffer up.

       Remembered as a key rather than by the "any cut at all" test the block
       above uses, because that test rebuilds its subjects on every single
       rebuild — which is right for a wall gap and ruinous for this, where
       one area covers a district and a rebuild runs on every frame of every
       drag. The key is exact: order is stable, so a swap of one area for
       another shows up even though the count did not move. */
    const mods = order.filter(isMod);
    const modOf = new Array(order.length);
    for (let i = 0; i < order.length; i++){
      const s = order[i];
      /* ── and a boundary reaches everything ───────────────────────────
         The bbox test is right for a demolish area, whose whole statement
         is inside its own footprint. It is exactly wrong for a boundary,
         because half of what a boundary says is about ground it is nowhere
         near: a stand of trees off past the rim is not outside the tool's
         influence, it is outside the map, and the tool has to be asked
         about it to say so. So a radial modifier is gathered against every
         shape and answers for the ones it does not touch as well. */
      /* and only what was there before it: a modifier weathers the shapes
         older than itself and leaves what is laid over it afterwards
         standing — a house planted on demolished ground is a house, not
         rubble (found 2026-08-29, when the founding's patch ate its own
         house). Hand use reads the same: you demolish what is there. */
      const m = (!mods.length || isMod(s)) ? null
        : mods.filter(x => x.id > s.id && (isRadial(x) || bbHit(box[i], reachBox(x))));
      modOf[i] = m && m.length ? m : null;
      const key = modOf[i] ? modOf[i].map(x => x.id).join(',') : '';
      if (key !== (s._modKey || '')) s._buf = null;
      s._modKey = key;
    }
    let n = 0;
    for (let i = 0; i < order.length; i++){
      const s = order[i];
      if (!s._buf){
        /* Everything drawn after this one takes the ground from it — unless
           it is picky. A kind that declares `clears` takes ground from those
           kinds and from nothing else, which is what lets a demolisher pass
           straight through a room and remove only its walls. */
        const occ = [];
        for (let j = i + 1; j < order.length; j++)
          if (bbHit(box[i], box[j]) && !connects(s, order[j]) && takes(order[j], s))
            occ.push(order[j]);
        s._buf = Kinds.build(s, cellSize(), occ, modOf[i]);
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
    /* Whatever has been demolished. A cut is not a kind that stamps anything
       of its own — it is a hole in what a blocker is allowed to block, which
       is the only way to take a wall out of the walk grid without also
       taking out the bed standing next to it. Stamping something walkable
       over the top would open the bed too.

       `cuts` and not `clears`: a door also clears walls, but a door is a way
       through and lays its own walkable ground. Only the demolisher is
       purely subtractive. */
    const cuts = G.shapes.filter(x => (Kinds.by[x.kind] || {}).cuts);
    for (const k of order)
      for (const s of G.shapes){
        if (s.kind !== k.id) continue;
        if (k.cuts) continue;                       // a cut lays nothing down
        if (minimal && k.layer === 'fixt') continue; // not drawn, so not in the way
        /* Nor does a modifier, and for a sharper reason: a demolish area
           over a road has to leave that road walkable. Blocking would make
           the ruin a wall, opening it would make it a bridge over the water
           it was dragged across, and both are it deciding something it was
           never asked about. It says nothing here at all. */
        if (k.modifies) continue;
        const cut = cuts.filter(c => Kinds.by[c.kind].clears.indexOf(k.id) >= 0);
        /* A route thinner than a walk tile would stamp a dotted line of
           walkable tiles, so a band stamps by distance with half a tile of
           tolerance. An area-shaped route is already wider than that, and
           the same tolerance on one would lay a walkable ring right through
           the wall around it — so it stamps exactly what it covers. */
        tiles(s, t, i => {
          if (cut.length && demolished(cut, i, t)) return;
          if (k.walk === 0){ t.walk[i] = 0; t.path[i] = 0; }
          else { t.walk[i] = 1; if (k.walk === 2) t.path[i] = 1; }
        }, k.walk === 2 && banded(s) ? t.tsz * (k.walkTol || 0.62) : 0);
      }
  }
  /* is this tile inside something that has been knocked through? */
  function demolished(cut, i, t){
    const tx = i % t.tw, ty = (i / t.tw) | 0;
    const cx = (tx + 0.5) * t.tsz, cy = (ty + 0.5) * t.tsz;
    for (const c of cut) if (Kinds.geo.inside(c, cx, cy)) return true;
    return false;
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
  const AQUA = [0.47, 0.88, 0.85];
  /* one mark per lattice cell the cut covers, thinned out rather than
     truncated once there are more of them than are worth drawing */
  function hatch(a, m, s, isSel){
    const c = cellSize(), b = Kinds.geo.bbox(s);
    const nx = Math.round((b[2] - b[0]) / c), ny = Math.round((b[3] - b[1]) / c);
    let step = 1;
    while (Math.ceil(nx / step) * Math.ceil(ny / step) > 420) step++;
    const r = Math.max(1.1 / G.cam[2], c * 0.16);
    for (let iy = 0; iy < ny; iy += step)
      for (let ix = 0; ix < nx; ix += step){
        const x = b[0] + (ix + 0.5) * c, y = b[1] + (iy + 0.5) * c;
        /* the wedge a dragged corner cut off is marked too: it is taken
           outright rather than weathered, and a tool that quietly takes
           ground it does not mark is the one thing this overlay exists to
           stop */
        if (!Kinds.geo.inside(s, x, y) && !Kinds.geo.lost(s, x, y)) continue;
        m = put(a, m, x, y, AQUA[0], AQUA[1], AQUA[2], isSel ? 0.5 : 0.28, r, 0, 0, 0, 1);
      }
    return m;
  }
  const rotpt = (s, lx, ly) => {
    const c = Math.cos(s.rot || 0), sn = Math.sin(s.rot || 0);
    return {x: s.x + lx * c - ly * sn, y: s.y + lx * sn + ly * c};
  };
  const SCALE = ['nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'];
  const CORNERS = ['nw', 'ne', 'se', 'sw'];
  /* ── four corners you can take hold of one at a time ───────────────────
     Only the demolisher, and only while it is a rect. Everything else on
     the plate is a thing — a park, a room, a stand of trees — and a thing
     described by a centre and a size is a thing you can nudge, line up and
     resize predictably; free corners would trade all of that away for a
     freedom nobody wanted there. A demolisher is not a thing, it is a
     statement about what lies under it, and the ground it is eating into
     does not run along the axes. So the freedom goes exactly where it pays
     and nowhere else.

     Ovals and lines keep their own grips: a quad is corners, and neither of
     those is described by any.

     A boundary is left out for a different reason than a park is. It is
     not a thing either, but what it is eating into runs all the way round
     it, so there is no wedge for a dragged corner to declare: the rim IS
     the statement, and a rim you can pull out of square is one you can no
     longer read the ramp against. */
  const freeCorner = s => !!s && isMod(s) && !isRadial(s) && s.type === 'rect';
  /* ── the fall, as one thing you point at ───────────────────────────────
     Which way the damage falls and how hard were a rotate grip and a
     slider, which is two controls for one gesture and neither of them the
     gesture: you do not think "turn it a quarter and set it to 70", you
     think "hold that corner and let the rest go".

     So the marker. It sits on the side being KEPT, its distance from the
     middle is how completely the opposite side gives way, and the middle
     itself is no direction at all — which is `even`, and the same value
     the slider has always written. The slider still works, on the same
     number: it slides the marker along whatever line it is already on.

     Only on a modifier, because Fall is the only thing reading it, and a
     grip in the middle of a park that did nothing would be worse than no
     grip at all.

     And not on a boundary, because there is no side for the marker to sit
     on: the side it would be kept is the middle, and the middle is where
     it is kept already. Core is that number, said from the right end. */
  const aimable = s => !!s && isMod(s) && !isRadial(s) && s.type !== 'line';
  /* the marker's world position: normalised in the shape's own square, so
     it holds its meaning when the shape is resized or turned */
  /* Drawn at 85% of the way out, so full strength is a marker pressed
     against the side rather than one buried under the corner grip that
     lives there — the last sixth of the shape is left to the grips that
     change its shape. */
  const AIMR = 0.85;
  function aimAt(s){
    const A = s.aim || [-1, 0];
    return rotpt(s, A[0] * s.w / 2 * AIMR, A[1] * s.h / 2 * AIMR);
  }
  /* Born from w/h the first time a corner is taken hold of, so a demolisher
     is a plain rect until you make it something else — and every one saved
     before this existed is still a plain rect on the way back in. */
  const ensureQuad = s => {
    if (!s.quad) s.quad = Kinds.geo.corners(s).map(q => [q[0], q[1]]);
    return s.quad;
  };
  /* The quad is the truth and w/h are its shadow (see kinds.js), so every
     edit ends here: re-centre the corners on the shape's own origin, move
     the origin by as much in the world, and restate w/h as the extent. Skip
     it and the rotate grip turns the area about a point that is no longer
     inside it, and the size slider reads a size nothing has. */
  function normQuad(s){
    const q = s.quad;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of q){
      x0 = Math.min(x0, c[0]); y0 = Math.min(y0, c[1]);
      x1 = Math.max(x1, c[0]); y1 = Math.max(y1, c[1]);
    }
    const dx = (x0 + x1) / 2, dy = (y0 + y1) / 2;
    for (const c of q){ c[0] -= dx; c[1] -= dy; }
    const co = Math.cos(s.rot || 0), si = Math.sin(s.rot || 0);
    s.x += dx * co - dy * si;
    s.y += dx * si + dy * co;
    s.w = Math.max(cellSize(), x1 - x0);
    s.h = Math.max(cellSize(), y1 - y0);
  }
  /* Every grip says what it does: corners scale, edge grips stretch one way,
     and the one standing off the top edge turns the shape. */
  /* where a segment's curve actually passes at the halfway mark: the point
     the bend grip sits on and the point you drag to move it */
  const bendAt = (s, i) => Kinds.geo.along(s, i, 0.5);
  /* a stream's mid-segment grip is not a bow, it is a point waiting to be
     put down: take hold of it and a new point is born there and comes with
     you, and the whole run bends through it. As many as you like. */
  const isStream = s => !!(Kinds.by[s.kind] || {}).smooth && s.type === 'line';
  function handles(s){
    if (isPrint(s)) return [];
    if (s.type === 'warp' && s.blob){
      /* every point is a grip, and the middle of every leg is a point
         waiting to be born — the same gesture as a stream, wrapped */
      const out = s.blob.map((q, i) => Object.assign(rotpt(s, q[0], q[1]), {tag: 'p' + i, kind: 'point'}));
      for (let i = 0; i < s.blob.length; i++){
        const m = Kinds.geo.blobAt(s, i, 0.5);
        out.push(Object.assign(rotpt(s, m[0], m[1]), {tag: 'a' + i, kind: 'bend'}));
      }
      return out;
    }
    if (s.type === 'line'){
      /* The anchors are still SHOWN — an end you cannot see is an end you
         will keep trying to grab — they are simply not targets. What happens
         if you try is that the pointer goes straight past them into the body
         and the whole river moves, which is the one thing moving an end was
         never meant to mean. */
      const lock = anchored(s), last = s.pts.length - 1;
      const out = s.pts.map((p, i) => ({x: p[0], y: p[1], tag: 'p' + i,
        kind: lock && (i === 0 || i === last) ? 'anchor' : 'point'}));
      const add = isStream(s);
      for (let i = 0; i < s.pts.length - 1; i++){
        const m = bendAt(s, i);
        out.push({x: m[0], y: m[1], tag: (add ? 'a' : 'b') + i, kind: 'bend'});
      }
      return out;
    }
    if (s.type === 'ring') return [{x: s.x + s.r, y: s.y, tag: 'rad', kind: 'corner'}];
    const hw = s.w / 2, hh = s.h / 2, out = [];
    const aim = () => { if (aimable(s)) out.push(Object.assign(aimAt(s), {tag: 'aim', kind: 'aim'})); };
    if (s.quad){
      /* the grips leave the bounding box and go where the shape actually
         is: a corner grip standing off the corner it moves is a grip you
         aim at rather than point at */
      const q = s.quad;
      CORNERS.forEach((tag, i) => out.push(Object.assign(rotpt(s, q[i][0], q[i][1]),
                                                         {tag, kind: 'corner'})));
      /* an edge grip carries the two corners of its own edge, so a side
         still moves as a side once the shape is no longer a rect */
      [[0, 1, 'n'], [1, 2, 'e'], [2, 3, 's'], [3, 0, 'w']].forEach(([a, b, tag]) =>
        out.push(Object.assign(rotpt(s, (q[a][0] + q[b][0]) / 2, (q[a][1] + q[b][1]) / 2),
                               {tag, kind: 'edge'})));
      const top = [(q[0][0] + q[1][0]) / 2, (q[0][1] + q[1][1]) / 2];
      out.push(Object.assign(rotpt(s, top[0], top[1] - grid() * 1.4),
                             {tag: 'rot', kind: 'rotate'}));
      aim();
      return out;
    }
    for (const [lx, ly, tag] of [[-hw, -hh, 'nw'], [hw, -hh, 'ne'], [hw, hh, 'se'], [-hw, hh, 'sw']])
      out.push(Object.assign(rotpt(s, lx, ly), {tag, kind: 'corner'}));
    for (const [lx, ly, tag] of [[0, -hh, 'n'], [hw, 0, 'e'], [0, hh, 's'], [-hw, 0, 'w']])
      out.push(Object.assign(rotpt(s, lx, ly), {tag, kind: 'edge'}));
    out.push(Object.assign(rotpt(s, 0, -hh - grid() * 1.4), {tag: 'rot', kind: 'rotate'}));
    aim();
    return out;
  }
  function overlay(a, m, cap){
    if (!on) return m;
    if (band){
      const px = 1 / G.cam[2], r = Math.max(2 * px, cellSize() * 0.16);
      const c = cellSize();
      let x0 = Math.min(band.x0, band.x1), x1 = Math.max(band.x0, band.x1);
      let y0 = Math.min(band.y0, band.y1), y1 = Math.max(band.y0, band.y1);
      if (band.shape !== 'line'){
        if (x1 - x0 < c) x1 = x0 + c;
        if (y1 - y0 < c) y1 = y0 + c;
      }
      const n = 40;
      for (let j = 0; j <= n; j++){
        const t = j / n;
        for (const [px2, py2] of [[x0 + (x1 - x0) * t, y0], [x0 + (x1 - x0) * t, y1],
                                  [x0, y0 + (y1 - y0) * t], [x1, y0 + (y1 - y0) * t]]){
          if (m > cap - 2) return m;
          m = put(a, m, px2, py2, 1, 0.373, 0.635, 0.9, r, 0, 0, 0, 1);
        }
      }
    }
    /* ── the edge of the plate ─────────────────────────────────────────
       The plate is the map: the walk grid stops at its edge, and so does
       everything you draw (see keepOnPlate). The window is wider than
       the plate, and the margin beside it looks like more map — so the
       edge is drawn, faintly, whenever you are building on the town. */
    if (G.W && G.H && Kinds.scope() === 'map'){
      const px = 1 / G.cam[2], r = Math.max(1.5 * px, cellSize() * 0.12), n = 70;
      for (let j = 0; j <= n; j++){
        const t = j / n;
        for (const [qx, qy] of [[G.W * t, 0], [G.W * t, G.H], [0, G.H * t], [G.W, G.H * t]]){
          if (m > cap - 2) return m;
          m = put(a, m, qx, qy, IDLE[0], IDLE[1], IDLE[2], 0.55, r, 0, 0, 0, 1);
        }
      }
    }
    for (const s of G.shapes){
      /* room for the worst shape in one go: a rect's four sides, the core
         ring a boundary draws inside them, and the grips on top */
      if (m > cap - 400) break;
      if (!editable(s) && s !== sel) continue;      // only the layer you are working on
      m = outline(a, m, s, s === sel);
    }
    return m;
  }
  function outline(a, m, s, isSel){
    const px = 1 / G.cam[2];
    /* A demolisher draws nothing of its own — that is the whole idea — so
       its outline is the only evidence it exists, and an outline alone says
       where it is without saying what it takes. Every cell it covers gets a
       mark, so what you are looking at is the diamonds that will go. */
    /* The demolish area is the same case as the wall gap and gets the same
       treatment: it puts no diamonds of its own on the plate, so a mark on
       every cell it covers is the only way to see what it has hold of. */
    const bare = (!!isGap(s) || isMod(s)) && s.type !== 'line';
    /* a road nothing can walk to is drawn in gold: the network is what
       carries the walker, and a road that has not joined it is scenery
       until it does. Said in the frame, where you are looking, rather
       than only in the panel. */
    const col = bare ? AQUA : (isSel ? FLARE : (stranded(s) ? [1, 0.76, 0.31] : IDLE));
    const al = isSel ? 0.85 : (bare ? 0.5 : 0.3);
    /* ── but a boundary does not hatch, and must not ────────────────────
       The mark on every covered cell means "this is what will go", which
       is true of a demolish area and the exact opposite of true here: what
       a boundary covers is what it is KEEPING. Hatching it would put an
       aqua dot on the whole town to say the town is safe, which is the
       overlay lying in the one direction it exists to prevent — and it
       would do it across the entire plate, since that is the size these
       are born at. The rim and the core ring are the honest evidence: what
       goes is outside them, and outside them there is nothing left to
       mark. */
    if (bare && !isRadial(s)) m = hatch(a, m, s, isSel);
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
    } else if (s.quad){
      const P = s.quad.map(c => rotpt(s, c[0], c[1]));
      for (let i = 0, j = 3; i < 4; j = i++)
        for (let k = 0; k <= N; k++){
          const t = k / N;
          dot(P[j].x + (P[i].x - P[j].x) * t, P[j].y + (P[i].y - P[j].y) * t);
        }
    } else {
      const x0 = s.x - s.w / 2, x1 = s.x + s.w / 2, y0 = s.y - s.h / 2, y1 = s.y + s.h / 2;
      for (let j = 0; j <= N; j++){
        const t = j / N;
        dot(x0 + (x1 - x0) * t, y0); dot(x0 + (x1 - x0) * t, y1);
        dot(x0, y0 + (y1 - y0) * t); dot(x1, y0 + (y1 - y0) * t);
      }
    }
    /* ── a boundary has two outlines, and only one of them is its edge ───
       The rim is where the town has finished going. The core is where it
       has not started, and between them is the entire tool — so a boundary
       showing only its rim is showing you the half you can already infer
       from the diamonds that survived, and hiding the half you are
       actually setting.

       Drawn dimmer than the rim and on the same aqua, because it is the
       same statement further in rather than a second thing: the ground is
       untouched up to here, and gone by the line outside it. It goes at
       Core exactly, not at the 85% the fall marker sits at — this one is a
       reading rather than a grip, and a reading that is nearly right is
       worse than none. */
    if (isRadial(s) && s.core > 0 && s.type !== 'line'){
      const cw = s.w / 2 * s.core, ch = s.h / 2 * s.core;
      const cdot = (lx, ly) => {
        const p = rotpt(s, lx, ly);
        m = put(a, m, p.x, p.y, AQUA[0], AQUA[1], AQUA[2], al * 0.4,
                r * 0.8, 0, 0, 0, 1);
      };
      if (s.type === 'ellipse'){
        for (let j = 0; j < N; j++){
          const th = j / N * 6.283185307;
          cdot(Math.cos(th) * cw, Math.sin(th) * ch);
        }
      } else {
        for (let j = 0; j <= N / 2; j++){
          const t = j / (N / 2), lx = -cw + cw * 2 * t, ly = -ch + ch * 2 * t;
          cdot(lx, -ch); cdot(lx, ch); cdot(-cw, ly); cdot(cw, ly);
        }
      }
    }
    if (isSel){
      const GOLD = [1, 0.76, 0.31], BONE = [0.93, 0.92, 0.89];
      const big = Math.max(7 * px, grid() * 0.3);
      for (const h of handles(s)){
        if (h.kind === 'rotate'){
          /* a stalk, so the turn grip reads as attached rather than floating */
          const top = s.quad
            ? rotpt(s, (s.quad[0][0] + s.quad[1][0]) / 2, (s.quad[0][1] + s.quad[1][1]) / 2)
            : rotpt(s, 0, -s.h / 2);
          for (let i = 1; i <= 4; i++)
            m = put(a, m, top.x + (h.x - top.x) * i / 5, top.y + (h.y - top.y) * i / 5,
                    GOLD[0], GOLD[1], GOLD[2], 0.45,
                    Math.max(1.6 * px, grid() * 0.06), 0, 0, 0, 1);
          m = put(a, m, h.x, h.y, GOLD[0], GOLD[1], GOLD[2], 1, big * 1.2, 1, 0, 0, 1);
        } else if (h.kind === 'aim'){
          /* The fall drawn as what it is: the marker on the side being
             kept, and a run of dots going the way the ground gives way,
             brightening as it goes because that is what the ground does.
             At `even` there is no direction to draw, so there is only the
             marker, sitting in the middle where it says so. */
          const A = s.aim || [-1, 0];
          if (Math.hypot(A[0], A[1]) > 1e-3){
            const far = rotpt(s, -A[0] * s.w / 2 * AIMR, -A[1] * s.h / 2 * AIMR);
            for (const t of [0.3, 0.52, 0.74, 0.96])
              m = put(a, m, h.x + (far.x - h.x) * t, h.y + (far.y - h.y) * t,
                      AQUA[0], AQUA[1], AQUA[2], 0.2 + t * 0.5,
                      Math.max(1.6 * px, grid() * 0.07), 0, 0, 0, 1);
          }
          m = put(a, m, h.x, h.y, AQUA[0], AQUA[1], AQUA[2], 1, big * 0.95, 0, 0, 0, 1);
        } else if (h.kind === 'bend'){
          m = put(a, m, h.x, h.y, AQUA[0], AQUA[1], AQUA[2], 0.95, big * 0.85, 1, 0, 0, 1);
        } else if (h.kind === 'edge' || h.kind === 'anchor'){
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
  /* A room is hollow, so `near` would only find it by its wall band — which
     is a quarter-tile ribbon you would have to hunt for. While the plan is
     what you are editing the whole room is the handle, because the room is
     the thing you are moving. */
  /* the topmost plan shape under the pointer that is not the one already
     selected — a door or a gap, never a room */
  function planAt(p, not){
    for (let i = G.shapes.length - 1; i >= 0; i--){
      const s = G.shapes[i];
      if (s === not || s.label || !editable(s)) continue;
      if (near(s, p, GRAB())) return s;
    }
    return null;
  }

  function grabbable(s, p){
    if (mode !== 'rooms' || !s.label) return near(s, p, GRAB());
    const b = Kinds.geo.bbox(s), t = GRAB();
    return p[0] >= b[0] - t && p[0] <= b[2] + t && p[1] >= b[1] - t && p[1] <= b[3] + t;
  }

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
      if (!on || e.button !== 0) return;
      /* Some tools are dropped and some are drawn. A demolisher is drawn:
         what it is FOR is a stretch, and a stretch is two corners. */
      if (armed && armed.band){
        const q = toWorld(e);
        /* Snapped as it is taken, not as it is released, so what is drawn
           under the pointer is what will be made. A preview that rounds
           differently from the thing it previews is a preview that lies, and
           "I cannot put it exactly where I want" is what that feels like. */
        band = {kind: armed.kind, shape: armed.shape || 'rect',
                x0: snapK(q[0]), y0: snapK(q[1]), x1: snapK(q[0]), y1: snapK(q[1])};
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      if (armed){
        /* the click the chip was waiting for: build it here */
        const a = armed;
        armed = null;
        document.body.classList.remove('arming');
        const q = toWorld(e);
        create(a.kind, a.type, q[0], q[1]);
        hstep();
        return;
      }
      /* handles are small things to hit at low zoom; give them a target a
         pointer can actually land on */
      const p = toWorld(e), hr = 20 / G.cam[2];
      /* A marker is pinned to a spot, not to a layer, so it answers the
         pointer wherever it sits and whatever you are working on. */
      if (Markers.armed()){ Markers.place(p[0], p[1]); Markers.disarm(); syncUI(); return; }
      /* on the region a town's diamonds can be taken and put where the
         town is; the drop pins every plate in it (src/region.js) */
      if (typeof Region !== 'undefined' && Region.on() && Region.grab(p[0], p[1])){
        drag = {mode: 'town'}; sel = null; return;
      }
      const mk = Markers.hit(p[0], p[1], GRAB() * 1.5);
      if (mk){
        Markers.select(mk); sel = null;
        drag = {mode: 'marker', mk};
        canvas.setPointerCapture(e.pointerId);
        syncUI(); return;
      }
      Markers.select(null);
      /* A door and a room's edge grip live in the same place — on the wall —
         so one of them has to yield. The ROOM yields: a door is the smaller
         and more specific thing, and the grips keep the rest of the wall and
         all four corners. But only the room yields. A gap's own grips sit on
         its own edges, and letting the body win there means a cut you can
         move and never resize, which is most of the way to useless. */
      const other = mode === 'rooms' ? planAt(p, sel) : null;
      if (sel && editable(sel) && !(other && sel.label)){
        if (e.shiftKey && sel.type === 'line' && near(sel, p, GRAB())){
          addPoint(sel, p); return;
        }
        /* The NEAREST grip, not the first one listed. The radius is
           generous on purpose — a grip is a few pixels of diamond and the
           pointer should not have to be exact — but on a small shape that
           radius holds two or three of them at once, and taking whichever
           came first in the list meant the fall marker could not be picked
           up at all beside the edge grip it sits in from. Nearest is what
           the pointer was aiming at, whatever order they were built in. */
        let best = null, bd = hr;
        for (const h of handles(sel)){
          if (h.kind === 'anchor') continue;      // shown, never taken
          const d = Math.hypot(h.x - p[0], h.y - p[1]);
          if (d < bd){ bd = d; best = h; }
        }
        if (best){
          let tag = best.tag;
          if (tag.charAt(0) === 'a'){
            /* born under the grip, then dragged as the point it now is */
            const i = +tag.slice(1);
            if (sel.type === 'warp'){
              const l = Kinds.geo.local(sel, best.x, best.y);
              sel.blob.splice(i + 1, 0, [l[0], l[1]]);
            } else {
              sel.pts.splice(i + 1, 0, [snapC(best.x), snapC(best.y)]);
              if (sel.ctrl) sel.ctrl.splice(i, 1, null, null);
            }
            changed(sel);
            tag = 'p' + (i + 1);
          }
          drag = {mode: tag, s: sel, ox: p[0], oy: p[1], w0: sel.w, h0: sel.h};
          canvas.setPointerCapture(e.pointerId);
          return;
        }
      }
      if (other){
        sel = other;
        drag = {mode: 'move', s: other, ox: p[0], oy: p[1]};
        canvas.setPointerCapture(e.pointerId);
        syncUI();
        return;
      }
      let hit = null;
      for (let i = G.shapes.length - 1; i >= 0; i--){
        const s = G.shapes[i];
        if (editable(s) && grabbable(s, p)){ hit = s; break; }
      }
      sel = hit;
      if (hit){
        lastKind = hit.kind;
        drag = {mode: 'move', s: hit, ox: p[0], oy: p[1], w0: hit.w, h0: hit.h};
        canvas.setPointerCapture(e.pointerId);
      }
      syncUI();
    });

    addEventListener('pointermove', e => {
      if (band){ const q = toWorld(e); band.x1 = snapK(q[0]); band.y1 = snapK(q[1]); return; }
      if (!drag) return;
      const p = toWorld(e), s = drag.s, c = cellSize();
      /* Markers save themselves and never pass through save(), so without
         this the quiet timer armed at pointerdown was never re-armed: it
         fired mid-drag and one press of undo left the marker wherever it
         happened to be 450ms in. Every other drag re-arms through save(). */
      if (drag.mode === 'marker'){ Markers.moveTo(drag.mk, p[0], p[1]); htap(); return; }
      if (drag.mode === 'town'){ Region.dragTo(p[0], p[1]); return; }
      const q = quant(s);
      if (drag.mode === 'move'){
        const dx = snapQ(p[0] - drag.ox, q), dy = snapQ(p[1] - drag.oy, q);
        if (!dx && !dy) return;
        moveBy(s, dx, dy);
        if (s.label && mode === 'rooms') carry(s, dx, dy);
        drag.ox += dx; drag.oy += dy;
      } else if (drag.mode === 'rot'){
        /* free rotation, held to 15° so a district still lines up with
           something. The pattern turns with the shape; with Mask on, the
           shape turns over a pattern that stays where it is. */
        const step = Math.PI / 12;
        s.rot = Math.round((Math.atan2(p[1] - s.y, p[0] - s.x) + Math.PI / 2) / step) * step;
      } else if (drag.mode === 'aim'){
        /* Where the marker is put IS the fall: the direction is wherever it
           sits from the middle, and how far out it sits is how completely
           the far side gives way. Not snapped — this is an intensity, and
           the grid has nothing to say about it.

           `fall` is kept in step as the length of the same vector, because
           it is what the slider shows and what a save carries. Two writers,
           one value: whichever you reach for, the other follows. */
        const l = Kinds.geo.local(s, p[0], p[1]);
        let ax = l[0] / Math.max(s.w / 2 * AIMR, 1e-6);
        let ay = l[1] / Math.max(s.h / 2 * AIMR, 1e-6);
        const L = Math.hypot(ax, ay);
        if (L > 1){ ax /= L; ay /= L; }
        s.aim = [ax, ay];
        s.fall = Math.min(1, L);
        syncTune();
      } else if (drag.mode === 'rad'){
        s.r = snapR(Math.hypot(p[0] - s.x, p[1] - s.y));
      } else if (freeCorner(s) && SCALE.indexOf(drag.mode) >= 0){
        /* ── a corner on its own ─────────────────────────────────────────
           The stretch below holds the far EDGE still, which is the right
           answer for a rect and has nothing to say here: on a quad the two
           corners of an edge are not tied to each other, and holding one of
           them still is the whole point. So a corner grip moves that corner
           and nothing else, and an edge grip moves the two corners of its
           edge — which is the old stretch, said in the only way a quad can
           say it.

           Worked in the shape's own frame, so a turned demolisher is still
           dragged along its own sides; snapped to the same quantum every
           other edit uses, so corners keep landing on the grid the cells
           are on. */
        const qd = ensureQuad(s);
        const l = Kinds.geo.local(s, p[0], p[1]);
        const lx = snapQ(l[0], q), ly = snapQ(l[1], q);
        const tag = drag.mode, i = CORNERS.indexOf(tag);
        if (i >= 0){ qd[i][0] = lx; qd[i][1] = ly; }
        else {
          const pair = tag === 'n' ? [0, 1] : tag === 's' ? [2, 3]
                     : tag === 'w' ? [3, 0] : [1, 2];
          const horiz = tag === 'e' || tag === 'w';
          for (const j of pair) qd[j][horiz ? 0 : 1] = horiz ? lx : ly;
        }
        normQuad(s);
      } else if (SCALE.indexOf(drag.mode) >= 0){
        /* ── stretch from the side you took hold of ──────────────────────
           The far side stays where it is and the two sides joining them
           follow. Resizing about the centre — which is what this did — means
           every drag moves the whole shape, so lining a wall up with the one
           opposite is a drag, a look, a drag back and a look again. Holding
           the far edge still is what makes a room something you can nudge
           into place rather than negotiate with.

           Worked in the shape's own frame so a turned shape stretches along
           its own axes, and the centre is then moved by that offset rotated
           back into the world — the anchor is an edge, not a point, and an
           edge only stays put if the centre moves with the size. */
        const l = Kinds.geo.local(s, p[0], p[1]);
        const tag = drag.mode;
        const hw = s.w / 2, hh = s.h / 2;
        let x0 = -hw, x1 = hw, y0 = -hh, y1 = hh;
        if (tag.indexOf('e') >= 0) x1 = l[0];
        if (tag.indexOf('w') >= 0) x0 = l[0];
        if (tag.indexOf('n') >= 0) y0 = l[1];
        if (tag.indexOf('s') >= 0) y1 = l[1];
        let nw = clamp(snapQS(Math.abs(x1 - x0), q), q, MAXSPAN());
        let nh = clamp(snapQS(Math.abs(y1 - y0), q), q, MAXSPAN());
        /* a landmark lands only on whole multiples of its glyph; an edge
           grip on one therefore sizes both axes, since the far edge of the
           other axis is the one that would otherwise be left slack */
        const gs = glyphSnap(s, nw, nh);
        if (gs){ nw = gs.w; nh = gs.h; }
        /* the size has been snapped, so the moving edge is put back at
           whatever that size makes it — the fixed one is never recomputed */
        if (tag.indexOf('e') >= 0) x1 = x0 + nw; else if (tag.indexOf('w') >= 0) x0 = x1 - nw;
        if (tag.indexOf('s') >= 0) y1 = y0 + nh; else if (tag.indexOf('n') >= 0) y0 = y1 - nh;
        const dx = (x0 + x1) / 2, dy = (y0 + y1) / 2;
        const co = Math.cos(s.rot || 0), si = Math.sin(s.rot || 0);
        s.x += dx * co - dy * si;
        s.y += dx * si + dy * co;
        s.w = nw; s.h = nh;
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
      } else if (s.type === 'warp' && s.blob){
        /* in the shape's own frame, held to the cell grid like a corner */
        const l = Kinds.geo.local(s, p[0], p[1]), c = cellSize();
        s.blob[+drag.mode.slice(1)] = [Math.round(l[0] / c) * c, Math.round(l[1] / c) * c];
        normBlob(s);
      } else {
        s.pts[+drag.mode.slice(1)] = [snapC(p[0]), snapC(p[1])];
      }
      changed(s);
    });

    addEventListener('pointerup', e => {
      if (band){
        const b = band;
        band = null; armed = null;
        document.body.classList.remove('arming');
        const c = cellSize();
        /* the corners as dragged, in the order the geometry wants them */
        let x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1);
        let y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1);
        if (b.shape === 'line'){
          /* A door runs ALONG the wall it opens, so the drag's long axis is
             the door and its short axis is only which wall you meant. */
          const w = x1 - x0, h = y1 - y0;
          const along = Math.max(w, h, grid());
          const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
          const pts = w >= h ? [[cx - along / 2, cy], [cx + along / 2, cy]]
                             : [[cx, cy - along / 2], [cx, cy + along / 2]];
          const s2 = make({kind: b.kind, type: 'line', pts, exact: true,
                           width: c * 2, variant: 'swing'});
          if (s2){ sel = s2; changed(s2); }
        } else {
          /* a hole has to be at least one cell across to be a hole */
          if (x1 - x0 < c) x1 = x0 + c;
          if (y1 - y0 < c) y1 = y0 + c;
          const s2 = make({kind: b.kind, type: 'rect', exact: true,
                           x: (x0 + x1) / 2, y: (y0 + y1) / 2,
                           w: x1 - x0, h: y1 - y0});
          if (s2){ sel = s2; changed(s2); }
        }
        syncUI();
        hstep();
        return;
      }
      if (drag){
        const s = drag.s, w0 = drag.w0, h0 = drag.h0, was = drag.mode;
        drag = null;
        if (was === 'town'){ Region.drop(); syncUI(); return; }
        /* On release, not on every move: laying a room's contents again is
           the expensive half, and watching furniture flicker through every
           intermediate size is worse than seeing it settle once.

           And only when the size actually changed. A room that was moved
           brought its contents with it, and a room that was merely clicked
           has had nothing done to it at all — re-laying either is destroying
           work to no purpose. */
        if (s && s.label && mode === 'rooms' && typeof Palace !== 'undefined' &&
            (s.w !== w0 || s.h !== h0)) Palace.refit(s);
        /* the whole drag is one step, however many frames it wrote */
        hstep();
        return;
      }
      if (!armed) return;
      const over = document.elementFromPoint(e.clientX, e.clientY) === canvas;
      /* Dragged onto the map: build it where it was dropped. Released
         without travelling — a click on the chip — and it stays armed:
         nothing is built until you click the map, and it lands where you
         click. Building it in front of the camera on a click was the one
         place in this editor something appeared where you had not
         pointed, and then had to be moved. Escape disarms. */
      if (!over) return;
      const a = armed;
      armed = null;
      document.body.classList.remove('arming');
      const p = toWorld(e); create(a.kind, a.type, p[0], p[1]);
      hstep();
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
        /* a deletion is the edit people reach for undo after, so it lands
           on the stack now rather than when the room goes quiet */
        hstep();
      }
      else if (e.code === 'KeyC'){
        const mk = Markers.selected();
        if (mk){ Markers.cycleTint(mk); syncUI(); }
      }
      else if (e.code === 'Escape' && armed){
        armed = null;
        document.body.classList.remove('arming');
        syncUI();
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
      '<div class="plabel">Edit</div><div id="kmode" class="chips two"></div>' +
      '<div class="plabel roomonly">Walls</div>' +
      '<div class="kfoot roomonly"><button class="btn" id="kdoor">Door</button>' +
      '<button class="btn" id="kgap">Remove wall</button></div>' +
      '<div class="knote roomonly">drag along a wall for a door, or a rectangle ' +
      'across one to take it out &middot; either can be selected and deleted</div>' +
      /* ── the two tools that are not on a layer ────────────────────────
         Both are modifiers: they draw nothing, and what they do reaches
         every layer whatever their own is listed as. Under Roads they read
         as road tools and are only in front of you a quarter of the time,
         which is wrong for the demolisher and much worse for the boundary,
         since a boundary is the last thing you reach for and it is about
         the whole town rather than about any layer of it. So they sit
         above the layer rows, outside them, and stay there whatever you
         are working on — and Modify is the third verb this editor has,
         beside placing a thing and shaping it. */
      '<div class="plabel fitonly" id="kmodlabel">Modify</div>' +
      '<div id="kmods" class="kgrid fitonly"></div>' +
      '<div class="knote fitonly" id="kmodnote">a boundary lands as the plate &middot; ' +
      'pull it in to where the town stops &middot; clear takes the terrain under it and nothing built</div>' +
      '<div class="plabel fitonly">Layer</div><div id="klayers" class="fitonly"></div>' +
      '<div class="plabel fitonly">Place</div><div id="kkinds" class="kgrid fitonly"></div>' +
      /* the patterns: on the structures layer for the same reason the
         buildings are, but for looks rather than for living in */
      '<div class="plabel fitonly" id="kpatlabel">Patterns &middot; aesthetics</div>' +
      '<div id="kpats" class="kgrid fitonly"></div>' +
      /* the asset picker sits right under the chips that arm it, so what
         you are about to place is chosen before the plate is clicked */
      '<div class="plabel fitonly" id="kvarlabel">Type</div>' +
      '<div id="kvariants" class="kgrid fitonly"></div>' +
      '<div class="plabel fitonly">Shape</div><div id="kshapes" class="kgrid fitonly"></div>' +
      '<div class="plabel fitonly" id="ktonelabel">Tone</div>' +
      '<div id="ktones" class="kgrid fitonly"></div>' +
      '<div class="knote fitonly" id="kstrand" hidden>this road is not joined to the ' +
      'network &middot; nothing can walk it until it meets a road the walker can reach</div>' +
      '<div class="plabel fitonly">Adjust</div><div id="ktune" class="fitonly"></div>' +
      '<div class="kfoot fitonly"><button class="btn" id="kmask">Mask</button>' +
      '<button class="btn" id="kclearlayer">Clear layer</button></div>' +
      /* Only ever shown with an anchored line selected, because it is the
         one control here that is about a single shape rather than about what
         you are placing next — and a button carrying its own state as its
         label is how the two heading cycles already read. */
      '<div class="kfoot one fitonly" id="kendsrow" hidden>' +
      '<button class="btn" id="kends">Ends anchored</button></div>' +
      '<div class="plabel fitonly" id="kmlabel">Markers</div>' +
      '<div id="kmarkers" class="fitonly"></div>' +
      '<input id="kmname" class="fitonly" type="text" spellcheck="false" ' +
      'placeholder="name this place" hidden>' +
      /* which item of the plate's letter this palace is (src/quest.js) */
      '<select id="kmitem" class="fitonly" hidden></select>' +
      /* History belongs to neither edit layer, because a mistake made while
         the plan was being moved is undone from wherever you happen to be
         standing when you notice it. */
      '<div class="plabel">History</div>' +
      '<div class="kfoot"><button class="btn" id="kundo">Undo</button>' +
      '<button class="btn" id="ksave">Save point</button></div>' +
      '<div class="kfoot one"><button class="btn" id="krevert">Revert</button></div>' +
      /* The heading is a town-level thing rather than a layer's, so it sits
         with History rather than under either edit layer — and both controls
         say what they are showing, because a cycle you cannot read the state
         of is a button that seems to do nothing on the presses that land on
         a treatment resembling the last one. */
      '<div class="plabel">Heading</div>' +
      '<div class="kfoot"><button class="btn" id="ktreat">Solid</button>' +
      '<button class="btn" id="kborder">No border</button></div>' +
      /* The two sliders belong here rather than under Adjust for the reason
         the buttons above them do: what they set is the one heading in
         force, not the shape you are about to place — and here they are
         reachable while the plan is being moved as well as while it is
         being fitted out, which is when a title is most often being
         looked at. */
      '<div id="khtune"></div>' +
      '<div class="knote" id="khnote"></div>' +
      /* which letter of the focused acronym this plate is (src/quest.js) */
      '<div class="plabel" id="kletterlab" hidden>Letter</div>' +
      '<select id="kletter" hidden></select>' +
      '<div class="kfoot one"><button class="btn" id="kclear">Clear all</button></div>' +
      '<div class="kstate" id="kstate"></div>' +
      '<div class="knote" id="kstat"></div>';

    for (const [id, label] of [['rooms', 'Rooms'], ['fit', 'Fit-out']]){
      const c = document.createElement('div');
      c.className = 'chip'; c.textContent = label; c.dataset.mode = id;
      c.onclick = () => setMode(id);
      $('#kmode').appendChild(c);
    }
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
         [['size', 'Width', 1, 60, 1], ['mult', 'Size ×', 10, 40, 5], ['feather', 'Feather', 0, 14, 1],
          ['bright', 'Bright', 40, 220, 5], ['grain', 'Grain', 1, 4, 1],
          ['scale', 'Scale', 40, 200, 5], ['jitter', 'Jitter', 0, 150, 5],
          ['scatter', 'Scatter', 0, 100, 5], ['fall', 'Fall', 0, 100, 5],
          /* beside Fall, because they are the same question asked by the
             two modifiers — which ground is being kept — and only ever one
             of them is on screen */
          ['core', 'Core', 0, 95, 5],
          ['out', 'Out', 0, 100, 5], ['pad', 'Clear', 0, 60, 5],
          ['padFade', 'Fade', 0, 80, 5], ['padBreak', 'Break', 0, 100, 5]])
      $('#ktune').appendChild(slider(key, label, min, max, step));
    /* The same factory, the same two ranges the plate's own Bright and
       Jitter use, so the heading is turned up in the units everything else
       is turned up in. `h` on the key is what keeps them out of the shape
       branches in applySlider and syncTune. */
    for (const [key, label, min, max, step] of
         [['hbright', 'Bright', 40, 220, 5], ['hjitter', 'Jitter', 0, 150, 5],
          /* the font's own: ranges are read back off Title.tune in
             syncHead, so these are placeholders the first sync replaces */
          ['hdetail', 'Size', 4, 30, 1], ['hweight', 'Weight', 50, 200, 5],
          ['htone', 'Tone', 0, 100, 5], ['hdither', 'Dither', 0, 100, 5],
          ['hmat', 'Mat', 0, 100, 5], ['hfeather', 'Feather', 0, 24, 1],
          ['hshade', 'Shade', 0, 70, 5]])
      $('#khtune').appendChild(slider(key, label, min, max, step));
    $('#kends').onclick = () => {
      if (!anchorable(sel)) return;
      freeSel = freeSel === sel ? null : sel;
      syncUI();
    };
    $('#kmask').onclick = () => {
      if (sel){ sel.mask = !sel.mask; defs.mask = sel.mask; changed(sel); }
      else { defs.mask = !defs.mask; syncUI(); }
    };
    const arm = (kind, shape) => {
      armed = {kind, band: true, shape};
      document.body.classList.add('arming');
      syncUI();
    };
    const gp = $('#kgap');
    if (gp) gp.onclick = () => arm('gap', 'rect');
    const dr = $('#kdoor');
    if (dr) dr.onclick = () => arm('door', 'line');
    $('#kclear').onclick = () => {
      if (!G.shapes.length) return;
      G.shapes.length = 0; sel = null; changed();
      hstep();
    };
    $('#kclearlayer').onclick = () => {
      const keep = G.shapes.filter(s => layerOf(s) !== layer);
      if (keep.length === G.shapes.length) return;
      G.shapes = keep; sel = null; changed();
      hstep();
    };
    /* ── the two sizes of second thought ───────────────────────────────────
       Undo walks back a gesture at a time; Revert goes the whole way to the
       restore point and says so before it does, because that is the press
       there is no coming back from once the session ends. Both leave the
       drawing to history.js: it writes storage and has this read it back,
       which is what keeps the plate and the profile saying the same thing. */
    const hb = (id, fn) => {
      const b = $(id);
      if (b) b.onclick = () => { const h = hist(); if (h) fn(h); };
    };
    hb('#kundo', h => h.undo());
    hb('#ksave', h => h.point());
    hb('#krevert', h => h.revert());
    const cyc = (sel, fn) => { const b = $(sel); if (b) b.onclick = () => {
      if (typeof Palace !== 'undefined' && Palace[fn]) Palace[fn]();
      syncHead();
    }; };
    cyc('#ktreat', 'cycleTreatment');
    cyc('#kborder', 'cycleBorder');
    /* The face lives in the Town/Palace panel under the name, because the
       name and the face it is set in are one decision made in one place;
       the treatment, border and sliders stay here with the rest of the
       dress. The field is static markup rather than the palette's, so
       this rewires the same element on every reui — harmless. On `change`
       rather than `input`: every distinct value typed is a stylesheet
       fetched from Google, and a family typed a letter at a time is a
       dozen fetches for names that do not exist. */
    const kf = $('#kfont');
    if (kf){
      if (!kf.options.length && typeof Title !== 'undefined'){
        for (const f of Title.fonts){
          const o = document.createElement('option'); o.value = f; o.textContent = f;
          kf.appendChild(o);
        }
        const o = document.createElement('option'); o.value = ''; o.textContent = 'The diamond type';
        kf.appendChild(o);
      }
      kf.onchange = () => { if (typeof Palace !== 'undefined') Palace.setFont(kf.value); syncHead(); kf.blur(); };
      kf.onkeydown = e => e.stopPropagation();
    }
    syncHead();
    /* a marker with a name is a place you can be told you are standing
       outside of, and be told you are inside once you are */
    const nm = $('#kmname');
    /* typing a name never reaches syncUI — the field would fight the caret
       for it — so history is nudged here instead, and a name typed a letter
       at a time comes back as the one word it was */
    nm.oninput = () => {
      const mk = Markers.selected();
      if (mk){ Markers.rename(mk, nm.value); htap(); }
    };
    nm.onkeydown = e => { e.stopPropagation(); if (e.code === 'Enter') nm.blur(); };
    /* the field at the head of the route names whatever the route belongs
       to — the town out here, the palace in there */
    const tn = $('#kname');
    if (tn){
      tn.oninput = () => { if (typeof Palace !== 'undefined') Palace.rename(tn.value); };
      tn.onkeydown = e => { e.stopPropagation(); if (e.code === 'Enter') tn.blur(); };
    }
    Markers.ui();
    if (typeof Quest !== 'undefined') Quest.wire();
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
    /* a range fires `input` all the way along the drag and `change` when the
       thumb is let go, which is the gesture ending said out loud */
    /* A shape's sliders have nothing to commit here — `changed()` already
       saved the drawing on every frame. The heading's have: they are held
       in memory while the thumb moves and written once when it stops, so a
       drag is one localStorage write rather than one per frame. */
    inp.onchange = () => {
      if (typeof Palace !== 'undefined' && Palace.storeHeading &&
          key.charAt(0) === 'h') Palace.storeHeading();
      hstep();
    };
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
    /* The heading's two go to Palace and stop there. They deliberately do
       not touch `defs`: that object means "what the next shape you place is
       born with", and a slider that meant one thing with a shape selected,
       a second with none and a heading's dress as well would be three
       controls sharing one label. Nothing needs rebuilding either — the
       title is drawn into the entity stream every frame. */
    if (key === 'hbright' || key === 'hjitter'){
      if (typeof Palace === 'undefined') return;
      if (key === 'hbright') Palace.setBright(v / 100);
      else Palace.setJitter(v / 100);
      return syncHead();
    }
    /* the font's four: whole cells for Detail, hundredths for the rest */
    if (key.charAt(0) === 'h'){
      if (typeof Palace === 'undefined' || !Palace.setTune) return;
      const k = key.slice(1);
      Palace.setTune(k, (k === 'detail' || k === 'feather') ? v : v / 100);
      return syncHead();
    }
    /* a print's size: whole multiples of its own pixels, never a stretch */
    if (key === 'mult'){
      /* the slider counts tenths; the size is whole and half multiples */
      const m = Math.max(1, Math.round(v / 10 * 2) / 2);
      if (sel && isPrint(sel)){ sel.mult = m; glyphSize(sel, Kinds.by[sel.kind]); changed(sel); }
      else defs.mult = m;
      syncUI(); return;
    }
    if (key === 'feather') return set('feather', v);
    if (key === 'bright')  return set('bright', v / 100);
    if (key === 'grain')   return set('grain', v);
    if (key === 'scale')   return set('scale', v / 100);
    if (key === 'jitter')  return set('jitter', v / 100);
    if (key === 'scatter') return set('scatter', v / 100);
    if (key === 'fall'){
      /* the slider is the marker's distance from the middle, so moving it
         moves the marker rather than meaning something beside it */
      if (sel && aimable(sel)){
        const A = sel.aim, L = A ? Math.hypot(A[0], A[1]) : 0;
        const nx = L > 1e-6 ? A[0] / L : -1, ny = L > 1e-6 ? A[1] / L : 0;
        sel.aim = [nx * (v / 100), ny * (v / 100)];
      }
      return set('fall', v / 100);
    }
    if (key === 'core')    return set('core', v / 100);
    if (key === 'out')     return set('out', v / 100);
    if (key === 'pad')     return set('pad', v / 10);
    if (key === 'padFade')  return set('padFade', v / 10);
    if (key === 'padBreak') return set('padBreak', v / 100);
    if (!sel) return;
    if (banded(sel)) sel.width = snapW(v * cellSize());
    else {
      const ratio = sel.h / Math.max(sel.w, 1);
      const w0 = sel.w, h0 = sel.h;
      sel.w = clamp(snapS(v * grid()), grid(), MAXSPAN());
      sel.h = clamp(snapS(sel.w * ratio), grid(), MAXSPAN());
      const gs = glyphSnap(sel, sel.w, sel.h);
      if (gs){ sel.w = gs.w; sel.h = gs.h; }
      /* the quad IS the shape, so a size that moved without it would be a
         size the shape does not have — scale the corners by the same two
         factors and w/h stay the shadow they are meant to be */
      if (sel.quad || sel.blob){
        const fx = sel.w / Math.max(w0, 1), fy = sel.h / Math.max(h0, 1);
        for (const c of (sel.quad || sel.blob)){ c[0] *= fx; c[1] *= fy; }
      }
    }
    changed(sel);
  }

  /* ── a glyph, drawn as what it will become ─────────────────────────────
     The chip for a landmark is the building itself, at the pitch the
     palette has room for, made of the same diamonds the plate will make it
     of. Drawn rather than written because sixty words are not sixty
     buildings — and drawn out of diamonds rather than shown as the source
     PNG, because a chip that previewed the sheet would be promising a
     material the plate does not use.

     One canvas each, painted once when the palette is built. Sixteen
     squared elements per glyph across sixty-odd glyphs is a hundred and
     seventy thousand DOM nodes and a palette that hitches every time you
     change layers; a canvas is one node and one paint.

     Colour is read off the stylesheet rather than written here. The ten
     tokens live in `:root` and nowhere else, and that stays true of the
     script as well as of the CSS. */
  const ink = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function paintGlyph(cv, name, on){
    const rows = typeof Glyphs === 'undefined' ? null : Glyphs.rows(name);
    if (!rows) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    /* Four across inside the palette's 214px, less its padding, its border,
       each chip's own — and the 6px the vertical scrollbar takes, which is
       always there because sixty-six buildings never fit. Miss any of those
       and the fourth column is clipped into a horizontal scrollbar under the
       picker, which is a worse trade than a slightly smaller glyph. */
    const S = 34;
    cv.width = S * dpr; cv.height = S * dpr;
    cv.style.width = cv.style.height = S + 'px';
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, S, S);
    const N = rows.length, M = rows[0].length;
    const p = S / Math.max(N, M);
    const ox = (S - M * p) / 2, oy = (S - N * p) / 2;
    /* selection is inversion everywhere else in this game, so the selected
       glyph is the ground drawn on bone rather than a tinted version of
       itself — the chip becomes a hole punched in the palette */
    g.fillStyle = on ? ink('--ground') : ink('--bone');
    const r = p * 0.62;                    // the same fat diamond type.js uses
    for (let y = 0; y < N; y++)
      for (let x = 0; x < M; x++){
        if (rows[y][x] !== '1') continue;
        const cx = ox + (x + 0.5) * p, cy = oy + (y + 0.5) * p;
        g.beginPath();
        g.moveTo(cx, cy - r); g.lineTo(cx + r, cy);
        g.lineTo(cx, cy + r); g.lineTo(cx - r, cy);
        g.closePath(); g.fill();
      }
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
    const list = variantsOf(k);
    box.hidden = !list; lab.hidden = !list;
    box.innerHTML = '';
    if (!list) return;
    const glyph = !!(k && k.glyphs);
    box.classList.toggle('kgl', glyph);
    if (lab) lab.textContent = glyph ? 'Asset' : 'Variant';
    const current = sel && sel.kind === id ? sel.variant : (defs.variant[id] || list[0]);
    for (const v of list){
      const c = document.createElement('div');
      const on = current === v;
      c.className = (glyph ? 'gchip' : 'kchip') + (on ? ' sel' : '');
      if (glyph){
        c.title = v;
        const cv = document.createElement('canvas');
        c.appendChild(cv);
        paintGlyph(cv, v, on);
      } else c.textContent = v;
      c.onclick = () => {
        defs.variant[id] = v;
        if (sel && sel.kind === id){ sel.variant = v; changed(sel); }
        else syncUI();
      };
      box.appendChild(c);
    }
    /* the one you are on, brought into view — a picker that scrolls sixty
       buildings is a picker you can lose your place in */
    const cur = box.querySelector('.sel');
    if (cur && glyph) cur.scrollIntoView({block: 'nearest'});
  }

  /* ── the tone a print is built in ───────────────────────────────────
     Same shape as the variant row and for the same shape you are working
     with: the selection, or the last kind reached for. Only a print has
     one — the district textures take their colour from the kind — so the
     row takes itself down for anything else. */
  function syncTones(){
    const box = $('#ktones'), lab = $('#ktonelabel');
    if (!box) return;
    const id = sel ? sel.kind : lastKind;
    const k = id ? Kinds.by[id] : null;
    const show = !!(k && k.glyphs && Kinds.tones);
    box.hidden = !show; if (lab) lab.hidden = !show;
    box.innerHTML = '';
    if (!show) return;
    const current = sel && sel.kind === id ? (sel.tone || 'stone') : (defs.tone[id] || 'stone');
    for (const t of Kinds.tones){
      const c = document.createElement('div');
      c.className = 'kchip' + (t.id === current ? ' sel' : '');
      const hex = t.wall.map(v => ('0' + Math.round(v * 255).toString(16)).slice(-2)).join('');
      c.innerHTML = '<i style="background:#' + hex + '"></i>' + t.label;
      c.onclick = () => {
        defs.tone[id] = t.id;
        if (sel && sel.kind === id){ sel.tone = t.id; changed(sel); }
        else syncUI();
      };
      box.appendChild(c);
    }
  }

  function syncTune(){
    const c = cellSize();
    /* ── Fall and Core are one slot seen from two tools ─────────────────
       They answer the same question — which ground is being kept — and a
       shape only ever has one of them, so only one is ever up. Feather
       goes with Fall for the same reason: on a boundary the rim is the
       bite rather than the thing the bite is kept off, and a slider that
       does nothing to what you have selected is worse than one that is not
       there, because you spend a drag finding out.

       Only ever hidden against a SELECTION. With nothing selected these
       rows are writing the defaults the next shape is born with, and the
       next shape could be anything. */
    const rad = !!sel && isRadial(sel);
    document.querySelectorAll('#ktune .prow').forEach(r => {
      const key = r.dataset.key, lab = r.querySelector('label');
      if (key === 'core') r.hidden = !rad;
      else if (key === 'fall' || key === 'feather') r.hidden = rad;
      else if (key === 'size') r.hidden = isPrint(sel);   // a print has one size — in whole multiples, below
      else if (key === 'mult') r.hidden = !isPrint(sel);
      if (key === 'core'){
        const v = sel ? (sel.core === undefined ? defs.core : sel.core) : defs.core;
        r._set(Math.round(v * 100), v ? Math.round(v * 100) + '%' : 'from the middle',
               true, 0, 95);
      } else if (key === 'feather'){
        const v = sel ? (sel.feather || 0) : defs.feather;
        r._set(v, v ? v + (v === 1 ? ' cell' : ' cells') : 'hard', true);
      } else if (key === 'bright'){
        const b = sel ? (sel.bright || 1) : defs.bright;
        r._set(Math.round(b * 100), b.toFixed(2) + '\u00d7', true);
      } else if (key === 'mult'){
        const v = sel ? Math.max(1, Math.round((sel.mult || 1) * 2) / 2) : (defs.mult || 1);
        /* 'fine' when the glyph has detail to show at this size */
        const fine = !!(sel && v >= 1.5 && typeof Glyphs !== 'undefined' && Glyphs.detail && Glyphs.detail(sel.variant));
        r._set(Math.round(v * 10), v + '\u00d7' + (fine ? ' fine' : ''), true, 10, 40);
      } else if (key === 'grain'){
        const v = sel ? (sel.grain || 1) : defs.grain;
        r._set(v, v === 1 ? 'full' : '1/' + v, true, 1, 4);
      } else if (key === 'scale'){
        const v = sel ? (sel.scale || 1) : defs.scale;
        r._set(Math.round(v * 100), v.toFixed(2) + '\u00d7', true, 40, 200);
      } else if (key === 'jitter'){
        const v = sel ? (sel.jitter || 0) : defs.jitter;
        r._set(Math.round(v * 100), v ? v.toFixed(2) + ' cell' : 'none', true, 0, 150);
      } else if (key === 'scatter'){
        const v = sel ? (sel.scatter || 0) : defs.scatter;
        r._set(Math.round(v * 100), v ? Math.round(v * 100) + '%' : 'solid', true, 0, 100);
      } else if (key === 'fall'){
        const v = sel ? (sel.fall || 0) : defs.fall;
        r._set(Math.round(v * 100), v ? Math.round(v * 100) + '%' : 'even', true, 0, 100);
      } else if (key === 'out'){
        const v = sel ? (sel.out || 0) : defs.out;
        r._set(Math.round(v * 100), v ? Math.round(v * 100) + '%' : 'none', true, 0, 100);
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
    /* Inverted while the ends are FREE, because inversion means armed
       everywhere else in this palette and free is the state that is doing
       something you would want to be reminded of. */
    const er = $('#kendsrow'), eb = $('#kends');
    if (er) er.hidden = !anchorable(sel);
    if (eb && anchorable(sel)){
      const free = !anchored(sel);
      eb.textContent = free ? 'Ends free' : 'Ends anchored';
      eb.classList.toggle('sel', free);
    }
  }

  /* one chip, wherever it is going to hang — the two rows differ in what
     they hold and in nothing else */
  function kindChip(p, k){
    const c = document.createElement('div');
    c.className = 'kchip';
    c.innerHTML = '<i style="background:' + k.swatch + '"></i>' + p.label;
    c.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      armed = {kind: p.kind, type: p.type};
      lastKind = p.kind;
      document.body.classList.add('arming');
      syncUI();
      /* a print: the picker is brought into view so the asset is chosen
         before the plate is clicked */
      if (k.glyphs){ const b = $('#kvariants'); if (b && !b.hidden) b.scrollIntoView({block: 'nearest'}); }
    });
    return c;
  }

  /* the kind chips belong to the active layer, so the palette only ever
     shows what you can actually place right now — and the modifiers belong
     to none of them, so they are pulled out and hung above the layer rows
     where they are always in reach. Both rows are filled from the one
     palette in the one pass, so a kind is listed once and lands wherever
     `modifies` says it lands.

     The floor registry has no modifiers at all — a wall gap is a cut, and
     it is a button rather than a chip — so indoors the row would be an
     empty heading, and it takes itself down. */
  function syncKinds(){
    const box = $('#kkinds'), mbox = $('#kmods'), pbox = $('#kpats');
    if (!box) return;
    box.innerHTML = '';
    if (mbox) mbox.innerHTML = '';
    if (pbox) pbox.innerHTML = '';
    for (const p of Kinds.palette){
      const k = Kinds.by[p.kind];
      if (!k) continue;
      if (k.modifies || k.tool){ if (mbox) mbox.appendChild(kindChip(p, k)); continue; }
      if (k.layer !== layer) continue;
      if (k.aesthetic && pbox){ pbox.appendChild(kindChip(p, k)); continue; }
      box.appendChild(kindChip(p, k));
    }
    const nopat = !pbox || !pbox.childElementCount;
    for (const id of ['#kpatlabel', '#kpats']){ const el = $(id); if (el) el.hidden = nopat; }
    const none = !mbox || !mbox.childElementCount;
    for (const id of ['#kmodlabel', '#kmods', '#kmodnote']){
      const el = $(id);
      if (el) el.hidden = none;
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
    /* the head names the place, not the list: the panel is where the
       place is named and dressed, and the list under it is what that
       place holds */
    lab.textContent = inside ? 'Palace' : 'Town';
    const nm = $('#kname');
    if (nm && typeof Palace !== 'undefined'){
      nm.placeholder = inside ? 'name this palace' : 'name this town';
      if (document.activeElement !== nm) nm.value = Palace.named();
    }
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

  /* The two heading buttons carry their own state as their label — there is
     no room in the palette for a name and a value, and a cycle whose current
     setting you cannot read is the thing that makes a treatment look broken
     when it happens to resemble the one before it. Names come from Type's own
     tables through Palace, so adding a treatment there adds it here. */
  function syncHead(){
    if (typeof Palace === 'undefined' || !Palace.heading) return;
    const h = Palace.heading(), tb = $('#ktreat'), bb = $('#kborder');
    const cap = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
    if (tb) tb.textContent = cap(h.treatment);
    if (bb) bb.textContent = h.border === 'none' ? 'No border' : cap(h.border);
    /* not while it is being typed in — the field would fight the caret */
    const kf = $('#kfont');
    if (kf){
      /* a family set by hand in storage that is not on the shelf still
         has to be shown as what is in force, so it is given a row */
      if (h.font && ![...kf.options].some(o => o.value === h.font)){
        const o = document.createElement('option'); o.value = h.font; o.textContent = h.font;
        kf.insertBefore(o, kf.lastElementChild);
      }
      kf.value = h.font || '';
      kf.classList.toggle('off', h.fontState === 'failed');
    }
    /* Read in the same words the Adjust rows use for the same two things,
       and the ranges come from Palace rather than from a second copy of
       them here, so the clamp that guards a stored value and the ends of
       the slider that sets it can never drift apart. */
    document.querySelectorAll('#khtune .prow').forEach(r => {
      const key = r.dataset.key;
      if (key === 'hbright'){
        const g = h.brightRange;
        r._set(Math.round(h.bright * 100), h.bright.toFixed(2) + '\u00d7', true,
               Math.round(g[0] * 100), Math.round(g[1] * 100));
      } else if (key === 'hjitter'){
        const g = h.jitterRange;
        r._set(Math.round(h.jitter * 100),
               h.jitter ? h.jitter.toFixed(2) + ' pix' : 'none', true,
               Math.round(g[0] * 100), Math.round(g[1] * 100));
      } else if (typeof Title !== 'undefined' && h.tune){
        /* live only while a font is in force: the diamond type has none
           of these, and a slider that moved nothing would be a dead one */
        const k = key.slice(1), rg = Title.tune[k], v = h.tune[k];
        if (!rg || v === undefined) return;
        const live = !!h.font;
        if (k === 'detail') r._set(v, v + ' / letter', live, rg.lo, rg.hi);
        else if (k === 'feather') r._set(v, v ? Math.round(v / rg.hi * 100) + '% in' : 'hard', live, rg.lo, rg.hi);
        else r._set(Math.round(v * 100),
                    k === 'weight' ? v.toFixed(2) + '\u00d7'
                    : (v ? v.toFixed(2) : 'none'),
                    live, Math.round(rg.lo * 100), Math.round(rg.hi * 100));
      }
    });
  }

  function syncUI(){
    /* Markers save themselves, so a marker placed, renamed, recoloured or
       reordered never passes through save() above — but every one of them
       ends here. Nudging history from the one place they all reach is what
       makes the undo stack cover the markers as well as the shapes. */
    htap();
    const h0 = hist();
    if (h0) h0.sync();
    if (!$('#palette') || !$('#kmode')) return;
    document.querySelectorAll('#kmode .chip').forEach(c =>
      c.classList.toggle('sel', c.dataset.mode === mode));
    const gp2 = $('#kgap'), dr2 = $('#kdoor');
    if (gp2) gp2.classList.toggle('sel', !!(armed && armed.band && armed.kind === 'gap'));
    if (dr2) dr2.classList.toggle('sel', !!(armed && armed.band && armed.kind === 'door'));
    document.body.classList.toggle('rooms', mode === 'rooms');
    if (mode === 'rooms'){
      const st0 = $('#kstate');
      const rooms = G.shapes.filter(x => x.label).length;
      if (st0) st0.innerHTML = !rooms
        ? 'no rooms yet · <b>O</b> types a list and lays one out'
        : (sel ? (sel.label
                    ? '<b>drag</b> the room · <b>corners</b> resize · the fit-out follows it'
                    : sel.kind === 'door'
                      ? '<b>door</b> · drag to move · <b>ends</b> stretch it · <b>del</b> removes it'
                      : '<b>wall gap</b> · ' + cellsOf(sel) + ' · grips resize it by the cell · ' +
                        '<b>[ ]</b> trims · <b>del</b> removes it')
               : '<b>' + rooms + ' rooms</b> · click one to move or resize it');
      /* A palace is laid out sealed, so how much of it the walker can
         actually get to is the number worth showing — otherwise "nothing
         happens when I walk into the next room" is a mystery instead of a
         list of doors still to cut. */
      const el0 = $('#kstat');
      const j = joined();
      if (el0) el0.textContent = !j || !j.total ? 'the furniture refits · fit-out is locked'
        : j.n >= j.total ? j.total + ' rooms · all joined'
        : j.n + ' of ' + j.total + ' rooms joined · add doors to reach the rest';
      if (el0) el0.classList.toggle('warn', !!(j && j.total && j.n < j.total));
      syncRoute();
      return;
    }
    if (!$('#klayers')) return;
    document.querySelectorAll('#klayers .krow').forEach(r => {
      r.classList.toggle('sel', r.dataset.layer === layer);
      r.classList.toggle('off', !vis[r.dataset.layer]);
    });
    syncKinds();
    syncVariants();
    syncTones();
    syncStrand();
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
    if (typeof Quest !== 'undefined'){ Quest.syncItem(mkSel); Quest.syncLetter(); }
    const st = $('#kstate');
    if (st){
      const mk = mkSel;
      if (mk)
        st.innerHTML = '<b>marker</b> · drag to move · <b>C</b> colour · ' +
          '<b>Enter</b> goes inside · <b>del</b> removes';
      else if (!sel)
        st.innerHTML = 'nothing selected · click a shape, or drag one out of Place';
      else if (sel.type === 'line' && anchored(sel))
        st.innerHTML = '<b>one line</b> · <b>shift-click</b> adds a point · ' +
          '<b>◇ aqua</b> bends the segment · <b>ends anchored</b> · drag the body to ' +
          'move the whole river';
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
      const first = Kinds.list.find(k => k.layer === id && variantsOf(k));
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
    /* Opening the builder is what "before we opened the builder" means, so
       that is the moment the restore point is stamped, without being asked
       for — see history.js. */
    const h = hist();
    if (h) h.opened(on);
    syncUI();
  }

  /* ── persistence ── */
  function save(){
    /* One save() serves both scopes, so the word has to follow the key or it
       tells you the town would not keep when you are standing in a plan. */
    const what = KEY === 'hq.shapes' ? 'the town' : 'this plan';
    try {
      Store.set(KEY, JSON.stringify(G.shapes.map(s => ({
        kind: s.kind, type: s.type, seed: s.seed, variant: s.variant, tone: s.tone || 'stone', rot: s.rot || 0,
        label: s.label || '', n: s.n || 0, room: s.room || 0,
        feather: s.feather, bright: s.bright, mask: s.mask,
        grain: s.grain, scale: s.scale, jitter: s.jitter, scatter: s.scatter, mult: s.mult || 1,
        fall: s.fall || 0, out: s.out || 0, quad: s.quad || null, blob: s.blob || null,
        core: s.core === undefined ? 0.35 : s.core,
        aim: s.aim ? [s.aim[0], s.aim[1]] : null,
        pad: s.pad, padFade: s.padFade, padBreak: s.padBreak,
        x: s.x, y: s.y, w: s.w, h: s.h, r: s.r, pts: s.pts, ctrl: s.ctrl, width: s.width
      }))));
      if (typeof hqStoreOK === 'function') hqStoreOK(what);
    } catch (e){ if (typeof hqStoreFail === 'function') hqStoreFail(what, e); }
    /* Storage is where history takes its snapshots from, so every write is
       worth a nudge — this is the catch-all under the handful of places
       that step outright, and it costs a timer being reset. */
    htap();
  }
  /* ── putting a state back from outside ─────────────────────────────────
     Undo and revert write storage and then have this read it, because that
     is the path a reload takes and the one that cannot leave storage and
     the screen disagreeing. Everything a fresh mount does except the two
     things that did not change: the registry is the same registry, and the
     layer and edit mode are where you left them, because being thrown back
     to Rooms and the first layer on every undo is its own small loss. */
  function reload(){
    sel = null; drag = null; armed = null; band = null; freeSel = null;
    document.body.classList.remove('arming');
    load();
    rebuild();
    if (typeof restampTerrain === 'function') restampTerrain();
    syncUI();
  }
  /* ── palaces built before a room owned its contents ────────────────────
     A plan whose shapes do not say which room they are in is a plan where
     moving a wall leaves the floor and the furniture standing where they
     were — which does not read as "the fit-out did not follow", it reads as
     the room coming apart at random, because how far it comes apart is how
     far you happened to drag.

     Ownership is recoverable from the drawing itself: a room is a labelled
     wall, and what is in it is whatever sits inside it. Only the kinds a
     refit would lay down again are claimed — a door is on the boundary
     between two rooms and belongs to neither, and claiming one would delete
     it the first time either side was resized. */
  function adopt(){
    const walls = G.shapes.filter(s => s.label);
    if (!walls.length || walls.every(w => w.room)) return false;
    walls.forEach((w, i) => { if (!w.room) w.room = w.n || i + 1; });
    const boxes = walls.map(w => Kinds.geo.bbox(w));
    const OWNED = {floor: 1, fixt: 1};
    for (const s of G.shapes){
      if (s.label || s.room) continue;
      if (!OWNED[layerOf(s)]) continue;
      const c = Kinds.geo.centre(s);
      for (let i = 0; i < walls.length; i++){
        const b = boxes[i];
        if (c[0] >= b[0] && c[0] <= b[2] && c[1] >= b[1] && c[1] <= b[3]){
          s.room = walls[i].room; break;
        }
      }
    }
    return true;
  }

  function load(){
    let raw = [];
    try { raw = JSON.parse(Store.get(KEY) || '[]'); } catch (e){}
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
          grain: s.grain || 1, scale: s.scale || 1, mult: s.mult || 1,
          jitter: s.jitter || 0, scatter: s.scatter || 0,
          /* absent on every shape saved before Fall existed, and 0 is what
             those were doing — so an old town comes back unchanged */
          fall: s.fall === undefined ? 0 : s.fall,
          out: s.out === undefined ? 0 : s.out,
          /* absent on everything saved before Boundary existed, and the
             kind's own default is what one of those would have been born
             with — nothing else reads it, so nothing else notices */
          core: s.core === undefined ? (k.core0 === undefined ? 0.35 : k.core0) : s.core,
          aim: (Array.isArray(s.aim) && s.aim.length === 2) ? [s.aim[0], s.aim[1]] : null,
          quad: (Array.isArray(s.quad) && s.quad.length === 4) ? s.quad.map(q => [q[0], q[1]]) : null,
          blob: (Array.isArray(s.blob) && s.blob.length >= 3) ? s.blob.map(q => [q[0], q[1]]) : null,
          pad: s.pad === undefined ? (k.pad0 || 0) : s.pad,
          padFade: s.padFade === undefined ? (k.padFade0 || 0) : s.padFade,
          padBreak: s.padBreak === undefined ? (k.padBreak0 || 0) : s.padBreak,
          r: Math.min(s.r || cellSize(), RMAX * cellSize()),
          label: s.label || '', n: s.n || 0, room: s.room || 0,
          variant: s.variant || firstVariant(k),
          tone: s.tone || 'stone'
        });
      });
    /* a cut drawn before cuts were held to the cell grid is corrected on
       the way in, rather than waiting for someone to nudge it */
    G.shapes.forEach(alignFine);
    for (const s of G.shapes) if (s.type === 'warp' && !s.blob) s.blob = blobFrom(s.w, s.h);
    if (adopt()) save();
  }

  /* how many rooms the walker can actually get to from where it stands */
  function joined(){
    if (!G.terr || !G.reach) return null;
    const t = G.terr, z = t.tsz;
    let n = 0, total = 0;
    for (const w of G.shapes){
      if (!w.label) continue;
      total++;
      const b = Kinds.geo.bbox(w);
      const x0 = Math.max(0, Math.floor(b[0] / z)), x1 = Math.min(t.tw - 1, Math.ceil(b[2] / z));
      const y0 = Math.max(0, Math.floor(b[1] / z)), y1 = Math.min(t.th - 1, Math.ceil(b[3] / z));
      let hit = false;
      for (let y = y0; y <= y1 && !hit; y++)
        for (let x = x0; x <= x1; x++) if (G.reach[y * t.tw + x]){ hit = true; break; }
      if (hit) n++;
    }
    return {n, total};
  }

  /* a cut is measured in the unit it is edited in */
  const cellsOf = s => {
    const c = cellSize(), b = Kinds.geo.bbox(s);
    return Math.round((b[2] - b[0]) / c) + '\u00d7' + Math.round((b[3] - b[1]) / c) + ' cells';
  };

  const startLayer = () => (Kinds.layers.find(L => L.start) || Kinds.layers[0]).id;

  /* ── mounting a different set of shapes ────────────────────────────────
     One call swaps what is being edited: the registry the palette is built
     from, and the key the shapes are saved under. Commit first — whatever
     was on screen belongs to the key it came from. */
  function mount(scope, key){
    Kinds.use(scope);
    KEY = key;
    minimal = false;
    seeVis();
    sel = null; drag = null; armed = null; lastKind = null; freeSel = null;
    document.body.classList.remove('arming');
    Markers.disarm();
    load();
    reui();
    rebuild();
    setLayer(startLayer());
    /* a plan with rooms in it opens on the plan, because that is the layer
       it was authored at; anything else opens on the tools */
    setMode(G.shapes.some(x => x.label) ? 'rooms' : 'fit');
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

  function setMode(v){
    mode = v === 'rooms' ? 'rooms' : 'fit';
    sel = null; armed = null;
    document.body.classList.toggle('rooms', mode === 'rooms');
    syncUI();
  }
  return {init, rebuild, stamp, overlay, setOn, mount, reload, lay, add, refill, setMode,
          mode: () => mode, active: () => on,
          /* a tool that is being aimed wants a grid fine enough to aim at */
          aiming: () => !!(band || (armed && armed.band)),
          sync: syncUI, head: syncHead,
          commit: save, key: () => KEY, count: () => G.shapes.length,
          setMinimal: v => { minimal = !!v; rebuild(); }, minimal: () => minimal};
})();
