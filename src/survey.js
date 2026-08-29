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
  /* ── squared ────────────────────────────────────────────────────────
     A run is simplified to its bends and then every segment is turned to
     the nearest of 0, 22½, 45, 67½ and 90 degrees, each kept as long as
     its projection on that heading — so a road prints straight where the
     map has it straight, bends in those steps, and meets another at a
     right angle. The door's road, squared by the map's own turn, comes
     out exactly vertical or horizontal. */
  const STEP = Math.PI / 8;
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
  function rectify(run){
    const out = [run[0].slice()];
    for (let i = 1; i < run.length; i++){
      const a = out[out.length - 1], b = run[i];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const q = Math.round(Math.atan2(dy, dx) / STEP) * STEP;
      const len = dx * Math.cos(q) + dy * Math.sin(q);        // the segment on its heading
      if (len < G.A.cell) continue;
      out.push([a[0] + Math.cos(q) * len, a[1] + Math.sin(q) * len]);
    }
    return out.length > 1 ? out : run;
  }
  /* ── bend or curve ────────────────────────────────────────────────────
     Every inner vertex of a ruled run is assessed against the road as
     the map has it (`orig`, the run before it was simplified). A real
     road that ROUNDS the corner leaves its points inside the ruled angle,
     well off the vertex; one that turns there passes through it. So: the
     turn under 80° and the nearest original point further than .4 tile
     from the vertex → a curve — the vertex is pulled back along both legs
     and the middle leg bowed through where the vertex was, so the road
     arrives and leaves on the ruled headings and rounds between them.
     Sharper than that, or a road that goes through the corner, stays a
     corner: an intersection is square, and a bend that is a bend stays
     one. Returns {pts, ctrl}. */
  function bends(pts, orig){
    const ts = G.terr.tsz, out = [pts[0]], ctrl = [null];
    const near = v => { let d = Infinity; for (const o of orig) d = Math.min(d, Math.hypot(o[0] - v[0], o[1] - v[1])); return d; };
    for (let i = 1; i < pts.length - 1; i++){
      const p = out[out.length - 1], v = pts[i], n = pts[i + 1];
      const a1 = Math.atan2(v[1] - p[1], v[0] - p[0]), a2 = Math.atan2(n[1] - v[1], n[0] - v[0]);
      let turn = Math.abs(a2 - a1); if (turn > Math.PI) turn = 2 * Math.PI - turn;
      const cut = near(v);
      const curve = turn > Math.PI / 15 && turn < Math.PI * 80 / 180 && cut > ts * 0.4;
      if (!curve){ out.push(v); ctrl.push(null); continue; }
      const l1 = Math.hypot(v[0] - p[0], v[1] - p[1]), l2 = Math.hypot(n[0] - v[0], n[1] - v[1]);
      const d = Math.min(l1 / 2, l2 / 2, Math.max(ts, Math.min(ts * 3, cut * 2.2)));
      const q1 = [v[0] - Math.cos(a1) * d, v[1] - Math.sin(a1) * d], q2 = [v[0] + Math.cos(a2) * d, v[1] + Math.sin(a2) * d];
      out.push(q1); ctrl.push(v);        // the leg q1 → q2 bows through the corner
      out.push(q2); ctrl.push(null);
    }
    out.push(pts[pts.length - 1]);
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
        const sq = rectify(simplify(run, G.terr.tsz * 0.6));
        if (sq.length < 2) continue;
        const b = bends(sq, run);
        runs.push({pts: b.pts, ctrl: b.ctrl, wd});
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
    /* the ground, and the rim. The ground is four rects, not one: a shape
       is generated in one pass of at most MAX_CELLS (26 000) cells and the
       plate is 55 000, so a plate-sized field came out half drawn. Each
       quarter is under the ceiling; no feather, so they meet edge to edge. */
    const seed = (Math.random() * 1e6) | 0;
    for (let qy = 0; qy < 2; qy++) for (let qx = 0; qx < 2; qx++)
      out.unshift({kind: 'grass', type: 'rect', x: G.W * (qx + 0.5) / 2, y: G.H * (qy + 0.5) / 2,
                   w: G.W / 2 + cell, h: G.H / 2 + cell, exact: true, variant: 'mixed', feather: 0, seed});
    const sw = G.sheetW || G.W;
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
     An ellipse set so every edge of the plate lies inside its dithered
     fade and none inside its core: the top and bottom edges about four
     fifths of the way through the fade, the left edge past halfway, the
     right — where the plate carries its spare margin — only a quarter in,
     so the ground goes slowly there (Eden, 2026-08-28). Centred a little
     right of the plate's middle, which is what makes the two sides differ. */
  function boundary(){
    return {x: G.W * 0.55, y: G.H / 2, w: G.W * 1.35, h: G.H * 1.1, core: 0.55};
  }

  return {run, bbox, aside, boundary};
})();
