'use strict';
/* ── interiors ──────────────────────────────────────────────────────────
   A marker is a place. Stand next to one, press Enter, and the plate you
   are looking at becomes that place's floor plan.

   Nothing is simulated twice. Inside is the same engine on a different set
   of shapes: the same lattice cells, the same walk grid, the same walker
   stepping between the same tiles. Three things swap and nothing else —
   which registry of kinds the palette is built from, which key the shapes
   are saved under, and which markers are pinned. Build mode is not told
   which of the two it is editing, because there is nothing it would do
   differently.

   Going in is a stack, not a flag. The frame pushed on the way in holds the
   half of the world that is not in storage — where the walker was standing,
   where the camera was looking, the round in progress — so a marker inside
   a building is a door like any other, and coming back out puts you exactly
   where you left.

   The plan itself lives in the browser profile beside the town, under
   `hq.rooms.<marker>`, and the ring drawn round a marker on the map is only
   reading which of those keys hold anything. */

const Interior = (() => {
  const PRE = 'hq.rooms.';
  const SKEY = uid => PRE + uid;
  const MKEY = uid => 'hq.marks.' + uid;
  const REACH = 1.6;                 // walk tiles: how close counts as "by the door"

  let stack = [], have = {}, shown = null;

  /* Which markers have a plan is read off the plans themselves rather than
     kept in an index beside them. An index has to be written at exactly the
     right moment and is wrong if it is not — close the window while you are
     still inside and the ring would be missing from a room that exists. */
  function survey(){
    have = {};
    try {
      for (let i = 0; i < localStorage.length; i++){
        const k = localStorage.key(i);
        if (k.indexOf(PRE) !== 0) continue;
        const v = localStorage.getItem(k);
        if (v && v !== '[]') have[k.slice(PRE.length)] = 1;
      }
    } catch (e){}
  }

  const glyph = mk => (Markers.glyphs()[mk.gi] || '◆');
  const label = mk => (mk.name || '').trim() || glyph(mk);
  const loaded = mk => typeof Loci !== 'undefined' && Loci.has(mk.uid);
  const locus = mk => (mk.n ? mk.n + ' · ' : '') + label(mk);

  /* the marker the walker is standing on or beside */
  function target(){
    if (!G.terr || !G.markers || !G.markers.length) return null;
    const w = toWorld(G.x, G.y);
    return Markers.nearest(w[0], w[1], G.terr.tsz * REACH);
  }

  /* ── in ── */
  function enter(mk){
    mk = mk || target();
    if (!mk || !mk.uid || !G.terr) return false;
    Build.commit(); Markers.commit();
    stack.push({
      uid: mk.uid, name: label(mk), scope: Kinds.scope(),
      skey: Build.key(), mkey: Markers.key(), blank: BLANK,
      x: G.x, y: G.y, cam: G.cam.slice(), camT: G.camT.slice(),
      sparks: G.sparks, got: G.got, total: G.total, round: G.round,
      clock: G.clock, steps: G.steps, over: G.over, msg: G.msg
    });
    Basemap.suspend(true);
    Markers.mount(MKEY(mk.uid));
    Build.mount('floor', SKEY(mk.uid));
    /* a floor plan is never drawn over the printed map, whatever the plate
       is set to outside — and the flag is not written back, so coming out
       finds the town exactly as it was left */
    setBlank(true, false);
    G.round = 1; G.msg = ''; G.over = false;
    spawn();
    G.total = 12;
    scatterSparks();
    banner();
    /* A palace with nothing in it is the one moment where "what rooms?" is
       always the right question, so the order box asks it without being
       sent for. A palace you have already built stays as you left it. */
    if (typeof Palace !== 'undefined' && !G.shapes.length) Palace.show();
    else if (typeof Palace !== 'undefined') Palace.close();
    return true;
  }

  /* ── out ── */
  function leave(){
    if (!stack.length) return false;
    Build.commit(); Markers.commit();
    const f = stack.pop();
    survey();                                  // this plan may have just begun to exist
    Markers.mount(f.mkey);
    Build.mount(f.scope, f.skey);
    setBlank(f.blank, false);
    /* put the walker back on the tile it stepped in from, not near it */
    G.x = f.x; G.y = f.y;
    const w = toWorld(G.x, G.y);
    G.fx = G.tx = w[0]; G.fy = G.ty = w[1];
    G.moving = false; G.stepT = 1;
    G.cam = f.cam; G.camT = f.camT;
    G.sparks = f.sparks; G.got = f.got; G.total = f.total; G.round = f.round;
    G.clock = f.clock; G.steps = f.steps; G.over = f.over; G.msg = f.msg;
    if (typeof Palace !== 'undefined') Palace.close();
    revalidate();
    Basemap.suspend(stack.length > 0);
    hud(true);
    banner();
    return true;
  }

  /* ── the two things on screen that say where you are ── */
  function banner(){
    const el = $('#inside');
    document.body.classList.toggle('inside', stack.length > 0);
    if (!el) return;
    el.hidden = !stack.length;
    if (!stack.length) return;
    el.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = stack.length > 1 ? 'Inside ×' + stack.length : 'Inside';
    const n = document.createElement('span');
    n.textContent = stack[stack.length - 1].name;
    const e = document.createElement('em');
    e.textContent = 'Esc leaves';
    el.append(b, n, e);
    shown = null;
  }

  /* the prompt under the walker, refreshed only when what it says changes */
  function prompt(){
    const el = $('#enterhint');
    if (!el || WALL) return;
    const mk = G.paused ? null : target();
    const key = mk ? mk.uid + '|' + label(mk) + '|' + (mk.n || 0) + '|' +
                     (stack.length ? (loaded(mk) ? 1 : 0) : (has(mk.uid) ? 1 : 0)) : '';
    if (key === shown) return;
    shown = key;
    el.hidden = !mk;
    if (!mk) return;
    el.innerHTML = '';
    const e = document.createElement('em');
    e.textContent = 'Enter';
    const n = document.createElement('span');
    /* Enter always opens what the marker holds; what that is depends on
       where you are standing. Out on the town a marker is a door into a
       room. Inside one it is a locus, and what it holds is the picture of
       whatever stands there — or the chance to say. */
    n.textContent = stack.length
      ? (loaded(mk) ? 'look at ' : 'add a picture to ') + locus(mk)
      : (has(mk.uid) ? 'go inside ' : 'plan out ') + label(mk);
    el.append(e, n);
  }

  /* ── a sheet of register marks, so an empty plan is not a void ────────
     Only while you are building, only every fourth tile, and brighter every
     sixteenth — enough to judge a room against, far too faint to draw on. */
  function overlay(a, m, cap){
    if (!stack.length || !Build.active() || !G.terr || WALL) return m;
    const z = G.cam[2], ts = G.terr.tsz;
    /* Every fourth tile is enough to judge a room against and far too coarse
       to aim a tool at, so while one is being aimed the grid comes down to
       the tile — and only then, because a lattice this fine standing there
       all the time is a sheet of graph paper you are trying to draw a house
       on. It thins back out when the diamonds get too small to tell apart. */
    const aim = Build.aiming();
    let step = ts * (aim ? 1 : 4);
    while (step * z < 7) step *= 2;
    const hw = VW / (2 * z), hh = VH / (2 * z);
    const x0 = Math.floor((G.cam[0] - hw) / step) * step;
    const y0 = Math.floor((G.cam[1] - hh) / step) * step;
    const x1 = G.cam[0] + hw, y1 = G.cam[1] + hh;
    const r = Math.max(0.9 / z, ts * (aim ? 0.06 : 0.045));
    const every = Math.max(1, Math.round(ts * 4 / step));
    /* Resting, it is the colour of the page and nearly not there. Being
       aimed at, it is aqua and plainly a tool — a grid you cannot see over
       the floor you are aiming at is a grid that is not helping, and this
       one is only up while a tool is armed. */
    const c = aim ? [0.47, 0.88, 0.85] : [0.45, 0.45, 0.55];
    for (let y = y0; y <= y1; y += step)
      for (let x = x0; x <= x1; x += step){
        if (m > cap - 2) return m;
        const big = Math.round(x / step) % every === 0 && Math.round(y / step) % every === 0;
        m = put(a, m, x, y, c[0], c[1], c[2],
                big ? (aim ? 0.6 : 0.4) : (aim ? 0.3 : 0.2),
                big ? r * 1.5 : r, 0, 0, 0, 1);
      }
    return m;
  }

  const has = uid => !!(uid && have[uid]);
  function init(){ survey(); banner(); }

  /* The palace's name is the name of the marker you came in through, and
     that marker is not mounted while you are inside it — the town's list is,
     so the rename goes to storage and to the frame that is standing in for
     it. One name, in the one place it already lived. */
  function rename(v){
    if (!stack.length) return false;
    const f = stack[stack.length - 1];
    f.name = String(v || '').slice(0, 28);
    try {
      const list = JSON.parse(localStorage.getItem(f.mkey) || '[]');
      const mk = (Array.isArray(list) ? list : []).find(x => x && x.uid === f.uid);
      if (mk){ mk.name = f.name; localStorage.setItem(f.mkey, JSON.stringify(list)); }
      if (typeof hqStoreOK === 'function') hqStoreOK('this palace name');
    } catch (e){ if (typeof hqStoreFail === 'function') hqStoreFail('this palace name', e); }
    banner();
    return true;
  }

  /* `at` is the palace's NAME, for the banner and the title; `uid` is the
     palace's identity, for anything that has a key to build out of it.
     They are both read off the same frame because there is only one frame
     to read — which is what stops a caller keeping its own copy of either
     and finding out later that it had gone stale. */
  return {init, enter, leave, prompt, overlay, has, target, rename,
          inside: () => stack.length > 0, depth: () => stack.length,
          at: () => (stack.length ? stack[stack.length - 1].name : ''),
          uid: () => (stack.length ? stack[stack.length - 1].uid : '')};
})();
