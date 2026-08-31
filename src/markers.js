'use strict';
/* ── markers ────────────────────────────────────────────────────────────
   Not terrain. A marker is a note you pin to one spot on the map: this is
   the place. They sit outside the build layers, are always visible, and
   snap to the same tile grid the walker stands on.

   They are drawn as real glyphs, which the diamond shader cannot make on
   its own — so the set is baked once into a canvas sheet, uploaded as the
   one texture in the program, and each marker is an instance carrying the
   cell of that sheet to cut from (see mode 3 in render.js).

   Inside a palace a marker is not pinned anywhere it likes: it lands in one
   of the room's eight PLACES and wears the number that place is carrying
   (src/trace.js). What it keeps is `m.slot`, the place's ID — `room * 8 +
   square`, the geometry — and NOT the number, because the numbers move: turn
   a room or take a place out of an earlier one and every number after it
   shifts. `m.n` is read back off the place whenever the markers are
   renumbered. 0 means a marker with no place, which is every marker out on
   the town. */

const Markers = (() => {
  const WANT = ['☇', '❍', '▲', '〄', '⎋', '⚆', '☾',
                '⫫', '⇞', '⇬', '✦', '↬', '⏎', '➣',
                '⤲', '⇑', '⇯', '⇭', '⤊', '⟰', '≛',
                '✥'];
  /* Cut from the same sheet but never offered in the palette. The order a
     marker sits at is drawn beside it, and a room's name is drawn on it —
     a palace is its order and its rooms, and a plan where you cannot see
     either is a plan you cannot check. Digits first so a number is one
     lookup; the sheet is the only texture in the program either way. */
  const TEXT = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const SIZE = 64, COLS = 8;
  /* Which markers are being pinned is one string, the way the shapes are —
     the town's, or the ones inside a building. */
  let KEY = 'hq.markers';
  const TINT = [[0.47, 0.88, 0.85], [1, 0.76, 0.31], [1, 0.37, 0.64],
                [0.93, 0.92, 0.89], [0.65, 0.55, 0.98]];

  let glyphs = [], sel = null, armed = -1, nextId = 1, text0 = 0;

  /* Draw one glyph into a scratch cell and hand back its pixels, so a
     character the font cannot make — which comes back as tofu, not as
     nothing — can be recognised and dropped rather than shipped. */
  function render(ctx, g){
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillText(g, SIZE / 2, SIZE / 2);
    return ctx.getImageData(0, 0, SIZE, SIZE).data;
  }
  const identical = (a, b) => {
    if (a.length !== b.length) return false;
    for (let i = 3; i < a.length; i += 4) if (a[i] !== b[i]) return false;
    return true;
  };
  const blank = a => {
    let sum = 0;
    for (let i = 3; i < a.length; i += 4) sum += a[i];
    return sum < 2000;
  };

  function buildAtlas(){
    const probe = document.createElement('canvas');
    probe.width = probe.height = SIZE;
    const px = probe.getContext('2d', {willReadFrequently: true});
    px.font = '600 ' + Math.floor(SIZE * 0.7) + 'px "DejaVu Sans", "Noto Sans Symbols 2",' +
              ' "Noto Sans Symbols", "Segoe UI Symbol", ui-monospace, sans-serif';
    px.textAlign = 'center'; px.textBaseline = 'middle'; px.fillStyle = '#fff';

    const tofu = render(px, '\uE0FF');       // private use: whatever "missing" looks like
    const keep = [];
    for (const g of WANT){
      const bits = render(px, g);
      if (blank(bits) || identical(bits, tofu)) continue;
      keep.push(g);
    }
    glyphs = keep;
    /* the digits go on the end, so a marker's saved `gi` still means the
       glyph it always meant however many symbols the font dropped */
    text0 = keep.length;
    const cells = keep.concat(TEXT.split(''));

    const rows = Math.max(1, Math.ceil(cells.length / COLS));
    const c = document.createElement('canvas');
    c.width = COLS * SIZE; c.height = rows * SIZE;
    const x = c.getContext('2d');
    x.font = px.font;
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff';
    cells.forEach((g, i) => x.fillText(g, (i % COLS + 0.5) * SIZE,
                                       Math.floor(i / COLS) * SIZE + SIZE / 2));
    return {canvas: c, cols: COLS, rows};
  }

  /* ── model ── */
  const grid = () => (G.terr ? G.terr.tsz : (G.A ? G.A.cell : 8) * 4);  // build.js:47 is the other copy
  const snap = v => (Math.round(v / grid() - 0.5) + 0.5) * grid();

  /* A marker's place in the array is not an identity: delete one above it
     and everything below shifts. What hangs off a marker — the floor plan
     inside it — needs a name that survives that, so every marker carries
     one of its own, minted once and saved with it. */
  let uidN = 0;
  const mint = () => 'm' + (Date.now().toString(36)) + (uidN++).toString(36) +
                     Math.random().toString(36).slice(2, 5);

  function place(x, y){
    if (armed < 0 || armed >= glyphs.length) return null;
    /* nothing is built on the region: a town there is a plate, entered
       rather than drawn, and a marker on it would be a palace nowhere */
    if (typeof Region !== 'undefined' && Region.on()){
      if (typeof hqNote === 'function') hqNote('nothing is built on the region — a town is a plate of its own', false);
      return null;
    }
    /* a place costs blocks (src/stock.js) */
    /* Inside a palace a marker goes in a SLOT: a room carries eight of them
       round its edge and holds eight loci, no more (src/trace.js). Asked
       before the blocks are paid, because a place you cannot have is not a
       place you should be charged for. */
    let slot = 0;
    if (typeof Interior !== 'undefined' && Interior.inside() && typeof Trace !== 'undefined'){
      const s = Trace.drop(x, y);
      if (s && s.full){
        if (typeof hqNote === 'function') hqNote('eight places is a room — this one is full', false);
        return null;
      }
      if (s){ slot = s.id; x = s.x; y = s.y; }
    }
    if (typeof Stock !== 'undefined' && !Stock.pay('marker')) return null;
    const m = {id: nextId++, uid: mint(), name: '', gi: armed,
               x: slot ? x : snap(x), y: slot ? y : snap(y), slot: slot,
               size: grid() * 0.8, tint: 0, n: G.markers.length + 1};
    G.markers.push(m);
    sel = m;
    renumber();
    sel = m;
    save();
    return m;
  }
  function rename(m, s){ m.name = String(s || '').slice(0, 40); save(); }
  /* a marker put down by the game rather than the hand — the founding
     palace at a plate's address (src/found.js): first glyph, named, free */
  function plant(x, y, name){
    if (!glyphs.length) return null;
    const m = {id: nextId++, uid: mint(), name: String(name || '').slice(0, 40), gi: 0, x: snap(x), y: snap(y),
               size: grid() * 0.8, tint: 0, slot: 0, n: G.markers.length + 1};
    G.markers.push(m);
    renumber();
    save();
    return m;
  }
  /* which item of the plate's letter this palace is (src/quest.js):
     {id: letter id, item: index}, or nothing */
  function setItem(m, it){ if (it && it.id) m.item = {id: String(it.id), item: it.item | 0}; else delete m.item; save(); }

  /* ── order ──────────────────────────────────────────────────────────────
     A memory palace *is* its order: the loci have to be walked in the same
     sequence every time or the method does not work.

     Inside a palace the number is the SLOT — the place in the building, not
     a position in a list — so it is not inferred from where a marker sits
     and it is DENSE and continuous across the whole building: the rooms are
     walked in their order, each room's live places in theirs, and the count
     never skips. Take a place out of the first room and every number after
     it comes down by one, the next room included. Out on the town, where there are no slots, it stays what it always
     was: dense, 1-based, and yours to reorder by hand. */
  const ordered = () => (G.markers || []).slice().sort(
    (a, b) => (a.n || 0) - (b.n || 0) || a.id - b.id);
  function renumber(){
    /* A locus in a place wears the number that place is carrying TODAY —
       asked of the plan rather than remembered, because turning a room or
       taking a place out of an earlier one moves every number after it.
       The plan has to actually be mounted before it can be asked: entering
       a palace mounts the markers BEFORE the shapes, so `Interior.inside()`
       is true a moment before `G.shapes` is the plan. */
    let base = 0;
    if (typeof Interior !== 'undefined' && Interior.inside() && typeof Trace !== 'undefined' &&
        typeof Kinds !== 'undefined' && Kinds.scope() === 'floor'){
      const at = {};
      for (const q of Trace.places()) at[q.id] = q.n;
      for (const m of G.markers || []) if (m.slot){
        const n = at[m.slot] || 0;
        /* its place has been taken out from under it, or its room is gone:
           it is a locus with no spot in the method until it is dropped in
           one, so it goes loose rather than keeping a number that is a lie */
        if (n) m.n = n; else m.slot = 0;
      }
      base = Trace.count();
    }
    /* Anything without a place — every marker on the town, and a locus that
       has come loose — is numbered densely AFTER the last of them, so a free
       marker can never wear a number a place already owns. */
    let k = 0;
    for (const m of ordered()) if (!m.slot) m.n = base + (++k);
  }
  /* move one marker `d` places along the run, and close the hole behind it */
  function reorder(m, d){
    /* in a palace the order is the geography, so moving a locus up the list
       MOVES IT — to the slot before this one, the next room's last if it is
       at the head of its own, and whatever was standing there takes the slot
       it came from. That is what makes the sequence walkable. */
    if (m.slot && typeof Trace !== 'undefined'){
      const to = Trace.slotN((m.n | 0) + d), from = Trace.slotId(m.slot);
      if (!to || !from) return false;
      const held = (G.markers || []).find(x => x !== m && x.slot === to.id);
      if (held){ held.slot = from.id; held.x = from.x; held.y = from.y; }
      m.slot = to.id; m.x = to.x; m.y = to.y;
      renumber();
      save();
      return true;
    }
    const list = ordered();
    const i = list.indexOf(m);
    const j = i + d;
    if (i < 0 || j < 0 || j >= list.length) return false;
    list.splice(j, 0, list.splice(i, 1)[0]);
    list.forEach((x, k) => { x.n = k + 1; });
    save();
    return true;
  }
  /* the nearest marker within reach of a point — what "the place you are
     standing by" means when you press Enter */
  function nearest(x, y, r){
    let best = null, bd = r;
    for (const m of G.markers || []){
      const d = Math.hypot(m.x - x, m.y - y);
      if (d <= bd){ bd = d; best = m; }
    }
    return best;
  }
  function hit(x, y, tol){
    for (let i = G.markers.length - 1; i >= 0; i--){
      const m = G.markers[i];
      const r = Math.max(m.size, tol);
      if (Math.abs(m.x - x) < r && Math.abs(m.y - y) < r) return m;
    }
    return null;
  }
  function moveTo(m, x, y){
    if (typeof Interior !== 'undefined' && Interior.inside() && typeof Trace !== 'undefined'){
      const s = Trace.drop(x, y, m);
      /* a full room will not take it: the marker simply stops at the wall,
         which says so better than a note repeated every frame of the drag */
      if (s && s.full) return;
      if (s){ m.slot = s.id; m.x = s.x; m.y = s.y; renumber(); save(); return; }
      /* dragged clear of every room it is out of the sequence, and is
         numbered after the slots until it is dropped back into one */
      if (m.slot){ m.slot = 0; renumber(); }
    }
    m.x = snap(x); m.y = snap(y); save();
  }
  function remove(m){
    const i = G.markers.indexOf(m);
    if (i < 0) return;
    G.markers.splice(i, 1);
    if (sel === m) sel = null;
    renumber();
    save();
  }
  function cycleTint(m){ m.tint = (m.tint + 1) % TINT.length; save(); }

  /* Whether a marker holds anything depends on what kind of place it is: out
     on the town a marker opens into a room, and inside one it opens into the
     picture of whatever stands at that spot. */
  function filled(uid){
    if (typeof Interior === 'undefined') return false;
    if (Interior.inside()) return typeof Loci !== 'undefined' && Loci.has(uid);
    return Interior.has(uid);
  }

  /* ── drawn into the entity stream, so it costs no extra draw call ── */
  function draw(a, m, cap){
    if (!G.markers || !glyphs.length) return m;
    const z = G.cam[2], px = 1 / z;
    for (const k of G.markers){
      if (m > cap - 10) break;
      /* a marker holds a screen-space floor: it stays findable zoomed out */
      const r = Math.max(k.size, 11 * px);
      const c = TINT[k.tint % TINT.length];
      m = put(a, m, k.x, k.y, c[0], c[1], c[2], 0.32, r * 2.1, 0, 0, 0, 2);
      m = put(a, m, k.x, k.y, c[0], c[1], c[2], 1, r, 0, 0, 0, 3, k.gi);
      /* a marker with something in it wears a ring, so a place you can open
         looks different from a place that is only a note */
      if (filled(k.uid))
        m = put(a, m, k.x, k.y, c[0], c[1], c[2], 0.5, r * 1.28, 1, 0, 0, 1);
      /* and its number, standing off the corner where it cannot cover the
         glyph — the order is the thing you are actually authoring. While the
         grid is up a locus in a slot would say its number twice, and the
         square is the one that owns it, so the marker gives way. */
      const said = k.slot && typeof Trace !== 'undefined' && Trace.on();
      if (k.n && !said) m = number(a, m, k.n, k.x + r * 0.95, k.y - r * 0.95, r * 0.62, c);
      if (k === sel)
        m = put(a, m, k.x, k.y, 1, 0.37, 0.64, 0.9, r * 1.5, 1, 0, 0, 1);
      /* the quest's target wears gold: this is the door you are going to */
      if (typeof Quest !== 'undefined' && Quest.isTarget(k.uid))
        m = put(a, m, k.x, k.y, 0.95, 0.76, 0.31, 0.7 + 0.3 * Math.sin(performance.now() / 300), r * 1.9, 1, 0, 0, 1);
    }
    return m;
  }
  /* ── words, out of the same sheet ────────────────────────────────────
     One instance per character, riding in the entity stream with everything
     else, so a label costs no draw call and no second way of drawing text.
     A character the sheet does not carry advances the pen and draws
     nothing, which is what makes a space a space. */
  const cellOf = ch => {
    const i = TEXT.indexOf(String(ch).toUpperCase());
    return i < 0 ? -1 : text0 + i;
  };
  /* left-aligned from x; `text` returns where the pen ended up */
  function text(a, m, str, x, y, r, c, al, cap){
    const w = r * 1.06;
    for (let i = 0; i < str.length; i++, x += w){
      if (cap !== undefined && m > cap - 2) break;
      const g = cellOf(str[i]);
      if (g < 0) continue;
      m = put(a, m, x, y, c[0], c[1], c[2], al === undefined ? 0.95 : al, r, 0, 0, 0, 3, g);
    }
    return m;
  }
  const textWidth = (str, r) => str.length * r * 1.06;
  /* the digits of `v`, laid out left to right from a centred anchor */
  function number(a, m, v, x, y, r, c){
    const s = String(v | 0);
    return text(a, m, s, x - (s.length - 1) * r * 1.06 / 2, y, r, c);
  }

  /* ── palette strip ── */
  function ui(){
    const box = $('#kmarkers');
    if (!box || box.childElementCount) return;
    glyphs.forEach((g, i) => {
      const c = document.createElement('div');
      c.className = 'mchip';
      c.textContent = g;
      c.title = 'marker ' + (i + 1);
      c.onclick = () => {
        armed = armed === i ? -1 : i;
        document.body.classList.toggle('arming', armed >= 0);
        syncChips();
      };
      box.appendChild(c);
    });
  }
  function syncChips(){
    document.querySelectorAll('#kmarkers .mchip').forEach((c, i) =>
      c.classList.toggle('sel', i === armed));
  }

  /* ── persistence ── */
  function save(){
    try {
      Store.set(KEY, JSON.stringify(G.markers.map(m =>
        ({uid: m.uid, name: m.name || '', n: m.n || 0, slot: m.slot || 0,
          gi: m.gi, x: m.x, y: m.y,
          size: m.size, tint: m.tint, item: m.item || null}))));
      if (typeof hqStoreOK === 'function') hqStoreOK('the markers');
    } catch (e){ if (typeof hqStoreFail === 'function') hqStoreFail('the markers', e); }
  }
  function load(){
    let raw = [];
    try { raw = JSON.parse(Store.get(KEY) || '[]'); } catch (e){}
    let minted = false;
    G.markers = (Array.isArray(raw) ? raw : [])
      .filter(m => m && m.gi < glyphs.length)
      .map(m => {
        /* markers saved before interiors existed have no id of their own.
           Mint one and write it straight back, so the plan built inside a
           marker today is still that marker's tomorrow. */
        if (!m.uid){ m = Object.assign({}, m, {uid: mint()}); minted = true; }
        return Object.assign({id: nextId++, name: '', n: 0, slot: 0}, m);
      });
    /* markers saved before the order existed all carry 0; numbering them
       gives the sequence they were placed in, which is the best guess there
       is and is what you would reorder from anyway */
    if (G.markers.some(m => !m.n)){ renumber(); minted = true; }
    /* and a locus in a place is renumbered on the way in whatever it was
       saved wearing: the number belongs to the plan, not to the marker */
    else if (G.markers.some(m => m.slot)) renumber();
    if (minted) save();
  }
  /* swap which set of markers is pinned — see interior.js */
  function mount(key){
    KEY = key;
    sel = null;
    load();
  }

  function init(){
    const atlas = buildAtlas();
    if (R && !R.lost) R.setAtlas(atlas.canvas, atlas.cols, atlas.rows);
    R._markerAtlas = atlas;             // put back after a context loss
    load();
    ui();
  }

  return {init, ui, draw, place, plant, hit, moveTo, remove, cycleTint, rename, setItem, nearest, mount,
          ordered, reorder, renumber, text, textWidth,
          armed: () => armed >= 0,
          disarm: () => { armed = -1; document.body.classList.remove('arming'); syncChips(); },
          select: m => { sel = m; },
          selected: () => sel,
          commit: save, key: () => KEY,
          count: () => (G.markers ? G.markers.length : 0),
          glyphs: () => glyphs};
})();
