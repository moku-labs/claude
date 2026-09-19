# Build: Interactive Findings Triage

Present findings one at a time instead of dumping the list. Deciding per finding produces better triage
than scanning a wall of them.

## When to use it

- Code review (`build-verification.md` Step 4a2) returns BLOCKER or HIGH findings
- Plan validation returns blockers before a user gate
- Post-build validation returns blockers

**Skip it** when only INFO and WARNING findings exist (show a summary table instead), when the wave
disposition is `fresh-retry` (retrying with fresh context makes triage pointless), or when
`skipTriage: true` in `.claude/moku.local.md`.

## The flow

**1. Sort and group.** Parse the output contract JSON, sort by severity (BLOCKER → HIGH → WARNING),
group consecutive findings from the same file so they are presented together, and count the totals.

**2. Summarize first.**

> "Code review found [B] blockers and [H] high-priority issues across [N] files. Going through them."

**3. Triage each BLOCKER and HIGH, in severity order.** `moku-rails pause` before the first question,
then `AskUserQuestion` per finding:

- Question: `"[severity] in [file]:[line] — [message]\n\nRule: [rule]\nFix: [fix]"`
- Header: `"Finding [current]/[total]"`
- Options: "Fix now" (route to gap closure) / "Fix later" (defer) / "Not an issue" (false positive) /
  "Need context" (show the surrounding code first)

"Need context" reads the file at the cited line ±10, presents the snippet, and asks again without that option.

**4. Partition the decisions.**

| Bucket | What happens |
|---|---|
| Fix now | Enters gap closure (`build-verification.md` Step 4c). Nothing else does. |
| Fix later | Recorded in `.planning/build/findings.md` with file, line, rule and message; re-surfaced at the next wave's triage or at final verification. |
| Not an issue | Recorded in `.planning/build/findings.md` with the wave number; excluded from future triage for the same file and rule. |

**5. Summarize the outcome.**

```
Triage complete:
  Fix now:      [N] findings → entering gap closure
  Fix later:    [N] findings → deferred to .planning/build/findings.md
  Not an issue: [N] findings → dismissed
```

Zero "fix now" findings means gap closure is skipped — go straight to the wave disposition.

## Carry-forward and dismissal memory

At the start of each wave's verification, check `.planning/build/findings.md`. Deferred findings on
files this wave modified come back into the triage, prefixed `[DEFERRED from Wave N]`.

The same file acts as a suppressions list: a finding matching a dismissed `file + rule` pair is skipped
automatically, logged as `Auto-skipped [rule] in [file] (dismissed in Wave [N])`. If the file has moved
substantially since (more than ~30% of its lines changed), surface it again — the dismissal may no
longer hold.

## File formats

```markdown
# Deferred Findings

## Wave [N] — [date]
| File | Line | Rule | Message | Status |
|------|------|------|---------|--------|
| src/plugins/router/api.ts | 42 | spec-deviation | Missing navigate() method | deferred |
```

```markdown
# Dismissed Findings

| File | Rule | Wave | Reason |
|------|------|------|--------|
| src/plugins/cache/index.ts | R3 | 1 | Index is 35 lines — acceptable for this plugin |
```

## Configuration

`skipTriage` (boolean, default false) in `.claude/moku.local.md`. When true, every blocker routes
straight to gap closure and HIGH findings are logged without being triaged.
