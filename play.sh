#!/usr/bin/env bash
# Memory Quest — launch in an app window with its own browser profile, so the
# game never inherits shields/extensions from your everyday browsing and never
# serves a stale build out of that profile's cache.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
URL="file://$DIR/index.html"
PROFILE="${XDG_CACHE_HOME:-$HOME/.cache}/memory-quest"

# A missing page opens a blank window that looks exactly like a browser that
# failed to start, so say which file is not there rather than let it happen.
if [ ! -f "$DIR/index.html" ]; then
  echo "no page to open: $DIR/index.html is missing" >&2
  exit 1
fi

# Chromium family only, first one found wins. There is deliberately no fallback
# to another engine, because the fallback is worse than not starting:
# --user-data-dir is what keeps the town in its own profile instead of your
# everyday one, and tools/ drives the page over CDP, which nothing outside this
# family answers. This list is duplicated in wallpaper.sh; keep them the same.
BROWSER=
for b in brave-browser brave-browser-stable brave chromium chromium-browser google-chrome-stable google-chrome; do
  if command -v "$b" >/dev/null 2>&1; then BROWSER="$b"; break; fi
done

if [ -z "$BROWSER" ]; then
  # echo rather than a heredoc, so the refusal still reaches you on the kind of
  # broken PATH that is one plausible reason nothing above was found.
  echo "no Chromium-family browser found — Memory Quest needs one of:" >&2
  echo "  brave-browser brave-browser-stable brave chromium chromium-browser google-chrome-stable google-chrome" >&2
  echo "It will not fall back to another browser. --user-data-dir is what keeps the" >&2
  echo "town in $PROFILE," >&2
  echo "out of your everyday profile, and tools/ drives the page over CDP, which only" >&2
  echo "a Chromium-family browser answers. Falling back would lose both, quietly." >&2
  exit 1
fi

exec "$BROWSER" --app="$URL" --user-data-dir="$PROFILE" \
  --start-maximized --no-first-run --no-default-browser-check \
  --disable-features=Translate,BraveRewards "$@"
