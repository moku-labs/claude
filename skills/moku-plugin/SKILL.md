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
!`if [ -f .planning/STATE.md ]; then grep -A2 '## Phase:' .planning/STATE.md 2>/dev/null; fi`
!`if [ -d src/plugins ]; then echo "Existing plugins:"; ls src/plugins/ 2>/dev/null; fi`

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
import { rendererPlugin } from '../renderer';
import { createRouterState } from './state';
import { createRouterApi } from './api';
import { handleRouteNotFound } from './handlers';

export const routerPlugin = createPlugin('router', {
  depends: [rendererPlugin],
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
- Unit tests live in `__tests__/unit/`
- Integration tests live in `__tests__/integration/`

## References

For detailed specifications:
- `references/plugin-structure.md` — Full complexity tier details with examples
- `references/plugin-patterns.md` — Connection point pattern, file structure, LLM prompt
- `references/domain-scenarios.md` — Domain-specific layouts (utility, CLI, build, web, SPA)
