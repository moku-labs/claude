# Changelog

Older entries (0.1 – 0.62.4) live in [`docs/changelog/0.1-0.62.md`](./docs/changelog/0.1-0.62.md).

## 0.70.0 (2026-09-19)

The revival. The plugin had been quiet for 83 days while Claude Code shipped 82 releases, Opus 5 and
Fable 5.1 arrived, and Codex gained GPT-6 Astra. The core ideas held up; the scaffolding around them was
written for older models and a 200K window. Full reasoning: [`docs/revival/DECISIONS.md`](./docs/revival/DECISIONS.md).

### Breaking
- **One plugin became six.** `moku` (core) plus the packs `moku-web`, `moku-design`, `moku-worker`,
  `moku-room`, `moku-maintainer`. Reinstall: `/plugin install moku@moku`, then the packs you use.
- **Commands became skills.** Same names (`/moku:build` …); `/moku:design` is `/moku-design:design`,
  `/moku:e2e` is `/moku-web:e2e`, `/moku:next` is replaced by the conductor.
- **Source writes are gated.** In a moku project the agent cannot write `src/` before init or outside an
  open change at a writing station. Plugin option `rails`: `strict` (default), `warn`, `off`.

### Added
- **The conductor** (`moku` skill): plain-language entry that reconciles, classifies, proposes and drives.
- **The rails**: `moku-rails` CLI, `.planning/state.json` ledger, write gate, stop gate, session status.
- **The change loop**: work after creation travels as a change of size S, M or L; `plan` has a delta-spec
  route, `build` has a small-fix route, every change closes on the same checklist and is archived with its outcome.
- **Astra**: `moku-astra review|generate|edit|probe` through the Codex CLI, typed findings, asset manifests,
  triage protocol, Fable fallback.
- **Design modes**: UI, API (usage first) and architecture.
- **Release skill** with thin workflow templates for `moku-labs/ci`; `init` scaffolds CI from the first commit.
- **Evals** for every plugin (`claude plugin eval`), with the 0.62.4 baseline recorded.
- **Tests**: `node:test` suites for the rails, hooks, the artifact verifier and the Astra wrapper.
- `docs/pack-template` for new framework packs.

### Changed
- **Models**: Fable orchestrates and judges, Opus builds and reviews, Sonnet validates under the skeptic's
  supervision. Every agent and lifecycle skill pins `model` and `effort`.
- **Agents 28 → 18**: four structure validators, two style validators and two quality validators merged
  into three; two researchers into one. No agent spawns agents.
- **Hooks 22 scripts → 15**: one write gate instead of six hooks per write.
- Skills and agents rewritten in plain language: reasons instead of capitals, no personas, no
  re-verification pressure, references instead of duplication (`plan` 476 → 133 lines).
- One output style, `moku`: the user's language, English code, tables, diagrams and concrete examples.

### Removed
- Agents: validation-coordinator, wave-judge, brainstorm-synthesizer, design-synthesizer, design-critic
  (the orchestrating session does this work), verifier (now `moku-verify-artifacts`, a script).
- Hooks: per-prompt context injection, the custom permission script, notifications, sounds, loggers,
  the brainstorm guard and planning-write approver (the rails cover them).
- Task DAG and every `TodoWrite` / `Task*` instruction (the tools no longer exist on current models),
  200K-context throttles, `ultrathink`, dead `mcp__Claude_Preview__*` tool names.
- The 512-line CI reference with two full workflow listings; the YAML lives once, in `moku-labs/ci`.

### Fixed
- The SubagentStop logger read a payload field that does not exist and never matched plugin-qualified
  agent names; it is now a tested node hook.
- The design command's frontmatter was invalid YAML, so it loaded with empty metadata.
