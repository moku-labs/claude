# Build: Framework Assembly Patterns (Step 4b Details)

This file defines the canonical patterns for `src/plugins/index.ts` (barrel) and `src/index.ts` (framework entry point). Referenced from `build-verification.md` Step 4b.

## Step 4b-barrel: `src/plugins/index.ts` Structure

Two-section barrel. Plugin instances first, types second. **No helpers.**

```typescript
/**
 * Plugin barrel — re-exports all framework plugin instances and types.
 * Helpers are NOT exported here — see src/index.ts.
 */

// ─── Plugin Instances ────────────────────────────────────────
export { build } from "./build";
export { router } from "./router";
export { seo } from "./seo";
// ... one line per plugin, alphabetical

// ─── Plugin Types ─────────────────────────────────────────────
export type * from "./build/types";
export type * from "./router/types";
export type * from "./seo/types";
// ... one line per plugin that has types.ts, alphabetical
// Exception: plugins with no types.ts → explicit export type { Foo } from "./plugin"
// Plugins with no public types (thin Nano/Micro) → no entry
```

Rules:
- **Plugin Instances** section: one `export { name }` per plugin, alphabetical
- **Plugin Types** section: `export type * from "./plugin/types"` per plugin, alphabetical
- **NEVER list individual type names** — use `export type *` to avoid maintenance burden
- **NEVER export helpers** (builders, factories) from the barrel — they belong in `src/index.ts`

## Step 4b-index: `src/index.ts` Self-Documenting Manifest

Import plugin instances from the barrel (no circular dep: barrel → plugin dirs → `../../config`, never back to `src/index.ts`). `createCore` includes explicit `pluginConfigs` — single visible source of truth for framework defaults.

```typescript
/**
 * [Framework name] — [brief description].
 * @module
 */
import { coreConfig, createCore } from "./config";
import { build, router, seo, spa } from "./plugins"; // from barrel, not individual dirs

const framework = createCore(coreConfig, {
  plugins: [seo, router, spa, build],
  // Framework default plugin configuration.
  // Consumer apps override specific values via createApp({ pluginConfigs: { ... } }).
  pluginConfigs: {
    router: {
      /**
       * Rendering mode for the framework.
       *
       * - `"ssg"` — every page pre-rendered at build; no client-side router
       * - `"spa"` — client-side only; pages rendered by JS on demand; requires `boot()`
       * - `"hybrid"` — pages pre-rendered + client router for subsequent navigation (recommended)
       */
      mode: "hybrid",
      /**
       * Page rendered when no route matches. Relative to content dir.
       *
       * @example "" // 404.html generated from content dir root
       * @example "src/pages/404.astro"
       */
      defaultPage: "",
      // ... every property gets a JSDoc comment with description, allowed values, and @example for complex types
    },
    build: {
      /**
       * Output directory for the static build, relative to project root.
       *
       * @example "dist"
       * @example "public"
       */
      output: "dist",
      // ...
    },
    // ... all plugins with non-trivial config
  }
});

// ─── Plugins + Types ──────────────────────────────────────────
export * from "./plugins";

// ─── Framework API + Plugin Helpers ──────────────────────────
export const { createApp, createPlugin } = framework;
export { route } from "./plugins/router";         // builder helper, explicitly named
// ... all consumer-facing helpers explicitly named, no export * for helpers
```

Rules:
- Import plugin instances from `"./plugins"` barrel, never from individual plugin dirs
- `createCore` MUST include `pluginConfigs` with ALL non-trivial plugin defaults documented
- Every config property MUST have a JSDoc comment (`/** ... */`) with: description, allowed values as a list, and `@example` for complex or non-obvious values
- `export * from "./plugins"` covers all instances + types in one line — no separate types section needed
- `createApp` and `createPlugin` always live in the `// ─── Framework API + Plugin Helpers` section
- Every helper is explicitly named — no `export *` for helpers
