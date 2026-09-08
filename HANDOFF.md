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

## Where we are — 8 Sep 2026, build 314 (tag **v8.8** at 280; **v8.9 open**)

- **Build 314, 8 Sep 2026 — the strip at 45°.** Eden, on 313's lean:
  "more slanted - so 45 degree angle - this is to match the angle of
  the diamonds to the left". `#hud` skews 45° now, so its sides run on
  the hub diamonds' own diagonal; the rows skew back 45°; the side
  padding is 18px, not the panels' 12px, because at 45° a row's corners
  reach toward the slanted sides by half the row's height and the type
  was going to touch the border. Verified on the throwaway (port 9333,
  v8.8): row lefts Sparks 262 / Grains 245 / Blocks 229, the box 196 to
  449 wide at the foot and the head. Pushed at Eden's word.

- **Build 313, 8 Sep 2026 — no pause on click-away, the key hints gone,
  the strip leans.** Eden: "disable the pause function when we click away
  - remove the bottom right short key list - make the spark grains blocks
  dialog box slanted and have the blocks slid to the left and sparks to
  the right". (1) game.js's blur listener only drops held keys now; the
  pause is Esc with nothing left to go back from, or the card — README
  *Pausing* rewritten, the wallpaper note and the Esc comment with it.
  (2) `#keys` — the markup, its CSS, and its name in the wall / journal /
  bag / towns / locus / mobile hide-lists — is gone; the reference on the
  pause screen still lists every key. (3) `#hud` wears `skewX(-24deg)`
  from its bottom-left corner (`transform-origin:0 100%`), so Blocks
  stays where it stood and Sparks slides right, Grains half way; each
  row wears `skewX(24deg)` back so the type and the bars stand upright
  in the leaning box; on a phone the origin is the top-right corner, the
  corner the strip sits in there. Verified on a throwaway headless (port
  9333, v8.8 restored): the page comes up unpaused (under a terminal it
  always came up paused before), a synthetic blur leaves `G.paused`
  false and clears the held keys, Esc pauses, a pointerdown on the card
  resumes; row lefts Sparks 230 / Grains 222 / Blocks 215 at 1600 × 1000,
  picture taken. STYLE's greps as before, bar the founding rim's
  `border-radius:50%` (`#frame i`), which predates this. Committed on
  `work` as 7c3f1ee and pushed to origin/main at Eden's word ("push it
  live"); Pages built it and the page serves 313.

- **Build 312 pushed and live, 8 Sep 2026** (Eden: "can we upload this
  to a live working site so i can access it from another computer with
  it saving the assets as requested (so new plates regions cards added
  are saved)"): `work` → origin/main at 9a4e529, Pages built it, the
  page serves 312. **Load from Drive verified the same day**, the one
  leg of the cloud that had never been pressed: `tools/cloudtest/`
  (below, and in README's layout) runs the page from this folder on
  http://127.0.0.1:8000 in two throwaway headless profiles with Google
  stood in for — `fakedrive.py` answers the four Drive calls cloud.js
  makes on 127.0.0.1:8765, and a shim on the page hands back a token in
  place of the popup and routes googleapis.com to it — so everything
  but Google's own servers is the page's own code. Profile A restored
  from a composite town (the live 311 snapshot with v8.3's five
  interiors, fourteen locus pictures and deck laid in: plates, region,
  bench, rooms, cards, the traced map — 40 keys, 1.6 MB plain, 1.5 MB
  sealed), linked, saved twice (the second a PATCH of the same file, not
  a second file); profile B fresh, linked (found the file, `saved` set,
  not dirty), refused `not-the-passphrase` as "wrong passphrase", then
  loaded: confirm shown with both counts, reload, and every one of the
  40 keys and 14 pictures the same hash as A, `hq.index` aside (the
  store's own index, in QUIET). Screenshot of B after the load in the
  run's out dir. What is still not exercised against real Google is the
  `alt=media` download itself; Save's upload was Eden's on 6 Sep, and the
  file is still there (`Bitmap town.json`, 486,839 bytes, modified 6 Sep
  12:00). **Save is a press, not a sync** — the label under Cloud says
  "changed since" when the town here has moved past Drive.

- **Builds 297–311 committed on `work` as one commit, cce87bd, 7 Sep
  2026** (Eden: "much better lock it in commit"), and pushed with the
  HANDOFF note as d391a12; the live site sat at 311 until 312 went up
  the next morning.

- **Build 312, 7 Sep 2026 — the bench is the third chip.** Eden: "we
  just added a grid view mode to edit our assets please add this grid
  view as an option at the top left next to fit out and rooms". The
  Edit row of the builder is three chips now — Rooms, Fit-out, Grid —
  and Grid is the bench (build.js ui): it enters as G does, and lights
  while the bench is on whatever layer the builder is mounted on
  underneath (the bench mounts on the fit-out, so without that the
  Fit-out chip would light on the bench). Rooms or Fit-out pressed on
  the bench leaves it to the plate it was entered from, and leaves the
  builder OPEN on that layer even when it was closed before G was
  pressed — the chip was pressed for a layer, and a layer with no
  builder is nothing. The bench's own refusal from inside a building
  stands and is said in the note; the chips stay as they were. Verified
  on a throwaway headless profile with v8.8 restored, every transition
  and both directions; committed on `work` the same day.

- **Build 311, 7 Sep 2026 — a print is its drawing, filled.** Eden, on
  the stilled bench: "i think its the transparency in some of the darker
  greys — example on the roof of the houses i see a grey in the roof
  instead of it being transparent (only fill in the coloured areas of the
  shape and remove/make other detail transparent in all assets)". Not
  the slicer (the sheets are white art on near-black, thresholded at
  grey 110, so a glyph is exactly the white) and not the lawn: the grey
  was the generator's own screened body — `landmark` in kinds.js drew a
  lit cell that had lit cells all round it as a dim checker (`T.dim` at
  0.4–0.6 alpha, 0.88 size), the roof line as wall-and-trim, and a window
  now and then by the noise; alive, those dim cells crossed to a soft
  halo face and read as tone, and stilled they sat as grey diamonds in
  the roof. Now every lit square is one full diamond in the tone's wall
  colour (0.96 alpha, shaded ±3 % by the noise), both faces the same, and
  nothing else is drawn. This reaches every print on every plate, not
  the bench alone — the bench must show what the town shows — and
  retires the 2026-08 halftone decision (README's landmark paragraph
  updated). Decision for Eden: whether the roof-line trim and the
  occasional window should come back as an option per tone.

- **Build 310, 7 Sep 2026 — the bench stands still.** Eden, on the
  bench: "there seems to be a strange artifact sitting on the assets
  like a weird moving blob — pretty consistent but shows on different
  areas of the assets". Found by capturing Eden's live window three
  times a quarter second apart and diffing: the changes clustered on the
  prints, and an enlarged print showed a dark band drifting across it;
  on the rig, freezing `u_time` took the changed pixels from 15 176 to
  0. It is the LIVING LATTICE (render.js: each cell crosses between its
  two faces on its own clock and sways a tenth of a unit), which on a
  dense asset on a dense lawn reads as a blob. New uniform `u_still`:
  when 1 the living branch is skipped — a cell is its first face where
  it was drawn, no sway, no burst — set from `R.still`, which the bench
  turns on in `enter` and off in `leave`. The town breathes as it always
  has; only the bench is still. STYLE.md's breathing is untouched as a
  value — this is a workbench, not the plate.

- **Build 309, 7 Sep 2026 — the clearing matched to the asset, and
  Save.** Eden: "match the clearing to the asset — place a save which
  then applies everything within that grid space so the asset size and
  group location and clearing behind is saved". Three things. (1) A
  clearing is tied to its print by SEED: `clearUnder` (build.js) makes
  the demolish with `seed: s.seed`, `fill` gives each pair one seed, and
  `clearingOf` finds by seed (falling back to the centre for clearings
  laid earlier today). (2) On the bench `follow()` keeps each clearing to
  its print every frame — moved to the print's centre when more than
  half a cell off it (a touched shape is aligned to its own grid, a hair
  off the print's, so an exact test touched it every frame on the rig),
  scaled by whatever the print was scaled by since last frame (a memo
  of sizes per print id; the warp's blob scaled with it, as `grow`
  does), one touch a frame. (3) `hq.clears` (glyph → [kx, ky], width and
  height as multiples of the print's, 0.5–3) is the clearing's
  proportion, read by `clearUnder` through `Bench.clearOf` — **default
  1 × 1, the asset's own footprint, where it had been MATE = 1.5 since
  2026-08-30**; MATE is now only the fallback without the bench.
  `save()` (the Save chip, before Lay out all) writes, for every print on
  the sheet, its size to `hq.sizes`, its clearing's proportion to
  `hq.clears`, and files its group; the live write of the selected
  print's size (303) is gone, so the sheet is a worksheet until Save.
  The banner reads the clearing's proportion too. Verified on the rig:
  a01 to 1.5×, its clearing scaled with it and followed a move, grown
  by hand to 1 × 1.14, Save wrote both, and a01 created on the town came
  at 1.5× with a clearing of its own seed. Decision for Eden: the 1 × 1
  default reaches every print placed from now on across the town, not
  the bench alone.

- **Build 308, 7 Sep 2026 — the lawn, and a group laid out whole.**
  Eden: "make it so i can fill all the assets within that group on the
  grid — give a grass terrain background so we can also allrigh the
  backgrop". `Bench.lawn()`: `grass` in strips the plate's width
  and twelve tiles deep (a generator fills at most `Kinds.MAX_CELLS`,
  26 000, of a shape in a pass and the plate is ninety thousand cells —
  one plate-sized grass stopped a third of the way down on the rig),
  hard-edged so they abut, on any sheet less than nine tenths grassed,
  the moment it is opened (`enter`, `tab`): `Build.lay([…strips, …plain
  records of what is there])` so the lawn takes the LOWEST ids and every
  clearing (a modifier weathers only shapes older than itself) cuts it.
  The town's title (palace.js overlay and titleCells) steps aside for the
  bench as it does for the region.
  `Bench.fill()` ("Lay out all", the flare chip at the end of the tabs):
  `Build.lay` of the lawn, then for each glyph `Bench.of(group)` offers,
  its clearing (the clearUnder recipe: demolish warp, ×1.5, fall 0 out 1
  feather 3 scatter 0.7 jitter 0.4, `Build.rectBlob` box; skipped for an
  aesthetic kind such as patterns) and then the print at `sizeOf` —
  EVERY clearing before EVERY print, since a modifier weathers only what
  is older than itself and a clearing laid after its neighbour would eat
  that neighbour's edge (seen on the rig's first lay); flowed left to
  right, rows a tile apart, from two tiles in so the top row's clearings
  stay on the plate, stopping at the foot with "N of M laid out". One restamp for the lot. Every set fits at 1× (patterns, the
  biggest, 84 glyphs ≤ 30 cells, in four rows). `clearingOf` now matches
  by centre and ×1.5 width, not `blobSeed`, which `make` does not keep.
  Committed with 297–311 on 7 Sep 2026.

- **Build 307, 7 Sep 2026 — the bench's tabs.** Eden: "in the grid view
  at the top give a category tabs so if we place the asset in this
  category in them moves the asset so its saved within that category (if
  there is a tree in the house group we can move it so its saved in trees
  instead of house)". `src/bench.js` rewritten round SHEETS: one plate a
  group (`hq.shapes.bench.<set>`, the kinds with `glyphs` in palette
  order — Houses … Mountains), a `#benchtabs` row of chips under the
  banner (the region banner's style, `top: 94px`), the open one kept in
  `hq.bench.tab`. The rule: a print stands on the sheet of its group —
  `overlay` files one stray print a frame (`file(s, set)`: the
  `hq.groups` record, `s.kind` made the group's kind, `Build.touch`), so
  dropping a glyph from any group's chips onto the Trees sheet moves it
  into trees. `tab(set)` with a print selected carries it: its clearing
  (the `demolish` box at its centre, `clearingOf`) and itself removed
  from this sheet, the sheet switched, the print re-made from a
  descriptor (`Build.add`, exact), its clearing laid (`Build.clear` =
  clearUnder, exported with `remove` and `select` = sel2), selected and
  filed. The Group chips of 304 are gone (markup and `.benchonly` CSS).
  The single sheet of 303–306 (`hq.shapes.bench`) is orphaned, empty on
  Eden's profile. Committed with 297–311 on 7 Sep 2026.

- **Build 306, 7 Sep 2026 — the grid seen.** Eden, on 305 live: "reload
  as i dont see the grid view". It was drawn: at the bench's opening zoom
  a cell is 3 px on Eden's window, the tile lines had thinned to a dot
  every second cell, half-size 0.45 cell at 0.26 alpha — a pixel of grey
  on the ground. Now two rules: the coarse lines (every four tiles) at a
  dot a cell, 0.6 alpha, half-size 0.62 cell, always; the tile lines in
  what the budget (28 000) leaves — a dot a cell close in, every second
  cell further out, tile corners only with the whole plate on screen.

- **Build 305, 7 Sep 2026 — the bench entered again.** 304 broke the
  bench's entry: the groups' sheet map was named `home` inside the
  module and shadowed game.js's `home()` zoom, so `G.camT[2] = home()`
  threw after the frame was set and before the builder opened — the
  bench came up with no banner and no palette and a "Script error"
  note (a file:// page gives window.onerror no more than that; the
  stack came from wrapping `Bench.toggle` on the rig). Renamed `sheet`.
  The rule stands for a module's own top level as much as for
  region.js: grep game.js's globals before naming anything in a script
  that runs beside them.

- **Build 304, 7 Sep 2026 — the bench's grid, and groups.** Eden: "show
  the grid view — also allow to change categories so i can place an
  asset within a group". The grid: `Bench.overlay` now lays a dot a cell
  along every walk-tile edge across the plate (brighter every fourth
  tile), thinning the dots by halves while the view would want more
  than BUDGET (24 000) of the overlay's 32 768 instances — at `home()`
  the view holds the whole plate and the dots fall to every second cell,
  47 000 wanted; zoomed in they are every cell. The groups: `hq.groups` (glyph → set);
  `Bench.of(set)` is a set's glyph list as moved (the sheet's own less
  the moved-out plus the moved-in), and build.js `variantsOf` reads
  through it, as do the founding's and the demo towns' houses
  (found.js, region.js). A Group row of chips (`#kgroups`, `benchonly`,
  built by `Bench.init` from every kind with `glyphs`) re-homes the
  selected print's glyph: `regroup(set)` writes the record (a glyph put
  back in its own sheet's set is deleted), turns the print into that
  group's kind, and `Build.touch` (the `changed` path, newly exported)
  restamps it. Committed with 297–311 on 7 Sep 2026.
- **Build 303, 7 Sep 2026 — the glyph bench.** Eden: "create a plate
  outside of our gameplay that lets me place an asset within a grid so
  we can set each assets default size". `src/bench.js` is a frame like
  the interior's: `G` (or `Bench.toggle()`) commits and mounts
  `hq.shapes.bench` under the town's kinds (`Build.mount('map', …)`),
  no markers, the page blank, the underlay suspended, the walker spawned
  and the camera at `home()`, the builder opened; Esc leaves and puts
  everything back, the builder to whatever it was. `overlay` rules the
  plate in walk tiles (the interior's register marks, at the tile always,
  brighter every fourth) and, each frame, writes the SELECTED print's
  multiple to `hq.sizes[glyph]` when it differs (1× is the default and
  is deleted) — only the selected one, so two prints of a glyph never
  fight. `build.js` births a print with `mult: sizeOf(variant)`
  (`Bench.sizeOf`, 1 without the bench) and a glyph switch on a selected
  print takes the new glyph's size. The banner (`#bench`, the region's
  style) reads the selected print as glyph · multiple · cells · tiles.
  Gated like the interior: the atlas's edge and doors, distractions, the
  quest letter, the compass; the region refuses while the bench is up
  and the bench leaves the region first. `hq.sizes` and the bench's
  shapes are `hq.` keys, so a snapshot carries them. Two more in
  build.js: `make(d)` births a descriptor with no `mult` at the glyph's
  size (a restored shape always carries its own), and `create(kind,
  type, wx, wy)` — the click-with-a-kind-armed path — is exported as
  `Build.create` for the tools (`Build.add` takes a descriptor).
  Verified on the rig: a21 placed at 1×, Shift+↑ to 1.5× and 2× wrote
  `hq.sizes`, Esc, and a21 created on the town came at 1.5× (66 wide
  against 44). Committed with 297–311 on 7 Sep 2026.
- **Build 302, 7 Sep 2026 — the region's zoom is the map's scale, not
  the camera's.** Eden, on seeing 299–301: "this is not what we want —
  the zoom is only moving the boundry not everything else — the boundry
  sets the towns within so the actual background map is the only thing
  zoom in and out then if another town falls in range then it falls out
  of the rectangle then onto inside of the boundry". So: the camera on
  the region rests at `far()` and stays there (`applyZoom`); `eye()`
  returns `scale: p.scale / fac`, a per-eye factor on the founding scale
  (`hq.region`.scale untouched), and since `toXY`, `bounds()`, `radius()`
  and `ground()` all hang off that, the diamonds and the rectangle stay
  put on screen while the towns and the tiles rescale under them — a
  cluster on the line dissolves into towns inside as the map goes wider,
  and gathers again as it comes closer, all through `layout` each frame.
  `Region.zoomBy(k)` steps the factor, and game.js `zoomBy` routes to it
  on the region (keys, View chips, pinch; `zoomHeld`/`zoomLocked` gone
  from game.js); `zoomTo(f)` maps the bar on a log scale from 1/8 (OUT,
  eight times wider) to 4 (IN, four times closer), the default at 0.6 of
  the bar; `easeZoom()` in `overlay` glides `fac` to `facT` each frame
  so keys, bar, pinch and restores all glide; `across()`/`km()` is the
  boundary's width in kilometres (`G.W × 0.6 × scale × 111.2`), the
  bar's readout and in the View note. `hq.region.zoom.at[eye]` is now
  the factor (a 299–301 camera ratio under the same key reads as a
  factor: a little closer than meant, rewritten by a press of Lock;
  Eden's live profile has no record). Lock/unlock/forget as at 300. A
  locked eye's `zoomBy` says so at most every 1.5 s, so a pinch does not
  spam. Committed with 297–311 on 7 Sep 2026.
- **Build 301, 7 Sep 2026 — the zoom bar only in the builder.** Eden:
  "make the scroll zoom only show in build mode". One rule in
  index.html: `#rzoom` shows on `body.region.building` rather than
  `body.region`, the same gate as the boundary; `syncSlider` still runs
  each frame so the bar is right the moment the builder opens. The lock
  itself is unchanged — a locked eye still holds `+ − 0` and the pinch
  with the builder closed. Committed with 297–311 on 7 Sep 2026.
- **Build 300, 7 Sep 2026 — unlocking keeps the zoom remembered.**
  Eden, on 299's parked decision: "keep the zoom remembered when
  unlocked". `hq.region.zoom` is now `{at: {eye: ratio}, held: {eye:
  1}}`: `setLock(true)` writes the ratio and the hold, `setLock(false)`
  lifts the hold only, so the eye is free to zoom and still comes back
  at the remembered zoom; `zoomLocked()` is saved-and-held.
  `forgetZoom()` is back (exported, and a Forget zoom button beside
  Lock in the View block, `off` while nothing is remembered) and clears
  both, so the eye rests zoomed out again. A 299 record has no `held`
  and reads as every remembered eye held. The View note says `locked at
  2.52×`, `free, remembers 2.52×`, or `free`. Committed with 297–311 on 7 Sep 2026.
- **Build 299, 7 Sep 2026 — the boundary only in the builder; a zoom
  bar at the right, with a lock per region.** Eden: "make the rectangle
  boundry only show in the build mode — and give it a scroll bar on the
  right side that zooms in out of the map and allows a lock function
  that saves that zoom amount so we can be more specific on each area
  and the plates within that zone — the lock saves it as an independent
  map zoom for different regions (leave current amount as default)".
  `frameLine` in src/region.js now draws the dotted rectangle only while
  `Build.active()` (the Boundary chip still puts it away there). `#rzoom`
  (index.html) is a vertical range down the right of the screen while
  the region is up — `writing-mode: vertical-lr`, max at the head — with
  the zoom read out and a Lock button under it; `Region.zoomTo(f)` maps
  the bar's fraction to the camera on a log scale between the resting
  zoom (`far()`, 1×) and the nearest (`fitW × 5`), and `syncSlider()` in
  `overlay` moves the bar back under the keys and the pinch each frame
  unless the hand is on it; letting go blurs the bar so the arrows go to
  the walker again. The lock is now per eye: `hq.region.zoom` is
  `{at: {eye: ratio}}` and an eye with a ratio IS locked — `setLock(true)`
  writes the zoom as it stands, `setLock(false)` deletes it and the eye
  rests zoomed out next time; `zoomLocked()` is `!!savedZoom()`, so
  `+ − 0`, the pinch and the bar are held on a locked eye and free on
  the others. Save/Forget zoom are gone from the View block and the API
  (`saveZoom`/`forgetZoom` removed; `zoomTo` added). The bar hides under
  the tune panel (`body.tuning`) and on the wall. Committed with 297–311 on 7 Sep 2026. **Decision Eden may want to flip:** unlocking forgets the
  zoom (the eye rests at the default again) rather than keeping it free
  but remembered — one switch, as asked; a "remembered but free" state
  would want Save back.
- **Build 298, 7 Sep 2026 — the ground fades in whole.** Eden, with the
  region up: "there is a delay in the map loading in the background of
  the zoomed out map — can we instead have it fully load in the
  background then it fades in once its completely loaded". A live tile
  used to show the moment it landed, so the sheet filled in from its
  top-left corner a tile at a time. Now `src/basemap.js` gives each tile
  the class `tile` (born at opacity 0, index.html) and `reveal()`, run
  on every tile's answer, turns the whole set to `.in` in one breath
  once every tile the view asked for is `complete` — they fade in
  together over 0.7 s, under the layer's own Fade. A cap (`REVEAL_MS`,
  six seconds from the first unseen tile) shows what has landed if one
  tile hangs, and from then each late tile fades in on its own until the
  sheet is whole again; `clear()` forgets the cap. A pan that adds a row
  lands that row unseen and fades it in as a set. The town's own tracing
  tiles behave the same, since it is one sheet either way. Baking
  (Freeze) is untouched — it draws the images, not their style.
  Committed with 297–311 on 7 Sep 2026.
- **Build 297, later that night — the town sealed and kept in Google
  Drive.** Eden asked for the safest way to keep the game on an online
  drive and open it from a web link anywhere, with nothing inside it
  readable by anyone else (a number on a stack was the example). The
  answer built: `src/cloud.js` seals the version-3 town file with
  AES-256-GCM under a key PBKDF2 draws from a passphrase (600k rounds,
  fresh salt), gzipped first; the passphrase is asked in a panel of the
  page's own (`#seal`, the found panel's shape), kept in memory for the
  session, written nowhere. Google Identity Services is fetched on first
  press and hands a `drive.file` token; one file per player, `Bitmap
  town.json`, in a Bitmap folder in My Drive (visible, deletable, owned by
  Eden); the link is remembered under `cloud` through the store — not an
  `hq.` key, so no snapshot carries it. The Cloud block sits under Town:
  Link Google Drive / Save to Drive / Load from Drive, then Export locked
  / Import locked. Save and Load are `off` until linked; the label says
  `saved <when>` or `changed since <when>` (any hq. write after boot's
  first three seconds, bar the diagnostics). The OAuth client is Eden's,
  made that night in the Google Cloud console in a project named
  **Bitmap** (a first client made in an older half-configured project,
  FluxScan, was refused at sign-in with 403 access_denied — its consent
  screen could not be completed — and was abandoned; a fresh project's
  Get-started wizard forces every field); the client ID is in cloud.js
  and is not a secret (origins `https://parsemedata.github.io` and
  `http://localhost:8000` are allowed; Testing mode with Eden as the test
  user; the Drive API enabled). **Verified on the rig 9224:** the seal
  round-trips the demo town (633 KB plain, 487 KB sealed, 113 ms each
  way), a wrong passphrase is refused as such, nothing of the town shows
  in the envelope; on file:// Link says on the banner that it needs the
  web page. **Verified by Eden on `http://localhost:8000`** (a
  `python3 -m http.server 8000 --bind 127.0.0.1` started in the folder,
  still running at the close): Link Google Drive → Google's popup →
  linked; Save to Drive twice — an empty town at 11:58 (3 KB) and the
  demo town at 12:00 (486,839 bytes) — both confirmed from Drive's own
  side through the claude.ai Drive connector: folder Bitmap
  `1rPuXVS3eustQee-LXHKzBSHp2377desd`, file `Bitmap town.json`
  `1tDXchs02ucJy1tAzBqpwTpfN9X08igHb`. **Load from Drive verified 8 Sep
  2026** against a stand-in for Google (`tools/cloudtest/`, see *Where we
  are*): download → unseal → confirm → load → reload, the second profile
  the same as the first key for key. **Not verified:** the `alt=media`
  download against Google itself (Eden had not pressed Load at the close
  of 6 Sep); and Export/Import locked through a real file picker. **What went wrong on
  the way, so it is not repeated:** (1) the first OAuth client lived in an
  old half-configured project (FluxScan): every sign-in gave 403
  access_denied "has not completed the Google verification process" even
  with the tester listed and Branding saved — a fresh project through the
  Get-started wizard fixed it in three minutes; (2) the new project's
  Audience page still says "OAuth configuration is incomplete" with
  Publish greyed although Branding is complete and saved (name, support
  email, contact, authorised domain parsemedata.github.io) — a stale
  banner; sign-in works in Testing mode regardless; (3) after the client
  ID changed the page kept running the old cloud.js — the HTTP cache
  under the service worker; `Page.reload ignoreCache` did not clear it;
  unregister the worker, delete the caches, `Network.clearBrowserCache`,
  then reload; (4) T does nothing while the founding frame is up (a fresh
  origin founds a home first) — press Later, then T; (5) the "changed
  since" mark flipped on a distraction settling a moment after a save —
  `hq.distract` is now in the quiet list (verified on the rig: a
  distraction write leaves the mark, a town write sets it). **Test window
  left open:** Brave, profile `~/.cache/mq-web`, CDP port 9225, signed in
  as Eden, a tab on localhost:8000 holding the demo town and a console
  tab. `.gitignore` now refuses `snapshots/live-*.json` and
  `snapshots/rig-*.json`, because the repo is public and a capture is a
  town. Left uncommitted at the close of the night on Eden's word ("log
  everything", not a commit), and committed with 298–311 on 7 Sep 2026.
- **Handoff, 6 Sep 2026, night — read this first.** Eden: *"create
  handoff and commit so we can close this conversation"*. Where things
  stand:
  - **The tree.** `work` is at the peer worktree's build 283 commit
    (`76fe2c0`, fast-forwarded there at 284) plus ONE commit made at the
    close of 6 Sep: **builds 284–296**, seventeen files and `src/morph.js`
    new, committed as Eden (`git log -1`). `.claude/` was put in
    `.gitignore` at the same time (the peer session's worktree lives
    there). **Pushed** the same night on Eden's word (`git push origin
    work:main`, 37eddff..24c0136 — 282, 283 and this commit together),
    so the live site at parsemedata.github.io/BitMap serves build 296.
    A plain `git push` had done nothing: `work` tracks origin/main but
    the names differ, and git's default push mode (`simple`) refuses
    that with a warning about `branch.autoSetupMerge`; `push.default`
    is now `upstream` in this clone's config, so plain `git push` works
    as the README says. Every entry
    below from 284 down says what each build did and how it was
    verified; every one is Eden's word quoted. The worktree
    `.claude/worktrees/region-cluster-lines` (branch
    `worktree-region-cluster-lines`, locked, pushed) still stands; if it
    commits again, merge, do not fast-forward. v8.9 is still open;
    index.html says 296.
  - **What the day built**, newest first: 296 the road-end label kept
    on screen above or below the sprite, and the morph sweeping against
    the way walked; 295 demo towns each turned (`hq.basemap.<id>.turn`,
    `Basemap.rot()` falls back to it), filled by the seed, their roads
    laid toward their linked towns with one-tile cardinal ends, the
    Re-lay demo chip, the next town's name fading in at a road end; 294
    the compass needle underdamped, the ring jostled only while it
    swings, the bursts' Life quieter; 293 the compass swinging to a
    heading on a spring, Life per layer, the ring's lean, the title's
    cells in the morph; 292 a road end crosses to the town that lies
    that way on the region by the compass's true heading, a linked town
    at once, another offered and linked, landing on the end that points
    back; 291 the stock infinite by default (Stock chips) and the Demo
    towns chip founding a linked plate per sample, a plate lettered with
    its own town's name; 290 the cells travel between plates
    (src/morph.js); 289 an opening opens nothing further, a cluster
    opens on its lead; 288 the map under every eye, warmed on the way;
    287 the boundary drawn, for now; 286 the boundary; 285 the region
    rests zoomed out, the compass in the window's corner; 284 zoom per
    eye, links by hand, structures and terrain on the region, joined
    over the worktree's 282–283.
  - **The live town was never touched** — nothing attached to port 9222
    all day (it was not running); its profile has none of this until it
    is next launched, when it gets the code (infinite stock at once; the
    demo towns on the Demo towns chip).
  - **The rig.** A throwaway on port **9224**, profile
    `~/.cache/mq-rig/cache`, launched with
    `XDG_CACHE_HOME=$HOME/.cache/mq-rig/cache ./play.sh --remote-debugging-port=9224 --window-size=1600,1000`;
    driver `~/.cache/mq-rig/rig.py` (PORT 9224: `js EXPR`, `shot FILE`,
    `key CODE…`, `wait EXPR`; `rig.click(p, x, y)` from Python; a held
    key is two `Input.dispatchKeyEvent`s 250 ms apart — game.js reads a
    held set each frame, a tap is missed). 9223 is the worktree's. Its
    town is saved in `snapshots/rig-2026-09-06-demo.json` (untracked,
    0.6 MB): Barwidgee from v8.8, the rig's own Wodonga/Ouyen/Geelong
    plates, the fourteen demo towns as laid at 295, sixteen links, the
    home eye's seven region shapes — restore it into a fresh throwaway
    to pick the testing up. `snapshots/rig-2026-09-06-region.json` is
    the same rig before the demo towns. Every capture named in the
    entries is in `~/.cache/mq-rig/`. The rig's window is on Eden's
    desk and Eden plays in it between runs (it had walked to Merbein
    once), so read its state before assuming it.
  - **Two traps for the next session.** A new top-level name in a
    module must be grepped first: region.js already had `landing` (a
    flag) and basemap.js `turn` (a function), and each clash cost a
    build that would not parse, with only "Script error" to show for it
    on file:// — capture `Runtime.exceptionThrown` over a reload to see
    the real message (the snippet is in the 292/295 entries' spirit;
    `~/.claude/jobs/…/t*.py` are gone with the job). And rapid plate
    hopping in one evaluate races `Basemap.mount`; guarded at 295.
  - **Decisions parked on Eden.** (1) The boundary line and its chip
    are temporary by Eden's word (287) — take `frameLine` and the chip
    out together when the rectangle is placed. (2) The merge within six
    radii bites harder on the smaller rectangle: from Geelong's eye all
    else is one cluster of eleven; the distance is `r * 6` in
    `layout()`. (3) The drift field the morph leaves stays on the town
    as well as the region; `Morph.clear()` on `leave` if unwanted. (4)
    The six findings of the morning's test, in *Open threads*, still
    stand except the stale hint. (5) The morph is 1.8 s (`DUR`). (6)
    The stock is infinite by CODE default — a fresh web player gets it
    too; flip the default in stock.js `free()` if that is wrong. (7)
    The road-end cone is 60° and the return is not always symmetric
    (from Bright, west is Myrtleford at 43° rather than Barwidgee at
    59°). (8) The name field (`Palace.rename`) still writes `hq.town`
    from any plate, so renaming while standing in a demo town renames
    the home town. (9) Eden's own roads end wherever they end: an end
    two tiles wide, or one running into walkable ground, is not noticed
    by the walker (game.js's rule); the demo roads were made one tile
    wide at the end for this. (10) Melbourne's suburbs overlap at the
    region's scale; Save zoom on that eye is the answer. (11) A first
    compass swing over new degrees drops a frame or two while the cuts
    are made.
  - **Not tested:** a phone; the desktop plate; two hand links sharing
    an end in a cluster; the title's morph into a town never visited
    (its face is built async, so the first morph lands on the 5×7 type
    and the face pops in after); the Turn arrows on a pictureless plate
    (they now write `turn`).

- **Build 296 (6 Sep 2026) — the label on screen; the morph sweeps
  against the way walked.** Eden: *"happy with the label - just make
  sure we can see it on the screen (not half on half off so it floats
  above or below the sprite) also give the animation transitions a
  sweep depending on which way our sprite walks in through - so if
  walking into a road off to the right then sweep is from right to left
  - if moving up then sweep is up to down - then mirror the other 2
  options"*. **The label** (region.js `nextLabel`): measured once as
  its words are set (`nl.w/h`); each frame centred on the sprite's
  screen point and lifted 20 px above it, put 20 px below when above
  would be off the top, and clamped six px inside the window both ways.
  **The sweep** (morph.js): `Morph.sweep(dir)` sets a direction the
  next `plan()` takes and clears; `sweepParts` projects each particle's
  mid-flight point on the way walked and gives the far side first —
  `dl = k × 0.5 + dl × 0.5`, spans halved — so walking east the new
  plate lands from right to left, north from the top down, and the
  mirrors; `Region.cross` and a joined plate's crossing in `Atlas.end`
  call it; a jump from the region or the map does not. `Morph.plan()`
  exposes [mid x, mid y, delay] per particle for tests. **Verified** on
  the rig (window 1169 × 662): on Myrtleford's north end, sprite at
  y 55, the label sat BELOW it (top 75, bottom 123) and fully on screen;
  on the east end, sprite at y 123, ABOVE it (55–103) and centred
  (900–1072 about x 986); landing on Beechworth, above. D held off the
  east end: 14,753 particles, correlation of delay with mid-x −0.90
  (right first), with mid-y −0.26; W held off the north end: 7,711
  particles, delay with mid-y +0.96 (top first), with mid-x +0.36. No
  errors; `b296-1..4.png`. Committed 6 Sep 2026, in the one commit with 284–296.

- **Build 295 (6 Sep 2026) — demo towns turned, filled and roaded
  toward their links; the next town's name at the road end.** Eden:
  *"add some more variation to the existing towns - give the towns some
  random turning (rotate plate) so we can test the compass and the
  direction of the roads - fill all of them and make sure the roads that
  lead to the next plate make sense - also make the next town title fade
  in with a small label popping up when we are about to enter that
  plate"*. **The turn:** basemap.js keeps `plateTurn` (radians) in the
  record as `turn`; `rot()` is the placed picture's turn, else that;
  `load()` sets it and lays the live tiles at it (`liveRot`), `mount()`
  resets it, `turnLive()` writes it (so the Turn arrows on a pictureless
  plate turn the compass too), `Basemap.turn()` reads it; region.js
  `storedRot()` reads `turn` after `place.rot`. The variable was first
  called `turn` and basemap.js has a `function turn(dir, big)` — the
  same clash as 292's `landing`; renamed. Also a guard in `boot()`: a
  mount that lands while the picture is being fetched makes the earlier
  boot stale (`plate !== mine` → return), found when the audit hopped
  fourteen plates in one evaluate and home's picture and −30° landed on
  Myrtleford. **The layout** (`demoPlate(name, i, {rot, ways})`,
  region.js): `TURNS` = [−60 −45 −30 −15 0 0 15 30 45 60 90 −90 180],
  `turnOf(name)` seeded; `waysOf(id, geo)` = the linked towns with true
  bearings; one road per way (max five, else east+west): screen heading
  = bearing + turn, run to 70–84 % of the reach to a 2.5-tile margin,
  a perpendicular wander at its middle, then a four-tile stub along the
  nearest cardinal at tile centres (pulled back until the stub fits), so
  the end is one tile wide; half the towns a roundabout (`road`/`ring`,
  r = one tile = RMAX); two houses per road on alternate sides at 36 %
  and 64 %, ×1 or ×1.5, the first the palace's; the gaps between roads
  sorted by size — grass 12×9 + park 8×5 in the widest at 13 tiles, one
  or two `trees` 6×5 in the next at 17–26 tiles, a `water` warp 10×7
  (oval blob) in the third for 35 % of towns. `foundSamples` now founds
  every area, writes the links, THEN lays the plates (`layPlate`) so the
  roads know their links; `relayDemo()` lays every `demo` plate again
  (walker sent home first if on one), on the **Re-lay demo** chip under
  Towns, behind a confirm. **The label:** `endHere()` (game.js tryStep's
  rule with `wAt`: one walkable neighbour, behind) and `nextLabel()`
  each frame from game.js after `Region.prompt()`: a `#nextplate` glass
  div beside the walker (16 px right, 44 up, from the walker's world
  point through the camera) — the joined plate's name at an atlas link,
  else `wayOut(dir)`'s town with word and km — fading in by CSS (opacity
  and a 6 px rise over 0.35 s, `.on`), keyed by plate + tile + dir so
  the lookup runs once per tile stood on; nothing while moving, paused,
  inside, on the region or the wallpaper. **Verified** on the rig (the
  fourteen re-laid): turns Myrtleford 15°, Yackandandah −30°, Beechworth
  60°, Bright 180°, Wangaratta 60°, Melbourne 90°, Footscray −90°,
  Brunswick 0°, Richmond 180°, St Kilda 90°, Mildura 45°, Red Cliffs
  90°, Merbein −45°, Irymple 15°; 7–19 shapes each (Mildura: roads,
  roundabout, grass, park, trees, lake, houses). The audit — every
  walkable dead end on every demo plate, pressed outward through
  `wayOut` — leads to a linked town in every case but one (St Kilda's
  road start at the centre faces west onto the rig's own unlinked
  Geelong at 60°): Myrtleford n→Beechworth 6°, e→Barwidgee 31°,
  w→Melbourne 27°, s→Bright 32°; Melbourne n→Footscray, e→Brunswick,
  w→St Kilda, s→Richmond; Mildura n→Merbein, s→Wangaratta; and so on.
  Then one plate at a time: Myrtleford mounted with `Basemap.rot()` 15°
  and the compass swung to 15.1; on its north end the label read
  BEECHWORTH · NORTH · 22 KM · PRESS ON; W held crossed to Beechworth
  (turned 60°, the compass swinging to 59.9), landing on a road end at
  (22, 48) with one neighbour, where the label read MYRTLEFORD ·
  SOUTH-WEST · 22 KM · PRESS ON — the road back; screenshots
  `b295-1..5`; no errors. **Noted:** the label sits over the controls
  panel when the road end is in the bottom-right corner; the lake can
  lie against a road (Mildura). Committed 6 Sep 2026, in the one commit with 284–296.

- **Build 294 (6 Sep 2026) — the needle bounces; the ring only while
  it swings; the bursts quieter.** Eden: *"make the layer 2 dither more
  subtle - and only apply ring spin when layer one pointer is moving -
  make sure the layer one pointer turns with a natural bounce wobble
  like a real compass"*. compass.js: the spring is K 40, C 3.5 (ζ ≈
  0.28) — past the mark by about a third of the turn, back past it by a
  little, at rest in about two seconds; `swing.tgt` kept so `moving()`
  is "turning, or short of the mark"; the coarse cuts (2°/3°) now only
  above 30°/s, so the wobble's tail is cut at every degree. `wander()`:
  while `moving()` the ring takes a new lean every 400–900 ms, `(0.35 +
  0.65 × min(1, |v|/90)) × 8° × life` either way, on a spring (6, 3);
  at rest its target is 0 and it snaps square under 0.05°. The panel
  header reads "jostled by the needle". Life: PHASE 180 ms, and the
  layer's own shake is now BAKED into the live face (`liveFace` makes
  the very roll `Title.emit` would, from the layer's seed) so it no
  longer re-rolls every cell's place each step — what changes is a wink
  of life/10 of the cells and a wobble of `life × 0.4` cells on top
  under a moving seed; defaults bottom 0.25, middle 0.35. The first cut
  of 294 (drop life/16, shake re-rolled at `jitter × 0.5 + life × 0.12`)
  still read as every cell jumping a pixel each step, which was the
  "dither" that was too much. **Verified** on the rig, Barwidgee's
  picture turned −30° → +20° and the shown heading read off the page's
  own frames: 331, 11.7, 39.9 (past the mark by twenty of the fifty),
  26.5, 12.2, 16.9, 23.0, 21.5, 18.9, 19.3, 20.4, 20.4 — at rest in
  about 2.7 s; the ring's lean 0 before, −0.7 → −2.6 → +1.8 during, back
  to 0.09 and then 0 after; frames on the cached way back median 14 ms,
  p90 26; the compass box at rest changes 34 pixels over three
  third-second gaps at a 40-level threshold and 495 at 12, where 293's
  life changed 191 and 1,997 (and the first cut of 294 the same); no
  errors. Committed 6 Sep 2026, in the one commit with 284–296.

- **Build 293 (6 Sep 2026) — the compass swings, breathes and leans;
  the name travels.** Eden: *"add an animation to the compass so when
  we change the direction of the map (spin in a certain degrees) the
  compass will animate top layer by smoothly spinning it to the correct
  direction - also give layer 2 of the compass (grey middle) a subtle
  jitter/dither change so its always changing subtly - make the ring
  spin slightly one way to another at random - also make the title give
  the same pixel transition effect as the plate detail"*. In compass.js:
  **the swing** — `spin()` runs a damped spring (K 60, C 11, ζ ≈ 0.7)
  from the heading the rose shows toward the map's, the shortest way
  round; the turning layers are cut at the SHOWN heading, so the rose
  turns a degree at a time as the spring moves (each cut is cached by
  `Title.stencil`, so a way once swung is free after); while the spring
  is fast (`moving()`, > 0.5°/s) the top layer is cut every second
  degree and the two bursts every third (asked on their own key), at
  rest all three at the one exact degree as before. On the region the
  heading is 0, so entering it swings the rose to north and Esc swings
  it back. **Life** — a new per-layer tune row (`life`, 0..1; bottom
  0.4, middle 0.6 and ring 0.5 by default via `life0`): on a drawn
  layer, every 140 ms (`PHASE`) `liveFace()` winks out life/8 of the
  composed cells under a fresh seed and the shake seed advances (`+ ph
  * 7`, amplitude `jitter × 0.5 + life × 0.3`) — done on the composed
  face at draw time, no cut and no recompose. Eden asked for the middle
  ("layer 2, grey middle"); measured on the rig with the ring held
  still, the middle alone (88 composed cells, dim ink at 0.7 over the
  ground) changes about a thousand pixels a third of a second at a
  12-level threshold and five at a 40-level one — it lives, faintly, as
  dim ink does — so the bottom burst, the other grey and the speckled
  one, has Life too (about three hundred pixels at the 40 threshold),
  since the grey the eye reads in the ring is both; either is one
  slider from still; **the lean** — `wander()`: the ring
  drifts to a new lean every 2–5 s, up to 8° × life either way, on a
  slow spring, and is cut at that lean (`degOf`: turning layers at the
  rose's heading, the ring at its lean; `layerKey`/`footKey`/
  `wantPlates` take both). The ring's panel header says "wanders a
  little". `Compass.swing()` exposes {x, v, lean, leanTo} for tests.
  **The title travels:** palace.js `titleCells()` draws the title into
  a scratch Float32Array through the same `title()` and reads it back
  as morph cells (x + jx, y + jy, rgb, alpha, |size|, ring flag);
  nothing on the region or the wallpaper; `Palace.overlay` holds the
  title back while `Morph.active()`; morph.js `figure()` =
  `Build.cells` + `Palace.titleCells()` in both `begin` and `settle`.
  **Verified** on the rig: turning Barwidgee's picture from −30° to
  +20° the shown heading went 330 → 344 → 4 → 15 → 20.9 → 20.4 → 20 over
  about a second (one small overshoot), mid-swing screenshot
  `b293-1-midswing.png`; frame times during a fresh swing median 14 ms,
  p90 27, max 45 (the first cuts of new degrees; a repeat swing is
  cached); the ring's lean drifting 0 → 3.5 over four seconds then a
  new target; `Palace.titleCells()` 1,243 cells for Barwidgee, the
  morph to Myrtleford 15,101 particles with the letters mid-flight
  (`b293-3-title-morph.png`), 1,543 cells for Myrtleford after; the
  rig's `hq.compass` was written for the A/B and put back as it was; no
  errors. `Compass.swing()` also lists the composed cells per layer.
  **Noted:** a first swing over new degrees drops a frame or
  two while the cuts are made; the title's face for a town never
  visited is built async, so the first morph into it lands on the 5×7
  type and the face pops in after (as the title always did on a first
  draw). Committed 6 Sep 2026, in the one commit with 284–296.

- **Build 292 (6 Sep 2026) — the end of the road leads to the next
  town.** Eden: *"we want the end of the road within the plate to line
  up with the next plate on the zoomed out map - so if the compass
  direction matches the zoomed out map in terms of which way the end of
  the road is pointing to the east then the next town over on the east
  connects so we can travel between plates on the zoomed in zone"*.
  In region.js: `wayOut(dir)` — the plate's screen direction turned back
  by `Basemap.rot()` (the compass's heading) to a true heading, every
  other town with a place bearing-tested from this plate's anchor
  (`Atlas.geo(current)`, else the town's mean), within a sixty-degree
  cone (`CONE`); a town linked to this one in `hq.region.links` first by
  the closest bearing, else the nearest by distance; returns `{town,
  linked, heading, word, bearing, off, km}`. `cross(w, dir)` links the
  two if they were not, `Atlas.go(root, Atlas.entry(dir, at))` (entry
  now exported), then `roadEnd(back, id)` stands the walker on the road
  end of the new plate heading back the way we came — a road tile with
  one to three road neighbours all behind it and nothing ahead (so a
  road two tiles wide still ends), its stub's true heading within the
  cone of `back`, the one furthest that way — reading the other plate's
  turn off its `hq.basemap.<id>` record because its underlay mounts
  after the walker has landed (`Basemap.rot()` is 0 at that moment).
  In atlas.js `end()`: after the door, `Region.wayOut(dir)`; linked →
  `Region.cross` at once; else the prompt offers the town (`go to
  Bright` on Enter, a new `#edgeopen` button for the old `open a plate`
  → `Found.ask`, `stay`). In game.js `tryStep`: a tile eaten by a
  distraction ahead is not an end (`Distract.list()`), and a successful
  `Atlas.end` clears the held `keys`, since a held key otherwise walked
  straight on from the landing end — and with a distraction cut beside
  it, straight over to a third town (seen: Bright → Myrtleford →
  Melbourne in one held A). **Demo plates** (`demoPlate`) now lay every
  road's last run along a row or column of tile centres, so the road is
  one tile wide at its end and the walker's own end test fires there;
  the rig's fourteen were re-laid (`Region.demoPlate` exported for it).
  A name clash cost a round: the helper was first called `landing`,
  which build 289 already has as a flag, and region.js would not parse.
  **Verified** on the rig: from home (turned −30°) east is south-east
  and the way is Bright (29° off, unlinked) where screen-east would
  have been Yackandandah; the offer read *the road ends here heading
  south-east — Bright lies that way, 30 km* with go/open/stay; Enter
  crossed, linked home–Bright (16 links), and landed on Bright's west
  end; from Bright west is Myrtleford (linked, 43°) at once, landing on
  its east end (89, 28); the real key — D held at Myrtleford's east end
  — crossed to Bright's west end (12, 28) and stopped; A held there
  came back to Myrtleford's east end and stopped; A into the distraction
  cut at (87, 28) did not cross; no errors. **Noted:** Eden's own roads
  end wherever they end — an end two tiles wide, or one running into
  walkable ground, is not noticed by the walker (game.js's rule, as
  before); the cone is 60° and the return is not always symmetric
  (from Bright, west is Myrtleford at 43° rather than Barwidgee at 59°);
  the rig had wandered to Merbein between runs — the window is on
  Eden's desk. Committed 6 Sep 2026, in the one commit with 284–296.

- **Build 291 (6 Sep 2026) — the stock infinite; the samples made
  towns.** Eden: *"set an infinite limit on all my materials - also
  create placeholder demo towns for each of the existing places so we
  can go inside and have them link up with each other just to test how
  it would feel when some more interactions added"*. **The stock**
  (src/stock.js): infinite unless `hq.stock.mode` is `counted` —
  `pay` takes nothing and refuses nothing, `afford` is yes, the HUD's
  three bars are full and read `∞`; the levels are still kept and
  still earned underneath (the "+ n" note is quiet), so the new
  **Stock** chips in the tune panel, Infinite and Counted, put the
  counting back with nothing lost. Infinite is the CODE default, so
  Eden's live profile gets it on its next launch without being
  touched; the platformer's own write of `hq.stock` is untouched and
  harmless. **Demo towns:** `Region.foundSamples()`, on the **Demo
  towns** chip under Towns beside Samples and Boundary. For every
  sample (region.js DEMO) that is not a town yet: `Atlas.make(id, name,
  geo, {demo, group})` (new — a plate made by hand, joined to nothing)
  with id `a` + slug (`amyrtleford`, `ast-kilda`), and `demoPlate()`
  writes the plate's storage before it is ever mounted, as `Atlas.add`
  writes its stub: four roads (a main street and a cross street with a
  seeded wander, two side streets ending in dead ends), a grass patch
  and a park, three houses from `Glyphs.of('houses')` at ×1.5, one
  palace marker on the first house named for the town, and
  `hq.basemap.<id>` with the town's lat/lon (shown off) so `M` shows
  the real town. `towns()` now carries the area's `group`, `layout()`
  clusters a real town beyond the plate by it, and a sample whose name
  is a real town's is skipped wherever that town stands. Links: every
  DEMO_LINKS pair plus group lead → member, resolved to ids (the home
  town by `HOME_NAME` 'Barwidgee' → `home`), and existing links that
  named a sample by lower-case name are rewritten to the plate's id.
  **Lettering:** palace.js `plateTown()` — a plate not joined to home
  by road is lettered with its own town's name (Footscray's plate said
  Barwidgee). **Verified** on the rig (9224, restored 290 state): 14
  founded, 15 links, a second press founds 0; from home Myrtleford and
  Beechworth inside the boundary with hand lines, Bright on the line;
  Enter on Myrtleford mounts 9 shapes and its palace, the walker on a
  road with 251 tiles reachable, `Stock.pay('road')` true with the
  levels unchanged; Melbourne's eye (opened by a synthetic cluster of
  the five, since the rig's own Geelong plate swallows them into
  "Geelong 6" and from Geelong's eye into "Barwidgee 12" — the six-radii
  merge, parked decision 2) shows the five suburbs spread inside with
  lines between, all four suburbs on the walk grid, a hop west lands on
  Footscray and Enter goes in; Footscray lettered Footscray, home still
  Barwidgee; no errors. `snapshots/rig-2026-09-06-demo.json` is the rig
  after. **Not done / noted:** Melbourne's suburbs are 5–8 km apart and
  overlap at the region's scale (Save zoom on that eye is the answer);
  the name field (`Palace.rename`) still writes `hq.town` from any
  plate, so renaming while standing in a demo town renames the home
  town — as before, now more visible; the rig's Wodonga/Ouyen/Geelong
  hand plates are not on the live profile, so there Melbourne 5 and
  Mildura 4 are clusters of their own. Committed 6 Sep 2026, in the one commit with 284–296.

- **Build 290 (6 Sep 2026) — the cells travel: the morph between
  plates.** Eden: *"now implement this style into the animation of when
  we move into a new region or town (this applies to the assets within
  the map that have been added in build mode - structures & terrain"*,
  with `scatter-morph.js` pasted — the A→B transition from the lattice
  face-merge. **src/morph.js** is that, brought onto the plate: a
  figure is the composed cells of the shapes drawn (`Build.cells(cap)`,
  new — every cell of every shape `rebuild` batches, as {x, y, rgb,
  alpha, size, glyph} in world units, sampled down by stride past 20,000);
  `Morph.begin()` before the builder is put on the next plate takes the
  figure it had (or a running morph frozen where it got to,
  `snapshot`), `Morph.settle()` after takes the figure it has and plans
  the morph between them — the six things stacked: the jitter kick,
  pairing by angle round the middle, four overlapping waves (precursors,
  the body, the surplus shedding, stragglers), the perpendicular bow, the
  sine wobble, and the surplus becoming the drift field that stays. Two
  things are the plate's own: the kick and the wobble ride the arc and
  die into the landing (`sin(π·e)` and `1 − u²`), so a cell lands
  exactly on its cell; and surplus past the field's twenty to eighty
  posts scatters out and goes (`shed`), where the original simply
  dropped it. While a morph is up the static `build` batch is not drawn
  (game.js) — the particles are it — and it comes back on the frame
  the morph ends, on the same cells at the same colour, so there is no
  step. `Morph.overlay` is first in the entity stream, under everything,
  as the batch is. **Hooked** at every plate change: `open()` on the
  region round `remount()`, `enter()` round its mount, `leave()` round
  its mount (unless the way out is to another plate, whose `Atlas.go`
  settles it), and `Atlas.go` round its mount for any jump. A change
  with no key change between begin and settle moves nothing. 1.8 s.
  **Verified** on the throwaway at 60 fps: Barwidgee's 13,430 cells
  travelled to the region's seven shapes on Enter (13,493 particles, 57
  fps mid-flight), the seven shed into a field of twenty on Wodonga's
  empty eye, a cold start flew them in from the ring on the way home,
  and Esc carried them to the town (13,510 particles, 60 fps). No
  errors; and a change in the middle of a change — home opened half a
  second into Wodonga's opening — chained on through `snapshot` without
  a mark. Committed 6 Sep 2026, in the one commit with 284–296. Not tested: the desktop plate; a
  phone.

- **Build 289 (6 Sep 2026) — an opening opens nothing further; a
  cluster opens on its lead.** Eden: *"seems to be a bug when a sprite
  lands on a cluster and animation expands it swaps to another cluster
  or town on a border and infinitley toggles the animation between the
  two and not until i move to another town within the boundry then the
  animation stops"*. The glide that ends an opening (`open` → `glide`)
  comes to rest too, and 282's `settle()` read every rest: on the town
  the cluster was named for, which from the new eye — the mean of a
  mixed cluster — could itself be a cluster on the boundary, so the
  dwell opened it, whose lead was on the boundary from there in turn,
  and the two handed the eye back and forth until a hop landed inside.
  Two fixes. `landing`, set by `open` after its glide and cleared by
  `hop`, `enter` and `leave`: the rest that ends a landing starts no
  dwell (Enter still opens what the walker stands on). And the eye of
  an opened cluster is its **lead** — the member the cluster is named
  for, else the first with a place — rather than the group's mean, so
  the lead stands in the middle and inside the boundary with the rest
  round it; for a group that is one place (Mildura's four) the two are
  a few hundred metres apart, and for a cluster gathered from far apart
  on a corner (Ouyen with Mildura's four and Wangaratta) the mean was
  empty ground that left every town of it on the line. The home
  cluster's eye is home's anchor exactly, as at 284. Verified on the
  throwaway: Ouyen's six opened on Ouyen — Ouyen alone inside, Mildura's
  four, Barwidgee's seven and Geelong's six on the line — and the eye
  held for five seconds with the walker at rest on it; a hop onto
  Geelong's six opened it by the dwell once, Geelong inside, the eye
  held; Wodonga's two the same. No errors. Committed 6 Sep 2026, in the one commit with 284–296.

- **Build 288 (6 Sep 2026) — the map under every eye, and warmed on the
  way.** Eden: *"load the background maps relevent to the regions and
  areas centered as we dont seem to have certain maps loading"*. Found
  on the rig with Eden's window at 1245 × 704: on Ouyen's eye the sheet
  held Barwidgee's seventy tiles, all loaded, translated 3,500 px off
  screen — `lay()` had refused Ouyen's set. Its ceiling counted tiles at
  one to one (`(VW/256 + 3)(VH/256 + 3) × 1.5` = 72 there), but the
  region's tiles are finer than the screen — `ground()` picks the zoom
  that puts a tile pixel on a screen pixel or finer, 143 CSS px a tile
  in that window — so the zoomed-out view wanted 84, `lay` said
  "zoomed out too far to tile" and returned, and `sync` went on sliding
  the old set to where the new eye put it. **Fix:** the ceiling counts
  tiles at the size they are on screen (`TILE × scale × cam / dpr`),
  never smaller than half of one to one, so the town zoomed far out is
  still refused rather than flooded. **And warmed:** `Basemap.warm(lat,
  lon, z, k, zoom)` asks the browser for the tiles a view will want —
  the same CORS mode as `lay`, nothing laid — and `open()` calls it the
  moment a cluster opens, with the eye it is going to and the zoom it
  will arrive at (`ground(G.camT[2])`, the zoom argument new), so the
  map is in the cache when the slide lands. Verified in that window:
  home, Ouyen, Geelong and home again each lay 96 tiles at z 11 covering
  the whole window, all loaded within a second of the cluster opening.
  No errors. Committed 6 Sep 2026, in the one commit with 284–296.

- **Build 287 (6 Sep 2026) — the boundary drawn, for now.** Eden: *"i
  closed the window because i did not see the boundry - maybe add a
  temporary rectangle shape showing the boundry so we can visably see
  it"*. `frameLine()` in region.js, drawn from `overlay()` before the
  scene: the rectangle as a thin dotted run of the plate's diamonds in
  bone at half alpha, a diamond every cell and a half (about five
  hundred a frame, under the cap). A **Boundary** chip under Towns in
  the tune panel (T), beside Samples, puts it away (`hq.region.bounds`
  '0'); on until then. Temporary by Eden's word — take the chip and
  `frameLine` out together when the rectangle has been placed. Not
  committed, with 284–286.

- **Build 286 (6 Sep 2026) — the boundary.** Eden: *"now create an
  invisible rectangle boundry that all the outside towns sit on -
  including the clusters - so only the centered towns are in the middle
  of the boundery - i like that all towns regions and clusters sitting
  on this border being white - give the boundry a very wide large
  padding so rectangle boundery is very much centered and many diamonds
  can fir on the boundry"*. In region.js the plate's edge with its
  three margins (a diamond and a name in from the sides and top, seven
  radii at the foot for the chrome, and the lift from under the keys
  panel) is replaced by `bounds()`: an invisible rectangle centred on
  the plate, `PAD = 0.2` of the plate's width in from either side and of
  its height from top and foot — 769 × 432 of the 1281 × 720. `inside`
  is strictly within it; `edge(P, C, B)` puts every other town where
  the line from the middle through it meets the rectangle. So the open
  group stands in the middle and everything else — a town beyond the
  rectangle, a town beyond the plate, a cluster — sits on the line;
  from home that leaves Barwidgee, Myrtleford and Beechworth inside,
  with Wangaratta, Yackandandah and Bright on the boundary beside the
  clusters. The merge within six radii and the compass-corner clearing
  are as they were. **Everything on the boundary is bone at full
  alpha, sample or not** (`scene()`: the cluster colour and alphas no
  longer read `cl.sample`); inside, a sample is still dim. A cluster
  gathered across a corner had its mean just inside it (Ouyen's six at
  273, 166 from home), so after the merge pass every cluster is put
  back on the line where the middle looks through its mean. Verified
  on the throwaway: from home Barwidgee, Myrtleford and Beechworth
  inside, Wodonga 2 on the top line, Ouyen 6 on the left, Geelong 6
  and Bright on the foot, all at full alpha; from Wodonga's eye
  Barwidgee 3, Ouyen 5, Geelong 6 and Wangaratta on the line; from
  Geelong's eye everything else is one cluster of eleven on the top
  line, named Barwidgee — the merge within six radii bites harder on
  the smaller rectangle, and a big group reads as one diamond of many.
  No errors. Committed 6 Sep 2026, in the one commit with 284–296.

- **Build 285 (6 Sep 2026) — the region rests zoomed out; the compass in
  the very corner.** Eden: *"always use the map zoom out as default -
  move the compass to the very top left"*. The region's own resting
  zoom is now the far end of the zoom keys — `G.fitAll × 0.85`, the
  whole plate with a margin round it, which is what the map looks like
  zoomed right out — where it had been the town's working zoom carried
  in; `far()` in region.js is the unit a saved zoom is a ratio to, so
  the View block reads 1× at the default, `applyZoom()` lands on the
  default when nothing is saved for the eye (on `enter`, on `open`, on
  the way home), and `0` on the region is `Region.rest()` — the saved
  zoom or the default — rather than the town's `home()` (game.js). The
  town's own zoom is untouched, as before. **Compass:** on the region
  its cut's box now sits in the WINDOW's top-left corner, six CSS px in,
  read off the camera each frame (`corner()` in compass.js) — flush
  with the plate's corner was tried first and still floated, because
  the zoomed-out view leaves a margin round the plate, and it scrolled
  away when zoomed in; the region's map runs past the plate, so the
  corner is still on the map. `Compass.box()` is the box it stands in,
  and the region keeps clusters clear of that rather than of twice
  `Compass.at()`. Verified on the throwaway: the box's top-left at
  6, 6 CSS px at the default and after + + +, and back on 0; no errors.
  Committed 6 Sep 2026, in the one commit with 284–296.

- **Build 284 (6 Sep 2026) — the region is built on: zoom per eye, links
  by hand, structures and terrain.** Eden: *"give me some build options
  to zoom in out lock and save settings of certain zoom levels for
  specific regions - also alow me to place or delete lines between
  certain areas or towns - also want to be able to add structures within
  this view and terrain just like the zoomed in version"*. Made on
  `work` while a peer session made 282–283 in the worktree
  `.claude/worktrees/region-cluster-lines`; numbered 282 there while
  apart, and joined here: `work` fast-forwarded onto
  `worktree-region-cluster-lines` and the builder's region work re-laid
  on the ground's region.js by hand (Eden, seeing the two windows:
  *"build mode is now working - i dont see the map in the background
  anymore"*). Three things, and one idea under them: **a region is an
  eye.** The region seen from home and the region a cluster opens on are
  two plates — each keeps its own shapes (`hq.shapes.region` for home's,
  `hq.shapes.region.<slug>` for a cluster's; `open()` remounts the
  builder on the eye's key through `remount()`, and a cluster with the
  home town in it opens on home's eye exactly, so the way back lands
  where you started) and its own zoom. **Zoom:** a View block at the
  head of the builder's palette, on the region only (`regiononly`,
  index.html): Zoom −/+ through the game's own notch; **Lock zoom**,
  which holds + − 0, the chips and the pinch while the region is up
  (game.js `zoomHeld` says so once on a key, `zoomBy` is simply held;
  the town's zoom is never touched — the frame gives it back on Esc);
  **Save zoom** and **Forget saved zoom**. `hq.region.zoom` is `{lock,
  at: {eye: ratio}}`, the ratio against the working zoom (`home()`) so a
  saved zoom means the same notches on a phone, and it is put back on
  `enter`, on `open`, and on the way home — the ground's tiles follow,
  since `ground()` picks its zoom off the camera. The word under the
  chips names the eye, the zoom now, what is saved, the lock, and on the
  Links layer what the next click will do; the region refreshes it
  itself when any of that changes (`syncView` → `Build.syncView`), so
  the number keeps up with the keys. **Links:** made, not drawn. On the
  Links layer a click on a town starts one and a click on another
  finishes it (a cluster stands for the town it is named for); a click
  on a link selects it, in flare, and Delete removes it; Esc lets go (a
  capture keydown in region.js, before Esc means anything else). Kept
  as pairs of ids in `hq.region.links` — a real town's root plate, a
  sample's lower-case name — so a link follows its towns wherever the
  eye stands, shows from any eye that sees both ends, and is drawn to a
  cluster's place when an end is in one (both ends in the one cluster
  draw nothing); a sample's link stands aside for a hand-made one
  between the same towns, on top of 282's rule that a sample's link
  runs only between groups. Walkable: `Region.stamp(t)`, called from
  `restampTerrain` after Distract's, bands the whole run town to town at
  0.62 tile, so the walker by a town is on the path; `curve()` was split
  into `curvePts()` — trimmed for drawing, whole for the stamp and for
  hit-testing — and the drawing, keeping 282's calmer wave. The Link
  line chip is gone from the region's palette (the kind stays, for any
  link drawn before). Towns are not dragged from the Links layer; any
  other layer still pins them. **Structures and terrain:** the region
  registry (kinds.js `RLAYERS`/`RLIST`) takes the town's `terrain`,
  `built` and `clearings` layers as well — districts, houses, landmarks,
  buildings, flora, signs, creatures, patterns, mountains, demolish and
  clear — under the same ids; not the backdrop or the boundary, and no
  markers. Each eye's plate holds its own. **Verified** before the join
  on a throwaway — v8.8 plus three unlinked plates beyond the plate
  (Wodonga, Ouyen, Geelong), port 9224, since 9223 had been taken by the
  peer's worktree: links by real clicks Barwidgee → Myrtleford and
  Barwidgee → Wodonga's cluster; select by probe, Delete, Esc; W and S
  held walk the link; + + then Save → 1.5625, Lock holds − and 0 and
  `zoomBy`, Forget dims its chip; leaving gives the town its 1.311 back
  and re-entering puts 1.56 back; Wodonga's eye opens on
  `hq.shapes.region.wodonga` with 0 shapes and its own saved 0.81, and
  home's cluster brings 1.56 and 7 shapes back; house, landmark,
  housing, grass and trees placed by chip and click, drawn in the
  plate's material. Verified again after the join, on the same throwaway
  at 284 with the ground under it: the map at 0.45 under the region with
  the region's handles, Barwidgee → Beechworth by clicks, one hop onto
  Wodonga's cluster and 282's dwell opened it onto
  `hq.shapes.region.wodonga` (0 shapes) with its saved 0.81 and the map
  at -36.122, 146.888 z 11; home's cluster brought 1.56, 7 shapes and
  the map at z 12 back; Esc gave the town its picture at 0.25, its
  handles, its zoom, and the hint hidden. No errors. **Committed** 6 Sep 2026, in the one commit with 284–296 —
  Eden's call. Not tested: on a phone; two hand links
  sharing an end in a cluster; the blend when a cluster with shapes on
  its plate opens.

- **Tested 6 Sep 2026 — a real town off the eye** (the item 279 left).
  Eden: *"open it up and let's test a real town off the eye"*. A
  throwaway restored from `snapshots/v8.8.json` with three unlinked
  plates added to `hq.atlas` beyond the plate. Works: each stands at the
  edge in its true direction as its own bone cluster at full brightness;
  two hops reach Wodonga's, the hint says "open Wodonga · 1 town beyond
  the plate"; Enter opens it — eye moves, Wodonga to the centre as an
  anchored town, walker glides, "BARWIDGEE 3" at the foot — and Enter
  again goes to its plate through the gate; the region reopens from
  there with the eye on home. What it showed is in *Open threads*.

- **Build 283 (6 Sep 2026) — the ground: the map under the region, and
  the towns on it.** Eden: *"now we need to re align and place the
  diamonds ontop of an overlay of the map of victoria using the same
  inital map system"*. The map is the town's own tracing underlay
  (src/basemap.js), live Dark tiles, wearing the region's own handles
  (`hq.basemap.region`) while the region is up. **Basemap:**
  `look(lat, lon, z, k, show, fade)` lays the live tiles with that point
  at the plate's centre, at that zoom, each mercator pixel worth `k`
  world units, at opacity `fade` when given; refused with a picture
  frozen; saves nothing (the zoom changing drops the tiles, as `step`
  does). `merc` and `unmerc` are on the API. **Region:** `ground()` is
  the eye plus the zoom and `k`: `k = 360·cos(lat) / (scale·256·2^z)` —
  `hq.region`'s scale keeps its meaning, degrees of latitude per world
  unit at the eye — and `z` the smallest that puts a tile pixel on a
  CSS pixel or finer at the camera's zoom, clamped 3–19, so the map is
  never blurred and never more tiles than `lay()`'s ceiling. `toXY` and
  `toGeo` project by that mercator whenever the underlay is there (the
  flat projection stands in without it; the two agree at the centre
  and drift under a percent across the plate). `lookAt(k, show)` runs
  each frame from `overlay()`, only while `Basemap.plate()` is
  'region'; while a cluster opens it slides the map's centre from
  `trans.eye0` to the eye in mercator by the blend's eased fraction,
  so a diamond stays on its town the whole way. `enter()` keeps
  `frame.plate` and does `Basemap.mount('region').then(...)` →
  `lookAt(1, true)`, guarded on the region still being up and the
  handles still its own (a quick Esc must never have the eye written
  on a plate's record); `leave(remount)` mounts the plate's own back
  unless `go()` is on its way to another plate, whose `Atlas.go` mounts
  it — two mounts must never race for one picture — and hides the
  hint, which Interior's prompt would otherwise leave standing. `FADE
  = 0.45`: the region's map is looked at, the town's is traced over at
  a quarter. The bar on the region offers ✕ and the credit only (CSS
  on `body.region`): Find, sources, Freeze and Zoom would fight the
  region for where the map is. Verified on the throwaway: home at
  fit-all, 80 tiles at z 11 and k 0.662, Wodonga at the foot of Lake
  Hume, Wangaratta and Myrtleford on their junctions, Mildura's four on
  the Murray's bend with the border's VICTORIA / NEW SOUTH WALES running
  past; the slide to Mildura carried the map (its centre read -36.27,
  146.30 midway); Esc brought the home plate's picture back with
  `hq.basemap` byte-for-byte as it was; Enter on Wodonga from the
  region left it, mounted Wodonga's own underlay (none) and hid the
  hint; `Atlas.go('home')` restored home's. No errors. Seen and left:
  the first slide to a new eye crosses blank ground — those tiles have
  not been fetched yet and the old ones fall out of `lay()`'s range on
  the way — so the map lands a moment after the diamonds; the second
  time it is cached. Not tested: a phone (z falls to 9 there by the
  maths, 28 tiles), the M key by hand, the wallpaper.

- **Build 282 (6 Sep 2026) — lines between groups only; a cluster opens
  under the walker; the wave calmed.** Eden: *"make it so the latest
  changes of the zoomed out map makes it so when a cluster opens there
  is no lines inbetween the cluster diamonds only lines to the next
  cluster group — make it so when our sprite sits on a cluster it
  expands (we dont need to press enter to open) — and make the styling
  of the lines slightly less wavey"*. **Links:** `scene()` keeps `grp`,
  a name → cluster-name map for every cluster's members and the cluster
  itself (a town on the plate has none), and a sample link is drawn only
  when its two ends' groups differ: from a town on the plate to a
  cluster at the edge, or from one cluster to another. The towns of the
  open group have no lines between them — at home, Barwidgee and its
  neighbours; Mildura's four when Mildura is open — and since such a
  link is in neither scene it never shrinks into or grows out of a
  cluster during the blend. Link keys are lower-cased. **Opening:**
  `settle()`, at the head of `overlay()`, watches `G.moving`: on the
  frame the walker comes to rest — only then, and never while a scene
  is blending or the game is paused — it looks in a fresh `layout()`
  for a cluster within REACH of the walker's tile and, finding one,
  starts a 350 ms dwell (`DWELL`, `sat`) after which `open()` runs.
  A walker merely standing there — the spawn, a scene re-laid round it,
  the glide that ends an opening — opens nothing, so one opening cannot
  set off the next. The cluster hint reads "opening Mildura · 4 towns
  beyond the plate" with no key; Enter still opens one at once
  (`press`); `enter`/`leave` reset `sat` and `wasMoving`. **Curves:**
  `curve()`'s wave is one cycle (`wf = 1`) at 0.6 % of the run (`wa`),
  where it was one or two at 1.2 %; the second control point swings
  back the other way one time in five (was three in ten) and by 2–7 %
  (was 2–9 %). The first bend and `bow()` are untouched. Verified on a
  throwaway (port 9223, a scratch profile with Barwidgee and three real
  towns an earlier session had added — Wodonga, Ouyen, Geelong — on a
  1600 × 1000 window): at home three lines, Wangaratta to MILDURA 4,
  Myrtleford to GEELONG 6 and to Bright at the foot, none among the
  five; hop up, hop left — the walker landed on the Mildura cluster and
  it opened on its own, the four spread out with one line to BARWIDGEE
  7 and one from there to MELBOURNE 5; hop right — landed on BARWIDGEE
  7, the hint "opening Barwidgee · 7 towns beyond the plate", and home
  again with the same three lines. No errors. Not tested: WASD walking
  onto a cluster along a drawn link (there is none), the look on a
  phone. Seen and left: the scratch window had been left portrait, and
  in that shape the edge inset (`mx`/`my`/`mb` from `r = 18 / zoom`)
  eats most of the plate — everything clusters in the middle and no
  line is long enough to draw. Fine in the wide window the game is
  played in; a phone is that shape.

- **Build 281 (5 Sep 2026) — v8.9 opened.** Eden: *"now clone for
  version 8.9"* — the next version opened on the working line, the
  title and the README's name moved up to V8.9; the frozen clone comes
  with the v8.9 tag, as it did for 8.7 and 8.8.

- **Build 280 (5 Sep 2026) — tag v8.8.** Cut on Eden's word after 279:
  `snapshots/v8.8.json` beside the tag (the second Barwidgee as it
  stood), the README's history closed for v8.8, and a frozen clone at
  `~/Projects/Loci Bitmap V8.8`. The version is 274–279: the marks on
  the hub's diamonds, and the region grown up — towns sized for the
  screen, the compass in its corner, samples, links, drag, clusters at
  the edge, the arrows, bows, and a cluster that opens with a blend and
  a glide.

- **Build 279 (5 Sep 2026) — a cluster opens, with a blend and a glide;
  the links go organic; the diamonds shade.** Eden: *"when a cluster is
  opened this expands this region and then closes the previous region
  into its own cluster — add a clean smooth animation for this — as well
  as animation for our sprite moving from one section to the other —
  also the lines seem very clean and symmetrical which feels artificial
  — make the line curve shape look a little more natural and organic
  while maintaining existing style — give the diamonds a subtle
  variation in shading and colour"*. region.js is rebuilt round a
  **scene**: `layout()` from an **eye** (`view` — home's anchor until a
  cluster is opened, then the group's mean geo; `hq.region`'s own
  centre is untouched, and `toXY`/`toGeo` read the eye) → `scene()`, a
  keyed list of gems, labels and links → `emit()`. `open(cl)` (on
  `Region`) keeps the scene it leaves in `trans` and `overlay` blends
  it into the live one by key for 900 ms with a cubic ease (`blend`:
  positions, sizes, colours and alphas lerp; what is only on one side
  fades), and `glide(at)` stands the walker on the town's tile through
  the game's own step — `G.fx/fy` from, `G.tx/ty` to, `stepScale` 3–7
  by the distance — so the sprite travels with the spring at the end;
  `hop()` glides too. Enter on a cluster opens it (`press`, and the hint
  says "open Mildura · 4 towns beyond the plate"); the previous group
  gathers at the edge on its own as the eye moves — "BARWIDGEE 6" — and
  Enter on it is the way home. Leaving the region drops the eye, the
  transition and `stood`. **Links:** `curve()` is a cubic with two
  control points off to a side of its own (a seeded `rnd` by the pair's
  names: 5–12 % of the run, the second 2–9 % and back the other way
  three times in ten) and a slow wave of 1.2 % along it; `bow()` for a
  drawn link picks its side and a twelfth-to-a-ninth by a seed of its
  endpoints. **Diamonds:** `shade(col, name)` is ±10 % brightness and up
  to 18 % toward warm or cool, and `gem()` adds a lit facet up-left at
  half the size. Clusters landing under the keys panel (the foot of the
  right-hand third) are lifted clear. Verified on Eden's window: hop up,
  hop left, Enter — Mildura's four spread out with the walker gliding
  to Mildura, Melbourne's cluster south-east, Barwidgee's six at the
  edge; hop right, Enter — home again, "back to Barwidgee". No errors.
  Not tested: a real town off the eye (only samples were), a drawn
  link's bow, the blend's look on a phone. Seen and left: for a second
  or two after the region opens the compass stands off its corner —
  `corner()` reads the cuts on hand, which are still the town's turned
  ones until the 0° cuts arrive — and settles when they do.
  `Region.scene()` is exposed for tests.

- **Build 278 (5 Sep 2026) — every link bows; the arrows hop between
  towns.** Eden: *"give all lines in between towns a slight curve and
  also allow navigation within each town using the arrow keys"*.
  `Region.bow(A, B)` is the one rule — the midpoint moved a twelfth of
  the run to the side clockwise of it — and `line()` draws a sample's
  link as a quadratic along it; `bowLink(s)` in build.js's `changed()`
  gives every straight segment of a drawn link (`ctrl` null) that
  bend, and leaves a bend that has been set. **Arrows:** a capture-phase
  keydown in region.js (`wireKeys`, like build mode's) takes the four
  arrows on the region outside build mode; `hop(dx, dy)` — exported —
  picks the nearest of `places()` (the real towns on the plate, the
  samples, the clusters) within sixty degrees of the arrow and beyond
  REACH of where the walker stands, stands the walker on its tile,
  drops `G.hold` so the camera follows, and remembers a sample or a
  cluster in `stood` so `prompt()` can say "Beechworth · a sample, not
  a town yet" or "Mildura · 4 towns beyond the plate" with nothing to
  press. WASD still walks the links. Verified on Eden's window with
  direct hops: up Beechworth, left Mildura, down Wangaratta, right
  Beechworth, down Barwidgee, down Myrtleford, right Barwidgee — and
  the keys through the capture handler. Two slips on the way, both
  fixed before the commit: the export patch had landed `bow` on
  `layout()`'s return rather than the API, and a hop from a cluster
  found the cluster itself nearest because the walker's tile centre is
  a few units off its point (the REACH exclusion). Not tested: a drawn
  link's bow (needs a link laid on the region); a hop on a phone.

- **Build 277 (5 Sep 2026) — the region's links drawn thin, the region
  dragged, and what is off the map gathered at the edge.** Eden: *"a
  simple clean minimal thin white line with very subtle gradient that
  links the connections between the towns … make it so we can drag the
  zoomed out map … a way we can still see towns that are off the map —
  maybe make the diamonds lock together in a clean geometric shape with
  gap in between that shows groups of towns linked together (Melbourne
  and a few suburbs, or Mildura and regional towns in the Mallee)"*.
  **Links:** the `link` kind's gen (kinds.js) is a thin run in bone,
  size 0.6, alpha 0.32 at the middle rising to 0.72 at either town by
  `u` against the link's own length — it was a kerb-grey band with cells
  dropped — and `line()` in region.js draws a sample's link the same way
  in the entity stream, trimmed a diamond and a half short of each town.
  **Drag:** `G.hold` (game.js) is a camera target a drag on the region
  writes (`wireDrag` in region.js, bubble phase on the canvas, not in
  build mode, the HUD's presses already stopped); the frame takes it
  over following the walker; a step clears it, so WASD brings the camera
  back, and `Region.leave` clears it. At the working zoom the plate
  fills the window and there is nothing to pan to — the drag matters
  once zoomed in with `+`. **Off the map:** `layout()` places every
  town: inside an inset (three radii at the sides, three and a half at
  the top, seven at the foot for the chrome) it stands where it falls;
  beyond it, `edge()` puts it at the inset's edge on the ray from the
  plate's middle, and towns are gathered by group (a sample's `group`;
  a real town its own) with groups whose edge places fall within six
  radii merged, into a cluster: a diamond of small diamonds (`CELLS`,
  thirteen places in taxicab order, pitch 2.3 of a 0.55 r diamond), its
  name and the count of towns beneath — above, at the foot of the plate
  — and a cluster that would land in the compass's corner moved along
  the edge it came to. Links to an off-map town go to its cluster. The
  samples gain Melbourne with four suburbs and Mildura with three Mallee
  towns, and `DEMO_LINKS`. The marker sheet has no '+', so the count is
  the number of towns. Verified on Eden's window: the lines between
  the neighbours, MILDURA 4 top-left beside the compass, MELBOURNE 5
  above the meters, the Wangaratta and Myrtleford links running to
  them; a drag at 2× carried the camera and held it, at 1× it had
  nowhere to go.

- **Build 276 (5 Sep 2026) — the compass in the region's corner, and
  sample towns.** Eden: *"move the compass to the very top left of the
  zoomed out town view — add some placeholder towns so we can test this
  and view what it will look like when working"*. `Compass.where()`
  answers `corner()` while `Region.on()`: the largest cut's half-size
  plus two tiles in from either edge, so the whole rose stands in the
  corner and no spike runs off the top, wherever it was put on the town;
  it is not draggable there (`may()`). `DEMO` in region.js is five real
  neighbours of Barwidgee — Myrtleford, Yackandandah, Beechworth,
  Bright, Wangaratta — drawn dim with their names by the same radius
  and label as a town, no halo, skipped when a real town of that name
  stands, kept on the plate, and nothing the walker can reach or enter;
  `hq.region.demo` = '0' hides them, and the **Samples** chip beside
  Region and Country in the Tune panel toggles that. Verified on Eden's
  window at home zoom and fit-all: the rose whole in the corner, the
  five dim towns spread round Barwidgee, Bright under the keys panel at
  the bottom right, Enter's hint still "back to Barwidgee". The stored
  compass `at` read (132, 131) afterwards — Eden had moved it there;
  the corner does not write it.

- **Build 275 (5 Sep 2026) — the region's towns sized for the screen,
  and the home town named by its title.** Eden: *"review the zoomed out
  map when we check towns view as the icons and text was too small"*. A
  town's diamond was `max(0.42 tile, 7 px)` — 14 units across — and its
  name half that tall, 3.5 px at the working zoom. `radius()` in
  region.js is `max(1.4 tiles, 18 px)` now, the name's glyph half-size
  `max(0.4 r, 7 px)` (a 14 px name), a town's plates spaced 2.3 r so a
  grown town's two never touch, and the hit box reads the same radius.
  The name is centred on its glyphs' centres, half a glyph right of
  where the full width had put it; the letter a lettered plate carries
  is centred on its diamond. And the home town is named by `hq.town`
  when the town has a title — the atlas area stays 'Home', which is what
  stood under Barwidgee's diamond. Verified on Eden's window: a 36 px
  diamond and BARWIDGEE beneath it, the same at home zoom and fit-all;
  Enter's hint reads "back to Barwidgee".

- **Build 274 (5 Sep 2026) — marks on the three diamonds at rest; v8.8
  opened.** Eden: *"place icons on our bottom left diamonds"*. Three
  7 × 7 grids in hud.js beside HOUSE and ROSE — `MORE` (three dots) on
  the hub, `LINES` (writing) on the journal, `MALLET` on build — drawn
  by the rings' own `stamp` in the ground's colour over each field, a
  little fatter than a letter's diamond (`fat` 1.05) so each covers the
  field dot under it; on the build diamond while building is on the
  field is only its rim, so the mallet goes down in bone. `cost()`
  counts them. The name moves up to V8.8 with the first change of the
  version, as the rule from 271 has it. Found on the way: the HUD's
  fields took the plate's pitch AS ZOOMED, so past the working zoom a
  diamond was five big dots and no mark could be cut in it; `pitchOf`
  now holds the pitch at the working zoom's (STYLE.md: chrome takes the
  plate's cell at the zoom the town is read at), worked out from
  `VW/G.W` and `VH/G.H` — not from `home()`, which inside hud.js is the
  HUD's own ring and flew the camera to the whole town every frame for
  the minute that mistake was live. Verified on Eden's window at home,
  3× and fit-all: the same three diamonds and marks at each.


- **Build 273 (5 Sep 2026) — tag v8.7.** Cut on Eden's word after 272:
  `snapshots/v8.7.json` beside the tag (the second Barwidgee as it
  stood), the README's history closed for v8.7, and a frozen clone at
  `~/Projects/Loci Bitmap V8.7`. The version is 271–272: the name
  moving up as a version opens, and the restamp cached per shape.

- **Build 272 (5 Sep 2026) — the walk grid restamps in a millisecond;
  a blank plate is not re-read for a tone.** Eden: *"the interface feels
  laggy and slow — please run and test yourself to see where we can
  improve user experience, increase smoothness and frame rate"*.
  **Measured on Eden's window** (1280 × 726, DPR 1, a virtualised GL
  device — `ANGLE (Mesa, virgl …)` — on a 75 Hz display): idle at the
  working zoom the frame is one vsync, 13–15 ms, build mode on or off,
  fit-all or 3×, tune panel up or down, and hiding the grass (12 000
  instances) or the picture changed nothing — the GPU is not the cost.
  One earlier sample read 44 ms a frame for two minutes and never
  again; unexplained, likely something else on the box. The JS inside a
  frame was 0.6 ms with build mode off and 4.7 ms on. The lag is in the
  edits: `restampTerrain()` cost **62–72 ms** and runs on every arrow
  press, every changed(), every slider — `Build.stamp` asked every
  shape for its tiles every time, the whole box of every shape tile by
  tile (`tiles()` → `Kinds.geo.depth`, 77 % of the restamp's time), a
  long road's box being most of the plate and its test a distance to
  every segment; and `stranded()` ran that same scan for every road on
  every frame of build mode. The tune's sliders cost **42–116 ms** each
  in `analyse()`, re-reading a plate that is never drawn.

  Done: `tileList(s, t, tol)` in build.js keeps a shape's tile indices
  on it (`_tiles`) under `tileKey` — type, x, y, w, h, rot, width, r,
  mult, pts, ctrl, blob, tol — and both `stamp` and `stranded` read it;
  the demolished test stays outside the cache, since it is about the
  clearing and not the shape. `queueRebuild` skips `analyse()` while
  the plate is blank unless Detail (`T.cols`, the pitch) has changed
  (`ANALYSED_COLS` in game.js). **Verified** on a throwaway restored
  from v8.6: the walk grid's checksum after a restamp is identical to
  build 271's on the same town (660191511; 5 811 walk, 164 path);
  restamp 90 ms cold (every cache empty) then 0.1–0.8 ms, 0.2 ms after
  a house is moved; Tone moved → no analyse; Detail changed → one.
  **Confirmed on Eden's window** after the reload: the same checksum,
  restamp 0.2–0.4 ms warm, the JS inside a build-mode frame 0.9 ms
  (from 4.7), the frame 13–15 ms. What is left to feel: the first
  restamp after a load is the cold one (~90 ms, every cache empty), and
  the virtual GL device sets the floor at one vsync of a 75 Hz display.

- **Build 271 (5 Sep 2026) — v8.7 opened.** Eden: *"now clone for
  version 8.7"*. Read as opening the next version on the working line:
  the title and the README's name say V8.7 from here, with a history
  line marking it in progress. No clone folder yet — the `~/Projects/Loci
  Bitmap V*` folders are frozen copies made AT a tag, and a working
  clone is how v7.0's work went astray (a stale clone launched, its
  commits cherry-picked back). The v8.7 clone comes with the v8.7 tag.
  If Eden meant a separate working folder, that is a different thing
  and a decision to make on purpose.

- **Build 270 (5 Sep 2026) — tag v8.6.** Cut on Eden's word after 269:
  `snapshots/v8.6.json` beside the tag (the second Barwidgee as it
  stood that evening), the title and the README's name moved up to
  V8.6, the README's history given v8.6, and a frozen clone at
  `~/Projects/Loci Bitmap V8.6`. Builds 267–269 are the version: the
  arrows in build mode, the builder pinning the picture, and the
  clearings and the boundary on layers of their own.

- **Build 269 (5 Sep 2026) — clearings and the boundary on layers of
  their own.** Eden: *"when I click asset then place within the boundary
  it selects the boundary instead — make it so the boundary is its own
  layer and can't be clicked unless we are within that section, same as
  other categories — we cannot move a structure unless the category is
  highlighted — also have a category for clearings (demolished) so we
  can move the backdrop without the structure layer getting in the
  way"*. `Kinds.layers` gains `clearings` (Demolish, Clear — Clear had
  been on Structures) and `boundary` (Boundary), the Modify row is gone
  from the palette and its two lines of guidance sit under the chips of
  those layers (`LAYER_NOTE`), and `editable()` no longer lets a
  modifier through from every layer: only the active layer takes the
  pointer, for everything. Backdrop keeps the layer it had. The layer
  order in the palette is Roads · Ground · Water · Trees · Terrain ·
  Structures · Clearings · Backdrop · Boundary; `z` on the two new rows
  is nothing to a modifier and only places the rows. A town written
  before this needs no migration — `layerOf` reads the kind. Hiding a
  layer with its dot drops its shapes from the rebuild as it always did,
  which for Clearings means the ground comes back while it is hidden.
  Verified on a throwaway restored from v8.5: on Structures a click
  inside the boundary and a click on the clearing select nothing, and
  an armed Trees chip placed a tree inside the boundary; on Clearings
  the clearing selects and the arrows nudge it; on Boundary the boundary
  selects. `Found.generate` lays the same shapes and they land on their
  layers by kind.

- **Build 268 (5 Sep 2026) — the builder pins the picture.** Eden:
  *"having issues placing the assets down — clicking on an asset then
  clicking on screen nothing happens"*. The cause was the one 267 had
  found and left: the plate's picture was still *placing*, and
  `wirePlace` takes every pointer press in the capture phase while it
  is, so an armed chip's click never reached `Build.wire()`. The state
  is saved (`st.placing`) and survives a reload, and a restored snapshot
  comes up in it. `Build.setOn(true)` now calls `Basemap.setPlacing(false)`
  if the picture is in hand: the builder is about the plate, and the map
  dialog's Pin still unpins for a move while the builder is closed.
  Verified on a throwaway restored from v8.5: placing on arrival, B
  pinned it, the Trees chip armed and a click on the plate placed a
  tree and selected it. Eden's live window was refreshed and opened in
  build mode, pinned.

- **Build 267 (5 Sep 2026) — the arrows nudge and size the selection in
  build mode.** Eden: *"in build mode I can use the arrow keys to move
  assets around — if holding shift it increases the size (shift up down
  makes it taller/shorter, shift left right makes it wider/narrower)"*.
  A capture-phase keydown in `Build.wire()` (the walk's own listener was
  registered first, at load, so bubbling would have walked first) takes
  the four arrows when build mode is on and something is selected, and
  stops them there: `nudge()` moves by the shape's quantum (`quant()` —
  a cell for a fine shape, a tile for the rest, what a drag snaps to)
  through `moveBy` + `changed`; `grow()` with Shift steps `w`/`h` by
  that quantum (a warp's blob scaled with it, as `scaleSel` does), a
  print's `mult` by a half (any arrow — a print keeps its proportions),
  a line's or ring's width by a cell. A selected marker moves a tile via
  `Markers.moveTo`. Pages that own the screen (bag, journal, missions,
  towns, locus, the focus column, the minimal view) are left alone, so
  are Ctrl/Alt/Meta chords. `Build.selected()` is exposed for tests.
  The pause screen's key list and the README carry the keys. Verified
  on a throwaway with the v8.5 town: house →,↓,↓ moved (613,360) →
  (626,385) with the walker still; Shift+→ took its multiple 1 → 1.5 and
  Shift+↓ back; the clearing's Shift+↑×3 / Shift+←×2 went 59.8 × 59.8 →
  53.5 × 69.2 and ←,←,↑ moved it two cells and one; the marker moved a
  tile.

  **Found on the way, not changed:** a restored snapshot comes up with
  the picture still *placing* (`adopt()` sets it, `st.placing` saves it),
  and while it is, the picture's layer takes every pointer press — so
  nothing on the plate can be selected until Pin is pressed. Eden's live
  window was in that state too (`body.placing`), which may be why the
  arrows were asked for. A plate in build mode with its picture in hand
  is worth a decision: pin it on entering build mode, or say so.

- **Build 266 (5 Sep 2026) — tag v8.5.** Cut on Eden's word straight
  after 265: `snapshots/v8.5.json` beside the tag (the second Barwidgee,
  founded on the profile wiped that afternoon, the compass on the code's
  defaults and set where Eden had it), the title and the README's name
  moved up to V8.5, the README's history given v8.5, and a frozen clone
  at `~/Projects/Loci Bitmap V8.5`. The one build in the version is 265,
  the compass tune as default.

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
the session waited for it. Tag **v8.8** (5 Sep, build 280) is the last
tag, with `snapshots/v8.8.json` beside it and a frozen clone at
`~/Projects/Loci Bitmap V8.8`. v8.7 (5 Sep, build 273) is the one
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
(`G.fitAll` the whole plate, `G.fitW` the reset). Until build 313 the game
paused on blur, so a page driven from a terminal was usually paused; now it
is not, and only `Esc` with nothing to go back from pauses it — come out of
that through `togglePause()`, which hides `#pause` as well; clearing
`G.paused` by hand restarts the frame loop and leaves the pause card over
the whole viewport and in the shot. On the desktop plate neither blur nor `Esc` pauses, so a wallpaper
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

- **Two lines touched the region on 6 Sep 2026.** The worktree
  `.claude/worktrees/region-cluster-lines` (branch
  `worktree-region-cluster-lines`, pushed) carried 282–283; `work` was
  fast-forwarded onto it at 284 with the builder's region work re-laid
  on top. If the worktree goes on, its next commit lands on a `work`
  that has moved: merge it, do not fast-forward, and expect region.js
  to need a hand.

- **The region's edges, seen with real towns off the eye (6 Sep 2026).**
  Left standing after the test: (1) two clusters lifted out of the
  compass corner land on the same spot — Ouyen and Mildura both at
  x 53 / y 291 from Wodonga's eye, because the corner-clearing runs
  after the merge pass; (2) a cluster at the top centre sits under the
  region banner (Wodonga's diamond, only its tip showing), and a click
  there lands on the banner, not the plate; (3) a real town that merges
  with a sample group names the cluster — "GEELONG 6" over five of
  Melbourne — because real towns are listed first; (4) the town you
  stand in, when off the eye, is a plain cluster with no flare, and its
  hint says "opening", not "back"; (5) a side-edge label clips ("OUYEN");
  (6) a lone group member at the edge wears the group's name
  ("MELBOURNE" for St Kilda alone). All Eden's calls.

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
- **Remote sync, answered at 297 as a sealed file in Google Drive**
  (Save and Load, pressed — not a sync). Still open: saving on a timer,
  and the desk launcher, which runs from `file://` and cannot link Drive
  (serve the folder on localhost, or play from the web link). The
  earlier idea of a server (Supabase) is not needed for one player.
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
