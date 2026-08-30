'use strict';
/* ── the compass ────────────────────────────────────────────────────────
   Top-left: a star rose with a long north spike, and nothing else. It
   follows the map — the traced underlay's own rotation, which is the one
   number in this game that says which way north is — and turns with it
   exactly as the picture is turned (the Turn arrows, shift-drag), so
   the spike points where north is on the plate. On the region north is
   up and it reads 0. It is never turned by hand: since 2026-08-28 there
   is no drag and no double-click, and `hq.compass` keeps only the tune.

   One cut out of the drawing (`tools/compass.py`), through the SAME
   SCREEN THE LETTERING GOES THROUGH (`Title.stencil` → `Title.screen`)
   and drawn by the call the town's name makes (`Title.emit`), in bone
   with the titles' sheen down it — so the compass is made of what the
   plate is made of, at the plate's pitch and on the plate's grain, and
   never a picture laid on it. The heading turns the drawing before it
   is screened, never the cells after; see *the rose, cut in the title's
   own layer* below for why that is the whole difference. */

const Compass = (() => {
  const KEY = 'hq.compass';                    // {tune}
  const BOX = 200;                             // the element, CSS px (index.html agrees)
  let el = null, rose = null, shadow = null;
  let shown = -1, last = null, raf = 0, faces = {}, painted = null;
  /* the pitch: about three CSS pixels a diamond, which is the plate's own
     cell at the zoom the town is read at; each cut is read at as many
     cells as fit its width at that pitch, and painted at 2× for the
     screen */
  const SCALE = 2;
  /* the rose's box: the sheet's own proportion (225 × 268), 120 tall */
  const SIZE = {rose: [101, 120]};
  const BONE = [0.93, 0.92, 0.89], FLARE = [1, 0.373, 0.635], DIM = [0.353, 0.353, 0.4];
  /* the ink runs bone at the top to a grey at the foot — bone mixed a
     little toward dim, subtle, not a shadow; flare toward dim while it
     is turned by hand */
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const GREY = 0.42;
  /* ── the tune ──────────────────────────────────────────────────────────
     How the compass is read and drawn, in the Tune panel under the plate's
     own rows: the pitch, the diamond's weight (which is the gap), and the
     lattice's scatter and size variance. Kept with the heading. */
  const TUNE = {
    /* the rose on the plate, in the title's own numbers — `size` is the
       title's Size (how many cells the drawing is read at, the pitch
       being the plate's own cell and never moving), and `dither`,
       `tone`, `weight` and `shade` are the four the lettering already
       has, at the lettering's defaults, so a compass at rest is cut the
       way a name at rest is cut (Eden, 2026-08-30) */
    size:    {lo: 16,  hi: 72,  dflt: 40,  step: 100, label: 'Size',   fmt: v => Math.round(v) + ' cells'},
    weight:  {lo: 0.5, hi: 2.0, dflt: 1,   label: 'Weight', fmt: v => v.toFixed(2) + '\u00d7'},
    dither:  {lo: 0,   hi: 1,   dflt: 1,   label: 'Screen', fmt: v => v ? v.toFixed(2) : 'flat cut'},
    tone:    {lo: 0,   hi: 1,   dflt: 0,   label: 'Tone',   fmt: v => v ? v.toFixed(2) : 'even'},
    shade:   {lo: 0,   hi: 0.7, dflt: 0.25, label: 'Sheen', fmt: v => v.toFixed(2)},
    bri:     {lo: -0.4, hi: 0.4, dflt: -0.12, label: 'Ink', fmt: v => (v > 0 ? '+' : '') + Math.round(v * 100)},
    /* the chrome canvas's own read: kept because the shadow is drawn at
       it, and the chrome is what a future off-plate compass would use */
    pitch:   {lo: 1.5, hi: 4,   dflt: 2.2, step: 10, label: 'Detail', fmt: v => v.toFixed(1) + ' px'}
  };
  let tune = {};
  const tuned = k => { const v = isFinite(tune[k]) ? +tune[k] : TUNE[k].dflt; return Math.min(TUNE[k].hi, Math.max(TUNE[k].lo, v)); };
  const url = k => COMPASS_ART[k].replace(/^url\("(.*)"\)$/, '$1');

  function load(){
    try {
      const v = JSON.parse(Store.get(KEY) || 'null');
      if (v && typeof v === 'object'){
        /* a tune saved BEFORE 2026-08-30 is a tune for the other read —
           `scatter` and `szv` were the lattice's, and `weight` was on a
           0.4–1.4 scale against a different diamond. Its numbers mean
           nothing to the title's screen, and carried over they show up
           as a rose drawn far too thin. So an old shape is dropped
           whole and the new defaults stand; `at` is kept, because where
           you put it is still where you put it. */
        const old = v.tune && (('szv' in v.tune) || ('scatter' in v.tune));
        if (v.tune && typeof v.tune === 'object' && !old) tune = Object.assign({}, v.tune);
        if (Array.isArray(v.at) && isFinite(v.at[0]) && isFinite(v.at[1])) at = [+v.at[0], +v.at[1]];
      }
    } catch (e){}
  }
  function store(){
    try { Store.set(KEY, JSON.stringify({tune, at})); } catch (e){}
  }
  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };

  /* the map's heading, in degrees clockwise from up, or 0 with no map */
  function mapDeg(){
    if (typeof Basemap === 'undefined' || !Basemap.rot) return 0;
    return Basemap.rot() * 180 / Math.PI;
  }
  /* on the region north is up by definition, whatever the map says */
  const heading = () => (typeof Region !== 'undefined' && Region.on() ? 0 : mapDeg());

  function build(){
    if (el) return el;
    el = document.createElement('div');
    el.id = 'compass';
    el.title = 'north, as the map is turned';
    rose = document.createElement('canvas');
    rose.className = 'rose';
    rose.width = SIZE.rose[0] * SCALE; rose.height = SIZE.rose[1] * SCALE;
    rose.style.width = SIZE.rose[0] + 'px'; rose.style.height = SIZE.rose[1] + 'px';
    rose.style.left = ((BOX - SIZE.rose[0]) / 2) + 'px'; rose.style.top = ((BOX - SIZE.rose[1]) / 2) + 'px';
    /* a shadow under the rose: an oval of the ground's own diamonds,
       dithered to nothing at its rim, so the compass reads over whatever
       the plate has under it (Eden, 2026-08-28) — the title's mat, in chrome */
    shadow = document.createElement('canvas');
    shadow.className = 'shadow';
    shadow.width = BOX * SCALE; shadow.height = BOX * SCALE;
    shadow.style.cssText = 'position:absolute;left:0;top:0;width:' + BOX + 'px;height:' + BOX + 'px;pointer-events:none';
    el.append(shadow, rose);
    document.body.append(el);
    read();
    return el;
  }
  /* every cut through the tone pass once — bone ink, no edges, the tone
     flat — kept as cells, and painted whenever the ink changes */
  function read(){
    if (typeof Title === 'undefined' || !Title.picture) return;
    const pitch = tuned('pitch');
    const all = ['rose'].map(k =>
      Title.picture(url(k), Math.round(SIZE[k][0] / pitch),
                    {ink: 0, edge: 0, con: 1, bri: tuned('bri')})
        .then(f => { faces[k] = f; }));
    Promise.all(all).then(() => { painted = null; paint(); }).catch(() => {});
  }
  const GROUND = [0.106, 0.106, 0.129];
  const roll = (u, v, s) => (typeof Kinds !== 'undefined' && Kinds.hash ? Kinds.hash(u, v, s) : 0.5);
  function paintShadow(){
    if (!shadow || typeof Title === 'undefined' || !Title.paint) return;
    const pitch = tuned('pitch'), N = Math.max(8, Math.round(BOX / pitch));
    const c = (N - 1) / 2, rx = N * 0.40, ry = N * 0.40, f0 = 0.25, S = 2;
    const cells = [];
    for (let j = 0; j < N; j += S) for (let i = 0; i < N; i += S){
      const r = Math.hypot((i - c) / rx, (j - c) / ry);
      if (r >= 1) continue;
      let e = 1;
      if (r > f0){ const t = (1 - r) / (1 - f0); e = t * t * (3 - 2 * t); }
      if (roll(i, j, 7) > e + 0.12) continue;
      cells.push({x: i, y: j, al: 0.85 * e * (0.55 + 0.45 * roll(i, j, 3)), rgb: GROUND, sz: S * 1.05});
    }
    Title.paint(shadow, {cols: N, rows: N, cells}, {weight: tuned('weight'), shade: 0, tint: GROUND, tint2: GROUND});
  }
  function paint(){
    const ink = BONE;
    paintShadow();
    const stamp = ink + '|' + tuned('weight');
    if (painted === stamp) return;
    painted = stamp;
    for (const k in faces){
      const cv = rose;
      if (cv && faces[k]) Title.paint(cv, faces[k], {weight: tuned('weight'), shade: 0, tint: ink, tint2: mix(ink, DIM, GREY)});
    }
  }

  /* ── the block in the Tune panel ───────────────────────────────────────
     Appended under the plate's rows whenever the panel is up and the
     block is not there (the panel may rebuild its body), so the compass
     is tuned where the plate is. Pitch, scatter and size variance read
     the cuts again; weight only paints. */
  function block(){
    const body = document.querySelector('#tune #tbody');
    if (!body || body.querySelector('#ctune')) return;
    const el = document.createElement('div');
    el.id = 'ctune';
    el.innerHTML = '<div class="plabel">Compass</div>';
    for (const k in TUNE){
      const r = TUNE[k];
      const row = document.createElement('div');
      row.className = 'prow'; row.dataset.key = k;
      row.innerHTML = '<label>' + r.label + '</label><input type="range" min="' + Math.round(r.lo * 100) +
        '" max="' + Math.round(r.hi * 100) + '" step="' + (r.step || 5) + '"><span class="pv"></span>';
      const inp = row.querySelector('input'), out = row.querySelector('.pv');
      const sync = () => { inp.value = Math.round(tuned(k) * 100); out.textContent = r.fmt(tuned(k)); };
      sync();
      inp.addEventListener('input', () => {
        tune[k] = +inp.value / 100; sync();
        /* the rose on the plate needs no poking: `overlay` reads its own
           key every frame and asks for a new cut when one of these moves.
           These two are the chrome canvas's, which does not. */
        if (k === 'weight'){ painted = null; paint(); }
        else if (k === 'pitch' || k === 'bri') read();
      });
      inp.addEventListener('change', store);
      el.append(row);
    }
    body.append(el);
  }

  /* the rose turns as one, with the map */
  function lay(deg){
    if (deg === last) return;
    last = deg;
    rose.style.transform = 'rotate(' + deg.toFixed(2) + 'deg)';
    paint();
  }

  /* shown by the same rule as the chrome: not on the wallpaper, not under a
     page, not while the map bar is up in the same lane */
  function visible(){
    const b = document.body.classList;
    return !(b.contains('wall') || b.contains('bag') || b.contains('journal') ||
             b.contains('locus') || b.contains('missions') || b.contains('towns'));
  }
  function tick(){
    raf = requestAnimationFrame(tick);
    if (!el) return;
    const v = visible() && !ON_PLATE ? 1 : 0;
    if (v !== shown){ shown = v; el.hidden = !v; }
    if (v) lay(heading());
    const tp = document.getElementById('tune');
    if (tp && !tp.hidden) block();
    layMat();
  }

  /* ── on the plate ──────────────────────────────────────────────────────
     Since 2026-08-28 the compass is drawn ON THE PLATE, like the town's
     name: the rose's cells go into the entity stream at the plate's
     top-left corner, over a mat of the ground's diamonds — so it is part
     of the map, at the map's pitch, and the chrome canvas above is kept
     only for the tune panel's reading. */
  const ON_PLATE = true;
  const AT = 6;                      // tiles in from the plate's top-left corner, both ways, until moved
  /* where it stands, moved by hand and kept: `at` in hq.compass, world
     units; nothing when it has never been moved */
  let at = null, drag = null;
  const where = () => (at ? at : [G.terr.tsz * AT, G.terr.tsz * AT]);
  /* ── the rose, cut in the title's own layer ────────────────────────────
     Until 2026-08-30 this was `Title.picture` — the PHOTOGRAPHIC read,
     through `Lattice.analyse`/`compose`: a dense field with a cell for
     every cell, no gaps anywhere — with a checkerboard laid over it by
     hand (build 222) to fake a screen, and the cells then TURNED to the
     heading one by one. It read wrong twice over, and Eden named both:

       *the angle is off* — a cell turned by `cos/sin` lands BETWEEN the
       plate's own cells. At 0° or 90° that is invisible; at anything
       else the whole rose sits off the grain and smears, because every
       other diamond on the plate is on the lattice and this one is not.

       *the diamonds are not spaced out with halftone gaps* — a checker
       drops every second cell on a fixed parity, which is a texture,
       not a screen. The title beside it is cut by the Bayer threshold
       in `Title.screen`, where a cell is dropped because the INK there
       is thin: the gaps open in the pale places and close in the dark
       ones, and that is what reads as halftone.

     So: `Title.stencil` is the lettering's own screen with a picture fed
     to it instead of a word, and the heading is turned into the PICTURE
     before it is screened — the box grown to the rotated diagonal so no
     spike is clipped — which leaves every diamond square on a lattice
     cell at every heading. It is then drawn by `Title.emit`, the call
     the town's name makes in `palace.js`: same origin, same pitch, same
     sheen, same diamond, same instance cap. One layer, one material. */
  /* ── the mat, laid once as its own shape ───────────────────────────────
     The oval `Title.mat` used to draw inline: `rx = cols/2 * 1.4 + 8` and
     `ry = rows/2 * 2.1 + 8` cells round the rose's box, which is the size
     it has always been. Laid from `tick`, never from `overlay`, because
     making a shape runs `changed()` — a rebuild and a save — and the draw
     path is the one place that must not.

     It ASKS every tick rather than latching after the first go. A latch
     was tried and is wrong: `G.shapes` is swapped whole when the plate
     changes, so a compass that had laid its mat on one plate would never
     lay one on the next. `backdropOf` is a scan of forty-odd shapes once
     a frame, which is nothing, and it is the only state that cannot go
     stale. `pending` is only there so a plate cannot be given two while
     the first is still being made. */
  let pending = false;
  function layMat(){
    if (pending || !ON_PLATE || !facePlate || !G.terr || !G.A) return;
    if (typeof Build === 'undefined' || !Build.backdrop) return;
    if (typeof Interior !== 'undefined' && Interior.inside()) return;
    if (typeof Region !== 'undefined' && Region.on && Region.on()) return;
    if (typeof Found !== 'undefined' && Found.state && Found.state()) return;
    /* ── never onto an empty plate ─────────────────────────────────────
       A backdrop with nothing behind it is not a backdrop, and worse: a
       home plate founds itself unasked only while it is EMPTY
       (`Found.check` refuses a plate with any shape on it), so a mat laid
       in the gap between the page loading and the founding starting was a
       mat that stopped the town ever being founded. Found 2026-08-30 by
       pressing Shift+R and watching a blank page sit there with one shape
       on it. So: nothing is laid until the plate has something that is
       not itself a backdrop. */
    if (!G.shapes.some(x => x.kind !== 'mat')) return;
    if (Build.backdropOf('compass')) return;
    pending = true;
    const px = G.A.cell, [cx, cy] = where(), f = facePlate;
    try {
      Build.backdrop(cx, cy, (f.cols / 2 * 1.4 + 8) * 2 * px,
                     (f.rows / 2 * 2.1 + 8) * 2 * px, 'compass');
    } catch (e){}
    pending = false;
  }
  let facePlate = null, faceKey = null, asking = null;
  /* what the cut depends on — the heading and the four numbers that
     shape it. `overlay` compares this every frame and asks for a new one
     when it moves, so a slider or a turn of the map needs no callback. */
  const plateKey = deg => deg + '|' + Math.round(tuned('size')) + '|' +
                          tuned('dither').toFixed(2) + '|' + tuned('bri').toFixed(3);
  function wantPlate(deg){
    const k = plateKey(deg);
    if (faceKey === k || asking === k) return;
    asking = k;
    Title.stencil(url('rose'), Math.round(tuned('size')),
                  {deg, dither: tuned('dither'), bri: tuned('bri')})
      .then(f => { if (asking === k){ facePlate = f; faceKey = k; asking = null; } })
      .catch(() => { if (asking === k) asking = null; });
  }
  function overlay(a, m, cap){
    if (!ON_PLATE || !G.terr || !G.A) return m;
    if (typeof Title === 'undefined' || !Title.stencil || !Title.emit) return m;
    if (typeof Interior !== 'undefined' && Interior.inside()) return m;
    /* not while a plate is being founded: the compass is part of the town,
       and there is no town until Generate (Eden, 2026-08-29) */
    if (typeof Found !== 'undefined' && Found.state && Found.state()) return m;
    /* a whole degree is finer than the plate can show at this size, and it
       keeps a shift-drag of the map from cutting a rose a frame */
    const deg = Math.round(((heading() % 360) + 360) % 360);
    wantPlate(deg);
    const f = facePlate;
    if (!f || !f.cells.length) return m;
    /* the title's own placement: the face's ink is (cols − 1) × (rows − 1)
       cells across from centre to centre, and the pitch is the plate's */
    const px = G.A.cell, [cx, cy] = where();
    const iw = f.cols - 1, ih = f.rows - 1;
    const x0 = cx - iw * px / 2, y0 = cy - ih * px / 2;
    /* the mat first and dropped first, as a name's is: a rose without its
       mat is still a rose, and the cap is shared with the whole town */
    /* the mat is no longer drawn here: since 2026-08-30 it is a shape of
       its own on the Backdrop layer, laid once by `layMat` below and moved,
       warped and deleted like anything else. What used to be drawn inline
       under the rose every frame is now something you can take hold of. */
    if (m + Title.cost(f) > cap) return m;
    const t = {weight: tuned('weight'), tone: tuned('tone'), shade: tuned('shade')};
    return Title.emit(a, m, f, x0, y0, px, BONE, 1, cap, 0, 0, t);
  }

  /* ── moved by hand ────────────────────────────────────────────────────
     Take the rose on the plate and put it where you like; it stays there
     (Eden, 2026-08-29). The same rule as the title's drag: not paused,
     not inside, not while a picture is pinned; capture-phase on the
     window, and only a press that lands on the rose is taken, so nothing
     under it loses a click. */
  const toWorld = ev => { const b = canvas.getBoundingClientRect(), k = VW / (b.width || 1);
    return [((ev.clientX - b.left) * k - VW / 2) / G.cam[2] + G.cam[0], ((ev.clientY - b.top) * k - VH / 2) / G.cam[2] + G.cam[1]]; };
  function may(){
    if (!ON_PLATE || !G.terr || !facePlate || G.paused || WALL) return false;
    if (typeof Interior !== 'undefined' && Interior.inside()) return false;
    if (typeof Basemap !== 'undefined' && Basemap.placing && Basemap.placing()) return false;
    if (typeof Found !== 'undefined' && Found.state && Found.state()) return false;
    return true;
  }
  function wireDrag(){
    addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target !== canvas || !may()) return;
      const p = toWorld(e), [cx, cy] = where(), half = facePlate.cols * G.A.cell / 2;
      if (Math.abs(p[0] - cx) > half || Math.abs(p[1] - cy) > half) return;
      drag = {ox: p[0] - cx, oy: p[1] - cy};
      e.stopPropagation(); e.preventDefault();
    }, true);
    addEventListener('pointermove', e => {
      if (!drag) return;
      const p = toWorld(e);
      at = [p[0] - drag.ox, p[1] - drag.oy];
      e.stopPropagation();
    }, true);
    const up = e => { if (!drag) return; drag = null; store(); e.stopPropagation(); };
    addEventListener('pointerup', up, true);
    addEventListener('pointercancel', up, true);
  }

  function init(){
    if (typeof COMPASS_ART === 'undefined') return;
    load(); build();
    if (ON_PLATE && el) el.style.display = 'none';
    wireDrag();
    if (!raf) tick();
  }
  return {init, heading, overlay, at: () => where().slice(), dragging: () => !!drag};
})();
