# Brainstorm Flow

Main flow coordinator for `/moku:brainstorm`. Receives context variables from the command: CATEGORY, NAME, DESCRIPTION, DEPTH_FLAG.

---

## Phase 1: Discovery Questions

Load the appropriate question set based on CATEGORY, ask all questions using `AskUserQuestion`, and compute the complexity score.

### Question Set: `create`

**Q1 — Domain novelty** (Header: "Novelty", multiSelect: false)
- Question: "How novel is the domain you're building in?"
- Options:
  1. "Well-understood domain" — description: "Established patterns exist (e.g., auth, routing, CRUD, CMS)" → score: 0
  2. "Known domain, unusual twist" — description: "Standard domain but with non-standard constraints or requirements" → score: 1
  3. "Domain new to Moku" — description: "No existing Moku framework covers this space" → score: 2
  4. "Genuinely novel problem" — description: "Few existing solutions, significant design exploration needed" → score: 3

**Q2 — Capability count** (Header: "Scope", multiSelect: false)
- Question: "How many distinct user-facing capabilities does this need?"
- Options:
  1. "1–3 focused capabilities" — description: "Small, well-scoped project" → score: 0
  2. "4–6 capabilities" — description: "Moderate scope, clear boundaries" → score: 1
  3. "7–10 capabilities" — description: "Broad scope, will need wave-based parallelism" → score: 2
  4. "10+ or unsure" — description: "Large scope or still undefined — needs deep exploration" → score: 3

**Q3 — External integrations** (Header: "Integrations", multiSelect: true)
- Question: "What external integrations or complex domains are involved?"
- Options:
  1. "Third-party APIs" — description: "REST/GraphQL/gRPC services"
  2. "Database or storage" — description: "SQL, KV stores, file systems"
  3. "Auth providers" — description: "OAuth, JWT, SAML, session management"
  4. "Real-time / WebSocket" — description: "Bidirectional or streaming communication"
- Score: count of selections (0–4), capped at 3

**Q4 — Quality bar** (Header: "Quality", multiSelect: false)
- Question: "What's the quality bar for this project?"
- Options:
  1. "Prototype / POC" — description: "Exploring feasibility, disposable code is fine" → score: 0
  2. "Internal tool" — description: "Quality matters but consumer surface is small" → score: 1
  3. "Production use" — description: "External consumers, needs stability and docs" → score: 2
  4. "Public API / framework" — description: "Must be stable, well-typed, and documented from day one" → score: 3

### Question Set: `modify` / `feature`

**Q1 — Change surface area** (Header: "Scope", multiSelect: false)
- Question: "How broad is this change?"
- Options:
  1. "Single plugin, isolated change" — description: "Touches one plugin, no dependencies affected" → score: 0
  2. "One plugin + its dependents" — description: "Primary change in one plugin, ripple effects in 1–2 others" → score: 1
  3. "Cross-cutting, multiple plugins" — description: "Touches 3+ plugins or a shared interface" → score: 2
  4. "Architecture-level change" — description: "New patterns, tiers, or structural changes across the framework" → score: 3

**Q2 — Breaking change risk** (Header: "Risk", multiSelect: false)
- Question: "What's the breaking change risk?"
- Options:
  1. "No API changes" — description: "Internal refactor only, no consumer-facing changes" → score: 0
  2. "Additive changes" — description: "New APIs/features, nothing removed or renamed" → score: 1
  3. "Minor breaking changes" — description: "Some API signatures change, migration is straightforward" → score: 2
  4. "Major breaking changes" — description: "Removes/renames existing consumer APIs, needs migration guide" → score: 3

**Q3 — Technical uncertainty** (Header: "Uncertainty", multiSelect: false)
- Question: "How well-understood is the technical approach?"
- Options:
  1. "Clear path" — description: "Known patterns, just need to implement" → score: 0
  2. "Some unknowns" — description: "General approach clear, specifics need research" → score: 1
  3. "Significant unknowns" — description: "Multiple competing approaches, need to evaluate" → score: 2
  4. "Exploratory" — description: "Not sure if it's even feasible within Moku's architecture" → score: 3

**Q4 — Test confidence** (Header: "Tests", multiSelect: false)
- Question: "What's the test coverage situation?"
- Options:
  1. "Full coverage exists" — description: "Affected code has comprehensive tests" → score: 0
  2. "Partial coverage" — description: "Some tests exist, will add more" → score: 1
  3. "Minimal coverage" — description: "Few tests, changes may break unknown paths" → score: 2
  4. "No tests" — description: "Affected areas have no test coverage" → score: 3

### Question Set: `migrate`

**Q1 — Source codebase size** (Header: "Size", multiSelect: false)
- Question: "How large is the codebase being migrated?"
- Options:
  1. "Small (< 500 LOC)" — description: "Quick to analyze and map" → score: 0
  2. "Medium (500–2000 LOC)" — description: "Manageable, clear module boundaries" → score: 1
  3. "Large (2000–10000 LOC)" — description: "Significant analysis needed" → score: 2
  4. "Very large (10000+ LOC)" — description: "Deep analysis required, likely incremental migration" → score: 3

**Q2 — Architectural distance** (Header: "Gap", multiSelect: false)
- Question: "How different is the source architecture from Moku's plugin model?"
- Options:
  1. "Already plugin-based" — description: "Event-driven or modular — close to Moku patterns" → score: 0
  2. "Well-separated modules" — description: "Monolithic but clear module boundaries" → score: 1
  3. "Tightly coupled" — description: "Monolithic, shared state, mixed concerns" → score: 2
  4. "Framework-specific patterns" — description: "Next.js pages, Rails controllers, Django views — needs conceptual remapping" → score: 3

**Q3 — State patterns** (Header: "State", multiSelect: true)
- Question: "What state management patterns does the source use?"
- Options:
  1. "Global singletons" — description: "module-level state, service locator"
  2. "Shared mutable state" — description: "Objects passed by reference, mutated in place"
  3. "State library patterns" — description: "Redux, Zustand, Pinia, MobX"
  4. "Database as state" — description: "DB is primary state, application layer is thin"
- Score: count of selections, capped at 3

**Q4 — Timeline pressure** (Header: "Timeline", multiSelect: false)
- Question: "What's the migration timeline?"
- Options:
  1. "No deadline" — description: "Exploratory, can take as long as needed" → score: 0
  2. "Weeks" — description: "Need a working migration in 2–4 weeks" → score: 1
  3. "Days" — description: "Urgent, need a plan quickly" → score: 2
  4. "Parallel systems" — description: "Old and new must coexist during transition" → score: 3

---

## Phase 2: Complexity Scoring

After all questions are answered, compute the complexity score:

```
raw_sum = sum of all question scores
raw_max = 3 * question_count  (always 4 questions × 3 max = 12)
COMPLEXITY_SCORE = round((raw_sum / raw_max) * 9)
```

Apply DEPTH_FLAG override:
- If DEPTH_FLAG is `deep`: EFFECTIVE_DEPTH = `deep` regardless of score
- If DEPTH_FLAG is `quick`: EFFECTIVE_DEPTH = `quick` regardless of score
- If DEPTH_FLAG is `auto`:
  - Score 0–3: EFFECTIVE_DEPTH = `quick`
  - Score 4–6: EFFECTIVE_DEPTH = `standard`
  - Score 7–9: EFFECTIVE_DEPTH = `deep`

Report to user: "Complexity score: {COMPLEXITY_SCORE}/9 → **{EFFECTIVE_DEPTH}** mode."

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

Save discovery answers to `.planning/brainstorm-{NAME}-answers.md` (a flat markdown file with Q&A pairs — scratch file, cleaned up after context assembly).

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
4. The discovery answers (from `.planning/brainstorm-{NAME}-answers.md`)
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
