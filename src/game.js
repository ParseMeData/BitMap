'use strict';
/* ── MEMORY QUEST V1 ── desktop build ─────────────────────────────────
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
                        churn: 1, scatter: 0, szv: 0, cvar: 1, sat: 1.15, path: 1});
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
  reach: null, sparks: [], rings: [], total: 12, got: 0, round: 1, steps: 0, clock: 0,
  paused: false, over: false, burst: -1, pending: null, msg: '',
  wake: !WALL, idleFor: 0, drift: null, nextBurst: 0,
  best: +(localStorage.getItem('hq.best') || 0) || 0
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
    loads = JSON.parse(localStorage.getItem('hq.loads') || '[]').filter(t => Date.now() - t < 60000);
    loads.push(Date.now());
    localStorage.setItem('hq.loads', JSON.stringify(loads.slice(-20)));
  } catch (err){}

  const head = probe ? 'graphics context refused' : 'this build needs WebGL2';
  const why = probe
    ? 'WebGL2 works in this browser, so the context was refused for this window.\n' +
      'That usually means a stale instance is still holding the profile — close\n' +
      'every Memory Quest window and relaunch.'
    : 'This browser could not create a WebGL2 context at all.';
  const loop = loads.length > 3
    ? '\n\nThis page has loaded ' + loads.length + ' times in the last minute — something\n' +
      'is relaunching it. Close the windows before trying again.'
    : '';
  const f = $('#fatal');
  f.hidden = false;
  $('#fatalhead').textContent = head;
  $('#fatalmsg').textContent = why + loop + '\n\n' + (e && (e.message || e));
  document.title = 'Memory Quest — ' + head;
}

const ENTMAX = 8192;
const ENT = new Float32Array(ENTMAX * 17);
const DPR = () => Math.min(window.devicePixelRatio || 1, DPRCAP);
let VW = 1, VH = 1;

/* ── the plate: the printed map, or nothing ─────────────────────────────
   A map builder wants to start from an empty sheet as often as it wants to
   start from The Mighty Haunt. Blank keeps the source art exactly where it
   is and simply does not draw it — and takes the printed routes out of the
   walk grid with it, so the only ground that exists is ground you drew.
   Nothing is destroyed, so the printed map comes back on a restamp. */
let BLANK = false;
try { BLANK = localStorage.getItem('hq.blank') === '1'; } catch (e){}

/* ── build ── */
function analyse(){
  G.A = Lattice.analyse(G.px, G.W, G.H, T.cols, T);
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
function setBlank(v){
  BLANK = !!v;
  try { localStorage.setItem('hq.blank', BLANK ? '1' : '0'); } catch (e){}
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
  G.sparks.length = 0; G.got = 0; G.steps = 0; G.clock = 0; G.over = false; G.msg = '';
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
  if (G.reach) revalidate();
}

function revalidate(){
  if (!wAt(G.x, G.y)) rescue();
  floodReach();
  const t = G.terr, before = G.sparks.length;
  G.sparks = G.sparks.filter(s => G.reach[s.y * t.tw + s.x]);
  if (G.sparks.length !== before) topUp();
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

/* put back however many sparks the edit stranded */
function topUp(){
  const t = G.terr, want = G.total - G.got - G.sparks.length;
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
  G.rings.push({x: w[0], y: w[1], t: 0});
  hud(true);
  if (G.got >= G.total){
    G.over = true;
    const t = G.clock;
    if (!G.best || t < G.best){ G.best = t; localStorage.setItem('hq.best', String(t)); }
    G.msg = 'ROUND ' + G.round + ' CLEAR · ' + fmt(t);
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
  keys.add(e.code);
  if (DIRS.some(d => d[0] === e.code)) wake();
  switch (e.code){
    case 'Escape': if (panelOpen) setPanel(false); else togglePause(); break;
    case 'Space': e.preventDefault(); recrystallise(); break;
    case 'KeyT': setPanel(!panelOpen); break;
    case 'KeyR': spawn(); scatterSparks(); break;
    case 'KeyF': case 'F11': e.preventDefault(); toggleFull(); break;
    case 'Tab': e.preventDefault(); break;
    case 'Equal': case 'NumpadAdd': zoomBy(1.25); break;
    case 'Minus': case 'NumpadSubtract': zoomBy(1 / 1.25); break;
    case 'Digit0': G.camT[2] = G.fitW; break;
  }
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); if (!WALL && !G.paused) togglePause(true); });
canvas.addEventListener('wheel', e => { e.preventDefault(); zoomBy(Math.pow(1.14, -Math.sign(e.deltaY))); },
                        {passive: false});
/* the plate hands control back the moment you steer it */
function wake(){
  G.idleFor = 0;
  if (G.wake) return;
  G.wake = true; G.clock = 0; G.steps = 0;
  document.body.classList.remove('drifting');
}
function drowse(){
  G.wake = false; G.drift = null;
  document.body.classList.add('drifting');
}
function zoomBy(f){ G.camT[2] = clamp(G.camT[2] * f, G.fitAll * 0.85, G.fitW * 5); }
function toggleFull(){
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
}
function togglePause(force){
  G.paused = force === true ? true : !G.paused;
  $('#pause').hidden = !G.paused;
}

/* ── HUD ── */
const fmt = t => {
  const m = (t / 60) | 0, s = t - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
};
let hudClock = -1, lastMsg = null;
function hud(force){
  if (force){
    $('#hsparks').textContent = G.got + '/' + G.total;
    $('#hround').textContent = String(G.round);
    $('#hsteps').textContent = String(G.steps);
    $('#hbest').textContent = G.best ? fmt(G.best) : '—';
  }
  const c = Math.floor(G.clock * 10);
  if (c !== hudClock){ hudClock = c; $('#htime').textContent = fmt(G.clock); }
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

  const live = !G.paused && !document.hidden;

  /* recrystallisation sweep — swap the plate at peak scatter, unseen */
  if (G.burst >= 0){
    G.burst += dt / 1.5;
    if (G.pending && G.burst >= 0.5){ G.plate = G.pending;
      R.batch('lattice', G.pending, R.gl.STATIC_DRAW); G.pending = null; }
    if (G.burst >= 1) G.burst = -1;
  }

  if (live){
    G.clock += G.over ? 0 : dt;
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
      for (const [code, dx, dy] of DIRS) if (keys.has(code)){ tryStep(dx, dy); break; }
    }
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
          Math.max(ts * 1.7, 26 * minW) * beat, 0, 0, 0, 2);
  m = put(ENT, m, pxw, pyw + bob, bn[0]/255, bn[1]/255, bn[2]/255, 1,
          Math.max(ts * 0.42, 4.5 * minW), 0, 0, 0, 1);
  m = put(ENT, m, pxw, pyw + bob, fl[0]/255, fl[1]/255, fl[2]/255, 1,
          Math.max(ts * 0.18, 2 * minW), 0, 0, 0, 1);
  m = put(ENT, m, pxw + G.face[0] * ts * 0.34, pyw + bob + G.face[1] * ts * 0.34,
          fl[0]/255, fl[1]/255, fl[2]/255, 0.9, Math.max(ts * 0.11, 1.5 * minW), 0, 0, 0, 1);
  /* a ring that only shows when you are zoomed out, so you can find yourself */
  if (z < G.fitW * 0.9)
    m = put(ENT, m, pxw, pyw + bob, fl[0]/255, fl[1]/255, fl[2]/255,
            0.5 * (1 - z / (G.fitW * 0.9)), 16 * minW * beat, 1, 0, 0, 1);

  m = Build.overlay(ENT, m, ENTMAX);
  m = Markers.draw(ENT, m, ENTMAX);
  Basemap.sync();

  R.begin(w, h, t);
  R.draw('lattice', G.cam, G.A.cell, G.burst >= 0 ? G.burst : 0);
  R.draw('build', G.cam, G.A.cell, G.burst >= 0 ? G.burst : 0);
  R.stream('ent', ENT, m);
  R.draw('ent', G.cam, 1, 0);
  hud();
}

function refit(){
  G.fitW = VW / G.W;
  G.fitAll = Math.min(VW / G.W, VH / G.H);
  if (!G.cam[2] || G.cam[2] < 0.001){ G.cam[2] = G.camT[2] = G.fitW; }
  G.camT[2] = clamp(G.camT[2], G.fitAll * 0.85, G.fitW * 5);
}

/* ── boot ── */
function boot(img){
  G.W = img.naturalWidth; G.H = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = G.W; c.height = G.H;
  const cx = c.getContext('2d', {willReadFrequently: true});
  cx.imageSmoothingEnabled = false;
  cx.drawImage(img, 0, 0);
  G.px = cx.getImageData(0, 0, G.W, G.H).data;

  analyse(); compose();
  /* One grid, not two. The walk tile is a whole number of lattice cells, so
     a shape snapped to the tile the walker stands on is also snapped to the
     weave underneath it — and its pattern still travels with it exactly
     when you drag, because a tile step is a whole number of cells. */
  G.terr = Lattice.terrain(G.px, G.W, G.H,
                           Math.max(8, Math.round(T.cols / G.cellsPerTile)));
  /* the classifier's own reading of the map, kept pristine: every edit in
     build mode restamps from this rather than piling up on itself */
  G.terrBase = {walk: G.terr.walk.slice(), path: G.terr.path.slice()};
  /* and a second copy that nothing ever writes to, so Blank is reversible */
  G.terrPrint = {walk: G.terr.walk.slice(), path: G.terr.path.slice()};
  Build.init();
  Markers.init();
  Basemap.init();
  applyPlate();
  spawn(); scatterSparks();
  VW = canvas.width; VH = canvas.height;
  refit();
  G.cam[2] = G.camT[2] = G.fitW;
  R.onrestored = () => {                     // rebuild what died with the context
    if (G.plate) R.batch('lattice', G.plate, R.gl.STATIC_DRAW);
    Build.rebuild();
  };
  $('#boot').hidden = true;
  buildPanel();
  if (WALL){
    document.title = 'Memory Quest Wallpaper';     // the KWin rule matches this
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
