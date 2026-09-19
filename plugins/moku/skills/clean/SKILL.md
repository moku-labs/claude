---
name: clean
description: Resets the .planning/ workspace before a new effort — archives closed changes, distills a cycle trace into history.md, proposes a gate when the same agent mistake repeats, then removes the ephemeral artifacts while keeping the durable knowledge. Use when the workspace is cluttered after a finished cycle.
when_to_use: A finished cycle whose planning workspace should be reset before the next effort. Destructive for ephemeral files, so it confirms first.
argument-hint: "[--keep specs,context,state] [--no-summary] [--dry-run] [--force]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
model: fable
effort: low
---

# clean — reset the workspace, keep what is worth keeping

`clean` resets `.planning/` so a new effort starts from a clear workspace. Deletion is permanent and
there is no backup, so before anything is removed `clean` does three things that carry knowledge
forward: it archives closed changes, distills a cycle trace into `history.md`, and turns a repeated
agent mistake into a proposed gate.

## Moku Core specification

Before any decision about architecture, the core API, the factory chain, config, lifecycle, events,
`ctx`, types, invariants or plugin structure, read
`${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/spec-index.md` and open the `spec/NN-*.md` file it
cites. Cite the section id in your output. `.planning/` is local-only state and is never staged or
committed, including `history.md` and the archive.

## Durable knowledge — always kept

- `.planning/moku.md` — the project marker. Without it the rails treat the project as uninitialized and refuse every source write.
- `.planning/state.json` — the rails ledger: open and parked changes, the idea backlog. It belongs to `moku-rails`; never edit or delete it here.
- `.planning/learnings.md` — architecture learnings across sessions.
- `.planning/decisions.md` — the decision graph: chose X over Y because Z.
- `.planning/steering.md` — scope, MVP priorities, risk, CI and release choices.
- `.planning/history.md` — the newest-first cycle trace this skill writes.
- `.planning/archive/` — closed changes and cycle snapshots. History is annotated, never deleted.

Everything else under `.planning/` is ephemeral unless `--keep` names it.

## Step 0 — locate the workspace

```bash
test -d .planning || { echo "No .planning/ directory here — nothing to clean."; exit 0; }
```

## Step 1 — arguments

| Flag | Effect |
|---|---|
| `--dry-run` | Show the manifest and stop. Nothing is written or deleted. |
| `--no-summary` | Skip the `history.md` distillation. Still archives and cleans. |
| `--force` / `--yes` | Skip the confirmation gate. |
| `--keep <list>` | Extra categories to preserve: `specs` (`.planning/specs/` and `build/skeleton-spec.md`), `context` (`context-*.md`), `state` (`STATE.md`). |

`archive` is no longer a `--keep` token: the archive is durable now and is never removed.

## Step 2 — the mid-flight guard

Ask the rails whether work is in flight:

```bash
moku-rails status --json
```

Refuse, unless `--force`, when a change is open and sitting inside a station, or when `STATE.md`
shows an unfinished build:

```bash
grep -qiE '^## (Phase|Next Action):.*(build|in-progress|wave)' .planning/STATE.md 2>/dev/null && echo "BUILD_ACTIVE"
```

> Work is still in flight ({change id} inside "{station}", or a build in progress). Finish it, park
> it with a reason, or re-run with `--force`.

## Step 3 — archive closed changes

For every change the ledger reports as `closed` that still has a folder at
`.planning/changes/<id>/`, move the whole folder to `.planning/archive/changes/<id>/`. Move, never
delete, and never overwrite an existing archived folder — if one is already there, keep both and say
so.

```bash
mkdir -p .planning/archive/changes
mv ".planning/changes/<id>" ".planning/archive/changes/<id>"
```

Each archived folder keeps or gains a short `outcome.md`: what changed, what was decided, why.
Folders of changes that are still open or parked stay where they are.

## Step 4 — build the manifest

Compute two lists from the real contents of `.planning/` with `find`; do not assume filenames.

**Keep:** the durable set above, plus anything named by `--keep`.

**Remove:** everything else, typically `STATE.md`, `specs/`, `build/skeleton-spec.md`,
`context-*.md`, `build/` (agent logs, wave logs, findings, coverage), `audit-*.md`,
`brainstorm-*-position.md`, `brainstorm-*-research.md`, `brainstorm-*-analysis.md`,
`notifications.log`, `diagnostics.log`, and leftover temporary markers such as `.brainstorm-active`.
`.planning/moku.md` is not a leftover: it stays.

```
.planning/ cleanup plan
  ARCHIVE:
    - changes/2026-09-12-streak-fix → archive/changes/2026-09-12-streak-fix
  KEEP (durable + extras):
    - learnings.md, decisions.md, steering.md, history.md, archive/
    - <--keep additions>
  REMOVE (M files) — no backup:
    - STATE.md
    - specs/ (K files)
    - build/ (K files)
  CYCLE SUMMARY → history.md
  GATE PROPOSAL   → 1 repeated mistake found
```

Show the file and byte totals. Stop here on `--dry-run`.

## Step 5 — confirm

Unless `--force`, ask with `AskUserQuestion`, header "Confirm clean":

- Question: "Permanently delete M files from .planning/? This cannot be undone. Closed changes are
  archived and a cycle trace is written to history.md first."
- "Delete" — archive, write the trace, then remove the M files listed above.
- "Cancel" — change nothing: no archive move, no summary, no deletion.

## Step 6 — distill the cycle trace

Skip entirely on `--no-summary`. Run it after confirmation, while the ephemeral files still exist.

The point is a minimal trace of the path taken — what was done, what was decided, which ideas were
used — so the next iteration starts informed. Read the files that are about to be deleted and
distill them tersely. Do not re-summarize the durable files; they survive on their own.

| Source | Gives |
|---|---|
| `STATE.md` — `## Completed`, `## Validation Summary`, `## Cycle:`, the plugin table | what was done: plugins and waves built, coverage, test count |
| `context-*.md` — `## Summary`, `### Architectural Decisions`, `## Proposed Approach`, `## Research Findings`, `## Decisions Made`, `### Open Questions` | ideas used and open threads |
| `build/findings.md`, `build/coverage.md` | outcomes and quality signals |
| `brainstorm-*-position.md` | the settled position |

Read the cycle number from `## Cycle:` in `STATE.md`, defaulting to 1, and the date from
`date +%F`. Create `history.md` with the header below when it does not exist; otherwise insert the
new entry directly under the `<!-- newest first -->` marker. Use `Write` to create and `Edit` to
prepend — not shell redirection.

```markdown
# Planning History

Minimal newest-first trace of cleaned cycles — the path taken, so the next iteration has context.
Durable: survives clean. The decision graph lives in decisions.md, architecture lessons in
learnings.md, scope and constraints in steering.md. This file is the lightweight index over them.

<!-- newest first -->

## {YYYY-MM-DD} — cycle {N}
- **Did:** {plugins and waves built, coverage; "(no build recorded)" if none}
- **Decided:** {one or two trade-offs; the full record is in decisions.md}
- **Ideas:** {approaches, patterns, key assumptions}
- **Open:** {threads to carry forward, or omit this line}
```

Three or four bullets, one line each. It is a trace, not a report. When none of the sources exist,
skip silently and note in the report: "No ephemeral planning state to summarize — history.md
unchanged."

## Step 7 — a repeated mistake becomes a gate

Compound the cycle: a mistake that happened twice should stop happening by construction.

While distilling, look at `build/agent-log.md`, `build/findings.md`, `diagnostics.log` and the
cycle summary for the same agent mistake occurring twice or more — the same rule id, the same
blocked pattern, the same class of fix. For each one, write a concrete proposal:

1. Name the mistake and quote the two occurrences with file and line.
2. Propose one of two gates — a regex check for
   `${CLAUDE_PLUGIN_ROOT}/hooks/check-plugin-antipatterns.sh`, written out in full and matching the
   style of the checks already there, or a test in the project that would fail on the pattern.
3. Say what the gate would have caught and what it might falsely catch.

Present the proposals as text for the user to approve. Do not edit
`check-plugin-antipatterns.sh` or any other hook: hooks are shared plugin infrastructure, a bad
regex blocks every write, and the user decides what becomes a permanent rule. Write the accepted
ones into `learnings.md` as a note so the proposal is not lost if the user acts on it later.

## Step 8 — delete

Only after confirmation or `--force`, remove each path in the Remove list. Stay inside `.planning/`.
Never delete a durable file or anything under `.planning/archive/`. Ending with only the durable set
left is the expected outcome.

```bash
echo "Remaining in .planning/:"; ls -A .planning/ 2>/dev/null
```

Report what was archived, what was removed, the `history.md` entry, any gate proposals, and what
remains.

## Notes

- `history.md` is in the keep set, so the entry written in Step 6 is never part of the same run's
  Remove list.
- The four durable files divide the work: `decisions.md` records why, `learnings.md` records
  architecture lessons, `steering.md` records scope and constraints, `history.md` links them per
  cycle. `clean` appends to `history.md` and never rewrites the others; those are edited by hand.
- For a brand-new project with no durable knowledge worth keeping, run `clean` and then delete the
  durable files by hand.
