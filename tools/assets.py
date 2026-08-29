#!/usr/bin/env python3
"""── the asset folders on the desktop ───────────────────────────────────
Every printed thing the game can put on a plate — the houses and buildings
of the two sheets, sliced into src/glyphs.js — written out as one PNG each
into folders by type, so they can be looked at, sorted and added to by
hand (Eden, 2026-08-29):

    ~/Desktop/Loci Assets/
        Houses/      Buildings/     Trees/     Mountains/
        Landmarks/   Patterns/      _sheets/   README.txt

    tools/assets.py export            # glyphs.js → the folders (8× scale)

Each PNG is the glyph at eight screen pixels per cell — a lit cell in bone,
a '2' cell (the building's own ground: a window, a doorway) in the plate's
ground colour, everything else transparent — so a file browser shows it.
What is in `sets.houses` goes to Houses; every other glyph to Buildings.
The two source sheets are copied to _sheets/ untouched. Nothing here reads
the folders back yet: the game still ships src/glyphs.js, cut from the
sheets by tools/glyphs.py — importing from these folders is the next step.
"""
import json, pathlib, shutil, sys
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path.home() / 'Desktop' / 'Loci Assets'
FOLDERS = ['Houses', 'Buildings', 'Trees', 'Mountains', 'Landmarks', 'Patterns', '_sheets']
SCALE = 8
BONE = (237, 234, 227, 255)
GROUND = (27, 27, 33, 255)

def table():
    s = (ROOT / 'src' / 'glyphs.js').read_text()
    i = s.index('/*DATA*/') + len('/*DATA*/')
    depth = 0; j = i
    while j < len(s):
        c = s[j]
        if c == '{': depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0: j += 1; break
        j += 1
    return json.loads(s[i:j])

def png(rows):
    h = len(rows); w = max(len(r) for r in rows)
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = im.load()
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == '1': px[x, y] = BONE
            elif ch == '2': px[x, y] = GROUND
    return im.resize((w * SCALE, h * SCALE), Image.NEAREST)

def export():
    D = table()
    for f in FOLDERS: (OUT / f).mkdir(parents=True, exist_ok=True)
    houses = set(D.get('sets', {}).get('houses', []))
    n = {'Houses': 0, 'Buildings': 0}
    for name, rows in D['glyphs'].items():
        folder = 'Houses' if name in houses else 'Buildings'
        png(rows).save(OUT / folder / f'{name}.png')
        n[folder] += 1
    for sheet in ['buildings-a.png', 'buildings-b.png']:
        src = ROOT / 'assets' / sheet
        if src.exists(): shutil.copy2(src, OUT / '_sheets' / sheet)
    (OUT / 'README.txt').write_text(
        "Loci Assets — the printed things the game can put on a plate.\n\n"
        "One PNG per glyph, at 8 screen pixels per cell: bone is a lit cell, the dark\n"
        "grey is the building's own ground (a window, a doorway), transparent is\n"
        "nothing. Sort them by moving files between the folders; add new ones as\n"
        "PNGs on the same scale (any size up to 32x32 cells).\n\n"
        "Houses/     Buildings/     Trees/     Mountains/     Landmarks/     Patterns/\n\n"
        "_sheets/ holds the two source sheets the game is cut from today\n"
        "(tools/glyphs.py). The game does not yet read these folders back —\n"
        "that is the next step; until then the sheets are what ships.\n"
        "Written by tools/assets.py in ~/Projects/memory-quest-le.\n")
    print(f'wrote {OUT}: {n["Houses"]} houses, {n["Buildings"]} buildings, sheets copied')

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'export'
    if cmd == 'export': export()
    else: sys.exit(__doc__)
