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

## Current target — Stack version 2 (TypeScript 6 baseline)

Introduced in moku Claude **v0.30.0**. The hardcoded target for `/moku:upgrade` shipped in this
plugin version.

### Pinned tool versions (devDependencies)

| Package | Version | Notes |
|---------|---------|-------|
| `typescript` | `6.0.3` | TS6 = last JS-codebase release; bridge to TS7 (native `tsgo`). |
| `typescript-eslint` | `8.58.0` | First version to officially support TS6 (≥8.58.0). Older versions print an "unsupported TypeScript version" warning. |
| `tsdown` | `0.22.1` | First version whose `typescript` peer range allows `^6` (`rolldown-plugin-dts ^0.25.1`). |
| `@biomejs/biome` | `2.4.16` | Rust parser — TS-version-agnostic; bumped for freshness. |
| `@types/bun` | `1.3.14` | No `typescript` peer dep — does not gate the TS version. |
| `@arethetypeswrong/cli` / `core` | `0.18.3` | Bundles its own TS; decoupled from project TS. |
| `publint` | `0.3.21` | No TS dependency. |
| `vitest` / `@vitest/coverage-istanbul` | `4.0.18` | `typecheck` shells out to `tsc`; diagnostic format unchanged in TS6. |
| `eslint` | `9.39.3` | Flat config; unchanged. |
| `eslint-config-biome` | `2.1.3` | Must be last in the ESLint array. |
| `eslint-plugin-jsdoc` | `62.6.0` | unchanged |
| `eslint-plugin-sonarjs` | `4.0.0` | unchanged |
| `eslint-plugin-unicorn` | `63.0.0` | unchanged |
| `globals` | `17.4.0` | unchanged |
| `jiti` | `2.6.1` | unchanged |
| `lefthook` | `2.1.1` | unchanged |

### Runtime / engines

| Field | Value |
|-------|-------|
| `engines.node` | `>=22.0.0` |
| `engines.bun` | `>=1.3.14` |
| `.bun-version` | `1.3.14` |

### tsconfig deltas vs Stack version 1

These are the only tsconfig changes a TS5.9 project needs for TS6 (everything else moku already set):

| Option | Required value | Why |
|--------|----------------|-----|
| `compilerOptions.types` | `["bun"]` (framework/app) · `["vite/client", …]` (web) | TS6 defaults `types` to `[]` (no auto-`@types`). Omitting it → `Cannot find name 'Bun'`. |
| `compilerOptions.rootDir` (in `tsconfig.build.json`) | `"./src"` | TS6 defaults `rootDir` to the tsconfig dir; pin it so emit layout is stable. |

Already-correct (no change needed): `module: Preserve`, `moduleResolution: bundler`,
`verbatimModuleSyntax`, `target/lib: ESNext`, `strict`, `exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`, `skipLibCheck`. None of these are on the TS6 removal/deprecation list.

### Detection signature (how `/moku:upgrade` recognizes a Stack v1 project)

A project is **below** the current target if ANY of these hold:

- `package.json` → `devDependencies.typescript` matches `^5` or `5.*` (not `^6`/`6.*`).
- `package.json` → `devDependencies["typescript-eslint"]` `< 8.58.0`.
- `package.json` → `devDependencies.tsdown` `< 0.22.1`.
- `tsconfig.json` → `compilerOptions.types` is absent (TS6 needs it explicit).
- `tsconfig.build.json` → `compilerOptions.rootDir` is absent.
- `.bun-version` `< 1.3.14` (freshness, advisory).

---

## Stack version history

| Stack | moku Claude | Headline | Migration id(s) |
|-------|-------------|----------|-----------------|
| **2** | v0.30.0 | TypeScript 6 baseline + tooling freshness; opt-in `tsgo` fast-check | `ts6-core`, `tooling-freshness`, `tsgo-fastcheck` (opt-in) |
| **1** | ≤ v0.29.0 | TypeScript 5.9.3 baseline (tsdown 0.20.x, typescript-eslint 8.56, Bun 1.3.8) | — (initial) |

---

## Reserved / on the horizon (not yet active)

These are documented so the registry's extension path is obvious; they are **not** part of Stack
version 2 and `/moku:upgrade` does not apply them yet.

- **Stack version 3 — TypeScript 7 native (`tsc`/Corsa GA).** When TS7 ships stable (it was Beta as
  of mid-2026), the target swaps `typescript` to `^7`, makes the deprecation cleanup mandatory
  (`ignoreDeprecations` stops working in TS7), and may revisit the `isolatedDeclarations` stance for
  the native declaration emitter. The `tsgo-fastcheck` opt-in in Stack v2 is the on-ramp.
- **De-vibecoding migrations.** A future class of migrations that detect and repair patterns flagged
  in `invariants.md` / `house-style.md` (e.g. explicit generics on `createPlugin`, inline logic in
  `index.ts`, missing JSDoc). Each becomes a registry entry with detect → transform → verify.
