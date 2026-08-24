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

  const width = (str, px) => (str.length ? str.length * ADV - GAP : 0) * px;
  const height = px => H * px;

  /* `x` is the left edge and `y` the vertical middle, because a caption is
     positioned against the thing it names, not against a baseline. */
  function text(a, m, str, x, y, px, col, alpha, cap){
    const s = String(str).toUpperCase();
    const top = y - (H - 1) * px / 2;
    const al = alpha === undefined ? 1 : alpha;
    const hs = px * FAT;
    for (let i = 0; i < s.length; i++){
      const g = F[s[i]];
      if (!g){ continue; }                     // a space, or something we cannot draw
      const gx = x + i * ADV * px;
      for (let r = 0; r < H; r++){
        const row = g[r];
        for (let c = 0; c < W; c++){
          if (row[c] !== '1') continue;
          if (cap !== undefined && m > cap - 2) return m;
          m = put(a, m, gx + c * px, top + r * px,
                  col[0], col[1], col[2], al, hs, 0, 0, 0, 1);
        }
      }
    }
    return m;
  }

  /* how many instances a string will cost, so a caller can decide whether it
     can afford one before it starts drawing half of it */
  function cost(str){
    const s = String(str).toUpperCase();
    let n = 0;
    for (let i = 0; i < s.length; i++){
      const g = F[s[i]];
      if (!g) continue;
      for (let r = 0; r < H; r++)
        for (let c = 0; c < W; c++) if (g[r][c] === '1') n++;
    }
    return n;
  }

  /* centred on a point, which is what a number in the middle of a room and a
     name over a town both want */
  function centred(a, m, str, cx, cy, px, col, alpha, cap){
    return text(a, m, str, cx - width(str, px) / 2, cy, px, col, alpha, cap);
  }

  /* the pitch that makes a string exactly `w` wide */
  function pitchFor(str, w){
    const n = str.length ? str.length * ADV - GAP : 1;
    return w / n;
  }

  return {text, centred, width, height, cost, pitchFor,
          has: ch => !!F[String(ch).toUpperCase()]};
})();
