'use strict';
/* ── the journal ────────────────────────────────────────────────────────
   A second way in beside the hub: a page of tabs, each tab a few sub-tabs,
   each sub-tab a set of rows of letters — acronyms — and a note behind
   every letter, what it stands for and what you have to say about it.

   It is a page like the bag: one glass pane over the plate, the chrome
   cleared under it, Esc the way out. The structure — the tabs and their
   letters — is written here, in `SECTIONS`, because it is the frame of
   the thing and not what you type into it; adding a tab is adding a row.
   What you type is kept in `hq.journal`, one entry per letter under a key
   that says where it is, so a tab renamed here keeps nothing and a letter
   moved keeps nothing — the same trade the bag's cards make, and for the
   same reason: a key that names a place is a key you can read. */

const Journal = (() => {
  const $ = s => document.querySelector(s);
  const SECTIONS = [
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
      {name: 'Gov',      rows: [{letters: 'FORMS', blurb: 'Paperwork'}, {letters: 'DATES', blurb: 'Deadlines'}]},
      {name: 'Maths',    rows: [{letters: 'ADD', blurb: 'Arithmetic'}, {letters: 'ALG', blurb: 'Algebra'}]},
      {name: 'Spelling', rows: [{letters: 'WORDS', blurb: 'Tricky spellings'}]},
      {name: 'Grammar',  rows: [{letters: 'RULES', blurb: 'Structure & usage'}]}
    ]}
  ];

  /* ── what is kept ──────────────────────────────────────────────────────
     `hq.journal` is {key: {word, note}}, the key "Skills/Music/1/3" —
     tab, sub-tab, row, column. Written on `change` rather than every
     keystroke: a note is typed in sentences, and a save per letter is the
     sixty-a-second the HANDOFF warns about, in slower motion. The latch
     phrase is its own so a journal that cannot be saved does not silence
     the town. */
  const KEY = 'hq.journal';
  let notes = null;
  function load(){
    if (notes) return notes;
    try { notes = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e){ notes = {}; }
    return notes;
  }
  function store(){
    try {
      localStorage.setItem(KEY, JSON.stringify(load()));
      if (typeof hqStoreOK === 'function') hqStoreOK('the journal');
    } catch (e){ if (typeof hqStoreFail === 'function') hqStoreFail('the journal', e); }
  }
  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

  let open = false, active = 0, sub = 0, sel = null;   // sel = [row, col]
  let el = null;

  function page(){
    if (el) return el;
    el = document.createElement('div');
    el.id = 'journal'; el.className = 'glass'; el.hidden = true;
    el.innerHTML =
      '<div class="phead"><span>The <b>journal</b></span>' +
      '<button class="btn" id="jx">&#10005;</button></div>' +
      '<div class="jtabs" id="jtabs"></div>' +
      '<div class="jwin" id="jwin"></div>' +
      '<div class="knote">tabs hold sub-tabs, sub-tabs hold rows of letters, every letter holds a note · ← → change the tab · Esc closes</div>';
    document.body.append(el);
    el.querySelector('#jx').addEventListener('click', close);
    el.querySelector('#jtabs').addEventListener('click', e => {
      const t = e.target.closest('.chip');
      if (t){ active = +t.dataset.i; sub = 0; sel = null; render(); }
    });
    return el;
  }

  function render(){
    const el = page();
    el.hidden = !open;
    document.body.classList.toggle('journal', open);
    if (!open) return;
    const s = SECTIONS[active], t = s.subs[sub];
    el.querySelector('#jtabs').innerHTML = SECTIONS.map((x, i) =>
      '<div class="chip' + (i === active ? ' sel' : '') + '" data-i="' + i + '">' + esc(x.label) + '</div>').join('');
    const key = sel ? s.label + '/' + t.name + '/' + sel[0] + '/' + sel[1] : null;
    const n = key ? (load()[key] || (load()[key] = {word: '', note: ''})) : null;
    const letter = sel ? t.rows[sel[0]].letters[sel[1]] : '';
    const win = el.querySelector('#jwin');
    win.innerHTML =
      '<div class="jcol">' +
        '<div class="jsubs">' + s.subs.map((x, i) =>
          '<div class="chip' + (i === sub ? ' sel' : '') + '" data-i="' + i + '">' + esc(x.name) + '</div>').join('') + '</div>' +
        '<div class="plabel">' + esc(t.name) + '</div>' +
        '<div class="jgrid">' + t.rows.map((r, ri) =>
          '<div class="jblock"><div class="jrow">' + [...r.letters].map((ch, ci) =>
            '<button class="jletter' + (sel && sel[0] === ri && sel[1] === ci ? ' sel' : '') +
            '" data-r="' + ri + '" data-c="' + ci + '">' + esc(ch) + '</button>').join('') +
          '</div><div class="jblurb">' + esc(r.blurb) + '</div></div>').join('') + '</div>' +
      '</div>' +
      '<div class="jcol jright">' +
        '<div class="plabel">Note</div>' +
        '<div class="jdetail">' + (sel ?
          '<div class="jtop"><div class="jbig">' + esc(letter) + '</div><div>' +
            '<input id="jword" type="text" spellcheck="false" placeholder="' + esc(letter) + ' stands for" value="' + esc(n.word) + '">' +
            '<div class="jfrom">' + esc(t.name) + ' · ' + esc(t.rows[sel[0]].blurb || [...t.rows[sel[0]].letters].join('.')) + '</div>' +
          '</div></div>' +
          '<textarea id="jnote" spellcheck="false" placeholder="Write your note here…">' + esc(n.note) + '</textarea>'
          : '<div class="jempty">pick a letter to write a note</div>') +
        '</div>' +
      '</div>';
    win.querySelector('.jsubs').addEventListener('click', e => {
      const b = e.target.closest('.chip');
      if (b){ sub = +b.dataset.i; sel = null; render(); }
    });
    win.querySelector('.jgrid').addEventListener('click', e => {
      const b = e.target.closest('.jletter');
      if (b){ sel = [+b.dataset.r, +b.dataset.c]; render(); win.querySelector('#jword').focus(); }
    });
    if (sel){
      const w = win.querySelector('#jword'), x = win.querySelector('#jnote');
      w.addEventListener('input', () => { n.word = w.value; });
      x.addEventListener('input', () => { n.note = x.value; });
      w.addEventListener('change', store); x.addEventListener('change', store);
      w.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') x.focus(); });
      x.addEventListener('keydown', e => { if (e.key !== 'Escape') e.stopPropagation(); });
    }
  }

  function show(){
    if (open) return true;
    open = true; render();
    return true;
  }
  function close(){
    if (!open) return false;
    store();
    open = false; render();
    return true;
  }
  /* ← → walk the tabs while the page is up and nothing is being typed */
  function move(d){
    if (!open) return false;
    active = ((active + d) % SECTIONS.length + SECTIONS.length) % SECTIONS.length;
    sub = 0; sel = null; render();
    return true;
  }
  const count = () => { const n = load(); let c = 0; for (const k in n) if ((n[k].word || n[k].note || '').trim()) c++; return c; };

  return {open: show, close, move, opened: () => open, count, sections: SECTIONS};
})();
