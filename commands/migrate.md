---
description: Prepare migration context for a Moku project (analyze only — never modifies code)
allowed-tools: Read, Write, Bash, Glob, Grep, Agent
argument-hint: [upgrade|restructure|from-existing] [path-or-version]
disable-model-invocation: true
---

## Project Configuration
!`if [ -f .claude/moku.local.md ]; then head -20 .claude/moku.local.md; fi`

Prepare migration context for an existing project. This command **analyzes only** — it never modifies source code. All three flows produce `.planning/decisions.md` and optionally `.planning/research.md`, then hand off to `/moku:plan framework`.

- `upgrade` — Analyze breaking changes between current and target @moku-labs/core version
- `upgrade 2.0.0` — Analyze upgrade to a specific version
- `restructure` — Audit plugin tiers and detect domain merges
- `from-existing [path]` — Analyze a non-Moku project for migration to Moku Core

---

## Step 0: Detect Migration Type

Parse `$ARGUMENTS`:
1. If the first word is `upgrade` — core version upgrade analysis
2. If the first word is `restructure` — plugin tier reassessment analysis
3. If the first word is `from-existing` — existing project migration analysis
4. If no argument — auto-detect:
   a. Check if `@moku-labs/core` has a newer version available → suggest `upgrade`
   b. Check if any plugins have outgrown their tier → suggest `restructure`
   c. Otherwise ask the user what they want to do

### Prerequisite Check

For `upgrade` and `restructure` — verify this is a Moku project:
- `src/config.ts` exists with `createCoreConfig` (Framework), OR
- `package.json` imports from a Moku framework (Consumer App)
- If neither, tell user: "No Moku project detected. Run `/moku:init` first."

For `from-existing` — verify the target path exists and contains a `package.json`.

Verify working tree is clean:
- Run `git status --porcelain` — if output is non-empty, warn user: "You have uncommitted changes. Commit or stash before migrating."

---

## Step 1: Optional Research

Spawn **moku-researcher** when the migration would benefit from ecosystem investigation:

- `from-existing` — always trigger (unfamiliar codebase needs investigation). Pass the tech stack, domain description, and key dependencies found in the target project.
- `upgrade` — trigger if the version gap spans a major version. Pass the target version's changelog URL and breaking change categories.
- `restructure` — skip (the existing project is already understood).

Research output is saved to `.planning/research.md`.

---

## Step 2: Analyze

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/migrate-flows.md` for detailed analysis instructions for the detected migration type.

Execute the type-specific analysis. Each flow produces a structured analysis to be captured in Step 3.

---

## Step 3: Save Context

Write analysis results to `.planning/decisions.md` using the Migration decisions.md Template from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-templates.md`.

If research was performed, verify `.planning/research.md` exists and contains the researcher output.

---

## Step 4: Next Step

Tell the user:

```
Migration analysis complete.

Saved:
  .planning/decisions.md  — migration context and analysis
  .planning/research.md   — ecosystem research (if performed)

Next: Run `/moku:plan framework` to create specifications for the new project.
The plan command will detect the migration context and skip the discussion phase.

If `.planning/STATE.md` exists from a previous plan cycle, remove or archive it first —
otherwise the plan command will offer to resume it instead of starting fresh.
```

---

## Rules

- This command NEVER modifies source code — analysis and context preparation only
- The output is a NEW project plan, not a patch to the existing project
- Follow all Moku specification concepts (see moku-core and moku-plugin skills)
- `decisions.md` must include a `## Migration Type` header so `/moku:plan` detects it
- If the analysis is too large for the context window, prioritize plugin inventory and breaking changes over detailed code listings
