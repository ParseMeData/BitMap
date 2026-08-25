'use strict';
/* ── the bag ────────────────────────────────────────────────────────────
   One page, two systems.

   The HUD's left ring is `123` and its top ring is `abc`, and they open the
   same thing: a row of five cards. What differs is the set of labels on
   them — `1 2 3 4 5` for the number system, `A B C D E` for the letter
   system — and nothing else, so there is one page here with a `system`
   name on it rather than two pages that would drift apart. `SYSTEMS` is the
   whole of the difference, and adding a sixth card to both is one edit.

   It is a page, not a panel: it covers the plate, and the plate's own
   chrome steps out of the way while it is up (`body.bag`, in index.html),
   the same way `body.locus` clears the screen for a picture. It is still
   the game — the walker is where you left them, Esc or the ✕ puts the town
   back exactly as it was — so it is opened through the HUD's seams
   (`Hud.onNumbers`, `Hud.onLetters`, filled in game.js) rather than by
   loading anything.

   A card that is not selected shows its label and nothing else. That is
   deliberate, and it is the whole of what a card is for now: what a
   selected card unfolds into — a character, an action, an object, each
   its own card in the column below — is the next piece, and this file is
   where it goes. */

const Bag = (() => {
  const SYSTEMS = {
    numbers: {title: 'numbers', labels: ['1', '2', '3', '4', '5']},
    letters: {title: 'letters', labels: ['A', 'B', 'C', 'D', 'E']},
  };

  let system = null;     // which set of labels is up, or null when closed
  let sel = -1;          // the selected card, by index; -1 for none

  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };

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
    title.innerHTML = 'The <b id="bagtitle"></b>';
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
    return el;
  }

  function render(){
    const el = page();
    el.hidden = !system;
    document.body.classList.toggle('bag', !!system);
    if (!system) return;
    const S = SYSTEMS[system];
    el.querySelector('#bagtitle').textContent = S.title;
    const row = el.querySelector('#bagrow');
    row.innerHTML = '';
    S.labels.forEach((label, i) => {
      const col = document.createElement('div');
      col.className = 'bagcol';
      const card = document.createElement('div');
      card.className = 'bagcard' + (i === sel ? ' sel' : '');
      card.textContent = label;
      card.addEventListener('click', () => select(i === sel ? -1 : i));
      col.append(card);
      row.append(col);
    });
    el.querySelector('#bagnote').textContent =
      sel < 0 ? 'pick a card · esc closes' : S.labels[sel] + ' · click again to put it back';
  }

  function select(i){ sel = i; render(); }

  function open(name){
    if (!SYSTEMS[name]){ note('there is no ' + name + ' system'); return false; }
    system = name; sel = -1;
    render();
    return true;
  }
  function close(){
    if (!system) return false;
    system = null; sel = -1;
    render();
    return true;
  }
  const opened = () => !!system;

  return {open, close, opened, system: () => system, selected: () => sel, SYSTEMS};
})();
