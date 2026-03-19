# Build: Interactive Findings Triage

When a validation agent (code-reviewer, verifier, plan-checker, spec-validator) returns findings, present them interactively instead of dumping the full list. This forces engagement with each issue and produces better triage decisions.

## When to Use

Use interactive triage when:
- **Code review** (Step 4a2) returns BLOCKER or HIGH findings
- **Plan validation** (plan-checker) returns BLOCKER findings before a user gate
- **Spec validation** returns BLOCKER findings during the Stage 2 validation loop

**Skip triage when:**
- Only INFO/WARNING findings exist (show summary table instead)
- Wave judge triggered `fresh-retry` (no point triaging — retry with fresh context)
- The `skipTriage` config option is set to `true` in `.claude/moku.local.md`

## Triage Flow

### Step 1: Sort and Group Findings

1. Parse the agent's output contract JSON
2. Sort findings by severity: BLOCKER → HIGH → WARNING
3. Group consecutive findings in the same file (present file-grouped, not scattered)
4. Count totals: `[B] blockers, [H] high, [W] warnings`

### Step 2: Present Summary First

Before individual triage, show the user a one-line overview:

> "Code review found **[B] blockers** and **[H] high-priority issues** across [N] files. Triaging each one."

### Step 3: Interactive Per-Finding Triage

For each BLOCKER and HIGH finding (in severity order), use `AskUserQuestion`:

- Question: `"[severity] in [file]:[line] — [message]\n\nRule: [rule]\nFix: [fix]"`
- Header: `"Finding [current]/[total]"`
- Options:
  1. label: "Fix now", description: "Route to gap closure — apply the suggested fix"
  2. label: "Fix later", description: "Defer to next wave or manual review"
  3. label: "Not an issue", description: "False positive — skip this finding"
  4. label: "Need context", description: "Show surrounding code before deciding"
- multiSelect: false

**If user selects "Need context":**
1. Read the file at the cited line ±10 lines
2. Present the code snippet
3. Re-ask the same question (without the "Need context" option — they've seen it)

### Step 4: Collect Triage Decisions

After all findings are triaged, partition into three buckets:

| Bucket | Action |
|--------|--------|
| **Fix now** | Route to gap closure (Step 4c). These are the only findings that enter the fix cycle. |
| **Fix later** | Record in `.planning/deferred-findings.md` with file, line, rule, message. These carry forward and are presented again at the next wave's triage or at final verification. |
| **Not an issue** | Record in `.planning/dismissed-findings.md` with file, line, rule, message, and the wave number. These are excluded from future triage for the same file+rule combination. |

### Step 5: Present Triage Summary

After all findings are triaged, show a compact summary:

```
Triage complete:
  Fix now:      [N] findings → entering gap closure
  Fix later:    [N] findings → deferred to .planning/deferred-findings.md
  Not an issue: [N] findings → dismissed
```

If "Fix now" count is 0, skip gap closure and proceed to the wave judge.

## Deferred Findings Carry-Forward

At the start of each wave's verification (Step 4a), check `.planning/deferred-findings.md`:
- If any deferred findings reference files that were modified in this wave, re-surface them in the triage
- Prefix re-surfaced findings with `[DEFERRED from Wave N]` so the user knows it's a carry-forward

## Dismissed Findings Memory

`.planning/dismissed-findings.md` acts as a suppressions list. When a future triage encounters a finding with the same `file + rule` combination as a dismissed entry, auto-skip it (don't re-ask). Log: `"Auto-skipped [rule] in [file] (dismissed in Wave [N])"`

If the file has been substantially modified since dismissal (>30% of lines changed), re-surface the finding — the dismissal may no longer apply.

## Deferred Findings File Format

```markdown
# Deferred Findings

## Wave [N] — [date]
| File | Line | Rule | Message | Status |
|------|------|------|---------|--------|
| src/plugins/router/api.ts | 42 | spec-deviation | Missing navigate() method | deferred |
```

## Dismissed Findings File Format

```markdown
# Dismissed Findings

| File | Rule | Wave | Reason |
|------|------|------|--------|
| src/plugins/cache/index.ts | R3 | 1 | Index is 35 lines — acceptable for this plugin |
```

## Configuration

Add to the project configuration table in `build.md` and `plan.md`:

| Setting | Type | Range | Default |
|---------|------|-------|---------|
| `skipTriage` | boolean | true/false | false |

When `skipTriage: true`, all BLOCKER findings auto-route to gap closure (old batch behavior). HIGH findings are logged but not triaged.
