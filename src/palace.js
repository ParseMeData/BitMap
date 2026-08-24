'use strict';
/* ── the palace ─────────────────────────────────────────────────────────
   A palace is a list of rooms in an order — bedroom, bathroom, study — and
   that list is the thing worth authoring. Drawing the walls is not; it is
   the same four walls every time. So you type the order and the plan is
   laid out from it, furnished with what each room is expected to hold, and
   from that moment on it is ordinary shapes you can drag, resize and throw
   away like anything else you drew by hand.

   The order is not a suggestion the layout is free to ignore. Rooms are
   placed so that consecutive ones are always adjacent, and a door is cut
   between each pair — the run boustrophedons along each row and turns at
   the end of it, the way a plough does, so room five is next to room four
   even when it starts a new row. That means the order you typed is a route
   you can actually walk, which is the whole of what a memory palace is.

   The list is kept per palace, so coming back to one shows what it was
   built from rather than an empty box. It opens itself on a palace with
   nothing in it yet, because that is the one moment the answer is always
   "yes, generate something". */

const Palace = (() => {
  const KEY = uid => 'hq.order.' + uid;
  const MINW = 7, MINH = 6, MARGIN = 2;          // tiles
  /* A room is the size of a room. Left to fill the plate, five of them come
     out twenty tiles across and a bed sits in the middle of one like a coin
     dropped in a car park — so they are capped and the block is centred in
     whatever is left over. */
  const MAXW = 15, MAXH = 12;
  let open = false, armed = false, uid = '';

  /* ── what a room is expected to hold ───────────────────────────────────
     Positions are fractions of the room's inside, so the same kit furnishes
     a small room and a large one; sizes are in walk tiles and anything that
     will not fit is left out rather than shrunk into a smudge.

     Ordered floor-first within each kit, because the layers already sort
     what covers what: a rug is on the floor layer and a table on the
     fittings layer, so the table stands on the rug whatever order they are
     written in here. */
  const KIT = {
    bedroom:  {floor: 'boards', items: [
      ['bed', 'double', 0.30, 0.40, 3, 4], ['shelf', 'wardrobe', 0.76, 0.18, 3, 1],
      ['rug', 'plain', 0.62, 0.74, 4, 3], ['table', 'desk', 0.82, 0.72, 2, 2]]},
    bathroom: {floor: 'tile', items: [
      ['pool', '', 0.28, 0.32, 3, 2], ['counter', 'counter', 0.74, 0.18, 3, 1],
      ['plant', '', 0.82, 0.80, 1, 1]]},
    kitchen:  {floor: 'tile', items: [
      ['counter', 'counter', 0.50, 0.16, 6, 1], ['counter', 'island', 0.46, 0.58, 4, 2],
      ['shelf', 'store', 0.16, 0.76, 3, 1]]},
    dining:   {floor: 'boards', items: [
      ['rug', 'medallion', 0.50, 0.50, 6, 5], ['table', 'dining', 0.50, 0.48, 5, 4],
      ['shelf', 'store', 0.16, 0.18, 3, 1]]},
    study:    {floor: 'boards', items: [
      ['table', 'desk', 0.34, 0.38, 4, 3], ['shelf', 'books', 0.76, 0.18, 4, 1],
      ['plant', '', 0.84, 0.80, 1, 1]]},
    living:   {floor: 'boards', items: [
      ['rug', 'medallion', 0.52, 0.58, 6, 4], ['sofa', 'sofa', 0.34, 0.26, 4, 2],
      ['table', 'round', 0.56, 0.58, 4, 4], ['plant', '', 0.86, 0.82, 1, 1]]},
    hall:     {floor: 'flags', items: [
      ['plant', '', 0.50, 0.26, 1, 1], ['shelf', 'store', 0.18, 0.76, 3, 1]]},
    library:  {floor: 'boards', items: [
      ['shelf', 'books', 0.20, 0.20, 4, 1], ['shelf', 'books', 0.80, 0.20, 4, 1],
      ['table', 'desk', 0.50, 0.68, 4, 3]]},
    garage:   {floor: 'flags', items: [
      ['counter', 'bench', 0.50, 0.18, 5, 1], ['shelf', 'store', 0.18, 0.78, 3, 1]]},
    plain:    {floor: 'boards', items: []}
  };
  /* A name is a name, not a menu selection, so it is read rather than
     matched exactly: "master bedroom", "the ensuite" and "kids bed" all want
     the same furniture. Anything unrecognised is a plain room, which is a
     better answer than refusing to draw it. */
  const READS = [
    [/bed|sleep/, 'bedroom'],
    [/bath|shower|ensuite|toilet|\bwc\b|washroom/, 'bathroom'],
    [/kitchen|cook|galley|pantry|scullery/, 'kitchen'],
    [/din|breakfast|mess/, 'dining'],
    [/stud|office|desk|work/, 'study'],
    [/liv|lounge|sitting|parlour|front room|den/, 'living'],
    [/hall|corridor|entry|foyer|landing|stair|passage|porch/, 'hall'],
    [/librar|book|archive/, 'library'],
    [/garage|shed|workshop|cellar|basement|store|attic|loft/, 'garage']
  ];
  const kitFor = name => {
    const n = String(name || '').toLowerCase();
    for (const [re, k] of READS) if (re.test(n)) return k;
    return 'plain';
  };

  /* ── the grid the rooms are packed into ────────────────────────────────
     Chosen by trying every column count and keeping the one whose rooms
     come out closest to a comfortable shape. A palace is not a spreadsheet:
     one row of nine rooms is technically an order and unreadable as a plan. */
  const AIM = 1.25;                              // rooms a little wider than tall
  function grid(n, W, H){
    let best = null;
    for (let cols = 1; cols <= n; cols++){
      const rows = Math.ceil(n / cols);
      const rw = Math.min(MAXW, Math.floor(W / cols));
      const rh = Math.min(MAXH, Math.floor(H / rows));
      if (rw < MINW || rh < MINH) continue;
      const score = Math.abs(rw / rh - AIM) + Math.abs(cols - rows) * 0.05;
      if (!best || score < best.score) best = {cols, rows, rw, rh, score};
    }
    /* nothing fit at a readable size — take the squarest packing there is
       and let the rooms be small rather than draw nothing */
    if (!best){
      const cols = Math.max(1, Math.round(Math.sqrt(n * W / Math.max(H, 1))));
      const rows = Math.ceil(n / cols);
      best = {cols, rows, rw: Math.max(4, Math.floor(W / cols)),
              rh: Math.max(4, Math.floor(H / rows)), score: 99};
    }
    return best;
  }
  /* the plough: along the row, then back along the next, so the room after
     this one is always the room beside it */
  const cellOf = (i, cols) => {
    const row = Math.floor(i / cols), k = i % cols;
    return {row, col: row % 2 === 0 ? k : cols - 1 - k};
  };

  /* ── laying it out ── */
  function build(names){
    const t = G.terr;
    if (!t || !names.length) return 0;
    const z = t.tsz;
    const W = t.tw - MARGIN * 2, H = t.th - MARGIN * 2;
    const g = grid(names.length, W, H);
    const wall = cellSizeGuess() * 2;            // a two-cell wall
    /* centred, so a plan that does not fill the plate is not shoved into a
       corner of it */
    const ox = MARGIN + Math.max(0, Math.floor((W - g.cols * g.rw) / 2));
    const oy = MARGIN + Math.max(0, Math.floor((H - g.rows * g.rh) / 2));
    const out = [];
    const boxes = [];

    names.forEach((name, i) => {
      const {row, col} = cellOf(i, g.cols);
      const x0 = ox + col * g.rw, y0 = oy + row * g.rh;
      const cx = (x0 + g.rw / 2) * z, cy = (y0 + g.rh / 2) * z;
      boxes.push({x0, y0, row, col, cx, cy});
      const kit = KIT[kitFor(name)] || KIT.plain;

      /* the shell, carrying the name and the place in the order — a room is
         the one shape here that is a thing you named rather than a thing you
         drew, so it is the one that gets to say so */
      out.push({kind: 'wall', type: 'rect', x: cx, y: cy,
                w: g.rw * z, h: g.rh * z, width: wall,
                variant: 'plaster', label: String(name).slice(0, 22), n: i + 1});
      out.push({kind: 'floor', type: 'rect', x: cx, y: cy,
                w: (g.rw - 1) * z, h: (g.rh - 1) * z, variant: kit.floor});

      /* inside the walls, in tiles */
      const iw = g.rw - 2, ih = g.rh - 2;
      for (const [kind, variant, fx, fy, tw, th] of kit.items){
        if (tw > iw || th > ih) continue;        // it does not fit; leave it out
        const hw = tw / 2, hh = th / 2;
        const px = clampN(x0 + 1 + fx * iw, x0 + 1 + hw, x0 + 1 + iw - hw);
        const py = clampN(y0 + 1 + fy * ih, y0 + 1 + hh, y0 + 1 + ih - hh);
        out.push({kind, type: kind === 'plant' || kind === 'pool' ? 'ellipse' : 'rect',
                  x: px * z, y: py * z, w: tw * z, h: th * z,
                  variant: variant || undefined});
      }
    });

    /* a door between every consecutive pair, on the wall they share */
    for (let i = 0; i + 1 < boxes.length; i++){
      const a = boxes[i], b = boxes[i + 1];
      let p0, p1;
      if (a.row === b.row){                      // side by side: the vertical wall
        const x = (ox + Math.max(a.col, b.col) * g.rw) * z;
        const y = a.cy;
        p0 = [x, y - z]; p1 = [x, y + z];
      } else {                                   // the turn: the horizontal wall
        const y = (oy + Math.max(a.row, b.row) * g.rh) * z;
        const x = a.cx;
        p0 = [x - z, y]; p1 = [x + z, y];
      }
      out.push({kind: 'door', type: 'line', pts: [p0, p1], width: wall, variant: 'swing'});
    }
    Build.lay(out);
    return names.length;
  }
  const clampN = (v, a, b) => (v < a ? a : (v > b ? b : v));
  const cellSizeGuess = () => (G.A ? G.A.cell : 8);

  /* ── the list ── */
  const parse = txt => String(txt || '').split('\n')
    .map(l => l.trim()).filter(Boolean).slice(0, 40);
  function saved(){
    try { return localStorage.getItem(KEY(uid)) || ''; } catch (e){ return ''; }
  }
  function store(txt){
    try {
      if (txt.trim()) localStorage.setItem(KEY(uid), txt);
      else localStorage.removeItem(KEY(uid));
    } catch (e){}
  }

  /* ── the panel ── */
  function show(id){
    uid = id || uid;
    open = true; armed = false;
    const ta = $('#porder');
    if (ta) ta.value = saved() || 'hall\nbedroom\nbathroom\nkitchen\nstudy';
    sync();
    if (ta) setTimeout(() => ta.focus(), 30);
  }
  function close(){
    if (!open) return false;
    open = false; armed = false;
    sync();
    return true;
  }
  function sync(){
    const el = $('#palace');
    if (el) el.hidden = !open;
    document.body.classList.toggle('ordering', open);
    if (!open) return;
    const n = parse($('#porder') ? $('#porder').value : '').length;
    const had = G.shapes.length > 0;
    const btn = $('#pgen'), note = $('#pgnote');
    if (btn) btn.textContent = !n ? 'Generate'
      : (had && !armed) ? 'Replace the plan' : ('Generate ' + n + ' room' + (n === 1 ? '' : 's'));
    if (btn) btn.classList.toggle('sel', armed);
    if (note) note.textContent = !n
      ? 'one room to a line · bedroom, bathroom, kitchen, study…'
      : (had && !armed)
        ? 'there is already a plan here — press again to replace it'
        : 'doors are cut between them in this order';
  }
  function go(){
    const ta = $('#porder');
    const names = parse(ta ? ta.value : '');
    if (!names.length) return;
    if (G.shapes.length && !armed){ armed = true; sync(); return; }
    store(ta.value);
    build(names);
    armed = false;
    close();
  }

  /* ── the names, on the plan ────────────────────────────────────────────
     Read off the shapes themselves rather than a list kept beside them, so
     a room dragged somewhere else takes its name with it and a room deleted
     takes its name away. */
  function overlay(a, m, cap){
    if (!G.shapes || !G.terr || WALL) return m;
    const z = G.cam[2];
    /* A name has to be readable at the zoom you plan at and still be a name
       rather than a billboard at the zoom you furnish at, so it holds a
       screen-space floor and a ceiling and only scales between them. */
    const r = Math.min(Math.max(7 / z, G.terr.tsz * 0.2), 22 / z);
    const gold = [1, 0.76, 0.31], bone = [0.93, 0.92, 0.89];
    for (const s of G.shapes){
      if (!s.label || m > cap - 40) continue;
      const b = Kinds.geo.bbox(s);
      const w = b[2] - b[0], name = s.label.toUpperCase();
      /* Pulled back far enough and the letters stop being letters, so at
         that distance the room says its NUMBER instead — large, and in the
         middle of the floor. Which is the right answer rather than a
         fallback: from across the plan what you are reading is the order,
         and up close what you want is which room you are standing in.

         The test is how big a character actually lands on the screen, not
         whether the word fits inside the room. A fourteen-letter name fits
         easily across a fifteen-tile room and is still seven pixels a
         letter, which is a smudge with a word's shape. */
      if (r * z < 15 || Markers.textWidth(name, r) > w * 0.92){
        if (!s.n) continue;
        const big = Math.min(w, b[3] - b[1]) * 0.30;
        m = Markers.text(a, m, String(s.n),
                         (b[0] + b[2]) / 2 - Markers.textWidth(String(s.n), big) / 2 + big * 0.03,
                         (b[1] + b[3]) / 2, big, gold, 0.5, cap);
        continue;
      }
      const y = b[1] + r * 1.5, x = b[0] + r * 1.2;
      if (s.n) m = Markers.text(a, m, String(s.n), x, y, r, gold, 0.95, cap);
      m = Markers.text(a, m, name,
                       x + (s.n ? Markers.textWidth(String(s.n) + ' ', r) : 0),
                       y, r, bone, 0.7, cap);
    }
    return m;
  }

  function init(){
    const ta = $('#porder'), btn = $('#pgen'), x = $('#pclosep');
    if (ta){
      ta.addEventListener('input', () => { armed = false; sync(); });
      ta.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.code === 'Escape') close();
        if (e.code === 'Enter' && (e.ctrlKey || e.metaKey)) go();
      });
    }
    if (btn) btn.onclick = go;
    if (x) x.onclick = () => close();
  }

  return {init, show, close, sync, overlay, build,
          opened: () => open, at: () => uid,
          has: id => { try { return !!localStorage.getItem(KEY(id)); }
                       catch (e){ return false; } }};
})();
