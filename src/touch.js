'use strict';
/* ── touch ───────────────────────────────────────────────────────────────
   The game is keyboard-driven — WASD walks, Enter opens, Esc backs out,
   B builds, M maps, T tunes, V minimal, P plays — and a phone has none of
   those. This lays the keys on the screen: a d-pad at the bottom right
   and a column of buttons above it, each of which presses the same key
   the keyboard would, as a synthetic KeyboardEvent on the window, so
   every listener in the game answers it exactly as it answers a key. A
   held arrow is a held key (keydown on touch, keyup on release), which is
   what makes the walker keep walking. Two fingers on the plate pinch the
   zoom, through the same zoomBy the wheel uses.

   Only on `body.mobile` (index.html decides: a coarse pointer, or a
   narrow window); on a desk nothing here is built.                      */

const Touch = (() => {
  const PAD = [
    [null, ['ArrowUp', '▲'], null],
    [['ArrowLeft', '◀'], null, ['ArrowRight', '▶']],
    [null, ['ArrowDown', '▼'], null]
  ];
  const KEYS = [['Enter', 'enter'], ['Escape', 'esc'], ['KeyB', 'B'], ['KeyM', 'M'],
                ['KeyT', 'T'], ['KeyV', 'V'], ['KeyP', 'P']];
  let el = null;

  const press = (code, down) => {
    const key = code === 'Enter' ? 'Enter' : code === 'Escape' ? 'Escape' : code.replace(/^Key|^Arrow/, '');
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', {code, key, bubbles: true, cancelable: true}));
  };
  function button(code, label, cls){
    const b = document.createElement('div');
    b.className = 'tkey ' + (cls || ''); b.textContent = label; b.dataset.code = code;
    const down = e => {
      e.preventDefault(); b.classList.add('on'); press(code, true);
      try { b.setPointerCapture(e.pointerId); } catch (err){}   // a pointer that cannot be captured is still a press
    };
    const up = e => { if (!b.classList.contains('on')) return; b.classList.remove('on'); press(code, false); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', e => e.preventDefault());
    return b;
  }

  function build(){
    if (el) return el;
    el = document.createElement('div');
    el.id = 'touch';
    const pad = document.createElement('div');
    pad.className = 'tpad';
    for (const row of PAD) for (const cell of row){
      if (!cell){ const gap = document.createElement('div'); gap.className = 'tgap'; pad.appendChild(gap); continue; }
      pad.appendChild(button(cell[0], cell[1], 'tarrow'));
    }
    const col = document.createElement('div');
    col.className = 'tkeys';
    for (const [code, label] of KEYS) col.appendChild(button(code, label, code === 'Enter' ? 'tenter' : ''));
    el.append(col, pad);
    document.body.appendChild(el);
    pinch();
    return el;
  }

  /* two fingers on the plate: the distance between them is the zoom */
  function pinch(){
    const cv = document.getElementById('gl'); if (!cv) return;
    const fingers = new Map(); let d0 = 0;
    const dist = () => { const [a, b] = [...fingers.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
    cv.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch') return;
      fingers.set(e.pointerId, [e.clientX, e.clientY]);
      if (fingers.size === 2) d0 = dist();
    });
    cv.addEventListener('pointermove', e => {
      if (!fingers.has(e.pointerId)) return;
      fingers.set(e.pointerId, [e.clientX, e.clientY]);
      if (fingers.size === 2 && d0 > 0 && typeof zoomBy === 'function'){
        const d = dist();
        if (Math.abs(d - d0) > 4){ zoomBy(d / d0); d0 = d; }
      }
    });
    const lift = e => { fingers.delete(e.pointerId); d0 = 0; };
    cv.addEventListener('pointerup', lift);
    cv.addEventListener('pointercancel', lift);
  }

  function init(){
    if (!document.body.classList.contains('mobile')) return false;
    build();
    return true;
  }
  return {init, press};
})();
