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

   Each label is a stack of cards, laid down the right rail the way a
   solitaire column is — each card a step below the last, so what shows of
   a covered card is its tag. The row card is the PERSON; select it and the
   stack opens beside the row: the person, then the ACTION, then the
   OBJECT, then a person again, and round — as many as you want, in that
   order and no other, one card at a time: the next appears once the last
   is filled. A card that is not selected shows its label and nothing
   else. Every card takes a picture — click it, or drop one on it — and the
   picture is its face from then on; and a word, typed on the card. That is the method the whole game is
   built on (a place, and a picture of what stands there), applied to a
   number: five columns of three is fifteen pictures. The page shows one
   row of five at a time, and the slider down the left is the way between
   rows — 1 at the top, 100 at the bottom (Z, for the letters).

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
  let sel = -1;          // the selected column, by index; -1 for none
  let at = 1;            // the slider: which number is in view, 1-based
  let cur = 0;           // the keyboard's place in the row, 0..4; ←/→ move it
  let zone = 'row';      // where the keyboard is: the row of cards, or the switch above it
  let pending = null;    // the key the file picker was opened for

  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };
  /* the k-th card in a stack: slot k%3 of cycle k/3. The first cycle's
     keys carry no number, so what was stored before there were cycles is
     the first cycle. */
  const key = (sys, i, slot, cyc) =>
    'bag:' + sys + ':' + SYSTEMS[sys].label(i) + ':' + slot + (cyc ? String(cyc + 1) : '');
  const keyAt = (sys, i, k) => key(sys, i, SLOTS[k % SLOTS.length], Math.floor(k / SLOTS.length));

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
     The open number's cards, each `STEP` below the last. Card k is shown
     if it is the first or the one before it is filled, so the stack is
     always exactly one card longer than what has been done — the next
     thing to fill, and never a blank run of them. */
  function stack(){
    const el = document.getElementById('bagstack');
    el.innerHTML = '';
    if (sel < 0) return;
    for (let k = 0; ; k++){
      if (k > 0 && !filled(keyAt(system, sel, k - 1))) break;
      const c = card(system, sel, SLOTS[k % SLOTS.length], true, keyAt(system, sel, k));
      el.append(c);
    }
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
      if (v !== at){ at = v; sel = -1; cur = 0; render(); }
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
    if (d < 0 && first() === 0){ zone = 'switch'; sel = -1; render(); return true; }
    const v = Math.min(SYSTEMS[system].cap, Math.max(1, first() + 1 + d * DEAL));
    if (v === at) return true;
    at = v; sel = -1; cur = 0; render();
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
    const i = first() + cur;
    select(sel === i ? -1 : i);
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
    right.append(stack);
    mid.append(left, row, right);
    const foot = document.createElement('div');
    foot.className = 'knote';
    foot.id = 'bagnote';
    el.append(head, mid, foot);
    document.body.appendChild(el);
    wirePicker();
    return el;
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
    if (shown && Loci.has(k)){
      c.classList.add('face');
      Loci.get(k).then(url => { if (url && c.isConnected) c.style.backgroundImage = 'url("' + url + '")'; });
    }
    if (!shown && complete(sys, i)) c.classList.add('done');
    if (shown){
      const w = document.createElement('input');
      w.type = 'text'; w.className = 'bagword'; w.spellcheck = false;
      w.placeholder = slot === 'character' ? 'who' : slot === 'action' ? 'does what' : 'to what';
      w.value = word(k);
      w.addEventListener('click', e => e.stopPropagation());
      w.addEventListener('input', () => setWord(k, w.value));
      /* the next card appears once this one is filled — after the word is
         done, not on every keystroke, or the field would jump under you */
      w.addEventListener('change', () => { if (system) render(); });
      w.addEventListener('keydown', e => { if (e.key === 'Enter') w.blur(); });
      c.append(w);
    }
    c.addEventListener('click', () => {
      if (!shown){                           // a row card: the press selects it
        cur = i - first();                   // the keyboard follows the pointer
        select(sel === i ? -1 : i);
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
      col.className = 'bagcol' + (i === sel ? ' sel' : '') + (zone === 'row' && i === f0 + cur ? ' cur' : '');
      col.append(card(system, i, 'character', false));
      row.append(col);
    }
    stack();
    el.querySelector('#bagnote').textContent =
      zone === 'switch' ? '←→ the other system · ↓ back to the cards · esc closes'
            : sel < 0 ? '←→ and enter pick a card · ↑↓ another row, ↑ past the top for the switch · esc closes'
              : S.label(sel) + ' · the stack: click a card for its picture, or drop one on it · type its word · esc folds it';
  }

  function select(i){ sel = i; render(); }

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
  function attach(k, file){
    return Loci.attach({uid: k}, file).then(ok => {
      if (ok && system) render();
      return ok;
    });
  }

  function open(name){
    if (!SYSTEMS[name]){ note('there is no ' + name + ' system'); return false; }
    if (system === name) return true;     // the switch pressed on the side already up
    system = name; sel = -1; at = 1; cur = 0; zone = 'row';
    render();
    return true;
  }
  /* Esc is back, one step: a selected column folds first, then the page */
  function back(){
    if (!system) return false;
    if (zone === 'switch'){ zone = 'row'; render(); return true; }
    if (sel >= 0){ select(-1); return true; }
    return close();
  }
  function close(){
    if (!system) return false;
    system = null; sel = -1; pending = null; zone = 'row';
    render();
    return true;
  }
  const opened = () => !!system;

  return {open, close, back, opened, step, move, enter, count, key, keyAt, word, setWord, filled, at: () => at,
          system: () => system, selected: () => sel, SYSTEMS, SLOTS};
})();
