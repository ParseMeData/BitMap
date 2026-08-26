'use strict';
/* ── a name in a font ───────────────────────────────────────────────────
   The 5×7 type in `type.js` is the working face: it is what a room's
   number and a locus's label are set in, and at that size it is the only
   face there is room for. A title is different. A town's name across its
   map, a palace's name over its plan — those are the one place a word
   gets to be a piece of lettering rather than a label, and lettering has
   a face.

   This is the lattice-type recipe from the wallpaper tool, lifted whole: a
   Google Font is drawn onto a canvas at three times the cell resolution,
   lifted in brightness and contrast, sharpened, and then read back a cell
   at a time as INK — and every cell with ink in it is one diamond, sized
   and lit by how much ink it holds. The result goes into the same instance
   stream as the roads and the walker, through the same `put`, so a name
   in a script face is still made of the town rather than printed on it.
   The letterform came from a font; nothing that reaches the plate did.

   What is NOT here is a screen. The tool offers dots, Bayer and Floyd
   before the lattice step, and the recipe Eden settled on has that switch
   at `none` — the diamonds are the halftone, and a halftone of a halftone
   is moiré, which is where the tool got its name and not what a title
   wants. The recipe's numbers are the tool's `CFG` as it was handed over,
   and they are kept in one table so a retune is a retune of the table. */

const Title = (() => {
  const SS = 3;                                // raster pixels per cell
  /* how many cells across a name is drawn at: enough that a script face
     keeps its hairlines, and never so many that a long name alone could
     take the instance cap the rooms and the walker also draw from */
  const MINC = 40, MAXC = 200;
  /* the tool's CFG, minus what only a wallpaper needs (fill, cols) */
  const RECIPE = {bri: -36, con: 76, sharp: 1, gamma: 0.75, lo: 0.04, hi: 0.96};

  /* ── the tune ──────────────────────────────────────────────────────────
     Four numbers the palette can move, each with its range and the
     tool's own value as the default — what the recipe drew before there
     was a slider is what a slider at rest draws:

       detail  cells per letter — and, because the pitch is the plate's
               cell and never moves, the SIZE of the name: a bigger name
               is read at more cells, each the same diamond. The palette
               calls it Size. (A pitch multiplier was tried and taken
               out: it made the diamonds smaller with the name, and a
               diamond is not the thing that is meant to change.)
       weight  a multiplier on every diamond's size. This is the one that
               closes the plate's own grid: a diamond a shade wider than
               its cell (FAT) leaves a hole at each cell's corners, and
               inside a thick stroke those holes line up into a lattice
               — at working zoom it reads as grid lines drawn through the
               letter. Past about 1.15 the corners are covered.
       tone    how far a diamond's size and light follow the ink under it.
               1 is the tool — an edge cell small and dim, a stroke's body
               big and bright; 0 is every diamond the same, which reads
               flatter and cleaner at a distance.
       dither  how much of the Bayer threshold is applied. 1 is the tool;
               0 is a plain cut at the middle, no pattern at all.

     `detail` and `dither` change which cells exist, so they are part of
     the face's cache key; `weight` and `tone` are applied as the face is
     drawn, so a slider on them costs nothing per frame beyond what the
     title already cost. */
  const TUNE = {
    detail: {lo: 4,   hi: 30,  dflt: 14},
    /* weight 1 and tone 0: at Size 1 every diamond of a title IS a plate
       diamond — same pitch, same three-quarter-cell half-size the vertex
       shader draws the lattice at — so a name is made of exactly the
       stuff the road beside it is. The corner-hole lattice that 1.2 was
       covering does not arise at three quarters of a cell. */
    weight: {lo: 0.5, hi: 2.0, dflt: 1},
    tone:   {lo: 0,   hi: 1,   dflt: 0},
    dither: {lo: 0,   hi: 1,   dflt: 1},
    /* the mat: how far the plate under the name is dimmed, 0 for none,
       and where its oval starts to fade — 0 at the rim, 24 at the centre */
    mat:    {lo: 0,   hi: 1,   dflt: 0.7},
    feather: {lo: 0,  hi: 24,  dflt: 10},
    /* the shade: how much darker the foot of a word is than its top —
       a sheen down the lettering, on the plate and on the cards alike */
    shade:  {lo: 0,   hi: 0.7, dflt: 0.25}
  };
  /* 1 along the top row of a face, 1 − shade along its bottom */
  const sheen = (f, y, t) => 1 - tuned(t, 'shade') * (y + 1) / (f.rows + 1);
  /* the plate's own diamond: `hs = size * u_unit * 0.75` in render.js for
     a lattice cell of size 1 — so this is the half-size a title diamond
     takes at Size 1, weight 1, and `FAT` stays the cards' and the 5×7's */
  const PLATE = 0.75;
  const tuned = (t, k) => {
    const v = t && isFinite(t[k]) ? +t[k] : TUNE[k].dflt;
    return clamp(v, TUNE[k].lo, TUNE[k].hi);
  };
  /* the same fat the 5×7 type uses, and for the same reason: a diamond a
     shade wider than its square so a stroke reads as a stroke */
  const FAT = 0.62;
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

  const clamp = (v, lo, hi) => (v < lo ? lo : (v > hi ? hi : v));

  /* ── the fonts ─────────────────────────────────────────────────────────
     One stylesheet link per family, kept for the life of the page, so a
     family already asked for is never asked for twice and switching back
     to it is instant. A family is `ready` once `document.fonts.load`
     hands back at least one face for it — the link's `load` alone is not
     enough, because Google answers an unknown family with a stylesheet
     that declares nothing, and a face that loaded nothing is a face that
     draws in the fallback, which would put a monospace title on the plate
     and call it Fleur De Leah. */
  const fonts = new Map();                     // family → {state, cbs}
  const slug = f => String(f || '').trim().replace(/\s+/g, ' ');
  function load(family, cb){
    family = slug(family);
    if (!family){ if (cb) cb(false); return; }
    let e = fonts.get(family);
    if (e){
      if (e.state === 'loading'){ if (cb) e.cbs.push(cb); }
      else if (cb) cb(e.state === 'ready');
      return;
    }
    e = {state: 'loading', cbs: cb ? [cb] : []};
    fonts.set(family, e);
    const settle = ok => {
      if (e.state !== 'loading') return;
      e.state = ok ? 'ready' : 'failed';
      if (ok) faces.forEach((f, k) => { if (f === null && k.startsWith(family + '\n')) faces.delete(k); });
      for (const f of e.cbs) f(ok);
      e.cbs = [];
    };
    if (!document.fonts || !document.fonts.load){ settle(false); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' +
      encodeURIComponent(family).replace(/%20/g, '+') + '&display=swap';
    link.onload = () => document.fonts.load('100px "' + family + '"')
      .then(fs => settle(fs.length > 0), () => settle(false));
    link.onerror = () => settle(false);
    document.head.appendChild(link);
    /* the tool gives a font two and a half seconds and then draws; here
       the 5×7 type is already drawing, so this only decides when to stop
       hoping — and a font that turns up later still settles as ready */
    setTimeout(() => settle(false), 8000);
  }
  const state = family => { const e = fonts.get(slug(family)); return e ? e.state : 'none'; };

  /* ── the raster ────────────────────────────────────────────────────────
     Straight from the tool: gray plane, brightness/contrast, a box blur
     under an unsharp mask. Ink is `255 − gray`, so the text is drawn dark
     on white and read back as how dark each cell is. */
  function briCon(gray, bri, con){
    const f = (259 * (con + 255)) / (255 * (259 - con));
    for (let i = 0; i < gray.length; i++){
      let v = gray[i] + bri * 1.2;
      v = f * (v - 128) + 128;
      gray[i] = v < 0 ? 0 : (v > 255 ? 255 : v);
    }
  }
  function boxBlur(gray, w, h){
    const out = new Float32Array(gray.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
      let s = 0, c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++){
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        s += gray[ny * w + nx]; c++;
      }
      out[y * w + x] = s / c;
    }
    gray.set(out);
  }
  function sharpen(gray, w, h, amt){
    const bl = new Float32Array(gray); boxBlur(bl, w, h);
    for (let i = 0; i < gray.length; i++){
      const v = gray[i] + (gray[i] - bl[i]) * amt;
      gray[i] = v < 0 ? 0 : (v > 255 ? 255 : v);
    }
  }

  /* ── a face ────────────────────────────────────────────────────────────
     `{cols, rows, cells: [{x, y, al, sz}]}` — the name as cells, with the
     origin at the top-left of its ink and one cell of margin all round so
     a diamond lit by a stroke's edge has room to stand. Built once per
     name and family and kept; the position and the pitch are the caller's,
     so the same face is drawn at every zoom without being read again. */
  const faces = new Map();                     // family + '\n' + name → face | null
  function build(name, family, t){
    const PERCH = tuned(t, 'detail'), DITH = tuned(t, 'dither');
    /* the recipe itself may be overridden per call — a tuning strip's
       business, while the numbers are still being found */
    const R = Object.assign({}, RECIPE, t && t.recipe ? t.recipe : {});
    const c = document.createElement('canvas');
    const x = c.getContext('2d', {willReadFrequently: true});
    if (!x) return null;
    x.font = '100px "' + family + '"';
    const mt = x.measureText(name);
    const left = mt.actualBoundingBoxLeft || 0, right = mt.actualBoundingBoxRight || mt.width;
    /* THE BOX. A title is fitted to its own ink. A glyph on a card is
       not: `t.ref` names the whole set it belongs to — every letter, or
       every digit — and the box is measured over all of them at once,
       widest and tallest, with one baseline. So an A and an E are read
       at the same size and stand on the same line, which is what makes
       a row of cards read as a row rather than as five different
       stamps. */
    let asc = mt.actualBoundingBoxAscent || 70, desc = mt.actualBoundingBoxDescent || 20;
    let w100 = Math.max(1, left + right);
    if (t && t.ref){
      w100 = 1; asc = 0; desc = 0;
      for (const ch of String(t.ref)){
        const m = x.measureText(ch);
        w100 = Math.max(w100, (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || m.width));
        asc = Math.max(asc, m.actualBoundingBoxAscent || 0);
        desc = Math.max(desc, m.actualBoundingBoxDescent || 0);
      }
    }
    const h100 = Math.max(1, asc + desc);
    /* a caller may name the width outright — a card's label is one
       glyph and would otherwise be read at the floor for a whole name */
    let cols = t && t.cols ? clamp(Math.round(t.cols), 8, MAXC)
             : clamp(Math.round(name.length * PERCH), MINC, MAXC);
    const fs = 100 * (cols * SS) / w100;
    /* in a shared box the scale is the set's, but the width is the
       label's own if it is wider — "10" is two of the digits the box was
       measured on, and a box one digit wide cut its second one off */
    if (t && t.ref){
      const need = Math.ceil((left + right) * fs / 100 / SS) + 1;
      if (need > cols) cols = Math.min(MAXC, need);
    }
    const rows = Math.max(1, Math.ceil(h100 * fs / 100 / SS));
    const W = (cols + 2) * SS, H = (rows + 2) * SS;
    c.width = W; c.height = H;
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    x.font = fs + 'px "' + family + '"';
    x.fillStyle = '#111'; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    /* in a shared box the glyph is centred across it; alone it fills it */
    const slack = t && t.ref ? (cols * SS - (left + right) * fs / 100) / 2 : 0;
    x.fillText(name, SS + slack + left * fs / 100, SS + asc * fs / 100);
    const d = x.getImageData(0, 0, W, H).data;
    const gray = new Float32Array(W * H);
    for (let i = 0, p = 0; i < gray.length; i++, p += 4)
      gray[i] = .299 * d[p] + .587 * d[p + 1] + .114 * d[p + 2];
    briCon(gray, R.bri, R.con);
    if (R.sharp > 0) sharpen(gray, W, H, R.sharp * .5);

    /* read back a cell at a time — the tool draws its screened canvas into
       a canvas the size of the lattice and lets the browser average, which
       is a box filter, which is this */
    const CW = cols + 2, CH = rows + 2, n = CW * CH;
    const raw = new Float32Array(n);
    const vals = [];
    for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++){
      let s = 0;
      for (let y = cy * SS; y < cy * SS + SS; y++)
        for (let xx = cx * SS; xx < cx * SS + SS; xx++) s += 255 - gray[y * W + xx];
      const v = s / (SS * SS * 255);
      raw[cy * CW + cx] = v;
      if (v > 0.02) vals.push(v);
    }
    if (!vals.length) return {cols, rows, cells: []};
    /* the tool normalises to the 4th and 96th percentile of what is there
       and then bends it by the gamma of the `t = 1` look it locks to */
    vals.sort((p, q) => p - q);
    const lo = vals[Math.floor(vals.length * R.lo)];
    const rng = Math.max(.05, vals[Math.floor(vals.length * R.hi)] - lo);
    const cells = [];
    for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++){
      const v0 = raw[cy * CW + cx];
      if (v0 <= 0.02) continue;
      const v = Math.pow(clamp((v0 - lo) / rng, 0, 1), R.gamma);
      /* the tool's `photo` mode with its edge term at zero, which is what
         its CFG had it at: a cell is lit past a Bayer threshold, and the
         darker the ink the larger and the brighter the diamond */
      const th = (BAYER[cy & 3][cx & 3] + .5) / 16;
      /* the threshold slides between the tool's Bayer ramp and a flat cut
         at its middle, so dither 0 keeps the same average ink as 1 */
      if (v <= (0.5 + (th - 0.5) * DITH) * .55 + .04) continue;
      cells.push({x: cx - 1, y: cy - 1, al: .5 + v * .42, sz: .4 + v * 1.1});
    }
    return {cols, rows, cells};
  }
  /* the face for a name in a family, or null while the family is loading
     or once it has failed — the caller draws the 5×7 type for null, so a
     title is never missing, only plainer than it will be */
  function face(name, family, t){
    family = slug(family); name = String(name || '');
    if (!family || !name) return null;
    const e = fonts.get(family);
    if (!e){ load(family); return null; }
    if (e.state !== 'ready') return null;
    const k = family + '\n' + name + '\n' + tuned(t, 'detail') + '\n' + tuned(t, 'dither') +
              '\n' + (t && t.cols ? Math.round(t.cols) : '') + '\n' + (t && t.ref ? t.ref : '') +
              '\n' + (t && t.recipe ? JSON.stringify(t.recipe) : '');
    let f = faces.get(k);
    if (f === undefined){
      try { f = build(name, family, t); } catch (err){ f = null; }
      if (faces.size > 64) faces.clear();
      faces.set(k, f);
    }
    return f;
  }

  /* ── drawing it ────────────────────────────────────────────────────────
     `x0`, `y0` is the top-left of the ink in world units, `px` the pitch
     of a cell. The shake is keyed by the cell's place in the face, seeded
     by the caller, exactly as the 5×7 type keys its own — so a font title
     shakes the way a diamond-type title shakes, and stays shaken the same
     way from one frame to the next. */
  const roll = (u, v, s) => (typeof Kinds !== 'undefined' && Kinds.hash
    ? Kinds.hash(u, v, s) : 0.5);
  function emit(a, m, f, x0, y0, px, col, alpha, cap, jit, seed, t){
    const al = alpha === undefined ? 1 : alpha;
    const amp = (jit || 0) * px, sd = seed || 0;
    const hs = px * PLATE * tuned(t, 'weight'), tone = tuned(t, 'tone');
    /* tone 0 is the flat diamond — one plate diamond per cell of ink, at
       full light — and tone 1 is each cell as the ink read it */
    const FLAT_AL = 1, FLAT_SZ = 1;
    for (const c of f.cells){
      if (cap !== undefined && m > cap - 1) return m;
      let jx = 0, jy = 0;
      if (amp){
        jx = (roll(c.x, c.y, sd + 771) - 0.5) * amp;
        jy = (roll(c.x, c.y, sd + 772) - 0.5) * amp;
      }
      const ca = FLAT_AL + (c.al - FLAT_AL) * tone, cs = FLAT_SZ + (c.sz - FLAT_SZ) * tone;
      m = put(a, m, x0 + c.x * px, y0 + c.y * px, col[0], col[1], col[2],
              al * ca * sheen(f, c.y, t), hs * cs, 0, jx, jy, 1);
    }
    return m;
  }
  const cost = f => f.cells.length;

  /* ── the mat ───────────────────────────────────────────────────────────
     The plate under a name, dimmed so the name reads over it: an OVAL of
     ground-coloured diamonds around the word, full at its centre and
     falling off toward the rim. Diamonds on a square grid at a spacing
     equal to their own half-size cover the plane exactly twice,
     everywhere — so the field is even, and one alpha `a` per diamond
     makes a cover of 1 − (1 − a)². Spaced at three cells so a title's
     mat is a few hundred instances rather than a few thousand: the cap
     is shared with the rooms and the walker, and a mat is the first
     thing to give. Drawn in the chrome's ground rather than black,
     because the plate is that colour and a mat that was blacker than
     the plate would read as a hole.

     `feather` is where the fade begins, 0..24: at 0 the oval is full to
     its rim and stops there hard, at 24 it starts falling away from the
     word's very centre. The rim itself is the word's box with a little
     clear, stretched so the ends of a long name are still under it. */
  const GROUND = [0.031, 0.031, 0.043];        // #08080B
  const FEATHER_MAX = 24;
  function oval(cols, rows){
    const cx = (cols - 1) / 2, cy = (rows - 1) / 2;
    return {cx, cy, rx: cols / 2 * 1.12 + 4, ry: rows / 2 * 1.45 + 4};
  }
  function mat(a, m, cols, rows, x0, y0, px, cover, cap, feather){
    if (!(cover > 0)) return m;
    const S = 3, o = oval(cols, rows);
    const per = 1 - Math.sqrt(1 - Math.min(cover, 0.98));
    const f0 = 1 - clamp((feather === undefined ? 10 : feather) / FEATHER_MAX, 0, 1);
    const gx0 = Math.floor(o.cx - o.rx), gx1 = Math.ceil(o.cx + o.rx);
    const gy0 = Math.floor(o.cy - o.ry), gy1 = Math.ceil(o.cy + o.ry);
    for (let gy = gy0; gy <= gy1; gy += S)
      for (let gx = gx0; gx <= gx1; gx += S){
        const r = Math.hypot((gx - o.cx) / o.rx, (gy - o.cy) / o.ry);
        if (r >= 1) continue;
        if (cap !== undefined && m > cap - 1) return m;
        /* 1 inside the start of the fade, easing to 0 at the rim */
        let e = 1;
        if (r > f0){
          const t = (1 - r) / Math.max(1e-6, 1 - f0);
          e = t * t * (3 - 2 * t);
        }
        m = put(a, m, x0 + gx * px, y0 + gy * px, GROUND[0], GROUND[1], GROUND[2],
                per * e, S * px, 0, 0, 0, 1);
      }
    return m;
  }
  /* the grid's box over the oval, which over-counts the corners: a cap
     check that errs on the safe side */
  const matCost = (cols, rows) => {
    const S = 3, o = oval(cols, rows);
    return (Math.floor(2 * o.rx / S) + 2) * (Math.floor(2 * o.ry / S) + 2);
  };

  /* ── the same face, off the plate ──────────────────────────────────────
     The bag is a page rather than the plate, so its cards cannot reach
     the instance stream — but a face is only cells, and cells can be
     drawn as anything. Here they are an inline SVG of rhombi, one per
     cell, filled with `currentColor` so the card's own colour states —
     dim, bone once done, inverted when held, the hover wash — carry
     through untouched, and sized by the viewBox so the card's CSS decides
     how big it is. Weight and Tone are honoured the way `emit` honours
     them; the shake is not, because a card is not the lattice and a
     label knocked off its seat on a still page would read as broken. */
  function svg(f, t){
    const NS = 'http://www.w3.org/2000/svg';
    const el = document.createElementNS(NS, 'svg');
    /* The viewBox is the face's full HEIGHT and this glyph's own WIDTH:
       a face read in a shared box (`ref`) has one scale and one baseline
       for the whole set, and keeping the full height keeps that scale —
       while cropping to the ink's own width stops the widest swash
       capital in the set from deciding how small every other letter is
       drawn. The card fits it by height, so an I and an M are the same
       size on the same line and each fills what it can. */
    let x0 = 0, x1 = f.cols - 1;
    if (f.cells.length){
      x0 = Infinity; x1 = -Infinity;
      for (const c of f.cells){ if (c.x < x0) x0 = c.x; if (c.x > x1) x1 = c.x; }
    }
    const cols = x1 - x0 + 3, rows = f.rows + 2;
    el.setAttribute('viewBox', (x0 - 0.5) + ' 0 ' + cols + ' ' + rows);
    el.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const hs = FAT * tuned(t, 'weight'), tone = tuned(t, 'tone');
    const FLAT_AL = .92, FLAT_SZ = 1.5;
    /* one path per alpha step rather than one element per cell: a label
       is a few hundred cells and the DOM does not want a few hundred
       nodes per card times fifteen cards */
    const byAl = new Map();
    for (const c of f.cells){
      const ca = FLAT_AL + (c.al - FLAT_AL) * tone, cs = FLAT_SZ + (c.sz - FLAT_SZ) * tone;
      const r = hs * cs, x = c.x + 1.5, y = c.y + 1.5;
      const a = Math.round(ca * sheen(f, c.y, t) * 20) / 20;
      const d = 'M' + (x - r).toFixed(2) + ' ' + y.toFixed(2) +
                'L' + x.toFixed(2) + ' ' + (y - r).toFixed(2) +
                'L' + (x + r).toFixed(2) + ' ' + y.toFixed(2) +
                'L' + x.toFixed(2) + ' ' + (y + r).toFixed(2) + 'Z';
      byAl.set(a, (byAl.get(a) || '') + d);
    }
    for (const [a, d] of byAl){
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'currentColor');
      path.setAttribute('fill-opacity', String(a));
      el.appendChild(path);
    }
    return el;
  }

  /* ── the shelf ─────────────────────────────────────────────────────────
     The faces on offer, by Google's name for each, in the order the menu
     shows them. A list rather than a free field because a field needs
     the family spelt exactly as Google spells it, and a name one letter
     off draws the diamond type with no way to tell why. Adding a face is
     adding a line here; the first is the default a fresh profile gets. */
  const FONTS = [
    'Fleur De Leah',           // the wallpaper's own, and the default
    'Pinyon Script',
    'Great Vibes',
    'Cinzel',
    'Roboto Slab',
    'Playfair Display',
    'Cormorant Garamond',
    'UnifrakturMaguntia',
    'Special Elite',
    'Rye',
    'Monoton'
  ];

  return {load, state, face, emit, cost, svg, mat, matCost, fonts: FONTS.slice(), DEFAULT: FONTS[0],
          tune: TUNE, tuned, recipe: Object.assign({}, RECIPE)};
})();
