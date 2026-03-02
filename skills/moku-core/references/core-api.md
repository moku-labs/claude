# Core API Reference

## Package Entry Point

```typescript
// @moku-labs/core
export { createCoreConfig } from './config';
export type { PluginCtx } from './types';   // Domain context type for extracted files
export type { EmitFn } from './utilities';   // Emit overload builder
```

## createCoreConfig

```typescript
function createCoreConfig<
  Config extends Record<string, unknown>,
  Events extends Record<string, unknown> = Record<string, never>,
>(
  id: string,
  options: { config: Config },
): {
  createPlugin: BoundCreatePluginFunction<Config, Events>;
  createCore: BoundCreateCoreFunction<Config, Events>;
};
```

- `Config` — global config shape (framework author defines)
- `Events` — event map (defaults to `Record<string, never>`, meaning no events)
- `id` — framework name, used in error messages: `"[moku-site] Duplicate plugin name: router"`
- `options.config` — default values, shallow-merged with consumer overrides

```typescript
// Example: config.ts
import { createCoreConfig } from '@moku-labs/core';

type Config = { siteName: string; mode: 'development' | 'production' };
type Events = {
  'page:render': { path: string; html: string };
  'router:navigate': { from: string; to: string };
};

export const coreConfig = createCoreConfig<Config, Events>('moku-site', {
  config: { siteName: 'Untitled', mode: 'development' },
});
export const { createPlugin, createCore } = coreConfig;
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
function createPlugin(name: string, spec: PluginSpec): PluginInstance;
```

**Zero generics.** All types inferred from the spec object:
- `C` from `config`
- `S` from `createState` return
- `A` from `api` return
- `PluginEvents` from `events` register callback

Reserved names (throw TypeError): `start`, `stop`, `emit`, `require`, `has`, `config`, `__proto__`, `constructor`, `prototype`

## The App Type

```typescript
type App<Config, Events, P extends PluginInstance> = {
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<void>;
  readonly emit: EmitFunction<Events>;
  readonly require: RequireFunction;
  readonly has: HasFunction;
} & BuildPluginApis<P>;
```

- App is frozen after creation
- Plugin APIs mounted directly: `app.router`, `app.blog`, etc.
- `start()` throws on second call
- `stop()` throws if `start()` not called

## Public Type Utilities

| Export | Purpose | Used by |
|--------|---------|---------|
| `PluginCtx<C, S, E>` | Domain context type with auto-generated emit overloads | Standard+ tier plugin `types.ts` files |
| `EmitFn<E>` | Emit overload builder from event map | Advanced composition when `PluginCtx` is too opinionated |
