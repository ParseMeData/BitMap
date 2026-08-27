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
  let open = -1, hoverItem = -1, cursor = -1, folded = false, painted = '', F = null, P = null, DPR = 1;
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
  function layout(){
    const H = innerHeight, n = F.letters.length;
    const foot = H - HUB_Y - HUB_R - GAP;     // the last letter's lower point: the hub's own gap above the pair
    const room = foot - TOP;
    const size = Math.max(40, Math.min(SIZE, (room - GAP * (n - 1)) / n));
    hits = [];
    for (let k = 0; k < n; k++){
      const y = foot - size / 2 - (n - 1 - k) * (size + GAP);
      hits.push({x: AXIS, y, r: size / 2, k});
    }
    row = null;
    /* a row is drawn for the open letter — or, while it is still sliding
       back in, for the letter that was open */
    const k = open >= 0 ? open : (val('row') > 0 ? lastOpen : -1);
    if (k >= 0 && hits[k]){
      const h = hits[k], rr = h.r * ROW, step = rr * 1.15, x0 = h.x + h.r * 1.35 + rr;
      row = {k, h, rr, step, x0, n: (F.items[k] || []).length};
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
    const geo = hits.map(h => {
      const k = n - 1 - h.k;                  // 0 for the last letter, which moves first
      const st = Math.max(0, Math.min(1, (stand * (n + 2) - k) / 3));   // its own slice of the stand
      const sk = outBack(st);
      let cx = h.x, cy = lerp(hubTop, h.y, sk), r = h.r * Math.max(0, sk), al = (open === h.k ? 1 : .82) * Math.min(1, st * 2);
      if (fd > 0){ cx = lerp(cx, fold.x, fd); cy = lerp(cy, fold.y, fd); r = lerp(r, fold.r * .4, fd); al *= 1 - fd; }
      return {cx, cy, r, al, h};
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
    for (const g of geo){
      if (g.r > 0.5) diamond(face, p, g.cx * DPR, g.cy * DPR, g.r * DPR, g.al, bone);
      if (g.r > 6 && g.al > .2) text.push({s: F.letters[g.h.k], x: g.cx, y: g.cy + g.r * .04, px: g.r * .95, col: tok('ground'), al: Math.min(1, g.al)});
    }
    /* the pick diamond, growing out of the collapsing letters */
    if (P && fd > 0){
      if (foldFrom){
        /* the picked diamond itself, carried from its slot in the row down
           to its place above the hub — flare on the way, bone once landed */
        const e = fd, cx = lerp(foldFrom.x, fold.x, e), cy = lerp(foldFrom.y, fold.y, e), r = lerp(foldFrom.r, fold.r, e);
        const tone = rgbOf(TONES[P.item % TONES.length]);
        const col = [lerp(tone[0], bone[0], e), lerp(tone[1], bone[1], e), lerp(tone[2], bone[2], e)];
        diamond(face, p, cx * DPR, cy * DPR, r * DPR, 1, col);
        const luma = col[0] * .3 + col[1] * .59 + col[2] * .11;
        text.push({s: (P.text || '?').trim().charAt(0).toUpperCase(), x: cx, y: cy + r * .04, px: r * 1.1 * lerp(.82, 1, e), col: tok(luma > .5 ? 'ground' : 'bone'), al: 1});
      } else {
        const r = fold.r * outBack(fd);
        diamond(face, p, fold.x * DPR, fold.y * DPR, r * DPR, fd, bone);
        if (fd > .5) text.push({s: (P.text || '?').trim().charAt(0).toUpperCase(), x: fold.x, y: fold.y + r * .04, px: r * 1.1, col: tok('ground'), al: (fd - .5) * 2});
      }
    }
    Title.paint(cv, face, {weight: 1});

    x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const t of text){
      x.globalAlpha = t.al; x.fillStyle = t.col;
      x.font = '400 ' + Math.round(t.px * DPR) + 'px ' + tok('mono');
      x.fillText(t.s, t.x * DPR, t.y * DPR);
    }
    x.globalAlpha = 1;

    /* the word on the diagonal, and the item's name: with the row, and
       gone with the fold */
    if (row && fd < 1){
      const g = geo[row.k], h = row.h, word = (F.words[row.k] || '').trim(), items = F.items[row.k] || [];
      const ro = outCubic(val('row')) * (1 - fd);
      /* the word waits a second after the letter opens, then fades up */
      const held = open >= 0 ? performance.now() - openSince : WORD_WAIT + RISE;
      const say0 = open < 0 ? -1 : hoverItem >= 0 ? hoverItem : cursor >= 0 ? cursor : (picked(open) ? P.item : -1);
      const wshow = say0 >= 0 ? 0 : Math.max(0, Math.min(1, (held - WORD_WAIT) / RISE));   // the word steps aside for an item
      if (open >= 0 && wshow < 1) dwelling = true;
      if (word && ro > 0 && wshow > 0){
        x.save();
        x.globalAlpha = ro * wshow;
        /* from above the row's first diamond, rising to the right, clear of the letter */
        x.translate((h.x + h.r * 1.05 - (1 - wshow) * h.r * .3) * DPR, (g.cy - h.r * 0.85 + (1 - wshow) * h.r * .3) * DPR);
        x.rotate(-Math.PI / 4);
        x.textAlign = 'left'; x.textBaseline = 'alphabetic';
        x.fillStyle = tok('bone');
        x.font = '400 ' + Math.round(14 * DPR) + 'px ' + tok('mono');
        x.fillText(word.toUpperCase().split('').join(' '), 0, 0);
        x.restore();
      }
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
        x.save();
        x.globalAlpha = ro * shown;
        x.translate((row.x0 + say * row.step + row.rr * .6) * DPR, (g.cy - row.rr * 1.2) * DPR);
        x.rotate(-Math.PI / 4);
        x.textAlign = 'left'; x.textBaseline = 'alphabetic';
        x.fillStyle = TONES[say % TONES.length];
        x.font = '400 ' + Math.round(10 * DPR) + 'px ' + tok('mono');
        x.fillText(items[say].toUpperCase().split('').join(' '), 0, 0);
        x.restore();
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
      folded = false; open = F.ids.indexOf(P.id); hoverItem = -1; cursor = -1; painted = '';
      return;
    }
    const l = letterAt(x, y);
    if (l >= 0){
      ev.stopPropagation(); ev.preventDefault();
      open = open === l ? -1 : l; hoverItem = -1; cursor = -1; painted = '';
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
  const active = () => !!(over() && open >= 0 && !folded);
  function key(code){
    if (!active()) return false;
    const n = F.letters.length, items = F.items[open] || [];
    if (code === 'ArrowUp' || code === 'KeyW'){ open = Math.max(0, open - 1); cursor = -1; }
    else if (code === 'ArrowDown' || code === 'KeyS'){ open = Math.min(n - 1, open + 1); cursor = -1; }
    else if (code === 'ArrowRight' || code === 'KeyD'){ if (items.length) cursor = Math.min(items.length - 1, cursor + 1); }
    else if (code === 'ArrowLeft' || code === 'KeyA'){ cursor = Math.max(-1, cursor - 1); }
    else if (code === 'Enter' || code === 'NumpadEnter'){
      if (cursor >= 0 && items[cursor] && typeof Journal !== 'undefined' && Journal.setPick){
        Journal.setPick(F.ids[open], cursor);
        read(); layout(); setOut(); folded = true; cursor = -1;
      }
    }
    else if (code === 'Escape'){ open = -1; cursor = -1; }
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
      /* a new letter: its row starts from nothing */
      if (open >= 0){ T.row = null; tween('row', 1, 460, outCubic); openSince = performance.now(); }
      else tween('row', 0, 220, inCubic);
      lastOpen = open;
    }
    /* while a tween runs every frame is drawn — and one more after it
       lands, or the last drawn frame is the one just before the end and
       a fold stops a hair short of folded */
    const mv = moving() || dwelling;
    dwelling = false;
    if (mv || wasMoving) painted = '';
    wasMoving = mv;
    const key = [innerHeight, DPR, open, hoverItem, cursor, folded, P ? P.id + ':' + P.item : '', F.letters.join(''), F.words.join('|'),
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
    if (P){ folded = true; T.fold = {from: 1, to: 1, t0: 0, dur: 1, ease: inCubic}; }   // already folded: nothing to sink
    if (typeof Store !== 'undefined') Store.watch('hq.journal', read);
    addEventListener('resize', () => { painted = ''; });
    if (!raf) raf = requestAnimationFrame(tick);
  }

  return {init, refresh: read, key, active, open: k => { open = k; folded = false; painted = ''; }, opened: () => open,
          fold: v => { folded = !!v && !!P; painted = ''; }, folded: () => folded};
})();
