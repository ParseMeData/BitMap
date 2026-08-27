# Work queue

Claude works these top to bottom, one at a time. An item is picked up only
when the previous one is finished and ticked. Edit, reorder, or add freely —
the file is re-read before every item.

**Working rules (learned 2026-08-25):** snapshot the town with
`tools/snapshot.py save <file>` before any live test; verify in the running
game over CDP (`tools/cdp.py`, `Page.captureScreenshot`) and revert test
shapes — shapes with ids you did not create are Eden's, leave them; there is
no git identity on this box, commit with `GIT_AUTHOR_NAME=Eden
GIT_AUTHOR_EMAIL=eden@customer.mlbeaus1.isp.starlink.com` (and COMMITTER)
as env vars; bump `BUILD` in `index.html` on every change so the cache-bust
reloads; keep README/HANDOFF current in the project's voice.

**Mode: stop between items.** After finishing an item, tick it, summarise what
changed, and wait for review before starting the next. Items marked `[auto]`
may run straight into the next without waiting.

## Queue

- [ ] `[auto]` **The towns map is Australia** — `~/Projects/loci-australia`
  brought across: `assets/australia.js` (generated, loaded on first open,
  not at boot), `src/country.js` (the decoder, was its `atlas.js`), a new
  `src/towns.js` behind `Hud.onTowns` in place of the chip grid: the country
  cut to state › region › district, typeset in diamonds, every placed plate a
  dot with its name, click a dot to stand on it, click land to drill, Esc up
  and out, a button to pin the plate you are on.
- [ ] `[auto]` **The roads between plates, on the map** — every link in
  `hq.atlas` drawn as an aqua line between the two plates' dots, so the map
  shows both where a town is and how it joins; the direction-graph chips
  stay beneath the list for plates with no anchor.

## Done

(ticked items move here with the date)

- [x] **A plate knows where it is** — 2026-08-27. `geo: {lat, lon}` on
  `hq.atlas.areas[id]`, optional. `Atlas.seed()` at init takes the home
  anchor from `Basemap.at()` once; `add()` steps the neighbour's anchor
  `STEP = 0.0125°` the way the road went; `Atlas.geo(id)` / `setGeo(id,
  lat, lon)` (null clears); `layout` exports the chip-grid placement for
  the towns map. BUILD 123. Verified on a throwaway: seeded −36.56/146.72
  from a written `hq.basemap`, pinned by hand, a plate opened north landed
  at −36.4875.
- [x] **The compass** — 2026-08-26. `assets/compass.png` (Eden's
  map-pointer) → `tools/compass.py` cuts rose + N/E/S/W (white keyed to
  alpha, halved) → `src/compass-art.js`. `src/compass.js`: `#compass`
  top-left, rose rotates by `Basemap.rot()` (new seam) or by drag
  (`hq.compass` {manual,deg}, flare while manual, dblclick follows the
  map again); letters placed at the turned points each change, upright;
  hidden under wall/bag/journal/locus/missions/mapping. BUILD 118.
  Verified on a throwaway: 0° and 40°, set/follow, hidden under the bag.
- [x] **A bone diamond for build** — 2026-08-26. Third diamond at `BX =
  JX*2`, bone, drawn hollow (the ◇ face) while `Build.active()`; `pick`
  answers 'build', `Hud.onBuild` seam → `Build.setOn(!Build.active())` in
  game.js; cost +1. BUILD 114. Verified on a throwaway: hit test, press
  turns build on, palette rises.
- [x] **The journal, behind an aqua diamond** — 2026-08-26. `src/journal.js`
  (page `#journal`, `body.journal` clears the chrome, `SECTIONS` frame,
  notes in `hq.journal`, stored on change). `hud.js`: a second hub
  diamond at `JX = HUB*2+12` to the right, AQUA, only while the four are
  folded; `pick` answers 'journal'; `Hud.onJournal` seam; cost +1.
  `game.js`: gate (Esc closes, ← → tabs unless typing) and the seam.
  BUILD 112. Verified on a throwaway: hit test, press opens, note kept,
  → changes tab, Esc closes.
- [x] **A card's hand of pictures, and the still** — 2026-08-26. `Title.
  picture(url, cols, tune)` takes the tool's knobs (`PICTUNE`: bri, con,
  inv on the pixels, edge, cols, ink, weight). `bag.js`: `hand()`/
  `setHand()` over `hq.bagpics`, alternates at `<key>:alt:<n>` via
  `Loci.attach`, `adoptHand` folds a pre-hand picture into alt 0;
  `still` panel (`#bagstill`) opens from a face card: cycle, sliders,
  ink chips, Add / Drop / Keep; ←→ Enter Esc routed through `Bag.move/
  enter/back` while it is up. Keep copies the alt to the card's key and
  stores the tune; the card canvas cache drops. BUILD 109. Verified on a
  throwaway: adopt, drop a second picture, cycle, invert+80 cells, Enter
  keeps, survives reload; Esc closes.
- [x] **A card's picture through the tone pass** — 2026-08-26. `Title.
  picture(url, cols)` → `Lattice.analyse`/`compose` with the locus
  preview's tune (`PIC`), dense face decoded from the compose buffer
  (alpha@10, signed size@11, rgb@2..4) into cells; `Title.paint(canvas,
  face)` draws rhombi (stroked for the ◇ face) at the plate's ¾ cell.
  `bag.js`: a `.face` stack card gets a `.bagpic` canvas (2×, 5:7) under
  the frame, cached per key in `pics`, dropped on `attach`. Face cards are
  dark ground with dim ink so the frame reads. BUILD 108. Verified on a
  throwaway with two pictures seeded under bag keys via the snapshot
  tool's WRITE_LOCI (its full `restore` dies on a fresh profile at the
  `hq.basemap` store — pre-existing, noted below).
- [ ] **`snapshot.py restore` on a fresh profile**: `WRITE_PIC` opens
  `hq.basemap` at version 1 and the fresh profile's DB lacks the `pic`
  store → "One of the specified object stores was not found". Bump the
  open to the app's version or create the store on upgrade regardless.
- [x] **Size is cells per letter; the pitch never moves** — 2026-08-26.
  The pitch multiplier (`size` tune) is gone — it shrank the diamonds with
  the name, and the diamond is the thing that must not change. `detail`
  (4–30, default 14) is the one control, labelled **Size** in the palette;
  `px = G.A.cell` always. BUILD 96. Verified on a throwaway at 7 / 14 /
  24 cells per letter: name grows, diamonds identical.
- [x] **A title diamond is a plate diamond, and a mat under the name** —
  2026-08-26. `Title.emit` half-size is `px × 0.75` (the shader's own
  lattice size) × weight; weight rests at 1, tone at 0. `Title.mat`: a
  field of ground-coloured (#08080B) diamonds spaced 3 cells at half-size
  3 cells — a square grid at spacing = half-size covers the plane exactly
  twice, so one alpha per diamond gives an even cover of 1−(1−a)² — over
  the face's box plus a 3-cell margin that fades; first thing dropped
  when the cap is short. `mat` in `Title.tune` (0–1, .7), **Mat** slider
  under Heading. A font title lies bright over its mat (.88 town / .92
  palace; the 5×7 keeps .38/.66). BUILD 95. Measured on a throwaway:
  grass under the name 61 → 37 mean brightness with the mat.
- [x] **Card halftone settled, strip removed** — 2026-08-26. Eden's values
  (letters 21 cells, digits 34, weight .65, tone 0, dither 0, bright −48,
  contrast 108, sharpen 3, gamma 1) folded into `glyph()` in `bag.js`;
  panel, CSS and `hq.bagtune` gone (the key is removed on next load).
- [x] **The bag's labels in the heading's face** — 2026-08-26. Row cards
  draw their number/letter via `Title.face` (a `cols` override for a
  one-glyph face) as `Title.svg` — rhombi grouped by alpha into a few
  paths, `currentColor`, viewBox-sized — under `.bagcard.glyph`; the text
  tag stays hidden beneath for the moment before the font lands (`Title.
  load` re-renders the row). Stack cards keep the corner tag. BUILD 86.
  Verified on a throwaway: 5 glyph cards on both systems, Fleur De Leah.
- [x] **Titles in a real font, the whole arc** — 2026-08-26, seven
  commits `ecd5dbc`…`ce163f2`, cherry-picked from the `Loci Bitmap V7.0`
  clone (which had been cloned at v7.0 and diverged; only BUILD collided,
  stepped 78→84; tag `font-work` marks the source head). New
  `src/title.js`: the wallpaper tool's lattice-type recipe — Google Font →
  3× raster → bri/con/sharpen → per-cell ink → one diamond per lit cell
  via `put`. `hq.title.font` beside the rest of the heading dress
  (`none` = diamond type on purpose, absent = default Fleur De Leah);
  `#kfont` is a menu under the name in the top-right panel, whose head now
  reads **Town** / **Palace**; shelf `FONTS` at the foot of `title.js`
  (incl. Roboto Slab). `Type.border`/`borderCost`/`lift`/`liftA`/`seed`
  exported so a font title wears the same border, bright and shake.
  Five sliders under Heading, live only with a font in force: Size (pitch
  as × of the plate's cell, 1 = the map's grain), Detail (cells/letter),
  Weight (rests 1.2× — closes the corner-holes that read as grid lines
  through a stroke), Tone, Dither; stored `hq.title.<name>`. Palace title
  block keeps a floor of clearance above the room captions. README
  `### A title in a font`, HANDOFF decision + storage rows, STYLE atom
  paragraph.
- [x] **River and creek: drag the ends** — 2026-08-26, `454c1f5`. `anchored`
  dropped from the creek kind in `src/kinds.js`; the ends are grips like
  any bend. The lock stays in build.js for any kind that wants it.
- [x] **Water above every ground terrain, under roads** — 2026-08-26,
  `454c1f5`. A `water` layer at z 0.5 between ground and trees; water and
  creek moved onto it. Shipped in BUILD 73, live through 77 without error.

- [x] **Save a whole stack as a mission** — 2026-08-26. New `src/missions.js`
  page over the bag: `save` (whole stacks only) moves the cards out as a
  mission with purpose chips, title, palace (a marker), notes, added /
  runs / last run; `run` counts and deals it back into the bag; `delete`
  asks twice; `saved` opens the page; Esc back. `hq.missions`. BUILD 77.
  Verified over CDP end to end.

- [x] **The stack is a dealt sequence** — 2026-08-26. `src/bag.js`: the
  stack is `hq.bagseq`, a list of {sys,i}; each row press appends that
  number's card at slot k%3 (person, action, object), from either system;
  a gap every three; undo/Backspace and clear; holds until cleared.
  `hq.bagsel` is migrated once. Cycle keys (`…:action2`) are no longer
  written. BUILD 76. Verified over CDP: 1 5 B 3, undo, backspace, clear,
  persistence across reload.

- [x] **HUD folds into the hub** — 2026-08-26. At rest only the flare hub
  shows; pressing it hides the hub and brings the four out at SPAN 30; a
  press on one of them, or anywhere else (plate or panel), closes them and
  is swallowed. BUILD 75. Verified over CDP: closed → open → click-away →
  closed, and hub → home → 'the whole town' → closed.

- [x] **HUD rings → filled halftone diamonds** — 2026-08-26. `src/hud.js`: the four
  buttons are diamonds of dots on a 3.2px grid (|i|+|j| ≤ 7), ground dots
  shrinking from full at the centre to .42 at the edge; the rim is the grid's
  outermost step. `pick()` is taxicab. `cost()` still exact (813). BUILD 74.
  Verified over CDP: rest, hover wash, press → 'the whole town'.

- [x] **The bag, part 10: the stack stays** — 2026-08-25, `4eca984`. `held`
  {sys,i} replaces `sel` as the stack's owner, saved in `hq.bagsel`;
  `sel()` derives the row's inverted card from it. Rows/slider/switch/
  close no longer clear it; Esc no longer folds; Enter or click on the
  held card folds. Verified over CDP incl. a page reload.
- [x] **The bag, part 9: the keyboard reaches the switch** — 2026-08-25,
  `3d1302a`. `zone` 'row'|'switch': ↑ at row 1 → switch (`.bagswitch.cur`
  bone edge, row highlight off); ←/→/Enter there → `open(other)` keeping
  the zone; ↓ or Esc → row. Verified over CDP.
- [x] **The bag, part 8: the switch on the left, the stack on the right**
  — 2026-08-25, `9a46966`. `.bagswitch` (row of two chips) atop the left rail
  above the slider; right rail 190px holds `#bagstack`: flow column with
  `margin-top: 32px − cardH` between cards, hover/focus-within raises;
  tags always in the corner ("person · 2"). `keyAt(sys,i,k)` → slot k%3,
  cycle k/3; first cycle keys unchanged, then `character2`… `stack()`
  shows card k if k−1 is filled. Row cards no longer unfold. Verified over
  CDP: 5 test words on 2 → six cards person…object twice, all 121×170,
  tops 32px apart; test words removed, Eden's words for 1 intact.
- [x] **The bag, part 7: ←/→ and Enter** — 2026-08-25, `47dfd48`. `cur`
  0..4 in the row, `.bagcol.cur` bone edge; `Bag.move(±1)` clamps to the
  row, `Bag.enter()` toggles select; click sets `cur` too; ↑↓/slider/
  switch reset it to 0. game.js gate routes ←→ Enter. Verified over CDP.
- [x] **The bag, part 6: the slider steps by arrow** — 2026-08-25,
  `0486a92`. `.bagstep` chips (▲ above, ▼ below the track) and `Bag.step(±1)`;
  game.js keydown gate answers ArrowUp/ArrowDown while the bag is up.
  Verified over CDP: 5×↓ → 6 (row 6–10), ↑ → 5, buttons step, floor 1.
  *Follow-up* `0a1b4b7`: a press moves a **row** (5), landing on its first —
  1 → 6 → 11; cap lands on 96 / Z.
- [x] **The bag, part 5: one card size, and a slider down the left** —
  2026-08-25, `cb921c4`. `.bagcard` height `(100vh − 176px)/3 − 10px` for
  every card, width from 5:7 (121×170 here, open or closed, overflow 0).
  `#bagslide` in the left rail: drawn track + flare square thumb, pointer
  capture, `at` 1..cap; `first()` = row of five holding `at`; readout
  above. `dealt()` removed — slider replaces the deal (HANDOFF says why).
  Verified over CDP: drag → 41 shows 41–45, bottom → 100 / Z. Eden's words
  for 1 intact.
- [x] **The bag, part 4: rails either side, and a system toggle** —
  2026-08-25, `40c4338`. `#bagmid` grid `150px | 1fr | 150px`; `#bagleft`
  empty (reserved), `#bagright` holds `.bagswitch` (two `.chip`s, 123 /
  abc, `.sel` on the one up; `open()` is a no-op on the side already up).
  `.bagcard` max-width 150px; open column `width:auto` from height so
  5:7 holds. Measured over CDP: 0.714 open and closed, overflow 0. Eden's
  own words for `1` (Han Solo / Shooting) seen in `hq.bag` and left alone.
- [x] **The bag, part 3: words, one card at a time, all three on screen**
  — 2026-08-25, `e902e3c`. `.bagword` input on every open card (placeholders
  who / does what / to what; Enter blurs; `change` re-renders so the next
  card appears when the word is done, not per keystroke); words in
  `hq.bag` {key: text}, `Bag.word/setWord/filled`. `filled` = picture or
  word, used for the reveal, `done`, and the deal. Open column: character
  → action once filled → object once filled. `.bagcol.sel .bagcard` drops
  its aspect for `(100vh − 176px)/3 − 10px`; measured over CDP: last card
  bottom 593 in a row ending 654, overflow 0. README/HANDOFF updated.
- [x] **Document the bag** — 2026-08-25, `f3821be`. README `### The bag`
  (before *Walking*), `src/bag.js` file-table row, Esc row; HANDOFF
  decision *The bag is one page, and its pictures live with the loci* +
  storage-table note on the `bag:` keys; `hud.js` header and seam
  comments say what fills `onLetters`/`onNumbers`/`onTowns`. BUILD 62.
- [x] **The bag, part 2: character · action · object, and the next five**
  — 2026-08-25, `6df4987`. The row card is the character; `.bagcol.sel`
  unfolds action and object beneath. Click a card in an open column (or
  drop a file on it) → `#lfile`, shared with the loci, each side with its
  own `pending`. Pictures go through `Loci.attach({uid})` into
  `hq.loci/img` as `bag:<system>:<label>:<slot>` — snapshot.py dumps
  that store key for key, so nothing to change there (its "locus pictures"
  count now includes bag cards). `Loci.get` exported. `dealt()`: 5, +5
  per full set of five complete from the start (numbers cap 100, letters
  26); done columns show their label in bone; head counts `n of dealt×3`.
  Esc → `Bag.back()`: fold, then close. Verified live over CDP with 15
  canvas pictures (faces, 10 dealt, 5 done), then detached — store clean.
- [x] **The bag, part 1: the page and its five cards** — 2026-08-25,
  `86e5451`. New `src/bag.js`: `Bag.open('numbers'|'letters')`, one page,
  `SYSTEMS` holds the two label sets; `#bag` glass page built on first
  use (atlas pattern), `body.bag` clears the chrome, `.bagcard` 5:7
  cards in a 5-column grid, `.sel` = bone inversion. `game.js` fills
  `Hud.onNumbers`/`Hud.onLetters`; keydown gate: only Esc answers
  while it is up. Labels are chrome text (mono, uppercase) — `Type`
  letterforms live in the GL stream, not in a DOM page, so that line of
  the ask was dropped. Verified live over CDP: ring press opens, card
  click inverts, Esc/✕ close, no pause, shape count unchanged. BUILD 60.
- [x] **Walkable map: reachability, add-area at road ends, compass mind map,
  static map that extends** — 2026-08-25. Investigation: the walk grid was
  not broken (every road tile reachable); the unreachable screen was roadless
  in Blank mode. Eden chose *keep connectivity, warn* → stranded roads framed
  gold + palette note. *Linked screens* → `src/atlas.js`: plates joined at
  edges, edge prompt (Enter opens a plate with a road stub, Esc stays),
  crossings land on the same column/row, compass opens the mind map, click
  to jump. Home plate keeps its keys. Verified live over CDP.
  *Follow-up:* trigger moved from the screen edge to the **end of the road**
  (dead end = ≤1 road neighbour, pressed away from it); links kept per end so
  many roads can each lead to a plate (`9ec6128` → next commit).
- [x] **Warp shape replaces Ring on the Shape row** (asked 2026-08-25, done
  same day). Closed Catmull-Rom blob: 8 points from the oval, mid-leg grips
  insert, points drag; `blob` saved. Ring kept only for road/creek.
- [x] **Click-to-place** (asked 2026-08-25): chip arms, map click places,
  Esc disarms; nothing lands at a default spot any more.
- [x] **Separate terrain options in the Ground section** — 2026-08-25. Rock,
  Cement, Dirt, Desert, Gravel, Mud, Scrub, Snow: one `terrain()` generator,
  recipes in `GROUNDS`; all walkable, stamp with grass.
- [x] **Settle whether the game window closes on its own** — 2026-08-25.
  Relaunched 13:20:44 as PID 13032 with CDP; untouched by Eden throughout,
  driven only over CDP (a dozen reloads, screenshots, synthetic input). Alive
  at 1h21 — past the 1h14 of the run that closed before — `hq.lastError`
  null, no crash/OOM in the journal. Conclusion: earlier closes were Eden's;
  no evidence the game closes itself. Exit watch left armed in case.
- [x] **River/stream laid as a locked line with bends between** — 2026-08-25.
  Creek and river are `smooth` kinds: Catmull-Rom through every point, ends
  anchored (creek now too); the mid-run grip inserts a point and drags it.
  Shift-click still works. Existing 2-point bowed creeks unchanged.
- [x] **More colour options for the building assets** — 2026-08-25. `tone`
  on every print: Stone (default, unchanged), Brick, Slate, Moss, Sand, Rose;
  Tone chip row under the picker; saved/loaded; `TONES` in kinds.js.
- [x] **Building assets: transparent outside, dark inside, padding; palette
  reorganised** — 2026-08-25. Slicer writes '2' for interior dark + 1-ring
  plinth (flood fill from the sprite edge), `landmark()` draws '2' as dark
  cover; size capped at birth (shrink allowed, cell steps); new Terrain layer
  holds Blocks/Housing (ids `buildings`/`houses` unchanged); Buildings layer
  holds Houses (new `house` kind, 31 glyphs via `--set houses=a01-a24,b11,
  b25-b28,b30,b32`) and Landmark (35). Verified live over CDP.
  *Follow-ups same day:* interior dark → plate colour (`264db5e`); then
  padding ring removed, box occlusion → per-ink occlusion via `glyphAt()`,
  and prints made fixed-size with no grips (`[`/`]`/Size row inert).
- [x] **Document the landmark kind and `tools/glyphs.py`** — 2026-08-25,
  commit `README.md`/`HANDOFF.md`: file-table rows for the two sheets,
  `src/glyphs.js`, `tools/glyphs.py`; `### Landmark` under *Building*;
  `glyphs: true` note under *Adding a kind*; two HANDOFF decisions, a
  re-slice note under *Working on it*, an open thread for the eight
  old-box landmarks.
- [x] **Split the working tree into commits** — 2026-08-25. `2287b78` "A
  boundary is a demolisher pointed outwards" (build.js/kinds.js boundary
  hunks only, incl. the Modify row, `core`, `isRadial`, plate-wide cache
  invalidation) then `64adc71` "A landmark is one named building, drawn from
  a glyph" (everything else: sheets, glyphs.py, glyphs.js, picker CSS, BUILD
  46, glyphSnap). Verified: boundary version has 0 landmark mentions, the
  landmark diff has 0 boundary lines. No git identity on this box — commits
  carry Eden's identity from history via env vars, config untouched.
  QUEUE.md left untracked.
- [x] **Resize snapping in whole glyph multiples** — 2026-08-25. New
  `glyphSnap()` in `src/build.js` beside `glyphSize()`; routed through it:
  corner/edge drag, `[`/`]` (`scaleSel`, now steps 1×→2×→3× instead of
  ×1.15), and the size field. Verified live over CDP: a01 12×14 lands on
  37.8×44.1 / 75.5×88.1 / 113.3×132.2, floors at 1×, drag holds the far edge.
  `kinds.js` untouched — its fit already resamples at whatever pitch the box
  gives. Pre-existing landmarks keep their old tile-snapped boxes until next
  resized (harmless: the glyph is fitted inside, slack draws nothing).
