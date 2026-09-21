# @moku-labs/worker — Plugin & Property Index

**Synced version:** `0.20.2` (npm `dist-tags.latest`; surface read from the `v0.20.2` git tag's source —
upstream `llms.txt`/`llms-full.txt` are stale at this tag, the source wins. The `0.15.0 → 0.20.2` delta,
additive, 9 → **10 plugins**: **0.15.1** the `deploy.dev` watcher drops stale watch-echo batches (a rebuild
can no longer schedule the next one); **0.16.0** added the **`turn` plugin** (`turnPlugin`) — Cloudflare
Realtime TURN keys as a declared deploy resource — plus the `"turn"` resource kind on
`provision:resource`/`provision:skip` and the required **`DeployReport.turn`** field; **0.17.0** moved TURN
keys into the standard flow (plan → provision → bind the two worker secrets right after `wrangler deploy`;
failures are degraded-class, the deploy continues); **0.18.0** made TURN existence name-anchored (a key with
the declared name exists AND both secrets are bound); **0.19.0** added `turn.<key>.verifyPath` (live mint
check at preflight, default `"/api/ice"`); **0.20.0** added the `.env.local` key-pair escape hatch;
**0.20.1**/**0.20.2** are CI and dependency bumps only. Earlier, `0.11.0 → 0.15.0`: **0.12.0 (BREAKING)**
removed the **`stage` plugin** and rebranded the plugin id to **`"worker"`** — deployment stage is now plain
global config (`config.stage`, read via `ctx.global.stage`), no stage plugin; **0.12.1** sourced the env provider
`workerSafeProcessEnv` from `@moku-labs/common`; **0.13.0** added the **`deploy --delete`** teardown command
(`cli.deploy({ delete })` → `deploy.destroy()`; 0.13.1 fixed the queue↔Worker cycle in `--delete`);
**0.14.0** added **`endpoint.new(guard)`** — a chainable guard factory; **0.15.0** let guards **enrich** the
request context (a guard returning an object merges a typed field onto `ctx`). Earlier: `0.11.0` (`#42`)
removed the `./cli` subpath — `deployPlugin`/`cliPlugin` + the manifest types ship **only** from the package
root). Built on `@moku-labs/core@1.6.0`; uses `@moku-labs/common@0.3.2` (both pinned exactly, bumped from
`1.5.0` / `0.3.0` at 0.20.2; `common` supplies the `log` + `env` core plugins, plus `workerSafeProcessEnv`,
sourced from it since 0.12.1). `wrangler` is an **optional `peerDependency`** (`>=3`). Engines: node ≥24,
bun ≥1.3.14.

A Cloudflare Worker modelled as composable Moku plugins: each primitive (KV, D1, R2, Queues, Durable
Objects) is a plugin that resolves its binding **per request** off the Cloudflare `env`; a `server` plugin
owns HTTP routing. **Env is threaded as a call argument, never stored** (one isolate serves concurrent
requests). Deploy/CLI tooling is built from the same model but tree-shaken out of the runtime bundle.

> **Keyed-map resource config (since 0.7.0 — breaking vs 0.4.0).** Every resource plugin (kv, d1, queues,
> storage, durableObjects) is now configured as a **`Record<key, instance>`** of named instances rather
> than one flat binding. A lone entry (or one flagged `default: true`) is the implicit default; reach the
> others with `app.<kind>.use("key")`. `deployManifest()` returns an **array** (one descriptor per
> instance). The old single-binding configs (`kv.binding`, `d1.binding`, `storage.bucket`, …) no longer
> exist.

## Entry points

| Import | Surface | Bundle |
|--------|---------|--------|
| `@moku-labs/worker` (`.`) | The **only** entry point. Runtime: `createApp`, `createPlugin`, all resource plugin instances (incl. `turnPlugin` since 0.16.0), `endpoint` (+ its chainable `.new(guard)` factory), `defineDurableObject`, `logPlugin`/`envPlugin` (re-exported), **and `deployPlugin`/`cliPlugin`** (node-only graph tree-shaken out unless you list them), types (`WorkerConfig`, `WorkerEvents`, `WorkerEnv`, `WorkerPluginCtx`, `PluginCtx`, `GuardedEndpointFactory`, `EndpointGuard`, `DeployReport`, `SeedConfig`, `ExternalManifest`, `ResourceManifest` + `Server`/`D1`/`Queues`/`Storage`/`DurableObjects` namespaces). | Runtime plugins ship; deploy/cli pulled in only if listed (`"sideEffects": false`). |

> There is exactly **one** entry point — `.`. The `./cli` subpath was **removed in 0.11.0** (and the
> spec-referenced `@moku-labs/worker/worker` subpath never existed). The node-only `deployPlugin`/`cliPlugin`
> + the manifest types ship from the **root**; they only enter a bundle when a consumer actually lists the
> plugins in `createApp({ plugins })`.

## API form

- **`createApp(options?)`** — the Layer-3 consumer entry. **Synchronous**, built once per isolate at module
  load, frozen. Defaults `[logPlugin, envPlugin, bindingsPlugin, serverPlugin]` apply first (the `stage`
  plugin was **removed in 0.12.0** — there is no longer one); `options` shallow-merge on top. Options:
  `config?: Partial<WorkerConfig>`, `pluginConfigs?` (keyed by plugin name), `plugins?: PluginInstance[]`
  (appended; do NOT re-list a default — duplicate names throw), `onReady?: (app) => void` (runs after every
  `onInit`), `onError?: (error) => void`, `onStart?`/`onStop?: () => void | Promise<void>`. The final list is
  `[...frameworkDefaults, ...yourPlugins]`. Deployment stage is plain global config: `config.stage`, read off
  `ctx.global.stage` (deploy/cli use it to suffix resource names). The one piece of core-plugin config
  `createApp` still bridges is the env provider — a default workerd-safe `process.env` provider
  (`workerSafeProcessEnv`, from `@moku-labs/common` since 0.12.1) is seeded in `coreConfig` so
  `ctx.env.get("CLOUDFLARE_API_TOKEN")` resolves under Bun/Node.
- **`createPlugin("<name>", { … })`** — author a consumer plugin (no explicit generics — inferred). Imported
  from `@moku-labs/worker` (never `@moku-labs/core`). Type your context with `WorkerPluginCtx<Config, State,
  Events?>` (worker-bound alias that pre-merges `WorkerEvents`) or the raw re-exported `PluginCtx`.
- **`endpoint(path)`** — server route builder (`endpoint("/users/{id}").get(handler)`). Path params are
  typed onto `ctx.params` (`{id}` → `string`, `{id:?}` → `string | undefined`). **Guards (`.new(guard)`):**
  `endpoint.new(guard)` derives a NEW factory (callable exactly like `endpoint`, type `GuardedEndpointFactory`)
  that runs `guard` before every handler it builds; chain `.new` to **stack** guards (run in order; the
  receiver is never mutated, so factories branch safely). A guard returning a `Response` **short-circuits**
  (401 etc. — handler + later guards skipped); returning `void`/`undefined` **continues**. Since 0.15.0 a
  guard may also return an **object** → it is merged into the context handed to the handler **and later
  guards**, read as a **typed field** (e.g. `ctx.actor`) — so a guard resolves a value once and the handler
  reuses it with no re-resolve and no null-check. The enrichment type is inferred (the `EndpointGuard<Ext>` /
  `EndpointHandler<Params, Ext>` extension param is back-compatibly defaulted; a gate-only guard leaves the
  factory's context type unchanged). A guard that throws propagates exactly like a throwing handler. PURE
  factory — no ctx/lifecycle/side-effects; safe to call before `createApp`.
- **`defineDurableObject(name)`** — Durable Object base-class factory.
- **Plugin APIs** mount on `app.<name>` (`app.server.handle`, `app.kv.get`, `app.d1.query`). Resource plugins
  expose the **default instance's** methods flat plus `app.<name>.use("key")` for additional instances. Core
  plugins are flat-injected on every `ctx` (`ctx.log`, `ctx.env`) and also on `app.*`. Deployment stage is
  not a plugin — read it off `ctx.global.stage`.
- The Cloudflare default export (`{ fetch, scheduled, queue }`) is **hand-assembled** (no plugin produces
  it) — thread the per-invocation `env` into `app.server.handle` / `app.server.scheduled` /
  `app.queues.consume`.

```typescript
import { createApp, endpoint, kvPlugin } from "@moku-labs/worker";

// `endpoint.new(guard)` → a factory that runs the guard before every handler it builds.
// Gate (return Response) short-circuits; enrich (return object) adds a typed `ctx` field.
const authed = endpoint.new(async (ctx) => {
  const actor = await ctx.require(kvPlugin) && resolveActor(ctx.request); // illustrative
  if (!actor) return new Response("Unauthorized", { status: 401 });       // gate
  return { actor };                                                       // enrich → ctx.actor
});

export const app = createApp({
  // `config.stage` is plain global config (no stage plugin since 0.12.0); read via ctx.global.stage.
  config: { name: "my-api", stage: "production", compatibilityDate: "2026-06-17" },
  plugins: [kvPlugin],                       // bindings + server are defaults — don't re-list
  pluginConfigs: {
    bindings: { required: ["MY_KV"] },
    // keyed-map: one named instance; `cache` is the implicit default (sole entry).
    kv: { cache: { name: "my-cache", binding: "MY_KV" } },
    server: {
      endpoints: [
        endpoint("/health").get(() => new Response("ok")),
        authed("/me").get((ctx) => Response.json({ id: ctx.actor.id })) // typed, no null-check
      ]
    }
  }
});
// app.kv.get(env, key)            → default instance
// app.kv.use("cache").get(env, k) → explicit selector (same instance here)
// worker.ts (hand-assembled): export default { fetch: (r, env, ctx) => app.server.handle(r, env, ctx) }
```

## Plugins (10)

Name strings are bare (`"server"`, `"kv"`); exported instances carry the `Plugin` suffix (`serverPlugin`).
(The `stage` plugin was **removed in 0.12.0** — deployment stage is plain global `config.stage`, read via
`ctx.global.stage`; there is no `ctx.stage`.)

| Plugin | Instance | Tier | Entry | Key APIs |
|--------|----------|------|-------|----------|
| `bindings` | `bindingsPlugin` | Micro | `.` | `require(env, name)`, `has(env, name)` — binding-family dependency root |
| `server` | `serverPlugin` | Standard | `.` | `handle`, `scheduled`, `endpoint` (+ `endpoint.new(guard)`) — HTTP routing + dispatch (Worker-entry surface) |
| `kv` | `kvPlugin` | Micro | `.` | `get`, `put`, `delete`, `list`, `use(key)`, `deployManifest` |
| `d1` | `d1Plugin` | Standard | `.` | `query`, `first`, `run`, `batch`, `prepare`, `use(key)`, `deployManifest` |
| `queues` | `queuesPlugin` | Standard | `.` | `send`, `sendBatch`, `use(key)`, `consume`, `deployManifest` |
| `storage` | `storagePlugin` | Complex | `.` | `get`, `put`, `delete`, `list`, `use(key)`, `deployManifest` (R2 behind a provider seam) |
| `durableObjects` | `durableObjectsPlugin` | Standard | `.` | `get`, `use`/keyed config, `deployManifest`, `defineDurableObject` |
| `turn` | `turnPlugin` | Nano | `.` | `deployManifest` only — Cloudflare Realtime TURN keys as a declared deploy resource (since 0.16.0). **No runtime surface**, no state, no events, no `depends`: the worker reads the two bound secrets straight off `env` |
| `deploy` | `deployPlugin` | Complex | `.` | `run`, `destroy` (teardown), `dev`, `seed`, `init`, `checkInfra`, `provisionInfra`, `verifyAuth`, `wrangler` — **node-only** orchestrator |
| `cli` | `cliPlugin` | Standard | `.` | `dev`, `deploy` (+ `{ delete }` teardown), `seed`, `auth`, `doctor`, `whoami`, `wrangler` — **node-only** verbs + branded progress TUI |

`log` + `env` core plugins come from `@moku-labs/common` (re-exported `logPlugin`/`envPlugin`). Framework
defaults: core `log`/`env` + `bindings` + `server` (no `stage` plugin since 0.12.0). (deploy/cli ship from
the root entry; the `./cli` back-compat alias was removed in 0.11.0.)

## Configuration

**`WorkerConfig`** (`createApp({ config })`, flat, complete defaults): `stage: "production"|"development"|"test"`
(`"production"`), `name: string` (`"worker"`), `compatibilityDate: string` (`""`). `stage` is plain global
config (read via `ctx.global.stage`) — the `stage` plugin was removed in 0.12.0.

**Per-plugin (`pluginConfigs.<name>`):**

- `bindings.required: string[]` (`[]`).
- `server.endpoints: Endpoint[]` (`[]`).
- **Keyed-map resource plugins** (config = `Record<key, instance>`, default `{}` — declare at least one
  instance to use the plugin; a sole entry or `default: true` picks the default):
  - `kv.<key>`: `{ name, binding }` (`KvInstance`).
  - `d1.<key>`: `{ name, binding, migrations? }` (`D1Instance`).
  - `queues.<key>`: `{ name, binding, onMessage?, maxBatchTimeout?, default? }` (`QueueInstance`) —
    `maxBatchTimeout` (0–60s) → wrangler consumer `max_batch_timeout` (new in 0.8.0).
  - `storage.<key>`: `{ name, binding, upload? }` (`R2Instance`).
  - `durableObjects.<key>`: `{ binding, className }` (`DoInstance`) — DOs ship with the Worker, so there's
    no provisioned `name`; `className` is the exported class.
  - `turn.<key>`: `{ name, keyIdBinding?, apiTokenBinding?, verifyPath? }` (`TurnInstance`, since 0.16.0;
    usually exactly one entry, no `default` flag and no `use(key)`). `name` is the base Cloudflare TURN key
    name (stage-suffixed like every resource name). `keyIdBinding` (`"TURN_KEY_ID"`) and `apiTokenBinding`
    (`"TURN_KEY_API_TOKEN"`) name the two **worker secrets** the key's id + API token bind to — the app (or a
    composed plugin such as `@moku-labs/room/server`'s hub) reads them off `env`. `verifyPath: string | false`
    (`"/api/ice"`, since 0.19.0) is the same-origin credential-mint endpoint the deploy preflight calls on the
    already-deployed worker: a live mint proves the key works, a failed mint treats the resource as missing
    so the deploy recreates + rebinds; `false` disables the check. **Escape hatch (since 0.20.0):** put both
    values in the deploy env (`.env.local`) under the two binding names — the pair is validated by a live
    mint, adopted instead of create/list/delete, and bound after the deploy; teardown never deletes it. To
    keep a hand-provisioned key unmanaged, declare no `turn` instance at all and `wrangler secret put` both
    names.
- (No `stage` plugin config since 0.12.0 — stage is the global `WorkerConfig.stage` above.)
- `deploy` (node-only): `configFile` (`"wrangler.jsonc"`), `ci` (`false`), `watch: string[]`
  (`["src/**/*.{ts,tsx,css}", "public/**/*"]`), `buildCommand` (`""` → auto-detect `scripts/build.ts`),
  `migrateLocal` (`true`), `debounceMs` (`120`), plus optional `entry`, `nodeCompat`,
  `assets: { binding, directory, spa? }`, `wrangler: Record<string, unknown>` (escape hatch), `webBuild`,
  `seed: SeedConfig` (`{ file, binding?, resetKv? }`). `deploy.destroy({ stage? })` is the teardown verb
  (since 0.13.0) — destroys all infrastructure for a stage (D1/KV/R2/Queues/DO); INTERACTIVE-ONLY (off a
  TTY it refuses), double-confirmed (type the stage name); resolves to a `DeployReport` with `status:
  "destroyed"`.
- `cli` (node-only): **no keys** — `Config = Record<string, never>`; the dev port comes only from
  `dev({ port })` (defaults `8787`). `cli.deploy({ delete: true, stage? })` (the **`--delete`** flag)
  bypasses the deploy pipeline and routes to `deploy.destroy()` to tear a stage's infrastructure back down
  (since 0.13.0; 0.13.1 fixed the queue↔Worker deletion cycle).

## Events

**Global (`WorkerEvents`):**
- From `server`: `request:start` `{method,path,requestId}` · `request:end` `{method,path,status,ms}`.
- From `deploy` (and observed by `cli`): `deploy:phase` `{phase,detail?}` · `provision:resource` `{kind,name}`
  · `deploy:complete` `{url}` · `provision:plan` `{exists,missing,ships,account}` · `provision:skip`
  `{kind,name}` · `auth:verified` `{account,accountId,scopes}` · `dev:phase` `{phase,detail?}` · `dev:rebuilt`
  `{files,ms}` · `dev:error` `{message}`. (`kind` is `"kv"|"r2"|"d1"|"queue"|"do"|"turn"` — `"turn"` since
  0.16.0. The TURN secret bind emits `deploy:phase` `{phase:"turn",detail:"bind secrets"}`.)

**Plugin-local (reach via `depends`):** `server:matched` `{path,method}` (server; not on 404) ·
`queue:message` `{queue,messageId}` (queues). Events are fire-and-forget observability — all work flows
through API return values, never `emit`.

## Dependency graph

```
bindings (root) ── server · kv · d1 · queues · storage · durableObjects
turn   (no depends — build-time deploy metadata only)
deploy → [storage, kv, d1, queues, durableObjects]   (node-only; root entry)
cli    → [deploy]                                      (node-only; root entry)
```

`turn` is **not** in `deploy`'s `depends`: `deploy` reads it like the other manifests
(`ctx.has("turn") ? ctx.require(turnPlugin).deployManifest() : []`), so list `turnPlugin` yourself.

Each resource plugin exposes `deployManifest()` (an array, one per instance) that `deploy` reads via
`ctx.require`, gated by `ctx.has(name)`. Init order is a topological sort; `bindings` initializes first.
`deploy.run()` / `cli.deploy()` resolve to a **`DeployReport`** (`{ ok, status: "deployed"|"aborted"|
"failed"|"destroyed", stage, url?, resources?, migration, seed, turn, elapsedMs, errors }`) — `void` no longer.
(`"destroyed"` is the outcome of a `deploy.destroy()` / `cli.deploy({ delete })` teardown — since 0.13.0.)
`turn: "skipped"|"exists"|"provisioned"|"degraded"` (required field since 0.16.0): `"skipped"` = no `turn`
resource declared (also every aborted and teardown report), `"exists"` = nothing to create,
`"provisioned"` = key created in the provision phase and its credentials bound right after `wrangler deploy`,
`"degraded"` = create or bind failed — a warning with one instruction line is rendered, the deploy **stays
live**, and the app falls back to STUN. Creating a key needs the **`Account · Calls` `Edit`** permission on
`CLOUDFLARE_API_TOKEN` (`auth setup` lists it when a `turn` resource is declared); teardown (`--delete`)
deletes a TURN key only when it matches the configured stage-qualified name.

## Three-layer model (worker IS a Layer-2 framework)

`src/config.ts` → `createCoreConfig("worker", …)` (`WorkerConfig`, `WorkerEvents`, core `log`/`env` plugins,
and the default `workerSafeProcessEnv` env provider). `src/index.ts` → `createCore` (exposes
`createApp`/`createPlugin`; wires `bindings`+`server`). Deployment stage is plain global `config.stage` (read
via `ctx.global.stage`) — no stage plugin to bridge. Consumer → `createApp({…})`. A **consumer app** that
uses worker stays Layer-3: `createApp`
only, never `createCoreConfig`/`createCore` or a direct `@moku-labs/core` dep (see `moku-idioms.md` I1;
the `demos/tracker` server is the worked reference).
