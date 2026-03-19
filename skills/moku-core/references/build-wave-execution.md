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

**Skip pre-flight for Wave 0 only when no prior source files exist** (`src/` directory is empty or contains only skeleton stubs). If any real implementation files exist in `src/` from prior waves, run pre-flight even for Wave 0 (e.g., when re-running a specific wave with `#wave:N`).

## Step 3: Build by Waves

**Before each wave:**
1. Create a safety checkpoint: `git add -A && git commit -m "pre-wave-N: checkpoint before building [plugin list]"`. This enables rollback if the wave produces bad code.
2. Update `.planning/STATE.md`: set each plugin in this wave to status `building` and record `## Git Checkpoint: <sha>`. This enables crash detection — if a future resume finds `building` status, it knows the previous invocation crashed mid-wave.
3. **Create Task DAG for progress tracking:**
   - Create a parent task: `TaskCreate("Wave N: [plugin-list]", "Build [count] plugins in parallel")`
   - For each plugin in the wave: `TaskCreate("[name] [tier]", "Build from spec [spec-path]")`
   - Set intra-wave dependencies if any plugin in this wave depends on another in the same wave (rare but possible): `TaskUpdate(depTask, addBlockedBy: [prerequisiteTaskId])`

For each wave, build all plugins in the wave. Within a wave, **spawn parallel sub-agents** for independent plugins using the Agent tool.

**Progress updates — tell the user at these checkpoints:**
1. Before spawning agents: `"Wave [N]: Building [plugin list] ([count] plugins in parallel)..."`
2. After each agent completes: `"[plugin] built ([status]). [remaining] plugins remaining in wave."`
3. After verification: `"Wave [N] verification: [pass/fail count]. [gap closure status if applicable]"`
4. After integration checks: `"Integration checks [pass/fail]. [details if failed]"`

### Per-Plugin Executor (Sub-Agent)

Each plugin in a wave is built by a dedicated sub-agent using **Test-Driven Development (TDD)**. The sub-agent writes failing tests FIRST (derived from the spec), then implements code to make them pass. This catches spec-implementation divergence at the source rather than during post-wave verification.

**Agent prompt structure:**
```
You are building a Moku plugin using TDD. Follow the moku-plugin skill strictly.

## Specification
[Full contents of .planning/specs/0N-name.md]

## Framework Config
[Contents of src/config.ts — for import paths and type references]

## Dependency Plugin Interfaces
[For each dependency: contents of src/plugins/dep-name/index.ts]

## Design Decisions (DO NOT CONTRADICT)
[Relevant entries from .planning/decision-log.md matching this plugin name.
If no entries exist, omit this section.
These are intentional trade-off decisions — follow them, do not override.]

## Build Rules
- Follow complexity tier [tier] file structure exactly
- No explicit generics on createPlugin or createCorePlugin — all types inferred
- For core plugins: use createCorePlugin, NOT createPlugin. No depends/events/hooks.
- Full JSDoc on all exports with @param, @returns, @example
- Use import type for type-only imports
- Only include onStart/onStop if spec justifies resource management
- Write all tests inside the plugin directory: `__tests__/unit/` and `__tests__/integration/`
- Do NOT create tests in root `tests/` — that directory is for framework-level tests only

## TDD Protocol — RED → GREEN → REFACTOR
Follow the full TDD protocol from the moku-testing skill:
Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-testing/references/tdd-protocol.md`

Summary of the four phases:
1. **TYPES**: Write types.ts + skeleton index.ts (stubs only, enough for test imports)
2. **RED**: Write all unit + integration tests FIRST. Run tests — they MUST fail. If any pass on stubs, strengthen them.
3. **GREEN**: Implement state.ts, api.ts, handlers.ts. Update index.ts. Run tsc. Run tests — they MUST all pass. Fix implementation, not tests.
4. **REFACTOR**: Clean up index.ts (~30 lines), write README.md placeholder.

## Files to Create
[List from tier: types.ts, index.ts (skeleton), tests, state.ts, api.ts, handlers.ts, index.ts (final), README.md]

## Verification Criteria
[Contents of the ## Verification section from the spec]

## Output Contract
When you are done, end your response with a fenced `json` code block:
```json
{
  "agent": "builder",
  "plugin": "[plugin-name]",
  "verdict": "PASS | FAIL | PARTIAL",
  "tdd": {
    "redPhaseTests": 12,
    "redPhaseFailing": 12,
    "greenPhaseTests": 12,
    "greenPhasePassing": 12
  },
  "filesCreated": ["types.ts", "api.test.ts", "state.test.ts", "api.ts", "state.ts", "index.ts", "..."],
  "testsPass": true,
  "lintPass": true,
  "issues": [{"file": "path", "message": "description"}]
}
```
- `verdict`: PASS (all files created, tests pass, lint clean), FAIL (critical files missing or unresolvable errors), PARTIAL (some files created but hit turn limit or unresolved issues)
- `tdd`: TDD metrics — `redPhaseTests`/`redPhaseFailing` (how many tests existed and failed after Phase 2), `greenPhaseTests`/`greenPhasePassing` (how many tests existed and passed after Phase 3). If red == failing and green == passing, TDD was followed correctly.
- `issues`: list any problems encountered (test failures, lint errors, type errors). Empty array if none.
```

### Agent Turn Limits

Set appropriate turn limits based on plugin complexity tier when spawning builder sub-agents. TDD adds ~30% more turns (writing tests first, running them twice):

| Tier | maxTurns | Rationale |
|------|----------|-----------|
| Nano | 25 | 1-2 files + tests, minimal logic |
| Micro | 40 | 2-4 files + tests, simple logic |
| Standard | 55 | 5-8 files + tests, domain separation |
| Complex | 70 | 8-12 files + tests, sub-modules |
| VeryComplex | 80 | 12+ files + tests, multiple sub-domains |

If the agent approaches its turn limit with incomplete files, it should prioritize completing the **GREEN phase** (making existing tests pass). Priority order: types.ts > index.ts (skeleton) > tests > state.ts > api.ts > handlers.ts > index.ts (final) > README.md. Tests come before implementation because failing tests still provide value as a spec — incomplete implementation with good tests is better than complete implementation with no tests.

**Parallel execution within waves:**
- Wave 1 plugins have no dependencies on each other — spawn all agents simultaneously
- Wave 2 plugins may share Wave 1 dependencies but not each other — spawn all simultaneously
- For waves with < 4 plugins: all parallel
- For waves with 4+ plugins: batch into groups of `maxParallelAgents` (default: 3) parallel agents

### Plugin Implementation Order (per sub-agent) — TDD

Each sub-agent builds its plugin using **Test-Driven Development** in four phases. See `${CLAUDE_PLUGIN_ROOT}/skills/moku-testing/references/tdd-protocol.md` for the full protocol.

| Phase | Steps | Key Output |
|-------|-------|------------|
| **1. TYPES** | Create dir → types.ts → index.ts (skeleton with stubs) | Type foundation, imports resolve |
| **2. RED** | Unit tests → integration test → run tests (must FAIL) | Executable spec, all tests failing |
| **3. GREEN** | state.ts → api.ts → handlers.ts → update index.ts → tsc → run tests (must PASS) | Real implementation, all tests passing |
| **4. REFACTOR** | Review index.ts (~30 lines) → README.md placeholder | Clean structure |

**Critical rules:**
- Phase 2 tests MUST fail on stubs. If they pass, strengthen the tests.
- Phase 3 fixes the *implementation*, never the tests — tests encode the spec.
- No explicit generics on `createPlugin(`. Verify lifecycle necessity (`onStart`/`onStop` only if spec justifies).

### Per-Plugin Tracking

After each wave's sub-agents return, parse the output contract JSON from each agent's response and update both STATE.md and Task progress per-plugin:

1. **verdict: PASS** (all files created, tests pass, lint clean) → mark plugin as `built` in STATE.md, `TaskUpdate(pluginTask, status: "completed")`
2. **verdict: PARTIAL** (some files created, hit turn limit, or unresolved issues) → mark plugin as `agent-incomplete` in STATE.md, keep task as `in_progress`
3. **verdict: FAIL or no output contract found** (crashed, context exhausted, critical failures) → mark plugin as `agent-failed` in STATE.md, keep task as `in_progress`

After all plugins in the wave are tracked, update the parent wave task:
- All PASS → `TaskUpdate(waveTask, status: "completed")`
- Mixed results → keep wave task as `in_progress` with updated description noting failures

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
