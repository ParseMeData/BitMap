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
  const PITCH = 2.2, SCALE = 2;
  const SIZE = {rose: [120, 120], n: [50, 30], e: [40, 30], s: [40, 30], w: [40, 30]};
  const BONE = [0.93, 0.92, 0.89], FLARE = [1, 0.373, 0.635];
  const SHEEN = 0.35;
  const url = k => COMPASS_ART[k].replace(/^url\("(.*)"\)$/, '$1');

  function load(){
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v && typeof v === 'object') state = {manual: !!v.manual, deg: isFinite(v.deg) ? +v.deg : 0};
    } catch (e){}
  }
  function store(){
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e){}
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
    const all = ['rose', 'n', 'e', 's', 'w'].map(k =>
      Title.picture(url(k), Math.round(SIZE[k][0] / PITCH), {ink: 0, edge: 0, con: 1, bri: -0.12})
        .then(f => { faces[k] = f; }));
    Promise.all(all).then(() => { painted = null; paint(); }).catch(() => {});
  }
  function paint(){
    const ink = state.manual ? FLARE : BONE;
    if (painted === ink) return;
    painted = ink;
    for (const k in faces){
      const cv = k === 'rose' ? rose : pts[k];
      if (cv && faces[k]) Title.paint(cv, faces[k], {weight: 0.8, shade: SHEEN, tint: ink});
    }
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
             b.contains('locus') || b.contains('missions') || b.contains('mapping'));
  }
  function tick(){
    raf = requestAnimationFrame(tick);
    if (!el) return;
    const v = visible() ? 1 : 0;
    if (v !== shown){ shown = v; el.hidden = !v; }
    if (v) lay(heading());
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
