---
description: Plan a framework, consumer app, or plugin (3-stage gated workflow)
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
argument-hint: [framework|app|plugin] [description-or-path]
disable-model-invocation: true
---

## Project Configuration
!`if [ -f .claude/moku.local.md ]; then head -20 .claude/moku.local.md; fi`

Use configuration values above if present (maxParallelAgents, gapClosureMaxRounds, etc.). Otherwise use defaults: maxParallelAgents=3, gapClosureMaxRounds=2.

Create a specification plan for a Moku project. The input (`$ARGUMENTS`) can be:

- `framework "A static site generator"` — explicit framework target with description
- `app "A personal blog"` — explicit consumer app target
- `plugin auth` — explicit plugin target
- `"A static site generator"` — auto-detect target from working directory
- A path to existing code to migrate to Moku Core

This command runs as a **3-stage gated workflow** with optional discussion, optional research, and plan validation. Each stage ends with a user checkpoint — the user must explicitly approve before proceeding to the next stage.

**CRITICAL:** Never use explicit generics on `createPlugin` — all types must be inferred from the spec object. See the moku-plugin skill for the rule and examples. Check every code example before showing to the user.

---

## Step 0: Detect Target

Parse `$ARGUMENTS`:
1. If the first word is exactly `framework`, `app`, or `plugin` — use it as the target. The rest is the description or path.
2. If no explicit target keyword, auto-detect from the working directory:
   a. `src/config.ts` exists AND contains `createCoreConfig` → **framework**
   b. `package.json` depends on a Moku framework package (not `@moku-labs/core` directly) → **app**
   c. Argument looks like a plugin name or spec reference → **plugin**
3. If still unclear — ask the user: "What are you planning? A framework, consumer app, or plugin?"

### Resume from State

Before starting fresh, check if `.planning/STATE.md` exists:
- If it does, read it to understand the current project position
- Present the state to the user: "I found an existing plan state. Resume from [phase] or start fresh?"
- If resuming, skip to the appropriate stage

### State Persistence Protocol

Every stage reads `.planning/STATE.md` at the start and writes it at the end. This enables:
- Resuming from any stage in a fresh context window
- Running a single stage without re-running previous ones
- Tracking exactly what has been completed and approved

**On stage entry:**
1. Read `.planning/STATE.md`
2. Verify the previous stage is marked as approved
3. Load context: target type, decisions, plugin table, wave grouping

**On stage exit (before user gate):**
1. Back up current state: copy `.planning/STATE.md` to `.planning/STATE.md.bak` before overwriting
2. Update `.planning/STATE.md` with:
   - Current phase status
   - What was completed in this stage
   - Artifacts created (spec files, skeleton files)
   - Next expected action
3. Validate the written file contains required headers: `## Phase:`, `## Target:`, `## Next Action:`

---

## Step 0.5: Optional Discussion Phase

**Migration context check:** If `.planning/decisions.md` exists and contains a `## Migration Type` header, skip the discussion phase entirely — migration analysis has already captured all necessary context. Log: "Migration context detected ([flow type]). Skipping discussion — using analysis from `/moku:migrate`."

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

## Stage 1: Analysis + Structure

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-stages.md` for detailed Stage 1 instructions per target type (Framework, App, Plugin).

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

**Summary**: Create detailed specification files for each plugin/app. Framework specs go to `specifications/01-[name].md` etc. App specs go to `.planning/app-spec.md`. Run validation loop (plan-checker + plugin-spec-validator + spec-validator) until zero BLOCKERs. Present specs, dependency graph, communication map, wave grouping, and implementation order. Update `.planning/STATE.md` on exit. Wait for explicit user approval.

---

## Stage 3: Skeleton + Verification

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-stages.md` for detailed Stage 3 instructions per target type.

**Summary**: Create skeleton files (empty types, function signatures, JSDoc headers — NO implementation). Run verification loop: format → lint → tsc → build, fix all issues, loop until zero errors/warnings. Update `.planning/STATE.md` with verification results and set `Next Action` to `/moku:build #1`. Wait for explicit user approval.

---

## `.planning/STATE.md` Template

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-templates.md` for the full STATE.md template with all sections (Phase, Target, Completed checklist, Plugins table, Wave Grouping, Artifacts, Verification Results, Next Action).

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
