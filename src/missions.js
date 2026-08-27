'use strict';
/* ── the missions ────────────────────────────────────────────────────────
   Where a finished stack goes.

   A stack in the bag is a working thing: dealt, undone, dealt again. Once
   it is whole — some rounds of person, action, object, and nothing left
   over — it can be SAVED, and a saved stack is a mission: the cards, held
   in their order, and around them what the bag never asks: what it is
   for (a birthday, an ID number, a workflow, a reminder), which palace it
   is walked in, a note of any length, and the count — when it was added,
   how many times it has been run through, and when last. The bag keeps
   the cards; this keeps the reason.

   It is a page over the bag, the way the bag is a page over the town, and
   `Esc` steps back one page at a time. Missions live under `hq.missions`
   — an hq. key, so `tools/snapshot.py` carries them without knowing
   they exist — and the cards in one are {sys, i} pairs exactly as the
   bag's stack holds them, so a mission is run by dealing it back into the
   bag. */

const Missions = (() => {
  const KEY = 'hq.missions';
  const PURPOSES = [['birthday', 'birthday'], ['id', 'ID number'], ['workflow', 'workflow'],
                    ['reminder', 'reminder'], ['other', 'other']];

  let list = null;
  let open = false;
  let focus = null;      // the id to put the caret in when the page is next drawn

  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };
  function load(){
    if (list) return list;
    try { list = JSON.parse(Store.get(KEY) || '[]') || []; } catch (e){ list = []; }
    if (!Array.isArray(list)) list = [];
    return list;
  }
  function save(){
    try { Store.set(KEY, JSON.stringify(list)); }
    catch (e){ note('could not save the missions — storage is full'); }
  }
  const day = iso => (iso ? iso.slice(0, 10) : '—');
  const now = () => new Date().toISOString();

  /* a stack is whole when it is rounds of three and at least one */
  const whole = cards => cards.length > 0 && cards.length % 3 === 0;

  function add(cards){
    if (!whole(cards)) return null;
    load();
    const m = {id: 'ms' + Date.now().toString(36), cards: cards.map(c => ({sys: c.sys, i: c.i})),
               purpose: 'other', title: '', palace: '', notes: '',
               added: now(), runs: 0, last: null};
    list.unshift(m);
    save();
    focus = m.id;
    return m;
  }
  function remove(id){
    load();
    list = list.filter(m => m.id !== id);
    save();
    render();
  }
  /* a run: counted, dated, and the cards dealt back into the bag to be
     walked; the bag is the one place a stack is read, so that is where
     running it goes */
  function run(id){
    const m = load().find(x => x.id === id);
    if (!m) return;
    m.runs = (m.runs | 0) + 1;
    m.last = now();
    save();
    close();
    if (typeof Bag !== 'undefined') Bag.load(m.cards);
  }

  const palaces = () => (G.markers || []).map(k =>
    ({uid: k.uid, name: k.name || (k.n ? 'place ' + k.n : 'a marker')}));

  /* ── the page ── */
  function page(){
    let el = document.getElementById('missions');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'missions';
    el.className = 'glass';
    el.hidden = true;
    const head = document.createElement('div');
    head.className = 'phead';
    const title = document.createElement('span');
    title.innerHTML = 'The <b>missions</b> <em id="mscount"></em>';
    const x = document.createElement('button');
    x.className = 'btn'; x.innerHTML = '&#10005;';
    x.addEventListener('click', close);
    head.append(title, x);
    const body = document.createElement('div');
    body.id = 'msbody';
    const foot = document.createElement('div');
    foot.className = 'knote';
    foot.textContent = 'a saved stack, and what it is for · run deals it back into the bag and counts the run · esc back to the bag';
    el.append(head, body, foot);
    document.body.appendChild(el);
    return el;
  }

  function field(label, input){
    const w = document.createElement('label');
    w.className = 'msfield';
    const l = document.createElement('span');
    l.textContent = label;
    w.append(l, input);
    return w;
  }

  function row(m){
    const el = document.createElement('div');
    el.className = 'mission';

    /* the cards, in their rounds */
    const strip = document.createElement('div');
    strip.className = 'msstrip';
    m.cards.forEach((c, k) => {
      const S = Bag.SYSTEMS[c.sys];
      if (!S) return;
      const slot = Bag.SLOTS[k % 3];
      const key = Bag.key(c.sys, c.i, slot);
      const t = document.createElement('div');
      t.className = 'mscard' + (k && k % 3 === 0 ? ' gap' : '');
      const tag = document.createElement('span');
      tag.className = 'mstag';
      tag.textContent = S.label(c.i);
      t.title = slot + ' · ' + S.label(c.i) + (Bag.word(key) ? ' · ' + Bag.word(key) : '');
      t.append(tag);
      if (Loci.has(key)){
        t.classList.add('face');
        Loci.get(key).then(u => { if (u && t.isConnected) t.style.backgroundImage = 'url("' + u + '")'; });
      }
      strip.append(t);
    });

    /* what it is for */
    const about = document.createElement('div');
    about.className = 'msabout';
    const chips = document.createElement('div');
    chips.className = 'mschips';
    for (const [id, text] of PURPOSES){
      const b = document.createElement('div');
      b.className = 'chip' + (m.purpose === id ? ' sel' : '');
      b.textContent = text;
      b.addEventListener('click', () => { m.purpose = id; save(); render(); });
      chips.append(b);
    }
    const title = document.createElement('input');
    title.type = 'text'; title.spellcheck = false; title.maxLength = 60;
    title.placeholder = 'what this one is';
    title.value = m.title || '';
    title.dataset.id = m.id;
    title.addEventListener('input', () => { m.title = title.value; save(); });
    const pal = document.createElement('select');
    const none = document.createElement('option');
    none.value = ''; none.textContent = 'no palace yet';
    pal.append(none);
    for (const p of palaces()){
      const o = document.createElement('option');
      o.value = p.uid; o.textContent = p.name;
      pal.append(o);
    }
    pal.value = m.palace || '';
    if (pal.value !== (m.palace || '')){     // the palace it names is gone from the town
      const o = document.createElement('option');
      o.value = m.palace; o.textContent = 'a palace no longer on the town';
      pal.append(o); pal.value = m.palace;
    }
    pal.addEventListener('change', () => { m.palace = pal.value; save(); });
    const notes = document.createElement('textarea');
    notes.spellcheck = false; notes.rows = 3;
    notes.placeholder = 'the details — the number itself, the date, the steps';
    notes.value = m.notes || '';
    notes.addEventListener('input', () => { m.notes = notes.value; save(); });
    about.append(chips, field('for', title), field('palace', pal), field('notes', notes));

    /* the count */
    const meta = document.createElement('div');
    meta.className = 'msmeta';
    const dl = document.createElement('dl');
    for (const [k, v] of [['added', day(m.added)], ['run through', String(m.runs | 0) + (m.runs === 1 ? ' time' : ' times')],
                          ['last run', day(m.last)], ['cards', String(m.cards.length) + ' · ' + (m.cards.length / 3) + ' round' + (m.cards.length === 3 ? '' : 's')]]){
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = k; dd.textContent = v;
      dl.append(dt, dd);
    }
    const acts = document.createElement('div');
    acts.className = 'msacts';
    const r = document.createElement('div'), d = document.createElement('div');
    r.className = 'chip'; r.textContent = 'run';
    d.className = 'chip'; d.textContent = 'delete';
    r.addEventListener('click', () => run(m.id));
    /* two presses, because a mission is the one thing on this page that
       cannot be dealt again from memory */
    d.addEventListener('click', () => {
      if (d.dataset.armed){ remove(m.id); return; }
      d.dataset.armed = '1'; d.textContent = 'sure?';
      setTimeout(() => { if (d.isConnected){ delete d.dataset.armed; d.textContent = 'delete'; } }, 2500);
    });
    acts.append(r, d);
    meta.append(dl, acts);

    el.append(strip, about, meta);
    return el;
  }

  function render(){
    const el = page();
    el.hidden = !open;
    document.body.classList.toggle('missions', open);
    if (!open) return;
    load();
    el.querySelector('#mscount').textContent = list.length ? String(list.length) : 'none yet';
    const body = el.querySelector('#msbody');
    body.innerHTML = '';
    if (!list.length){
      const e = document.createElement('div');
      e.className = 'msempty';
      e.textContent = 'nothing saved yet — deal a whole stack in the bag, rounds of three, and press save';
      body.append(e);
    }
    for (const m of list) body.append(row(m));
    if (focus){
      const t = body.querySelector('input[data-id="' + focus + '"]');
      if (t) t.focus();
      focus = null;
    }
  }

  function show(){ open = true; render(); return true; }
  function close(){
    if (!open) return false;
    open = false; render();
    return true;
  }
  const count = () => load().length;

  return {add, remove, run, show, close, count, whole, opened: () => open, list: () => load().slice()};
})();
