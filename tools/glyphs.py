#!/usr/bin/env python3
"""── the sprite sheet, turned back into lattice ──────────────────────────

A building drawn as a sprite is a picture of a building laid over the town;
at any distance it reads as a different material, because it is one. That is
the same objection `src/type.js` answers for letters, and it is answered the
same way here: the sheet is read once, offline, and what ships is not the
image but a GRID OF LIT SQUARES. At run time every lit square becomes one
diamond in the same instance stream as the roads and the grass, so a landmark
is made of the town rather than printed on it.

So this script is a build step, not a loader. Nothing in src/ ever opens a
PNG. Run it when the sheet changes, commit what it writes, and the game goes
on knowing only about ones and zeroes.

    tools/glyphs.py assets/buildings-a.png --cols 6 --rows 5 --prefix a
    tools/glyphs.py assets/buildings-b.png --cols 6 --rows 6 --prefix b --append

The sheets are pixel art exported at some upscale factor, and the factor is
worked out rather than asked for — see detect_pitch. Both of the current
sheets come back at 5.371, which is the same export, and every sprite on them
lands between eleven and sixteen art pixels square.

ImageMagick does the decoding because it is already on the box and PIL is
not, and shelling out to it costs one subprocess in a step that runs by hand
every few weeks. It is asked for raw 8-bit grey rather than anything parsed,
so the only format knowledge in this file is "one byte per pixel, left to
right, top to bottom".
"""

import argparse
import math
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'src', 'glyphs.js')


def magick(*args):
    """ImageMagick 7 renamed the tool and ImageMagick 6 kept it; take either,
    and say which one is missing rather than let a shell error through."""
    for exe in ('magick', 'convert'):
        try:
            return subprocess.run((exe,) + args, capture_output=True, check=True).stdout
        except FileNotFoundError:
            continue
        except subprocess.CalledProcessError as e:
            sys.exit('imagemagick failed: ' + e.stderr.decode('utf8', 'replace').strip())
    sys.exit('no imagemagick on PATH — this needs `magick` or `convert`')


def identify(path):
    out = magick('identify', '-format', '%w %h', path + '[0]')
    w, h = out.decode().split()
    return int(w), int(h)


def grey(path, w, h):
    """The sheet as one byte per pixel. `-alpha remove` matters: a sprite cut
    out on transparency comes back with a black background otherwise, and
    black is the one value this script reads as "not part of the building"."""
    raw = magick(path + '[0]', '-alpha', 'remove', '-alpha', 'off',
                 '-colorspace', 'gray', '-depth', '8', 'GRAY:-')
    if len(raw) < w * h:
        sys.exit('short read from imagemagick: got %d bytes, wanted %d' % (len(raw), w * h))
    return raw


def detect_pitch(px, W, H, thr):
    """Find the pixel pitch the art was upscaled by, and where its grid starts.

    These sheets are pixel art exported large: every art pixel is a block of
    roughly five and a half screen pixels, and the block edges all land on one
    lattice. Recovering that lattice is the difference between reading the art
    and guessing at it. Box-filtering a sprite onto an arbitrary grid — which
    is what this did first — beats the fine detail (window rows, the hatching
    on a roof) into noise, because the sampling grid and the art's own grid
    drift in and out of phase across the sprite.

    So: collect every lit/unlit transition, then look for the pitch whose
    phases agree most. Each transition is a vote for a pitch that divides it;
    treating the phase as an angle and taking the resultant length scores a
    candidate in one number, and the true pitch wins by a mile (0.91 against
    noise). Returns the pitch and its phase on each axis."""
    def transitions(axis):
        out = []
        if axis == 'x':
            for y in range(0, H, 2):
                prev = None
                for x in range(W):
                    v = px[y * W + x] >= thr
                    if prev is not None and v != prev: out.append(x)
                    prev = v
        else:
            for x in range(0, W, 2):
                prev = None
                for y in range(H):
                    v = px[y * W + x] >= thr
                    if prev is not None and v != prev: out.append(y)
                    prev = v
        return out

    def score(e, p):
        s = sum(math.sin(2 * math.pi * (v % p) / p) for v in e)
        c = sum(math.cos(2 * math.pi * (v % p) / p) for v in e)
        return math.hypot(s, c) / len(e), (math.atan2(s, c) / (2 * math.pi)) * p

    ex, ey = transitions('x'), transitions('y')
    if not ex or not ey:
        return None
    # Scoring is O(edges) per candidate and there are thousands of candidates,
    # so both are cut down: a few thousand transitions settle the phase just as
    # well as fifty thousand, and a coarse sweep followed by a fine one around
    # the winner costs a twentieth of sweeping the whole range finely.
    ex, ey = ex[::max(1, len(ex) // 4000)], ey[::max(1, len(ey) // 4000)]

    def sweep(lo, hi, step):
        best = None
        p = lo
        while p < hi:
            rx, phx = score(ex, p)
            ry, phy = score(ey, p)
            if best is None or rx + ry > best[0]:
                best = (rx + ry, p, phx, phy)
            p += step
        return best

    _, p, _, _ = sweep(2.0, 12.0, 0.01)
    _, p, phx, phy = sweep(max(2.0, p - 0.02), p + 0.02, 0.0005)
    return p, phx, phy


def native(px, W, H, thr, pitch, phx, phy):
    """The whole sheet read back at its own resolution: one bool per art pixel.

    Each art pixel is sampled at the CENTRE of its block rather than averaged
    over it, because the block is flat colour — averaging only lets the
    neighbouring block's edge bleed in."""
    nx = int(round((W - phx) / pitch))
    ny = int(round((H - phy) / pitch))
    grid = []
    for j in range(ny):
        y = int(phy + (j + 0.5) * pitch)
        if y < 0 or y >= H:
            grid.append([False] * nx); continue
        row = []
        for i in range(nx):
            x = int(phx + (i + 0.5) * pitch)
            row.append(0 <= x < W and px[y * W + x] >= thr)
        grid.append(row)
    return grid, nx, ny


def sample(art, ax0, ay0, ax1, ay1, cap):
    """Cut one sprite out of the native-resolution sheet, at its own size.

    A glyph is stored as the bitmap it actually is — twelve by fourteen, or
    nine by twenty — and NOT padded out to a square. Padding was the first
    version and it was wrong twice over: it bakes ten dead rows into a
    fourteen-row building, and it decides the aspect ratio here, in a build
    step, when the thing that should decide it is the shape you drag on the
    plate. `src/kinds.js` fits the glyph's own rectangle into that shape and
    keeps its proportions, which is the same decision made once, later, where
    it can be seen.

    The art is already at the resolution it was drawn at, so the usual case is
    a straight copy — no filtering, no thresholds, nothing that can soften an
    edge. `cap` only bites on a sprite bigger than it, and reduces by OR-ing
    each block rather than averaging it: a one-pixel spire is the reason you
    chose that building, so it must survive the reduction even when it is
    outvoted by the sky around it."""
    bw, bh = ax1 - ax0 + 1, ay1 - ay0 + 1
    n = max(bw, bh)
    if n <= cap:
        return [''.join('1' if art[ay0 + y][ax0 + x] else '0' for x in range(bw))
                for y in range(bh)]
    gw, gh = max(1, round(bw * cap / n)), max(1, round(bh * cap / n))
    out = []
    for gy in range(gh):
        sy0 = ay0 + gy * bh // gh
        sy1 = ay0 + max(gy * bh // gh + 1, (gy + 1) * bh // gh)
        row = []
        for gx in range(gw):
            sx0 = ax0 + gx * bw // gw
            sx1 = ax0 + max(gx * bw // gw + 1, (gx + 1) * bw // gw)
            on = False
            for y in range(sy0, min(sy1, ay1 + 1)):
                for x in range(sx0, min(sx1, ax1 + 1)):
                    if art[y][x]: on = True; break
                if on: break
            row.append('1' if on else '0')
        out.append(''.join(row))
    return out


def preview(rows):
    """Printed so the slice can be judged by eye before it is committed. The
    project's own rule — only a picture proves it looks right — applies to a
    16-square glyph as much as to the plate."""
    return '\n'.join('    ' + r.replace('0', '·').replace('1', '█') for r in rows)


def main():
    ap = argparse.ArgumentParser(description='slice a building sheet into lattice glyphs')
    ap.add_argument('sheet')
    ap.add_argument('--cols', type=int, required=True)
    ap.add_argument('--rows', type=int, required=True)
    ap.add_argument('--grid', type=int, default=32, help='cap on a glyph\'s longer side (default 32)')
    ap.add_argument('--thr', type=int, default=110, help='grey level that counts as lit (0-255)')
    ap.add_argument('--pitch', type=float, default=0, help='upscale factor, if autodetection gets it wrong')
    ap.add_argument('--prefix', default='b', help='name stem for the glyphs from this sheet')
    ap.add_argument('--append', action='store_true', help='add to src/glyphs.js instead of replacing it')
    ap.add_argument('--preview', action='store_true', help='print each glyph as text and write nothing')
    a = ap.parse_args()

    W, H = identify(a.sheet)
    px = grey(a.sheet, W, H)

    if a.pitch:
        pitch, phx, phy = a.pitch, 0.0, 0.0
    else:
        got = detect_pitch(px, W, H, a.thr)
        if not got:
            sys.exit('nothing lit in %s at threshold %d' % (a.sheet, a.thr))
        pitch, phx, phy = got
    art, nx, ny = native(px, W, H, a.thr, pitch, phx, phy)
    print('%s: %d×%d, pitch %.3f → %d×%d art pixels (%.1f×%.1f per cell)'
          % (os.path.basename(a.sheet), W, H, pitch, nx, ny, nx / a.cols, ny / a.rows))

    glyphs = {}
    blank = []
    for r in range(a.rows):
        for c in range(a.cols):
            # the cell's bounds in art pixels, then trimmed to what is lit
            u0, u1 = round(c * nx / a.cols), round((c + 1) * nx / a.cols) - 1
            v0, v1 = round(r * ny / a.rows), round((r + 1) * ny / a.rows) - 1
            ax0, ay0, ax1, ay1 = u1, v1, u0 - 1, v0 - 1
            for v in range(v0, v1 + 1):
                for u in range(u0, u1 + 1):
                    if art[v][u]:
                        ax0 = min(ax0, u); ax1 = max(ax1, u)
                        ay0 = min(ay0, v); ay1 = max(ay1, v)
            name = '%s%02d' % (a.prefix, r * a.cols + c + 1)
            if ax1 < ax0:
                blank.append(name)
                continue
            rows = sample(art, ax0, ay0, ax1, ay1, a.grid)
            glyphs[name] = rows
            if a.preview:
                print('%s  (%d×%d)' % (name, len(rows[0]), len(rows)))
                print(preview(rows))
                print()

    if glyphs:
        print('  %d glyphs, %s' % (len(glyphs),
              ' '.join('%dx%d' % (len(v[0]), len(v)) for v in list(glyphs.values())[:6]) + ' ...'))
    if blank:
        print('  empty cells (skipped): ' + ', '.join(blank))
    if a.preview:
        return

    existing = {}
    grid = a.grid
    if a.append and os.path.exists(OUT):
        existing, grid = read_back()
        if grid != a.grid:
            sys.exit('src/glyphs.js is on a %d grid and this sheet is %d — '
                     'one grid per file, so re-slice both at the same size' % (grid, a.grid))
    existing.update(glyphs)
    write(existing, grid)
    print('  wrote %s (%d glyphs total)' % (os.path.relpath(OUT, ROOT), len(existing)))


def read_back():
    """The generated file is its own database. Round-tripping it is what lets
    a second sheet be appended without holding both on the command line."""
    src = open(OUT, encoding='utf8').read()
    i, j = src.index('/*DATA*/'), src.index('/*END*/')
    blob = json.loads(src[i + 8:j].strip().rstrip(';'))
    return blob['glyphs'], blob['grid']


def write(glyphs, grid):
    names = sorted(glyphs)
    blob = json.dumps({'grid': grid, 'glyphs': {n: glyphs[n] for n in names}},
                      indent=0, separators=(',', ':'))
    with open(OUT, 'w', encoding='utf8') as f:
        f.write(HEADER % (len(names), grid, grid))
        f.write('/*DATA*/\n' + blob + '\n/*END*/\n')
        f.write(FOOTER)


HEADER = """'use strict';
/* ── the building glyphs ────────────────────────────────────────────────
   GENERATED by tools/glyphs.py from the sheets in assets/. Do not hand-edit:
   re-slice and commit what comes out, or the next run silently reverts you.

   %d glyphs, each a %d×%d grid of lit squares written out as strings of
   ones and zeroes, for the same reason src/type.js writes its letterforms
   out rather than packing them — this is the art, and art you cannot read
   in the source is art nobody will fix.

   Every lit square becomes one diamond at stamp time (src/kinds.js), which
   is what keeps a landmark the same material as the ground under it. */

const Glyphs = (() => {
const D =
"""

FOOTER = """;
  const names = Object.keys(D.glyphs);
  return {grid: D.grid, names, has: n => !!D.glyphs[n], rows: n => D.glyphs[n]};
})();
"""


if __name__ == '__main__':
    main()
