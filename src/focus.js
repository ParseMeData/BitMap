'use strict';
/* ── the focus ──────────────────────────────────────────────────────────
   One acronym from the journal, stood up on the left of the plate as a
   column of diamonds, a letter in each — the thing you are holding in
   mind while you walk. It stands on the hub: the column is centred on
   the HUD's pair of diamonds and its last letter sits just above them,
   so the letters and the three diamonds read as one piece.

   Press a letter and it opens: a row of diamonds beside it, one for each
   item under that letter, and the word the letter stands for set on the
   diagonal above them. Press an item and it is PICKED; press it again
   and the journal opens on that letter. Press anywhere else with an item
   picked and the whole acronym folds down to one larger diamond above
   the hub, showing the picked item's first letter — the one thing you
   are carrying — its lower point resting on the pair's centre line.
   Press that and the column stands up again, the item still lit.

   Which acronym is `hq.journal.focus`, chosen in the journal with the ◆
   beside a row; which item is picked is `hq.journal.pick`; the letters,
   words and items are read from the journal's frame and notes, so what
   is typed there is what stands here. Nothing is kept in this file.

   It is chrome, and it is made of the plate's material by the rule in
   STYLE.md (*The lattice*): every diamond is a diamond-shaped region of
   lattice cells at the plate's pitch, painted through `Title.paint`;
   the letters and the word are type over it. Hidden by the same rule as
   the compass — not on the wallpaper, not under a page. */

const Focus = (() => {
  /* the hub, as hud.js places it: the pair's centres at x = EDGE + SPAN +
     RIM and + JX, y = height − LIFT, half-size HUB */
  const HUB_X = 16 + 30 + 24, HUB_DX = 16 * 2 + 12, HUB_Y = 132, HUB_R = 16;
  const AXIS = HUB_X + HUB_DX / 2;            // the column's centre line: between the pair
  const TOP = 270;                            // under the compass
  const SIZE = 84, GAP = 12;                  // a letter diamond, and the space between two
  const ROW = 0.78;                           // an item diamond, as a fraction of a letter's
  const PICK_R = HUB_R * 2;                   // the folded diamond: twice the hub's
  const WIDTH = 460;
  let el = null, cv = null, ctx = null, raf = 0;
  let open = -1, hoverItem = -1, folded = false, painted = '', F = null, P = null, DPR = 1;
  let hits = [], row = null, fold = null;     // geometry in CSS px, for the pointer

  const tok = n => getComputedStyle(document.documentElement).getPropertyValue('--' + n).trim();
  const rgbOf = hex => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];
  const pitch = () => (typeof G !== 'undefined' && G.A && G.fitAll ? G.A.cell * G.fitAll : 3.17);

  function visible(){
    const b = document.body.classList;
    return !(b.contains('wall') || b.contains('bag') || b.contains('journal') ||
             b.contains('locus') || b.contains('missions') || b.contains('mapping') ||
             b.contains('towns')) && !!F;
  }

  /* ── the layout, in CSS px ─────────────────────────────────────────────
     Standing: the column hangs from the hub upward — the last letter's
     lower point a gap above the pair's upper points — and shrinks to fit
     under the compass when an acronym is long. Folded: one diamond on
     the axis, its lower point on the pair's centre line. */
  function layout(){
    const H = innerHeight, n = F.letters.length;
    const foot = H - HUB_Y - HUB_R - 8;       // where the last letter's lower point may reach
    const room = foot - TOP;
    const size = Math.max(40, Math.min(SIZE, (room - GAP * (n - 1)) / n));
    hits = [];
    for (let k = 0; k < n; k++){
      const y = foot - size / 2 - (n - 1 - k) * (size + GAP);
      hits.push({x: AXIS, y, r: size / 2, k});
    }
    row = null;
    if (open >= 0 && hits[open]){
      const h = hits[open], rr = h.r * ROW, step = rr * 1.15, x0 = h.x + h.r * 1.35 + rr;
      row = {h, rr, step, x0, n: (F.items[open] || []).length};
    }
    fold = {x: AXIS, y: H - HUB_Y - PICK_R, r: PICK_R};
  }

  /* one diamond-shaped region of the lattice, centred in CSS px */
  function diamond(f, p, x, y, r, al, rgb){
    const cx = x / p, cy = y / p, rc = r / p;
    const i0 = Math.floor(cx - rc), i1 = Math.ceil(cx + rc), j0 = Math.floor(cy - rc), j1 = Math.ceil(cy + rc);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++)
      if (Math.abs(i + 0.5 - cx) + Math.abs(j + 0.5 - cy) <= rc) f.cells.push({x: i, y: j, al, rgb, sz: 1});
  }
  const picked = k => P && F && F.ids[k] === P.id;

  function paint(){
    if (!cv || !F) return;
    layout();
    const W = Math.round(WIDTH * DPR), H = Math.round(innerHeight * DPR);
    if (cv.width !== W || cv.height !== H){ cv.width = W; cv.height = H; cv.style.width = WIDTH + 'px'; cv.style.height = innerHeight + 'px'; }
    const p = pitch() * DPR;
    const face = {cols: Math.ceil(W / p), rows: Math.ceil(H / p), cells: []};
    const bone = rgbOf(tok('bone')), flare = rgbOf(tok('flare'));
    const x = ctx;
    x.textAlign = 'center'; x.textBaseline = 'middle';

    if (folded && P){
      /* the one thing you are carrying: the picked item's first letter */
      diamond(face, p, fold.x * DPR, fold.y * DPR, fold.r * DPR, 1, bone);
      Title.paint(cv, face, {weight: 1});
      x.fillStyle = tok('ground');
      x.font = '400 ' + Math.round(fold.r * 1.1 * DPR) + 'px ' + tok('mono');
      x.fillText((P.text || '?').trim().charAt(0).toUpperCase(), fold.x * DPR, (fold.y + fold.r * 0.04) * DPR);
      return;
    }

    /* the open letter's row: items, first nearest and brightest, each a
       little under the one before — pushed last-first so the first is
       painted on top; the picked one in flare */
    if (row){
      const items = F.items[open] || [];
      for (let m = items.length - 1; m >= 0; m--){
        const isPick = picked(open) && P.item === m;
        const al = isPick || hoverItem === m ? 1 : Math.max(.3, .85 - m * .22);
        diamond(face, p, (row.x0 + m * row.step) * DPR, row.h.y * DPR, row.rr * DPR, al, isPick ? flare : bone);
      }
    }
    for (const h of hits) diamond(face, p, h.x * DPR, h.y * DPR, h.r * DPR, open === h.k ? 1 : .82, bone);
    Title.paint(cv, face, {weight: 1});

    /* the type over it: a letter in each diamond, the word on the
       diagonal, an item's text under the row while it is pointed at or
       picked */
    x.fillStyle = tok('ground');
    for (const h of hits){
      x.font = '400 ' + Math.round(h.r * 0.95 * DPR) + 'px ' + tok('mono');
      x.fillText(F.letters[h.k], h.x * DPR, (h.y + h.r * 0.04) * DPR);
    }
    /* each item's first letter, in its diamond */
    if (row){
      const items = F.items[open] || [];
      x.font = '400 ' + Math.round(row.rr * 0.9 * DPR) + 'px ' + tok('mono');
      for (let m = 0; m < items.length; m++)
        x.fillText((items[m] || '').trim().charAt(0).toUpperCase(), (row.x0 + m * row.step) * DPR, (row.h.y + row.rr * 0.04) * DPR);
    }
    if (row){
      const h = row.h, word = (F.words[open] || '').trim(), items = F.items[open] || [];
      if (word){
        x.save();
        /* from above the row's first diamond, rising to the right, clear of the letter */
        x.translate((h.x + h.r * 1.2) * DPR, (h.y - h.r * 1.0) * DPR);
        x.rotate(-Math.PI / 4);
        x.textAlign = 'left'; x.textBaseline = 'alphabetic';
        x.fillStyle = tok('bone');
        x.font = '400 ' + Math.round(14 * DPR) + 'px ' + tok('mono');
        x.fillText(word.toUpperCase().split('').join(' '), 0, 0);
        x.restore();
        x.textAlign = 'left'; x.textBaseline = 'top';
      }
      const say = hoverItem >= 0 ? hoverItem : (picked(open) ? P.item : -1);
      x.textAlign = 'left'; x.textBaseline = 'top';
      if (say >= 0 && items[say]){
        x.fillStyle = tok(picked(open) && P.item === say ? 'flare' : 'bone');
        x.font = '400 ' + Math.round(10 * DPR) + 'px ' + tok('mono');
        x.fillText(String(say + 1) + '  ' + items[say], (h.x + h.r * 1.35) * DPR, (h.y + row.rr + 8) * DPR);
      } else if (!items.length){
        x.textBaseline = 'middle';
        x.fillStyle = tok('dim');
        x.font = '400 ' + Math.round(9 * DPR) + 'px ' + tok('mono');
        x.fillText('NO ITEMS YET', (h.x + h.r * 1.35) * DPR, h.y * DPR);
      }
    }
  }

  /* ── the pointer ───────────────────────────────────────────────────────
     The canvas never takes the pointer itself — where there is no diamond
     the plate under it is what should be clicked and walked. So the
     window is listened to, in the capture phase, and an event over one of
     our diamonds is handled here and stopped; every other one goes on to
     the plate untouched — except that, with an item picked, a press
     anywhere else folds the column, and still goes on to the plate. */
  const over = () => el && !el.hidden && F;
  const at = ev => { const b = cv.getBoundingClientRect(); return [ev.clientX - b.left, ev.clientY - b.top]; };
  const inD = (x, y, d) => Math.abs(x - d.x) + Math.abs(y - d.y) <= d.r;
  function letterAt(x, y){ if (folded) return -1; for (const h of hits) if (inD(x, y, h)) return h.k; return -1; }
  function itemAt(x, y){
    if (folded || !row) return -1;
    for (let m = 0; m < row.n; m++) if (inD(x, y, {x: row.x0 + m * row.step, y: row.h.y, r: row.rr})) return m;
    return -1;
  }
  const foldAt = (x, y) => folded && P && inD(x, y, fold);
  const hit = (x, y) => letterAt(x, y) >= 0 || itemAt(x, y) >= 0 || foldAt(x, y);

  function onMove(ev){
    if (!over()){ if (hoverItem >= 0){ hoverItem = -1; painted = ''; } return; }
    const [x, y] = at(ev);
    const m = itemAt(x, y);
    document.body.classList.toggle('focus-hit', hit(x, y));
    if (m !== hoverItem){ hoverItem = m; painted = ''; }
  }
  function onDown(ev){
    if (!over()) return;
    const [x, y] = at(ev);
    if (hit(x, y)){ ev.stopPropagation(); ev.preventDefault(); }
  }
  function onClick(ev){
    if (!over()) return;
    const [x, y] = at(ev);
    if (foldAt(x, y)){
      ev.stopPropagation(); ev.preventDefault();
      folded = false; open = F.ids.indexOf(P.id); hoverItem = -1; painted = '';
      return;
    }
    const l = letterAt(x, y);
    if (l >= 0){
      ev.stopPropagation(); ev.preventDefault();
      open = open === l ? -1 : l; hoverItem = -1; painted = '';
      return;
    }
    const m = itemAt(x, y);
    if (m >= 0){
      ev.stopPropagation(); ev.preventDefault();
      if (picked(open) && P.item === m){ if (typeof Journal !== 'undefined' && Journal.openAt) Journal.openAt(F.ids[open]); return; }
      if (typeof Journal !== 'undefined' && Journal.setPick) Journal.setPick(F.ids[open], m);
      painted = '';
      return;
    }
    /* away, with something picked: fold — and let the press go on */
    if (P && !folded){ folded = true; hoverItem = -1; painted = ''; }
  }

  function read(){
    F = typeof Journal !== 'undefined' && Journal.focused ? Journal.focused() : null;
    P = F && Journal.pick ? Journal.pick() : null;
    if (F && open >= F.letters.length) open = -1;
    if (!P) folded = false;
    painted = '';
  }
  function tick(){
    raf = requestAnimationFrame(tick);
    if (!el) return;
    const v = visible();
    el.hidden = !v;
    if (!v) return;
    DPR = Math.min(2, devicePixelRatio || 1);
    const key = [innerHeight, DPR, open, hoverItem, folded, P ? P.id + ':' + P.item : '', F.letters.join(''), F.words.join('|'),
                 F.items.map(i => i.join('|')).join('/'), pitch().toFixed(2)].join('#');
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
    /* a pick that was there when the page opened is carried folded: the
       one thing you were holding, still held */
    if (P) folded = true;
    if (typeof Store !== 'undefined') Store.watch('hq.journal', read);
    addEventListener('resize', () => { painted = ''; });
    if (!raf) raf = requestAnimationFrame(tick);
  }

  return {init, refresh: read, open: k => { open = k; folded = false; painted = ''; }, opened: () => open,
          fold: v => { folded = !!v && !!P; painted = ''; }, folded: () => folded};
})();
