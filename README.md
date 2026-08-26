# Loci Bitmap V7.3

Build a town out of diamond glyphs, over a real one.

A map is drawn as a field of diamonds that never stops breathing. You trace a
real place behind it — a frozen dark map you lay down by hand like tracing
paper — and build roads, districts, water and trees over it, then walk the
routes you drew.

    ./play.sh          # or: Loci Bitmap V7.3 in the KDE launcher

`./install.sh` puts that launcher entry there: it fills this clone's path and
the current tag into the tracked `memory-quest-le.desktop` template, writes the
result under `~/.local/share/applications`, and installs `assets/icon.png`
beside it as the theme icon the entry asks for. `./install.sh --remove` takes
both out again — but not the desktop plate's KWin rule, which is
`./wallpaper.sh uninstall`.

Started 23 Aug 2026 from **Haunt Quest** (`~/Games/lattice-haunt`), which
remains its own project. Everything here about the lattice, the renderer and
the build tools came from there; what is new is that the plate starts
**blank** rather than as The Mighty Haunt's printed sheet, so the town you
build is the only thing on it. The printed map is still in `assets/` and one
switch away — see *The plate: Map or Blank*.

`HANDOFF.md` is the orientation document: the shape of the whole thing, the
decisions that are load-bearing, and how to work on it without breaking the
town. Read that first; read this for how any single thing works.

`STYLE.md` is the look, written down — the palette, the type, the square
corner, and the rule that new work is flair on top of the plate rather than
a change to it. Read that before changing anything you can see.

## Versions

The folder carries no version; the tag does, and the name in the title,
launcher and README follows it.

    git tag -l -n1              # what versions exist
    git checkout v1.0           # the fork from Haunt Quest, blank plate only

**v1.0** — forked from Haunt Quest: blank plate, the dark tracing underlay,
freeze-and-place.
**v2.0** — creek terrain, the Glow slider, a larger walker.
**v3.0** — interiors: walk up to a marker, press `Enter`, and build that
building's floor plan in the same editor.
**v4.0** — loci, and the runner. The markers inside a room are numbered
places, each holding a picture of what stands there; that ordered run is
handed to `platformer.html`, which plays it as a chain — every picture built
out of the diamonds carried from the one before it.
**v4.2** — palaces you type rather than draw: a room list that lays itself
out and refits as you move the walls, a wall demolisher, and words made of
diamonds.
**v4.4** — doors as a tool rather than a consequence, plan tools that aim and
trim at the lattice cell, grips that stretch from the side you hold, no clock,
and a click to resume.
**v4.6** — walls that meet share one wall, doors that take out the wall they
stand in and swing away from you when you walk into them, and rooms that carry
their contents rather than being laid again.
**v5.0** — packaged: an install and uninstall path so the launcher is not a
hand-kept copy of itself, the page wearing its own icon, saves that say so
when they fail, Esc no longer freezing the desktop plate, the arming tools
finally lighting up, a snapshot tool you can aim at a throwaway profile and
that takes a backup before it destroys anything, and `STYLE.md` — the look
written down, so the one thing that cannot be re-derived from the code stops
depending on whoever last touched it.
**v6.x** — Memory Quest Low Effort: the fork standing on its own, plates
joined at road ends, the warp, landmarks from glyph sheets, the tones.
**v7.0** — Loci Bitmap: the bag. The `123` and `abc` rings open one page of
cards — a person, an action and an object for every number and letter,
each a picture and a word, stacked down the right like a solitaire column
and kept between sessions; a slider and the arrow keys to reach any of
the hundred.

**v7.1** — the HUD is diamonds: the hub alone until it is pressed, the
four ways in halftoned out of the plate's own material. The bag's stack is
dealt from the row and a whole stack saves as a mission. Water on its own
layer, with a river's ends draggable. And a title in a real font: the
town's name and a palace's name set in any face on the shelf — Fleur De
Leah by default — still one diamond per cell of ink, on the plate's own
pitch, with Size, Detail, Weight, Tone and Dither to tune it.

**v7.2** — the title, tuned: a font title's diamond is the plate's own,
Size reads a name at more of them, and a name lies on an oval mat that
dims whatever is under it, feathered from its centre, with a sheen down
the lettering. The bag's cards wear the heading's face — every number
and letter read in one box per system, on one baseline — and the floral
frame, masked in the card's own colour, with an edge that fades around
each card.

**v7.3** — pictures through the tone pass: a card's picture is lattice,
read by the same two stages as the map; a card keeps a hand of pictures
and the still walks them, tunes the halftone with the wallpaper tool's
own knobs, and Keep deals one. The stack layers as a stack again and a
card's tag is its word with a slot mark. And the journal: an aqua diamond
beside the hub opens tabs of sub-tabs of rows of letters, a note behind
every one.

### The half that is not in the repo

The source tree is the engine. The *town* — every shape, every marker, the
frozen tracing picture, the blank-plate flag, the floor plan inside every
building — lives in the browser profile the launcher uses, so a tag on its
own is only half a version. `tools/` writes the other half to a file beside
it:

    ./play.sh --remote-debugging-port=9222 &
    tools/snapshot.py save    snapshots/<tag>.json
    tools/snapshot.py restore snapshots/<tag>.json

`snapshots/<tag>.json` is the town as it stood at that tag, frozen picture and
all — one file per tag, all of them in `snapshots/`. Restoring is destructive
— the profile *becomes* the file, so a room built since the snapshot is
removed rather than left behind, and the page reloads. So a restore saves the
live profile to `snapshots/.pre-restore-<UTC>.json` first, prints what is live
against what is in the file, and waits for the word `restore` to be typed;
`--yes` skips the question and never the backup.

Every `hq.` key is taken rather than a list written down in the tool, because
an interior is one key per marker named after an id only that marker has, and
there is no fixed set of them.

`tools/cdp.py` is what talks to the running page: a few dozen lines of
WebSocket, because nothing else here needs a dependency.

### The dev box

`tools/aws-dev-box.sh` stands up an EC2 box with the repo and Claude Code on
it. It holds the engine, and deliberately not the town: the town is in a
*browser* profile, and the browser stays on your machine. So the box serves
`index.html` to a port that only exists inside an SSH tunnel, and you play it
at `http://localhost:8080` in the browser you already have.

    tools/aws-dev-box.sh up       # key, security group, instance
    tools/aws-dev-box.sh tunnel   # ssh in, forwarding 8080 → the box
    tools/aws-dev-box.sh ip       # the current public address
    tools/aws-dev-box.sh stop     # stop paying for compute
    tools/aws-dev-box.sh start    # bring it back, on a new address
    tools/aws-dev-box.sh destroy  # instance, group and key, gone

`$MQ_REGION` defaults to `ap-southeast-2` — Sydney, the closest region to the
town being traced — and `$MQ_TYPE` to `t4g.medium`, two ARM vCPUs at about
five US cents an hour. Port 8080 is never opened in the security group; only
22 is, and only to the address you ran `up` from.

**`stop` is not `destroy`.** Stopping ends the compute charge and keeps the
30 GB disk, which is still billed; only `destroy` ends the billing, and it
takes the disk with it, so anything on the box that was not pushed is gone.
It asks you to type the word.

## Controls

| | |
|---|---|
| `WASD` / arrows | walk (hold to keep walking) |
| `Shift` | sprint |
| `Space` | recrystallise the map |
| `Tab` (hold) | overview of the whole map |
| wheel, `+` `-`, `0` | zoom &nbsp;·&nbsp; `0` back to the distance the town is worked at |
| `T` | tune panel &nbsp;·&nbsp; Glow, Plate: Map or Blank |
| `B` | build mode |
| `O` | the room order &nbsp;·&nbsp; type a list, and the plan is laid out from it |
| `Enter` | open the marker you are standing by &nbsp;·&nbsp; a room, or a locus |
| `P` | play the route in the platformer |
| `M` | map underlay to trace over |
| drag / `Shift`+drag | move / turn the frozen map (in Place) |
| `Shift`+`Tab` | next layer (in build mode) |
| `F` / `F11` | fullscreen |
| `R` | new round &nbsp;·&nbsp; replaces the picture while a locus is open |
| `Esc` | back &nbsp;·&nbsp; the bag, the locus, the room list, the panel, the interior, the run |
| click | resume, while paused |

Clear every spark to finish a round; each round adds two more.

**There is no clock.** This began as a game you raced and it is now a place
you draw, and a running timer over a floor plan is the game asking you to
hurry over work that is not timed — which is worse than useless, it is wrong
about what you are doing.

**Sparks are off by default.** The round is the game this started as and it is
in the way of the one it is becoming — twelve gold diamonds scattered over a
floor plan you are laying out. The machinery underneath is untouched: turn
them back on under *Sparks* in the tune panel and the deal-and-collect loop is
exactly where it was.

## What changed from the phone build

The original redrew the whole lattice on the CPU every frame — thousands of
`drawImage` calls against a cache of baked glyph sprites, plus periodic
re-bakes of a full-canvas layer. That is what made it heavy.

Here the lattice is **one static GPU buffer**, and the breathing happens in the
vertex shader:

* every diamond is one instance of a single quad, shaded as a signed distance
  field — no textures, no sprite cache, and crisp at any zoom;
* each cell carries its two faces and a seed, so the shader crosses between
  them on the cell's own clock. The CPU touches nothing between frames;
* recrystallising blows the plate apart from a single uniform and swaps in the
  new arrangement at peak scatter, where the swap can't be seen;
* only the ~25 entity instances (walker, sparks, rings) are streamed per frame.

Three draw calls a frame. Measured on this machine: issuing 200 frames' worth
of draw calls and waiting on `gl.finish()` costs **0.9 ms in total**, and the
game sits at the display's refresh rate with the frame budget essentially
untouched.

Gameplay differences: a camera that follows you with zoom and an overview, and
the playfield is confined to the island — the black void beyond the map reads
as "open ground" to the terrain classifier, so it is flood-filled from the
border and cut, and sparks are only ever placed on tiles you can actually
reach.

## Layout

What is in the tree, and what each thing is for. This is the one list —
nothing else here repeats it, because a second copy is a copy that goes
stale.

    play.sh              launches it: the first Chromium-family browser it
                         finds, on the profile the town lives in
    wallpaper.sh         the same page as a live desktop plate
    install.sh           the launcher entry and its icon, in and out again
    memory-quest-le.desktop the launcher entry, tracked as a template —
                         install.sh fills in this clone's path and the tag
    index.html           page, HUD, overlays, panels, the ten colour tokens,
                         and the script loader
    assets/map.js        the map, inlined as a data URI (keeps getImageData
                         working from file:// — a plain <img> would taint it)
    assets/map.webp      the same art as a file, for reference
    assets/icon.png      the launcher icon, 256×256
    assets/buildings-a.png
    assets/buildings-b.png the landmark sheets: sixty-odd small buildings as
                         pixel art, read by tools/glyphs.py and by nothing
                         at run time
    src/render.js        WebGL2 instanced SDF renderer
    src/lattice.js       picture → lattice: analyse (tone, sharpen, sobel)
                         then compose (pick faces + colour), and terrain
                         classification — the printed map, a traced photo
                         and a locus picture all come through it
    src/glyphs.js        GENERATED by tools/glyphs.py — every building on
                         the sheets as a grid of ones and zeroes. Re-slice
                         and commit; never hand-edit
    src/kinds.js         the art style as components: noise, geometry, the
                         cell emitter, and one generator per kind, in TWO
                         registries — the town's and the interior's, swapped
                         by Kinds.use(scope)
    src/panel.js         the tune panel, the Map/Blank plate switch, and the
                         Sparks switch
    src/build.js         build mode: shapes, dragging, walk-grid stamping,
                         and the two exclusive edit layers, Rooms and Fit-out
    src/markers.js       glyph markers, baked to one texture atlas
    src/interior.js      going inside a marker: the stack, and the swap
    src/loci.js          the numbered places inside a room, their pictures,
                         the lattice preview, and the route the platformer
                         plays
    src/type.js          the diamond typeface: a letter is a 5x7 grid and
                         every lit square is one more diamond in the stream
    src/title.js         a title in a real font: the wallpaper tool's
                         lattice-type recipe, one diamond per cell of ink
    src/journal.js       the journal: tabs of sub-tabs of rows of letters,
                         a note behind every letter, opened by the aqua
                         diamond beside the hub
    src/frame.js         GENERATED by tools/frame.py — the bag's card frame
                         as a data: URI the stylesheet can mask with
    src/palace.js        the room list, the layout it generates, the fit-out
                         that follows a wall, the names drawn on the plan
    src/doors.js         the one part of a plan that moves: leaves that swing
    src/basemap.js       the tracing underlay, live tiles and frozen picture
    src/hud.js           the four ways in, drawn on the plate out of diamonds
                         rather than in CSS: a hub that opens into four halftoned
                         diamonds, pinned to the screen and recomputed from
                         the camera each frame
    src/atlas.js         the plates: a town as many static screens joined
                         at their edges, the edge prompt, the mind map the
                         compass opens
    src/bag.js           the bag: the number system and the letter system,
                         one page of cards, opened by the 123 and abc rings
    src/missions.js      the missions: saved stacks, what each is for, which
                         palace, and how often it has been run
    src/game.js          state, input, camera, entities, frame loop
    platformer.html      the runner, which takes this route as its deck when
                         there is one (see Playing it). A vendored copy of
                         halftone-platformer.html from
                         ~/Projects/halftone-platformer, pinned at that
                         project's commit d8c6494; the only local change is
                         the route hook — 125 lines added and 6 removed
                         against upstream, nine of the additions being the
                         note that records this. The command that prints the
                         diff is in an HTML comment after the file's <title>.
    tools/cdp.py         a few dozen lines of WebSocket — what talks to the
                         running page
    tools/snapshot.py    the town, out to a file and back in again
    tools/frame.py       assets/card-frame.png → src/frame.js: alpha only,
                         halved, because a file:// image cannot be a mask
    tools/glyphs.py      the sheets in assets/, sliced into src/glyphs.js —
                         a build step run by hand when the art changes
    tools/kwinrule.py    the KWin rule the desktop plate is pinned by
    tools/aws-dev-box.sh the EC2 box: up, tunnel, ip, stop, start, destroy —
                         tools/aws-bootstrap.sh is what it runs on first boot
    snapshots/           the other half of every tag, one <tag>.json each
    STYLE.md             the look, written down: the ten tokens, the type,
                         the square corner
    HANDOFF.md           the shape of the whole, and the decisions that
                         would be got wrong

`analyse` is the expensive half (~40 ms) and only re-runs when Detail, Tone or
Contrast move; `compose` is ~10 ms and runs on every recrystallisation, hidden
behind the burst.

## Building

Placing anything is two clicks: one on its chip, which arms it (the cursor
says so), and one on the map, where it lands — nothing appears until you
have pointed at where. You can also drag straight from the chip and drop
it. `Esc` disarms.

`B` opens the palette. Work is organised in layers, the way a plan is —
the road network first and set apart, because it is the thing everything else
gets arranged around, and it is the layer you land on when build mode opens:

    Roads       road · roundabout
    ───────────────────────────────
    Ground      grass · water · creek
    Trees       trees · park
    Buildings   buildings · houses

Pick a layer, then drag a kind onto the map and it lands as a shape that
generates that terrain. Only the active layer takes the pointer, so dragging
a lawn can never pick up the road running across it. The dot on each layer
row hides it. `Shift+Tab` steps through the layers.

Everything lands on one grid — the walk tiles the walker steps between.
That grid is a whole number of lattice cells wide, so snapping to the tile
the walker stands on snaps to the weave underneath as well, and a shape's
pattern still travels with it exactly when you drag.

What you place takes the ground. A cell that falls inside a shape above it is
simply not drawn, so a block of housing clears the field it lands on, and
dragging one around hides whatever it passes over as it goes. An occluder's
own feather is left out of it, so a softened edge lets what is underneath
show through rather than cutting a hard hole.

Shapes stay live: drag the body to move one, the grips to transform it, `[`
and `]` for size (or width, on a road), `Del` to remove. Every grip says what
it does — **flare corners** scale, **bone edge grips** stretch one axis, and
the **gold ring** standing off the top edge turns the shape, held to 15° so a
district still lines up with something.

A grip **stretches from the side you took hold of**: the far side stays where
it is and the two sides joining them follow. Resizing about the centre means
every drag moves the whole shape, so lining a wall up with the one opposite
is a drag, a look, a drag back and a look again. It is worked in the shape's
own frame, so a turned shape stretches along its own axes — the far edge of
one turned 30° holds to within a thousandth of a tile. A line's grips are its bends; a ring's
grip is its radius. The panel spells out what the selection can be made to do.

Rotation turns the pattern with the shape. With **Mask** on it does the
opposite: the pattern stays where it is and you are transforming a window
over it — move, scale and rotate to frame the piece you want. **Shape** converts the
selection between rect, oval, line and ring — a road drawn as a ring *is* a
roundabout, island and all.

**Type** picks the variant a kind offers, before you place it or after:
conifer, broadleaf or a mix for a stand of trees; towers, blocks or sheds for
a district; detached or terraced for housing.

**Feather** softens the border. A plain alpha ramp reads as a blur in this
medium, so the edge dissolves instead: cells drop out toward the boundary and
the survivors thin down, which is how the printed map's own coastlines end.
Zero is a hard edge; roads are born hard.

**Bright** lifts the ink, and the coverage with it more gently — a road asked
to be brighter reads whiter, not merely more opaque. Below 1 it dims.

**Width** on a road or a roundabout runs 1 to 5 cells and no further: past
five a road stops being a line and starts being a plaza.

A roundabout is a junction, not a ring road. Its radius runs 1 to 4 cells —
four cells being one walk tile, which used to be the *smallest* one you could
make — and it is born at the smallest there is. Drag the grip to grow it. The
island only appears once the ring has an inside to it, so the smallest ones
are solid dots and anything from about three cells up gets grass, and trees
above four.

**Clear** is the whole of the margin a shape takes from whatever is under
it, measured out from its own edge — the terrain never gives up more ground
than that. **Fade** spends part of that distance dithering the boundary
instead of cutting it, and **Break** wobbles where the dither falls; neither
reaches any further out than Clear does. Roads are born with 1.2 cells of it, so a road reads as running
*through* the terrain rather than being buried in it: it clears a gap either
side of itself, all the way along, including around a roundabout. Set it to
none and the terrain closes right up to the kerb.

### Warp

The Shape row's third chip. A **warp** is an oval that stopped being one:
pick it and the oval you had becomes eight points on itself, each a grip,
with a grip in the middle of every leg that births a new point when you
pull it — the same gesture as a stream, wrapped round. A Catmull-Rom runs
through all of them, so a lake, a field or a district can be the blob the
ground actually is rather than the box it fits in. Every area kind takes
it; the points live in the shape's own frame, so it still moves, turns and
scales as one thing, and `Size` scales the run. Warp took Ring's place on
the row: Ring stays, last and dimmed for everything but the two kinds that
are a ring of something — a roundabout of road, a moat of creek.

### The other grounds

Rock, Cement, Dirt, Desert, Gravel, Mud, Scrub and Snow sit beside Grass
on the Ground layer, and all eight are one generator with a recipe each
(`GROUNDS` in `src/kinds.js`): grass with the green taken out and another
note put in. What tells rock from mud at a glance is not the pattern but
colour, how much it varies and how coarsely — plus the one habit each has:
cement cracks on a grid, sand ripples, mud puddles, scrub tufts. All are
walkable, all stamp with grass, and all are held to the plate's register:
a desert is ochre in the dark, not a beach at noon. Adding a ground is one
recipe line and one kind line.

### Creek

A **creek** is a road's geometry carrying water. Drawing one *is* the road
editor — a polyline, a width, and a ring if you want a moat — because the
editor keys off a shape's **type**, not its kind, so `types: ['line',
'ring']` inherits all of it for free.

Where it differs from a road is how it bends. A road is straight between
its points unless you bow a length by hand, which is right for a thing
built in lengths. A creek or a river is **one curve through every point**:
put it down from source to mouth — those two ends are anchored and stay
where you put them — then take hold of the grip in the middle of any run
and pull. A new point is born under your hand and the whole stream bends
to pass through it, and you can do that as many times as the water needs.
`Shift`-click still adds a point too. The curve is a Catmull-Rom spline
(`smooth: true` on the kind, `Kinds.geo.along`), flattened once and cached
like a bow, so everything downstream still only ever sees a polyline.

What differs is what it is made of and what it means. It reads as a channel
with damp banks, and the flow runs *along* the line rather than across it —
the highlight travels with the distance down the creek, so it reads as moving
water rather than a puddle stretched thin. A ring creek is a moat, and grows
an island the same way a roundabout does.

And it is **never a route**. The walker locks onto roads, and a creek is
something a road has to bridge: it declares `walk: 0`, so it blocks like
water and stamps no `path` tiles at all. Measured — a creek laid across the
map adds 382 cells and exactly zero route tiles.

Creeks connect the way roads do, so a tributary is a junction rather than two
channels with a hole punched where they meet. That also means a road crossing
a creek clears nothing: the road draws over it and stamps last, which is
already exactly a bridge.

Roads never clear each other. Anything whose kind declares `connects` is
invisible to every other connecting kind's margin, so a crossroads is a
crossroads and not two roads with a hole punched where they meet — measured,
a road keeps all 180 of its cells whether it stands alone or has two more
crossing it, one of them diagonally.

A margin cut at exactly one distance is just a second hard outline drawn
parallel to the first, which is worse than no margin at all. So the boundary
gets the same two treatments the terrain itself has: **Fade** dithers it out
over a band, and **Break** wobbles where that band falls, cell by cell. With
both at zero the gap from road to grass is the same 3.5 cells in every single
column — a standard deviation of exactly nothing. At `fade 2 · break 0.35` it
runs 4.5 cells on average and wanders by 0.63 either way, which is what makes
it read as ground giving way rather than as a stencil.

Four controls take the cleanness off, and they do different things:

* **Grain** drops the resolution — 1/2, 1/3, 1/4. Every nth cell is sampled
  *and the pattern is addressed at that coarser pitch*, with the diamonds
  scaled up to match, so the result reads as a lower-resolution print rather
  than a thinned-out one. A district at 1/2 is still a district, in bigger
  pixels.
* **Scale** is the font size: the same cells drawn larger or smaller. Under
  1× the field opens up and the weave shows through between the diamonds.
* **Jitter** knocks each cell off its seat, up to one and a half cells, for
  an edge and a surface that are ragged but still solid.
* **Scatter** breaks the field up: some cells simply do not appear, and what
  is left is displaced as well — a field that has come apart rather than one
  drawn loosely.

All four are per shape and stack, so `grain 1/2 · jitter 0.8 · scatter 0.4`
is a coarse, broken, hand-placed version of the same terrain.

### Demolish

The third thing the engine can do to a cell. An occluder takes the ground
away; a cut removes it from the walk grid; a **demolish area** does neither.
It is a statement *about* whatever it lies over: everything under it stays,
roads included, and it comes out weathered instead of removed. Drag the area
off and the terrain returns byte for byte, because nothing underneath was ever
written to.

It draws nothing of its own, so its outline and a mark on every cell it covers
are the only evidence it is there. It runs its target's own **Jitter** and
**Scatter** with its own values — the same two operations, asked for by
somebody else, on a different salt so the damage does not agree cell for cell
with the terrain's own break-up.

**Fall** is which way the damage came from. At `even` the area bites at one
weight everywhere and Feather ramps that down at every rim at once, which is a
bruise: heaviest in the middle, gone all round. Turned up, the bite runs along
the area instead — the ground at one edge is left at exactly the density it
had, and the damage deepens across to the far edge.

**And you point at it.** Inside every demolish area there is an **aqua diamond
marker**, and it sits on the side being *kept*. Everything opposite it gives
way, in a run of dots the overlay draws so you can see which way that is. Its
distance from the middle is how completely: pressed against a side, the far
side is spent entirely; halfway out, half as much; and the middle itself is no
direction at all, which is `even`.

That is one gesture instead of two, and it is the gesture the work actually is
— you are not turning a shape a quarter and setting a number to seventy, you
are holding down the corner you want left alone. It moves in both axes at once,
so a fall can run on the diagonal, which is something the turn grip never
offered at any angle it would snap to. The **Fall** slider is the same number
from the other end: it slides the marker along whatever line it is already on,
so whichever you reach for, the other follows.

The marker is normalised to the shape's own square — `-1` to `1` on each side —
so it means the same thing on a long thin area as on a squat one, and it
survives the shape being resized or turned. It is drawn at 85% of the way out,
which leaves the last sixth of the shape to the grips that change its shape,
and grips are picked by which is *nearest* the pointer rather than by which was
listed first, so a marker pressed up against a side is still the thing you get
when you aim at it.

**A demolisher is born with its marker already placed.** *East, always* is the
one starting answer that is wrong everywhere — an area laid along the top of the
map to thin the town out at its edge is eating northward, and should not have to
be aimed by hand to say so. So a new one puts its marker on the side facing the
middle of the plate, and the damage falls outward: drop it in the top of the map
and it falls up, down the left and it falls left, and a corner of the map gets
the diagonal between. It is measured in proportion to the plate, so a map half
as wide as it is tall does not call almost everything on it top or bottom, and
it is only done at birth — an area you have aimed by hand must not snap back the
first time you nudge it.

The ramp is not linear, and both departures are about the *end* of the fall
rather than its middle. It is smoothstepped, so the damage leaves the
untouched side flat and arrives flat — there is no line anywhere you can point
at and call the start of it. And jitter runs ahead of scatter, reaching twice
as far by the far end, so the last diamonds still standing are also the ones
thrown furthest off their seats. The field thins and loosens at once, which is
what makes the tail dissolve rather than stop.

**Out** is what the far end ends *at*. Scatter cannot answer that on its own,
and deliberately: its removal is held to 55% of the roll however far it is
pushed, because a scatter that could empty a cell outright is a hole, and a
hole is what demolition here is not. The end of a fall is the one place a hole
*is* the point — past it there is no more shape, so there is nothing for bare
plate to read as a mistake against.

At `none` the fall ends at whatever Scatter and Jitter make of it, which is
broken ground. Turned up, the last stretch goes out entirely, and the slider
moves where that stretch begins: at a third only the tail of the fall spends
itself, at full the whole fall is spending itself and the last quarter is bare.
It arrives at nothing three quarters of the way through that stretch rather
than in its final row, because a ramp that only empties at the very edge leaves
a thinning fringe along it, and a fringe is a border — which is the one thing a
demolisher must not draw. What survives on the way out scatters harder, throws
further and dims, so the tail reads as an ending rather than as a second, lower
density. With Fall at `even` there is no far end, so Out empties the area as a
whole.

A demolish area is also the one shape on the plate whose **four corners move
independently**. Everything else is a thing — a park, a room, a stand of trees
— and a thing described by a centre and a size is a thing you can nudge, line
up and resize predictably. A demolisher is not a thing, and the ground it is
eating into does not run along the axes: drag any corner grip and it goes on
its own, while an edge grip carries the two corners of its edge, which is the
old stretch said in the only way a quad can say it. Switch it to Oval or Line
and the corners are given back.

**What a dragged corner cuts off is spent out.** The rectangle the quad sits in
is still the footprint — dragging a corner in does not shrink what the
demolisher has hold of, it declares that the wedge between the edge you dragged
and the rectangle's corner is ground on its way to not being there. The
selection marks that wedge along with the rest, so nothing is taken without
being shown.

It goes the way the end of a fall goes, and for the same reason: nothing taken
at the line itself, everything taken by the far side of the wedge, the same
smoothstep in between, and the same scatter and jitter throwing what is left
about on the way out. So a corner does not cut — it spends the ground out, in
the units the rest of the area is already spending it in.

The fade is measured against the wedge's own depth, so it is spread across
whatever was cut off: a corner pulled a long way in fades over a long way, a
small nick over a small one. It arrives at nothing three quarters of the way,
for the reason Out does — a ramp still finishing at the far corner leaves a
fringe of survivors along it, and a fringe is a border.

**A quad has two boundaries and they do different jobs.** The rectangle is the
rim: it is where the tool's influence ends, and Feather tapers the whole ruin —
the wedge included — as it approaches it, exactly as for any other area. The
quad edge is not a rim at all; it is the line where thinning turns into going,
and it sits in the middle of what the tool is doing. Feathering it was what made
a dragged corner read as a slice, with the ruin tapering back to untouched
ground on one side of the line and everything gone on the other. Taking the rim
off it is most of what makes the cut dissolve instead.

This is how a town ends on a diagonal. A rect can only end one along an axis,
and a town ends at a river, a ridge, a road running across it. A dragged corner
is how you say where, and the fall handles the side that is meant to peter out
rather than stop.

It stays a modifier for all that: nothing is written back to the shapes
underneath, so moving the area off brings every diamond back, and the walk grid
is untouched — a road erased at the corner is still a road you can walk down.

**Mask** changes what the pattern is anchored to. Normally the pattern is
addressed by where a cell sits *inside its shape*, so terrain travels with the
shape when you drag it. With Mask on it is addressed by where the cell sits in
the world: the pattern stands still and the shape becomes a window you drag
across it, hunting for the piece you want.

With nothing selected the sliders and Type set what the *next* shape you place
will be born with, so you can dial in a look and keep placing it. A road is a polyline whose every segment can be bowed. Each segment carries
an **aqua bend grip** sitting on the curve: drag it and the segment curves
through wherever you put it, the way Figma's bend tool works — you move the
point the curve passes through, and the control point is worked back out from
it. Drag a grip back near the straight midpoint and that segment snaps back to
straight. `Shift`-click a selected road adds a point, splitting a segment into
two straight halves you can then bow independently.

Bends are geometry, not decoration: the curve is flattened once and cached, so
distance, bounds, the outline and — the part that matters — the walk grid all
follow it. A curved road is walkable along its curve. Thin roads are only a few pixels wide, so
every pointer test carries a screen-space margin and stays grabbable at any
zoom. What you build is saved per browser profile, so the game and the
wallpaper keep separate maps.

Layers draw by their own `z`, not the order they are listed: the road network
reads on top of everything, so a block of housing can never bury the route
through it.

Everything you place is made of the same lattice cells as the map underneath —
the same two-face breathing, the same instance layout, the same three draw
calls. A stamp is material, not a sprite laid on top.

Two densities are in play, deliberately. Ground cover is dense and low
resolution: near every cell filled, each diamond a little wider than its cell
so the field knits together the way the printed map does. Everything built is
drawn as structure over that, with its own internal pattern — lots with
courtyards, window scatter and lit parapets; houses with roof ridges, doors
and garden paths; crowns as conifer triangles and broadleaf ovals, lit from
the upper left, each with a trunk. Nothing lays a carpet of grass under
itself: ground is the Ground layer's job, and a green wash underneath is
exactly what stops a tree reading as a tree.

Terrain reaches the walker as well as the eye. Each kind declares whether it
reads as blocked (water, buildings, houses), open (grass, trees, park) or
route (road), and the walk grid is restamped from the map's own
classification every time a shape moves. Kinds stamp in their own order
rather than the order you drew them, so the rule stays predictable: blockers
go down first and roads go down last — draw a road across a lake and you have
built a bridge. A spark walled off by an edit is moved somewhere you can
still reach, and a walker left standing in new water is put back on the
nearest ground.

### Landmark

One named building, where Buildings draws a whole district from a rule. The
district generator is the right tool for the ground a town is mostly made
of and the wrong one for the six things in it anybody navigates by — the
cathedral, the station, the pagoda on the hill. Those have a *shape*, and
a rule that could produce it would be a rule with one output.

So the shape is authored. `assets/buildings-a.png` and `-b.png` are pixel
art, sixty-odd buildings between eleven and sixteen pixels square, and
`tools/glyphs.py` slices them into grids and writes the grids to
`src/glyphs.js`. That file is what ships. A square in it is one of three
things: lit (`1`), the building's own dark (`2`) — a window, a doorway,
the hatching on a roof — or the town around it (`0`). The sheet cannot
tell the second from the third, since both are black; the slicer can,
because sky reaches the edge of the sprite's box and a window does not.
Own dark is painted in the plate's own colour, so a window reads as a
hole to the night and the grass never shows through it; the town around
it draws nothing and *takes* nothing — a print occludes only under its
ink and its own dark, never its box, so terrain runs right up to the
drawn edge and shows in every notch of the silhouette. This is the
slicer's rule, so it holds for every sheet imported from now on. Nothing in `src/` ever opens a
PNG: at stamp time every lit square becomes one diamond in the same instance
stream as the roads and the grass — exactly what the typeface does with a
letterform, and for the same reason. There is no sprite on the plate. A
landmark is made of the town rather than printed on it, which is what keeps
it and the ground it stands on reading as one material. The body is
screened in a checker so it reads as tone rather than a cut-out, the rim is
left solid so the building keeps a drawn edge, and the warm note is spent
on a touch of trim along the roof line and a lit window now and then — the
first cut screened a third of every building in window colour and it was
the only thing on the screen.

The palette draws each building as its own chip, so you choose by sight:
sixty words nobody can map back to a shape is a worse picker than none.
The chips are read off `Glyphs` at load, so re-slicing the sheet is the
only step in adding a building. Two kinds draw from the sheets, both on
the Buildings layer: **Houses** takes the set the slicer was told is
houses (`--set houses=…`), and **Buildings** (id `landmark`) takes
everything left. The
district textures that used to sit on this layer — Blocks and Housing —
are on **Terrain** now, because a field of housing drawn from a rule is
ground cover, and a drawn building is a thing standing on it.

A drawn building is a **print**: it has one size, one lattice cell per
drawn pixel, and no grips. That is the smallest it can be and still be the
building you picked, and a tile-measured default was four times too big
for it; bigger is the same pixels with the gaps showing, smaller is detail
thrown away, and a town where one cathedral is drawn at a different scale
from the next has no scale at all. So you pick it, you put it down, and
you move it whole — `[`, `]` and the Size row do nothing to it, and the
size field is not shown.

What you can change is its **tone** — the row under the picker. Stone is
the plate's own wall colour and the default; Brick, Slate, Moss, Sand and
Rose are the same four notes (wall, its dim, window, trim) in another
material, all held to the same register: enough saturation to read as a
material at a glance, never so much that one building is the only thing
on the screen. The window stays near-gold in every tone, because a lit
window at night is one colour whatever the wall is. Tones live in
`TONES` in `src/kinds.js`; adding one is one line there.

Re-slicing, when a sheet changes:

    tools/glyphs.py assets/buildings-a.png --cols 6 --rows 5 --prefix a \
        --pad 0 --set houses=a01-a24
    tools/glyphs.py assets/buildings-b.png --cols 6 --rows 6 --prefix b --append \
        --pad 0 --set houses=b11,b25-b28,b30,b32

The upscale factor the art was exported at is detected rather than asked
for (`--pitch` overrides it), `--thr` is the grey level that counts as lit,
and `--preview` prints every glyph as text and writes nothing — the way to
check a slice before committing it. `--pad` grows a ring of own dark
around each silhouette (0 here: the town runs to the drawn edge), and
`--set houses=a01-a24,b11` names which glyphs the Houses kind offers; the
current split is in the two commands above. ImageMagick
does the decoding, because it is on the box and PIL is not.

### Adding a kind

`src/kinds.js` is written so a new kind is one function and one line. The
function gets `(shape, cell, buf)` and calls `scan`, which hands it every
lattice cell the shape covers along with that cell's *shape-local*
coordinates and how deep inside the border it sits, in cells:

    function marsh(s, cell, buf){
      scan(s, cell, (x, y, u, v, d) => {
        if (hash(u, v, s.seed) > 0.9) return;
        const wet = vnoise(u * 0.2, v * 0.2, s.seed + 1);
        buf.cell(x, y, mixc(C.grassDim, C.water, wet),      // colour
                 0.7, 0.95, 0,                              // face: alpha, size, outline?
                 0.5, 1.1, 1,                               // the face it breathes into
                 0.12, hash(u, v, s.seed + 2));             // rate, seed
      });
    }

then add it to `LIST`:

    {id: 'marsh', label: 'Marsh', layer: 'ground', types: AREA,
     walk: 1, stamp: 3, gen: marsh, swatch: '#4A6B58'}

and to `PALETTE` with the shape it should start as. The layer tabs, the
editor, the walk grid and saving all pick it up from there.

Patterns are addressed by shape-local `(u, v)`, never by world position,
which is why terrain travels with its shape when you drag it instead of
re-rolling under your hand. Shapes snap to the lattice grid for the same
reason.

There are two registries — the map's and the floor plan's — and `LIST`,
`LAYERS` and `PALETTE` are the map's. A kind for indoors goes in `FLIST` and
`FPALETTE` instead; everything downstream reads `Kinds.list`, `Kinds.by`,
`Kinds.layers` and `Kinds.palette` and never learns which set it is looking
at. `Kinds.use(scope)` is the whole of the swap. A few extra columns are
available to either of them: `w0`/`h0`/`len0` say how big one of the thing is
when it is born, because a district is a field of housing and a bed is one
bed; `hollow` makes an area shape its own perimeter; `walkTol` widens what a
route opens in the walk grid. `glyphs: 'houses'` replaces a `variants` list: the
kind's choices are then that set from `src/glyphs.js` (`'landmark'` is
whatever no set claimed), drawn as pictures in the palette rather than
words, and the shape is born at the glyph's own size — see *Landmark*.

## Tracing a real place

`M` opens the map bar. Type a town or an address, press Find, and a real map
appears behind the plate to lay roads and districts over. **Fade** sets how
far it sits back, **Scale** how much world it covers, and **Zoom** steps the
tile detail while holding the ground still underneath you.

**Show / Hide** is separate from opening the bar, so you can flick the
imagery off to look at the plate on its own and flick it straight back with
the place still loaded. The location, the source and the key all persist, so
the map you were tracing is still there next launch.

**Dark / OSM / Google** picks the source. Dark is the default and is
CARTO's `dark_nolabels` over OSM data: near-black ground, grey road strokes,
no text — so nothing on it competes with your own markers, and it sits under
a plate that is already bone-on-black instead of glaring through it. A light
sheet gets pulled toward the plate with `grayscale·contrast·brightness`; a
dark one is already the colour of the ground it lands on, so it is *lifted*
instead — `brightness(2.2)` — and Fade decides how far back it sits. Google
still works and still needs a billed key.

### Freezing

The bar's two modes matter more than its sources. Live tiles are how you
*find* a place. **Freeze** is how you keep it: the tiles on screen are baked
into a single image, and from that moment nothing is fetched and no key is
involved. **Thaw** goes back to tiles.

You can also skip the tiles entirely and **drop an image on the window** — a
screenshot of Google Maps in its own dark mode, a scan of a paper map,
anything. It is adopted exactly as a bake is.

Baking needs the tiles untainted, so they are requested with
`crossOrigin='anonymous'`. OSM and CARTO both answer `access-control-allow-
origin: *`, which satisfies the `null` origin a `file://` page sends —
measured, not assumed. Google is deliberately *not* asked for CORS, because a
source that refused it would fail to load at all rather than merely fail to
bake; so Google tiles still draw, and Freeze says plainly that it cannot bake
them.

The picture goes to IndexedDB, which does work from `file://` here — a baked
sheet is a quarter of a megabyte and localStorage is a few megabytes for
everything the game owns. If IndexedDB is ever refused the same data URL goes
to localStorage instead, so the picture survives either way.

### Placing

A frozen picture is no longer tied to mercator, and that is the point: it has
a position, a turn and a size you set by hand, the way tracing paper is laid
over a plate rather than the way a coordinate system says.

**Place** arms it. Then drag the picture to move it, **Shift**-drag to turn
it — free, because a photograph rarely lines up on a neat angle, with
**Ctrl** held for the 15° steps a district wants. **Turn** does the same on a
slider with a degree readout, and **Scale** resizes about the centre. It
turns about its own centre, so the part you are looking at stays where it is.

Placing takes the pointer in the capture phase, so build mode never sees a
drag that was meant for the map — otherwise the same gesture would also grab
whatever shape happened to be under it. Freezing and dropping both arm it, so
the picture is draggable the moment you have one.

A stored picture comes back out of storage asynchronously while the frame
loop is already running, so the tile path is held off until it lands.
Without that, every reload quietly pulled a whole sheet it was about to throw
away.

The tiles default to OpenStreetMap's and the search is always Nominatim's,
because both answer a plain request from a `file://` page and need no key.
Google returns 403 without a billed one. Paste a key in and `tileURL()` asks
Google instead — it serves images by centre rather than by tile index, so
each request is for the centre of the tile the grid wants, which comes back
as exactly that square. Nothing outside `tileURL()` and `find()` knows where
the imagery came from. If a key is refused the bar says so, since a sheet of
failed tiles otherwise just looks like an empty map. Keep the usage light and
leave the attribution in place: the credit line beside the bar reads
`© OpenStreetMap` for OSM's tiles, `© OpenStreetMap · © CARTO` for the dark
ones and `© Google` for Google's, and becomes `frozen picture` once there are
no live tiles left to credit.

The underlay is DOM rather than GL: a sheet of `<img>` tiles — or one frozen
picture — behind a canvas that clears transparent while tracing. The game
keeps its three draw calls, and positioning the sheet costs one transform per
frame in either mode, turn and scale included.

That transform is written relative to a local tile origin, never in absolute
mercator pixels. At zoom 15 those run to tens of millions, well past the
~16.7 million where a float stops holding integers exactly, and a compositor
handed numbers that size puts the sheet nowhere at all — which is exactly
what it did the first time.

## Markers

Not terrain. A marker is a note pinned to one spot: *this* is the place. They
sit outside the build layers, are always visible, answer the pointer wherever
they are whatever layer you are working on, and snap to the same tile grid the
walker stands on. Drag to move, `C` cycles the colour, `Del` removes.

They are drawn as real glyphs, which the diamond shader cannot make on its
own. The set is baked once into a canvas sheet, uploaded as the only texture
in the program, and each marker is one instance carrying the cell of that
sheet to cut from — mode 3 in `render.js`, with the sheet index riding in the
seed slot that a marker has no other use for. So markers cost no extra draw
call: they ride in the entity stream with the walker and the sparks.

A character the font cannot make comes back as tofu, not as nothing, so the
sheet is built by drawing each glyph and comparing it against what this font
renders for a codepoint that is definitely missing. Anything that matches, or
comes out blank, is dropped before the sheet is laid out — the palette only
ever offers glyphs that actually drew.

Select one in build mode and a field appears under the palette to **name** it.
The name is what the prompt and the banner call the place; unnamed, they fall
back to its glyph. Every marker also carries an id of its own, minted once and
saved with it, because its place in the array is not an identity — delete a
marker above it and everything below shifts, and the floor plan hanging off it
has to survive that. Markers saved before v3.0 have one minted on first load.

## Going inside

Walk up to a marker and press `Enter`. The plate becomes that building's
**floor plan**, drawn in the same editor with a different set of kinds. `Esc`
comes back out, to the tile you stepped in from and the round you were in the
middle of.

    Walls       wall · room · window
    ─────────────────────────────────
    Floor       floor · rug · water
    Fittings    counter · table · bed · sofa · shelf · plant
    Access      door · stairs

Nothing is simulated twice. Inside is the same engine on a different set of
shapes: the same lattice cells, the same walk grid, the same walker stepping
between the same tiles. Three things swap and nothing else — which registry
of kinds the palette is built from, which key the shapes are saved under, and
which markers are pinned. Build mode is never told which of the two it is
editing, because there is nothing it would do differently, and neither is the
walker.

Going in is a stack rather than a flag, so a marker *inside* a building is a
door like any other and the way back out is however many doors you came
through. The frame pushed on the way in holds the half of the world that is
not in storage: where the walker was standing, where the camera was looking,
the round in progress. The plate is forced blank while you are inside — a
floor plan is never drawn over the printed map — without writing that back,
so the town's own setting is exactly where you left it on the way out. The
tracing underlay is held down for the same reason and put back untouched.

**A wall straddles the line it is drawn on**, half in and half out. It used to
run inward from the rect that describes it, which is right for one room and
wrong for two: rooms are packed edge to edge, so where they met each
contributed its own full thickness and the party wall came out twice as thick
as the outside of the building. Centred, two rooms that meet contribute the
*same* band and it stays one wall thick — which is also how a wall is drawn on
a plan, because it is how a wall is built.

**Drag a rect out with the wall kind and you get a room** — four walls with an
open middle. That hollowness lives in the geometry, not in the drawing, which
is what makes it a room rather than a picture of one: the same `depth()` that
decides what a shape covers, which tiles it blocks the walker on, and where
the pointer can pick it up. The floor inside is left alone by all three. The
one slider is the wall's *thickness* there, with the size left to the grips
and `[ ]`, because a room needs both and a district only ever needed one.
Widen a wall past half the shape and the band closes up into a solid mass,
which is a pillar.

**A door is the one kind that takes ground from a wall instead of joining
it.** Walls and glazing connect to one another the way roads do, so a corner
is a corner; a door does not, so drawing one across a wall run opens it, in
the drawing and in the walk grid at once. What it leaves behind is a
threshold, two jambs, and the leaf — the leaf drawn outside the shape on
purpose, because a door swinging clear of the wall is most of what makes a
plan read as a plan. A door reaches a whole tile either side when it opens
the walk grid: everything snaps to tile centres and a wall's own band is half
a tile thick, and a door that looks right but silently does nothing is a far
worse failure than a doorway one tile deep.

Stamping order is what makes a plan behave, the same way it makes a bridge
work outdoors. The floor goes down first and carries you; furniture and walls
are laid over it and stop you; the door goes down last.

Sparks scatter on the floor you have drawn, so a plan is somewhere to play as
well as something to draw. An empty plan has nowhere to put any, and gains
them as the rooms go in — which is why the round tops itself back up on every
edit rather than only when one was stranded.

A marker with something built inside it wears a ring on the map, so a place
you can walk into looks different from a place that is only a note. The plans
live beside the town in the browser profile, under `hq.rooms.<marker>`. Which
markers have one is read off the plans themselves rather than kept in an index
beside them: an index has to be written at exactly the right moment and is
wrong if it is not, so closing the window while you are still inside a room
would lose the ring from a room that exists.

## Typing a palace

Drawing four walls is not the interesting part of a room and it is the same
four walls every time. The interesting part is which rooms, in what order —
so `O` opens a list you type, one room to a line, and the plan is laid out
from it:

    hall
    living room
    kitchen
    bathroom
    bedroom
    study

Press Generate and you get those rooms, walled, floored and furnished with
what each one is expected to hold: a bed and a wardrobe in the bedroom, a
bath and a basin in the bathroom, a cooktop and an island in the kitchen, a
table on a rug in the dining room. From that moment they are ordinary shapes
— drag them, resize them, throw them away, draw more.

The names are read rather than matched, so *master bedroom*, *the ensuite*
and *kids bed* all get the right furniture, and a name nothing recognises
gets a plain room rather than a refusal.

**The order you type is a route you can walk.** Rooms are placed so that
consecutive ones are always neighbours — the run ploughs along a row and
turns back along the next, so room five is beside room four even when it
starts a new one — and a door is cut through every wall between a pair. That
is checked rather than assumed: every walkable tile in a generated palace is
reachable from every other.

Rooms carry their name and their number, and which of the two you see depends
on how far back you are standing. Close in, the name across the top of the
room. Pulled back to the whole plan, a large number in the middle of the
floor — because from there what you are reading is the order, and a
fourteen-letter name at seven pixels a letter is a smudge with a word's
shape.

The list is kept per palace, so coming back shows what the place was built
from. It opens itself on a palace with nothing in it yet, which is the one
moment the answer is always yes. Generating over a plan that already exists
asks twice.

### Two edit layers

Furniture arranged by hand would be thrown away by the next nudge of a wall,
so the plan has to be settled before the fitting-out means anything. The
palette opens on **Rooms** when there is a plan, and the two layers are
exclusive:

A room **takes its contents with it**. Dragging one moves everything in it by
the same offset; only a change of *size* is a change of what fits, and only
that lays the fit-out again. Refitting on every release meant a room nudged
across the plan lost a bed you had moved half a tile — and a click that moved
nothing at all did the same thing, which is the worst version of it.

**Rooms** — the only things that answer the pointer are the plan: the room
shells, the doors and the wall gaps. Any of the three can be picked up,
dragged and deleted; a door and a room's edge grip live in the same place, on
the wall, and the door wins the pointer because it is the smaller and more
specific of the two — the grips keep the rest of the wall and all four
corners, and the whole room is the handle rather than the quarter-tile ribbon
of its wall. Move one, resize one by its corners, and **its contents
are laid again for the shape it is now**. Make it bigger and the next slot
appears and fills; make it smaller and the slot goes and takes its contents
with it. Deleting a room deletes the room, not the four walls of one.

Both plan tools snap to the **lattice cell**, not the walk tile. The tile is
the right quantum for a thing you *place* — a bed sits on tiles, and half-tile
furniture is furniture you can never line up — and the wrong one for a thing
you *aim*. A wall is two cells, half a tile, so a tool snapped to tiles cannot
land on one of its faces at all. The cell is what everything here is drawn in,
it is four times finer, and it contains the tile grid rather than competing
with it.

They go on snapping to it after they are placed: a gap and a door move and
resize by the cell, and `[` `]` trims a gap by one cell a side rather than by
a percentage. A trim you are dialling in wants one cell on and one cell off;
fifteen per cent of whatever it happens to be is nothing on a small cut and a
whole tile on a large one.

A cut is held to whole cells, which is not tidiness. A lattice cell is removed
when its **centre** falls inside the cut, and centres sit halfway between cell
boundaries — so a cut whose own edges land halfway too puts every centre along
that edge exactly on the boundary of the test, and whether each is taken comes
down to floating point. That is a ragged edge: a diamond too far in one place
and a diamond short in the next. On whole cells every centre is decisively in
or out. A cut drawn before this was true is corrected on the way in.

Because a gap draws nothing of its own, every cell it covers is marked while
you are in Rooms — an outline says where it is, and the marks say what it
takes.

The rectangle is snapped **as you drag it**, not when you let go, so what is
drawn under the pointer is what gets made. A preview that rounds differently
from the thing it previews is a preview that lies, and *I cannot put it
exactly where I want* is what that feels like from the other side.

And while a tool is armed the register grid comes down from every fourth tile
to every tile and turns aqua — plainly a tool rather than part of the page. A
grid you cannot see over the floor you are aiming at is not helping; one that
fine standing there permanently is graph paper you are trying to draw a house
on. It thins back out when the dots get too close to tell apart.

**A door is shut until somebody walks into it**, gives as they reach it, and
falls shut behind them.

Everything else on the plate is still — a wall is where it was last frame and
will be there next frame, which is why the whole plan lives in one static
buffer the CPU never touches. A leaf is the exception, being the one part of a
floor plan that is supposed to move, so it is drawn per frame in the entity
stream alongside the walker and the sparks. Nothing of it is left in the
plate but the threshold and the two jambs: **no arc**. A plan draws the sweep
because a plan cannot move, and a quarter-circle of dots standing there
permanently over a door that *does* move is a diagram of a door laid on top of
a door.

There is no state machine behind it. Each door holds one number — how open it
is — and eases toward whether the walker is close enough to be going through.
Close, not merely nearby: it opens from the tile at the threshold and stays
shut from the one before, so it gives as you reach it rather than anticipating
you from across the room.

**Opening and closing are not the same distance.** One radius for both gives a
door that flutters while you stand at the edge of it, and one that starts
shutting the moment you are past the jamb — into the back of somebody who has
not finished walking through. So it opens at the threshold and stays open
until you are clear of the arc the leaf actually swept, plus a few cells, and
then waits a second longer in case you turn round. Shut, it asks whether you
have reached it; open, it asks whether you have finished with it, which is a
larger question and the reason the two are separate numbers.

**It swings away from you, either way.** Which side it opens to is decided at
the moment it starts to move, from where the walker is standing and which way
they are heading, so the leaf goes ahead of them and never through them — and
the same door opens the other way when it is met from the other side, which is
what a door does and what a drawn arc can never show. The side is then held
while it is open: a leaf that flipped underneath somebody halfway through
would be a door swinging through them.

A sliding one gets out of the way rather than turning, a double one opens from
both jambs, and an *open* one has no leaf at all.

It swings for the look and nothing else: the walk grid was opened when the
door was cut and stays open. A leaf that could actually stop you would be a
door you had to learn to operate, in a game about walking a route.

**Door** drags along a wall and cuts one there. It takes the wall out where it
stands, the way the demolisher does — a door is a hole with a leaf drawn in
it, not a panel laid over one. Its appetite is limited to walls and glazing,
so a door across a rug takes the wall and leaves the rug, and it carries a
cell of margin so it still opens the whole wall when it is dropped a cell off
the line, which at this resolution is most of the time. The drag's long axis is the
door and its short axis is only which wall you meant, so a sideways drag on a
horizontal wall and a downward one on a vertical wall both do the obvious
thing. It is placed exactly where you dragged rather than snapped to a tile
centre — a wall an even number of tiles from the origin sits on tile centres
itself, and a door snapped off it opens half a doorway.

Doors are **not** cut automatically when a palace is laid out. Where you get
between two rooms is a route, and a route you did not choose is the wrong
answer in a thing whose whole point is the route you did choose. Consecutive
rooms always share a wall, so a door between them is one drag. A fresh palace
is therefore a set of sealed rooms, and the panel says how many of them the
walker can actually reach — otherwise *nothing happens when I walk into the
next room* is a mystery rather than a list of doors still to cut.

**Remove wall** drags a rectangle across a wall and takes that stretch of it
out — the diamonds, and the block in the walk grid — so two rooms run into one
another and you walk straight through. It touches nothing else: the floor,
the furniture and the fittings on both sides stay exactly where they were.
Measured rather than asserted — knocking one through cost 122 wall cells and
gained 8 walkable tiles, with the furniture and floor counts unchanged to the
cell.

That is a shape rather than an edit to the wall, because a wall is one rect
with four sides and *this stretch of it is not there* is not something a rect
can say about itself. A kind can declare which kinds it `clears`, and a
demolisher clears walls and glazing and nothing else — which is what keeps it
from taking the bed with it. It stamps nothing of its own: it is a hole in
what a blocker is allowed to block, because stamping something walkable over
the top would open the bed too. And the cut lifts the wall's *occlusion* as
well as its ink, or the hole the wall punched in the floor would still be
there — an opening you can walk through but see the void through is not an
opening.

**Fit-out** — the shells are locked and everything inside them is yours: the
layers, the kinds, the sliders, the markers, exactly as before.

Furniture is kept one tile clear of the walls, so a lap of open floor runs
right round the inside of every room. Not decoration: slots pack items nearly
edge to edge, and three of them across the middle of a room is a wall — a
room you can enter and not cross, which breaks the route the palace exists to
be. It cost a reachability check to find: 679 tiles walkable and 430 of them
reachable, with half the plan sealed off behind a row of kitchen counters. A
ring cannot be blocked by anything placed inside it, so the guarantee is
structural rather than something to keep re-testing.

The floor runs the full width of the room, under the wall rather than up to
its inner face. It costs nothing to draw — the wall is on a higher layer and
covers it — and it is what leaves ground behind when a wall comes out,
instead of a one-tile trench you cannot cross.

A room is filled by cutting its inside into slots of about four tiles and
walking its kit into them, in order, skipping anything that has hit its count
or will not fit. So the amount of furniture is a property of the room's size
and nothing else. A bedroom at seven by six is a bed; at fifteen by twelve it
is a bed, a wardrobe, a rug, a desk, a plant and a second bed; past twenty by
sixteen it stops growing, because the kit says how many of each a bedroom
takes and the answer is never twenty beds.

Slots rather than fractions, because fractions scale the furniture with the
room — and a bed in a hall-sized bedroom should be a bed with more floor
around it, not a bigger bed.

The contents are laid again on release, not on every frame of the drag:
watching furniture flicker through every intermediate size is worse than
seeing it settle once.

A refit takes the wall's own centre and size rather than a box measured back
out of it. Measuring it back out is a trap: a shape's centre snaps to a tile
*centre*, so a room an even number of tiles wide has its edges on tile
centres, and rounding those to tile indices moves the floor a whole tile
sideways. Rooms an odd number of tiles wide never showed it, which is what
made it look random. Generated geometry is placed exactly for the same
reason — snapping is for a shape being dragged, and re-snapping one that was
computed against a grid is not a no-op.

Shapes say which room they are in, and a plan drawn before they did has that
recovered from the drawing itself on load: a room is a labelled wall and what
is in it is whatever sits inside it. Only the kinds a refit lays down again
are claimed — a door sits on the boundary between two rooms and belongs to
neither, and claiming one would delete it the first time either side was
resized. Without that ownership a refit cannot tell what to replace, so
moving a wall left the floor and the furniture standing where they were,
which does not read as *the fit-out did not follow* — it reads as the room
coming apart by a random amount, because the amount is how far you dragged.

Resizing a room shrinks or grows it about its own centre, so a room pulled
away from its doors is a room no longer joined to its neighbours. That is
what **Remove wall** is for.

### Words made of diamonds

`src/type.js` is a five-by-seven typeface where every lit square is one
diamond, emitted into the same instance stream as the roads and the walker.

There was already a way to draw text here — the marker sheet, a font baked
into a texture and cut a cell at a time — and it is the right way to draw a
symbol nobody has to read from across the room. It is the wrong way to put a
name on a plan: a textured glyph is a picture of a letter laid *over* the
lattice, and at any distance it reads as a different material, because it is
one. Written in diamonds a name is made of the town rather than printed on
it, breathes at the same rate, and costs no texture and no draw call.

It carries each room's number and name — **outside** the room, on a wall with
nothing built against it. Rooms in a generated palace are packed edge to
edge, so most of a room's perimeter is somebody else's room, and a caption
laid on one of those walls is written across the neighbour's floor. The four
sides are tried in turn and the first clear one wins, which for a plan of any
shape is always at least one, because a block has an outside. If every side
is taken it goes back inside at the top — the worst of the options, and the
only one always available.

It also carries the palace's name over its plan and the town's name across
the map.

A palace's name is a title block and goes above the plan, clear of it. A
town's name is a map label and lies *across* the ground it names: put above
the town it would sit off the edge of everything you had drawn, which is to
say somewhere you would have to go looking for it. The field at the head of
the route panel names whichever of the two you are standing in.

### A title in a font

The 5×7 face is the working type, and at five by seven there is no room for
a second one. A *title* is the one word on the plate that gets to be
lettering rather than a label, and lettering has a face — so the heading
can be set in any Google Font, and it is still made of diamonds.

`src/title.js` is the wallpaper tool's lattice-type recipe, lifted whole:
the name is drawn in the font onto a canvas at three times the cell
resolution, lifted in brightness and contrast, sharpened, and read back one
cell at a time as ink; every cell with ink in it becomes one diamond, sized
and lit by how dark it is, through the same `put` the roads and the walker
go through. The letterform came from a font; nothing that reaches the plate
did. The tool's screens — dots, Bayer, Floyd — are deliberately not here:
the diamonds are the halftone, and the recipe Eden settled on had that
switch at *none*.

Pick the face in the **Town** / **Palace** panel in build mode, from the
menu under the name. The shelf is `FONTS` at the foot of `src/title.js` —
Fleur De Leah first, which is what a profile that has never chosen gets —
and adding a face is adding Google's name for it to that list; the last
row, *The diamond type*, is the 5×7 face. It is a list rather than a field
because a family has to be spelt exactly as Google spells it, and a name
one letter off draws the diamond type with no way to tell why. The name
and the face it is set in are one decision, so they are made in one place;
the treatment, border, Bright and Jitter stay under *Heading* in the
palette. It is one setting worn by the town's name and every palace's
name alike, like the treatment and the border, and the border, Bright and
Jitter go on round a font title exactly as they do round the diamond type;
only the treatment steps aside, because a face carries its own tone.

Under **Heading** in the palette, below Bright and Jitter, are the font's
own five, live only while a font is in force: **Size** is cells per
letter — the title's diamonds are always the plate's own, the same pitch
and the same size as the road beside them, so a bigger name is simply
read at more of them; **Weight** scales every
diamond, and is the one to reach for when a thick stroke shows a lattice
through it — a diamond a shade wider than its cell leaves a hole at each
corner, and inside a stroke those holes line up into grid lines, which
close past about 1.15×; **Tone** is how far a diamond's size and light
follow the ink under it, 1 the tool's look and 0 every diamond the same;
**Dither** is how much of the tool's Bayer threshold is applied; **Mat** is
how far the plate under the name is dimmed so it reads over whatever it
lies across — an oval of ground-coloured diamonds around the name, full
at its centre and falling off toward its rim; **Feather** is where that
fall-off begins, from a hard edge at the rim (0) to a fade that starts at
the word's very centre (24). The first thing dropped if the instance cap
is short. **Shade** is a sheen down the lettering — how much darker the
foot of a word is than its top — worn by the bag's cards as well. Weight rests at 1 and Tone at 0: a title diamond *is* a plate
diamond, the same pitch and the same three-quarter-cell size the lattice
is drawn at, so a name is made of exactly the stuff the road beside it
is. Stored as `hq.title.<name>`.

The bag's row cards wear the same face: a card's number or letter is the
heading's font read through the same recipe, drawn as an inline SVG of
rhombi in the card's own colour (`Title.svg`), so the bag and the plate
say the same word the same way. The bag is a page rather than the plate,
which is why it is SVG there and instances here; the text stays under it
until the font lands. Stack cards keep their small corner tag.

A card's **picture** is lattice too. A stack card with a picture attached
does not show the photograph: the picture goes through the same two stages
the locus preview and the map go through — `Lattice.analyse` for tone and
edges, `Lattice.compose` for each cell's face and colour — and
`Title.picture` reads the dense face back as cells, which `Title.paint`
draws as diamonds into a canvas on the card, colour per cell from the
source, on the plate's own dark ground under the frame. The tune is the
locus preview's (`PIC` in `src/title.js`): a picture should arrive here
looking as it does there. Read at 56 cells across, kept per card key so a
deal does not read it again; attaching a new picture reads it afresh.

A stack card's corner tag is its **word**, with the slot as a mark on the
left — ◆ a person, ▲ an action, ● an object — and says the slot and the
number only until there is a word. The stack lays each new card over the
last, so the newest is whole and the rest show their tags.

A card keeps a **hand** of pictures, not only the last one. Click a stack
card that has a picture and **the still** opens: the picture large, ◀ ▶
(or ← →) to walk the hand, and the wallpaper tool's own knobs under it —
Tone, Contrast, Invert, Edge, Detail, Weight, and Full colour or Bone.
**Keep** (or Enter) deals the picture you are looking at, at that tune,
onto the card; nothing on the card changes until then, and ✕ or Esc
leaves it as it was. **Add a picture** puts a file into the hand without
dealing it; dropping a file on a card outside the still still deals it at
once. **Drop this one** takes a picture out of the hand (a card keeps at
least one). The hand lives under `<key>:alt:<n>` in the picture store and
`hq.bagpics` says how many, which is dealt and how it is tuned; the dealt
one is also written under the card's own key, so everything that reads one
picture per card goes on doing so.

Every card wears the floral frame in `assets/card-frame.png` — as a mask,
not a picture: the shape is the PNG's alpha and the ink is the card's own
colour, so it is dim at rest, bone once done, and inverts with a held
card, and the blue it was drawn in never reaches the page. It is
stretched to the card, which squeezes the art's 0.85 to the card's 5:7 on
purpose. Chromium refuses a `file://` image as a mask (CORS), so
`tools/frame.py` bakes the alpha into `src/frame.js` as a data: URI —
re-run it when the art changes, as with the building sheets.

The font is fetched from Google the first time it is named, so it needs the
network once per session. Until it lands the 5×7 type draws; a family Google
does not have leaves the 5×7 type standing and says so, and the menu is
struck through. `hq.title.font` holds the family, or `none` for the diamond
type chosen on purpose; a profile with no key at all gets the default. A name is drawn at most 160 cells across, so a long name in
a fine script will be finer than a short one. A name too wide for the
town at the plate's pitch is let shrink, because a title off both edges
names nothing.

## The route, and playing it

A room's markers are its **loci**: numbered places, each holding a picture of
whatever stands there. One is a hand statue, two is a sculpture of Roman
faces, three is the television, four is the fireplace. That is the whole of
the method — the order is fixed, and each place in it holds an image.

Build mode shows **the route** in its own panel, opposite the palette, headed
**Town** out on the map and **Palace** inside one — the panel names the place
you are standing in and the face its name is set in, and lists what it
holds: out on the town the rooms in order, inside one that palace's loci.
`▲` and `▼` move an entry along the run, and the numbering stays dense and
1-based — delete the third of five and you have four, not a gap at three. The
number is drawn beside the marker on the plan, because a memory palace *is*
its order and a plan where you cannot see it is a plan you cannot check.

The order is set by hand rather than derived from where a marker happens to
sit. That is not a shortcut not taken: the loci have to be walked in the same
sequence every time or the method does not work, and a sequence inferred from
geometry changes the moment you nudge something.

`Enter` on a locus **opens** it. With a picture attached you get it rendered
as lattice — which is not a thumbnail of the photograph but the thing the
platformer will actually hand you, the same diamonds through the same tone
pass, so what you are looking at *is* the level. With nothing attached yet it
opens a file picker instead, because a locus with no picture is a locus you
have not finished writing. `R` replaces the picture, `Esc` closes, and
dropping an image on an open preview attaches it.

So `Enter` means the same thing everywhere and what it opens depends on where
you are standing: on the town a marker is a door into a room, and inside one
it is a locus holding a picture.

The pictures live in their own IndexedDB store, not in localStorage — a
photograph is hundreds of kilobytes against a five megabyte budget shared
with the whole town, and that failure would land on the town rather than on
the picture that caused it. They are downscaled to a long edge of 1200 on the
way in, which is more than anything downstream wants.

### Playing it

`P`, or **Play the route**, hands the run to `platformer.html`: every room in
the town's order, and inside each one every locus in its own, flattened into
the sequence of pictures you run through.

What it plays is the platformer's own game, not a slideshow. Two pictures are
on screen at once — the left one whole, the right one **empty**. Clusters of
colour surface in the left one; the diamond runs and jumps and climbs to
reach them, and carrying one over reveals a proportional share of the right.
The left loses exactly what it gives, so **you are building the next picture
out of the one you are standing on**, and the view pans steadily left as you
do, from the source to what you have made of it. Emptying the source is the
same event as completing the destination — there is no separate win condition
that could drift out of step with it.

The pictures are grouped as a **chain**, which is the one thing the route
changes. The built-in deck is disjoint pairs — 0 and 1, then 2 and 3 —
because it is two pictures that belong together. A route runs 0 into 1, then
1 into 2, then 2 into 3: the picture you just finished building is the one
you empty next, so the same diamonds carry all the way along the run. That is
the walk through the palace, and it is why a route of n pictures is n−1
scenes.

Scenes advance **on completion**, not on the deck's timer, for the same
reason — a route is a sequence you finish rather than a deck that drifts.
After the last one it hands you back to the builder: closing this window if
the builder opened it, because two builders sharing one profile is how you
lose an edit.

A route of one picture has nothing to carry into, so it is shown on its own
with no game. Two is the minimum for a transfer.

The platformer is otherwise the halftone platformer, unchanged: the picture
is the level, thresholded into a static map that is the only thing collision
reads. Open it on its own and it still plays its own deck. What is new is the
deck hook and the chain.

That hook exists because of one measured fact: **every `file://` page
in this browser shares a single origin**, so a second page can read this
one's storage directly. No iframe, no message passing, no build step. The
route is handed over in two halves because the two are wanted at different
moments — the *order* goes to `hq.deck` in localStorage, which is synchronous,
so the page knows how many faces there are before it builds anything; the
*pictures* stay in IndexedDB and are fetched once, before the faces load.

Only loci that actually have a picture are handed over. Quietly shipping a
blank one would read as the platformer being broken rather than as a locus
you had not finished.

Upstream for the runner is `~/Projects/halftone-platformer`, which remains its
own project; `platformer.html` here is its shipped artifact plus the deck
hook. The two were always meant to converge — `docs/LATTICE-CONTRACT.md` over
there records what they already share, and the one question it says cannot be
deferred is whether a **cell** collides or a **tile** does. This is the answer
in practice: a plan is authored on tiles and the pictures bake down to cells,
which is exactly the resolution that document guessed at.

## Pausing

The game pauses when the window loses focus, which means you pause it by
clicking away — and that is the common case, not `Esc`.

**A click anywhere resumes it.** The click that brings the window back to the
front is the same click that should put you back in the game; asking for a
second one, aimed at something, is asking you to dismiss a screen you never
asked for.

`Esc` is **back** and only back: the locus preview, then the room list, then
the tune panel, then out of the interior — and in the platformer, out of the
run and into the builder. It used to close the pause as well, and because you
pause by clicking away that mattered: paused inside a palace, every press of
`Esc` walked you up a level behind a screen you could not see past, and you
arrived at the town before the menu went. A screen that owns the view has to
be the thing dismissed first.

With nothing left to go back from, `Esc` opens the reference — which is the
same screen, and says on it how to leave.

## The desktop plate

The game doubles as a live wallpaper. `./wallpaper.sh start` puts it there,
`stop` takes it down, `restart` does both, and `uninstall` stops it and takes
the KWin rule out with it.

    ./wallpaper.sh start [--fps N] [--dpr X]

It is a **window**, not a wallpaper, and it has to be: a Plasma wallpaper
takes no input at all, and the whole point is that you can click it and walk.
So it is an ordinary browser window pinned below everything by a KWin rule,
which `tools/kwinrule.py install` writes and `remove` takes away — the same
trick as the Typeset Earth overlay already on this machine. `start` writes
that rule — or refreshes the one already there, keeping its id — and asks KWin
to reconfigure. Every other rule in `~/.config/kwinrulesrc` is preserved byte
for byte, which is the whole reason the file is edited by hand rather than
with `kwriteconfig6`.

It runs on **its own browser profile**, `~/.cache/memory-quest-le-wall`, so the
plate is a second town rather than a second window onto the first one. Nothing
you build in the plate reaches the town you play, and nothing snapshots it.

Four query parameters shape it, all read in `src/game.js`:

    ?wallpaper   the mode itself: no HUD, no pause-on-blur (a background
                 window is never focused), and the drift
    ?fps=N       frame cap. 30 under ?wallpaper, uncapped without it; 0 is
                 uncapped either way
    ?dpr=X       render scale cap. 1.25 under ?wallpaper against 2 without —
                 the plate is the cheapest thing on the iGPU that it can be
    ?sleep=S     seconds of idle before it drowses again — 25, and only
                 ever consulted under ?wallpaper

`wallpaper.sh` sets the first three, and `--fps` and `--dpr` are its flags for
the middle two. `?sleep` has no flag; it takes its default unless you open the
URL by hand.

**The game opens at the distance the town is worked at.** `fitW` — the plate's
width across the viewport — is close enough that one district fills the screen
and you cannot see what you are drawing it beside. Four notches of the zoom key
out from there is where the map is actually read, drawn and walked, so that is
where the game opens and where `0` comes back to. It is written as the notch to
the fourth rather than as a number, because it means *four presses of the zoom
key* and should go on meaning that if the notch is ever retuned.

The zoom itself stays where it was: build mode needs a close look at a corner,
and holding `Tab` still frames the whole plate. What changed is only where you
start and where you land, so nobody has to zoom to be looking at the right
thing.

**Drifting is the resting state.** With nobody steering, the camera crawls at
a fixed world speed toward a reachable tile picked at random, arrives, picks
another, and recrystallises the plate every twelve to nineteen seconds. Press
a movement key and it **wakes**: the camera goes back to following the walker
and the hint at the bottom fades out. Stop steering for `?sleep` seconds and
it drowses back into the drift on its own, which is the only reason the hint
is there to read again.

## Plates

The map never pans and never zooms: what is on screen is the town. When
the town needs more room it gets another **plate** — a second screen the
same size as this one — and plates are joined where **roads end**. Walk
to the end of any road and press on: if that end leads somewhere you
arrive there; if it does not, a prompt asks whether to open a plate for
it (`Enter` opens, `Esc` stays). A new plate is drawn as though it lay the
way the road was heading — you arrive on its opposite edge in the same
column, on a stub of your road running in, so you are standing on ground
and the road visibly continues. Every dead end is its own doorway: a town
may have many roads, long or short, and each can lead to a plate of its
own. Pressing sideways off a road mid-way never asks; only a real end
does.

The plate is the printed sheet plus a strip of plain ground down the
right — `PLATE_EXT_COLS` lattice cells of it, 64 today — because the sheet
is taller than it is wide and the window is the other way round. Measured
in cells so the pitch the town is built at does not move; the tracing
underlay stays anchored to the sheet, not the plate.

The plate is the map, and nothing is drawn past its edge: a line's
points and an area's centre are held inside it on every edit, because a
road drawn into the margin beside the plate is a road the walker stops
short of. Build mode draws the edge, faintly, so you can see where the
town ends and the next plate would begin. Each plate
is its own town under its own keys — shapes, markers, sparks — and the
palaces inside markers are shared by all of them. The **compass** at the
bottom of the HUD opens the mind map: every plate laid out by how it
joins, the one you are on inverted, click to stand on another. The home
plate is the town you had before plates existed, untouched.

Only the route carries the walker, and the route is one flood from where
the walker stands, so a road laid somewhere that flood does not reach is
a road nothing can walk. Build mode says so: a road not joined to the
network is framed in gold, and selecting it puts the reason in the palette.
Join it to a road the walker can reach and both go away.

### The journal

Beside the hub's flare diamond stand two more: an **aqua** one for the
journal, below, and a **bone** one that is the `B` key — build on, or off
again — drawn hollow while build is on, the plate's own face for "here
but open". Aqua, because it is STYLE.md's one cool note: asked for as
blue, and aqua is the blue this palette has. Press the aqua one and the
journal opens: a page of tabs (Quest, Skills, Health, Equip,
Status), each tab a few sub-tabs, each sub-tab rows of letters — acronyms
— and behind every letter a note: what it stands for, and what you have
to say about it. Pick a letter, type, and it is kept under `hq.journal`
by where it is (`Skills/Music/1/3` — tab, sub-tab, row, column). ← →
change the tab while nothing is being typed; Esc closes. The tabs and
their letters are `SECTIONS` at the head of `src/journal.js`: adding a
tab is adding a row there, and a letter moved keeps no note, which is the
trade a key that names a place makes.

### The bag

The HUD's left ring, `123`, opens the **number system**; its top ring,
`abc`, opens the **letter system**. They are one page — `src/bag.js` —
with a different set of labels on the cards, and nothing else differs.

The page lays a row of cards over the town, one per number or letter,
and down the right rail runs the **stack**, laid like a solitaire column:
each card a step below the last, so a covered card shows its tag. The
row deals into the stack. The first card you press — click it, or walk
to it with `←`/`→` and press `Enter` — goes down as its **person**; the
next, whatever number and from either system, as its **action**; the
next as its **object**; then a gap, and a person again, and round. So
`1 5 3` is 1's person doing 5's action to 3's object, `1 B 3` borrows
its action from the letters, and `1 1 1` is 1's own three — the only
time one label sits over itself is when you dealt it twice. Every
number has one person, one action and one object; the stack is the
order you drew them in. Every card takes a picture and a word: click it
in the stack, or drop an image on it, and the picture is the card's face
from then on with the tag kept in its corner; the word is typed along
its bottom edge (`Enter` to finish). The stack holds — through other
rows, the other system, closing the page, closing the game — until you
take it back: `undo` or `Backspace` for the last card, `clear` for all
of it. A row card that is in the stack shows in bone. Every card is one
size, at 5:7. The row sits between two **rails**: the left holds the
switch between `123` and `abc` and the slider; the right holds the
stack.

The page shows one row of five at a time, and the **slider** down the
left rail is the way between rows: `1` at the top, `100` at the bottom
(`A` to `Z` for the letters) — drag the thumb, press the track, press the
`▲`/`▼` at its ends or `↑`/`↓` on the keyboard for the next row of five,
and the row holding that number comes up. `↑` past the top row puts the
keyboard on the switch, where `←`/`→` change system and `↓` comes back.
The head counts what is filled out of the whole system. `Esc` closes the
page from the row (off the switch first); the ✕ closes it outright. The town underneath is exactly where
you left it.

The pictures go into the locus store (`IndexedDB hq.loci`) under keys of
their own, `bag:numbers:3:action`, the words into `hq.bag`, and the
stack into `hq.bagseq`, so a
snapshot carries both.

### The missions

A stack that is whole — rounds of three, nothing left over — can be
**saved**, with the `save` chip above the stack. Saving takes the cards
out of the bag and into a **mission** on the missions page
(`src/missions.js`; `saved`, beside `save`, opens the page any time). A
mission is the cards in their order, and around them what the bag never
asks: what it is **for** — birthday, ID number, workflow, reminder,
other, and a line of your own — which **palace** it is walked in (any
marker on the town), **notes** of any length, and the count: the day it
was **added**, how many times it has been **run through**, and the
**last run**. `run` counts a run and deals the cards back into the bag to
be read; `delete` asks twice. `Esc` is back to the bag. Missions live
under `hq.missions`, so a snapshot carries them.

## Walking

The walker is on the route network, not on open ground. Only `path` tiles
carry you — the map's own printed routes, and any road you draw — so it can
never wander across a field or off the map. Everything else is scenery until
something is drawn across it; a path or trail kind can come later.

Routes do not run on the grid, so neither does walking. Press a direction and
if the route runs straight that way you step straight; if it turns, you take
the diagonal that still goes the way you asked, preferring the one that
carries on the way you were already going. A diagonal is a longer stride and
takes proportionally longer, so speed along the line stays even.

Movement and reachability share one function, so a spark is never placed
somewhere the movement rule cannot actually take you.

A road narrower than a walk tile used to stamp a dotted line of walkable
tiles — and a roundabout you could not get round. Routes now stamp by
distance, with a tolerance of half a tile, so a ring road is continuously
walkable all the way round.

## Tuning

`T` opens the panel. **Copy settings** puts a `let T = {...}` line on the
clipboard — paste it over the `defTune()` return in `src/game.js` to bake a
look in as the default.

### Glow

**Glow** is the opacity of every halo on the plate at once — the walker's, the
sparks', the rings', a marker's — as one uniform the fragment shader applies
to the halo branch. It defaults to 45%: the full-strength bloom reads as
dramatic against a printed map and as *too* dramatic against a blank one.

It is the one row in the panel that rebuilds nothing. Glow is a uniform the
frame loop already sets every frame, so re-composing 112,982 cells to answer
a slider drag would be pure waste — hence the `live` flag on its row.

A `T` baked in with **Copy settings** before this row existed simply has no
value for it, so the panel falls back rather than writing `NaN` into itself.

### The walker

The walker carries its own scale — `WALKER` in `src/game.js`, currently
`1.35` — rather than inheriting the walk tile the way sparks and rings do. It
is the one thing on the plate that is not terrain, and on a blank sheet with
nothing around it, a sprite sized to the tile is too easy to lose. The
screen-space floors scale with it, so it holds its size in the overview too.

### The plate: Map or Blank

**Plate** at the foot of the panel chooses what the lattice is made of.
**Map** is The Mighty Haunt, the printed sheet in `assets/map.js` — 112,982
cells. **Blank** is an empty sheet: a builder wants to start a new town as
often as it wants to start from the printed one.

Blank destroys nothing. The source art is untouched on disk, `compose()`
simply returns an empty buffer, and the classifier's reading of the printed
map is kept in `G.terrPrint`, which nothing ever writes to — so `Map` puts
all 346 route tiles back on a restamp. The setting persists in `hq.blank`.

It takes the printed *routes* with it, which is the point and the catch:
walking needs `path` tiles, so on a blank sheet **the walker cannot move and
no spark can be placed until you draw a road**. The HUD reads `0/0` and that
is correct, not broken. Draw one road and the round fills in.

Changing the plate changes the map, so the round is dealt again rather than
patched — and it has to be dealt from the round's own count, because
`scatterSparks()` ends by setting `G.total` to however many it managed to
place. On a blank sheet that lands at zero, and without putting the count
back nothing would ever be placed again. `spawn()` is deliberately not called
on the way through: it recentres the camera, and the view jumping out from
under you while building is worse than a walker left standing where it was.

An empty plate is never handed to GL as a zero-length upload — `batch()`
takes the instance count to zero and leaves the buffer alone.

Note `Edges` defaults to 0, matching the phone build, where the edge multiplier
was zero and the sobel pass never contributed. Raise it for a harder, more
drawn-looking map.

## If the page will not start

Three screens can come up in place of the plate, and they are three different
faults.

**"this build needs WebGL2"** — the browser could not make a WebGL2 context at
all. That is the rare one, and the only one where the browser is really the
answer.

**"graphics context refused"** — WebGL2 works in this browser, so it was
refused for *this window*. That almost always means a stale instance is still
holding the profile: close every Memory Quest Low Effort window and relaunch. `fatal()`
in `src/game.js` probes a fresh canvas before choosing between the two
headings, because *no WebGL2* is almost never true on a machine that had it a
minute ago.

Either of those adds a line when the page has loaded more than three times in
the last minute, because that is a relaunch loop and closing the windows is
the only thing that ends it. The load times are kept in `hq.loads`.

**"the lattice never finished building"** — the boot screen was still up eight
seconds after the loader ran. `boot()` is synchronous once the map picture
decodes, so that is a load which stopped rather than one which is slow, and
without the timeout *building the lattice…* would sit there for good. The
screen shows `hq.lastError` — the last runtime failure the page recorded, with
the time it happened — or says plainly that nothing was recorded.

`hq.lastError` is readable at any time, from devtools or over CDP, and is
worth looking at before anything else.

**There is no `?v=` stamp to bump.** Every script URL carries
`?cb=<BUILD>.<now>`, so the URL is different on every single load and a
browser that has cached an older build cannot serve it back. A stale script is
not what any of these three are.
