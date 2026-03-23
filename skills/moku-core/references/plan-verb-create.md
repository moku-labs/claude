# Plan Verb: Create New Project

**This flow runs for `create` (and for `migrate` after migration analysis).**

## Context Injection Pre-Phase

**This phase runs BEFORE the Steering Pre-Phase when CONTEXT_FILE is set** (i.e., the user provided `--context` from a `/moku:brainstorm` session).

If CONTEXT_FILE is not `(none)`:
1. Read `{CONTEXT_FILE}`
2. Extract and store context variables:
   - CONTEXT_SUMMARY: contents of `## Summary` section
   - CONTEXT_ASSUMPTIONS: contents of `## Key Assumptions` subsection within `## Proposed Approach`
   - CONTEXT_NON_GOALS: contents of `## Explicit Non-Goals` subsection
   - CONTEXT_DECISIONS: contents of `## Decisions Made` table
   - CONTEXT_RISKS: contents of `## Risks Requiring Spec Attention` section
   - CONTEXT_PLUGINS_HINT: contents of the `### Suggested Plugins (Preliminary)` subsection under `## Recommended Plan Approach` (may be empty or "deferred")
3. **Skip the Steering Pre-Phase entirely.** The brainstorm session has already captured equivalent information. Log: "Brainstorm context detected at `{CONTEXT_FILE}`. Skipping Steering Pre-Phase."
4. Synthesize a `steering.md` from the context file so downstream stages find their expected input:
   - `## Boundaries (NOT in scope)` ← from CONTEXT_NON_GOALS
   - `## Primary User` ← from `## Discovery Answers` section (scope/audience answer)
   - `## MVP Priorities` ← from CONTEXT_PLUGINS_HINT (top 3 if available) or first 3 key capabilities from CONTEXT_SUMMARY
   - `## Reference Point` ← from `## Research Findings > Ecosystem Landscape` (first reference project mentioned)
   - `## Biggest Risk` ← first item from CONTEXT_RISKS
   Write this synthesized `steering.md` to `.planning/steering.md`.
5. **Feed-forward into later stages:**
   - **Discussion phase**: If triggered, pre-populate with CONTEXT_DECISIONS so the user confirms rather than re-derives. If CONTEXT_DECISIONS covers the domain sufficiently, skip the discussion phase: log "Context file provides sufficient discussion context. Skipping Discussion Phase."
   - **Research phase**: If CONTEXT_FILE `## Research Findings` section exists and is non-empty, skip the research phase: log "Context file includes research findings. Skipping Research Phase." Write the research findings to `.planning/research.md` so Stage 1 can reference them.
   - **Stage 1**: CONTEXT_PLUGINS_HINT is treated as a starting plugin inventory suggestion — validate against Moku constraints but do not re-derive from scratch. Show the user the suggested plugins and ask for confirmation/additions.
   - **Stage 2**: CONTEXT_RISKS are injected into spec writing — the plugin closest to each risk gets an explicit risk mitigation note in its spec.

If CONTEXT_FILE is `(none)`: proceed normally to the Steering Pre-Phase below.

---

## Steering Pre-Phase

**This phase runs ALWAYS for the `create` verb** — before discussion, before research, before Stage 1. It catches wrong assumptions at the source with 3–5 pointed questions. Takes < 2 minutes.

**Skip this phase when:**
- CONTEXT_FILE is set (brainstorm context was injected above — steering is synthesized from it)
- VERB is `migrate` and migration analysis has already run (`.planning/decisions.md` contains `## Migration Type`)
- `.planning/steering.md` already exists (steering was done in a previous session) — log: "Steering already captured. Skipping." and proceed.

**Steering questions — ask ALL of these using `AskUserQuestion`:**

1. **Scope boundary** — use `AskUserQuestion`:
   - Question: "What should this project explicitly NOT do? (This prevents scope creep in the plan)"
   - Header: "Boundaries"
   - Options: Generate 3–4 contextual anti-scope options based on REQUIREMENTS (e.g., for a static site generator: "No client-side routing" / "No database layer" / "No user authentication" / "No build-time bundling"). Always include a custom "Other — I'll describe" option.
   - multiSelect: true

2. **Primary user** — use `AskUserQuestion`:
   - Question: "Who is the primary user of this project?"
   - Header: "Audience"
   - Options: "Developers (library/framework consumers)" / "End users (direct interaction)" / "Both developers and end users" / "Internal team only"
   - multiSelect: false

3. **MVP scope** — use `AskUserQuestion`:
   - Question: "If you could only ship 3 capabilities, which would they be?"
   - Header: "MVP priorities"
   - Options: Generate 5–6 contextual capability options derived from REQUIREMENTS (e.g., for a game engine: "Rendering pipeline" / "Input handling" / "Physics simulation" / "Audio system" / "Asset loading" / "Networking"). Always include a custom "Other" option.
   - multiSelect: true (user picks exactly 3)

4. **Mental model** — use `AskUserQuestion`:
   - Question: "What existing tool or project is closest to what you want? (Helps align expectations)"
   - Header: "Reference point"
   - Options: Generate 3–4 contextual reference projects based on REQUIREMENTS and TYPE (e.g., for a static site generator: "Astro" / "Eleventy" / "Hugo" / "None — this is novel"). Always include "None — this is novel".
   - multiSelect: false

5. **Risk** — use `AskUserQuestion`:
   - Question: "What's the biggest technical risk or uncertainty in this project?"
   - Header: "Risks"
   - Options: "Type safety across plugin boundaries" / "Performance at scale" / "Complex async coordination" / "Third-party integration reliability" / "I'm not sure yet"
   - multiSelect: false

**Record steering results:** Write to `.planning/steering.md`:

```markdown
# Steering

## Boundaries (NOT in scope)
- [boundary 1]
- [boundary 2]

## Primary User
[audience]

## MVP Priorities (top 3)
1. [capability 1]
2. [capability 2]
3. [capability 3]

## Reference Point
[closest existing project, or "Novel — no close reference"]

## Biggest Risk
[risk description]
```

**How steering feeds forward:**
- **Boundaries** → Stage 1 uses these to REJECT plugins that fall outside scope. If analysis identifies a plugin that conflicts with a stated boundary, flag it and ask.
- **MVP Priorities** → Stage 1 marks the top-3 capabilities as `priority: high` in the plugin table. These plugins get Wave 1 assignment when possible.
- **Reference Point** → Stage 1 uses this to calibrate complexity expectations (e.g., "like Astro" implies SSG patterns, island architecture).
- **Risk** → Stage 2 adds explicit mitigation to the spec of the plugin most related to the stated risk.

---

## Optional Discussion Phase

**Migration context check:** If `.planning/decisions.md` exists and contains a `## Migration Type` header, skip the discussion phase entirely — migration analysis has already captured all necessary context. Log: "Migration context detected ([flow type]). Skipping discussion — using migration analysis."

**This phase triggers when requirements are unclear.** If the user provides a clear, detailed description or an existing codebase to analyze, skip directly to Stage 1.

**When to trigger:**
- The description is vague (< 20 words, no specific domain details)
- The user asks a question rather than stating what to build
- The target domain is complex or has many possible interpretations

**Discussion process — use `AskUserQuestion` for structured choices:**

1. Domain and use case — use `AskUserQuestion`:
   - Question: "What is the primary use case for this framework?"
   - Header: "Use case"
   - Options: contextual options based on the description (e.g., "Static site generator" / "SPA framework" / "Build tool" / "Game engine")
   - multiSelect: false

2. Runtime environment — use `AskUserQuestion`:
   - Question: "What runtime environment are you targeting?"
   - Header: "Runtime"
   - Options: "Browser" / "Node.js" / "Bun" / "Universal (browser + server)"
   - multiSelect: false

3. Scale and constraints — use `AskUserQuestion` with multiSelect:
   - Question: "Which constraints apply to your project?"
   - Header: "Constraints"
   - Options: "Small bundle size (<10KB)" / "SSR/SSG support" / "Plugin ecosystem for third parties" / "Strict TypeScript (no any)"
   - multiSelect: true

4. For open-ended details not covered by structured choices, use direct conversation.

**Record decisions:** Write captured decisions to `.planning/decisions.md` using the template from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-templates.md` (section: decisions.md Template).

Use `AskUserQuestion` to confirm before proceeding:
- Question: "Discussion complete. Does this capture your requirements?"
- Header: "Confirm"
- Options: "Yes, proceed to analysis (Recommended)" / "No, I have more to add"
- multiSelect: false

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
