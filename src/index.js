'use strict';
/* ── the index ──────────────────────────────────────────────────────────
   What exists, and what it belongs to — read off the keys, never told.

   The town is joined by ids written into other records: a plate's marker
   list holds uids, a palace's plan and loci sit under keys named by that
   uid, a locus's picture sits in the store under its own uid, a mission
   names the palace it is for. None of those records knows about the
   others, and nothing before this could answer "which plate is this
   palace on" or "does anything still point at this picture" without
   walking every key. This walks them once, at boot and again after any
   write to one of them, and keeps the answers.

   It is derived, and it is treated as derived: `hq.index` is written so
   a tool reading the profile cold can see the same picture, but it is
   rebuilt from the keys on every boot and never read back to decide
   anything. If it and the keys ever disagree, the keys are right.

     plates    id  → {name, markers: [uid]}
     palaces   uid → {plate, name, n, plan, order, loci: [uid]}
     loci      uid → {palace, n, name, picture}
     pictures  key → {kind: 'locus'|'card'|'alt', owner}
     missions  id  → {palace}
     orphans   what nothing points at: palaces with no marker on any
               plate, loci under such a palace, pictures no locus holds,
               missions naming a palace that is gone

   The sweep (`tools/snapshot.py sweep`) reads `orphans` and nothing here
   deletes anything. */

const Index = (() => {
  const KEY = 'hq.index';
  const mkey = id => id === 'home' ? 'hq.markers' : 'hq.markers.' + id;
  let I = null, timer = 0;

  function build(){
    const atlas = Store.json('hq.atlas', null) || {areas: {home: {name: 'Home'}}};
    const plates = {}, palaces = {}, loci = {}, pictures = {}, missions = {};
    const orphans = {palaces: [], loci: [], pictures: [], missions: []};

    /* every marker on every plate is a palace, on that plate */
    for (const id in atlas.areas){
      const ms = Store.json(mkey(id), []);
      plates[id] = {name: atlas.areas[id].name || id, markers: []};
      for (const m of Array.isArray(ms) ? ms : []){
        if (!m || !m.uid) continue;
        plates[id].markers.push(m.uid);
        palaces[m.uid] = {plate: id, name: (m.name || '').trim(), n: m.n || 0,
                          plan: false, order: false, loci: []};
      }
    }
    /* the keys named by a uid: a plan, a typed room list, a set of loci.
       One under a uid no plate's marker carries is an orphan — a palace
       whose door was deleted, with the rooms still inside. */
    const seen = new Set();
    const under = (prefix, mark) => {
      for (const k of Store.keys(prefix)){
        const uid = k.slice(prefix.length);
        if (!uid) continue;
        if (!palaces[uid]){
          if (!seen.has(uid)){ seen.add(uid); orphans.palaces.push(uid); }
          palaces[uid] = {plate: null, name: '', n: 0, plan: false, order: false, loci: []};
        }
        mark(palaces[uid], k);
      }
    };
    under('hq.rooms.', (p, k) => { p.plan = Store.has(k); });
    under('hq.order.', (p, k) => { p.order = Store.has(k); });
    under('hq.marks.', (p, k) => {
      const uid = k.slice('hq.marks.'.length);
      for (const l of Store.json(k, [])){
        if (!l || !l.uid) continue;
        p.loci.push(l.uid);
        loci[l.uid] = {palace: uid, n: l.n || 0, name: (l.name || '').trim(), picture: false};
        if (!p.plate) orphans.loci.push(l.uid);
      }
    });
    /* the pictures: one store, told apart by prefix. A locus picture is
       owned by the locus whose uid it is; a card's by the bag, for as long
       as the bag exists, so those are never orphans here. */
    const keys = typeof Loci !== 'undefined' && Loci.keys ? Loci.keys() : [];
    for (const k of keys){
      if (k.indexOf('bag:') === 0){
        pictures[k] = {kind: k.indexOf(':alt:') > 0 ? 'alt' : 'card', owner: 'bag'};
      } else {
        pictures[k] = {kind: 'locus', owner: loci[k] ? loci[k].palace : null};
        if (loci[k]) loci[k].picture = true; else orphans.pictures.push(k);
      }
    }
    for (const m of Store.json('hq.missions', [])){
      if (!m || !m.id) continue;
      missions[m.id] = {palace: m.palace || ''};
      if (m.palace && !palaces[m.palace]) orphans.missions.push(m.id);
    }
    I = {at: Date.now(), plates, palaces, loci, pictures, missions, orphans};
    Store.save(KEY, I);
    return I;
  }

  /* a write to any of the keys this reads asks for a rebuild, once the
     burst of writes it is part of has settled — a drag saves per frame */
  function touched(){
    clearTimeout(timer);
    timer = setTimeout(build, 600);
  }
  function init(){
    build();
    for (const p of ['hq.markers', 'hq.rooms.', 'hq.order.', 'hq.marks.', 'hq.missions', 'hq.atlas'])
      Store.watch(p, touched);
  }
  const get = () => I || build();

  return {
    init, rebuild: build, get,
    plateOf: uid => { const p = get().palaces[uid]; return p ? p.plate : null; },
    palace: uid => get().palaces[uid] || null,
    orphans: () => get().orphans,
    counts: () => { const i = get(); return {plates: Object.keys(i.plates).length, palaces: Object.keys(i.palaces).length,
      loci: Object.keys(i.loci).length, pictures: Object.keys(i.pictures).length, missions: Object.keys(i.missions).length,
      orphans: i.orphans.palaces.length + i.orphans.loci.length + i.orphans.pictures.length + i.orphans.missions.length}; },
  };
})();
