# Build: Lean Execution Mode

Lean mode shortens agent prompts and orchestrator output during a build. It is a cost lever, not a
requirement: full prompts produce better work, so reach for lean mode when you want to cut token spend
on a large build, not by reflex.

## Activation

Any of these turns it on:

1. `leanMode: true` in `.claude/moku.local.md`
2. `--lean` passed to the build skill
3. `leanMode: "auto"` (the default) — activate it once window usage is genuinely high, which on a
   large build is many waves deep

It persists in STATE.md as `## LeanMode: true`, so it carries across resumes.

## What gets stripped

### Builder prompts (the biggest item)

| Section | Full prompt | Lean prompt |
|---|---|---|
| Spec | the whole spec file | `## Overview` (tier, description), `## Config` (type shape), `## API` (signatures), `## Events`, `## Dependencies` (names only) |
| Framework config | all of `src/config.ts` | the `export type Config` and `export type Events` blocks |
| Dependencies | each dependency's full `index.ts` | `export type Api` from each dependency's `types.ts` |
| Build rules | the full list | one line: `Tier [tier]. TDD: types→red→green→refactor. No explicit generics. import type. JSDoc. Tests in __tests__/.` |
| TDD protocol | the reference read | one line naming the four phases; the builder already has the skill |
| Output contract | schema with examples and field descriptions | schema only |
| Verification criteria | included | omitted — the artifact check covers them |

Skipped spec sections: Testing Strategy, Communication, Package Dependencies, Code Example,
Verification. The builder does not need them; verification does.

**Lean builder prompt:**

```
Build Moku plugin [name] ([tier]). TDD. No explicit generics. import type. JSDoc. Tests in __tests__/.

## Spec
[Overview paragraph]
Config: [type shape]
API: [method signatures]
Events: [names + payloads, or "None"]
Depends: [plugin names, or "None"]

## Types Context
[Config + Events type blocks from src/config.ts]

## Dep Interfaces
[export type Api from each dependency's types.ts]

## Decisions
[Relevant decision-log entries, or omit the section]

## Output
End with JSON: {agent, plugin, verdict, tdd, intent, filesCreated, testsPass, lintPass, issues}
```

### Other prompts and output

- **Code reviewer** — the diff summary (files changed, not the diff itself; it reads files anyway), the
  spec's API and Events sections, and the intent summaries. Keep the intent summaries: they are small
  and they are what catches spec drift.
- **Error diagnostician** — the first 20 lines of error output (the root cause is usually there), only
  the spec section the error touches, and the last 2 strategy-log entries.
- **Progress updates** — one line per wave (`W2: router,content → PASS. Verified. Integration OK.`),
  details only on failure.
- **Your own context** — after processing an agent's output contract, keep the JSON and a one-line
  summary, and drop the prose report. Keep full error detail whenever a verdict is FAIL.

## What is never stripped

Output contract JSON, error messages, decision-log entries, builder intent summaries, STATE.md writes
and git checkpoints. These are either the machine interface between agents or the only things that
survive a crash.

## Interaction with the rest of the build

- **Pipelining** — good combination: pipelining widens the fan-out, lean mode makes each agent cheaper.
- **Triage** — user-facing, never stripped. Findings are still presented one at a time.
- **Multi-pass review** — the reviewer still runs all four passes; in lean mode it reports pass-level
  summaries and only blocker-level detail.
- **TDD** — runs inside the builder's own context. Lean mode trims the prompt, not the execution.

## Extracting spec sections

```bash
grep -A 100 "^## Config" .planning/specs/03-router.md | sed '/^## [^C]/,$d'
grep -A 100 "^## API" .planning/specs/03-router.md | sed '/^## [^A]/,$d'
grep -A 100 "^## Events" .planning/specs/03-router.md | sed '/^## [^E]/,$d'
```

Or read the file with an offset targeting the section.
