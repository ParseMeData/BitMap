'use strict';
/* ── the bag ────────────────────────────────────────────────────────────
   One page, two systems.

   The HUD's left ring is `123` and its top ring is `abc`, and they open the
   same thing: a row of cards, one per number or letter. What differs is
   the set of labels — `1 2 3 …` for the number system, `A B C …` for the
   letter system — and nothing else, so there is one page here with a
   `system` name on it rather than two pages that would drift apart.
   `SYSTEMS` is the whole of the difference.

   It is a page, not a panel: it covers the plate, and the plate's own
   chrome steps out of the way while it is up (`body.bag`, in index.html),
   the same way `body.locus` clears the screen for a picture. It is still
   the game — the walker is where you left them, Esc or the ✕ puts the town
   back exactly as it was — so it is opened through the HUD's seams
   (`Hud.onNumbers`, `Hud.onLetters`, filled in game.js).

   Down the right rail is the STACK, laid the way a solitaire column is —
   each card a step below the last, so what shows of a covered card is its
   tag. It is a sequence, and the row deals into it: the first card you
   press goes down as its PERSON, the next — whatever number, from either
   system — as its ACTION, the next as its OBJECT, and then a gap, and a
   person again, and round. So `1 5 3` is 1's person doing 5's action to
   3's object, and `1 1 1` is 1's own three, stacked; the only time one
   label sits over itself is when you dealt it twice. Every number has one
   person, one action and one object — the method the whole game is built
   on (a place, and a picture of what stands there), applied to a number —
   and the stack is the order you drew them in. Every card takes a picture
   — click it, or drop one on it — and the picture is its face from then
   on; and a word, typed on the card. The stack holds until it is cleared:
   through other rows, the other system, the page closing, the game
   closing. The page shows one row of five at a time, and the slider down
   the left is the way between rows — 1 at the top, 100 at the bottom (Z,
   for the letters).

   The pictures live in the locus store (`Loci`, IndexedDB `hq.loci/img`)
   under keys of their own — `bag:numbers:3:action` — rather than in a
   store of their own, because the store is already there, already carried
   by `tools/snapshot.py` key for key, and already shrinks a photograph on
   the way in. Nothing in `Loci` walks its keys expecting every one to be
   a marker: `has` is asked per marker, and the deck is built from the
   markers, not from the store. */

const Bag = (() => {
  const SYSTEMS = {
    numbers: {title: 'numbers', cap: 100, label: i => String(i + 1)},
    letters: {title: 'letters', cap: 26,  label: i => String.fromCharCode(65 + i)},
  };
  /* the cycle. The first is called the person on the page and `character`
     in the store, because the store had that name before the page did and
     the pictures already in it answer to it. */
  const SLOTS = ['character', 'action', 'object'];
  const NAMES = {character: 'person', action: 'action', object: 'object'};
  const DEAL = 5;            // columns in a row

  let system = null;     // which set of labels is up, or null when closed
  /* the stack: the deals, in order, each {sys, i}. Card k is that number's
     slot k%3. It is not the row's selection — it outlives the row, the
     system and the page, so the stack you were building is there when you
     come back. Saved under `hq.bagseq`, an hq. key, so a snapshot carries
     it. `hq.bagsel` was the one held number before the stack was a
     sequence; it is read once, as a stack of one, and then let go. */
  const SEQ = 'hq.bagseq';
  let seq = [];
  try {
    seq = JSON.parse(localStorage.getItem(SEQ) || 'null');
    if (!Array.isArray(seq)){
      const old = JSON.parse(localStorage.getItem('hq.bagsel') || 'null');
      seq = old ? [old] : [];
    }
  } catch (e){ seq = []; }
  seq = seq.filter(d => d && SYSTEMS[d.sys] && d.i >= 0 && d.i < SYSTEMS[d.sys].cap);
  function saveSeq(){
    try { seq.length ? localStorage.setItem(SEQ, JSON.stringify(seq)) : localStorage.removeItem(SEQ); }
    catch (e){ note('could not save the stack — storage is full'); }
    try { localStorage.removeItem('hq.bagsel'); } catch (e){}
  }
  /* whether a row card is in the stack, as the row sees it */
  const dealt = i => seq.some(d => d.sys === system && d.i === i);
  let at = 1;            // the slider: which number is in view, 1-based
  let cur = 0;           // the keyboard's place in the row, 0..4; ←/→ move it
  let zone = 'row';      // where the keyboard is: the row of cards, or the switch above it
  let pending = null;    // the key the file picker was opened for

  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };
  /* a number's card for a slot. The store keeps one person, one action
     and one object per number; the stack only orders them. */
  const key = (sys, i, slot) => 'bag:' + sys + ':' + SYSTEMS[sys].label(i) + ':' + slot;
  const slotAt = k => SLOTS[k % SLOTS.length];
  const keyAt = k => key(seq[k].sys, seq[k].i, slotAt(k));

  /* ── the words ─────────────────────────────────────────────────────────
     Each card carries a word as well as a picture — the character's name,
     the verb, the thing. Words are small and there are at most a few
     hundred, so they live in one localStorage key, `hq.bag`, as a map from
     card key to text; being an `hq.` key it is carried by snapshot.py
     without that tool having to know it exists. */
  const WORDS = 'hq.bag';
  let words = null;
  function loadWords(){
    if (words) return words;
    try { words = JSON.parse(localStorage.getItem(WORDS) || '{}') || {}; }
    catch (e){ words = {}; }
    return words;
  }
  const word = k => (loadWords()[k] || '');
  function setWord(k, text){
    loadWords();
    text = (text || '').trim();
    if (text) words[k] = text; else delete words[k];
    try { localStorage.setItem(WORDS, JSON.stringify(words)); }
    catch (e){ note('could not save the word — storage is full'); }
  }

  /* a card is filled by a picture or a word; either is enough to move on */
  const filled = k => Loci.has(k) || !!word(k);
  const has = (sys, i, slot) => filled(key(sys, i, slot));
  const complete = (sys, i) => SLOTS.every(slot => has(sys, i, slot));

  const count = sys => {
    let c = 0;
    for (let i = 0; i < SYSTEMS[sys].cap; i++) for (const slot of SLOTS) if (has(sys, i, slot)) c++;
    return c;
  };

  /* the switch between the two systems */
  function sw(){
    const el = document.createElement('div');
    el.className = 'bagswitch';
    for (const [name, text] of [['numbers', '123'], ['letters', 'abc']]){
      const b = document.createElement('div');
      b.className = 'chip';
      b.dataset.system = name;
      b.textContent = text;
      b.addEventListener('click', () => open(name));
      el.append(b);
    }
    return el;
  }

  /* ── the stack ─────────────────────────────────────────────────────────
     Every deal, in order, each `STEP` below the last; the first card of
     each round of three stands off the one above it, so the stack reads
     as sentences and not as one run. Above it, the two things you can do
     to it: take the last card back, or clear it. */
  function stack(){
    const el = document.getElementById('bagstack');
    el.innerHTML = '';
    for (let k = 0; k < seq.length; k++){
      const c = card(seq[k].sys, seq[k].i, slotAt(k), true, keyAt(k));
      if (k && k % SLOTS.length === 0) c.classList.add('gap');
      el.append(c);
    }
  }
  function tools(){
    const el = document.createElement('div');
    el.className = 'bagtools';
    const u = document.createElement('div'), x = document.createElement('div');
    u.className = 'chip'; u.id = 'bagundo'; u.textContent = 'undo';
    x.className = 'chip'; x.id = 'bagclear'; x.textContent = 'clear';
    u.addEventListener('click', undo);
    x.addEventListener('click', clear);
    /* and the way out of the bag for a stack that is whole: save it as a
       mission (`src/missions.js`), which takes the cards and clears the
       stack for the next; `saved` is the page of them, any time */
    const sv = document.createElement('div'), ls = document.createElement('div');
    sv.className = 'chip'; sv.id = 'bagsave'; sv.textContent = 'save';
    ls.className = 'chip'; ls.id = 'bagsaved'; ls.textContent = 'saved';
    sv.addEventListener('click', saveStack);
    ls.addEventListener('click', () => Missions.show());
    el.append(u, x, sv, ls);
    return el;
  }
  function saveStack(){
    if (!Missions.whole(seq)){ note('a stack saves in rounds of three — person, action, object'); return false; }
    const m = Missions.add(seq);
    if (!m) return false;
    seq = [];
    saveSeq();
    render();
    Missions.show();
    return true;
  }
  /* a mission's cards, dealt back in as the stack — how a run is read */
  function load(cards){
    seq = (cards || []).filter(d => d && SYSTEMS[d.sys]).map(d => ({sys: d.sys, i: d.i}));
    saveSeq();
    if (!system) open('numbers'); else render();
    const el = document.getElementById('bagright');
    if (el) el.scrollTop = 0;
  }
  /* the stack is dealt from the row, and taken back from the top; there
     is no pulling a card out of the middle, because the middle is the
     order and the order is the point */
  function deal(sys, i){
    seq.push({sys, i});
    saveSeq();
    render();
  }
  function undo(){
    if (!seq.length) return false;
    seq.pop();
    saveSeq();
    if (system) render();
    return true;
  }
  function clear(){
    if (!seq.length) return false;
    seq = [];
    saveSeq();
    if (system) render();
    return true;
  }

  /* ── the slider ────────────────────────────────────────────────────────
     A track down the left rail with a thumb on it: drag the thumb, or press
     anywhere on the track, and the row of five holding that number comes
     up. Drawn here rather than as an <input type=range> because a native
     range is horizontal, and the ways of standing one on end are either
     deprecated or put the big number at the top. The thumb is a square,
     in flare, as every slider thumb in the tune panel is. */
  let track = null, thumb = null, readout = null;
  function slider(){
    const el = document.createElement('div');
    el.id = 'bagslide';
    readout = document.createElement('div');
    readout.className = 'bagat';
    track = document.createElement('div');
    track.className = 'bagtrack';
    thumb = document.createElement('div');
    thumb.className = 'bagthumb';
    track.append(thumb);
    /* and a button at each end, for one row at a time; the keyboard's
       arrows do the same through `step`, from game.js */
    const up = document.createElement('div'), down = document.createElement('div');
    up.className = 'chip bagstep'; up.innerHTML = '&#9650;';
    down.className = 'chip bagstep'; down.innerHTML = '&#9660;';
    up.addEventListener('click', () => step(-1));
    down.addEventListener('click', () => step(1));
    el.append(readout, up, track, down);
    const set = e => {
      const r = track.getBoundingClientRect();
      const cap = SYSTEMS[system].cap;
      const f = Math.min(1, Math.max(0, (e.clientY - r.top) / Math.max(1, r.height)));
      const v = 1 + Math.round(f * (cap - 1));
      if (v !== at){ at = v; cur = 0; render(); }
    };
    track.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      track.setPointerCapture(e.pointerId);
      set(e);
    });
    track.addEventListener('pointermove', e => { if (track.hasPointerCapture(e.pointerId)) set(e); });
    return el;
  }
  /* one row up or down — five numbers, up toward 1 at the top of the
     track — landing on the first of the row, so the readout says where
     the row starts */
  function step(d){
    if (!system) return false;
    /* the switch sits above the top row: one more press up from there
       reaches it, and one press down comes back */
    if (zone === 'switch'){
      if (d > 0){ zone = 'row'; render(); }
      return true;
    }
    if (d < 0 && first() === 0){ zone = 'switch'; render(); return true; }
    const v = Math.min(SYSTEMS[system].cap, Math.max(1, first() + 1 + d * DEAL));
    if (v === at) return true;
    at = v; cur = 0; render();
    return true;
  }
  /* ←/→ walk the highlight along the row; Enter opens the card under it,
     or folds it if it is the one already open */
  function move(d){
    if (!system) return false;
    if (zone === 'switch'){                  // ←/→ on the switch: the other system
      const other = system === 'numbers' ? 'letters' : 'numbers';
      open(other); zone = 'switch'; render();
      return true;
    }
    const n = Math.min(DEAL, SYSTEMS[system].cap - first());
    cur = Math.min(n - 1, Math.max(0, cur + d));
    render();
    return true;
  }
  function enter(){
    if (!system) return false;
    if (zone === 'switch') return move(1);
    deal(system, first() + cur);
    return true;
  }
  function placeThumb(){
    if (!thumb || !system) return;
    const cap = SYSTEMS[system].cap;
    thumb.style.top = ((at - 1) / (cap - 1) * 100) + '%';
    readout.textContent = SYSTEMS[system].label(at - 1);
  }
  /* the row in view: the five holding `at` */
  const first = () => Math.floor((at - 1) / DEAL) * DEAL;

  /* built once, on first use, the way the atlas builds its map: the page
     is a piece of markup that only matters once a ring has been pressed */
  function page(){
    let el = document.getElementById('bag');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'bag';
    el.className = 'glass';
    el.hidden = true;
    const head = document.createElement('div');
    head.className = 'phead';
    const title = document.createElement('span');
    title.innerHTML = 'The <b id="bagtitle"></b> <em id="bagcount"></em>';
    const x = document.createElement('button');
    x.className = 'btn';
    x.id = 'bagclose';
    x.innerHTML = '&#10005;';
    x.addEventListener('click', close);
    head.append(title, x);
    /* the middle: a rail, the row, a rail. The rails are the room left
       either side for what the page will grow — a slider on the left is
       the example given — and the right one already holds the switch
       between the two systems. */
    const mid = document.createElement('div');
    mid.id = 'bagmid';
    const left = document.createElement('div');
    left.className = 'bagrail';
    left.id = 'bagleft';
    left.append(sw(), slider());
    const row = document.createElement('div');
    row.id = 'bagrow';
    const right = document.createElement('div');
    right.className = 'bagrail';
    right.id = 'bagright';
    const stack = document.createElement('div');
    stack.id = 'bagstack';
    right.append(tools(), stack);
    mid.append(left, row, right);
    const foot = document.createElement('div');
    foot.className = 'knote';
    foot.id = 'bagnote';
    el.append(head, mid, foot);
    document.body.appendChild(el);
    wirePicker();
    return el;
  }

  /* the heading's font and tune, asked for at draw time: they are the
     town's dress, kept by Palace, and a bag that captured them would go
     stale the moment the menu moved */
  function dress(){
    if (typeof Palace === 'undefined' || !Palace.heading || typeof Title === 'undefined') return null;
    const h = Palace.heading();
    return h.font ? h : null;
  }
  function glyph(c, label){
    const h = dress();
    if (!h) return;
    /* Read COARSE on purpose — a card is a halftone, and the halftone is
       the point: fewer cells means bigger diamonds and the tone showing.
       And read in a box shared by the whole system (`ref`), so every
       letter is the same size on the same line as every other; a
       digit's box is the ten digits', a letter's the twenty-six. */
    const letter = /[A-Z]/.test(label);
    /* THE CARD RECIPE, settled by eye on 2026-08-26 with a tuning strip
       that has since gone: read at 44 cells for letters and 34 for digits — a letter's box is the widest swash capital's, so it takes more cells for the same ink, small flat diamonds — weight .65, tone and dither
       off — so a card is a plain stipple rather than a graded one, and
       the ink pushed hard (bright −48, contrast 108, sharpen 3, gamma 1)
       so a thin script still cuts. Different from the title's numbers on
       purpose: a title is a name on the plate, a card is a stamp. */
    const t = Object.assign({}, h.tune, {
      cols: letter ? 44 : 34,
      ref: letter ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : '0123456789',
      weight: 0.65, tone: 0, dither: 0,
      recipe: {bri: -48, con: 108, sharp: 3, gamma: 1}
    });
    const f = Title.face(label, h.font, t);
    if (!f){
      /* not here yet — draw the row again once it is, if the bag is still up */
      if (Title.state(h.font) === 'loading') Title.load(h.font, ok => { if (ok && system) render(); });
      return;
    }
    c.classList.add('glyph');
    if (letter) c.classList.add('letter');       // drawn a shade larger than a digit
    c.append(Title.svg(f, t));
  }

  function card(sys, i, slot, shown, k){
    k = k || key(sys, i, slot);
    const c = document.createElement('div');
    c.className = 'bagcard ' + slot;
    c.dataset.key = k;
    const tag = document.createElement('span');
    tag.className = 'bagtag';
    tag.textContent = shown ? NAMES[slot] + ' · ' + SYSTEMS[sys].label(i)
                            : SYSTEMS[sys].label(i);
    c.append(tag);
    /* A row card's label in the heading's face, as diamonds — the same
       face the town's name wears, so the bag and the plate say the same
       word the same way. The text stays in the tag underneath for the
       moment before the font lands and for whenever it cannot; the
       class is what hides it. A stack card keeps its small corner tag:
       there the picture is the card and the label is a caption. */
    if (!shown) glyph(c, SYSTEMS[sys].label(i));
    if (shown && Loci.has(k)){
      c.classList.add('face');
      /* the picture as lattice, not as a photograph: through the same
         tone pass as the locus preview and painted as diamonds into a
         canvas under the frame. The canvas is kept per key, because
         render() rebuilds the page on every deal and a picture read
         again on every deal is a stutter; `attach` drops it. */
      let cv = pics.get(k);
      if (!cv){
        cv = document.createElement('canvas');
        cv.className = 'bagpic';
        cv.width = 304; cv.height = 426;              // the card's 5:7, at 2×
        pics.set(k, cv);
        Loci.get(k).then(url => url && Title.picture(url, 56))
          .then(f => { if (f) Title.paint(cv, f, {weight: 1, shade: 0}); })
          .catch(e => note(e.message || String(e)));
      }
      c.append(cv);
    }
    if (!shown && complete(sys, i)) c.classList.add('done');
    if (shown){
      const w = document.createElement('input');
      w.type = 'text'; w.className = 'bagword'; w.spellcheck = false;
      w.placeholder = slot === 'character' ? 'who' : slot === 'action' ? 'does what' : 'to what';
      w.value = word(k);
      w.addEventListener('click', e => e.stopPropagation());
      w.addEventListener('input', () => setWord(k, w.value));
      /* the count in the head follows the word once it is done, not on
         every keystroke, or the field would jump under you */
      w.addEventListener('change', () => { if (system) render(); });
      w.addEventListener('keydown', e => { if (e.key === 'Enter') w.blur(); });
      c.append(w);
    }
    c.addEventListener('click', () => {
      if (!shown){                           // a row card: the press deals it
        cur = i - first();                   // the keyboard follows the pointer
        deal(sys, i);
        return;
      }
      pick(k);                               // a stack card asks for its picture
    });
    c.addEventListener('dragover', e => { e.preventDefault(); c.classList.add('over'); });
    c.addEventListener('dragleave', () => c.classList.remove('over'));
    c.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation();
      c.classList.remove('over');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) attach(k, f);
    });
    return c;
  }

  function render(){
    const el = page();
    el.hidden = !system;
    document.body.classList.toggle('bag', !!system);
    if (!system) return;
    const S = SYSTEMS[system];
    el.querySelector('#bagtitle').textContent = S.title;
    el.querySelector('#bagcount').textContent = count(system) + ' of ' + (S.cap * SLOTS.length);
    placeThumb();
    for (const b of el.querySelectorAll('.bagswitch .chip'))
      b.classList.toggle('sel', b.dataset.system === system);
    el.querySelector('.bagswitch').classList.toggle('cur', zone === 'switch');
    const row = el.querySelector('#bagrow');
    row.innerHTML = '';
    const f0 = first();
    for (let i = f0; i < Math.min(f0 + DEAL, S.cap); i++){
      const col = document.createElement('div');
      col.className = 'bagcol' + (dealt(i) ? ' sel' : '') + (zone === 'row' && i === f0 + cur ? ' cur' : '');
      col.append(card(system, i, 'character', false));
      row.append(col);
    }
    stack();
    el.querySelector('#bagundo').classList.toggle('off', !seq.length);
    el.querySelector('#bagclear').classList.toggle('off', !seq.length);
    el.querySelector('#bagsave').classList.toggle('off', !Missions.whole(seq));
    el.querySelector('#bagsaved').classList.toggle('off', !Missions.count());
    const next = NAMES[slotAt(seq.length)];
    el.querySelector('#bagnote').textContent =
      zone === 'switch' ? '←→ the other system · ↓ back to the cards · esc closes'
            : 'the next card dealt is ' + (next === 'action' ? 'an ' : 'a ') + next + ' · ←→ and enter deal a card · ↑↓ another row, ↑ past the top for the switch'
              + (seq.length ? ' · backspace takes the last card back · click a stack card for its picture, or drop one on it · type its word' : '')
              + (Missions.whole(seq) ? ' · save keeps it as a mission' : '')
              + ' · esc closes';
  }

  /* ── the picker ────────────────────────────────────────────────────────
     The same one input the loci use (`#lfile`), with a `pending` of this
     page's own: Loci's change listener sees its pending is null and does
     nothing, and this one does the same for a locus pick. */
  function pick(k){
    const el = document.getElementById('lfile');
    if (!el) return;
    pending = k;
    el.value = '';
    el.click();
  }
  function wirePicker(){
    const el = document.getElementById('lfile');
    if (!el) return;
    el.addEventListener('change', () => {
      const f = el.files && el.files[0], k = pending;
      pending = null;
      if (f && k) attach(k, f);
    });
  }
  const pics = new Map();                        // key → the painted canvas
  function attach(k, file){
    return Loci.attach({uid: k}, file).then(ok => {
      if (ok) pics.delete(k);                    // a new picture, read afresh
      if (ok && system) render();
      return ok;
    });
  }

  function open(name){
    if (!SYSTEMS[name]){ note('there is no ' + name + ' system'); return false; }
    if (system === name) return true;     // the switch pressed on the side already up
    system = name; at = 1; cur = 0; zone = 'row';
    render();
    return true;
  }
  /* Esc is back: off the switch first, then out of the page. It does not
     touch the stack — the stack stays until it is cleared. */
  function back(){
    if (!system) return false;
    if (zone === 'switch'){ zone = 'row'; render(); return true; }
    return close();
  }
  function close(){
    if (!system) return false;
    system = null; pending = null; zone = 'row';
    render();
    return true;
  }
  const opened = () => !!system;

  return {open, close, back, opened, step, move, enter, undo, clear, load, count, key, keyAt, word, setWord, filled,
          at: () => at, system: () => system, seq: () => seq.slice(), SYSTEMS, SLOTS};
})();
