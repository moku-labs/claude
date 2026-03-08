# Core API Reference

## Package Entry Point

```typescript
// @moku-labs/core
export { createCoreConfig } from './config';
export { createCorePlugin } from './core-plugin';
export type { PluginCtx } from './types';   // Domain context type for extracted files
export type { EmitFn } from './utilities';   // Emit overload builder
// Framework-facing types (required for declaration emit)
export type { CorePluginInstance, AnyCorePluginInstance, CoreApisFromTuple } from './core-plugin';
```

## createCorePlugin

```typescript
function createCorePlugin<
  const N extends string,
  C extends Record<string, unknown> = Record<string, never>,
  S = Record<string, never>,
  A extends Record<string, any> = Record<string, never>,
>(
  name: N,
  spec: CorePluginSpec<C, S, A>,
): CorePluginInstance<N, C, S, A>;
```

Core plugins are self-contained infrastructure. **NO** `depends`, `events`, or `hooks`.

`CorePluginSpec` shape:
- `config?` — default config values (overridable via `pluginConfigs`)
- `createState?` — factory for mutable state, receives `{ config }` only
- `api?` — API factory, receives `{ config, state }`, returned object injected on every regular plugin's context
- `onInit?` — sync, called after core plugin APIs are built
- `onStart?` — async, called before regular plugins start
- `onStop?` — async, called after regular plugins stop

Reserved names (throw TypeError): same as regular plugins plus `global`, `state`

```typescript
import { createCorePlugin } from '@moku-labs/core';

const logPlugin = createCorePlugin("log", {
  config: { level: "info" as "info" | "debug" | "error" },
  createState: () => ({ entries: [] as string[] }),
  api: ctx => ({
    info: (msg: string) => { ctx.state.entries.push(msg); console.log(msg); },
    error: (msg: string) => { ctx.state.entries.push(msg); console.error(msg); },
  }),
});
```

## createCoreConfig

```typescript
function createCoreConfig<
  Config extends Record<string, unknown>,
  Events extends Record<string, unknown> = Record<string, never>,
  const CorePlugins extends readonly AnyCorePluginInstance[] = readonly [],
>(
  id: string,
  options: {
    config: Config;
    plugins?: [...CorePlugins];
    pluginConfigs?: { [K in CorePlugins[number] as ExtractCoreName<K>]?: Partial<ExtractCoreConfig<K>> };
  },
): {
  createPlugin: BoundCreatePluginFunction<Config, Events, CoreApisFromTuple<CorePlugins>>;
  createCore: BoundCreateCoreFunction<Config, Events, CorePlugins>;
};
```

- `Config` — global config shape (framework author defines)
- `Events` — event map (defaults to `Record<string, never>`, meaning no events)
- `id` — framework name, used in error messages: `"[moku-site] Duplicate plugin name: router"`
- `options.config` — default values, shallow-merged with consumer overrides
- `options.plugins` — core plugin instances (self-contained infrastructure)
- `options.pluginConfigs` — config overrides for core plugins (typed per core plugin name)

```typescript
// Example: config.ts
import { createCoreConfig, createCorePlugin } from '@moku-labs/core';

const envPlugin = createCorePlugin("env", {
  config: { nodeEnv: "development" as string },
  api: ctx => ({ isDev: () => ctx.config.nodeEnv === "development" }),
});

type Config = { siteName: string; mode: 'development' | 'production' };
type Events = {
  'page:render': { path: string; html: string };
  'router:navigate': { from: string; to: string };
};

export const coreConfig = createCoreConfig<Config, Events>('moku-site', {
  config: { siteName: 'Untitled', mode: 'development' },
  plugins: [envPlugin],
  pluginConfigs: { env: { nodeEnv: 'production' } },
});
export const { createPlugin, createCore } = coreConfig;
// createPlugin context now includes ctx.env.isDev() — fully typed
```

## createCore

```typescript
function createCore(
  coreConfig: { readonly createPlugin: BoundCreatePluginFunction<Config, Events> },
  options: {
    plugins: PluginInstance[];
    pluginConfigs?: Record<string, unknown>;
    onReady?: (ctx: { config: Readonly<Config> }) => void;
    onError?: (error: Error) => void;
  },
): {
  createApp: CreateAppFn<Config, Events, DefaultPlugins>;
  createPlugin: BoundCreatePluginFunction<Config, Events>;
};
```

- `options.plugins` — default plugins that ship with the framework (consumer cannot remove)
- `options.pluginConfigs` — default config overrides for framework plugins
- `options.onReady` — optional callback after all plugins init
- `options.onError` — optional error handler for hook dispatch errors

```typescript
// Example: index.ts
import { createCore, coreConfig } from './config';
import { routerPlugin } from './plugins/router';

const framework = createCore(coreConfig, {
  plugins: [routerPlugin],
  pluginConfigs: { router: { basePath: '/app' } },
});
export const { createApp, createPlugin } = framework;
```

## createApp

```typescript
function createApp(
  options?: {
    plugins?: PluginInstance[];
    config?: Partial<Config>;
    pluginConfigs?: { [pluginName: string]?: Partial<PluginConfig> };
    onReady?: (context: AppCallbackContext) => void;
    onError?: (error: Error, context: AppCallbackContext) => void;
    onStart?: (context: AppCallbackContext) => void | Promise<void>;
    onStop?: (context: AppCallbackContext) => void | Promise<void>;
  },
): App<Config, Events, AllPlugins>;
```

- Returns `App` (synchronous). All init runs during the call.
- Final plugin list: `[...frameworkDefaults, ...consumerExtras]`
- Consumer callbacks are additive to framework-level callbacks

## createPlugin

```typescript
function createPlugin(name: string, spec: PluginSpec): PluginInstance & Helpers;
```

**Zero generics.** All types inferred from the spec object:
- `C` from `config`
- `S` from `createState` return
- `A` from `api` return
- `PluginEvents` from `events` register callback
- `Helpers` from `helpers` object (defaults to `Record<never, never>` when absent)

When `helpers` is present, its functions are spread onto the return value. Consumers call `plugin.route(...)` before `createApp`. The `& Helpers` intersection widens away in constraint positions (`AnyPluginInstance`, `depends`, `plugins` arrays).

Reserved names (throw TypeError): `start`, `stop`, `emit`, `require`, `has`, `config`, `__proto__`, `constructor`, `prototype`
Helper reserved names (throw TypeError): `name`, `spec`, `_phantom`

## The App Type

```typescript
type App<Config, Events, P extends PluginInstance, CoreApis = {}> = {
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<void>;
  readonly emit: EmitFunction<Events>;
  readonly require: RequireFunction;
  readonly has: HasFunction;
} & BuildPluginApis<P> & { readonly [K in keyof CoreApis]: CoreApis[K] };
```

- App is frozen after creation
- Plugin APIs mounted directly: `app.router`, `app.blog`, etc.
- Core plugin APIs also mounted: `app.log`, `app.env`, etc.
- `start()` throws on second call
- `stop()` throws if `start()` not called

## Public Type Utilities

| Export | Purpose | Used by |
|--------|---------|---------|
| `PluginCtx<C, S, E>` | Domain context type with auto-generated emit overloads | Standard+ tier plugin `types.ts` files |
| `EmitFn<E>` | Emit overload builder from event map | Advanced composition when `PluginCtx` is too opinionated |
