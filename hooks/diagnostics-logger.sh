#!/usr/bin/env bash
# Shared diagnostics logging library — source this from other hooks.
# Writes structured entries to .planning/build/diagnostics.log for analysis.
#
# Usage: log_diagnostic "CATEGORY" "TARGET" "message"
#
# Categories:
#   PERM-DENY   — dangerous operation blocked by auto-permissions
#   ANTIPATTERN — plugin code anti-pattern blocked
#   INDEX-RULE  — index.ts constraint violated
#   STRUCTURE   — plugin structure warning
#   TOOL-FAIL   — tool execution failure
#   STOP-BLOCK  — Claude prevented from stopping mid-wave
#   SELF-REVIEW — post-commit self-review finding
#   COMMIT-GATE — pre-commit verification gate result

log_diagnostic() {
  local category="$1" target="$2" message="$3"
  local logfile=".planning/build/diagnostics.log"

  # Only log if planning state exists (consistent with other loggers)
  [ -f .planning/STATE.md ] || return 0

  # Ensure .planning directory exists
  [ -d .planning ] || return 0

  # Flatten newlines, truncate to 300 chars
  message="${message//$'\n'/ }"
  message=$(printf '%.300s' "$message")

  # Sanitize for log format (remove control chars)
  message=$(printf '%s' "$message" | tr -d '\r')

  printf '%s [%s] %s: %s\n' "$(date '+%H:%M:%S')" "$category" "$target" "$message" >> "$logfile" 2>/dev/null
}
