#!/usr/bin/env bash
# SessionEnd hook: clean up temporary files, log session end, notify user.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Clean up brainstorm session marker if present (prevents stale guard between sessions)
rm -f .planning/.brainstorm-active 2>/dev/null

[ -f .planning/STATE.md ] || exit 0

# Log session end timestamp
echo "$(date '+%Y-%m-%d %H:%M:%S') Session ended" >> .planning/notifications.log

# Notify user that session ended (useful when they walked away during a long build)
source "$SCRIPT_DIR/notify.sh" 2>/dev/null || true
PHASE=$(grep '^## Phase:' .planning/STATE.md 2>/dev/null | head -1 | sed 's/## Phase: //')
case "$PHASE" in
  build/wave-*)
    WAVE_NUM=$(echo "$PHASE" | grep -oE '[0-9]+')
    moku_notify "Moku — Session Ended" "Wave $WAVE_NUM session complete" "hero"
    ;;
  build/complete)
    moku_notify "Moku — Build Complete" "All waves finished" "hero"
    ;;
  *)
    moku_notify "Moku — Session Ended" "${PHASE:-idle}" "ping"
    ;;
esac

exit 0
