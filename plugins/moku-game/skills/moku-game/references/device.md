# The device loop: simulator, Android, real iPhone

How a game on `@moku-labs/game` becomes a native app with `@moku-labs/native` (Tauri 2) and how Claude
sees it. The game imports no native package (lint L13) and writes no bridge: `config.ts` names the app
and the system plugins, and the engine bin `moku-game` does the rest. For the packager itself load the
`moku-native:moku-native` skill; for the system plugins, `moku-system:moku-system`.

## What a game adds

```ts
// config.ts: the native app and the system shell, as plain data
import type { GameConfig } from "@moku-labs/game/app";

export default {
  page: { title: "My Game", background: "#10161d", orientation: "portrait" },
  native: { name: "My Game", identifier: "com.example.mygame", icon: "assets/icon.png" },
  system: ["lifecycle", "back", "haptics", "keepAwake"],
  save: "local",
  assets: { layers: { shared: "ui" } }
} satisfies GameConfig;
```

```sh
# system names a plugin, or save is "store": the package and the Tauri peers of the list above
bun add --exact @moku-labs/system@0.3.2 @tauri-apps/api@2.12.2 @tauri-apps/plugin-haptics@2.4.1
bun add --exact @tauri-apps/plugin-store@2.5.0   # only with "store" in system, or save: "store"
bun add --exact -d @moku-labs/native@0.3.3       # moku-game native
```

`@moku-labs/system` declares its Tauri packages as optional peers, so Bun does not install them. The
page bundles the Tauri provider of every named plugin, in the web build too. Without the peer
`moku-game build` stops: `Could not resolve: "@tauri-apps/api/app"`. Install the peer of each name in
`system`, and no other.

| `system` name | The engine gets | Tauri peer |
|---|---|---|
| `lifecycle` | Pause and resume, the `"background"` reason of `lifecycle` | `@tauri-apps/api`. The build passes without it; the app then follows `visibilitychange` alone |
| `back` | The hardware Back press and `exit()` | `@tauri-apps/api` |
| `haptics` | The `haptic` effect | `@tauri-apps/plugin-haptics` |
| `keepAwake` | The screen wake lock while the game runs | none |
| `store` | The store save (`save: "store"`): idb on the web, the Tauri store in the app | `@tauri-apps/plugin-store` |

The page `moku-game` writes imports `systemShellOf` from `@moku-labs/game/app/system` with one `import()`
per named plugin, in the order above, builds the system app before the game and passes its provider to
`platform`. A game that names no plugin and keeps a memory or local save bundles no system code. In a
browser the web providers answer honestly: pause follows `visibilitychange`, haptics vibrate on Android
only, `exit` is `unsupported`. A Leave button: a node asks with `fx({ kind: "exit" })`, the game's exit
plugin answers with `ctx.require(platformPlugin).exit()`.

`moku-game native <verb> [<target>]` maps `config.ts` to the config of `@moku-labs/native`:

| Native config | From |
|---|---|
| `app.name`, `app.identifier`, `app.icon` | `native.name`, `native.identifier`, `native.icon` |
| `app.orientation`, `app.backgroundColor` | `page.orientation`, `page.background` |
| `web.build`, `web.dist` | `moku-game build`, `dist/web` |
| `web.devCommand`, `web.devUrl` | `moku-game dev --port 5173`, `http://127.0.0.1:5173` |
| `system` | One row per name that needs a Tauri capability: `back`, `haptics`, `store` |
| `targets` | `native.targets`, else the target of the command |
| `projectDir`, `outDir` | `.moku/tauri`, `dist-native` |

With the template's `"native": "moku-game native"` script: `bun run native build ios --simulator`,
`bun run native build android`, `bun run native dev ios`, `bun run native doctor`, `bun run native clean`.
Without a `native` section it stops with `[game] config.ts has no native section.` `.moku/tauri/` and
`dist-native/` are build output, never committed. A real `node` on `PATH` is required because
`@tauri-apps/cli` does not run under Bun.

## iOS simulator

1. Build the simulator slice: `bun run native build ios --simulator`. Unsigned; the doctor's
   `signing-ios` warning is legal here. Native prints the `.app` path under `dist-native/ios/`.
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

1. Build: `bun run native build android` → an installable `.apk` under `dist-native/android/`. Needs
   Android SDK, NDK, JDK; `bun run native doctor android` lists what is missing.
2. Install on the running emulator or the plugged device: `adb install -r <apk>`. Launch from the
   launcher or `adb shell monkey -p com.example.mygame 1`.
3. Dev page on the device: `adb reverse tcp:3000 tcp:3000` makes the device's `127.0.0.1:3000` reach the
   host's dev server, so a dev build pointed at `http://127.0.0.1:3000` loads the live page.
   `bun run native dev android` runs the shell on `moku-game dev --port 5173` and handles the address
   itself.
4. Screenshots: `adb exec-out screencap -p > .planning/e2e/game/android-home.png`. Taps: `adb shell input
   tap <x> <y>`; a text field: `adb shell input text "…"`.
5. Expect haptics on cheap phones to do nothing while still answering `ok` (spike P14). An old system
   WebView may need the edge-to-edge inset fallback; test the safe area on one such device.

## Real iPhone

A device build needs Apple signing. Claude never enters Apple credentials: it guides, the user signs in.

1. The user opens Xcode → Settings → Accounts and signs in with their Apple ID; the team appears.
2. `config.ts` carries no signing in game 0.12. The user picks the team in the generated Xcode project
   under `.moku/tauri/` (Signing & Capabilities) and runs on the device from Xcode. The
   `moku-native:moku-native` skill lists the env vars its doctor checks; never write a secret into the
   game.
3. `bun run native build ios` builds the device archive; the first run may need the user to accept the
   provisioning prompt in Xcode.
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
