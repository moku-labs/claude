# Hello world — the minimal screen game

The exact files `moku:init` scaffolds for `type: game`. One rest node, one transit node, one feature with a
screen that shows "Hello, world" and a tappable button that counts taps. It runs headless in Bun, on the
dev page with the editor, and is the smallest game the playtest station can drive.

Derived from the engine's fixture `tests/integration/merge-game/` and its `llms.txt` "Minimal game".
Verified end to end (typecheck, assets, test, build, dev page, editor picker, Shot, hot reload) against
`@moku-labs/game@0.4.4`, `@moku-labs/editor@0.2.1`, `pixi.js@8.22`, Bun 1.3.14 and the init tooling stack
(`typescript@6.0.3`, `vitest@4.0.18`). Every CI script and the lefthook pre-commit pass on the fresh
scaffold. Both game packages move fast: install them with `@latest`, never hard-pin. When something here does not compile, read
`node_modules/@moku-labs/game/llms.txt` first: the game package ships it since 0.4.0 and it is the
engine in one page, always matching the installed version. The editor ships `llms.txt` and
`llms-full.txt` since 0.1.0 (`node_modules/@moku-labs/editor/`).

## Install

```sh
bun add @moku-labs/game@latest pixi.js
bun add -d @moku-labs/editor@latest
```

Every other dev dependency is init's tooling set. Init writes it into `package.json` at the versions
`tooling-config.md` pins: TypeScript, `@types/bun`, Vitest, `@vitest/coverage-istanbul`, Biome, ESLint
and its plugins, `globals`, `jiti`, lefthook. Leave out the package-only `@arethetypeswrong/*`,
`publint` and `tsdown`. Never add `typescript@latest`. TypeScript 7 has no JS API: ESLint's sonarjs
plugin crashes on it (`reading 'FunctionType'`), and typescript-eslint accepts only `<6.1`. Never
add `vitest@latest` either: the coverage plugin must be the same version as Vitest.

## Font

Text is drawn from an **MSDF bitmap font**. Without one the `text` tag draws nothing. The game package
ships one: Pangolin Regular, SIL OFL 1.1, one 512×512 page, under the subpath `fonts/`. Copy it into the
game; a path in `node_modules` is never an asset key.

```sh
mkdir -p features/ui/assets
cp node_modules/@moku-labs/game/fonts/font-body.* features/ui/assets/
cp node_modules/@moku-labs/game/fonts/LICENSE.txt features/ui/LICENSE-fonts.txt
```

The folder `features/ui/` gives the key `ui.font-body`, the default of `text` config `fonts.body`, so the
built-in style `body` needs no config. `ui` is a plugin name, so no feature is called `ui`: the folder
holds art only and a real feature lists its bundle (`assets: uiAssets`), as the engine fixture does. The
licence sits beside `assets/`, not inside it. The `.fnt` names its page `font-body.png`, so keep both
file names. No `digits` font ships: a game that uses the style `digits` brings `ui.font-digits` itself.
For another face, build the pair from an OFL `.ttf` with `msdf-bmfont-xml`: BMFont XML, one 512×512 page.

## Layout

```
package.json  tsconfig.json  vitest.config.ts  biome.json  lefthook.yml  .github/workflows/ci.yml
manifest.json*  state.ts  kit.ts  game.ts
nodes/home.ts  nodes/tap.ts  flows/main.ts
features/ui/{assets.ts, LICENSE-fonts.txt, assets/font-body.fnt, assets/font-body.png}
features/hello/{index.ts, view.tsx, scene.ts, strings/en.json}
generated/{assets.ts, strings.ts, strings.en.ts}*
web/{index.html, main.ts, dev.ts, serve.ts, build.ts}
tests/hello.test.ts
```

`*` written by `bun run assets:keys`. Commit them; `build` runs `assets:check`, so CI keeps them honest.

## Tooling a game changes

Init writes the tooling files of `tooling-config.md`. A game has no `src/` and no npm package, so these
change:

| File | For a game |
|---|---|
| `package.json`, `tsconfig.json` | The two below. |
| `vitest.config.ts`, `lefthook.yml`, `eslint.config.ts` | The three below. |
| `biome.json` | The tooling file with two edits, below. |
| `tsconfig.build.json`, `tsdown.config.ts` | Not written. `web/build.ts` builds the game. |

The rest is unchanged: `bunfig.toml`, `.bun-version`, `declarations.d.ts`,
`.editorconfig`, `.gitignore` (with `.planning`), `cspell.json`, `CLAUDE.md`. The CI is
`examples/app/ci.yml` of `@moku-labs/ci`, without its `build_worker_script` and `migrate_script` lines
(init Step 4).

`biome.json`: `files.includes` names the game folders instead of `src/**`, and one override more. A JSX
`<button>` here is a game tag, not an HTML button, so `useButtonType` is off for `.tsx`, as in the
engine's own repo. `generated/` and `manifest.json` stay out: the asset CLI owns their format.

```json
"files": { "includes": ["*.ts", "{nodes,flows,rules,features,web,tests}/**"] },
```

```json
{ "includes": ["**/*.tsx"], "linter": { "rules": { "a11y": { "useButtonType": "off" } } } }
```

The tooling `eslint.config.ts` aims its rule blocks at `src/**`. A game has no `src/`, so it would lint
only the tests and the config files. The game's file aims the same blocks at the game folders and the root
`.ts` files, and adds the engine rules a game can carry: L2, L3, L4, L5 and L13. `generated/` stays
out, as for Biome. The rest of L1–L13 is engine-internal; `moku-game-validator` checks what ESLint cannot.

```ts
// eslint.config.ts
import biomeConfig from "eslint-config-biome";
import jsdocPlugin from "eslint-plugin-jsdoc";
import sonarjs from "eslint-plugin-sonarjs";
import eslintPluginUnicorn from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";

export default [
  // 1. Global ignores. The asset CLI writes `generated/`; the editor writes `.moku/`.
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "generated/**",
      ".moku/**",
      "bun.lock",
      ".claude/**",
      ".planning/**",
      "node_modules/**",
      "declarations.d.ts"
    ]
  },

  // 2. TypeScript parser for all TS files
  tseslint.configs.base,

  // 3. Unicorn recommended + abbreviation allowlist
  eslintPluginUnicorn.configs.recommended,
  {
    rules: {
      "unicorn/prevent-abbreviations": [
        "error",
        {
          // Pre-expanded so builds don't have to widen this mid-flight. See references/glossary.md.
          allowList: {
            ctx: true, fn: true, cb: true, ref: true, args: true, params: true, props: true,
            env: true, i18n: true, l10n: true, spa: true, ssg: true, ssr: true, seo: true,
            api: true, dev: true, prod: true, md: true, dir: true, doc: true, docs: true,
            db: true, util: true, utils: true, pkg: true, src: true, dist: true, config: true,
            cfg: true, e2e: true, cli: true, dom: true, css: true, html: true, url: true, uri: true,
            str: true, num: true, msg: true, err: true, req: true, res: true, opts: true, attr: true
          }
        }
      ]
    }
  },

  // 4. SonarJS recommended
  // biome-ignore lint/style/noNonNullAssertion: sonarjs types mark configs as possibly undefined but it exists at runtime
  sonarjs.configs!.recommended,

  // 5. JSDoc TypeScript preset
  jsdocPlugin.configs["flat/recommended-typescript-error"],

  // 5b. JSDoc style overrides
  {
    rules: {
      "jsdoc/no-types": "off",
      "jsdoc/tag-lines": ["error", "never", { startLines: 1 }]
    }
  },

  // 6. Game source: strict JSDoc. The root files and the game folders, `.tsx` views included.
  {
    files: ["*.ts", "{nodes,flows,rules,features,web}/**/*.{ts,tsx}"],
    rules: {
      "jsdoc/require-jsdoc": [
        "error",
        {
          require: {
            ArrowFunctionExpression: false,
            ClassDeclaration: true,
            FunctionDeclaration: true,
            FunctionExpression: true,
            MethodDefinition: true
          },
          contexts: ["TSInterfaceDeclaration", "TSTypeAliasDeclaration"]
        }
      ],
      "jsdoc/require-description": "error",
      "jsdoc/require-param": "error",
      "jsdoc/require-param-description": "error",
      "jsdoc/require-returns": "error",
      "jsdoc/require-returns-description": "error",
      "jsdoc/require-example": "off",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "unicorn/require-module-specifiers": "off"
    }
  },

  // 6c. No signature echo (L8): an example whose whole body is one call with bare identifiers.
  {
    files: ["*.ts", "{nodes,flows,rules,features,web}/**/*.{ts,tsx}"],
    rules: {
      "jsdoc/match-description": [
        "error",
        {
          mainDescription: false,
          contexts: ["any"],
          tags: {
            example:
              "^(?!\\s*```(?:ts|typescript)\\n\\s*(?:(?:const|let) \\w+(?:: [\\w.<>\\[\\]]+)? = )?(?:await )?[\\w.]+\\((?:[\\w.]+(?:, [\\w.]+)*)?\\);?\\s*```\\s*$)[\\s\\S]+$"
          }
        }
      ]
    }
  },

  // G1. L2 + L13 + dev only: what the logic and the screens may import. Pixi and Yoga load lazily
  // inside the engine; a native package goes through `platform-bridge.ts`; the editor and the
  // control door stay in `web/` and `.dev` modules.
  {
    files: ["state.ts", "tables.ts", "kit.ts", "game.ts", "{nodes,flows,rules,features}/**/*.{ts,tsx}"],
    ignores: ["**/*.dev.ts", "**/__tests__/**"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "pixi.js",
              allowTypeImports: true,
              message: "The renderer loads Pixi lazily. Draw with the engine's tags. Types may be imported."
            },
            {
              name: "yoga-layout",
              allowTypeImports: true,
              message: "The ui plugin loads Yoga lazily. Types may be imported."
            }
          ],
          patterns: [
            {
              regex: "^(?:@moku-labs/(?:system|native)(?:/|$)|@tauri-apps/)",
              message: "Only platform-bridge.ts, native.ts and web/main.ts import a native package."
            },
            {
              regex: "^@moku-labs/(?:editor(?:/|$)|game/control$)",
              message: "Dev only: web/main.ts and .dev modules import the editor and the control door."
            }
          ]
        }
      ]
    }
  },

  // G2. L5: no module-scope state. State lives in `player` and `session`.
  {
    files: ["*.ts", "{nodes,flows,rules,features,web}/**/*.{ts,tsx}"],
    ignores: ["**/__tests__/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "Program > VariableDeclaration[kind='let']", message: "No module-scope state." },
        {
          selector:
            "Program > :matches(VariableDeclaration, ExportNamedDeclaration) NewExpression[callee.name=/^(Map|Set|WeakMap|WeakSet)$/]",
          message: "No module-scope collections."
        }
      ]
    }
  },

  // G3. L3: determinism in the logic and the screens. Time is `now`, randomness is an rng stream.
  {
    files: ["state.ts", "tables.ts", "{nodes,flows,rules,features}/**/*.{ts,tsx}"],
    ignores: ["**/*.dev.ts", "**/__tests__/**"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "Date", property: "now", message: "Use `now` from the node context." },
        { object: "performance", property: "now", message: "Use `now` from the node context." },
        { object: "Math", property: "random", message: "Use an rng stream: rng.stream(id)." }
      ],
      "no-restricted-globals": [
        "error",
        { name: "setTimeout", message: "Store the moment in player, await fx(schedule(moment))." },
        { name: "setInterval", message: "Store the moment in player, await fx(schedule(moment))." }
      ],
      // This block replaces G2's rule on these files, so its two selectors are repeated.
      "no-restricted-syntax": [
        "error",
        { selector: "NewExpression[callee.name='Date']", message: "Use `now` from the node context." },
        { selector: "Program > VariableDeclaration[kind='let']", message: "No module-scope state." },
        {
          selector:
            "Program > :matches(VariableDeclaration, ExportNamedDeclaration) NewExpression[callee.name=/^(Map|Set|WeakMap|WeakSet)$/]",
          message: "No module-scope collections."
        }
      ]
    }
  },

  // G4. L4: a rule imports only its siblings in `rules/`: (state, input, tables) => result.
  {
    files: ["rules/**/*.ts"],
    ignores: ["**/__tests__/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ regex: String.raw`^(?!\./)`, message: "A rule imports only its siblings in rules/." }] }
      ]
    }
  },

  // 7. Test files: relaxed rules
  {
    files: ["tests/**/*.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}"],
    rules: {
      "jsdoc/require-jsdoc": "off",
      "jsdoc/require-description": "off",
      "jsdoc/require-param": "off",
      "jsdoc/require-returns": "off",
      "jsdoc/require-example": "off",
      "jsdoc/match-description": "off",
      "unicorn/no-useless-undefined": "off",
      "sonarjs/no-duplicate-string": "off",
      "unicorn/prevent-abbreviations": "off"
    }
  },

  // 8. Config files: relaxed rules
  {
    files: ["*.config.ts"],
    rules: {
      "jsdoc/require-jsdoc": "off",
      "jsdoc/require-description": "off",
      "unicorn/no-abusive-eslint-disable": "off"
    }
  },

  // 9. MUST be last: eslint-config-biome disables rules Biome handles
  biomeConfig
];
```

Blocks 2 to 9 are the tooling file's; 6, 6c and 7 get the game's paths and 6b is gone. G1 is L2 and L13,
G2 is L5, G3 is L3, G4 is L4. Door guards, asset keys and the feature layout stay with
`moku-game-validator`.

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "istanbul",
      include: ["state.ts", "tables.ts", "{nodes,flows,rules,features}/**/*.{ts,tsx}"],
      exclude: ["**/*.test.ts"],
      reporter: ["text", "lcov"],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 }
    }
  }
});
```

Coverage counts the logic a headless test can reach: state, tables, nodes, flows, rules, features. It
leaves out `game.ts` and `web/`. Their branches are the canvas and the manifest URL, which only the
dev page and the e2e station run. `kit.ts` and `generated/` hold no logic. The family's 90% stays.

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
    - name: eslint-check
      glob: "*.{ts,tsx,js,mjs,cjs}"
      run: bunx eslint --no-fix --no-warn-ignored {staged_files}
    - name: typecheck
      run: bun run typecheck
    - name: test
      run: bun run test
```

The tooling hook runs `validate`, `test:unit` and `test:integration`. A game has none of them.
`--no-warn-ignored` keeps the hook quiet on files the ESLint config does not cover.

## package.json

```json
{
  "name": "hello-game",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "moku-editor web/index.html --port 3000 --root .",
    "serve": "bun web/serve.ts",
    "assets:keys": "moku-game-assets --root .",
    "assets:check": "moku-game-assets --root . --check",
    "lint": "biome check . && eslint .",
    "lint:fix": "biome check --write . && eslint --fix .",
    "format": "biome format --write .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "build": "bun run assets:check && bun run build:web",
    "build:web": "bun web/build.ts",
    "deploy": "echo 'No deploy target yet: the release station picks one.'"
  },
  "engines": { "node": ">=24.0.0", "bun": ">=1.3.14" }
}
```

`devDependencies` is init's tooling set plus `@moku-labs/editor` and `@moku-labs/ci`; `bun add` fills
`dependencies` (`@moku-labs/game`, `pixi.js`). The CI runs `lint`, `typecheck`, `test:coverage` and
`build` on every push and pull request, and `deploy` on every push to `main`. `deploy` is a
placeholder until the release station picks a target. `build:web` stays its own script: `device.md`
calls it after packing the art. `@moku-labs/core` and `@moku-labs/common` are peers of both
packages since game 0.4.3 and editor 0.2.1; Bun installs them on its own. With `--root .` the asset CLI writes `manifest.json` and
`generated/` at the root; `--manifest` and `--keys` move them.

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
    "jsxImportSource": "@moku-labs/game"
  },
  "include": ["*.ts", "nodes", "flows", "rules", "features", "generated", "web", "tests"]
}
```

## state.ts

```ts
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

## kit.ts

```ts
/**
 * @file The authoring helpers bound to the types of this game, once. Asset and bundle keys come from
 * `generated/assets.ts` and message keys from `generated/strings.ts`, so a key the game does not have
 * does not compile.
 */
import { defineGame } from "@moku-labs/game";
import type { AssetKey, BundleKey } from "./generated/assets";
import type { Strings } from "./generated/strings";
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

## nodes/home.ts and nodes/tap.ts

```ts
// nodes/home.ts
/**
 * @file Rest node `home`: the checkpoint the screen is shown on. It waits for the one button.
 */
import { type } from "@moku-labs/game";
import { defineNode } from "../kit";

export const home = defineNode({
  scene: "hello",
  outcomes: { tap: type() },
  rest: true,
  checkpoint: true
});
```

```ts
// nodes/tap.ts
/**
 * @file Transit node `tap`: counts one tap into the save and one into the session.
 */
import { type } from "@moku-labs/game";
import { defineNode } from "../kit";

export const tap = defineNode({
  outcomes: { done: type() },
  run: ({ player, session, out }) => {
    player.taps += 1;
    session.opened += 1;
    return out.done();
  }
});
```

## flows/main.ts

```ts
/**
 * @file The main flow: home waits, tap counts, back to home.
 */
import { defineFlow } from "../kit";
import { home } from "../nodes/home";
import { tap } from "../nodes/tap";

export const mainFlow = defineFlow("main", {
  nodes: { home, tap },
  start: "home",
  edges: {
    home: { tap: "tap" },
    tap: { done: "home" }
  }
});
```

## features/hello/

```ts
// features/ui/assets.ts
/**
 * @file The bundle of the interface, tier "boot": awaited in onStart, never unloaded. It holds the
 * body font. The folder is named after the key the `text` config reads by default, `ui.font-body`.
 */
import { defineBundles } from "../../kit";

export const uiAssets = defineBundles({ ui: { tier: "boot" } });
```

```ts
// features/hello/scene.ts
/**
 * @file The Hello scene: the bundle and the screen. Every scene gets a `ui` layer on top.
 */
import { defineScene } from "../../kit";
import { helloScreen } from "./view";

export const helloScene = defineScene("hello", {
  bundle: "ui",
  layers: {},
  projections: [helloScreen]
});
```

```tsx
// features/hello/view.tsx
/**
 * @file The Hello screen: a greeting, the tap counter and one button that answers the `home` gate
 * with the intent `tap`.
 */
import { projection, tr } from "../../kit";
import type { Player } from "../../state";

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
 * @file Hello as a feature: its scene, its screen, the interface bundle and the compiled strings.
 */
import enStrings from "../../generated/strings.en";
import { defineFeature } from "../../kit";
import { uiAssets } from "../ui/assets";
import { helloScene } from "./scene";
import { helloScreen } from "./view";

export const helloFeature = defineFeature("hello", {
  scenes: [helloScene],
  projections: [helloScreen],
  assets: uiAssets,
  strings: { en: enStrings }
});
```

Run `bun run assets:keys` now. It writes `manifest.json` (bundle `ui`, key `ui.font-body`),
`generated/assets.ts` (`AssetKey = "ui.font-body"`, `FontKey`, `BundleKey = "ui"`, `nineSlice`),
`generated/strings.ts` (`Strings = { "hello.greeting": Record<string, never>; "hello.taps": { n: number };
"hello.tap": Record<string, never> }`) and `generated/strings.en.ts`. Never edit them.

## game.ts

```ts
/**
 * @file The composition root: one headless app for tests, one app with the screen for the page.
 */
import { createApp, screen } from "@moku-labs/game";
import { helloFeature } from "./features/hello";
import { mainFlow } from "./flows/main";
import { startingPlayer, startingSession } from "./state";

/**
 * What a caller may pin.
 */
export type GameOptions = { seed?: number; mount?: string; manifest?: string };

/**
 * Creates the game. Without `mount` the renderer is inert and the same app runs in plain Bun.
 *
 * @param options - The rng seed, the mount selector and the manifest URL.
 * @returns The app, not started.
 */
export function createGame(options: GameOptions = {}) {
  return createApp({
    plugins: [...screen, helloFeature],
    pluginConfigs: {
      model: {
        initialPlayer: startingPlayer,
        initialSession: startingSession,
        seed: options.seed ?? 42
      },
      flow: { mainFlow, safeNode: "home" },
      renderer: options.mount === undefined ? {} : { mount: options.mount },
      assets: options.manifest === undefined ? {} : { manifest: options.manifest }
    },
    onStart: ctx => {
      ctx.flow.run().catch((error: unknown) => {
        ctx.log.error("hello: the graph failed", { error });
      });
    }
  });
}
```

For a headless test the screen plugins are inert; `helloFeature.logicOnly` is the stricter choice when
the game grows (`plugins: [helloFeature.logicOnly]`).

## web/

```html
<!-- web/index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>hello-game</title>
    <style>
      html, body { margin: 0; height: 100%; background: #10161d; }
      #game { width: 100%; height: 100%; touch-action: none; }
    </style>
  </head>
  <body>
    <div id="game"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

```ts
// web/dev.ts
/**
 * @file The dev flag. `web/main.ts` imports this first, so the `/control` door and the editor work on
 * the dev page. The engine declares the global; the game never re-declares it.
 */
globalThis.__MOKU_GAME_DEV__ = true;
```

```ts
// web/main.ts
/**
 * @file The dev page: the game with a real canvas, the two door handles, and the editor agent in a
 * dev build only.
 */
import "./dev";
import { commands, run } from "@moku-labs/game/control";
import { read, sources, watch } from "@moku-labs/game/inspect";
import { createGame } from "../game";

const app = createGame({ mount: "#game", manifest: "/manifest.json" });

// The visual tests, the playtest station and the editor reach the game through these two handles.
Reflect.set(globalThis, "game", app);
Reflect.set(globalThis, "doors", { read, watch, sources, run, commands });

await app.start();

// The editor agent, dev only. With `__MOKU_GAME_DEV__` defined false the bundle keeps no editor code.
if (__MOKU_GAME_DEV__) {
  const { bridgePlugin, capturePlugin, createApp } = await import("@moku-labs/editor/agent");
  const editor = createApp({
    plugins: [bridgePlugin, capturePlugin],
    pluginConfigs: { registry: { game: app, modules: [], name: "hello-game 0.1.0" } }
  });

  Reflect.set(globalThis, "editor", editor);
  await editor.start(); // after the game; never waits for the editor server
}
```

```ts
// web/serve.ts
/**
 * @file Dev server without the editor: the page on `/`, every file of the project root as static.
 * `bun web/serve.ts [--port 3000]`. The editor bin (`bun run dev`) does the same plus the tools page.
 */
import path from "node:path";
import { file } from "bun";
import index from "./index.html";

const root = new URL("..", import.meta.url).pathname;
const at = process.argv.indexOf("--port");
const port = at === -1 ? 3000 : Number(process.argv[at + 1]);

/**
 * Answers one file of the project root, or a 404.
 *
 * @param request - The request of the page.
 * @returns The file or a 404.
 */
function serveFile(request: Request): Response {
  // The browser percent-encodes the braces of a nine-slice tag; the disk does not.
  const relative = decodeURIComponent(new URL(request.url).pathname);

  if (relative.includes("..")) return new Response("not found", { status: 404 });

  const asset = file(path.join(root, relative));

  return asset.size > 0 ? new Response(asset) : new Response("not found", { status: 404 });
}

const server = Bun.serve({ port, development: true, routes: { "/": index }, fetch: serveFile });

console.info(`hello-game on ${server.url}`);
```

```ts
// web/build.ts
/**
 * @file The production page: `__MOKU_GAME_DEV__` defined false, so every `/control` command body is
 * stripped and no editor code is bundled. This is the loose build: `manifest.json` and every
 * `features/<f>/assets` copied beside the page. Packed art (`assets:keys -- --pack`, needs `sharp`)
 * is a later step with its own manifest; it replaces this copy.
 */
import { cpSync, existsSync, readdirSync } from "node:fs";

const result = await Bun.build({
  entrypoints: ["web/index.html"],
  outdir: "dist/web",
  minify: true,
  define: { __MOKU_GAME_DEV__: "false" }
});

// A throw ends `bun web/build.ts` with exit code 1 and prints the logs.
if (!result.success) throw new Error(result.logs.map(String).join("\n"));

// The loose build: the manifest and every feature's art beside the page, at the paths the manifest names.
cpSync("manifest.json", "dist/web/manifest.json");
for (const feature of readdirSync("features")) {
  const assets = `features/${feature}/assets`;

  if (existsSync(assets)) cpSync(assets, `dist/web/${assets}`, { recursive: true });
}
```

(`console.*` is fine in these scripts: they are build tooling, not a Moku plugin. A game that adds
`@moku-labs/common/cli` renders them through `createBrandConsole()` as the fixture does.)

## tests/hello.test.ts

```ts
/**
 * @file The game plays without a screen: three taps count three taps.
 */
import type { Flow } from "@moku-labs/game";
import { createHeadless } from "@moku-labs/game/testing";
import { expect, it } from "vitest";
import { createGame } from "../game";

const tapOnce: Flow.RouteStep = { at: "home", intent: "tap" };

it("counts taps headless", async () => {
  const app = createGame({ seed: 42 });
  const game = await createHeadless(app);

  const state = await game.walk([tapOnce, tapOnce, tapOnce]);

  expect(state.path).toBe("home");
  expect(app.model.store.snapshot().player).toEqual({ taps: 3 });
  expect(app.model.store.snapshot().session).toEqual({ opened: 3 });

  await game.stop();
});
```

## Run it

```sh
bun run assets:keys      # manifest.json, generated/*
bun run test             # headless, plain Bun
bun run typecheck
bun run lint             # biome + eslint
bun run build            # assets:check, then dist/web
bun run dev              # Game http://127.0.0.1:3000/  Tools http://127.0.0.1:3000/__editor/
```

On the page, tap the button: the counter text changes on the next commit. In the tools page, State shows
`player.taps`, Flow shows `home → tap → home`, Console shows the log. Save a file of the game (for
example the button `fill` in `view.tsx`): Bun hot reload puts the new code on the page and the game comes
back with its taps, toast "Game reloaded · state restored". `bun run build:web` keeps no editor code:
`grep -c "/__editor/hello" dist/web/*.js` answers `0`. See `editor.md`.

## Next steps a real game adds

- `tables.ts` and `rules/` (pure functions, L4), one file per node under `nodes/`, sub-flows under `flows/`.
- `features/<f>/styles.ts` with `defineStyle` and `defineTextStyles`; the kit gets `textStyles: "body" | "digits" | "ui.title"`.
- A HUD number without a message: `component("Counter", { value: 0 })` and
  `<text bind={bind(Counter, "value")} components={[Counter({ value: hud.coins })]} />`; a timer is
  `bind(Countdown, "left", { format: "mm:ss" })` with `components={[Countdown({ until: player.opensAt })]}`.
- `audioPlugin` + `.mp3` files; `effectsPlugin` for particles and filters; `platformPlugin` + `platform-bridge.ts`
  over `@moku-labs/system` for Back, haptics and keep-awake; `native.ts` on `@moku-labs/native` (see `device.md`).
- `tests/visual/` with `defineVisualTest` and a `run.ts` calling `runVisualTests`.
- A `.dev` module with `defineSource` / `defineCommand` for the game's own cheats, passed to the editor's
  `registry.modules`.
