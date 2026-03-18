# Plan Verb: Update Existing Target

**This step runs when VERB is `update`.**

## Update Plugin (`update plugin {name} {changes}`)

1. Parse: first token of REQUIREMENTS is the plugin name, rest is the change description
2. Verify `src/plugins/{name}/` exists — if not, suggest `add plugin {name}` instead
3. Read existing plugin files: index.ts, types.ts, state.ts, api.ts, handlers.ts
4. Read `.planning/specs/*-{name}.md` if it exists (original spec)
5. Analyze current state: tier, config shape, state shape, API methods, events, dependencies
6. Compare against the change description to classify changes:
   - Config additions/modifications
   - New API methods
   - New/changed events
   - Dependency changes
   - Tier promotion (e.g., Micro → Standard)
   - Breaking changes to existing API
7. Present "Current vs Proposed" summary to user
8. If tier would change, flag explicitly
9. If breaking changes are needed, flag them with migration notes
10. Write updated spec to `.planning/specs/NN-{name}.md` (overwrite existing or create new)
11. Proceed to Stage 2 directly (skip Stage 1 — we already know the structure)

## Update App (`update app {changes}`)

1. Verify project is a consumer app (`createApp` in src/index.ts or src/main.ts)
2. Read existing app spec if exists (`.planning/app-spec.md`)
3. Read current entry point to understand plugin composition, config overrides, custom plugins
4. Compare against REQUIREMENTS to determine changes:
   - Add/remove plugins from composition
   - Change config overrides
   - Add/modify custom consumer plugins
   - New dependencies
5. Present change summary to user
6. Write updated app spec to `.planning/app-spec.md`
7. Proceed to Stage 2

## Update Framework (`update framework {changes}`)

1. Verify project is a framework (`src/config.ts` with `createCoreConfig`)
2. Read existing specs from `.planning/specs/` if they exist
3. Read current config.ts, index.ts, and plugin inventory
4. Compare against REQUIREMENTS — this may involve:
   - Adding new plugins (switch to `add plugin` flow for each)
   - Modifying existing plugin specs (per-plugin update analysis)
   - Changing framework-level config or events
5. Present change summary
6. Write updated specs as needed
7. Proceed to Stage 2

## Next

After the update analysis, proceed to **Stage 2** (Specifications) and then **Stage 3** (Skeleton + Verification). Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-stages.md` for detailed instructions. Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-templates.md` for templates.

Update `.planning/STATE.md` at each stage exit. Use `AskUserQuestion` at each gate (the stage gates in `plan-stages.md` define the exact options).
