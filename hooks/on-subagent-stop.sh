#!/usr/bin/env bash
# SubagentStop hook: auto-save planning state when a build/validation agent completes.
# Captures agent completion into .planning/STATE.md if an active plan exists.

# Only act if we're in a Moku project with active planning state
[ -f .planning/STATE.md ] || exit 0

TOOL_INPUT="$1"

# Extract agent name and stop reason from input
if command -v jq &>/dev/null; then
  AGENT_NAME=$(jq -r '.agent_name // empty' <<< "$TOOL_INPUT" 2>/dev/null)
  STOP_REASON=$(jq -r '.stop_reason // empty' <<< "$TOOL_INPUT" 2>/dev/null)
elif command -v python3 &>/dev/null; then
  AGENT_NAME=$(python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('agent_name',''))" <<< "$TOOL_INPUT" 2>/dev/null)
  STOP_REASON=$(python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('stop_reason',''))" <<< "$TOOL_INPUT" 2>/dev/null)
else
  AGENT_NAME=$(printf '%s' "$TOOL_INPUT" | grep -o '"agent_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"agent_name"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
  STOP_REASON=$(printf '%s' "$TOOL_INPUT" | grep -o '"stop_reason"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"stop_reason"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
fi

# Diagnostic: if parsing failed, log raw payload once for field name discovery
if [ -z "$AGENT_NAME" ] && [ -z "$STOP_REASON" ] && [ -n "$TOOL_INPUT" ]; then
  if [ ! -f .planning/hook-debug.log ] || ! grep -q 'SubagentStop' .planning/hook-debug.log 2>/dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] SubagentStop raw payload: $TOOL_INPUT" >> .planning/hook-debug.log
  fi
  exit 0
fi

# Only track moku agents
[ -z "$AGENT_NAME" ] && exit 0
case "$AGENT_NAME" in
  moku-*) ;;
  *) exit 0 ;;
esac

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Append agent completion to state log
if [ -f .planning/agent-log.md ]; then
  echo "| $TIMESTAMP | $AGENT_NAME | $STOP_REASON |" >> .planning/agent-log.md
else
  {
    echo "# Agent Completion Log"
    echo ""
    echo "| Timestamp | Agent | Result |"
    echo "|-----------|-------|--------|"
    echo "| $TIMESTAMP | $AGENT_NAME | $STOP_REASON |"
  } > .planning/agent-log.md
fi

exit 0
