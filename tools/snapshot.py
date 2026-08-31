#!/usr/bin/env python3
"""Save or restore everything the game keeps outside the repo.

The source tree is the engine; the *town* — every shape, every marker, the
frozen tracing picture, the blank-plate flag and the floor plan inside every
building — lives in the browser profile the launcher uses. So a tagged
version of this repo is only half a version on its own. This writes the
other half to a file beside it.

    ./play.sh --remote-debugging-port=9222 &
    tools/snapshot.py save snapshots/v3.0.json
    tools/snapshot.py restore snapshots/v3.0.json [--yes]
    tools/snapshot.py sweep [--yes]          # what nothing points at; --yes removes it

`--port`, defaulting to `$MQ_PORT` then 9222, is how a throwaway profile on its
own port is worked on instead of the live town. A restore makes the profile
*become* the file, so it saves the profile as it stands to
`snapshots/.pre-restore-<UTC>.json` first, then shows what is live against what
is in the file and waits for the word `restore` to be typed. `--yes` skips the
question, never the backup.

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
import argparse, json, os, pathlib, sys
from datetime import datetime, timezone

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import cdp

SKIP = {'hq.lastError', 'hq.loads'}          # diagnostics, not the town
# One *field* is dropped as well, in save(): the Google Maps key inside
# hq.basemap. Snapshots are committed beside the tag, and a billable key that
# reaches a commit cannot be taken back out of the history it is in.

# The live town is on 9222; a throwaway profile is launched on another port
# precisely so a destructive test cannot reach the live one, and that only holds
# if the tools can be pointed at it too.
PORT = int(os.environ.get('MQ_PORT', 9222))
SNAPS = pathlib.Path(__file__).resolve().parent.parent / 'snapshots'

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
    // Opened at version 1 WITH the upgrade that creates the store, the same
    // as basemap.js opens it. Without that, this very read -- the backup a
    // restore takes first -- made an empty version-1 database on a fresh
    // profile, and nothing could add the store to it afterwards without a
    // version bump every reader is pinned against. That was the fresh-profile
    // restore failure.
    const d = await new Promise((res, rej) => { const r = indexedDB.open('hq.basemap', 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('pic')) r.result.createObjectStore('pic'); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error || new Error('refused')); });
    if (!d.objectStoreNames.contains('pic')) return {};
    // every row: 'img' is the home plate's picture, 'img.<id>' another plate's
    return await new Promise((res, rej) => { const t = d.transaction('pic', 'readonly');
      const s = t.objectStore('pic'), out = {};
      const q = s.openCursor();
      q.onsuccess = () => { const c = q.result; if (!c){ res(out); return; } out[c.key] = c.value; c.continue(); };
      q.onerror = () => rej(q.error); });
  } catch (e){ return {}; }
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

WRITE_PIC = """(async (url, rows) => {
  const d = await new Promise((res, rej) => { const r = indexedDB.open('hq.basemap', 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('pic'))
      r.result.createObjectStore('pic'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error || new Error('refused')); });
  return await new Promise((res, rej) => { const t = d.transaction('pic', 'readwrite');
    const s = t.objectStore('pic');
    // A snapshot with no frozen picture has to leave the profile with no frozen
    // picture, or a restore is a merge again -- so the store is cleared and
    // only what the file holds is put back. `url` is the home plate's (an
    // older file has only that); `rows` is every plate's, keyed as stored.
    s.clear();
    if (url) s.put(url, 'img');
    for (const k in (rows || {})) if (k !== 'img') s.put(rows[k], k);
    t.oncomplete = () => res(true); t.onerror = () => rej(t.error); });
})"""


def counts(snap):
    """→ (shapes, markers, interiors, locus pictures) for a snapshot dict.

    Both sides of the restore question are read through this, so the live
    profile and the file on disk are counted by the same code.
    """
    ls = snap.get('localStorage') or {}
    return (len(json.loads(ls.get('hq.shapes') or '[]')),
            len(json.loads(ls.get('hq.markers') or '[]')),
            len([k for k in ls if k.startswith('hq.rooms.')]),
            len(snap.get('loci') or {}))


def save(path, page=None, port=PORT, strip=True):
    """Write the profile to `path`; returns the snapshot dict it wrote.

    `page` is for a caller that has already attached — restore takes its own
    backup down the same connection rather than opening a second one.
    """
    p = page or cdp.attach(port=port)
    if page is None:
        print(f'attached to {p.url}')
    keys = [k for k in p.js(LIST_KEYS) if k not in SKIP]
    state = {k: p.js(f'localStorage.getItem({json.dumps(k)})') for k in keys}
    # See SKIP: the key is billable and a snapshot is a committed file. The
    # pre-restore backup is neither — it is gitignored, and it is the only
    # copy of what is about to be destroyed, so it keeps the key.
    # every plate's underlay settings carry the key: hq.basemap and hq.basemap.<id>
    for bk in [k for k in state if k == 'hq.basemap' or (k.startswith('hq.basemap.') and not k.startswith('hq.basemap.img'))]:
        if not (strip and state.get(bk)):
            continue
        try:
            bm = json.loads(state[bk])
            # valid JSON that is not an object has no .get, and AttributeError
            # is not a ValueError — basemap.js only ever writes a dict, but a
            # hand-edited key should not be able to abort a save
            if isinstance(bm, dict) and bm.get('gkey'):
                bm['gkey'] = ''
                state[bk] = json.dumps(bm)
                print(f'stripped the Google Maps key from {bk}')
        except ValueError:
            pass        # not JSON: leave it exactly as the page had it
    rows = p.js(READ_PIC) or {}
    # 'picture' stays the home plate's, as every file since version 3 has had
    # it; 'pictures' is the other plates', and is absent when there are none
    pic = rows.get('img')
    others = {k: v for k, v in rows.items() if k != 'img'}
    loci = p.js(READ_LOCI) or {}
    out = {'version': 3, 'localStorage': state, 'picture': pic, 'loci': loci}
    if others:
        out['pictures'] = others
    f = pathlib.Path(path)
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(out, indent=1))
    shapes, markers, rooms, pics = counts(out)
    inside = sum(len(json.loads(state[k] or '[]'))
                 for k in keys if k.startswith('hq.rooms.'))
    lb = sum(len(v or '') for v in loci.values())
    print(f'saved {f}  ·  {shapes} shapes, {markers} markers, '
          f'{rooms} interiors holding {inside} shapes, '
          f'{pics} locus pictures ({lb // 1024} KB), '
          f'picture {len(pic) if pic else 0} bytes'
          + (f' (+{len(others)} plates\')' if others else '') + f', {f.stat().st_size} bytes total')
    return out


def confirm(live, data, path):
    """Show the profile against the file, and make the word be typed."""
    for label, c in (('live', counts(live)), ('file', counts(data))):
        print(f'  {label}  {c[0]:>4} shapes  {c[1]:>3} markers  '
              f'{c[2]:>3} interiors  {c[3]:>3} locus pictures')
    print(f'{path} would replace the live profile, removing whatever it does '
          'not have.')
    try:
        typed = input('type restore to go ahead: ').strip()
    except EOFError:
        # Nothing is reading the prompt, so nothing has agreed to it either.
        sys.exit('not a terminal — pass --yes if this is really what you want.')
    if typed != 'restore':
        sys.exit('nothing restored.')


def restore(path, port=PORT, yes=False):
    data = json.loads(pathlib.Path(path).read_text())
    p = cdp.attach(port=port)
    print(f'attached to {p.url}')
    # The profile is gone a moment from now, so it is written out first — and
    # that same save is the live side of the counts confirm() asks about. The
    # name is stamped at run time; there is no meaningful UTC "now" at import.
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    # Beside the tagged snapshots rather than beside the shell's cwd, so a
    # backup is always somewhere the next session knows to look.
    live = save(str(SNAPS / f'.pre-restore-{stamp}.json'), page=p, strip=False)
    if not yes:
        confirm(live, data, path)
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
    # Written whether or not the file has a picture, for the same reason the
    # loci are: a snapshot taken with no underlay has to clear the one that is
    # there, or the profile keeps a traced map the file says was removed.
    p.js(f'({WRITE_PIC})({json.dumps(data.get("picture"))}, {json.dumps(data.get("pictures") or {})})')
    # written whether or not the file has any: an empty set has to clear the
    # store, or a locus the snapshot says is blank keeps yesterday's picture
    p.js(f'({WRITE_LOCI})({json.dumps(data.get("loci") or {})})')
    p.call('Page.reload')
    print(f'restored {path} — the page is reloading')


DEL_LOCI = """(async (keys) => {
  const d = await new Promise((res, rej) => { const r = indexedDB.open('hq.loci', 1);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error || new Error('refused')); });
  if (!d.objectStoreNames.contains('img')) return 0;
  return await new Promise((res, rej) => { const t = d.transaction('img', 'readwrite');
    const s = t.objectStore('img');
    for (const k of keys) s.delete(k);
    t.oncomplete = () => res(keys.length); t.onerror = () => rej(t.error); });
})"""


def sweep(port=PORT, yes=False):
    """List what nothing points at any more; with --yes, take it out.

    The index (src/index.js) is asked, fresh, and what it calls an orphan is
    shown with enough beside it to judge: a palace's plan size and the rooms
    it was typed from, a picture's size, a mission's title. Nothing is removed
    unless --yes is given, and then the profile is written out first, the
    same way a restore backs up what it is about to replace — because an
    orphan is not always rubbish. At v7.8 the live town's four orphaned
    palaces were the typed palaces of v5.0 whose markers had been deleted.
    """
    p = cdp.attach(port=port)
    print(f'attached to {p.url}')
    if not p.js('typeof Index !== "undefined"'):
        sys.exit('this build has no index — the sweep needs v7.8 or later')
    o = p.js('(Index.rebuild(), Index.orphans())')
    n = sum(len(v) for v in o.values())
    if not n:
        print('nothing is orphaned.')
        return
    for uid in o['palaces']:
        plan = json.loads(p.js(f'localStorage.getItem({json.dumps("hq.rooms." + uid)})') or '[]')
        order = (p.js(f'localStorage.getItem({json.dumps("hq.order." + uid)})') or '').strip().replace('\n', ', ')
        marks = json.loads(p.js(f'localStorage.getItem({json.dumps("hq.marks." + uid)})') or '[]')
        print(f'  palace  {uid}  {len(plan)} shapes, {len(marks)} loci'
              + (f'  typed: {order[:70]}' if order else '  (never typed)'))
    for uid in o['loci']:
        print(f'  locus   {uid}  inside an orphaned palace')
    for k in o['pictures']:
        size = p.js(f'(async () => {{ const d = await new Promise(r => {{ const q = indexedDB.open("hq.loci", 1); q.onsuccess = () => r(q.result); }});'
                    f' return await new Promise(r => {{ const t = d.transaction("img").objectStore("img").get({json.dumps(k)}); t.onsuccess = () => r((t.result || "").length); }}); }})()')
        what = 'its palace is gone' if k.startswith('locus:place:') else 'no locus holds it'
        print(f'  picture {k}  {int(size or 0) // 1024} KB, {what}')
    for mid in o['missions']:
        m = next((m for m in json.loads(p.js('localStorage.getItem("hq.missions")') or '[]') if m['id'] == mid), {})
        print(f'  mission {mid}  "{m.get("title", "")}"  names a palace that is gone')
    print(f'{n} orphaned.')
    if not yes:
        print('nothing removed — pass --yes to take these out (the profile is backed up first).')
        return
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    save(str(SNAPS / f'.pre-sweep-{stamp}.json'), page=p, strip=False)
    for uid in o['palaces']:
        for pre in ('hq.rooms.', 'hq.order.', 'hq.marks.', 'hq.trace.'):
            p.js(f'localStorage.removeItem({json.dumps(pre + uid)})')
    if o['pictures']:
        p.js(f'({DEL_LOCI})({json.dumps(o["pictures"])})')
    if o['missions']:
        p.js('(() => { const ids = ' + json.dumps(o['missions']) + '; const l = JSON.parse(localStorage.getItem("hq.missions") || "[]");'
             ' for (const m of l) if (ids.includes(m.id)) m.palace = ""; localStorage.setItem("hq.missions", JSON.stringify(l)); })()')
    p.call('Page.reload')
    print(f'swept {n} — the page is reloading')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('action', choices=('save', 'restore', 'sweep'))
    ap.add_argument('path', nargs='?',
                    help='the snapshot file (save and restore); the sweep takes none')
    ap.add_argument('--port', type=int, default=PORT,
                    help=f'debugging port to attach to (default {PORT}, $MQ_PORT)')
    ap.add_argument('--yes', action='store_true',
                    help='restore without being asked to type the word; sweep: actually remove')
    a = ap.parse_args()
    if a.action == 'sweep':
        sweep(port=a.port, yes=a.yes)
    elif not a.path:
        ap.error(f'{a.action} needs a path')
    elif a.action == 'save':
        save(a.path, port=a.port)
    else:
        restore(a.path, port=a.port, yes=a.yes)
