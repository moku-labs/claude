#!/usr/bin/env bash
# Notification hook: log build progress notifications to .planning/notifications.log.
# Only logs if an active planning state exists.

[ -f .planning/STATE.md ] || exit 0

INPUT="$1"

# Extract title, message, and notification_type from JSON input
# Official fields: message, title (optional), notification_type
if command -v jq &>/dev/null; then
  TITLE=$(jq -r '.title // empty' <<< "$INPUT" 2>/dev/null)
  MSG=$(jq -r '.message // empty' <<< "$INPUT" 2>/dev/null)
  NTYPE=$(jq -r '.notification_type // empty' <<< "$INPUT" 2>/dev/null)
elif command -v python3 &>/dev/null; then
  TITLE=$(python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('title',''))" <<< "$INPUT" 2>/dev/null)
  MSG=$(python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('message',''))" <<< "$INPUT" 2>/dev/null)
  NTYPE=$(python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('notification_type',''))" <<< "$INPUT" 2>/dev/null)
else
  TITLE=$(printf '%s' "$INPUT" | grep -o '"title"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"title"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
  MSG=$(printf '%s' "$INPUT" | grep -o '"message"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"message"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
  NTYPE=$(printf '%s' "$INPUT" | grep -o '"notification_type"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"notification_type"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
fi

[ -z "$MSG" ] && exit 0

LABEL="${TITLE:-$NTYPE}"
echo "$(date '+%H:%M:%S') [$LABEL] $MSG" >> .planning/notifications.log

exit 0
