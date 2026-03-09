# Plugin Patterns Reference

## Plugin = Connection Point

The plugin file is the **map**. The domain files are the **territory.** An LLM reads the map (fast, ~30 lines) and navigates to the right domain file (precise, targeted).

If all code is in the plugin file, the LLM must read everything to find where to change. With the connection point pattern, the LLM reads the index, identifies the relevant domain file, and edits only that file.

## Three-Layer Complete Example

### Layer 2: Framework config.ts (Step 1)
```typescript
import { createCoreConfig } from '@moku-labs/core';

type Config = {
  siteName: string;
  description?: string;
  mode: 'development' | 'production';
};

type Events = {
  'page:render':     { path: string; html: string };
  'page:error':      { path: string; error: Error };
  'router:navigate': { from: string; to: string };
};

export const coreConfig = createCoreConfig<Config, Events>('moku-site', {
  config: { siteName: 'Untitled', mode: 'development' },
});
export const { createPlugin, createCore } = coreConfig;
```

### Layer 2: Framework plugin
```typescript
// plugins/router/index.ts
import { createPlugin } from '../../config';

export const router = createPlugin('router', {
  config: { basePath: '/' },
  createState: () => ({ currentPath: '/' }),
  api: (ctx) => ({
    navigate: (path: string) => {
      ctx.state.currentPath = path;
      void ctx.emit('router:navigate', { from: '/', to: path });
    },
    current: () => ctx.state.currentPath,
  }),
});
```

### Layer 2: Framework index.ts (Step 2)
```typescript
import { createCore, coreConfig } from './config';
import { router } from './plugins/router';
import { renderer } from './plugins/renderer';

const framework = createCore(coreConfig, {
  plugins: [router, renderer],
});
export const { createApp, createPlugin } = framework;
```

### Layer 3: Consumer
```typescript
import { createApp, createPlugin } from 'my-framework';

const blog = createPlugin('blog', {
  config: { postsPerPage: 10 },
  api: (ctx) => ({ listPosts: () => ['post1', 'post2'] }),
});

const app = createApp({
  plugins: [blog],
  config: { siteName: 'My Blog', mode: 'production' },
  pluginConfigs: { blog: { postsPerPage: 5 } },
});

await app.start();
app.router.navigate('/about');  // typed — framework default
app.blog.listPosts();           // typed — consumer plugin
await app.stop();
```

### Layer 3: Custom Plugin
```typescript
// plugins/contact-form/index.ts
import { createPlugin } from 'my-framework';
import { createContactFormApi } from './api';

export const contactForm = createPlugin('contactForm', {
  depends: [renderer],
  api: createContactFormApi,
  hooks: (ctx) => ({
    'page:render': (payload) => { /* framework typed */ },
  }),
});
```

## Key Rules

1. **Never import from @moku-labs/core in consumer code.** Only import from the framework.
2. **Never put > 50 lines of logic in plugin index.ts.** Domain code in separate files.
3. **Never create new abstractions** (services, providers, managers). Use `createPlugin`.
4. **Plugin index.ts is a CONNECTION POINT.** Imports + wiring only.
5. **`createApp()` is synchronous.** Do not `await` it; use `start()` only if the app has a distinct runtime phase.
6. **Use `ctx.require(pluginInstance)` for dependencies.** Not strings.
7. **Use `ctx.has('name')` for optional deps.** Boolean check, never throws.
8. **Helpers are static pure functions.** No `ctx`, no lifecycle, no side effects. They produce typed values for `pluginConfigs`.

## Plugin Export Architecture

Frameworks use a two-level export system: a plugin barrel (`src/plugins/index.ts`) and a self-documenting framework entry (`src/index.ts`).

### Plugin Barrel: `src/plugins/index.ts`

Central file that re-exports all plugin instances, helpers, and namespaced types:

```typescript
/**
 * Plugin barrel — all default plugin instances, helpers, and namespaced types.
 * @module
 */

// ─── Plugin Instances ───────────────────────────────────────
export { build } from "./build";
export { env } from "./env";
export { router } from "./router";
export { seo } from "./seo";
export { spa } from "./spa";

// ─── Helpers ────────────────────────────────────────────────
export { route } from "./router";           // builder helper (not the plugin)
export { createComponent } from "./spa";

// ─── Namespaced Types ───────────────────────────────────────
export type * as Build from "./build/types";
export type * as Router from "./router/types";
export type * as Seo from "./seo/types";
export type * as Spa from "./spa/types";
```

**Rules:**
- Each plugin directory exports exactly ONE `createPlugin` instance
- Helpers are in a separate section from plugin instances
- Types use `export type * as Namespace from` (TS 5.0+) for clean namespace grouping
- Only Standard+ plugins with `types.ts` get namespace type exports

### Package.json Subpath Exports

Expose the barrel as a subpath so consumers can import plugins independently:

```json
{
  "exports": {
    ".": { "import": "./dist/index.mjs", "require": "./dist/index.cjs" },
    "./plugins": { "import": "./dist/plugins/index.mjs", "require": "./dist/plugins/index.cjs" }
  }
}
```

Consumer usage:
```typescript
import { createApp } from "@moku-labs/web";
import { router, route, type Router } from "@moku-labs/web/plugins";

const home = route("/");
const app = createApp({ pluginConfigs: { router: { routes: [home] } } });
// Router.RouteDefinition, Router.RouteMatch — namespaced types
```

### Verification

- Every plugin in `createCore`'s plugins array is re-exported from `src/plugins/index.ts`
- Each plugin directory exports exactly ONE `createPlugin` call
- No plugin imports in `src/index.ts` go directly to plugin directories (use barrel)
- `package.json` has `./plugins` subpath export

## Helpers Pattern (Pre-createApp Factory Functions)

When a plugin needs to provide typed builder/factory functions that consumers call before `createApp`:

```typescript
// Framework plugin:
export const router = createPlugin('router', {
  config: { routes: [] as Route[] },
  helpers: {
    route: (path: string, component: string): Route => ({ path, component }),
  },
});

// Consumer:
const home = router.route('/home', 'HomePage');  // typed, autocomplete
const app = createApp({
  pluginConfigs: { router: { routes: [home] } },
});

// Destructuring also works:
const { route } = router;  // types preserved
```

**Design constraints:**
- Helpers have NO access to `ctx` — they run before the kernel
- Each helper value must be a function
- Helper names must not collide with `name`, `spec`, `_phantom`
- Return type is `PluginInstance<...> & Helpers` — intersection widens away in constraints
- For Standard+ plugins, extract helpers to `helpers.ts`
