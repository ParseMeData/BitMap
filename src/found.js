'use strict';
/* ── founding a plate ─────────────────────────────────────────────────────
   A plate is a place, and it is founded on an address. Since 2026-08-28
   (Eden) no plate opens without one: at the end of a road, saying yes to
   the next plate asks for the address first; a home plate with nothing
   on it asks at boot. The address is looked up (src/basemap.js `find`),
   the map is frozen there — that picture is the plate's boundary, and
   its point is the plate's anchor on the region (`Atlas.setGeo`) — and
   the FIRST PALACE goes down on it, at the address, named for it, free.
   So every plate begins as one memory palace standing where its address
   is, with the town around it to trace.

   The dialog is the same panel as the edge prompt and holds the keys
   until answered; on the home plate it can be put off (Later), because
   a town may be about to be imported instead; at a road end it cannot,
   because the plate does not exist until the address does.            */

const Found = (() => {
  /* the address a home plate with nothing on it is founded on, unasked
     (Eden, 2026-08-28: "use this address as the default for now") */
  const DEFAULT = '929 Myrtleford-Yackandandah Road, Barwidgee VIC 3737';
  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };
  let el = null, pending = null, busy = false;

  function panel(){
    if (el) return el;
    el = document.createElement('div');
    el.id = 'found'; el.className = 'glass'; el.hidden = true;
    el.innerHTML = '<div class="plabel">A new plate needs a place</div>' +
      '<div id="foundwhy"></div>' +
      '<input id="foundq" type="text" placeholder="an address, or a town" spellcheck="false" autocomplete="off">' +
      '<div class="erow"><button class="btn" id="foundgo">Found it here</button>' +
      '<button class="btn" id="foundno">Later</button></div>' +
      '<div class="knote" id="foundnote">the map is frozen at the address and the first palace stands on it</div>';
    document.body.appendChild(el);
    const q = el.querySelector('#foundq');
    q.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter'){ e.preventDefault(); go(); }
      else if (e.key === 'Escape'){ e.preventDefault(); later(); }
    });
    el.querySelector('#foundgo').onclick = go;
    el.querySelector('#foundno').onclick = later;
    return el;
  }

  /* ── asking ─────────────────────────────────────────────────────────────
     `what` is {dir, at} for a road end — the plate is made only once the
     address is found — or null for the plate you are standing on. */
  function ask(what, why){
    pending = what || null;
    const p = panel();
    p.querySelector('#foundwhy').textContent = why || '';
    p.querySelector('#foundno').hidden = !!pending ? false : false;
    p.querySelector('#foundno').textContent = pending ? 'Stay' : 'Later';
    p.querySelector('#foundq').value = DEFAULT;
    p.hidden = false;
    document.body.classList.add('founding');
    setTimeout(() => p.querySelector('#foundq').focus(), 50);
    return true;
  }
  function later(){
    if (busy) return;
    const was = pending; pending = null;
    if (el) el.hidden = true;
    document.body.classList.remove('founding');
    note(was ? 'the road still ends here' : 'a plate with no place — press M to give it one');
  }
  const open = () => !!el && !el.hidden;

  /* ── founding ────────────────────────────────────────────────────────────
     Look the address up; if it is somewhere, open the plate (a road end)
     or stay (home); freeze the map there; anchor the plate; plant the
     palace. Each step says what it is doing in the note line. */
  async function go(address){
    if (busy) return;
    const quiet = typeof address === 'string';        // founded unasked: no dialog to write into
    if (!quiet) panel();
    const q = quiet ? address.trim() : el.querySelector('#foundq').value.trim();
    if (!q){ if (!quiet) el.querySelector('#foundnote').textContent = 'type an address first'; return; }
    busy = true;
    const say = t => { if (quiet) note(t); else el.querySelector('#foundnote').textContent = t; };
    try {
      say('looking for ' + q + '…');
      if (pending){
        /* the plate is made now, and the search lands on it */
        const p = pending; pending = null;
        if (!Atlas.add(p.dir, p.at)) throw new Error('could not open the plate');
      }
      const ok = await Basemap.find(q);
      if (!ok) throw new Error('nowhere by that name');
      /* the whole plate in view, centred, before the picture is baked: the
         tiles are laid for the view, so this is what makes the frozen map
         cover the plate edge to edge and the survey have all of it */
      say('framing the plate…');
      G.camT[0] = G.W / 2; G.camT[1] = G.H / 2; G.camT[2] = G.fitAll;
      await new Promise(r => setTimeout(r, 1400));
      say('waiting for the map…');
      await Basemap.ready(20000);
      say('freezing the map…');
      await Basemap.freeze();
      const [lat, lon] = Basemap.at();
      if (lat || lon) Atlas.setGeo(Atlas.current(), lat, lon);
      /* the ground, surveyed: the roads from the door, the water, the
         grass and the rim — and the map turned square to the door's road
         (src/survey.js). A survey that fails leaves the plate frozen and
         empty, which is still a founded plate. */
      let at = null;
      try { const sv = await Survey.run(lat, lon, say); at = sv.at; }
      catch (e){ say('no survey — ' + (e.message || e)); await new Promise(r => setTimeout(r, 1200)); }
      /* a house at the address — one of the sheet's, drawn by lot — with
         the palace's marker standing on it */
      if (at && typeof Glyphs !== 'undefined'){
        try {
          const kinds = Glyphs.of('houses') || [];
          if (kinds.length){
            const pick = kinds[(Math.random() * kinds.length) | 0];
            Build.add({kind: 'house', type: 'rect', x: at[0], y: at[1], variant: pick, exact: true});
            Build.commit();
            if (typeof restampTerrain === 'function') restampTerrain();
          }
        } catch (e){ note('no house — ' + (e.message || e)); }
      }
      /* the first palace, at the address, named for it, and free */
      const parts = q.split(',').map(x => x.trim()).filter(Boolean);
      const name = parts[0].slice(0, 28);
      /* the town is the locality — the part after the street, with the
         state and the postcode taken off — or the whole address when
         there is only the one part */
      const town = (parts[1] || '').replace(/\b(VIC|NSW|QLD|SA|WA|TAS|NT|ACT)\b|\d+/g, '').trim().slice(0, 28) || name;
      const C = at || [(G.sheetW || G.W) / 2, G.H / 2];
      const mk = Markers.plant(C[0], C[1], name);
      if (mk && typeof Atlas.rename === 'function' && Atlas.current() !== 'home') Atlas.rename(town);
      if (Atlas.current() === 'home' && !(Store.get('hq.town') || '').trim()) Palace.rename(town);
      Basemap.setBar(false);
      /* and back to the distance the town is worked at, on the door */
      if (at){ G.camT[0] = at[0]; G.camT[1] = at[1]; }
      G.camT[2] = typeof home === 'function' ? home() : G.fitW;
      if (el) el.hidden = true;
      document.body.classList.remove('founding');
      note(name + ' founded — the palace at the address is the first');
    } catch (e){
      say(String(e.message || e));
      /* founded unasked and it failed: ask, with the address in the field */
      if (quiet){ busy = false; ask(null, 'the default address could not be founded — ' + (e.message || e)); return; }
    }
    busy = false;
  }

  /* the home plate with nothing on it asks at boot */
  function check(){
    if (typeof Atlas === 'undefined' || Atlas.current() !== 'home') return false;
    if (G.markers.length || G.shapes.length) return false;
    const [lat, lon] = Basemap.at();
    if (lat || lon) return false;
    /* unasked: the default address, and the notes say how it is going */
    note('founding on ' + DEFAULT + '…');
    go(DEFAULT);
    return true;
  }

  return {ask, later, check, open, go, DEFAULT};
})();
