# Test Pattern Scaffolds

## Unit Test: state.ts

```typescript
import { describe, it, expect } from "vitest";
import { createRouterState } from "../state";

describe("createRouterState", () => {
  const createMinimalCtx = (overrides = {}) => ({
    global: {},
    config: { basePath: "/", trailingSlash: false, ...overrides },
  });

  it("creates initial state with empty routes", () => {
    const state = createRouterState(createMinimalCtx());
    expect(state.routes).toBeInstanceOf(Map);
    expect(state.routes.size).toBe(0);
    expect(state.currentPath).toBe("/");
  });

  it("respects config basePath in initial state", () => {
    const state = createRouterState(createMinimalCtx({ basePath: "/app" }));
    expect(state.currentPath).toBe("/app");
  });
});
```

## Unit Test: api.ts

```typescript
import { describe, it, expect, vi } from "vitest";
import { createRouterApi } from "../api";

describe("router API", () => {
  function createMockCtx(overrides = {}) {
    return {
      global: {},
      config: { basePath: "/", trailingSlash: false },
      state: { currentPath: "/", routes: new Map(), history: [] },
      emit: vi.fn(),
      require: vi.fn(),
      has: vi.fn(() => true),
      app: {},
      ...overrides,
    };
  }

  describe("navigate", () => {
    it("updates current path and emits route:navigated", () => {
      const ctx = createMockCtx();
      const api = createRouterApi(ctx);

      api.navigate("/about");

      expect(ctx.state.currentPath).toBe("/about");
      expect(ctx.emit).toHaveBeenCalledWith("router:navigated", {
        from: "/",
        to: "/about",
      });
    });

    it("appends to history", () => {
      const ctx = createMockCtx();
      const api = createRouterApi(ctx);

      api.navigate("/about");
      api.navigate("/contact");

      expect(ctx.state.history).toEqual(["/", "/about"]);
    });

    it("handles empty path by navigating to basePath", () => {
      const ctx = createMockCtx({ config: { basePath: "/app" } });
      const api = createRouterApi(ctx);

      api.navigate("");

      expect(ctx.state.currentPath).toBe("/app");
    });
  });

  describe("current", () => {
    it("returns current path", () => {
      const ctx = createMockCtx({ state: { currentPath: "/about" } });
      const api = createRouterApi(ctx);

      expect(api.current()).toBe("/about");
    });
  });
});
```

## Unit Test: handlers.ts

```typescript
import { describe, it, expect, vi } from "vitest";
import { createRouterHandlers } from "../handlers";

describe("router handlers", () => {
  function createMockCtx(overrides = {}) {
    return {
      global: {},
      config: { basePath: "/" },
      state: { currentPath: "/", routes: new Map() },
      emit: vi.fn(),
      require: vi.fn(),
      has: vi.fn(() => true),
      app: {},
      ...overrides,
    };
  }

  describe("app:started hook", () => {
    it("navigates to initial route on app start", () => {
      const ctx = createMockCtx();
      const handlers = createRouterHandlers(ctx);

      handlers["app:started"]({});

      expect(ctx.state.currentPath).toBe("/");
    });
  });
});
```

## Assertion Patterns

**State mutations:**
```typescript
expect(ctx.state.fieldName).toBe(expectedValue);
expect(ctx.state.collection.size).toBe(expectedSize);
```

**Event emissions:**
```typescript
expect(ctx.emit).toHaveBeenCalledWith("event:name", expectedPayload);
expect(ctx.emit).toHaveBeenCalledTimes(1);
expect(ctx.emit).not.toHaveBeenCalled(); // for blocked paths
```

**Dependency access:**
```typescript
expect(ctx.require).toHaveBeenCalledWith(expectedPlugin);
```

**Return values:**
```typescript
expect(api.getItems()).toEqual([...expectedItems]);
expect(api.isActive()).toBe(true);
```

## Anti-Patterns to Avoid

```typescript
// BAD: Empty assertion
expect(true).toBe(true);

// BAD: No assertion
it("does something", () => {
  const api = createApi(ctx);
  api.doThing(); // no expect!
});

// BAD: Shared mutable state
const ctx = createMockCtx(); // outside describe/it!
it("test 1", () => { ctx.state.x = 1; });
it("test 2", () => { expect(ctx.state.x).toBe(0); }); // fails!

// BAD: Wrong context tier
const ctx = { global: {}, config: {}, emit: vi.fn() }; // emit in MinimalContext!
const state = createState(ctx);
```
