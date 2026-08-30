'use strict';
/* ── the town, out and back, in the page ────────────────────────────────
   `tools/snapshot.py` is the town out to a file and back in again, driven
   over CDP from a terminal. On the web there is no terminal beside the
   page, so this is the same thing done from inside it: Export writes the
   file the tool writes — version 3, every `hq.` key minus the two
   diagnostics, the Google Maps key blanked out of every plate's underlay,
   the picture rows, the locus rows — and Import makes the profile become
   such a file, which is what the tool's restore does: keys the file does
   not have are removed, both stores are cleared and refilled, and the page
   reloads. Import asks first, with the counts, because a restore is
   destructive and the tool would have asked too. The two must stay the
   same shape: a file from either side reads back on the other.        */

const Snap = (() => {
  const SKIP = {'hq.lastError': 1, 'hq.loads': 1};
  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };

  /* the signed-in user's keys, bare, through the store — which is what
     puts the user's prefix on and takes it off (src/store.js) */
  const keys = () => Store.keys('hq.').sort();
  const DBN = n => (typeof HQ_DB === 'function' ? HQ_DB(n) : n);
  const isBasemapKey = k => k === 'hq.basemap' || (k.indexOf('hq.basemap.') === 0 && k.indexOf('hq.basemap.img') !== 0);

  /* both stores, opened the way their owners open them: version 1, and
     the upgrade that makes the store, so a fresh profile is never left
     with an empty database nothing can add a store to (HANDOFF) */
  const openDb = (name, store) => new Promise((res, rej) => {
    let r; try { r = indexedDB.open(name, 1); } catch (e){ return rej(e); }
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(store)) r.result.createObjectStore(store); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error || new Error('refused'));
  });
  const readAll = (name, store) => openDb(name, store).then(d => new Promise((res, rej) => {
    if (!d.objectStoreNames.contains(store)) return res({});
    const t = d.transaction(store, 'readonly'), out = {}, q = t.objectStore(store).openCursor();
    q.onsuccess = () => { const c = q.result; if (!c){ res(out); return; } out[c.key] = c.value; c.continue(); };
    q.onerror = () => rej(q.error);
  })).catch(() => ({}));
  const writeAll = (name, store, rows) => openDb(name, store).then(d => new Promise((res, rej) => {
    const t = d.transaction(store, 'readwrite'), s = t.objectStore(store);
    s.clear();
    for (const k in rows) if (rows[k] != null) s.put(rows[k], k);
    t.oncomplete = () => res(true); t.onerror = () => rej(t.error);
  }));

  /* ── out ── */
  async function dump(){
    const state = {};
    for (const k of keys()){
      if (SKIP[k]) continue;
      let v = Store.get(k);
      if (isBasemapKey(k) && v){
        try { const bm = JSON.parse(v); if (bm && typeof bm === 'object' && bm.gkey){ bm.gkey = ''; v = JSON.stringify(bm); } }
        catch (e){}
      }
      state[k] = v;
    }
    const pics = await readAll(DBN('hq.basemap'), 'pic');
    const loci = await readAll(DBN('hq.loci'), 'img');
    const out = {version: 3, localStorage: state, picture: pics.img || null, loci};
    const others = {}; let n = 0;
    for (const k in pics) if (k !== 'img'){ others[k] = pics[k]; n++; }
    if (n) out.pictures = others;
    return out;
  }
  function counts(snap){
    const st = snap.localStorage || {};
    const len = k => { try { const v = JSON.parse(st[k] || '[]'); return Array.isArray(v) ? v.length : 0; } catch (e){ return 0; } };
    let shapes = 0, markers = 0, rooms = 0;
    for (const k in st){
      if (k === 'hq.shapes' || (k.indexOf('hq.shapes.') === 0)) shapes += len(k);
      else if (k === 'hq.markers' || k.indexOf('hq.markers.') === 0) markers += len(k);
      else if (k.indexOf('hq.rooms.') === 0) rooms++;
    }
    return {shapes, markers, rooms, loci: Object.keys(snap.loci || {}).length, picture: !!snap.picture};
  }
  const say = c => c.shapes + ' shapes, ' + c.markers + ' markers, ' + c.rooms + ' interiors, ' +
                   c.loci + ' pictures' + (c.picture ? ', a traced map' : '');

  async function exportTown(){
    const snap = await dump();
    const name = ((typeof Store !== 'undefined' && Store.get('hq.town')) || 'town').replace(/[^\w-]+/g, '-').toLowerCase();
    const blob = new Blob([JSON.stringify(snap, null, 1)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name + '-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    note('exported ' + say(counts(snap)));
    return snap;
  }

  /* ── in ── */
  async function load(snap, ask){
    if (!snap || !snap.localStorage || typeof snap.localStorage !== 'object') throw new Error('not a town file');
    const have = counts(await dump()), want = counts(snap);
    if (ask !== false){
      const ok = window.confirm('Import this town?\n\nfile:  ' + say(want) + '\nhere:  ' + say(have) +
                                '\n\nThe town here becomes the file. Export first if you want it kept.');
      if (!ok){ note('import cancelled'); return false; }
    }
    const saved = snap.localStorage;
    for (const k of keys()) if (!SKIP[k] && !(k in saved)) Store.del(k);
    for (const k in saved){ if (saved[k] == null) Store.del(k); else Store.set(k, saved[k]); }
    const pics = Object.assign({}, snap.pictures || {});
    if (snap.picture) pics.img = snap.picture;
    await writeAll(DBN('hq.basemap'), 'pic', pics);
    await writeAll(DBN('hq.loci'), 'img', snap.loci || {});
    note('imported ' + say(want) + ' — reloading');
    setTimeout(() => location.reload(), 600);
    return true;
  }
  function importTown(){
    let inp = document.getElementById('snapfile');
    if (!inp){
      inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json,application/json'; inp.id = 'snapfile'; inp.hidden = true;
      document.body.appendChild(inp);
      inp.addEventListener('change', () => {
        const f = inp.files && inp.files[0]; inp.value = '';
        if (!f) return;
        f.text().then(t => load(JSON.parse(t))).catch(e => note('could not import: ' + e.message));
      });
    }
    inp.click();
  }

  /* ── back to a blank page ──────────────────────────────────────────────
     Every `hq.` key and both picture stores out, then the reload that
     founds an empty home again, unasked, on `Found.DEFAULT`. It is a
     `load` of nothing, which is why it is here and not in the panel: the
     removing and the refilling are already written once.

     It asks, because the only undo is an export — and it asks the SAME
     question wherever it is reached from, the chip under *Town* in the
     tune panel and `Shift+R` alike (Eden, 2026-08-30). */
  const BLANK = () => ({version: 3, localStorage: {}, picture: null, loci: {}});
  const ASK = 'Reset the map to a blank page?\n\nEverything on every plate goes — ' +
              'the town, the palaces, the pictures. Export first if you want it kept.';
  function reset(){
    if (!window.confirm(ASK)) return false;
    load(BLANK(), false);
    return true;
  }

  return {dump, load, counts, exportTown, importTown, reset};
})();
