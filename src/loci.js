'use strict';
/* ── loci ───────────────────────────────────────────────────────────────
   Inside a room, a marker is a locus: a numbered spot, and a picture of
   whatever stands there. One = a hand statue, two = a sculpture of Roman
   faces, three = the television, four = the fireplace. That is the whole
   of the method — the order is fixed, and each place in it holds an image
   you can see.

   Press Enter on one and it opens. With a picture attached you get it
   rendered as lattice, which is not a thumbnail of the photograph but the
   thing the platformer will actually hand you: the same diamonds, the same
   tone pass, so what you are looking at *is* the level. With nothing
   attached yet it opens a file picker instead, because a locus with no
   picture is a locus you have not finished writing.

   The pictures live in their own IndexedDB store rather than in
   localStorage: a photograph is hundreds of kilobytes and the whole of
   localStorage is five megabytes, so a dozen loci would fill it and the
   failure would land on the town rather than on the picture that caused
   it. They are downscaled on the way in — the platformer bakes at 640 and
   nothing downstream wants more. */

const Loci = (() => {
  const DB = 'hq.loci', STORE = 'img', MAX = 1200;
  /* ── one store, its tenants told apart by the row's name ──────────────
     A locus's picture is row `locus:<uid>`; a card's is `card:<sys>:<label>:
     <slot>`, and each picture in its hand `card:…:alt:<n>`. The keys the
     callers pass are unchanged — a marker's uid, the bag's `bag:…` key —
     and are turned into rows here, once, so nothing above this needs to
     know how the store is laid out and nothing can mistake a card for a
     locus. Rows without a prefix are from before v7.8 and are moved on the
     first survey; that is self-describing, so it needs no ladder step. */
  const row = k => k.indexOf('bag:') === 0 ? 'card:' + k.slice(4) : 'locus:' + k;
  const uidOf = r => r.indexOf('card:') === 0 ? 'bag:' + r.slice(5)
                   : r.indexOf('locus:') === 0 ? r.slice(6) : r;
  const isRow = r => r.indexOf('card:') === 0 || r.indexOf('locus:') === 0;
  /* what is attached, without holding the pictures themselves in memory —
     the ring on a marker asks this question once a frame, per marker */
  let have = {}, cache = {}, open = null, pending = null;
  let A = null, buf = null, cam = [0, 0, 1];

  /* ── the store ── */
  function idb(){
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE);
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error || new Error('refused'));
    });
  }
  function tx(mode, fn){
    return idb().then(d => new Promise((res, rej) => {
      const t = d.transaction(STORE, mode), q = fn(t.objectStore(STORE));
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    }));
  }
  const store = (uid, url) => tx('readwrite', s => s.put(url, row(uid)));
  const del = uid => tx('readwrite', s => s.delete(row(uid)));
  const get = uid => (cache[uid] ? Promise.resolve(cache[uid])
                                 : tx('readonly', s => s.get(row(uid)))
                                     .then(v => (v ? (cache[uid] = v) : null)));

  /* one pass over the keys at boot, so `has` is a lookup and not a promise */
  function survey(){
    return tx('readonly', s => s.getAllKeys()).then(ks => {
      const old = (ks || []).filter(k => !isRow(k));
      return (old.length ? migrate(old) : Promise.resolve()).then(() => {
        have = {};
        for (const k of ks || []) have[uidOf(k)] = 1;
        return have;
      });
    }).catch(() => have);
  }
  /* rows from before v7.8, moved under their prefix one by one: read,
     write under the new name, then remove the old — so a boot cut short
     leaves every picture under one name or the other, never neither */
  function migrate(old){
    return old.reduce((p, k) => p.then(() =>
      tx('readonly', s => s.get(k)).then(v => v == null ? null :
        tx('readwrite', s => s.put(v, row(k))).then(() => tx('readwrite', s => s.delete(k))))
    ), Promise.resolve()).then(() => { if (typeof hqNote === 'function') hqNote(old.length + ' pictures moved under their names', false); });
  }
  const has = uid => !!(uid && have[uid]);
  const keys = () => Object.keys(have).map(row);   // every row in the store, for the index
  const rowOf = row;

  /* ── attaching one ─────────────────────────────────────────────────────
     Down to a long edge of 1200 and re-encoded, because what comes off a
     phone is four thousand pixels of JPEG and none of it survives being
     turned into diamonds. WebP where the encoder has it, JPEG otherwise —
     `toDataURL` quietly hands back a PNG when it does not know the type,
     which for a photograph is several times the size for no gain, so the
     result is checked rather than trusted. */
  function shrink(url){
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => {
        const w0 = im.naturalWidth || 1, h0 = im.naturalHeight || 1;
        const k = Math.min(1, MAX / Math.max(w0, h0));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w0 * k));
        c.height = Math.max(1, Math.round(h0 * k));
        const x = c.getContext('2d');
        x.drawImage(im, 0, 0, c.width, c.height);
        let out = c.toDataURL('image/webp', 0.88);
        if (out.indexOf('data:image/webp') !== 0) out = c.toDataURL('image/jpeg', 0.88);
        res(out);
      };
      im.onerror = () => rej(new Error('that file is not an image this browser can read'));
      im.src = url;
    });
  }
  function attach(mk, file){
    if (!mk || !mk.uid || !file) return Promise.resolve(false);
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = () => rej(fr.error || new Error('could not read that file'));
      fr.readAsDataURL(file);
    })
      .then(shrink)
      .then(url => store(mk.uid, url).then(() => {
        cache[mk.uid] = url; have[mk.uid] = 1;
        if (open && open.mk === mk) show(mk);      // the picker was opened from the preview
        else if (Build.active()) Build.sync();
        return true;
      }))
      .catch(e => { note(e.message || String(e)); return false; });
  }
  function detach(mk){
    if (!mk || !mk.uid) return;
    delete cache[mk.uid]; delete have[mk.uid];
    del(mk.uid).catch(() => {});
    if (open && open.mk === mk) close();
    Build.sync();
  }
  /* These are all things you did, not things that broke — a file that is not
     an image, a route with nothing in it yet. They go to the note channel, so
     the error slot still means an error when someone comes looking. */
  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };

  /* ── the picker ────────────────────────────────────────────────────────
     One input, reused. It is cleared before every open because choosing the
     same file twice in a row fires no change event otherwise, and "nothing
     happened" is indistinguishable from a bug. */
  function pick(mk){
    const el = $('#lfile');
    if (!el) return;
    pending = mk;
    el.value = '';
    el.click();
  }
  function wirePicker(){
    const el = $('#lfile');
    if (!el) return;
    el.addEventListener('change', () => {
      const f = el.files && el.files[0], mk = pending;
      pending = null;
      if (f && mk) attach(mk, f);
    });
    /* dropping a picture straight onto an open preview is the same act */
    addEventListener('drop', e => {
      if (!open) return;
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      e.preventDefault(); e.stopPropagation();
      attach(open.mk, f);
    }, true);
  }

  /* ── the preview ───────────────────────────────────────────────────────
     The picture put through the same two stages the map goes through —
     analyse for tone and edges, compose to pick each cell's two faces — and
     handed to the same renderer as one more static batch. So it breathes on
     the shader's own clock like everything else, and no part of this is a
     second way of drawing a picture.

     The tune is fixed rather than taken from the panel: this is a look at
     the asset, and it should not change because the town's contrast slider
     moved. Neutral tone and contrast, because these are the values the
     platformer's own deck was calibrated on and a photograph should arrive
     here looking like the photograph. Colour comes per-cell from the source
     (`ink: -1`), and the colour jitter that makes terrain shimmer is off —
     a face has to stay a face. */
  const TUNE = {cols: 150, bri: 0, con: 1, edge: 0, ink: -1, churn: 0.6,
                scatter: 0, szv: 0.5, cvar: 0, sat: 1.15, path: 0, glow: 0.45};

  function build(url){
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('the stored picture would not load'));
      im.src = url;
    }).then(im => {
      const W = im.naturalWidth || 1, H = im.naturalHeight || 1;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const x = c.getContext('2d', {willReadFrequently: true});
      x.imageSmoothingEnabled = false;
      x.drawImage(im, 0, 0);
      const px = x.getImageData(0, 0, W, H).data;
      A = Lattice.analyse(px, W, H, TUNE.cols, TUNE);
      buf = Lattice.compose(A, TUNE);
      R.batch('locus', buf, R.gl.STATIC_DRAW);
      return {W, H: A.rows * A.cell};
    });
  }

  function show(mk){
    if (!mk || !mk.uid) return false;
    /* the plate clears transparent while a map is being traced, and a
       preview drawn over a real map is not a preview of anything — so it
       paints its own ground and hands the setting back on the way out */
    open = {mk, size: null, loading: true, clearA: R ? R.clearA : 1};
    if (R) R.clearA = 1;
    caption();
    get(mk.uid).then(url => {
      if (!url){ open = null; caption(); pick(mk); return; }
      return build(url).then(size => {
        if (!open || open.mk !== mk) return;       // closed while it was loading
        open.size = size; open.loading = false;
        caption();
      });
    }).catch(e => { note(e.message || String(e)); close(); });
    return true;
  }
  function close(){
    if (!open) return false;
    const was = open.clearA;
    open = null;
    if (R && !R.lost){
      R.clearA = was;
      R.batch('locus', new Float32Array(0), R.gl.STATIC_DRAW);
    }
    caption();
    return true;
  }
  /* Enter opens what the marker holds; with nothing in it, that is the
     picker, so one key both looks and attaches */
  function enter(mk){
    if (!mk || !mk.uid) return false;
    if (!has(mk.uid)){ pick(mk); return true; }
    return show(mk);
  }

  /* drawn instead of the world, not over it — this is a look at one asset */
  function draw(){
    if (!open || open.loading || !open.size || !A) return false;
    const z = Math.min(VW / open.size.W, VH / open.size.H) * 0.86;
    cam[0] = open.size.W / 2; cam[1] = open.size.H / 2; cam[2] = z;
    R.draw('locus', cam, A.cell, 0);
    return true;
  }

  function caption(){
    const el = $('#locus');
    document.body.classList.toggle('locus', !!open);
    if (!el) return;
    el.hidden = !open;
    if (!open) return;
    const mk = open.mk;
    el.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = String(mk.n || '?');
    const n = document.createElement('span');
    n.textContent = (mk.name || '').trim() ||
                    (Markers.glyphs()[mk.gi] || 'this place');
    const e = document.createElement('em');
    e.textContent = open.loading ? 'building…' : 'R replace · Esc closes';
    el.append(b, n, e);
  }

  /* ── the deck ──────────────────────────────────────────────────────────
     What the platformer runs. Every room in the town's order, and inside
     each one every locus in its own, flattened into the run of pictures you
     walk through. It is assembled from storage rather than from what
     happens to be loaded, because the town is only mounted one room at a
     time and the deck is all of them at once. */
  const RKEY = uid => 'hq.rooms.' + uid;
  const MKEY = uid => 'hq.marks.' + uid;
  const read = k => { try { return JSON.parse(Store.get(k) || '[]') || []; }
                      catch (e){ return []; } };
  const byN = a => a.slice().sort((x, y) => (x.n || 0) - (y.n || 0));

  /* the route as data: rooms, their loci, and which of those have a picture */
  function route(){
    const towns = byN(read('hq.markers'));
    return towns.map(t => ({
      uid: t.uid, name: (t.name || '').trim(), gi: t.gi, n: t.n || 0,
      room: read(RKEY(t.uid)).length > 0,
      loci: byN(read(MKEY(t.uid))).map(m => ({
        uid: m.uid, name: (m.name || '').trim(), gi: m.gi, n: m.n || 0,
        img: has(m.uid)
      }))
    }));
  }
  /* the same run, with the pictures actually fetched — what gets handed over */
  function deck(){
    const out = [], want = [];
    for (const r of route())
      for (const l of r.loci)
        if (l.img) want.push({uid: l.uid, room: r.name || r.uid, name: l.name, n: l.n});
    return Promise.all(want.map(w => get(w.uid).then(url => ({w, url}))))
      .then(rows => {
        for (const {w, url} of rows) if (url) out.push({url, room: w.room, name: w.name, n: w.n});
        return out;
      });
  }
  const count = () => route().reduce((a, r) => a + r.loci.filter(l => l.img).length, 0);

  /* ── handing it over ───────────────────────────────────────────────────
     The platformer is a separate page and stays one — it runs on its own
     with its own deck when nothing has been built here. What it takes from
     the town is written in two halves because the two are needed at
     different moments: the ORDER goes to localStorage, which is synchronous,
     so the page knows how many faces there are before it builds anything;
     the PICTURES stay in IndexedDB and are fetched once, after. Every
     file:// page here shares an origin, which is what makes either half
     readable from over there.

     Only loci that actually have a picture go in. A locus you have not
     finished writing is not a level, and quietly handing over a blank one
     would read as the platformer being broken. */
  const DECK = 'hq.deck';
  function publish(){
    const uids = [], meta = [];
    for (const r of route())
      for (const l of r.loci)
        if (l.img){
          uids.push(l.uid);
          meta.push({room: r.name || '', name: l.name || '', n: l.n});
        }
    try { Store.set(DECK, JSON.stringify({uids, rows: uids.map(row), meta, at: Date.now()})); }
    catch (e){ note('could not hand the route over: ' + e.message); }
    return uids.length;
  }
  /* a new window rather than this one, so the town is still standing behind
     it — closing the platformer is how you come back */
  function play(){
    const n = publish();
    if (!n){ note('nothing to play yet — a locus needs a picture before it is a level'); return 0; }
    const w = window.open('platformer.html', '_blank');
    if (!w) location.href = 'platformer.html';
    return n;
  }

  function init(){
    wirePicker();
    const btn = $('#kplay');
    if (btn) btn.onclick = () => play();
    return survey();
  }

  /* `get` is handed out for the bag, which keeps its cards in this store
     under its own keys and reads them back to paint the faces */
  return {init, has, keys, rowOf, get, enter, show, close, pick, attach, detach, draw, survey,
          route, deck, count, publish, play, opened: () => !!open,
          at: () => (open ? open.mk : null)};
})();
