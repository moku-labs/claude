#!/usr/bin/env bash
# SubagentStop hook: auto-save planning state when a build/validation agent completes.
# Captures agent completion into .planning/agent-log.md if an active plan exists.

# Only act if we're in a Moku project with active planning state
[ -f .planning/STATE.md ] || exit 0

INPUT=$(cat)

# Parse agent_type and status in a single pass
# Priority: jq (fast) → python3 (reliable) → skip
if command -v jq &>/dev/null; then
  PARSED=$(jq -r '(.agent_type // "") + "\n" + (.status // "completed")' <<< "$INPUT" 2>/dev/null)
elif command -v python3 &>/dev/null; then
  PARSED=$(python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
print(d.get('agent_type', ''))
print(d.get('status', 'completed'))
" <<< "$INPUT" 2>/dev/null)
else
  exit 0
fi
AGENT_TYPE=$(echo "$PARSED" | head -1)
STATUS=$(echo "$PARSED" | tail -1)
[ -z "$STATUS" ] && STATUS="completed"

# Only track moku agents
[ -z "$AGENT_TYPE" ] && exit 0
case "$AGENT_TYPE" in
  moku-*) ;;
  *) exit 0 ;;
esac

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Append agent completion to log (atomic creation with noclobber to avoid TOCTOU race)
if [ ! -f .planning/agent-log.md ]; then
  (
    set -o noclobber
    {
      echo "# Agent Completion Log"
      echo ""
      echo "| Timestamp | Agent | Result |"
      echo "|-----------|-------|--------|"
    } > .planning/agent-log.md 2>/dev/null || true  # loses race gracefully
  )
fi
echo "| $TIMESTAMP | $AGENT_TYPE | $STATUS |" >> .planning/agent-log.md

exit 0
