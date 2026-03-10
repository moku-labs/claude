#!/usr/bin/env bash
# Notification hook: log build progress notifications to .planning/notifications.log.
# Only logs if an active planning state exists.

[ -f .planning/STATE.md ] || exit 0

INPUT="$1"

# Extract title, message, and notification_type from JSON input
# Priority: jq (fast) → python3 (reliable) → skip (no silent failure)
if command -v jq &>/dev/null; then
  TITLE=$(jq -r '.title // empty' <<< "$INPUT" 2>/dev/null)
  MSG=$(jq -r '.message // empty' <<< "$INPUT" 2>/dev/null)
  NTYPE=$(jq -r '.notification_type // empty' <<< "$INPUT" 2>/dev/null)
elif command -v python3 &>/dev/null; then
  eval "$(python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
print(f\"TITLE='{d.get('title', '').replace(chr(39), chr(39)+chr(92)+chr(92)+chr(39)+chr(39))}'\")
print(f\"MSG='{d.get('message', '').replace(chr(39), chr(39)+chr(92)+chr(92)+chr(39)+chr(39))}'\")
print(f\"NTYPE='{d.get('notification_type', '').replace(chr(39), chr(39)+chr(92)+chr(92)+chr(39)+chr(39))}'\")
" <<< "$INPUT" 2>/dev/null)"
else
  exit 0
fi

[ -z "$MSG" ] && exit 0

LABEL="${TITLE:-$NTYPE}"
echo "$(date '+%H:%M:%S') [$LABEL] $MSG" >> .planning/notifications.log

exit 0
