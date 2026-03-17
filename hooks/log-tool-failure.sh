#!/usr/bin/env bash
# PostToolUseFailure hook: log failed tool calls to diagnostics.log.
# Skips user interrupts (intentional, not failures).

# Only log if planning state exists
[ -f .planning/STATE.md ] || exit 0

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/diagnostics-logger.sh" 2>/dev/null || true

INPUT=$(cat)

# Parse tool_name, error, is_interrupt in a single pass
# Priority: jq (fast) → python3 (reliable) → exit 0
if command -v jq &>/dev/null; then
  TOOL_NAME=$(jq -r '.tool_name // empty' <<< "$INPUT" 2>/dev/null)
  ERROR=$(jq -r '.error // empty' <<< "$INPUT" 2>/dev/null)
  IS_INTERRUPT=$(jq -r '.is_interrupt // "false"' <<< "$INPUT" 2>/dev/null)
elif command -v python3 &>/dev/null; then
  PARSED=$(python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
print(d.get('tool_name', ''))
print(d.get('error', ''))
print(str(d.get('is_interrupt', False)).lower())
" <<< "$INPUT" 2>/dev/null)
  TOOL_NAME=$(echo "$PARSED" | sed -n '1p')
  ERROR=$(echo "$PARSED" | sed -n '2p')
  IS_INTERRUPT=$(echo "$PARSED" | sed -n '3p')
else
  exit 0
fi

# Skip user interrupts — intentional, not failures
[ "$IS_INTERRUPT" = "true" ] && exit 0

# Skip if no useful info
[ -z "$TOOL_NAME" ] && exit 0

log_diagnostic "TOOL-FAIL" "$TOOL_NAME" "${ERROR:-unknown error}"

exit 0
