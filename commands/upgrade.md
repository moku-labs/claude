---
description: Upgrade an existing Moku project to the current target stack (TypeScript, tooling, tsconfig) — the official migration path
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion, TodoWrite
argument-hint: [--dry-run]
disable-model-invocation: true
---

## Moku Core Specification (authoritative)

Before any decision about architecture, the core API, factory chain, config, lifecycle, events, the `ctx` object, types, invariants, or plugin structure — **consult `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/spec-index.md` and open the cited `spec/NN-*.md` file.** The spec is the single source of truth; never rely on memory or guess. Justify any deviation against a cited section, and cite spec section IDs (`spec/NN-*.md §N`) in output. Never stage or commit `.planning/` — it is local-only state.

## What this command does

`/moku:upgrade` brings an **existing Moku project** (framework, consumer app, plugin, or web project) up to the **target stack hardcoded into this version of the moku plugin**. It is the official, version-agnostic migration path: today it delivers the TypeScript 6 baseline; the same command will deliver TypeScript 7, build-tool swaps, and de-vibecoding migrations in future plugin versions, because the work is defined by a registry, not by this command's prose.

**The target is hardcoded — there are no version arguments.** You run `/moku:upgrade` and it migrates the project to whatever the installed moku plugin's target stack is.

- **Target stack:** `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/target-stack.md` (current: **Stack version 2**).
- **Migration registry:** `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/upgrade-migrations.md`.
- **Canonical configs:** `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/tooling-config.md`.

**Not to be confused with `/moku:plan migrate`** — that maps *foreign / non-Moku* code *into* Moku architecture. `/moku:upgrade` operates on a project that is *already* Moku and only moves its *toolchain/stack* forward.

### Arguments

There is one optional flag; the normal invocation is bare `/moku:upgrade`.

- (no args) — detect → present the upgrade plan → single approval gate → apply → verify.
- `--dry-run` — detect and print the plan, then **stop** (write nothing). Use to preview the diff.

If `$ARGUMENTS` contains anything other than `--dry-run`, output:
`Usage: /moku:upgrade [--dry-run] — no version arguments; the target is the stack shipped with this moku version.` and stop.

---

## Step 0 — Preflight & detection

1. **Project detection** (same logic as `/moku:check`):
   - `src/config.ts` with `createCoreConfig` → **Framework** (Layer 2).
   - `createApp` import from a framework package → **Consumer App** (Layer 3).
   - `jsx`/`preact` + `vite` config → **Web** project.
   - `package.json` only → **Generic** Node/Moku project.
   - If there is no `package.json` and no `src/config.ts` and no `createApp` import, stop:
     `This does not appear to be a Moku project (no package.json found). Run /moku:upgrade from the project root.`

2. **Git safety.** Run `git status --porcelain`. If the working tree is **dirty**, do NOT proceed silently:
   - Print the dirty files and explain that `/moku:upgrade` modifies `package.json`, `tsconfig*.json`, and config files, and that a clean tree keeps the whole upgrade as one reviewable, revertible diff.
   - Ask the user (AskUserQuestion) whether to **(a)** stop so they can commit/stash first (recommended), or **(b)** proceed anyway.
   - If not a git repo at all, warn that there is no automatic rollback and ask to proceed.

3. **Resume check.** If `.planning/UPGRADE.md` exists and its `## Status:` is `in-progress`, read it and **resume** from the first migration not marked `done` (skip Steps 1–2's re-planning unless the target stack version recorded there differs from the current one — if it differs, re-plan from scratch).

4. **Read current state.** Parse `package.json` (`dependencies`, `devDependencies`, `engines`, `scripts`), `tsconfig.json`, `tsconfig.build.json` (if present), `.bun-version` (if present), `biome.json`. Read the target from `target-stack.md`, the migrations from `upgrade-migrations.md`, and the **Moku-family framework registry** from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/moku-frameworks.md`. For each registry entry whose `detect.packageJsonDep` appears in this project's dependencies, note the declared version vs the entry's `knownVersion` — a project below it is a candidate for that entry's `upgrade.migrationId` (e.g. `moku-web-version`, `moku-core-version`).

## Step 1 — Compute the upgrade plan

1. Determine the project's current **stack version** from the detection signatures in `target-stack.md`. If the project is at or above the target stack **and** no registry-driven framework-version migration fires (Step 0.4 — no depended-on moku-family package is below its `knownVersion`), output:
   `Already on Stack version <N> (<headline>). Nothing to upgrade.` — then stop. If the stack is current but a `@moku-labs/*` dependency is behind the registry, do NOT stop — proceed with just the framework-version migration(s).
2. From `upgrade-migrations.md`, select every migration whose `Applies to` includes this project type AND whose `Detect` condition fires. Order them as listed (respect `Depends on`). This includes the **registry-driven framework-version migrations** (`moku-web-version`, `moku-core-version`): each fires when the project depends on that moku-family package at a version below the registry's `knownVersion`, and bumps it to that version (core before web per `dependsOn`).
3. Separate them into **default-on** (applied unless the user deselects) and **opt-in** (`Default: off`, e.g. `tsgo-fastcheck` — only applied if the user explicitly says yes).

## Step 2 — Present the plan & gate

Print a concise upgrade plan, for example:

```
Moku Upgrade Plan
=================
Project: my-framework (Framework, Layer 2)
Current stack: 1 (TypeScript 5.9.3)  →  Target: 2 (TypeScript 6 baseline)

Will apply (default):
  ts6-core           typescript 5.9.3 → 6.0.3 · typescript-eslint 8.56.0 → 8.58.0
                     · tsdown 0.20.3 → 0.22.1 · tsconfig +types:["bun"] · build +rootDir
  tooling-freshness  bun 1.3.8 → 1.3.14 · biome 2.4.2 → 2.4.16 · @types/bun → 1.3.14
                     · publint → 0.3.21 · attw → 0.18.3

Optional (off by default):
  tsgo-fastcheck     add @typescript/native-preview + `typecheck:fast` (TS7 native, side-by-side
                     with tsc; tsc stays the authoritative gate)

Verification after each step: bunx tsc --noEmit · bun run lint · bun run test
(+ build · publint · attw for publishable libraries)
```

- For each **opt-in** migration, ask the user (AskUserQuestion) whether to include it, summarizing its risk (e.g. tsgo is Beta — fast checker only, not the emit/publish compiler).
- Then ask for a single **approval gate** to proceed with the apply.
- If `--dry-run` was passed, stop here after printing the plan (do not ask, do not apply).

## Step 3 — Apply migrations

Write `.planning/UPGRADE.md` (schema below) recording the plan and marking it `in-progress`. Then, for each selected migration **in order**:

1. **Apply** its steps exactly as written in `upgrade-migrations.md` (edit `package.json`, `tsconfig*.json`, configs). Edits must be **idempotent** — if a value is already at target, leave it. When adding `compilerOptions.types`, **merge** with any existing array; never clobber.
2. Run `bun install` once after dependency edits for the migration (or batch installs across migrations applied in this pass, then install once).
3. **Verify** with the migration's `Verify` chain: `bunx tsc --noEmit` → `bun run lint` → `bun run test`; for publishable libraries also `bun run build` → `bunx publint` → `bunx attw --pack .`.
4. **On failure:** spawn the **error-diagnostician** agent (`${CLAUDE_PLUGIN_ROOT}/agents/error-diagnostician.md`) with the failing output. Apply targeted fixes (bounded to **3 rounds** per migration). The most common TS6 finding is the `strict`-by-default flip surfacing a genuine error in a deep inference chain — fix it locally; **never** weaken `strict`, and **never** commit with `--no-verify`. If still failing after 3 rounds, stop, record the migration as `blocked` in `.planning/UPGRADE.md` with the error summary, and report to the user — do not continue to later migrations.
5. **On success:** mark the migration `done` in `.planning/UPGRADE.md`.

For a large project, it is fine to apply one migration per invocation and stop-and-resume (like build waves) — record progress and tell the user to re-run `/moku:upgrade` to continue. For the small TS6 set, run them through in one pass.

## Step 4 — Final verification & report

1. Run the full chain once more cleanly: `bunx tsc --noEmit`, `bun run lint`, `bun run test`, and (libraries) `bun run build` + `bunx publint` + `bunx attw --pack .`.
2. Mark `.planning/UPGRADE.md` `## Status:` `complete` and record the new stack version.
3. Print an **Upgrade Report**:

```
Moku Upgrade Report
===================
my-framework: Stack 1 → 2 (TypeScript 6 baseline)
Applied: ts6-core, tooling-freshness   (tsgo-fastcheck: skipped)
Verification: tsc ✓  lint ✓  test ✓  build ✓  publint ✓  attw ✓
Files changed: package.json, tsconfig.json, tsconfig.build.json, biome.json, .bun-version, bun.lock

Next: review the diff (`git diff`) and commit, e.g.
  git add -A && git commit -m "chore: upgrade to Moku stack v2 (TypeScript 6)"
```

4. **Do not commit.** Leave the commit to the user (or `/ship`). Surface a suggested message only.

---

## `.planning/UPGRADE.md` schema

Local-only state (never committed — `.planning/` is gitignored). Mirrors the `STATE.md` style.

```markdown
# Moku Upgrade State

## Project: <name> (<Framework|App|Plugin|Web>)
## Stack From: <N>
## Stack To: <M>
## Status: in-progress | complete | blocked
## Started: <ISO date>

## Migrations:
- [done]    ts6-core
- [in-progress] tooling-freshness
- [pending] tsgo-fastcheck (opt-in: yes|no)

## Next Action: <what re-running /moku:upgrade will do>

## Notes:
- <blocker summaries, diagnostician findings, anything needed to resume>
```

## Resume behavior

Re-running `/moku:upgrade` with an `in-progress` `.planning/UPGRADE.md`:
- Skips migrations marked `done`.
- Continues from the first `in-progress`/`pending` migration.
- Re-runs the failing migration's verify before proceeding if the last status was `blocked`.
- If the installed plugin's target stack version is **newer** than the `## Stack To:` recorded in the file (i.e. the plugin was updated mid-upgrade), discards the old plan and re-plans from Step 1.

## Safety rules (hard)

- **Never** weaken `strict` or any compiler strictness to make `tsc` pass — fix the real error.
- **Never** commit, and **never** use `--no-verify`. The command edits and verifies; the user commits.
- **Never** apply an `off`-by-default migration without an explicit user yes at the gate.
- **Idempotent always** — a second run on an already-upgraded project must report "Nothing to upgrade."
- **Never** touch `.planning/` in git; it is local-only state.
