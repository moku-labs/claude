# Skeleton Build — Detailed Steps

Read when `## Skeleton:` in STATE.md is `not-started` or `in-progress`. It creates the skeleton source
files from the spec `/moku:plan` Stage 3 produced, verifies them, collects feedback and makes the
initial commit.

Skeleton waves stop and resume one wave per invocation like plugin waves, but the content is copied
from `.planning/build/skeleton-spec.md` code blocks, so no sub-agents are involved. The one user gate
besides the wave boundaries is the approval before the initial commit. `--continue` does not apply to
skeleton waves and does not bypass that gate; if it was passed, say it takes effect once the skeleton
is committed.

Write STATE.md through the protocol in the `build` skill (backup → tmp → validate → rename).

---

## Step S1: Read and validate the skeleton spec

Before writing any skeleton code, read
`${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/skeleton-conventions.md` and emit hook-compliant
code from line 1: a ≤30-line wiring `index.ts`, typed-const config, `type` not `interface` for
`Config`/`Api`, the `createCoreConfig` third CorePlugins argument, the JSDoc tag-line rules, no inline
`as`, no `wireX`, structural injectable types. The spec's code blocks are content-correct but were not
written against the hooks, so reconcile them as you write. This is the biggest first-try-correctness
lever there is.

### Delta mode (`Verb: update`)

Read `## Verb:` from STATE.md first. `update` runs the whole session in delta mode:

- A delta skeleton creates only the new files the update introduces. Existing plugin and framework files
  are evolved by the plugin waves, not here.
- New files come from a `## Delta File Structure` section when the spec has one; otherwise treat
  `## File Structure` as the create-list and skip every path that already exists (`test -e`). Never
  clobber an existing file in skeleton mode.
- New files are compiling stubs: correct imports, exports and signatures from the spec's
  Signatures/Wiring, bodies of `throw new Error("not implemented")`.

`create` and `migrate` run full mode — everything below as written.

1. Read the skeleton spec: `.planning/build/skeleton-spec.md`, falling back to
   `.planning/skeleton-spec.md` for plans written by older versions. Neither exists: stop with
   "Skeleton spec not found. Re-run /moku:plan resume to regenerate Stage 3."
2. Check the sections the active mode needs. Full mode needs all five: Architecture Overview, File
   Structure, System Connections, Skeleton Build Waves (at least one wave with code blocks),
   Verification Checklist. Delta mode accepts either a full spec that also carries a
   `## Delta File Structure`, or a spec whose `## File Structure` is itself the delta; it needs File
   Structure, Signatures/Wiring and Verification, but no verbatim wave code blocks.
3. Missing sections: tell the user to re-run `/moku:plan resume` to regenerate Stage 3, and stop.
4. Set `## Skeleton: in-progress`.

---

## Step S2: Execute one skeleton wave

Read the Wave Progress table in STATE.md and find the first skeleton wave that is `not started`.
Mark it `in-progress` before creating files, so a crash is detectable on resume.

**Delta mode** usually has no wave code blocks: create each new file from the delta list as a compiling
stub, skip every path that already exists, then go straight to S3 and the commit. The numbered steps
below are full mode.

For each file in the wave's code blocks:

1. Copy the code block exactly as written. Do not interpret or improve it — the spec was designed to be
   type-correct as it stands, and adding implementation here is not the job.
2. If the file exists, compare its first line and export structure with the spec's block: matching means
   skip (this step is idempotent), differing means overwrite, since the spec is authoritative.
3. Create parent directories as needed.

**Barrel file (`src/plugins/index.ts`):** all plugin instance exports in one block, then all type
namespace re-exports in a second, separated by section comments, exactly as the skeleton spec's template
lays out. Do not interleave them.

Mark the wave `done` in STATE.md and write it through the state protocol.

More waves remain:
> "Skeleton Wave [N] complete ([file count] files). Run `/moku:build resume` to continue with Skeleton
> Wave [N+1]."

Then `moku-rails pause --reason "skeleton wave [N] complete"` and end the invocation. Each skeleton
wave is its own invocation: the STATE.md write is what lets the next resume pick up the right wave, and
continuing past this point puts STATE.md out of sync with disk.

If that was the last wave, continue to Step S3 in the same invocation.

---

## Step S3: Verification loop

Run the verification checklist from the skeleton spec, tracking every issue found and the exact fix
applied — that feeds the report in Step S4.

### Populate the Events type first

Update `src/config.ts` to declare every plugin event before the checks run. Scan the plugin skeleton
files for `events: register => (...)` blocks, collect the names, and replace the empty `Events` type:

```typescript
export type Events = {
  "schema:field-defined": Record<string, never>;
  "rules:validation-complete": Record<string, never>;
};
```

`Record<string, never>` is the placeholder payload, which keeps `ctx.emit()` type-correct. When no
plugin declares events, write `Record<never, never>`, not `Record<string, never>`: the latter's `keyof`
is `string`, which silently widens hook-name checking so a typo'd hook name still compiles.
`Record<never, never>` is also the kernel's own default, so omitting the generic is equivalent.

### Check the barrel structure first

Confirm `src/plugins/index.ts` keeps its two blocks — instance exports, then type namespace exports. If
they are interleaved, reorder before running the sequence.

### The sequence

1. **Format** — `bun run format`. Changes are expected; record which files moved.
2. **Lint** — `bun run lint`; on errors `bun run lint:fix`, then re-check and fix the rest by hand.
   Record each error and how it was fixed.
3. **Types** — `bunx tsc --noEmit`. Common skeleton errors: an empty function body (use
   `throw new Error("not implemented")` for complex return types, which avoids the R6 `{} as X`
   violation), an empty type body (add `_placeholder?: never`), a wrong import path (the spec has a
   mistake; fix the path). Record each error and its fix.
4. **Build** — `bun run build`, if the script exists.

Re-run the whole sequence after fixes, at most 3 rounds. Still failing after that:

> "Skeleton verification could not reach a clean state after 3 rounds. Remaining issues: [list]. Fix
> them manually, then run `/moku:build resume`."

Then stop. Mark the `Skeleton verify` row `done` in Wave Progress when it is clean.

---

## Step S4: Generate the skeleton report

Write the report to `.planning/build/skeleton-report.md` first, then present it inline. Writing it first
means the resume path (skeleton status `verified`) can re-read it instead of regenerating it.

**Carry "revisit" items into STATE.md, not just the report.** Anything the skeleton flagged to revisit
during the build — a deferred `.d.ts` or type concern, a stubbed area to confirm, an event type to
populate — goes into a `## Skeleton Revisit TODOs` section in STATE.md (see `plan-templates.md`). A real
build lost a `.d.ts` fix because the note lived only in the report and was never read again. The waves
clear every revisit TODO before the framework is marked complete.

```
## Skeleton Build Report

### Files Created
[Total] files across [N] skeleton waves.

**Wave 0:**
- src/config.ts
- src/plugins/index.ts
- src/index.ts
- src/plugins/[core-name]/index.ts

**Wave 1:**
- src/plugins/[name]/index.ts
- src/plugins/[name]/types.ts

### Verification Results
| Check | Status | Issues Fixed |
|-------|--------|-------------|
| Format | PASS | [N] files auto-formatted |
| Lint | PASS | [N] auto-fixed, [M] manual |
| TypeScript | PASS | [N] type adjustments |
| Build | PASS | 0 |

### Issues and How They Were Resolved
[Per issue: the problem, the file, and exactly what changed. For example —
- TypeScript, src/plugins/router/types.ts:5 — empty type body caused an implicit any. Added
  `_placeholder?: never`; the stub is replaced during the build.
- Lint, src/index.ts — unused import `createPlugin`. Deferred the export to the build phase.]
If nothing came up: "No issues — verification passed on the first attempt."

### Skeleton State
- Correct imports and exports, empty type definitions, empty function bodies, JSDoc headers
- No implementation code
- No explicit generics on createPlugin or createCorePlugin
- Core plugins use createCorePlugin with no depends, events or hooks

### Next Steps After Approval
1. The initial commit runs with pre-commit hooks
2. `/moku:build resume` begins wave analysis and the plugin builds
```

---

## Step S5: Present the report and wait

Resuming from `skeleton: verified`, read `.planning/build/skeleton-report.md` from disk and re-present
it rather than regenerating — the verification data is already captured. If the file is missing (the
run was interrupted between verification and the write), re-run S3 and S4 first.

`moku-rails pause --reason "skeleton needs approval"`, then `AskUserQuestion`:

- Question: "Skeleton verified. Review the report above and decide how to proceed."
- Header: "Skeleton"
- Options: "Approve and commit (Recommended)" / "Adjust skeleton" / "Show details"

On "Adjust skeleton": ask what to change, apply it to the skeleton files, re-run S3 tracking the new
issues, update the report, and present the gate again.

---

## Step S6: Initial commit

**Protected-branch guard.** Before committing:

```bash
branch="$(git rev-parse --abbrev-ref HEAD)"
default="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@')"; default="${default:-main}"
```

If `branch` equals `default`, `main` or `master`, do not commit yet — the skeleton and every wave
checkpoint would stack onto a protected branch. `AskUserQuestion`: create `build/{target-slug}` and
continue (recommended), commit on the current branch anyway, or cancel. On the first,
`git switch -c build/{target-slug}` and record the working branch in STATE.md so resumed invocations
stay on it. Already off the default branch: proceed.

1. Stage the source (`.planning/` is gitignored and is never staged): `git add src/`
2. `git commit -m "chore: initial skeleton — [N] plugins, framework config, barrel exports"`
3. Pre-commit hooks failing: read the output, fix the issues, `git add -u`, retry, until they pass.
   The hooks are the gate — `--no-verify` defeats the reason they exist.
4. Record the commit SHA in STATE.md as `## Git Checkpoint: <sha>`.

---

## Step S7: Mark the skeleton complete

1. STATE.md: `## Skeleton: committed`; keep the plan's `## Phase:` value (the `Skeleton:` field is what
   signals completion); mark the `Skeleton commit` row `done`; fill `## Verification Results` with the
   summary table from the report instead of the placeholder; set
   `## Next Action: Run /moku:build resume to build Wave 0 (core plugins)`.
2. Tell the user:
   > "Skeleton committed ([short sha]). Run `/moku:build resume` to begin wave analysis and build Wave 0."

The next resume sees `## Skeleton: committed` and routes to wave analysis.

---

## Skeleton quality rules

These hold for every skeleton file:

- `import type` for all type-only imports.
- Empty function bodies: `throw new Error("not implemented")` for complex return types (avoids the R6
  `{} as X` violation); plain `return` for void.
- Placeholder types: correct field names with `unknown` or minimally assignable types; add
  `_placeholder?: never` when the body is empty and TypeScript needs a non-empty type.
- `createPlugin` with no explicit type parameters; `createCorePlugin` with no `depends`, `events` or `hooks`.
- `onStart`/`onStop` only for plugins approved in Stage 1 for lifecycle management.
- JSDoc: a minimal `@file` tag per file — `/** @file [plugin name] — [Tier] skeleton */`. Use `@file`,
  not `@fileoverview` (ESLint `jsdoc/check-tag-names` rejects it). No `@module` in plugin files. The
  common abbreviations (`ctx`, `fn`, `cb`) are whitelisted in the unicorn config.
- JSDoc on spec-object methods: `jsdoc/require-jsdoc` fires on every `ArrowFunctionExpression` in
  `src/**/*.ts`, including those nested in `createPlugin` spec objects (`createState`, `api`), so each
  inline method needs multi-line JSDoc with `@param` and `@example`. For structural callbacks like
  `events: register => (...)`, use `/* eslint-disable-next-line jsdoc/require-jsdoc */`.
- `@param` names match the parameter exactly, underscore included (`@param _ctx`). Destructured object
  parameters list each property (`@param _ctx.global`, `@param _ctx.config`).
- No `@returns` on throw-only stubs — `jsdoc/require-returns-check` rejects it.
- Subscribe-style stubs returning an unsubscribe arrow need
  `// eslint-disable-next-line unicorn/consistent-function-scoping` before the inner return: the empty
  `() => {}` closes over nothing.
- No redundant casts where a config field's type is already inferred from its default
  (`config: { locale: "en" }` infers `string`). Cast only when the inferred type is genuinely
  insufficient, such as widening a literal to a union.
- No business logic: no algorithms, no data manipulation, no conditionals beyond structural stubs.
