# Brainstorm Debate Loop

The Present → Challenge → Decide cycle. Receives CATEGORY, NAME, DESCRIPTION, EFFECTIVE_DEPTH,
CUSTOM_ITERATIONS from `brainstorm-flow.md`.

---

## Iteration Limits

**MAX_ITERATIONS is 1 at every depth.** One challenger pass is the default because repeated review
rounds over the same artifact measured about 25 extra minutes for the same quality. Depth still
decides how many researchers run (1 / 2 / 3).

`--deep N` sets MAX_ITERATIONS to N explicitly, and the closing gate always offers one more round.
Those are the two ways to get past one pass; do not add rounds on your own judgement.

---

## Initialization

Write `.planning/brainstorm-{NAME}-position.md` yourself, using the Position Document Schema in
`brainstorm-templates.md`. Inputs: the analysis (`.planning/brainstorm-{NAME}-analysis.md`), the
merged research (`.planning/brainstorm-{NAME}-research.md`), and the decisions already made with the
user. The position is the artifact the challenger attacks, so it states a real position — at most 5
assumptions, 3 risks, 3 open questions, each one actionable. "Consider performance" is not a risk;
"benchmark the event bus at 50+ listeners — research found O(n^2) registration in similar systems" is.

It also carries a Spec Alignment table citing the `spec/NN-*.md §N` sections behind each key
decision, with any deviation flagged rather than dropped. Plan verifies against those same sections.

---

## Debate Loop

```
iteration = 1
while iteration <= MAX_ITERATIONS:
  1. Present current position
  2. Challenge
  3. Decide
  if user satisfied: break
  iteration += 1
```

### Turn 1 — Present

Read `.planning/brainstorm-{NAME}-position.md` and display to the user as a formatted summary. Use `**BOLD CAPS**` for section titles (NOT `##` headings — they render without hierarchy in the terminal):

```
Brainstorm: {NAME} | Phase 4/4: Debate | Iteration {iteration}/{MAX_ITERATIONS} | {EFFECTIVE_DEPTH} mode

**BRAINSTORM POSITION — Iteration {iteration}/{MAX_ITERATIONS}**

**Proposed approach:** {from position doc — keep this to 1–2 sentences}

---

**Key assumptions**
1. {assumption 1}
2. {assumption 2}

**Identified risks**
- {risk 1}
- {risk 2}

**Open questions**
- {question 1}
```

Use numbered lists for assumptions (users reference them by number in decisions) and bullet lists for risks/questions.

If this is iteration > 1, also show after the progress marker: "Changes from previous iteration: {summary of what changed based on last round's decisions}."

### Turn 2 — Challenge

Spawn `brainstorm-challenger` agent.

Prompt must include:
- `NAME`, iteration number
- Path to position: `.planning/brainstorm-{NAME}-position.md`
- Path to research: `.planning/brainstorm-{NAME}-research.md`
- Path to analysis: `.planning/brainstorm-{NAME}-analysis.md`

After challenger completes, read its output.

**Anti-rubber-stamp check:** Before presenting challenges to the user, evaluate the challenger's output quality. Check for BOTH of these deficiencies in a single pass:
- **All-LOW:** ALL three challenges have severity LOW — the challenger may be rubber-stamping
- **Generic:** Any challenge uses vague phrases ("might not scale", "could be complex", "consider performance") without citing specific text from the position document

If EITHER deficiency is detected, construct a single re-spawn prompt addressing ALL issues found: "Re-run your challenge. Issues with previous attempt: {list each deficiency — e.g., 'all challenges were LOW severity' and/or 'challenge #2 was generic'}. Requirements: at least one challenge must be MEDIUM or HIGH severity, and every challenge must cite specific text from the position document with a concrete alternative. Look for: hidden TypeScript complexity, dependency graph issues, event system bottlenecks, or architectural assumptions that break at scale."

Re-spawn at most ONCE — if the second attempt still produces weak challenges, proceed with what you have. Do not loop.

Present the challenge findings as text output first, then call `AskUserQuestion` in the NEXT response turn (the dialog overlay covers the text above it, so the findings need their own turn):

**Text output (Turn 2a):** Display the full challenge report with details:
```
**CHALLENGER FINDINGS — Iteration {iteration}**

**1. {challenge title}** ({severity})
{full reasoning — cite specific position text, explain the concern, propose mitigation}

**2. {challenge title}** ({severity})
{full reasoning}

**3. {challenge title}** ({severity})
{full reasoning}

---
```

**AskUserQuestion (Turn 2b — next response):**

- Question: "Which challenges do you want to address?"
- Header: "Challenges"
- Options: Generate one option per challenge finding. Each `description` must be **self-contained** — include the problem AND the proposed mitigation so the user can decide without scrolling back.
  1. label: "{2-5 word title}", description: "{problem summary} — {mitigation direction}"
  2. label: "{2-5 word title}", description: "{problem} — {mitigation}"
  3. label: "{2-5 word title}", description: "{problem} — {mitigation}"
  4. label: "Fresh directions", description: "Scan codebase for unexpected angles and out-of-box ideas"
  5. label: "Accept position", description: "No changes needed — lock in the current approach"
- multiSelect: true

**If user selects "Accept position"**: set CONVERGED=true, skip Turn 3, exit loop.

**If user selects "Fresh directions"**: run the Proactive Ideation step (see below) before Turn 3. The ideation results are presented as additional approaches. Any challenges the user also selected are resolved in Turn 3 alongside the ideation output.

### Proactive Ideation

Triggers when the user selects "Fresh directions" during Turn 2. This breaks out of the current DESCRIPTION framing to find unexpected angles.

**Step 1: Spawn ideation agents.** Spawn 2 `moku-researcher` agents **in parallel** with ideation-specific lenses:

| Agent | Lens | Guiding prompt |
|---|---|---|
| 1 | **Inversion** | "What if we did the opposite of the current approach? What if the main constraint was inverted? What would this look like if we optimized for the OPPOSITE quality (e.g., simplicity instead of flexibility, speed instead of correctness)?" |
| 2 | **Adjacent Possible** | "What recently became feasible that changes the solution space? What patterns from DIFFERENT domains (games, compilers, databases, ML pipelines) solve a structurally similar problem? What would a solution look like if this wasn't a {CATEGORY} problem at all?" |

Each agent prompt must also include:
- The current position document (`.planning/brainstorm-{NAME}-position.md`)
- The DESCRIPTION
- Instruction: "Generate 3–5 fresh ideas that break out of the current framing. Each idea must include: a one-line description, why it's worth considering, and a brief TypeScript code sketch (3–10 lines) showing the API or pattern. Be bold — the value is in the unexpected."
- Output path: `.planning/brainstorm-{NAME}-ideation-{lens}.md`

**Step 2: Present ideas.** After both agents complete, read their outputs and present a combined list to the user:

```
## Fresh Directions

### From Inversion Lens
1. **{idea}** — {why it's worth considering}
   ```typescript
   {code sketch}
   ```
2. ...

### From Adjacent Possible Lens
1. **{idea}** — {why it's worth considering}
   ```typescript
   {code sketch}
   ```
2. ...
```

Then use `AskUserQuestion`:
- Question: "Which fresh ideas should influence the approach?"
- Header: "Ideation"
- Options: one per idea (do NOT add a manual "None" option — the system auto-appends "Other"). If user submits empty selection or "Other" with no text: stay the course, no ideas incorporated.
- multiSelect: true

**Step 3: Incorporate.** Fold the selected ideas into the next position update, and change the approach direction when they reveal a better path. The ideation scratch files (`.planning/brainstorm-{NAME}-ideation-*.md`) are added to the cleanup list.

**Ideation runs at most once per brainstorm session.** Before offering the "Explore fresh directions" option in Turn 2, check if `.planning/brainstorm-{NAME}-ideation-*.md` files already exist. If they do, ideation has already run — replace the option with: label: "Fresh directions (already explored)", description: "Ideas from iteration {N} are incorporated in the current position". Make this option non-functional (if selected, show the previous ideation summary instead of re-spawning agents).

### Turn 3 — Decide

For each challenge the user selected, ask a focused resolution question using `AskUserQuestion`. Generate the question dynamically based on the challenge type:

**For a challenged assumption:**
- Question: "Assumption: '{quoted assumption}'. The challenger says: '{challenge}'. How should we handle this?"
- Header: "Assumption"
- Options:
  1. "Confirm as stated" — description: "Keep the assumption — the challenge doesn't change our approach"
  2. "Refine" — description: "Adjust the assumption to: {challenger's alternative framing}"
  3. "Abandon" — description: "Remove this from scope — we'll address it during planning if needed"
- multiSelect: false

**For an unconsidered risk:**
- Question: "Risk: '{risk name}' ({probability} probability, {impact} impact). How should we handle it?"
- Header: "Risk"
- Options:
  1. "Accept and note" — description: "Acknowledge the risk, document in context file, don't change approach"
  2. "Mitigate in design" — description: "Adjust the approach to address this risk: {challenger's mitigation}"
  3. "Out of scope" — description: "This risk is outside the brainstorm's concern — planning stage handles it"
- multiSelect: false

**For an alternative approach:**
- Question: "Alternative: '{approach name}'. {1-sentence description}. Should this change the plan?"
- Header: "Alternative"
- Options:
  1. "Keep current approach" — description: "The current approach is better for our constraints"
  2. "Switch to this alternative" — description: "Adopt this as the new proposed approach"
  3. "Note for planning" — description: "Worth considering during planning, but don't change brainstorm direction"
- multiSelect: false

After the selected challenges are resolved, rewrite `.planning/brainstorm-{NAME}-position.md`
yourself with the new decisions folded in. Evolve the document, do not reset it: decisions from
earlier rounds stay, resolved questions move into the decisions table, and the iteration number goes up.

---

## Convergence

The loop exits when:
1. User selects "Accept position" during challenge review, OR
2. MAX_ITERATIONS is exhausted

---

## Context File Assembly

After the loop exits, write `.planning/context-{NAME}.md` yourself from the Context File Template in
`brainstorm-templates.md`, using the analysis, the merged research and the final position. You sat
through the debate; a subagent writing this would have to reconstruct it from files.

Check before presenting it:

1. No section is empty or holds only a header. Omit `## Migration Source` for non-migrate categories.
2. Every debate decision appears in the Decisions Made table.
3. Non-Goals come from decisions that scoped something out, not from invention.
4. Research Findings trace to the merged research file.
5. The Meta section's plan command matches CATEGORY: `create` → `plan create`, `modify`/`feature` →
   `plan update`, `migrate` → `plan migrate`.
6. Spec Alignment cites real `spec/NN-*.md §N` sections, and every deviation carries an accepted-risk
   note.
7. Open Questions holds only what is genuinely unresolved. Suggested Plugins is a preliminary list for
   standard and deep depth, and "Plugin analysis deferred to plan stage" for quick.

A section you cannot populate is a gap in the brainstorm, not a formatting problem — fill it before
the gate rather than marking it incomplete.

---

## Final User Gate

Run `moku-rails pause --reason "waiting for brainstorm approval"`, then present a summary of
`.planning/context-{NAME}.md`.

Determine the correct plan command based on CATEGORY:
- `create` → `/moku:plan create {TYPE} "{NAME}" --context context-{NAME}.md` (TYPE derived from analysis — framework, app, or plugin)
- `modify`/`feature` → `/moku:plan update {TYPE} "{NAME}" --context context-{NAME}.md`
- `migrate` → `/moku:plan migrate {TYPE} "{NAME}" --context context-{NAME}.md`

Use `AskUserQuestion`:
- Question: "Context file saved. What next?"
- Header: "Complete"
- Options:
  1. label: "Plan (Recommended)", description: "Run `{plan command}` to start the 3-stage planning workflow"
  2. label: "Review first", description: "Review .planning/context-{NAME}.md before running the plan command"
  3. label: "Refine further", description: "Run one more debate iteration to stress-test the approach"
- multiSelect: false

If user chooses "Plan (Recommended)": clean up scratch files (see Cleanup below), run `moku-rails done brainstorm`, and tell the user the plan command. Brainstorm does not invoke plan; the conductor or the user walks to that station.

If user chooses "Review first": clean up scratch files (see Cleanup below).

If user chooses "Refine further": keep the scratch files. Set `iteration = MAX_ITERATIONS`, increment `MAX_ITERATIONS` by 1, and re-enter the loop at Turn 2 (Challenge). Research does not re-run.

---

## Cleanup

**Runs only after the user chooses "Plan (Recommended)" or "Review first" in the Final User Gate.** Never runs if "Refine further" is chosen.

Delete scratch files:
- `.planning/brainstorm-{NAME}-analysis.md`
- `.planning/brainstorm-{NAME}-research.md`
- `.planning/brainstorm-{NAME}-research-*.md` (per-focus research files)
- `.planning/brainstorm-{NAME}-position.md`
- `.planning/brainstorm-{NAME}-ideation-*.md` (ideation scratch files, if any)

Keep only the final output: `.planning/context-{NAME}.md` and `.planning/learnings.md`.

## Compound Learning Extraction

**Runs after cleanup, before the closing next-step suggestion.** This step extracts reusable learnings from the brainstorm session so future brainstorms benefit from accumulated experience.

1. Review the context file (`.planning/context-{NAME}.md`) and identify 3–5 key learnings:
   - **Surprising findings** from research that contradicted assumptions
   - **Validated patterns** — approaches confirmed through debate as strong fits for Moku
   - **Mistakes to avoid** — assumptions that were challenged and abandoned
   - **Useful references** — specific packages, patterns, or resources discovered during research
   - **Decision rationale** — why a non-obvious choice was made (helps future brainstorms in similar domains)

2. Append entries to `.planning/learnings.md` (create the file if it doesn't exist). Format:

```markdown
### {NAME} ({CATEGORY}) — {ISO date}
- {learning 1}
- {learning 2}
- {learning 3}
```

3. Do not extract trivial or project-specific learnings. Only extract insights that would help someone brainstorming a DIFFERENT project in a similar domain. If no learnings are genuinely reusable, skip this step silently.
