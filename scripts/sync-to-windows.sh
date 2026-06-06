#!/usr/bin/env bash
# Sync the extension source from WSL to Windows.
#   - Excludes node_modules / dist / raycast-env.d.ts / .git (rebuilt per OS)
#   - Uses --inplace to overwrite in place (less likely to fail with a rename
#     error while ray develop holds the file)
#
# Usage:
#   scripts/sync-to-windows.sh                 # one-shot sync (default destination)
#   scripts/sync-to-windows.sh <dest>          # specify the destination
#   scripts/sync-to-windows.sh --watch         # watch and auto-sync (requires inotify-tools)
#   WIN_DEST=/mnt/c/path scripts/sync-to-windows.sh
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WATCH=0

if [[ ! -d /mnt/c ]]; then
  echo "ERROR: /mnt/c not found. Run this on WSL (not needed on macOS / native Linux)." >&2
  exit 1
fi

# Default destination: <Windows user home>/dev/raycast-claude-launcher.
# Resolve the Windows username via cmd.exe rather than hardcoding it.
default_win_dest() {
  local u
  u="$(cmd.exe /c 'echo %USERNAME%' 2>/dev/null | tr -d '\r\n ')"
  [[ -n "$u" && -d "/mnt/c/Users/$u" ]] && printf '/mnt/c/Users/%s/dev/raycast-claude-launcher' "$u"
  return 0 # never fail: an empty result must reach the friendly -z check below, not trip set -e
}
DEST="${WIN_DEST:-$(default_win_dest)}"

for arg in "$@"; do
  case "$arg" in
    --watch) WATCH=1 ;;
    *) DEST="$arg" ;;
  esac
done

if [[ -z "$DEST" ]]; then
  echo "ERROR: could not determine the destination. Set WIN_DEST or pass it as an argument," >&2
  echo "       e.g. WIN_DEST=/mnt/c/Users/<you>/dev/raycast-claude-launcher $0" >&2
  exit 1
fi

do_sync() {
  mkdir -p "$DEST"
  rsync -a --inplace --no-perms --no-owner --no-group --delete \
    --exclude node_modules --exclude dist --exclude raycast-env.d.ts --exclude .git \
    "$SRC/" "$DEST/"
  echo "[$(date +%H:%M:%S)] synced: $SRC -> $DEST"
}

do_sync

if [[ "$WATCH" == "1" ]]; then
  if ! command -v inotifywait >/dev/null 2>&1; then
    echo "ERROR: --watch requires inotify-tools: sudo apt install inotify-tools" >&2
    exit 1
  fi
  echo "watching $SRC (src/ package.json assets/ ...) — Ctrl-C to stop"
  while inotifywait -qq -r -e modify,create,delete,move \
    "$SRC/src" "$SRC/package.json" "$SRC/assets" "$SRC/mise.toml" 2>/dev/null; do
    do_sync
  done
fi
