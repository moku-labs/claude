# From-Existing Migration — Analysis Instructions

This file contains the detailed analysis instructions for migrating an existing non-Moku project to Moku Core. Referenced by Step 0.3 of the `/plan` command.

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
