# @moku-labs/system — Plugin & Property Index

**Synced version:** `0.3.1` (npm `dist-tags.latest`; catalog generated from the `v0.3.1` git tag **source** +
the root and per-plugin READMEs). `@moku-labs/core@^1.7.1` + `@moku-labs/common@^0.3.4` are
**`peerDependencies`** since 0.3.1 (through 0.3.0 they were bundled exact pins `1.6.0` / `0.3.2`). Bun and
npm install peers automatically, so an app still declares neither. `idb-keyval@6.3.0` stays the one bundled
dependency. Six **OPTIONAL** `peerDependencies` (`peerDependenciesMeta.optional`): `@tauri-apps/api@^2.12.0`,
`@tauri-apps/plugin-store@^2.4.0`, `@tauri-apps/plugin-notification@^2.3.0`,
`@tauri-apps/plugin-clipboard-manager@^2.3.0`, `@tauri-apps/plugin-deep-link@^2.4.0`,
`@tauri-apps/plugin-haptics@^2.4.0` — needed only by the Tauri providers. Engines node ≥24, bun ≥1.3.14.
`sideEffects: false`, ESM + CJS, types included.

**New in 0.3.0:** four capability plugins — `lifecycle`, `back`, `haptics`, `keepAwake` — each on its own
subpath (§5.7–§5.10). The `@tauri-apps/api` peer floor rose from `^2.11.0` to `^2.12.0` (`back.exit()` needs
`exit`, `@since 2.12.0`). No existing plugin changed. **New in 0.3.1:** packaging only, core and common moved
to peers.

⚠️ Upstream docs are **stale in six places**. The registry's "source wins" policy applies:

| # | Stale text | Source of truth |
|---|-----------|-----------------|
| 1 | `llms.txt` and `llms-full.txt` say `Package: @moku-labs/system 0.1.0` | `package.json` → `0.3.1` |
| 2 | `llms.txt` §1: kind is `"tauri"` when `__TAURI_INTERNALS__` is present | `src/plugins/runtime/detect.ts`: `globalThis.isTauri === true` **or** `"__TAURI_INTERNALS__" in globalThis` |
| 3 | `llms-full.txt`: `TrayConfig.icon?: string` | `src/plugins/tray/types.ts`: `icon?: string \| Uint8Array \| number[]` |
| 4 | `llms-full.txt` §4.5: `DeepLinkState` has `launchUrl` / `launchReplayDone`; the replay window "closes immediately" after the first delivery | `src/plugins/deep-link/types.ts` + `api.ts`: `handedOver: Map<string, HandoverPath>`, `launchPhaseOpen`, `launchPhaseEndsAt`; a symmetric handover with a 5000 ms launch phase |
| 5 | `src/plugins/runtime/README.md`: `runtime` config is "NOT reachable through `createApp`'s `pluginConfigs`" | `src/index.ts` JSDoc lists `runtime` as a `pluginConfigs` key and the kernel cascade ends at `createApp`; the key is applied but **untyped** (hoist the object) |
| 6 | `README.md` calls `@moku-labs/core` a "bundled dependency"; its Install section lists only the `@tauri-apps/*` peers | `package.json` (0.3.1): `@moku-labs/core@^1.7.1` and `@moku-labs/common@^0.3.4` are `peerDependencies` |

## A standalone `@moku-labs/core` framework — one core, zero default plugins

`@moku-labs/system` is its **own** Moku framework: one `createCoreConfig("system", …)` in `src/config.ts`,
then `src/index.ts` **exports** `createApp` for Layer-3 apps. `createCore(coreConfig, { plugins: [] })`
registers **no default capability**. Every capability is opt-in.

## 1. Entry points (every key of `package.json` `exports`)

| Import | Runtime exports | Type exports |
|--------|-----------------|--------------|
| `@moku-labs/system` (`.`) | `createApp`, `createPlugin`, `ok`, `err` | namespaces `Store`, `Tray`, `Notify`, `Clipboard`, `DeepLink`, `Lifecycle`, `Back`, `Haptics`, `KeepAwake`; `SystemResult`, `SystemOk`, `SystemErr`, `SystemErrorReason`, `RuntimeKind`, `RuntimePlatform`, `JsonValue`, `JsonPrimitive` |
| `@moku-labs/system/store` | `storePlugin` | namespace `Store` |
| `@moku-labs/system/tray` | `trayPlugin` | namespace `Tray` |
| `@moku-labs/system/notify` | `notifyPlugin` | namespace `Notify` |
| `@moku-labs/system/clipboard` | `clipboardPlugin` | namespace `Clipboard` |
| `@moku-labs/system/deep-link` | `deepLinkPlugin` | namespace `DeepLink` |
| `@moku-labs/system/lifecycle` | `lifecyclePlugin` | namespace `Lifecycle` |
| `@moku-labs/system/back` | `backPlugin` | namespace `Back` |
| `@moku-labs/system/haptics` | `hapticsPlugin` | namespace `Haptics` |
| `@moku-labs/system/keep-awake` | `keepAwakePlugin` | namespace `KeepAwake` |

⚠️ The root exports **no plugin instance**. A root barrel leaked about 2 KB gzipped of unused capability
code into every bundle, so instances live on subpaths only. `runtimePlugin` and the `Runtime` type
namespace are **not** public. `src/plugins/index.ts` is a source-tree barrel, not a package entry.

## 2. `createApp` form (v0.3.1)

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
| `pluginConfigs` | per-plugin overrides | `{}` | Keys: `store`, `tray`, `deepLink` (typed), `runtime` (applied, untyped). `notify`, `clipboard`, `lifecycle`, `back`, `haptics`, `keepAwake` have no config |
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
`ClipboardProvider`, `TrayProvider`, `DeepLinkProvider`, `LifecycleProvider`, `BackProvider`,
`HapticsProvider`, `KeepAwakeProvider`). All satisfy
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

## 5. Plugins (10) — 1 core + 9 opt-in capabilities

| # | Plugin | Name / namespace | Tier | Wiring | Depends on | Config | Events |
|---|--------|------------------|------|--------|-----------|--------|--------|
| 1 | `runtimePlugin` | `runtime` / `ctx.runtime` | Micro (core) | always registered | — | `forceKind`, `forcePlatform` | — |
| 2 | `storePlugin` | `store` / `app.store` | Complex | opt-in, `./store` | — | `name` | — |
| 3 | `notifyPlugin` | `notify` / `app.notify` | Complex | opt-in, `./notify` | — | none | — |
| 4 | `clipboardPlugin` | `clipboard` / `app.clipboard` | Complex | opt-in, `./clipboard` | — | none | — |
| 5 | `trayPlugin` | `tray` / `app.tray` | Complex | opt-in, `./tray` | — | `id`, `icon?` | — |
| 6 | `deepLinkPlugin` | `deepLink` / `app.deepLink` | Complex | opt-in, `./deep-link` | — | `schemes` | `deepLink:open` |
| 7 | `lifecyclePlugin` | `lifecycle` / `app.lifecycle` | Complex | opt-in, `./lifecycle` | — | none | — |
| 8 | `backPlugin` | `back` / `app.back` | Complex | opt-in, `./back` | — | none | — |
| 9 | `hapticsPlugin` | `haptics` / `app.haptics` | Complex | opt-in, `./haptics` | — | none | — |
| 10 | `keepAwakePlugin` | `keepAwake` / `app.keepAwake` | Complex | opt-in, `./keep-awake` | — | none | — |

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

### 5.7 `lifecycle` — app pause and resume (since 0.3.0)

- **Config / events:** none. Excluded from `pluginConfigs`.

```ts
type Unsubscribe = () => void;
type LifecycleApi = {
  onPause: (fn: () => void) => Unsubscribe;  // local, synchronous, always succeeds, allowed before start()
  onResume: (fn: () => void) => Unsubscribe;
};
```

| Aspect | Tauri (every platform) | Web |
|--------|------------------------|-----|
| Sources | `visibilitychange` **plus** `tauri://suspended` → pause, `tauri://resumed` → resume (lazy `@tauri-apps/api/event`) | `visibilitychange` (hidden → pause, visible → resume) |
| `@tauri-apps/api` missing or `listen` rejected | `warn` `lifecycle:tauri-events-unavailable`; runs on `visibilitychange` alone. No `requirePeer` | — |
| Page hidden at start | one pause | one pause |
| `dispose()` | removes the DOM listener, awaits each native unlisten once; a failed unlisten logs `lifecycle:tauri-unlisten-failed` and still resolves | removes the DOM listener |

- **Dedupe:** the app starts in the foreground (`paused: false`). Pause runs only from the foreground,
  resume only after a pause. iOS sends `tauri://suspended` about 1.5 s before `hidden`; subscribers still
  see one pause and one resume. Desktop Tauri gets `visibilitychange` only (Rust emits suspend/resume on
  mobile only).
- **Subscriptions:** each call is its own entry (since 0.3.0's fix): the same `fn` subscribed twice runs
  twice, and each remover removes one. Subscribers run in order from a snapshot; a throw logs
  `lifecycle:subscriber-failed` and the rest still run. No subscriber runs after `app.stop()`.
- **Native:** nothing beyond `core:default`. Not a `@moku-labs/native` `config.system` entry.

### 5.8 `back` — Android hardware Back and app exit (since 0.3.0)

- **Config / events:** none.

```ts
type BackApi = {
  onPress: (fn: () => boolean) => Unsubscribe; // return true = press taken; newest handler first
  exit: () => Promise<SystemResult<void>>;
};
```

| Branch | Behaviour |
|--------|-----------|
| kind `"tauri"`, platform `"android"` | lazy `@tauri-apps/api/app`: `onBackButtonPress` for presses, `exit(0)` for `exit()` |
| kind `"tauri"`, any other platform | `unsupportedProvider`: handlers kept, never called; `exit()` → `"unsupported"` |
| kind `"web"` | same stand-in with `"web"`. No history trap, no `CloseWatcher` |

- **Native listener follows the handlers:** registering one replaces the Android default, so it is
  registered only while at least one handler exists **and** the app is started. The last remover
  unregisters it. Subscribe, remove and `start()` chain one reconcile step on a single queue.
- **No handler took the press:** the provider replays the default — `history.back()` when the webview
  can go back, otherwise `exit(0)`. A throwing handler logs `back:subscriber-failed` and counts as `false`.
- **`exit()` results:** Android → `ok(undefined, "tauri")`; `@tauri-apps/api` older than 2.12 →
  `"unavailable"`, `"exit() needs @tauri-apps/api 2.12 or newer"`; a throw (incl. missing
  `core:app:allow-exit`) → `"error"`, never `"denied"`; peer missing → `"unavailable"` via `requirePeer`
  (`config.system` name `back`); after `stop()` → `"unavailable"`, `"app stopped"`.
- **Log keys:** `back:subscriber-failed`, `back:reconcile-failed`, `back:tauri-listen-failed`,
  `back:tauri-unlisten-failed`, `back:default-exit-failed`.

### 5.9 `haptics` — haptic feedback (since 0.3.0)

- **Config / events:** none. `ImpactKind = "light" | "medium" | "heavy"`,
  `NotifyKind = "success" | "warning" | "error"`. Tauri's `"soft"` / `"rigid"` are left out on purpose.

```ts
type HapticsApi = {
  impact: (kind: ImpactKind) => Promise<SystemResult<void>>;
  notify: (kind: NotifyKind) => Promise<SystemResult<void>>;
  selection: () => Promise<SystemResult<void>>;
};
```

| Branch | Behaviour |
|--------|-----------|
| kind `"tauri"`, platform `ios` / `android` | lazy `@tauri-apps/plugin-haptics`. A `{ status: "error" }` answer or a throw → `"error"` (logged `haptics:tauri-failed`), never `"denied"` |
| kind `"tauri"`, other platforms | `"unsupported"`; the package is never imported |
| kind `"web"` | `navigator.vibrate`, probed once. Absent (iOS Safari, WKWebView, SSR) → `"unsupported"`. Answered `false` (no user gesture yet) → `"unavailable"`, `"vibrate refused — needs a user gesture first"`, not logged. Throw → `"error"` (`haptics:web-failed`) |

- **Web patterns (ms):** impact `10` / `20` / `35`, selection `5`, notify success `[15, 60, 15]`,
  warning `[30, 60, 30]`, error `[40, 60, 40, 60, 40]`.
- **Native:** `haptics:allow-impact-feedback`, `-notification-feedback`, `-selection-feedback`,
  `haptics:allow-vibrate` (no default set). `tauri-plugin-haptics` `init()`, iOS + Android only.

### 5.10 `keepAwake` — keep the screen on (since 0.3.0)

- **Naming:** plugin name `keepAwake` (`app.keepAwake`), directory `keep-awake/`, subpath
  `@moku-labs/system/keep-awake`. **Config / events:** none.

```ts
type KeepAwakeApi = {
  set: (on: boolean) => Promise<SystemResult<void>>;
};
```

- **One provider for both kinds:** `navigator.wakeLock`, in the browser and in the Tauri webview. No
  Tauri package, no peer, no native code; `kind` only tags the result.
- **The wish:** `set(true)` records a wish. The browser drops the lock when the page hides; when it is
  visible again and the wish holds, the plugin re-acquires (a failure logs `keepAwake:reacquire-failed`).
  `set(false)` drops the wish and releases. Two `set(true)` calls in flight share one request.

| Situation | Result |
|-----------|--------|
| Lock taken or held; any `set(false)` | `ok(undefined)` |
| No `navigator.wakeLock` (SSR, Firefox < 126, old webview) | `"unsupported"` |
| `set(true)` on a hidden page | `"unavailable"`, `"page hidden — re-acquired when visible"`, wish kept |
| Rejection named `NotAllowedError` (battery saver, permissions policy) | `"denied"` |
| Other rejection | `"error"`, logged `keepAwake:request-failed` |
| `set(true)` after `app.stop()` | `"unavailable"`, `"app stopped"` |

- **Native:** none. Not a `@moku-labs/native` `config.system` entry.

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
| `back` | `back` | `core:app:allow-exit` (listener permissions are in `core:default`) | no crate; core API, Android only |
| `haptics` | `haptics` | `haptics:allow-impact-feedback`, `haptics:allow-notification-feedback`, `haptics:allow-selection-feedback`, `haptics:allow-vibrate` | `tauri-plugin-haptics`, `init()`; iOS + Android only |
| `lifecycle` | — (not listed) | nothing beyond `core:default` | none |
| `keepAwake` | — (not listed) | none | none; `navigator.wakeLock` in the webview |

⚠️ `clipboard-manager:default` grants nothing. The `core:*` entries all ship inside `core:default`, except
`core:app:allow-exit`. Haptics has no default set. The `back` and `haptics` rows ship in
`@moku-labs/native` 0.3.0 and later.

## 7. Dependency graph

```
core plugins (always):   log ─┐
                         env ─┼→ injected flat on every ctx (ctx.log, ctx.env, ctx.runtime)
                     runtime ─┘

opt-in capabilities:     store   notify   clipboard   tray   deepLink ──emits──→ deepLink:open
                         lifecycle   back   haptics   keepAwake
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
| `Lifecycle` | `LifecycleApi`, `Unsubscribe`, `LifecycleState`, `LifecycleContext` |
| `Back` | `BackApi`, `Unsubscribe`, `BackState`, `BackContext` |
| `Haptics` | `HapticsApi`, `ImpactKind`, `NotifyKind`, `HapticsState`, `HapticsContext` |
| `KeepAwake` | `KeepAwakeApi`, `KeepAwakeState`, `KeepAwakeContext` |

`*State` / `*Context` are internal shapes. Not exported: `STOP_TIMEOUT_MS = 5000`, `LAUNCH_WINDOW_MS = 5000`.

## 9. Idiomatic placement (`moku-idioms.md`)

A system app is a **Layer-3 app** that `createApp`s **from System**, never `createCoreConfig` /
`createCore` and never a direct `@moku-labs/core` dependency (I1). System plugins compose only into
System's `createApp`; an app with a web UI keeps its `@moku-labs/web` app beside it, one `createApp` per
framework (`moku-idioms.md §I2`). Use the capability plugins instead of hand-written `localStorage`,
`new Notification()`, `visibilitychange` pause logic, `navigator.vibrate`, `navigator.wakeLock` or
`@tauri-apps/*` calls (I5). Web bundles must resolve or externalize
`@tauri-apps/*` (`external: ["@tauri-apps/*"]` in Bun, `/^@tauri-apps\//` in Rollup).
