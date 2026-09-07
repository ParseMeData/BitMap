'use strict';
/* ── the cloud: the town sealed, and kept in Google Drive ────────────────
   The town lives in one browser (README, *On the web*) and moves by file.
   This is the file made safe to leave the machine, and a place for it to
   go that every device can reach.

   THE SEAL. A sealed town is the version-3 file `Snap.dump` writes, gzipped
   where the browser can, and shut with AES-256-GCM under a key drawn from
   a passphrase by PBKDF2 (SHA-256, six hundred thousand rounds, a fresh
   salt every time). The passphrase is asked for in the page, kept in
   memory for the session, and written nowhere — not in storage, not in
   the file, not in Drive. What leaves the machine is the envelope below:
   the salt, the nonce, the ciphertext, and the time it was sealed. Not
   even the counts are in the clear. A forgotten passphrase cannot be
   recovered; the town in whichever browser last played is untouched.

   THE DRIVE. Google's own sign-in (Google Identity Services, fetched the
   first time it is wanted, never on boot) hands the page a token for the
   `drive.file` scope — the narrow one: the game can see only files it
   made, and Google's consent screen says exactly that. One sealed file
   per player, `Bitmap town.json`, sits in a folder named Bitmap in My
   Drive where its owner can see it, download it, or delete it; Google
   holds ciphertext. The link is remembered per player in the store under
   `cloud`, which is not an `hq.` key, so no snapshot carries it and a
   loaded town does not drag another's link in.

   Two things this needs that the desk launcher does not give: an http(s)
   origin (Google refuses a file:// page, so the link is for the web page,
   or a `python3 -m http.server 8000` beside the desk), and a secure
   context for `crypto.subtle` (https, localhost, or file:// — a plain
   http LAN address has none, and the seal says so).

   What it is NOT: a sync. Save and Load are pressed; the label under
   Town says when Drive was last written and whether the town here has
   changed since. The same file goes out by hand too — Export locked,
   Import locked — for a Drive folder on the desk, a USB stick, or any
   other cloud.                                                          */

const Cloud = (() => {
  const CLIENT_ID = '1091795211229-ojso0kiaks54aov91tatml7hqi5etc0k.apps.googleusercontent.com';
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const FOLDER = 'Bitmap';
  const KEY = 'cloud';                 // through the store: per player, not an hq. key
  const ITER = 600000;
  const API = 'https://www.googleapis.com/drive/v3/files';
  const UP = 'https://www.googleapis.com/upload/drive/v3/files';
  const note = (m, bad) => { if (typeof hqNote === 'function') hqNote(m, !!bad); };
  const when = iso => { try { return new Date(iso).toLocaleString(undefined, {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}); } catch (e){ return iso; } };
  const say = c => c.shapes + ' shapes, ' + c.markers + ' markers, ' + c.rooms + ' interiors, ' +
                   c.loci + ' pictures' + (c.picture ? ', a traced map' : '');
  const kb = n => n < 1024 * 1024 ? Math.round(n / 1024) + ' KB' : (n / 1024 / 1024).toFixed(1) + ' MB';

  /* ── the seal ────────────────────────────────────────────────────────── */
  const enc = s => new TextEncoder().encode(s);
  function b64(bytes){
    const a = new Uint8Array(bytes); let s = '';
    for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
    return btoa(s);
  }
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const subtle = () => (window.crypto && crypto.subtle) || null;
  async function deriveKey(pass, salt, iter){
    const base = await subtle().importKey('raw', enc(pass), 'PBKDF2', false, ['deriveKey']);
    return subtle().deriveKey({name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256'}, base,
                              {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
  }
  async function zip(bytes){
    if (typeof CompressionStream === 'undefined') return {bytes, zip: null};
    const st = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    return {bytes: new Uint8Array(await new Response(st).arrayBuffer()), zip: 'gzip'};
  }
  async function unzip(bytes, how){
    if (!how) return bytes;
    if (typeof DecompressionStream === 'undefined') throw new Error('this browser cannot unpack a ' + how + ' file');
    const st = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(how));
    return new Uint8Array(await new Response(st).arrayBuffer());
  }
  /* a town in, an envelope out */
  async function seal(snap, pass){
    if (!subtle()) throw new Error('sealing needs a secure page — https, localhost, or a file');
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(pass, salt, ITER);
    const plain = await zip(enc(JSON.stringify(snap)));
    const data = await subtle().encrypt({name: 'AES-GCM', iv}, key, plain.bytes);
    return {sealed: 1, kdf: 'PBKDF2-SHA256', iter: ITER, cipher: 'AES-256-GCM', zip: plain.zip,
            salt: b64(salt), iv: b64(iv), saved: new Date().toISOString(), data: b64(data)};
  }
  const isSealed = f => !!(f && f.sealed === 1 && f.data && f.salt && f.iv);
  /* an envelope in, a town out; a wrong passphrase is the one error GCM
     gives, so it is named as such */
  async function unseal(file, pass){
    if (!isSealed(file)) throw new Error('not a sealed town');
    if (!subtle()) throw new Error('unsealing needs a secure page — https, localhost, or a file');
    const key = await deriveKey(pass, unb64(file.salt), file.iter || ITER);
    let plain;
    try { plain = await subtle().decrypt({name: 'AES-GCM', iv: unb64(file.iv)}, key, unb64(file.data)); }
    catch (e){ throw new Error('wrong passphrase'); }
    const bytes = await unzip(new Uint8Array(plain), file.zip);
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  /* ── the passphrase ───────────────────────────────────────────────────
     Asked in a panel of the page's own, never a browser prompt (which
     shows what is typed). Kept for the session once it has sealed or
     unsealed something; dropped on a wrong guess and on Unlink. A fresh
     seal asks twice, because a typo here is a town nobody can open. */
  let pass = null;
  function askPass(fresh){
    if (pass) return Promise.resolve(pass);
    return new Promise(res => {
      let box = document.getElementById('seal');
      if (!box){
        box = document.createElement('div'); box.id = 'seal'; box.className = 'glass'; box.hidden = true;
        box.innerHTML =
          '<div id="sealwhy"></div>' +
          '<input id="sealpw" type="password" autocomplete="off" spellcheck="false" placeholder="passphrase">' +
          '<input id="sealpw2" type="password" autocomplete="off" spellcheck="false" placeholder="again">' +
          '<div class="erow"><button id="sealok">Seal</button><button id="sealno">Cancel</button></div>';
        document.body.appendChild(box);
      }
      const why = box.querySelector('#sealwhy'), a = box.querySelector('#sealpw'), b = box.querySelector('#sealpw2');
      const ok = box.querySelector('#sealok'), no = box.querySelector('#sealno');
      why.textContent = fresh
        ? 'A passphrase seals the town before it leaves this machine. Only you know it: it is stored nowhere, and a forgotten one cannot be recovered.'
        : 'The passphrase the town was sealed with.';
      a.value = ''; b.value = ''; b.hidden = !fresh; ok.textContent = fresh ? 'Seal' : 'Open';
      box.hidden = false; a.focus();
      const done = v => { box.hidden = true; a.value = ''; b.value = ''; box.onkeydown = null; ok.onclick = no.onclick = null; res(v); };
      ok.onclick = () => {
        const v = a.value;
        if (!v){ a.focus(); return; }
        if (fresh && v !== b.value){ why.textContent = 'The two do not match — once more.'; b.value = ''; b.focus(); return; }
        done(v);
      };
      no.onclick = () => done(null);
      box.onkeydown = e => {
        if (e.key === 'Enter'){ e.preventDefault(); if (fresh && e.target === a) b.focus(); else ok.onclick(); }
        else if (e.key === 'Escape'){ e.preventDefault(); no.onclick(); }
        e.stopPropagation();
      };
    });
  }

  /* ── Google ───────────────────────────────────────────────────────────── */
  let token = null, tokenAt = 0, client = null, pending = null;
  const onWeb = () => /^https?:$/.test(location.protocol);
  function gis(){
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (!onWeb()) return Promise.reject(new Error('the Drive link needs the web page — open the game over http, not from a file'));
    if (gis._p) return gis._p;
    gis._p = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = () => res();
      s.onerror = () => { gis._p = null; rej(new Error('could not reach Google')); };
      document.head.appendChild(s);
    });
    return gis._p;
  }
  function getToken(){
    if (token && Date.now() < tokenAt) return Promise.resolve(token);
    return gis().then(() => new Promise((res, rej) => {
      if (!client) client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID, scope: SCOPE,
        callback: r => {
          const p = pending; pending = null; if (!p) return;
          if (r && r.access_token){ token = r.access_token; tokenAt = Date.now() + (((r.expires_in | 0) || 3600) - 60) * 1000; p.res(token); }
          else p.rej(new Error((r && r.error_description) || (r && r.error) || 'Google gave no token'));
        },
        error_callback: e => {
          const p = pending; pending = null; if (!p) return;
          p.rej(new Error(e && e.type === 'popup_closed' ? 'sign-in closed' : (e && e.message) || 'sign-in failed'));
        }
      });
      pending = {res, rej};
      client.requestAccessToken({prompt: ''});
    }));
  }
  async function call(url, opt, again){
    const t = await getToken();
    opt = opt || {};
    opt.headers = Object.assign({}, opt.headers || {}, {Authorization: 'Bearer ' + t});
    const r = await fetch(url, opt);
    if (r.status === 401 && !again){ token = null; return call(url, opt, true); }
    if (!r.ok){
      let m = 'HTTP ' + r.status;
      try { const j = await r.json(); m = (j.error && j.error.message) || m; } catch (e){}
      const err = new Error('Drive: ' + m); err.status = r.status; throw err;
    }
    return r;
  }
  const q = s => encodeURIComponent(s);
  const fileName = () => 'Bitmap town' + (typeof HQ_USER === 'string' && HQ_USER ? ' (' + HQ_USER + ')' : '') + '.json';
  async function folder(){
    const r = await call(API + '?q=' + q("name='" + FOLDER + "' and mimeType='application/vnd.google-apps.folder' and trashed=false") + '&fields=files(id)');
    const j = await r.json();
    if (j.files && j.files.length) return j.files[0].id;
    const c = await call(API, {method: 'POST', headers: {'Content-Type': 'application/json'},
                               body: JSON.stringify({name: FOLDER, mimeType: 'application/vnd.google-apps.folder'})});
    return (await c.json()).id;
  }
  async function find(){
    const r = await call(API + '?q=' + q("name='" + fileName() + "' and trashed=false") + '&fields=files(id,modifiedTime,size)&orderBy=modifiedTime desc');
    const j = await r.json();
    return (j.files && j.files[0]) || null;
  }
  async function meta(id){
    const r = await call(API + '/' + id + '?fields=id,modifiedTime,size,trashed');
    return r.json();
  }
  async function upload(text, id){
    const blob = new Blob([text], {type: 'application/json'});
    if (id){
      const r = await call(UP + '/' + id + '?uploadType=media&fields=id,modifiedTime,size',
                           {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: blob});
      return r.json();
    }
    const fd = new FormData();
    fd.append('metadata', new Blob([JSON.stringify({name: fileName(), parents: [await folder()], mimeType: 'application/json'})], {type: 'application/json'}));
    fd.append('file', blob);
    const r = await call(UP + '?uploadType=multipart&fields=id,modifiedTime,size', {method: 'POST', body: fd});
    return r.json();
  }
  async function download(id){
    const r = await call(API + '/' + id + '?alt=media');
    return r.json();
  }

  /* ── the link, remembered ───────────────────────────────────────────── */
  const linked = () => Store.json(KEY, null);
  const remember = o => Store.save(KEY, o, 'the Drive link');
  const isOn = () => { const c = linked(); return !!(c && c.on); };
  /* the town here has changed since Drive was last written: any hq. write
     after boot, bar the diagnostics, the store's own bookkeeping, and the
     distractions, which settle on the road by themselves as you walk and
     are the game's housekeeping, not the town (a save at 12:00 read
     "changed since" a moment later for one settling — Eden, 2026-09-06) */
  const QUIET = {'hq.lastError': 1, 'hq.loads': 1, 'hq.version': 1, 'hq.index': 1, 'hq.distract': 1};
  let quiet = true, busy = false;
  function touched(k){
    if (quiet || QUIET[k]) return;
    const c = linked();
    if (c && c.on && !c.dirty){ c.dirty = true; remember(c); sync(); }
  }
  if (typeof Store !== 'undefined'){
    Store.watch('hq.', touched);
    setTimeout(() => { quiet = false; }, 3000);          // boot's own writes are not changes
  }

  async function link(){
    await getToken();
    const f = await find();
    const c = linked() || {};
    remember(Object.assign(c, {on: true, id: f ? f.id : null, saved: f ? f.modifiedTime : null, dirty: !f, at: new Date().toISOString()}));
    note(f ? 'linked — a town saved ' + when(f.modifiedTime) + ' is in Drive; Load from Drive takes it'
           : 'linked — nothing in Drive yet; Save to Drive puts the town there');
  }
  function unlink(){
    if (token && window.google && google.accounts && google.accounts.oauth2){
      try { google.accounts.oauth2.revoke(token, () => {}); } catch (e){}
    }
    token = null; tokenAt = 0; pass = null;
    remember(null);
    note('unlinked — the file in Drive stays yours; link again to reach it');
  }
  async function save(){
    if (!isOn()){ note('link Google first', true); return false; }
    const p = await askPass(true);
    if (p == null) return false;
    const snap = await Snap.dump();
    note('sealing…');
    const text = JSON.stringify(await seal(snap, p));
    pass = p;
    const c = linked();
    let id = c.id;
    if (!id){ const f = await find(); id = f ? f.id : null; }
    let r;
    try { r = await upload(text, id); }
    catch (e){ if (id && e.status === 404) r = await upload(text, null); else throw e; }
    remember(Object.assign(c, {id: r.id, saved: r.modifiedTime, dirty: false}));
    note('saved to Drive — ' + say(Snap.counts(snap)) + ', ' + kb(text.length) + ' sealed');
    return true;
  }
  async function load(){
    if (!isOn()){ note('link Google first', true); return false; }
    const c = linked();
    let f = c.id ? await meta(c.id).catch(() => null) : null;
    if (!f || f.trashed){
      f = await find();
      if (!f){ note('nothing in Drive yet — Save to Drive first'); return false; }
    }
    note('fetching…');
    const file = await download(f.id);
    const p = await askPass(false);
    if (p == null) return false;
    let snap;
    try { snap = await unseal(file, p); }
    catch (e){ pass = null; throw e; }
    pass = p;
    const here = Snap.counts(await Snap.dump()), there = Snap.counts(snap);
    const warn = c.dirty ? '\n\nThe town here has changes not saved to Drive.' : '';
    const ok = window.confirm('Load the town from Drive?\n\nDrive:  ' + say(there) + ' — saved ' + when(f.modifiedTime) +
                              '\nhere:  ' + say(here) + warn + '\n\nThe town here becomes the Drive copy. Export first if you want it kept.');
    if (!ok){ note('load cancelled'); return false; }
    quiet = true;                                        // the load's writes are not changes
    remember(Object.assign(c, {id: f.id, saved: f.modifiedTime, dirty: false}));
    return Snap.load(snap, false);                       // writes, then reloads the page
  }

  /* ── the same file by hand ──────────────────────────────────────────── */
  async function exportLocked(){
    const p = await askPass(true);
    if (p == null) return false;
    const snap = await Snap.dump();
    note('sealing…');
    const text = JSON.stringify(await seal(snap, p));
    pass = p;
    const name = ((typeof Store !== 'undefined' && Store.get('hq.town')) || 'town').replace(/[^\w-]+/g, '-').toLowerCase();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], {type: 'application/json'}));
    a.download = name + '-' + new Date().toISOString().slice(0, 10) + '.sealed.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    note('exported sealed — ' + say(Snap.counts(snap)) + ', ' + kb(text.length));
    return true;
  }
  function importLocked(){
    let inp = document.getElementById('sealfile');
    if (!inp){
      inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json,application/json'; inp.id = 'sealfile'; inp.hidden = true;
      document.body.appendChild(inp);
      inp.addEventListener('change', () => {
        const f = inp.files && inp.files[0]; inp.value = '';
        if (!f) return;
        f.text().then(async t => {
          const file = JSON.parse(t);
          if (!isSealed(file)) throw new Error('not a sealed town — Import town reads a plain one');
          const p = await askPass(false);
          if (p == null) return;
          let snap;
          try { snap = await unseal(file, p); }
          catch (e){ pass = null; throw e; }
          pass = p;
          quiet = true;
          return Snap.load(snap);                        // asks, with the counts
        }).catch(e => note('could not import: ' + e.message, true));
      });
    }
    inp.click();
  }

  /* ── the block under Town ───────────────────────────────────────────── */
  let ui = null;
  function sync(){
    if (!ui) return;
    const c = linked(), on = !!(c && c.on);
    ui.label.textContent = 'Cloud · ' + (!on ? 'not linked'
      : !c.saved ? 'Drive · nothing saved yet'
      : c.dirty ? 'Drive · changed since ' + when(c.saved)
      : 'Drive · saved ' + when(c.saved));
    ui.link.textContent = on ? 'Unlink Drive' : 'Link Google Drive';
    ui.save.classList.toggle('off', !on); ui.load.classList.toggle('off', !on);
  }
  /* a chip's work, with its failure said on the banner and the chip not
     pressed twice while it runs */
  const run = fn => () => {
    if (busy) return;
    busy = true;
    Promise.resolve().then(fn).catch(e => note(e && e.message ? e.message : String(e), true))
      .then(() => { busy = false; sync(); });
  };
  function block(body){
    const label = document.createElement('div');
    label.className = 'plabel'; label.id = 'pcloudlabel';
    body.appendChild(label);
    const row = document.createElement('div');
    row.className = 'chips three'; row.id = 'pcloud';
    const chip = (text, fn) => { const c = document.createElement('div'); c.className = 'chip'; c.textContent = text; c.onclick = fn; row.appendChild(c); return c; };
    const linkc = chip('Link Google Drive', run(() => isOn() ? unlink() : link()));
    const savec = chip('Save to Drive', run(save));
    const loadc = chip('Load from Drive', run(load));
    body.appendChild(row);
    const row2 = document.createElement('div');
    row2.className = 'chips two';
    for (const [text, fn] of [['Export locked', run(exportLocked)], ['Import locked', () => importLocked()]]){
      const c = document.createElement('div'); c.className = 'chip'; c.textContent = text; c.onclick = fn; row2.appendChild(c);
    }
    body.appendChild(row2);
    ui = {label, link: linkc, save: savec, load: loadc};
    sync();
    if (onWeb() && isOn()) gis().catch(() => {});          // so the first press opens the popup at once
  }

  return {seal, unseal, isSealed, link, unlink, save, load, exportLocked, importLocked, block, sync, linked, fileName};
})();
