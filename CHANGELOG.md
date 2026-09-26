# Changelog

Older entries (0.1 – 0.62.4) live in [`docs/changelog/0.1-0.62.md`](./docs/changelog/0.1-0.62.md).

## 0.76.0 (2026-09-26)

The limits that only truncated work are gone, and nothing that runs in the background closes a gate or
blocks the end of a turn. Finishes what 0.75.0 started, from the same real project session on 0.74.1:
agents died at their turn limit (the e2e tester three times, builder-deep, the code reviewer, the skeptic
twice in one pass, the UX reviewer), and `moku-rails pause` refused while builders ran, so the orchestrator
could neither pause nor end its turn.

### Changed
- **No turn limit on the agents that do the work.** `moku-builder`, `moku-builder-deep`,
  `moku-web-e2e-tester`, `moku-web-qa-explorer`, `moku-web-ux-reviewer` and `design-generator` have no
  `maxTurns` any more. In Claude Code an agent without the key has no cap: the harness never stops it, it
  stops when the work is done or blocked. Their first body line says `Turn budget: **no limit**`. The
  read-only agents keep a limit far above any real run, with the reason as a `# why` comment on the key,
  and `scripts/check-manifests.mjs` requires the comment and the matching budget line.

  | Agent | From | To |
  |---|---|---|
  | `moku-builder`, `moku-builder-deep` | 150, 300 | none |
  | `moku-web-e2e-tester`, `moku-web-qa-explorer`, `moku-web-ux-reviewer` | 300, 150, 150 | none |
  | `design-generator` | 40 | none |
  | `moku-code-reviewer` | 120 | 300 |
  | `moku-structure-validator`, `moku-style-validator`, `moku-quality-validator` | 40, 40, 60 | 300 |
  | `moku-architecture-validator`, `moku-web-validator`, `moku-plan-checker` | 30 | 300 |
  | `moku-researcher`, `brainstorm-challenger` | 40, 15 | 300 |
  | `moku-error-diagnostician`, `moku-error-diagnostician-deep` | 25 | 300 |
  | `moku-skeptic` | 40 | 100 |

- **The report rule is written for both cases.** "Turn budget and the report" in `agent-preamble.md` now
  starts from the two first-body lines: reserve the end of the work for the report, deliver it through the
  hand-back before stopping, a partial report with an honest verdict beats none, keep tool calls few; and,
  only where a limit still applies, stop new work at 80 % of it.
- **`moku-rails pause` warns instead of refusing while agents run.** The pause never closed the gate for a
  subagent (a subagent's write needs an open change at a writing station, nothing else), so refusing it
  only left the orchestrator unable to end its turn. It now pauses and prints one warning naming the
  agents; `--force` is accepted and changes nothing.
- **The orchestrating skills allow background agents.** build, verify, e2e and design say that agents may
  run in the background, that only this session spawns agents, that one builder writes a given plugin at a
  time (two on the same files overwrote each other; a builder that finds another writer and refuses is
  right), and that the orchestrator commits after each green round. The foreground stays the choice for a
  non-interactive session, where a background completion may never arrive.

### Fixed
- **Waiting for spawned agents is a legitimate end of turn.** The `Stop` hook and `moku-rails may-stop`
  let a turn end inside a station without a pause while the station records running agents
  (`.planning/agents/`) or the harness lists a subagent in the payload's `background_tasks`. Before, the
  orchestrator had to pause to end its turn, and the pause was refused while its builders ran.
- **The routing flag holds no one while agents run.** The write and shell gates already let a payload with
  `agent_id` through; the agents the station records are the second witness, so a builder is never refused
  by "has not been routed yet" even if the marker were missing.
- **A harness prompt prints nothing, on or off the rails.** The prompt hook used to print the off-rails
  "the person mentions moku" hint on every subagent hand-back that named moku, and the standing plus the
  routing rule on every hand-back before 0.75.0. It now recognises the harness prompt first, so the
  standing and "route before acting" appear once per typed message and never on an agent's reply.
  `<teammate-message>` joins the recognised markers, next to `isMeta`, `origin.kind` and `agent_id`.
- **Commit gates step aside in a tree without `node_modules`.** The scaffolded `lefthook.yml` skips its
  pre-commit jobs there (`skip: - run: test ! -d node_modules`) and the moku `verify-before-commit` hook
  skips its tsc and lint gate on the same condition: a PR snapshot worktree cannot run them, and the tree
  passed in the checkout that has them. `tooling-config.md` documents `--no-verify` for such a snapshot in
  a project whose `lefthook.yml` predates the skip line, and only there.

## 0.75.0 (2026-09-26)

Every agent ends with a report, and the write gate closes only on a typed message. Both were systemic
in a real project session on 0.74.1: agents hit their turn limit with "produced no report" and were
resumed by hand, and every subagent hand-back or task notification closed the gate under builders
running in the background.

### Fixed
- **No agent ends without a report.** The preamble has a new section, "Turn budget and the report":
  reserve the last 10 turns for the report, stop new work at 80 % of the budget, deliver the output
  contract with an honest verdict, never end a turn without one, keep tool calls few. Every agent's
  first body line states its budget and its stop turn (`Turn budget: **40 turns** ... At turn 32 stop
  new work`), and `scripts/check-manifests.mjs` fails when that line disagrees with `maxTurns`.
- **The `SubagentStop` hook enforces it.** A moku agent that stops without its contract is told once,
  through the stop decision, to deliver it now. A second silence is logged as
  `no report (turn limit: 150/150)` when the agent transcript shows the budget was used up, and the
  person sees the resume instruction. The prompt hook prints the same instruction when a hand-back or
  task notification says an agent produced no report; a new PostToolUse hook on the `Agent` tool does
  it for a foreground result. Stdout of `SubagentStop` never reaches the orchestrator, so those two are
  the channels.
- **The gate closes only on the person's message.** `on-prompt.mjs` leaves `turn.routed` untouched for
  a prompt the harness wrote: a subagent hand-back, a task notification, a CI-monitor event, an
  artifact-comment relay, a scheduled wake-up, and any prompt inside a subagent (`agent_id` present).
  Before, each of those marked the turn unrouted and every builder's next write was refused with "has
  not been routed yet".
- **Subagent writes are not held by the routing flag.** The write and shell gates read the `agent_id`
  the harness puts on every hook payload inside a subagent. A subagent's source write needs an open
  change at a writing station and nothing else: the routing happened when the orchestrator entered the
  station and spawned it. The orchestrator's own writes still wait for the routing.
- **`moku-rails pause` refuses while agents run inside the station.** A new `SubagentStart` hook records
  each running moku agent under `.planning/agents/`, `SubagentStop` removes it, `status` names them
  (`Agents: 2 agent(s) running: moku:moku-builder ×2`). `pause --force` is for a record a crashed agent
  left behind.

### Changed
- **Turn limits.** The Agent tool has no per-call override; a `SendMessage` resume is the only way to
  give an agent more turns, so the definitions carry the room the work needs.

  | Agent | From | To |
  |---|---|---|
  | `moku-web-e2e-tester` | 150 | 300 |
  | `moku-builder-deep` | 150 | 300 |
  | `moku-code-reviewer` | 40 | 120 |
  | `moku-skeptic` | 12 | 40 |

- **The orchestrating skills** (build, verify, e2e, design) put "keep tool calls few: read and write
  whole files, run one check per group" in every spawn prompt and treat a missing report as a failure
  that triggers exactly one "deliver your report now" resume, never an open-ended wait. `verify` no
  longer retries a silent validator three times; a silent skeptic counts as upheld. `e2e` no longer
  tells the orchestrator to finish the capture without messaging the reviewer at all.
- **The moku skill** says that "route before acting" applies to the person's messages, what the
  harness prompts are, and why a subagent is never held by the flag.

## 0.74.2 (2026-09-25)

A git worktree session works on the main checkout's plan.

### Fixed
- **A worktree gets `.planning/`.** `.planning/` is gitignored, so a session in a git worktree started with
  no plan and no ledger. Hooks walked up from `.claude/worktrees/<name>` to the main checkout's ledger,
  while `moku-rails` looked only in the worktree. The SessionStart hooks now link the worktree's
  `.planning` to the main checkout's `.planning/`, so both find the same plan. A copy would drift from the
  main checkout and be deleted with the worktree.
- **The link stays out of git.** `.planning/` with a slash in `.gitignore` matches folders only, and git sees
  a link as a file. The hook adds `.planning` to the repository's `info/exclude`, which every worktree
  shares.

  Subagent worktrees still have no `.planning/`: SessionStart does not run for them, and builders do not
  use `isolation: "worktree"`.

## 0.74.1 (2026-09-25)

The long-running agents get 150 turns. No code changes.

### Changed
- **`maxTurns: 150` on five agents.** In a real project session they hit their limit on almost every delta
  task, and the orchestrator resumed each one 2 to 4 times per task.

  | Agent | From | To |
  |---|---|---|
  | `moku-builder` | 60 | 150 |
  | `moku-builder-deep` | 80 | 150 |
  | `moku-web-e2e-tester` | 80 | 150 |
  | `moku-web-qa-explorer` | 80 | 150 |
  | `moku-web-ux-reviewer` | 60 | 150 |

  `build-wave-execution.md` says so. Its tier table is now the expected budget for a net-new plugin, and
  Complex and VeryComplex plugins go to `moku-builder-deep` for its reasoning effort, not for more turns.
- **Two short agents get more room.** In the same session `moku-quality-validator` used all its turns once
  and `moku-code-reviewer` twice, and each was resumed to finish.

  | Agent | From | To |
  |---|---|---|
  | `moku-quality-validator` | 40 | 60 |
  | `moku-code-reviewer` | 25 | 40 |

  The researcher, the design generator, the diagnosticians, the skeptic, the plan checker, the brainstorm
  challenger and the other validators keep their limits.

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
