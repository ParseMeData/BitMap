# Memory Quest V4.2

Build a town out of diamond glyphs, over a real one.

A map is drawn as a field of diamonds that never stops breathing. You trace a
real place behind it — a frozen dark map you lay down by hand like tracing
paper — and build roads, districts, water and trees over it, then walk the
routes you drew.

    ./play.sh          # or: Memory Quest V4.2 in the KDE launcher

Started 23 Aug 2026 from **Haunt Quest** (`~/Games/lattice-haunt`), which
remains its own project. Everything here about the lattice, the renderer and
the build tools came from there; what is new is that the plate starts
**blank** rather than as The Mighty Haunt's printed sheet, so the town you
build is the only thing on it. The printed map is still in `assets/` and one
switch away — see *The plate: Map or Blank*.

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

### The half that is not in the repo

The source tree is the engine. The *town* — every shape, every marker, the
frozen tracing picture, the blank-plate flag, the floor plan inside every
building — lives in the browser profile the launcher uses, so a tag on its
own is only half a version. `tools/` writes the other half to a file beside
it:

    ./play.sh --remote-debugging-port=9222 &
    tools/snapshot.py save    snapshots/v4.0.json
    tools/snapshot.py restore snapshots/v4.0.json

`snapshots/v4.0.json` is the town as it stood at that tag, frozen picture and
all. Restoring is destructive — the profile *becomes* the file, so a room
built since the snapshot is removed rather than left behind, and the page
reloads. Snapshot the live state first if it is ahead of the file.

Every `hq.` key is taken rather than a list written down in the tool, because
an interior is one key per marker named after an id only that marker has, and
there is no fixed set of them.

`tools/cdp.py` is what talks to the running page: a few dozen lines of
WebSocket, because nothing else here needs a dependency.

## Controls

| | |
|---|---|
| `WASD` / arrows | walk (hold to keep walking) |
| `Shift` | sprint |
| `Space` | recrystallise the map |
| `Tab` (hold) | overview of the whole map |
| wheel, `+` `-`, `0` | zoom / reset zoom |
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
| `Esc` | close the locus &nbsp;·&nbsp; then the interior &nbsp;·&nbsp; then pause |

Clear every spark to finish a round; each round adds two more. Your best
clear time is kept in the browser profile the launcher uses.

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

    index.html      page, HUD, overlays, tune panel markup
    assets/map.js   the map, inlined as a data URI (keeps getImageData
                    working from file:// — a plain <img> would taint it)
    assets/map.webp the same art as a file, for reference
    src/render.js   WebGL2 instanced SDF renderer
    src/lattice.js  map → lattice: analyse (tone, sharpen, sobel) then
                    compose (pick faces + colour), and terrain classification
    src/kinds.js    the art style as components: noise, geometry, the cell
                    emitter, the palette, and one generator per terrain kind
    src/panel.js    tune panel, and the Map/Blank plate switch
    src/build.js    build mode: shapes, dragging, walk-grid stamping
    src/markers.js  glyph markers, baked to one texture atlas
    src/interior.js going inside a marker: the stack, and the swap
    src/loci.js     the numbered places inside a room, their pictures,
                    the lattice preview, and the route the platformer plays
    src/type.js     the diamond typeface: a letter is a 5x7 grid and every
                    lit square is one more diamond in the same stream
    src/palace.js   the room list, the layout it generates, the fit-out that
                    follows a wall, and the names drawn on the plan
    platformer.html the runner — the halftone platformer, which takes this
                    route as its deck when there is one (see Playing it)
    src/basemap.js  the tracing underlay, live tiles and frozen picture
    src/game.js     state, input, camera, entities, frame loop

`analyse` is the expensive half (~40 ms) and only re-runs when Detail, Tone or
Contrast move; `compose` is ~10 ms and runs on every recrystallisation, hidden
behind the burst.

## Building

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
district still lines up with something. A line's grips are its bends; a ring's
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

### Creek

A **creek** is a road's geometry carrying water. Drawing one *is* the road
editor — a polyline whose segments bow, a width, `Shift`-click to add a
point, and a ring if you want a moat — because the editor keys off a shape's
**type**, not its kind, so `types: ['line', 'ring']` inherits all of it for
free.

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
route opens in the walk grid.

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
leave the attribution in place.

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
threshold, two jambs, and the leaf and the arc it sweeps — drawn outside the
shape on purpose, because that sweep is most of what makes a plan read as a
plan. A door reaches a whole tile either side when it opens the walk grid:
everything snaps to tile centres and a wall's own band is half a tile thick,
and a door that looks right but silently does nothing is a far worse failure
than a doorway one tile deep.

Stamping order is what makes a plan behave, the same way it makes a bridge
work outdoors. The floor goes down first and carries you; furniture and walls
are laid over it and stop you; the door goes down last.

Sparks scatter on the floor you have drawn, so a plan is somewhere to play as
well as something to draw. An empty plan has nowhere to put any, and gains
them as the rooms go in — which is why the round tops itself back up on every
edit rather than only when one was stranded.

A marker with something built inside it wears a ring on the map, so a place
you can walk into looks different from a place that is only a note. The plans
live beside the town in the browser profile, under `hq.rooms.<marker>`, with
`hq.rooms` as the index of which markers have one.

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

**Rooms** — the only things that answer the pointer are the room shells and
the wall gaps, and the whole room is the handle rather than the quarter-tile
ribbon of its wall. Move one, resize one by its corners, and **its contents
are laid again for the shape it is now**. Make it bigger and the next slot
appears and fills; make it smaller and the slot goes and takes its contents
with it. Deleting a room deletes the room, not the four walls of one.

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

## The route, and playing it

A room's markers are its **loci**: numbered places, each holding a picture of
whatever stands there. One is a hand statue, two is a sculpture of Roman
faces, three is the television, four is the fireplace. That is the whole of
the method — the order is fixed, and each place in it holds an image.

Build mode shows **the route** in its own panel, opposite the palette. Out on
the town it lists the rooms in order; inside one it lists that room's loci.
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

Those nine lines exist because of one measured fact: **every `file://` page
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

## If the page ever shows "this build needs WebGL2"

That is almost always a stale script in the browser cache, not a missing
capability. Hard-reload with `Ctrl+Shift+R`. Script URLs carry a `?v=` stamp to
prevent it; bump it in `index.html` after editing sources.
