'use strict';
/* ── the journal ────────────────────────────────────────────────────────
   A second way in beside the hub: a page of tabs, each tab a few sub-tabs,
   each sub-tab a set of rows of letters — acronyms — and behind every
   letter what it stands for, a description, and a list of items.

   It is a page like the bag: one glass pane over the plate, the chrome
   cleared under it, Esc the way out.

   The frame — tabs, sub-tabs, acronyms — used to be written here in code,
   and a tab renamed kept nothing, because a note's key was the path to
   its letter. Now the frame is data, kept with the notes, and every
   letter carries an id of its own: rename a tab, move an acronym, and
   the notes come along. `DEFAULT` below is only what a journal starts
   as. Press **Edit** and every label is a field: type to rename, ‹ › and
   ▲ ▼ to move, ✕ to remove, + to add. Leaving edit mode is what saves. */

const Journal = (() => {
  const $ = s => document.querySelector(s);
  const DEFAULT = [
    {label: 'Quest', subs: [
      {name: 'Projects',  rows: [{letters: 'PLAN', blurb: 'Ideas on the table'}, {letters: 'DOING', blurb: 'In motion'}, {letters: 'DONE', blurb: 'Finished'}]},
      {name: 'Birthdays', rows: [{letters: 'GIFT', blurb: 'Presents to find'}, {letters: 'CARD', blurb: 'Notes to write'}]},
      {name: 'Greek',     rows: [{letters: 'WORDS', blurb: 'Vocabulary'}, {letters: 'VERBS', blurb: 'Grammar'}]},
      {name: 'French',    rows: [{letters: 'WORDS', blurb: 'Vocabulary'}, {letters: 'VERBS', blurb: 'Grammar'}]}
    ]},
    {label: 'Skills', subs: [
      {name: 'Music',   rows: [{letters: 'RAITS', blurb: 'Practice routine'}, {letters: 'BBITE', blurb: 'Writing & recording'}]},
      {name: 'Ukulele', rows: [{letters: 'SGPS', blurb: ''}, {letters: 'RAWR', blurb: ''}, {letters: 'BIOD', blurb: ''}]}
    ]},
    {label: 'Health', subs: [
      {name: 'Body', rows: [{letters: 'SLEEP', blurb: 'Rest & recovery'}, {letters: 'MOVE', blurb: 'Exercise'}]},
      {name: 'Mind', rows: [{letters: 'CALM', blurb: 'Headspace'}]}
    ]},
    {label: 'Equip', subs: [
      {name: 'Web', rows: [{letters: 'SITES', blurb: 'Things to build'}, {letters: 'TOOLS', blurb: 'Stack & setup'}]}
    ]},
    {label: 'Status', subs: [
      {name: 'Gov',            rows: [{letters: 'FORMS', blurb: 'Paperwork'}, {letters: 'DATES', blurb: 'Deadlines'}]},
      {name: 'Maths',          rows: [{letters: 'ADD', blurb: 'Arithmetic'}, {letters: 'ALG', blurb: 'Algebra'}]},
      {name: 'Spelling',       rows: [{letters: 'WORDS', blurb: 'Tricky spellings'}]},
      {name: 'Grammar',        rows: [{letters: 'RULES', blurb: 'Structure & usage'}]},
      {name: 'Politics',       rows: [{letters: 'PARTY', blurb: 'Who stands where'}, {letters: 'LAW', blurb: 'Bills & rulings'}]},
      {name: 'Economics',      rows: [{letters: 'MONEY', blurb: 'Rates, prices, wages'}, {letters: 'TRADE', blurb: 'Markets & supply'}]},
      {name: 'Talking points', rows: [{letters: 'TOPIC', blurb: 'What to raise'}, {letters: 'CLAIM', blurb: 'What to say, and the evidence'}]}
    ]}
  ];

  /* ── what is kept ──────────────────────────────────────────────────────
     `hq.journal` is {frame, notes}. `frame` is the tabs, each with an id;
     each sub-tab with an id; each acronym row with its letters, a blurb,
     and one id per letter. `notes` is {letter id: {word, note, items}}.

     Before v7.8 the key was a flat map of "Tab/Sub/row/col" → {word,
     note}, and the frame was code. A journal in that shape is read once
     into the new one: the frame is seeded from DEFAULT and each note is
     carried to the id of the letter at its path, if that letter still
     exists. Self-describing — no `frame` means old — so no ladder step. */
  const KEY = 'hq.journal';
  let J = null;
  const mint = () => 'j' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  const seedRow = r => ({id: mint(), letters: r.letters, blurb: r.blurb || '', ids: [...r.letters].map(mint)});
  const seedSub = s => ({id: mint(), name: s.name, rows: s.rows.map(seedRow)});
  const seedTab = t => ({id: mint(), label: t.label, subs: t.subs.map(seedSub)});
  function load(){
    if (J) return J;
    const raw = Store.json(KEY, {}) || {};
    if (raw.frame && Array.isArray(raw.frame)){ J = {frame: raw.frame, notes: raw.notes || {}, focus: raw.focus || null}; return J; }
    J = {frame: DEFAULT.map(seedTab), notes: {}};
    let carried = 0;
    for (const k in raw){
      const m = /^([^/]+)\/([^/]+)\/(\d+)\/(\d+)$/.exec(k);
      if (!m) continue;
      const tab = J.frame.find(t => t.label === m[1]); if (!tab) continue;
      const sub = tab.subs.find(s => s.name === m[2]); if (!sub) continue;
      const row = sub.rows[+m[3]]; if (!row) continue;
      const id = row.ids[+m[4]]; if (!id) continue;
      const v = raw[k] || {};
      J.notes[id] = {word: v.word || '', note: v.note || '', items: []};
      carried++;
    }
    store();
    if (carried) note(carried + ' journal notes carried to the new frame');
    return J;
  }
  function store(){
    try {
      Store.set(KEY, JSON.stringify(load()));
      if (typeof hqStoreOK === 'function') hqStoreOK('the journal');
    } catch (e){ if (typeof hqStoreFail === 'function') hqStoreFail('the journal', e); }
  }
  const noteOf = id => load().notes[id] || (load().notes[id] = {word: '', note: '', items: []});
  /* ── the focus ────────────────────────────────────────────────────────
     One acronym, chosen with the ◆ beside its row, stood up on the plate
     by `src/focus.js`. Kept as the row's id in `hq.journal.focus`; what
     the column shows is read back through `focused()` — letters, each
     letter's word and items — so it is never a second copy. */
  function rowById(id){
    for (const t of load().frame) for (const s of t.subs) for (const r of s.rows) if (r.id === id) return {t, s, r};
    return null;
  }
  function setFocus(id){
    const J = load();
    J.focus = J.focus === id ? null : id;
    store(); render();
  }
  function focused(){
    const J = load();
    const hit = J.focus && rowById(J.focus);
    if (!hit) return null;
    const r = hit.r;
    return {id: r.id, letters: [...r.letters], ids: r.ids.slice(), blurb: r.blurb,
            tab: hit.t.label, sub: hit.s.name,
            words: r.ids.map(id => (J.notes[id] || {}).word || ''),
            items: r.ids.map(id => ((J.notes[id] || {}).items || []).slice())};
  }
  /* the page opened on one letter, from the focus column */
  function openAt(id){
    const J = load();
    J.frame.forEach((t, ti) => t.subs.forEach((s, si) => s.rows.forEach(r => { if (r.ids.includes(id)){ active = ti; sub = si; sel = id; } })));
    editing = false;
    if (!open){ open = true; }
    render();
    const w = el && el.querySelector('#jword'); if (w) w.focus();
  }
  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const filled = id => { const n = load().notes[id]; return !!n && !!((n.word || '') + (n.note || '') + (n.items || []).join('')).trim(); };

  let open = false, editing = false, active = 0, sub = 0, sel = null;   // sel = letter id
  let el = null;

  function page(){
    if (el) return el;
    el = document.createElement('div');
    el.id = 'journal'; el.className = 'glass'; el.hidden = true;
    el.innerHTML =
      '<div class="phead"><span>The <b>journal</b></span>' +
      '<button class="btn" id="jedit">Edit</button>' +
      '<button class="btn" id="jx">&#10005;</button></div>' +
      '<div class="jtabs" id="jtabs"></div>' +
      '<div class="jwin" id="jwin"></div>' +
      '<div class="knote" id="jnote-k"></div>';
    document.body.append(el);
    el.querySelector('#jx').addEventListener('click', close);
    el.querySelector('#jedit').addEventListener('click', () => setEdit(!editing));
    return el;
  }
  const clamp = () => {
    const F = load().frame;
    active = Math.max(0, Math.min(active, F.length - 1));
    const t = F[active];
    sub = t ? Math.max(0, Math.min(sub, t.subs.length - 1)) : 0;
  };

  /* ── editing the frame ─────────────────────────────────────────────────
     Each of these changes the frame in memory and re-renders; the frame
     is written when edit mode is left, or the page closed. Removing a
     tab or sub-tab with notes in it asks once, in the banner's words,
     by needing a second press. */
  const swap = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return false; [arr[i], arr[j]] = [arr[j], arr[i]]; return true; };
  const notesIn = tab => { let n = 0; for (const s of (tab.subs || [tab])) for (const r of s.rows) for (const id of r.ids) if (filled(id)) n++; return n; };
  let arm = null;                          // {what, id}: the thing a second ✕ removes
  function remove(kind, list, i, thing){
    const n = kind === 'row' ? thing.ids.filter(filled).length : notesIn(thing);
    if (n && !(arm && arm.id === thing.id)){
      arm = {id: thing.id};
      note('that ' + kind + ' holds ' + n + ' note' + (n === 1 ? '' : 's') + ' — press ✕ again to remove it');
      return;
    }
    arm = null;
    list.splice(i, 1);
    if (kind === 'tab') active = Math.min(active, list.length - 1);
    if (kind === 'sub') sub = Math.min(sub, list.length - 1);
    sel = null;
    render();
  }
  /* letters change under the same row: ids follow their column, so the
     note at column 2 stays at column 2; new columns are minted */
  function reletter(row, v){
    const s = v.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!s) return;
    row.letters = s;
    row.ids = [...s].map((_, i) => row.ids[i] || mint());
  }

  function setEdit(v){
    editing = !!v; arm = null; sel = null;
    if (!editing) store();
    render();
  }

  /* ── the page ─────────────────────────────────────────────────────── */
  function render(){
    const el = page();
    el.hidden = !open;
    document.body.classList.toggle('journal', open);
    if (!open) return;
    clamp();
    const F = load().frame, s = F[active], t = s && s.subs[sub];
    el.classList.toggle('editing', editing);
    el.querySelector('#jedit').textContent = editing ? 'Done' : 'Edit';
    el.querySelector('#jedit').classList.toggle('sel', editing);
    el.querySelector('#jnote-k').textContent = editing
      ? 'type to rename · ‹ › and ▲ ▼ move · ✕ removes (twice, if it holds notes) · + adds · Done keeps it'
      : 'tabs hold sub-tabs, sub-tabs hold rows of letters, every letter holds a description and a list · ← → change the tab · Esc closes';

    /* tabs */
    const tools = (kind, i, n) => editing ? '<span class="jtools">' +
      '<button data-act="left" data-kind="' + kind + '" data-i="' + i + '"' + (i === 0 ? ' disabled' : '') + '>&#8249;</button>' +
      '<button data-act="right" data-kind="' + kind + '" data-i="' + i + '"' + (i === n - 1 ? ' disabled' : '') + '>&#8250;</button>' +
      '<button data-act="remove" data-kind="' + kind + '" data-i="' + i + '">&#10005;</button></span>' : '';
    el.querySelector('#jtabs').innerHTML = F.map((x, i) =>
      '<div class="chip' + (i === active ? ' sel' : '') + '" data-i="' + i + '">' +
        (editing ? '<input class="jname" data-kind="tab" data-i="' + i + '" value="' + esc(x.label) + '" spellcheck="false">' + tools('tab', i, F.length)
                 : esc(x.label)) + '</div>').join('') +
      (editing ? '<div class="chip jadd" data-act="add" data-kind="tab">+ tab</div>' : '');

    const win = el.querySelector('#jwin');
    if (!s){
      win.innerHTML = '<div class="jempty">no tabs — press Edit and + tab</div>';
      return;
    }
    const nsel = sel ? noteOf(sel) : null;
    let selLetter = '', selRow = null;
    if (t) for (const r of t.rows){ const i = r.ids.indexOf(sel); if (i >= 0){ selLetter = r.letters[i]; selRow = r; } }
    win.innerHTML =
      '<div class="jcol">' +
        '<div class="jsubs">' + s.subs.map((x, i) =>
          '<div class="chip' + (i === sub ? ' sel' : '') + '" data-i="' + i + '">' +
            (editing ? '<input class="jname" data-kind="sub" data-i="' + i + '" value="' + esc(x.name) + '" spellcheck="false">' + tools('sub', i, s.subs.length)
                     : esc(x.name)) + '</div>').join('') +
          (editing ? '<div class="chip jadd" data-act="add" data-kind="sub">+ sub-tab</div>' : '') + '</div>' +
        (t ? '<div class="plabel">' + esc(t.name) + '</div>' +
        '<div class="jgrid">' + t.rows.map((r, ri) =>
          '<div class="jblock"><div class="jrow">' + [...r.letters].map((ch, ci) =>
            '<button class="jletter' + (sel === r.ids[ci] ? ' sel' : '') + (filled(r.ids[ci]) ? ' has' : '') +
            '" data-id="' + r.ids[ci] + '">' + esc(ch) + '</button>').join('') +
          '</div>' +
          (editing ?
            '<div class="jredit">' +
              '<input class="jname jletters" data-kind="letters" data-i="' + ri + '" value="' + esc(r.letters) + '" spellcheck="false" placeholder="LETTERS">' +
              '<input class="jname" data-kind="blurb" data-i="' + ri + '" value="' + esc(r.blurb) + '" spellcheck="false" placeholder="what this acronym is for">' +
              '<span class="jtools">' +
                '<button data-act="up" data-kind="row" data-i="' + ri + '"' + (ri === 0 ? ' disabled' : '') + '>&#9650;</button>' +
                '<button data-act="down" data-kind="row" data-i="' + ri + '"' + (ri === t.rows.length - 1 ? ' disabled' : '') + '>&#9660;</button>' +
                '<button data-act="remove" data-kind="row" data-i="' + ri + '">&#10005;</button></span>' +
            '</div>'
            : '<div class="jblurb"><button class="jfocus' + (load().focus === r.id ? ' on' : '') + '" data-focus="' + r.id + '" title="stand this acronym on the plate">&#9670; focus</button>' + esc(r.blurb) + '</div>') +
          '</div>').join('') +
          (editing ? '<div class="jblock jaddrow"><input class="jname jletters" id="jnewrow" spellcheck="false" placeholder="+ ACRONYM, then Enter"></div>' : '') +
        '</div>' : '<div class="jempty">no sub-tabs — press Edit and + sub-tab</div>') +
      '</div>' +
      '<div class="jcol jright">' +
        '<div class="plabel">' + (sel ? 'Letter' : 'Description') + '</div>' +
        '<div class="jdetail">' + (sel ?
          '<div class="jtop"><div class="jbig">' + esc(selLetter) + '</div><div>' +
            '<input id="jword" type="text" spellcheck="false" placeholder="' + esc(selLetter) + ' stands for" value="' + esc(nsel.word) + '">' +
            '<div class="jfrom">' + esc(t.name) + ' · ' + esc(selRow.blurb || [...selRow.letters].join('.')) + '</div>' +
          '</div></div>' +
          '<div class="plabel">Description</div>' +
          '<textarea id="jnote" spellcheck="false" placeholder="A summary of what this letter holds…">' + esc(nsel.note) + '</textarea>' +
          '<div class="plabel">Items <b>' + (nsel.items || []).length + '</b></div>' +
          '<div class="jitems" id="jitems">' + (nsel.items || []).map((it, i) =>
            '<div class="jitem"><span class="jn">' + (i + 1) + '</span><input class="jitext" data-i="' + i + '" value="' + esc(it) + '" spellcheck="false">' +
            '<span class="jtools"><button data-act="iup" data-i="' + i + '"' + (i === 0 ? ' disabled' : '') + '>&#9650;</button>' +
            '<button data-act="idown" data-i="' + i + '"' + (i === nsel.items.length - 1 ? ' disabled' : '') + '>&#9660;</button>' +
            '<button data-act="iremove" data-i="' + i + '">&#10005;</button></span></div>').join('') +
            '<div class="jitem jinew"><span class="jn">+</span><input id="jnewitem" spellcheck="false" placeholder="add an item, then Enter"></div>' +
          '</div>'
          : '<div class="jempty">pick a letter</div>') +
        '</div>' +
      '</div>';
    wire(win, s, t, nsel);
  }

  function wire(win, s, t, nsel){
    const F = load().frame;
    const stop = e => { if (e.key !== 'Escape') e.stopPropagation(); };
    /* tabs and sub-tabs: a press picks, unless it landed on a field or a tool */
    el.querySelector('#jtabs').onclick = e => {
      if (e.target.closest('.jtools, input')) return;
      const add = e.target.closest('[data-act="add"]');
      if (add){ F.push({id: mint(), label: 'Tab', subs: []}); active = F.length - 1; sub = 0; render(); focusName('tab', active); return; }
      const c = e.target.closest('.chip');
      if (c && c.dataset.i != null){ active = +c.dataset.i; sub = 0; sel = null; render(); }
    };
    win.querySelector('.jsubs').onclick = e => {
      if (e.target.closest('.jtools, input')) return;
      const add = e.target.closest('[data-act="add"]');
      if (add){ s.subs.push({id: mint(), name: 'Sub-tab', rows: []}); sub = s.subs.length - 1; sel = null; render(); focusName('sub', sub); return; }
      const c = e.target.closest('.chip');
      if (c && c.dataset.i != null){ sub = +c.dataset.i; sel = null; render(); }
    };
    const grid = win.querySelector('.jgrid');
    if (grid) grid.onclick = e => {
      if (e.target.closest('.jtools, input')) return;
      const f = e.target.closest('.jfocus');
      if (f){ setFocus(f.dataset.focus); return; }
      const b = e.target.closest('.jletter');
      if (b){ sel = b.dataset.id; render(); const w = el.querySelector('#jword'); if (w) w.focus(); }
    };
    /* the tools: move and remove, on whichever list the button names */
    el.onclick = e => {
      const b = e.target.closest('.jtools button'); if (!b || b.disabled) return;
      e.stopPropagation();
      const act = b.dataset.act, kind = b.dataset.kind, i = +b.dataset.i;
      if (kind === 'tab'){ if (act === 'remove') return remove('tab', F, i, F[i]); if (swap(F, i, act === 'left' ? -1 : 1)) active = i + (act === 'left' ? -1 : 1); }
      else if (kind === 'sub'){ if (act === 'remove') return remove('sub', s.subs, i, s.subs[i]); if (swap(s.subs, i, act === 'left' ? -1 : 1)) sub = i + (act === 'left' ? -1 : 1); }
      else if (kind === 'row'){ if (act === 'remove') return remove('row', t.rows, i, t.rows[i]); swap(t.rows, i, act === 'up' ? -1 : 1); }
      else if (act === 'iremove'){ nsel.items.splice(i, 1); store(); }
      else if (act === 'iup' || act === 'idown'){ swap(nsel.items, i, act === 'iup' ? -1 : 1); store(); }
      render();
    };
    /* the fields: a name changes on change, not per keystroke */
    for (const inp of win.querySelectorAll('.jname, #jnewrow')) inp.addEventListener('keydown', stop);
    for (const inp of el.querySelectorAll('#jtabs .jname')) inp.addEventListener('keydown', stop);
    el.querySelectorAll('.jname[data-kind]').forEach(inp => {
      inp.addEventListener('change', () => {
        const i = +inp.dataset.i, v = inp.value;
        if (inp.dataset.kind === 'tab') F[i].label = v.trim() || F[i].label;
        else if (inp.dataset.kind === 'sub') s.subs[i].name = v.trim() || s.subs[i].name;
        else if (inp.dataset.kind === 'letters') reletter(t.rows[i], v);
        else if (inp.dataset.kind === 'blurb') t.rows[i].blurb = v.trim();
        render();
      });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
    });
    const nr = win.querySelector('#jnewrow');
    if (nr) nr.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const v = nr.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!v) return;
      t.rows.push({id: mint(), letters: v, blurb: '', ids: [...v].map(mint)});
      render();
      const again = el.querySelector('#jnewrow'); if (again) again.focus();
    });
    if (sel){
      const w = win.querySelector('#jword'), x = win.querySelector('#jnote');
      w.addEventListener('input', () => { nsel.word = w.value; });
      x.addEventListener('input', () => { nsel.note = x.value; });
      w.addEventListener('change', store); x.addEventListener('change', store);
      w.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') x.focus(); });
      x.addEventListener('keydown', stop);
      win.querySelectorAll('.jitext').forEach(inp => {
        inp.addEventListener('keydown', e => { stop(e); if (e.key === 'Enter') inp.blur(); });
        inp.addEventListener('change', () => { const i = +inp.dataset.i; const v = inp.value.trim(); if (v) nsel.items[i] = v; else nsel.items.splice(i, 1); store(); render(); });
      });
      const ni = win.querySelector('#jnewitem');
      ni.addEventListener('keydown', e => {
        stop(e);
        if (e.key !== 'Enter') return;
        const v = ni.value.trim(); if (!v) return;
        (nsel.items || (nsel.items = [])).push(v); store(); render();
        const again = el.querySelector('#jnewitem'); if (again) again.focus();
      });
    }
  }
  function focusName(kind, i){
    const f = el.querySelector('.jname[data-kind="' + kind + '"][data-i="' + i + '"]');
    if (f){ f.focus(); f.select(); }
  }

  function show(){
    if (open) return true;
    open = true; render();
    return true;
  }
  function close(){
    if (!open) return false;
    if (editing){ editing = false; }
    store();
    open = false; render();
    return true;
  }
  /* ← → walk the tabs while the page is up and nothing is being typed */
  function move(d){
    if (!open) return false;
    const n = load().frame.length; if (!n) return true;
    active = ((active + d) % n + n) % n;
    sub = 0; sel = null; render();
    return true;
  }
  const count = () => { let c = 0; for (const id in load().notes) if (filled(id)) c++; return c; };

  return {open: show, close, move, opened: () => open, editing: () => editing, setEdit, count,
          frame: () => load().frame, focused, setFocus, openAt};
})();
