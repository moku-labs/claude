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

The `moku-builder` agent follows Red → Green → Refactor when constructing plugins during build waves. Tests are derived from the spec and written before the implementation.

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-testing/references/tdd-protocol.md` for the full TDD protocol: four phases (Types → Red → Green → Refactor), output contract extensions, core plugin adaptations, and edge cases.

## What earns a test

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-testing/references/test-value.md` before writing, reviewing or removing a test. In short:

- Name the bug a test catches before you write it. No bug to name: no test. Not a test: a constant
  compared with a copy of itself, what `tsc` proves, the same scenario at a second level, the framework's
  own behaviour.
- Every behaviour the spec's `## Verification` promises has one test that fails when it breaks. A promise
  without a test fails the build.
- After green, the kill check: break one line per logic file, see a test fail, restore.
- 90% coverage is the goal and is reached by tests of behaviour. No filler, no edit of the threshold, no
  ignore comment without the person's yes.
- An existing test is never deleted by an agent alone.

## Test Runs

When to run which tests, and how often, is one rule for every station: `${CLAUDE_PLUGIN_ROOT}/skills/moku-testing/references/test-runs.md`. In short: one run per tree, the output kept in a file and read from there, the plugin's own tests while it is built, the whole script once per wave and once at the close, and no whole run right before a commit whose hook runs it. `moku-rails tests` prints the runs that were repeated and the slow tests.

## Context Tiers

Every Moku plugin callback receives a specific context tier. Tests mock the matching tier; using fields from another tier is a blocker.

| Callback | Context Tier | Available Fields |
|----------|-------------|-----------------|
| `createState` | MinimalContext | `global`, `config` |
| `api` factory | PluginContext | `global`, `config`, `state`, `emit`, `require`, `has`, + core APIs |
| `hooks` factory | PluginContext | `global`, `config`, `state`, `emit`, `require`, `has`, + core APIs |
| `onInit` | PluginContext | `global`, `config`, `state`, `emit`, `require`, `has`, + core APIs |
| `onStart` | PluginContext | `global`, `config`, `state`, `emit`, `require`, `has`, + core APIs |
| `onStop` | TeardownContext | `global`, own `config`, own `state` (core ≥ 1.6; `global` only before) |

## Mock Context Factory

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-testing/references/mock-context.md` for the standard mock context factory pattern with typed overrides.

**Key rules:**
- Mock factories accept `Partial<Context>` for test-specific overrides
- `emit` is always `vi.fn()` — verify with `expect(emit).toHaveBeenCalledWith('event:name', payload)`
- Domain mocks are typed with the exported `PluginCtx<C, S, E>` (`config`/`state`/`emit` only);
  if a domain file composes its own ctx with `require`, mock it with typed APIs matching the
  actual dependency signatures
- Fields from a different context tier do not belong in the mock

## Unit Test Pattern

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-testing/references/test-patterns.md` for unit test scaffolds per domain file (state, api, handlers).

**Canonical test exemplars** (real moku code): for a mock-ctx unit test open `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/sandbox/plugins/analytics/__tests__/unit/api.test.ts` (or `router/__tests__/unit/api.test.ts`); for a `createTestApp()` integration test open `…/sandbox/plugins/analytics/__tests__/integration/analytics.test.ts`; for `expectTypeOf`/`@ts-expect-error` type-level style open `…/sandbox/factory-chain.test.ts` / `events.test.ts`. See `sandbox-index.md`.

**Key rules:**
- A domain file with logic gets its own test file: `state.ts` → `__tests__/unit/state.test.ts`. A file of
  types or plain data gets none
- Each test creates its own mock context (no shared mutable state)
- Test descriptions are behavior-oriented: "returns empty array when no routes registered"
- Every test can fail for a named bug (`references/test-value.md`); `expect(true).toBe(true)` and a
  constant compared with its own copy cannot
- Edge cases where the behaviour changes: an empty input that takes another branch, a boundary where the
  result flips, an error the code handles on purpose

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
- Type tests for what a consumer can get wrong: a wrong event name, a wrong payload, a wrong argument, a
  return type that widened to `any`. Not one per field: `tsc` already checks what the code itself uses
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

- Plugin tests live inside the plugin directory, not in root `tests/`
- Root `tests/` holds framework-level cross-plugin tests
- Unit tests in `__tests__/unit/`, integration in `__tests__/integration/`
