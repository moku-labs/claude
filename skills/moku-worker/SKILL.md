---
name: moku-worker
description: >
  Moku Worker patterns: the Cloudflare Workers backend framework (@moku-labs/worker) — Durable Objects,
  Queues, R2, D1, and KV plugins that compose with the Moku family. Triggers on:
  "moku worker", "@moku-labs/worker", "cloudflare worker moku", "moku durable object",
  "moku queue/r2/d1/kv plugin", "moku worker backend", or building a Cloudflare-backed Moku app/service.
---

# Moku Worker Patterns

> **Synced to `@moku-labs/worker@0.4.0`** (npm `dist-tags.latest`; catalog from the published tarball).
> Full surface — every plugin, its API/config/events, the dependency graph, and the runtime-vs-node-only
> boundary — is in [`references/plugin-index.md`](references/plugin-index.md). Registered in
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

## Idiomatic shape — follow `demos/tracker`

The worked reference is **`demos/tracker`** (`../demos/tracker`; the app-shape authority for
[`moku-idioms.md`](../moku-core/references/moku-idioms.md)): **one project composes web + worker
side-by-side.** That means **multiple `createApp` instances** — a web build app + browser SPA on
`@moku-labs/web` (`app.ts`/`spa.tsx`) and a worker server app on `@moku-labs/worker` (`server.ts`) — plus
a **thin** `cloudflare/worker.ts` entry that routes `/api`+`/ws` to the worker `server` and serves the
built web client from the `ASSETS` binding. **Multiple instances, two frameworks in one project, and
folder splits are all idiomatic — not anti-patterns.** Cloudflare bindings (DO / Queue / R2 / D1 / KV) are
exposed as **plugins** — reach them via `ctx.require(plugin)`, keep business logic in plugins (the entry
stays thin), and read env/secrets via `ctx.env` (not raw `process.env` or bare bindings) per the
moku-common conventions (MC2/MC3). The one hard rule: this is a **Layer-3 app** — `createApp` only, never
`createCoreConfig`/`createCore` or a direct `@moku-labs/core` dependency.

## Framework API (@moku-labs/worker v0.4.0)

Two entries: **`@moku-labs/worker`** (runtime — ships in the bundle) and **`@moku-labs/worker/cli`**
(node-only deploy/CLI — never in the bundle). `createApp` is **synchronous** (built once per isolate,
frozen). Bindings are threaded as a **call argument** (`env`), never stored.

```tsx
import { createApp, endpoint, kvPlugin } from "@moku-labs/worker";

export const app = createApp({
  config: { name: "my-api", compatibilityDate: "2026-06-17" },
  plugins: [kvPlugin],                       // bindings + server are defaults — don't re-list
  pluginConfigs: {
    kv: { binding: "MY_KV" },
    server: { endpoints: [endpoint("/health").get(() => new Response("ok"))] }
  }
});
// worker.ts (hand-assembled — no plugin produces it):
export default { fetch: (r, env, ctx) => app.server.handle(r, env, ctx) } satisfies ExportedHandler;
```

**Resource plugins** (`@moku-labs/worker`): `kvPlugin`, `d1Plugin`, `queuesPlugin`, `storagePlugin` (R2),
`durableObjectsPlugin` — each env-first (`app.kv.get(env, key)`). Defaults `bindingsPlugin` + `serverPlugin`
are pre-wired; core `log`/`env`/`stage` are flat-injected on `ctx`. Helpers: `endpoint(path)`,
`defineDurableObject(name)`. **Deploy** (`@moku-labs/worker/cli`): `deployPlugin` + `cliPlugin`.

Full catalog (all 10 plugins, every API/config/event, the dependency graph, the runtime-vs-node-only
boundary): **[`references/plugin-index.md`](references/plugin-index.md)**.
