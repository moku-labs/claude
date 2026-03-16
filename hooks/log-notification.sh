#!/usr/bin/env bash
# Notification hook: log build progress notifications to .planning/notifications.log.
# Only logs if an active planning state exists.

[ -f .planning/STATE.md ] || exit 0

INPUT=$(cat)

# Extract title, message, and notification_type from JSON input
# Priority: jq (fast) → python3 (reliable) → skip (no silent failure)
if command -v jq &>/dev/null; then
  TITLE=$(jq -r '.title // empty' <<< "$INPUT" 2>/dev/null)
  MSG=$(jq -r '.message // empty' <<< "$INPUT" 2>/dev/null)
  NTYPE=$(jq -r '.notification_type // empty' <<< "$INPUT" 2>/dev/null)
elif command -v python3 &>/dev/null; then
  TITLE=$(python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('title',''))" <<< "$INPUT" 2>/dev/null)
  MSG=$(python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('message',''))" <<< "$INPUT" 2>/dev/null)
  NTYPE=$(python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('notification_type',''))" <<< "$INPUT" 2>/dev/null)
else
  exit 0
fi

[ -z "$MSG" ] && exit 0

LABEL="${TITLE:-$NTYPE}"
MSG="${MSG//$'\n'/ }"
echo "$(date '+%H:%M:%S') [$LABEL] $MSG" >> .planning/notifications.log

exit 0
