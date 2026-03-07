#!/usr/bin/env bash
# SessionEnd hook: clean up temporary files and log session end.
# Only acts if an active planning state exists.

[ -f .planning/STATE.md ] || exit 0

# Clean up debug logs (no longer needed after confirmed field names)
[ -f .planning/hook-debug.log ] && rm -f .planning/hook-debug.log

# Log session end timestamp
echo "$(date '+%Y-%m-%d %H:%M:%S') Session ended" >> .planning/notifications.log

exit 0
