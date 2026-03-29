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

Use `EnterPlanMode` before presenting the wave plan. This activates the read-only plan approval UI, giving the user a visually distinct review experience for the wave assignment:

```
Wave 0 (core): log [Core], env [Core]
Wave 1 (parallel): configValidator [Nano]
Wave 2 (parallel): router [Standard] (-> env via core), content [Standard]
Wave 3 (sequential): renderer [Complex] (-> router, content)
```

After presenting the full wave plan with dependency rationale, call `ExitPlanMode` to return to normal mode. The plan mode approval UI lets the user review and approve the wave assignments before any code is written. After approval, proceed to pre-flight and wave execution.

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
   - Create a parent task: `TaskCreate("Wave N: [plugin-list]", "Build [count] plugins in parallel", activeForm: "Building Wave N...")`
   - For each plugin in the wave: `TaskCreate("[name] [tier]", "Build from spec [spec-path]", activeForm: "Building [name]...")`
   - Set intra-wave dependencies if any plugin in this wave depends on another in the same wave (rare but possible): `TaskUpdate(depTask, addBlockedBy: [prerequisiteTaskId])`

For each wave, build all plugins in the wave. Within a wave, **spawn parallel sub-agents** for independent plugins using the Agent tool.

**Progress updates — tell the user at these checkpoints:**

Normal mode:
1. Before spawning agents: `"Wave [N]: Building [plugin list] ([count] plugins in parallel)..."`
2. After each agent completes: `"[plugin] built ([status]). [remaining] plugins remaining in wave."`
3. After verification: `"Wave [N] verification: [pass/fail count]. [gap closure status if applicable]"`
4. After integration checks: `"Integration checks [pass/fail]. [details if failed]"`

Lean mode (single line per wave, details only on failure):
- Success: `"W[N]: [plugin-list] → PASS. Verified. Integration OK."`
- Failure: `"W[N]: [plugin-list] → [pass-count]/[total] PASS, [fail-list] FAIL. [error summary]."`

### Per-Plugin Executor (Sub-Agent)

Each plugin in a wave is built by a dedicated sub-agent using **Test-Driven Development (TDD)**. The sub-agent writes failing tests FIRST (derived from the spec), then implements code to make them pass. This catches spec-implementation divergence at the source rather than during post-wave verification.

**Agent prompt — select based on lean mode:**

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/build-lean-mode.md` for lean mode details. When lean mode is active, use the lean prompt. Otherwise use the normal prompt.

#### Normal prompt (default):
```
You are building a Moku plugin using TDD. Follow the moku-plugin skill strictly.

## Specification
[Full contents of .planning/specs/0N-name.md]

## Framework Config
[Contents of src/config.ts — for import paths and type references]

## Dependency Plugin Interfaces
[For each dependency: contents of src/plugins/dep-name/index.ts]

## Design Decisions (DO NOT CONTRADICT)
[Relevant entries from .planning/decisions.md matching this plugin name.
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
```

#### Lean prompt (~56% smaller):
```
Build Moku plugin [name] ([tier]). TDD: types→red→green→refactor. No explicit generics. import type. JSDoc. Tests in __tests/.

## Spec
[Overview paragraph from spec]
Config: [## Config section content]
API: [## API section content]
Events: [## Events section content, or "None"]
Depends: [## Dependencies plugin names, or "None"]

## Types Context
[Only export type Config and export type Events blocks from src/config.ts]

## Dep Interfaces
[Only export type Api from each dependency's types.ts]

## Decisions
[Relevant decision-log entries, or omit section entirely]
```

#### Output contract (same for both modes):
```
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
  "intent": {
    "types.ts": "Defines Config with basePath/trailingSlash, State with routes Map and currentPath, Api with navigate/current/back methods, Events with router:navigated payload",
    "state.ts": "Creates initial state: empty routes Map, currentPath from config.basePath. No mutations in factory — all mutations happen in api.ts",
    "api.ts": "navigate() updates currentPath, pushes old path to history, emits router:navigated. current() returns currentPath. back() pops history.",
    "index.ts": "Wires createState + createApi + createHandlers. Depends on [dep]. No onStart/onStop — no resources to manage."
  },
  "filesCreated": ["types.ts", "api.test.ts", "state.test.ts", "api.ts", "state.ts", "index.ts", "..."],
  "testsPass": true,
  "lintPass": true,
  "issues": [{"file": "path", "message": "description"}]
}
```
- `verdict`: PASS (all files created, tests pass, lint clean), FAIL (critical files missing or unresolvable errors), PARTIAL (some files created but hit turn limit or unresolved issues)
- `tdd`: TDD metrics — `redPhaseTests`/`redPhaseFailing` (how many tests existed and failed after Phase 2), `greenPhaseTests`/`greenPhasePassing` (how many tests existed and passed after Phase 3). If red == failing and green == passing, TDD was followed correctly.
- `intent`: **"Explain Your Code" — per-file intent summary.** One sentence per source file (not test files) explaining WHAT the code does and WHY it's structured this way. The code reviewer compares these intent statements against the spec — mismatches between stated intent and spec expectations are high-confidence bugs.
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
- For waves with ≤ `maxParallelAgents` plugins: all parallel
- For waves with more plugins: batch into groups of `maxParallelAgents` (default: 5) parallel agents

**Auto-throttle:** If the current wave is Wave 3+ and `--continue` mode is active, reduce effective parallelism to `min(maxParallelAgents, 3)` to conserve context window. Long continuous builds accumulate context from multiple waves — throttling prevents context exhaustion in later waves.

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

### Wave Pipelining (Build N+1 While Verifying N)

When `--continue` mode is active and the project has ≥ 3 waves, overlap building wave N+1 with verifying wave N. This yields ~30-50% throughput improvement on multi-wave builds.

#### Why Pipelining Works

Wave N+1 builder agents need these from wave N:
- **types.ts** — type definitions for dependency plugin interfaces
- **index.ts** — the plugin export (for `import { dep } from "../dep"`)

Both of these files are written during wave N's **build phase** (Step 3) and are available on disk before verification starts. Verification (Step 4a–4c) rarely modifies these files — it fixes implementation bugs in state.ts, api.ts, handlers.ts. So wave N+1 builders can safely read wave N's interfaces while wave N is being verified.

#### When Pipelining Activates

All of these must be true:
1. `--continue` mode is active (pipelining requires uninterrupted execution)
2. Total waves ≥ 3 (2-wave projects don't save enough to justify the complexity)
3. Wave N build completed with ALL plugins `built` (no `agent-failed` or `agent-incomplete` — those would leave incomplete interfaces on disk)
4. Wave N+1 exists (not the last wave)
5. Current context usage is < 60% (pipelining doubles the active agent count — don't pipeline if context is getting large)

If ANY condition is false, fall back to sequential: finish wave N verification → start wave N+1 build.

#### Pipeline Execution Flow

```
Sequential (default):
  Build N → Verify N → Integrate N → Build N+1 → Verify N+1 → ...

Pipelined:
  Build N → [Verify N ─────────────] → Integrate N → ...
              [Build N+1 ──────────] ↗ Verify N+1 → ...
                                    Wait point
```

**Steps:**

1. **Wave N build completes** — all plugins `built`. Create git checkpoint.
2. **Start pipeline** — spawn two concurrent groups:
   - **Group V**: Wave N verification (verifier + code reviewer in parallel, per Step 4a)
   - **Group B**: Wave N+1 builders (per-plugin sub-agents, per Step 3)
3. **Wait for both groups** — collect output contracts from all agents
4. **Pipeline reconciliation** (see below):
   - Check if wave N gap closure modified any interfaces that wave N+1 depends on
   - If safe → proceed with wave N+1 verification
   - If invalidated → re-spawn affected wave N+1 builders

#### Pipeline State Tracking

Update STATE.md during pipelining:

```markdown
## Pipeline Status
- Wave [N]: verifying (build complete, verification in progress)
- Wave [N+1]: building (pipelined start, pending verification)
- Interface files at pipeline start: [list of wave N types.ts/index.ts hashes]
```

After reconciliation, remove the `## Pipeline Status` section and update plugin statuses normally.

#### Pipeline Reconciliation

After both Group V and Group B complete:

1. **Check wave N verification result**:
   - **PASS (no gap closure needed)**: Wave N interfaces are unchanged. Wave N+1 builds are valid. Proceed to wave N integration (Step 4b), then wave N+1 verification.
   - **Gap closure needed but interfaces unchanged**: Check if gap closure modified any `types.ts` or `index.ts` file in wave N plugins. If NOT modified → wave N+1 builds are valid.
   - **Gap closure modified interfaces**: Identify which wave N plugins had their `types.ts` or `index.ts` changed. Find wave N+1 plugins that depend on those modified plugins. **Invalidate and re-build** only the affected wave N+1 plugins. Unaffected wave N+1 plugins keep their build results.

2. **Interface change detection**:
   ```bash
   # Compare interface file hashes before and after gap closure
   # Hashes were recorded in ## Pipeline Status at pipeline start
   shasum src/plugins/{wave-N-plugin}/types.ts src/plugins/{wave-N-plugin}/index.ts
   ```
   If any hash differs from the recorded value → that plugin's interface changed.

3. **Invalidation is surgical**: Only re-build wave N+1 plugins whose DIRECT dependencies had interface changes. Transitive dependencies don't matter (wave N+1 plugins import from direct deps only).

4. **If invalidation affects > 50% of wave N+1 plugins**: Discard ALL wave N+1 builds and restart wave N+1 from scratch. Partial rebuilds when most code is invalid waste more context than a clean restart.

#### Pipeline + Auto-Throttle

When pipelining is active, the effective parallelism is split between Group V and Group B:
- Group V gets `ceil(maxParallelAgents / 2)` slots (verification needs fewer agents)
- Group B gets `floor(maxParallelAgents / 2)` slots (builders are the bottleneck)
- Total active agents never exceeds `maxParallelAgents`

Example with `maxParallelAgents: 5`:
- Group V: 3 slots (verifier + code reviewer + 1 spare)
- Group B: 2 builder agents (remaining wave N+1 plugins queue)

#### Pipeline + Gap Closure Interaction

If wave N enters gap closure (Step 4c):
- **Wave N+1 builders continue running** — gap closure is a wave N concern
- After gap closure completes, run reconciliation as described above
- If gap closure triggers **fresh-context retry** (Step 4c2): pipeline stops. Wave N+1 builds are DISCARDED (the session is stopping anyway). On resume, wave N retries first, then wave N+1 rebuilds normally.
- If gap closure triggers **wave judge stop-for-review**: pipeline stops. Wave N+1 build results are PRESERVED in STATE.md with status `pipeline-built` (not yet verified). On resume, reconciliation runs first to check if wave N changes invalidated any wave N+1 builds.

#### New Plugin Status: `pipeline-built`

Add a new status value for plugins built during pipelining but not yet verified:

```
pipeline-built → built (after reconciliation confirms interfaces valid)
pipeline-built → building (after reconciliation invalidates — re-build needed)
```

On resume, treat `pipeline-built` as: "built during a previous pipeline, needs reconciliation before verification."

#### When NOT to Pipeline

Even when conditions are met, skip pipelining if:
- Wave N has any `needs-manual` plugins (manual intervention likely changes interfaces)
- Wave N is the skeleton build (skeleton verification must complete before any plugin build)
- Wave N+1 has a single plugin with VeryComplex tier (one large agent is harder to invalidate/restart than several small ones)

---

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
