---
description: Build a consumer application from a plan specification
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
argument-hint: [plan-path]
---

Build a complete Layer 3 (consumer) application from a specification plan. The plan path (`$1`) defaults to `.planning/app-spec.md` if not provided.

## Process

### Step 1: Read and Validate the Plan

Read the specification from the provided path. Verify it contains:
- Framework reference
- Plugin composition (ordered list)
- Configuration (global + per-plugin)
- Custom plugin specs (if any)
- Entry point structure

If the plan is incomplete, ask the user to run `/moku:plan_app` first.

### Step 2: Verify Framework

Check that the framework package is available:
- Read the framework's exports (createApp, createPlugin)
- Verify all referenced plugins exist
- Verify config types match

### Step 3: Build Custom Plugins

If the plan includes custom consumer-side plugins, build each one:
- Follow the same process as `/moku:build_plugin`
- Each plugin must follow `specification/15-PLUGIN-STRUCTURE`
- Full JSDoc, unit tests, integration tests

### Step 4: Create Entry Point

Write `src/main.ts` (or the specified entry file):

```typescript
import { createApp, createPlugin } from 'framework-name';
// Import optional/consumer plugins
import { customPlugin } from './plugins/custom';

const app = createApp({
  plugins: [customPlugin],
  config: {
    // Global config overrides from spec
  },
  pluginConfigs: {
    // Per-plugin configs from spec
  },
  onReady: (ctx) => {
    // Setup code from spec
  },
});

await app.start();

// Application logic from spec
```

### Step 5: Validate

- Run `bun run lint` — fix any issues
- Run `bun run test` — fix any test failures
- Use **moku-spec-validator** agent on all source files
- Use **moku-plugin-spec-validator** agent on custom plugins
- Use **moku-jsdoc-validator** agent on all source files

### Step 6: Report

Summarize what was built:
- Custom plugins created
- Entry point structure
- Test results
- Any issues found and fixed

## Large Application Handling

If the application has many custom plugins:

1. Build plugins in order of dependencies
2. After each batch of 3-5 plugins, validate
3. If context is getting large, tell the user:
   > "I've completed [N] custom plugins and the base setup. To continue, please clear the context and run `/moku:build_app [plan-path]` again."
4. When resuming, detect existing files and continue

## Quality Requirements

- Full JSDoc on ALL custom source files
- `import type` for type-only imports
- NEVER import from `@moku-labs/core` — only from the framework
- All tests must pass
- Biome and ESLint must pass
- Custom plugins follow the same quality standards as framework plugins

## Web Application

If the application is a web app (uses TSX, CSS, or web technologies), additionally enforce the **moku-web** skill patterns:
- Preact components with `data-*` attributes (no CSS classes in markup)
- CSS with `@scope` and `@layer`
- Island architecture for client-side interactivity
- Two-layer design token system
- Bundle size targets (JS < 8KB, CSS < 10KB gzipped)
