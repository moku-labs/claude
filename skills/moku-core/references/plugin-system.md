# Plugin System Reference

## PluginSpec Shape

All fields optional. Types inferred from values.

```typescript
{
  config?: C,                          // Complete defaults. Makes config OPTIONAL for consumer.
  depends?: readonly PluginInstance[],  // Instance-based deps. Validated, not sorted.
  createState?: (ctx: MinimalContext) => S,  // Create mutable state. Only { global, config }.
  api?: (ctx: PluginContext) => A,           // Public API mounted on app.<name>.
  onInit?: (ctx: PluginContext) => void,     // Sync. Forward order during createApp.
  onStart?: (ctx: PluginContext) => void | Promise<void>,  // Forward order during app.start().
  onStop?: (ctx: TeardownContext) => void | Promise<void>,  // REVERSE order during app.stop().
  hooks?: (ctx: PluginContext) => { [K in keyof MergedEvents]?: handler },
  events?: (register: RegisterFn) => { [K: string]: EventDescriptor<T> },
}
```

## The depends Field

Accepts array of plugin instances. At startup:
1. Checks every dependency exists in the registered plugin list
2. Checks every dependency appears BEFORE the dependent plugin
3. Throws clear error if either fails

**What depends enables:**
- `ctx.require(plugin)` — typed API of the dependency
- Typed `hooks` — listen to events declared by dependency plugins
- Typed `ctx.emit` — emit events declared by dependency plugins

**What depends does NOT do:**
- Does NOT auto-reorder plugins (no topological sort)
- Does NOT change execution order
- Dependencies are NOT transitive in the type system

## Event Registration — Register Callback Pattern

```typescript
// Inline registration (simple plugins)
events: (register) => ({
  'auth:login':  register<{ userId: string }>('Triggered after user login'),
  'auth:logout': register<{ userId: string }>('Triggered after user logout'),
})

// Bulk registration (Standard+ plugins with separate types file)
events: register => register.map<AuthEvents>({
  'auth:login':  'Triggered after user login',
  'auth:logout': 'Triggered after user logout',
})
```

**How it works:**
1. `events` receives `register` — a factory function
2. `register<T>(description?)` returns `EventDescriptor<T>` — carries phantom type T + description
3. TypeScript infers the event map from the return type
4. Kernel extracts `T` from each `EventDescriptor<T>` for the typed event map
5. The callback is NEVER called at runtime — compile-time type inference only

**Event visibility:**
| Source | Who sees it |
|--------|------------|
| Global Events (createCoreConfig) | All plugins |
| Own PluginEvents (events callback) | This plugin |
| Dependency Events (depends chain) | Plugins that declare the dependency |

Merged map: `Events & PluginEvents & DepsEvents<Deps>`

## Plugin Examples

### Zero events (most common)
```typescript
export const routerPlugin = createPlugin('router', {
  config: { basePath: '/', notFoundRedirect: '/404' },
  createState: () => ({ currentPath: '/', history: [] as string[] }),
  api: (ctx) => ({
    navigate: (path: string) => {
      ctx.state.history.push(ctx.state.currentPath);
      ctx.state.currentPath = path;
      ctx.emit('router:navigate', { from: ctx.state.history.at(-1)!, to: path });
    },
    current: () => ctx.state.currentPath,
  }),
});
```

### With events
```typescript
export const authPlugin = createPlugin('auth', {
  events: (register) => ({
    'auth:login':  register<{ userId: string }>('After login'),
    'auth:logout': register<{ userId: string }>('After logout'),
  }),
  api: ctx => ({
    login: (userId: string) => { ctx.emit('auth:login', { userId }); },
  }),
});
```

### With depends
```typescript
export const seoPlugin = createPlugin('seo', {
  depends: [routerPlugin, rendererPlugin],
  api: (ctx) => ({
    setTitle: (title: string) => {
      const path = ctx.require(routerPlugin).current();
      void ctx.emit('renderer:render', { path, html: `<title>${title}</title>` });
    },
  }),
});
```

## Core Plugins

Core plugins are self-contained infrastructure plugins whose APIs are injected directly onto every regular plugin's context (`ctx.<name>`). Created with `createCorePlugin` (separate from `createPlugin`).

### CorePluginSpec Shape

```typescript
{
  config?: C,                                        // Default config values
  createState?: (ctx: { config: Readonly<C> }) => S, // Mutable state factory
  api?: (ctx: CorePluginContext<C, S>) => A,         // API injected on regular plugin context
  onInit?: (ctx: CorePluginContext<C, S>) => void,   // After API is built
  onStart?: (ctx: CorePluginContext<C, S>) => void | Promise<void>,  // Before regular plugins start
  onStop?: (ctx: CorePluginContext<C, S>) => void | Promise<void>,   // After regular plugins stop
  // NO depends, events, hooks — core plugins are self-contained
}
```

`CorePluginContext` = `{ readonly config: Readonly<C>; state: S }` — no global, emit, require, has.

### When to Use Core vs Regular

- **Core:** Self-contained infrastructure (log, env, storage), provides utility API used by many plugins, needs NO events/hooks/depends
- **Regular:** Domain-specific, needs events or hooks, depends on other plugins, uses emit

### Core Plugin Example

```typescript
import { createCorePlugin } from '@moku-labs/core';

export const logPlugin = createCorePlugin("log", {
  config: { level: "info" as "info" | "debug" | "error" },
  createState: () => ({ entries: [] as string[] }),
  api: ctx => ({
    info: (msg: string) => { ctx.state.entries.push(msg); console.log(msg); },
    error: (msg: string) => { ctx.state.entries.push(msg); console.error(msg); },
  }),
});

// Regular plugins access it as ctx.log.info("...") — fully typed
```

### Core Plugin Config

4-level cascade (all shallow merge): spec defaults → `createCoreConfig pluginConfigs` → `createCore pluginConfigs` → `createApp pluginConfigs`

## Domain Context Utilities

For Standard+ plugins extracting domain logic into separate files:

```typescript
// plugins/auth/types.ts
import type { PluginCtx } from '@moku-labs/core';

export type AuthEvents = {
  'auth:login':  { userId: string };
  'auth:logout': { userId: string };
};

export type AuthCtx = PluginCtx<AuthConfig, AuthState, AuthEvents>;
```

`PluginCtx` auto-generates overloaded emit call signatures from the event map. For custom composition, use `EmitFn<E>` directly.
