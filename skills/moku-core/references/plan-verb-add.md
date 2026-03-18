# Plan Verb: Add Plugin (Quick Single-Pass)

**This step runs when VERB is `add` and TYPE is `plugin`.**

This is a lightweight, single-session flow — plan, build, wire, and verify in one pass. It does NOT proceed to Stage 1/2/3 — it is self-contained.

## Prerequisites

1. Verify `src/config.ts` exists and contains `createCoreConfig` — if not: "This requires a Moku Framework project. Run `/moku:init` first."
2. Parse REQUIREMENTS: first word is plugin name, rest is description
3. If no name provided, ask: "What plugin do you want to add?"
4. Check `src/plugins/{name}/` doesn't already exist — if it does, suggest `update plugin {name}` instead

## Analyze Context

1. Read `src/config.ts` for Config and Events types
2. Read `src/index.ts` for existing plugins array and dependency order
3. Scan `src/plugins/*/index.ts` for existing plugin names, events, and APIs
4. If `.planning/specs/` exists, scan for relevant specs that mention this domain

From this analysis, determine:
- What existing plugins could this new plugin depend on?
- What events might it need to hook into?
- What events should it declare?
- Does it overlap with an existing plugin? (If yes, warn and suggest extending instead)

## Quick Spec

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

Use `AskUserQuestion` for approval:
- Question: "Plugin spec ready. Proceed to build?"
- Header: "Approve"
- Options:
  1. label: "Build it (Recommended)", description: "Approve spec and start building the plugin"
  2. label: "Edit spec", description: "Modify the specification before building"
  3. label: "Cancel", description: "Discard this plugin plan"
- multiSelect: false

If the user wants changes, adjust the spec and re-present the gate.

## Build Plugin

Follow the plugin build process from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/build-plugin.md`:

1. Determine complexity tier from the spec
2. Create directory structure matching the tier
3. Implement all domain files (types.ts, state.ts, api.ts, handlers.ts as needed)
4. Write `index.ts` (~30 lines wiring, NO explicit generics on `createPlugin`)
5. Write unit tests + integration test
6. Write README.md
7. Full JSDoc on all exports

**Quality rules:**
- `import type` for type-only imports
- No explicit generics on `createPlugin`
- No unnecessary `onStart`/`onStop`
- Plugin index.ts is wiring only — no business logic

## Wire Into Framework

1. **Update `src/config.ts`**: Add new config fields and event types if needed
2. **Update `src/index.ts`**:
   - Import the new plugin
   - Add to the plugins array in correct dependency order
   - If it depends on other plugins, place it after them
3. **Update `src/index.ts` exports**: Ensure new plugin's API is accessible via `createApp`

## Verify

Run the verification chain:

1. `bun run format` — fix formatting
2. `bun run lint` — zero warnings
3. `bunx tsc --noEmit` — zero type errors
4. `bun run test` — all tests pass (existing + new)

If any check fails, fix the issue and re-run (max 2 gap-closure rounds).

Then spawn the **moku-verifier** agent on the new plugin to confirm Level 1 (exists), Level 2 (substantive), Level 3 (wired).

## Validation Pipeline (lightweight)

After the verifier confirms the plugin is wired correctly, run targeted validators:

1. **moku-plugin-spec-validator** — verify tier assessment, file organization, index.ts quality, JSDoc coverage
2. **moku-type-validator** — verify tsc --noEmit passes, no `as any`, import type compliance
3. **moku-jsdoc-validator** — verify all exports have JSDoc with @param, @returns, @example

Spawn all 3 in parallel. If any reports BLOCKER issues, fix and re-validate (max 1 round).
WARNINGs are included in the report but don't block completion.

## Report

Show the user:
- Files created (with tier assessment)
- Files modified (config.ts, index.ts)
- Verification results (format, lint, tsc, test)
- Plugin API summary (how to use it from consumer code)

## Update State (if active)

If `.planning/STATE.md` exists:
- Add the new plugin to the plugins table
- Update the wave grouping
- Note it was added via `/moku:plan add` (not planned via full workflow)
