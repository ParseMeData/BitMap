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
    tools/assets.py slice             # the desktop's own picture folders →
                                      # one PNG per sprite, same scale
    tools/assets.py import            # the folders → src/glyphs.js: every
                                      # folder a set, every PNG a glyph

`import` is what makes the folders the game's: each folder under Loci
Assets (not _sheets) becomes a set named for it in lower case — houses,
buildings, trees, plants, icons, signs, distractions, patterns,
mountains, landmarks — and each PNG in it a glyph named for the file,
read at eight pixels a cell: bone is lit and EVERYTHING ELSE IS NOTHING
— transparent, and the plate's own ground grey too, so a PNG exported
before 2026-08-30 (which carried the sprite's inside as solid GROUND
pixels) reads back as the drawing alone and not as a dark slab. The box
is then trimmed to the drawing. `src/kinds.js` offers each set as a
print kind in the palette.

`slice` reads every image in the folders beside Loci Assets on the desktop
(trees, plants, houses, signs, icons, distractions, patterns — whatever is
there), finds the picture's background (its commonest colour) and the
pixel pitch the art was upscaled by (the phase-vote glyphs.py uses), reads
the art back at its own resolution as lit-or-not, cuts it into connected
sprites, and writes each as a PNG at the same eight-pixels-a-cell scale
into a folder of the same name under Loci Assets. A sprite bigger than
the glyph grid (32 cells) is cut into 32-cell pieces, numbered.

Each PNG is the glyph at eight screen pixels per cell — a lit cell in
bone and every other pixel FULLY TRANSPARENT (2026-08-30) — so a file
browser shows the drawing and nothing behind it. The building's own
inside (a window, a doorway) used to be written in the plate's ground
colour, which made most of an icon or a pattern an opaque dark slab.
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
    """One glyph out as a PNG: bone where the art is coloured, and NOTHING
    anywhere else — every other pixel is fully transparent (2026-08-30).

    A '2' cell used to be written here as a solid GROUND pixel, so an
    exported asset came out with an opaque dark background — most of one
    for the icon, pattern and plant sets, which were about two thirds '2'.
    There is no '2' any more (see tools/glyphs.py's `body`), and a stray
    one in an old file is treated as what it always was: not the drawing."""
    h = len(rows); w = max(len(r) for r in rows)
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = im.load()
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == '1': px[x, y] = BONE
    return im.resize((w * SCALE, h * SCALE), Image.NEAREST)

# ── slicing the desktop's pictures ────────────────────────────────────
import math
from collections import Counter
CAP = 32
CAP2 = 64            # a sprite finer than the grid is kept to here as its DETAIL

def background(im):
    """the commonest colour, on a coarse quantisation"""
    small = im.convert('RGB').resize((min(im.width, 200), min(im.height, 200)))
    q = Counter((r // 16, g // 16, b // 16) for r, g, b in small.getdata())
    r, g, b = q.most_common(1)[0][0]
    return (r * 16 + 8, g * 16 + 8, b * 16 + 8)

def lit_mask(im, bg, thr=70):
    im = im.convert('RGB'); W, H = im.size; px = im.load()
    out = bytearray(W * H)
    for y in range(H):
        for x in range(W):
            r, g, b = px[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > thr: out[y * W + x] = 1
    return out, W, H

def detect_pitch(mask, W, H):
    def transitions(axis):
        out = []
        if axis == 'x':
            for y in range(0, H, 2):
                prev = None
                for x in range(W):
                    v = mask[y * W + x]
                    if prev is not None and v != prev: out.append(x)
                    prev = v
        else:
            for x in range(0, W, 2):
                prev = None
                for y in range(H):
                    v = mask[y * W + x]
                    if prev is not None and v != prev: out.append(y)
                    prev = v
        return out
    def score(e, p):
        s = sum(math.sin(2 * math.pi * (v % p) / p) for v in e)
        c = sum(math.cos(2 * math.pi * (v % p) / p) for v in e)
        return math.hypot(s, c) / len(e), (math.atan2(s, c) / (2 * math.pi)) * p
    ex, ey = transitions('x'), transitions('y')
    if len(ex) < 8 or len(ey) < 8: return None
    ex, ey = ex[::max(1, len(ex) // 3000)], ey[::max(1, len(ey) // 3000)]
    def sweep(lo, hi, step):
        best = None; p = lo
        while p < hi:
            rx, phx = score(ex, p); ry, phy = score(ey, p)
            if best is None or rx + ry > best[0]: best = (rx + ry, p, phx, phy)
            p += step
        return best
    # no coarser than sixteen cells across the picture, and of the pitches
    # that score within a whisker of the best take the LARGEST: a pitch's
    # sub-harmonics (a half, a third) score as well as it does, since every
    # edge on the true grid is on theirs too, and the true grid is the
    # coarsest of them
    hi = max(4.0, min(64.0, W / 16, H / 16))
    cands = []
    pp = 3.0
    while pp < hi:
        rx, _ = score(ex, pp); ry, _ = score(ey, pp)
        cands.append((rx + ry, pp)); pp += 0.05
    best = max(c[0] for c in cands)
    # nothing scores: the picture is at its own pixels, not upscaled
    if best < 0.15: return 1.0, 0.0, 0.0, 0.0
    p = max(c[1] for c in cands if c[0] >= best * 0.92)
    q, p, phx, phy = sweep(max(3.0, p - 0.1), p + 0.1, 0.001)
    return p, phx, phy, q / 2

def native(mask, W, H, pitch, phx, phy):
    nx = int(round((W - phx) / pitch)); ny = int(round((H - phy) / pitch))
    grid = []
    for j in range(ny):
        y = int(phy + (j + 0.5) * pitch)
        row = []
        for i in range(nx):
            x = int(phx + (i + 0.5) * pitch)
            row.append(0 <= x < W and 0 <= y < H and mask[y * W + x] == 1)
        grid.append(row)
    return grid, nx, ny

def blobs(grid, nx, ny, gap=1):
    """connected sprites, joined across a gap of `gap` cells (a trunk under a
    crown is one tree); returns lists of (x, y) cells"""
    seen = [[False] * nx for _ in range(ny)]
    out = []
    for y0 in range(ny):
        for x0 in range(nx):
            if not grid[y0][x0] or seen[y0][x0]: continue
            cells = []; stack = [(x0, y0)]; seen[y0][x0] = True
            while stack:
                x, y = stack.pop(); cells.append((x, y))
                for dy in range(-gap - 1, gap + 2):
                    for dx in range(-gap - 1, gap + 2):
                        X, Y = x + dx, y + dy
                        if 0 <= X < nx and 0 <= Y < ny and grid[Y][X] and not seen[Y][X]:
                            seen[Y][X] = True; stack.append((X, Y))
            out.append(cells)
    return out

def rows_of(cells):
    xs = [c[0] for c in cells]; ys = [c[1] for c in cells]
    x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
    w, h = x1 - x0 + 1, y1 - y0 + 1
    g = [['0'] * w for _ in range(h)]
    for x, y in cells: g[y - y0][x - x0] = '1'
    return [''.join(r) for r in g]

def fit(rows):
    """a sprite bigger than the grid, brought down to it (nearest cell), up
    to four times over; bigger than that is not a sprite at this pitch"""
    h = len(rows); w = len(rows[0])
    if w <= CAP and h <= CAP: return rows
    k = max(w, h) / CAP2
    if k > 2: return None
    if k <= 1: return rows
    nw, nh = max(1, round(w / k)), max(1, round(h / k))
    out = []
    for j in range(nh):
        y = min(h - 1, int((j + 0.5) * k))
        out.append(''.join('1' if rows[y][min(w - 1, int((i + 0.5) * k))] == '1' else '0' for i in range(nw)))
    return out

def pieces(rows):
    """a pattern bigger than the grid cut into CAP pieces (a strip of
    border becomes a run of tiles)"""
    h = len(rows); w = len(rows[0])
    if w <= CAP and h <= CAP: return [rows]
    out = []
    for y in range(0, h, CAP):
        for x in range(0, w, CAP):
            piece = [r[x:x + CAP] for r in rows[y:y + CAP]]
            if sum(r.count('1') for r in piece) >= 6: out.append(piece)
    return out

def slice_all():
    desk = OUT.parent
    folders = [d for d in sorted(desk.iterdir()) if d.is_dir() and d.name != OUT.name and not d.name.startswith('.')]
    total = 0
    for d in folders:
        imgs = sorted(f for f in d.iterdir() if f.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp', '.gif'))
        if not imgs: continue
        dest = OUT / d.name.capitalize(); dest.mkdir(parents=True, exist_ok=True)
        for old in dest.glob(d.name + '-*.png'): old.unlink()      # last run's, not anything moved in by hand
        for f in imgs:
            try: im = Image.open(f)
            except Exception as e: print(f'  skip {f.name}: {e}'); continue
            bg = background(im)
            mask, W, H = lit_mask(im, bg)
            det = detect_pitch(mask, W, H)
            if not det: print(f'  {f.name}: no pitch'); continue
            pitch, phx, phy, q = det
            grid, nx, ny = native(mask, W, H, pitch, phx, phy)
            n = 0
            for b in blobs(grid, nx, ny):
                if len(b) < 6: continue
                rows = rows_of(b)
                parts = pieces(rows) if d.name.lower() == 'patterns' else [fit(rows)]
                for piece in parts:
                    if not piece: continue
                    n += 1
                    png(piece).save(dest / f'{d.name}-{f.stem[:6]}-{n:02d}.png')
            total += n
            print(f'  {d.name}/{f.name[:24]:24s} bg {bg} pitch {pitch:.2f} ({q:.2f}) {nx}x{ny} cells → {n} sprites')
    print(f'sliced {total} sprites into {OUT}')

def import_all():
    import importlib.util
    spec = importlib.util.spec_from_file_location('glyphs', ROOT / 'tools' / 'glyphs.py')
    GL = importlib.util.module_from_spec(spec); spec.loader.exec_module(GL)
    glyphs, sets, detail = {}, {}, {}
    def down(rows, cap):
        h = len(rows); w = len(rows[0]); k = max(w, h) / cap
        if k <= 1: return rows
        nw, nh = max(1, round(w / k)), max(1, round(h / k)); out = []
        for j in range(nh):
            y = min(h - 1, int((j + 0.5) * k))
            out.append(''.join(rows[y][min(w - 1, int((i + 0.5) * k))] if rows[y][min(w - 1, int((i + 0.5) * k))] != '0' else '0' for i in range(nw)))
        return out
    for d in sorted(OUT.iterdir()):
        if not d.is_dir() or d.name.startswith('_') or d.name.startswith('.'): continue
        names = []
        for f in sorted(d.glob('*.png')):
            im = Image.open(f).convert('RGBA'); W, H = im.size
            k = SCALE if (W % SCALE == 0 and H % SCALE == 0) else max(1, round(W / 32))
            nx, ny = W // k, H // k
            px = im.load(); rows = []
            for j in range(ny):
                r = ''
                for i in range(nx):
                    cr, cg, cb, ca = px[int((i + 0.5) * k), int((j + 0.5) * k)]
                    # transparent is nothing; the plate's own ground colour is
                    # nothing too, so a PNG exported before 2026-08-30 — which
                    # carried its '2' cells as solid GROUND pixels — reads back
                    # as the drawing alone rather than as a dark slab
                    if ca < 64: r += '0'
                    elif abs(cr - GROUND[0]) + abs(cg - GROUND[1]) + abs(cb - GROUND[2]) < 60: r += '0'
                    else: r += '1'
                rows.append(r)
            if not any('1' in r for r in rows): continue
            if nx > CAP2 or ny > CAP2: print(f'  skip {d.name}/{f.name}: {nx}x{ny} is over even the detail grid'); continue
            rows = GL.trim(rows)
            name = f.stem
            if name in glyphs: name = d.name.lower() + '-' + name
            # finer than the grid: the detail is the drawing itself (to 64),
            # the glyph is it brought down to the grid
            if len(rows) > CAP or len(rows[0]) > CAP:
                detail[name] = down(rows, CAP2)
                rows = down(rows, CAP)
            glyphs[name] = rows; names.append(name)
        if names: sets[d.name.lower()] = names
    # ── the detail table is kept, not rebuilt ──────────────────────────
    # `export` writes ONE PNG per glyph, at the base (32-cell) size, so a
    # folder simply does not carry the finer 64-cell drawings that build
    # 220 reads from at Size x2. Rebuilding `detail` from the folders
    # therefore emptied it — 50 glyphs lost their detail on any `import`,
    # silently. So the table in the file is carried forward for every
    # glyph this run did not itself produce a finer drawing for
    # (2026-08-30).
    keep = table().get('detail', {})
    for n, rows in keep.items():
        if n in glyphs and n not in detail: detail[n] = rows
    # written here rather than by glyphs.py's write(), for the detail table
    import json
    names = sorted(glyphs)
    blob = json.dumps({'grid': CAP, 'sets': sets, 'glyphs': {n: glyphs[n] for n in names},
                       'detail': {n: detail[n] for n in sorted(detail)}}, indent=0, separators=(',', ':'))
    with open(GL.OUT, 'w', encoding='utf8') as fh:
        fh.write(GL.HEADER % (len(names), CAP, CAP))
        fh.write('/*DATA*/\n' + blob + '\n/*END*/\n')
        fh.write(GL.FOOTER)
    print(f'wrote src/glyphs.js: {len(glyphs)} glyphs in {len(sets)} sets, {len(detail)} with detail — ' + ', '.join(f'{k} {len(v)}' for k, v in sets.items()))

def export():
    """glyphs.js out to the folders — BY SET (fixed 2026-08-30).

    This used to sort on one question, "is it in the houses set?", and
    put every other glyph in Buildings — which was right on the day the
    folders were made and there were two of them, and wrong from the day
    `import` started reading a folder per set. Run as it stood it emptied
    291 glyphs into Buildings and left the other nine folders holding
    whatever was in them. The sets are the folders now, which is the same
    rule `import` reads them back by, so export → import is a round trip."""
    D = table()
    sets = D.get('sets', {})
    # set name -> folder name, and a glyph in no set is the landmark's
    folder_of = {}
    for sname, names in sets.items():
        for g in names: folder_of[g] = sname.capitalize()
    folders = sorted({*folder_of.values(), 'Landmarks', '_sheets'})
    for f in folders: (OUT / f).mkdir(parents=True, exist_ok=True)
    n = {}
    for name, rows in D['glyphs'].items():
        folder = folder_of.get(name, 'Landmarks')
        png(rows).save(OUT / folder / f'{name}.png')
        n[folder] = n.get(folder, 0) + 1
    for sheet in ['buildings-a.png', 'buildings-b.png']:
        src = ROOT / 'assets' / sheet
        if src.exists(): shutil.copy2(src, OUT / '_sheets' / sheet)
    (OUT / 'README.txt').write_text(
        "Loci Assets — the printed things the game can put on a plate.\n\n"
        "One PNG per glyph, at 8 screen pixels per cell: bone is a lit cell and\n"
        "EVERY OTHER PIXEL IS TRANSPARENT. Nothing is drawn that is not a coloured\n"
        "pixel of the art (2026-08-30) — the ground a print stands clear of is a\n"
        "separate shape the game lays under it, not part of the asset.\n\n"
        "One folder per set, and the folder is what the set IS: move a file between\n"
        "folders and `assets.py import` moves the glyph between print kinds. Add new\n"
        "ones as PNGs on the same scale (any size up to 32x32 cells).\n\n"
        "_sheets/ holds the two source sheets the older glyphs were cut from\n"
        "(tools/glyphs.py).\n"
        "Written by tools/assets.py in ~/Projects/memory-quest-le.\n")
    print(f'wrote {OUT}: ' + ', '.join(f'{k} {v}' for k, v in sorted(n.items())) + ', sheets copied')

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'export'
    if cmd == 'export': export()
    elif cmd == 'slice': slice_all()
    elif cmd == 'import': import_all()
    else: sys.exit(__doc__)
