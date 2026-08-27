'use strict';
/* ── minimal, and the trace ─────────────────────────────────────────────
   Inside a palace, V takes the plan down to its walls: the floor and the
   fittings are not drawn and the fittings do not block, so what is left
   is the layout — rooms, windows, doors, stairs — and nothing in them to
   look at. That is the view the trace runs in.

   The trace is the method walked one room at a time. The first room (by
   its number) is printed with a 3×3 GRID of nine coloured squares, each
   square a block of the plate's own cells in one of nine plate tones —
   the same material as everything else, by the rule in STYLE.md — and a
   LINE is drawn through the room: from where you come in (the side it
   shares with the room before it; the west side for the first) through
   every fitting in the room in the order it was laid, to where you go
   out (the side it shares with the next room; the middle for the last).
   The fittings are not drawn; the line goes where they stand. Walk to the
   end of the line and the room is done: the grid and the line move to
   the next room, and so on to the last. Which room you are up to is kept
   per palace under `hq.trace.<uid>`, so a trace put down is picked up
   again. V again shows the plan as it was.

   It is an overlay in the entity stream, not shapes in the plan: nothing
   here is saved into `hq.rooms.<uid>` and nothing here survives leaving
   the building except the number.                                       */

const Trace = (() => {
  const KEY = uid => 'hq.trace.' + uid;
  /* nine plate tones: the focus row's seven (src/focus.js) and the two
     the chrome has left — aqua and dim. Plate colours, not new ones. */
  const TONES = [[0.93, 0.92, 0.89], [0.48, 0.72, 0.44], [1.00, 0.37, 0.64],
                 [0.24, 0.50, 0.75], [0.76, 0.60, 0.36], [0.58, 0.22, 0.25],
                 [0.95, 0.76, 0.31], [0.47, 0.88, 0.85], [0.35, 0.35, 0.40]];
  const AQUA = [0.47, 0.88, 0.85], GOLD = [0.95, 0.76, 0.31];
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

  /* what this room's trace is: the box, the line, and the grid — built
     once per room and per plan, because the shapes do not move while the
     trace is walked */
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
    /* the grid: three by three, inside the room's walls, a cell of gap
       between the squares, and each square a block of cells */
    const cell = G.A.cell, wall = cell * 2;
    const iw = box[2] - box[0] - wall * 2, ih = box[3] - box[1] - wall * 2;
    const side3 = Math.min(iw, ih) * 0.7;
    const k = Math.max(2, Math.floor((side3 / cell - 2) / 3));      // cells a square
    const pitch = (k + 1) * cell;
    const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2;
    const squares = [];
    for (let gy = 0; gy < 3; gy++) for (let gx = 0; gx < 3; gx++)
      squares.push({x0: cx + (gx - 1) * pitch - k * cell / 2, y0: cy + (gy - 1) * pitch - k * cell / 2,
                    tone: TONES[gy * 3 + gx]});
    plan = {room, of: rs.length, name: r.label, box, start, end, pts, squares, k, cell};
    planKey = key;
    return plan;
  }

  function overlay(a, m, cap){
    if (!on || !G.terr || typeof Interior === 'undefined' || !Interior.inside()) return m;
    const p = build(); if (!p) return m;
    const c = p.cell, z = G.cam[2], px = 1 / z;
    /* the grid */
    for (const sq of p.squares)
      for (let j = 0; j < p.k; j++) for (let i = 0; i < p.k; i++){
        if (m > cap - 4) return m;
        m = put(a, m, sq.x0 + (i + 0.5) * c, sq.y0 + (j + 0.5) * c,
                sq.tone[0], sq.tone[1], sq.tone[2], 0.92, c, 0, 0, 0, 1);
      }
    /* the line: aqua dots a cell and a half apart, the plate's route colour */
    const step = c * 1.5;
    for (let s = 0; s < p.pts.length - 1; s++){
      const [x0, y0] = p.pts[s], [x1, y1] = p.pts[s + 1];
      const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(d / step));
      for (let i = 0; i <= n; i++){
        if (m > cap - 4) return m;
        const t = i / n;
        m = put(a, m, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, AQUA[0], AQUA[1], AQUA[2], 0.85,
                Math.max(c * 0.9, 1.5 * px), 0, 0, 0, 1);
      }
    }
    /* where a fitting stands, a ring; the end, a larger gold ring */
    for (let s = 1; s < p.pts.length - 1; s++){
      if (m > cap - 4) return m;
      m = put(a, m, p.pts[s][0], p.pts[s][1], AQUA[0], AQUA[1], AQUA[2], 0.7, Math.max(c * 2.2, 8 * px), 1, 0, 0, 1);
    }
    m = put(a, m, p.end[0], p.end[1], GOLD[0], GOLD[1], GOLD[2], 0.9, Math.max(c * 3, 12 * px), 1, 0, 0, 1);
    m = put(a, m, p.start[0], p.start[1], GOLD[0], GOLD[1], GOLD[2], 0.5, Math.max(c * 2, 8 * px), 1, 0, 0, 1);
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
    note(on ? (p ? 'minimal · room ' + p.room + ' of ' + p.of + ' · walk the line to its end'
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

  return {toggle, off, reset, overlay, step, on: () => on, room: () => room};
})();
