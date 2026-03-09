#!/usr/bin/env bash
# PreToolUse hook: detect common Moku anti-patterns in Write/Edit content.
# Blocks the tool use with a clear error message so Claude can self-correct.

INPUT="$1"

# Extract file_path and content/new_string from JSON input
if command -v jq &>/dev/null; then
  FILE_PATH=$(jq -r '.file_path // empty' <<< "$INPUT" 2>/dev/null)
  # For Write tool: content field; for Edit tool: new_string field
  CONTENT=$(jq -r '.content // .new_string // empty' <<< "$INPUT" 2>/dev/null)
elif command -v python3 &>/dev/null; then
  FILE_PATH=$(python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('file_path',''))" <<< "$INPUT" 2>/dev/null)
  CONTENT=$(python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('content','') or d.get('new_string',''))" <<< "$INPUT" 2>/dev/null)
else
  FILE_PATH=$(printf '%s' "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
  CONTENT=$(printf '%s' "$INPUT" | grep -o '"content"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"content"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
  if [ -z "$CONTENT" ]; then
    CONTENT=$(printf '%s' "$INPUT" | grep -o '"new_string"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"new_string"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
  fi
fi

# Only check plugin source files (not specs, not planning files, not tests)
case "$FILE_PATH" in
  */plugins/*) ;;
  */config.ts) ;;
  */index.ts) ;;
  *) exit 0 ;;
esac

# Check 1: Explicit generics on createPlugin (CRITICAL anti-pattern)
if printf '%s\n' "$CONTENT" | grep -q 'createPlugin<'; then
  echo '{"decision":"block","reason":"BLOCKED: Explicit generics on createPlugin detected (e.g. createPlugin<Config, State, ...>). This is a CRITICAL anti-pattern in Moku — all types must be inferred from the spec object. Remove the generic parameters and let TypeScript infer them. See the moku-plugin skill for correct patterns."}'
  exit 0
fi

# Check 2: Unsafe type assertions in plugin source files
if printf '%s\n' "$CONTENT" | grep -q 'as any'; then
  echo '{"decision":"block","reason":"BLOCKED: \"as any\" detected in plugin source. Use proper typing or \"as unknown as TargetType\" if a cast is truly necessary. Moku plugins rely on type inference — \"as any\" defeats the type system."}'
  exit 0
fi

# Check 3: Explicit generics on createCorePlugin (same anti-pattern as createPlugin)
if printf '%s\n' "$CONTENT" | grep -q 'createCorePlugin<'; then
  echo '{"decision":"block","reason":"BLOCKED: Explicit generics on createCorePlugin detected. Same rule as createPlugin — all types must be inferred from the spec object. Remove the generic parameters."}'
  exit 0
fi

# Check 4: "Plugin" postfix in exported plugin variable names
if printf '%s\n' "$CONTENT" | grep -qE 'export const [a-z][a-zA-Z]*Plugin\b'; then
  echo '{"decision":"block","reason":"BLOCKED: Plugin export name has \"Plugin\" postfix (e.g. routePlugin). Moku convention: use bare name matching the plugin string name (e.g. route). See moku-plugin skill for naming rules."}'
  exit 0
fi

# Check 5: Wire factory pattern — function wireXxx wrapping createPlugin
if printf '%s\n' "$CONTENT" | grep -qE 'function wire[A-Z]'; then
  echo '{"decision":"block","reason":"BLOCKED: Wire factory pattern detected (function wireXxx...). Moku plugins import createPlugin and dependencies directly — no factory indirection. See moku-plugin skill Common Mistakes."}'
  exit 0
fi

# Check 6: Inline type assertions in state/config (null as X, {} as X, [] as X)
if printf '%s\n' "$CONTENT" | grep -qE 'null as |^\s*\{\} as |\[\] as '; then
  echo '{"decision":"block","reason":"BLOCKED: Inline type assertion detected (e.g. null as Foo | null). For Standard+ plugins, define a type and use a typed factory. For Nano/Micro, use a return-type annotation. See moku-plugin skill Common Mistakes."}'
  exit 0
fi

# No issues found — don't interfere
exit 0
