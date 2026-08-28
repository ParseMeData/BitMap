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

**Mode: run through.** (Set 2026-08-27 by Eden: no confirmation between
items.) After finishing an item, tick it into Done with a line on what changed
and the BUILD, commit, and start the next at once. Only stop at the end of the
queue, or on something that would destroy the town.

## Queue

## Done

(ticked items move here with the date)

- [x] **The map bar, simplified** — 2026-08-28. Fade and Scale rest at
  their defaults and are hidden (the inputs stay for a saved setting);
  Turn is two arrows, a degree a press and fifteen with ctrl; `M` opens
  the bar without handing the search the keyboard, so the m no longer
  lands in it. BUILD 190.
- [x] **The underlay stopped clipping itself** — 2026-08-28. `#basemap`
  was a viewport-sized `overflow:hidden` box that the camera transform
  moved and scaled every frame, so the map showed only inside wherever
  that box landed — a corner, a patch, elsewhere on every wheel step. Now
  a zero-size anchor at the origin, overflow visible. Verified at ×0.6
  and ×2.6 of the working zoom: edge to edge. BUILD 189.
- [x] **Dark only, and the map fills the screen** — 2026-08-28. OSM and
  Google hidden in the bar (`.mapsrc` display none, a saved source reads
  back as Dark); the tile ceiling is the viewport's (`most` in `lay`) in
  place of a fixed 140 that stopped the sheet at a corner on a big
  screen; the bar counts tiles in as they land. Verified at 3840×2160:
  54 tiles, full cover. BUILD 188.
- [x] **Fade rests at a quarter** — 2026-08-28. The underlay's Fade default is 0.25 (was 0.85); a saved underlay keeps its own. BUILD 187.
- [x] **Dark tiles without a key** — 2026-08-28. CARTO began watermarking
  keyless tiles "API KEY REQUIRED"; the Dark source is now Esri's
  World_Dark_Gray_Base (keyless, CORS *, z/y/x), credit line and lift
  filter retuned. Verified: 54 tiles over Myrtleford, none failed, no
  watermark. BUILD 186.
- [x] **Players** — 2026-08-28. `Users` inline in index.html (`users`
  key: Eden slug '', Test User slug 'test', default 123, SHA-256 hash once
  set), a door before `start()` loads the scripts, `sessionStorage.hq.user`
  for the session; `Store` prefixes every key with the slug, `HQ_DB` names
  the stores, snapshot.js and the platformer follow. Player · Sign out /
  Password in the tune panel. Verified on a fresh profile: door, wrong pw
  refused, Eden bare keys, Test User on `test:` keys and `test:hq.loci`,
  password change holds. BUILD 185.
- [x] **The first plate is free** — 2026-08-28. `Stock.cost` answers
  nothing for road, link, marker, house, landmark, buildings and houses
  while on home (not the region); cards and repairs still pay. README
  records the plate's fixed size (60 × 57 tiles) as the limit — more room
  is an extension. BUILD 184.
- [x] **The printed sheet is never shown** — 2026-08-28. `BLANK` is
  always true, `setBlank` no longer reads or writes `hq.blank`, the Plate
  chip pair is gone from the tune panel; the art stays in assets for the
  plate's size and the grid's base. Verified: a fresh profile boots to an
  empty plate. BUILD 183.
- [x] **Plates are letters, palaces are items** — 2026-08-28.
  `Atlas.setLetter` / `areas[id].letter`, `Markers.setItem` / `m.item`,
  Letter and Item selects in the palette (`Quest.wire/sync*`), the region
  drawn in letter tones with the letter on the diamond, banners and door
  prompts carry `A · Arpeggios`. BUILD 182.
- [x] **The quest** — 2026-08-28. `src/quest.js`: target from the pick,
  `#quest` line with plates-away, gold rings on the region town and the
  marker, distractions ×2 on the way (`Quest.onWay`), `Interior.enter`
  → `Quest.arrive` rewards and puts the pick down. Verified on the rig:
  RAITS focused, home = A, palace = A · Arpeggios, quest done +5 blocks
  +1 spark; S · Modes on a second plate reads "1 plate away", onWay true.
- [x] **Rewards** — 2026-08-28. `Stock.REWARD` and `Stock.reward(name)`:
  puzzle 2 grains, drill 1 grain, run 1 block/picture, quest 5 blocks +
  1 spark; distract.js, bag.js and quest.js pay through it.
- [x] **The route is the plate's** — 2026-08-28. `Loci.route()` reads
  `Atlas.mkey(Atlas.current())`, not `hq.markers`.
- [x] **A page that installs** — 2026-08-28. `manifest.json`, viewport /
  theme-color / apple-touch-icon in the head, `sw.js` (precache 41 files,
  network-first, `ignoreSearch`, old caches dropped), registered over
  http(s) only. Verified on a local server: worker active, 41 cached,
  and the page boots with the server killed. BUILD 181.
- [x] **The town travels** — 2026-08-28. `src/snapshot.js`: `Snap.dump`
  and `Snap.load` in snapshot.py's version-3 shape; Export/Import under
  Town in the tune panel, import confirms with counts then reloads.
  Verified: v8.0.json imported over http → 39 shapes, 1 marker, 5
  interiors, 14 pictures, traced map; dump round-trips, gkey blank.
- [x] **The geocoder from a real origin** — 2026-08-28. Nominatim answers
  `access-control-allow-origin: *`; README *On the web* records what
  changes off `file://`.
- [x] **Sparks are the PAO material** — 2026-08-28. `hq.stock.sparks`
  (start 6, cap 100), `COST.card = 1 spark` paid on the first word or
  picture of a card (bag.js input handler and `attach`); `arrive()` banks
  a collected spark; the meter is the stock's, not the round's. Verified:
  6 → 5 on the first word, free after, refused at 0, +1 on collect. BUILD 180.
- [x] **The strip: sparks, grains, blocks, bottom-left** — 2026-08-28.
  Round and Steps gone from the HUD; Sparks has a meter (`#hsparksbar`,
  got/total, empty while off); the three rows stack in the bottom-left
  corner under the hub, label · bar · number. Gold / bone / flare. BUILD 179.
- [x] **Distractions** — 2026-08-27. `src/distract.js` (`hq.distract`):
  settle on a reachable road tile of the current town plate on a ~90 s
  clock (≥6 tiles off, ≤3 a plate, not while a page or build is up), cut
  the tile in `restampTerrain`, drawn as a dim core with four flare motes;
  Enter beside one → `#quiz` from deck / palace loci / saved stacks, right
  clears and restamps, wrong asks again, nothing-to-ask → repair for 3
  grains (`Stock.COST.repair`). `Distract.allow` in `Atlas.go` and
  `Region.gate` refuses a jump across a blocked plate, naming it. Also
  fixed a TDZ in stock.js that broke boot once `hq.stock` existed.
  Verified on the rig: cut → wrong → right → repaired; home→P3 refused
  across P2, allowed once cleared. BUILD 178.
- [x] **Grains and blocks** — 2026-08-27. `src/stock.js` (`hq.stock`,
  cap 100, start 20/10, `COST` per kind): two bars on the strip, `pay` at
  `Build.create` and `Markers.place`, refused with the price. The bag's
  `drill` chip: five questions from cards with words, a grain each.
  `routeDone` in the platformer adds a block per picture, raw
  localStorage, heard through the storage event. Verified: strip shows
  25/10, right answer +1, road refused at 0. BUILD 177.
- [x] **Minimal view, and the trace** — 2026-08-27. `src/trace.js` and a
  `minimal` flag in build.js: floor and fittings not drawn, fittings not
  stamped; `V` toggles inside a palace. Nine plate-tone squares as blocks
  of cells, an aqua line start → fittings (laid order) → end, gold ends;
  room 1 starts across from where it leaves; arriving within 1.2 tiles of
  the end advances `hq.trace.<uid>`. Leaving the building takes the view
  down. Verified on the rig: Barwidgee, 11 rooms, 1 → 2 on arrival. BUILD 176.
- [x] **The region plate** — 2026-08-27. `src/region.js`: a frame on
  `hq.shapes.region` with a third registry (`link` + the town's terrain),
  towns as connected runs of atlas areas drawn as one diamond per plate,
  north up (compass 0), Enter beside a town → `Atlas.go` its root, drag in
  build mode pins the whole town, `hq.region` the projection. `Atlas.go`
  pops the frame first; `Markers.place` refuses; the heading stays off.
  Verified on the rig: two-plate town, link walked, jump home restores 39
  shapes / 1 marker / heading 206°. BUILD 175.
- [x] **The country map goes behind a switch** — 2026-08-27. `TOWNS` in
  game.js (`hq.towns`, region|country), a Towns chip pair in the tune
  panel, and `openTowns()` is what the rose diamond presses: the region
  plate, the country when asked, the atlas grid as last resort. BUILD 174.

- [x] **The journal's letters in diamonds** — 2026-08-27. `.jletter`
  clipped to a diamond, rim as `::before` (bone .22) and face as `::after`
  (ground, inset 1.5px), selected = both bone; the has-note mark is a
  child `<i class="jhas">` diamond at the foot; rows gap 4px. BUILD 172.
- [x] **A gentler front, and no ghost word on ↑ ↓** — 2026-08-27. Front
  half the word wide, linear; `wordVis` records how much of the word was
  on screen and only a word that was up retreats — one hidden behind an
  item's highlight, or still waiting, no longer flashes and collapses.
  BUILD 171. Verified: word region flat across ↓ from an open row.
- [x] **The retreat fades harder and stops at the diamond** — 2026-08-27.
  Front width .18, squared, running at 1.3 from t − .08; a character slid
  back past the word's foot (ax < 0) is not drawn. BUILD 170.
- [x] **The word retreats** — 2026-08-27. On leaving a letter whose word
  was up, `leaving` {k, word, t0}; `diagonalOut()` draws it char by char
  slid back along the diagonal (outCubic × .7 of its run) with a
  transparency front sweeping first → last letter a step behind, 620 ms.
  BUILD 169.
- [x] **The acronym's letters in the chrome's mono** — 2026-08-27. Eden
  preferred the row's face: `font: true` dropped from the column's and
  the pick's letters, sizes back to .95 r / 1.15 r; the Title.face path
  stays in focus.js, unused. On this box `--mono` resolves to Noto Sans
  Mono (nothing named in the stack is installed). BUILD 167.
- [x] **The pick: bone letter, larger, a slight gradient** — 2026-08-27.
  `diamond()` takes a second colour and runs top point → foot; the pick
  goes tone+22 % bone at the top to tone+28 % dim at the foot; its letter
  bone at 1.15 r. BUILD 166.
- [x] **The closing row flashed on the next letter** — 2026-08-27. The
  row sliding back after ↓ read its letter from `lastOpen`, already the
  new one; `rowK` now remembers which letter the row was opened on (set
  on → and on unfold) and the closing row draws there. BUILD 165.
  Verified: ink beside the next letter 0 at 60/120/400 ms after ↓.
- [x] **The pick keeps its tone and the font** — 2026-08-27. The folded
  diamond stays in the item's TONE (no blend to bone) and its letter is
  stamped through the font like the acronym's, in ground or bone by
  luma; the no-origin path the same. BUILD 164.
- [x] **Only the acronym's letters in the font** — 2026-08-27. `stamp()`
  takes the font only when the text entry says so (the column's letters);
  the row's letters, the item's name and the word are mono again at
  their old sizes (`diagonal()` is mono only). BUILD 163.
- [x] **The focus types in Roboto Slab, halftoned** — 2026-08-27.
  `type()` → `Title.face(text, 'Roboto Slab', {cols[, ref]})` painted once
  at the plate's pitch (`Title.paint`, tint, weight .85 letters / .7
  words) and stamped (`stamp`, `diagonal`); `colsFor()` derives width
  from rows wanted and the text's measured proportion — a single letter
  in a box over the whole alphabet (`ref`), a word to its own ink; mono
  stands in until `Title.load` lands. The word moved out of the row block
  (it could never show once the row waited for →). BUILD 162.
- [x] **The hub's three in the plate's material** — 2026-08-27. `hud.js`
  `HUBO`: grid points |i|+|j| ≤ KH (5) at PITCH 3.2, each a diamond of
  half-size 0.75 × PITCH in the button's colour; build's rim only while
  build is on; cost 3 → 3 × 61. Gaps: letter→hub 12, hub→journal 12
  (point to point); build sits at the HUD's own half-step. BUILD 157.
- [x] **The hub joins the walk** — 2026-08-27. `Hud.press(key)` /
  `opened()` / `fold()` exported; `focus.js` `hubSel` (hub, journal,
  build; letters, numbers, home, towns while the four are out) reached by
  ↓ off the last letter, `hubKey()` moves and presses, ↑ climbs back;
  brackets drawn on the hub diamond stood on (`bracket()` helper). BUILD
  156. Verified: journal opened, four out, towns opened, build toggled.
- [x] **A rim on every diamond; one bracket at a time** — 2026-08-27.
  `diamond()` lays a ground ring 1.8 cells deep first, so an overlap
  shows its edge; the column's bracket hides while `rowOpen`. BUILD 155.
- [x] **The column dulls, not fades; the row waits for →** — 2026-08-27.
  Letter colour = bone → dim by .32 per step (cap .8), alpha 1; `rowOpen`
  set by → (cursor 0), cleared by ← past the first, ↑ ↓, Esc, a fresh
  letter; unfolding brings the row back (the pick is in it). Fixed
  `val('row')` reading 1 with no tween, which drew the row unasked.
  BUILD 154. Verified: row ink 0 → 2818 on → → 0 on ← → back on unfold.
- [x] **The column makes room for the open letter** — 2026-08-27.
  `layout()` gaps by distance from the open letter (2.2 GAP beside it,
  −.1 size, then −.32 size), alpha 1 − .3 per step (floor .28), the foot
  fixed; `cur` eases y/alpha by .16 a frame; draw order outermost first;
  brackets on the open letter. BUILD 152. Verified: A open, then T.
- [x] **Harder fall-off, and a bracket on the lead** — 2026-08-27. Dull
  = .35 + .3 per step (cap .88); two bone chevrons 5 px clear of the lead
  item's top and bottom points, .42 rr long. BUILD 151.
- [x] **The row in tones, opaque; the word steps aside** — 2026-08-27.
  `TONES` (bone, park, flare, creek, stairs, rug, gold — plate palette,
  noted in STYLE.md), item alpha 1, colour pulled toward dim by .22 per
  step from the lead (cap .7); letter in ground or bone by luma; the
  travelling pick keeps its tone until it lands; the item's name in its
  tone; the word hidden while any item is the lead. BUILD 150.
- [x] **The pick travels; the word waits two** — 2026-08-27. `foldFrom`
  taken by `setOut()` at the moment of a pick (Enter or click-away):
  the picked diamond is skipped in the row and drawn on the path from
  its slot to the fold (position, radius and flare→bone lerped by `fd`,
  520 ms inOutCubic, reversed on unfold); a pick with no origin (boot,
  journal) grows in place as before. `WORD_WAIT` 2000. BUILD 149.
  Verified with mid-frames both ways.
- [x] **The word waits a second** — 2026-08-27. `WORD_WAIT` 1000 ms from
  the letter opening (`openSince`), `RISE` fade; anchor moved to (1.05 r,
  −0.85 r). BUILD 148. Verified: word region ink 103 at 0.5 s, 516 at 1.4 s.
- [x] **The name waits** — 2026-08-27. `DWELL` 2000 ms on the same lead
  item before the name shows, `RISE` 220 ms fade; anchor moved to
  (.6 rr, −1.2 rr); the number dropped. The frame loop keeps drawing
  while a name is waiting (`dwelling`). BUILD 147. Verified: no name at
  0.6 s and 1.8 s, present at 2.5 s, gone on moving.
- [x] **The item's name on the diagonal** — 2026-08-27. From
  (x + .35 rr, y − .95 rr) of the lead item, −45°, spaced like the word;
  the line beneath the row is gone. BUILD 145.
- [x] **The row fades from the cursor** — 2026-08-27. Item alpha = .85 −
  .22 × |m − lead| (floor .25), the lead at 1; the pick keeps flare.
  BUILD 144.
- [x] **The row fans from the cursor** — 2026-08-27. `focus.js` draw
  order for items: those ahead of the lead far-first, then 0..lead in
  order, so the lead is on top and each crossed item sits over the one
  before it; lead = cursor, else hover, else the pick. BUILD 143.
- [x] **The fold stops short; the focus stands the wrong acronym** —
  2026-08-27, two bugs from Eden's relaunch. (1) `focus.js` repainted only
  while a tween ran, never the settled frame — `wasMoving` draws one more;
  a page booting with a pick starts with `fold` pre-settled instead of
  rising then sinking. (2) `journal.js` `mint()` collided (ms + 2 random
  chars, ~60 ids per ms): a counter added, `dedupe()` on load re-mints
  later duplicates and says so. BUILD 142. Verified on a fresh throwaway:
  192/192 ids unique, RAITS in focus, Enter picked "big" and the column
  ink above the pick fell 13019 → 4, reload came up folded and still.
- [x] **The focus moves** — 2026-08-27. Tweens in `focus.js` (`tween/
  val/moving`, outBack / inCubic / outCubic): `stand` (520 ms, letters
  rise from the hub last-first, each on its own slice), `row` (460 ms out
  / 220 back, items slide from the letter in turn, word fades along the
  diagonal; the closing row keeps its letter via `row.k`/`lastOpen`),
  `fold` (380 in / 320 out, letters sink and fade into the pick diamond
  as it grows). Repaints only while a tween runs. STYLE.md: the one thing
  that may move is a thing made of the lattice. BUILD 140. Verified on a
  throwaway with mid-animation frames at 140 ms and 180 ms.
- [x] **Focus has the keys while a letter is open** — 2026-08-27.
  `Focus.active()` = a letter open and not folded; game.js keydown asks
  it first and returns, so nothing walks; `Focus.key(code)`: ↑↓/WS
  letters, ←→/AD items (`cursor`, lit and named like a hover), Enter →
  `Journal.setPick` + fold, Esc → close. Foot gap = `GAP` (12) to match
  the hub. BUILD 138. Verified on a throwaway: open R, ↓→→ Enter picked
  "small" and folded with the walker unmoved; a held → walked after.
- [x] **Focus, tidied** — 2026-08-27. The word's anchor moved to (1.2 r,
  −1.0 r) from the letter so the diagonal clears it; each item diamond
  carries the item's first letter; the fold is `HUB_R × 2` (half 32).
  BUILD 137. Verified on a throwaway, both states.
- [x] **The focus stands on the hub, and folds to a pick** — 2026-08-27.
  `focus.js` relaid: column centred on the hub pair's axis (x 92), last
  letter's lower point 8 px above the pair's upper points, stacking
  upward and shrinking under the compass; item press → `Journal.setPick`
  (flare, named beneath), second press → `Journal.openAt`; a press away
  with a pick folds to one 60 px-half diamond on the axis whose lower
  point sits on the pair's centre line, showing the item's first letter;
  press it to stand the column again; a pick is carried folded across a
  reload. `Journal.pick/setPick`, `pick` in `hq.journal` (cleared when
  the focus changes; dropped if the item is gone). BUILD 136. Verified on
  a throwaway: open A, pick "small", away → folded S, unfold, second
  press → journal on A, reload → folded with the pick.
- [x] **The focus: an acronym stood up on the plate** — 2026-08-27.
  Journal: `◆ focus` beside each row's caption (`Journal.setFocus`, toggles
  `hq.journal.focus`; `load()` now carries `focus` — it was dropped, found
  on the throwaway), `Journal.focused()` → letters/ids/words/items,
  `Journal.openAt(letterId)`. New `src/focus.js` (after journal.js,
  `Focus.init()` in game.js): column at left 8 / top 270 / 190 above the
  bottom, letter diamonds 84 px shrinking to fit, each a lattice region
  through `Title.paint` at the plate's pitch (STYLE *The lattice*); a
  pressed letter opens a row of item diamonds (.85 → .3 bone, nearest on
  top) with the word on the −45° diagonal, hovered item named beneath,
  item press → `Journal.openAt`; hidden by the compass's rule;
  `pointer-events:none` + window capture listeners so the plate keeps
  every click not on a diamond. BUILD 135. Verified on a throwaway:
  RAITS stood up, A opened with 3 items + ADJECTIVES, empty-canvas click
  reached the plate, item click opened the journal on A, ◆ toggled.
- [x] **The journal edits itself** — 2026-08-27. `src/journal.js`
  rewritten: frame as data (`hq.journal` = `{frame, notes}`, ids per
  tab/sub/row/letter, notes by letter id `{word, note, items}`), old
  path-keyed map carried across on first open; **Edit/Done** in the head
  (`Journal.setEdit`, Esc leaves edit first — game.js gate); rename in
  place, ‹ › ▲ ▼ move, ✕ remove (armed twice when notes are held), + tab
  / + sub-tab / + ACRONYM; `reletter` keeps ids by column; right pane =
  Letter → stands for, Description, Items (add on Enter, ▲ ▼ ✕); tiles
  96px / 22px letters (the one glyph over 14px, noted in the CSS);
  Status gains Politics, Economics, Talking points. BUILD 134. Verified
  on a throwaway seeded with an old-shape journal: 2 notes carried,
  items add/move/remove, tab rename + move, sub add + rename, acronym
  add/move/reletter/blurb/remove, sub remove armed then removed, Esc ×2.
- [x] **The towns map in the plate's own diamonds** — 2026-08-27, with
  STYLE.md *The lattice* (the rule: `G.A.cell`, ≈3 px at fit-all, half-size
  0.75, weights from one table; chrome via `Title.paint`, plate via GL,
  pictures via the tone pass, never a glyph/sprite). `towns.js`: sprites
  and `◆`/`◇` gone; `face()` at `pitch() = G.A.cell × G.fitAll × DPR`,
  `under(i,j)` maps lattice → country cell, roles as alphas for a covering
  diamond (.30/.22/.25/.40 subject, .11/.13 parent, .05 beyond), edges walk
  the cell's dividing side at every lattice step (one diamond thick at
  every level), all through `Title.paint`; dots are rhombi two pitches
  wide on a ground diamond. BUILD 133. Measured on a throwaway: country
  41 ms, region 93, district 104 (was 183/196/164); rims continuous at
  district level.
- [x] **v7.8 · 5 · The picture store, namespaced** — 2026-08-27. In
  `loci.js` only: `row(k)` maps a uid → `locus:<uid>` and `bag:…` →
  `card:…` (alts ride along); `store/get/del` go through it; `survey()`
  moves unprefixed rows on first boot (read, put, delete, in order —
  self-describing, no ladder step) and notes it; `keys()` returns rows,
  `rowOf` exported; `publish()` writes `rows` beside `uids` and
  `platformer.html` fetches `MQ.rows || MQ.uids`. `index.js` classifies
  by row prefix. bag.js, missions.js untouched. BUILD 130. Verified on
  the throwaway: 14 rows moved (12 card, 2 locus), bag reads through,
  attach/detach round-trips, a v7.7 restore migrates again to 0
  unprefixed.
- [x] **v7.8 · 6 · A plate's own underlay** — 2026-08-27. `basemap.js`:
  `handles(id)` sets `KEY`/`IMGKEY`/`PK` (`hq.basemap[.id]`,
  `hq.basemap.img[.id]`, store row `img[.id]`); `boot()` shared by `init`
  and new `mount(id)` (drops the picture in memory only, never storage);
  `find()` seeds `Atlas.setGeo` when the plate has none; `Basemap.plate()`.
  `Atlas.go`/`init` call `Basemap.mount`. `snapshot.py`: READ_PIC returns
  every row, `pictures` beside `picture` when other plates have one,
  WRITE_PIC clears and writes both, the gkey strip covers `hq.basemap.*`.
  BUILD 129. Verified on the throwaway: new plate → no picture, took one
  → `hq.basemap.<id>` + row; home → rot −2.18 back; new → its own; save
  shows "+1 plates'", restore round-trips byte for byte.
- [x] **v7.8 · 7 · Lazy plates** — 2026-08-27, by measurement, no code:
  `Build.load` and `Markers.load` read one key (the mounted plate's);
  `Atlas.init` mounts only the current plate; `Interior.survey` checks
  `hq.rooms.*` strings without parsing them; the index reads every plate's
  marker list (small) and never a shape. The big blobs — a plate's shapes,
  a plan — are parsed only when stood on or entered. Already true.
- [x] **v7.8 · 4 · The sweep** — 2026-08-27. `tools/snapshot.py sweep
  [--yes] [--port]`: `Index.rebuild()` over CDP, each orphan printed with
  its plan size / typed rooms / picture KB / mission title; `--yes` saves
  `snapshots/.pre-sweep-<UTC>.json` (gitignored) then removes the palace
  keys, the IDB pictures (`DEL_LOCI`), and blanks a mission's palace.
  Verified on the throwaway: dry run listed 4 palaces + 2 pictures; --yes
  removed them (rooms keys 5→1, pictures 14→12), rerun said none. Found
  and fixed the real cause of the fresh-profile restore failure on the way
  (READ_PIC created an empty v1 database; now creates the store).
- [x] **v7.8 · 2 + 3 · A palace knows its plate, and the index** —
  2026-08-27, one item: `src/index.js` after loci.js; `Index.init()` once
  `Loci.survey` resolves (game.js); plates → markers, palaces → {plate,
  name, n, plan, order, loci}, loci → {palace, picture}, pictures →
  {kind locus|card|alt, owner}, missions → palace, `orphans`; written to
  `hq.index`, rebuilt on boot and 600 ms after any write to the six key
  families via `Store.watch`; `Loci.keys()` exported. No `plate` field
  written into any record — `Index.plateOf(uid)` answers instead. BUILD
  128. Verified on the v7.7 throwaway: 1 plate, 5 palaces, 14 pictures,
  1 mission; orphans = 4 palaces (v5.0's typed plans with no marker) + 2
  pictures; rebuild fired on `Atlas.rename`.
- [x] **v7.8 · 1 · One store, one version** — 2026-08-27. `src/store.js`
  first in the chain: `get/set/del/put/json/save/keys/has/watch`, `set`
  throws on quota as before so every latch holds; `hq.version` + `LADDER`
  (step 1: `hq.bagsel`→`hq.bagseq`, drop `hq.bagtune`, bare `hq.order.`,
  Haunt Quest's `hq.best`). 65 sites in 14 files rerouted; bag's own
  bagsel fallback and interior's key scan replaced. BUILD 127. Verified on
  a throwaway restored from `snapshots/v7.7.json`: version 0→1, stray keys
  gone, 39 shapes / 5 plans / 1 mission / geo intact, watch fires, rename
  and commit write through.
- [x] **The roads between plates, on the map** — 2026-08-27. `drawLinks`
  in `towns.js`: each link in `hq.atlas` whose two plates both have an
  anchor, one dashed aqua line (drawn from the lower id, so both ways is
  one road), under the dots. `chips()`: `Atlas.layout()` rendered with the
  existing `.amap/.achip/.ajoin` CSS at 72×40, beneath the Unplaced list
  only while a plate has no anchor; `.achip.off` dim for the unplaced,
  click stands on it. BUILD 125. Verified on a throwaway: Home—Plate 2
  line drawn; Plate 2's anchor cleared → 1 unplaced row, 2 chips, 1 off.
- [x] **The towns map is Australia** — 2026-08-27. From
  `~/Projects/loci-australia`: `assets/australia.js` (generated, loaded on
  first open by `Country.load()`), `src/country.js` (its `atlas.js`,
  renamed — the game already has an Atlas), `tools/country.py` (+
  `tools/country-data/sa3.geojson`, output path moved to assets/). New
  `src/towns.js`: `#towns` page (bag pattern, `body.towns` clears the
  chrome, compass hides), sheets typeset in ◆/◇ with the stride, hover
  sheet, cross-fade drill; every `Atlas.geo` plate a gold dot + name
  (flare = current, names step down when dots share a pixel); click dot →
  `Atlas.go` + close; click land → drill; **pin here** arms a click that
  `setGeo`s the current plate; list = towns in scope, unplaced, children
  with town counts; readout on the foot. `Towns.init` takes `Hud.onTowns`
  after `Atlas.init`; game.js gate Esc/Backspace → `Towns.back()`. BUILD
  124. Verified on a throwaway: country decodes in 0.5 s, opens on the
  current plate's region (Hume), readout, drill to Upper Goulburn Valley,
  Esc up, pin moved Plate 2, list row stood on Home and closed.
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
- [x] **`snapshot.py restore` on a fresh profile** — 2026-08-27, with
  v7.8 · 1. `WRITE_PIC` opens at the profile's own version and, if the
  `pic` store is missing, reopens one version up to create it. Verified:
  `snapshots/v7.7.json` restored into an empty profile, 39 shapes back.
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
