---
description: Show consolidated Moku project dashboard — phase, wave progress, agent activity, quick actions
allowed-tools: Read, Glob, Grep, Bash
argument-hint: [--full]
disable-model-invocation: true
---

Show a consolidated dashboard of the current Moku project state. Reads multiple sources and presents a unified view.

## Execution Guard

Before reading any data source:
- If `$ARGUMENTS` is non-empty and does not match `--full` or `diagnostics` (exact, case-sensitive), print:
  `Unknown flag: {value}. Recognized flags: --full, diagnostics` — then continue with default (no-flag) behavior.
- Read `.planning/STATE.md`. If the file does not exist, skip all STATE.md-dependent sections and render the
  "No active plan" fallback (Phase/Verb/Target/Next Action all show "—") then proceed directly to
  Quick Actions using the "No STATE.md" rows from the Quick Action Logic table. Stop after Quick Actions.

## Data Sources

1. **`.planning/STATE.md`** — phase, verb, target, skeleton status, plugin table, wave progress, next action
2. **`.planning/agent-log.md`** — recent agent activity (last 10 entries); if file is absent or empty, show `"No agent activity recorded."` in the Recent Activity section
3. **`.planning/notifications.log`** — recent notifications (last 5 entries)
4. **`.planning/diagnostics.log`** — hook denials, tool failures, permission blocks (last 10 entries)
5. **`.planning/memory.md`** — project-specific memory (if exists)
6. **`src/plugins/`** — filesystem evidence of built plugins
7. **`.planning/specs/`** — specification files count and names

## Dashboard Format

Wave Progress rows are derived from STATE.md as follows:
- Wave list and plugin membership: read from the `## Plugin Table:` section of STATE.md (column: wave assignment).
- Wave status values:
  - `done` — all plugins in the wave have `status: verified` or `status: committed` in the plugin table
  - `building` — current `## Phase:` value matches `build/wave-{N}` for this wave's index N
  - `pending` — wave index is greater than the wave index embedded in `## Phase:`
  - `queued` — use instead of `pending` when `## Skeleton: committed` but no plugin build has started yet (all plugins have status `not started`). This distinguishes "scaffolding ready, build not begun" from "build in progress, this wave is next".

```
Moku Project Dashboard
══════════════════════

Phase:       [phase from STATE.md or "No active plan"]
Verb:        [create|update|add|migrate]
Target:      [framework|app|plugin]
Skeleton:    [not-started | in-progress | verified | committed | —]
Next Action: [next action from STATE.md]

── Wave Progress ──────────────────────────────────
Wave 0 (core): [plugin list] .............. [done|building|pending]
Wave 1:        [plugin list] .............. [done|building|pending]
Wave 2:        [plugin list] .............. [done|building|pending]

── Plugin Status ──────────────────────────────────
| Plugin   | Tier     | Spec | Built | Tests | Status    |
|----------|----------|------|-------|-------|-----------|
| env      | Nano     | Yes  | Yes   | Yes   | verified  |
| router   | Standard | Yes  | Yes   | Yes   | verified  |
| auth     | Standard | Yes  | No    | —     | pending   |

── Recent Activity ────────────────────────────────
[last 5 agent completions from agent-log.md]

── Diagnostics ────────────────────────────────────
[last 10 entries from diagnostics.log, grouped by category]
PERM-DENY (N):   [summary of blocked operations]
ANTIPATTERN (N): [summary of blocked patterns]
TOOL-FAIL (N):   [summary of failed tools]
STOP-BLOCK (N):  [summary of stop blocks]
[If no diagnostics.log or empty: "No diagnostic events recorded."]

── Quick Actions ──────────────────────────────────
→ [contextual suggestion based on state, e.g. "/moku:build resume"]
→ [secondary suggestion if applicable]
→ Tip: Run `/moku:next` to auto-detect and run the next step
```

## Quick Action Logic

Suggest the most likely next command based on the current state:

| State | Suggestion |
|-------|-----------|
| No STATE.md, no plugins | `/moku:plan create framework "description"` |
| No STATE.md, plugins exist | `/moku:check status` or `/moku:plan add plugin` |
| Phase: stage1/* | `/moku:plan resume` |
| Phase: stage2/* | `/moku:plan resume` |
| Phase: stage3/* | `/moku:plan resume` |
| Phase: complete, Skeleton: committed, all plugins `not started` | `/moku:build resume` — label as "(start plugin build — Wave 0)" |
| Phase: build/wave-N | `/moku:build resume` (or `/moku:build resume --continue`) |
| Phase: build/complete | `/moku:check verbose` |
| Plugins with `needs-manual` | `/moku:build fix [plugin-name]` |

## Flags

If `$ARGUMENTS` contains `--full`, also show:
- Full plugin table with file counts and line counts
- All agent log entries (not just last 10)
- All notification log entries (not just last 5)
- All diagnostics log entries (not just last 10) with category summary counts
- Memory.md contents (if exists)
- Git checkpoint history — if no `.git` directory exists in the project root, show
  `"No git repository found."` in place of checkpoint history

If `$ARGUMENTS` contains `diagnostics`, show ONLY the diagnostics section:
- Full `.planning/diagnostics.log` contents
- Summary table: count per category (PERM-DENY, ANTIPATTERN, INDEX-RULE, TOOL-FAIL, STOP-BLOCK, STRUCTURE)
- Top 5 most repeated issues (group by message similarity)
- Suggestion: "Run `/moku:audit hooks` to analyze patterns and propose fixes"
