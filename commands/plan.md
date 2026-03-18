---
description: Plan a Moku project — create, update, add plugins, or migrate existing code (3-stage gated workflow)
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion, EnterPlanMode, ExitPlanMode
argument-hint: [create|update|add|migrate|resume] [type] ({path/link/github}) {requirements} [--quick]
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

Create a specification plan for a Moku project. The input (`$ARGUMENTS`) uses a verb-first pattern:

- `create framework "A static site generator"` — new framework from description
- `create tool "A bundler for TypeScript"` — same as framework (tool is a synonym)
- `create app "A personal blog"` — new consumer app
- `create game "A roguelike dungeon crawler"` — same as app (game is a synonym)
- `add plugin auth "JWT-based authentication"` — add plugin to existing framework (plan + build + wire in one pass)
- `update plugin router "add nested route support"` — update an existing plugin's spec
- `update app "add caching and offline support"` — update consumer app composition
- `migrate framework ~/Projects/legacy-app` — migrate existing code to Moku
- `migrate app https://github.com/user/repo "convert to Moku consumer"` — migrate from GitHub
- `resume` — continue from saved state
- `framework "A static site generator"` — (backward compat) same as `create framework`

This command runs as a **3-stage gated workflow** with optional discussion, optional research, and plan validation. Each stage ends with a user checkpoint — the user must explicitly approve before proceeding to the next stage.

The `add` verb is special — it runs a quick single-pass flow (plan + build + wire + verify) instead of the 3-stage workflow.

**`--quick` mode:** If `--quick` is present in arguments, collapse the 3-stage workflow into a single pass — analysis, specs, and skeleton in one invocation with one approval at the end instead of three. Auto-suggested when Stage 1 finds ≤ 4 plugins — use `AskUserQuestion` to offer the choice:
- Question: "Only [N] plugins detected. Switch to quick mode?"
- Header: "Quick mode"
- Options: "Continue with 3-stage workflow" / "Switch to --quick (Recommended)" with descriptions
The `add` verb always runs in quick mode regardless of this flag.

**CRITICAL:** Never use explicit generics on `createPlugin` — all types must be inferred from the spec object. See the moku-plugin skill for the rule and examples. Check every code example before showing to the user.

---

## Step 0: Parse Arguments

Parse `$ARGUMENTS` into five components: **VERB**, **TYPE**, **PATH_OR_LINK**, **REQUIREMENTS**, **QUICK_MODE**.

If `$ARGUMENTS` is empty and no VERB can be determined, stop with: "Usage: `/moku:plan [create|update|add|migrate|resume] [type] {description} [--quick]`"

If `--quick` is present anywhere in `$ARGUMENTS`, set QUICK_MODE=true and strip it before further parsing. Otherwise QUICK_MODE=false.

### Token Extraction

**Guard — resume verb:** If the first token (after stripping `--quick`) is `resume`, set VERB=`resume` and skip all remaining Token Extraction steps. Proceed directly to Step 0.1.

1. **Extract VERB** from first word:
   - `create`, `update`, `add`, `migrate`, `resume` → use as VERB, advance to next token
   - If first word is a TYPE keyword (see normalization table) → set VERB=`create` (backward compat). Set TYPE to this word (normalize via table below). Advance token pointer to the word after this one. Continue to step 3 (PATH_OR_LINK extraction).
   - If first word looks like a path (contains `/`, starts with `.`, `~`, or `http`) → set VERB=`migrate`, reparse as PATH_OR_LINK
   - If no recognized word → auto-detect (see below)

2. **Extract TYPE** from next token:
   - Guard: if the TYPE token matches a VERB keyword (`create`, `update`, `add`, `migrate`, `resume`), do not normalize — tell user: "The verb `{token}` cannot be used as a type. Did you mean `/moku:plan {token} [type] [description]`?" and stop.
   - Match against normalization table → set normalized TYPE
   - If no TYPE found and VERB is `add` → default to `plugin`
   - If no TYPE found and VERB is `create` or `update` → auto-detect from working directory
   - If no TYPE found and VERB is `migrate` → default to `framework`

3. **Extract PATH_OR_LINK** (optional):
   - If next token contains `/`, starts with `.`, `~`, or `http` → set as PATH_OR_LINK
   - For `migrate`: PATH_OR_LINK is expected. If missing, ask user for the path or URL.
   - For other verbs: skip (not expected)

4. **Remaining tokens** → REQUIREMENTS (free text)

### Type Normalization Table

| Input | Normalized TYPE |
|-------|-----------------|
| `framework`, `tool`, `engine`, `library` | `framework` |
| `app`, `application`, `service`, `server`, `game` | `app` |
| `plugin` | `plugin` |

### Auto-Detection (when TYPE is missing)

If no TYPE keyword is found:
  a. `src/config.ts` exists AND contains `createCoreConfig` → **framework**
  b. `package.json` depends on a Moku framework package (not `@moku-labs/core` directly) → **app**
  c. Argument looks like a plugin name or spec reference → **plugin**
  d. If still unclear — use `AskUserQuestion`:
     - Question: "What type of project are you planning?"
     - Header: "Project type"
     - Options:
       1. label: "Framework", description: "A reusable plugin-based framework (Layer 2)"
       2. label: "Consumer App", description: "An application built on a framework (Layer 3)"
       3. label: "Plugin", description: "A single plugin to add to an existing framework"
     - multiSelect: false
     Normalize the answer via the Type Normalization Table. If user selects "Other" with unrecognized text, ask once more. If still unclear, stop: "Could not determine project type. Please re-run with an explicit type, e.g. `/moku:plan create framework 'description'`."

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

For `migrate`: REQUIREMENTS is optional — PATH_OR_LINK is the primary input. If both REQUIREMENTS and PATH_OR_LINK are empty, prompt for the path instead.

### Verb-Type Validation

| VERB | Allowed TYPEs |
|------|---------------|
| `create` | `framework`, `app`, `plugin` |
| `update` | `framework`, `app`, `plugin` |
| `add` | `plugin` only |
| `migrate` | `framework`, `app` |
| `resume` | (no TYPE needed) |

If invalid combination → tell user: "The `{verb}` verb doesn't support the `{type}` target. Did you mean `{suggestion}`?"

---

## Step 0.1: Resume from State

**This step runs when VERB is `resume`, or when VERB is not `resume` but `.planning/STATE.md` exists.**

**Guard — add verb:** If VERB is `add`, skip this step entirely. The `add` workflow is self-contained and does not use multi-stage state.

If VERB is `resume`:
- Read `.planning/STATE.md` — if it doesn't exist, tell user: "No planning state found. Start with `/moku:plan create [type] [description]`."
- Validate that the file contains all required headers (see State Persistence Protocol below) AND that each header has a non-empty value. If any header is missing or empty, tell user: "`.planning/STATE.md` is malformed — missing or empty: {list}. Repair it manually or delete it and run `/moku:plan create [type] [description]` to restart."
- Load VERB, TYPE, phase, plugin table, wave grouping, and QUICK_MODE from state
- Use the Phase-to-Stage Jump Table below to determine which stage to resume at

If VERB is NOT `resume` but `.planning/STATE.md` exists:
- Validate that the file contains all required headers AND each has a non-empty value. If malformed, tell user: "`.planning/STATE.md` is malformed — missing or empty: {list}. Delete it and re-run to start fresh, or repair it manually."
- Read it to understand the current project position
- Use `AskUserQuestion` to present the state:
  - Question: "Found existing plan at [phase]. How would you like to proceed?"
  - Header: "Resume"
  - Options:
    1. label: "Resume (Recommended)", description: "Continue from [phase] — all previous work preserved"
    2. label: "Start fresh", description: "Back up current state and start over from scratch"
    3. label: "Cancel", description: "Don't proceed — leave state as-is"
  - multiSelect: false
  - If user chooses **Resume**: use the Phase-to-Stage Jump Table to determine the resume point.
  - If user chooses **Start fresh**: back up `.planning/STATE.md` to `.planning/STATE.md.bak`, delete all `.planning/specs/*.md` files, then proceed as if no state existed.
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
| `complete` | Tell user: "This plan is already complete. Run `/moku:build resume` to begin building." Stop. |

### State Persistence Protocol

Every stage reads `.planning/STATE.md` at the start and writes it at the end. This enables:
- Resuming from any stage in a fresh context window
- Running a single stage without re-running previous ones
- Tracking exactly what has been completed and approved

**On stage entry:**
1. Read `.planning/STATE.md`
2. Verify `## Phase:` ends with `/approved` (e.g., `stage1/approved`) — if not, tell user: "Stage N cannot start: the previous stage has not been approved. Resume from the pending-approval stage to approve it first."
3. Load context: verb, target type, decisions, plugin table, wave grouping

**On stage exit (before user gate):**
1. Back up current state: copy `.planning/STATE.md` to `.planning/STATE.md.bak` before overwriting. Use **inline-colon format** for all headers (e.g., `## Next Action: /moku:plan resume` — never use a bare section heading like `## Next Action`).
2. Update `.planning/STATE.md` with (all on the same line as the header, using `## Header: value` format):
   - Current phase status
   - What was completed in this stage
   - Artifacts created (spec files, skeleton files)
   - Next expected action
3. Set `## Phase:` to `stage{N}/pending-approval` (e.g., `## Phase: stage1/pending-approval`).
4. When user approves at the gate, update `## Phase:` to `stage{N}/approved` before advancing to the next stage.
5. Validate the written file contains all required headers: `## Phase:`, `## Verb:`, `## Target:`, `## Next Action:`, `## PluginTable:`, `## WaveGrouping:`, `## QuickMode:`.
   - If validation fails (any header missing after write), stop: "STATE.md write failed validation — missing headers: {list}. Do not proceed. Retry the write or the planning session may be unresumable."

---

## Plan Mode for Analysis

When entering Stage 1 analysis (after any discussion and research phases that write files), use `EnterPlanMode` to activate read-only mode. This ensures no accidental file creation during the analysis phase. The analysis explores the codebase, identifies plugins, and designs the architecture — all read-only operations.

Call `ExitPlanMode` when the Stage 1 analysis is complete and ready for user approval. The plan mode approval UI presents the analysis for the user to review. After approval, proceed to write STATE.md and continue to Stage 2 in normal mode.

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

Based on parsed VERB and TYPE, load and follow the appropriate verb-specific reference:

| VERB | Action |
|------|--------|
| `resume` | Step 0.1 above (read STATE.md, jump to recorded position) |
| `add` (plugin) | Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-verb-add.md` and follow it — quick single-pass, self-contained |
| `update` (any) | Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-verb-update.md` and follow it |
| `migrate` (any) | Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-verb-migrate.md` and follow it |
| `create` (any) | Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-verb-create.md` and follow it |

**IMPORTANT:** Load only the one reference file matching the verb. Do not load all of them.

**Quick mode:** QUICK_MODE is persisted in STATE.md via the `## QuickMode:` header. When `--quick` is passed, update `## QuickMode: true` in STATE.md on the next write. On resume without `--quick`, read QUICK_MODE from STATE.md's `## QuickMode:` field. This allows quick mode to carry across sessions.
- If QUICK_MODE=true and VERB is `create` or `update`: collapse Stages 1+2+3 into a single pass — run all three sequentially without stopping for approval between them. Present one combined summary at the end for a single approval gate. The verb reference files describe the individual stages — in quick mode, just run them back-to-back.
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
