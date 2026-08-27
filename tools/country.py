#!/usr/bin/env python3
"""
Australia, spliced out of the loci bitmap and down into states, regions and
the regions inside those.

The loci bitmap Typeset Earth carries is an equirectangular raster of country
indices: 720x284 at 0.5 degrees, top edge 84N, bottom edge 58S, run-length
encoded four characters to a run (12 bits of value, 12 bits of count-1) over
the standard base64 alphabet. Australia is already spliced once in there --
the mainland states and Tasmania appear as their own entries rather than as
one country -- but half a degree is far too coarse to cut a state into
regions, let alone a region into its own parts.

So this rebuilds the same picture at 0.0125 degrees over an Australian
window. The window's corner is a whole multiple of half a degree, which makes
this grid an exact refinement of every grid that already exists -- forty
cells to a 0.5 degree cell, eight to a 0.1 degree cell -- and that is what
lets a cell here be pointed at a cell there with no resampling.

Boundaries are the ABS Australian Statistical Geography Standard, 2026
edition. ONE layer is fetched: SA3. It carries its own name, its SA4, its
GCCSA and its state, so the whole hierarchy is read off a single request and
a single raster:

    Australia  >  state  >  SA4 region  >  SA3

and only the SA3 is stored. Everything above it is a union of what is below,
which is why the four levels cannot disagree about where a line falls: there
is only one line, written once.

That nesting is the reason SA3 is the level below SA4 rather than the local
government area, which is what a lot of these places are actually called. An
LGA does not nest -- measured against this same raster, 211 of 533 of them
have cells in more than one SA4, and Brisbane City sits in three. A shire is
a different cut of the country, not a smaller piece of this one.

    tools/country.py             # fetch if needed, rasterise, check, write assets/australia.js
    tools/country.py --refetch   # re-pull the ABS boundaries first
"""

import json, math, os, sys, re, codecs, array, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'country-data')     # the ABS GeoJSON as fetched and healed, so a rebuild is offline
# The overlay is a read-only input: the build reads its raster to check this
# one against, and never writes to it. Overridable because this tool does not
# only run on the machine Typeset Earth is installed on -- point TYPESET_EARTH
# at a copy, or leave it out and the build says which check it could not run
# rather than failing or, worse, passing quietly.
OVERLAY = os.environ.get(
    'TYPESET_EARTH',
    os.path.expanduser('~/.local/share/typeset-earth/typeset-earth.html'))

# ── the grid ───────────────────────────────────────────────────────────
LON0, LON1 = 112.5, 154.0
LAT0, LAT1 = -9.0, -44.0
CELL = 0.0125
COLS = round((LON1 - LON0) / CELL)       # 3320
ROWS = round((LAT0 - LAT1) / CELL)       # 2800

W_LAT_TOP, W_LAT_BOT, W_COLS, W_ROWS = 84.0, -58.0, 720, 284

B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
IDX = {c: i for i, c in enumerate(B64)}

ABS = 'https://geo.abs.gov.au/arcgis/rest/services/ASGS2026/{}/MapServer/0/query'
# generalisation finer than a cell, or the boundary would be the limit on how
# sharp the raster can be rather than the grid
QUERY = ('where=1%3D1&returnGeometry=true&outSR=4326&f=geojson'
         '&maxAllowableOffset=0.002&geometryPrecision=5&outFields=')
FIELDS = ['SA3_CODE_2026', 'SA3_NAME_2026', 'SA4_CODE_2026', 'SA4_NAME_2026',
          'GCCSA_NAME_2026', 'STATE_CODE_2026', 'STATE_NAME_2026',
          'AREA_ALBERS_SQKM']


# ── the loci bitmap ────────────────────────────────────────────────────

def js_strings(seg):
    """The overlay is minified JS, so its name tables carry \\xNN escapes."""
    return [codecs.decode(m.group(1), 'unicode_escape')
            for m in re.finditer(r'"((?:[^"\\]|\\.)*)"', seg)]


def read_loci_bitmap():
    """Pull `nB` out of the overlay bundle. Read only; never writes to it.
    Returns None when there is no overlay to read, so the build still runs
    where Typeset Earth is not installed."""
    if not os.path.exists(OVERLAY):
        return None
    src = open(OVERLAY, encoding='utf-8').read()
    i = src.find('nB={cols:')
    if i < 0:
        raise SystemExit('no loci bitmap in ' + OVERLAY)
    cols = int(re.search(r'cols:(\d+)', src[i:i + 40]).group(1))
    rows = int(re.search(r'rows:(\d+)', src[i:i + 40]).group(1))
    j = src.find('rle:"', i)
    rle = src[j + 5:src.find('"', j + 5)]
    m = re.search(r'names:\[', src[i:j])
    s = i + m.end()
    return cols, rows, js_strings(src[s:src.find(']', s)]), rle


def unrle(rle, n):
    out = array.array('h', bytes(2 * n))
    t = 0
    for l in range(0, len(rle), 4):
        v = IDX[rle[l]] * 64 + IDX[rle[l + 1]]
        c = IDX[rle[l + 2]] * 64 + IDX[rle[l + 3]] + 1
        if v:
            for p in range(t, min(t + c, n)):
                out[p] = v
        t += c
    return out


def enrle(cells):
    """Back into the overlay's own encoding. A run longer than 4096 is split,
    which is the only thing 12 bits of count cannot say in one go."""
    out = []
    n = len(cells)
    i = 0
    while i < n:
        v = cells[i]
        j = i + 1
        while j < n and cells[j] == v:
            j += 1
        run = j - i
        while run:
            c = min(run, 4096)
            out.append(B64[v >> 6] + B64[v & 63] + B64[(c - 1) >> 6] + B64[(c - 1) & 63])
            run -= c
        i = j
    return ''.join(out)


# ── boundaries ─────────────────────────────────────────────────────────

def fetch(level, fields, refetch=False):
    path = os.path.join(DATA, level.lower() + '.geojson')
    if os.path.exists(path) and not refetch:
        return json.load(open(path))
    url = ABS.format(level) + '?' + QUERY + ','.join(fields)
    sys.stderr.write('fetching %s ... ' % level)
    with urllib.request.urlopen(url, timeout=600) as r:
        raw = r.read()
    doc = json.loads(raw)
    if doc.get('exceededTransferLimit'):
        raise SystemExit('%s: ABS truncated the response; page it' % level)
    open(path, 'wb').write(raw)
    sys.stderr.write('%d features\n' % len(doc['features']))
    return doc


def bbox_km2(geom):
    """The area of a geometry's bounding box, roughly, in square kilometres."""
    xs = [c[0] for poly in polygons(geom) for c in poly[0]]
    ys = [c[1] for poly in polygons(geom) for c in poly[0]]
    if not xs:
        return 0.0
    lat = math.radians((min(ys) + max(ys)) / 2)
    return ((max(xs) - min(xs)) * 111.32 * math.cos(lat)) * ((max(ys) - min(ys)) * 111.32)


def heal(doc, refetch):
    """Re-fetch anything the ABS generalisation path has collapsed.

    Asking their server for a simplified geometry is how the payload is kept
    to a couple of megabytes, but for at least one feature it does not
    simplify -- it collapses. `Richmond Valley - Coastal` is 1,573 square
    kilometres and eight polygons; with any `maxAllowableOffset` at all the
    server hands back a single ring whose coordinates all sit inside a
    hundred-metre box, and it rasterises to nothing at all.

    A polygon cannot be larger than its own bounding box, so comparing the
    two against the area the ABS publishes for the same feature catches it
    without knowing anything about which feature it is. Whatever fails that
    is fetched again on its own, ungeneralised, and the healed document is
    written back so the next build starts from it."""
    sick = [f for f in doc['features']
            if f.get('geometry')
            and (f['properties'].get('AREA_ALBERS_SQKM') or 0) > 0
            and bbox_km2(f['geometry']) < 0.9 * f['properties']['AREA_ALBERS_SQKM']]
    if not sick:
        return doc
    for f in sick:
        code = f['properties']['SA3_CODE_2026']
        sys.stderr.write('healing %s (%s): generalised geometry collapsed ... '
                         % (f['properties']['SA3_NAME_2026'], code))
        url = (ABS.format('SA3') + '?where=SA3_CODE_2026%3D%27' + code + '%27'
               '&returnGeometry=true&outSR=4326&f=geojson&outFields=' + ','.join(FIELDS))
        with urllib.request.urlopen(url, timeout=600) as r:
            got = json.loads(r.read())
        g = got['features'][0]['geometry'] if got.get('features') else None
        if not g or bbox_km2(g) < 0.9 * f['properties']['AREA_ALBERS_SQKM']:
            raise SystemExit('could not heal %s -- ungeneralised geometry is '
                             'no better; do not ship a hole' % code)
        f['geometry'] = g
        sys.stderr.write('%d points\n' % sum(len(r) for poly in polygons(g) for r in poly))
    path = os.path.join(DATA, 'sa3.geojson')
    json.dump(doc, open(path, 'w'), separators=(',', ':'))
    return doc


def polygons(geom):
    if not geom:
        return []
    return [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']


def ring_area(ring):
    a = 0.0
    for k in range(len(ring) - 1):
        a += ring[k][0] * ring[k + 1][1] - ring[k + 1][0] * ring[k][1]
    return abs(a) / 2


# ── raster ─────────────────────────────────────────────────────────────

def rasterise(items):
    """One plane of SA3 ids. Painted largest polygon first, so an enclave --
    a piece sitting in another's hole -- lands on top of the hole that was
    punched for it rather than under it."""
    from PIL import Image, ImageDraw
    img = Image.new('I', (COLS, ROWS), 0)
    draw = ImageDraw.Draw(img)
    to_px = lambda ring: [((x - LON0) / CELL, (LAT0 - y) / CELL) for x, y in ring]

    jobs = []
    for sid, feat in items:
        for poly in polygons(feat['geometry']):
            jobs.append((ring_area(poly[0]), sid, poly))
    jobs.sort(key=lambda j: -j[0])

    for _, sid, poly in jobs:
        px = to_px(poly[0])
        if len(px) >= 3:
            draw.polygon(px, fill=sid)
        for hole in poly[1:]:
            h = to_px(hole)
            if len(h) >= 3:
                draw.polygon(h, fill=0)
    sys.stderr.write('painted %d rings\n' % len(jobs))
    flat = getattr(img, 'get_flattened_data', img.getdata)()
    return array.array('h', [min(v, 32767) for v in flat])


def main():
    doc = heal(fetch('SA3', FIELDS, '--refetch' in sys.argv), '--refetch' in sys.argv)

    # ── the four levels, all read off the one layer ───────────────────
    states, scode = [], {}
    regions, rcode = [], {}
    subs, indexed, dropped = [], [], []

    feats = sorted(doc['features'], key=lambda f: f['properties']['SA3_CODE_2026'])
    for f in feats:
        p = f['properties']
        if not f.get('geometry') or not p['STATE_CODE_2026'].isdigit():
            dropped.append(p['SA3_NAME_2026'])
            continue

        sc = p['STATE_CODE_2026']
        if sc not in scode:
            scode[sc] = len(states) + 1
            states.append({'code': sc, 'name': p['STATE_NAME_2026']})

        rc = p['SA4_CODE_2026']
        if rc not in rcode:
            rcode[rc] = len(regions) + 1
            regions.append({'code': rc, 'name': p['SA4_NAME_2026'],
                            'state': scode[sc],
                            'part': p.get('GCCSA_NAME_2026') or ''})

        subs.append({'code': p['SA3_CODE_2026'], 'name': p['SA3_NAME_2026'],
                     'region': rcode[rc],
                     'km2': round(p.get('AREA_ALBERS_SQKM') or 0, 1)})
        indexed.append((len(subs), f))

    # states come out in SA3-code order, which is state-code order already,
    # but say so rather than rely on it
    order = sorted(range(len(states)), key=lambda i: int(states[i]['code']))
    if order != list(range(len(states))):
        raise SystemExit('states arrived out of code order')

    grid = rasterise(indexed)

    # ── counts ────────────────────────────────────────────────────────
    filled = 0
    n_sub = [0] * (len(subs) + 1)
    n_reg = [0] * (len(regions) + 1)
    n_st = [0] * (len(states) + 1)

    # A cell's area shrinks toward the pole and Australia spans thirty-five
    # degrees of it, so the raster's area is summed per row. It is a check,
    # not the answer: the ABS publishes the area of every region it draws,
    # and that is what the asset carries.
    KM = 111.32
    row_km2 = [CELL * KM * CELL * KM *
               math.cos(math.radians(LAT0 - (r + 0.5) * CELL)) for r in range(ROWS)]
    raster_km2 = [0.0] * (len(subs) + 1)

    for i, v in enumerate(grid):
        if not v:
            continue
        filled += 1
        n_sub[v] += 1
        r = subs[v - 1]['region']
        n_reg[r] += 1
        n_st[regions[r - 1]['state']] += 1
        raster_km2[v] += row_km2[i // COLS]

    # ── against the bitmap it came from ───────────────────────────────
    refine = round(0.5 / CELL)
    bitmap = read_loci_bitmap()
    if bitmap is None:
        sys.stderr.write('loci bitmap: NOT CHECKED -- no overlay at %s\n' % OVERLAY)
        sys.stderr.write('             (set TYPESET_EARTH to a copy to turn this check on)\n')
        sys.stderr.write('this grid  : %d cells at %g deg\n' % (filled, CELL))
    else:
        wc, wr, wnames, wrle = bitmap
        world = unrle(wrle, wc * wr)
        au = ['Western Australia', 'Northern Territory', 'South Australia', 'Queensland',
              'New South Wales', 'Victoria', 'Tasmania']
        vals = {wnames.index(n) + 1 for n in au if n in wnames}
        coarse = sum(1 for v in world if v in vals)
        expect = coarse * refine * refine
        sys.stderr.write('loci bitmap: %d cells at 0.5deg  x %d^2  ->  %d expected\n'
                         % (coarse, refine, expect))
        sys.stderr.write('this grid  : %d cells at %g deg  (%+.1f%%)\n'
                         % (filled, CELL, 100.0 * filled / expect - 100))

    # ── against the ABS's own areas ───────────────────────────────────
    off = sum(s['km2'] for s in subs)
    got = sum(raster_km2[1:])
    err = sorted(100.0 * (raster_km2[i] - s['km2']) / s['km2']
                 for i, s in enumerate(subs, 1) if s['km2'] > 200)
    sys.stderr.write('area       : raster %.0f vs ABS %.0f (%+.2f%%), median %+.2f%%\n'
                     % (got, off, 100.0 * (got - off) / off, err[len(err) // 2]))

    # ── what the window cuts ──────────────────────────────────────────
    clipped = []
    for sid, feat in indexed:
        if any(not (LON0 <= x <= LON1 and LAT1 <= y <= LAT0)
               for poly in polygons(feat['geometry']) for x, y in poly[0]):
            subs[sid - 1]['clipped'] = True
            clipped.append(subs[sid - 1]['name'])
    empty = [s['name'] for s, n in zip(subs, n_sub[1:]) if n == 0]

    asset = {
        'note': 'Australia at 0.0125 deg, cut to ABS ASGS2026 SA3. One plane of '
                'SA3 ids; SA4 regions, states and the country derive from it.',
        'cols': COLS, 'rows': ROWS, 'cell': CELL,
        'lon0': LON0, 'lat0': LAT0,
        'origin': {'grid': 'typeset-earth nB', 'cols': W_COLS, 'rows': W_ROWS,
                   'latTop': W_LAT_TOP, 'latBot': W_LAT_BOT, 'refines': refine},
        'states': states,
        'regions': regions,
        'subs': subs,
        'counts': {'state': n_st, 'region': n_reg, 'sub': n_sub},
        'excluded': {
            'window': 'lon %g..%g, lat %g..%g' % (LON0, LON1, LAT1, LAT0),
            'noGeometry': dropped,
            'outsideWindow': empty,
            'clippedByWindow': clipped,
        },
        'rle': enrle(grid),
    }

    out = os.path.join(HERE, '..', 'assets', 'australia.js')
    with open(out, 'w') as fh:
        fh.write('/* Generated by tools/country.py -- do not hand-edit.\n'
                 '   Australia, cut out of the Typeset Earth loci bitmap and\n'
                 '   spliced into %d states, %d regions and %d parts. */\n'
                 % (len(states), len(regions), len(subs)))
        fh.write('const AU = ')
        json.dump(asset, fh, separators=(',', ':'))
        fh.write(';\n')
    sys.stderr.write('wrote %s  (%.0f kB, rle %.0f kB)  %d/%d/%d levels\n'
                     % (out, os.path.getsize(out) / 1024, len(asset['rle']) / 1024,
                        len(states), len(regions), len(subs)))
    if dropped:
        sys.stderr.write('no geometry: %d buckets (migratory, no usual address)\n' % len(dropped))
    if empty:
        sys.stderr.write('no cells at all: %s\n' % ', '.join(empty))
    if clipped:
        sys.stderr.write('clipped by the window: %s\n' % ', '.join(clipped))


if __name__ == '__main__':
    main()
