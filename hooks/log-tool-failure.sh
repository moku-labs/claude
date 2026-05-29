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

# Route known build failures to the diagnostician via additionalContext (hint, not a block).
# Only when jq is available (safe JSON) and the error matches a build-tool signature.
if command -v jq &>/dev/null; then
  HINT=""
  case "$ERROR" in
    *"error TS"*|*"tsc"*) HINT="TypeScript compile failure. Before retrying, run \`bunx tsc --noEmit\` and spawn the moku-error-diagnostician agent with the error output for a targeted fix." ;;
    *"lint"*|*"Biome"*|*"biome"*|*"✖"*) HINT="Lint failure. Run \`bun run lint\` and, if non-trivial, spawn moku-error-diagnostician before retrying." ;;
    *"vitest"*|*"FAIL "*|*"test failed"*|*"Tests failed"*) HINT="Test failure. Re-run the failing test in isolation and spawn moku-error-diagnostician with the assertion output. Do NOT delete or skip tests to make the suite pass." ;;
  esac
  if [ -n "$HINT" ]; then
    jq -n --arg ctx "$HINT" \
      '{hookSpecificOutput: {hookEventName: "PostToolUseFailure", additionalContext: $ctx}}'
    exit 0
  fi
fi

exit 0
