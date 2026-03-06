---
description: Initialize a Moku development environment with full tooling
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
argument-hint: [project-path]
---

Initialize a new Moku development environment at the path specified by `$1` (or current directory if not provided). The environment must be identical to the moku_core project's tooling setup.

## Setup Process

### Step 1: Determine Project Type

Ask the user (if not clear from context) what type of project they are creating:

- **Framework** (Layer 2) — Creates plugins, exports `createApp`/`createPlugin`. Depends on `@moku-labs/core`.
- **Consumer App** (Layer 3) — Imports from a framework package, uses `createApp`. Depends on the framework package (e.g., `@moku-labs/web`), NOT `@moku-labs/core` directly.
- **Tools/Library** — Standard TypeScript project with Moku tooling. No Moku dependencies unless needed.

Default to **Framework** if the user doesn't specify.

### Step 2: Create Project Directory and Git Repo

If `$1` is provided, create the directory and cd into it. If it already exists, verify it's empty or confirm with the user before proceeding.

Run `git init` to initialize a git repository. This is needed for lefthook (git hooks) and standard development workflow.

### Step 3: Initialize Project

Run `bun init` to create the base project.

**Note:** `bun init` generates its own `package.json`, `tsconfig.json`, `.gitignore`, `index.ts`, `README.md`, and `CLAUDE.md`. Handle these as follows:
- `package.json`, `tsconfig.json`, `.gitignore`, `CLAUDE.md` — Will be overwritten with Moku-specific versions below. Read each generated file before overwriting it (the Write tool requires reading a file before it can overwrite it).
- `index.ts` — Delete it. Moku projects use `src/index.ts` instead.
- `README.md` — Delete it. The user will create their own.

After running `bun init`, delete the root `index.ts` and `README.md` before proceeding.

Then configure all tooling files (these are **identical across all project types**):

1. **package.json** — Set up with:
   - `"type": "module"`
   - `"engines": { "node": ">=22.0.0", "bun": ">=1.3.8" }`
   - `main`, `module`, `types`, `exports`, `files` fields for publishable packages (copy from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md`). Consumer apps can omit these if not publishing.
   - Dependencies vary by project type (see Step 5)
   - Add all devDependencies with exact versions from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md`
   - Add scripts: `build`, `validate`, `lint`, `lint:fix`, `format`, `test`, `test:unit`, `test:integration`, `test:coverage`

2. **biome.json** — Copy exact configuration from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md`

3. **eslint.config.ts** — Copy exact flat config with biome, unicorn, sonarjs, jsdoc plugins. biome-config MUST be last. **Note:** The `sonarjs.configs!.recommended` line needs a `// biome-ignore lint/style/noNonNullAssertion:` comment — the non-null assertion is required because sonarjs types mark configs as possibly undefined, but biome's linter flags `!.` without the ignore comment.

4. **declarations.d.ts** — Ambient module declarations for untyped JS packages. Required because `strict: true` enables `noImplicitAny`, which errors on imports from packages without `.d.ts` files (like `eslint-config-biome`). Copy exact content from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md`.

5. **tsconfig.json** — Copy exact strict config. The `include` array must contain `"declarations.d.ts"` and `"*.config.ts"` alongside `"src"` and `"tests"` so ambient declarations are visible when type-checking config files.

6. **tsconfig.build.json** — Extends tsconfig.json for build output with declaration emit. Copy exact content from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md`.

7. **tsdown.config.ts** — Build configuration producing ESM + CJS with declaration files. Copy exact content from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md`.

8. **vitest.config.ts** — Unit + integration test projects with 90% coverage thresholds.

9. **lefthook.yml** — Pre-commit hooks: build, biome format, eslint check, test.

10. **.editorconfig** — UTF-8, LF, 2-space indent.

11. **bunfig.toml** — `exact = true`

12. **.bun-version** — `1.3.8`

13. **.gitignore** — Standard ignores for node_modules, dist, coverage, .env files, caches, .claude, .planning. Copy exact content from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md`.

14. **.claude/settings.local.json** — Safe default permissions for Claude Code agents. Copy exact configuration from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md`.

15. **CLAUDE.md** — Project-specific instructions for Claude Code. Generate from the template in `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md`, replacing the framework name and description with the actual project values. Adjust these sections to match the project type:
    - **Architecture:** Framework shows 3-layer model; Consumer shows `createApp` usage; Tools/Library omit this section.
    - **Moku Development Toolkit:** Adapt commands and workflows per project type:
      - **Framework:** Include `plan` and `build` commands, all skills, all agents, framework workflow.
      - **Consumer App:** Include `plan` and `build` commands. Include `moku-core` and `moku-plugin` skills. Include all agents. Show consumer workflow.
      - **Tools/Library:** Omit the entire Moku Development Toolkit section — these projects don't use Moku commands.

### Step 4: Create Directory Structure and Template Files

Structure and templates vary by project type. **All project types** must include a placeholder test file at `tests/unit/setup.test.ts` to prevent vitest from exiting with code 1 on an empty test suite:

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
  plugins/           # Framework plugins directory
tests/
  unit/
    setup.test.ts    # Placeholder test
  integration/
```

**Dependencies:** `@moku-labs/core`

**src/config.ts:**
```typescript
import { createCoreConfig } from "@moku-labs/core";

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

export const coreConfig = createCoreConfig<Config, Events>("my-framework", {
  config: {}
});

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

**IMPORTANT:** Keep type names as `Config` and `Events` — do NOT use domain-specific names like `MyFrameworkConfig` or `AppEvents`. These generic names are the convention across all Moku projects.

#### Consumer App (Layer 3)

```
src/
  index.ts           # createApp entry point
tests/
  unit/
    setup.test.ts    # Placeholder test
  integration/
```

**Dependencies:** The framework package (e.g., `@moku-labs/web`) — ask the user which framework to use. The consumer NEVER depends on `@moku-labs/core` directly.

**src/index.ts:**
```typescript
import { createApp } from "<framework-package>";

const app = createApp({
  // Plugin config overrides go here
});
```

No `src/config.ts`, no `src/plugins/` — consumer apps don't define plugins or core config.

#### Tools/Library

```
src/
  index.ts           # Library entry point
tests/
  unit/
    setup.test.ts    # Placeholder test
  integration/
```

**Dependencies:** None by default — add as needed based on the project's purpose.

**src/index.ts:** Empty placeholder — the user will define exports.

### Step 5: Install Dependencies

Run `bun install` and verify no errors.

### Step 5b: Format All Files

Run `bun run format` to normalize all generated files to Biome's output. This prevents formatting drift between the templates and Biome's actual formatting rules (e.g., trailing comma removal). This must happen before the verification checklist.

### Step 6: Verification Checklist

After setup, run through this checklist to verify everything works. Fix any issues before reporting success.

1. **Dependencies** — `bun install` completed without errors
2. **TypeScript** — `bunx tsc --noEmit` passes with zero errors
3. **Biome** — `bun run format` runs without errors (formatting works)
4. **ESLint** — `bun run lint` passes with zero warnings and zero errors
5. **Tests** — `bun run test` runs successfully (placeholder test must pass — vitest exits code 1 on empty suites)
6. **Build** — `bun run build` compiles without errors
7. **Template files** — Source files exist and match the project type:
   - **Framework:** `src/config.ts` exports `{ createPlugin, createCore }`, `src/index.ts` exports `{ createApp, createPlugin }`, `src/plugins/` exists
   - **Consumer:** `src/index.ts` imports `createApp` from the framework package
   - **Tools:** `src/index.ts` exists
8. **Git repo** — `git init` ran successfully
9. **Git hooks** — `lefthook install` ran successfully

If any check fails, fix the issue and re-run the failing check before proceeding.

### Step 7: Report

Tell the user what was created, show the verification checklist results, and provide next steps based on project type:

**Framework:**
- Edit `src/config.ts` to define Config and Events types
- Create plugins in `src/plugins/`
- Use `/moku:plan framework` to plan a complete framework
- Use `/moku:build plugin` to create individual plugins

**Consumer App:**
- Use `/moku:plan app` to plan the application
- Use `/moku:build app` to build from a plan

**Tools/Library:**
- Start adding source files to `src/`

## Important

- Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md` for exact config contents — do NOT guess versions
- Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/architecture.md` for architecture reference
- Use `bun` as the package manager, never npm or yarn
- Keep type names generic: `Config`, `Events` — never domain-specific names
- Run the full verification checklist before reporting success
- Tooling config (items 1-15) is identical across ALL project types — only template files and dependencies differ
