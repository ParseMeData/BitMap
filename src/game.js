'use strict';
/* ── MEMORY QUEST V4.6 ── desktop build ───────────────────────────────
   Walk the living map, collect every spark. The plate underneath you is
   one static GPU buffer that breathes on its own; the game layer is a
   few dozen instances streamed each frame. */

const $ = s => document.querySelector(s);
const RGBV = {bone: [237, 234, 227], flare: [255, 95, 162], aqua: [121, 224, 216],
              gold: [242, 193, 78], violet: [167, 139, 250]};
const PAL = [RGBV.bone, RGBV.flare, RGBV.aqua, RGBV.gold, RGBV.violet];
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

/* ?wallpaper=1 turns the game into a live desktop plate: no HUD, no
   pause-on-blur (a background window is never focused), a slow drift over
   the map, and a frame cap so it costs the iGPU almost nothing. Press a
   movement key and the walker wakes up — which is the whole point of an
   overlay window over a Plasma wallpaper, since a wallpaper takes no input. */
const Q = new URLSearchParams(location.search);
const WALL = Q.has('wallpaper');
const CAP = +(Q.get('fps') || (WALL ? 30 : 0));            // 0 = uncapped
const DPRCAP = +(Q.get('dpr') || (WALL ? 1.25 : 2));
const SLEEP_AFTER = +(Q.get('sleep') || 25);               // seconds idle → drift again

const defTune = () => ({cols: 176, bri: 0.25, con: 2, edge: 0, ink: -1,
                        churn: 1, scatter: 0, szv: 0, cvar: 1, sat: 1.15, path: 1,
                        glow: 0.45});
/* How big the walker is against a walk tile. It is the one thing on the
   plate that is not terrain, so it carries its own scale rather than
   inheriting the tile size the way sparks and rings do. */
const WALKER = 1.35;
let T = defTune();

const PRESETS = [
  ['DIALLED',   {bri: .25, con: 2,   churn: 1,  scatter: 0,  szv: 0,  cvar: 1,   sat: 1.15, path: 1,   ink: -1}],
  ['WAYFIND',   {bri: .20, con: 1.7, churn: .5, scatter: 0,  szv: 0,  cvar: .15, sat: 1.4,  path: 2,   ink: -1}],
  ['CARTOGRAPH',{bri: .10, con: 1.4, churn: .4, scatter: 0,  szv: .4, cvar: .1,  sat: 1.2,  path: 1.4, ink: -1}],
  ['NEON',      {bri: .15, con: 2,   churn: 1.6,scatter: .2, szv: .6, cvar: .7,  sat: 2,    path: 1,   ink: -1}],
  ['CALM',      {bri: 0,   con: 1.2, churn: .25,scatter: 0,  szv: 0,  cvar: .1,  sat: 1,    path: .8,  ink: -1}],
  ['STORM',     {bri: .10, con: 1.8, churn: 2,  scatter: 1.6,szv: 1.8,cvar: .9,  sat: 1.3,  path: 0,   ink: -1}],
  ['PASTEL',    {bri: .30, con: .8,  churn: .8, scatter: .3, szv: .5, cvar: .3,  sat: .6,   path: 1,   ink: -1}],
  ['EMBERS',    {bri: -.1, con: 1.6, churn: 1.2,scatter: .5, szv: 1.4,cvar: .8,  sat: .85,  path: .6,  ink: -1}],
  ['BONE MAP',  {bri: .15, con: 1.6, churn: .6, scatter: 0,  szv: .4, cvar: .25, sat: 1,    path: 1.6, ink: 0}],
  ['BLUEPRINT', {bri: .10, con: 2,   churn: .7, scatter: 0,  szv: .3, cvar: .2,  sat: 1,    path: 1.6, ink: 2}],
];

/* ── state ── */
const G = {
  W: 0, H: 0, px: null, A: null, terr: null, terrBase: null, terrPrint: null,
  shapes: [], markers: [],
  cellsPerTile: 4,
  cam: [0, 0, 1], camT: [0, 0, 1], fitW: 1, fitAll: 1,
  x: 0, y: 0, fx: 0, fy: 0, tx: 0, ty: 0, face: [0, 1],
  stepT: 0, stepDur: 0.14, stepScale: 1, moving: false, bump: false, cool: 0,
  reach: null, sparks: [], rings: [], total: 12, got: 0, round: 1, steps: 0,
  paused: false, over: false, burst: -1, pending: null, msg: '',
  wake: !WALL, idleFor: 0, drift: null, nextBurst: 0
};

const canvas = $('#gl');
let R;
try { R = new Renderer(canvas); }
catch (e){ fatal(e); }

/* Say what actually happened. "no WebGL2" is almost never true on a machine
   that had it a minute ago — far more often the context was refused because
   this window belongs to a stale browser instance, so check a fresh canvas
   before blaming the browser, and count reloads to catch a relaunch loop. */
function fatal(e){
  let probe = false;
  try { probe = !!document.createElement('canvas').getContext('webgl2'); } catch (err){}
  let loads = [];
  try {
    loads = JSON.parse(Store.get('hq.loads') || '[]').filter(t => Date.now() - t < 60000);
    loads.push(Date.now());
    Store.set('hq.loads', JSON.stringify(loads.slice(-20)));
  } catch (err){}

  const head = probe ? 'graphics context refused' : 'this build needs WebGL2';
  const why = probe
    ? 'WebGL2 works in this browser, so the context was refused for this window.\n' +
      'That usually means a stale instance is still holding the profile — close\n' +
      'every Memory Quest Low Effort window and relaunch.'
    : 'This browser could not create a WebGL2 context at all.';
  const loop = loads.length > 3
    ? '\n\nThis page has loaded ' + loads.length + ' times in the last minute — something\n' +
      'is relaunching it. Close the windows before trying again.'
    : '';
  const f = $('#fatal');
  f.hidden = false;
  $('#fatalhead').textContent = head;
  $('#fatalmsg').textContent = why + loop + '\n\n' + (e && (e.message || e));
  document.title = 'Memory Quest Low Effort — ' + head;
}

const ENTMAX = 32768;          // raised 2026-08-29 for mats at one diamond a cell
const ENT = new Float32Array(ENTMAX * 17);
const DPR = () => Math.min(window.devicePixelRatio || 1, DPRCAP);
let VW = 1, VH = 1;

/* ── the plate: the printed map, or nothing ─────────────────────────────
   A map builder wants to start from an empty sheet as often as it wants to
   start from The Mighty Haunt. Blank keeps the source art exactly where it
   is and simply does not draw it — and takes the printed routes out of the
   walk grid with it, so the only ground that exists is ground you drew.
   Nothing is destroyed, so the printed map comes back on a restamp. */
/* Always blank, since 2026-08-28: Eden asked never to see the printed
   sheet again — it is an old reference image, and the town is drawn over
   the traced underlay of the place it is. The art stays in assets/ because
   the plate's size and the walk grid's base are still measured off it;
   it is simply never drawn, and `hq.blank` is no longer read. */
let BLANK = true;

/* ── the sparks ─────────────────────────────────────────────────────────
   The round is the game this started as, and it is in the way of the game
   it is becoming: a floor plan you are laying out does not want twelve gold
   diamonds scattered over it. So they are a switch, off by default, and the
   round machinery underneath is untouched — turn them back on and the
   deal-and-collect loop is exactly where it was. */
let SPARKS = false;
try { SPARKS = Store.get('hq.sparks') === '1'; } catch (e){}
function setSparks(v){
  SPARKS = !!v;
  try { Store.set('hq.sparks', SPARKS ? '1' : '0'); } catch (e){}
  G.got = 0; G.sparks.length = 0;
  G.total = roundTotal();
  scatterSparks();
  if (typeof syncPanel === 'function') syncPanel();
}

/* ── build ── */
function analyse(){
  G.A = Lattice.analyse(G.px, G.W, G.H, plateCols(), T);
}
function compose(upload){
  const buf = BLANK ? new Float32Array(0) : Lattice.compose(G.A, T);
  if (upload !== false){ G.plate = buf; R.batch('lattice', buf, R.gl.STATIC_DRAW); }
  return buf;
}
/* the classifier's reading of the printed map is kept whole either way, so
   turning the plate back on costs a restamp and nothing else */
function applyPlate(){
  if (!G.terr || !G.terrPrint || !G.terrBase) return;
  if (BLANK){ G.terrBase.walk.fill(0); G.terrBase.path.fill(0); }
  else { G.terrBase.walk.set(G.terrPrint.walk); G.terrBase.path.set(G.terrPrint.path); }
  restampTerrain();
}
/* ── the towns: the region, or the country ──────────────────────────────
   The compass's fourth diamond opens where the towns are. It used to open
   Australia (src/towns.js); Eden asked for that hidden behind a switch,
   with our own region drawn flat as a plate of its own in its place
   (src/region.js). The country is kept whole — its asset, its page, its
   pin — and is one chip away in the tune panel, resting on Region. */
let TOWNS = 'region';
try { TOWNS = Store.get('hq.towns') === 'country' ? 'country' : 'region'; } catch (e){}
function setTowns(v){
  TOWNS = v === 'country' ? 'country' : 'region';
  try { Store.set('hq.towns', TOWNS); } catch (e){}
  if (typeof syncPanel === 'function') syncPanel();
}
/* what the rose diamond opens, decided at the press rather than at boot so
   the chip takes effect at once; the atlas's chip grid is the fallback the
   towns map always had, and it stays the fallback for the region too */
function openTowns(){
  if (TOWNS === 'country' && typeof Towns !== 'undefined') return Towns.toggle();
  if (typeof Region !== 'undefined') return Region.toggle();
  if (typeof Towns !== 'undefined') return Towns.toggle();
  return Atlas.toggleMap();
}

/* `persist` is false when the plate is being forced rather than chosen —
   going inside a building blanks it whatever the town is set to, and the
   town's own setting has to still be there when you come back out. */
function setBlank(v, persist){
  BLANK = true;                        // the printed map is never shown (see BLANK above)
  compose();
  /* applyPlate restamps, and restamping already revalidates the round: a
     blank sheet has nowhere to stand and nothing to collect until a road is
     drawn, so the walker is rescued and stranded sparks are pruned there */
  applyPlate();
  /* Changing the plate changes the map, so the round is dealt again rather
     than patched. It has to be dealt from the round's own count: going blank
     strands every spark, and scatterSparks() ends by setting G.total to how
     many it managed to place — so on a blank sheet that lands at zero, and
     without putting the count back nothing would ever be placed again.
     spawn() is deliberately not called: it recentres the camera, and having
     the view jump underneath you while building is worse than a walker left
     standing where it was. restampTerrain() has already rescued it. */
  G.got = 0; G.sparks.length = 0;
  G.total = Math.min(24, 12 + (G.round - 1) * 2);
  scatterSparks();
}
/* recrystallise: blow the plate apart, swap the arrangement at the peak */
function recrystallise(){
  if (!G.A || G.burst >= 0) return;
  G.pending = compose(false);
  G.burst = 0;
}

/* ── world helpers ── */
/* Only the route carries you. Open ground is scenery until something is
   drawn across it — a road now, a path or a trail later — so the walker can
   never wander off the map or across a field. */
const wAt = (x, y) => {
  const t = G.terr;
  return x >= 0 && y >= 0 && x < t.tw && y < t.th && t.path[y * t.tw + x];
};

/* Where you can actually step from here. Straight ahead if the route runs
   straight; otherwise the diagonal it turns onto — so a road drawn at an
   angle walks with one key, and the walker stays locked to the line.
   Movement and reachability share this, so a spark is never placed
   somewhere the movement rule cannot actually take you. */
const DIR4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function steps(x, y, out){
  out.length = 0;
  for (const [dx, dy] of DIR4){
    if (wAt(x + dx, y + dy)){ out.push(x + dx, y + dy); continue; }
    const alts = dx ? [[dx, -1], [dx, 1]] : [[-1, dy], [1, dy]];
    for (const [ax, ay] of alts) if (wAt(x + ax, y + ay)) out.push(x + ax, y + ay);
  }
  return out;
}
const tileW = () => G.terr.tsz;
const toWorld = (tx, ty) => [(tx + 0.5) * G.terr.tsz, (ty + 0.5) * G.terr.tsz];

/* flood the walkable set from the spawn tile — a spark stranded on an
   island the player cannot reach would make the round uncompletable */
function floodReach(){
  const t = G.terr, n = t.tw * t.th;
  const seen = new Uint8Array(n), stack = [G.x, G.y], out = [];
  seen[G.y * t.tw + G.x] = 1;
  while (stack.length){
    const y = stack.pop(), x = stack.pop();
    steps(x, y, out);
    for (let i = 0; i < out.length; i += 2){
      const k = out[i + 1] * t.tw + out[i];
      if (seen[k]) continue;
      seen[k] = 1; stack.push(out[i], out[i + 1]);
    }
  }
  G.reach = seen;
}

function scatterSparks(){
  if (!G.terr || !G.reach) return;
  G.sparks.length = 0; G.got = 0; G.steps = 0; G.over = false; G.msg = '';
  if (!SPARKS){ G.total = 0; hud(true); return; }
  const t = G.terr, cand = [];
  for (let y = 0; y < t.th; y++)
    for (let x = 0; x < t.tw; x++)
      if (G.reach[y * t.tw + x] && !(x === G.x && y === G.y)) cand.push(x, y);
  for (let i = cand.length / 2 - 1; i > 0; i--){          // shuffle in pairs
    const j = (Math.random() * (i + 1)) | 0;
    const a = cand[i * 2], b = cand[i * 2 + 1];
    cand[i * 2] = cand[j * 2]; cand[i * 2 + 1] = cand[j * 2 + 1];
    cand[j * 2] = a; cand[j * 2 + 1] = b;
  }
  /* spread them out as far as the playfield allows, then relax until they fit */
  for (let sep = 5; sep >= 1 && G.sparks.length < G.total; sep--)
    for (let i = 0; i < cand.length && G.sparks.length < G.total; i += 2){
      const x = cand[i], y = cand[i + 1];
      if (G.sparks.some(s => Math.max(Math.abs(s.x - x), Math.abs(s.y - y)) < sep)) continue;
      G.sparks.push({x, y, ph: Math.random() * 6.28});
    }
  G.total = G.sparks.length;
  hud(true);
}

function spawn(){
  if (!G.terr) return;
  let best = null;
  const t = G.terr;
  for (let y = t.th - 1; y >= 0 && !best; y--)
    for (let x = 0; x < t.tw; x++)
      if (t.path[y * t.tw + x] &&
          (!best || Math.abs(x - t.tw / 2) < Math.abs(best[0] - t.tw / 2))) best = [x, y];
  if (!best) best = [t.tw >> 1, t.th >> 1];
  G.x = G.tx = best[0]; G.y = G.ty = best[1];
  const w = toWorld(G.x, G.y);
  G.fx = w[0]; G.fy = w[1];
  G.cam[0] = G.camT[0] = w[0]; G.cam[1] = G.camT[1] = w[1];
  floodReach();
}


/* ── shapes → terrain ───────────────────────────────────────────────────
   Anything built in build mode has to reach the walker, not just the eye.
   Restamp the walk grid from the pristine base, then make the round make
   sense again: the walker cannot be left standing in a lake, and a spark
   cannot be left behind a wall it is now impossible to walk around. */
function restampTerrain(){
  if (!G.terr || !G.terrBase) return;
  G.terr.walk.set(G.terrBase.walk);
  G.terr.path.set(G.terrBase.path);
  Build.stamp(G.terr);
  /* and then what has eaten the road (src/distract.js) */
  if (typeof Distract !== 'undefined') Distract.stamp(G.terr);
  if (G.reach) revalidate();
}

function revalidate(){
  if (!wAt(G.x, G.y)) rescue();
  floodReach();
  const t = G.terr;
  G.sparks = G.sparks.filter(s => G.reach[s.y * t.tw + s.x]);
  /* always, not only when the edit stranded something: ground you have just
     drawn is somewhere a spark can go, and on a plan you are drawing from
     nothing that is the only way any of them ever get placed */
  topUp();
  hud(true);
}

/* nearest walkable tile, breadth first — used when the ground the walker
   is standing on stops being ground */
function rescue(){
  const t = G.terr, seen = new Uint8Array(t.tw * t.th), q = [G.x, G.y];
  seen[G.y * t.tw + G.x] = 1;
  for (let i = 0; i < q.length; i += 2){
    const x = q[i], y = q[i + 1];
    if (t.path[y * t.tw + x]){ G.x = x; G.y = y; break; }
    for (let d = 0; d < 4; d++){
      const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0), ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
      const k = ny * t.tw + nx;
      if (nx < 0 || ny < 0 || nx >= t.tw || ny >= t.th || seen[k]) continue;
      seen[k] = 1; q.push(nx, ny);
    }
  }
  const w = toWorld(G.x, G.y);
  G.fx = G.tx = w[0]; G.fy = G.ty = w[1];
  G.moving = false; G.stepT = 1;
}

/* how many the round is meant to hold, which is not the same as how many
   it managed to place — a plan with one room in it has nowhere to put
   twelve, and gains them as the rooms go in */
const roundTotal = () => Math.min(24, 12 + (G.round - 1) * 2);

/* put back however many sparks the edit stranded */
function topUp(){
  if (!SPARKS) return;
  const t = G.terr, want = roundTotal() - G.got - G.sparks.length;
  if (want <= 0) return;
  const cand = [];
  for (let y = 0; y < t.th; y++)
    for (let x = 0; x < t.tw; x++)
      if (G.reach[y * t.tw + x] && !(x === G.x && y === G.y) &&
          !G.sparks.some(s => s.x === x && s.y === y)) cand.push(x, y);
  for (let i = 0; i < want && cand.length; i++){
    const j = ((Math.random() * (cand.length / 2)) | 0) * 2;
    G.sparks.push({x: cand[j], y: cand[j + 1], ph: Math.random() * 6.28});
    cand.splice(j, 2);
  }
  G.total = G.got + G.sparks.length;
}

/* ── movement ── */
function tryStep(dx, dy){
  if (!G.terr || G.moving || G.paused || G.over) return;
  let sx = dx, sy = dy;
  if (!wAt(G.x + sx, G.y + sy)){
    /* the route turns a corner: take the diagonal that still goes the way
       you asked, preferring the one that carries on the way you were going */
    const alts = dx ? [[dx, -1], [dx, 1]] : [[-1, dy], [1, dy]];
    let best = null, bs = -9;
    for (const [ax, ay] of alts){
      if (!wAt(G.x + ax, G.y + ay)) continue;
      const sc = ax * G.face[0] + ay * G.face[1];
      if (sc > bs){ bs = sc; best = [ax, ay]; }
    }
    if (best){ sx = best[0]; sy = best[1]; }
  }
  G.face = [sx, sy];
  const nx = G.x + sx, ny = G.y + sy;
  /* ── the end of the road ─────────────────────────────────────────────
     The map never pans: a road that ends leads to the next plate, and the
     atlas says whether there is one. A dead end is a road tile with at
     most one road neighbour, and pressing on is pressing away from that
     neighbour — so a sideways bump mid-road never asks, and a road that
     ends at the plate edge asks the same as one that ends in a field. */
  if (typeof Atlas !== 'undefined' && !(typeof Region !== 'undefined' && Region.on()) &&
      wAt(G.x, G.y) && !(sx && sy) && !wAt(nx, ny)){
    let nb = 0, vx = 0, vy = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++){
      if ((dx || dy) && wAt(G.x + dx, G.y + dy)){ nb++; vx += dx; vy += dy; }
    }
    /* onward is away: the press must point mostly along the road's own
       outward heading, so a perpendicular bump at the end never asks */
    const len = Math.hypot(vx, vy) || 1;
    if (nb === 0 || (nb === 1 && -(sx * vx + sy * vy) / len > 0.5)){
      const dir = sx < 0 ? 'w' : sx > 0 ? 'e' : sy < 0 ? 'n' : 's';
      if (Atlas.end(dir, [G.x, G.y])) return;
    }
  }
  G.stepT = 0; G.moving = true;
  G.stepScale = (sx && sy) ? 1.414 : 1;      // a diagonal is a longer stride
  const from = toWorld(G.x, G.y);
  G.fx = from[0]; G.fy = from[1];
  if (wAt(nx, ny)){
    G.bump = false;
    G.x = nx; G.y = ny; G.steps++;
    const to = toWorld(nx, ny);
    G.tx = to[0]; G.ty = to[1];
  } else {
    G.bump = true;
    G.tx = from[0] + sx * G.terr.tsz * 0.3;
    G.ty = from[1] + sy * G.terr.tsz * 0.3;
  }
}
function arrive(){
  const i = G.sparks.findIndex(s => s.x === G.x && s.y === G.y);
  if (i < 0) return;
  const w = toWorld(G.x, G.y);
  G.sparks.splice(i, 1);
  G.got++;
  if (typeof Stock !== 'undefined') Stock.earn('sparks', 1);   // banked: a card's worth
  G.rings.push({x: w[0], y: w[1], t: 0});
  hud(true);
  if (G.got >= G.total){
    G.over = true;
    G.msg = 'ROUND ' + G.round + ' CLEAR';
    recrystallise();
    setTimeout(() => { G.round++; G.total = Math.min(24, 12 + (G.round - 1) * 2); scatterSparks(); }, 2600);
  }
}

/* ── input ── */
const keys = new Set();
const DIRS = [['KeyW', 0, -1], ['ArrowUp', 0, -1], ['KeyS', 0, 1], ['ArrowDown', 0, 1],
              ['KeyA', -1, 0], ['ArrowLeft', -1, 0], ['KeyD', 1, 0], ['ArrowRight', 1, 0]];
addEventListener('keydown', e => {
  /* typing into the map search must not also walk the sprite */
  if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (e.repeat) return;
  /* the bag owns the screen while it is up; the only key it answers is the
     way out, and nothing under it walks */
  /* the missions page sits over the bag: Esc is back to the bag, and every
     other key waits */
  if (typeof Missions !== 'undefined' && Missions.opened()){
    if (e.code === 'Escape') Missions.close();
    return;
  }
  /* the towns map owns the screen while it is up: Esc drops a pin being
     aimed, then goes up a level, then out; nothing under it walks */
  if (typeof Towns !== 'undefined' && Towns.opened()){
    if (e.code === 'Escape' || e.code === 'Backspace') Towns.back();
    return;
  }
  /* the journal owns the screen while it is up: Esc closes, ← → change
     the tab unless a note is being typed, and nothing under it walks */
  if (typeof Journal !== 'undefined' && Journal.opened()){
    const typing = e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName);
    if (e.code === 'Escape'){ if (Journal.editing && Journal.editing()) Journal.setEdit(false); else Journal.close(); }
    else if (!typing && e.code === 'ArrowLeft') Journal.move(-1);
    else if (!typing && e.code === 'ArrowRight') Journal.move(1);
    return;
  }
  /* the focus column, with a letter open, has the keys: the walker stands
     still while the arrows walk the letters and their items */
  if (typeof Focus !== 'undefined' && Focus.active()){
    if (Focus.key(e.code)) e.preventDefault();
    return;
  }
  if (typeof Bag !== 'undefined' && Bag.opened()){
    if (e.code === 'Escape') Bag.back();
    else if (e.code === 'ArrowUp') Bag.step(-1);
    else if (e.code === 'ArrowDown') Bag.step(1);
    else if (e.code === 'ArrowLeft') Bag.move(-1);
    else if (e.code === 'ArrowRight') Bag.move(1);
    else if (e.code === 'Enter' || e.code === 'NumpadEnter'){ e.preventDefault(); Bag.enter(); }
    /* the last card back — from the page, not from a word being typed,
       where backspace is backspace */
    else if (e.code === 'Backspace' && !(e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName))){
      e.preventDefault(); Bag.undo();
    }
    return;
  }
  keys.add(e.code);
  if (DIRS.some(d => d[0] === e.code)) wake();
  switch (e.code){
    /* Enter opens whatever the marker you are standing by holds, and what
       that is depends on where you are standing: out on the town a marker
       is a door into a room, and inside one it is a locus holding the
       picture of whatever stands there. Esc is the way back out, innermost
       thing first — the preview, then the panel, then the room. */
    case 'Enter': case 'NumpadEnter':
      e.preventDefault();
      if (Loci.opened()) Loci.close();
      else if (Interior.inside()){
        const mk = Interior.target();
        if (mk) Loci.enter(mk);
      }
      /* on the region a town is what you stand by, and Enter goes there */
      else if (typeof Region !== 'undefined' && Region.on()) Region.press();
      /* a distraction you are standing by comes before the door beside it */
      else if (typeof Distract !== 'undefined' && Distract.target()) Distract.open();
      else Interior.enter();
      break;
    /* Esc is BACK, and only back. It used to close the pause as well, which
       meant that pausing while inside a palace — and you pause by clicking
       away, so this is the common case — left every press of it walking you
       up a level behind a screen you could not see past. You came out at the
       town before the menu went. A screen that owns the view has to be the
       thing dismissed first, and it is dismissed by clicking it. */
    case 'Escape':
      if (G.paused) break;                    // the pause owns the screen; click it
      if (typeof Distract !== 'undefined' && Distract.opened()) Distract.close();
      else if (Loci.opened()) Loci.close();
      else if (typeof Trace !== 'undefined' && Trace.editing()) Trace.closeEdit();
      else if (Palace.opened()) Palace.close();
      else if (panelOpen) setPanel(false);
      else if (Interior.inside()) Interior.leave();
      else if (typeof Region !== 'undefined' && Region.on()) Region.leave();
      /* On the desktop plate #pause is display:none, and the only way out of
         a pause is a pointerdown on that hidden element — so pausing there
         is a door that locks behind you. Same guard, same reason, as the
         blur handler below. */
      else if (!WALL && !MOBILE_UI()) togglePause(true);      // nothing to go back from: the reference
      break;
    case 'Space': e.preventDefault(); recrystallise(); break;
    case 'KeyT': setPanel(!panelOpen); break;
    /* O is the order: the list of rooms this palace is laid out from */
    /* V is the minimal view, and the trace that runs in it (src/trace.js) */
    case 'KeyV':
      if (Loci.opened()) break;
      if (typeof Trace !== 'undefined') Trace.toggle();
      break;
    /* and in that view, the room you are standing in is turned with [ and ]
       and has a place taken out of it — or put back — with X. All three do
       nothing when the grid is down, so the keys are the minimal view's own
       and are not spent anywhere else. */
    case 'BracketLeft': case 'BracketRight':
      if (Loci.opened() || typeof Trace === 'undefined' || !Trace.on()) break;
      e.preventDefault();
      Trace.rotate(e.code === 'BracketLeft' ? -1 : 1);
      break;
    case 'KeyX':
      if (Loci.opened() || typeof Trace === 'undefined' || !Trace.on()) break;
      Trace.cut();
      break;
    case 'KeyO':
      if (Loci.opened()) break;
      if (Palace.opened()) Palace.close();
      else if (Interior.inside()) Palace.show();
      break;
    /* P plays the route: the loci you have written, in their order, handed
       to the platformer as its deck */
    case 'KeyP': if (!Loci.opened()) Loci.play(); break;
    /* R deals a new round, except while you are looking at a locus, where
       the only thing worth replacing is the picture.

       SHIFT+R is the other R: the whole town out and a blank page back
       (`Snap.reset`, the same ask as the chip under *Town* in the tune
       panel). It is on the shift and not on the bare key because the
       bare key is the one you press without looking — a round is dealt
       a hundred times a session — and the thing behind this one has no
       undo but an export (Eden, 2026-08-30). */
    case 'KeyR':
      if (e.shiftKey){
        if (typeof Snap !== 'undefined') Snap.reset();
        break;
      }
      if (Loci.opened()) Loci.pick(Loci.at());
      else { spawn(); scatterSparks(); }
      break;
    /* Ctrl-Z walks build mode back one gesture. It is asked for by one of
       History's own methods rather than by `typeof History`, because the
       browser has a History of its own and that name is never undefined —
       and it does nothing outside build mode, where there is nothing you
       could have just done to the drawing. */
    case 'KeyZ':
      if (!(e.ctrlKey || e.metaKey)) break;
      if (typeof History === 'undefined' || typeof History.undo !== 'function') break;
      if (!Build.active()) break;
      e.preventDefault();
      History.undo();
      break;
    case 'KeyF': case 'F11': e.preventDefault(); toggleFull(); break;
    case 'Tab': e.preventDefault(); break;
    case 'Equal': case 'NumpadAdd': zoomBy(ZSTEP); break;
    case 'Minus': case 'NumpadSubtract': zoomBy(1 / ZSTEP); break;
    case 'Digit0': G.camT[2] = home(); break;
  }
});
addEventListener('keyup', e => keys.delete(e.code));
/* a phone blurs for the address bar, a notification, a switch of apps —
   and its pause card sat under the touch layer, so every button then did
   nothing (Eden, 2026-08-28): no pause on blur there, as on the wall */
const MOBILE_UI = () => document.body.classList.contains('mobile');
addEventListener('blur', () => { keys.clear(); if (!WALL && !MOBILE_UI() && !G.paused) togglePause(true); });
/* ── the wheel walks ─────────────────────────────────────────────────────
   Since 2026-08-29 the wheel does not zoom (that is + − 0, and a pinch on a
   phone): it moves the walker along its road — down is onward, up is back
   — on a RAIL, the axis the walker is facing, held while it travels. Rest
   on an intersection for a second and the rail turns onto the crossing
   road; move and the rail is yours again. tryStep does the cornering. */
let rail = null, restT = 0, turned = false;
const railFrom = f => (Math.abs(f[0]) >= Math.abs(f[1]) ? [Math.sign(f[0]) || 1, 0] : [0, Math.sign(f[1]) || 1]);
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (!G.terr || G.paused) return;
  const s = e.deltaY > 0 ? 1 : e.deltaY < 0 ? -1 : 0;
  if (!s) return;
  if (!rail || turned === 'fresh'){ rail = railFrom(G.face); turned = false; }
  wake();
  tryStep(rail[0] * s, rail[1] * s);
  restT = 0;
}, {passive: false});
/* is the walker standing where a road crosses the rail? */
function crossing(){
  if (!rail) return null;
  const px = rail[1] ? 1 : 0, py = rail[0] ? 1 : 0;   // the perpendicular axis
  if (wAt(G.x + px, G.y + py)) return [px, py];
  if (wAt(G.x - px, G.y - py)) return [-px, -py];
  return null;
}
function railRest(dt){
  if (!rail) return;
  if (G.moving){ restT = 0; turned = false; return; }
  restT += dt;
  if (turned || restT < 1) return;
  const c = crossing();
  if (c){ rail = c; turned = true; if (typeof hqNote === 'function') hqNote('the wheel takes the crossing road', false); }
}
/* the plate hands control back the moment you steer it */
function wake(){
  G.idleFor = 0;
  if (G.wake) return;
  G.wake = true; G.steps = 0;
  document.body.classList.remove('drifting');
}
function drowse(){
  G.wake = false; G.drift = null;
  document.body.classList.add('drifting');
}
function zoomBy(f){ G.camT[2] = clamp(G.camT[2] * f, G.fitAll * 0.85, G.fitW * 5); }
/* ── the distance the town is worked at ─────────────────────────────────
   `fitW` puts the plate's width across the viewport, which is close enough
   that a district fills the screen and you cannot see what you are drawing
   it next to. The distance this is actually built and walked at is four
   notches out from there, and it is not somewhere you should have to arrive
   at by hand every time: the game opens on it and `0` comes back to it.

   Written as the notch to the fourth rather than as 0.4096, because the
   number means "four presses of the zoom key" and it should go on meaning
   that if the notch is ever retuned. Clamped by the same two limits zoomBy
   uses, so home can never be somewhere the zoom keys cannot reach.

   The zoom itself stays: build mode needs a close look at a corner, and TAB
   still holds the whole plate. What changes is only where you start and
   where you land — nobody has to zoom to be looking at the right thing. */
const ZSTEP = 1.25;
/* Never further out than the plate's height filling the screen, since
   2026-08-28: at the working zoom the ground reaches the top of the
   screen and the bottom (Eden asked for exactly that). On a desk that is
   fit-all; on a phone, held portrait, it is closer than fit-all — the
   plate is wider than the screen there and the camera carries you along
   it — which is what puts the ground under the compass and past the hub
   instead of a band across the middle. */
const fitH = () => (VH && G.H ? VH / G.H : G.fitAll);
const home = () => Math.max(fitH(), clamp(G.fitW / Math.pow(ZSTEP, 4), G.fitAll * 0.85, G.fitW * 5));
function toggleFull(){
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
}
function togglePause(force){
  G.paused = force === true ? true : !G.paused;
  $('#pause').hidden = !G.paused;
}
/* Anywhere on it, because the click that brings the window back to the front
   is the same click that should put you back in the game — asking for a
   second one, aimed at something, is asking you to dismiss a screen you did
   not ask for. */
$('#pause').addEventListener('pointerdown', e => { e.preventDefault(); togglePause(false); });

/* ── HUD ──────────────────────────────────────────────────────────────
   No clock. This began as a game you raced, and it is now a place you draw
   — a running timer over a floor plan is the game asking you to hurry over
   work that is not timed, which is worse than useless: it is wrong about
   what you are doing. */
let lastMsg = null;
function hud(force){
  if (force){
    /* the sparks meter is the stock's (src/stock.js): what the round has
       banked, not how far this round has got */
    if (typeof Stock !== 'undefined') Stock.ui();
  }
  if (G.msg !== lastMsg){ lastMsg = G.msg; $('#msg').textContent = G.msg; }
}

/* ── frame ── */
let last = 0, drawn = 0;
function frame(now){
  requestAnimationFrame(frame);
  /* a capped plate skips whole frames rather than rendering them cheaply —
     the GPU stays asleep between them */
  if (CAP && now - drawn < 1000 / CAP - 0.6) return;
  drawn = now;
  const t = now / 1000;
  let dt = Math.min(0.05, t - last || 0);
  last = t;
  if (R.lost) return;                       // context away — sit it out
  const [w, h] = R.resize(DPR());
  if (w !== VW || h !== VH){ VW = w; VH = h; refit(); }
  if (!G.terr){ R.begin(w, h, t); return; }

  /* A locus preview is a look at one asset, not a layer over the world: the
     world is not drawn behind it and nothing in it moves. It still breathes,
     because the breathing is the shader's own and costs the frame loop
     nothing to leave running. */
  if (Loci.opened()){
    R.begin(w, h, t);
    Loci.draw();
    return;
  }

  const live = !G.paused && !document.hidden;

  /* recrystallisation sweep — swap the plate at peak scatter, unseen */
  if (G.burst >= 0){
    G.burst += dt / 1.5;
    if (G.pending && G.burst >= 0.5){ G.plate = G.pending;
      R.batch('lattice', G.pending, R.gl.STATIC_DRAW); G.pending = null; }
    if (G.burst >= 1) G.burst = -1;
  }

  if (live){
    /* held keys walk continuously; shift is a sprint */
    G.stepDur = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 0.085 : 0.14;
    if (G.moving){
      G.stepT += dt / (G.stepDur * G.stepScale);
      if (G.stepT >= 1){
        G.moving = false; G.stepT = 1;
        if (!G.bump) arrive();
      }
    }
    if (!G.moving){
      for (const [code, dx, dy] of DIRS) if (keys.has(code)){ tryStep(dx, dy); rail = null; break; }
    }
    railRest(dt);
  }

  /* player world position with a springy hop between tiles */
  let pxw, pyw;
  if (G.moving){
    const q = clamp(G.stepT, 0, 1);
    const e = G.bump ? Math.sin(Math.PI * q) : 1 - Math.exp(-3.2 * q) * Math.cos(4.712 * q);
    pxw = lerp(G.fx, G.tx, e); pyw = lerp(G.fy, G.ty, e);
  } else { const c = toWorld(G.x, G.y); pxw = c[0]; pyw = c[1]; }

  /* idle bookkeeping — a woken plate drowses back off on its own */
  if (WALL && live){
    G.idleFor += dt;
    if (G.wake && G.idleFor > SLEEP_AFTER) drowse();
    if (!G.wake){
      G.nextBurst -= dt;
      if (G.nextBurst <= 0 && G.burst < 0){ recrystallise(); G.nextBurst = 12 + Math.random() * 7; }
    }
  }
  if (G.moving) G.idleFor = 0;

  /* camera: follow the walker, sweep the map while drowsing, or overview */
  const over = keys.has('Tab');
  if (over){ G.camT[0] = G.W / 2; G.camT[1] = G.H / 2; G.camT[2] = G.fitAll; }
  else if (WALL && !G.wake){
    /* a continuous sweep, not a hop: the target only sets the heading, and
       the camera crawls toward it at a fixed world speed */
    if (!G.drift || G.drift.hit){
      const c = [];
      for (let i = 0; i < G.terr.walk.length; i++) if (G.reach[i]) c.push(i);
      const k2 = c[(Math.random() * c.length) | 0] || 0;
      const w2 = toWorld(k2 % G.terr.tw, (k2 / G.terr.tw) | 0);
      G.drift = {x: w2[0], y: w2[1], z: G.fitW * (0.95 + Math.random() * 1.25), hit: false};
    }
    const dx = G.drift.x - G.camT[0], dy = G.drift.y - G.camT[1];
    const d = Math.hypot(dx, dy) || 1;
    const step = 14 * dt;                     // world px per second
    if (d <= step){ G.camT[0] = G.drift.x; G.camT[1] = G.drift.y; G.drift.hit = true; }
    else { G.camT[0] += dx / d * step; G.camT[1] += dy / d * step; }
    G.camT[2] = lerp(G.camT[2], G.drift.z, 1 - Math.pow(0.45, dt));
  }
  else { G.camT[0] = pxw; G.camT[1] = pyw; }
  const z = G.cam[2] = lerp(G.cam[2], G.camT[2], 1 - Math.pow(0.001, dt));
  const hw = VW / (2 * z), hh = VH / (2 * z);
  const cx = hw * 2 >= G.W ? G.W / 2 : clamp(G.camT[0], hw, G.W - hw);
  const cy = hh * 2 >= G.H ? G.H / 2 : clamp(G.camT[1], hh, G.H - hh);
  const k = 1 - Math.pow(WALL && !G.wake ? 0.02 : 0.0005, dt);
  G.cam[0] = lerp(G.cam[0], cx, k); G.cam[1] = lerp(G.cam[1], cy, k);

  /* entities — sizes hold a screen-space floor so nothing vanishes when
     you pull back to the overview */
  const ts = G.terr.tsz;
  const minW = 1 / z;                       // one screen pixel in world units
  R.glow = T.glow === undefined ? 1 : T.glow;   // one uniform, every halo
  let m = 0;
  const g = RGBV.gold;
  if (WALL && !G.wake){
    R.begin(w, h, t);
    R.draw('lattice', G.cam, G.A.cell, G.burst >= 0 ? G.burst : 0);
    R.draw('build', G.cam, G.A.cell, G.burst >= 0 ? G.burst : 0);
    R.stream('ent', ENT, 0);
    return;
  }
  for (const s of G.sparks){
    const c = toWorld(s.x, s.y);
    const pul = 0.72 + 0.22 * Math.sin(t * 6 + s.ph);
    const halo = Math.max(ts * 1.5, 22 * minW) * pul;
    const core = Math.max(ts * 0.26, 3 * minW) * pul;
    m = put(ENT, m, c[0], c[1], g[0]/255, g[1]/255, g[2]/255, 0.55 * pul, halo, 0, 0, 0, 2);
    m = put(ENT, m, c[0], c[1], g[0]/255, g[1]/255, g[2]/255, 0.95, core, 0, 0, 0, 1);
    m = put(ENT, m, c[0], c[1], g[0]/255, g[1]/255, g[2]/255, 0.5,
            Math.max(ts * 0.44, 6 * minW) * pul, 1, 0, 0, 1);
  }
  for (let i = G.rings.length - 1; i >= 0; i--){
    const r = G.rings[i];
    if (live) r.t += dt / 0.45;
    if (r.t >= 1){ G.rings.splice(i, 1); continue; }
    m = put(ENT, m, r.x, r.y, g[0]/255, g[1]/255, g[2]/255, (1 - r.t) * 0.8,
            Math.max(ts * (0.3 + r.t * 1.3), (4 + r.t * 20) * minW), 1, 0, 0, 1);
  }
  /* the walker wears the flare colour so it never reads as another route dot */
  const bob = G.moving && !G.bump ? Math.sin(t * 26) * ts * 0.05 : 0;
  const bn = RGBV.bone, fl = RGBV.flare;
  const beat = 0.9 + 0.1 * Math.sin(t * 4);
  m = put(ENT, m, pxw, pyw + bob, fl[0]/255, fl[1]/255, fl[2]/255, 0.45,
          Math.max(ts * 1.7 * WALKER, 26 * WALKER * minW) * beat, 0, 0, 0, 2);
  m = put(ENT, m, pxw, pyw + bob, bn[0]/255, bn[1]/255, bn[2]/255, 1,
          Math.max(ts * 0.42 * WALKER, 4.5 * WALKER * minW), 0, 0, 0, 1);
  m = put(ENT, m, pxw, pyw + bob, fl[0]/255, fl[1]/255, fl[2]/255, 1,
          Math.max(ts * 0.18 * WALKER, 2 * WALKER * minW), 0, 0, 0, 1);
  m = put(ENT, m, pxw + G.face[0] * ts * 0.34 * WALKER, pyw + bob + G.face[1] * ts * 0.34 * WALKER,
          fl[0]/255, fl[1]/255, fl[2]/255, 0.9,
          Math.max(ts * 0.11 * WALKER, 1.5 * WALKER * minW), 0, 0, 0, 1);
  /* a ring that only shows when you are zoomed out, so you can find yourself */
  if (z < G.fitW * 0.9)
    m = put(ENT, m, pxw, pyw + bob, fl[0]/255, fl[1]/255, fl[2]/255,
            0.5 * (1 - z / (G.fitW * 0.9)), 16 * minW * beat, 1, 0, 0, 1);

  /* the doors answer the walker, not the clock, so they are stepped from
     where it actually is this frame rather than from the tile it is on */
  if (live) Doors.step(dt, pxw, pyw);
  m = Doors.draw(ENT, m, ENTMAX);
  m = Interior.overlay(ENT, m, ENTMAX);
  if (typeof Trace !== 'undefined'){ m = Trace.overlay(ENT, m, ENTMAX); if (live) Trace.step(); }
  if (typeof Distract !== 'undefined'){ m = Distract.overlay(ENT, m, ENTMAX); if (live) Distract.step(dt); }
  if (typeof Region !== 'undefined') m = Region.overlay(ENT, m, ENTMAX);
  m = Palace.overlay(ENT, m, ENTMAX);
  if (typeof Compass !== 'undefined' && Compass.overlay) m = Compass.overlay(ENT, m, ENTMAX);
  m = Build.overlay(ENT, m, ENTMAX);
  m = Hud.overlay(ENT, m, ENTMAX);
  m = Markers.draw(ENT, m, ENTMAX);
  Interior.prompt();
  if (typeof Region !== 'undefined') Region.prompt();
  if (typeof Distract !== 'undefined') Distract.prompt();
  if (typeof Quest !== 'undefined') Quest.line();
  Basemap.sync();

  R.begin(w, h, t);
  R.draw('lattice', G.cam, G.A.cell, G.burst >= 0 ? G.burst : 0);
  R.draw('build', G.cam, G.A.cell, G.burst >= 0 ? G.burst : 0);
  R.stream('ent', ENT, m);
  R.draw('ent', G.cam, 1, 0);
  hud();
}

function refit(){
  /* ── a resting view stays resting when the window changes ──────────────
     home() is worked out from the viewport, so a window that is resized —
     or one that booted while it was still small, which is what a hidden or
     just-restored window looks like for a frame — has a different one than
     the zoom it is currently sitting at. Clamping alone would leave it at a
     distance that was right for a viewport it no longer has.

     So the resting view is re-derived, and ONLY the resting view: a zoom you
     chose is yours, and being thrown back out to home in the middle of
     working close on a corner because the window grew is worse than any
     staleness. The test is exact equality with the old home, because that
     is a value nothing but home() writes. */
  const wasHome = Math.abs(G.camT[2] - home()) < 1e-6;
  G.fitW = VW / G.W;
  G.fitAll = Math.min(VW / G.W, VH / G.H);
  if (!G.cam[2] || G.cam[2] < 0.001){ G.cam[2] = G.camT[2] = home(); }
  else if (wasHome) G.camT[2] = home();
  G.camT[2] = clamp(G.camT[2], G.fitAll * 0.85, G.fitW * 5);
}

/* ── boot ── */
/* ── the plate is wider than the sheet ─────────────────────────────────
   The printed map is taller than it is wide and the window is the other
   way round, so a plate the sheet's exact size leaves a margin down the
   right that looks like map and is not. The plate is the sheet plus this
   many lattice cells of plain ground on the right — measured in cells,
   not pixels, so the cell pitch the whole town is built at does not
   move: the lattice gets the same extra columns the picture gets. The
   sheet itself is untouched; the strip is the plate's own ground colour,
   which the classifier reads as open ground and Blank zeroes anyway. */
const PLATE_EXT_COLS = 64;
const plateCols = () => T.cols + PLATE_EXT_COLS;
function boot(img){
  const ext = Math.round(img.naturalWidth / T.cols * PLATE_EXT_COLS);
  G.W = img.naturalWidth + ext; G.H = img.naturalHeight;
  G.sheetW = img.naturalWidth;      // the printed sheet's own width, for what is anchored to it
  const c = document.createElement('canvas');
  c.width = G.W; c.height = G.H;
  const cx = c.getContext('2d', {willReadFrequently: true});
  cx.imageSmoothingEnabled = false;
  cx.fillStyle = '#1B1B21'; cx.fillRect(0, 0, G.W, G.H);
  cx.drawImage(img, 0, 0);
  G.px = cx.getImageData(0, 0, G.W, G.H).data;

  analyse(); compose();
  /* One grid, not two. The walk tile is a whole number of lattice cells, so
     a shape snapped to the tile the walker stands on is also snapped to the
     weave underneath it — and its pattern still travels with it exactly
     when you drag, because a tile step is a whole number of cells. */
  G.terr = Lattice.terrain(G.px, G.W, G.H,
                           Math.max(8, Math.round(plateCols() / G.cellsPerTile)));
  /* the classifier's own reading of the map, kept pristine: every edit in
     build mode restamps from this rather than piling up on itself */
  G.terrBase = {walk: G.terr.walk.slice(), path: G.terr.path.slice()};
  /* and a second copy that nothing ever writes to, so Blank is reversible */
  G.terrPrint = {walk: G.terr.walk.slice(), path: G.terr.path.slice()};
  Build.init();
  Markers.init();
  Interior.init();
  /* the picture store answers asynchronously; the palette and the rings
     redraw themselves once it has said what is attached */
  Loci.init().then(() => { Build.sync(); if (typeof Index !== 'undefined') Index.init(); });
  Palace.init();
  Basemap.init();
  if (typeof Compass !== 'undefined') Compass.init();
  Hud.init();
  /* the stock's two bars on the strip, and the ear for the platformer's write */
  if (typeof Stock !== 'undefined') Stock.init();
  /* the left and top rings open the bag: one page, two sets of labels */
  if (typeof Bag !== 'undefined'){
    Hud.onNumbers = () => Bag.open('numbers');
    Hud.onLetters = () => Bag.open('letters');
  }
  /* the aqua diamond beside the hub opens the journal */
  if (typeof Journal !== 'undefined') Hud.onJournal = () => Journal.open();
  /* the bone diamond is the B key: build on, or off again */
  Hud.onBuild = () => Build.setOn(!Build.active());
  if (typeof Atlas !== 'undefined') Atlas.init();
  /* the region: our towns drawn flat, north up, in place of the country */
  if (typeof Region !== 'undefined') Region.init();
  /* the distractions: what eats the road, and what gates a jump */
  if (typeof Distract !== 'undefined') Distract.init();
  /* the compass's fourth diamond opens the towns map, in place of the
     chip grid the atlas drew before the country was here */
  if (typeof Towns !== 'undefined') Towns.init();
  /* and after both have claimed it, the diamond goes to the switch above:
     the region by default, the country when asked for */
  Hud.onTowns = openTowns;
  /* the focus column: one acronym from the journal, stood up on the plate */
  if (typeof Focus !== 'undefined') Focus.init();
  /* the quest: the picked item's palace, and the line that says where */
  if (typeof Quest !== 'undefined') Quest.init();
  /* the keys on the screen, on a phone */
  if (typeof Touch !== 'undefined') Touch.init();
  /* founding: the frame, the drag, and a home plate with nothing on it */
  if (typeof Found !== 'undefined'){ Found.init(); setTimeout(() => Found.check(), 400); }
  applyPlate();
  spawn(); scatterSparks();
  VW = canvas.width; VH = canvas.height;
  refit();
  G.cam[2] = G.camT[2] = home();
  R.onrestored = () => {                     // rebuild what died with the context
    if (G.plate) R.batch('lattice', G.plate, R.gl.STATIC_DRAW);
    Build.rebuild();
  };
  $('#boot').hidden = true;
  buildPanel();
  if (WALL){
    document.title = 'Memory Quest Low Effort Wallpaper';     // the KWin rule matches this
    document.body.classList.add('wall', 'drifting');
    G.nextBurst = 6;
  }
}

if (R){
  const img = new Image();
  img.onload = () => boot(img);
  img.onerror = () => { $('#boot').textContent = 'map asset failed to load'; };
  img.src = MAP_SRC;
  requestAnimationFrame(frame);
}
