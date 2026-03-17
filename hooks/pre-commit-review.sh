#!/usr/bin/env bash
# PostToolUse hook (Bash): lightweight self-review after checkpoint commits.
# Runs static analysis on the committed diff to catch issues that PreToolUse
# hooks miss (cross-file problems, import gaps, dead code).
#
# Only triggers during active Moku build waves (not arbitrary git commits).
# Injects findings as additionalContext so Claude sees them immediately.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/diagnostics-logger.sh" 2>/dev/null || true

# Only act in a Moku project with active planning state
[ -f .planning/STATE.md ] || exit 0
[ -f .planning/moku.md ] || exit 0

INPUT=$(cat)

# --- Extract the bash command from the tool result ---
if command -v jq &>/dev/null; then
  COMMAND=$(jq -r '.tool_input.command // empty' <<< "$INPUT" 2>/dev/null)
elif command -v python3 &>/dev/null; then
  COMMAND=$(python3 -c "import sys,json; ti=json.loads(sys.stdin.read()).get('tool_input',{}); print(ti.get('command',''))" <<< "$INPUT" 2>/dev/null)
else
  exit 0
fi

# Only trigger on git commit commands (checkpoint commits during build waves)
case "$COMMAND" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

# Only trigger during active build waves (not plan commits or manual commits)
ACTIVE_WAVE=$(grep -E '\|\s*(active|building|in-progress)\s*\|' .planning/STATE.md 2>/dev/null | head -1)
SKELETON_STATUS=$(grep '^## Skeleton:' .planning/STATE.md 2>/dev/null | sed 's/## Skeleton: //' | tr -d ' ')

if [ -z "$ACTIVE_WAVE" ] && [ "$SKELETON_STATUS" != "in-progress" ]; then
  exit 0
fi

# --- Run lightweight static analysis on the last commit's diff ---
DIFF=$(git diff HEAD~1 --diff-filter=ACM --name-only -- '*.ts' '*.tsx' 2>/dev/null)
[ -z "$DIFF" ] && exit 0

FINDINGS=""
FINDING_COUNT=0

# Check 1: Unreferenced imports (files that import from deleted/moved modules)
while IFS= read -r file; do
  [ -f "$file" ] || continue

  # Check for potential undefined references in plugin source
  case "$file" in
    */plugins/*)
      # Detect empty function bodies (stub indicators)
      EMPTY_BODIES=$(grep -nE '(=>|{)\s*$' "$file" 2>/dev/null | head -3)
      if [ -n "$EMPTY_BODIES" ]; then
        FINDINGS="${FINDINGS}STUB: $file may have empty function bodies\n"
        FINDING_COUNT=$((FINDING_COUNT + 1))
      fi

      # Detect TODO/FIXME left in committed code
      TODOS=$(grep -nE '\b(TODO|FIXME|HACK|XXX)\b' "$file" 2>/dev/null | head -3)
      if [ -n "$TODOS" ]; then
        FINDINGS="${FINDINGS}TODO: $file has unresolved TODO/FIXME markers\n"
        FINDING_COUNT=$((FINDING_COUNT + 1))
      fi

      # Detect console.log left in source (not tests)
      case "$file" in
        *__tests__*|*.test.*|*.spec.*) ;;
        *)
          CONSOLE=$(grep -nE '\bconsole\.(log|debug|info|warn)\b' "$file" 2>/dev/null | head -3)
          if [ -n "$CONSOLE" ]; then
            FINDINGS="${FINDINGS}CONSOLE: $file has console.log/debug statements\n"
            FINDING_COUNT=$((FINDING_COUNT + 1))
          fi
          ;;
      esac
      ;;
  esac
done <<< "$DIFF"

# Check 2: Quick tsc check (non-blocking — just report, don't fail the commit)
TSC_OUTPUT=$(bunx tsc --noEmit 2>&1)
TSC_EXIT=$?
if [ $TSC_EXIT -ne 0 ]; then
  TSC_ERROR_COUNT=$(echo "$TSC_OUTPUT" | grep -c 'error TS' 2>/dev/null || echo "0")
  FINDINGS="${FINDINGS}TSC: $TSC_ERROR_COUNT TypeScript error(s) found after commit\n"
  FINDING_COUNT=$((FINDING_COUNT + TSC_ERROR_COUNT))
fi

# Check 3: Quick lint check
LINT_OUTPUT=$(bun run lint 2>&1)
LINT_EXIT=$?
if [ $LINT_EXIT -ne 0 ]; then
  LINT_ERROR_COUNT=$(echo "$LINT_OUTPUT" | grep -cE '(error|✖)' 2>/dev/null || echo "0")
  FINDINGS="${FINDINGS}LINT: $LINT_ERROR_COUNT lint error(s) found after commit\n"
  FINDING_COUNT=$((FINDING_COUNT + LINT_ERROR_COUNT))
fi

# --- Report findings ---
if [ $FINDING_COUNT -gt 0 ]; then
  log_diagnostic "SELF-REVIEW" "post-commit" "$FINDING_COUNT issue(s) detected in committed code"

  # Escape findings for JSON
  ESCAPED_FINDINGS=$(printf '%b' "$FINDINGS" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' ')

  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PostToolUse\",\"additionalContext\":\"POST-COMMIT REVIEW: $FINDING_COUNT issue(s) found in committed code. $ESCAPED_FINDINGS Fix these before proceeding to the next wave.\"}}"
  exit 0
fi

# Clean commit — no issues
exit 0
