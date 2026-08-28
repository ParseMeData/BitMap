'use strict';
/* ── the quest ───────────────────────────────────────────────────────────
   The core of the game, as Eden set it out on 2026-08-28.

   The journal's focused acronym is the REGION — Skills › Music › RAITS.
   Each LETTER of it is a PLATE: S is Myrtleford South, A is the town
   centre, and the region plate (src/region.js) draws every town in its
   letter's tone with the letter on the diamond. Each ITEM under a letter
   is a PALACE on that letter's plate: a marker carries `item`, and the
   plans and loci inside it are that item's.

   The MISSION is to get from palace to palace. Pick an item in the focus
   column (src/focus.js, `Journal.pick`) and its palace is the target: a
   line at the top of the screen says where it is and how many plates
   away, the target's town wears a gold ring on the region and its marker
   one on the plate, and the plates between here and there breed
   distractions twice as fast (src/distract.js reads `onWay`) — so the
   journey is puzzles, drills and repaired roads. Walk in through that
   marker's door and the quest is done: the reward goes into the stock
   (`Stock.REWARD.quest`) and the pick is put down.

   Nothing here is stored of its own: the target is the pick, the
   bindings are the atlas's `letter` and the markers' `item`.           */

const Quest = (() => {
  /* the focus row's tones, one a letter (src/focus.js TONES) */
  const TONES = [[0.93, 0.92, 0.89], [0.48, 0.72, 0.44], [1.00, 0.37, 0.64], [0.24, 0.50, 0.75],
                 [0.76, 0.60, 0.36], [0.58, 0.22, 0.25], [0.95, 0.76, 0.31]];
  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };
  const F = () => (typeof Journal !== 'undefined' && Journal.focused ? Journal.focused() : null);

  /* ── letters and plates ────────────────────────────────────────────── */
  const letterIndex = lid => { const f = F(); return f ? f.ids.indexOf(lid) : -1; };
  const letterOf = id => (Atlas.areas()[id || Atlas.current()] || {}).letter || null;
  /* {k, ch, word, tone} for a plate, or null when it is not a letter of
     the focused acronym */
  function letter(id){
    const lid = letterOf(id), k = letterIndex(lid);
    if (k < 0) return null;
    const f = F();
    return {id: lid, k, ch: f.letters[k], word: f.words[k] || '', tone: TONES[k % TONES.length],
            items: f.items[k] || []};
  }
  const platesOf = lid => Object.keys(Atlas.areas()).filter(id => Atlas.areas()[id].letter === lid);

  /* ── items and palaces ─────────────────────────────────────────────── */
  const itemText = it => { const f = F(); if (!f || !it) return ''; const k = f.ids.indexOf(it.id); return k < 0 ? '' : (f.items[k] || [])[it.item] || ''; };
  /* a marker's item, said: "R · Rhythm" */
  function tag(mk){
    if (!mk || !mk.item) return '';
    const f = F(); if (!f) return '';
    const k = f.ids.indexOf(mk.item.id); if (k < 0) return '';
    const t = (f.items[k] || [])[mk.item.item];
    return t == null ? '' : f.letters[k] + ' · ' + t;
  }
  /* every marker on every plate that carries an item: [{plate, uid, name, item}] */
  function palaces(){
    const out = [];
    for (const id in Atlas.areas()){
      let list = [];
      try { list = JSON.parse(Store.get(Atlas.mkey(id)) || '[]'); } catch (e){}
      for (const m of (Array.isArray(list) ? list : [])) if (m && m.item) out.push({plate: id, uid: m.uid, name: m.name || '', item: m.item});
    }
    return out;
  }

  /* ── the target ──────────────────────────────────────────────────────── */
  function target(){
    const p = typeof Journal !== 'undefined' && Journal.pick ? Journal.pick() : null;
    if (!p) return null;
    const hit = palaces().find(x => x.item.id === p.id && x.item.item === p.item);
    const f = F(), k = f ? f.ids.indexOf(p.id) : -1;
    return {pick: p, text: p.text, ch: k >= 0 ? f.letters[k] : '?',
            plate: hit ? hit.plate : null, uid: hit ? hit.uid : null, name: hit ? hit.name : ''};
  }
  const isTarget = uid => { const t = target(); return !!(t && uid && t.uid === uid); };
  const targetPlate = () => { const t = target(); return t ? t.plate : null; };

  /* the plates a road from `from` to `to` crosses, by the shortest walk
     of the atlas — the ones a distraction should favour */
  function way(from, to){
    from = from || Atlas.current();
    if (!to || !from || from === to) return [];
    const areas = Atlas.areas(), adj = {};
    for (const id in areas) adj[id] = new Set();
    for (const id in areas) for (const l of areas[id].links || []) if (areas[l.to]){ adj[id].add(l.to); adj[l.to].add(id); }
    const prev = {[from]: null}, q = [from];
    while (q.length){ const a = q.shift(); if (a === to) break; for (const b of adj[a]) if (!(b in prev)){ prev[b] = a; q.push(b); } }
    if (!(to in prev)) return null;
    const path = []; let at = to;
    while (at !== null){ path.unshift(at); at = prev[at]; }
    return path;
  }
  const onWay = id => { const t = target(); if (!t || !t.plate) return false; const w = way(Atlas.current(), t.plate); return !!w && w.indexOf(id || Atlas.current()) > 0; };

  /* ── done ──────────────────────────────────────────────────────────────
     Called by Interior.enter with the marker walked into. */
  function arrive(mk){
    if (!mk || !isTarget(mk.uid)) return false;
    const t = target();
    if (typeof Stock !== 'undefined' && Stock.reward) Stock.reward('quest');
    if (typeof Journal !== 'undefined' && Journal.setPick) Journal.setPick(null);
    if (typeof Focus !== 'undefined' && Focus.refresh) Focus.refresh();
    note('quest done · ' + t.ch + ' · ' + t.text + ' — you are in ' + (t.name || 'the palace'));
    line();
    return true;
  }

  /* ── the line at the top ──────────────────────────────────────────────── */
  let said = '';
  function line(){
    const el = $('#quest'); if (!el) return;
    const t = target();
    let s = '';
    if (t){
      const areas = Atlas.areas();
      if (!t.plate) s = t.ch + ' · ' + t.text + ' — no palace is this item yet';
      else {
        const w = way(Atlas.current(), t.plate);
        const far = w === null ? 'no road there' : w.length <= 1 ? 'on this plate' : (w.length - 1) + ' plate' + (w.length === 2 ? '' : 's') + ' away';
        s = t.ch + ' · ' + t.text + ' → ' + (areas[t.plate] || {}).name + (t.name ? ' · ' + t.name : '') + ' · ' + far;
      }
    }
    if (s === said) return;
    said = s;
    el.hidden = !s;
    el.innerHTML = '';
    if (!s) return;
    const b = document.createElement('b'); b.textContent = 'Quest';
    const n = document.createElement('span'); n.textContent = s;
    el.append(b, n);
  }

  /* ── the palette's two selects ─────────────────────────────────────────
     Letter, for the plate you are on; Item, for the marker selected.
     Both list the focused acronym and nothing else: a plate that is a
     letter of an acronym not in focus keeps its binding, unshown. */
  function options(sel, list, value){
    sel.innerHTML = '';
    for (const [v, label] of list){
      const o = document.createElement('option'); o.value = v; o.textContent = label; sel.appendChild(o);
    }
    sel.value = value;
    if (sel.value !== value) sel.value = '';
  }
  function syncLetter(){
    const sel = $('#kletter'); if (!sel) return;
    const f = F();
    const on = !!f && typeof Region !== 'undefined' && !Region.on() && !(typeof Interior !== 'undefined' && Interior.inside());
    sel.hidden = !on; const lab = $('#kletterlab'); if (lab) lab.hidden = !on;
    if (!on) return;
    const list = [['', '— not a letter']].concat(f.ids.map((lid, k) => [lid, f.letters[k] + (f.words[k] ? ' · ' + f.words[k] : '')]));
    options(sel, list, letterOf(Atlas.current()) || '');
  }
  function syncItem(mk){
    const sel = $('#kmitem'); if (!sel) return;
    const f = F();
    sel.hidden = !mk || !f;
    if (!mk || !f) return;
    const L = letter(Atlas.current());
    const list = [['', '— no item']];
    const add = (k) => (f.items[k] || []).forEach((t, i) => list.push([f.ids[k] + ':' + i, f.letters[k] + ' · ' + t]));
    if (L) add(L.k); else f.ids.forEach((_, k) => add(k));
    options(sel, list, mk.item ? mk.item.id + ':' + mk.item.item : '');
  }
  function wire(){
    const ls = $('#kletter');
    if (ls) ls.onchange = () => { Atlas.setLetter(Atlas.current(), ls.value || null); note(ls.value ? 'this plate is ' + ls.selectedOptions[0].textContent : 'this plate is no letter'); line(); };
    const is = $('#kmitem');
    if (is) is.onchange = () => {
      const mk = Markers.selected(); if (!mk) return;
      const v = is.value; const i = v.lastIndexOf(':');
      Markers.setItem(mk, v ? {id: v.slice(0, i), item: +v.slice(i + 1)} : null);
      note(v ? (mk.name || 'this palace') + ' is ' + is.selectedOptions[0].textContent : (mk.name || 'this palace') + ' is no item');
      line();
    };
    for (const s of [ls, is]) if (s) s.onkeydown = e => e.stopPropagation();
  }

  function init(){ line(); }

  return {init, line, wire, syncLetter, syncItem, letter, letterOf, platesOf, tag, itemText, palaces,
          target, isTarget, targetPlate, way, onWay, arrive, TONES};
})();
