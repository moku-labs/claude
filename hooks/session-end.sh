#!/usr/bin/env bash
# SessionEnd hook: clean up temporary files and log session end.
# Only acts if an active planning state exists.

[ -f .planning/STATE.md ] || exit 0

# Log session end timestamp
echo "$(date '+%Y-%m-%d %H:%M:%S') Session ended" >> .planning/notifications.log

exit 0
