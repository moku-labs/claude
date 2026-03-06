---
description: Build a framework, consumer app, or plugin from a specification
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
argument-hint: [framework|app|plugin] [spec-path-or-name]
---

Build a Moku project from a specification plan. The input (`$ARGUMENTS`) can be:

- `framework` — build framework from `specifications/` directory
- `framework specifications/` — explicit spec path
- `app` — build consumer app from `.planning/app-spec.md`
- `app .planning/app-spec.md` — explicit plan path
- `plugin auth` — build plugin "auth" from description or matching spec
- `plugin #3` — build plugin #3 from `specifications/03-*.md`
- `plugin specifications/03-auth.md` — build from explicit spec file

---

## Step 0: Detect Target

Parse `$ARGUMENTS`:
1. If the first word is exactly `framework`, `app`, or `plugin` — use it as the target. The rest is the spec path or plugin name.
2. If no explicit target keyword, auto-detect:
   a. `specifications/*.md` files exist → **framework**
   b. `.planning/app-spec.md` exists → **app**
   c. Both exist → ask the user which to build
   d. Argument matches a plugin name, `#N` pattern, or spec file path → **plugin**
3. If no specs found and no recognizable argument → tell the user: "No specifications found. Run `/moku:plan` first to create a plan."

For **plugin** targets, resolve the argument:
- `#N` → find `specifications/0N-*.md` (e.g., `#3` → `specifications/03-*.md`)
- A name like `auth` → search `specifications/*-auth.md` or build from description
- A file path → use directly

---

## Framework Build

### Step 1: Read and Validate the Plan

Read the specification from the provided path (defaults to `specifications/`). If a directory, read `01-*.md`, `02-*.md`, etc. in order. Verify it contains:
- Global Config and Events types
- Plugin list with implementation order
- Plugin specifications with configs, states, APIs, events

If the plan is incomplete, ask the user to run `/moku:plan framework` first.

### Step 2: Implement in Order

Follow the implementation order from the spec. For each plugin:

1. **Create the plugin directory** following the specified complexity tier
2. **Write types.ts** — Config, State, API, Events types (for Standard+)
3. **Write state.ts** — `createState` factory (for Standard+)
4. **Write api.ts** — API factory (for Standard+)
5. **Write handlers.ts** — Event handlers (if hooks exist, Standard+)
6. **Write index.ts** — Plugin wiring (~30 lines, imports from domain files)
   - **Verify no explicit generics** — The `createPlugin(` call must NOT have type parameters. All types inferred from spec.
   - **Verify lifecycle necessity** — Only include `onStart`/`onStop` if the plugin spec explicitly states a resource that needs starting/stopping. Omit for CLI, build, utility, and config plugins.
7. **Write README.md** — Plugin documentation
8. **Write unit tests** — For each domain file
9. **Write integration test** — For the full plugin wiring

### Step 3: Create Framework Files

After all plugins are built:

1. **src/config.ts** — `createCoreConfig` with Config and Events types from spec
2. **src/index.ts** — `createCore` with all default plugins, exports `{ createApp, createPlugin }`
3. Update **package.json** with all required dependencies

### Step 4: Validate

- Run `bun run lint` — fix any Biome or ESLint issues
- Run `bun run test` — fix any test failures
- Grep for `createPlugin<` across all source files — if found, fix immediately (remove generics, let inference work)
- Use the **moku-plugin-spec-validator** agent on each plugin
- Use the **moku-jsdoc-validator** agent on all source files
- Use the **moku-spec-validator** agent on the framework structure

### Step 5: Report

Summarize what was built:
- Number of plugins created
- Files created per plugin
- Test coverage
- Any issues found and fixed

### Large Framework Handling

If the framework has more than 5 plugins:

1. Build plugins in batches of 3-5
2. After each batch, run validation
3. If context is getting large, tell the user:
   > "I've completed plugins #1-#5. To continue with the remaining plugins, please clear the context and run `/moku:build framework` again. I'll detect the already-built plugins and continue from where I left off."
4. When resuming, check which plugins already exist and skip them

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

- Run `bun run lint` — fix any issues
- Run `bun run test` — fix any test failures
- Use **moku-spec-validator** agent on all source files
- Use **moku-plugin-spec-validator** agent on custom plugins
- Use **moku-jsdoc-validator** agent on all source files

### Step 6: Report

Summarize what was built:
- Custom plugins created
- Entry point structure
- Test results
- Any issues found and fixed

### Large Application Handling

If the application has many custom plugins:

1. Build plugins in order of dependencies
2. After each batch of 3-5 plugins, validate
3. If context is getting large, tell the user:
   > "I've completed [N] custom plugins and the base setup. To continue, please clear the context and run `/moku:build app` again."
4. When resuming, detect existing files and continue

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

If describing a new plugin:
- Ask clarifying questions about the plugin's purpose
- Determine the complexity tier
- Design the plugin spec (config, state, API, events, dependencies)

If building a hierarchy (e.g., "auth + session + permissions"):
- Identify all plugins in the hierarchy
- Determine implementation order based on dependencies
- Build each plugin sequentially

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

- Use **moku-plugin-spec-validator** agent to validate structure
- Use **moku-jsdoc-validator** agent to validate documentation
- Run `bun run lint` to check formatting and linting
- Run `bun run test` to verify tests pass

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
