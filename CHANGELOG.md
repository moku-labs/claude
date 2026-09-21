# Changelog

Older entries (0.1 – 0.62.4) live in [`docs/changelog/0.1-0.62.md`](./docs/changelog/0.1-0.62.md).

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
  aimed at another repository pass.
- **The commit hook judges only the `git add` / `git stage` / `git commit` part of a command.** A read-only
  command next to it (`git check-ignore .planning`, `ls .planning`) and a heredoc commit message that mentions
  `.planning/` no longer block.
- **A paused change reads as paused.** `moku-rails status` and the prompt hook print
  `Paused: <id> … inside station "plan": <reason>` instead of `Debt [stuck-station]`. The reason is kept in the
  ledger until work continues.
- **`moku-plan-checker` is read-only again.** `memory: user` switched Write and Edit on over its tools list and
  let it cite memory files; the field is gone.
- **`moku-builder-deep` has `maxTurns: 80`**, the number the wave reference promises. Builders lint each file as
  it turns green and return the contract before turns run out.
- **Plugin `index.ts` limit is 40 effective lines** (`spec/15 §2.5`, Very Complex), and
  `pluginIndexMaxLines` in `.claude/moku.local.md` overrides it.

### Docs
- `build-wave-execution.md` no longer asks for `isolation: "worktree"`: a worktree has no `node_modules` and no
  `.planning/`. Builders share one tree, kept apart by disjoint folders and the command ban.
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
