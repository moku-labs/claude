# Skeleton Build — Detailed Steps

This file is read by `/moku:build` when `## Skeleton:` in STATE.md is `not-started` or `in-progress`. It handles creating all skeleton source files from the skeleton spec produced by Stage 3 of `/moku:plan`, verifying them, collecting user feedback, and committing the initial commit.

**Key difference from plugin build waves:** Skeleton waves also stop-and-resume (one wave per invocation), but the content is always copied from `.planning/build/skeleton-spec.md` code blocks — no sub-agents needed. The only user-facing stop (besides between skeleton waves) is after verification + skeleton report, when the user must approve before the initial commit.

**`--continue` does not apply to skeleton waves.** Skeleton waves always stop-and-resume regardless of `--continue` mode. The `--continue` flag applies only to plugin build waves (Wave 0 onward after skeleton is committed). If `--continue` was passed but the skeleton is not yet committed, tell the user: "Note: `--continue` is deferred until the skeleton is committed. Skeleton waves always execute one at a time."

---

## Step S1: Read and Validate Skeleton Spec

1. Read `.planning/build/skeleton-spec.md`
2. Verify all five sections are present:
   - Architecture Overview
   - File Structure
   - System Connections
   - Skeleton Build Waves (at least one wave with code blocks)
   - Verification Checklist
3. If spec is missing or any section is absent: tell the user — `"Skeleton spec is incomplete or missing. Re-run /moku:plan resume to regenerate Stage 3."` — and stop.
4. Update STATE.md: `## Skeleton: in-progress`

---

## Step S2: Execute One Skeleton Wave (Stop-and-Resume)

Read the Wave Progress table from STATE.md. Find the first skeleton wave row with status `not started`.

**Mark the wave `in-progress` in STATE.md before creating files** — this enables crash detection on resume.

For each file listed in the wave's code blocks in the skeleton spec:

1. Copy the code block exactly as written in the spec (do NOT add implementation beyond what the spec provides)
2. If the file already exists:
   - Check if its first line and export structure match the spec's code block
   - If yes: skip (idempotent — do not overwrite)
   - If no: overwrite with the spec's version (the spec is authoritative)
3. Create any needed parent directories

**Important:** Do not interpret or improve the skeleton code blocks. Copy them as-is. The spec was designed to be type-correct as written.

**Barrel file (`src/plugins/index.ts`):** Must group ALL plugin instance exports in one block first, then ALL type namespace re-exports in a second block, separated by section comments. Follow the exact two-section layout from the skeleton spec template — do not interleave instance and type exports.

Mark the wave `done` in STATE.md. Write the updated STATE.md using the State Write Protocol (backup → tmp → validate → rename).

**If more skeleton waves remain (check Wave Progress table):**
> "Skeleton Wave [N] complete ([file count] files). Run `/moku:build resume` to continue with Skeleton Wave [N+1]."

---

**>>> STOP HERE <<<**

**Do NOT continue to the next skeleton wave in the same invocation.** Each skeleton wave is a separate invocation. The STATE.md write above preserves progress so the next `/moku:build resume` picks up at the correct wave. Continuing past this point without stopping defeats the crash-recovery mechanism and causes STATE.md to fall out of sync with disk state.

---

**If this was the last skeleton wave:** Continue immediately to Step S3.

---

## Step S3: Verification Loop

After all skeleton waves complete, run the verification checklist from the skeleton spec.

Track every issue found AND the exact fix applied — this feeds the skeleton report in Step S4.

### Events Type Population (Pre-Verification)

Before running the verification sequence, update `src/config.ts` to declare all plugin events in the `Events` type. Scan all plugin skeleton files for `events: register => (...)` blocks and collect every event name. Replace the empty `Events` type with one that includes all discovered events:

```typescript
export type Events = {
  "schema:field-defined": Record<string, never>;
  "rules:validation-complete": Record<string, never>;
  // ... one entry per plugin event
};
```

Use `Record<string, never>` as the placeholder payload type for each event. This ensures `ctx.emit()` is type-correct in the skeleton and prevents type errors when plugin implementations call emit. If no plugins declare events, leave `Events` as `Record<string, never>`.

### Barrel Structure Verification (Pre-Verification)

Verify that `src/plugins/index.ts` follows the two-section layout: all plugin instance exports (`export { name } from ...`) in the first block, then all type namespace exports (`export * as Name from ...`) in the second block. If they are interleaved, reorder them before running the verification sequence.

Run in sequence:

1. **Format** — `bun run format`
   - Biome auto-formats all files. If it makes changes, that is fine — record which files changed.
2. **Lint** — `bun run lint`
   - If errors: run `bun run lint:fix`, then re-check
   - If lint:fix cannot resolve remaining errors: fix them manually
   - Record each error and whether it was auto-fixed or manually fixed
3. **TypeScript** — `bunx tsc --noEmit`
   - Fix all type errors in skeleton files
   - Common skeleton type errors:
     - Empty function bodies — use `throw new Error("not implemented")` for complex return types (avoids R6 violation of `{} as X`)
     - Empty type bodies — add a placeholder field: `_placeholder?: never`
     - Import path errors — verify the file exists at the expected path (if not, the spec has a mistake; fix the import path)
   - Record each type error and the fix applied
4. **Build** — `bun run build` (skip if no build script exists)
   - Fix compilation errors

**Loop until clean.** If any check still fails after fixes, re-run the full sequence.
**Maximum 3 rounds.** If still failing after 3 rounds, report to user:
> "Skeleton verification could not reach a clean state after 3 rounds. Remaining issues: [list]. Please fix manually then run `/moku:build resume`."
And stop.

**Context exhaustion guard:** If context is running low during the verification loop (approaching compaction), stop immediately. Before stopping:
1. Update STATE.md to preserve the current wave's `done` status — do NOT regress any completed wave back to `not started`
2. Mark `Skeleton verify` row as `in-progress` (not `done` — verification is incomplete)
3. Tell the user: "Context is running low during skeleton verification. Skeleton wave files are in place. Run `/moku:build resume` to continue from the verification step."

This ensures that on resume, skeleton waves are not re-executed and verification picks up where it left off.

Update STATE.md: mark `Skeleton verify` row as `done` in Wave Progress.

---

## Step S4: Generate Skeleton Report

Generate a report, save it to `.planning/build/skeleton-report.md`, and present it inline to the user.

**Save first, then present:** Write the complete report to `.planning/build/skeleton-report.md` before presenting it. This allows the resume path (when skeleton status is `verified`) to re-read the report from disk without regenerating it.

**Report format:**

```
## Skeleton Build Report

### Files Created
[Total count] files across [N] skeleton waves.

**Wave 0:**
- src/config.ts
- src/plugins/index.ts
- src/index.ts
- src/plugins/[core-name]/index.ts
...

**Wave 1:**
- src/plugins/[name]/index.ts
- src/plugins/[name]/types.ts
...

### Verification Results
| Check | Status | Issues Fixed |
|-------|--------|-------------|
| Format | ✓ PASS | [N] files auto-formatted |
| Lint | ✓ PASS | [N] auto-fixed, [M] manual |
| TypeScript | ✓ PASS | [N] type adjustments |
| Build | ✓ PASS | 0 |

### Issues Encountered & How They Were Resolved
[For each issue found during verification: describe the problem, what file, and exactly what change was made to fix it.]

Example entries:
- **TypeScript: `src/plugins/router/types.ts` line 5** — Empty type body caused implicit `any`. Added `_placeholder?: never` field as structural placeholder. This is a skeleton stub that will be replaced during build.
- **Lint: `src/index.ts`** — Unused import warning for `createPlugin`. Deferred the export until the build phase adds actual usage.

If no issues: "No issues — verification passed on first attempt."

### Skeleton State
- All files contain: correct imports/exports, empty type definitions, empty function bodies, JSDoc headers
- No implementation code in any file
- No explicit generics on `createPlugin` or `createCorePlugin`
- Core plugins: `createCorePlugin` with no `depends`, `events`, or `hooks`

### Next Steps After Approval
1. Initial commit will be created with pre-commit hooks running (NEVER bypassed)
2. Run `/moku:build resume` to begin Wave analysis and plugin builds
```

---

## Step S5: Present Report and Wait for User Approval

Present the skeleton report. If resuming from `skeleton: verified` state:
- Read `.planning/build/skeleton-report.md` from disk to re-present it (do not regenerate — the verification data is already captured).
- **If `.planning/build/skeleton-report.md` does not exist** (e.g., interrupted between verification and report write): re-run Step S3 (verification loop) to regenerate the verification data, then run Step S4 to write and present the report, then continue here.

Use `AskUserQuestion`:
- Question: "Skeleton verified. Review the report above and decide how to proceed."
- Header: "Skeleton"
- Options:
  1. label: "Approve and commit (Recommended)", description: "Skeleton looks good — create the initial commit"
  2. label: "Adjust skeleton", description: "Make changes to the skeleton structure before committing"
  3. label: "Show details", description: "Display full verification details before deciding"
- multiSelect: false

**If the user selects Adjust skeleton:**
1. Ask what to change (via conversation or follow-up AskUserQuestion)
2. Apply the changes directly to the skeleton files
3. Re-run Step S3 (verification loop) — track new issues/fixes
4. Update the skeleton report with any new findings
5. Re-present the gate with AskUserQuestion

---

## Step S6: Initial Commit

After user approval:

1. Stage skeleton files (`.planning/` is gitignored — do NOT stage planning files):
   ```
   git add src/
   ```
2. Create the commit:
   ```
   git commit -m "chore: initial skeleton — [N] plugins, framework config, barrel exports"
   ```
3. **If pre-commit hooks fail:**
   - Read the hook error output carefully
   - Fix the issues (format, lint, type errors from the hook)
   - Re-stage changed files: `git add -u`
   - Retry the commit
   - Repeat until hooks pass
   - **NEVER use `--no-verify`** — hooks must run and pass
4. Record the commit SHA in STATE.md: `## Git Checkpoint: <sha>`

---

## Step S7: Mark Skeleton Complete and Hand Off

1. Update STATE.md:
   - `## Skeleton: committed`
   - `## Phase: complete` (preserve the plan's Phase value — the `## Skeleton: committed` field signals skeleton completion; do NOT write `Phase: skeleton/committed` as next.md has no routing row for that value)
   - Mark `Skeleton commit` row as `done` in Wave Progress
   - Populate `## Verification Results` with the summary table from skeleton-report.md (Format/Lint/TypeScript/Build pass status + issue counts) — do not leave the placeholder text
   - Set `## Next Action: Run /moku:build resume to build Wave 0 (core plugins)`
2. Tell the user:
   > "Skeleton committed ([short sha]). Run `/moku:build resume` to begin Wave analysis and build Wave 0 (core plugins)."

The next `/moku:build resume` invocation will detect `## Skeleton: committed` and route to the normal plugin build flow (wave analysis, then plugin waves).

---

## Skeleton Quality Rules

These invariants apply to ALL skeleton files:

- **`import type`** for all type-only imports
- **Empty function bodies** — use `throw new Error("not implemented")` for complex return types (avoids R6 `{} as X` violation); `return` for void
- **Placeholder types** — correct field names with `unknown` or minimally assignable types; add `_placeholder?: never` if the body is completely empty and TypeScript requires a non-empty type
- **`createPlugin` calls** — no explicit type parameters; all inference
- **`createCorePlugin` calls** — no `depends`, `events`, or `hooks` fields
- **`onStart`/`onStop`** — include ONLY for plugins approved in Stage 1 for lifecycle management (servers, connections, listeners)
- **JSDoc** — minimal `@file` tag on each file: `/** @file [plugin name] — [Tier] skeleton */`. Use `@file`, NOT `@fileoverview` (ESLint jsdoc/check-tag-names rejects `@fileoverview`). Do NOT use `@module` in plugin files (flagged as redundant). Common abbreviations (`ctx`, `fn`, `cb`) are whitelisted in the ESLint unicorn config
- **JSDoc on spec object methods** — ESLint `jsdoc/require-jsdoc` fires on all `ArrowFunctionExpression` nodes in `src/**/*.ts`, including those nested inside `createPlugin`/`createCorePlugin` spec objects (`createState`, `api`). Each inline method requires multi-line JSDoc with `@param` and `@example`. For structural callbacks like `events: register => (...)`, use `/* eslint-disable-next-line jsdoc/require-jsdoc */`.
- **@param names must match underscore prefix** — Unused stub parameters use `_` prefix (e.g., `_ctx`). All `@param` tags must match the actual parameter name including the underscore: `@param _ctx`, not `@param ctx`. For destructured object parameters, list each property as a separate entry: `@param _ctx.global`, `@param _ctx.config`.
- **No @returns on throw-only stubs** — Functions whose body contains only `throw new Error("not implemented")` must NOT include `@returns` JSDoc tags. ESLint's `jsdoc/require-returns-check` rejects `@returns` on non-returning functions.
- **Subscribe-style stubs** — API methods that return an unsubscribe arrow function (e.g., `subscribe` returning `() => void`) require `// eslint-disable-next-line unicorn/consistent-function-scoping` before the inner return. The empty `() => {}` triggers `unicorn/consistent-function-scoping` because it doesn't close over any stub variables.
- **No unnecessary type casts** — when a config field's type is inferred from its default value (e.g., `config: { locale: "en" }` infers `string`), do NOT add redundant `as string` casts in API methods. Only cast when the inferred type is genuinely insufficient (e.g., widening a literal type to a union)
- **No business logic** — no real algorithms, no data manipulation, no conditional logic beyond structural stubs
