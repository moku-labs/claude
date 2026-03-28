#!/usr/bin/env bash
# Auto-approve writes to known .planning/ files for frictionless state tracking.
# Restricted to specific known filenames to prevent bypass of anti-pattern checks
# on arbitrary files placed under .planning/.

INPUT=$(cat)

# Extract file_path from the JSON input (nested under tool_input for PreToolUse)
# Priority: jq (fast) → python3 (reliable) → skip
if command -v jq &>/dev/null; then
  FILE_PATH=$(jq -r '.tool_input.file_path // empty' <<< "$INPUT" 2>/dev/null)
elif command -v python3 &>/dev/null; then
  FILE_PATH=$(python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('tool_input',{}).get('file_path',''))" <<< "$INPUT" 2>/dev/null)
else
  exit 0
fi

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Resolve to relative path for matching
REL_PATH="$FILE_PATH"
if [[ "$FILE_PATH" == "$PWD/"* ]]; then
  REL_PATH="${FILE_PATH#$PWD/}"
fi

# Reject any path containing traversal components
case "$REL_PATH" in
  *../*|*/..*) exit 0 ;;
esac

# Allow-list of known .planning/ files and patterns (relative and absolute paths)
case "$REL_PATH" in
  .planning/STATE.md|.planning/STATE.md.bak|*/.planning/STATE.md|*/.planning/STATE.md.bak)
    ;;
  .planning/decisions.md|.planning/research.md|.planning/memory.md|*/.planning/decisions.md|*/.planning/research.md|*/.planning/memory.md)
    ;;
  .planning/agent-log.md|.planning/notifications.log|*/.planning/agent-log.md|*/.planning/notifications.log)
    ;;
  .planning/app-spec.md|*/.planning/app-spec.md)
    ;;
  .planning/specs/*.md|*/.planning/specs/*.md)
    ;;
  .planning/skeleton-spec.md|*/.planning/skeleton-spec.md)
    ;;
  .planning/STATE-history.md|*/.planning/STATE-history.md)
    ;;
  .planning/audit-*.md|*/.planning/audit-*.md)
    ;;
  .planning/moku.md|*/.planning/moku.md)
    ;;
  .planning/diagnostics.log|*/.planning/diagnostics.log)
    ;;
  .planning/brainstorm-*.md|*/.planning/brainstorm-*.md)
    ;;
  .planning/context-*.md|*/.planning/context-*.md)
    ;;
  .planning/learnings.md|*/.planning/learnings.md)
    ;;
  .planning/.brainstorm-active|*/.planning/.brainstorm-active)
    ;;
  .planning/steering.md|*/.planning/steering.md)
    ;;
  .planning/deferred-findings.md|.planning/dismissed-findings.md|*/.planning/deferred-findings.md|*/.planning/dismissed-findings.md)
    ;;
  *)
    # Not a known .planning/ file — don't auto-approve, let normal flow handle it
    exit 0
    ;;
esac

echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","permissionDecisionReason":"Auto-approved: known .planning/ file for state tracking"}}'
exit 0
