---
description: Plan a framework, consumer app, or plugin (2-stage gated workflow)
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
argument-hint: [framework|app|plugin] [description-or-path]
---

Create a specification plan for a Moku project. The input (`$ARGUMENTS`) can be:

- `framework "A static site generator"` — explicit framework target with description
- `app "A personal blog"` — explicit consumer app target
- `plugin auth` — explicit plugin target
- `"A static site generator"` — auto-detect target from working directory
- A path to existing code to migrate to Moku Core

This command runs as a **2-stage gated workflow** with optional discussion, optional research, and plan validation. Each stage ends with a user checkpoint — the user must explicitly approve before proceeding to the next stage.

## CRITICAL RULE: No Explicit Generics on createPlugin

This is the #1 anti-pattern. Every `createPlugin` call in ALL generated code, specs, and examples must use inference only:

```typescript
// ANTI-PATTERN — NEVER GENERATE THIS:
createPlugin<"bundler", BundlerConfig, BundlerState, BundlerApi>("bundler", { ... })

// CORRECT — All types inferred:
createPlugin("bundler", {
  config: { entryPoint: "./src/index.ts" },
  createState: () => ({ bundleCache: new Map() }),
  api: (ctx) => ({ bundle: async () => { /* ... */ } }),
})
```

Check EVERY code example and spec output. If explicit generics appear on createPlugin, fix them before showing to the user.

---

## Step 0: Detect Target

Parse `$ARGUMENTS`:
1. If the first word is exactly `framework`, `app`, or `plugin` — use it as the target. The rest is the description or path.
2. If no explicit target keyword, auto-detect from the working directory:
   a. `src/config.ts` exists AND contains `createCoreConfig` → **framework**
   b. `package.json` depends on a Moku framework package (not `@moku-labs/core` directly) → **app**
   c. Argument looks like a plugin name or spec reference → **plugin**
3. If still unclear — ask the user: "What are you planning? A framework, consumer app, or plugin?"

### Resume from State

Before starting fresh, check if `.planning/STATE.md` exists:
- If it does, read it to understand the current project position
- Present the state to the user: "I found an existing plan state. Resume from [phase] or start fresh?"
- If resuming, skip to the appropriate stage

---

## Step 0.5: Optional Discussion Phase

**This phase triggers when requirements are unclear.** If the user provides a clear, detailed description or an existing codebase to analyze, skip directly to Stage 1.

**When to trigger:**
- The description is vague (< 20 words, no specific domain details)
- The user asks a question rather than stating what to build
- The target domain is complex or has many possible interpretations

**Discussion process:**
1. Ask about the target domain and use case
2. Ask about tech preferences (runtime environment, deployment target)
3. Ask about scale expectations (how many plugins, team size)
4. Ask about non-functional requirements (performance targets, bundle size limits, browser support)
5. Ask about existing constraints (must integrate with X, can't use Y)

**Record decisions:**
Write the captured decisions to `.planning/decisions.md`:

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

Present a summary and get approval before proceeding.

---

## Step 0.6: Optional Research Phase

**This phase triggers when planning a new domain** that would benefit from ecosystem investigation. Skip for well-understood domains, simple plugins, or when the user provides detailed specs.

**When to trigger:**
- Planning a framework in a domain the user hasn't specified libraries for
- The domain has multiple competing approaches (e.g., SSG, CMS, auth)
- Complex TypeScript patterns are likely needed

**Research process:**
1. Spawn the **moku-researcher** agent with the domain description and any decisions from Step 0.5
2. The agent investigates npm packages, TypeScript patterns, reference implementations, and pitfalls
3. Output is saved to `.planning/research.md`
4. Review the research results and incorporate relevant findings into Stage 1 analysis

The research output is available for the user to review but does NOT require a separate approval gate — it flows directly into Stage 1.

---

## Stage 1: Analysis + Structure

### Framework Target

#### If given a description:
- Ask clarifying questions about the domain (use decisions from Step 0.5 if available)
- Identify the target use case (web app, CLI, game, build tool, etc.)
- Determine what plugins are needed
- If research was performed (Step 0.6), incorporate ecosystem findings into plugin identification

#### If given existing code:
- Read and analyze the codebase thoroughly
- Identify domain concepts that map to plugins
- Identify shared state, events, and communication patterns
- Map existing modules/classes/functions to potential plugins

#### Plugin Identification

Using the **moku-core** and **moku-plugin** skills, for each identified plugin determine:

1. **Name** — camelCase plugin name
2. **Complexity Tier** — Nano/Micro/Standard/Complex/VeryComplex (use moku-plugin skill tier criteria)
3. **Brief Description** — One sentence explaining what it does
4. **Dependencies** — Which other plugins it depends on
5. **Has Events** — Whether it declares its own events
6. **Needs start/stop** — ONLY if it manages actual resources (servers, connections, listeners). Most plugins do NOT need start/stop.

#### Structure Constraints

Enforce these constraints on the proposed structure:
- **Root has config and index files only** — `src/config.ts` and `src/index.ts`
- **No folders that are NOT plugins** — everything under `src/plugins/`. No `src/utils/`, `src/services/`, `src/helpers/`
- **CLI/client/server entry point files** are allowed ONLY if absolutely necessary (e.g., `src/cli.ts` for a CLI framework that needs a bin entry). Must be explicitly explained and justified to the user.

#### Output: Plugin Tree Diagram + Planned Skeleton

Present a tree diagram showing the proposed structure with complexity tiers AND the planned file layout:

```
src/
  config.ts                          # Framework config (Config + Events types)
  index.ts                           # Framework entry (createCore + exports)
  plugins/
    env/                             # [Nano] Environment detection
      index.ts
    logger/                          # [Micro] Structured logging
      index.ts
    router/                          # [Standard] Client-side routing
      index.ts, types.ts, state.ts, api.ts, handlers.ts
    auth/                            # [Standard] Authentication + sessions
      index.ts, types.ts, state.ts, api.ts
    renderer/                        # [Complex] Page rendering pipeline
      index.ts, types.ts, state.ts, api.ts
      transforms/
        markdown.ts, html.ts, types.ts
```

For each plugin, note:
- Tier in brackets
- Whether it needs `onStart`/`onStop` (and why, if yes)
- Dependencies as arrows or notes
- Files that will be created per tier

**Do NOT create files yet** — this is a plan, not execution.

---

### App Target

#### Step 1: Understand Requirements

Ask the user about:
- What kind of application they want to build
- What features it needs
- Any specific frameworks they want to use
- Performance requirements
- Target platform

#### Step 2: Analyze Available Frameworks and Plugins

Search the project for:
- Framework packages (look for `createApp` and `createPlugin` exports)
- Available plugins (both framework defaults and optional)
- Plugin APIs and their capabilities
- Framework config shape and events

Read all relevant source files to understand what's available.

#### Step 3: Gap Analysis

Compare requirements against available plugins:
- Which requirements are covered by existing plugins?
- Which requirements need new consumer-side plugins?
- Which requirements need framework extensions?
- Are there missing dependencies?

#### Step 4: Design the Application

1. **Plugin Composition** — Which plugins to include, in what order
2. **Config Overrides** — What global config values to set
3. **Plugin Configs** — Per-plugin configuration
4. **Custom Plugins** — Consumer-side plugins needed (with full specs)
5. **Entry Point** — `createApp` call structure

#### Step 5: Plan Documentation

- JSDoc requirements for all custom code
- README for the application
- API documentation for custom plugins
- Integration documentation (how everything connects)

---

### Plugin Target

#### Step 1: Understand the Plugin

If referencing a spec:
- Read the spec file and find the plugin definition
- Extract all details: config, state, API, events, dependencies

If describing a new plugin:
- Ask clarifying questions about the plugin's purpose
- Design the plugin spec (config, state, API, events, dependencies)

#### Step 2: Determine Complexity Tier

Using the **moku-plugin** skill, assess:
- How many spec fields are needed?
- How much domain logic per field?
- Are there sub-domains?

Select: Nano / Micro / Standard / Complex / VeryComplex

**Domain merge check (CRITICAL):** Before planning a new plugin, scan existing plugins for domain overlap:
- Does the new plugin share a domain prefix with existing plugins? (e.g. `spaHead` + `spaRouter` → merge into `spa`)
- Would the new plugin's events coordinate with an existing plugin's events?
- Would consumers naturally configure the new plugin alongside an existing one?

If overlap is detected: do NOT plan a separate plugin. Instead, plan to add a sub-module to the existing plugin (promoting it to Very Complex if needed).

Also determine lifecycle needs:
- Does the plugin need `onStart`? (Only if opening connections, starting servers/listeners, mounting UI)
- Does the plugin need `onStop`? (Only if closing connections, flushing buffers, unmounting)
- If neither is needed, omit both entirely — do NOT add empty lifecycle methods

#### Output: Plugin Design Summary

Present the plugin design: tier, config shape, state shape, API methods, events, dependencies, lifecycle justification.

---

### Plan Validation Gate (all targets)

**Before presenting to the user**, run the **moku-plan-checker** agent to validate:
- Requirement coverage (every decision maps to a plugin or config)
- Dependency graph correctness (acyclic, order-satisfiable)
- Plugin identification completeness
- Event naming conventions

If the plan-checker finds BLOCKER issues, fix them before presenting to the user. WARNINGs are included in the presentation for transparency.

### User Gate (all targets)

Present the analysis along with the plan-checker validation results. Ask the user to validate and approve before proceeding to Stage 2.

**Wait for explicit user approval before proceeding.**

---

## Stage 2: Specifications + Skeleton

### Framework Target

#### Create the Skeleton

Using the **moku-plugin** skill for plugin file patterns and the **moku-core** skill for config.ts and index.ts:

1. **Create `src/config.ts`** — with Config and Events types as empty/placeholder, `createCoreConfig` call, exports of `{ createPlugin, createCore }`
2. **Create `src/index.ts`** — with `createCore` call importing all plugins, exports `createApp` and `createPlugin`, re-exports all plugins
3. **Create each plugin directory** following the approved tier:
   - Create ALL files for the tier (index.ts, types.ts, state.ts, api.ts, handlers.ts as needed)
   - Files should contain ONLY:
     - Correct imports and exports
     - Empty type definitions (placeholder shapes)
     - Empty function signatures (correct parameter names and return types, but NO implementation)
     - JSDoc headers with tier, description, events, `@see README.md`
   - NO actual business logic, NO implementation code
   - `createPlugin` call uses inference — NO explicit generics
   - `onStart`/`onStop` included ONLY for plugins that were approved to need them in Stage 1

4. **Create README.md** for each plugin — with plugin name and tier only (content filled during build)

#### Skeleton Verification Checklist

After creating all skeleton files, run through this checklist to verify the skeleton compiles and lints cleanly. Fix any issues before proceeding to specifications.

1. **TypeScript** — `bunx tsc --noEmit` passes with zero errors (skeleton types must be valid)
2. **Biome** — `bun run format` runs without errors (normalize formatting)
3. **ESLint** — `bun run lint` passes with zero warnings and zero errors
4. **Build** — `bun run build` compiles without errors (if build script exists)

If any check fails, fix the skeleton files and re-run. The skeleton must be a valid, compilable project before specifications are written — this ensures the build command starts from a clean foundation.

#### Create Plugin Specifications

For each plugin, create a detailed development specification. Save each spec as a separate file in the project's `specifications/` directory:

- `specifications/01-[plugin-name].md`
- `specifications/02-[plugin-name].md`
- etc. (numbered by implementation order)

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

#### Validation Loop

After all specs are created:
1. Run the **moku-plan-checker** agent to validate cross-spec concerns (dependency graph, event flow, requirement coverage, section completeness)
2. Run the **moku-plugin-spec-validator** agent on each plugin
3. Run the **moku-spec-validator** agent to validate Moku specification compliance
4. Resolve any BLOCKER issues found
5. Re-run until all validators report zero BLOCKER violations

#### Final Output

Present:
- Summary of all specifications created
- Plan-checker validation report (with any remaining WARNINGs)
- Dependency graph (visual or textual)
- Communication map (events flowing between plugins)
- Wave grouping for parallel build execution
- Implementation order with rationale
- Example of the final consumer API

---

### App Target

#### Write the Specification

Save to `.planning/app-spec.md` (or user-specified path):

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

#### Validate

1. Run the **moku-plan-checker** agent on the application plan
2. Use the **moku-spec-validator** agent to verify:
   - Plugin ordering satisfies all `depends` constraints
   - No imports from `@moku-labs/core`
   - Config types match framework expectations
   - Custom plugins follow spec

---

### Plugin Target

Write a plugin specification file to `specifications/` (if within a framework project) or `.planning/` (if standalone). Use the same plugin spec template as the framework specs above — including the Verification section.

Include: overview, config, state, API, events, dependencies, hooks, lifecycle, communication, package dependencies, testing strategy, code example, and verification criteria.

1. Run the **moku-plan-checker** agent to validate the spec
2. Run the **moku-plugin-spec-validator** agent to validate the spec

---

### State Update (all targets)

After Stage 2 is complete, write/update `.planning/STATE.md`:

```markdown
# Project State

## Phase: plan/complete
## Target: [framework/app/plugin]
## Last Updated: [ISO timestamp]

## Decisions
[Summary from .planning/decisions.md, or inline if no discuss phase]

## Completed
- [x] Target detection
- [x] Discussion (if performed)
- [x] Research (if performed)
- [x] Stage 1: Analysis + Structure — approved
- [x] Stage 2: Specifications + Skeleton — approved

## Plugins
| # | Wave | Name | Tier | Dependencies | Spec File | Status |
|---|------|------|------|-------------|-----------|--------|
| 1 | 1 | env | Nano | none | specifications/01-env.md | specified |
| 2 | 1 | logger | Micro | none | specifications/02-logger.md | specified |
| 3 | 2 | router | Standard | env | specifications/03-router.md | specified |

## Wave Grouping
- Wave 1: env, logger (no dependencies — parallel build)
- Wave 2: router (depends on Wave 1)
- Wave 3: renderer (depends on Wave 1-2)

## Next Action
Run `/moku:build framework` to begin implementation
```

### User Gate (all targets)

Present the completed specifications and state update. Final approval from user.

**Wait for explicit user approval.**

---

## Rules

- Follow `specification/15-PLUGIN-STRUCTURE` complexity tiers strictly
- Every plugin must have an implementation order number
- Every plugin must have a wave assignment for parallel build grouping
- Plugin #1 should be implementable WITHOUT depending on other plugins
- Each subsequent plugin should only depend on already-numbered plugins
- Include ALL package.json dependencies for every plugin
- Include example of the final consumer API showing all plugin methods typed
- The specs must be self-contained — someone reading them should be able to implement the entire framework
- **NEVER use explicit generics on createPlugin** — check every code example
- **NEVER include onStart/onStop unless there is an actual resource to manage** — document why if included, document why NOT if excluded
- **No folders outside src/plugins/** except config.ts and index.ts at src root — justify any exceptions explicitly
- Consumer code NEVER imports from `@moku-labs/core`
- Consumer imports `createApp` and `createPlugin` from the framework package
- Custom plugins must follow the same structure specs as framework plugins
- Full JSDoc on all custom code
- Include testing strategy for all custom plugins
- Include verification criteria for all plugins
- The spec must be complete enough to implement without further questions
- Run plan-checker agent BEFORE every user gate — users see validated plans only
- Update `.planning/STATE.md` at end of planning for cross-session continuity
