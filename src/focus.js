'use strict';
/* ── the focus ──────────────────────────────────────────────────────────
   One acronym from the journal, stood up on the left of the plate as a
   column of diamonds, a letter in each — the thing you are holding in
   mind while you walk. Press a letter and it opens: a row of diamonds
   beside it, one for each item under that letter, and the word the
   letter stands for set on the diagonal above them.

   Which acronym is `hq.journal.focus`, chosen in the journal with the
   ◆ beside a row; the letters, words and items are read from the
   journal's frame and notes, so what is typed there is what stands
   here. Nothing is kept in this file.

   It is chrome, under the compass and above the hub, and it is made of
   the plate's material by the rule in STYLE.md (*The lattice*): every
   diamond is a diamond-shaped region of lattice cells at the plate's
   pitch, painted through `Title.paint`; the letters and the word are
   type over it. Hidden by the same rule as the compass — not on the
   wallpaper, not under a page. */

const Focus = (() => {
  const LEFT = 8, TOP = 270, BOTTOM = 190;   // CSS px: under the compass, above the hub
  const WIDTH = 420;
  const SIZE = 84, GAP = 12;                  // a letter diamond, and the space between two
  const ROW = 0.78;                           // an item diamond, as a fraction of a letter's
  let el = null, cv = null, ctx = null, raf = 0;
  let open = -1, hoverItem = -1, painted = '', F = null, DPR = 1;
  let hits = [];                              // [{x, y, r, k}] in CSS px, for the pointer

  const tok = n => getComputedStyle(document.documentElement).getPropertyValue('--' + n).trim();
  const rgbOf = hex => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];
  const pitch = () => (typeof G !== 'undefined' && G.A && G.fitAll ? G.A.cell * G.fitAll : 3.17);

  function visible(){
    const b = document.body.classList;
    return !(b.contains('wall') || b.contains('bag') || b.contains('journal') ||
             b.contains('locus') || b.contains('missions') || b.contains('mapping') ||
             b.contains('towns')) && !!F;
  }

  /* the layout in CSS px: the column shrinks to fit between the compass
     and the hub when an acronym is long */
  function layout(){
    const n = F.letters.length;
    const room = innerHeight - TOP - BOTTOM;
    const size = Math.max(40, Math.min(SIZE, (room - GAP * (n - 1)) / n));
    const out = [];
    for (let k = 0; k < n; k++) out.push({x: LEFT + size / 2 + 4, y: TOP + size / 2 + k * (size + GAP), r: size / 2, k});
    return out;
  }

  /* one diamond-shaped region of the lattice, centred in CSS px */
  function diamond(f, p, x, y, r, al, rgb){
    const cx = x / p, cy = y / p, rc = r / p;
    const i0 = Math.floor(cx - rc), i1 = Math.ceil(cx + rc), j0 = Math.floor(cy - rc), j1 = Math.ceil(cy + rc);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++)
      if (Math.abs(i + 0.5 - cx) + Math.abs(j + 0.5 - cy) <= rc) f.cells.push({x: i, y: j, al, rgb, sz: 1});
  }

  function paint(){
    if (!cv || !F) return;
    const W = Math.round(WIDTH * DPR), H = Math.round((innerHeight - TOP - BOTTOM + SIZE) * DPR);
    if (cv.width !== W || cv.height !== H){ cv.width = W; cv.height = H; cv.style.width = WIDTH + 'px'; cv.style.height = (H / DPR) + 'px'; }
    const p = pitch() * DPR;
    const face = {cols: Math.ceil(W / p), rows: Math.ceil(H / p), cells: []};
    const bone = rgbOf(tok('bone')), dim = rgbOf(tok('dim'));
    hits = layout();
    const y0 = TOP - SIZE / 2;                 // the canvas starts half a diamond above the first
    /* the open letter's row: items, first nearest and brightest, each a
       little under the one before — pushed last-first so the first is
       painted on top */
    if (open >= 0 && hits[open]){
      const h = hits[open], items = F.items[open] || [];
      const rr = h.r * ROW, step = rr * 1.15;
      for (let m = items.length - 1; m >= 0; m--){
        const al = Math.max(.3, .85 - m * .22);
        diamond(face, p, (h.x + h.r * 1.35 + rr + m * step) * DPR, (h.y - y0) * DPR, rr * DPR, hoverItem === m ? 1 : al, bone);
      }
    }
    for (const h of hits) diamond(face, p, h.x * DPR, (h.y - y0) * DPR, h.r * DPR, open === h.k ? 1 : .82, bone);
    Title.paint(cv, face, {weight: 1});

    /* the type over it: a letter in each diamond, the word on the
       diagonal, an item's text under the row while it is pointed at */
    const x = ctx;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = tok('ground');
    for (const h of hits){
      x.font = '400 ' + Math.round(h.r * 0.95 * DPR) + 'px ' + tok('mono');
      x.fillText(F.letters[h.k], h.x * DPR, (h.y - y0) * DPR + h.r * 0.04 * DPR);
    }
    if (open >= 0 && hits[open]){
      const h = hits[open];
      const word = (F.words[open] || '').trim();
      if (word){
        x.save();
        x.translate((h.x + h.r * 0.55) * DPR, (h.y - y0 - h.r * 0.55) * DPR);
        x.rotate(-Math.PI / 4);
        x.textAlign = 'left'; x.textBaseline = 'alphabetic';
        x.fillStyle = tok('bone');
        x.font = '400 ' + Math.round(14 * DPR) + 'px ' + tok('mono');
        x.fillText(word.toUpperCase().split('').join(' '), 0, 0);
        x.restore();
      }
      const items = F.items[open] || [];
      if (hoverItem >= 0 && items[hoverItem]){
        x.textAlign = 'left'; x.textBaseline = 'top';
        x.fillStyle = tok('bone');
        x.font = '400 ' + Math.round(10 * DPR) + 'px ' + tok('mono');
        x.fillText(String(hoverItem + 1) + '  ' + items[hoverItem], (h.x + h.r * 1.35) * DPR, (h.y - y0 + h.r * ROW + 8) * DPR);
      } else if (!items.length){
        x.textAlign = 'left'; x.textBaseline = 'middle';
        x.fillStyle = tok('dim');
        x.font = '400 ' + Math.round(9 * DPR) + 'px ' + tok('mono');
        x.fillText('NO ITEMS YET', (h.x + h.r * 1.35) * DPR, (h.y - y0) * DPR);
      }
    }
    el.style.top = y0 + 'px';
  }

  /* the pointer: a letter opens or closes; an item lights and says its name */
  function at(ev){
    const b = cv.getBoundingClientRect();
    return [ev.clientX - b.left, ev.clientY - b.top + (TOP - SIZE / 2)];
  }
  function letterAt(x, y){
    for (const h of hits) if (Math.abs(x - h.x) + Math.abs(y - h.y) <= h.r) return h.k;
    return -1;
  }
  function itemAt(x, y){
    if (open < 0 || !hits[open]) return -1;
    const h = hits[open], items = F.items[open] || [], rr = h.r * ROW, step = rr * 1.15;
    for (let m = 0; m < items.length; m++){
      const cx = h.x + h.r * 1.35 + rr + m * step;
      if (Math.abs(x - cx) + Math.abs(y - h.y) <= rr) return m;
    }
    return -1;
  }
  /* The canvas never takes the pointer itself — where there is no diamond
     the plate under it is what should be clicked and walked. So the
     window is listened to, in the capture phase, and an event over one of
     our diamonds is handled here and stopped; every other one goes on to
     the plate untouched. */
  const over = () => el && !el.hidden && F;
  function onMove(ev){
    if (!over()){ if (hoverItem >= 0){ hoverItem = -1; painted = ''; } return; }
    const [x, y] = at(ev);
    const m = itemAt(x, y), l = letterAt(x, y);
    document.body.classList.toggle('focus-hit', m >= 0 || l >= 0);
    if (m !== hoverItem){ hoverItem = m; painted = ''; }
  }
  function onDown(ev){
    if (!over()) return;
    const [x, y] = at(ev);
    if (letterAt(x, y) >= 0 || itemAt(x, y) >= 0){ ev.stopPropagation(); ev.preventDefault(); }
  }
  function onClick(ev){
    if (!over()) return;
    const [x, y] = at(ev);
    const l = letterAt(x, y);
    if (l >= 0){ ev.stopPropagation(); ev.preventDefault(); open = open === l ? -1 : l; hoverItem = -1; painted = ''; return; }
    const m = itemAt(x, y);
    if (m >= 0){ ev.stopPropagation(); ev.preventDefault(); if (typeof Journal !== 'undefined' && Journal.openAt) Journal.openAt(F.ids[open]); }
  }

  function read(){
    F = typeof Journal !== 'undefined' && Journal.focused ? Journal.focused() : null;
    if (F && open >= F.letters.length) open = -1;
    painted = '';
  }
  function tick(){
    raf = requestAnimationFrame(tick);
    if (!el) return;
    const v = visible();
    el.hidden = !v;
    if (!v) return;
    DPR = Math.min(2, devicePixelRatio || 1);
    const key = [innerHeight, DPR, open, hoverItem, F.letters.join(''), F.words.join('|'), F.items.map(i => i.join('|')).join('/'), pitch().toFixed(2)].join('#');
    if (key === painted) return;
    painted = key;
    paint();
  }

  function init(){
    el = document.createElement('div');
    el.id = 'focus'; el.hidden = true;
    cv = document.createElement('canvas');
    el.appendChild(cv);
    document.body.appendChild(el);
    ctx = cv.getContext('2d');
    addEventListener('mousemove', onMove, true);
    addEventListener('pointerdown', onDown, true);
    addEventListener('mousedown', onDown, true);
    addEventListener('click', onClick, true);
    read();
    if (typeof Store !== 'undefined') Store.watch('hq.journal', read);
    addEventListener('resize', () => { painted = ''; });
    if (!raf) raf = requestAnimationFrame(tick);
  }

  return {init, refresh: read, open: k => { open = k; painted = ''; }, opened: () => open};
})();
