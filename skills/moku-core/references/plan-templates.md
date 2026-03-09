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

## Phase: [stage1/approved | stage2/approved | stage3/approved | plan/complete]
## Target: [framework/app/plugin]
## Last Updated: [ISO timestamp]

## Decisions
[Summary from .planning/decisions.md, or inline if no discuss phase]

## Completed
- [x] Target detection
- [ ] Discussion (if performed)
- [ ] Research (if performed)
- [ ] Stage 1: Analysis + Structure — [pending | approved]
- [ ] Stage 2: Specifications — [pending | approved]
- [ ] Stage 3: Skeleton + Verification — [pending | approved]

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

Build Status values: `not started` | `building` | `built` | `agent-incomplete` | `agent-failed` | `verified` | `verify-failed` | `needs-manual` | `done`

## Wave Grouping
- Wave 0 (core): log, env — built first, no inter-dependencies
- Wave 1: router (no regular plugin dependencies — parallel build)
- Wave 2: auth (depends on Wave 1)

## Wave Progress
| Step | Status | Notes |
|------|--------|-------|
| Wave analysis | done | 3 waves identified |
| Wave 0 (core) | done | log, env — verified, spec checkboxes ticked |
| Wave 1 | done | router — verified, spec checkboxes ticked |
| Wave 2 | not started | auth |
| Final verification | not started | |
| README wave | not started | |
| Post-build validation | not started | |

## Artifacts
- Spec files: [list after Stage 2]
- Skeleton files: [list after Stage 3]

## Verification Results
[Populated after Stage 3 — format/lint/tsc/build pass status]

## Next Action
Run `/moku:build resume` to build Wave 0 (core plugins)
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
