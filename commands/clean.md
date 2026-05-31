---
description: Clean the .planning/ workspace before starting a new large effort — removes ephemeral planning artifacts (no backup), keeping only durable architecture learnings by default
allowed-tools: Read, Bash, Glob, Grep, AskUserQuestion
argument-hint: [--keep specs,context,state] [--dry-run] [--force]
disable-model-invocation: true
---

## Moku Core Specification (authoritative)

Before any decision about architecture, the core API, factory chain, config, lifecycle, events, the `ctx` object, types, invariants, or plugin structure — **consult `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/spec-index.md` and open the cited `spec/NN-*.md` file.** The spec is the single source of truth; never rely on memory or guess. Justify any deviation against a cited section, and cite spec section IDs (`spec/NN-*.md §N`) in output. Never stage or commit `.planning/` — it is local-only state.

---

Reset the `.planning/` workspace so a new large effort starts clean. **This deletes files
permanently — there is no backup.** By default it keeps only the durable architecture
learnings (`.planning/learnings.md`); everything else under `.planning/` is removed.

## Step 0: Locate the workspace

```bash
test -d .planning || { echo "No .planning/ directory here — nothing to clean."; exit 0; }
```
If `.planning/` does not exist, report that and stop.

## Step 1: Parse arguments

- `--dry-run` — show the manifest and stop; delete nothing.
- `--force` / `--yes` — skip the confirmation gate (still respects mid-flight refusal unless
  combined — see Step 2).
- `--keep <list>` — comma-separated extra categories to preserve in addition to the default.
  Recognized tokens:
  - `specs` → keep `.planning/specs/` and `.planning/build/skeleton-spec.md`
  - `context` → keep `.planning/context-*.md`
  - `state` → keep `.planning/STATE.md`
  - `learnings` is **always** kept and need not be listed.

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

**KEEP** (default + any `--keep` tokens):
- `.planning/learnings.md` (always)
- `.planning/specs/`, `.planning/build/skeleton-spec.md` — only if `specs` in `--keep`
- `.planning/context-*.md` — only if `context` in `--keep`
- `.planning/STATE.md` — only if `state` in `--keep`

**REMOVE** (everything under `.planning/` not in KEEP), e.g.:
- `.planning/STATE.md` (unless kept)
- `.planning/specs/`, `.planning/build/skeleton-spec.md` (unless kept)
- `.planning/context-*.md` (unless kept)
- `.planning/build/` (agent logs, wave logs)
- `.planning/audit-*.md`
- `.planning/brainstorm-*-position.md`, `.planning/brainstorm-*-research.md`, `.planning/brainstorm-*-analysis.md`
- `.planning/notifications.log`, `.planning/diagnostics.log`
- `.planning/.brainstorm-active` and any other markers

Print the manifest grouped clearly:
```
.planning/ cleanup plan
  KEEP (N):
    - learnings.md
    - <any --keep additions>
  REMOVE (M) — no backup:
    - STATE.md
    - specs/ (K files)
    - build/ (K files)
    - audit-*.md (K files)
    - ...
```
Show total file/byte counts removed.

**If `--dry-run`:** stop here.

## Step 4: Confirm (destructive)

Unless `--force`/`--yes`, require explicit confirmation with `AskUserQuestion`:
- Question: "Permanently delete M files from .planning/? This cannot be undone (no backup)."
- Header: "Confirm clean"
- Options:
  1. label: "Delete", description: "Remove the M files listed above. Keeps: {KEEP list}."
  2. label: "Cancel", description: "Abort — change nothing."
- multiSelect: false

If "Cancel": stop, change nothing.

## Step 5: Delete

Only after confirmation (or `--force`), remove each path in the REMOVE list. Never touch
anything outside `.planning/`. Never delete `.planning/learnings.md`. If `.planning/`
becomes empty except for `learnings.md`, that is the expected end state.

Then report what was removed and what remains:
```bash
echo "Remaining in .planning/:"; ls -A .planning/ 2>/dev/null
```

## Notes

- `.planning/` is local-only and gitignored — never stage or commit it.
- To also refresh stale entries inside `learnings.md`, edit it manually; `clean` never
  rewrites kept files.
- For a brand-new project with **no** durable learnings worth keeping, run
  `/moku:clean` then delete `learnings.md` by hand if desired.
