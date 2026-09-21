# Changelog

Older entries (0.1 – 0.62.4) live in [`docs/changelog/0.1-0.62.md`](./docs/changelog/0.1-0.62.md).

## 0.74.0 (2026-09-21)

Generated JSDoc examples say something, and lint enforces it. The rules were tried on `@moku-labs/game`
first: 506 examples became 240 and every API method is documented in the published types.

### Changed
- **The contract of an API method lives on the member of the `Api` type in `types.ts`.** Only that type ships in
  the `.d.mts`; with a factory annotated `: Api`, docs on its object literal never reached a consumer. The
  implementation carries no JSDoc. An inferred API (Nano, Micro) keeps its docs on the literal. The new `moku-core/references/jsdoc-examples.md` is the short form of `spec/15 §6`,
  which carries the same rules since core `d95c279`; spec and sandbox are re-vendored from that commit.
- **`@example` is no longer demanded on every export.** A public `Api` member gets a scenario: when a consumer
  calls it, a call with literal arguments in `app.<plugin>.<method>(…)` form, the result as a comment. A private
  pure function gets one literal line. A function that takes `ctx` or state, a factory and a private type get
  none.
- **API means public.** A plugin API has no private or internal tier. A member called by another plugin gets its
  example from that plugin's side (`const time = ctx.require(timePlugin); … time.pause();`). A member for which
  no honest example can be written is an API finding: it moves off the API into a plain function, or it is
  deleted. There is no `@remarks No example` exemption.
- **Every example must be true.** Builders read the real signature and a test before writing one.
  `moku-style-validator` checks it (E4), next to the echo (E1), docs on the implementation (E2), an undocumented
  `Api` member (E3), an example where none belongs (E5) and a member that does not belong on the API (E6).
- **The scaffolded `eslint.config.ts` enforces the mechanical part.** Block 6 turns `require-example` and
  `ArrowFunctionExpression` off; block 6b requires JSDoc and `@example`, with no exemption, on every `…Api` member in
  `src/**/types.ts`, for method and property signatures; block 6c rejects an example that is one call with bare
  identifiers, on functions and type members, in `ts` and `typescript` fences.

- **The core knowledge follows `@moku-labs/core` 1.7.0** (was 1.6.1). One additive change: the framework
  `onError` of `createCore` is called as `(error, core)` with the core plugin APIs only, for example
  `{ log, env }`. `core-api.md`, `communication-context.md` and the registry say so. `/moku:upgrade` moves a
  framework's direct core dependency to 1.7.0.

- **The packs follow npm.** Every surface was read from the tag source.

  | Pack | From | To | What is new |
  |---|---|---|---|
  | `moku-web` | 2.2.2 | 2.3.3 | `collectionPlugin`: static-data shards, `app.collection.write` at build, `loadCollectionShard` on the client; the build `public` phase copies incrementally |
  | `moku-worker` | 0.15.0 | 0.20.2 | `turnPlugin`: Cloudflare Realtime TURN keys as a declared resource; `DeployReport.turn`; `turn.<key>.verifyPath` |
  | `moku-room` | 0.3.1 | 0.8.2 | at-least-once intents and the event `room:intent-undeliverable`; sync gap heal; `iceServers: "auto"`; the hub serves `GET /api/ice` |
  | `moku-common` | 0.3.2 | 0.3.3 | pins core 1.7.0 |
  | `moku-native` | 0.2.1 | 0.2.2 | pins core 1.6.0 and common 0.3.2 |
  | `moku-system` | 0.2.0 | 0.2.1 | pins core 1.6.0 and common 0.3.2; `startResolution(kind, ctx, load)` |

  `/moku:upgrade` moves projects to these versions. No breaking change for consumers in any of the six ranges.

### Fixed
- **The skeleton templates no longer teach the echo.** `plan-templates.md` stubs carried
  `const api = createApi(ctx);`; the `moku-common-conventions` sample carried `const api = createMailerApi(ctx);`.

### Not in this release
- Existing projects keep their old lint. No `/moku:upgrade` migration, by decision: rewriting the docs of a
  finished project costs more than it gives. The rules apply to what the plugin builds from now on.

## 0.73.1 (2026-09-21)

The core knowledge follows `@moku-labs/core` 1.6.1. No code changes.

### Changed
- **Spec and sandbox re-vendored from `v1.6.1`** (was `v1.5.0`). Six spec files and one sandbox test changed,
  no section was added or removed. The registry entry `core` carries `knownVersion: "1.6.1"`.
- **`onStop` gets the plugin's own `config` and `state`** next to `global` since core 1.6
  (`TeardownContext<Config, C, S>`); still no `emit`, `require`, `has` or core plugin APIs. The context tables in
  `moku-core` and `moku-testing`, `communication-context.md`, `invariants.md`, the teardown mock factory and the
  structure validator say so, each with the pre-1.6 shape.

### Fixed
- **The brand-kit examples in `moku-common-conventions` compile.** They called `box("…")`,
  `spinnerFrameAt(frame++)` and `con.check("…")`. The kit has `con.box(lines)`, `spinnerFrameAt(elapsedMs)` and
  `con.check(ok, label, detail?)`.

## 0.73.0 (2026-09-21)

`@moku-labs/common` gets its pack. No code changes.

### Added
- **`moku-common`**, the `@moku-labs/common` pack, synced to `0.3.2`: `logPlugin` and `envPlugin` as the core
  plugins a framework registers in `createCoreConfig`, the env providers per runtime (`processEnv`, `dotenv`,
  `cloudflareBindings`, `browserEnv`, `workerSafeProcessEnv`), the branded `./cli` kit and the `./browser` entry.
  One eval case, `common-framework-registers`.

### Changed
- **The core skill `moku-common` is now `moku-common-conventions`.** It keeps the family rules MC1–MC3 with their
  examples and exceptions, which the `validate-common-usage` hook and `moku-structure-validator` enforce. The
  package API moved to the pack, so the two skills no longer share a name. Every reference in the core, the
  web, worker and design packs follows the rename.
- The registry entry `common` points at the pack and carries `knownVersion: "0.3.2"`, so `/moku:upgrade` now
  offers `moku-common-version` to a project that depends on the package directly.

## 0.72.0 (2026-09-21)

Two frameworks get their packs. No code changes.

### Added
- **`moku-native`**, the `@moku-labs/native` pack, synced to `0.2.1`: packaging a Moku app as a Tauri 2 desktop
  or mobile app. The skill teaches the second `createApp` beside the web app, the shared `config.system` list,
  the typed `cli` verbs and what stays generated. The index covers the 5 plugins, the build pipeline, the
  capability registry and the 13 doctor checks.
- **`moku-system`**, the `@moku-labs/system` pack, synced to `0.2.0`: store, notify, clipboard, tray and
  deep-link behind a Tauri/web provider seam. The skill teaches the per-capability subpaths, `SystemResult`
  narrowing, explicit notification permission and the optional `@tauri-apps/*` peers.
- One eval case per pack: `native-second-app`, `system-result-not-runtime`.
- Both catalogs come from the release tag source. Where upstream `llms.txt` disagrees with the source, the
  index says so and the source wins.

### Changed
- The registry entries `native` and `system` point at their packs and carry the synced versions, so
  `/moku:upgrade` now offers `moku-native-version` and `moku-system-version`. `/moku:check` suggests the two
  packs when a project depends on the frameworks.

## 0.71.2 (2026-09-21)

Wording left over from #15, and three frameworks join the registry. No code changes.

### Added
- **`common`, `native` and `system` in the framework registry** (`moku-frameworks.md`), with their
  `moku-<key>-version` upgrade migrations. They are registered at `knownVersion: "0.0.0"`: `/moku:upgrade` stays
  silent for them until the first `moku-sync <key>`. `native` and `system` have no pack yet. `@moku-labs/game`
  (in development) and `@moku-labs/ai` (not verified) are left out on purpose.

### Fixed
- **Every scoped test command is the project's runner.** `moku-quality-validator`, `build-verification.md`
  (regression run) and `tdd-protocol.md` said `bun test <dir>`. They now say `bunx vitest run <dir>`, with
  `bun test` only for a project without `vitest`.
- `memory-schema.md` no longer says validators may keep `memory: user`. The field switches Write and Edit on,
  and 0.71.1 removed it from every agent.
- `agent-preamble.md` drops the project-memory rule: no agent has persistent memory, so it never applied.

## 0.71.1 (2026-09-21)

A real `/moku:build` of `@moku-labs/game` on 0.71.0 hit nine tool defects (#15). Nothing new, every row is a fix.

### Fixed
- **`moku-verify-artifacts --run` tests with Vitest** (`bunx vitest run <dir>`) when the project depends on
  `vitest`. `bun test` failed green suites: Bun's runner has no `vi.stubGlobal` and no
  `expectTypeOf(...).parameter`. Projects without Vitest keep `bun test`.
- **The shell guard judges the files a command writes**, not `src/` tokens in its text. A redirect writes the
  word after it; `tee`, `touch`, `mv`, `cp`, `install`, `ln` and `sed -i` write the files they name. `2>/dev/null`,
  `2>&1`, heredoc bodies and quoted patterns name nothing, so `grep -rn x src/ 2>/dev/null` and a heredoc into
  `.planning/*.md` pass at any station. Targets are placed against the project root, `cd` included, so commands
  aimed at another repository pass. A writer behind `xargs` or `find -exec` is judged by the words that can name
  its files, so `grep -l x src/*.ts | xargs sed -i …` is still refused outside a writing station.
- **The commit hook judges only the `git add` / `git stage` / `git commit` part of a command.** A read-only
  command next to it (`git check-ignore .planning`, `ls .planning`) and a heredoc commit message that mentions
  `.planning/` no longer block.
- **A paused change reads as paused.** `moku-rails status` and the prompt hook print
  `Paused: <id> … inside station "plan": <reason>` instead of `Debt [stuck-station]`. The reason is kept in the
  ledger until work continues.
- **Read-only agents are read-only again.** `memory: user` switched Write and Edit on over the `tools` list of
  `moku-plan-checker`, `moku-architecture-validator`, `moku-error-diagnostician`, its deep variant and
  `moku-researcher`, and let the plan checker cite memory files. The field is gone from all five.
- **`moku-builder-deep` has `maxTurns: 80`**, the number the wave reference promises. Builders lint each file as
  it turns green and return the contract before turns run out. They test with `bunx vitest run <dir>` in a
  Vitest project, like the verify script.
- **Plugin `index.ts` limit is 40 effective lines** (`spec/15 §2.5`, Very Complex), and
  `pluginIndexMaxLines` in `.claude/moku.local.md` overrides it.

### Docs
- `build-wave-execution.md` and the `moku-build-wave` workflow no longer use `isolation: "worktree"`: a worktree
  has no `node_modules` and no `.planning/`. Builders share one tree, kept apart by disjoint folders and the
  command ban.
- `plan-stages.md` and the plan skill describe the size-L route after `moku-rails scope`: a delta spec for the
  new scope, one gate, back to build.

## 0.71.0 (2026-09-19)

The first end-to-end run of 0.70.0 built a real site and showed where the rails leaked: the conductor ran
once in 18 turns, an open change inside `build` admitted any later work, builders never ran for an app, and
the hooks judged projects by a text search of `package.json`. Report: [`docs/revival/E2E-REPORT.md`](./docs/revival/E2E-REPORT.md).

### Breaking
- **The rails are opt-in per directory.** Hooks act only where a moku session was started
  (`.planning/state.json`) or the project is initialized (`.planning/moku.md`). The `@moku-labs/` text search is
  gone, and with it every block in repositories that never asked for moku (#14). `moku-rails open` and `enter`
  refuse outside a session and name the step.
- **Optional stations need a decision.** `enter plan`, `build` and `close` refuse while an optional station
  before them is neither done nor skipped with `moku-rails skip <station> --reason`.

### Added
- **`moku:session`** skill and `moku-rails session start [--root <dir>]`: settle the directory, create it when
  new, put it on the rails. A session started for a folder below the conversation's cwd is remembered, so the
  prompt and stop hooks find it.
- **Prompt hook** (`UserPromptSubmit`): hands the model the project's standing and the routing rule with every
  request and marks it unrouted. The write gate refuses source until `open`, `enter`, `continue` or `scope` ran.
  Off the rails it is silent, except for one hint toward `moku:session` when the person names moku.
- **`moku-rails continue`** and **`moku-rails scope "<what is new>"`**. Scope sends a size M or L change back in
  front of plan, so new work gets a delta spec before it is built.
- **The discussion page** (brainstorm): on request, the reasoning goes on a page with diagrams, an options
  table, open questions with proposed answers and a decisions log. The person comments and corrects it there;
  the agreed page becomes the context file. Offered once when someone brings an idea and not a task.

### Changed
- One root rule for every hook: the nearest directory on the rails at or above the file, not the session's cwd.
- The session hook no longer writes `.planning/moku.md`; only the init station does.
- Conductor: a new project is size L; stations run through their skills, never by hand; a yes from before the
  spec existed does not approve it; no commands or station names are handed to the person; a table maps plain
  phrases to stations.
- Build: an app with no custom plugins builds through builders, one page or island per unit, with a code review
  per wave.
- E2E: triggers on "check it in the browser, on a phone"; never waits on a background reviewer.
- Clean archives the Astra triage, design decisions, asset manifests and discussion pages before it removes
  their folders.
- Init removes `build_worker_script` and `migrate_script` from an app's `ci.yml` when the scripts do not exist.
- Verify spawns validators in batches of the parallel-agent limit.

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
