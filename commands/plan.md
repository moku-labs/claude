---
description: Plan a Moku project — create, update, add plugins, or migrate existing code (3-stage gated workflow)
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
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

**`--quick` mode:** If `--quick` is present in arguments, collapse the 3-stage workflow into a single pass — analysis, specs, and skeleton in one invocation with one approval at the end instead of three. Auto-suggested when Stage 1 finds ≤ 4 plugins: `"Only [N] plugins detected. Consider --quick mode for a single-pass plan. Continue with 3-stage or switch to --quick?"`. The `add` verb always runs in quick mode regardless of this flag.

**CRITICAL:** Never use explicit generics on `createPlugin` — all types must be inferred from the spec object. See the moku-plugin skill for the rule and examples. Check every code example before showing to the user.

---

## Step 0: Parse Arguments

Parse `$ARGUMENTS` into five components: **VERB**, **TYPE**, **PATH_OR_LINK**, **REQUIREMENTS**, **QUICK_MODE**.

If `--quick` is present anywhere in `$ARGUMENTS`, set QUICK_MODE=true and strip it before further parsing. Otherwise QUICK_MODE=false.

### Token Extraction

1. **Extract VERB** from first word:
   - `create`, `update`, `add`, `migrate`, `resume` → use as VERB, advance to next token
   - If first word is a TYPE keyword (see normalization table) → set VERB=`create` (backward compat), reparse from this word as TYPE
   - If first word looks like a path (contains `/`, starts with `.`, `~`, or `http`) → set VERB=`migrate`, reparse as PATH_OR_LINK
   - If no recognized word → auto-detect (see below)

2. **Extract TYPE** from next token (skip if VERB is `resume`):
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
  d. If still unclear — ask the user: "What are you planning? A framework, consumer app, or plugin?"

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

If VERB is `resume`:
- Read `.planning/STATE.md` — if it doesn't exist, tell user: "No planning state found. Start with `/moku:plan create [type] [description]`."
- Load VERB, TYPE, phase, plugin table, wave grouping from state
- Skip to the appropriate stage based on recorded position

If VERB is NOT `resume` but `.planning/STATE.md` exists:
- Read it to understand the current project position
- Present the state to the user: "I found an existing plan state at [phase]. Resume from there or start fresh?"
- If resuming, skip to the appropriate stage

### State Persistence Protocol

Every stage reads `.planning/STATE.md` at the start and writes it at the end. This enables:
- Resuming from any stage in a fresh context window
- Running a single stage without re-running previous ones
- Tracking exactly what has been completed and approved

**On stage entry:**
1. Read `.planning/STATE.md`
2. Verify the previous stage is marked as approved
3. Load context: verb, target type, decisions, plugin table, wave grouping

**On stage exit (before user gate):**
1. Back up current state: copy `.planning/STATE.md` to `.planning/STATE.md.bak` before overwriting
2. Update `.planning/STATE.md` with:
   - Current phase status
   - What was completed in this stage
   - Artifacts created (spec files, skeleton files)
   - Next expected action
3. Validate the written file contains required headers: `## Phase:`, `## Verb:`, `## Target:`, `## Next Action:`

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

**Quick mode:** If QUICK_MODE=true and the verb is `create` or `update`, collapse Stages 1+2+3 into a single pass — run all three sequentially without stopping for approval between them. Present one combined summary at the end for a single approval gate. The verb reference files describe the individual stages — in quick mode, just run them back-to-back.

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
