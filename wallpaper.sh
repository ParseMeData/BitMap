#!/usr/bin/env bash
# Memory Quest as a live desktop plate.
#
# Plasma wallpapers cannot take input, so this is an overlay window pinned
# below everything by a KWin rule — the same trick as the Typeset Earth
# overlay already in ~/.config/kwinrulesrc. It drifts over the map on its
# own; click it and walk, and it hands control back.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE="${XDG_CACHE_HOME:-$HOME/.cache}/memory-quest-wall"
FPS=30
DPR=1.25

usage(){ cat <<USAGE
usage: wallpaper.sh [start|stop|restart|uninstall] [--fps N] [--dpr X]

  start      install the KWin rule (once) and put the plate on the desktop
  stop       take it down, leaving the rule in place
  restart    stop, then start
  uninstall  stop and remove the KWin rule

  --fps N    frame cap while drifting (default $FPS; 0 = uncapped)
  --dpr X    render scale cap (default $DPR; raise for crisper diamonds)
USAGE
}

CMD=start
while [ $# -gt 0 ]; do
  case "$1" in
    start|stop|restart|uninstall) CMD="$1" ;;
    --fps) FPS="$2"; shift ;;
    --dpr) DPR="$2"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage; exit 2 ;;
  esac
  shift
done

running(){ pgrep -f -- "--user-data-dir=$PROFILE" >/dev/null 2>&1; }

stop_it(){
  if running; then
    pgrep -f -- "--user-data-dir=$PROFILE" | while read -r p; do kill "$p" 2>/dev/null || true; done
    sleep 1
    pgrep -f -- "--user-data-dir=$PROFILE" | while read -r p; do kill -9 "$p" 2>/dev/null || true; done
    echo "plate stopped"
  else
    echo "not running"
  fi
}

reconfigure(){ qdbus-qt6 org.kde.KWin /KWin reconfigure >/dev/null 2>&1 || true; }

case "$CMD" in
  stop) stop_it ;;
  uninstall)
    stop_it
    echo "kwin rule: $(python3 "$DIR/tools/kwinrule.py" remove)"
    reconfigure ;;
  start|restart)
    [ "$CMD" = restart ] && stop_it
    if running; then echo "already running — use restart"; exit 0; fi
    echo "kwin rule: $(python3 "$DIR/tools/kwinrule.py" install)"
    reconfigure
    URL="file://$DIR/index.html?wallpaper=1&fps=$FPS&dpr=$DPR"
    setsid brave-browser --app="$URL" --user-data-dir="$PROFILE" \
      --no-first-run --no-default-browser-check --disable-features=Translate \
      --disable-backgrounding-occluded-windows --disable-renderer-backgrounding \
      --disable-background-timer-throttling \
      >/dev/null 2>&1 < /dev/null &
    disown || true
    echo "plate up  ·  fps $FPS  ·  dpr $DPR"
    echo "click it and use WASD to walk; it drowses back to drifting after 25s idle" ;;
esac
