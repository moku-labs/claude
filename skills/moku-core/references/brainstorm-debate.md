# Brainstorm Debate Loop

Implements the Present → Challenge → Decide cycle. Receives context from brainstorm-flow.md: CATEGORY, NAME, DESCRIPTION, EFFECTIVE_DEPTH.

---

## Iteration Limits

| Depth | MAX_ITERATIONS |
|---|---|
| `quick` | 1 |
| `standard` | 2 |
| `deep` | 3 |

---

## Initialization

Spawn `brainstorm-synthesizer` agent in **position mode** to produce the initial position document.

Prompt must include:
- `CATEGORY`, `NAME`, `DESCRIPTION`
- Path to analysis: `.planning/brainstorm-{NAME}-analysis.md`
- Path to research: `.planning/brainstorm-{NAME}-research.md`
- Output path: `.planning/brainstorm-{NAME}-position.md`
- Iteration: 1

After synthesizer completes, read `.planning/brainstorm-{NAME}-position.md` and begin the loop.

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

Read `.planning/brainstorm-{NAME}-position.md` and display to the user as a formatted summary:

```
## Brainstorm Position — Iteration {iteration}/{MAX_ITERATIONS}

**Proposed approach:** {from position doc}

**Key assumptions:**
{bulleted list from position doc}

**Identified risks:**
{bulleted list from position doc}

**Open questions:**
{bulleted list from position doc}
```

If this is iteration > 1, also show: "Changes from previous iteration: {summary of what changed based on last round's decisions}."

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

Present the challenges to the user using `AskUserQuestion`:

- Question: "The challenger raised these concerns. Which do you want to address?"
- Header: "Challenges"
- Options: Generate one option per challenge finding:
  1. label: "{short title of challenge 1}", description: "{challenger's reasoning — 1 sentence}"
  2. label: "{short title of challenge 2}", description: "{reasoning}"
  3. label: "{short title of challenge 3}", description: "{reasoning}"
  4. label: "Explore fresh directions", description: "Break out of current framing — scan for unexpected angles, adjacent possibilities, and out-of-box ideas"
  5. label: "None — position looks good", description: "Skip remaining challenges, lock in the current approach"
- multiSelect: true

**If user selects "None — position looks good"**: set CONVERGED=true, skip Turn 3, exit loop.

**If user selects "Explore fresh directions"**: run the Proactive Ideation step (see below) before Turn 3. The ideation results are presented as additional approaches. Any challenges the user also selected are resolved in Turn 3 alongside the ideation output.

### Proactive Ideation

Triggers when the user selects "Explore fresh directions" during Turn 2. This breaks out of the current DESCRIPTION framing to find unexpected angles.

**Step 1: Spawn ideation agents.** Spawn 2 `brainstorm-researcher` agents **in parallel** with ideation-specific lenses:

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
- Options: one per idea, plus "None — stay the course"
- multiSelect: true

**Step 3: Incorporate.** Selected ideas are passed to the synthesizer in the next position update as additional input: "Incorporate these fresh ideas into the position: {list}. Adjust the approach direction if they reveal a better path." The ideation scratch files (`.planning/brainstorm-{NAME}-ideation-*.md`) are added to the cleanup list.

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

After all selected challenges are resolved, collect the decisions and spawn `brainstorm-synthesizer` in **position mode** with the new decisions:

Prompt must include:
- All previous context (analysis, research)
- Path to current position: `.planning/brainstorm-{NAME}-position.md`
- The list of decisions made this round (challenge text + user's chosen resolution + rationale)
- Instruction: "Update the position document to reflect these decisions. Preserve decisions from prior iterations."
- New iteration number
- Output path: same `.planning/brainstorm-{NAME}-position.md` (overwrite)

---

## Convergence

The loop exits when:
1. User selects "None — position looks good" during challenge review, OR
2. MAX_ITERATIONS is exhausted

---

## Context File Assembly

After the loop exits, spawn `brainstorm-synthesizer` in **final mode**.

Prompt must include:
- `FINAL_MODE=true`
- `CATEGORY`, `NAME`, `DESCRIPTION`, `EFFECTIVE_DEPTH`, `COMPLEXITY_SCORE`
- Path to analysis: `.planning/brainstorm-{NAME}-analysis.md`
- Path to research: `.planning/brainstorm-{NAME}-research.md`
- Path to final position: `.planning/brainstorm-{NAME}-position.md`
- Template reference: `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/brainstorm-templates.md`
- Output path: `.planning/context-{NAME}.md`

After synthesizer completes with PASS verdict, verify the file exists and has content.

**If synthesizer returns FAIL** (missing sections): re-invoke it once with an explicit list of the missing sections noted in its blockers array. If it still returns FAIL after the retry, show the user: "Context file generated with incomplete sections — marked with [INCOMPLETE]. Review `.planning/context-{NAME}.md` before using with `/moku:plan`."

---

## Final User Gate

Read `.planning/context-{NAME}.md` and present a summary to the user.

Determine the correct plan command based on CATEGORY:
- `create` → `/moku:plan create {TYPE} "{NAME}" --context context-{NAME}.md` (TYPE derived from analysis — framework, app, or plugin)
- `modify`/`feature` → `/moku:plan update {TYPE} "{NAME}" --context context-{NAME}.md`
- `migrate` → `/moku:plan migrate {TYPE} "{NAME}" --context context-{NAME}.md`

Use `AskUserQuestion`:
- Question: "Context file saved to `.planning/context-{NAME}.md`. What would you like to do?"
- Header: "Complete"
- Options:
  1. "Proceed to planning (Recommended)" — description: "Run `{plan command}` to start the 3-stage planning workflow"
  2. "Review context file" — description: "I'll review the file and run the plan command manually"
  3. "Refine further" — description: "Run one more debate iteration to tighten the approach"
- multiSelect: false

If user chooses "Proceed to planning": clean up scratch files (see Cleanup below), then tell the user "Run: `{plan command}` to start planning." Do NOT invoke the plan command directly — the user should start a fresh context window for planning.

If user chooses "Review context file": clean up scratch files (see Cleanup below).

If user chooses "Refine further": do NOT clean up scratch files. Set `iteration = MAX_ITERATIONS`, increment `MAX_ITERATIONS` by 1, and re-enter the debate loop at Turn 2 (Challenge) for iteration `MAX_ITERATIONS`. Do NOT re-run research.

---

## Cleanup

**Runs only after the user chooses "Proceed to planning" or "Review context file" in the Final User Gate.** Never runs if "Refine further" is chosen.

Delete scratch files:
- `.planning/brainstorm-{NAME}-analysis.md`
- `.planning/brainstorm-{NAME}-research.md`
- `.planning/brainstorm-{NAME}-research-*.md` (per-focus research files)
- `.planning/brainstorm-{NAME}-position.md`
- `.planning/brainstorm-{NAME}-ideation-*.md` (ideation scratch files, if any)
- `.planning/.brainstorm-active` (session marker — deactivates the brainstorm-guard hook)

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

3. Do NOT extract trivial or project-specific learnings. Only extract insights that would help someone brainstorming a DIFFERENT project in a similar domain. If no learnings are genuinely reusable, skip this step silently.
