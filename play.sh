#!/usr/bin/env bash
# Memory Quest — launch in an app window with its own browser profile, so the
# game never inherits shields/extensions from your everyday browsing and never
# serves a stale build out of that profile's cache.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
URL="file://$DIR/index.html"
PROFILE="${XDG_CACHE_HOME:-$HOME/.cache}/memory-quest"

if command -v brave-browser >/dev/null 2>&1; then
  exec brave-browser --app="$URL" --user-data-dir="$PROFILE" \
    --start-maximized --no-first-run --no-default-browser-check \
    --disable-features=Translate,BraveRewards "$@"
elif command -v chromium-browser >/dev/null 2>&1; then
  exec chromium-browser --app="$URL" --user-data-dir="$PROFILE" --start-maximized "$@"
elif command -v firefox >/dev/null 2>&1; then
  exec firefox --kiosk "$URL" "$@"
else
  exec xdg-open "$URL"
fi
