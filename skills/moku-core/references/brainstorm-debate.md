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
- Path to answers: `.planning/brainstorm-{NAME}-answers.md`
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
- Path to answers: `.planning/brainstorm-{NAME}-answers.md`

After challenger completes, read its output. Present the challenges to the user using `AskUserQuestion`:

- Question: "The challenger raised these concerns. Which do you want to address?"
- Header: "Challenges"
- Options: Generate one option per challenge finding:
  1. label: "{short title of challenge 1}", description: "{challenger's reasoning — 1 sentence}"
  2. label: "{short title of challenge 2}", description: "{reasoning}"
  3. label: "{short title of challenge 3}", description: "{reasoning}"
  4. label: "None — position looks good", description: "Skip remaining challenges, lock in the current approach"
- multiSelect: true

**If user selects "None — position looks good"**: set CONVERGED=true, skip Turn 3, exit loop.

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
- All previous context (answers, research)
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
- Path to answers: `.planning/brainstorm-{NAME}-answers.md`
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
- `create` → `/moku:plan create {TYPE} "{NAME}" --context context-{NAME}.md` (TYPE determined from discovery answers — framework, app, or plugin)
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
- `.planning/brainstorm-{NAME}-answers.md`
- `.planning/brainstorm-{NAME}-research.md`
- `.planning/brainstorm-{NAME}-research-*.md` (per-focus research files)
- `.planning/brainstorm-{NAME}-position.md`

Keep only the final output: `.planning/context-{NAME}.md`.
