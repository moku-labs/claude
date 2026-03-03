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
  config.ts          # Step 1: createCoreConfig (template with TODOs)
  index.ts           # Step 2: createCore (template with TODOs)
  plugins/           # Framework plugins directory
tests/
  unit/              # Unit tests
  integration/       # Integration tests
```

### Step 4: Create Template Files

**src/config.ts** — Template with:
```typescript
import { createCoreConfig } from '@moku-labs/core';

// TODO: Define your framework's config shape
type Config = {};

// TODO: Define your framework's global events
type Events = {};

export const coreConfig = createCoreConfig<Config, Events>('my-framework', {
  config: {},
});

export const { createPlugin, createCore } = coreConfig;
```

**src/index.ts** — Template with:
```typescript
import { createCore, coreConfig } from './config';

const framework = createCore(coreConfig, {
  plugins: [],
});

export const { createApp, createPlugin } = framework;
```

### Step 5: Install Dependencies

Run `bun install` and verify no errors.

### Step 6: Verify Setup

Run `bun run lint` and `bun run test` to verify everything works. Fix any issues.

### Step 7: Report

Tell the user what was created and provide next steps:
- Edit `src/config.ts` to define Config and Events types
- Create plugins in `src/plugins/`
- Use `/moku:plan_framework` to plan a complete framework
- Use `/moku:build_plugin` to create individual plugins

## Important

- Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md` for exact config contents — do NOT guess versions
- Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/architecture.md` for architecture reference
- Use `bun` as the package manager, never npm or yarn
- Ensure all configs work correctly together before reporting success
- Check for latest stable versions of dependencies and use them if newer than the reference
