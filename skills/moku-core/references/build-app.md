# App Build — Detailed Steps

## Step 1: Read and Validate the Plan

Read the specification from the provided path (defaults to `.planning/app-spec.md`). Verify it contains:
- Framework reference
- Plugin composition (ordered list)
- Configuration (global + per-plugin)
- Custom plugin specs (if any)
- Entry point structure

If the plan is incomplete, ask the user to run `/moku:plan app` first.

## Step 2: Verify Framework

Check that the framework package is available:
- Read the framework's exports (createApp, createPlugin)
- Verify all referenced plugins exist
- Verify config types match

## Step 3: Build Custom Plugins

If the plan includes custom consumer-side plugins, build each one following the **Plugin Build** process (see `build-plugin.md` reference).

Each plugin must follow the moku-plugin skill's complexity tiers. Full JSDoc, unit tests, integration tests.

For multiple custom plugins, use wave analysis (same as framework build) to identify parallel opportunities.

## Step 4: Create Entry Point

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

## Step 5: Validate

Run the post-build validation pipeline:

**Parallel Group A:**
- **moku-spec-validator** agent on all source files
- **moku-plugin-spec-validator** agent on custom plugins
- **moku-jsdoc-validator** agent on all source files

**Parallel Group B:**
- **moku-test-validator** agent on custom plugin tests
- **moku-type-validator** agent (once, whole project)

If BLOCKER issues found, enter gap closure. WARNINGs included in report.

## Step 6: Report

Summarize what was built:
- Custom plugins created
- Entry point structure
- Validation results
- Any issues found and fixed

Update `.planning/STATE.md` with build results.

## App Quality Requirements

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
