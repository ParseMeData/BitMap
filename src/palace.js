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
  /* Ordered by what the room most wants, with how many of each it will
     take. A room is filled by walking this list into as many slots as the
     room has, so the same kit furnishes a cupboard with one bed and a
     ballroom with a bed, two wardrobes, a rug, two desks and the plants —
     which is what "make it bigger and it fills up" has to mean if the
     furniture is not simply going to be stretched. */
  const KIT = {
    bedroom:  {floor: 'boards', items: [
      {k: 'bed', v: 'double', w: 3, h: 4, max: 1},
      {k: 'shelf', v: 'wardrobe', w: 3, h: 1, max: 2},
      {k: 'rug', v: 'plain', w: 4, h: 3, max: 1},
      {k: 'table', v: 'desk', w: 3, h: 2, max: 1},
      {k: 'plant', v: '', w: 1, h: 1, max: 3},
      {k: 'bed', v: 'single', w: 2, h: 4, max: 2}]},
    bathroom: {floor: 'tile', items: [
      {k: 'pool', v: '', w: 3, h: 2, max: 1},
      {k: 'counter', v: 'counter', w: 3, h: 1, max: 2},
      {k: 'shelf', v: 'store', w: 2, h: 1, max: 2},
      {k: 'plant', v: '', w: 1, h: 1, max: 3}]},
    kitchen:  {floor: 'tile', items: [
      {k: 'counter', v: 'counter', w: 5, h: 1, max: 2},
      {k: 'counter', v: 'island', w: 4, h: 2, max: 1},
      {k: 'shelf', v: 'store', w: 3, h: 1, max: 3},
      {k: 'table', v: 'dining', w: 4, h: 3, max: 1},
      {k: 'plant', v: '', w: 1, h: 1, max: 2}]},
    dining:   {floor: 'boards', items: [
      {k: 'table', v: 'dining', w: 5, h: 4, max: 1},
      {k: 'rug', v: 'medallion', w: 5, h: 4, max: 1},
      {k: 'shelf', v: 'store', w: 3, h: 1, max: 2},
      {k: 'table', v: 'round', w: 4, h: 4, max: 1},
      {k: 'plant', v: '', w: 1, h: 1, max: 3}]},
    study:    {floor: 'boards', items: [
      {k: 'table', v: 'desk', w: 4, h: 3, max: 2},
      {k: 'shelf', v: 'books', w: 4, h: 1, max: 3},
      {k: 'sofa', v: 'armchair', w: 2, h: 2, max: 1},
      {k: 'plant', v: '', w: 1, h: 1, max: 3}]},
    living:   {floor: 'boards', items: [
      {k: 'sofa', v: 'sofa', w: 4, h: 2, max: 2},
      {k: 'rug', v: 'medallion', w: 5, h: 4, max: 1},
      {k: 'table', v: 'round', w: 4, h: 4, max: 1},
      {k: 'sofa', v: 'armchair', w: 2, h: 2, max: 2},
      {k: 'shelf', v: 'books', w: 4, h: 1, max: 2},
      {k: 'plant', v: '', w: 1, h: 1, max: 3}]},
    hall:     {floor: 'flags', items: [
      {k: 'shelf', v: 'store', w: 3, h: 1, max: 2},
      {k: 'plant', v: '', w: 1, h: 1, max: 4},
      {k: 'rug', v: 'stripe', w: 3, h: 2, max: 1}]},
    library:  {floor: 'boards', items: [
      {k: 'shelf', v: 'books', w: 4, h: 1, max: 6},
      {k: 'table', v: 'desk', w: 4, h: 3, max: 1},
      {k: 'sofa', v: 'armchair', w: 2, h: 2, max: 2},
      {k: 'rug', v: 'medallion', w: 4, h: 3, max: 1}]},
    garage:   {floor: 'flags', items: [
      {k: 'counter', v: 'bench', w: 5, h: 1, max: 2},
      {k: 'shelf', v: 'store', w: 3, h: 1, max: 4}]},
    plain:    {floor: 'boards', items: [
      {k: 'rug', v: 'plain', w: 4, h: 3, max: 1},
      {k: 'plant', v: '', w: 1, h: 1, max: 3},
      {k: 'shelf', v: 'store', w: 3, h: 1, max: 2}]}
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
                variant: 'plaster', label: String(name).slice(0, 22),
                n: i + 1, room: i + 1});
      /* The floor runs the FULL width of the room, under the wall rather
         than up to its inner face. It costs nothing to draw — the wall is on
         a higher layer and covers it — and it is what makes a demolished
         wall leave ground behind instead of a one-tile trench you cannot
         cross. */
      out.push({kind: 'floor', type: 'rect', x: cx, y: cy,
                w: g.rw * z, h: g.rh * z, variant: kit.floor,
                room: i + 1});

      for (const it of fill(kit, x0, y0, g.rw, g.rh))
        out.push(Object.assign(it, {room: i + 1}));
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
  /* ── filling a room ────────────────────────────────────────────────────
     The inside is cut into slots of about four tiles and the kit is walked
     into them, in order, skipping anything that has hit its count or will
     not fit the slot it has reached. So the amount of furniture is a
     property of the room's size and nothing else — which is the whole point:
     drag a wall out and the next slot appears and gets filled, drag it back
     and the slot goes and takes its contents with it.

     Slots rather than fractions because fractions scale furniture with the
     room, and a bed in a hall-sized bedroom should be a bed with more floor
     around it, not a bigger bed. */
  const SLOT = 4;                                // tiles
  /* ── the walkway ───────────────────────────────────────────────────────
     Furniture is kept one tile clear of the walls, so a lap of open floor
     runs right round the inside of every room.

     That is not decoration. Slots pack items nearly edge to edge, and three
     of them across the middle of a room is a wall — a room you can enter and
     not cross, which breaks the route the whole palace exists to be. It cost
     a reachability check to find: 679 tiles walkable and 430 of them
     reachable, with the top half of the plan sealed off behind a row of
     kitchen counters. A ring cannot be blocked by anything placed inside it,
     so the guarantee is structural rather than something to re-test. */
  const RING = 1;
  function fill(kit, x0, y0, rw, rh){
    const out = [], z = G.terr.tsz;
    const pad = 1 + RING;                        // the wall, then the walkway
    x0 += pad; y0 += pad;
    const iw = rw - pad * 2, ih = rh - pad * 2;
    if (iw < 1 || ih < 1) return out;
    const cols = Math.max(1, Math.floor(iw / SLOT));
    const rows = Math.max(1, Math.floor(ih / SLOT));
    const sw = iw / cols, sh = ih / rows;
    const used = kit.items.map(() => 0);
    let cursor = 0;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++){
        let pick = -1;
        for (let k = 0; k < kit.items.length; k++){
          const i = (cursor + k) % kit.items.length, it = kit.items[i];
          if (used[i] >= (it.max || 1)) continue;
          if (it.w > Math.min(sw, iw) || it.h > Math.min(sh, ih)) continue;
          pick = i; break;
        }
        if (pick < 0) continue;                  // nothing left that fits here
        const it = kit.items[pick];
        used[pick]++; cursor = pick + 1;
        const cx = clampN(x0 + (c + 0.5) * sw, x0 + it.w / 2, x0 + iw - it.w / 2);
        const cy = clampN(y0 + (r + 0.5) * sh, y0 + it.h / 2, y0 + ih - it.h / 2);
        out.push({kind: it.k, type: it.k === 'plant' || it.k === 'pool' ? 'ellipse' : 'rect',
                  x: cx * z, y: cy * z, w: it.w * z, h: it.h * z,
                  variant: it.v || undefined});
      }
    return out;
  }

  /* ── a room that has been moved or resized ─────────────────────────────
     Its contents are not dragged along with it; they are laid again for the
     shape it is now. That is what makes the wall the handle for the whole
     room rather than for four lines — and it is why the two edit layers
     exist, because furniture you had arranged by hand would be thrown away
     by the next nudge of a wall. In room-editing you move rooms and the
     contents follow; in fitting-out the rooms are locked and the contents
     are yours. */
  function refit(wall){
    if (!wall || !wall.label || !wall.room || !G.terr) return false;
    const z = G.terr.tsz;
    const b = Kinds.geo.bbox(wall);
    const x0 = Math.round(b[0] / z), y0 = Math.round(b[1] / z);
    const rw = Math.max(3, Math.round((b[2] - b[0]) / z));
    const rh = Math.max(3, Math.round((b[3] - b[1]) / z));
    const kit = KIT[kitFor(wall.label)] || KIT.plain;
    const out = [{kind: 'floor', type: 'rect',
                  x: (x0 + rw / 2) * z, y: (y0 + rh / 2) * z,
                  w: rw * z, h: rh * z,
                  variant: kit.floor, room: wall.room}];
    for (const it of fill(kit, x0, y0, rw, rh)) out.push(Object.assign(it, {room: wall.room}));
    Build.refill(wall.room, out);
    return true;
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
    /* what you have just made is a plan, so that is the layer you land on */
    Build.setMode('rooms');
    armed = false;
    close();
  }

  /* ── the names, on the plan ────────────────────────────────────────────
     Read off the shapes themselves rather than a list kept beside them, so
     a room dragged somewhere else takes its name with it and a room deleted
     takes its name away. */
  /* ── what the plan says about itself ───────────────────────────────────
     Every word here is drawn in the diamond type: made of the same thing the
     rooms are made of, breathing at the same rate, rather than a texture
     laid over the top of them.

     The NUMBER sits outside the room, above its top-left corner, the way a
     number sits outside a room on a drawn plan — inside it, it lands on the
     floor you are trying to arrange. The NAME sits inside at the top, and
     only while it is big enough to read: pulled back far enough the letters
     stop being letters, and what you want from across a palace is the order
     anyway. */
  const NUM_TILES = 1.6;                       // how tall a lone room number stands
  const NAME_TILES = 0.9;
  const LEGIBLE = 1.5;                         // device px per letterform pixel

  /* ── where a room's caption goes ───────────────────────────────────────
     Outside it, on a wall that has nothing built against it.

     Rooms in a generated palace are packed edge to edge, so most of a room's
     perimeter is somebody else's room. A caption laid on one of those walls
     is written across the neighbour's floor. So the four sides are tried in
     turn and the first clear one wins — which for a plan of any shape is
     always at least one side, because the block has an outside.

     If every side is taken, the caption goes back inside at the top. That is
     the worst of the options and the only one that is always available. */
  const SIDES = ['top', 'bottom', 'left', 'right'];
  function place(b, w, h, gap, others){
    for (const side of SIDES){
      let x, y;
      if (side === 'top'){ x = (b[0] + b[2] - w) / 2; y = b[1] - gap - h / 2; }
      else if (side === 'bottom'){ x = (b[0] + b[2] - w) / 2; y = b[3] + gap + h / 2; }
      else if (side === 'left'){ x = b[0] - gap - w; y = (b[1] + b[3]) / 2; }
      else { x = b[2] + gap; y = (b[1] + b[3]) / 2; }
      const box = [x, y - h / 2, x + w, y + h / 2];
      let clash = false;
      for (const o of others){
        if (box[0] < o[2] && o[0] < box[2] && box[1] < o[3] && o[1] < box[3]){ clash = true; break; }
      }
      if (!clash) return {x, y};
    }
    return {x: b[0] + gap, y: b[1] + gap + h / 2, inside: true};
  }

  function overlay(a, m, cap){
    if (!G.shapes || !G.terr || WALL) return m;
    const z = G.cam[2], t = G.terr.tsz;
    const hw = VW / (2 * z), hh = VH / (2 * z);
    const vx0 = G.cam[0] - hw, vx1 = G.cam[0] + hw;
    const vy0 = G.cam[1] - hh, vy1 = G.cam[1] + hh;
    const gold = [1, 0.76, 0.31], bone = [0.93, 0.92, 0.89];

    /* every room, so a caption can be kept off every other one */
    const rooms = [], boxes = [];
    let box = null;
    for (const s of G.shapes){
      if (!s.label) continue;
      const b = Kinds.geo.bbox(s);
      rooms.push(s); boxes.push(b);
      box = box ? [Math.min(box[0], b[0]), Math.min(box[1], b[1]),
                   Math.max(box[2], b[2]), Math.max(box[3], b[3])] : b.slice();
    }

    for (let i = 0; i < rooms.length; i++){
      const s = rooms[i], b = boxes[i];
      if (b[2] < vx0 - t * 3 || b[0] > vx1 + t * 3 ||
          b[3] < vy0 - t * 3 || b[1] > vy1 + t * 3) continue;
      if (m > cap - 300) continue;
      const num = s.n ? String(s.n) : '';
      const name = s.label.toUpperCase();
      /* the caption is the number and the name together while the letters
         are letters, and the number alone once they stop being */
      const npx = t * NAME_TILES / 7;
      const full = npx * z >= LEGIBLE;
      const px = full ? npx : Math.max(t * NUM_TILES / 7, 2.6 / z);
      const str = full ? (num ? num + ' ' + name : name) : num;
      if (!str) continue;
      const w = Type.width(str, px), h = Type.height(px);
      const at = place(b, w, h, t * 0.55, boxes.filter((_, j) => j !== i));
      if (num){
        m = Type.text(a, m, num, at.x, at.y, px, gold, 0.95, cap);
        if (full)
          m = Type.text(a, m, name, at.x + Type.width(num + ' ', px), at.y, px,
                        bone, at.inside ? 0.55 : 0.72, cap);
      } else {
        m = Type.text(a, m, name, at.x, at.y, px, bone, 0.72, cap);
      }
    }

    /* and the name of the whole thing, over the top of it */
    m = title(a, m, cap, box, z);
    return m;
  }

  /* The palace's name inside one, the town's name outside — the same word in
     the same type in the same place, because they are the same thing at two
     scales: what is this that I am looking at. */
  function title(a, m, cap, box, z){
    const inside = typeof Interior !== 'undefined' && Interior.inside();
    const name = (inside ? (Interior.at() || '') : townName()).trim();
    if (!name || m > cap - 400) return m;
    if (!box) box = built();
    if (!box) return m;
    const t = G.terr.tsz;
    /* sized to the thing it names rather than to the screen, so it is part
       of the drawing — but never so fine that it stops being readable */
    let px = Math.min(t * 2.2 / 7, Type.pitchFor(name, (box[2] - box[0]) * 0.8));
    px = Math.max(px, 2.2 / z);
    /* A palace's name is a title block: it goes above the plan, clear of it,
       the way a name goes at the top of a drawing. A town's name is a map
       label, and a map label lies ACROSS the ground it names — put above the
       town it would sit off the edge of everything you had drawn, which is
       to say somewhere you would have to go looking for it. */
    if (inside)
      return Type.centred(a, m, name, (box[0] + box[2]) / 2,
                          box[1] - Type.height(px) * 1.15, px,
                          [0.93, 0.92, 0.89], 0.66, cap);
    px = Math.min(px, Type.pitchFor(name, (box[2] - box[0]) * 0.62));
    return Type.centred(a, m, name, (box[0] + box[2]) / 2, (box[1] + box[3]) / 2, px,
                        [0.93, 0.92, 0.89], 0.38, cap);
  }
  /* everything that has been drawn, which is what a town's name goes over */
  function built(){
    let b = null;
    for (const s of G.shapes){
      const q = Kinds.geo.bbox(s);
      b = b ? [Math.min(b[0], q[0]), Math.min(b[1], q[1]),
               Math.max(b[2], q[2]), Math.max(b[3], q[3])] : q.slice();
    }
    return b;
  }
  const TOWN = 'hq.town';
  const townName = () => { try { return localStorage.getItem(TOWN) || ''; }
                           catch (e){ return ''; } };
  /* The town is named in storage and a palace is named on its marker, which
     is where each of them already lives — so the one field writes to
     whichever of the two you are standing in. */
  function rename(v){
    const s = String(v || '').slice(0, 28);
    if (typeof Interior !== 'undefined' && Interior.inside()) Interior.rename(s);
    else { try { if (s) localStorage.setItem(TOWN, s); else localStorage.removeItem(TOWN); }
           catch (e){} }
  }
  const named = () => (typeof Interior !== 'undefined' && Interior.inside())
    ? (Interior.at() || '') : townName();

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

  return {init, show, close, sync, overlay, build, rename, named, refit,
          opened: () => open, at: () => uid,
          has: id => { try { return !!localStorage.getItem(KEY(id)); }
                       catch (e){ return false; } }};
})();
