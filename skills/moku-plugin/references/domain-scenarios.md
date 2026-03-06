# Domain Scenario Layouts

## Utility Plugins
Formatters, validators, helpers. Pure functions, no state, no lifecycle.

**Tier: Nano or Micro.**

```typescript
export const formatPlugin = createPlugin('format', {
  config: { locale: 'en-US', currency: 'USD' },
  api: (ctx) => ({
    date: (d: Date) => d.toLocaleDateString(ctx.config.locale),
    currency: (n: number) => n.toLocaleString(ctx.config.locale, {
      style: 'currency', currency: ctx.config.currency,
    }),
  }),
});
```

If a "utility" plugin needs subdirectories, it is not a utility — it is a feature plugin.

## CLI Plugins
Commands, argument parsing, output formatting. Distinct concerns benefit from separation.

**Tier: Standard.**

```
plugins/cli/
  index.ts, types.ts, state.ts, api.ts
  commands/
    help.ts, version.ts
  __tests__/
```

Single command → Micro. 2+ commands with option schemas → Standard with `commands/`.

## Build Plugins
Bundling, compilation, transforms, asset processing.

**Tier: Standard (single-concern) or Complex (multi-phase pipeline).**

Single-concern: `plugins/typescript/` — `index.ts`, `types.ts`, `state.ts`, `api.ts`

Multi-phase: `plugins/bundler/` — adds `transforms/` subdirectory with `typescript.ts`, `css.ts`, `assets.ts`, `types.ts`

Build plugins benefit from `transforms/` or `phases/` subdirectory. Each transform is a pure function testable independently.

## Web / Backend Plugins
HTTP server, middleware, routing, auth, database. Almost always need `onStart` (open connections) and `onStop` (close them).

**Tier: Standard.**

```typescript
export const httpPlugin = createPlugin('http', {
  events: register => register.map<HttpEvents>({
    'http:request': 'Incoming HTTP request',
    'http:response': 'Outgoing HTTP response',
  }),
  config: { port: 3000, host: 'localhost' },
  createState: createHttpState,
  api: createHttpApi,
  onStart: async (ctx) => {
    await ctx.state.server.listen(ctx.config.port, ctx.config.host);
  },
  onStop: async () => { /* Close server */ },
});
```

Database: `plugins/db/` — `index.ts`, `types.ts`, `state.ts` (connection pool), `api.ts` (query, migrate, transaction)

## SPA Plugins
Client routing, head management, progress bar, component lifecycle, store, hydration.

**Tier: Very Complex (multiple coordinating SPA concerns).**

SPA features share a domain — navigation events, page transitions, component mounting — and should be one plugin with sub-modules, not scattered across separate plugins.

```
plugins/spa/
  index.ts           # Wiring harness. One createPlugin call.
  types.ts           # SpaConfig, SpaState, SpaEvents, SpaCtx
  head/api.ts        # updateHead
  progress/state.ts, progress/api.ts  # start, done
  components/types.ts, components/state.ts, components/api.ts  # createComponent, scanAndMount
  router/types.ts, router/state.ts, router/api.ts  # createRouter, extractPageData
  __tests__/
```

Consumer uses namespaced API: `app.spa.head.updateHead()`, `app.spa.router.createRouter()`, `app.spa.components.createComponent()`.

If a project has separate `spaHead`, `spaProgress`, `spaRouter`, `components` plugins — they should be merged into one `spa` Very Complex plugin.

## SSG Plugins
Static site generation, content loading, template rendering.

**Tier: Standard (renderer) or Complex (content pipeline).**

Content pipeline:
```
plugins/content/
  index.ts, types.ts, state.ts, api.ts
  loaders/
    markdown.ts, yaml.ts, types.ts
  __tests__/
```

## Middleware Pattern

Not built into the kernel. Plugins implement internally:

```typescript
const httpPlugin = createPlugin('http', {
  createState: () => ({ middlewares: [] as Function[] }),
  api: (ctx) => ({
    use: (fn: Function) => { ctx.state.middlewares.push(fn); },
    handle: async (req: any) => {
      let result = req;
      for (const mw of ctx.state.middlewares) result = await mw(result);
      return result;
    },
  }),
});

const authPlugin = createPlugin('auth', {
  depends: [httpPlugin],
  onInit: (ctx) => {
    ctx.require(httpPlugin).use((req: any) => ({ ...req, user: 'authenticated' }));
  },
});
```

Explicit, debuggable, doesn't add concepts to the kernel.
