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

This command runs as a **2-stage gated workflow**. Each stage ends with a user checkpoint — the user must explicitly approve before proceeding to the next stage.

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

---

## Stage 1: Analysis + Structure

### Framework Target

#### If given a description:
- Ask clarifying questions about the domain
- Identify the target use case (web app, CLI, game, build tool, etc.)
- Determine what plugins are needed

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

### User Gate (all targets)

Present the analysis. Ask the user to validate and approve before proceeding to Stage 2.

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

## Code Example
[Complete createPlugin call showing exact spec object — NO explicit generics]
```

#### Validation Loop

After all specs are created:
1. Run the **moku-plugin-spec-validator** agent on each plugin
2. Run the **moku-spec-validator** agent to validate cross-plugin concerns (dependency graph, event flow, naming)
3. Resolve any issues found
4. Re-run until both validators report zero violations

#### Final Output

Present:
- Summary of all specifications created
- Dependency graph (visual or textual)
- Communication map (events flowing between plugins)
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
[Full plugin spec: tier, config, state, API, events, deps, tests]

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

Use the **moku-spec-validator** agent to verify:
- Plugin ordering satisfies all `depends` constraints
- No imports from `@moku-labs/core`
- Config types match framework expectations
- Custom plugins follow spec

---

### Plugin Target

Write a plugin specification file to `specifications/` (if within a framework project) or `.planning/` (if standalone). Use the same plugin spec template as the framework specs above.

Include: overview, config, state, API, events, dependencies, hooks, lifecycle, communication, package dependencies, testing strategy, and code example.

Run the **moku-plugin-spec-validator** agent to validate the spec.

---

### User Gate (all targets)

Present the completed specifications. Final approval from user.

**Wait for explicit user approval.**

---

## Rules

- Follow `specification/15-PLUGIN-STRUCTURE` complexity tiers strictly
- Every plugin must have an implementation order number
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
- The spec must be complete enough to implement without further questions
