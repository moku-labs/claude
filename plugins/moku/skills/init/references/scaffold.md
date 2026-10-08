# init — the scaffolding procedure

The file-by-file work behind `init` Step 3, the per-type source templates, and the verification
checklist. Every version, config body and script name comes from
`../../moku-core/references/tooling-config.md`; this file only says what to write where.

## 1. `bun init`

```bash
cd "$ABSOLUTE_PROJECT_PATH" && bun init -y
```

`-y` keeps it non-interactive in a non-empty directory. It generates `package.json`,
`tsconfig.json`, `.gitignore`, `index.ts`, `README.md` and `CLAUDE.md`.

- `package.json`, `tsconfig.json`, `.gitignore`, `CLAUDE.md` — overwritten below. Read each before
  overwriting; the Write tool requires it.
- `index.ts`, `README.md` — delete them. Moku uses `src/index.ts`, and the README is the user's.

```bash
rm -f "$ABSOLUTE_PROJECT_PATH/index.ts" "$ABSOLUTE_PROJECT_PATH/README.md"
```

`-f` means a missing file is fine. If a later Write fails with a permission error, the directory is
not writable — stop and say so rather than working around it.

## 2. Tooling files

Identical for framework, consumer app and library. Copy each body from `tooling-config.md`.

| # | File | Notes |
|---|---|---|
| 1 | `bunfig.toml` | `exact = true`. Write this **before** any `bun install` so pinning applies from the first install. A game writes none: it pins with `bun add --exact`. |
| 2 | `.bun-version` | `1.3.14` |
| 3 | `package.json` | `"type": "module"`, `engines`, the script contract, devDependencies at the exact pinned versions. `main`/`module`/`types`/`exports`/`files`/`repository` for packages; an app may omit them. |
| 4 | `biome.json` | |
| 5 | `.oxlintrc.json` | The current lint stack, copied as plain data. The `unicorn-js/prevent-abbreviations` allowList ships pre-expanded — do not shrink it. Never write `eslint.config.ts` for a new project; the ESLint bodies are legacy only. |
| 6 | `declarations.d.ts` | Not written. Add it only when the project imports an untyped JS package, and add it to `include` then. |
| 7 | `tsconfig.json` | `include` must carry `*.config.ts` beside `src` and `tests`. TypeScript 7 keeps the TS 6 default `types: []`, so `"types": ["bun"]` is required or `tsc` cannot find `Bun`. |
| 8 | `tsconfig.build.json` | Declaration emit, `rootDir: "./src"`. |
| 9 | `tsdown.config.ts` | ESM + CJS + declarations. |
| 10 | `vitest.config.ts` | unit and integration projects, 90% coverage thresholds. |
| 11 | `lefthook.yml` | pre-commit: build, biome format, oxlint, tests. Packages take the main block, apps the app variant (no `validate`, plain `test`), games the pack's own. |
| 12 | `.editorconfig` | UTF-8, LF, two spaces. |
| 13 | `.gitignore` | Includes `.claude` and `.planning`. |
| 14 | `cspell.json` | Seed `words` from `../../moku-core/references/glossary.md`. |
| 15 | `.claude/settings.local.json` | The safe default permission allow-list. |
| 16 | `CLAUDE.md` | From the template in `tooling-config.md`, with the real name and description. Frameworks show the three-layer model, consumers show `createApp` usage, libraries drop the architecture section. |

`.gitignore` is the one file to merge rather than overwrite. When one already exists, keep it and
append whichever of `.claude/` and `.planning/` is missing, under a short comment. `.planning/` is
local-only state; the `verify-before-commit` hook blocks any `git add` or commit that names it.

## 3. Directory skeleton and source templates

Every type gets placeholder tests at `tests/unit/setup.test.ts` and
`tests/integration/setup.test.ts`. Vitest exits 1 on an empty suite, so both are required.

```typescript
import { describe, expect, it } from "vitest";

describe("setup", () => {
  it("should be configured correctly", () => {
    expect(true).toBe(true);
  });
});
```

### Framework (Layer 2)

```
src/
  config.ts          # createCoreConfig<Config, Events, [plugins]>
  index.ts           # createCore, exports createApp and createPlugin
  plugins/           # each plugin owns its __tests__/
tests/unit/setup.test.ts
tests/integration/   # cross-plugin scenarios only
```

Dependencies: `@moku-labs/core`, `@moku-labs/common`.

`src/config.ts` — replace `<actual-project-name>` with the package name minus its npm scope.
`logPlugin` and `envPlugin` put `ctx.log` and `ctx.env` on every plugin's `ctx`. Once any explicit
type argument is given, the third `CorePlugins` tuple argument is required
(`skeleton-conventions.md §2`):

```typescript
import { createCoreConfig } from "@moku-labs/core";
import { logPlugin, envPlugin } from "@moku-labs/common";

/**
 * Global configuration shape for the framework.
 *
 * @example
 * ```ts
 * type Config = { port: number; host: string };
 * ```
 */
// biome-ignore lint/complexity/noBannedTypes: placeholder for user-defined config
type Config = {};

/**
 * Event contract for the framework.
 *
 * @example
 * ```ts
 * type Events = { "app:ready": { timestamp: number } };
 * ```
 */
// biome-ignore lint/complexity/noBannedTypes: placeholder for user-defined events
type Events = {};

export const coreConfig = createCoreConfig<Config, Events, [typeof logPlugin, typeof envPlugin]>(
  "<actual-project-name>",
  {
    config: {},
    plugins: [logPlugin, envPlugin], // core plugins → ctx.log + ctx.env on every ctx
  },
);

export const { createPlugin, createCore } = coreConfig;
```

`src/index.ts`:

```typescript
import { coreConfig, createCore } from "./config";

const framework = createCore(coreConfig, {
  plugins: []
});

export const { createApp, createPlugin } = framework;
```

Keep the type names `Config` and `Events`. Domain-specific names like `MyFrameworkConfig` break the
convention every other Moku project follows.

### Consumer app (Layer 3)

```
src/
  index.ts           # createApp entry point
  plugins/           # optional: Layer-3 plugins via the framework's createPlugin
tests/unit/setup.test.ts
tests/integration/
```

Dependencies: the framework package from Step 1. `@moku-labs/core` never appears here — if it does,
remove it.

```typescript
import { createApp } from "<framework-package>";

const app = createApp({
  // plugin config overrides go here
});
```

No `src/config.ts`: creating the core is the framework's job. The app still authors its own plugins
when a concern is plugin-shaped — `src/plugins/{name}/` with `createPlugin` imported from the
framework package, composed via `createApp({ plugins: [...] })`. Scaffold `src/plugins/` only when
it is needed. See `../../moku-core/references/consumer-plugins.md` for the plugin-vs-lib-vs-island
decision.

A consumer app inherits `ctx.log` and `ctx.env` from its framework and does not register
`logPlugin`/`envPlugin` itself.

### Game (Layer 3 on `@moku-labs/game`)

The game folder (`index.ts`, `config.ts`, `game.ts`, `core/`, `shared/`, `features/`,
`tests/scenarios/`, `tests/visual/`), the scripts that call `moku-game` and `moku-editor --root .`, the
first headless test and the first visual test come from the `moku-game` pack, `references/hello-world.md`. A game writes no page, no `web/`, no
server and no `bunfig.toml`: the engine bin `moku-game` writes the page into `.moku/`. A game changes part
of the tooling above: its own `vitest.config.ts` (the layer aliases, coverage of the logic only),
`biome.json` scope, `.oxlintrc.json` with the engine rules, `lefthook.yml`, `tsconfig.json` (JSX and the
layer `paths`), `.gitignore` (`.moku`), TypeScript 6.0.3 for the editor's project index, and no
`tsconfig.build.json` or `tsdown.config.ts`. The pack's section "Tooling a game changes" is the list;
follow it over this table.

Dependencies, exact, at the versions `hello-world.md` names: `@moku-labs/game`, `pixi.js`,
`@moku-labs/core`, `@moku-labs/common` (the peers both packages share); dev `@moku-labs/editor`, `sharp`.

The order of a game init, after the tooling files: copy the body font into `shared/assets/`, write the
sources, then `bun run keys` before the first typecheck. `generated/` and `generated/manifest.json` do not
exist until it ran, and the kit imports its types from them. Then `bun run test:visual` twice: the first run
writes `tests/visual/baselines/`, the second must say `same`. The baselines are committed with the
scaffold.

### Tools / library

```
src/index.ts         # empty placeholder; the user defines the exports
tests/unit/setup.test.ts
tests/integration/
```

No dependencies by default.

## 4. Family conventions

Plugin, CLI and script source uses `ctx.log` rather than raw `console.*`, `ctx.env` rather than raw
`process.env`, and renders any CLI surface through `@moku-labs/common/cli` (`createBrandConsole`,
`box`, `spinnerFrameAt`, styled `confirm`/`select`). The `validate-common-usage` hook and
`moku-structure-validator` enforce this. Rules MC1–MC3 with examples live in the `moku-common-conventions`
skill's `references/conventions.md`.

## 5. Install

```bash
cd "$ABSOLUTE_PROJECT_PATH" && bun install
cd "$ABSOLUTE_PROJECT_PATH" && bunx lefthook install
cd "$ABSOLUTE_PROJECT_PATH" && bun run format
```

A failed `bun install` stops the scaffold: the usual causes are registry connectivity, a version
conflict, or a malformed `package.json`. Fix the cause, re-run `bun install`, and continue from
`lefthook install` — there is no need to restart.

`lefthook install` needs `node_modules`, so it runs after the install. `bun run format` normalizes
the generated files to Biome's own output so the first commit carries no formatting drift.

## Verification

Run every item. Fix and re-run a failing one before moving on.

| # | Check | Command or evidence |
|---|---|---|
| 1 | Dependencies installed | `bun install` exited 0 |
| 2 | Types | `bun run typecheck` clean. The usual failure is a missing `include` entry (`*.config.ts`) — compare the written `tsconfig.json` against `tooling-config.md` and rewrite it before re-running. |
| 3 | Lint | `bun run lint` — biome and oxlint, zero warnings |
| 4 | Tests | `bun run test` — the placeholder suites pass |
| 5 | Build | `bun run build` |
| 6 | Package validation | `bun run validate` (packages only) |
| 7 | Sources match the type | Framework: `src/config.ts` exports `{ createPlugin, createCore }`, `src/index.ts` exports `{ createApp, createPlugin }`, `src/plugins/` exists. Consumer: `src/index.ts` imports `createApp` from the framework package, and `@moku-labs/core` is absent from `dependencies` — if present, remove it, re-run `bun install`, re-check. Library: `src/index.ts` exists. Game: `index.ts` default-exports `defineGameApp`, `config.ts` exists, `@moku-labs/game` in `dependencies`, `@moku-labs/editor` in `devDependencies`, `bun run keys` and `bun run build` exit 0 (`build` runs `moku-game keys --check` first), `.moku` is in `.gitignore`, no `bunfig.toml`, the headless test walks the first flow, `tests/visual/index.ts` exists and a second `bun run test:visual` prints `state same · describe same` for every checkpoint and exits 0. |
| 8 | Git | `.git` exists; `bunx lefthook install` succeeded |
| 8.5 | Game runs | Games only: init Step 5.5 showed the scene in the editor, and the editor's start log says `files:project-on`. |
| 9 | Release plumbing | Packages: `.github/workflows/ci.yml` and `publish.yml` present, all eight scripts in `package.json`. Apps and games: `ci.yml` present; `lint`, `typecheck`, `test`, `test:coverage`, `build`, `deploy` in `package.json`; the app variant of `lefthook.yml`. A game also has `test:visual` and the `visual` job in its `lefthook.yml`. |

Only after all of these are green does `init` write `.planning/moku.md`.
