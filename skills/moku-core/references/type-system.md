# Type System Reference

## Design Philosophy

Types flow through closures, not explicit generics:
- `createCoreConfig<Config, Events>` captures the global contract
- `createPlugin(name, spec)` infers everything from the spec
- `createCore(coreConfig, { plugins })` captures plugin instances
- `createApp(options)` returns `App` with full type inference

## Plugin Instance Type (Internal)

```typescript
interface PluginInstance<N, C, S, A, PluginEvents> {
  readonly name: N;
  readonly spec: PluginSpec<...>;
  readonly _phantom: { config: C; state: S; api: A; events: PluginEvents };
}
```

All inferred. `_phantom` carries generics through the type system, never accessed at runtime. `PluginEvents` defaults to `{}` (identity element for intersection, unlike `Record<string, never>` which poisons intersections).

## Type-Level Helpers

```typescript
type ExtractName<P>   // Get name literal from PluginInstance
type ExtractConfig<P> // Get config type
type ExtractApi<P>    // Get API type
type ExtractEvents<P> // Get events type
type IsLiteralString<S extends string> // Detect literal vs general string
type UnionToIntersection<U> // Convert union to intersection
type DepsEvents<Deps> // Intersect all PluginEvents from a depends tuple
```

## BuildPluginApis

Maps each plugin in the union to a property on the app:

```typescript
type BuildPluginApis<P extends PluginInstance> = {
  [K in P as <filtering conditions>]: ExtractApi<K>;
};
```

Excludes: plugins with empty API (`Record<string, never>`), plugins with non-literal name (prevents index signature pollution).

Result: `{ router: RouterApi; logger: LoggerApi; }`

## pluginConfigs Mapped Type

```typescript
pluginConfigs?: {
  [K in P as <conditions>]?: Partial<ExtractConfig<K>>;
};
```

Excludes plugins with no config or non-literal names. All included get optional `Partial<C>`.

## Full Type Flow

```
createCoreConfig<Config, Events>(id, { config })
  ↓ Captures Config + Events in closure
createPlugin(name, spec)
  ↓ Infers N, C, S, A, PluginEvents from spec
createCore(coreConfig, { plugins })
  ↓ Captures plugin union type
createApp({ plugins?, config?, pluginConfigs? })
  ↓ AllPlugins = framework + consumer plugins
App<Config, Events, AllPlugins>
  ↓ BuildPluginApis maps plugin names → APIs
app.router.navigate('/about')  // fully typed, zero casts
```

## EmitFn and PluginCtx

For Standard+ plugins extracting domain logic:

```typescript
// PluginCtx — auto-generates emit overloads from event map
import type { PluginCtx } from '@moku-labs/core';
export type AuthCtx = PluginCtx<AuthConfig, AuthState, AuthEvents>;

// EmitFn — for custom composition
import type { EmitFn } from '@moku-labs/core';
export type AuthCtx = {
  config: AuthConfig;
  state: AuthState;
  emit: EmitFn<AuthEvents>;
};
```

`EmitFn<E>` uses `UnionToIntersection` to convert per-event function types into overloaded call signatures. This is compatible with the kernel's `EmitFunction<MergedEvents>` and test mocks.
