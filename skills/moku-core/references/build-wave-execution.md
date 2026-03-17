# Build: Wave Analysis & Execution (Steps 2–3)

## Step 2: Wave Analysis

Analyze all plugin specifications and group into dependency-aware waves:

```
1. Read all .planning/specs/0N-*.md files
2. Separate core plugin specs from regular plugin specs
3. Core plugins are always Wave 0 — built before all regular plugins, no inter-dependencies
4. Parse dependency graph from each regular spec's Dependencies section
5. Group regular plugins into waves:
   Wave 1: Plugins with NO dependencies (can build in parallel)
   Wave 2: Plugins depending ONLY on Wave 1 plugins (can build in parallel)
   Wave 3: Plugins depending on Wave 1-2 plugins (can build in parallel)
   ... etc.
6. If specs include Wave assignments from /moku:plan, use those
7. Otherwise, compute waves from dependency graph
```

Present the wave plan to the user:
```
Wave 0 (core): log [Core], env [Core]
Wave 1 (parallel): configValidator [Nano]
Wave 2 (parallel): router [Standard] (-> env via core), content [Standard]
Wave 3 (sequential): renderer [Complex] (-> router, content)
```

## Step 2.5: Pre-Flight Check

Before spawning any builder sub-agents, run a pre-flight check to catch systemic issues that would cause every agent to fail independently:

1. **Dependency check**: `bun install` — ensure all dependencies are installed
2. **TypeScript check**: `bunx tsc --noEmit` — ensure the project compiles cleanly (existing code from prior waves must pass before adding new code)
3. **Lint check**: `bun run lint` — ensure no pre-existing lint violations

**If pre-flight fails:**
- Do NOT proceed to wave execution — fixing N identical failures in N parallel agents wastes context
- Spawn the **moku-error-diagnostician** with the pre-flight error output
- Apply the diagnostician's fixes
- Re-run pre-flight until clean, then proceed to Step 3
- If pre-flight cannot be resolved after 2 rounds, report to user and stop

**If pre-flight passes:** Proceed to Step 3.

**Skip pre-flight for Wave 0** (core plugins) when no prior code exists yet — there is nothing to check.

## Step 3: Build by Waves

**Before each wave:**
1. Create a safety checkpoint: `git add -A && git commit -m "pre-wave-N: checkpoint before building [plugin list]"`. This enables rollback if the wave produces bad code.
2. Update `.planning/STATE.md`: set each plugin in this wave to status `building` and record `## Git Checkpoint: <sha>`. This enables crash detection — if a future resume finds `building` status, it knows the previous invocation crashed mid-wave.

For each wave, build all plugins in the wave. Within a wave, **spawn parallel sub-agents** for independent plugins using the Agent tool.

**Progress updates — tell the user at these checkpoints:**
1. Before spawning agents: `"Wave [N]: Building [plugin list] ([count] plugins in parallel)..."`
2. After each agent completes: `"[plugin] built ([status]). [remaining] plugins remaining in wave."`
3. After verification: `"Wave [N] verification: [pass/fail count]. [gap closure status if applicable]"`
4. After integration checks: `"Integration checks [pass/fail]. [details if failed]"`

### Per-Plugin Executor (Sub-Agent)

Each plugin in a wave is built by a dedicated sub-agent. The sub-agent receives minimal context for fresh, focused execution:

**Agent prompt structure:**
```
You are building a Moku plugin. Follow the moku-plugin skill strictly.

## Specification
[Full contents of .planning/specs/0N-name.md]

## Framework Config
[Contents of src/config.ts — for import paths and type references]

## Dependency Plugin Interfaces
[For each dependency: contents of src/plugins/dep-name/index.ts]

## Build Rules
- Follow complexity tier [tier] file structure exactly
- No explicit generics on createPlugin or createCorePlugin — all types inferred
- For core plugins: use createCorePlugin, NOT createPlugin. No depends/events/hooks.
- Full JSDoc on all exports with @param, @returns, @example
- Write unit tests for each domain file + integration test
- Use import type for type-only imports
- Only include onStart/onStop if spec justifies resource management
- Write all tests inside the plugin directory: `__tests__/unit/` and `__tests__/integration/`
- Do NOT create tests in root `tests/` — that directory is for framework-level tests only
- After writing all source files (before tests), run `bunx tsc --noEmit` and fix any type errors

## Files to Create
[List from tier: index.ts, types.ts, state.ts, api.ts, handlers.ts, README.md, tests]

## Verification Criteria
[Contents of the ## Verification section from the spec]

## Output Contract
When you are done, end your response with a fenced `json` code block:
```json
{
  "agent": "builder",
  "plugin": "[plugin-name]",
  "verdict": "PASS | FAIL | PARTIAL",
  "filesCreated": ["index.ts", "types.ts", "api.ts", "..."],
  "testsPass": true,
  "lintPass": true,
  "issues": [{"file": "path", "message": "description"}]
}
```
- `verdict`: PASS (all files created, tests pass, lint clean), FAIL (critical files missing or unresolvable errors), PARTIAL (some files created but hit turn limit or unresolved issues)
- `issues`: list any problems encountered (test failures, lint errors, type errors). Empty array if none.
```

### Agent Turn Limits

Set appropriate turn limits based on plugin complexity tier when spawning builder sub-agents:

| Tier | maxTurns | Rationale |
|------|----------|-----------|
| Nano | 20 | 1-2 files, minimal logic |
| Micro | 30 | 2-4 files, simple logic |
| Standard | 40 | 5-8 files, domain separation |
| Complex | 50 | 8-12 files, sub-modules |
| VeryComplex | 60 | 12+ files, multiple sub-domains |

If the agent approaches its turn limit with incomplete files, it should prioritize: index.ts > types.ts > api.ts > state.ts > handlers.ts > tests > README.md (core wiring first, docs last).

**Parallel execution within waves:**
- Wave 1 plugins have no dependencies on each other — spawn all agents simultaneously
- Wave 2 plugins may share Wave 1 dependencies but not each other — spawn all simultaneously
- For waves with < 4 plugins: all parallel
- For waves with 4+ plugins: batch into groups of `maxParallelAgents` (default: 3) parallel agents

### Plugin Implementation Order (per sub-agent)

Each sub-agent builds its plugin following this order:

1. **Create the plugin directory** following the specified complexity tier
2. **Write types.ts** — Config, State, API, Events types (for Standard+)
3. **Write state.ts** — `createState` factory (for Standard+)
4. **Write api.ts** — API factory (for Standard+)
5. **Write handlers.ts** — Event handlers (if hooks exist, Standard+)
6. **Write index.ts** — Plugin wiring (~30 lines, imports from domain files)
   - **Verify no explicit generics** — The `createPlugin(` call must NOT have type parameters.
   - **Verify lifecycle necessity** — Only include `onStart`/`onStop` if the spec explicitly states a resource.
7. **Incremental tsc checkpoint** — Run `bunx tsc --noEmit` after all source files are written (before tests/README). Fix any type errors immediately. This catches inference failures, import issues, and config shape mismatches early — before investing turns in tests that would fail anyway.
8. **Write README.md** — Minimal placeholder only (plugin name + tier + one-line description). Full README is written later in the dedicated README wave (Step 5.5).
9. **Write unit tests** — For each domain file
10. **Write integration test** — For the full plugin wiring

### Per-Plugin Tracking

After each wave's sub-agents return, parse the output contract JSON from each agent's response and update STATE.md per-plugin:

1. **verdict: PASS** (all files created, tests pass, lint clean) → mark plugin as `built` in STATE.md
2. **verdict: PARTIAL** (some files created, hit turn limit, or unresolved issues) → mark plugin as `agent-incomplete` in STATE.md
3. **verdict: FAIL or no output contract found** (crashed, context exhausted, critical failures) → mark plugin as `agent-failed` in STATE.md

For `agent-incomplete` or `agent-failed` plugins:
- Do NOT route through gap closure (gap closure is for verification failures, not build failures)
- Re-spawn the builder agent with the same prompt + note about what was already created on disk
- If re-spawn also fails, mark as `needs-manual` and continue with other plugins in the wave
- `needs-manual` plugins are excluded from verification and reported to the user at the end

### Resume with Fresh-Context Retry

When `/moku:build resume` detects plugins with status `retry-pending` in STATE.md:

1. Read the `## Fresh Retry Context` section from STATE.md (error summary, attempted fixes)
2. Do NOT re-run the full wave — only process the `retry-pending` plugins
3. Spawn the **moku-error-diagnostician** with a fresh, minimal prompt containing only:
   - The error summary from STATE.md
   - The plugin spec (`.planning/specs/0N-name.md`)
   - Instructions to read the current source files on disk
4. Apply fixes → re-run verification (see `build-verification.md` Step 4c2)
5. On success: mark as `verified`, remove `## Fresh Retry Context` section, continue to next wave
6. On failure: mark as `needs-manual`, report to user

This is the **Ralph Wiggum Loop** — fresh context avoids the fixation loops that occur when an agent repeatedly attempts the same failed approach within a long conversation.
