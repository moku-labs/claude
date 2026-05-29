# Moku Plugin — Component Inventory

A discoverability map of what installing **moku** brings into a session, so you can see the
component surface (and its rough context cost) before relying on it. Use `claude plugin details moku`
for the live component list and `/usage` (per-category) to see actual token spend in a session.

## Skills (4) — progressive disclosure; bodies load on trigger, `references/` load on demand

| Skill | Triggers on | What it brings |
|-------|-------------|----------------|
| **moku-core** | moku architecture, factory chain, createCoreConfig, lifecycle, events, plugin structure | The authoritative `spec/` (15 vendored spec files) + `spec-index.md`, the coding-style `sandbox/` (48 exemplars) + `sandbox-index.md`, the build/plan/brainstorm/audit reference set (40 reference docs), `agent-preamble.md`, memory + tool-scoping + hook-pattern docs |
| **moku-plugin** | plugin structure, complexity tiers, createPlugin layout | Tiered plugin file organization (nano→very-complex), naming, wiring-harness pattern |
| **moku-web** | moku web, islands, @scope/@layer, data-* attributes | Preact + Vite island architecture, CSS token system (points at the vendored `sandbox/demo/blog/`) |
| **moku-testing** | TDD, mock context, moku test patterns | Red→Green→Refactor protocol, mock-ctx + createTestApp scaffolds (points at vendored sandbox tests) |

> Only `moku-core` is broad; the other three trigger narrowly. References are Level-3 progressive
> disclosure — they cost ~0 tokens until an agent opens them, which is why the vendored spec/sandbox
> (~6,400 + ~4,000 lines) are *indexed*, not front-loaded.

## Commands (10)

`brainstorm` · `plan` · `build` (the 3-stage gated core) · `next` · `status` · `check` (incl.
`check --usage`) · `clean` · `init` · `audit` · `spec-sync`.

## Agents (25) — spawned on demand by commands/workflows, isolated context

- **Validation (8):** spec, plugin-spec, type, jsdoc, test, web, architecture validators + validation-coordinator
- **Review/judgment (5):** verifier, code-reviewer, wave-judge, error-diagnostician, skeptic
- **Brainstorm (3):** researcher, challenger, synthesizer (+ the separate planning-phase `researcher`)
- **Audit (5):** scenario-generator, simulator, executor, hooks-analyzer, synthesizer
- **Full-cycle (2):** driver, reviewer
- Mechanical validators run at `effort: low` (haiku); deep reviewers (`code-reviewer`, `wave-judge`,
  `skeptic`) at `effort: high` — to keep the 25-agent surface cost-aware.

## Workflows (4) — opt-in dynamic fan-outs (Claude Code v2.1.154+)

`moku-verify` (parallel validators → disposition; `{adversarial:true}` adds a skeptic pass) ·
`moku-build-wave` (build one wave non-interactively) · `moku-migrate-sweep` (repo-wide mechanical
change) · `moku-audit` (audit a command file). `/moku:init` installs `moku-verify` into a project.

## Hooks (12 events / 21 scripts)

PreToolUse guards (brainstorm path-gate, planning-write approve, plugin antipatterns, structure +
index validation, commit gate incl. `.planning/` no-commit), PostToolUse (format-on-save,
pre-commit-review), Pre/PostCompact state snapshots, SessionStart (structured project context +
session title), PostToolUseFailure (routes tsc/lint/test failures to the diagnostician),
Stop/SubagentStop/Notification/PermissionRequest/UserPromptSubmit/SessionEnd. Status line:
`subagentStatusLine` wired in `settings.json`.

## Cost note

The 25-agent fan-outs and the moku-core reference set are the largest contributors. To keep spend
down: run build waves one-per-session, prefer the read-only/`effort: low` validators for routine
checks, and use `/usage` to see the per-skill/per-subagent breakdown. See also `/moku:check --usage`.
