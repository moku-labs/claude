# The device loop: simulator, Android, real iPhone

How a game on `@moku-labs/game` becomes a native app with `@moku-labs/native` (Tauri 2) and how Claude
sees it. The engine never imports a native package (lint L13); the game adds `platform-bridge.ts` and
`native.ts` in its own layer. For the packager itself load the `moku-native:moku-native` skill; for the
bridge, `moku-system:moku-system`.

## The two files a game adds

```ts
// platform-bridge.ts: four system capabilities become the engine's PlatformProvider
import type { HapticKind, PlatformProvider } from "@moku-labs/game";
import type { Back, Haptics, KeepAwake, Lifecycle, SystemResult } from "@moku-labs/system";

export type SystemSlice = {
  readonly lifecycle: Lifecycle.LifecycleApi;
  readonly back: Back.BackApi;
  readonly haptics: Haptics.HapticsApi;
  readonly keepAwake: KeepAwake.KeepAwakeApi;
};

/**
 * Builds the engine's provider over the system app. A capability answers a `SystemResult`, never a
 * throw, so an `unsupported` tick on a desktop is not an error of the game.
 *
 * @param system - The system app with lifecycle, back, haptics and keepAwake.
 * @returns The provider for `pluginConfigs.platform.provider`.
 */
export function fromSystem(system: SystemSlice): PlatformProvider {
  return {
    onPause: fn => system.lifecycle.onPause(fn),
    onResume: fn => system.lifecycle.onResume(fn),
    onBack: fn => system.back.onPress(fn),
    haptic: kind => send(() => play(system.haptics, kind)),
    keepAwake: on => send(() => system.keepAwake.set(on)),
    exit: () => send(() => system.back.exit())
  };
}
```

`play` maps `light | medium | heavy` → `haptics.impact(kind)`, `success | warning | error` →
`haptics.notify(kind)`, `selection` → `haptics.selection()`; `send` fires the promise and returns nothing.
The page composes `createApp({ plugins: [lifecyclePlugin, backPlugin, hapticsPlugin, keepAwakePlugin] })`
from `@moku-labs/system` (subpaths `/lifecycle`, `/back`, `/haptics`, `/keep-awake`), starts it **before**
the game, and passes `platform: { provider: fromSystem(system), keepAwake: true }`. In a browser the web
providers answer honestly: pause follows `visibilitychange`, haptics vibrate on Android only, `exit` is
`unsupported`.

```ts
// native.ts: the packager app, a second createApp beside the game
import path from "node:path";
import type { Target } from "@moku-labs/native";
import { createApp, TARGETS } from "@moku-labs/native";

const native = createApp({
  config: {
    app: { name: "My Game", identifier: "com.example.mygame", orientation: "portrait", backgroundColor: "#10161d" },
    web: {
      cwd: import.meta.dir,
      build: "bun run assets:keys -- --pack dist/web && bun run build:web",
      devCommand: "bun web/serve.ts --port 5173",
      devUrl: "http://localhost:5173",
      dist: "dist/web"
    },
    // lifecycle and keepAwake need no row: the webview's own events and wake lock serve them.
    system: [{ name: "back" }, { name: "haptics" }],
    targets: [target],
    projectDir: path.join(import.meta.dir, "dist/tauri"),
    outDir: path.join(import.meta.dir, "dist/native")
  }
});

await native.start();
try {
  await native.cli.build({ target, simulator: process.argv.includes("--simulator") });
} finally {
  await native.stop();
}
```

`target` is one of `TARGETS` (`macos`, `windows`, `linux`, `ios`, `android`). `dist/tauri/` and
`dist/native/` are build output, never committed. Scripts: `"native": "bun native.ts"`, run as
`bun run native ios --simulator`. `bun run native doctor` is the `moku-native` doctor; a real `node` on
`PATH` is required because `@tauri-apps/cli` does not run under Bun.

## iOS simulator

1. Build the simulator slice: `bun run native ios --simulator` → `native.cli.build({ target: "ios",
   simulator: true })`. Unsigned; the doctor's `signing-ios` warning is legal here. The cli prints the
   `.app` path under `outDir` (`dist/native/ios/…`).
2. Open the live panel first so the user watches: `mcp__Claude_Code_iOS_Simulator__control({ action:
   "attach" })`. It errors harmlessly when no simulator is booted; boot one (`xcrun simctl boot "iPhone 17
   Pro"`) or let `launch` do it.
3. Install and launch: `control({ action: "launch", app_path: "<the .app>", device: "iPhone 17 Pro" })`.
   The result reports the device's point size.
4. Prove it: `control({ action: "screenshot" })`; `control({ action: "tap", x, y })` in device points;
   `swipe`, `text`, `button`. Start a swipe more than 4 pt from an edge, or it becomes the OS edge
   gesture.
5. Save the PNGs the report cites into `.planning/e2e/game/`.

Facts to expect on the simulator (spike P13, iOS 26 simulator):

- `navigator.gpu` exists but `requestAdapter()` returns `null`, in Tauri's WKWebView and in Mobile Safari
  alike. Pixi falls back to **WebGL** without an error. The simulator cannot answer the WebGPU question
  for a device; WGSL-only filters need their GLSL twin (`defineFilter({ wgsl, glsl })`).
- `tauri://` answers a missing file with `200 text/html` and `index.html`. The assets loader treats a
  `text/html` answer for a non-`.html` path as missing: a wrong path fails as `(200, text/html)` instead
  of `(404)`. Check the manifest paths relative to the page.
- Audio: the engine's `audio` resumes a `suspended` or `interrupted` `AudioContext` when a pause ends
  (lock screen, a call). The `AudioContext` may already be `running` without a tap in Tauri iOS (wry
  autoplay), so the unlock resolves at once (spike P20, not verified on a device).
- Audio session, built since game 0.4.0: `pluginConfigs.audio.session` sets `navigator.audioSession.type`.
  `"ambient"` (the default) mixes with the player's own music and the silent switch mutes the game;
  `"playback"` stops other apps and plays through the switch; `"auto"` leaves it to the system. A no-op
  where the API is missing (Android, desktop). Not yet checked on a device under Tauri (P20 `probe.html`).
- Memory: `pluginConfigs.audio.music: "stream"` plays music from an `<audio>` element, about 12 MB instead
  of 58 MB per 150 s track, with a loop gap (about 0.4 s in WebKit). The `blob:` stream under Tauri iOS is
  not yet checked on a device (P19). Prefer it on low-memory phones for long tracks only.
- The iOS lifecycle events of Tauri conflict in the docs; the `visibilitychange` fallback of the web
  provider covers pause and resume either way (spike P14).

## Android

1. Build: `bun run native android` → an installable `.apk` under `dist/native/android/` (the `aab` option
   builds a bundle for the store). Needs Android SDK, NDK, JDK; `bun run native doctor` lists what is
   missing.
2. Install on the running emulator or the plugged device: `adb install -r <apk>`. Launch from the
   launcher or `adb shell monkey -p com.example.mygame 1`.
3. Dev page on the device: `adb reverse tcp:3000 tcp:3000` makes the device's `127.0.0.1:3000` reach the
   host's dev server, so a dev build pointed at `http://127.0.0.1:3000` loads the live page. Tauri's own
   `native.cli.dev({ target: "android" })` uses `web.devUrl` and handles the address itself.
4. Screenshots: `adb exec-out screencap -p > .planning/e2e/game/android-home.png`. Taps: `adb shell input
   tap <x> <y>`; a text field: `adb shell input text "…"`.
5. Expect haptics on cheap phones to do nothing while still answering `ok` (spike P14). An old system
   WebView may need the edge-to-edge inset fallback; test the safe area on one such device.

## Real iPhone

A device build needs Apple signing. Claude never enters Apple credentials: it guides, the user signs in.

1. The user opens Xcode → Settings → Accounts and signs in with their Apple ID; the team appears.
2. `native.ts` gets `signing: { apple: { teamId: "ABCDE12345", exportMethod: … } }` (ids and env-var
   **names** only, never secrets; the `moku-native:moku-native` skill lists the `exportMethod` values and
   the env vars the doctor checks).
3. `bun run native ios` builds the device archive; the first run may need the user to accept the
   provisioning prompt in Xcode, or to open the generated Xcode project under `projectDir` once and run
   on the device from Xcode.
4. The simulator panel does not show a physical device. Proof comes from the user's description or a
   photo; ask for one specific screen.
5. WebGPU on a physical iPhone with iOS 26 is still an open question (P13): one run on a device answers
   it. Report what `doors.read(game, doors.sources.render)` says when a dev build runs there.
   Also check `audio.session` there: the player's music keeps playing with `"ambient"` and the silent
   switch mutes the game.

## The editor on a device: not yet

The editor hub binds `127.0.0.1` and gates every socket with Host, Origin and a per-start token. A game
page running on a phone or in a simulator cannot open the bridge to the tools page on the Mac, so the
Game, State and Flow workspaces show `empty` for a device session. What works today: the simulator panel
and `adb` for pictures and input, `doors` on a dev build through Safari Web Inspector or Chrome
`chrome://inspect` if the user wants to read state by hand, and the headless and visual tests on the Mac
for the proof. `adb reverse tcp:3000 tcp:3000` makes the device reach the hub's port, but the bridge from
a device is untested; do not promise it.
