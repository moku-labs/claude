---
description: Build a framework, consumer app, or plugin from a specification. No args = auto-resume. Accepts free-form natural language.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion, TaskCreate, TaskUpdate, TaskList, TaskGet, EnterPlanMode, ExitPlanMode
argument-hint: (empty to auto-resume) or [framework|app|plugin|add|resume|fix] [spec-path-or-name] [--dry-run] [--continue] [--lean]
disable-model-invocation: true
---

## Project Configuration
!`test -f .claude/moku.local.md && head -20 .claude/moku.local.md || true`

Use configuration values above if present. Validate before using — ignore invalid values and use defaults:

| Setting | Type | Range | Default | Used By |
|---------|------|-------|---------|---------|
| `maxParallelAgents` | integer | 1–8 | 5 | build, plan (validation), audit |
| `gapClosureMaxRounds` | integer | 0–5 | 2 | build (gap closure in verification) |
| `skipValidation` | boolean | true/false | false | build (skip validation pipeline) |
| `skipTriage` | boolean | true/false | false | build (skip interactive findings triage) |
| `enablePipelining` | boolean | true/false | true | build (wave pipelining) |
| `leanMode` | boolean / "auto" | true/false/"auto" | "auto" | build (context savings) |
| `auditMaxScenarios` | integer | 5–50 | 20 | audit (scenario cap) |
| `auditIterateLimit` | integer | 1–5 | 3 | audit (max re-audit passes) |

This is the **complete configuration schema** for all Moku commands. All settings are read from `.claude/moku.local.md` YAML frontmatter. Commands only read settings from this table — unknown keys are ignored.

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

## Intent Normalization (Pre-Parse)

Before strict argument parsing, normalize free-form input. Build is the simplest command — most invocations are just `resume`.

**Skip when:** `$ARGUMENTS` starts with a recognized keyword (`resume`, `fix`, `add`, `framework`, `app`, `plugin`) or a flag (`--dry-run`, `--continue`, `--lean`, `#wave:`). Proceed directly to Step 0.

**When to normalize:** If `$ARGUMENTS` is empty or contains only free-form text:

1. **Empty arguments (most common case):** If `$ARGUMENTS` is empty:
   - If `.planning/STATE.md` exists → treat as `resume`. Log: "No arguments — auto-resuming from STATE.md."
   - If no STATE.md but `.planning/specs/` exists → treat as `framework`. Log: "No arguments — specs found, building framework."
   - If nothing exists → Tell user: "No specifications found. Run `/moku:plan` first to create a plan." Stop.

2. **Wrong-command detection:**
   - Keywords suggesting plan intent (`plan`, `create`, `design`, `spec`, `specification`, `add plugin`, `new plugin`) → Tell user: "It sounds like you want to plan. Run: `/moku:plan {rest of text}`" and stop.
   - Keywords suggesting brainstorm intent (`brainstorm`, `explore`, `think about`, `discuss`) → Tell user: "It sounds like you want to brainstorm. Run: `/moku:brainstorm {rest of text}`" and stop.

3. **Free-form intent extraction:**
   - "continue", "keep going", "next wave", "pick up where we left off" → `resume`
   - "add {name}" → `add {name}`
   - "fix", "repair", "broken", "failing" → `fix`
   - "what would it build", "show plan", "dry run" → `--dry-run`
   - Everything else with STATE.md present → `resume` (safest default)

4. **Log and proceed:** "Normalized → {structured args}"

**Examples:**
| User types | Normalized to |
|---|---|
| *(empty)* | `resume` (if STATE.md exists) |
| `keep building` | `resume` |
| `continue with --continue` | `resume --continue` |
| `add auth` | `add auth` |
| `what would the next wave do` | `resume --dry-run` (if STATE.md with Phase: building exists) or `framework --dry-run` (no active build) |
| `fix the broken tests` | `fix` |

---

## Step 0: Detect Target

**Rules 1–1e are evaluated in order. If a rule stops execution (e.g., mutual exclusivity check), subsequent rules are not evaluated.**

Parse `$ARGUMENTS`:
1. If `--dry-run` is present anywhere in the arguments, enter **dry-run mode**: analyze specs, report what files would be created, wave grouping, and dependency order — but do NOT create or modify any files.
   - **`--dry-run` + `add` guard:** If `--dry-run` is combined with the `add` verb (i.e., arguments match `add <name> --dry-run` or `--dry-run add <name>`), do NOT enter framework dry-run mode. Instead, report: "`--dry-run` is not supported for `add` — to preview what a single plugin would create, review its spec file directly at `.planning/specs/*-{name}.md`." Stop.
   - **Dry-run + skeleton routing:** If `## Skeleton:` is `not-started` or `in-progress`, report what each remaining skeleton wave would create (file list from `.planning/build/skeleton-spec.md`) instead of creating them. Read the `## Skeleton Build Waves` section of skeleton-spec.md. The skeleton-spec.md format uses two conventions for file paths:
     - **H3 sub-headers:** `### path/to/file.ts` — each H3 header names a file to create
     - **Code block first-line comments:** `// path/to/file.ts` — the first line of a fenced code block names the target file
     For each wave, extract all file paths using both conventions. Present as: "Skeleton Wave N would create: [file list]". Then report the framework/app/plugin wave plan as normal. Skeleton routing is suspended — no files are created.
   - Before presenting the plan, validate that all referenced spec files exist and are non-empty. If any spec file is missing or empty, report: "Dry-run warning: spec [path] is missing or empty — this wave would fail during a real build." List all such issues before the plan.
   - Present the plan in this format:
     - **Skeleton waves** (if skeleton not committed): Skeleton Wave N: creates [file list from skeleton-spec.md]
     - **Plugin waves:** `| Wave | Plugins | Tiers | Dependencies |` table with one row per wave.
     - Report total: [N] skeleton waves, [M] plugin waves, [P] plugins total.
   - Exit.
1b. **Mutual exclusivity check:** If both `--dry-run` and `--continue` are present, report: "`--dry-run` (report mode) and `--continue` (auto-advance mode) are mutually exclusive. Use one or the other." Stop.
1c. If `--lean` is present anywhere in the arguments, activate **lean execution mode** (`leanMode: true`). See `build-lean-mode.md`. Strips verbose context from agent prompts (~40-60% context savings). **If `--dry-run` is also active:** lean mode applies to the dry-run output format only (terse/compact output) — do NOT write `## LeanMode: true` to STATE.md. Lean mode can be persisted on the next non-dry-run invocation by passing `--lean` again. For non-dry-run invocations, persisted as `## LeanMode: true` in STATE.md.
1d. If `--continue` is present anywhere in the arguments, enter **continuous mode**: auto-advance through all remaining waves without stopping between them. Git checkpoint commits still happen per wave for rollback safety. The ONLY stopping trigger is approaching context exhaustion (if you sense compaction is imminent, stop after the current wave and tell the user to run `/moku:build resume --continue` to pick up). Default behavior (without `--continue`) is unchanged — one wave per invocation.
1e. **`#wave:N` syntax:** If any argument matches the pattern `#wave:N`:
   - Extract N. Validate it is a non-negative integer. If not (e.g., `#wave:abc`, `#wave:-1`, `#wave:`), report: "Invalid wave number — `#wave:N` requires a non-negative integer (e.g., `#wave:2`)." Stop.
   - **`#wave:N` + `fix` incompatibility:** If `fix` also appears in `$ARGUMENTS`, report: "`#wave:N` is not supported with `fix` mode — `fix` targets plugins by name or status, not by wave. Remove `#wave:N` or use `fix --all`." Stop.
   - **`#wave:N` + `--continue` behavior:** When `#wave:N` is combined with `--continue`: execute wave N, then continue to N+1 only if N+1 is incomplete. If N is the last wave, stop normally.
   - Store the wave number as `waveOverride = N`. **Immediate bounds validation:** If `.planning/STATE.md` exists and contains a wave plan (detected by a `| Wave |` header row with plugin entries having numeric wave values), validate N against the maximum wave number now. If N exceeds the maximum wave number, report: "`#wave:N` is out of range — this project has [M] waves (0–[M-1]). Use a number within that range." Stop. If no wave plan exists yet (first build or wave analysis not yet run), defer bounds validation to Step 3 where wave analysis completes.
   - This flag is held and applied after skeleton is committed (see Skeleton Detection).
2. If the first word is `resume` — read `.planning/STATE.md` and continue from the last recorded position.
   - Check `## Verb:` in STATE.md. If `## Verb: fix`, route directly to **Error Recovery** below — a previous fix session was interrupted. Tell the user: "Resuming interrupted fix session. Targeting remaining plugins with `needs-manual` or `verify-failed` status."
   - Check `## Verb:` in STATE.md. If `## Verb: update`, activate **delta build mode** for this session — after all plugin waves complete, run Step 8 (Delta Updates) from `build-final.md` to update documentation, LLM docs, integration tests, coverage, and CI/CD. **Delta build mode is re-activated on every resume where `## Verb: update` is present in STATE.md.** This ensures correct behavior when the build spans multiple invocations (e.g., skeleton + multiple plugin waves across separate sessions).
   - Check `## LeanMode:` in STATE.md. If `## LeanMode: true`, activate lean mode for this session.
   - Check `## Mode:` in STATE.md. If `## Mode: plugins-only`, restore the `plugins-only` sub-mode for this session (build only plugin waves, skip config). If `## Mode: config-only`, restore the `config-only` sub-mode for this session (build only config.ts + index.ts).
   - Skip to the appropriate build step.
2b. If the first word is `fix` — route directly to **Error Recovery** below. Do NOT enter Skeleton Detection. (The Error Recovery section itself enforces the skeleton-committed prerequisite.)
2c. If the first word is `add` — **single-plugin add mode**. The second word is the plugin name. This mode builds a plugin whose spec was created by `/moku:plan add`.
   - **Reserved-word guard:** If the plugin name matches a reserved keyword (`resume`, `framework`, `app`, `plugin`, `add`, `fix`), report: "Cannot add a plugin named `{name}` — that is a reserved command keyword. Use a different name." Stop.
   - Resolve the plugin name to a spec file: search `.planning/specs/*-{name}.md`. If not found, stop: "No spec found for plugin `{name}`. Run `/moku:plan add plugin {name}` first to create the spec."
   - Verify `src/config.ts` exists and skeleton is committed — if not, stop: "Framework skeleton must be built first. Run `/moku:build resume`."
   - Route to the standard plugin build flow from `build-plugin.md`: build the plugin, wire into framework (`src/config.ts`, `src/index.ts`), run verification chain (format, lint, tsc, test), spawn moku-verifier, run targeted validators (plugin-spec-validator, type-validator, jsdoc-validator).
   - **After successful build:** run delta updates (see Step 8: Delta Updates in `build-final.md`):
     - Update root README with the new plugin
     - Regenerate `llms.txt` and `llms-full.txt`
     - Add integration test scenarios for the new plugin
     - Re-run coverage verification
     - Update CI workflows if new dependencies were added
   - **LeanMode persistence:** If lean mode is active during this add build, write `## LeanMode: true` to STATE.md at completion.
   - Report results and update STATE.md.
   - Exit after completion — do NOT enter Skeleton Detection or wave analysis.
3. If the first word is exactly `framework`, `app`, or `plugin` — use it as the target. The rest is the spec path or plugin name.
   - **`framework` sub-modes:** If the first word is `framework` and the second word is exactly `config` or `plugins`:
     - `config`: build only `config.ts` + `index.ts` from specs. Set sub-mode `config-only`. Track as `## Mode: config-only` in STATE.md.
     - `plugins`: build only plugin waves (skip config build). Set sub-mode `plugins-only`. Track as `## Mode: plugins-only` in STATE.md. **Precondition:** `src/config.ts` must exist. If it does not, report: "Config must be built first. Run `/moku:build framework config` to build config.ts and index.ts, then retry `framework plugins`." Stop.
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
  - If `.planning/build/skeleton-spec.md` **exists**: create a fresh STATE.md before proceeding — Skeleton Detection requires STATE.md to read the `## Skeleton:` field:
    ```
    ## Phase: building
    ## Verb: create
    ## Target: framework
    ## Skeleton: not-started
    ## Next Action: Run /moku:build resume
    ```
    Log: "No STATE.md found but skeleton-spec.md exists. Created fresh STATE.md with Skeleton: not-started." Then continue to Skeleton Detection.
  - If `.planning/build/skeleton-spec.md` does **not** exist: log `No state file found. Proceeding with fresh build.` and continue to Step 0 target detection. (No skeleton routing needed — there is nothing to build.)
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
  - **Pipeline-Built Check:** Before wave analysis, scan the plugins table for any plugins with status `pipeline-built`. If found:
    - **Freshness check:** Compare the timestamp of `## Pipeline Status` against the most recent `## Git Checkpoint`. If `## Pipeline Status` predates the most recent `## Git Checkpoint`, discard it as stale, reset all affected `pipeline-built` plugins to `building`, and remove `## Pipeline Status` before proceeding.
    - If `## Pipeline Status` is fresh, run **pipeline reconciliation** (see `build-wave-execution.md` Wave Pipelining): compare interface file hashes from `## Pipeline Status` against current hashes on disk. If interfaces unchanged → promote to `built` and proceed to verification. If interfaces changed → reset affected `pipeline-built` plugins to `building` and re-spawn their builders. Remove `## Pipeline Status` after reconciliation.
  - **Completed build check:** If `#wave:N` was passed as an argument, skip this check — wave re-execution is intentional. Before proceeding to wave execution, reset all plugins assigned to wave N from status `complete` (or `verified`) back to `building` in STATE.md, so wave N can be re-executed cleanly. Otherwise: if all plugins in the plugins table have status `complete` (or `verified`) AND the build phase is `complete`, tell the user:
    > "This build is already complete. To re-run validation or generate the README, use `/moku:build resume` which will route to the post-build steps. To rebuild from scratch, delete `.planning/STATE.md` and re-run."
    Stop.
  - Skip plugins/waves that are already marked as complete
  - Report: "Detected existing state. Resuming from [position]. Already built: [list]."

**Note:** The Idempotency Protocol (checking for `building` status and partial completion) runs at wave execution start (before spawning builder agents in `build-wave-execution.md`), not during this initial State Check.

### Idempotency Protocol

Run this at wave execution start (Step 3), before spawning builder agents:

1. Read `.planning/STATE.md` — if any plugin has status `building`, the previous invocation crashed mid-wave
   - **`#wave:N` re-run exception:** If `waveOverride` was set in Step 0 (via `#wave:N`), skip the recovery prompt — wave re-execution is intentional. Reset the `building` status for all plugins assigned to wave N back to `building` (no AskUserQuestion) and proceed directly to execution.
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

**Concurrency guard (pre-condition):** Before step 1, check if `.planning/STATE.md.tmp` already exists. If it does, another process may be writing. Warn: "STATE.md.tmp already exists — another build may be in progress." To determine if it is stale: check the file's modification time. If it is older than 5 minutes and no build process is actively running, it is safe to delete manually. Stop and wait for the user to resolve this before proceeding.

1. Back up current state: copy to `.planning/STATE.md.bak` before overwriting. If `.planning/STATE.md.bak` already exists, it will be overwritten — the `.bak` file is a single-depth undo (most recent state only), not an accumulating backup history.
2. Write new content to `.planning/STATE.md.tmp` first (not directly to STATE.md)
3. Validate that the tmp file contains required headers (`## Phase:`, `## Target:`, `## Next Action:`) before renaming
   - **Mode preservation:** If the previous STATE.md contained `## Mode:`, verify the new STATE.md also contains `## Mode:` with the same value. If it is absent from the new write, add it before renaming.
4. If validation passes, rename `.planning/STATE.md.tmp` to `.planning/STATE.md` (atomic replace)
5. If validation fails, delete the tmp file and stop: "STATE.md write failed validation — the `.bak` is intact."
6. If in a git repo, record the current commit SHA in the state file as `## Git Checkpoint: <sha>`
7. This enables rollback if a wave introduces regressions

---

## Skeleton Detection & Routing

After reading STATE.md, check skeleton status **before** routing to any build target. This step runs on every invocation regardless of arguments.

### Skeleton Status Check

Read `## Skeleton:` from STATE.md:

| Status | Action |
|--------|--------|
| field absent | Old STATE.md format — assume skeleton committed, proceed to normal build routing |
| `not-started` | Read `.planning/build/skeleton-spec.md` → route to `build-skeleton.md` Step S1 |
| `in-progress` | Read skeleton-spec.md, find last completed skeleton wave → resume from next wave. (Any held `#wave:N` or `--continue` will be re-applied after skeleton is committed.) |
| `verified` | Re-present skeleton report — read `.planning/build/skeleton-report.md` (if file is missing, route to `build-skeleton.md` Step S3 to regenerate it first). Use `AskUserQuestion`: "Skeleton verified. How would you like to proceed?" — Options: "Approve and commit (Recommended)" / "Adjust skeleton" / "Show details". **Note:** `--continue` does not bypass the skeleton approval gate. Continuous mode applies only to plugin waves after skeleton is committed. After approval and commit, `--continue` mode resumes automatically for subsequent plugin waves. |
| `committed` | Skeleton complete — proceed to **Step 2: Wave Analysis** in `build-framework.md` (or app/plugin routing). Do NOT skip wave analysis and proceed directly to plugin file creation — the wave plan must be computed and approved before any plugin implementation begins |

**Git checkpoint verification:** After skeleton is committed, verify the commit exists: `git log --oneline -1` must show the skeleton commit. If no commit exists (e.g., skeleton build ran without committing), route back to `build-skeleton.md` Step S6 to create the commit before proceeding.

**Skeleton always takes priority.** Any argument (`resume`, `framework #wave:2`, `--continue`) is held until skeleton is `committed`. The skeleton MUST be committed before any plugin build wave begins. If the user passes `resume` or `--continue` but skeleton is not committed, tell the user: "Skeleton build is not yet committed. Completing skeleton first — your `[argument]` will apply after skeleton is committed." Then proceed with skeleton build. After skeleton is committed, re-apply the held arguments (e.g., `--continue` mode resumes, `#wave:N` routes to the specified wave).

**This applies to ALL build targets** — `framework`, `app`, and `plugin` builds all require skeleton committed. If skeleton is not `committed` when targeting `app` or `plugin`, route to skeleton build first before the app/plugin build.

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/build-skeleton.md` for detailed skeleton build steps.

---

## Output Style

If `.claude/output-styles/` directory exists and contains `moku-building.md`, suggest switching to `moku-building` at the start of this command for terse, progress-focused formatting. Otherwise, skip silently.

---

## Task DAG for Wave Progress Tracking

Use `TaskCreate` and `TaskUpdate` to provide visual progress tracking during builds. Tasks supplement STATE.md (which remains the cross-session source of truth). Tasks are session-scoped and provide in-session progress UI.

**At wave start:**
1. Create a parent task for the wave: `TaskCreate("Wave N", "Build plugins: [list]", activeForm: "Building Wave N...")`
2. Create a child task for each plugin: `TaskCreate("[name] ([tier])", "Build [name] plugin from spec", activeForm: "Building [name]...")`
3. Set dependencies: `TaskUpdate(child, addBlockedBy: [dependencies from other plugins in this wave if any])`
   - `addBlockedBy` lists only plugins this plugin explicitly depends on (per the spec's `depends` field). Independent plugins in the same wave have `addBlockedBy: []` and run in parallel.

**During wave:**
- When a builder agent starts: `TaskUpdate(pluginTask, status: "in_progress", activeForm: "Building [name]...")`
- When a builder agent completes: `TaskUpdate(pluginTask, status: "completed")` or keep as in_progress if failed

**After wave verification:**
- Update parent wave task based on results
- If all plugins verified: `TaskUpdate(waveTask, status: "completed")`
- If verification running: `TaskUpdate(waveTask, activeForm: "Verifying Wave N...")`

**Example:**
```
TaskCreate("Wave 1", "Build env, logger, config-validator", activeForm: "Building Wave 1...")
TaskCreate("env [Nano]", "Build env core plugin", activeForm: "Building env...")
TaskCreate("logger [Nano]", "Build logger core plugin", activeForm: "Building logger...")
TaskCreate("config-validator [Micro]", "Build config-validator plugin", activeForm: "Building config-validator...")
```

The `activeForm` field shows live spinner text in the task panel (e.g., "Building env...") while a task is `in_progress`, giving the user real-time feedback about what's happening.

---

## Framework Build

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/build-framework.md` for detailed framework build steps.

**Summary**: Build all plugins in dependency-aware waves using parallel sub-agents, with post-wave verification and gap closure.

**Flow**: Each invocation executes exactly ONE step (wave, verification, README, or validation), saves STATE.md, and stops. User runs `/moku:build resume` for the next step. This ensures fresh context and explicit user control.

**CRITICAL: Wave analysis is mandatory before any plugin implementation.** After skeleton is committed, the FIRST action is always Step 1 (wave analysis) from `build-framework.md`. Do NOT skip wave analysis and create plugin implementation files directly. The wave plan determines build order, parallelism, and dependency safety.

**Step sequence per invocation:**
1. Read specs → Wave analysis → **STOP** (present wave plan). **On resume:** if STATE.md already contains a stored wave plan (detect by looking for `| Wave |` in the plugins table header row AND all plugin rows have a numeric value in the Wave column), skip wave analysis and proceed directly to executing the next incomplete wave.
2. Build Wave 0 (core plugins) → verify → integrate → tick spec checkboxes → git checkpoint → STATE.md update → **STOP**
3. Build Wave 1 → verify → integrate → **regression test** → tick spec checkboxes → **STOP**
4. Build Wave N → ... → **regression test** → ... → **STOP** (one wave per invocation until all waves done)

**With pipelining (`--continue` + ≥ 3 waves):**
2. Build Wave 0 → verify → integrate → **CONTINUE**
3. Build Wave 1 + **verify Wave 0** (pipelined) → reconcile → integrate → **CONTINUE**
4. Build Wave N+1 + **verify Wave N** (pipelined) → reconcile → integrate → **CONTINUE**
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

**Wave pipelining (`--continue` + ≥ 3 waves):** When continuous mode is active and the project has 3+ waves, wave N+1 builders start while wave N is being verified (~30-50% throughput gain). See `build-wave-execution.md` Wave Pipelining section. Disable with `enablePipelining: false` in project config.

**Lean execution mode (`--lean` or `leanMode: "auto"`):** Strips verbose context from agent prompts during builds (~40-60% context savings). **A "session" is a single `--continue` invocation.** Auto-lean activates at the start of wave 3+ within a `--continue` run. For non-continue (one-wave-per-invocation) mode, auto-lean does not trigger — use `--lean` explicitly or set `leanMode: true` in config. Combines well with pipelining — lean mode halves agent context cost while pipelining doubles agent throughput.

**`#wave:N` syntax:** `/moku:build #wave:2` jumps directly to wave 2 (useful for re-running a specific wave after manual fixes). See Step 0 rule 1e for parsing and validation.

### Post-Wave Code Review

After each wave's verification passes (Step 4a in build-verification.md), spawn the **moku-code-reviewer** agent to review the wave's code changes. The code reviewer catches logic errors, spec deviations, and security issues that automated tools miss. See build-verification.md Step 4a2 for integration details.

Key triage behaviors (inline summary):
- If `skipTriage: true` in project config, auto-defer all findings without prompting.
- BLOCKER findings block wave completion — they must be resolved before the wave is considered done.
- "Fix now" routes to gap closure in the current session; "Fix later" defers the finding to the next resume.

### Stalemate Detection

During gap closure, track fix effectiveness between rounds. If the same errors persist or error count increases after applying fixes, skip remaining gap closure rounds and escalate to Fresh-Context Retry immediately. See `build-verification.md` Step 4c for the error signature hashing algorithm and stalemate detection details.

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

This section is entered when: (a) `$ARGUMENTS` starts with `fix`, OR (b) `resume` was invoked and `## Verb: fix` was detected in STATE.md (an interrupted fix session is being continued). This targets failed or partially built plugins.

**Prerequisite checks run in order:**

**(1) Skeleton prerequisite:** Fix mode requires skeleton to be `committed` in STATE.md. If `## Skeleton:` field is absent (old STATE.md format without skeleton tracking), assume `committed` and proceed. If `## Skeleton:` is `not-started` or `in-progress`, tell the user: "Fix mode requires the skeleton to be committed first. Complete the skeleton build with `/moku:build resume`, then re-run fix." If `## Skeleton:` is `verified`, tell the user: "Skeleton is built but not yet committed. Run `/moku:build resume` to approve and commit the skeleton, then re-run `fix`."

**Syntax:**
- `fix auth` — fix a specific plugin by name
- `fix #3` — fix a specific plugin by number
- `fix --all` — fix all plugins with `needs-manual` or `verify-failed` status

**Reserved word guard:** If a plugin name argument (`fix <name>`) matches a reserved keyword (`resume`, `framework`, `app`, `plugin`, `fix`), report: "Cannot fix a plugin named `{name}` — that is a reserved command keyword. Use `fix #N` or `fix --all` instead. Run `/moku:status` to see plugin numbers." Stop.

**(2) Zero-match guard for `fix --all`:** Before proceeding, scan STATE.md for plugins with `needs-manual` or `verify-failed` status. If none are found, tell the user: "No plugins need fixing — all plugins are verified or complete." Stop.

**(3) Multi-plugin prompt:** When multiple plugins need fixing, use `AskUserQuestion`:
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
