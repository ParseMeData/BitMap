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

   Each label is a column of three cards: the CHARACTER, which is the card
   you see in the row; and beneath it, once it is selected, the ACTION and
   the OBJECT. A card that is not selected shows its label and nothing
   else. Every card takes a picture — click it, or drop one on it — and the
   picture is its face from then on; and a word, typed on the card. The
   column is dealt one card at a time: the action once the character is
   filled, the object once the action is. That is the method the whole game is
   built on (a place, and a picture of what stands there), applied to a
   number: five columns of three is fifteen pictures, and a system is
   dealt out five columns at a time. When the first five are complete the
   next five appear, and so on to the end of the alphabet.

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
  const SLOTS = ['character', 'action', 'object'];
  const DEAL = 5;            // columns shown at a time

  let system = null;     // which set of labels is up, or null when closed
  let sel = -1;          // the selected column, by index; -1 for none
  let pending = null;    // the key the file picker was opened for

  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };
  const key = (sys, i, slot) => 'bag:' + sys + ':' + SYSTEMS[sys].label(i) + ':' + slot;

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

  /* how many columns are dealt: five, plus five for every full set of five
     complete from the start — a gap in the first five holds the sixth back */
  function dealt(sys){
    const S = SYSTEMS[sys];
    let n = DEAL;
    while (n < S.cap){
      let all = true;
      for (let i = n - DEAL; i < n; i++) if (!complete(sys, i)){ all = false; break; }
      if (!all) break;
      n += DEAL;
    }
    return Math.min(n, S.cap);
  }
  const count = sys => {
    let c = 0;
    for (let i = 0; i < SYSTEMS[sys].cap; i++) for (const slot of SLOTS) if (has(sys, i, slot)) c++;
    return c;
  };

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
    const row = document.createElement('div');
    row.id = 'bagrow';
    const right = document.createElement('div');
    right.className = 'bagrail';
    right.id = 'bagright';
    const sw = document.createElement('div');
    sw.className = 'bagswitch';
    for (const [name, text] of [['numbers', '123'], ['letters', 'abc']]){
      const b = document.createElement('div');
      b.className = 'chip';
      b.dataset.system = name;
      b.textContent = text;
      b.addEventListener('click', () => open(name));
      sw.append(b);
    }
    right.append(sw);
    mid.append(left, row, right);
    const foot = document.createElement('div');
    foot.className = 'knote';
    foot.id = 'bagnote';
    el.append(head, mid, foot);
    document.body.appendChild(el);
    wirePicker();
    return el;
  }

  function card(sys, i, slot, shown){
    const k = key(sys, i, slot);
    const c = document.createElement('div');
    c.className = 'bagcard ' + slot;
    c.dataset.key = k;
    const tag = document.createElement('span');
    tag.className = 'bagtag';
    tag.textContent = slot === 'character' ? SYSTEMS[sys].label(i) : slot;
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
      if (sel !== i){ select(i); return; }   // a press on a folded column opens it
      pick(k);                               // and on an open one, asks for the picture
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
    const S = SYSTEMS[system], n = dealt(system);
    el.querySelector('#bagtitle').textContent = S.title;
    el.querySelector('#bagcount').textContent = count(system) + ' of ' + (n * SLOTS.length);
    for (const b of el.querySelectorAll('.bagswitch .chip'))
      b.classList.toggle('sel', b.dataset.system === system);
    const row = el.querySelector('#bagrow');
    row.innerHTML = '';
    for (let i = 0; i < n; i++){
      const col = document.createElement('div');
      col.className = 'bagcol' + (i === sel ? ' sel' : '');
      col.append(card(system, i, 'character', i === sel));
      /* an open column deals one card at a time: the action once the
         character is filled, the object once the action is */
      if (i === sel)
        for (let j = 1; j < SLOTS.length && has(system, i, SLOTS[j - 1]); j++)
          col.append(card(system, i, SLOTS[j], true));
      row.append(col);
    }
    el.querySelector('#bagnote').textContent =
      sel < 0 ? 'pick a card · esc closes'
              : S.label(sel) + ' · click a card for its picture, or drop one on it · type its word · esc folds it';
    if (sel >= 0){
      const c = row.children[sel];
      if (c && c.scrollIntoView) c.scrollIntoView({block: 'start'});
    }
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
    system = name; sel = -1;
    render();
    return true;
  }
  /* Esc is back, one step: a selected column folds first, then the page */
  function back(){
    if (!system) return false;
    if (sel >= 0){ select(-1); return true; }
    return close();
  }
  function close(){
    if (!system) return false;
    system = null; sel = -1; pending = null;
    render();
    return true;
  }
  const opened = () => !!system;

  return {open, close, back, opened, dealt, count, key, word, setWord, filled,
          system: () => system, selected: () => sel, SYSTEMS, SLOTS};
})();
