#!/usr/bin/env bash
# PreToolUse hook: validate plugins/*/index.ts content constraints.
# Fast-path exits 0 immediately for all other files — no LLM, no delay.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/diagnostics-logger.sh" 2>/dev/null || true

INPUT=$(cat)

# Quick exit if not a Moku project
[ -f .planning/moku.md ] || exit 0

# Parse file path, content, and tool type (nested under tool_input)
if command -v jq &>/dev/null; then
  FILE_PATH=$(jq -r '.tool_input.file_path // empty' <<< "$INPUT" 2>/dev/null)
  CONTENT=$(jq -r '.tool_input.content // .tool_input.new_string // empty' <<< "$INPUT" 2>/dev/null)
  IS_WRITE=$(jq -r 'if .tool_input.content != null then "yes" else "no" end' <<< "$INPUT" 2>/dev/null)
elif command -v python3 &>/dev/null; then
  FILE_PATH=$(python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('tool_input',{}).get('file_path',''))" <<< "$INPUT" 2>/dev/null)
  CONTENT=$(python3 -c "import sys,json; ti=json.loads(sys.stdin.read()).get('tool_input',{}); print(ti.get('content','') or ti.get('new_string',''))" <<< "$INPUT" 2>/dev/null)
  IS_WRITE=$(python3 -c "import sys,json; print('yes' if json.loads(sys.stdin.read()).get('tool_input',{}).get('content') is not None else 'no')" <<< "$INPUT" 2>/dev/null)
else
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"WARNING: Plugin index validation skipped — neither jq nor python3 available. Install one for Moku hook support."}}'
  exit 0
fi

# Fast-path: only validate plugins/*/index.ts — everything else approved instantly
case "$FILE_PATH" in
  */plugins/*/index.ts) ;;   # fall through to checks
  *) exit 0 ;;
esac

# Rule 1: ≤30 lines, wiring-only (Write only — Edit's new_string is a partial replacement)
if [ "$IS_WRITE" = "yes" ]; then
  # Count EFFECTIVE wiring lines only — exclude blank lines, comment-only lines (// and JSDoc * /** */),
  # and import lines. The JSDoc header + imports are not "wiring" and previously inflated the count,
  # causing pervasive false INDEX-RULE hits on otherwise-correct files.
  EFFECTIVE=$(printf '%s\n' "$CONTENT" \
    | grep -vE '^[[:space:]]*$' \
    | grep -vE '^[[:space:]]*(//|/\*|\*)' \
    | grep -vE '^[[:space:]]*import[[:space:]]' \
    | wc -l | tr -d ' ')
  if [ "$EFFECTIVE" -gt 30 ]; then
    log_diagnostic "INDEX-RULE" "$FILE_PATH" "index.ts has $EFFECTIVE effective wiring lines (max 30; blanks/comments/imports excluded)"
    echo "BLOCKED: plugins/*/index.ts must be ≤30 wiring lines (the JSDoc header, blank lines, and imports do NOT count), got $EFFECTIVE. Move logic into module files (state.ts/api.ts/handlers.ts). See skeleton-conventions.md for the literal wiring template." >&2
    exit 2
  fi
fi

# Rule 2: explicit type params — already blocked by check-plugin-antipatterns.sh

# Rule 3: onStart/onStop must reference a real resource lifecycle method.
# Escape hatch: a one-line `// @no-resource-check — <why>` comment opts out (e.g. a plugin that
# legitimately manages DOM/navigation listeners, which a regex can't reliably recognize).
if printf '%s\n' "$CONTENT" | grep -qE '\bon(Start|Stop)\s*:'; then
  if printf '%s\n' "$CONTENT" | grep -qE '@no-resource-check'; then
    : # explicitly justified — allow
  elif ! printf '%s\n' "$CONTENT" | grep -qE '\.(listen|close|connect|disconnect|start|stop|end|destroy|kill|open|shutdown|init|initialize|cleanup|dispose|terminate|release|addEventListener|removeEventListener|subscribe|unsubscribe|observe|watch|unwatch|abort|flush)\('; then
    log_diagnostic "INDEX-RULE" "$FILE_PATH" "onStart/onStop without real resource lifecycle"
    echo "BLOCKED: onStart/onStop in index.ts must manage a real resource (server/connection/listener). If this is intentional (e.g. DOM/nav listeners), add a one-line '// @no-resource-check — <why>' comment to suppress. Otherwise remove the lifecycle hooks." >&2
    exit 2
  fi
fi

exit 0
