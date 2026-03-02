---
description: Create a specific Moku plugin with full spec compliance
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
argument-hint: [plugin-name-or-spec-ref]
---

Create a specific Moku plugin. The argument (`$ARGUMENTS`) can be:

- A plugin name and description (e.g., "auth - handles user authentication")
- A reference to a plan spec (e.g., "plugin #3 from .planning/framework-spec.md")
- A plugin hierarchy description (e.g., "auth + session + permissions plugins")

## Process

### Step 1: Understand the Plugin

If referencing a spec:
- Read the spec file and find the plugin definition
- Extract all details: config, state, API, events, dependencies

If describing a new plugin:
- Ask clarifying questions about the plugin's purpose
- Determine the complexity tier
- Design the plugin spec (config, state, API, events, dependencies)

If building a hierarchy:
- Identify all plugins in the hierarchy
- Determine implementation order based on dependencies
- Build each plugin sequentially

### Step 2: Determine Complexity Tier

Using the **moku-plugin** skill, assess:
- How many spec fields are needed?
- How much domain logic per field?
- Are there sub-domains?

Select: Nano / Micro / Standard / Complex / VeryComplex

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

## Large Plugin Handling

If the plugin is Complex or VeryComplex:

1. Build the core structure first (types, state, api)
2. Build sub-domains one at a time
3. If context is getting large, tell the user:
   > "I've completed the core structure and [N] sub-domains. To continue, please clear the context and run `/moku:build_plugin [name]` again."
4. When resuming, detect existing files and continue from where stopped

## Rules

- Scope must be ISOLATED — one plugin, one domain concern
- Follow `specification/15-PLUGIN-STRUCTURE` exactly for the chosen tier
- Full JSDoc on ALL code — no exceptions
- Unit tests for every domain file
- Integration test for the full plugin
- index.ts must be wiring only (~30 lines)
- Never leak state through API
- Use `import type` for type-only imports
