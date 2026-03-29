---
description: Brainstorm a Moku project idea — collaborative analysis, adaptive research, and debate-driven context generation before planning
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion
argument-hint: [create|modify|migrate|feature] {name} "description" [--deep [N]|--quick]
disable-model-invocation: true
---

## Project Configuration
!`test -f .claude/moku.local.md && head -20 .claude/moku.local.md || true`

Explore and contextualize a Moku project idea before planning. The output is a `.planning/context-{name}.md` file consumed by `/moku:plan ... --context`.

This command runs an adaptive workflow:
1. **Collaborative analysis** — auto-detect complexity from project context, discuss only genuine architectural decisions with code examples and recommendations
2. **Research** — 1–3 parallel researcher agents based on detected depth
3. **Debate** — Present → Challenge → Decide loop to stress-test the approach
4. **Context file** — structured output for the plan command

**Categories** mirror the plan command's verbs:
- `create` — new framework, app, or plugin from scratch
- `modify` — update an existing plugin or framework
- `feature` — add a new capability to an existing project
- `migrate` — migrate an existing codebase to Moku

---

## Step 0: Parse Arguments

**Ordered startup sequence:**

1. **Filesystem guard:** `mkdir -p .planning/`
   **Brainstorm session marker:** `touch .planning/.brainstorm-active` — this activates the brainstorm-guard hook which prevents writes outside `.planning/`.

2. **Empty-arguments check:** If `$ARGUMENTS` is empty, show usage and stop:
   "Usage: `/moku:brainstorm [create|modify|migrate|feature] {name} \"description\"  [--deep [N]|--quick]`"

3. **Depth flag extraction:** If `--deep` is present anywhere in `$ARGUMENTS`:
   - Check if the token immediately following `--deep` is an integer.
     - If it is a positive integer ≥ 1 (e.g., `--deep 5`) → set DEPTH_FLAG=`deep`, CUSTOM_ITERATIONS=`{N}`, and strip both `--deep` and the number from `$ARGUMENTS`.
     - If it is zero or negative (e.g., `--deep 0`, `--deep -1`) → stop with error: "Invalid `--deep` value: iteration count must be a positive integer ≥ 1."
     - If the next token is not a number (or `--deep` is the last token) → set DEPTH_FLAG=`deep`, CUSTOM_ITERATIONS=`null`, and strip only `--deep`.
   - No upper cap on CUSTOM_ITERATIONS — never limit iterations.
   If `--quick` is present, set DEPTH_FLAG=`quick`, CUSTOM_ITERATIONS=`null`, and strip it. Otherwise DEPTH_FLAG=`auto`, CUSTOM_ITERATIONS=`null`.

### Token Extraction

**Tokenization:** Shell-like semantics — quoted strings are single tokens, quotes stripped.

1. **Extract CATEGORY** from first token, normalized:

| Input | Normalized CATEGORY |
|---|---|
| `create`, `new`, `build` | `create` |
| `modify`, `update`, `change` | `modify` |
| `feature`, `add`, `extend` | `feature` |
| `migrate`, `port`, `convert` | `migrate` |

If first token is not a recognized category keyword, use `AskUserQuestion`:
- Question: "What kind of brainstorm is this?"
- Header: "Category"
- Options:
  1. "Create" — description: "New framework, app, or plugin from scratch"
  2. "Modify" — description: "Update an existing plugin or framework"
  3. "Feature" — description: "Add a new capability to an existing project"
  4. "Migrate" — description: "Migrate an existing codebase to Moku"
- multiSelect: false
Set CATEGORY to the normalized answer. If the first token was not a category keyword, do NOT advance the token pointer — the unrecognized word stays in the stream for NAME/DESCRIPTION extraction.

2. **Extract NAME** from next token:
   - If the next token does not contain spaces and does not start with `"` → use as NAME
   - If no suitable NAME token → derive from first 2–3 meaningful words of DESCRIPTION, slugified (`[a-z0-9-]`, max 50 chars, no path separators)
   - **NAME sanitization:** Strip path separators (`/`, `\`, `..`), allow only `[a-z0-9-_]`, truncate to 50 characters. If empty after sanitization, derive from DESCRIPTION.

3. **Remaining tokens** → DESCRIPTION (free text).

4. **DESCRIPTION validation:** If DESCRIPTION is empty after parsing, use `AskUserQuestion`:
   - Question: "Describe what you want to build or explore."
   - Header: "Description"
   - Options:
     1. "Web framework" — description: "e.g., static site generator, SPA framework, component library"
     2. "CLI tool" — description: "e.g., bundler, linter, code generator"
     3. "Backend service" — description: "e.g., API server, real-time system, data pipeline"
     4. "Game or interactive" — description: "e.g., game engine, interactive editor, visualization"
   - multiSelect: false
   Use the selection or custom text as DESCRIPTION.

### Existing Context Guard

If `.planning/context-{NAME}.md` already exists, use `AskUserQuestion`:
- Question: "Context file for `{NAME}` already exists. How do you want to proceed?"
- Header: "Existing"
- Options:
  1. label: "Resume (Recommended)", description: "Continues from saved analysis and research — won't re-run completed phases"
  2. label: "Start fresh", description: "Deletes all .planning/brainstorm-{NAME}-* files and starts over"
  3. label: "Cancel", description: "Leave existing context as-is, do nothing"
- multiSelect: false

If "Resume": check if scratch files exist (`.planning/brainstorm-{NAME}-*.md`).
  - If `.planning/brainstorm-{NAME}-analysis.md` exists: re-run Phase 2 (Complexity Scoring) from the saved analysis to restore EFFECTIVE_DEPTH, then check for research files.
  - If research files also exist (`.planning/brainstorm-{NAME}-research.md`): skip Phase 3, go straight to the debate loop.
  - If no research files: skip Phase 1 (analysis already done), re-run Phase 3 (research) with restored EFFECTIVE_DEPTH.
  - If no scratch files at all: run from Phase 1.
If "Start fresh": delete `.planning/context-{NAME}.md` and all `.planning/brainstorm-{NAME}-*.md` scratch files.
If "Cancel": delete `.planning/.brainstorm-active` and stop.

---

## Route to Flow

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/brainstorm-flow.md` and follow it.

Context variables passed through: CATEGORY, NAME, DESCRIPTION, DEPTH_FLAG, CUSTOM_ITERATIONS.

---

## Rules

- **Write protection:** During brainstorm, Write and Edit may ONLY target files in `.planning/`. Never create, modify, or delete source code files (`src/`, `tests/`, project root configs). Brainstorm is for exploration and decision-making — code changes happen during `/moku:build`
- Never write to `.planning/STATE.md` — brainstorm state is separate from plan state
- All scratch files use the `.planning/brainstorm-{NAME}-*` prefix for clean isolation
- The final output is always `.planning/context-{NAME}.md` — one file, standardized schema
- `.planning/learnings.md` persists across brainstorm sessions — never delete it during cleanup
- Spawn researcher agents in parallel where depth allows — use multiple Agent tool calls in the same response
- Auto-detect complexity from project context — never ask the user to self-report what the AI can observe
- Every architectural question MUST include TypeScript code examples showing each approach, a clear recommendation with reasoning, and concerns about each alternative. Be an opinionated colleague, not a passive interviewer
- Ask 0 questions if the context is clear — more questions is not better, only genuine architectural trade-offs deserve discussion
- The debate loop converges when the user is satisfied OR max iterations reached — never force iterations
- Context file must be complete enough that `/moku:plan` can skip its steering and discussion phases entirely
- After writing the context file, always print a closing next-step suggestion:
  > "Brainstorm complete. Context saved to `.planning/context-{NAME}.md`. Run `/moku:plan create [type] "{NAME}" --context context-{NAME}.md` to begin planning."
