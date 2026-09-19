---
name: status
description: Shows where a Moku project stands — the rails ledger first (initialized or not, open and parked changes, debts, idea backlog), then the STATE.md dashboard with phase, wave progress, plugin table and recent agent activity. Use when the user asks where we are, what is in flight, or what to do next.
when_to_use: A question about the current state of a Moku project — where are we, what is open, what is next. Read-only.
argument-hint: "[--full | diagnostics]"
allowed-tools: Read, Glob, Grep, Bash
model: fable
effort: low
---

# status — where the project stands

Two layers, read in order. The rails ledger is the machine truth about the lifecycle. `STATE.md` is
the human-readable record of the current plan and build. Neither replaces the other.

## Step 1 — the rails

```bash
moku-rails status --json
```

Read four things from it and lead with them:

| Field | What it tells you |
|---|---|
| `initialized` | Whether `.planning/moku.md` exists. `false` means only intake, brainstorm and design are possible. |
| `changes` | Every change with its `id`, `size`, `type`, `title`, `status` (open, parked, closed), current `station`, `paused`, `done` stations and `checklist`. |
| `debts` | Work the rails consider unsettled: a change stuck inside a station, uncommitted work no change accounts for. |
| `ideas` | The backlog kept with `moku-rails idea`. |

A brand-new directory has no ledger. `status` still works there and reports "not initialized".

**Debts come first in the output.** They are the reason a next step is blocked.

## Step 2 — the dashboard

Read `.planning/STATE.md`. If it does not exist, render the "no active plan" fallback (phase, verb,
target and next action all `—`) and go straight to Next Steps.

Start from the `## Recovery` block (see
`${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/memory-schema.md`): its `Last good step`,
`Open blockers` and `Next action` give the header line in one read. Fall through to the full tables
for the plugin and wave breakdown.

Other sources, each optional:

| Source | Shows |
|---|---|
| `.planning/build/agent-log.md` | Recent agent completions with verdicts. "No agent activity recorded." when absent. |
| `.planning/build/diagnostics.log` | Hook denials, tool failures, blocked writes. |
| `.planning/memory.md` | Project-specific memory. |
| `src/plugins/` | Filesystem evidence of what was actually built. |
| `.planning/specs/` | Spec files and their count. |

Wave rows come from the `## Plugin Table:` section of `STATE.md`:

- `done` — every plugin in the wave is `verified` or `committed`.
- `building` — `## Phase:` is `build/wave-{N}` for this wave's index.
- `pending` — the wave index is past the one in `## Phase:`.
- `queued` — instead of `pending` when `## Skeleton: committed` but no plugin has started. That
  distinguishes "scaffolding ready" from "build running, this wave next".

## Output

```
Moku Project Status
═══════════════════

Rails:       initialized · 1 change open · 0 debts · 3 ideas parked
Change:      2026-09-26-streak-midnight (S, fix) — inside "build"
Route:       intake ✓ → build ▸ → verify → close

Phase:       [from STATE.md, or "No active plan"]
Verb:        [create|update|add|migrate]
Target:      [framework|app|plugin]
Skeleton:    [not-started | in-progress | verified | committed | —]

── Wave Progress ──────────────────────────────────
Wave 0 (core): env, logger ................ done
Wave 1:        router, auth ............... building
Wave 2:        renderer ................... pending

── Plugin Status ──────────────────────────────────
| Plugin   | Tier     | Spec | Built | Tests | Status    |
|----------|----------|------|-------|-------|-----------|
| env      | Nano     | Yes  | Yes   | Yes   | verified  |
| router   | Standard | Yes  | Yes   | Yes   | verified  |
| auth     | Standard | Yes  | No    | —     | pending   |

── Recent Activity ────────────────────────────────
[last 5 agent completions]

── Diagnostics ────────────────────────────────────
[last 10 entries, grouped: PERM-DENY, ANTIPATTERN, TOOL-FAIL, STOP-BLOCK]
[or "No diagnostic events recorded."]

── Next ───────────────────────────────────────────
→ [the single next step, in plain words]
```

## Naming the next step

Say it in plain words, not as a command. The conductor runs the lifecycle; the user does not need to
know which skill does what.

| State | Next step |
|---|---|
| Not initialized | Set the project up first — the init station. |
| A debt exists | Settle it: finish the stuck change, or park it with a reason. |
| A change is open, inside a station | Continue that station. |
| A change is open, between stations | The next station on its route. |
| Every station done, checklist incomplete | The missing checklist item: tests, verify or docs. |
| No open change | Open one, or pick something from the idea backlog. |

## Flags

`--full` also shows the full plugin table with file and line counts, every agent-log and
diagnostics entry, `memory.md`, and the git checkpoint history ("No git repository found." when
there is no `.git`).

`diagnostics` shows only the diagnostics section: the whole log, a count per category (PERM-DENY,
ANTIPATTERN, INDEX-RULE, TOOL-FAIL, STOP-BLOCK, STRUCTURE), and the five most repeated issues.

An unrecognized argument prints `Unknown flag: {value}. Recognized flags: --full, diagnostics` and
then runs the default view.
