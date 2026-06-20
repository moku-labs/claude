---
description: Initialize a Moku development environment with full tooling. Accepts natural language.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion
argument-hint: natural language, or [project-path]
disable-model-invocation: true
---

## Moku Core Specification (authoritative)

Before any decision about architecture, the core API, factory chain, config, lifecycle, events, the `ctx` object, types, invariants, or plugin structure — **consult `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/spec-index.md` and open the cited `spec/NN-*.md` file.** The spec is the single source of truth; never rely on memory or guess. Justify any deviation against a cited section, and cite spec section IDs (`spec/NN-*.md §N`) in output. Never stage or commit `.planning/` — it is local-only state.

## Input — natural language first

`$ARGUMENTS` may be **natural language** — you don't need the exact flags or patterns. Resolve intent per **`${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/nl-args.md`**: map the request onto this command's documented arguments (a target path), echo a one-line `Interpreting as: …`, then proceed. If a **required** value is missing or the request is ambiguous, ask only for that gap (don't make the user restate everything). Input that is already exact structured syntax is used verbatim (no echo).

Initialize a new Moku development environment at the path specified by `$1` (or current directory if not provided). The environment must be identical to the moku_core project's tooling setup.

## Setup Process

### Step 0: Read Tooling Reference (Required Gate)

**Before writing any files**, read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md` in full. Do not proceed to Step 1 until this file has been read. All dependency versions, config file contents, and script definitions must come from this file — never guess or fabricate versions.

**If this read fails** (file not found, permission error, or empty result), stop immediately. Report the exact path that was attempted and the error. Do not proceed to Step 1 — the tooling versions are required before any file can be written.

### Step 1: Determine Project Type and Gather All Required Information

Use `AskUserQuestion` to determine project type:
- Question: "What type of project are you creating?"
- Header: "Project type"
- Options:
  1. label: "Framework (Recommended)", description: "Layer 2 — creates plugins, exports createApp/createPlugin. Depends on @moku-labs/core"
  2. label: "Consumer App", description: "Layer 3 — imports from a framework, uses createApp. Depends on a framework package"
  3. label: "Tools/Library", description: "Standard TypeScript project with Moku tooling. No Moku dependencies"
- multiSelect: false

Default to **Framework** if not clear from context.

**If the project type is Consumer App**, also ask for the framework package name (e.g., `@moku-labs/web`) now — this is needed in Step 3 when writing `package.json`. Do not proceed until you have this information.

Note the `$ABSOLUTE_PROJECT_PATH` (resolved from `$1` or `pwd`). Use this absolute path in all subsequent Bash commands — the working directory is not preserved between tool calls.

### Step 2: Create Project Directory and Git Repo

If `$1` is provided, create the directory at the absolute path. Use `mkdir -p "$ABSOLUTE_PROJECT_PATH"` — this is safe to run whether or not the directory exists.

If the directory already exists and is **non-empty** (check with `ls -A "$ABSOLUTE_PROJECT_PATH"`):
- Confirm with the user before proceeding. Use `AskUserQuestion` with the question: "The directory `$ABSOLUTE_PROJECT_PATH` is non-empty. Existing tooling files (`package.json`, `biome.json`, `tsconfig.json`, etc.) will be overwritten with Moku versions. Source files in `src/` will be left untouched. Continue?" Accept only an explicit "yes" as confirmation.
- If the user declines, **stop and report** — do not proceed.
- If the user confirms, proceed with the understanding that tooling files will be overwritten and source files in `src/` will be left untouched.

If `.git` does not already exist at `$ABSOLUTE_PROJECT_PATH/.git`, run `git init "$ABSOLUTE_PROJECT_PATH"`. Skip `git init` if `.git` already exists — re-initializing an existing repo can corrupt hooks.

### Step 3: Initialize Project

Run `bun init -y` in the project directory (using absolute path: `cd "$ABSOLUTE_PROJECT_PATH" && bun init -y`). The `-y` flag prevents interactive prompts when the directory is non-empty.

**Note:** `bun init` generates its own `package.json`, `tsconfig.json`, `.gitignore`, `index.ts`, `README.md`, and `CLAUDE.md`. Handle these as follows:
- `package.json`, `tsconfig.json`, `.gitignore`, `CLAUDE.md` — Will be overwritten with Moku-specific versions below. Read each generated file before overwriting it (the Write tool requires reading a file before it can overwrite it).
- `index.ts` — Delete it. Moku projects use `src/index.ts` instead.
- `README.md` — Delete it. The user will create their own.

After running `bun init`, delete the root `index.ts` and `README.md` using Bash: `rm -f "$ABSOLUTE_PROJECT_PATH/index.ts" "$ABSOLUTE_PROJECT_PATH/README.md"`. The `rm` command is not in the new project's `.claude/settings.local.json` allow-list (that file hasn't been written yet), but the current session's parent permissions apply during init — use Bash directly.

**Note on `rm -f`:** The `-f` flag means the command succeeds even if the files do not exist — this is intentional and safe. However, if the project directory is non-writable (e.g., wrong owner or permissions), these deletions will silently fail and subsequent Write operations in this step will also fail. If any Write fails with a permission error, stop and ask the user to check that `$ABSOLUTE_PROJECT_PATH` is writable before retrying.

Then configure all tooling files (these are **identical across all project types**):

1. **package.json** — Set up with:
   - `"type": "module"`
   - `"engines": { "node": ">=24.0.0", "bun": ">=1.3.14" }`
   - `main`, `module`, `types`, `exports`, `files` fields for publishable packages (copy from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md`). Consumer apps can omit these if not publishing.
   - Dependencies vary by project type (see Step 4)
   - Add all devDependencies with exact versions from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md` (you read this in Step 0)
   - Add scripts: `build`, `validate`, `lint`, `lint:fix`, `format`, `test`, `test:unit`, `test:integration`, `test:coverage`

2. **biome.json** — Copy exact configuration from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md`

3. **eslint.config.ts** — Copy exact flat config with biome, unicorn, sonarjs, jsdoc plugins. biome-config MUST be last. **Note:** The `sonarjs.configs!.recommended` line needs a `// biome-ignore lint/style/noNonNullAssertion:` comment — the non-null assertion is required because sonarjs types mark configs as possibly undefined, but biome's linter flags `!.` without the ignore comment.

4. **declarations.d.ts** — Ambient module declarations for untyped JS packages. Required because `strict: true` enables `noImplicitAny`, which errors on imports from packages without `.d.ts` files (like `eslint-config-biome`). Copy exact content from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md`.

5. **tsconfig.json** — Copy exact strict config. The `include` array must contain `"declarations.d.ts"` and `"*.config.ts"` alongside `"src"` and `"tests"` so ambient declarations are visible when type-checking config files. **TypeScript 6:** the config sets `"types": ["bun"]` because TS6 defaults `types` to `[]` (no auto-`@types`); without it `bunx tsc --noEmit` fails with `Cannot find name 'Bun'`.

6. **tsconfig.build.json** — Extends tsconfig.json for build output with declaration emit. Copy exact content from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md`.

7. **tsdown.config.ts** — Build configuration producing ESM + CJS with declaration files. Copy exact content from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md`.

8. **vitest.config.ts** — Unit + integration test projects with 90% coverage thresholds.

9. **lefthook.yml** — Pre-commit hooks: build, biome format, eslint check, test.

10. **.editorconfig** — UTF-8, LF, 2-space indent.

11. **bunfig.toml** — `exact = true`. **Write this before running `bun install` in Step 5** to ensure exact version pinning applies from the first install. (It is listed here for documentation order, but must exist on disk before any `bun install` or `bun add` calls.)

12. **.bun-version** — `1.3.14`

13. **.gitignore** — Standard ignores for node_modules, dist, coverage, .env files, caches, .claude, .planning. Copy exact content from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md`.
    - **Idempotent for existing repos:** if a `.gitignore` already exists (e.g. initializing into an existing project), do NOT blindly overwrite it. Instead, ensure both `.claude/` and `.planning/` are present, appending any missing line under a `# Claude Code` / `# Planning artifacts` comment. `.planning/` is local-only state and must NEVER be committed — this is a hard rule enforced by the `verify-before-commit` hook, which blocks any `git add`/commit referencing `.planning`.

13b. **cspell.json** — Spell-check dictionary pre-seeded with moku/domain terms so valid names aren't flagged in comments/docs. Copy from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md` (the `## cspell.json` block); seed `words` from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/glossary.md`. Note: the `eslint.config.ts` you scaffold already ships the pre-expanded `unicorn/prevent-abbreviations` allowList from tooling-config — do not shrink it.

14. **.claude/settings.local.json** — Safe default permissions for Claude Code agents. Copy exact configuration from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md`.

14b. **.claude/workflows/moku-verify.js** — Install the bundled validation workflow so the project gets a `/moku-verify` slash command (a parallel fan-out of all Moku validators). Copy `${CLAUDE_PLUGIN_ROOT}/workflows/moku-verify.js` into `.claude/workflows/`. (Requires Claude Code v2.1.154+; if workflows are unavailable the copied file is simply inert.) See `${CLAUDE_PLUGIN_ROOT}/workflows/README.md` for caveats.

15. **CLAUDE.md** — Project-specific instructions for Claude Code. Generate from the template in `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md`, replacing the framework name and description with the actual project values. Adjust these sections to match the project type:
    - **Architecture:** Framework shows 3-layer model; Consumer shows `createApp` usage; Tools/Library omit this section.
    - **Moku Development Toolkit:** Adapt commands and workflows per project type:
      - **Framework:** Include `plan` and `build` commands, all skills, all agents, framework workflow.
      - **Consumer App:** Include `plan` and `build` commands. Include `moku-core` and `moku-plugin` skills. Include all agents. Show the consumer workflow, including authoring custom Layer-3 plugins (`src/plugins/{name}/` via the framework's `createPlugin`) — see the moku-core `consumer-plugins.md` reference.
      - **Tools/Library:** Omit the entire Moku Development Toolkit section — these projects don't use Moku commands.

### Step 4: Create Directory Structure and Template Files

Structure and templates vary by project type. **All project types** must include placeholder test files at `tests/unit/setup.test.ts` AND `tests/integration/setup.test.ts` to prevent vitest from exiting with code 1 on empty test suites. Create both files in every project type:

```typescript
import { describe, expect, it } from "vitest";

describe("setup", () => {
  it("should be configured correctly", () => {
    expect(true).toBe(true);
  });
});
```

#### Framework (Layer 2)

```
src/
  config.ts          # createCoreConfig<Config, Events>
  index.ts           # createCore + exports createApp, createPlugin
  plugins/           # Framework plugins directory (each plugin has its own __tests__/)
tests/
  unit/
    setup.test.ts    # Placeholder test (prevents empty-suite failure) — required
  integration/       # Framework-level integration tests only (cross-plugin scenarios)
```

**Dependencies:** `@moku-labs/core`, `@moku-labs/common` (the shared family infrastructure — supplies `logPlugin`/`envPlugin` and the branded CLI kit; see the **moku-common** skill)

**src/config.ts** — Replace `"<actual-project-name>"` with the actual project name (e.g., derive from the `package.json` `name` field, stripping any npm scope). Register `logPlugin` + `envPlugin` from `@moku-labs/common` so `ctx.log` and `ctx.env` are injected on every plugin's `ctx` (family convention — see the moku-common skill). Because explicit `Config`/`Events` type args are given, the third `CorePlugins` tuple arg is required (`skeleton-conventions.md §2`):
```typescript
import { createCoreConfig } from "@moku-labs/core";
import { logPlugin, envPlugin } from "@moku-labs/common";

/**
 * Global configuration shape for the framework.
 *
 * @example
 * ```ts
 * type Config = { port: number; host: string };
 * ```
 */
// biome-ignore lint/complexity/noBannedTypes: placeholder for user-defined config
type Config = {};

/**
 * Event contract for the framework.
 *
 * @example
 * ```ts
 * type Events = { "app:ready": { timestamp: number } };
 * ```
 */
// biome-ignore lint/complexity/noBannedTypes: placeholder for user-defined events
type Events = {};

export const coreConfig = createCoreConfig<Config, Events, [typeof logPlugin, typeof envPlugin]>(
  "<actual-project-name>",
  {
    config: {},
    plugins: [logPlugin, envPlugin], // core plugins → ctx.log + ctx.env on every ctx
  },
);

export const { createPlugin, createCore } = coreConfig;
```

**src/index.ts:**
```typescript
import { coreConfig, createCore } from "./config";

const framework = createCore(coreConfig, {
  plugins: []
});

export const { createApp, createPlugin } = framework;
```

**Family conventions (see the moku-common skill).** Plugin/CLI/script source must use `ctx.log`
(not raw `console.*`) for logging and `ctx.env` (not raw `process.env`) for environment access, and
any CLI surface must render through the branded kit (`@moku-labs/common/cli` — `createBrandConsole`,
`box`, `spinnerFrameAt`, styled `confirm`/`select`). These are enforced by the
`validate-common-usage` hook + `moku-common-validator`. Full rules + examples:
`${CLAUDE_PLUGIN_ROOT}/skills/moku-common/references/conventions.md` (MC1–MC3).

**IMPORTANT:** Keep type names as `Config` and `Events` — do NOT use domain-specific names like `MyFrameworkConfig` or `AppEvents`. These generic names are the convention across all Moku projects.

#### Consumer App (Layer 3)

```
src/
  index.ts           # createApp entry point
  plugins/           # OPTIONAL — custom Layer-3 plugins (createPlugin) for plugin-shaped concerns
tests/
  unit/
    setup.test.ts    # Placeholder test (prevents empty-suite failure) — required
  integration/
```

**Dependencies:** The framework package gathered in Step 1 (e.g., `@moku-labs/web`). The consumer NEVER depends on `@moku-labs/core` directly — if `@moku-labs/core` appears in the dependency list, remove it.

**src/index.ts** — Use the framework package name gathered in Step 1:
```typescript
import { createApp } from "<framework-package>";

const app = createApp({
  // Plugin config overrides go here
});
```

No `src/config.ts` and no direct `@moku-labs/core` dependency — consumer apps never call `createCoreConfig`/`createCore` (that is the framework's job, Layer 2). They **do** author their own plugins when a concern is plugin-shaped: add `src/plugins/{name}/` and import `createPlugin` from the **framework package** (never `@moku-labs/core`), then compose them via `createApp({ plugins: [...] })`. The `src/plugins/` folder is optional — scaffold it only when needed. See `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/consumer-plugins.md` for the Layer-3 rule and the plugin-vs-lib-vs-island decision guide.

A consumer app **inherits `ctx.log`/`ctx.env`** from its framework (the framework registers `logPlugin`/`envPlugin`) — it does NOT register them itself. The family conventions still apply to consumer-authored plugins and any CLI/`scripts/`: use `ctx.log` (not raw `console.*`), `ctx.env` (not raw `process.env`), and render CLI through `@moku-labs/common/cli`. See the **moku-common** skill (`${CLAUDE_PLUGIN_ROOT}/skills/moku-common/references/conventions.md`, MC1–MC3).

#### Tools/Library

```
src/
  index.ts           # Library entry point
tests/
  unit/
    setup.test.ts    # Placeholder test (prevents empty-suite failure) — required
  integration/
```

**Dependencies:** None by default — add as needed based on the project's purpose.

**src/index.ts:** Empty placeholder — the user will define exports.

### Step 5: Install Dependencies

Run `bun install` using the absolute path: `cd "$ABSOLUTE_PROJECT_PATH" && bun install`.

**If `bun install` fails**, stop immediately and report the error to the user. Do not proceed to Step 5b or Step 6. Common causes: registry connectivity, version conflict, invalid `package.json`. Fix the issue (or ask the user) before retrying.

**Recovery after `bun install` failure:** Once the root cause is fixed (connectivity restored, conflict resolved, `package.json` corrected), re-run `bun install` in `$ABSOLUTE_PROJECT_PATH` and then continue from Step 5b. Do not restart the entire init process.

### Step 5b: Install Git Hooks

Run `cd "$ABSOLUTE_PROJECT_PATH" && bunx lefthook install` to register the pre-commit hooks defined in `lefthook.yml`. This must happen after `bun install` (lefthook binary must be available in `node_modules/.bin`).

**If `lefthook install` fails**, report the error — do not proceed.

### Step 5c: Format All Files

Run `cd "$ABSOLUTE_PROJECT_PATH" && bun run format` to normalize all generated files to Biome's output. This prevents formatting drift between the templates and Biome's actual formatting rules (e.g., trailing comma removal). This must happen before the verification checklist.

### Step 5d: Install Output Styles (Optional)

If the Moku plugin has output styles available at `${CLAUDE_PLUGIN_ROOT}/output-styles/`, copy them to the project:

```bash
if [ -d "${CLAUDE_PLUGIN_ROOT}/output-styles" ]; then
  mkdir -p "$ABSOLUTE_PROJECT_PATH/.claude/output-styles"
  cp "${CLAUDE_PLUGIN_ROOT}/output-styles/"*.md "$ABSOLUTE_PROJECT_PATH/.claude/output-styles/" 2>/dev/null || true
  echo "Output styles installed."
else
  echo "Note: output-styles not found in plugin cache — skipping."
fi
```

This installs (when available):
- `moku-planning.md` — Verbose, analytical formatting for planning phases
- `moku-building.md` — Terse, progress-focused formatting for build phases

Users can switch with `/output-style moku-planning` or `/output-style moku-building`.

### Step 6: Verification Checklist

After setup, run through this checklist to verify everything works. Fix any issues before reporting success.

1. **Dependencies** — `bun install` completed without errors
2. **TypeScript** — `bunx tsc --noEmit` passes with zero errors. If it fails, the most common cause is a missing entry in tsconfig.json's `include` array (e.g., `"declarations.d.ts"` or `"*.config.ts"` omitted). Verify the tsconfig matches the reference exactly.
   - If the failure is `Cannot find module`, `File not found`, or `No inputs were found`, re-read the written `$ABSOLUTE_PROJECT_PATH/tsconfig.json` and compare its `include` array against the reference in `tooling-config.md`. Rewrite the file if it does not match before re-running the check.
3. **Biome** — `bun run lint` includes `biome check .` — verify it exits cleanly (formatting was already normalized in Step 5c)
4. **ESLint** — `bun run lint` passes with zero warnings and zero errors
5. **Tests** — `bun run test` runs successfully (placeholder test must pass — vitest exits code 1 on empty suites)
6. **Build** — `bun run build` compiles without errors
7. **Template files** — Source files exist and match the project type:
   - **Framework:** `src/config.ts` exports `{ createPlugin, createCore }`, `src/index.ts` exports `{ createApp, createPlugin }`, `src/plugins/` exists
   - **Consumer:** `src/index.ts` imports `createApp` from the framework package, and `@moku-labs/core` does NOT appear in `package.json` dependencies
     - **If `@moku-labs/core` IS found in `package.json` dependencies:** Remove the `@moku-labs/core` entry from the `dependencies` section of `package.json`, then re-run `bun install` in `$ABSOLUTE_PROJECT_PATH`, then re-run this checklist item.
   - **Tools:** `src/index.ts` exists
8. **Git repo** — `.git` directory exists at project root
9. **Git hooks** — `lefthook install` ran successfully (Step 5b)

If any check fails, fix the issue and re-run the failing check before proceeding.

### Step 7: Report

Tell the user what was created, show the verification checklist results, and provide next steps based on project type:

**Framework:**
- Edit `src/config.ts` to define Config and Events types
- Use `/moku:brainstorm create framework "description"` to explore architecture decisions before planning (optional — recommended for novel or complex domains)
- (Optional) `/moku:design "..."` only if the framework ships a **UI or a CLI/TUI/DX surface** to design — most frameworks have nothing to design visually and can skip it
- Use `/moku:plan create framework` to plan a complete framework
- Use `/moku:build` to build from a plan

**Consumer App:**
- Use `/moku:design "what to design"` to explore the **design** (look, feel, screens) and capture a reusable design context before planning — recommended for any app with a UI; it produces a `design-context.md` that `/moku:plan ... --context` consumes
- Use `/moku:brainstorm create app "description"` to explore architecture decisions before planning (optional)
- Use `/moku:plan create app` to plan the application
- Use `/moku:build` to build from a plan — for a **web** app its final stage is the comprehensive E2E + visual-baseline gate (mandatory, skippable only with a confirmed skip)
- Use `/moku:e2e` any time to comprehensively e2e-test the app in a real browser (Playwright) with visual baselines — every screen/feature tested + confirmed, bugs/visual issues fixed
- Author custom Layer-3 plugins for plugin-shaped concerns — add `src/plugins/{name}/` via the framework's `createPlugin` (see the moku-core `consumer-plugins.md` reference)

**Tools/Library:**
- Start adding source files to `src/`

## Important

- Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md` in Step 0 before writing any files — do NOT guess versions
- Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/architecture.md` for architecture reference
- Use `bun` as the package manager, never npm or yarn
- Use absolute paths in all Bash commands — the working directory is not preserved between tool calls
- Keep type names generic: `Config`, `Events` — never domain-specific names
- Consumer Apps must NEVER depend on `@moku-labs/core` directly — verify in checklist item 7
- Consumer Apps CAN author their own plugins (Layer 3): organize into `src/plugins/{name}/` via the framework's re-exported `createPlugin` — see `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/consumer-plugins.md`. "Never core config" ≠ "never plugins"
- Run the full verification checklist before reporting success
- Tooling config (items 1-15) is identical across ALL project types — only template files and dependencies differ
