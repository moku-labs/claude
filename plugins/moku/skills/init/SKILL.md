---
name: init
description: Scaffolds a new Moku project — tooling, directory skeleton, release plumbing and the .planning/moku.md marker the lifecycle rails read. Use once per project, before any change is opened, when the user asks to start, set up or initialize a Moku framework, app or library.
when_to_use: Starting a new Moku project, or bringing Moku tooling into a directory that has none. Not for changing an already-initialized project.
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

Default to Framework when the context already makes it clear. For a Consumer App, also ask for the
framework package name (`@moku-labs/web`, `@moku-labs/worker`, `@moku-labs/room`) now — Step 3 needs
it.

Frameworks and libraries are **packages**: they publish to npm and get the full release plumbing.
Consumer apps **deploy**: they get CI only.

Resolve `$ABSOLUTE_PROJECT_PATH` from the argument or `pwd`, and use it in every Bash command. The
working directory does not survive between tool calls.

## Step 2 — prepare the directory

`mkdir -p "$ABSOLUTE_PROJECT_PATH"`. If it already exists and `ls -A` shows content, ask before
continuing: tooling files (`package.json`, `biome.json`, `tsconfig.json`, …) are overwritten, files
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

## Step 4 — release plumbing, from the first commit

A project carries its release path from commit one, so the first release is not an archaeology
project.

**Packages** (framework, library) get two thin workflow files and eight scripts:

- `.github/workflows/ci.yml` and `.github/workflows/publish.yml`.
- `package.json` scripts: `lint`, `typecheck`, `test`, `build`, `validate`, `release:setup`,
  `release:doctor`, `release`.

**Apps** get one thin `.github/workflows/ci.yml` that calls the app-deploy workflow, and the first
five scripts.

Copy the workflow YAML and the three `release:*` script bodies from the `moku:moku-release` skill's
`templates/` — same plugin, so the path resolves:

| Copy from | To |
|---|---|
| `${CLAUDE_PLUGIN_ROOT}/skills/moku-release/templates/package-ci.yml` | `.github/workflows/ci.yml` (packages) |
| `${CLAUDE_PLUGIN_ROOT}/skills/moku-release/templates/package-publish.yml` | `.github/workflows/publish.yml` (packages) |
| `${CLAUDE_PLUGIN_ROOT}/skills/moku-release/templates/app-ci.yml` | `.github/workflows/ci.yml` (apps) |

`templates/ruleset-main.json` is the branch ruleset for `main`; it is applied during
`release:setup`, not scaffolded into the repository. Do not write the YAML from memory: the publish
path is tokenless OIDC Trusted Publishing, and a hand-written variant breaks provenance. The
reasoning is in `${CLAUDE_PLUGIN_ROOT}/skills/moku-release/references/release-model.md`; load the
`moku:moku-release` skill for the release procedure itself.

## Step 5 — verify

Run the checklist in `scaffold.md` §"Verification". Fix what fails and re-run the failing item. Do
not continue to Step 6 while anything is red: the marker means "this project is ready".

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

`type` is `framework`, `consumer` or `tools`. `core_version` is the installed `@moku-labs/core`
version, or empty for a library. Get the date from `date +%F`.

## Step 7 — report and hand back

Say what was created, show the checklist result, then name the next step: the project is
initialized, and work now starts by opening the first change. The conductor does this with
`moku-rails open <date-slug> --size S|M|L --type <type> --title "…"`. Do not open it here — `init`
sets up the project, the conductor runs the lifecycle.

For a framework, mention that `src/config.ts` is where `Config` and `Events` get their real shapes.
For a consumer app with UI, mention that the design station exists when the `moku-design` pack is
installed.

## Rules

- `bun`, never npm or yarn.
- Absolute paths in every Bash command.
- Type names stay `Config` and `Events`, never domain-specific.
- A consumer app never depends on `@moku-labs/core` directly. It may still author its own Layer-3
  plugins with the framework's `createPlugin`.
- Tooling files are identical across all three types; only the source templates and dependencies
  differ.
