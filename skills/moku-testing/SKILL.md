---
name: moku-testing
description: >
  Moku testing patterns: TDD protocol for build waves, mock context factories,
  integration test scaffolds, type-level test patterns, and test organization conventions.
  Triggers on: "moku test pattern", "moku mock context", "moku integration test",
  "moku type test", "plugin test structure", "vitest moku", "test a moku plugin",
  "TDD", "test-driven", "red green refactor", or writing tests for moku plugins.
---

# Moku Testing Patterns

This skill provides testing patterns for Moku plugins. Use it when writing unit tests, integration tests, or type-level tests for plugins.

## TDD Protocol (Build Waves)

Builder sub-agents follow **Red → Green → Refactor** when constructing plugins during build waves. Tests are derived from the spec and written BEFORE implementation.

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-testing/references/tdd-protocol.md` for the full TDD protocol: four phases (Types → Red → Green → Refactor), output contract extensions, core plugin adaptations, and edge cases.

## Context Tiers

Every Moku plugin callback receives a specific context tier. Tests MUST mock the correct tier — using the wrong fields is a BLOCKER.

| Callback | Context Tier | Available Fields |
|----------|-------------|-----------------|
| `createState` | MinimalContext | `global`, `config` |
| `api` factory | PluginContext | `global`, `config`, `state`, `emit`, `require`, `has`, `app` |
| `hooks` factory | PluginContext | `global`, `config`, `state`, `emit`, `require`, `has`, `app` |
| `onInit` | PluginContext | `global`, `config`, `state`, `emit`, `require`, `has`, `app` |
| `onStart` | PluginContext | `global`, `config`, `state`, `emit`, `require`, `has`, `app` |
| `onStop` | TeardownContext | `global` |

## Mock Context Factory

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-testing/references/mock-context.md` for the standard mock context factory pattern with typed overrides.

**Key rules:**
- Mock factories accept `Partial<Context>` for test-specific overrides
- `emit` is always `vi.fn()` — verify with `expect(emit).toHaveBeenCalledWith('event:name', payload)`
- `require` returns typed mock APIs — must match actual dependency signatures
- Never include fields from a different context tier

## Unit Test Pattern

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-testing/references/test-patterns.md` for unit test scaffolds per domain file (state, api, handlers).

**Key rules:**
- Each domain file gets its own test file: `state.ts` → `__tests__/unit/state.test.ts`
- Each test creates its own mock context (no shared mutable state)
- Test descriptions are behavior-oriented: "returns empty array when no routes registered"
- Every test has at least one meaningful assertion (no `expect(true).toBe(true)`)
- Edge cases: empty input, boundary values, error conditions

## Integration Test Pattern

Integration tests use real `createCoreConfig` / `createCore` / `createApp`:

```typescript
import { describe, it, expect } from "vitest";
import { createApp } from "../../index";

describe("router plugin integration", () => {
  it("navigates and emits route:navigated event", async () => {
    const app = createApp();
    await app.start();

    app.router.navigate("/about");
    expect(app.router.current()).toBe("/about");

    await app.stop();
  });
});
```

**Key rules:**
- Full lifecycle: `createApp()` → `app.start()` → operations → `app.stop()`
- Test cross-plugin interactions via hooks (if dependencies exist)
- Verify API accessibility: `app.[pluginName].[method]()`
- At least one end-to-end scenario per plugin

## Type-Level Tests

Use vitest `expectTypeOf` and `@ts-expect-error` for compile-time testing:

```typescript
import { expectTypeOf } from "vitest";
import { createApp } from "../../index";

it("provides typed router API on app", () => {
  const app = createApp();
  expectTypeOf(app.router.navigate).toBeFunction();
  expectTypeOf(app.router.current).toMatchTypeOf<() => string>();
});

it("rejects wrong event payload type", () => {
  const app = createApp();
  // @ts-expect-error — navigate expects string, not number
  app.router.navigate(123);
});
```

**Key rules:**
- At least one type test per: API method return type, event payload, config field
- `@ts-expect-error` for compile-time rejection (wrong types, wrong event names)
- `expectTypeOf` for positive type assertions

## Test Organization

```
src/plugins/router/
├── __tests__/
│   ├── unit/
│   │   ├── state.test.ts
│   │   ├── api.test.ts
│   │   └── handlers.test.ts
│   └── integration/
│       └── router.test.ts
```

- Plugin tests live INSIDE the plugin directory (NOT in root `tests/`)
- Root `tests/` is only for framework-level cross-plugin tests
- Unit tests in `__tests__/unit/`, integration in `__tests__/integration/`
