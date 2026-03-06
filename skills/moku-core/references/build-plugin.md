# Plugin Build — Detailed Steps

## Step 1: Understand the Plugin

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

## Step 2: Determine Complexity Tier

Using the **moku-plugin** skill, assess:
- How many spec fields are needed?
- How much domain logic per field?
- Are there sub-domains?

Select: Nano / Micro / Standard / Complex / VeryComplex

**Domain merge check (CRITICAL):** Before creating a new plugin, scan existing plugins for domain overlap:
- Does the new plugin share a domain prefix with existing plugins? (e.g. `spaHead` + `spaRouter` -> merge into `spa`)
- Would the new plugin's events coordinate with an existing plugin's events?
- Would consumers naturally configure the new plugin alongside an existing one?

If overlap is detected: do NOT create a separate plugin. Instead, add a sub-module to the existing plugin (promoting it to Very Complex if needed). If no suitable plugin exists yet but the user is creating 2+ related plugins, create one Very Complex plugin with sub-modules from the start.

Also determine lifecycle needs:
- Does the plugin need `onStart`? (Only if opening connections, starting servers/listeners, mounting UI)
- Does the plugin need `onStop`? (Only if closing connections, flushing buffers, unmounting)
- If neither is needed, omit both entirely — do NOT add empty lifecycle methods

## Step 3: Create Directory Structure

Follow the tier-specific layout from the moku-plugin skill:

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

## Step 4: Implement Domain Files (Standard+)

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

## Step 5: Implement index.ts

Write the plugin wiring file (~30 lines):
- JSDoc header with tier, description, events, `@see README.md`
- Import all domain files
- `createPlugin(name, spec)` with all fields wired
- **CRITICAL:** The `createPlugin(name, spec)` call must NOT have explicit type parameters. All types are inferred from the spec fields. If you find yourself wanting to write `createPlugin<...>`, the types should instead be defined in `types.ts` and used in domain files.

## Step 6: Write Tests

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

## Step 7: Write README.md

Document:
- Plugin purpose and domain
- Configuration options
- Public API with examples
- Events emitted
- Dependencies

## Step 8: Validate

Run the validation pipeline:

**Parallel:**
- **moku-verifier** agent — 3-level artifact check (exists, substantive, wired)
- **moku-plugin-spec-validator** agent — structure compliance
- **moku-jsdoc-validator** agent — documentation quality

**After parallel completes:**
- **moku-test-validator** agent — test quality
- **moku-type-validator** agent — type correctness

If BLOCKER issues found, enter gap closure (max 2 rounds).

## Large Plugin Handling

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
