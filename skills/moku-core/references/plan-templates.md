# Plan Templates

Templates used by the `/plan` command for specifications, STATE.md, and decisions.

---

## Plugin Specification Template

Each specification file must contain:

```markdown
# Plugin Specification: [name]

## Overview
- **Tier:** [Nano/Micro/Standard/Complex/VeryComplex]
- **Implementation Order:** #N
- **Wave:** [wave number for parallel execution grouping]
- **Description:** [Detailed description of purpose and behavior]

## Config
[Complete config type with all fields, defaults, and descriptions]

## State
[State shape with descriptions of each field. "None" if no state.]

## API
[Every public method with full signature, description, and usage example]

## Events
[Per-plugin events with payload types using register callback pattern. "None" if no events.]

## Dependencies
[List of plugin instance dependencies with what is used from each via ctx.require()]

## Hooks
[Which events this plugin listens to, and what each handler does]

## Lifecycle
- **onInit:** [What happens during sync init. "Not used" if absent.]
- **onStart:** [What happens during async start. "Not used" if absent — explain why start is not needed.]
- **onStop:** [What happens during async stop. "Not used" if absent — explain why stop is not needed.]

## Communication
- **Emits:** [Events this plugin emits and when]
- **Listens:** [Events this plugin handles via hooks]
- **Requires:** [APIs accessed via ctx.require()]

## Package Dependencies
[npm/bun packages needed with versions]

## Testing Strategy
- **Unit tests** (`__tests__/unit/`): [What to test for each domain file]
- **Integration tests** (`__tests__/integration/`): [Full plugin wiring tests]
- **Type-level tests:** [What to verify with expectTypeOf and @ts-expect-error]
- All tests live inside the plugin directory, NOT in root `tests/`

## Code Example
[Complete createPlugin call showing exact spec object — NO explicit generics]

## Verification
<!-- These checkboxes are ticked by /moku:build after each wave (Step 4d). Failed items route to gap closure. -->
- [ ] Plugin directory exists with correct tier structure
- [ ] Config shape matches spec (field names, types, defaults)
- [ ] API methods exist and match signatures
- [ ] Events declared match spec exactly
- [ ] Dependencies reference correct plugin instances
- [ ] Unit tests in `__tests__/unit/` cover all API methods and edge cases
- [ ] Integration test in `__tests__/integration/` exercises full lifecycle (createApp → start → API → stop)
- [ ] Type-level tests verify emit, require, and app surface types
- [ ] `bun run lint` passes with zero warnings
- [ ] `bun run test` passes
- [ ] No explicit generics on createPlugin
- [ ] import type used for type-only imports
- [ ] No wire factory patterns
- [ ] No inline type assertions in createState/config
```

---

## Core Plugin Specification Template

Core plugins use a simplified template — no events, dependencies, or hooks sections.

```markdown
# Core Plugin Specification: [name]

## Overview
- **Type:** Core Plugin
- **Implementation Order:** #N (Wave 0 — before all regular plugins)
- **Description:** [Detailed description of purpose and behavior]

## Config
[Complete config type with all fields, defaults, and descriptions. "None" if no config.]

## State
[State shape with descriptions of each field. "None" if no state.]

## API
[Every public method with full signature, description, and usage example.
These methods are injected on every regular plugin's context as ctx.<name>.<method>().]

## Lifecycle
- **onInit:** [What happens during sync init. "Not used" if absent.]
- **onStart:** [What happens during async start. "Not used" if absent.]
- **onStop:** [What happens during async stop. "Not used" if absent.]

## Package Dependencies
[npm/bun packages needed with versions. "None" if no external deps.]

## Testing Strategy
- **Unit tests** (`__tests__/unit/`): [What to test]
- **Integration tests** (`__tests__/integration/`): [Full core plugin wiring with createCoreConfig]
- **Type-level tests:** [Verify ctx.<name> is typed on regular plugin context]
- All tests live inside the plugin directory, NOT in root `tests/`

## Code Example
[Complete createCorePlugin call — NO explicit generics]

## Verification
- [ ] Plugin directory exists
- [ ] Uses createCorePlugin (NOT createPlugin)
- [ ] NO depends, events, or hooks in spec
- [ ] Config shape matches spec
- [ ] API methods exist and match signatures
- [ ] Unit tests in `__tests__/unit/` cover all API methods
- [ ] Integration test in `__tests__/integration/`: createCoreConfig with plugin, verify ctx.<name> works in regular plugin
- [ ] `bun run lint` passes with zero warnings
- [ ] `bun run test` passes
- [ ] No explicit generics on createCorePlugin
- [ ] import type used for type-only imports
```

---

## Application Specification Template

```markdown
# Application Specification: [Name]

## Overview
[What the app does, target users, domain]

## Framework
[Which framework, version, what it provides]

## Plugin Composition
[Ordered list of all plugins — framework defaults + consumer extras]

## Configuration
### Global Config
[Config overrides with values and rationale]

### Plugin Configs
[Per-plugin config overrides]

## Custom Plugins
### Plugin: [name]
[Full plugin spec: tier, config, state, API, events, deps, tests, verification]

## Missing Plugins (Require Framework Extension)
[Plugins that need to be added to the framework, if any]

## Entry Point (main.ts)
[Complete createApp code example]

## Implementation Order
1. [Custom plugin or setup step]
2. [Next step]
...

## Testing Strategy
[Unit, integration, e2e plans for custom code]

## Documentation Plan
[What docs to write, where they go]

## Dependencies
[Additional npm packages needed]
```

---

## STATE.md Template

```markdown
# Project State

## Phase: [stage1/approved | stage2/approved | stage3/approved | complete | building | build/wave-N | build/complete]
## Verb: [create|update|add|migrate]
## Target: [framework/app/plugin]
## Last Updated: [ISO timestamp]
## Skeleton: [not-started | in-progress | verified | committed]
## QuickMode: [true | false — read by plan command on resume to restore quick mode]
## Cycle: [1 | 2 | ... — incremented after each build/complete → archive cycle]

## Decisions
[Summary from .planning/decisions.md, or inline if no discuss phase]

## Completed
- [x] Target detection
- [ ] Discussion (if performed)
- [ ] Research (if performed)
- [ ] Stage 1: Analysis + Structure — [pending | approved]
- [ ] Stage 2: Specifications — [pending | approved]
- [ ] Stage 3: Skeleton Specification — [pending | approved]
- [ ] Skeleton: Build — [not-started | in-progress | verified | committed]

## Core Plugins
| # | Name | Description | Spec File | Build Status |
|---|------|-------------|-----------|--------------|
| 1 | log | Structured logging | .planning/specs/01-log.md | not started |
| 2 | env | Environment detection | .planning/specs/02-env.md | not started |

## Plugins
| # | Wave | Name | Tier | Dependencies | Spec File | Build Status |
|---|------|------|------|-------------|-----------|--------------|
| 3 | 1 | router | Standard | none | .planning/specs/03-router.md | not started |
| 4 | 2 | auth | Standard | router | .planning/specs/04-auth.md | not started |

Build Status values: `not started` | `building` | `built` | `pipeline-built` | `agent-incomplete` | `agent-failed` | `verified` | `verify-failed` | `needs-manual` | `done`

## Wave Grouping
- Wave 0 (core): log, env — built first, no inter-dependencies
- Wave 1: router (no regular plugin dependencies — parallel build)
- Wave 2: auth (depends on Wave 1)

## Wave Progress
| Step | Status | Notes |
|------|--------|-------|
| Skeleton spec | done | .planning/skeleton-spec.md |
| Skeleton Wave 0 | not started | config.ts, plugins/index.ts, index.ts, core plugins |
| Skeleton Wave 1 | not started | [plugin names] |
| Skeleton verify | not started | format/lint/tsc/build |
| Skeleton commit | not started | initial commit |
| Wave analysis | done | 3 waves identified |
| Wave 0 (core) | done | log, env — verified, spec checkboxes ticked |
| Wave 1 | done | router — verified, spec checkboxes ticked |
| Wave 2 | not started | auth |
| Final verification | not started | |
| README wave | not started | |
| Root docs + LLM docs | not started | |
| Documentation validation | not started | |
| Integration tests | not started | |
| Coverage verification | not started | |
| CI/CD generation | not started | |
| Post-build validation | not started | |
| Cycle archive | not started | |

## Artifacts
- Spec files: [list after Stage 2]
- Skeleton spec: .planning/skeleton-spec.md [after Stage 3]
- Skeleton files: [list after skeleton build]

## Verification Results
[Populated after skeleton build verification — format/lint/tsc/build pass status and issues resolved]

## LeanMode: [true | false | auto]

## Pipeline Status
[Only present during active pipelining. Removed after reconciliation.]
- Wave [N]: verifying
- Wave [N+1]: building (pipelined)
- Interface hashes at pipeline start:
  - src/plugins/[name]/types.ts: [hash]
  - src/plugins/[name]/index.ts: [hash]

## Next Action
Run `/moku:build resume` — skeleton build will run first (skeleton not-started)
```

**State machine for resume:** Each `/moku:build resume` reads the Wave Progress table, finds the first row with status `not started`, executes that step, marks it `done`, and stops. Example `Next Action` values:
- `Run /moku:build resume to build Wave 0 (core plugins)`
- `Run /moku:build resume to build Wave 1 (router)`
- `Run /moku:build resume for final framework verification`
- `Run /moku:build resume for README wave`
- `Run /moku:build resume for post-build validation`
- `All steps complete.`

---

## decisions.md Template

```markdown
# Planning Decisions

## Target
- Type: [framework/app/plugin]
- Domain: [description]

## Tech Preferences
- Runtime: [Bun/Node/Both]
- Deployment: [description]

## Scale
- Expected plugins: [number range]
- Team: [solo/small/large]

## Non-Functional Requirements
- [requirement 1]
- [requirement 2]

## Constraints
- [constraint 1]
- [constraint 2]

## Open Questions
- [anything still unclear]
```

---

## Skeleton Specification Template

Save to `.planning/skeleton-spec.md`.

~~~markdown
# Skeleton Specification: [Framework Name]

## Architecture Overview

[2–3 paragraphs describing:
1. The overall file structure: `src/config.ts` owns Config + Events types and core plugin registration via `createCoreConfig`; `src/plugins/index.ts` is the two-section barrel (Plugin Instances → Plugin Types). Helpers are NOT in the barrel — they go in `src/index.ts` only. `src/index.ts` is the framework entry with `createCore` (including `pluginConfigs` with JSDoc per-property docs) and two export sections.
2. How core plugins flow: registered in `createCoreConfig`, injected as `ctx.[name]` on all regular plugin contexts.
3. The consumer API surface: what `createApp` exposes, how plugins are accessed.]

## File Structure

Only list files that skeleton waves will CREATE. Do not list files that already exist from `/moku:init` (e.g., `tests/unit/setup.test.ts`, `tests/integration/setup.test.ts`). The skeleton replaces the init stubs for `src/config.ts` and `src/index.ts`, so those appear below, but pre-existing root test files should not be listed as skeleton outputs.

~~~
src/
  config.ts                    # Framework config: Config + Events types, createCoreConfig call
  index.ts                     # Framework entry: createCore, grouped exports
  plugins/
    index.ts                   # Plugin barrel: instances + plugin types (NO helpers)
    [core-plugin]/             # [Core] — createCorePlugin
      index.ts
      README.md
      __tests__/unit/index.test.ts
    [plugin-name]/             # [Tier] — createPlugin
      index.ts
      types.ts
      state.ts
      api.ts
      handlers.ts              (only if plugin has hooks)
      README.md
      __tests__/
        unit/
          api.test.ts
          state.test.ts
        integration/
          [name].test.ts
~~~

## System Connections

### Import Map

| File | Imports From | Symbols |
|------|-------------|---------|
| `src/config.ts` | `@moku-labs/core` | `createCoreConfig` |
| `src/config.ts` | (self — destructured from coreConfig) | `createPlugin`, `createCore` |
| `src/config.ts` | `./plugins/[core]` | `[core]` (for createCoreConfig plugins array) |
| `src/plugins/index.ts` | `./[name]` | `[name]` |
| `src/index.ts` | `./config` | `coreConfig`, `createCore` |
| `src/index.ts` | `./plugins` | all plugin instances |
| `src/plugins/[name]/index.ts` | `../../config` | `createPlugin` |
| `src/plugins/[name]/index.ts` | `./types` | `Config`, `State`, `Api`, `Events` |
| `src/plugins/[name]/index.ts` | `./state` | `createState` |
| `src/plugins/[name]/index.ts` | `./api` | `createApi` |
| `src/plugins/[name]/index.ts` | `../[dep]` | `[dep]` (if plugin has dependencies) |

### Type Reference Chain

Config union: `FrameworkConfig extends Plugin1Config & Plugin2Config & ...`
Events union: `FrameworkEvents extends Plugin1Events & Plugin2Events & ...`
[Describe how the type system composes — how each plugin's Config/Events feeds into the framework-level types.]

### Barrel Pattern

`src/plugins/index.ts` exports in two sections:
- **Plugin Instances**: `export { [name] } from "./[name]"` for every planned plugin, alphabetical.
  Helpers (builders, factories) are **NEVER** exported here — they go in `src/index.ts`.
- **Plugin Types**: `export * as [PascalCaseName] from "./[name]/types"` for each plugin that has `types.ts`, alphabetical.
  This creates namespace-style access: consumers use `PluginName.Config`, `PluginName.Api`, etc.
  **Never use `export type *`** — all plugins define types named `Config`, `State`, `Api` which collide.
  Thin plugins with no public types (Nano/Micro) have no entry.

## Skeleton Build Waves

### Wave 0: Core Infrastructure

Create in this order (framework files depend on core plugins existing):

**Core plugin skeletons** (one per core plugin — no inter-dependencies):

`src/plugins/[core-name]/index.ts`:
~~~typescript
/**
 * @file [core-name] — Core Plugin skeleton
 */
import { createCorePlugin } from "@moku-labs/core";

export const [coreName] = createCorePlugin("[core-name]", {
  /**
   * Creates initial core plugin state.
   *
   * @param _ctx - Core plugin context (unused in skeleton).
   * @example
   * ```ts
   * const state = createState(ctx);
   * ```
   */
  createState(_ctx) {
    return {};
  },
  /**
   * Creates the core plugin API surface.
   *
   * @param _ctx - Core plugin context (unused in skeleton).
   * @example
   * ```ts
   * const api = coreApi(ctx);
   * ```
   */
  api(_ctx) {
    return {};
  },
});
~~~

**`src/config.ts`** (after core plugins exist):
~~~typescript
/**
 * @file Framework configuration — Config + Events types, core plugin registration.
 */
import { createCoreConfig } from "@moku-labs/core";
import { [corePlugin1] } from "./plugins/[core1]";
import { [corePlugin2] } from "./plugins/[core2]";

/**
 * Global configuration shape for the framework.
 * Replace with actual config fields during build.
 */
// biome-ignore lint/complexity/noBannedTypes: placeholder for user-defined config
export type Config = {};

/**
 * Event contract for the framework.
 * Replace with actual event types during build.
 */
// biome-ignore lint/complexity/noBannedTypes: placeholder for user-defined events
export type Events = {};

export const coreConfig = createCoreConfig("[framework-name]", {
  config: {} as Config,
  plugins: [[corePlugin1], [corePlugin2]] as const,
});

export const { createPlugin, createCore } = coreConfig;
~~~

**`src/plugins/index.ts`** (after config.ts exists):
~~~typescript
/**
 * Plugin barrel — re-exports all framework plugin instances and types.
 * Helpers are NOT exported here — see src/index.ts.
 */

// ─── Plugin Instances ────────────────────────────────────────
export { [plugin1] } from "./[plugin1]";
export { [plugin2] } from "./[plugin2]";
// [all planned plugins listed here — even if not yet built, alphabetical]

// ─── Plugin Types (namespace re-exports) ─────────────────────
// (populated during build — export * as [PascalCase] from "./[plugin]/types" per Standard+ plugin, alphabetical)
// Consumers access types as: PluginName.Config, PluginName.Api, etc.
~~~

**`src/index.ts`** (after plugins/index.ts exists):
~~~typescript
/**
 * @file [Framework name] — [brief description].
 */
import { coreConfig, createCore } from "./config";
import { [plugin1], [plugin2] } from "./plugins";

const framework = createCore(coreConfig, {
  plugins: [[plugin1], [plugin2]],
  // Framework default plugin configuration.
  // Consumer apps override specific values via createApp({ pluginConfigs: { ... } }).
  pluginConfigs: {
    // (populated during build — all non-trivial plugin configs.
    //  Every property gets a JSDoc comment: description + allowed values + @example for complex values)
  }
});

// ─── Plugins + Types ──────────────────────────────────────────
// NOTE: Do not re-export createPlugin from src/plugins/index.ts — it is exported below.
export * from "./plugins";

// ─── Framework API + Plugin Helpers ──────────────────────────
export const { createApp, createPlugin } = framework;
// (helpers added during build — all consumer-facing helpers explicitly named, no export *)
~~~

### Wave 1: [Plugin Names — no dependencies]

For each Standard+ plugin in this wave:

`src/plugins/[name]/types.ts`:
~~~typescript
/**
 * @file [name] plugin — type definitions skeleton
 */
export type Config = {
  // placeholder fields per spec
};
export type State = {
  // placeholder fields per spec
};
export type Api = {
  // Use concrete method signatures from the plugin spec — not unknown.
  // Example: methodName(arg: ConcreteType): ReturnType;
  // placeholder method signatures per spec
};
~~~

**Note:** When generating skeleton-spec.md in Stage 3, populate `types.ts` with the actual method signatures and parameter types from the plugin's spec `## API` section. Use concrete types (e.g., `PixelData[]`, `FilterResult`) rather than `unknown` or `unknown[]`. The skeleton should be type-correct even before implementation — stubs in `api.ts` use `throw new Error("not implemented")` but the type signatures must match the spec.

`src/plugins/[name]/state.ts`:
~~~typescript
/**
 * @file [name] plugin — state factory skeleton
 */
import type { Config, State } from "./types";

/**
 * Creates initial [name] plugin state.
 *
 * @param _ctx - Minimal context with global and config.
 * @param _ctx.global - Global plugin registry.
 * @param _ctx.config - Resolved plugin configuration.
 * @example
 * ```ts
 * const state = createState({ global: {}, config: {} });
 * ```
 */
export function createState(_ctx: {
  readonly global: Readonly<Record<string, unknown>>;
  readonly config: Readonly<Config>;
}): State {
  throw new Error("not implemented");
}
~~~

**Note:** Stub functions whose body is only `throw new Error("not implemented")` must NOT include `@returns` JSDoc tags — `jsdoc/require-returns-check` rejects `@returns` on non-returning functions. Only add `@returns` when the implementation actually returns a value.

**Note:** The `@param` names must match the actual parameter names including the underscore prefix (e.g., `@param _ctx`, not `@param ctx`). For destructured object parameters, list each property separately (`@param _ctx.global`, `@param _ctx.config`).

`src/plugins/[name]/api.ts`:
~~~typescript
/**
 * @file [name] plugin — API factory skeleton
 */
import type { Api } from "./types";

/**
 * Creates the [name] plugin API surface.
 *
 * @param _ctx - Plugin context (unused in skeleton).
 * @example
 * ```ts
 * const api = createApi(ctx);
 * ```
 */
export function createApi(_ctx: unknown): Api {
  throw new Error("not implemented");
}
~~~

`src/plugins/[name]/index.ts`:
~~~typescript
/**
 * @file [name] — [Tier] Plugin skeleton.
 * @see README.md
 */
import { createPlugin } from "../../config";
import { createState } from "./state";
import { createApi } from "./api";

export const [name] = createPlugin("[name]", {
  createState,
  api: createApi,
  // If this plugin has events in its spec, include stubbed events:
  // events: register => ({
  //   "[name]:event-name": register("description from spec"),
  // }),
});
~~~

`src/plugins/[name]/README.md`:
~~~markdown
# [name]

> [Tier] plugin — [brief description from spec]

## API

<!-- Populated during build -->

## Configuration

<!-- Populated during build -->
~~~

`src/plugins/[name]/__tests__/unit/[name].test.ts`:
~~~typescript
import { describe, it, expect } from "vitest";

describe("[name]", () => {
  it.todo("should be implemented during build");
});
~~~

`src/plugins/[name]/__tests__/integration/[name].test.ts`:
~~~typescript
import { describe, it, expect } from "vitest";

describe("[name] integration", () => {
  it.todo("should be implemented during build");
});
~~~

[Repeat for each plugin in this wave]

### Wave N: [Plugin Names — depends on prior waves]

Same pattern as Wave 1, with `depends` array added:

`src/plugins/[name]/index.ts`:
~~~typescript
/**
 * @file [name] — [Tier] Plugin skeleton.
 * @see README.md
 */
import { createPlugin } from "../../config";
import { [dep] } from "../[dep]";
import { createState } from "./state";
import { createApi } from "./api";

export const [name] = createPlugin("[name]", {
  depends: [[dep]],
  createState,
  api: createApi,
});
~~~

Include the same `README.md`, `__tests__/unit/[name].test.ts`, and `__tests__/integration/[name].test.ts` placeholders as Wave 1 for each plugin.

## Verification Checklist

After all skeleton files are created, verify in order:
- [ ] `bun run format` — passes with no changes required
- [ ] `bun run lint` — zero warnings, zero errors
- [ ] `bunx tsc --noEmit` — zero type errors
- [ ] `bun run build` — compiles without errors (if build script exists)
- [ ] All files listed in File Structure section exist at expected paths
- [ ] No implementation logic in any file (only empty types, empty function bodies, JSDoc headers)
- [ ] No explicit generics on `createPlugin` or `createCorePlugin`
- [ ] Core plugins have no `depends`, `events`, or `hooks` fields
- [ ] Plugins with events in their spec include stubbed `events` field: `events: register => ({ "event:name": register("description") })`
- [ ] `src/plugins/index.ts` lists ALL planned plugins (including not-yet-built ones)
- [ ] Every plugin has `README.md` placeholder
- [ ] Every plugin has `__tests__/unit/[name].test.ts` placeholder
- [ ] Every plugin has `__tests__/integration/[name].test.ts` placeholder
~~~

---

## Steering Template

Used by the Steering Pre-Phase in `plan-verb-create.md`. Saved to `.planning/steering.md`.

```markdown
# Steering

## Boundaries (NOT in scope)
- [boundary 1]
- [boundary 2]

## Primary User
[audience description]

## MVP Priorities (top 3)
1. [capability 1]
2. [capability 2]
3. [capability 3]

## Reference Point
[closest existing project, or "Novel — no close reference"]

## Biggest Risk
[risk description]
```

---

## Decision Log Template

Used by the Decision Knowledge Graph. Saved to `.planning/decision-log.md`. See `decision-knowledge-graph.md` for full protocol.

```markdown
# Decision Log

Structured record of trade-off decisions. Agents consult this before making changes.

<!-- Newest entries at the top -->
```

---

## Migration decisions.md Template

Used by Step 0.3 of `/plan` when saving migration analysis context. The `## Migration Type` header signals to Step 0.5 that migration context is present and the discussion phase should be skipped.

```markdown
# Migration Decisions

## Target
- Type: framework
- Domain: [description of what the framework does]

## Migration Type
- Flow: from-existing
- Source Path: [path to existing project]

## Source Analysis

### Tech Stack
[Runtime, framework, build tool, test framework, key dependencies]

### Domain Mapping
| Existing Module | Proposed Plugin | Tier | Source Files | LOC | Notes |
|----------------|----------------|------|-------------|-----|-------|
| [src/auth/] | auth | Standard | 5 files | 340 | Has JWT + sessions |

## Breaking Changes
[Patterns that don't map cleanly to Moku concepts — gap analysis results]

## Target Structure
[Proposed Moku project tree with plugin names and tiers]

## Event Mappings
[Existing event patterns → Moku events]

## Config Mappings
[Existing config sources → Moku config fields]

## Dependencies to Install
[Packages to keep, packages to drop (replaced by Moku patterns)]

## Open Questions
- [anything needing user input during planning]
```
