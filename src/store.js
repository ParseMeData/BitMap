'use strict';
/* ── the store ──────────────────────────────────────────────────────────
   Every `hq.` key the game keeps, read and written through one place.

   Before this each module reached for localStorage itself, and each one
   that had ever changed the shape of its key carried its own little
   migration — the bag reading `hq.bagsel` once as a stack of one, the
   palace ignoring the bare `hq.order.` an old build wrote. Nothing knew
   what a town as a whole was, or which build had last written it. Now
   `hq.version` says, and the ladder below is the one list of what has
   changed and in which order: a profile written by any earlier build is
   walked up it once, at boot, before any module reads a key.

   What this is NOT: a different place to keep things. The keys are the
   keys, the values are the strings they always were, and the browser
   profile is still where the town lives; `tools/snapshot.py` carries
   everything under `hq.` without knowing this file exists. `set` throws
   on a full store exactly as localStorage does, so every try/catch and
   every `hqStoreFail` latch in the modules keeps meaning what it meant.

   `watch(prefix, fn)` is how the index (`hq.index`) stays current
   without every module telling it: a write or a removal under a prefix
   is announced, once, after it has landed.                              */

const Store = (() => {
  const VERSION = 1;
  const VKEY = 'hq.version';
  const watchers = [];

  /* ── raw ──────────────────────────────────────────────────────────── */
  const get = k => { try { return localStorage.getItem(k); } catch (e){ return null; } };
  function set(k, v){
    localStorage.setItem(k, v);                 // throws on quota, on purpose
    tell(k, v);
  }
  function del(k){
    try { localStorage.removeItem(k); } catch (e){}
    tell(k, null);
  }
  /* set-or-remove, never throwing: an empty value takes the key out, so a
     scope that held nothing goes back to holding nothing; `what` names the
     thing for the banner, in the words the module already used */
  function put(k, v, what){
    try {
      if (v == null || v === '') del(k); else set(k, v);
      if (what && typeof hqStoreOK === 'function') hqStoreOK(what);
      return true;
    } catch (e){
      if (what && typeof hqStoreFail === 'function') hqStoreFail(what, e);
      return false;
    }
  }
  /* JSON in and out, with a default for a key that is missing or not JSON */
  function json(k, dflt){
    const raw = get(k);
    if (raw == null || raw === '') return dflt;
    try { const v = JSON.parse(raw); return v == null ? dflt : v; } catch (e){ return dflt; }
  }
  const save = (k, obj, what) => put(k, obj == null ? '' : JSON.stringify(obj), what);
  /* every key under a prefix, in no order worth relying on */
  function keys(prefix){
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++){
        const k = localStorage.key(i);
        if (!prefix || k.indexOf(prefix) === 0) out.push(k);
      }
    } catch (e){}
    return out;
  }
  const has = k => { const v = get(k); return v != null && v !== '' && v !== '[]'; };

  function watch(prefix, fn){ watchers.push({prefix, fn}); }
  function tell(k, v){
    for (const w of watchers)
      if (k.indexOf(w.prefix) === 0){ try { w.fn(k, v); } catch (e){} }
  }

  /* ── the ladder ───────────────────────────────────────────────────────
     One entry per version, in order; each is run once, on a profile
     written by a build older than it. A step reads and writes raw keys —
     nothing above this file exists yet when it runs. Append; never edit
     a step that has shipped, because a profile that already climbed it
     will not climb it again. */
  const LADDER = [
    /* 1 — the store arrives. Fold in the migrations the modules carried
       themselves, and take out what nothing reads any more. */
    function v1(){
      /* the bag: one held number became a dealt sequence (v7.1) */
      const seq = json('hq.bagseq', null);
      if (!Array.isArray(seq)){
        const old = json('hq.bagsel', null);
        if (old) put('hq.bagseq', JSON.stringify([old]));
      }
      del('hq.bagsel');
      /* the card halftone strip, folded into bag.js (v7.1) */
      del('hq.bagtune');
      /* the bare key an early Generate wrote with no palace under it */
      del('hq.order.');
      /* Haunt Quest's best time — nothing in this game has read it since
         the fork; it came across in the profile */
      del('hq.best');
    },
  ];
  function climb(){
    let v = parseInt(get(VKEY), 10);
    if (!isFinite(v) || v < 0) v = 0;
    if (v >= VERSION) return v;
    for (let i = v; i < LADDER.length; i++){
      try { LADDER[i](); }
      catch (e){ if (typeof hqReport === 'function') hqReport('store: step ' + (i + 1) + ' failed — ' + e.message); return i; }
      try { localStorage.setItem(VKEY, String(i + 1)); } catch (e){ return i; }
    }
    return VERSION;
  }
  const climbed = climb();

  return {VERSION, version: () => climbed, get, set, del, put, json, save, keys, has, watch};
})();
