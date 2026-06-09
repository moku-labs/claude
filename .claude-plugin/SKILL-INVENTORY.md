# Moku Plugin — Component Inventory

A discoverability map of what installing **moku** brings into a session, so you can see the
component surface (and its rough context cost) before relying on it. Use `claude plugin details moku`
for the live component list and `/usage` (per-category) to see actual token spend in a session.

## Skills (7) — progressive disclosure; bodies load on trigger, `references/` load on demand

| Skill | Triggers on | What it brings |
|-------|-------------|----------------|
| **moku-core** | moku architecture, factory chain, createCoreConfig, lifecycle, events, plugin structure | The authoritative `spec/` (15 vendored spec files) + `spec-index.md`, the coding-style `sandbox/` (48 exemplars) + `sandbox-index.md`, the build/plan/brainstorm reference set (45 reference docs), `agent-preamble.md`, memory + tool-scoping + hook-pattern docs |
| **moku-plugin** | plugin structure, complexity tiers, createPlugin layout | Tiered plugin file organization (nano→very-complex), naming, wiring-harness pattern |
| **moku-web** | moku web, islands, @scope/@layer, data-* attributes | Preact + Vite island architecture, CSS token system (points at the vendored `sandbox/demo/blog/`) |
| **moku-testing** | TDD, mock context, moku test patterns | Red→Green→Refactor protocol, mock-ctx + createTestApp scaffolds (points at vendored sandbox tests) |
| **moku-readable-code** | readable code, wall of text, refactor for readability, story by layout, stanza style | The 10-rule stanza style (blank-line steps + intent comments, guard clauses, named predicates/constants, balanced extraction); paired with the `moku-readable-code-validator` |
| **spec-sync** *(maintainer)* | "sync moku spec/knowledge", "re-vendor the moku core spec", "new core version" | Re-vendors the upstream Core spec + sandbox from `moku-labs/core`, regenerates `spec-index.md`/`sandbox-index.md`, then chains `moku-sync` to refresh every framework's index. STOPs outside the plugin repo. |
| **moku-sync** *(maintainer)* | "sync moku frameworks", "check for new moku framework releases", "new @moku-labs/web release" | Per-framework counterpart to spec-sync: polls each registry framework's release source, regenerates its plugin index + skill API form, registers new versions with `/moku:upgrade`. Read-only `--check` mode. STOPs outside the plugin repo. |

> Only `moku-core` is broad; the other six trigger narrowly. References are Level-3 progressive
> disclosure — they cost ~0 tokens until an agent opens them, which is why the vendored spec/sandbox
> (~6,400 + ~4,000 lines) are *indexed*, not front-loaded.

## Commands (9)

`brainstorm` · `plan` · `build` (the 3-stage gated core) · `next` · `status` · `check` (incl.
`check --usage`) · `clean` · `init` · `upgrade` (zero-arg stack migration).

## Agents (20) — spawned on demand by commands/workflows, isolated context

- **Validation (9):** spec, plugin-spec, type, jsdoc, test, web, readable-code, architecture validators + validation-coordinator
- **Review/judgment (5):** verifier, code-reviewer, wave-judge, error-diagnostician, skeptic
- **Brainstorm (3):** brainstorm-researcher, challenger, synthesizer
- **Build/plan support (3):** builder, plan-checker, planning-phase `researcher`
- Mechanical validators run at `effort: low` (haiku); deep reviewers (`code-reviewer`, `wave-judge`,
  `skeptic`) at `effort: high` — to keep the 20-agent surface cost-aware.

## Workflows (3) — opt-in dynamic fan-outs (Claude Code v2.1.154+)

`moku-verify` (parallel validators → disposition; `{adversarial:true}` adds a skeptic pass) ·
`moku-build-wave` (build one wave non-interactively) · `moku-migrate-sweep` (repo-wide mechanical
change). `/moku:init` installs `moku-verify` into a project.

## Hooks (12 events / 21 scripts)

PreToolUse guards (brainstorm path-gate, planning-write approve, plugin antipatterns, structure +
index validation, commit gate incl. `.planning/` no-commit), PostToolUse (format-on-save,
pre-commit-review), Pre/PostCompact state snapshots, SessionStart (structured project context +
session title), PostToolUseFailure (routes tsc/lint/test failures to the diagnostician),
Stop/SubagentStop/Notification/PermissionRequest/UserPromptSubmit/SessionEnd. Status line:
`subagentStatusLine` wired in `settings.json`.

## Cost note

The agent fan-outs and the moku-core reference set are the largest contributors. To keep spend
down: run build waves one-per-session, prefer the read-only/`effort: low` validators for routine
checks, and use `/usage` to see the per-skill/per-subagent breakdown. See also `/moku:check --usage`.
