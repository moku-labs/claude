#!/usr/bin/env bash
# SubagentStop hook: auto-save planning state when a build/validation agent completes.
# Captures agent completion into .planning/agent-log.md if an active plan exists.

# Only act if we're in a Moku project with active planning state
[ -f .planning/STATE.md ] || exit 0

TOOL_INPUT="$1"

# Extract agent_type from input
# Priority: jq (fast) → python3 (reliable) → skip
if command -v jq &>/dev/null; then
  AGENT_TYPE=$(jq -r '.agent_type // empty' <<< "$TOOL_INPUT" 2>/dev/null)
elif command -v python3 &>/dev/null; then
  AGENT_TYPE=$(python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('agent_type',''))" <<< "$TOOL_INPUT" 2>/dev/null)
else
  exit 0
fi

# Only track moku agents
[ -z "$AGENT_TYPE" ] && exit 0
case "$AGENT_TYPE" in
  moku-*) ;;
  *) exit 0 ;;
esac

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Append agent completion to log (atomic write for header creation)
if [ -f .planning/agent-log.md ]; then
  echo "| $TIMESTAMP | $AGENT_TYPE | completed |" >> .planning/agent-log.md
else
  {
    echo "# Agent Completion Log"
    echo ""
    echo "| Timestamp | Agent | Result |"
    echo "|-----------|-------|--------|"
    echo "| $TIMESTAMP | $AGENT_TYPE | completed |"
  } > .planning/agent-log.md
fi

exit 0
