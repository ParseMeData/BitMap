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

    ~/Projects/memory-quest          this project
    ~/.cache/memory-quest            the browser profile — where the town lives
    ~/.cache/memory-quest-wall       the wallpaper's own profile, made the first
                                     time `./wallpaper.sh start` runs
    ~/Projects/halftone-platformer   upstream for platformer.html; still its own project
    origin                           https://github.com/ParseMeData/memory-quest.git

**The moment the desktop plate runs there are two towns, not one.**
`wallpaper.sh` launches on that second profile and opens no debugging port —
its argument parser takes nothing that would add one — so `snapshot.py` cannot
attach to it, and whatever gets built in the plate is in no snapshot and no
tag, and does not appear in the town you play. As of v5.0 the plate has never
been started on this machine: there is no `~/.cache/memory-quest-wall`, and no
Memory Quest rule in `~/.config/kwinrulesrc`.

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

Storage, all under `hq.`:

    hq.shapes            the town
    hq.markers           the town's markers
    hq.town              the town's name — a palace's name is not here, it is
                         on its marker inside hq.markers
    hq.rooms.<uid>       one palace's plan
    hq.marks.<uid>       one palace's loci
    hq.order.<uid>       the room list that palace was typed from
    hq.basemap           the tracing underlay's position and source
    hq.blank             printed map or blank plate
    hq.sparks            the round, on or off
    hq.deck              the ordered run handed to the platformer
    hq.lastError         the last runtime slip; nothing ever clears it
    hq.loads             reload stamps, to catch a relaunch loop
    hq.best              nothing here writes it — a leftover carried in the
                         profile since the fork from Haunt Quest, and kept by
                         `save` only because `save` takes every `hq.` key
    IndexedDB hq.loci    the locus pictures
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

**Generated geometry is placed `exact`.** Snapping is for a shape being
dragged. A shape's centre snaps to a tile *centre*, so a room an even number of
tiles wide has its edges on tile centres — and anything derived from it by
rounding lands a whole tile out. That bug looked random because odd-width rooms
never showed it.

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
`memory-quest`, so the default match catches both on their *path* — neither
title contains it — and first-listed-wins would let a restore write the town
through the runner. It
drops every `platformer.html` target unless the match string asks for one, and
then prefers the page whose path ends `/index.html` — query and fragment taken
off first, because the builder can be open as `?wallpaper` or carrying a hash.
Both filters read like over-engineering and neither is. Every tool prints which
page it actually got, which is the check that they held.

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
copy it.** `memory-quest.desktop` holds `@DIR@`, `@VERSION@` and a header that
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
entry at `~/.local/share/applications/memory-quest.desktop` is *generated* —
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
- **There is no LICENSE.** The repo is public, `platformer.html` is vendored
  from another project, `assets/map.js` is The Mighty Haunt's printed sheet,
  and the map bar credits OpenStreetMap, CARTO and Google on screen — so what
  this tree may be reused under, and on what terms the vendored and bundled
  art travel with it, is unstated — opened by the release that made the
  project installable.
