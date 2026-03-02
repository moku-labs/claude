---
description: Build a framework from a plan specification
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
argument-hint: [spec-path]
---

Build a complete Moku framework from a specification plan. The plan path (`$1`) defaults to `.planning/framework-spec.md` if not provided.

## Process

### Step 1: Read and Validate the Plan

Read the specification from the provided path. Verify it contains:
- Global Config and Events types
- Plugin list with implementation order
- Plugin specifications with configs, states, APIs, events

If the plan is incomplete, ask the user to run `/moku:plan_framework` first.

### Step 2: Implement in Order

Follow the implementation order from the spec. For each plugin:

1. **Create the plugin directory** following the specified complexity tier
2. **Write types.ts** — Config, State, API, Events types (for Standard+)
3. **Write state.ts** — `createState` factory (for Standard+)
4. **Write api.ts** — API factory (for Standard+)
5. **Write handlers.ts** — Event handlers (if hooks exist, Standard+)
6. **Write index.ts** — Plugin wiring (~30 lines, imports from domain files)
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
- Use the **moku-plugin-spec-validator** agent on each plugin
- Use the **moku-jsdoc-validator** agent on all source files
- Use the **moku-spec-validator** agent on the framework structure

### Step 5: Report

Summarize what was built:
- Number of plugins created
- Files created per plugin
- Test coverage
- Any issues found and fixed

## Large Framework Handling

If the framework has more than 5 plugins:

1. Build plugins in batches of 3-5
2. After each batch, run validation
3. If context is getting large, tell the user:
   > "I've completed plugins #1-#5. To continue with the remaining plugins, please clear the context and run `/moku:build_framework [spec-path]` again. I'll detect the already-built plugins and continue from where I left off."
4. When resuming, check which plugins already exist and skip them

## Quality Requirements

- Full JSDoc on ALL source files (functions, types, interfaces)
- `import type` for type-only imports
- Plugin index.ts must be ~30 lines of wiring
- Every plugin must have unit + integration tests
- All tests must pass
- Biome and ESLint must pass with zero warnings
- Follow the exact complexity tier specified in the plan
