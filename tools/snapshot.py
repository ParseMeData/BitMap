#!/usr/bin/env python3
"""Save or restore everything the game keeps outside the repo.

The source tree is the engine; the *town* — every shape, every marker, the
frozen tracing picture, the blank-plate flag and the floor plan inside every
building — lives in the browser profile the launcher uses. So a tagged
version of this repo is only half a version on its own. This writes the
other half to a file beside it.

    ./play.sh --remote-debugging-port=9222 &
    tools/snapshot.py save snapshots/v3.0.json
    tools/snapshot.py restore snapshots/v3.0.json

The frozen picture is a data URL in IndexedDB and is carried in full, so a
snapshot restores the traced map as well as what was built over it. So are
the locus pictures — the photographs of what stands at each place, which are
the whole of what the platformer plays, and which nothing else would ever get
back if they were left out.

Interiors are one key per marker, named after an id only that marker has, so
there is no fixed list of them to write down here. Everything under `hq.` is
taken instead, minus the few keys that are scratch rather than state — which
also means a kind of state added later is carried without touching this file.
"""
import json, pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import cdp

SKIP = {'hq.lastError', 'hq.loads'}          # diagnostics, not the town

LIST_KEYS = """(() => {
  const out = [];
  for (let i = 0; i < localStorage.length; i++){
    const k = localStorage.key(i);
    if (k.indexOf('hq.') === 0) out.push(k);
  }
  return out.sort();
})()"""

READ_PIC = """(async () => {
  try {
    const d = await new Promise((res, rej) => { const r = indexedDB.open('hq.basemap', 1);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error || new Error('refused')); });
    if (!d.objectStoreNames.contains('pic')) return null;
    return await new Promise((res, rej) => { const t = d.transaction('pic', 'readonly');
      const q = t.objectStore('pic').get('img');
      q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); });
  } catch (e){ return null; }
})()"""

READ_LOCI = """(async () => {
  try {
    const d = await new Promise((res, rej) => { const r = indexedDB.open('hq.loci', 1);
      r.onupgradeneeded = () => { try { r.result.createObjectStore('img'); } catch (e){} };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error || new Error('refused')); });
    if (!d.objectStoreNames.contains('img')) return {};
    return await new Promise((res, rej) => { const t = d.transaction('img', 'readonly');
      const s = t.objectStore('img'), out = {};
      const kq = s.getAllKeys(), vq = s.getAll();
      t.oncomplete = () => { (kq.result || []).forEach((k, i) => { out[k] = vq.result[i]; }); res(out); };
      t.onerror = () => rej(t.error); });
  } catch (e){ return {}; }
})()"""

WRITE_LOCI = """(async (rows) => {
  const d = await new Promise((res, rej) => { const r = indexedDB.open('hq.loci', 1);
    r.onupgradeneeded = () => { try { r.result.createObjectStore('img'); } catch (e){} };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error || new Error('refused')); });
  return await new Promise((res, rej) => { const t = d.transaction('img', 'readwrite');
    const s = t.objectStore('img');
    s.clear();
    for (const k in rows) s.put(rows[k], k);
    t.oncomplete = () => res(Object.keys(rows).length); t.onerror = () => rej(t.error); });
})"""

WRITE_PIC = """(async (url) => {
  const d = await new Promise((res, rej) => { const r = indexedDB.open('hq.basemap', 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('pic'))
      r.result.createObjectStore('pic'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error || new Error('refused')); });
  return await new Promise((res, rej) => { const t = d.transaction('pic', 'readwrite');
    t.objectStore('pic').put(url, 'img');
    t.oncomplete = () => res(true); t.onerror = () => rej(t.error); });
})"""


def save(path):
    p = cdp.attach()
    keys = [k for k in p.js(LIST_KEYS) if k not in SKIP]
    state = {k: p.js(f'localStorage.getItem({json.dumps(k)})') for k in keys}
    pic = p.js(READ_PIC)
    loci = p.js(READ_LOCI) or {}
    out = {'version': 3, 'localStorage': state, 'picture': pic, 'loci': loci}
    f = pathlib.Path(path)
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(out, indent=1))
    shapes = json.loads(state.get('hq.shapes') or '[]')
    markers = json.loads(state.get('hq.markers') or '[]')
    rooms = [k for k in keys if k.startswith('hq.rooms.')]
    inside = sum(len(json.loads(state[k] or '[]')) for k in rooms)
    lb = sum(len(v or '') for v in loci.values())
    print(f'saved {f}  ·  {len(shapes)} shapes, {len(markers)} markers, '
          f'{len(rooms)} interiors holding {inside} shapes, '
          f'{len(loci)} locus pictures ({lb // 1024} KB), '
          f'picture {len(pic) if pic else 0} bytes, {f.stat().st_size} bytes total')


def restore(path):
    data = json.loads(pathlib.Path(path).read_text())
    p = cdp.attach()
    saved = data.get('localStorage') or {}
    # A restore is the profile *becoming* the file, not the file being merged
    # into it: an interior built since the snapshot has no key in it, and
    # leaving that key behind would put a room inside a marker the snapshot
    # says is empty.
    for k in p.js(LIST_KEYS):
        if k not in SKIP and k not in saved:
            p.js(f'localStorage.removeItem({json.dumps(k)})')
    for k, v in saved.items():
        if v is None:
            p.js(f'localStorage.removeItem({json.dumps(k)})')
        else:
            p.js(f'localStorage.setItem({json.dumps(k)}, {json.dumps(v)})')
    pic = data.get('picture')
    if pic:
        p.js(f'({WRITE_PIC})({json.dumps(pic)})')
    # written whether or not the file has any: an empty set has to clear the
    # store, or a locus the snapshot says is blank keeps yesterday's picture
    p.js(f'({WRITE_LOCI})({json.dumps(data.get("loci") or {})})')
    p.call('Page.reload')
    print(f'restored {path} — the page is reloading')


if __name__ == '__main__':
    if len(sys.argv) != 3 or sys.argv[1] not in ('save', 'restore'):
        sys.exit(__doc__)
    (save if sys.argv[1] == 'save' else restore)(sys.argv[2])
