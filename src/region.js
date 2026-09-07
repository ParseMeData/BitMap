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

   Instead of roads there are LINKS: since build 284 a link is a pair of
   towns, made by clicking one and then the other on the builder's Links
   layer and kept by the towns' ids in `hq.region.links`, so it follows
   the towns wherever the eye stands; drawn as a sample's link is, and
   the only route the walker has here. The terrain, the districts, the
   structures and the clearings are the town's own tools on the region's
   plate; no markers — a town on the region is a plate, and a plate is
   entered, not drawn. Stand by a town and press Enter and you are
   standing on its home plate. `gate` is where src/distract.js says no.

   Under it all lies THE GROUND: the map of where the eye is, laid by the
   town's own tracing underlay (src/basemap.js) — live tiles with the eye
   at the plate's centre — and the towns stand on it by the map's own
   mercator, so a diamond is on the town on the map. See `ground`.

   Reached from the rose diamond on the hub, in place of the country
   (src/towns.js), which is a chip away in the tune panel; Esc leaves.
   Going in is a frame, exactly as going inside a building is: the half of
   the world that is not in storage is held while you are here and put
   back when you leave. Shapes under `hq.shapes.region` for the region
   seen from home, and under `hq.shapes.region.<name>` for the region a
   cluster opens on (build 284: a region is an eye, and each has a plate
   of its own to draw on and a zoom of its own, `hq.region.zoom`); the
   projection — where the plate's centre falls and how many degrees one
   world unit is — under `hq.region`.                                    */

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
      /* a town may belong to a group — a city's suburb, one of the Mallee
         towns — kept on its root plate's area (`group`), so a real town
         gathers into the cluster its sample did */
      out.push({root, name: title || areas[root].name, plates, geo: n ? {lat: lat / n, lon: lon / n} : null,
                group: areas[root].group ? String(areas[root].group) : null,
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
  let view = null, viewName = null, viewTitle = null;   // the eye, and the cluster it stands on
  /* ── a region is an eye ────────────────────────────────────────────────
     The region seen from home and the region a cluster opens on are two
     plates: each keeps its own shapes, under a key of its own, and its
     own zoom (Eden, 2026-09-06: "save settings of certain zoom levels
     for specific regions"). Home's is `hq.shapes.region`, as it always
     was; a cluster's is that with the cluster's name after it. A cluster
     with the home town in it opens on home's eye exactly — the way back
     lands where you started, not on the mean of home and its
     neighbours. */
  const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
  const eyeKey = () => viewName || 'home';
  const skeyFor = k => k === 'home' ? SKEY : SKEY + '.' + k;
  const eyeName = () => viewTitle || (towns().find(t => t.root === 'home') || {}).name || 'home';
  /* the builder is put on this eye's plate; the walk grid follows */
  function remount(){
    const k = skeyFor(eyeKey());
    if (typeof Build === 'undefined' || Build.key() === k) return;
    Build.commit(); Markers.commit();
    Build.mount('region', k);
  }
  /* ── the zoom, per eye ─────────────────────────────────────────────────
     The region's zoom is the MAP'S SCALE, not the camera's. The plate,
     the diamonds and the boundary stay where they are on screen, and the
     geography under them is drawn wider or closer — so as the map goes
     wider a town that sat on the boundary as a cluster comes to stand
     inside it where it truly lies, and as it comes closer the outer
     towns go back out to the line (Eden, 2026-09-07: "the boundary sets
     the towns within so the actual background map is the only thing
     zoom in and out — then if another town falls in range then it falls
     out of the rectangle then onto inside of the boundary"). Until build
     302 the bar and the lock moved the camera, which scaled everything
     alike — not what was wanted. The camera on the region rests at
     `far()`, the whole plate on screen, and stays there; + − 0, the
     pinch and the View chips come to `zoomBy` here (game.js).

     `hq.region.zoom`: {at: {eye: factor}, held: {eye: 1}} — a factor on
     the projection's scale for that eye: 1 is the scale the region was
     founded at (`hq.region`.scale, never touched), 2 twice as close,
     0.5 twice as wide. Locking an eye writes the factor as it stands
     under `at` and marks it `held`: it is put back whenever the eye is
     stood on — entering the region, opening a cluster, the way home —
     and held against the keys, the pinch and the bar. Unlocking only
     lifts the hold: the eye is free to zoom and still comes back at the
     remembered factor next time (Eden: "keep the zoom remembered when
     unlocked"); Forget in the View block clears it and the eye rests at
     the default again. The lock is the button under the bar at the right
     of the screen (`#rzoom`, `wireSlider`, shown with the builder) and
     the same one in the View block. The factor eases to its target each
     frame (`easeZoom`), so a drag of the bar, a key, a pinch or a restore
     glides rather than jumps. (A record from 299–301 held a camera
     ratio under the same keys; read as a factor it is merely a little
     closer than meant, and a press of Lock rewrites it.) */
  const ZKEY = 'hq.region.zoom';
  const OUT = 8, IN = 4;               // the bar's reach: eight times wider than the default, four times closer
  let zc = null;
  function zoomCfg(){
    if (zc) return zc;
    const z = Store.json(ZKEY, null), ok = o => o && typeof o === 'object';
    const at = ok(z) && ok(z.at) ? z.at : {};
    const held = ok(z) && ok(z.held) ? z.held : Object.fromEntries(Object.keys(at).map(k => [k, 1]));
    zc = {at, held};
    return zc;
  }
  const zoomWrite = () => Store.save(ZKEY, zoomCfg(), 'the region');
  /* the region's camera rests with the map zoomed right out — the whole
     plate with a margin round it — not at the town's working zoom (Eden,
     2026-09-06: "always use the map zoom out as default") */
  const far = () => (G.fitAll ? G.fitAll * 0.85 : 1) || 1;
  let fac = 1, facT = 1, facAt = 0;    // the scale factor now, where it is going, and when it last eased
  const clampF = f => Math.max(1 / OUT, Math.min(IN, isFinite(+f) && +f > 0 ? +f : 1));
  const zoomNow = () => +facT.toFixed(2);
  const savedZoom = () => +zoomCfg().at[eyeKey()] || null;
  /* the eye stood on: the camera at rest, and the eye's own scale —
     remembered, or the default — taken up at once */
  function applyZoom(){
    if (G.fitW) G.camT[2] = far();
    facT = clampF(savedZoom() || 1); fac = facT;
  }
  const rest = () => { if (frame) applyZoom(); return !!frame; };
  const zoomLocked = () => !!(savedZoom() && zoomCfg().held[eyeKey()]);
  /* the boundary's width in kilometres at this zoom — what the bar reads
     out, since that is what decides which towns fall inside it. The
     projection is a kilometre the same length either way, so a world
     unit is `scale` degrees of latitude across as well as up. */
  function across(){
    const p = eye(); if (!p) return 0;
    return G.W * (1 - 2 * PAD) * p.scale * 111.2;
  }
  const kmAcross = () => Math.round(across());   // not `km`: that is the great-circle helper by `bearing`
  /* on: the zoom as it stands is remembered for this eye and held; off:
     the hold is lifted and the zoom stays remembered */
  function setLock(v){
    if (!frame) return false;
    const c = zoomCfg(), k = eyeKey();
    if (v){ c.at[k] = +facT.toFixed(4); c.held[k] = 1; }
    else delete c.held[k];
    zoomWrite();
    note(v ? 'zoom locked for ' + eyeName() + ' · ' + zoomNow() + '× · ' + kmAcross() + ' km across the boundary'
           : 'the zoom is free for ' + eyeName() + (savedZoom() ? ' · ' + (+savedZoom()).toFixed(2) + '× is remembered' : ''));
    syncSlider(true);
    return zoomLocked();
  }
  /* the remembered zoom cleared: the eye rests at the default again */
  function forgetZoom(){
    if (!frame || !savedZoom()) return false;
    const c = zoomCfg(), k = eyeKey();
    delete c.at[k]; delete c.held[k];
    zoomWrite();
    note('the zoom for ' + eyeName() + ' is forgotten · it rests at the default');
    syncSlider(true);
    return true;
  }
  /* a step of the zoom — the keys, the View chips and the pinch all come
     here (game.js zoomBy); a locked eye says so, but not on every move
     of a pinch */
  let lockSaid = 0;
  function zoomBy(k){
    if (!frame || !isFinite(k) || k <= 0) return false;
    if (zoomLocked()){
      const now = performance.now();
      if (now - lockSaid > 1500){ lockSaid = now; note('the zoom is locked for ' + eyeName() + ' · the lock under the bar frees it'); }
      return false;
    }
    facT = clampF(facT * k);
    return true;
  }
  /* the bar's zoom: the map at its widest at the foot, at its closest at
     the head, on a log scale so a step of the bar is the same notch
     anywhere on it; the default sits where the log puts it */
  const lo = () => Math.log(1 / OUT), hi = () => Math.log(IN);
  function zoomTo(f){
    if (!frame) return false;
    if (zoomLocked()){ syncSlider(true); return false; }   // the bar is put back where the lock holds it
    const t = Math.max(0, Math.min(1, +f || 0));
    facT = clampF(Math.exp(lo() + t * (hi() - lo())));
    return true;
  }
  const zoomFrac = () => Math.max(0, Math.min(1, (Math.log(facT) - lo()) / (hi() - lo())));
  /* the frame's easing: the scale glides to its target, as the camera
     does, and lands exactly */
  function easeZoom(){
    const now = performance.now(), dt = facAt ? Math.min(0.1, (now - facAt) / 1000) : 0;
    facAt = now;
    if (fac === facT) return;
    const d = facT - fac;
    fac = Math.abs(d) < 2e-4 * facT ? facT : fac + d * (1 - Math.pow(0.02, dt));
  }
  /* ── the slider ────────────────────────────────────────────────────────
     A bar down the right of the screen while the builder is open on the
     region (`#rzoom`, index.html; the region alone showed it at 299 —
     Eden, 2026-09-07: "make the scroll zoom only show in build mode"),
     as the boundary is: the map at its widest at its foot, at its
     closest at its head, the boundary's width in kilometres read out
     under it, and the lock under that. Dragged, it moves the zoom's
     target and the scale eases after it, as the keys do; the keys and
     the pinch move it back each frame. While it is held the frame
     leaves it alone, or it would fight the hand; let go, it also lets
     go of the keyboard, since a focused bar would take the arrows the
     walker needs. Locked, it is held still and dimmed. (Eden,
     2026-09-07: "give it a scroll bar on the right side that zooms in
     out of the map and allows a lock function that saves that zoom
     amount".) */
  let sliding = false, shownSlide = '';
  const el = id => document.getElementById(id);
  function wireSlider(){
    const r = el('rzoomrange'), b = el('rzoomlock');
    if (!r || !b) return;
    r.addEventListener('input', () => { zoomTo(+r.value / 1000); });
    r.addEventListener('pointerdown', () => { sliding = true; });
    const done = () => { if (!sliding) return; sliding = false; r.blur(); syncSlider(true); };
    r.addEventListener('pointerup', done); r.addEventListener('pointercancel', done);
    addEventListener('pointerup', done);
    b.onclick = () => { setLock(!zoomLocked()); b.blur(); };
  }
  function syncSlider(force){
    const r = el('rzoomrange'), b = el('rzoomlock'), v = el('rzoomv');
    if (!frame || !r) return;
    const lock = zoomLocked(), s = lock + ':' + zoomNow() + ':' + eyeKey() + ':' + kmAcross();
    if (!force && s === shownSlide) return;
    shownSlide = s;
    if (!sliding || force) r.value = Math.round(zoomFrac() * 1000);
    r.disabled = lock;
    if (b){
      b.textContent = lock ? 'Locked' : 'Lock';
      b.classList.toggle('sel', lock);
      b.title = lock ? 'the zoom is kept for ' + eyeName() + ' · press to free it' : 'keep this zoom for ' + eyeName();
    }
    if (v) v.textContent = kmAcross() + ' km';
  }
  const viewState = () => ({eye: eyeName(), key: eyeKey(), now: zoomNow(), km: kmAcross(), saved: savedZoom(), lock: zoomLocked(),
                            linking: linking ? linking.name : null, selected: !!selLink, links: userLinks().length});
  /* the builder's View block is told when any of that changes */
  let shownView = '';
  function syncView(){
    if (typeof Build === 'undefined' || !Build.syncView || !Build.active()) return;
    const v = viewState(), s = JSON.stringify(v);
    if (s === shownView) return;
    shownView = s;
    Build.syncView(v);
  }
  function eye(){
    const p = proj(); if (!p) return null;
    if (!view) view = {lat: p.lat0, lon: p.lon0};
    return {lat: view.lat, lon: view.lon, scale: p.scale / fac};   // the eye's zoom is a factor on the founding scale
  }
  /* ── the ground, and the projection that is the map's ───────────────
     Under the diamonds lies the map of where the eye is: the town's own
     tracing underlay (src/basemap.js), live Dark tiles with the eye at
     the plate's centre. The region projects by the same mercator at the
     same zoom, each tile pixel worth `k` world units, so a town's
     diamond stands on the town on the map by construction, not by
     adjustment (Eden, 2026-09-06: "re align and place the diamonds on
     top of an overlay of the map of victoria using the same initial map
     system"). `hq.region`'s scale keeps its meaning — degrees of
     latitude per world unit at the eye — and `k` is what that comes to
     per mercator pixel at the eye's latitude. The zoom is the one that
     puts a tile pixel on a screen pixel, or finer, at the camera's zoom
     as the screen has it: never blurred, and never more tiles than the
     screen can show. The projection does not depend on the zoom, only
     the tiles do. Without the underlay (a test page) the flat projection
     stands in, a kilometre the same length either way. */
  const mapper = () => (typeof Basemap !== 'undefined' && Basemap.merc ? Basemap : null);
  const FADE = 0.45;                   // the map's opacity here: looked at, where the town's is traced over at a quarter
  function ground(zc){
    const p = eye(); if (!p) return null;
    const cssW = (typeof canvas !== 'undefined' && canvas.clientWidth) || 1;
    const dpr = (typeof VW === 'number' && VW ? VW : cssW) / cssW, cz = ((zc || G.cam[2]) || 1) / dpr;
    const c = Math.cos(p.lat * Math.PI / 180);
    const z = Math.max(3, Math.min(19, Math.ceil(Math.log2(360 * c * cz / (256 * p.scale)))));
    return {lat: p.lat, lon: p.lon, z, k: 360 * c / (p.scale * 256 * Math.pow(2, z))};
  }
  const toXY = g => {
    const p = eye(); if (!p) return null;
    const B = mapper();
    if (B){
      const t = ground(), a = B.merc(g.lat, g.lon, t.z), b = B.merc(p.lat, p.lon, t.z);
      return [G.W / 2 + (a[0] - b[0]) * t.k, G.H / 2 + (a[1] - b[1]) * t.k];
    }
    return [G.W / 2 + (g.lon - p.lon) * Math.cos(p.lat * Math.PI / 180) / p.scale,
            G.H / 2 - (g.lat - p.lat) / p.scale];
  };
  const toGeo = (x, y) => {
    const p = eye(); if (!p) return null;
    const B = mapper();
    if (B){
      const t = ground(), b = B.merc(p.lat, p.lon, t.z);
      const g = B.unmerc(b[0] + (x - G.W / 2) / t.k, b[1] + (y - G.H / 2) / t.k, t.z);
      return {lat: g[0], lon: g[1]};
    }
    return {lat: p.lat - (y - G.H / 2) * p.scale,
            lon: p.lon + (x - G.W / 2) * p.scale / Math.cos(p.lat * Math.PI / 180)};
  };
  /* the map laid at the eye — or, while a cluster is opening, on its way
     from the eye it left to the one it is arriving at by the fraction the
     scene is blended by, so a diamond stays on its town the whole slide.
     Only while the underlay wears the region's handles: never a word to
     a plate's own. */
  function lookAt(k, show){
    const B = mapper(); if (!B || !B.look || !B.plate || B.plate() !== 'region') return false;
    const t = ground(); if (!t) return false;
    let la = t.lat, lo = t.lon;
    if (trans && trans.eye0 && k < 1){
      const a = B.merc(trans.eye0.lat, trans.eye0.lon, t.z), b = B.merc(la, lo, t.z);
      const g = B.unmerc(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, t.z);
      la = g[0]; lo = g[1];
    }
    return B.look(la, lo, t.z, t.k, show, FADE);
  }

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
  /* ── the boundary ─────────────────────────────────────────────────────
     An invisible rectangle centred on the plate, a fifth of the plate's
     width in from either side and a fifth of its height from top and
     foot — a wide margin, so it sits well inside the screen with room
     round it. Only the towns that fall inside it stand where they fall:
     the open group, in the middle. Every other town — beyond the
     rectangle, or beyond the plate altogether, since the region is not
     the country and Melbourne is not going to fit at this scale — sits
     ON the rectangle, where the line from the middle through the town
     meets it; and towns that land together there, in the one direction
     — a city and its suburbs, a river town and the towns round it —
     gather into one cluster: their diamonds locked together in a diamond
     of diamonds with a gap between, the way the hub is made, under one
     name and a count (Eden, 2026-09-05; the rectangle 2026-09-06: "an
     invisible rectangle boundary that all the outside towns sit on -
     including the clusters - so only the centered towns are in the
     middle … give the boundary a very wide large padding so many
     diamonds can fit on it"). A sample carries its group; a real town is
     its own until its place on the boundary lands within six radii of
     another's. Everything on the boundary is bone, sample or not. The
     compass's corner is kept clear: a cluster that would land in it is
     moved on along the side it came to. Enter on a cluster opens it —
     see `open`. */
  const PAD = 0.2;                     // of the plate's width and height, each side, to the boundary
  /* drawn only in the builder: a thin dotted run of the plate's diamonds
     along the rectangle, so it can be seen while towns are being laid
     against it (Eden, 2026-09-06: "add a temporary rectangle shape
     showing the boundry so we can visably see it"; 2026-09-07: "make the
     rectangle boundry only show in the build mode"); the Boundary chip
     under Towns in the tune panel puts it away there too
     (`hq.region.bounds`) */
  const BKEY = 'hq.region.bounds';
  const showBounds = () => { try { return Store.get(BKEY) !== '0'; } catch (e){ return true; } };
  const building = () => typeof Build !== 'undefined' && Build.active && Build.active();
  function frameLine(a, m, cap){
    if (!building() || !showBounds() || !G.A) return m;
    const B = bounds(), cell = G.A.cell, step = cell * 1.5, al = 0.5;
    for (const [x0, y0, x1, y1] of [[B.x0, B.y0, B.x1, B.y0], [B.x1, B.y0, B.x1, B.y1], [B.x1, B.y1, B.x0, B.y1], [B.x0, B.y1, B.x0, B.y0]]){
      const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / step));
      if (m > cap - n - 1) return m;
      for (let i = 0; i < n; i++){ const t = i / n; m = put(a, m, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, BONE[0], BONE[1], BONE[2], al, cell * 0.5, 0, 0, 0, 1); }
    }
    return m;
  }
  const CELLS = (() => {
    const pts = [];
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (Math.abs(i) + Math.abs(j) <= 2) pts.push([i, j]);
    return pts.sort((a, b) => (Math.abs(a[0]) + Math.abs(a[1])) - (Math.abs(b[0]) + Math.abs(b[1])) || Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
  })();
  /* where the line from the middle through P meets the boundary */
  const bounds = () => ({x0: G.W * PAD, y0: G.H * PAD, x1: G.W * (1 - PAD), y1: G.H * (1 - PAD)});
  function edge(P, C, B){
    const dx = P[0] - C[0], dy = P[1] - C[1];
    let t = Infinity, side = null;
    if (dx > 0){ const k = (B.x1 - C[0]) / dx; if (k < t){ t = k; side = 'x'; } }
    else if (dx < 0){ const k = (B.x0 - C[0]) / dx; if (k < t){ t = k; side = 'x'; } }
    if (dy > 0){ const k = (B.y1 - C[1]) / dy; if (k < t){ t = k; side = 'y'; } }
    else if (dy < 0){ const k = (B.y0 - C[1]) / dy; if (k < t){ t = k; side = 'y'; } }
    if (!isFinite(t)) return {x: C[0], y: C[1], side: null};
    return {x: C[0] + dx * t, y: C[1] + dy * t, side};
  }
  /* every town's place from the eye: the real ones inside the boundary
     as `spots()` has them, the samples, and the clusters on the boundary
     — with `where`, a name → place map the links are drawn from */
  function layout(r){
    const C = [G.W / 2, G.H / 2], B = bounds();
    const inside = xy => xy[0] > B.x0 && xy[0] < B.x1 && xy[1] > B.y0 && xy[1] < B.y1;
    const where = new Map(), on = [], off = [], real = new Set();
    for (const sp of spots()){
      const name = String(sp.town.name || '');
      real.add(name.toLowerCase());
      if (inside([sp.x, sp.y])){ on.push({sp, name}); where.set(name.toLowerCase(), [sp.x, sp.y]); }
      else off.push({name, group: sp.town.group || name, sample: false, xy: [sp.x, sp.y], geo: sp.town.geo, root: sp.town.root});
    }
    if (demo()){
      for (const d of DEMO){
        /* a sample stands aside for a real town of its name, wherever
           that town stands — once founded (`foundSamples`) it is not
           drawn twice */
        if (real.has(d.name.toLowerCase())) continue;
        const xy = toXY(d);
        if (!xy) continue;
        if (inside(xy)){ on.push({name: d.name, x: xy[0], y: xy[1], sample: true}); where.set(d.name.toLowerCase(), xy); }
        else off.push({name: d.name, group: d.group || d.name, sample: true, xy, geo: {lat: d.lat, lon: d.lon}});
      }
    }
    /* the clusters: by group, then groups whose edge places fall together */
    const groups = new Map();
    for (const o of off){
      const at = edge(o.xy, C, B);
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
    /* a cluster gathered across a corner has its mean inside it: back
       onto the line, where the middle looks through that mean */
    for (const cl of clusters){ const at = edge([cl.x, cl.y], C, B); if (at.side){ cl.x = at.x; cl.y = at.y; cl.side = at.side; } }
    /* the compass has the top-left corner */
    const cb = typeof Compass !== 'undefined' && Compass.box ? Compass.box() : [0, 0, 0, 0];
    const cw = cb[2] + r * 1.5, ch = cb[3] + r * 1.5;
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
     shading and colour"). The wave was then calmed — one slow swing
     along the run at half the depth, where it had been one or two at
     1.2 %, and the second bend swinging back the other way one time in
     five rather than three in ten, and by less (Eden, 2026-09-06: "make
     the styling of the lines slightly less wavey"). */
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
  /* the points along a link's curve, [x, y, t] every six tenths of a
     cell: trimmed a diamond and a half short of either town for drawing,
     or the whole run for the walk grid and for hit-testing */
  function curvePts(A, B, seed, r, cell, trim){
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy), out = [];
    const tr = trim ? r * 1.5 : 0;
    if (L <= tr * 2 + cell) return out;
    const nx = -dy / L, ny = dx / L;
    const side = rnd(seed, 1) < 0.5 ? -1 : 1;
    const a1 = side * L * (0.05 + 0.07 * rnd(seed, 2));
    const a2 = (rnd(seed, 3) < 0.8 ? side : -side) * L * (0.02 + 0.05 * rnd(seed, 4));
    const P1 = [A[0] + dx / 3 + nx * a1, A[1] + dy / 3 + ny * a1];
    const P2 = [A[0] + 2 * dx / 3 + nx * a2, A[1] + 2 * dy / 3 + ny * a2];
    const wf = 1, wp = rnd(seed, 6) * Math.PI * 2, wa = L * 0.006;
    const n = Math.max(2, Math.round((L - tr * 2) / (cell * 0.6)));
    const t0 = tr / L, t1 = 1 - tr / L;
    for (let i = 0; i <= n; i++){
      const t = t0 + (t1 - t0) * i / n, u = 1 - t;
      const w = wa * Math.sin(Math.PI * 2 * wf * t + wp);
      out.push([u * u * u * A[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * B[0] + nx * w,
                u * u * u * A[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * B[1] + ny * w, t]);
    }
    return out;
  }
  function curve(a, m, A, B, seed, al0, r, cap, col){
    const cell = G.A.cell, pts = curvePts(A, B, seed, r, cell, true), c = col || BONE;
    if (!pts.length || m > cap - pts.length - 1) return m;
    for (const q of pts){
      const al = (0.32 + 0.4 * Math.abs(2 * q[2] - 1)) * al0;
      m = put(a, m, q[0], q[1], c[0], c[1], c[2], al, cell * 0.5, 0, 0, 0, 1);
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
    const gems = [], labels = [], links = [], pos = new Map(), grp = new Map();
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
      pos.set(sp.town.root, [sp.x, sp.y]);
    }
    for (const cl of L.clusters){
      /* on the boundary everything is bone, a sample as much as a town
         (Eden, 2026-09-06: "all towns, regions and clusters sitting on
         this border being white") */
      const rm = r * 0.55, g = rm * 2.3, col = BONE, n = Math.min(cl.members.length, CELLS.length);
      for (let k = 0; k < n; k++){
        const o = cl.members[k];
        gems.push({key: 'g:' + o.name.toLowerCase(), x: cl.x + CELLS[k][0] * g, y: cl.y + CELLS[k][1] * g, r: rm,
                   col: shade(col, o.name), al: 1});
      }
      const ext = (n > 5 ? 2 : n > 1 ? 1 : 0) * g + rm;
      const text = cl.name.toUpperCase() + (cl.members.length > 1 ? ' ' + cl.members.length : '');
      const below = cl.y + ext + ls * 1.6, y = below + ls > G.H - r ? cl.y - ext - ls * 1.6 : below;
      labels.push({key: 'c:' + cl.name.toLowerCase(), text, x: cl.x, y, size: ls * 0.9, col, al: 0.9});
      pos.set(cl.name.toLowerCase(), [cl.x, cl.y]); grp.set(cl.name.toLowerCase(), cl.name);
      for (const o of cl.members){
        pos.set(o.name.toLowerCase(), [cl.x, cl.y]); grp.set(o.name.toLowerCase(), cl.name);
        if (o.root) pos.set(o.root, [cl.x, cl.y]);
      }
    }
    /* a link is drawn only where it leaves a group: from a town on the
       plate to a cluster at the edge, or from one cluster to another.
       The towns of the open group — spread out on the plate together —
       have no lines between them, and a cluster's members none within
       it (Eden, 2026-09-06: "when a cluster opens there is no lines in
       between the cluster diamonds, only lines to the next cluster
       group"). A town on the plate has no group here; two of them are
       the same group, the open one. */
    /* and a sample's link stands aside for one made by hand between the
       same two towns — a real town is known here by its root plate */
    const idOf = new Map();
    for (const e of L.on) if (!e.sample) idOf.set(e.name.toLowerCase(), e.sp.town.root);
    for (const cl of L.clusters) for (const o of cl.members) if (o.root) idOf.set(o.name.toLowerCase(), o.root);
    const byHand = new Set(userLinks().map(([p, q]) => linkKey(p, q)));
    if (demo())
      for (const [p, q] of DEMO_LINKS){
        const a = p.toLowerCase(), b = q.toLowerCase(), A = pos.get(a), B = pos.get(b);
        if (!A || !B || grp.get(a) === grp.get(b) || byHand.has(linkKey(idOf.get(a) || a, idOf.get(b) || b))) continue;
        links.push({key: 'k:' + [a, b].sort().join('|'), A, B, seed: seedOf(p + '|' + q), al: 1});
      }
    /* the links made by hand: by the towns' ids, so each is drawn to
       wherever its two towns stand from this eye — on the plate, or in a
       cluster at its edge (two ends in the one cluster draw nothing);
       the selected one in flare */
    for (const [p, q] of userLinks()){
      const A = pos.get(p), B = pos.get(q);
      if (!A || !B) continue;
      const key = linkKey(p, q);
      links.push({key, A, B, seed: seedOf(key), al: 1, user: true, col: selLink === key ? FLARE : null});
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
    for (const l of S.links) m = curve(a, m, l.A, l.B, l.seed, l.al === undefined ? 1 : l.al, S.r, cap, l.col);
    return m;
  }

  /* ── drawn ─────────────────────────────────────────────────────────────
     The scene from the eye — or, while a cluster is being opened, the
     scene it left blended into the one it is arriving at. */
  let trans = null;                         // {t0, dur, from: scene}
  function overlay(a, m, cap){
    if (!frame || !G.terr) return m;
    settle();
    easeZoom();
    let S = scene(), k = 1;
    if (trans){
      k = (performance.now() - trans.t0) / trans.dur;
      if (k >= 1){ trans = null; k = 1; }
      else { k = ease(Math.max(0, k)); S = blend(trans.from, S, k); }
    }
    lookAt(k);
    m = frameLine(a, m, cap);
    m = emit(a, m, S, cap);
    /* the town a link is being made from wears a ring, as the town you
       are in does, and it breathes so it reads as waiting */
    if (linking && m < cap - 2)
      m = put(a, m, linking.x, linking.y, FLARE[0], FLARE[1], FLARE[2], 0.7 + 0.25 * Math.sin(performance.now() / 250), S.r * 1.4, 1, 0, 0, 1);
    syncView();
    syncSlider();
    return m;
  }

  /* ── opened ────────────────────────────────────────────────────────────
     A cluster opens — under the walker (`settle`), or on Enter (`press`):
     the eye moves to the middle of its towns, the scene it leaves is
     kept and blended into the one it arrives at over nine tenths of a
     second, and the walker glides to the town the cluster was named
     for. What was on the plate is now beyond it and gathers at the edge
     on its own — the home town's cluster is the way back. */
  function open(cl){
    const geo = cl.members.map(o => o.geo).filter(g => g && isFinite(g.lat) && isFinite(g.lon));
    if (!geo.length){ note('nowhere to open — those towns have no place yet'); return false; }
    const e0 = eye();
    trans = {t0: performance.now(), dur: 900, from: scene(), eye0: e0 ? {lat: e0.lat, lon: e0.lon} : null};
    linking = null; selLink = null;
    /* where the walker sets off from, taken before the plate under it
       changes — a restamp may stand it on the nearest path first */
    const cur = G.moving ? [G.tx, G.ty] : toWorld(G.x, G.y);
    if (cl.members.some(o => o.root === 'home')){
      const p = proj();
      view = {lat: p.lat0, lon: p.lon0}; viewName = null; viewTitle = null;
    } else {
      /* on the town the cluster is named for, so it stands in the middle,
         inside the boundary, with the rest of the group round it. The
         mean of the group was the eye until build 289: for a cluster
         gathered from far apart — Ouyen with Mildura's four and
         Wangaratta, joined on a corner of the boundary — that is empty
         ground between them, and left every town of it on the line */
      const lead = cl.members.find(o => o.name === cl.name && o.geo && isFinite(o.geo.lat)) || cl.members.find(o => o.geo && isFinite(o.geo.lat));
      view = lead ? {lat: lead.geo.lat, lon: lead.geo.lon}
                  : {lat: geo.reduce((s, g) => s + g.lat, 0) / geo.length, lon: geo.reduce((s, g) => s + g.lon, 0) / geo.length};
      viewName = slug(cl.name); viewTitle = cl.name;
    }
    if (typeof Morph !== 'undefined') Morph.begin();
    remount();
    applyZoom();
    if (typeof Morph !== 'undefined') Morph.settle();
    /* the map of where the eye is going, asked for now at the zoom it
       will arrive at, so it is there when the slide lands */
    const Bm = mapper();
    if (Bm && Bm.warm){ const t = ground(G.camT[2]); if (t) Bm.warm(t.lat, t.lon, t.z, t.k, G.camT[2]); }
    const S = scene(), name = cl.name.toLowerCase();
    const at = S.pos.get(name) || [G.W / 2, G.H / 2];
    glide(at, cur);
    landing = true;
    const there = S.L.on.find(e => e.name.toLowerCase() === name);
    stood = there && there.sample ? {x: there.x, y: there.y, name: there.name, sample: true} : null;
    shown = null;
    note(cl.name + ' opened · ' + cl.members.length + (cl.members.length === 1 ? ' town' : ' towns'));
    return true;
  }
  /* ── a cluster opens under the walker ─────────────────────────────────
     Standing on a cluster is enough to open it. When the walker comes to
     rest by one — a hop's glide ending there — it sits a third of a
     second, so the landing is seen, and the cluster opens with nothing
     pressed (Eden, 2026-09-06: "when our sprite sits on a cluster it
     expands, we don't need to press enter to open"). Read at the moment
     it comes to rest, so a cluster the walker is merely left beside —
     by the spawn, or by the scene re-laying itself round it — does not
     open on its own; and never while a scene is still blending. Enter
     still opens one at once (`press`). */
  const DWELL = 350;                        // ms at rest on a cluster before it opens
  let wasMoving = false, sat = null;        // {cl, t0}: the cluster come to rest on, and when
  let landing = false;                      // the glide that ends an opening is under way
  function settle(){
    const moving = !!G.moving;
    if (moving) sat = null;
    else if (wasMoving){
      /* the glide that ends an opening comes to rest too — on the town
         the cluster was named for, which from the new eye may itself be
         a cluster on the boundary — and that rest opens nothing: one
         opening set off the next, and two clusters handed the eye back
         and forth for ever (Eden, 2026-09-06: "infinitely toggles the
         animation between the two") */
      if (landing) landing = false;
      else if (!trans && !G.paused){
        const w = toWorld(G.x, G.y);
        let cl = null, bd = G.terr.tsz * REACH;
        for (const c of layout(radius()).clusters){
          const d = Math.hypot(w[0] - c.x, w[1] - c.y);
          if (d <= bd){ bd = d; cl = c; }
        }
        sat = cl ? {cl, t0: performance.now()} : null;
      }
    }
    wasMoving = moving;
    if (sat && !trans && !G.paused && performance.now() - sat.t0 >= DWELL){ const cl = sat.cl; sat = null; open(cl); }
  }
  /* ── the walker glides ─────────────────────────────────────────────────
     A hop is one long step: the game's own stride, from where the walker
     stands to the town's tile, its spring at the end — so the sprite
     travels rather than appears (Eden, 2026-09-05: "animation for our
     sprite moving from one section to the other"). A tile takes 0.14 s;
     a hop takes three to seven of those, by its length. */
  function glide(at, from){
    const ts = G.terr.tsz;
    const cur = from || (G.moving ? [G.tx, G.ty] : toWorld(G.x, G.y));
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
     follows, and Enter is Enter — a cluster opens on its own once the
     walker has settled on it (`settle`). Taken in the capture phase, as
     build mode takes its arrows, so the walk never sees the key. */
  let stood = null;                         // the sample or cluster the walker was last put by
  function places(){
    const L = layout(radius());
    const out = [];
    for (const e of L.on) out.push(e.sample ? {x: e.x, y: e.y, name: e.name, sample: true, id: e.name.toLowerCase()}
                                            : {x: e.sp.x, y: e.sp.y, name: e.name, town: e.sp.town, id: e.sp.town.root});
    for (const cl of L.clusters) out.push({x: cl.x, y: cl.y, name: cl.name, cluster: cl, id: clusterId(cl)});
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
    landing = false;                                                // a hop's rest may open a cluster
    glide([best.x, best.y]);
    stood = best.town ? null : best;
    shown = null;                                                   // the hint reads the new place
    return true;
  }
  /* ── links, made and unmade ────────────────────────────────────────────
     `hq.region.links` is a list of pairs of ids — a real town's root
     plate, a sample's name in lower case — and nothing else: where a
     link runs is worked out from wherever its two towns stand at the
     time, so it holds when a cluster opens and the towns move, and it
     shows from any eye that sees both ends. On the builder's Links
     layer a click on a town starts one and a click on another town
     finishes it (a click on the same town, or Esc, lets it go); a click
     on a link selects it, in flare, and Delete removes it. A cluster
     stands for the town it is named for. The walk grid takes every link
     the whole way, town to town, so the walker by a town is on the path
     (Eden, 2026-09-06: "place or delete lines between certain areas or
     towns"). */
  const LKEY = 'hq.region.links';
  let lc = null, linking = null, selLink = null;
  function userLinks(){
    if (lc) return lc;
    const l = Store.json(LKEY, null);
    lc = Array.isArray(l) ? l.filter(p => Array.isArray(p) && p.length === 2 && p[0] !== p[1]).map(p => [String(p[0]), String(p[1])]) : [];
    return lc;
  }
  function writeLinks(l){
    lc = l;
    Store.save(LKEY, l, 'the region');
    if (typeof restampTerrain === 'function') restampTerrain();
  }
  const linkKey = (a, b) => 'u:' + [a, b].sort().join('|');
  const clusterId = cl => { const o = cl.members.find(x => x.name === cl.name) || cl.members[0]; return o.root || o.name.toLowerCase(); };
  function placeAt(x, y){
    let best = null, bd = radius() * 1.3;
    for (const p of places()){ const d = Math.hypot(p.x - x, p.y - y); if (d < bd){ bd = d; best = p; } }
    return best;
  }
  function linkAt(x, y){
    const S = scene(), tol = S.r * 0.7;
    for (const l of S.links){
      if (!l.user) continue;
      for (const q of curvePts(l.A, l.B, l.seed, S.r, G.A.cell, false))
        if (Math.hypot(q[0] - x, q[1] - y) <= tol) return l.key;
    }
    return null;
  }
  function linkClick(x, y){
    if (!frame || !G.terr) return false;
    const p = placeAt(x, y);
    if (p){
      if (!linking){ linking = {id: p.id, name: p.name, x: p.x, y: p.y}; selLink = null; note('a link from ' + p.name + ' · click another town · Esc lets it go'); return true; }
      if (linking.id === p.id){ linking = null; note('no link'); return true; }
      const L = userLinks(), key = linkKey(linking.id, p.id);
      if (L.some(([a, b]) => linkKey(a, b) === key)) note(linking.name + ' and ' + p.name + ' are linked already');
      else { writeLinks(L.concat([[linking.id, p.id]])); note(linking.name + ' · ' + p.name + ' linked'); }
      linking = null;
      return true;
    }
    const k = linkAt(x, y);
    if (k){ selLink = k; linking = null; note('a link · Delete removes it'); return true; }
    const had = !!(selLink || linking);
    selLink = null; linking = null;
    return had;
  }
  function removeLink(){
    if (!frame || !selLink) return false;
    const key = selLink;
    writeLinks(userLinks().filter(([a, b]) => linkKey(a, b) !== key));
    selLink = null;
    note('the link is gone');
    return true;
  }
  function unlink(){ const had = !!(selLink || linking); selLink = null; linking = null; return had; }
  /* the walk grid: every link by hand, the whole way, a band a little
     over half a tile wide so a diagonal run is still one walk */
  function stamp(t){
    if (!frame || !G.terr || !G.A) return;
    const S = scene(), tol = t.tsz * 0.62;
    for (const l of S.links){
      if (!l.user) continue;
      for (const q of curvePts(l.A, l.B, l.seed, S.r, G.A.cell, false)){
        const cx = Math.floor(q[0] / t.tsz), cy = Math.floor(q[1] / t.tsz);
        for (let j = cy - 1; j <= cy + 1; j++) for (let i = cx - 1; i <= cx + 1; i++){
          if (i < 0 || j < 0 || i >= t.tw || j >= t.th) continue;
          if (Math.hypot((i + 0.5) * t.tsz - q[0], (j + 0.5) * t.tsz - q[1]) > tol) continue;
          const n = j * t.tw + i; t.walk[n] = 1; t.path[n] = 1;
        }
      }
    }
  }

  function wireKeys(){
    /* Esc lets a link in the making go, or drops the selected one,
       before it means anything else */
    addEventListener('keydown', e => {
      if (!frame || e.code !== 'Escape' || !(linking || selLink)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      unlink(); note('no link');
    }, true);
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
        /* it opens on its own the moment the walker has settled */
        const n = document.createElement('span');
        n.textContent = 'opening ' + by.name + ' · ' + by.cluster.members.length + (by.cluster.members.length === 1 ? ' town' : ' towns') + ' beyond the plate';
        el.append(n);
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
    if (typeof Bench !== 'undefined' && Bench.on()){ note('the region is outside — leave the bench first'); return false; }
    Build.commit(); Markers.commit();
    frame = {
      scope: Kinds.scope(), skey: Build.key(), mkey: Markers.key(), blank: BLANK,
      x: G.x, y: G.y, cam: G.cam.slice(), camT: G.camT.slice(),
      sparks: G.sparks, got: G.got, total: G.total, round: G.round,
      clock: G.clock, steps: G.steps, over: G.over, msg: G.msg
    };
    /* the ground: the underlay takes the region's own handles and lays
       the map at the eye — once its mount has settled, and only if the
       region is still up and the handles still its own, so a quick Esc
       can never have the eye written on a plate's record */
    if (typeof Basemap !== 'undefined' && Basemap.mount){
      frame.plate = Basemap.plate ? Basemap.plate() : Atlas.current();
      Basemap.mount('region').then(() => { if (frame && Basemap.plate() === 'region') lookAt(1, true); });
    }
    document.body.classList.add('region');
    Markers.mount(MKEY);
    viewName = null; viewTitle = null; linking = null; selLink = null;
    if (typeof Morph !== 'undefined') Morph.begin();
    Build.mount('region', SKEY);
    setBlank(true, false);
    G.round = 1; G.msg = ''; G.over = false;
    spawn();
    applyZoom();
    if (typeof Morph !== 'undefined') Morph.settle();
    G.total = 12;
    scatterSparks();
    if (typeof Hud !== 'undefined' && Hud.fold) Hud.fold();
    wasMoving = false; sat = null; landing = false;
    banner();
    return true;
  }
  /* ── out ──
     The plate's own underlay comes back — unless the way out is on to
     another plate, whose own `Atlas.go` mounts (remount false), so two
     mounts never race for the one picture. */
  function leave(remount){
    G.hold = null; view = null; trans = null; stood = null; sat = null; wasMoving = false; landing = false;
    viewName = null; viewTitle = null; linking = null; selLink = null;
    if (!frame) return false;
    if (typeof Morph !== 'undefined') Morph.begin();
    Build.commit(); Markers.commit();
    const f = frame; frame = null; held = null;
    document.body.classList.remove('region');
    const hint = $('#enterhint'); if (hint && shown){ hint.hidden = true; shown = null; }
    if (typeof Basemap !== 'undefined' && Basemap.mount && remount !== false) Basemap.mount(f.plate || 'home');
    Markers.mount(f.mkey);
    Build.mount(f.scope, f.skey);
    /* the cells travel to the plate's own — unless the way out is on to
       another plate, whose `Atlas.go` settles them there */
    if (remount !== false && typeof Morph !== 'undefined') Morph.settle();
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
    leave(t.root === Atlas.current());
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

  /* ── the samples made towns ────────────────────────────────────────────
     Eden, 2026-09-06: "create placeholder demo towns for each of the
     existing places so we can go inside and have them link up with each
     other just to test how it would feel". Every sample that is not a
     town yet becomes one: a plate of its own in the atlas — id `a` and
     the sample's slug, placed where the sample stood, carrying the
     sample's group so a city and its suburbs still gather into one
     cluster on the boundary — with a placeholder town written straight
     into the plate's storage in the shape the builder saves, before it
     is ever mounted, as `Atlas.add` writes a road stub: a main street
     and a cross street through the middle, each with a little wander of
     its own, two side streets that end in dead ends (doorways to plates
     beyond, as anywhere), a park, three houses, and the town's palace on
     the house at the crossing, named for the town. The underlay's record
     is written too, with the town's place in it, so `M` there shows the
     map of the real town under the placeholder.

     And LINKED: a link by hand for every sample link, and from each
     group's lead to the rest of its group — so Melbourne opened is five
     towns with lines between them, and the walker can walk the lines
     from one to the next. A link that named a sample by its lower-case
     name is rewritten to the new plate's id, so the two Eden made on the
     rig follow their towns. Once founded, the sample is not drawn: a
     real town of its name stands aside for it (`layout`). Pressed from
     the Demo towns chip under Towns in the tune panel; pressed again it
     finds nothing left to found. Nothing here touches the home plate. */
  const HOME_NAME = 'Barwidgee';            // the samples are this town's neighbours
  /* ── a placeholder town ────────────────────────────────────────────────
     Laid from the town's place in the world (build 295; Eden: "add some
     more variation to the existing towns - give the towns some random
     turning (rotate plate) so we can test the compass and the direction
     of the roads - fill all of them and make sure the roads that lead to
     the next plate make sense"). The plate has a TURN — degrees
     clockwise, seeded by the name from a short list so no two neighbours
     turn alike, kept in the underlay's record as `turn` so the compass
     reads it — and every road that leaves the town leaves toward a town
     it is linked to on the region: laid at that town's true bearing
     turned by the plate's turn, with a little wander in the middle, and
     ending in a run of four tiles along the nearest cardinal at tile
     centres, so the road is one tile wide at its end and the walker's
     end-of-the-road test fires there; a town with no links has a road
     east and one west. Round the crossing, by the seed: a roundabout,
     houses along each road on alternate sides (the first carries the
     palace), a park in the widest gap between the roads, stands of trees
     in the next, and for a third of the towns a lake. */
  const TURNS = [-60, -45, -30, -15, 0, 0, 15, 30, 45, 60, 90, -90, 180];
  const turnOf = name => TURNS[Math.floor(rnd(seedOf(name), 99) * TURNS.length) % TURNS.length];
  function demoPlate(name, i, ctx){
    ctx = ctx || {};
    const W = G.W, H = G.H, z = G.terr.tsz, c = G.A ? G.A.cell : z / 4;
    const tc = v => (Math.floor(v / z) + 0.5) * z;
    const cx = tc(W / 2), cy = tc(H / 2);
    const sd = seedOf(name), rd = k => rnd(sd, k), seed = k => Math.floor(rd(k) * 1e6);
    const rot = isFinite(ctx.rot) ? +ctx.rot : 0;
    const base = {variant: 'mixed', tone: 'stone', rot: 0, label: '', n: 0, room: 0, feather: 0, bright: 1, mask: false,
                  grain: 1, scale: 1, mult: 1, jitter: 0, scatter: 0, fall: 0, out: 0, quad: null, blob: null, blobSeed: null,
                  matTag: null, matRef: 0, core: 0.35, aim: null, pad: 0, padFade: 0, padBreak: 0, r: c, ctrl: null, width: c * 2};
    const ROAD = {kind: 'road', bright: 1.3, pad: 1.2, padFade: 0.8, padBreak: 0.3};
    const road = (pts, k) => Object.assign({}, base, ROAD, {type: 'line', seed: seed(k), x: pts[0][0], y: pts[0][1], w: z * 6, h: z * 5, pts});
    const area = (kind, type, x, y, w, h, k, more) => Object.assign({}, base, {kind, type, seed: seed(k), x, y, w, h, pts: [[0, 0]]}, more || {});
    const unit = deg => { const t = deg * Math.PI / 180; return [Math.sin(t), -Math.cos(t)]; };
    const margin = z * 2.5;
    const inside = (x, y) => x > margin && x < W - margin && y > margin && y < H - margin;
    const wander = (k, n) => (rd(k) - 0.5) * z * n;
    const shapes = [], houses = [];
    /* the ways out */
    let ways = (ctx.ways || []).slice(0, 5);
    if (!ways.length) ways = [{bearing: 90}, {bearing: 270}];
    const angs = [];
    ways.forEach((wy, j) => {
      const th = norm(wy.bearing + rot), d = unit(th);
      let reach = 0;
      while (reach < W + H && inside(cx + d[0] * (reach + z), cy + d[1] * (reach + z))) reach += z;
      const card = (Math.round(th / 90) * 90) % 360, cu = unit(card), stub = z * 4;
      let run = reach * (0.7 + 0.14 * rd(30 + j)), P = null, Q = null;
      for (let g = 0; g < 60; g++){
        P = [tc(cx + d[0] * run), tc(cy + d[1] * run)];
        Q = [P[0] + cu[0] * stub, P[1] + cu[1] * stub];
        if (inside(Q[0], Q[1]) || run < z * 6) break;
        run -= z;
      }
      const n = [-d[1], d[0]], mw = wander(40 + j, 3);
      const mid = [cx + d[0] * run * 0.5 + n[0] * mw, cy + d[1] * run * 0.5 + n[1] * mw];
      shapes.push(road([[cx, cy], mid, P, Q], 50 + j));
      angs.push(th);
      /* two houses along it, on alternate sides, clear of the roundabout */
      for (let k = 0; k < 2; k++){
        const t = (k ? 0.64 : 0.36) * run, side = ((j + k) & 1) ? 1 : -1;
        houses.push({x: cx + d[0] * t + n[0] * side * z * 3.4, y: cy + d[1] * t + n[1] * side * z * 3.4, k: 70 + j * 2 + k});
      }
    });
    /* the roundabout at the crossing, for half the towns */
    if (rd(60) < 0.5)
      shapes.push(Object.assign({}, base, ROAD, {type: 'ring', seed: seed(61), x: cx, y: cy, w: z * 2, h: z * 2, r: z, pts: [[cx, cy]]}));
    /* the gaps between the roads, widest first */
    const sorted = angs.slice().sort((p, q) => p - q);
    const gaps = sorted.map((p, k) => { const q = sorted[(k + 1) % sorted.length] + (k + 1 === sorted.length ? 360 : 0);
                                        return {mid: norm((p + q) / 2), size: q - p}; }).sort((p, q) => q.size - p.size);
    const spot = (g, R) => { const u = unit(g.mid); return [tc(cx + u[0] * R), tc(cy + u[1] * R)]; };
    const fits = (x, y, w, h) => inside(x - w / 2, y - h / 2) && inside(x + w / 2, y + h / 2);
    if (gaps.length){
      const g0 = gaps[0], g1 = gaps[1] || gaps[0], g2 = gaps[2] || gaps[0];
      const pk = spot(g0, z * 13);
      if (fits(pk[0], pk[1], z * 12, z * 9)){
        shapes.push(area('grass', 'rect', pk[0], pk[1], z * 12, z * 9, 17));
        shapes.push(area('park', 'rect', pk[0] - z, pk[1], z * 8, z * 5, 18, {variant: undefined}));
      }
      const nT = 1 + Math.floor(rd(62) * 2);
      for (let k = 0; k < nT; k++){
        const tr = spot(g1, z * (17 + k * 6 + rd(63 + k) * 3));
        if (fits(tr[0], tr[1], z * 6, z * 5)) shapes.push(area('trees', 'rect', tr[0], tr[1], z * 6, z * 5, 64 + k, {variant: undefined}));
      }
      if (rd(80) < 0.35){
        const wt = spot(gaps.length > 2 ? g2 : g1, z * 21);
        if (fits(wt[0], wt[1], z * 10, z * 7)) shapes.push(area('water', 'warp', wt[0], wt[1], z * 10, z * 7, 81, {blobSeed: 'oval'}));
      }
    }
    /* the houses, the first the palace's */
    const glyphs = typeof Bench !== 'undefined' && Bench.of ? Bench.of('houses') : typeof Glyphs !== 'undefined' ? (Glyphs.of('houses') || []) : [];
    let palace = null;
    houses.forEach((h, j) => {
      if (!glyphs.length || !inside(h.x, h.y)) return;
      const pick = glyphs[(i * 5 + j * 3) % glyphs.length], rows = Glyphs.rows(pick);
      if (!rows || !rows.length) return;
      const m = rd(h.k) < 0.5 ? 1 : 1.5, w = rows[0].length * c * m, hh = rows.length * c * m;
      if (!fits(h.x, h.y, w, hh)) return;
      shapes.push(area('house', 'rect', h.x, h.y, w, hh, h.k, {variant: pick, mult: m}));
      if (!palace) palace = [h.x, h.y];
    });
    for (const sh of shapes) if (sh.variant === undefined) delete sh.variant;
    const P = palace || [cx + z * 4.5, cy - z * 4];
    const snap = v => (Math.floor(v / z) + 0.5) * z;
    const marker = {uid: 'm' + Date.now().toString(36) + i.toString(36) + Math.random().toString(36).slice(2, 5),
                    name: String(name).slice(0, 40), n: 1, slot: 0, gi: 0, x: snap(P[0]), y: snap(P[1]),
                    size: z * 0.8, tint: 0, item: null};
    return {shapes, markers: [marker], turn: rot * Math.PI / 180};
  }
  /* the ways out of a town: the towns linked to it on the region, by
     true bearing from its place */
  function waysOf(id, geo){
    const T = towns(), out = [];
    for (const [a, b] of userLinks()){
      const o = a === id ? b : b === id ? a : null; if (!o) continue;
      const t = T.find(t => t.root === o); if (!t || !t.geo) continue;
      out.push({name: t.name, bearing: bearing(geo, t.geo), km: km(geo, t.geo)});
    }
    return out;
  }
  /* a demo plate's storage written whole — shapes, its palace, the
     underlay's record with the town's place and the plate's turn */
  function layPlate(id, d, i){
    const g = {lat: d.lat, lon: d.lon};
    const plate = demoPlate(d.name, i, {rot: turnOf(d.name), ways: waysOf(id, g)});
    try {
      Store.set(Atlas.skey(id), JSON.stringify(plate.shapes));
      Store.set(Atlas.mkey(id), JSON.stringify(plate.markers));
      Store.set('hq.basemap.' + id, JSON.stringify({shown: false, lat: d.lat, lon: d.lon, z: 15, dim: 0.25, scale: 1,
                                                     src: 'dark', gkey: '', gtype: 'roadmap', place: null, placing: false, turn: plate.turn}));
    } catch (e){ note('could not write ' + d.name + ': ' + (e.message || e)); return false; }
    return true;
  }
  /* every demo town laid again from scratch, with the links as they are
     now — anything built on one is lost; from a demo plate the walker
     is put home first, since the plate under it is being rewritten */
  function relayDemo(){
    const areas = Atlas.areas(), ids = Object.keys(areas).filter(k => areas[k].demo);
    if (!ids.length){ note('no demo towns to lay again'); return 0; }
    if (ids.indexOf(Atlas.current()) >= 0) Atlas.go('home', null);
    let i = 0, n = 0;
    for (const id of ids){
      const a = areas[id], d = DEMO.find(x => x.name === a.name) || (a.geo ? {name: a.name, lat: a.geo.lat, lon: a.geo.lon} : null);
      if (!d) continue;
      if (layPlate(id, d, i++)) n++;
    }
    note(n + (n === 1 ? ' demo town' : ' demo towns') + ' laid again');
    return n;
  }
  function foundSamples(){
    if (!G.terr || typeof Atlas === 'undefined' || !Atlas.make) return 0;
    const had = new Map();                    // a town's name → its root plate
    for (const t of towns()) had.set(String(t.name || '').toLowerCase(), t.root);
    const idFor = nm => { const k = String(nm).toLowerCase(); return had.get(k) || (nm === HOME_NAME ? 'home' : null); };
    const made = new Map();                   // sample name (lower) → new id
    const fresh = [];                         // [id, sample] — plates to lay once the links are known
    for (const d of DEMO){
      const key = d.name.toLowerCase();
      if (had.has(key)) continue;
      const id = 'a' + slug(d.name);
      if (Atlas.areas()[id]) continue;
      const more = {demo: true}; if (d.group) more.group = d.group;
      if (!Atlas.make(id, d.name, {lat: d.lat, lon: d.lon}, more)) continue;
      had.set(key, id); made.set(key, id); fresh.push([id, d]);
    }
    /* the links: every sample link, and each group's lead to its members;
       a link that named a sample by name now names its plate */
    let L = userLinks().map(([a, b]) => [made.get(a) || a, made.get(b) || b]).filter(([a, b]) => a !== b);
    const has = (a, b) => L.some(([p, q]) => linkKey(p, q) === linkKey(a, b));
    const want = DEMO_LINKS.slice();
    for (const d of DEMO) if (d.group && d.group !== d.name) want.push([d.group, d.name]);
    let linked = 0;
    for (const [p, q] of want){
      const a = idFor(p), b = idFor(q);
      if (!a || !b || a === b || has(a, b)) continue;
      L = L.concat([[a, b]]); linked++;
    }
    if (made.size || linked || L.length !== userLinks().length) writeLinks(L);
    /* the plates last, so each town's roads leave toward its links */
    fresh.forEach(([id, d], i) => layPlate(id, d, i));
    if (frame){ shown = null; stood = null; }
    note(made.size ? made.size + (made.size === 1 ? ' town' : ' towns') + ' founded, ' + linked + ' linked · stand by one on the region and press Enter'
                   : 'every sample is a town already' + (linked ? ' · ' + linked + ' linked' : ''));
    return made.size;
  }

  /* ── the end of the road leads to the next town ────────────────────────
     Eden, 2026-09-06: "we want the end of the road within the plate to
     line up with the next plate on the zoomed out map - so if the
     compass direction matches the zoomed out map in terms of which way
     the end of the road is pointing to the east then the next town over
     on the east connects so we can travel between plates on the zoomed
     in zone". A road that ends heading a way leads to the town that lies
     that way on the region. The way is read TRUE: the plate's screen
     direction turned back by the traced picture's heading (Basemap.rot,
     what the compass shows), so east on a plate turned thirty degrees
     anticlockwise is east-south-east on the map; the town is the one
     whose bearing from this plate's anchor is within sixty degrees of
     that — a town LINKED to this one on the region first, by the closest
     bearing, since a link is where a road leaves one town for another;
     else the nearest town that way at all. A linked town is crossed to at
     once, as a joined plate is; an unlinked one is offered at the end of
     the road (src/atlas.js `end`) and linked on the way over, so the
     region grows the road that was walked. Arriving, the walker stands
     on the road end of the other plate that points back this way — the
     westmost end heading west after a crossing eastward — so the two
     roads line up across the map; failing one, at the edge in the same
     row or column and then the nearest road, as a plate joined by hand
     lands. The other plate's turn is read off its record, since its
     underlay mounts after the walker has landed. */
  const SCREEN = {n: 0, e: 90, s: 180, w: 270};
  const norm = a => ((a % 360) + 360) % 360;
  const diff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
  const rotDeg = () => (typeof Basemap !== 'undefined' && Basemap.rot) ? Basemap.rot() * 180 / Math.PI : 0;
  function storedRot(id){
    const b = Store.json(id === 'home' ? 'hq.basemap' : 'hq.basemap.' + id, null);
    if (!b) return 0;
    if (b.place && isFinite(b.place.rot)) return b.place.rot * 180 / Math.PI;
    return isFinite(b.turn) ? +b.turn * 180 / Math.PI : 0;          // a plate turned with no picture
  }
  const bearing = (a, b) => {
    const m = (a.lat + b.lat) / 2 * Math.PI / 180;
    return norm(Math.atan2((b.lon - a.lon) * Math.cos(m), b.lat - a.lat) * 180 / Math.PI);
  };
  const km = (a, b) => { const m = (a.lat + b.lat) / 2 * Math.PI / 180; return Math.hypot((b.lon - a.lon) * Math.cos(m), b.lat - a.lat) * 111; };
  const WORD = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  const word = h => WORD[Math.round(norm(h) / 45) % 8];
  const myTown = () => { const cur = Atlas.current(); return towns().find(t => t.plates.indexOf(cur) >= 0) || null; };
  const CONE = 60;
  function wayOut(dir){
    if (frame || !G.terr || SCREEN[dir] === undefined) return null;
    const me = myTown(); if (!me) return null;
    const here = Atlas.geo(Atlas.current()) || me.geo; if (!here) return null;
    const h = norm(SCREEN[dir] - rotDeg());
    const L = userLinks();
    const joined = t => L.some(([a, b]) => (a === me.root && b === t.root) || (a === t.root && b === me.root));
    let best = null;
    for (const t of towns()){
      if (t.root === me.root || !t.geo) continue;
      const b = bearing(here, t.geo), off = diff(h, b);
      if (off > CONE) continue;
      const c = {town: t, linked: joined(t), heading: h, word: word(h), bearing: b, off, km: km(here, t.geo)};
      if (!best || (c.linked && !best.linked) ||
          (c.linked === best.linked && (c.linked ? c.off < best.off : c.km < best.km))) best = c;
    }
    return best;
  }
  /* the road end on the plate just mounted that heads `back` (true), the
     one furthest that way: a road tile with one road neighbour, its stub
     pointing away from that neighbour */
  function roadEnd(back, id){
    const t = G.terr; if (!t) return null;
    const rot = storedRot(id), a = (back + rot) * Math.PI / 180, sv = [Math.sin(a), -Math.cos(a)];
    const P = (x, y) => x >= 0 && y >= 0 && x < t.tw && y < t.th && !!t.path[y * t.tw + x];
    let best = null, bs = -Infinity;
    for (let y = 0; y < t.th; y++) for (let x = 0; x < t.tw; x++){
      if (!P(x, y)) continue;
      let nb = 0, vx = 0, vy = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++)
        if ((i || j) && P(x + i, y + j)){ nb++; vx -= i; vy -= j; }
      /* an end: one to three road neighbours, all behind it, nothing
         ahead — a road two tiles wide ends in two such tiles, either
         will do */
      if (!nb || nb > 3 || (!vx && !vy)) continue;
      const ax = Math.abs(vx) >= Math.abs(vy) ? Math.sign(vx) : 0, ay = ax ? 0 : Math.sign(vy);
      if (P(x + ax, y + ay)) continue;
      const hs = norm(Math.atan2(vx, -vy) * 180 / Math.PI - rot);
      if (diff(hs, back) > CONE) continue;
      const sc = x * sv[0] + y * sv[1];
      if (sc > bs){ bs = sc; best = [x, y]; }
    }
    return best;
  }
  function cross(w, dir){
    if (!w || !w.town || frame || !G.terr) return false;
    const me = myTown(), id = w.town.root;
    if (me && !w.linked && me.root !== id) writeLinks(userLinks().concat([[me.root, id]]));
    const e = Atlas.entry ? Atlas.entry(dir, [G.x, G.y]) : null;
    if (typeof Morph !== 'undefined' && Morph.sweep) Morph.sweep(dir);     // the cells arrive in a sweep, against the way walked
    if (!Atlas.go(id, e)) return false;
    const at = roadEnd(norm(w.heading + 180), id);
    if (at){
      G.x = G.tx = at[0]; G.y = G.ty = at[1];
      const q = toWorld(G.x, G.y); G.fx = q[0]; G.fy = q[1]; G.moving = false; G.bump = false;
      floodReach();
    }
    G.face = dir === 'e' ? [1, 0] : dir === 'w' ? [-1, 0] : dir === 'n' ? [0, -1] : [0, 1];
    note(w.town.name + ' \u00b7 ' + w.word + ' by road' + (w.linked ? '' : ' \u00b7 linked on the region'));
    return true;
  }

  /* ── the next town's name, at the end of the road ──────────────────────
     Standing on the last tile of a road that leads somewhere, a small
     label fades in beside the walker with the name of what is beyond —
     the plate joined there, or the town that lies that way on the region
     — and the way and the distance under it (Eden, 2026-09-06: "make the
     next town title fade in with a small label popping up when we are
     about to enter that plate"). `endHere` is game.js tryStep's own rule
     for a road end: one walkable neighbour, behind. Worked out once per
     tile stood on; placed beside the walker every frame it is up. */
  function endHere(){
    if (frame || !G.terr || typeof wAt !== 'function' || !wAt(G.x, G.y)) return null;
    let nb = 0, vx = 0, vy = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++)
      if ((i || j) && wAt(G.x + i, G.y + j)){ nb++; vx -= i; vy -= j; }
    if (nb !== 1) return null;
    return {dir: Math.abs(vx) >= Math.abs(vy) ? (vx > 0 ? 'e' : 'w') : (vy > 0 ? 's' : 'n')};
  }
  const nl = {key: '', el: null};
  function nextLabel(){
    let el = nl.el;
    if (!el){
      el = document.getElementById('nextplate');
      if (!el){ el = document.createElement('div'); el.id = 'nextplate'; el.className = 'glass'; document.body.appendChild(el); }
      nl.el = el;
    }
    const inside = typeof Interior !== 'undefined' && Interior.inside();
    const e = (!G.paused && !inside && !G.moving && !WALL) ? endHere() : null;
    const key = e ? Atlas.current() + '|' + G.x + ',' + G.y + '|' + e.dir : '';
    if (key !== nl.key){
      nl.key = key;
      let name = '', sub = '';
      if (e){
        const areas = Atlas.areas(), cur = areas[Atlas.current()];
        const l = (cur && cur.links || []).find(l => l.at[0] === G.x && l.at[1] === G.y);
        if (l && areas[l.to]){ name = areas[l.to].name; sub = 'the next plate \u00b7 press on'; }
        else {
          const w = wayOut(e.dir);
          if (w){ name = w.town.name; sub = w.word + ' \u00b7 ' + Math.round(w.km) + ' km \u00b7 press on'; }
        }
      }
      if (!name) el.classList.remove('on');
      else {
        el.innerHTML = '';
        const b = document.createElement('b'); b.textContent = name;
        const sp = document.createElement('span'); sp.textContent = sub;
        el.append(b, sp);
        el.classList.add('on');
        nl.w = el.offsetWidth; nl.h = el.offsetHeight;          // measured once, as the words are set
      }
    }
    /* centred over the sprite and floating above it; below it when above
       would be off the top of the window, and never past an edge (Eden,
       2026-09-06: "make sure we can see it on the screen, not half on
       half off, so it floats above or below the sprite") */
    if (el.classList.contains('on')){
      const bb = canvas.getBoundingClientRect(), k = VW / (bb.width || 1), w = toWorld(G.x, G.y);
      const sx = (w[0] - G.cam[0]) * G.cam[2] / k + bb.width / 2 + bb.left;
      const sy = (w[1] - G.cam[1]) * G.cam[2] / k + bb.height / 2 + bb.top;
      const lw = nl.w || el.offsetWidth, lh = nl.h || el.offsetHeight, PADW = 6, LIFT = 20;
      let left = sx - lw / 2, top = sy - LIFT - lh;
      if (top < PADW) top = sy + LIFT;
      left = Math.max(PADW, Math.min(innerWidth - lw - PADW, left));
      top = Math.max(PADW, Math.min(innerHeight - lh - PADW, top));
      el.style.left = Math.round(left) + 'px';
      el.style.top = Math.round(top) + 'px';
    }
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
  function init(){ banner(); wireDrag(); wireKeys(); wireSlider(); }

  const api = {init, enter, leave, toggle, go, press, target, prompt, overlay, towns, bow, hop, open, scene,
               stamp, linkClick, removeLink, unlink, viewState, setLock, forgetZoom, zoomTo, zoomBy, zoomLocked, eyeKey, rest,
               grab, dragTo, drop, on, gate: null, foundSamples, relayDemo, wayOut, cross, demoPlate, endHere, nextLabel,
               held: () => !!held};
  return api;
})();
