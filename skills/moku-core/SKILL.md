---
name: moku-core
description: >
  This skill should be used when the user works with Moku Core architecture,
  asks about "three-layer model", "createCoreConfig", "createCore", "createApp",
  "createPlugin", "factory chain", "moku specification", "moku architecture",
  "plugin lifecycle", "event system", "context tiers", "moku kernel",
  or needs guidance on building frameworks, plugins, or consumer apps
  following Moku Core specifications.
version: 0.1.0
---

# Moku Core Architecture

Enforce strict compliance with Moku Core specifications when generating, reviewing, or modifying code. Never skip Biome warnings. Never skip quality linter warnings. Require full JSDoc coverage on all source files.

## Architecture: Three Layers, Three Steps

Moku is a micro-kernel plugin framework. One export (`createCoreConfig`), three layers, each constraining the layer above.

### Layer 1 — @moku-labs/core
Single export: `createCoreConfig`. Zero domain knowledge. Pure machinery: lifecycle, plugin registry, event bus, config resolution, type inference. Runtime < 200 lines. Bundle < 5KB gzipped.

### Layer 2 — Framework
Calls `createCoreConfig<Config, Events>(id, { config })`. Defines default plugins, base config shape, event contract. Exports `createApp` and `createPlugin` to consumers.

### Layer 3 — Consumer
Imports from the framework. Single call: `createApp({ plugins?, config?, pluginConfigs? })`. Never sees `@moku-labs/core` directly.

### 3-Step Factory Chain

```
Step 1 — config.ts:  createCoreConfig<Config, Events>(id, { config })
                      → exports { createPlugin, createCore }

Step 2 — index.ts:   createCore(coreConfig, { plugins: [...] })
                      → exports { createApp, createPlugin }

Step 3 — main.ts:    createApp({ plugins?, config?, pluginConfigs? })
                      → returns App
```

Each step captures types in closures. This solves the circular dependency problem between config and plugins.

## Kernel Responsibilities (6 things, nothing else)

1. Collect plugins into ordered list
2. Validate names (no duplicates, no reserved names) and dependencies
3. Resolve config (shallow merge only — `{ ...defaults, ...overrides }`)
4. Run 3 lifecycle phases in deterministic order (forward init/start, reverse stop)
5. Dispatch events: `emit` (strictly typed, no escape hatch)
6. Freeze everything when done (`Object.freeze` on app, configs)

## Critical Design Decisions — NEVER Violate

- **No topological sort** — `depends` is validation-only. Plugin order is explicit in the array.
- **Shallow merge only** — `{ ...config, ...consumerConfig }`. No deep merge. Ever.
- **Sequential async execution** — Within each phase, plugins run one at a time, awaited.
- **Configs frozen, state mutable** — `Object.freeze` on configs. Plugin `state` is the mutable escape hatch.
- **Strict emit, no escape hatch** — `emit` only accepts known event names with typed payloads.
- **Instance-only require** — `ctx.require(plugin)` accepts PluginInstance references, not strings.
- **createApp is synchronous** — Returns `App` directly, not a Promise. `onInit` is sync.

## Event Registration Standard

All typed events use the register callback pattern:

```typescript
events: (register) => ({
  'auth:login':  register<{ userId: string }>('Triggered after user login'),
  'auth:logout': register<{ userId: string }>('Triggered after user logout'),
})
```

No explicit generics on `createPlugin`. Event types inferred from `register<T>()` calls.

## Context Tiers

| Method | Context | Available |
|--------|---------|-----------|
| `createState` | MinimalContext | `global`, `config` |
| `hooks`, `api`, `onInit`, `onStart` | PluginContext | `global`, `config`, `state`, `emit`, `require`, `has` |
| `onStop` | TeardownContext | `global` only |

## Error Message Format

All kernel errors: `[framework-name] <description>.\n  <actionable suggestion>.`

## Quality Requirements

- Full JSDoc on all exported functions, types, and interfaces
- `import type` enforced via `@typescript-eslint/consistent-type-imports`
- Biome formatting: 2-space indent, double quotes, semicolons, trailing commas off
- ESLint: unicorn, sonarjs, jsdoc plugins active
- 90% test coverage threshold (lines, functions, branches, statements)

## References

For detailed specifications, consult:
- `references/architecture.md` — 3-layer model, design principles, LLM advantages
- `references/core-api.md` — Complete function signatures with examples
- `references/plugin-system.md` — PluginSpec, createPlugin, depends, event registration
- `references/config-lifecycle.md` — Config resolution rules, 3 lifecycle phases
- `references/communication-context.md` — emit, hooks, context tiers, require/has
- `references/type-system.md` — Type helpers, BuildPluginApis, type flow
- `references/invariants.md` — Guarantees, error format, anti-patterns
- `references/tooling-config.md` — Exact Biome, ESLint, TypeScript, Lefthook, Vitest configs
