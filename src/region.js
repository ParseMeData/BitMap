'use strict';
/* ── the region ──────────────────────────────────────────────────────────
   Our region, drawn flat. One more plate — the same lattice, the same
   walk grid, the same walker, the same editor on a third registry — but
   not an atlas area: it is not a town, it is where the towns are.

   NORTH IS ALWAYS UP. The home plate is turned however the traced picture
   was turned when it was placed, and the compass says so; the region has
   no picture under it and no rotation, and the compass reads 0 while you
   are here. Every TOWN stands on it as diamonds — one for each plate in
   that town, side by side, so a town that has grown an extension plate
   wears two — at the town's anchor projected north-up. A town is a run of
   plates joined by their roads (`hq.atlas` links); its name is its home
   plate's. A town with no anchor stands along the foot of the plate, dim,
   until it is dragged into place in build mode, which pins every plate in
   it (src/atlas.js `setGeo`) — the one thing here that writes the atlas.

   Instead of roads there are LINKS: thin lines you draw between towns,
   and the only route the walker has here. Terrain is the town's terrain;
   nothing built, and no markers — a town on the region is a plate, and a
   plate is entered, not drawn. Stand by a town and press Enter and you are
   standing on its home plate. `gate` is where src/distract.js says no.

   Reached from the rose diamond on the hub, in place of the country
   (src/towns.js), which is a chip away in the tune panel; Esc leaves.
   Going in is a frame, exactly as going inside a building is: the half of
   the world that is not in storage is held while you are here and put
   back when you leave. Shapes under `hq.shapes.region`; the projection —
   where the plate's centre falls and how many degrees one world unit is —
   under `hq.region`.                                                    */

const Region = (() => {
  const SKEY = 'hq.shapes.region', MKEY = 'hq.markers.region', PKEY = 'hq.region';
  const REACH = 1.6;                   // walk tiles: how close counts as "by the town"
  /* ── the samples ──────────────────────────────────────────────────────
     Five real neighbours of Barwidgee, drawn dim on the region under
     their names so the plate can be looked at as it will look with towns
     on it (Eden, 2026-09-05: "add some placeholder towns so we can test
     this and view what it will look like when working"). Drawn only —
     not plates, not in the atlas, not entered, not walked to; and
     switched off with the Samples chip under Towns in the Tune panel
     (`hq.region.demo`), or left on until the real ones arrive. */
  const DEMO = [
    {name: 'Myrtleford',   lat: -36.5533, lon: 146.7233},
    {name: 'Yackandandah', lat: -36.3136, lon: 146.8386},
    {name: 'Beechworth',   lat: -36.3597, lon: 146.6867},
    {name: 'Bright',       lat: -36.7297, lon: 146.9598},
    {name: 'Wangaratta',   lat: -36.3575, lon: 146.3125},
    /* and two groups far beyond the plate, to see how what is off the
       map is shown: a city and its suburbs, a river town and the Mallee
       towns round it (Eden's own examples) */
    {name: 'Melbourne',  lat: -37.8136, lon: 144.9631, group: 'Melbourne'},
    {name: 'Footscray',  lat: -37.7996, lon: 144.9005, group: 'Melbourne'},
    {name: 'Brunswick',  lat: -37.7667, lon: 144.9603, group: 'Melbourne'},
    {name: 'Richmond',   lat: -37.8230, lon: 145.0000, group: 'Melbourne'},
    {name: 'St Kilda',   lat: -37.8678, lon: 144.9740, group: 'Melbourne'},
    {name: 'Mildura',    lat: -34.1855, lon: 142.1625, group: 'Mildura'},
    {name: 'Red Cliffs', lat: -34.3097, lon: 142.1880, group: 'Mildura'},
    {name: 'Merbein',    lat: -34.1697, lon: 142.0669, group: 'Mildura'},
    {name: 'Irymple',    lat: -34.2320, lon: 142.1720, group: 'Mildura'}];
  /* the samples' links — where a road would leave one plate for another */
  const DEMO_LINKS = [['Barwidgee', 'Myrtleford'], ['Myrtleford', 'Bright'], ['Myrtleford', 'Beechworth'],
                      ['Beechworth', 'Yackandandah'], ['Beechworth', 'Wangaratta'],
                      ['Myrtleford', 'Melbourne'], ['Wangaratta', 'Mildura']];
  const DKEY = 'hq.region.demo';
  const demo = () => { try { return Store.get(DKEY) !== '0'; } catch (e){ return true; } };
  const SPAN = 0.6;                    // degrees of longitude across the plate's shorter side, by default
  const STEP = 0.0125;                 // one atlas step, as src/atlas.js has it
  const BONE = [0.93, 0.92, 0.89], FLARE = [1, 0.373, 0.635], DIM = [0.353, 0.353, 0.4];
  const GROUND = [0.106, 0.106, 0.129];
  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };

  let frame = null;                    // where we came from, while we are here
  let P = Store.json(PKEY, null);      // {lat0, lon0, scale}
  let held = null;                     // a town being dragged: {town, x, y}
  let shown = null;
  const on = () => !!frame;

  /* ── the towns ─────────────────────────────────────────────────────────
     A town is a connected run of plates. Links are written on both plates
     when a plate is opened, but a graph is read both ways here anyway, so
     a link that only one side remembers still joins. Home is the root of
     its town; otherwise the plate that came first. */
  function towns(){
    const areas = Atlas.areas(), ids = Object.keys(areas);
    const adj = {}; for (const id of ids) adj[id] = new Set();
    for (const id of ids) for (const l of areas[id].links || [])
      if (areas[l.to]){ adj[id].add(l.to); adj[l.to].add(id); }
    const seen = {}, out = [];
    for (const id of ids){
      if (seen[id]) continue;
      const comp = [], q = [id]; seen[id] = 1;
      while (q.length){ const a = q.shift(); comp.push(a); for (const b of adj[a]) if (!seen[b]){ seen[b] = 1; q.push(b); } }
      const root = comp.indexOf('home') >= 0 ? 'home' : comp[0];
      const plates = [root].concat(comp.filter(x => x !== root));
      let lat = 0, lon = 0, n = 0;
      for (const pid of plates){ const g = Atlas.geo(pid); if (g){ lat += g.lat; lon += g.lon; n++; } }
      /* the home town is named by its title (`hq.town`, what the plate's
         lettering says) when it has one: the atlas area stays 'Home',
         which is what the region showed under Barwidgee's diamond */
      const title = root === 'home' && typeof Store !== 'undefined' ? String(Store.get('hq.town') || '').trim() : '';
      out.push({root, name: title || areas[root].name, plates, geo: n ? {lat: lat / n, lon: lon / n} : null,
                here: plates.indexOf(Atlas.current()) >= 0});
    }
    return out;
  }

  /* ── where on the plate a place falls ─────────────────────────────────
     A flat projection: longitude across, scaled by the cosine of the
     latitude so a kilometre is the same length either way, latitude up.
     Centred on home's anchor the first time there is one to centre on,
     and never moved by itself after that. */
  function proj(){
    if (P) return P;
    const g = Atlas.geo('home') || (towns().find(t => t.geo) || {}).geo;
    if (!g || !G.W) return null;
    /* off the shorter side, so the wider plate (build 256) shows the same
       reach north to south it always did and more east to west, rather
       than the same east to west and less of the rest */
    P = {lat0: g.lat, lon0: g.lon, scale: SPAN / Math.min(G.W, G.H)};
    Store.save(PKEY, P, 'the region');
    return P;
  }
  /* ── the view ──────────────────────────────────────────────────────────
     Where the region is looked at from: home's anchor until a cluster at
     the edge is opened, and then that group's middle — the projection's
     own centre stays what `hq.region` keeps, this is only the eye.
     Opening a cluster is a change of view, and the towns move to where
     they stand from there: the group spreads out on the plate and what
     was on the plate gathers at the edge (Eden, 2026-09-05: "when a
     cluster is opened this expands this region and then closes the
     previous region into its own cluster"). */
  let view = null;
  function eye(){
    const p = proj(); if (!p) return null;
    if (!view) view = {lat: p.lat0, lon: p.lon0};
    return {lat: view.lat, lon: view.lon, scale: p.scale};
  }
  const toXY = g => {
    const p = eye(); if (!p) return null;
    return [G.W / 2 + (g.lon - p.lon) * Math.cos(p.lat * Math.PI / 180) / p.scale,
            G.H / 2 - (g.lat - p.lat) / p.scale];
  };
  const toGeo = (x, y) => {
    const p = eye(); if (!p) return null;
    return {lat: p.lat - (y - G.H / 2) * p.scale,
            lon: p.lon + (x - G.W / 2) * p.scale / Math.cos(p.lat * Math.PI / 180)};
  };

  /* every town with a spot on the plate: anchored ones where they fall,
     the rest in a row along the foot; a town being dragged is where the
     pointer has it */
  function spots(){
    const ts = G.terr ? G.terr.tsz : 12;
    const out = []; let k = 0;
    for (const t of towns()){
      let xy = t.geo ? toXY(t.geo) : null;
      const anchored = !!xy;
      if (!xy) xy = [ts * 3 + (k++) * ts * 6, (G.terr.th - 2.5) * ts];
      if (held && held.town.root === t.root) xy = [held.x, held.y];
      const pitch = radius() * 2.3, w = (t.plates.length - 1) * pitch;
      out.push({town: t, x: xy[0], y: xy[1], x0: xy[0] - w / 2, pitch, anchored});
    }
    return out;
  }

  /* ── drawn ─────────────────────────────────────────────────────────────
     Bone diamonds with a halo, flare for the town you came from, dim for
     one with no anchor; the name beneath out of the marker sheet. */
  /* ── how big a town is ─────────────────────────────────────────────────
     A town's diamond was two fifths of a walk tile with a seven-pixel
     floor — 14 units across, and its name half that tall — which on the
     region, where a town is the smallest thing on an otherwise empty
     plate, read as a speck with a smudge under it (Eden, 2026-09-05:
     "the icons and text were too small"). Sized for the screen now: the
     diamond 36 px across at the working zoom and never under that, the
     name 14 px tall, and a town's plates spaced to the diamond so a
     grown town's two never touch. Hit-testing and spacing read the same
     number, so what you can press is what you can see. */
  const radius = () => Math.max(G.terr.tsz * 1.4, 18 / (G.cam[2] || 1));
  /* ── off the map ──────────────────────────────────────────────────────
     A town whose place falls beyond the plate cannot stand where it is,
     and the region is not the country: Melbourne is not going to fit at
     this scale. So it stands at the plate's edge, in its true direction
     from the middle, and towns beyond the edge in the one direction — a
     city and its suburbs, a river town and the towns round it — gather
     into one cluster there: their diamonds locked together in a diamond
     of diamonds with a gap between, the way the hub is made, under one
     name and a count (Eden, 2026-09-05). A sample carries its group; a
     real town is its own until its edge place lands within six radii of
     another's. The compass's corner is kept clear: a cluster that would
     land in it is moved on along the edge it came to. Enter on a cluster
     opens it — see `open`. */
  const CELLS = (() => {
    const pts = [];
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (Math.abs(i) + Math.abs(j) <= 2) pts.push([i, j]);
    return pts.sort((a, b) => (Math.abs(a[0]) + Math.abs(a[1])) - (Math.abs(b[0]) + Math.abs(b[1])) || Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
  })();
  function edge(P, C, mx, my, mb){
    const dx = P[0] - C[0], dy = P[1] - C[1];
    let t = Infinity, side = null;
    if (dx > 0){ const k = (G.W - mx - C[0]) / dx; if (k < t){ t = k; side = 'x'; } }
    else if (dx < 0){ const k = (mx - C[0]) / dx; if (k < t){ t = k; side = 'x'; } }
    if (dy > 0){ const k = (G.H - (mb || my) - C[1]) / dy; if (k < t){ t = k; side = 'y'; } }
    else if (dy < 0){ const k = (my - C[1]) / dy; if (k < t){ t = k; side = 'y'; } }
    if (!isFinite(t)) return {x: C[0], y: C[1], side: null};
    const x = C[0] + dx * t, y = C[1] + dy * t;
    /* the keys panel has the foot of the plate's right-hand third
       (index.html #keys): a place that lands under it is lifted clear */
    if (side === 'y' && dy > 0 && x > G.W * 0.64) return {x, y: Math.min(y, G.H - (mb || my) - (mb || my) * 0.6), side};
    return {x, y, side};
  }
  /* every town's place from the eye: the real ones on the plate as
     `spots()` has them, the samples, and the clusters at the edge —
     with `where`, a name → place map the links are drawn from */
  function layout(r){
    /* the margins: a diamond and its name clear of the edge, and at the
       foot of the plate clear of the chrome that stands there — the hub,
       the meters, the keys */
    const C = [G.W / 2, G.H / 2], mx = r * 3, my = r * 3.5, mb = r * 7;
    const inside = xy => xy[0] >= mx && xy[0] <= G.W - mx && xy[1] >= my && xy[1] <= G.H - mb;
    const where = new Map(), on = [], off = [];
    for (const sp of spots()){
      const name = String(sp.town.name || '');
      if (inside([sp.x, sp.y])){ on.push({sp, name}); where.set(name.toLowerCase(), [sp.x, sp.y]); }
      else off.push({name, group: name, sample: false, xy: [sp.x, sp.y], geo: sp.town.geo});
    }
    if (demo()){
      for (const d of DEMO){
        if (where.has(d.name.toLowerCase())) continue;
        const xy = toXY(d);
        if (!xy) continue;
        if (inside(xy)){ on.push({name: d.name, x: xy[0], y: xy[1], sample: true}); where.set(d.name.toLowerCase(), xy); }
        else off.push({name: d.name, group: d.group || d.name, sample: true, xy, geo: {lat: d.lat, lon: d.lon}});
      }
    }
    /* the clusters: by group, then groups whose edge places fall together */
    const groups = new Map();
    for (const o of off){
      const at = edge(o.xy, C, mx, my, mb);
      const g = groups.get(o.group) || {name: o.group, members: [], sx: 0, sy: 0, sample: o.sample, side: at.side};
      g.members.push(o); g.sx += at.x; g.sy += at.y;
      groups.set(o.group, g);
    }
    let clusters = [...groups.values()].map(g => ({name: g.name, members: g.members, sample: g.sample, side: g.side,
                                                   x: g.sx / g.members.length, y: g.sy / g.members.length}));
    for (let a = 0; a < clusters.length; a++)
      for (let b = clusters.length - 1; b > a; b--){
        const A = clusters[a], B = clusters[b];
        if (Math.hypot(A.x - B.x, A.y - B.y) > r * 6) continue;
        const n = A.members.length, k = B.members.length;
        A.x = (A.x * n + B.x * k) / (n + k); A.y = (A.y * n + B.y * k) / (n + k);
        A.members = A.members.concat(B.members); A.sample = A.sample && B.sample;
        clusters.splice(b, 1);
      }
    /* the compass has the top-left corner */
    const cx = typeof Compass !== 'undefined' && Compass.at ? Compass.at() : [0, 0];
    const cw = cx[0] * 2 + r * 1.5, ch = cx[1] * 2 + r * 1.5;
    for (const cl of clusters){
      if (cl.x < cw && cl.y < ch){ if (cl.side === 'y') cl.x = cw; else cl.y = ch; }
      where.set(cl.name.toLowerCase(), [cl.x, cl.y]);
      for (const o of cl.members) where.set(o.name.toLowerCase(), [cl.x, cl.y]);
    }
    return {on, clusters, where};
  }

  /* ── what a thing is made of ───────────────────────────────────────────
     A little chance, seeded by a name so it never flickers: each diamond
     a shade brighter or dimmer and a touch warmer or cooler than its
     colour, with a small lit facet up and to the left; and each link a
     curve of its own — bowed to one side by an amount of its own, now
     and then swinging back the other way, with a slow wave along it —
     rather than the one arc every pair got, which read as drawn by a
     rule (Eden, 2026-09-05: "the lines seem very clean and symmetrical
     which feels artificial … give the diamonds a subtle variation in
     shading and colour"). */
  const rnd = (seed, k) => { const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  const seedOf = str => { let h = 2166136261; for (let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return (h % 100000) / 100; };
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const WARM = [1, 0.93, 0.84], COOL = [0.86, 0.93, 1];
  function shade(col, name){
    const sd = seedOf(String(name)), b = 0.9 + 0.2 * rnd(sd, 1), w = (rnd(sd, 2) - 0.5) * 0.36;
    const c = col.map(v => Math.min(1, v * b)), t = w > 0 ? WARM : COOL;
    return mix(c, c.map((v, i) => v * t[i]), Math.abs(w));
  }
  /* a diamond with its facet */
  function gem(a, m, x, y, r, col, al, cap){
    if (m > cap - 2) return m;
    m = put(a, m, x, y, col[0], col[1], col[2], al, r, 0, 0, 0, 1);
    const hi = mix(col, BONE, 0.5);
    return put(a, m, x - r * 0.14, y - r * 0.14, hi[0], hi[1], hi[2], al * 0.4, r * 0.48, 0, 0, 0, 1);
  }
  /* the bend a drawn link takes between two points (build.js bowLink):
     to one side by a twelfth to a ninth of the run, the side and the
     amount its own */
  function bow(A, B){
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1;
    const sd = seedOf(Math.round(A[0]) + ',' + Math.round(A[1]) + ',' + Math.round(B[0]) + ',' + Math.round(B[1]));
    const side = rnd(sd, 1) < 0.5 ? -1 : 1, k = 1 / 12 + rnd(sd, 2) / 36;
    return [(A[0] + B[0]) / 2 - dy / L * L * k * side, (A[1] + B[1]) / 2 + dx / L * L * k * side];
  }
  /* a sample's link: a thin run of the plate's own diamonds in bone,
     brighter at the two towns and quieter along the way, along a curve
     of its own — trimmed a diamond and a half short of either town */
  function curve(a, m, A, B, seed, al0, r, cap){
    const cell = G.A.cell, dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy);
    const trim = r * 1.5;
    if (L <= trim * 2 + cell) return m;
    const nx = -dy / L, ny = dx / L;
    const side = rnd(seed, 1) < 0.5 ? -1 : 1;
    const a1 = side * L * (0.05 + 0.07 * rnd(seed, 2));
    const a2 = (rnd(seed, 3) < 0.7 ? side : -side) * L * (0.02 + 0.07 * rnd(seed, 4));
    const P1 = [A[0] + dx / 3 + nx * a1, A[1] + dy / 3 + ny * a1];
    const P2 = [A[0] + 2 * dx / 3 + nx * a2, A[1] + 2 * dy / 3 + ny * a2];
    const wf = 1 + Math.round(rnd(seed, 5)), wp = rnd(seed, 6) * Math.PI * 2, wa = L * 0.012;
    const n = Math.max(2, Math.round((L - trim * 2) / (cell * 0.6)));
    if (m > cap - n - 1) return m;
    const t0 = trim / L, t1 = 1 - trim / L;
    for (let i = 0; i <= n; i++){
      const t = t0 + (t1 - t0) * i / n, u = 1 - t, al = (0.32 + 0.4 * Math.abs(2 * t - 1)) * al0;
      const w = wa * Math.sin(Math.PI * 2 * wf * t + wp);
      const x = u * u * u * A[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * B[0] + nx * w;
      const y = u * u * u * A[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * B[1] + ny * w;
      m = put(a, m, x, y, BONE[0], BONE[1], BONE[2], al, cell * 0.5, 0, 0, 0, 1);
    }
    return m;
  }

  /* ── the scene ─────────────────────────────────────────────────────────
     Everything the region draws, as a list of things with keys — a
     diamond per town or member, a label per town or cluster, a link per
     pair — built from the eye's layout each frame. Two scenes can be
     blended by key, which is how opening a cluster is animated: the
     scene before the eye moved and the scene from where it is now, each
     diamond travelling from the one place to the other, labels and
     links fading between. */
  function scene(){
    const z = G.cam[2], px = 1 / z, r = radius(), ls = Math.max(r * 0.4, 7 * px);
    const L = layout(r);
    const gems = [], labels = [], links = [], pos = new Map();
    const Q = typeof Quest !== 'undefined' ? Quest : null;
    for (const e of L.on){
      const lname = e.name.toLowerCase();
      if (e.sample){
        gems.push({key: 'g:' + lname, x: e.x, y: e.y, r, col: shade(DIM, e.name), al: 0.8});
        labels.push({key: 'l:' + lname, text: e.name.toUpperCase(), x: e.x, y: e.y + r * 2 + ls * 1.3, size: ls, col: DIM, al: 0.75});
        pos.set(lname, [e.x, e.y]);
        continue;
      }
      const sp = e.sp, c = sp.town.here ? FLARE : sp.anchored ? BONE : DIM;
      for (let i = 0; i < sp.town.plates.length; i++){
        const x = sp.x0 + i * sp.pitch, pid = sp.town.plates[i];
        /* a plate that is a letter of the region wears its letter's tone,
           and the letter itself, in the plate's own ground colour */
        const Lq = Q ? Q.letter(pid) : null;
        const cc = Lq ? Lq.tone : c;
        gems.push({key: 'g:' + lname + (i ? '#' + i : ''), x, y: sp.y, r, col: shade(cc, e.name + i), al: sp.anchored ? 1 : 0.7,
                   halo: cc, letter: Lq ? Lq.ch : null, here: !!(sp.town.here && Lq), quest: !!(Q && Q.targetPlate() === pid)});
      }
      labels.push({key: 'l:' + lname, text: e.name.toUpperCase(), x: sp.x, y: sp.y + r * 2 + ls * 1.3, size: ls, col: c, al: 0.9});
      pos.set(lname, [sp.x, sp.y]);
    }
    for (const cl of L.clusters){
      const rm = r * 0.55, g = rm * 2.3, col = cl.sample ? DIM : BONE, n = Math.min(cl.members.length, CELLS.length);
      for (let k = 0; k < n; k++){
        const o = cl.members[k];
        gems.push({key: 'g:' + o.name.toLowerCase(), x: cl.x + CELLS[k][0] * g, y: cl.y + CELLS[k][1] * g, r: rm,
                   col: shade(col, o.name), al: cl.sample ? 0.8 : 1});
      }
      const ext = (n > 5 ? 2 : n > 1 ? 1 : 0) * g + rm;
      const text = cl.name.toUpperCase() + (cl.members.length > 1 ? ' ' + cl.members.length : '');
      const below = cl.y + ext + ls * 1.6, y = below + ls > G.H - r ? cl.y - ext - ls * 1.6 : below;
      labels.push({key: 'c:' + cl.name.toLowerCase(), text, x: cl.x, y, size: ls * 0.9, col, al: cl.sample ? 0.75 : 0.9});
      pos.set(cl.name.toLowerCase(), [cl.x, cl.y]);
      for (const o of cl.members) pos.set(o.name.toLowerCase(), [cl.x, cl.y]);
    }
    if (demo())
      for (const [p, q] of DEMO_LINKS){
        const A = pos.get(p.toLowerCase()), B = pos.get(q.toLowerCase());
        if (A && B) links.push({key: 'k:' + [p, q].map(t => t.toLowerCase()).sort().join('|'), A, B, seed: seedOf(p + '|' + q), al: 1});
      }
    return {r, ls, gems, labels, links, pos, L};
  }
  const ease = k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const lerp2 = (a, b, k) => a + (b - a) * k;
  function blend(S0, S1, k){
    const out = {r: S1.r, ls: S1.ls, gems: [], labels: [], links: [], pos: S1.pos, L: S1.L};
    const m0 = new Map(S0.gems.map(g => [g.key, g]));
    for (const g1 of S1.gems){
      const g0 = m0.get(g1.key);
      out.gems.push(!g0 ? Object.assign({}, g1, {al: g1.al * k})
        : Object.assign({}, k < 0.5 ? g0 : g1, {x: lerp2(g0.x, g1.x, k), y: lerp2(g0.y, g1.y, k), r: lerp2(g0.r, g1.r, k),
                                                 col: mix(g0.col, g1.col, k), al: lerp2(g0.al, g1.al, k)}));
      m0.delete(g1.key);
    }
    for (const g0 of m0.values()) out.gems.push(Object.assign({}, g0, {al: g0.al * (1 - k)}));
    const l0 = new Map(S0.labels.map(l => [l.key, l]));
    for (const l1 of S1.labels){
      const a = l0.get(l1.key);
      out.labels.push(!a ? Object.assign({}, l1, {al: l1.al * k})
        : Object.assign({}, l1, {x: lerp2(a.x, l1.x, k), y: lerp2(a.y, l1.y, k), size: lerp2(a.size, l1.size, k), al: lerp2(a.al, l1.al, k)}));
      l0.delete(l1.key);
    }
    for (const a of l0.values()) out.labels.push(Object.assign({}, a, {al: a.al * (1 - k)}));
    const k0 = new Map(S0.links.map(l => [l.key, l]));
    for (const l1 of S1.links){
      const a = k0.get(l1.key);
      out.links.push(!a ? Object.assign({}, l1, {al: k})
        : Object.assign({}, l1, {A: [lerp2(a.A[0], l1.A[0], k), lerp2(a.A[1], l1.A[1], k)], B: [lerp2(a.B[0], l1.B[0], k), lerp2(a.B[1], l1.B[1], k)]}));
      k0.delete(l1.key);
    }
    for (const a of k0.values()) out.links.push(Object.assign({}, a, {al: 1 - k}));
    return out;
  }
  function emit(a, m, S, cap){
    for (const g of S.gems){
      if (m > cap - 6) break;
      if (g.halo) m = put(a, m, g.x, g.y, g.halo[0], g.halo[1], g.halo[2], 0.3 * g.al, g.r * 2.0, 0, 0, 0, 2);
      m = gem(a, m, g.x, g.y, g.r, g.col, g.al, cap);
      if (g.letter) m = Markers.text(a, m, g.letter, g.x, g.y, g.r * 0.55, GROUND, g.al, cap);
      if (g.here) m = put(a, m, g.x, g.y, FLARE[0], FLARE[1], FLARE[2], 0.9 * g.al, g.r * 1.4, 1, 0, 0, 1);
      if (g.quest) m = put(a, m, g.x, g.y, 0.95, 0.76, 0.31, (0.7 + 0.3 * Math.sin(performance.now() / 300)) * g.al, g.r * 1.9, 1, 0, 0, 1);
    }
    for (const l of S.labels){
      if (m > cap - l.text.length - 1) break;
      m = Markers.text(a, m, l.text, l.x - (l.text.length - 1) * l.size * 1.06 / 2, l.y, l.size, l.col, l.al, cap);
    }
    for (const l of S.links) m = curve(a, m, l.A, l.B, l.seed, l.al === undefined ? 1 : l.al, S.r, cap);
    return m;
  }

  /* ── drawn ─────────────────────────────────────────────────────────────
     The scene from the eye — or, while a cluster is being opened, the
     scene it left blended into the one it is arriving at. */
  let trans = null;                         // {t0, dur, from: scene}
  function overlay(a, m, cap){
    if (!frame || !G.terr) return m;
    let S = scene();
    if (trans){
      const k = (performance.now() - trans.t0) / trans.dur;
      if (k >= 1) trans = null;
      else S = blend(trans.from, S, ease(Math.max(0, k)));
    }
    return emit(a, m, S, cap);
  }

  /* ── opened ────────────────────────────────────────────────────────────
     Enter on a cluster: the eye moves to the middle of its towns, the
     scene it leaves is kept and blended into the one it arrives at over
     nine tenths of a second, and the walker glides to the town the
     cluster was named for. What was on the plate is now beyond it and
     gathers at the edge on its own — the home town's cluster is the way
     back. */
  function open(cl){
    const geo = cl.members.map(o => o.geo).filter(g => g && isFinite(g.lat) && isFinite(g.lon));
    if (!geo.length){ note('nowhere to open — those towns have no place yet'); return false; }
    trans = {t0: performance.now(), dur: 900, from: scene()};
    view = {lat: geo.reduce((s, g) => s + g.lat, 0) / geo.length, lon: geo.reduce((s, g) => s + g.lon, 0) / geo.length};
    const S = scene(), name = cl.name.toLowerCase();
    const at = S.pos.get(name) || [G.W / 2, G.H / 2];
    glide(at);
    const there = S.L.on.find(e => e.name.toLowerCase() === name);
    stood = there && there.sample ? {x: there.x, y: there.y, name: there.name, sample: true} : null;
    shown = null;
    note(cl.name + ' opened · ' + cl.members.length + (cl.members.length === 1 ? ' town' : ' towns'));
    return true;
  }
  /* ── the walker glides ─────────────────────────────────────────────────
     A hop is one long step: the game's own stride, from where the walker
     stands to the town's tile, its spring at the end — so the sprite
     travels rather than appears (Eden, 2026-09-05: "animation for our
     sprite moving from one section to the other"). A tile takes 0.14 s;
     a hop takes three to seven of those, by its length. */
  function glide(at){
    const ts = G.terr.tsz;
    const cur = G.moving ? [G.tx, G.ty] : toWorld(G.x, G.y);
    G.x = Math.max(0, Math.min(G.terr.tw - 1, Math.round(at[0] / ts - 0.5)));
    G.y = Math.max(0, Math.min(G.terr.th - 1, Math.round(at[1] / ts - 0.5)));
    const to = toWorld(G.x, G.y);
    G.fx = cur[0]; G.fy = cur[1]; G.tx = to[0]; G.ty = to[1];
    const tiles = Math.hypot(to[0] - cur[0], to[1] - cur[1]) / ts;
    G.stepScale = Math.max(3, Math.min(7, tiles / 5));
    G.stepT = 0; G.moving = true; G.bump = false; G.perch = null;
    G.hold = null;                                                  // the camera comes along
  }

  /* ── the arrows hop between towns ──────────────────────────────────────
     On the region an arrow takes the walker to the nearest town in that
     direction — a real one, a sample, or a cluster at the edge — and
     WASD still walks the links (Eden, 2026-09-05). Nearest by distance
     among those within sixty degrees of the arrow and beyond reach of
     where the walker stands; the walker glides there, the camera
     follows, and Enter is Enter. Taken in the capture phase, as build
     mode takes its arrows, so the walk never sees the key. */
  let stood = null;                         // the sample or cluster the walker was last put by
  function places(){
    const L = layout(radius());
    const out = [];
    for (const e of L.on) out.push(e.sample ? {x: e.x, y: e.y, name: e.name, sample: true}
                                            : {x: e.sp.x, y: e.sp.y, name: e.name, town: e.sp.town});
    for (const cl of L.clusters) out.push({x: cl.x, y: cl.y, name: cl.name, cluster: cl});
    return out;
  }
  function hop(dx, dy){
    if (!frame || !G.terr) return false;
    const w = G.moving ? [G.tx, G.ty] : toWorld(G.x, G.y), ts = G.terr.tsz;
    let best = null, bd = Infinity;
    for (const p of places()){
      const vx = p.x - w[0], vy = p.y - w[1], d = Math.hypot(vx, vy);
      if (d <= ts * REACH) continue;                                // the one we stand by
      if ((vx * dx + vy * dy) / d < 0.5) continue;                  // not that way
      if (d < bd){ bd = d; best = p; }
    }
    if (!best){ note('no town that way'); return false; }
    glide([best.x, best.y]);
    stood = best.town ? null : best;
    shown = null;                                                   // the hint reads the new place
    return true;
  }
  function wireKeys(){
    addEventListener('keydown', e => {
      if (!frame || G.paused || !/^Arrow(Up|Down|Left|Right)$/.test(e.code)) return;
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (typeof Build !== 'undefined' && Build.active && Build.active()) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat) return;
      hop(e.code === 'ArrowRight' ? 1 : e.code === 'ArrowLeft' ? -1 : 0, e.code === 'ArrowDown' ? 1 : e.code === 'ArrowUp' ? -1 : 0);
    }, true);
  }

  /* ── dragged ───────────────────────────────────────────────────────────
     The region is a map, and a map is dragged: a press on the plate that
     is not the builder's and not the HUD's carries the camera with the
     hand, and holds it there (`G.hold`, game.js) until the walker takes
     a step or the region is left (Eden, 2026-09-05: "make it so we can
     drag the zoomed out map"). */
  let pan = null;
  function wireDrag(){
    canvas.addEventListener('pointerdown', e => {
      if (!frame || e.button !== 0 || G.paused) return;
      if (typeof Build !== 'undefined' && Build.active && Build.active()) return;
      pan = {x: e.clientX, y: e.clientY, cx: G.cam[0], cy: G.cam[1], moved: false, id: e.pointerId};
    });
    canvas.addEventListener('pointermove', e => {
      if (!pan || !frame) return;
      const b = canvas.getBoundingClientRect(), dpr = VW / (b.width || 1), z = G.cam[2] / dpr;
      const sx = e.clientX - pan.x, sy = e.clientY - pan.y;
      if (!pan.moved){ if (Math.hypot(sx, sy) < 3) return; pan.moved = true; try { canvas.setPointerCapture(pan.id); } catch (err){} }
      G.hold = [pan.cx - sx / z, pan.cy - sy / z];
      G.cam[0] = G.camT[0] = G.hold[0]; G.cam[1] = G.camT[1] = G.hold[1];   // no easing under the hand
    });
    const up = () => { pan = null; };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }

  /* the town the walker is standing by */
  function target(){
    if (!frame || !G.terr) return null;
    const w = toWorld(G.x, G.y), ts = G.terr.tsz;
    let best = null, bd = ts * REACH;
    for (const sp of spots()){
      const dx = Math.max(0, Math.abs(w[0] - sp.x) - (sp.town.plates.length - 1) * sp.pitch / 2);
      const d = Math.hypot(dx, w[1] - sp.y);
      if (d <= bd){ bd = d; best = sp.town; }
    }
    return best;
  }
  function prompt(){
    const el = $('#enterhint');
    if (!el || !frame || WALL) return;
    const t = G.paused ? null : target();
    /* by a sample or a cluster instead: said, with nothing to press */
    let by = null;
    if (!t && stood && !G.paused){
      const w = toWorld(G.x, G.y);
      if (Math.hypot(w[0] - stood.x, w[1] - stood.y) <= G.terr.tsz * REACH) by = stood;
    }
    const key = t ? t.root + '|' + t.name : by ? 'by|' + by.name : '';
    if (key === shown) return;
    shown = key;
    el.hidden = !t && !by;
    if (!t && !by) return;
    el.innerHTML = '';
    if (by){
      if (by.cluster){
        const e = document.createElement('em'); e.textContent = 'Enter';
        const n = document.createElement('span');
        n.textContent = 'open ' + by.name + ' · ' + by.cluster.members.length + (by.cluster.members.length === 1 ? ' town' : ' towns') + ' beyond the plate';
        el.append(e, n);
      } else {
        const n = document.createElement('span');
        n.textContent = by.name + ' · a sample, not a town yet';
        el.append(n);
      }
      return;
    }
    const e = document.createElement('em'); e.textContent = 'Enter';
    const n = document.createElement('span');
    n.textContent = (t.here ? 'back to ' : 'go to ') + (t.name || t.root) +
                    (t.plates.length > 1 ? ' · ' + t.plates.length + ' plates' : '');
    el.append(e, n);
  }

  /* ── in ── */
  function enter(){
    if (frame) return true;
    if (!G.terr) return false;
    if (typeof Interior !== 'undefined' && Interior.inside()){ note('the region is outside — leave the building first'); return false; }
    Build.commit(); Markers.commit();
    frame = {
      scope: Kinds.scope(), skey: Build.key(), mkey: Markers.key(), blank: BLANK,
      x: G.x, y: G.y, cam: G.cam.slice(), camT: G.camT.slice(),
      sparks: G.sparks, got: G.got, total: G.total, round: G.round,
      clock: G.clock, steps: G.steps, over: G.over, msg: G.msg
    };
    Basemap.suspend(true);
    document.body.classList.add('region');
    Markers.mount(MKEY);
    Build.mount('region', SKEY);
    setBlank(true, false);
    G.round = 1; G.msg = ''; G.over = false;
    spawn();
    G.total = 12;
    scatterSparks();
    if (typeof Hud !== 'undefined' && Hud.fold) Hud.fold();
    banner();
    return true;
  }
  /* ── out ── */
  function leave(){
    G.hold = null; view = null; trans = null; stood = null;
    if (!frame) return false;
    Build.commit(); Markers.commit();
    const f = frame; frame = null; held = null;
    document.body.classList.remove('region');
    Markers.mount(f.mkey);
    Build.mount(f.scope, f.skey);
    setBlank(f.blank, false);
    G.x = f.x; G.y = f.y;
    const w = toWorld(G.x, G.y);
    G.fx = G.tx = w[0]; G.fy = G.ty = w[1];
    G.moving = false; G.stepT = 1;
    G.cam = f.cam; G.camT = f.camT;
    G.sparks = f.sparks; G.got = f.got; G.total = f.total; G.round = f.round;
    G.clock = f.clock; G.steps = f.steps; G.over = f.over; G.msg = f.msg;
    revalidate();
    Basemap.suspend(typeof Interior !== 'undefined' && Interior.inside());
    hud(true);
    banner();
    return true;
  }
  const toggle = () => (frame ? leave() : enter());

  /* ── going to a town ───────────────────────────────────────────────────
     Enter beside a town: leave the region and stand on that town's home
     plate. `gate(town)` may refuse — src/distract.js holds it. */
  function go(t){
    if (!t) return false;
    if (api.gate && !api.gate(t)) return false;
    leave();
    if (t.root !== Atlas.current()) Atlas.go(t.root, null);
    else note(t.name);
    return true;
  }
  function press(){
    const t = target();
    if (t) return go(t);
    /* by a cluster: open it (the hint said so) */
    if (stood && stood.cluster){
      const w = toWorld(G.x, G.y);
      if (Math.hypot(w[0] - stood.x, w[1] - stood.y) <= G.terr.tsz * REACH) return open(stood.cluster);
    }
    note('stand by a town and press Enter to go there');
    return false;
  }

  /* ── placing a town by hand ────────────────────────────────────────────
     Build mode only. Take a town's diamonds, drop them where the town is,
     and every plate in it is pinned: the root where you dropped it, each
     other plate one atlas step away in the direction its road went — the
     same arithmetic a plate opened from a road end is given. */
  function grab(x, y){
    if (!frame || !G.terr) return false;
    const ts = G.terr.tsz;
    for (const sp of spots()){
      const half = (sp.town.plates.length - 1) * sp.pitch / 2 + radius();
      if (Math.abs(x - sp.x) <= half && Math.abs(y - sp.y) <= radius()){
        held = {town: sp.town, x: sp.x, y: sp.y}; return true;
      }
    }
    return false;
  }
  function dragTo(x, y){ if (held){ held.x = x; held.y = y; } }
  function drop(){
    if (!held) return false;
    const h = held; held = null;
    const g = toGeo(h.x, h.y);
    if (!g){ note('the region has no anchor yet — trace the home plate first'); return false; }
    const pos = Atlas.layout(), o = pos[h.town.root] || [0, 0];
    for (const pid of h.town.plates){
      const q = pos[pid] || o;
      Atlas.setGeo(pid, g.lat - (q[1] - o[1]) * STEP, g.lon + (q[0] - o[0]) * STEP);
    }
    note((h.town.name || h.town.root) + ' pinned');
    return true;
  }

  function banner(){
    const el = $('#region');
    if (!el) return;
    el.hidden = !frame;
    shown = null;
    /* the region is the focused acronym: Skills · Music · RAITS */
    const f = typeof Journal !== 'undefined' && Journal.focused ? Journal.focused() : null;
    const s = el.querySelector('span');
    if (s) s.textContent = f ? f.tab + ' · ' + f.sub + ' · ' + f.letters.join('') + ' · north is up' : 'north is up';
  }
  function init(){ banner(); wireDrag(); wireKeys(); }

  const api = {init, enter, leave, toggle, go, press, target, prompt, overlay, towns, bow, hop, open, scene,
               grab, dragTo, drop, on, gate: null,
               held: () => !!held};
  return api;
})();
