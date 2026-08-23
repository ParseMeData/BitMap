# Memory Quest V1

Build a town out of diamond glyphs, over a real one.

A map is drawn as a field of diamonds that never stops breathing. You trace a
real place behind it — a frozen dark map you lay down by hand like tracing
paper — and build roads, districts, water and trees over it, then walk the
routes you drew.

    ./play.sh          # or: Memory Quest V1 in the KDE launcher

Started 23 Aug 2026 from **Haunt Quest** (`~/Games/lattice-haunt`), which
remains its own project. Everything here about the lattice, the renderer and
the build tools came from there; what is new is that the plate starts
**blank** rather than as The Mighty Haunt's printed sheet, so the town you
build is the only thing on it. The printed map is still in `assets/` and one
switch away — see *The plate: Map or Blank*.

## Controls

| | |
|---|---|
| `WASD` / arrows | walk (hold to keep walking) |
| `Shift` | sprint |
| `Space` | recrystallise the map |
| `Tab` (hold) | overview of the whole map |
| wheel, `+` `-`, `0` | zoom / reset zoom |
| `T` | tune panel &nbsp;·&nbsp; Plate: Map or Blank |
| `B` | build mode |
| `M` | map underlay to trace over |
| drag / `Shift`+drag | move / turn the frozen map (in Place) |
| `Shift`+`Tab` | next layer (in build mode) |
| `R` | new round |
| `F` / `F11` | fullscreen |
| `Esc` | pause |

Clear every spark to finish a round; each round adds two more. Your best
clear time is kept in the browser profile the launcher uses.

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
    Ground      grass · water
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
