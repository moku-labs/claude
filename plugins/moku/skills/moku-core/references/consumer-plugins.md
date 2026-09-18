<!--
  Consumer-layer (Layer 3) plugin authorship & organization — the single source of truth.
  A Layer-3 app (built on a framework like @moku-labs/web) CAN and SHOULD author its own plugins
  via the framework's re-exported `createPlugin`. This file states the rule, where consumer plugins
  live, how they wire, and WHEN a concern should be a plugin vs. a lib helper vs. an island.
  Pair with: moku-plugin skill (complexity tiers + file layout), build-app.md (the build flow),
  architecture.md (the 3-layer model), moku-web/references/project-spec.md (web specifics).
-->

# Consumer-Layer Plugins (Layer 3)

A consumer app is **Layer 3**: it imports `createApp` from a framework and ships a product. The most
common misconception — and one this tooling used to reinforce — is that Layer 3 only *configures and
composes* existing plugins. It does more than that: **Layer 3 authors its own plugins too.** The Moku
Core spec is explicit — *"what custom plugins consumers write themselves — that's Layer 3."*

## The rule (what Layer 3 does and does NOT do)

A Layer-3 consumer:

- **DOES** author custom plugins with the framework's re-exported **`createPlugin`**, organized in
  `src/plugins/{name}/` using the standard [complexity tiers](../../moku-plugin/SKILL.md)
  (Nano → Very Complex), then composes them via `createApp({ plugins: [...] })`.
- **DOES** import `createPlugin` from the **framework package** (e.g. `@moku-labs/web`, `my-framework`).
- **Does NOT** call `createCoreConfig` / `createCore` — that is the framework's job (Layer 2).
- **Does NOT** add a direct `@moku-labs/core` dependency — the framework pins core and re-exports what
  Layer 3 needs. A Layer-3 app never imports `@moku-labs/core`.

> The old guidance flattened two different prohibitions into one ("never write core config **or**
> plugins"). Only the **core-config** half is true. Authoring plugins is a first-class Layer-3 activity.

## Where consumer plugins live & how they wire

Same structure and tiers as framework plugins (see the moku-plugin skill), with three Layer-3 deltas:

| Aspect | Framework plugin (Layer 2) | Consumer plugin (Layer 3) |
|---|---|---|
| `createPlugin` import | from `../../config` (bound locally) | from the **framework package** |
| Location | `src/plugins/{name}/` | `src/plugins/{name}/` (same) |
| Wiring | listed in `createCore(..., { plugins })` + `src/plugins/index.ts` barrel | listed in `createApp({ plugins: [...] })` in the app entry (`src/main.ts`) |
| `src/plugins/index.ts` barrel | **required** | **optional** — import plugins directly in the entry; add a barrel only if it helps |
| `src/config.ts` | required | **never** (that's Layer 2) |

**Worked example (vendored):** `sandbox/demo/consumer/plugins/blog.ts` is a real consumer plugin —
`createPlugin("blog", { config, createState, api })` imported from the framework — and
`sandbox/demo/consumer/main.ts` wires it with `createApp({ plugins: [analyticsPlugin, blogPlugin] })`.
A single-file plugin like this is the **Micro** tier; promote to a directory with `api.ts`/`state.ts`/
`types.ts` as it grows, exactly as the moku-plugin skill prescribes.

```ts
// src/plugins/blog/index.ts  (or src/plugins/blog.ts for Nano/Micro)
import { createPlugin } from "my-framework";        // NOT @moku-labs/core

export const blogPlugin = createPlugin("blog", {
  config: { postsPerPage: 10 },
  createState: () => ({ posts: [] as Post[] }),
  api: (ctx) => ({ listPosts: () => ctx.state.posts }),
});

// src/main.ts
import { createApp } from "my-framework";
import { blogPlugin } from "./plugins/blog";

const app = createApp({ plugins: [blogPlugin], pluginConfigs: { blog: { postsPerPage: 5 } } });
```

## When to make it a plugin (vs. a lib helper or an island)

Not every consumer concern should be a plugin — reach for the smallest tool that fits. Use this guide:

| The concern… | Use a… | Where |
|---|---|---|
| Exposes a typed API call sites use as `app.<x>.method()`, **or** emits/handles custom **events**, **or** needs **lifecycle** (`onInit`/`onStart`/`onStop`), **or** holds **shared cross-cutting state**, **or** **depends on** another plugin | **plugin** | `src/plugins/{name}/` |
| Pure build-time data access / pure transforms / formatting — no lifecycle, events, or shared state | **`lib/` module** | `src/lib/` |
| Client-side DOM behavior / interactivity only | **island** | `src/islands/` (web) |

Rule of thumb: if it's *plugin-shaped* (API surface + events + lifecycle + state), make it a plugin. If
it's just a pure function or a build-time loader, a `lib/` helper is lighter. If it's only browser DOM
behavior, it's an island.

## Web specifics (@moku-labs/web)

For a web app, most **data** customization is better as build-time route loaders + `lib/` helpers (+
`dataPlugin` for client nav) per `project-spec.md` §4 — *not* a plugin. Author a consumer plugin when
the concern is genuinely plugin-shaped (custom `ctx` API, custom events, lifecycle, shared state).

A web consumer plugin is one of three shapes — compose it into the right composition(s):

- **Isomorphic** (runs on both build + browser) → compose into **both** `src/app.ts` and `src/spa.tsx`.
- **Node-only** (build-time only) → compose into `src/app.ts` only.
- **Browser-only** (client runtime only) → compose into `src/spa.tsx` only.

Anything reachable from both `app.ts` and `spa.tsx` is in the **browser graph** and MUST stay node-free
(`project-spec.md` Rule **R3**). See [`project-spec.md`](../../moku-web/references/project-spec.md) for
the directory tree (`src/plugins/` is an optional entry there) and the composition split.

## Quality (same bar as framework plugins)

- Full multi-line JSDoc on every export; `import type` for type-only imports.
- **Never** explicit generics on `createPlugin` — types infer from the spec object.
- Unit + integration tests, same standards as framework plugins (`__tests__/` inside the plugin dir).
- Import `createPlugin` from the **framework package**, never `@moku-labs/core`.
