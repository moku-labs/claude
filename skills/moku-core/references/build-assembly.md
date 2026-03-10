# Build: Framework Assembly Patterns (Step 4b Details)

This file defines the canonical patterns for `src/plugins/index.ts` (barrel) and `src/index.ts` (framework entry point). Referenced from `build-verification.md` Step 4b.

## Step 4b-barrel: `src/plugins/index.ts` Structure

The plugins barrel file is the single source for all plugin instances, helpers, and namespaced types. Create it during the first wave and extend with each subsequent wave:

```typescript
/**
 * Plugin barrel — all default plugin instances, helpers, and namespaced types.
 * @module
 */

// ─── Plugin Instances ───────────────────────────────────────
export { build } from "./build";
export { env } from "./env";
export { router } from "./router";

// ─── Helpers ────────────────────────────────────────────────
export { route } from "./router";           // builder helper (not the plugin)
export { createComponent } from "./spa";

// ─── Namespaced Types ───────────────────────────────────────
export type * as Build from "./build/types";
export type * as Router from "./router/types";
```

Rules:
- Each plugin directory exports exactly ONE `createPlugin` instance
- Helpers are exported separately from plugin instances (with comment clarifying what they are)
- Types use `export type * as Namespace from` for namespace grouping
- Only Standard+ plugins with a `types.ts` get namespace type exports

## Step 4b-index: `src/index.ts` Self-Documenting Structure

The framework entry point must be a self-documenting manifest. Consumers should understand all available options, defaults, and exports just by reading this file.

```typescript
/**
 * @moku-labs/web — Static site generation framework.
 *
 * ## Framework Options
 * | Option | Type | Default | Description |
 * |--------|------|---------|-------------|
 * | site.url | string | "" | Site URL for SEO and feeds |
 * | mode | "ssg" | "spa" | "hybrid" | "ssg" | Rendering mode |
 *
 * ## Default Plugins
 * | Plugin | Description |
 * |--------|-------------|
 * | log | Structured logging |
 * | env | Environment detection |
 * | router | URL pattern matching and resolution |
 *
 * @example
 * ```ts
 * import { createApp } from "@moku-labs/web";
 * const app = createApp({ config: { site: { url: "..." } } });
 * ```
 * @module
 */
import { coreConfig, createCore } from "./config";
import { log, env, router, seo, pipeline, build, devServer } from "./plugins";

const framework = createCore(coreConfig, {
  plugins: [log, env, seo, router, pipeline, build, devServer],
});

// ─── Framework API ──────────────────────────────────────────
export const { createApp, createPlugin } = framework;

// ─── Plugins ────────────────────────────────────────────────
export { build, devServer, env, log, pipeline, router, seo } from "./plugins";

// ─── Helpers ────────────────────────────────────────────────
export { route } from "./plugins/router";
export { createComponent } from "./plugins/spa";

// ─── Types ──────────────────────────────────────────────────
export type * as Build from "./plugins/build/types";
export type * as Router from "./plugins/router/types";
// ... namespace type re-exports from plugins barrel
```

Rules:
- JSDoc module comment with options table showing ALL config fields with types and defaults
- Default plugins table showing what ships with the framework
- `@example` showing minimal createApp usage
- Exports grouped into 4 sections with separator comments: Framework API → Plugins → Helpers → Types
- Plugin imports come from `./plugins` barrel (not individual directories)
- Framework API section: only `createApp` and `createPlugin` from `createCore` result
- Plugins section: re-export all default plugin instances
- Helpers section: re-export builder helpers (e.g., `route`, `createComponent`)
- Types section: namespace type re-exports for consumer convenience
