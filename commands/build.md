---
description: Build a framework, consumer app, or plugin from a specification
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
argument-hint: [framework|app|plugin] [spec-path-or-name] [--dry-run]
disable-model-invocation: true
---

## Project Configuration
!`if [ -f .claude/moku.local.md ]; then head -20 .claude/moku.local.md; fi`

Use configuration values above if present (maxParallelAgents, gapClosureMaxRounds, etc.). Otherwise use defaults: maxParallelAgents=3, gapClosureMaxRounds=2.

Build a Moku project from a specification plan. The input (`$ARGUMENTS`) can be:

- `framework` — build framework from `.planning/specs/` directory
- `framework .planning/specs/` — explicit spec path
- `framework config` — build only config.ts + index.ts (skip plugins)
- `framework plugins` — build only plugins (skip config if exists)
- `app` — build consumer app from `.planning/app-spec.md`
- `app .planning/app-spec.md` — explicit plan path
- `plugin auth` — build plugin "auth" from description or matching spec
- `plugin #3` — build plugin #3 from `.planning/specs/03-*.md`
- `plugin #3-#5` — build plugins #3 through #5
- `plugin #3,#5,#7` — build specific plugins by number
- `plugin .planning/specs/03-auth.md` — build from explicit spec file
- `resume` — continue from `.planning/STATE.md`

---

## Step 0: Detect Target

Parse `$ARGUMENTS`:
1. If `--dry-run` is present anywhere in the arguments, enter **dry-run mode**: analyze specs, report what files would be created, wave grouping, and dependency order — but do NOT create or modify any files. Present the plan and exit.
2. If the first word is `resume` — read `.planning/STATE.md` and continue from the last recorded position. Skip to the appropriate build step.
3. If the first word is exactly `framework`, `app`, or `plugin` — use it as the target. The rest is the spec path or plugin name.
4. If no explicit target keyword, auto-detect:
   a. `.planning/specs/*.md` files exist → **framework**
   b. `.planning/app-spec.md` exists → **app**
   c. Both exist → ask the user which to build
   d. Argument matches a plugin name, `#N` pattern, or spec file path → **plugin**
5. If no specs found and no recognizable argument → tell the user: "No specifications found. Run `/moku:plan` first to create a plan."

For **plugin** targets, resolve the argument:
- `#N` → find `.planning/specs/0N-*.md` (e.g., `#3` → `.planning/specs/03-*.md`)
- `#N-#M` → find all specs from N to M (e.g., `#3-#5` → specs 03, 04, 05)
- `#N,#M,#P` → find specific specs (e.g., `#3,#5,#7`)
- A name like `auth` → search `.planning/specs/*-auth.md` or build from description
- A file path → use directly

### State Check

Before starting, check if `.planning/STATE.md` exists:
- If it does, read it to understand what has already been built
- Validate it contains required headers: `## Phase:`, `## Target:`, `## Next Action:`
- If headers are missing or malformed, warn the user and offer to regenerate from spec files
- Skip plugins/waves that are already marked as complete
- Report: "Detected existing state. Resuming from [position]. Already built: [list]."

### State Write Protocol

When updating `.planning/STATE.md`:
1. Back up current state: copy to `.planning/STATE.md.bak` before overwriting
2. If in a git repo, record the current commit SHA in the state file as `## Git Checkpoint: <sha>`
3. This enables rollback if a wave introduces regressions

---

## Framework Build

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/build-framework.md` for detailed framework build steps.

**Summary**: Build all plugins in dependency-aware waves using parallel sub-agents, with post-wave verification and gap closure.

**Flow**: Each invocation executes exactly ONE step (wave, verification, README, or validation), saves STATE.md, and stops. User runs `/moku:build resume` for the next step. This ensures fresh context and explicit user control.

**Step sequence per invocation:**
1. Read specs → Wave analysis → **STOP** (present wave plan)
2. Build Wave 0 (core plugins) → verify → integrate → tick spec checkboxes → **STOP**
3. Build Wave 1 → verify → integrate → tick spec checkboxes → **STOP**
4. Build Wave N → ... → **STOP** (one wave per invocation until all waves done)
5. Final framework verification → **STOP**
6. README wave (parallel sub-agents for all plugin READMEs) → **STOP**
7. Post-build validation pipeline → report → **DONE**

### Wave Execution Protocol

**One wave per invocation.** Each `/moku:build` or `/moku:build resume` call:
1. Reads `.planning/STATE.md` to find the current position
2. Executes the NEXT incomplete step (wave, verification, README wave, or validation)
3. Updates `.planning/STATE.md` with results
4. Stops and tells the user what to run next:
   > "Wave [N] complete ([plugin list]). Run `/moku:build resume` to continue with Wave [N+1]."

**Do NOT attempt multiple waves in one invocation.** Each wave gets fresh context, fresh sub-agents, and an explicit user checkpoint. This prevents context exhaustion and gives the user control over pacing.

**`#wave:N` syntax:** `/moku:build #wave:2` jumps directly to wave 2 (useful for re-running a specific wave after manual fixes).

### Quality Requirements

- Full JSDoc on ALL source files (functions, types, interfaces)
- `import type` for type-only imports
- Plugin index.ts must be ~30 lines of wiring
- Every plugin must have unit + integration tests
- All tests must pass
- Biome and ESLint must pass with zero warnings
- Follow the exact complexity tier specified in the plan
- Never use explicit generics on `createPlugin` — see moku-plugin skill
- Plugin export names must NOT have "Plugin" postfix — use bare name
- NO unnecessary `onStart`/`onStop` — only when managing actual resources (servers, connections, listeners)
- `src/plugins/index.ts` must exist as plugin barrel with grouped sections (Instances → Helpers → Types)
- `src/index.ts` must be self-documenting: JSDoc module comment with options/defaults table, grouped exports (Framework API → Plugins → Helpers → Types)
- No wire factory patterns — import `createPlugin` and dependencies directly
- No inline type assertions (`null as X`, `{} as X`) in createState/config

---

## App Build

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/build-app.md` for detailed app build steps.

**Summary**: Verify framework availability, build custom consumer-side plugins (if any), create entry point with createApp, validate with the full pipeline.

**Flow**: Read app spec -> Verify framework exports/plugins -> Build custom plugins (following Plugin Build) -> Create entry point (src/main.ts) -> Validate (spec, plugin-spec, jsdoc, test, type validators) -> Report + STATE.md update.

**Key rule**: NEVER import from `@moku-labs/core` — only from the framework package. If web app, also enforce moku-web skill patterns.

---

## Plugin Build

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/build-plugin.md` for detailed plugin build steps.

**Summary**: Determine complexity tier, create tier-appropriate directory structure, implement domain files, write tests, validate.

**Flow**: Understand plugin (from spec, description, or hierarchy) -> Determine tier (Nano/Micro/Standard/Complex/VeryComplex) + domain merge check -> Create directory structure -> Implement domain files (types.ts, state.ts, api.ts, handlers.ts) -> Write index.ts (~30 lines wiring, NO explicit generics) -> Write tests (unit + integration) -> Write README.md -> Validate (verifier, plugin-spec, jsdoc, test, type validators) -> Gap closure if needed (max 2 rounds).

**Key rules**: Domain merge check before creating new plugins. No explicit generics on createPlugin. No unnecessary onStart/onStop. Full JSDoc everywhere.
