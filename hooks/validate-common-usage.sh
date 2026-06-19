#!/usr/bin/env bash
# PreToolUse hook: detect raw console.* / process.env / hand-rolled CLI chrome in Write/Edit content,
# enforcing the @moku-labs/common family conventions (MC1–MC3). Blocks the tool use with a clear
# error message so Claude can self-correct. Conservative by design — prefers NOT firing over a false
# positive (see skills/moku-common/references/conventions.md).

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
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"Common-usage check skipped: neither jq nor python3 available. Install one for Moku hook support."}}'
  exit 0
fi

# Only check project source that CONSUMES @moku-labs/common: plugins, CLI, scripts.
# Skip tests, the brand-kit source itself, env providers, and a documented log sink.
case "$FILE_PATH" in
  *.test.ts|*.spec.ts|*.test.tsx|*.spec.tsx) exit 0 ;;       # Tests may use blocked patterns
  */__tests__/*) exit 0 ;;                                    # Test directories
  */vitest.setup.ts|*/vitest.config.ts|*.mock.ts|*.mock.tsx|*.fixture.ts) exit 0 ;;  # Test infra
  *.config.ts) exit 0 ;;                                      # Config files (build/tooling)
  */common/src/cli/*) exit 0 ;;                               # Brand-kit source — it IS the ANSI/box/spinner impl (MC1 N/A)
  */env/*|*env-provider.ts) exit 0 ;;                         # Env providers read process.env by definition (MC3 N/A)
  */plugins/*.ts|*/plugins/*/*.ts) ;;                         # Plugin source (any depth in src/plugins)
  */cli.ts|*/cli/*.ts) ;;                                     # CLI plugin / cli entry
  *cli*.ts) ;;                                                # cli-named entry (e.g. my-cli.ts)
  */scripts/*.ts) ;;                                          # scripts/ entries
  *) exit 0 ;;
esac

# MC2: raw console.* used for logging. Allowed: a single sink line marked `// @log-sink`.
# Be conservative — only block when there is at least one console.<level>( call that is NOT on a
# line carrying the @log-sink marker.
if printf '%s\n' "$CONTENT" | grep -E 'console\.(log|info|warn|error|debug|trace)\(' | grep -qv '@log-sink'; then
  log_diagnostic "ANTIPATTERN" "$FILE_PATH" "raw console.* — use ctx.log (MC2)"
  echo 'BLOCKED: raw console.* detected in plugin/CLI/script source (MC2). Use ctx.log.info/warn/error/debug for diagnostics, or the branded console from @moku-labs/common/cli for user-facing CLI output. A single low-level log sink may use console.* — mark that line with a `// @log-sink` comment. See the moku-common skill (skills/moku-common/references/conventions.md MC2).' >&2
  exit 2
fi

# MC3: raw process.env read. Env providers are excluded by the path scope above; a
# legitimate passthrough (e.g. spreading process.env into a spawned subprocess) may mark
# its line with `// @env-allow`. Only block when a process.env line lacks that marker.
if printf '%s\n' "$CONTENT" | grep -E 'process\.env' | grep -qv '@env-allow'; then
  log_diagnostic "ANTIPATTERN" "$FILE_PATH" "raw process.env — use ctx.env (MC3)"
  echo 'BLOCKED: raw process.env detected in plugin/CLI/script source (MC3). Use ctx.env.require("NAME") (must-exist) or ctx.env.get("NAME") (optional/defaulted) from the envPlugin in @moku-labs/common. Env providers are exempt; a legitimate passthrough (e.g. spreading process.env into a spawned subprocess) may mark that line with a `// @env-allow` comment. See the moku-common skill (skills/moku-common/references/conventions.md MC3).' >&2
  exit 2
fi

# No issues found — don't interfere
exit 0
