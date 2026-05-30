#!/usr/bin/env bash
# Notification hook: the agent needs the user (a question, a permission prompt, or it has gone idle
# waiting). Play an alert sound + desktop popup so the user notices — this fires in ANY project
# (gated by enableNotifications/enableSounds in .claude/moku.local.md). Also logs to
# .planning/notifications.log when inside a moku project.

INPUT=$(cat)

# Extract title, message, notification_type. jq → python3 → give up.
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

# Nothing actionable at all → skip.
[ -z "$MSG" ] && [ -z "$NTYPE" ] && exit 0

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/notify.sh" 2>/dev/null || true

# --- Alert: the agent is waiting on the user. Fires for ALL notification types (question,
#     permission, idle), not just permission prompts. ---
if [ "$NTYPE" = "permission_prompt" ]; then
  moku_notify "Moku — Permission Needed" "${MSG:-Permission required}" "tink"
else
  moku_notify "Moku — Input Needed" "${MSG:-Waiting for your input}" "tink"
fi

# --- Log to the planning notifications log (moku projects only). ---
if [ -f .planning/STATE.md ] && [ -n "$MSG" ]; then
  LABEL="${TITLE:-$NTYPE}"
  LOGMSG="${MSG//$'\n'/ }"
  echo "$(date '+%H:%M:%S') [$LABEL] $LOGMSG" >> .planning/notifications.log
fi

exit 0
