# Plan Verb: Create New Project

**This flow runs for `create` (and for `migrate` after migration analysis).**

## Optional Discussion Phase

**Migration context check:** If `.planning/decisions.md` exists and contains a `## Migration Type` header, skip the discussion phase entirely — migration analysis has already captured all necessary context. Log: "Migration context detected ([flow type]). Skipping discussion — using migration analysis."

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

## Optional Research Phase

**This phase triggers when planning a new domain** that would benefit from ecosystem investigation. Skip for well-understood domains, simple plugins, or when the user provides detailed specs.

**Migration note:** If migration analysis already ran, research was performed during that step. Skip this phase to avoid redundant investigation. If `.planning/research.md` already exists, do not overwrite it.

**When to trigger:**
- Planning a framework in a domain the user hasn't specified libraries for
- The domain has multiple competing approaches (e.g., SSG, CMS, auth)
- Complex TypeScript patterns are likely needed

**Research process:**
1. Spawn the **moku-researcher** agent with the domain description and any decisions from the discussion phase
2. The agent investigates npm packages, TypeScript patterns, reference implementations, and pitfalls
3. Output is saved to `.planning/research.md`
4. Review the research results and incorporate relevant findings into Stage 1 analysis

The research output is available for the user to review but does NOT require a separate approval gate — it flows directly into Stage 1.

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

## Stage 3: Skeleton Specification

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-stages.md` for detailed Stage 3 instructions per target type.

**Summary**: Produce `.planning/skeleton-spec.md` — a specification document (NOT actual source files) containing: architecture overview, complete file structure, system connections, skeleton build waves with ready-to-paste code blocks per file, and verification checklist. Update `.planning/STATE.md` with `## Skeleton: not-started` and Wave Progress rows for skeleton waves. Set `Next Action: Run /moku:build resume (skeleton build will run first)`. Wait for explicit user approval.

---

## `.planning/STATE.md` Template

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-templates.md` for the full STATE.md template with all sections (Phase, Verb, Target, Completed checklist, Plugins table, Wave Grouping, Artifacts, Verification Results, Next Action).

After each plugin is built by `/moku:build`, update its `Build Status` to `done` and `Next Action` to the next plugin number. After all plugins are built: `Next Action → All plugins built. Run final integration tests.`
