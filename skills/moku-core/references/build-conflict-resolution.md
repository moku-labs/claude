# Build: Agent Conflict Resolution

When multiple validators assess the same code, their verdicts may disagree. Instead of silently picking one or failing ambiguously, detect conflicts and resolve them with explicit trade-off analysis.

## When Conflicts Occur

Conflicts happen when two validators examining the same plugin or file produce contradictory findings:

| Conflict Type | Example | Validators |
|---------------|---------|------------|
| **Verdict conflict** | verifier says PASS, code-reviewer says BLOCKER | moku-verifier vs moku-code-reviewer |
| **Rule conflict** | spec-validator flags lifecycle as BLOCKER, plugin-spec-validator says WARNING | moku-spec-validator vs moku-plugin-spec-validator |
| **Approach conflict** | type-validator wants explicit types, spec-validator wants inferred types | moku-type-validator vs moku-spec-validator |
| **Severity conflict** | One validator flags as BLOCKER, another flags the same file+line as WARNING or INFO | Any pair |

## Conflict Detection

### Step 1: Build the Findings Matrix

After all validators in a group return their output contracts, build a per-file findings matrix:

```
file: src/plugins/router/api.ts
  moku-verifier:        PASS (no findings)
  moku-code-reviewer:   BLOCKER at line 42 — "missing null check on route param"
  moku-spec-validator:  WARNING at line 42 — "navigate() signature differs from spec"
```

### Step 2: Detect Conflicts

A conflict exists when, for the same file (or file+line range ±5 lines):

1. **Verdict disagreement**: One validator says PASS/no-finding, another says BLOCKER
2. **Severity disagreement**: One says BLOCKER, another says WARNING for the same issue
3. **Contradictory fixes**: Two validators propose fixes that are mutually exclusive (e.g., "add explicit type annotation" vs "remove type annotation — use inference")

Conflicts are detected automatically by comparing output contract findings arrays across validators. Two findings are "about the same thing" if they share the same file AND their line numbers are within ±5 of each other.

### Step 3: Classify the Conflict

| Classification | Criteria | Resolution Path |
|----------------|----------|-----------------|
| **Information gap** | One validator has context the other lacks | Re-run the less-informed validator with the other's findings as input |
| **Genuine trade-off** | Both validators are correct — the issue has competing concerns | Present trade-off analysis to the user |
| **False positive** | One validator is wrong (over-sensitive rule, stale pattern) | Dismiss the incorrect finding with explanation |
| **Scope mismatch** | Validators checking different aspects that happen to overlap | No conflict — both findings are valid, different fixes needed |

## Resolution Flow

### For Information Gap Conflicts

The less-informed validator may not have seen the spec, the dependency chain, or the full type context.

1. Identify which validator has less context (usually: verifier < code-reviewer < spec-validator)
2. Re-run the less-informed validator with the other's findings injected as `## Prior Findings` context
3. If the re-run resolves the disagreement → adopt the updated finding
4. If still disagree → escalate to Genuine Trade-Off

### For Genuine Trade-Off Conflicts

When both validators are correct and the issue involves competing concerns (e.g., type safety vs. API ergonomics, strictness vs. flexibility):

Present to the user via `AskUserQuestion`:

- Question: `"Validator conflict on [file]:[line]\n\n[Validator A] says: [finding A]\n[Validator B] says: [finding B]\n\nTrade-off: [explain the competing concerns]"`
- Header: `"Conflict: [short description]"`
- Options:
  1. label: "[Validator A]'s approach", description: "[what this means for the code]"
  2. label: "[Validator B]'s approach", description: "[what this means for the code]"
  3. label: "Neither — I'll handle this manually", description: "Defer to manual review"
- multiSelect: false

**Record the decision** in `.planning/decision-log.md` (see Decision Knowledge Graph):
```
## [date] [file]:[line] — [short description]
- **Chose**: [Validator X]'s approach
- **Over**: [Validator Y]'s approach
- **Because**: [user's rationale or trade-off reasoning]
- **Context**: [what validators said]
```

### For False Positive Conflicts

When one finding is clearly wrong:

1. Identify the false positive by checking:
   - Does the rule apply to this plugin tier? (Nano plugins have relaxed rules)
   - Is the finding about a pattern that's explicitly allowed in the spec?
   - Does the finding contradict a previous decision in `.planning/decision-log.md`?
2. Dismiss the false positive finding
3. Add to `.planning/dismissed-findings.md` (from build-findings-triage.md) with reason

### For Scope Mismatch (Non-Conflicts)

Both findings are valid but address different aspects. No conflict resolution needed — process both findings through the normal triage flow.

## Integration Points

### Post-Wave Verification (Step 4a + 4a2)

After both the **moku-verifier** (Step 4a) and **moku-code-reviewer** (Step 4a2) return:

1. Run conflict detection on their combined findings
2. If conflicts found → resolve before entering gap closure or triage
3. Only resolved findings enter the triage flow (build-findings-triage.md)

### Validation Pipeline (validation-coordinator)

After each validator group completes:

1. Run conflict detection on all output contracts within the group
2. Inject conflict resolutions into the Cross-Group Findings Summary
3. The architecture-validator receives resolved findings, not raw conflicting ones

### Wave Judge (Step 4c3)

The wave judge receives:
- Resolved findings (not the raw conflicting ones)
- Conflict resolution log (how many conflicts, how resolved)
- Unresolved conflicts count (if any were deferred to manual)

A high unresolved conflict count signals `stop-for-review`.

## Conflict Output Contract Extension

When conflicts are detected, add a `conflicts` field to the orchestrator's output:

```json
{
  "conflicts": [
    {
      "file": "src/plugins/router/api.ts",
      "line": 42,
      "validatorA": "moku-verifier",
      "validatorB": "moku-code-reviewer",
      "findingA": "PASS — no issues",
      "findingB": "BLOCKER — missing null check",
      "classification": "information-gap | genuine-trade-off | false-positive | scope-mismatch",
      "resolution": "adopted-B | adopted-A | user-chose-A | user-chose-B | deferred",
      "reason": "Code reviewer had spec context that verifier lacked"
    }
  ]
}
```
