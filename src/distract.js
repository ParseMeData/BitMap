'use strict';
/* ── distractions ───────────────────────────────────────────────────────
   The enemies. A distraction is a small cluster of the plate's material
   that appears now and then on a road of the plate you are walking —
   never near you, at most three a plate — and EATS THE ROAD: the tile it
   sits on is taken out of the walk grid, so the route is cut there until
   it is dealt with. It is dealt with by knowing something: stand by it,
   press Enter, and it asks a question from what you have built — a card
   from your deck ("12 · action?"), a place in a palace ("in Home, what
   stands at 3?"), a card of a saved stack — and a right answer clears it
   and repairs the road. A wrong one leaves it there and asks another.
   With nothing at all to ask, it takes three grains to repair instead.

   A distraction also blocks FAST TRAVEL. The region's Enter, the towns
   map's dots and the atlas chips all go through `Atlas.go`, and `allow`
   is asked there: a jump whose road from here to there crosses a plate
   with a distraction still on it is refused, and the note says which
   plate. Crossing a road end on foot is a step between neighbours and
   has nothing between, so it is never refused — the cut tiles are what
   stop you there.

   Kept under `hq.distract` as `{plates: {<id>: [{x, y, seed}]}}`, walk
   tiles of that plate, so a snapshot carries them and a reload finds
   them where they were. Only town plates: not the region, not a plan. */

const Distract = (() => {
  const KEY = 'hq.distract';
  const MAX = 3;                      // a plate holds at most this many
  const EVERY = 90;                   // seconds of live walking between arrivals, about
  const FAR = 6;                      // tiles: never nearer the walker than this
  const REACH = 1.6;                  // tiles: how close counts as standing by one
  const REPAIR = 3;                   // grains, when there is nothing to ask
  const DIM = [0.353, 0.353, 0.4], FLARE = [1, 0.373, 0.635], GOLD = [0.95, 0.76, 0.31];
  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };

  let D = load();
  let clock = EVERY * 0.5;            // the first one comes sooner than the rest
  let quiz = null;                    // {d, q} while a question is up
  let el = null, shown = null;

  function load(){
    const d = Store.json(KEY, null);
    return d && d.plates ? d : {plates: {}};
  }
  function save(){ Store.save(KEY, D, 'the distractions'); }

  /* the plate the walker is on, when distractions can be on it at all */
  function here(){
    if (typeof Kinds === 'undefined' || Kinds.scope() !== 'map') return null;
    if (typeof Interior !== 'undefined' && Interior.inside()) return null;
    if (typeof Region !== 'undefined' && Region.on()) return null;
    return Atlas.current();
  }
  const list = id => (D.plates[id] || []);
  const busy = () => {
    const b = document.body.classList;
    return b.contains('bag') || b.contains('journal') || b.contains('towns') || b.contains('missions') ||
           b.contains('locus') || b.contains('mapping') || (typeof Build !== 'undefined' && Build.active());
  };

  /* ── eating the road ──────────────────────────────────────────────────
     Called from restampTerrain after the shapes have stamped: each one
     takes its tile out. The base grid is untouched, so a cleared one is
     gone on the next restamp. */
  function stamp(t){
    const id = here(); if (!id) return;
    for (const d of list(id)){
      if (d.x < 0 || d.y < 0 || d.x >= t.tw || d.y >= t.th) continue;
      const i = d.y * t.tw + d.x;
      t.walk[i] = 0; t.path[i] = 0;
    }
  }

  /* ── arriving ─────────────────────────────────────────────────────────
     On the clock, while you are out walking a town: a road tile the
     walker can reach, well away from it, not beside another. */
  function step(dt){
    const id = here(); if (!id || !G.terr || !G.reach || busy() || quiz) return;
    if (list(id).length >= MAX) return;
    /* on the way to the quest's palace they come twice as fast: the journey
       is the game (src/quest.js) */
    clock -= dt * (typeof Quest !== 'undefined' && Quest.onWay(id) ? 2 : 1);
    if (clock > 0) return;
    clock = EVERY * (0.7 + Math.random() * 0.6);
    const t = G.terr, cand = [];
    for (let y = 0; y < t.th; y++) for (let x = 0; x < t.tw; x++){
      const i = y * t.tw + x;
      if (!t.path[i] || !G.reach[i]) continue;
      if (Math.hypot(x - G.x, y - G.y) < FAR) continue;
      if (list(id).some(d => Math.abs(d.x - x) <= 2 && Math.abs(d.y - y) <= 2)) continue;
      cand.push([x, y]);
    }
    if (!cand.length) return;
    const [x, y] = cand[(Math.random() * cand.length) | 0];
    (D.plates[id] = list(id)).push({x, y, seed: Math.random() * 6.28});
    save();
    if (typeof restampTerrain === 'function') restampTerrain();
    note('a distraction has settled on the road — stand by it and press Enter');
  }

  /* ── drawn ─────────────────────────────────────────────────────────────
     A cluster: a dim core and four flare motes that circle and flicker,
     in the entity stream with everything else. */
  function overlay(a, m, cap){
    const id = here(); if (!id || !G.terr) return m;
    const ts = G.terr.tsz, z = G.cam[2], px = 1 / z, t = performance.now() / 1000;
    const tg = target();
    for (const d of list(id)){
      if (m > cap - 8) break;
      const w = toWorld(d.x, d.y);
      const r = Math.max(ts * 0.36, 5 * px);
      m = put(a, m, w[0], w[1], DIM[0], DIM[1], DIM[2], 0.35, r * 2.4, 0, 0, 0, 2);
      m = put(a, m, w[0], w[1], DIM[0], DIM[1], DIM[2], 0.95, r, 0, 0, 0, 1);
      for (let k = 0; k < 4; k++){
        const ang = t * (1.3 + k * 0.17) + d.seed + k * 1.571;
        const flick = 0.55 + 0.45 * Math.sin(t * 9 + d.seed * 3 + k * 2.1);
        m = put(a, m, w[0] + Math.cos(ang) * r * 1.5, w[1] + Math.sin(ang) * r * 1.1,
                FLARE[0], FLARE[1], FLARE[2], 0.9 * flick, r * 0.42, 0, 0, 0, 1);
      }
      if (d === tg) m = put(a, m, w[0], w[1], GOLD[0], GOLD[1], GOLD[2], 0.8, r * 1.9, 1, 0, 0, 1);
    }
    return m;
  }

  /* the one the walker is standing by */
  function target(){
    const id = here(); if (!id || !G.terr) return null;
    let best = null, bd = REACH;
    for (const d of list(id)){
      const dist = Math.hypot(d.x - G.x, d.y - G.y);
      if (dist <= bd){ bd = dist; best = d; }
    }
    return best;
  }
  function prompt(){
    const hint = $('#enterhint');
    if (!hint || WALL || !here()) return;
    const d = G.paused ? null : target();
    const key = d ? d.x + ',' + d.y : '';
    if (key === shown) return;
    shown = key;
    if (!d) return;                   // the interior's prompt owns the hiding
    hint.hidden = false;
    hint.innerHTML = '';
    const e = document.createElement('em'); e.textContent = 'Enter';
    const n = document.createElement('span'); n.textContent = 'deal with the distraction';
    hint.append(e, n);
  }

  /* ── what it asks ─────────────────────────────────────────────────────
     Three wells, each a list of {q, a, from}; one drawn at random from
     the lot, so a big deck asks more deck questions than palace ones,
     which is right — it asks what you have most of. */
  function questions(){
    const out = [];
    if (typeof Bag !== 'undefined'){
      const NAMES = {character: 'person', action: 'action', object: 'object'};
      for (const sys in Bag.SYSTEMS)
        for (let i = 0; i < Bag.SYSTEMS[sys].cap; i++)
          for (const slot of Bag.SLOTS){
            const w = Bag.word(Bag.key(sys, i, slot));
            if (w) out.push({q: Bag.SYSTEMS[sys].label(i) + ' · ' + NAMES[slot] + '?', a: w, from: 'your deck'});
          }
    }
    if (typeof Loci !== 'undefined' && Loci.route)
      for (const r of Loci.route())
        for (const l of r.loci)
          if (l.name && l.n) out.push({q: 'in ' + (r.name || 'the palace') + ', what stands at ' + l.n + '?', a: l.name, from: 'a palace'});
    if (typeof Missions !== 'undefined' && Missions.list && typeof Bag !== 'undefined')
      for (const ms of Missions.list()){
        const name = ms.title || ms.purpose || 'a stack';
        ms.cards.forEach((c, k) => {
          const slot = Bag.SLOTS[k % Bag.SLOTS.length];
          const w = Bag.word(Bag.key(c.sys, c.i, slot));
          if (w) out.push({q: name + ' · card ' + (k + 1) + ' (' + Bag.SYSTEMS[c.sys].label(c.i) + ')?', a: w, from: 'a saved stack'});
        });
      }
    return out;
  }

  /* ── the quiz ─────────────────────────────────────────────────────────── */
  function build(){
    if (el) return el;
    el = document.createElement('div');
    el.id = 'quiz'; el.className = 'glass'; el.hidden = true;
    el.innerHTML = '<div class="phead"><span>A distraction <em id="quizfrom"></em></span>' +
      '<button class="btn" id="quizx">&#10005;</button></div>' +
      '<div id="quizq"></div>' +
      '<input id="quiza" type="text" spellcheck="false" autocomplete="off" placeholder="the answer">' +
      '<div class="kfoot one" id="quizpay" hidden><button class="btn" id="quizrepair"></button></div>' +
      '<div class="knote" id="quiznote">enter answers &middot; esc leaves it there</div>';
    document.body.appendChild(el);
    el.querySelector('#quizx').onclick = close;
    el.querySelector('#quizrepair').onclick = repair;
    el.querySelector('#quiza').addEventListener('keydown', e => {
      if (e.code === 'Enter' || e.code === 'NumpadEnter'){ e.preventDefault(); e.stopPropagation(); answer(); }
      else if (e.code === 'Escape'){ e.preventDefault(); e.stopPropagation(); close(); }
    });
    return el;
  }
  function ask(){
    const qs = questions();
    build();
    const pay = el.querySelector('#quizpay'), inp = el.querySelector('#quiza');
    if (!qs.length){
      quiz.q = null;
      el.querySelector('#quizfrom').textContent = 'nothing to ask';
      el.querySelector('#quizq').textContent = 'it wants something you know, and you have written nothing down yet';
      inp.hidden = true; pay.hidden = false;
      el.querySelector('#quizrepair').textContent = 'repair · ' + REPAIR + ' grains';
      return;
    }
    quiz.q = qs[(Math.random() * qs.length) | 0];
    el.querySelector('#quizfrom').textContent = 'from ' + quiz.q.from;
    el.querySelector('#quizq').textContent = quiz.q.q;
    inp.hidden = false; pay.hidden = true;
    inp.value = ''; inp.focus();
  }
  function open(){
    const d = target();
    if (!d){ note('stand by a distraction and press Enter to deal with it'); return false; }
    quiz = {d, id: here(), q: null};
    build().hidden = false;
    document.body.classList.add('quiz');
    ask();
    return true;
  }
  function answer(){
    if (!quiz || !quiz.q) return;
    const a = el.querySelector('#quiza').value.trim().toLowerCase(), w = quiz.q.a.toLowerCase();
    const ok = !!a && (a === w || (a.length >= 3 && w.indexOf(a) >= 0));
    if (ok){
      note('✓ ' + quiz.q.a + ' · the road is repaired');
      clear(quiz.id, quiz.d); close();
      if (typeof Stock !== 'undefined' && Stock.reward) Stock.reward('puzzle');
      return;
    }
    note('✗ it was ' + quiz.q.a + ' · it asks another');
    ask();
  }
  function repair(){
    if (!quiz) return;
    if (typeof Stock !== 'undefined' && !Stock.pay('repair')) return;
    note('repaired · ' + REPAIR + ' grains');
    clear(quiz.id, quiz.d); close();
  }
  function clear(id, d){
    D.plates[id] = list(id).filter(x => x !== d);
    if (!D.plates[id].length) delete D.plates[id];
    save();
    if (typeof restampTerrain === 'function') restampTerrain();
  }
  function close(){
    quiz = null;
    if (el) el.hidden = true;
    document.body.classList.remove('quiz');
  }
  const opened = () => !!quiz;

  /* ── fast travel ─────────────────────────────────────────────────────── */
  const blocked = id => list(id).length > 0;
  /* the plates a jump from `from` to `to` must cross, by the roads: a
     breadth-first walk of the atlas that will not pass through a blocked
     plate; if none gets there, the first blocked plate on the shortest
     road is the reason */
  function allow(to, from){
    from = from || Atlas.current();
    if (!to || to === from) return true;
    const areas = Atlas.areas();
    if (!areas[to]) return true;
    const adj = {}; for (const id in areas) adj[id] = new Set();
    for (const id in areas) for (const l of areas[id].links || []) if (areas[l.to]){ adj[id].add(l.to); adj[l.to].add(id); }
    const walk = avoid => {
      const prev = {[from]: null}, q = [from];
      while (q.length){
        const a = q.shift();
        if (a === to) return prev;
        for (const b of adj[a]) if (!(b in prev) && !(avoid && b !== to && blocked(b))){ prev[b] = a; q.push(b); }
      }
      return null;
    };
    if (walk(true)) return true;
    const any = walk(false);
    if (!any) return true;              // no road between them at all: nothing in the way
    let at = to, cross = null;
    while (any[at] !== null){ at = any[at]; if (at !== from && blocked(at)) cross = at; }
    note('the road to ' + areas[to].name + ' crosses ' + areas[cross].name + ', where a distraction sits — clear it first');
    return false;
  }

  function init(){
    if (typeof Region !== 'undefined') Region.gate = t => allow(t.root);
    /* REPAIR is a price like any other, so the stock can refuse it */
    if (typeof Stock !== 'undefined' && Stock.COST) Stock.COST.repair = {grains: REPAIR};
  }

  return {init, step, stamp, overlay, prompt, target, open, close, opened, allow, blocked,
          list: id => list(id || here()).slice(), questions,
          add: (x, y) => { const id = here(); if (!id) return false; (D.plates[id] = list(id)).push({x, y, seed: Math.random() * 6.28}); save(); if (typeof restampTerrain === 'function') restampTerrain(); return true; }};
})();
