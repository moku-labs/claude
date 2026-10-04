---
name: moku-game
description: >
  Moku Game patterns: the 2D puzzle game engine (@moku-labs/game) on PixiJS v8, a standalone
  @moku-labs/core framework. The game is a graph of small nodes and edge tables; state commits only
  on edges; the screen is a JSX projection of committed state; time is `now` and randomness is a saved
  `rng` stream. Plus @moku-labs/editor, the dev tools that read and drive a running game. Triggers on:
  "moku game", "@moku-labs/game", "@moku-labs/editor", "moku-editor", "defineGame", "defineNode",
  "defineFlow", "defineFeature", "createHeadless", "flow.gate.answer", "moku puzzle game", "moku pixi",
  "game doors inspect control", "__MOKU_GAME_DEV__", "assets:keys", "moku editor tools page",
  "playtest a moku game", or building a game in a Moku project whose `.planning/moku.md` says `type: game`.
---

# Moku Game Patterns

> **Synced to `@moku-labs/game@0.4.2`** and **`@moku-labs/editor@0.0.2`** (game catalog from the repo at
> `main` after PRs #19, #20 and #21, equal to npm `0.4.2`; game bundles `@moku-labs/core@1.7.0` + `@moku-labs/common@0.3.3`). The 17 game
> plugins, every API, event and config field are in [`references/plugin-index.md`](references/plugin-index.md).
> The minimal screen game is [`references/hello-world.md`](references/hello-world.md). How Claude drives
> the editor is [`references/editor.md`](references/editor.md). The simulator and device loop is
> [`references/device.md`](references/device.md). Both packages change fast: when an API here looks
> stale, read `node_modules/@moku-labs/game/llms.txt` of the project: the game package ships it since
> 0.4.0 and it matches the installed version. The editor ships no `llms.txt`; read its `README.md`. Registered in the framework registry (`frameworks[game]`): load the `moku:moku-core`
> skill with the Skill tool and read `references/moku-frameworks.md` under the base directory it prints.

## Current Project State
!`test -f package.json && grep -E '"@moku-labs/(game|editor)"' package.json 2>/dev/null || true`

## What it is

`@moku-labs/game` is a **standalone Moku framework on `@moku-labs/core`**, a sibling of `@moku-labs/web`,
`@moku-labs/worker` and `@moku-labs/room`, not built on them. It is a **2D puzzle engine**: the game is a
graph of small nodes and edge tables, one node is active at a time, state commits only on an edge, and
the screen is a projection of committed state. The same game plays to the end in plain Bun with no
screen. It ships no genre rules: a game brings its own pure rule functions.

`@moku-labs/editor` is the **dev tools** package for it: an agent on the game page, a Bun server, and a
tools page with six workspaces (Flow, Game, Render, State, Files, Console). It reaches the game only
through the two doors `@moku-labs/game/inspect` and `@moku-labs/game/control`. It is a dev dependency,
nothing of it ships in a production build.

You `createApp` **from the game**: `createApp`, `createPlugin` and every helper come from `@moku-labs/game`.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | `@moku-labs/game` 0.4.2. Entries: `.` (engine), `./testing` (headless and visual tests, Node and Bun), `./assets` (key scanner, string compiler, packer; Node and Bun), `./inspect` (read a running game, safe in production), `./control` (drive a dev build), `./fonts/*` (the MSDF body font and its licence), `./jsx-runtime` + `./jsx-dev-runtime` (never imported by hand). Bin `moku-game-assets` (Bun). Ships `llms.txt` |
| Built on | `@moku-labs/core@1.7.0` + `@moku-labs/common@0.3.3` (regular deps: kernel, `ctx.log`, `ctx.env`) |
| Rendering | `pixi.js ^8` **peer dependency**, loaded lazily with `import()`. WebGPU first, Pixi's WebGL fallback. No DOM, no React: screens are JSX laid out by `yoga-layout` (bundled, lazy) |
| Dev tools | `@moku-labs/editor` 0.0.2 (dev dep). Agent core on the page, server core in Bun (`bunx moku-editor`), tools page prebuilt |
| Optional peers | `playwright-core` (pixel leg of visual tests), `sharp` (production asset pack) |
| Native | `@moku-labs/native` packages the web build as a Tauri 2 app; `@moku-labs/system` is the platform bridge. See the `moku-native:moku-native` and `moku-system:moku-system` skills |
| Package manager | Bun only. ESM only, `"sideEffects": false`, no CJS |
| Engines | node ≥24, bun ≥1.3.14. TypeScript strict with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` |

`tsconfig.json` of a game sets `"jsx": "react-jsx"` and `"jsxImportSource": "@moku-labs/game"`.

## Idiomatic layout of a game

The game lives at the project root, the way the engine's own fixture `tests/integration/merge-game/`
does. No `src/`: the asset scanner, the dev server and the editor all take `--root .`.

```
state.ts                  Player and Session types, startingPlayer, startingSession
kit.ts                    the one defineGame<…>() call; exports defineNode, defineFlow, projection, tr, …
tables.ts                 balance data as plain objects
rules/                    pure functions (state, input, tables) => result; no engine import
nodes/                    one file per node: boot.ts, home.ts, await-intent.ts
flows/                    main.ts, one file per sub-flow
features/<f>/
  index.ts                defineFeature("<f>", { scenes, projections, animations, ui, assets, strings, textStyles })
  view.tsx                projections and components (JSX)
  assets/                 png, webp, mp3, fnt (+ its png pages); nine-slice borders in the file name
  assets.ts               defineBundles({ <f>: { tier } })  (optional; default one bundle, tier "feature")
  strings/<locale>.json   ICU MessageFormat strings
  animations.ts           defineAnimation(...) timelines
  styles.ts               defineStyle(...) and defineTextStyles(...)
generated/                written by `bun run assets:keys`: assets.ts, strings.ts, strings.<locale>.ts
features/ui/assets/       font-body.fnt + .png copied from node_modules/@moku-labs/game/fonts/ (key ui.font-body)
manifest.json             written by the scanner; the page fetches /manifest.json
game.ts                   createGame(): the createApp call(s)
web/index.html            <div id="game"> + <script type="module" src="./main.ts">
web/main.ts               the dev page: createApp with the screen, the editor agent dev-only
web/dev.ts                globalThis.__MOKU_GAME_DEV__ = true; first import of main.ts
web/serve.ts              Bun.serve: the page on /, the root's files as static (dev without the editor)
web/build.ts              Bun.build of the page, define __MOKU_GAME_DEV__ false, packed assets beside it
tests/                    headless scenarios; tests/visual/ the visual tests and baselines
```

Rules of the layout: `rules/` import only their siblings (L4). Nodes import the kit, never `pixi.js`. A
feature's view imports the kit and its own `styles.ts`. Asset keys are typed from `generated/assets.ts`
(`AssetKey`, `BundleKey`, `FontKey`, `AudioKey`, `nineSlice`), never spelled as plain strings elsewhere.

## createApp shape

```ts
// game.ts
import { audioPlugin, createApp, effectsPlugin, platformPlugin, screen } from "@moku-labs/game";

export const screenPlugins = [...screen, audioPlugin, effectsPlugin, platformPlugin, homeFeature, hudFeature];

export const createGame = (seed: "from-save" | number = "from-save") =>
  createApp({
    plugins: [...screenPlugins],
    config: { orientation: "portrait", referenceSide: 1080, referenceLong: 1920 },
    pluginConfigs: {
      model: { initialPlayer: startingPlayer, initialSession: startingSession, seed },
      flow: { mainFlow, safeNode: "home" },
      renderer: { mount: "#game" },
      assets: { manifest: "/manifest.json" },
      text: { fonts: { body: "ui.font-body", digits: "ui.font-display" } }
    },
    onStart: ctx => {
      ctx.flow.run().catch((error: unknown) => ctx.log.error("game: the graph failed", { error }));
    }
  });
```

- Five logic plugins are always on: `time`, `lifecycle`, `model`, `clock`, `flow`. The list `screen` is
  the nine screen plugins: `world`, `renderer`, `input`, `assets`, `scenes`, `anim`, `i18n`, `text`, `ui`.
  Opt-in: `effectsPlugin`, `audioPlugin`, `platformPlugin` (last in the array).
- The game calls `flow.run()` once from `onStart` and does not await it. The screen answers with
  `app.flow.gate.answer({ intent, payload })`.
- A headless test composes `plugins: [feature.logicOnly]` and no screen plugin. The same app starts in
  plain Bun: without `renderer.mount` the renderer is inert, Yoga included.
- `log` and `env` from `@moku-labs/common` are on every context (`ctx.log`, `ctx.env`).

## defineGame and the authoring helpers

`defineNode` and `defineFlow` are **not root exports**. They come from one `defineGame<Types>()` call in
`kit.ts`, typed by the game's `player`, `session`, `assets`, `bundles`, `scenes`, `strings`, `textStyles`
and `emitters`. A texture key, a bundle, a message key or a style the game does not have does not compile.

```ts
// kit.ts
import { defineGame } from "@moku-labs/game";
import type { AssetKey, BundleKey } from "./generated/assets";
import type { Strings } from "./generated/strings";
import type { Player, Session } from "./state";

export const { defineNode, defineFlow, defineFeature, projection, sprite, Sprite, NineSlice, defineBundles,
  load, defineScene, defineAnimation, tr, label, defineTextStyles, defineComponent, defineStyle, defineTokens,
  popup, music, Frames, defineEmitter, Emitter } = defineGame<{
  player: Player; session: Session; assets: AssetKey; bundles: BundleKey;
  scenes: "home" | "board"; strings: Strings; textStyles: "body" | "digits" | "ui.title";
}>();
```

| Term | Shape |
|---|---|
| Node | `defineNode({ input?, outcomes, rest?, over?, checkpoint?, barrier?, inbox?, scene?, run })`. `run` gets `{ input, player, session, rng, fx, out, signal, now }` and returns `out.<outcome>(payload)` |
| Rest node | `rest: true`, the graph waits. A gate answer whose `intent` is an outcome name, or an inbox event, ends it. `checkpoint: true` compacts the journal; `safeNode` points at one |
| Flow | `defineFlow(id, { nodes, start, edges, input?, outcomes? })`. One edge per outcome of every node; the compiler checks the table. A flow with `outcomes` is a node of another flow; `exit("name")` leaves it; `to("node", map)` adapts a payload; `slot("name")` is an extension point |
| Feature | `defineFeature(name, { nodes?, flows?, contribute?, projections?, scenes?, assets?, animations?, ui?, strings?, textStyles?, emitters?, filters? })`. An ordinary plugin. `feature.logicOnly` for headless tests. A feature name is never a flow id or an engine plugin name |
| Effect | `await fx(descriptor)` for awaited effects (`schedule`, `guide`, `popup`, `play`, `sfx`, `music`, `load`); `fx.emit(hint(kind, payload))` for cosmetic ones. In fast mode effects answer at once |
| Projection | `projection({ name, layer, from: player => item(s), view: item => JSX })`. `ui` reconciles the JSX into entities and lays them out with Yoga |
| Bound text | `<text bind={bind(Counter, "value")} components={[Counter({ value })]} />` shows a numeric field of a component on the same entity; formats `int`, `mm:ss`, `h:mm:ss`, `duration` (`bind(C, "f", { format })`). `Countdown({ until })` with `bind(Countdown, "left", { format: "mm:ss" })` counts down to a `clock` moment. `motion={{ change: { Counter: roll } }}` rolls the number. A literal `{ component, field }` bind is gone since 0.4.0 |
| Long list | `<scroll rows={n} rowHeight={80} overscan={5} row={i => node} />`: only the rows in view plus `overscan` exist. Row state belongs in the model |
| Stack drag, trace | `Draggable({ payload, carry: ["c8", "c9"] })` drags a stack. `Traceable` cells and the `Traced` mark answer one `{ intent, payload: { path } }` for a word-game trace; `input.trace(path)` and `game.trace` drive it |
| Scene | `defineScene(id, { bundle, layers, projections, music? })`. A node names its scene (`scene: "home"`); every scene gets a `ui` layer on top |

Determinism rules a node obeys: no `Date.now`, `performance.now`, `new Date`, `Math.random`,
`setTimeout`, `setInterval`. Time is `now` from the context; randomness is `rng.stream("id")` (`int`,
`range`, `pick`, `weighted`, `chance`); a timer is a moment stored in `player` plus `await fx(schedule(moment))`
and a rest node with `inbox: ["elapsed"]`. State is plain JSON, changed only through the `player` and
`session` drafts. A node never touches `app.model`, `app.clock` or `app.time`.

## Doors: inspect and control

| Subpath | Exports | Production |
|---|---|---|
| `@moku-labs/game/inspect` | `read(app, source, input?)`, `watch(app, source, input, fn)`, `defineSource`, `sources` | Safe, read only |
| `@moku-labs/game/control` | `run(app, command, input?)`, `defineCommand`, `controlRefused`, `commands` | Dev only. `run` throws unless `__MOKU_GAME_DEV__ === true` |

Base sources (`sources.*`): `graph`, `position`, `history`, `tainted`, `cheats`, `model`, `entities`,
`projections`, `ui`, `locate`, `render`, `effects`, `sounds`, `assets`, `log`, `explain`, `diff`, `schema`,
`at`. `game.rect` is gone since 0.4.0: `locate` takes `{ key }` or `{ target: { projection, key } }`.
Base commands (`commands.*`): `answer`, `tap`, `drag`, `key`, `fill`, `walk`, `bookmark`, `restore`, `step`,
`pause`, `resume`, `capture`, `debug`, `reducedMotion`, `timeScale`, `trace`. `capture` takes
`{ legend?, layers?, sheet?, diff? }` and answers `{ png, legend? }`, not a bare string. The catalogue is
plain data shaped for MCP tools (id, title, input schema); no MCP server ships yet. Effects: `read`, `route`, `cosmetic`, `cheat`, `raw`; a `cheat` or `raw` taints the
session and is journaled.

`__MOKU_GAME_DEV__` is a global the engine declares and reads, never sets. A game never re-declares it.
Dev page: `web/dev.ts` sets `globalThis.__MOKU_GAME_DEV__ = true` as the first import of `web/main.ts`.
Production: `Bun.build({ define: { __MOKU_GAME_DEV__: "false" } })` strips every command body. Tests:
`vi.stubGlobal("__MOKU_GAME_DEV__", true)`.

The dev page exposes two handles the editor, the visual tests and Claude use:
`Reflect.set(globalThis, "game", app)` and `Reflect.set(globalThis, "doors", { read, watch, sources, run, commands })`.
A game's own sources and commands live in `.dev` modules (`dice.dev.ts`) that only the dev entry and
tests import; every command body starts with the inline guard
`if (typeof __MOKU_GAME_DEV__ === "undefined" || !__MOKU_GAME_DEV__) throw controlRefused();`.

## Assets pipeline

- Files live in `features/<f>/assets/`. The key is `<feature>.<file name without extension>`:
  `features/ui/assets/icon-gear.webp` is `"ui.icon-gear"`.
- Formats: `.png`, `.webp` (one texture each), `.fnt` with its `.png` pages (one MSDF bitmap font; the
  pages are never keys), `.mp3` (one sound). `.ogg`, `.wav`, `.ttf` are left out with a note.
- Nine-slice borders go in the file name and the key drops the tag: `panel{nine=48}.png` →
  `"ui.panel"`; `bar{nine=24,12}.png`; `sign{nine=30,10,40,20}.webp` (left, top, right, bottom).
- Bundles: a feature without `assets.ts` is one bundle named as the feature, tier `"feature"`.
  `defineBundles({ board: { tier: "scene" }, "board.chains": { tier: "lazy", files: ["chains/*.png"] } })`
  splits it. Tiers: `boot` (awaited in `onStart`, never unloaded), `core` (started in `onStart`),
  `scene` (with the scene a node names), `feature` (with any node of the feature's flow), `lazy` (on
  request with `await fx(load("name"))`). Texture budget `textureBudgetMb: 192`, LRU unload.
- Formats since 0.4.0: audio is `.mp3` or `.m4a`; `assets.audio(key)` answers `{ bytes, mime }`.
- `bun run assets:keys` runs the `./assets` door: it writes `manifest.json` (v1, loose files),
  `generated/assets.ts` (the key unions and `nineSlice`), `generated/strings.ts` (the `Strings` type)
  and one `generated/strings.<locale>.ts` per locale from `features/*/strings/<locale>.json`.
  `--check` fails when any output is stale. `--pack dist/assets` writes the production pack: WebP atlas
  pages, content-hashed names, a v2 manifest (needs `sharp`). `--pseudo` adds the pseudo-locale `en-XA`;
  `--export <dir>` / `--import <dir>` exchange strings with translators (`--source <locale>`, default `en`).
- The package bin `moku-game-assets` is this CLI: `"assets:keys": "moku-game-assets --root ."`.
- Strings: ICU adds `{x, duration, short}`; a value may be `{ "text": "…", "note": "for the translator" }`.
- The page fetches `/manifest.json`; paths in it are relative to that URL. Text needs an MSDF font:
  the built-in styles `body` and `digits` read `text.fonts` (default `ui.font-body`, `ui.font-digits`).
  The package ships the body font: `cp node_modules/@moku-labs/game/fonts/font-body.* features/ui/assets/`
  and its `LICENSE.txt` beside `assets/`. No digits font ships. Other faces: `msdf-bmfont-xml` (BMFont
  XML, one 512×512 page).

## Testing

- **Headless**: `createHeadless(app)` from `@moku-labs/game/testing` sets fast mode, starts the app and
  resolves at the first rest node. `game.walk([{ at: "home", intent: "roll" }])` plays a route;
  `game.answer`, `game.state()`, `game.history()`, `game.stop()`. Seams: `fakeClock(start)` with
  `advance(ms)`, `memory()` save provider with `calls`, `saveOf(player, seed)`, `runRepro`, `stepFrames`.
  Fix the rng with `model: { seed: 42 }`. Compose `plugins: [feature.logicOnly]`.
- **Visual**: `defineVisualTest(name, { start: { player, checkpoint }, steps, webgl? })`. A step is a
  `/control` command by short name (`{ tap: { key: "play" } }`, `{ answer: {...} }`, `{ walk: {...} }`,
  `{ step: {...} }`) or `{ checkpoint: "name" }`. `runVisualTests({ app: () => createScreenGame().app,
  page: { url: "http://localhost:3000/" } }, tests, options)` plays the headless leg in Bun (compares
  `state.json` and `describe.json` exactly, runs in `bun run test`) and the pixel leg in Chrome on a Mac
  (compares `screen.webp`, tolerance 24 per channel and 0.1 % of pixels). `--update` rewrites baselines,
  only for intended changes. `--no-pixels`, `--only <name>`, `--webgl`, `--url <page>`. The page is the
  contract: `globalThis.game` and `globalThis.doors` on a dev build. Pixel leg needs `bun add -d playwright-core`.
- **Doors in tests**: `vi.stubGlobal("__MOKU_GAME_DEV__", true)`, then `read(app, sources.position)`,
  `await run(app, commands.walk, { route })`. A headless `watch` reads on frames a test steps:
  `app.time.step(16)`.
- Layout: `tests/` for scenarios, `features/<f>/__tests__/` for feature tests, `rules/__tests__/` for rules.

## Lint rules L1–L13 (the engine's `eslint.config.ts`; a game follows the same rules)

| Rule | Says |
|---|---|
| L1 | A module imports a sibling only as `import type` from its `types.ts`; the plugin `index.ts` injects APIs |
| L2 | No static import of `pixi.js` or `yoga-layout`; lazy `import()` only |
| L3 | Determinism: no `Date.now`, `performance.now`, `new Date`, `Math.random`, `setTimeout`, `setInterval` in logic (nodes, rules, model, flow, clock) |
| L4 | Rule functions import only their siblings in `rules/` |
| L5 | No module-scope state: no top-level `let`, `Map`, `Set`, `WeakMap`, `WeakSet` |
| L6 | Every function declaration and exported type has JSDoc with description, params and returns |
| L7 | Public `…Api` members in `types.ts` carry the docs and a true scenario `@example`; implementations have none |
| L8 | No signature echo: an `@example` that is one call with bare identifiers is an error |
| L9 | The JSX runtime is reached only through `jsx-runtime.ts` and `jsx-dev-runtime.ts` |
| L13 | No import of `@moku-labs/system`, `@moku-labs/native` or `@tauri-apps/*` in the engine; the game builds its `PlatformProvider` in its own layer (`platform-bridge.ts`) |

JSDoc in a game is always the multi-line form (`/**` on its own line), never `/** one line */`.

## Editor wiring

```ts
// web/main.ts, after the game's createApp
import { bridgePlugin, capturePlugin, createApp as createEditor } from "@moku-labs/editor/agent";

const devPlugins = __MOKU_GAME_DEV__ ? [bridgePlugin, capturePlugin] : [];
const editor = createEditor({
  plugins: devPlugins,
  pluginConfigs: { registry: { game: app, modules: [], name: "my-game 0.1.0" } }
});
Reflect.set(globalThis, "editor", editor);
await editor.start(); // never waits for the editor server
```

- Default agent plugins are `registry`, `channel`, `overlay`; `bridgePlugin` (websocket to the hub) and
  `capturePlugin` (`editor.capture`, `editor.series`, `editor.seriesStop`) are opt-in and dev-only.
  `modules` are the game's `.dev` modules.
- Run the server with the bin: `bunx moku-editor web/index.html --port 3000 --root .` (Bun only). It
  prints `Game http://127.0.0.1:3000/` and `Tools http://127.0.0.1:3000/__editor/` and serves the root's
  files (manifest, art, sounds) as static; dotfiles and `node_modules` are refused. Or wrap your own
  `Bun.serve` with `createApp` from `@moku-labs/editor/server` and `editor.hub.serve(...)`.
- The tools page: six workspaces, keys `1`–`6` (Flow, Game, Render, State, Files, Console), `⌘K`
  palette, `P` pause / resume, `.` step one frame while paused, `O` overlay in game on / off, `G` preview,
  `i` or `⌘⇧C` the element picker, `Esc` closes one thing. Captures go to `.moku/captures/`.
- The server binds `127.0.0.1` only and gates every socket with Host, Origin and a per-start token.
- Saving a style or a node in Files bookmarks the game, reloads the frame and restores the bookmark.
  The session reads as tainted afterwards.
- Editor 0.0.2 against game 0.4.x: the element picker (reads the removed `game.rect`) and `editor.capture`,
  `editor.series`, the Shot and Series buttons (expect a string from `game.capture`, now `{ png }`) fail.
  Flow, State, Render, Console and the doors by script work. Workarounds are in `references/editor.md`.

## Native packaging and the platform bridge

The engine never imports a native package (L13). The game adds two things in its own layer:

- `platform-bridge.ts`: `fromSystem(system): PlatformProvider` over a `@moku-labs/system` app composed of
  `lifecyclePlugin`, `backPlugin`, `hapticsPlugin`, `keepAwakePlugin`. `onPause`/`onResume` become the
  `"background"` pause reason, `onBack` runs the Back chain, `haptic(kind)` reaches `haptics.impact` /
  `notify` / `selection`, `keepAwake`, `exit`. Pass it as `pluginConfigs.platform.provider`. In a browser
  the web providers answer honestly (`unsupported`), so the same page runs everywhere.
- `native.ts`: a second `createApp` from `@moku-labs/native` with `config.web.build` (pack + bundle the
  page), `config.system: [{ name: "back" }, { name: "haptics" }]`, `targets`, then
  `native.cli.build({ target: "ios", simulator: true })` or `{ target: "android" }`. See
  [`references/device.md`](references/device.md) and the `moku-native:moku-native` skill.

Known platform facts: the iOS simulator exposes `navigator.gpu` but `requestAdapter()` is `null`, so
Pixi draws with WebGL there (spike P13); `tauri://` answers a missing file with `200 text/html`, which the
assets loader treats as missing; `audio` resumes a `suspended` or `interrupted` context when a pause ends.
Since 0.4.0 `audio.session` (`"ambient"` default, `"playback"`, `"auto"`) sets `navigator.audioSession`
on iOS and `audio.music: "stream"` plays music from an `<audio>` element (about 12 MB instead of 58 MB
per 150 s track, a short gap at every loop).

## Pointers

- Full catalog, events and config: [`references/plugin-index.md`](references/plugin-index.md).
- Scaffold of the minimal screen game: [`references/hello-world.md`](references/hello-world.md).
- The editor from the browser pane: [`references/editor.md`](references/editor.md).
- Simulator and device: [`references/device.md`](references/device.md).
- App shape rubric: load `moku:moku-core` and read `references/moku-idioms.md` under its base directory.
- Testing protocol: the `moku:moku-testing` skill. Native: `moku-native:moku-native`. Bridge: `moku-system:moku-system`.
