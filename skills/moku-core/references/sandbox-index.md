# Moku Sandbox — Coding-Style Index

> **Reference exemplars** vendored from `github.com/moku-labs/core/tests/sandbox` to inspire
> coding style during build. Pinned commit: `fdee8c064c034c5faa8ea253ae1c4c9c9aeaa364`
> Vendored: `2026-05-29` · files live under `skills/moku-core/references/sandbox/`.
> Refresh with `/moku:spec-sync` (it re-vendors both `spec/` and `sandbox/`).
>
> These are **read-only style references, not compilable code.** Their imports
> (`from "../config"`, `from "../../../../src"`) reflect the upstream sandbox layout, not your
> project. Read them to mirror *structure, naming, JSDoc, and test style* — do not copy import
> paths. This is a **curated subset** (~48 of 108 upstream files); fetch any non-vendored sibling
> on demand from the raw URL pattern in the footer.

## How to use this index

Before writing plugin source in a build wave, open the exemplar that matches the tier/concern you
are implementing and mirror its style. Pair this with `spec-index.md` (spec = the rules; sandbox =
how idiomatic code applies them). Don't read everything — open the one or two relevant files.

## Open this when you want to see…

| You're writing… | Open |
|---|---|
| The 3-layer factory chain (Layer 1 + Layer 2) | `sandbox/demo/framework/config.ts`, `…/index.ts` |
| A full-feature single-file plugin (events + depends + hooks + config + state + api + require) | `sandbox/demo/framework/plugins/auth.ts` |
| A plugin that composes several dependencies via `ctx.require()` | `sandbox/demo/framework/plugins/sitemap.ts` |
| A **Nano** plugin (api-only, no state) | `sandbox/plugins/env/index.ts` |
| A **Micro** plugin (config + state + api, ~80 lines) | `sandbox/plugins/counter/index.ts` |
| A **Standard** plugin (4–5 file split with `handlers.ts`) | `sandbox/plugins/router/{index,api,state,types,handlers}.ts` |
| A **Complex** plugin (provider/adapter sub-dir + pure helper module) | `sandbox/plugins/analytics/` (+ `providers/`, `tracker.ts`) |
| A **Very Complex** plugin (multiple sub-domains, shared root `types.ts`) | `sandbox/plugins/cms/{index,types}.ts`, `cms/content/` |
| Gold-standard multi-line JSDoc + the adapter pattern | `sandbox/plugins/analytics/api.ts`, `analytics/providers/` |
| A mock-ctx **unit** test | `sandbox/plugins/router/__tests__/unit/api.test.ts`, `analytics/__tests__/unit/api.test.ts` |
| A `createTestApp()` **integration** test | `sandbox/plugins/analytics/__tests__/integration/analytics.test.ts` |
| Executable semantics + `expectTypeOf` / `@ts-expect-error` style | `sandbox/factory-chain.test.ts`, `events.test.ts`, `lifecycle.test.ts` |
| A Layer-3 consumer with runtime `start/stop` | `sandbox/demo/consumer/main.ts` |
| Web / island architecture + SSG-vs-SPA entry split | `sandbox/demo/blog/{index.html,spa.ts,main.ts,islands/…}` |

## Tier ladder (how big should a plugin be?)

`env` (Nano, api-only) → `counter` (Micro, config+state+api) → `router` (Standard, 5-file +
handlers) → `analytics` (Complex, `providers/` adapters + pure `tracker.ts`) → `cms` (Very Complex,
`content/`+`media/`+`versioning/` sub-domains, shared root `types.ts`). Open the rung matching your
plugin's size to decide the file split.

## Style cheat-sheet (distilled from the exemplars — all confirmed in the vendored files)

1. **Export naming:** `export const <name>Plugin = createPlugin("<name>", {…})` — the export carries
   the `Plugin` suffix; the name string is bare (`routerPlugin`/`"router"`). Islands use a domain
   suffix instead (`lightboxIsland`). Matches `spec/15 §7` and R4.
2. **File split:** `index.ts` (wiring + JSDoc header naming the tier + `@see README.md`) ·
   `api.ts` (`createXApi(ctx) => ({…})`) · `state.ts` (`createXState`) ·
   `types.ts` (`type XCtx = PluginCtx<Config, State, Events>` alias) · `handlers.ts`
   (event-handler factories curried as `(ctx) => (payload) => {…}`). Factories are **arrow functions**.
3. **JSDoc:** multi-line everywhere (`@param {Type} name - desc`, `@returns`, `@throws`,
   `@example` fenced ```typescript blocks). Never single-line `/** … */`.
4. **Errors:** two-line format `[<framework-or-plugin>] <what>.\n  <how to fix>.`
5. **Events:** `events: register => ({ "auth:login": register<{ userId: string }>("desc") })`;
   naming `pluginName:action`. No explicit generics on `createPlugin`.
6. **Tests (vitest):** `import { describe, expect, expectTypeOf, it } from "vitest"`; section banners
   `// ─────`; a local `createTestApp()` per integration file; unit tests use a hand-rolled
   `createMockCtx()` returning `{ config, state, emit: vi.fn() }`; type-level assertions via
   `expectTypeOf(...).toEqualTypeOf<…>()` and `@ts-expect-error` negative tests; every `it` has ≥1
   runtime `expect`. Tests live in `__tests__/unit/` and `__tests__/integration/` beside the plugin.
7. **Sub-domain rule (Very Complex):** module dirs import shared types from the plugin-root
   `types.ts`; they do **not** import from each other.

## Refresh / fetch-on-demand

- Raw URL pattern (pinned): `https://raw.githubusercontent.com/moku-labs/core/fdee8c064c034c5faa8ea253ae1c4c9c9aeaa364/tests/sandbox/<path>`
- Regenerate the resolved SHA: `gh api 'repos/moku-labs/core/commits?path=tests/sandbox&per_page=1' --jq '.[0].sha'`
- Full upstream tree has ~108 files; only the ~48 highest-signal exemplars are vendored here. To
  study a non-vendored sibling (e.g. `demo/tools/`, the `cms/media/` sub-domain, `type-gaps.test.ts`),
  fetch it from the raw URL pattern above.
