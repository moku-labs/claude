#!/usr/bin/env bash
# Moku notification helper — sends desktop notifications and optional sound alerts.
# Used by other hooks to signal key events to the user.
#
# Usage: source notify.sh
#        moku_notify "Title" "Message" [sound]
#
# Sounds (macOS): glass, basso, hero, ping, purr, submarine, tink
# Sound "none" or empty = silent notification
#
# Respects .claude/moku.local.md settings:
#   enableNotifications: true|false (default: true)
#   enableSounds: true|false (default: true)

# Read settings from .local.md (cached per invocation)
_MOKU_NOTIFY_ENABLED=""
_MOKU_SOUND_ENABLED=""

_moku_read_settings() {
  if [ -n "$_MOKU_NOTIFY_ENABLED" ]; then return; fi

  _MOKU_NOTIFY_ENABLED="true"
  _MOKU_SOUND_ENABLED="true"

  if [ -f .claude/moku.local.md ]; then
    local val
    val=$(grep 'enableNotifications:' .claude/moku.local.md 2>/dev/null | awk '{print $2}')
    [ "$val" = "false" ] && _MOKU_NOTIFY_ENABLED="false"

    val=$(grep 'enableSounds:' .claude/moku.local.md 2>/dev/null | awk '{print $2}')
    [ "$val" = "false" ] && _MOKU_SOUND_ENABLED="false"
  fi
}

moku_notify() {
  local title="$1" message="$2" sound="${3:-}"
  _moku_read_settings

  # --- Desktop notification ---
  if [ "$_MOKU_NOTIFY_ENABLED" = "true" ]; then
    case "$(uname -s)" in
      Darwin)
        osascript -e "display notification \"$message\" with title \"$title\"" 2>/dev/null &
        ;;
      Linux)
        if command -v notify-send &>/dev/null; then
          notify-send "$title" "$message" --expire-time=5000 2>/dev/null &
        fi
        ;;
    esac
  fi

  # --- Sound alert ---
  if [ "$_MOKU_SOUND_ENABLED" = "true" ] && [ -n "$sound" ] && [ "$sound" != "none" ]; then
    case "$(uname -s)" in
      Darwin)
        local sound_file="/System/Library/Sounds/${sound}.aiff"
        # Capitalize first letter for macOS sound file names
        local sound_cap="$(echo "${sound:0:1}" | tr '[:lower:]' '[:upper:]')${sound:1}"
        sound_file="/System/Library/Sounds/${sound_cap}.aiff"
        if [ -f "$sound_file" ]; then
          afplay "$sound_file" 2>/dev/null &
        fi
        ;;
      Linux)
        if command -v paplay &>/dev/null; then
          paplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null &
        fi
        ;;
    esac
  fi
}
