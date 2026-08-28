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
  const WIDTH = {motorway: 4, trunk: 4, primary: 3.2, secondary: 2.8, tertiary: 2.4, residential: 2,
                 unclassified: 2, service: 1.6, track: 1.4, path: 1.2, footway: 1.2, cycleway: 1.2, living_street: 2};

  /* ── the ground inside the plate ──────────────────────────────────── */
  function bbox(){
    const pts = [[0, 0], [G.W, 0], [0, G.H], [G.W, G.H]].map(p => Basemap.geoOf(p[0], p[1]));
    if (pts.some(p => !p)) return null;
    const la = pts.map(p => p[0]), lo = pts.map(p => p[1]);
    return [Math.min(...la), Math.min(...lo), Math.max(...la), Math.max(...lo)];
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
    const rot = (p ? p.rot : 0) + (want - ang);
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

  function shapes(els, la, lo){
    const cell = G.A.cell, out = [];
    const ways = els.filter(e => e.type === 'way' && e.geometry);
    const roads = ways.filter(w => w.tags && w.tags.highway);
    const {keep, seg} = connected(roads, la, lo);
    let turned = 0;
    if (seg) turned = square(seg);
    const W = pts => pts.map(n => Basemap.worldOf(n.lat, n.lon)).filter(Boolean);
    for (const w of keep){
      const wd = WIDTH[w.tags.highway] || 1.6;
      for (const run of clipRuns(W(w.geometry)))
        out.push({kind: 'road', type: 'line', pts: thin(run, cell * 2), width: cell * wd, exact: true, variant: 'mixed'});
    }
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
    /* the ground, and the rim */
    out.unshift({kind: 'grass', type: 'rect', x: G.W / 2, y: G.H / 2, w: G.W, h: G.H, exact: true, variant: 'mixed'});
    const sw = G.sheetW || G.W;
    out.push({kind: 'boundary', type: 'ellipse', x: sw / 2, y: G.H / 2, w: sw * 1.02, h: G.H * 1.02, exact: true});
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
  async function run(la, lo, say){
    say = say || note;
    const bb = bbox();
    if (!bb) throw new Error('no map to survey — freeze one first');
    say('surveying the ground…');
    const els = await fetchAll(bb, say);
    const had = G.shapes.map(s => Object.assign({}, s, {exact: true}));   // the road-end stub, if any
    const {out, turned, roads, water} = shapes(els, la, lo);
    Build.lay(had.concat(out));
    Build.commit();
    if (typeof restampTerrain === 'function') restampTerrain();
    say(roads + ' roads, ' + water + ' waters' + (turned ? ', turned ' + turned.toFixed(0) + '°' : ''));
    return {roads, water, turned, at: Basemap.worldOf(la, lo)};
  }

  return {run, bbox};
})();
