---
name: moku-game
description: >
  Moku Game patterns: the 2D puzzle game engine (@moku-labs/game) on PixiJS v8, a standalone
  @moku-labs/core framework. The game is a graph of small nodes and edge tables; state commits only
  on edges; the screen is a JSX projection of committed state; time is `now` and randomness is a saved
  `rng` stream. Plus @moku-labs/editor, the dev tools that read and drive a running game. Triggers on:
  "moku game", "@moku-labs/game", "@moku-labs/editor", "moku-editor", "defineGame", "defineNode",
  "defineFlow", "defineFeature", "createHeadless", "flow.gate.answer", "moku puzzle game", "moku pixi",
  "game doors inspect control", "__MOKU_GAME_DEV__", "defineGameApp", "moku-game dev", "moku-game build",
  "moku-game keys", "config.ts GameConfig", "moku editor tools page",
  "playtest a moku game", or building a game in a Moku project whose `.planning/moku.md` says `type: game`.
---

# Moku Game Patterns

> **The game shell is synced to `@moku-labs/game@0.11.0`** and **`@moku-labs/editor@0.8.0`**: `defineGameApp`,
> `config.ts`, the bin `moku-game`, the ten lint rules, `moku-editor --root .`. The plugin catalog below and
> in `plugin-index.md` was last synced at game 0.4.6 and editor 0.2.1. Both take `@moku-labs/core ^1.7.1` +
> `@moku-labs/common ^0.3.4` as peers. The 17 game
> plugins, every API, event and config field are in [`references/plugin-index.md`](references/plugin-index.md).
> The minimal screen game is [`references/hello-world.md`](references/hello-world.md). How Claude drives
> the editor is [`references/editor.md`](references/editor.md). The simulator and device loop is
> [`references/device.md`](references/device.md). Both packages change fast: when an API here looks
> stale, read `node_modules/@moku-labs/game/llms.txt` of the project: the game package ships it since
> 0.4.0 and it matches the installed version. The editor ships `llms.txt` and `llms-full.txt` since 0.1.0. Registered in the framework registry (`frameworks[game]`): load the `moku:moku-core`
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
| Framework | `@moku-labs/game` 0.11.0. Entries: `.` (engine), `./app` (`defineGameApp`, `startMoment`, the types of `index.ts` and `config.ts`), `./app/page` (`startPage`, the page `moku-game` writes), `./app/system` (`systemShellOf`, `fromSystem`, `storeSave`, `createSystemApp`), `./cli` (`runCli`, `preparePage`), `./lint` (the oxlint JS plugin `moku-game`), `./testing` (headless tests, Node and Bun), `./visual` (visual tests), `./assets` (key scanner, string compiler, packer), `./inspect` (read a running game, safe in production), `./control` (drive a dev build), `./hot` (the dev hot-swap plugin), `./project` (the project index), `./fonts/*` (the MSDF body font and its licence), `./jsx-runtime` + `./jsx-dev-runtime` (never imported by hand). Bins `moku-game` (dev, build, native, keys, pack) and `moku-game-assets`. Ships `llms.txt` |
| Built on | `@moku-labs/core ^1.7.1` + `@moku-labs/common ^0.3.4` (peer deps since 0.4.3, Bun installs them: kernel, `ctx.log`, `ctx.env`) |
| Rendering | `pixi.js ^8` **peer dependency**, loaded lazily with `import()`. WebGPU first, Pixi's WebGL fallback. No DOM, no React: screens are JSX laid out by `yoga-layout` (bundled, lazy) |
| Dev tools | `@moku-labs/editor` 0.8.0 (dev dep). `moku-editor --root .` asks the engine for the dev page with the agent `@moku-labs/editor/agent/page` on it; tools page prebuilt; `moku-editor mcp` for Claude Code |
| Optional peers | `sharp` (asset pack: `moku-game build` and `pack`), `playwright-core` (pixel leg of visual tests), `typescript` (the project index; 6.x, the JS API), `@moku-labs/system` (the system shell, the store save), `@moku-labs/native` (`moku-game native`) |
| Native | `config.ts` names `native` and `system`; `moku-game native build ios` runs `@moku-labs/native` (Tauri 2) over it, and the page wires `@moku-labs/system`. The game imports neither. See `references/device.md` |
| Package manager | Bun only. ESM only, `"sideEffects": false`, no CJS |
| Engines | node ≥24, bun ≥1.3.14. TypeScript strict with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` |

`tsconfig.json` of a game sets `"jsx": "react-jsx"` and `"jsxImportSource": "@moku-labs/game"`.

## Idiomatic layout of a game

A game is a folder at the project root, the way the engine's fixture `tests/fixtures/mini-game/` and the
reference game `merge-game` (moku-labs/demos) are. No `src/`, no `web/`, no `bunfig.toml`: the bin
`moku-game` writes the page into `.moku/`, and every command takes `--root .`.

```
index.ts                  export default defineGameApp({ ... }): the game as one data object
config.ts                 export default { page, native?, system?, save?, assets? } satisfies GameConfig
game.ts                   the root flow only, its nodes taken from the @features barrel
core/
  state.ts                Player and Session types, startingPlayer, startingSession
  kit.ts                  the one defineGame<…>() call; exports defineNode, defineFlow, projection, tr, …
  tables.ts               balance data as plain objects
shared/                   the shared layer: index.ts (the feature "shared"), assets/, strings/, views/, rules/
features/index.ts         the barrel: only index.ts and game.ts import it
features/<f>/
  index.ts                the door: defineFeature("<f>", { scenes, projections, … }) and the public nodes
  flow/                   one file per node, sub-flows
  rules/                  pure functions (state, input, tables) => result
  views/                  projections and components (JSX), the scene
  styles/  motion/  world/  assets/  strings/<locale>.json
plugins/                  the game's own plugins, listed in `plugins` of index.ts
generated/                written by `bun run keys`: assets.ts, strings.ts, strings.<locale>.ts
manifest.json             written by `bun run keys`; the page fetches it next to itself
tests/                    tests/scenarios/<name>.ts are the saves of ?player=<name>; tests/visual/, tests/e2e/
.moku/                    what moku-game and moku-editor write; git-ignored
```

Rules of the layout: core ← shared ← features ← `game.ts`, and plugins import core and shared
(`moku-game/layer-imports`). Another feature is imported through its door, `@features/<f>`
(`moku-game/feature-door`). The tsconfig `paths` are `@core/*`, `@shared`, `@shared/rules`, `@features`,
`@features/*`, `@plugins`, `@generated/*`, `@tests/*`. `rules/` import only their siblings (L4). Nodes
import the kit, never `pixi.js`. Asset keys are typed from `generated/assets.ts` (`AssetKey`,
`BundleKey`, `FontKey`, `AudioKey`, `nineSlice`), never spelled as plain strings elsewhere. A game on the
older flat layout (`kit.ts`, `nodes/`, `flows/` at the root) still lints: the layout rules skip files
outside the layers.

## defineGameApp shape

```ts
// index.ts
import { startingPlayer, startingSession } from "@core/state";
import { boardFeature, homeFeature, hudFeature } from "@features";
import { defineGameApp } from "@moku-labs/game/app";
import { exitPlugin } from "@plugins";
import { sharedFeature } from "@shared";
import { mainFlow } from "./game";

export default defineGameApp({
  flow: mainFlow,
  safeNode: "home",
  player: startingPlayer,
  session: startingSession,
  referenceLong: 1920,
  shared: sharedFeature,
  features: [homeFeature, boardFeature, hudFeature],
  plugins: [exitPlugin],
  headless: { features: [boardFeature] },
  pluginConfigs: { text: { fonts: { body: "ui.font-body", digits: "ui.font-display" } } }
});
```

- `defineGameApp` creates no app. It returns `{ headless(seams?), screen(seams?) }`; each call gives a
  fresh app, not started, and `{ app, clock, provider }`. Every type comes from the object.
- `game.screen()` composes the five logic plugins (`time`, `lifecycle`, `model`, `clock`, `flow`), the
  nine of `screen` (`world`, `renderer`, `input`, `assets`, `scenes`, `anim`, `i18n`, `text`, `ui`),
  `audio`, `effects`, `platform`, then `shared`, the features and the game's plugins.
  `game.headless()` composes the logic plugins, `logicOnly` of `headless.features`, then
  `headless.plugins`.
- Seams of both: `seed`, `clock`, `provider`, `player`, `session`. Screen only: `manifest`, `io`,
  `platform`, `keepAwake`, `audio`, `renderer`. Defaults: `fakeClock(startMoment)` (`1_000_000`), a fresh
  `memory()` save, seed 42. Without a `renderer.mount` the renderer is inert, so `game.screen()` runs in
  plain Bun too.
- The shell owns some plugin configs, so they are not in the type of `pluginConfigs`: `model`
  `playerProvider`, `initialPlayer`, `initialSession`, `seed`; all of `clock` and `platform`; `flow`
  `mainFlow`, `safeNode`; `renderer.mount`; `assets` `manifest`, `io`; `audio.context`. Such a key is a
  compile error.
- The game never calls `flow.run()`. The page runs the graph after `app.start()`; a test hands the app to
  `createHeadless`. The screen answers with `app.flow.gate.answer({ intent, payload })`.
- An exit plugin answers a node's `fx({ kind: "exit" })` with `ctx.require(platformPlugin).exit()`. On the
  web page without a provider it does nothing.
- `log` and `env` from `@moku-labs/common` are on every context (`ctx.log`, `ctx.env`).

```ts
// config.ts: plain data, no call
import type { GameConfig } from "@moku-labs/game/app";

export default {
  page: { title: "Timber Town", lang: "en", background: "#10161d", orientation: "portrait" },
  native: { name: "Timber Town", identifier: "com.example.timber", icon: "assets/icon.png" },
  system: ["lifecycle", "back", "haptics", "keepAwake"],
  save: "local",
  assets: { layers: { shared: "ui" } }
} satisfies GameConfig;
```

| Command | What |
|---|---|
| `moku-game dev [--port 3000] [--packed]` | Writes `.moku/{index.html,dev.ts,main.ts,bunfig.toml}` and serves the page with hot reload on `127.0.0.1`. `--port 0` takes a free port |
| `moku-game build [--out dist/web]` | Packs the assets, bundles the page minified with `__MOKU_GAME_DEV__` defined `false`. No scenario, no agent, no `.dev` module, no `/control` |
| `moku-game keys [--check]` | `generated/assets.ts`, the compiled strings, `manifest.json` |
| `moku-game pack [--no-cache]` | The production pack in `dist/assets` (needs `sharp`) |
| `moku-game native build <target> [--simulator]`, `native dev`, `native doctor`, `native clean` | One verb of `@moku-labs/native` over `config.ts`; the Tauri project in `.moku/tauri`, the apps in `dist-native` |

Every command takes `--root <dir>`, `--preload <path>` and `--serve-plugin <path>`. The page
`startPage(game, config, options)` sets `globalThis.game`, `globalThis.system` and `globalThis.doors`,
and `?player=<name>` starts from `tests/scenarios/<name>.ts` on a fresh memory save. The whole shell is
`docs/shell.md` of the engine.

## defineGame and the authoring helpers

`defineNode` and `defineFlow` are **not root exports**. They come from one `defineGame<Types>()` call in
`core/kit.ts`, typed by the game's `player`, `session`, `assets`, `bundles`, `scenes`, `strings`, `textStyles`
and `emitters`. A texture key, a bundle, a message key or a style the game does not have does not compile.

```ts
// core/kit.ts
import type { AssetKey, BundleKey } from "@generated/assets";
import type { Strings } from "@generated/strings";
import { defineGame } from "@moku-labs/game";
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
| Tags | `screen`, `layer`, `row`, `column`, `stack`, `spacer`, `panel`, `image`, `icon`, `text`, `button`, `scroll`, `input`. Every tag takes a `key` and `components` |
| Draw a sprite | Put `apple.png` in `features/fruit/assets/`, run `bun run keys`, then `<image key="apple" texture="fruit.apple" fit="contain" style={{ width: 160, height: 160 }} />`. `texture` is a typed `AssetKey`; an unknown key does not compile. `fit` is `"contain"` (default), `"cover"` or `"fill"`. A `name{nine=l,t,r,b}.png` file draws as a nine-slice panel |
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
`projections`, `ui`, `locate`, `render`, `effects`, `sounds`, `audioMuted`, `assets`, `log`, `explain`, `diff`, `schema`,
`at`. `game.rect` is gone since 0.4.0: `locate` takes `{ key }` or `{ target: { projection, key } }`.
Base commands (`commands.*`): `answer`, `tap`, `drag`, `key`, `fill`, `walk`, `bookmark`, `restore`, `step`,
`pause`, `resume`, `capture`, `debug`, `reducedMotion`, `timeScale`, `mute`, `trace`. `capture` takes
`{ legend?, layers?, sheet?, diff? }` and answers `{ png, legend? }`, not a bare string. The catalogue is
plain data shaped for MCP tools (id, title, input schema); no MCP server ships yet. Effects: `read`, `route`, `cosmetic`, `cheat`, `raw`; a `cheat` or `raw` taints the
session and is journaled.

`__MOKU_GAME_DEV__` is a global the engine declares and reads, never sets. A game never re-declares it.
Dev page: `moku-game dev` defines it `true` in `.moku/bunfig.toml` and sets it in `.moku/dev.ts`.
Production: `moku-game build` defines it `false` and strips every command body. Tests:
`vi.stubGlobal("__MOKU_GAME_DEV__", true)`.

The page the engine writes exposes the handles the editor, the visual tests and Claude use:
`globalThis.game` (the app), `globalThis.doors` (`read`, `watch`, `sources`; in dev also `run` and
`commands`) and `globalThis.system` (the system app, or `undefined`). A game's own sources and commands
live in `.dev.ts` modules (`dice.dev.ts`). The editor's page imports every `**/*.dev.ts` and hands them to
the agent; `moku-game build` imports none. Every command body starts with the inline guard
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
- `bun run keys` (`moku-game keys`) runs the `./assets` door with the layers of `config.ts`: it writes `manifest.json` (v1, loose files),
  `generated/assets.ts` (the key unions and `nineSlice`), `generated/strings.ts` (the `Strings` type)
  and one `generated/strings.<locale>.ts` per locale from `features/*/strings/<locale>.json`.
  `--check` fails when any output is stale. `moku-game pack` writes the production pack to `dist/assets`:
  WebP atlas pages, content-hashed names, a v2 manifest (needs `sharp`); `moku-game build` packs first.
  The asset CLI also takes `--pseudo` (the pseudo-locale `en-XA`) and `--export <dir>` / `--import <dir>`
  to exchange strings with translators (`--source <locale>`, default `en`).
- `assets.layers` of `config.ts` scans a layer like a feature: `{ shared: "ui" }` keys `shared/assets/*`
  as `ui.*`. A game without `config.ts` runs the older bin `moku-game-assets --root .` itself.
- Strings: ICU adds `{x, duration, short}`; a value may be `{ "text": "…", "note": "for the translator" }`.
- The page fetches `manifest.json` next to itself; paths in it are relative to that URL. Text needs an MSDF font:
  the built-in styles `body` and `digits` read `text.fonts` (default `ui.font-body`, `ui.font-digits`).
  The package ships the body font: `cp node_modules/@moku-labs/game/fonts/font-body.* shared/assets/`
  and its `LICENSE.txt` beside `assets/`. No digits font ships. Other faces: `msdf-bmfont-xml` (BMFont
  XML, one 512×512 page).

## Testing

- **Headless**: `createHeadless(app)` from `@moku-labs/game/testing` sets fast mode, starts the app and
  resolves at the first rest node. `game.walk([{ at: "home", intent: "roll" }])` plays a route;
  `game.answer`, `game.state()`, `game.history()`, `game.stop()`. Seams: `fakeClock(start)` with
  `advance(ms)`, `memory()` save provider with `calls`, `saveOf(player, seed)`, `runRepro`, `stepFrames`.
  The app comes from `game.headless(seams?)` of the root `index.ts`: seed 42, `fakeClock(startMoment)`,
  a fresh `memory()` save. `isolate(feature, { flow, player, stubs })` plays one feature alone.
- **Visual**: `defineVisualTest(name, { start: { player, checkpoint }, steps, webgl? })`. A step is a
  `/control` command by short name (`{ tap: { key: "play" } }`, `{ answer: {...} }`, `{ walk: {...} }`,
  `{ step: {...} }`) or `{ checkpoint: "name" }`. `runVisualTests({ app: () => game.screen().app,
  page: { url: "http://127.0.0.1:3000/" } }, tests, options)` from `@moku-labs/game/visual` plays the headless leg in Bun (compares
  `state.json` and `describe.json` exactly, runs in `bun run test`) and the pixel leg in Chrome on a Mac
  (compares `screen.webp`, tolerance 24 per channel and 0.1 % of pixels). `--update` rewrites baselines,
  only for intended changes. `--no-pixels`, `--only <name>`, `--webgl`, `--url <page>`. The page is the
  contract: `globalThis.game` and `globalThis.doors` on a dev build. Pixel leg needs `bun add -d playwright-core`.
- **Doors in tests**: `vi.stubGlobal("__MOKU_GAME_DEV__", true)`, then `read(app, sources.position)`,
  `await run(app, commands.walk, { route })`. A headless `watch` reads on frames a test steps:
  `app.time.step(16)`.
- **Scenarios**: `tests/scenarios/<name>.ts` default-exports a `Scenario<Player>`, `(now) => ({ player,
  session? })`. The dev page opens it with `?player=<name>`; a test starts from it with
  `game.headless({ player: ready(startMoment).player })`.
- Layout: `tests/integration/` for whole-game tests, `features/<f>/__tests__/` for feature tests,
  `tests/visual/*.visual.ts`, `tests/e2e/*.e2e.ts` (`moku-game/test-suffix` checks the suffixes).

## Lint rules L1–L13 (the engine's lint config; a game follows the same rules)

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
| L13 | No import of `@moku-labs/system`, `@moku-labs/native` or `@tauri-apps/*` in a game: `config.ts` names the capability, the engine page wires it |

A game enforces L2, L3, L4, L5, L13 and the layout with oxlint. The engine ships the rules as the oxlint
JS plugin `@moku-labs/game/lint` (plugin name `moku-game`). The game's `.oxlintrc.json` lists it in
`jsPlugins` and turns the ten rules on (`references/hello-world.md`):

| Rule id | Engine rule | Reports |
|---|---|---|
| `moku-game/lazy-imports` | L2 | A static value import of `pixi.js` or `yoga-layout`. `import type` and `import()` pass; `import { type A }` is reported |
| `moku-game/native-imports` | L13 | `@moku-labs/system`, `@moku-labs/native`, `@tauri-apps/*` in the logic, the root `index.ts` and `config.ts`, `kit.ts`, `plugins/` |
| `moku-game/dev-imports` | dev only | `@moku-labs/editor` and `@moku-labs/game/control` outside `*.dev.ts(x)` and tests |
| `moku-game/no-module-state` | L5 | A module-scope `let` or `var`, a module-scope `new Map/Set/WeakMap/WeakSet` |
| `moku-game/determinism` | L3 | `Math.random`, `Date.now`, `performance.now`, `new Date()`, `setTimeout`, `setInterval` in the logic. `new Date(now)` passes |
| `moku-game/rules-siblings` | L4 | An import in `rules/` other than a sibling, `@core/types` or `@shared/rules` |
| `moku-game/static-keys` | keys | A JSX `key` the project index cannot follow (`a ?? b`, `item.name`, a table lookup). Pass it in as `props.id` or `props.<name>Key` |
| `moku-game/layer-imports` | layers | An import that reaches a layer above its own. Order: core ← shared ← features ← `game.ts`; plugins import core and shared |
| `moku-game/feature-door` | doors | A deep import of another feature, `@features` / `@plugins` below `game.ts`, a feature importing its own door, a relative import that leaves a feature |
| `moku-game/test-suffix` | tests | A file in `tests/e2e/`, `tests/visual/`, `tests/editor/` or `__tests__/` without `.e2e.ts`, `.visual.ts`, `.editor.ts`, `.test.ts` |

The logic is the root `index.ts`, `**/state.ts`, `**/tables.ts`, `**/game.ts`,
`**/{core,nodes,flows,rules,features,shared}/**`. Tests are skipped by every rule but `test-suffix`.
Each rule takes `["error", { "files": [...], "ignores": [...] }]`; a key given replaces its default,
and the defaults match the template layout. The layout rules also take `root` and `tsconfig` and read the
tsconfig `paths`. A legacy game keeps its `eslint.config.ts` G-blocks until
the opt-in `moku-lint-oxlint` upgrade. `moku-game-validator` checks what lint cannot see.

JSDoc in a game is always the multi-line form (`/**` on its own line), never `/** one line */`.

## The editor

```sh
bunx moku-editor --root .          # the game's "editor" script
```

- A game wires nothing. The bin asks the engine for the dev page (`preparePage` of
  `@moku-labs/game/cli`) with the editor's page agent `@moku-labs/editor/agent/page` on it, then serves it
  under the page's `.moku/bunfig.toml`. The agent starts with `bridgePlugin` and `capturePlugin` after the
  game and sets `globalThis.editor`. `moku-game build` keeps 0 B of editor code.
- It prints `Game http://127.0.0.1:3000/`, `Tools http://127.0.0.1:3000/__editor/` and the root. Flags:
  `--root`, `--port` (`0` for a free port), `--no-hmr`, `--preload`, `--serve-plugin`. Bun only.
- The project index needs TypeScript with its JS API (6.x). On TypeScript 7 the bin logs
  `files:project-off` and a pick has no `file:line`.
- `moku-editor mcp` is the stdio MCP server for Claude Code: `claude mcp add moku-editor -- bunx
  moku-editor mcp --port 3000`. It uses the running bin or starts one.
- A game with its own HTML page still runs `moku-editor <game-html> --root .` and wires the agent itself;
  a shell game never does.
- The tools page: six workspaces, ⌘1–⌘6 (Game, Flow, Render, State, Files, Console; Game is the default),
  `⌘K` palette, `P` pause / resume, `.` step one frame while paused, `O` overlay in game, `G` preview,
  `R` Reference mode, `H` hot reload state, ⌘⇧C the element picker, `Esc` closes one thing. Captures go
  to `.moku/captures/`.
- A pick bookmarks the game and writes a card `.moku/captures/<key>-f<frame>.md` with the element's path,
  `file:line`, layout, bounds in px and reference units, flow position, the JSX and style snippets, and
  two PNGs. It also copies one `@moku …` line naming the card.
- The server binds `127.0.0.1` only and gates every socket with Host, Origin and a per-start token.
- A save of a game source (Files, or an agent writing the file) reloads the page through Bun and restores
  the game where it was, in about a second. The session reads as tainted afterwards.
- Editor 0.8 peers on game ≥0.10. A source the game does not have shows as "not installed", not as an
  error. The Sound switch runs `game.mute`.
  Recipes are in `references/editor.md`.

## Native packaging and the system shell

A game imports no native package (L13) and writes no bridge. It names what it needs in `config.ts`:

- `system: ["lifecycle", "back", "haptics", "keepAwake", "store"]` (any subset). The page `moku-game`
  writes imports `systemShellOf` from `@moku-labs/game/app/system` with one `import()` per named plugin,
  builds the `@moku-labs/system` app, and passes its provider to `platform`: pause and resume become the
  `"background"` reason, Back runs the Back chain, `haptic` reaches the haptics plugin, keep-awake holds
  the wake lock. A web-only game with `system: []` bundles no system code. Install
  `@moku-labs/system@0.3.1` when the list is not empty or `save` is `"store"`.
- `native: { name, identifier, icon?, targets? }`. `moku-game native build ios --simulator` (or `android`,
  `macos`; `native dev`, `native doctor`, `native clean`) runs `@moku-labs/native@0.3.2` (a dev
  dependency) over it: the web build is `moku-game build`, the system rows come from `system`, the Tauri
  project lands in `.moku/tauri` and the apps in `dist-native`. See
  [`references/device.md`](references/device.md) and the `moku-native:moku-native` skill.
- An exit button: a node asks with `fx({ kind: "exit" })`, the game's exit plugin answers with
  `ctx.require(platformPlugin).exit()`. It leaves the app where the shell can, and does nothing on the web.

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
- The whole shell: `docs/shell.md` of the engine, or the "The game shell" section of `llms.txt`.
- Testing protocol: the `moku:moku-testing` skill. Native: `moku-native:moku-native`. System: `moku-system:moku-system`.
