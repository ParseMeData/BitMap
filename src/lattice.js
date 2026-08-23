'use strict';
/* ── map → lattice ──────────────────────────────────────────────────────
   Two stages, split so the sliders stay responsive:
     analyse()  auto-levels, unsharp, local contrast, sobel  — expensive,
                only redone when tone controls move
     compose()  pick each cell's two faces and its colour     — cheap,
                redone on every recrystallisation                        */

const Lattice = (() => {
  const clamp01 = v => v < 0 ? 0 : (v > 1 ? 1 : v);
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const GAM = [1.7, 0.75];                    // airy · dense
  const MODES = ['photo', 'shade', 'glow', 'toon', 'line', 'duo'];
  const POOL = [0, 0, 0, 1, 2, 3, 4, 5];      // photo weighted: it is the readable one

  /* what a cell looks like in one mode, written into `o` as
     [glyph, alpha, size] — returns false when the cell is empty there.
     No allocation: this runs a few hundred thousand times per rebuild. */
  const set = (o, g, a, s) => { o[0] = g; o[1] = a; o[2] = s; return true; };
  function face(o, mode, v, mag, th){
    switch (mode){
      case 3:                                                   // toon
        if (mag > 0.28) return set(o, 1, Math.min(1, 0.6 + mag * 0.4), Math.min(1.4, 1 + mag * 0.25));
        if (v > 0.6 + th * 0.08) return set(o, 0, 0.8, 1.05);
        if (v > 0.3 + th * 0.08) return set(o, 0, 0.6, 0.55);
        return false;
      case 4:                                                   // line
        if (mag > 0.3) return set(o, 1, Math.min(1, 0.45 + mag * 0.5), Math.min(1.45, 0.7 + mag * 0.5));
        if (v > 0.8 + th * 0.15) return set(o, 0, Math.min(0.9, 0.3 + v * 0.5), 0.5);
        return false;
      case 5:                                                   // duo
        if (mag > 0.85) return set(o, 1, 1, 1.3);
        if (v > 0.62) return set(o, 0, 0.84, 1.15);
        if (v > 0.34) return set(o, 1, 0.55, 0.8);
        return false;
      case 1: {                                                 // shade — dithered ladder
        if (mag > 0.7) return set(o, 1, 0.9, 1.15);
        const b = Math.floor(v * 5 + (th - 0.5) * 0.9);
        if (b >= 4) return set(o, 0, 0.95, 1.32);
        if (b === 3) return set(o, 0, 0.84, 1.08);
        if (b === 2) return set(o, 0, 0.68, 0.85);
        if (b === 1) return set(o, 0, 0.5, 0.6);
        return v > 0.06 ? set(o, 1, 0.28, 0.45) : false;
      }
      case 2:                                                   // glow — continuous
        if (mag > 0.9) return set(o, 1, 1, 1.2);
        return v > 0.05 ? set(o, 0, 0.14 + v * 0.8, 0.5 + v * 0.95) : false;
      default:                                                  // photo
        if (mag > 0.6) return set(o, 1, Math.min(1, 0.55 + mag * 0.4), Math.min(1.3, 0.9 + mag * 0.3));
        if (v > th * 0.55 + 0.04) return set(o, 0, 0.5 + v * 0.42, 0.4 + v * 1.1);
        return false;
    }
  }

  /* box blur via sliding window — O(n), used for the local-contrast lift */
  function localLift(src, w, h, r, amount){
    const n = w * h, tv = new Float32Array(n), tc = new Float32Array(n);
    for (let y = 0; y < h; y++){
      let s = 0, c = 0;
      for (let x = -r; x < w; x++){
        const a = x + r, b = x - r - 1;
        if (a < w){ s += src[y * w + a]; c++; }
        if (b >= 0){ s -= src[y * w + b]; c--; }
        if (x >= 0){ tv[y * w + x] = s; tc[y * w + x] = c; }
      }
    }
    for (let x = 0; x < w; x++){
      let s = 0, c = 0;
      for (let y = -r; y < h; y++){
        const a = y + r, b = y - r - 1;
        if (a < h){ s += tv[a * w + x]; c += tc[a * w + x]; }
        if (b >= 0){ s -= tv[b * w + x]; c -= tc[b * w + x]; }
        if (y >= 0){
          const i = y * w + x, mean = c > 0 ? s / c : src[i];
          src[i] = Math.min(1, Math.max(0, src[i] + amount * (src[i] - mean)));
        }
      }
    }
  }

  /* ── stage 1 ── */
  function analyse(px, W, H, cols, o){
    const cell = W / cols, rows = Math.floor(H / cell);
    const n = cols * rows;
    const raw = new Float32Array(n), rgb = new Uint8Array(n * 3), isPath = new Uint8Array(n);
    const vals = [];

    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++){
        const sx = Math.min(W - 1, (x * cell) | 0), sy = Math.min(H - 1, (y * cell) | 0);
        const i = (sy * W + sx) * 4, k = y * cols + x;
        const r = px[i], g = px[i + 1], b = px[i + 2];
        rgb[k * 3] = r; rgb[k * 3 + 1] = g; rgb[k * 3 + 2] = b;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        isPath[k] = mx > 205 && (mx - mn) < mx * 0.28 ? 1 : 0;   // bright, low-chroma = route
        const v = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
        raw[k] = v; vals.push(v);
      }

    vals.sort((a, b) => a - b);
    const lo = vals[(vals.length * 0.04) | 0];
    const rng = Math.max(0.05, vals[(vals.length * 0.96) | 0] - lo);

    const tones = [];
    for (let t = 0; t < 2; t++){
      const v = new Float32Array(n);
      for (let i = 0; i < n; i++){
        let b = Math.min(1, Math.max(0, (raw[i] - lo) / rng));
        b = Math.min(1, Math.max(0, (b - 0.5) * o.con + 0.5 + o.bri));
        v[i] = Math.pow(b, GAM[t]);
      }
      const sharp = new Float32Array(v);
      const at = (x, y) => (x < 0 || y < 0 || x >= cols || y >= rows) ? 0 : v[y * cols + x];
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++){
          const bl = (at(x-1,y-1)+at(x,y-1)+at(x+1,y-1)+at(x-1,y)+at(x,y)+
                      at(x+1,y)+at(x-1,y+1)+at(x,y+1)+at(x+1,y+1)) / 9;
          const i = y * cols + x;
          sharp[i] = Math.min(1, Math.max(0, v[i] + 0.55 * (v[i] - bl)));
        }
      localLift(sharp, cols, rows, 4, 0.45);
      const mag = new Float32Array(n);
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++){
          const gx = at(x+1,y-1)+2*at(x+1,y)+at(x+1,y+1)-at(x-1,y-1)-2*at(x-1,y)-at(x-1,y+1);
          const gy = at(x-1,y+1)+2*at(x,y+1)+at(x+1,y+1)-at(x-1,y-1)-2*at(x,y-1)-at(x+1,y-1);
          mag[y * cols + x] = Math.hypot(gx, gy);
        }
      tones.push({v: sharp, mag});
    }
    return {cols, rows, cell, n, tones, rgb, isPath, W, H};
  }

  /* ── stage 2 ── */
  const F0 = new Float32Array(3), F1 = new Float32Array(3), NP = POOL.length;
  /* size var 0 = every diamond the same, 1 = as the tone map draws it */
  const sz = (v, boost, szv, jitr) => Math.min(1.7, boost * Math.max(0.3, Math.min(1.6,
    1 + (v - 1) * szv + (Math.random() - 0.5) * jitr)));
  function compose(A, o){
    const {cols, rows, cell, tones, rgb, isPath} = A;
    const buf = new Float32Array(A.n * 17);
    const spread = 0.6 * (1 + o.scatter * 3) * cell;
    const jitr = Math.max(0, o.szv - 1) * 0.36;
    let m = 0;

    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++){
        const k = y * cols + x;
        const th = (BAYER[y & 3][x & 3] + 0.5) / 16;
        const path = isPath[k] && o.path > 0;

        /* two faces — one airy, one dense. the cell crosses between them
           forever, on its own clock, in the vertex shader. walk the pool
           from a random start and take the first mode that renders, so a
           cell survives whenever any mode can draw it */
        let h0 = false, h1 = false;
        const s0 = (Math.random() * NP) | 0, s1 = (Math.random() * NP) | 0;
        for (let j = 0; j < NP && !h0; j++)
          h0 = face(F0, POOL[(s0 + j) % NP], tones[0].v[k], tones[0].mag[k] * o.edge, th);
        for (let j = 0; j < NP && !h1; j++)
          h1 = face(F1, POOL[(s1 + j) % NP], tones[1].v[k], tones[1].mag[k] * o.edge, th);
        if (!h0 && !h1) continue;
        if (!h0){ F0[0] = F1[0]; F0[1] = 0; F0[2] = 0.35; }
        if (!h1){ F1[0] = F0[0]; F1[1] = 0; F1[2] = 0.35; }

        let r, g, b;
        if (o.ink >= 0){ const p = PAL[o.ink]; r = p[0]; g = p[1]; b = p[2]; }
        else {
          r = rgb[k * 3]; g = rgb[k * 3 + 1]; b = rgb[k * 3 + 2];
          const mx = Math.max(r, g, b, 1), s = Math.min(255 / mx, 1.28);
          r *= s; g *= s; b *= s;
        }
        if (o.sat !== 1){
          const gy = r * 0.299 + g * 0.587 + b * 0.114;
          r = gy + (r - gy) * o.sat; g = gy + (g - gy) * o.sat; b = gy + (b - gy) * o.sat;
        }
        if (o.cvar > 0 && !path){            // terrain shimmers, the route stays clean
          const q = 1 + (Math.random() - 0.5) * 0.9 * o.cvar, hj = (Math.random() - 0.5) * 80 * o.cvar;
          r = r * q + hj; g *= q; b = b * q - hj;
        }
        const boost = path ? Math.min(1.6, 1 + 0.3 * o.path) : 1;
        const alift = path ? 0.2 * o.path : 0;
        if (path){ const l = 1 + 0.12 * o.path; r *= l; g *= l; b *= l; }

        const i = m * 17;
        buf[i]      = (x + 0.5) * cell;      buf[i + 1] = (y + 0.5) * cell;
        buf[i + 2]  = clamp01(r / 255);      buf[i + 3] = clamp01(g / 255);
        buf[i + 4]  = clamp01(b / 255);      buf[i + 5] = 1;
        buf[i + 6]  = Math.min(1, F0[1] + alift);
        const z0 = sz(F0[2], boost, o.szv, jitr), z1 = sz(F1[2], boost, o.szv, jitr);
        buf[i + 7]  = F0[0] ? -z0 : z0;
        buf[i + 8]  = (Math.random() - 0.5) * spread;
        buf[i + 9]  = (Math.random() - 0.5) * spread;
        buf[i + 10] = Math.min(1, F1[1] + alift);
        buf[i + 11] = F1[0] ? -z1 : z1;
        buf[i + 12] = (Math.random() - 0.5) * spread;
        buf[i + 13] = (Math.random() - 0.5) * spread;
        buf[i + 14] = Math.random();                                        // seed
        buf[i + 15] = (path && o.path >= 0.8 ? 0.02 : 0.06 + Math.random() * 0.16) * o.churn;
        buf[i + 16] = 0;                                                    // mode: lattice
        m++;
      }
    /* keep the plate at a fixed weight no matter the detail setting —
       thinned at random so it never reads as a wedge or a scanline */
    const cap = cols * 88;
    if (m > cap){
      const keep = cap / m;
      let w = 0;
      for (let i = 0; i < m; i++){
        if (Math.random() > keep) continue;
        if (w !== i) buf.copyWithin(w * 17, i * 17, i * 17 + 17);
        w++;
      }
      m = w;
    }
    return buf.subarray(0, m * 17);
  }

  /* ── walkable terrain, straight off the same pixels ── */
  function terrain(px, W, H, tw){
    const tsz = W / tw, th = Math.floor(H / tsz);
    const walk = new Uint8Array(tw * th), path = new Uint8Array(tw * th);
    for (let ty = 0; ty < th; ty++)
      for (let tx = 0; tx < tw; tx++){
        let n = 0, white = 0, chroma = 0;
        const x0 = (tx * tsz) | 0, x1 = Math.min(W, ((tx + 1) * tsz) | 0);
        const y0 = (ty * tsz) | 0, y1 = Math.min(H, ((ty + 1) * tsz) | 0);
        for (let y = y0; y < y1; y += 2)
          for (let x = x0; x < x1; x += 2){
            const i = (y * W + x) * 4;
            const mx = Math.max(px[i], px[i + 1], px[i + 2]);
            const mn = Math.min(px[i], px[i + 1], px[i + 2]);
            n++;
            if (mx > 200 && (mx - mn) < mx * 0.32) white++;
            else if ((mx - mn) > 36 || mx > 90) chroma++;
          }
        const k = ty * tw + tx;
        if (n && white / n > 0.05){ walk[k] = 1; path[k] = 1; }
        else if (n && chroma / n < 0.07) walk[k] = 1;
      }
    /* the route is drawn dotted — bridge a gap flanked on opposite sides */
    for (let pass = 0; pass < 2; pass++)
      for (let ty = 1; ty < th - 1; ty++)
        for (let tx = 1; tx < tw - 1; tx++){
          const k = ty * tw + tx;
          if (path[k]) continue;
          if ((path[k - 1] && path[k + 1]) || (path[k - tw] && path[k + tw])){
            path[k] = 1; walk[k] = 1;
          }
        }
    /* the black beyond the island reads as open ground too — flood it from
       the border and cut it, so the playfield is the map, not the void */
    const outside = new Uint8Array(tw * th), st = [];
    const edge = (x, y) => { const k = y * tw + x;
      if (walk[k] && !path[k] && !outside[k]){ outside[k] = 1; st.push(x, y); } };
    for (let x = 0; x < tw; x++){ edge(x, 0); edge(x, th - 1); }
    for (let y = 0; y < th; y++){ edge(0, y); edge(tw - 1, y); }
    while (st.length){
      const y = st.pop(), x = st.pop();
      for (let d = 0; d < 4; d++){
        const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0), ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= tw || ny >= th) continue;
        const k = ny * tw + nx;
        if (outside[k] || !walk[k] || path[k]) continue;
        outside[k] = 1; st.push(nx, ny);
      }
    }
    for (let k = 0; k < tw * th; k++) if (outside[k]) walk[k] = 0;

    return {tw, th, tsz, walk, path};
  }

  return {analyse, compose, terrain};
})();
