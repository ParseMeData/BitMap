'use strict';
/* ── the stock: grains and blocks ───────────────────────────────────────
   Two materials, two bars on the HUD strip beside the sparks.

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
  const START = {grains: 20, blocks: 10};
  const COST = {
    road:      {grains: 5},
    link:      {grains: 3},
    marker:    {blocks: 5},
    house:     {blocks: 3},
    landmark:  {blocks: 3},
    buildings: {blocks: 4},
    houses:    {blocks: 4}
  };
  const SAY = {grains: 'grains — drill a system for more (the bag)',
               blocks: 'blocks — run a route in the platformer for more'};
  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };

  const clamp = v => Math.max(0, Math.min(CAP, Math.round(+v || 0)));
  let S = load();
  function load(){
    const s = Store.json(KEY, null);
    if (!s || typeof s !== 'object') return Object.assign({}, START);
    return {grains: clamp(s.grains), blocks: clamp(s.blocks)};
  }
  function save(){ Store.save(KEY, S, 'the stock'); ui(); }

  /* the bars. Width is the level over the cap; the number beside it is
     the level itself. */
  function ui(){
    for (const k of ['grains', 'blocks']){
      const bar = document.getElementById('h' + k), v = document.getElementById('h' + k + 'v');
      if (bar) bar.style.width = (S[k] / CAP * 100).toFixed(0) + '%';
      if (v) v.textContent = String(S[k]);
    }
  }

  /* what placing one of `kind` costs; nothing, for a kind not listed */
  const cost = kind => COST[kind] || null;
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

  return {init, pay, earn, afford, cost, ui,
          get: () => Object.assign({}, S), CAP, COST};
})();
