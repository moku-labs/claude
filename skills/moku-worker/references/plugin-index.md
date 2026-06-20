# @moku-labs/worker — Plugin & Property Index

**Synced version:** `0.4.0` (npm `dist-tags.latest`; catalog generated from the published tarball README —
upstream `main` was still at 0.1.0, so the npm tarball is the authority for the released surface).
Built on `@moku-labs/core@0.1.4`; uses `@moku-labs/common@0.2.0` (supplies the `log` + `env` core
plugins). Engines: node ≥24, bun ≥1.3.14.

A Cloudflare Worker modelled as composable Moku plugins: each primitive (KV, D1, R2, Queues, Durable
Objects) is a plugin that resolves its binding **per request** off the Cloudflare `env`; a `server` plugin
owns HTTP routing. **Env is threaded as a call argument, never stored** (one isolate serves concurrent
requests). Deploy/CLI tooling is built from the same model but kept out of the runtime bundle.

## Entry points

| Import | Surface | Bundle |
|--------|---------|--------|
| `@moku-labs/worker` (`.`) | Runtime: `createApp`, `createPlugin`, all resource plugin instances, `endpoint`, `defineDurableObject`, `logPlugin`/`envPlugin` (re-exported), types (`WorkerConfig`, `WorkerEvents`, `WorkerEnv` + `Server`/`D1`/`Queues`/`Storage`/`DurableObjects` namespaces). | Ships in the Worker bundle. |
| `@moku-labs/worker/cli` (`./cli`) | Node-only: `deployPlugin`, `cliPlugin`, `ExternalManifest`, `ResourceManifest`. Imports `node:child_process`/`node:fs`. | **NEVER** in the Worker bundle. |

> There is no `@moku-labs/worker/worker` subpath (the spec references one — it does not exist). The real
> entries are `.` and `./cli`.

## API form

- **`createApp(options?)`** — the Layer-3 consumer entry. **Synchronous**, built once per isolate at module
  load, frozen. Defaults `[logPlugin, envPlugin, stagePlugin, bindingsPlugin, serverPlugin]` apply first;
  `options` shallow-merge on top. Options: `config?: Partial<WorkerConfig>`, `pluginConfigs?` (keyed by
  plugin name), `plugins?: PluginInstance[]` (appended; do NOT re-list a default — duplicate names throw),
  `onReady?`, `onError?`, `onStart?`/`onStop?`. The final list is `[...frameworkDefaults, ...yourPlugins]`.
- **`createPlugin("<name>", { … })`** — author a consumer plugin (no explicit generics — inferred). Imported
  from `@moku-labs/worker` (never `@moku-labs/core`).
- **`endpoint(path)`** — server route builder (`endpoint("/users/{id}").get(handler)`).
- **`defineDurableObject(name)`** — Durable Object base-class factory.
- **Plugin APIs** mount on `app.<name>` (`app.server.handle`, `app.kv.get`, `app.d1.query`). Core plugins
  are flat-injected on every `ctx` (`ctx.log`, `ctx.env`, `ctx.stage`) and also on `app.*`.
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
    kv: { binding: "MY_KV" },
    server: { endpoints: [endpoint("/health").get(() => new Response("ok"))] }
  }
});
// worker.ts (hand-assembled): export default { fetch: (r, env, ctx) => app.server.handle(r, env, ctx) }
```

## Plugins (10)

Name strings are bare (`"server"`, `"kv"`); exported instances carry the `Plugin` suffix (`serverPlugin`).

| Plugin | Instance | Tier | Entry | Key APIs |
|--------|----------|------|-------|----------|
| `bindings` | `bindingsPlugin` | Micro | `.` | `require(env, name)`, `has(env, name)` — binding-family dependency root |
| `server` | `serverPlugin` | Standard | `.` | `handle`, `scheduled`, `endpoint` — HTTP routing + dispatch (Worker-entry surface) |
| `kv` | `kvPlugin` | Micro | `.` | `get`, `put`, `delete`, `list`, `deployManifest` |
| `d1` | `d1Plugin` | Standard | `.` | `query`, `first`, `run`, `batch`, `prepare`, `deployManifest` |
| `queues` | `queuesPlugin` | Standard | `.` | `send`, `sendBatch`, `consume`, `deployManifest` |
| `storage` | `storagePlugin` | Complex | `.` | `get`, `put`, `delete`, `list`, `deployManifest` (R2 behind a provider seam) |
| `durableObjects` | `durableObjectsPlugin` | Standard | `.` | `get`, `deployManifest`, `defineDurableObject` |
| `stage` | `stagePlugin` | Nano (core) | `.` | `isDev`, `isProduction`, `current` — flat-injected `ctx.stage` |
| `deploy` | `deployPlugin` | Complex | `./cli` | `run`, `dev`, `init` — **node-only** deploy orchestrator |
| `cli` | `cliPlugin` | Standard | `./cli` | `dev`, `deploy` — **node-only** verbs + progress TUI |

`log` + `env` core plugins come from `@moku-labs/common` (re-exported `logPlugin`/`envPlugin`). Defaults
wired by the framework: core `log`/`env`/`stage` + `bindings` + `server`.

## Configuration

**`WorkerConfig`** (`createApp({ config })`, flat, complete defaults): `stage: "production"|"development"|"test"`
(`"production"`), `name: string` (`"moku-worker"`), `compatibilityDate: string` (`""`).

**Per-plugin (`pluginConfigs.<name>`):** `bindings.required: string[]` (`[]`) · `server.endpoints: Endpoint[]`
(`[]`) · `kv.binding` (`"KV"`) · `d1.binding` (`"DB"`) + `d1.migrations` (`""`) · `queues.producers: string[]`
(`[]`) + `queues.onMessage` (no-op) · `storage.bucket` (`"ASSETS"`) + `storage.upload` (`""`) ·
`durableObjects.bindings: Record<string,string>` (`{}`) · `stage.stage` (fed from `WorkerConfig.stage`) ·
`deploy.configFile` (`"wrangler.jsonc"`) + `deploy.ci` (`false`) · `cli.port` (`8787`).

## Events

**Global (`WorkerEvents`):** `request:start` `{method,path,requestId}` · `request:end` `{method,path,status,ms}`
(both from `server`) · `deploy:phase` `{phase,detail?}` · `provision:resource` `{kind,name}` ·
`deploy:complete` `{url}` (from `deploy`).
**Plugin-local (reach via `depends`):** `server:matched` `{path,method}` (server; not on 404) ·
`queue:message` `{queue,messageId}` (queues). Events are fire-and-forget observability — all work flows
through API return values, never `emit`.

## Dependency graph

```
bindings (root) ── server · kv · d1 · queues · storage · durableObjects
deploy → [storage, kv, d1, queues, durableObjects]   (node-only)
cli    → [deploy]                                      (node-only)
```

Each resource plugin exposes `deployManifest()` that `deploy` reads via `ctx.require`. Init order is a
topological sort; `bindings` initializes first.

## Three-layer model (worker IS a Layer-2 framework)

`src/config.ts` → `createCoreConfig` (`WorkerConfig`, `WorkerEvents`, core plugins). `src/index.ts` →
`createCore` (exposes `createApp`/`createPlugin`; wires `bindings`+`server`). Consumer → `createApp({…})`.
A **consumer app** that uses worker stays Layer-3: `createApp` only, never `createCoreConfig`/`createCore`
or a direct `@moku-labs/core` dep (see `moku-idioms.md` I1; the `demos/tracker` server is the worked
reference).
