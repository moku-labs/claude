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

## Phase: [stage1/approved | stage2/approved | stage3/approved | plan/complete | skeleton/building | skeleton/verified | skeleton/committed | build/complete]
## Verb: [create|update|add|migrate]
## Target: [framework/app/plugin]
## Last Updated: [ISO timestamp]
## Skeleton: [not-started | in-progress | verified | committed]

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
| Post-build validation | not started | |

## Artifacts
- Spec files: [list after Stage 2]
- Skeleton spec: .planning/skeleton-spec.md [after Stage 3]
- Skeleton files: [list after skeleton build]

## Verification Results
[Populated after skeleton build verification — format/lint/tsc/build pass status and issues resolved]

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
| `src/config.ts` | `@moku-labs/core` | `createCoreConfig`, `createPlugin`, `createCore` |
| `src/config.ts` | `./plugins/[core]` | `[core]` (for createCoreConfig plugins array) |
| `src/plugins/index.ts` | `./[name]` | `[name]` |
| `src/index.ts` | `./config` | `coreConfig`, `createCore` |
| `src/index.ts` | `./plugins` | all plugin instances |
| `src/plugins/[name]/index.ts` | `@moku-labs/core` | `createPlugin` |
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
- **Plugin Types**: `export type * from "./[name]/types"` for each plugin that has `types.ts`, alphabetical.
  Exception: plugins with no `types.ts` use explicit `export type { Foo } from "./[plugin]"`.
  Thin plugins with no public types (Nano/Micro) have no entry.

## Skeleton Build Waves

### Wave 0: Core Infrastructure

Create in this order (framework files depend on core plugins existing):

**Core plugin skeletons** (one per core plugin — no inter-dependencies):

`src/plugins/[core-name]/index.ts`:
~~~typescript
/**
 * @fileoverview [core-name] — Core Plugin skeleton
 * @module
 */
import { createCorePlugin } from "@moku-labs/core";

export const [coreName] = createCorePlugin("[core-name]", {
  createState({ global }) {
    return {};
  },
  createApi(ctx) {
    return {};
  },
});
~~~

**`src/config.ts`** (after core plugins exist):
~~~typescript
/**
 * Framework configuration — Config + Events types, core plugin registration.
 * @module
 */
import { createCoreConfig, createPlugin, createCore } from "@moku-labs/core";
import { [corePlugin1] } from "./plugins/[core1]";
import { [corePlugin2] } from "./plugins/[core2]";

export type Config = {
  // placeholder — field types added during build
};

export type Events = {
  // placeholder — event types added during build
};

export const coreConfig = createCoreConfig({
  plugins: [[corePlugin1], [corePlugin2]],
});

export { createPlugin, createCore };
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

// ─── Plugin Types ─────────────────────────────────────────────
// (populated during build — export type * from "./[plugin]/types" per Standard+ plugin, alphabetical)
~~~

**`src/index.ts`** (after plugins/index.ts exists):
~~~typescript
/**
 * [Framework name] — [brief description].
 * @module
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
export * from "./plugins";

// ─── Framework API + Plugin Helpers ──────────────────────────
export const { createApp, createPlugin } = framework;
// (helpers added during build — all consumer-facing helpers explicitly named, no export *)
~~~

### Wave 1: [Plugin Names — no dependencies]

For each Standard+ plugin in this wave:

`src/plugins/[name]/types.ts`:
~~~typescript
/** @fileoverview [name] plugin — type definitions skeleton */
export type Config = {
  // placeholder fields per spec
};
export type State = {
  // placeholder fields per spec
};
export type Api = {
  // placeholder method signatures per spec
};
~~~

`src/plugins/[name]/state.ts`:
~~~typescript
/** @fileoverview [name] plugin — state factory skeleton */
import type { Config, State } from "./types";

export function createState({ global }: { global: Config }): State {
  return {} as State;
}
~~~

`src/plugins/[name]/api.ts`:
~~~typescript
/** @fileoverview [name] plugin — API factory skeleton */
import type { Api } from "./types";

export function createApi(ctx: unknown): Api {
  return {} as Api;
}
~~~

`src/plugins/[name]/index.ts`:
~~~typescript
/**
 * @fileoverview [name] — [Tier] Plugin skeleton
 * @see README.md
 * @module
 */
import { createPlugin } from "@moku-labs/core";
import { createState } from "./state";
import { createApi } from "./api";

export const [name] = createPlugin("[name]", {
  createState,
  createApi,
});
~~~

[Repeat for each plugin in this wave]

### Wave N: [Plugin Names — depends on prior waves]

Same pattern as Wave 1, with `depends` array added:

`src/plugins/[name]/index.ts`:
~~~typescript
/**
 * @fileoverview [name] — [Tier] Plugin skeleton
 * @see README.md
 * @module
 */
import { createPlugin } from "@moku-labs/core";
import { [dep] } from "../[dep]";
import { createState } from "./state";
import { createApi } from "./api";

export const [name] = createPlugin("[name]", {
  depends: [[dep]],
  createState,
  createApi,
});
~~~

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
- [ ] `src/plugins/index.ts` lists ALL planned plugins (including not-yet-built ones)
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
