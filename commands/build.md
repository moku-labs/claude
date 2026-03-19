---
description: Build a framework, consumer app, or plugin from a specification
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion, TaskCreate, TaskUpdate, TaskList, TaskGet
argument-hint: [framework|app|plugin] [spec-path-or-name] [--dry-run] [--continue]
disable-model-invocation: true
---

## Project Configuration
!`test -f .claude/moku.local.md && head -20 .claude/moku.local.md || true`

Use configuration values above if present. Validate before using — ignore invalid values and use defaults:

| Setting | Type | Range | Default |
|---------|------|-------|---------|
| `maxParallelAgents` | integer | 1–5 | 3 |
| `gapClosureMaxRounds` | integer | 0–5 | 2 |
| `skipValidation` | boolean | true/false | false |
| `skipTriage` | boolean | true/false | false |

Build a Moku project from a specification plan. The input (`$ARGUMENTS`) can be:

- `framework` — build framework from `.planning/specs/` directory
- `framework .planning/specs/` — explicit spec path
- `framework config` — build only config.ts + index.ts (skip plugins)
- `framework plugins` — build only plugins (skip config if exists)
- `app` — build consumer app from `.planning/app-spec.md`
- `app .planning/app-spec.md` — explicit plan path
- `plugin auth` — build plugin "auth" from description or matching spec
- `plugin #3` — build plugin #3 from `.planning/specs/03-*.md`
- `plugin #3-#5` — build plugins #3 through #5
- `plugin #3,#5,#7` — build specific plugins by number
- `plugin .planning/specs/03-auth.md` — build from explicit spec file
- `resume` — continue from `.planning/STATE.md`

---

## Step 0: Detect Target

Parse `$ARGUMENTS`:
1. If `--dry-run` is present anywhere in the arguments, enter **dry-run mode**: analyze specs, report what files would be created, wave grouping, and dependency order — but do NOT create or modify any files.
   - **Dry-run + skeleton routing:** If `## Skeleton:` is `not-started` or `in-progress`, report what each remaining skeleton wave would create (file list from `.planning/skeleton-spec.md`) instead of creating them. Read the `## Skeleton Build Waves` section of skeleton-spec.md. For each wave, list all file paths that appear as markdown sub-headers (`### path/to/file.ts`) or as the first comment line in code blocks (`// path/to/file.ts`). Present as: "Skeleton Wave N would create: [file list]". Then report the framework/app/plugin wave plan as normal. Skeleton routing is suspended — no files are created.
   - Before presenting the plan, validate that all referenced spec files exist and are non-empty. If any spec file is missing or empty, report: "Dry-run warning: spec [path] is missing or empty — this wave would fail during a real build." List all such issues before the plan.
   - Present the plan in this format:
     - **Skeleton waves** (if skeleton not committed): Skeleton Wave N: creates [file list from skeleton-spec.md]
     - **Plugin waves:** `| Wave | Plugins | Tiers | Dependencies |` table with one row per wave.
     - Report total: [N] skeleton waves, [M] plugin waves, [P] plugins total.
   - Exit.
1b. If `--continue` is present anywhere in the arguments, enter **continuous mode**: auto-advance through all remaining waves without stopping between them. Git checkpoint commits still happen per wave for rollback safety. The ONLY stopping trigger is approaching context exhaustion (if you sense compaction is imminent, stop after the current wave and tell the user to run `/moku:build resume --continue` to pick up). Default behavior (without `--continue`) is unchanged — one wave per invocation.
2. If the first word is `resume` — read `.planning/STATE.md` and continue from the last recorded position. Skip to the appropriate build step.
2b. If the first word is `fix` — route directly to **Error Recovery** below. Do NOT enter Skeleton Detection. (The Error Recovery section itself enforces the skeleton-committed prerequisite.)
3. If the first word is exactly `framework`, `app`, or `plugin` — use it as the target. The rest is the spec path or plugin name.
4. If no explicit target keyword, auto-detect:
   a. Both `.planning/specs/*.md` AND `.planning/app-spec.md` exist → use `AskUserQuestion`:
      - Question: "Both framework specs and app spec found. What would you like to build?"
      - Header: "Build target"
      - Options: "Framework (from .planning/specs/)" / "Consumer App (from .planning/app-spec.md)"
      - multiSelect: false
   b. `.planning/specs/*.md` files exist (only) → **framework**
   c. `.planning/app-spec.md` exists (only) → **app**
   d. Argument matches a plugin name, `#N` pattern, or spec file path → **plugin**
5. If no specs found and no recognizable argument → tell the user: "No specifications found. Run `/moku:plan` first to create a plan."

For **plugin** targets, resolve the argument:
- `#N` → find `.planning/specs/` matching: if N < 10, search `0N-*.md`; if N ≥ 10, search `N-*.md`. Examples: `#3` → `03-*.md`, `#10` → `10-*.md`, `#1` → `01-*.md`
- `#N-#M` → for each number N to M, apply the same resolution (zero-pad if < 10, no pad if ≥ 10). Example: `#8-#11` → specs `08`, `09`, `10`, `11`
  - **If any spec in the range is missing:** list the missing numbers and ask the user:
    > "Spec(s) [list] not found in .planning/specs/. Build only existing specs in range, or cancel?"
    Use `AskUserQuestion` — Options: "Build existing only (skip missing)" / "Cancel"
- `#N,#M,#P` → find specific specs (e.g., `#3,#5,#7`)
  - **For comma-separated lists:** resolve each spec individually. If any spec in the list is not found, report the missing specs and use `AskUserQuestion`:
    > "Spec(s) [list] not found in .planning/specs/. Build only the found specs, or cancel?"
    Options: "Build found only" / "Cancel"
- A name like `auth` → search `.planning/specs/*-auth.md` or build from description
- A file path → validate the resolved path stays within `.planning/specs/` (reject any path containing `..` or resolving outside the project root). If the path fails validation, stop: "Spec path must be within .planning/specs/. Path traversal is not allowed." If valid, use directly.

**If plugin spec resolution returns no matches** (glob finds nothing):
1. Search case-insensitively: `find .planning/specs/ -iname "*-{name}.md"`
   - If exactly one match: auto-select and proceed.
   - If multiple matches: present via `AskUserQuestion` with the matched filenames as options.
   - If zero matches: proceed to step 2 below.
2. If still no match: list available specs with `ls .planning/specs/` and tell the user:
   > "No spec found for '{target}'. Available specs: [list]. Use `plugin #N` or `plugin <name>` matching one of these."
3. Stop. Do not attempt to build from an empty target.

### State Check

Before starting:
- If `.planning/STATE.md` does **not** exist:
  - If `.planning/skeleton-spec.md` **exists**: create a fresh STATE.md before proceeding — Skeleton Detection requires STATE.md to read the `## Skeleton:` field:
    ```
    ## Phase: building
    ## Verb: create
    ## Target: framework
    ## Skeleton: not-started
    ## Next Action: Run /moku:build resume
    ```
    Log: "No STATE.md found but skeleton-spec.md exists. Created fresh STATE.md with Skeleton: not-started." Then continue to Skeleton Detection.
  - If `.planning/skeleton-spec.md` does **not** exist: log `No state file found. Proceeding with fresh build.` and continue to Step 0 target detection. (No skeleton routing needed — there is nothing to build.)
- If `.planning/STATE.md` exists, read it to understand what has already been built:
  - Validate it contains required headers: `## Phase:`, `## Target:`, `## Next Action:`
  - If headers are missing or malformed, warn the user and use `AskUserQuestion`:
    - Question: "STATE.md is missing required headers and may be corrupt. Regenerate it from your spec files?"
    - Header: "Corrupt state"
    - Options: "Regenerate (Recommended)" / "Cancel — I'll fix it manually"
    - multiSelect: false
  - **If Regenerate selected:**
    - If both `.planning/specs/` AND `.planning/app-spec.md` exist → use `AskUserQuestion` (same as rule 4a above) to let the user choose the target. Options: "Framework (from .planning/specs/)" / "Consumer App (from .planning/app-spec.md)".
    - If only `.planning/specs/` exists → infer `Target: framework`.
    - If only `.planning/app-spec.md` exists → infer `Target: app`.
    - If neither `.planning/specs/` nor `.planning/app-spec.md` exists → tell the user: "Cannot regenerate STATE.md — no specification files found. Run `/moku:plan` first to create a plan." Stop.
    - Write a fresh STATE.md with the inferred or user-selected target:
      ```
      ## Phase: building
      ## Verb: create
      ## Target: [inferred or selected]
      ## Skeleton: not-started
      ## Next Action: Run /moku:build resume
      ```
    - Warn: "STATE.md regenerated with inferred values. Verify the target before continuing."
  - **Retry-Pending Check:** Before wave analysis, scan the plugins table for any plugins with status `retry-pending`. If found, route directly to `build-verification.md` Step 4c2 (Fresh-Context Retry on resume). Skip wave analysis and normal build flow — the retry context is already saved in `## Fresh Retry Context` in STATE.md.
  - **Completed build check:** If all plugins in the plugins table have status `complete` (or `verified`) AND the build phase is `complete`, tell the user:
    > "This build is already complete. To re-run validation or generate the README, use `/moku:build resume` which will route to the post-build steps. To rebuild from scratch, delete `.planning/STATE.md` and re-run."
    Stop.
  - Skip plugins/waves that are already marked as complete
  - Report: "Detected existing state. Resuming from [position]. Already built: [list]."

**Note:** The Idempotency Protocol (checking for `building` status and partial completion) runs at wave execution start (before spawning builder agents in `build-wave-execution.md`), not during this initial State Check.

### Idempotency Protocol

Run this at wave execution start (Step 3), before spawning builder agents:

1. Read `.planning/STATE.md` — if any plugin has status `building`, the previous invocation crashed mid-wave
2. For each `building` plugin, check if its directory (`src/plugins/{name}/`) contains non-skeleton files (files with real implementations, not just type stubs)
3. If non-skeleton files exist: treat as partially built — use `AskUserQuestion`:
   - Question: "Plugin {name} was partially built in a previous run. How to proceed?"
   - Header: "Recovery"
   - Options:
     1. label: "Resume (Recommended)", description: "Continue from current state — keep existing files"
     2. label: "Reset to checkpoint", description: "Rollback to pre-wave commit and rebuild from scratch"
   - multiSelect: false
3b. If no non-skeleton files exist (directory contains only type stubs from a crashed build): treat as not started — reset to the pre-wave checkpoint and rebuild from scratch. Tell the user: "Plugin {name} directory has only skeleton stubs from a crashed build. Resetting to checkpoint."
4. If reset: first validate the checkpoint SHA —
   - **Check that `## Git Checkpoint:` exists in STATE.md and has a non-empty value.** If the field is absent or empty, tell the user:
     > "Git checkpoint is missing — safe rollback is not possible. Options: (1) Run `/moku:build resume` to rebuild the plugin from current state, or (2) Check `git log` and manually restore to a known good commit."
     Stop.
   - If the field is present and non-empty, run `git cat-file -e <sha>^{commit}`. If the commit does not exist (branch was reset or SHA is stale), tell the user:
     > "Git checkpoint SHA <sha> is no longer valid (branch may have been reset). Manual recovery steps: (1) Run `git log --oneline` to find a known good commit, (2) Run `git checkout <that-sha>`, (3) Open `.planning/STATE.md` and delete the `## Git Checkpoint:` line, (4) Run `/moku:build resume` to continue from the restored state."
     Stop.
   - If the SHA is valid, run `git checkout <sha>`.
5. If resume: re-spawn the builder agent with note about existing files
6. Update status at wave START (set `building`) not just at completion — this ensures crash detection works

### State Write Protocol

When updating `.planning/STATE.md`:
1. Back up current state: copy to `.planning/STATE.md.bak` before overwriting
2. If in a git repo, record the current commit SHA in the state file as `## Git Checkpoint: <sha>`
3. This enables rollback if a wave introduces regressions

---

## Skeleton Detection & Routing

After reading STATE.md, check skeleton status **before** routing to any build target. This step runs on every invocation regardless of arguments.

### Skeleton Status Check

Read `## Skeleton:` from STATE.md:

| Status | Action |
|--------|--------|
| field absent | Old STATE.md format — assume skeleton committed, proceed to normal build routing |
| `not-started` | Read `.planning/skeleton-spec.md` → route to `build-skeleton.md` Step S1 |
| `in-progress` | Read skeleton-spec.md, find last completed skeleton wave → resume from next wave |
| `verified` | Re-present skeleton report — read `.planning/skeleton-report.md` (if file is missing, route to `build-skeleton.md` Step S3 to regenerate it first). Use `AskUserQuestion`: "Skeleton verified. Approve and commit?" — Options: "Approve and commit (Recommended)" / "Review changes first" / "Adjust skeleton" |
| `committed` | Skeleton complete — proceed to Framework/App/Plugin build routing below |

**Skeleton always takes priority.** Any argument (`resume`, `framework #wave:2`, `--continue`) is held until skeleton is `committed`. The skeleton MUST be committed before any plugin build wave begins.

**This applies to ALL build targets** — `framework`, `app`, and `plugin` builds all require skeleton committed. If skeleton is not `committed` when targeting `app` or `plugin`, route to skeleton build first before the app/plugin build.

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/build-skeleton.md` for detailed skeleton build steps.

---

## Output Style

If the project has output styles configured, suggest switching to `moku-building` at the start of this command for terse, progress-focused formatting.

---

## Task DAG for Wave Progress Tracking

Use `TaskCreate` and `TaskUpdate` to provide visual progress tracking during builds. Tasks supplement STATE.md (which remains the cross-session source of truth). Tasks are session-scoped and provide in-session progress UI.

**At wave start:**
1. Create a parent task for the wave: `TaskCreate("Wave N", "Build plugins: [list]")`
2. Create a child task for each plugin: `TaskCreate("[name] ([tier])", "Build [name] plugin from spec")`
3. Set dependencies: `TaskUpdate(child, addBlockedBy: [dependencies from other plugins in this wave if any])`

**During wave:**
- When a builder agent starts: `TaskUpdate(pluginTask, status: "in_progress")`
- When a builder agent completes: `TaskUpdate(pluginTask, status: "completed")` or keep as in_progress if failed

**After wave:**
- Update parent wave task based on results
- If all plugins verified: `TaskUpdate(waveTask, status: "completed")`

**Example:**
```
TaskCreate("Wave 1", "Build env, logger, config-validator")
TaskCreate("env [Nano]", "Build env core plugin")
TaskCreate("logger [Nano]", "Build logger core plugin")
TaskCreate("config-validator [Micro]", "Build config-validator plugin")
```

This gives the user a live progress view via the task UI while builds run.

---

## Framework Build

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/build-framework.md` for detailed framework build steps.

**Summary**: Build all plugins in dependency-aware waves using parallel sub-agents, with post-wave verification and gap closure.

**Flow**: Each invocation executes exactly ONE step (wave, verification, README, or validation), saves STATE.md, and stops. User runs `/moku:build resume` for the next step. This ensures fresh context and explicit user control.

**Step sequence per invocation:**
1. Read specs → Wave analysis → **STOP** (present wave plan). **On resume:** if STATE.md already contains a stored wave plan (detect by looking for `| Wave |` in the plugins table header row AND all plugin rows have a numeric value in the Wave column), skip wave analysis and proceed directly to executing the next incomplete wave.
2. Build Wave 0 (core plugins) → verify → integrate → tick spec checkboxes → **STOP**
3. Build Wave 1 → verify → integrate → **regression test** → tick spec checkboxes → **STOP**
4. Build Wave N → ... → **regression test** → ... → **STOP** (one wave per invocation until all waves done)
5. Final framework verification → **STOP**
6. README wave (parallel sub-agents for all plugin READMEs) → **STOP**
7. Post-build validation pipeline → report → **DONE**

### Wave Execution Protocol

**One wave per invocation (default).** Each `/moku:build` or `/moku:build resume` call:
1. Reads `.planning/STATE.md` to find the current position
2. Executes the NEXT incomplete step (wave, verification, README wave, or validation)
3. Updates `.planning/STATE.md` with results
4. Stops and tells the user what to run next:
   > "Wave [N] complete ([plugin list]). Run `/moku:build resume` to continue with Wave [N+1]."

**Do NOT attempt multiple waves in one invocation** unless `--continue` mode is active. Each wave gets fresh sub-agents and an explicit user checkpoint. This prevents context exhaustion and gives the user control over pacing.

**Continuous mode (`--continue`):** When active, skip the stop-and-wait between waves. After completing a wave, immediately proceed to the next. Still commit git checkpoints per wave. If you sense context is getting large (many waves completed, approaching compaction), stop after the current wave: `"Pausing continuous build after Wave [N] to preserve context. Run /moku:build resume --continue to continue."`

**`#wave:N` syntax:** `/moku:build #wave:2` jumps directly to wave 2 (useful for re-running a specific wave after manual fixes).

### Post-Wave Code Review

After each wave's verification passes (Step 4a in build-verification.md), spawn the **moku-code-reviewer** agent to review the wave's code changes. The code reviewer catches logic errors, spec deviations, and security issues that automated tools miss. See build-verification.md Step 4a2 for integration details.

### Stalemate Detection

During gap closure, track fix effectiveness between rounds. If the same errors persist or error count increases after applying fixes, skip remaining gap closure rounds and escalate to Fresh-Context Retry immediately. See build-verification.md Step 4c for details.

### Quality Requirements

- **TDD build order**: Tests are written BEFORE implementation (Red → Green → Refactor). See moku-testing skill's `tdd-protocol.md`.
- Full JSDoc on ALL source files (functions, types, interfaces)
- `import type` for type-only imports
- Plugin index.ts must be ~30 lines of wiring
- Every plugin must have unit + integration tests
- All tests must pass
- Biome and ESLint must pass with zero warnings
- Follow the exact complexity tier specified in the plan
- Never use explicit generics on `createPlugin` — see moku-plugin skill
- Plugin export names must NOT have "Plugin" postfix — use bare name
- NO unnecessary `onStart`/`onStop` — only when managing actual resources (servers, connections, listeners)
- `src/plugins/index.ts` must exist as plugin barrel with grouped sections (Instances → Helpers → Types)
- `src/index.ts` must be self-documenting: JSDoc module comment with options/defaults table, grouped exports (Framework API → Plugins → Helpers → Types)
- No wire factory patterns — import `createPlugin` and dependencies directly
- No inline type assertions (`null as X`, `{} as X`) in createState/config

---

## App Build

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/build-app.md` for detailed app build steps.

**Summary**: Verify framework availability, build custom consumer-side plugins (if any), create entry point with createApp, validate with the full pipeline.

**Flow**: Read app spec -> Verify framework exports/plugins -> Build custom plugins (following Plugin Build) -> Create entry point (src/main.ts) -> Validate (spec, plugin-spec, jsdoc, test, type validators) -> Report + STATE.md update.

**Key rule**: NEVER import from `@moku-labs/core` — only from the framework package. If web app, also enforce moku-web skill patterns.

---

## Plugin Build

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/build-plugin.md` for detailed plugin build steps.

**Summary**: Determine complexity tier, create tier-appropriate directory structure, implement domain files, write tests, validate.

**Flow**: Understand plugin (from spec, description, or hierarchy) -> Determine tier (Nano/Micro/Standard/Complex/VeryComplex) + domain merge check -> Create directory structure -> Implement domain files (types.ts, state.ts, api.ts, handlers.ts) -> Write index.ts (~30 lines wiring, NO explicit generics) -> Write tests (unit + integration) -> Write README.md -> Validate (verifier, plugin-spec, jsdoc, test, type validators) -> Gap closure if needed (max 2 rounds).

**Key rules**: Domain merge check before creating new plugins. No explicit generics on createPlugin. No unnecessary onStart/onStop. Full JSDoc everywhere.

---

## Error Recovery (`fix`)

If `$ARGUMENTS` starts with `fix`, enter error recovery mode. This targets failed or partially built plugins.

**Prerequisite:** Fix mode requires skeleton to be `committed` in STATE.md. If `## Skeleton:` is `not-started` or `in-progress`, tell the user: "Fix mode requires the skeleton to be committed first. Complete the skeleton build with `/moku:build resume`, then re-run fix." If `## Skeleton:` is `verified`, tell the user: "Skeleton is built but not yet committed. Run `/moku:build resume` to approve and commit it, then re-run fix."

**Syntax:**
- `fix auth` — fix a specific plugin by name
- `fix #3` — fix a specific plugin by number
- `fix --all` — fix all plugins with `needs-manual` or `verify-failed` status

When multiple plugins need fixing, use `AskUserQuestion`:
- Question: "[N] plugins need fixing. Fix all or select specific ones?"
- Header: "Fix scope"
- Options: "Fix all (Recommended)" / "Let me choose which ones" / "Show errors first"
- multiSelect: false

**Process:**
1. Read `.planning/STATE.md` to identify plugins needing fixes and their status
2. For each target plugin, read:
   - Existing partial files in `src/plugins/{name}/`
   - Plugin specification from `.planning/specs/`
   - Previous failure report (from STATE.md or agent-log.md)
3. Spawn the **moku-error-diagnostician** agent with the failure context
4. Apply the diagnostician's proposed fixes
5. Re-run verification (format → lint → tsc → test)
6. If verification passes, update plugin status to `verified` in STATE.md
7. If still failing after 2 rounds, report remaining issues to user

**Key difference from normal build:** The builder agent receives enhanced context about what already exists and what specifically failed, avoiding redundant work.
