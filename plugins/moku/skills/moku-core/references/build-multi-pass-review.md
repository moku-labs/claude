# Build: Multi-Pass Focused Review

`moku-code-reviewer` reviews a wave in four sequential passes, each through one lens. One pass looking
for correctness, security, performance and maintainability at once spends most of its attention on the
first issue and reports shallow findings across the rest; constraining attention to one concern at a
time produces deeper ones.

## Pass order

| Pass | Concern | Why here |
|------|---------|----------|
| 1 | Correctness — spec fidelity and logic | Nothing else matters until the code is right |
| 2 | Security — vulnerabilities and unsafe patterns | Security findings on incorrect code are noise |
| 3 | Performance — efficiency and resources | Only matters once the code is correct and safe |
| 4 | Maintainability — anti-patterns and quality | Least urgent, so it cannot crowd out the rest |

## Pass 1: Correctness

"Does this code do what the spec says?"

Every API method present with the right signature and return type; the config shape matching exactly
(names, types, defaults); the state shape matching; events emitted at the right points with the right
payloads; dependencies actually used through `ctx.require()`; hooks on the right events; logic errors
(off-by-one, missing null guards, race conditions, inverted booleans, semantically wrong returns); and
whether the tests verify spec behavior rather than structure.

Spec deviations are blockers. Logic bugs are blockers when they affect core behavior, warnings when
they are edge cases.

## Pass 2: Security

"Can this be exploited or misused?"

Unsanitized input flowing into config or state; prototype pollution through `Object.assign` or spread
on untrusted objects; unsafe assertions (`as any`, `as unknown as X`) that bypass validation; internal
state exposed through mutable references; path traversal in file-handling plugins; template injection
in rendering plugins; timing attacks in comparison plugins; internal paths or state shapes leaking
through error messages.

Directly exploitable is a blocker. Theoretical with mitigations is a warning. Defense-in-depth
suggestions are not reported.

## Pass 3: Performance

"Will this hold up at scale?"

Synchronous I/O in lifecycle hooks that should be async; missing cleanup in `onStop` (listeners,
timers, connections); recomputation that belongs in state; O(n²) where a Map or Set gives O(n);
closures created in hot loops; unnecessary deep copies of large objects; state mutations that trigger
needless re-evaluation; arrays and maps that grow without bound.

Performance findings are almost never blockers. Warning for measurable impact, nothing for theoretical.

## Pass 4: Maintainability

"Will this be easy to understand and change?"

The Moku anti-patterns R1–R9 (`agent-preamble.md`); state leaking past the plugin boundary; wire factory
patterns; an `index.ts` past ~30 lines with inline logic; missing or misleading JSDoc; naming that
disagrees with sibling plugins in the same wave; cross-plugin coupling that bypasses the event system;
cleverness where simpler code would do.

R1 (explicit generics), R7 (`as any`) and R9 (lazy `unknown`/`Record<string, unknown>` for a knowable
shape) are blockers. Other anti-patterns are warnings. Style preferences are not reported.

## Execution

All four passes run inside a single invocation of the reviewer:

1. Read the diff and the specs once.
2. Pass 1 over every changed file. Record findings.
3. Pass 2 over the same files, using Pass 1's findings as context.
4. Pass 3, then Pass 4, on the same files.
5. Merge, deduplicating overlaps — a correctness bug that is also a security issue is reported once, at
   the higher severity.

**Skips that pay for themselves.** A file with a Pass 1 blocker will be rewritten during gap closure, so
Passes 2–4 skip it. Passes 3 and 4 are skipped entirely when every plugin in the wave is Nano or Micro.
More than 5 blockers in Pass 1 means the code needs rework, so Passes 2–4 are skipped — more findings
would only bury the ones that matter.

## Output contract extension

```json
{
  "agent": "moku-code-reviewer",
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

Findings enter triage (`build-findings-triage.md`) grouped by pass, correctness first, so the user
decides on the most important issues while their attention is fresh.
