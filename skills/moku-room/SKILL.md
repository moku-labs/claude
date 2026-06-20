---
name: moku-room
description: >
  Moku Room patterns: the couch-multiplayer game framework (@moku-labs/room) built on @moku-labs/web —
  shared screen + phones, WebRTC peer connections (trystero), multi-device state sync, QR join. Triggers
  on: "moku room", "@moku-labs/room", "couch multiplayer moku", "moku shared screen / phones",
  "moku webrtc / state sync", "moku party game", or building a couch-multiplayer Moku app.
---

# Moku Room Patterns

> **STUB — pending `moku-sync room`.** Registered in
> [`moku-frameworks.md`](../moku-core/references/moku-frameworks.md) (`frameworks[room]`,
> `knownVersion: "0.0.0"`). API form + plugin catalog are placeholders until **`moku-sync room`**
> generates them from `../room` (npm `@moku-labs/room`, latest **0.1.1** at registration) and stamps the
> real version. The package source + [`references/plugin-index.md`](references/plugin-index.md) are
> authoritative.

## Current Project State
!`test -f package.json && grep -E '"@moku-labs/(room|web)"' package.json 2>/dev/null || true`

## What it is

`@moku-labs/room` is a **Layer-2** Moku framework for **couch-multiplayer** experiences: a shared "screen"
(a TV/laptop) plus phone controllers, **WebRTC** peer connections (via `trystero`), **multi-device state
sync**, and **QR-code join** (via `qrcode`). It is **built on `@moku-labs/web`** (peer dependency
`^1.12.4`) — a room product builds on web, so you get the moku-web island/CSS patterns underneath.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | `@moku-labs/room` (couch-multiplayer over `@moku-labs/web`) |
| Built on | `@moku-labs/web` (Preact + island architecture) → `@moku-labs/core` |
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
app** — `createApp` + the framework's re-exported `createPlugin`, never `createCoreConfig`/`createCore` or
a direct `@moku-labs/core` dependency. _(Whether you build on room's own `createApp` or compose room
plugins onto web's `createApp` is what `moku-sync room` will document — consult the synced catalog /
package source.)_

## Framework API (@moku-labs/room — pending sync)

_Run `moku-sync room` to populate this section (exports, plugins, events, config) from the package
source. See [`references/plugin-index.md`](references/plugin-index.md)._
