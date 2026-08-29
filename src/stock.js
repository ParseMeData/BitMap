'use strict';
/* ── the stock: grains and blocks ───────────────────────────────────────
   Three materials, three bars stacked in the corner of the HUD.

   SPARKS are the PAO system's own material. Every card of the bag — a
   number's person, its action, its object; a letter's three — costs one
   spark the first time it is given a word or a picture, so a spark is a
   character allowed in, and an action and an object are each a spark of
   their own. They are earned by the round: turn Sparks on in the tune
   panel and every one the walker collects goes into the stock.

   GRAINS build roads — a road on the town, a link on the region. They
   are earned by drilling the memory systems: the drill chip on the bag
   page asks five questions from the cards you have written words on, and
   every right answer is a grain (src/bag.js).

   BLOCKS build places — a marker, a house, a building, a district of
   blocks or housing. They are earned by walking a route in the platformer:
   when the last picture of a run is built, one block per picture goes in
   (platformer.html, routeDone), and the strip here reads it back the
   moment that page writes it.

   Placing costs what COST says and is refused, with a note, when short;
   nothing that already stands is ever taken back. A profile that has no
   stock yet starts with a little of each, so the first road is not a
   drill away. Kept under `hq.stock`, so a snapshot carries it.         */

const Stock = (() => {
  const KEY = 'hq.stock';
  const CAP = 100;
  const START = {sparks: 6, grains: 20, blocks: 10};
  const COST = {
    card:      {sparks: 1},
    road:      {grains: 5},
    path:      {grains: 2},
    link:      {grains: 3},
    marker:    {blocks: 5},
    house:     {blocks: 3},
    landmark:  {blocks: 3},
    building:  {blocks: 3}, mountain: {blocks: 3}, creature: {blocks: 2},
    flora:     {blocks: 1}, plant: {blocks: 1}, leaf: {blocks: 1}, sign: {blocks: 1}, pattern: {blocks: 1},
    buildings: {blocks: 4},
    houses:    {blocks: 4}
  };
  /* what the game pays, generic amounts for now (Eden, 2026-08-28) */
  const REWARD = {
    puzzle: {grains: 2},               // a distraction cleared by its quiz
    drill:  {grains: 1},               // one right answer in a drill
    run:    {blocks: 1},               // a picture of a route walked (platformer.html)
    quest:  {blocks: 5, sparks: 1}     // the quest's palace entered
  };
  const SAY = {sparks: 'sparks — turn the round on (T, Sparks) and collect them',
               grains: 'grains — drill a system for more (the bag)',
               blocks: 'blocks — run a route in the platformer for more'};
  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };

  const clamp = v => Math.max(0, Math.min(CAP, Math.round(+v || 0)));
  let S = load();
  function load(){
    const s = Store.json(KEY, null);
    if (!s || typeof s !== 'object') return Object.assign({}, START);
    return {sparks: s.sparks === undefined ? START.sparks : clamp(s.sparks),
            grains: clamp(s.grains), blocks: clamp(s.blocks)};
  }
  function save(){ Store.save(KEY, S, 'the stock'); ui(); }

  /* the bars. Width is the level over the cap; the number beside it is
     the level itself. */
  function ui(){
    for (const k of ['sparks', 'grains', 'blocks']){
      const bar = document.getElementById('h' + k + (k === 'sparks' ? 'bar' : '')),
            v = document.getElementById('h' + k + (k === 'sparks' ? '' : 'v'));
      if (bar) bar.style.width = (S[k] / CAP * 100).toFixed(0) + '%';
      if (v) v.textContent = String(S[k]);
    }
  }

  /* ── the first plate is free ─────────────────────────────────────────
     Home — the first plate, the town you set out from — costs nothing to
     build: roads, places, houses, districts all go down for free there,
     so the town can be laid out without grinding for it (Eden,
     2026-08-28). Every other plate pays. A card is not building and
     still costs its spark wherever you are; a repair is a repair. */
  const FREE = {road: 1, path: 1, link: 1, marker: 1, house: 1, landmark: 1, buildings: 1, houses: 1,
                building: 1, flora: 1, plant: 1, leaf: 1, sign: 1, creature: 1, pattern: 1, mountain: 1};
  const onHome = () => typeof Atlas !== 'undefined' && Atlas.current() === 'home' &&
    !(typeof Region !== 'undefined' && Region.on());
  /* what placing one of `kind` costs; nothing, for a kind not listed, or
     for building on the home plate */
  const cost = kind => (FREE[kind] && onHome()) ? null : (COST[kind] || null);
  const afford = kind => {
    const c = cost(kind); if (!c) return true;
    for (const m in c) if (S[m] < c[m]) return false;
    return true;
  };
  /* take the price, or say why not — the caller does not place */
  function pay(kind){
    const c = cost(kind); if (!c) return true;
    for (const m in c) if (S[m] < c[m]){
      note('not enough ' + SAY[m] + ' · ' + kind + ' costs ' + c[m] + ', you have ' + S[m]);
      return false;
    }
    for (const m in c) S[m] = clamp(S[m] - c[m]);
    save();
    return true;
  }
  /* pay a reward by name; says what came in */
  function reward(name){
    const r = REWARD[name]; if (!r) return false;
    const said = [];
    for (const m in r){ earn(m, r[m]); said.push(r[m] + ' ' + m); }
    note('+ ' + said.join(', '));
    return true;
  }
  function earn(what, n){
    if (!(what in S)) return S;
    S[what] = clamp(S[what] + (n | 0));
    save();
    return S[what];
  }

  /* the platformer writes the same key from its own page; the storage
     event is how this one hears, and a refocus is the belt to that brace */
  function init(){
    ui();
    addEventListener('storage', e => { if (e.key === KEY){ S = load(); ui(); } });
    addEventListener('focus', () => { S = load(); ui(); });
  }

  return {init, pay, earn, reward, afford, cost, ui,
          get: () => Object.assign({}, S), CAP, COST, REWARD};
})();
