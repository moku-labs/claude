# Plugin Structure Reference

## Nano Tier (< 30 lines)

Config-only plugins, trivial API with no state, feature flags, environment detection.

```
plugins/env/
  index.ts       # Plugin definition
  README.md
  __tests__/unit/
    index.test.ts
```

```typescript
/**
 * Env plugin — Nano tier.
 * Environment detection: dev/prod mode and CI flag.
 * @see README.md
 */
import { createPlugin } from '../config';

export const envPlugin = createPlugin('env', {
  config: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    isCI: Boolean(process.env.CI),
  },
  api: (ctx) => ({
    isDev: () => ctx.config.nodeEnv === 'development',
    isProd: () => ctx.config.nodeEnv === 'production',
    isCI: () => ctx.config.isCI,
  }),
});
```

## Micro Tier (30-80 lines)

Simple state + API, self-contained domain logic that fits in one screen.

```
plugins/counter/
  index.ts
  README.md
  __tests__/unit/
    index.test.ts
```

```typescript
/**
 * Counter plugin — Micro tier.
 * Increment/decrement counter with configurable step.
 * @see README.md
 */
import { createPlugin } from '../config';

export const counterPlugin = createPlugin('counter', {
  config: { initial: 0, step: 1 },
  createState: (ctx) => ({ count: ctx.config.initial }),
  api: (ctx) => ({
    increment: () => { ctx.state.count += ctx.config.step; },
    decrement: () => { ctx.state.count -= ctx.config.step; },
    value: () => ctx.state.count,
    reset: () => { ctx.state.count = ctx.config.initial; },
  }),
});
```

Promote to Standard when crossing 80 lines or shared types emerge.

## Standard Tier (multi-file directory)

3+ spec fields. Domain functions > 20 lines inline. Shared type definitions.

```
plugins/router/
  index.ts           # ~30 lines. Wiring only.
  types.ts           # Shared type definitions.
  state.ts           # createRouterState factory.
  api.ts             # createRouterApi factory.
  handlers.ts        # Event handler factories.
  README.md
  __tests__/
    unit/
      state.test.ts
      api.test.ts
    integration/
      router.test.ts
```

## Complex Tier (multi-file + subdirectories)

Large feature plugins with multiple internal sub-domains.

```
plugins/analytics/
  index.ts           # ~25 lines. Wiring only.
  types.ts
  state.ts
  api.ts
  tracker.ts         # Core tracking logic.
  providers/
    index.ts         # Provider registry.
    google.ts
    plausible.ts
    types.ts         # Provider interface.
  README.md
  __tests__/
    unit/
      api.test.ts
      tracker.test.ts
      google-provider.test.ts
      plausible-provider.test.ts
    integration/
      analytics.test.ts
```

Subdirectories group related implementation files. Each can have its own `types.ts`. One level of barrel maximum.

## Very Complex Tier (module directories)

Multiple coordinating domain modules, each with own state, logic, and types. Rare — most plugins should split into separate plugins first.

```
plugins/cms/
  index.ts           # ~40 lines. Wiring harness.
  types.ts           # Shared types across all modules.
  content/
    types.ts, state.ts, api.ts, validator.ts
  media/
    types.ts, state.ts, api.ts, processing.ts
  versioning/
    types.ts, state.ts, api.ts
  publishing/
    types.ts, state.ts, api.ts
    targets/
      static.ts, api-endpoint.ts, types.ts
  README.md
  __tests__/
    unit/
      content-api.test.ts, media-api.test.ts, ...
    integration/
      cms.test.ts
```

**Rules:**
- Each module follows standard-tier contract: `types.ts`, `state.ts`, `api.ts`
- Root `index.ts` only wires — imports module APIs, composes namespaced public API
- Public API uses namespaced objects: `app.cms.content.create()`, `app.cms.media.upload()`
- Modules do NOT import from each other. Cross-module coordination through root state or shared types.
- One integration test at plugin root. Module-level unit tests flat in `__tests__/unit/`.

**When to split:** If modules have no shared state, events, or coordination — they should be separate plugins.

## Unit Testing Pattern

For Standard+ plugins, domain functions are pure functions that take ctx as input:

```typescript
// __tests__/unit/api.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createRouterApi } from '../api';

describe('router api', () => {
  it('should navigate', () => {
    const ctx = {
      config: { basePath: '/' },
      state: { currentPath: '/' },
      emit: vi.fn(),
      require: vi.fn(),
      has: vi.fn(),
      global: {},
    };
    const api = createRouterApi(ctx as any);
    api.navigate('/about');
    expect(ctx.state.currentPath).toBe('/about');
  });
});
```
