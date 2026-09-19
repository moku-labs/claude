# Moku marketplace — component inventory

A discoverability map of what each plugin brings into a session, so the component surface (and its
rough context cost) is visible before relying on it. Use `claude plugin details <name>` for the live
component list and `/usage` for actual token spend.

One marketplace, six plugins: the core (`moku`), one pack per framework, and a maintainer pack.
A pack depends on `moku` and never reaches core files by path — it loads the `moku:moku-core` skill
with the Skill tool and reads `references/<file>` under the base directory the tool prints.

| Plugin | Skills | Agents | Hooks | Bins | Default |
|---|---:|---:|---:|---:|---|
| `moku` | 17 | 13 | 16 scripts / 7 events | 2 | enabled |
| `moku-web` | 2 | 4 | — | — | enabled |
| `moku-design` | 2 | 1 | — | 1 | enabled |
| `moku-worker` | 1 | — | — | — | enabled |
| `moku-room` | 1 | — | — | — | enabled |
| `moku-maintainer` | 2 | — | — | — | `defaultEnabled: false` |

---

## `moku` — the core

### Lifecycle skills (11)

Invoked as `/moku:<name>`, and by the conductor. Each one enters and leaves a station through
`bin/moku-rails`.

| Skill | model / effort | What it does |
|---|---|---|
| `moku` | fable / medium | The conductor — the single conversational entry. Opens a change, picks the station, invokes the others. |
| `init` | fable / medium | Project level: scaffolds the project and leaves `.planning/moku.md`, the marker the rails read. |
| `brainstorm` | fable / high | Present → Challenge → Decide debate loop into a position and a context file. |
| `plan` | fable / high | Plan stages and specs; supports a delta spec for M changes. |
| `build` | fable / medium | Gated build waves; an S route reproduces with a failing test, fixes, then verifies in scope. |
| `verify` | fable / medium | Fans validators out directly, runs the cited-refute skeptic pass, auto-fixes in a bounded loop. |
| `moku-release` | fable / medium | The release model: three commands from `@moku-labs/ci`, two thin CI workflows, no `NPM_TOKEN`. |
| `status` | fable / low | Phase and wave state from `.planning/STATE.md`. |
| `check` | fable / low | Standalone checks, incl. `check --usage`. |
| `clean` | fable / low | Clears generated and scratch state. |
| `upgrade` | fable / low | Stack migration toward `target-stack.md`, driven by `upgrade-migrations.md`. |

### Knowledge skills (6)

Model-invocable, no `model`/`effort` — they inherit the session.

| Skill | Triggers on | What it brings |
|---|---|---|
| `moku-core` | moku architecture, factory chain, createCoreConfig, lifecycle, events | The vendored `spec/` + `spec-index.md`, the `sandbox/` exemplars + `sandbox-index.md`, the build/plan/brainstorm reference set, `agent-preamble.md`, `moku-idioms.md`, `moku-frameworks.md` (the framework registry and the pack contract), memory / tool-scoping / hook-pattern docs |
| `moku-plugin` | plugin structure, complexity tiers, createPlugin layout | Tiered plugin file organization (Nano → VeryComplex), naming, the wiring-harness rule, Layer-3 consumer plugins |
| `moku-testing` | TDD, mock context, moku test patterns | Red → Green → Refactor protocol, mock-ctx and `createTestApp` scaffolds, type-level tests |
| `moku-readable-code` | readable code, wall of text, stanza style | The 10-rule stanza style; paired with `moku-style-validator` |
| `moku-common` | @moku-labs/common, branded cli, ctx.log, ctx.env | MC1–MC3 in `references/conventions.md`; paired with `moku-structure-validator` and the `validate-common-usage` hook |
| `moku-readme` | root readme, moku-labs readme style | The root-README house style: masthead, badges, central table, mermaid, footer |

### Agents (13)

Only the orchestrating session spawns agents; no agent lists `Agent` in `tools`.

| Agent | model / effort | Role |
|---|---|---|
| `moku-structure-validator` | sonnet / medium | Spec, plugin structure, root/entrypoint app shape (I1–I6), `@moku-labs/common` usage |
| `moku-style-validator` | sonnet / medium | Readable-code stanza style and JSDoc completeness |
| `moku-quality-validator` | sonnet / medium | Runs `tsc`, tests and lint through Bash as facts, then judges test quality |
| `moku-architecture-validator` | fable / high | Cross-plugin dependency graph, event flow, API consistency |
| `moku-plan-checker` | fable / high | Plan completeness: requirement coverage, dependency graph, event flow |
| `brainstorm-challenger` | fable / high | Stress-tests brainstorm positions |
| `moku-builder` | opus / high | Builds one plugin from spec + skeleton: TDD, filesystem isolation, JSON contract |
| `moku-builder-deep` | opus / xhigh | Same instructions, for Complex/VeryComplex tiers and retries |
| `moku-error-diagnostician` | opus / high | Classifies build failures, proposes targeted fixes |
| `moku-error-diagnostician-deep` | opus / xhigh | Same instructions, the retry variant |
| `moku-code-reviewer` | opus / high | Post-wave diff review |
| `moku-skeptic` | opus / medium | Upholds a finding unless a cited spec section refutes it |
| `moku-researcher` | sonnet / medium | npm ecosystem and reference implementations; the only agent with web access |

A Sonnet agent never closes a gate: its findings go through `moku-skeptic` and the verdict is the
orchestrating session's.

### Hooks — 16 scripts across 7 events (`hooks/hooks.json`)

| Event | Scripts |
|---|---|
| `SessionStart` | `detect-moku-project.sh`, `session-rails.mjs` |
| `PreToolUse` (Write, Edit) | `pre-write.mjs` |
| `PreToolUse` (Bash) | `verify-before-commit.sh` |
| `PostToolUse` (Write, Edit) | `format-on-save.sh` (async) |
| `PostToolUse` (Bash) | `pre-commit-review.sh` |
| `PreCompact` / `PostCompact` | `precompact-state.sh`, `postcompact-state.sh` |
| `SubagentStop` | `on-subagent-stop.mjs` |
| `Stop` | `on-stop.mjs` |

Not wired into `hooks.json`, called by the scripts above or by skills:
`check-plugin-antipatterns.sh`, `validate-common-usage.sh`, `validate-plugin-index.sh`,
`validate-plugin-structure.sh`. `moku-statusline.sh` is wired through `settings.json`
(`subagentStatusLine`). Output style: `output-styles/moku.md`.

### Bins (2)

- `bin/moku-rails` — the lifecycle gate. `enter` / `done` / `pause` / `open`; exit 2 means refused.
- `bin/moku-verify-artifacts` — deterministic 3-level artifact verification (existence, substance, wiring).

### Evals (7)

`conductor-idea`, `rails-no-init`, `nano-plugin-shape`, `thin-root`, `readable-stanzas`,
`release-first-publish`, plus `baselines/`. See `plugins/moku/evals/README.md`.

---

## `moku-web` — the `@moku-labs/web` pack

- **Skills (2):** `moku-web` (knowledge: Preact islands, `data-*` attributes, `@scope`/`@layer`,
  tokens, `references/project-spec.md`), `e2e` (fable / medium — the real-browser e2e station,
  `references/e2e-testing.md`).
- **Agents (4):** `moku-web-validator` (sonnet / medium), `moku-web-e2e-tester` (opus / high),
  `moku-web-qa-explorer` (opus / high), `moku-web-ux-reviewer` (sonnet / medium).
- **Evals (2):** `web-island-attrs`, `e2e-ux-gate-fallback`.

## `moku-design` — the design station

- **Skills (2):** `design` (fable / high), `moku-astra` (fable / medium).
- **Agents (1):** `design-generator` (opus / high) — one self-contained concept prototype per instance.
- **Bins (1):** `bin/moku-astra` — `review|generate|edit|probe`; exit 3 means unavailable.
- **Evals (2):** `design-api-mode`, `astra-when-not`.

## `moku-worker` — the `@moku-labs/worker` pack

- **Skills (1):** `moku-worker` — the Cloudflare Workers backend framework, synced to `0.15.0`
  (9 plugins: bindings, server, kv, d1, queues, storage, durableObjects, deploy, cli; `endpoint.new`
  guards; stage is plain global config since 0.12.0). Full catalog in `references/plugin-index.md`.
- **Evals (1):** `worker-one-app` — one worker app composing deploy and cli, no facade (idiom I6).

## `moku-room` — the `@moku-labs/room` pack

- **Skills (1):** `moku-room` — couch multiplayer, synced to `0.3.1`. A standalone `@moku-labs/core`
  framework, sibling to web and worker, not built on them: 7 plugins, three signaling adapters, and
  an opt-in `./server` tier exporting `hubPlugin` + the `Hub` Durable Object. Full catalog in
  `references/plugin-index.md`.
- **Evals (1):** `room-standalone-core` — room is its own core, not a web or worker plugin pack.

## `moku-maintainer` — this repository's own tooling

`defaultEnabled: false`. Both skills run from the repository root and edit this working tree.

- `spec-sync` — re-vendors the Core spec + sandbox into
  `plugins/moku/skills/moku-core/references/`, regenerates `spec-index.md` / `sandbox-index.md`,
  then chains `moku-sync`.
- `moku-sync` — per framework: resolves the upstream release, regenerates the pack's
  `plugin-index.md` and skill API form, bumps `knownVersion` in the registry.

Version bumps touch both `plugins/<name>/.claude-plugin/plugin.json` and the matching entry in
`.claude-plugin/marketplace.json`; the two must agree, and `claude plugin tag` validates it.

---

## Adding a pack

Copy `docs/pack-template/` and follow its five steps. The pack contract — same shape for every pack,
plus the registry row — is in `plugins/moku/skills/moku-core/references/moku-frameworks.md`
(§ Pack contract). Frameworks without a pack yet: `@moku-labs/ai`, `@moku-labs/system`, and the
planned game engine.

## Cost note

References are progressive disclosure: they cost roughly nothing until an agent opens them, which is
why the vendored spec and sandbox are indexed rather than front-loaded. The agent fan-outs are the
largest contributor. Enable only the packs for the frameworks in use, and read the per-skill and
per-subagent breakdown with `/usage` or `/moku:check --usage`.
