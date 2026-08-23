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
      if (s.rot){
        const c = Math.abs(Math.cos(s.rot)), sn = Math.abs(Math.sin(s.rot));
        return [s.x - (hw * c + hh * sn), s.y - (hw * sn + hh * c),
                s.x + (hw * c + hh * sn), s.y + (hw * sn + hh * c)];
      }
      return [s.x - hw, s.y - hh, s.x + hw, s.y + hh];
    },
    /* a point in the shape's own frame, with any rotation taken back out */
    local(s, x, y){
      const dx = x - s.x, dy = y - s.y;
      if (!s.rot) return [dx, dy];
      const c = Math.cos(-s.rot), sn = Math.sin(-s.rot);
      return [dx * c - dy * sn, dx * sn + dy * c];
    },
    /* how deep inside the shape a point sits, in world units. <= 0 is out.
       Kinds use it for borders: kerbs, shorelines, the fence of a park. */
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
      if (s.type === 'ellipse'){
        const u = l[0] / (s.w / 2 || 1), v = l[1] / (s.h / 2 || 1);
        return (1 - Math.hypot(u, v)) * Math.min(s.w, s.h) / 2;
      }
      return Math.min(s.w / 2 - Math.abs(l[0]), s.h / 2 - Math.abs(l[1]));
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
    door:    [0.30, 0.22, 0.20]
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
    const mod = (a, b) => ((a % b) + b) % b;
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

  /* ── the registry ────────────────────────────────────────────────────── */
  /* listed in the order you work through a plan, but drawn by `z`: the
     road network reads on top of everything, the way it does on the
     printed map, so a block of housing can never bury the route through it */
  const LAYERS = [
    {id: 'roads',  label: 'Roads',     z: 3, solo: true},
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
  const BY = {};
  for (const k of LIST) BY[k.id] = k;

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
  const SHAPES = [{id: 'rect', label: 'Rect'}, {id: 'ellipse', label: 'Oval'},
                  {id: 'line', label: 'Line'}, {id: 'ring', label: 'Ring'}];

  /* one shape → its instances, detached from the growable backing store */
  function build(s, cell, occ){
    const k = BY[s.kind];
    /* diamonds grow with the grain so a coarser sample still covers, and
       Scale is the "font size" on top of that */
    const buf = new Buf(s.bright, (s.scale || 1) * Math.max(1, Math.round(s.grain || 1)));
    s._occ = occ && occ.length ? occ : null;
    if (k) k.gen(s, cell, buf);
    s._occ = null;
    return buf.view().slice();
  }

  return {list: LIST, by: BY, layers: LAYERS, palette: PALETTE, shapes: SHAPES,
          geo, build, hash, vnoise, MAX_CELLS};
})();
