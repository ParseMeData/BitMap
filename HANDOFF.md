# Handoff

Written 24 Aug 2026 at tag **v5.0**; the log at the head brought up to
30 Aug 2026, build 223, past tag **v8.1**. Read `README.md` for how any
single thing works, and `STYLE.md` before changing anything you can see;
this is the shape of the whole and the things that are not obvious from
the code. **A fresh session starts at *Where we are*, then *Working on
it*, then `QUEUE.md`.**

---

## What the game is

A memory palace you build and then walk, made of diamonds.

It works at three scales, and the same editor draws all of them:

**The town.** A field of diamond glyphs over a real map you traced — currently
Myrtleford, Victoria, laid down as a frozen dark picture you position by hand
like tracing paper. You draw roads, water, creeks, parks, trees and districts
over it, and the walker steps along the routes you drew.

**The palace.** Every marker on the town is a place you can walk into. Press
`Enter` beside one and the plate becomes that building's floor plan — the same
lattice, the same walk grid, the same walker, on a different set of shapes.
You do not draw the rooms: you *type* them, one to a line, and the plan lays
itself out and furnishes itself.

**The locus.** Every marker *inside* a palace is a numbered place holding a
picture of what stands there — one a hand statue, two a sculpture of Roman
faces, three the television. That is the method: the order is fixed, and each
place in it holds an image.

**And then you run it.** `P` hands the ordered run of locus pictures to
`platformer.html`, which plays them as a chain: two pictures on screen, the
left whole and the right empty, and you carry the left across a cluster at a
time until the right is built — then that picture becomes the next one you
empty. You walk the palace as a game made of the same diamonds.

The point of the whole thing is the **route**. Everything that looks like a
constraint is protecting it: rooms are laid out so consecutive ones are always
neighbours, loci are numbered by hand rather than inferred, and the panel tells
you how many rooms the walker can actually reach.

---

## Where things are

    ~/Projects/memory-quest-le          this project
    ~/.cache/memory-quest-le            the browser profile — where the town lives
    ~/.cache/memory-quest-le-wall       the wallpaper's own profile, made the first
                                     time `./wallpaper.sh start` runs
    ~/Projects/halftone-platformer   upstream for platformer.html; still its own project
    origin                           https://github.com/ParseMeData/BitMap.git —
                                     the `work` branch pushes to `main` there, and
                                     GitHub Pages serves `main` at
                                     https://parsemedata.github.io/BitMap/ (the web
                                     version; see README *On the web*). Made
                                     2026-08-28; the older memory-quest-le remote
                                     is not configured on this box.

**The moment the desktop plate runs there are two towns, not one.**
`wallpaper.sh` launches on that second profile and opens no debugging port —
its argument parser takes nothing that would add one — so `snapshot.py` cannot
attach to it, and whatever gets built in the plate is in no snapshot and no
tag, and does not appear in the town you play. As of v5.0 the plate has never
been started on this machine: there is no `~/.cache/memory-quest-le-wall`, and no
Memory Quest Low Effort rule in `~/.config/kwinrulesrc`.

`platformer.html` here is a **copy** of the halftone platformer's shipped file
plus a deck hook. Edits upstream do not propagate, and edits here do not go
back.

Run it with `./play.sh`. Add `--remote-debugging-port=9222` to drive it (see
*Working on it*).

---

## Where we are — 5 Sep 2026, build 265 (tag **v8.4** at 264)

- **Build 265 (5 Sep 2026) — Eden's compass tune is the default.** The
  profile was wiped a second time that day to watch a first boot (the
  town saved first to `snapshots/live-2026-09-05-barwidgee.json`,
  untracked, compass tune and all), and the compass came up on the plain
  cut. Eden: *"save the settings we had copied across to the compass as
  the refresh brought back the very original version"*. The saved tune —
  bottom: dim, Screen .5, Fill 60%, Scatter 55%, Jitter .7; middle: dim,
  Bright 70%, Screen flat, Weight 1.1, Fine .75, Fill 60%, Scatter 10%,
  Jitter .6; top: bone, Bright 150%, Screen .35, Weight 1.2, Scale 1.2,
  Fine .55, Fill 100%; ring: aqua, Bright 150%, Weight .85, Tone 1, Fill
  25%, Scatter 25%, nudged 1 left and 1 down; shared rows untouched —
  is now each layer's `<key>0` in `LAYERS`, which is what `ltuned`
  answers when nothing is saved. Verified on the fresh profile with only
  the compass's place written back: every row of the block reads the
  tune. A profile that has its own tune saved is unaffected.

- **Build 264 (5 Sep 2026) — tag v8.4.** The version cut on Eden's word
  after a restart had shown every setting come back: `snapshots/v8.4.json`
  beside the tag (15 shapes, 1 marker, no interiors, no locus pictures,
  the baked picture 494 KB — the Barwidgee founded that morning on the
  fresh profile, with the compass tune as Eden left it), the title and
  the README's name moved up to V8.4, the README's history given v8.2–v8.4,
  and a frozen clone at `~/Projects/Loci Bitmap V8.4`. Builds 256–263
  are the version: the 16:9 plate and the small rim, the founding
  frame's return, the covering zoom, and the compass in four sheets with
  its per-layer tune.

- **Build 263 (5 Sep 2026) — a Sheen per compass layer, down its ink.**
  Eden: *"add the same gradient effect to the top layer that matches the
  existing town title"* (and the lattice `T` pasted again as the wanted
  default: it is `defTune()`, the DIALLED preset and what the panel's
  Reset restores, value for value — nothing to set). The title's
  gradient is `Title.emit`'s sheen: alpha falling by `shade` (0.25)
  from the top row of the face to its foot, and a word's face is its
  line box. The compass passed the same shade but its faces are the
  cut's box — for the top layer 57 rows of which the spike is most, for
  a burst a box twice its height — so the fade was thin on the spike and
  half missing on a burst. `composed()` now trims each face to its
  ink's rows (`top`, `rows0` carry the placement), so the sheen runs
  down the drawing as it runs down the word; and per layer **Sheen**
  (0–2× on the shared one, capped at 0.7) so the spike can carry more or
  less of it than the rest. Verified on a throwaway at Size 64: ×0 flat,
  ×1 bone-to-grey down the spike as on "Barwidgee" beside it, ×2
  stronger. 47 rows in the block.

- **Build 262 (5 Sep 2026) — a Scale per compass layer.** Eden: *"allow
  setting for top layer scale to make it slightly larger"* (and, in the
  same message, the lattice tune `T` pasted as the wanted default — it
  is `defTune()` value for value, and the live plate runs it with no
  tune saved, so nothing changed there). Per layer **Scale**
  (0.5–2×) on the shared Size: `colsOf(l)` is what a layer's stencils
  are cut at, in both keys. A scaled layer is on another grid, so
  `composed()` masks by PLACE now — a cell's position in cells from the
  one centre every cut is drawn about, to the nearest cell — instead of
  by grid index between faces on one grid; the "same grid" guard is
  gone with it, so a cut still on its way at the old heading masks at
  the old angle for a frame or two rather than not at all. Verified on
  a throwaway over the grass: top Scale 1.3 stands larger about the
  ring's centre with the bursts still hidden under it (fill on), 0.8
  smaller, 1.3 with Fill clear lets them through, turned 34° it stays
  centred. 43 rows in the block. No errors.

- **Build 261 (5 Sep 2026) — a Fill under each compass layer, and more
  texture per layer.** Eden: *"more variation for styling like dithering
  scattering, and I want the top layer's inside to not be transparent,
  still keeping matching background colour as it's internal background
  detail"*. Per layer now: **Fill** (the layer's whole silhouette
  painted in the ground's colour under its ink, a fifth heavier than
  the ink so the diamonds close, flat, no sheen — the layers beneath
  give way to the whole silhouette rather than only the drawn cells,
  and the terrain under the compass is put out; on for the top layer by
  default via `fill0`, clear for the rest), a **Grain** chip row (Plain,
  Checker, Lines, Diagonal — patterns on the face's own grid, which is
  the plate's, so they stay square as the map turns), **Tone** (added
  to the shared one), **Scatter** (cells thrown away by `Kinds.hash`,
  seeded per layer) and **Jitter** (`Title.emit`'s shake, up to half a
  cell). The fill needs the silhouette, so `wantPlates` asks a second
  stencil per layer — the same drawing flat-cut with no floor
  (`foots`) — and `composed()` carries a `foot` per entry and keys on
  grain, scatter and fill as well; Weight, Tone, Jitter and the nudge
  are still read at draw time. The block is 39 rows and 48 chips now
  (five shared, then per layer two chip rows and eight sliders, and the
  ring's two nudges). Verified on a throwaway with the compass moved
  onto the grass (`at: [520, 300]`): Fill on hides the gold and the
  grass inside the spike; Fill off lets them through; Diagonal grain +
  Scatter 30% + Jitter 0.6 reads as a dark hatched cross; Lines + Tone 1
  as ruled; the ring takes Checker. No errors. Not tested: the block on
  a phone — it is long now.

- **Build 260 (5 Sep 2026) — the compass centred on its ring, and each
  layer's Weight, Fine and (the ring's) nudge.** Eden: *"an option in
  tuning to slightly change thickness of circle pixels (fade so looks
  finer, as of now appears to be 2 pixels wide) — also want to move the
  circle left right up or down to align better — and the top layer's
  detail visible tuning so can see the points better and line detail"*.
  Found on the way: 259 cut every sheet in the box the cross fills,
  whose centre is 25 px above the ring's, and the stencil turns a
  drawing about its box's centre — so the rose orbited the ring as the
  map turned, which on a plate the survey had turned 28° was the
  misalignment. `tools/compass.py` now cuts every sheet in a 224 × 318
  box centred on the ring (`-extent`, padded with nothing top and
  bottom; the ring's centre (159, 163), the spike's crossing (156, 162)
  and the bursts' (153, 164) are concentric to within a cell); verified
  at −28°, 0°, 90° and 180°: the rose spins inside the ring. The ring
  was two cells wide because the type's recipe stretches what it reads
  to its 4th–96th percentile, which brings a thin line's half-covered
  side cells up to full ink; the compass passes `recipe: {lo: 0, hi:
  0.999}` so a cut is read as covered. `Title.stencil` takes `cut`, a
  floor under the ink after screening (`screen()`'s last test), exposed
  per layer as **Fine**. Per layer also **Weight** (on the shared one),
  and for the ring **Left – right** / **Up – down** in whole cells, read
  at draw time. The top layer's cut is no longer keyed: its alpha is its
  tone, lines at full, the white body at three tenths (`BODY`), so the
  points stand as a shape — at 40 cells the body reads ~0.5–0.7 and the
  line-dense cells 0.9+, so Fine 0.7 strips it to a one-cell cross;
  Tone textures it. The hatching does not resolve at 40, 72 or 100 cells
  (stencilled and looked at): a hatch period is under a plate cell at
  any size the corner holds, so "line detail" is the fill-and-line
  contrast and the textures, not lines. Size's ceiling is 120 cells.
  Verified on a throwaway: 23 rows and 32 chips in the block; ring Fine
  0.5 + Weight 0.7 + Left – right +2 took effect and saved. Eden's live
  profile carries a 259 tune (`hq.compass`, no layer tune yet), which
  reads fine under 260.

- **Build 259 (5 Sep 2026) — the compass in four layers, four inks.**
  Eden drew the rose as four sheets (`~/Desktop/compass layers`, 317 ×
  280, in register: Bottom, Middle, Top, Outer Circle) and asked: *"wire
  them in, each layer its own ink, ring stays still — allow for tuning of
  each layer to make sure each layer's visible"*. They are
  `assets/compass/{bottom,middle,top,ring}.png`; `assets/compass.png` is
  gone (the Desktop copy is byte-identical; git has it). `tools/compass.py`
  cuts each on its own to the one box the cross fills (224 × 268 at
  +47+4 — the old sheet's size, so Size means what it did), keying
  white out of the top layer only (its hatching is the drawing; the ring
  is white and keying would delete it), and flattens the four to `rose`
  for the chrome canvas the tune panel reads. `src/compass.js`: `LAYERS`
  in drawing order, `INKS` (bone, gold, flare, aqua, dim, grass, water,
  sand — the game's own numbers), a stencil per layer (`wantPlates`),
  the ring cut at 0° whatever the heading, and `composed()` — rebuilt
  only when a cut or a tune changes — which drops a turning layer's
  cells where a layer above it has ink (same Size, same heading, same
  sheet size → one grid, cell for cell; faces on different grids never
  mask). Defaults: bottom dim, middle gold, top bone, ring aqua. The
  Tune panel's Compass block is the shared rows (Size, Weight, Tone,
  Sheen, Detail — `bri` dropped from view, it only ever fed the hidden
  chrome canvas) then a heading, an ink chip row and Bright/Screen per
  layer; kept as `layers` in `hq.compass`. Verified on a throwaway:
  founded, no errors, 13 rows and 32 chips in the block; clicking Flare
  on the top layer and Bright 0 on the bottom took effect and saved;
  with the map turned 34° the ring's diamonds did not move while the
  rest turned. Not tested: a phone's tune panel with the longer block.

- **Build 258 (5 Sep 2026) — the resting zoom covers the screen.** Seen
  on Eden's window after 256: the app window is 1280 × 670 inside (the
  title bar has the rest of a 1280 × 720 screen), wider than 16:9, and
  the resting zoom — the plate's height filling the screen — stood the
  plate with a 44 px bar of nothing either side. `home()` now takes the
  larger of the two fits (`cover()` in game.js): the plate fills
  whichever axis is tighter and the camera carries you along the little
  it overflows on the other — 49 units top to bottom here — so the ground
  reaches all four edges on a desk, and a phone held portrait is
  unchanged (height fills, plate wider than the screen). TAB is still
  fit-all. Verified on Eden's window: the plate's left edge at 0 px and
  its right at 1280, and the founding frame back up after the reload —
  257 doing its job live.

- **Build 257 (5 Sep 2026) — the founding frame comes back after a
  reload.** Found on the way to 256, on the profile that had just been
  wiped: the search writes the place it found before anything is
  printed, and `Found.check()` read a saved place as "founded" and stood
  down — so a window closed at the frame (the very first thing a new
  profile shows) booted to the live tiles, the compass and no panel, and
  the only way on was `M` and the map bar's own Freeze. `check()` asks
  `Basemap.placed()` instead: an empty home plate with a place but no
  picture is a frame that was never printed, and it goes back up at that
  place, as dragged and zoomed, without searching again. Verified on a
  throwaway: reload at the frame, the panel is back with the address.
  What this changes for *Later*: on an empty home plate it dismisses the
  frame for the session only, and the next boot puts it up again —
  an empty plate has nothing else to offer (the first-run-note thread
  below).

- **Build 256 (5 Sep 2026) — the plate is the screen; the rim is born
  small.** Eden, on a profile wiped that morning to start clean (the live
  town saved first to `snapshots/live-2026-09-05-before-wipe.json`,
  untracked): *"make it so the border or boundary is not cut off on the
  right side … set frame to full screen but actual feathered grass border
  much smaller so can be expanded later"*. That decides the first Open
  thread: the plate goes to **16:9** (`PLATE_ASPECT` in game.js;
  `PLATE_EXT_COLS` is worked out from the sheet at boot, 231 columns
  today) — 1281 × 720 world units, 407 × 228 cells, 102 × 57 tiles — the
  cheap half, rightward only, **no coordinate migration**: a town written
  before this restores at the same coordinates in the plate's left three
  fifths. Nothing measures off the sheet any more: the live tiles and the
  print hang off the plate's centre (basemap.js — the address lands
  mid-screen), the marker's fallback and the frame's fallback oval
  (found.js) likewise, the town's name stands two tiles in from the
  plate's right edge instead of running off the sheet (palace.js), and
  `G.sheetW` is gone. `Survey.boundary()` is an oval at the plate's
  centre, half the width and seven tenths the height, core 0.55 as
  before, its whole fade on the plate; the grass is laid in six rects
  (three by two) because the plate is 93 000 cells now and a quarter of
  it would have crowded `MAX_CELLS`. `MAXSPAN` in build.js is the plate's
  long side and half again in whole tiles (it was sixty tiles — the old
  plate's width), so the rim can be pulled out past the edge the way the
  survey once laid it. The region's projection scales off the plate's
  shorter side, so the wider plate shows more east–west rather than less
  north–south.

  **Measured** on the rig, headless throwaways at 1600 × 944 running side
  by side: build 255 founded, 60 ms a frame at fit-all; build 256
  founded, 53; build 256 with nothing on the plate but tiles, 49. The
  headless GL is the cost; the bigger field is not. **Verified** on a
  throwaway: founding at the default address lays 8 roads, 1 water, 6
  grass, the rim and the house at the centre of the screen, the name in
  the top-right corner; in build mode the rim grows with `]` (two cells
  a press — it is a fine-mode shape) past the old sixty-tile cap. **Not
  tested:** a phone; a pre-256 town restored onto the wide plate (the
  arithmetic says it lands left; nothing has been looked at).

- **Builds 250–255 (2 Sep 2026) — "continue floor plan view".** Six asks
  from Eden, worked run-through in the order given, each on the throwaway
  on 9223 before it was committed.

  **250** — a ghost is somewhere to put a number down: a square dropped on
  a taken-out place carries its number across and leaves its own square
  out, held as a trade so the numbers between the two cuts stay put.
  **251** — a palace has a **kind**: sequence, scattered or looped
  (`hq.trace.<uid>.kind`), chosen on the palace panel where a palace is
  started and again on a strip at the top centre of the minimal view.
  Scattered is dealt by `Kinds.hash(place, seed)` with the seed a fold of
  the uid, so it is the same deal every visit; a hand swap still applies
  over it.
  **252** — the **wheel walks the numbers**: `V` puts the walker on place 1
  and each notch carries them to the next place in the palace's order,
  wrapping when looped; WASD drops the perch (`G.perch`) and the rail is
  back to the road when the view is off.
  **253** — a room too small to read gets a **card**: rooms whose squares
  are under four cells get their caption and eight squares drawn outside
  the walls at five cells a square, a dotted line back to the small grid,
  in the nearest clear spot round the block (rooms cost a line two card
  widths to cross, cards half). The card's squares *are* the places —
  click opens, drag trades — and undo covers it.
  **254** — room captions leave the 5×7 diamond type for the chrome's
  `--mono` on a 2D sheet over the plate (`#type`, the focus column's
  route), a fifth taller, still sized to the tile; under seven device px
  of cap the number stands alone. STYLE.md's lattice table records the
  exception. Cards grow to the measured caption.
  **255** — the `Inside · Esc leaves` banner shows over the pause screen
  only (`body.paused`); the kind strip takes its slot at 52px.

  Not tested on the way: reseat of markers with slots after a kind change
  (the throwaway palace has none); the kind strip and cards on a phone.

- **Build 249 (31 Aug 2026) — the walking line retired; the room in hand
  follows the hand.** Eden reported "an artifact over the first room…
  small dotted line with yellow diamond (unable to edit or remove)" and
  asked that selecting another room move the highlight. The artifact was
  the TRACE's own walking line — aqua dots through the fittings with two
  gold ends, advanced by walking to its end — a feature from before the
  grid was hand-edited, and pinned to room 1 until walked. It is gone:
  `step()`, `side()`, `fixt()`, the AQUA colour and the line geometry all
  left trace.js, and game.js no longer calls `Trace.step()`. Pressing any
  square makes its room the one in hand (the weighting the trace used —
  bright vs faint — now keyed to the press, field dimmed 0.3 → 0.22), and
  the choice persists in `hq.trace.<uid>` under the same `room` field the
  trace kept. If the walked trace is ever wanted back, build 248 is the
  last commit that has it whole.

- **Builds 242–248 (31 Aug 2026) — the v8.4 polish run.** Eden: *"I just
  want to focus on functionality and user interface smoothness and back
  end cleanliness. Essentially I want this to feel smoother and not laggy
  or glitchy"*. Seven queue items, worked run-through; every claim about
  speed was measured on the v8.3 town in a throwaway profile first.

  **242** — the web stops re-downloading the game every visit: the
  cache-buster is `?cb=BUILD` over http(s) (per-load `Date.now()` only on
  file://), so Pages serves from cache between builds.
  **243** — `places()` memoised for one task: measured 0.0085 ms a call,
  so the cost was the ~90 allocations an ask, several a frame — not the
  time. The memo drops on a microtask and eagerly in every mutator; its
  clearer is `forget`, because `drop` was already the marker-drop
  resolver.
  **244** — a drag released off the grid no longer trades: the trade is
  judged by a hit-test where the button came up.
  **245** — grid edits join the undo stack: a palace scope's snapshot is
  `{s, m, t}`, the trace restored before the markers remount; turns, cuts
  and trades step, typing taps; ctrl-z answers in the minimal view. Found
  on the way (pre-existing): Interior.enter stamped History's entry while
  the scope was half mounted — this plan's shapes with the town's markers
  — so a gesture before the first quiet-period tap had no "before". The
  entry is now stamped after Markers.mount.
  **246** — the swap chain compacts at the door: fewest pairs that spell
  the same permutation, and a chain holding a suspended pair waits as it
  is.
  **247** — sw.js's VERSION rides the worker's own URL (`sw.js?b=BUILD`),
  so it cannot lag the build again (it had lagged seven).
  **248** — the index and sweep learn the new keys: `hq.trace.<uid>`
  everywhere the other palace prefixes go, and place pictures — which the
  index had been miscounting as orphans since 240. A deleted room's
  residue in the trace key is groomed on the way out, never against an
  empty plan. Audited: no DOM is rebuilt during drags (syncRoute's
  wholesale rebuild runs at gesture ends only); touch on glass stays an
  open thread.

- **Build 241 (31 Aug 2026) — tag v8.3.** The version cut on Eden's word,
  one build after the hand-edited grid: `snapshots/v8.3.json` beside the
  tag (39 shapes, 1 marker, 5 interiors holding 200 shapes, 14 locus
  pictures), the title and the README's name moved up — they had been
  left saying V8.1 through two tags — sw.js's cache moved to `mq-241`,
  and a frozen clone at `~/Projects/Loci Bitmap V8.3`.

- **Build 240 (31 Aug 2026) — the grid edited by hand: click a place,
  drag to trade, and a place carries writing.** Eden: *"allow us to edit
  the floorplan room sequence grid - we want the 3x3 grid to be manually
  edited when clicked (no need to be in the room) - also make it so if we
  drag a square onto another square within that grid the numbers swap -
  also alow for a delete function from within this same mode - then also
  allow when click on that square we have a data entery for that square
  (name - description - notes - image upload/reference)"*.

  **Clicking works from anywhere.** The pointer is taken capture-phase on
  the window, the way the compass takes its drag, and only a press that
  lands on a square is taken — so build mode and the walk lose nothing,
  and none of it needs the walker to be in the room the way `[` `]` `X`
  do. Click opens `#place` (index.html): number, name, description,
  notes, image ref, the picture, and the same take-out/put-back `X` does.
  A taken-out square stands as a faint ghost while the view is up so
  there is something to click to put it back; its number field is
  disabled because a ghost has no number.

  **A trade is a pair of ids, not a renumbering.** Dragging a square onto
  another appends `[idA, idB]` to a `swaps` chain applied on top of the
  derived dense numbering — each pair trades whatever numbers its two
  places are wearing at that point in the chain. So a trade survives the
  turns and cuts around it; a pair whose places are not both live waits
  rather than acts; and dragging the same two straight back pops the pair
  rather than growing the chain. Retyping the number in the panel is the
  same trade with the place wearing that number — the palace cannot be
  typed sparse. The panel's fields land in `data[id]`, saved 400ms after
  the last keystroke; `hq.trace.<uid>` is now `{room, turn, gone, swaps,
  data}`.

  **A place's picture rides the loci store.** Keyed `place:<palace>:<id>`
  through the same `Loci.pick/attach/show/detach` a locus uses — same
  downscale, same IndexedDB, same lattice preview on View — and loci.js
  pings `Trace.picture` when one lands so an open panel can say so. Place
  pictures are not part of the platformer's deck, which stays the loci's.
  `src/trace.js`, `src/loci.js`, `src/game.js` (Esc closes the panel on
  its way through the chain), `index.html` (#place, its CSS). Verified
  over CDP on a throwaway profile against the v8.2 snapshot: click/open,
  type/save, drag/trade, cancel, panel delete from another room, put
  back, renumber, picture attach, Esc — and screenshots of the panel,
  the rings and the ghost.

- **Build 239 (31 Aug 2026) — a room can be turned, a place can be taken
  out, and the colour belongs to the number.** Eden, on the eight:
  *"make it so i can rotate the grid so numbers land in it another place
  — make it so we can delete numbers then as you already have it the next
  available number shows in the next room — in that room the numbers
  colour is always consistant to the original so 1, 11, 21, 31 and so on
  is grouped by white and same with other colour — 0, 10, 20, 30 (make
  this multicoloured rainbow)"*. Three changes, and one of them undoes an
  assumption 238 was built on.

  **The number is no longer an address.** At 238 a place's number WAS its
  identity — `(room − 1) * 8 + i`, fixed — and a marker keyed on it. It
  cannot be, now: the numbering is dense and continuous, so taking a place
  out of the first room moves every number after it down by one, and
  turning a room rearranges eight of them at once. So a place has an
  **id** — `room * 8 + square`, the geometry, which does not move when the
  numbers do — and `m.slot` holds that. `m.n` is read back off the place
  whenever the markers are renumbered, and a locus whose place has gone
  out from under it is set loose (`slot = 0`) rather than left wearing a
  number that is a lie. `places()` returns every square including the ones
  taken out (`n: 0`), because `X` has to find one to put it back;
  `slots()` is the live ones.

  **Turning is a step round the RING, not through the reading order.**
  `RING = [0,1,2,4,7,6,5,3]` — the eight clockwise from the top left —
  because the reading order jumps from the top right to the middle left,
  and turning through it would look like a shuffle rather than a turn. The
  numbers are laid in reading order and the whole arrangement is then
  offset round the ring, so a turn of 0 is `1 2 3 / 4 · 5 / 6 7 8`
  unchanged and each step moves every number one place clockwise.

  **The colour is the number's last digit** — 1 white, 2 green, 3 pink,
  4 blue, 5 orange, 6 red, 7 yellow, 8 black, 9 **gold**, 0 **rainbow**.
  Gold comes back: it was the ninth tone the eight had dropped, and
  *"consistent to the original"* is Eden's own first list. **The rainbow
  is made of the cells, not of a colour** — `BOW` is the same tones in hue
  order (red, orange, gold, yellow, green, blue, pink) laid across the
  square's diagonal as `(i + j) % 7`, so a ten needs nothing that is not
  already on the plate. Bone and dim sit out of it: a rainbow with white
  and black in it is not one. Its number is drawn in bone, and the band
  was chosen without bone in it so that ink always reads.

  **The keys** (Eden picked keys over clicking): `[` and `]` turn the room
  the WALKER IS STANDING IN — there is no selection to get wrong — and `X`
  takes the nearest place out or puts it back. All three do nothing while
  the grid is down. `[` and `]` were already bound in build.js to scale the
  selection, so that pair is now guarded on `!Trace.on()`: the minimal view
  takes them while it is up, where there is no shape to see anyway. A place
  with a locus standing in it is refused rather than quietly emptied.

  **What the palace remembers** grew from a bare integer to
  `{room, turn, gone}` under `hq.trace.<uid>` — the turn each room is at
  and the squares each has had taken out, keyed by the room's own `s.room`
  id rather than its index, so adding a room does not shuffle them. A bare
  integer still reads as the room number, which is what that key held
  before.

  **Two ordering traps, both fixed.** `Interior.enter` mounted the markers
  BEFORE the shapes, so a locus asked for its number while `G.shapes` was
  still the town — the mount order is swapped and `Trace.mount(uid)` runs
  between them. And `places()` mounts the palace's config itself, from
  `Interior.uid()`, because coming out of a palace inside a palace and
  being asked by a marker before the view has ever been up both reach it
  and neither is a good place to have to remember to mount from.

  Verified on a throwaway at 9223 with v8.2 restored, inside ⤊Barwidgee
  (11 rooms): the default is `1 2 3 / 4 · 5 / 6 7 8` with room 2 starting
  at 9 and 88 places; `]` gives `4 1 2 / 6 · 3 / 7 8 5` and `[` takes it
  back, matched against the ring arithmetic worked by hand; three `[` from
  a turn of 2 lands on 7 and gives `2 3 5 / 1 · 8 / 4 6 7`, also matched.
  `X` cuts and the count falls 88 → 87 → 86 with room 2's first number
  following it down 9 → 8 → 7; `X` again puts it back. A place holding a
  locus is refused with the count unmoved. Four loci in room 1 keep their
  ids through a cut and a turn and come out wearing 4, 1, 2 and 5, which is
  the rotated layout with the cut square passed over. Driven by real
  `keydown` events as well as by the API, and the keys are inert with the
  view down. `{"room":1,"turn":{"1":0,"2":2},"gone":{"1":[],"2":[1]}}`
  survives a reload byte for byte and the loci come back on their places
  with the right numbers **without the view ever being turned on**.
  `Interior.leave()` brings the town back whole (39 shapes, 1 marker, slot
  0) and re-entering restores the palace. Screenshots confirm the ten as a
  diagonal rainbow beside 9 gold, 11 white, 12 green, 13 pink, 14 blue,
  15 orange and 16 red. No errors throughout.

- **Build 238 (30 Aug 2026) — a room is eight places, and the minimal
  view is those places.** Eden asked for the 3×3 grid to become somewhere
  you put things: *"toggles each room into a 3x3 grid with 9 tiles which
  we number and place information inside of"*, then, on seeing the nine,
  *"maybe instead we just do 1 - 8 so no middle square"*. Both halves are
  in `src/trace.js` and `src/markers.js`.

  **The squares became slots.** They were nine painted cells in the room
  the trace happened to be up to, numbered nowhere, hit-tested nowhere,
  saved nowhere. Now `gridFor(box)` builds the grid for ANY room and
  `slots()` numbers them on across the palace — room r's slot i is
  `(r − 1) * 8 + i` — so an 11-room palace is a sequence of 88 and its
  length is a fact about the building rather than a count of whatever is
  pinned in it. `slotN(n)` turns the number back into a place, which is
  what makes the sequence walkable, and `drop(x, y, self)` answers where
  a marker dropped at a point belongs.

  **The middle square is not a place** (Eden's second message). The grid
  keeps its 3×3 shape and the centre is skipped, so the eight run round
  the edge of the room — `1 2 3 / 4 · 5 / 6 7 8`. That is the order you
  walk a room in anyway, and it leaves the middle of the floor clear,
  which is where the walker stands and where the line runs: a place there
  would be one you have to stand on top of to look at. Gold, which had
  been the ninth, goes back to being only the tone the end of the line
  wears.

  **The eight tones, and no new colour** (STYLE.md). 1 white `bone`,
  2 green `park`, 3 pink `flare`, 4 blue `creek`, 5 orange `stairs`,
  6 red `rug`, 7 yellow, 8 black. Two of those needed deciding:

  - **7 is gold pulled HALF WAY toward bone.** The palette holds one
    amber, so yellow has to be that amber at a lighter weight — the
    device `focus.js` uses when it pulls a tone toward dim. Built first
    at a quarter, and a screenshot showed 7 and the then-9 as the same
    square twice; at a half it reads as a pale yellow beside the amber.
  - **8 is `dim` #5A5A66, not black** — Eden's call, asked before
    building. The ground is `#1B1B21`, so a true black square is a hole
    in a near-black floor. Charcoal shows unaided and wants no rim.

  A slot's number is drawn in the square's own corner (`0.32`, `0.30` of
  its side), in ground on a light tone and bone on a dark one — the rule
  `focus.js` uses for the letters on its diamonds — and out of the same
  sheet everything else draws text from.

  **A marker lands in a slot.** `Markers.place` asks `Trace.drop` when
  `Interior.inside()`, snaps to the nearest free slot **in the room it
  was dropped in** (a locus never jumps a wall to find room elsewhere),
  and takes that slot's number as `n`. `m.slot` is the whole of what it
  keeps — an absolute address; `0` is every marker on the town. The
  capacity is real: the ninth is refused, **and refused before
  `Stock.pay` is called**, because a place you cannot have is not a place
  you should be charged for.

  `moveTo` re-snaps on a drag; a drag onto a held slot is refused
  silently and the marker stops at the wall, which says so better than a
  note repeated every frame; a drag clear of every room clears the slot.
  `renumber` gives a slotted marker its slot number and numbers everything
  without one AFTER the last slot the plan has, so a free marker can never
  wear a number a slot owns — and it reads that base off `Trace.count()`
  only when `Kinds.scope() === 'floor'`, because entering a palace mounts
  the markers *before* the shapes and `Interior.inside()` is true a moment
  early. `reorder` MOVES a locus rather than renumbering it: to the slot
  before this one, the previous room's last if it is at the head of its
  own, and whatever was standing there takes the slot it came from.

  **`reseat()`** puts a locus back on its slot after the room is resized —
  the slot is the place, so if the place moves the locus moves with it.
  Run from `overlay()`, so it heals at the moment you would notice, and it
  writes only when something actually moved.

  **The view.** Walls, windows, doors and stairs stay (Eden's call: a grid
  with no room around it is one you cannot place yourself in); floor and
  fittings were already out. The line stays but drops from `0.85` to
  `0.28` — it is the thread between the slots, not the subject — and the
  rings on the fittings are gone, which were the clutter this view exists
  to be rid of; the two ends of the line keep theirs. Every room's eight
  are drawn, the traced room at `0.92` and the rest at `0.3`, so which
  room the trace has reached is said by weight rather than by drawing only
  one of them. And **a locus in a slot no longer draws its own number
  while the grid is up** — the square owns it, and both at once was the
  same number twice, the marker's the louder.

  Verified on a throwaway at 9223 with v8.2 restored, inside ⤊Barwidgee
  (11 rooms, 88 slots): the eight lay out as a ring with the centre empty
  and room 2's first slot numbered 9; eight markers fill room 1 as slots
  1–8 and the ninth is refused with the blocks untouched; a drag onto a
  held slot refuses, into a free one re-snaps and renumbers (room 3's
  first is 17), out of every room clears the slot and numbers it 89;
  `reorder` crosses from slot 8 into room 2's 9 and back, and a swap keeps
  one marker to a slot; growing and moving room 1 carried all eight loci
  with it; the slots survive a reload on their squares; `Interior.leave()`
  brings the town back whole (39 shapes, 1 marker, slot 0). No errors
  throughout.

- **Build 234 (30 Aug 2026) — the backdrop behind the name and the
  compass is gone.** Eden: "no longer needed." Builds 232 and 233 laid
  one automatically behind each; `layMat` in compass.js and `layTitleMat`
  in palace.js are out, and so are `Build.backdrop`/`backdropOf`, which
  existed only for them. The town's name now draws with nothing behind
  it at all — not the shape, and not the inline mat it had before 232.

  **What stays.** The `mat` kind, the Backdrop layer and the Modify-row
  chip: a backdrop is still a thing you can place, mould and condense by
  hand, and the more-condensed-the-darker rule is untouched. And INSIDE a
  palace the heading keeps its inline mat — that was never part of this;
  a palace's shapes are its own set and its heading has always had one.

  **The ones already in towns are dropped as the town loads**, in
  `Build.load`, rather than migrated out by the store's ladder. That is
  deliberate: `snapshot.py restore` writes the raw keys straight past the
  ladder, and `snapshots/v8.2.json` — the file beside the tag — has both
  in it, so a ladder step would be defeated by the first restore. Only
  the TAGGED pair goes; a Backdrop placed by hand carries no `matTag`.

  Verified: restoring v8.2.json (41 shapes, 2 tagged mats) at build 234
  gives 39 shapes and 0 mats, and they do not return after a commit and
  reload; a Backdrop placed by hand is 1 mat that survives a reload; the
  title and compass draw clean; no errors.


- **v8.2 (30 Aug 2026, build 233).** Tagged after 45 commits on `work`
  since v8.1, with `snapshots/v8.2.json` beside it and a frozen clone at
  `~/Projects/Loci Bitmap V8.2`.

  **How the snapshot was made, because it is not a capture of the live
  profile.** Eden's own profile has not been written since 27 Aug (before
  v8.1 was taken), so `snapshots/v8.1.json` still is that town — but
  opening the live profile at build 233 would lay the two backdrops into
  it, which is a change to Eden's data that tagging has no business
  making. So v8.2.json is v8.1 restored into a throwaway at build 233 and
  saved back: the same town, as this engine leaves it. Round-tripped into
  a second clean profile before tagging — 41 shapes (2 of them the
  `compass` and `title` backdrops), 1 marker, 5 interiors holding 200
  shapes, 14 locus pictures, the traced picture, no errors.


- **Build 233 (30 Aug 2026) — a road that ends on a palace asks to go
  in.** Walking off a dead end offered *open a plate*, which is right in
  a field and wrong on a doorstep: a road laid up to a palace ends there
  on purpose. `Atlas.end` now asks `doorAt()` first — which is
  `Interior.target()`, the same reach the `Enter` key uses, so the two
  agree by construction — and retexts the one `#edge` box for whichever
  question it is asking: *The door · the road ends at <name>, and that is
  a way in · go inside*, against *The end of the road · … · open a
  plate*. `yes()` calls `Interior.enter(mk)` and **falls through to the
  plate question if it will not open**, so the keypress is never dead.

  The wording is set per ask rather than at creation, because the box is
  built once and reused; verified both ways round in one session, so the
  retext is not one-directional. `mk.name` is what Interior's own `label`
  would show, so the two prompts read the same.

  Verified: standing on ⤊Barwidgee, `Atlas.end` gives the door prompt and
  `Enter` goes inside (scope `floor`, the palace plan loaded); standing
  in a field it gives the plate prompt unchanged; `Interior.leave()`
  brings the town back whole (41 shapes, 2 mats, 1 marker).

  **Harness note:** a synthetic `Escape` does not leave an interior — but
  it does not on the ordinary `Enter`-key path either, so it is the
  synthetic event routing and not this change. `Interior.leave()` is the
  way out when driving over CDP.


- **Build 232 (30 Aug 2026) — the backdrop is a shape.** The mat behind
  the town's name and behind the compass was drawn inline by `Title.mat`
  every frame, locked to whatever it stood under. It is now a kind —
  **`mat`, "Backdrop"** — on a **layer of its own** (`{id: 'mat', z: 4}`,
  above roads, because that is where the inline one was drawn: after
  every shape, so a name over a road read on the plate and not through
  it). It selects, moves, warps and deletes like anything else, and the
  eye beside its row hides every backdrop at once.

  `kinds.js backdrop()` is the old recipe cell for cell — the rim
  lottery (`roll > e * 0.85 + 0.05`), the rolled cover
  (`0.3 + 0.7 * roll`) and the rolled size (`0.8 + 0.5 * roll`) — so a
  backdrop at its born size is the mat that was there before. Verified
  against a before/after screenshot of the whole plate: unchanged.

  **The more condensed, the darker** (asked for): cover is scaled by
  `sqrt(matRef / area)`, where `matRef` is the shape's birth area in
  cells. Born, the ratio is 1 and the cover is exactly what it was;
  squeezed to a quarter of the ground it draws twice as dark. Clamped
  0.55–2.4 so neither extreme is a black tile or nothing at all.

  The two the game lays for itself are tagged `matTag: 'title'` and
  `'compass'` and sized to the oval `Title.mat` used to draw
  (`rx = cols/2 * 1.4 + 8`, `ry = rows/2 * 2.1 + 8` cells). Both ASK
  `Build.backdropOf(tag)` every frame rather than latching — `G.shapes`
  is swapped whole when the plate changes, and a latch would leave every
  plate after the first without one. The title's is laid on a
  `setTimeout` because `title()` runs INSIDE the instance build and
  making a shape runs `changed()`.

  **INSIDE a palace the mat is still drawn inline.** A palace's shapes
  are its own set, the heading there is a room's name, and one detached
  backdrop per plate is what was wanted.

  **A bug this introduced and how it was caught.** A home plate founds
  itself unasked only while it is EMPTY, and `Found.check` refused any
  plate with a shape on it — so the compass's backdrop, laid in the gap
  between the page loading and the founding starting, stopped the town
  being founded at all. Seen by pressing `Shift+R` and watching a blank
  page sit there with one shape on it and `Found.state()` null. Fixed at
  both ends: nothing is laid until the plate holds something that is not
  itself a backdrop, and `Found.check` now ignores mats. Re-verified —
  `Shift+R` reaches `framing` with 0 shapes.

  (Unrelated but worth knowing: on a profile that has a `hq.basemap`
  position, `Found.check` returns false on `lat || lon` before it ever
  reaches the shape test, so a fresh profile does not auto-found. That
  is pre-existing, not this.)


- **Build 231 (30 Aug 2026) — Warp box, beside Warp oval.** The shape
  row is now Rect · Oval · **Warp oval** · **Warp box** · Line · Ring.

  `rectBlob` grew from four points to **eight** — a corner and the
  middle of each side — which is what Eden asked for: the midpoints are
  what let a box be pulled into a cross, a wedge or an L without adding
  points first. Both seeds go round the perimeter in order, because the
  blob is read as a polygon (`geo.depth`) and a shuffled run would cross
  itself.

  **`warpbox` is a seed, not a type.** It is in `AREA` so `retype` will
  accept it, and `defaults()` turns it into `type: 'warp'` with a box
  blob — so every `type === 'warp'` test in build.js and kinds.js keeps
  meaning what it meant, and a town saved with one loads into a build
  that never heard of it. `blobSeed` (`'oval'`/`'box'`) is carried
  through save and load purely so the palette lights the right chip.

  Two things that needed fixing for the pair to work: `retype`'s
  "already this shape" guard was `sel.type === type`, which made Warp
  oval a no-op on any warp — a box could be made and never turned back;
  it now asks the seed for the warps and the type for everything else.
  And `make`'s repair path seeds `blobSeed: 'oval'` so a warp from
  before this build lights Warp oval rather than nothing.

  Verified at 231: a placed clearing is `demolish/warp(8pt, box)` with
  Warp box lit; retyping box → oval → Rect → box round-trips and lights
  correctly each time; dragging corner 0 out and edge-midpoint 5 in gave
  a sharp spur and a deep notch with the cut following exactly; the
  edited shape survives a reload with its seed and points; one Ctrl+Z
  still removes a print and its clearing together; Patterns still gets
  no clearing; a warp made the plain way still seeds 8 oval points.


- **Build 230 (30 Aug 2026) — a clearing is a warp seeded on its four
  corners, and the founding's is one too.** Two asks, one change.

  `blobFrom` (eight points round the inscribed ellipse) is now one of
  **two** seeds. The new `rectBlob` is four points, one per corner, and
  it is what a clearing is born with: the box is the honest default
  under an asset, it covers the print's own corners, and dragging a
  corner out of it makes a SHARP quadrilateral rather than pulling on a
  curve. The oval keeps its own door — a warp made any other way (the
  Warp chip, a retype) still gets `blobFrom`, verified: the chip path
  returns 8 points, `rectBlob` 4.

  It stays a *warp* and not a rect shape because only a warp's boundary
  is the cut: a rect's free corners move the outline while the wedge
  clears the rest of the rectangle anyway (see build 229).

  `Found.generate` now lays the first palace's clearing through the same
  `Build.rectBlob` — same kind, same five numbers, same shape — so the
  founding's clearing and a hand-placed one are finally one thing. Both
  seed the blob AFTER `make`/`Build.add` has settled the size, because
  `ss` snaps it: seeding from the size asked for left the blob 3 units
  narrower than the shape reported.

  Regression-checked at 230: Buildings gives `demolish/warp(4pt)` +
  `building/rect`, one Ctrl+Z removes both, Patterns still gets no
  clearing, the Warp chip still seeds 8 points, no errors. The founding
  path was exercised by making the exact call `found.js` makes (a real
  Generate needs the Overpass survey, which a headless `file://` page
  cannot reach).


- **Build 229 (30 Aug 2026) — a new clearing is born a WARP.** Asked for
  directly, after 228 laid out the choice. `clearUnder` now makes
  `type: 'warp'` instead of `'rect'`; `make` seeds the blob with
  `blobFrom(w, h)` — eight points on the ellipse inscribed in the box —
  so the clearing keeps the width and height the rect had (a point sits
  at ±w/2 and ±h/2 on the axes) and only its shoulders come in. At 1.5×
  the print it still covers the print's own corners with room to spare.

  Why it is the better handle: a rect's free corners only move the
  outline, because outside the quad but inside the rectangle is the
  wedge, where the ground is spent out rather than spared — with
  `out: 1` the whole rectangle clears whatever the corners say. A warp is
  bounded by its blob and nothing else (`geo.depth` reads the polygon),
  so the cut stops exactly where the shape does; and every point is a
  grip, with leg midpoints adding new ones. Verified: dragging one point
  pulled the clearing into a teardrop and the cut followed it, soft rim
  and all.

  `Found.generate`'s clearing under the first palace is deliberately
  left a rect — laid once at Generate, and the look already signed off.
  Regression-checked: Trees gives `demolish/warp` + `flora/rect`, one
  Ctrl+Z removes both, Patterns still gets no clearing, no errors.


- **Build 228 (30 Aug 2026) — a modifier is a thing you AIM, so it snaps
  to the cell.** Eden on the clearing under an asset: "seems to have the
  option to manipulate the shape by dragging the edges ... i can see the
  select move but it's not affecting the actual clear layer."

  Everything about free corners was already right and none of it was the
  problem: `freeCorner` allows them on a demolish rect, `ensureQuad`
  builds the quad, the drag writes it, `changed()` invalidates the
  weathered buffers by footprint, and `bitten()` has a whole `m.quad`
  branch. The quantum was the problem. `fine()` — which decides whether a
  shape moves in walk tiles or in lattice cells — tested for `clears` or
  `door`, which catches the Clear tool and a doorway and MISSES every
  modifier. So a demolish snapped to whole walk tiles: the clearing laid
  under a print is ~4.5 tiles across, leaving its corners five stops per
  axis, and any drag under a tile moved the grip, drew the quad and
  changed the cut not at all. `fine()` now takes `k.modifies` too.
  Verified: a sub-tile nudge of a corner now visibly nicks the clearing.

  **Two things to know before touching this again.** A demolish's quad
  does not carve a hole — outside the quad but inside the rect is the
  *wedge*, where ground is "spent out" (`lost` ramps to 1) rather than
  spared, so with `out: 1` the whole rect clears either way and only the
  quad's own edge reads. If a clearing that truly stops at its outline is
  ever wanted, the shape to reach for is **`warp`** — a demolish accepts
  it (`types: AREA`), every blob point is a grip, leg midpoints add new
  ones, and `geo.depth` then bounds the cut exactly. Tested and it works;
  not made the default, because the rect is the look Eden signed off.

  And when driving this over CDP: a synthetic `pointerdown` makes
  `canvas.setPointerCapture(e.pointerId)` throw `NotFoundError`, which
  surfaces as `Script error. @ :0` in the banner, once per pointerdown.
  It is the harness, not the game.


- **Build 227 (30 Aug 2026) — there is no `'2'`: an asset is its coloured
  pixels and nothing else.** Eden: "many of the assets are not completely
  transparent — remove any area that doesn't have a pixel coloured."
  Chased it to the right place, and it was not where I first looked.

  *Not* a slicing bug. Seven `buildings` glyphs (a21–a30) read as solid
  blocks and I took them for inverted sprites; cropping the source cells
  out of `assets/buildings-a.png` and looking at them showed the artwork
  itself is solid-filled — a21 and a22 are white blocks with a thin dark
  roof line. The slicer had them right. **Do not "repair" them.**

  The real one: every `'2'` cell — the drawing's own inside plus the
  one-cell plinth ring `body()` grew round every silhouette — is a cell
  with no coloured pixel, and `assets.py export` wrote each as a SOLID
  `GROUND (27,27,33)` pixel. So every exported asset PNG carried an
  opaque dark background: 53 of the 327 files, 64,832 opaque pixels.
  In-game they had already stopped drawing (225), so this was invisible
  in the plate and glaring in a file browser.

  `'2'` is now gone from the data, the tools and the renderer: purged
  from `src/glyphs.js` (273 of 327 glyphs shrank by exactly the plinth
  ring; **no art lost — all 327 glyphs, all 50 detail entries and all
  45,565 lit cells are byte-identical**), `glyphs.py body()` no longer
  writes it (`pad` defaults to 0 and grows `'1'` if ever asked), a new
  `glyphs.py trim()` cuts the box to the drawing, `assets.py` export
  writes bone-on-transparency and import reads GROUND as nothing so old
  PNGs still round-trip, and `landmark()` lost its dead `own`/`ground`
  branch. Verified: 0 opaque ground pixels across all 327 PNGs.

  **Two pre-existing bugs found in `assets.py` on the way:**
  `export()` still sorted on "is it in the houses set?" and put all 291
  other glyphs in `Buildings/` — it predated the per-set folders and
  would have wrecked the desktop library on any run. It writes by set
  now, the same rule `import` reads back by. And `import` rebuilt the
  `detail` table from the folders, which hold base-size PNGs only, so it
  silently emptied all 50 detail entries (build 220's Size ×2 drawings).
  It now carries the existing table forward. **export → import is a
  clean round trip: sets, detail and every glyph identical.**


- **Build 226 (30 Aug 2026) — the print sits on top of its clearing.**
  Build 225's clearing was eating the print it was under ("the asset now
  sits behind" — Eden). The rule is in the rebuild's mod loop: a
  modifier weathers the shapes with a LOWER id than its own, and leaves
  what was laid over it afterwards standing — which is how the
  founding's patch stopped eating its own house on 2026-08-29.
  `Found.generate` gets it right by adding the demolish FIRST, so the
  house takes the higher id. `create()` cannot: it takes the print's id
  at the top, before the print's size is known, and the size is what the
  clearing is made from — so the clearing was made second, took the
  higher id, and weathered the print. `clearUnder` now exchanges the two
  ids, which restores the founding's order and keeps both unique (they
  are only ever swapped with each other). Array order was already right.
  Verified: one of each print kind dropped on grass gives
  `demolish#40/house#41, demolish#42/building#43, …` — clearing always
  the lower — and every print draws whole.

- **Open: seven building glyphs are solid blocks.** Audited all 327
  glyphs for fully-lit rows (the signature of a sprite whose background
  was read as lit). Every set is clean — patterns, plants, icons, signs,
  distractions, houses, trees, mountains, landmarks — except
  **`buildings`, where a21, a22, a23, a25, a28, a29 and a30** (all from
  the tail of `assets/buildings-a.png`) come out as a filled rectangle
  of lit cells with the drawing traced in `'2'` INSIDE it. They look
  inverted: `1 → 0, 2 → 1` turns a30 into coherent banded architecture.
  Not applied — it is a guess about Eden's artwork, and on a22 the
  literal reading of "remove what is not a coloured pixel" would leave
  an invisible glyph. Awaiting Eden's call: invert the seven, drop them
  from the set, or re-slice that region of the sheet.


- **Build 225 (30 Aug 2026) — the print goes transparent, and its
  clearing is the founding's own.** Two corrections to build 224, both
  Eden's, both about the same thing: the asset and the ground under it
  are meant to be two separate things and were still half one.

  *The print is transparent.* `landmark()` in `kinds.js` stamped a `'2'`
  cell — the glyph's own ground: a window, a doorway, the plinth the
  slicer grows around every silhouette — as an opaque, oversized square
  of `C.plate`, knitted into cover. That was a clearing carried INSIDE
  the print, locked to the drawing and shaped exactly like it, which is
  precisely what build 224's separate clearing was meant to replace.
  `'2'` now draws nothing (`if (!on) return;`) and the terrain shows
  through. **A print placed before 225 has no clearing under it and will
  show grass through its windows** until one is put there by hand; the
  restored v8.1 town is almost all on already-dark ground, so it reads
  fine there, but that is luck and not a rule.

  *The clearing is a `demolish`, not a `clear`.* `clearUnder` now makes
  exactly what `Found.generate` makes under the first palace — same
  kind, same five numbers: `fall: 0, out: 1, feather: 3, scatter: 0.7,
  jitter: 0.4` — because the feather-plus-scatter-plus-jitter rim is the
  soft sketchy edge that was wanted, and `clear` is born hard on purpose
  ("a clearing with a soft edge is a demolition, and that tool already
  exists"). The trade, said out loud: a demolish is not picky, so a
  clearing bites the roads and other built things inside it. That is
  what the founding has always done, and it is what was asked for.

  `tools/glyphs.py`'s two descriptions of `'2'` and the generated header
  in `src/glyphs.js` were corrected with it, so the next re-slice does
  not put the old claim back.


- **Build 224 (30 Aug 2026) — a print and its clearing are two shapes.**
  A print used to clear its ground from INSIDE itself: the glyph's own
  `'2'` cells (a window, a doorway, the plinth) draw as dark cover, so
  the ground went exactly under the drawing and nowhere else, and there
  was nothing to take hold of — the clearing was locked to the asset.
  Placing one now lays **two** shapes, the way `Found.generate` has
  always laid the first palace (a clearing, then the house on it):
  `create()` in `build.js` calls `clearUnder(s)` for any print that is
  not `aesthetic`, which `make`s a `clear` at half again the print's
  footprint, centred on it, pushed BEFORE the print so the print is what
  a click finds first. One gesture, one undo step (both are in
  `G.shapes` before the pointerup calls `hstep`) — and from then on they
  select, drag, resize and delete on their own.

  `clear` and not `demolish`: the clearing is picky — terrain only,
  never a print, never a road — so an asset dropped on a crossing does
  not take the road with it, which a demolish would. Patterns are
  exempt (`aesthetic: true`): a pattern is a texture meant to lie ON the
  ground. The glyph's `'2'` cells are untouched; the first palace has
  both too. Verified on a throwaway: Houses → `clear` + `house` at the
  same centre, one Ctrl+Z removes both, a click in the clearing's margin
  at a working zoom selects the clearing and leaves the print (the grab
  tolerance is `10 / G.cam[2]`, so zoomed far out the print's handle
  covers the margin — zoom in to grab the clearing), Patterns → one
  shape and no clearing.


- **Build 223 (30 Aug 2026) — the compass in the lettering's layer, and
  `Shift+R`.** Build 222's screen was a checkerboard laid over the
  PHOTOGRAPHIC read (`Title.picture` → `Lattice.analyse`/`compose`),
  with the cells then turned to the heading one at a time, and Eden
  named both faults: *the angle is off* — a cell turned by `cos/sin`
  lands between the plate's own cells, so at any heading off the square
  the rose sat off the grain — and *the diamonds are not spaced out with
  halftone gaps* — a checker drops every second cell on a fixed parity,
  which is a texture, not a screen.

  The screening half of `Title.build` came out as **`Title.screen`** (one
  copy, shared), and **`Title.stencil`** feeds it a picture instead of a
  word: the heading turns the DRAWING before it is screened, the box
  grown to the turned diagonal so no spike is clipped, the art's own
  width held at `Size` cells so the rose does not breathe as the map
  turns. `Compass.overlay` then draws it with **`Title.emit`** — the call
  the town's name makes in `palace.js` — same origin, pitch, sheen,
  diamond and cap, mat dropped first. Verified on a throwaway at 0/30/
  45/90/125/235°: every cell on the integer lattice, cell count steady
  within ~5%. The Compass tune block is now the lettering's numbers at
  the lettering's defaults (Size, Weight, Screen, Tone, Sheen, Ink, and
  Detail for the hidden chrome canvas); a tune saved before this build
  carried `scatter`/`szv` and is dropped whole on load, `at` kept.

  **`Shift+R`** is *Reset — blank page* from the keyboard. The ask and
  the wipe moved into **`Snap.reset`** (`src/snapshot.js`), which the
  tune-panel chip now calls too, so the two cannot drift apart. Bare `R`
  is untouched (a new round) — the shift is deliberate: this one has no
  undo but an export, and bare `R` is a key you press without looking.

- **Build 222 (29 Aug 2026) — the compass in the prints' screen.** The rose
  on the plate was stamped solid (every cell one full diamond) and read as
  a dot silhouette beside the halftoned prints. `Compass.overlay` now
  screens it the way `landmark()` screens a body: rim cells (an empty
  4-neighbour) solid, inside a checker — off cells small and dim (0.58,
  0.6), on cells a touch under full (0.88, 0.78). Same `put`, same diamond.

- **Build 221 (29 Aug 2026) — Structures, a Patterns row, half sizes, the
  Clear tool, the picker first.** The built layer is labelled
  **Structures**; under its Place chips a second row, **Patterns ·
  aesthetics**, holds the pattern kind (`aesthetic: true` on the kind).
  **Size ×** now runs 1–4 in halves (the slider counts tenths, `mult` is
  rounded to 0.5; detail is used from 1.5×). **Clear** (`kinds.js`, in the
  Modify row via `tool: true`) is an occluder that draws nothing with a
  hard edge — feather/scatter born 0 — and is picky: `clears` is every
  terrain kind (not prints, not roads, not the tools), so a print inside a
  clearing stands untouched and roads run through; rect or oval, corners
  drag as any area does. The **Asset** picker (was "Building") sits right
  under the Place chips, above Shape, and scrolls into view when a print
  kind is armed, so the asset is chosen before the plate is clicked.

- **Build 220 (29 Aug 2026) — a print grows in whole multiples, and shows
  its detail when it has some.** A print's Adjust row now offers **Size ×**
  (1–4, whole numbers; `s.mult`) instead of the width slider: each pixel of
  the glyph covers mult×mult cells, so nothing is ever stretched or warped
  (`glyphSize`/`glyphSnap` in build.js multiply by it; `Kinds.glyphRows(s)`
  in kinds.js picks the rows). Sprites whose source is finer than the
  32-cell grid keep a **detail** version (up to 64 cells) in `glyphs.js`
  (`D.detail`, `Glyphs.detail(name)`): `tools/assets.py slice` no longer
  brings them down to 32 (only to 64), and `import` writes the base (fitted
  to 32) and the detail; 50 of the 327 glyphs have one. At Size × 2 or more
  such a print is drawn from its detail (the row reads "2× fine"), so making
  it bigger shows more of the drawing. Footprint is the same either way.
  Saved with the shape (`mult`, default 1); old towns load unchanged.

**The line.** `~/Projects/memory-quest-le`, branch `work`, pushed to
`origin` = https://github.com/ParseMeData/BitMap (`main`). GitHub Pages
serves `main` at **https://parsemedata.github.io/BitMap/** — a push shows
there within about a minute; `until curl … | grep "var BUILD = N"` is how
the session waited for it. Tag **v8.4** (5 Sep, build 264) is the last
tag, with `snapshots/v8.4.json` beside it and a frozen clone at
`~/Projects/Loci Bitmap V8.4`. v8.3 (31 Aug, build 241) is the one
before. `gh` is installed and
logged in as ParseMeData. Commits are made as Eden through the env vars in
`QUEUE.md`'s working rules; every one bumps `BUILD` in index.html and
`VERSION` in sw.js together.

**What the game is now** (all since 27 Aug; README has each in full):

- *The web.* `manifest.json` + `sw.js` make the page install and run
  offline; `src/snapshot.js` is Export/Import of the town under *Town* in
  the tune panel, in `tools/snapshot.py`'s file shape. Players: a door on
  the desk (Eden, Test User, password 123, `users` key; every player's
  town under a slug prefix on the keys), no door on a phone.
- *Mobile.* `body.mobile` (coarse pointer or < 800 px): a touch layer of
  synthetic keys (`src/touch.js`), every panel a sheet, no pause on blur.
- *The world.* The country map is behind a switch; the **region plate**
  (`src/region.js`) is our towns drawn flat, north up, links for roads.
  The **quest** (`src/quest.js`): the focused acronym is the region, a
  letter a plate (`areas[id].letter`), an item a palace (`marker.item`),
  the picked item's palace the target; distractions (`src/distract.js`)
  eat roads and gate jumps; grains/blocks/sparks (`src/stock.js`) pay for
  building, the first plate free; the trace (`src/trace.js`) and minimal
  view. Rewards are generic amounts in `Stock.REWARD`.
- *Founding.* No plate exists without an address (`src/found.js`): ask →
  live map under the (now hidden) frame, drag / Zoom ± / Turn ◀ ▶ →
  **Print** (the picture toned to the plate's ground) → **confirm** →
  **Generate**: the survey (`src/survey.js`, OpenStreetMap through
  Overpass — three mirrors, the desk's `file://` page can only use
  Mail.ru's, ~40 s) lays the roads connected to the address, the water,
  four grass quarters and a boundary sized so every plate edge is in its
  dithered fade; the map is squared to the door's road unless turned by
  hand; a house from the sheet and the first palace go beside the road on
  the address's side. An empty home founds itself unasked on
  `Found.DEFAULT` = 929 Myrtleford-Yackandandah Road, Barwidgee.
- *The look.* The ground is **#1B1B21** everywhere (the map's own shade;
  the transparent GL clear must stay black — see *Decisions*). The printed
  sheet is never shown. Esri's dark canvas is the only map (CARTO
  watermarks keyless tiles now); Fade rests at ¼; Fade/Scale sliders
  hidden, Turn is two arrows, the map dialog is top right and its ✕ takes
  the map with it. The title is Fleur De Leah (shipped, OFL), read at 16
  cells, set to the right so it runs off the sheet, on a light dithered
  mat. The compass is the star rose drawn **on the plate** at its top-left
  (`Compass.overlay`, one plate cell per cell of the drawing), turned with
  the map, never by hand. The hub's diamonds are on the plate's own pitch,
  larger, in the bottom-left corner; the strip of three meters stands to
  their right on a desk, top right on a phone.

**The live town** (Eden's profile, `~/.cache/memory-quest-le`, bare keys):
Myrtleford as at v8.1 — 39 shapes, 1 marker (Barwidgee, a palace of 11
rooms), 14 locus pictures, the frozen Myrtleford picture (baked before
the tone step, so still Esri grey; Thaw → Print brings it to the ground).
Nothing since v8.1 touched it; every new mechanism was verified on a
throwaway profile against `snapshots/v8.1.json`. Its bindings (letters,
items) are unset — see *Open threads*.

**How the session tested.** A headless throwaway on its own profile and
port, restored from a snapshot, driven over CDP:

    S=<scratch>; XDG_CACHE_HOME=$S/cache ./play.sh --remote-debugging-port=9223 \
      --headless=new --window-size=1600,1000 --use-angle=gl --enable-gpu --ignore-gpu-blocklist
    MQ_PORT=9223 tools/snapshot.py restore snapshots/v8.1.json --port 9223 --yes
    # then tools/cdp.py attach(port=9223).js('…'), Page.captureScreenshot;
    # sessionStorage.setItem('hq.user','') + reload passes the door;
    # Emulation.setDeviceMetricsOverride(390×844, mobile) is the phone.

The three GL flags are not optional — see *A headless rig needs the real
GPU*. `pkill -f` patterns must not match the shell's own command line
(`cach[e]`).

---

## The grid

One number to hold on to: **a walk tile is four lattice cells.**

    plate        44 × 57 walk tiles
    walk tile    12.59 world units — the walker steps between these
    cell          3.15 world units — one diamond; the resolution everything is drawn at
    wall          2 cells = half a tile thick

Things you **place** snap to the tile: a bed half a tile out is a bed you can
never line up. Things you **aim** — the wall demolisher, doors — snap to the
cell, because a wall is half a tile thick and a tile is four times too coarse
to trim with.

---

## Layout

**The file table is in `README.md`, under *Layout*, and it is the only one.**
This document carried a second copy and the second copy went stale, which is
what a second copy does.

One thing about it that the listing cannot say: **adding a source file means
adding it to the loader list** in `index.html`, which is a literal array of
paths executed in that order. `BUILD` on the line beside it is *not* the cache
buster — `Date.now()` in the same string is, on every load, so a stale script
cannot be served back at all. `BUILD` is a stamp, published as
`window.HQ_BUILD`, so a page driven over CDP can say which build it is.

Storage, all under `hq.` — for the first player. Every other player's
keys carry that player's slug in front (`test:hq.shapes`) and their two
databases take it in their names (`test:hq.loci`); `src/store.js` puts it
on and takes it off, and `HQ_DB` in index.html names the stores, so no
module below the store knows there are players at all. `users` (bare,
not `hq.`) is the players: name, slug, password hash. The tools read
bare keys and so see Eden's town only — a throwaway for another player
is a throwaway with `sessionStorage['hq.user']` set.

    hq.shapes            the town
    hq.markers           the town's markers
    hq.version           which step of src/store.js's ladder this profile
                         has climbed — the one number that says what shape
                         every other key is in
    hq.index             derived — plates → markers, palaces → plate, loci
                         → pictures, missions → palace, and the orphans;
                         rebuilt from the keys on every boot, never read
                         back to decide anything (src/index.js)
    hq.town              the town's name — a palace's name is not here, it is
                         on its marker inside hq.markers
    hq.rooms.<uid>       one palace's plan
    hq.marks.<uid>       one palace's loci
    hq.trace.<uid>       which room that palace's trace is up to (src/trace.js)
    hq.order.<uid>       the room list that palace was typed from
    hq.basemap           the home plate's tracing underlay: position and
                         source (its picture is row `img` of the hq.basemap
                         picture store, or hq.basemap.img if that failed)
    hq.basemap.<id>      another plate's, the same three handles with the
                         plate's id on the end (row `img.<id>`)
    hq.shapes.region     the region plate's shapes (src/region.js)
    hq.region            {lat0, lon0, scale}: where the region plate's
                         centre falls and how many degrees a world unit is
    hq.towns             what the rose diamond opens: region or country
    hq.blank             no longer read (the plate is always blank, 2026-08-28)
    hq.sparks            the round, on or off
    hq.deck              the ordered run handed to the platformer
    hq.bag               the bag's words, card key → text
    hq.stock             {grains, blocks}: the two materials (src/stock.js);
                         the platformer writes this key raw, having no Store
    hq.distract          {plates: {<id>: [{x, y, seed}]}}: where the
                         distractions sit, walk tiles per plate (src/distract.js)
    hq.atlas … letter    a plate's `letter` is a journal letter id — which
                         letter of the focused acronym it is (src/quest.js)
    hq.markers… item     a marker's `item` is {id: letter id, item: index} —
                         which of that letter's items its palace is
    hq.journal           {frame, notes}: the journal's tabs → sub-tabs →
                         acronyms, every letter with an id, and notes by
                         that id → {word, note, items}. A pre-v7.8 flat
                         "Tab/Sub/row/col" map is carried across on the
                         first open (src/journal.js, load); `focus` is the
                         id of the acronym stood up on the plate, `pick`
                         {id, item} the one item being carried (src/focus.js)
    hq.compass           {manual, deg, tune}: the rose turned by hand or
                         following the map, and how it is read and drawn
    hq.bagpics           each card's hand of pictures: how many, which is
                         dealt, and its halftone tune (the pictures are
                         card:…:alt:<n> in the picture store)
    hq.title.*           how the heading is dressed: off (the town name's
                         hand-placed offset), treat, border, bright, jitter,
                         font — a Google Fonts family name, `none` for the
                         diamond type, or absent for the default — and the
                         font's detail (Size), weight, tone, dither, mat, feather and shade
    hq.lastError         the last runtime slip; nothing ever clears it
    hq.loads             reload stamps, to catch a relaunch loop
    IndexedDB hq.loci    every picture, one store, each row named for its
                         tenant: locus:<uid>, card:<system>:<label>:<slot>,
                         card:…:alt:<n>. Callers still pass a uid or a
                         bag:… key; `Loci` turns it into the row. (Rows
                         without a prefix are pre-v7.8 and are moved on the
                         first survey. hq.bagsel and Haunt Quest's hq.best
                         are taken out by the store's ladder, step 1.)
    IndexedDB hq.basemap the frozen tracing picture
    hq.basemap.img       the same frozen picture, when IndexedDB refused it

The picture has two homes because the game runs from `file://`, which is an
opaque origin Chrome may refuse IndexedDB to outright; on a profile where it
did, that last key carries the whole picture as a data URL — the one in this
tree is about 207 KB, and `stash()` says so and gives up rather than growing
without limit. `hq.lastError` and
`hq.loads` are diagnostics rather than town, which is why `save` drops them.

---

## Decisions that would be got wrong

These are the ones where the obvious approach is the wrong one, and where a
fresh pair of eyes will want to "simplify" something load-bearing.

**Two registries, one editor.** `Kinds` holds a map registry and a floor
registry and swaps between them with `Kinds.use(scope)`. Everything downstream
reads `Kinds.list` / `.by` / `.layers` / `.palette` and never learns which it
is looking at. Build mode still never branches on the registry — the
palette, the layer rows, the walk-grid stamp and saving all read `Kinds.*` and
cannot tell. The single place it distinguishes the two is the word in a failed
save, taken from the storage key rather than from the scope, because "could not
save the town" while you are standing in a plan is a lie.

**Hollowness lives in the geometry, not the drawing.** A wall kind declares
`hollow`, and `geo.depth()` makes an area shape into a band. So a room is a
room to *all three* questions — what it covers when it takes ground, which
tiles it blocks the walker on, and where the pointer can pick it up — and the
floor inside it is left alone by all three. Drawing it hollow while it still
occluded its whole footprint cleared the room out from under itself.

**A wall straddles the line it is drawn on.** Half in, half out. Running
inward is right for one room and wrong for two: rooms pack edge to edge, so
each contributed a full thickness and party walls came out double.

**`clears` and `cuts` are different things.** `clears: ['wall','glazing']`
limits what a shape takes ground from. `cuts: true` means it lays nothing down
in the walk grid — it is a hole in what a blocker may block. The demolisher is
both; a door only `clears`, because a door is a way through and stamps its own
walkable ground. They were one flag and it made doors unwalkable.

**`home()` is floored at fit-height** since 2026-08-28 — `VH / G.H`, not
fit-all: at the working zoom the plate's full height fills the screen,
which is what lets the surveyed ground reach the top and the bottom of
it. On a desk that is fit-all; on a phone held portrait it is closer,
the plate wider than the screen, and the camera clamps along it. The
survey's boundary (`Survey.boundary`) is set against the plate so every
edge is in the fade; change the plate's size and change that with it.

**`home()` is not `fitW`, and putting it back would be a regression.** The
opening zoom and `0` both land four notches of the zoom key out from `fitW`,
because that is the distance the map is drawn and read at; `fitW` puts one
district across the whole screen. It reads as an odd constant and it is not —
`ZSTEP ** 4` is four presses of the key, and it is written that way so it stays
four presses if the notch is retuned. `refit()` still only clamps `camT`, so a
window that changes size keeps the zoom it had rather than being thrown home
mid-drag.

**Out is not more Scatter, and cannot be folded into it.** Scatter's removal is
held to 55% of the roll on purpose — a scatter that empties a cell outright is
a hole. Out rolls on its own salt and can reach one, because the end of a fall
is the one place a hole is the point. Merging them would either put holes in
every scattered field or make the tail unable to finish.

**The rect is the footprint; the quad is what survives it.** On a demolish area
with a dragged corner, the cells inside `w`/`h` but outside the quad are spent
out — a ramp to total removal measured against the wedge's own depth, not a
stamp. Reading it the other way round, as if the quad were simply a smaller
shape, takes away the only way this tool can end a town on a diagonal.
`geo.lost()` is the test the overlay uses, and it answers false for anything
that has never had a corner dragged.

**Feather is measured from the RECT on a quad, never from the quad's edges.**
The rectangle is the rim, where the tool's influence ends; the quad edge is in
the middle of what it is doing. Feathering the quad edge is what made a dragged
corner read as a slice — untouched ground tapering right up to a line with
nothing on the far side of it — and putting that back would undo the fix, not
tidy it.

**On a quad, `quad` is the shape and `w`/`h` are its shadow.** A demolish area
that has had a corner dragged carries four corners in its own local frame, and
`w`/`h` are restated from their extent after every edit. Do not reverse that:
half the file reads `w`/`h` — the size slider, the cell scan, every bbox test —
so leaving them stale is a shape whose size nothing agrees on, and deriving the
corners from them again is the rect you just stopped being. Every edit ends in
`normQuad()`, which also re-centres the corners on the origin and moves the
origin to match, because the rotate grip turns about that origin and a quad
dragged off it turns about a point outside itself.

**The marker is the fall; `fall` is its length.** `aim` holds where the marker
sits, normalised to the shape's own square, and `fall` is kept equal to how far
that is from the middle — two writers (the grip and the slider), one value, and
each keeps the other in step. Do not let them drift apart, and do not reach for
`rot` to aim a fall: rotation turns the shape, which is a different question.
An area saved before the marker existed has no `aim` at all and falls along its
own local +x, which is what `rot` used to mean — that fallback is what keeps
those areas pointing where they were left.

**Grips are picked by nearest, not by first listed.** The hit radius is
deliberately generous, and on a small shape it holds two or three grips at once.
Taking the first in the list made the fall marker impossible to pick up beside
the edge grip it sits in from. If a grip ever needs to win a tie outright, order
is no longer the way to say so.

**Fall and Feather are one weight arrived at two ways, so they multiply.**
Feather keeps a demolish area's bite off its own rim; Fall says which rim the
damage was coming from. Neither is a special case of the other, and adding them
instead of multiplying gives damage outside the area.

**Generated geometry is placed `exact`.** Snapping is for a shape being
dragged. A shape's centre snaps to a tile *centre*, so a room an even number of
tiles wide has its edges on tile centres — and anything derived from it by
rounding lands a whole tile out. That bug looked random because odd-width rooms
never showed it.

**A landmark is lattice, not a sprite.** The sheets in `assets/` are read by
`tools/glyphs.py` and by nothing else; `src/glyphs.js` is what ships, and a
lit square there becomes one diamond at stamp time, the way a letter does in
`type.js`. Loading the PNG and drawing it would be quicker to write and would
put a second material on the plate — a picture of a building over a town made
of diamonds — which is the objection the whole renderer exists to answer.
`glyphs.js` is generated: hand-edit it and the next slice reverts you.

**A drawn building is a print: one size, no grips.** Every other kind is
born in tiles, because a park has no size of its own. A fourteen-pixel
glyph does, and one cell per pixel is the only footprint that shows all of
it and no more — tile-snapping that to sixteen adds two columns of nothing
and to twelve loses two of building, which is the same bug from both
sides. So `glyphSize` reads the birth size off the glyph and does not snap
it, `handles()` gives a print none, `scaleSel` ignores it, and `glyphSnap`
lands every path that still carries a size back on 1×. Resizing went
through two designs in one day — whole multiples, then a ceiling with
shrink — before Eden settled it: the thing is a print, and a print is not
resized.

**One lattice, one pitch, one proportion.** `STYLE.md` *The lattice* is
the rule for anything halftoned: the plate's cell (`G.A.cell`), about
three pixels on screen at fit-all, half-size 0.75 × cell, weights from one
table. Chrome draws through `Title.paint`, the plate through the GL
stream, pictures through the tone pass — never a font glyph or a sprite.
The towns map was the one thing built otherwise (typeset `◆`, its own
pitch) and was brought into line the same day the rule was written.

**An id is a millisecond, a counter, and a little chance.** The journal's
first `mint` was time plus two random characters, and a fresh frame mints
sixty ids in one millisecond: on the first day RAITS and DONE shared a
row id, `rowById` found DONE first, and the focus stood up the wrong
acronym with nothing to pick. The counter is what makes an id unique;
`dedupe()` on load re-mints any later duplicate a profile from that build
still holds. If a thing needs an id, mint it here, not with `Date.now()`.

**The focus column stands on the hub it is told about.** `Hud.anchor()`
is where the hub is, in CSS px, with its measures; `focus.js` reads it
every frame. It once carried copies of hud.js's numbers, and the day the
hub moved beside the strip the folded pick stood on the old spot.

**The focus column takes no pointer.** `src/focus.js` draws on a canvas
with `pointer-events:none` and listens on the window in the capture
phase, stopping only an event that lands on one of its diamonds. Without
that the column, which sits over the left of the plate, would swallow
every click and walk-step under it. The same shape as the compass, which
also takes none — but the compass has nothing to press.

**Every key goes through the store, and the store has a version.**
`src/store.js` is first in the boot chain; `Store.get/set/del/put/json/
save/keys/has` are the only way a module touches localStorage, and
`hq.version` says which step of the ladder at the foot of that file this
profile has climbed. A step is appended, never edited once shipped — a
profile that climbed it will not climb it again. `set` throws on quota
exactly as localStorage does, which is why every module's try/catch and
`hqStoreFail` latch kept working unchanged through the move. The keys and
their values did not change: `tools/snapshot.py` carries `hq.version`
like any other key and a v7.7 snapshot restores into a v7.8 profile and
climbs on the next boot.

**A palace knows its plate by being asked, not by being told.** Nothing
writes a plate id into a palace: `Index.plateOf(uid)` walks every plate's
marker list and answers. The index (`src/index.js`) is rebuilt from the
keys at boot, once `Loci.survey` has listed the pictures, and again 600 ms
after any write to `hq.markers*`, `hq.rooms.*`, `hq.order.*`, `hq.marks.*`,
`hq.missions` or `hq.atlas` (through `Store.watch`). It is written to
`hq.index` so a tool reading the profile cold sees the same picture, and
if the two ever disagree the keys are right. Its `orphans` is what the
sweep reads — and at v7.8 it found four palaces with no marker on any
plate and two pictures no locus holds, which are the four typed palaces
of v5.0 whose markers were deleted, not rubbish. Nothing here deletes.

**Each plate traces its own picture.** `Basemap.mount(id)` is called by
`Atlas.go` and `Atlas.init` after the shapes and markers mount: it lets go
of the picture in memory only — never `thaw()`, which deletes from storage
— swaps the three handles (`KEY`, `IMGKEY`, the store row `PK`) and reads
the other plate's in through the same `boot()` init uses. Home keeps the
bare keys, so a town from before this is the home plate's unchanged. A
successful search on a plate with no `geo` sets it, which is how a plate
opened from a road end and then traced finds its own place on the towns
map. `snapshot.py` reads every row of the picture store: `picture` stays
the home plate's, `pictures` is the rest and is absent when there are
none, so a v7.7 file reads back exactly as before.

**A plate is the interior's trick pointed sideways.** Going inside a
building mounts the builder and the markers on another pair of keys and
swaps the registry; a plate mounts them on another pair of keys and keeps
it. `hq.atlas` is the graph — `{areas: {id: {name, links: {n,e,s,w}}},
current}` — and the home plate keeps `hq.shapes`/`hq.markers`, so a town
saved before the atlas existed is the home plate of a one-plate atlas
without being touched. Plates are never entered from inside a building:
`Atlas.go` refuses while `Interior.inside()`. A plate may carry `geo:
{lat, lon}` as well — where it falls on the country, for the towns map —
and may not: home takes the underlay's search point once (`Atlas.seed`), a
plate opened from a road end steps its neighbour's anchor one cell of the
country raster the way the road went, and `Atlas.setGeo` pins any plate by
hand. Nothing ever guesses an anchor for a plate that has none.

**The underlay is transformed, so it cannot also clip.** `#basemap` is
the element `Basemap.sync` translates and scales every frame; give it a
size and `overflow:hidden` and the clip moves with the map, which showed
as the map rendering in a different patch of the screen on every zoom.
It is a zero-size anchor at the origin with overflow visible; the window
is the clip. If a clip is ever wanted, wrap it in a second element.

**A phone is the desk with the keys drawn on it.** `body.mobile` is one
switch, decided in index.html before layout; `src/touch.js` presses real
`KeyboardEvent`s on the window, so no module knows a finger from a key
and nothing was rewritten for touch. Keep it that way: a mobile-only
code path in a module is a second game to keep. What differs on a phone
is stylesheet — sheets in place of panels — and what is not shown.

**The door is off, not gone.** `DOOR = false` in index.html signs the
first player in unasked; `Users`, the slug prefix in `Store` and the
Player rows stay in the code behind that one switch. The asset sets
are `src/glyphs.js`'s `sets`, one per desktop folder, written by
`tools/assets.py import` — `glyphs.py` is the older way in from the two
sheets and still works; both write the same file, so run one or the
other, never expect both to hold.

**The door comes before the first script.** Every module reads its keys
the moment its file runs — the bag's stack, the stock, the atlas — so
whose keys they are has to be settled before `start()` appends a single
`<script>`. That is why the login is inline in index.html and why
`HQ_USER` is a plain global set there: `Store` reads it once at load and
never again. Switching player is a reload, never a remount.

**Two writers of one file shape.** `tools/snapshot.py` and
`src/snapshot.js` both write and read the version-3 snapshot — every
`hq.` key minus `hq.lastError` and `hq.loads`, `gkey` blanked in every
`hq.basemap*` key, `picture` the home plate's row, `pictures` the rest,
`loci` every row of the locus store. Change the shape in one and change
it in the other in the same commit, or a town exported on the web will
not restore from the terminal. Both open the two databases at version 1
with the upgrade that makes the store, for the reason under *A reader of
the picture database must create the store*.

**The worker and the cache-buster do not fight.** The loader appends
`?cb=BUILD.now` to every script, different on every load; `sw.js`
stores each file under its bare path and matches with `ignoreSearch`,
so the buster keeps doing its job against the browser's own cache while
the worker's cache still answers offline. Bump `VERSION` in `sw.js` when
the file list changes — an unchanged worker is never re-installed.

**The quest stores nothing of its own.** The target is `hq.journal.pick`;
the region is the focused row; a plate's letter and a marker's item are
journal letter ids, minted once by `journal.js` and never reused, so a
binding survives the acronym being renamed, reordered or taken out of
focus — it is simply not shown until that acronym stands up again.
Nothing in `quest.js` writes to storage; `Atlas.setLetter` and
`Markers.setItem` are the two writers, and `Quest.arrive` puts the pick
down through `Journal.setPick`. Keep it that way: a second copy of "which
palace is which item" is the kind of copy that goes stale.

**A distraction is stamped, not drawn into the grid.** `Distract.stamp`
runs at the end of `restampTerrain`, after the shapes, and takes its
tiles out of `G.terr` — never out of `terrBase`, and never by writing a
shape — so clearing one is a restamp and nothing else, and a snapshot
from before they existed restores clean. The gate on a jump lives in
`Atlas.go`, once, because every way of jumping ends there (the region's
Enter, the towns map, the chip grid); `Region.gate` asks the same
question first only so the region is not left before a refusal. The
walk of the atlas avoids blocked plates other than the two ends: the
destination may hold one — you arrive and deal with it — and the plate
you stand on is already cut under your feet where it matters.

**The region is a frame, not an atlas area.** `src/region.js` mounts the
editor on `hq.shapes.region` with `Kinds.use('region')` exactly as going
inside a building mounts a plan, and holds the plate it left in a frame
until Esc. It is deliberately not an entry in `hq.atlas`: the atlas is the
towns, and the region is where the towns are — `Atlas.go` pops the frame
before it mounts anything, so a jump from the towns map or the chip grid
while standing on the region cannot mount a plate over it. A *town* is a
connected run of atlas areas read both ways off the links; its root is
home or the first plate; its anchor is the mean of its plates' `geo`.
The one write the region makes to the atlas is `setGeo`, on a drop in
build mode, and it pins every plate of the town at once so the group
keeps its shape. `hq.region` is the projection and is set once from
home's anchor; nothing recentres it.

**A road is straights and curves.** `rule()` in survey.js: lengths →
headings (0/90, or 45 for a long true diagonal) → straights on the line
through their weighted middle → one curve between each pair (a turn
about the corner where their lines meet, or an S across to a parallel
line). It replaced a 22½°-step rectifier and a curve-or-corner judge,
which drew staircases; the whole idea is that nothing is drawn that is
not a straight or one clean curve. `joined()` decides islands on the
plate's own touches, not OSM's shared nodes: a way can reach the door
through a node off the plate, which is a road to nowhere here.

**Two `square`s once lived in survey.js.** The map turner
(`square(seg)`) and the road rectifier were both declared `square`; the
later declaration won and every road run was handed to the turner, which
returned a number, and the plate came up with no roads and no error. The
rectifier is `rectify`. A second function of the same name in one scope
is not an error to JavaScript; it is to us.

**The survey maps through the picture, not the search point.**
`Basemap.worldOf(lat, lon)` reads the frozen picture's `mc` (its centre
in mercator px, kept at freeze), its `mpx`, `mult`, `rot` and centre —
so a road surveyed off the map lies on the picture however the picture
is dragged, turned or scaled, and turning the map square (`square` in
survey.js) before laying the shapes is one `setRot` and nothing else
moves. A picture baked before `mc` existed cannot be surveyed; freeze
it again. The connected-roads walk keys nodes on six decimals of
lat/lon, which is what OSM's shared nodes come back as under `out
geom`; do not round coarser, or parallel roads a metre apart join.

**A transparent clear is black.** `R.clearA` is 0 while the map shows so
the page shows through the plate, and a WebGL canvas is composited
premultiplied: a clear colour at alpha 0 is not "nothing", it is added
onto the page. With the ground at #08080B the doubling was invisible; at
#1B1B21 the plate came up #363642. `begin()` clears to (0,0,0,0) when
the alpha is 0 and to the ground premultiplied otherwise. Do not put the
ground colour back into the transparent clear.

**Pin takes the canvas and nothing else.** Its pointer handlers run on
the window in the capture phase and stop propagation, which is right for
a drag over the plate and wrong for everything that is not the plate —
the touch layer's keys are `<div>`s and every one of them died while a
picture was pinned. `e.target !== canvas` is the guard; and founding
ends with `setPlacing(false)`, because a plate handed over with its
picture still in hand is a plate nobody can play on a phone.

**Yes at a road end is not a plate.** `Atlas.yes` hands the end to
`Found.ask` and the plate is made inside `Found.go`, after the address is
found — so a plate with no place cannot come to exist, and Stay leaves
the atlas untouched. `Found` does four things in order and each can fail
on its own: `Atlas.add`, `Basemap.find`, `Basemap.ready` then `freeze`,
`Atlas.setGeo` + `Markers.plant`. If `find` fails after `add`, the plate
exists without a map; the note says so and the dialog stays for another
try — better than tearing a plate out from under a walker standing on it.

**The end of a road is a step the walker asks about.** `tryStep` in
`game.js` decides what a dead end is — a road tile with at most one road
neighbour, pressed away from that neighbour — and hands it to
`Atlas.end(dir, [x, y])`, returning if it was taken. Decided there because
that is where the walk grid is; the atlas only ever hears about real ends,
so a sideways bump mid-road never asks. Links are kept per end
(`{at, dir, to, land}`), not per side, because Eden wanted many roads each
leading to their own plate; the first cut keyed them by plate edge and was
wrong for exactly that reason. A new plate is entered on its opposite edge
in the same column, with a stub laid inward, written into its storage in
the shape `save()` writes before the plate is mounted. Land on a tile that
is not road and `revalidate()` rescues, as after any edit.

**The towns map is one plane, and everything above it is a sum.**
`assets/australia.js` stores one SA3 id per cell and nothing else; region,
state and country are unions derived in `src/country.js` at load, so the
four levels cannot disagree about where a line falls. It is SA3 below SA4
rather than the shire because a shire does not nest — 211 of 533 LGAs
cross an SA4 on this very raster. The page (`src/towns.js`) is chrome on a
2D canvas, typeset in `◆`/`◇` from the chrome's monospace: never the GL
stream, never a sprite on the plate. The asset is loaded on first open,
not in the boot chain — it decodes to nine megabytes of typed arrays. The
old chip grid in `atlas.js` (`Atlas.openMap`) is still there and is what
`Hud.onTowns` falls back to if `towns.js` is missing.

**A stranded road is said, not fixed.** Eden chose connectivity over
"any road walkable": the route is one flood from the walker, and a road
the flood does not reach is framed in gold with the reason in the palette.
Auto-connecting was considered and rejected — a connector the tool draws
is a road nobody asked for.

**A warp is a quad with more corners and a curve through them.** `blob`
is a closed run of points in the shape's own frame, exactly as `quad` is,
so rotation, movement, `local()` and every pattern address go on working
untold; `w`/`h` are its extent and shadow it, as they shadow a quad.
`polyDepth` was generalised from four points to N for it, and the closed
spline is flattened once and cached in `_flat` like a line's bows. Saved
as `blob`; a warp that arrives without one is given eight points on its
oval on the way in.

**Water bends through its points; a road bends between them.** A `smooth`
kind ignores its per-segment bows and runs a Catmull-Rom through every
point, so its mid-segment grips are not bows but births: take one and a
point is made there and dragged. Ends are anchored. The bows (`ctrl`) are
still saved on the shape and still honoured for anything not smooth, so a
creek saved with bows before this loses them — the spline replaces them —
which is the intended reading, not a migration gap.

**A tone is four colours, and the window is not one of them.** A print's
`tone` swaps wall, dim and trim; the window note barely moves between
tones, so a street of mixed materials still reads as one town at night.
The six in `TONES` were chosen against STYLE.md's warning that a saturated
kind becomes the only thing on the screen — the first cut of the landmark
already proved that once, in gold.

**A modifier weathers only what was there before it.** `rebuild()`
gathers a shape's demolish areas from those with a *higher* id — laid
after it. Before 2026-08-29 a modifier acted on whatever it lay over,
and the founding's patch under the house ate the house laid on it a
moment later. The rule reads the same for a hand: you demolish what is
there; what you build on the rubble afterwards stands.

**A print occludes under its ink, not its box.** `covered()` takes the
ground under every occluder's footprint, and a landmark's footprint is a
rectangle around a building that is not one — so the terrain vanished in a
square. For a glyph kind it now asks `glyphAt()` per cell and takes only
'1' and '2'; the box is a frame, and a frame takes nothing.

**The slicer decides inside from outside; the sheet cannot.** Windows and
sky are both black on the sheet. Flood-filling from the sprite's edge
tells them apart, and what is not reached is written `'2'` and painted the
plate's own colour at stamp time — a hole to the night, with the grass
behind it gone. A grey there read as a plinth, and a ring of it around the
silhouette read as a slab; both were tried and both were wrong. Doing this in
`kinds.js` per cell instead would mean a flood fill on every stamp of every
landmark; doing it here means it is done once, when the art changes, and
holds for every sheet that is ever imported.

**Blocks and Housing kept their ids when they moved to Terrain.** The
palette says Blocks and Housing; the registry says `buildings` and
`houses`, because every saved town names its shapes by id and a rename
would orphan them. The drawn house is `house`, singular, for the same
reason — the plural was taken.

**Cuts are held to whole cells.** A cell is removed when its *centre* falls
inside the cut, and centres sit halfway between boundaries — so a cut whose
edges land halfway puts every centre exactly on the test boundary and which
ones go comes down to floating point. That is the ragged edge.

**Rooms own their contents.** Every shape carries `room`; a room dragged
across the plan carries them, and only a change of *size* lays them again. A
plan drawn before that existed has ownership recovered on load from the drawing
itself (`adopt()`), because without it a wall moves and the furniture stays.

**Furniture keeps a tile clear of the walls.** Slots pack items nearly edge to
edge and three across a room is a wall — a room you can enter and not cross.
The ring cannot be blocked by anything placed inside it, so the guarantee is
structural. Found by a reachability check, not by looking.

**Selection is inversion, and one rule carries all of it.** `.chip.sel,
.btn.sel` was scoped to `#mapbar` until v5.0, so arming Door, Remove wall or
Mask lit nothing — those buttons live in the palette. Nine buttons across
`basemap.js` and `build.js` now hang off that one widened rule, and the two
narrow rules it replaced went away when it landed: re-scoping it, or taking the
`.btn` back off what now reads as a chip rule, takes the armed state from all
of them at once. `#pgen` is the deliberate exception — gold rather than bone,
because armed *there* means replace the plan you already have — and it holds
against the widened rule on id specificity alone.

**A failure that repeats at frame rate says so once, and the two latches are
keyed differently on purpose.** A save runs on every drag frame and a throwing
frame throws again next frame; unlimited, they wrote localStorage sixty times a
second and rearmed the banner's timeout every time, leaving a sign that never
faded and could not be dismissed. `hqStoreFail` latches on the *thing being
saved* — the town, a plan, the markers, the room list, the palace name, the
town name, the map settings — so one failing does not silence another, and `hqStoreOK` clears that
key on the next good write, which is what lets a later failure speak again.
`hqReport` latches on the *message*: the same one is counted and re-said once a
second with its count, a different one is always said at once, because a new
failure is the news. Collapse either into a throttle by the clock and the
second fault hides behind the first.

**The eight-second boot timeout cannot fire on a load that would have
finished.** Once the map picture decodes, `boot()` is synchronous through to
hiding the boot screen — the one async thing it starts, `Loci.init()`, never
gates it — so a screen still up at eight seconds is a load that stopped, not a
slow one. Two guards on the message are each one edit from being undone: it
names `hq.lastError` only when that error's stamp is newer
than this page load, because nothing ever clears that key and a restore skips
it too; and it defers to anything `game.js` has already written into the boot
screen, because `#fatal` covers the viewport and would otherwise hide the
precise reason behind the vague one.

**The bag's first card is `character` in the store and "person" on the
page.** The store had the name before the page did, and the words and
pictures already in it answer to it; renaming the key would orphan them for
a word. Cycle keys are `character2`, `action2`, `object2`, … — the first
cycle carries no number, so what was stored before there were cycles is the
first cycle.

**Fleur De Leah ships; every other face is fetched.** Since 2026-08-28
the default face is an `@font-face` in index.html over
`assets/fonts/FleurDeLeah-Regular.ttf` (SIL OFL 1.1, licence beside it),
because a phone with no fonts service drew the 5×7 type in its place.
`title.js` asks `document.fonts` first and only adds the Google link for
a family the page does not carry. The licence question below still
stands for any other family: do not add a font file without its licence.

**A title in a font is still diamonds, and the font is fetched, not
bundled.** `title.js` rasterises a Google Font and hands one diamond per
cell of ink to the same `put` everything else uses, which is the only way a
face gets onto the plate without breaking the one-material rule STYLE.md
opens with. The family is fetched by `<link>` from fonts.googleapis.com the
first time it is named and never again that session; nothing is bundled,
because a font file in the tree is a licence question the project has not
answered (see *There is no LICENSE*). Two consequences to hold on to: the
5×7 type draws until the font lands and whenever it cannot, so a title is
never missing, only plainer; and a family is `ready` only once
`document.fonts.load` hands back a face — the link's own `load` fires for an
unknown family too, with a stylesheet that declares nothing, and trusting
it would draw the fallback monospace on the plate under the name of a font.
The face is built once per name and family and kept; position and pitch
are the caller's. The border goes round a font title through
`Type.border`, split out of `heading` for exactly this, so a title that
changed its rule when it changed its face cannot happen.

**A `file://` image cannot be a CSS mask, so the card frame ships as
data.** Chromium fetches `mask-image` with CORS and every `file://` URL is
its own opaque origin, so `mask: url(assets/card-frame.png)` resolves to
nothing — the overlay painted red without the mask and not at all with it,
which is how it was found. The same wall taints a canvas an asset is drawn
on, so reading the PNG at run time is out too. `tools/frame.py` bakes the
alpha into `src/frame.js` as a data: URI set on `--frame`, the way
`glyphs.py` bakes the sheets: read once, offline, commit what it writes.

**The bag is one page, and its pictures live with the loci.** The `123` and
`abc` rings open the same `Bag.open(system)`; `SYSTEMS` in `src/bag.js` is
the whole of the difference between them (a title, a cap, a label function),
and a third system would be a third entry. The obvious alternative — a page
each — is two copies of one layout, which is what a second copy does. The
cards' pictures go into the locus store rather than a store of their own
because that store already shrinks a photograph on the way in and is already
what `snapshot.py` carries key for key; nothing in `Loci` walks the store
expecting every key to be a marker. The one shared piece of chrome is the
`#lfile` input, which both modules listen to, each answering only when its
own `pending` is set. The page shows one row of five and the slider picks
the row; there was a deal — the next five appearing once fifteen were
complete — and it went when the slider came, because a slider that stops at
the deal is a slider that will not reach the number you came for. The slider
is drawn, not an `<input type=range>`: a native range stood on end is either
a deprecated appearance value or a writing-mode that puts the big number at
the top.

**The platformer writes one `hq.` key, raw.** `routeDone` on the last
picture adds a block per picture to `hq.stock` through `localStorage`
directly — that page has no `Store`, and vendoring one in for one write
is more upstream drift than the write. The builder hears it through the
`storage` event (`Stock.init`), which fires across pages of one origin,
so the strip moves before the platformer window has closed. Keep the
shape `{grains, blocks}` the same on both sides; there is no version on
it, and the store's ladder does not run over there.

**The platformer is unchanged in behaviour.** It plays its own deck when
opened alone. The route is a *chain* — 0 into 1, 1 into 2 — rather than the
built-in deck's disjoint pairs, so a run of n pictures is n−1 scenes and the
picture you just built is the one you empty next.

**Every `file://` page in this browser shares one origin.** Measured, not
assumed. That is why the platformer can read the builder's localStorage *and*
IndexedDB directly — no iframe, no postMessage, no build step. The order goes
via localStorage because the page needs `PLACE.length` synchronously; the
pictures stay in IndexedDB and are fetched before the faces load.

**`attach()` never binds to the platformer unless you name it.** `P` opens
`platformer.html` into the same profile, and both live under a directory named
`memory-quest-le`, so the default match catches both on their *path* — neither
title contains it — and first-listed-wins would let a restore write the town
through the runner. It
drops every `platformer.html` target unless the match string asks for one, and
then prefers the page whose path ends `/index.html` — query and fragment taken
off first, because the builder can be open as `?wallpaper` or carrying a hash.
Both filters read like over-engineering and neither is. Every tool prints which
page it actually got, which is the check that they held.

**A reader of the picture database must create the store.** Every opener
of `hq.basemap` pins version 1 and creates `pic` in `onupgradeneeded`.
`snapshot.py`'s reader once did not, and on a fresh profile that read —
the backup a restore takes first — made an empty version-1 database that
nothing could then add the store to: a bump would strand every reader
pinned at 1, and a delete is blocked by the page's own open connections.
That was the "fresh profile restore" failure of v7.1–v7.7. Open it the
way `basemap.js` does, or not at all.

**One snapshot keeps the Google Maps key.** The strip that guards every
committed snapshot is turned off for the pre-restore backup, and that is not an
oversight: the backup is gitignored, so nothing about it reaches a commit, and
it is the only copy of what is about to be destroyed. Dropping the parameter to
make the strip unconditional is the obvious tidy, and it turns the safety net
into a second way to lose the key.

**`play.sh` refuses rather than falling back.** It tries seven Chromium-family
names and, finding none, exits saying so. The fallback it used to have —
`firefox --kiosk`, then `xdg-open` — takes no `--user-data-dir` and answers no
CDP, so a first run on a machine without Brave would have put the town in the
everyday profile, where the tools can never reach it, silently and for good.
Not starting is the better failure. The same list is repeated in
`wallpaper.sh`; keep the two in step.

**The launcher entry is generated, and the tracked file will not run if you
copy it.** `memory-quest-le.desktop` holds `@DIR@`, `@VERSION@` and a header that
stops being true the moment it is installed — so `install.sh` copies from
`[Desktop Entry]` onward, leaving the explanation behind in the tracked file
where it is still true, substitutes with `|` because a path is what is going
in, and installs the icon under the theme name the entry asks for, so the only
absolute path in the installed file is the one to `play.sh`. Copy the template
by hand and you get a launcher that does not run, and the hand-kept second copy
that used to rot between releases. It never touches `~/.config/kwinrulesrc`:
the desktop plate is `wallpaper.sh`'s, and removing the launcher does not take
it down.

---

## Working on it

**A headless rig needs the real GPU.** `--headless=new` falls back to
SwiftShader, and a plate-sized field — tens of thousands of overlapping
diamonds a frame — pins the GPU *process* at 300 % while the renderer
idles; the page then looks hung from CDP (no pause event, no crash, no
exception, `Runtime.evaluate` never returns) and an afternoon can go
into a bug the game does not have. Launch the throwaway with
`--use-angle=gl --enable-gpu --ignore-gpu-blocklist` and check
`WEBGL_debug_renderer_info` says Mesa, not SwiftShader.

**Never test against the live town.** Launch a throwaway on its own profile
*and* port, and then point the tools at that port as well:

    XDG_CACHE_HOME=/tmp/scratch ./play.sh --remote-debugging-port=9223
    MQ_PORT=9223 tools/snapshot.py save /tmp/scratch/before.json

The second line is the half that is easy to forget and expensive to forget:
**without the port override the tools attach to 9222, which is the live
town.** The separate profile protects nothing on its own, because the port is
what decides which page is being driven. `--port 9223` says the same thing if
you would rather say it once per command than export it.

Seed it by writing `hq.*` keys, do the destructive thing there, delete the
directory afterwards. The live town has hours of work in it and a restore is
destructive — `snapshot.py restore` makes the profile *become* the file,
removing keys the file does not have.

**Drive the running page over CDP.** `tools/cdp.py` is a hundred-odd lines of
WebSocket with no dependencies; `p.js('...')` evaluates in the page. Both the
builder and the platformer expose their state as globals (`G`, `Build`,
`Kinds`, `Interior`, `Loci`, `Palace`, `Doors`; `game`, `st`, `PLACE`) — but
`cdp.attach()` picks the builder on purpose, so the platformer's globals are
reached only by asking for it: `cdp.attach(match='platformer')`.

**Re-slice, do not redraw.** When a building sheet changes, run
`tools/glyphs.py` (the two invocations are in README under *Landmark*,
with the `--set houses=…` split; `--preview` shows the slice as text first)
and commit `src/glyphs.js` with the PNG. The pitch is autodetected from the sheet and both current sheets
come back at 5.371; a sheet exported at another factor is the one case for
`--pitch`.

**Verify with a real screenshot.** `Page.captureScreenshot` over CDP. Counting
instances proves geometry; only a picture proves it looks right. The camera
follows the walker, so setting `G.camT[0]`/`[1]` does nothing — move
`G.x`/`G.y` instead; the third component is the zoom target and is *not*
overwritten, so `G.camT[2]` is how a shot is framed wider or tighter
(`G.fitAll` the whole plate, `G.fitW` the reset). The game pauses on blur, so a
page driven from a terminal is usually paused — come out of it through
`togglePause()`, which hides `#pause` as well; clearing `G.paused` by hand
restarts the frame loop and leaves the pause card over the whole viewport and
in the shot. On the desktop plate neither blur nor `Esc` pauses, so a wallpaper
page is never the paused case.

**The sweep shows before it takes.** `tools/snapshot.py sweep` asks the
running page's index for its orphans and prints each with enough beside
it to judge — a palace's shape count and the rooms it was typed from, a
picture's size, a mission's title. `--yes` backs the profile up to
`snapshots/.pre-sweep-<UTC>.json` and then removes them. Run it dry first,
always: the four orphaned palaces it found at v7.8 are v5.0's typed
palaces with their markers deleted, and whether those are rubbish is
Eden's call, not the tool's.

**Snapshot before anything irreversible.**

    tools/snapshot.py save    snapshots/<name>.json [--port N]
    tools/snapshot.py restore snapshots/<name>.json [--port N] [--yes]

`save` takes every `hq.` key plus both IndexedDB stores, minus `hq.lastError`
and `hq.loads`, and blanks the Google Maps key out of `hq.basemap` on the way
past — snapshots are committed beside a tag, and a billable key that reaches a
commit cannot be taken back out of the history it is in.

`restore` writes the profile as it stands to `snapshots/.pre-restore-<UTC>.json`
first (gitignored), prints the live counts against the file's, and will not go
on until the word `restore` is typed. `--yes` skips the question and never the
backup, and with nothing at the prompt to answer it the command refuses rather
than reading silence as agreement. One consequence worth holding on to: that
backup is written through `save` with the strip turned *off*, so unlike a
committed snapshot it keeps the Google Maps key, and restoring from one brings
the key back with the town.

**Measure the thing you changed.** Most of the real bugs in this project were
found by counting — walkable versus reachable tiles, wall cells before and
after a cut, the drift of an edge that was supposed to hold — and would not
have been found by looking.

---

## Conventions

**Versioning.** The folder carries no version; the git tag does, and the name
in the title, the launcher entry and the README follows it. The installed
entry at `~/.local/share/applications/memory-quest-le.desktop` is *generated* —
`./install.sh` fills the clone's path and `git describe` into the tracked
template, so there is one file rather than two, and re-running it is what
moves the launcher to a new tag. Each tag gets `snapshots/vX.Y.json` beside
it, because the source tree is only half a version: the town lives in the
browser profile. `STYLE.md` is kept in step too, but as a different kind of
surface: those others carry the tag, while `STYLE.md` carries the values — so
a release that moves a palette token, a spacing or a corner is not finished
until `STYLE.md` says the numbers the code does.

**Branches are named for the version being worked toward**, so a branch and a
tag never share a name — that makes the name ambiguous to git. Work happens on
the branch; `master` is fast-forwarded to each release when asked.

**Commit messages say why, not what.** The diff says what. What is worth
writing down is the reasoning that would otherwise be re-derived wrongly, the
thing that was measured, and the mistake that was made on the way.

---

## Open threads

- **The plate is the screen now (build 256), and any town from before
  it is off-centre.** Decided by Eden 2026-09-05: 16:9, the columns
  added on the right only, no migration — the profile had just been
  wiped, so there was no live town to move. What that leaves: a town
  from before 256 — Eden's Myrtleford as saved in
  `snapshots/live-2026-09-05-before-wipe.json`, and every `snapshots/v*.json`
  — restores at its old coordinates in the left three fifths of the
  plate, with its old oversized boundary shape centred at x = 415. If one
  is ever wanted back centred, that is the coordinate migration the old
  thread described (`hq.shapes` x/pts/ctrl, `hq.markers`, the
  `hq.basemap*` place, `hq.shapes.region`, and whatever in `hq.rooms.*` /
  `hq.marks.*` carries plate coordinates), shifting everything right by
  half the added width — 363 units — as a `store.js` ladder step. Not
  started. The cell pitch also moved by a twentieth of a percent with the
  rounding of the added columns (3.1458 → 3.1474), which an old shape
  absorbs the first time it is edited.

- **Seven `buildings` glyphs are solid blocks, and that is the ART.**
  a21, a22, a23, a25, a28, a29, a30 come out as filled rectangles of lit
  cells. They were nearly "repaired" as inverted sprites on 2026-08-30;
  cropping the source cells out of `assets/buildings-a.png` and looking
  at them showed the artwork itself is solid-filled — a21 and a22 are
  white blocks with a thin dark roof line. The slicer has them right.
  **Do not invert them.** If they are unwanted, the answer is new art or
  dropping them from the set, not a transform.

- **Eden's live town has no bindings.** Letters on plates, items on
  markers, the quest — all built and verified on the rig, none set in the
  live profile: Journal › Skills › Music › RAITS › focus; `B` on
  Myrtleford → Letter → A; a road end south → found a plate → Letter → S;
  each marker → Item. Nothing does this for the player.
- **The live Myrtleford picture predates the tone step** and shows Esri's
  grey under the town; Thaw → Print re-bakes it to the ground. Its
  boundary and title also predate their new defaults (a boundary is a
  shape on the plate; the title's Size/mat are tune keys the town may
  carry — `hq.title.*`).
- **Remote sync was asked for and parked.** Eden wants the same town on
  every device; that needs a server (Supabase was proposed, half a day's
  work) — not started, browser storage for now.
- **The survey from a desk is slow** (~40 s on Mail.ru's mirror) and that
  mirror has refused once and answered the next moment; two passes over
  three instances cover it. From the web it is a second.
- **The phone has never been tested on a phone.** Every mobile check was
  Chrome's emulation on the rig; iOS Safari in particular (pointer events,
  `touchstart` cancellation, the PWA) is untried on glass.
- **Cards fade, a spark revives them** — the one item in `QUEUE.md`,
  Eden's idea for later.
- **Build mode by touch** works but its grips are desk-sized.

The older threads, still true:

- **Loci are gone from every palace** and two pictures are orphaned in the
  store. Nothing to play until markers are placed inside a palace and pictures
  attached (`Enter` on a locus with no picture opens the file picker).
- **No palace is named.** The field at the head of the route panel names
  whichever you are standing in, and the name goes to that palace's marker,
  which is where a palace's name lives. It is drawn as text in the banner
  overhead, not in diamonds on the plan — the only diamond type inside a
  palace is each room's number and label.
- **Every palace is partly unreachable.** Resizing a room moves it away from
  its doors. More doors or wall gaps; the palette counts joined rooms, and
  since v5.0 arming Door or Remove wall lights the button, so the two tools
  this thread sends you to now say which one you are holding.
- **A cut narrower than a tile looks open and is not walkable.** The drawing
  cuts at cell resolution and the walk grid opens at tile resolution. Not yet
  reconciled, and a real trap when trimming finely.
- **The doors swing for the look only** — the walk grid is open whether the
  leaf is or not. Making a shut door actually block is a different feel and a
  bigger change.
- **`body.mapping` outlives the map bar.** Only `setBar()` clears the class,
  and `body.locus` hides `#mapbar` in CSS without going through it. Nothing
  shows today — the bar is already closed by `Basemap.suspend()` on the way
  into a palace, and `body.locus` hides the HUD anyway — but the class and the
  bar can disagree, and the next `body.mapping` rule is what would surface it.
- **A first-run note was proposed and left undecided.** Nothing writes one, so
  a brand-new profile boots to the printed sheet with no word about what to do
  with it. Left here so the next session can tell that from a decision against.
  Since build 257 an empty home plate boots to the founding frame every time
  until it is printed, which is most of what the note would have said.
- **`docs/LATTICE-CONTRACT.md`** in the halftone project pairs the platformer
  with **Memory Atlas** at commit `b8abd14`, not with this project — it was
  written before Memory Quest existed and has not been touched since, so
  nothing in it has been reconciled against what was built here. Its one
  undeferrable question is *what collides, the cell or the tile*: here the
  drawing is authored on tiles and baked to cells, while collision has stayed
  on the tile — answered for the picture, still open for the walk grid, which
  is the cut-narrower-than-a-tile thread above.
- **Landmarks placed before the one-cell-per-pixel rule keep their old
  boxes.** Eight in the live town were born at tile-snapped sizes; the glyph
  is fitted inside so they draw correctly, but their boxes carry slack until
  each is next resized, at which point `glyphSnap` tidies it. Nothing
  migrates them on load, by choice — a save should not change under you.
- **There is no LICENSE.** The repo is public, `platformer.html` is vendored
  from another project, `assets/map.js` is The Mighty Haunt's printed sheet,
  and the map bar credits OpenStreetMap, CARTO and Google on screen — so what
  this tree may be reused under, and on what terms the vendored and bundled
  art travel with it, is unstated — opened by the release that made the
  project installable.
