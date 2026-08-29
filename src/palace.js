'use strict';
/* ── the palace ─────────────────────────────────────────────────────────
   A palace is a list of rooms in an order — bedroom, bathroom, study — and
   that list is the thing worth authoring. Drawing the walls is not; it is
   the same four walls every time. So you type the order and the plan is
   laid out from it, furnished with what each room is expected to hold, and
   from that moment on it is ordinary shapes you can drag, resize and throw
   away like anything else you drew by hand.

   The order is not a suggestion the layout is free to ignore. Rooms are
   placed so that consecutive ones are always adjacent — the run boustrophedons
   along each row and turns at the end of it, the way a plough does, so room
   five is beside room four even when it starts a new row. Every pair in the
   order therefore shares a wall, and a door between them is one drag.

   Cutting those doors automatically is the one thing this deliberately does
   not do. Where you get between two rooms is a route, and a route you did
   not choose is the wrong answer in a thing whose whole point is the route
   you did choose.

   The list is kept per palace, so coming back to one shows what it was
   built from rather than an empty box. It opens itself on a palace with
   nothing in it yet, because that is the one moment the answer is always
   "yes, generate something". */

const Palace = (() => {
  /* ── which palace's list this is ───────────────────────────────────────
     Asked for, never remembered. This used to be module state that only
     `show(id)` ever wrote, and `show` is handed an id from exactly one of
     its three callers — so opening an empty palace, walking into a
     furnished one and pressing O filled the box with the FIRST palace's
     rooms and wrote Generate's result back under its key while laying the
     shapes into the second's. On a fresh load there was no id at all and
     the first press wrote the bare key `hq.order.`.

     `Interior` already carries the answer: the frame it pushes on the way
     in holds the marker's uid, and nothing can be standing inside a palace
     without one. Reading it there makes the stale case unreachable rather
     than something to remember to avoid — and outside a palace it is the
     empty string, which is not a palace and therefore has no list, so
     `saved` and `store` say nothing rather than reaching for `hq.order.`. */
  /* Named `here` rather than `at` because `titleAt`'s result is called
     `at` twice below, and a module-wide name a function quietly shadows is
     the kind of thing that reads correctly right up until it does not. */
  const here = () => (typeof Interior !== 'undefined' && Interior.uid
    ? Interior.uid() : '');
  const KEY = uid => 'hq.order.' + uid;
  const MINW = 7, MINH = 6, MARGIN = 2;          // tiles
  /* A room is the size of a room. Left to fill the plate, five of them come
     out twenty tiles across and a bed sits in the middle of one like a coin
     dropped in a car park — so they are capped and the block is centred in
     whatever is left over. */
  const MAXW = 15, MAXH = 12;
  let open = false, armed = false;

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

    names.forEach((name, i) => {
      const {row, col} = cellOf(i, g.cols);
      const x0 = ox + col * g.rw, y0 = oy + row * g.rh;
      const cx = (x0 + g.rw / 2) * z, cy = (y0 + g.rh / 2) * z;
      const kit = KIT[kitFor(name)] || KIT.plain;

      /* the shell, carrying the name and the place in the order — a room is
         the one shape here that is a thing you named rather than a thing you
         drew, so it is the one that gets to say so */
      out.push({kind: 'wall', type: 'rect', x: cx, y: cy,
                w: g.rw * z, h: g.rh * z, width: wall, exact: true,
                variant: 'plaster', label: String(name).slice(0, 22),
                n: i + 1, room: i + 1});
      /* The floor runs the FULL width of the room, under the wall rather
         than up to its inner face. It costs nothing to draw — the wall is on
         a higher layer and covers it — and it is what makes a demolished
         wall leave ground behind instead of a one-tile trench you cannot
         cross. */
      out.push({kind: 'floor', type: 'rect', x: cx, y: cy,
                w: g.rw * z, h: g.rh * z, variant: kit.floor,
                exact: true, room: i + 1});

      for (const it of fill(kit, x0 * z, y0 * z, g.rw, g.rh))
        out.push(Object.assign(it, {room: i + 1}));
    });

    /* No doors. The layout decides where the rooms are; where you get
       between them is a separate decision and belongs to you — a door cut
       automatically at every join is a route you did not choose, in a thing
       whose entire point is the route you did choose. The palette has a Door
       tool beside the demolisher.

       So a fresh palace is a set of sealed rooms, and the panel says how
       many of them the walker can actually reach — otherwise "nothing
       happens when I walk" is a mystery rather than a to-do list. */
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
  function fill(kit, ox, oy, rw, rh){
    const out = [], z = G.terr.tsz;
    const pad = (1 + RING) * z;                  // the wall, then the walkway
    const x0 = ox + pad, y0 = oy + pad;
    const iw = rw * z - pad * 2, ih = rh * z - pad * 2;
    if (iw < z || ih < z) return out;
    const cols = Math.max(1, Math.floor(iw / (SLOT * z)));
    const rows = Math.max(1, Math.floor(ih / (SLOT * z)));
    const sw = iw / cols, sh = ih / rows;
    const used = kit.items.map(() => 0);
    let cursor = 0;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++){
        let pick = -1;
        for (let k = 0; k < kit.items.length; k++){
          const i = (cursor + k) % kit.items.length, it = kit.items[i];
          if (used[i] >= (it.max || 1)) continue;
          if (it.w * z > Math.min(sw, iw) || it.h * z > Math.min(sh, ih)) continue;
          pick = i; break;
        }
        if (pick < 0) continue;                  // nothing left that fits here
        const it = kit.items[pick];
        used[pick]++; cursor = pick + 1;
        const iwd = it.w * z, ihd = it.h * z;
        const cx = clampN(x0 + (c + 0.5) * sw, x0 + iwd / 2, x0 + iw - iwd / 2);
        const cy = clampN(y0 + (r + 0.5) * sh, y0 + ihd / 2, y0 + ih - ihd / 2);
        out.push({kind: it.k, type: it.k === 'plant' || it.k === 'pool' ? 'ellipse' : 'rect',
                  x: cx, y: cy, w: iwd, h: ihd,
                  variant: it.v || undefined, exact: true});
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
    /* The floor takes the wall's own centre and size rather than a box
       measured back out of it. Measuring it back out was the bug: a room an
       even number of tiles wide sits with its edges on tile CENTRES, because
       a centre snaps to a tile centre — and rounding those edges to tile
       indices moved the floor a whole tile sideways. The wall already knows
       where it is; nothing else needs to work it out again. */
    const rw = Math.max(3, Math.round(wall.w / z));
    const rh = Math.max(3, Math.round(wall.h / z));
    const kit = KIT[kitFor(wall.label)] || KIT.plain;
    const out = [{kind: 'floor', type: 'rect',
                  x: wall.x, y: wall.y, w: wall.w, h: wall.h,
                  variant: kit.floor, exact: true, room: wall.room}];
    for (const it of fill(kit, wall.x - wall.w / 2, wall.y - wall.h / 2, rw, rh))
      out.push(Object.assign(it, {room: wall.room}));
    Build.refill(wall.room, out);
    return true;
  }

  const clampN = (v, a, b) => (v < a ? a : (v > b ? b : v));
  const cellSizeGuess = () => (G.A ? G.A.cell : 8);

  /* ── the list ── */
  const parse = txt => String(txt || '').split('\n')
    .map(l => l.trim()).filter(Boolean).slice(0, 40);
  function saved(){
    const id = here();
    if (!id) return '';
    try { return Store.get(KEY(id)) || ''; } catch (e){ return ''; }
  }
  function store(txt){
    const id = here();
    if (!id) return;                       // no palace, so no list, so no key
    try {
      if (txt.trim()) Store.set(KEY(id), txt);
      else Store.del(KEY(id));
      if (typeof hqStoreOK === 'function') hqStoreOK('this room list');
    } catch (e){ if (typeof hqStoreFail === 'function') hqStoreFail('this room list', e); }
  }

  /* ── the panel ── */
  /* It takes no argument any more: which palace this is comes from where
     the walker is standing, and a caller that could name a different one
     was the whole of the bug above. */
  function show(){
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
        : 'laid out in this order, each one beside the last · doors are yours';
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
    /* the heading names the town; the region is not the town */
    if (typeof Region !== 'undefined' && Region.on()) return m;
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
    m = title(a, m, cap, box);
    return m;
  }

  /* The palace's name inside one, the town's name outside — the same word in
     the same type in the same place, because they are the same thing at two
     scales: what is this that I am looking at. */
  function title(a, m, cap, box){
    const at = titleAt(box);
    if (!at) return m;
    /* Whole or not at all, and the flair is what gives way first: if the
       dressed heading will not fit what is left of the instance cap, the
       plain one usually still will, and a name drawn plainly is a name.
       STYLE.md's rule is that new work is flair on top of the plate — so
       when there is not room for both, the plate wins. */
    let tr = treat, bd = border;
    const bone = [0.93, 0.92, 0.89];
    /* In a font, when there is one: the face carries its own tone, so the
       treatment steps aside, and the border, the brightness and the shake
       go on exactly as they would round the 5×7 type — same ink, same
       seed, same border function — because a title that changed its rule
       when it changed its face would be two titles. */
    if (at.face){
      const f = at.face, iw = f.cols - 1, ih = f.rows - 1;
      const x0 = at.x - iw * at.px / 2, y0 = at.y - ih * at.px / 2;
      /* the mat first, under everything, and the first thing dropped
         when the cap is short: a name without its mat is still a name */
      const cover = Title.tuned(tune, 'mat'), fe = Math.round(Title.tuned(tune, 'feather'));
      const mc = cover > 0 ? Title.matCost(f.cols, f.rows) : 0;
      if (m + Title.cost(f) + Type.borderCost(bd, iw, ih) > cap) bd = 'none';
      if (m + Title.cost(f) > cap) return m;
      if (cover > 0 && m + mc + Title.cost(f) <= cap)
        m = Title.mat(a, m, f.cols, f.rows, x0, y0, at.px, cover, cap, fe);
      const ink = Type.lift(bone, bright), al = Type.liftA(at.alpha, bright);
      const sd = Type.seed(at.name.toUpperCase());
      m = Type.border(a, m, bd, iw, ih, x0, y0, at.px, ink, al, cap, jitter, sd);
      return Title.emit(a, m, f, x0, y0, at.px, ink, al, cap, jitter, sd, tune);
    }
    if (m + Type.headCost(at.name, tr, bd) > cap){ tr = 'solid'; bd = 'none'; }
    if (m + Type.headCost(at.name, tr, bd) > cap) return m;
    return Type.heading(a, m, at.name, at.x, at.y, at.px,
                        bone, at.alpha, cap, tr, bd, bright, jitter);
  }

  /* ── where the title goes ──────────────────────────────────────────────
     Split out of the drawing because the pointer has to ask the same
     question: what you can pick up has to be exactly what was drawn, and
     two copies of this arithmetic would agree right up until the day one of
     them was edited.

     Returns the point the heading is centred on, its pitch and its alpha,
     plus — for a town — `home`, the point it would be centred on if it had
     never been dragged. */
  function titleAt(box){
    if (!G.terr || !G.shapes) return null;
    const inside = typeof Interior !== 'undefined' && Interior.inside();
    const name = (inside ? (Interior.at() || '') : townName()).trim();
    if (!name) return null;
    /* `overlay` hands in the box round every room it has labelled; out on
       the town nothing carries a label, so this is `built()` — which is
       what the offset below is measured from. */
    if (!box) box = built();
    if (!box) return null;
    const t = G.terr.tsz, z = G.cam[2] || 1;
    /* the name in its font, if one is set and has arrived; null draws the
       5×7 type, which is also what draws while the font is on its way */
    const face = (font && typeof Title !== 'undefined') ? Title.face(name, font, tune) : null;
    /* sized to the thing it names rather than to the screen, so it is part
       of the drawing — but never so fine that it stops being readable. A
       face is sized the same way, on its own cell counts: as tall as the
       5×7 type is at its biggest plus the room a script's ascenders and
       tails take, as wide as the town allows, and never under a cell and a
       half of screen, which is where a hairline stops being a line. */
    const wide = (box[2] - box[0]) * (inside ? 0.8 : 0.62);
    let px;
    if (face){
      /* ON THE LATTICE'S OWN PITCH, ALWAYS. A face is one diamond per
         cell of ink, and the cell is the plate's cell — `G.A.cell`, the
         unit every diamond on the map is drawn at — so a title is made
         of the same-sized stuff as the road beside it at every zoom, and
         the only way it gets bigger is by being read at more cells,
         which is what Size in the palette does. It was fitted to the
         town's width before this, which made it a different grain from
         the map it lay on; then a pitch multiplier was tried, which
         shrank the diamonds with the name — and the diamond is the one
         thing not meant to change. The one give: a name too wide for
         the town at that pitch is let shrink, because a title off both
         edges names nothing. */
      px = G.A && G.A.cell ? G.A.cell : t / 4;
      if (face.cols * px > wide * 1.3) px = wide * 1.3 / face.cols;
    } else {
      px = Math.min(t * 2.2 / 7, Type.pitchFor(name, (box[2] - box[0]) * 0.8, treat));
      px = Math.max(px, 2.2 / z);
    }
    const w = face ? face.cols * px : Type.width(name, px, treat);
    const h = face ? face.rows * px : Type.height(px);
    /* A palace's name is a title block: it goes above the plan, clear of it,
       the way a name goes at the top of a drawing. A town's name is a map
       label, and a map label lies ACROSS the ground it names — put above the
       town it would sit off the edge of everything you had drawn, which is
       to say somewhere you would have to go looking for it.

       So a palace's name is not draggable and there is no offset for it: a
       title block that had wandered off the top of its own drawing would be
       a mistake rather than a choice. */
    /* and never so close that it lands on the room captions, which stand
       a gap and a name's height above the top row of rooms: the 5×7 type
       always cleared them by being tall, and a face with few rows does
       not, so the clearance is a floor in tiles as well as a share of h */
    /* A 5×7 label lies quiet across the ground, .38 out on the town and
       .66 over a plan. A face is lettering with a mat under it, and lies
       bright, or the mat has dimmed the town for nothing. */
    if (inside)
      return {name, px, face, w, h, inside: true, alpha: face ? 0.92 : 0.66,
              x: (box[0] + box[2]) / 2,
              y: box[1] - Math.max(h * 1.15, h / 2 + t * (0.55 + NAME_TILES + 0.4))};
    if (!face) px = Math.min(px, Type.pitchFor(name, wide, treat));
    /* The town's name rests in the plate's top-right corner, out of the
       way of the town (Eden, 2026-08-28) — it lay across the middle of
       what was drawn before. Still a map label, still draggable; the
       hand-placed offset is measured from this corner now. */
    const tw = (face ? w : Type.width(name, px, treat)), th = (face ? h : Type.height(px));
    /* four tiles down from the top — under the strip of meters on a
       phone — and set to the right so most of it runs off the sheet: the
       name can extend off screen, the walker goes to it if a road does
       (Eden, 2026-08-28) */
    const cx = (G.sheetW || G.W) + tw * 0.2, cy = th / 2 + t * 4;
    /* and never off the plate: an offset saved against an older default
       could carry the name past the edge, out of reach of a hand */
    const tx = Math.max(tw * 0.25, Math.min(G.W - tw * 0.1, cx + (off ? off.dx : 0)));
    const ty = Math.max(th / 2, Math.min(G.H - th / 2, cy + (off ? off.dy : 0)));
    return {name, px, face, inside: false, alpha: face ? 0.88 : 0.38, home: [cx, cy],
            w: face ? w : Type.width(name, px, treat), h: face ? h : Type.height(px),
            x: tx, y: ty};
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

  /* ── the town's title, moved by hand ───────────────────────────────────
     Lying across the middle of the town is the default and stays the
     default: it is a map label, it names the ground it lies on, and the
     user has seen it there and kept it. But the middle of everything you
     have drawn is not always where you want the words — it is wherever the
     town happens to be densest — so the title can be dragged, and once it
     has been the hand-placed spot wins and it stops re-centring.

     WAY BACK TO THE DEFAULT, and there are two: drop the title back on the
     middle of the town — anywhere within its own height of where it would
     centre itself — and the manual position is dropped with it, which is
     the one you can find without being told. `Palace.resetTitle()` is the
     other, for a key or a button to call.

     STORED AS AN OFFSET FROM THE DEFAULT, not as a world point, and the
     trade is worth writing down because both readings are defensible. An
     absolute point holds still while the town grows around it: drag the
     title onto the empty paddock in the south-west and it stays on that
     paddock for good — which sounds right until you build on the paddock,
     because the reason it was a good spot was that nothing was there. An
     offset moves with the drawing: the title keeps the relation to the
     whole that you chose when you dragged it — a little north of centre
     stays a little north of centre — which is what a label on a map is for.
     And it decides the other question for free: zero offset IS the default,
     so getting back to the default is deleting the key, rather than a
     second flag that says whether the point in the first one counts.

     The offset is held in world units rather than as a fraction of the
     town's extent for the same kind of reason: a bbox does not grow, it
     jumps, and the first shape drawn out on the edge of the map would fling
     a fractional offset half a town sideways. */
  const POS = 'hq.title.off';
  let off = null;                              // {dx, dy} world units, or null
  function loadOff(){
    try {
      const raw = Store.get(POS);
      if (!raw) return;
      const v = JSON.parse(raw);
      if (v && isFinite(v.dx) && isFinite(v.dy)) off = {dx: +v.dx, dy: +v.dy};
    } catch (e){ off = null; }                 // an unreadable position is no position
  }
  /* Written on the drop rather than on every frame of the drag, which is
     the same reason `basemap.js` saves the traced picture's place on
     pointerup: a save per frame is sixty writes a second, and a save that
     fails fails on all sixty. The latch is its own phrase so that a title
     that cannot be saved does not silence the town's name, which is a
     different thing being saved. */
  function storeOff(){
    try {
      if (off) Store.set(POS, JSON.stringify(
        {dx: +off.dx.toFixed(2), dy: +off.dy.toFixed(2)}));
      else Store.del(POS);
      if (typeof hqStoreOK === 'function') hqStoreOK('the title position');
    } catch (e){ if (typeof hqStoreFail === 'function') hqStoreFail('the title position', e); }
  }

  /* ── how a heading is dressed ──────────────────────────────────────────
     One treatment and one border, chosen once and worn by every title —
     the town's name and a palace's name both, because they are the same
     thing at two scales and dressing them differently would say they were
     not. Room labels and locus numbers are deliberately left out of it:
     they go through `Type.text`, which has no border and stays solid, so
     working text keeps reading as working text however the headings are
     set. The tables themselves are in `type.js`, beside the font, because
     they are the same kind of thing as the font. */
  /* Brightness and shake are the same kind of thing as the treatment and
     the border — how the one heading in force is dressed, not what any
     shape is born with — so they are stored beside them, under the same
     latch phrase, and read back by the same loader. They are deliberately
     NOT `build.js`'s birth defaults: that object answers "what will the
     next shape you place look like", and a slider that meant that with a
     shape selected, something else with none, and a heading's dress on top
     of both would be three controls wearing one label.

     Brightness scales the bone the title is already drawn in and does not
     introduce a colour; at 1 it is arithmetically the identity, which is
     why the default is exactly 1 and not something near it. */
  const TREAT = 'hq.title.treat', BORD = 'hq.title.border';
  const BRIGHT = 'hq.title.bright', JIT = 'hq.title.jitter';
  /* The font is one more of these: the face a title is set in is how the
     one heading in force is dressed, and it is worn by the town's name and
     a palace's name alike for the reason the treatment is. Empty means the
     5×7 diamond type, which is also what draws until the font arrives and
     whenever it cannot — `title.js` says how a family is fetched. */
  const FONT = 'hq.title.font', FMAX = 48;
  /* the font's own four, `hq.title.<name>`, ranges and defaults from
     `Title.tune` so the clamp here and the slider's ends cannot drift */
  const TUNEK = k => 'hq.title.' + k;
  let tune = {};
  const BMIN = 0.4, BMAX = 2.2, JMAX = 1.5;      // the plate's own two ranges
  let treat = 'solid', border = 'none', bright = 1, jitter = 0, font = '';
  /* A stored number is read the way a stored name is: checked rather than
     trusted, because a key edited by hand or written by an older build is
     the one that would otherwise draw nothing at all. */
  const num = (raw, lo, hi, dflt) => {
    const v = parseFloat(raw);
    return isFinite(v) ? clampN(v, lo, hi) : dflt;
  };
  function loadStyle(){
    try {
      const t = Store.get(TREAT), b = Store.get(BORD);
      /* checked against the tables rather than trusted: a name that has been
         retired should fall back to the plain one, not draw nothing */
      if (t && Type.hasTreatment(t)) treat = t;
      if (b && Type.hasBorder(b)) border = b;
      bright = num(Store.get(BRIGHT), BMIN, BMAX, 1);
      jitter = num(Store.get(JIT), 0, JMAX, 0);
      /* Three readings of the key: absent is a profile that has never
         chosen, and gets the shelf's first face; `none` is the diamond
         type chosen on purpose; anything else is a family. The sentinel
         is what keeps "chose the diamond type" from reading as "never
         chose" after a reload, which would put the default back. */
      const raw = Store.get(FONT);
      font = raw === null ? ((typeof Title !== 'undefined' && Title.DEFAULT) || '')
           : raw === 'none' ? '' : String(raw).trim().slice(0, FMAX);
      /* asked for now rather than on the first frame that wants it, so the
         title is in its face as soon after boot as the network allows */
      if (font && typeof Title !== 'undefined') Title.load(font);
      if (typeof Title !== 'undefined')
        for (const k in Title.tune){
          const r = Title.tune[k];
          tune[k] = num(Store.get(TUNEK(k)), r.lo, r.hi, r.dflt);
        }
    } catch (e){}
  }
  function storeStyle(){
    try {
      Store.set(TREAT, treat);
      Store.set(BORD, border);
      Store.set(BRIGHT, String(bright));
      Store.set(JIT, String(jitter));
      Store.set(FONT, font || 'none');
      for (const k in tune) Store.set(TUNEK(k), String(tune[k]));
      if (typeof hqStoreOK === 'function') hqStoreOK('the heading style');
    } catch (e){ if (typeof hqStoreFail === 'function') hqStoreFail('the heading style', e); }
  }
  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };
  const step = (list, cur, d) => {
    const n = list.length, i = Math.max(0, list.indexOf(cur));
    return list[((i + (d || 1)) % n + n) % n];
  };
  /* `d` is how far to step, so the same call runs the cycle backwards with
     -1 — a cycle you can only go forwards round is a cycle you have to go
     all the way round to undo a mistake in. */
  function cycleTreatment(d){
    treat = step(Type.treatments, treat, d);
    storeStyle();
    note('headings · ' + treat);
    return treat;
  }
  function cycleBorder(d){
    border = step(Type.borders, border, d);
    storeStyle();
    note('heading border · ' + border);
    return border;
  }
  function setTreatment(name){
    if (!Type.hasTreatment(name)) return treat;
    treat = name; storeStyle(); return treat;
  }
  function setBorder(name){
    if (!Type.hasBorder(name)) return border;
    border = name; storeStyle(); return border;
  }
  /* A family name as Google Fonts spells it — "Fleur De Leah", not a URL;
     the menu offers `Title.fonts`, and this takes any family so a key
     written by hand still works. Stored before it is known to exist,
     because the store is what the menu reads back; what it says about the
     outcome is said in the note, once the family has answered. */
  function setFont(v){
    const s = String(v || '').trim().replace(/\s+/g, ' ').slice(0, FMAX);
    if (s === font) return font;
    font = s; storeStyle();
    if (!font){ note('headings · the diamond type'); return font; }
    if (typeof Title === 'undefined'){ note('no font loader on this build'); return font; }
    const asked = font;
    Title.load(font, ok => {
      if (font !== asked) return;              // superseded while it loaded
      note(ok ? 'headings · ' + font : 'no font called ' + font + ' · the diamond type stands in');
    });
    return font;
  }
  /* The two sliders set without storing, and `storeHeading` is the drop.
     Same reason `storeOff` waits for pointerup: a range fires all the way
     along the drag, and a write per frame is sixty a second — sixty that
     all fail together if one does. The buttons above store as they go
     because a press has no middle. */
  function setBright(v){
    bright = clampN(isFinite(v) ? +v : 1, BMIN, BMAX);
    return bright;
  }
  function setJitter(v){
    jitter = clampN(isFinite(v) ? +v : 0, 0, JMAX);
    return jitter;
  }
  /* the font's sliders set without storing, like Bright and Jitter, and
     `storeHeading` is the drop */
  function setTune(k, v){
    if (typeof Title === 'undefined' || !Title.tune[k]) return;
    const r = Title.tune[k];
    tune[k] = clampN(isFinite(v) ? +v : r.dflt, r.lo, r.hi);
    return tune[k];
  }
  function resetTitle(){
    if (!off) return false;
    off = null; storeOff();
    note('the town name centres itself again');
    return true;
  }

  /* ── picking the title up ──────────────────────────────────────────────
     Only when it is actually on screen, and only out on the town. This is
     `Hud.shown()`'s rule with one more clause: a thing drawn on the plate
     cannot be hidden by a stylesheet, so every mode that takes the plate
     away has to be named here by hand. The pause card covers the viewport,
     an open locus has one photograph owning the screen, and the wallpaper
     plate never draws a title at all — `overlay` leaves on `WALL` before it
     reaches one — so there is nothing there to pick up. */
  function grabbable(){
    if (!G.terr || WALL || G.paused) return false;
    if (typeof Loci !== 'undefined' && Loci.opened()) return false;
    if (typeof Interior !== 'undefined' && Interior.inside()) return false;
    /* And not while the traced picture is being laid down. That drag is also
       a capture-phase pointerdown on the window, and `Palace.init()` runs
       before `Basemap.init()`, so this one is asked first — stopping
       propagation would not stop a listener already registered on the same
       node, and a press over the title would move the picture AND the title
       at once. Asking is the only thing that separates them. */
    if (typeof Basemap !== 'undefined' && Basemap.placing && Basemap.placing()) return false;
    return true;
  }
  /* The box the title was drawn in, plus a letterform pixel of slack all
     round. Deliberately no more than that: the title lies across the middle
     of the town, so every pixel of slack is a pixel of the map you cannot
     click through to — the target is the words and not a region around
     them. */
  function titleBox(){
    if (!grabbable()) return null;
    const at = titleAt(null);
    if (!at || at.inside) return null;
    const w = at.w, h = at.h;
    return {at, b: [at.x - w / 2 - at.px, at.y - h / 2 - at.px,
                    at.x + w / 2 + at.px, at.y + h / 2 + at.px]};
  }

  /* the same screen → world mapping `hud.js` and `basemap.js` use: `VW` is
     the canvas backing store, which is larger than its CSS box by the pixel
     ratio the renderer actually settled on, so the ratio is measured off the
     canvas rather than read from `devicePixelRatio` */
  function geom(){
    if (typeof canvas === 'undefined' || !canvas) return null;
    const b = canvas.getBoundingClientRect();
    if (!b.width || !b.height) return null;
    return {b, dpr: VW / b.width, z: G.cam[2] || 1};
  }
  const toWorld = (ev, g) => [((ev.clientX - g.b.left) * g.dpr - VW / 2) / g.z + G.cam[0],
                              ((ev.clientY - g.b.top) * g.dpr - VH / 2) / g.z + G.cam[1]];

  let drag = null;
  function wireTitle(){
    /* Capture phase, for the reason `basemap.js` gives where it lays the
       traced picture down: build mode's own pointerdown sits on the canvas,
       and by the time the event gets there the shape under the pointer has
       already been grabbed. Getting in first is the only way a press on the
       title is a press on the title — and the propagation is stopped ONLY
       on a hit, so every other click reaches build mode exactly as it did. */
    addEventListener('pointerdown', e => {
      if (e.button !== 0 || !grabbable()) return;
      if (e.target && /^(INPUT|TEXTAREA|BUTTON)$/.test(e.target.tagName)) return;
      /* and the press has to have landed on the plate rather than on a panel
         floating above it, which is the canvas test `hud.js` makes */
      if (e.target !== canvas) return;
      const g = geom();
      if (!g) return;
      const p = toWorld(e, g);
      /* The HUD is drawn on the plate too and gets first refusal. Both
         listeners sit on the window in the capture phase, and stopping
         propagation does not stop a sibling listener on the same node — so
         without asking, a title lying over a ring would take the press as
         well as the ring, and both would answer it. */
      if (typeof Hud !== 'undefined' && Hud.hit && Hud.hit(p[0], p[1])) return;
      const hit = titleBox();
      if (!hit) return;
      const b = hit.b;
      if (p[0] < b[0] || p[0] > b[2] || p[1] < b[1] || p[1] > b[3]) return;
      e.stopPropagation();
      /* the town cannot change under a drag, so where the default is and how
         big the letters are is settled here rather than asked every move */
      drag = {ox: p[0] - hit.at.x, oy: p[1] - hit.at.y,
              home: hit.at.home, h: hit.at.h, was: off};
    }, true);

    addEventListener('pointermove', e => {
      if (!drag) return;
      e.stopPropagation();
      const g = geom();
      if (!g) return;
      const p = toWorld(e, g);
      /* measured from the default rather than from the last position, so a
         drag that starts on a title already moved does not compound */
      off = {dx: p[0] - drag.ox - drag.home[0], dy: p[1] - drag.oy - drag.home[1]};
    }, true);

    addEventListener('pointerup', drop, true);
    /* A pointer can go away without ever coming up — a touch that turns into
       a scroll, a window that loses the pointer mid-drag — and a drag left
       armed would then stick the title to the cursor and swallow every
       pointermove the plate was meant to get. Both endings land here. */
    addEventListener('pointercancel', drop, true);
    addEventListener('blur', () => drop(null));
  }

  function drop(e){
    if (!drag) return;
    if (e) e.stopPropagation();
    /* Dropped back where it would have centred itself: the hand-placed
       position goes with it. That is the way back to the default you can
       find without being told about it, and the tolerance is the title's
       own height so it scales with the town rather than with the zoom. */
    const back = off && Math.hypot(off.dx, off.dy) < drag.h;
    if (back) off = null;
    const moved = !drag.was && off;
    drag = null;
    storeOff();
    if (back) note('the town name centres itself again');
    else if (moved) note('the town name is placed by hand now · drop it back on the middle to undo that');
  }

  const TOWN = 'hq.town';
  const townName = () => { try { return Store.get(TOWN) || ''; }
                           catch (e){ return ''; } };
  /* The town is named in storage and a palace is named on its marker, which
     is where each of them already lives — so the one field writes to
     whichever of the two you are standing in. */
  function rename(v){
    const s = String(v || '').slice(0, 28);
    if (typeof Interior !== 'undefined' && Interior.inside()) Interior.rename(s);
    else { try { if (s) Store.set(TOWN, s); else Store.del(TOWN);
                 if (typeof hqStoreOK === 'function') hqStoreOK('the town name'); }
           catch (e){ if (typeof hqStoreFail === 'function') hqStoreFail('the town name', e); } }
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
    loadStyle();
    /* `Build.init` runs before this one and drew the heading controls from
       whatever was in memory, which at that point was the defaults — so the
       palette is told to read them again now that the stored ones are.
       Harmless when there is no palette yet; the two buttons and the two
       sliders are the only things in it that read from here. */
    if (typeof Build !== 'undefined' && Build.head) Build.head();
    loadOff();
    wireTitle();
  }

  return {init, show, close, sync, overlay, build, rename, named, refit, titleAt: () => titleAt(),
          cycleTreatment, cycleBorder, setTreatment, setBorder, setFont, resetTitle,
          setBright, setJitter, setTune, storeHeading: storeStyle,
          /* what a control that drives the cycle needs to draw itself: the
             two names in force, the two lists to choose from, and whether
             the title is somewhere the user put it */
          heading: () => ({treatment: treat, border: border, moved: !!off,
                           font: font, tune: Object.assign({}, tune),
                           fontState: (font && typeof Title !== 'undefined') ? Title.state(font) : 'none',
                           bright: bright, jitter: jitter,
                           brightRange: [BMIN, BMAX], jitterRange: [0, JMAX]}),
          treatments: () => Type.treatments, borders: () => Type.borders,
          opened: () => open, at: here,
          has: id => { try { return !!Store.get(KEY(id)); }
                       catch (e){ return false; } }};
})();
