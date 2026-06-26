---
name: moku-worker
description: >
  Moku Worker patterns: the Cloudflare Workers backend framework (@moku-labs/worker) — Durable Objects,
  Queues, R2, D1, and KV plugins that compose with the Moku family. Triggers on:
  "moku worker", "@moku-labs/worker", "cloudflare worker moku", "moku durable object",
  "moku queue/r2/d1/kv plugin", "moku worker backend", or building a Cloudflare-backed Moku app/service.
---

# Moku Worker Patterns

> **Synced to `@moku-labs/worker@0.15.0`** (npm `dist-tags.latest`; surface from the published 0.15.0
> tarball + the `v0.15.0` git tag source). Full surface — every plugin, its API/config/events, the
> dependency graph, and the runtime-vs-node-only boundary — is in
> [`references/plugin-index.md`](references/plugin-index.md). Registered in
> [`moku-frameworks.md`](../moku-core/references/moku-frameworks.md) (`frameworks[worker]`).

## Current Project State
!`test -f package.json && grep -E '"@moku-labs/worker"' package.json 2>/dev/null || true`

## What it is

`@moku-labs/worker` is a **Layer-2** Moku framework for **Cloudflare Workers** backends: it ships plugins
for Cloudflare's runtime primitives — **Durable Objects, Queues, R2, D1, KV** — composed the Moku way
(one app = one kernel + plugins). It depends on `@moku-labs/core` (the kernel) and `@moku-labs/common`
(the branded CLI kit + `ctx.log`/`ctx.env`), and is designed to **compose with the Moku family** (e.g. a
`@moku-labs/web` front-end).

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | `@moku-labs/worker` (Cloudflare Workers backend over Moku Core) |
| Runtime | Cloudflare Workers (`wrangler`) — Durable Objects, Queues, R2, D1, KV |
| Kernel | `@moku-labs/core` |
| Shared infra | `@moku-labs/common` (`ctx.log`, `ctx.env`, branded CLI — MC1–MC3) |
| Package manager | Bun (pinned deps — `bunfig.toml` `exact = true`) |
| Engines | node ≥24, bun ≥1.3.14 |

## Idiomatic shape

Build to the app-shape rubric in [`moku-idioms.md`](../moku-core/references/moku-idioms.md): **one project
composes web + worker side-by-side.** That means **multiple `createApp` instances** — a web build app +
browser SPA on
`@moku-labs/web` (`app.ts`/`spa.tsx`) and a worker server app on `@moku-labs/worker` (`server.ts`) — plus
a **thin** `cloudflare/worker.ts` entry that routes `/api`+`/ws` to the worker `server` and serves the
built web client from the `ASSETS` binding. **Multiple instances, two frameworks in one project, and
folder splits are all idiomatic — not anti-patterns.** Cloudflare bindings (DO / Queue / R2 / D1 / KV) are
exposed as **plugins** — reach them via `ctx.require(plugin)`, keep business logic in plugins (the entry
stays thin), and read env/secrets via `ctx.env` (not raw `process.env` or bare bindings) per the
moku-common conventions (MC2/MC3). The one hard rule: this is a **Layer-3 app** — `createApp` only, never
`createCoreConfig`/`createCore` or a direct `@moku-labs/core` dependency.

## Framework API (@moku-labs/worker v0.15.0)

One entry: **`@moku-labs/worker`**. The node-only deploy/CLI plugins (`deployPlugin`/`cliPlugin`) ship from
the same root export and are tree-shaken out unless you list them — never in the runtime bundle otherwise.
(The `./cli` back-compat subpath was removed in 0.11.0.) `createApp` is **synchronous** (built once per
isolate, frozen). Bindings are threaded as a **call argument** (`env`), never stored. There is **no stage
plugin** (removed in 0.12.0): deployment stage is plain global config — set `config.stage`, read it via
`ctx.global.stage`.

```tsx
import { createApp, endpoint, kvPlugin } from "@moku-labs/worker";

export const app = createApp({
  config: { name: "my-api", compatibilityDate: "2026-06-17" },
  plugins: [kvPlugin],                       // bindings + server are defaults — don't re-list
  pluginConfigs: {
    // keyed-map resource config (since 0.7.0): a Record<key, instance>; a sole entry is the default.
    kv: { cache: { name: "my-cache", binding: "MY_KV" } },
    server: { endpoints: [endpoint("/health").get(() => new Response("ok"))] }
  }
});
// app.kv.get(env, key)            → default instance
// app.kv.use("cache").get(env, k) → named-instance selector
// worker.ts (hand-assembled — no plugin produces it):
export default { fetch: (r, env, ctx) => app.server.handle(r, env, ctx) } satisfies ExportedHandler;
```

**Resource plugins** (`@moku-labs/worker`): `kvPlugin`, `d1Plugin`, `queuesPlugin`, `storagePlugin` (R2),
`durableObjectsPlugin` — each env-first, configured as a keyed map of named instances, with `app.<kind>.get`
on the default and `app.<kind>.use("key")` for the rest. Defaults `bindingsPlugin` + `serverPlugin` are
pre-wired; core `log`/`env` are flat-injected on `ctx`. Helpers: `endpoint(path)`,
`defineDurableObject(name)`. Author consumer plugins with `createPlugin` (generics inferred), typing context
via `WorkerPluginCtx<Config, State, Events?>`. **Deploy** (from the package root): `deployPlugin` +
`cliPlugin` — `deploy.run()`/`cli.deploy()` resolve to a structured `DeployReport`; `cli.deploy({ delete:
true, stage })` (the `--delete` flag) routes to `deploy.destroy()` to tear a stage's infrastructure back
down (since 0.13.0).

**Guards (`endpoint.new`, since 0.14.0).** `endpoint.new(guard)` derives a NEW factory (callable exactly
like `endpoint`) that runs `guard` before every handler it builds; chain `.new` to stack guards. A guard
returning a `Response` **short-circuits** (401 etc.); returning `void` continues. Since 0.15.0 a guard may
also return an **object** → it is merged into the context handed to the handler (and later guards), read as
a **typed field** (e.g. `ctx.actor`) — so a guard resolves a value once and the handler reuses it (no
re-resolve, no null-check):

```ts
const authed = endpoint.new(async (ctx) => {
  const actor = await ctx.require(authPlugin).resolve(ctx.request, ctx.env);
  if (!actor) return new Response("Unauthorized", { status: 401 }); // gate
  return { actor };                                                  // enrich → ctx.actor
});
authed("/me").get((ctx) => Response.json({ id: ctx.actor.id }));     // typed, no null-check
```

Full catalog (all 9 plugins, every API/config/event, the keyed-map config, the dependency graph, the
runtime-vs-node-only boundary): **[`references/plugin-index.md`](references/plugin-index.md)**.
