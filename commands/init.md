---
description: Initialize a Moku development environment with full tooling
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
argument-hint: [project-path]
---

Initialize a new Moku development environment at the path specified by `$1` (or current directory if not provided). The environment must be identical to the moku_core project's tooling setup.

## Setup Process

### Step 1: Create Project Directory

If `$1` is provided, create the directory and cd into it. If it already exists, verify it's empty or confirm with the user before proceeding.

### Step 2: Initialize Project

Run `bun init` to create the base project. Then configure:

1. **package.json** — Set up with:
   - `"type": "module"`
   - `"engines": { "node": ">=22.0.0", "bun": ">=1.3.8" }`
   - Add `@moku-labs/core` as a dependency
   - Add all devDependencies with exact versions from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md`
   - Add scripts: `build`, `validate`, `lint`, `lint:fix`, `format`, `test`, `test:unit`, `test:integration`, `test:coverage`

2. **biome.json** — Copy exact configuration from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md`

3. **eslint.config.ts** — Copy exact flat config with biome, unicorn, sonarjs, jsdoc plugins. biome-config MUST be last.

4. **tsconfig.json** — Copy exact strict config. Add `tsconfig.build.json` for declaration emit.

5. **vitest.config.ts** — Unit + integration test projects with 90% coverage thresholds.

6. **lefthook.yml** — Pre-commit hooks: build, biome format, eslint check, test.

7. **.editorconfig** — UTF-8, LF, 2-space indent.

8. **bunfig.toml** — `exact = true`

9. **.bun-version** — `1.3.8`

### Step 3: Create Directory Structure

Create the 3-layer directory structure:

```
src/
  config.ts          # Step 1: createCoreConfig<Config, Events>
  index.ts           # Step 2: createCore + exports createApp, createPlugin
  plugins/           # Framework plugins directory
tests/
  unit/              # Unit tests
  integration/       # Integration tests
```

### Step 4: Create Template Files

**src/config.ts** — Template with:
```typescript
import { createCoreConfig } from "@moku-labs/core";

// biome-ignore lint/complexity/noBannedTypes: placeholder for user-defined config
type Config = {};

// biome-ignore lint/complexity/noBannedTypes: placeholder for user-defined events
type Events = {};

export const coreConfig = createCoreConfig<Config, Events>("my-framework", {
  config: {},
});

export const { createPlugin, createCore } = coreConfig;
```

**IMPORTANT:** Keep type names as `Config` and `Events` — do NOT use domain-specific names like `MyFrameworkConfig` or `AppEvents`. These generic names are the convention across all Moku projects.

**src/index.ts** — Template with:
```typescript
import { coreConfig, createCore } from "./config";

const framework = createCore(coreConfig, {
  plugins: [],
});

export const { createApp, createPlugin } = framework;
```

### Step 5: Install Dependencies

Run `bun install` and verify no errors.

### Step 6: Verification Checklist

After setup, run through this checklist to verify everything works. Fix any issues before reporting success.

1. **Dependencies** — `bun install` completed without errors
2. **TypeScript** — `bunx tsc --noEmit` passes with zero errors
3. **Biome** — `bun run format` runs without errors (formatting works)
4. **ESLint** — `bun run lint` passes with zero warnings and zero errors
5. **Tests** — `bun run test` runs successfully (empty test suite is OK at this stage)
6. **Build** — `bun run build` compiles without errors
7. **Config template** — `src/config.ts` imports `createCoreConfig` from `@moku-labs/core` and exports `{ createPlugin, createCore }`
8. **Index template** — `src/index.ts` imports from `./config` and exports `{ createApp, createPlugin }`
9. **Directory structure** — `src/plugins/` directory exists
10. **Git hooks** — `lefthook install` ran successfully (if git repo)

If any check fails, fix the issue and re-run the failing check before proceeding.

### Step 7: Report

Tell the user what was created, show the verification checklist results, and provide next steps:
- Edit `src/config.ts` to define Config and Events types
- Create plugins in `src/plugins/`
- Use `/moku:plan_framework` to plan a complete framework
- Use `/moku:build_plugin` to create individual plugins

## Important

- Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md` for exact config contents — do NOT guess versions
- Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/architecture.md` for architecture reference
- Use `bun` as the package manager, never npm or yarn
- Keep type names generic: `Config`, `Events` — never domain-specific names
- Run the full verification checklist before reporting success
