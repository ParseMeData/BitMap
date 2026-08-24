'use strict';
/* ── the diamond type ───────────────────────────────────────────────────
   Words made of the same thing everything else is made of.

   There is already a way to draw text here — the marker sheet, a font baked
   into a texture and cut a cell at a time — and it is the right way to draw
   a symbol nobody has to read from across the room. It is the wrong way to
   put a name on a plan. A textured glyph is a picture of a letter laid over
   the lattice; at any distance it reads as a different material, because it
   is one.

   So a letter is a five-by-seven grid and every lit square is one diamond,
   emitted into the same instance stream as the roads and the furniture and
   the walker. A name is then made of the town rather than printed on it, it
   breathes at the same rate, and it costs no texture and no draw call.

   The pitch is what you set — one diamond per pixel of the letterform — and
   everything else follows from it. */

const Type = (() => {
  /* 5 wide, 7 tall. Written out rather than packed into hex: this is the
     art, and art you cannot read in the source is art nobody will fix. */
  const F = {
    '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
    '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
    '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
    '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
    'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
    'C': ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
    'D': ['11100', '10010', '10001', '10001', '10001', '10010', '11100'],
    'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    'F': ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
    'G': ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
    'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
    'I': ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
    'J': ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
    'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
    'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
    'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
    'N': ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
    'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    'P': ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
    'Q': ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
    'R': ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
    'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    'U': ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
    'V': ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
    'W': ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
    'X': ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
    'Y': ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
    'Z': ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
    '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
    '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
    ',': ['00000', '00000', '00000', '00000', '01100', '01100', '01000'],
    "'": ['00100', '00100', '00000', '00000', '00000', '00000', '00000'],
    '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
    '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
    ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
    '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
    '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
    '·': ['00000', '00000', '00000', '01100', '01100', '00000', '00000']
  };
  const W = 5, H = 7, GAP = 1;                 // in letterform pixels
  const ADV = W + GAP;

  /* A diamond a shade wider than its own square, so a stroke reads as a
     stroke rather than as a row of separate dots — the same reason ground
     cover is laid down at just over a cell wide. */
  const FAT = 0.62;

  /* ── treatments ────────────────────────────────────────────────────────
     A heading can be dressed differently from the working text around it,
     and the whole of the difference is in HOW EACH LIT SQUARE IS DRAWN.
     The forty-five glyphs above do not change and there is no second
     typeface: at five by seven there is no room for a serif or a condensed
     cut, so a second set of letterforms would not read as another voice,
     it would read as a worse version of this one.

     What there is room for is material. `render.js` already shades three
     things from the same quad, chosen per instance by `put`'s last
     arguments — a solid diamond (mode 1), a diamond OUTLINE (mode 1 with
     the glyph flag set, which the vertex shader carries as a negative
     size) and a soft HALO (mode 2). Every treatment below is those three,
     plus how fat the diamond is and how far apart the letters stand. So a
     treatment is a row in a table rather than a code path, and adding one
     is adding a row.

       hollow   draw the outline diamond rather than the solid one
       fat      the diamond's half-size, as a multiple of the usual 0.62
       track    extra advance between letters, in letterform pixels
       halo     a soft mode-2 diamond behind each square, at this multiple
                of the core's size — 0 for none
       echo     a second diamond offset by (dx, dy) letterform pixels at
                this fraction of the alpha, which is a letterpress double
                impression: the same stamp, struck twice, a hair out

     The halo is always a supplement and never the only ink, because the
     tune panel's Glow multiplies every halo in the game and can take it to
     zero — a treatment that was nothing but halo would vanish when it did.

     `sparse` thins the ink by shrinking the diamond rather than by dropping
     squares. Dropping every other square is the obvious way to make a
     letter sparse and it is wrong here: at five by seven no square is
     redundant, and losing one turns E into F. */
  /* Three of these were measured against each other and two of them were the
     same picture, which makes a cycle where half the presses look like a dead
     control. What each one now does differently, and why:

     `haloed` does NOT use the shader's halo mode. That mode multiplies by
     u_glow, and Glow is a slider whose minimum is zero — at which a haloed
     title rendered pixel-identical to a solid one. A treatment that vanishes
     when an unrelated slider is turned down is not a treatment. It is a big
     faint diamond behind each square instead, which nothing else can turn off.

     `struck` was a hollow echo at the same size as its own core, so the near
     half of the ring sat under the core and the far half under the next
     square's; what escaped was a lip. A letterpress double impression is a
     second SOLID strike, and the offset has to clear the core's own reach or
     there is nothing to see.

     `heavy` replaces a `wide` that only changed the advance. Tracking is not
     how a square is drawn — and pitchFor compensated for the wider advance by
     shrinking the type, so a long name in `wide` came out looking like a
     smaller `solid`. STYLE.md already owns tracking as the heading device. */
  const TREATS = {
    solid:   {hollow: false, fat: 1.00, track: 0,   halo: 0, echo: null},
    outline: {hollow: true,  fat: 1.18, track: 0,   halo: 0, echo: null},
    haloed:  {hollow: false, fat: 1.00, track: 0,   halo: 0,
              echo: {dx: 0, dy: 0, alpha: 0.30, hollow: false, scale: 2.30}},
    struck:  {hollow: false, fat: 1.00, track: 0,   halo: 0,
              echo: {dx: 0.62, dy: 0.62, alpha: 0.50, hollow: false}},
    sparse:  {hollow: false, fat: 0.52, track: 0.5, halo: 0, echo: null},
    heavy:   {hollow: false, fat: 1.42, track: 0.3, halo: 0, echo: null}
  };
  const ORDER = ['solid', 'outline', 'haloed', 'struck', 'sparse', 'heavy'];

  /* ── borders ───────────────────────────────────────────────────────────
     Drawn out of the same diamonds at the same pitch as the letters, for
     the reason the letters are drawn out of diamonds at all: a rule under a
     heading that was a CSS line, or a quad, would read as a different
     material at every distance.

     `pad` is the clearance between the letterform's ink and the border, in
     letterform pixels. A `run` is one side of the box; `off` pushes that
     side further out AND lets it overrun the corners by the same amount,
     so the second line of a double rule sits under the first and splays a
     little wider than it, the way a printed rule pair does. A `corner` is four brackets, `arm` pixels along each
     of the two sides it turns. Every distance here is in letterform pixels
     and is multiplied by the pitch when it is drawn, so a border scales
     with its heading and never has to be tuned twice. */
  const BORDERS = {
    none:     {pad: 0,    parts: []},
    rule:     {pad: 1.30, parts: [{run: 'bottom'}]},
    brackets: {pad: 1.30, parts: [{corner: true, arm: 2.4}]},
    box:      {pad: 1.30, parts: [{run: 'top'}, {run: 'bottom'},
                                  {run: 'left'}, {run: 'right'}]},
    double:   {pad: 1.30, parts: [{run: 'bottom'}, {run: 'bottom', off: 1.1}]}
  };
  const BORDER_ORDER = ['none', 'rule', 'brackets', 'box', 'double'];
  /* one border diamond per letterform pixel, which is exactly the density
     the strokes are drawn at — so a rule is made of the same stuff as the
     letter above it and not of a finer or coarser stuff */
  const STEP = 1;

  /* ── the shake ─────────────────────────────────────────────────────────
     A heading can be knocked off its seat the way `kinds.js` knocks a
     terrain cell off its own, and for the same reason it is done there: the
     offset is a pure function of where the diamond sits, never of the
     clock. A title that shimmered would be a second thing moving against
     the lattice, which STYLE.md spends a paragraph forbidding — and it
     would also mean a name looked different every time you glanced at it,
     when the whole point of a name on a plan is that it is the same name.

     The key is the square's own place in the string's letterform grid, so
     each lit square keeps its offset as the heading is dragged, resized or
     redrawn, and the seed is folded from the name, so two palaces are not
     shaken into the same shape. `Kinds.hash` is asked for by name at call
     time rather than captured, the way `build.js` asks for History: a
     heading that does not shake is still a heading, but one that threw
     would take the frame with it. */
  const roll = (u, v, s) => (typeof Kinds !== 'undefined' && Kinds.hash
    ? Kinds.hash(u, v, s) : 0.5);                 // no hash, no offset
  function seedOf(str){
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
    return h;
  }

  const clamp01 = v => (v < 0 ? 0 : (v > 1 ? 1 : v));

  const pick = t => TREATS[t] || TREATS.solid;
  const adv = tr => ADV + tr.track;
  /* how many instances one lit square costs under this treatment */
  const per = tr => 1 + (tr.halo ? 1 : 0) + (tr.echo ? 1 : 0);

  const width = (str, px, treat) => {
    const tr = pick(treat);
    return (str.length ? str.length * adv(tr) - GAP - tr.track : 0) * px;
  };
  const height = px => H * px;

  /* `x` is the left edge and `y` the vertical middle, because a caption is
     positioned against the thing it names, not against a baseline.

     `jit` and `seed` arrive only from `heading`, so working text — a room
     label, a locus number — keeps standing exactly where it is put: the
     shake is a heading's dress, the way a treatment and a border are, and
     the reason those are confined to headings is the reason this is. */
  function text(a, m, str, x, y, px, col, alpha, cap, treat, jit, seed){
    const tr = pick(treat);
    const s = String(str).toUpperCase();
    const top = y - (H - 1) * px / 2;
    const al = alpha === undefined ? 1 : alpha;
    const hs = px * FAT * tr.fat;
    const step = adv(tr) * px;
    const need = per(tr);
    /* the spread is a multiple of the pitch rather than of anything on
       screen, so a name shakes by the same fraction of its own letterform
       at every zoom and at every size a title is ever drawn at */
    const amp = (jit || 0) * px, sd = seed || 0;
    for (let i = 0; i < s.length; i++){
      const g = F[s[i]];
      if (!g){ continue; }                     // a space, or something we cannot draw
      const gx = x + i * step;
      /* where this letter starts in the string's own grid of letterform
         pixels, rounded because a tracked advance is fractional and the
         hash reads whole numbers */
      const gu = Math.round(i * adv(tr));
      for (let r = 0; r < H; r++){
        const row = g[r];
        for (let c = 0; c < W; c++){
          if (row[c] !== '1') continue;
          if (cap !== undefined && m > cap - need - 1) return m;
          const dx = gx + c * px, dy = top + r * px;
          let jx = 0, jy = 0;
          if (amp){
            jx = (roll(gu + c, r, sd + 771) - 0.5) * amp;
            jy = (roll(gu + c, r, sd + 772) - 0.5) * amp;
          }
          /* Behind first, so the core lands on top of its own halo and its
             own echo rather than under them — and all three carry the one
             offset, because a halo that wandered away from the square it
             belongs to would read as a second, blurrier letter rather than
             as one square struck out of true. */
          if (tr.halo)
            m = put(a, m, dx, dy, col[0], col[1], col[2],
                    al * 0.55, hs * tr.halo, 0, jx, jy, 2);
          if (tr.echo)
            m = put(a, m, dx + tr.echo.dx * px, dy + tr.echo.dy * px,
                    col[0], col[1], col[2], al * tr.echo.alpha,
                    hs * (tr.echo.scale || 1),
                    tr.echo.hollow ? 1 : 0, jx, jy, 1);
          m = put(a, m, dx, dy, col[0], col[1], col[2], al, hs,
                  tr.hollow ? 1 : 0, jx, jy, 1);
        }
      }
    }
    return m;
  }

  /* how many instances a string will cost, so a caller can decide whether it
     can afford one before it starts drawing half of it */
  function cost(str, treat){
    const s = String(str).toUpperCase();
    let n = 0;
    for (let i = 0; i < s.length; i++){
      const g = F[s[i]];
      if (!g) continue;
      for (let r = 0; r < H; r++)
        for (let c = 0; c < W; c++) if (g[r][c] === '1') n++;
    }
    return n * per(pick(treat));
  }

  /* centred on a point, which is what a number in the middle of a room and a
     name over a town both want */
  function centred(a, m, str, cx, cy, px, col, alpha, cap, treat){
    return text(a, m, str, cx - width(str, px) / 2, cy, px, col, alpha, cap, treat);
  }

  /* the pitch that makes a string exactly `w` wide */
  function pitchFor(str, w, treat){
    const tr = pick(treat);
    const n = str.length ? str.length * adv(tr) - GAP - tr.track : 1;
    return w / n;
  }

  /* ── the border, as segments ───────────────────────────────────────────
     Worked out once, in letterform pixels, with the origin at the top-left
     of the letterform's ink — so the same list is what gets drawn and what
     gets counted against the instance cap, and the two can never disagree
     about how big a border is.

     `from` is the index the run starts at: a bracket's second arm starts one
     step in, because the corner diamond is already there and a diamond drawn
     twice at the same alpha is a brighter diamond, which reads as an accent
     nobody asked for. */
  function edges(bd, iw, ih){
    const b = BORDERS[bd] || BORDERS.none;
    const out = [];
    if (!b.parts.length) return out;
    const L = -b.pad, R = iw + b.pad, T = -b.pad, B = ih + b.pad;
    for (const p of b.parts){
      const o = p.off || 0;
      if (p.run === 'top')         out.push([L - o, T - o, R + o, T - o, 0]);
      else if (p.run === 'bottom') out.push([L - o, B + o, R + o, B + o, 0]);
      else if (p.run === 'left')   out.push([L - o, T - o, L - o, B + o, 0]);
      else if (p.run === 'right')  out.push([R + o, T - o, R + o, B + o, 0]);
      else if (p.corner){
        const arm = p.arm;
        for (const [x, sx] of [[L, 1], [R, -1]])
          for (const [y, sy] of [[T, 1], [B, -1]]){
            out.push([x, y, x + sx * arm, y, 0]);
            out.push([x, y, x, y + sy * arm, 1]);
          }
      }
    }
    return out;
  }
  const segN = seg => Math.max(1, Math.round(
    Math.hypot(seg[2] - seg[0], seg[3] - seg[1]) / STEP));

  /* the ink's own extents, in letterform pixels: centre of the first lit
     square to centre of the last, which is what a border is drawn around.
     The advance width `width()` returns carries a trailing gap, and a box
     laid out on that sits a gap wider on one side than the other. */
  const inkW = (str, tr) => (str.length ? (str.length - 1) * adv(tr) + (W - 1) : 0);

  /* ── how bright ────────────────────────────────────────────────────────
     The same curve the plate is lifted by, because a heading turned up and
     a road turned up ought to feel like the same control: `Buf.cell` in
     kinds.js multiplies the colour by b under a clamp and the coverage by
     the gentler `ba`, so brightness reads WHITER first and only then more
     opaque. This is not a colour: it scales the bone it is handed, and at
     1.0 it hands back exactly what it was given.

     The scalar is clamped, never the channels. Clamping each channel on its
     own pins them at three different values of b — bone's red stops at
     1.075, its green at 1.087, its blue at 1.124 — and between those the
     warmth is squeezed out unevenly, which is a change of hue rather than a
     lift, and above the last of them the heading is flatly #FFFFFF. The
     plate can afford that clamp because a kind that gets lifted hard is a
     saturated swatch where clipping reads as terrain, and the hardest-lifted
     of them, road, is already white. Bone is the one ink where clipping
     changes which of the ten colours you are looking at. So the scale stops
     where the first channel would, and everything past it rides the coverage
     curve below, which is what `ba` is already for. */
  const lift = (col, b) => {
    if (b === 1) return col;
    const mx = Math.max(col[0], col[1], col[2]);
    const s = mx > 0 ? Math.min(b, 1 / mx) : b;
    return s === 1 ? col : [col[0] * s, col[1] * s, col[2] * s];
  };
  const liftA = (al, b) => clamp01(al * (b < 1 ? b : 1 + (b - 1) * 0.4));

  /* ── a heading ─────────────────────────────────────────────────────────
     Centred text in a treatment, with its border around it. The one entry
     point for a title, so that a title is the only thing that can wear
     either: room labels and locus numbers go through `text` and stay plain,
     which is the whole reason working text still reads as working text.

     Brightness and shake join the treatment and the border here for that
     same reason, and both are applied to the border as well as to the
     letters: the rule under a name is drawn out of the same diamonds at the
     same pitch, so a rule that stayed put while its heading moved would
     say the two were different materials. */
  function heading(a, m, str, cx, cy, px, col, alpha, cap, treat, bd, bright, jit){
    const tr = pick(treat);
    const s = String(str).toUpperCase();
    const x = cx - width(s, px, treat) / 2;
    const y0 = cy - (H - 1) * px / 2;
    const b = bright === undefined ? 1 : bright;
    const ink = lift(col, b);
    const al = liftA(alpha === undefined ? 1 : alpha, b);
    const hs = px * FAT * tr.fat;
    const amp = (jit || 0) * px, sd = seedOf(s);
    for (const seg of edges(bd, inkW(s, tr), H - 1)){
      const n = segN(seg);
      for (let i = seg[4]; i <= n; i++){
        if (cap !== undefined && m > cap - 2) return m;
        /* the border's diamonds are keyed on where they sit in the same
           letterform grid the letters are keyed on — which is outside the
           ink, so a rule and a letter never draw the same number twice */
        const bu = seg[0] + (seg[2] - seg[0]) * i / n;
        const bv = seg[1] + (seg[3] - seg[1]) * i / n;
        let jx = 0, jy = 0;
        if (amp){
          jx = (roll(Math.round(bu), Math.round(bv), sd + 771) - 0.5) * amp;
          jy = (roll(Math.round(bu), Math.round(bv), sd + 772) - 0.5) * amp;
        }
        m = put(a, m, x + bu * px, y0 + bv * px,
                ink[0], ink[1], ink[2], al, hs, 0, jx, jy, 1);
      }
    }
    return text(a, m, s, x, cy, px, ink, al, cap, treat, jit, sd);
  }

  /* what that heading costs, whole: the letters under their treatment plus
     every diamond of the border. A caller with a cap can then draw the
     whole thing or fall back, rather than running out halfway down one side
     of a box. */
  function headCost(str, treat, bd){
    const s = String(str).toUpperCase();
    let n = cost(s, treat);
    for (const seg of edges(bd, inkW(s, pick(treat)), H - 1))
      n += segN(seg) + 1 - seg[4];
    return n;
  }

  return {text, centred, width, height, cost, pitchFor, heading, headCost,
          treatments: ORDER.slice(), borders: BORDER_ORDER.slice(),
          hasTreatment: t => !!TREATS[t], hasBorder: b => !!BORDERS[b],
          has: ch => !!F[String(ch).toUpperCase()]};
})();
