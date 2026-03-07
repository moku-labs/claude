# Migration Flows — Detailed Analysis Instructions

This file contains the detailed per-type analysis instructions for Step 2 of the `/migrate` command. The main command file references this for on-demand reading.

---

## Upgrade Analysis

Analyze the gap between current and target @moku-labs/core versions. The goal is to document every breaking change and how it affects existing plugin code, so the new project can be planned with correct patterns from the start.

### 1. Version Gap Assessment

1. Read `package.json` for current `@moku-labs/core` version
2. Determine target version (from argument, or latest from npm registry via `bun info @moku-labs/core`)
3. If already on latest, tell user: "Already on latest version (X.Y.Z). Nothing to migrate."
4. Classify the gap: patch (X.Y.Z → X.Y.W), minor (X.Y → X.Z), major (X → Y)

### 2. Changelog Analysis

1. Check `node_modules/@moku-labs/core/CHANGELOG.md`
2. If not found, check GitHub releases via moku-researcher (if spawned in Step 1)
3. For each version in the range, extract:
   - **Breaking changes** — API signature changes, removed features, config shape changes
   - **New features** — new APIs, new plugin capabilities, new utilities
   - **Deprecations** — features still working but marked for removal

### 3. Impact Assessment

For each breaking change, search the existing codebase:

| Pattern Category | What to Grep For |
|-----------------|-----------------|
| API signature changes | Old function signatures |
| Config shape changes | `src/config.ts` and plugin config fields |
| Event system changes | Event registration patterns in all plugins |
| Lifecycle changes | onInit/onStart/onStop signatures |
| Type utility changes | Imports of PluginCtx, EmitFn, ExtractApi, etc. |
| Removed features | Deprecated APIs that were removed |

For each match, record the file path, line number, and affected plugin name.

### 4. Plugin Inventory

For each plugin in `src/plugins/`:
1. Record: name, current tier, line count, spec field count
2. Flag which breaking changes affect this plugin
3. Note patterns that should change in the new version

### Output for decisions.md

Write to `.planning/decisions.md` using the Migration decisions.md Template with:
- **Migration Type**: `upgrade`, source version, target version
- **Source Analysis**: plugin inventory table with columns: Plugin, Tier, Lines, Affected By
- **Breaking Changes**: numbered list with description, affected file count, affected plugins
- **New Features**: features to adopt in the new project
- **Target Structure**: same plugin structure unless breaking changes require reorganization
- **Dependencies to Install**: updated `@moku-labs/core` version and any new peer dependencies

---

## Restructure Analysis

Audit plugin complexity tiers and detect domain merges. The goal is to produce a restructuring plan that becomes the basis for planning a new, correctly-tiered project.

### 1. Tier Audit

For each plugin in `src/plugins/`:

1. Count source lines (excluding tests and `__tests__/` directory)
2. Count spec fields in `createPlugin` call (config, state, api, events, hooks, depends)
3. Count functions longer than 20 lines
4. Count files in the plugin directory
5. Assess current tier from file structure or JSDoc header
6. Calculate recommended tier using moku-plugin skill criteria:
   - **Nano**: 1 spec field, < 30 lines, single file
   - **Micro**: 2-3 spec fields, < 80 lines, single file
   - **Standard**: 3+ spec fields, multi-file (types.ts, state.ts, api.ts, handlers.ts)
   - **Complex**: 6+ spec fields or sub-domains, subdirectories (providers/, transforms/)
   - **VeryComplex**: multiple sub-modules with independent state

Present a comparison table:

```
| Plugin | Current Tier | Lines | Spec Fields | Files | Long Fns | Recommended | Action |
|--------|-------------|-------|-------------|-------|----------|-------------|--------|
```

Actions: `None`, `Promote`, `Demote`, `Merge` (see domain merge below)

### 2. Domain Merge Detection

Scan for plugins that should be merged:

1. **Name prefix grouping** — plugins sharing a name prefix (e.g., `spaRouter`, `spaProgress`, `spaHead`)
2. **Shared event namespaces** — plugins with events under the same namespace (e.g., `spa:navigate`, `spa:loaded`)
3. **Coordinated state** — plugins that read each other's state via `ctx.require()` and always operate together
4. **Consumer co-dependency** — plugins always configured and used together, never independently

For each merge candidate group, document:
- Which plugins to merge
- Target name and tier (usually VeryComplex)
- Shared events to consolidate
- Sub-module structure within the merged plugin

### 3. Dependency Chain Review

- Build the full dependency graph
- Identify deep chains (depth > 3) that could be simplified
- Identify circular `ctx.require()` patterns (not `depends`, which would fail at boot, but runtime usage)
- Note plugins that depend on everything (god-plugin smell)

### Output for decisions.md

Write to `.planning/decisions.md` using the Migration decisions.md Template with:
- **Migration Type**: `restructure`
- **Source Analysis**: tier audit table (all plugins with current vs recommended)
- **Breaking Changes**: list of tier promotions, demotions, and merges with rationale
- **Domain Merges**: merge candidate groups with target structure and sub-modules
- **Target Structure**: proposed plugin list with new tiers and merged domains
- **Config Mappings**: namespace changes from domain merges
- **Event Mappings**: consolidated events from merged domains

---

## From-Existing Analysis

Analyze a non-Moku project to map its architecture to Moku Core concepts. The goal is to produce a complete domain mapping that the plan command can use to design a new Moku framework.

### 1. Tech Stack Identification

Read the existing project at the specified path (or current directory):

1. `package.json` — dependencies, devDependencies, scripts, engines
2. `tsconfig.json` — TypeScript configuration, strictness level, target
3. Build tool — Vite, Webpack, esbuild, tsup, tsdown, Rollup, etc.
4. Test framework — Vitest, Jest, Mocha, Playwright, etc.
5. Runtime — Node, Bun, Deno, browser

### 2. Architecture Analysis

Map the existing code structure:

1. Identify top-level directory organization (src/, lib/, app/, etc.)
2. Identify domain boundaries — groups of related files/modules
3. Identify entry points (main files, server starts, CLI handlers)
4. Identify shared state patterns (singletons, module-level variables, stores)
5. Identify communication patterns (event emitters, pub/sub, message buses, callbacks)
6. Count files and lines per domain for complexity estimation

### 3. Pattern Mapping to Moku Concepts

For each identified pattern, determine the Moku equivalent:

| Existing Pattern | Moku Concept |
|-----------------|--------------|
| Singleton module with init/teardown | Plugin with onStart/onStop |
| Shared configuration object | Framework Config (`createCoreConfig`) |
| EventEmitter / pub-sub | Moku events (`register` callback pattern) |
| Middleware chain | Plugin hooks |
| Dependency injection container | Plugin `depends` + `ctx.require()` |
| Utility library used everywhere | Core plugin (`createCorePlugin`) |
| Module with its own config + state | Plugin (tier based on complexity) |
| Global mutable state | Plugin state (isolated per plugin) |

### 4. Domain-to-Plugin Mapping

For each identified domain, propose a plugin:

1. **Name** — camelCase name following Moku conventions
2. **Tier** — estimated from file count, function count, and complexity
3. **Config fields** — extracted from existing configuration
4. **State** — extracted from existing mutable module state
5. **API methods** — extracted from existing public functions/exports
6. **Events** — extracted from existing event patterns
7. **Dependencies** — extracted from existing import relationships between domains
8. **Lifecycle** — does the domain have init/teardown? Server connections? Resource management?

Present a mapping table:

```
| Existing Module | Proposed Plugin | Tier | Source Files | LOC | Notes |
|----------------|----------------|------|-------------|-----|-------|
```

### 5. Gap Analysis

Identify what does NOT map cleanly:

- **Utility files spanning multiple domains** → candidates for core plugins
- **God modules doing too many things** → need domain splitting
- **Circular dependencies** → need restructuring in the plugin graph
- **Side effects on import** → need explicit lifecycle (onStart)
- **Global mutable state** → need plugin state isolation
- **Tightly coupled modules** → may need to be a single plugin instead of separate ones

### Output for decisions.md

Write to `.planning/decisions.md` using the Migration decisions.md Template with:
- **Migration Type**: `from-existing`, source path
- **Source Analysis**: tech stack summary, directory structure, domain list with LOC
- **Domain Mappings** (in Source Analysis): table mapping each existing domain to a proposed plugin
- **Event Mappings**: existing event patterns → Moku events
- **Config Mappings**: existing config sources → Moku config fields
- **Breaking Changes**: patterns that don't map cleanly (gaps)
- **Target Structure**: proposed Moku project tree with all plugins and tiers
- **Dependencies to Install**: packages to keep, packages to drop (replaced by Moku patterns)
- **Open Questions**: items needing user input during planning
