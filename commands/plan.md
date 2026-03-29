---
description: Plan a Moku project — create, update, add plugins, or migrate existing code (3-stage gated workflow)
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion, EnterPlanMode, ExitPlanMode
argument-hint: [create|update|add|migrate|resume] [type] ({path/link/github}) {requirements} [--quick] [--context {file}]
disable-model-invocation: true
---

## Project Configuration
!`test -f .claude/moku.local.md && head -20 .claude/moku.local.md || true`

Use configuration values above if present. Validate before using — ignore invalid values and use defaults:

| Setting | Type | Range | Default |
|---------|------|-------|---------|
| `maxParallelAgents` | integer | 1–8 | 5 |
| `gapClosureMaxRounds` | integer | 0–5 | 2 |
| `skipValidation` | boolean | true/false | false |

See `/moku:build` for the complete configuration schema covering all Moku commands.

Create a specification plan for a Moku project. The input (`$ARGUMENTS`) uses a verb-first pattern:

- `create framework "A static site generator"` — new framework from description
- `create tool "A bundler for TypeScript"` — same as framework (tool is a synonym)
- `create app "A personal blog"` — new consumer app
- `create game "A roguelike dungeon crawler"` — same as app (game is a synonym)
- `add plugin auth "JWT-based authentication"` — create a plugin spec for an existing framework (build separately with `/moku:build add`)
- `update plugin router "add nested route support"` — update an existing plugin's spec
- `update app "add caching and offline support"` — update consumer app composition
- `migrate framework ~/Projects/legacy-app` — migrate existing code to Moku
- `migrate app https://github.com/user/repo "convert to Moku consumer"` — migrate from GitHub
- `resume` — continue from saved state
- `framework "A static site generator"` — (backward compat) same as `create framework`

This command runs as a **3-stage gated workflow** with optional discussion, optional research, and plan validation. Each stage ends with a user checkpoint — the user must explicitly approve before proceeding to the next stage.

The `add` verb is special — it runs a lightweight spec-only flow instead of the 3-stage workflow. It creates the plugin spec and recommends `/moku:build add {name}` for implementation.

**`--quick` mode:** If `--quick` is present in arguments, collapse the 3-stage workflow into a single pass — analysis, specs, and skeleton in one invocation with one approval at the end instead of three. Auto-suggested when Stage 1 finds ≤ 4 plugins — the auto-suggest check runs after the plugin table is assembled, before the Stage 1 approval gate, **and only when QUICK_MODE is not already true** (if `--quick` was passed explicitly, the user has already chosen quick mode — do not offer the choice again). Use `AskUserQuestion` to offer the choice:
- Question: "Only [N] plugins detected. Switch to quick mode?"
- Header: "Quick mode"
- Options: "Continue with 3-stage workflow" / "Switch to --quick (Recommended)" with descriptions
The `add` verb always runs in quick mode regardless of this flag.

**CRITICAL:** Never use explicit generics on `createPlugin` — all types must be inferred from the spec object. See the moku-plugin skill for the rule and examples. Check every code example before showing to the user.

---

## Step 0: Parse Arguments

Parse `$ARGUMENTS` into six components: **VERB**, **TYPE**, **PATH_OR_LINK**, **REQUIREMENTS**, **QUICK_MODE**, **CONTEXT_FILE**.

**Ordered startup sequence (run in this exact order):**

1. **Filesystem guard (mandatory):** Ensure the planning directory exists:
   ```bash
   mkdir -p .planning/
   ```
   This MUST execute before creating decisions.md, research.md, STATE.md, or any spec files. On fresh projects the directory does not exist and writes will fail without this guard.

2. **Empty-arguments check:** If `$ARGUMENTS` is empty and no VERB can be determined, stop with: "Usage: `/moku:plan [create|update|add|migrate|resume] [type] {description} [--quick]`"

(The filesystem guard in step 1 runs unconditionally — even if step 2 would stop early. The empty directory is harmless.)

If `--context {filename}` is present anywhere in `$ARGUMENTS`, extract the token following `--context` as the context filename, set CONTEXT_FILE=`.planning/{filename}` (if the value does not already start with `.planning/`, prepend it), and strip `--context {filename}` from `$ARGUMENTS`. Verify: `test -f '{CONTEXT_FILE}'` — if file does not exist, tell user: "Context file `{CONTEXT_FILE}` not found. Run `/moku:brainstorm` first or check the path." and stop. If `--context` is absent, set CONTEXT_FILE=(none).

**`--context` verb support:** The `--context` flag is fully supported for the `create` verb (Context Injection Pre-Phase in `plan-verb-create.md` consumes the file). For `update` and `migrate` verbs, log a warning: "Note: `--context` provides supplementary context for the `{VERB}` workflow but does not skip any phases. The full {VERB} workflow will run." Pass CONTEXT_FILE through to the verb reference file — it can read the file for additional context but no phases are skipped automatically. For `add` verb: `--context` is not applicable — warn: "`--context` is ignored for the `add` verb." and set CONTEXT_FILE=(none).

**Write CONTEXT_FILE to STATE.md:** On the first STATE.md write of this invocation, include `## ContextFile: {CONTEXT_FILE}` if CONTEXT_FILE is not `(none)`, else `## ContextFile: (none)`. On resume, load CONTEXT_FILE from STATE.md's `## ContextFile:` field. **Precedence:** If `--context` is explicitly passed at invocation time, it overrides the stored value.

If `--quick` is present anywhere in `$ARGUMENTS`, set QUICK_MODE=true and strip **all occurrences** of `--quick` before further parsing. Otherwise QUICK_MODE=false.

**Write QUICK_MODE to STATE.md immediately:** On the first STATE.md write of this invocation (either the initial creation or the first update), include `## QuickMode: true` if QUICK_MODE=true, else `## QuickMode: false`. Do not wait until stage exit to persist this value — a session drop during Stage 1 must be able to recover QUICK_MODE from STATE.md.

### Token Extraction

**Tokenization:** Follow shell-like semantics — text enclosed in matching single or double quotes is treated as a single token (quotes stripped). This allows paths and descriptions with spaces: `create framework "my static site"`.

**Guard — resume verb:** If the first token (after stripping `--quick`) is `resume`, set VERB=`resume` and skip all remaining Token Extraction steps. Proceed directly to Step 0.1.

1. **Extract VERB** from first word:
   - `create`, `update`, `add`, `migrate`, `resume` → use as VERB, advance to next token
   - If first word is a TYPE keyword (see normalization table) → set VERB=`create` (backward compat). Set TYPE to this word (normalize via table below). Advance token pointer to the word after this one. Continue to step 3 (PATH_OR_LINK extraction).
   - If first word looks like a path (contains `/`, starts with `.`, `~`, or `http`) → set VERB=`migrate`, set PATH_OR_LINK to this token, set TYPE=`framework` (migrate default), skip steps 2 and 3 (TYPE and PATH_OR_LINK are already set), advance token pointer past this token, continue to REQUIREMENTS extraction (step 4).
   - If no recognized word → auto-detect (see below). Do not advance the token pointer on the unrecognized word — leave the full token stream intact for auto-detection to evaluate. When TYPE is resolved via auto-detect (conditions a–d) and no VERB was set during token extraction, set VERB=`create`. **Note:** because the token pointer is not advanced on an unrecognized first word, that word will remain in the token stream and be included in REQUIREMENTS after TYPE resolution. This is intentional — unrecognized words may carry useful context for the planning workflow.

2. **Extract TYPE** from next token:
   - Guard: if the TYPE token matches a VERB keyword (`create`, `update`, `add`, `migrate`, `resume`), do not normalize — tell user: "The verb `{token}` cannot be used as a type. Did you mean `/moku:plan {token} [type] [description]`?" and stop.
   - Match against normalization table → set normalized TYPE
   - If no TYPE found and VERB is `add` → default to `plugin`
   - If no TYPE found and VERB is `create` or `update` → auto-detect from working directory
   - If no TYPE found and VERB is `migrate` → default to `framework`

3. **Extract PATH_OR_LINK** (optional):
   - If next token contains `/`, starts with `.`, `~`, or `http` → set as PATH_OR_LINK
   - **Fallback probe (when token does NOT match the sigil checks above):** If the token is present but did not match any sigil pattern, apply these probes in order before falling through to REQUIREMENTS:
     1. **Local path probe:** Test if the token exists as a local directory (`test -d '{token}'`) or file (`test -f '{token}'`). If yes → set as PATH_OR_LINK. Log: "Resolved `{token}` to local path `{token}`". Advance past this token.
     2. **Context file probe:** Test if `.planning/context-{token}.md` exists. If yes → set CONTEXT_FILE to `.planning/context-{token}.md`. Log: "Resolved `{token}` to `.planning/context-{token}.md`". Do NOT consume the token as PATH_OR_LINK — the context file provides brainstorm context, not the migration source. PATH_OR_LINK remains unset (the migrate verb will prompt for it if needed). Advance past this token.
     3. **Conflict check:** If BOTH a local path AND a context file would match (i.e., `{token}` is a valid directory/file AND `.planning/context-{token}.md` exists), use `AskUserQuestion`: Question: "The token `{token}` matches both a local path and a context file. Which did you mean?" / Header: "Ambiguous token" / Options: "Use as migration source path (`{token}`)" / "Use as brainstorm context (`.planning/context-{token}.md`)" / multiSelect: false. Set PATH_OR_LINK or CONTEXT_FILE based on the answer.
     4. **Neither:** Do not advance the token pointer — the token falls through to REQUIREMENTS extraction as before.
   - For `migrate`: PATH_OR_LINK is **required**. If missing after parsing, do NOT route to plan-verb-migrate.md. Instead prompt via `AskUserQuestion`:
     - Question: "What is the path or URL of the project to migrate?"
     - Header: "Migrate source"
     - Options: (free text — no fixed options)
     Set PATH_OR_LINK to the answer. If the answer is empty or whitespace-only, ask once more using the same question. If still empty after the second attempt, stop: "No source path provided. Run `/moku:plan migrate [type] [path]` with an explicit path." Do not route until PATH_OR_LINK is a non-empty value.
   - For `migrate` with a local path (not starting with `http`): verify the path exists and is readable using `test -d '{path}' && test -r '{path}'` (or `test -f '{path}' && test -r '{path}'` if a file path is given). If not, tell user: "Path `{path}` does not exist or is not readable. Provide a valid path to an existing project." and stop.
   - For `migrate` paths: if the path, after resolving with `realpath -e` (or string-normalizing `../` sequences if the path does not yet exist), points outside the current working directory, confirm via `AskUserQuestion` — Question: "The path `{path}` points outside the current working directory. Continue?" / Header: "Path confirmation" / Options: "Yes, use this path" / "No, cancel" (multiSelect: false). If user cancels, stop.
   - For other verbs: skip (not expected)

4. **Remaining tokens** → REQUIREMENTS (free text). After TYPE is resolved (including via auto-detect AskUserQuestion — see below), all tokens not consumed during VERB/TYPE/PATH_OR_LINK extraction become REQUIREMENTS.

5. **PLUGIN_NAME extraction (`add` verb only):** After TYPE is confirmed as `plugin`, extract PLUGIN_NAME from the next token if it is present and is not a path/link token (i.e., does not contain `/` and does not start with `.`, `~`, or `http`). Store as PLUGIN_NAME. Remaining tokens after PLUGIN_NAME become REQUIREMENTS.

   > **NOTE for `update plugin`:** PLUGIN_NAME extraction is handled in `plan-verb-update.md` (it treats the first token of REQUIREMENTS as the plugin name). No extraction is needed here — this step 5 applies to `add` only.

### Type Normalization Table

| Input | Normalized TYPE |
|-------|-----------------|
| `framework`, `tool`, `engine`, `library` | `framework` |
| `app`, `application`, `service`, `server`, `game` | `app` |
| `plugin` | `plugin` |

### Auto-Detection (when TYPE is missing)

If no TYPE keyword is found, evaluate conditions a–d in order; use the first condition that matches (first-match-wins). Stop evaluating once a match is found:
  a. `src/config.ts` exists AND contains `createCoreConfig` → **framework**
  b. `package.json` `dependencies` or `devDependencies` contains a package matching `@moku-labs/*` other than `@moku-labs/core` itself → **app**
  c. Argument looks like a plugin name or spec reference → **plugin**
  d. If still unclear — use `AskUserQuestion`:
     - Question: "What type of project are you planning?"
     - Header: "Project type"
     - Options:
       1. label: "Framework", description: "A reusable plugin-based framework (Layer 2)"
       2. label: "Consumer App", description: "An application built on a framework (Layer 3)"
       3. label: "Plugin", description: "A single plugin to add to an existing framework"
     - multiSelect: false
     Normalize the answer via the Type Normalization Table. After TYPE is resolved, the remaining unparsed tokens (all tokens not consumed during VERB/TYPE/PATH_OR_LINK extraction) become REQUIREMENTS. If user selects "Other" with unrecognized text, ask once more. If still unclear, stop: "Could not determine project type. Please re-run with an explicit type, e.g. `/moku:plan create framework 'description'`."

### REQUIREMENTS Validation

After all tokens are parsed: if REQUIREMENTS is empty and VERB is `create` or `update`, use `AskUserQuestion`:
- Question: "What do you want to build? Provide a brief description."
- Header: "Description"
- Options:
  1. label: "Web framework", description: "e.g. static site generator, SPA framework, component library"
  2. label: "CLI tool", description: "e.g. bundler, linter, code generator"
  3. label: "Game engine", description: "e.g. roguelike, puzzle, real-time strategy"
  4. label: "Other", description: "Describe in your own words"
- multiSelect: false
Treat the user's selection or custom text as REQUIREMENTS and continue.

**Sentinel collision guard:** After REQUIREMENTS is set (whether from arguments or the AskUserQuestion above), trim it and check whether the trimmed value equals `(none)`. If it does, treat REQUIREMENTS as empty and prompt again via `AskUserQuestion` using the same question/options above — the string `(none)` is reserved for internal STATE.md placeholder use and must not be stored as a real description.

For `migrate`: REQUIREMENTS is optional — PATH_OR_LINK is the primary input. The PATH_OR_LINK prompt at step 3 above ensures PATH_OR_LINK is always set before routing, so REQUIREMENTS may remain empty for migrate.

### Verb-Type Validation

| VERB | Allowed TYPEs |
|------|---------------|
| `create` | `framework`, `app`, `plugin` |
| `update` | `framework`, `app`, `plugin` |
| `add` | `plugin` only |
| `migrate` | `framework`, `app` |
| `resume` | (no TYPE needed) |

If invalid combination → tell user: "The `{verb}` verb doesn't support the `{type}` target. Did you mean `{suggestion}`?" To construct `{suggestion}`: if the TYPE is wrong for the VERB, correct the TYPE (e.g., `add framework` → suggest `add plugin`). If the VERB is wrong for the TYPE, correct the VERB to one that accepts the given TYPE.

---

## Step 0.1: Resume from State

**This step runs when VERB is `resume`, or when VERB is not `resume` but `.planning/STATE.md` exists.**

**Guard — add verb:** If VERB is `add`, skip this step entirely. The `add` workflow is self-contained and does not use multi-stage state.

If VERB is `resume`:
- Read `.planning/STATE.md` — if it doesn't exist, tell user: "No planning state found. Start with `/moku:plan create [type] [description]`."
- Validate that the file contains all required headers (see State Persistence Protocol below) AND that each header has a non-empty value (not missing, not blank, and not whitespace-only — trim the value before checking). If any header is missing or empty, tell user: "`.planning/STATE.md` is malformed — missing or empty: {list}. Repair it manually or delete it and run `/moku:plan create [type] [description]` to restart."
- Load VERB, TYPE, phase, plugin table, wave grouping, and QUICK_MODE from state. **Precedence:** If `--quick` was explicitly passed at invocation time (QUICK_MODE was already set to true in Step 0), do not overwrite it with the stored `## QuickMode:` value — the invocation-time flag takes precedence.
- Use the Phase-to-Stage Jump Table below to determine which stage to resume at

If VERB is NOT `resume` but `.planning/STATE.md` exists:
- Validate that the file contains all required headers AND each has a non-empty value (not missing, not blank, and not whitespace-only — trim before checking). If malformed, tell user: "`.planning/STATE.md` is malformed — missing or empty: {list}. Delete it and re-run to start fresh, or repair it manually."
- Read it to understand the current project position
- **Guard — phase none:** If `## Phase:` is `none`, skip the resume prompt and proceed as if no state existed — Phase: none indicates no work has been done yet.
- Use `AskUserQuestion` to present the state:
  - Question: "Found existing plan at [phase]. How would you like to proceed?"
  - Header: "Resume"
  - Options:
    1. label: "Resume (Recommended)", description: "Continue from [phase] — all previous work preserved"
    2. label: "Start fresh", description: "Back up current state and start over from scratch"
    3. label: "Cancel", description: "Don't proceed — leave state as-is"
  - multiSelect: false
  - If user chooses **Resume**: use the Phase-to-Stage Jump Table to determine the resume point.
  - If user chooses **Start fresh**: back up `.planning/STATE.md` to `.planning/STATE.md.bak`, delete all `.planning/specs/*.md` files (preserve `decisions.md` and `research.md` if present), then proceed as if no state existed.
    Immediately after the backup and delete, write a minimal `.planning/STATE.md` with the following headers so that a session drop during the next stage exit is recoverable:
    `## Phase: none` / `## Verb: {VERB}` / `## Target: {REQUIREMENTS if non-empty, else (none)}` / `## Skeleton: not-started` / `## QuickMode: {QUICK_MODE}` / `## PluginTable: (none)` / `## WaveGrouping: (none)` / `## Next Action: Run /moku:plan {VERB} to begin.`
    Guard: Phase `none` means no work has been done — any subsequent resume will skip the resume prompt and proceed as a fresh run (per the Jump Table `none` row).
  - If user chooses **Cancel**: stop.
  - If user chose **Resume** and also provided new REQUIREMENTS in the command args, use `AskUserQuestion`:
    - Question: "You provided a new description. Update the target description?"
    - Header: "Update"
    - Options: "Yes, update description" / "No, keep original"
    - multiSelect: false

### Phase-to-Stage Jump Table

| Phase value | Resume at |
|---|---|
| `none` or unrecognized | Tell user: "No plan has been started yet (or phase is unrecognized). Run `/moku:plan create [type] [description]` to begin." Stop. |
| `stage1` or `stage1/pending-approval` | Re-run Stage 1 (Analysis + Structure) |
| `stage1/approved` | Start Stage 2 (Specifications) |
| `stage2` or `stage2/pending-approval` | Re-run Stage 2 (Specifications) |
| `stage2/approved` | Start Stage 3 (Skeleton Specification) |
| `stage3` or `stage3/pending-approval` | Re-run Stage 3 (Skeleton Specification) |
| `stage3/approved` | Tell user: "This plan is already complete. Run `/moku:build resume` to begin building." Stop. |
| `complete` (VERB is `resume` or `create`) | Tell user: "This plan is already complete. Run `/moku:build resume` to begin building." Stop. |
| `complete` (VERB is `update` or `add`) | Back up `.planning/STATE.md` to `.planning/STATE.md.bak`. Delete `.planning/specs/*.md` files (preserve decisions.md and research.md). In the existing STATE.md, change only `## Phase:` to `none` — preserve all other headers unchanged. Do not rewrite the full file. Proceed as a new planning cycle for the given verb. |

**Pending-approval resume note:** When resuming from a phase ending in `/pending-approval`, the stage re-executes its own work and re-presents the approval gate. The stage entry guard (which requires the previous stage to be `/approved`) is bypassed in this case — the stage owns this phase and is resuming mid-run.

### State Persistence Protocol

Every stage reads `.planning/STATE.md` at the start and writes it at the end. This enables:
- Resuming from any stage in a fresh context window
- Running a single stage without re-running previous ones
- Tracking exactly what has been completed and approved

All headers use **inline-colon format**: `## HeaderName: value` — the header name, a colon, a space, and the value all on one line. Never use a bare section heading like `## Next Action` with the value on a separate line.

**On stage entry:**
1. Read `.planning/STATE.md`
2. Verify `## Phase:` ends with `/approved` (e.g., `stage1/approved`) — if not, tell user: "Stage N cannot start: the previous stage has not been approved. Resume from the pending-approval stage to approve it first." **Exception:** stages reached via the Jump Table from a `/pending-approval` phase skip this check — they are resuming their own pending state.
3. Load context: verb, target type, decisions, plugin table, wave grouping

**On stage exit (before user gate):**
1. Back up current state: copy `.planning/STATE.md` to `.planning/STATE.md.bak`. Then write new content to `.planning/STATE.md.tmp` first (not directly to STATE.md). Validate that the tmp file contains all required headers **before** renaming. If validation passes, rename `.planning/STATE.md.tmp` to `.planning/STATE.md` (atomic replace). If validation fails, delete the tmp file and stop: "STATE.md write failed validation — the `.bak` is intact. Do not proceed until this is resolved." If rename fails, stop: "STATE.md rename failed — tmp file preserved at `.planning/STATE.md.tmp`. The `.bak` is intact. Do not proceed until this is resolved."
2. Update `.planning/STATE.md` (via the tmp→rename procedure above) with (all on the same line as the header, using `## Header: value` format):
   - Current phase status
   - What was completed in this stage
   - Artifacts created (spec files, skeleton files)
   - Next expected action
   - `## QuickMode:` — write `## QuickMode: true` if QUICK_MODE=true, else `## QuickMode: false`
3. Set `## Phase:` to `stage{N}/pending-approval` (e.g., `## Phase: stage1/pending-approval`).
4. When user approves at the gate, update `## Phase:` to `stage{N}/approved` before advancing to the next stage.
5. Validation happens in step 1 (on the tmp file, before rename). The required headers are: `## Phase:`, `## Verb:`, `## Target:`, `## Next Action:`, `## PluginTable:`, `## WaveGrouping:`, `## QuickMode:`, `## Skeleton:`. If any header is missing, the tmp file is deleted and STATE.md remains untouched.

   **Skeleton initial value:** At every stage exit (Stage 1, Stage 2, and Stage 3), preserve the current `## Skeleton:` value from STATE.md if the build command has already advanced it beyond `not-started` (i.e., the current value is `in-progress`, `verified`, or `committed`). If the current value is `not-started` or the field is absent, write `## Skeleton: not-started`. The skeleton field is only advanced by the build command — the plan command must never regress a build-advanced value.

---

## Plan Mode for Analysis

When entering Stage 1 analysis (after any discussion and research phases that write files), use `EnterPlanMode` to activate read-only mode. This ensures no accidental file creation during the analysis phase. The analysis explores the codebase, identifies plugins, and designs the architecture — all read-only operations.

Call `ExitPlanMode` when the Stage 1 analysis is complete and ready for user approval. The plan mode approval UI presents the analysis for the user to review. After approval, proceed to write STATE.md and continue to Stage 2 in normal mode.

**In quick mode:** After `ExitPlanMode` completes at the end of Stage 1, immediately proceed to Stage 2 without a separate approval gate — the single combined approval gate comes at the end of all stages (Stage 3). Do not pause between stages in quick mode.

**When NOT to use Plan Mode:**
- Discussion phase (writes `decisions.md`)
- Research phase (writes `research.md`)
- Stage 2 (writes spec files)
- Stage 3 (writes `skeleton-spec.md`)
- `add` verb (single-pass, writes immediately)

## Output Styles

If the project has output styles configured (`.claude/output-styles/`), suggest switching to `moku-planning` at the start of this command for verbose, analytical formatting.

---

## Route to Workflow

**Guard — unrecognized VERB:** Before routing, verify that VERB (loaded from STATE.md on resume, or parsed from arguments on fresh invocation) is one of: `create`, `update`, `add`, `migrate`. If VERB is any other value:
- **Special case — VERB is `resume`:** Tell user: "`.planning/STATE.md` contains `## Verb: resume`. The `resume` verb is for invocation only and must not be stored. The stored verb should be the original verb used to start this plan (`create`, `update`, `add`, or `migrate`). Edit `## Verb:` to the correct value, or delete `.planning/STATE.md` and run `/moku:plan create [type] [description]` to restart." Stop.
- **All other unrecognized values:** Tell user: "STATE.md contains an unrecognized verb `{VERB}`. Repair `.planning/STATE.md` manually (set `## Verb:` to a valid verb) or delete it and run `/moku:plan create [type] [description]` to restart." Stop.

Based on parsed VERB and TYPE, load and follow the appropriate verb-specific reference:

| VERB | Action |
|------|--------|
| `resume` | Step 0.1 above (read STATE.md, jump to recorded position). After loading, use the **VERB from STATE.md** (not the invocation verb `resume`) to select the verb-specific reference file. The phase determines which stage to re-run within that file — skip all stages that precede the resume point. |
| `add` (plugin) | Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-verb-add.md` and follow it — quick single-pass, self-contained |
| `update` (any) | Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-verb-update.md` and follow it |
| `migrate` (any) | Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-verb-migrate.md` and follow it |
| `create` (any) | Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-verb-create.md` and follow it |

**IMPORTANT:** Load only the one reference file matching the verb. Do not load all of them.

**Context handoff:** All values parsed in Step 0 — VERB, TYPE, PATH_OR_LINK, REQUIREMENTS, PLUGIN_NAME, QUICK_MODE, and CONTEXT_FILE — are available as context variables in the routed reference file. The reference file does not need to re-parse `$ARGUMENTS`.

**Quick mode:** QUICK_MODE is persisted in STATE.md via the `## QuickMode:` header. When `--quick` is passed, write `## QuickMode: true` to STATE.md on the first write of this invocation (before routing — see Step 0 startup sequence). On resume without `--quick`, read QUICK_MODE from STATE.md's `## QuickMode:` field. This allows quick mode to carry across sessions.
- **Precedence:** If `--quick` is explicitly passed at invocation time, it overrides the stored `## QuickMode:` value — set QUICK_MODE=true regardless of what STATE.md contains, and update `## QuickMode: true` in STATE.md on the next write.
- If QUICK_MODE=true and VERB is `create` or `update`: collapse Stages 1+2+3 into a single pass — run all three sequentially without stopping for approval between them. Present one combined summary at the end for a single approval gate. The verb reference files describe the individual stages — in quick mode, just run them back-to-back. **Important:** Even in quick mode, write STATE.md at each stage boundary (`stage1/approved`, `stage2/approved`) before proceeding to the next stage. This enables `plan resume` to recover from a session drop mid-quick-mode. The only difference from normal mode is that the user gate is skipped — the STATE.md writes still happen.
- If QUICK_MODE=true and VERB is `resume`: apply quick mode to the **remaining** stages from the resumed position — run all remaining stages back-to-back with one combined approval gate at the end. QUICK_MODE is read from STATE.md if `--quick` was not explicitly passed.
- If QUICK_MODE=true and VERB is `migrate`: QUICK_MODE is passed through to the reference file. Migrate is already a single-pass workflow; no collapse is needed.
- If QUICK_MODE=true and VERB is `add`: no effect — add always runs in quick mode regardless.

---

## Rules

- Follow the moku-plugin skill's complexity tiers strictly
- Every plugin must have an implementation order number
- Every plugin must have a wave assignment for parallel build grouping
- Plugin #1 should be implementable WITHOUT depending on other plugins
- Each subsequent plugin should only depend on already-numbered plugins
- Include ALL package.json dependencies for every plugin
- Include example of the final consumer API showing all plugin methods typed
- The specs must be self-contained — someone reading them should be able to implement the entire framework
- **Never use explicit generics on createPlugin** — see moku-plugin skill
- **NEVER include onStart/onStop unless there is an actual resource to manage** — document why if included, document why NOT if excluded
- **No folders outside src/plugins/** except config.ts and index.ts at src root — justify any exceptions explicitly
- Consumer code NEVER imports from `@moku-labs/core`
- Consumer imports `createApp` and `createPlugin` from the framework package
- Custom plugins must follow the same structure specs as framework plugins
- Full JSDoc on all custom code
- Include testing strategy for all custom plugins
- Include verification criteria for all plugins
- The spec must be complete enough to implement without further questions
- Run plan-checker agent BEFORE every user gate — users see validated plans only
- Read `.planning/STATE.md` at the start of every stage, write it at the end — enable cross-session continuity
- After all stages complete, `Next Action` must point to `Run /moku:build resume (build command detects skeleton not-started and runs skeleton build first)`
- **Plan NEVER builds:** The plan command only creates specs, analyzes, and recommends. It must NEVER invoke build steps, read build reference files, or create/modify source code files. After approval, always recommend the appropriate `/moku:build` command for the user to run in a fresh context. This applies to ALL verbs including `add` and `update` — the `add` verb creates a spec and recommends `/moku:build add {name}`, the `update` verb updates specs and recommends `/moku:build resume`.
