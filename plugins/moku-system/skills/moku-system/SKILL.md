---
name: moku-system
description: >
  Moku System patterns: the isomorphic system API (@moku-labs/system) — a standalone @moku-labs/core
  framework that gives one app the same store, notify, clipboard, tray and deep-link API in a browser and
  in a Tauri 2 shell. A Tauri provider is picked when the shell is detected, a web provider otherwise, and
  every method returns a typed SystemResult instead of throwing. Triggers on: "moku system",
  "@moku-labs/system", "moku store / notify / clipboard / tray / deep-link", "storePlugin", "notifyPlugin",
  "deepLinkPlugin", "SystemResult", "ctx.runtime", "tauri provider moku", "isomorphic system API",
  "persistent storage or notifications in a Moku app that runs on web and in Tauri".
---

# Moku System Patterns

> **Synced to `@moku-labs/system@0.2.1`** (npm `dist-tags.latest`; catalog from the `v0.2.1` tag source +
> the root and per-plugin READMEs). Full surface — the 6 plugins (1 core + 5 opt-in capabilities), the six
> entry points, config, the provider seam, `SystemResult`, events, native permissions and the dependency
> graph — is in [`references/plugin-index.md`](references/plugin-index.md). Registered in the framework
> registry (`frameworks[system]`): load the `moku:moku-core` skill with the Skill tool and read
> `references/moku-frameworks.md` under the base directory it prints.

## Current Project State
!`test -f package.json && grep -E '"@moku-labs/system"' package.json 2>/dev/null || true`

## What it is

`@moku-labs/system` is a **standalone Moku framework on `@moku-labs/core`**. It is the seam between app
code and the shell the app runs in. It ships five opt-in capability plugins — `store`, `notify`,
`clipboard`, `tray`, `deepLink` — and one core plugin, `runtime`.

- **Provider choice.** `runtime` detects the shell once, synchronously, when the app is created:
  `kind: "tauri"` when `globalThis.isTauri === true` or `__TAURI_INTERNALS__` is on `globalThis`, else
  `"web"`. `platform` comes from the user agent (`"unknown"` under SSR). The result is `ctx.runtime`.
- **In a browser:** `store` uses IndexedDB (`idb-keyval`), `notify` the Web Notification API, `clipboard`
  `navigator.clipboard`, `deepLink` reads a `?deeplink=` / `#deeplink=` page parameter, `tray` answers
  `unsupported`.
- **In a Tauri shell:** each capability dynamically imports its `@tauri-apps/*` package. `tray` works only
  on `macos` / `windows` / `linux`.
- **Resolution** starts at `app.start()`, fire-and-forget. A failed load never throws at startup. It
  becomes the next call's `SystemResult` with `reason: "unavailable"`.

It is not a UI framework and not a Tauri wrapper. Packaging the shell is the job of `@moku-labs/native`.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | `@moku-labs/system` — its own `@moku-labs/core` framework; root entry `.` + five capability subpaths (`./store`, `./tray`, `./notify`, `./clipboard`, `./deep-link`) |
| Built on | `@moku-labs/core@1.6.0` + `@moku-labs/common@0.3.2` (**bundled**, exact pins — supply the kernel + `ctx.log` / `ctx.env`) + `idb-keyval@6.3.0` (web store provider) |
| Optional peers | `@tauri-apps/plugin-store@^2.4.0` (store), `@tauri-apps/plugin-notification@^2.3.0` (notify), `@tauri-apps/plugin-clipboard-manager@^2.3.0` (clipboard), `@tauri-apps/plugin-deep-link@^2.4.0` (deepLink), `@tauri-apps/api@^2.11.0` (tray). Needed **only** for the native shell build, one per composed capability |
| Package manager | Bun (pinned deps — `bunfig.toml` `exact = true`) |
| Engines | node ≥24, bun ≥1.3.14 |

## Idiomatic shape — a Layer-3 app that composes System

A system app is a **Layer-3 app**: `createApp` and `createPlugin` come from `@moku-labs/system`, never
`createCoreConfig` / `createCore`, and no direct `@moku-labs/core` dependency (I1). For app shape, follow
the `moku-idioms.md` rubric — load the `moku:moku-core` skill with the Skill tool and read
`references/moku-idioms.md` under the base directory it prints.

- **One system app per runtime.** System plugins are bound to this framework's core, so they compose only
  into `createApp` from `@moku-labs/system`. An app with a web UI keeps its `@moku-labs/web` `createApp`
  and adds one system `createApp` beside it (`moku-idioms.md §I2`). Islands call `system.store.get(...)`.
- **Import each capability from its subpath.** The root exports `createApp`, `createPlugin`, `ok`, `err`
  and types only. There are **no default plugins** besides the core trio `log`, `env`, `runtime`.
- **Branch on the result, never on the runtime.** App code narrows `result.ok` and `result.reason`. Only
  a plugin reads `ctx.runtime`.
- **Native permissions.** `@moku-labs/native` generates the Tauri capability file, Cargo dependencies and
  plugin registrations from its `config.system` list. That list uses Tauri plugin names: `store`,
  `notification`, `clipboard-manager`, `tray`, `deep-link`. Keep it in step with the composed plugins.
- **Web bundling.** The bundler must resolve `@tauri-apps/*` even for a web build. Install the peers or
  mark them external (`external: ["@tauri-apps/*"]` in Bun, `/^@tauri-apps\//` in Rollup).

⚠️ What not to do:

- Do not import `storePlugin` (or any instance) from `"@moku-labs/system"`. It is not exported there.
- Do not import `@tauri-apps/*` or touch `window.__TAURI_INTERNALS__` in app code. Do not write
  `localStorage` / `new Notification()` fallbacks by hand — that is the web provider's job (I5).
- Do not wrap capability calls in `try/catch` for environment failures. They are data. Only programmer
  errors throw (bad `store.name`, empty `tray.id`, invalid `deepLink.schemes` → `TypeError` at `createApp`).
- Do not call a capability before `await system.start()`. It answers `unavailable`,
  `"app not started — call app.start() first"`.
- Do not expect `notify.show()` to prompt. Call `requestPermission()` yourself, from a user gesture.
- Do not expect stored data to move between providers. The Tauri store file and IndexedDB are separate.

## Framework API (@moku-labs/system v0.2.1)

```ts
import { createApp } from "@moku-labs/system";
import { notifyPlugin } from "@moku-labs/system/notify";
import { storePlugin } from "@moku-labs/system/store";

export const system = createApp({
  plugins: [storePlugin, notifyPlugin], // opt-in; notify takes no config
  pluginConfigs: { store: { name: "my-app" } },
});
await system.start(); // provider resolution starts here

const count = await system.store.get<number>("count"); // SystemResult<number | undefined>
const next = (count.ok ? (count.value ?? 0) : 0) + 1;
const saved = await system.store.set("count", next); // durable when saved.ok

const granted = await system.notify.isPermissionGranted();
if (granted.ok && !granted.value) await system.notify.requestPermission(); // the only prompt
const shown = await system.notify.show({ title: "Saved", body: `Count is ${next}` });
if (!shown.ok && shown.reason === "unsupported") {
  // hide the feature: this environment never supports it
}
```

- **`SystemResult<T>`** = `{ ok: true; value; provider }` | `{ ok: false; provider; reason; message? }`.
  `reason`: `"unsupported"` (never here — hide it), `"denied"` (an unambiguous permission refusal),
  `"unavailable"` (not now: not started, stopped, provider failed to load, storage probe failed),
  `"error"` (the provider threw; message kept, already logged through `ctx.log`). A thrown Tauri error is
  never mapped to `"denied"`.
- **`storePlugin`** → `app.store`: `get<T>`, `set`, `delete`, `keys`, `clear`. Values are `JsonValue`.
  Config `{ name }`, default `"moku-system"`. Tauri: `${name}.json` with awaited `save()`. Web: IndexedDB.
- **`notifyPlugin`** → `app.notify`: `isPermissionGranted`, `requestPermission`, `show({ title, body? })`.
  No config. `show()` without permission → `"denied"`. No `Notification` global on web → `"unsupported"`.
- **`clipboardPlugin`** → `app.clipboard`: `readText`, `writeText`. No config. Web `NotAllowedError` →
  `"denied"`; missing `navigator.clipboard` → `"unsupported"`.
- **`trayPlugin`** → `app.tray`: `setMenu`, `setTooltip`, `setIcon`, `destroy`. Config `{ id, icon? }`.
  Web and Tauri mobile → `"unsupported"` on every method. The icon is created on the first mutating call.
- **`deepLinkPlugin`** → `app.deepLink` (plugin name `deepLink`, subpath `/deep-link`): `getCurrent()`,
  `onOpen(cb)` → unsubscribe. Config `{ schemes }`, default `[]` = accept all. The **only event** in the
  framework: `deepLink:open` `{ url }`, visible to plugins that declare `depends: [deepLinkPlugin]`. Web
  has no push deliveries.
- **`runtime`** (core, always present) → `ctx.runtime.kind` / `.platform`. Override in tests with a
  **hoisted** `pluginConfigs` object holding `runtime: { forceKind, forcePlatform }`; it is not a typed key.
- No capability declares `depends`. `app.stop()` awaits in-flight resolution (at most 5000 ms) and
  disposes providers. After it, the Tauri providers of `store`, `tray` and `deepLink` answer
  `unavailable`, `"app stopped"`.

Full catalog (6 plugins, entry points, every API/config/event, provider seam, native permissions,
dependency graph): **[`references/plugin-index.md`](references/plugin-index.md)**.
