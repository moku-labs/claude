# Hello world — the minimal screen game

The exact files `moku:init` scaffolds for `type: game`. One rest node, one transit node, one feature with a
screen that shows "Hello, world" and a tappable button that counts taps. It runs headless in Bun, on the
engine's dev page, in the editor, and is the smallest game the playtest station can drive.

The game is a folder on the **game shell** of `@moku-labs/game` 0.11: `index.ts` is the game as one data
object (`defineGameApp`), `config.ts` is the page as plain data, and the engine bin `moku-game` writes
the page, serves it, builds it and packs the art. A game writes no page, no server, no `web/`, no
`native.ts`, no `platform-bridge.ts` and no `bunfig.toml`. The layout is the engine's layered one:
`core/`, `shared/`, `features/`, and `game.ts` for the root flow.

Derived from the engine's fixture `tests/fixtures/mini-game/`, its `docs/shell.md` and `llms.txt`, and
the reference game `merge-game` in moku-labs/demos. Verified end to end (install, `keys`, typecheck,
lint with the ten engine rules, tests with coverage, `keys --check`, `build`, `moku-game dev`,
`moku-editor --root .` with the project index on, lefthook pre-commit) against `@moku-labs/game@0.11.0`,
`@moku-labs/editor@0.8.0`, `pixi.js@8.22.0`, Bun 1.3.14 and the init tooling stack (`oxlint@1.86.0`,
`vitest@4.0.18`, `typescript@6.0.3`). When something here does not compile, read
`node_modules/@moku-labs/game/llms.txt` first: it is the engine in one page and always matches the
installed version. The editor ships `llms.txt` and `llms-full.txt` (`node_modules/@moku-labs/editor/`).

## Install

Pin exact versions. A game has no `bunfig.toml`, so pass `--exact`.

```sh
bun add --exact @moku-labs/game@0.11.0 pixi.js@8.22.0 @moku-labs/core@1.7.1 @moku-labs/common@0.3.4
bun add --exact -d @moku-labs/editor@0.8.0 sharp@0.34.5
```

`@moku-labs/core` and `@moku-labs/common` are peers of both packages; pin them so the game and the
editor share one copy. `pixi.js` (`^8`) is a peer of the engine. `sharp` is an optional peer: `moku-game
build` and `pack` need it for the asset pack. `@moku-labs/editor@0.8.0` peers on `@moku-labs/game
>=0.10.0` and `typescript >=5.5`.

Every other dev dependency is init's tooling set of the current lint stack, at the versions
`tooling-config.md` pins: `@types/bun`, Vitest, `@vitest/coverage-istanbul`, Biome, oxlint,
`eslint-plugin-jsdoc`, `eslint-plugin-unicorn`, lefthook, and `@moku-labs/ci` from init Step 4. Two
changes for a game:

- **TypeScript `6.0.3`, not 7.** The editor's project index reads the code through the TypeScript JS
  API, and TypeScript 7 has none. On 7.0.2 the editor starts but logs `files:project-off`, and a pick
  loses its `file:line`.
- Leave out the package-only `@arethetypeswrong/*`, `publint` and `tsdown`: `moku-game build` builds the
  game.

Never add `vitest@latest`: the coverage plugin must be the same version as Vitest. The engine's lint
rules need no package of their own: they ship in `@moku-labs/game` as `@moku-labs/game/lint`.

A game in a native shell adds the optional peers later: `bun add --exact @moku-labs/system@0.3.1` when
`config.ts` names a `system` plugin or `save: "store"`, and `bun add --exact -d @moku-labs/native@0.3.2`
for `moku-game native`. See `device.md`. The hello world installs neither.

## Font

Text is drawn from an **MSDF bitmap font**. Without one the `text` tag draws nothing. The game package
ships one: Pangolin Regular, SIL OFL 1.1, one 512×512 page, under the subpath `fonts/`. Copy it into the
shared layer; a path in `node_modules` is never an asset key.

```sh
mkdir -p shared/assets
cp node_modules/@moku-labs/game/fonts/font-body.* shared/assets/
cp node_modules/@moku-labs/game/fonts/LICENSE.txt shared/LICENSE-fonts.txt
```

`config.ts` scans `shared/` as the layer `ui` (`assets.layers: { shared: "ui" }`), so the font's key is
`ui.font-body`, the default of `text` config `fonts.body`. The built-in style `body` needs no config.
`ui` is a plugin name, so no feature is called `ui`. The licence sits beside `assets/`, not inside it.
The `.fnt` names its page `font-body.png`, so keep both file names. No `digits` font ships: a game that
uses the style `digits` brings `ui.font-digits` itself. For another face, build the pair from an OFL
`.ttf` with `msdf-bmfont-xml`: BMFont XML, one 512×512 page.

## Layout

```
package.json  tsconfig.json  vitest.config.ts  biome.json  .oxlintrc.json  lefthook.yml  .gitignore
.github/workflows/ci.yml
index.ts  config.ts  game.ts  manifest.json*
core/{state.ts, kit.ts}
shared/{index.ts, assets.ts, LICENSE-fonts.txt, assets/font-body.fnt, assets/font-body.png}
features/index.ts
features/hello/{index.ts, flow/home.ts, flow/tap.ts, views/scene.ts, views/hello-screen.tsx, strings/en.json}
generated/{assets.ts, strings.ts, strings.en.ts, strings.en-XA.ts}*
tests/scenarios/ready.ts
tests/integration/hello.test.ts
```

`*` written by `bun run keys`. Commit them; `build` runs `moku-game keys --check` first, so CI keeps them
honest. `.moku/` (the dev page, the editor's captures, the Tauri project) and `dist/` are git-ignored.

| Path | Layer | Imports |
|---|---|---|
| `core/` | core | core, generated |
| `shared/` | shared | core, shared, generated |
| `features/<f>/` | features | core, shared, generated, another feature through `@features/<f>` only |
| `game.ts` | the root flow | every layer; the only file below `index.ts` that imports `@features` |
| `index.ts`, `config.ts` | the game, the page | anything |

The lint rules check this order. A feature imports the kit as `@core/kit`, never `../../core/kit`.

## Tooling a game changes

Init writes the tooling files of `tooling-config.md`, current lint stack: Biome + oxlint. A game has no
`src/` and no npm package, so these change:

| File | For a game |
|---|---|
| `package.json`, `tsconfig.json` | The two below. |
| `vitest.config.ts`, `lefthook.yml` | The two below. |
| `biome.json`, `.oxlintrc.json` | The tooling file with the edits below. |
| `.gitignore` | The tooling file plus `.moku` and `dist-native`. `moku-game dev` warns until `.moku/` is in it. |
| `bunfig.toml` | Not written. A game has none; the engine writes its own under `.moku/`. Pin with `bun add --exact`. |
| `tsconfig.build.json`, `tsdown.config.ts` | Not written. `moku-game build` builds the game. |

The rest is unchanged: `.bun-version`, `.editorconfig`, `cspell.json`, `CLAUDE.md`. No `eslint.config.ts`
and no `declarations.d.ts`. The CI is `examples/app/ci.yml` of `@moku-labs/ci`, without its
`build_worker_script` and `migrate_script` lines (init Step 4).

`biome.json`: `files.includes` names the game folders instead of `src/**`, the `src/**/__tests__/**`
override goes, and one override comes. A JSX `<button>` here is a game tag, not an HTML button, so
`useButtonType` is off for `.tsx`, as in the engine's own repo. `generated/`, `manifest.json` and `.moku/`
stay out: their writers own the format.

```json
"files": { "includes": ["*.ts", "{core,shared,features,plugins,tests}/**"] },
```

```json
{ "includes": ["**/*.tsx"], "linter": { "rules": { "a11y": { "useButtonType": "off" } } } }
```

`.oxlintrc.json`: the tooling body with four edits.

1. `jsPlugins`: the engine's plugin `moku-game` after the two tooling entries.

   ```json
   "jsPlugins": [
     { "name": "jsdoc-js", "specifier": "eslint-plugin-jsdoc" },
     { "name": "unicorn-js", "specifier": "eslint-plugin-unicorn" },
     "@moku-labs/game/lint"
   ],
   ```

2. `ignorePatterns`:

   ```json
   "ignorePatterns": ["dist/**", "dist-native/**", "coverage/**", "generated/**", ".moku/**", ".claude/**", ".planning/**"],
   ```

3. `rules`: the ten engine rules added after the tooling rules.

   ```json
   "moku-game/lazy-imports": "error",
   "moku-game/native-imports": "error",
   "moku-game/dev-imports": "error",
   "moku-game/no-module-state": "error",
   "moku-game/determinism": "error",
   "moku-game/rules-siblings": "error",
   "moku-game/static-keys": "error",
   "moku-game/layer-imports": "error",
   "moku-game/feature-door": "error",
   "moku-game/test-suffix": "error"
   ```

4. `overrides`: the first entry gets the game's files, the `src/**/types.ts` entry goes (a game has no
   plugin `Api` types), the test entry gets the game's files. The `*.config.ts` entry stays last.

   ```json
   "files": ["*.ts", "{core,shared,features,plugins}/**/*.{ts,tsx}"]
   ```

   ```json
   "files": ["tests/**/*.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}"]
   ```

The rules come from `@moku-labs/game/lint`. Their defaults match this layout, so they take no options
here. The full table is in `docs/lint.md` of the engine and in `plugin-index.md`.

| Rule | Reports |
|---|---|
| `moku-game/lazy-imports` (L2) | A static value import of `pixi.js` or `yoga-layout`. `import type` and `import()` pass. `import { type A }` is reported: write `import type`. |
| `moku-game/native-imports` (L13) | `@moku-labs/system`, `@moku-labs/native`, `@tauri-apps/*` in the logic, the root `index.ts` and `config.ts`, `kit.ts`, `plugins/`. Name the capability in `config.ts` `system`; the engine page wires it. |
| `moku-game/dev-imports` | `@moku-labs/editor`, `@moku-labs/game/control` outside `*.dev.ts(x)` and tests. |
| `moku-game/no-module-state` (L5) | A module-scope `let` or `var`, a module-scope `new Map/Set/WeakMap/WeakSet`. |
| `moku-game/determinism` (L3) | `Math.random`, `Date.now`, `performance.now`, `new Date()`, `setTimeout`, `setInterval` in the logic. `new Date(now)` passes. |
| `moku-game/rules-siblings` (L4) | An import in `rules/` that is not a sibling, `@core/types` or `@shared/rules`. |
| `moku-game/static-keys` | A JSX `key` the project index cannot follow: `a ?? b`, `item.name`, a table lookup. Pass the key in as `props.id` or `props.<name>Key`. |
| `moku-game/layer-imports` | An import that reaches a layer above its own: `@features/home` from `shared/`. |
| `moku-game/feature-door` | A deep import of another feature, `@features` below `game.ts`, a relative import that leaves a feature. |
| `moku-game/test-suffix` | A file in `tests/e2e/`, `tests/visual/`, `tests/editor/` or `__tests__/` without the folder's suffix (`.e2e.ts`, `.visual.ts`, `.editor.ts`, `.test.ts`). `tests/integration/` and `tests/scenarios/` are not checked. |

The logic is the root `index.ts`, `**/state.ts`, `**/tables.ts`, `**/game.ts` and
`**/{core,nodes,flows,rules,features,shared}/**`. Every rule but `test-suffix` skips the tests. Every
rule takes `["error", { "files": [...], "ignores": [...] }]`; a key given replaces its default. A disable
comment names the rule: `// eslint-disable-next-line moku-game/determinism -- <why>`. Door guards, asset
keys and the kit stay with `moku-game-validator`.

```ts
// vitest.config.ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The layer aliases of tsconfig.json `paths`, which vitest does not read: the same table, here.
const at = (folder: string) => fileURLToPath(new URL(folder, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@core\/(.*)$/, replacement: `${at("./core/")}$1` },
      { find: /^@shared$/, replacement: at("./shared/index.ts") },
      { find: /^@shared\/rules$/, replacement: at("./shared/rules/index.ts") },
      { find: /^@features$/, replacement: at("./features/index.ts") },
      { find: /^@features\/([^/]+)$/, replacement: `${at("./features/")}$1/index.ts` },
      { find: /^@plugins$/, replacement: at("./plugins/index.ts") },
      { find: /^@generated\/(.*)$/, replacement: `${at("./generated/")}$1` },
      { find: /^@tests\/(.*)$/, replacement: `${at("./tests/")}$1` }
    ]
  },
  test: {
    include: ["tests/**/*.test.ts", "**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "istanbul",
      include: ["index.ts", "game.ts", "{core,shared,features,plugins}/**/*.ts"],
      exclude: ["**/__tests__/**", "**/*.tsx"],
      reporter: ["text", "lcov"],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 }
    }
  }
});
```

Coverage counts the logic a headless test reaches: the game, the root flow, core, shared, features,
plugins. It leaves out the `.tsx` views: their `from` and `view` run on the page, which `moku-game dev`
and the e2e station drive. The family's 90% stays.

```yaml
# lefthook.yml
pre-commit:
  skip:
    - run: test ! -d node_modules
  jobs:
    - name: build
      run: bun run build
    - name: biome-format
      glob: "*.{ts,tsx,js,mjs,cjs,json,jsonc}"
      run: bunx biome check --write --no-errors-on-unmatched --files-ignore-unknown=true --colors=off {staged_files}
      stage_fixed: true
    - name: oxlint-check
      glob: "*.{ts,tsx,js,mjs,cjs}"
      run: bunx oxlint --no-error-on-unmatched-pattern {staged_files}
    - name: typecheck
      run: bun run typecheck
    - name: test
      run: bun run test
```

This is the app variant of the tooling hook. The package hook runs `validate`, `test:unit` and
`test:integration`; a game has none of them. `--no-error-on-unmatched-pattern` keeps the hook quiet
when every staged file is ignored, for example `generated/`.

## package.json

```json
{
  "name": "hello-game",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "moku-game dev",
    "editor": "moku-editor --root .",
    "keys": "moku-game keys",
    "pack": "moku-game pack",
    "build": "moku-game keys --check && moku-game build",
    "native": "moku-game native",
    "lint": "biome check . && oxlint",
    "lint:fix": "biome check --write . && oxlint --fix",
    "format": "biome format --write .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "deploy": "echo 'No deploy target yet: the release station picks one.'"
  },
  "engines": { "node": ">=24.0.0", "bun": ">=1.3.14" },
  "dependencies": {
    "@moku-labs/common": "0.3.4",
    "@moku-labs/core": "1.7.1",
    "@moku-labs/game": "0.11.0",
    "pixi.js": "8.22.0"
  },
  "devDependencies": {
    "@biomejs/biome": "2.4.16",
    "@moku-labs/editor": "0.8.0",
    "@types/bun": "1.3.14",
    "@vitest/coverage-istanbul": "4.0.18",
    "eslint-plugin-jsdoc": "65.1.0",
    "eslint-plugin-unicorn": "63.0.0",
    "lefthook": "2.1.1",
    "oxlint": "1.86.0",
    "sharp": "0.34.5",
    "typescript": "6.0.3",
    "vitest": "4.0.18"
  }
}
```

Init Step 4 adds `@moku-labs/ci` to `devDependencies`.

| Script | Runs |
|---|---|
| `dev` | `moku-game dev`: the game page with hot reload on `http://127.0.0.1:3000/`, no tools |
| `editor` | `moku-editor --root .`: the same page with the editor's agent, plus the tools page on `/__editor/` |
| `keys` | `generated/assets.ts`, the compiled strings and `manifest.json`, with the layers of `config.ts` |
| `pack` | The production pack in `dist/assets` (WebP atlas pages, content-hashed names; needs `sharp`) |
| `build` | `keys --check`, then the pack and the production page in `dist/web`, `__MOKU_GAME_DEV__` defined `false` |
| `native` | One verb of `@moku-labs/native` over `config.ts`: `bun run native build ios --simulator`. Needs `native` in `config.ts` |

The CI runs `lint`, `typecheck`, `test:coverage` and `build` on every push and pull request, and
`deploy` on every push to `main`. `deploy` is a placeholder until the release station picks a target.
Every `moku-game` command takes `--root <dir>` (default `.`), `--preload <path>` and `--serve-plugin
<path>`; `dev` takes `--port <n>` (`0` for a free port) and `--packed`.

## tsconfig.json

```json
{
  "compilerOptions": {
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "target": "ESNext",
    "module": "Preserve",
    "moduleDetection": "force",
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "skipLibCheck": true,
    "types": ["bun"],
    "jsx": "react-jsx",
    "jsxImportSource": "@moku-labs/game",
    "paths": {
      "@core/*": ["./core/*"],
      "@shared": ["./shared/index.ts"],
      "@shared/rules": ["./shared/rules/index.ts"],
      "@features": ["./features/index.ts"],
      "@features/*": ["./features/*/index.ts"],
      "@plugins": ["./plugins/index.ts"],
      "@generated/*": ["./generated/*"],
      "@tests/*": ["./tests/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules", "dist", "dist-native", ".moku"]
}
```

The `paths` are the engine's layer aliases. Bun and the lint rules read them from here; vitest gets the
same table in its own config.

## config.ts

```ts
/**
 * @file The page of the game, as plain data: the title and the colour behind the canvas. `moku-game`
 * and the page read it; the game logic never does.
 */
import type { GameConfig } from "@moku-labs/game/app";

export default {
  page: { title: "hello-game", background: "#10161d" },
  save: "local",
  // The shared layer is scanned like a feature named `ui`: `shared/assets/font-body.fnt` is `ui.font-body`.
  assets: { layers: { shared: "ui" } }
} satisfies GameConfig;
```

| Key | Default | What |
|---|---|---|
| `page.title` | required | The page title. Never empty |
| `page.lang`, `page.background`, `page.orientation` | `"en"`, `"#000000"`, `"portrait"` | The page; the native build takes the background and the orientation too |
| `page.icons`, `page.head` | none | `{ favicon?, appleTouch? }` relative to the game; raw `<head>` tags |
| `native` | none | `{ name, identifier, icon?, targets? }`. Left out, the game has no native build |
| `system` | `[]` | `lifecycle`, `back`, `haptics`, `keepAwake`, `store`: the system plugins the page wires |
| `save` | `"memory"` | `"memory"`, `"local"` (`localStorage` under `moku-game:save`, or `<native.identifier>:save`) or `"store"` (needs `@moku-labs/system`) |
| `assets.layers` | `{}` | Asset layers by folder: `{ shared: "ui" }` becomes `--layer shared=ui` |

Plain data, no call. A value TypeScript would refuse, in a file that skips `satisfies`, stops
`moku-game` and the page with a `[game] config.…` line.

## core/state.ts and core/kit.ts

```ts
// core/state.ts
/**
 * @file The state of the game: what a save holds, what one session holds, and the new player.
 */

/**
 * The saved player.
 */
export type Player = { taps: number };

/**
 * The session: never saved.
 */
export type Session = { opened: number };

/**
 * The state of a new player.
 */
export const startingPlayer: Player = { taps: 0 };

/**
 * The session at every start.
 */
export const startingSession: Session = { opened: 0 };
```

```ts
// core/kit.ts
/**
 * @file The authoring helpers bound to the types of this game, once. Asset and bundle keys come from
 * `generated/assets.ts` and message keys from `generated/strings.ts`, so a key the game does not have
 * does not compile.
 */
import type { AssetKey, BundleKey } from "@generated/assets";
import type { Strings } from "@generated/strings";
import { defineGame } from "@moku-labs/game";
import type { Player, Session } from "./state";

export const { defineNode, defineFlow, defineFeature, projection, defineBundles, defineScene, tr } =
  defineGame<{
    player: Player;
    session: Session;
    assets: AssetKey;
    bundles: BundleKey;
    scenes: "hello";
    strings: Strings;
  }>();
```

## shared/

```ts
// shared/assets.ts
/**
 * @file The bundle of the interface, tier "boot": awaited in onStart, never unloaded. It holds the
 * body font. `config.ts` scans this layer as `ui`, the name the `text` config reads by default.
 */
import { defineBundles } from "@core/kit";

export const uiAssets = defineBundles({ ui: { tier: "boot" } });
```

```ts
// shared/index.ts
/**
 * @file The shared layer: one level above the features. It registers as the feature `shared`: the
 * boot bundle `ui` with the body font, and the compiled messages of the whole game. The compiler
 * writes one module per locale, so one feature registers them.
 */
import { defineFeature } from "@core/kit";
import enStrings from "@generated/strings.en";
import { uiAssets } from "./assets";

export const sharedFeature = defineFeature("shared", {
  assets: uiAssets,
  strings: { en: enStrings }
});
```

## features/hello/

```ts
// features/hello/flow/home.ts
/**
 * @file Rest node `home`: the checkpoint the screen is shown on. It waits for the one button.
 */
import { defineNode } from "@core/kit";
import { type } from "@moku-labs/game";

export const home = defineNode({
  scene: "hello",
  outcomes: { tap: type() },
  rest: true,
  checkpoint: true
});
```

```ts
// features/hello/flow/tap.ts
/**
 * @file Transit node `tap`: counts one tap into the save and one into the session.
 */
import { defineNode } from "@core/kit";
import { type } from "@moku-labs/game";

export const tap = defineNode({
  outcomes: { done: type() },
  run: ({ player, session, out }) => {
    player.taps += 1;
    session.opened += 1;
    return out.done();
  }
});
```

```ts
// features/hello/views/scene.ts
/**
 * @file The Hello scene: the bundle and the screen. Every scene gets a `ui` layer on top.
 */
import { defineScene } from "@core/kit";
import { helloScreen } from "./hello-screen";

export const helloScene = defineScene("hello", {
  bundle: "ui",
  layers: {},
  projections: [helloScreen]
});
```

```tsx
// features/hello/views/hello-screen.tsx
/**
 * @file The Hello screen: a greeting, the tap counter and one button that answers the `home` gate
 * with the intent `tap`.
 */
import { projection, tr } from "@core/kit";
import type { Player } from "@core/state";

/**
 * What the screen reads of the player.
 */
export type HelloView = { taps: number };

export const helloScreen = projection({
  name: "hello.screen",
  layer: "ui",
  from: (player: Player): HelloView => ({ taps: player.taps }),
  view: item => (
    <screen
      key="helloScreen"
      style={{ direction: "column", align: "center", justify: "center", gap: 48 }}
    >
      <text key="greeting" style="body" content={tr("hello.greeting")} />
      <text key="taps" style="body" content={tr("hello.taps", { n: item.taps })} />
      <button
        key="tap"
        intent="tap"
        style={{
          width: 480,
          height: 120,
          fill: 0x2f_5a_3b,
          radius: 24,
          align: "center",
          justify: "center"
        }}
      >
        <text key="tapLabel" style="body" content={tr("hello.tap")} />
      </button>
    </screen>
  )
});
```

```json
// features/hello/strings/en.json
{
  "hello.greeting": "Hello, world",
  "hello.taps": "{n, plural, one {# tap} other {# taps}}",
  "hello.tap": "Tap me"
}
```

```ts
// features/hello/index.ts
/**
 * @file Hello as a feature: its scene and its screen. Its two nodes are steps of the root flow in
 * `game.ts`.
 */
import { defineFeature } from "@core/kit";
import { helloScreen } from "./views/hello-screen";
import { helloScene } from "./views/scene";

export { home } from "./flow/home";
export { tap } from "./flow/tap";

export const helloFeature = defineFeature("hello", {
  scenes: [helloScene],
  projections: [helloScreen]
});
```

```ts
// features/index.ts
/**
 * @file The feature barrel: what the root takes from the features. Only `index.ts` and `game.ts`
 * import it; a feature imports another feature through that feature's own door, `@features/<name>`.
 */
export { helloFeature, home, tap } from "./hello";
```

Run `bun run keys` now. It writes `manifest.json` (bundle `ui`, key `ui.font-body`),
`generated/assets.ts` (`AssetKey = "ui.font-body"`, `FontKey`, `BundleKey = "ui"`, `nineSlice`),
`generated/strings.ts` (`Strings = { "hello.greeting": Record<string, never>; "hello.tap":
Record<string, never>; "hello.taps": { n: number } }`), `generated/strings.en.ts` and the pseudo-locale
`generated/strings.en-XA.ts`. Never edit them.

## game.ts and index.ts

```ts
// game.ts
/**
 * @file The root flow: home waits, tap counts, back to home. Each step is a node of a feature,
 * taken from the `@features` barrel; `index.ts` composes the game from it.
 */
import { defineFlow } from "@core/kit";
import { home, tap } from "@features";

export const mainFlow = defineFlow("main", {
  nodes: { home, tap },
  start: "home",
  edges: {
    home: { tap: "tap" },
    tap: { done: "home" }
  }
});
```

```ts
// index.ts
/**
 * @file The game as one data object: the root flow, where a new player and a session start, the
 * shared layer and the features. `game.screen()` composes the engine's screen set and all of it;
 * `game.headless()` the logic only. The seams (clock, save, manifest) come from the caller: a test,
 * or the page `moku-game` writes.
 */
import { startingPlayer, startingSession } from "@core/state";
import { helloFeature } from "@features";
import { defineGameApp } from "@moku-labs/game/app";
import { sharedFeature } from "@shared";
import { mainFlow } from "./game";

export default defineGameApp({
  flow: mainFlow,
  safeNode: "home",
  player: startingPlayer,
  session: startingSession,
  shared: sharedFeature,
  features: [helloFeature]
});
```

`defineGameApp` creates no app. It returns `{ headless(seams?), screen(seams?) }`; each call gives a
fresh app, not started, with a `fakeClock(startMoment)` and a fresh `memory()` save unless a seam passes
one. The game never calls `flow.run()`: the page runs the graph after `app.start()`, and a test hands the
app to `createHeadless`. `pluginConfigs` takes every plugin config but the keys the shell owns
(`model.initialPlayer`, `flow.mainFlow`, `renderer.mount`, `assets.manifest`, all of `clock` and
`platform`, and the rest in `plugin-index.md`): such a key is a compile error. Other keys of the
definition: `referenceLong` (1920), `seed` (42), `plugins` (the game's own, after the features),
`headless: { features?, plugins? }`.

## tests/

```ts
// tests/scenarios/ready.ts
/**
 * @file The prepared save `?player=ready`: three taps already counted. An e2e script, a visual test
 * or the editor starts here instead of tapping its way.
 */
import type { Player } from "@core/state";
import type { Scenario } from "@moku-labs/game/app";

/**
 * The counter reads 3.
 */
const ready: Scenario<Player> = () => ({ player: { taps: 3 } });

export default ready;
```

The dev page lists `tests/scenarios/*.ts` by file stem: `http://127.0.0.1:3000/?player=ready` opens on
a fresh memory save with the counter at 3. A scenario gets the device time (`now`), so a timer can be due
already. A production build carries no scenario.

```ts
// tests/integration/hello.test.ts
/**
 * @file The game plays without a screen: three taps count three taps, and the scenario `ready`
 * starts at three.
 */
import type { Flow } from "@moku-labs/game";
import { startMoment } from "@moku-labs/game/app";
import { createHeadless } from "@moku-labs/game/testing";
import { expect, it } from "vitest";
import game from "../../index";
import ready from "../scenarios/ready";

const tapOnce: Flow.RouteStep = { at: "home", intent: "tap" };

it("counts taps headless", async () => {
  const { app } = game.headless();
  const run = await createHeadless(app);

  const state = await run.walk([tapOnce, tapOnce, tapOnce]);

  expect(state.path).toBe("home");
  expect(app.model.store.snapshot().player).toEqual({ taps: 3 });
  expect(app.model.store.snapshot().session).toEqual({ opened: 3 });

  await run.stop();
});

it("starts from the scenario ready", async () => {
  const { app } = game.headless({ player: ready(startMoment).player });
  const run = await createHeadless(app);

  await run.walk([tapOnce]);

  expect(app.model.store.snapshot().player).toEqual({ taps: 4 });

  await run.stop();
});
```

`game.screen()` runs in plain Bun too: without a `renderer.mount` the renderer is inert. A test passes
`{ manifest, io }` when it needs the assets.

## Run it

```sh
bun run keys             # manifest.json, generated/*
bun run test             # headless, plain Bun
bun run typecheck
bun run lint             # biome + oxlint, the ten engine rules included
bun run build            # keys --check, the pack and dist/web
bun run dev              # the game alone: http://127.0.0.1:3000/
bun run editor           # Game http://127.0.0.1:3000/  Tools http://127.0.0.1:3000/__editor/
```

`moku-game dev` writes the dev page into `.moku/` (`index.html`, `dev.ts`, `main.ts`, `bunfig.toml`),
runs Bun again under that bunfig and prints the bound URL on its own line. `/` is the page,
`/manifest.json` the manifest, any other path a file of the game; dot folders and `node_modules` answer
404. The page sets `globalThis.game`, `globalThis.doors` and, under the editor, `globalThis.editor`.

On the page, tap the button: the counter text changes on the next commit, and with `save: "local"` it
survives a reload. In the tools page, State shows `player.taps`, Flow shows `home → tap → home`,
Console shows the log. Save a view file (for example the button `fill` in `hello-screen.tsx`): the
engine's hot plugin swaps it in the running page, same state, same node. `bun run build` keeps no
editor, scenario, `.dev` module or `/control` code in `dist/web`. See `editor.md`.

## Next steps a real game adds

- `core/tables.ts` and `rules/` in a feature or in `shared/rules/` (pure functions, L4); one file per node
  under `features/<f>/flow/`, sub-flows there too. The root flow in `game.ts` takes them from `@features`.
- `features/<f>/styles/` with `defineStyle` and `defineTextStyles`; the kit gets
  `textStyles: "body" | "digits" | "ui.title"`.
- A HUD number without a message: `component("Counter", { value: 0 })` and
  `<text bind={bind(Counter, "value")} components={[Counter({ value: hud.coins })]} />`; a timer is
  `bind(Countdown, "left", { format: "mm:ss" })` with `components={[Countdown({ until: player.opensAt })]}`.
- The game's own plugins in `plugins/<p>/`, listed in `plugins` of `index.ts`. An exit plugin answers a
  node's `fx({ kind: "exit" })` with `ctx.require(platformPlugin).exit()`.
- Native and the phone: `native` and `system` in `config.ts`, then `bun run native build ios --simulator`
  (see `device.md`). No `platform-bridge.ts`, no `native.ts`: the engine page builds the shell.
- `tests/visual/*.visual.ts` with `defineVisualTest`, run with `runVisualTests({ app: () => game.screen().app, … })`.
- A `.dev.ts` module with `defineSource` / `defineCommand` for the game's own cheats. The editor's page
  imports every `**/*.dev.ts` on its own; `moku-game build` imports none.
