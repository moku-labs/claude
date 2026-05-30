# Plugin Build — Detailed Steps

## Correct-First-Try checklist (confirm EACH before reporting "done")

Author against this list from line 1 — don't write freehand then fix in review. Pairs with
`skeleton-conventions.md` (hook-compliant authoring) and `house-style.md` (approved patterns).

1. `index.ts` is WIRING ONLY, ≤30 effective lines (JSDoc header + imports + blanks don't count).
2. NO explicit generics on `createPlugin`/`createCorePlugin` — types infer from the spec object.
3. `api: createApi` — pass the factory by DIRECT REFERENCE (house style; NOT `(ctx) => createApi(ctx)`).
4. Events via individual `register<T>("desc")` per event (house style; `register.map` is optional).
5. Export name is `<name>Plugin`; the plugin NAME STRING stays bare (`"router"`, not `"routerPlugin"`).
6. NO `onStart`/`onStop` unless managing a real resource (listener/server/handle). `onStop` gets ONLY
   `{ global }` — capture refs in a closure during `onStart`. If you DO manage DOM/nav listeners, keep
   them and add `// @no-resource-check — <why>` so the hook stays quiet.
7. `import type` for ALL type-only imports. Full multi-line JSDoc (`@param`/`@returns`/`@example`) on
   every export. `@returns` omitted on throw-only stubs; `jsdoc/tag-lines` = 1 blank after the
   description, 0 between tags.
8. NO inline type assertions (`x as T`, `{} as T`, `null as T`) in `createState`/`config` — use typed consts.
9. Injectable/exported function types are STRUCTURAL (own `interface`/`type`). NEVER a runtime package's
   namespace type (e.g. `import("bun").SpawnOptions.X`) — it breaks the bundled `.d.ts` even though `tsc` passes.
10. Error format EXACTLY: `[<framework>] <description>.\n  <actionable suggestion>.` — no arrows (`→`); both lines end with a period.
11. (web/UI) State & styling via `data-*` attributes, NEVER CSS classes — including in JSDoc `@example` blocks.
12. If a builder API exposes an override (`.toFile()`, `.toJson()`), the compiler/runtime MUST honor it: `override?.(x) ?? default(x)`.
13. A `depends` edge must correspond to a real `ctx.require(dep).method()` call, OR be documented inline as presence/ordering-only. No silent dead deps.
14. Framework-internal `__tests__` MAY import `createCoreConfig` from `@moku-labs/core` (the bootstrap every plugin uses — NOT a 3-layer violation).
15. `Config`/`Api` are `type` aliases, never `interface`. `createCoreConfig<Config, Events, [typeof p1, …]>` REQUIRES the third tuple arg once any explicit type arg is given.
16. Verification chain is `bunx tsc --noEmit` AND `bun run lint` AND `bun run test` AND `bun run build` (the build/`.d.ts` step catches bundling bugs tsc misses).
17. Don't guess paths — `ls`/glob before `Read`; never `Read` a directory; get the EXACT spec path from STATE.md's plugin table (spec numbers are NOT guessable).

### Filesystem safety for PARALLEL builders
- Touch ONLY files in your own plugin dir. Never edit shared barrels, `src/config.ts`, or sibling plugins.
- NEVER run `lint:fix`, a repo-wide `format`, or ANY git mutation (checkout/restore/reset/stash/clean/add/commit).
- Scoped formatting only: `bunx biome format --write src/plugins/<name>/`. Report issues as hints; the orchestrator fixes repo-wide after the wave.

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

**All plugin tests go inside the plugin directory** — in `__tests__/unit/` and `__tests__/integration/` within the plugin folder. Never create plugin tests in the root `tests/` directory.

**Unit tests** (`__tests__/unit/`) — For each domain file:
- Test state creation with various configs
- Test API methods with mocked context
- Test handler logic independently
- Use `vi.fn()` for mocking emit, require, has

**Integration test** (`__tests__/integration/[name].test.ts`) — For the full plugin:
- Create a minimal framework with the plugin
- Test lifecycle (init, start, stop)
- Test API through app object
- Test event emission and hook handling

## Step 7: Write README.md

**Context matters:**
- **Standalone plugin build** (`/moku:build plugin auth`): Write a full comprehensive README with purpose, config options, API reference, events, dependencies, and examples.
- **Framework wave build** (`/moku:build framework`): Write a minimal placeholder only (plugin name + tier + one-line description). Full READMEs are written later in the dedicated README wave (Step 5.5 of framework build) with fresh context.

## Step 8: Validate

Run the validation pipeline:

**Parallel:**
- **moku-verifier** agent — 3-level artifact check (exists, substantive, wired)
- **moku-plugin-spec-validator** agent — structure compliance
- **moku-jsdoc-validator** agent — documentation quality

**After parallel completes:**
- **moku-test-validator** agent — test quality
- **moku-type-validator** agent — type correctness

- **Test location check** — Verify no plugin tests exist in `tests/unit/plugins/` or `tests/integration/plugins/`. All plugin-specific tests must be inside `src/plugins/[name]/__tests__/`.

If BLOCKER issues found, enter gap closure (max 2 rounds).

### Step 8.5: Tick Spec Verification Checkboxes

If the plugin has a specification file with a `## Verification` section:

1. Read the spec file (`.planning/specs/0N-name.md`)
2. Evaluate each checkbox criterion against the built plugin
3. Tick passing checkboxes: `- [ ]` → `- [x]`
4. Add failure notes to failing checkboxes
5. Failed checkboxes that represent real issues → route to gap closure

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
