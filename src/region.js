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
  const toXY = g => {
    const p = proj(); if (!p) return null;
    return [G.W / 2 + (g.lon - p.lon0) * Math.cos(p.lat0 * Math.PI / 180) / p.scale,
            G.H / 2 - (g.lat - p.lat0) / p.scale];
  };
  const toGeo = (x, y) => {
    const p = proj(); if (!p) return null;
    return {lat: p.lat0 - (y - G.H / 2) * p.scale,
            lon: p.lon0 + (x - G.W / 2) * p.scale / Math.cos(p.lat0 * Math.PI / 180)};
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
     name and a count (Eden, 2026-09-05: "a way we can still see towns
     that are off the map — maybe make the diamonds lock together in a
     clean geometric shape with gap in between that shows groups of towns
     linked together"). A sample carries its group; a real town is its
     own until its edge place lands within six radii of another's. The
     compass's corner is kept clear: a cluster that would land in it is
     moved on along the edge it came to. */
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
    return {x: C[0] + dx * t, y: C[1] + dy * t, side};
  }
  /* every town's place for this frame: the real ones on the plate as
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
      else off.push({name, group: name, sample: false, xy: [sp.x, sp.y]});
    }
    if (demo()){
      for (const d of DEMO){
        if (where.has(d.name.toLowerCase())) continue;
        const xy = toXY(d);
        if (!xy) continue;
        if (inside(xy)){ on.push({name: d.name, x: xy[0], y: xy[1], sample: true}); where.set(d.name.toLowerCase(), xy); }
        else off.push({name: d.name, group: d.group || d.name, sample: true, xy});
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
  /* ── a link, drawn ─────────────────────────────────────────────────────
     A thin run of the plate's own diamonds in bone, brighter at the two
     towns and quieter along the way — the same line `Kinds` draws for a
     link laid by hand, so a sample's link and a real one look alike.
     Trimmed a diamond and a half short of either town. */
  /* the bend a link takes between two points: a twelfth of the way
     across, to the side that is clockwise of the run — one rule for a
     sample's link here and a drawn one in build.js */
  function bow(A, B){
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1;
    return [(A[0] + B[0]) / 2 - dy / L * L / 12, (A[1] + B[1]) / 2 + dx / L * L / 12];
  }
  function line(a, m, A, B, r, cap){
    const cell = G.A.cell, L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const trim = r * 1.5;
    if (L <= trim * 2 + cell) return m;
    const Cp = bow(A, B);
    /* along the curve, a diamond every three fifths of a cell — the
       bow is slight, so the chord's length serves for the spacing */
    const n = Math.max(2, Math.round((L - trim * 2) / (cell * 0.6)));
    if (m > cap - n - 1) return m;
    const t0 = trim / L, t1 = 1 - trim / L;
    for (let i = 0; i <= n; i++){
      const t = t0 + (t1 - t0) * i / n, u = 1 - t, al = 0.32 + 0.4 * Math.abs(2 * t - 1);
      const x = u * u * A[0] + 2 * u * t * Cp[0] + t * t * B[0], y = u * u * A[1] + 2 * u * t * Cp[1] + t * t * B[1];
      m = put(a, m, x, y, BONE[0], BONE[1], BONE[2], al, cell * 0.5, 0, 0, 0, 1);
    }
    return m;
  }

  /* ── drawn ─────────────────────────────────────────────────────────────
     Bone diamonds with a halo, flare for the town you came from, dim for
     one with no anchor; the name beneath out of the marker sheet. */
  function overlay(a, m, cap){
    if (!frame || !G.terr) return m;
    const z = G.cam[2], px = 1 / z;
    const r = radius(), ls = Math.max(r * 0.4, 7 * px);   // the name's glyph half-size
    const L = layout(r);
    const label = (name, x, y, col, al, size) => Markers.text(a, m, name, x - (name.length - 1) * size * 1.06 / 2, y, size, col, al, cap);
    for (const e of L.on){
      if (e.sample){
        if (m > cap - 2 - e.name.length) break;
        m = put(a, m, e.x, e.y, DIM[0], DIM[1], DIM[2], 0.8, r, 0, 0, 0, 1);
        m = label(e.name.toUpperCase(), e.x, e.y + r * 2 + ls * 1.3, DIM, 0.75, ls);
        continue;
      }
      const sp = e.sp;
      if (m > cap - 8 - sp.town.plates.length * 2) break;
      const c = sp.town.here ? FLARE : sp.anchored ? BONE : DIM;
      const Q = typeof Quest !== 'undefined' ? Quest : null;
      for (let i = 0; i < sp.town.plates.length; i++){
        const x = sp.x0 + i * sp.pitch, pid = sp.town.plates[i];
        /* a plate that is a letter of the region wears its letter's tone,
           and the letter itself, in the plate's own ground colour */
        const Lq = Q ? Q.letter(pid) : null;
        const cc = Lq ? Lq.tone : c;
        m = put(a, m, x, sp.y, cc[0], cc[1], cc[2], 0.3, r * 2.0, 0, 0, 0, 2);
        m = put(a, m, x, sp.y, cc[0], cc[1], cc[2], sp.anchored ? 1 : 0.7, r, 0, 0, 0, 1);
        if (Lq) m = Markers.text(a, m, Lq.ch, x, sp.y, r * 0.55, GROUND, 1, cap);
        if (sp.town.here && Lq) m = put(a, m, x, sp.y, FLARE[0], FLARE[1], FLARE[2], 0.9, r * 1.4, 1, 0, 0, 1);
        if (Q && Q.targetPlate() === pid)
          m = put(a, m, x, sp.y, 0.95, 0.76, 0.31, 0.7 + 0.3 * Math.sin(performance.now() / 300), r * 1.9, 1, 0, 0, 1);
      }
      const name = String(sp.town.name || '').toUpperCase();
      /* each glyph is put at its own centre, so a run is centred on the
         first glyph's x plus half of the gaps between them — the way
         `Markers.number` lays digits, and half a glyph right of where
         the full width put it before */
      if (name) m = label(name, sp.x, sp.y + r * 2 + ls * 1.3, c, 0.9, ls);
    }
    /* the clusters at the edge: a diamond of small diamonds, the count
       beside the name when there is more than one, the name above when
       the cluster stands at the foot of the plate */
    for (const cl of L.clusters){
      const rm = r * 0.55, g = rm * 2.3, col = cl.sample ? DIM : BONE;
      const n = Math.min(cl.members.length, CELLS.length);
      if (m > cap - n - 2 - cl.name.length) break;
      for (let k = 0; k < n; k++)
        m = put(a, m, cl.x + CELLS[k][0] * g, cl.y + CELLS[k][1] * g, col[0], col[1], col[2], cl.sample ? 0.8 : 1, rm, 0, 0, 0, 1);
      const ext = (n > 5 ? 2 : n > 1 ? 1 : 0) * g + rm;
      /* the marker sheet has no '+', so the count is how many towns the
         cluster holds, after a space */
      const name = cl.name.toUpperCase() + (cl.members.length > 1 ? ' ' + cl.members.length : '');
      const below = cl.y + ext + ls * 1.6, y = below + ls > G.H - r ? cl.y - ext - ls * 1.6 : below;
      m = label(name, cl.x, y, col, cl.sample ? 0.75 : 0.9, ls * 0.9);
    }
    /* the samples' links, between the places the towns stand at — an
       off-map town's is its cluster */
    if (demo())
      for (const [p, q] of DEMO_LINKS){
        const A = L.where.get(p.toLowerCase()), B = L.where.get(q.toLowerCase());
        if (A && B) m = line(a, m, A, B, r, cap);
      }
    return m;
  }

  /* ── the arrows hop between towns ──────────────────────────────────────
     On the region an arrow takes the walker to the nearest town in that
     direction — a real one, a sample, or a cluster at the edge — and
     WASD still walks the links (Eden, 2026-09-05: "allow navigation
     within each town using the arrow keys"). Nearest by distance among
     those within sixty degrees of the arrow; the walker is stood on the
     town's tile, the camera follows, and Enter is Enter. Taken in the
     capture phase, as build mode takes its arrows, so the walk never
     sees the key. */
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
    const w = toWorld(G.x, G.y), ts = G.terr.tsz;
    let best = null, bd = Infinity;
    for (const p of places()){
      const vx = p.x - w[0], vy = p.y - w[1], d = Math.hypot(vx, vy);
      if (d <= ts * REACH) continue;                                // the one we stand by
      if ((vx * dx + vy * dy) / d < 0.5) continue;                  // not that way
      if (d < bd){ bd = d; best = p; }
    }
    if (!best){ note('no town that way'); return false; }
    G.x = G.tx = Math.max(0, Math.min(G.terr.tw - 1, Math.round(best.x / ts - 0.5)));
    G.y = G.ty = Math.max(0, Math.min(G.terr.th - 1, Math.round(best.y / ts - 0.5)));
    const at = toWorld(G.x, G.y);
    G.fx = at[0]; G.fy = at[1]; G.moving = false; G.stepT = 1;
    G.hold = null;                                                  // the camera comes along
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
      const n = document.createElement('span');
      n.textContent = by.cluster ? by.name + ' · ' + by.cluster.members.length + ' towns beyond the plate'
                                 : by.name + ' · a sample, not a town yet';
      el.append(n);
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
    G.hold = null;
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

  const api = {init, enter, leave, toggle, go, press, target, prompt, overlay, towns, bow, hop,
               grab, dragTo, drop, on, gate: null,
               held: () => !!held};
  return api;
})();
