# Plan Verb: Add Plugin (Spec Only)

**This step runs when VERB is `add` and TYPE is `plugin`.**

This is a lightweight, single-session planning flow — analyze context, create a spec, and recommend the build command. It does NOT proceed to Stage 1/2/3 and does NOT build. The plan command only plans — building is done by `/moku:build add`.

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
- Question: "Plugin spec ready. How would you like to proceed?"
- Header: "Approve"
- Options:
  1. label: "Save spec (Recommended)", description: "Save the spec and get the build command to run next"
  2. label: "Edit spec", description: "Modify the specification before saving"
  3. label: "Cancel", description: "Discard this plugin plan"
- multiSelect: false

If the user wants changes, adjust the spec and re-present the gate.

## Save Spec

Write the approved spec to `.planning/specs/{NN}-{name}.md` using the standard spec template format. Assign the next available spec number based on existing specs.

## Update State (if active)

If `.planning/STATE.md` exists:
- Add the new plugin to the plugins table with status `planned`
- Update the wave grouping (place in the next available wave after its dependencies)
- Set `## Next Action: Run /moku:build add {name}` to build this plugin
- Note it was added via `/moku:plan add`

If `.planning/STATE.md` does not exist, create a minimal one:
```markdown
## Phase: add/spec-ready
## Verb: add
## Target: {name}
## Skeleton: committed
## QuickMode: true
## PluginTable: | {name} | {tier} | planned | — |
## WaveGrouping: (single plugin)
## Next Action: Run /moku:build add {name}
```

## Report

Show the user:
- Spec summary (tier, dependencies, API surface)
- Spec file location
- **Next step recommendation:** "Spec saved to `.planning/specs/{NN}-{name}.md`. Run `/moku:build add {name}` to build, wire, and verify the plugin."

**IMPORTANT:** Do NOT invoke the build command. Do NOT read `build-plugin.md`. The plan command only creates the spec — the user runs `/moku:build add {name}` in a fresh context to execute the build.
