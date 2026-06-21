# @moku-labs/worker — Plugin & Property Index

**Synced version:** `0.9.2` (npm `dist-tags.latest`; surface read from the published 0.9.2 tarball +
the `v0.9.2` git tag's source — upstream `main` HEAD and the `llms-full.txt` catalog body were still
describing 0.1.0, so the released tarball/tag is the authority. Several prose facts in the catalog were
stale; this index was regenerated from `src/**` at the tag).
Built on `@moku-labs/core@1.5.0`; uses `@moku-labs/common@0.2.1` (supplies the `log` + `env` core
plugins). `wrangler` is an **optional `peerDependency`** (`>=3`). Engines: node ≥24, bun ≥1.3.14.

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
| `@moku-labs/worker` (`.`) | Runtime: `createApp`, `createPlugin`, all resource plugin instances, `endpoint`, `defineDurableObject`, `logPlugin`/`envPlugin` (re-exported), **and `deployPlugin`/`cliPlugin`** (node-only graph tree-shaken out unless you list them), types (`WorkerConfig`, `WorkerEvents`, `WorkerEnv`, `WorkerPluginCtx`, `PluginCtx`, `DeployReport`, `SeedConfig`, `ExternalManifest`, `ResourceManifest`, `StageApi` + `Server`/`D1`/`Queues`/`Storage`/`DurableObjects` namespaces). | Runtime plugins ship; deploy/cli pulled in only if listed (`"sideEffects": false`). |
| `@moku-labs/worker/cli` (`./cli`) | **Back-compat alias** — re-exports `deployPlugin`, `cliPlugin`, `ExternalManifest`, `ResourceManifest`. Kept so existing `import … from "@moku-labs/worker/cli"` call sites keep working; prefer the root import in new code. | Node-only graph; **NEVER** in the Worker bundle. |

> There is no `@moku-labs/worker/worker` subpath (the spec references one — it does not exist). The real
> entries are `.` and `./cli`. As of 0.6.0 the node-only `deployPlugin`/`cliPlugin` ship from the **root**
> too (`./cli` is now just an alias); they only enter a bundle when a consumer actually lists them in
> `createApp({ plugins })`.

## API form

- **`createApp(options?)`** — the Layer-3 consumer entry. **Synchronous**, built once per isolate at module
  load, frozen. Defaults `[logPlugin, envPlugin, stagePlugin, bindingsPlugin, serverPlugin]` apply first;
  `options` shallow-merge on top. Options: `config?: Partial<WorkerConfig>`, `pluginConfigs?` (keyed by
  plugin name), `plugins?: PluginInstance[]` (appended; do NOT re-list a default — duplicate names throw),
  `onReady?: (app) => void` (runs after every `onInit`), `onError?: (error) => void`,
  `onStart?`/`onStop?: () => void | Promise<void>`. The final list is `[...frameworkDefaults, ...yourPlugins]`.
  `createApp` also bridges two pieces of core-plugin config the consumer can't set directly: it mirrors
  `config.stage` into the `stage` plugin, and wires a default workerd-safe `process.env` provider into the
  `env` plugin so `ctx.env.get("CLOUDFLARE_API_TOKEN")` resolves under Bun/Node.
- **`createPlugin("<name>", { … })`** — author a consumer plugin (no explicit generics — inferred). Imported
  from `@moku-labs/worker` (never `@moku-labs/core`). Type your context with `WorkerPluginCtx<Config, State,
  Events?>` (worker-bound alias that pre-merges `WorkerEvents`) or the raw re-exported `PluginCtx`.
- **`endpoint(path)`** — server route builder (`endpoint("/users/{id}").get(handler)`).
- **`defineDurableObject(name)`** — Durable Object base-class factory.
- **Plugin APIs** mount on `app.<name>` (`app.server.handle`, `app.kv.get`, `app.d1.query`). Resource plugins
  expose the **default instance's** methods flat plus `app.<name>.use("key")` for additional instances. Core
  plugins are flat-injected on every `ctx` (`ctx.log`, `ctx.env`, `ctx.stage`) and also on `app.*`.
- The Cloudflare default export (`{ fetch, scheduled, queue }`) is **hand-assembled** (no plugin produces
  it) — thread the per-invocation `env` into `app.server.handle` / `app.server.scheduled` /
  `app.queues.consume`.

```typescript
import { createApp, endpoint, kvPlugin } from "@moku-labs/worker";

export const app = createApp({
  config: { name: "my-api", stage: "production", compatibilityDate: "2026-06-17" },
  plugins: [kvPlugin],                       // bindings + server are defaults — don't re-list
  pluginConfigs: {
    bindings: { required: ["MY_KV"] },
    // keyed-map: one named instance; `cache` is the implicit default (sole entry).
    kv: { cache: { name: "my-cache", binding: "MY_KV" } },
    server: { endpoints: [endpoint("/health").get(() => new Response("ok"))] }
  }
});
// app.kv.get(env, key)            → default instance
// app.kv.use("cache").get(env, k) → explicit selector (same instance here)
// worker.ts (hand-assembled): export default { fetch: (r, env, ctx) => app.server.handle(r, env, ctx) }
```

## Plugins (10)

Name strings are bare (`"server"`, `"kv"`); exported instances carry the `Plugin` suffix (`serverPlugin`).

| Plugin | Instance | Tier | Entry | Key APIs |
|--------|----------|------|-------|----------|
| `bindings` | `bindingsPlugin` | Micro | `.` | `require(env, name)`, `has(env, name)` — binding-family dependency root |
| `server` | `serverPlugin` | Standard | `.` | `handle`, `scheduled`, `endpoint` — HTTP routing + dispatch (Worker-entry surface) |
| `kv` | `kvPlugin` | Micro | `.` | `get`, `put`, `delete`, `list`, `use(key)`, `deployManifest` |
| `d1` | `d1Plugin` | Standard | `.` | `query`, `first`, `run`, `batch`, `prepare`, `use(key)`, `deployManifest` |
| `queues` | `queuesPlugin` | Standard | `.` | `send`, `sendBatch`, `use(key)`, `consume`, `deployManifest` |
| `storage` | `storagePlugin` | Complex | `.` | `get`, `put`, `delete`, `list`, `use(key)`, `deployManifest` (R2 behind a provider seam) |
| `durableObjects` | `durableObjectsPlugin` | Standard | `.` | `get`, `use`/keyed config, `deployManifest`, `defineDurableObject` |
| `stage` | `stagePlugin` | Nano (core) | `.` | `isDev`, `isProduction`, `current` — flat-injected `ctx.stage` |
| `deploy` | `deployPlugin` | Complex | `.` (alias `./cli`) | `run`, `dev`, `seed`, `init`, `checkInfra`, `provisionInfra`, `verifyAuth`, `wrangler` — **node-only** orchestrator |
| `cli` | `cliPlugin` | Standard | `.` (alias `./cli`) | `dev`, `deploy`, `seed`, `auth`, `doctor`, `whoami`, `wrangler` — **node-only** verbs + branded progress TUI |

`log` + `env` core plugins come from `@moku-labs/common` (re-exported `logPlugin`/`envPlugin`). Framework
defaults: core `log`/`env`/`stage` + `bindings` + `server`. (deploy/cli moved to the root entry in 0.6.0;
`./cli` is now a back-compat alias.)

## Configuration

**`WorkerConfig`** (`createApp({ config })`, flat, complete defaults): `stage: "production"|"development"|"test"`
(`"production"`), `name: string` (`"moku-worker"`), `compatibilityDate: string` (`""`).

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
- `stage.stage: "production"|"development"|"test"` (`"production"`, fed from `WorkerConfig.stage`).
- `deploy` (node-only): `configFile` (`"wrangler.jsonc"`), `ci` (`false`), `watch: string[]`
  (`["src/**/*.{ts,tsx,css}", "public/**/*"]`), `buildCommand` (`""` → auto-detect `scripts/build.ts`),
  `migrateLocal` (`true`), `debounceMs` (`120`), plus optional `entry`, `nodeCompat`,
  `assets: { binding, directory, spa? }`, `wrangler: Record<string, unknown>` (escape hatch), `webBuild`,
  `seed: SeedConfig` (`{ file, binding?, resetKv? }`).
- `cli` (node-only): **no keys** — `Config = Record<string, never>`; the dev port comes only from
  `dev({ port })` (defaults `8787`).

## Events

**Global (`WorkerEvents`):**
- From `server`: `request:start` `{method,path,requestId}` · `request:end` `{method,path,status,ms}`.
- From `deploy` (and observed by `cli`): `deploy:phase` `{phase,detail?}` · `provision:resource` `{kind,name}`
  · `deploy:complete` `{url}` · `provision:plan` `{exists,missing,ships,account}` · `provision:skip`
  `{kind,name}` · `auth:verified` `{account,accountId,scopes}` · `dev:phase` `{phase,detail?}` · `dev:rebuilt`
  `{files,ms}` · `dev:error` `{message}`. (`kind` is `"kv"|"r2"|"d1"|"queue"|"do"`.)

**Plugin-local (reach via `depends`):** `server:matched` `{path,method}` (server; not on 404) ·
`queue:message` `{queue,messageId}` (queues). Events are fire-and-forget observability — all work flows
through API return values, never `emit`.

## Dependency graph

```
bindings (root) ── server · kv · d1 · queues · storage · durableObjects
deploy → [storage, kv, d1, queues, durableObjects]   (node-only; root entry, alias ./cli)
cli    → [deploy]                                      (node-only; root entry, alias ./cli)
```

Each resource plugin exposes `deployManifest()` (an array, one per instance) that `deploy` reads via
`ctx.require`, gated by `ctx.has(name)`. Init order is a topological sort; `bindings` initializes first.
`deploy.run()` / `cli.deploy()` resolve to a **`DeployReport`** (`{ ok, status: "deployed"|"aborted"|
"failed", stage, url?, resources?, migration, seed, elapsedMs, errors }`) — `void` no longer.

## Three-layer model (worker IS a Layer-2 framework)

`src/config.ts` → `createCoreConfig` (`WorkerConfig`, `WorkerEvents`, core plugins). `src/index.ts` →
`createCore` (exposes `createApp`/`createPlugin`; wires `bindings`+`server`, bridges `stage` + the env
provider). Consumer → `createApp({…})`. A **consumer app** that uses worker stays Layer-3: `createApp`
only, never `createCoreConfig`/`createCore` or a direct `@moku-labs/core` dep (see `moku-idioms.md` I1;
the `demos/tracker` server is the worked reference).
