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
- **Unit tests:** [What to test for each domain file]
- **Integration tests:** [Full plugin wiring tests]
- **Type-level tests:** [What to verify with expectTypeOf and @ts-expect-error]

## Code Example
[Complete createPlugin call showing exact spec object — NO explicit generics]

## Verification
- [ ] Plugin directory exists with correct tier structure
- [ ] Config shape matches spec (field names, types, defaults)
- [ ] API methods exist and match signatures
- [ ] Events declared match spec exactly
- [ ] Dependencies reference correct plugin instances
- [ ] Unit tests cover all API methods and edge cases
- [ ] Integration test exercises full lifecycle (createApp → start → API → stop)
- [ ] Type-level tests verify emit, require, and app surface types
- [ ] `bun run lint` passes with zero warnings
- [ ] `bun run test` passes
- [ ] No explicit generics on createPlugin
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

## Plugins
| # | Wave | Name | Tier | Dependencies | Spec File | Build Status |
|---|------|------|------|-------------|-----------|--------------|
| 1 | 1 | env | Nano | none | specifications/01-env.md | not started |
| 2 | 1 | logger | Micro | none | specifications/02-logger.md | not started |
| 3 | 2 | router | Standard | env | specifications/03-router.md | not started |

## Wave Grouping
- Wave 1: env, logger (no dependencies — parallel build)
- Wave 2: router (depends on Wave 1)
- Wave 3: renderer (depends on Wave 1-2)

## Artifacts
- Spec files: [list after Stage 2]
- Skeleton files: [list after Stage 3]

## Verification Results
[Populated after Stage 3 — format/lint/tsc/build pass status]

## Next Action
Run `/moku:build #1` to build the first plugin (env)
```

After each plugin is built by `/moku:build`, update its `Build Status` to `done` and `Next Action` to the next plugin number. After all plugins are built: `Next Action → All plugins built. Run final integration tests.`

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
