---
description: Auto-detect project state and run the next logical step
allowed-tools: Read, Bash, Glob, Grep, Skill, AskUserQuestion
argument-hint: [--dry-run]
disable-model-invocation: true
---

Detect the current Moku project state and automatically route to the next logical command. This is the single entry point for "what should I do next?"

If `$ARGUMENTS` contains `--dry-run`, report what command would be run without executing it.

## Step 1: Detect Project State

Read project state in this order (first match wins):

### 1a. No package.json

If no `package.json` exists in the current directory:
- **Action:** Tell the user: "No project found. Run `/moku:init` to scaffold a new Moku project."
- Stop.

### 1b. No .planning/ directory

If `package.json` exists but `.planning/` directory does not:
- Check if `src/plugins/` exists (existing Moku project without planning):
  - If yes: "Existing Moku project without a plan. Run `/moku:plan create [type] \"description\"` to start planning, or `/moku:check` to run diagnostics."
  - If no: "Project found but no plan started. Run `/moku:plan create [type] \"description\"` to begin."
- Stop.

### 1c. .planning/STATE.md exists

Read `.planning/STATE.md`. Extract `## Phase:`, `## Verb:`, `## Target:`, `## Skeleton:`, `## Next Action:`.

Route based on Phase value:

| Phase | Next Command | Reason |
|-------|-------------|--------|
| `stage1` or `stage1/pending-approval` | `/moku:plan resume` | Stage 1 analysis needs completion or approval |
| `stage1/approved` | `/moku:plan resume` | Ready for Stage 2 (specifications) |
| `stage2` or `stage2/pending-approval` | `/moku:plan resume` | Stage 2 specs need completion or approval |
| `stage2/approved` | `/moku:plan resume` | Ready for Stage 3 (skeleton specification) |
| `stage3` or `stage3/pending-approval` | `/moku:plan resume` | Stage 3 skeleton spec needs completion or approval |
| `complete` (Phase) AND Skeleton `not-started` | `/moku:build resume` | Plan complete, skeleton build needed |
| `complete` (Phase) AND Skeleton `in-progress` | `/moku:build resume` | Skeleton build in progress |
| `complete` (Phase) AND Skeleton `verified` | `/moku:build resume` | Skeleton built, needs approval and commit |
| `complete` (Phase) AND Skeleton `committed` | See 1d below | Skeleton done, check build progress |
| `building` or `build/wave-*` | `/moku:build resume` | Build in progress |
| `build/complete` | `/moku:check verbose` | Build complete, run diagnostics |

### 1d. Build Progress (Skeleton committed)

If Phase is `complete` and Skeleton is `committed`, check plugin build progress:

1. Read the plugin table from STATE.md
2. Count plugins by status:
   - If any plugin has status `building` or `retry-pending`: `/moku:build resume` (resume interrupted build)
   - If any plugin has status `needs-manual` or `verify-failed`: `/moku:build fix --all` (fix failed plugins)
   - If any plugin has status `pending` or empty: `/moku:build resume` (continue building remaining plugins)
   - If ALL plugins are `verified` or `complete`: `/moku:check verbose` (everything built, run final diagnostics)

### 1e. .planning/ exists but no STATE.md

If `.planning/` exists but `STATE.md` does not:
- **Brainstorm-in-progress check:** If `.planning/brainstorm-*-analysis.md` or `.planning/brainstorm-*-research.md` files exist, a brainstorm session is in progress. Extract the NAME from the filename pattern. Tell user: "A brainstorm session for `{NAME}` is in progress. Run `/moku:brainstorm {category} {NAME}` to resume." Stop.
- **Completed brainstorm check:** If `.planning/context-*.md` files exist but no `STATE.md`, a brainstorm completed but planning hasn't started. Extract the NAME from the filename. Tell user: "Brainstorm context found for `{NAME}`. Run `/moku:plan create [type] \"{NAME}\" --context context-{NAME}.md` to start planning." Stop.
- Check if `.planning/specs/` has spec files:
  - If yes: "Spec files found but no STATE.md. Run `/moku:plan resume` to regenerate state, or `/moku:build framework` to start building."
  - If no: Use `AskUserQuestion`:
    - Question: "Planning directory exists but is empty. How would you like to start?"
    - Header: "Start"
    - Options:
      1. label: "Brainstorm first (Recommended)", description: "Discover architecture, plugin structure, and risks before planning"
      2. label: "Go straight to plan", description: "Skip brainstorm and start planning directly with /moku:plan create"
    - multiSelect: false
    - If brainstorm: invoke Skill `moku:brainstorm` (let user provide args)
    - If plan: invoke Skill `moku:plan` with args `create`
    - If `--dry-run`: report both options without invoking AskUserQuestion: "Next step: `/moku:brainstorm` (recommended) or `/moku:plan create [type] \"description\"` — planning directory is empty."
- Stop.

## Step 2: Execute or Report

If `--dry-run`:
- Report: "Next step: `[command]` — [reason]"
- Stop.

Otherwise:
- Tell the user: "Detected state: [brief description]. Running `[command]`..."
- Invoke the determined command using the `Skill` tool. Map the command to the skill name:
  - `/moku:plan resume` → Skill: `moku:plan`, args: `resume`
  - `/moku:build resume` → Skill: `moku:build`, args: `resume`
  - `/moku:build fix --all` → Skill: `moku:build`, args: `fix --all`
  - `/moku:check verbose` → Skill: `moku:check`, args: `verbose`

## Edge Cases

- If STATE.md exists but is malformed (missing required headers), tell the user: "STATE.md appears corrupt. Run `/moku:check self-test` to diagnose, or delete `.planning/STATE.md` and run `/moku:plan create` to start fresh."
- If the Phase value is not recognized, tell the user: "Unrecognized phase: `[value]`. Run `/moku:status` to see the full project dashboard."
- If multiple next steps are equally valid, present them via `AskUserQuestion`:
  - Question: "Multiple next steps available. What would you like to do?"
  - Header: "Next step"
  - Options: list the valid commands with descriptions
  - multiSelect: false
