---
name: moku-plugin
description: >
  Moku plugin structure and complexity tiers. Triggers on: "moku plugin structure",
  "moku plugin tier", "moku nano/micro/standard/complex plugin", "moku wiring harness",
  "moku plugin file layout", "moku plugin organization", "createPlugin structure",
  or organizing plugin code in a Moku framework project.
---

# Moku Plugin Structure

## Current Project State
!`test -f .planning/STATE.md && grep -A2 '## Phase:' .planning/STATE.md 2>/dev/null || true`
!`test -d src/plugins && echo "Existing plugins:" && ls src/plugins/ 2>/dev/null || true`

Enforce strict compliance with Moku plugin structure specification. Follow all plugin structure rules. Require full JSDoc coverage on all source code. Be creative within the defined guidelines.

## The Rule

**A plugin file is a wiring harness, not business logic.** The `index.ts` connects domain code to the system. It is NOT where you write business logic. Domain logic lives in separate files (`api.ts`, `state.ts`, `handlers.ts`).

## CRITICAL: No Explicit Generics on createPlugin

Every `createPlugin` call MUST rely on type inference from the spec object. Never pass type parameters explicitly.

```typescript
// WRONG — Explicit generics bypass inference:
createPlugin<"auth", AuthConfig, AuthState, AuthApi>("auth", { ... })

// CORRECT — Types inferred from the spec:
createPlugin("auth", {
  config: { sessionDuration: 3600 },
  createState: () => ({ sessions: new Map() }),
  api: (ctx) => ({
    login: (userId: string) => { /* ... */ },
  }),
})
```

This applies to ALL tiers (Nano through VeryComplex). If a Standard+ plugin extracts types to `types.ts`, the types are used in domain files (api.ts, state.ts), NOT as generics on createPlugin.

## Complexity Tiers

Choose the simplest tier that fits. Promote when the file outgrows its tier. Never force a complex structure on a simple plugin.

| Tier | When | Files |
|------|------|-------|
| **Nano** | 1-2 spec fields, < 30 lines | `index.ts`, `README.md`, `__tests__/unit/` |
| **Micro** | 2-3 spec fields, < 80 lines | `index.ts`, `README.md`, `__tests__/unit/` |
| **Standard** | 3+ spec fields, any function > 20 lines | `index.ts`, `types.ts`, `state.ts`, `api.ts`, `handlers.ts`, `README.md`, `__tests__/` |
| **Complex** | Sub-domains (providers, transforms) | Standard + subdirectories (`providers/`, `transforms/`) |
| **Very Complex** | Multiple coordinating domain modules | Module directories each with `types.ts`, `state.ts`, `api.ts` |

### Promotion Triggers

| Trigger | Action |
|---------|--------|
| Any domain function > 20 lines | Extract to own file → Standard |
| Multiple domain concerns with shared types | Standard with domain files |
| Sub-domains with internal structure | Complex with subdirectories |
| Multiple coordinating modules, each with own state/API | Very Complex with module directories |
| Multiple plugins sharing a domain name, events, or coordinated state | Merge into one Very Complex plugin |

## Standard Plugin Structure (Most Common)

```
plugins/
  router/
    index.ts           # ~30 lines. Wiring only.
    types.ts           # Shared type definitions.
    state.ts           # createRouterState factory.
    api.ts             # createRouterApi factory.
    handlers.ts        # Event handler factories.
    README.md          # Plugin documentation.
    __tests__/
      unit/
        state.test.ts
        api.test.ts
      integration/
        router.test.ts
```

## Very Complex Plugin Structure

When multiple plugins share a domain (e.g. `spaHead`, `spaProgress`, `spaRouter`, `components` all relate to SPA), merge into one plugin with sub-module directories.

```
plugins/spa/
  index.ts           # ~40 lines. Wiring harness. THE plugin.
  types.ts           # Shared config, state, events, context type.
  head/api.ts
  progress/state.ts, progress/api.ts
  components/types.ts, components/state.ts, components/api.ts
  router/types.ts, router/state.ts, router/api.ts
```

Key conventions:
- **One `createPlugin` call** — sub-folders are plain TS modules, not plugins
- **Nested config** — `config: { router: {...}, progress: {...} }` (shallow merge handles it)
- **Namespaced API** — `api: ctx => ({ head: createHeadApi(), router: createRouterApi(ctx) })`
- **Sub-module factories** — `createXxxApi(ctx: SpaCtx)` receives shared context type
- **Composed state** — `createState: () => ({ router: createRouterState(), progress: createProgressState() })`
- **Event ownership** — plugin declares all events; sub-modules emit via `ctx.emit`

## Plugin index.ts Pattern

```typescript
/**
 * Router plugin — Standard tier.
 *
 * Client-side routing with navigation guards.
 * Emits `router:navigate` and `router:not-found`.
 *
 * @see README.md
 */
import { createPlugin } from '../../config';
import { renderer } from '../renderer';
import { createRouterState } from './state';
import { createRouterApi } from './api';
import { handleRouteNotFound } from './handlers';

export const router = createPlugin('router', {
  depends: [renderer],
  config: { basePath: '/', notFoundRedirect: '/404' },
  createState: createRouterState,
  api: createRouterApi,
  hooks: (ctx) => ({
    'page:error': handleRouteNotFound(ctx),
  }),
  onStart: async (ctx) => {
    void ctx.emit('router:navigate', { from: '', to: ctx.config.basePath });
  },
});
```

**Notice:** ~30 lines. Imports everything. Connects to lifecycle hooks and API slots. No domain logic.

## Common Mistakes — DON'T Do These

```typescript
// DON'T: Put business logic in index.ts — it's a wiring harness
export const authPlugin = createPlugin('auth', {
  api: (ctx) => ({
    login: async (user: string, pass: string) => {
      const hash = await bcrypt.hash(pass, 10);    // WRONG — domain logic
      const session = jwt.sign({ user }, secret);   // belongs in api.ts
      ctx.state.sessions.set(user, session);
      return session;
    },
  }),
})
// CORRECT: Extract to api.ts, import the factory
import { createAuthApi } from './api';
export const authPlugin = createPlugin('auth', { api: createAuthApi })

// DON'T: Force Standard tier on a simple plugin
// A 15-line config-only plugin doesn't need types.ts, state.ts, api.ts
// Use Nano/Micro tier — promote only when complexity demands it

// DON'T: Add onStart/onStop to plugins that don't manage resources
export const utilPlugin = createPlugin('util', {
  api: (ctx) => ({ format: (s: string) => s.trim() }),
  onStart: async () => {},   // WRONG — no resource to open
  onStop: async () => {},    // WRONG — no resource to close
})

// DON'T: Create multiple plugins for one domain concern
// spa-head, spa-router, spa-progress → merge into one "spa" plugin

// DON'T: Add "Plugin" postfix to exported plugin instances
export const routePlugin = createPlugin("route", { ... })
export const authPlugin = createPlugin("auth", { ... })

// CORRECT: Use bare name matching the plugin string name
export const route = createPlugin("route", { ... })
export const auth = createPlugin("auth", { ... })
// Exception: use a distinct name when collisions exist (e.g., router vs route helper)

// DON'T: Parameterize createPlugin and dependencies through a factory
export function wireFooPlugin(pluginFactory, dep) {
  return pluginFactory("foo", { depends: [dep], ... });
}
export const foo = wireFooPlugin(createPlugin, bar);

// CORRECT: Import directly — no indirection
import { createPlugin } from "../../config";
import { bar } from "../bar";
export const foo = createPlugin("foo", { depends: [bar], ... });

// DON'T: Inline type assertions in createState or config
createState: () => ({ processor: null as import("unified").Processor | null })
config: { routes: {} as Record<string, RouteInput> }

// CORRECT (Standard+): Define type, use typed factory
// types.ts: export interface PipelineState { processor: Processor | null; }
// state.ts: export const createPipelineState = (): PipelineState => ({ processor: null });
createState: createPipelineState,

// CORRECT (Nano/Micro): Return-type annotation
createState: (): { processor: Processor | null } => ({ processor: null }),
```

## Lifecycle: start() and stop() Are Optional

`onStart` and `onStop` are NOT required. Include them ONLY when there is a concrete reason:

| Domain | onStart needed? | onStop needed? | Reason |
|--------|----------------|----------------|--------|
| Web server | Yes | Yes | Open/close listening socket |
| Database | Yes | Yes | Open/close connection pool |
| SPA client | Maybe | Rarely | Mount islands / unmount for HMR |
| CLI tool | No | No | Runs synchronously, no server |
| Build tool | No | No | Runs during init, no persistent process |
| Utility/Config | No | No | Pure functions, no resources |

**Rule:** If your plugin has no connections to open, no listeners to start, and no resources to manage, omit onStart and onStop entirely.

## JSDoc Requirements

Every file must have full JSDoc. Plugin index.ts must have:
- Plugin tier comment (Nano/Micro/Standard/Complex/VeryComplex)
- Description of what the plugin does
- Events it emits
- `@see README.md` reference

## Testing Requirements

- **Unit tests** for each domain file independently (state, api, handlers)
- **Integration tests** for the full plugin wiring
- Unit tests live in `__tests__/unit/` inside the plugin directory
- Integration tests live in `__tests__/integration/` inside the plugin directory
- **Plugin tests live with the plugin.** Never put plugin-specific tests in root `tests/unit/plugins/` or `tests/integration/plugins/`. The root `tests/` directory is reserved for framework-level integration tests (cross-plugin scenarios, createApp validation).

## Single Instance Per Plugin Directory

Each plugin directory exports exactly ONE `createPlugin` (or `createCorePlugin`) instance. If a plugin needs helper functions (builders, factories), those are exported separately — either via the `helpers` spec field or as standalone exports alongside the plugin instance.

```typescript
// CORRECT: One plugin instance + helper
export const router = createPlugin("router", { ... });
export function route(path: string): Route { ... }  // helper, not a plugin

// WRONG: Multiple plugin instances from one directory
export const routerPlugin = createPlugin("router", { ... });
export const routerDebug = createPlugin("routerDebug", { ... });  // should be a sub-module
```

This rule enables the `src/plugins/index.ts` barrel to guarantee one-to-one mapping between plugin directories and plugin instances.

## Client Scripts

For plugins that generate browser-injected JS (livereload, analytics, error overlay): scripts > 20 lines should be extracted to a static `.js` file with `__TOKEN__` placeholders, read and interpolated at runtime. See `references/domain-scenarios.md` → "Client Scripts Pattern".

## References

For detailed specifications:
- `references/plugin-structure.md` — Full complexity tier details with examples
- `references/plugin-patterns.md` — Connection point pattern, file structure, LLM prompt
- `references/domain-scenarios.md` — Domain-specific layouts (utility, CLI, build, web, SPA, client scripts)

## Advanced References (load when needed)

For plugins with sub-module directories (Very Complex tier), read `references/domain-scenarios.md`.

## Related Skills

- **moku-core** — Architecture fundamentals, factory chain, lifecycle, event system, type system
- **moku-web** — Web-specific plugin patterns, island architecture, CSS encapsulation

### Cross-Skill Example: SPA Plugin with Web Components

```typescript
// moku-plugin: Very Complex tier — SPA plugin with web sub-modules
// plugins/spa/index.ts (~40 lines wiring harness)
import { createPlugin } from '../../config';
import { createRouterApi } from './router/api';
import { createHeadApi } from './head/api';

export const spa = createPlugin('spa', {
  config: { router: { basePath: '/' }, head: { titleSuffix: '' } },
  createState: () => ({ router: { currentPath: '/' }, head: { title: '' } }),
  api: (ctx) => ({
    router: createRouterApi(ctx),    // sub-module factory
    head: createHeadApi(ctx),        // sub-module factory
  }),
});

// moku-web: Island mounts on data-component, uses SPA plugin API
// components/NavIsland.ts
export const Nav = createComponent('nav', {
  onNavEnd({ doc }) { /* update active link from new doc */ },
});

// moku-core: Events declared in config.ts, emitted by sub-modules
// ctx.emit('router:navigate', { from, to }) — typed from framework events
```
