'use strict';
/* ── the atlas: one town is many plates ───────────────────────────────
   The rule the whole interface is built on is that the map never pans and
   never zooms: what is on screen is the town, and if the town needs more
   room, the town gets another plate. A plate is exactly what the home town
   already is — a set of shapes under a storage key, markers under another
   — so a second one is the same machinery mounted on a second pair of
   keys, which is what going inside a building already does.

   Plates are joined where roads END. Walk to the end of a road and press
   on, and if that end leads somewhere you arrive there; if it does not,
   you are asked whether to open a plate for it. Every dead end is its own
   doorway — a town may have many roads, long or short, and each can lead
   to its own plate — so a link is kept per end, not per side. The compass
   at the bottom of the HUD draws them as a mind map, laid out by which
   way each road was heading, and jumps.

   `hq.atlas` holds the graph and which plate you are on. The home plate
   keeps the keys it always had, so a town saved before the atlas existed
   is the home plate of a one-plate atlas without being touched.

   A plate may also know WHERE it is: an optional `geo: {lat, lon}`. The
   graph says how plates join; geo says where on the country they fall,
   which is what the towns map (`src/towns.js`) draws. Home takes its
   anchor from the traced underlay's search point the first time one is
   there to take; a plate opened from a road end inherits its neighbour's,
   stepped the way the road was heading; any plate can be pinned by hand.
   A plate with no geo is simply not on the map — never guessed at. */

const Atlas = (() => {
  const KEY = 'hq.atlas';
  const OPP = {n: 's', s: 'n', e: 'w', w: 'e'};
  const skey = id => id === 'home' ? 'hq.shapes' : 'hq.shapes.' + id;
  const mkey = id => id === 'home' ? 'hq.markers' : 'hq.markers.' + id;

  let A = load();
  function load(){
    try {
      const a = JSON.parse(Store.get(KEY) || 'null');
      if (a && a.areas && a.areas.home){
        for (const id in a.areas) if (!Array.isArray(a.areas[id].links)) a.areas[id].links = [];
        return a;
      }
    } catch (e){}
    return {areas: {home: {name: 'Home', links: []}}, current: 'home'};
  }
  function save(){ try { Store.set(KEY, JSON.stringify(A)); } catch (e){} }

  /* ── where a plate is ────────────────────────────────────────────────
     One step between joined plates is one cell of the country raster —
     0.0125°, about 1.4 km — which is roughly what a plate of town covers at
     the zoom a town is traced at, and exactly one dot on the towns map, so
     a road that leads to the next plate leads to the next cell. Not the
     truth about the ground; a place to put the dot until it is pinned. */
  const STEP = 0.0125;
  const geoOK = g => !!g && isFinite(g.lat) && isFinite(g.lon) && (g.lat || g.lon);
  const geo = id => { const a = A.areas[id || A.current]; return a && geoOK(a.geo) ? a.geo : null; };
  function setGeo(id, lat, lon){
    const a = A.areas[id || A.current]; if (!a) return false;
    if (lat == null){ delete a.geo; save(); return true; }
    a.geo = {lat: +lat, lon: +lon}; save(); return true;
  }
  const stepped = (g, dir) => !g ? null :
    {lat: g.lat + (dir === 'n' ? STEP : dir === 's' ? -STEP : 0),
     lon: g.lon + (dir === 'e' ? STEP : dir === 'w' ? -STEP : 0)};
  /* the home plate's anchor is the underlay's search point, taken once:
     a home already placed — by hand, or by an earlier run — keeps it */
  function seed(){
    if (geo('home') || typeof Basemap === 'undefined' || !Basemap.at) return;
    const [lat, lon] = Basemap.at();
    if (lat || lon) setGeo('home', lat, lon);
  }
  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };

  /* ── where a crossing lands ───────────────────────────────────────────
     A road heading north when it ended arrives on the south edge of the
     plate beyond, in the same column, and carries on northward from
     there: the new plate is drawn as though it lay in that direction. */
  function entry(dir, at){
    const t = G.terr;
    if (dir === 'n') return [at[0], t.th - 1];
    if (dir === 's') return [at[0], 0];
    if (dir === 'e') return [0, at[1]];
    return [t.tw - 1, at[1]];
  }

  /* ── standing on another plate ───────────────────────────────────────
     Commit here, mount there, stand the walker where asked — or where
     spawn() would put it, when the jump came from the map rather than
     from an edge. Never from inside a building: a plan is not a plate. */
  function go(id, at){
    if (!A.areas[id] || !G.terr) return false;
    if (typeof Interior !== 'undefined' && Interior.inside()) return false;
    /* from the region, a jump is a jump home first: the frame it holds
       is the plate being left, and mounting over it would lose it */
    /* a jump is refused across a plate with a distraction on it
       (src/distract.js); a crossing on foot has nothing between and passes */
    if (typeof Distract !== 'undefined' && !Distract.allow(id)) return false;
    if (typeof Region !== 'undefined' && Region.on()) Region.leave();
    if (id === A.current && !at) return true;
    Build.commit(); Markers.commit();
    A.current = id; save();
    Markers.mount(mkey(id));
    Build.mount('map', skey(id));               // restamps the walk grid
    if (typeof Basemap !== 'undefined' && Basemap.mount) Basemap.mount(id);
    if (at){
      G.x = G.tx = at[0]; G.y = G.ty = at[1];
      const w = toWorld(G.x, G.y);
      G.fx = w[0]; G.fy = w[1]; G.moving = false; G.bump = false;
      /* the crossing tile is road on a plate opened from a road; on one
         joined by hand it may not be, and a walker standing on nothing
         reaches nothing — so the nearest road, as after any edit */
      if (typeof revalidate === 'function') revalidate(); else floodReach();
    } else spawn();
    G.round = 1; G.msg = ''; G.over = false;
    scatterSparks();
    note(A.areas[id].name);
    closeMap();
    return true;
  }

  /* ── a plate beyond an edge ──────────────────────────────────────────
     Opened joined both ways, with a stub of road running in from the
     crossing so the walker arrives on ground rather than on nothing, and
     the road you were on visibly continues. The stub is written straight
     into the new plate's storage in the shape the builder saves, before
     the plate is mounted, so the builder loads it like anything else. */
  const linkAt = (area, at, dir) => area.links.find(l => l.at[0] === at[0] && l.at[1] === at[1] && (!dir || l.dir === dir));
  function add(dir, at){
    const cur = A.areas[A.current];
    const had = linkAt(cur, at, dir);
    if (had) return go(had.to, had.land);
    const id = 'a' + Date.now().toString(36);
    const n = Object.keys(A.areas).length;
    const from = A.current;
    const t = G.terr, z = t.tsz, e = entry(dir, at);
    A.areas[id] = {name: 'Plate ' + (n + 1), links: [{at: e, dir: OPP[dir], to: from, land: at}]};
    const g = stepped(geo(from), dir);
    if (g) A.areas[id].geo = g;
    cur.links.push({at: [at[0], at[1]], dir, to: id, land: e});
    save();
    const dx = dir === 'e' ? 1 : dir === 'w' ? -1 : 0, dy = dir === 's' ? 1 : dir === 'n' ? -1 : 0;
    const a = [(e[0] + 0.5) * z - dx * z, (e[1] + 0.5) * z - dy * z];   // half a tile past the edge, so the crossing tile is covered
    const b = [(e[0] + 0.5) * z + dx * z * 5, (e[1] + 0.5) * z + dy * z * 5];
    const stub = {kind: 'road', type: 'line', seed: (Math.random() * 1e6) | 0, variant: 'mixed', rot: 0,
                  label: '', n: 0, room: 0, feather: 0, bright: 1.3, mask: false,
                  grain: 1, scale: 1, jitter: 0, scatter: 0, fall: 0, out: 0, quad: null, blob: null,
                  core: 0.35, aim: null, pad: 1.2, padFade: 0.8, padBreak: 0.3,
                  x: a[0], y: a[1], w: z * 6, h: z * 5, r: z * 0.25, pts: [a, b], ctrl: null, width: z * 0.5};
    try { Store.set(skey(id), JSON.stringify([stub])); } catch (err){}
    return go(id, e);
  }

  /* ── the end of the road ─────────────────────────────────────────────
     Called by the walker when it presses on from a dead end. Joined:
     cross. Not joined: ask, in a prompt that holds the keys until
     answered. A dead end is a road tile with at most one road neighbour,
     pressed away from that neighbour — decided in game.js, where the
     walk grid is, so this only ever hears about real ends. */
  const NAME = {n: 'north', s: 'south', e: 'east', w: 'west'};
  let asking = null;
  function end(dir, at){
    const cur = A.areas[A.current];
    const l = linkAt(cur, at, dir) || linkAt(cur, at, null);
    if (l) return go(l.to, l.land);
    if (typeof Interior !== 'undefined' && Interior.inside()) return false;
    asking = {dir, at};
    const el = prompt();
    el.querySelector('b').textContent = NAME[dir];
    el.hidden = false;
    return true;
  }
  function prompt(){
    let el = document.getElementById('edge');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'edge';
    el.className = 'glass';
    el.innerHTML = '<div class="plabel">The end of the road</div>' +
      '<div>the road ends here heading <b></b>, and leads nowhere yet</div>' +
      '<div class="erow"><button id="edgeyes">open a plate</button><button id="edgeno">stay</button></div>' +
      '<div class="knote">enter opens &middot; esc stays</div>';
    document.body.appendChild(el);
    el.querySelector('#edgeyes').onclick = yes;
    el.querySelector('#edgeno').onclick = no;
    return el;
  }
  /* yes is not the plate yet: a plate is founded on an address (src/found.js),
     and the plate is made when the address is found */
  function yes(){
    if (!asking) return; const q = asking; asking = null; prompt().hidden = true;
    if (typeof Found !== 'undefined') Found.ask(q, 'the road ends here heading ' + NAME[q.dir] + ' — where does it lead?');
    else add(q.dir, q.at);
  }
  function no(){ asking = null; prompt().hidden = true; }
  addEventListener('keydown', e => {
    if (asking){
      if (e.code === 'Enter' || e.code === 'NumpadEnter'){ e.preventDefault(); e.stopPropagation(); yes(); }
      else if (e.code === 'Escape'){ e.preventDefault(); e.stopPropagation(); no(); }
      else if (/^(Key[WASD]|Arrow)/.test(e.code)){ e.preventDefault(); e.stopPropagation(); no(); }
      return;
    }
    if (mapOpen() && e.code === 'Escape'){ e.preventDefault(); e.stopPropagation(); closeMap(); }
    /* the founding dialog holds every key but its own field's */
    if (typeof Found !== 'undefined' && Found.open()){
      if (e.target && e.target.id === 'foundq') return;
      e.preventDefault(); e.stopPropagation();
      if (e.code === 'Escape') Found.later();
    }
  }, true);

  /* ── the mind map ────────────────────────────────────────────────────
     Plates laid out by how they join: home in the middle, each neighbour
     one step in its direction, breadth first, so the picture is the town
     as it is walked and not a list. The one you are on is inverted, like
     every selection in this game. Click one to stand on it. */
  function place(){
    const pos = {home: [0, 0]}, q = ['home'];
    const D = {n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0]};
    const taken = new Set(['0,0']);
    while (q.length){
      const id = q.shift();
      for (const l of A.areas[id].links){
        if (pos[l.to]) continue;
        /* one step the way the road was heading; if that cell is taken by
           another plate, slide along until one is free */
        let x = pos[id][0] + D[l.dir][0], y = pos[id][1] + D[l.dir][1];
        while (taken.has(x + ',' + y)){ if (D[l.dir][0]) y++; else x++; }
        pos[l.to] = [x, y]; taken.add(x + ',' + y);
        q.push(l.to);
      }
    }
    for (const id in A.areas) if (!pos[id]) pos[id] = [0, Object.keys(pos).length]; // an orphan, listed below
    return pos;
  }
  function openMap(){
    let el = document.getElementById('atlas');
    if (!el){
      el = document.createElement('div');
      el.id = 'atlas'; el.className = 'glass';
      document.body.appendChild(el);
    }
    const pos = place();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const id in pos){ x0 = Math.min(x0, pos[id][0]); y0 = Math.min(y0, pos[id][1]); x1 = Math.max(x1, pos[id][0]); y1 = Math.max(y1, pos[id][1]); }
    const CW = 96, CH = 56;
    let html = '<div class="plabel">The plates</div><div class="amap" style="width:' + ((x1 - x0 + 1) * CW) +
               'px;height:' + ((y1 - y0 + 1) * CH) + 'px">';
    for (const id in pos){
      const [x, y] = pos[id];
      const a = A.areas[id];
      for (const l of a.links){          // a joint, drawn once, from the plate above or to the left
        const q = pos[l.to]; if (!q) continue;
        if (q[1] === y + 1 && q[0] === x) html += '<i class="ajoin v" style="left:' + ((x - x0) * CW + CW / 2 - 1) + 'px;top:' + ((y - y0) * CH + CH - 8) + 'px"></i>';
        if (q[0] === x + 1 && q[1] === y) html += '<i class="ajoin h" style="left:' + ((x - x0) * CW + CW - 8) + 'px;top:' + ((y - y0) * CH + CH / 2 - 1) + 'px"></i>';
      }
      html += '<div class="achip' + (id === A.current ? ' sel' : '') + '" data-id="' + id + '" style="left:' +
              ((x - x0) * CW + 8) + 'px;top:' + ((y - y0) * CH + 8) + 'px">' + a.name + '</div>';
    }
    html += '</div><div class="knote">click a plate to stand on it &middot; walk to the end of a road and press on to open the next &middot; esc closes</div>';
    el.innerHTML = html;
    el.querySelectorAll('.achip').forEach(c => { c.onclick = () => go(c.dataset.id, null); });
    el.hidden = false;
  }
  const mapOpen = () => { const el = document.getElementById('atlas'); return !!el && !el.hidden; };
  function closeMap(){ const el = document.getElementById('atlas'); if (el) el.hidden = true; }
  function toggleMap(){ if (mapOpen()) closeMap(); else openMap(); }

  function init(){
    /* the home plate is where the walker wakes; a town saved before the
       atlas existed is that plate, so nothing here mounts anything on
       boot — only a current plate that is not home needs mounting */
    if (A.current !== 'home' && A.areas[A.current]){
      Markers.mount(mkey(A.current));
      Build.mount('map', skey(A.current));
      if (typeof Basemap !== 'undefined' && Basemap.mount) Basemap.mount(A.current);
    }
    seed();
    if (typeof Hud !== 'undefined') Hud.onTowns = toggleMap;
  }

  /* a plate may be one letter of the focused acronym (src/quest.js);
     the id is the journal's letter id, kept even when that acronym is
     not the one in focus */
  function setLetter(id, lid){
    const a = A.areas[id || A.current]; if (!a) return false;
    if (lid) a.letter = String(lid); else delete a.letter;
    save(); return true;
  }
  return {init, go, add, end, openMap, closeMap, toggleMap,
          current: () => A.current, areas: () => A.areas,
          name: () => A.areas[A.current].name,
          rename: v => { A.areas[A.current].name = v; save(); },
          setLetter, letterOf: id => (A.areas[id || A.current] || {}).letter || null,
          geo, setGeo, seed, layout: place,
          skey, mkey};
})();
