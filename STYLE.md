# Style

The look, written down, because it is the one thing about this project that
cannot be re-derived from the code by someone trying to improve it.

`HANDOFF.md` lists the decisions that would be got wrong. This lists the
*values* that would be got wrong — the ones a fresh pair of eyes will read as
arbitrary, and round off. They are not arbitrary. Every number below was
chosen, and the whole reads as one thing only because none of them drift.

Rule: **new work is flair on top of the plate; it is never a change to the
plate.** If a change would move a value in this file, it is the wrong change —
not a trade-off to weigh.

---

## The atom

A **diamond**. One quad, shaded as a signed distance field, so it stays crisp
at any zoom and costs no texture and no sprite cache (`src/render.js`).

Everything is made of it, and that is the whole style. Grass is diamonds. A
road is diamonds. A wall is diamonds. A **letter** is a five-by-seven grid of
them, emitted into the same instance stream as the roads and the furniture
(`src/type.js`) — so a name on a plan is made *of* the town rather than
printed *on* it, and it breathes at the same rate. A **title** may be set in a
real font (`src/title.js`), and the rule holds: the font is read back one cell
at a time and every cell of ink is one diamond in the same stream. The
letterform is the font's; the material is the plate's.

Nothing is ever drawn as a sprite, an icon font, an emoji or an SVG on the
plate. The moment something is drawn out of a different material it reads as a
different material, at every distance. The only textured glyphs in the whole
game are the marker symbols, baked to one atlas — symbols nobody has to read
from across the room.

---

## The lattice

One pitch, one proportion, one way in. Anything that is halftoned, latticed
or bitmapped — the plate, a title, a card's picture, the compass, the towns
map, and whatever comes next — is the same material, and the material is
these three numbers. Measured on the live town at v7.8, not chosen:

    cell        3.1458 world units — the plate is 240 × 228 of them, and a
                walk tile is four. `G.A.cell`, from `Lattice.analyse`,
                built once at boot and shared by the town and every plan
                inside it. There is no second lattice.
    on screen   3.17 CSS px a cell at fit-all, 5.33 at the town's reset zoom
                (DPR 1). A lattice drawn in chrome takes the plate's cell at
                the zoom the town is read at: about three pixels a diamond.
    diamond     half-size = 0.75 × cell, times a weight that rests at 1.
                `0.75` in the shader (`render.js`), `PLATE = 0.75` in
                `title.js`. Neighbours overlap by design; that is the
                breathing.

**The rule.** New work that wants the effect does not draw diamonds. It
hands cells to the one path that does — the GL stream for anything on the
plate, `Title.paint` for anything in chrome — and a picture becomes cells
only through the tone pass (`Lattice.analyse` / `compose`). Nothing may:

- typeset a diamond from a font (`◆` `◇`), draw one as a sprite, an SVG or a
  CSS shape, or fill a cell as a square;
- choose its own pitch. The pitch on screen is the plate's. A map that must
  show more than the screen has pixels for strides the *data* — every kth
  cell — and keeps the diamond where it is; a picture that must fit shrinks
  its *cells*, never its diamond ratio;
- choose its own proportion. Half-size is 0.75 × pitch. What varies is the
  weight, and only within the one table below;
- ink a cell in anything but the ten tokens, at alpha.

**Weights, the whole list.** A weight is the one number a feature may own,
because a thing read across the room wants a slightly heavier dot than a
thing read up close. Add a row here or do not use a new one.

    plate, titles, type       1.00   rest; a title's Weight slider ranges over it
    bag card pictures          .65   settled by Eden at v7.1
    compass                    .80   rests; Eden's tune sits at .45 (hq.compass)
    towns map                 1.00   the land; edges and dots the same

**Where it is checked.** `G.A.cell` is the cell; `Title.paint` is the
chrome path; the compass's *Detail* slider and a title's *Size* both read
as "cells", never as a pitch, so no slider can move the diamond. If a change
would put a fourth number beside the three above, it is the wrong change.

---

## The chrome palette

Ten tokens, declared once in `index.html`, and there is no eleventh.

Six that speak:

    --ground   #08080B    the plate, and the ground under every panel
    --bone     #EDEAE3    primary text; and the ground of anything selected
    --dim      #5A5A66    labels, secondary text, everything not being said
    --flare    #FF5FA2    the pink — panel heads, slider thumbs, the walker, error
    --gold     #F2C14E    the amber — messages, locus numbers, warnings
    --aqua     #79E0D8    the one cool note, spent only on route dots

And four that are quiet, for the places where the six would be too loud:

    --well     #0D0D12    the ground of every input and textarea
    --faint    #3A3A44    placeholders, and the faintest text still worth reading
    --thumb    #26262F    scrollbar thumbs
    --unlit    #2A2A33    a route dot with nothing behind it yet

**Every colour in the stylesheet is one of those ten, and every one of them is
declared in `:root` and nowhere else.** That is the invariant, and it is worth
more than the names: a hex literal appearing anywhere below `:root` means a
colour has been introduced without a decision being made about it.

And one family of hairlines, `rgba(237,234,227, α)` — bone at low alpha, never
a grey of its own:

    .08 .12 .14    hover grounds
    .18 .2 .22     borders
    .3  .5         a border that is emphasised, or selected

One hairline is a gradient: the bag's card edge sweeps around each card
from `.42` at the top down both sides to `.08` at the bottom — alphas from
the family above and below it, with the fade between, drawn as a 1px ring
under the card. It is still bone; what it is not is a grey.

**Do not introduce a colour.** If something new needs to be distinguished, it
is distinguished by one of the six, by position, or by weight of alpha. The
palette is small on purpose: six colours is a place, twelve is a control panel.

---

## Type

    family     --mono, and only --mono
    weight     400. Only ever 400.
    size       7px to 14px
    tracking   .02em to .5em, widest on the shortest words
    numbers    font-variant-numeric: tabular-nums, wherever a number can change

**`<b>` means colour, not bold.** Every `b` in the CSS sets
`font-weight:400` and a colour. There is no bold text anywhere in this game,
and adding some is the fastest way to make it look like a different program.

Chrome text is uppercase and widely tracked. Content the *user* typed — a room
name, a place name, a map query, the credit line — is not: it keeps its own
case and drops to `.04em`–`.06em`. That contrast is the whole information
design. Labels are shouted and quiet; your words are spoken and bright.

Nothing is larger than 14px. The Paused heading, at 14px with `.5em` of
tracking, is the largest text in the game, and it is a heading only because it
is spaced out — not because it is big.

---

## Chrome

    .glass     rgba(8,8,11,.72) + 1px solid rgba(237,234,227,.18)
               + backdrop-filter: blur(12px) saturate(1.05)

Every floating panel wears it. It is the only panel treatment there is.

**No border-radius. Anywhere.** Not on a panel, not on a button, not on an
input, not on a chip. The square corner is the signature, and it is the single
change that would most obviously make this someone else's game. Confirm it any
time with:

    grep -rn border-radius index.html src/        # expect nothing

**Every border is exactly 1px.** Twelve `border:1px` and one `border-top:1px`,
and no other width.

**Selection is inversion**, never a highlight or a tint:
`background:var(--bone); color:var(--ground)`. A selected chip becomes a hole
punched in the panel. Hover is the faintest bone wash, `.08`–`.14`.

**One shadow exists** in the entire stylesheet — the gold glow under `#msg`,
`text-shadow:0 0 18px rgba(242,193,78,.5)`. There is no box-shadow at all.
Panels are separated by their border and their blur, not by lift.

**One duration exists**: `transition:background .12s,color .12s`. Nothing else
moves, and nothing has an easing curve. The exception is the wallpaper hint's
`opacity .6s`, which fades a hint in and out precisely because it is not
chrome. Do not animate a panel opening. Do not add a spinner. The lattice is
already moving; anything else that moves competes with it.

---

## The plate palette

The chrome palette and the plate palette are different things, and the plate's
is not restricted to six. Each kind carries a `swatch` — the colour of its
chip in the palette, and the key its terrain is generated around
(`src/kinds.js`). Two registries, swapped by `Kinds.use(scope)`:

**The town**

    grass     #5C9648      water     #2E66B8      creek     #3E7FBF
    trees     #2A6640      park      #7BB86F      road      #FFFFFF
    buildings #B7B0A5      houses    #C9A488      river     #3E7FBF
    demolish  #3A3A44

River shares creek's swatch deliberately — the swatch is the key a kind's
terrain is generated around, and a river is generated around exactly creek's.
Demolish shares the remove-wall grey for the same reason the floor's does: a
tool that draws nothing of its own should not arrive wearing a colour.

**Inside a building**

    floor     #9A7A52      rug       #94383F      pool      #2E66B8
    counter   #A9ABAF      table     #8A6438      bed       #DDDAD3
    sofa      #52638A      shelf     #7F5C3C      plant     #3E7A3A
    wall      #E4E0D5      window    #85C7DB      door      #F2EDE2
    stairs    #C39A5C      remove wall #3A3A44

These are muted, and desaturated against the near-black plate on purpose: the
town has to read as a *printed map at night*, not as a game board. A saturated
kind added to this set will not look like one more kind — it will look like the
only thing on the screen.

Density is part of it too, and is documented at the head of `src/kinds.js`:
ground cover is laid dense and low-resolution so it reads as a field; anything
built is drawn as structure on top of it, with an internal pattern rather than
a wash of noise.

---

## Modes that change the look on purpose

**Wallpaper** (`?wallpaper`, `body.wall`) — all chrome gone, one hint at the
bottom that fades unless the walker is drifting. There is no other chromeless
mode, and this one exists because the game doubles as a live desktop.

**Locus open** (`body.locus`) — HUD, keys, palette, route and the rest are
hidden, so one photograph and its number own the screen. A modal look without
a modal.

**Rooms vs fit-out** (`body.rooms`) — the tools that place things inside a room
are not disabled while the plan is being moved, they are *removed*, because the
promise is that nothing inside a room can be touched until the plan settles.

---

## Checking

The style is small enough to verify by grep, and doing so beats reading:

    grep -rn border-radius index.html src/                 # nothing
    grep -oE '(box|text)-shadow:[^;}]*' index.html         # exactly one
    grep -oE 'font-weight:[^;}]*' index.html               # all 400
    grep -oE 'transition:[^;}]*' index.html                # .12s, and one .6s
    grep -n  '#[0-9A-Fa-f]\{6\}' index.html               # only ever the :root block
    grep -oE '#[0-9A-Fa-f]{6}' index.html | sort -u        # exactly the ten

And the rule the project already holds itself to, which applies double here:
**only a picture proves it looks right.** `Page.captureScreenshot` over CDP,
against a throwaway profile — never the live town.
