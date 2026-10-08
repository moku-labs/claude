# Upgrade Migration Registry

The ordered set of migrations `/moku:upgrade` can apply to bring an existing Moku project up to the
current **target stack** (`target-stack.md`). Each migration is a self-contained
**detect → apply → verify** unit. `/moku:upgrade` runs every migration whose `detect` fires (and
whose `default` is `on`, unless the user opts into an `off` one), in the order listed here.

This is the **extension point** for all future stack jumps — build-tool swaps, de-vibecoding,
etc. TypeScript 7 arrives through the opt-in `moku-lint-oxlint` (Stack 4). To add one: append an entry below, bump the stack version in `target-stack.md`,
and (if it changes the scaffold) update `tooling-config.md`.

## Migration entry schema

```
### <id>
- Title:        <human label>
- Stack:        <stack version this belongs to>
- Applies to:   framework | package | app | game | plugin | web | all
- Default:      on | off (opt-in — user is asked at the gate)
- Depends on:   <other migration ids that must run first, or —>
- Detect:       <precise condition that means the project still needs this>
- Apply:        <ordered, idempotent steps>
- Verify:       <command(s) that must pass after Apply>
- Risk:         <what can go wrong + the mitigation>
- Rollback:     <how to undo — usually `git checkout` since git is the safety net>
```

**Invariants for every migration:**
- **Idempotent** — running it twice is a no-op. `detect` must return false after a successful `apply`.
- **Verify-gated** — never mark a migration done until its `verify` passes. Never use `--no-verify`.
- **Reversible via git** — the command refuses to run on a dirty tree (or warns + asks) so the whole
  upgrade is one reviewable diff. Rollback = `git checkout -- <files>` / `git reset`.

---

## Stack version 2 migrations (TypeScript 6 baseline)

### ts6-core
- **Title:** TypeScript 6 baseline (compiler + required tool bumps + tsconfig defaults)
- **Stack:** 2
- **Applies to:** framework, app, plugin, web
- **Default:** on
- **Depends on:** —
- **Detect:** legacy stack only (`eslint.config.*`, no `.oxlintrc.json`; see `lint-stacks.md`), AND:
  `package.json.devDependencies.typescript` matches `^5`/`5.*`, OR
  `typescript-eslint < 8.58.0`, OR `tsdown < 0.22.1` present, OR `tsconfig.json` has no
  `compilerOptions.types`, OR `tsconfig.build.json` exists without `compilerOptions.rootDir`.
- **Apply:**
  1. `package.json`: set `devDependencies.typescript` → `6.0.3`.
  2. `package.json`: set `devDependencies["typescript-eslint"]` → `8.58.0` (TS6 support landed here;
     older prints the typescript-estree "unsupported version" warning).
  3. `package.json`: if `tsdown` is present, set it → `0.22.1` (first peer range allowing `^6`,
     pulls `rolldown-plugin-dts ^0.25.1`).
  4. `tsconfig.json`: add `"types": ["bun"]` to `compilerOptions` (web projects:
     `["vite/client"]` plus any test-config types). TS6 defaults `types` to `[]`, so without this
     `tsc` reports `Cannot find name 'Bun'`. If `types` is already present, merge — do not clobber.
  5. `tsconfig.build.json` (if it exists): add `"rootDir": "./src"` to `compilerOptions` — TS6
     defaults `rootDir` to the tsconfig dir; pin it so emit layout is stable.
  6. Run `bun install` to resolve the new versions.
- **Verify:** `bunx tsc --noEmit` (clean) → `bun run lint` (clean) → `bun run test` (pass) →
  if the project publishes a library, `bun run build` then `bunx publint` + `bunx attw --pack .`
  (emitted `.d.ts` intact). On `tsc` failure, route the output to the **moku-error-diagnostician** agent;
  the most likely new errors come from the `strict`-by-default flip surfacing real issues in deep
  inference chains — fix locally, do not weaken `strict`.
- **Risk:** (a) `types: []` default is the #1 silent breaker — covered by step 4. (b) A handful of
  new `strict` diagnostics in the deepest generic chains are possible; they are legitimate and
  locally fixable. (c) Removed legacy options (amd/umd/system module, classic resolution, `--outFile`,
  `es5` target, `baseUrl`) — moku prescribes none, so near-zero exposure; if a hand-edited tsconfig
  has any, surface it and migrate to the modern equivalent.
- **Rollback:** `git checkout -- package.json tsconfig.json tsconfig.build.json bun.lock && bun install`.

### tooling-freshness
- **Title:** Tooling freshness bumps (Bun, Biome, package validators)
- **Stack:** 2
- **Applies to:** all
- **Default:** on
- **Depends on:** —
- **Detect:** `.bun-version < 1.3.14`, OR `@biomejs/biome < 2.4.16`, OR `@types/bun < 1.3.14`, OR
  `publint < 0.3.21`, OR `@arethetypeswrong/cli < 0.18.3`, OR `engines.bun` floor `< 1.3.14`.
- **Apply:**
  1. `.bun-version` → `1.3.14`; `package.json.engines.bun` → `>=1.3.14`.
  2. `package.json.devDependencies`: `@biomejs/biome` → `2.4.16`, `@types/bun` → `1.3.14`,
     `publint` → `0.3.21`, `@arethetypeswrong/cli` and `@arethetypeswrong/core` → `0.18.3`.
  3. `biome.json`: update `$schema` URL to `…/schemas/2.4.16/schema.json`.
  4. `bun install`.
- **Verify:** `bun run format` (no unexpected churn beyond formatting), `bun run lint`,
  `bunx tsc --noEmit`. Biome minor bumps can introduce new lint rules — if new lint findings appear,
  report them; auto-fix formatting only (`biome check --write`), leave rule violations for the user.
- **Risk:** Biome rule additions can flag previously-clean code (advisory, not a hard break). Bun
  runtime bump is low-risk (Bun never consumes the `typescript` package). Mitigation: this migration
  is independently skippable at the gate if the user wants TS6 only.
- **Rollback:** `git checkout -- package.json biome.json .bun-version bun.lock && bun install`.

### tsgo-fastcheck  *(opt-in, legacy stack only)*
- **Title:** TypeScript 7 native preview (`tsgo`) as an opt-in fast type-checker, side-by-side with `tsc`
- **Stack:** 2
- **Applies to:** framework, app, plugin
- **Default:** **off** — the user is explicitly asked at the gate; never applied silently.
- **Depends on:** ts6-core
- **Detect:** the project is on the legacy stack (`eslint.config.*`, no `.oxlintrc.json`) AND the user
  opted in AND `package.json.devDependencies["@typescript/native-preview"]` is absent. Never offered
  on the current stack: there `tsc` already is TypeScript 7. Never offered in the same run as
  `moku-lint-oxlint`, which removes it.
- **Apply:**
  1. `package.json.devDependencies`: add `"@typescript/native-preview": "latest"` (ships nightly
     `7.0.0-dev.*` builds; pin to a specific build for reproducible CI if desired).
  2. `package.json.scripts`: add `"typecheck:fast": "tsgo --noEmit"` (the `tsgo` binary comes from
     the native-preview package). **Leave the existing `tsc`-based scripts as the authoritative
     gate** — `lint`/`validate`/pre-commit keep using real `tsc`/`tsdown`.
  3. `bun install`.
  4. Append a note to the project `CLAUDE.md`: "`bun run typecheck:fast` runs the TS7 native
     preview for fast inner-loop checks; `bunx tsc --noEmit` remains the authoritative gate and the
     `.d.ts` publish path."
- **Verify:** `bun run typecheck:fast` runs and, on clean code, agrees with `bunx tsc --noEmit`.
  Treat `tsc` as the source of truth on any disagreement.
- **Risk:** `tsgo` is **Beta / nightly** — feature parity is "very nearly complete," not identical
  (~74/6000 error cases diverge; JS/JSDoc handling intentionally changed; emits **no** `.d.ts` on
  type error, unlike `tsc`). So it is suitable as a fast *checker* only — NOT as the emit/publish
  compiler. That is exactly why this migration is off by default and adds a *parallel* script rather
  than replacing `tsc`.
- **Rollback:** remove the dep + script, `git checkout -- package.json CLAUDE.md bun.lock && bun install`.

---

## Stack version 3 migrations (Node 24 runtime floor)

### node24-floor
- **Title:** Raise the declared Node engines floor to 24 (upstream moku-family engines alignment)
- **Stack:** 3
- **Applies to:** all
- **Default:** on
- **Depends on:** —
- **Detect:** `package.json.engines.node` floor `< 24.0.0` (e.g. `>=22.0.0`), OR `engines.node`
  absent.
- **Apply:**
  1. `package.json`: set `engines.node` → `">=24.0.0"`. Leave `engines.bun` untouched — the Bun
     floor is owned by Stack 2's `tooling-freshness`.
  2. If the project carries a Node version pin file (`.nvmrc` / `.node-version` — not scaffolded
     by moku, but may exist in migrated projects) pinning `< 24`, surface it and raise it to `24`
     with the user's confirmation (CI may read it).
  3. No `bun install` needed — `engines` is declarative metadata, not a dependency.
- **Verify:** `bunx tsc --noEmit` → `bun run lint` → `bun run test` (the floor is install-time
  metadata; the gate confirms nothing else drifted). Advisory: if the local `node --version` is
  `< 24`, warn that the developer's runtime is now below the project's declared floor — Bun
  remains the dev runtime, but npm consumers and CI inherit the Node floor.
- **Risk:** Zero code risk — no API or build change. The intended effect is on consumers and CI
  still on Node 22: npm `engine-strict` installs and Node-22 CI jobs start failing **by design**,
  because `@moku-labs/core@0.1.3` (PR #9) and `@moku-labs/web@1.6.2` already declare
  `node >=24` — a project keeping `>=22` would promise a floor its own dependencies don't honor.
  Mitigation: the migration is visible at the gate; drop Node 22 from any CI matrix in the same
  change.
- **Rollback:** `git checkout -- package.json` (plus `.nvmrc`/`.node-version` if touched).

---

## Stack version 4 migrations (current lint stack: Biome + oxlint · TypeScript 7)

### moku-lint-oxlint  *(opt-in, Stack 4)*
- **Title:** Move a legacy project from Biome + ESLint on TypeScript 6 to Biome + oxlint on TypeScript 7
- **Stack:** 4
- **Applies to:** package, app, game
- **Default:** **off**. Opt-in: applied only after the owner's explicit yes at the gate. Never a side
  effect of another migration. A legacy project that says no stays on its legacy target.
- **Depends on:** ts6-core, tooling-freshness (the project is on the legacy target first)
- **Detect:** `eslint.config.*` (`.ts`, `.js` or `.mjs`) at the root AND no `.oxlintrc.json`.
- **Apply:** the migration swaps the linter, not the rule set. The project keeps its own rules.
  0. **Baseline.** On the clean tree run `bun run lint` and note the Biome and ESLint error and
     warning counts and the time. For the parity count, take a throwaway copy, neutralise every
     disable comment and count ESLint findings per plugin:
     ```sh
     git ls-files -z '*.ts' '*.tsx' | xargs -0 perl -pi -e 's/eslint-disable/eslint-neutral/g'
     bunx eslint . -f json -o eslint-parity.json
     ```
  1. **devDependencies.** Remove `eslint`, `eslint-config-biome`, `eslint-plugin-sonarjs`,
     `typescript-eslint`, and `jiti` and `globals` unless project code imports them
     (`git grep -nE 'from "(jiti|globals)"'`). Set the current-stack pins from `tooling-config.md`
     (`typescript`, `oxlint`, `eslint-plugin-jsdoc`, `eslint-plugin-unicorn` exact, `tsdown` if present).
     Remove `@typescript/native-preview` and the `typecheck:fast` script if `tsgo-fastcheck` added
     them: `tsc` is TypeScript 7 now. Keep `devDependencies` sorted.
  2. **`.oxlintrc.json`.** Copy the canonical body from `tooling-config.md`. Its `plugins`,
     `jsPlugins`, `categories`, `env` and top-level `rules` stay as they are. Then translate the
     project's own `eslint.config.*`:
     - Global `ignores` → `ignorePatterns`. Drop `node_modules/**` and `bun.lock`; oxlint skips them.
     - The `unicorn/prevent-abbreviations` `allowList` → the union of the canonical list and the
       project's.
     - Each block with `files` → one entry in `overrides`, same order, same `files`, same rule
       options. A project on the unchanged legacy template ends with the canonical overrides. Where
       the project's setting differs from the canonical one (for example
       `ArrowFunctionExpression: true`, or `require-example` on for all of `src/`), the project wins.
     - A block's own `ignores` → `excludeFiles` in that override.
     - Rule names: `jsdoc/*` → `jsdoc-js/*`; `unicorn/prevent-abbreviations` →
       `unicorn-js/prevent-abbreviations`; every other `unicorn/*` stays (native).
     - Dropped: `sonarjs/*`, `@typescript-eslint/consistent-type-imports` (Biome `useImportType`
       covers it), `jsdoc/no-types`.
     - `no-restricted-imports`, `@typescript-eslint/no-restricted-imports` and
       `no-restricted-syntax` are never copied over as they are. oxlint merges the two import rules
       into one, so overrides replace each other. It also checks `import()`. Its `regex` is Rust, so a
       lookahead never matches, and silently. A game takes these rules from step 3. Any other
       project moves them into a local JS plugin (`lint/<name>.mjs`, listed in `jsPlugins`) that uses
       JS `RegExp`, one rule per concern.
     - Never use `@oxlint/migrate` output as it is. It drops a block's `ignores` with only a warning.
  3. **Game only: engine rules.** The engine ships them as `@moku-labs/game/lint` since 0.4.6.
     - `bun add @moku-labs/game@latest` when the installed game is below 0.4.6.
     - Add `"@moku-labs/game/lint"` to `jsPlugins` after the two tooling entries. Add the six rules
       `moku-game/lazy-imports`, `native-imports`, `dev-imports`, `no-module-state`, `determinism`,
       `rules-siblings`, each `"error"`; also `static-keys` (game 0.7 and later) and `layer-imports`,
       `feature-door`, `test-suffix` (game 0.9 and later). The moku-game pack's `references/hello-world.md` has the full
       game `.oxlintrc.json`: its four edits also set the game's `overrides` files and ignore
       `generated/**` and `.moku/**`.
     - Drop the game's G1–G4 blocks. They are not translated: the six rules replace them. Their
       defaults match the template layout; a game with another layout passes
       `["error", { "files": [...], "ignores": [...] }]`.
     - Two findings are new: `import { type A } from "pixi.js"` is reported (write `import type`),
       and a module-scope `var` is reported. `new Date(now)` passes now.
     - Disable comments: `no-restricted-syntax`, `no-restricted-properties`, `no-restricted-globals`
       and `no-restricted-imports` → the matching `moku-game/*` rule id.
  4. **`biome.json`.** Add `complexity.noExcessiveCognitiveComplexity` (`error`, max 15) under
     `linter.rules`, as in `tooling-config.md`. It replaces sonarjs cognitive complexity. Biome counts
     differently: fix a new finding, do not mute it.
  5. **Scripts, hooks, editor, docs.**
     - `package.json`: `"lint": "biome check . && oxlint"`, `"lint:fix": "biome check --write . && oxlint --fix"`.
     - `lefthook.yml`: the `eslint-check` job becomes `oxlint-check` with
       `run: bunx oxlint --no-error-on-unmatched-pattern {staged_files}`. Keep the job's `glob`.
     - `.claude/settings.local.json`: `Bash(bunx eslint:*)` → `Bash(bunx oxlint:*)`.
     - `.vscode/extensions.json`, if present: `dbaeumer.vscode-eslint` → `oxc.oxc-vscode`.
     - Project `CLAUDE.md` and README lines that name ESLint take the wording of the CLAUDE.md
       template in `tooling-config.md` ("Biome check + oxlint", `import type` by Biome `useImportType`).
  6. **Delete** `eslint.config.*` and the `declare module "eslint-config-biome";` line. If
     `declarations.d.ts` is then empty, delete it and drop it from `include` in `tsconfig.json`.
  7. **Disable comments.** Rename the moved rules, drop the dead sonarjs ones, then format. Use
     `git ls-files` and `perl`: `grep -rl` skips a file it thinks is binary (one NUL byte in a string
     literal is enough), and `sed -i` differs between macOS and Linux.
     ```sh
     git ls-files -z '*.ts' '*.tsx' '*.js' '*.mjs' '*.cjs' | xargs -0 perl -pi -e 'if (/eslint-disable/) { s#\bjsdoc/#jsdoc-js/#g; s#\bunicorn/prevent-abbreviations\b#unicorn-js/prevent-abbreviations#g }'
     git ls-files -z '*.ts' '*.tsx' '*.js' '*.mjs' '*.cjs' | xargs -0 perl -ni -e 'print unless m{^\s*(//|/\*)\s*eslint-disable(-next-line|-line)?\s+sonarjs/[\w-]+(\s+--.*|\s*\*/)?\s*$}'
     git grep -nE 'eslint-disable.*(sonarjs/|jsdoc/|unicorn/prevent-|no-restricted-)'
     bun run format
     ```
     The `git grep` must print nothing. A line it prints mixes rules: edit it by hand. When step 2
     or 3 moved restricted rules into a JS plugin, rename those names to the plugin's rule names
     (for example `no-restricted-syntax` → `moku/restricted-syntax`). `bun run format` removes the
     blank first line a deleted file-level comment leaves.
  8. **Project code that drives ESLint.** `git grep -nE 'from "eslint"|new ESLint\('`. A test that
     asks ESLint for its config (`calculateConfigForFile`, `isPathIgnored`) moves to
     `bunx oxlint --format=json <files>` and checks `number_of_files`: oxlint skips an ignored file
     silently, so the count proves coverage.
  9. **TypeScript 7 code issues.** TS 7 has no JS API. `git grep -nE 'from "typescript"|require\("typescript"\)'`:
     - `ts.transpileModule` in a test → `new Bun.Transpiler({ loader: "ts" }).transformSync(source)`.
     - Any other use of the API: replace it, or use a tool that bundles its own TypeScript.
     - New TS 7 type errors are real. Fix them locally, for example `hName` on `{}` in a remark plugin
       → type the node data as mdast `Data`. Never weaken `strict`.
  10. **`bun install`.** Expected and harmless: `incorrect peer dependency "typescript@7.0.2"` from the
      `@typescript-eslint/*` helpers inside `eslint-plugin-jsdoc`, and on every build tsdown's
      `TypeScript 7.0 does not yet have a stable API and is experimental.`
- **Verify:** each must pass, in order: `bun run lint` → `bun run typecheck` → `bun run test` →
  `bun run build` → `bun run validate` (packages) → `bunx lefthook run pre-commit` with the change
  staged. Then compare with the baseline:
  - `bun run lint`: 0 errors, as before. Report the time before and after.
  - Parity: neutralise the disable comments in a throwaway copy again and run
    `bunx oxlint --format=json`. Expected: jsdoc equal, sonarjs gone, unicorn within a few. The native
    unicorn ports differ (`consistent-function-scoping`, `no-array-callback-reference`,
    `prefer-export-from`). Fix a new native finding in the code, or disable it on its line with a
    reason. Never turn a rule off for the whole project.
  - On failure, route the output to the **moku-error-diagnostician** agent (bounded 3 rounds).
- **Risk:** (a) oxlint JS plugins are alpha. `eslint-plugin-unicorn` 70+ fails to load, so it stays
  pinned at `63.0.0`. `jsdoc-js/tag-lines` stays silent when oxlint lints two or more files; the
  `moku-style-validator` agent covers the blank line before tags. (b) sonarjs findings disappear on
  purpose. In the measured repos every sonarjs finding was suppressed by hand, and sonarjs was 8 of
  the 11 seconds of JS-plugin time on game. Cognitive complexity moves to Biome. (c) Type-aware
  rules stay off (`options.typeAware`). ESLint ran none either: `tseslint.configs.base` sets no
  `parserOptions.project`. Turning them on is its own step with new findings. (d) TS 7 has no JS
  API: any tool that imports `typescript` breaks. Step 9 finds it. (e) `rolldown-plugin-dts` accepts
  `typescript ~7.0.0`: never move TypeScript to 7.1 alone.
- **Rollback:** the tree was clean before the run: `git checkout HEAD -- . && rm -f .oxlintrc.json`
  (plus a local `lint/*.mjs` plugin if step 2 or 3 added one) `&& bun install`.

---

## Moku-family framework versions (registry-driven)

These migrations bump a **depended-on Moku-family package** to the version recorded in
[moku-frameworks.md](moku-frameworks.md). They are **not** tied to a stack version — they
fire whenever a project depends on the package and is behind the registry's `knownVersion`.
The version target lives in the registry, so a routine upstream bump only edits
`knownVersion` there; these entries never change. (The registry is refreshed from upstream
by the `moku-sync` maintainer skill.) To register a *new* moku-family framework for the
same treatment, add a registry entry — no new migration prose is required beyond a clone of
the block below.

### moku-web-version
- **Title:** Bump `@moku-labs/web` to the current registry version
- **Stack:** — (registry-driven, stack-independent)
- **Applies to:** app, web
- **Default:** on
- **Depends on:** moku-core-version (when the project also depends directly on `@moku-labs/core`)
- **Detect:** `package.json` dependencies/devDependencies contain `@moku-labs/web` AND its
  resolved/declared version `< frameworks[web].knownVersion` in `moku-frameworks.md`.
- **Apply:**
  1. Read `frameworks[web].knownVersion` from `moku-frameworks.md` (e.g. `1.6.1`).
  2. `package.json`: set the `@moku-labs/web` dependency to that version (preserve the range
     operator the project already uses — `^`/`~`/exact; default to exact if none).
  3. Do NOT add a direct `@moku-labs/core` dependency — `@moku-labs/web` pins core itself.
  4. `bun install` to resolve.
  5. **Crossing the 1.x → 2.0.0 boundary (BREAKING — SPA "component"→"island" rename):** the
     SPA authoring API and all SPA-context `component` terminology were renamed to `island`.
     Apply the codemod across the consumer's `src/` (NOT Preact `components/` — `GalleryComponent`,
     `h(Component)`, the content `gallery.component` option stay): `createComponent`→`createIsland`;
     `Component*` SPA type imports → `Island*`; the `data-component` attribute → `data-island`
     (JSX/CSS/HTML/e2e); `spa:component-mount`/`-unmount` events → `spa:island-*`;
     `ctx.component()`/`app.spa.component()` → `.island()`; config `spa.components` → `spa.islands`;
     the `mountIsland` test-harness `components` option → `islands`. No aliases remain (hard rename).
- **Verify:** `bunx tsc --noEmit` → `bun run lint` → `bun run test`. For a web project also
  `bun run build` (SSG output intact). On failure, route to the **moku-error-diagnostician** agent
  (bounded 3 rounds); breaking API changes between web versions are real source edits — fix
  against the regenerated `skills/moku-web/references/plugin-index.md`, never weaken types.
- **Risk:** A minor/major `@moku-labs/web` bump can change plugin APIs/events. Mitigation:
  the plugin index is regenerated by `moku-sync` before this migration ships, so the current
  API surface is documented; review the release notes (`frameworks[web].releaseSource`).
- **Rollback:** `git checkout -- package.json bun.lock && bun install`.

### moku-core-version
- **Title:** Bump `@moku-labs/core` to the current registry version
- **Stack:** — (registry-driven, stack-independent)
- **Applies to:** framework
- **Default:** on
- **Depends on:** —
- **Detect:** `package.json` contains a **direct** `@moku-labs/core` dependency (Layer-2
  frameworks only — consumer apps must not) AND its version `< frameworks[core].knownVersion`
  in `moku-frameworks.md`.
- **Apply:**
  1. Read `frameworks[core].knownVersion` (e.g. `0.1.3`).
  2. `package.json`: set `@moku-labs/core` to that version (preserve the range operator;
     note prereleases like `0.1.0-alpha.6` are exact-pinned — keep them exact).
  3. `bun install`.
- **Verify:** `bunx tsc --noEmit` → `bun run lint` → `bun run test` → (publishable framework)
  `bun run build` + `bunx publint` + `bunx attw --pack .`. On failure → moku-error-diagnostician.
- **Risk:** Core is the kernel; a bump can ripple into the factory chain. Mitigation: run for
  frameworks only, verify the emitted `.d.ts`, review core release notes.
- **Rollback:** `git checkout -- package.json bun.lock && bun install`.

### moku-worker-version
- **Title:** Bump `@moku-labs/worker` to the current registry version
- **Stack:** — (registry-driven, stack-independent)
- **Applies to:** app, worker
- **Default:** on
- **Depends on:** moku-core-version (when the project also depends directly on `@moku-labs/core`)
- **Detect:** `package.json` dependencies/devDependencies contain `@moku-labs/worker` AND its
  resolved/declared version `< frameworks[worker].knownVersion` in `moku-frameworks.md` (currently `0.20.3`).
- **Apply:**
  1. Read `frameworks[worker].knownVersion` from `moku-frameworks.md`.
  2. `package.json`: set the `@moku-labs/worker` dependency to that version (preserve the range operator
     the project already uses — `^`/`~`/exact; default to exact if none).
  3. Do NOT add a direct `@moku-labs/core` dependency — `@moku-labs/worker` pins core (and
     `@moku-labs/common`) itself.
  4. `bun install` to resolve.
- **Verify:** `bunx tsc --noEmit` → `bun run lint` → `bun run test` (+ `bun run build` for a publishable
  package). On failure → **moku-error-diagnostician** (bounded 3 rounds); breaking API changes are real source
  edits — fix against the regenerated `skills/moku-worker/references/plugin-index.md`, never weaken types.
- **Risk:** A minor/major `@moku-labs/worker` bump can change the Cloudflare plugin APIs/bindings.
  ⚠️ **Crossing 0.7.0 is breaking — keyed-map resource config.** Projects on `< 0.7.0` configure each
  resource plugin (kv/d1/queues/storage/durableObjects) with a flat single binding (`kv.binding`,
  `d1.binding`, `storage.bucket`, …); 0.7.0+ takes a `Record<key, instance>` of named instances
  (`{ name, binding, … }`), accessed via `app.<kind>.use("key")` (+ an implicit default), and
  `deployManifest()` returns an array. Migrate each flat config to a one-entry keyed map and update call
  sites against the regenerated `plugin-index.md`. ⚠️ **Crossing 0.12.0 is also breaking — the `stage`
  plugin was removed:** deployment stage is now plain global config (set `config.stage`, read via
  `ctx.global.stage`); a project that read stage through the old `stage` plugin must switch to global
  config. Mitigation: the plugin index is regenerated by `moku-sync` before this migration ships; review
  the release notes (`frameworks[worker].releaseSource`).
- **Rollback:** `git checkout -- package.json bun.lock && bun install`.

### moku-room-version
- **Title:** Bump `@moku-labs/room` to the current registry version
- **Stack:** — (registry-driven, stack-independent)
- **Applies to:** app
- **Default:** on
- **Depends on:** — (room is a standalone `@moku-labs/core` framework that **bundles** core + common; it
  does not depend on `@moku-labs/web`, so there is **no** `moku-web-version` prerequisite. A consumer app must
  NOT add a direct `@moku-labs/core` dependency. Since `0.3.1`, room declares `@moku-labs/worker@^0.15.0` as an
  **optional peer** — needed only by apps that adopt the `./server` signaling tier.)
- **Detect:** `package.json` dependencies contain `@moku-labs/room` AND its resolved/declared version
  `< frameworks[room].knownVersion` in `moku-frameworks.md` (currently `0.8.3`).
- **Apply:**
  1. Read `frameworks[room].knownVersion` from `moku-frameworks.md`.
  2. `package.json`: set `@moku-labs/room` to that version (preserve the range operator; default exact).
  3. Do NOT add a direct `@moku-labs/web` or `@moku-labs/core` dependency — room bundles core + common. If the
     app carried `@moku-labs/web` ONLY for room, it can be dropped.
  4. **If the app uses the `./server` signaling tier:** ensure `@moku-labs/worker@^0.15.0` is a direct
     dependency (the optional peer), and that `src/server.ts` composes `hubPlugin` (from
     `@moku-labs/room/server`) into ONE `@moku-labs/worker` `createApp` — NOT `createApp` from
     `@moku-labs/room/server` (removed in `0.3.1`). See `plugin-index.md §4` + `moku-idioms.md §I6`.
  5. `bun install` to resolve.
- **Verify:** `bunx tsc --noEmit` → `bun run lint` → `bun run test` (+ `bun run build`). On failure →
  moku-error-diagnostician; fix against the regenerated `skills/moku-room/references/plugin-index.md`.
- **Risk:** ⚠️ **Two breaking re-architectures cross this migration — both are source rewrites, not routine
  bumps.** (1) **0.1.x → 0.2.0 (#4):** room went from a *plugin pack* spread into a `@moku-labs/web` app
  (`roomPlugins.stage`/`.controller`, `createPlugin` from web) to a **standalone `@moku-labs/core` framework**
  you `createApp` from — replace `createApp({ plugins: [...roomPlugins.stage, game] })` (from web) with
  `createApp({ plugins: [stagePlugin, game] })` from `@moku-labs/room`, drop `@moku-labs/web` if it was only
  there for room. (2) **0.2.0 → 0.3.1 (#6):** the `./server` tier is **no longer a core** — an app that
  `createApp`'d from `@moku-labs/room/server` must switch to composing `hubPlugin` (+ `durableObjects`/`deploy`/
  `cli`) into its **own single `@moku-labs/worker` `createApp`** and add `@moku-labs/worker` as a direct dep
  (the one-worker idiom, `moku-idioms.md §I6`). Pure-client apps are unaffected by (2). Apply against the
  regenerated `plugin-index.md`, never weaken types. Mitigation: regenerated plugin index + release notes
  (`frameworks[room].releaseSource`).
- **Rollback:** `git checkout -- package.json bun.lock && bun install`.

### moku-common-version
- **Title:** Bump `@moku-labs/common` to the current registry version
- **Stack:** — (registry-driven, stack-independent)
- **Applies to:** framework, app
- **Default:** on
- **Depends on:** moku-core-version (when the project also depends directly on `@moku-labs/core`)
- **Detect:** `package.json` dependencies/devDependencies contain `@moku-labs/common` AND its
  resolved/declared version `< frameworks[common].knownVersion` in `moku-frameworks.md` (currently `0.3.4`).
- **Apply:**
  1. Read `frameworks[common].knownVersion` from `moku-frameworks.md`.
  2. `package.json`: set the `@moku-labs/common` dependency to that version (preserve the range operator
     the project already uses — `^`/`~`/exact; default to exact if none).
  3. Touch only a direct dependency. A project that gets `@moku-labs/common` through a framework (web, worker, room bundle it) has none to bump.
  4. `bun install` to resolve.
- **Verify:** `bunx tsc --noEmit` → `bun run lint` → `bun run test` (+ `bun run build` for a publishable
  package). On failure → **moku-error-diagnostician** (bounded 3 rounds); fix against the pack's
  `skills/moku-common/references/plugin-index.md`, never weaken types.
- **Risk:** No breaking crossing is recorded yet. `moku-sync common` records them here when it syncs a
  release that has one; review the release notes (`frameworks[common].releaseSource`).
- **Rollback:** `git checkout -- package.json bun.lock && bun install`.

### moku-native-version
- **Title:** Bump `@moku-labs/native` to the current registry version
- **Stack:** — (registry-driven, stack-independent)
- **Applies to:** app
- **Default:** on
- **Depends on:** —
- **Detect:** `package.json` dependencies/devDependencies contain `@moku-labs/native` AND its
  resolved/declared version `< frameworks[native].knownVersion` in `moku-frameworks.md` (currently `0.3.3`).
- **Apply:**
  1. Read `frameworks[native].knownVersion` from `moku-frameworks.md`.
  2. `package.json`: set the `@moku-labs/native` dependency to that version (preserve the range operator
     the project already uses — `^`/`~`/exact; default to exact if none).
  3. Do NOT add a direct `@moku-labs/core` dependency — `@moku-labs/native` depends on core and `@moku-labs/common` itself.
  4. `bun install` to resolve.
- **Verify:** `bunx tsc --noEmit` → `bun run lint` → `bun run test` (+ `bun run build` for a publishable
  package). On failure → **moku-error-diagnostician** (bounded 3 rounds); fix against the pack's
  `skills/moku-native/references/plugin-index.md`, never weaken types.
- **Risk:** No breaking crossing is recorded yet. `moku-sync native` records them here when it syncs a
  release that has one; review the release notes (`frameworks[native].releaseSource`).
- **Rollback:** `git checkout -- package.json bun.lock && bun install`.

### moku-system-version
- **Title:** Bump `@moku-labs/system` to the current registry version
- **Stack:** — (registry-driven, stack-independent)
- **Applies to:** app
- **Default:** on
- **Depends on:** —
- **Detect:** `package.json` dependencies/devDependencies contain `@moku-labs/system` AND its
  resolved/declared version `< frameworks[system].knownVersion` in `moku-frameworks.md` (currently `0.3.1`).
- **Apply:**
  1. Read `frameworks[system].knownVersion` from `moku-frameworks.md`.
  2. `package.json`: set the `@moku-labs/system` dependency to that version (preserve the range operator
     the project already uses — `^`/`~`/exact; default to exact if none).
  3. Do NOT add a direct `@moku-labs/core` dependency — `@moku-labs/system` depends on core and `@moku-labs/common` itself. Its `@tauri-apps/*` peers stay as the project declares them.
  4. `bun install` to resolve.
- **Verify:** `bunx tsc --noEmit` → `bun run lint` → `bun run test` (+ `bun run build` for a publishable
  package). On failure → **moku-error-diagnostician** (bounded 3 rounds); fix against the pack's
  `skills/moku-system/references/plugin-index.md`, never weaken types.
- **Risk:** No breaking crossing is recorded yet. `moku-sync system` records them here when it syncs a
  release that has one; review the release notes (`frameworks[system].releaseSource`).
- **Rollback:** `git checkout -- package.json bun.lock && bun install`.

---

### moku-game-version
- **Title:** Bump `@moku-labs/game` to the current registry version
- **Stack:** — (registry-driven, stack-independent)
- **Applies to:** game
- **Default:** on
- **Depends on:** —
- **Detect:** `package.json` dependencies/devDependencies contain `@moku-labs/game` AND its
  resolved/declared version `< frameworks[game].knownVersion` in `moku-frameworks.md` (currently `0.13.0`).
- **Apply:**
  1. Read `frameworks[game].knownVersion` from `moku-frameworks.md`.
  2. `package.json`: set the `@moku-labs/game` dependency to that version (preserve the range operator
     the project already uses — `^`/`~`/exact; default to exact if none).
  3. Do NOT add a direct `@moku-labs/core` dependency. Bump `@moku-labs/editor` in the same step (moku-editor-version): the editor follows the engine's door catalogue. Re-run the key scan after the install (`bun run keys` on a shell game, `bun run assets:keys` on an older one). Crossing 0.10 moves a game onto the shell (`index.ts` + `config.ts`, no `web/`, `native.ts`, `platform-bridge.ts`); that is not a version bump: follow the pack's `hello-world.md` by hand. Crossing 0.8: import `defineVisualTest`, `runVisualTests` and `parseVisualArgv` from `@moku-labs/game/visual`, not `/testing`. Reaching 0.12: the generated strings modules import `messageArgument` and `messageDuration` from the engine, so the key scan must run before the typecheck; a game with `tests/visual/` may drop its own runner for `moku-game visual` (it needs `tests/visual/index.ts`); `fx-` textures may move into an `fx/` folder.
  4. `bun install` to resolve.
- **Verify:** `bunx tsc --noEmit` → `bun run lint` → `bun run test` (+ `bun run build`). On failure →
  **moku-error-diagnostician** (bounded 3 rounds); fix against the pack's
  `skills/moku-game/references/plugin-index.md`, never weaken types.
- **Risk:** pre-1.0, minors may break. Read the release notes (`frameworks[game].releaseSource`) and the
  installed `llms.txt` / README before applying; `moku-sync game` records breaking crossings here.
- **Rollback:** `git checkout -- package.json bun.lock && bun install`.

---

### moku-editor-version
- **Title:** Bump `@moku-labs/editor` to the current registry version
- **Stack:** — (registry-driven, stack-independent)
- **Applies to:** game
- **Default:** on
- **Depends on:** —
- **Detect:** `package.json` dependencies/devDependencies contain `@moku-labs/editor` AND its
  resolved/declared version `< frameworks[editor].knownVersion` in `moku-frameworks.md` (currently `0.9.0`).
- **Apply:**
  1. Read `frameworks[editor].knownVersion` from `moku-frameworks.md`.
  2. `package.json`: set the `@moku-labs/editor` dependency to that version (preserve the range operator
     the project already uses — `^`/`~`/exact; default to exact if none).
  3. Keep it a devDependency. It peers on `@moku-labs/game >=0.10.0` and `typescript >=5.5` since 0.8; apply moku-game-version first. A shell game's script is `moku-editor --root .`, with no HTML file. Keep TypeScript on 6.x in a game: the project index needs the JS API.
  4. `bun install` to resolve.
- **Verify:** `bunx tsc --noEmit` → `bun run lint` → `bun run test` (+ `bun run build`). On failure →
  **moku-error-diagnostician** (bounded 3 rounds); fix against the pack's
  `skills/moku-game/references/plugin-index.md`, never weaken types.
- **Risk:** 0.0.x → 0.1+ removes Notes (`flowView.notes`, `notesDir`, `workspace:new-note`) and moves the game page to a dev-only dynamic import of the agent (see the pack's `hello-world.md`). 0.5 removes the configs `flowView.stylesFile`, `gameView.manifestPaths`, `gameView.sourceSearch` and `renderView.manifestPaths`: code locations come from the project index. 0.8 needs game 0.10 or later. Captures land in day folders `.moku/captures/<yyyy-mm-dd>/` as JPEG. pre-1.0, minors may break. Read the release notes (`frameworks[editor].releaseSource`) and the
  installed `llms.txt` / README before applying; `moku-sync editor` records breaking crossings here.
- **Rollback:** `git checkout -- package.json bun.lock && bun install`.

---

### moku-ai-version
- **Title:** Bump `@moku-labs/ai` to the current registry version
- **Stack:** — (registry-driven, stack-independent)
- **Applies to:** app, game, framework, library (anything that builds assets)
- **Default:** on
- **Depends on:** —
- **Detect:** `package.json` dependencies/devDependencies contain `@moku-labs/ai` AND its
  resolved/declared version `< frameworks[ai].knownVersion` in `moku-frameworks.md` (currently `0.16.1`).
- **Apply:**
  1. Read `frameworks[ai].knownVersion` from `moku-frameworks.md`.
  2. `package.json`: set the `@moku-labs/ai` dependency to that version (preserve the range operator
     the project already uses — `^`/`~`/exact; default to exact if none).
  3. Keep it a devDependency unless the app calls it at run time. Re-run `moku validate` and `moku estimate` on the build files; never a paid `moku run` as verification.
  4. `bun install` to resolve.
- **Verify:** `bunx tsc --noEmit` → `bun run lint` → `bun run test` (+ `bun run build`). On failure →
  **moku-error-diagnostician** (bounded 3 rounds); fix against the pack's
  `skills/moku-ai/references/plugin-index.md`, never weaken types.
- **Risk:** pre-1.0, minors may break. Read the release notes (`frameworks[ai].releaseSource`) and the
  installed `llms.txt` / README before applying; `moku-sync ai` records breaking crossings here.
  0.14.2 → 0.16.1 breaks nothing. Two things move for a project that uses `ark`: without `ark.groupId` a
  process now reuses the oldest asset group of that name instead of creating one (0.15), and the recorded
  cost of a final from a draft with a reference video drops to the "with video input" rate (0.16.0), so
  an estimate can change with no edit to the build file.
- **Rollback:** `git checkout -- package.json bun.lock && bun install`.

---


## Reserved (future stack versions — not applied yet)

Documented so the extension path is concrete; `/moku:upgrade` ignores these until they are promoted
to an active stack version in `target-stack.md`.

### ts7-native  *(retired)*
- Retired. TypeScript 7 arrives through `moku-lint-oxlint` (Stack 4): typescript-eslint needs the
  TypeScript JS API, so a project moves to TS 7 together with the linter. The `ignoreDeprecations`
  cleanup it planned is already done (the canonical tsconfig sets none of the removed options), and
  declarations come from tsdown `0.23.0` through the TS 7 binary. `isolatedDeclarations` stays off.

### devibe-*  *(de-vibecoding class)*
- One migration per repairable anti-pattern from `invariants.md` / `house-style.md`, e.g.:
  `devibe-no-createplugin-generics` (strip explicit generics off `createPlugin<…>`),
  `devibe-thin-index` (move inline logic out of an oversized `index.ts`),
  `devibe-jsdoc` (add missing JSDoc on exports). Each: detect via grep/validator → transform →
  verify with the matching moku validator agent.
