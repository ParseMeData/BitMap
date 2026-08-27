'use strict';
/* ── the country ────────────────────────────────────────────────────────
   Australia, one plane of SA3 ids, and every level above it read back out
   of it. Cut from the Typeset Earth loci bitmap by `tools/country.py`,
   which writes `assets/australia.js`; this decodes that.

   `AU` stores exactly one thing per cell: the smallest piece it knows
   about. A region is not stored, because a region is the union of its
   districts; a state is not stored, because a state is the union of its
   regions; the country is not stored either. That is the whole reason four
   levels cannot drift out of step — there is one set of lines, written
   once, and everything else is a sum.

     Australia  >  state  >  SA4 region  >  SA3 district  >  a plate

   It is SA3 below SA4 rather than the local government area, which is what
   a lot of these places are actually called, because an LGA does not nest:
   measured on this same raster, 211 of 533 have cells in more than one SA4,
   and Brisbane City sits in three. A shire is a different cut of the
   country, not a smaller piece of this one.

   Decoding is the same four-character run-length the loci bitmap uses, so a
   cell here is a cell there: this grid is forty to a 0.5-degree cell and
   eight to a 0.1-degree cell, on a window whose corner is a whole multiple
   of both. `worldCell()` is the bridge back.

   The asset is 220 KB and decodes to nine megabytes of typed arrays, so it
   is not in the boot chain: `Country.load()` fetches it the first time the
   towns map opens and decodes it then, once. Until then `Country.ready()`
   is false and nothing else here may be read.                             */

const Country = (() => {
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const IDX = new Int16Array(128).fill(-1);
  for (let i = 0; i < 64; i++) IDX[B64.charCodeAt(i)] = i;

  const C = {ready: () => false};
  let loading = null;

  /* the asset arrives as one more script, cache-busted like the rest;
     decode the moment it lands, and resolve with the decoded country */
  function load(){
    if (C.ready()) return Promise.resolve(C);
    if (loading) return loading;
    loading = new Promise((res, rej) => {
      const go = () => { try { decode(); res(C); } catch (e){ loading = null; rej(e); } };
      if (typeof AU !== 'undefined') return go();
      const el = document.createElement('script');
      el.src = 'assets/australia.js?cb=' + (window.HQ_BUILD || 0) + '.' + Date.now();
      el.async = true;
      el.onload = go;
      el.onerror = () => { loading = null; rej(new Error('could not load assets/australia.js')); };
      document.body.appendChild(el);
    });
    return loading;
  }

  function decode(){
    const {cols, rows, cell, lon0, lat0, origin} = AU;
    const N = cols * rows;

    /* value in the top two characters, run length minus one in the bottom two */
    const grid = new Int16Array(N);
    {
      let t = 0, r = AU.rle;
      for (let i = 0; i < r.length; i += 4){
        const v = IDX[r.charCodeAt(i)] * 64 + IDX[r.charCodeAt(i + 1)];
        const n = IDX[r.charCodeAt(i + 2)] * 64 + IDX[r.charCodeAt(i + 3)] + 1;
        if (v) grid.fill(v, t, t + n);
        t += n;
      }
      if (t !== N) throw new Error('country: rle covers ' + t + ' of ' + N + ' cells');
    }

    /* ── the four levels ────────────────────────────────────────────────
       Bounds are kept in cell coordinates rather than degrees: the view
       maths wants cells, and a degree box would be converted back every
       frame. */
    const box = () => ({cells: 0, c0: 1e9, c1: -1e9, r0: 1e9, r1: -1e9});
    const subs = AU.subs.map((s, i) => Object.assign(box(), {
      id: i + 1, code: s.code, name: s.name, region: s.region,
      area: s.km2 || 0, clipped: !!s.clipped, depth: 3,
    }));
    const regions = AU.regions.map((r, i) => Object.assign(box(), {
      id: i + 1, code: r.code, name: r.name, state: r.state, part: r.part,
      subs: [], area: 0, depth: 2,
    }));
    const states = AU.states.map((s, i) => Object.assign(box(), {
      id: i + 1, code: s.code, name: s.name, regions: [], area: 0, depth: 1,
    }));
    const country = Object.assign(box(), {id: 0, name: 'Australia', area: 0, depth: 0});

    for (const s of subs){ const r = regions[s.region - 1]; r.subs.push(s); r.area += s.area; }
    for (const r of regions){ const st = states[r.state - 1]; st.regions.push(r); st.area += r.area; }
    for (const st of states) country.area += st.area;

    /* cell -> region and cell -> state, so hit-testing and the renderer
       never have to walk back up through the tables */
    const regionOf = new Int16Array(N);
    const stateOf = new Int16Array(N);
    const stretch = (o, c, r) => {
      o.cells++;
      if (c < o.c0) o.c0 = c;
      if (c > o.c1) o.c1 = c;
      if (r < o.r0) o.r0 = r;
      if (r > o.r1) o.r1 = r;
    };
    for (let i = 0; i < N; i++){
      const v = grid[i];
      if (!v) continue;
      const c = i % cols, r = (i / cols) | 0;
      const sub = subs[v - 1], reg = regions[sub.region - 1];
      regionOf[i] = reg.id;
      stateOf[i] = reg.state;
      stretch(sub, c, r);
      stretch(reg, c, r);
      stretch(states[reg.state - 1], c, r);
      stretch(country, c, r);
    }

    /* ── edges ──────────────────────────────────────────────────────────
       A cell is an edge when the land cell right of it or below it belongs
       to a different piece. Two neighbours are enough: every boundary is
       marked from one side or the other, and checking four would draw each
       line twice at twice the cost. Both sides have to be land — the sea is
       not a division between two places, and counting it would ring the
       whole coastline in the colour kept for the cuts.

       One bit per level, so the renderer can pick a weight per line without
       a second pass: 1 any SA3 line, 2 also an SA4 line, 4 also a state
       line. Each implies the ones below it. */
    const edge = new Uint8Array(N);
    const mark = (i, j) => {
      let e = 1;
      if (regionOf[i] !== regionOf[j]) e |= 2;
      if (stateOf[i] !== stateOf[j]) e |= 4;
      return e;
    };
    for (let r = 0; r < rows; r++){
      for (let c = 0; c < cols; c++){
        const i = r * cols + c, v = grid[i];
        if (!v) continue;
        let e = 0;
        if (c + 1 < cols && grid[i + 1] && grid[i + 1] !== v) e |= mark(i, i + 1);
        if (r + 1 < rows && grid[i + cols] && grid[i + cols] !== v) e |= mark(i, i + cols);
        edge[i] = e;
      }
    }
    /* the boundary cells as a flat list: few next to the land, and the one
       thing that must never be thinned out — a dotted line stops being a
       line — so the renderer walks this at full resolution however far out
       the view is */
    let n = 0;
    for (let i = 0; i < N; i++) if (edge[i]) n++;
    const edgeList = new Int32Array(n);
    for (let i = 0, k = 0; i < N; i++) if (edge[i]) edgeList[k++] = i;

    /* ── coordinates ──────────────────────────────────────────────────── */
    const lonOf = c => lon0 + (c + 0.5) * cell;
    const latOf = r => lat0 - (r + 0.5) * cell;
    const colOf = lon => Math.floor((lon - lon0) / cell);
    const rowOf = lat => Math.floor((lat0 - lat) / cell);
    const at = (lon, lat) => {
      const c = colOf(lon), r = rowOf(lat);
      if (c < 0 || r < 0 || c >= cols || r >= rows) return null;
      const v = grid[r * cols + c];
      if (!v) return null;
      const sub = subs[v - 1], reg = regions[sub.region - 1];
      return {sub, region: reg, state: states[reg.state - 1]};
    };
    /* where this cell sits in the bitmap it was cut out of, so a place
       here can be handed back to the overlay that supplied the coastline */
    const worldCell = (c, r) => {
      const wc = Math.floor((lon0 + c * cell + 180) / 360 * origin.cols);
      const wr = Math.floor((origin.latTop - (lat0 - r * cell)) /
                            (origin.latTop - origin.latBot) * origin.rows);
      return {col: wc, row: wr, index: wr * origin.cols + wc};
    };
    /* is this cell inside that scope? one test for all four depths */
    const holds = (scope, i) => scope.depth === 0 ? true
      : scope.depth === 1 ? stateOf[i] === scope.id
      : scope.depth === 2 ? regionOf[i] === scope.id
      : grid[i] === scope.id;
    const parentOf = s => s.depth === 3 ? regions[s.region - 1]
                        : s.depth === 2 ? states[s.state - 1]
                        : s.depth === 1 ? country : null;
    const childrenOf = s => s.depth === 0 ? states : s.depth === 1 ? s.regions
                          : s.depth === 2 ? s.subs : [];

    Object.assign(C, {
      cols, rows, cell, lon0, lat0, grid, edge, edgeList, regionOf, stateOf,
      country, states, regions, subs, meta: AU,
      lonOf, latOf, colOf, rowOf, at, worldCell, holds, parentOf, childrenOf,
      ready: () => true,
    });
  }

  C.load = load;
  return C;
})();
