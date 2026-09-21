#!/usr/bin/env bash
# PreToolUse hook (Bash): gate checkpoint commits with tsc + lint verification.
# Ensures no broken code enters git history during Moku build waves.
#
# Only triggers on `git commit` commands during active build waves.
# Runs bunx tsc --noEmit and bun run lint — blocks the commit if either fails.


INPUT=$(cat)

# --- Extract the bash command ---
if command -v jq &>/dev/null; then
  COMMAND=$(jq -r '.tool_input.command // empty' <<< "$INPUT" 2>/dev/null)
elif command -v python3 &>/dev/null; then
  COMMAND=$(python3 -c "import sys,json; ti=json.loads(sys.stdin.read()).get('tool_input',{}); print(ti.get('command',''))" <<< "$INPUT" 2>/dev/null)
else
  exit 0
fi

[ -z "$COMMAND" ] && exit 0

# Only act in a Moku project with active planning state
[ -f .planning/STATE.md ] || exit 0
[ -f .planning/moku.md ] || exit 0

# --- Guard (Moku projects only — gated above): never stage or commit .planning/ ---
# .planning/ is local-only state and is gitignored. It reaches history only via an explicit
# `git add .planning…`, a force-add bypassing .gitignore, or an explicit commit pathspec.
# Judge ONLY the `git add` / `git stage` / `git commit` part of the command: split it at ; & | and
# newlines and keep the parts that start such a git call. A read-only command next to it
# (`git check-ignore .planning`, `ls .planning`) and the lines of a heredoc commit message are other
# parts, so they never trigger. Then match `.planning` as a real path token: strip any -m/--message
# value first (so a commit *message* mentioning .planning/ doesn't trigger), and require a leading
# boundary and a trailing slash/space/EOL (so a filename like `my.planning-notes.md` doesn't trigger).
GITCMD=$(printf '%s' "${COMMAND//$'\\\n'/ }" \
  | tr ';&|' '\n\n\n' \
  | grep -E '^[[:space:]]*git[[:space:]]+(add|stage|commit)([[:space:]]|$)' \
  | sed -E "s/(-m|--message)[[:space:]]*(\"[^\"]*\"|'[^']*'|[^[:space:]]+)//g")
if printf '%s' "$GITCMD" | grep -Eq '(^|[[:space:]/])\.planning([/[:space:]]|$)'; then
  echo "BLOCKED: .planning/ is local-only state and must never be staged or committed. Remove the .planning path from this git command (it is gitignored on purpose). If .gitignore is missing the entry, add '.planning/' to .gitignore instead of force-adding." >&2
  exit 2
fi

# Only trigger on git commit commands
case "$COMMAND" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

# Skip for planning-only commits (STATE.md updates, spec writes)
# These don't contain source code and don't need verification
case "$COMMAND" in
  *"pre-wave"*|*"checkpoint"*|*"skeleton"*) ;;  # Build commits — verify these
  *"planning"*|*"specs"*|*"STATE"*) exit 0 ;;    # Planning commits — skip
esac

# Only gate during active build waves or skeleton builds
ACTIVE_WAVE=$(grep -E '\|\s*(active|building|in-progress)\s*\|' .planning/STATE.md 2>/dev/null | head -1)
SKELETON_STATUS=$(grep '^## Skeleton:' .planning/STATE.md 2>/dev/null | sed 's/## Skeleton: //' | tr -d ' ')

if [ -z "$ACTIVE_WAVE" ] && [ "$SKELETON_STATUS" != "in-progress" ]; then
  exit 0
fi

# --- Run verification checks ---
ERRORS=""

# Check 1: TypeScript compilation
TSC_OUTPUT=$(bunx tsc --noEmit 2>&1)
TSC_EXIT=$?
if [ $TSC_EXIT -ne 0 ]; then
  # grep -c always prints a count (0 on no match, exiting 1) — an `|| echo` here would
  # append a SECOND line and embed "0\n?" in the BLOCKED message. Sanitize via default expansion.
  TSC_ERROR_COUNT=$(echo "$TSC_OUTPUT" | grep -c 'error TS' 2>/dev/null)
  TSC_ERROR_COUNT=${TSC_ERROR_COUNT:-?}
  ERRORS="${ERRORS}TypeScript: $TSC_ERROR_COUNT error(s). "
fi

# Check 2: Lint
LINT_OUTPUT=$(bun run lint 2>&1)
LINT_EXIT=$?
if [ $LINT_EXIT -ne 0 ]; then
  LINT_ERROR_COUNT=$(echo "$LINT_OUTPUT" | grep -cE '(error|✖)' 2>/dev/null)
  LINT_ERROR_COUNT=${LINT_ERROR_COUNT:-?}
  ERRORS="${ERRORS}Lint: $LINT_ERROR_COUNT error(s). "
fi

# --- Gate decision ---
if [ -n "$ERRORS" ]; then

  # Escape for JSON
  ESCAPED=$(printf '%s' "$ERRORS" | sed 's/\\/\\\\/g; s/"/\\"/g')

  echo "BLOCKED: Commit gate failed — $ESCAPED Fix these errors before committing. Run bunx tsc --noEmit and bun run lint to see details." >&2
  exit 2
fi

# Verification passed — allow the commit
exit 0
