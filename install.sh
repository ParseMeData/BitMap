#!/usr/bin/env bash
# Memory Quest LE — put the launcher entry and its icon where this desktop looks
# for them, from wherever the clone happens to sit.
#
# memory-quest-le.desktop is tracked as a template rather than as a working entry,
# because its only machine-specific strings — the path to play.sh and the
# version in the name — used to be hand-kept in a second copy under
# ~/.local/share/applications, and that copy silently rotted between releases.
# Now there is one file, and the installed entry is generated from it.
#
# Everything written is per-user and inside XDG_DATA_HOME. In particular this
# script NEVER touches ~/.config/kwinrulesrc: that file holds this machine's
# other window rules (the Typeset Earth overlay among them), and wallpaper.sh
# owns that surface through tools/kwinrule.py. So removing the launcher does
# not take the desktop plate down — './wallpaper.sh uninstall' is the separate
# step for the KWin rule.
set -euo pipefail

# Resolve our own directory rather than assume one: the clone is not always at
# ~/Projects/memory-quest-le, since tools/aws-dev-box.sh stands one up on a box.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
APPS="$DATA/applications"
ENTRY="$APPS/memory-quest-le.desktop"
ICON="$DATA/icons/hicolor/256x256/apps/memory-quest-le.png"

usage(){ cat <<USAGE
usage: install.sh [--remove]

  (no argument)  install the launcher entry and its icon for this user
  --remove       delete both again

  The desktop plate is a separate thing: ./wallpaper.sh start | uninstall
USAGE
}

# Neither cache tool is guaranteed present — a box with no GTK has the second,
# a minimal desktop neither — and a missing cache is not a failed install.
refresh(){
  update-desktop-database "$APPS" >/dev/null 2>&1 || true
  gtk-update-icon-cache -f -t "$DATA/icons/hicolor" >/dev/null 2>&1 || true
}

case "${1:-}" in
  --remove)
    # Reported one by one, the same way wallpaper.sh says "not running": an
    # entry that was never installed is worth knowing about, not worth failing.
    for f in "$ENTRY" "$ICON"; do
      if [ -e "$f" ]; then rm -f "$f"; echo "removed  $f"; else echo "absent   $f"; fi
    done
    refresh
    echo "the KWin rule is separate and still in place: ./wallpaper.sh uninstall"
    exit 0 ;;
  -h|--help) usage; exit 0 ;;
  "") ;;
  *) echo "unknown argument: $1" >&2; usage; exit 2 ;;
esac

# The folder carries no version; the git tag does. A tarball, or a clone
# fetched without tags, still has to install — so name it honestly rather than
# fail on a missing tag.
VERSION="$(git -C "$DIR" describe --tags --abbrev=0 2>/dev/null || true)"
[ -n "$VERSION" ] || VERSION="dev"

# Tags are named v6.0 and every surface that shows a version says V6.0 — the
# window title, the README heading. The launcher is read beside them, so it
# gets the same capital rather than the raw tag name.
case "$VERSION" in v[0-9]*) VERSION="V${VERSION#v}" ;; esac

# Substituting with | rather than / because the directory going in is a path.
# The template's header explains that it IS a template, which is false the
# moment it is installed — so the copy starts at the group header and the
# explanation stays behind in the tracked file where it is true.
mkdir -p "$APPS"
sed -n '/^\[Desktop Entry\]/,$p' "$DIR/memory-quest-le.desktop" \
  | sed -e "s|@DIR@|$DIR|g" -e "s|@VERSION@|$VERSION|g" > "$ENTRY"

# Installed under the theme name the entry asks for, so the entry carries no
# absolute path at all and the icon survives the clone being moved.
install -Dm644 "$DIR/assets/icon.png" "$ICON"

refresh

echo "installed  $ENTRY"
echo "installed  $ICON"
echo "Memory Quest LE $VERSION  ·  runs $DIR/play.sh"
