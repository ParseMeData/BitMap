'use strict';
/* ── tracing underlay ───────────────────────────────────────────────────
   A real map behind the plate, so you can search a town and lay roads and
   districts over the actual streets.

   It works in two modes, and the second is the one you build in.

   LIVE is a sheet of <img> tiles laid out in mercator pixels and pinned to
   the ground by lat/lon: you search a place and it appears where the maths
   says it belongs. That is how you find a town, and it is all the original
   did.

   FROZEN is one picture. Press Freeze and the tiles on screen are baked
   into a single image; or drop a PNG of your own onto the window — a
   screenshot of Google Maps, a scan of a paper map, anything. From then on
   nothing is fetched, no key is ever needed, and the picture is no longer
   tied to mercator at all: it has a position, a turn and a size you set by
   hand, because a picture you are tracing wants to be laid over the plate
   the way tracing paper is, not the way a coordinate system says.

   Baking needs the tiles untainted, so they are requested with
   crossOrigin='anonymous'. OSM and CARTO both answer `access-control-
   allow-origin: *`, which satisfies the `null` origin a file:// page sends.
   Google is not asked to, because a source that refuses it would fail to
   load at all rather than merely fail to bake — so Google tiles still show,
   and Freeze says plainly that it cannot bake them.

   The underlay is DOM, not GL: a canvas that clears transparent while it is
   showing. The game keeps its three draw calls, and moving, turning and
   scaling the sheet is one transform per frame either way. */

const Basemap = (() => {
  const TILE = 256;
  const KEY = 'hq.basemap';
  const IMGKEY = 'hq.basemap.img';          // localStorage fallback for the picture
  const OSM = 'https://tile.openstreetmap.org/';
  const DARK = 'https://basemaps.cartocdn.com/dark_nolabels/';
  const FIND = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=';
  const GOOGLE = 'https://maps.googleapis.com/maps/api/staticmap';
  /* sources that answer a cross-origin request, and so can be baked */
  const CORS = {osm: 1, dark: 1};
  const MAXBAKE = 4096;                     // longest edge of a baked picture

  let barOpen = false, shown = false;
  let lat = 0, lon = 0, z = 15, dim = 0.85, scale = 1;
  let src = 'dark', gkey = '', gtype = 'roadmap';
  let layer = null, live = new Map(), lastRange = '', origin = [0, 0];
  let placed = 0, failed = 0;
  /* the frozen picture and where it has been laid */
  let pic = null, picURL = '';
  let place = null;          // {x, y, s0, mult, rot, w, h} — world anchor is the centre
  let placing = false, drag = null;
  /* a stored picture comes back out of storage asynchronously, and the frame
     loop is already calling sync() by then. Without this the tile path runs
     for those few frames and fetches a whole sheet that adopt() immediately
     throws away — paid for on every single reload. */
  let waiting = false;

  /* web mercator, in pixels at zoom z, and back again */
  function merc(la, lo, zz){
    const n = TILE * Math.pow(2, zz);
    const r = Math.max(-85, Math.min(85, la)) * Math.PI / 180;
    return [(lo + 180) / 360 * n,
            (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n];
  }
  function unmerc(px, py, zz){
    const n = TILE * Math.pow(2, zz);
    const k = Math.PI - 2 * Math.PI * py / n;
    return [180 / Math.PI * Math.atan(0.5 * (Math.exp(k) - Math.exp(-k))),
            px / n * 360 - 180];
  }

  /* the only place that knows which map you are looking at */
  function tileURL(zz, x, y){
    if (src === 'google' && gkey){
      /* Google serves images by centre, not by tile index, so ask for the
         centre of the tile the grid wants and the same square comes back */
      const c = unmerc((x + 0.5) * TILE, (y + 0.5) * TILE, zz);
      return GOOGLE + '?center=' + c[0].toFixed(7) + ',' + c[1].toFixed(7) +
             '&zoom=' + zz + '&size=' + TILE + 'x' + TILE +
             '&maptype=' + gtype + '&key=' + encodeURIComponent(gkey);
    }
    if (src === 'dark') return DARK + zz + '/' + x + '/' + y + '.png';
    return OSM + zz + '/' + x + '/' + y + '.png';
  }

  /* screen → world, the same arithmetic build.js uses, so a drag over the
     picture and a drag over a shape agree about where the pointer is */
  function toWorld(ev){
    const b = canvas.getBoundingClientRect();
    const k = VW / (b.width || 1);
    return [((ev.clientX - b.left) * k - VW / 2) / G.cam[2] + G.cam[0],
            ((ev.clientY - b.top) * k - VH / 2) / G.cam[2] + G.cam[1]];
  }

  /* Held down rather than switched off. A floor plan has nothing to trace
     against, so going inside a building takes the underlay away — but it is
     the town's setting, not the room's, so it is put back untouched on the
     way out rather than being turned off and having to be turned on again. */
  let held = false;
  const showing = () => shown && !held;
  function suspend(v){
    if (held === !!v) return;
    held = !!v;
    if (held){ setBar(false); setPlacing(false); }
    if (layer) layer.style.display = showing() ? 'block' : 'none';
    if (R) R.clearA = showing() ? 0 : 1;
    if (showing()){ paint(); sync(); }
  }

  /* ── laid out by the camera, one transform a frame in either mode ── */
  function sync(){
    if (!showing() || !layer) return;
    const cssW = canvas.clientWidth || 1, dpr = VW / cssW;
    const Zc = G.cam[2] / dpr;
    const hw = (VW / dpr) / 2, hh = (VH / dpr) / 2;

    if (pic && place){
      /* A placed picture is world-anchored at its own centre, so turning it
         turns it about the point you are looking at rather than swinging it
         off screen. transform-origin is 0 0, so the trailing translate is
         what puts the centre under the anchor. */
      const sx = (place.x - G.cam[0]) * Zc + hw;
      const sy = (place.y - G.cam[1]) * Zc + hh;
      const k = place.s0 * place.mult * Zc;
      layer.style.transform =
        'translate(' + sx.toFixed(2) + 'px,' + sy.toFixed(2) + 'px) rotate(' +
        (place.rot * 180 / Math.PI).toFixed(4) + 'deg) scale(' + k.toFixed(6) +
        ') translate(' + (-place.w / 2).toFixed(2) + 'px,' +
        (-place.h / 2).toFixed(2) + 'px)';
      return;
    }

    if (waiting || !G.A || !G.terr) return;
    const m0 = merc(lat, lon, z);
    const C = [(G.sheetW || G.W) / 2, G.H / 2]   /* the sheet, not the plate: the plate carries a margin the trace was never over */;
    const k = scale * Zc;
    lay(m0, C);                       // may move the origin the tiles hang off
    /* Written relative to that origin, never in absolute mercator pixels:
       at zoom 15 those run to tens of millions, past what a compositor keeps
       exactly in a float, and the whole sheet lands nowhere. */
    const ax = (C[0] - G.cam[0]) * Zc + hw + (origin[0] - m0[0]) * k;
    const ay = (C[1] - G.cam[1]) * Zc + hh + (origin[1] - m0[1]) * k;
    layer.style.transform = 'translate(' + ax.toFixed(2) + 'px,' + ay.toFixed(2) +
                            'px) scale(' + k.toFixed(6) + ')';
  }

  /* only the tiles the view actually covers, and never a flood of them */
  function lay(m0, C){
    const hw = VW / (2 * G.cam[2]), hh = VH / (2 * G.cam[2]);
    const toM = (wx, wy) => [(wx - C[0]) / scale + m0[0], (wy - C[1]) / scale + m0[1]];
    const a = toM(G.cam[0] - hw, G.cam[1] - hh);
    const b = toM(G.cam[0] + hw, G.cam[1] + hh);
    const span = Math.pow(2, z);
    /* a tile of margin all round, so panning and zooming do not outrun the
       sheet and leave a bare edge while the next row is still loading */
    const x0 = Math.floor(a[0] / TILE) - 1, x1 = Math.floor(b[0] / TILE) + 1;
    const y0 = Math.max(0, Math.floor(a[1] / TILE) - 1);
    const y1 = Math.min(span - 1, Math.floor(b[1] / TILE) + 1);
    const range = src + z + ':' + x0 + ',' + y0 + ',' + x1 + ',' + y1;
    if (range === lastRange) return;
    lastRange = range;
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 140){ note('zoomed out too far to tile'); return; }

    /* keep the tiles hanging off a nearby origin, and shuffle the ones
       already placed when it moves, rather than reloading them */
    const nox = x0 * TILE, noy = y0 * TILE;
    if (nox !== origin[0] || noy !== origin[1]){
      const dx = origin[0] - nox, dy = origin[1] - noy;
      for (const [, img] of live){
        img.style.left = (parseFloat(img.style.left) + dx) + 'px';
        img.style.top = (parseFloat(img.style.top) + dy) + 'px';
      }
      origin = [nox, noy];
    }

    const want = new Set();
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++){
        const wx = ((tx % span) + span) % span;      // the world wraps east–west
        const at = tx + ':' + ty;
        want.add(at);
        if (live.has(at)) continue;
        const img = document.createElement('img');
        /* before src, or the request goes out without the CORS mode and the
           picture cannot be baked afterwards */
        if (CORS[src]) img.crossOrigin = 'anonymous';
        img.src = tileURL(z, wx, ty);
        img.decoding = 'async';
        img.style.cssText = 'position:absolute;width:' + TILE + 'px;height:' + TILE +
          'px;left:' + (tx * TILE - origin[0]) + 'px;top:' + (ty * TILE - origin[1]) + 'px';
        img.onload = () => { placed++; tally(); };
        img.onerror = () => {
          img.style.visibility = 'hidden'; failed++; tally();
        };
        layer.appendChild(img);
        live.set(at, img);
      }
    for (const [at, img] of live)
      if (!want.has(at)){ img.remove(); live.delete(at); }
  }
  /* a whole sheet that fails is worth saying out loud: with Google it means
     the key was refused, which otherwise just looks like an empty map */
  function tally(){
    if (failed && !placed)
      note(src === 'google'
        ? 'google refused every tile — check the key and its billing'
        : 'tiles failed to load');
    else note(live.size + ' tiles' + (failed ? ', ' + failed + ' failed' : ''));
  }

  function clear(){
    for (const [, img] of live) img.remove();
    live.clear(); lastRange = ''; origin = [0, 0]; placed = 0; failed = 0;
  }

  /* ── search ── */
  async function find(q){
    if (!q || !q.trim()) return false;
    /* A frozen picture is the most expensive thing in the profile — an hour of
       positioning by hand, and the only copy of it once IndexedDB has it. This
       used to thaw on the way past, which deleted it without ever using the
       word, from a button that says Find. The button that means it is two
       along and says Thaw, so searching somewhere else refuses instead. */
    if (pic){ note('a picture is frozen — Thaw first to search somewhere else'); return false; }
    note('searching…');
    try {
      const r = await fetch(FIND + encodeURIComponent(q.trim()));
      if (!r.ok) throw new Error('search returned ' + r.status);
      const j = await r.json();
      if (!j.length){ note('nothing found'); return false; }
      lat = +j[0].lat; lon = +j[0].lon;
      thaw();                          // only reachable now with nothing frozen
      clear();
      setShown(true);
      note((j[0].display_name || q).slice(0, 46));
      save();
      return true;
    } catch (e){ note('search failed: ' + e.message); return false; }
  }

  const note = t => { const n = $('#mapnote'); if (n) n.textContent = t; };

  function paint(){
    if (!layer) return;
    layer.style.opacity = dim;
    /* A dark sheet is already the colour of the ground it sits on, so the
       old grey-it-down treatment would bury it: lift it instead, and let
       Fade decide how far back it sits. Light sources still get pulled
       toward the plate's own bone-on-black. */
    layer.style.filter =
      pic ? 'none'
      : src === 'dark' ? 'brightness(2.2) contrast(1.15)'
      : src === 'google' && gtype === 'satellite' ? 'saturate(0.7) brightness(0.8)'
      : 'grayscale(0.75) contrast(0.85) brightness(0.85)';
  }

  /* ── the frozen picture ────────────────────────────────────────────────
     Bake what is on screen into one image. The tiles are laid in mercator
     pixels off `origin`, so their own left/top give the sheet's extent and
     the world anchor falls straight out of the same mapping lay() uses. */
  async function freeze(){
    if (pic){ note('already frozen — Thaw to go back to tiles'); return; }
    if (!live.size){ note('nothing to freeze'); return; }
    if (!CORS[src]){ note(src + ' cannot be baked — switch to Dark or OSM'); return; }
    const ready = [...live.values()].filter(i => i.complete && i.naturalWidth);
    if (!ready.length){ note('tiles still loading'); return; }

    let minL = Infinity, minT = Infinity, maxR = -Infinity, maxB = -Infinity;
    for (const i of ready){
      const l = parseFloat(i.style.left), t = parseFloat(i.style.top);
      minL = Math.min(minL, l); minT = Math.min(minT, t);
      maxR = Math.max(maxR, l + TILE); maxB = Math.max(maxB, t + TILE);
    }
    const sw = maxR - minL, sh = maxB - minT;
    const f = Math.min(1, MAXBAKE / sw, MAXBAKE / sh);
    const cv = document.createElement('canvas');
    cv.width = Math.round(sw * f); cv.height = Math.round(sh * f);
    const g = cv.getContext('2d');
    for (const i of ready)
      g.drawImage(i, (parseFloat(i.style.left) - minL) * f,
                     (parseFloat(i.style.top) - minT) * f, TILE * f, TILE * f);

    let url;
    try { url = cv.toDataURL('image/png'); }
    catch (e){ note('could not bake: ' + e.name + ' — the tiles are tainted'); return; }

    /* where that rectangle sits on the plate, in the game's own world units */
    const m0 = merc(lat, lon, z), C = [(G.sheetW || G.W) / 2, G.H / 2];
    const cx = (origin[0] + minL + sw / 2 - m0[0]) * scale + C[0];
    const cy = (origin[1] + minT + sh / 2 - m0[1]) * scale + C[1];
    await adopt(url, {x: cx, y: cy, s0: scale / f, mult: 1, rot: 0});
    note('frozen · ' + cv.width + '×' + cv.height + ' · drag to place');
  }

  /* a picture from anywhere — a bake, a dropped file, or storage */
  function adopt(url, p){
    return new Promise(res => {
      const im = new Image();
      im.onload = () => {
        clear();                       // live tiles have no further job
        if (pic) pic.remove();
        pic = im; picURL = url;
        im.style.cssText = 'position:absolute;left:0;top:0;display:block';
        layer.appendChild(im);
        /* named field by field rather than merged, so nothing an older save
           happened to leave in the object can ride along into this one */
        place = {x: p.x, y: p.y, s0: p.s0, mult: p.mult == null ? 1 : p.mult,
                 rot: p.rot || 0, w: im.naturalWidth, h: im.naturalHeight};
        setPlacing(true);
        paint(); syncUI(); sync(); save();
        res(true);
      };
      im.onerror = () => { note('that image would not load'); res(false); };
      im.src = url;
    });
  }

  /* a dropped file has no geography, so it lands centred on the view at a
     size that covers most of the plate — somewhere to start dragging from */
  function take(file){
    if (!file || !/^image\//.test(file.type)){ note('drop an image file'); return; }
    const fr = new FileReader();
    fr.onload = async () => {
      const im = new Image();
      im.onload = async () => {
        const s0 = (G.sheetW || G.W ? (G.sheetW || G.W) * 0.8 : 2000) / im.naturalWidth;
        await adopt(fr.result, {x: G.cam[0], y: G.cam[1], s0, mult: 1, rot: 0});
        setShown(true);
        note(file.name.slice(0, 40) + ' · drag to place');
      };
      /* the file read fine and the browser still would not decode it — a
         screenshot in a format this build has no decoder for looks exactly
         like a drop that did nothing at all unless it says so */
      im.onerror = () => note('that image would not open');
      im.src = fr.result;
    };
    fr.onerror = () => note('could not read that file');
    fr.readAsDataURL(file);
  }

  function thaw(){
    if (!pic) return;
    pic.remove(); pic = null; picURL = ''; place = null;
    setPlacing(false);
    try { localStorage.removeItem(IMGKEY); } catch (e){}
    idbDel();
    lastRange = ''; paint(); syncUI(); save();
  }

  function setPlacing(v){
    placing = !!v && !!pic;
    document.body.classList.toggle('placing', placing);
    syncUI();
  }

  /* ── placing: drag to move, shift-drag to turn ──────────────────────────
     Registered in the capture phase so build mode never sees the pointer
     while you are laying the picture down — otherwise the same drag would
     also grab whatever shape happens to be under it. */
  function wirePlace(){
    addEventListener('pointerdown', e => {
      if (!placing || !pic || !place || e.button !== 0) return;
      if (e.target && /^(INPUT|TEXTAREA|BUTTON)$/.test(e.target.tagName)) return;
      e.stopPropagation();
      const p = toWorld(e);
      drag = e.shiftKey
        ? {mode: 'rot', a0: Math.atan2(p[1] - place.y, p[0] - place.x), r0: place.rot}
        : {mode: 'move', ox: p[0] - place.x, oy: p[1] - place.y};
    }, true);

    addEventListener('pointermove', e => {
      if (!drag || !place) return;
      e.stopPropagation();
      const p = toWorld(e);
      if (drag.mode === 'move'){ place.x = p[0] - drag.ox; place.y = p[1] - drag.oy; }
      else {
        /* free by default — a photograph rarely lines up on a neat angle —
           with ctrl held for the 15° steps a district wants */
        let r = drag.r0 + (Math.atan2(p[1] - place.y, p[0] - place.x) - drag.a0);
        if (e.ctrlKey){ const st = Math.PI / 12; r = Math.round(r / st) * st; }
        place.rot = r;
        setRotUI();
      }
      sync();
    }, true);

    addEventListener('pointerup', e => {
      if (!drag) return;
      e.stopPropagation();
      drag = null; save();
    }, true);

    /* drop a screenshot straight onto the window */
    addEventListener('dragover', e => { e.preventDefault(); });
    addEventListener('drop', e => {
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f || held) return;
      e.preventDefault();
      setBar(true);
      take(f);
    });
  }

  /* the bar and the overlay are separate: you can leave a place loaded and
     flick the imagery off to see the plate on its own, then flick it back */
  function setBar(v){
    barOpen = v;
    const bar = $('#mapbar');
    if (bar) bar.hidden = !v;
    /* the bar stands where other chrome does, so the page has to know it is
       open to get out of its way */
    document.body.classList.toggle('mapping', barOpen);
    syncUI();
  }
  function setShown(v){
    shown = v;
    if (layer) layer.style.display = showing() ? 'block' : 'none';
    if (R) R.clearA = showing() ? 0 : 1;      // the plate clears through while tracing
    if (showing()){ paint(); sync(); } else if (!pic) clear();
    if (!v) setPlacing(false);
    save(); syncUI();
  }
  function setSrc(v){
    if (src === v) return;
    /* Same trap as find(): the source only decides what the live tiles look
       like, and a frozen picture covers them anyway — so changing it was
       never worth the picture it silently took. syncUI() puts the selected
       button back, because the click already moved it. */
    if (pic){ note('a picture is frozen — Thaw first to change the source'); syncUI(); return; }
    src = v;
    thaw();                            // only reachable now with nothing frozen
    clear(); paint(); sync(); save(); syncUI();
  }

  const setRotUI = () => {
    const r = $('#maprot'), v = $('#maprotv');
    if (!place) return;
    let d = place.rot * 180 / Math.PI;
    d = ((d + 180) % 360 + 360) % 360 - 180;         // keep the slider in range
    if (r) r.value = d.toFixed(1);
    if (v) v.textContent = d.toFixed(1) + '°';
  };

  function syncUI(){
    const b = $('#mapshow');
    if (b){ b.textContent = shown ? 'Hide' : 'Show'; b.classList.toggle('sel', shown); }
    for (const [id, s] of [['#mapsrcdark', 'dark'], ['#mapsrcosm', 'osm'], ['#mapsrcg', 'google']]){
      const el = $(id);
      if (el){ el.classList.toggle('sel', src === s); el.hidden = !!pic; }
    }
    const k = $('#mapkey');
    if (k) k.hidden = src !== 'google' || !!pic;
    const c = $('#mapcred');
    if (c) c.textContent = pic ? 'frozen picture'
                         : src === 'google' ? '© Google'
                         : src === 'dark' ? '© OpenStreetMap · © CARTO'
                         : '© OpenStreetMap';
    /* freezing is a live-tile act; placing and turning belong to a picture */
    const fz = $('#mapfreeze'), pl = $('#mapplace'), rw = $('#maprotwrap'), zw = $('#mapzwrap');
    if (fz){ fz.textContent = pic ? 'Thaw' : 'Freeze'; fz.classList.toggle('sel', !!pic); }
    if (pl){ pl.hidden = !pic; pl.classList.toggle('sel', placing); }
    if (rw) rw.hidden = !pic;
    if (zw) zw.hidden = !!pic;
    setRotUI();
    const sv = $('#mapscalev');
    if (sv) sv.textContent = (pic && place ? place.mult : scale).toFixed(2) + '×';
  }

  function ui(){
    layer = $('#basemap');
    if (!$('#mapbar') || !layer) return;
    $('#mapgo').onclick = () => find($('#mapq').value);
    $('#mapq').addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') find($('#mapq').value);
    });
    $('#mapkey').addEventListener('keydown', e => e.stopPropagation());
    $('#mapkey').oninput = e => {
      gkey = e.target.value.trim();
      clear(); sync(); save();
    };
    $('#mapshow').onclick = () => setShown(!shown);
    $('#mapsrcdark').onclick = () => setSrc('dark');
    $('#mapsrcosm').onclick = () => setSrc('osm');
    $('#mapsrcg').onclick = () => setSrc('google');
    $('#mapfreeze').onclick = () => { pic ? thaw() : freeze(); };
    $('#mapplace').onclick = () => setPlacing(!placing);
    $('#mapdim').oninput = e => { dim = +e.target.value / 100; paint(); save(); };
    $('#mapscale').oninput = e => {
      const v = +e.target.value / 100;
      if (pic && place) place.mult = v; else scale = v;
      lastRange = ''; sync(); save();
      $('#mapscalev').textContent = v.toFixed(2) + '×';
    };
    $('#maprot').oninput = e => {
      if (!place) return;
      place.rot = +e.target.value * Math.PI / 180;
      $('#maprotv').textContent = (+e.target.value).toFixed(1) + '°';
      sync(); save();
    };
    $('#mapzo').onclick = () => step(-1);
    $('#mapzi').onclick = () => step(1);
    $('#mapoff').onclick = () => setBar(false);
    $('#mapdim').value = Math.round(dim * 100);
    $('#mapscale').value = Math.round(scale * 100);
    $('#mapscalev').textContent = scale.toFixed(2) + '×';
    $('#mapzv').textContent = z;
    $('#mapkey').value = gkey;
    syncUI();
  }
  /* a zoom step halves the pixels per metre, so hold the ground still by
     doubling how much world each mercator pixel is worth */
  function step(d){
    const nz = Math.max(3, Math.min(19, z + d));
    if (nz === z) return;
    scale *= Math.pow(2, z - nz);
    z = nz;
    $('#mapzv').textContent = z;
    $('#mapscale').value = Math.round(Math.max(25, Math.min(400, scale * 100)));
    $('#mapscalev').textContent = scale.toFixed(2) + '×';
    clear(); sync(); save();
  }

  /* ── storing the picture ────────────────────────────────────────────────
     IndexedDB first, because a baked sheet is far bigger than anything else
     this game keeps and localStorage is a few megabytes for everything. A
     file:// page is an opaque origin, though, and Chrome may refuse it
     outright — so the same data URL goes to localStorage when it does, and
     the picture survives either way. */
  const DBN = 'hq.basemap', STORE = 'pic';
  function idb(){
    return new Promise((res, rej) => {
      let r;
      try { r = indexedDB.open(DBN, 1); } catch (e){ return rej(e); }
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE);
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error || new Error('indexeddb refused'));
    });
  }
  async function idbPut(v){
    const d = await idb();
    return new Promise((res, rej) => {
      const t = d.transaction(STORE, 'readwrite');
      t.objectStore(STORE).put(v, 'img');
      t.oncomplete = () => res(true); t.onerror = () => rej(t.error);
    });
  }
  async function idbGet(){
    const d = await idb();
    return new Promise((res, rej) => {
      const t = d.transaction(STORE, 'readonly');
      const q = t.objectStore(STORE).get('img');
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
    });
  }
  function idbDel(){
    idb().then(d => {
      const t = d.transaction(STORE, 'readwrite');
      t.objectStore(STORE).delete('img');
    }).catch(() => {});
  }
  async function stash(url){
    try { await idbPut(url); try { localStorage.removeItem(IMGKEY); } catch (e){} return; }
    catch (e){}
    try { localStorage.setItem(IMGKEY, url); }
    catch (e){ note('picture too large to keep — it will not survive a reload'); }
  }
  async function fetchStashed(){
    try { const v = await idbGet(); if (v) return v; } catch (e){}
    try { return localStorage.getItem(IMGKEY) || ''; } catch (e){ return ''; }
  }

  function save(){
    try { localStorage.setItem(KEY, JSON.stringify({shown, lat, lon, z, dim, scale,
      src, gkey, gtype, place, placing}));
      if (typeof hqStoreOK === 'function') hqStoreOK('the map settings'); }
    /* this try holds the settings blob, not the picture — stash() reports on
       the picture itself, and naming it here sent you to free the very thing
       that had not failed */
    catch (e){ if (typeof hqStoreFail === 'function') hqStoreFail('the map settings', e); }
    /* the picture itself only goes back to storage when it has actually
       changed — every drag calls save(), and a bake is megabytes */
    if (picURL !== save._done){ save._done = picURL; if (picURL) stash(picURL); }
  }
  function load(){
    try {
      const j = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!j) return null;
      lat = j.lat; lon = j.lon; z = j.z; dim = j.dim; scale = j.scale;
      shown = !!j.shown; src = j.src || 'dark'; gkey = j.gkey || ''; gtype = j.gtype || 'roadmap';
      return j.place ? {p: j.place, placing: !!j.placing} : null;
    } catch (e){ return null; }
  }

  /* init is async now — it may have a picture to fetch back out of storage —
     so nothing inside it may reject onto the page's error handler */
  async function init(){
    try {
      const st = load();
      waiting = !!st;
      ui();
      wirePlace();
      if (st){
        const url = await fetchStashed();
        /* adopt() re-measures the picture, so a stored w/h is never trusted */
        if (url){ save._done = url; await adopt(url, st.p); setPlacing(st.placing); }
      }
      waiting = false;
      setShown(shown && !!(lat || lon || pic));
      setBar(false);
    } catch (e){ waiting = false; note('underlay failed to start: ' + e.message); }
  }

  addEventListener('keydown', e => {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (held) return;                 // nothing to trace against inside a building
    if (e.code === 'KeyM' && !e.ctrlKey && !e.metaKey){
      setBar(!barOpen);
      if (barOpen) $('#mapq').focus();
    }
  });

  return {init, sync, find, setShown, setSrc, freeze, thaw, take, suspend,
          active: () => shown, bar: () => barOpen, placing: () => placing,
          at: () => [lat, lon, z], source: () => src, hasKey: () => !!gkey};
})();
