# TDD Protocol for Build Waves

Builder sub-agents follow **Red → Green → Refactor** when constructing each plugin. Tests are derived from the spec and written BEFORE implementation. This catches spec-implementation divergence at the source.

## Why TDD in Build Waves

- **Spec fidelity**: Tests encode the spec's API contract. Implementation that passes these tests matches the spec by construction.
- **Earlier failure detection**: Wrong types, missing methods, incorrect state shapes surface during the RED phase (test compilation) — not during post-wave verification.
- **Better gap closure**: When verification fails, existing tests pinpoint exactly which behavior broke. Gap closure is targeted, not exploratory.
- **Quality floor**: Even if the agent hits its turn limit mid-implementation, the failing tests remain as an executable spec for the next attempt.

## The Four Phases

### Phase 1: TYPES (foundation)

Create the type foundation and a minimal skeleton so test imports resolve:

1. **Create the plugin directory** following the specified complexity tier
2. **Write `types.ts`** — Config, State, API, Events types transcribed from the spec's `## Config`, `## State`, `## API`, `## Events` sections. These types ARE the spec in code form.
3. **Write `index.ts` (skeleton)** — Minimal wiring with stub factories:
   ```typescript
   import { createPlugin } from "@moku-labs/core";

   export const router = createPlugin("router", {
     createState({ config }) {
       return {} as any; // stub — will be replaced in Phase 3
     },
     createApi(ctx) {
       return {} as any; // stub — will be replaced in Phase 3
     },
   });
   ```
   This makes `import { router } from "../"` work in test files. The `as any` stubs are temporary — they exist ONLY to unblock Phase 2 imports and will be replaced.

**Phase 1 output**: types.ts + skeleton index.ts. No real logic yet.

### Phase 2: RED (write failing tests)

Write tests that describe the EXPECTED behavior from the spec. Tests reference `types.ts` for type assertions and import from domain files that don't exist yet (or are stubs).

#### Unit Tests (`__tests__/unit/`)

One test file per domain file. Follow the patterns from `test-patterns.md` and mock contexts from `mock-context.md`:

- **`state.test.ts`** — Test `createState`:
  - Initial state shape matches spec's `## State` section
  - Config values flow into initial state
  - Edge cases: empty config, boundary values
  - Use MinimalContext factory (NO emit/require/has)

- **`api.test.ts`** — Test every API method from spec's `## API` section:
  - Each method exists and has correct signature
  - Return values match spec
  - State mutations happen correctly
  - Events are emitted with correct payloads (check `ctx.emit` mock)
  - Edge cases: empty input, missing data, boundary values
  - Use PluginContext factory

- **`handlers.test.ts`** (if plugin has hooks) — Test each hook handler:
  - Handler exists for each event listed in spec's `## Hooks` section
  - Handler produces expected state changes
  - Handler emits expected response events
  - Use PluginContext factory

#### Integration Test (`__tests__/integration/`)

Full lifecycle test using real framework wiring:

```typescript
import { describe, it, expect } from "vitest";
import { createApp } from "../../index"; // framework entry

describe("[plugin] integration", () => {
  it("exercises full lifecycle", async () => {
    const app = createApp();
    await app.start();

    // Test API methods are accessible
    // Test state changes
    // Test event emissions
    // Test dependency interactions

    await app.stop();
  });

  it("respects config overrides", async () => {
    const app = createApp({
      pluginConfigs: { [pluginName]: { /* override */ } }
    });
    await app.start();
    // verify override took effect
    await app.stop();
  });
});
```

#### Type-Level Tests

Include in the integration test file:

```typescript
import { expectTypeOf } from "vitest";

it("provides typed API on app", () => {
  const app = createApp();
  expectTypeOf(app.[pluginName].[method]).toBeFunction();
});

it("rejects wrong types", () => {
  const app = createApp();
  // @ts-expect-error — method expects string, not number
  app.[pluginName].[method](123);
});
```

#### Run Tests — Confirm Failure

```bash
bun test src/plugins/[name]/
```

- Tests MUST fail at this point (stubs return wrong values, methods don't exist yet)
- If any test passes on stubs, the test is too weak — add assertions that verify real behavior
- Record the total test count and failing count for the output contract

**Phase 2 output**: All test files written. All tests failing. This is the RED state.

### Phase 3: GREEN (implement to pass)

Now write the real implementation to make tests pass. Fix the implementation, NOT the tests — tests encode the spec.

7. **Write `state.ts`** — Full `createState` factory. Run `bun test __tests__/unit/state.test.ts` after writing.
8. **Write `api.ts`** — Full API factory. Run `bun test __tests__/unit/api.test.ts` after writing.
9. **Write `handlers.ts`** — Event handlers (if plugin has hooks). Run `bun test __tests__/unit/handlers.test.ts` after writing.
10. **Update `index.ts`** — Replace stubs with real imports:
    ```typescript
    import { createPlugin } from "@moku-labs/core";
    import { createState } from "./state";
    import { createApi } from "./api";
    // import { createHandlers } from "./handlers"; // if hooks exist

    export const router = createPlugin("router", {
      createState,
      createApi,
      // hooks: createHandlers, // if hooks exist
    });
    ```
11. **tsc checkpoint** — `bunx tsc --noEmit`. Fix type errors immediately.
12. **Full test run** — `bun test src/plugins/[name]/`. ALL tests from Phase 2 must pass.

**If a test fails after implementation:**
- Read the test carefully — does it match the spec?
- If yes → fix the implementation
- If the test has a genuine bug (wrong expected value vs spec) → fix the test, but add a comment: `// Fixed: spec says X, test originally had Y`
- Never delete a test to make the suite pass

**Phase 3 output**: All domain files written. All tests passing. This is the GREEN state.

### Phase 4: REFACTOR (clean up)

13. **Review index.ts** — Must be ~30 lines of wiring, no inline logic. If logic leaked in during Phase 3, extract to domain files.
14. **Write README.md** — Minimal placeholder (name + tier + one-line description). Full README comes later in the README wave.
15. **Final lint** — `bun run lint` on the plugin directory.

**Phase 4 output**: Clean, well-structured plugin. All tests still passing.

## TDD Output Contract Extension

The builder agent's output contract includes TDD metrics:

```json
{
  "tdd": {
    "redPhaseTests": 12,
    "redPhaseFailing": 12,
    "greenPhaseTests": 12,
    "greenPhasePassing": 12
  }
}
```

- **`redPhaseTests`**: Total tests after Phase 2
- **`redPhaseFailing`**: Tests that failed after Phase 2 (should equal redPhaseTests)
- **`greenPhaseTests`**: Total tests after Phase 3 (may be ≥ redPhaseTests if implementation revealed needed tests)
- **`greenPhasePassing`**: Tests that passed after Phase 3 (should equal greenPhaseTests)

The wave judge uses these metrics: if `redPhaseFailing < redPhaseTests * 0.8`, tests are too weak (too many pass on stubs). If `greenPhasePassing < greenPhaseTests`, implementation is incomplete.

## TDD for Core Plugins (Nano/Micro)

Core plugins are simpler but still follow TDD:

1. **Types**: May be inline in index.ts (no separate types.ts for Nano)
2. **RED**: Write a single unit test file + integration test. Fewer tests needed (1-3 per file).
3. **GREEN**: Implement the core plugin. Often a single file change.
4. **REFACTOR**: Verify `createCorePlugin` (NOT `createPlugin`), no depends/events/hooks.

The Phase 1 skeleton for core plugins:
```typescript
import { createCorePlugin } from "@moku-labs/core";

export const logger = createCorePlugin("logger", {
  createState({ global }) {
    return {} as any; // stub
  },
  createApi(ctx) {
    return {} as any; // stub
  },
});
```

## When TDD Cannot Apply

In rare cases, TDD is impractical:

- **Pure type plugins** (no runtime logic, only type-level behavior): Skip RED/GREEN, write type-level tests directly.
- **Skeleton-only waves**: The skeleton build (build-skeleton.md) does NOT use TDD — skeletons are stubs by definition.

In these cases, note `"tdd": null` in the output contract.
