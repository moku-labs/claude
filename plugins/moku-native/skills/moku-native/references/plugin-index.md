# @moku-labs/native — Plugin & Property Index

**Synced version:** `0.2.2` (npm `dist-tags.latest`; catalog generated from the `v0.2.2` git tag **source**,
cross-checked against the root README and `llms.txt` / `llms-full.txt`). Dependencies, all regular (no peer
dependencies): `@moku-labs/core@1.6.0` and `@moku-labs/common@0.3.2` as **exact pins**, plus
`@tauri-apps/cli@^2`. One `bun add @moku-labs/native` is the whole install. Engines node ≥24, bun ≥1.3.14.

⚠️ Places where the upstream docs are **stale versus the `v0.2.2` source** (the source wins):

| Doc | Says | Source says |
|-----|------|-------------|
| `llms-full.txt:11` | `Version: 0.1.0` | `package.json` → `0.2.2` |
| `llms-full.txt:917`, `llms.txt:81` | `Pick<TauriApi, "version">`; "gate on `completeness()` first" | `Pick<TauriApi, "getVersion">` (`src/plugins/doctor/checks/types.ts`); `project.getCompleteness({ target })` |
| Root `README.md` plugin table | `completeness`, `version`, `runner` | `getCompleteness`, `getVersion`, `getRunner` (`src/plugins/{project,tauri}/types.ts`) |
| `llms.txt` quick reference, `project` list | omits two methods | `Api` also has `getBundleLayout` and `resolveDerivedPath` |
| `llms*.txt`, doctor README | checks run via `Promise.allSettled` | `Promise.all` over per-check `.catch(...)` (`src/plugins/doctor/api.ts`). Same behaviour: one rejected check becomes a `fail` row |
| `llms.txt` "Config validation" list | 4 kinds of error | `validate.ts` also checks `app.version`, `app.buildNumber`, the Android env-var names, the deep-link scheme shape, `projectDir` and `outDir` |
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

> ⚠️ **Breaking changes the upstream README lists for this release** (verified in source): flat
> `web.devCommand` / `web.devUrl` (was `web.dev.command` / `.url`); `tauri.mobileInit({ target })` (was
> `{ platform }`); the plugin namespaces are **type-only**, import `TauriError` by name; default `targets`
> is the host desktop target, not all five; `RegistryRow.npmPackage` / `crate` / `rustInit` are optional.

## 1. Public exports (`src/index.ts`)

| Kind | Exports |
|------|---------|
| Framework API | `createApp`, `createPlugin` |
| Plugin instances | `projectPlugin`, `tauriPlugin`, `buildPlugin`, `doctorPlugin`, `cliPlugin` |
| Type-only namespaces | `Project`, `Tauri`, `Build`, `Doctor`, `Cli` (each is `export type * as X from "./<name>/types"`) |
| Helpers, constants, runtime class | `hostTargets`, `TARGETS`, `PHASE_ORDER`, `TauriError` |
| Types | `AppleExportMethod`, `AppleSigning`, `BuildFlavor`, `CapabilityConfigMap`, `Config`, `Events`, `MobileTarget`, `NativeCompleteEvent`, `NativePhase`, `NativePhaseEvent`, `SigningConfig`, `Target`, `TauriRunner` |

## 2. App form (v0.2.2)

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
    app: { name: "MyApp", identifier: "com.example.myapp", icon: "assets/icon.png" },
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
| `app.category`, `app.buildNumber` | `string?` | unset | → `bundle.category`; `/^[\w.]+$/` → `bundle.iOS.bundleVersion` and `bundle.macOS.bundleVersion` |
| `web.build`, `web.devCommand` | `string` | `"bun run build"`, `"bun run dev"` | → `beforeBuildCommand` / `beforeDevCommand` (script + `cwd`). Tauri runs them; the pipeline has no separate web phase |
| `web.devUrl` | `string` | `"http://localhost:5173"` | → `devUrl`, `DevHandle.url`, readiness-poll target |
| `web.dist` | `string` | `"dist"` | → `frontendDist`, resolved from `web.cwd`, rebased onto `src-tauri` |
| `web.cwd` | `string?` | unset → process cwd | Web package root for monorepos. `doctor` reads `package.json` from here |
| `system` | `ReadonlyArray<{ name: string }>` | `[]` | The composed `@moku-labs/system` plugin names. Unknown name throws at `createApp` |
| `capabilities` | `Partial<CapabilityConfigMap>` | `{}` | Only `deep-link` takes parameters: `{ mode: "scheme"; scheme: string }` |
| `targets` | `readonly Target[]` | `hostTargets(process.platform)` | `darwin`→`["macos"]`, `win32`→`["windows"]`, `linux`→`["linux"]`, other→`[]`. Mobile is opt-in |
| `projectDir` | `string` | `".moku/tauri"` | Generated Tauri project (contains `src-tauri/`). Gitignored. Must resolve inside the project or the OS temp root |
| `outDir` | `string` | `"dist-native"` | Delivery root. Refused only if a filesystem root, `$HOME`, or an ancestor of cwd / `$HOME` |
| `signing` | `SigningConfig` | `{}` | Identifiers and env-var **names** only |

```ts
type AppleSigning = { teamId?; signingIdentity?; providerShortName?; entitlements?; appStore?: boolean;
  exportMethod?: AppleExportMethod; macosMinimumSystemVersion?; iosMinimumSystemVersion? }; // rest: string
type SigningConfig = { apple?: AppleSigning; windows?: { certificateThumbprint?: string };
  android?: { keystorePath?: string; keystorePasswordEnv?: string; keyPasswordEnv?: string; keyAlias?: string } };
type AppleExportMethod = "app-store-connect" | "release-testing" | "debugging";
type BuildFlavor = { simulator?: boolean | undefined; aab?: boolean | undefined };
type TauriRunner = { nodePath: string; tauriJsPath: string };
```

Global **Events** (`src/config.ts`; emitted by `build`; hookable by any plugin with no `depends` edge):

| Event | Payload |
|-------|---------|
| `native:phase` | `{ target: Target; phase: NativePhase; status: "start" \| "progress" \| "done" \| "error"; durationMs?: number; detail?: string }` |
| `native:complete` | `{ target: Target; outPath: string; artifacts: readonly string[]; durationMs: number }` |

Core plugin config seeded by the framework: `env: { providers: [workerSafeProcessEnv()] }`.
⚠️ Overriding `pluginConfigs.env.providers` **replaces** the list. Re-add `workerSafeProcessEnv()` or
`ctx.env.get("PATH")` is `undefined` and `tauri` cannot find `node`. The `env` key is untyped on `createApp`.

## 4. Plugins (5) — summary table with tiers, namespaces and `depends` in §5

### 4.1 `project` — capability registry, generators, guarded clean

**Purpose:** owns the generated tree **as files**. Resolves `config.system` against the registry, writes
the pure artifacts with write-if-changed, gates and patches the mobile `gen/` trees, cleans derived state.
⚠️ Never spawns a process. **Depends:** none. **Config:** none. **State:** none. **Events:** none.

**Lifecycle:** `onInit` → `validateProjectConfig(ctx.global)`. Throws `[native] …` at `createApp` for: empty
`app.name`; invalid `app.identifier`; an empty `web.*` field; invalid `app.version`, `app.buildNumber` or
`signing.android.*Env` (must be env-var **names**); `projectDir` outside the project; forbidden `outDir`;
unknown `config.system` name; `deep-link` composed without a valid `capabilities["deep-link"].scheme`.

```ts
type Api = {
  generate(opts: { target: Target }): Promise<GenerateResult>; // { written, unchanged, skipped }
  getBundleLayout(opts: { target: Target }): BundleLayout;     // { root, formats, genDirectory }
  getCompleteness(opts: { target: Target }): CompletenessResult; // status: "not-applicable" |
    // "not-initialized" | "incomplete" (+ missing: string[]) | "complete"
  patchMobile(opts: { target: MobileTarget; runner?: TauriRunner }): Promise<PatchResult>; // { patched, unchanged }
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
| `tauri.conf.json` | `productName`, `identifier`, `version`, `build.*` from `web`, one window, `bundle` (icons, `category`, `iOS`, `macOS`, `windows`, `android`), `plugins` |
| `Cargo.toml` | package slug from `app.name`, `tauri = { version = "2", features = [...] }`, one pinned crate per plugin-backed capability |
| `build.rs`, `src/lib.rs`, `src/main.rs` | `tauri_build::build()`; `.plugin(<rustInit>)` per capability |
| `capabilities/default.json` | `core:default` + every resolved capability's permissions, scoped to the target platform |
| `Entitlements.plist`, `Info.ios.plist` | Conditional. Entitlements: only `macos` with `signing.apple.appStore === true` and no `entitlements` (sandbox + network client). The iOS sidecar: only when a capability carries plist entries; every v1 row carries none, so v1 never writes it |

Gotchas:
- Only `deep-link` writes a `plugins.<name>` key into `tauri.conf.json`. An empty `{}` under another
  plugin's key aborts the app at startup, so empty fragments are dropped.
- The writer refuses paths outside `projectDir` or through `target`, `.gradle`, `DerivedData`, `Pods`.
- Required files — `gen/apple`: `project.yml`, `Assets.xcassets`, `Sources`, `ExportOptions.plist`;
  `gen/android`: `build.gradle.kts`, `settings.gradle.kts`, `gradle.properties`, `app/build.gradle.kts`,
  `app/src/main/AndroidManifest.xml`.
- `patchMobile` is idempotent. iOS: `CODE_SIGN_ALLOW_ENTITLEMENTS_MODIFICATION` in the pbxproj and
  `project.yml`, plus the runner rewrite to the absolute `<node> <tauri.js>` pair. Android: the
  `// MOKU-SIGNING-START … END` block in `app/build.gradle.kts` (passwords via `System.getenv`), plus
  the runner rewrite. It throws when the Android `gen/` tree is missing.
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
  onTick?: (tick: CompileTick) => void; onOutput?: (line: string) => void };
type RunResult = { code: 0; stdout: string; stderr: string; durationMs: number }; // non-zero exit throws
type CompileTick = { crate: string; index?: number; total?: number };              // real cargo counts
type DevHandle = { url: string; ready: Promise<void>; exited: Promise<DevExit>; stop(): Promise<void> };
```

Build argv per target is in §8. Other verbs, after `<node> <tauri.js>`: `dev --ci` (desktop), `ios dev` /
`android dev`, `<target> init --ci`, `icon <source> --output <dir>`, `info` (for `getVersion`).

`TauriError extends Error`: `kind`, `exitCode: number | null`, `stderrTail` (already scrubbed). `kind` is
`"toolchain-missing" | "platform-missing" | "config-invalid" | "compile-failed" | "xcode-script-failed" |
"signing-failed" | "device-unavailable" | "cancelled" | "unknown"`.

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
  prepare(opts: { target: Target }): Promise<void>;                          // scaffold + codegen + icons
  run(opts: BuildFlavor & { target: Target }): Promise<BuildResult>;
  runAll(opts?: BuildFlavor & { targets?: readonly Target[] }): Promise<readonly BuildResult[]>;
};
type BuildResult = { target: Target; outPath: string; artifacts: readonly string[];
  durationMs: number; phases: readonly PhaseTiming[] }; // always six { phase, durationMs } entries
```

Gotchas:
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
| `signing-<target>` | ios, macos, android, windows | warn | Env-var **presence** and identity **count**, never values |
| `gen-completeness-<target>` | ios, android | fail | `incomplete` fails; `not-initialized` passes (init runs on first build) |
| `tauri-version-skew` | host | warn | `@tauri-apps/*` npm major vs the registry crate range |
| `web-script` | host | fail | `web.build` / `web.devCommand` scripts exist in `<web.cwd>/package.json`. Not executed |
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
| `build(opts?: BuildFlavor & { target?: Target; all?: boolean }): Promise<void>` | `all: true` → `build.runAll`. Else `build.run` for `target` (default: the host desktop target; throws `[native] No default packaging target …` on a host that is not darwin / win32 / linux, same for `dev`). On failure prints the scrubbed `stderrTail`, then rethrows |
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
| 2 | `codegen` | build → project, tauri | `project.generate`. Mobile only: `tauri.mobileInit` when `not-initialized`; throw when `incomplete`; then `project.patchMobile({ target, runner: tauri.getRunner() })` |
| 3 | `icons` | build → project, tauri | `project.ensureIconSource` → `tauri.icon`. Skipped (`detail: "up to date"`) when `icons/icon.png` exists, the `icons/.source` stamp matches, and `mobileInit` did not just run. Else `"generated"` or `"placeholder"` |
| 4 | `compile` | build → tauri | iOS first clears `gen/apple/build`. Then one `tauri.build` subprocess. Cargo ticks become `progress` events (`Compiling <crate> 3/50`) |
| 5 | `bundle` | build → tauri | Same subprocess. Opens at the first output line matching `/bundling/i`. A failure belongs to the open phase |
| 6 | `collect` | build | Globs the bundle layout, keeps the newest match per file name, copies to `<outDir>/<target>/`, then emits `native:complete` |

## 7. Capability registry (`config.system` name → what it resolves to)

| System plugin | Crate (`^2`) / npm (`^2`) | Rust init | Permissions | Platforms | Conf |
|---------------|---------------------------|-----------|-------------|-----------|------|
| `store` | `tauri-plugin-store` / `@tauri-apps/plugin-store` | `tauri_plugin_store::Builder::default().build()` | `store:default` | all five | — |
| `notification` | `tauri-plugin-notification` / `@tauri-apps/plugin-notification` | `tauri_plugin_notification::init()` | `notification:default` | all five | — |
| `clipboard-manager` | `tauri-plugin-clipboard-manager` / `@tauri-apps/plugin-clipboard-manager` | `tauri_plugin_clipboard_manager::init()` | `clipboard-manager:allow-read-text`, `clipboard-manager:allow-write-text` | all five | — |
| `tray` | none — cargo feature `tray-icon` on `tauri` | none | `core:tray:default`, `core:menu:default`, `core:image:default`, `core:resources:default`, `core:app:allow-default-window-icon` | macos, windows, linux | — |
| `deep-link` | `tauri-plugin-deep-link` / `@tauri-apps/plugin-deep-link` | `tauri_plugin_deep_link::init()` | `deep-link:default` | all five | `{ desktop: { schemes: [s] }, mobile: [{ scheme: [s], appLink: false }] }` |

A row is applied to a target only when its `platforms` list includes it, so `tray` is dropped from `ios`
and `android` builds. `deep-link` is custom-scheme only in v1 (no universal links). Official Tauri plugins
merge their own `AndroidManifest.xml` needs, so v1 ships no XML patching.

## 8. Targets and artifacts (`TARGETS`)

| Target | `tauri` argv | Build output (under `<projectDir>/src-tauri/`) | Collected into `<outDir>/<target>/` |
|--------|--------------|-----------------------------------------------|--------------------------------------|
| `macos` | `build --ci` | `target/release/bundle/{dmg,macos}` | `*.dmg`, `*.app` |
| `windows` | `build --ci` | `target/release/bundle/{nsis,msi}` | `*-setup.exe`, `*.msi` |
| `linux` | `build --ci` | `target/release/bundle/{appimage,deb,rpm}` | `*.AppImage`, `*.deb`, `*.rpm` |
| `ios` | `ios build --ci` + `--export-method <m>` when `signing.apple.exportMethod` is set | `gen/apple/build/` | `**/*.ipa` |
| `ios`, `simulator: true` | `ios build --ci --target aarch64-sim` (`x86_64` on an `x64` host); never `--export-method` | `gen/apple/build/{*-sim,x86_64}/` | the unsigned `.app` directory |
| `android` | `android build --ci --apk`; `aab: true` → `--aab` | `gen/android/app/build/outputs/` | release `*.apk`, or release `*.aab` |

Unsigned dev and iOS simulator builds need no credentials. Secrets stay in the environment; Tauri and Gradle
read them: `APPLE_ID` + `APPLE_PASSWORD` + `APPLE_TEAM_ID`, or `APPLE_API_KEY` + `APPLE_API_ISSUER` +
`APPLE_API_KEY_PATH`; `APPLE_CERTIFICATE` + `APPLE_CERTIFICATE_PASSWORD`; the vars named in `signing.android`.
