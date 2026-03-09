---
description: Plan a Moku project — create, update, add plugins, or migrate existing code (3-stage gated workflow)
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
argument-hint: [create|update|add|migrate|resume] [type] ({path/link/github}) {requirements}
disable-model-invocation: true
---

## Project Configuration
!`if [ -f .claude/moku.local.md ]; then head -20 .claude/moku.local.md; fi`

Use configuration values above if present (maxParallelAgents, gapClosureMaxRounds, etc.). Otherwise use defaults: maxParallelAgents=3, gapClosureMaxRounds=2.

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

**CRITICAL:** Never use explicit generics on `createPlugin` — all types must be inferred from the spec object. See the moku-plugin skill for the rule and examples. Check every code example before showing to the user.

---

## Step 0: Parse Arguments

Parse `$ARGUMENTS` into four components: **VERB**, **TYPE**, **PATH_OR_LINK**, **REQUIREMENTS**.

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

Based on parsed VERB and TYPE, route to the appropriate flow:

| VERB | Route |
|------|-------|
| `resume` | Step 0.1 (read STATE.md, jump to recorded position) |
| `add` (plugin) | Step 0.7 — quick single-pass, self-contained |
| `update` (any) | Step 0.4 → Stage 2 → Stage 3 |
| `migrate` (any) | Step 0.3 → Step 0.5 → Step 0.6 → Stage 1 → Stage 2 → Stage 3 |
| `create` (any) | Step 0.5 → Step 0.6 → Stage 1 → Stage 2 → Stage 3 |

---

## Step 0.3: Migrate Existing Code

**This step runs when VERB is `migrate`.**

### Resolve Source

MIGRATE_PATH is set from PATH_OR_LINK:
- If PATH_OR_LINK was not provided, ask user for the path or URL.
- If PATH_OR_LINK starts with `http` or contains `github.com`, clone to a temp directory first:
  `git clone --depth 1 <URL> /tmp/moku-migrate-<hash>` and set MIGRATE_PATH to the clone path.
- TYPE from Step 0 determines migration focus: `framework` (extract plugins) or `app` (map to consumer composition).

### Prerequisites

1. Verify `MIGRATE_PATH` exists and contains a `package.json`:
   - If not: tell user "No package.json found at [path]. Provide a path to a Node/Bun project."
2. Verify clean git working tree:
   - Run `git status --porcelain` — if output is non-empty, warn: "You have uncommitted changes. Commit or stash before planning a migration."

### Research

Spawn **moku-researcher** agent with the tech stack, domain description, and key dependencies found at `MIGRATE_PATH`. The unfamiliar codebase needs ecosystem investigation. Research output is saved to `.planning/research.md`.

### Analysis

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/migrate-flows.md` for the from-existing analysis instructions. Execute all 5 sub-steps against the code at `MIGRATE_PATH`:

1. **Tech Stack Identification** — package.json, tsconfig, build tool, test framework, runtime
2. **Architecture Analysis** — directory structure, domain boundaries, entry points, state patterns, communication patterns
3. **Pattern Mapping** — map existing patterns to Moku concepts (singletons → plugins, EventEmitter → events, etc.)
4. **Domain-to-Plugin Mapping** — for each domain, propose: plugin name, tier, config, state, API, events, dependencies, lifecycle
5. **Gap Analysis** — identify what does not map cleanly (god modules, circular deps, side effects, global state)

### Save Context

Write analysis results to `.planning/decisions.md` using the Migration decisions.md Template from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-templates.md`. The file MUST include a `## Migration Type` header with `Flow: from-existing` so Step 0.5 detects it.

Log to user: "Migration analysis complete. Saved to `.planning/decisions.md`. Proceeding to Stage 1."

---

## Step 0.4: Update Existing Target

**This step runs when VERB is `update`.**

### Update Plugin (`update plugin {name} {changes}`)

1. Parse: first token of REQUIREMENTS is the plugin name, rest is the change description
2. Verify `src/plugins/{name}/` exists — if not, suggest `add plugin {name}` instead
3. Read existing plugin files: index.ts, types.ts, state.ts, api.ts, handlers.ts
4. Read `.planning/specs/*-{name}.md` if it exists (original spec)
5. Analyze current state: tier, config shape, state shape, API methods, events, dependencies
6. Compare against the change description to classify changes:
   - Config additions/modifications
   - New API methods
   - New/changed events
   - Dependency changes
   - Tier promotion (e.g., Micro → Standard)
   - Breaking changes to existing API
7. Present "Current vs Proposed" summary to user
8. If tier would change, flag explicitly
9. If breaking changes are needed, flag them with migration notes
10. Write updated spec to `.planning/specs/NN-{name}.md` (overwrite existing or create new)
11. Proceed to Stage 2 directly (skip Stage 1 — we already know the structure)

### Update App (`update app {changes}`)

1. Verify project is a consumer app (`createApp` in src/index.ts or src/main.ts)
2. Read existing app spec if exists (`.planning/app-spec.md`)
3. Read current entry point to understand plugin composition, config overrides, custom plugins
4. Compare against REQUIREMENTS to determine changes:
   - Add/remove plugins from composition
   - Change config overrides
   - Add/modify custom consumer plugins
   - New dependencies
5. Present change summary to user
6. Write updated app spec to `.planning/app-spec.md`
7. Proceed to Stage 2

### Update Framework (`update framework {changes}`)

1. Verify project is a framework (`src/config.ts` with `createCoreConfig`)
2. Read existing specs from `.planning/specs/` if they exist
3. Read current config.ts, index.ts, and plugin inventory
4. Compare against REQUIREMENTS — this may involve:
   - Adding new plugins (switch to `add plugin` flow for each)
   - Modifying existing plugin specs (per-plugin update analysis)
   - Changing framework-level config or events
5. Present change summary
6. Write updated specs as needed
7. Proceed to Stage 2

---

## Step 0.5: Optional Discussion Phase

**Migration context check:** If `.planning/decisions.md` exists and contains a `## Migration Type` header, skip the discussion phase entirely — migration analysis has already captured all necessary context. Log: "Migration context detected ([flow type]). Skipping discussion — using migration analysis from Step 0.3."

**This phase triggers when requirements are unclear.** If the user provides a clear, detailed description or an existing codebase to analyze, skip directly to Stage 1.

**When to trigger:**
- The description is vague (< 20 words, no specific domain details)
- The user asks a question rather than stating what to build
- The target domain is complex or has many possible interpretations

**Discussion process:**
1. Ask about the target domain and use case
2. Ask about tech preferences (runtime environment, deployment target)
3. Ask about scale expectations (how many plugins, team size)
4. Ask about non-functional requirements (performance targets, bundle size limits, browser support)
5. Ask about existing constraints (must integrate with X, can't use Y)

**Record decisions:** Write captured decisions to `.planning/decisions.md` using the template from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-templates.md` (section: decisions.md Template).

Present a summary and get approval before proceeding.

---

## Step 0.6: Optional Research Phase

**This phase triggers when planning a new domain** that would benefit from ecosystem investigation. Skip for well-understood domains, simple plugins, or when the user provides detailed specs.

**Migration note:** If Step 0.3 already ran, research was performed during migration analysis. Skip this phase to avoid redundant investigation. If `.planning/research.md` already exists, do not overwrite it.

**When to trigger:**
- Planning a framework in a domain the user hasn't specified libraries for
- The domain has multiple competing approaches (e.g., SSG, CMS, auth)
- Complex TypeScript patterns are likely needed

**Research process:**
1. Spawn the **moku-researcher** agent with the domain description and any decisions from Step 0.5
2. The agent investigates npm packages, TypeScript patterns, reference implementations, and pitfalls
3. Output is saved to `.planning/research.md`
4. Review the research results and incorporate relevant findings into Stage 1 analysis

The research output is available for the user to review but does NOT require a separate approval gate — it flows directly into Stage 1.

---

## Step 0.7: Add Plugin (Quick Single-Pass)

**This step runs when VERB is `add` and TYPE is `plugin`.**

This is a lightweight, single-session flow — plan, build, wire, and verify in one pass. It does NOT proceed to Stage 1/2/3 — it is self-contained.

### Prerequisites

1. Verify `src/config.ts` exists and contains `createCoreConfig` — if not: "This requires a Moku Framework project. Run `/moku:init` first."
2. Parse REQUIREMENTS: first word is plugin name, rest is description
3. If no name provided, ask: "What plugin do you want to add?"
4. Check `src/plugins/{name}/` doesn't already exist — if it does, suggest `update plugin {name}` instead

### Analyze Context

1. Read `src/config.ts` for Config and Events types
2. Read `src/index.ts` for existing plugins array and dependency order
3. Scan `src/plugins/*/index.ts` for existing plugin names, events, and APIs
4. If `.planning/specs/` exists, scan for relevant specs that mention this domain

From this analysis, determine:
- What existing plugins could this new plugin depend on?
- What events might it need to hook into?
- What events should it declare?
- Does it overlap with an existing plugin? (If yes, warn and suggest extending instead)

### Quick Spec

Present a compact specification to the user (NOT a full spec file — inline only):

```
Plugin: [name]
Tier: [Nano|Micro|Standard|Complex]
Description: [one-liner]
Dependencies: [list or none]
Config: [fields with defaults]
State: [fields or none]
API: [method signatures]
Events: [declared events or none]
Hooks: [events hooked or none]
Lifecycle: [onStart/onStop needs or "none — no resources to manage"]
```

Wait for user approval before proceeding. If the user wants changes, adjust and re-present.

### Build Plugin

Follow the plugin build process from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/build-plugin.md`:

1. Determine complexity tier from the spec
2. Create directory structure matching the tier
3. Implement all domain files (types.ts, state.ts, api.ts, handlers.ts as needed)
4. Write `index.ts` (~30 lines wiring, NO explicit generics on `createPlugin`)
5. Write unit tests + integration test
6. Write README.md
7. Full JSDoc on all exports

**Quality rules:**
- `import type` for type-only imports
- No explicit generics on `createPlugin`
- No unnecessary `onStart`/`onStop`
- Plugin index.ts is wiring only — no business logic

### Wire Into Framework

1. **Update `src/config.ts`**: Add new config fields and event types if needed
2. **Update `src/index.ts`**:
   - Import the new plugin
   - Add to the plugins array in correct dependency order
   - If it depends on other plugins, place it after them
3. **Update `src/index.ts` exports**: Ensure new plugin's API is accessible via `createApp`

### Verify

Run the verification chain:

1. `bun run format` — fix formatting
2. `bun run lint` — zero warnings
3. `bunx tsc --noEmit` — zero type errors
4. `bun run test` — all tests pass (existing + new)

If any check fails, fix the issue and re-run (max 2 gap-closure rounds).

Then spawn the **moku-verifier** agent on the new plugin to confirm Level 1 (exists), Level 2 (substantive), Level 3 (wired).

### Validation Pipeline (lightweight)

After the verifier confirms the plugin is wired correctly, run targeted validators:

1. **moku-plugin-spec-validator** — verify tier assessment, file organization, index.ts quality, JSDoc coverage
2. **moku-type-validator** — verify tsc --noEmit passes, no `as any`, import type compliance
3. **moku-jsdoc-validator** — verify all exports have JSDoc with @param, @returns, @example

Spawn all 3 in parallel. If any reports BLOCKER issues, fix and re-validate (max 1 round).
WARNINGs are included in the report but don't block completion.

### Report

Show the user:
- Files created (with tier assessment)
- Files modified (config.ts, index.ts)
- Verification results (format, lint, tsc, test)
- Plugin API summary (how to use it from consumer code)

### Update State (if active)

If `.planning/STATE.md` exists:
- Add the new plugin to the plugins table
- Update the wave grouping
- Note it was added via `/moku:plan add` (not planned via full workflow)

---

## Stage 1: Analysis + Structure

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-stages.md` for detailed Stage 1 instructions per target type (Framework, App, Plugin) and update targets.

**Migration context:** If `.planning/decisions.md` contains `## Migration Type`, use the migration analysis as the primary input for Stage 1. The `## Source Analysis` section provides the plugin inventory, `## Target Structure` provides the proposed layout, and type-specific sections (`## Breaking Changes`, `## New Features`, `## Domain Merges`, `## Event Mappings`, `## Config Mappings`) provide domain context. Treat these as pre-answered requirements — validate them against Moku constraints but do not re-ask.

**Summary**: Analyze requirements, identify plugins (with tiers, dependencies, events, lifecycle needs), enforce structure constraints, present tree diagram. Run **moku-plan-checker** agent before user gate. Update `.planning/STATE.md` on exit.

**Key rules across all targets:**
- Identify plugins with: name, tier, description, dependencies, events, start/stop needs
- Structure: only `src/config.ts`, `src/index.ts`, and `src/plugins/` — no other folders unless justified
- Run plan-checker before presenting to the user — fix BLOCKERs, show WARNINGs
- Write state on exit, wait for explicit user approval

---

## Stage 2: Specifications

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-stages.md` for detailed Stage 2 instructions per target type.
Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-templates.md` for the Plugin Specification Template, Application Specification Template, and STATE.md Template.

**Summary**: Create detailed specification files for each plugin/app. Framework specs go to `.planning/specs/01-[name].md` etc. App specs go to `.planning/app-spec.md`. Run validation loop (plan-checker + plugin-spec-validator + spec-validator) until zero BLOCKERs. Present specs, dependency graph, communication map, wave grouping, and implementation order. Update `.planning/STATE.md` on exit. Wait for explicit user approval.

---

## Stage 3: Skeleton + Verification

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-stages.md` for detailed Stage 3 instructions per target type.

**Summary**: Create skeleton files (empty types, function signatures, JSDoc headers — NO implementation). Includes `src/plugins/index.ts` barrel (plugin instances, helpers, namespaced types) and self-documenting `src/index.ts` (JSDoc module comment, grouped exports). Run verification loop: format → lint → tsc → build, fix all issues, loop until zero errors/warnings. Update `.planning/STATE.md` with verification results and set `Next Action` to `/moku:build #1`. Wait for explicit user approval.

---

## `.planning/STATE.md` Template

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-templates.md` for the full STATE.md template with all sections (Phase, Verb, Target, Completed checklist, Plugins table, Wave Grouping, Artifacts, Verification Results, Next Action).

After each plugin is built by `/moku:build`, update its `Build Status` to `done` and `Next Action` to the next plugin number. After all plugins are built: `Next Action → All plugins built. Run final integration tests.`

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
- After all stages complete, `Next Action` must point to `/moku:build #1` (first plugin by implementation order)
