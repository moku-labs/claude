# Target Stack Manifest

The **single source of truth for what a current Moku project's toolchain should be.** `/moku:init`
scaffolds *to* this stack; `/moku:upgrade` migrates an existing project *toward* it. The full,
copy-exact configs live in `tooling-config.md` — this file is the concise, machine-readable summary
plus the version history that `/moku:upgrade` reads to compute a delta.

When you change the prescribed stack, do all three in the same release:
1. Edit the canonical config in `tooling-config.md`.
2. Bump **Stack version** here and append a row to the history table.
3. Add a migration entry in `upgrade-migrations.md` so existing projects can move up.

---

## Current target — Stack version 4 (current lint stack: Biome + oxlint · TypeScript 7 · Node 24 floor)

Stack 4 makes the current lint stack the default (`lint-stacks.md`). Biome + oxlint replaces
Biome + ESLint, and TypeScript moves to 7, the native compiler. The Node 24 floor of Stack 3 is
unchanged. The hardcoded target for `/moku:upgrade` ships with the installed plugin version.

There are two lint stacks. The root file says which one a project is on.

| Root file | Stack | TypeScript | Status |
|---|---|---|---|
| `.oxlintrc.json` | **current**: Biome + oxlint | `7.0.2` | Default. `/moku:init` writes it for every new project. |
| `eslint.config.*` | **legacy**: Biome + ESLint | `6.0.3` | Kept. Never written for a new project. Moves only through the opt-in `moku-lint-oxlint` migration. |

A legacy project is not "below target" because of its linter. It stays on TypeScript 6, because
typescript-eslint needs the TypeScript JS API, which TS 7 does not have.

A game is on the current stack and stays on TypeScript `6.0.3` for the same reason: the project index
of `@moku-labs/editor` reads the code through the TypeScript JS API. A game also has no `tsdown` and
no `tsconfig.build.json`, because `moku-game build` builds it. Its tooling is the game template of the
`moku-game` pack, `references/hello-world.md`.

### Pinned tool versions, current stack (devDependencies)

| Package | Version | Notes |
|---------|---------|-------|
| `typescript` | `7.0.2` | Native compiler, no JS API. Nothing in the stack imports it as a library. |
| `oxlint` | `1.86.0` | Second linter. JS plugins are alpha: re-check the notes in `tooling-config.md` on every bump. |
| `eslint-plugin-jsdoc` | `65.1.0` | Loaded by oxlint as JS plugin `jsdoc-js`, for all jsdoc rules. |
| `eslint-plugin-unicorn` | `63.0.0` | Exact. Loaded as JS plugin `unicorn-js`, for `prevent-abbreviations` only. 70+ fails to load. |
| `tsdown` | `0.23.0` | First version that emits declarations on TS 7: `rolldown-plugin-dts` 0.28 runs the TS 7 binary (`tsgo` generator). |
| `@biomejs/biome` | `2.4.16` | Adds `noExcessiveCognitiveComplexity` (max 15) in place of sonarjs. |
| `@types/bun` | `1.3.14` | No `typescript` peer dep. |
| `@arethetypeswrong/cli` / `core` | `0.18.3` | Bundles its own TypeScript 5.6; works next to TS 7. |
| `publint` | `0.3.21` | No TS dependency. |
| `vitest` / `@vitest/coverage-istanbul` | `4.0.18` | unchanged |
| `lefthook` | `2.1.1` | unchanged |

Removed from the current stack: `eslint`, `eslint-config-biome`, `eslint-plugin-sonarjs`,
`typescript-eslint`, `jiti`, `globals`.

### Pinned tool versions, legacy stack

The Stack 3 pins, unchanged: `typescript` `6.0.3`, `typescript-eslint` `8.58.0`, `tsdown` `0.22.1`,
`eslint` `9.39.3`, `eslint-config-biome` `2.1.3`, `eslint-plugin-jsdoc` `62.6.0`,
`eslint-plugin-sonarjs` `4.0.0`, `eslint-plugin-unicorn` `63.0.0`, `globals` `17.4.0`, `jiti` `2.6.1`.
The rest equals the current stack. Full bodies: `tooling-config.md`, section
`Legacy stack (ESLint, TypeScript 6)`.

### Runtime / engines

| Field | Value |
|-------|-------|
| `engines.node` | `>=24.0.0` |
| `engines.bun` | `>=1.3.14` |
| `.bun-version` | `1.3.14` |

The Node floor follows the upstream moku-family engines: `@moku-labs/core@0.1.3` raised its floor
to `node >=24.0.0` (PR #9) and `@moku-labs/web@1.6.2` already requires `node >=24` — see the
provenance blocks in [moku-frameworks.md](moku-frameworks.md). Bun is the dev runtime; the Node
floor is what npm consumers and CI inherit, so a scaffolded project must not declare a floor
below what its own dependencies enforce.

### tsconfig deltas vs Stack version 1

These are the only tsconfig changes a TS5.9 project needs for TS6 (everything else moku already set).
TS 7 needs none on top. The current stack also drops `declarations.d.ts` from `include`, because no
untyped package is imported any more:

| Option | Required value | Why |
|--------|----------------|-----|
| `compilerOptions.types` | `["bun"]` (framework/app) · `["vite/client", …]` (web) | TS6 defaults `types` to `[]` (no auto-`@types`). Omitting it → `Cannot find name 'Bun'`. |
| `compilerOptions.rootDir` (in `tsconfig.build.json`) | `"./src"` | TS6 defaults `rootDir` to the tsconfig dir; pin it so emit layout is stable. |

Already-correct (no change needed): `module: Preserve`, `moduleResolution: bundler`,
`verbatimModuleSyntax`, `target/lib: ESNext`, `strict`, `exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`, `skipLibCheck`. None of these are on the TS6 removal/deprecation list.

### Detection signature (how `/moku:upgrade` recognizes a below-target project)

Detect the lint stack first (`lint-stacks.md`). A project is **below** its target if ANY of these hold:

- Current stack (`.oxlintrc.json`): `devDependencies.typescript` below `7.0.2`, `tsdown` below `0.23.0`,
  `oxlint` below `1.86.0`, or `eslint-plugin-unicorn` not exactly `63.0.0`.
  A game is the exception on two pins. A game is a project with `@moku-labs/game` in `dependencies`, or
  `type: game` in `.planning/moku.md`. Its `typescript` target is `6.0.3`: only a version below that is a
  gap. It has no `tsdown` and no `tsconfig.build.json`, and their absence is not a gap. The `oxlint` and
  `eslint-plugin-unicorn` pins hold for a game too.
- Legacy stack (`eslint.config.*`): `devDependencies.typescript` matches `^5` or `5.*` (not `^6`/`6.*`),
  `typescript-eslint` `< 8.58.0`, or `tsdown` `< 0.22.1`. TypeScript 6 is the legacy target, not a gap.
- `tsconfig.json` → `compilerOptions.types` is absent (TS6 needs it explicit).
- `tsconfig.build.json` → `compilerOptions.rootDir` is absent.
- `.bun-version` `< 1.3.14` (freshness, advisory).
- `package.json` → `engines.node` floor `< 24.0.0`, or `engines.node` absent (Stack 3 signature).

---

## Moku-family framework versions (separate from the tool stack)

The pinned versions above are the **toolchain** (TypeScript, Biome, Bun, …). The versions of
the Moku **frameworks** a project consumes — `@moku-labs/core`, `@moku-labs/web`, and any
future moku-family package — live in their own registry: [moku-frameworks.md](moku-frameworks.md).
`/moku:upgrade` reads that registry and, when a project depends on one of those packages,
applies the matching `moku-web-version` / `moku-core-version` migration to bump it to the
registry's `knownVersion`. This is intentionally decoupled from the stack version: a Moku
framework can ship a new release without a TypeScript/tooling stack bump, and vice versa. The
registry (and the generated skill plugin-indexes) are kept current by the `moku-sync`
maintainer skill.

## Stack version history

| Stack | moku Claude | Headline | Migration id(s) |
|-------|-------------|----------|-----------------|
| **4** | v0.79.0 | Current lint stack is the default: Biome + oxlint, TypeScript 7.0.2, tsdown 0.23.0; legacy ESLint + TS 6 kept | `moku-lint-oxlint` (opt-in) |
| **3** | v0.45.0 | Node 24 runtime floor — `engines.node` `>=22` → `>=24`, aligning with `@moku-labs/core@0.1.3` / `@moku-labs/web@1.6.2` engines | `node24-floor` |
| **2** | v0.30.0 | TypeScript 6 baseline + tooling freshness; opt-in `tsgo` fast-check | `ts6-core`, `tooling-freshness`, `tsgo-fastcheck` (opt-in) |
| **1** | ≤ v0.29.0 | TypeScript 5.9.3 baseline (tsdown 0.20.x, typescript-eslint 8.56, Bun 1.3.8) | — (initial) |

---

## Reserved / on the horizon (not yet active)

These are documented so the registry's extension path is obvious; they are **not** part of Stack
version 4 and `/moku:upgrade` does not apply them yet.

- **Type-aware oxlint rules.** `oxlint --type-aware` with `oxlint-tsgolint` adds the
  typescript-eslint type rules (`no-floating-promises`, `no-misused-promises`, …). New findings, so
  it lands as its own step after the switch.
- **De-vibecoding migrations.** A future class of migrations that detect and repair patterns flagged
  in `invariants.md` / `house-style.md` (e.g. explicit generics on `createPlugin`, inline logic in
  `index.ts`, missing JSDoc). Each becomes a registry entry with detect → transform → verify.
