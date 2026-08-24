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
    ~/.cache/memory-quest-wall       the wallpaper's own profile, its own town
    ~/Projects/halftone-platformer   upstream for platformer.html; still its own project
    origin                           https://github.com/ParseMeData/memory-quest.git

**There are two towns, not one.** `wallpaper.sh` runs on the second profile,
and `snapshot.py` never attaches to it — so whatever gets built in the desktop
plate is in no snapshot and no tag, and does not appear in the town you play.

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
gaps, and the palette says how many rooms are joined while you work.

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
    hq.rooms.<uid>       one palace's plan
    hq.marks.<uid>       one palace's loci
    hq.order.<uid>       the room list that palace was typed from
    hq.basemap           the tracing underlay's position and source
    hq.blank             printed map or blank plate
    hq.sparks            the round, on or off
    hq.deck              the ordered run handed to the platformer
    IndexedDB hq.loci    the locus pictures
    IndexedDB hq.basemap the frozen tracing picture

---

## Decisions that would be got wrong

These are the ones where the obvious approach is the wrong one, and where a
fresh pair of eyes will want to "simplify" something load-bearing.

**Two registries, one editor.** `Kinds` holds a map registry and a floor
registry and swaps between them with `Kinds.use(scope)`. Everything downstream
reads `Kinds.list` / `.by` / `.layers` / `.palette` and never learns which it
is looking at. Build mode is not told whether it is editing a town or a floor
plan, because there is nothing it would do differently.

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

**The platformer is unchanged in behaviour.** It plays its own deck when
opened alone. The route is a *chain* — 0 into 1, 1 into 2 — rather than the
built-in deck's disjoint pairs, so a run of n pictures is n−1 scenes and the
picture you just built is the one you empty next.

**Every `file://` page in this browser shares one origin.** Measured, not
assumed. That is why the platformer can read the builder's localStorage *and*
IndexedDB directly — no iframe, no postMessage, no build step. The order goes
via localStorage because the page needs `PLACE.length` synchronously; the
pictures stay in IndexedDB and are fetched before the faces load.

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

**Drive the running page over CDP.** `tools/cdp.py` is a few dozen lines of
WebSocket with no dependencies; `p.js('...')` evaluates in the page. Both the
builder and the platformer expose their state as globals (`G`, `Build`,
`Kinds`, `Interior`, `Loci`, `Palace`, `Doors`; `game`, `st`, `PLACE`).

**Verify with a real screenshot.** `Page.captureScreenshot` over CDP. Counting
instances proves geometry; only a picture proves it looks right. Two traps
worth knowing: the camera follows the walker, so setting `G.camT` does nothing
— move `G.x`/`G.y` instead; and the game pauses on blur, so a page driven from
a terminal is usually paused (`G.paused = false` to override).

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
backup is written through `save`, so it is key-stripped like any other
snapshot, and restoring from one will not bring a Google Maps key back.

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
browser profile.

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
  whichever you are standing in; the name draws on the plan in diamonds.
- **Every palace is partly unreachable.** Resizing a room moves it away from
  its doors. More doors or wall gaps; the palette counts joined rooms.
- **A cut narrower than a tile looks open and is not walkable.** The drawing
  cuts at cell resolution and the walk grid opens at tile resolution. Not yet
  reconciled, and a real trap when trimming finely.
- **The doors swing for the look only** — the walk grid is open whether the
  leaf is or not. Making a shut door actually block is a different feel and a
  bigger change.
- **The `LATTICE-CONTRACT.md`** in the halftone project still lists the two
  projects as separate. Its one undeferrable question — cell or tile? — has
  been answered in practice here: authored on tiles, baked to cells.
