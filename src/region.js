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
  function overlay(a, m, cap){
    if (!frame || !G.terr) return m;
    const z = G.cam[2], px = 1 / z;
    const r = radius(), ls = Math.max(r * 0.4, 7 * px);   // the name's glyph half-size
    for (const sp of spots()){
      if (m > cap - 8 - sp.town.plates.length * 2) break;
      const c = sp.town.here ? FLARE : sp.anchored ? BONE : DIM;
      const Q = typeof Quest !== 'undefined' ? Quest : null;
      for (let i = 0; i < sp.town.plates.length; i++){
        const x = sp.x0 + i * sp.pitch, pid = sp.town.plates[i];
        /* a plate that is a letter of the region wears its letter's tone,
           and the letter itself, in the plate's own ground colour */
        const L = Q ? Q.letter(pid) : null;
        const cc = L ? L.tone : c;
        m = put(a, m, x, sp.y, cc[0], cc[1], cc[2], 0.3, r * 2.0, 0, 0, 0, 2);
        m = put(a, m, x, sp.y, cc[0], cc[1], cc[2], sp.anchored ? 1 : 0.7, r, 0, 0, 0, 1);
        if (L) m = Markers.text(a, m, L.ch, x, sp.y, r * 0.55, GROUND, 1, cap);
        if (sp.town.here && L) m = put(a, m, x, sp.y, FLARE[0], FLARE[1], FLARE[2], 0.9, r * 1.4, 1, 0, 0, 1);
        if (Q && Q.targetPlate() === pid)
          m = put(a, m, x, sp.y, 0.95, 0.76, 0.31, 0.7 + 0.3 * Math.sin(performance.now() / 300), r * 1.9, 1, 0, 0, 1);
      }
      const name = String(sp.town.name || '').toUpperCase();
      /* each glyph is put at its own centre, so a run is centred on the
         first glyph's x plus half of the gaps between them — the way
         `Markers.number` lays digits, and half a glyph right of where
         the full width put it before */
      if (name) m = Markers.text(a, m, name, sp.x - (name.length - 1) * ls * 1.06 / 2,
                                 sp.y + r * 2 + ls * 1.3, ls, c, 0.9, cap);
    }
    return m;
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
    const key = t ? t.root + '|' + t.name : '';
    if (key === shown) return;
    shown = key;
    el.hidden = !t;
    if (!t) return;
    el.innerHTML = '';
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
  function init(){ banner(); }

  const api = {init, enter, leave, toggle, go, press, target, prompt, overlay, towns,
               grab, dragTo, drop, on, gate: null,
               held: () => !!held};
  return api;
})();
