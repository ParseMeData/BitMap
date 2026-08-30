'use strict';
/* ── minimal, the slots, and the trace ──────────────────────────────────
   Inside a palace, V takes the plan down to its walls: the floor and the
   fittings are not drawn and the fittings do not block, so what is left is
   the layout — rooms, windows, doors, stairs — and, in every room, its
   EIGHT SLOTS.

   A slot is a place in the method. Each room carries a 3×3 grid with the
   MIDDLE SQUARE LEFT OUT — eight squares round the edge of the room,
   numbered left to right and top to bottom — and a room holds eight loci
   and no more. The middle is where the walker stands and where the line
   runs, and a place there would be a place you have to stand on top of to
   look at. The numbering runs on across the palace — room two's first slot
   is 9 — so a plan of five rooms is a sequence of 40 and the palace's
   length is a fact about the building rather than however many markers
   happen to be pinned in it. `slotN` turns that number back into a place,
   which is what makes the sequence a thing you can walk.

   A marker dropped inside a room lands in the nearest slot nothing is
   standing in, and wears that slot's number: the order is the geography,
   so moving a locus up the list moves it through the building.

   Each square is a block of the plate's own cells in one of eight plate
   tones — the same material as everything else, by the rule in STYLE.md,
   and no new colour: 1 white, 2 green, 3 pink, 4 blue, 5 orange, 6 red,
   7 yellow, 8 black.

   The trace is that method walked one room at a time. The room you are up
   to wears its eight whole and the rest of the palace wears theirs faint,
   and a LINE is drawn through the room you are in: from where you come in
   (the side it shares with the room before it) through every fitting in
   the order it was laid, to where you go out (the side it shares with the
   next room; the middle for the last). The fittings are not drawn; the
   line goes where they stand, and it is drawn faint, because the slots are
   the subject and the line is only the thread between them. Walk to its
   end and the room is done: the whole view moves on to the next room, and
   so on to the last. Which room you are up to is kept per palace under
   `hq.trace.<uid>`, so a trace put down is picked up again. V again shows
   the plan as it was.

   The grid is an overlay in the entity stream, not shapes in the plan:
   nothing here is saved into `hq.rooms.<uid>` and nothing here survives
   leaving the building except the number. What a marker keeps is its slot,
   and that lives with the marker.                                       */

const Trace = (() => {
  const KEY = uid => 'hq.trace.' + uid;
  /* the eight, in order, and every one of them a colour the game already
     has (STYLE.md: do not introduce a colour). 1–6 are the focus row's
     first six. 7 is gold pulled half way toward bone — the palette holds
     one amber, so yellow is that amber at a lighter weight, the same device
     focus.js uses when it pulls a tone toward dim; a quarter of the way was
     not enough and read as the amber twice. 8 is dim rather than black: the
     ground is #1B1B21, so a true black square would be a hole in a
     near-black floor and read as nothing at all.

     Gold is not a slot. It stays what it was — the tone the end of the line
     wears — which is worth more than a ninth place would have been. */
  const TONES = [[0.929, 0.918, 0.890],    // 1 white   bone   #EDEAE3
                 [0.482, 0.722, 0.435],    // 2 green   park   #7BB86F
                 [1.000, 0.373, 0.635],    // 3 pink    flare  #FF5FA2
                 [0.243, 0.498, 0.749],    // 4 blue    creek  #3E7FBF
                 [0.765, 0.604, 0.361],    // 5 orange  stairs #C39A5C
                 [0.580, 0.220, 0.247],    // 6 red     rug    #94383F
                 [0.939, 0.838, 0.598],    // 7 yellow  gold → bone .5
                 [0.353, 0.353, 0.400]];   // 8 black   dim    #5A5A66
  const PER = 8;                        // slots a room, and there is no ninth
  const AQUA = [0.47, 0.88, 0.85], GOLD = [0.95, 0.76, 0.31];
  const GROUND = [0.106, 0.106, 0.129], BONE = [0.929, 0.918, 0.890];
  /* a number on a light tone is drawn in ground and on a dark one in bone,
     the rule focus.js uses for the letters on its diamonds */
  const ink = t => (t[0] * 0.3 + t[1] * 0.59 + t[2] * 0.11 > 0.5 ? GROUND : BONE);
  const DONE = 1.2;                     // tiles from the end that counts as arriving
  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };

  let on = false, uid = '', room = 1, plan = null, planKey = '';

  const rooms = () => G.shapes.filter(s => s.label && s.room)
    .sort((a, b) => (a.n || 0) - (b.n || 0) || a.id - b.id);
  const fixt = r => G.shapes.filter(s => !s.label && s.room === r.room &&
                                    (Kinds.by[s.kind] || {}).layer === 'fixt')
    .sort((a, b) => a.id - b.id);

  /* the middle of the side `a` shares with `b`, or the point on a's edge
     nearest b when they do not quite meet */
  function side(a, b){
    const tol = G.terr.tsz;
    const my = (Math.max(a[1], b[1]) + Math.min(a[3], b[3])) / 2;
    const mx = (Math.max(a[0], b[0]) + Math.min(a[2], b[2])) / 2;
    if (b[0] >= a[2] - tol) return [a[2], my];
    if (b[2] <= a[0] + tol) return [a[0], my];
    if (b[1] >= a[3] - tol) return [mx, a[3]];
    if (b[3] <= a[1] + tol) return [mx, a[1]];
    const c = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
    return [Math.max(a[0], Math.min(a[2], c[0])), Math.max(a[1], Math.min(a[3], c[1]))];
  }

  /* ── the eight, for any room ────────────────────────────────────────────
     Three by three inside the room's walls, a cell of gap between the
     squares, and each square a whole block of cells — so the grid is made
     of the same material the plate is and lands on the lattice rather than
     over it.

     THE MIDDLE SQUARE IS NOT A PLACE. The grid keeps its 3×3 shape and the
     centre is left empty, so the eight run round the edge of the room:

         1 2 3
         4 · 5
         6 7 8

     which is the order you walk a room in anyway, and leaves the middle of
     the floor — where the walker stands and where the line runs — clear.
     `i` is 0..7 reading left to right, top to bottom, the centre skipped. */
  function gridFor(box){
    if (!G.A) return null;
    const cell = G.A.cell, wall = cell * 2;
    const iw = box[2] - box[0] - wall * 2, ih = box[3] - box[1] - wall * 2;
    const side3 = Math.min(iw, ih) * 0.7;
    const k = Math.max(2, Math.floor((side3 / cell - 2) / 3));      // cells a square
    const pitch = (k + 1) * cell;
    const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2;
    const sq = [];
    for (let gy = 0; gy < 3; gy++) for (let gx = 0; gx < 3; gx++){
      if (gx === 1 && gy === 1) continue;              // the middle is not a place
      const x0 = cx + (gx - 1) * pitch - k * cell / 2;
      const y0 = cy + (gy - 1) * pitch - k * cell / 2;
      sq.push({x0, y0, cx: x0 + k * cell / 2, cy: y0 + k * cell / 2,
               tone: TONES[sq.length]});
    }
    return {squares: sq, k, cell, side: k * cell};
  }

  /* every room's eight, numbered on across the palace: room r's slot i is
     (r − 1) * 8 + i. Rebuilt on ask rather than cached — the plan is at
     most a few dozen rooms and a room that has just been resized must not
     hand back the slots it used to have. */
  function slots(){
    const rs = rooms(), out = [];
    for (let r = 0; r < rs.length; r++){
      const g = gridFor(Kinds.geo.bbox(rs[r]));
      if (!g) break;
      g.squares.forEach((s, i) => out.push(
        {n: r * PER + i + 1, room: r + 1, i: i + 1, x: s.cx, y: s.cy,
         x0: s.x0, y0: s.y0, side: g.side, k: g.k, cell: g.cell, tone: s.tone}));
    }
    return out;
  }
  /* how long this palace is: rooms times eight, whether or not anything
     stands in them */
  const count = () => rooms().length * PER;
  /* the place slot `n` is, or nothing if the plan has no such slot */
  const slotN = n => slots().find(s => s.n === n) || null;
  const taken = (n, self) => (G.markers || []).some(m => m !== self && m.slot === n);

  /* ── where a marker dropped at (x, y) belongs ───────────────────────────
     The nearest free slot IN THE ROOM IT WAS DROPPED IN, so a marker never
     jumps a wall to find room somewhere else — a locus is in the room you
     put it in or it is nowhere. `{full: true}` when the room is full, and
     nothing at all when the drop was not in a room, which leaves the
     marker where it fell. The middle of a room is not a slot, so a marker
     dropped dead centre goes to whichever of the eight is nearest. */
  function drop(x, y, self){
    const rs = rooms();
    if (!rs.length) return null;
    let hit = -1;
    for (let r = 0; r < rs.length; r++){
      const b = Kinds.geo.bbox(rs[r]);
      if (x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]){ hit = r; break; }
    }
    if (hit < 0) return null;
    const mine = slots().filter(s => s.room === hit + 1);
    if (!mine.length) return null;
    const free = mine.filter(s => !taken(s.n, self));
    if (!free.length) return {full: true, room: hit + 1, name: rs[hit].label || ''};
    let best = free[0], bd = Infinity;
    for (const s of free){
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd){ bd = d; best = s; }
    }
    return best;
  }

  /* ── a locus goes where its slot goes ───────────────────────────────────
     Resize a room and its eight move with it; the loci standing in them
     have to come too, because the slot IS the place — a marker left behind
     would be a locus that is no longer anywhere. Healed at the moment you
     would notice it, which is when you look at the grid, and it writes only
     when something actually moved, so it costs nothing on a plan that is
     already square with itself. */
  function reseat(){
    if (!G.markers || !G.markers.length) return;
    const at = {};
    for (const s of slots()) at[s.n] = s;
    let moved = 0;
    for (const m of G.markers){
      const s = m.slot && at[m.slot];
      if (!s) continue;
      if (Math.abs(m.x - s.x) > 1e-3 || Math.abs(m.y - s.y) > 1e-3){
        m.x = s.x; m.y = s.y; moved++;
      }
    }
    if (moved) Markers.commit();
  }

  /* what this room's trace is: the box and the line — built once per room
     and per plan, because the shapes do not move while the trace is walked */
  function build(){
    const rs = rooms();
    if (!rs.length){ plan = null; return null; }
    if (room > rs.length) room = rs.length;
    const i = room - 1, r = rs[i];
    const key = uid + '|' + room + '|' + G.shapes.length;
    if (plan && planKey === key) return plan;
    const box = Kinds.geo.bbox(r);
    const end = i < rs.length - 1 ? side(box, Kinds.geo.bbox(rs[i + 1]))
                                  : [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
    /* the first room has no room before it, so its start is the side
       across from its end — a line from one wall to the same wall is not
       a walk through the room */
    const mx = (box[0] + box[2]) / 2, my = (box[1] + box[3]) / 2;
    const start = i > 0 ? side(box, Kinds.geo.bbox(rs[i - 1]))
      : end[0] === box[0] ? [box[2], my] : end[0] === box[2] ? [box[0], my]
      : end[1] === box[1] ? [mx, box[3]] : [mx, box[1]];
    const pts = [start].concat(fixt(r).map(s => Kinds.geo.centre(s)), [end]);
    plan = {room, of: rs.length, name: r.label, box, start, end, pts};
    planKey = key;
    return plan;
  }

  /* the digits of `v` from a centred anchor, in the sheet everything else
     draws its text out of (src/markers.js) */
  function num(a, m, v, x, y, r, c, al, cap){
    const s = String(v | 0);
    return Markers.text(a, m, s, x - (s.length - 1) * r * 1.06 / 2, y, r, c, al, cap);
  }

  function overlay(a, m, cap){
    if (!on || !G.terr || typeof Interior === 'undefined' || !Interior.inside()) return m;
    const p = build(); if (!p) return m;
    reseat();
    const z = G.cam[2], px = 1 / z;

    /* every room's eight, the room you are up to whole and the rest faint —
       the grid is the view, and which room the trace has reached is said
       by weight rather than by drawing only one of them */
    for (const s of slots()){
      const here = s.room === p.room;
      const al = here ? 0.92 : 0.3;
      for (let j = 0; j < s.k; j++) for (let i = 0; i < s.k; i++){
        if (m > cap - 4) return m;
        m = put(a, m, s.x0 + (i + 0.5) * s.cell, s.y0 + (j + 0.5) * s.cell,
                s.tone[0], s.tone[1], s.tone[2], al, s.cell, 0, 0, 0, 1);
      }
      /* and its number, in the square's own corner where a marker standing
         in the middle of the slot cannot cover it */
      const r = Math.max(s.side * 0.24, 4 * px);
      if (r * z > 3)
        m = num(a, m, s.n, s.x0 + s.side * 0.32, s.y0 + s.side * 0.30, r,
                ink(s.tone), here ? 0.95 : 0.5, cap);
    }

    /* the line: aqua dots a cell and a half apart, the plate's route
       colour, faint — the thread between the slots, not the subject */
    const c = p.pts.length ? G.A.cell : 0, step = c * 1.5;
    for (let s = 0; s < p.pts.length - 1; s++){
      const [x0, y0] = p.pts[s], [x1, y1] = p.pts[s + 1];
      const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(d / step));
      for (let i = 0; i <= n; i++){
        if (m > cap - 4) return m;
        const t = i / n;
        m = put(a, m, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, AQUA[0], AQUA[1], AQUA[2], 0.28,
                Math.max(c * 0.9, 1.5 * px), 0, 0, 0, 1);
      }
    }
    /* the two ends of it, and nothing where the fittings stood: the rings
       on the fittings were the clutter this view exists to be rid of */
    m = put(a, m, p.end[0], p.end[1], GOLD[0], GOLD[1], GOLD[2], 0.7, Math.max(c * 3, 12 * px), 1, 0, 0, 1);
    m = put(a, m, p.start[0], p.start[1], GOLD[0], GOLD[1], GOLD[2], 0.35, Math.max(c * 2, 8 * px), 1, 0, 0, 1);
    return m;
  }

  /* arriving at the end of the line is the room done */
  function step(){
    if (!on || !plan || G.moving) return;
    const w = toWorld(G.x, G.y);
    if (Math.hypot(w[0] - plan.end[0], w[1] - plan.end[1]) > G.terr.tsz * DONE) return;
    if (plan.room >= plan.of){
      if (!plan.said){ plan.said = true; note('the trace is walked — every room'); }
      return;
    }
    room = plan.room + 1; save();
    note('room ' + plan.room + ' done · ' + room + ' of ' + plan.of);
    plan = null;
  }

  function save(){ Store.put(KEY(uid), String(room), 'the trace'); }
  function load(){ room = Math.max(1, parseInt(Store.get(KEY(uid)) || '1', 10) || 1); }

  function toggle(){
    if (typeof Interior === 'undefined' || !Interior.inside()){
      note('minimal is a view of a plan — go inside a place first'); return false;
    }
    on = !on;
    if (on){ uid = Interior.uid(); load(); plan = null; }
    Build.setMinimal(on);
    if (typeof restampTerrain === 'function') restampTerrain();
    const p = on ? build() : null;
    note(on ? (p ? 'minimal · room ' + p.room + ' of ' + p.of + ' · ' + count() +
                   ' places · walk the line to its end'
                 : 'minimal · this plan has no rooms to trace')
            : 'the plan as it was');
    return on;
  }
  /* leaving the building takes the view with it; the room number stays */
  function off(){
    if (!on) return;
    on = false; plan = null;
    Build.setMinimal(false);
  }
  function reset(){ room = 1; plan = null; if (uid) save(); }

  return {toggle, off, reset, overlay, step, slots, slotN, count, drop, reseat, per: () => PER,
          on: () => on, room: () => room};
})();
