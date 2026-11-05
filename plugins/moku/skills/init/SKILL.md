---
name: init
description: Scaffolds a new Moku project — tooling, directory skeleton, release plumbing and the .planning/moku.md marker the lifecycle rails read — or adopts an existing one (a fresh clone) by writing only the marker. Use once per checkout, before any change is opened, when the user asks to start, set up or initialize a Moku framework, app or library, or when the rails call an existing Moku project not initialized.
when_to_use: Starting a new Moku project, bringing Moku tooling into a directory that has none, or adopting an existing Moku project that has no `.planning/moku.md` (a fresh clone). Not for changing an already-initialized project.
argument-hint: natural language, or [project-path]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Skill, AskUserQuestion
model: fable
effort: medium
---

# init — the project-level station

`init` runs once per project. It is not on a change's route: it stands before every station, and it
is what makes the rails usable at all. Its last act is writing `.planning/moku.md`, the marker
`moku-rails` reads to answer "is this project initialized?". Writing it last means a half-finished
init never looks finished.

## Rails first and last

```bash
moku-rails init begin     # opens the window in which this skill may write src/ before the project counts as initialized
```

The write gate refuses source files in an uninitialized project. `init begin` is the one exception,
and it exists only for this skill. After the marker is written (the last step below):

```bash
moku-rails init done      # refused until .planning/moku.md exists, so a half-finished init never counts
```

If init is interrupted, `moku-rails status` reports it as a debt and the conductor resumes here.

## Moku Core specification

Before any decision about architecture, the core API, the factory chain, config, lifecycle, events,
`ctx`, types, invariants or plugin structure, read
`${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/spec-index.md` and open the `spec/NN-*.md` file it
cites. The spec decides; memory does not. Cite the section id in your output. `.planning/` is
local-only state and is never staged or committed.

## Input

`$ARGUMENTS` may be plain language. Resolve it per
`${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/nl-args.md`: the only argument is a target path,
defaulting to the current directory. Echo one line, `Interpreting as: …`, when you interpreted
something. Ask only for a value you are missing.

## Adopt or scaffold — decide first

`.planning/` is local state and gitignored, so the marker never travels with the repository. A fresh
clone of a Moku project is "not initialized" although everything but the marker is there, and the
scaffold would overwrite its `package.json`, `biome.json` and `tsconfig.json`. So before anything else:

```bash
moku-rails init adopt --dry-run --root "$ABSOLUTE_PROJECT_PATH"
```

It exits 2 when the directory holds no Moku project (no `package.json` naming `@moku-labs/*`, no
`createApp`, `createCoreConfig` or `defineGameApp` in the sources): then scaffold, Step 0 on. Otherwise
it prints what it detected, and the project is **adopted**: follow "The adopt path" below and skip
Steps 0–6.5. `moku-rails status` names the same case ("Existing moku project … adopt it").

## The adopt path

The adopt path writes nothing outside `.planning/`. It never runs `bun init`, never writes a tooling
file, never installs, formats or commits. `git status` is exactly as clean afterwards as before.

1. **Read what was detected.** The dry run prints `type`, `name` and `core_version` and where each came
   from. The type is decided by the runtime dependencies first: `@moku-labs/game` → `game`,
   `@moku-labs/core` → `framework`, any other `@moku-labs/*` runtime package → `consumer`, only tooling
   packages (`@moku-labs/ci`, `common`, `editor`, `ai`) → `tools`. The factory calls in the sources
   decide only when the dependencies name none, because a docs site quotes other layers' calls.
   `core_version` comes from `node_modules/@moku-labs/core`, else from `bun.lock`, so a clone without
   an install has it too. When the detection is plainly wrong, pass `--type <type>`; ask the person
   only when the dependencies and the sources disagree.
2. **Compare the tooling, report only.** Read
   `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md` and compare the project's
   tooling files against it for the detected type: `.bun-version`, `bunfig.toml` (none for a game),
   the `package.json` script contract and pinned devDependency versions, `biome.json`,
   `.oxlintrc.json`, `tsconfig.json`, `vitest.config.ts`, `lefthook.yml`, `.editorconfig`,
   `.gitignore` (`.claude` and `.planning` present), `cspell.json`, and the workflow files under
   `.github/workflows/`. List each difference in one line (`biome.json: no "!!**/.planning" entry`,
   `typescript 7.0.1, template 7.0.2`). Fix none of them: a project's tooling is its owner's, and
   moving it to the current stack is `/moku:upgrade`'s job, with its own plan and approval. A missing
   file the template has is a difference too; a file the template lacks is the project's own and is
   not reported.
3. **Write the marker and finish.**

   ```bash
   moku-rails init adopt --root "$ABSOLUTE_PROJECT_PATH"   # add --type <type> when step 1 corrected it
   ```

   It writes `.planning/moku.md` in the Step 6 format, puts the directory on the rails and closes the
   init window, so no `init begin` or `init done` is needed. Run `git -C "$ABSOLUTE_PROJECT_PATH" status
   --short` and check it shows nothing new.
4. **Report.** One line that the project is adopted with its type and core version, the list of
   tooling differences (or "tooling matches the template"), and, when there are differences, one line
   that `/moku:upgrade` can bring them in line. Then hand back as in Step 7: work starts by opening
   the first change.

Why the marker stays local rather than committed (`.planning/*` with `!.planning/moku.md`): every git
worktree of a project on the rails gets `.planning` as a link into the main checkout's lane folder. A
tracked file inside `.planning/` would make git create a real `.planning/` in every new worktree, and
the lane link would either be refused or show the marker as deleted. Adopting a clone costs one
command; breaking every worktree costs more.

## Step 0 — read the tooling reference

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md` in full before writing
any file. Every version, config body and script name comes from there. If that read fails, stop and
report the path and the error: without it the versions would be guesses.

## Step 1 — decide the project type

Ask with `AskUserQuestion`, header "Project type":

| Label | Meaning | Marker `type:` |
|---|---|---|
| Framework | Layer 2. Creates plugins, exports `createApp`/`createPlugin`, depends on `@moku-labs/core`. | `framework` |
| Consumer App | Layer 3. Imports a framework, uses `createApp`. | `consumer` |
| Tools/Library | Plain TypeScript with Moku tooling, no Moku dependencies. | `tools` |
| Game | Layer 3 on `@moku-labs/game` (2D, PixiJS), played and inspected through `@moku-labs/editor`. | `game` |

Default to Framework when the context already makes it clear. When the person said they want to make a
game, the type is Game: do not ask. For a Consumer App, also ask for the
framework package name (`@moku-labs/web`, `@moku-labs/worker`, `@moku-labs/room`) now — Step 3 needs
it.

Frameworks and libraries are **packages**: they publish to npm and get the full release plumbing.
Consumer apps and games **deploy**: they get CI only. A game ships to stores later through
`@moku-labs/native`; that is a release decision, not an init one.

Resolve `$ABSOLUTE_PROJECT_PATH` from the argument or `pwd`, and use it in every Bash command. The
working directory does not survive between tool calls.

## Step 2 — prepare the directory

`mkdir -p "$ABSOLUTE_PROJECT_PATH"`. A directory that holds a Moku project never reaches this step: it
was adopted above. If it already exists and `ls -A` shows other content, ask before continuing: tooling files (`package.json`, `biome.json`, `tsconfig.json`, …) are overwritten, files
under `src/` are left alone. Stop on anything but an explicit yes.

Run `git init "$ABSOLUTE_PROJECT_PATH"` only when `.git` is absent. Re-initializing an existing
repository can damage its hooks.

## Step 3 — scaffold

Follow `${CLAUDE_PLUGIN_ROOT}/skills/init/references/scaffold.md`. It holds the file-by-file
procedure, the per-type source templates, and the verification checklist. In short:

1. `bun init -y`, then remove the root `index.ts` and `README.md` it generates.
2. Write the tooling files. They are identical for all three types.
3. Write the directory skeleton and source templates for the chosen type.
4. Write the release plumbing (Step 4 below).
5. `bun install`, `bunx lefthook install`, `bun run format`.

A game takes its sources from the `moku-game` pack: load the `moku-game:moku-game` skill and follow
`references/hello-world.md` under the base directory it prints. A game installs the exact versions that
file names and was verified with (`@moku-labs/game`, `@moku-labs/editor` and their peers), never a
remembered version. Without the `moku-game` pack, stop and say the pack is missing: a game scaffold from
memory drifts from the engine.
## Step 4 — release plumbing, from the first commit

A project carries its release path from commit one, so the first release is not an archaeology
project.

**Packages** (framework, library) get two thin workflow files and eight scripts:

- `.github/workflows/ci.yml` and `.github/workflows/publish.yml`.
- `package.json` scripts: `lint`, `typecheck`, `test`, `build`, `validate`, `release:setup`,
  `release:doctor`, `release`.

**Apps** get one thin `.github/workflows/ci.yml` that calls the app-deploy workflow, and the five scripts
that workflow runs: `lint`, `typecheck`, `test:coverage`, `build`, `deploy`. Plus `test`, which the
pre-commit hook runs. No `validate`: an app is not published.

The workflow files have one home: the `@moku-labs/ci` package, which ships them beside the
`moku-release` CLI. Install it, then copy from the installed package. This plugin carries no copy of
its own, because a second copy is exactly what drifts.

```bash
bun add -d @moku-labs/ci
```

| Copy from | To |
|---|---|
| `node_modules/@moku-labs/ci/examples/package/ci.yml` | `.github/workflows/ci.yml` (packages) |
| `node_modules/@moku-labs/ci/examples/package/publish.yml` | `.github/workflows/publish.yml` (packages) |
| `node_modules/@moku-labs/ci/examples/app/ci.yml` | `.github/workflows/ci.yml` (apps) |

Copy the files byte for byte (`cp`), do not retype them. One edit follows for apps: `examples/app/ci.yml`
is written for an app with a worker, and names `build_worker_script` and `migrate_script`. Delete each of
those two lines when `package.json` has no script of that name (a static site has neither), so the first
push does not fail on a script that does not exist. Change nothing else in the file. The same file runs
`lint`, `typecheck`, `test:coverage` and `build` on every push and pull request, and `deploy` on every
push to `main`, so `package.json` needs all five. A game has no deploy target until the release station
picks one (web host, stores through `@moku-labs/native`), so the game template ships a `deploy` that
only says so. The three `release:*` scripts are
`moku-release setup`, `moku-release doctor` and `moku-release`. The branch ruleset
(`node_modules/@moku-labs/ci/rulesets/main.json`) is applied later by `release:setup`, not scaffolded
into the repository. Do not write the YAML from memory: the publish
path is tokenless OIDC Trusted Publishing, and a hand-written variant breaks provenance. The
reasoning is in `${CLAUDE_PLUGIN_ROOT}/skills/moku-release/references/release-model.md`; load the
`moku:moku-release` skill for the release procedure itself.

## Step 5 — verify

Run the checklist in `scaffold.md` §"Verification". Fix what fails and re-run the failing item. Do
not continue to Step 6 while anything is red: the marker means "this project is ready".

## Step 5.5 — a game: show it running

A game is not ready until the person has seen it. After the checklist is green:

1. Start the editor in the background: `bun run editor` (`moku-editor --root .`, port 3000). It takes the
   page from the engine; the game has no HTML file. Its start log must say `files:project-on`.
   `files:project-off` means TypeScript 7 got installed: pin `typescript` `6.0.3`.
2. Open `http://127.0.0.1:3000/__editor/` and take one screenshot. Use the first that works:
   - the built-in browser pane (`preview_start` with the url, then a screenshot);
   - a Playwright MCP browser, if one is connected;
   - `bunx playwright screenshot --wait-for-timeout 3000 http://127.0.0.1:3000/ .planning/hello.png`,
     then read the PNG;
   - none of them: give the person the url and ask what they see. Their "it works" counts as the
     screenshot. Do not stop init to ask for a browser permission.
3. Check the hello-world scene drew and the console or server log has no error, and show the shot.
4. Check the Claude Code files of the template are there: `.mcp.json` with the `moku-editor` server and
   `.claude/launch.json` with `game-editor` (`hello-world.md` → "Claude Code files"). If the
   `mcp__moku-editor__*` tools are listed in this session, call `moku_status` and read `game.position`
   once, as the proof that the tools reach the game. If they are not, that is expected right after the
   file was written: tell the person in one line to approve the `moku-editor` server and restart the
   session, and that from then on the game is read and played through it.
5. Say in one line that the setup works, and leave the server running.

If the page stays blank, read the server log and the browser console, fix the cause, and repeat.
The marker waits until the game draws.

## Step 6 — write the marker, last

Only after the checklist is green, write `.planning/moku.md`, then run `moku-rails init done`. Keep the format exactly as the
`detect-moku-project.sh` hook and `moku-rails` read it:

```markdown
# Moku Project

type: framework
name: my-framework
core_version: 0.1.3
created: 2026-09-19
```

`type` is `framework`, `consumer`, `tools` or `game`. `core_version` is the installed `@moku-labs/core`
version, or empty for a library. Get the date from `date +%F`.

## Step 6.5 — the first commit

The scaffold is the project's first commit. Without it the rails see every file as uncommitted work that
no change accounts for, and refuse to open the first change.

```bash
cd "$ABSOLUTE_PROJECT_PATH" && git add -A && git commit -m "chore: scaffold <name>"
```

The lefthook pre-commit runs here. A red hook is a scaffold bug: fix it and commit again, never with
`--no-verify`. `.planning/` stays out of the commit; `.gitignore` already holds it.

## Step 7 — report and hand back

Say what was created, show the checklist result, then name the next step: the project is
initialized, and work now starts by opening the first change. The conductor does this with
`moku-rails open <date-slug> --size S|M|L --type <type> --title "…"`. Do not open it here — `init`
sets up the project, the conductor runs the lifecycle.

For a framework, mention that `src/config.ts` is where `Config` and `Events` get their real shapes.
For a consumer app with UI, mention that the design station exists when the `moku-design` pack is
installed.

For a game, the next step is the person's idea: ask what game they want, and offer to look at any
sketches, references or art they already have. Mention that assets (art, music, voice) can be produced
with the `moku-ai` pack when they want it.

## Rules

- `bun`, never npm or yarn.
- Absolute paths in every Bash command.
- Type names stay `Config` and `Events`, never domain-specific.
- A consumer app never depends on `@moku-labs/core` directly. It may still author its own Layer-3
  plugins with the framework's `createPlugin`.
- Tooling files are identical across all three types; only the source templates and dependencies
  differ.
