# Framework Build — Detailed Steps

## Step 1: Read and Validate the Plan

Read the specification from the provided path (defaults to `specifications/`). If a directory, read `01-*.md`, `02-*.md`, etc. in order. Verify it contains:
- Global Config and Events types
- Plugin list with implementation order
- Plugin specifications with configs, states, APIs, events

If the plan is incomplete, ask the user to run `/moku:plan framework` first.

## Step 2: Wave Analysis

Analyze all plugin specifications and group into dependency-aware waves:

```
1. Read all specifications/0N-*.md files
2. Parse dependency graph from each spec's Dependencies section
3. Group into waves:
   Wave 1: Plugins with NO dependencies (can build in parallel)
   Wave 2: Plugins depending ONLY on Wave 1 plugins (can build in parallel)
   Wave 3: Plugins depending on Wave 1-2 plugins (can build in parallel)
   ... etc.
4. If specs include Wave assignments from /moku:plan, use those
5. Otherwise, compute waves from dependency graph
```

Present the wave plan to the user:
```
Wave 1 (parallel): env [Nano], logger [Micro], configValidator [Nano]
Wave 2 (parallel): router [Standard] (-> env), content [Standard] (-> logger)
Wave 3 (sequential): renderer [Complex] (-> router, content)
```

## Step 3: Build by Waves

**Before each wave**, create a safety checkpoint: `git add -A && git commit -m "pre-wave-N: checkpoint before building [plugin list]"`. This enables rollback if the wave produces bad code.

For each wave, build all plugins in the wave. Within a wave, **spawn parallel sub-agents** for independent plugins using the Agent tool.

### Per-Plugin Executor (Sub-Agent)

Each plugin in a wave is built by a dedicated sub-agent. The sub-agent receives minimal context for fresh, focused execution:

**Agent prompt structure:**
```
You are building a Moku plugin. Follow the moku-plugin skill strictly.

## Specification
[Full contents of specifications/0N-name.md]

## Framework Config
[Contents of src/config.ts — for import paths and type references]

## Dependency Plugin Interfaces
[For each dependency: contents of src/plugins/dep-name/index.ts]

## Build Rules
- Follow complexity tier [tier] file structure exactly
- No explicit generics on createPlugin — all types inferred
- Full JSDoc on all exports with @param, @returns, @example
- Write unit tests for each domain file + integration test
- Use import type for type-only imports
- Only include onStart/onStop if spec justifies resource management

## Files to Create
[List from tier: index.ts, types.ts, state.ts, api.ts, handlers.ts, README.md, tests]

## Verification Criteria
[Contents of the ## Verification section from the spec]
```

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
7. **Write README.md** — Plugin documentation
8. **Write unit tests** — For each domain file
9. **Write integration test** — For the full plugin wiring

## Step 4: Post-Wave Verification + Integration

After each wave's sub-agents complete, run verification and integrate into the framework:

### Step 4a: Plugin Verification

1. Spawn the **moku-verifier** agent on all plugins in the wave
   - Level 1: All tier files exist
   - Level 2: Files contain real implementations (not stubs)
   - Level 3: Plugins wired correctly, lint passes, tests pass
2. If ALL plugins pass -> proceed to Step 4b
3. If ANY plugin fails -> enter Gap Closure (Step 4c)

### Step 4b: Update Framework Files + Integration Checks

After the wave's plugins pass verification, update the framework files to include them:

1. **Update `src/config.ts`** — Add the wave's plugin Config and Events types to the framework Config/Events unions
2. **Update `src/index.ts`** — Import the wave's plugins, add to `createCore` default plugins list, add to re-exports
3. **Update `package.json`** — Add any new dependencies from this wave's plugin specs

Then run integration checks in the target workspace:

1. **Format** — `bun run format` (Biome auto-formats all files)
2. **Lint** — `bun run lint` -> if errors, run `bun run lint:fix` then re-check. Manually fix anything lint:fix cannot resolve.
3. **TypeScript** — `bunx tsc --noEmit` passes with zero errors. Fix all type errors.
4. **Build** — `bun run build` compiles without errors (if build script exists)

**Loop until clean**: If any check still fails after fixes, re-run the full sequence. All checks must pass with zero errors and zero warnings before proceeding to the next wave.

Update STATE.md with wave completion + integration check results, then proceed to next wave.

### Step 4c: Gap Closure

When verification finds issues:

1. Collect all verification failures into a gap list
2. For each gap, spawn a targeted fix agent with:
   - The specific file(s) that failed
   - The verification criteria that failed
   - The relevant plugin specification
   - Instructions to fix ONLY the identified issues (no refactoring)
3. After fixes, re-run the **moku-verifier** agent on affected plugins
4. **Circuit breaker:** Maximum `gapClosureMaxRounds` (default: 2) gap closure rounds per wave. If issues persist, report to user:
   > "Some verification issues remain after 2 fix attempts. Remaining issues: [list]. Please review and fix manually, then run `/moku:build resume`."

## Step 5: Final Framework Verification

After all plugin waves are complete, framework files should already be up-to-date from Step 4b. Run a final verification:

1. Verify `src/config.ts` includes ALL plugin types from every wave
2. Verify `src/index.ts` imports and exports ALL plugins
3. Verify `package.json` has ALL dependencies
4. Run the full check suite one final time:
   - `bun run format`
   - `bun run lint` (fix any issues)
   - `bunx tsc --noEmit`
   - `bun run build`

Fix any remaining issues until all checks pass with zero errors and zero warnings.

## Step 6: Post-Build Validation Pipeline

Run the full validation suite across the completed framework:

**Parallel Group A (structure + docs):**
- **moku-spec-validator** agent — specification compliance per plugin
- **moku-jsdoc-validator** agent — documentation quality per plugin
- **moku-plugin-spec-validator** agent — structure compliance per plugin

**Parallel Group B (quality + types):**
- **moku-test-validator** agent — test quality per plugin
- **moku-type-validator** agent — TypeScript type correctness (once, whole project)

**Sequential (after A + B complete):**
- **moku-architecture-validator** agent — cross-plugin architecture (once, whole framework)

If any validator reports BLOCKER issues, enter gap closure. If only WARNINGs, include them in the report.

## Step 7: Report and State Update

Summarize what was built:
- Number of plugins created, grouped by wave
- Files created per plugin
- Validation results (pass/warn/fail per validator)
- Any issues found and fixed during gap closure
- Any remaining WARNINGs for the user to review

Update `.planning/STATE.md`:
```markdown
## Phase: build/complete
## Completed
- [x] Wave 1: [plugins] — verified — integration checks passed
- [x] Wave 2: [plugins] — verified — integration checks passed
- [x] Final framework verification passed
- [x] Post-build validation passed

## Validation Summary
- Spec compliance: PASS
- JSDoc coverage: PASS
- Plugin structure: PASS
- Test quality: PASS (2 WARNINGs)
- Type correctness: PASS
- Architecture: PASS
```
