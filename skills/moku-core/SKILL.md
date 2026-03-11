---
name: moku-core
description: >
  Moku Core micro-kernel architecture guide. Triggers on: "moku architecture",
  "moku specification", "createCoreConfig", "createCore", "createApp",
  "moku factory chain", "three-layer model", "moku kernel", "moku lifecycle",
  "moku event system", "moku context tiers", or building moku frameworks/plugins.
---

# Moku Core Architecture

## Current Project State
!`test -f .planning/STATE.md && head -20 .planning/STATE.md || true`
!`test -f src/config.ts && echo "Framework config: src/config.ts exists" || true`

Enforce strict compliance with Moku Core specifications when generating, reviewing, or modifying code. Never skip Biome warnings. Never skip quality linter warnings. Require full JSDoc coverage on all source files. Use extended thinking (ultrathink) for complex architecture decisions.

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
                      Self-documenting manifest: JSDoc module comment with options/defaults table,
                      grouped exports (Framework API → Plugins → Helpers → Types).

Step 3 — main.ts:    createApp({ plugins?, config?, pluginConfigs? })
                      → returns App
```

Each step captures types in closures. This solves the circular dependency problem between config and plugins. The `index.ts` (Step 2) doubles as the framework's public API reference — consumers should understand all options, defaults, and exports just by reading it.

## Core Plugins

Core plugins are self-contained infrastructure plugins (log, storage, env) whose APIs are injected directly onto every regular plugin's context. Created with `createCorePlugin(name, spec)` and registered via `createCoreConfig({ plugins: [...] })`.

```typescript
const log = createCorePlugin("log", {
  config: { level: "info" },
  createState: () => ({ entries: [] as string[] }),
  api: ctx => ({
    info: (msg: string) => { ctx.state.entries.push(msg); },
  }),
});

const { createPlugin, createCore } = createCoreConfig<Config, Events>("app", {
  config: defaults,
  plugins: [log],                 // core plugins registered here
  pluginConfigs: { log: { level: "debug" } },  // core plugin config overrides
});

// Regular plugins access core APIs directly on context:
createPlugin("router", {
  api: ctx => ({
    navigate: (path: string) => { ctx.log.info("nav: " + path); },  // typed!
  }),
});
```

**Core vs Regular — when to use core:**

| Criterion | Core Plugin | Regular Plugin |
|-----------|------------|----------------|
| Needs events/hooks | No | Yes |
| Needs depends on other plugins | No | Yes |
| Needs emit | No | Yes |
| Provides utility API used by many plugins | Yes | Maybe |
| Self-contained infrastructure | Yes | No |

**Core plugin constraints:**
- NO `depends`, `events`, `hooks` — self-contained
- Context: `{ config, state }` only — no `global`, `emit`, `require`, `has`
- Lifecycle: init/start BEFORE regular plugins; stop AFTER regular plugins
- Config: 4-level cascade — spec defaults → `createCoreConfig pluginConfigs` → `createCore pluginConfigs` → `createApp pluginConfigs`

## Kernel Responsibilities (6 things, nothing else)

1. Collect plugins into ordered list
2. Validate names (no duplicates, no reserved names) and dependencies
3. Resolve config (shallow merge only — `{ ...defaults, ...overrides }`)
4. Run 3 lifecycle phases in deterministic order (core plugins first for init/start, regular first for stop)
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
- **Core plugin APIs injected flat** — `ctx.log`, `ctx.env` — no `require()` needed for core plugins.
- **Core plugin 4-level config cascade** — spec defaults → createCoreConfig → createCore → createApp.

## Event Registration Standard

All typed events use the register callback pattern:

```typescript
events: (register) => ({
  'auth:login':  register<{ userId: string }>('Triggered after user login'),
  'auth:logout': register<{ userId: string }>('Triggered after user logout'),
})
```

No explicit generics on `createPlugin`. Event types inferred from `register<T>()` calls.

## CRITICAL Anti-Pattern: No Explicit Generics on createPlugin

This is the #1 violation to watch for. All types MUST be inferred from the spec object:

```typescript
// ANTI-PATTERN — NEVER ALLOW THIS:
createPlugin<"bundler", BundlerConfig, BundlerState, { bundle(): Promise<void> }>("bundler", { ... })

// CORRECT — All types inferred from spec object:
createPlugin("bundler", {
  config: { /* types inferred from value */ },
  createState: () => ({ /* types inferred from return */ }),
  api: (ctx) => ({ /* types inferred from return */ }),
})
```

**Why:** The 3-step factory chain captures Config and Events in closures. `createPlugin` infers C, S, A, and PluginEvents from the spec. Explicit generics bypass this inference, creating fragile code that breaks when types change.

**Where to check:** Every `createPlugin(` call. If it has angle brackets before the parenthesis, it is wrong.

## Common Mistakes — DON'T Do These

```typescript
// DON'T: Deep merge config — Moku uses shallow merge ONLY
config: { theme: { ...defaults.theme, ...overrides.theme } }  // WRONG
config: { ...defaults, ...overrides }                          // CORRECT

// DON'T: Consumer imports from @moku-labs/core
import { createCoreConfig } from '@moku-labs/core';  // WRONG in consumer
import { createApp } from 'my-framework';             // CORRECT

// DON'T: Return state directly from API — leaks mutable internals
api: (ctx) => ({
  getState: () => ctx.state,                   // WRONG — exposes mutable object
  getSessions: () => [...ctx.state.sessions],  // CORRECT — return copy/closure
})

// DON'T: Use emit for request/response — events are notifications
ctx.emit('auth:getUser', { id });       // WRONG — events don't return values
ctx.require(auth).getUser(id);          // CORRECT — use require() for queries

// DON'T: Make a core plugin that needs events or depends
createCorePlugin("router", {
  depends: [auth],                     // WRONG — core plugins are self-contained
  events: (r) => ({ ... }),            // WRONG — core plugins can't have events
})
```

## Context Tiers

| Method | Context | Available |
|--------|---------|-----------|
| Core plugin `api`, `onInit`, `onStart`, `onStop` | CorePluginContext | `config`, `state` |
| `createState` | MinimalContext | `global`, `config` |
| `hooks`, `api`, `onInit`, `onStart` | PluginContext | `global`, `config`, `state`, `emit`, `require`, `has`, + core APIs |
| `onStop` | TeardownContext | `global` only |

**Important:** `onStart` and `onStop` are OPTIONAL. They are only needed when:
- **onStart:** Opening server connections, starting listeners, mounting UI, or other runtime initialization that cannot happen during synchronous init
- **onStop:** Closing connections, flushing buffers, unmounting, or other teardown

Most plugins (CLI tools, build tools, utility plugins, config-only plugins) do NOT need start/stop. Only include them when there is an actual resource to manage.

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

## Advanced References (load when needed)

For complex projects with 5+ plugins or core plugin design:
!`find src/plugins -mindepth 1 -maxdepth 1 -type d 2>/dev/null | awk 'END{if(NR>4)print "Large project detected — consult references/type-system.md for advanced type helpers and references/build-framework.md for framework assembly patterns."}' || true`
!`grep -rq 'createCorePlugin' src/ 2>/dev/null && echo "Core plugins in use — consult references/plugin-settings.md for 4-level config cascade details." || true`

## Related Skills

- **moku-plugin** — Plugin structure, complexity tiers, file organization, wiring harness pattern
- **moku-web** — Preact + Vite web patterns, island architecture, CSS architecture with @scope/@layer

### Cross-Skill Example: Router Plugin with Web Integration

```typescript
// 1. moku-core: Define events in config.ts
type Events = { 'router:navigate': { from: string; to: string } };
const { createPlugin, createCore } = createCoreConfig<Config, Events>('app', { config: defaults });

// 2. moku-plugin: Standard tier plugin in plugins/router/index.ts (~30 lines)
import { createRouterApi } from './api';       // domain logic extracted
export const router = createPlugin('router', {
  config: { basePath: '/' },
  createState: () => ({ currentPath: '/' }),
  api: createRouterApi,                        // wiring harness pattern
});

// 3. moku-web: Island handles client-side navigation
// components/NavigationIsland.ts — vanilla TS, no framework
export const Navigation = createComponent('nav', {
  onCreate(el) { el.querySelectorAll('a').forEach(a => a.addEventListener('click', handleNav)); },
});
```
