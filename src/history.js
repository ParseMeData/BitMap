'use strict';
/* ── undo, and the restore point ────────────────────────────────────────
   Two sizes of regret, and they want two different tools.

   UNDO is for the last thing you did: the wall dragged a tile too far, the
   room deleted when you meant the gap beside it. It walks back one gesture
   at a time.

   The RESTORE POINT is for the other kind — you have been building for ten
   minutes, something went badly wrong somewhere in the middle, and pressing
   undo thirty times hunting for the moment is worse than doing the ten
   minutes again. Opening the builder stamps the point, so "put it back the
   way it was before I started fiddling" is always one press away, and Save
   point moves the stamp forward once the fiddling has turned out well.

   None of this is written down. It is a session's worth of second thoughts,
   not part of the town: reload the page and the stack is gone, and what is
   on the plate is what storage holds. That is the whole promise — history
   can never be the thing that loses your work, because it never outlives
   the tab it was made in.

   (The name shadows the DOM's own History interface. Nothing in this game
   navigates, so the name is free, and it is the name the thing has.) */

const History = (() => {
  /* ── how far back, and why that far ────────────────────────────────────
     A step is a whole snapshot of the small JSON — the same string the
     shapes and the markers are already saved as — rather than a diff, so
     the cost of a step is the size of the drawing and the depth of the
     stack is a memory budget rather than a design decision. A palace runs
     to some tens of kilobytes; forty of those is a few megabytes at the
     very worst and nothing at all in the ordinary case, and forty gestures
     is further back than anyone walks before giving up and reverting. */
  const LIMIT = 40;
  /* Walking through five palaces and out again must not leave five palaces'
     history pinned in memory for the rest of the session. The least
     recently mounted goes first, because it is the one you are least likely
     to walk back into. */
  const SCOPES = 8;
  /* ── a word, not a keystroke ───────────────────────────────────────────
     Dragging a wall saves on every frame, and a step per frame is a stack
     that holds a quarter of a second of history. So most edits are sampled
     after a quiet period instead: whatever the drag did, it did once. The
     gestures with an unmistakable end — a pointer released, a shape
     deleted — do not wait for the timer and step at once. */
  const QUIET = 450;

  const entries = new Map();
  let pending = 0, waiting = null, busy = false;

  const read = k => { try { return Store.get(k) || ''; } catch (e){ return ''; } };
  const ready = () => typeof Build !== 'undefined' && typeof Markers !== 'undefined' &&
                      typeof Build.key === 'function' && typeof Markers.key === 'function';
  /* a palace scope carries a third key: the trace — the room's turns and
     cuts, the trades and the writing on the places (src/trace.js). It moves
     with the plan and the markers or an undo puts numbers back without the
     places that carried them. The town has no trace, and its shots say t:''. */
  const tkeyOf = skey => skey.indexOf('hq.rooms.') === 0 ? 'hq.trace.' + skey.slice(9) : '';
  const shot = e => ({s: read(e.skey), m: read(e.mkey), t: e.tkey ? read(e.tkey) : ''});
  const same = (a, b) => !!a && !!b && a.s === b.s && a.m === b.m && (a.t || '') === (b.t || '');
  const idOf = (skey, mkey) => skey + ' ' + mkey;

  /* ── one stack per mounted scope, named by where it would write ────────
     Build mode edits the town out here and one palace's floor plan in
     there, and the walker steps between the two at will (interior.js). A
     single stack would cheerfully undo a town edit while you are standing
     in a plan — the shapes it put back would go to the plan's key, and the
     town's roads would arrive inside the building.

     So a stack is looked up by the pair of storage keys it would write to,
     resolved fresh at every entry point rather than remembered from the
     last one. A stack can then only ever be applied to the scope it was
     taken from, because those keys ARE its name: there is nothing to keep
     in step with Build.mount, and nothing to get wrong when a mount happens
     somewhere this file has never heard of. The stacks are set aside rather
     than cleared, so stepping out of a palace and back into it finds its
     undo history where it was left. */
  function use(){
    if (!ready()) return null;
    const skey = Build.key(), mkey = Markers.key(), id = idOf(skey, mkey);
    let e = entries.get(id);
    if (e){
      entries.delete(id); entries.set(id, e);      // touch: most recent last
      return e;
    }
    e = {id: id, skey: skey, mkey: mkey, tkey: tkeyOf(skey),
         stack: [], cur: null, mark: null, armed: false};
    /* First sight of a scope is a restore point in its own right: you have
       just walked into this palace and have not touched it yet, which is
       exactly the moment Revert is for. */
    e.cur = shot(e);
    e.mark = e.cur;
    entries.set(id, e);
    while (entries.size > SCOPES){
      const oldest = entries.keys().next().value;
      if (oldest === id) break;
      entries.delete(oldest);
    }
    return e;
  }

  /* The state as it stands, kept only if it differs from the last one
     sampled — clicking a shape selects it and changes nothing, and a stack
     of steps that all undo to the same drawing is a stack you cannot use. */
  function sample(e){
    if (!e) return false;
    const now = shot(e);
    if (same(now, e.cur)){ e.cur = now; return false; }
    if (e.cur) e.stack.push(e.cur);
    while (e.stack.length > LIMIT) e.stack.shift();
    e.cur = now;
    /* the drawing moved under an armed Revert, so the second press is no
       longer the press that was warned about */
    e.armed = false;
    return true;
  }

  /* A deferred sample belongs to the scope it was asked for rather than to
     whichever one is mounted when the timer fires — the keys are absolute,
     so a town sample taken from inside a palace still reads the town. */
  function flush(){
    if (!pending) return;
    clearTimeout(pending); pending = 0;
    const e = waiting; waiting = null;
    if (e) sample(e);
  }

  function tap(){
    if (busy) return;
    const e = use();
    if (!e) return;
    if (waiting && waiting !== e) flush();
    clearTimeout(pending);
    waiting = e;
    pending = setTimeout(() => {
      pending = 0; waiting = null;
      if (sample(e)) sync();
    }, QUIET);
  }

  function step(){
    if (busy) return false;
    /* flush() is what usually records the step — a tap is always armed by the
       time a gesture ends — and it does not sync, so the count in the note
       read one gesture behind whatever had just happened. Sync regardless of
       which of the two did the recording. */
    flush();
    const did = sample(use());
    sync();
    return did;
  }

  /* ── putting a state back ──────────────────────────────────────────────
     Written to storage and then read back by the two modules that own it,
     which is the path a reload takes and the only one that cannot leave the
     two disagreeing: restoring the arrays in memory would leave storage
     holding what had just been undone, and the next save would settle which
     of the two was right by accident.

     An empty snapshot removes the key rather than writing an empty string,
     so a scope that held nothing goes back to holding nothing — Interior
     reads those keys to know which markers have a plan in them. */
  function put(k, v){
    if (v) Store.set(k, v); else Store.del(k);
  }
  function apply(e, s){
    /* the same words save() uses, so a failure here and a failure there
       latch as one thing rather than talking over each other */
    const what = e.skey === 'hq.shapes' ? 'the town' : 'this plan';
    let ok = true;
    busy = true;
    /* Both keys or neither. The shapes write lands first, so its previous
       value is held until the markers write has landed too — undoing a marker
       *deletion* writes a longer string than the one already there, so quota
       is a real way for the second to fail after the first succeeded, and a
       half-written restore is the one thing this path promises cannot happen.
       finally, because a throw out of mount/reload below would otherwise
       leave busy set and every later tap and step a silent no-op. */
    try {
      const backS = Store.get(e.skey), backM = Store.get(e.mkey);
      try {
        put(e.skey, s.s);
        try {
          put(e.mkey, s.m);
          if (e.tkey) put(e.tkey, s.t);
          if (typeof hqStoreOK === 'function'){ hqStoreOK(what); hqStoreOK('the markers'); }
        } catch (err){
          ok = false;
          put(e.skey, backS);                      // roll the landed writes back
          put(e.mkey, backM);
          if (typeof hqStoreFail === 'function') hqStoreFail('the markers', err);
        }
      } catch (err){ ok = false; if (typeof hqStoreFail === 'function') hqStoreFail(what, err); }
      /* Storage refused, so nothing is loaded: what is on screen is still
         what storage holds, which is the only state that is true. */
      if (ok){
        /* the trace before the markers: mounting the markers is what reads
           the numbers back off the places, so the places must already say
           the restored numbers when it happens */
        if (e.tkey && typeof Trace !== 'undefined' && Trace.remount) Trace.remount();
        Markers.mount(e.mkey); Build.reload();
      }
    } finally { busy = false; }
    return ok;
  }

  function undo(){
    flush();
    const e = use();
    if (!e) return false;
    sample(e);                       // the gesture being undone may not be a step yet
    if (!e.stack.length){ sync(); return false; }
    const prev = e.stack[e.stack.length - 1];
    if (!apply(e, prev)) return false;
    e.stack.pop();
    e.cur = prev; e.armed = false;
    sync();
    return true;
  }

  /* The restore point moves forward: you have done good work, and this is
     the state you would want back if the next hour goes wrong. */
  function point(){
    flush();
    const e = use();
    if (!e) return false;
    sample(e);
    e.mark = e.cur; e.armed = false;
    sync();
    return true;
  }

  function revert(){
    flush();
    const e = use();
    if (!e || !e.mark) return false;
    sample(e);
    if (same(e.cur, e.mark)){ e.armed = false; sync(); return false; }
    /* Press again, the way #pgen asks before replacing a plan you already
       have. Reverting throws away everything since the point was set, and a
       mis-click that did that without a word is precisely the accident this
       whole file exists to answer. */
    if (!e.armed){ e.armed = true; sync(); return false; }
    const back = e.mark;
    if (!apply(e, back)) return false;
    /* and the revert is itself a step, so the work it discarded is one
       ctrl-z away for as long as the session lasts */
    if (e.cur) e.stack.push(e.cur);
    while (e.stack.length > LIMIT) e.stack.shift();
    e.cur = back; e.armed = false;
    sync();
    return true;
  }

  /* Opening the builder is the "before" the restore point means: it is the
     moment you will want back if the next ten minutes go wrong, and it is
     the one moment nobody has to remember to ask for. The undo stack is
     left alone — it is still a true account of what happened. */
  function opened(on){
    flush();
    const e = use();
    if (!e) return;
    if (on){ e.cur = shot(e); e.mark = e.cur; }
    e.armed = false;
    sync();
  }

  /* Asking about a scope is enough to have it remembered, so the entry —
     and with it the restore point — exists from the moment the palette is
     first painted for it, which is inside Build.mount. Waiting for the
     first edit instead would leave that first edit with nothing behind it
     to go back to. */
  const here = use;

  /* ── what the controls say ─────────────────────────────────────────────
     The note carries the warning rather than the button, because the button
     has room for one word and the thing that has to be said is what will be
     lost. Armed, it goes gold on the rule the reachability warning already
     uses, and Revert wears the same inverted state as every other armed
     tool in the palette. */
  function sync(){
    const note = $('#khnote'), rv = $('#krevert');
    if (!note && !rv) return;
    const e = here();
    const n = e ? e.stack.length : 0;
    const armed = !!(e && e.armed);
    const moved = !!(e && !same(e.cur, e.mark));
    if (rv) rv.classList.toggle('sel', armed);
    if (!note) return;
    note.textContent = armed
      ? 'this throws away everything since the point was set · press again to do it'
      : !n
        ? 'nothing to undo yet · the point was set when you opened the builder'
        : n + (n === 1 ? ' step' : ' steps') + ' back · ctrl-z' +
          (moved ? ' · revert returns to the point'
                 : ' · the point is where you are');
    note.classList.toggle('warn', armed);
  }

  return {step: step, tap: tap, undo: undo, point: point, revert: revert,
          opened: opened, sync: sync,
          depth: () => { const e = here(); return e ? e.stack.length : 0; },
          armed: () => { const e = here(); return !!(e && e.armed); }};
})();
