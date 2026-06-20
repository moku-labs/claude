---
name: moku-room
description: >
  Moku Room patterns: the couch-multiplayer plugin pack (@moku-labs/room) built on @moku-labs/web —
  shared screen + phones, WebRTC peer connections (trystero), multi-device state sync, QR join. Triggers
  on: "moku room", "@moku-labs/room", "couch multiplayer moku", "moku shared screen / phones",
  "moku webrtc / state sync", "moku party game", or building a couch-multiplayer Moku app.
---

# Moku Room Patterns

> **Synced to `@moku-labs/room@0.1.1`** (npm `dist-tags.latest`; catalog from the published tarball). Full
> surface — the 6 plugins, the two `roomPlugins` arrays, config, events, signaling adapters, and the
> dependency graph — is in [`references/plugin-index.md`](references/plugin-index.md). Registered in
> [`moku-frameworks.md`](../moku-core/references/moku-frameworks.md) (`frameworks[room]`).

## Current Project State
!`test -f package.json && grep -E '"@moku-labs/(room|web)"' package.json 2>/dev/null || true`

## What it is

`@moku-labs/room` is a **plugin pack** (NOT a standalone framework — it has no Layer-2 shell and **never
calls `createApp`**) for **couch-multiplayer**: a shared "screen" (TV/laptop — the authoritative host) plus
up to 8 phone controllers, over **direct WebRTC DataChannels on the LAN** (via `trystero`), with
multi-device state sync and **QR-code join** (via `qrcode`). It is **built on `@moku-labs/web`** (peer dep
`^1.12.4`): you build your own `@moku-labs/web` app and **spread a pre-composed Room plugin array** into it.
`createPlugin` comes from `@moku-labs/web` (never `@moku-labs/core`).

## Stack

| Layer | Technology |
|-------|-----------|
| Plugin pack | `@moku-labs/room` — couch-multiplayer plugins spread into a `@moku-labs/web` app (no `createApp` of its own) |
| Built on | `@moku-labs/web` (Preact + island architecture, peer dep) → `@moku-labs/core` |
| Networking | WebRTC peer mesh (`trystero`), QR join (`qrcode`) |
| Package manager | Bun (pinned deps — `bunfig.toml` `exact = true`) |
| Engines | node ≥24, bun ≥1.3.14 |

## Idiomatic shape — follow `demos/tracker`

`@moku-labs/room` **extends `@moku-labs/web`** (peer dep). For app shape, follow the
[`moku-idioms.md`](../moku-core/references/moku-idioms.md) rubric and the worked reference
**`demos/tracker`**: **multiple `createApp` instances, composing frameworks side-by-side, and folder
splits are idiomatic** — not anti-patterns. Build the UI with the moku-web patterns underneath (islands,
`@scope`/`@layer`, `data-*`-only, design tokens). Shared-screen vs phone roles, the WebRTC peer mesh, and
synced state are **plugins** — reach them via `ctx.require(plugin)`. The one hard rule: it's a **Layer-3
app** — `createApp` (from `@moku-labs/web`) + that framework's re-exported `createPlugin`, never
`createCoreConfig`/`createCore` or a direct `@moku-labs/core` dependency. Room **never calls `createApp`**:
you spread `roomPlugins.stage` / `roomPlugins.controller` into your **web** `createApp`.

## Framework API (@moku-labs/room v0.1.1)

Room ships two pre-composed plugin arrays — spread one into a `@moku-labs/web` app (import from
`@moku-labs/room/browser` in the browser). Engines first, the role facade last.

```tsx
import { createApp, createPlugin } from "@moku-labs/web/browser";
import { roomPlugins, stagePlugin } from "@moku-labs/room/browser";

const app = createApp({ plugins: [...roomPlugins.stage, game] }); // game depends on stagePlugin
await app.start();
const { code, joinUrl } = app.stage.createRoom();  // synchronous; QR via `await app.stage.qr()`
app.stage.onIntent("score", (payload, peerId) => app.stage.mutate("scores", draft => ({ ... })));
```

- **`roomPlugins.stage`** = `[transport, session, intent, sync, stage]` → `app.stage` (`StageApi`:
  `createRoom`, `qr`, `mutate`, `broadcast`, `onIntent`, `roster`).
- **`roomPlugins.controller`** = `[transport, session, intent, sync, controller]` → `app.controller`
  (`ControllerApi`: `joinRoom`, `read`, `on`, `intent`, `requestWakeLock`, `releaseWakeLock`).
- 5 `room:*` lifecycle events; **all gameplay rides the `Wire`**, never `emit`. Signaling: `publicRendezvous()`
  (default) / `inMemory()` (tests). **No TURN ever** (D2 — design target is the home LAN).

Full catalog (6 plugins, every API/config/event, signaling seam, dependency graph):
**[`references/plugin-index.md`](references/plugin-index.md)**.
