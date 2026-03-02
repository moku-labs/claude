---
name: moku-plugin
description: >
  This skill should be used when the user works with Moku plugin structure,
  asks about "plugin structure", "plugin file", "plugin tier", "complexity tier",
  "plugin organization", "nano plugin", "micro plugin", "standard plugin",
  "complex plugin", "plugin patterns", "wiring harness", "plugin index.ts",
  "plugin file layout", "plugin directory", or needs guidance on organizing
  plugin code following Moku specification 15.
version: 0.1.0
---

# Moku Plugin Structure

Enforce strict compliance with Moku plugin structure specification. Follow all plugin structure rules. Require full JSDoc coverage on all source code. Be creative within the defined guidelines.

## The Rule

**A plugin file is a wiring harness, not business logic.** The `index.ts` connects domain code to the system. It is NOT where you write business logic. Domain logic lives in separate files (`api.ts`, `state.ts`, `handlers.ts`).

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
