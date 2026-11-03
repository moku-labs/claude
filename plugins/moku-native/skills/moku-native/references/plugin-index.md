# @moku-labs/native — Plugin & Property Index

**Synced version:** `0.3.15` (npm `dist-tags.latest`; catalog generated from the `v0.3.15` git tag **source**,
cross-checked against the root README, `llms.txt` / `llms-full.txt` and the published `dist/index.d.mts`). The npm
package ships `dist/`, `README.md` and `LICENSE` only; the `llms*` files are read from the repo. Dependencies: `@tauri-apps/cli@^2`
(regular). **Peer dependencies since 0.3.2:** `@moku-labs/core@^1.7.1` and `@moku-labs/common@^0.3.4` (0.2.x
exact-pinned core 1.6.0 / common 0.3.2 as regular deps). Install the peers beside the package. Engines
node ≥24, bun ≥1.3.14.

⚠️ Places where the upstream docs are **stale versus the `v0.3.15` source** (the source wins):

| Doc | Says | Source says |
|-----|------|-------------|
| `llms-full.txt:11` | `Version: 0.3.2` (the peers on that line are right) | published `package.json` → `0.3.15` |
| `llms.txt:110` | "gate on `completeness()` first" | `project.getCompleteness({ target })` |
| Root `README.md` plugin table | `version`, `runner` | `getVersion`, `getRunner` (`src/plugins/tauri/types.ts`) |
| `llms.txt` quick reference, `project` list | omits one method | `Api` also has `getDebugKeystore` |
| `llms.txt` `BuildFlavor`, `build.run`, `build.runAll`; `llms-full.txt:1429` | no `dev` | `BuildFlavor` has `dev?: boolean` (`src/config.ts`), since 0.3.13 |
| `llms*.txt`, doctor README | checks run via `Promise.allSettled` | `Promise.all` over per-check `.catch(...)` (`src/plugins/doctor/api.ts`). Same behaviour: one rejected check becomes a `fail` row |
| `llms.txt` "Config validation" list | a shorter list | `validate.ts` also checks `app.version`, `app.buildNumber`, the Android env-var names, the deep-link scheme shape, `projectDir` and `outDir` |
| `llms*.txt`, root README | `tauri` is "Standard tier" | `src/plugins/tauri/index.ts` JSDoc: "Complex tier (flat layout)" |

Config fields, defaults, events and all other method names in `llms.txt` match the source.

## A standalone `@moku-labs/core` framework — a packager, not a runtime

`@moku-labs/native` is its **own** Moku framework: `createCoreConfig("native")` in `src/config.ts`, one
`createCore` with five default plugins in `src/index.ts`, and an **exported `createApp`**. It is **Node-only**
and ships nothing inside the packaged app: it generates a Tauri 2 project into `projectDir`, codegens the
packaging surface from `config.system`, runs `@tauri-apps/cli`, and copies installers to `outDir/<target>/`.
A Layer-3 project runs it as a **second `createApp`** (`src/native.ts`) beside its web app (I1). For the
app-shape rubric, load the `moku:moku-core` skill with the Skill tool and read `references/moku-idioms.md`
under the base directory it prints.

**Entry points:** one, `@moku-labs/native` (`.`). `import` → `dist/index.mjs` + `index.d.mts`; `require` →
`dist/index.cjs` + `index.d.cts`. No sub-path exports.

> **Changes 0.2.2 → 0.3.15** (verified in source; no API removals or renames):
> - 0.3.0: first iOS build works (the runner rewrite no longer eats the quote that opens the pbxproj `shellScript`). New
>   `app.orientation` and `app.backgroundColor`. iOS safe-area hook in `lib.rs`. New registry rows `back`
>   and `haptics`. Generated `Cargo.toml` pins `tauri = "2.12"` plus an iOS-only `objc2 = "0.6"` table.
>   Phase durations use a monotonic clock.
> - 0.3.1: first Android build works. The Android required file is `settings.gradle` (was
>   `settings.gradle.kts`), and the runner rewrite also handles `BuildTask.kt`. Android status-bar icons
>   follow `app.backgroundColor`.
> - 0.3.2: `@moku-labs/core` and `@moku-labs/common` are peer dependencies.
> - 0.3.3: the doctor check `web-script` reads only `<pm> run <script>` and `<pm> <script>` as a script. A
>   direct command, such as the `bun` + `moku-game` call `@moku-labs/game` passes, is not checked.
> - 0.3.4 to 0.3.8: CI and dev dependencies only (a patch release on every merge to `main`, Dependabot,
>   development on Bun 1.4.3). No `src/`, docs or peer range change.
> - 0.3.9: `shell` capability (the Android page bridge, §7). `BuildFlavor.debug` and `BuildProfile`, Android only.
>   `app.adaptiveIconInset`. A store build whose page carries the editor agent is refused. Doctor checks
>   `android-platform` and `android-debug-signing`. `project.patchMobileIcons`, `detectPageAgent`,
>   `checkShellLinked`, `getDebugKeystore`. The generated iOS minimum falls back to `15.0`, because Xcode 27 refuses
>   Tauri's 14.0. A `TauriError` message quotes its cause line. Type note: `NativeCompleteEvent.profile`,
>   `BuildResult.profile` and `CapabilityConfigMap.shell` are new **required** fields, so a plugin that emits
>   `native:complete` itself or keeps an exhaustive capability map gets a type error.
> - 0.3.10: the shell writes the system insets as `--moku-device-safe-*`, no longer as inline `--moku-safe-*`.
> - 0.3.11: `app.backgroundColor` also paints the Android window and the Android 12+ icon splash. No new field.
> - 0.3.12: `app.buildNumber` → `bundle.android.versionCode`; `ios.infoPlist`, `ios.privacyManifest`, `PlistValue`;
>   `app.keepScreenOn`; `[profile.release]`; `build.removeUnusedCommands` in the store profile; the iOS pass keeps the
>   deployment target and manifest in `project.yml` and `project.pbxproj`; doctor warns on an unset
>   `keyPasswordEnv` and a missing keystore file. A non-numeric `app.buildNumber` on an android build now stops at generate.
> - 0.3.13: `BuildFlavor.dev` and profile `"dev"`. `debug` works on iOS. The iOS pass outside `debug` removes the
>   two debug keys from a kept `Info.plist`.
> - 0.3.14: `project.setAsideStaleTree`: a kept `gen/android` made for another app id is renamed aside.
> - 0.3.15: the same for `gen/apple`.
>
> Not proven upstream as of the PR notes for 0.3.12 and 0.3.13: a real iPhone, real Apple signing, a device `.ipa`,
> an upload to TestFlight or Play, and whether App Store Connect accepts the manifest as placed.
>
> Earlier breaking changes (0.2.0): flat `web.devCommand` / `web.devUrl`; `tauri.mobileInit({ target })`;
> type-only plugin namespaces; default `targets` is the host desktop target.

## 1. Public exports (`src/index.ts`)

| Kind | Exports |
|------|---------|
| Framework API | `createApp`, `createPlugin` |
| Plugin instances | `projectPlugin`, `tauriPlugin`, `buildPlugin`, `doctorPlugin`, `cliPlugin` |
| Type-only namespaces | `Project`, `Tauri`, `Build`, `Doctor`, `Cli` (each is `export type * as X from "./<name>/types"`) |
| Helpers, constants, runtime class | `hostTargets`, `TARGETS`, `PHASE_ORDER`, `TauriError` |
| Types | `AppleExportMethod`, `AppleSigning`, `BuildFlavor`, `BuildProfile`, `CapabilityConfigMap`, `Config`, `Events`, `MobileTarget`, `NativeCompleteEvent`, `NativePhase`, `NativePhaseEvent`, `Orientation`, `PlistValue`, `SigningConfig`, `Target`, `TauriRunner` |

## 2. App form (v0.3.15)

The five plugins plus core `logPlugin` / `envPlugin` are **defaults** — already wired. `createApp` accepts
`config`, `pluginConfigs`, `plugins` (extra consumer plugins, appended) and `onReady` / `onError` /
`onStart` / `onStop`. ⚠️ `config` is a **shallow merge**: `app`, `web` and `signing` are replaced whole.

```ts
// src/system.ts — shared with the web app (the cross-team contract)
export const systemPlugins = [{ name: "store" }, { name: "deep-link" }];
// src/native.ts — the native createApp, beside the web app
import { createApp } from "@moku-labs/native";
import { systemPlugins } from "./system";
export const native = createApp({
  config: {
    app: { name: "MyApp", identifier: "com.example.myapp", icon: "assets/icon.png",
      orientation: "portrait", backgroundColor: "#10161d" },
    web: { build: "bun run build", devCommand: "bun run dev", devUrl: "http://localhost:5173", dist: "dist" },
    system: systemPlugins,
    capabilities: { "deep-link": { mode: "scheme", scheme: "myapp" } },
    targets: ["macos", "ios"], // default: the host's own desktop target
  },
});

// scripts/native-build.ts — one thin script per verb
await native.start();
await native.cli.build({ target: "macos" }); // installers → dist-native/macos/
await native.stop();
```

`package.json` scripts: `native:dev`, `native:build`, `native:doctor`, `native:clean`, each
`bun run scripts/native-<verb>.ts`. `.gitignore` must carry `.moku/` and `dist-native/`. A consumer plugin uses
this package's `createPlugin` and goes into `plugins`; hooking `doctor:check` needs `depends: [doctorPlugin]`.

## 3. Global config (`src/config.ts` → `Config`, read by every plugin via `ctx.global`)

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `app.name` | `string` | `""` | Required, non-empty. → `productName`, window title, Cargo package slug |
| `app.identifier` | `string` | `""` | Required, reverse-DNS (`/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/i`) |
| `app.version` | `string?` | unset → `"0.1.0"` | `MAJOR.MINOR.PATCH` with optional suffix |
| `app.icon` | `string?` | unset | 1024×1024 PNG, relative to cwd. Unset → placeholder at `<projectDir>/placeholder-icon.png` |
| `app.category`, `app.buildNumber` | `string?` | unset | → `bundle.category`; `/^[\w.]+$/` → `bundle.iOS.bundleVersion` and `bundle.macOS.bundleVersion`. On android also → `bundle.android.versionCode`, a JSON number (0.3.12). Anything but a whole number from 1 to 2100000000 throws at generate, android only |
| `app.orientation` | `Orientation?` (`"portrait" \| "landscape" \| "any"`) | unset = `"any"` | Build-time mobile lock, no runtime lock. iOS `Info.ios.plist`: `portrait` → `UISupportedInterfaceOrientations` [Portrait], `~ipad` [Portrait, PortraitUpsideDown], `UIRequiresFullScreen` true; `landscape` → both [LandscapeLeft, LandscapeRight] + `UIRequiresFullScreen`. Android `android:screenOrientation`: `portrait` / `sensorLandscape`; `any` removes the attribute |
| `app.backgroundColor` | `string?` (`#rrggbb` or `#rrggbbaa`) | unset = platform default | → `app.windows[0].backgroundColor`. Android: patched `MainActivity.kt` `enableEdgeToEdge()` gets light status-bar icons when relative luminance < 0.179, else dark icons. Since 0.3.11 it also writes `res/values/moku_window_background.xml` and marked `android:windowBackground` and `android:windowSplashScreenBackground` items in the app theme, so no dark frame shows before the first paint. Unset restores the bare call and removes those items and the colour file |
| `app.adaptiveIconInset` | `number?` (`0 < n ≤ 30`) | unset | Android adaptive icon inset, percent of the 108 dp canvas per side. Wraps the launcher foreground in an `<inset>`. `19.44` keeps the art inside the 66 dp safe zone. Re-applied on every build by `patchMobileIcons` |
| `app.keepScreenOn` | `boolean?` | unset | iOS: the app turns the idle timer off at launch. Android keeps it on from the page |
| `web.build`, `web.devCommand` | `string` | `"bun run build"`, `"bun run dev"` | → `beforeBuildCommand` / `beforeDevCommand` (script + `cwd`). Tauri runs them; the pipeline has no separate web phase |
| `web.devUrl` | `string` | `"http://localhost:5173"` | → `devUrl`, `DevHandle.url`, readiness-poll target |
| `web.dist` | `string` | `"dist"` | → `frontendDist`, resolved from `web.cwd`, rebased onto `src-tauri` |
| `web.cwd` | `string?` | unset → process cwd | Web package root for monorepos. `doctor` reads `package.json` from here |
| `system` | `ReadonlyArray<{ name: string }>` | `[]` | The composed `@moku-labs/system` plugin names. Unknown name throws at `createApp` |
| `capabilities` | `Partial<CapabilityConfigMap>` | `{}` | Keys: `store`, `notification`, `clipboard-manager`, `tray`, `deep-link`, `back`, `haptics`, `shell`. Only `deep-link` takes parameters: `{ mode: "scheme"; scheme: string }` |
| `targets` | `readonly Target[]` | `hostTargets(process.platform)` | `darwin`→`["macos"]`, `win32`→`["windows"]`, `linux`→`["linux"]`, other→`[]`. Mobile is opt-in |
| `projectDir` | `string` | `".moku/tauri"` | Generated Tauri project (contains `src-tauri/`). Gitignored. Must resolve inside the project or the OS temp root |
| `outDir` | `string` | `"dist-native"` | Delivery root. Refused only if a filesystem root, `$HOME`, or an ancestor of cwd / `$HOME` |
| `signing` | `SigningConfig` | `{}` | Identifiers and env-var **names** only |
| `ios` | `{ infoPlist?: Readonly<Record<string, PlistValue>>; privacyManifest?: string }?` | unset | 0.3.12. `infoPlist` merges into `Info.plist`, after the capabilities and before the orientation lock, which wins a shared key. `privacyManifest` is an **absolute** path; the file lands at the top of the `.app` as `PrivacyInfo.xcprivacy`. Unset removes one an earlier build left |

```ts
type AppleSigning = { teamId?; signingIdentity?; providerShortName?; entitlements?; appStore?: boolean;
  exportMethod?: AppleExportMethod; macosMinimumSystemVersion?; iosMinimumSystemVersion? }; // rest: string
  // iosMinimumSystemVersion: "15.0" when unset (Xcode 27 refuses Tauri's 14.0); MAJOR.MINOR[.PATCH]
type SigningConfig = { apple?: AppleSigning; windows?: { certificateThumbprint?: string };
  android?: { keystorePath?: string; keystorePasswordEnv?: string; keyPasswordEnv?: string; keyAlias?: string } };
type AppleExportMethod = "app-store-connect" | "release-testing" | "debugging";
type BuildFlavor = { simulator?: boolean | undefined; aab?: boolean | undefined;
  debug?: boolean | undefined; dev?: boolean | undefined };
type BuildProfile = "store" | "debug" | "dev"; // the page reads "store" and "dev" as "release"
type PlistValue = string | boolean | readonly PlistValue[] | { readonly [key: string]: PlistValue };
type TauriRunner = { nodePath: string; tauriJsPath: string };
```

Global **Events** (`src/config.ts`; emitted by `build`; hookable by any plugin with no `depends` edge):

| Event | Payload |
|-------|---------|
| `native:phase` | `{ target: Target; phase: NativePhase; status: "start" \| "progress" \| "done" \| "error"; durationMs?: number; detail?: string }` |
| `native:complete` | `{ target: Target; outPath: string; artifacts: readonly string[]; durationMs: number; profile: BuildProfile }` |

Core plugin config seeded by the framework: `env: { providers: [workerSafeProcessEnv()] }`.
⚠️ Overriding `pluginConfigs.env.providers` **replaces** the list. Re-add `workerSafeProcessEnv()` or
`ctx.env.get("PATH")` is `undefined` and `tauri` cannot find `node`. The `env` key is untyped on `createApp`.

## 4. Plugins (5) — summary table with tiers, namespaces and `depends` in §5

### 4.1 `project` — capability registry, generators, guarded clean

**Purpose:** owns the generated tree **as files**. Resolves `config.system` against the registry, writes
the pure artifacts with write-if-changed, gates and patches the mobile `gen/` trees, cleans derived state.
⚠️ Never spawns a process. **Depends:** none. **Config:** none. **State:** none. **Events:** none.

**Lifecycle:** `onInit` → `validateProjectConfig(ctx.global)`. Throws `[native] …` at `createApp` for: empty
`app.name`; invalid `app.identifier`; an empty `web.*` field; invalid `app.version`, `app.buildNumber`,
`app.backgroundColor`, `app.orientation`, `app.adaptiveIconInset`, `signing.apple.iosMinimumSystemVersion` or `signing.android.*Env` (must be env-var **names**); a relative `ios.privacyManifest`; an `ios.infoPlist` value that is not a string, boolean, array or plain object; `projectDir` outside the project; forbidden `outDir`;
unknown `config.system` name; `deep-link` composed without a valid `capabilities["deep-link"].scheme`.

```ts
type Api = {
  generate(opts: { target: Target; profile?: BuildProfile }): Promise<GenerateResult>; // { written, unchanged, skipped }
  getBundleLayout(opts: { target: Target }): BundleLayout;     // { root, formats, genDirectory }
  getCompleteness(opts: { target: Target }): CompletenessResult; // status: "not-applicable" |
    // "not-initialized" | "incomplete" (+ missing: string[]) | "complete"
  setAsideStaleTree(opts: { target: MobileTarget }): Promise<StaleTree | undefined>; // { found, expected, movedTo }
  patchMobile(opts: { target: MobileTarget; runner?: TauriRunner; profile?: BuildProfile }): Promise<PatchResult>; // { patched, unchanged }
  patchMobileIcons(opts: { target: MobileTarget }): Promise<PatchResult>; // the adaptive icon inset; ios: empty
  detectPageAgent(): Promise<PageAgentResult>;                 // { agent, file? }: the editor agent in web.dist .js files
  checkShellLinked(opts: { target: MobileTarget; profile?: BuildProfile }): Promise<void>; // throws when not linked
  getDebugKeystore(): DebugKeystore;                           // { path, createCommand }
  clean(opts?: { target?: Target }): Promise<CleanResult>;     // { removed }
  clearMobileBuildOutput(opts: { target: MobileTarget }): Promise<CleanResult>;
  resolveDerivedPath(target: string): string;                  // comparable real path, for guards only
  ensureIconSource(): Promise<string>;
  resolve<K extends keyof CapabilityConfigMap>(name: K, config?: CapabilityConfigMap[K]): ResolvedCapability;
  isKnownCapability(name: string): name is keyof CapabilityConfigMap;
  getRegistryRows(): ReadonlyArray<RegistryRow>;
  getRequiredFiles(opts: { target: MobileTarget }): readonly string[];
};
```

Generated artifacts (all under `<projectDir>/src-tauri/`):

| File | Content |
|------|---------|
| `tauri.conf.json` | `productName`, `identifier`, `version`, `build.*` from `web` (`removeUnusedCommands: true` in the store profile only), one window (`main`, `backgroundColor` when set, `devtools: true` in an iOS debug build), `bundle` (icons, `category`, `iOS`, `macOS`, `windows`, `android` with `versionCode`), `plugins` |
| `Cargo.toml` | package slug from `app.name`, `tauri = { version = "2.12", features = [...] }` (2.12 floor: `core:app:allow-exit`; `devtools` in an iOS debug build), one pinned crate per plugin-backed capability, a path dependency `tauri-plugin-moku-shell = { path = "../plugins/moku-shell" }` when the shell is composed, a `[target.'cfg(target_os = "ios")'.dependencies]` table with `objc2 = "0.6"`, and `[profile.release]` (`codegen-units = 1`, `lto = true`, `opt-level = "s"`, `panic = "abort"`, `strip = true`) on every target and profile |
| `build.rs`, `src/lib.rs`, `src/main.rs` | `tauri_build::build()`; `.plugin(<rustInit>)` per capability; a `.setup` hook that on iOS sets the `main` WKWebView scroll view's `contentInsetAdjustmentBehavior` to `.never`, so the page is not shrunk by the safe area (tauri-apps/tauri#8166), and with `app.keepScreenOn` turns the idle timer off |
| `capabilities/default.json` | `core:default` + every resolved capability's permissions, scoped to the target platform |
| `Entitlements.plist`, `Info.ios.plist` | Entitlements: only `macos` with `signing.apple.appStore === true` and no `entitlements` (sandbox + network client). `Info.ios.plist`: **always** written for `ios` (an empty `<dict>` when nothing is locked, since the writer never deletes), never for other targets. Carries `ios.infoPlist`, the `app.orientation` keys and, in an iOS debug build, `NSLocalNetworkUsageDescription` and `NSAppTransportSecurity` |

With the shell composed, the crate is also generated at `<projectDir>/plugins/moku-shell/`, outside `src-tauri/`.

Gotchas:
- Only `deep-link` writes a `plugins.<name>` key into `tauri.conf.json`. An empty `{}` under another
  plugin's key aborts the app at startup, so empty fragments are dropped.
- The writer refuses paths outside `projectDir` or through `target`, `.gradle`, `DerivedData`, `Pods`.
- Required files — `gen/apple`: `project.yml`, `Assets.xcassets`, `Sources`, `ExportOptions.plist`;
  `gen/android`: `build.gradle.kts`, `settings.gradle` (Groovy, since 0.3.1; was `settings.gradle.kts`),
  `gradle.properties`, `app/build.gradle.kts`, `app/src/main/AndroidManifest.xml`.
- `patchMobile` is idempotent. iOS, in order: `CODE_SIGN_ALLOW_ENTITLEMENTS_MODIFICATION` in the pbxproj and
  `project.yml`; the deployment target (`iosMinimumSystemVersion ?? "15.0"`) and the privacy manifest in both
  files, because `tauri ios build` never reruns xcodegen on a kept tree (0.3.12); outside `debug`, removing the two debug
  keys from `<slug>_iOS/Info.plist` (0.3.13); then the runner rewrite to the absolute `<node> <tauri.js>` pair (0.3.0 fixed the rewrite
  that swallowed the quote opening the pbxproj `shellScript` and broke the first iOS build). Android, in order: the
  profile patches (`debug`: the `// MOKU-PROFILE-START … END` block with `applicationIdSuffix = ".debug"`, the `(debug)` name,
  a cleartext `network_security_config.xml`; `store` and `dev`: all reverted byte for byte); the
  `// MOKU-SIGNING-START … END` block in `app/build.gradle.kts` (passwords via `System.getenv`; the SDK debug keystore in `debug`); the main
  `<activity>` attributes in `AndroidManifest.xml` (`android:screenOrientation`); the `MainActivity.kt`
  `enableEdgeToEdge()` status-bar style from `app.backgroundColor`; the window and splash colour (0.3.11); then the runner rewrite, including
  the Kotlin `BuildTask.kt` `executable` + `listOf(...)` shape. It throws when the Android `gen/` tree or
  `AndroidManifest.xml` is missing, when a colour is set but there is not exactly one
  `MainActivity.kt` calling `enableEdgeToEdge()`, when a colour is set but the manifest names no `@style/` theme or the
  day `themes.xml` lacks it, when `debug` finds no debug keystore (with the `keytool` command), and when
  `ios.privacyManifest` names no file or `project.yml` or the pbxproj lacks a line a patch needs.
- `setAsideStaleTree` reads `applicationId` from `gen/android/app/build.gradle.kts` (0.3.14) or
  `PRODUCT_BUNDLE_IDENTIFIER` from `gen/apple/project.yml` (0.3.15). When it is not `app.identifier`, the tree is renamed to
  `gen/<platform>.old-<old id>` (`-2`, `-3` when taken), **never deleted**, with one warn line. The same id (also `_` vs `-`),
  a missing tree and an unreadable id give `undefined` and keep the tree. The fresh tree does not carry over a hand edit or keystore from the old one.
- `detectPageAgent` scans the `.js` files of `<web.cwd ?? .>/<web.dist>` for `"/__editor/hello"` and `"[moku-editor]"`. A missing dist is no agent.
- ⚠️ `clean()` with no target deletes the whole `projectDir`; a mobile target deletes `gen/<platform>`; a
  desktop target deletes its `bundle/<format>` directories. It refuses a `projectDir` that is not strictly
  inside the project anchor (nearest `.git` or `workspaces` ancestor) or the OS temp root. Symlinks are
  resolved first. `clearMobileBuildOutput` removes `gen/apple/build` for `ios`, nothing for `android`.

### 4.2 `tauri` — the only `@tauri-apps/cli` subprocess seam

**Purpose:** argv builders, injectable spawn, process-group dev lifecycle, compile-tick parsing, error
taxonomy, secret scrubbing. ⚠️ No other plugin spawns `@tauri-apps/cli`. **Depends:** none.
**Events:** none. **State:** `{ dev: DevHandle | undefined }`. **Lifecycle:** no `onStop` by design —
teardown is owned by the dev seam (SIGINT / SIGTERM handlers + `DevHandle.stop()`).

| Config field | Type | Default | Purpose |
|--------------|------|---------|---------|
| `spawnImpl` | `SpawnFn \| undefined` | `undefined` | Test seam. Real = detached process-group spawn (SIGTERM, 2000 ms grace, then SIGKILL) |
| `nodePath` | `string \| undefined` | `undefined` | Explicit `node`. Real = PATH walk. Never `process.execPath` (that is Bun) |
| `arch` | `NodeJS.Architecture \| undefined` | `undefined` | Host arch for the iOS simulator slice. Real = `process.arch` |
| `readiness` | `{ intervalMs: number; timeoutMs: number }` | `{ intervalMs: 250, timeoutMs: 60_000 }` | `dev()` poll of `web.devUrl` |

```ts
type Api = {
  icon(opts: { source: string }): Promise<RunResult>;          // → <projectDir>/src-tauri/icons
  build(opts: BuildOptions): Promise<RunResult>;
  mobileInit(opts: { target: MobileTarget }): Promise<RunResult>;
  dev(opts: { target?: Target; onOutput?: (line: string) => void }): Promise<DevHandle>;
  getVersion(): Promise<{ cliVersion: string } | undefined>;   // undefined = CLI not invokable; never throws
  getRunner(): TauriRunner;                                    // { nodePath, tauriJsPath }
};
type BuildOptions = BuildFlavor & { target: Target; exportMethod?: AppleExportMethod;
  onTick?: (tick: CompileTick) => void; onOutput?: (line: string) => void;
  env?: Readonly<Record<string, string>> }; // merged over the inherited env; never changes the argv
type RunResult = { code: 0; stdout: string; stderr: string; durationMs: number }; // non-zero exit throws
type CompileTick = { crate: string; index?: number; total?: number };              // real cargo counts
type DevHandle = { url: string; ready: Promise<void>; exited: Promise<DevExit>; stop(): Promise<void> };
```

Build argv per target is in §8. Other verbs, after `<node> <tauri.js>`: `dev --ci` (desktop), `ios dev` /
`android dev`, `<target> init --ci`, `icon <source> --output <dir>`, `info` (for `getVersion`).

`TauriError extends Error`: `kind`, `exitCode: number | null`, `stderrTail` (already scrubbed). `kind` is
`"toolchain-missing" | "platform-missing" | "config-invalid" | "compile-failed" | "xcode-script-failed" |
"signing-failed" | "device-unavailable" | "cancelled" | "unknown"`. Since 0.3.9 the message quotes the cause line
between the bucket and the advice.

Gotchas:
- Every output line passes `scrub()` first. Masked as `[native:scrubbed]`: assignments to `APPLE_PASSWORD*`,
  `APPLE_CERTIFICATE*`, `APPLE_API_KEY*`, `APPLE_API_ISSUER*`, `TAURI_SIGNING_*`,
  `ANDROID_KEYSTORE_PASSWORD*`, `ANDROID_KEY_PASSWORD*`; URL userinfo; long hex runs; tokens of 20+ chars
  above 4 bits/char entropy. Paths are judged part by part, so build paths stay readable.
- A second live `dev()` rejects (`[native] tauri dev already running.`). `mobileInit` is not idempotent:
  gate it on `project.getCompleteness({ target })`.

### 4.3 `build` — the per-target phase pipeline

**Purpose:** orchestrates `project` and `tauri` (they never call each other) and owns the `collect` phase.
**Depends:** `[projectPlugin, tauriPlugin]`, resolved once via `ctx.require`. **Config:** none.
**State:** none. **Events:** emits the global `native:phase` and `native:complete`. **Lifecycle:** none.

```ts
type Api = {
  prepare(opts: { target: Target; debug?: boolean }): Promise<void>;         // scaffold + codegen + icons
  run(opts: BuildFlavor & { target: Target }): Promise<BuildResult>;
  runAll(opts?: BuildFlavor & { targets?: readonly Target[] }): Promise<readonly BuildResult[]>;
};
type BuildResult = { target: Target; outPath: string; artifacts: readonly string[];
  durationMs: number; phases: readonly PhaseTiming[]; // always six { phase, durationMs } entries
  profile: BuildProfile };
```

Build profiles. All three are release builds (no `--debug` on the argv):

| Profile | Flag | Targets | Delivered to | Differs from `store` |
|---------|------|---------|--------------|----------------------|
| `store` | none | all | `<outDir>/<target>/` | Sets `removeUnusedCommands`. A page with the editor agent is refused |
| `debug` | `debug: true` | android (0.3.9), ios (0.3.13) | `<outDir>/<target>-debug/` | Android: `.debug` id, `(debug)` name, SDK debug keystore, cleartext, page console in logcat tag `moku-page`, WebView debugging, `share`, and `shell` composed even when unnamed. iOS: native renames nothing, the config names the app; adds the local-network keys and `devtools`. Agent allowed |
| `dev` | `dev: true` | all | `<outDir>/<target>/` | Same signing, `.aab`, `exportMethod`. Agent allowed. No `removeUnusedCommands`. The config names the test app (id, name, icon, `projectDir`, `outDir`); native renames nothing |

The web build reads the profile from `MOKU_NATIVE_PROFILE` (`store`, `debug` or `dev`).

Gotchas:
- `debug` with `dev` throws `[native] debug and dev cannot be combined.` before any phase. `debug` on a desktop
  target throws `[native] --debug builds Android and iOS only for now (asked for <target>).` `runAll` checks up front
  and refuses the whole run.
- A store build with the agent fails after compile, before collect: `[native] store build refused: the page carries
  the editor agent (<dist>/<file>).` and `Build with debug: true.`
- `runAll` defaults to `config.targets`. It is sequential (one shared Cargo `target/` lock) and stops at
  the first failing target. No partial continue.
- A failed phase emits `native:phase` with `status: "error"`, then rethrows. Later phases never start.
- `collect` throws `[native] No <target> installer artifacts found.` on zero matches. It deletes each
  destination before copying, and refuses any destination whose real path is outside `<outDir>/<target>`.

### 4.4 `doctor` — parallel toolchain diagnosis

**Purpose:** per-target and host checks from a `checks/` registry. **Depends:** `[projectPlugin,
tauriPlugin]`. **State:** none. **Events:** declares and emits `doctor:check` (payload `CheckResult`),
once per check as it settles. Hooking it needs `depends: [doctorPlugin]`.

**Config:** `probeImpl?: ProbeFn | undefined` (default `undefined`; test seam, real = `child_process.spawn`
probes such as `node --version`, `rustup target list --installed`, `xcodebuild -version`, `java -version`)
and `probeTimeoutMs: number` (default `10_000`; per-check budget, a timeout is a `warn`).

```ts
type Api = { run(opts?: { target?: Target }): Promise<DoctorReport> };
type DoctorReport = { ok: boolean; checks: readonly CheckResult[] }; // ok = no "fail"
type CheckResult = { id: string; target: Target | "host"; status: "pass" | "warn" | "fail"; message: string; fixIt?: string };
```

`run()` checks every `config.targets` entry plus `"host"`; `run({ target })` checks that target only. It
never throws on a failed check: a rejected check becomes a `fail` row with an internal-error message.

| Check id | Applies to | Worst status | What it checks |
|----------|-----------|--------------|----------------|
| `node-binary`, `tauri-cli` | host | fail | A real `node` on PATH; `tauri.getVersion()` answers |
| `rustup-targets` | each target | fail | The target's Rust triple is installed |
| `xcode-toolchain` | ios (darwin host) | fail | `xcodebuild -version`, simulator list |
| `ios-tools` | ios (darwin host) | fail | `xcodegen`, `pod`, both iOS Rust triples |
| `ios-platform` | ios (darwin host) | warn | Installed iOS SDK and simulator runtime |
| `android-toolchain` | android | fail | `ANDROID_HOME` or `ANDROID_SDK_ROOT`, `ANDROID_NDK_HOME`, a working `java` |
| `android-platform` | android | fail | 0.3.9. The `compileSdk` SDK platform is installed; a stale `ANDROID_HOME` fails. Fix-it `sdkmanager "platforms;android-N"` |
| `android-debug-signing` | android | warn | 0.3.9. The SDK debug keystore a debug build signs with. Fix-it: the `keytool` command |
| `signing-<target>` | ios, macos, android, windows | warn | Env-var **presence** and identity **count**, never values. Android, 0.3.12: also an unset `keyPasswordEnv` var and a missing `keystorePath` file |
| `gen-completeness-<target>` | ios, android | fail | `incomplete` fails; `not-initialized` passes (init runs on first build) |
| `tauri-version-skew` | host | warn | `@tauri-apps/*` npm major vs the registry crate range |
| `web-script` | host | fail | `web.build` / `web.devCommand` scripts exist in `<web.cwd>/package.json`: only `<pm> run <script>` and `<pm> <script>` name one; a direct command passes unchecked (0.3.3). Not executed |
| `cross-repo-cors`, `cross-repo-deep-link-well-known` | host (the second only when `deep-link` is composed) | warn (always) | Pointers. Packaged API calls originate from `tauri://localhost` and `http://tauri.localhost`: add both to the worker CORS allowlist. Universal links would need `.well-known` files (deferred in v1) |

### 4.5 `cli` — typed verbs, branded output

**Purpose:** the verb surface the per-verb scripts call. Every verb is a thin delegate. ⚠️ No argv parsing.
**Depends:** `[projectPlugin, tauriPlugin, buildPlugin, doctorPlugin]`. **Events:** none declared.
**Hooks:** `native:phase`, `native:complete`, `doctor:check` (live rendering). **State:** `{ ui: BrandConsole;
progress }`. **Lifecycle:** `onInit` clears the default log sinks and adds a branded sink (threshold `info`).

**Config:** `renderImpl?: (line: string) => void` and `confirmImpl?: (question: string) => Promise<boolean>`,
both default `undefined` (test seams; real = branded console and styled confirm from `@moku-labs/common/cli`).

| `Api` method | Behaviour |
|--------------|-----------|
| `build(opts?: BuildFlavor & { target?: Target; all?: boolean }): Promise<void>` | `all: true` → `build.runAll`. Else `build.run` for `target` (default: the host desktop target; throws `[native] No default packaging target …` on a host that is not darwin / win32 / linux, same for `dev`). `simulator`, `aab`, `debug` and `dev` pass through. A debug delivery's panel reads `debug build → <outPath>`. On failure prints the scrubbed `stderrTail`, then rethrows |
| `dev(opts?: { target?: Target }): Promise<void>` | `build.prepare` → `tauri.dev` → awaits `ready`, then `exited`. A signal exit (`code: null`, Ctrl-C) resolves. A numeric non-zero code throws |
| `doctor(opts?: { target?: Target }): Promise<boolean>` | `doctor.run` → summary → returns `report.ok`. The caller sets `process.exitCode` |
| `clean(opts?: { target?: Target }): Promise<void>` | No target → confirm-gated full wipe of `projectDir`; declining resolves without deleting. With a target → `project.clean({ target })`, no confirm |

## 5. Dependency graph

| # | Plugin | Tier (source JSDoc) | `depends` | Namespace | Events |
|---|--------|---------------------|-----------|-----------|--------|
| 1 | `projectPlugin` | Complex | — | `app.project` | none |
| 2 | `tauriPlugin` | Complex (flat layout) | — | `app.tauri` | none |
| 3 | `buildPlugin` | Standard | project, tauri | `app.build` | emits `native:phase`, `native:complete` |
| 4 | `doctorPlugin` | Complex | project, tauri | `app.doctor` | declares + emits `doctor:check` |
| 5 | `cliPlugin` | Standard | project, tauri, build, doctor | `app.cli` | hooks all three |

Core `log` + `env` (`@moku-labs/common`) are on every `ctx`. `project` and `tauri` never call each other;
`build` orchestrates them, `doctor` reads them, `cli` fronts all four. Init order = the plugin array above.

## 6. Build pipeline phases (`PHASE_ORDER`; `build.prepare` = phases 1–3)

| # | Phase | Owner | What happens |
|---|-------|-------|--------------|
| 1 | `scaffold` | build | `mkdir -p projectDir` |
| 2 | `codegen` | build → project, tauri | `project.generate({ target, profile })`. Mobile only: `project.setAsideStaleTree`; `tauri.mobileInit` when `not-initialized`; throw when `incomplete`; then `project.patchMobile({ target, runner: tauri.getRunner(), profile })` |
| 3 | `icons` | build → project, tauri | `project.ensureIconSource` → `tauri.icon`. Skipped (`detail: "up to date"`) when `icons/icon.png` exists, the `icons/.source` stamp matches, and `mobileInit` did not just run. Else `"generated"` or `"placeholder"`. Then on android `project.patchMobileIcons`, on every build |
| 4 | `compile` | build → tauri | iOS first clears `gen/apple/build`. Then one `tauri.build` subprocess with `env: { MOKU_NATIVE_PROFILE: profile }`. Cargo ticks become `progress` events (`Compiling <crate> 3/50`) |
| 5 | `bundle` | build → project, tauri | Same subprocess. Opens at the first output line matching `/bundling/i`. A failure belongs to the open phase. At the end: on android `project.checkShellLinked`, then `project.detectPageAgent` and the store refusal |
| 6 | `collect` | build | Globs the bundle layout, keeps the newest match per file name, copies to `<outDir>/<target>/` (`<target>-debug/` in `debug`), then emits `native:complete` |

## 7. Capability registry (`config.system` name → what it resolves to)

| System plugin | Crate (`^2`) / npm (`^2`) | Rust init | Permissions | Platforms | Conf |
|---------------|---------------------------|-----------|-------------|-----------|------|
| `store` | `tauri-plugin-store` / `@tauri-apps/plugin-store` | `tauri_plugin_store::Builder::default().build()` | `store:default` | all five | — |
| `notification` | `tauri-plugin-notification` / `@tauri-apps/plugin-notification` | `tauri_plugin_notification::init()` | `notification:default` | all five | — |
| `clipboard-manager` | `tauri-plugin-clipboard-manager` / `@tauri-apps/plugin-clipboard-manager` | `tauri_plugin_clipboard_manager::init()` | `clipboard-manager:allow-read-text`, `clipboard-manager:allow-write-text` | all five | — |
| `tray` | none — cargo feature `tray-icon` on `tauri` | none | `core:tray:default`, `core:menu:default`, `core:image:default`, `core:resources:default`, `core:app:allow-default-window-icon` | macos, windows, linux | — |
| `deep-link` | `tauri-plugin-deep-link` / `@tauri-apps/plugin-deep-link` | `tauri_plugin_deep_link::init()` | `deep-link:default` | all five | `{ desktop: { schemes: [s] }, mobile: [{ scheme: [s], appLink: false }] }` |
| `back` | none — `onBackButtonPress` / `exit` ship in `@tauri-apps/api/app` | none | `core:app:allow-exit` | android | — |
| `haptics` | `tauri-plugin-haptics` / `@tauri-apps/plugin-haptics` | `tauri_plugin_haptics::init()` | `haptics:allow-impact-feedback`, `haptics:allow-notification-feedback`, `haptics:allow-selection-feedback`, `haptics:allow-vibrate` (no default set) | ios, android | — |
| `shell` | generated local crate `tauri-plugin-moku-shell` at `plugins/moku-shell`, linked by path; no npm package | `tauri_plugin_moku_shell::init()` | `moku-shell:default` | android | — |

A row is applied to a target only when its `platforms` list includes it, so `tray` is dropped from `ios`
and `android` builds, and `back` / `haptics` from desktop, and `shell` from everything but android. `deep-link` is custom-scheme only (no universal
links). Official Tauri plugins merge their own `AndroidManifest.xml` permissions (haptics merges `VIBRATE`
itself), so no permission XML is patched. Outside the debug profile, the only manifest edits are presentation: the orientation
attribute and the status-bar style (§4.1). The debug profile also sets `android:networkSecurityConfig`.

### The page bridge (`shell`, since 0.3.9)

An init script runs before page scripts, in the main frame, and installs a frozen `globalThis.__MOKU_NATIVE__`. A
browser, iOS or an app without the shell has none. The iOS shell is deferred.

```ts
type MokuNative = {
  version: 1; platform: "android";
  build: { profile: "debug" | "release"; id: string }; // "<app.version>+<app.buildNumber ?? 0>", "-debug" suffix in debug
  device: { model: string; manufacturer: string; sdk: number } | null; // null until `ready`
  ready: Promise<void>;                                // never rejects
  display: { maxHz: number | null; setFrameRate(fps: number | null): Promise<{ panelHz: number | null; maxHz: number | null }> };
  thermal: { read(): Promise<{ status: "none" | "light" | "moderate" | "severe" | "critical" | "emergency" | "shutdown";
    headroom: number | null; at: number; android?: { status: number; headroom: number | null; forecastSeconds: 10 } }> };
  insets: { readonly current: { top: number; right: number; bottom: number; left: number } }; // CSS px
  share?(file: { name: string; mime: string; bytes: Uint8Array }): Promise<{ shared: boolean }>; // debug only, ≤ 32 MiB
};
```

Insets also land as `--moku-device-safe-top|right|bottom|left` on the root's `style` (0.3.10; 0.3.9 wrote inline
`--moku-safe-*`, which beat a page's own rule). Read `var(--moku-safe-top, var(--moku-device-safe-top,
env(safe-area-inset-top)))`. `window` gets `moku-native:insets` and, on a thermal status change, `moku-native:thermal`.
`checkShellLinked` fails a build when the shell is composed but `gen/android/tauri.settings.gradle` does not name
`moku-shell`, a tree initialised before the shell existed. Fix: clean android and rebuild.

## 8. Targets and artifacts (`TARGETS`)

| Target | `tauri` argv | Build output (under `<projectDir>/src-tauri/`) | Collected into `<outDir>/<target>/` |
|--------|--------------|-----------------------------------------------|--------------------------------------|
| `macos` | `build --ci` | `target/release/bundle/{dmg,macos}` | `*.dmg`, `*.app` |
| `windows` | `build --ci` | `target/release/bundle/{nsis,msi}` | `*-setup.exe`, `*.msi` |
| `linux` | `build --ci` | `target/release/bundle/{appimage,deb,rpm}` | `*.AppImage`, `*.deb`, `*.rpm` |
| `ios` | `ios build --ci` + `--export-method <m>` when `signing.apple.exportMethod` is set | `gen/apple/build/` | `**/*.ipa` |
| `ios`, `simulator: true` | `ios build --ci --target aarch64-sim` (`x86_64` on an `x64` host); never `--export-method` | `gen/apple/build/{*-sim,x86_64}/` | the unsigned `.app` directory |
| `android` | `android build --ci --apk`; `aab: true` → `--aab` | `gen/android/app/build/outputs/` | release `*.apk`, or release `*.aab` |

`debug` and `dev` do not change the argv. A debug build collects the same release patterns into `<outDir>/<target>-debug/`.

Unsigned dev and iOS simulator builds need no credentials. Secrets stay in the environment; Tauri and Gradle
read them: `APPLE_ID` + `APPLE_PASSWORD` + `APPLE_TEAM_ID`, or `APPLE_API_KEY` + `APPLE_API_ISSUER` +
`APPLE_API_KEY_PATH`; `APPLE_CERTIFICATE` + `APPLE_CERTIFICATE_PASSWORD`; the vars named in `signing.android`.
