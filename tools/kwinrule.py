#!/usr/bin/env python3
"""Install or remove the Memory Quest Low Effort wallpaper rule in ~/.config/kwinrulesrc.

Written by hand rather than with kwriteconfig6 because the [General] rules list
needs a read-modify-write, and kwriteconfig6 cannot delete a group at all.
Other rules in the file (Typeset Earth, etc.) are preserved byte for byte.
"""
import os, sys, uuid

PATH = os.path.expanduser('~/.config/kwinrulesrc')
DESC = 'Memory Quest Low Effort wallpaper'
TITLE = '^Memory Quest Low Effort Wallpaper$'

RULE = """Description={desc}
below=true
belowrule=2
fullscreen=true
fullscreenrule=2
minimize=false
minimizerule=2
noborder=true
noborderrule=2
screen=0
screenrule=2
skippager=true
skippagerrule=2
skipswitcher=true
skipswitcherrule=2
skiptaskbar=true
skiptaskbarrule=2
title={title}
titlematch=3
""".format(desc=DESC, title=TITLE)


def parse(text):
    """→ [(group_name, [lines])], preserving order and formatting."""
    groups, cur = [], ('', [])
    for line in text.splitlines():
        if line.startswith('[') and line.rstrip().endswith(']'):
            if cur[0] or cur[1]:
                groups.append(cur)
            cur = (line.strip()[1:-1], [])
        else:
            cur[1].append(line)
    if cur[0] or cur[1]:
        groups.append(cur)
    return groups


def dump(groups):
    out = []
    for name, lines in groups:
        if name:
            out.append('[%s]' % name)
        out.extend(lines)
        if lines and lines[-1].strip():
            out.append('')
    return '\n'.join(out).rstrip('\n') + '\n'


def load():
    if not os.path.exists(PATH):
        return []
    with open(PATH) as f:
        return parse(f.read())


def ids(groups):
    for name, lines in groups:
        if name == 'General':
            for l in lines:
                if l.startswith('rules='):
                    return [x for x in l[6:].split(',') if x]
    return []


def find_ours(groups):
    return [name for name, lines in groups
            if any(l.strip() == 'Description=' + DESC for l in lines)]


def write(groups, order):
    body = [(n, l) for n, l in groups if n != 'General']
    head = ('General', ['count=%d' % len(order), 'rules=' + ','.join(order)])
    os.makedirs(os.path.dirname(PATH), exist_ok=True)
    tmp = PATH + '.tmp'
    with open(tmp, 'w') as f:
        f.write(dump([head] + body))
    os.replace(tmp, PATH)


def install():
    groups = load()
    order = ids(groups)
    mine = find_ours(groups)
    if mine:                                   # refresh in place, keep its id
        groups = [(n, RULE.rstrip('\n').splitlines()) if n in mine else (n, l)
                  for n, l in groups]
        write(groups, order)
        return 'refreshed'
    rid = str(uuid.uuid4())
    groups.append((rid, RULE.rstrip('\n').splitlines()))
    write(groups, order + [rid])
    return 'installed'


def remove():
    groups = load()
    mine = set(find_ours(groups))
    if not mine:
        return 'not present'
    groups = [(n, l) for n, l in groups if n not in mine]
    write(groups, [i for i in ids(groups) if i not in mine])
    return 'removed'


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'install'
    print(install() if cmd == 'install' else remove())
