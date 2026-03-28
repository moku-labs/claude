# Brainstorm Flow

Main flow coordinator for `/moku:brainstorm`. Receives context variables from the command: CATEGORY, NAME, DESCRIPTION, DEPTH_FLAG.

---

## Phase 1: Collaborative Analysis

Replace passive surveys with active analysis. Auto-detect everything possible, present findings proactively, and only ask the user about genuine architectural decisions that require human judgment.

**Principle:** You are a senior colleague brainstorming together — analyze, propose, demonstrate with code, give opinions. Never ask a question you can answer yourself.

### Phase 1a: Context Gathering & Auto-Analysis

**Goal:** Understand the problem space by reading code and context — not by asking the user questions an AI can answer.

#### For `create`:

1. **Parse DESCRIPTION** for:
   - Domain keywords (routing, auth, caching, rendering, etc.)
   - Capability mentions (count distinct capabilities → scope signal)
   - Integration keywords (API, database, WebSocket, OAuth, etc. → integration signal)
   - Quality indicators (prototype, production, public API, library → quality signal)

2. **Scan workspace context:**
   - If `src/plugins/` exists: read plugin names, events, APIs — understand the existing ecosystem
   - If `src/config.ts` exists: read Config and Events types — understand the framework shape
   - If `.planning/` exists: check for prior context files or specs that relate to DESCRIPTION
   - If `package.json` exists: read dependencies for existing integration patterns

3. **Assess domain novelty:**
   - Use Grep/Glob to check if the workspace has plugins covering similar domains
   - Check if DESCRIPTION maps to well-understood Moku patterns (CRUD, middleware, event bus) vs novel territory

4. **Compute complexity signals** (internal — not shown as raw numbers to user):
   - `domain_signal` (0–3): 0 = well-understood + existing precedent, 3 = genuinely novel
   - `scope_signal` (0–3): 0 = 1–3 capabilities, 1 = 4–6, 2 = 7–10, 3 = 10+
   - `integration_signal` (0–3): count of distinct integration types detected, capped at 3
   - `risk_signal` (0–3): 0 = standard patterns, 1 = some unknowns, 2 = complex type challenges, 3 = architectural uncertainty

#### For `modify` / `feature`:

1. **Read affected code:**
   - Identify which plugins DESCRIPTION refers to (Grep for name matches in `src/plugins/`)
   - Read each affected plugin: index.ts, types.ts, api.ts, handlers.ts
   - Read plugin dependencies (which other plugins depend on the affected ones?)
   - Read plugin events (which events might be affected?)

2. **Assess change scope:**
   - Count affected plugins (1 = isolated, 2–3 = cross-cutting, 4+ = architectural)
   - Check if public API signatures would change (breaking change risk)
   - Check test coverage: do affected plugins have `__tests__/` directories?

3. **Compute complexity signals:**
   - `scope_signal` (0–3): based on affected plugin count and dependency depth
   - `breaking_signal` (0–3): 0 = internal only, 1 = additive, 2 = minor breaks, 3 = major breaks
   - `uncertainty_signal` (0–3): based on how well the DESCRIPTION maps to existing code patterns
   - `coverage_signal` (0–3): 3 = no tests, 2 = minimal, 1 = partial, 0 = full coverage

#### For `migrate`:

1. **Get source path** — this is the ONE question that genuinely requires user input:

   Use `AskUserQuestion`:
   - Question: "Where is the code to migrate?"
   - Header: "Source"
   - Options:
     1. label: "Local path", description: "Enter a local directory path (e.g., ~/Projects/legacy-app)"
     2. label: "GitHub URL", description: "Enter a GitHub repository URL to clone"
   - multiSelect: false

   Resolve the path:
   - If URL: `git clone --depth 1 <URL> /tmp/moku-migrate-<hash>`, set MIGRATE_PATH to clone path
   - If local: verify it exists and contains `package.json`
   - Store MIGRATE_PATH for context file

2. **Lightweight source scan** (NOT the full 5-step plan analysis — just enough for complexity scoring and architectural discussion):
   - Read `package.json`: dependencies, scripts, entry points
   - Count source files and LOC (use `find` + `wc -l`)
   - Detect architecture pattern: look for directory structure (routes/, controllers/, middleware/, models/, etc.)
   - Detect state patterns: grep for Redux/Zustand/MobX imports, global singletons, mutable module state
   - Detect communication patterns: grep for EventEmitter, pub/sub, WebSocket, message bus patterns
   - Identify tech stack: framework, runtime, build tool, test framework

3. **Compute complexity signals:**
   - `size_signal` (0–3): 0 = <500 LOC, 1 = 500–2000, 2 = 2000–10000, 3 = 10000+
   - `gap_signal` (0–3): 0 = already plugin-based/modular, 1 = well-separated modules, 2 = tightly coupled, 3 = framework-specific patterns needing conceptual remapping
   - `state_signal` (0–3): count of distinct state management patterns detected, capped at 3
   - `risk_signal` (0–3): based on circular dependencies, god modules, side-effect imports detected

### Phase 1b: Present Assessment & Collaborative Discussion

**Goal:** Share your analysis like a colleague, then discuss only the decisions that genuinely need human judgment.

#### Step 1: Present Preliminary Assessment

Display a structured assessment to the user. This is NOT a question — it is you sharing your findings:

```
## Preliminary Assessment: {NAME}

**Category:** {CATEGORY}
**Domain:** {detected domain and context — e.g., "URL routing for a Moku web framework — established patterns exist (Express, Hono, Fastify), but Moku's plugin model requires a specific approach to route registration"}

**Scope:** {estimated scope — e.g., "~4–5 plugins needed: router-core, route-matching, middleware, guards, history"}

**Complexity signals:**
- {signal 1 with explanation — e.g., "Route matching involves complex TypeScript generics for type-safe path parameters"}
- {signal 2 — e.g., "Integration with browser History API adds platform-specific concerns"}
- {signal 3 — e.g., "Existing Moku event system maps well to route change notifications"}

**Initial approach direction:**
{1–2 sentences — your preliminary recommendation based on analysis}
```

For `migrate`, also include the source scan results:
```
**Source analysis:**
- Path: {MIGRATE_PATH}
- Tech stack: {framework, runtime, build tool}
- Size: {N files, ~N LOC}
- Architecture: {detected pattern — e.g., "Express middleware chain with 4 route files"}
- State: {detected patterns — e.g., "Module-level singletons for DB and cache connections"}
- Key challenge: {biggest migration obstacle — e.g., "Tightly coupled auth middleware needs splitting into separate auth and session plugins"}
```

#### Step 2: Identify Architectural Decisions

From your analysis, identify genuine architectural decisions — trade-offs where:
1. There is no obviously correct answer
2. The choice significantly affects the architecture
3. The answer cannot be auto-detected from the project
4. Different choices lead to meaningfully different code

**What is NOT a genuine architectural decision (never ask these):**
- "How large is your codebase?" — you already measured it
- "What's your timeline?" — irrelevant to architecture
- "What integrations do you need?" — you already detected them from DESCRIPTION
- "What's your quality bar?" — doesn't affect architectural choices
- "How novel is this domain?" — you already assessed it
- "How many capabilities?" — you already counted from DESCRIPTION
- Anything where one option is clearly superior for this specific project
- Anything the AI can answer by reading the code or DESCRIPTION

**If 0 decisions are identified:** This is fine and expected for well-understood domains or clear descriptions. Log: "No architectural ambiguities detected — the approach direction is clear from context." Skip directly to saving the analysis.

#### Step 3: Discuss Each Decision

For each identified decision, present it as a collaborative discussion. Every decision MUST include all of these elements — no exceptions:

1. **The trade-off framed clearly** — what is the tension?
2. **2–3 concrete approaches with TypeScript code examples** — show how each would look in Moku plugin code (5–15 lines each)
3. **Your recommendation with reasoning** — take a clear position, do not be neutral
4. **Concerns about each alternative** — what could go wrong with each choice?

**Format:** Present the full discussion context as a text message, then follow with `AskUserQuestion`:

````markdown
### Decision {N}: {title}

{1–2 sentences framing the trade-off}

**Option A: {name} (Recommended)**
```typescript
// Concrete code showing this approach in Moku context
{code example — 5–15 lines showing the API, usage pattern, or architecture}
```
- Why: {concrete benefit for THIS project}
- Concern: {specific risk or limitation}

**Option B: {name}**
```typescript
// Same scenario, different approach
{code example}
```
- Why: {when this would be the better choice}
- Concern: {specific risk or limitation}

**I recommend Option A** because {specific reasoning tied to THIS project's context, not generic advice}. If we go with Option B, the main risk is {consequence}.
````

Then use `AskUserQuestion`:
- Question: "{decision title}"
- Header: "Decision {N}"
- Options: one per approach, the recommended one first and marked "(Recommended)". Add a final option: "Neither — let me explain" with description "I have a different approach in mind"
- multiSelect: false

If user selects "Neither — let me explain": incorporate their approach as the chosen direction.

**Examples of GOOD decisions to surface:**

For a `create` router framework:
- "Should route handlers receive the full Moku context or a scoped subset?" (affects plugin boundary design)
- "File-based routing vs config-based routing vs code-based registration?" (affects developer experience fundamentally)

For a `modify` adding caching:
- "Cache invalidation: TTL-based, event-driven, or manual?" (each produces different plugin dependency shapes)
- "Should the cache plugin own its storage or delegate to a storage plugin?" (affects coupling)

For a `migrate` Express app:
- "Should Express middleware be mapped 1:1 to Moku plugins, or consolidated by domain?" (affects plugin count and granularity)
- "How should the shared request context object be decomposed into plugin state?" (affects state isolation)

### Save Analysis

After Phase 1 completes, save the full analysis to `.planning/brainstorm-{NAME}-analysis.md`:

```markdown
# Brainstorm Analysis: {NAME}

## Category
{CATEGORY}

## Description
{DESCRIPTION}

## Auto-Detected Context
{summary of Phase 1a findings — domain, workspace context, novelty assessment}

## Complexity Signals
- Signal 1: {name} — {description} ({score}/3)
- Signal 2: {name} — {description} ({score}/3)
- Signal 3: {name} — {description} ({score}/3)
- Signal 4: {name} — {description} ({score}/3)
- Raw sum: {N}/12

## Architectural Decisions
{for each decision made in Phase 1b:}
### {Decision title}
- Chosen: {option name}
- Rejected: {alternative names}
- Rationale: {why, including user's input}
- Code direction: {brief summary of what the chosen approach means for implementation}

{if 0 decisions: "No architectural decisions required — context was clear from analysis."}

## Migration Source (migrate only)
- Path: {MIGRATE_PATH}
- Tech stack: {framework, runtime, build tool, test framework}
- Architecture: {detected pattern}
- Size: {file count, LOC}
- State patterns: {detected patterns}
- Communication patterns: {detected patterns}
- Key challenges: {obstacles for Moku migration}
```

---

## Phase 2: Complexity Scoring

The complexity score is computed from the auto-detected signals in Phase 1a — the user is NOT asked to self-report complexity.

```
raw_sum = sum of all 4 complexity signal scores (each 0–3)
raw_max = 12
COMPLEXITY_SCORE = round((raw_sum / raw_max) * 9)
```

Apply DEPTH_FLAG override:
- If DEPTH_FLAG is `deep`: EFFECTIVE_DEPTH = `deep` regardless of score
- If DEPTH_FLAG is `quick`: EFFECTIVE_DEPTH = `quick` regardless of score
- If DEPTH_FLAG is `auto`:
  - Score 0–3: EFFECTIVE_DEPTH = `quick`
  - Score 4–6: EFFECTIVE_DEPTH = `standard`
  - Score 7–9: EFFECTIVE_DEPTH = `deep`

Report to user: "Complexity score: {COMPLEXITY_SCORE}/9 → **{EFFECTIVE_DEPTH}** mode. {cite the specific signals that drove the score — e.g., 'High domain novelty and multiple integration points pushed this into deep mode.'}."

Briefly explain the depth:
- `quick`: "Quick research pass, 1 debate round. Good for well-understood domains."
- `standard`: "Moderate research with 2 angles, 2 debate rounds. Balances speed and thoroughness."
- `deep`: "Parallel deep research from 3 angles, 3 debate rounds. For novel or high-risk projects."

If DEPTH_FLAG was `auto` (no override), ask the user to confirm:
`AskUserQuestion`:
- Question: "Proceed with {EFFECTIVE_DEPTH} mode?"
- Header: "Depth"
- Options:
  1. "{EFFECTIVE_DEPTH} mode (Recommended)" — description: "{depth explanation from above}"
  2. "Switch to quick" — description: "Skip deep research, 1 debate round" (only if not already quick)
  3. "Switch to deep" — description: "Full parallel research, 3 debate rounds" (only if not already deep)
- multiSelect: false

Set EFFECTIVE_DEPTH based on user's choice.

---

## Phase 3: Research

### Agent Configuration by Depth

| Depth | Researcher count | Research focuses |
|---|---|---|
| `quick` | 1 | "full domain survey" (single comprehensive pass) |
| `standard` | 2 (parallel) | "ecosystem + existing solutions" AND "technical patterns + risks" |
| `deep` | 3 (parallel) | "ecosystem + existing solutions" AND "technical patterns + risks" AND category-specific focus |

**Category-specific focus for 3rd researcher (deep mode only):**
- `create` → "greenfield architecture options and plugin boundary design for {DESCRIPTION}"
- `modify`/`feature` → "feature integration patterns, cross-plugin impact, and regression risk for {DESCRIPTION}"
- `migrate` → "migration strategy patterns and common failure modes for the source architecture"

### Spawning Researchers

Spawn brainstorm-researcher agents using the `Agent` tool. For standard and deep modes, spawn all agents **in parallel** (multiple Agent tool calls in the same response).

Each researcher prompt must include:
1. The FOCUS parameter (ecosystem / technical-patterns / category-specific)
2. The DESCRIPTION
3. The CATEGORY
4. The analysis summary (from `.planning/brainstorm-{NAME}-analysis.md`) — this provides richer context including auto-detected signals and architectural decisions made with the user
5. The output path: `.planning/brainstorm-{NAME}-research-{focus-slug}.md`

### Merging Research

After all researcher agents complete:
1. Read all research output files
2. Merge into a single `.planning/brainstorm-{NAME}-research.md`:
   - Combine Key Findings from all researchers (deduplicate similar findings)
   - Merge Approach Options (remove duplicates, max 3)
   - Combine Risks & Gotchas (deduplicate, keep highest severity)
   - Select the single strongest Recommended Starting Point across all researchers
3. If any researcher returned FAIL verdict, note the gap but proceed — partial research is better than no research

---

## Phase 4: Route to Debate

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/brainstorm-debate.md` and follow it.

Context carried forward: CATEGORY, NAME, DESCRIPTION, EFFECTIVE_DEPTH, COMPLEXITY_SCORE, all `.planning/brainstorm-{NAME}-*` files.
