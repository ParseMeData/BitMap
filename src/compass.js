'use strict';
/* ── the compass ────────────────────────────────────────────────────────
   Top-left: a star rose with a long north spike, and nothing else. It
   follows the map — the traced underlay's own rotation, which is the one
   number in this game that says which way north is — and turns with it
   exactly as the picture is turned (the Turn arrows, shift-drag), so
   the spike points where north is on the plate. On the region north is
   up and it reads 0. It is never turned by hand: since 2026-08-28 there
   is no drag and no double-click, and `hq.compass` keeps only the tune.

   One cut out of the drawing (`tools/compass.py`), through the same tone
   pass as a card's picture and painted as diamonds in bone with the
   titles' sheen down it — so the compass is made of what the plate is
   made of, at the plate's pitch, and never a picture laid on it. */

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
    pitch:   {lo: 1.5, hi: 4,   dflt: 2.2, label: 'Detail',  fmt: v => v.toFixed(1) + ' px'},
    weight:  {lo: 0.4, hi: 1.4, dflt: 0.8, label: 'Weight',  fmt: v => v.toFixed(2) + '\u00d7'},
    scatter: {lo: 0,   hi: 2,   dflt: 0,   label: 'Scatter', fmt: v => v ? v.toFixed(1) + '\u00d7' : 'none'},
    szv:     {lo: 0,   hi: 2,   dflt: 0.5, label: 'Jitter',  fmt: v => v.toFixed(1) + '\u00d7'},
    bri:     {lo: -0.4, hi: 0.4, dflt: -0.12, label: 'Tone', fmt: v => (v > 0 ? '+' : '') + Math.round(v * 100)}
  };
  let tune = {};
  const tuned = k => { const v = isFinite(tune[k]) ? +tune[k] : TUNE[k].dflt; return Math.min(TUNE[k].hi, Math.max(TUNE[k].lo, v)); };
  const url = k => COMPASS_ART[k].replace(/^url\("(.*)"\)$/, '$1');

  function load(){
    try {
      const v = JSON.parse(Store.get(KEY) || 'null');
      if (v && typeof v === 'object' && v.tune && typeof v.tune === 'object') tune = Object.assign({}, v.tune);
    } catch (e){}
  }
  function store(){
    try { Store.set(KEY, JSON.stringify({tune})); } catch (e){}
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
                    {ink: 0, edge: 0, con: 1, bri: tuned('bri'), scatter: tuned('scatter'), szv: tuned('szv')})
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
      cells.push({x: i, y: j, al: 0.55 * e * (0.55 + 0.45 * roll(i, j, 3)), rgb: GROUND, sz: S * 1.05});
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
        '" max="' + Math.round(r.hi * 100) + '" step="' + (k === 'pitch' ? 10 : 5) + '"><span class="pv"></span>';
      const inp = row.querySelector('input'), out = row.querySelector('.pv');
      const sync = () => { inp.value = Math.round(tuned(k) * 100); out.textContent = r.fmt(tuned(k)); };
      sync();
      inp.addEventListener('input', () => {
        tune[k] = +inp.value / 100; sync();
        if (k === 'weight'){ painted = null; paint(); } else read();
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
  }

  /* ── on the plate ──────────────────────────────────────────────────────
     Since 2026-08-28 the compass is drawn ON THE PLATE, like the town's
     name: the rose's cells go into the entity stream at the plate's
     top-left corner, turned to the heading, over a mat of the ground's
     diamonds — so it is part of the map, at the map's pitch, and the
     chrome canvas above is kept only for the tune panel's reading. */
  const ON_PLATE = true;
  const AT = 6;                      // tiles in from the plate's top-left corner, both ways
  const COLS_ON = 26;                // the rose read at this many cells across, and drawn one plate cell per cell
  let facePlate = null;
  function readPlate(){
    if (typeof Title === 'undefined' || !Title.picture) return;
    Title.picture(url('rose'), COLS_ON, {ink: 0, edge: 0, con: 1, bri: tuned('bri'), scatter: tuned('scatter'), szv: tuned('szv')})
      .then(f => { facePlate = f; }).catch(() => {});
  }
  function overlay(a, m, cap){
    if (!ON_PLATE || !G.terr || !G.A) return m;
    if (!facePlate){ if (!overlay.asked){ overlay.asked = true; readPlate(); } return m; }
    if (typeof Interior !== 'undefined' && Interior.inside()) return m;
    /* one plate cell per cell of the picture: the rose is the same
       resolution as the map it stands on */
    const f = facePlate, ts = G.terr.tsz, px = G.A.cell;
    const cx = ts * AT, cy = ts * AT;
    const x0 = cx - f.cols * px / 2, y0 = cy - f.rows * px / 2;
    if (typeof Title !== 'undefined' && Title.mat)
      m = Title.mat(a, m, f.cols, f.rows, x0, y0, px, 0.4, cap, 18);
    const th = heading() * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th);
    const hs = px * 0.75 * tuned('weight');
    for (const c of f.cells){
      if (cap !== undefined && m > cap - 1) return m;
      const lx = (c.x + 0.5) * px - f.cols * px / 2, ly = (c.y + 0.5) * px - f.rows * px / 2;
      const k = (c.y + 1) / (f.rows + 1);
      const col = mix(BONE, DIM, GREY * k);
      m = put(a, m, cx + lx * cs - ly * sn, cy + lx * sn + ly * cs,
              col[0], col[1], col[2], 0.9 * c.al, hs * (c.sz || 1), 0, 0, 0, 1);
    }
    return m;
  }

  function init(){
    if (typeof COMPASS_ART === 'undefined') return;
    load(); build();
    if (ON_PLATE && el) el.style.display = 'none';
    if (!raf) tick();
  }
  return {init, heading, overlay};
})();
