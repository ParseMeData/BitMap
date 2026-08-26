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
  const MINC = 40, MAXC = 160, PERCH = 14;
  /* the tool's CFG, minus what only a wallpaper needs (fill, cols) */
  const RECIPE = {bri: -36, con: 76, sharp: 1, gamma: 0.75, lo: 0.04, hi: 0.96};
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
  function build(name, family){
    const c = document.createElement('canvas');
    const x = c.getContext('2d', {willReadFrequently: true});
    if (!x) return null;
    x.font = '100px "' + family + '"';
    const mt = x.measureText(name);
    const left = mt.actualBoundingBoxLeft || 0, right = mt.actualBoundingBoxRight || mt.width;
    const asc = mt.actualBoundingBoxAscent || 70, desc = mt.actualBoundingBoxDescent || 20;
    const w100 = Math.max(1, left + right), h100 = Math.max(1, asc + desc);
    const cols = clamp(Math.round(name.length * PERCH), MINC, MAXC);
    const fs = 100 * (cols * SS) / w100;
    const rows = Math.max(1, Math.ceil(h100 * fs / 100 / SS));
    const W = (cols + 2) * SS, H = (rows + 2) * SS;
    c.width = W; c.height = H;
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    x.font = fs + 'px "' + family + '"';
    x.fillStyle = '#111'; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    x.fillText(name, SS + left * fs / 100, SS + asc * fs / 100);
    const d = x.getImageData(0, 0, W, H).data;
    const gray = new Float32Array(W * H);
    for (let i = 0, p = 0; i < gray.length; i++, p += 4)
      gray[i] = .299 * d[p] + .587 * d[p + 1] + .114 * d[p + 2];
    briCon(gray, RECIPE.bri, RECIPE.con);
    if (RECIPE.sharp > 0) sharpen(gray, W, H, RECIPE.sharp * .5);

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
    const lo = vals[Math.floor(vals.length * RECIPE.lo)];
    const rng = Math.max(.05, vals[Math.floor(vals.length * RECIPE.hi)] - lo);
    const cells = [];
    for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++){
      const v0 = raw[cy * CW + cx];
      if (v0 <= 0.02) continue;
      const v = Math.pow(clamp((v0 - lo) / rng, 0, 1), RECIPE.gamma);
      /* the tool's `photo` mode with its edge term at zero, which is what
         its CFG had it at: a cell is lit past a Bayer threshold, and the
         darker the ink the larger and the brighter the diamond */
      const th = (BAYER[cy & 3][cx & 3] + .5) / 16;
      if (v <= th * .55 + .04) continue;
      cells.push({x: cx - 1, y: cy - 1, al: .5 + v * .42, sz: .4 + v * 1.1});
    }
    return {cols, rows, cells};
  }
  /* the face for a name in a family, or null while the family is loading
     or once it has failed — the caller draws the 5×7 type for null, so a
     title is never missing, only plainer than it will be */
  function face(name, family){
    family = slug(family); name = String(name || '');
    if (!family || !name) return null;
    const e = fonts.get(family);
    if (!e){ load(family); return null; }
    if (e.state !== 'ready') return null;
    const k = family + '\n' + name;
    let f = faces.get(k);
    if (f === undefined){
      try { f = build(name, family); } catch (err){ f = null; }
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
  function emit(a, m, f, x0, y0, px, col, alpha, cap, jit, seed){
    const al = alpha === undefined ? 1 : alpha;
    const amp = (jit || 0) * px, sd = seed || 0;
    const hs = px * FAT;
    for (const c of f.cells){
      if (cap !== undefined && m > cap - 1) return m;
      let jx = 0, jy = 0;
      if (amp){
        jx = (roll(c.x, c.y, sd + 771) - 0.5) * amp;
        jy = (roll(c.x, c.y, sd + 772) - 0.5) * amp;
      }
      m = put(a, m, x0 + c.x * px, y0 + c.y * px, col[0], col[1], col[2],
              al * c.al, hs * c.sz, 0, jx, jy, 1);
    }
    return m;
  }
  const cost = f => f.cells.length;

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
    'Playfair Display',
    'Cormorant Garamond',
    'UnifrakturMaguntia',
    'Special Elite',
    'Rye',
    'Monoton'
  ];

  return {load, state, face, emit, cost, fonts: FONTS.slice(), DEFAULT: FONTS[0]};
})();
