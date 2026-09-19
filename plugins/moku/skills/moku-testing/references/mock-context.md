# Mock Context Factory Pattern

> Type source of truth: `@moku-labs/core` exports exactly **two** type utilities for plugin
> authors — `PluginCtx<C, S, E>` and `EmitFn<E>`. The lifecycle tier types (`MinimalContext`,
> `TeardownContext`, the internal `PluginContext`) are NOT exported; they flow through
> inference. Tests therefore type mocks with `PluginCtx` (via the plugin's own `types.ts`
> alias) and with small **local structural types** for the other tiers.
> Canonical exemplars: `skills/moku-core/references/sandbox/plugins/router/__tests__/unit/api.test.ts`
> and `…/analytics/__tests__/unit/api.test.ts`.

## Standard Factory (domain api/handlers tests)

The plugin's `types.ts` already aliases its domain context:

```typescript
// types.ts
import type { PluginCtx } from "@moku-labs/core";

export type RouterCtx = PluginCtx<RouterConfig, RouterState, RouterEvents>;
// => { readonly config: Readonly<RouterConfig>; state: RouterState; emit: <overloaded from RouterEvents> }
```

Every domain unit-test file defines a mock factory for that alias at the top:

```typescript
import { vi } from "vitest";
import type { RouterCtx, RouterState } from "../types";

/** Creates a test mock context with sensible defaults and optional overrides. */
const createMockCtx = (overrides?: Partial<RouterCtx>): RouterCtx => {
  const state: RouterState = {
    currentPath: "/",
    history: [],
    guards: [],
    initialized: false,
    ...overrides?.state
  };

  return {
    config: { basePath: "/", notFoundPath: "/404", ...overrides?.config },
    state,
    emit: overrides?.emit ?? vi.fn()
  };
};
```

`PluginCtx` carries exactly `config`, `state`, `emit` — nothing else. If a domain file
genuinely needs `require`, it composes its own structural context type around `EmitFn<E>`
(see the `PluginCtx` JSDoc in core); mock that local type the same way.

## Minimal-context factory (for createState tests)

`createState` runs before inter-plugin communication exists — its tier has only `global`
and `config`. Core does not export this tier type, so the plugin's `state.ts` declares a
local structural type with the fields it actually reads (sandbox: `router/state.ts`), and
the test mirrors it:

```typescript
// state.ts
type StateCtx = {
  config: { basePath: string };
};

export const createRouterState = (ctx: StateCtx): RouterState => ({ /* … */ });

// __tests__/unit/state.test.ts
const createStateCtx = (overrides?: Partial<StateCtx>): StateCtx => ({
  config: { basePath: "/", ...overrides?.config }
});
```

Add `global` to the structural type only when `createState` reads the frozen global config.

## Teardown-context factory (for onStop tests)

`onStop` receives only the frozen global config. Same approach — a local structural type:

```typescript
type StopCtx = {
  global: Readonly<Record<string, unknown>>;
};

const createStopCtx = (overrides?: Partial<StopCtx>): StopCtx => ({
  global: {},
  ...overrides
});
```

## Rules

1. **Typed overrides**: Factory accepts `Partial<Ctx>` so tests can override only what matters
2. **Sensible defaults**: All fields have reasonable defaults matching the plugin's config shape
3. **Fresh per test**: Call the factory in each `it` block — never share mutable context
4. **Spy on emit**: `emit` defaults to `vi.fn()` (or a recording closure) — assert with
   `expect(ctx.emit).toHaveBeenCalledWith("event:name", payload)`
5. **Only real exports**: Import `PluginCtx`/`EmitFn` types from `@moku-labs/core`; declare
   everything else as local structural types — never invent core exports
6. **No wrong-tier fields**: `PluginCtx` mocks have ONLY `config`/`state`/`emit`; createState
   mocks have NO `emit`/`require`/`has`; onStop mocks have ONLY `global`
