# Build: Multi-Pass Focused Review

Code review runs as sequential passes, each focused on a single concern. This produces deeper findings than a single catch-all pass because each pass examines code through one lens without distraction.

## Why Multi-Pass

A single-pass reviewer scanning for correctness, security, performance, AND maintainability simultaneously tends to:
- Spend most attention on the first issue found and rush through the rest
- Miss subtle security issues because it's also thinking about performance
- Report shallow findings across all dimensions instead of deep findings in any one

Sequential passes fix this by constraining attention to one concern at a time.

## Pass Order and Rationale

Passes run in this order (each builds on the previous):

| Pass | Concern | Focus | Why This Order |
|------|---------|-------|----------------|
| **1** | Correctness | Spec fidelity + logic errors | Must verify the code is correct before checking other properties |
| **2** | Security | Vulnerabilities + unsafe patterns | Security issues in incorrect code are noise — fix correctness first |
| **3** | Performance | Efficiency + resource management | Only matters once code is correct and secure |
| **4** | Maintainability | Anti-patterns + code quality | The least urgent concern — review last so it doesn't crowd out critical issues |

## Pass Definitions

### Pass 1: Correctness

**Lens**: "Does this code do what the spec says?"

Check:
- All API methods present with correct signatures and return types
- Config shape matches exactly (field names, types, defaults)
- State shape matches (initial values, mutability)
- Events emitted at the correct points with correct payloads
- Dependencies actually used via `ctx.require()`
- Hooks listen to the correct events
- Logic correctness: off-by-one, missing null guards, race conditions, wrong boolean logic, semantically wrong return values
- TDD check: do the tests actually verify spec behavior? (not just structure)

**Severity calibration**: Spec deviations are always BLOCKER. Logic bugs are BLOCKER if they affect core behavior, WARNING if edge-case.

### Pass 2: Security

**Lens**: "Can this code be exploited or misused?"

Check:
- Unsanitized user input flowing into config or state
- Prototype pollution via `Object.assign` or spread on untrusted objects
- Unsafe type assertions (`as any`, `as unknown as X`) that bypass validation
- Exposed internal state through mutable references
- Path traversal in file-handling plugins
- Template injection in rendering plugins
- Timing attacks in authentication/comparison plugins
- Information leakage in error messages (exposing internal paths, state shapes)

**Severity calibration**: Direct exploitability → BLOCKER. Theoretical vulnerability with mitigating factors → WARNING. Defense-in-depth suggestion → INFO (don't report, per confidence filter).

### Pass 3: Performance

**Lens**: "Will this code perform well at scale?"

Check:
- Synchronous I/O in lifecycle hooks that should be async
- Missing cleanup in `onStop` (event listeners, timers, connections)
- Redundant re-computation that could be cached in state
- O(n²) algorithms where O(n) is possible with Map/Set
- Creating closures in hot loops
- Unnecessary deep copies (structuredClone, JSON parse/stringify) on large objects
- State mutations that trigger unnecessary re-renders or re-evaluations
- Memory leaks: growing arrays/maps without bounds

**Severity calibration**: Performance issues are almost never BLOCKER. Use WARNING for measurable impact, skip anything theoretical.

### Pass 4: Maintainability

**Lens**: "Will this code be easy to understand and modify?"

Check:
- Moku anti-patterns R1–R8 (from agent-preamble.md)
- State leakage outside plugin boundary
- Wire factory patterns
- Index.ts exceeding ~30 lines with inline logic
- Missing or misleading JSDoc
- Inconsistent naming between plugins in the same wave
- Cross-plugin coupling that bypasses the event system
- Overly clever code that could be simpler

**Severity calibration**: R1 (explicit generics) and R7 (as any) are BLOCKER. Other anti-patterns are WARNING. Style preferences are INFO (don't report).

## Execution Protocol

The code-reviewer agent runs all 4 passes within a single invocation:

1. **Read the diff and specs** (shared setup — done once)
2. **Pass 1 (Correctness)**: Review all changed files through the correctness lens. Record findings.
3. **Pass 2 (Security)**: Re-read the same files through the security lens. Use Pass 1 findings as context (e.g., if a method is already flagged as incorrect, skip security analysis of that method — it'll be rewritten).
4. **Pass 3 (Performance)**: Same files, performance lens. Skip files already flagged as BLOCKER in Pass 1 (they'll be rewritten).
5. **Pass 4 (Maintainability)**: Same files, maintainability lens. Skip files with > 2 BLOCKERs from earlier passes (they need major rework anyway).
6. **Merge findings**: Deduplicate findings that overlap between passes (e.g., a correctness bug that is also a security issue — report once with the higher severity).

### Skip Rules (Efficiency)

- **Pass 2–4 skip files with Pass 1 BLOCKERs**: If a file has a fundamental correctness BLOCKER (wrong API, missing method), it will be rewritten during gap closure. Security/perf/maintainability review of that code is wasted.
- **Pass 3–4 are optional for Nano/Micro plugins**: Simple plugins rarely have performance or maintainability issues worth reporting. Skip these passes if all plugins in the wave are Nano or Micro.
- **Early termination**: If Pass 1 finds > 5 BLOCKERs, skip Passes 2–4 entirely. The code needs substantial rework — additional findings would overwhelm.

## Output Contract Extension

The code-reviewer's output contract now includes pass information:

```json
{
  "agent": "code-reviewer",
  "wave": 1,
  "plugins_reviewed": ["router", "auth"],
  "verdict": "ISSUES",
  "passes": {
    "correctness": {"findings": 2, "blockers": 1, "skippedFiles": 0},
    "security": {"findings": 0, "blockers": 0, "skippedFiles": 1},
    "performance": {"findings": 1, "blockers": 0, "skippedFiles": 1},
    "maintainability": {"findings": 1, "blockers": 0, "skippedFiles": 1}
  },
  "findings": [
    {
      "pass": "correctness",
      "plugin": "router",
      "file": "src/plugins/router/api.ts",
      "line": 42,
      "severity": "BLOCKER",
      "category": "spec-deviation",
      "message": "...",
      "fix": "..."
    }
  ],
  "earlyTermination": false,
  "summary": "..."
}
```

## Integration with Triage

After multi-pass review, findings enter the Interactive Triage (build-findings-triage.md) grouped by pass:
- Triage presents correctness findings first (most critical)
- Then security, performance, maintainability
- This ensures the user engages with the most important issues first
