#!/usr/bin/env bash
# Moku status line script for Claude Code.
# Receives session JSON via stdin, outputs ANSI-colored status bar.
# Install: /statusline or configure in ~/.claude/settings.json:
#   { "statusLine": { "type": "command", "command": "path/to/moku-statusline.sh" } }

INPUT=$(cat)

# --- Parse session data ---
if command -v jq &>/dev/null; then
  MODEL=$(jq -r '.model.display_name // empty' <<< "$INPUT" 2>/dev/null)
  CTX_PCT=$(jq -r '.context_window.used_percentage // empty' <<< "$INPUT" 2>/dev/null)
  COST=$(jq -r '.cost.total_cost_usd // empty' <<< "$INPUT" 2>/dev/null)
  AGENT=$(jq -r '.agent.name // empty' <<< "$INPUT" 2>/dev/null)
  RATE_5H=$(jq -r '.rate_limits.five_hour.used_percentage // empty' <<< "$INPUT" 2>/dev/null)
  CWD=$(jq -r '.cwd // empty' <<< "$INPUT" 2>/dev/null)
else
  # Minimal fallback without jq — extract key fields via grep
  MODEL=$(printf '%s' "$INPUT" | grep -oE '"display_name"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"//;s/"//')
  CTX_PCT=$(printf '%s' "$INPUT" | grep -oE '"used_percentage"\s*:\s*[0-9.]+' | head -1 | sed 's/.*: *//')
  COST=""
  AGENT=""
  RATE_5H=""
  CWD=""
fi

# --- Colors ---
RESET='\033[0m'
DIM='\033[2m'
BOLD='\033[1m'
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
MAGENTA='\033[35m'
BLUE='\033[34m'
WHITE='\033[37m'

# --- Context progress bar ---
CTX_INT=${CTX_PCT%.*}
CTX_INT=${CTX_INT:-0}

# Color based on usage level
if [ "$CTX_INT" -ge 80 ]; then
  CTX_COLOR="$RED"
elif [ "$CTX_INT" -ge 60 ]; then
  CTX_COLOR="$YELLOW"
else
  CTX_COLOR="$GREEN"
fi

# Build 10-char progress bar
FILLED=$((CTX_INT / 10))
EMPTY=$((10 - FILLED))
BAR=""
for ((i=0; i<FILLED; i++)); do BAR="${BAR}█"; done
for ((i=0; i<EMPTY; i++)); do BAR="${BAR}░"; done

CTX_SEGMENT="${CTX_COLOR}${BAR} ${CTX_INT}%${RESET}"

# --- Model segment ---
MODEL_SEGMENT=""
if [ -n "$MODEL" ]; then
  MODEL_SEGMENT="${DIM}${MODEL}${RESET}"
fi

# --- Cost segment ---
COST_SEGMENT=""
if [ -n "$COST" ] && [ "$COST" != "0" ]; then
  COST_FMT=$(printf '%.2f' "$COST" 2>/dev/null || echo "$COST")
  COST_SEGMENT="${DIM}\$${COST_FMT}${RESET}"
fi

# --- Rate limit segment ---
RATE_SEGMENT=""
if [ -n "$RATE_5H" ]; then
  RATE_INT=${RATE_5H%.*}
  RATE_INT=${RATE_INT:-0}
  if [ "$RATE_INT" -ge 80 ]; then
    RATE_SEGMENT="${RED}Rate:${RATE_INT}%${RESET}"
  elif [ "$RATE_INT" -ge 60 ]; then
    RATE_SEGMENT="${YELLOW}Rate:${RATE_INT}%${RESET}"
  fi
fi

# --- Agent segment ---
AGENT_SEGMENT=""
if [ -n "$AGENT" ] && [ "$AGENT" != "null" ]; then
  AGENT_SEGMENT="${MAGENTA}[${AGENT}]${RESET}"
fi

# --- Git branch ---
GIT_BRANCH=""
if [ -n "$CWD" ] && [ -d "$CWD/.git" ]; then
  GIT_BRANCH=$(git -C "$CWD" symbolic-ref --short HEAD 2>/dev/null || git -C "$CWD" rev-parse --short HEAD 2>/dev/null)
elif [ -d .git ]; then
  GIT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD 2>/dev/null)
fi

GIT_SEGMENT=""
if [ -n "$GIT_BRANCH" ]; then
  GIT_SEGMENT="${BLUE}${GIT_BRANCH}${RESET}"
fi

# --- Moku project state ---
MOKU_SEGMENT=""
PROJECT_DIR="${CWD:-.}"

if [ -f "$PROJECT_DIR/.planning/STATE.md" ]; then
  PHASE=$(grep '^## Phase:' "$PROJECT_DIR/.planning/STATE.md" 2>/dev/null | head -1 | sed 's/## Phase: //')
  SKELETON=$(grep '^## Skeleton:' "$PROJECT_DIR/.planning/STATE.md" 2>/dev/null | head -1 | sed 's/## Skeleton: //' | tr -d ' ')

  if [ -n "$PHASE" ]; then
    # Determine phase icon and color
    case "$PHASE" in
      stage1/*) PHASE_ICON="1" ; PHASE_COLOR="$CYAN" ; PHASE_LABEL="Plan S1" ;;
      stage2/*) PHASE_ICON="2" ; PHASE_COLOR="$CYAN" ; PHASE_LABEL="Plan S2" ;;
      stage3/*) PHASE_ICON="3" ; PHASE_COLOR="$CYAN" ; PHASE_LABEL="Plan S3" ;;
      complete) PHASE_ICON="*" ; PHASE_COLOR="$GREEN" ; PHASE_LABEL="Planned" ;;
      build/wave-*)
        WAVE_NUM=$(echo "$PHASE" | grep -oE '[0-9]+')
        # Count total waves
        TOTAL_WAVES=$(grep -cE '^\| [0-9]' "$PROJECT_DIR/.planning/STATE.md" 2>/dev/null)
        if [ -z "$TOTAL_WAVES" ] || [ "$TOTAL_WAVES" -eq 0 ]; then
          TOTAL_WAVES="?"
        fi
        PHASE_ICON="W" ; PHASE_COLOR="$YELLOW" ; PHASE_LABEL="Wave ${WAVE_NUM}/${TOTAL_WAVES}"
        ;;
      build/complete) PHASE_ICON="+" ; PHASE_COLOR="$GREEN" ; PHASE_LABEL="Built" ;;
      *) PHASE_ICON=">" ; PHASE_COLOR="$WHITE" ; PHASE_LABEL="$PHASE" ;;
    esac

    # Plugin progress for build phases
    PLUGIN_PROGRESS=""
    if [[ "$PHASE" == build/* ]]; then
      VERIFIED=$(grep -cE '\| verified\s*\||\| committed\s*\|' "$PROJECT_DIR/.planning/STATE.md" 2>/dev/null)
      TOTAL_PLUGINS=$(grep -cE '^\|[^|]+\|[^|]+\|[^|]+\|' "$PROJECT_DIR/.planning/STATE.md" 2>/dev/null)
      # Subtract header/separator rows
      TOTAL_PLUGINS=$((TOTAL_PLUGINS > 2 ? TOTAL_PLUGINS - 2 : 0))
      VERIFIED=${VERIFIED:-0}
      if [ "$TOTAL_PLUGINS" -gt 0 ]; then
        PLUGIN_PROGRESS=" ${VERIFIED}/${TOTAL_PLUGINS}"
      fi
    fi

    # Skeleton indicator
    SKEL=""
    case "$SKELETON" in
      in-progress) SKEL=" ${YELLOW}skel${RESET}" ;;
      verified)    SKEL=" ${GREEN}skel${RESET}" ;;
    esac

    MOKU_SEGMENT="${PHASE_COLOR}${BOLD}${PHASE_LABEL}${RESET}${PLUGIN_PROGRESS}${SKEL}"
  fi
elif [ -f "$PROJECT_DIR/.planning/moku.md" ]; then
  MOKU_SEGMENT="${DIM}moku${RESET}"
fi

# --- Assemble status line ---
# Format: [Moku State] | Context Bar | Model | $Cost | Git | [Agent] | Rate
PARTS=()
[ -n "$MOKU_SEGMENT" ] && PARTS+=("$MOKU_SEGMENT")
PARTS+=("$CTX_SEGMENT")
[ -n "$MODEL_SEGMENT" ] && PARTS+=("$MODEL_SEGMENT")
[ -n "$COST_SEGMENT" ] && PARTS+=("$COST_SEGMENT")
[ -n "$GIT_SEGMENT" ] && PARTS+=("$GIT_SEGMENT")
[ -n "$AGENT_SEGMENT" ] && PARTS+=("$AGENT_SEGMENT")
[ -n "$RATE_SEGMENT" ] && PARTS+=("$RATE_SEGMENT")

# Join with dim separator
SEP="${DIM} | ${RESET}"
OUTPUT=""
for i in "${!PARTS[@]}"; do
  if [ "$i" -gt 0 ]; then
    OUTPUT="${OUTPUT}${SEP}"
  fi
  OUTPUT="${OUTPUT}${PARTS[$i]}"
done

printf '%b\n' "$OUTPUT"
