'use strict';
/* ── minimal, the places, and the trace ─────────────────────────────────
   Inside a palace, V takes the plan down to its walls: the floor and the
   fittings are not drawn and the fittings do not block, so what is left is
   the layout — rooms, windows, doors, stairs — and, in every room, its
   PLACES.

   A place is a spot in the method. Each room carries a 3×3 grid with the
   MIDDLE SQUARE LEFT OUT — eight squares round the edge — and the middle
   is where the walker stands and where the line runs, so a place there
   would be one you have to stand on top of to look at.

   ── the number ────────────────────────────────────────────────────────
   The numbering RUNS ON across the palace and is dense: the rooms are
   walked in their order, each room's live squares are walked in theirs,
   and the count never stops or skips. Delete two places from the first
   room and it holds 1–6, so the second room starts at 7. How long a
   palace is is `count()`, and it is a fact about the building.

   Because the numbers move, a marker CANNOT key on one. What a locus
   keeps is a PLACE ID — `room * 8 + square`, stable under every rotation,
   deletion and renumbering that can happen around it — and its number is
   read off the place each time it is asked for.

   ── the colour ────────────────────────────────────────────────────────
   A tone belongs to a NUMBER, not to a square: the colour travels with the
   number when the grid is turned or a place is taken out, so 1, 11, 21 and
   31 are the same white wherever in the building they land. It is the
   number's LAST DIGIT that says which:

       1 white   2 green   3 pink   4 blue    5 orange
       6 red     7 yellow  8 black  9 gold    0 rainbow

   and every one of them is a colour the game already has (STYLE.md).
   0 is a RAINBOW — the square's own cells laid in hue order across its
   diagonal, red, orange, gold, yellow, green, blue, pink — which is the
   ten's own mark and needs no colour that is not already on the plate.

   ── turning a room, and taking a place out ────────────────────────────
   `[` and `]` turn the room you are standing in one step round its ring,
   so the same eight squares carry the numbers in another arrangement;
   `X` takes the nearest place out, or puts it back. A room's turn and
   what it has had taken out live with the palace, under `hq.trace.<uid>`,
   beside which room the trace is up to.

   ── the hand on the grid ──────────────────────────────────────────────
   The grid is also edited by pointing at it, from anywhere — you do not
   have to be standing in the room. CLICK a square and it opens: a name,
   a description, notes, a picture and a reference for it, the number
   itself, and the same take-out/put-back X does. DRAG a square onto
   another and the two trade numbers — kept as the pair of place ids, a
   chain of swaps applied on top of the derived numbering, so a trade
   survives the turns and cuts that happen around it. A square that has
   been taken out stands as a ghost while the view is up, so there is
   something to click to put it back. What is typed lives in
   `hq.trace.<uid>` beside the turns and cuts; a place's picture goes to
   the loci store (src/loci.js) under `place:<palace>:<id>`.

   ── the trace ─────────────────────────────────────────────────────────
   The method walked one room at a time. The room you are up to wears its
   places whole and the rest of the palace wears theirs faint, and a LINE
   is drawn through the room you are in: from where you come in (the side
   it shares with the room before it) through every fitting in the order it
   was laid, to where you go out (the side it shares with the next room;
   the middle for the last). The fittings are not drawn; the line goes
   where they stand, and it is drawn faint, because the places are the
   subject and the line is only the thread between them. Walk to its end
   and the room is done: the whole view moves on to the next room, and so
   on to the last. V again shows the plan as it was.

   The grid is an overlay in the entity stream, not shapes in the plan:
   nothing here is saved into `hq.rooms.<uid>`.                          */

const Trace = (() => {
  const KEY = uid => 'hq.trace.' + uid;
  /* the ten, by last digit, and every one of them a colour the game
     already has (STYLE.md: do not introduce a colour). 1–6 are the focus
     row's first six. 7 is gold pulled HALF WAY toward bone — the palette
     holds one amber, so yellow has to be that amber at a lighter weight,
     the device focus.js uses when it pulls a tone toward dim; a quarter of
     the way read as the amber twice. 8 is dim rather than black: the
     ground is #1B1B21, so a true black square would be a hole in a
     near-black floor. 9 is gold whole. */
  const TONES = [[0.929, 0.918, 0.890],    // 1 white   bone   #EDEAE3
                 [0.482, 0.722, 0.435],    // 2 green   park   #7BB86F
                 [1.000, 0.373, 0.635],    // 3 pink    flare  #FF5FA2
                 [0.243, 0.498, 0.749],    // 4 blue    creek  #3E7FBF
                 [0.765, 0.604, 0.361],    // 5 orange  stairs #C39A5C
                 [0.580, 0.220, 0.247],    // 6 red     rug    #94383F
                 [0.939, 0.838, 0.598],    // 7 yellow  gold → bone .5
                 [0.353, 0.353, 0.400],    // 8 black   dim    #5A5A66
                 [0.949, 0.757, 0.306]];   // 9 gold    gold   #F2C14E
  /* and 0 is all of them: the same tones in HUE order, laid across the
     square's diagonal — red, orange, gold, yellow, green, blue, pink.
     White and black sit out, because a rainbow with them in it is not one. */
  const BOW = [TONES[5], TONES[4], TONES[8], TONES[6], TONES[1], TONES[3], TONES[2]];
  const rainbow = n => n % 10 === 0;
  const toneOf = n => TONES[(n % 10 || 10) - 1] || TONES[0];

  const PER = 8;                        // squares a room, and there is no ninth
  /* The eight in READING order — 0 1 2 / 3 · 4 / 5 6 7 — and the same eight
     in RING order, clockwise from the top left. A turn is a step round the
     ring, so it has to be the cycle that is stepped and not the reading
     order, which jumps from the top right to the middle left and would make
     a turn look like a shuffle. */
  const RING = [0, 1, 2, 4, 7, 6, 5, 3];
  const RPOS = RING.reduce((a, sq, i) => (a[sq] = i, a), []);
  const AQUA = [0.47, 0.88, 0.85], GOLD = [0.95, 0.76, 0.31];
  const GROUND = [0.106, 0.106, 0.129], BONE = [0.929, 0.918, 0.890];
  /* a number on a light tone is drawn in ground and on a dark one in bone,
     the rule focus.js uses for the letters on its diamonds. A rainbow is
     both at once, so it is given the darker ink and the tones it is made of
     were chosen without bone in them so that ink always reads. */
  const ink = t => (t[0] * 0.3 + t[1] * 0.59 + t[2] * 0.11 > 0.5 ? GROUND : BONE);
  const DONE = 1.2;                     // tiles from the end that counts as arriving
  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };

  let on = false, uid = '', room = 1, plan = null, planKey = '';
  /* the turn each room is at and what each has had taken out, by the room's
     own id — read once per palace and kept until the palace is left, because
     the numbers are asked for on every frame and by every marker */
  let cfgUid = '', turn = {}, gone = {}, swaps = [], data = {};

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
     The square index is 0..7 in READING order, the centre skipped, and it
     is what a place's id is built out of — the geometry, never the number. */
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
      sq.push({x0, y0, cx: x0 + k * cell / 2, cy: y0 + k * cell / 2});
    }
    return {squares: sq, k, cell, side: k * cell};
  }

  /* ── what the palace remembers ──────────────────────────────────────────
     Which room the trace is up to, the turn each room is at, and which of
     each room's squares have been taken out. Written as one JSON object;
     a bare integer is what this key held before any of that existed and
     still means the room number. */
  function cfg(u){
    if (!u || cfgUid === u) return;
    cfgUid = u; turn = {}; gone = {}; swaps = []; data = {}; room = 1;
    forget();
    const raw = Store.get(KEY(u)) || '';
    if (/^\d+$/.test(raw.trim())){ room = Math.max(1, parseInt(raw, 10) || 1); return; }
    let o = null;
    try { o = JSON.parse(raw); } catch (e){}
    if (!o || typeof o !== 'object') return;
    room = Math.max(1, o.room | 0 || 1);
    if (o.turn && typeof o.turn === 'object') turn = o.turn;
    if (o.gone && typeof o.gone === 'object') gone = o.gone;
    if (Array.isArray(o.swaps)) swaps = o.swaps;
    if (o.data && typeof o.data === 'object') data = o.data;
  }
  function save(){
    if (!cfgUid) return;
    Store.put(KEY(cfgUid), JSON.stringify({room, turn, gone, swaps, data}), 'the trace');
  }
  /* an undo has just rewritten this palace's key under us: read it back.
     Only the config — the markers are History's next move (apply() mounts
     them after this), so touching them here would commit the state being
     undone right back over the restore. The panel follows the place it is
     open on; the overlay's own reseat heals the rest on the next frame. */
  function remount(){
    if (!cfgUid) return;
    const u = cfgUid;
    cfgUid = '';
    cfg(u);
    forget(); plan = null;
    /* the panel says the restored truth, text fields included — the undo
       was pressed with focus on the game, so there is no typing to fight */
    if (edit && ui){
      const d = datum(edit.id) || {};
      ui.name.value = d.name || ''; ui.desc.value = d.desc || '';
      ui.note.value = d.note || ''; ui.ref.value = d.ref || '';
      fill();
    }
  }
  /* a grid edit is a gesture like a wall dragged: it steps the undo stack.
     The names build.js uses for the same two calls. */
  const hstep = () => { if (typeof History !== 'undefined' && typeof History.step === 'function') History.step(); };
  const htap = () => { if (typeof History !== 'undefined' && typeof History.tap === 'function') History.tap(); };
  const turnOf = id => ((turn[id] | 0) % PER + PER) % PER;
  const goneOf = id => (Array.isArray(gone[id]) ? gone[id] : []);
  const isGone = (id, sq) => goneOf(id).indexOf(sq) >= 0;

  /* ── every place in the palace, in the order they are walked ────────────
     Rooms in their order; inside a room, the eight squares in READING order
     turned `turn` steps round the RING, the ones taken out passed over. The
     number is the running count and nothing else — it is dense, it never
     skips, and it runs on from room to room, so taking a place out of the
     first room moves every number after it down by one.

     A place's `id` is `room * 8 + square`: the geometry, which does not
     move when the numbers do, and what a marker keeps.

     Squares that have been taken out come back too, with `n: 0`, because
     `X` has to be able to find one to put it back.

     MEMOISED FOR ONE TASK, no longer. The list is asked for several times
     a frame (the overlay, the reseat, the markers) and on every
     pointermove of a drag, and rebuilding it each time was ~90 allocations
     an ask — measured 0.0085 ms a call on the v8.3 town, so the cost was
     never the milliseconds, it was the steady GC churn. The memo is
     dropped on a microtask, so the next task — the next frame, the next
     event — computes fresh, and a room resized under the grid is stale for
     at most the task that resized it; everything in THIS file that changes
     the answer drops it eagerly, because a swap must be read back by the
     reseat on the very next line. */
  let memo = null;
  const forget = () => { memo = null; };
  function places(){
    if (memo) return memo;
    /* the palace says what its rooms are turned to, so ask the palace you
       are actually in — going in, coming out of a palace inside a palace,
       and being asked by a marker before the view has ever been up all
       reach here, and none of them is a good place to have to remember to
       mount from */
    if (typeof Interior !== 'undefined' && Interior.inside()) cfg(Interior.uid());
    const rs = rooms(), out = [];
    let n = 0;
    for (let r = 0; r < rs.length; r++){
      const g = gridFor(Kinds.geo.bbox(rs[r]));
      if (!g) break;
      const id = rs[r].room, t = turnOf(id);
      const seen = [];
      for (let j = 0; j < PER; j++){
        const sq = RING[(RPOS[j] + t) % PER];
        const s = g.squares[sq];
        const dead = isGone(id, sq);
        seen.push({id: id * PER + sq, room: r + 1, rid: id, sq: sq,
                   n: dead ? 0 : ++n, x: s.cx, y: s.cy, x0: s.x0, y0: s.y0,
                   side: g.side, k: g.k, cell: g.cell});
      }
      for (const q of seen) out.push(q);
    }
    /* the hand swaps ride on top, in the order they were made: each pair
       trades whatever numbers its two places are wearing at that point in
       the chain. A pair whose places are not both live WAITS rather than
       acts — take one of them out and the trade is suspended, put it back
       and it holds again. */
    if (swaps.length){
      const by = {};
      for (const q of out) by[q.id] = q;
      for (const pr of swaps){
        const a = by[pr[0]], b = by[pr[1]];
        if (!a || !b || !a.n || !b.n) continue;
        const t = a.n; a.n = b.n; b.n = t;
      }
    }
    memo = out;
    Promise.resolve().then(forget);
    return out;
  }
  /* the live ones, which is what everything but `X` and the drawing wants */
  const slots = () => places().filter(q => q.n);
  /* how long this palace is: every place that has a number */
  const count = () => slots().length;
  /* the place number `n` is, or nothing if the palace is not that long */
  const slotN = n => slots().find(q => q.n === n) || null;
  /* the place with id `id`, taken out or not */
  const slotId = id => places().find(q => q.id === id) || null;
  /* what number a marker holding this place is wearing today */
  const numberOf = id => { const q = slotId(id); return q ? q.n : 0; };
  const taken = (id, self) => (G.markers || []).some(m => m !== self && m.slot === id);

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
    const free = mine.filter(s => !taken(s.id, self));
    if (!free.length) return {full: true, room: hit + 1, name: rs[hit].label || ''};
    let best = free[0], bd = Infinity;
    for (const s of free){
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd){ bd = d; best = s; }
    }
    return best;
  }

  /* ── a locus goes where its place goes, and wears the number it has now ──
     Resize a room and its eight move with it; turn a room, or take a place
     out of an earlier one, and the numbers move. The loci have to follow
     both: the place IS the spot, so a marker left behind would be a locus
     that is no longer anywhere, and a marker still wearing last week's
     number would be a locus in the wrong part of the sequence. Healed at
     the moment you would notice it, which is when you look at the grid, and
     it writes only when something actually moved, so it costs nothing on a
     plan that is already square with itself. */
  function reseat(){
    if (!G.markers || !G.markers.length) return;
    const at = {};
    for (const q of places()) at[q.id] = q;
    let moved = 0;
    for (const m of G.markers){
      const q = m.slot && at[m.slot];
      if (!q) continue;
      if (Math.abs(m.x - q.x) > 1e-3 || Math.abs(m.y - q.y) > 1e-3){
        m.x = q.x; m.y = q.y; moved++;
      }
      if (m.n !== q.n){ m.n = q.n; moved++; }
    }
    if (moved) Markers.commit();
  }

  /* ── turning a room, and taking a place out ─────────────────────────────
     Both act on the room the walker is standing in, which is the room you
     are looking at — there is no selection to get wrong. */
  function roomAt(x, y){
    const rs = rooms();
    for (let r = 0; r < rs.length; r++){
      const b = Kinds.geo.bbox(rs[r]);
      if (x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) return rs[r];
    }
    return null;
  }
  const here = () => { const w = toWorld(G.x, G.y); return roomAt(w[0], w[1]); };

  /* one step round the ring. The same eight squares carry the numbers in
     another arrangement — nothing is added or taken away, so the palace is
     exactly as long afterwards as it was before. */
  function rotate(d){
    if (!on) return false;
    const r = here();
    if (!r){ note('stand in a room to turn it'); return false; }
    turn[r.room] = ((turnOf(r.room) + (d < 0 ? -1 : 1)) % PER + PER) % PER;
    forget(); save(); reseat();
    if (typeof Markers !== 'undefined'){ Markers.renumber(); Markers.commit(); }
    plan = null; hstep();
    note((r.label || 'the room') + ' turned · ' + (turnOf(r.room) + 1) + ' of ' + PER);
    return true;
  }

  /* take a place out, or put it back. A place with a locus standing in it
     is refused rather than quietly emptied — the marker is the work, and
     there is a Delete for it in build mode. `cut` is the keyboard's X and
     acts on the nearest place in the room the walker is standing in; the
     panel's button reaches `cutPlace` directly, with the place it is open
     on, from anywhere. */
  function cutPlace(q){
    const list = goneOf(q.rid).slice(), at = list.indexOf(q.sq);
    if (at >= 0){
      list.splice(at, 1);
      gone[q.rid] = list;
      forget(); save(); reseat();
      if (typeof Markers !== 'undefined'){ Markers.renumber(); Markers.commit(); }
      hstep();
      note('a place back · ' + count() + ' in the palace');
      return true;
    }
    if (taken(q.id)){ note('a locus is standing there — take the locus out first'); return false; }
    list.push(q.sq);
    gone[q.rid] = list;
    forget(); save(); reseat();
    if (typeof Markers !== 'undefined'){ Markers.renumber(); Markers.commit(); }
    hstep();
    note('place ' + q.n + ' out · ' + count() + ' in the palace');
    return true;
  }
  function cut(){
    if (!on) return false;
    const r = here();
    if (!r){ note('stand in a room to take a place out of it'); return false; }
    const w = toWorld(G.x, G.y);
    const mine = places().filter(q => q.rid === r.room);
    if (!mine.length) return false;
    let best = mine[0], bd = Infinity;
    for (const q of mine){
      const d = Math.hypot(q.x - w[0], q.y - w[1]);
      if (d < bd){ bd = d; best = q; }
    }
    return cutPlace(best);
  }

  /* one pair traded — a drag of one square onto another, or a number
     retyped in the panel. The CHAIN is what is stored, so trading the same
     two straight back cancels the pair rather than growing the list. */
  function swap(aId, bId){
    const last = swaps[swaps.length - 1];
    if (last && ((last[0] === aId && last[1] === bId) ||
                 (last[0] === bId && last[1] === aId))) swaps.pop();
    else swaps.push([aId, bId]);
    forget(); save(); reseat();
    if (typeof Markers !== 'undefined'){ Markers.renumber(); Markers.commit(); }
    hstep();
  }

  /* ── compacting the chain ───────────────────────────────────────────────
     Trades append forever, and a session of dragging can leave a chain far
     longer than the permutation it spells. On the way out of the palace it
     is folded to the fewest pairs that give the same numbering — a cycle
     walk, so the count is exactly what the permutation needs. Only when no
     pair is SUSPENDED: a pair whose places are not both live acts by where
     it sits in the chain, and folding around it would change what it does
     when its place comes back. A chain with one waits as it is. */
  function compact(){
    if (!cfgUid || !swaps.length) return;
    for (const pr of swaps){
      const a = slotId(pr[0]), b = slotId(pr[1]);
      if (!a || !b || !a.n || !b.n) return;
    }
    const want = {};
    for (const q of slots()) want[q.id] = q.n;
    const hold = swaps;
    swaps = []; forget();
    const num = {}, wear = {};
    for (const q of slots()){ num[q.id] = q.n; wear[q.n] = q.id; }
    swaps = hold; forget();
    const flat = [];
    for (const k of Object.keys(want)){
      const id = +k, goal = want[id];
      if (num[id] === goal) continue;
      const other = wear[goal], was = num[id];
      flat.push([id, other]);
      num[id] = goal; num[other] = was;
      wear[goal] = id; wear[was] = other;
    }
    if (flat.length < hold.length){
      swaps = flat; forget(); save();
    }
  }

  /* ── the editor ─────────────────────────────────────────────────────────
     One panel (#place in index.html), filled from the square that was
     clicked. `edit` keeps only the place ID — the numbers move, so the
     place is looked up fresh every time it is drawn or written to. The
     fields land in `data[id]` beside the turns and cuts; the picture goes
     to the loci store under `place:<palace>:<id>`, which keeps a
     photograph out of localStorage for the same reason a locus's is
     (src/loci.js). */
  let edit = null, ui = null, saveT = 0;
  const datum = id => data[id] || null;
  function setDatum(id, field, v){
    const d = data[id] || (data[id] = {});
    if (v) d[field] = v; else delete d[field];
    if (!Object.keys(d).length) delete data[id];
    /* saved a beat after the last keystroke, and the save is a tap — the
       quiet-period sample build.js uses for drags, so a burst of typing is
       one undo step, not forty */
    clearTimeout(saveT); saveT = setTimeout(() => { save(); htap(); }, 400);
  }
  const pkey = id => 'place:' + cfgUid + ':' + id;

  function fill(){
    if (!edit || !ui) return;
    const q = slotId(edit.id);
    if (!q){ closeEdit(); return; }
    const r = rooms()[q.room - 1];
    ui.no.textContent = q.n ? String(q.n) : '·';
    ui.room.textContent = (r && r.label) || ('room ' + q.room);
    ui.num.value = q.n ? String(q.n) : '';
    ui.num.disabled = !q.n;
    const has = typeof Loci !== 'undefined' && Loci.has(pkey(q.id));
    ui.pic.textContent = has ? 'Replace picture' : 'Attach picture';
    ui.view.hidden = !has;
    ui.off.hidden = !has;
    ui.out.textContent = q.n ? 'Take this place out' : 'Put this place back';
  }
  function wireEdit(){
    const root = $('#place');
    if (!root) return;
    ui = {root,
          no: root.querySelector('#plno'), room: root.querySelector('#plroom'),
          num: root.querySelector('#plnum'), name: root.querySelector('#plname'),
          desc: root.querySelector('#pldesc'), note: root.querySelector('#plnote'),
          ref: root.querySelector('#plref'), pic: root.querySelector('#plpic'),
          view: root.querySelector('#plview'), off: root.querySelector('#plpicoff'),
          out: root.querySelector('#plout'), close: root.querySelector('#plclose')};
    const field = (el, f) => el.addEventListener('input', () => {
      if (edit) setDatum(edit.id, f, el.value.trim());
    });
    field(ui.name, 'name'); field(ui.desc, 'desc');
    field(ui.note, 'note'); field(ui.ref, 'ref');
    /* the number retyped IS a trade: the place wearing the number you
       asked for takes yours, so the palace stays dense and stays the same
       length — there is no way to type a hole into it */
    const renumber = () => {
      const q = edit && slotId(edit.id);
      if (!q || !q.n) return;
      const want = parseInt(ui.num.value, 10);
      if (!want || want === q.n){ ui.num.value = String(q.n); return; }
      const t = slotN(want);
      if (!t){ note('the palace is ' + count() + ' places long'); ui.num.value = String(q.n); return; }
      note('place ' + q.n + ' and place ' + want + ' traded numbers');
      swap(q.id, t.id);
      fill();
    };
    ui.num.addEventListener('change', renumber);
    ui.num.addEventListener('keydown', e => { if (e.key === 'Enter') renumber(); });
    ui.pic.addEventListener('click', () => { if (edit) Loci.pick({uid: pkey(edit.id)}); });
    ui.view.addEventListener('click', () => {
      if (!edit) return;
      const q = slotId(edit.id), d = datum(edit.id) || {};
      Loci.show({uid: pkey(edit.id), n: q ? q.n : 0, name: d.name || ''});
    });
    ui.off.addEventListener('click', () => {
      if (edit) Loci.detach({uid: pkey(edit.id)});
      fill();
    });
    ui.out.addEventListener('click', () => {
      const q = edit && slotId(edit.id);
      if (q) cutPlace(q);
      fill();
    });
    ui.close.addEventListener('click', () => closeEdit());
    /* Esc pressed while typing never reaches the game's keydown (it skips
       inputs), so the panel answers it itself */
    root.addEventListener('keydown', e => {
      if (e.key === 'Escape'){ e.stopPropagation(); closeEdit(); }
    });
  }
  function openEdit(q){
    if (!ui) wireEdit();
    if (!ui) return;
    edit = {id: q.id};
    const d = datum(q.id) || {};
    ui.name.value = d.name || ''; ui.desc.value = d.desc || '';
    ui.note.value = d.note || ''; ui.ref.value = d.ref || '';
    fill();
    ui.root.hidden = false;
  }
  function closeEdit(){
    if (!edit) return false;
    edit = null;
    if (ui) ui.root.hidden = true;
    return true;
  }
  /* loci.js says when a picture has landed, so an open panel can say so */
  function picture(u){
    if (edit && ui && u === pkey(edit.id)) fill();
  }

  /* ── the pointer on the grid ────────────────────────────────────────────
     Capture-phase on the window, the way the compass takes its drag
     (src/compass.js): only a press that lands on a square is taken, so
     build mode and everything under the view lose nothing. A CLICK opens
     the place; a DRAG that ends on another live square trades their
     numbers. */
  let press = null, dragQ = null, dragAt = null, dragX = 0, dragY = 0;
  const evWorld = ev => {
    const b = canvas.getBoundingClientRect(), k = VW / (b.width || 1);
    return [((ev.clientX - b.left) * k - VW / 2) / G.cam[2] + G.cam[0],
            ((ev.clientY - b.top) * k - VH / 2) / G.cam[2] + G.cam[1]];
  };
  function squareAt(x, y){
    for (const q of places())
      if (x >= q.x0 && x <= q.x0 + q.side && y >= q.y0 && y <= q.y0 + q.side)
        return q;
    return null;
  }
  function wire(){
    addEventListener('pointerdown', e => {
      if (!on || e.button !== 0 || e.target !== canvas || G.paused) return;
      if (typeof Interior === 'undefined' || !Interior.inside()) return;
      if (typeof Loci !== 'undefined' && Loci.opened()) return;
      const w = evWorld(e), q = squareAt(w[0], w[1]);
      if (!q) return;
      press = {q, x: w[0], y: w[1]};
      dragQ = null; dragAt = null;
      e.stopPropagation(); e.preventDefault();
    }, true);
    addEventListener('pointermove', e => {
      if (!press) return;
      const w = evWorld(e);
      dragX = w[0]; dragY = w[1];
      /* a ghost is clicked back, never dragged — it has no number to trade */
      if (!dragQ && press.q.n &&
          Math.hypot(w[0] - press.x, w[1] - press.y) > press.q.side * 0.35)
        dragQ = press.q;
      if (dragQ){
        const t = squareAt(w[0], w[1]);
        dragAt = t && t.id !== dragQ.id && t.n ? t : null;
      }
      e.stopPropagation();
    }, true);
    const up = e => {
      if (!press) return;
      if (dragQ){
        /* the trade is judged where the button came up, not where the
           pointer last passed — a release in empty space is a change of
           mind, not a drop on the last square the drag crossed */
        const w = evWorld(e), t = squareAt(w[0], w[1]);
        const at = t && t.id !== dragQ.id && t.n ? t : null;
        if (at){
          note('place ' + dragQ.n + ' and place ' + at.n + ' traded numbers');
          swap(dragQ.id, at.id);
          if (edit) fill();
        }
      }
      else openEdit(press.q);
      press = null; dragQ = null; dragAt = null;
      e.stopPropagation();
    };
    addEventListener('pointerup', up, true);
    addEventListener('pointercancel', () => { press = null; dragQ = null; dragAt = null; }, true);
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

    /* every room's places, the room you are up to whole and the rest faint —
       the grid is the view, and which room the trace has reached is said by
       weight rather than by drawing only one of them. A place that has been
       taken out is not a place, but while the view is up it stands as a
       GHOST — the dim tone, no number — because the hand needs something
       to click to put it back. */
    for (const q of places()){
      if (!q.n){
        const gh = q.room === p.room ? 0.12 : 0.05;
        for (let j = 0; j < q.k; j++) for (let i = 0; i < q.k; i++){
          if (m > cap - 4) return m;
          m = put(a, m, q.x0 + (i + 0.5) * q.cell, q.y0 + (j + 0.5) * q.cell,
                  TONES[7][0], TONES[7][1], TONES[7][2], gh, q.cell, 0, 0, 0, 1);
        }
        continue;
      }
      const mine = q.room === p.room;
      const al = mine ? 0.92 : 0.3;
      /* the tone is the NUMBER's, not the square's, so it travels with the
         number when the room is turned or a place before it is taken out.
         A ten is every tone at once, laid in hue order across the square's
         own diagonal — the rainbow is made of the cells, not of a colour. */
      const bow = rainbow(q.n), t = toneOf(q.n);
      for (let j = 0; j < q.k; j++) for (let i = 0; i < q.k; i++){
        if (m > cap - 4) return m;
        const c = bow ? BOW[(i + j) % BOW.length] : t;
        m = put(a, m, q.x0 + (i + 0.5) * q.cell, q.y0 + (j + 0.5) * q.cell,
                c[0], c[1], c[2], al, q.cell, 0, 0, 0, 1);
      }
      /* and its number, in the square's own corner where a marker standing
         in the middle of the place cannot cover it */
      const r = Math.max(q.side * 0.24, 4 * px);
      if (r * z > 3)
        m = num(a, m, q.n, q.x0 + q.side * 0.32, q.y0 + q.side * 0.30, r,
                bow ? BONE : ink(t), mine ? 0.95 : 0.5, cap);
    }

    /* the hand: a ring on the place whose panel is open, and while a
       square is being dragged, a ring on it, a ring riding the pointer,
       and a heavier one on the square it would trade with */
    if (edit && m <= cap - 4){
      const q = slotId(edit.id);
      if (q) m = put(a, m, q.x, q.y, GOLD[0], GOLD[1], GOLD[2], 0.8,
                     Math.max(q.side * 0.75, 10 * px), 1, 0, 0, 1);
    }
    if (dragQ && m <= cap - 12){
      m = put(a, m, dragQ.x, dragQ.y, GOLD[0], GOLD[1], GOLD[2], 0.45,
              Math.max(dragQ.side * 0.7, 9 * px), 1, 0, 0, 1);
      if (dragAt)
        m = put(a, m, dragAt.x, dragAt.y, GOLD[0], GOLD[1], GOLD[2], 0.9,
                Math.max(dragAt.side * 0.8, 11 * px), 1, 0, 0, 1);
      m = put(a, m, dragX, dragY, GOLD[0], GOLD[1], GOLD[2], 0.8,
              Math.max(G.A.cell * 2, 7 * px), 1, 0, 0, 1);
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

  function toggle(){
    if (typeof Interior === 'undefined' || !Interior.inside()){
      note('minimal is a view of a plan — go inside a place first'); return false;
    }
    on = !on;
    if (!on) closeEdit();
    if (on){ uid = Interior.uid(); cfg(uid); plan = null; }
    Build.setMinimal(on);
    if (typeof restampTerrain === 'function') restampTerrain();
    const p = on ? build() : null;
    note(on ? (p ? 'minimal · room ' + p.room + ' of ' + p.of + ' · ' + count() +
                   ' places · [ ] turn · X out · click a place to open it · drag to swap'
                 : 'minimal · this plan has no rooms to trace')
            : 'the plan as it was');
    return on;
  }
  /* Leaving the building takes the view with it; what the palace remembers
     stays in its key. The config is dropped whether or not the view was up,
     because the next palace's turns and cuts are not this one's — and a
     marker asks for its number the moment its plan is mounted. */
  function off(){
    compact();
    closeEdit();
    on = false; plan = null; cfgUid = ''; turn = {}; gone = {}; swaps = []; data = {}; room = 1;
    forget();
    if (typeof Build !== 'undefined') Build.setMinimal(false);
  }
  function reset(){ room = 1; plan = null; if (cfgUid) save(); }

  wire();

  return {toggle, off, reset, overlay, step, rotate, cut, reseat,
          slots, places, slotN, slotId, numberOf, count, drop,
          /* the panel: game.js walks Esc through it, loci.js says when a
             picture has landed */
          editing: () => !!edit, closeEdit, picture, remount,
          /* the numbers are asked for by markers.js while the view is down,
             so the palace's turns and cuts have to be readable then too */
          mount: u => cfg(u), per: () => PER,
          on: () => on, room: () => room};
})();
