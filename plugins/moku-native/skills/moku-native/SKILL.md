---
name: moku-native
description: >
  Moku Native patterns: the node-only native packager framework (@moku-labs/native), a standalone
  @moku-labs/core framework that wraps Tauri 2. It generates a gitignored Tauri project, codegens the
  permission surface (capabilities JSON, Cargo crates and features, Rust plugin init, tauri.conf plugin
  fragments) from the composed system plugins, and runs `tauri build` for macos, windows, linux, ios and
  android. It is a packager, not a runtime. Triggers on: "moku native", "@moku-labs/native", "tauri build moku",
  "package moku app for desktop / ios / android", "moku installer / dmg / apk / ipa", "native:build",
  "native:dev", "moku doctor", "native doctor", "moku ios simulator build", "moku app signing",
  or packaging a Moku web app as a native app.
---

# Moku Native Patterns

> **Synced to `@moku-labs/native@0.2.1`** (npm `dist-tags.latest`; catalog from the `v0.2.1` tag source).
> Full surface — the 5 plugins, every API method, the global config, the 3 events, the build pipeline,
> the capability registry and the dependency graph — is in
> [`references/plugin-index.md`](references/plugin-index.md). Registered in the framework registry
> (`frameworks[native]`): load the `moku:moku-core` skill with the Skill tool and read
> `references/moku-frameworks.md` under the base directory it prints.

## Current Project State
!`test -f package.json && grep -E '"@moku-labs/native"' package.json 2>/dev/null || true`

## What it is

`@moku-labs/native` is a **standalone Moku framework on `@moku-labs/core`** — a sibling to `@moku-labs/web`,
`@moku-labs/worker` and `@moku-labs/room`, not built on them. It is the **native packager**: it turns an
existing web build into installers for five targets (`macos`, `windows`, `linux`, `ios`, `android`) by
driving Tauri 2 end to end. You `createApp` **from Native itself**. Nothing from this package runs inside
the shipped app. The generated Tauri project (`.moku/tauri/`) is disposable build output, never source.

The runtime side (calling store, notification, tray and so on from the web app) is a different package,
`@moku-labs/system`. Native only reads the **names** of the composed system plugins (`config.system`) and
codegens the packaging surface from them.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | `@moku-labs/native` — its own `@moku-labs/core` framework (you `createApp` from it). One entry point (`.`), ESM + CJS |
| Built on | `@moku-labs/core@1.5.0` + `@moku-labs/common@0.3.0` (exact pins, regular dependencies — supply the kernel + `ctx.log` / `ctx.env` + the branded CLI kit) |
| Native shell | `@tauri-apps/cli@^2` (regular dependency, installed transitively). No peer dependencies |
| Runtime | **Node-only.** Scripts run under Bun, but `@tauri-apps/cli` cannot run under Bun: a real `node` binary on `PATH` is a hard prerequisite (`doctor` checks it) |
| Toolchains | Rust + per-target SDKs (Xcode, `xcodegen`, CocoaPods, Android SDK/NDK/JDK) only for the targets you build |
| Package manager | Bun (pinned deps — `bunfig.toml` `exact = true`) |
| Engines | node ≥24, bun ≥1.3.14 |

## Idiomatic shape — a second `createApp` beside the web app

A native-packaged project is a **Layer-3 app with two `createApp` instances side by side**: the web app it
already has, and the native app from this framework. For app shape, follow the `moku-idioms.md` rubric —
load the `moku:moku-core` skill with the Skill tool and read `references/moku-idioms.md` under the base
directory it prints. Multiple `createApp` instances across distinct runtimes are idiomatic, not an
anti-pattern. Plugins are bound to their own framework's chain, so the two apps meet only at the edges:

| File | Role |
|------|------|
| `src/system.ts` | The shared contract: `export const systemPlugins = [{ name: "store" }, …]`. Both apps import it. One list, no drift |
| `src/native.ts` | The native `createApp` (config only: `app`, `web`, `system`, `capabilities`, `targets`, `signing`) |
| `scripts/native-<verb>.ts` | One thin script per verb: `start()` → `native.cli.<verb>()` → `stop()` |
| `package.json` scripts | `native:dev`, `native:build`, `native:doctor`, `native:clean` — each `bun run scripts/native-<verb>.ts` |
| `.moku/tauri/` (`projectDir`) | Generated Tauri project. **Gitignored**, fully regenerable, never edited by hand |
| `dist-native/<target>/` (`outDir`) | Collected installers. **Gitignored** |

What NOT to do:

- ⚠️ Do not put native plugins into the web app's `plugins` array, and do not import `createApp` /
  `createPlugin` for this app from `@moku-labs/web` or `@moku-labs/core` (I1).
- ⚠️ Do not commit or hand-edit `.moku/tauri/` (`tauri.conf.json`, `Cargo.toml`, capabilities, `gen/`).
  Change `config` and rebuild; the write-if-changed generators reproduce the tree.
- ⚠️ Do not write an argv parser or call `tauri` / `bunx tauri` yourself. `cli` is a typed verb surface;
  only the `tauri` plugin spawns `@tauri-apps/cli`.
- ⚠️ Do not put secrets in config. `signing` carries identifiers and env-var **names** only.
- ⚠️ Do not replace `pluginConfigs.env.providers` without re-adding `workerSafeProcessEnv()` — `PATH`
  becomes `undefined` and every build fails with ``[native] Could not locate a `node` binary on PATH.``
- Mobile is opt-in. The default `targets` is the host's one desktop target. Name `ios` / `android`
  explicitly.

## Framework API (@moku-labs/native v0.2.1)

All five plugins are **framework defaults** — already wired. An app passes `config` and nothing else in the
common case. `createApp` also accepts `plugins`, `pluginConfigs` and `onReady` / `onError` / `onStart` /
`onStop`. `config` is a **shallow merge**: a nested object (`app`, `web`, `signing`) is replaced whole.

```ts
// src/native.ts
import { createApp } from "@moku-labs/native";
import { systemPlugins } from "./system"; // [{ name: "store" }, { name: "deep-link" }]

export const native = createApp({
  config: {
    app: { name: "MyApp", identifier: "com.example.myapp", icon: "assets/icon.png" },
    web: { build: "bun run build", devCommand: "bun run dev", devUrl: "http://localhost:5173", dist: "dist" },
    system: systemPlugins,
    capabilities: { "deep-link": { mode: "scheme", scheme: "myapp" } },
    targets: ["macos", "ios"],
    signing: { apple: { teamId: "ABCDE12345", exportMethod: "app-store-connect" } },
  },
});

// scripts/native-build.ts
await native.start();
await native.cli.build({ target: "macos" });                // installers → dist-native/macos/
await native.cli.build({ target: "ios", simulator: true }); // unsigned .app → dist-native/ios/
await native.stop();
```

- **`cliPlugin`** → `app.cli`: `build({ target?, all?, simulator?, aab? })`, `dev({ target? })`,
  `doctor({ target? })` → `Promise<boolean>` (caller sets `process.exitCode`), `clean({ target? })` (no
  target = confirm-gated full wipe). Typed verbs, **no argv parsing**. Hooks all three events for live output.
- **`buildPlugin`** → `app.build`: `prepare({ target })`, `run({ target, simulator?, aab? })`,
  `runAll({ targets?, simulator?, aab? })`. Pipeline `scaffold → codegen → icons → compile → bundle →
  collect` (`PHASE_ORDER`). `runAll` is **sequential** and stops at the first failing target. Emits the
  global events `native:phase` and `native:complete`.
- **`projectPlugin`** → `app.project`: `generate`, `getCompleteness`, `patchMobile`, `clean`,
  `clearMobileBuildOutput`, `ensureIconSource`, `getBundleLayout`, `resolveDerivedPath`, `resolve`,
  `isKnownCapability`, `getRegistryRows`, `getRequiredFiles`. Owns the generated tree **as files; never
  spawns**. `onInit` validates the global config at `createApp` time.
- **`tauriPlugin`** → `app.tauri`: `icon`, `build`, `mobileInit`, `dev`, `getVersion`, `getRunner`.
  ⚠️ **The only plugin that spawns `@tauri-apps/cli`** (explicit PATH-walked `node` + resolved `tauri.js`).
  Every output line is **secret-scrubbed** before it reaches a log, a callback or an error. One-shot verbs
  throw a classified **`TauriError`** (`kind`, `exitCode`, scrubbed `stderrTail`). No `onStop`: dev teardown
  is owned by the `DevHandle`.
- **`doctorPlugin`** → `app.doctor`: `run({ target? })` → `{ ok, checks }`. 13 checks run in parallel,
  never throws on a failed check, a timeout is a `warn`, and `warn` never flips `ok`. Declares and emits
  **`doctor:check`**. Signing checks read env-var **presence and counts, never values**.
- **Events (3):** global `native:phase`, `native:complete` (hookable without a `depends` edge) and the
  per-plugin `doctor:check` (needs `depends: [doctorPlugin]`).
- **Capability registry (5 rows):** `store`, `notification`, `clipboard-manager`, `tray`, `deep-link`. An
  unknown `config.system` name throws at `createApp`. `deep-link` requires
  `capabilities["deep-link"] = { mode: "scheme", scheme }`. `tray` is a cargo feature and is desktop-only.
- **Other exports:** `createPlugin`, `hostTargets`, `TARGETS`, `PHASE_ORDER`, `TauriError`, and type-only
  namespaces `Project`, `Tauri`, `Build`, `Doctor`, `Cli` (for example `Build.BuildResult`, `Tauri.DevHandle`).

Full catalog (5 plugins, every API/config/event, pipeline phases, capability registry, targets, dependency
graph): **[`references/plugin-index.md`](references/plugin-index.md)**.
