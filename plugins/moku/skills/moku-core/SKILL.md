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

Follow the Moku Core specification when generating, reviewing, or modifying code. Biome and quality-linter warnings are fixed, not skipped. Every source file carries full JSDoc coverage.

## For packs

A pack (`moku-web`, `moku-worker`, `moku-room`, `moku-design`) is a separate plugin, so
`${CLAUDE_PLUGIN_ROOT}` there points at the pack, not at the core. A pack that needs core knowledge
loads this skill with the Skill tool (`moku:moku-core`); the tool prints the skill's base directory,
and the pack reads `references/<file>` under it — `agent-preamble.md`, `moku-idioms.md`,
`moku-frameworks.md`, `spec-index.md`, `invariants.md` and the rest. Inside this plugin,
`${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/<file>` still resolves directly.

Lifecycle work starts at the conductor — the `moku` skill — which opens a change, picks the station
and invokes the lifecycle skills. This skill is knowledge only; it never drives a station.

## Architecture: Three Layers, Three Steps

Moku is a micro-kernel plugin framework. Two runtime exports (`createCoreConfig`, `createCorePlugin`), three layers, each constraining the layer above.

### Layer 1 — @moku-labs/core
Two runtime exports: `createCoreConfig` and `createCorePlugin` (plus the type-only utilities `PluginCtx`/`EmitFn`). Zero domain knowledge. Pure machinery: lifecycle, plugin registry, event bus, config resolution, type inference. Minimal runtime — the type system does the heavy lifting. Bundle < 8KB gzipped, zero dependencies.

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

## Public Export Shape (JSDoc survival)

The factory chain tempts you to destructure its results straight into exports. Don't —
JSDoc does not survive that shape to consumers. Two rules:

**1. Re-export public API as explicit, documented consts.** In `config.ts` and
`index.ts`, expand the destructure into individually-documented re-exports:

```typescript
// Wrong — docs resolve only at the destructure site; dist/*.d.ts ships them bare
export const { createPlugin, createCore } = createCoreConfig<Config, Events>(id, { config });
export const { createApp, createPlugin } = createCore(coreConfig, { plugins });

// Right — each export carries its own block; hover + emitted .d.ts both get docs
const coreConfig = createCoreConfig<Config, Events>(id, { config });
/**
 * Define a plugin for this framework. Types infer from the spec object.
 *
 * @param name - Unique plugin id.
 * @param spec - Plugin spec (config, state, api, lifecycle).
 * @returns A typed plugin definition.
 */
export const createPlugin = coreConfig.createPlugin;
/**
 * Internal: assemble the framework core from its default plugins.
 *
 * @returns The framework factory (`createApp` / `createPlugin`).
 */
export const createCore = coreConfig.createCore;
```

A destructured binding's JSDoc is resolved by TypeScript only at the destructure site.
It does not cross the module boundary: another file hovering the symbol sees nothing,
and the bundled `dist/index.d.mts` emits `declare const createApp` with no preceding
block. Inline JSDoc on the binding (`const { /** doc */ x } = …`) does not fix it
either. The explicit `export const x = source.x;` is the only form that works.

**2. A `@file` comment never substitutes for a per-export block.** A top-of-file
`@file`/`@fileoverview` comment can hoist onto the first `declare const` in the bundled
`.d.ts` and look like a real doc — it isn't one for the other exports. Give every
public export its own directly-preceding block.

Verify after build: every `declare const X` in `dist/index.d.mts` is preceded by a
`/** … */` block. `moku-style-validator` enforces both rules.

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
- No `depends`, `events`, `hooks` — self-contained
- Context: `{ config, state }` only — no `global`, `emit`, `require`, `has`
- Lifecycle: init/start before regular plugins; stop after regular plugins
- Config: 4-level cascade — spec defaults → `createCoreConfig pluginConfigs` → `createCore pluginConfigs` → `createApp pluginConfigs`

## Kernel Responsibilities (6 things, nothing else)

1. Collect plugins into ordered list
2. Validate names (no duplicates, no reserved names) and dependencies
3. Resolve config (shallow merge only — `{ ...defaults, ...overrides }`)
4. Run 3 lifecycle phases in deterministic order (core plugins first for init/start, regular first for stop)
5. Dispatch events: `emit` (strictly typed, no escape hatch)
6. Freeze everything when done (`Object.freeze` on app, configs)

## Design decisions that hold

- **No topological sort** — `depends` is validation-only. Plugin order is explicit in the array.
- **Shallow merge only** — `{ ...config, ...consumerConfig }`. No deep merge. Ever.
- **Sequential async execution** — Within each phase, plugins run one at a time, awaited.
- **Configs frozen, state mutable** — `Object.freeze` on configs. Plugin `state` is the mutable escape hatch.
- **Strict emit, no escape hatch** — `emit` only accepts known event names with typed payloads.
- **Instance-only require** — `ctx.require(plugin)` accepts PluginInstance references, not strings.
- **createApp is synchronous** — Returns `App` directly, not a Promise. `onInit` is sync.
- **Core plugin APIs injected flat** — `ctx.log`, `ctx.env` — no `require()` needed for core plugins.
- **Core plugin 4-level config cascade** — spec defaults → createCoreConfig → createCore → createApp.
- **Public exports are explicit, documented consts, never destructured.** Re-export `createApp` / `createPlugin` / `createCore` (and every plugin factory) as `export const x = source.x;` with its own directly-preceding JSDoc block. `export const { … } = framework` does not work: a destructured binding's JSDoc dies at the module boundary, so consumers and editor hover get nothing and the emitted `dist/*.d.ts` ships them bare. See [Public Export Shape](#public-export-shape-jsdoc-survival).

## Event Registration Standard

All typed events use the register callback pattern:

```typescript
events: (register) => ({
  'auth:login':  register<{ userId: string }>('Triggered after user login'),
  'auth:logout': register<{ userId: string }>('Triggered after user logout'),
})
```

No explicit generics on `createPlugin`. Event types inferred from `register<T>()` calls.

## Anti-pattern: no explicit generics on createPlugin

This is the most common violation. All types are inferred from the spec object:

```typescript
// Anti-pattern — do not write this:
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

## Common mistakes

```typescript
// Do not deep merge config — Moku uses shallow merge only
config: { theme: { ...defaults.theme, ...overrides.theme } }  // WRONG
config: { ...defaults, ...overrides }                          // CORRECT

// Do not import @moku-labs/core in a consumer
import { createCoreConfig } from '@moku-labs/core';  // WRONG in consumer
import { createApp } from 'my-framework';             // CORRECT

// Do not return state directly from an API — it leaks mutable internals
api: (ctx) => ({
  getState: () => ctx.state,                   // WRONG — exposes mutable object
  getSessions: () => [...ctx.state.sessions],  // CORRECT — return copy/closure
})

// Do not use emit for request/response — events are notifications
ctx.emit('auth:getUser', { id });       // WRONG — events don't return values
ctx.require(authPlugin).getUser(id);    // CORRECT — use require() for queries

// Do not make a core plugin that needs events or depends
createCorePlugin("router", {
  depends: [authPlugin],               // WRONG — core plugins are self-contained
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

`onStart` and `onStop` are optional. They are needed when:
- **onStart:** Opening server connections, starting listeners, mounting UI, or other runtime initialization that cannot happen during synchronous init
- **onStop:** Closing connections, flushing buffers, unmounting, or other teardown

Most plugins (CLI tools, build tools, utility plugins, config-only plugins) do not need start/stop. Include them when there is an actual resource to manage.

## Error Message Format

All kernel errors: `[framework-name] <description>.\n  <actionable suggestion>.`

## Quality Requirements

- Full JSDoc on all exported functions, types, and interfaces
- `import type` enforced via `@typescript-eslint/consistent-type-imports`
- Biome formatting: 2-space indent, double quotes, semicolons, trailing commas off
- ESLint: unicorn, sonarjs, jsdoc plugins active
- 90% test coverage threshold (lines, functions, branches, statements)

## References

**Authoritative source of truth:** `references/spec-index.md` — the fast index over the vendored
Moku Core specification (`references/spec/NN-*.md`). Before deciding or validating anything about
architecture, the API, types, lifecycle, events, or plugin structure, consult the index and open
the cited `spec/NN-*.md` file. The distilled references below are summaries that may lag the spec —
when they disagree, the spec wins.

For detailed specifications, consult:
- `references/architecture.md` — 3-layer model, design principles, LLM advantages
- `references/core-api.md` — Complete function signatures with examples
- `references/plugin-system.md` — PluginSpec, createPlugin, depends, event registration
- `references/config-lifecycle.md` — Config resolution rules, 3 lifecycle phases
- `references/communication-context.md` — emit, hooks, context tiers, require/has
- `references/type-system.md` — Type helpers, BuildPluginApis, type flow
- `references/invariants.md` — Guarantees, error format, anti-patterns
- `references/tooling-config.md` — Exact Biome, ESLint, TypeScript, Lefthook, Vitest configs (canonical target stack, TS6 baseline)
- `references/target-stack.md` — Versioned target-stack manifest (pinned versions, tsconfig deltas, detection signature) `/moku:upgrade` migrates toward
- `references/upgrade-migrations.md` — Extensible `detect→apply→verify` migration registry for `/moku:upgrade` (TS6 now; TS7/de-vibe reserved)
- `references/sandbox-index.md` — Coding-style exemplars (real moku code) — open the tier-matching plugin before writing source
- `references/memory-schema.md` — `.planning/` durable layer + STATE.md Recovery block for fast multi-session resume
- `references/tool-scoping.md` — Per-stage tool posture: why path-based write gates live in hooks, not `disallowed-tools`
- `references/skeleton-conventions.md` — Hook-compliant authoring rules (≤30-line index, typed config, structural types, JSDoc) — read before writing skeleton/plugin source
- `references/house-style.md` — Approved repo conventions validators do not block (api: createApi, framework test bootstrap, per-event register)
- `references/glossary.md` — Domain terms + ESLint abbreviation allowList so agents/spell-check don't "correct" valid names

## Advanced References (load when needed)

For projects with 5+ plugins, read `references/type-system.md` (type helpers) and `references/build-framework.md` (framework assembly patterns).
For projects using `createCorePlugin`, read `references/plugin-settings.md` (4-level config cascade).

## Context Strategy (1M-context models)

Context windows are 1M tokens. Apply context-engineering guidance rather than treating the window
as scarce:

- **Index and fetch on demand; do not front-load the whole spec.** The vendored spec is ~6,400
  lines; read `spec-index.md` (small, ~5KB) and open only the one or two `spec/NN-*.md` files a
  decision needs. More tokens in context is not automatically better — recall degrades as the
  window fills ("context rot").
- **Keep invariant material at the front for prompt-cache hits.** The spec-authority block, the
  agent preamble, and templates are stable — front-loading them lets the cache serve them cheaply
  across turns. Put volatile, task-specific content later.
- **Prefer full-context prompts; lean mode is a cost lever, not a necessity** (see
  `references/build-lean-mode.md`). The old 200K-era auto-lean and Wave-3+ throttles are relaxed.
- **Rely on server-side compaction** for genuinely long build sessions instead of pre-emptively
  stripping context.
- **Subagents isolate context.** Fan-out width itself doesn't consume the orchestrator window —
  only the summaries agents return do — so prefer delegating detailed reads to subagents.

## Related Skills

- **moku-plugin** — Plugin structure, complexity tiers, file organization, wiring harness pattern
- **`moku-web:moku-web`** (pack `moku-web`) — Preact web patterns (Vite-free, Bun-bundled), island architecture, CSS architecture with @scope/@layer
- **`moku-worker:moku-worker`** (pack `moku-worker`) — Cloudflare Workers backend: Durable Objects, Queues, R2, D1, KV
- **`moku-room:moku-room`** (pack `moku-room`) — couch multiplayer: shared screen + phones, WebRTC state sync
- **`moku-design:design`** (pack `moku-design`) — the design station and Astra

Pack skills live in other plugins: load them with the Skill tool by their id.

### Cross-Skill Example: Router Plugin with Web Integration

```typescript
// 1. moku-core: Define events in config.ts
type Events = { 'router:navigate': { from: string; to: string } };
const { createPlugin, createCore } = createCoreConfig<Config, Events>('app', { config: defaults });

// 2. moku-plugin: Standard tier plugin in plugins/router/index.ts (~30 lines)
import { createRouterApi } from './api';       // domain logic extracted
export const routerPlugin = createPlugin('router', {   // export uses <name>Plugin suffix (spec/15 §7)
  config: { basePath: '/' },
  createState: () => ({ currentPath: '/' }),
  api: createRouterApi,                        // wiring harness pattern
});

// 3. moku-web:moku-web: island handles client-side navigation
// islands/NavigationIsland.ts — vanilla TS, no framework
export const Navigation = createIsland('nav', {
  onCreate(el) { el.querySelectorAll('a').forEach(a => a.addEventListener('click', handleNav)); },
});
```
