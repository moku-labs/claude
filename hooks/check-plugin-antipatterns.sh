#!/usr/bin/env bash
# PreToolUse hook: detect common Moku anti-patterns in Write/Edit content.
# Blocks the tool use with a clear error message so Claude can self-correct.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/diagnostics-logger.sh" 2>/dev/null || true

INPUT=$(cat)

# Quick exit if not a Moku project
[ -f .planning/moku.md ] || exit 0

# Extract file_path and content/new_string from JSON input (nested under tool_input)
# Priority: jq (fast) → python3 (reliable) → exit with warning (no silent failure)
if command -v jq &>/dev/null; then
  FILE_PATH=$(jq -r '.tool_input.file_path // empty' <<< "$INPUT" 2>/dev/null)
  CONTENT=$(jq -r '.tool_input.content // .tool_input.new_string // empty' <<< "$INPUT" 2>/dev/null)
elif command -v python3 &>/dev/null; then
  FILE_PATH=$(python3 -c "import sys,json; ti=json.loads(sys.stdin.read()).get('tool_input',{}); print(ti.get('file_path',''))" <<< "$INPUT" 2>/dev/null)
  CONTENT=$(python3 -c "import sys,json; ti=json.loads(sys.stdin.read()).get('tool_input',{}); print(ti.get('content','') or ti.get('new_string',''))" <<< "$INPUT" 2>/dev/null)
else
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"Anti-pattern check skipped: neither jq nor python3 available. Install one for Moku hook support."}}'
  exit 0
fi

# Only check plugin source files (not specs, not planning files, not tests)
case "$FILE_PATH" in
  *.test.ts|*.spec.ts|*.test.tsx|*.spec.tsx) exit 0 ;;  # Tests may legitimately use blocked patterns
  */__tests__/*) exit 0 ;;  # Test directories
  */vitest.setup.ts|*/vitest.config.ts|*.mock.ts|*.mock.tsx|*.fixture.ts) exit 0 ;;  # Test infrastructure
  */plugins/*/index.ts) ;;
  */plugins/*/config.ts) ;;
  */plugins/*) ;;
  *) exit 0 ;;
esac

# Check 1: Explicit generics on createPlugin (CRITICAL anti-pattern)
if printf '%s\n' "$CONTENT" | grep -q 'createPlugin<'; then
  log_diagnostic "ANTIPATTERN" "$FILE_PATH" "createPlugin< — explicit generics detected"
  echo "BLOCKED: Explicit generics on createPlugin detected (e.g. createPlugin<Config, State, ...>). This is a CRITICAL anti-pattern in Moku — all types must be inferred from the spec object. Remove the generic parameters and let TypeScript infer them. See the moku-plugin skill for correct patterns." >&2
  exit 2
fi

# Check 2: Unsafe type assertions in plugin source files
if printf '%s\n' "$CONTENT" | grep -q 'as any'; then
  log_diagnostic "ANTIPATTERN" "$FILE_PATH" "as any — unsafe type assertion"
  echo 'BLOCKED: "as any" detected in plugin source. Use proper typing or "as unknown as TargetType" if a cast is truly necessary. Moku plugins rely on type inference — "as any" defeats the type system.' >&2
  exit 2
fi

# Check 3: Explicit generics on createCorePlugin (same anti-pattern as createPlugin)
if printf '%s\n' "$CONTENT" | grep -q 'createCorePlugin<'; then
  log_diagnostic "ANTIPATTERN" "$FILE_PATH" "createCorePlugin< — explicit generics detected"
  echo "BLOCKED: Explicit generics on createCorePlugin detected. Same rule as createPlugin — all types must be inferred from the spec object. Remove the generic parameters." >&2
  exit 2
fi

# Check 4: "Plugin" postfix in exported plugin variable names
if printf '%s\n' "$CONTENT" | grep -qE 'export const [a-z][a-zA-Z]*Plugin\b'; then
  log_diagnostic "ANTIPATTERN" "$FILE_PATH" "Plugin postfix in export name"
  echo 'BLOCKED: Plugin export name has "Plugin" postfix (e.g. routePlugin). Moku convention: use bare name matching the plugin string name (e.g. route). See moku-plugin skill for naming rules.' >&2
  exit 2
fi

# Check 5: Wire factory pattern — function wireXxx wrapping createPlugin
if printf '%s\n' "$CONTENT" | grep -qE 'function wire[A-Z]'; then
  log_diagnostic "ANTIPATTERN" "$FILE_PATH" "wire factory pattern (function wireXxx)"
  echo "BLOCKED: Wire factory pattern detected (function wireXxx...). Moku plugins import createPlugin and dependencies directly — no factory indirection. See moku-plugin skill Common Mistakes." >&2
  exit 2
fi

# Check 6: Inline type assertions in state/config (null as X, {} as X, [] as X, {content} as Type)
if printf '%s\n' "$CONTENT" | grep -qE 'null as [A-Za-z_]|\{\} as |\[\] as |\} as [A-Z]'; then
  log_diagnostic "ANTIPATTERN" "$FILE_PATH" "inline type assertion (null as X / {} as X / [] as X / {content} as Type)"
  echo "BLOCKED: Inline type assertion detected (e.g. null as Foo, {} as Bar, { key: val } as Record<K,V>). For Standard+ plugins, define a type and use a typed factory. For Nano/Micro, use a return-type annotation. See moku-plugin skill Common Mistakes." >&2
  exit 2
fi

# No issues found — don't interfere
exit 0
