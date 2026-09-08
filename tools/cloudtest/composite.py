"""A town with everything the seal carries: the latest live snapshot (plates,
region, bench) with the interiors, marks, room orders, deck and locus
pictures of v8.3 laid in. Writes composite.json to $MQ_OUT or the cwd, for
SNAP=… drivetest.py."""
import json, sys, os
S = os.environ.get('MQ_OUT') or os.getcwd()
HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(os.path.dirname(os.path.dirname(HERE)))
base = json.load(open('snapshots/live-2026-09-07-before-311.json'))
best = None
for f in ['snapshots/v8.3.json', 'snapshots/v8.1.json', 'snapshots/v7.9.json']:
    if not os.path.exists(f): continue
    s = json.load(open(f)); ls = s['localStorage']
    rooms = [k for k in ls if k.startswith('hq.rooms.')]
    print(os.path.basename(f), '| rooms', len(rooms), '| loci', len(s.get('loci') or {}), '| deck', 'hq.deck' in ls,
          '| marks', sum(1 for k in ls if k.startswith('hq.marks.')), '| order', sum(1 for k in ls if k.startswith('hq.order.')))
    if best is None and rooms and s.get('loci'): best = s
if not best: raise SystemExit('no snapshot with rooms and loci')
ls = base['localStorage']; added = 0
for k, v in best['localStorage'].items():
    if k.startswith(('hq.rooms.', 'hq.marks.', 'hq.order.')) or k == 'hq.deck':
        ls[k] = v; added += 1
base['loci'] = best.get('loci') or {}
json.dump(base, open(S + '/composite.json', 'w'))
print('composite: keys', len(ls), 'added', added, 'loci', len(base['loci']), 'size', os.path.getsize(S + '/composite.json') // 1024, 'KB')
