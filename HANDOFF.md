# Handoff

Written 24 Aug 2026, at tag **v5.0**. Read `README.md` for how any single
thing works, and `STYLE.md` before changing anything you can see; this is
the shape of the whole and the things that are not obvious from the code.

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

## State at v5.0

Where the branches and the tags actually stand is a thing to read, not a thing
to write down — a transcript of it is wrong by the next commit, and wrong in a
way nobody notices:

    git branch -v        # every branch, its head and what that commit says
    git tag -l           # every version that exists

The town: 39 shapes, 5 markers, all five with a floor plan inside them, on a
blank plate over the frozen Myrtleford underlay. Sparks are off.

| # | rooms typed | shapes | rooms | doors | gaps | loci | reachable |
|---|---|---|---|---|---|---|---|
| 1 | hall, bedroom, bathroom, kitchen, study | 40 | 5 | 4 | 0 | 0 | 105/409 |
| 2 | lounge, kitchen, hall, office, bedroom ×2, laundry, bathroom | 31 | 8 | 0 | 2 | 0 | 128/713 |
| 3 | pateo, dinning room, lounge room, kitchen, office, bedroom ×2, laundry, toilet, bathroom | 44 | 10 | 6 | 3 | 0 | 245/396 |
| 4 | porch, lounge, dinning room, kitchen, office, bedroom, bathroom | 38 | 7 | 6 | 0 | 0 | 10/501 |
| 5 | veranda, dinning, lounge, kitchen, hallway, office, bedroom ×2, laundry, toilet, bathroom | 47 | 11 | 3 | 4 | 0 | 445/575 |

**No palace is named and no palace has loci.** Two locus pictures survive in
the IndexedDB store, orphaned — no marker points at them. So `P` has nothing
to play. That is the obvious next thing to do.

Every palace is also partly unreachable. Rooms have been resized and dragged
away from their doors, which disconnects them; the fix is more doors or wall
gaps, and the palette says how many rooms are joined while you work. Every
figure above was recomputed from `snapshots/v5.0.json` for this release except
*reachable*, which is a flood fill that only exists in a running page: those
ten numbers were measured at v4.6. No palace's shapes have changed a byte
since and no reachability code was touched, but read them as a measurement
with a date on it rather than as today's.

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
