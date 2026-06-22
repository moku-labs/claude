# Moku Plugin — Component Inventory

A discoverability map of what installing **moku** brings into a session, so you can see the
component surface (and its rough context cost) before relying on it. Use `claude plugin details moku`
for the live component list and `/usage` (per-category) to see actual token spend in a session.

## Skills (10) — progressive disclosure; bodies load on trigger, `references/` load on demand

| Skill | Triggers on | What it brings |
|-------|-------------|----------------|
| **moku-core** | moku architecture, factory chain, createCoreConfig, lifecycle, events, plugin structure | The authoritative `spec/` (15 vendored spec files) + `spec-index.md`, the coding-style `sandbox/` (48 exemplars) + `sandbox-index.md`, the build/plan/brainstorm/design reference set (51 reference docs, incl. the design set + `moku-idioms.md` + `e2e-testing.md`, the comprehensive Playwright e2e + visual-baseline gate), `agent-preamble.md`, memory + tool-scoping + hook-pattern docs |
| **moku-plugin** | plugin structure, complexity tiers, createPlugin layout | Tiered plugin file organization (nano→very-complex), naming, wiring-harness pattern |
| **moku-web** | moku web, islands, @scope/@layer, data-* attributes | Preact island architecture (Vite-free, Bun-bundled), CSS token system (points at the vendored `sandbox/demo/blog/`) |
| **moku-worker** | moku worker, @moku-labs/worker, cloudflare durable object/queue/r2/d1/kv | Layer-2 Cloudflare Workers backend framework — synced to `@moku-labs/worker@0.4.0` (10 plugins: server/kv/d1/queues/storage/durableObjects + node-only deploy/cli; full catalog in its `plugin-index.md`) |
| **moku-room** | moku room, @moku-labs/room, couch multiplayer, webrtc/state sync | Couch-multiplayer **plugin pack** on `@moku-labs/web` (spread `roomPlugins` into a web app — no `createApp` of its own) — synced to `@moku-labs/room@0.1.1` (6 plugins: transport/session/intent/sync + stage/controller facades) |
| **moku-common** | moku common, @moku-labs/common, branded cli, ctx.log, ctx.env, log/env plugin | Family conventions for the shared package: branded CLI kit (`@moku-labs/common/cli`), `logPlugin`/`ctx.log`, `envPlugin`/`ctx.env`; citable rules MC1–MC3 in `references/conventions.md`; paired with the `moku-common-validator` + `validate-common-usage` hook |
| **moku-testing** | TDD, mock context, moku test patterns | Red→Green→Refactor protocol, mock-ctx + createTestApp scaffolds (points at vendored sandbox tests) |
| **moku-readable-code** | readable code, wall of text, refactor for readability, story by layout, stanza style | The 10-rule stanza style (blank-line steps + intent comments, guard clauses, named predicates/constants, balanced extraction); paired with the `moku-readable-code-validator` |
| **spec-sync** *(maintainer)* | "sync moku spec/knowledge", "re-vendor the moku core spec", "new core version" | Re-vendors the upstream Core spec + sandbox from `moku-labs/core`, regenerates `spec-index.md`/`sandbox-index.md`, then chains `moku-sync` to refresh every framework's index. STOPs outside the plugin repo. |
| **moku-sync** *(maintainer)* | "sync moku frameworks", "check for new moku framework releases", "new @moku-labs/web release" | Per-framework counterpart to spec-sync: polls each registry framework's release source, regenerates its plugin index + skill API form, registers new versions with `/moku:upgrade`. Read-only `--check` mode. STOPs outside the plugin repo. |

> Only `moku-core` is broad; the other nine trigger narrowly. The toolkit also keeps **Reference Projects** in
> `moku-frameworks.md` — *public* worked examples only (e.g. the full-stack `tracker` in `github.com/moku-labs/demos`),
> illustrating the `moku-idioms.md` app-shape rubric. References are Level-3 progressive
> disclosure — they cost ~0 tokens until an agent opens them, which is why the vendored spec/sandbox
> (~6,400 + ~4,000 lines) are *indexed*, not front-loaded.

## Commands (11)

`brainstorm` · `design` (multi-round, human-in-the-loop design exploration → a reusable design context,
a *spec, not source*) · `plan` · `build` (the 3-stage gated core) · `e2e` (comprehensive Playwright e2e +
visual-baseline coverage for a web app — every screen/feature tested, confirmed, and fixed) · `next` ·
`status` · `check` (incl. `check --usage`) · `clean` · `init` · `upgrade` (zero-arg stack migration).

## Agents (27) — spawned on demand by commands/workflows, isolated context

- **Validation (10):** spec, plugin-spec, type, jsdoc, test, web, readable-code, common, architecture validators + validation-coordinator
- **Review/judgment (5):** verifier, code-reviewer, wave-judge, error-diagnostician, skeptic
- **Brainstorm (3):** brainstorm-researcher, challenger, synthesizer
- **Design (3):** design-generator (parallel concept prototypes), design-synthesizer (writes the design context), design-critic (round critique)
- **Build/plan support (3):** builder, plan-checker, planning-phase `researcher`
- **E2E (3):** web-e2e-tester (comprehensive Playwright e2e + visual baselines + dual-side error capture + behavioral correctness; runs the app for real on desktop + mobile, orchestrates the human-QA loop until clean) + web-qa-explorer (human-QA exploratory tester — charters/tours/layered oracles + FEW HICCUPPS; finds what the scripted suite missed and turns confirmed bugs into durable regression tests) + web-ux-reviewer (modern-UX + responsive/mobile experience judge; evidence-grounded, applies clear standards-backed wins, proposes the rest)
- Mechanical validators run at `effort: low` (haiku); deep reviewers (`code-reviewer`, `wave-judge`,
  `skeptic`) at `effort: high` — to keep the 20-agent surface cost-aware.

## Workflows (3) — opt-in dynamic fan-outs (Claude Code v2.1.154+)

`moku-verify` (parallel validators → disposition; `{adversarial:true}` adds a skeptic pass) ·
`moku-build-wave` (build one wave non-interactively) · `moku-migrate-sweep` (repo-wide mechanical
change). `/moku:init` installs `moku-verify` into a project.

## Hooks (12 events / 22 scripts)

PreToolUse guards (brainstorm path-gate, planning-write approve, plugin antipatterns,
common-usage MC1–MC3, structure + index validation, commit gate incl. `.planning/` no-commit),
PostToolUse (format-on-save,
pre-commit-review), Pre/PostCompact state snapshots, SessionStart (structured project context +
session title), PostToolUseFailure (routes tsc/lint/test failures to the diagnostician),
Stop/SubagentStop/Notification/PermissionRequest/UserPromptSubmit/SessionEnd. Status line:
`subagentStatusLine` wired in `settings.json`.

## Cost note

The agent fan-outs and the moku-core reference set are the largest contributors. To keep spend
down: run build waves one-per-session, prefer the read-only/`effort: low` validators for routine
checks, and use `/usage` to see the per-skill/per-subagent breakdown. See also `/moku:check --usage`.
