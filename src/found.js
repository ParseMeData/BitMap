'use strict';
/* ── founding a plate ─────────────────────────────────────────────────────
   A plate is a place, and it is founded on an address. Since 2026-08-28
   (Eden) no plate opens without one, and the founding goes in steps you
   can see and stop:

     1. the ADDRESS — asked for at the end of a road (the plate is made
        only once the address is found), or the default one, unasked, on
        a home plate with nothing on it;
     2. the FRAME — the map is shown live under a frame that is the plate's
        edge, with the boundary's oval inside it: drag the map under the
        frame, Zoom − + for more or less ground, until the town sits where
        you want it printed;
     3. PRINT — the map inside the frame is baked into the plate's picture
        (toned to the plate's own black);
     4. CONFIRM — Generate, or Back to the frame;
     5. the GROUND — the survey (src/survey.js): the roads from the door,
        the water, the grass and the rim; the map turned square to the
        door's road; a house from the sheet beside the road at the address,
        and the FIRST PALACE on it, named for the address, free.

   Nothing is generated before the confirm. The picture is left pinned to
   nothing when it is done — Pin is a tool, and a plate handed over with
   its picture still in hand ate every touch on the phone.               */

const Found = (() => {
  /* the address a home plate with nothing on it is founded on, unasked */
  const DEFAULT = '929 Myrtleford-Yackandandah Road, Barwidgee VIC 3737';
  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };
  let el = null, frame = null, pending = null, busy = false, state = null, q = '', drag = null, raf = 0;
  const SHOW_FRAME = false;

  /* ── the panel, one face per state ──────────────────────────────────── */
  function panel(){
    if (el) return el;
    el = document.createElement('div');
    el.id = 'found'; el.className = 'glass'; el.hidden = true;
    document.body.appendChild(el);
    return el;
  }
  function face(html){
    panel().innerHTML = html;
    el.hidden = false;
    document.body.classList.add('founding');
  }
  const say = t => { const n = el && el.querySelector('#foundnote'); if (n) n.textContent = t; else note(t); };

  function askFace(why){
    face('<div class="plabel">A new plate needs a place</div>' +
      '<div id="foundwhy">' + (why || '') + '</div>' +
      '<input id="foundq" type="text" placeholder="an address, or a town" spellcheck="false" autocomplete="off">' +
      '<div class="erow"><button class="btn" id="foundgo">Find it</button>' +
      '<button class="btn" id="foundno">' + (pending ? 'Stay' : 'Later') + '</button></div>' +
      '<div class="knote" id="foundnote">the map is shown under a frame first; nothing is printed until you say</div>');
    const inp = el.querySelector('#foundq');
    inp.value = q || DEFAULT;
    inp.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter'){ e.preventDefault(); find(); }
      else if (e.key === 'Escape'){ e.preventDefault(); later(); }
    });
    el.querySelector('#foundgo').onclick = find;
    el.querySelector('#foundno').onclick = later;
    setTimeout(() => inp.focus(), 50);
  }
  function frameFace(){
    face('<div class="plabel">Frame the plate</div>' +
      '<div id="foundwhy">' + q + '</div>' +
      '<div class="erow"><button class="btn" id="foundzo">Zoom &minus;</button><button class="btn" id="foundzi">Zoom +</button></div>' +
      '<div class="erow"><button class="btn" id="foundtl" title="turn left 5&deg;">&#9664; Turn</button><button class="btn" id="foundtr" title="turn right 5&deg;">Turn &#9654;</button></div>' +
      '<div class="erow"><button class="btn" id="foundprint">Print</button>' +
      '<button class="btn" id="foundno">' + (Atlas.current() === 'home' && !pendingMade ? 'Later' : 'Back') + '</button></div>' +
      '<div class="knote" id="foundnote">drag the map under the frame · the oval is the boundary · print when it sits right</div>');
    el.querySelector('#foundzo').onclick = () => Basemap.step(-1);
    el.querySelector('#foundzi').onclick = () => Basemap.step(1);
    /* turned by hand, the map is printed as turned and the survey does
       not square it to the door's road */
    el.querySelector('#foundtl').onclick = () => { Basemap.turnLive(-5); turnedByHand = true; };
    el.querySelector('#foundtr').onclick = () => { Basemap.turnLive(5); turnedByHand = true; };
    el.querySelector('#foundprint').onclick = print;
    el.querySelector('#foundno').onclick = () => { if (Atlas.current() === 'home' && !pendingMade) later(); else askFace(''); };
  }
  /* the house the first palace stands on: one of the sheet's, chosen
     here, before anything is drawn (Eden, 2026-08-29) */
  let houseAt = 0;
  const houses = () => (typeof Glyphs !== 'undefined' && Glyphs.of('houses')) || [];
  function housePick(d){
    const list = houses(); if (!list.length) return null;
    houseAt = ((houseAt + (d || 0)) % list.length + list.length) % list.length;
    const cv = el && el.querySelector('#foundhouse');
    if (cv){
      const rows = Glyphs.rows(list[houseAt]) || [];
      const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
      const n = Math.max(rows.length, rows[0] ? rows[0].length : 1), s = Math.floor(cv.width / (n + 2));
      const ox = (cv.width - (rows[0] ? rows[0].length : 0) * s) / 2, oy = (cv.height - rows.length * s) / 2;
      rows.forEach((r, j) => { for (let i = 0; i < r.length; i++){
        if (r[i] === '0') continue;
        g.fillStyle = r[i] === '2' ? '#1B1B21' : '#EDEAE3';
        g.beginPath(); g.moveTo(ox + i * s + s / 2, oy + j * s); g.lineTo(ox + i * s + s, oy + j * s + s / 2);
        g.lineTo(ox + i * s + s / 2, oy + j * s + s); g.lineTo(ox + i * s, oy + j * s + s / 2); g.fill(); } });
      const lab = el.querySelector('#foundhousen'); if (lab) lab.textContent = list[houseAt] + ' · ' + (houseAt + 1) + ' of ' + list.length;
    }
    return list[houseAt];
  }
  function confirmFace(){
    face('<div class="plabel">Printed</div>' +
      '<div id="foundwhy">generate the roads, the water, the ground and the first palace here?</div>' +
      '<div class="erow"><button class="btn" id="foundhl">&#9664;</button><canvas id="foundhouse" width="96" height="96"></canvas><button class="btn" id="foundhr">&#9654;</button></div>' +
      '<div class="knote" id="foundhousen"></div>' +
      '<div class="erow"><button class="btn" id="foundgen">Generate</button>' +
      '<button class="btn" id="foundback">Back to the frame</button></div>' +
      '<div class="knote" id="foundnote">the house the first palace stands on &middot; nothing is drawn until you say</div>');
    el.querySelector('#foundgen').onclick = generate;
    el.querySelector('#foundback').onclick = back;
    el.querySelector('#foundhl').onclick = () => housePick(-1);
    el.querySelector('#foundhr').onclick = () => housePick(1);
    housePick(0);
  }

  /* ── the frame: the plate's edge and the boundary's oval, on screen ── */
  function frameEl(){
    if (frame) return frame;
    frame = document.createElement('div');
    frame.id = 'frame'; frame.hidden = true;
    frame.innerHTML = '<i></i>';
    document.body.appendChild(frame);
    return frame;
  }
  function tick(){
    raf = requestAnimationFrame(tick);
    /* the frame is not drawn while the map is being placed (Eden,
       2026-08-28: it looked odd) — the screen at fit-all is the plate, and
       the dialog says what to do; the code stays for a frame that is */
    if (!SHOW_FRAME || state !== 'framing' || !G.terr){ frameEl().hidden = true; return; }
    /* the whole plate in view, always: the camera is held out at fit-all
       while the frame is up, and the plate then sits centred */
    G.camT[2] = G.fitAll;
    const b = canvas.getBoundingClientRect(), dpr = VW / (b.width || 1), z = G.cam[2] / dpr;
    const sx = wx => b.left + (wx - G.cam[0]) * z + b.width / 2, sy = wy => b.top + (wy - G.cam[1]) * z + b.height / 2;
    const f = frameEl(); f.hidden = false;
    f.style.left = sx(0) + 'px'; f.style.top = sy(0) + 'px';
    f.style.width = (sx(G.W) - sx(0)) + 'px'; f.style.height = (sy(G.H) - sy(0)) + 'px';
    const i = f.firstChild;
    /* the boundary as the survey will lay it (src/survey.js boundary) */
    const B = typeof Survey !== 'undefined' ? Survey.boundary() : {x: G.W / 2, y: G.H / 2, w: G.W, h: G.H};
    i.style.width = (sx(B.w) - sx(0)) + 'px'; i.style.height = (sy(B.h) - sy(0)) + 'px';
    i.style.left = (sx(B.x) - sx(0) - (sx(B.w) - sx(0)) / 2) + 'px'; i.style.top = (sy(B.y) - sy(0) - (sy(B.h) - sy(0)) / 2) + 'px';
    i.style.transform = 'none';
  }
  /* drag the map under the frame */
  function wireDrag(){
    addEventListener('pointerdown', e => {
      if (state !== 'framing' || e.target !== canvas || e.button !== 0) return;
      drag = {x: e.clientX, y: e.clientY, moved: false};
    }, true);
    addEventListener('pointermove', e => {
      if (!drag || state !== 'framing') return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 3) return;
      drag.moved = true; drag.x = e.clientX; drag.y = e.clientY;
      const b = canvas.getBoundingClientRect(), dpr = VW / (b.width || 1), z = G.cam[2] / dpr;
      Basemap.nudge(dx / z, dy / z);
      e.stopPropagation();
    }, true);
    const up = () => { drag = null; };
    addEventListener('pointerup', up, true);
    addEventListener('pointercancel', up, true);
  }

  /* ── the steps ─────────────────────────────────────────────────────── */
  let pendingMade = false, turnedByHand = false;
  function ask(what, why){
    pending = what || null; pendingMade = false; turnedByHand = false; q = '';
    state = 'ask';
    askFace(why);
    return true;
  }
  async function find(){
    if (busy) return;
    const v = (el.querySelector('#foundq') || {}).value || q;
    q = String(v).trim();
    if (!q){ say('type an address first'); return; }
    busy = true;
    try {
      say('looking for ' + q + '…');
      if (pending && !pendingMade){
        const p = pending;
        if (!Atlas.add(p.dir, p.at)) throw new Error('could not open the plate');
        pendingMade = true;
      }
      const ok = await Basemap.find(q);
      if (!ok) throw new Error('nowhere by that name');
      Basemap.setBar(false);
      state = 'framing';
      frameFace();
      say('waiting for the map…');
      Basemap.ready(20000).then(() => { if (state === 'framing') say('drag the map under the frame · print when it sits right'); });
    } catch (e){ say(String(e.message || e)); }
    busy = false;
  }
  async function print(){
    if (busy || state !== 'framing') return;
    busy = true;
    try {
      say('waiting for the map…');
      await Basemap.ready(15000);
      say('printing…');
      await Basemap.freeze();
      /* freeze says what went wrong in the map's own note line and does
         not throw; a plate is not printed until there is a picture */
      if (!Basemap.placed()) throw new Error('not printed — ' + ((document.getElementById('mapnote') || {}).textContent || 'the map would not bake'));
      Basemap.setPlacing(false);
      state = 'confirm';
      confirmFace();
    } catch (e){ say(String(e.message || e)); }
    busy = false;
  }
  function back(){
    if (busy) return;
    Basemap.thaw();
    state = 'framing';
    frameFace();
  }
  async function generate(){
    if (busy || state !== 'confirm') return;
    busy = true;
    try {
      const [lat, lon] = Basemap.at();
      if (lat || lon) Atlas.setGeo(Atlas.current(), lat, lon);
      let at = null;
      try { const sv = await Survey.run(lat, lon, say, {square: !turnedByHand}); at = sv.at; }
      catch (e){ say('no survey — ' + (e.message || e)); await new Promise(r => setTimeout(r, 1200)); }
      /* the house, beside the road on the address's side, and the palace on it */
      let houseW = 0;
      if (at && typeof Glyphs !== 'undefined'){
        try {
          const kinds = Glyphs.of('houses') || [];
          if (kinds.length){
            const pick = kinds[houseAt % kinds.length];
            const rows = Glyphs.rows(pick); houseW = rows && rows[0] ? rows[0].length * G.A.cell : 0;
            at = Survey.aside(at, houseW);
            /* the ground under the building taken right out — no terrain
               behind the shape, only the plate — with a dithered edge a
               little past its footprint (Eden, 2026-08-29).

               A WARP seeded on its four corners since 2026-08-30, exactly
               as `clearUnder` lays the clearing under any print: it looks
               like the rectangle it always was, and it can be pulled out
               of square afterwards, corner by corner, with the cut
               following the outline instead of the box. The five numbers
               are unchanged, so the rim is the same soft sketchy one. */
            const cw = houseW * 1.5;
            const dem = Build.add({kind: 'demolish', type: 'warp', x: at[0], y: at[1], w: cw, h: cw,
                                   fall: 0, out: 1, feather: 3, scatter: 0.7, jitter: 0.4, exact: true});
            /* seeded from the size `Build.add` actually settled on, not the
               one asked for — it snaps — so the four corners sit exactly on
               the edges the shape reports. Same order as `clearUnder`. */
            if (dem){ dem.blob = Build.rectBlob(dem.w, dem.h); dem.blobSeed = 'box'; }
            Build.add({kind: 'house', type: 'rect', x: at[0], y: at[1], variant: pick, exact: true});
            Build.commit();
            if (typeof restampTerrain === 'function') restampTerrain();
          }
        } catch (e){ note('no house — ' + (e.message || e)); }
      }
      /* the town's name (no patch behind it since 2026-08-28: the title's
         own mat — a feathered dimming of the ground under the name — is
         what keeps it readable, and a demolish read as a hole) */
      try {
        const parts0 = q.split(',').map(x => x.trim()).filter(Boolean);
        const town0 = (parts0[1] || '').replace(/\b(VIC|NSW|QLD|SA|WA|TAS|NT|ACT)\b|\d+/g, '').trim().slice(0, 28) || parts0[0].slice(0, 28);
        if (Atlas.current() === 'home' && !(Store.get('hq.town') || '').trim()) Palace.rename(town0);
      } catch (e){}
      const parts = q.split(',').map(x => x.trim()).filter(Boolean);
      const name = parts[0].slice(0, 28);
      const town = (parts[1] || '').replace(/\b(VIC|NSW|QLD|SA|WA|TAS|NT|ACT)\b|\d+/g, '').trim().slice(0, 28) || name;
      const C = at || [G.W / 2, G.H / 2];
      const mk = Markers.plant(C[0], C[1], name);
      if (mk && Atlas.current() !== 'home') Atlas.rename(town);
      if (Atlas.current() === 'home' && !(Store.get('hq.town') || '').trim()) Palace.rename(town);
      Basemap.setPlacing(false);
      Basemap.setBar(false);
      if (at){ G.camT[0] = at[0]; G.camT[1] = at[1]; }
      G.camT[2] = typeof home === 'function' ? home() : G.fitW;
      state = null;
      if (el) el.hidden = true;
      document.body.classList.remove('founding');
      note(name + ' founded — the palace at the address is the first');
    } catch (e){ say(String(e.message || e)); }
    busy = false;
  }
  function later(){
    if (busy) return;
    const was = pending; pending = null; state = null;
    if (el) el.hidden = true;
    document.body.classList.remove('founding');
    note(was && !pendingMade ? 'the road still ends here' : 'a plate with no place — press M to give it one');
  }
  const open = () => !!el && !el.hidden;

  /* the home plate with nothing on it: the default address, unasked, and
     then the frame — printing waits for you */
  function check(){
    if (typeof Atlas === 'undefined' || Atlas.current() !== 'home') return false;
    /* a backdrop does not count as a town: it is chrome the plate lays for
       itself, and a plate that has only that is still an empty plate
       (2026-08-30 — otherwise an auto-laid mat stops the founding dead) */
    if (G.markers.length || G.shapes.some(s => s.kind !== 'mat')) return false;
    /* a picture on the plate is a plate that was printed: founded, or
       traced by hand before founding existed — either way not this */
    if (Basemap.placed()) return false;
    const [lat, lon] = Basemap.at();
    pending = null; pendingMade = false; turnedByHand = false; q = DEFAULT;
    panel();
    /* ── the frame comes back where it was left ─────────────────────────
       The search writes the place it found before anything is printed, so
       a window closed at the frame — the very first thing a new profile
       shows — used to boot to the live tiles, the compass and no panel:
       the check above read the saved place as "founded" and stood down,
       and the only way on was M and the map bar's own Freeze (found
       2026-09-05, on a profile that had just been wiped). An empty home
       plate with a place but no picture is a frame that was never
       printed, so it is put back up at that place, as dragged and zoomed,
       without searching again. */
    if (lat || lon){
      state = 'framing';
      Basemap.setBar(false);
      frameFace();
      say('waiting for the map…');
      Basemap.ready(20000).then(() => { if (state === 'framing') say('drag the map under the frame · print when it sits right'); });
      return true;
    }
    state = 'ask';
    find();
    return true;
  }
  function init(){ wireDrag(); if (!raf) tick(); }

  return {init, ask, later, check, open, find, print, generate, back, DEFAULT, state: () => state};
})();
