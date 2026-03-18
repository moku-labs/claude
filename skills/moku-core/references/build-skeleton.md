# Skeleton Build — Detailed Steps

This file is read by `/moku:build` when `## Skeleton:` in STATE.md is `not-started` or `in-progress`. It handles creating all skeleton source files from the skeleton spec produced by Stage 3 of `/moku:plan`, verifying them, collecting user feedback, and committing the initial commit.

**Key difference from plugin build waves:** Skeleton waves also stop-and-resume (one wave per invocation), but the content is always copied from `.planning/skeleton-spec.md` code blocks — no sub-agents needed. The only user-facing stop (besides between skeleton waves) is after verification + skeleton report, when the user must approve before the initial commit.

---

## Step S1: Read and Validate Skeleton Spec

1. Read `.planning/skeleton-spec.md`
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

Mark the wave `done` in STATE.md.

**If more skeleton waves remain (check Wave Progress table):**
> "Skeleton Wave [N] complete ([file count] files). Run `/moku:build resume` to continue with Skeleton Wave [N+1]."

**STOP.** Do not continue to the next wave in the same invocation.

**If this was the last skeleton wave:** Continue immediately to Step S3.

---

## Step S3: Verification Loop

After all skeleton waves complete, run the verification checklist from the skeleton spec.

Track every issue found AND the exact fix applied — this feeds the skeleton report in Step S4.

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
     - `return {} as State` — add `// placeholder` comment if the linter flags it
     - Empty type bodies — add a placeholder field: `_placeholder?: never`
     - Import path errors — verify the file exists at the expected path (if not, the spec has a mistake; fix the import path)
   - Record each type error and the fix applied
4. **Build** — `bun run build` (skip if no build script exists)
   - Fix compilation errors

**Loop until clean.** If any check still fails after fixes, re-run the full sequence.
**Maximum 3 rounds.** If still failing after 3 rounds, report to user:
> "Skeleton verification could not reach a clean state after 3 rounds. Remaining issues: [list]. Please fix manually then run `/moku:build resume`."
And stop.

Update STATE.md: mark `Skeleton verify` row as `done` in Wave Progress.

---

## Step S4: Generate Skeleton Report

Generate a report and present it inline to the user (not saved to a file).

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

Present the skeleton report.

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

1. Stage skeleton files and the skeleton spec:
   ```
   git add src/ .planning/skeleton-spec.md
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
   - `## Phase: skeleton/committed`
   - Mark `Skeleton commit` row as `done` in Wave Progress
   - Set `## Next Action: Run /moku:build resume to build Wave 0 (core plugins)`
2. Tell the user:
   > "Skeleton committed ([short sha]). Run `/moku:build resume` to begin Wave analysis and build Wave 0 (core plugins)."

The next `/moku:build resume` invocation will detect `## Skeleton: committed` and route to the normal plugin build flow (wave analysis, then plugin waves).

---

## Skeleton Quality Rules

These invariants apply to ALL skeleton files:

- **`import type`** for all type-only imports
- **Empty function bodies** — use `return {} as ReturnType` for complex return types; `return` for void
- **Placeholder types** — correct field names with `unknown` or minimally assignable types; add `_placeholder?: never` if the body is completely empty and TypeScript requires a non-empty type
- **`createPlugin` calls** — no explicit type parameters; all inference
- **`createCorePlugin` calls** — no `depends`, `events`, or `hooks` fields
- **`onStart`/`onStop`** — include ONLY for plugins approved in Stage 1 for lifecycle management (servers, connections, listeners)
- **JSDoc** — minimal fileoverview on each file: `/** @fileoverview [plugin name] — [Tier] skeleton */`
- **No business logic** — no real algorithms, no data manipulation, no conditional logic beyond structural stubs
