---
description: Create a comprehensive framework specification plan (3-stage gated workflow)
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
argument-hint: [description-or-codebase-path]
---

Create a comprehensive framework specification based on the user's input. The input (`$ARGUMENTS`) can be:

- A description of a new framework idea
- A path to existing code to migrate to Moku Core

This command runs as a **3-stage gated workflow**. Each stage ends with a user checkpoint — the user must explicitly approve before proceeding to the next stage.

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

## Stage 1: Requirements Analysis & Plugin Complexity Estimation

### If given a description:
- Ask clarifying questions about the domain
- Identify the target use case (web app, CLI, game, build tool, etc.)
- Determine what plugins are needed

### If given existing code:
- Read and analyze the codebase thoroughly
- Identify domain concepts that map to plugins
- Identify shared state, events, and communication patterns
- Map existing modules/classes/functions to potential plugins

### Plugin Identification

Using the **moku-core** and **moku-plugin** skills, for each identified plugin determine:

1. **Name** — camelCase plugin name
2. **Complexity Tier** — Nano/Micro/Standard/Complex/VeryComplex (use moku-plugin skill tier criteria)
3. **Brief Description** — One sentence explaining what it does
4. **Dependencies** — Which other plugins it depends on
5. **Has Events** — Whether it declares its own events
6. **Needs start/stop** — ONLY if it manages actual resources (servers, connections, listeners). Most plugins do NOT need start/stop.

### Structure Constraints

Enforce these constraints on the proposed structure:
- **Root has config and index files only** — `src/config.ts` and `src/index.ts`
- **No folders that are NOT plugins** — everything under `src/plugins/`. No `src/utils/`, `src/services/`, `src/helpers/`
- **CLI/client/server entry point files** are allowed ONLY if absolutely necessary (e.g., `src/cli.ts` for a CLI framework that needs a bin entry). Must be explicitly explained and justified to the user.

### Output: Plugin Tree Diagram

Present a tree diagram showing the proposed structure with complexity tiers:

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

### User Gate

Present the analysis and tree diagram. Ask the user to validate:
- Plugin list correctness
- Tier assessments
- Dependencies
- Whether any entry point files are needed and why

**Wait for explicit user approval before proceeding to Stage 2.**

---

## Stage 2: Skeleton Structure Creation

### Create the skeleton

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

4. **Create README.md** for each plugin — with plugin name and tier only (content filled in Stage 3)

### Validation Loop

After creating the skeleton:
1. Run the **moku-plugin-spec-validator** agent on each plugin
2. Resolve any structural issues found
3. Re-run validator until it reports zero violations
4. Verify no `createPlugin<` appears anywhere in the codebase

### Output: Structure Diagram

Show the user the complete created structure as a tree diagram with file sizes/line counts.

### User Gate

Present the created structure. The user can ask for changes, question the structure, or request additions.

**Wait for explicit user approval before proceeding to Stage 3.**

---

## Stage 3: Plugin Development Specifications

### Deep Analysis

Go back to the original input (description or codebase from Stage 1) and perform deep analysis:
- For existing code: trace every function, type, and data flow
- For descriptions: flesh out every detail of behavior, edge cases, error handling
- Cross-reference with the approved skeleton from Stage 2

### Create Plugin Specifications

For each plugin, create a detailed development specification using the **moku-plugin** skill. Save each spec as a separate file in the project's `specifications/` directory:

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

### Validation Loop

After all specs are created:
1. Run the **moku-plugin-spec-validator** agent to validate each spec's structural compliance
2. Run the **moku-spec-validator** agent to validate cross-plugin concerns (dependency graph, event flow, naming)
3. Resolve any issues found
4. Re-run until both validators report zero violations

### Final Output

Present:
- Summary of all specifications created
- Dependency graph (visual or textual)
- Communication map (events flowing between plugins)
- Implementation order with rationale
- Example of the final consumer API

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
