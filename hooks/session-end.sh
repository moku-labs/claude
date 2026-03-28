#!/usr/bin/env bash
# SessionEnd hook: clean up temporary files and log session end.

# Clean up brainstorm session marker if present (prevents stale guard between sessions)
rm -f .planning/.brainstorm-active 2>/dev/null

[ -f .planning/STATE.md ] || exit 0

# Log session end timestamp
echo "$(date '+%Y-%m-%d %H:%M:%S') Session ended" >> .planning/notifications.log

exit 0
