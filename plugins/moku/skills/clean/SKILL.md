---
description: Clean the .planning/ workspace before a new effort — first distills a durable cycle summary (what was done, decisions taken, ideas used) into history.md so the next iteration has context, then removes ephemeral planning artifacts (no backup). Always keeps the cross-cycle durable knowledge.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
argument-hint: [--keep specs,context,state,archive] [--no-summary] [--dry-run] [--force]
disable-model-invocation: true
---

## Moku Core Specification (authoritative)

Before any decision about architecture, the core API, factory chain, config, lifecycle, events, the `ctx` object, types, invariants, or plugin structure — **consult `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/spec-index.md` and open the cited `spec/NN-*.md` file.** The spec is the single source of truth; never rely on memory or guess. Justify any deviation against a cited section, and cite spec section IDs (`spec/NN-*.md §N`) in output. Never stage or commit `.planning/` — it is local-only state.

---

Reset the `.planning/` workspace so a new large effort starts clean. **This deletes files
permanently — there is no backup.** Before deleting, `clean` distills a short **cycle summary**
(what was done, what decisions were taken, what ideas/approaches were used) from the ephemeral
artifacts it is about to remove and appends it to the durable `.planning/history.md`, so the next
iteration inherits the context. It then removes everything ephemeral, keeping the **cross-cycle
durable knowledge** by default.

### Durable knowledge — always kept (never deleted by `clean`)

`clean` keeps a **minimal** long-term memory by default — just the lightweight cross-cycle files,
not heavy snapshots. (The bulky `.planning/archive/` from build cycles is **removed** by default;
pass `--keep archive` to retain it.)

- `.planning/learnings.md` — durable architecture learnings.
- `.planning/decisions.md` — the decision knowledge graph ("Chose X over Y because Z").
- `.planning/steering.md` — scope boundaries, MVP priorities, risk assessment, CI/CD choices.
- `.planning/history.md` — running, newest-first log of **minimal** cycle traces (this command writes it).

## Step 0: Locate the workspace

```bash
test -d .planning || { echo "No .planning/ directory here — nothing to clean."; exit 0; }
```
If `.planning/` does not exist, report that and stop.

## Step 1: Parse arguments

- `--dry-run` — show the manifest and stop; delete nothing and write no summary.
- `--no-summary` — skip the cycle-summary distillation (Step 4); still cleans.
- `--force` / `--yes` — skip the confirmation gate (still respects mid-flight refusal unless
  combined — see Step 2).
- `--keep <list>` — comma-separated extra categories to preserve in addition to the durable set.
  Recognized tokens:
  - `specs` → keep `.planning/specs/` and `.planning/build/skeleton-spec.md`
  - `context` → keep `.planning/context-*.md`
  - `state` → keep `.planning/STATE.md`
  - `archive` → keep `.planning/archive/` (build-cycle snapshots; removed by default)
  - The durable-knowledge files above are **always** kept and need not be listed.

## Step 2: Mid-flight guard

Refuse to run (unless `--force`) when work is actively in progress:

```bash
# Brainstorm in progress
test -f .planning/.brainstorm-active && echo "BRAINSTORM_ACTIVE"
# Build in progress — STATE.md phase indicates an unfinished build
grep -qiE '^## (Phase|Next Action):.*(build|in-progress|wave)' .planning/STATE.md 2>/dev/null && echo "BUILD_ACTIVE"
```
If either marker is present and `--force` was not passed, stop with:
> Active work detected (brainstorm or in-progress build). Re-run with `--force` to clean anyway, or finish/`/moku:status` first.

## Step 3: Build the manifest

Compute two lists from the actual contents of `.planning/` (use `find`, do not assume names).

**KEEP** (durable set, always — plus any `--keep` tokens):
- `.planning/learnings.md`, `.planning/decisions.md`, `.planning/steering.md`,
  `.planning/history.md` (always; omit ones that don't exist yet)
- `.planning/specs/`, `.planning/build/skeleton-spec.md` — only if `specs` in `--keep`
- `.planning/context-*.md` — only if `context` in `--keep`
- `.planning/STATE.md` — only if `state` in `--keep`
- `.planning/archive/` — only if `archive` in `--keep`

**REMOVE** (everything under `.planning/` not in KEEP), e.g.:
- `.planning/STATE.md` (unless kept)
- `.planning/specs/`, `.planning/build/skeleton-spec.md` (unless kept)
- `.planning/context-*.md` (unless kept)
- `.planning/archive/` (build-cycle snapshots — unless kept; the minimal `history.md` trace replaces it)
- `.planning/build/` (agent logs, wave logs, findings, coverage)
- `.planning/audit-*.md`
- `.planning/brainstorm-*-position.md`, `.planning/brainstorm-*-research.md`, `.planning/brainstorm-*-analysis.md`
- `.planning/notifications.log`, `.planning/diagnostics.log`
- `.planning/.brainstorm-active` and any other markers

Print the manifest grouped clearly:
```
.planning/ cleanup plan
  KEEP (durable + extras):
    - learnings.md, decisions.md, steering.md, history.md (durable)
    - <any --keep additions (specs/context/state/archive)>
  REMOVE (M) — no backup:
    - STATE.md
    - specs/ (K files)
    - build/ (K files)
    - context-*.md (K files)
    - ...
  CYCLE SUMMARY → history.md  (distilled from STATE.md + context-*.md + build/ before delete)
```
Show total file/byte counts removed. (Omit the CYCLE SUMMARY line if `--no-summary`.)

**If `--dry-run`:** stop here.

## Step 4: Confirm (destructive)

Unless `--force`/`--yes`, require explicit confirmation with `AskUserQuestion`:
- Question: "Permanently delete M files from .planning/? This cannot be undone (no backup). A minimal cycle trace will be saved to history.md first."
- Header: "Confirm clean"
- Options:
  1. label: "Delete", description: "Write the history.md trace, then remove the M files listed above. Keeps the durable set{ + --keep extras}."
  2. label: "Cancel", description: "Abort — change nothing (no summary written, no files deleted)."
- multiSelect: false

If "Cancel": stop, change nothing (do not write the summary, do not delete).

## Step 5: Distill the cycle trace → `history.md`

**Skip this step entirely if `--no-summary` was passed.** (On `--dry-run` the command already
stopped at Step 3; on Cancel it stopped at Step 4.) Run this only after confirmation/`--force`,
while the ephemeral files still exist (delete happens in Step 6).

The point of this step is the feature's core: carry forward a **minimal trace** of the path taken
— *what was done, what was decided, what ideas were used* — so the next iteration starts informed
instead of blind. This is a lightweight substitute for the full `archive/` (which is removed by
default). Read the **ephemeral artifacts about to be deleted** and distill them tersely — do NOT
re-summarize the durable files (they survive on their own; reference them instead). Keep it small.

**Sources to read (only those present):**
- `.planning/STATE.md` → `## Completed`, `## Validation Summary`, `## Previous Cycle Summary`,
  `## Cycle:`, and the plugin table → **what was done** (plugins/waves built, coverage, test count).
- `.planning/context-*.md` → `## Summary`, `### Architectural Decisions`, `## Proposed Approach`
  (Architecture Direction, Key Assumptions, Explicit Non-Goals), `## Research Findings`,
  `## Decisions Made`, `### Open Questions` → **ideas/approaches used** + open threads.
- `.planning/build/findings.md`, `.planning/build/coverage.md` → outcomes/quality signals.
- `.planning/brainstorm-*-position.md` (if present) → the settled position/ideas.

**Determine the cycle label:** read `## Cycle:` from STATE.md (default `1` if absent). Get the
date with `date +%F` (do not guess).

**Write the entry.** If `.planning/history.md` does not exist, create it with the header below;
otherwise insert the new entry **directly under the `<!-- newest first -->` marker** (newest at
top). Use the `Write` tool to create, `Edit` to prepend — never shell `echo`/`cat` for this.

```markdown
# Planning History

Minimal newest-first trace of cleaned cycles — the path taken, so the next iteration has context.
Durable: survives `/moku:clean`. The full WHY-graph lives in `decisions.md`; architecture lessons
in `learnings.md`; scope/constraints in `steering.md`. This file is the lightweight index over them.

<!-- newest first -->

## {YYYY-MM-DD} — cycle {N}
- **Did:** {one line — plugins/waves built + coverage %, from STATE.md; "(no build recorded)" if none}
- **Decided:** {1–2 key trade-offs, terse; full record in decisions.md}
- **Ideas:** {approach / patterns / key assumptions used — from context-*.md, steering.md}
- **Open:** {unresolved threads to carry forward, or omit this line if none}
```

**Keep it minimal** — 3–4 bullets, one line each, bullets not prose. This is a trace, not a report.
If NONE of the sources exist (e.g. a bare `.planning/` with only durable files), **skip silently**
and note in the report: "No ephemeral planning state to summarize — history.md unchanged."

Because `history.md` is in the always-KEEP set (Step 3), the entry you just wrote is never part of
the REMOVE list in this same run.

## Step 6: Delete

Only after confirmation (or `--force`), remove each path in the REMOVE list. Never touch anything
outside `.planning/`. Never delete a durable-knowledge file (`learnings.md`, `decisions.md`,
`steering.md`, `history.md`). If `.planning/` becomes empty except for the durable set, that is the
expected end state.

Then report what was removed, the history.md entry written, and what remains:
```bash
echo "Remaining in .planning/:"; ls -A .planning/ 2>/dev/null
```

## Notes

- `.planning/` is local-only and gitignored — never stage or commit it (including `history.md`).
- `history.md` complements the other durable files: `decisions.md` records WHY (the trade-off
  graph), `learnings.md` records architecture lessons, `steering.md` records scope/constraints,
  and `history.md` is the newest-first **narrative** linking them per cycle. `clean` appends to
  `history.md`; it never rewrites the other kept files (edit those by hand).
- The build command's Cycle Archive (`build-final.md` Step 7.5) snapshots completed cycles to
  `.planning/archive/cycle-{N}/`. `clean` deliberately keeps things **minimal**: it removes that
  archive by default (use `--keep archive` to retain it) and instead distills a small `history.md`
  trace of the path taken — so context survives without the heavy snapshots.
- For a brand-new project with **no** durable knowledge worth keeping, run `/moku:clean` then
  delete the durable files by hand if desired.
