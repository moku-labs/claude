# Build: Resolving Disagreements Between Checks

Several checks read the same code and can reach opposite verdicts. Resolve the disagreement explicitly
instead of silently picking one or failing ambiguously.

## Where conflicts come from

| Type | Example |
|---|---|
| Verdict | the artifact check passes a plugin, the code reviewer calls the same file a blocker |
| Rule | `moku-structure-validator` calls a lifecycle issue a blocker, another check calls it a warning |
| Approach | two proposed fixes are mutually exclusive — add an explicit type vs. remove it and infer |
| Severity | the same file and line, blocker from one check and warning from another |

## Detecting them

Build a per-file findings matrix once the group's output contracts are in:

```
file: src/plugins/router/api.ts
  moku-verify-artifacts:      PASS (exit 0)
  moku-code-reviewer:         BLOCKER at line 42 — missing null check on route param
  moku-structure-validator:   WARNING at line 42 — navigate() signature differs from spec
```

Two findings are about the same thing when they share a file and their lines are within ±5. A conflict
exists when they disagree on the verdict, disagree on severity, or propose fixes that cannot both be applied.

## Classifying and resolving

| Classification | Criteria | Resolution |
|---|---|---|
| Information gap | one check had context the other lacked | re-run the less-informed one with the other's findings as `## Prior Findings` |
| Genuine trade-off | both are right; the issue has competing concerns | present the trade-off to the user |
| False positive | one is wrong — a rule that does not apply, a stale pattern | dismiss it with the reason |
| Scope mismatch | they check different aspects that happen to overlap | not a conflict; both findings stand |

**Information gap.** The deterministic artifact check knows least, the code reviewer more, the
validators most. Re-run the less-informed check with the other's findings injected. If they still
disagree, treat it as a genuine trade-off.

**Genuine trade-off.** `moku-rails pause`, then `AskUserQuestion`:

- Question: `"Conflict on [file]:[line]\n\n[Check A] says: [finding A]\n[Check B] says: [finding B]\n\nTrade-off: [the competing concerns]"`
- Options: A's approach (with what it means for the code) / B's approach / "Neither — I'll handle this manually"

Record the outcome in `.planning/decisions.md`:

```
## [date] [file]:[line] — [short description]
- **Chose**: [A]'s approach
- **Over**: [B]'s approach
- **Because**: [the user's rationale]
- **Context**: [what each check said]
```

**False positive.** Confirm it is one: does the rule apply to this plugin's tier (Nano plugins have
relaxed rules)? Is the pattern explicitly allowed by the spec? Does the finding contradict an entry in
`.planning/decisions.md`? Then dismiss it and record it in `.planning/build/findings.md` with the reason.

## Where this runs

- **After a wave** (`build-verification.md` Step 4a3): reconcile the artifact check and the code
  reviewer before gap closure or triage. Only resolved findings enter triage.
- **In post-build validation** (`build-final.md` Step 6): reconcile within each validator group before
  building the cross-group summary, so the architecture validator sees resolved findings rather than
  contradictory ones.
- **In the wave disposition** (`build-wave-execution.md`): a high count of unresolved conflicts is one
  of the signals for `stop-for-review`.

## Reporting conflicts

Add a `conflicts` field to your output:

```json
{
  "conflicts": [
    {
      "file": "src/plugins/router/api.ts",
      "line": 42,
      "checkA": "moku-verify-artifacts",
      "checkB": "moku-code-reviewer",
      "findingA": "PASS — no issues",
      "findingB": "BLOCKER — missing null check",
      "classification": "information-gap | genuine-trade-off | false-positive | scope-mismatch",
      "resolution": "adopted-B | adopted-A | user-chose-A | user-chose-B | deferred",
      "reason": "The code reviewer had spec context the artifact check does not read"
    }
  ]
}
```
