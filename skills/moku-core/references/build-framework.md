# Framework Build — Detailed Steps

## Step 1: Read and Validate the Plan

Read the specification from the provided path (defaults to `.planning/specs/`). If a directory, read `01-*.md`, `02-*.md`, etc. in order. Verify it contains:
- Global Config and Events types
- Plugin list with implementation order (core plugins identified separately)
- Plugin specifications with configs, states, APIs, events
- Core plugin specifications (if any) with the simplified template

If the plan is incomplete, ask the user to run `/moku:plan framework` first.

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

## Step 3: Build by Waves

**Before each wave**, create a safety checkpoint: `git add -A && git commit -m "pre-wave-N: checkpoint before building [plugin list]"`. This enables rollback if the wave produces bad code.

For each wave, build all plugins in the wave. Within a wave, **spawn parallel sub-agents** for independent plugins using the Agent tool.

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

## Files to Create
[List from tier: index.ts, types.ts, state.ts, api.ts, handlers.ts, README.md, tests]

## Verification Criteria
[Contents of the ## Verification section from the spec]
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
7. **Write README.md** — Minimal placeholder only (plugin name + tier + one-line description). Full README is written later in the dedicated README wave (Step 5.5).
8. **Write unit tests** — For each domain file
9. **Write integration test** — For the full plugin wiring

### Per-Plugin Tracking

After each wave's sub-agents return, check each agent's result and update STATE.md per-plugin:

1. **Agent completed successfully** (all files created, no errors) → mark plugin as `built` in STATE.md
2. **Agent hit maxTurns or returned incomplete** (some files missing) → mark plugin as `agent-incomplete` in STATE.md
3. **Agent returned with errors** (crashed, context exhausted) → mark plugin as `agent-failed` in STATE.md

For `agent-incomplete` or `agent-failed` plugins:
- Do NOT route through gap closure (gap closure is for verification failures, not build failures)
- Re-spawn the builder agent with the same prompt + note about what was already created on disk
- If re-spawn also fails, mark as `needs-manual` and continue with other plugins in the wave
- `needs-manual` plugins are excluded from verification and reported to the user at the end

## Step 4: Post-Wave Verification + Integration

After per-plugin tracking is complete, run verification on successfully built plugins:

### Step 4a: Plugin Verification

Only verify plugins with status `built`. Skip `agent-incomplete`, `agent-failed`, and `needs-manual` plugins.

1. Spawn the **moku-verifier** agent on all `built` plugins in the wave
   - Level 1: All tier files exist
   - Level 2: Files contain real implementations (not stubs)
   - Level 3: Plugins wired correctly, lint passes, tests pass
2. Update status: `built` → `verified` (pass) or `built` → `verify-failed` (fail)
3. If ALL verified plugins pass → proceed to Step 4b
4. If ANY plugin is `verify-failed` → enter Gap Closure (Step 4c)

### Step 4b: Update Framework Files + Integration Checks

After the wave's plugins pass verification, update the framework files to include them:

1. **Update `src/config.ts`** — Add the wave's plugin Config and Events types to the framework Config/Events unions. For core plugins (Wave 0): add them to the `createCoreConfig({ plugins: [...] })` call and `pluginConfigs` if config overrides needed.
2. **Update `src/plugins/index.ts`** — Import the wave's plugins from their directories, add to barrel re-exports. See Step 4b-barrel below.
3. **Update `src/index.ts`** — Import from `./plugins`, add regular plugins to `createCore` default plugins list, add to grouped export sections. See Step 4b-index below. Core plugins are already registered in config.ts.
4. **Update `package.json`** — Add any new dependencies from this wave's plugin specs

#### Step 4b-barrel: `src/plugins/index.ts` Structure

The plugins barrel file is the single source for all plugin instances, helpers, and namespaced types. Create it during the first wave and extend with each subsequent wave:

```typescript
/**
 * Plugin barrel — all default plugin instances, helpers, and namespaced types.
 * @module
 */

// ─── Plugin Instances ───────────────────────────────────────
export { build } from "./build";
export { env } from "./env";
export { router } from "./router";

// ─── Helpers ────────────────────────────────────────────────
export { route } from "./router";           // builder helper (not the plugin)
export { createComponent } from "./spa";

// ─── Namespaced Types ───────────────────────────────────────
export type * as Build from "./build/types";
export type * as Router from "./router/types";
```

Rules:
- Each plugin directory exports exactly ONE `createPlugin` instance
- Helpers are exported separately from plugin instances (with comment clarifying what they are)
- Types use `export type * as Namespace from` for namespace grouping
- Only Standard+ plugins with a `types.ts` get namespace type exports

#### Step 4b-index: `src/index.ts` Self-Documenting Structure

The framework entry point must be a self-documenting manifest. Consumers should understand all available options, defaults, and exports just by reading this file.

```typescript
/**
 * @moku-labs/web — Static site generation framework.
 *
 * ## Framework Options
 * | Option | Type | Default | Description |
 * |--------|------|---------|-------------|
 * | site.url | string | "" | Site URL for SEO and feeds |
 * | mode | "ssg" | "spa" | "hybrid" | "ssg" | Rendering mode |
 *
 * ## Default Plugins
 * | Plugin | Description |
 * |--------|-------------|
 * | log | Structured logging |
 * | env | Environment detection |
 * | router | URL pattern matching and resolution |
 *
 * @example
 * ```ts
 * import { createApp } from "@moku-labs/web";
 * const app = createApp({ config: { site: { url: "..." } } });
 * ```
 * @module
 */
import { coreConfig, createCore } from "./config";
import { log, env, router, seo, pipeline, build, devServer } from "./plugins";

const framework = createCore(coreConfig, {
  plugins: [log, env, seo, router, pipeline, build, devServer],
});

// ─── Framework API ──────────────────────────────────────────
export const { createApp, createPlugin } = framework;

// ─── Plugins ────────────────────────────────────────────────
export { build, devServer, env, log, pipeline, router, seo } from "./plugins";

// ─── Helpers ────────────────────────────────────────────────
export { route } from "./plugins/router";
export { createComponent } from "./plugins/spa";

// ─── Types ──────────────────────────────────────────────────
export type * as Build from "./plugins/build/types";
export type * as Router from "./plugins/router/types";
// ... namespace type re-exports from plugins barrel
```

Rules:
- JSDoc module comment with options table showing ALL config fields with types and defaults
- Default plugins table showing what ships with the framework
- `@example` showing minimal createApp usage
- Exports grouped into 4 sections with separator comments: Framework API → Plugins → Helpers → Types
- Plugin imports come from `./plugins` barrel (not individual directories)
- Framework API section: only `createApp` and `createPlugin` from `createCore` result
- Plugins section: re-export all default plugin instances
- Helpers section: re-export builder helpers (e.g., `route`, `createComponent`)
- Types section: namespace type re-exports for consumer convenience

Then run integration checks in the target workspace:

1. **Format** — `bun run format` (Biome auto-formats all files)
2. **Lint** — `bun run lint` -> if errors, run `bun run lint:fix` then re-check. Manually fix anything lint:fix cannot resolve.
3. **TypeScript** — `bunx tsc --noEmit` passes with zero errors. Fix all type errors.
4. **Build** — `bun run build` compiles without errors (if build script exists)

**Loop until clean**: If any check still fails after fixes, re-run the full sequence. All checks must pass with zero errors and zero warnings before proceeding.

### Step 4d: Spec Verification Ticking

After integration checks pass, verify each plugin in the wave against its specification's `## Verification` section:

1. Read `.planning/specs/0N-name.md` for each verified plugin
2. Find the `## Verification` section with checkbox items
3. Evaluate each criterion:
   - "Plugin directory exists with correct tier structure" → check filesystem
   - "Config shape matches spec" → compare `types.ts` with spec
   - "API methods exist and match signatures" → compare `api.ts` with spec
   - "Events declared and emitted" → grep for `ctx.emit` and `events:` in plugin
   - "Lint/format passes" → already verified in integration checks
   - "No explicit generics" → grep for `createPlugin<`
4. Tick passing checkboxes: `- [ ]` → `- [x]`
5. Add failure notes to failing checkboxes: `- [ ] API methods — FAIL: missing navigate()`
6. Failed checkboxes → route to Gap Closure (Step 4c)

### Step 4e: Save Progress and Stop

**One wave per invocation.** After completing the wave (Steps 3 → 4a → 4b → 4d):

1. Update `.planning/STATE.md` with:
   - Wave completion status and integration check results
   - Per-plugin status (verified/needs-manual)
   - Spec verification checkbox results
   - `## Next Action: Run /moku:build resume to continue with Wave [N+1]`
2. **STOP and tell the user:**
   > "Wave [N] complete ([plugin list]). All integration checks pass. Run `/moku:build resume` to continue with Wave [N+1]."
3. Do NOT proceed to the next wave in the same invocation

### Step 4c: Gap Closure

When verification finds issues (plugins with status `verify-failed`):

1. Collect all verification failures into a gap list
2. For each gap, spawn a targeted fix agent with:
   - The specific file(s) that failed
   - The verification criteria that failed
   - The relevant plugin specification
   - Instructions to fix ONLY the identified issues (no refactoring)
3. After fixes, re-run the **moku-verifier** agent on affected plugins
4. Update status: `verify-failed` → `verified` (pass) or remains `verify-failed` (still failing)
5. **Circuit breaker:** Maximum `gapClosureMaxRounds` (default: 2) gap closure rounds per wave. If issues persist, mark remaining plugins as `needs-manual` and report to user:
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

5. Verify root `tests/` contains NO plugin-specific test directories (`tests/unit/plugins/`, `tests/integration/plugins/`). Plugin tests must be colocated inside their respective `src/plugins/[name]/__tests__/` directories.

Fix any remaining issues until all checks pass with zero errors and zero warnings.

**Save progress and STOP.** Update STATE.md: `## Next Action: Run /moku:build resume for README wave.`

## Step 5.5: README Wave

**Separate invocation.** After all plugin waves and final verification are complete, run a dedicated README wave with fresh sub-agents. This produces higher-quality documentation because each agent has full context budget for writing comprehensive READMEs.

For each plugin (fully parallel, batched by `maxParallelAgents`):
1. Spawn sub-agent with:
   - Built plugin code (index.ts, types.ts, api.ts, state.ts)
   - Framework config (`src/config.ts`)
   - Plugin specification (`.planning/specs/0N-name.md`)
   - Instruction: "Write a comprehensive README.md for this plugin"
2. Agent turn limit: 15
3. README should cover: purpose, config options, API reference, events, usage examples, integration with other plugins

After all agents complete:
- Run `bun run format` to normalize README formatting
- Update STATE.md: mark README wave complete
- **STOP.** Tell the user: `"README wave complete. Run /moku:build resume for post-build validation."`

**Important:** During individual plugin builds in framework waves (Step 3), sub-agents should create a minimal placeholder README only (plugin name + tier). The full README is written here with dedicated context.

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
- [x] Wave 0: [core plugins] — verified — integration checks passed
- [x] Wave 1: [plugins] — verified — integration checks passed — spec checkboxes ticked
- [x] Wave 2: [plugins] — verified — integration checks passed — spec checkboxes ticked
- [x] Final framework verification passed
- [x] README wave complete
- [x] Post-build validation passed

## Validation Summary
- Spec compliance: PASS
- JSDoc coverage: PASS
- Plugin structure: PASS
- Test quality: PASS (2 WARNINGs)
- Type correctness: PASS
- Architecture: PASS
```
