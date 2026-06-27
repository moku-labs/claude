# @moku-labs/room — Plugin & Property Index

**Synced version:** `0.3.1` (npm `dist-tags.latest`; catalog generated from the `v0.3.1` git tag **source** +
the root README. ⚠️ Upstream `llms.txt`/`llms-full.txt` are **stale** — they still describe the pre-`0.3.1`
**server *core*** model (`createApp` from `./server`, "no peerDependencies") and the 0.1.x *plugin-pack*
names; per the registry's "source wins" policy the tag source (`src/server.ts`, `src/plugins/hub/`) is
authoritative). Built on `@moku-labs/core@1.5.0` + `@moku-labs/common@0.2.1` as **bundled** dependencies +
bundled `trystero@~0.25.2` (signaling) and `qrcode@^1.5.4` (join QR). **`@moku-labs/worker@^0.15.0` is an
OPTIONAL `peerDependency`** (`peerDependenciesMeta.optional`) — needed **only** by the `./server` tier (its
`hubPlugin` is a `@moku-labs/worker` plugin); pure-client apps install nothing extra. Engines node ≥24,
bun ≥1.3.14.

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
> **D2 accepted hard-failure:** strict P2P, **no TURN ever** — on AP-isolated / symmetric-NAT /
> iOS-Private-Relay networks (~15–30% in the wild) the connection can hard-fail with no recovery path
> (surfaces `room:network-warning`). Design target: the **home LAN**. The `./server` tier does **not**
> change this — it brokers *signaling/discovery only*; gameplay stays strict P2P with no relay.

## 1. Client core API form (v0.3.1)

The four engines (`transport`, `session`, `intent`, `sync`) are **core defaults** — already wired. An app
adds exactly one role facade and its own game plugin; there are no `roomPlugins` arrays. Select the
signaling adapter via `pluginConfigs.transport.signaling`.

```ts
import { createApp, createPlugin, stagePlugin } from "@moku-labs/room";

// Game logic depends on the facade so the five room:* events are visible in one edge.
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

const app = createApp({ plugins: [controllerPlugin /*, pad */] });
await app.start();
await app.controller.joinRoom("K7P2Q9"); // throws on "full" | "not-found" | "unreachable"
await app.controller.requestWakeLock();  // keep the phone awake (iOS Safari 16.4+)
const off = app.controller.on("round", (round) => render(round)); // read-only replica
app.controller.intent("move", { dx: 1, dy: 0 });                  // typed input over the Wire (never emit)
```

`createApp` is bound from the framework's single core; `createPlugin("name", spec)` authors a custom plugin
bound to Room's `Config`/`Events` (generics infer from the spec — never written explicitly; document each
export with a directly-preceding JSDoc block, never destructure — see moku-core "Public Export Shape").
`createApp` accepts `plugins`, `pluginConfigs`, `config`, and `onReady`/`onError`/`onStart`/`onStop`
lifecycle callbacks.

## 2. Plugins (7) — 4 client engines + 2 role facades + 1 server plugin

| # | Plugin | Tier | Wiring | Depends on | Role / key API | Events |
|---|--------|------|--------|-----------|----------------|--------|
| 1 | `transportPlugin` | Complex | client default | — | WebRTC DataChannels: signaling handshake, chunking/backpressure, mandatory heartbeat, capped ICE recovery; owns the typed `Wire`. API: `connect`, `wire`, `disconnect`, `peers`, `close`. | `room:network-warning` |
| 2 | `sessionPlugin` | Complex | client default | transport | Room code + QR + roster; star topology (`hostId()`); client-side host-reload recovery. API: `createRoom`, `qr`, `joinRoom`, `leave`, `rejoin`, `roster`, `self`, `hostToken`, `recoveryPhase`. | `room:peer-joined`, `room:peer-left`, `room:host-reconnecting` |
| 3 | `intentPlugin` | Standard | client default | transport, session | Controller→host typed inputs (`IntentFrame`, per-controller `cSeq` idempotent de-dup). API: `register`, `onIntent`, `intent`. | — |
| 4 | `syncPlugin` | Complex | client default | transport, session | Host→controller authoritative state: full snapshot + throttled op-list deltas. API: `registerSlice`, `mutate`, `broadcast`, `read`, `subscribe`, `applyFrame`. | `room:sync-ready` |
| 5 | `stagePlugin` | Standard (facade) | app-added (host) | all four engines | **Host-role facade** → `app.stage` (`StageApi`). Re-declares all five `room:*` events. | (re-declares all 5) |
| 6 | `controllerPlugin` | Standard (facade) | app-added (controller) | all four engines | **Controller-role facade** → `app.controller` (`ControllerApi`). Re-declares all five `room:*` events. | (re-declares all 5) |
| 7 | `hubPlugin` | Standard | **`./server` tier** — a **`@moku-labs/worker` plugin** (`createPlugin` from `@moku-labs/worker`); compose into your own worker `createApp` | — | The `@moku-labs/room/server` signaling tier: a WS-Hibernation **DO-per-room** over the native Cloudflare `env` (DO + KV) — handshake broker + in-band discovery + host-reload reclaim. **No gameplay relay** (D2). API: `app.hub.handle(request, env, ctx): Promise<Response>`. | — |

Facades **re-declare** all five `room:*` events for *compile-time visibility only* — a downstream game
plugin (`depends: [stagePlugin]` / `[controllerPlugin]`) then sees the complete typed hook surface in one
edge. They install **no forwarding hooks** (Moku's event bus is global; the engines' `emit("room:*")`
already reaches every hook regardless of `depends`), delegate API, and own no state.

### Facade API surfaces (verified at `v0.2.0`; client surface unchanged through `v0.3.1` — 0.3.x touched only the `./server` tier)

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
  pay nothing. Public deployments SHOULD widen the room code (`session.codeLength: 8`, D24).

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
room survives** a host reload), and **room-teardown UX** (an idle room's DO Alarm emits `{kind:"evict"}` →
`room:network-warning { reason: "room-evicted" }`). It does **not** add a gameplay hop — the DO has no relay
path (D2 still holds).

## 5. Events (`room:*` — coarse lifecycle only)

| Event | Payload | Emitted by | Meaning |
|-------|---------|-----------|---------|
| `room:peer-joined` | `{ peerId }` | session | A controller's channel reached `connected` + was added to the roster. |
| `room:peer-left` | `{ peerId }` | session | A controller left / was declared dead by the heartbeat; removed from roster. |
| `room:host-reconnecting` | `{}` | session | Host tab reloaded; client-side recovery in flight — show "reconnecting" UX. |
| `room:sync-ready` | `{}` | sync | First authoritative frame (snapshot, or gap-free delta) applied; the synced replica is readable. |
| `room:network-warning` | `{ reason: "ice-failed" \| "rendezvous-unreachable" \| "channel-closed" \| "room-evicted" }` | transport | A connectivity hard-failure surfaced for failure UX (D2). `room-evicted` is **`./server` tier only** — the `serverSignaling` DO's idle Alarm tore the room down. |

> **Reload-path timing.** `room:host-reconnecting` is emitted during `session` init, before downstream
> consumer hooks register. On the reload path, poll `app.session.recoveryPhase()` (a non-`"stable"` phase
> means recovery is in flight) rather than relying on the event; the event remains useful for steady-state.

## 6. Configuration (couch-profile defaults — zero overrides needed)

Every field has a safe default (the verified "couch" profile); override via
`createApp({ pluginConfigs: { <plugin>: { … } } })`. The facades (`stage`/`controller`) own **no config** —
every knob lives on the engine that owns the concern (wake-lock is the opt-in `requestWakeLock()` API).

- **`transport`:** `signaling` (`publicRendezvous()`), `iceServers` (one public STUN; `[]` = LAN-only;
  **no TURN ever**), `heartbeatIntervalMs` (`2000`, mandatory), `heartbeatTimeoutMs` (`6000`),
  `openTimeoutMs` (`3000`), `maxMessageBytes` (`14336`).
- **`session`:** `joinUrlBase` (`""` → `location.origin`), `generateQr` (`true`), `maxControllers` (`8`),
  `snapshotDebounceMs` (`500`), `reconnectTimeoutMs` (`10000`), `intentBufferMax` (`256`),
  `intentBufferMaxAgeMs` (`8000`), `storageKeyPrefix` (`"moku.room"`), `codeLength?` (`6` =
  `ROOM_CODE_LENGTH`; **set `8` for `serverSignaling`** — ~57 bits, resists room-code enumeration, D24).
- **`intent`:** `bufferCap` (`256`), `bufferMaxAgeMs` (`10000`).
- **`sync`:** `broadcastHz` (`30`, clamped `[5,60]`; verified band 20–30 Hz), `skipEmptyDeltas` (`true`),
  `maxOpsPerDelta` (`512`), `resyncOnGap` (`true`).
- **`hub`** (`./server` tier — set on the `hub` plugin in your worker app's `pluginConfigs`): `doBinding` (`"ROOM_HUB"`), `doClassName` (`"Hub"`), `assetsBinding`
  (`"ASSETS"`), `rateLimit` (`{ joins: 30, windowSec: 60, kvBinding: "RATE_LIMIT" }`), `joinWindowMs`
  (`10000`), `roomTtlMs` (`1800000`).
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
`Wire`, every `Frame`, `Snapshot`, `Op`, `RosterEntry`, `MAX_CONTROLLERS`, `ROOM_CODE_LENGTH`, …) lives in
[`src/plugins/transport/protocol.ts`] and is re-exported from the package root; the `RoomEvents` contract in
`src/config.ts`.

## 8. Idiomatic placement (`moku-idioms.md`)

A room app is a **Layer-3 app** that `createApp`s **from Room** for the client (`@moku-labs/room`), and — if
it runs the opt-in signaling tier — adds a **single `@moku-labs/worker` `createApp`** that composes room's
`hubPlugin` (+ `durableObjects`/`deploy`/`cli`) for the server, never `createCoreConfig`/`createCore` or a
direct `@moku-labs/core` dependency (I1). It's the same "compose the frameworks you need" shape as
`demos/tracker`: multiple `createApp` instances across **distinct** runtimes (a Room client app + a worker
server app) and folder splits by concern (a thin `cloudflare/worker.ts` entry, logic in plugins) remain
idiomatic. The server is **one** worker app composing `hubPlugin` — never a second/facade app (`moku-idioms.md §I6`).
