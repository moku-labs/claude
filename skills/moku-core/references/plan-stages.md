# Plan Stages — Detailed Instructions

This file contains the detailed per-target instructions for Stages 1, 2, and 3 of the `/plan` command. The main command file references this for on-demand reading.

---

## Stage 1: Analysis + Structure

**On entry**: Read `.planning/STATE.md` if it exists. Load any decisions from Step 0.5, research from Step 0.6, and steering from `.planning/steering.md` (if it exists).

### Framework Target

#### If given a description:
- Ask clarifying questions about the domain (use decisions from Step 0.5 if available)
- Identify the target use case (web app, CLI, game, build tool, etc.)
- Determine what plugins are needed
- If research was performed (Step 0.6), incorporate ecosystem findings into plugin identification
- **If steering exists** (`.planning/steering.md`):
  - **Boundaries**: Reject any plugin that falls outside stated scope. If a potential plugin conflicts with a boundary, flag it to the user before including.
  - **MVP Priorities**: Mark the top-3 capabilities as `priority: high` in the plugin table. Assign these to Wave 1 when dependency constraints allow.
  - **Reference Point**: Use the stated reference project to calibrate complexity — match the reference's scope, not exceed it.
  - **Risk**: Note which plugin is most exposed to the stated risk. Stage 2 will add explicit mitigation.
  - **CI/CD**: No action in Stage 1 — Build Step 5.10 reads `## CI/CD` from steering.md to generate workflows. Include the selected CI/CD options in the Stage 3 skeleton spec's verification checklist so the user knows they will be generated at build time.

#### If given existing code:
- Read and analyze the codebase thoroughly
- Identify domain concepts that map to plugins
- Identify shared state, events, and communication patterns
- Map existing modules/classes/functions to potential plugins

#### Core Plugin Identification

Before identifying regular plugins, determine which plugins should be **core plugins**. Core plugins are self-contained infrastructure registered via `createCoreConfig({ plugins: [...] })`.

**Use this decision table:**

| Criterion | Core Plugin | Regular Plugin |
|-----------|------------|----------------|
| Needs events/hooks | No | Yes |
| Needs depends on other plugins | No | Yes |
| Needs emit | No | Yes |
| Provides utility API used by many plugins | Yes | Maybe |
| Self-contained infrastructure | Yes | No |

**Common core plugin candidates:** logging, environment detection, storage abstraction, configuration validation, feature flags, i18n utilities.

If a plugin is core, it uses `createCorePlugin(name, spec)` with NO depends/events/hooks. Its API is injected directly on every regular plugin's context (`ctx.<name>`).

#### Regular Plugin Identification

Using the **moku-core** and **moku-plugin** skills, for each identified regular plugin determine:

1. **Name** — camelCase plugin name
2. **Complexity Tier** — Nano/Micro/Standard/Complex/VeryComplex (use moku-plugin skill tier criteria)
3. **Brief Description** — One sentence explaining what it does
4. **Dependencies** — Which other plugins it depends on
5. **Has Events** — Whether it declares its own events
6. **Needs start/stop** — ONLY if it manages actual resources (servers, connections, listeners). Most plugins do NOT need start/stop.

#### Record Key Decisions

During plugin identification, record non-obvious decisions to `.planning/decision-log.md` (see `decision-knowledge-graph.md`). Specifically:
- Why a concept became a standalone plugin vs. a sub-module of another plugin
- Why a specific complexity tier was chosen (especially when borderline between tiers)
- Why two related domains were merged or kept separate
- Why a dependency direction was chosen (A depends on B, not B depends on A)
- Steering boundary violations — if a potential plugin was rejected due to stated scope boundaries

Create `.planning/decision-log.md` if it doesn't exist (use template from `plan-templates.md`).

#### Structure Constraints

Enforce these constraints on the proposed structure:
- **Root has config and index files only** — `src/config.ts` and `src/index.ts`
- **No folders that are NOT plugins** — everything under `src/plugins/`. No `src/utils/`, `src/services/`, `src/helpers/`
- **CLI/client/server entry point files** are allowed ONLY if absolutely necessary (e.g., `src/cli.ts` for a CLI framework that needs a bin entry). Must be explicitly explained and justified to the user.

#### Output: Plugin Tree Diagram + Planned Skeleton

Present a tree diagram showing the proposed structure with complexity tiers AND the planned file layout:

```
src/
  config.ts                          # Framework config (Config + Events + core plugins)
  index.ts                           # Framework entry (createCore + exports)
  plugins/
    env/                             # [Core] Environment detection
      index.ts
    logger/                          # [Core] Structured logging
      index.ts
    router/                          # [Standard] Client-side routing
      index.ts, types.ts, state.ts, api.ts, handlers.ts
      __tests__/unit/, __tests__/integration/
    auth/                            # [Standard] Authentication + sessions
      index.ts, types.ts, state.ts, api.ts
      __tests__/unit/, __tests__/integration/
    renderer/                        # [Complex] Page rendering pipeline
      index.ts, types.ts, state.ts, api.ts
      __tests__/unit/, __tests__/integration/
      transforms/
        markdown.ts, html.ts, types.ts
```

Core plugins are tagged `[Core]` and stored in the same `src/plugins/` folder. They use `createCorePlugin` instead of `createPlugin`.

For each plugin, note:
- Tier in brackets
- Whether it needs `onStart`/`onStop` (and why, if yes)
- Dependencies as arrows or notes
- Files that will be created per tier

**Do NOT create files yet** — this is a plan, not execution.

---

### App Target

#### Step 1: Understand Requirements

Use `AskUserQuestion` to gather requirements efficiently:

1. First question — application type:
   - Question: "What kind of application are you building?"
   - Header: "App type"
   - Options: "Web app" / "Mobile app" / "Desktop app" / "CLI tool"

2. Follow-up questions as needed using `AskUserQuestion` for structured choices (framework preferences, performance priorities, etc.) or direct conversation for open-ended requirements.

#### Step 2: Analyze Available Frameworks and Plugins

Search the project for:
- Framework packages (look for `createApp` and `createPlugin` exports)
- Available plugins (both framework defaults and optional)
- Plugin APIs and their capabilities
- Framework config shape and events

Read all relevant source files to understand what's available.

#### Step 3: Gap Analysis

Compare requirements against available plugins:
- Which requirements are covered by existing plugins?
- Which requirements need new consumer-side plugins?
- Which requirements need framework extensions?
- Are there missing dependencies?

#### Step 4: Design the Application

1. **Plugin Composition** — Which plugins to include, in what order
2. **Config Overrides** — What global config values to set
3. **Plugin Configs** — Per-plugin configuration
4. **Custom Plugins** — Consumer-side plugins needed (with full specs)
5. **Entry Point** — `createApp` call structure

#### Step 5: Plan Documentation

- JSDoc requirements for all custom code
- README for the application
- API documentation for custom plugins
- Integration documentation (how everything connects)

---

### Plugin Target

#### Step 1: Understand the Plugin

If referencing a spec:
- Read the spec file and find the plugin definition
- Extract all details: config, state, API, events, dependencies

If describing a new plugin:
- Ask clarifying questions about the plugin's purpose
- Design the plugin spec (config, state, API, events, dependencies)

#### Step 2: Determine Complexity Tier

Using the **moku-plugin** skill, assess:
- How many spec fields are needed?
- How much domain logic per field?
- Are there sub-domains?

Select: Nano / Micro / Standard / Complex / VeryComplex

**Domain merge check (CRITICAL):** Before planning a new plugin, scan existing plugins for domain overlap:
- Does the new plugin share a domain prefix with existing plugins? (e.g. `spaHead` + `spaRouter` → merge into `spa`)
- Would the new plugin's events coordinate with an existing plugin's events?
- Would consumers naturally configure the new plugin alongside an existing one?

If overlap is detected: do NOT plan a separate plugin. Instead, plan to add a sub-module to the existing plugin (promoting it to Very Complex if needed).

Also determine lifecycle needs:
- Does the plugin need `onStart`? (Only if opening connections, starting servers/listeners, mounting UI)
- Does the plugin need `onStop`? (Only if closing connections, flushing buffers, unmounting)
- If neither is needed, omit both entirely — do NOT add empty lifecycle methods

#### Output: Plugin Design Summary

Present the plugin design: tier, config shape, state shape, API methods, events, dependencies, lifecycle justification.

---

### Update Plugin Target

**This is used when VERB is `update` and TYPE is `plugin`.**

Stage 1 is largely pre-answered for updates — the existing plugin provides the baseline. Focus on the delta:

1. Load the existing plugin analysis from Step 0.4 (current tier, config, state, API, events, dependencies)
2. Validate proposed changes against Moku constraints:
   - If tier promotion is needed, verify new tier's file structure requirements
   - If new dependencies are added, verify no cycles in the dependency graph
   - If new events are added, verify naming conventions
   - If breaking changes are proposed, identify affected consumers
3. Present the update plan: what changes, what stays, migration path for breaking changes
4. Run plan-checker before user gate

### Update App Target

**This is used when VERB is `update` and TYPE is `app`.**

1. Load existing app analysis from Step 0.4 (current composition, config, custom plugins)
2. Validate proposed changes: new plugins exist in framework, config overrides are valid types
3. If custom plugins need adding, switch to the Plugin Target flow for those
4. Present update plan: current composition vs proposed, config changes, new custom plugins
5. Run plan-checker before user gate

---

### Plan Validation Gate (all targets)

**Before presenting to the user**, run the **moku-plan-checker** agent to validate:
- Requirement coverage (every decision maps to a plugin or config)
- Dependency graph correctness (acyclic, order-satisfiable)
- Plugin identification completeness
- Event naming conventions
- **Steering alignment** (if `.planning/steering.md` exists): verify no plugin violates stated boundaries, MVP priorities are reflected in wave assignments

If the plan-checker finds BLOCKER issues, **use Interactive Triage** (read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/build-findings-triage.md`) to present each BLOCKER one-by-one via `AskUserQuestion`. The user decides: fix now, fix later, or dismiss. Fix all "Fix now" items before presenting the plan. WARNINGs are included in the presentation for transparency (no triage needed for WARNINGs).

### State Update (all targets)

**On exit**: Write/update `.planning/STATE.md` with:
- Phase: `stage1/pending-approval`
- Target type, plugin table, dependency graph, wave grouping
- Decisions from Step 0.5 (if any)
- Research summary from Step 0.6 (if any)

### User Gate (all targets)

Present the analysis along with the plan-checker validation results. Then use `AskUserQuestion`:
- Question: "Stage 1 Analysis complete. How would you like to proceed?"
- Header: "Stage 1"
- Options:
  1. label: "Approve (Recommended)", description: "Analysis looks good — proceed to Stage 2 (Specifications)"
  2. label: "Request changes", description: "Modify the plugin structure, tiers, or dependencies"
  3. label: "Add/remove plugins", description: "Change which plugins are included in the plan"
  4. label: "Start over", description: "Discard this analysis and restart Stage 1"
- multiSelect: false

Route based on selection:
- **Approve**: Update `## Phase:` to `stage1/approved`, proceed to Stage 2
- **Request changes**: Ask follow-up about what to change, re-run analysis, re-present gate
- **Add/remove plugins**: Ask which plugins to add/remove, update analysis, re-present gate
- **Start over**: Reset to pre-Stage 1 state, re-run Stage 1

---

## Stage 2: Specifications

**On entry**: Read `.planning/STATE.md`, confirm Stage 1 is approved. Load plugin table, wave grouping, and dependency graph.

### Framework Target

#### Record Spec Decisions

While creating specifications, record non-obvious design decisions to `.planning/decision-log.md`:
- API shape choices (why this signature over alternatives)
- Event structure decisions (why events are structured this way)
- State design trade-offs (why mutable Map vs immutable array, etc.)
- Risk mitigations (especially for the risk identified in steering)

#### Create Plugin Specifications

For each plugin, create a detailed development specification. Save each spec as a separate file in the project's `.planning/specs/` directory:

- `.planning/specs/01-[plugin-name].md`
- `.planning/specs/02-[plugin-name].md`
- etc. (numbered by implementation order)

Each specification file must use the appropriate template from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-templates.md`:
- **Core plugins** → Core Plugin Specification Template (simplified: no events/dependencies/hooks sections)
- **Regular plugins** → Plugin Specification Template (full template)

#### Validation Loop

After all specs are created:
1. Run the **moku-plan-checker** agent to validate cross-spec concerns (dependency graph, event flow, requirement coverage, section completeness)
2. Run the **moku-plugin-spec-validator** agent on each plugin
3. Run the **moku-spec-validator** agent to validate Moku specification compliance
4. Resolve any BLOCKER issues found
5. Re-run until all validators report zero BLOCKER violations

#### Final Output

Present:
- Summary of all specifications created
- Plan-checker validation report (with any remaining WARNINGs)
- Dependency graph (visual or textual)
- Communication map (events flowing between plugins)
- Wave grouping for parallel build execution
- Implementation order with rationale
- Example of the final consumer API

---

### App Target

#### Write the Specification

Save to `.planning/app-spec.md` (or user-specified path). Use the template from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-templates.md` (section: Application Specification Template).

#### Validate

1. Run the **moku-plan-checker** agent on the application plan
2. Use the **moku-spec-validator** agent to verify:
   - Plugin ordering satisfies all `depends` constraints
   - No imports from `@moku-labs/core`
   - Config types match framework expectations
   - Custom plugins follow spec

---

### Plugin Target

Write a plugin specification file to `.planning/specs/` (if within a framework project) or `.planning/` (if standalone). Use the plugin specification template from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-templates.md` — including the Verification section.

Include: overview, config, state, API, events, dependencies, hooks, lifecycle, communication, package dependencies, testing strategy, code example, and verification criteria.

1. Run the **moku-plan-checker** agent to validate the spec
2. Run the **moku-plugin-spec-validator** agent to validate the spec

---

### Update Plugin Specification

**This is used when VERB is `update`.** When updating an existing plugin, the spec file is an **update spec** rather than a full from-scratch spec. It must include:

- `## Changes` section listing what is being modified (added methods, changed config, new events, etc.)
- `## Preserved` section confirming what stays unchanged (existing API methods, config fields, event contracts)
- `## Migration` section if there are breaking changes (how existing consumers adapt, deprecation path)
- All other sections from the Plugin Specification Template, but reflecting the final post-update state (not just the delta)

The spec file overwrites the existing spec at `.planning/specs/NN-{name}.md` if one exists, or creates a new one.

### Update App Specification

When updating an existing app, write an updated `.planning/app-spec.md` that includes:

- `## Changes` section listing what is being modified
- `## Preserved` section confirming unchanged composition
- Updated Plugin Composition, Configuration, and Custom Plugins sections reflecting final state

---

### State Update (all targets)

**On exit**: Update `.planning/STATE.md` — mark Stage 2 as complete, list all spec files created.

### User Gate (all targets)

Present the completed specifications and validation results. Then use `AskUserQuestion`:
- Question: "Stage 2 Specifications complete. How would you like to proceed?"
- Header: "Stage 2"
- Options:
  1. label: "Approve (Recommended)", description: "Specs look good — proceed to Stage 3 (Skeleton Specification)"
  2. label: "Edit specs", description: "Modify specific plugin specifications before continuing"
  3. label: "Re-validate", description: "Run the validation pipeline again on current specs"
  4. label: "Go back to Stage 1", description: "Return to analysis — change plugin structure"
- multiSelect: false

Route based on selection:
- **Approve**: Update `## Phase:` to `stage2/approved`, proceed to Stage 3
- **Edit specs**: Ask which spec to edit, apply changes, re-validate, re-present gate
- **Re-validate**: Run plan-checker + validators again, re-present gate
- **Go back to Stage 1**: Reset phase to `stage1/pending-approval`, re-run Stage 1 gate

---

## Stage 3: Skeleton Specification

**On entry**: Read `.planning/STATE.md`, confirm Stage 2 is approved. Load spec file paths and plugin table from state.

### Framework Target

#### Produce the Skeleton Spec Document

Save to `.planning/skeleton-spec.md`. Use the Skeleton Specification Template from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-templates.md`. The document must contain all five sections:

1. **Architecture Overview** — entry structure, barrel pattern, core config registration
2. **File Structure** — complete file tree with every file annotated (tier, purpose)
3. **System Connections** — import map table, type reference chain, barrel export pattern
4. **Skeleton Build Waves** — same wave grouping as build waves; each wave contains ready-to-paste code blocks for every file (correct imports/exports, empty types, empty function bodies with correct signatures, JSDoc headers); Wave 0 must include core plugin skeletons + `src/config.ts` + `src/plugins/index.ts` + `src/index.ts`
5. **Verification Checklist** — checkboxes for format/lint/tsc/build + structural checks

**Skeleton Code Block Correctness Constraints:**
- Plugin `index.ts` files MUST import `createPlugin` from `../../config` (the framework's config.ts), NOT from `@moku-labs/core`. `@moku-labs/core` only exports `createCoreConfig` and `createCorePlugin`. The `createPlugin` factory comes from destructuring `createCoreConfig`'s return value.
- The plugin barrel (`src/plugins/index.ts`) MUST use namespace re-exports: `export * as [PascalCase] from "./[name]/types"` — NEVER `export type *` (causes ambiguous re-export when plugins share type names like Config/State/Api). Consumers access types as `PluginName.Config`, `PluginName.Api`, etc.
- Use `@file` tag, NOT `@fileoverview` (ESLint jsdoc/check-tag-names rejects `@fileoverview`). Do NOT use `@module` in plugin files (flagged as redundant outside ambient context).
- Common abbreviations (`ctx`, `fn`, `cb`) are allowed — they are whitelisted in the ESLint unicorn config. Unused stub parameters should still have an underscore prefix (e.g., `_ctx`).
- Skeleton stub bodies must use `throw new Error("not implemented")` for complex return types — NEVER `return {} as X` (violates R6: no inline type assertions).
- For plugins with `handlers.ts`, the plugin `index.ts` MUST import `createHandlers` and include a `hooks: createHandlers` field — do not create dead handler files.

**Do NOT create actual source files** — this is a specification document only.

---

### App Target

Produce `.planning/skeleton-spec.md` covering: `main.ts` structure, custom plugin skeletons per their approved tiers, framework import map, and verification checklist.

---

### Plugin Target

Produce `.planning/skeleton-spec.md` covering: tier-appropriate file structure, ready-to-paste code blocks for every file (imports, exports, empty types, empty function bodies, JSDoc headers), and verification checklist.

---

### State Update (all targets)

**On exit**: Update `.planning/STATE.md`:
- Phase: `stage3/pending-approval`
- `## Skeleton:` — preserve the current value if it is `in-progress`, `verified`, or `committed` (do not regress a build-advanced value); write `not-started` only if the field is currently absent or already `not-started`
- Add skeleton spec path to Artifacts section: `Skeleton spec: .planning/skeleton-spec.md`
- Add skeleton wave rows to Wave Progress table (one row per skeleton wave + verification + commit), all with Status `not started`
- Set `Next Action: Run /moku:build resume (skeleton build will run first)`

### User Gate (all targets)

Present the completed skeleton spec document. Then use `AskUserQuestion`:
- Question: "Stage 3 Skeleton Specification complete. Ready to build?"
- Header: "Stage 3"
- Options:
  1. label: "Approve (Recommended)", description: "Skeleton spec looks good — run /moku:build resume to start building"
  2. label: "Edit skeleton", description: "Modify file structure, wave grouping, or code blocks"
  3. label: "Go back to Stage 2", description: "Return to specifications — change plugin specs"
- multiSelect: false

Route based on selection:
- **Approve**: Update `## Phase:` to `stage3/approved` (which sets `complete`), update `## Next Action:`
- **Edit skeleton**: Ask what to change, apply edits, re-present gate
- **Go back to Stage 2**: Reset phase to `stage2/pending-approval`, re-run Stage 2 gate
