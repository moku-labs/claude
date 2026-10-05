# Lint stacks

A moku project lints with one of two stacks. Both keep the script names (`lint`, `lint:fix`, `format`,
`typecheck`), so CI from `@moku-labs/ci` and the orchestrator's repo-wide pass never change. Only the
second linter and the TypeScript version differ.

## Detect

Look at the project root once and keep the answer for the run.

| Root file | Stack | Second linter | TypeScript |
|---|---|---|---|
| `.oxlintrc.json` | **current**: Biome + oxlint | `oxlint` | 7 (the native compiler) |
| `eslint.config.ts` (or `.js`, `.mjs`) | **legacy**: Biome + ESLint | `eslint` | 6 (ESLint needs its JS API) |
| both | in migration: run both, report both | `oxlint` and `eslint` | whatever `package.json` pins |
| neither | Biome only | none | whatever `package.json` pins |

New projects get the current stack. A legacy project stays on ESLint until its owner runs the opt-in
`moku-lint-oxlint` migration in `/moku:upgrade`; never switch a project's linter as a side effect.

## Scoped commands

A builder lints only its own directory. Biome covers formatting, imports and the recommended set; the
second linter carries what Biome lacks (unicorn, jsdoc, the moku and engine rules).

| Stack | Check | Fix |
|---|---|---|
| current | `bunx biome check <dir>` then `bunx oxlint <dir>` | `bunx biome check --write <dir>` then `bunx oxlint --fix <dir>` |
| legacy | `bunx biome check <dir>` then `bunx eslint <dir>` | `bunx biome check --write <dir>` then `bunx eslint --fix <dir>` |

`eslint` in the legacy stack skips `.tsx`, which Biome covers. `oxlint` reads `.tsx` too.

## Disable comments

Both read `// eslint-disable-next-line <rule>`. Rule names differ where a rule moved: in the current stack
the JS-plugin rules carry an alias (`jsdoc-js/...`, `unicorn-js/prevent-abbreviations`) and the engine
rules live under `moku/...`. Write the name the project's own config uses.
