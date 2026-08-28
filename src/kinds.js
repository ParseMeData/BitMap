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
  /* ── a stream is one curve through its points ────────────────────────
     A road is straight between its points unless you bow a segment by
     hand, and that is right for a road: it is built in lengths. Water is
     not. A creek with three points that turns a hard corner at the middle
     one is a pipe, and bowing each length by hand to hide the corner is
     work the water should be doing. So a `smooth` kind ignores its bows
     and runs a Catmull-Rom spline through every point instead: put a
     point down and the whole run bends to pass through it, pull it and
     the bend follows. The ends stay where they were put — the anchors —
     and the curve arrives at them along its last leg. */
  const smooth = s => s.type === 'line' && s.pts.length >= 3
    && !!(REG[scope].by[s.kind] || {}).smooth;
  function spline(s, i, t){
    const P = s.pts, n = P.length - 1;
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[Math.min(n, i + 1)], p3 = P[Math.min(n, i + 2)];
    const t2 = t * t, t3 = t2 * t;
    const f = k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t
                 + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2
                 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
    return [f(0), f(1)];
  }
  /* the point a fraction `t` along segment `i`, however that segment is
     drawn: on the spline for a smooth kind, on the bow for a bowed
     segment, on the straight otherwise. What the grips are placed by. */
  function along(s, i, t){
    if (smooth(s)) return spline(s, i, t);
    const a = s.pts[i], b = s.pts[i + 1], c = s.ctrl && s.ctrl[i], u = 1 - t;
    if (!c) return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
            u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
  }
  /* ── a warp is an oval that stopped being one ───────────────────────
     A closed run of points in the shape's own frame — like `quad`, so
     `rot` still turns it and `x`/`y` still move it — with a Catmull-Rom
     through all of them, wrapping, so the last leg bends into the first.
     Born as eight points on the oval it replaces and pulled into whatever
     the ground actually does. Flattened once and cached like a line's
     bows; everything downstream measures the polygon. */
  function blobAt(s, i, t){
    const P = s.blob, n = P.length;
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    const t2 = t * t, t3 = t2 * t;
    const f = k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t
                 + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2
                 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
    return [f(0), f(1)];
  }
  function blobFlat(s){
    if (s._flat) return s._flat;
    const out = [];
    for (let i = 0; i < s.blob.length; i++)
      for (let k = 0; k < FLAT; k++) out.push(blobAt(s, i, k / FLAT));
    s._flat = out;
    return out;
  }
  function flatten(s){
    if (s._flat) return s._flat;
    const out = [s.pts[0]];
    const sm = smooth(s);
    for (let i = 0; i < s.pts.length - 1; i++){
      const a = s.pts[i], b = s.pts[i + 1], c = s.ctrl && s.ctrl[i];
      if (!sm && !c){ out.push(b); continue; }
      for (let k = 1; k <= FLAT; k++) out.push(along(s, i, k / FLAT));
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

  /* ── a rect that stopped being one ─────────────────────────────────────
     An area is described by a centre and a size, which is four corners you
     are not allowed to move independently. `quad` is those four corners
     said outright — nw, ne, se, sw, in the shape's OWN frame, so `rot`
     still turns it, `x`/`y` still move it, and everything that reads a
     shape's local coordinates goes on working without being told.

     `w`/`h` are kept as the quad's own bounding box rather than left
     stale, because they are what the size slider, the cell scan and every
     bbox test read. The quad is the truth; w and h are its shadow. */
  const box4 = s => { const hw = s.w / 2, hh = s.h / 2;
    return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]; };
  const corners = s => (s.quad && s.quad.length === 4) ? s.quad : box4(s);
  /* signed distance to a four-sided polygon: positive inside, and in the
     same world units geo.depth() answers in everywhere else, so a feather
     measured in cells means the same thing on a dragged quad as on a rect */
  function polyDepth(q, x, y){
    let best = Infinity, inside = false;
    for (let i = 0, j = q.length - 1; i < q.length; j = i++){
      const a = q[j], b = q[i];
      best = Math.min(best, segDist(x, y, a, b));
      if ((a[1] > y) !== (b[1] > y) &&
          x < (b[0] - a[0]) * (y - a[1]) / ((b[1] - a[1]) || 1e-9) + a[0]) inside = !inside;
    }
    return inside ? best : -best;
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

  const geo = {along, smooth, blobAt, blobFlat, 
    flat: flatten,
    corners,
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
      if (s.type === 'warp' && s.blob){
        const c = Math.cos(s.rot || 0), sn = Math.sin(s.rot || 0);
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const q of blobFlat(s)){
          const wx = s.x + q[0] * c - q[1] * sn, wy = s.y + q[0] * sn + q[1] * c;
          x0 = Math.min(x0, wx); y0 = Math.min(y0, wy);
          x1 = Math.max(x1, wx); y1 = Math.max(y1, wy);
        }
        const e = hollow(s) ? (s.width || 0) / 2 : 0;
        return [x0 - e, y0 - e, x1 + e, y1 + e];
      }
      if (s.quad){
        const c = Math.cos(s.rot || 0), sn = Math.sin(s.rot || 0);
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const q of s.quad){
          const wx = s.x + q[0] * c - q[1] * sn, wy = s.y + q[0] * sn + q[1] * c;
          x0 = Math.min(x0, wx); y0 = Math.min(y0, wy);
          x1 = Math.max(x1, wx); y1 = Math.max(y1, wy);
        }
        return [x0, y0, x1, y1];
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
      if (s.quad){
        d = polyDepth(s.quad, l[0], l[1]);
      } else if (s.type === 'warp' && s.blob){
        d = polyDepth(blobFlat(s), l[0], l[1]);
      } else if (s.type === 'ellipse'){
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
    /* ── which way the damage falls ──────────────────────────────────
       An area's own Feather ramps its bite down at every rim at once, which
       is a bruise: heaviest in the middle, gone all round. `fall` is the
       other thing you want from a demolisher — the ruin heaviest along one
       edge and the ground untouched along the opposite one, so a district
       can be eaten into from the side it is being eaten from.

       Measured along the axis joining the midpoints of the west and east
       edges, which for a rect is simply its local x and for a dragged quad
       leans with the corners. It is in the shape's own frame, so the
       rotate grip aims it: turn the area and the fall turns with it, and a
       half-turn is how you demolish from the other side.

       0 keeps every area that has ever been saved behaving exactly as it
       did — uniform, one weight everywhere — and 1 is the full ramp. */
    fall(s, x, y){
      const f = s.fall > 0 ? (s.fall > 1 ? 1 : s.fall) : 0;
      if (!f) return 1;
      const A = s.aim;
      if (A && (A[0] || A[1])){
        /* ── aimed by the marker ────────────────────────────────────────
           `aim` is where the marker sits, in a square that is the shape
           whatever its proportions: -1 to 1 on each side, so the same
           marker means the same fall on a long thin area and on a squat
           one, and it survives the shape being resized.

           The marker sits on the side that is KEPT, and the damage falls
           away from it — which is what makes the control read the way it
           does under the hand: you are not aiming the damage, you are
           holding down the corner you want left alone, and everything
           opposite it gives way. Its distance from the middle is how
           hard: dead centre is no direction at all and the area bites at
           one weight everywhere, which is `even`.

           Measured from the marker's own line to the far corner of the
           square, so the whole of the shape is spent whichever way the
           marker points — a diagonal has further to run than a side, and
           this is what stops it fading out early because of it. */
        const l = geo.local(s, x, y);
        const px = l[0] / Math.max(s.w / 2, 1e-6), py = l[1] / Math.max(s.h / 2, 1e-6);
        const L = Math.hypot(A[0], A[1]) || 1;
        const nx = A[0] / L, ny = A[1] / L;
        const t = -(px * nx + py * ny);
        const u = clamp01((t + L) / (Math.abs(nx) + Math.abs(ny) + L));
        return 1 - f * (1 - u);
      }
      const q = corners(s);
      const a = mid(q[0], q[3]), b = mid(q[1], q[2]);
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const L = dx * dx + dy * dy;
      if (!L) return 1;
      const l = geo.local(s, x, y);
      const u = clamp01(((l[0] - a[0]) * dx + (l[1] - a[1]) * dy) / L);
      return 1 - f * (1 - u);
    },
    /* ── what a dragged corner took ──────────────────────────────────
       A quad is described by the rectangle it sits in — `w`/`h` are its
       own extent — so dragging a corner inward leaves a wedge between the
       edge you dragged and the rectangle's corner. That wedge is not a
       part of the shape you decided against: it is the part you cut OFF,
       and it goes outright. It is the only hard edge a demolisher can
       draw, and drawing one is the whole reason the corners move: a rect
       can only end the town along an axis, and a town does not.

       Inside the rectangle, outside the quad. A plain rect has no such
       region — the two are the same shape — so nothing that has never had
       a corner dragged is touched by this. */
    lost(s, x, y){
      if (!s.quad) return false;
      const l = geo.local(s, x, y);
      if (Math.abs(l[0]) > s.w / 2 || Math.abs(l[1]) > s.h / 2) return false;
      return polyDepth(s.quad, l[0], l[1]) <= 0;
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
    /* the plate itself — index.html's --ground and render.js's clearColor,
       kept in step by hand; a cell painted this is a cell that is not there */
    plate:   [0.106, 0.106, 0.129],
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
      /* a print takes only the ground under its ink and its own dark; the
         terrain runs right up to the drawn edge and shows in every gap */
      if ((REG[scope].by[o.kind] || {}).glyphs){
        if (glyphAt(o, x, y) !== '0') return true;
        continue;
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

  /* ── what has been demolished ──────────────────────────────────────────
     A demolish area is the third thing this engine can do to a cell, and it
     is neither of the other two. An occluder TAKES the ground: the cell is
     never drawn, and what was under it is gone while the occluder is there.
     A cut REMOVES ground from the walk grid. A modifier does neither — it
     leaves every cell exactly where it is, owned by exactly the shape that
     owned it, and only changes the answer this file gives when it is asked
     to draw one. Nothing is written back to the shape underneath, which is
     the whole guarantee: take the area away and the next pass reads the
     same stored fields it always read, so the terrain returns byte for byte.

     Overlapping areas do not compound. The deepest bite wins outright,
     because two stacked scatters multiply into a hole, and a hole is the
     one thing demolition here is deliberately not.

     The answer comes back on a scratch record rather than a fresh object,
     because it is asked once per lattice cell of every shape a demolish
     area lies over — up to MAX_CELLS of them in a single pass — and an
     allocation there is a frame's worth of garbage for every drag frame. */
  /* ── how far past the quad the cut-off wedge reaches ───────────────────
     The deepest point outside a convex quad but inside the rectangle it
     sits in is always one of that rectangle's corners, so four distances
     answer it. Cached on the shape the way `_flat` is, and dropped by
     build.js's changed() along with it, because it only moves when the
     corners do. */
  function lostSpan(s){
    if (s._span) return s._span;
    const hw = s.w / 2, hh = s.h / 2;
    let m = 0;
    for (const c of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]])
      m = Math.max(m, -polyDepth(s.quad, c[0], c[1]));
    return (s._span = Math.max(m, 1e-6));
  }

  /* ── how far out of a boundary a point is ──────────────────────────────
     0 in the middle, 1 at the rim, past 1 outside it. Normalised on each
     axis separately, so the number means the same thing on a boundary
     stretched along a valley as on a round one, and taken in the shape's
     own frame so the rotate grip turns it with everything else.

     An oval is measured to its own edge and a rectangle to its own, rather
     than both to the ellipse inscribed in the box. A boundary is the line
     the map's detail stops at, and you have to be able to see that line:
     a ramp that finished short of a rect's corners would leave four wedges
     of untouched town standing outside the shape drawn to contain it. */
  function radius(s, x, y){
    const l = geo.local(s, x, y);
    const a = Math.abs(l[0]) / Math.max(s.w / 2, 1e-6);
    const b = Math.abs(l[1]) / Math.max(s.h / 2, 1e-6);
    return s.type === 'ellipse' ? Math.hypot(a, b) : Math.max(a, b);
  }

  const RUIN = {m: null, w: 0, lost: 0, lseed: 0};
  function bitten(mods, x, y, cell){
    RUIN.m = null; RUIN.w = 0; RUIN.lost = 0; RUIN.lseed = 0;
    for (let i = 0; i < mods.length; i++){
      const m = mods[i];
      /* the area's own Feather, read by the same arithmetic scan() reads a
         shape's own with: depth in cells over feather in cells, clamped. It
         ramps the damage down to nothing at the rim, which is what stops the
         ruin being a stamped-out circle with untouched terrain hard against
         it. A Feather of zero says hard-edged, exactly as it does anywhere
         else in this file. */
      const f = Math.max(0, m.feather || 0);
      let w, lost = 0;
      /* asked of the KIND and not of the shape: `radial` is what a boundary
         IS, not something one was saved carrying, so a town written before
         this existed reads back with every boundary still radial and there
         is no field to migrate */
      if ((REG[scope].by[m.kind] || {}).radial){
        /* ── a boundary is a demolisher pointed outwards ─────────────────
           Same third verb, same two operations, and the ruin arrives
           through the same arithmetic below. What differs is only where it
           is measured from: a demolish area's damage comes from one SIDE
           and Feather keeps it off every rim, so the strongest bite is in
           the middle. A boundary's comes from the MIDDLE, and the rim is
           where the bite is total — which is Feather turned inside out, so
           Feather is not read here at all.

           `core` is the heart it holds off: everything inside that
           fraction of the radius is the town exactly as it was drawn, and
           the ramp is spread across whatever is left between there and the
           rim. So the middle is untouched, and the further out you go the
           harder the ground goes, which is the tool said in one line.

           Past the rim it is not a ramp at all: the ground is gone
           outright, whatever Out is set to. That is the difference between
           weathering a district and saying where the map ends — inside the
           shape the town thins, outside it there is no town, and the two
           meet at the outline you can see. This is also why `out0` is 1:
           the ramp has to arrive at the same nothing the outside already
           is, or the rim would be a step. */
        const q = radius(m, x, y);
        if (q >= 1){ w = 1; lost = 1; }
        else {
          const core = clamp01(m.core === undefined ? 0.35 : m.core);
          const t = core >= 1 ? 0 : clamp01((q - core) / (1 - core));
          if (t <= 0) continue;                  // still the untouched heart
          w = t;
        }
      } else if (m.quad){
        /* ── a quad has two boundaries, and they do different jobs ────────
           The RECTANGLE is the rim: it is where the tool's influence ends,
           and Feather tapers the whole ruin — the wedge included — as it
           approaches it, exactly as it does for any other area.

           The quad edge is not a rim at all. It is the line where thinning
           turns into going, and it sits in the MIDDLE of what the tool is
           doing. Feathering it was what made a dragged corner read as a
           slice: the ruin was tapering back to untouched ground on one side
           of the line while everything on the other side was gone. Taking
           the rim off it is most of what makes the cut dissolve instead. */
        const l = geo.local(m, x, y);
        const rim = Math.min(m.w / 2 - Math.abs(l[0]), m.h / 2 - Math.abs(l[1]));
        if (rim <= 0) continue;
        const fr = f > 0 ? clamp01(rim / cell / f) : 1;
        const d = polyDepth(m.quad, l[0], l[1]);
        if (d > 0){
          w = fr * geo.fall(m, x, y);
        } else {
          /* ── the wedge the corner cut off ──────────────────────────────
             Not a stamp. It goes the way the end of a fall goes: nothing
             taken at the line itself, everything taken by the far side,
             and the same smoothstep in between — so what the corner does
             is spend the ground out rather than cut it off, in the units
             the rest of the area is already spending it in.

             Measured against the wedge's own depth, so the fade is spread
             across the whole of whatever was cut off: a corner pulled a
             long way in fades over a long way, a small nick fades over a
             small one. It arrives at nothing three quarters of the way,
             for the reason Out does — a ramp still finishing at the far
             corner leaves a fringe of survivors along it, and a fringe is
             a border.

             Then the rim taper on top, so the erased ground fades back to
             terrain at the tool's own edge instead of ending on the
             rectangle. There is no edge left anywhere: not the diagonal,
             not the rectangle, not the tip. */
          const g = clamp01(-d / (lostSpan(m) * 0.75));
          lost = g * g * (3 - 2 * g) * fr;
          /* and the survivors are at the ruin's full strength, because
             this ground is going rather than thinning */
          w = fr;
        }
      } else {
        const d = geo.depth(m, x, y);
        if (d <= 0) continue;
        /* the rim ramp and the directional one are the same weight arrived
           at two ways, so they multiply rather than compete: Feather keeps
           the ruin off its own edges, and Fall decides which of those edges
           the damage was coming from. */
        w = (f > 0 ? clamp01(d / cell / f) : 1) * geo.fall(m, x, y);
      }
      if (w > RUIN.w){ RUIN.w = w; RUIN.m = m; }
      /* a cell one area has spent out is spent, whatever another makes of
         it — this is the one thing that does not average */
      if (lost > RUIN.lost){ RUIN.lost = lost; RUIN.lseed = m.seed | 0; }
    }
    return RUIN.m !== null;
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
    /* The demolish areas lying over this shape, hung on it for the duration
       of its generator exactly the way its occluders are — so every kind
       written against scan() gets them without being handed a second list,
       and a kind that never heard of demolition still weathers. */
    const mods = s._mod;
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
        /* ── the same two operations, asked for by somebody else ─────────
           A demolish area drives Scatter and Jitter through the arithmetic
           immediately above, with its OWN slider values and its own weight,
           so the two words mean one thing in this file rather than two.
           What differs is only the salt, because the ruin has to be a
           different draw from the terrain's own break-up or the two would
           agree cell for cell and the damage would be invisible.

           Keyed on the TARGET's (u, v), so the rubble belongs to the ground
           it is made of and holds still while the area is dragged across it
           — world coordinates would re-roll it under your hand. Keyed on the
           AREA's seed, so two areas over the same ground break it up
           differently. */
        /* ── how the ruin arrives, rather than how much of it there is ──
           Taken straight, the weight reads as a wedge: the damage starts at
           a line you can see and deepens evenly, which looks like a ramp
           laid over the ground instead of ground coming apart. Two things
           fix that, and they are both about the END of the fall rather than
           its middle.

           Smoothstep first, so the weight leaves the untouched side flat
           and arrives flat — there is no edge to the damage at either end,
           only ground that is gradually more broken.

           Then jitter runs ahead of scatter: it carries the same curve but
           reaches twice as far by the far end, so the last diamonds still
           standing are also the ones thrown furthest off their seats. That
           is what makes the tail dissolve rather than stop — the field
           thins and loosens at once, and there is no last row of neatly
           seated diamonds to mark where the area finished. */
        let rjit = 0, rscat = 0, rseed = 0, rgone = 0;
        if (mods && bitten(mods, wx, wy, cell)){
          /* what the dragged corner spent, on its own salt so shaping the
             quad does not re-draw the rubble the fall already made */
          if (RUIN.lost > 0 && hash(u, v, RUIN.lseed + 667) < RUIN.lost) continue;
          const w = RUIN.w, e = w * w * (3 - 2 * w);
          const out = clamp(RUIN.m.out || 0, 0, 1);
          rseed = RUIN.m.seed | 0;
          /* ── what the fall ends AT ──────────────────────────────────────
             Scatter cannot answer this on its own, and deliberately: its
             removal is held to 55% of the roll however far it is pushed,
             because a scatter that could empty a cell outright is a hole,
             and a hole is the one thing demolition here is not.

             The end of a fall is the one place a hole IS the point — past
             it there is no more shape, so there is nothing for bare plate
             to read as a mistake against. Out is that, and only that: how
             completely the far end has gone. At 0 the fall ends at whatever
             Scatter and Jitter make of it, which is broken ground. Turned
             up, the last stretch goes out entirely, and where that stretch
             begins is what the slider moves — 1 - out in weight, so at full
             the whole fall is spending itself and at a third only the last
             of it does.

             Squared off at three quarters of that stretch rather than at
             its end, so the tail arrives at nothing BEFORE the rim and
             holds there. A ramp that only reaches nothing in its final row
             leaves one thinning fringe of diamonds along the edge, which
             is a border, and a border is what a demolisher must not draw.

             Everything else the word implies is here too, because a field
             that only dropped cells would thin evenly and read as a
             different density rather than as an ending: what survives
             scatters harder, throws further, and dims on the way out. */
          const t = out > 0 ? clamp01((e - (1 - out)) / out) : 0;
          rgone = t > 0 ? Math.pow(clamp01(t / 0.75), 1.5) : 0;
          rscat = clamp((RUIN.m.scatter || 0) * e + out * e * e * 0.6, 0, 1);
          rjit = Math.max(0, RUIN.m.jitter || 0) * e * (1 + e) * (1 + out * e);
          if (t > 0) fade *= 1 - 0.75 * t;
        }
        /* the roll that can actually reach one, kept on its own salt so
           turning Out up does not re-draw the rubble Scatter already made */
        if (rgone > 0 && hash(u, v, rseed + 665) < rgone) continue;
        if (rscat > 0 && hash(u, v, rseed + 663) < rscat * 0.55) continue;
        let px = wx, py = wy;
        if (jit > 0 || scat > 0){
          const spread = (jit + scat * 1.6) * cell * grain;
          px += (hash(u, v, s.seed + 771) - 0.5) * spread;
          py += (hash(u, v, s.seed + 772) - 0.5) * spread;
        }
        if (rjit > 0 || rscat > 0){
          const spread = (rjit + rscat * 1.6) * cell * grain;
          px += (hash(u, v, rseed + 661) - 0.5) * spread;
          py += (hash(u, v, rseed + 662) - 0.5) * spread;
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
      rot: s.rot, _occ: s._occ, _mod: s._mod});

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
  /* ── the other grounds ─────────────────────────────────────────────
     Grass with the green taken out and something else put in. Every one
     of these is the same field — near every cell filled, a little wider
     than its cell so it knits — because ground cover is ground cover,
     and what tells rock from mud at a glance is not the pattern but the
     note: colour, how much it varies, how coarse the variation is, and
     the one habit each has (cement cracks on a grid, sand ripples, mud
     puddles, scrub tufts). Held to the plate's register like everything
     else: a desert is ochre in the dark, not a beach at noon. */
  const GROUNDS = {
    rock:   {base: [0.40, 0.40, 0.45], hi: [0.60, 0.60, 0.65], dens: 0.92, coarse: 0.10, fine: 0.9,  vary: 0.6, sz: 1.00},
    cement: {base: [0.52, 0.52, 0.52], hi: [0.64, 0.64, 0.62], dens: 0.98, coarse: 0.05, fine: 0.4,  vary: 0.2, sz: 1.02, slab: 8},
    dirt:   {base: [0.40, 0.30, 0.20], hi: [0.56, 0.43, 0.29], dens: 0.92, coarse: 0.14, fine: 0.7,  vary: 0.5, sz: 0.98},
    desert: {base: [0.68, 0.56, 0.36], hi: [0.84, 0.72, 0.48], dens: 0.88, coarse: 0.06, fine: 0.5,  vary: 0.4, sz: 0.96, ripple: 0.22},
    gravel: {base: [0.46, 0.45, 0.42], hi: [0.66, 0.64, 0.60], dens: 0.84, coarse: 0.30, fine: 1.4,  vary: 0.8, sz: 0.88},
    mud:    {base: [0.30, 0.24, 0.17], hi: [0.42, 0.34, 0.25], dens: 0.97, coarse: 0.10, fine: 0.5,  vary: 0.4, sz: 1.04, puddle: 0.72},
    scrub:  {base: [0.40, 0.42, 0.26], hi: [0.60, 0.62, 0.36], dens: 0.78, coarse: 0.12, fine: 0.9,  vary: 0.6, sz: 0.94, tuft: 0.86},
    snow:   {base: [0.78, 0.80, 0.85], hi: [0.92, 0.93, 0.96], dens: 0.97, coarse: 0.08, fine: 0.3,  vary: 0.15, sz: 1.04}
  };
  function terrain(s, cell, buf){
    const T = GROUNDS[s.kind] || GROUNDS.dirt;
    scan(s, cell, (x, y, u, v, d, fade) => {
      const r = hash(u, v, s.seed);
      if (r > T.dens) return;
      let n = vnoise(u * T.coarse, v * T.coarse, s.seed + 3) * 0.6 +
              vnoise(u * T.fine, v * T.fine, s.seed + 4) * 0.4;
      if (T.ripple) n = n * 0.7 + (0.5 + 0.5 * Math.sin(v * T.ripple + vnoise(u * 0.08, v * 0.08, s.seed + 5) * 4)) * 0.3;
      let col = mixc(shade(T.base, 1 - T.vary / 2 + n * T.vary), T.hi, n * n * 0.5);
      let a = (0.6 + n * 0.3), sz = T.sz * (0.94 + n * 0.12);
      /* the one habit each ground has */
      if (T.slab && (mod(u, T.slab) === 0 || mod(v, T.slab) === 0)){ col = shade(col, 0.72); a *= 0.9; }
      if (T.puddle && n > T.puddle){ col = mixc(col, C.water, 0.35); a = 0.5 + n * 0.3; sz *= 1.1; }
      if (T.tuft && r > T.tuft){ col = mixc(col, C.treeHi, 0.5); sz *= 1.15; }
      buf.cell(x, y, col, a * fade, sz * (0.55 + fade * 0.45), 0,
               (0.48 + n * 0.36) * fade, sz * 1.05, 0,
               0.03 + r * 0.04, hash(u, v, s.seed + 11));
    });
  }

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

  /* ── LINK ──────────────────────────────────────────────────────────────
     The region's road: a line one cell wide between two towns, in the
     kerb's grey rather than the road's white, because it is not a road —
     it is the fact that a road exists, drawn at a scale where the road
     itself would be thinner than a diamond. Walkable, so the walker can
     cross the region on it; a link is the only route the region has. */
  function link(s, cell, buf){
    scan(s, cell, (x, y, u, v, d, fade) => {
      if (hash(u, v, s.seed) > 0.97) return;
      buf.cell(x, y, C.kerb, 0.9 * fade, 0.92, 0, 0.72 * fade, 0.98, 0,
               0.02, hash(u, v, s.seed + 7));
    });
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

  /* ── the landmark ──────────────────────────────────────────────────────
     One named building, drawn from a glyph, where `buildings` draws a whole
     district from a rule. The district generator is the right tool for the
     ground a town is mostly made of, and the wrong one for the six things
     in a town that anybody actually navigates by — the cathedral, the
     station, the pagoda on the hill. Those have a SHAPE, and a rule that
     could produce it would be a rule with one output.

     So the shape is authored, in `assets/`, and sliced offline into a grid
     of lit squares by tools/glyphs.py. What arrives here is that grid, and
     every lit square becomes one diamond — exactly what src/type.js does
     with a letterform, and for exactly the same reason. The sheet is never
     loaded, never blitted, never sampled at run time. There is no sprite on
     the plate at any point, only the same lattice everything else is made
     of, which is what keeps a landmark and the grass it stands on reading
     as one material.

     The glyph is fitted to the shape's own box, so resizing is resampling
     rather than magnification: pull it in and the building is redrawn at
     the coarser pitch, the way the printed map would have drawn it smaller
     in the first place. A cell takes the OR of every glyph square it
     covers rather than the one under its centre, because the alternative
     is that a spire — which is one square wide and the whole reason you
     picked that building — is the first thing to vanish when you shrink it.

     Rect only. A landmark's outline is the glyph; asking an ellipse to clip
     it as well would be two silhouettes fighting over one building. */
  /* which square of a print's glyph a world point falls on: '1' ink, '2'
     the building's own dark, '0' the town around it — and '0' for anything
     off the glyph or not a print at all. Shared by the generator and by
     `covered`, so a print takes exactly the ground it draws on. Its box is
     a frame around the drawing, and a frame takes nothing. */
  function glyphAt(s, x, y){
    const k = REG[scope].by[s.kind];
    if (!k || !k.glyphs || typeof Glyphs === 'undefined') return '0';
    const rows = Glyphs.rows(s.variant) || Glyphs.rows(Glyphs.names[0]);
    if (!rows || !rows.length) return '0';
    const N = rows.length, M = rows[0].length;
    const fit = Math.min((s.w || 1) / M, (s.h || 1) / N);
    const dw = M * fit, dh = N * fit;
    const l = geo.local(s, x, y);
    const gx = Math.floor((l[0] + dw / 2) / dw * M), gy = Math.floor((l[1] + dh / 2) / dh * N);
    return gx >= 0 && gy >= 0 && gx < M && gy < N ? rows[gy][gx] : '0';
  }

  /* ── what a print is built of ───────────────────────────────────────
     One wall colour, its dim, a window and a trim — the four notes the
     generator spends, and the whole of what a tone changes. `stone` is the
     plate's own C.wall set, unchanged, and every other one is held to the
     same register: saturated enough to read as a material at a glance,
     never so much that one building is the only thing on the screen.
     The window stays near-gold in all of them, because a lit window at
     night is one colour whatever the wall is. */
  const TONES = [
    {id: 'stone', label: 'Stone', wall: [0.70, 0.68, 0.63], dim: [0.28, 0.28, 0.33], win: [0.95, 0.82, 0.46], trim: [0.95, 0.76, 0.31]},
    {id: 'brick', label: 'Brick', wall: [0.74, 0.47, 0.38], dim: [0.34, 0.21, 0.19], win: [0.95, 0.82, 0.46], trim: [0.88, 0.62, 0.40]},
    {id: 'slate', label: 'Slate', wall: [0.52, 0.59, 0.68], dim: [0.21, 0.25, 0.32], win: [0.92, 0.80, 0.50], trim: [0.70, 0.76, 0.82]},
    {id: 'moss',  label: 'Moss',  wall: [0.54, 0.64, 0.47], dim: [0.21, 0.29, 0.21], win: [0.93, 0.81, 0.46], trim: [0.74, 0.80, 0.50]},
    {id: 'sand',  label: 'Sand',  wall: [0.82, 0.70, 0.49], dim: [0.37, 0.30, 0.21], win: [0.96, 0.85, 0.54], trim: [0.92, 0.66, 0.34]},
    {id: 'rose',  label: 'Rose',  wall: [0.75, 0.55, 0.58], dim: [0.32, 0.21, 0.26], win: [0.96, 0.84, 0.56], trim: [0.88, 0.62, 0.60]}
  ];
  const TONE = {}; for (const t of TONES) TONE[t.id] = t;

  function landmark(s, cell, buf){
    if (typeof Glyphs === 'undefined') return;
    const T = TONE[s.tone] || TONE.stone;
    const rows = Glyphs.rows(s.variant) || Glyphs.rows(Glyphs.names[0]);
    if (!rows || !rows.length) return;
    const N = rows.length, M = rows[0].length;
    const lit = (gx, gy) => gx >= 0 && gy >= 0 && gx < M && gy < N && rows[gy][gx] === '1';
    /* '2' is the building's own ground: a window, a doorway, the plinth the
       slicer grows around every silhouette. Drawn as dark cover so the grass
       does not show through the building, and never as a lit square. */
    const own = (gx, gy) => gx >= 0 && gy >= 0 && gx < M && gy < N && rows[gy][gx] === '2';
    /* ── the glyph keeps its proportions ─────────────────────────────────
       A glyph is stored at whatever size it was drawn — twelve by fourteen,
       nine by twenty — so mapping it straight onto the shape's box would
       stretch a bell tower into a bunker the moment you dragged the box
       wider than it is tall. Instead the largest rectangle of the glyph's
       own aspect is fitted inside the box and centred, and the rest of the
       box draws nothing.

       That makes the box a frame you size rather than a shape you deform,
       which is also what makes the corner grips behave: drag any of them
       and the building grows or shrinks, and never distorts. */
    const fit = Math.min((s.w || 1) / M, (s.h || 1) / N);
    const dw = M * fit, dh = N * fit;
    const stepx = cell / dw * M, stepy = cell / dh * N;
    scan(s, cell, (x, y, u, v, d, fade) => {
      const l = geo.local(s, x, y);
      const fx = (l[0] + dw / 2) / dw * M, fy = (l[1] + dh / 2) / dh * N;
      const gx0 = Math.floor(fx), gy0 = Math.floor(fy);
      /* ── a cell reads one pixel, unless it covers more than one ────────
         Taking the OR of every glyph pixel a cell's footprint touches is
         what keeps a spire alive when a landmark is shrunk. It is the
         wrong thing to do at one cell per pixel, which is where a landmark
         now starts: there the footprint straddles two columns about half
         the time, and OR-ing the pair thickens every stroke and closes
         every one-pixel window. So the widening only switches on once a
         cell genuinely spans more than a pixel. */
      const gx1 = stepx <= 1 ? gx0 : Math.floor(fx + stepx - 1e-9);
      const gy1 = stepy <= 1 ? gy0 : Math.floor(fy + stepy - 1e-9);
      let on = false, open = 0, ground = false;
      for (let gy = gy0; gy <= gy1 && !on; gy++)
        for (let gx = gx0; gx <= gx1; gx++){
          if (lit(gx, gy)){ on = true; break; }
          if (own(gx, gy)) ground = true;
        }
      if (!on){
        if (!ground) return;
        /* the building's own ground, in the plate's own colour: the
           detail inside a building reads as transparent, and only the grass
           that would have shown through it is gone. Opaque, unshaded, and
           oversized so the squares knit into cover with nothing between —
           a grey here read as a plinth, and a plinth was not wanted. */
        buf.cell(x, y, C.plate, fade, 1.18, 0, fade, 1.14, 0, 0, hash(u, v, s.seed + 85));
        return;
      }
      /* how much of the building's own outline this cell sits on. Taken
         from the block's rim rather than from one square, so an edge
         survives being resampled down alongside the thing it edges. */
      if (!lit(gx0 - 1, gy0)) open++;
      if (!lit(gx1 + 1, gy0)) open++;
      if (!lit(gx0, gy0 - 1)) open++;
      if (!lit(gx0, gy1 + 1)) open++;
      const r = hash(u, v, s.seed + 81);
      const roof = !lit(gx0, gy0 - 1);            // nothing above: the lit top edge
      /* ── the halftone ────────────────────────────────────────────────
         A filled glyph stamped solid would be a silhouette, and a
         silhouette is the one thing on this plate that reads as a
         cut-out. So the inside is screened: a checker sets the pitch and
         the noise breaks it up, and what comes out is tone rather than
         ink — the same trick the printed map uses to say "built" without
         saying "black". The rim is left solid, so the building keeps a
         drawn edge and only its body is screened. */
      const screen = (u + v) & 1;
      let col, a, sz;
      /* The warm note is spent sparingly and in that order: a touch of trim
         along the top edge, plain wall down the sides, and a lit window
         only now and then. A landmark that spent it everywhere would come
         out gold, and the plate palette is muted on purpose — the town has
         to read as a printed map at night. The first cut of this screened
         a third of every building in window colour and the result was the
         only thing on the screen, which is exactly what STYLE.md warns a
         saturated kind will do. */
      if (roof){ col = mixc(T.wall, T.trim, 0.16 + r * 0.18); a = 0.92; sz = 1.0; }
      else if (open){ col = shade(T.wall, 0.86 + r * 0.26); a = 0.8 + r * 0.16; sz = 0.96; }
      else if (screen && r > 0.74){ col = mixc(T.win, T.wall, 0.4 + r * 0.3); a = 0.62 + r * 0.26; sz = 0.58; }
      else { col = shade(T.dim, 1.02 + r * 0.34); a = 0.4 + r * 0.22; sz = 0.88; }
      buf.cell(x, y, col, a * fade, sz, 0, a * 0.8 * fade, sz * (screen ? 1.4 : 1.06),
               screen && !open && !roof ? 1 : 0, 0.02 + r * 0.02, hash(u, v, s.seed + 83));
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
    /* No sweep drawn. A plan puts the arc in because a plan cannot move;
       this one can, and a quarter-circle of dots standing there permanently
       is a diagram of a door laid over a door. What is left in the plate is
       the threshold and the two jambs — the parts that are built. */
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
    /* water lies on the ground and under everything else: a creek across
       snow or rock is drawn over it, and the road bridging it over both */
    {id: 'water',  label: 'Water',     z: 0.5},
    {id: 'trees',  label: 'Trees',     z: 1},
    /* the district textures — a field of housing drawn from a rule — and
       the drawn buildings are two layers, because they are two ways of
       saying "built": one is ground cover and one is a thing on it */
    {id: 'terrain', label: 'Terrain',  z: 2},
    {id: 'built',  label: 'Buildings', z: 2}
  ];

  const AREA = ['rect', 'ellipse', 'warp'];
  const WOOD = ['mixed', 'conifer', 'broadleaf'];
  const LIST = [
    {id: 'grass',     label: 'Grass',     layer: 'ground', types: AREA,
     walk: 1, stamp: 3, gen: grass,     swatch: '#5C9648'},
    /* the other grounds: one generator, one recipe each, in GROUNDS */
    {id: 'rock',      label: 'Rock',      layer: 'ground', types: AREA,
     walk: 1, stamp: 3, gen: terrain,   swatch: '#666673'},
    {id: 'cement',    label: 'Cement',    layer: 'ground', types: AREA,
     walk: 1, stamp: 3, gen: terrain,   swatch: '#858585'},
    {id: 'dirt',      label: 'Dirt',      layer: 'ground', types: AREA,
     walk: 1, stamp: 3, gen: terrain,   swatch: '#664D33'},
    {id: 'desert',    label: 'Desert',    layer: 'ground', types: AREA,
     walk: 1, stamp: 3, gen: terrain,   swatch: '#AD8F5C'},
    {id: 'gravel',    label: 'Gravel',    layer: 'ground', types: AREA,
     walk: 1, stamp: 3, gen: terrain,   swatch: '#75736B'},
    {id: 'mud',       label: 'Mud',       layer: 'ground', types: AREA,
     walk: 1, stamp: 3, gen: terrain,   swatch: '#4D3D2B'},
    {id: 'scrub',     label: 'Scrub',     layer: 'ground', types: AREA,
     walk: 1, stamp: 3, gen: terrain,   swatch: '#666B42'},
    {id: 'snow',      label: 'Snow',      layer: 'ground', types: AREA,
     walk: 1, stamp: 3, gen: terrain,   swatch: '#C7CCD9'},
    {id: 'water',     label: 'Water',     layer: 'water',  types: AREA,
     walk: 0, stamp: 0, gen: water,     swatch: '#2E66B8'},
    {id: 'creek',     label: 'Creek',     layer: 'water',  types: ['line', 'ring'],
     walk: 0, stamp: 0.5, gen: creek,    swatch: '#3E7FBF',
     smooth: true,
     feather0: 0.5, pad0: 0.5, padFade0: 0.6, padBreak0: 0.25,
     /* creeks run into one another the way roads do, so a tributary is a
        junction and not two channels with a hole punched where they meet.
        It also means a road crossing a creek clears nothing: the road is
        drawn over it and stamps last, which is exactly a bridge. */
     connects: true},
    /* ── one river, not thirteen creeks ────────────────────────────────
       Drawn out of the same generator as the creek and out of the same
       water, because a river IS a creek here — nothing about what it is
       made of differs, and giving it a second generator would be two
       materials for one substance. What differs is how it is EDITED, and
       that is why it is a kind of its own rather than a variant of creek:
       a variant is a look everywhere else in this file, and a river is not
       a look. Its own id is also what makes it additive — a creek drawn
       before this existed is untouched by it, and the two sit in one town.

       `smooth` is the whole of it: the line is shaped from the inside by
       bending it in as many places as you like. Its ends were once
       `anchored` — grips build mode showed and refused to take — and that
       went, because a mouth you cannot drag to where the water starts is a
       river you have to draw again; the lock is still there in build.js
       for any kind that wants it.

       Born long, and born wide enough to read as a river rather than a
       ditch with the wrong name on it. `connects` for the reason the creek
       has it: a creek running into a river is a confluence rather than two
       channels with a hole punched where they meet, and a road crossing it
       clears nothing and stamps last, which is exactly a bridge. */
    {id: 'river',     label: 'River',     layer: 'water',  types: ['line'],
     /* creek's swatch, not water's, and not one of its own: the swatch is
        the key a kind's terrain is generated around, and a river's terrain
        is generated around exactly creek's. The two chips matching is the
        truth about them — one substance at two scales — and it is what
        keeps them apart from Water's stiller, deeper blue on the same
        layer. */
     walk: 0, stamp: 0.5, gen: creek,    swatch: '#3E7FBF',
     len0: 16, width0: 4, smooth: true,
     feather0: 0.5, pad0: 0.5, padFade0: 0.6, padBreak0: 0.25,
     connects: true},
    {id: 'trees',     label: 'Trees',     layer: 'trees',  types: AREA, variants: WOOD,
     walk: 1, stamp: 4, gen: trees,     swatch: '#2A6640'},
    {id: 'park',      label: 'Park',      layer: 'trees',  types: AREA, variants: WOOD,
     walk: 1, stamp: 5, gen: park,      swatch: '#7BB86F'},
    {id: 'road',      label: 'Road',      layer: 'roads',  types: ['line', 'ring'],
     walk: 2, stamp: 6, gen: road,      swatch: '#FFFFFF',
     bright0: 1.3, feather0: 0, pad0: 1.2, padFade0: 0.8, padBreak0: 0.3,
     connects: true},
    /* relabelled Blocks and Housing when they moved under Terrain, so the
       word Houses is free for the drawn ones; the ids stay, because every
       saved town names its shapes by id */
    {id: 'buildings', label: 'Blocks',    layer: 'terrain', types: AREA,
     variants: ['mixed', 'towers', 'blocks', 'sheds'],
     walk: 0, stamp: 1, gen: buildings, swatch: '#B7B0A5'},
    {id: 'houses',    label: 'Housing',   layer: 'terrain', types: AREA,
     variants: ['mixed', 'detached', 'terraced'],
     walk: 0, stamp: 2, gen: houses,    swatch: '#C9A488'},
    /* one drawn house, from the same sheets and the same generator as the
       landmark; `glyphs` names the set it picks from (see src/glyphs.js) */
    {id: 'house',     label: 'Houses',    layer: 'built',  types: ['rect'],
     glyphs: 'houses', w0: 3, h0: 3, feather0: 0,
     walk: 0, stamp: 0, gen: landmark,  swatch: '#C9A488'},
    /* ── the landmark ──────────────────────────────────────────────────
       `glyphs: true` rather than a `variants` list, and the difference is
       the whole reason the palette grew a new control. A variant is a word
       you can put on a chip — towers, terraced, conifer — and there are
       three of them. A landmark is one of sixty-odd buildings told apart
       by their SHAPE, and sixty words nobody can map back to a shape is a
       worse picker than no picker. So the palette draws each one as its
       own glyph and you choose by sight; this flag is what tells it to.

       The list itself is not written here. It is whatever tools/glyphs.py
       last sliced, read off Glyphs at load — so adding a building to the
       sheet and re-slicing puts it in the palette, and there is no second
       place to remember to update.

       Stamped before the districts (stamp 0) because a landmark is what a
       district is arranged around: the ground it stands on should be the
       thing that loses the argument, not the cathedral. */
    /* Feather is off, where every other area kind starts at four. A feather
       fades a kind out as it approaches the rim of its shape, which is the
       right behaviour when the rim is an arbitrary box drawn around a field
       of grass. Here the rim IS the building's outline, and fading it is
       fading exactly the line that says which building this is. */
    /* w0/h0 are a fallback and nothing more. A landmark is born at one
       lattice cell per drawn pixel, worked out from the glyph itself in
       build.js — these numbers are only what it falls back to if the glyph
       table failed to load, and they are in tiles like every other kind's. */
    /* labelled Buildings on the chip; the id stays `landmark` because every
       saved town names its shapes by id */
    {id: 'landmark',  label: 'Buildings', layer: 'built',  types: ['rect'],
     glyphs: 'landmark', w0: 4, h0: 4, feather0: 0,
     walk: 0, stamp: 0, gen: landmark,  swatch: '#D8D2C6'},
    /* ── the demolish area ─────────────────────────────────────────────
       Not deletion and not occlusion: a MODIFIER, and the engine's third
       verb. `Remove wall` in the floor registry is the wrong model to copy
       from — it declares `cuts` and `clears`, which is to say it takes
       ground away and leaves a hole, and a hole is exactly what nobody
       asked for out here. Everything under a demolish area stays, roads
       included; it comes out weathered instead of removed, and moving the
       area off puts it back untouched because nothing under it was ever
       written to.

       `modifies` is the flag, and it does three separate jobs, all of them
       in build.js: the area is kept out of every occluder list (taking
       ground is deletion by another name), it lays nothing in the walk
       grid (a ruined road is still a road you walk down), and it is
       gathered against every shape whose footprint it meets — by bbox
       rather than by z, since what it acts on is whatever it lies over.

       On the roads layer because a modifier reaches every layer whatever
       its own, so the only thing its layer decides is where you find it and
       what you can have selected beside it — and roads are both the layer
       build mode opens on and the hardest thing it has to weather, which
       makes them the one you want in front of you while dialling it in.

       It draws nothing, so it is born already doing something: Feather at
       the same 4 cells any area is born with, enough Scatter to read as
       broken the moment it lands, and Fall at full — because the damage
       coming from one side is what you almost always want, and dialling it
       back to even is one slider, while never discovering it exists is
       forever. The swatch is the one the floor
       registry's demolisher already carries — the palette gains a chip and
       not a colour, and the two tools that draw nothing look alike. */
    {id: 'demolish',  label: 'Demolish',  layer: 'roads',  types: AREA,
     /* never read: a modifier is skipped where the walk grid is stamped,
        because opening or blocking a tile is the one thing it must not do */
     walk: 1, stamp: 9, gen: nothing,   swatch: '#3A3A44',
     modifies: true, jitter0: 0.35, scatter0: 0.5, fall0: 1,
     pad0: 0, padFade0: 0, padBreak0: 0},
    /* ── the boundary ──────────────────────────────────────────────────
       The same verb as the demolisher and the same machinery under it —
       `modifies` does all three of its jobs here unchanged — turned round
       to answer a different question. A demolish area says *this district
       is coming apart*. A boundary says *the map stops here*: you lay one
       over the whole town, the middle stays exactly as you drew it, and
       everything on the way out to the rim goes progressively harder
       until, at the outline, there is nothing.

       `radial` is the whole difference, and it is read in one place —
       bitten(). It swaps the side the damage comes from for the middle,
       which also puts Feather and Fall out of a job: both are about which
       RIM the bite is kept off, and here the rim is the bite. `core` takes
       their place, and it is the only new number the tool needs.

       It reaches every shape rather than the ones its box happens to meet,
       because half of what a boundary says is about ground it is nowhere
       near: a stand of trees off past the rim is not outside the tool's
       influence, it is outside the map.

       Born big and centred rather than dragged out, because there is
       almost never a second one and it is almost always the plate — see
       framePlate() in build.js. Out at full, so the ramp arrives at the
       same nothing the outside of the shape already is and the rim is not
       a step. The swatch is the aqua both other drawing-nothing tools are
       already outlined in, so the tools that take rather than lay look
       alike in the palette as well as on the plate. */
    {id: 'boundary', label: 'Boundary', layer: 'roads',  types: AREA,
     /* never read: a modifier is skipped where the walk grid is stamped —
        the town outside a boundary is gone from the picture, not from the
        route, and deciding otherwise would strand the walker */
     walk: 1, stamp: 9, gen: nothing,   swatch: '#5FBFC4',
     modifies: true, radial: true, core0: 0.35,
     jitter0: 0.4, scatter0: 0.35, out0: 1,
     feather0: 0, fall0: 0, pad0: 0, padFade0: 0, padBreak0: 0}
  ];
  /* what the palette offers: a kind plus the shape it starts as, so a
     roundabout is one chip rather than a mode you have to know about */
  const PALETTE = [
    {label: 'Grass',      kind: 'grass',     type: 'ellipse'},
    {label: 'Rock',       kind: 'rock',      type: 'ellipse'},
    {label: 'Cement',     kind: 'cement',    type: 'rect'},
    {label: 'Dirt',       kind: 'dirt',      type: 'ellipse'},
    {label: 'Desert',     kind: 'desert',    type: 'ellipse'},
    {label: 'Gravel',     kind: 'gravel',    type: 'ellipse'},
    {label: 'Mud',        kind: 'mud',       type: 'ellipse'},
    {label: 'Scrub',      kind: 'scrub',     type: 'ellipse'},
    {label: 'Snow',       kind: 'snow',      type: 'ellipse'},
    {label: 'Water',      kind: 'water',     type: 'ellipse'},
    {label: 'Creek',      kind: 'creek',     type: 'line'},
    {label: 'River',      kind: 'river',     type: 'line'},
    {label: 'Trees',      kind: 'trees',     type: 'ellipse'},
    {label: 'Park',       kind: 'park',      type: 'rect'},
    {label: 'Road',       kind: 'road',      type: 'line'},
    {label: 'Roundabout', kind: 'road',      type: 'ring'},
    {label: 'Blocks',     kind: 'buildings', type: 'rect'},
    {label: 'Housing',    kind: 'houses',    type: 'rect'},
    {label: 'Houses',     kind: 'house',     type: 'rect'},
    {label: 'Buildings',  kind: 'landmark',  type: 'rect'},
    {label: 'Demolish',   kind: 'demolish',  type: 'rect'},
    /* an oval by default: a town thins out into the country in every
       direction at once, and a rect is the answer you reach for when it
       does not — one chip away on the Shape row */
    {label: 'Boundary',   kind: 'boundary',  type: 'ellipse'}
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
    /* Walls do NOT run into one another the way roads do, although for a
       long time they said they did. What `connects` protects is a kind
       whose appetite reaches PAST its own edge: a road clears a margin
       either side of itself, so two roads that crossed while occluding
       would each punch a hole through the other and a crossroads would come
       out with its middle missing. A wall clears nothing — `pad0` and
       `feather0` are both zero above — so its outer limit in covered() is
       exactly its own edge, and every cell it takes from the wall beneath
       is a cell it lays down again itself, at the same world position on
       the same lattice. Occluding therefore costs a wall nothing, and it
       stops a party wall being emitted twice: rooms pack edge to edge and
       share the whole band, and two draws of alpha a composite to a*(2-a),
       which is why every shared wall read brighter than the rest.

       Glazing is the one kind still named here, and for that argument in
       reverse: glass is deliberately gappy — a quarter of its cells never
       appear at all — so a window that took the wall's ground could not
       fill what it took, and the opening would be a hole through to the
       floor rather than a window in a wall. */
    {id: 'wall',    label: 'Wall',    layer: 'walls',  types: ['line', 'rect', 'ellipse', 'ring'],
     variants: ['plaster', 'brick', 'timber'], w0: 9, h0: 7, len0: 8,
     walk: 0, stamp: 5, gen: wall,     swatch: '#E4E0D5', connects: ['glazing'],
     hollow: true, ...HARD},
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
  /* Warp took Ring's place on the row: an oval you can pull into any
     shape is what a ring was reached for on an area. Ring itself stays,
     last, for the two kinds that are a ring of something — a roundabout
     is a ring of road and a moat is a ring of creek — and is dimmed for
     every other kind. */
  const SHAPES = [{id: 'rect', label: 'Rect'}, {id: 'ellipse', label: 'Oval'},
                  {id: 'warp', label: 'Warp'}, {id: 'line', label: 'Line'},
                  {id: 'ring', label: 'Ring'}];

  /* ── the region registry ───────────────────────────────────────────────
     The third scope, for src/region.js: our region drawn flat with north
     up. The same terrain as the town — every ground, the water, the
     trees — under the same ids, so the generators and the saved shapes
     are the town's; nothing built, because a town on the region is a
     plate, not a picture of one; and in place of roads, links. Modifiers
     are left out with the built kinds: a demolisher on a map of towns
     has nothing to weather. */
  const RLAYERS = [
    {id: 'links',  label: 'Links',     z: 3, solo: true, start: true},
    {id: 'ground', label: 'Ground',    z: 0},
    {id: 'water',  label: 'Water',     z: 0.5},
    {id: 'trees',  label: 'Trees',     z: 1}
  ];
  const RLIST = LIST.filter(k => k.layer === 'ground' || k.layer === 'water' || k.layer === 'trees').concat([
    {id: 'link',      label: 'Link',      layer: 'links',  types: ['line'],
     walk: 2, stamp: 6, gen: link,      swatch: '#85858E', width0: 1,
     bright0: 1.2, feather0: 0, pad0: 0, padFade0: 0, padBreak0: 0,
     connects: true}
  ]);
  const RPALETTE = [{label: 'Link', kind: 'link', type: 'line'}]
    .concat(PALETTE.filter(p => RLIST.some(k => k.id === p.kind)));

  /* ── two registries, one editor ────────────────────────────────────────
     Everything downstream — the palette, the layer rows, the walk-grid
     stamp, saving — reads `Kinds.list`, `Kinds.by`, `Kinds.layers` and
     `Kinds.palette` and never learns which set it is looking at. Going
     inside a building swaps the registry and the storage key under it; the
     editor is not told, because there is nothing it would do differently. */
  const index = list => { const by = {}; for (const k of list) by[k.id] = k; return by; };
  const REG = {
    map:   {list: LIST,  by: index(LIST),  layers: LAYERS,  palette: PALETTE},
    floor: {list: FLIST, by: index(FLIST), layers: FLAYERS, palette: FPALETTE},
    region: {list: RLIST, by: index(RLIST), layers: RLAYERS, palette: RPALETTE}
  };
  let scope = 'map';

  /* one shape → its instances, detached from the growable backing store */
  function build(s, cell, occ, mod){
    const k = REG[scope].by[s.kind];
    /* diamonds grow with the grain so a coarser sample still covers, and
       Scale is the "font size" on top of that */
    const buf = new Buf(s.bright, (s.scale || 1) * Math.max(1, Math.round(s.grain || 1)));
    s._occ = occ && occ.length ? occ : null;
    /* The same lifetime as the occluders and for the same reason: it exists
       while this shape is being generated and nowhere else. Nothing about
       the demolition is ever a stored field of the shape it weathers. */
    s._mod = mod && mod.length ? mod : null;
    if (k) k.gen(s, cell, buf);
    s._occ = null;
    s._mod = null;
    return buf.view().slice();
  }

  const api = {geo, build, hash, vnoise, MAX_CELLS, hollow, shapes: SHAPES, tones: TONES,
               use: v => { if (REG[v]) scope = v; }, scope: () => scope};
  for (const f of ['list', 'by', 'layers', 'palette'])
    Object.defineProperty(api, f, {get: () => REG[scope][f]});
  return api;
})();
