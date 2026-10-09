# Changelog

Older entries (0.1 – 0.62.4) live in [`docs/changelog/0.1-0.62.md`](./docs/changelog/0.1-0.62.md).

## 0.83.4 (2026-10-09)

### Fixed
- **The status of the deck's bar was cut at 60 characters**, with room left in the bar. The bar cuts it at
  its own edge now.

## 0.83.3 (2026-10-09)

### Fixed
- **The status of the deck's bar was half translated.** For a shell command the bar shows the description
  Claude gives the call, and Claude wrote it in English.
  - In a Russian conversation the deck adds one sentence to the system prompt: write the `description` of
    a Bash call in Russian. An English conversation gets no sentence.
  - A description that is still in another language is not shown. The bar names the program instead:
    `команда gh`.

## 0.83.2 (2026-10-09)

### Fixed
- **The style validator raised a BLOCKER on the game template itself.** Since 0.82.1 verify reads a game's
  source, and its JSDoc rule wants a block right before every `export const x = factory(…)`. Eight exports
  of `hello-world.md` had only the `@file` block of their file: `uiAssets`, `sharedFeature`, `home`,
  `tap`, `helloScene`, `helloScreen`, `helloFeature` and `mainFlow`. Each has its own block now. The
  rule is unchanged.
- **An answer in the deck's bar needed two clicks.** The answer waited for the release of the click. The
  first click on the bar also gives it the focus, and its release did not always arrive. The press is
  taken on the way down now.

## 0.83.1 (2026-10-09)

### Changed
- **The deck speaks the language of the conversation.** English and Russian. The language is told from the
  letters of the person's prompt and of Claude's answer, code left out. A text under 12 letters, such as
  `pr S6` or `ok`, does not change it.
  - Translated: the tabs, every label and button of the pane, the status in the bar, the test row in the
    transcript, and the prompts the buttons send.
  - Not translated: `moku`, the station names and the checklist items, which are names of the rails, and
    the description of a shell command, which Claude writes.
  - All words are in one table, `hooks/words.ts`. A new language is one more entry there.

## 0.83.0 (2026-10-09)

### Added
- **`moku-deck`, a reply bar and a side pane inside Claude Code.** A new pack, written as a function hooks
  module. It is disabled by default: the function hooks API is early access and may change between
  Claude Code releases.
  - **The bar above the prompt.** It is there in a moku session and absent anywhere else. It turns the
    answers a reply asks for by name into buttons: a line with "say" or "скажи" and a code span gives one
    button per span. Mint is the next step, grey is optional, pink deletes something. `Pick from N items`
    opens the numbered items of the reply, and the picked ones are sent as `apply 1 3`, `fix 1 3` or
    `skip 1 3`. A prompt typed in the chat takes the buttons off. The status and the buttons take turns:
    with no buttons the bar says what runs, or what ran last. Beside buttons it says only work still running.
  - **The pane, `/moku-deck`.** `Flow` shows the route of the open change by its size, the station you are
    on with one line on what happens there, what is left before it can close, and the gate when the
    change waits for you. A game calls its e2e station the playtest. A station ahead is amber when the
    change must pass it and lavender when it may be skipped. `Ideas` lists the parked ideas, grouped by
    their lead word, each with `Start` and `Remove`. `Tests` reads `.planning/tests/runs.jsonl`: how many
    runs were not needed, the slow tests, and the test runs of this session named by what they tested.
  - **A test run in the transcript** is drawn as one row with its verdict.
  - **The answers of the bar are drawn by the pack itself**, in `hooks/answer.tsx`: the app's own button
    cannot be made taller or coloured.
  - Outside a moku session `/moku-deck` turns a preview on, with sample data.
- `npm run test:mods` runs the pack's tests with `claude plugin test`.

### Known limits
- `Remove` on an idea sends a request to Claude. The rails have no command that removes an idea yet.
- The pack reads one project: the `.planning/` of the working directory.
- On a terminal the answers are the app's own buttons.

## 0.82.1 (2026-10-09)

### Fixed
- **A game that names system plugins did not build.** The docs installed `@moku-labs/system` alone. Its
  Tauri packages are optional peers, so Bun leaves them out, and `moku-game build` stopped with
  `Could not resolve: "@tauri-apps/api/app"`.
  - `device.md` installs `@tauri-apps/api` and `@tauri-apps/plugin-haptics` with the package, and
    `@tauri-apps/plugin-store` for the store save. A table names the peer of each system plugin.
  - `hello-world.md` and the game skill point at it.
- **Verify raised a BLOCKER on the game template.** Rule I1 says a Layer-3 app declares no direct
  `@moku-labs/core` dependency. The game template pins core and common, because they are peers of the
  engine and of the editor.
  - The structure validator, the plan checker, `moku-idioms.md` and `structural-conformance.md` carry a
    game exception for the dependency check. The source half of I1 holds in a game.
  - Every other project type reads as before.
- **Verify did not look at game code.** The validators searched `src/`, and a game has none.
  - Verify lists Game among the project kinds and names the game's roots as the scope of the structure
    and style validators: `index.ts`, `game.ts`, `config.ts`, `core/`, `shared/`, `features/`, `plugins/`.
  - Status reads `features/` and `plugins/` as what was built. No rule is added.
- **Playtest Step 2 failed on a Mac.** Plain `bunx moku-game visual` starts the pixel leg and exits 1
  without `playwright-core`, which the template does not install. The step passes `--no-pixels` for the
  proof and `--pixels` only when the peer is installed.
- **The tweak tier called a game's root wiring a quick edit.** `moku-rails tier index.ts game.ts` answered
  `fast` in a game.
  - With `type: game` in `.planning/moku.md` the tier is `deep` for `index.ts`, `game.ts` and `config.ts`,
    for the `index.ts` of a layer or a feature, for the public surface of the game's own plugins, and for
    `core/state.ts` and `core/kit.ts`.
  - Any other project type answers as before. A root `index.ts` or `plugins/` folder there means nothing.
- **Check and upgrade treated a game as below the target stack.** A game pins TypeScript 6.0.3, because
  the editor's project index needs the TypeScript JS API, and it has no `tsdown`.
  - `target-stack.md` and check carry the game exception on these two pins.
  - Upgrade detects a Game project. The native and system version bumps apply to a game too.
- **The CLAUDE.md of a game described a package.** `hello-world.md` has a game variant with the game's
  scripts, TypeScript 6 and the layered layout. The scaffold table points at it.

### Added
- **A release path for a game.** `moku-release` has a section "A game". The web target replaces the
  template's placeholder `deploy` with an upload of `dist/web`. The store target runs
  `bun run native build ios` or `android`. It says what is done by hand: signing in the generated Tauri
  project, the Play bundle, the upload and the web deploy command. The conductor's release line names
  the game.

### Changed
- **The game template pins editor 0.9.3, common 0.3.5 and system 0.3.2.** They were 0.9.1, 0.3.4 and
  0.3.1. A fresh scaffold written from `hello-world.md` is green on the new set: install, `keys`,
  typecheck, lint, tests, `test:visual` twice and `build`. The editor server of 0.9.3 was not started.
  game 0.13.0, ai 0.16.1 and native 0.3.3 are still the latest.
- `editor.md` describes `moku-editor e2e` as of 0.9.2: one run per project and spec file, with
  `.moku/e2e.lock`.
- `docs/SKILL-INVENTORY.md`: the hook facts after 0.82.0. 21 scripts, 15 of them wired to 10 events.

## 0.82.0 (2026-10-09)

### Added
- **Test runs are seen.** Every test run in a moku session goes to `.planning/tests/runs.jsonl`: the
  command, whether it was the whole test script, the tree, the duration, the outcome and who ran it
  (an agent, the rails, the commit hook). A new Bash hook, `on-test-run.mjs`, records the runs agents
  start. `moku-rails check tests` records its own and keeps its whole output in `.planning/tests/last.log`.
- **`moku-rails tests`.** Prints the runs, the runs that repeated a result on an unchanged tree and the
  seconds they cost, what the project's commit hook runs, and the slow tests. `--json` gives the numbers.
- **Advice on a repeat.** An agent that starts a test command which already ran on the same files is told
  so. It is advice, never a refusal, and a changed tree is never commented on.
- **The commit hook counts.** A commit through a pre-commit hook that runs the whole test script
  (lefthook, husky, simple-git-hooks) is recorded as the green run of the new HEAD, so
  `moku-rails check tests` answers `not run again`. A hook that runs a part of the script, runs for some
  commits only, was skipped, or left no passed test job in the output proves nothing.
- **Slow tests.** Timings are read from Vitest, `bun test` and `node --test`. Tests at or over
  `slowTestMs` (1000 ms, set in `.claude/moku.local.md`) are listed, and `moku-rails close` prints them
  as an offer for the person. No test is changed without a yes.
- **One test-run policy.** `skills/moku-testing/references/test-runs.md`: one run per tree, the output
  kept in a file, the plugin's tests while building, the whole script once per wave and at the close,
  no whole run beside a commit whose hook runs it. Builders, validators, verify, build, check, e2e and
  playtest point at it.

  Measured on 84 past sessions before the change: 5177 test runs, 28% of them repeated a run with no
  edit between, about 3.8 h of 15.7 h test time. 801 of the 804 repeats of a green run differed only in
  the output filter.

### Changed
- `moku-rails status` adds a `Tests:` line when runs were repeated in the last day or tests are slow.
- The build delta pass no longer runs the suite after the coverage run on an unchanged tree. The
  regression step is skipped on a tree the whole script passed on. `check plugin <name>` runs that
  plugin's tests only.

### Unchanged
- `moku-rails close` still refuses without a green `tests` on the current tree. A test run from a shell
  never confirms it.

## 0.81.5 (2026-10-09)

### Fixed
- **The write gate did not see the source of a game.** The gate covered paths under `src/` only, and a game
  has no `src/`. In a game `moku-rails guard features/hello/flow/new.ts` answered `allow` with no change open.
  - The gate now reads the project type from `.planning/moku.md`. When it says `type: game`, the gate also
    covers `index.ts`, `game.ts`, `config.ts` and the folders `core/`, `shared/`, `features/` and `plugins/`
    at the project root. The same rules apply as for `src/`: no source before init, and none without an
    open change at a writing station.
  - Shell writes are judged by the same roots: `cat > core/state.ts` is refused where a Write would be.
  - Not gated in a game: `generated/`, `tests/`, `.moku/`, the tooling files, and art in an `assets/`
    folder of a layer. A `.ts` or `.tsx` file in an `assets/` folder is still source.
  - Any other project type behaves as before. A root `plugins/` or `features/` folder there is not gated.
  - Before init the marker does not exist, so the type is unknown and only `src/` is gated, as before.
- **Plan and build had no game branch.** The conductor sent a game through "plan, build, verify as for any
  app". The app path builds `src/plugins/{name}/` and writes `src/main.ts` with `createApp`. The game
  validator calls a `createApp` in a game a BLOCKER, and `moku-verify-artifacts` fails on a game.
  - `build-app.md` opens with a "Game" section. The unit of work is one feature folder, `features/<f>/`.
    The check after a wave is `bun run keys --check && bun run typecheck && bun run lint && bun run test &&
    bun run test:visual`. Step 4 and `moku-verify-artifacts` do not apply to a game.
  - The plan skill states the exception next to the structure rule: one spec per feature, no `src/`, no
    `createApp`.
  - The conductor, the build skill and the builder agent send a game to that section.
  - The layout and the API stay in the `moku-game` skill. The core pack points at it and says to install
    the `moku-game` pack when it is missing.

## 0.81.4 (2026-10-09)

### Changed
- **The vendored Moku Core spec is pinned to `df76939`, `main` at `v1.7.1`.** It was `d95c279`.
  - One file changed: `spec/14-EVENT-REGISTRATION.md` gains row 8 in §10. Annotate `register` when `api`
    is a pre-typed factory, or wrap the factory: `api: ctx => createApi(ctx)`. Without it TypeScript checks
    `api` first, with an empty own-event map.
  - No heading changed, so `spec-index.md` moves only its pin and date.
  - No vendored sandbox file changed upstream. Two keep their local comments from 0.79.0.
    Upstream has one new sandbox test, `pretyped-factory-events.test.ts`. It is not vendored.
- **Six framework packs are synced to the latest releases.** None of them changes an API, an event, a
  config field or a plugin. The peer ranges stay `@moku-labs/core ^1.7.1` and `@moku-labs/common ^0.3.4`.

  | Framework | Was | Now | What moved upstream |
  |---|---|---|---|
  | `@moku-labs/web` | 2.4.4 | 2.4.5 | Docs, and one internal type in `content` for TypeScript 7 |
  | `@moku-labs/worker` | 0.20.3 | 0.20.4 | CI only |
  | `@moku-labs/room` | 0.8.3 | 0.8.4 | Docs |
  | `@moku-labs/common` | 0.3.4 | 0.3.5 | CI only |
  | `@moku-labs/system` | 0.3.1 | 0.3.2 | Docs |
  | `@moku-labs/editor` | 0.9.1 | 0.9.3 | `moku-editor e2e`, the series shot count |

  - **web.** The upstream `llms.txt`, `llms-full.txt` and README now name core and common as peers and list
    the `collection` provider. The collection README imports `collectionPlugin` from the root entry. The
    index no longer warns about either.
  - **room.** The upstream docs now say core and common are peers. The index drops its warning.
  - **system.** The upstream `llms-full.txt` now matches the source on `TrayConfig.icon` and on the
    deep-link launch handover. The stale-docs table in the index goes from six rows to three.
  - **editor 0.9.2.** `moku-editor e2e` runs one Playwright process per project and spec file. It prints one
    line per run and a summary. A run holds `.moku/e2e.lock`, so a second run exits 1.
  - **editor 0.9.3.** A series takes its planned count of shots. It stops early only at `durationMs + 3 s`,
    or on Stop.
  - **Registry.** `knownVersion` of the six rows, the "currently" lines of the upgrade migrations, and a
    2026-10-09 sync note.
  - core 1.7.1, native 0.3.3, game 0.13.0 and ai 0.16.1 did not move.
- **The game template keeps its install pins.** `hello-world.md` and the files that repeat its pins still
  name editor 0.9.1, common 0.3.4 and system 0.3.1: the pair the template was run on. The new versions were
  not run on a scaffold.

### Fixed
- **`README.md` showed version 0.80.1 in its badge.** It shows 0.81.4.
- **`docs/SKILL-INVENTORY.md` was behind.** It said nine plugins and left out `moku-game`, `moku-ai` and the
  `session` skill. It now lists eleven plugins, 19 core skills and 14 core agents. The sync versions are
  current: worker 0.20.4 with 10 plugins, room 0.8.4, native 0.3.3, system 0.3.2 with 9 capabilities, common
  0.3.5.

## 0.81.3 (2026-10-08)

### Changed
- **The game guidance is synced to `@moku-labs/game` 0.13.0 and `@moku-labs/native` 0.3.3.** The editor stays
  0.9.0. Its peer range `@moku-labs/game >=0.10.0` takes 0.13.0.
  - **The dev manifest lives in `generated/manifest.json`.** `moku-game keys` writes it there, not at the game
    root. `moku-game dev` serves it on `/manifest.json`, so the page still fetches `manifest.json` next to
    itself. The project index reads it by default. The build output is unchanged: `dist/assets/manifest.json`.
  - **Every place that named the root `manifest.json` now says `generated/manifest.json`.** The moku-game
    skill, `hello-world.md` (the layout tree, the keys rows, the biome note, the run block), `plugin-index.md`
    (a 0.13.0 row, the `visual` stop line, the index default), the validator check and its report line,
    playtest, init's `scaffold.md` and moku-ai `game-assets.md`.
  - **The validator warns on a root `manifest.json`** in a game on 0.13 or later. `dev` no longer serves it.
  - **Pins and sync lines.** game `0.12.0` → `0.13.0`, native `0.3.2` → `0.3.3`, in the packs, the
    `knownVersion` rows and the upgrade migrations. The native pack notes the 0.3.3 fix: `doctor`
    `web-script` checks only a package script, not the direct `bun` + `moku-game` command.
  - The hello world was scaffolded fresh and run on game 0.13.0 with editor 0.9.1: `keys` writes
    `generated/manifest.json`, then typecheck, lint, test, `test:visual`, `moku-game-index --check` and
    build pass. `moku-game dev` answers 200 on `/` and `/manifest.json`. `moku-editor --root .` answers 200
    on `/__editor/` and, since 0.9.1, `/manifest.json` from `generated/`; it logs `files:project-on`, and the index names `generated/manifest.json`.

## 0.81.2 (2026-10-08)

### Fixed
- **Every planning file written in a git worktree asked the person for permission.** Since 0.81.0 a worktree's
  `.planning` is a link to its lane folder in the main checkout. Claude Code follows the link, sees a path
  outside the worktree and asks: "resolves through a symlink to …, which is outside the allowed working
  directories". One question per brainstorm, context, spec and state file.
  - **The write hook approves it.** `pre-write.mjs` answers `permissionDecision: "allow"` for a file under
    `.planning/` when that `.planning` is the lane link: into the `.planning/` of a checkout on the rails, or
    into `.planning/lanes/<name>/` of it.
  - **Only after every check.** The rails guard and the content checks run first. A refused write is still
    refused, with exit 2 and no approval.
  - **Nothing else is approved.** Not a file outside `.planning/`, not a checkout with a real `.planning/`
    folder, not a `.planning` link that leads anywhere else.
  - Checked on Claude Code 2.1.280 in a real worktree: with the hook as in 0.81.1 the write is denied in
    `claude -p`, with this hook it is written with no question.

Rails and hooks: 214 tests pass, 5 of them new.

## 0.81.1 (2026-10-08)

### Fixed
- **`moku-rails check tests` ran the test script for every change.** `close` needs the `tests` item per
  change, and nothing remembered where the tests were already green. Closing 24 built changes on one
  unchanged tree of an app with 8421 tests started 24 full runs, about 26 minutes of CPU.
  - **One green run per tree.** A tree is its HEAD commit with nothing uncommitted. After a green run the
    ledger keeps that commit in `testsGreenAt`. A check on the same tree confirms the item without a run and
    says so: `Checklist "tests" confirmed for <id> (green on <short sha>, not run again).`
  - **Anything else runs the script.** A new commit, an edited tracked file, an untracked file that git does
    not ignore, a directory without git. `.planning/` and `.claude/worktrees/` do not count as edits: the
    rails write the first on every command, and the second holds other checkouts.
  - **A red run clears the commit.** Nothing is stored, and the next check runs again.
  - **Each worktree keeps its own commit**, in `testsGreenAtIn`, beside the per-lane `turns`.
  - No flag skips the tests and nothing forces a close.
- **Conductor skill.** "Close every change the same way" now says: commit first, then check and close the
  changes one after another, and never start one run per change on a tree that did not change.

Rails and hooks: 209 tests pass, 8 of them new.

## 0.81.0 (2026-10-08)

Four things. Git worktrees of one project no longer stop each other. A new quick route makes small edits
at once and checks them one time at the end. The game guidance is synced to `@moku-labs/game` 0.12 and
`@moku-labs/editor` 0.9, plugin tables included, and moku-ai to `@moku-labs/ai` 0.16.1. A question in a
directory that is not on the rails is answered again, instead of being turned into a new project.

Rails and hooks: 201 tests pass, 38 of them new. Evals on Opus 5.5 with the plugin, all 21 cases of the core and the packs: 59 of 63 runs on the last full
pass. Before the fixes below the same suite stood at 44 of 60. The four runs that failed: `waves-next-wave`
three times: the answers were right, read from the plan by eye, and its grader demanded a command call.
The next wave now comes with the rails status of every turn, the grader was dropped, and the case then
passed 3 of 3. `design-api-mode` once on a split
judge vote over a correct answer; it passed 3 of 3 on the next run.
Worktrees were also tried live: one project, three Claude Code sessions at the same time. The main checkout
took quick edits and left `tweak` open, and two git worktrees each fixed a bug in another plugin. Every
session opened its own change in its own lane, no session met a refusal, and the tests passed in all three
checkouts.

The game sync was verified on a fresh scaffold: install, `keys`, typecheck, lint with the ten engine rules,
tests at 100% coverage, `build`, `moku-game dev`, `moku-editor --root .` with the project index on,
`moku-game-index --check`, the headless leg of `moku-game visual`, and the lefthook pre-commit. Not run: the
pixel leg, `moku-game native`, `moku-editor mcp` and `e2e`.

### Fixed
- **Worktrees stalled each other.** Every worktree had a link to the one `.planning/`, so all sessions
  shared one rails state and one `STATE.md`. A change inside a station in one worktree refused `open` in
  another. A new message in one worktree closed the write gate of the others ("has not been routed yet").
  A wave marked active in one `STATE.md` stopped the commit and the turn everywhere. A change at `build` in
  one worktree opened source writes in all of them.
  - **Each worktree is a lane.** A change records the worktree it was opened in. A checkout sees its own
    changes, its own last request and its own running agents. `status` lists the rest under "Elsewhere".
  - **Each worktree has its own working folder.** `.planning` of a worktree now points at
    `.planning/lanes/<worktree>/` in the main checkout. Shared by link: `state.json`, `moku.md`,
    `decisions.md`, `steering.md`, `memory.md`, `learnings.md`, `app-spec.md`, `specs/`, `design/`,
    `memory/`. One per lane: `STATE.md`, `build/`, `changes/`, brainstorm and context files, `e2e/`,
    `agents/`. A worktree with the old link is moved to a lane on its next session start.
  - **Saves no longer overwrite each other.** A save merges this lane into the file under a lock, every
    editing command runs as one locked edit, and the ledger is written to the real file, never over a link.
  - **`moku-rails adopt <id>`** moves a change into the current checkout, for a worktree that was removed.
- **A question was turned into a project.** In a directory that is not on the rails, the prompt reminder
  sent every message that names moku to `moku:session`. "Show me an island" or "how do I set up CI" in an
  empty directory started a session and asked where the project is. The reminder now says: a question, a
  "how do I" and a request for an example are answered from the skill that owns the topic, and a session
  starts only when the person asks for the work to be done here. `web-island-attrs` went from 0 of 3 to 3
  of 3.
- **Evals.** Without a `moku-rails` on `PATH` the conductor cases stalled on "command not found", and the
  pack command allowed no `Write` or `Edit`: the README and `npm run evals` put the repository's own `bin`
  first and name the full tool list. Three graders were stale. `game-hello-world` failed an answer that
  pins `@moku-labs/core`, a peer since 0.78.0. `thin-root` accepted only a knowledge skill and failed on
  `main` since the session gate. `design-api-mode` and `e2e-ux-gate-fallback` demanded a `Skill` call for
  prompts that ask how a station would run; they now check that the answer comes from the skill.
- **`fx/` folders need game 0.12.** 0.80.1 told every game to move `fx-*` files into `fx/`. Before 0.12 only
  an `fx-` stem reached the `fx` atlas group. moku-ai `game-assets.md` and game-validator §7 say so.
- **Lint rule versions.** `static-keys` ships since game 0.7 and the three layout rules since 0.9, not 0.11.

### Added
- **Size Q, the quick route:** `intake → tweak → verify → close`. For a run of small edits the person
  steers one by one. Inside `tweak` a new message needs no routing and the turn may end after each edit.
  No plan, no validator and no test run in between: `verify` runs once, when the person says the edits
  are right, and the change still closes only with tests, verify and docs confirmed.
  - **`moku:tweak`** (sonnet, low): the station skill. One line back per edit, a row in `tweaks.md`.
  - **`moku-rails tier <files>`** says who makes the edit, counted from the files: `fast` for one or two
    existing files that are nobody's public surface, `deep` for a third file, a new file, a plugin's
    `index.ts`/`types.ts`/`api.ts`/`state.ts`/`events.ts`, root wiring, `src/core/`, configuration, or an
    edit the fast agent missed twice (`--misses 2`).
  - **`moku-tweaker`** (sonnet, low, 40 turns): the fast agent. It reports `ESCALATE` for anything larger.
  - Eval `tweak-quick-edits`, with a fixture project.
- **`moku-rails waves`.** Reads the plan's `## Plugins` table and wave table from `STATE.md`, prints the
  waves and names the next one with its plugins, tiers and specs. It refuses a plan where a plugin sits in
  two waves or depends on a plugin of the same or a later wave. `--done <n>` marks a wave and its plugins
  `verified`. `moku-rails status`, which every turn starts with, names the next wave and says when its
  plugins may be built in parallel.
- **The build workflow builds the whole plan.** `moku-build-wave` takes the next wave from `moku-rails
  waves`, where an agent used to pick it by reading `STATE.md`. With `{all: true}` it builds every
  remaining wave: plugins of a wave in parallel, each verified as it finishes, the wave marked `verified`,
  then the next. It stops at the first wave that fails, at a disposition other than `continue`, and at a
  framework wave. Not run on a real project yet.
- **What goes where.** moku-game skill: one table from "a field of the save" to "a prepared save", and the
  list of files a game never writes. "From zero to a running game": eight steps, `bun run keys` before the
  first typecheck.
- **`moku-game visual` (game 0.12).** The bin runs `tests/visual/index.ts` against
  `tests/visual/baselines/`; a game writes no runner. playtest Step 2 uses it and needs no dev server.
- **The hello-world template has a visual test.** `tests/visual/index.ts`, `tests/visual/home.visual.ts`
  (Home at rest, then one tap), the script `"test:visual": "moku-game visual --no-pixels"` and a `visual`
  job in `lefthook.yml`. Init runs it twice and commits `tests/visual/baselines/`. `bun run test:visual
  --pixels` adds the pixel leg. The init checklist, structural conformance and game-validator §11 expect
  the folder, the script and the committed baselines. Verified on a second fresh scaffold: install,
  `keys`, typecheck, lint, tests at 100% coverage, `test:visual` twice (written, then same), `build`,
  lefthook pre-commit with the `visual` job.
- **moku-ai: the Ark asset library and the draft record (ai 0.15, 0.16).** `app.ark.listAssetGroups`,
  `listAssets`, `deleteAsset`, `deleteAssetGroup`, `app.ark.draftRecord(hash)`, `app.fal.upload(file)`,
  `groupName` on an `asset` item, `params.omni_reference_task_type` and `seconds: -1` for an Ark edit.
- **Hot swap and the project index.** Which files swap, which reload, which are refused. The bin
  `moku-game-index` and its keys (`node:`, `flow:`, `jsx:` ...).
- **`moku-editor e2e` (editor 0.9).** One Playwright run per project, each on its own `PORT`.
- **game-validator §11.** On game 0.12 and later: WARNING for no `tests/visual/index.ts`, for a
  `*.visual.ts` the index does not list, for baselines that are not in git, and for no `test:visual`
  script. INFO for a runner of the game's own.

### Changed
- **`plugin-index.md` is regenerated.** The engine half moves from 0.4.6 to 0.12.0: `projection.replace`,
  `anim.replace`, `i18n.replace`, `text.replaceStyles`, `scenes.expect`, the `AnimPlayer` resource,
  `messageArgument`, `messageDuration`, the global event `ui:hot-swap`, the entries `/hot`, `/project`,
  `/visual`, every `moku-game` flag. The editor half moves from 0.2.1 to 0.9.0: the bin, 17 plugins with
  their APIs, config, events, the MCP tools, the project index.
- **Pins.** The template, the skill, editor.md and playtest name game 0.12.0 and editor 0.9.0.
- **Registry.** `knownVersion` of game 0.4.4 → 0.12.0 and of editor 0.2.1 → 0.9.0, with every crossing on
  the way. `moku-game-version` and `moku-editor-version` name the 0.8 and 0.12 steps.
- **editor.md.** Captures are JPEG in `.moku/captures/<yyyy-mm-dd>/`; an area drag writes `area-f<frame>.md`;
  the Hot reload switch restarts the server; MCP tool names.
- **init, scaffold, structural conformance, build-app.** The game row names `tests/visual/` and the ignored
  output; init checks `files:project-on`; the game validator scope is the shell layout.
- **moku-ai is synced to `@moku-labs/ai` 0.16.1** (was 0.14.2): the skill, `plugin-index.md`,
  `providers.md`, `setup.md`, `game-assets.md`, the registry `knownVersion` and `moku-ai-version`. Only
  `ark`, `fal` and `asset` changed upstream; no task, event or CLI flag. A final from a draft is priced by
  its draft, and without `ark.groupId` a process reuses the asset group of that name. The names were
  typechecked against the published package, and `moku validate` and `moku estimate` ran on an Ark edit
  item and an asset item with `groupName`. No provider was called.
- **A station left open in `tweak` is not a debt.** It does not block the turn's end or another `open`, and
  `status` reports it as waiting for the next edit. The live test showed it as a stuck station.

## 0.80.1 (2026-10-07)

### Added
- **Asset folders by kind.** moku-ai `game-assets.md` §Folder layout: a folder of more than about 8 files
  groups into `fonts/`, `buttons/`, `panels/`, `icons/`, `fx/<animation>/`, `decor/`, `sounds/`, `music/`,
  `items/`, `backgrounds/`. The file drops the kind prefix: `icons/coin.webp` is `ui.icons.coin`. Animation
  frames share one folder: `fx/coin-spin/0.webp`. Three files or fewer stay flat. A moved `.fnt` gets its
  page line fixed; a moved body font is named in `text.fonts.body`. `bun run keys` and the typecheck find
  every stale key. One before/after tree of a merge game's shared layer.
- **game-validator §7.** WARNING when an `assets/` folder holds more than about 12 files flat, or its files
  share a kind prefix (`icon-`, `button-`, `fx-`).

### Changed
- **Shell paths in the asset examples.** `features/ui/assets/…` becomes `shared/assets/…` in `game-assets.md`,
  the moku-ai skill and `providers.md`; `ui` is a plugin name, so no feature is called `ui`. Examples use the
  folder form: `buttons/green{nine=12,12,12,12}`, `sounds/click`.
- **moku-game skill and hello-world** point to the rule. The template's three files in `shared/assets/` stay flat.

## 0.80.0 (2026-10-07)

The game template and the game guidance move onto the game shell of `@moku-labs/game` 0.11 and
`@moku-labs/editor` 0.8. A game is a folder: `index.ts` (`defineGameApp`), `config.ts` (plain data) and
what the bin `moku-game` writes into `.moku/`. Verified on a fresh scaffold: install, `keys`, typecheck,
lint with the ten engine rules, tests at 100% coverage, `build`, `moku-game dev`, `moku-editor --root .`
with the project index on, and the lefthook pre-commit.

### Changed
- **The hello-world template is a shell game.** `index.ts`, `config.ts`, `game.ts` (the root flow only),
  `core/{state,kit}.ts`, `shared/` (the body font, scanned as the layer `ui`), `features/hello/`,
  `tests/scenarios/ready.ts`, `tests/integration/hello.test.ts`. Scripts call `moku-game dev|build|keys|pack|native`
  and `moku-editor --root .`. Gone: `web/`, `createGame`, the hand-written dev server and build. Exact pins:
  game 0.11.0, editor 0.8.0, pixi.js 8.22.0, core 1.7.1, common 0.3.4, sharp 0.34.5. tsconfig and vitest
  carry the layer aliases; `.oxlintrc.json` turns on all ten `moku-game/*` rules.
- **A game pins TypeScript 6.0.3 and writes no `bunfig.toml`.** The editor's project index needs the
  TypeScript JS API; on 7.0.2 it logs `files:project-off`. The shell names no `bunfig.toml` in a game, so
  it pins with `bun add --exact`.
- **moku-game skill.** The layout, `defineGameApp` shape, `config.ts`, the `moku-game` commands, the ten
  lint rules, the editor start without HTML, and the native and system shell from `config.ts`.
  `plugin-index.md` gains the shell entries and `PlatformApi.exit()`; its plugin tables keep the 0.4.6 sync.
- **editor.md, device.md, playtest.** `bun run editor`, `?player=<scenario>`, `moku-editor mcp`;
  `bun run native build ios --simulator` over `config.ts` instead of `native.ts` and `platform-bridge.ts`.
- **game-validator.** Lint-first knows the ten rules. New §11 checks the shell: `index.ts` and `config.ts`,
  no `createApp` or `flow.run()` in the game, no shell-owned `pluginConfigs` key, no old-shape files.
- **init, scaffold, structural conformance, tooling, migrations.** The game branch follows the shell;
  native and system skills say a game names them in `config.ts`; moku-ai's game asset route runs
  `moku-game keys`.

## 0.79.0 (2026-10-05)

The soft move from ESLint to oxlint, in four PRs. New projects get Biome + oxlint on TypeScript 7. Old projects
keep ESLint on TypeScript 6 until the owner says yes. Measured on copies of game and web: `bun run lint` on game
drops from 24.8 s to about 3 s, `tsc --noEmit` from 4.2 s to 0.54 s.

### Added
- **Two lint stacks (#58).** `lint-stacks.md` says how to tell them apart: `.oxlintrc.json` is the current stack,
  `eslint.config.*` is the legacy one. Builders, the build wave, verification, the diagnostician, the validators
  and `check` run the project's own second linter. A legacy project is not a finding.
- **Opt-in migration `moku-lint-oxlint` (Stack 4).** `/moku:upgrade` offers it in one line and never applies it
  by default. It swaps the devDependencies, writes `.oxlintrc.json` and keeps the project's own rules, adds the
  Biome complexity rule, rewrites scripts and lefthook, deletes `eslint.config.*`, renames disable comments
  (`jsdoc/` → `jsdoc-js/`, `unicorn/prevent-abbreviations` → `unicorn-js/...`), drops dead sonarjs comments and
  moves TypeScript 6 → 7 with tsdown 0.23.0. Proved on a copy of web: lint, typecheck, 1000 tests, build,
  publint and pre-commit pass. Findings with all disable comments off: 146 before, 121 after. The 23 sonarjs
  findings go on purpose; jsdoc is equal; unicorn differs by 2 (native `consistent-function-scoping`).

### Changed
- **The current stack is the default (#59).** `tooling-config.md`: oxlint 1.86.0 with `eslint-plugin-jsdoc`
  65.1.0 and `eslint-plugin-unicorn` 63.0.0 as JS plugins, TypeScript 7.0.2, tsdown 0.23.0 (declarations through
  the TS 7 binary). Biome `noExcessiveCognitiveComplexity` (max 15) replaces sonarjs. ESLint, typescript-eslint,
  sonarjs, eslint-config-biome, jiti and globals leave the current stack. The ESLint bodies stay in a legacy
  section. Why: typescript-eslint needs the TypeScript JS API, and TS 7 has none.
- **Docs speak about both stacks.** moku-core, moku-release, glossary, skeleton conventions, jsdoc examples, plan
  and skeleton stages, moku-plugin, moku-readable-code, the moku-web project spec and e2e notes, and moku-game
  wording no longer present ESLint as the default. Legacy instructions stay where they help an old project.
- `tsgo-fastcheck` is offered on the legacy stack only. `ts6-core` fires on the legacy stack only.

### Removed
- Reserved `ts7-native`. TypeScript 7 arrives through `moku-lint-oxlint`.

## 0.78.3 (2026-10-05)

### Fixed
- **A game lints its own code.** The tooling ESLint blocks aimed at `src/**`, which a game does not have, so only
  tests and configs were linted. The game template has its own `eslint.config.ts` over the root files and
  `{nodes,flows,rules,features,web}`, with the engine rules a game must keep: no static Pixi or native import,
  editor and `game/control` in dev files only (L2, L13), no module-scope state (L5), determinism in logic (L3),
  a rule imports only its siblings (L4). `generated/` is ignored. `tsconfig.json` includes `rules/`.
- **Apps commit through a hook they can run.** The tooling `lefthook.yml` ran `validate`, `test:unit` and
  `test:integration`, which an app does not have. Apps now take an app variant (build, biome, eslint, typecheck,
  test), and init names the app scripts: `lint`, `typecheck`, `test`, `test:coverage`, `build`, `deploy`.

### Changed
- `@moku-labs/game` 0.4.4: the `game.mute` door, so the editor's Sound switch works (it reports
  "needs audioPlugin" in a game without audio).

## 0.78.2 (2026-10-05)

The game route, tested end to end: evals and a live `claude -p` run from an empty folder to a running hello world.

### Fixed
- **init shows the game without a browser pane.** Step 5.5 falls back to a Playwright MCP browser, then
  `bunx playwright screenshot`, then the person's own look at the url. It no longer stops on a browser permission.
- **The scaffold is the first commit.** init Step 6.5 commits it, with the lefthook pre-commit. Before, the rails
  saw every file as uncommitted work and refused to open the first change.
- **A new game passes CI and its own pre-commit.** The CI from `@moku-labs/ci` runs `lint`, `typecheck`,
  `test:coverage`, `build` and, on `main`, `deploy`. The game template now has all five (`deploy` is a placeholder
  until the release station picks a target), its own `vitest.config.ts` (coverage counts the logic), `biome.json`
  scope, `lefthook.yml`, and installs the tooling pins instead of `typescript@latest` (TS 7 has no JS API for ESLint).
- **moku-game shows how to draw a sprite:** the tags list and `<image texture="feature.key" fit="contain" />`.
- **moku-ai fires on Russian asks:** спрайты, звуки, музыка для игры, озвучка, ассеты для игры.

### Added
- Evals `moku-game/game-new-route` (start with `/moku:session` and a game) and `moku-game/game-asset-route`.

## 0.78.1 (2026-10-05)

### Changed
- **MC3 knows `build.env`.** A name listed in `@moku-labs/web` 2.4+ `build.env` is a bundle-time constant, not a
  runtime read, so client code may use it. `import.meta.env.NAME` is preferred; a `process.env.NAME` line in a
  file the hook scans carries `// @env-allow`. An unlisted name is still MC3: in the browser it is `undefined`.
  Shared exception #5 in `moku-common-conventions`.

## 0.78.0 (2026-10-04)

Every framework pack is synced to what npm ships today. The family moved `@moku-labs/core` and
`@moku-labs/common` to peer dependencies on the same day, and the editor caught up with game 0.4.

### Changed
- **Packs synced** from the released tags: web 2.4.4, worker 0.20.3, room 0.8.3, common 0.3.4, native 0.3.2,
  system 0.3.1, game 0.4.3, editor 0.2.1, ai 0.14.2. Registry `knownVersion` and migration detect lines follow.
- **core and common are peers** in every family package (`^1.7.1` / `^0.3.4`). Bun and npm install them, so an
  app still declares neither. The registry records the ordering: core 1.7.1 first.
- **moku-game on editor 0.2.1.** The editor 0.0.2 workarounds are gone: the picker, `editor.capture`, series and
  the Shot button work, opt-in sources show as not installed, Reference mode and the pick card are in, and the
  hello world loads the editor agent through a dev-only dynamic import, so a production build carries none of it
  (checked with a grep of `dist/`). Hot reload keeps the game state. The hidden-pane pause is documented as
  expected, not a finding. The validator asks for the dynamic import.
- **moku-ai:** `pluginConfigs.limits` is typed, the cast notes are gone.
- **moku-native:** `app.orientation`, `app.backgroundColor`, capabilities `back` and `haptics`.
- **moku-system:** `lifecyclePlugin`, `backPlugin`, `hapticsPlugin`, `keepAwakePlugin`.
- **moku-web:** `build.env`, `navigate({ replace })`.

## 0.77.0 (2026-10-04)

A new project type, `game`, and two packs. A person who says "I want to make a game" gets a confirmed
folder, a hello world that installs, builds and opens in the editor in the browser pane, and then the usual
rails: brainstorm, design, plan, build, verify, playtest.

### Added
- **`type: game`** in `.planning/moku.md`. Session confirms the folder, init scaffolds from the `moku-game`
  pack and shows the running game (Step 5.5) before it writes the marker. The conductor, `check`,
  `verify`, `build-app`, the design medium, web e2e and the SessionStart hook branch on it.
- **`moku-game` pack** for `@moku-labs/game` 0.4.2 and `@moku-labs/editor` 0.0.2: the engine skill, a
  hello world proven end to end, the editor as the shared screen (captures, PNG series to mp4, `@moku`
  reference lines), the device loop through `moku-native`, the `playtest` station that replaces web e2e
  for a game, and `moku-game-validator`.
- **`moku-ai` pack** for `@moku-labs/ai` 0.14.1: keys in `.env.local` pasted by the person, providers and
  custom ones through `moku.config.ts`, `sprite` and `sfx` tasks, estimate and a yes before any paid run,
  `--flat` export straight into a game feature.
- **Registry rows** `game`, `editor`, `ai`, their upgrade migrations, and `moku-sync` notes for a shared
  pack and for packages that release several times a day.
- **Evals** `moku-game/game-hello-world` and `moku-ai/ai-estimate-first`.

### Changed
- Core `knownVersion` 1.7.1: `createApp` `pluginConfigs` accepts core-plugin keys (moku-labs/core#29).

### Known
- Editor 0.0.2 against game 0.4.x: the element picker and `editor.capture` fail, and opt-in sources are
  logged as failures. The packs carry the workarounds until the editor ships a fix.

## 0.76.1 (2026-09-26)

The Agent hook reads the response the harness really passes. Seen on every background spawn in a real
project session on 0.76.0 (Claude Code 2.1.280, Agent tool in the background by default): the orchestrator
was told to resume an agent that had not run yet.

### Fixed
- **A background launch is not a missing report.** The harness passes the Agent response as an object
  (`status: "async_launched"`, `agentId`, `outputFile`), not as launch text, and the hook never read
  `run_in_background` from the input. `on-agent-result.mjs` now stays silent on any of these, and on the
  launch text.
- **A report sent through the hand-back is not a missing report.** A finished call with
  `handback: "send"` returns only a pointer to the report. The hand-back itself reaches the prompt hook,
  which checks it as before.
- **A contract in a finished call is found.** The hook read the whole response object as JSON text. The
  escaped newlines hid the fenced contract, and the orchestrator's `prompt` was read as the agent's words.
  It now reads only the text blocks of `content`.

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
