#!/usr/bin/env bash
# PermissionRequest hook: auto-approve safe operations, block dangerous ones.
# Wide permissions — block only truly catastrophic operations.
# Falls through to user prompt for ambiguous cases.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/diagnostics-logger.sh" 2>/dev/null || true

INPUT=$(cat)

# --- Parse tool_name, tool_input fields, and cwd ---
# Priority: jq (fast) → python3 (reliable) → exit 0 (let user decide)
if command -v jq &>/dev/null; then
  TOOL_NAME=$(jq -r '.tool_name // empty' <<< "$INPUT" 2>/dev/null)
  COMMAND=$(jq -r '.tool_input.command // empty' <<< "$INPUT" 2>/dev/null)
  FILE_PATH=$(jq -r '.tool_input.file_path // empty' <<< "$INPUT" 2>/dev/null)
  CWD=$(jq -r '.cwd // empty' <<< "$INPUT" 2>/dev/null)
elif command -v python3 &>/dev/null; then
  PARSED=$(python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
ti = d.get('tool_input', {})
print(d.get('tool_name', ''))
print(ti.get('command', ''))
print(ti.get('file_path', ''))
print(d.get('cwd', ''))
" <<< "$INPUT" 2>/dev/null)
  TOOL_NAME=$(echo "$PARSED" | sed -n '1p')
  COMMAND=$(echo "$PARSED" | sed -n '2p')
  FILE_PATH=$(echo "$PARSED" | sed -n '3p')
  CWD=$(echo "$PARSED" | sed -n '4p')
else
  exit 0
fi

[ -z "$TOOL_NAME" ] && exit 0

# --- Helper functions ---
emit_allow() {
  echo '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}'
}

emit_deny() {
  local reason="$1"
  log_diagnostic "PERM-DENY" "$TOOL_NAME" "$reason"
  # Escape double quotes and backslashes in reason for JSON safety
  local safe_reason
  safe_reason=$(printf '%s' "$reason" | sed 's/\\/\\\\/g; s/"/\\"/g')
  printf '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"deny","message":"%s"}}}' "$safe_reason"
}

# ============================================================
# PHASE 1: Auto-approve read-only and gated tools
# ============================================================
case "$TOOL_NAME" in
  Read|Glob|Grep|WebSearch|WebFetch|Agent|Skill|NotebookRead|LS|TaskOutput|TodoWrite|NotebookEdit)
    emit_allow
    exit 0
    ;;
esac

# ============================================================
# PHASE 2: Write/Edit — approve within project, ask otherwise
# ============================================================
case "$TOOL_NAME" in
  Write|Edit)
    if [ -n "$FILE_PATH" ] && [ -n "$CWD" ]; then
      # Approve if file is within the project directory
      case "$FILE_PATH" in
        "$CWD"/*|"$CWD")
          emit_allow
          exit 0
          ;;
      esac
    fi
    # Outside project or can't determine — let user decide
    exit 0
    ;;
esac

# ============================================================
# PHASE 3: Bash command analysis
# ============================================================
if [ "$TOOL_NAME" != "Bash" ]; then
  # Unknown tool — let user decide
  exit 0
fi

[ -z "$COMMAND" ] && exit 0

# --- 3A: BLOCK LIST — deny dangerous commands ---

# Privilege escalation
if printf '%s' "$COMMAND" | grep -qE '(^|[;&|]\s*)sudo\s'; then
  emit_deny "BLOCKED: sudo is not allowed — all operations must run as current user"
  exit 0
fi

# Catastrophic deletion
if printf '%s' "$COMMAND" | grep -qE 'rm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)?(-[a-zA-Z]*r[a-zA-Z]*\s+)?(\/|~\/?\s|~\/?\.|"\$HOME"|\/Users\/[a-z]+\/?\s)'; then
  # Check it's actually rm -rf on root/home, not rm -rf node_modules
  if ! printf '%s' "$COMMAND" | grep -qE 'rm\s+-rf\s+(node_modules|\.planning|dist|build|coverage|\.turbo|\.cache|\.next|\.nuxt|\.output|tmp|\.tmp|\.vite|\.vitest|out)\b'; then
    emit_deny "BLOCKED: Destructive rm on root/home directory"
    exit 0
  fi
fi

# Force push
if printf '%s' "$COMMAND" | grep -qE 'git\s+push\s+.*(-f|--force|--force-with-lease)'; then
  emit_deny "BLOCKED: git force-push — use regular git push or ask explicitly"
  exit 0
fi

# Hard reset
if printf '%s' "$COMMAND" | grep -qE 'git\s+reset\s+--hard'; then
  emit_deny "BLOCKED: git reset --hard — this discards uncommitted work"
  exit 0
fi

# Clean untracked files
if printf '%s' "$COMMAND" | grep -qE 'git\s+clean\s+-[a-zA-Z]*[fd]'; then
  emit_deny "BLOCKED: git clean -f — this deletes untracked files permanently"
  exit 0
fi

# Pipe-to-shell (RCE)
if printf '%s' "$COMMAND" | grep -qE 'curl\s.*\|\s*(ba)?sh|wget\s.*\|\s*(ba)?sh|bash\s*<\s*\(curl|bash\s*<\s*\(wget'; then
  emit_deny "BLOCKED: pipe-to-shell pattern detected — potential remote code execution"
  exit 0
fi

# Raw disk operations
if printf '%s' "$COMMAND" | grep -qE '(^|[;&|]\s*)dd\s+if='; then
  emit_deny "BLOCKED: dd command — raw disk operations are not allowed"
  exit 0
fi

# Writes to system/sensitive directories
if printf '%s' "$COMMAND" | grep -qE '>\s*/(etc|usr|System)/|>\s*~/\.ssh/|>\s*~/\.aws/'; then
  emit_deny "BLOCKED: writing to system/sensitive directory"
  exit 0
fi

# Package publishing
if printf '%s' "$COMMAND" | grep -qE '(npm|bun|yarn|pnpm)\s+publish'; then
  emit_deny "BLOCKED: package publish — must be done manually and intentionally"
  exit 0
fi

# World-writable permissions
if printf '%s' "$COMMAND" | grep -qE 'chmod\s+777'; then
  emit_deny "BLOCKED: chmod 777 — world-writable permissions are a security risk"
  exit 0
fi

# Device writes
if printf '%s' "$COMMAND" | grep -qE '>\s*/dev/(sd|hd|nvme|disk)'; then
  emit_deny "BLOCKED: writing to block device"
  exit 0
fi

# --- 3B: rm -rf on unknown dirs — let user decide ---
# Safe cleanup targets are auto-approved; unknown dirs need user confirmation
if printf '%s' "$COMMAND" | grep -qE 'rm\s+-[a-zA-Z]*r[a-zA-Z]*\s+-?[a-zA-Z]*f'; then
  # rm -rf detected — check if target is a known safe cleanup dir
  if ! printf '%s' "$COMMAND" | grep -qE 'rm\s+-rf\s+(node_modules|\.planning|dist|build|coverage|\.turbo|\.cache|\.next|\.nuxt|\.output|tmp|\.tmp|\.vite|\.vitest|out)\b'; then
    # Unknown target — let user decide
    exit 0
  fi
fi
# Also catch "rm -f -r" variant
if printf '%s' "$COMMAND" | grep -qE 'rm\s+-[a-zA-Z]*f[a-zA-Z]*\s+-?[a-zA-Z]*r'; then
  if ! printf '%s' "$COMMAND" | grep -qE 'rm\s+.*\s+(node_modules|\.planning|dist|build|coverage|\.turbo|\.cache|\.next|\.nuxt|\.output|tmp|\.tmp|\.vite|\.vitest|out)\b'; then
    exit 0
  fi
fi

# --- 3C: SAFE COMMANDS — auto-approve ---

# Extract first command word from each pipe segment and check if ALL are safe.
# Handle: "VAR=x cmd", "cd dir && cmd", env vars, subshells
ALL_SAFE=true

# Split command on pipes, semicolons, &&, || — check each segment
while IFS= read -r segment; do
  [ -z "$segment" ] && continue

  # Strip leading whitespace
  segment="${segment#"${segment%%[![:space:]]*}"}"
  [ -z "$segment" ] && continue

  # Strip leading env var assignments (VAR=val VAR2=val2 cmd)
  local_seg="$segment"
  while printf '%s' "$local_seg" | grep -qE '^[A-Za-z_][A-Za-z_0-9]*=\S+\s'; do
    local_seg=$(printf '%s' "$local_seg" | sed 's/^[A-Za-z_][A-Za-z_0-9]*=[^ ]* //')
  done

  # Get the first word (the command)
  CMD_WORD=$(printf '%s' "$local_seg" | awk '{print $1}')
  [ -z "$CMD_WORD" ] && continue

  # Strip path prefix (e.g., /usr/bin/git → git, ./node_modules/.bin/tsc → tsc)
  CMD_WORD=$(basename "$CMD_WORD" 2>/dev/null || echo "$CMD_WORD")

  case "$CMD_WORD" in
    # Version control
    git) ;;
    # File inspection (read-only)
    ls|wc|grep|rg|find|cat|head|tail|less|more|file|stat|du|df) ;;
    # File manipulation (within project, gated by CWD check below)
    mkdir|cp|mv|touch|ln) ;;
    # Text processing
    echo|printf|date|basename|dirname|sort|uniq|tr|sed|awk|xargs|cut|paste|tee|column|fold|fmt|rev|comm|join) ;;
    # Testing and type checking
    bun|bunx|npx|node|python3|python|tsc|biome|eslint|vitest|jest|prettier) ;;
    # Shell builtins and utilities
    test|\[|true|false|pwd|env|whoami|which|command|type|export|set|unset|source|\.|read|eval) ;;
    # Process and system info
    ps|pgrep|top|htop|uptime|uname|arch|sw_vers|sysctl) ;;
    # chmod (not 777 — already blocked above)
    chmod) ;;
    # rm (single files or safe dirs — catastrophic rm already blocked above)
    rm) ;;
    # tar/zip (archive operations)
    tar|zip|unzip|gzip|gunzip|bzip2) ;;
    # Network (read-only fetch)
    curl|wget|http|https) ;;
    # diff tools
    diff|cmp|md5|md5sum|sha256sum|shasum) ;;
    # Editors (non-interactive usage, e.g. sed is already covered)
    jq|yq) ;;
    # cd, pushd, popd
    cd|pushd|popd) ;;
    # for/while/do/done/if/then/else/fi (shell control flow)
    for|while|do|done|if|then|else|elif|fi|case|esac|in) ;;
    # gh CLI
    gh) ;;
    # noop / sleep
    sleep|wait|noop|:) ;;
    *)
      ALL_SAFE=false
      break
      ;;
  esac
done <<< "$(printf '%s' "$COMMAND" | sed 's/[|;&]\{1,2\}/\n/g')"

if [ "$ALL_SAFE" = "true" ]; then
  # git push (any form) — always let user decide
  if printf '%s' "$COMMAND" | grep -qE 'git\s+push\b'; then
    exit 0
  fi
  emit_allow
  exit 0
fi

# --- 3D: Fall through — let user decide ---
exit 0
