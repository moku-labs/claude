# @moku-labs/room — Plugin & Property Index

**Synced version:** `0.1.1` (npm `dist-tags.latest`; catalog generated from the published tarball README —
upstream `main` was still at 0.1.0, so the npm tarball is the authority). Peer dep `@moku-labs/web@^1.12.4`;
bundled deps `trystero@~0.25.2` (signaling) + `qrcode@^1.5.4`. Engines node ≥24, bun ≥1.3.14.

## Not a framework — a plugin pack on `@moku-labs/web`

`@moku-labs/room` has **no Layer-2 shell and never calls `createApp`**. You build your own `@moku-labs/web`
app and **spread a pre-composed Room plugin array** into it. `createPlugin` is imported from
`@moku-labs/web` (Room never imports `@moku-labs/core`).

Couch-multiplayer: one **stage** (shared TV/laptop — the authoritative host) + up to **8 controllers**
(phones), connected over **direct WebRTC DataChannels on the LAN**. Phones scan a QR to join; inputs flow
to the host; the host owns state and broadcasts it back. No accounts, no lobby servers.

> **Two planes, kept separate:** the **`Wire`** (`Frame` DataChannel) carries **all gameplay** (intents,
> snapshots, deltas, heartbeats, recovery); Moku **`emit` (`room:*`)** carries **only coarse lifecycle**.
> No gameplay ever rides `emit`.
>
> **D2 accepted hard-failure:** strict P2P, **no TURN ever** — on AP-isolated / symmetric-NAT /
> iOS-Private-Relay networks the connection can hard-fail with no recovery (surfaces
> `room:network-warning`). Design target: the home LAN.

## Entry points

| Import | Use |
|--------|-----|
| `@moku-labs/room` (`.`) | Main entry — full surface (Node/tooling, tests). |
| `@moku-labs/room/browser` (`./browser`) | DOM/WebRTC build target — what a browser app imports. Identical surface to `.`. |

## Usage — spread a role array into a web app

```typescript
import { createApp, createPlugin } from "@moku-labs/web/browser";
import { roomPlugins, stagePlugin } from "@moku-labs/room/browser";

const app = createApp({ plugins: [...roomPlugins.stage, game] }); // facade is LAST in the array
await app.start();

const { code, joinUrl } = app.stage.createRoom();   // SYNCHRONOUS
const qr = await app.stage.qr();                     // QR is async (descriptor.qr is always null)
app.stage.onIntent("score", (payload, peerId) => app.stage.mutate("scores", draft => ({ ... })));
```

The two pre-composed arrays (spread one into your web `createApp`):

```typescript
roomPlugins.stage      = [transportPlugin, sessionPlugin, intentPlugin, syncPlugin, stagePlugin];
roomPlugins.controller = [transportPlugin, sessionPlugin, intentPlugin, syncPlugin, controllerPlugin];
```

The role **facade is last** so it re-declares all five `room:*` events; a downstream game plugin
(`depends: [stagePlugin]` / `[controllerPlugin]`) then sees the complete typed hook surface in one edge.

## Plugins (6) — 4 engines + 2 role facades

| # | Plugin | Tier | Depends on | Role / key API |
|---|--------|------|-----------|----------------|
| 1 | `transportPlugin` | Complex | — | WebRTC DataChannels: signaling handshake, chunking/backpressure, mandatory heartbeat, capped ICE recovery; owns the typed `Wire`. API: `connect`, `wire`, `disconnect`, `peers`, `close`. Emits `room:network-warning`. |
| 2 | `sessionPlugin` | Complex | transport | Room code + QR + roster; star topology (`hostId()`); host-reload recovery. API: `createRoom`, `qr`, `joinRoom`, `leave`, `rejoin`, `roster`, `self`, `recoveryPhase`. Emits `room:peer-joined/-left/-host-reconnecting`. |
| 3 | `intentPlugin` | Standard | transport, session | Controller→host typed inputs (`IntentFrame`, per-controller `cSeq` idempotent de-dup). API: `register`, `onIntent`, `intent`. No events. |
| 4 | `syncPlugin` | Complex | transport, session | Host→controller authoritative state: full snapshot + throttled op-list deltas. API: `registerSlice`, `mutate`, `broadcast`, `read`, `subscribe`, `applyFrame`. Emits `room:sync-ready`. |
| 5 | `stagePlugin` | Standard (facade) | all four | **Host-role facade** → `app.stage` `StageApi`: `createRoom`, `qr`, `mutate`, `broadcast`, `onIntent`, `roster`. |
| 6 | `controllerPlugin` | Standard (facade) | all four | **Controller-role facade** → `app.controller` `ControllerApi`: `joinRoom`, `read`, `on`, `intent`, `requestWakeLock`, `releaseWakeLock`. |

Facades **re-declare** the `room:*` events for compile-time visibility (event types aren't transitive) but
install **no forwarding hooks** — the event bus is global. They delegate API; they own no state.

## Configuration (all fields have couch-profile defaults — zero overrides needed)

- **`transport`:** `signaling` (`publicRendezvous()`), `iceServers` (one public STUN; `[]` = LAN-only;
  **no TURN ever**), `heartbeatIntervalMs` (`2000`, mandatory), `heartbeatTimeoutMs` (`6000`),
  `openTimeoutMs` (`3000`), `maxMessageBytes` (`14336`).
- **`session`:** `joinUrlBase` (`""`), `generateQr` (`true`), `maxControllers` (`8`), `snapshotDebounceMs`
  (`500`), `reconnectTimeoutMs` (`10000`), `intentBufferMax` (`256`), `intentBufferMaxAgeMs` (`8000`),
  `storageKeyPrefix` (`"moku.room"`).
- **`intent`:** `bufferCap` (`256`), `bufferMaxAgeMs` (`10000`).
- **`sync`:** `broadcastHz` (`30`, clamped `[5,60]`), `skipEmptyDeltas` (`true`), `maxOpsPerDelta` (`512`),
  `resyncOnGap` (`true`).
- **`stage` / `controller`:** **no config** (facades own no tunables; wake-lock is the opt-in
  `requestWakeLock()` API).

### Signaling adapters (the `transport.signaling` seam)

- **`publicRendezvous()`** — default, Trystero over a public Nostr backbone. Production.
- **`inMemory()`** — in-process, no `RTCPeerConnection`. Tests/simulation (deterministic, no relays).

## Events (`room:*` — coarse lifecycle only)

| Event | Payload | Emitted by | Meaning |
|-------|---------|-----------|---------|
| `room:peer-joined` | `{ peerId }` | session | Controller connected + added to roster. |
| `room:peer-left` | `{ peerId }` | session | Controller left / declared dead by heartbeat. |
| `room:host-reconnecting` | `{}` | session | Host tab reloaded; recovery in flight. |
| `room:sync-ready` | `{}` | sync | First full snapshot applied; replica readable. |
| `room:network-warning` | `{ reason: "ice-failed" \| "rendezvous-unreachable" \| "channel-closed" }` | transport | Connectivity hard-failure (surface as failure UX). |

> Reload-path caveat: `room:host-reconnecting` fires during `session` `onInit` (before consumer hooks
> register) — on the reload path, poll `app.session.recoveryPhase()` instead.

## Dependency graph

```
transport → session → intent ─┐
   │           │              ├→ stage       (host facade)   = roomPlugins.stage
   │           └────→ sync ───┤
   └──────────────────────────└→ controller (phone facade)  = roomPlugins.controller
```

Init order = array order (facade last). `intent` and `sync` are parallel siblings. Shared contract types
(`Signaling`, `Wire`, every `Frame`, `RoomEvents`, `Snapshot`, `Op`, `RosterEntry`, `MAX_CONTROLLERS`,
`ROOM_CODE_LENGTH`, …) live in `src/contracts.ts`.

## Idiomatic placement (`moku-idioms.md`)

A room app is a **Layer-3 `@moku-labs/web` app** that spreads `roomPlugins` — `createApp` from web, never
`createCoreConfig`/`createCore`/`@moku-labs/core` (I1). It's the same "compose the frameworks/packs you
need" shape as `demos/tracker`; multiple `createApp` instances and folder splits remain idiomatic.
