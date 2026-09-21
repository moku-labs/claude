---
name: moku-common
description: >
  Moku Common patterns: the shared infrastructure package (@moku-labs/common) every Moku framework
  bundles — the core plugins `logPlugin` (`ctx.log`: leveled events, in-memory trace, `expect()` chain,
  sinks) and `envPlugin` (`ctx.env`: schema-validated, frozen environment from ordered providers), one
  env provider per runtime (`dotenv`, `processEnv`, `cloudflareBindings`, `workerSafeProcessEnv`,
  `browserEnv`), and the branded CLI kit on `@moku-labs/common/cli`. Triggers on: "moku common",
  "@moku-labs/common", "logPlugin", "envPlugin", "ctx.log", "ctx.env", "createBrandConsole",
  "createBrandPrompts", "brandedSink", "workerSafeProcessEnv", "cloudflareBindings", "browserEnv",
  "env provider moku", "branded cli moku", "log.expect() toHaveEvent", "register log and env in createCoreConfig".
---

# Moku Common Patterns

> **Synced to `@moku-labs/common@0.3.2`** (npm `dist-tags.latest`; catalog from the `v0.3.2` tag source +
> the root and per-plugin READMEs; upstream ships no `llms.txt`). Full surface — 2 core plugins, 5 env
> providers, 3 entry points, every config field, API signature and CLI kit export, the data-flow diagram —
> is in [`references/plugin-index.md`](references/plugin-index.md). Registered in the framework registry
> (`frameworks[common]`, role `shared-infra`): load the `moku:moku-core` skill with the Skill tool and read
> `references/moku-frameworks.md` under the base directory it prints.

## Current Project State
!`test -f package.json && grep -E '"@moku-labs/common"' package.json 2>/dev/null || true`

## What it is

`@moku-labs/common` is the **shared infrastructure of the Moku family**, not a framework. It calls neither
`createCoreConfig` nor `createCore` and ships no `createApp`. It exports:

- **Two core plugins** built with `createCorePlugin`: `logPlugin` (`ctx.log`) and `envPlugin` (`ctx.env`).
  Once a framework registers them, their APIs sit flat on every plugin's `ctx` and on the app (`app.log`, `app.env`).
- **Five env providers**, one per runtime: `dotenv`, `processEnv`, `cloudflareBindings` (Node, import
  `node:fs`), `workerSafeProcessEnv` (Cloudflare Workers, `node:*`-free), `browserEnv` (browser, `node:*`-free).
- **A branded CLI kit** on `@moku-labs/common/cli`: palette, box, spinner, `createBrandConsole`,
  `createBrandPrompts`, and `brandedSink`, a `LogSink` that renders `ctx.log` entries in the family look.

**Who registers it.** A **Layer-2 framework** composes `logPlugin` + `envPlugin` in its `createCoreConfig`
and seeds the env providers for its runtime. A **Layer-3 app** inherits `ctx.log` / `ctx.env` and registers
nothing. Every family framework (`web`, `worker`, `room`, `native`, `system`) bundles this package as an
exact pin, so a consumer app usually has **no direct dependency** on `@moku-labs/common`. The family rules
for consuming it (MC1–MC3) live in the `moku:moku-common-conventions` skill; load it with the Skill tool.

## Stack

| Layer | Technology |
|-------|-----------|
| Package | `@moku-labs/common@0.3.2` — `sideEffects: false`, types included, MIT |
| `.` entry | dual ESM + CJS, **Node**: `logPlugin`, `envPlugin`, all five providers, the `Log` / `Env` type namespaces and flat plugin types |
| `./cli` entry | dual ESM + CJS, **Node only** (reads `process.*`, uses `node:readline`): the branded CLI kit |
| `./browser` entry | ESM only, **browser-safe**: the same `logPlugin` + `envPlugin`, `browserEnv`, the types; zero `node:*` in its static import graph (CI gate `bun run check:bundle`) |
| Kernel | `@moku-labs/core@1.6.0` — a regular **dependency**, pinned exactly (not a peer) |
| Engines | node ≥24, bun ≥1.3.14; Bun is the package manager |

## Idiomatic shape

- **Framework `src/config.ts` registers both plugins** in `createCoreConfig` and lists them in the third
  type argument, `[typeof logPlugin, typeof envPlugin]`, mandatory once `Config` / `Events` are explicit.
- **The framework seeds the env providers** through `pluginConfigs.env.providers` in `createCoreConfig`.
  The spec default is `[]`, so without seeding `ctx.env` resolves an empty environment. The config cascade
  is a **shallow merge**: an app that passes `pluginConfigs.env.providers` **replaces** the list.
- **Pick the provider for the runtime.** Node: `[dotenv(".env.local"), processEnv()]` (first non-empty
  value wins, so the file beats the process). Cloudflare Worker: `workerSafeProcessEnv()` (never throws when
  `process` is absent), plus `cloudflareBindings()` when the handler sets `globalThis.__CLOUDFLARE_ENV__`
  before the app is created. Browser: `browserEnv()` from `@moku-labs/common/browser`.
- **Import per entry.** Server and CLI code import from `.` and `./cli`; a client bundle imports from
  `./browser` only. `processEnv()` dereferences `process` unconditionally: never put it in a Worker bundle.
- **Log events, not sentences.** `ctx.log.info("deploy:done", { url })`; the `domain:action` name is what
  `expect().toHaveEvent(...)` matches. Tests set `pluginConfigs.log.mode: "test"`. A Node CLI plugin brands
  the output in `onInit`: `ctx.log.clearSinks(); ctx.log.addSink(brandedSink("info"))`.

⚠️ What not to do:

- Do not register `logPlugin` / `envPlugin` in a Layer-3 app. The framework already did.
- Do not import `@moku-labs/common/cli` or the Node providers into a browser bundle.
- Do not expect `ctx.env` to see a value set after `createApp`. Both maps are resolved and **frozen at
  `onInit`**; `set` / `clear` / `delete` throw `TypeError`.
- Do not mark `public: true` without the `PUBLIC_` prefix, or vice versa. Either direction throws at `createApp`.
- Do not use `console.*` or `process.env` in plugin source. The rules and their exceptions (`// @log-sink`,
  env providers, tests) are in `moku:moku-common-conventions`.

## Package API (@moku-labs/common v0.3.2)

```ts
// src/config.ts of a Layer-2 framework (Node runtime)
import { createCoreConfig } from "@moku-labs/core";
import { dotenv, envPlugin, logPlugin, processEnv } from "@moku-labs/common";

type Config = { stage: "development" | "production" };
type Events = { "app:ready": { at: number } };

export const coreConfig = createCoreConfig<Config, Events, [typeof logPlugin, typeof envPlugin]>(
  "my-framework",
  {
    config: { stage: "development" },
    plugins: [logPlugin, envPlugin], // ctx.log + ctx.env on every plugin, app.log + app.env on the app
    pluginConfigs: {
      log: { mode: "production" }, // console prints info+; the trace records every level
      env: {
        schema: {
          PUBLIC_API_URL: { public: true, default: "/api" },
          DEPLOY_TOKEN: { public: false, required: true, secret: true }, // missing → throws at createApp
        },
        providers: [dotenv(".env.local"), processEnv()], // file wins over process
      },
    },
  },
);
export const { createPlugin, createCore } = coreConfig;
```

- **`logPlugin`** (name `log`) → `ctx.log` / `app.log`. Config `{ mode }`, default `"production"`; `"dev"`
  prints `debug`+, `"production"` prints `info`+, `"test"` / `"silent"` print nothing. The trace is on in
  every mode. API: `info | debug | warn (event, data?)`, `error(event, data?, error?)` (merges `message` /
  `stack` under `data.error`), `trace()` (frozen copy), `expect()` (live chain: `toHaveEvent(event, partial?)`,
  `toHaveEventInOrder(events)`, `toNotHaveEvent(event, partial?)`; failures throw an `Error` named
  `LogExpectAssertionError`, class not exported), `addSink(sink)`, `reset()`, `clearSinks()`. `LogSink = { write(entry) }`.
- **`envPlugin`** (name `env`) → `ctx.env` / `app.env`. Config `{ schema: {}, providers: [],
  publicPrefix: "PUBLIC_" }`. `onInit` merges providers in order (empty string = absent), cross-checks the
  prefix both ways, applies `default`, asserts `required`, then freezes. API: `get(key)` →
  `string | undefined`, `require(key)` → `string` or throws `[web] env: required variable "<key>" is not
  defined.`, `has(key)`, `getPublic()` (frozen object), `getPublicMap()` (frozen `ReadonlyMap`, the only
  sanctioned input to a build-time `define`). `resolved` holds every provider key, `publicMap` only
  `public: true` schema keys. `EnvVarSpec = { public: boolean; required?; default?; secret? }`.
- **Providers** (`EnvProvider = { name; load(): Record<string, string | undefined> }`):
  `dotenv(path = ".env.local")`, `processEnv()`, `cloudflareBindings()` (reads `globalThis.__CLOUDFLARE_ENV__`),
  `workerSafeProcessEnv()` (`typeof process` guard), `browserEnv({ globalKey = "__ENV__" })` (merges
  `import.meta.env` with `globalThis[globalKey]`, the global wins). Custom providers are plain objects.
- **`./cli` kit.** Primitives: `ANSI`, `BRAND_PINK` (`#FF1E6F`), `fg24`, `makePalette(color, truecolor?)`,
  `box(lines, color, minInnerWidth?)` → `string[]`, `boxGlyphs`, `SPINNER_FRAMES`, `spinnerFrameAt(elapsedMs,
  frameMs = 80)`, `cursorUp`, `CLEAR_LINE`, `CLEAR_BELOW`, `visibleWidth`, `supportsColor`,
  `supportsTruecolor`. Console: `createBrandConsole(options?)` → `lockup`, `heading`, `info`, `warn`, `error`,
  `check`, `line`, `railLine`, `box`, plus `palette`, `color`, `width`. Prompts: `createBrandPrompts(options?)`
  → `confirm(question)` → `Promise<boolean>`, `select(question, choices)` → `Promise<number>`. Sink:
  `brandedSink(minLevel = "debug")` → `LogSink`.
- **`./browser` entry.** `logPlugin`, `envPlugin`, `browserEnv` and the types only. No Node provider, no CLI kit.

Full catalog (entry points, both plugins with config, API, state, sinks and lifecycle, every provider, the CLI
kit member by member, exported types, data-flow diagram, README-vs-source notes):
**[`references/plugin-index.md`](references/plugin-index.md)**.
