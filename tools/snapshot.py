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
snapshot restores the traced map as well as what was built over it.

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
    out = {'version': 2, 'localStorage': state, 'picture': pic}
    f = pathlib.Path(path)
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(out, indent=1))
    shapes = json.loads(state.get('hq.shapes') or '[]')
    markers = json.loads(state.get('hq.markers') or '[]')
    rooms = [k for k in keys if k.startswith('hq.rooms.')]
    inside = sum(len(json.loads(state[k] or '[]')) for k in rooms)
    print(f'saved {f}  ·  {len(shapes)} shapes, {len(markers)} markers, '
          f'{len(rooms)} interiors holding {inside} shapes, '
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
    p.call('Page.reload')
    print(f'restored {path} — the page is reloading')


if __name__ == '__main__':
    if len(sys.argv) != 3 or sys.argv[1] not in ('save', 'restore'):
        sys.exit(__doc__)
    (save if sys.argv[1] == 'save' else restore)(sys.argv[2])
