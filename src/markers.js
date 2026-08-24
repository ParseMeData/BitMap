'use strict';
/* ── markers ────────────────────────────────────────────────────────────
   Not terrain. A marker is a note you pin to one spot on the map: this is
   the place. They sit outside the build layers, are always visible, and
   snap to the same tile grid the walker stands on.

   They are drawn as real glyphs, which the diamond shader cannot make on
   its own — so the set is baked once into a canvas sheet, uploaded as the
   one texture in the program, and each marker is an instance carrying the
   cell of that sheet to cut from (see mode 3 in render.js). */

const Markers = (() => {
  const WANT = ['☇', '❍', '▲', '〄', '⎋', '⚆', '☾',
                '⫫', '⇞', '⇬', '✦', '↬', '⏎', '➣',
                '⤲', '⇑', '⇯', '⇭', '⤊', '⟰', '≛',
                '✥'];
  const SIZE = 64, COLS = 8;
  /* Which markers are being pinned is one string, the way the shapes are —
     the town's, or the ones inside a building. */
  let KEY = 'hq.markers';
  const TINT = [[0.47, 0.88, 0.85], [1, 0.76, 0.31], [1, 0.37, 0.64],
                [0.93, 0.92, 0.89], [0.65, 0.55, 0.98]];

  let glyphs = [], sel = null, armed = -1, nextId = 1;

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

    const rows = Math.max(1, Math.ceil(keep.length / COLS));
    const c = document.createElement('canvas');
    c.width = COLS * SIZE; c.height = rows * SIZE;
    const x = c.getContext('2d');
    x.font = px.font;
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff';
    keep.forEach((g, i) => x.fillText(g, (i % COLS + 0.5) * SIZE,
                                      Math.floor(i / COLS) * SIZE + SIZE / 2));
    return {canvas: c, cols: COLS, rows};
  }

  /* ── model ── */
  const grid = () => (G.terr ? G.terr.tsz : 12);
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
    const m = {id: nextId++, uid: mint(), name: '', gi: armed, x: snap(x), y: snap(y),
               size: grid() * 0.8, tint: 0};
    G.markers.push(m);
    sel = m;
    save();
    return m;
  }
  function rename(m, s){ m.name = String(s || '').slice(0, 40); save(); }
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
  function moveTo(m, x, y){ m.x = snap(x); m.y = snap(y); save(); }
  function remove(m){
    const i = G.markers.indexOf(m);
    if (i < 0) return;
    G.markers.splice(i, 1);
    if (sel === m) sel = null;
    save();
  }
  function cycleTint(m){ m.tint = (m.tint + 1) % TINT.length; save(); }

  /* ── drawn into the entity stream, so it costs no extra draw call ── */
  function draw(a, m, cap){
    if (!G.markers || !glyphs.length) return m;
    const z = G.cam[2], px = 1 / z;
    for (const k of G.markers){
      if (m > cap - 4) break;
      /* a marker holds a screen-space floor: it stays findable zoomed out */
      const r = Math.max(k.size, 11 * px);
      const c = TINT[k.tint % TINT.length];
      m = put(a, m, k.x, k.y, c[0], c[1], c[2], 0.32, r * 2.1, 0, 0, 0, 2);
      m = put(a, m, k.x, k.y, c[0], c[1], c[2], 1, r, 0, 0, 0, 3, k.gi);
      /* a marker with something built inside it wears a ring, so a place you
         can walk into looks different from a place that is only a note */
      if (typeof Interior !== 'undefined' && Interior.has(k.uid))
        m = put(a, m, k.x, k.y, c[0], c[1], c[2], 0.5, r * 1.28, 1, 0, 0, 1);
      if (k === sel)
        m = put(a, m, k.x, k.y, 1, 0.37, 0.64, 0.9, r * 1.5, 1, 0, 0, 1);
    }
    return m;
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
      localStorage.setItem(KEY, JSON.stringify(G.markers.map(m =>
        ({uid: m.uid, name: m.name || '', gi: m.gi, x: m.x, y: m.y,
          size: m.size, tint: m.tint}))));
    } catch (e){}
  }
  function load(){
    let raw = [];
    try { raw = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e){}
    let minted = false;
    G.markers = (Array.isArray(raw) ? raw : [])
      .filter(m => m && m.gi < glyphs.length)
      .map(m => {
        /* markers saved before interiors existed have no id of their own.
           Mint one and write it straight back, so the plan built inside a
           marker today is still that marker's tomorrow. */
        if (!m.uid){ m = Object.assign({}, m, {uid: mint()}); minted = true; }
        return Object.assign({id: nextId++, name: ''}, m);
      });
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

  return {init, ui, draw, place, hit, moveTo, remove, cycleTint, rename, nearest, mount,
          armed: () => armed >= 0,
          disarm: () => { armed = -1; document.body.classList.remove('arming'); syncChips(); },
          select: m => { sel = m; },
          selected: () => sel,
          commit: save, key: () => KEY,
          count: () => (G.markers ? G.markers.length : 0),
          glyphs: () => glyphs};
})();
