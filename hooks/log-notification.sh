#!/usr/bin/env bash
# Notification hook: log build progress notifications to .planning/notifications.log.
# Only logs if an active planning state exists.

[ -f .planning/STATE.md ] || exit 0

INPUT="$1"

# Extract title and message from JSON input (jq -> python3 -> grep/sed)
if command -v jq &>/dev/null; then
  TITLE=$(jq -r '.title // empty' <<< "$INPUT" 2>/dev/null)
  MSG=$(jq -r '.message // empty' <<< "$INPUT" 2>/dev/null)
elif command -v python3 &>/dev/null; then
  TITLE=$(python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('title',''))" <<< "$INPUT" 2>/dev/null)
  MSG=$(python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('message',''))" <<< "$INPUT" 2>/dev/null)
else
  TITLE=$(echo "$INPUT" | grep -o '"title"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"title"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
  MSG=$(echo "$INPUT" | grep -o '"message"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"message"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
fi

echo "$(date '+%H:%M:%S') [$TITLE] $MSG" >> .planning/notifications.log

exit 0
