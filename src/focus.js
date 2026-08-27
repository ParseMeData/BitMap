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
  let open = -1, rowOpen = false, rowK = -1, hoverItem = -1, cursor = -1, folded = false, hubSel = null, painted = '', F = null, P = null, DPR = 1;
  let hits = [], row = null, fold = null;     // geometry in CSS px, for the pointer

  /* ── motion ────────────────────────────────────────────────────────────
     STYLE.md: a panel never animates; the lattice may, because it is the
     lattice moving. Everything here is a tween from 0 to 1 over a few
     hundred milliseconds — standing up, a row opening, the fold — read
     each frame and folded into the geometry. Out is quick with a little
     overshoot, so a diamond pops; back is quicker and eases in, so it
     drops away rather than shrinking in place. */
  const T = {};                               // name → {v, from, to, t0, dur, ease}
  const outBack = t => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const inCubic = t => t * t * t;
  const outCubic = t => 1 - Math.pow(1 - t, 3);
  const inOutCubic = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function tween(name, to, dur, ease){
    const cur = T[name] ? val(name) : (to ? 0 : 1);
    if (T[name] && T[name].to === to) return;
    T[name] = {from: cur, to, t0: performance.now(), dur, ease: ease || (to ? outBack : inCubic)};
  }
  function val(name){
    const t = T[name]; if (!t) return 1;
    const k = Math.min(1, (performance.now() - t.t0) / t.dur);
    return t.from + (t.to - t.from) * t.ease(k);
  }
  const moving = () => Object.values(T).some(t => performance.now() - t.t0 < t.dur);
  const lerp = (a, b, k) => a + (b - a) * k;

  const tok = n => getComputedStyle(document.documentElement).getPropertyValue('--' + n).trim();
  /* the items' tones, in order, from the plate palette (STYLE.md) — the
     one place on the chrome that borrows the plate's colours, because the
     row is plate material: bone, park, flare, creek, stairs, rug, gold,
     and round again. The lead wears its tone whole; every diamond away
     from it is pulled a step toward dim, opaque throughout */
  const TONES = ['#EDEAE3', '#7BB86F', '#FF5FA2', '#3E7FBF', '#C39A5C', '#94383F', '#F2C14E'];
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
  /* With a letter open the column makes room for it: the gap on either
     side of it opens up, and the letters further out close over one
     another — more overlapped, and fainter, the further they are. The
     last letter keeps its foot on the hub. The positions ease toward
     their targets a little each frame (`cur`), so a change of letter
     slides rather than jumps. */
  const cur = {y: [], al: []};
  function layout(){
    const H = innerHeight, n = F.letters.length;
    const foot = H - HUB_Y - HUB_R - GAP;     // the last letter's lower point: the hub's own gap above the pair
    const room = foot - TOP;
    const size = Math.max(40, Math.min(SIZE, (room - GAP * (n - 1)) / n));
    /* the gap after letter k (between k and k+1), by how far the pair is
       from the open letter: room beside it, then closing over */
    const gapAt = k => {
      if (open < 0 || folded) return GAP;
      const d = Math.min(Math.abs(k - open), Math.abs(k + 1 - open));   // 0 when the open letter is one of the pair
      return d === 0 ? GAP * 2.2 : d === 1 ? -size * .1 : -size * .32;
    };
    const ys = [], als = [];
    let y = foot - size / 2;
    for (let k = n - 1; k >= 0; k--){
      ys[k] = y;
      als[k] = open < 0 || folded ? (open === k ? 0 : .18) : Math.min(.8, Math.abs(k - open) * .32);   // how far toward dim, not how faint
      if (k > 0) y -= size + gapAt(k - 1);
    }
    hits = [];
    for (let k = 0; k < n; k++){
      if (cur.y[k] == null){ cur.y[k] = ys[k]; cur.al[k] = als[k]; }
      hits.push({x: AXIS, y: cur.y[k], r: size / 2, k, ty: ys[k], tal: als[k]});
    }
    row = null;
    /* a row is drawn for the letter it was opened on — `rowK` — while it
       is out, and while it is still sliding back in after the letter has
       changed; never for the letter just arrived at */
    const k = (open >= 0 && rowOpen) ? open : (T.row && val('row') > 0 ? rowK : -1);
    if (k >= 0 && hits[k]){
      const h = hits[k], rr = h.r * ROW, step = rr * 1.15, x0 = h.x + h.r * 1.35 + rr;
      row = {k, h, rr, step, x0, n: (F.items[k] || []).length};
    }
    fold = {x: AXIS, y: H - HUB_Y - PICK_R, r: PICK_R};
  }

  /* one diamond-shaped region of the lattice, centred in CSS px */
  /* Every diamond wears a rim of ground two cells deep, laid first: on the
     bare plate it is nothing, and where one diamond lies over another it
     is the dark edge that says which is on top. */
  const RIM = 1.8;                            // cells
  function diamond(f, p, x, y, r, al, rgb, rgb2){
    const cx = x / p, cy = y / p, rc = r / p, ro = rc + RIM;
    const i0 = Math.floor(cx - ro), i1 = Math.ceil(cx + ro), j0 = Math.floor(cy - ro), j1 = Math.ceil(cy + ro);
    const ground = GROUND || (GROUND = rgbOf(tok('ground')));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++){
      const d = Math.abs(i + 0.5 - cx) + Math.abs(j + 0.5 - cy);
      if (d > rc && d <= ro) f.cells.push({x: i, y: j, al: Math.min(1, al * 1.5), rgb: ground, sz: 1});
    }
    /* a second colour runs the diamond from its top point to its foot */
    for (let j = j0; j <= j1; j++){
      const c = rgb2 ? (() => { const t = Math.max(0, Math.min(1, (j + 0.5 - (cy - rc)) / (2 * rc))); return [lerp(rgb[0], rgb2[0], t), lerp(rgb[1], rgb2[1], t), lerp(rgb[2], rgb2[2], t)]; })() : rgb;
      for (let i = i0; i <= i1; i++)
        if (Math.abs(i + 0.5 - cx) + Math.abs(j + 0.5 - cy) <= rc) f.cells.push({x: i, y: j, al, rgb: c, sz: 1});
    }
  }
  let GROUND = null;

  /* ── the type ──────────────────────────────────────────────────────────
     Every letter and word here is set in Roboto Slab and read back as
     cells through `Title.face`, the way the town's title is: one diamond
     per cell of ink at the plate's pitch, painted once into a small
     canvas and stamped where it goes. Until the font has landed the mono
     stands in, and the first paint after it lands replaces it. */
  /* kept for a letter that asks for it (`font: true` on a text entry);
     nothing asks today — Eden preferred the chrome's mono */
  const FONT = 'Roboto Slab';
  const glyphs = new Map();
  /* `cols` to Title.face is the text's WIDTH in cells; what is wanted here
     is a height, so the text's own proportion in the font decides the
     width — a narrow I stays narrow instead of growing tall to fill */
  let meas = null;
  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  /* a single letter is read in a box measured over the whole alphabet
     (`ref`, as the bag's cards do), so every letter stands at one size on
     one line and a narrow one stays narrow; a word is fitted to its own
     ink. Either way the width in cells follows from the rows wanted. */
  function colsFor(text, rows, ref){
    if (!meas) meas = document.createElement('canvas').getContext('2d');
    meas.font = '100px "' + FONT + '"';
    let w = 1, asc = 0, desc = 0;
    for (const ch of (ref || [text])){
      const m = meas.measureText(ch);
      w = Math.max(w, (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || m.width));
      asc = Math.max(asc, m.actualBoundingBoxAscent || 70); desc = Math.max(desc, m.actualBoundingBoxDescent || 0);
    }
    return Math.max(8, Math.round(rows * w / Math.max(1, asc + desc)));
  }
  function type(text, cols, rgb, ref, weight){
    if (typeof Title === 'undefined' || !Title.face) return null;
    const f = Title.face(text, FONT, ref ? {cols, ref} : {cols});
    if (!f) return null;
    const k = text + '|' + cols + '|' + (ref ? 'r' : '') + rgb.join(',') + '|' + DPR + '|' + weight;
    let cv = glyphs.get(k);
    if (cv) return cv;
    if (glyphs.size > 200) glyphs.clear();
    const p = pitch() * DPR;
    cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(f.cols * p)); cv.height = Math.max(1, Math.ceil(f.rows * p));
    Title.paint(cv, f, {weight: weight || 1, tint: rgb});
    glyphs.set(k, cv);
    return cv;
  }
  /* a glyph centred at x, y (CSS px), its cap height about `px` */
  function stamp(text, x, y, px, rgb, al, font){
    const one = text.length === 1;
    const cv = font ? type(text, colsFor(text, Math.max(4, Math.round(px / pitch())), one ? ALPHA : null), rgb, one ? ALPHA : null, .85) : null;
    const c = ctx;
    c.globalAlpha = al;
    if (cv){ c.drawImage(cv, x * DPR - cv.width / 2, y * DPR - cv.height / 2); return true; }
    c.fillStyle = 'rgb(' + Math.round(rgb[0] * 255) + ',' + Math.round(rgb[1] * 255) + ',' + Math.round(rgb[2] * 255) + ')';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '400 ' + Math.round(px * DPR) + 'px ' + tok('mono');
    c.fillText(text, x * DPR, y * DPR);
    return false;
  }
  /* a word set along the −45° diagonal from x, y, its foot on the line */
  /* the same word retreating: slid back along its diagonal by `back` px
     toward the letter, each character fading as a front sweeps through
     the word from its first letter to its last (`front` 0…1) */
  function diagonalOut(text, x, y, px, rgb, al, back, front){
    const c = ctx, chars = text.split('');
    c.save();
    c.translate(x * DPR, y * DPR);
    c.rotate(-Math.PI / 4);
    c.fillStyle = 'rgb(' + Math.round(rgb[0] * 255) + ',' + Math.round(rgb[1] * 255) + ',' + Math.round(rgb[2] * 255) + ')';
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.font = '400 ' + Math.round(px * DPR) + 'px ' + tok('mono');
    const adv = c.measureText('A ').width;
    let ax = -back * DPR;
    for (let i = 0; i < chars.length; i++){
      const at = i / Math.max(1, chars.length - 1);
      const a = Math.max(0, Math.min(1, (at - front) / .35 + 1)) * al;   // clear behind the front, whole ahead of it
      if (a > 0){ c.globalAlpha = a; c.fillText(chars[i], ax, 0); }
      ax += adv;
    }
    c.restore();
  }
  /* a word set along the −45° diagonal from x, y, in the chrome's mono,
     letters spaced — the type of the panels, not of the plate */
  function diagonal(text, x, y, px, rgb, al){
    const c = ctx;
    c.save();
    c.globalAlpha = al;
    c.translate(x * DPR, y * DPR);
    c.rotate(-Math.PI / 4);
    c.fillStyle = 'rgb(' + Math.round(rgb[0] * 255) + ',' + Math.round(rgb[1] * 255) + ',' + Math.round(rgb[2] * 255) + ')';
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.font = '400 ' + Math.round(px * DPR) + 'px ' + tok('mono');
    c.fillText(text.split('').join(' '), 0, 0);
    c.restore();
  }
  const picked = k => P && F && F.ids[k] === P.id;
  /* the picked diamond's place in the row, taken the moment it is picked
     so the fold can carry it from there; null means it grows in place */
  function setOut(){
    foldFrom = null;
    if (!row || !P || !picked(row.k)) return;
    foldFrom = {x: row.x0 + P.item * row.step, y: row.h.y, r: row.rr};
  }

  function paint(){
    if (!cv || !F) return;
    layout();
    const W = Math.round(WIDTH * DPR), H = Math.round(innerHeight * DPR);
    if (cv.width !== W || cv.height !== H){ cv.width = W; cv.height = H; cv.style.width = WIDTH + 'px'; cv.style.height = innerHeight + 'px'; }
    const p = pitch() * DPR;
    const face = {cols: Math.ceil(W / p), rows: Math.ceil(H / p), cells: []};
    const bone = rgbOf(tok('bone')), flare = rgbOf(tok('flare')), dim = rgbOf(tok('dim'));
    const x = ctx;
    const text = [];                          // type is laid after the lattice, in order
    const stand = val('stand');               // 0 down in the hub … 1 standing
    const fd = val('fold');                   // 0 standing … 1 folded to the pick
    const hubTop = innerHeight - HUB_Y - HUB_R;

    /* the letters: each rises out of the hub in turn, the last first;
       folding, each sinks into the pick diamond */
    const n = hits.length;
    /* ease each letter toward where the layout wants it */
    for (const h of hits){
      cur.y[h.k] = lerp(cur.y[h.k], h.ty, .16); cur.al[h.k] = lerp(cur.al[h.k], h.tal, .16);
      if (Math.abs(cur.y[h.k] - h.ty) > .3 || Math.abs(cur.al[h.k] - h.tal) > .01) dwelling = true;
      else { cur.y[h.k] = h.ty; cur.al[h.k] = h.tal; }
      h.y = cur.y[h.k];
    }
    const geo = hits.map(h => {
      const k = n - 1 - h.k;                  // 0 for the last letter, which moves first
      const st = Math.max(0, Math.min(1, (stand * (n + 2) - k) / 3));   // its own slice of the stand
      const sk = outBack(st);
      let cx = h.x, cy = lerp(hubTop, h.y, sk), r = h.r * Math.max(0, sk), al = Math.min(1, st * 2), dull = cur.al[h.k];
      if (fd > 0){ cx = lerp(cx, fold.x, fd); cy = lerp(cy, fold.y, fd); r = lerp(r, fold.r * .4, fd); al *= 1 - fd; }
      return {cx, cy, r, al, dull, h};
    });
    /* the row: items slide out of their letter in turn, and back in */
    if (row){
      const g = geo[row.k], items = F.items[row.k] || [], ro = val('row');
      /* the layering follows you along the row: the one you are on is in
         front, every one you have crossed stays in front of the one before
         it, and the ones ahead recede — so the row reads as a hand of
         cards fanned from where you stand. With no cursor the first is
         in front, as a closed row */
      const lead = cursor >= 0 ? cursor : hoverItem >= 0 ? hoverItem : (picked(row.k) ? P.item : -1);
      const order = [];
      for (let m = items.length - 1; m > lead; m--) order.push(m);      // ahead: far first, so nearer lands on top
      for (let m = 0; m <= lead; m++) order.push(m);                      // crossed: each over the last; the lead last of all
      for (const m of order){
        const st = Math.max(0, Math.min(1, (ro * (items.length + 2) - m) / 3));
        const sk = outBack(st);
        const isPick = picked(row.k) && P.item === m;
        if (isPick && fd > 0 && foldFrom) continue;          // it is the one travelling, drawn below
        /* and the fade follows the layering: full where you stand, and a
           step dimmer for every diamond away from it on either side */
        const away = lead >= 0 ? Math.abs(m - lead) : m;
        const dull = isPick || m === lead ? 0 : Math.min(.88, .35 + away * .3);   // a long way toward dim, at once
        const tone = rgbOf(TONES[m % TONES.length]);
        const col = [lerp(tone[0], dim[0], dull), lerp(tone[1], dim[1], dull), lerp(tone[2], dim[2], dull)];
        const al = Math.min(1, st * 2) * (1 - fd);
        const cx = lerp(g.cx, row.x0 + m * row.step, sk), rr = row.rr * Math.max(0, sk) * (1 - fd);
        if (rr > 0.5) diamond(face, p, cx * DPR, g.cy * DPR, rr * DPR, al, col);
        /* the letter in ground on a light tone, bone on a dark one */
        const luma = col[0] * .3 + col[1] * .59 + col[2] * .11;
        if (st > .6 && rr > 6) text.push({s: (items[m] || '').trim().charAt(0).toUpperCase(), x: cx, y: g.cy + rr * .04, px: rr * .9, col: tok(luma > .5 ? 'ground' : 'bone'), al: al});
      }
    }
    /* outermost first, so each letter lands over the one further from the
       open letter, and the open letter over all */
    const lead = open >= 0 && !folded ? open : -1;
    const order = geo.slice().sort((a, b) => (lead < 0 ? a.h.k - b.h.k : Math.abs(b.h.k - lead) - Math.abs(a.h.k - lead)));
    for (const g of order){
      const col = [lerp(bone[0], dim[0], g.dull), lerp(bone[1], dim[1], g.dull), lerp(bone[2], dim[2], g.dull)];
      if (g.r > 0.5) diamond(face, p, g.cx * DPR, g.cy * DPR, g.r * DPR, g.al, col);
      if (g.r > 6 && g.al > .2) text.push({s: F.letters[g.h.k], x: g.cx, y: g.cy + g.r * .04, px: g.r * .95, col: tok('ground'), al: Math.min(1, g.al)});
    }
    /* the pick diamond, growing out of the collapsing letters */
    if (P && fd > 0){
      if (foldFrom){
        /* the picked diamond itself, carried from its slot in the row down
           to its place above the hub — flare on the way, bone once landed */
        const e = fd, cx = lerp(foldFrom.x, fold.x, e), cy = lerp(foldFrom.y, fold.y, e), r = lerp(foldFrom.r, fold.r, e);
        /* it keeps the tone it had in the row, and its letter is set the
           way the acronym's are — the pick is one of those now */
        /* lit a little at its top point, shaded a little at its foot, and
           its letter in bone, larger than the acronym's */
        const col = rgbOf(TONES[P.item % TONES.length]);
        const top = col.map((v, i) => lerp(v, bone[i], .22 * e)), foot = col.map((v, i) => lerp(v, dim[i], .28 * e));
        diamond(face, p, cx * DPR, cy * DPR, r * DPR, 1, top, foot);
        text.push({s: (P.text || '?').trim().charAt(0).toUpperCase(), x: cx, y: cy, px: r * 1.15 * lerp(.82, 1, e), col: tok('bone'), al: 1});
      } else {
        const r = fold.r * outBack(fd), col = rgbOf(TONES[P.item % TONES.length]);
        const top = col.map((v, i) => lerp(v, bone[i], .22)), foot = col.map((v, i) => lerp(v, dim[i], .28));
        diamond(face, p, fold.x * DPR, fold.y * DPR, r * DPR, fd, top, foot);
        if (fd > .5) text.push({s: (P.text || '?').trim().charAt(0).toUpperCase(), x: fold.x, y: fold.y, px: r * 1.15, col: tok('bone'), al: (fd - .5) * 2});
      }
    }
    Title.paint(cv, face, {weight: 1});

    for (const t of text) stamp(t.s, t.x, t.y, t.px, rgbOf(t.col), t.al, !!t.font);
    x.globalAlpha = 1;

    /* a bracket over and under the open letter, as on the lead item */
    if (lead >= 0 && !rowOpen && !hubSel && fd < 1){ x.globalAlpha = 1 - fd; bracket(geo[lead].cx, geo[lead].cy, geo[lead].r, 6); x.globalAlpha = 1; }
    /* and on the hub diamond the keys have walked down to: the three at
       rest, or one of the four when the hub has been pressed open */
    if (hubSel && typeof Hud !== 'undefined'){
      const H0 = innerHeight - HUB_Y, four = Hud.opened && Hud.opened();
      const at = four
        ? {letters: [HUB_X, H0 - 30, 24], numbers: [HUB_X - 30, H0, 24], home: [HUB_X + 30, H0, 24], towns: [HUB_X, H0 + 30, 24]}
        : {hub: [HUB_X, H0, HUB_R], journal: [HUB_X + HUB_DX, H0, HUB_R], build: [HUB_X + HUB_DX / 2, H0 + HUB_DX / 2, HUB_R]};
      const c = at[hubSel];
      if (c) bracket(c[0], c[1], c[2], 5);
    }
    /* the word on the diagonal: the open letter's, two seconds after it
       opened, and stepping aside while an item is highlighted */
    if (open >= 0 && geo[open] && fd < 1){
      const g = geo[open], h = hits[open], word = (F.words[open] || '').trim();
      const held = performance.now() - openSince;
      const say0 = hoverItem >= 0 ? hoverItem : cursor >= 0 ? cursor : (picked(open) ? P.item : -1);
      const wshow = say0 >= 0 ? 0 : Math.max(0, Math.min(1, (held - WORD_WAIT) / RISE));
      if (wshow < 1 && say0 < 0) dwelling = true;
      /* from above the row's first diamond, rising to the right, clear of the letter */
      if (word && wshow > 0)
        diagonal(word.toUpperCase(), h.x + h.r * 1.05 - (1 - wshow) * h.r * .3, g.cy - h.r * 0.85 + (1 - wshow) * h.r * .3, 14, bone, (1 - fd) * wshow);
    }
    /* the word just left, on its way back into its letter */
    if (leaving && geo[leaving.k]){
      const t = (performance.now() - leaving.t0) / RETREAT;
      if (t >= 1) leaving = null;
      else {
        dwelling = true;
        const g = geo[leaving.k], h = hits[leaving.k];
        const L = leaving.word.length * 14 * 1.2;                     // about the word's run, in px
        /* the slide leads, easing out; the fade follows a step behind it */
        diagonalOut(leaving.word, h.x + h.r * 1.05, g.cy - h.r * 0.85, 14, bone, (1 - fd), outCubic(t) * L * .7, Math.max(0, t - .12) * 1.15);
      }
    }
    /* the item's name, with the row */
    if (row && fd < 1){
      const g = geo[row.k], h = row.h, items = F.items[row.k] || [];
      const ro = outCubic(val('row')) * (1 - fd);
      const say = open < 0 ? -1 : hoverItem >= 0 ? hoverItem : cursor >= 0 ? cursor : (picked(open) ? P.item : -1);
      x.globalAlpha = ro;
      /* a bracket over and under the highlighted item: two short bone
         chevrons following the diamond's edges, a hair clear of its points */
      if (say >= 0 && items[say] && fd < 1){
        const cx = row.x0 + say * row.step, cy = g.cy, rr = row.rr, gap = 5, len = rr * .42;
        x.strokeStyle = tok('bone'); x.lineWidth = Math.max(1, 1.2 * DPR); x.lineCap = 'square';
        x.beginPath();
        x.moveTo((cx - len) * DPR, (cy - rr - gap + len) * DPR); x.lineTo(cx * DPR, (cy - rr - gap) * DPR); x.lineTo((cx + len) * DPR, (cy - rr - gap + len) * DPR);
        x.moveTo((cx - len) * DPR, (cy + rr + gap - len) * DPR); x.lineTo(cx * DPR, (cy + rr + gap) * DPR); x.lineTo((cx + len) * DPR, (cy + rr + gap - len) * DPR);
        x.stroke();
      }
      x.textAlign = 'left'; x.textBaseline = 'top';
      /* the name waits: it shows only once you have rested on the same
         item for a moment, then fades up */
      const lk = say >= 0 ? row.k + ':' + say : '';
      if (lk !== leadKey){ leadKey = lk; leadSince = performance.now(); }
      const rest = say >= 0 ? performance.now() - leadSince : 0;
      const shown = say >= 0 && items[say] ? Math.max(0, Math.min(1, (rest - DWELL) / RISE)) : 0;
      if (say >= 0 && shown < 1) dwelling = true;
      if (shown > 0){
        /* the item's name rises from its own diamond on the same diagonal
           as the word, so the two read as one hand of type */
        diagonal(items[say].toUpperCase(), row.x0 + say * row.step + row.rr * .6, g.cy - row.rr * 1.2, 10, rgbOf(TONES[say % TONES.length]), ro * shown);
      }
      if (!items.length){
        x.textBaseline = 'middle';
        x.fillStyle = tok('dim');
        x.font = '400 ' + Math.round(9 * DPR) + 'px ' + tok('mono');
        x.fillText('NO ITEMS YET', (h.x + h.r * 1.35) * DPR, g.cy * DPR);
      }
      x.globalAlpha = 1;
    }
  }

  function bracket(cx, cy, r, gap){
    const x = ctx, len = r * .42;
    x.strokeStyle = tok('bone'); x.lineWidth = Math.max(1, 1.2 * DPR); x.lineCap = 'square';
    x.beginPath();
    x.moveTo((cx - len) * DPR, (cy - r - gap + len) * DPR); x.lineTo(cx * DPR, (cy - r - gap) * DPR); x.lineTo((cx + len) * DPR, (cy - r - gap + len) * DPR);
    x.moveTo((cx - len) * DPR, (cy + r + gap - len) * DPR); x.lineTo(cx * DPR, (cy + r + gap) * DPR); x.lineTo((cx + len) * DPR, (cy + r + gap - len) * DPR);
    x.stroke();
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
      folded = false; open = F.ids.indexOf(P.id); rowOpen = true; rowK = open; hoverItem = -1; cursor = -1; painted = '';
      return;
    }
    const l = letterAt(x, y);
    if (l >= 0){
      ev.stopPropagation(); ev.preventDefault();
      open = open === l ? -1 : l; hoverItem = -1; cursor = -1; rowOpen = false; hubSel = null; painted = '';
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
    if (P && !folded){ layout(); setOut(); folded = true; hoverItem = -1; painted = ''; }
  }

  /* ── the keys ──────────────────────────────────────────────────────────
     While a letter is open the column has the keyboard and the walker
     does not (game.js asks `active()` first): ↑ ↓ walk the letters, ← →
     the open letter's items, Enter picks the item under the cursor and
     folds, Esc closes the column and gives the keys back. */
  const active = () => !!(over() && (open >= 0 || hubSel) && !folded);
  const U = ['ArrowUp', 'KeyW'], D = ['ArrowDown', 'KeyS'], L = ['ArrowLeft', 'KeyA'], R = ['ArrowRight', 'KeyD'], E = ['Enter', 'NumpadEnter'];
  /* the hub is part of the same walk: ↓ off the last letter lands on the
     hub's flare diamond, → and ↓ reach the journal's and build's, Enter
     presses what you stand on — the hub opens its four, and the arrows
     then pick among them the way they lie — and ↑ climbs back onto the
     column. Esc folds the four, then steps off. */
  function hubKey(code){
    const n = F.letters.length, four = Hud.opened && Hud.opened();
    const go = k => { hubSel = k; };
    if (four){
      if (U.includes(code)) go('letters'); else if (L.includes(code)) go('numbers');
      else if (R.includes(code)) go('home'); else if (D.includes(code)) go('towns');
      else if (E.includes(code)){ const k = hubSel === 'hub' ? 'home' : hubSel; hubSel = null; open = -1; Hud.press(k); }
      else if (code === 'Escape'){ Hud.fold(); hubSel = 'hub'; }
      return;
    }
    if (hubSel === 'hub'){
      if (R.includes(code)) go('journal'); else if (D.includes(code)) go('build');
      else if (U.includes(code)){ hubSel = null; open = n - 1; }
      else if (E.includes(code)){ Hud.press('hub'); }
      else if (code === 'Escape'){ hubSel = null; open = -1; }
    } else if (hubSel === 'journal'){
      if (L.includes(code)) go('hub'); else if (D.includes(code)) go('build');
      else if (U.includes(code)){ hubSel = null; open = n - 1; }
      else if (E.includes(code)){ hubSel = null; open = -1; Hud.press('journal'); }
      else if (code === 'Escape'){ hubSel = null; open = -1; }
    } else if (hubSel === 'build'){
      if (U.includes(code) || L.includes(code)) go('hub'); else if (R.includes(code)) go('journal');
      else if (E.includes(code)){ Hud.press('build'); }
      else if (code === 'Escape'){ hubSel = null; open = -1; }
    }
  }
  function key(code){
    if (!active()) return false;
    if (hubSel && typeof Hud !== 'undefined'){ hubKey(code); hoverItem = -1; cursor = -1; rowOpen = false; painted = ''; return true; }
    const n = F.letters.length, items = F.items[open] || [];
    if (code === 'ArrowUp' || code === 'KeyW'){ open = Math.max(0, open - 1); cursor = -1; rowOpen = false; }
    else if (code === 'ArrowDown' || code === 'KeyS'){
      if (open === n - 1 && typeof Hud !== 'undefined' && Hud.press){ hubSel = 'hub'; open = -1; }
      else open = Math.min(n - 1, open + 1);
      cursor = -1; rowOpen = false;
    }
    else if (code === 'ArrowRight' || code === 'KeyD'){ rowOpen = true; rowK = open; if (items.length) cursor = Math.min(items.length - 1, cursor + 1); }
    else if (code === 'ArrowLeft' || code === 'KeyA'){ cursor = Math.max(-1, cursor - 1); if (cursor < 0) rowOpen = false; }
    else if (code === 'Enter' || code === 'NumpadEnter'){
      if (cursor >= 0 && items[cursor] && typeof Journal !== 'undefined' && Journal.setPick){
        Journal.setPick(F.ids[open], cursor);
        read(); layout(); setOut(); folded = true; cursor = -1;
      }
    }
    else if (code === 'Escape'){ open = -1; cursor = -1; rowOpen = false; }
    else return true;                        // ours, but nothing to do — still not the walker's
    hoverItem = -1; painted = '';
    return true;
  }

  function read(){
    const had = !!F;
    F = typeof Journal !== 'undefined' && Journal.focused ? Journal.focused() : null;
    if (F && !had){ T.stand = null; tween('stand', 1, 520, outCubic); }
    P = F && Journal.pick ? Journal.pick() : null;
    if (F && open >= F.letters.length) open = -1;
    if (!P){ folded = false; foldFrom = null; }
    painted = '';
  }
  let lastOpen = -1, wasMoving = false;
  let leadKey = '', leadSince = 0, dwelling = false;            // the item under the lead, and when it came to rest there
  const DWELL = 2000, RISE = 220;             // ms resting before the name shows, and its fade-in
  const WORD_WAIT = 2000;                     // ms a letter is open before its word shows
  let foldFrom = null;                        // where the picked diamond set out from, in the row
  let openSince = 0;
  let leaving = null;                         // {k, word, t0}: the word retreating into the letter just left
  const RETREAT = 620;                        // ms it takes to slide back in
  function tick(){
    raf = requestAnimationFrame(tick);
    if (!el) return;
    const v = visible();
    el.hidden = !v;
    if (!v) return;
    DPR = Math.min(2, devicePixelRatio || 1);
    /* the state says where things are going; the tweens say where they are */
    tween('stand', 1, 520, outCubic);
    tween('fold', folded ? 1 : 0, foldFrom ? 520 : (folded ? 380 : 320), foldFrom ? inOutCubic : (folded ? inCubic : outCubic));
    if (open !== lastOpen){
      /* the word of the letter being left slides back into it */
      if (lastOpen >= 0 && F && F.words[lastOpen] && (F.words[lastOpen] || '').trim() && performance.now() - openSince > WORD_WAIT)
        leaving = {k: lastOpen, word: F.words[lastOpen].trim().toUpperCase(), t0: performance.now()};
      if (open >= 0) openSince = performance.now();
      if (open < 0) rowOpen = false;
      lastOpen = open >= 0 ? open : lastOpen;
      if (open < 0) tween('row', 0, 220, inCubic);
    }
    /* the row shows only when asked for with →, and starts from nothing */
    if (rowOpen && (!T.row || T.row.to !== 1)){ T.row = null; tween('row', 1, 460, outCubic); }
    if (!rowOpen && T.row && T.row.to === 1) tween('row', 0, 220, inCubic);
    /* while a tween runs every frame is drawn — and one more after it
       lands, or the last drawn frame is the one just before the end and
       a fold stops a hair short of folded */
    const mv = moving() || dwelling;
    dwelling = false;
    if (mv || wasMoving) painted = '';
    wasMoving = mv;
    const key = [innerHeight, DPR, open, rowOpen, hoverItem, cursor, folded, hubSel, !!leaving, typeof Hud !== 'undefined' && Hud.opened && Hud.opened(), P ? P.id + ':' + P.item : '', F.letters.join(''), F.words.join('|'),
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
    if (typeof Title !== 'undefined' && Title.load) Title.load(FONT, () => { glyphs.clear(); painted = ''; });
    read();
    /* a pick that was there when the page opened is carried folded: the
       one thing you were holding, still held */
    if (P){ folded = true; T.fold = {from: 1, to: 1, t0: 0, dur: 1, ease: inCubic}; }   // already folded: nothing to sink
    if (typeof Store !== 'undefined') Store.watch('hq.journal', read);
    addEventListener('resize', () => { painted = ''; });
    if (!raf) raf = requestAnimationFrame(tick);
  }

  return {init, refresh: read, key, active, open: k => { open = k; folded = false; painted = ''; }, opened: () => open,
          fold: v => { folded = !!v && !!P; painted = ''; }, folded: () => folded};
})();
