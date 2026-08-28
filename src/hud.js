'use strict';
/* ── the plate HUD ──────────────────────────────────────────────────────
   Four ways in, drawn out of the same diamonds as the roads and the walker.

   Every other floating thing in this game is a panel: a bordered pane of
   glass with words in it, laid over the plate. This one is not. It is a hub
   diamond with four diamonds of diamonds sitting just outside its four
   points, emitted into the entity stream, so it breathes on the shader's
   own clock and reads as part of the town rather than as a control panel
   parked on top of it. That was the choice, made deliberately: a button done
   in CSS is a rounded corner or a box, and STYLE.md allows a rounded corner
   nowhere — the square corner is the signature. Each button is a filled
   diamond, halftoned — dots on a grid, fat at the centre and thinning to
   the edge — so the one motif the game is made of is also what you press.
   They were circles of diamonds once, and a circle was the one shape on the
   plate that nothing else was; now there is none. And they are not out at
   rest: the hub is, alone, and the four come when it is pressed — see
   `closed and open`.

   The four rings are the letter system (up), the number system (left), home
   (right) and the towns (down). Each is wired to a named seam rather than
   to the thing itself, so this file never learns what a ring opens — see
   `the four seams`, at the bottom.

   It is pinned to the screen while being drawn in world space, which is the
   one piece of arithmetic in here worth reading carefully. The camera moves
   and zooms under it every frame, so both the anchor and every radius are
   recomputed from `G.cam` each frame: the anchor through the same screen →
   world mapping `basemap.js` uses, and the sizes by dividing screen pixels
   by the zoom. Anything held in world units instead would slide off the
   corner of the screen the moment the walker took a step. */

const Hud = (() => {
  /* Only STYLE.md's tokens, in the normalised triples the codebase already
     spells them as: flare from `build.js`, bone from `palace.js`, and ground
     exactly as `render.js` clears to. Nothing new is introduced here — a HUD
     is the easiest place in a game to smuggle an eleventh colour in, and
     three colours is all four rings need, because what tells them apart is
     position and what marks one is inversion. */
  const BONE = [0.93, 0.92, 0.89];
  const FLARE = [1, 0.373, 0.635];
  const GROUND = [0.106, 0.106, 0.129];
  /* the journal's diamond: aqua, STYLE.md's one cool note, the same triple
     `build.js` spends on the route dots — asked for as blue, and aqua is
     the blue this palette has; an eleventh colour is not the answer */
  const AQUA = [0.47, 0.88, 0.85];

  /* Everything below is in CSS pixels, the same unit the panels are laid out
     in, and is turned into world units once a frame. Sized so the ring's
     inner edge clears the hub's points by a few pixels: the rings sit just
     outside the diamond rather than touching it. */
  const EDGE = 16;           // the inset every chrome panel sits at (index.html)
  const LIFT = 132;          // the hub, above the bottom edge of the canvas
  const HUB = 16;            // half-size of the middle diamond
  /* hub centre → button centre. Tight, because the hub is not there when the
     four are: they gather where it stood, near enough to read as one thing
     and far enough apart (12px, point to point) that a press cannot land on
     two. */
  const SPAN = 30;
  const RIM = 24;            // button half-extent, centre to point
  const DOT = 2.3;           // half-size of one dot on the rim, at full size
  const TXT = 2.0;           // letterform pitch for ABC and 123
  const ART = 3.0;           // letterform pitch for the house and the rose
  const GRAB = RIM + 4;      // what counts as a press: the diamond, and a hair more
  /* the journal's diamond stands to the right of the hub, point to point
     with a hair between, and only while the hub is at rest: the four
     ways in gather where the hub stood and would land on it */
  const JX = HUB * 2 + 12;
  /* and build's, in bone, a half-step across and a half-step down from
     the pair — the third point of the diamonds' own diagonal lattice, so
     its edges run with theirs and the three nest point to point: flare
     for the four and aqua for the journal on one level, bone beneath */
  const BX = JX / 2, BY = JX / 2;

  /* ── the diamond of dots ───────────────────────────────────────────────
     A button is a diamond of dots on a square grid: every grid point with
     |i| + |j| ≤ K is in it, and the points with |i| + |j| = K are its edge.
     That is the diamond's own lattice — the edge falls exactly on grid
     points, so the rim and the ground are cut from the one table and the
     rim is the ground's last step and not a separate shape laid over it.

     The ground is a halftone: every dot is a diamond, and its size falls off
     from the centre toward the edge, so the middle — where the label sits —
     is solid, and the button thins into the plate rather than stopping at a
     wall. `s` is that size, as a fraction of a full dot: 1 at the hub of the
     button, `THIN` at its edge. Computed once — the tables never change,
     only their scale does — and a fixed-length table is a worst case you
     can count. */
  const PITCH = 3.2;                       // grid step, the old fill's ring spacing
  const K = Math.floor(RIM / PITCH);       // steps from centre to edge
  const THIN = 0.42;                       // dot size at the edge, as a fraction of the centre's
  const FILLO = (() => {
    const out = [];
    for (let j = -K; j <= K; j++)
      for (let i = -K; i <= K; i++){
        const d = Math.abs(i) + Math.abs(j);
        if (d > K) continue;
        out.push([i * PITCH, j * PITCH, 1 - (1 - THIN) * d / K]);
      }
    return out;
  })();
  const RIMO = FILLO.filter(o => Math.abs(o[0]) + Math.abs(o[1]) >= K * PITCH - 0.01);
  /* The three at rest — hub, journal, build — are the same material as
     the focus column above them (STYLE.md, *The lattice*): not one solid
     diamond each but a diamond-shaped field of diamonds at the plate's
     pitch, each dot 0.75 of the pitch, on ground. KH steps to the edge. */
  const KH = Math.floor(HUB / PITCH);
  const HUBO = (() => {
    const out = [];
    for (let j = -KH; j <= KH; j++)
      for (let i = -KH; i <= KH; i++){
        const d = Math.abs(i) + Math.abs(j);
        if (d <= KH) out.push([i * PITCH, j * PITCH, d === KH ? 1 : 0]);   // [x, y, on the rim]
      }
    return out;
  })();
  const HUB_DOT = PITCH * 0.75;

  /* ── the house and the rose ────────────────────────────────────────────
     Written out as grids, for the reason `type.js` writes its font out: this
     is the art, and art you cannot read in the source is art nobody will
     fix. Seven by seven, because an odd side has a true centre and both of
     these are symmetrical about it.

     They are drawn the same way a letter is — one diamond per lit square,
     into the same instance stream — rather than taken from the marker atlas.
     The atlas is for marker symbols; a HUD made half of diamonds and half of
     textured glyphs would read as two materials at every distance. */
  const HOUSE = ['0001000',
                 '0011100',
                 '0111110',
                 '1111111',
                 '0111110',
                 '0110110',
                 '0110110'];
  /* A four-pointed star, which is a compass rose and is also a diamond with
     arms — the one motif this whole game is made of, so it belongs here. */
  const ROSE  = ['0001000',
                 '0001000',
                 '0011100',
                 '1111111',
                 '0011100',
                 '0001000',
                 '0001000'];

  /* A diamond a shade wider than its own square, so a stroke reads as a
     stroke rather than as a row of separate dots — `type.js` fattens its
     letterforms by the same fraction and for the same reason. */
  const FAT = 0.62;

  /* Up, left, right, down, in that order, as offsets from the hub. Screen y
     runs down, so up is −1. */
  const RINGS = [
    {key: 'letters', dx:  0, dy: -1, text: 'abc'},
    {key: 'numbers', dx: -1, dy:  0, text: '123'},
    {key: 'home',    dx:  1, dy:  0, art: HOUSE},
    {key: 'towns',   dx:  0, dy:  1, art: ROSE}
  ];

  /* where the pointer last was, in client coordinates, so the ring under it
     can be found again after the camera has moved beneath a still pointer */
  let ptr = null;

  /* ── closed and open ───────────────────────────────────────────────────
     At rest the HUD is the hub alone: one flare diamond in the corner, and
     nothing else on the plate. Press it and it goes, and the four ways in
     stand where it was; press one of them, or anywhere that is not one of
     them, and the hub is back. So the corner costs one diamond of the plate
     until the moment you want more of it, and the four never sit under
     your eye while you are walking. */
  let open = false;

  /* ── when the HUD is not there ─────────────────────────────────────────
     `index.html` hides the chrome under `body.wall` (wallpaper duty: no
     chrome at all) and under `body.locus` (one photograph owns the screen);
     this is the same rule, kept in step by hand because a thing drawn on the
     plate cannot be hidden by a stylesheet. The pause card is the third: it
     covers the viewport, and a HUD showing through it would be chrome on top
     of the one screen that is meant to have none. */
  function shown(){
    if (!G.terr || WALL || G.paused) return false;
    if (typeof Loci !== 'undefined' && Loci.opened()) return false;
    return true;
  }

  /* ── screen → world, once a frame ──────────────────────────────────────
     `VW`/`VH` are the canvas's backing-store size, which on this machine is
     larger than its CSS size by the device pixel ratio — so the ratio is
     read off the canvas the same way `basemap.js`'s `sync()` reads it,
     rather than from `devicePixelRatio`, which is the number the renderer
     was capped away from.

     `u` is the width of one CSS pixel in world units. Every size below is
     multiplied by it, which is the division by `G.cam[2]` that holds the
     HUD at a constant size on screen: zoom in and the world shrinks under
     it by exactly as much as `u` grows. */
  function geom(){
    if (!R || R.lost || !canvas) return null;
    const b = canvas.getBoundingClientRect();
    if (!b.width || !b.height) return null;
    const dpr = VW / b.width;
    const z = G.cam[2] || 1;
    const u = dpr / z;
    /* the anchor written the long way round — screen pixel → world — so it
       is the same mapping as `toWorld` below and can be checked against it */
    /* Bottom-left, because it is the one corner nothing permanent claims:
       #hud is top-left, #tune and #route top-right, #keys bottom-right.
       #palette takes this corner in build mode, where a HUD is not what
       you are looking at anyway. The lift clears #toast, which shares it. */
    const ax = EDGE + SPAN + RIM, ay = b.height - LIFT;
    return {b, dpr, z, u,
            x: (ax * dpr - VW / 2) / z + G.cam[0],
            y: (ay * dpr - VH / 2) / z + G.cam[1]};
  }
  const toWorld = (ev, g) => [((ev.clientX - g.b.left) * g.dpr - VW / 2) / g.z + G.cam[0],
                              ((ev.clientY - g.b.top) * g.dpr - VH / 2) / g.z + G.cam[1]];
  const centre = (g, ring) => [g.x + ring.dx * SPAN * g.u, g.y + ring.dy * SPAN * g.u];

  /* ── what it costs ─────────────────────────────────────────────────────
     Counted rather than guessed, because `overlay` is handed a cap and half
     a HUD is worse than no HUD: it draws the whole thing or none of it, and
     this is the number that decides which. Everything in it is a fixed-length
     table or a fixed string, so the worst case is exact — the hub, the four
     rims, the four grounds, the four labels, and the one ring that can carry
     the hover wash at a time.
     Measured on the letterforms themselves so it cannot drift if the font
     does. */
  let budget = 0;
  function cost(){
    if (budget) return budget;
    let n = 3 * HUBO.length + RINGS.length * (RIMO.length + FILLO.length) + FILLO.length;
    for (const r of RINGS){
      if (r.text) n += Type.cost(r.text);
      else for (const row of r.art)
        for (let c = 0; c < row.length; c++) if (row[c] === '1') n++;
    }
    return (budget = n);
  }

  /* ── drawing ── */
  function overlay(a, m, cap){
    if (!shown()) return m;
    const g = geom();
    if (!g || m > cap - cost()) return m;      // whole, or not at all
    const hov = pick(g, ptr ? toWorld(ptr, g) : null);

    /* the hub wears the flare, the way a panel head does: it is the one part
       that says this cluster is chrome rather than another spark */
    if (!open){
      /* each of the three is a field of the plate's diamonds in its colour;
         build's is only its rim while build is on — the hollow face the
         plate uses for 'here but open', made the same way */
      const on = typeof Build !== 'undefined' && Build.active && Build.active();
      const field = (cx, cy, col, al, rimOnly) => {
        for (const o of HUBO){
          if (rimOnly && !o[2]) continue;
          m = put(a, m, cx + o[0] * g.u, cy + o[1] * g.u, col[0], col[1], col[2], al, HUB_DOT * g.u, 0, 0, 0, 1);
        }
      };
      field(g.x, g.y, FLARE, hov === 'hub' ? 1 : 0.9, false);
      /* and the journal beside it, in the cool note, so the two read as
         two things and not as a hub and its shadow */
      field(g.x + JX * g.u, g.y, AQUA, hov === 'journal' ? 1 : 0.9, false);
      field(g.x + BX * g.u, g.y + BY * g.u, BONE, hov === 'build' ? 1 : 0.9, on);
      return m;
    }

    for (const ring of RINGS){
      const c = centre(g, ring);
      const on = hov === ring.key;
      /* The ring carries its own ground. Every chrome panel does — .glass is
         the plate colour at .72 behind a hairline — and this is that idea in
         the plate's own material, because a label drawn straight onto the
         lattice is only as readable as whatever it lands on. Measured: ABC in
         bone over a white road is not dim, it is gone. */
      for (const o of FILLO)
        m = put(a, m, c[0] + o[0] * g.u, c[1] + o[1] * g.u,
                GROUND[0], GROUND[1], GROUND[2], 0.72, DOT * 1.5 * o[2] * g.u, 0, 0, 0, 1);
      /* Hover is the faintest bone wash and nothing more. Inversion is what
         selection means here, and a ring you are merely pointing at is not
         selected — spend inversion on hover and there is nothing left to say
         'this one' with. */
      if (on)
        for (const o of FILLO)
          m = put(a, m, c[0] + o[0] * g.u, c[1] + o[1] * g.u,
                  BONE[0], BONE[1], BONE[2], 0.12, DOT * 1.5 * o[2] * g.u, 0, 0, 0, 1);
      for (const o of RIMO)
        m = put(a, m, c[0] + o[0] * g.u, c[1] + o[1] * g.u,
                BONE[0], BONE[1], BONE[2], on ? 1 : 0.55, DOT * g.u, 0, 0, 0, 1);
      const col = BONE;                 // the label reads against its own ground
      const al = 0.85;
      if (ring.text)
        /* `Type` has no lower-case bitmaps, so 'abc' arrives as ABC. That is
           the letter system's name in the type this game has, not a slip. */
        m = Type.centred(a, m, ring.text, c[0], c[1], TXT * g.u, col, al, cap);
      else
        m = stamp(a, m, ring.art, c[0], c[1], ART * g.u, col, al, cap);
    }
    return m;
  }

  /* one diamond per lit square, centred on a point, which is what `type.js`
     does for a letter — the grid is square and odd-sided, so the middle of
     the middle square is the middle of the symbol */
  function stamp(a, m, art, cx, cy, px, col, al, cap){
    const h = art.length, w = art[0].length;
    const x0 = cx - (w - 1) * px / 2, y0 = cy - (h - 1) * px / 2;
    const hs = px * FAT;
    for (let r = 0; r < h; r++)
      for (let c = 0; c < w; c++){
        if (art[r][c] !== '1') continue;
        if (m > cap - 2) return m;
        m = put(a, m, x0 + c * px, y0 + r * px, col[0], col[1], col[2], al, hs, 0, 0, 0, 1);
      }
    return m;
  }

  /* ── the pointer ───────────────────────────────────────────────────────
     Which button a world point is in, or null. The taxicab distance rather
     than a box or a circle, because the thing being hit is drawn as a
     diamond and a target that is not the button's own shape is a button
     that answers where it does not look. */
  function pick(g, p){
    if (!p || !g) return null;
    if (!open){
      if (Math.abs(p[0] - g.x) + Math.abs(p[1] - g.y) <= (HUB + 4) * g.u) return 'hub';
      if (Math.abs(p[0] - (g.x + JX * g.u)) + Math.abs(p[1] - g.y) <= (HUB + 4) * g.u) return 'journal';
      if (Math.abs(p[0] - (g.x + BX * g.u)) + Math.abs(p[1] - (g.y + BY * g.u)) <= (HUB + 4) * g.u) return 'build';
      return null;
    }
    const r = GRAB * g.u;
    for (const ring of RINGS){
      const c = centre(g, ring);
      if (Math.abs(p[0] - c[0]) + Math.abs(p[1] - c[1]) <= r) return ring.key;
    }
    return null;
  }
  /* the same question from outside, in world coordinates, for anything that
     wants to know whether a point belongs to the HUD before acting on it */
  function hit(x, y){
    if (!shown()) return null;
    return pick(geom(), [x, y]);
  }

  function wire(){
    /* Capture phase, for the reason `basemap.js` gives where it lays the
       traced picture down: build mode's own pointerdown sits on the canvas,
       and by the time the event reaches it the shape under the pointer has
       already been grabbed. Getting in first is the only way a press on the
       HUD can be a press on the HUD and nothing else — and the propagation
       is stopped ONLY on a ring, so every other click still reaches build
       mode exactly as before. */
    addEventListener('pointerdown', e => {
      if (e.button !== 0 || !shown()) return;
      if (e.target && /^(INPUT|TEXTAREA|BUTTON)$/.test(e.target.tagName)) return;
      /* and the press has to have landed on the plate. The tag test above is
         the precedent's, and it answers for a field; this answers for the
         panel around it, which is the rest of what is over the plate. */
      if (e.target !== canvas) return;
      const g = geom();
      if (!g) return;
      const key = pick(g, toWorld(e, g));
      /* A press away from the four, while they are out, closes them and is
         nothing else: the press was an answer to the HUD, and letting it
         through as well would make closing a menu also grab whatever shape
         lay under it. */
      if (!key){
        if (!open) return;
        open = false;
        e.stopPropagation();
        return;
      }
      e.stopPropagation();
      if (key === 'hub'){ open = true; return; }
      open = false;
      tap(key);                                // 'journal' included: it has a seam
    }, true);
    /* the same rule for a press that lands on a panel rather than the plate:
       it is a press away, so the four fold back */
    addEventListener('pointerdown', e => {
      if (open && e.button === 0 && e.target !== canvas) open = false;
    }, true);

    /* Hover is tracked in client coordinates rather than world ones: the
       camera moves under a pointer that has not, so the world point beneath
       it is a different point every frame and only the client one is stable
       between moves. A pointer that is over a panel is over the panel and
       not over the plate, and the plate is the canvas — every hint that
       floats above it is `pointer-events:none`, so this test is the whole
       of the panel question rather than a list of the panels. */
    addEventListener('pointermove', e => {
      ptr = e.target === canvas ? {clientX: e.clientX, clientY: e.clientY} : null;
    }, {passive: true});
    /* leaving the window entirely — `pointerout` with nothing to go to —
       rather than `pointerleave`, which does not bubble this far and would
       leave a ring lit for good after the pointer had gone */
    addEventListener('pointerout', e => { if (!e.relatedTarget) ptr = null; });
    addEventListener('blur', () => { ptr = null; });
  }

  /* ── the four seams ────────────────────────────────────────────────────
     The rings were built before what they lead to was decided, and the
     wrong way to handle that is to invent contents for them. Each is a
     named hook instead: set `Hud.onLetters` (and the rest) to a function
     and the ring calls it; leave it null and the ring says, in the note
     channel, that there is nothing there yet. Three of the four are filled
     now, each from the module that owns the destination.

       Hud.onLetters   the letter system — the bag (`src/bag.js`), opened
                       as `Bag.open('letters')` from game.js.
       Hud.onNumbers   the number system — the same bag, `Bag.open('numbers')`.
       Hud.onTowns     the towns map (`src/towns.js`; `src/atlas.js` sets its
                       chip grid first and towns.js takes the seam over), which sets
                       this itself at init.
       Hud.onHome      the framing below, if something better than framing
                       is ever wanted from the house.

     They are properties on the returned object rather than a `set(name, fn)`
     call because an assignment is greppable: `grep -rn 'Hud.on' src/` finds
     both the seam and whatever filled it. */
  const note = msg => { if (typeof hqNote === 'function') hqNote(msg, false); };

  function tap(key){
    if (key === 'letters')
      return api.onLetters ? api.onLetters()
        : note('the letter system has nothing in it yet — Hud.onLetters is where it opens');
    if (key === 'numbers')
      return api.onNumbers ? api.onNumbers()
        : note('the number system has nothing in it yet — Hud.onNumbers is where it opens');
    if (key === 'towns')
      return api.onTowns ? api.onTowns()
        : note('the towns list is not built yet — Hud.onTowns is where it opens');
    if (key === 'journal')
      return api.onJournal ? api.onJournal()
        : note('the journal is not built yet — Hud.onJournal is where it opens');
    if (key === 'build')
      return api.onBuild ? api.onBuild()
        : note('build has no switch here — Hud.onBuild is where it goes');
    return home();
  }

  /* ── home ──────────────────────────────────────────────────────────────
     The house pulls back to the whole town.

     The camera is a target that is lerped toward, so `G.cam` is never
     written directly — the next frame would overwrite it. But only two of
     the target's three components can be set from out here, and the pair
     that names a place is not among them: `game.js` rewrites `G.camT[0]`
     and `[1]` from the walker on every frame it follows, which HANDOFF
     records as the trap that makes a hand-placed camera do nothing. They are
     written anyway, because they say plainly where this means to look and
     because they are what would carry the moment the camera stops following
     the walker — but they are not what makes this work today.

     The zoom target is. Nothing overwrites `G.camT[2]`, and pulled back to
     `G.fitAll` the view is wider than the plate — at which point `game.js`
     centres it on the plate itself rather than on the walker, by the same
     clamp that framed the town on the first frame. So the house frames the
     town, and it does it through the one component that holds. */
  function home(){
    if (api.onHome) return api.onHome();
    G.camT[0] = G.W / 2;
    G.camT[1] = G.H / 2;
    G.camT[2] = G.fitAll;
    note('the whole town');   // said, because a camera that moves on its own owes you a reason
  }

  function init(){ wire(); return cost(); }

  /* the same presses from the keyboard — the focus column walks down
     onto the hub and presses what it stands on (src/focus.js) */
  function press(key){
    if (key === 'hub'){ open = !open; return; }
    open = false;
    tap(key);
  }
  const api = {init, overlay, hit, cost, press,
               opened: () => open, fold: () => { open = false; },
               onLetters: null, onNumbers: null, onTowns: null, onHome: null,
               onJournal: null, onBuild: null};
  return api;
})();
