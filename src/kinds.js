'use strict';
/* ── terrain components ─────────────────────────────────────────────────
   The plate's look, taken apart into pieces you can stamp. Each kind is a
   generator that fills a shape with lattice cells, in the same 17-float
   instance layout and with the same two-face breathing that compose()
   gives the map — so a stamped park and the map underneath it are the
   same material, not a sprite sitting on top.

   Two densities are in play, and they are deliberate. Ground cover (grass,
   water) is laid down dense and low resolution: near every cell filled, a
   diamond wide enough to touch its neighbours, so it reads as a field the
   way the printed map does. Everything built — crowns, blocks, houses,
   roads — is drawn as structure on top of that, with its own internal
   pattern rather than a wash of noise.

   A kind declares its layer, the shapes it accepts, how it reads to the
   walker (walk: 0 blocked · 1 open · 2 route) and the order it stamps in.
   Nothing here reads the map image; this is all drawn from scratch. */

const Kinds = (() => {
  const clamp01 = v => v < 0 ? 0 : (v > 1 ? 1 : v);
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
  const mod = (a, b) => ((a % b) + b) % b;

  /* ── noise, keyed on shape-local cell coordinates ──────────────────────
     A cell's look is addressed by where it sits *inside its shape*, never
     by where it sits in the world. So terrain travels with the shape when
     you drag it, instead of re-rolling under your hand. */
  function hash(x, y, s){
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  const sm = t => t * t * (3 - 2 * t);
  function vnoise(x, y, s){
    const ix = Math.floor(x), iy = Math.floor(y), fx = sm(x - ix), fy = sm(y - iy);
    const a = hash(ix, iy, s), b = hash(ix + 1, iy, s);
    const c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  /* ── shape geometry ── rect · ellipse · line · ring, one interface ── */
  function segDist(x, y, a, b){
    const vx = b[0] - a[0], vy = b[1] - a[1], wx = x - a[0], wy = y - a[1];
    const L = vx * vx + vy * vy;
    const t = L > 0 ? clamp((wx * vx + wy * vy) / L, 0, 1) : 0;
    return Math.hypot(wx - vx * t, wy - vy * t);
  }
  /* A road is a polyline, but any of its segments can be bowed. The bend is
     kept as one control point per segment — null while the segment is
     straight — and the whole thing is flattened to a fine polyline once,
     then cached, because depth() is asked about it once per lattice cell.
     Everything downstream (distance, bounds, the walk grid, the outline)
     only ever sees the flattened line, so a curve costs nothing extra. */
  const FLAT = 14;                   // sub-segments per bowed segment
  function flatten(s){
    if (s._flat) return s._flat;
    const out = [s.pts[0]];
    for (let i = 0; i < s.pts.length - 1; i++){
      const a = s.pts[i], b = s.pts[i + 1], c = s.ctrl && s.ctrl[i];
      if (!c){ out.push(b); continue; }
      for (let k = 1; k <= FLAT; k++){
        const t = k / FLAT, u = 1 - t;
        out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
                  u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
      }
    }
    s._flat = out;
    return out;
  }

  /* a kind that is only its own perimeter, on an area shape. A line or a
     ring is a band already, so hollowness has nothing to add there. */
  const hollow = s => {
    const k = REG[scope].by[s.kind];
    return !!(k && k.hollow) && s.type !== 'line' && s.type !== 'ring';
  };

  const geo = {
    flat: flatten,
    bbox(s){
      if (s.type === 'line'){
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const p of flatten(s)){
          x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]);
          x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]);
        }
        const r = s.width / 2;
        return [x0 - r, y0 - r, x1 + r, y1 + r];
      }
      if (s.type === 'ring'){
        const R = s.r + s.width / 2;
        return [s.x - R, s.y - R, s.x + R, s.y + R];
      }
      const hw = s.w / 2, hh = s.h / 2;
      let b;
      if (s.rot){
        const c = Math.abs(Math.cos(s.rot)), sn = Math.abs(Math.sin(s.rot));
        b = [s.x - (hw * c + hh * sn), s.y - (hw * sn + hh * c),
             s.x + (hw * c + hh * sn), s.y + (hw * sn + hh * c)];
      } else b = [s.x - hw, s.y - hh, s.x + hw, s.y + hh];
      /* a hollow kind straddles its own edge, so half of its band is outside
         the rect it is described by */
      if (hollow(s)){
        const e = (s.width || 0) / 2;
        return [b[0] - e, b[1] - e, b[2] + e, b[3] + e];
      }
      return b;
    },
    /* a point in the shape's own frame, with any rotation taken back out */
    local(s, x, y){
      const dx = x - s.x, dy = y - s.y;
      if (!s.rot) return [dx, dy];
      const c = Math.cos(-s.rot), sn = Math.sin(-s.rot);
      return [dx * c - dy * sn, dx * sn + dy * c];
    },
    /* how deep inside the shape a point sits, in world units. <= 0 is out.
       Kinds use it for borders: kerbs, shorelines, the fence of a park.

       A hollow kind — a wall, a run of glazing — is only its own perimeter,
       so an area drawn with one is a band and the middle of it is *outside*
       the shape. That belongs here rather than in the generator, because
       everything else asks this one question: what the shape covers when it
       takes ground from what is under it, which tiles it blocks the walker
       on, and where the pointer can pick it up. A room is a room to all
       three, and the floor inside it is left alone by all three. */
    depth(s, x, y){
      if (s.type === 'line'){
        const f = flatten(s);
        let best = Infinity;
        for (let i = 0; i < f.length - 1; i++)
          best = Math.min(best, segDist(x, y, f[i], f[i + 1]));
        return s.width / 2 - best;
      }
      if (s.type === 'ring')
        return s.width / 2 - Math.abs(Math.hypot(x - s.x, y - s.y) - s.r);
      const l = geo.local(s, x, y);
      let d;
      if (s.type === 'ellipse'){
        const u = l[0] / (s.w / 2 || 1), v = l[1] / (s.h / 2 || 1);
        d = (1 - Math.hypot(u, v)) * Math.min(s.w, s.h) / 2;
      } else d = Math.min(s.w / 2 - Math.abs(l[0]), s.h / 2 - Math.abs(l[1]));
      if (!hollow(s)) return d;
      const t = s.width || 0;
      if (t >= Math.min(s.w, s.h)) return d;       // the band has closed up: a solid mass
      /* ── the wall straddles the line ──────────────────────────────────
         A wall used to run inward from the rect that describes it, which is
         fine for one room and wrong for two: rooms are packed edge to edge,
         so where they meet each contributed its own full thickness and the
         party wall came out twice as thick as the outside of the building.
         Centred on the line instead, two rooms that meet contribute the SAME
         band and it stays one wall thick — which is also how a wall is drawn
         on a plan, because it is how a wall is built. */
      return t / 2 - Math.abs(d);
    },
    inside(s, x, y){ return geo.depth(s, x, y) > 0; },
    origin(s){ return s.type === 'line' ? s.pts[0] : [s.x, s.y]; },
    centre(s){
      if (s.type !== 'line') return [s.x, s.y];
      const p = s.pts, a = p[0], b = p[p.length - 1];
      return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    },
    /* the one number a shape can be resized by, whatever its type */
    span(s){
      if (s.type === 'line'){
        const f = flatten(s);
        let L = 0;
        for (let i = 0; i < f.length - 1; i++)
          L += Math.hypot(f[i + 1][0] - f[i][0], f[i + 1][1] - f[i][1]);
        return L;
      }
      if (s.type === 'ring') return s.r * 2;
      return Math.max(s.w, s.h);
    }
  };

  /* ── a growable buffer in the renderer's instance layout ── */
  class Buf {
    constructor(bright, sizeMul){
      this.a = new Float32Array(8192 * 17); this.m = 0;
      this.b = bright === undefined ? 1 : bright;
      this.s = sizeMul === undefined ? 1 : sizeMul;
    }
    /* one lattice cell: two faces it breathes between, plus its own clock */
    cell(x, y, col, a0, s0, g0, a1, s1, g1, churn, seed){
      if ((this.m + 1) * 17 > this.a.length){
        const b = new Float32Array(this.a.length * 2); b.set(this.a); this.a = b;
      }
      const i = this.m * 17, a = this.a, b = this.b;
      /* brightness lifts the ink and, more gently, the coverage — a road
         asked to be brighter should read whiter, not just more opaque */
      const ba = b < 1 ? b : 1 + (b - 1) * 0.4;
      a[i]      = x;                   a[i + 1]  = y;
      a[i + 2]  = clamp01(col[0] * b); a[i + 3]  = clamp01(col[1] * b);
      a[i + 4]  = clamp01(col[2] * b); a[i + 5]  = 1;
      const z0 = s0 * this.s, z1 = s1 * this.s;
      a[i + 6]  = clamp01(a0 * ba);    a[i + 7]  = g0 ? -z0 : z0;   a[i + 8]  = 0; a[i + 9]  = 0;
      a[i + 10] = clamp01(a1 * ba);    a[i + 11] = g1 ? -z1 : z1;   a[i + 12] = 0; a[i + 13] = 0;
      a[i + 14] = seed;            a[i + 15] = churn;           a[i + 16] = 0;
      this.m++;
      return this;
    }
    view(){ return this.a.subarray(0, this.m * 17); }
  }

  /* ── the ink ── */
  const C = {
    road:    [1.00, 0.99, 0.97], kerb:    [0.52, 0.52, 0.56],
    paving:  [0.30, 0.30, 0.34],
    grass:   [0.29, 0.50, 0.26], grassHi: [0.50, 0.70, 0.36], grassDim: [0.20, 0.36, 0.21],
    tree:    [0.19, 0.43, 0.21], treeHi:  [0.55, 0.80, 0.42], trunk: [0.32, 0.22, 0.16],
    conifer: [0.08, 0.26, 0.20], coniferHi: [0.26, 0.54, 0.34],
    water:   [0.18, 0.40, 0.72], waterHi: [0.56, 0.84, 0.93], deep: [0.10, 0.22, 0.46],
    wall:    [0.70, 0.68, 0.63], wallDim: [0.28, 0.28, 0.33], win: [0.95, 0.82, 0.46],
    trim:    [0.95, 0.76, 0.31],
    house:   [0.80, 0.70, 0.60], roof:    [0.74, 0.36, 0.32], roofHi: [0.90, 0.52, 0.44],
    door:    [0.30, 0.22, 0.20],
    /* indoors. A floor plan is drawn in a lighter register than the town —
       plaster and paper rather than ink on a dark field — so the walls read
       as the structure and everything else sits inside them. */
    plaster: [0.90, 0.88, 0.83], plasterDim: [0.38, 0.37, 0.36],
    brick:   [0.62, 0.36, 0.29],
    board:   [0.60, 0.45, 0.31], boardHi: [0.80, 0.63, 0.44], boardDim: [0.38, 0.28, 0.19],
    tileF:   [0.72, 0.71, 0.68], tileDim: [0.48, 0.48, 0.47], grout: [0.30, 0.30, 0.33],
    rug:     [0.58, 0.22, 0.27], rugHi:   [0.88, 0.56, 0.40], rugDim: [0.28, 0.14, 0.22],
    timber:  [0.50, 0.36, 0.24], timberHi:[0.76, 0.58, 0.36],
    fabric:  [0.32, 0.39, 0.53], fabricHi:[0.55, 0.64, 0.80],
    linen:   [0.90, 0.89, 0.85], metal:   [0.68, 0.70, 0.74],
    glass:   [0.52, 0.78, 0.88], glassHi: [0.86, 0.96, 1.00],
    pot:     [0.66, 0.38, 0.26]
  };
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t,
                             a[2] + (b[2] - a[2]) * t];
  const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

  /* ── the scan every kind is written against ────────────────────────────
     Walks the lattice cells the shape covers and hands each one its world
     position, its pattern coordinates (u, v), how deep inside the shape it
     is in cells, and a fade for the feathered border.

     Pattern coordinates are shape-local by default, so terrain travels with
     its shape when you drag it. Set `mask` and they become world coordinates
     instead: the pattern stands still and the shape becomes a window you
     drag across it, hunting for the piece you want. */
  /* What is placed on top takes the ground. A cell that falls inside a
     shape above this one is simply not drawn, so a new block of housing
     clears the field it lands on, and dragging one around hides whatever it
     passes over. The occluder's own feather is left out of it, so a
     softened edge lets what is underneath show through rather than cutting
     a hard hole in it. */
  /* `pad` pushes the takeover out past the shape's own edge, so a road
     clears a margin either side of itself and reads as running through the
     terrain rather than being buried in it. A margin cut at exactly that
     distance is a second hard outline though, drawn parallel to the first —
     so the boundary gets the same two treatments the terrain itself has:
     `padFade` dithers it out over a band, and `padBreak` wobbles where the
     band falls, cell by cell. */
  function covered(occ, x, y, cell, u, v){
    for (let i = 0; i < occ.length; i++){
      const o = occ[i];
      /* A demolished stretch of wall does not take ground either. Removing
         its diamonds is only half of it: the hole it punched in the floor
         beneath would still be there, and an opening you can walk through
         but can see the void through is not an opening, it is a bug with a
         door in it. */
      if (o._cut){
        let gone = false;
        for (let j = 0; j < o._cut.length; j++)
          if (geo.inside(o._cut[j], x, y)){ gone = true; break; }
        if (gone) continue;
      }
      /* `pad` is the whole of the clearance, measured from the shape's edge:
         the terrain never gives up more ground than that. `padFade` spends
         part of that distance dithering the boundary instead of cutting it,
         and `padBreak` wobbles where the dither falls — neither of them
         reaches any further out than `pad` does. */
      const O = (o.feather || 0) * cell - (o.pad || 0) * cell;   // outer limit
      const F = Math.min(o.padFade || 0, o.pad || 0) * cell;
      const B = o.padBreak || 0;
      let d = geo.depth(o, x, y);
      if (B > 0) d += (hash(u, v, o.seed + 881) - 0.5) * B * 2 * cell;
      if (d <= O) continue;                       // beyond the clearance
      if (F <= 0 || d >= O + F) return true;      // solidly inside it
      if (hash(u, v, o.seed + 883) < (d - O) / F) return true;
    }
    return false;
  }

  const MAX_CELLS = 26000;          // one pass's ceiling, so a big drag can't stall a frame
  function scan(s, cell, fn){
    const bb = geo.bbox(s), o = geo.origin(s);
    const c0 = Math.floor(bb[0] / cell), c1 = Math.ceil(bb[2] / cell);
    const r0 = Math.floor(bb[1] / cell), r1 = Math.ceil(bb[3] / cell);
    const ou = s.mask ? 0 : Math.round(o[0] / cell);
    const ov = s.mask ? 0 : Math.round(o[1] / cell);
    const fth = Math.max(0, s.feather || 0);
    const occ = s._occ;
    /* Grain drops the resolution: sample every nth cell and the pattern is
       addressed at that coarser pitch too, so the whole thing reads as a
       lower-resolution print rather than a thinned-out one. The size the
       diamonds are drawn at is scaled to match, back in build(). */
    const grain = Math.max(1, Math.round(s.grain || 1));
    const jit = Math.max(0, s.jitter || 0), scat = clamp(s.scatter || 0, 0, 1);
    let n = 0;
    for (let ry = r0; ry <= r1; ry++){
      if (grain > 1 && mod(ry, grain)) continue;
      for (let cx = c0; cx <= c1; cx++){
        if (grain > 1 && mod(cx, grain)) continue;
        const wx = (cx + 0.5) * cell, wy = (ry + 0.5) * cell;
        const d = geo.depth(s, wx, wy);
        if (d <= 0) continue;
        let u, v;
        if (s.mask){ u = cx; v = ry; }
        else if (s.rot){
          /* the pattern turns with the shape: address it in the shape's own
             frame, still on whole cells so the weave stays crisp */
          const l = geo.local(s, wx, wy);
          u = Math.round(l[0] / cell); v = Math.round(l[1] / cell);
        } else { u = cx - ou; v = ry - ov; }
        if (grain > 1){ u = Math.round(u / grain); v = Math.round(v / grain); }
        if (occ && covered(occ, wx, wy, cell, u, v)) continue;
        if (++n > MAX_CELLS) return;
        let fade = 1;
        if (fth > 0){
          fade = clamp(d / cell / fth, 0, 1);
          /* a soft alpha ramp alone reads as a blur in this medium, so the
             edge dissolves as well: cells drop out toward the border and the
             ones that survive thin down */
          if (fade < 1 && hash(u, v, s.seed + 991) > Math.sqrt(fade)) continue;
        }
        /* Scatter breaks the field up: some cells simply do not appear, and
           what is left is knocked off its seat. Jitter only does the second
           half of that, for an edge that is ragged but still solid. */
        if (scat > 0 && hash(u, v, s.seed + 773) < scat * 0.55) continue;
        let px = wx, py = wy;
        if (jit > 0 || scat > 0){
          const spread = (jit + scat * 1.6) * cell * grain;
          px += (hash(u, v, s.seed + 771) - 0.5) * spread;
          py += (hash(u, v, s.seed + 772) - 0.5) * spread;
        }
        fn(px, py, u, v, d / cell, fade);
      }
    }
  }
  /* a sub-shape borrowed for a nested feature — a pond in a park, the
     island inside a roundabout. Same generators, smaller footprint. */
  const sub = (s, type, x, y, w, h, salt) =>
    ({type, x, y, w, h, r: w / 2, width: w, pts: [[x, y]],
      seed: (s.seed + salt) | 0, mask: s.mask, feather: s.feather,
      rot: s.rot, _occ: s._occ});

  /* ── GROUND ────────────────────────────────────────────────────────────
     Dense and low resolution on purpose: diamonds a little wider than
     their cell, so they knit into a field instead of reading as a scatter. */

  function grass(s, cell, buf, opt){
    const o = opt || {};
    const base = o.tint || C.grass, dens = o.dens === undefined ? 0.95 : o.dens;
    scan(s, cell, (x, y, u, v, d, fade) => {
      const r = hash(u, v, s.seed);
      if (r > dens) return;
      const n = vnoise(u * 0.16, v * 0.16, s.seed + 3) * 0.62 +
                vnoise(u * 0.62, v * 0.62, s.seed + 4) * 0.38;
      const col = mixc(shade(base, 0.78 + n * 0.55), C.grassHi, n * n * 0.45);
      const sz = (0.94 + n * 0.14) * (0.55 + fade * 0.45);
      buf.cell(x, y, col, (0.6 + n * 0.3) * fade, sz, 0,
               (0.48 + n * 0.36) * fade, sz * 1.05, 0,
               0.04 + r * 0.05, hash(u, v, s.seed + 11));
    });
  }

  /* the one kind that really moves: a dense plate whose two faces differ
     enough that the whole surface crawls like light on water */
  function water(s, cell, buf){
    scan(s, cell, (x, y, u, v, d, fade) => {
      const r = hash(u, v, s.seed);
      if (r > 0.97) return;
      const swell = vnoise(u * 0.13, v * 0.13, s.seed + 5);
      const wave = 0.5 + 0.5 * Math.sin(u * 0.42 + v * 0.24 + swell * 5.5);
      const deep = clamp(d * 0.12, 0, 1);                // darker away from the shore
      const base = mixc(C.water, C.deep, deep * 0.7);
      const col = mixc(base, C.waterHi, wave * wave * 0.75);
      const sz = (0.92 + wave * 0.2) * (0.55 + fade * 0.45);
      buf.cell(x, y, col, (0.62 + wave * 0.32) * fade, sz, 0,
               (0.5 + wave * 0.3) * fade, sz * 1.12, wave > 0.72 ? 1 : 0,
               0.16 + wave * 0.14, hash(u, v, s.seed + 9));
    });
  }

  /* ── TREES ─────────────────────────────────────────────────────────────
     Individual crowns on a jittered stand grid, each with a trunk. A stand
     is conifers, broadleaves, or a mix of the two, on request. */
  const STAND = 6;
  function crown(lu, lv, s, salt, occupancy, variant){
    const h0 = hash(lu, lv, s.seed + salt);
    if (h0 < 1 - occupancy) return null;                 // an empty stand
    const g = (h0 - (1 - occupancy)) / Math.max(occupancy, 0.001);
    const conifer = variant === 'conifer' ? true
                  : variant === 'broadleaf' ? false
                  : hash(lu, lv, s.seed + salt + 3) < 0.5;
    return {
      cx: lu * STAND + 1.5 + hash(lu, lv, s.seed + salt + 1) * (STAND - 3),
      cy: lv * STAND + 1.5 + hash(lu, lv, s.seed + salt + 2) * (STAND - 3),
      conifer,
      rx: conifer ? 1.5 + g * 1.15 : 1.7 + g * 1.35,
      ry: conifer ? 2.8 + g * 2.2  : 1.7 + g * 1.35,
      g
    };
  }
  /* Nothing is laid under the crowns: ground is the Ground layer's job, and
     a carpet of green here is exactly what stops a tree reading as a tree. */
  function trees(s, cell, buf, opt){
    const o = opt || {};
    const occ = o.occ === undefined ? 0.55 : o.occ;
    const variant = o.variant || s.variant || 'mixed';
    if (o.under === true) grass(s, cell, buf, {dens: 0.9, tint: C.grassDim});
    scan(s, cell, (x, y, u, v, d, fade) => {
      if (d < 0.3) return;
      const pu = Math.floor(u / STAND), pv = Math.floor(v / STAND);
      let hit = null, ht = 0, side = 0, trunk = false;
      for (let a = -1; a <= 1; a++)
        for (let b = -1; b <= 1; b++){
          const c = crown(pu + a, pv + b, s, 21, occ, variant);
          if (!c) continue;
          const du = u - c.cx, dv = v - c.cy;
          let inside;
          if (c.conifer){
            const t = (dv + c.ry) / (2 * c.ry);          // 0 apex · 1 base
            inside = t >= 0 && t <= 1 && Math.abs(du) <= 0.45 + c.rx * t;
          } else {
            inside = (du / c.rx) * (du / c.rx) + (dv / c.ry) * (dv / c.ry) <= 1;
          }
          /* the nearer tree overdraws the one behind it */
          if (inside){
            if (!hit || c.cy > hit.cy){
              hit = c; ht = (dv + c.ry) / (2 * c.ry); side = du / c.rx; trunk = false;
            }
          } else if (!hit && Math.abs(du) < 0.55 && dv > c.ry && dv < c.ry + 1.3){
            hit = c; ht = 1; side = 0; trunk = true;
          }
        }
      if (!hit) return;
      const r = hash(u, v, s.seed + 31);
      if (trunk){
        buf.cell(x, y, shade(C.trunk, 0.8 + r * 0.4), 0.9 * fade, 0.62, 0,
                 0.75 * fade, 0.72, 0, 0.02, hash(u, v, s.seed + 35));
        return;
      }
      /* light falls on the crown from the upper left, so the silhouette has
         a top to it and the two forms stay legible against each other */
      const lit = clamp(1.05 - ht * 0.55 - side * 0.16 + r * 0.1, 0.35, 1.3);
      const col = shade(hit.conifer ? mixc(C.coniferHi, C.conifer, ht * 0.8 + 0.15)
                                    : mixc(C.treeHi, C.tree, ht * 0.85 + 0.1), lit);
      const sz = 0.95 + (1 - ht) * 0.14;
      buf.cell(x, y, col, 0.9 * fade, sz, 0, 0.78 * fade, sz * 1.08, r > 0.9 ? 1 : 0,
               0.04 + r * 0.04, hash(u, v, s.seed + 33));
    });
  }

  /* ── ROADS ─────────────────────────────────────────────────────────────
     A dense thin line, the same bright low-chroma signature the map's own
     routes carry, so a drawn road and a printed one read as one network.
     A ring shape makes it a roundabout, island and all. */
  function road(s, cell, buf){
    const half = Math.max(s.width / (2 * cell), 0.5);
    scan(s, cell, (x, y, u, v, d, fade) => {
      const t = clamp(d / half, 0, 1);                   // 0 at the kerb, 1 down the middle
      const r = hash(u, v, s.seed);
      if (r > 0.985) return;                             // the faintest breaks, not a dotted line
      const kerb = t < 0.28 && half > 1.4;
      const col = kerb ? mixc(C.kerb, C.road, t * 2.4) : C.road;
      const sz = kerb ? 0.82 : 0.94 + t * 0.18;
      buf.cell(x, y, col, (kerb ? 0.55 + t : 0.86 + t * 0.14) * fade, sz, 0,
               (kerb ? 0.44 + t : 0.74 + t * 0.2) * fade, sz * 1.06, 0,
               0.02, hash(u, v, s.seed + 7));
    });
    /* a roundabout is a ring of road with something in the middle */
    if (s.type === 'ring'){
      const ri = s.r - s.width / 2;
      if (ri > cell * 1.2){
        const isle = sub(s, 'ellipse', s.x, s.y, ri * 1.9, ri * 1.9, 5);
        isle.feather = 0;
        grass(isle, cell, buf, {dens: 0.93});
        if (ri > cell * 4) trees(isle, cell, buf, {occ: 0.5, under: false, variant: 'mixed'});
      }
    }
  }

  /* ── CREEK ─────────────────────────────────────────────────────────────
     A road's geometry carrying water. Everything about drawing one is the
     road editor — a polyline whose segments bow, a width, a ring if you
     want a moat — because the editor keys off the shape's *type*, not its
     kind. What differs is what it is made of and what it means: it reads
     as a channel with damp banks, and it is never a route. The walker
     locks onto roads; a creek is something a road has to bridge.

     The flow runs along the line rather than across it, so the highlight
     travels with `u` — the distance down the creek — and the water reads
     as moving rather than as a puddle stretched thin. */
  function creek(s, cell, buf){
    const half = Math.max(s.width / (2 * cell), 0.5);
    scan(s, cell, (x, y, u, v, d, fade) => {
      const t = clamp(d / half, 0, 1);                  // 0 at the bank, 1 mid-stream
      if (hash(u, v, s.seed) > 0.98) return;            // the faintest breaks
      const swell = vnoise(u * 0.3, v * 0.5, s.seed + 5);
      const wave = 0.5 + 0.5 * Math.sin(u * 0.5 + swell * 5.0);
      /* a bank only exists once the channel is wide enough to have one */
      const bank = t < 0.34 && half > 1.1;
      const base = bank ? mixc(C.grassDim, C.water, t * 2.6)
                        : mixc(C.water, C.deep, (1 - wave) * 0.5 * t);
      const col = bank ? base : mixc(base, C.waterHi, wave * wave * 0.7);
      const sz = bank ? 0.84 : 0.9 + t * 0.16;
      buf.cell(x, y, col, (bank ? 0.5 + t * 0.3 : 0.6 + wave * 0.3) * fade, sz, 0,
               (bank ? 0.4 + t * 0.25 : 0.48 + wave * 0.28) * fade, sz * 1.1,
               !bank && wave > 0.74 ? 1 : 0,
               0.14 + wave * 0.12, hash(u, v, s.seed + 9));
    });
    /* a ring creek is a moat, and wants an island for the same reason a
       roundabout does — once there is an inside to it */
    if (s.type === 'ring'){
      const ri = s.r - s.width / 2;
      if (ri > cell * 1.2){
        const isle = sub(s, 'ellipse', s.x, s.y, ri * 1.9, ri * 1.9, 5);
        isle.feather = 0;
        grass(isle, cell, buf, {dens: 0.9});
        if (ri > cell * 4) trees(isle, cell, buf, {occ: 0.45, under: false, variant: 'mixed'});
      }
    }
  }

  /* ── BUILT ─────────────────────────────────────────────────────────────
     Blocks on a lot grid with the last row and column left as street. Each
     lot takes a form — shed, courtyard block, or tower — either picked for
     it or forced for the whole district, and carries its own window
     scatter, so a district has pattern in it rather than a flat texture. */
  const LOTW = 8, LOTH = 6;
  const FORMS = {sheds: 0, blocks: 1, towers: 2};
  function buildings(s, cell, buf){
    const forced = FORMS[s.variant];
    scan(s, cell, (x, y, u, v, d, fade) => {
      if (d < 0.3) return;
      const lu = Math.floor(u / LOTW), lv = Math.floor(v / LOTH);
      const iu = u - lu * LOTW, iv = v - lv * LOTH;
      const r = hash(u, v, s.seed + 47);
      if (iu >= LOTW - 1 || iv >= LOTH - 1){             // the street between blocks
        if (r > 0.75) return;
        buf.cell(x, y, C.paving, 0.34 * fade, 0.85, 0, 0.26 * fade, 0.9, 0, 0.02,
                 hash(u, v, s.seed + 45));
        return;
      }
      const lot = hash(lu, lv, s.seed + 41);
      if (lot < 0.08) return;                            // a vacant plot
      const form = forced === undefined ? (lot < 0.36 ? 0 : (lot < 0.78 ? 1 : 2)) : forced;
      const inset = form === 2 ? 2 : (form === 0 ? 1 : 0);
      const w0 = inset, w1 = LOTW - 2 - inset, h0 = inset, h1 = LOTH - 2 - inset;
      if (iu < w0 || iu > w1 || iv < h0 || iv > h1){      // forecourt
        if (r > 0.4) return;
        buf.cell(x, y, C.paving, 0.3 * fade, 0.8, 0, 0.22 * fade, 0.86, 0, 0.02,
                 hash(u, v, s.seed + 44));
        return;
      }
      /* a courtyard block is hollow */
      if (form === 1 && lot > 0.6 && iu > w0 + 1 && iu < w1 - 1 && iv > h0 + 1 && iv < h1 - 1){
        if (r > 0.5) return;
        buf.cell(x, y, C.grassDim, 0.36 * fade, 0.85, 0, 0.28 * fade, 0.9, 0, 0.05,
                 hash(u, v, s.seed + 46));
        return;
      }
      const rim = iu === w0 || iu === w1 || iv === h0 || iv === h1;
      const parapet = iv === h0;                          // the lit top edge
      const win = ((iu - w0) % 2 === 1) && ((iv - h0) % 2 === 1);
      const lift = 0.7 + lot * 0.5;
      let col, a, sz;
      if (parapet){ col = mixc(C.wall, C.trim, 0.45 + lot * 0.4); a = 0.95; sz = 1.0; }
      else if (rim){ col = shade(C.wall, lift); a = 0.8 + lot * 0.18; sz = 0.95; }
      else if (win && r > 0.3){ col = mixc(C.win, C.wall, r * 0.5); a = 0.7 + r * 0.28; sz = 0.62; }
      else { col = shade(C.wallDim, lift); a = 0.42 + r * 0.2; sz = 0.9; }
      buf.cell(x, y, col, a * fade, sz, 0, a * 0.8 * fade, sz * (win ? 1.5 : 1.08), win ? 1 : 0,
               0.02 + r * 0.02, hash(u, v, s.seed + 49));
    });
  }

  /* the same idea at a domestic scale: a plot, a body, a pitched roof with
     a lit ridge, a door, and a path out to the street. Terraced runs the
     houses together into a row; detached leaves gardens between them. */
  const PLOT = 7;
  function houses(s, cell, buf){
    const terrace = s.variant === 'terraced', detached = s.variant === 'detached';
    grass(s, cell, buf, {dens: 0.34, tint: C.grassDim});
    scan(s, cell, (x, y, u, v, d, fade) => {
      if (d < 0.3) return;
      const lu = Math.floor(u / PLOT), lv = Math.floor(v / PLOT);
      const h = hash(lu, lv, s.seed + 61);
      if (!terrace && h < (detached ? 0.22 : 0.3)) return;      // an empty plot
      const ox = terrace ? 0 : 1 + Math.floor(hash(lu, lv, s.seed + 62) * 2);
      const oy = terrace ? 2 : 1 + Math.floor(hash(lu, lv, s.seed + 63) * 2);
      const iu = u - lu * PLOT - ox, iv = v - lv * PLOT - oy;
      const w = terrace ? PLOT - 1 : 2 + Math.floor(h * 2.4);
      const ht = terrace ? 2 : (h > 0.72 ? 3 : 2);
      const r = hash(u, v, s.seed + 65);
      if (iu < 0 || iu > w || iv < 0 || iv > ht){
        /* the path from the door down to the street */
        if (!terrace && iu === (w >> 1) && iv > ht && iv <= PLOT - 2 - oy)
          buf.cell(x, y, C.paving, 0.42 * fade, 0.7, 0, 0.32 * fade, 0.78, 0, 0.02,
                   hash(u, v, s.seed + 69));
        return;
      }
      const ridge = iv === 0, eave = iv === 1;
      const door = iv === ht && (terrace ? (iu % 3 === 1) : iu === (w >> 1));
      /* a terrace still needs party walls, or it reads as one long shed */
      const party = terrace && iu % 3 === 0;
      let col, a, sz;
      if (ridge){ col = mixc(C.roofHi, C.roof, 0.25 + r * 0.3); a = 0.95; sz = 0.98; }
      else if (eave){ col = shade(C.roof, 0.8 + h * 0.3); a = 0.88; sz = 1.0; }
      else if (door){ col = C.door; a = 0.9; sz = 0.66; }
      else if (party){ col = shade(C.house, 0.6); a = 0.75; sz = 0.9; }
      else { col = shade(C.house, 0.8 + h * 0.35 + r * 0.1); a = 0.7 + r * 0.22; sz = 0.94; }
      buf.cell(x, y, col, a * fade, sz, 0, a * 0.82 * fade, sz * 1.08, door ? 1 : 0,
               0.02 + r * 0.03, hash(u, v, s.seed + 67));
    });
  }

  /* grass, thinner stands, a walk just inside the fence, and a pond if
     there is room for one */
  function park(s, cell, buf){
    grass(s, cell, buf, {dens: 0.95});
    trees(s, cell, buf, {occ: 0.34, under: false, variant: s.variant || 'mixed'});
    const bb = geo.bbox(s), w = bb[2] - bb[0], h = bb[3] - bb[1];
    if (Math.min(w, h) > cell * 22){
      const c = geo.centre(s);
      const pw = Math.min(w, h) * 0.36;
      grass(sub(s, 'ellipse', c[0] + w * 0.12, c[1] + h * 0.1, pw * 1.4, pw * 1.4, 8),
            cell, buf, {dens: 0.5, tint: C.grassHi});
      water(sub(s, 'ellipse', c[0] + w * 0.12, c[1] + h * 0.1, pw, pw * 0.8, 9), cell, buf);
    }
    scan(s, cell, (x, y, u, v, d, fade) => {
      if (d > 2.6 || d < 1) return;
      const r = hash(u, v, s.seed + 71);
      if (r > 0.9) return;
      buf.cell(x, y, C.road, (0.6 + r * 0.3) * fade, 0.8, 0, 0.5 * fade, 0.88, 0, 0.02,
               hash(u, v, s.seed + 73));
    });
  }

  /* ── INTERIORS ─────────────────────────────────────────────────────────
     Inside a building the same machinery draws a floor plan. Nothing about
     the engine changes: these are kinds like any other, addressed by
     shape-local cells, and a shape's *type* does the same work it does
     outdoors — a line is a wall run the way a line is a road, a ring is a
     curved wall the way a ring is a roundabout. What differs is the
     material, and what it means to the walker: floors carry you, walls and
     furniture stop you, and a door is the one thing that clears a wall
     rather than joining it.

     Furniture is drawn against the shape's own half-extents rather than a
     lot grid, because a bed is one bed however big you drag it, not a field
     of beds — which is exactly the difference between a district and a
     piece of furniture. */

  /* Where a cell sits across a band, 0 at the face and 1 down the middle.
     A line and a ring are bands already; an area drawn with a hollow kind is
     made into one by geo.depth, so the same measure works for all of them
     and no generator has to know which it was handed. Widen a wall past half
     the shape and the band closes up into a solid mass — a pillar. */
  const band = (s, cell, d, w) => clamp(d / Math.max(w / (2 * cell), 0.5), 0, 1);
  /* the shape's half-extents in cells — what furniture is laid out against */
  const halfU = (s, cell) => Math.max(1, (s.w || cell * 8) / (2 * cell));
  const halfV = (s, cell) => Math.max(1, (s.h || cell * 8) / (2 * cell));

  /* ── FLOOR ─────────────────────────────────────────────────────────────
     Boards run along the shape, in courses that break at staggered ends;
     tile is a grid with grout; flags are a wobbled lattice, so no two are
     the same size and the joints wander the way laid stone does. */
  const flagU = (u, v, s) =>
    Math.round((u + (vnoise(u * 0.15, v * 0.15, s.seed + 108) - 0.5) * 2.6) / 5);
  const flagV = (u, v, s) =>
    Math.round((v + (vnoise(u * 0.15, v * 0.15, s.seed + 109) - 0.5) * 2.6) / 4);
  function floor(s, cell, buf){
    const style = s.variant || 'boards';
    scan(s, cell, (x, y, u, v, d, fade) => {
      const r = hash(u, v, s.seed + 101);
      let col, a, sz;
      if (style === 'tile'){
        const iu = mod(u, 4), iv = mod(v, 4);
        const t = hash(Math.floor(u / 4), Math.floor(v / 4), s.seed + 102);
        if (iu === 0 || iv === 0){ col = C.grout; a = 0.5; sz = 0.78; }
        else { col = shade(mixc(C.tileF, C.tileDim, t * 0.5), 0.9 + r * 0.22);
               a = 0.62 + t * 0.2; sz = 0.98; }
      } else if (style === 'flags'){
        const joint = flagU(u, v, s) !== flagU(u + 1, v, s) ||
                      flagV(u, v, s) !== flagV(u, v + 1, s);
        const t = hash(flagU(u, v, s), flagV(u, v, s), s.seed + 103);
        if (joint){ col = C.grout; a = 0.45; sz = 0.74; }
        else { col = shade(mixc(C.tileDim, C.tileF, t * 0.8), 0.88 + r * 0.24);
               a = 0.6 + t * 0.2; sz = 0.96; }
      } else {
        const row = Math.floor(v / 2);                       // a board is two cells deep
        const off = (hash(row, 0, s.seed + 104) * 30) | 0;   // and the run breaks staggered
        const t = hash(Math.floor((u + off) / 9), row, s.seed + 105);
        const seam = mod(u + off, 9) === 0 || mod(v, 2) === 0;
        const grain = vnoise(u * 0.55, v * 2.2, s.seed + 106);
        col = seam ? shade(C.boardDim, 0.85 + r * 0.3)
                   : mixc(C.board, C.boardHi, t * 0.55 + grain * 0.3);
        a = seam ? 0.4 : 0.66 + t * 0.2;
        sz = seam ? 0.76 : 0.98;
      }
      buf.cell(x, y, col, a * fade, sz, 0, a * 0.82 * fade, sz * 1.06, 0,
               0.02, hash(u, v, s.seed + 107));
    });
  }

  /* a rug is a field with a fringe and a border band round it, which is
     what stops it reading as a second floor laid over the first */
  function rug(s, cell, buf){
    const style = s.variant || 'plain';
    const hw = halfU(s, cell), hh = halfV(s, cell);
    scan(s, cell, (x, y, u, v, d, fade) => {
      const r = hash(u, v, s.seed + 111);
      if (r > 0.97) return;
      let col, a = 0.62, sz = 0.94;
      if (d < 1.1){ col = shade(C.rugDim, 0.9 + r * 0.5); a = 0.66; sz = 0.8; }
      else if (d < 2.4){ col = mixc(C.rugHi, C.rug, 0.3 + r * 0.5); a = 0.75; }
      else {
        const t = style === 'stripe' ? 0.5 + 0.5 * Math.sin(v * 0.9)
                : style === 'medallion' ? clamp(1 - Math.hypot(u / hw, v / hh) * 1.5, 0, 1)
                : vnoise(u * 0.32, v * 0.32, s.seed + 112);
        col = mixc(C.rug, C.rugHi, t * 0.75);
        a = 0.56 + t * 0.24;
      }
      buf.cell(x, y, col, a * fade, sz, 0, a * 0.8 * fade, sz * 1.08, 0,
               0.03, hash(u, v, s.seed + 113));
    });
  }

  /* ── WALLS ─────────────────────────────────────────────────────────────
     Drawn the way a plan draws them: a solid poché with its two faces
     picked out darker, so a wall has an edge to it and rooms read as rooms
     rather than as bands of white. */
  function wall(s, cell, buf){
    const mat = s.variant || 'plaster';
    const w = s.width || cell * 2;
    scan(s, cell, (x, y, u, v, d, fade) => {
      const t = band(s, cell, d, w);
      const r = hash(u, v, s.seed + 121);
      const face = t < 0.42;                              // the drawn edge of the wall
      let col, a, sz;
      if (mat === 'brick'){
        const bed = mod(v, 3) === 0, perp = mod(u + (mod(v, 6) < 3 ? 0 : 3), 6) === 0;
        const joint = (bed || perp) && r > 0.35;
        col = joint ? shade(C.plasterDim, 0.9 + r * 0.3) : shade(C.brick, 0.8 + r * 0.45);
        a = joint ? 0.5 : 0.85; sz = joint ? 0.78 : 0.98;
      } else if (mat === 'timber'){
        const grain = vnoise(u * 0.9, v * 0.35, s.seed + 122);
        col = mixc(C.timber, C.timberHi, grain * 0.7);
        a = face ? 0.9 : 0.76 + grain * 0.16; sz = 0.96;
      } else {
        col = face ? shade(C.plasterDim, 0.9 + r * 0.4) : shade(C.plaster, 0.86 + r * 0.28);
        a = face ? 0.92 : 0.76; sz = face ? 0.88 : 1.0;
      }
      buf.cell(x, y, col, a * fade, sz, 0, a * 0.84 * fade, sz * 1.06, 0,
               0.02, hash(u, v, s.seed + 123));
    });
  }

  /* glazing: the same band, mostly not there. Frames at both faces, a
     mullion every six cells, and glass that catches the light between. */
  function glazing(s, cell, buf){
    const w = s.width || cell * 2;
    scan(s, cell, (x, y, u, v, d, fade) => {
      const t = band(s, cell, d, w);
      const r = hash(u, v, s.seed + 131);
      const frame = t < 0.34, mull = mod(u, 6) === 0 || mod(v, 6) === 0;
      if (!frame && !mull && r > 0.74) return;
      const col = frame || mull ? shade(C.plaster, 0.8 + r * 0.3)
                                : mixc(C.glass, C.glassHi, r * 0.8);
      const a = frame ? 0.9 : (mull ? 0.72 : 0.46 + r * 0.32);
      const sz = frame ? 0.88 : (mull ? 0.84 : 0.7);
      buf.cell(x, y, col, a * fade, sz, 0, a * 0.78 * fade, sz * 1.25,
               !frame && !mull && r > 0.86 ? 1 : 0,
               frame ? 0.02 : 0.08 + r * 0.06, hash(u, v, s.seed + 132));
    });
  }

  /* ── ACCESS ────────────────────────────────────────────────────────────
     A door is the one kind that takes ground from a wall instead of joining
     it, so drawing one across a wall run opens it. What it leaves behind is
     a threshold, two jambs, and the leaf and its arc — which are drawn
     outside the shape on purpose, because that sweep is most of what makes
     a plan read as a plan. */
  function door(s, cell, buf){
    const style = s.variant || 'swing';
    const w = s.width || cell * 2;
    scan(s, cell, (x, y, u, v, d, fade) => {
      const r = hash(u, v, s.seed + 141);
      buf.cell(x, y, shade(C.plaster, 0.5 + r * 0.25), 0.32 * fade, 0.7, 0,
               0.24 * fade, 0.78, 0, 0.02, hash(u, v, s.seed + 142));
    });
    if (s.type !== 'line') return;
    const F = flatten(s), A = F[0], B = F[F.length - 1];
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy);
    if (L < cell) return;
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const dot = (px, py, col, a, sz, g, salt) =>
      buf.cell(px, py, col, a, sz, g, a * 0.8, sz * 1.06, g, 0.02, hash(salt, 3, s.seed + 143));
    for (const [jx, jy] of [[A[0], A[1]], [B[0], B[1]]])       // the jambs
      for (let k = -1; k <= 1; k++)
        dot(jx + nx * k * w * 0.4, jy + ny * k * w * 0.4, C.plaster, 0.95, 1, 0, jx + k);
    if (style === 'open') return;
    if (style === 'slide'){                                    // the leaf parked alongside
      const n = Math.max(5, Math.round(L / cell));
      for (let i = 0; i <= n; i++){
        const p = i / n * L;
        dot(B[0] + ux * p + nx * w * 0.7, B[1] + uy * p + ny * w * 0.7,
            shade(C.plaster, 0.9), 0.82, 0.84, 0, i);
      }
      return;
    }
    const arm = style === 'double' ? L / 2 : L;
    const swing = (hx, hy, su, sv, salt) => {
      const n = Math.max(5, Math.round(arm / cell));
      for (let i = 1; i <= n; i++)                             // the leaf, standing open
        dot(hx + nx * (i / n) * arm, hy + ny * (i / n) * arm, C.plaster, 0.88, 0.82, 0,
            salt * 100 + i);
      const m = Math.max(9, Math.round(arm / cell * 1.5));
      for (let i = 0; i <= m; i++){                            // the arc it sweeps
        const th = i / m * Math.PI / 2, c = Math.cos(th), n2 = Math.sin(th);
        dot(hx + (nx * c + su * n2) * arm, hy + (ny * c + sv * n2) * arm,
            C.plaster, 0.26, 0.5, 1, salt * 200 + i);
      }
    };
    if (style === 'double'){ swing(A[0], A[1], ux, uy, 1); swing(B[0], B[1], -ux, -uy, 2); }
    else swing(A[0], A[1], ux, uy, 1);
  }

  /* a flight of treads with a lit nosing on each, brightening as it climbs,
     so which way is up is on the drawing rather than in your head */
  function stairs(s, cell, buf){
    const down = s.variant === 'down';
    const runU = (s.w || 0) >= (s.h || 0);
    const half = runU ? halfU(s, cell) : halfV(s, cell);
    scan(s, cell, (x, y, u, v, d, fade) => {
      const t = runU ? u : v;
      const p = clamp((t + half) / (2 * half), 0, 1);
      const rise = down ? 1 - p : p;
      const nose = mod(t, 3) === 0;
      const r = hash(u, v, s.seed + 151);
      if (!nose && r > 0.95) return;
      const col = nose ? mixc(C.timberHi, C.plaster, 0.35 + rise * 0.45)
                       : shade(mixc(C.timber, C.timberHi, rise * 0.5), 0.85 + r * 0.3);
      const a = nose ? 0.95 : 0.6 + rise * 0.22;
      const sz = nose ? 0.98 : 0.9;
      buf.cell(x, y, col, a * fade, sz, 0, a * 0.82 * fade, sz * 1.06, 0,
               0.02, hash(u, v, s.seed + 152));
    });
  }

  /* ── FITTINGS ──────────────────────────────────────────────────────────
     One piece each, laid out against the shape's own half-extents. */
  function counter(s, cell, buf){
    const style = s.variant || 'counter';
    const hh = halfV(s, cell);
    scan(s, cell, (x, y, u, v, d, fade) => {
      const r = hash(u, v, s.seed + 161);
      const back = style === 'counter' && v < -hh + 1.2;   // a splashback along the top
      let col, a, sz;
      if (back){ col = shade(C.tileF, 0.88 + r * 0.3); a = 0.72; sz = 0.88; }
      else if (d < 0.9){ col = mixc(C.metal, C.plaster, 0.35 + r * 0.35); a = 0.95; sz = 0.94; }
      else {
        const grain = vnoise(u * 0.5, v * 0.5, s.seed + 162);
        col = style === 'bench' ? mixc(C.timber, C.timberHi, grain * 0.7)
                                : shade(mixc(C.tileDim, C.tileF, grain * 0.65), 0.92);
        a = 0.7 + grain * 0.18; sz = 0.96;
      }
      buf.cell(x, y, col, a * fade, sz, 0, a * 0.82 * fade, sz * 1.06, 0,
               0.02, hash(u, v, s.seed + 163));
    });
  }

  /* the top sits inside the shape and the chairs live in the band around
     it, so the whole piece — table and everything pulled up to it — is what
     you drag, and what the walker has to go round */
  function table(s, cell, buf){
    const style = s.variant || 'dining';
    const hw = halfU(s, cell), hh = halfV(s, cell);
    const seat = Math.min(1.8, Math.max(hw, hh) * 0.34);
    scan(s, cell, (x, y, u, v, d, fade) => {
      const r = hash(u, v, s.seed + 171);
      if (d > seat){
        const grain = vnoise(u * 0.42, v * 0.42, s.seed + 172);
        const rim = d < seat + 1;
        const col = rim ? mixc(C.timberHi, C.timber, 0.3 + r * 0.3)
                        : mixc(C.timber, C.timberHi, grain * 0.6);
        buf.cell(x, y, col, (rim ? 0.95 : 0.74 + grain * 0.2) * fade, rim ? 0.98 : 0.94, 0,
                 (rim ? 0.8 : 0.6) * fade, 1.04, 0, 0.02, hash(u, v, s.seed + 173));
        return;
      }
      const horiz = hh - Math.abs(v) <= hw - Math.abs(u);
      let on;
      if (style === 'round'){
        const th = Math.atan2(v / hh, u / hw);
        on = mod(th / (Math.PI * 2) * 6 + 0.5, 1) < 0.45;
      } else if (style === 'desk'){
        on = v > 0 && horiz && Math.abs(u) < 1.8;
      } else {
        on = horiz ? mod(u + 1.5, 4) < 2.2 && Math.abs(u) < hw - 1
                   : mod(v + 1.5, 4) < 2.2 && Math.abs(v) < hh - 1;
      }
      if (!on) return;
      buf.cell(x, y, shade(C.fabric, 0.85 + r * 0.45), 0.82 * fade, 0.86, 0,
               0.62 * fade, 0.94, 0, 0.02, hash(u, v, s.seed + 174));
    });
  }

  function bed(s, cell, buf){
    const twin = s.variant === 'double';
    const hh = halfV(s, cell);
    scan(s, cell, (x, y, u, v, d, fade) => {
      const r = hash(u, v, s.seed + 181);
      let col, a, sz;
      if (d < 0.9){ col = shade(C.timber, 0.9 + r * 0.4); a = 0.9; sz = 0.94; }
      else if (v < -hh + 2.4){                          // the pillow end
        const gap = twin && Math.abs(u) < 0.8;
        col = gap ? shade(C.timber, 0.8) : shade(C.linen, 0.92 + r * 0.16);
        a = gap ? 0.6 : 0.88; sz = gap ? 0.78 : 0.98;
      }
      else if (v < -hh + 4){ col = shade(C.linen, 0.84 + r * 0.24); a = 0.78; sz = 0.94; }
      else {
        const fold = vnoise(u * 0.3, v * 0.5, s.seed + 182);
        col = mixc(C.fabric, C.fabricHi, fold * 0.8);
        a = 0.7 + fold * 0.2; sz = 0.95;
      }
      buf.cell(x, y, col, a * fade, sz, 0, a * 0.82 * fade, sz * 1.06, 0,
               0.02, hash(u, v, s.seed + 183));
    });
  }

  function sofa(s, cell, buf){
    const chair = s.variant === 'armchair';
    const hw = halfU(s, cell), hh = halfV(s, cell);
    scan(s, cell, (x, y, u, v, d, fade) => {
      const r = hash(u, v, s.seed + 191);
      const back = v < -hh + 1.8, arm = Math.abs(u) > hw - 1.6;
      const seam = !back && !arm && !chair && mod(u + 2, 4) < 0.7;
      let col, a, sz;
      if (back || arm){ col = shade(C.fabric, 0.7 + r * 0.35); a = 0.9; sz = 0.98; }
      else if (seam){ col = shade(C.fabric, 0.5); a = 0.6; sz = 0.76; }
      else {
        const n = vnoise(u * 0.4, v * 0.4, s.seed + 192);
        col = mixc(C.fabric, C.fabricHi, 0.35 + n * 0.6);
        a = 0.74 + n * 0.18; sz = 0.96;
      }
      buf.cell(x, y, col, a * fade, sz, 0, a * 0.82 * fade, sz * 1.06, 0,
               0.02, hash(u, v, s.seed + 193));
    });
  }

  function shelf(s, cell, buf){
    const style = s.variant || 'books';
    scan(s, cell, (x, y, u, v, d, fade) => {
      const r = hash(u, v, s.seed + 201);
      if (d < 0.9 || mod(u, 5) === 0){                  // the case and its dividers
        buf.cell(x, y, shade(C.timber, 0.85 + r * 0.35), 0.92 * fade, 0.95, 0,
                 0.76 * fade, 1.02, 0, 0.02, hash(u, v, s.seed + 202));
        return;
      }
      if (style === 'wardrobe'){
        buf.cell(x, y, shade(C.timberHi, 0.78 + r * 0.3), 0.6 * fade, 0.9, 0,
                 0.46 * fade, 0.96, 0, 0.02, hash(u, v, s.seed + 203));
        return;
      }
      if (style === 'store' && r > 0.68) return;
      const spine = hash(u, Math.floor(v / 2), s.seed + 204);
      const col = style === 'books'
        ? [0.3 + spine * 0.6, 0.26 + hash(u, 3, s.seed + 205) * 0.5,
           0.28 + hash(u, 5, s.seed + 206) * 0.5]
        : shade(C.tileF, 0.7 + r * 0.5);
      buf.cell(x, y, col, (0.7 + spine * 0.25) * fade, 0.7 + spine * 0.22, 0,
               0.55 * fade, 0.9, 0, 0.02, hash(u, v, s.seed + 207));
    });
  }

  /* a pot showing round a ragged crown — the one green thing indoors, and
     the same silhouette trick the stands outside use, at one plant's size */
  function plant(s, cell, buf){
    scan(s, cell, (x, y, u, v, d, fade) => {
      const r = hash(u, v, s.seed + 211);
      if (d < 1){
        buf.cell(x, y, shade(C.pot, 0.85 + r * 0.4), 0.9 * fade, 0.94, 0,
                 0.72 * fade, 1, 0, 0.02, hash(u, v, s.seed + 212));
        return;
      }
      const n = vnoise(u * 0.6, v * 0.6, s.seed + 213);
      if (r > 0.8 + n * 0.18) return;
      buf.cell(x, y, mixc(C.tree, C.treeHi, n * 0.9), (0.8 + n * 0.18) * fade, 0.9 + n * 0.2, 0,
               0.6 * fade, 1.02, n > 0.8 ? 1 : 0, 0.05 + n * 0.05, hash(u, v, s.seed + 214));
    });
  }

  /* a kind that is only a statement about other kinds draws nothing */
  function nothing(){}

  /* ── the registry ────────────────────────────────────────────────────── */
  /* listed in the order you work through a plan, but drawn by `z`: the
     road network reads on top of everything, the way it does on the
     printed map, so a block of housing can never bury the route through it.
     `start` is the layer build mode opens on — the network everything else
     gets arranged around, outdoors and in. */
  const LAYERS = [
    {id: 'roads',  label: 'Roads',     z: 3, solo: true, start: true},
    {id: 'ground', label: 'Ground',    z: 0},
    {id: 'trees',  label: 'Trees',     z: 1},
    {id: 'built',  label: 'Buildings', z: 2}
  ];

  const AREA = ['rect', 'ellipse'];
  const WOOD = ['mixed', 'conifer', 'broadleaf'];
  const LIST = [
    {id: 'grass',     label: 'Grass',     layer: 'ground', types: AREA,
     walk: 1, stamp: 3, gen: grass,     swatch: '#5C9648'},
    {id: 'water',     label: 'Water',     layer: 'ground', types: AREA,
     walk: 0, stamp: 0, gen: water,     swatch: '#2E66B8'},
    {id: 'creek',     label: 'Creek',     layer: 'ground', types: ['line', 'ring'],
     walk: 0, stamp: 0.5, gen: creek,    swatch: '#3E7FBF',
     feather0: 0.5, pad0: 0.5, padFade0: 0.6, padBreak0: 0.25,
     /* creeks run into one another the way roads do, so a tributary is a
        junction and not two channels with a hole punched where they meet.
        It also means a road crossing a creek clears nothing: the road is
        drawn over it and stamps last, which is exactly a bridge. */
     connects: true},
    {id: 'trees',     label: 'Trees',     layer: 'trees',  types: AREA, variants: WOOD,
     walk: 1, stamp: 4, gen: trees,     swatch: '#2A6640'},
    {id: 'park',      label: 'Park',      layer: 'trees',  types: AREA, variants: WOOD,
     walk: 1, stamp: 5, gen: park,      swatch: '#7BB86F'},
    {id: 'road',      label: 'Road',      layer: 'roads',  types: ['line', 'ring'],
     walk: 2, stamp: 6, gen: road,      swatch: '#FFFFFF',
     bright0: 1.3, feather0: 0, pad0: 1.2, padFade0: 0.8, padBreak0: 0.3,
     connects: true},
    {id: 'buildings', label: 'Buildings', layer: 'built',  types: AREA,
     variants: ['mixed', 'towers', 'blocks', 'sheds'],
     walk: 0, stamp: 1, gen: buildings, swatch: '#B7B0A5'},
    {id: 'houses',    label: 'Houses',    layer: 'built',  types: AREA,
     variants: ['mixed', 'detached', 'terraced'],
     walk: 0, stamp: 2, gen: houses,    swatch: '#C9A488'}
  ];
  /* what the palette offers: a kind plus the shape it starts as, so a
     roundabout is one chip rather than a mode you have to know about */
  const PALETTE = [
    {label: 'Grass',      kind: 'grass',     type: 'ellipse'},
    {label: 'Water',      kind: 'water',     type: 'ellipse'},
    {label: 'Creek',      kind: 'creek',     type: 'line'},
    {label: 'Trees',      kind: 'trees',     type: 'ellipse'},
    {label: 'Park',       kind: 'park',      type: 'rect'},
    {label: 'Road',       kind: 'road',      type: 'line'},
    {label: 'Roundabout', kind: 'road',      type: 'ring'},
    {label: 'Buildings',  kind: 'buildings', type: 'rect'},
    {label: 'Houses',     kind: 'houses',    type: 'rect'}
  ];

  /* ── the floor registry ────────────────────────────────────────────────
     The same four columns as the map's, because it is the same editor:
     layers, kinds, what each accepts as a shape, and what it means to the
     walker. Walls sit at the top on their own for the reason roads do —
     indoors the walls are the thing everything else is arranged around.

     Stamping order is what makes a plan behave. The floor goes down first
     and carries you; furniture and walls are laid over it and stop you; the
     door goes down last, which is what opens the wall it crosses. */
  const FLAYERS = [
    {id: 'walls',  label: 'Walls',    z: 2, solo: true, start: true},
    {id: 'floor',  label: 'Floor',    z: 0},
    {id: 'fixt',   label: 'Fittings', z: 1},
    {id: 'access', label: 'Access',   z: 3}
  ];
  const HARD = {feather0: 0, pad0: 0, padFade0: 0, padBreak0: 0};   // architecture has edges
  const FLIST = [
    {id: 'floor',   label: 'Floor',   layer: 'floor',  types: AREA,
     variants: ['boards', 'tile', 'flags'], w0: 9, h0: 7,
     walk: 2, stamp: 1, gen: floor,    swatch: '#9A7A52', ...HARD},
    {id: 'rug',     label: 'Rug',     layer: 'floor',  types: AREA,
     variants: ['plain', 'stripe', 'medallion'], w0: 4, h0: 3,
     walk: 2, stamp: 2, gen: rug,      swatch: '#94383F', ...HARD},
    {id: 'pool',    label: 'Water',   layer: 'floor',  types: AREA, w0: 3, h0: 2,
     walk: 0, stamp: 3, gen: water,    swatch: '#2E66B8', ...HARD},
    {id: 'counter', label: 'Counter', layer: 'fixt',   types: AREA,
     variants: ['counter', 'island', 'bench'], w0: 5, h0: 1,
     walk: 0, stamp: 4, gen: counter,  swatch: '#A9ABAF', ...HARD},
    {id: 'table',   label: 'Table',   layer: 'fixt',   types: AREA,
     variants: ['dining', 'desk', 'round'], w0: 5, h0: 4,
     walk: 0, stamp: 4, gen: table,    swatch: '#8A6438', ...HARD},
    {id: 'bed',     label: 'Bed',     layer: 'fixt',   types: AREA,
     variants: ['single', 'double'], w0: 3, h0: 4,
     walk: 0, stamp: 4, gen: bed,      swatch: '#DDDAD3', ...HARD},
    {id: 'sofa',    label: 'Sofa',    layer: 'fixt',   types: AREA,
     variants: ['sofa', 'armchair'], w0: 4, h0: 2,
     walk: 0, stamp: 4, gen: sofa,     swatch: '#52638A', ...HARD},
    {id: 'shelf',   label: 'Shelf',   layer: 'fixt',   types: AREA,
     variants: ['books', 'store', 'wardrobe'], w0: 4, h0: 1,
     walk: 0, stamp: 4, gen: shelf,    swatch: '#7F5C3C', ...HARD},
    {id: 'plant',   label: 'Plant',   layer: 'fixt',   types: AREA, w0: 1, h0: 1,
     walk: 0, stamp: 4, gen: plant,    swatch: '#3E7A3A', ...HARD},
    /* walls run into one another the way roads do, so a corner is a corner
       and not two walls with a hole punched where they meet */
    {id: 'wall',    label: 'Wall',    layer: 'walls',  types: ['line', 'rect', 'ellipse', 'ring'],
     variants: ['plaster', 'brick', 'timber'], w0: 9, h0: 7, len0: 8,
     walk: 0, stamp: 5, gen: wall,     swatch: '#E4E0D5', connects: true, hollow: true, ...HARD},
    {id: 'glazing', label: 'Window',  layer: 'walls',  types: ['line', 'rect', 'ellipse', 'ring'],
     w0: 4, h0: 3, len0: 4,
     walk: 0, stamp: 5, gen: glazing,  swatch: '#85C7DB', connects: true, hollow: true, ...HARD},
    /* A door reaches a whole tile either side when it opens the walk grid.
       Everything here snaps to tile centres and a wall's own band is half a
       tile thick, so a door dropped a tile off the wall is a door that looks
       right and does nothing — and a silently shut door is a much worse
       failure than a doorway one tile deep. */
    /* A door takes the wall out where it stands, the way the demolisher
       does — it is a hole with a leaf drawn in it, not a panel laid over
       one. `clears` keeps that appetite to walls and glazing, so a door
       across a rug takes the wall and leaves the rug; and a cell of margin
       means it still opens the whole wall when it is dropped a cell off the
       line, which at this resolution is most of the time. */
    {id: 'door',    label: 'Door',    layer: 'access', types: ['line'],
     variants: ['swing', 'double', 'slide', 'open'], len0: 2, walkTol: 1.05,
     walk: 2, stamp: 6, gen: door,     swatch: '#F2EDE2',
     clears: ['wall', 'glazing'], ...HARD, pad0: 1},
    /* ── the demolisher ────────────────────────────────────────────────
       Not terrain and not furniture: a hole in what a wall is allowed to be.
       It draws nothing, stamps nothing, and takes ground only from the kinds
       it names — so dragged across a room it removes the wall and leaves the
       bed, the rug and the floor exactly where they were, and what you are
       left with is two rooms that run into each other.

       It has to be a shape rather than an edit to the wall because a wall is
       one rect with four sides, and "this stretch of it is not there" is not
       something a rect can say about itself. */
    {id: 'gap',     label: 'Remove wall', layer: 'access', types: AREA,
     w0: 4, h0: 4, walk: 1, stamp: 9, gen: nothing, swatch: '#3A3A44',
     clears: ['wall', 'glazing'], cuts: true, ...HARD},
    {id: 'stairs',  label: 'Stairs',  layer: 'access', types: AREA, variants: ['up', 'down'],
     w0: 2, h0: 5,
     walk: 2, stamp: 6, gen: stairs,   swatch: '#C39A5C', ...HARD}
  ];
  const FPALETTE = [
    {label: 'Wall',    kind: 'wall',    type: 'line'},
    {label: 'Room',    kind: 'wall',    type: 'rect'},
    {label: 'Window',  kind: 'glazing', type: 'line'},
    {label: 'Floor',   kind: 'floor',   type: 'rect'},
    {label: 'Rug',     kind: 'rug',     type: 'rect'},
    {label: 'Water',   kind: 'pool',    type: 'ellipse'},
    {label: 'Counter', kind: 'counter', type: 'rect'},
    {label: 'Table',   kind: 'table',   type: 'rect'},
    {label: 'Bed',     kind: 'bed',     type: 'rect'},
    {label: 'Sofa',    kind: 'sofa',    type: 'rect'},
    {label: 'Shelf',   kind: 'shelf',   type: 'rect'},
    {label: 'Plant',   kind: 'plant',   type: 'ellipse'},
    {label: 'Door',    kind: 'door',    type: 'line'},
    {label: 'Stairs',  kind: 'stairs',  type: 'rect'}
  ];
  const SHAPES = [{id: 'rect', label: 'Rect'}, {id: 'ellipse', label: 'Oval'},
                  {id: 'line', label: 'Line'}, {id: 'ring', label: 'Ring'}];

  /* ── two registries, one editor ────────────────────────────────────────
     Everything downstream — the palette, the layer rows, the walk-grid
     stamp, saving — reads `Kinds.list`, `Kinds.by`, `Kinds.layers` and
     `Kinds.palette` and never learns which set it is looking at. Going
     inside a building swaps the registry and the storage key under it; the
     editor is not told, because there is nothing it would do differently. */
  const index = list => { const by = {}; for (const k of list) by[k.id] = k; return by; };
  const REG = {
    map:   {list: LIST,  by: index(LIST),  layers: LAYERS,  palette: PALETTE},
    floor: {list: FLIST, by: index(FLIST), layers: FLAYERS, palette: FPALETTE}
  };
  let scope = 'map';

  /* one shape → its instances, detached from the growable backing store */
  function build(s, cell, occ){
    const k = REG[scope].by[s.kind];
    /* diamonds grow with the grain so a coarser sample still covers, and
       Scale is the "font size" on top of that */
    const buf = new Buf(s.bright, (s.scale || 1) * Math.max(1, Math.round(s.grain || 1)));
    s._occ = occ && occ.length ? occ : null;
    if (k) k.gen(s, cell, buf);
    s._occ = null;
    return buf.view().slice();
  }

  const api = {geo, build, hash, vnoise, MAX_CELLS, hollow, shapes: SHAPES,
               use: v => { if (REG[v]) scope = v; }, scope: () => scope};
  for (const f of ['list', 'by', 'layers', 'palette'])
    Object.defineProperty(api, f, {get: () => REG[scope][f]});
  return api;
})();
