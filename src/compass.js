'use strict';
/* ── the compass ────────────────────────────────────────────────────────
   Top-left, under the sparks: a rose that turns and four letters that do
   not. The rose follows the map — the traced underlay's own rotation,
   which is the one number in this game that says which way north is —
   and turns with it as the picture is placed. Take hold of the rose and
   turn it and it is yours instead, at whatever heading you leave it;
   double-click it and it is the map's again.

   Five cuts out of one drawing (`tools/compass.py`): the rose is one
   element with a transform, and each letter is its own element placed
   at the rose's turned point every time the angle moves, upright — a
   letter that turned with the rose would be a letter read on its side.
   Each cut goes through the same tone pass as a card's picture and is
   painted as diamonds, in bone with the titles' sheen down it — so the
   compass is made of what the plate is made of, at the plate's pitch,
   and never a picture laid on it. Flare while it is turned by hand. */

const Compass = (() => {
  const KEY = 'hq.compass';                    // {manual, deg}
  const BOX = 200;                             // the element, CSS px (index.html agrees)
  const OUT = 84;                              // letter centre from the rose's centre, clear of its rim
  let el = null, rose = null, pts = {}, state = {manual: false, deg: 0};
  let shown = -1, last = null, drag = null, raf = 0, faces = {}, painted = null;
  /* the pitch: about three CSS pixels a diamond, which is the plate's own
     cell at the zoom the town is read at; each cut is read at as many
     cells as fit its width at that pitch, and painted at 2× for the
     screen */
  const SCALE = 2;
  const SIZE = {rose: [120, 120], n: [50, 30], e: [40, 30], s: [40, 30], w: [40, 30]};
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
      const v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v && typeof v === 'object'){
        state = {manual: !!v.manual, deg: isFinite(v.deg) ? +v.deg : 0};
        if (v.tune && typeof v.tune === 'object') tune = Object.assign({}, v.tune);
      }
    } catch (e){}
  }
  function store(){
    try { localStorage.setItem(KEY, JSON.stringify(Object.assign({}, state, {tune}))); } catch (e){}
  }
  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };

  /* the map's heading, in degrees clockwise from up, or 0 with no map */
  function mapDeg(){
    if (typeof Basemap === 'undefined' || !Basemap.rot) return 0;
    return Basemap.rot() * 180 / Math.PI;
  }
  const heading = () => (state.manual ? state.deg : mapDeg());

  function build(){
    if (el) return el;
    el = document.createElement('div');
    el.id = 'compass';
    el.title = 'drag to turn · double-click for the map’s north';
    rose = document.createElement('canvas');
    rose.className = 'rose';
    rose.width = SIZE.rose[0] * SCALE; rose.height = SIZE.rose[1] * SCALE;
    el.append(rose);
    for (const k of ['n', 'e', 's', 'w']){
      const p = document.createElement('canvas');
      p.className = 'pt pt-' + k;
      p.width = SIZE[k][0] * SCALE; p.height = SIZE[k][1] * SCALE;
      p.style.width = SIZE[k][0] + 'px'; p.style.height = SIZE[k][1] + 'px';
      p.style.margin = (-SIZE[k][1] / 2) + 'px 0 0 ' + (-SIZE[k][0] / 2) + 'px';
      el.append(p);
      pts[k] = p;
    }
    document.body.append(el);
    wire();
    read();
    return el;
  }
  /* every cut through the tone pass once — bone ink, no edges, the tone
     flat — kept as cells, and painted whenever the ink changes */
  function read(){
    if (typeof Title === 'undefined' || !Title.picture) return;
    const pitch = tuned('pitch');
    const all = ['rose', 'n', 'e', 's', 'w'].map(k =>
      Title.picture(url(k), Math.round(SIZE[k][0] / pitch),
                    {ink: 0, edge: 0, con: 1, bri: tuned('bri'), scatter: tuned('scatter'), szv: tuned('szv')})
        .then(f => { faces[k] = f; }));
    Promise.all(all).then(() => { painted = null; paint(); }).catch(() => {});
  }
  function paint(){
    const ink = state.manual ? FLARE : BONE;
    const stamp = ink + '|' + tuned('weight');
    if (painted === stamp) return;
    painted = stamp;
    for (const k in faces){
      const cv = k === 'rose' ? rose : pts[k];
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

  /* the rose turns as one; each letter is set at the turned point, and
     not turned itself */
  function lay(deg){
    if (deg === last) return;
    last = deg;
    rose.style.transform = 'rotate(' + deg.toFixed(2) + 'deg)';
    const c = BOX / 2;
    const at = {n: -90, e: 0, s: 90, w: 180};
    for (const k in pts){
      const a = (at[k] + deg) * Math.PI / 180;
      pts[k].style.left = (c + Math.cos(a) * OUT) + 'px';
      pts[k].style.top = (c + Math.sin(a) * OUT) + 'px';
    }
    el.classList.toggle('manual', state.manual);
    paint();
  }

  /* shown by the same rule as the chrome: not on the wallpaper, not under a
     page, not while the map bar is up in the same lane */
  function visible(){
    const b = document.body.classList;
    return !(b.contains('wall') || b.contains('bag') || b.contains('journal') ||
             b.contains('locus') || b.contains('missions') || b.contains('mapping') ||
             b.contains('towns'));
  }
  function tick(){
    raf = requestAnimationFrame(tick);
    if (!el) return;
    const v = visible() ? 1 : 0;
    if (v !== shown){ shown = v; el.hidden = !v; }
    if (v) lay(heading());
    const tp = document.getElementById('tune');
    if (tp && !tp.hidden) block();
  }

  function wire(){
    const centre = () => { const b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; };
    const angle = (e, c) => Math.atan2(e.clientY - c[1], e.clientX - c[0]) * 180 / Math.PI;
    rose.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      const c = centre();
      drag = {c, a0: angle(e, c), d0: heading(), moved: false};
      rose.setPointerCapture(e.pointerId);
    });
    rose.addEventListener('pointermove', e => {
      if (!drag) return;
      const d = angle(e, drag.c) - drag.a0;
      if (Math.abs(d) > 2) drag.moved = true;
      if (!drag.moved) return;
      state = {manual: true, deg: ((drag.d0 + d) % 360 + 360) % 360};
      lay(state.deg);
    });
    const up = e => {
      if (!drag) return;
      const was = drag; drag = null;
      if (was.moved){ store(); note('the compass is yours · ' + Math.round(state.deg) + '° · double-click for the map’s north'); }
    };
    rose.addEventListener('pointerup', up);
    rose.addEventListener('pointercancel', up);
    rose.addEventListener('dblclick', e => {
      e.preventDefault(); e.stopPropagation();
      if (!state.manual) return;
      state = {manual: false, deg: 0}; store();
      note('the compass follows the map again');
    });
  }

  function init(){
    if (typeof COMPASS_ART === 'undefined') return;
    load(); build();
    if (!raf) tick();
  }
  function set(deg){
    state = {manual: true, deg: ((+deg || 0) % 360 + 360) % 360}; store();
    return state.deg;
  }
  function follow(){ state = {manual: false, deg: 0}; store(); }

  return {init, set, follow, heading, manual: () => state.manual};
})();
