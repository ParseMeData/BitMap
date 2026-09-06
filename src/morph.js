'use strict';
/* ── the morph ──────────────────────────────────────────────────────────
   How the built cells of one plate become the built cells of the next —
   a cluster opening on the region, the region entered or left, a jump
   from plate to plate: the structures and the terrain do not cut from
   one drawing to the other, they travel. Eden's scatter-morph, brought
   onto the plate (2026-09-06: "implement this style into the animation
   of when we move into a new region or town — this applies to the
   assets within the map that have been added in build mode, structures
   & terrain"). The look is six things stacked:

     1  every particle carries a jitter kick — most nudge, some fly
     2  source and destination are paired by ANGLE round the middle, so
        the cloud turns into place instead of crossing itself
     3  each particle has its own delay and span inside one timeline, in
        four overlapping waves — a few precursors lead, the body flows in
        behind, surplus sheds off, stragglers trail in last
     4  a perpendicular bow bends each path into an arc
     5  a sine wobble runs the whole flight, so nothing is ever still
     6  surplus particles do not fade out: they shed off and become the
        ambient drifting field that stays after the figure has landed

   Adapted to the plate: a figure is the composed cells of the shapes
   (`Build.cells`), the kick and the wobble ride the arc and are gone at
   the landing, so a cell lands exactly on its cell and the static
   drawing takes over without a step; the static `build` batch is not
   drawn while a morph is up (game.js). Positions are world units on the
   plate, colours 0..1, a size the diamond's half-size in world units, a
   negative one a ring, as the entity stream has them.               */

const Morph = (() => {
  const TAU = Math.PI * 2, rnd = Math.random;
  const clamp01 = t => t < 0 ? 0 : t > 1 ? 1 : t;
  const pick = a => a[(rnd() * a.length) | 0];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--){ const j = (rnd() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  const span = r => r[0] + rnd() * (r[1] - r[0]);
  const BONE = [0.93, 0.92, 0.89];
  const MAXP = 20000;                  // cells a figure is sampled down to
  const DUR = 1800;                    // ms, the whole morph

  /* ── easing ── `soft` is the one that matters: a damped spring that
     overshoots a little and settles; mixing eases across particles is
     most of why arrivals shimmer instead of landing in lockstep */
  const EASE = {
    io: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    out: t => 1 - Math.pow(1 - t, 3),
    quint: t => 1 - Math.pow(1 - t, 5),
    soft: t => 1 - Math.exp(-6 * t) * Math.cos(5.2 * t),
    backSoft: t => { const c1 = 0.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  };
  /* ── the waves ── delay and span as fractions of the whole; they
     overlap on purpose, so the merge reads as one stream, not four steps */
  const WAVES = {
    pre:   {dl: [0, 0.06],    sn: [0.28, 0.40], bow: 0.28, ez: [EASE.soft, EASE.soft, EASE.out]},
    main:  {dl: [0.06, 0.24], sn: [0.32, 0.50], bow: 0.20, ez: [EASE.io, EASE.io, EASE.io, EASE.soft, EASE.soft, EASE.backSoft]},
    fill:  {dl: [0.15, 0.35], sn: [0.32, 0.47], bow: 0.40, ez: [EASE.soft, EASE.out, EASE.out]},
    strag: {dl: [0.35, 0.62], sn: [0.32, 0.42], bow: 0.15, ez: [EASE.soft, EASE.soft, EASE.backSoft, EASE.out]}
  };
  /* the kick: 14 % of cells get a big one, the rest a small one — the
     ratio that softens a hard silhouette without dissolving it */
  const jitter = cell => { const k = rnd() < 0.14 ? 1.1 : 0.3; return (rnd() - 0.5) * cell * k; };
  const mkDrift = cell => ({sp: cell * (0.3 + rnd() * 0.9), an: rnd() * TAU, wb: (rnd() - 0.5) * 0.8});

  let morph = null;                    // {parts, t0, dur, cell, w, h, lt}
  let strays = [];                     // the drift field, kept between morphs
  let pending = null;                  // {from, out, key}: a plate change under way
  let last = 0;
  /* ── the sweep ── a crossing made on foot arrives in a wave that runs
     AGAINST the way walked — walk off to the right and the new plate
     lands from right to left, walk up and it lands from the top down,
     the way the world flows past when you move (Eden, 2026-09-06: "give
     the animation transitions a sweep depending on which way our sprite
     walks in — walking into a road off to the right, the sweep is from
     right to left; moving up, up to down; mirror the other two"). Set
     by the crossing (`sweep(dir)`), taken by the next plan and gone: a
     jump from the region or the map has no way and no sweep. Half the
     timeline is the wave's run across the plate, by each particle's
     mid-flight point along the way walked; the rest is the waves as
     they were, compressed. */
  let sweepDir = null;
  const SWEEP = 0.5;
  const DIRV = {e: [1, 0], w: [-1, 0], n: [0, -1], s: [0, 1]};
  const sweep = dir => { sweepDir = DIRV[dir] ? DIRV[dir] : null; };
  function sweepParts(parts, v){
    const proj = q => ((q.x0 + q.x1) / 2) * v[0] + ((q.y0 + q.y1) / 2) * v[1];
    let lo = Infinity, hi = -Infinity;
    for (const q of parts){ const s = proj(q); if (s < lo) lo = s; if (s > hi) hi = s; }
    const R = Math.max(1, hi - lo);
    for (const q of parts){
      const k = (hi - proj(q)) / R;                     // the far side in the way walked goes first
      q.dl = k * SWEEP + q.dl * (1 - SWEEP);
      q.sn = Math.max(0.06, Math.min(q.sn * (1 - SWEEP), 1 - q.dl - 0.002));
    }
  }

  /* ── the drift field ── loose particles outside the figure: each with
     its own speed, heading, a turn rate that drifts toward a new one,
     and a twinkle; they wrap at the plate's edges */
  function spawnStrays(n, w, h, cell, palette){
    const out = [];
    for (let i = 0; i < n; i++) out.push({
      x: cell + rnd() * (w - 2 * cell), y: cell + rnd() * (h - 2 * cell),
      rgb: pick(palette), alpha: 0.08 + rnd() * 0.18, size: (0.5 + rnd() * 0.45) * cell * 0.75, glyph: false,
      sp: cell * (0.3 + rnd() * 0.9), an: rnd() * TAU, wb: (rnd() - 0.5) * 0.8, wbT: (rnd() - 0.5) * 0.8, ph: rnd() * TAU, twinkle: 1});
    return out;
  }
  function stepStrays(dt, now, w, h, cell, warm){
    const pad = cell * 1.5;
    for (const s of strays){
      s.wb += (s.wbT - s.wb) * Math.min(1, dt * 1.6);
      if (rnd() < dt * 0.3) s.wbT = (rnd() - 0.5) * 0.9;
      s.an += s.wb * dt;
      const sp = s.sp * warm * (1 + 0.18 * Math.sin(now * 0.0011 + s.ph));
      s.x += Math.cos(s.an) * sp * dt; s.y += Math.sin(s.an) * sp * dt;
      if (s.x < -pad) s.x = w + pad; else if (s.x > w + pad) s.x = -pad;
      if (s.y < -pad) s.y = h + pad; else if (s.y > h + pad) s.y = -pad;
      s.twinkle = 0.8 + 0.25 * Math.sin(now * 0.0014 + s.ph * 1.7);
    }
  }

  function mkPart(a, b, o, role, tgt, drift, cell){
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), dl = span(o.dl);
    return {x0: a.x, y0: a.y, x1: b.x, y1: b.y, a0: a.alpha, a1: b.alpha, c0: a.rgb, c1: b.rgb, s0: a.size, s1: b.size,
            g0: !!a.glyph, g1: !!b.glyph,
            dl, sn: Math.max(0.06, Math.min(span(o.sn), 1 - dl - 0.002)), ez: pick(o.ez),
            nx: d > 1 ? -dy / d : 0, ny: d > 1 ? dx / d : 0, bow: (rnd() - 0.5) * d * o.bow, ph: rnd() * TAU,
            jx: jitter(cell), jy: jitter(cell), role, tgt: tgt || null, drift: drift || null,
            x: a.x, y: a.y, rgb: a.rgb, alpha: a.alpha, size: a.size, glyph: !!a.glyph};
  }

  /* ── the plan ── from: the figure now; to: the figure to become;
     fromOut: the drift field on screen */
  function plan(from, to, fromOut){
    const w = G.W, h = G.H, cell = G.A.cell, cx = w / 2, cy = h / 2;
    const src = to.length ? to : from;
    const palette = src.length ? [0, 1, 2, 3, 4, 5].map(() => pick(src).rgb) : [BONE];
    const news = spawnStrays(Math.max(20, Math.min(80, Math.round(to.length * 0.06))), w, h, cell, palette);
    strays = news;
    const ring = q => { const an = rnd() * TAU, R = Math.min(cx, cy) * 0.92;
                        return {x: cx + Math.cos(an) * R, y: cy + Math.sin(an) * R, rgb: q.rgb, alpha: 0, size: q.size * 0.4, glyph: q.glyph}; };
    const parts = [], now = performance.now();
    const sw = sweepDir; sweepDir = null;
    const done = () => { if (sw) sweepParts(parts, sw); return {parts, t0: now, dur: DUR, cell, w, h, lt: 0}; };
    /* a cold start: everything flies in from a ring */
    if (!from.length){
      for (const b of to) parts.push(mkPart(ring(b), b, WAVES.main, 'main', null, null, cell));
      for (const s of news) parts.push(mkPart(ring(s), s, WAVES.fill, 'fill', s, null, cell));
      return done();
    }
    const outs = shuffle(fromOut.slice());
    /* destination cells for the two scattered waves, picked at random so
       no wedge or seam shows, before the body claims the rest */
    const used = new Uint8Array(to.length);
    const pickIdx = n => { const out = []; let guard = 0;
      while (out.length < n && guard++ < n * 40){ const i = (rnd() * to.length) | 0; if (!used[i]){ used[i] = 1; out.push(i); } }
      return out; };
    const K = Math.max(1, outs.length);
    const nPre = Math.min(K, Math.max(8, Math.round(K * 0.35)));
    const nStrag = Math.max(24, Math.min(100, Math.round(to.length * 0.07)));
    const stragIdx = to.length ? pickIdx(Math.min(nStrag, to.length)) : [];
    const preIdx = to.length ? pickIdx(Math.min(nPre, to.length)) : [];
    const preSrc = outs.slice(0, Math.min(nPre, outs.length)), stragSrc = outs.slice(preSrc.length);
    /* 1 — precursors, already wearing the destination's colour */
    preIdx.forEach((ci, i) => { const b = to[ci];
      parts.push(mkPart(preSrc.length ? preSrc[i % preSrc.length] : ring(b), b, WAVES.pre, 'pre', null, mkDrift(cell), cell)); });
    /* 2 — the body, paired by angle round the middle, then by radius */
    const byAngle = arr => { for (const q of arr){ const dx = q.x - cx, dy = q.y - cy; q._a = Math.atan2(dy, dx); q._r = dx * dx + dy * dy; }
                             return arr.sort((u, v) => (u._a - v._a) || (u._r - v._r)); };
    const A = byAngle(from.slice()), B = byAngle(to.filter((_, i) => !used[i]));
    let srcs = A; const spare = [];
    if (A.length > B.length){
      const excess = A.length - B.length, take = new Uint8Array(A.length); let got = 0, guard = 0;
      while (got < excess && guard++ < excess * 40){ const i = (rnd() * A.length) | 0; if (!take[i]){ take[i] = 1; got++; } }
      srcs = []; for (let i = 0; i < A.length; i++) (take[i] ? spare : srcs).push(A[i]);
    }
    for (let i = 0; i < B.length; i++) parts.push(mkPart(srcs.length ? srcs[i % srcs.length] : ring(B[i]), B[i], WAVES.main, 'main', null, null, cell));
    /* 3 — the surplus sheds off: onto the new drift posts, already
       moving, and what is left over past them scatters out and goes */
    const fillSrc = spare.length ? spare : (outs.length ? outs : null);
    news.forEach((s, i) => parts.push(mkPart(fillSrc ? fillSrc[i % fillSrc.length] : ring(s), s, WAVES.fill, 'fill', s,
                                               fillSrc === outs ? mkDrift(cell) : null, cell)));
    for (let i = news.length; i < spare.length; i++){
      const a = spare[i], an = rnd() * TAU, R = cell * (6 + rnd() * 30);
      parts.push(mkPart(a, {x: a.x + Math.cos(an) * R, y: a.y + Math.sin(an) * R, rgb: a.rgb, alpha: 0, size: a.size * 0.5, glyph: a.glyph},
                        WAVES.fill, 'shed', null, null, cell));
    }
    /* 4 — stragglers trail in last, onto cells scattered over the figure */
    stragIdx.forEach((ci, i) => { const b = to[ci];
      parts.push(mkPart(stragSrc.length ? stragSrc[i % stragSrc.length] : ring(b), b, WAVES.strag, 'strag', null, mkDrift(cell), cell)); });
    return done();
  }

  /* ── one frame ── */
  function step(m, now){
    const t = (now - m.t0) / m.dur, dt = Math.min(0.05, (now - (m.lt || now)) / 1000), cell = m.cell, pad = cell * 1.5;
    m.lt = now;
    stepStrays(dt, now, m.w, m.h, cell, Math.min(1, (now - m.t0) / 900));
    for (const q of m.parts){
      /* before launch, one that came from the drift field keeps wandering */
      if (t < q.dl && q.drift){
        q.drift.an += q.drift.wb * dt;
        q.x0 += Math.cos(q.drift.an) * q.drift.sp * dt; q.y0 += Math.sin(q.drift.an) * q.drift.sp * dt;
        if (q.x0 < -pad) q.x0 = m.w + pad; else if (q.x0 > m.w + pad) q.x0 = -pad;
        if (q.y0 < -pad) q.y0 = m.h + pad; else if (q.y0 > m.h + pad) q.y0 = -pad;
      }
      const x1 = q.tgt ? q.tgt.x : q.x1, y1 = q.tgt ? q.tgt.y : q.y1;
      const u = clamp01((t - q.dl) / q.sn), e = q.ez(u);
      const lx = q.x0 + (x1 - q.x0) * e, ly = q.y0 + (y1 - q.y0) * e;
      /* the arc and the kick peak mid-flight and are gone at either end;
         the wobble runs the whole flight and dies into the landing —
         unless the landing is a drift post, which never stops */
      const mid = Math.sin(Math.PI * clamp01(e)), bow = q.bow * mid;
      const live = q.tgt ? 1 : 1 - u * u;
      q.x = lx + q.nx * bow + q.jx * mid + Math.sin(now * 0.0016 + q.ph) * cell * 0.09 * live;
      q.y = ly + q.ny * bow + q.jy * mid + Math.cos(now * 0.0013 + q.ph * 1.4) * cell * 0.09 * live;
      q.glyph = e < 0.5 ? q.g0 : q.g1;                 // a ring swaps at halfway, never blends
      q.rgb = [q.c0[0] + (q.c1[0] - q.c0[0]) * e, q.c0[1] + (q.c1[1] - q.c0[1]) * e, q.c0[2] + (q.c1[2] - q.c0[2]) * e];
      q.alpha = clamp01(q.a0 + (q.a1 - q.a0) * e);
      q.size = Math.max(0.1, q.s0 + (q.s1 - q.s0) * e);
    }
    return t >= 1;
  }
  /* a running morph, frozen where it got to, split back into figure and
     field — so a change in the middle of a change chains on smoothly */
  function snapshot(m){
    const shape = [], out = [];
    for (const q of m.parts){
      if (q.role === 'shed') continue;
      (q.role === 'fill' ? out : shape).push({x: q.x, y: q.y, rgb: q.rgb, alpha: q.alpha, size: q.size, glyph: q.glyph});
    }
    return {shape, out};
  }

  /* ── the plate changes ── `begin` before the builder is put on the
     next plate, `settle` after: the figure it had, the figure it has,
     and the morph between them. A change with no plate change between
     the two calls moves nothing. */
  /* the figure: the built cells, and the town's name with them — the
     lettering travels as the structures do (Eden, 2026-09-06: "make the
     title give the same pixel transition effect as the plate detail");
     palace.js holds the title back while a morph is up, as game.js holds
     the build batch */
  const figure = () => {
    const cells = Build.cells(MAXP);
    const name = (typeof Palace !== 'undefined' && Palace.titleCells) ? Palace.titleCells() : [];
    return name.length ? cells.concat(name) : cells;
  };
  function begin(){
    if (pending || typeof Build === 'undefined' || !Build.cells) return;
    const key = Build.key();
    if (morph){ const s = snapshot(morph); pending = {from: s.shape, out: s.out.concat(strays), key}; }
    else pending = {from: figure(), out: strays.slice(), key};
  }
  function settle(){
    if (!pending) return false;
    const p = pending; pending = null;
    if (typeof Build === 'undefined' || Build.key() === p.key || !G.A || !G.W) return false;
    const to = figure();
    if (!p.from.length && !to.length){ morph = null; return false; }
    morph = plan(p.from, to, p.out);
    return true;
  }
  const active = () => !!morph;

  function overlay(a, m, cap){
    if (!G.A || !G.W) return m;
    const now = performance.now();
    if (morph){
      const done = step(morph, now);
      for (const q of morph.parts){
        if (m > cap - 2) break;
        if (q.alpha <= 0.003) continue;
        m = put(a, m, q.x, q.y, q.rgb[0], q.rgb[1], q.rgb[2], q.alpha, q.size, q.glyph ? 1 : 0, 0, 0, 1);
      }
      if (done) morph = null;
      last = now;
      return m;
    }
    if (strays.length){
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      stepStrays(dt, now, G.W, G.H, G.A.cell, 1);
      for (const s of strays){
        if (m > cap - 2) break;
        m = put(a, m, s.x, s.y, s.rgb[0], s.rgb[1], s.rgb[2], s.alpha * s.twinkle, s.size, 0, 0, 0, 1);
      }
    }
    return m;
  }
  const clear = () => { morph = null; pending = null; strays = []; };

  return {begin, settle, active, overlay, clear, sweep, strays: () => strays.length,
          parts: () => (morph ? morph.parts.length : 0),
          /* for tests: each particle's mid-flight point and its delay */
          plan: () => (morph ? morph.parts.map(q => [(q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2, q.dl]) : [])};
})();
