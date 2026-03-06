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

- `framework` — build framework from `specifications/` directory
- `framework specifications/` — explicit spec path
- `framework config` — build only config.ts + index.ts (skip plugins)
- `framework plugins` — build only plugins (skip config if exists)
- `app` — build consumer app from `.planning/app-spec.md`
- `app .planning/app-spec.md` — explicit plan path
- `plugin auth` — build plugin "auth" from description or matching spec
- `plugin #3` — build plugin #3 from `specifications/03-*.md`
- `plugin #3-#5` — build plugins #3 through #5
- `plugin #3,#5,#7` — build specific plugins by number
- `plugin specifications/03-auth.md` — build from explicit spec file
- `resume` — continue from `.planning/STATE.md`

---

## Step 0: Detect Target

Parse `$ARGUMENTS`:
1. If `--dry-run` is present anywhere in the arguments, enter **dry-run mode**: analyze specs, report what files would be created, wave grouping, and dependency order — but do NOT create or modify any files. Present the plan and exit.
2. If the first word is `resume` — read `.planning/STATE.md` and continue from the last recorded position. Skip to the appropriate build step.
3. If the first word is exactly `framework`, `app`, or `plugin` — use it as the target. The rest is the spec path or plugin name.
4. If no explicit target keyword, auto-detect:
   a. `specifications/*.md` files exist → **framework**
   b. `.planning/app-spec.md` exists → **app**
   c. Both exist → ask the user which to build
   d. Argument matches a plugin name, `#N` pattern, or spec file path → **plugin**
5. If no specs found and no recognizable argument → tell the user: "No specifications found. Run `/moku:plan` first to create a plan."

For **plugin** targets, resolve the argument:
- `#N` → find `specifications/0N-*.md` (e.g., `#3` → `specifications/03-*.md`)
- `#N-#M` → find all specs from N to M (e.g., `#3-#5` → specs 03, 04, 05)
- `#N,#M,#P` → find specific specs (e.g., `#3,#5,#7`)
- A name like `auth` → search `specifications/*-auth.md` or build from description
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

**Flow**: Read specs -> Wave analysis -> For each wave: git checkpoint, spawn sub-agents per plugin, verify (moku-verifier), update framework files (config.ts, index.ts, package.json), run integration checks (format, lint, tsc, build), gap closure if needed -> Final verification -> Post-build validation pipeline (spec, jsdoc, plugin-spec, test, type, architecture validators) -> Report + STATE.md update.

### Context Budget Management

After each wave, assess context usage:
1. If 3+ waves have been completed in this session, the context is getting heavy
2. Write STATE.md with current progress and suggest:
   > "Context is getting heavy. I've completed Waves 1-[N] ([list of plugins]). Run `/moku:build resume` to continue with fresh context from Wave [N+1]."
3. On `resume`, read STATE.md, skip completed waves, continue from next wave

### Quality Requirements

- Full JSDoc on ALL source files (functions, types, interfaces)
- `import type` for type-only imports
- Plugin index.ts must be ~30 lines of wiring
- Every plugin must have unit + integration tests
- All tests must pass
- Biome and ESLint must pass with zero warnings
- Follow the exact complexity tier specified in the plan
- Never use explicit generics on `createPlugin` — see moku-plugin skill
- NO unnecessary `onStart`/`onStop` — only when managing actual resources (servers, connections, listeners)

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
