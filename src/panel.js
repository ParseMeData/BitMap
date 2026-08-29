'use strict';
/* ── tune panel ─────────────────────────────────────────────────────────
   Tone controls force a re-analysis of the map; everything else only
   re-picks faces and colour, which is cheap. Both end in one buffer
   upload, so the frame loop never learns anything changed. */

let panelOpen = false;
const HEAVY = new Set(['cols', 'bri', 'con']);   // these force a re-analysis

/* the last field marks a row the plate does not have to be rebuilt for:
   Glow is a uniform the frame loop already sets, so re-composing 112,982
   cells to answer a slider drag would be pure waste */
const ROWS = [
  ['cols', 'Detail',     40,  208, 4,   v => v | 0,        v => String(v | 0)],
  ['bri',  'Tone',      -35,   35, 5,   v => v / 100,      v => (v > 0 ? '+' : '') + (v * 100).toFixed(0)],
  ['con',  'Contrast',   50,  200, 10,  v => v / 100,      v => v.toFixed(1) + '×'],
  ['sat',  'Saturate',    0,  200, 10,  v => v / 100,      v => v.toFixed(1) + '×'],
  ['edge', 'Edges',       0,  200, 10,  v => v / 100,      v => v.toFixed(1) + '×'],
  ['path', 'Route',       0,  200, 10,  v => v / 100,      v => v.toFixed(1) + '×'],
  ['churn','Churn',      10,  300, 10,  v => v / 100,      v => v.toFixed(1) + '×'],
  ['scatter','Scatter',   0,  200, 10,  v => v / 100,      v => v.toFixed(1) + '×'],
  ['szv',  'Size var',    0,  200, 10,  v => v / 100,      v => v.toFixed(1) + '×'],
  ['cvar', 'Colour var',  0,  100, 5,   v => v / 100,      v => (v * 100).toFixed(0) + '%'],
  ['glow', 'Glow',        0,  150, 5,   v => v / 100,      v => (v * 100).toFixed(0) + '%', true],
];
const INKS = [['Full', -1], ['Bone', 0], ['Pink', 1], ['Aqua', 2], ['Gold', 3], ['Violet', 4]];

let rebuildT = 0, heavyPending = false;
function queueRebuild(heavy){
  heavyPending = heavyPending || heavy;
  clearTimeout(rebuildT);
  rebuildT = setTimeout(() => {
    if (heavyPending) analyse();
    heavyPending = false;
    compose();
  }, 160);
}

function buildPanel(){
  const body = $('#tbody');
  if (body.childElementCount) return;
  for (const [key, label, min, max, step, toVal, fmtv, live] of ROWS){
    const row = document.createElement('div');
    row.className = 'prow';
    row.innerHTML = '<label>' + label + '</label>' +
      '<input type="range" min="' + min + '" max="' + max + '" step="' + step + '">' +
      '<span class="pv"></span>';
    const inp = row.querySelector('input'), out = row.querySelector('.pv');
    inp.dataset.key = key;
    inp.oninput = () => {
      T[key] = toVal(+inp.value);
      out.textContent = fmtv(T[key]);
      clearSel();
      if (!live) queueRebuild(HEAVY.has(key));
    };
    row._sync = () => {
      /* a T baked in before this row existed simply has no value for it —
         fall back rather than writing NaN into the panel */
      if (T[key] === undefined) T[key] = 1;   // Glow's own neutral, and every ×1 row's
      inp.value = key === 'cols' ? T[key] : Math.round(T[key] * 100);
      out.textContent = fmtv(T[key]);
    };
    body.appendChild(row);
  }
  const inks = document.createElement('div');
  inks.className = 'chips'; inks.id = 'pinks';
  for (const [name, v] of INKS){
    const c = document.createElement('div');
    c.className = 'chip'; c.textContent = name; c.dataset.ink = v;
    c.onclick = () => { T.ink = v; syncPanel(); clearSel(); queueRebuild(false); };
    inks.appendChild(c);
  }
  body.appendChild(inks);

  /* where the towns are: our region drawn flat, or the whole country. The
     country is hidden rather than removed — Eden's call, 2026-08-27 */
  const th = document.createElement('div');
  th.className = 'plabel'; th.textContent = 'Towns';
  body.appendChild(th);
  const tw = document.createElement('div');
  tw.className = 'chips two';
  for (const [name, v] of [['Region', 'region'], ['Country', 'country']]){
    const c = document.createElement('div');
    c.className = 'chip'; c.textContent = name; c.dataset.towns = v;
    c.onclick = () => { setTowns(v); syncPanel(); };
    tw.appendChild(c);
  }
  body.appendChild(tw);

  /* the round, on or off. It is the game this started as and it is in the
     way of the one it is becoming, so it is a switch rather than a removal */
  const sh = document.createElement('div');
  sh.className = 'plabel'; sh.textContent = 'Sparks';
  body.appendChild(sh);
  const spk = document.createElement('div');
  spk.className = 'chips two';
  for (const [name, v] of [['Off', false], ['On', true]]){
    const c = document.createElement('div');
    c.className = 'chip'; c.textContent = name; c.dataset.spark = v ? '1' : '0';
    c.onclick = () => { setSparks(v); syncPanel(); };
    spk.appendChild(c);
  }
  body.appendChild(spk);

  /* who is playing: sign out to the door, or set a password (index.html, Users)
     — only while there is a door */
  if (typeof Users !== 'undefined' && typeof DOOR !== 'undefined' && DOOR){
    const ul = document.createElement('div');
    ul.className = 'plabel'; ul.id = 'pplayerlabel'; ul.textContent = 'Player · ' + Users.name();
    body.appendChild(ul);
    const ur = document.createElement('div');
    ur.className = 'chips two'; ur.id = 'pplayer';
    for (const [name, fn] of [['Sign out', () => Users.signOut()],
                              ['Password', () => {
                                const pw = window.prompt('a new password for ' + Users.name());
                                if (pw == null) return;
                                Users.setPassword(HQ_USER, pw).then(ok => hqNote(ok ? 'the password is set' : 'could not set it', !ok));
                              }]]){
      const c = document.createElement('div');
      c.className = 'chip'; c.textContent = name; c.onclick = fn;
      ur.appendChild(c);
    }
    body.appendChild(ur);
  }

  /* the town, out to a file and back: what tools/snapshot.py does from a
     terminal, for a page that has none beside it (src/snapshot.js) */
  if (typeof Snap !== 'undefined'){
    const tl = document.createElement('div');
    tl.className = 'plabel'; tl.textContent = 'Town';
    body.appendChild(tl);
    const tr = document.createElement('div');
    tr.className = 'chips two';
    for (const [name, fn] of [['Export town', () => Snap.exportTown()], ['Import town', () => Snap.importTown()]]){
      const c = document.createElement('div');
      c.className = 'chip'; c.textContent = name;
      c.onclick = fn;
      tr.appendChild(c);
    }
    body.appendChild(tr);
    /* and back to a blank page: every hq. key and both picture stores
       gone, then a reload, which founds an empty home again (Eden,
       2026-08-29). It asks, because there is no undo but an export. */
    const rr = document.createElement('div');
    rr.className = 'chips two';
    const rc = document.createElement('div');
    rc.className = 'chip'; rc.textContent = 'Reset — blank page';
    rc.onclick = () => {
      if (!window.confirm('Reset the map to a blank page?\n\nEverything on every plate goes — the town, the palaces, the pictures. Export first if you want it kept.')) return;
      Snap.load({version: 3, localStorage: {}, picture: null, loci: {}}, false);
    };
    rr.appendChild(rc);
    body.appendChild(rr);
  }

  const head = document.createElement('div');
  head.className = 'plabel'; head.id = 'pvarlabel'; head.textContent = 'Variations';
  body.appendChild(head);
  const pre = document.createElement('div');
  pre.className = 'chips three'; pre.id = 'presets';
  for (const [name, vals] of PRESETS){
    const c = document.createElement('div');
    c.className = 'chip'; c.textContent = name;
    c.onclick = () => {
      const heavy = vals.bri !== T.bri || vals.con !== T.con;
      Object.assign(T, vals);
      syncPanel();
      [...pre.children].forEach(x => x.classList.remove('sel'));
      c.classList.add('sel');
      queueRebuild(heavy);
    };
    pre.appendChild(c);
  }
  body.appendChild(pre);

  $('#preset').onclick = () => { T = defTune(); syncPanel(); clearSel(); queueRebuild(true); };
  $('#premix').onclick = () => recrystallise();
  $('#pcopy').onclick = async () => {
    const btn = $('#pcopy'), s = 'let T = ' + JSON.stringify(T) + ';';
    try { await navigator.clipboard.writeText(s); btn.textContent = 'COPIED ✓'; }
    catch (e){ const ta = $('#pjson'); ta.hidden = false; ta.value = s; ta.select(); }
    setTimeout(() => { btn.textContent = 'Copy settings'; }, 1400);
  };
  $('#pclose').onclick = () => setPanel(false);
  syncPanel();
}

const clearSel = () => document.querySelectorAll('#presets .chip').forEach(c => c.classList.remove('sel'));
function syncPanel(){
  document.querySelectorAll('#tbody .prow').forEach(r => r._sync && r._sync());
  document.querySelectorAll('.chip[data-ink]').forEach(c =>
    c.classList.toggle('sel', +c.dataset.ink === T.ink));
  document.querySelectorAll('.chip[data-spark]').forEach(c =>
    c.classList.toggle('sel', (c.dataset.spark === '1') === SPARKS));
  document.querySelectorAll('.chip[data-towns]').forEach(c =>
    c.classList.toggle('sel', c.dataset.towns === TOWNS));
}
function setPanel(open){
  panelOpen = open;
  $('#tune').hidden = !open;
  /* the tune panel and the route want the same corner; tuning is the
     transient one, so it takes the corner while it is up */
  document.body.classList.toggle('tuning', !!open);
  if (open) syncPanel();
}
