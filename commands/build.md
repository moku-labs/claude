---
description: Build a framework, consumer app, or plugin from a specification
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
argument-hint: [framework|app|plugin] [spec-path-or-name]
---

Build a Moku project from a specification plan. The input (`$ARGUMENTS`) can be:

- `framework` — build framework from `specifications/` directory
- `framework specifications/` — explicit spec path
- `framework config` — build only config.ts + index.ts (skip plugins)
- `framework plugins` — build only plugins (skip config if exists)
- `app` — build consumer app from `.planning/app-spec.md`
- `app .planning/app-spec.md` — explicit plan path
- `plugin auth` — build plugin "auth" from description or matching spec
- `plugin #3` — build plugin #3 from `specifications/03-*.md`
- `plugin #3-#5` — build plugins #3 through #5
- `plugin #3,#5,#7` — build specific plugins by number
- `plugin specifications/03-auth.md` — build from explicit spec file
- `resume` — continue from `.planning/STATE.md`

---

## Step 0: Detect Target

Parse `$ARGUMENTS`:
1. If the first word is `resume` — read `.planning/STATE.md` and continue from the last recorded position. Skip to the appropriate build step.
2. If the first word is exactly `framework`, `app`, or `plugin` — use it as the target. The rest is the spec path or plugin name.
3. If no explicit target keyword, auto-detect:
   a. `specifications/*.md` files exist → **framework**
   b. `.planning/app-spec.md` exists → **app**
   c. Both exist → ask the user which to build
   d. Argument matches a plugin name, `#N` pattern, or spec file path → **plugin**
4. If no specs found and no recognizable argument → tell the user: "No specifications found. Run `/moku:plan` first to create a plan."

For **plugin** targets, resolve the argument:
- `#N` → find `specifications/0N-*.md` (e.g., `#3` → `specifications/03-*.md`)
- `#N-#M` → find all specs from N to M (e.g., `#3-#5` → specs 03, 04, 05)
- `#N,#M,#P` → find specific specs (e.g., `#3,#5,#7`)
- A name like `auth` → search `specifications/*-auth.md` or build from description
- A file path → use directly

### State Check

Before starting, check if `.planning/STATE.md` exists:
- If it does, read it to understand what has already been built
- Skip plugins/waves that are already marked as complete
- Report: "Detected existing state. Resuming from [position]. Already built: [list]."

---

## Framework Build

### Step 1: Read and Validate the Plan

Read the specification from the provided path (defaults to `specifications/`). If a directory, read `01-*.md`, `02-*.md`, etc. in order. Verify it contains:
- Global Config and Events types
- Plugin list with implementation order
- Plugin specifications with configs, states, APIs, events

If the plan is incomplete, ask the user to run `/moku:plan framework` first.

### Step 2: Wave Analysis

Analyze all plugin specifications and group into dependency-aware waves:

```
1. Read all specifications/0N-*.md files
2. Parse dependency graph from each spec's Dependencies section
3. Group into waves:
   Wave 1: Plugins with NO dependencies (can build in parallel)
   Wave 2: Plugins depending ONLY on Wave 1 plugins (can build in parallel)
   Wave 3: Plugins depending on Wave 1-2 plugins (can build in parallel)
   ... etc.
4. If specs include Wave assignments from /moku:plan, use those
5. Otherwise, compute waves from dependency graph
```

Present the wave plan to the user:
```
Wave 1 (parallel): env [Nano], logger [Micro], configValidator [Nano]
Wave 2 (parallel): router [Standard] (→ env), content [Standard] (→ logger)
Wave 3 (sequential): renderer [Complex] (→ router, content)
```

### Step 3: Build by Waves

For each wave, build all plugins in the wave. Within a wave, **spawn parallel sub-agents** for independent plugins using the Agent tool.

#### Per-Plugin Executor (Sub-Agent)

Each plugin in a wave is built by a dedicated sub-agent. The sub-agent receives minimal context for fresh, focused execution:

**Agent prompt structure:**
```
You are building a Moku plugin. Follow the moku-plugin skill strictly.

## Specification
[Full contents of specifications/0N-name.md]

## Framework Config
[Contents of src/config.ts — for import paths and type references]

## Dependency Plugin Interfaces
[For each dependency: contents of src/plugins/dep-name/index.ts]

## Build Rules
- Follow complexity tier [tier] file structure exactly
- No explicit generics on createPlugin — all types inferred
- Full JSDoc on all exports with @param, @returns, @example
- Write unit tests for each domain file + integration test
- Use import type for type-only imports
- Only include onStart/onStop if spec justifies resource management

## Files to Create
[List from tier: index.ts, types.ts, state.ts, api.ts, handlers.ts, README.md, tests]

## Verification Criteria
[Contents of the ## Verification section from the spec]
```

**Parallel execution within waves:**
- Wave 1 plugins have no dependencies on each other — spawn all agents simultaneously
- Wave 2 plugins may share Wave 1 dependencies but not each other — spawn all simultaneously
- For waves with < 4 plugins: all parallel
- For waves with 4+ plugins: batch into groups of 3 parallel agents

#### Plugin Implementation Order (per sub-agent)

Each sub-agent builds its plugin following this order:

1. **Create the plugin directory** following the specified complexity tier
2. **Write types.ts** — Config, State, API, Events types (for Standard+)
3. **Write state.ts** — `createState` factory (for Standard+)
4. **Write api.ts** — API factory (for Standard+)
5. **Write handlers.ts** — Event handlers (if hooks exist, Standard+)
6. **Write index.ts** — Plugin wiring (~30 lines, imports from domain files)
   - **Verify no explicit generics** — The `createPlugin(` call must NOT have type parameters.
   - **Verify lifecycle necessity** — Only include `onStart`/`onStop` if the spec explicitly states a resource.
7. **Write README.md** — Plugin documentation
8. **Write unit tests** — For each domain file
9. **Write integration test** — For the full plugin wiring

### Step 4: Post-Wave Verification + Integration

After each wave's sub-agents complete, run verification and integrate into the framework:

#### Step 4a: Plugin Verification

1. Spawn the **moku-verifier** agent on all plugins in the wave
   - Level 1: All tier files exist
   - Level 2: Files contain real implementations (not stubs)
   - Level 3: Plugins wired correctly, lint passes, tests pass
2. If ALL plugins pass → proceed to Step 4b
3. If ANY plugin fails → enter Gap Closure (Step 4c)

#### Step 4b: Update Framework Files + Integration Checks

After the wave's plugins pass verification, update the framework files to include them:

1. **Update `src/config.ts`** — Add the wave's plugin Config and Events types to the framework Config/Events unions
2. **Update `src/index.ts`** — Import the wave's plugins, add to `createCore` default plugins list, add to re-exports
3. **Update `package.json`** — Add any new dependencies from this wave's plugin specs

Then run integration checks in the target workspace:

1. **Format** — `bun run format` (Biome auto-formats all files)
2. **Lint** — `bun run lint` → if errors, run `bun run lint:fix` then re-check. Manually fix anything lint:fix cannot resolve.
3. **TypeScript** — `bunx tsc --noEmit` passes with zero errors. Fix all type errors.
4. **Build** — `bun run build` compiles without errors (if build script exists)

**Loop until clean**: If any check still fails after fixes, re-run the full sequence. All checks must pass with zero errors and zero warnings before proceeding to the next wave.

Update STATE.md with wave completion + integration check results, then proceed to next wave.

#### Step 4c: Gap Closure

When verification finds issues:

1. Collect all verification failures into a gap list
2. For each gap, spawn a targeted fix agent with:
   - The specific file(s) that failed
   - The verification criteria that failed
   - The relevant plugin specification
   - Instructions to fix ONLY the identified issues (no refactoring)
3. After fixes, re-run the **moku-verifier** agent on affected plugins
4. **Circuit breaker:** Maximum 2 gap closure rounds per wave. If issues persist after 2 rounds, report to user:
   > "Some verification issues remain after 2 fix attempts. Remaining issues: [list]. Please review and fix manually, then run `/moku:build resume`."

### Step 5: Final Framework Verification

After all plugin waves are complete, framework files should already be up-to-date from Step 4b. Run a final verification:

1. Verify `src/config.ts` includes ALL plugin types from every wave
2. Verify `src/index.ts` imports and exports ALL plugins
3. Verify `package.json` has ALL dependencies
4. Run the full check suite one final time:
   - `bun run format`
   - `bun run lint` (fix any issues)
   - `bunx tsc --noEmit`
   - `bun run build`

Fix any remaining issues until all checks pass with zero errors and zero warnings.

### Step 6: Post-Build Validation Pipeline

Run the full validation suite across the completed framework:

**Parallel Group A (structure + docs):**
- **moku-spec-validator** agent — specification compliance per plugin
- **moku-jsdoc-validator** agent — documentation quality per plugin
- **moku-plugin-spec-validator** agent — structure compliance per plugin

**Parallel Group B (quality + types):**
- **moku-test-validator** agent — test quality per plugin
- **moku-type-validator** agent — TypeScript type correctness (once, whole project)

**Sequential (after A + B complete):**
- **moku-architecture-validator** agent — cross-plugin architecture (once, whole framework)

If any validator reports BLOCKER issues, enter gap closure. If only WARNINGs, include them in the report.

### Step 7: Report and State Update

Summarize what was built:
- Number of plugins created, grouped by wave
- Files created per plugin
- Validation results (pass/warn/fail per validator)
- Any issues found and fixed during gap closure
- Any remaining WARNINGs for the user to review

Update `.planning/STATE.md`:
```markdown
## Phase: build/complete
## Completed
- [x] Wave 1: [plugins] — verified — integration checks passed
- [x] Wave 2: [plugins] — verified — integration checks passed
- [x] Final framework verification passed
- [x] Post-build validation passed

## Validation Summary
- Spec compliance: PASS
- JSDoc coverage: PASS
- Plugin structure: PASS
- Test quality: PASS (2 WARNINGs)
- Type correctness: PASS
- Architecture: PASS
```

### Context Budget Management

After each wave, assess context usage:
1. If 3+ waves have been completed in this session, the context is getting heavy
2. Write STATE.md with current progress and suggest:
   > "Context is getting heavy. I've completed Waves 1-[N] ([list of plugins]). Run `/moku:build resume` to continue with fresh context from Wave [N+1]."
3. On `resume`, read STATE.md, skip completed waves, continue from next wave

### Quality Requirements

- Full JSDoc on ALL source files (functions, types, interfaces)
- `import type` for type-only imports
- Plugin index.ts must be ~30 lines of wiring
- Every plugin must have unit + integration tests
- All tests must pass
- Biome and ESLint must pass with zero warnings
- Follow the exact complexity tier specified in the plan
- NO explicit generics on `createPlugin` — all types inferred from spec
- NO unnecessary `onStart`/`onStop` — only when managing actual resources (servers, connections, listeners)

---

## App Build

### Step 1: Read and Validate the Plan

Read the specification from the provided path (defaults to `.planning/app-spec.md`). Verify it contains:
- Framework reference
- Plugin composition (ordered list)
- Configuration (global + per-plugin)
- Custom plugin specs (if any)
- Entry point structure

If the plan is incomplete, ask the user to run `/moku:plan app` first.

### Step 2: Verify Framework

Check that the framework package is available:
- Read the framework's exports (createApp, createPlugin)
- Verify all referenced plugins exist
- Verify config types match

### Step 3: Build Custom Plugins

If the plan includes custom consumer-side plugins, build each one following the **Plugin Build** process below.

Each plugin must follow `specification/15-PLUGIN-STRUCTURE`. Full JSDoc, unit tests, integration tests.

For multiple custom plugins, use wave analysis (same as framework build) to identify parallel opportunities.

### Step 4: Create Entry Point

Write `src/main.ts` (or the specified entry file):

```typescript
import { createApp, createPlugin } from 'framework-name';
// Import optional/consumer plugins
import { customPlugin } from './plugins/custom';

const app = createApp({
  plugins: [customPlugin],
  config: {
    // Global config overrides from spec
  },
  pluginConfigs: {
    // Per-plugin configs from spec
  },
  onReady: (ctx) => {
    // Setup code from spec
  },
});

await app.start();

// Application logic from spec
```

### Step 5: Validate

Run the post-build validation pipeline:

**Parallel Group A:**
- **moku-spec-validator** agent on all source files
- **moku-plugin-spec-validator** agent on custom plugins
- **moku-jsdoc-validator** agent on all source files

**Parallel Group B:**
- **moku-test-validator** agent on custom plugin tests
- **moku-type-validator** agent (once, whole project)

If BLOCKER issues found, enter gap closure. WARNINGs included in report.

### Step 6: Report

Summarize what was built:
- Custom plugins created
- Entry point structure
- Validation results
- Any issues found and fixed

Update `.planning/STATE.md` with build results.

### App Quality Requirements

- Full JSDoc on ALL custom source files
- `import type` for type-only imports
- NEVER import from `@moku-labs/core` — only from the framework
- All tests must pass
- Biome and ESLint must pass
- Custom plugins follow the same quality standards as framework plugins

### Web Application

If the application is a web app (uses TSX, CSS, or web technologies), additionally enforce the **moku-web** skill patterns:
- Preact components with `data-*` attributes (no CSS classes in markup)
- CSS with `@scope` and `@layer`
- Island architecture for client-side interactivity
- Two-layer design token system
- Bundle size targets (JS < 8KB, CSS < 10KB gzipped)

---

## Plugin Build

### Step 1: Understand the Plugin

If referencing a spec (file path or `#N`):
- Read the spec file and find the plugin definition
- Extract all details: config, state, API, events, dependencies

If referencing multiple specs (`#N-#M` or `#N,#M,#P`):
- Read all referenced specs
- Determine build order based on dependencies
- Use wave analysis for parallel opportunities

If describing a new plugin:
- Ask clarifying questions about the plugin's purpose
- Determine the complexity tier
- Design the plugin spec (config, state, API, events, dependencies)

If building a hierarchy (e.g., "auth + session + permissions"):
- Identify all plugins in the hierarchy
- Determine implementation order based on dependencies
- Build each plugin sequentially or in parallel waves

### Step 2: Determine Complexity Tier

Using the **moku-plugin** skill, assess:
- How many spec fields are needed?
- How much domain logic per field?
- Are there sub-domains?

Select: Nano / Micro / Standard / Complex / VeryComplex

**Domain merge check (CRITICAL):** Before creating a new plugin, scan existing plugins for domain overlap:
- Does the new plugin share a domain prefix with existing plugins? (e.g. `spaHead` + `spaRouter` → merge into `spa`)
- Would the new plugin's events coordinate with an existing plugin's events?
- Would consumers naturally configure the new plugin alongside an existing one?

If overlap is detected: do NOT create a separate plugin. Instead, add a sub-module to the existing plugin (promoting it to Very Complex if needed). If no suitable plugin exists yet but the user is creating 2+ related plugins, create one Very Complex plugin with sub-modules from the start.

Also determine lifecycle needs:
- Does the plugin need `onStart`? (Only if opening connections, starting servers/listeners, mounting UI)
- Does the plugin need `onStop`? (Only if closing connections, flushing buffers, unmounting)
- If neither is needed, omit both entirely — do NOT add empty lifecycle methods

### Step 3: Create Directory Structure

Follow the tier-specific layout from `specification/15-PLUGIN-STRUCTURE`:

**Nano/Micro:**
```
plugins/[name]/
  index.ts
  README.md
  __tests__/unit/index.test.ts
```

**Standard:**
```
plugins/[name]/
  index.ts, types.ts, state.ts, api.ts, handlers.ts
  README.md
  __tests__/unit/*.test.ts
  __tests__/integration/[name].test.ts
```

**Complex:**
```
plugins/[name]/
  index.ts, types.ts, state.ts, api.ts
  [subdomain]/
    types.ts, [files].ts
  README.md
  __tests__/unit/*.test.ts
  __tests__/integration/[name].test.ts
```

**Very Complex (module directories):**
```
plugins/[name]/
  index.ts           # ~40 lines. Wiring harness. THE plugin.
  types.ts           # Shared config, state, events, context type.
  [module-a]/
    types.ts, state.ts, api.ts
  [module-b]/
    types.ts, state.ts, api.ts
  README.md
  __tests__/unit/*.test.ts
  __tests__/integration/[name].test.ts
```

### Step 4: Implement Domain Files (Standard+)

1. **types.ts** — All type definitions:
   - Config type with full defaults documented
   - State type
   - API type (return type of api factory)
   - Events type (if any) with `PluginCtx` utility from `@moku-labs/core`

2. **state.ts** — `createState` factory:
   - Receives MinimalContext only (`{ global, config }`)
   - Returns the state object
   - Full JSDoc with `@param`, `@returns`, `@example`

3. **api.ts** — API factory:
   - Receives PluginContext
   - Returns the public API object
   - Each method has full JSDoc
   - Methods return closures over state (never leak raw state)

4. **handlers.ts** — Event handlers (if hooks exist):
   - Factory functions that receive context and return handlers
   - Full JSDoc on each handler factory

### Step 5: Implement index.ts

Write the plugin wiring file (~30 lines):
- JSDoc header with tier, description, events, `@see README.md`
- Import all domain files
- `createPlugin(name, spec)` with all fields wired
- **CRITICAL:** The `createPlugin(name, spec)` call must NOT have explicit type parameters. All types are inferred from the spec fields. If you find yourself wanting to write `createPlugin<...>`, the types should instead be defined in `types.ts` and used in domain files.

### Step 6: Write Tests

**Unit tests** — For each domain file:
- Test state creation with various configs
- Test API methods with mocked context
- Test handler logic independently
- Use `vi.fn()` for mocking emit, require, has

**Integration test** — For the full plugin:
- Create a minimal framework with the plugin
- Test lifecycle (init, start, stop)
- Test API through app object
- Test event emission and hook handling

### Step 7: Write README.md

Document:
- Plugin purpose and domain
- Configuration options
- Public API with examples
- Events emitted
- Dependencies

### Step 8: Validate

Run the validation pipeline:

**Parallel:**
- **moku-verifier** agent — 3-level artifact check (exists, substantive, wired)
- **moku-plugin-spec-validator** agent — structure compliance
- **moku-jsdoc-validator** agent — documentation quality

**After parallel completes:**
- **moku-test-validator** agent — test quality
- **moku-type-validator** agent — type correctness

If BLOCKER issues found, enter gap closure (max 2 rounds).

### Large Plugin Handling

If the plugin is Complex or VeryComplex:

1. Build the root structure first (`index.ts`, `types.ts` with shared config/state/events/context type)
2. Build sub-modules one at a time (each with own `types.ts`, `state.ts`, `api.ts`)
3. Wire each sub-module into the root `index.ts` as you go (namespaced API, composed state)
4. If context is getting large, tell the user:
   > "I've completed the core structure and [N] sub-modules. To continue, please clear the context and run `/moku:build plugin [name]` again."
5. When resuming, detect existing files and continue from where stopped

For Very Complex plugins specifically:
- Root `types.ts` declares: shared config type (nested by sub-module), composed state type, events type, context type alias (`PluginCtx<Config, State, Events>`)
- Each sub-module factory receives the shared context type: `createXxxApi(ctx: PluginCtx)`
- Root `index.ts` uses `register.map<Events>()` for bulk event registration
- Root `createState` composes sub-module state factories

### Plugin Rules

- Scope must be ISOLATED — one plugin, one domain concern
- Follow `specification/15-PLUGIN-STRUCTURE` exactly for the chosen tier
- Full JSDoc on ALL code — no exceptions
- Unit tests for every domain file
- Integration test for the full plugin
- index.ts must be wiring only (~30 lines)
- Never leak state through API
- Use `import type` for type-only imports
- NEVER use explicit generics on `createPlugin` — types inferred from spec
- NEVER include `onStart`/`onStop` without a concrete resource to manage
