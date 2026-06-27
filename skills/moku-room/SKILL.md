---
name: moku-room
description: >
  Moku Room patterns: the couch-multiplayer framework (@moku-labs/room) — a standalone @moku-labs/core
  framework (sibling to @moku-labs/web / @moku-labs/worker, NOT built on them). Shared screen + phones,
  WebRTC peer connections (trystero), multi-device state sync, QR join, and an opt-in Cloudflare Worker
  signaling tier (@moku-labs/room/server). Triggers on: "moku room", "@moku-labs/room", "couch multiplayer
  moku", "moku shared screen / phones", "moku webrtc / state sync", "moku party game", or building a
  couch-multiplayer Moku app.
---

# Moku Room Patterns

> **Synced to `@moku-labs/room@0.3.1`** (npm `dist-tags.latest`; catalog from the `v0.3.1` tag source + the
> root README). Full surface — the 7 plugins, the client core (`.`) + the opt-in `./server` tier (now a
> **`hubPlugin` + `Hub` DO** export, **not** a core — compose into your own `@moku-labs/worker` app), the
> three signaling adapters, config, events, and the dependency graph — is in
> [`references/plugin-index.md`](references/plugin-index.md). Registered in
> [`moku-frameworks.md`](../moku-core/references/moku-frameworks.md) (`frameworks[room]`).

## Current Project State
!`test -f package.json && grep -E '"@moku-labs/room"' package.json 2>/dev/null || true`

## What it is

`@moku-labs/room` is a **standalone Moku framework on `@moku-labs/core`** — a sibling to `@moku-labs/web` and
`@moku-labs/worker`, **not built on them** — for **couch-multiplayer**: a shared "screen" (TV/laptop — the
authoritative host) plus up to 8 phone controllers, over **direct WebRTC DataChannels on the LAN** (via
`trystero`), with multi-device state sync and **QR-code join** (via `qrcode`). You `createApp` **from Room
itself**; `createApp`/`createPlugin` come from `@moku-labs/room`, never `@moku-labs/web`/`@moku-labs/core`.

> **Breaking in 0.3.1 (`#6`):** the `./server` tier is **no longer a core**. `@moku-labs/room/server` now
> exports **`hubPlugin`** (a `@moku-labs/worker` plugin) + the **`Hub`** Durable Object — you compose
> `hubPlugin` into your **own single `@moku-labs/worker` `createApp`** (+ `durableObjects`/`deploy`/`cli`),
> not `createApp` from `./server`. `@moku-labs/worker` is an **optional peer**. This is the one-worker idiom
> (`moku-idioms.md §I6`). (`0.3.0` was a docs-only republish.)
>
> **Breaking since 0.1.x (`#4`):** Room used to be a *plugin pack* spread into a `@moku-labs/web` app
> (`roomPlugins.stage`/`.controller` arrays). 0.2.0 rebuilt it as its **own framework** — the `@moku-labs/web`
> dependency is gone, there are **no role arrays** (all plugins are uniform), and the `./browser` entry was
> dropped. Migrate `0.1.x` consumers by replacing the spread with `createApp({ plugins: [stagePlugin, …] })`
> from `@moku-labs/room`.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | `@moku-labs/room` — its own `@moku-labs/core` framework (you `createApp` from it); client core `.` + opt-in `./server` tier (a `hubPlugin` + `Hub` DO export — compose into your own `@moku-labs/worker` app, **not** a core) |
| Built on | `@moku-labs/core` + `@moku-labs/common` (**bundled** deps — supply the kernel + `ctx.log`/`ctx.env`). **`@moku-labs/worker@^0.15.0` is an OPTIONAL peer** — only the `./server` tier needs it |
| Networking | WebRTC peer mesh (`trystero`, bundled), QR join (`qrcode`, bundled); opt-in Cloudflare Worker signaling tier (`./server` → `hubPlugin`) |
| Package manager | Bun (pinned deps — `bunfig.toml` `exact = true`) |
| Engines | node ≥24, bun ≥1.3.14 |

## Idiomatic shape — a Layer-3 app that composes Room

A room app is a **Layer-3 app**: `createApp` from `@moku-labs/room` for the client (and that framework's
re-exported `createPlugin`); for the opt-in signaling tier, a **single `@moku-labs/worker` `createApp`** that
composes room's `hubPlugin` (+ `durableObjects`/`deploy`/`cli`) — never `createCoreConfig`/`createCore` or a
direct `@moku-labs/core` dependency (I1). For app shape, follow the
[`moku-idioms.md`](../moku-core/references/moku-idioms.md) rubric and the worked reference **`demos/tracker`**:
**multiple `createApp` instances across distinct runtimes (a client app + a worker server app), composing
frameworks side-by-side, and folder splits are idiomatic** — not anti-patterns. The server is **one** worker
app composing `hubPlugin`, never a second/facade app (`moku-idioms.md §I6`). Build the UI with the moku-web
patterns underneath. Shared-screen vs phone roles, the WebRTC peer mesh, and synced state are **plugins** —
reach them via `ctx.require(plugin)`. Keep the Cloudflare entry (`cloudflare/worker.ts`) thin: it delegates
`fetch` to the composed worker app's `server.hub.handle`.

## Framework API (@moku-labs/room v0.3.1)

The four engines (`transport`, `session`, `intent`, `sync`) are **client-core defaults** — already wired. An
app adds exactly one role facade (`stagePlugin` host / `controllerPlugin` phone) + its game plugin; there are
**no `roomPlugins` arrays**. Select the rendezvous via `pluginConfigs.transport.signaling`.

```ts
import { createApp, createPlugin, stagePlugin } from "@moku-labs/room";

const app = createApp({ plugins: [stagePlugin, game] }); // engines are defaults; add the host facade + game
await app.start();
const { code, joinUrl } = app.stage.createRoom();  // synchronous; QR via `await app.stage.qr()`
app.stage.onIntent("score", (payload, peerId) => app.stage.mutate("scores", draft => ({ ... })));
```

- **`stagePlugin`** → `app.stage` (`StageApi`: `createRoom`, `qr`, `mutate`, `broadcast`, `onIntent`,
  `roster`). **`controllerPlugin`** → `app.controller` (`ControllerApi`: `joinRoom`, `read`, `on`, `intent`,
  `requestWakeLock`, `releaseWakeLock`).
- 5 `room:*` lifecycle events; **all gameplay rides the `Wire`**, never `emit`. Signaling: `publicRendezvous()`
  (default) / `inMemory()` (tests) / `serverSignaling(url)` (opt-in, the `./server` tier). **No TURN ever** (D2 —
  design target is the home LAN).
- **Opt-in `./server` tier (a plugin, not a core — 0.3.1):** `import { hubPlugin, Hub } from
  "@moku-labs/room/server"` and compose `hubPlugin` (a `@moku-labs/worker` plugin) into your **own** single
  `@moku-labs/worker` `createApp` — alongside `durableObjectsPlugin` (the `Hub` DO) + `deployPlugin`/`cliPlugin`
  (the one-worker idiom, `moku-idioms.md §I6`). `server.hub.handle` is the runtime fetch a thin
  `cloudflare/worker.ts` delegates to; re-export `Hub` so wrangler binds `ROOM_HUB`. `@moku-labs/worker` is an
  optional peer. Signaling only — no gameplay relay (D2 holds).

Full catalog (7 plugins, both cores, every API/config/event, signaling seam, dependency graph):
**[`references/plugin-index.md`](references/plugin-index.md)**.
