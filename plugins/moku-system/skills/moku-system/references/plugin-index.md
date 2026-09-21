# @moku-labs/system — Plugin & Property Index

**Synced version:** `0.2.1` (npm `dist-tags.latest`; catalog generated from the `v0.2.1` git tag **source** +
the root and per-plugin READMEs). Built on `@moku-labs/core@1.6.0` + `@moku-labs/common@0.3.2` +
`idb-keyval@6.3.0` as **bundled**, exactly pinned dependencies. Five **OPTIONAL** `peerDependencies`
(`peerDependenciesMeta.optional`): `@tauri-apps/api@^2.11.0`, `@tauri-apps/plugin-store@^2.4.0`,
`@tauri-apps/plugin-notification@^2.3.0`, `@tauri-apps/plugin-clipboard-manager@^2.3.0`,
`@tauri-apps/plugin-deep-link@^2.4.0` — needed only by the Tauri providers. Engines node ≥24, bun ≥1.3.14.
`sideEffects: false`, ESM + CJS, types included.

⚠️ Upstream docs are **stale in five places**. The registry's "source wins" policy applies:

| # | Stale text | Source of truth |
|---|-----------|-----------------|
| 1 | `llms.txt` and `llms-full.txt` say `Package: @moku-labs/system 0.1.0` | `package.json` → `0.2.1` |
| 2 | `llms.txt` §1: kind is `"tauri"` when `__TAURI_INTERNALS__` is present | `src/plugins/runtime/detect.ts`: `globalThis.isTauri === true` **or** `"__TAURI_INTERNALS__" in globalThis` |
| 3 | `llms-full.txt`: `TrayConfig.icon?: string` | `src/plugins/tray/types.ts`: `icon?: string \| Uint8Array \| number[]` |
| 4 | `llms-full.txt` §4.5: `DeepLinkState` has `launchUrl` / `launchReplayDone`; the replay window "closes immediately" after the first delivery | `src/plugins/deep-link/types.ts` + `api.ts`: `handedOver: Map<string, HandoverPath>`, `launchPhaseOpen`, `launchPhaseEndsAt`; a symmetric handover with a 5000 ms launch phase |
| 5 | `src/plugins/runtime/README.md`: `runtime` config is "NOT reachable through `createApp`'s `pluginConfigs`" | `src/index.ts` JSDoc lists `runtime` as a `pluginConfigs` key and the kernel cascade ends at `createApp`; the key is applied but **untyped** (hoist the object) |

## A standalone `@moku-labs/core` framework — one core, zero default plugins

`@moku-labs/system` is its **own** Moku framework: one `createCoreConfig("system", …)` in `src/config.ts`,
then `src/index.ts` **exports** `createApp` for Layer-3 apps. `createCore(coreConfig, { plugins: [] })`
registers **no default capability**. Every capability is opt-in.

## 1. Entry points (every key of `package.json` `exports`)

| Import | Runtime exports | Type exports |
|--------|-----------------|--------------|
| `@moku-labs/system` (`.`) | `createApp`, `createPlugin`, `ok`, `err` | namespaces `Store`, `Tray`, `Notify`, `Clipboard`, `DeepLink`; `SystemResult`, `SystemOk`, `SystemErr`, `SystemErrorReason`, `RuntimeKind`, `RuntimePlatform`, `JsonValue`, `JsonPrimitive` |
| `@moku-labs/system/store` | `storePlugin` | namespace `Store` |
| `@moku-labs/system/tray` | `trayPlugin` | namespace `Tray` |
| `@moku-labs/system/notify` | `notifyPlugin` | namespace `Notify` |
| `@moku-labs/system/clipboard` | `clipboardPlugin` | namespace `Clipboard` |
| `@moku-labs/system/deep-link` | `deepLinkPlugin` | namespace `DeepLink` |

⚠️ The root exports **no plugin instance**. A root barrel leaked about 2 KB gzipped of unused capability
code into every bundle, so instances live on subpaths only. `runtimePlugin` and the `Runtime` type
namespace are **not** public. `src/plugins/index.ts` is a source-tree barrel, not a package entry.

## 2. `createApp` form (v0.2.1)

```ts
import { createApp, createPlugin } from "@moku-labs/system";
import { deepLinkPlugin } from "@moku-labs/system/deep-link";
import { storePlugin } from "@moku-labs/system/store";

const recent = createPlugin("recent", {
  depends: [deepLinkPlugin], // the depends edge makes deepLink:open visible
  hooks: (ctx) => ({
    "deepLink:open": ({ url }) => ctx.log.info("deep link opened", { url, shell: ctx.runtime.kind }),
  }),
});

export const system = createApp({
  plugins: [storePlugin, deepLinkPlugin, recent],
  pluginConfigs: { store: { name: "my-app" }, deepLink: { schemes: ["myapp"] } },
});
await system.start(); // providers start resolving, fire-and-forget

const launch = await system.deepLink.getCurrent();
if (launch.ok && launch.value !== null) await system.store.set("lastLink", launch.value);

await system.stop(); // awaits in-flight resolution (max 5000 ms), disposes providers
```

| Option | Type | Default | Notes |
|--------|------|---------|-------|
| `plugins` | `PluginInstance[]` | `[]` | Capability plugins from the subpaths, plus consumer plugins |
| `pluginConfigs` | per-plugin overrides | `{}` | Keys: `store`, `tray`, `deepLink` (typed), `runtime` (applied, untyped). `notify` and `clipboard` have no config |
| `config` | `Partial<Config>` | `{}` | `Config` is empty in v1 |
| `onReady` / `onError` | `(ctx) => void` | — | After every `onInit` / on a boot error |
| `onStart` / `onStop` | `() => void \| Promise<void>` | — | Run by `app.start()` / `app.stop()` |

`createApp` returns a typed, frozen app synchronously. `createPlugin("name", spec)` authors a consumer
plugin whose `ctx` carries `ctx.runtime`, `ctx.log`, `ctx.env`. Generics infer from the spec.

## 3. Global config and events (`src/config.ts`)

| Item | Value |
|------|-------|
| Framework id | `"system"` |
| `Config` | `Record<string, never>` — empty by decision. Capabilities configure through `pluginConfigs` |
| `Events` | `Record<string, never>` — empty by decision. `deepLink:open` stays owned by its plugin |
| Core plugins | `logPlugin` → `ctx.log`, `envPlugin` → `ctx.env` (both `@moku-labs/common`), `runtimePlugin` → `ctx.runtime` |
| Internal exports | `coreConfig`, `createPlugin`, `createCore` — used inside the framework only |

## 4. The provider seam

**Detection** (`runtime/detect.ts`) is synchronous and import-free. It runs once in `createState`.

| Value | Rule |
|-------|------|
| `kind: "tauri"` | `globalThis.isTauri === true`, or `"__TAURI_INTERNALS__" in globalThis` |
| `kind: "web"` | everything else |
| `platform` | From `navigator.userAgent`, in this order: `android`, `iphone\|ipad\|ipod` → `ios`, `win` → `windows`, `mac` → `macos` (or `ios` when `maxTouchPoints > 1`, the iPad desktop mode), `linux`. No `navigator` (SSR) or no match → `"unknown"` |

**Provider interface.** Each capability has a structural provider type (`StoreProvider`, `NotifyProvider`,
`ClipboardProvider`, `TrayProvider`, `DeepLinkProvider`). All satisfy
`CapabilityProvider = { dispose: () => Promise<void> }`. No `@tauri-apps/*` type appears in the public surface.

**Resolution lifecycle** (`runtime/provider.ts`, internal, not exported):

| Helper | Role |
|--------|------|
| `startResolution(kind, ctx, load)` | Called from `onStart`. Stores an unawaited promise in `ctx.state.provider` and the teardown entry in `ctx.state.teardown` (since 0.2.1; before it: `startResolution(capability, kind, ctx, load)` and a module-scope registry keyed by `ctx.global`). Every `load()` rejection folds into `err(kind, "unavailable", message)`. Never throws |
| `requirePeer(nativeName, peer, load)` | A missing optional peer fails with `"<peer> is not installed. Add it to the app, or list "<nativeName>" in @moku-labs/native config.system."` |
| `awaitProvider(state, kind)` | Awaited by every API method. A `null` slot → `err(kind, "unavailable", "app not started — call app.start() first")` |
| `stopResolution(capability, ctx, timeoutMs = 5000)` | Called from `onStop`. Waits (bounded) for an in-flight resolution, then awaits `dispose()`. On timeout logs `runtime:stop-resolution-timeout` at `warn` and moves on. A provider that arrives late disposes itself |

Only `providers/web.ts` is a static import. `providers/tauri.ts` and its `@tauri-apps/*` package are dynamic imports.

**Result type** (`runtime/result.ts`, public):

```ts
type RuntimeKind = "tauri" | "web";
type RuntimePlatform = "macos" | "windows" | "linux" | "ios" | "android" | "unknown";
type SystemErrorReason = "unsupported" | "denied" | "unavailable" | "error";
type SystemOk<T> = { ok: true; value: T; provider: RuntimeKind };
type SystemErr = { ok: false; provider: RuntimeKind; reason: SystemErrorReason; message?: string };
type SystemResult<T> = SystemOk<T> | SystemErr;
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

ok<T>(value: T, provider: RuntimeKind): SystemOk<T>;
err(provider: RuntimeKind, reason: SystemErrorReason, message?: string): SystemErr;
```

| Signal | `reason` |
|--------|----------|
| Capability absent for this kind or platform | `"unsupported"` |
| Unambiguous **returned** permission signal (`Notification.permission`, Tauri `isPermissionGranted()`, web clipboard `NotAllowedError`) | `"denied"` |
| Dynamic import rejected, provider factory threw, storage probe failed, called before `start()`, stopped during resolution, Tauri provider used after `stop()` | `"unavailable"` |
| Method-time throw from either provider, including every Tauri ACL error | `"error"` |

⚠️ A thrown error is **never** mapped to `"denied"`; Tauri ACL throws are ambiguous. Programmer errors
still throw: the three `onInit` validations below raise `TypeError` at `createApp`. `mapThrownToResult`
and `unsupportedProvider` are internal, not root exports.

## 5. Plugins (6) — 1 core + 5 opt-in capabilities

| # | Plugin | Name / namespace | Tier | Wiring | Depends on | Config | Events |
|---|--------|------------------|------|--------|-----------|--------|--------|
| 1 | `runtimePlugin` | `runtime` / `ctx.runtime` | Micro (core) | always registered | — | `forceKind`, `forcePlatform` | — |
| 2 | `storePlugin` | `store` / `app.store` | Complex | opt-in, `./store` | — | `name` | — |
| 3 | `notifyPlugin` | `notify` / `app.notify` | Complex | opt-in, `./notify` | — | none | — |
| 4 | `clipboardPlugin` | `clipboard` / `app.clipboard` | Complex | opt-in, `./clipboard` | — | none | — |
| 5 | `trayPlugin` | `tray` / `app.tray` | Complex | opt-in, `./tray` | — | `id`, `icon?` | — |
| 6 | `deepLinkPlugin` | `deepLink` / `app.deepLink` | Complex | opt-in, `./deep-link` | — | `schemes` | `deepLink:open` |

Every capability has the same lifecycle hooks: `createState` → `{ provider: null }`, `onStart` →
`startResolution(...)`, `onStop` → `stopResolution(...)`. `ctx.runtime` / `ctx.log` are never a `depends` edge.

### 5.1 `runtime` — shell and platform detection (core)

- **Purpose:** the single override point of the seam. Created with `createCorePlugin("runtime", …)`.
- **Config:** `forceKind: RuntimeKind | null`, `forcePlatform: RuntimePlatform | null`. Default `null` = detect.
- **API:** `RuntimeApi = { readonly kind: RuntimeKind; readonly platform: RuntimePlatform }`. Immutable.
- **Events / hooks:** none. `createState` only.
- **Gotchas:** `runtime` is not a typed `pluginConfigs` key of `createApp`. Hoist the object:
  `const pluginConfigs = { store: { name: "t" }, runtime: { forceKind: "web" } } as const;`. The
  alternative is to stub the environment before the app is created (`vi.stubGlobal("__TAURI_INTERNALS__", {})`).
  ⚠️ Forcing `"tauri"` in Node must be paired with `vi.mock("@tauri-apps/…")`.

### 5.2 `store` — JSON-safe key-value persistence

- **Config:** `name: string`, default `"moku-system"`. Must match `/^[a-z0-9][a-z0-9._-]*$/i`.
  `onInit` throws `TypeError` (`[system] store.name must be a file-safe namespace …`) otherwise.

```ts
type StoreApi = {
  get: <T extends JsonValue = JsonValue>(key: string) => Promise<SystemResult<T | undefined>>; // ok(undefined) when absent
  set: <T extends JsonValue>(key: string, value: T) => Promise<SystemResult<void>>;            // durable when ok
  delete: (key: string) => Promise<SystemResult<void>>;                                         // ok when removed or absent
  keys: () => Promise<SystemResult<string[]>>;
  clear: () => Promise<SystemResult<void>>;
};
```

| Aspect | Tauri (`@tauri-apps/plugin-store`) | Web (`idb-keyval`) |
|--------|-----------------------------------|--------------------|
| Backing | `load("${name}.json", { defaults: {}, autoSave: false })` | IndexedDB database `name`, object store `"kv"` |
| Durability | `save()` awaited after `set` / `delete` / `clear` | transaction commit |
| Startup probe | the file load | `set` + `del` of `__moku_probe__`; failure (Safari private mode) → `"unavailable"` on every call |
| `dispose()` | `save()` then `close()`; never rejects; later calls → `err("tauri", "unavailable", "app stopped")` | no-op |

- **Reasons:** `"unavailable"`, `"error"`. Never `"denied"` or `"unsupported"`. **Log keys:** `store:{web|tauri}-{get|set|delete|keys|clear}-failed`, `store:tauri-dispose-{save|close}-failed`.
- ⚠️ **Gotchas:** values must be `JsonValue` (no `Date`, `Map`). Data does **not** migrate between
  providers: an app run on web and later packaged as native starts empty.

### 5.3 `notify` — OS and browser notifications

- **Config:** none. `NotifyOptions = { title: string; body?: string }`.

```ts
type NotifyApi = {
  isPermissionGranted: () => Promise<SystemResult<boolean>>;
  requestPermission: () => Promise<SystemResult<boolean>>; // the only place a prompt starts
  show: (options: NotifyOptions) => Promise<SystemResult<void>>; // never prompts
};
```

| Aspect | Tauri (`@tauri-apps/plugin-notification`) | Web (`Notification` global) |
|--------|------------------------------------------|-----------------------------|
| Absence | `window.Notification` missing → `show()` → `err("tauri", "unavailable", …)` | no `Notification` global (SSR, insecure context) → every method `err("web", "unsupported")` |
| `show()` without permission | `err("tauri", "denied", "notification permission not granted")` | same, with `"web"` |
| `requestPermission()` refused | `ok(false)` — a returned value, not an error | `ok(false)` |
| Permission cache | caches **only** `granted`; a not-granted answer is re-read on every `show()` | none needed |

- **Reasons produced:** `"unsupported"` (web), `"denied"`, `"unavailable"`, `"error"`.
- **Log keys:** `notify:{web|tauri}-{show|request-permission}-failed`, `notify:tauri-is-permission-granted-failed`.
- ⚠️ **Gotcha:** call `requestPermission()` from a user gesture. Browsers ignore prompts without one.

### 5.4 `clipboard` — text clipboard

- **Config:** none.

```ts
type ClipboardApi = {
  readText: () => Promise<SystemResult<string>>;
  writeText: (text: string) => Promise<SystemResult<void>>;
};
```

| Aspect | Tauri (`@tauri-apps/plugin-clipboard-manager`) | Web (`navigator.clipboard`) |
|--------|-----------------------------------------------|-----------------------------|
| Absence | — | no `navigator` / `navigator.clipboard` → both methods `"unsupported"`; one missing method (Firefox `readText`) → `"unsupported"` for that method only |
| Refusal | any throw → `"error"`, never `"denied"` | rejection with `name === "NotAllowedError"` → `"denied"`; other throws → `"error"` |
| Support check | — | feature-probed; no `permissions.query` |

- **Log keys:** `clipboard:{web|tauri}-{read|write}-failed`. Clipboard text is never logged; a failed Tauri
  write logs `{ length }` only. `NotAllowedError` is not logged as an error.
- ⚠️ **Gotcha:** on web, call from a user gesture. Outside one expect `"denied"`; offer a manual copy UI.

### 5.5 `tray` — desktop system tray

- **Config:** `id: string`, default `"moku-system"`; `onInit` throws `TypeError` when it is empty or
  whitespace. `icon?: string | Uint8Array | number[]`; omitted = the app's default window icon
  (`defaultWindowIcon()` from `@tauri-apps/api/app`).
- **Item type:** `TrayMenuItem = { id: string; text: string; enabled?: boolean; action?: () => void }`.
  `action` runs in the webview on click, Tauri desktop only.

```ts
type TrayApi = {
  setMenu: (items: TrayMenuItem[]) => Promise<SystemResult<void>>;
  setTooltip: (text: string) => Promise<SystemResult<void>>;
  setIcon: (iconPath: string) => Promise<SystemResult<void>>;
  destroy: () => Promise<SystemResult<void>>; // ok even if never created
};
```

| Branch | Behaviour |
|--------|-----------|
| kind `"web"` | every method `err("web", "unsupported")` |
| kind `"tauri"`, platform not in `macos` / `windows` / `linux` (an allowlist: `ios`, `android`, `unknown`) | every method `err("tauri", "unsupported")` |
| kind `"tauri"`, desktop | `@tauri-apps/api/tray` + `/menu`. The OS icon is created lazily on the first `setMenu` / `setTooltip` / `setIcon`. One `Menu` alive at a time; swaps are queued. `destroy()` removes the icon, the next mutating call recreates it. `dispose()` is final: later calls → `"unavailable"`, `"app stopped"` |

- **Reasons produced:** `"unsupported"`, `"unavailable"` (also an unloadable icon; the message names
  `tray.icon`), `"error"`. Never `"denied"`.
- **Log keys:** `tray:tauri-{set-menu|set-tooltip|set-icon|destroy}-failed`, `tray:tauri-menu-close-failed`.
- ⚠️ **Gotchas:** a relative icon path resolves against the process working directory, which a bundled
  app does not control. Prefer the default icon, an absolute path, or bytes. An iPad in desktop mode is
  `"ios"`, so it gets `"unsupported"`.

### 5.6 `deepLink` — launch URL and runtime deliveries

- **Naming:** plugin name `deepLink` (`pluginConfigs.deepLink`, `app.deepLink`), directory `deep-link/`,
  subpath `@moku-labs/system/deep-link`, event `deepLink:open`.
- **Config:** `schemes: string[]`, default `[]` = accept all. Each entry must match `/^[a-z][a-z0-9+.-]*$/`;
  `onInit` throws `TypeError` otherwise. The allowlist filters `getCurrent()` and deliveries.
- **Events:** declares and emits `deepLink:open` with `{ url: string }`, after the filter and the handover.
  Visible to the plugin itself and to plugins with `depends: [deepLinkPlugin]`. No other plugin has events.

```ts
type Unsubscribe = () => void;
type DeepLinkApi = {
  getCurrent: () => Promise<SystemResult<string | null>>; // ok(null): none, filtered, or already delivered
  onOpen: (cb: (payload: { url: string }) => void) => Unsubscribe; // local, synchronous, always succeeds
};
```

| Aspect | Tauri (`@tauri-apps/plugin-deep-link`) | Web |
|--------|---------------------------------------|-----|
| `getCurrent()` | first URL of the plugin's list or `null`; further URLs go down the delivery channel once | the decoded `?deeplink=` / `#deeplink=` parameter of `location.href`, else `null`. The page address itself is never a deep link |
| Deliveries | OS `onOpenUrl` listener, registered at resolution | none in v1; `onOpen` subscribes but never fires |
| Refused input | — | `javascript:`, `data:`, `vbscript:`, `blob:`, `file:` → `ok(null)` before the allowlist; undecodable value → `ok(null)` |
| `dispose()` | unregisters the listener; later `getCurrent()` → `"unavailable"`, `"app stopped"` | no-op |

- **Delivery pipeline** (`createDeliver`): scheme filter → launch handover → `emit("deepLink:open")` →
  `onOpen` subscribers. A throwing subscriber is caught and logged (`deepLink:subscriber-failed`).
- **Launch handover:** each launch URL reaches the app exactly once, through whichever path sees it
  first. A delivery equal to a URL `getCurrent()` already returned is dropped once. `getCurrent()` returns
  `ok(null)` for a URL already delivered through `onOpen`. The launch phase lasts 5000 ms from the first
  launch-phase URL, or ends when an already delivered URL arrives again. After it, every delivery reaches
  the app. No timer is armed; the deadline is checked when a URL arrives.
- **Reasons produced:** `"unavailable"`, `"error"`. Never `"denied"` or `"unsupported"`.
- ⚠️ **Gotchas:** on Windows and Linux the OS starts a **new process** for a deep link. Runtime deliveries
  need `tauri-plugin-single-instance`, wired by the `@moku-labs/native` packager; only `getCurrent()` is
  reliable there without it. Scheme registration with the OS is the packager's contract. App code should
  prefer `onOpen()`; the event is plumbing for other plugins.

## 6. Native permissions (what `@moku-labs/native` generates)

`@moku-labs/native` generates the capability file, Cargo dependencies and plugin registrations from its
`config.system` list. The list is keyed by the **Tauri plugin name**.

| Plugin | `config.system` name | ACL permissions | Rust side |
|--------|----------------------|-----------------|-----------|
| `store` | `store` | `store:default` | `tauri-plugin-store`, `Builder::default().build()` |
| `notify` | `notification` | `notification:default` | `tauri-plugin-notification`, `init()` |
| `clipboard` | `clipboard-manager` | `clipboard-manager:allow-read-text`, `clipboard-manager:allow-write-text` | `tauri-plugin-clipboard-manager`, `init()` |
| `deepLink` | `deep-link` | `deep-link:default`, `core:event:default` | `tauri-plugin-deep-link`, `init()`; schemes in the Tauri config |
| `tray` | `tray` | `core:tray:default`, `core:menu:default`, `core:image:default`, `core:resources:default` | no crate; Cargo features `tray-icon` + `image-png`; desktop only |

⚠️ `clipboard-manager:default` grants nothing. The `core:*` entries all ship inside `core:default`.

## 7. Dependency graph

```
core plugins (always):   log ─┐
                         env ─┼→ injected flat on every ctx (ctx.log, ctx.env, ctx.runtime)
                     runtime ─┘

opt-in capabilities:     store   notify   clipboard   tray   deepLink ──emits──→ deepLink:open
                         (no depends edges; each reads ctx.runtime once, at provider resolution)

consumer plugins:        depends: [deepLinkPlugin] → may hook deepLink:open
```

## 8. Exported types worth knowing

| Namespace | Members |
|-----------|---------|
| `Store` | `StoreConfig`, `StoreApi`, `StoreState`, `StoreContext` |
| `Notify` | `NotifyOptions`, `NotifyApi`, `NotifyState`, `NotifyContext` |
| `Clipboard` | `ClipboardApi`, `ClipboardState`, `ClipboardContext` |
| `Tray` | `TrayConfig`, `TrayMenuItem`, `TrayApi`, `TrayState`, `TrayContext` |
| `DeepLink` | `DeepLinkConfig`, `DeepLinkEvents`, `DeepLinkApi`, `Unsubscribe`, `Clock`, `HandoverPath`, `DeepLinkState`, `DeepLinkContext` |

`*State` / `*Context` are internal shapes. Not exported: `STOP_TIMEOUT_MS = 5000`, `LAUNCH_WINDOW_MS = 5000`.

## 9. Idiomatic placement (`moku-idioms.md`)

A system app is a **Layer-3 app** that `createApp`s **from System**, never `createCoreConfig` /
`createCore` and never a direct `@moku-labs/core` dependency (I1). System plugins compose only into
System's `createApp`; an app with a web UI keeps its `@moku-labs/web` app beside it, one `createApp` per
framework (`moku-idioms.md §I2`). Use the capability plugins instead of hand-written `localStorage`,
`new Notification()` or `@tauri-apps/*` calls (I5). Web bundles must resolve or externalize
`@tauri-apps/*` (`external: ["@tauri-apps/*"]` in Bun, `/^@tauri-apps\//` in Rollup).
