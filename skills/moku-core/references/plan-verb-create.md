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
   - `## Primary User` ← from `## Analysis Summary` section (scope assessment)
   - `## MVP Priorities` ← from CONTEXT_PLUGINS_HINT (top 3 if available) or first 3 key capabilities from CONTEXT_SUMMARY
   - `## Reference Point` ← from `## Research Findings > Ecosystem Landscape` (first reference project mentioned)
   - `## Biggest Risk` ← first item from CONTEXT_RISKS
   - `## CI/CD` ← not available from brainstorm context. After writing the synthesized steering.md, present the CI/CD question to the user using the **two-turn pattern** from the Deliberative Steering Protocol: first output the WHY/EXAMPLE/RECOMMENDATION text from Question 6, then call `AskUserQuestion` with Question 6's options in the NEXT response turn. This is the one steering question NOT skippable via context injection, since brainstorm does not cover CI/CD choices. If the user has already answered this in a previous session (`.planning/steering.md` already has a `## CI/CD` section), skip it.
   Write this synthesized `steering.md` to `.planning/steering.md`.
5. **Feed-forward into later stages:**
   - **Discussion phase**: If triggered, pre-populate with CONTEXT_DECISIONS so the user confirms rather than re-derives. If CONTEXT_DECISIONS covers the domain sufficiently, skip the discussion phase: log "Context file provides sufficient discussion context. Skipping Discussion Phase."
   - **Research phase**: If CONTEXT_FILE `## Research Findings` section exists and is non-empty, skip the research phase: log "Context file includes research findings. Skipping Research Phase." Write the research findings to `.planning/research.md` so Stage 1 can reference them.
   - **Stage 1**: CONTEXT_PLUGINS_HINT is treated as a starting plugin inventory suggestion — validate against Moku constraints but do not re-derive from scratch. Show the user the suggested plugins and ask for confirmation/additions. **When reordering plugins from CONTEXT_PLUGINS_HINT to reflect wave assignments**, log the reordering decision: "Reordered [plugin-a] before [plugin-b] to group Wave 0 plugins together." This makes the ordering change visible rather than silent (context files and spec files may otherwise have confusingly different numbering).
   - **Stage 2**: CONTEXT_RISKS are injected into spec writing — the plugin closest to each risk gets an explicit risk mitigation note in its spec.

If CONTEXT_FILE is `(none)`: proceed normally to the Steering Pre-Phase below.

---

## Steering Pre-Phase

**This phase runs ALWAYS for the `create` verb** — before discussion, before research, before Stage 1. It catches wrong assumptions at the source with focused, deliberative questions. Each question is presented one at a time with full context, explanation, and recommendation. The user can discuss each decision before committing.

**Skip this phase when:**
- CONTEXT_FILE is set (brainstorm context was injected above — steering is synthesized from it)
- VERB is `migrate` and migration analysis has already run (`.planning/decisions.md` contains `## Migration Type`)
- `.planning/steering.md` already exists (steering was done in a previous session) — log: "Steering already captured. Skipping." and proceed.

**Partial resume:** If `.planning/steering.md` exists but is incomplete (missing one or more of the 6 required sections below), log which sections are already captured and skip to the first missing question. This enables session-drop recovery mid-steering.

### Deliberative Steering Protocol

Process questions **one at a time** using the following loop for each question:

```
for each QUESTION in STEERING_QUESTIONS:
  1. RELEVANCE CHECK — evaluate whether this question is still relevant
     given prior answers. If not relevant, skip with a log message
     explaining why (e.g., "Skipping reference point — prior answers
     already established this is a novel domain with no close reference").
  2. PRESENT — show the user:
     a. WHY this matters: 1–2 sentences explaining how the answer shapes the plan
     b. EXAMPLE: concrete example of how different answers lead to different plans
     c. RECOMMENDATION: your best guess based on REQUIREMENTS + prior answers,
        with brief reasoning
  3. ASK — use AskUserQuestion with contextual options
  4. DISCUSS — if user selects "Help me decide" or asks follow-up questions:
     engage in free-form discussion. Offer alternative angles, challenge
     assumptions, explain trade-offs. Continue until user signals readiness.
     Then re-present the AskUserQuestion.
  5. RECORD — write the answer to `.planning/steering.md` immediately
     (incremental save — each answer persists before moving to the next)
  6. NEXT — proceed to the next question
```

**Important:** The two-turn pattern applies here — present the explanation/example/recommendation as text output first, then call `AskUserQuestion` in the NEXT response turn. This prevents the dialog overlay from obscuring the context above.

### Steering Questions

**Question 1: Scope Boundary**

- **Why this matters:** "Defining what's OUT of scope prevents the plan from growing uncontrollably. Without explicit boundaries, analysis tends to add plugins for every conceivable feature."
- **Example:** "For a static site generator: if you exclude 'No client-side routing', the plan will focus on build-time rendering with static HTML output. If you include routing, it shifts toward an SPA-like architecture with a router plugin, which changes the entire plugin graph."
- **Recommendation:** Generate 2–3 contextual boundaries based on REQUIREMENTS and explain why each is a reasonable exclusion.
- `AskUserQuestion`:
  - Question: "What should this project explicitly NOT do?"
  - Header: "Boundaries"
  - Options: Generate 3–4 contextual anti-scope options based on REQUIREMENTS (e.g., for a static site generator: "No client-side routing" / "No database layer" / "No user authentication" / "No build-time bundling"). Always include "Help me decide — discuss options" and "Other — I'll describe".
  - multiSelect: true

**Question 2: Primary User**

- **Why this matters:** "The audience determines API style, error message quality, documentation depth, and which plugins to prioritize. A developer-facing framework needs excellent types and composability. An end-user app needs polished UX and error recovery."
- **Example:** "Developer audience → plugins expose composable APIs, config is flexible, errors include stack traces. End-user audience → plugins focus on UX, config has smart defaults, errors are user-friendly."
- **Recommendation:** Infer from REQUIREMENTS and TYPE (framework → likely developers, app → likely end users).
- **Relevance check:** Always relevant — no prior answer makes this redundant.
- `AskUserQuestion`:
  - Question: "Who is the primary user of this project?"
  - Header: "Audience"
  - Options: "Developers (library/framework consumers)" / "End users (direct interaction)" / "Both developers and end users" / "Internal team only" / "Help me decide"
  - multiSelect: false

**Question 3: MVP Scope**

- **Why this matters:** "Your top 3 capabilities become high-priority plugins assigned to Wave 1 — built and verified first. Everything else is Wave 2+. This focuses the plan on what matters most for a working first version."
- **Example:** Based on REQUIREMENTS + prior answers, show: "For a roguelike with 'End users' audience and 'No multiplayer' boundary: Rendering, Input handling, and Procedural generation form the minimum playable loop — you can navigate a generated dungeon. Audio and save/load are nice-to-have for Wave 2."
- **Recommendation:** Propose exactly 3 capabilities with reasoning tied to prior answers.
- **Relevance check:** Always relevant.
- `AskUserQuestion`:
  - Question: "If you could only ship 3 capabilities, which would they be?"
  - Header: "MVP priorities"
  - Options: Generate 5–6 contextual capability options derived from REQUIREMENTS. Always include "Help me decide" and "Other".
  - multiSelect: true (user picks exactly 3)

**Question 4: Mental Model / Reference Point**

- **Why this matters:** "A reference project calibrates complexity expectations. Saying 'like Astro' tells the plan to expect SSG patterns, island architecture, and a build pipeline. Saying 'like Express' implies middleware chains and request/response patterns. This prevents the plan from inventing novel architecture when a proven pattern exists."
- **Example:** "If your reference is Astro → the plan will model content loading, component rendering, and static output as separate plugins. If your reference is Vite → the plan will focus on module resolution, HMR, and plugin hooks."
- **Recommendation:** Suggest 1–2 reference projects based on REQUIREMENTS + TYPE + boundaries.
- **Relevance check:** If boundaries or MVP priorities already strongly imply a specific architecture pattern, note that in the explanation and ask if the user still wants to specify a reference, or if the implied direction is correct.
- `AskUserQuestion`:
  - Question: "What existing tool or project is closest to what you want?"
  - Header: "Reference point"
  - Options: Generate 3–4 contextual reference projects based on REQUIREMENTS and TYPE. Always include "None — this is novel" and "Help me decide".
  - multiSelect: false

**Question 5: Technical Risk**

- **Why this matters:** "The biggest risk gets explicit mitigation in the spec of the most related plugin. If you flag 'type safety across plugin boundaries', the plan will add extra type tests and stricter generics. If you flag 'performance at scale', it will add benchmarks and lazy-loading patterns."
- **Example:** "For a plugin-based framework: 'Type safety across boundaries' → the router plugin spec will include type-level tests ensuring route params propagate correctly through the event system."
- **Recommendation:** Identify the most likely risk based on REQUIREMENTS, TYPE, boundaries, and reference point.
- **Relevance check:** If the reference point is a well-proven pattern (e.g., "like Express"), risk may be lower — note this but still ask.
- `AskUserQuestion`:
  - Question: "What's the biggest technical risk or uncertainty?"
  - Header: "Risks"
  - Options: Generate 3–4 contextual risk options based on REQUIREMENTS and prior answers. Always include "I'm not sure yet" and "Help me decide".
  - multiSelect: false

**Question 6: CI/CD and Distribution**

- **Why this matters:** "This determines what CI/CD workflows the build generates at the end. Choosing now ensures the plan includes any infrastructure plugins or configuration needed upfront, rather than bolting them on after the build."
- **Example:** "For a framework published to npm: PR validation ensures every contributor's code passes lint + types + tests. npm publish on tag automates releases. Without these, you'll need to set them up manually after the build."
- **Recommendation:** Contextual based on TYPE: framework/library → PR validation + npm publish + GitHub Releases. App → PR validation + coverage gate. Game → PR validation only (unless targeting a platform store).
- **Relevance check:** Always relevant for `create`. If boundaries exclude distribution (e.g., "internal only"), adjust recommendations accordingly.
- `AskUserQuestion`:
  - Question: "What CI/CD and distribution do you need?"
  - Header: "CI/CD"
  - Options:
    1. "PR validation (Recommended)" — description: "Lint + type-check + tests on every pull request"
    2. "Coverage gate" — description: "Block PRs that drop below coverage threshold"
    3. "npm publish" — description: "Auto-publish to npm registry on version tag"
    4. "GitHub Releases" — description: "Create GitHub Release with changelog on version tag"
    5. "Container build" — description: "Dockerfile + registry push on release"
    6. "None — I'll set up CI later" — description: "Skip CI/CD generation entirely"
    7. "Help me decide"
  - multiSelect: true

### Record Steering Results

After all questions are answered (or as each is answered incrementally), the final `.planning/steering.md` should contain:

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

## CI/CD
- [selected option 1]
- [selected option 2]
```

### How Steering Feeds Forward

- **Boundaries** → Stage 1 uses these to REJECT plugins that fall outside scope. If analysis identifies a plugin that conflicts with a stated boundary, flag it and ask.
- **MVP Priorities** → Stage 1 marks the top-3 capabilities as `priority: high` in the plugin table. These plugins get Wave 1 assignment when possible.
- **Reference Point** → Stage 1 uses this to calibrate complexity expectations (e.g., "like Astro" implies SSG patterns, island architecture).
- **Risk** → Stage 2 adds explicit mitigation to the spec of the plugin most related to the stated risk.
- **CI/CD** → Build Step 5.10 reads these choices to generate the appropriate GitHub Actions workflows, Dockerfiles, and publish configuration.

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
