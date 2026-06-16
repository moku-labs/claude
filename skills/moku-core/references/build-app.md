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

Layer-3 consumer apps author their own plugins for plugin-shaped concerns (a typed `app.<x>.method()` API, custom events, lifecycle, shared state, or a dependency on another plugin). If the plan includes custom plugins, build each one in `src/plugins/{name}/` following the **Plugin Build** process (see `build-plugin.md` reference), importing `createPlugin` from the **framework package** (never `@moku-labs/core`).

Each plugin must follow the moku-plugin skill's complexity tiers. Full JSDoc, unit tests, integration tests.

For multiple custom plugins, use wave analysis (same as framework build) to identify parallel opportunities.

Not every consumer concern is a plugin — pure build-time data access belongs in `lib/`, and client-only DOM behavior belongs in an island (web). See the `consumer-plugins.md` reference for the plugin-vs-`lib`-vs-island decision guide and the Layer-3 wiring rules (no `src/config.ts`; compose via `createApp({ plugins: [...] })`; the `src/plugins/index.ts` barrel is optional at Layer 3).

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
- **moku-readable-code-validator** agent on all source files (readability; WARNING/INFO only — never blocks)

**Parallel Group B:**
- **moku-test-validator** agent on custom plugin tests
- **moku-type-validator** agent (once, whole project)

If BLOCKER issues found, enter gap closure. WARNINGs included in report.

## Step 6: Full-app integration tests (realistic end-to-end)

After validation passes, generate root-level integration tests that exercise the assembled app the
way it will actually run — **realistic real-world task scenarios**, not isolated unit checks. Reuse
the framework integration-test machinery: follow `build-final.md` Step 5.8 (Scenario Planning → Test
Writing → Test Execution), but scope scenarios to THIS app's user journeys: boot the app via
`createApp`, drive the real plugin stack through the flows a user/consumer would actually perform
(e.g. for a web app: load a route → render → navigate → handle an event end-to-end), no mocks.
Tests go to `tests/integration/`. Run `bun run test`; route failures to gap closure (max 2 rounds).

## Step 7: README generation / update

Generate or update the project root `README.md` (and any per-custom-plugin READMEs) now that the app
is built — follow `build-final.md` Step 5.6 (Root README) scoped to an app: what the app is, how to
run it (`bun run dev`/`build`/`start`), its plugin composition + config, entry point, and deployment
notes. If a `README.md` already exists (rebuild/update), refresh the changed sections rather than
overwriting hand-written prose. Run `bun run format`.

## Step 8: CI/CD, deployment & publication (user chooses)

Apps usually ship by **deployment**, not npm publish. Run `build-final.md` Step 5.10 (CI/CD,
Deployment & Publication Wave): present the shipping options with examples via `AskUserQuestion` and
let the user pick where/how to deploy (Cloudflare Pages/Workers, Vercel, Netlify, GitHub Pages,
container) and whether to add PR-validation CI. Recommend a deploy target for app projects. Generate
only the selected workflows, tell the user which repo secrets to add, and validate the YAML.

## Step 9: Report

Summarize what was built:
- Custom plugins created
- Entry point structure
- Validation results
- Integration test count + coverage (Step 7)
- README + CI/CD / deployment generated (Steps 8–9)
- Any issues found and fixed

Update `.planning/STATE.md` with build results.

(Numbering note: validation is Step 5; integration tests / README / CI/CD are Steps 6–8; this Report is the final step.)

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
