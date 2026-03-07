---
description: Quickly add a single plugin to an existing framework without full re-planning
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
argument-hint: [plugin-name] [description]
disable-model-invocation: true
---

## Project Configuration
!`if [ -f .claude/moku.local.md ]; then head -20 .claude/moku.local.md; fi`

Use configuration values above if present. Otherwise use defaults: gapClosureMaxRounds=2.

Quickly add a single plugin to an existing Moku framework — scaffold, implement, wire, and validate in one pass. This is a lightweight alternative to the full `/moku:plan` + `/moku:build` cycle.

**Input** (`$ARGUMENTS`): `<plugin-name> [description]`

Examples:
- `cache "LRU cache with TTL support"`
- `logger` (minimal — Claude infers from name)
- `auth "JWT-based authentication with refresh tokens"`

**Prerequisite**: Must be inside a Moku Framework project (`src/config.ts` with `createCoreConfig`).

---

## Step 1: Validate Environment

1. Verify `src/config.ts` exists and contains `createCoreConfig` — if not, tell user: "This command requires a Moku Framework project. Run `/moku:init` first."
2. Parse `$ARGUMENTS`: first word is plugin name, rest is description
3. If no name provided, ask the user: "What plugin do you want to add?"
4. Check `src/plugins/[name]/` doesn't already exist — if it does, tell user and offer to overwrite or pick a different name

---

## Step 2: Analyze Context

Read the existing framework to understand the plugin's context:

1. Read `src/config.ts` for Config and Events types
2. Read `src/index.ts` for existing plugins array and dependency order
3. Scan `src/plugins/*/index.ts` for existing plugin names, events, and APIs
4. If `specifications/` exists, scan for relevant specs that mention this domain

From this analysis, determine:
- What existing plugins could this new plugin depend on?
- What events might it need to hook into?
- What events should it declare?
- Does it overlap with an existing plugin? (If yes, warn and suggest extending instead)

---

## Step 3: Quick Spec

Present a compact specification to the user (NOT a full spec file — inline only):

```
Plugin: [name]
Tier: [Nano|Micro|Standard|Complex]
Description: [one-liner]
Dependencies: [list or none]
Config: [fields with defaults]
State: [fields or none]
API: [method signatures]
Events: [declared events or none]
Hooks: [events hooked or none]
Lifecycle: [onStart/onStop needs or "none — no resources to manage"]
```

Wait for user approval before proceeding. If the user wants changes, adjust and re-present.

---

## Step 4: Build Plugin

Follow the plugin build process from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/build-plugin.md`:

1. Determine complexity tier from the spec
2. Create directory structure matching the tier
3. Implement all domain files (types.ts, state.ts, api.ts, handlers.ts as needed)
4. Write `index.ts` (~30 lines wiring, NO explicit generics on `createPlugin`)
5. Write unit tests + integration test
6. Write README.md
7. Full JSDoc on all exports

**Quality rules** (same as `/moku:build`):
- `import type` for type-only imports
- No explicit generics on `createPlugin`
- No unnecessary `onStart`/`onStop`
- Plugin index.ts is wiring only — no business logic

---

## Step 5: Wire Into Framework

1. **Update `src/config.ts`**: Add new config fields and event types if needed
2. **Update `src/index.ts`**:
   - Import the new plugin
   - Add to the plugins array in correct dependency order
   - If it depends on other plugins, place it after them
3. **Update `src/index.ts` exports**: Ensure new plugin's API is accessible via `createApp`

---

## Step 6: Verify

Run the verification chain:

1. `bun run format` — fix formatting
2. `bun run lint` — zero warnings
3. `bunx tsc --noEmit` — zero type errors
4. `bun run test` — all tests pass (existing + new)

If any check fails, fix the issue and re-run (max 2 gap-closure rounds).

Then spawn the **moku-verifier** agent on the new plugin to confirm Level 1 (exists), Level 2 (substantive), Level 3 (wired).

---

## Step 7: Report

Show the user:
- Files created (with tier assessment)
- Files modified (config.ts, index.ts)
- Verification results (format, lint, tsc, test)
- Plugin API summary (how to use it from consumer code)

Example:
```
Plugin "cache" added successfully (Tier: Standard)

Created:
  src/plugins/cache/index.ts      (28 lines — wiring)
  src/plugins/cache/types.ts      (config, state, API types)
  src/plugins/cache/state.ts      (LRU cache state factory)
  src/plugins/cache/api.ts        (get, set, delete, clear, stats)
  src/plugins/cache/README.md
  src/plugins/cache/__tests__/unit/state.test.ts
  src/plugins/cache/__tests__/unit/api.test.ts
  src/plugins/cache/__tests__/integration/cache.test.ts

Modified:
  src/config.ts                   (added CacheConfig, cache events)
  src/index.ts                    (added cache plugin to array)

Verification: format ✓  lint ✓  tsc ✓  tests ✓ (12 passed)

Consumer usage:
  const app = createApp({ cache: { maxSize: 100, ttl: 60000 } });
  app.cache.set("key", value);
  app.cache.get("key");
```

---

## Step 8: Update State (if active)

If `.planning/STATE.md` exists:
- Add the new plugin to the plugins table
- Update the wave grouping
- Note it was added via `/moku:add` (not planned via `/moku:plan`)

---

## Rules

- Follow the moku-plugin skill's complexity tiers strictly
- Never use explicit generics on `createPlugin` — see moku-plugin skill
- Never add `onStart`/`onStop` unless managing actual resources
- Full JSDoc on all source files
- `import type` for type-only imports
- Consumer code never imports from `@moku-labs/core`
- If the plugin naturally belongs as part of an existing plugin (domain overlap), suggest merging instead of creating a new one
- Keep it fast — this is meant to be a quick single-session operation
