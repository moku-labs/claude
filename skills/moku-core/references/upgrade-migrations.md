# Upgrade Migration Registry

The ordered set of migrations `/moku:upgrade` can apply to bring an existing Moku project up to the
current **target stack** (`target-stack.md`). Each migration is a self-contained
**detect → apply → verify** unit. `/moku:upgrade` runs every migration whose `detect` fires (and
whose `default` is `on`, unless the user opts into an `off` one), in the order listed here.

This is the **extension point** for all future stack jumps — TypeScript 7, build-tool swaps,
de-vibecoding, etc. To add one: append an entry below, bump the stack version in `target-stack.md`,
and (if it changes the scaffold) update `tooling-config.md`.

## Migration entry schema

```
### <id>
- Title:        <human label>
- Stack:        <stack version this belongs to>
- Applies to:   framework | app | plugin | web | all
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
- **Detect:** `package.json.devDependencies.typescript` matches `^5`/`5.*`, OR
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
  (emitted `.d.ts` intact). On `tsc` failure, route the output to the **error-diagnostician** agent;
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

### tsgo-fastcheck  *(opt-in)*
- **Title:** TypeScript 7 native preview (`tsgo`) as an opt-in fast type-checker, side-by-side with `tsc`
- **Stack:** 2
- **Applies to:** framework, app, plugin
- **Default:** **off** — the user is explicitly asked at the gate; never applied silently.
- **Depends on:** ts6-core
- **Detect:** user opted in AND `package.json.devDependencies["@typescript/native-preview"]` is absent.
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
- **Verify:** `bunx tsc --noEmit` → `bun run lint` → `bun run test`. For a web project also
  `bun run build` (SSG output intact). On failure, route to the **error-diagnostician** agent
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
  `bun run build` + `bunx publint` + `bunx attw --pack .`. On failure → error-diagnostician.
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
  resolved/declared version `< frameworks[worker].knownVersion` in `moku-frameworks.md`. (While
  `knownVersion` is the `0.0.0` registration sentinel this never fires — run `moku-sync worker` first to
  stamp the real version.)
- **Apply:**
  1. Read `frameworks[worker].knownVersion` from `moku-frameworks.md`.
  2. `package.json`: set the `@moku-labs/worker` dependency to that version (preserve the range operator
     the project already uses — `^`/`~`/exact; default to exact if none).
  3. Do NOT add a direct `@moku-labs/core` dependency — `@moku-labs/worker` pins core (and
     `@moku-labs/common`) itself.
  4. `bun install` to resolve.
- **Verify:** `bunx tsc --noEmit` → `bun run lint` → `bun run test` (+ `bun run build` for a publishable
  package). On failure → **error-diagnostician** (bounded 3 rounds); breaking API changes are real source
  edits — fix against the regenerated `skills/moku-worker/references/plugin-index.md`, never weaken types.
- **Risk:** A minor/major `@moku-labs/worker` bump can change the Cloudflare plugin APIs/bindings.
  Mitigation: the plugin index is regenerated by `moku-sync` before this migration ships; review the
  release notes (`frameworks[worker].releaseSource`).
- **Rollback:** `git checkout -- package.json bun.lock && bun install`.

### moku-room-version
- **Title:** Bump `@moku-labs/room` to the current registry version
- **Stack:** — (registry-driven, stack-independent)
- **Applies to:** app
- **Default:** on
- **Depends on:** moku-web-version (room is built on `@moku-labs/web` — bump web first), plus
  moku-core-version when the project also depends directly on `@moku-labs/core`.
- **Detect:** `package.json` dependencies contain `@moku-labs/room` AND its resolved/declared version
  `< frameworks[room].knownVersion` in `moku-frameworks.md`. (Sentinel `0.0.0` ⇒ never fires until
  `moku-sync room` stamps the real version.)
- **Apply:**
  1. Read `frameworks[room].knownVersion` from `moku-frameworks.md`.
  2. `package.json`: set `@moku-labs/room` to that version (preserve the range operator; default exact).
  3. Ensure the peer `@moku-labs/web` satisfies room's required range (run `moku-web-version` first if web
     is behind); do not add a direct `@moku-labs/core` dependency.
  4. `bun install` to resolve.
- **Verify:** `bunx tsc --noEmit` → `bun run lint` → `bun run test` (+ `bun run build`). On failure →
  error-diagnostician; fix against the regenerated `skills/moku-room/references/plugin-index.md`.
- **Risk:** room layers on web + WebRTC (`trystero`); a bump can change multiplayer/state-sync APIs.
  Mitigation: regenerated plugin index + release notes (`frameworks[room].releaseSource`).
- **Rollback:** `git checkout -- package.json bun.lock && bun install`.

---

## Reserved (future stack versions — not applied yet)

Documented so the extension path is concrete; `/moku:upgrade` ignores these until they are promoted
to an active stack version in `target-stack.md`.

### ts7-native  *(Stack 4 — when TS7 GAs)*
- Swap `typescript` → `^7`; make the TS6 deprecation cleanup mandatory (`ignoreDeprecations` is gone
  in TS7); switch `typecheck:fast`/`tsgo` to the primary path; re-validate `.d.ts` emit against the
  native emitter; revisit the `isolatedDeclarations` stance. The `tsgo-fastcheck` opt-in is the
  on-ramp that de-risks this jump.

### devibe-*  *(de-vibecoding class)*
- One migration per repairable anti-pattern from `invariants.md` / `house-style.md`, e.g.:
  `devibe-no-createplugin-generics` (strip explicit generics off `createPlugin<…>`),
  `devibe-thin-index` (move inline logic out of an oversized `index.ts`),
  `devibe-jsdoc` (add missing JSDoc on exports). Each: detect via grep/validator → transform →
  verify with the matching moku validator agent.
