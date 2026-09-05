'use strict';
/* ── the survey ──────────────────────────────────────────────────────────
   The town drawn from the ground it stands on. Once a plate is founded on
   an address and the map frozen there (src/found.js), the survey asks
   OpenStreetMap — Overpass, keyless, from the page — for what lies inside
   the plate: the roads, the water (lakes, dams, reservoirs, beaches, the
   rivers and creeks), and lays them as the plate's own shapes: the road
   network that is CONNECTED to the address and nothing else, so the
   plate begins as the roads you could actually walk from the door; every
   body of water near; a field of grass under it all; and a boundary,
   laid by default, that fades the town at the plate's rim.

   And it turns the map first: the road at the address is found, its
   bearing measured, and the frozen picture turned so that road lies
   perfectly vertical or horizontal — whichever is nearer — before the
   shapes are laid, so the roads on the plate agree with the picture
   under them and the connecting road runs square to the plate. The
   compass turns with it, so north is still north.

   Every point goes through `Basemap.worldOf`, which reads the picture as
   it is placed, so the survey lands on the map however it is moved. The
   first palace is put at the address itself, and it can be dragged
   anywhere within the boundary afterwards like any marker.           */

const Survey = (() => {
  /* Overpass, in the order to try. The main instance answers a web origin
     in a second and a file:// page not at all — for `Origin: null` it sends
     no allow-origin header (found 2026-08-28) — so the desk falls through
     to Mail.ru's mirror, which answers everyone, slowly (~40 s). Kumi is
     the last resort and is often slower still. */
  const APIS = ['https://overpass-api.de/api/interpreter',
                'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
                'https://overpass.kumi.systems/api/interpreter'];
  const WAIT = 75000;                 // ms an instance gets before the next is tried
  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };
  /* the roads that are roads: no tracks, paths, footways, cycleways or
     service lanes (Eden, 2026-08-29 — they printed a pixel wide and were
     not the road to the door); none narrower than two cells */
  const WIDTH = {motorway: 4, trunk: 4, primary: 3.2, secondary: 2.8, tertiary: 2.4, residential: 2,
                 unclassified: 2, living_street: 2};
  const MAIN = w => !!(w.tags && WIDTH[w.tags.highway]);
  /* ── ruled ──────────────────────────────────────────────────────────
     A road is straights and curves, nothing else (Eden, 2026-08-29). The
     run as the map has it is simplified to its bends, each length given
     a heading — horizontal or vertical by which way it mostly goes, or
     45° for a length that is long and truly diagonal — and consecutive
     lengths on one heading are one STRAIGHT, on the line through their
     length-weighted middle. Between two straights there is ONE CURVE:
     where the headings differ, a turn about the corner where the two
     lines meet — the road leaves the first straight R before the corner
     and joins the second R after it, bowed through the corner; where
     they are the same heading a step across, an S from the one line to
     the other, two bows meeting halfway with the same tangent. So a road
     that wanders a few degrees prints dead straight, a bend is a bend,
     and a dog-leg is a clean S — and the door's road, squared by the
     map's turn, is exactly vertical. Returns {pts, ctrl}.             */
  const R_TURN = 3;                           // tiles: how far from the corner a turn begins
  function simplify(pts, tol){
    if (pts.length < 3) return pts;
    const d2 = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1e-9;
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L));
      return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t); };
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    while (stack.length){
      const [i, j] = stack.pop(); let far = 0, at = -1;
      for (let k = i + 1; k < j; k++){ const d = d2(pts[k], pts[i], pts[j]); if (d > far){ far = d; at = k; } }
      if (at > 0 && far > tol){ keep[at] = 1; stack.push([i, at], [at, j]); }
    }
    return pts.filter((p, i) => keep[i]);
  }
  /* a length's heading: 0 or 90, or 45/135 for a long true diagonal */
  function headingOf(a, b, ts){
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    const ang = ((Math.atan2(dy, dx) * 180 / Math.PI) % 180 + 180) % 180;
    if (L >= ts * 4 && ang > 30 && ang < 60) return 45;
    if (L >= ts * 4 && ang > 120 && ang < 150) return 135;
    return Math.abs(dx) >= Math.abs(dy) ? 0 : 90;
  }
  const dirOf = h => [Math.cos(h * Math.PI / 180), Math.sin(h * Math.PI / 180)];
  /* the point where two lines meet, or null when they are parallel */
  function meet(p, u, q, v){
    const det = u[0] * v[1] - u[1] * v[0];
    if (Math.abs(det) < 1e-9) return null;
    const t = ((q[0] - p[0]) * v[1] - (q[1] - p[1]) * v[0]) / det;
    return [p[0] + u[0] * t, p[1] + u[1] * t];
  }
  function rule(run){
    const ts = G.terr.tsz, pts = simplify(run, ts * 0.6);
    if (pts.length < 2) return null;
    /* lengths → straights */
    const S = [];
    for (let i = 0; i + 1 < pts.length; i++){
      const h = headingOf(pts[i], pts[i + 1], ts), L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      const last = S[S.length - 1];
      if (last && last.h === h){ last.pts.push(pts[i + 1]); last.len += L; }
      else S.push({h, pts: [pts[i], pts[i + 1]], len: L});
    }
    for (const st of S){
      /* the line: the heading, through the length-weighted middle */
      let sx = 0, sy = 0, sw = 0;
      for (let i = 0; i + 1 < st.pts.length; i++){
        const a = st.pts[i], b = st.pts[i + 1], w = Math.hypot(b[0] - a[0], b[1] - a[1]);
        sx += (a[0] + b[0]) / 2 * w; sy += (a[1] + b[1]) / 2 * w; sw += w;
      }
      st.c = [sx / (sw || 1), sy / (sw || 1)]; st.u = dirOf(st.h);
      /* the first and last of its points, on the line */
      const on = p => { const t = (p[0] - st.c[0]) * st.u[0] + (p[1] - st.c[1]) * st.u[1]; return [st.c[0] + st.u[0] * t, st.c[1] + st.u[1] * t]; };
      st.a = on(st.pts[0]); st.b = on(st.pts[st.pts.length - 1]);
      /* running the right way along its own heading */
      if ((st.b[0] - st.a[0]) * st.u[0] + (st.b[1] - st.a[1]) * st.u[1] < 0) st.u = [-st.u[0], -st.u[1]];
    }
    /* straights → the road: each straight's start and end, and a curve between */
    const out = [], ctrl = [];
    const push = (p, c) => { out.push(p); ctrl.push(c === undefined ? null : c); };
    let from = S[0].a;
    for (let k = 0; k < S.length; k++){
      const A = S[k], B = S[k + 1];
      if (!B){ push(from); push(A.b); break; }
      const X = meet(A.c, A.u, B.c, B.u);
      if (X){
        /* a turn about the corner, R before it to R after */
        const dA = Math.min(R_TURN * ts, Math.hypot(X[0] - from[0], X[1] - from[1]) * 0.6);
        const dB = Math.min(R_TURN * ts, Math.hypot(B.b[0] - X[0], B.b[1] - X[1]) * 0.6);
        const p = [X[0] - A.u[0] * dA, X[1] - A.u[1] * dA], q = [X[0] + B.u[0] * dB, X[1] + B.u[1] * dB];
        push(from); push(p, X);                  // from → p straight, p → q bowed through X
        from = q;
      } else {
        /* parallel: an S from the one line to the other, about the vertex they share */
        const v = A.pts[A.pts.length - 1];
        const pa = [A.c[0] + A.u[0] * ((v[0] - A.c[0]) * A.u[0] + (v[1] - A.c[1]) * A.u[1]), A.c[1] + A.u[1] * ((v[0] - A.c[0]) * A.u[0] + (v[1] - A.c[1]) * A.u[1])];
        const pb = [B.c[0] + B.u[0] * ((v[0] - B.c[0]) * B.u[0] + (v[1] - B.c[1]) * B.u[1]), B.c[1] + B.u[1] * ((v[0] - B.c[0]) * B.u[0] + (v[1] - B.c[1]) * B.u[1])];
        const off = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
        if (off < ts * 0.5){ push(from); from = pb; continue; }     // near enough one line
        const half = Math.max(ts * 1.5, off);
        const p = [pa[0] - A.u[0] * half, pa[1] - A.u[1] * half], q = [pb[0] + B.u[0] * half, pb[1] + B.u[1] * half];
        const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        const c1 = [pa[0], pa[1]], c2 = [pb[0], pb[1]];             // on each line, so the tangents hold
        push(from); push(p, c1); push(m, c2);
        from = q;
      }
    }
    return {pts: out, ctrl: ctrl.slice(0, out.length - 1)};
  }
  /* ── joined, or an island ─────────────────────────────────────────────
     A way reaches the door through nodes it shares off the plate as
     easily as on it, and a ruled run's end can drift a cell from the run
     it met. So the runs are joined again here — an end within a tile of
     another run is put on it — and only what touches the door's run,
     through touches, is kept. An island is not printed. */
  function joined(runs, door){
    const ts = G.terr.tsz;
    const onRun = (pt, r) => {                     // nearest point of run r to pt, and how far
      let best = null, bd = Infinity;
      for (let i = 0; i + 1 < r.pts.length; i++){
        const a = r.pts[i], b = r.pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1e-9;
        const t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / L));
        const x = a[0] + dx * t, y = a[1] + dy * t, d = Math.hypot(pt[0] - x, pt[1] - y);
        if (d < bd){ bd = d; best = [x, y]; }
      }
      return {at: best, d: bd};
    };
    /* ends onto the runs they meet */
    runs.forEach((r, i) => {
      for (const k of [0, r.pts.length - 1]){
        let best = null, bd = ts;
        runs.forEach((o, j) => { if (j === i) return; const h = onRun(r.pts[k], o); if (h.d < bd){ bd = h.d; best = h.at; } });
        if (best) r.pts[k] = best;
      }
    });
    const touch = (a, b) => {
      for (const k of [0, a.pts.length - 1]) if (onRun(a.pts[k], b).d <= ts * 0.6) return true;
      for (const k of [0, b.pts.length - 1]) if (onRun(b.pts[k], a).d <= ts * 0.6) return true;
      return false;
    };
    let start = -1, sd = Infinity;
    runs.forEach((r, i) => { const h = onRun(door, r); if (h.d < sd){ sd = h.d; start = i; } });
    if (start < 0) return [];
    const keep = new Set([start]), q = [start];
    while (q.length){ const i = q.shift(); runs.forEach((o, j) => { if (!keep.has(j) && touch(runs[i], o)){ keep.add(j); q.push(j); } }); }
    return runs.filter((r, i) => keep.has(i));
  }

  /* ── the ground inside the plate ──────────────────────────────────── */
  function bbox(){
    const pts = [[0, 0], [G.W, 0], [0, G.H], [G.W, G.H]].map(p => Basemap.geoOf(p[0], p[1]));
    if (pts.some(p => !p)) return null;
    const la = pts.map(p => p[0]), lo = pts.map(p => p[1]);
    const bb = [Math.min(...la), Math.min(...lo), Math.max(...la), Math.max(...lo)];
    return bb.every(isFinite) ? bb : null;
  }
  async function fetchAll(bb, say){
    const b = bb.join(',');
    const q = '[out:json][timeout:40];(' +
      'way["highway"](' + b + ');' +
      'way["natural"="water"](' + b + ');way["water"](' + b + ');way["landuse"="reservoir"](' + b + ');' +
      'way["natural"="beach"](' + b + ');' +
      'way["waterway"~"^(river|stream|canal)$"](' + b + ');' +
      'relation["natural"="water"](' + b + ');' +
      ');out geom;';
    /* a GET — a POST with a content type is preflighted, and the null
       origin gets no answer to a preflight either */
    let last = null;
    /* a file:// page goes to the mirror first — the main instance will not
       answer it — and every instance gets two goes, because Mail.ru's has
       been seen to refuse once and answer the next moment */
    const order = location.protocol === 'file:' ? [APIS[1], APIS[0], APIS[2]] : APIS.slice();
    const tries = order.concat(order);
    for (let i = 0; i < tries.length; i++){
      const c = new AbortController(), t = setTimeout(() => c.abort(), WAIT);
      try {
        if (say) say('surveying the ground' + (i ? ' · try ' + (i + 1) : '') + '…');
        const r = await fetch(tries[i] + '?data=' + encodeURIComponent(q), {signal: c.signal});
        clearTimeout(t);
        if (!r.ok){ last = new Error('refused (' + r.status + ')'); continue; }
        const j = await r.json();
        return j.elements || [];
      } catch (e){ clearTimeout(t); last = e; }
    }
    throw new Error('no survey answered — ' + (last && last.message || 'unknown'));
  }

  /* ── the roads you can walk from the door ─────────────────────────────
     Ways share nodes where they join; the way nearest the address is the
     door's road, and everything reachable from it through shared nodes is
     kept. `seg` is that nearest segment, for the turn. */
  function connected(ways, la, lo){
    const key = n => n.lat.toFixed(6) + ',' + n.lon.toFixed(6);
    const byNode = {};
    ways.forEach((w, i) => { for (const n of w.geometry || []) (byNode[key(n)] = byNode[key(n)] || []).push(i); });
    let best = -1, bd = Infinity, seg = null;
    ways.forEach((w, i) => {
      const g = w.geometry || [];
      for (let k = 0; k + 1 < g.length; k++){
        const d = segDist(la, lo, g[k], g[k + 1]);
        if (d < bd){ bd = d; best = i; seg = [g[k], g[k + 1]]; }
      }
    });
    if (best < 0) return {keep: [], seg: null};
    const seen = new Set([best]), q = [best];
    while (q.length){
      const i = q.shift();
      for (const n of ways[i].geometry || []) for (const j of byNode[key(n)] || []) if (!seen.has(j)){ seen.add(j); q.push(j); }
    }
    return {keep: [...seen].map(i => ways[i]), seg};
  }
  function segDist(la, lo, a, b){
    const kx = Math.cos(la * Math.PI / 180);
    const ax = (a.lon - lo) * kx, ay = a.lat - la, bx = (b.lon - lo) * kx, by = b.lat - la;
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L));
    return Math.hypot(ax + dx * t, ay + dy * t);
  }

  /* ── square to the plate ───────────────────────────────────────────────
     The door's road, as it lies on the plate now, turned to the nearest
     of the four square headings. */
  function square(seg){
    const a = Basemap.worldOf(seg[0].lat, seg[0].lon), b = Basemap.worldOf(seg[1].lat, seg[1].lon);
    if (!a || !b) return 0;
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const want = Math.round(ang / (Math.PI / 2)) * (Math.PI / 2);
    const p = Basemap.placed();
    const rot = ((p && isFinite(p.rot)) ? p.rot : 0) + (want - ang);
    if (!isFinite(rot)) return 0;
    Basemap.setRot(rot);
    return (want - ang) * 180 / Math.PI;
  }

  /* ── to shapes ─────────────────────────────────────────────────────────
     A polyline is cut at the plate's edge into runs, each a line shape;
     a closed way is a warp with its blob in its own frame. */
  const inside = p => p[0] >= 0 && p[0] <= G.W && p[1] >= 0 && p[1] <= G.H;
  function clipRuns(pts){
    const runs = []; let run = [];
    for (let i = 0; i < pts.length; i++){
      const p = pts[i];
      if (inside(p)){ if (i > 0 && !inside(pts[i - 1])) run.push(edge(pts[i - 1], p)); run.push(p); }
      else { if (run.length){ run.push(edge(run[run.length - 1], p)); runs.push(run); run = []; } }
    }
    if (run.length) runs.push(run);
    return runs.filter(r => r.length >= 2);
  }
  /* the point where a segment from inside `a` to outside `b` leaves the plate */
  function edge(a, b){
    let t = 1;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    if (dx > 0) t = Math.min(t, (G.W - a[0]) / dx); else if (dx < 0) t = Math.min(t, -a[0] / dx);
    if (dy > 0) t = Math.min(t, (G.H - a[1]) / dy); else if (dy < 0) t = Math.min(t, -a[1] / dy);
    return [a[0] + dx * t, a[1] + dy * t];
  }
  const thin = (pts, min) => pts.filter((p, i) => i === 0 || i === pts.length - 1 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) >= min);

  function shapes(els, la, lo, doSquare){
    const cell = G.A.cell, out = [];
    const ways = els.filter(e => e.type === 'way' && e.geometry);
    const roads = ways.filter(MAIN);
    const {keep, seg} = connected(roads, la, lo);
    let turned = 0;
    if (seg && doSquare) turned = square(seg);     // not when the map was turned by hand
    const W = pts => pts.map(n => Basemap.worldOf(n.lat, n.lon)).filter(Boolean);
    const runs = [];
    for (const w of keep){
      const wd = Math.max(2, WIDTH[w.tags.highway] || 2);
      for (const run of clipRuns(W(w.geometry))){
        const rl = rule(run);
        if (!rl || rl.pts.length < 2) continue;
        runs.push({pts: rl.pts, ctrl: rl.ctrl, wd});
      }
    }
    const door = Basemap.worldOf(la, lo) || [G.W / 2, G.H / 2];
    for (const r of joined(runs, door))
      out.push({kind: 'road', type: 'line', pts: r.pts, ctrl: r.ctrl, width: cell * r.wd, exact: true, variant: 'mixed'});
    const isWater = w => w.tags && (w.tags.natural === 'water' || w.tags.water || w.tags.landuse === 'reservoir');
    const closed = w => w.geometry.length > 3 && w.geometry[0].lat === w.geometry[w.geometry.length - 1].lat && w.geometry[0].lon === w.geometry[w.geometry.length - 1].lon;
    for (const e of els){
      if (e.type === 'relation' && e.tags && e.tags.natural === 'water')
        for (const m of e.members || []) if (m.role === 'outer' && m.geometry) out.push(...poly(W(m.geometry), 'water', cell));
    }
    for (const w of ways){
      if (isWater(w) && closed(w)) out.push(...poly(W(w.geometry), 'water', cell));
      else if (w.tags && w.tags.natural === 'beach' && closed(w)) out.push(...poly(W(w.geometry), 'desert', cell));
      else if (w.tags && w.tags.waterway){
        const kind = w.tags.waterway === 'stream' ? 'creek' : 'river';
        for (const run of clipRuns(W(w.geometry)))
          out.push({kind, type: 'line', pts: thin(run, cell * 3), width: cell * (kind === 'river' ? 3 : 1.5), exact: true});
      }
    }
    /* the ground, and the rim. The ground is six rects, not one: a shape
       is generated in one pass of at most MAX_CELLS (26 000) cells and the
       plate is 93 000 (55 000 when it was four quarters), so a plate-sized
       field came out half drawn. Three across and two down keeps each
       under the ceiling with room; no feather, so they meet edge to edge.
       The whole plate, not just the rim's inside: what the boundary is
       pulled out over later has to already be there. */
    const seed = (Math.random() * 1e6) | 0;
    for (let qy = 0; qy < 2; qy++) for (let qx = 0; qx < 3; qx++)
      out.unshift({kind: 'grass', type: 'rect', x: G.W * (qx + 0.5) / 3, y: G.H * (qy + 0.5) / 2,
                   w: G.W / 3 + cell, h: G.H / 2 + cell, exact: true, variant: 'mixed', feather: 0, seed});
    const B = boundary();
    out.push({kind: 'boundary', type: 'ellipse', x: B.x, y: B.y, w: B.w, h: B.h, core: B.core, exact: true});
    return {out, turned, roads: keep.length, water: out.filter(s => s.kind === 'water').length};
  }
  function poly(pts, kind, cell){
    const p = pts.filter(inside);
    if (p.length < 4) return [];
    let cx = 0, cy = 0; for (const q of p){ cx += q[0]; cy += q[1]; } cx /= p.length; cy /= p.length;
    const blob = thin(p.map(q => [q[0] - cx, q[1] - cy]), cell);
    if (blob.length < 4) return [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of blob){ x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    return [{kind, type: 'warp', x: cx, y: cy, w: x1 - x0, h: y1 - y0, blob, exact: true}];
  }

  /* ── run ─────────────────────────────────────────────────────────────── */
  async function run(la, lo, say, opt){
    say = say || note; opt = opt || {};
    const bb = bbox();
    if (!bb) throw new Error('no map to survey — freeze one first');
    say('surveying the ground…');
    const els = await fetchAll(bb, say);
    const had = G.shapes.map(s => Object.assign({}, s, {exact: true}));   // the road-end stub, if any
    const {out, turned, roads, water} = shapes(els, la, lo, opt.square !== false);
    Build.lay(had.concat(out));
    Build.commit();
    if (typeof restampTerrain === 'function') restampTerrain();
    say(roads + ' roads, ' + water + ' waters' + (turned ? ', turned ' + turned.toFixed(0) + '°' : ''));
    return {roads, water, turned, at: Basemap.worldOf(la, lo)};
  }

  /* ── beside the road ──────────────────────────────────────────────────
     A house is not on the road; it stands beside it, on the side the
     address is. The nearest road run to the point and the side it lies on
     decide the direction; the road's half width, the house's half width
     and a cell of verge decide how far. A point already that far off is
     left where it is. */
  function aside(at, houseW){
    const roads = G.shapes.filter(s => s.kind === 'road' && s.pts && s.pts.length > 1);
    let best = null, bd = Infinity;
    for (const r of roads) for (let i = 0; i + 1 < r.pts.length; i++){
      const a = r.pts[i], b = r.pts[i + 1];
      const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1e-9;
      const t = Math.max(0, Math.min(1, ((at[0] - a[0]) * dx + (at[1] - a[1]) * dy) / L));
      const px = a[0] + dx * t, py = a[1] + dy * t, d = Math.hypot(at[0] - px, at[1] - py);
      if (d < bd){ bd = d; best = {a, b, px, py, dx, dy, w: r.width || G.A.cell * 2}; }
    }
    if (!best) return at;
    const need = best.w / 2 + houseW / 2 + G.A.cell;
    if (bd >= need) return at;
    const len = Math.hypot(best.dx, best.dy) || 1;
    let nx = -best.dy / len, ny = best.dx / len;                 // a normal to the road
    const side = (at[0] - best.px) * nx + (at[1] - best.py) * ny;
    if (side < 0){ nx = -nx; ny = -ny; }                       // the side the address is on
    return [best.px + nx * need, best.py + ny * need];
  }

  /* ── the rim ─────────────────────────────────────────────────────────
     An ellipse in the middle of the plate, half the plate's width and
     seven tenths of its height, with the door at its centre: a town
     starts small, and the boundary is the one shape you are meant to pull
     out as it grows (Eden, 2026-09-05: "the feathered grass border much
     smaller so it can be expanded later"). Its whole fade lies on the
     plate, so no edge cuts it — from 2026-08-28 to build 255 it was drawn
     larger than the plate, every edge inside the fade and the right edge
     least so, and on a plate narrower than the screen that read as the
     border cut off. The heart the fade holds off (`core`) is unchanged:
     the house and the roads at the door sit in it untouched. The survey
     lays the ground under the whole plate, so pulling the rim out finds
     grass, roads and water already there. */
  function boundary(){
    return {x: G.W / 2, y: G.H / 2, w: G.W * 0.5, h: G.H * 0.7, core: 0.55};
  }

  return {run, bbox, aside, boundary};
})();
