'use strict';
/* ── the compass ────────────────────────────────────────────────────────
   Top-left, under the sparks: a rose that turns and four letters that do
   not. The rose follows the map — the traced underlay's own rotation,
   which is the one number in this game that says which way north is —
   and turns with it as the picture is placed. Take hold of the rose and
   turn it and it is yours instead, at whatever heading you leave it;
   double-click it and it is the map's again.

   Five masks out of one drawing (`tools/compass.py`): the rose is one
   element with a transform, and each letter is its own element placed
   at the rose's turned point every time the angle moves, upright — a
   letter that turned with the rose would be a letter read on its side.
   They wear bone through the mask, so the compass is chrome in the
   chrome's colour and never a picture laid on the plate. */

const Compass = (() => {
  const KEY = 'hq.compass';                    // {manual, deg}
  const BOX = 200;                             // the element, CSS px (index.html agrees)
  const OUT = 82;                              // letter centre from the rose's centre, clear of its rim
  let el = null, rose = null, pts = {}, state = {manual: false, deg: 0};
  let shown = -1, last = null, drag = null, raf = 0;

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
    rose = document.createElement('div');
    rose.className = 'rose';
    rose.style.webkitMaskImage = rose.style.maskImage = COMPASS_ART.rose;
    el.append(rose);
    for (const k of ['n', 'e', 's', 'w']){
      const p = document.createElement('div');
      p.className = 'pt pt-' + k;
      p.style.webkitMaskImage = p.style.maskImage = COMPASS_ART[k];
      el.append(p);
      pts[k] = p;
    }
    document.body.append(el);
    wire();
    return el;
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
