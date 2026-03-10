# Mock Context Factory Pattern

## Standard Factory

Every plugin test file should define a mock context factory at the top:

```typescript
import { vi } from "vitest";
import type { PluginContext } from "@moku-labs/core";
import type { RouterConfig, RouterState, RouterEvents } from "../types";

type RouterCtx = PluginContext<RouterConfig, RouterState, RouterEvents>;

/** Creates a test mock context with sensible defaults and optional overrides. */
function createMockCtx(overrides: Partial<RouterCtx> = {}): RouterCtx {
  return {
    global: {},
    config: {
      basePath: "/",
      trailingSlash: false,
      ...overrides.config,
    },
    state: {
      currentPath: "/",
      routes: new Map(),
      history: [],
      ...overrides.state,
    },
    emit: vi.fn(),
    require: vi.fn((plugin) => {
      // Return typed mocks for known dependencies
      if (plugin.name === "env") {
        return { get: vi.fn(() => "development"), is: vi.fn(() => true) };
      }
      throw new Error(`Unknown dependency: ${plugin.name}`);
    }),
    has: vi.fn(() => true),
    app: {} as RouterCtx["app"],
    ...overrides,
  };
}
```

## MinimalContext Factory (for createState tests)

```typescript
import type { MinimalContext } from "@moku-labs/core";
import type { RouterConfig } from "../types";

type MinimalCtx = MinimalContext<RouterConfig>;

function createMinimalCtx(overrides: Partial<MinimalCtx> = {}): MinimalCtx {
  return {
    global: {},
    config: {
      basePath: "/",
      trailingSlash: false,
      ...overrides.config,
    },
    ...overrides,
  };
}
```

## TeardownContext Factory (for onStop tests)

```typescript
import type { TeardownContext } from "@moku-labs/core";

function createTeardownCtx(overrides: Partial<TeardownContext> = {}): TeardownContext {
  return {
    global: {},
    ...overrides,
  };
}
```

## Rules

1. **Typed overrides**: Factory accepts `Partial<Context>` so tests can override only what matters
2. **Sensible defaults**: All fields have reasonable defaults matching the plugin's config shape
3. **Fresh per test**: Call the factory in each `it` block — never share mutable context
4. **Dependency mocks**: `require` returns typed mocks matching actual dependency APIs
5. **Spy everything**: `emit`, `require`, `has` are always `vi.fn()` for assertion
6. **No wrong-tier fields**: MinimalContext has NO `emit`/`require`/`has`. TeardownContext has ONLY `global`.
