---
description: Migrate, upgrade, or restructure a Moku project
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
argument-hint: [upgrade|restructure|from-existing|resume] [path-or-version]
disable-model-invocation: true
---

## Project Configuration
!`if [ -f .claude/moku.local.md ]; then head -20 .claude/moku.local.md; fi`

Migrate, upgrade, or restructure a Moku project. The input (`$ARGUMENTS`) determines the migration type:

- `upgrade` — Upgrade @moku-labs/core to latest and fix breaking changes
- `upgrade 2.0.0` — Upgrade to a specific version
- `restructure` — Re-assess plugin complexity tiers and reorganize
- `from-existing [path]` — Migrate an existing non-Moku project to Moku Core
- `resume` — Resume a migration from `.planning/STATE.md`

---

## Step 0: Detect Migration Type

Parse `$ARGUMENTS`:
1. If the first word is `resume` — read `.planning/STATE.md` and continue from the last recorded position. Skip to the appropriate migration step.
2. If the first word is `upgrade` — core version upgrade flow
3. If the first word is `restructure` — plugin tier reassessment flow
4. If the first word is `from-existing` — existing project migration flow
5. If no argument — auto-detect:
   a. Check if `@moku-labs/core` has a newer version available → suggest `upgrade`
   b. Check if any plugins have outgrown their tier → suggest `restructure`
   c. Otherwise ask the user what they want to do

### Prerequisite Check

Verify this is a Moku project:
- `src/config.ts` exists with `createCoreConfig` (Framework), OR
- `package.json` imports from a Moku framework (Consumer App)
- If neither, tell user: "No Moku project detected. Run `/moku:init` first."

Verify working tree is clean:
- Run `git status --porcelain` — if output is non-empty, warn user: "You have uncommitted changes. Commit or stash before migrating."

---

## Upgrade Flow

### Step 1: Assess Current State

1. Read `package.json` for current `@moku-labs/core` version
2. Run `bun info @moku-labs/core` or check npm registry for latest version
3. If already on latest, tell user: "Already on latest version (X.Y.Z)."
4. Present: "Current: X.Y.Z → Target: A.B.C. Proceed?"

### Step 2: Read Changelog

Fetch the changelog or release notes for versions between current and target:
1. Check if `node_modules/@moku-labs/core/CHANGELOG.md` exists
2. If not, check the GitHub releases
3. Extract breaking changes, new features, and deprecations
4. Present a migration checklist to the user

### Step 3: Create Git Checkpoint

```bash
git add -A && git commit -m "chore: pre-migration checkpoint ($(date +%Y-%m-%d))"
```

### Step 4: Update Dependencies

1. Update `@moku-labs/core` version in `package.json`
2. Run `bun install`
3. Run `bunx tsc --noEmit` to find type errors from the upgrade

### Step 5: Apply Breaking Changes

For each breaking change from the changelog:
1. Search the codebase for affected patterns using Grep
2. Present each change with before/after examples
3. Apply the fix
4. Re-run `bunx tsc --noEmit` after each fix to verify

Common migration patterns to check:
- **API signature changes**: Search for old function signatures, update to new ones
- **Config shape changes**: Check `src/config.ts` and all plugin config fields
- **Event system changes**: Check event registration patterns in all plugins
- **Lifecycle changes**: Check onInit/onStart/onStop signatures
- **Type utility changes**: Check imports of PluginCtx, EmitFn, ExtractApi, etc.
- **Removed features**: Search for deprecated APIs that were removed

### Step 6: Verify

Run the full verification chain:
1. `bun run format`
2. `bun run lint`
3. `bunx tsc --noEmit`
4. `bun run test`

If any step fails, fix and retry (max 2 gap-closure rounds).

Then spawn **moku-verifier** on all plugins to confirm everything is wired correctly.

### Step 7: Report

```
Migration Report: @moku-labs/core X.Y.Z → A.B.C

Breaking Changes Applied:
  - [change description] → [N files modified]
  - [change description] → [N files modified]

New Features Available:
  - [feature]: [brief description of how to use it]

Verification: format OK  lint OK  tsc OK  tests OK (N passed)

Files modified: N
Plugins affected: [list]

Commit with: git add -A && git commit -m "chore: upgrade @moku-labs/core to A.B.C"
```

---

## Restructure Flow

### Step 1: Audit Plugin Tiers

For each plugin in `src/plugins/`:
1. Count source lines (excluding tests)
2. Count spec fields (config, state, api, events, hooks, depends)
3. Count functions > 20 lines
4. Assess current tier from JSDoc header
5. Calculate recommended tier based on actual complexity

Present a comparison table:
```
Plugin Tier Audit
| Plugin | Current Tier | Lines | Spec Fields | Long Fns | Recommended | Action |
|--------|-------------|-------|-------------|----------|-------------|--------|
| env    | Nano        | 18    | 1           | 0        | Nano        | None   |
| router | Micro       | 142   | 5           | 3        | Standard    | Promote |
| spa    | Standard    | 480   | 6           | 8        | Complex     | Promote |
```

### Step 2: Domain Merge Detection

Scan for plugins that should be merged into VeryComplex:
1. Group plugins by name prefix
2. Check for shared event namespaces
3. Check for coordinated state
4. Check for consumer co-dependency (plugins always used together)

Present merge candidates:
```
Domain Merge Candidates:
  "spa" domain: spaRouter + spaProgress + spaHead → merge into spa (VeryComplex)
    Shared events: spa:navigate, spa:loaded
    Coordinated state: route + loading indicator
```

### Step 3: Get User Approval

Present the full restructuring plan:
- Which plugins to promote (and what files to extract)
- Which plugins to merge (and the target VeryComplex structure)
- Which plugins are fine as-is
- Estimated effort for each change

Wait for explicit approval.

### Step 4: Execute Restructuring

For each promotion:
1. Create the new directory structure (types.ts, state.ts, api.ts, handlers.ts)
2. Extract domain logic from index.ts into the appropriate files
3. Rewrite index.ts as a ~30 line wiring harness
4. Update imports
5. Move/split tests into unit/ and integration/

For each merge:
1. Create the VeryComplex directory structure with sub-module directories
2. Move each plugin's domain code into its sub-module
3. Compose state, API, and events into a single createPlugin call
4. Update config to use nested namespaces
5. Update all import references across the codebase
6. Remove the old individual plugin directories
7. Update src/index.ts plugin array

### Step 5: Verify

Run full verification:
1. `bun run format` + `bun run lint` + `bunx tsc --noEmit` + `bun run test`
2. Spawn **moku-verifier** on all restructured plugins
3. Spawn **moku-plugin-spec-validator** to confirm tier compliance
4. Gap closure if needed (max 2 rounds)

### Step 6: Report

```
Restructuring Report

Promotions:
  router: Micro → Standard (extracted types.ts, state.ts, api.ts)
  spa: Standard → Complex (added providers/ subdirectory)

Merges:
  spaRouter + spaProgress + spaHead → spa (VeryComplex)
    Sub-modules: router/, progress/, head/
    Events consolidated: 5 events under spa: namespace

No Change: env, logger, auth

Verification: format OK  lint OK  tsc OK  tests OK
```

---

## From-Existing Flow

### Step 1: Analyze Existing Project

Read the existing project at `$ARGUMENTS[1]` (or current directory):
1. Identify the tech stack (package.json dependencies, tsconfig, build tool)
2. Identify existing "domains" — groups of related files/modules
3. Map existing patterns to Moku concepts:
   - Singleton modules → plugins
   - Shared configuration → framework config
   - Event emitters → Moku events
   - Middleware chains → plugin hooks
   - Dependency injection → plugin depends + require

### Step 2: Generate Migration Plan

Present a mapping from existing code to Moku structure:

```
Migration Plan: [project-name] → Moku Framework

Existing Structure → Moku Structure:
  src/auth/           → src/plugins/auth/ (Standard)
  src/database/       → src/plugins/db/ (Standard)
  src/utils/logger.ts → src/plugins/logger/ (Nano)
  src/config.ts       → src/config.ts (createCoreConfig)
  src/app.ts          → src/index.ts (createCore)

Event Mapping:
  EventEmitter('user:login')  → auth events: register<{userId: string}>
  EventEmitter('db:connected') → db events: register<{pool: Pool}>

Config Mapping:
  process.env.DB_URL  → db plugin config: { url: string }
  AUTH_SECRET         → auth plugin config: { secret: string }

Dependencies:
  auth depends on db (uses db.query in login)
  logger has no dependencies (standalone)
```

Wait for user approval.

### Step 3: Scaffold Framework

1. Run the equivalent of `/moku:init` if not already a Moku project
2. Create `src/config.ts` with `createCoreConfig`
3. Create plugin directories matching the migration plan

### Step 4: Migrate Code

For each mapped plugin:
1. Create the plugin structure (appropriate tier)
2. Move/adapt existing code into domain files (state.ts, api.ts, etc.)
3. Write the index.ts wiring harness
4. Convert existing event patterns to Moku events
5. Convert existing config to plugin config with defaults
6. Write tests (adapt existing tests if they exist)
7. Full JSDoc on all exports

### Step 5: Wire and Verify

1. Create `src/index.ts` with `createCore` and all plugins
2. Run full verification chain
3. Spawn validation pipeline (verifier, spec-validator, plugin-spec-validator)
4. Gap closure if needed

### Step 6: Report

Show migration summary with before/after, list of manual steps remaining, and consumer migration guide (how to update existing app code to use the new framework).

---

## Rules

- Always create a git checkpoint before making changes
- Present the migration plan and get user approval before executing
- Follow all Moku specification rules (see moku-core and moku-plugin skills)
- Never use explicit generics on `createPlugin`
- Full JSDoc on all new/modified code
- Preserve existing test coverage — don't delete tests without replacement
- If the migration is too large for one session, save progress to `.planning/STATE.md` and suggest `/moku:migrate resume`
