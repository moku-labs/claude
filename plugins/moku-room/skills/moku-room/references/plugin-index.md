# @moku-labs/room — Plugin & Property Index

**Synced version:** `0.8.2` (catalog generated from the `v0.8.2` git tag **source** — `src/index.ts`,
`src/server.ts`, `src/config.ts`, `src/plugins/*`, `package.json`. Upstream `llms.txt`/`llms-full.txt` were
updated upstream (last touched in `#12`, 0.8.0) and are **current for the API surface through 0.8.0** (hub-plugin server tier, six
events, at-least-once intents, `"auto"` ICE, `/api/ice`); their **only stale fact at `v0.8.2`** is the bundled
dependency line, which still says core `1.5.0` / common `0.2.1`. Per the registry's "source wins" policy the
tag source is authoritative). Built on `@moku-labs/core@1.6.0` + `@moku-labs/common@0.3.2` as **bundled**
dependencies + bundled `trystero@~0.25.2` (signaling) and `qrcode@^1.5.4` (join QR).
**`@moku-labs/worker@^0.15.0` is an OPTIONAL `peerDependency`** (`peerDependenciesMeta.optional`) — needed
**only** by the `./server` tier (its `hubPlugin` is a `@moku-labs/worker` plugin); pure-client apps install
nothing extra. Engines node ≥24, bun ≥1.3.14.

> **New since 0.3.1 (no breaking change, `0.3.2` → `0.8.2`):**
> - **0.3.2 (`#7`, sync fix)** — a unicast snapshot (`sync.broadcast(peerId)`) is stamped at the CURRENT `sSeq`
>   and consumes no shared sequence; a replica that detects a delta gap reports it over the wire with the new
>   `SyncResyncFrame` (`t: "sync-resync"`) and the host **re-baselines that one peer automatically**.
>   `sync.onResyncRequest` is now an observability hook, not the place to wire the re-baseline.
> - **0.4.0 (`#8`, intent)** — **at-least-once intent delivery**: the host receipt-acks every `IntentFrame`
>   with the new `IntentAckFrame` (`t: "intent-ack"`), the controller retransmits the same `cSeq` (bounded,
>   doubling backoff, stop-and-wait). New 6th event **`room:intent-undeliverable { name, cSeq }`**; new `intent`
>   config `ackTimeoutMs` (`1000`) + `maxRetransmits` (`3`).
> - **0.5.0 (`#9`, sync fix)** — not-ready baseline retry: a replica with no authoritative frame yet re-requests
>   its join baseline. New `sync` config `baselineRetryMs` (`1000`; `0` disables; gated by `resyncOnGap`).
>   `0.5.1` was docs-only (llms files).
> - **0.6.0 (`#11`, transport)** — `transport.iceServers` also accepts a lazy async **`IceServersProvider`**;
>   new `transport.iceTransportPolicy` (`"all"`). `IceServersProvider` + `TransportConfig` types are exported
>   from the package root. `0.7.0` was a version-only republish (no source change).
> - **0.8.0 (`#12`, zero-config internet play)** — `transport.iceServers` default is now the sentinel
>   **`"auto"`**; `serverSignaling(url)` exposes a derived `iceEndpoint`; the hub's `handle` serves
>   **`GET /api/ice`** (short-lived Cloudflare Realtime TURN credentials); new `hub.ice` config block.
>   The old "no TURN ever" statement is **no longer true** for the `./server` tier (see the D2 note below).
> - **0.8.1 / 0.8.2** — CI moved to `@moku-labs/ci`; `0.8.2` bumps the bundled core to `1.6.0` + common to
>   `0.3.2` and frees plugin resources from the `onStop` state (kernel 1.6 passes `{ global, config, state }`
>   to `onStop`) — no public API change.

> **BREAKING in 0.3.1 — the `./server` tier is a plugin, not a core (`#6`).** Through 0.2.0, `./server` was
> its **own server core** you `createApp`'d from. In 0.3.1 it is **no longer a core** (no
> `createCore`/`createApp`): `@moku-labs/room/server` now just **exports `hubPlugin` (a `@moku-labs/worker`
> plugin) + the `Hub` Durable Object class**. A Layer-3 Cloudflare app composes `hubPlugin` into its **own
> single `@moku-labs/worker` `createApp`** — alongside `durableObjectsPlugin` (the `Hub` DO) +
> `deployPlugin`/`cliPlugin` — keeping full control of its worker composition + `wrangler.jsonc`. This is the
> one-worker composition idiom (`moku-idioms.md §I6`). `@moku-labs/worker` is an **optional peer** the
> consuming app provides. (`0.3.0` was a docs-only republish — no code change.)
>
> **BREAKING since 0.1.1 — Room is a standalone framework (`#4`).** 0.1.x was a *plugin pack* spread into a
> `@moku-labs/web` app (`roomPlugins.stage`/`.controller` arrays, `createPlugin` from web). 0.2.0 **rebuilt
> Room as its own `@moku-labs/core` framework** — a sibling to `@moku-labs/web`/`@moku-labs/worker`, NOT built
> on them. You `createApp` **from Room itself**; the `@moku-labs/web` dependency is gone, there are **no role
> arrays** (all plugins are uniform), and the `./browser` entry was dropped (the one client entry serves
> browser + node tests). A third signaling adapter (`serverSignaling`) was added.

## A standalone `@moku-labs/core` framework — one core + an opt-in server-plugin tier

`@moku-labs/room` is its **own** Moku framework: one `createCoreConfig` ("room"), then it **exports**
`createApp` — Layer-3 apps call it (the framework never does). It ships **two entry points** — the client
core (`.`) and the opt-in `./server` tier (a plugin export, **not** a second core):

| Import | What | For |
|--------|------|-----|
| `@moku-labs/room` (`.`) | **client core** | `createApp` for the browser couch game. Four engines are wired as defaults; an app adds a role facade (`stagePlugin`/`controllerPlugin`) + its game plugin. Also runs node tests (no separate `./browser` entry). |
| `@moku-labs/room/server` (`./server`) | **server-plugin tier** (no core) | Exports **`hubPlugin`** (a `@moku-labs/worker` plugin) + the **`Hub`** Durable Object class. Compose `hubPlugin` into your **own** `@moku-labs/worker` `createApp` (the opt-in Cloudflare signaling tier). Reached from the browser via `serverSignaling(url)`. |

Couch-multiplayer: one **stage** (shared TV/laptop — the authoritative host that calls `createRoom()`) +
up to **8 controllers** (phones that `joinRoom(code)`), connected over **direct WebRTC DataChannels on the
LAN**. Phones scan a QR to join; inputs flow to the host; the host owns state and broadcasts it back. **Star
topology** — every phone connects only to the host; there are no controller↔controller channels. No
accounts, no lobby servers.

> **Two planes, kept strictly separate:** the **`Wire`** (`Frame` DataChannel) carries **all gameplay**
> (intents, snapshots, deltas, heartbeats, recovery); Moku **`emit` (`room:*`)** carries **only coarse
> lifecycle**. No gameplay payload ever rides `emit`, and no `room:*` event ever carries gameplay.
>
> **D2 accepted hard-failure (default tier):** strict P2P; under the default `publicRendezvous` tier Room
> operates **no TURN** and adds none — on AP-isolated / symmetric-NAT / iOS-Private-Relay networks (~15–30% in
> the wild) the connection can hard-fail with no recovery path (surfaces `room:network-warning`). Design
> target: the **home LAN**. **Since 0.8.0 the opt-in `./server` tier closes that gap:** the hub serves
> `GET /api/ice` (short-lived Cloudflare TURN credentials) and the `iceServers: "auto"` default fetches them,
> so ICE races local/STUN/relay pairs. The hub DO still brokers *signaling/discovery only* — gameplay stays on
> P2P DataChannels (a hostile-NAT pair may ride a Cloudflare TURN relay, never the DO). A consumer may also
> inject its own STUN/TURN via `transport.iceServers` (array or provider, 0.6.0).

## 1. Client core API form (v0.8.2)

The four engines (`transport`, `session`, `intent`, `sync`) are **core defaults** — already wired. An app
adds exactly one role facade and its own game plugin; there are no `roomPlugins` arrays. Select the
signaling adapter via `pluginConfigs.transport.signaling`.

```ts
import { createApp, createPlugin, stagePlugin } from "@moku-labs/room";

// Game logic depends on the facade so the six room:* events are visible in one edge.
const game = createPlugin("game", {
  depends: [stagePlugin],
  hooks: (ctx) => ({
    "room:peer-joined": ({ peerId }) => ctx.log.info(`controller joined: ${peerId}`),
    "room:network-warning": ({ reason }) => ctx.log.warn(`network: ${reason}`),
  }),
});

const app = createApp({ plugins: [stagePlugin, game] }); // engines are defaults; add facade + game
await app.start();

const { code, joinUrl } = app.stage.createRoom(); // SYNCHRONOUS — returns the descriptor directly
const qr = await app.stage.qr();                   // QR is async (descriptor.qr is always null)
if (qr) renderJoinQr(qr);

app.stage.onIntent("score", (payload, peerId) =>
  app.stage.mutate("scores", (draft) => ({ ...draft, [peerId]: ((draft[peerId] as number) ?? 0) + 1 }))
);
```

```ts
// Controller (phone) — the mirror role.
import { createApp, createPlugin, controllerPlugin } from "@moku-labs/room";

// 0.4.0: a live intent that gets no host receipt within the retransmit budget ends here — show retry UX.
const pad = createPlugin("pad", {
  depends: [controllerPlugin],
  hooks: (ctx) => ({
    "room:intent-undeliverable": ({ name, cSeq }) => ctx.log.warn(`intent lost: ${name} #${cSeq}`),
  }),
});

const app = createApp({ plugins: [controllerPlugin, pad] });
await app.start();
await app.controller.joinRoom("K7P2Q9"); // throws on "full" | "not-found" | "unreachable"
await app.controller.requestWakeLock();  // keep the phone awake (iOS Safari 16.4+)
const off = app.controller.on("round", (round) => render(round)); // read-only replica
app.controller.intent("move", { dx: 1, dy: 0 });                  // typed input over the Wire (never emit);
                                                                  // at-least-once since 0.4.0 (acked + retransmitted)
```

`createApp` is bound from the framework's single core; `createPlugin("name", spec)` authors a custom plugin
bound to Room's `Config`/`Events` (generics infer from the spec — never written explicitly; document each
export with a directly-preceding JSDoc block, never destructure — see moku-core "Public Export Shape").
`createApp` accepts `plugins`, `pluginConfigs`, `config`, and `onReady`/`onError`/`onStart`/`onStop`
lifecycle callbacks. Since 0.8.2 the bundled kernel is `@moku-labs/core@1.6.0`: a custom plugin's `onStop`
receives `{ global, config, state }`, so free timers/handles from `state` there (Room's own engines do —
the old `ctx.global`-keyed teardown registry is gone).

## 2. Plugins (7) — 4 client engines + 2 role facades + 1 server plugin

| # | Plugin | Tier | Wiring | Depends on | Role / key API | Events |
|---|--------|------|--------|-----------|----------------|--------|
| 1 | `transportPlugin` | Complex | client default | — | WebRTC DataChannels: signaling handshake, chunking/backpressure, mandatory heartbeat, capped ICE recovery; owns the typed `Wire`. ICE servers resolve lazily at `connect()` (array / `IceServersProvider` / `"auto"`, 0.6.0–0.8.0). API: `connect`, `wire`, `disconnect`, `peers`, `close`. | `room:network-warning` |
| 2 | `sessionPlugin` | Complex | client default | transport | Room code + QR + roster; star topology (`hostId()`); client-side host-reload recovery. API: `createRoom`, `qr`, `joinRoom`, `leave`, `rejoin`, `roster`, `self`, `hostToken`, `recoveryPhase`. | `room:peer-joined`, `room:peer-left`, `room:host-reconnecting` |
| 3 | `intentPlugin` | Standard | client default | transport, session | Controller→host typed inputs (`IntentFrame`, per-controller `cSeq` idempotent de-dup). **At-least-once since 0.4.0:** the host receipt-acks every frame (`IntentAckFrame`), the controller retransmits the same `cSeq` stop-and-wait (bounded, doubling backoff). API: `register`, `onIntent`, `intent`. | `room:intent-undeliverable` |
| 4 | `syncPlugin` | Complex | client default | transport, session | Host→controller authoritative state: full snapshot + throttled op-list deltas. Gap heal over the wire (`SyncResyncFrame`, 0.3.2) + not-ready baseline retry (0.5.0) — the host re-baselines the one reporting peer automatically. API: `registerSlice`, `mutate`, `broadcast`, `onResyncRequest`, `read`, `subscribe`, `applyFrame`. | `room:sync-ready` |
| 5 | `stagePlugin` | Standard (facade) | app-added (host) | all four engines | **Host-role facade** → `app.stage` (`StageApi`). Re-declares all six `room:*` events. | (re-declares all 6) |
| 6 | `controllerPlugin` | Standard (facade) | app-added (controller) | all four engines | **Controller-role facade** → `app.controller` (`ControllerApi`). Re-declares all six `room:*` events. | (re-declares all 6) |
| 7 | `hubPlugin` | Standard | **`./server` tier** — a **`@moku-labs/worker` plugin** (`createPlugin` from `@moku-labs/worker`); compose into your own worker `createApp` | — | The `@moku-labs/room/server` signaling tier: a WS-Hibernation **DO-per-room** over the native Cloudflare `env` (DO + KV) — handshake broker + in-band discovery + host-reload reclaim. **No gameplay relay** (D2). Since 0.8.0 `handle` also answers **`GET /api/ice`** (TURN-credential mint, fail-open). API: `app.hub.handle(request, env, ctx): Promise<Response>`. | — |

Facades **re-declare** all six `room:*` events for *compile-time visibility only* — a downstream game
plugin (`depends: [stagePlugin]` / `[controllerPlugin]`) then sees the complete typed hook surface in one
edge. They install **no forwarding hooks** (Moku's event bus is global; the engines' `emit("room:*")`
already reaches every hook regardless of `depends`), delegate API, and own no state.

### Facade API surfaces (re-verified at `v0.8.2` — `StageApi` / `ControllerApi` signatures are unchanged since `v0.2.0`)

```ts
type StageApi = {
  createRoom(): RoomDescriptor;                          // SYNCHRONOUS
  qr(): Promise<QrMatrix | null>;
  mutate(ns: Namespace, recipe: (draft: Cells) => Cells): void;
  broadcast(): void;
  onIntent(name: string, handler: (payload: unknown, peerId: PeerId) => void): () => void;
  roster(): readonly RosterEntry[];
};
type ControllerApi = {
  joinRoom(code: string): Promise<void>;                 // throws on "full" | "not-found" | "unreachable"
  read(ns: Namespace): Readonly<Record<string, JsonValue>> | undefined;
  on(ns: Namespace, cb: (value: Readonly<Record<string, JsonValue>>) => void): () => void;
  intent(name: string, payload: JsonValue): void;
  requestWakeLock(): Promise<boolean>;
  releaseWakeLock(): Promise<void>;
};
// RoomDescriptor = { code, joinUrl, qr: QrMatrix | null, hostToken }
// JoinResult     = { ok: true; selfId: PeerId } | { ok: false; reason: "full" | "not-found" | "unreachable" }
```

## 3. Signaling adapters (the `transport.signaling` seam)

All three are interchangeable behind one `Signaling` type — swapping needs **zero** transport changes.

- **`publicRendezvous()`** — **default**. Trystero over a public Nostr backbone. Zero infra; production.
- **`inMemory()`** — in-process, no `RTCPeerConnection`. Deterministic; tests/simulation.
  `inMemory({ server: true })` simulates the server protocol without a live Worker.
- **`serverSignaling(url)`** — **opt-in**, worker-backed. One persistent WebSocket to your own `./server`
  tier; enables **in-band discovery** + **host-reload reclaim**. Lazy-loaded — bundles that never call it
  pay nothing. Public deployments SHOULD widen the room code (`session.codeLength: 8`, D24). Since 0.8.0 the
  returned `Signaling` also carries `iceEndpoint` (`ws(s)://host` → `http(s)://host/api/ice`); with
  `transport.iceServers` left at `"auto"` the transport fetches TURN credentials from it (2 s bound,
  fail-open onto public STUN). The other two adapters omit `iceEndpoint`.

## 4. Server tier (`@moku-labs/room/server`) — a plugin export, NOT a core (0.3.1)

Opt-in tier for running the rendezvous yourself: one **Durable Object per room** on Cloudflare. As of 0.3.1
`./server` is **not** a core — it exports **`hubPlugin`** (a `@moku-labs/worker` plugin) + the **`Hub`**
Durable Object class. You compose `hubPlugin` into your **own** `@moku-labs/worker` `createApp` — the
**one-worker composition idiom** (`moku-idioms.md §I6`): a single worker app composing the resource plugins
the hub needs + `hubPlugin` + `deploy`/`cli`. Your app keeps full control of its composition + `wrangler.jsonc`
(D26). `@moku-labs/worker` is an **optional peer** you install yourself; `./server` ships **no `types`
condition** (import-only) — type its export in a `declarations.d.ts` ambient until upstream adds types.

```ts
// src/server.ts — ROOT composition: ONE @moku-labs/worker app composing room's hubPlugin.
import { cliPlugin, createApp, deployPlugin, durableObjectsPlugin, kvPlugin } from "@moku-labs/worker";
import { hubPlugin } from "@moku-labs/room/server";

export const server = createApp({
  plugins: [kvPlugin, durableObjectsPlugin, hubPlugin, deployPlugin, cliPlugin],
  pluginConfigs: { durableObjects: { hub: { binding: "ROOM_HUB", className: "Hub" } } },
}); // server.hub.handle = the runtime fetch; server.cli.{dev,deploy} generate wrangler.jsonc

// src/cloudflare/worker.ts — Cloudflare entry: delegate fetch to the composed app.
import { server } from "../server";
export { Hub } from "@moku-labs/room/server"; // re-export the DO class → wrangler binds ROOM_HUB
export default {
  fetch: (req: Request, env: Record<string, unknown>, ctx: ExecutionContext) => server.hub.handle(req, env, ctx),
} satisfies ExportedHandler;
```

| `./server` export | What it is |
|---|---|
| `hubPlugin` | The `hub` plugin instance — a **`@moku-labs/worker` plugin** (`createPlugin` from `@moku-labs/worker`). Compose it into your own worker `createApp`; `app.hub.handle(req, env, ctx)` is the handler your `fetch` delegates to. |
| `Hub` | The `Hub` Durable Object class — re-export from your worker entry so `wrangler` binds `ROOM_HUB` to it (config it via `durableObjects: { hub: { binding: "ROOM_HUB", className: "Hub" } }`). |

**Deploy (D26 — the app owns deployment).** Room ships **no `wrangler.jsonc`**; your `@moku-labs/worker` app's
`deploy`/`cli` plugins generate it. Declare three bindings: `ROOM_HUB` (the DO + its SQLite migration),
`RATE_LIMIT` (a KV namespace for the per-IP join limit — `kvPlugin`), `ASSETS` (your built web client). What
the server tier buys over `publicRendezvous()`: **in-band discovery** (peer arrival/leave pushed from the DO),
**host-reload reclaim** (the DO mints a `reclaimToken` on join; `session` persists + replays it so the **warm
room survives** a host reload), **room-teardown UX** (an idle room's DO Alarm emits `{kind:"evict"}` →
`room:network-warning { reason: "room-evicted" }`), and — since 0.8.0 — **zero-config internet play** (below).
It does **not** add a gameplay hop — the DO has no relay path (D2 still holds).

**Internet play — `GET /api/ice` (0.8.0).** `hub.handle` routes three ways: `Upgrade: websocket` → the per-room
DO (`400` without a room code, `429` over the join rate limit); `GET {hub.ice.path}` (default `/api/ice`) → the
TURN-credential mint; everything else → `env.ASSETS`. The mint reads two worker **secrets** off `env`
(`TURN_KEY_ID` / `TURN_KEY_API_TOKEN` by default) and returns `200 { iceServers }` — short-lived Cloudflare
Realtime TURN credentials (4 h TTL, `Cache-Control: no-store`, per-IP limited through the same `RATE_LIMIT`
KV). **Without the secrets it answers a quiet empty `200 {}`** (expected in local dev) and the browser stays
on public STUN. Real failures are `405` (not GET), `429` (over the mint budget), `502` (upstream mint failed)
— the client treats all of them as "fall back to STUN". The app writes **no ICE code**: `serverSignaling(url)`
+ the `"auto"` default do the fetch. Upstream's hub README says the secrets are provisioned by
`@moku-labs/worker`'s `turnPlugin` (`pluginConfigs.turn = { relay: { name: "myapp-turn" } }`, worker ≥ 0.16),
or by hand with `wrangler secret put TURN_KEY_ID` / `TURN_KEY_API_TOKEN`. The `moku-worker` pack
teaches `turnPlugin` (worker `0.20.2`). ⚠️ Room's optional peer range is still `@moku-labs/worker@^0.15.0`, which
for a `0.x` version means `>=0.15.0 <0.16.0` and so excludes every worker with `turnPlugin` — expect a
peer-range warning when both are installed, until upstream widens the range.

## 5. Events (`room:*` — coarse lifecycle only)

| Event | Payload | Emitted by | Meaning |
|-------|---------|-----------|---------|
| `room:peer-joined` | `{ peerId }` | session | A controller's channel reached `connected` + was added to the roster. |
| `room:peer-left` | `{ peerId }` | session | A controller left / was declared dead by the heartbeat; removed from roster. |
| `room:host-reconnecting` | `{}` | session | Host tab reloaded; client-side recovery in flight — show "reconnecting" UX. |
| `room:sync-ready` | `{}` | sync | First authoritative frame (snapshot, or gap-free delta) applied; the synced replica is readable. |
| `room:intent-undeliverable` | `{ name: string; cSeq: number }` | intent | **0.4.0.** A LIVE controller intent exhausted its retransmit budget with no host receipt — the wire is dead for this controller's intent stream; every intent queued behind it drops with its own event. Not fired for intents captured by the reconnect buffer during a known host absence. Surface retry UX. |
| `room:network-warning` | `{ reason: "ice-failed" \| "rendezvous-unreachable" \| "channel-closed" \| "room-evicted" }` | transport | A connectivity hard-failure surfaced for failure UX (D2). `room-evicted` is **`./server` tier only** — the `serverSignaling` DO's idle Alarm tore the room down. |

> **Reload-path timing.** `room:host-reconnecting` is emitted during `session` init, before downstream
> consumer hooks register. On the reload path, poll `app.session.recoveryPhase()` (a non-`"stable"` phase
> means recovery is in flight) rather than relying on the event; the event remains useful for steady-state.

## 6. Configuration (couch-profile defaults — zero overrides needed)

Every field has a safe default (the verified "couch" profile); override via
`createApp({ pluginConfigs: { <plugin>: { … } } })`. The facades (`stage`/`controller`) own **no config** —
every knob lives on the engine that owns the concern (wake-lock is the opt-in `requestWakeLock()` API).

- **`transport`:** `signaling` (`publicRendezvous()`), `iceServers` (**`"auto"`** since 0.8.0 — with
  `serverSignaling` it lazily fetches the hub's `/api/ice`, with any other adapter it is one public STUN
  `stun.l.google.com:19302`; also accepts a plain `RTCIceServer[]` — `[]` = LAN-only — or, since 0.6.0, an
  `IceServersProvider` `() => Promise<readonly RTCIceServer[] | undefined>` invoked at `connect()` in parallel
  with the signaling join, failing open onto STUN on `undefined`/throw/timeout (waits at most `openTimeoutMs`);
  any explicit value replaces `"auto"` wholesale), `iceTransportPolicy` (`"all"`, 0.6.0; `"relay"` forces
  TURN-only pairs; the `"all"` default also honors the `?ice=relay` page-URL diagnostic toggle),
  `heartbeatIntervalMs` (`2000`, mandatory), `heartbeatTimeoutMs` (`6000`), `openTimeoutMs` (`3000`),
  `maxMessageBytes` (`14336`).
- **`session`:** `joinUrlBase` (`""` → `location.origin`), `generateQr` (`true`), `maxControllers` (`8`),
  `snapshotDebounceMs` (`500`), `reconnectTimeoutMs` (`10000`), `intentBufferMax` (`256`),
  `intentBufferMaxAgeMs` (`8000`), `storageKeyPrefix` (`"moku.room"`), `codeLength?` (`6` =
  `ROOM_CODE_LENGTH`; **set `8` for `serverSignaling`** — ~57 bits, resists room-code enumeration, D24).
- **`intent`:** `bufferCap` (`256`; also caps the live send queue), `bufferMaxAgeMs` (`10000`),
  `ackTimeoutMs` (`1000`, 0.4.0 — wait before the first retransmit, doubles per attempt; must be `>= 1`),
  `maxRetransmits` (`3`, 0.4.0 — `0` = track + signal, never re-send; ~15 s total silence budget at defaults).
- **`sync`:** `broadcastHz` (`30`, clamped `[5,60]`; verified band 20–30 Hz), `skipEmptyDeltas` (`true`),
  `maxOpsPerDelta` (`512`), `resyncOnGap` (`true`; since 0.3.2 the gap is reported over the wire and the host
  re-baselines that peer automatically), `baselineRetryMs` (`1000`, 0.5.0 — a not-yet-ready replica re-requests
  its join baseline at this cadence; `0` disables; off when `resyncOnGap` is `false`).
- **`hub`** (`./server` tier — set on the `hub` plugin in your worker app's `pluginConfigs`): `doBinding` (`"ROOM_HUB"`), `doClassName` (`"Hub"`), `assetsBinding`
  (`"ASSETS"`), `rateLimit` (`{ joins: 30, windowSec: 60, kvBinding: "RATE_LIMIT" }`), `ice` (0.8.0 —
  `{ path: "/api/ice", keyIdBinding: "TURN_KEY_ID", apiTokenBinding: "TURN_KEY_API_TOKEN", rateLimit: { max: 30, windowSec: 60 } }`;
  the mint budget is counted in the same `rateLimit.kvBinding` KV), `joinWindowMs` (`10000`), `roomTtlMs`
  (`1800000`).
- **`stage` / `controller`:** **no config**.

## 7. Dependency graph

```
client core (@moku-labs/room):
  transport → session → intent ─┐
     │           │              ├→ stage       (host facade)    + browserEnv (default)
     │           └────→ sync ───┤
     └──────────────────────────└→ controller (phone facade)

./server tier (@moku-labs/room/server) — composed into YOUR @moku-labs/worker app:
  hubPlugin  (a @moku-labs/worker plugin; standalone — no room/worker plugin deps)
```

Engines are client-core defaults (init order = the wired default order; `intent` and `sync` are parallel
siblings); an app adds exactly one facade + its game plugin. The wire/signaling protocol (`Signaling`,
`Wire`, every `Frame` — including `IntentAckFrame` (0.4.0) and `SyncResyncFrame` (0.3.2) — `Snapshot`, `Op`,
`RosterEntry`, `MAX_CONTROLLERS`, `ROOM_CODE_LENGTH`, …) lives in [`src/plugins/transport/protocol.ts`] and is
re-exported from the package root; the `RoomEvents` contract in `src/config.ts`. The root also exports the
plugin-owned types `IceServersProvider`, `TransportConfig` (0.6.0), `RoomDescriptor`, `JoinResult`,
`QrMatrix`, `StageApi`, `ControllerApi`.

## 8. Idiomatic placement (`moku-idioms.md`)

A room app is a **Layer-3 app** that `createApp`s **from Room** for the client (`@moku-labs/room`), and — if
it runs the opt-in signaling tier — adds a **single `@moku-labs/worker` `createApp`** that composes room's
`hubPlugin` (+ `durableObjects`/`deploy`/`cli`) for the server, never `createCoreConfig`/`createCore` or a
direct `@moku-labs/core` dependency (I1). It's the same "compose the frameworks you need" shape as
`demos/tracker`: multiple `createApp` instances across **distinct** runtimes (a Room client app + a worker
server app) and folder splits by concern (a thin `cloudflare/worker.ts` entry, logic in plugins) remain
idiomatic. The server is **one** worker app composing `hubPlugin` — never a second/facade app (`moku-idioms.md §I6`).
