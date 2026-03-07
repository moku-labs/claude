# Plan Stages — Detailed Instructions

This file contains the detailed per-target instructions for Stages 1, 2, and 3 of the `/plan` command. The main command file references this for on-demand reading.

---

## Stage 1: Analysis + Structure

**On entry**: Read `.planning/STATE.md` if it exists. Load any decisions from Step 0.5 and research from Step 0.6.

### Framework Target

#### If given a description:
- Ask clarifying questions about the domain (use decisions from Step 0.5 if available)
- Identify the target use case (web app, CLI, game, build tool, etc.)
- Determine what plugins are needed
- If research was performed (Step 0.6), incorporate ecosystem findings into plugin identification

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
    auth/                            # [Standard] Authentication + sessions
      index.ts, types.ts, state.ts, api.ts
    renderer/                        # [Complex] Page rendering pipeline
      index.ts, types.ts, state.ts, api.ts
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

Ask the user about:
- What kind of application they want to build
- What features it needs
- Any specific frameworks they want to use
- Performance requirements
- Target platform

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

### Plan Validation Gate (all targets)

**Before presenting to the user**, run the **moku-plan-checker** agent to validate:
- Requirement coverage (every decision maps to a plugin or config)
- Dependency graph correctness (acyclic, order-satisfiable)
- Plugin identification completeness
- Event naming conventions

If the plan-checker finds BLOCKER issues, fix them before presenting to the user. WARNINGs are included in the presentation for transparency.

### State Update (all targets)

**On exit**: Write/update `.planning/STATE.md` with:
- Phase: `stage1/pending-approval`
- Target type, plugin table, dependency graph, wave grouping
- Decisions from Step 0.5 (if any)
- Research summary from Step 0.6 (if any)

### User Gate (all targets)

Present the analysis along with the plan-checker validation results. Ask the user to validate and approve before proceeding to Stage 2.

**Wait for explicit user approval before proceeding.**

---

## Stage 2: Specifications

**On entry**: Read `.planning/STATE.md`, confirm Stage 1 is approved. Load plugin table, wave grouping, and dependency graph.

### Framework Target

#### Create Plugin Specifications

For each plugin, create a detailed development specification. Save each spec as a separate file in the project's `specifications/` directory:

- `specifications/01-[plugin-name].md`
- `specifications/02-[plugin-name].md`
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

Write a plugin specification file to `specifications/` (if within a framework project) or `.planning/` (if standalone). Use the plugin specification template from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-templates.md` — including the Verification section.

Include: overview, config, state, API, events, dependencies, hooks, lifecycle, communication, package dependencies, testing strategy, code example, and verification criteria.

1. Run the **moku-plan-checker** agent to validate the spec
2. Run the **moku-plugin-spec-validator** agent to validate the spec

---

### State Update (all targets)

**On exit**: Update `.planning/STATE.md` — mark Stage 2 as complete, list all spec files created.

### User Gate (all targets)

Present the completed specifications and validation results. Ask for explicit approval before proceeding to Stage 3.

**Wait for explicit user approval before proceeding.**

---

## Stage 3: Skeleton + Verification

**On entry**: Read `.planning/STATE.md`, confirm Stage 2 is approved. Load spec file paths and plugin table from state.

### Framework Target

#### Create the Skeleton

Using the **moku-plugin** skill for plugin file patterns and the **moku-core** skill for config.ts and index.ts:

1. **Create `src/config.ts`** — with Config and Events types as empty/placeholder, `createCoreConfig` call with core plugins in `plugins` option if applicable, exports of `{ createPlugin, createCore }`
2. **Create `src/index.ts`** — with `createCore` call importing all plugins, exports `createApp` and `createPlugin`, re-exports all plugins
3. **Create each plugin directory** following the approved tier:
   - Create ALL files for the tier (index.ts, types.ts, state.ts, api.ts, handlers.ts as needed)
   - Files should contain ONLY:
     - Correct imports and exports
     - Empty type definitions (placeholder shapes)
     - Empty function signatures (correct parameter names and return types, but NO implementation)
     - JSDoc headers with tier, description, events, `@see README.md`
   - NO actual business logic, NO implementation code
   - `createPlugin` (or `createCorePlugin` for core plugins) call uses inference — NO explicit generics
   - Core plugin skeletons must NOT have `depends`, `events`, or `hooks`
   - `onStart`/`onStop` included ONLY for plugins that were approved to need them in Stage 1

4. **Create README.md** for each plugin — with plugin name and tier only (content filled during build)

---

### App Target

Create skeleton files per the approved specification:
- `main.ts` with `createApp` call structure
- Custom plugin directories following approved tier patterns
- Configuration files as specified

---

### Plugin Target

Create skeleton files per the approved specification:
- Plugin directory following the approved tier pattern
- All files for the tier (index.ts, types.ts, state.ts, api.ts, handlers.ts as needed)
- Empty type definitions, function signatures, JSDoc headers
- No implementation code

---

### Skeleton Verification & Cleanup (all targets)

After creating all skeleton files, run a comprehensive check-and-fix loop in the target workspace. Fix ALL issues found — including pre-existing ones — until every check passes with zero errors and zero warnings.

1. **Format** — `bun run format` (Biome auto-formats all files)
2. **Lint** — `bun run lint` → if errors, run `bun run lint:fix` then re-check. Manually fix anything lint:fix cannot resolve.
3. **TypeScript** — `bunx tsc --noEmit` passes with zero errors. Fix all type errors in skeleton files.
4. **Build** — `bun run build` compiles without errors (if build script exists)

**Loop until clean**: If any check still fails after fixes, re-run the full sequence. The skeleton must reach zero errors and zero warnings across ALL checks before proceeding.

### State Update (all targets)

**On exit**: Update `.planning/STATE.md` — mark Stage 3 as complete, record verification results (pass/fail for each check). Set `Next Action` to `Run /moku:build #1` pointing to the first plugin by implementation order.

### User Gate (all targets)

Present the completed skeleton, verification results, and final state. Final approval from user.

**Wait for explicit user approval.**
