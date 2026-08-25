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
   picture is its face from then on. That is the method the whole game is
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
  const has = (sys, i, slot) => Loci.has(key(sys, i, slot));
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
    const row = document.createElement('div');
    row.id = 'bagrow';
    const foot = document.createElement('div');
    foot.className = 'knote';
    foot.id = 'bagnote';
    el.append(head, row, foot);
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
    const row = el.querySelector('#bagrow');
    row.innerHTML = '';
    for (let i = 0; i < n; i++){
      const col = document.createElement('div');
      col.className = 'bagcol' + (i === sel ? ' sel' : '');
      col.append(card(system, i, 'character', i === sel));
      if (i === sel) for (const slot of SLOTS.slice(1)) col.append(card(system, i, slot, true));
      row.append(col);
    }
    el.querySelector('#bagnote').textContent =
      sel < 0 ? 'pick a card · esc closes'
              : S.label(sel) + ' · click a card for its picture, or drop one on it · esc folds it';
    if (sel >= 0){
      const c = row.children[sel];
      if (c && c.scrollIntoView) c.scrollIntoView({block: 'nearest'});
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

  return {open, close, back, opened, dealt, count, key,
          system: () => system, selected: () => sel, SYSTEMS, SLOTS};
})();
