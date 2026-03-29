# Build: Post-Wave Verification & Gap Closure (Step 4)

After per-plugin tracking is complete, run verification on successfully built plugins.

## Step 4a: Plugin Verification + Code Review (Parallel)

Only verify plugins with status `built`. Skip `agent-incomplete`, `agent-failed`, and `needs-manual` plugins.

### Lazy Validation (Hash-Based Skip)

Before spawning validators, check if any `built` plugins are unchanged since a prior successful verification (e.g., on resume after a crash mid-verification):

1. Compute current hash for each `built` plugin: `find src/plugins/{name} -type f -name '*.ts' | sort | xargs shasum | shasum | cut -d' ' -f1`
2. Compare against the `Hash` column in STATE.md's plugins table
3. If hash matches AND the plugin was previously `verified` (now set back to `built` due to crash recovery) → skip verification, restore `verified` status. Log: `"Lazy skip: {name} unchanged since last verification (hash: {short})"`
4. If hash doesn't match OR no prior hash exists → verify normally

This saves 50-70% on resume builds where most plugins haven't changed. Only newly built or modified plugins go through the full verification pipeline.

**Spawn both agents simultaneously** — the verifier and code reviewer read the same files independently. Running them in parallel saves ~15-20% per wave compared to sequential execution.

1. **In parallel**, spawn:
   - **moku-verifier** agent on all `built` plugins in the wave (Level 1: files exist, Level 2: real implementations, Level 3: wired correctly + lint + tests)
   - **moku-code-reviewer** agent with the wave's git diff, specs, plugin list, and builder intent summaries
2. Wait for BOTH to complete
3. Parse verifier results: update status `built` → `verified` (pass) or `built` → `verify-failed` (fail)
4. If ANY plugin is `verify-failed` → enter Gap Closure (Step 4c). Code review findings are DEFERRED until after gap closure resolves verification failures (reviewing code that will be rewritten is wasted effort). After gap closure succeeds, check if the code-reviewer already ran — if yes, filter its findings to exclude files that were modified during gap closure and re-review only those modified files.
5. If ALL verified → proceed to Step 4a2 (triage of code review findings)

## Step 4a2: Code Review Triage

Process the **moku-code-reviewer** findings (already completed in parallel above):

The code reviewer was already spawned in parallel with the verifier (Step 4a). Its output is now ready.

1. **Route findings through Interactive Triage** — read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/build-findings-triage.md` and follow the triage flow:
   - `verdict: PASS` → skip triage, proceed to Step 4b
   - `verdict: ISSUES` or `verdict: BLOCKER` → present findings interactively via the triage flow
   - Triage decisions determine what enters gap closure ("Fix now"), what is deferred ("Fix later"), and what is dismissed ("Not an issue")
   - Only "Fix now" findings route to Gap Closure (Step 4c)
3. Before triage, check `.planning/build/findings.md` for carry-forward findings from previous waves that affect files modified in this wave — re-surface them in the triage.

**Skip code review for Wave 0** if it contains only Nano/Micro core plugins (low complexity, minimal logic to review).

**Code review findings (including triage decisions) feed into the wave judge** — the judge receives verifier results, code review findings, AND triage outcomes (fix/defer/dismiss counts) for its evaluation.

## Step 4a3: Conflict Resolution

After both verifier (Step 4a) and code reviewer (Step 4a2) return, check for conflicts between their findings. Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/build-conflict-resolution.md` for the full protocol.

1. Build the per-file findings matrix from both output contracts
2. Detect verdict, severity, or contradictory-fix conflicts (same file, line ±5)
3. Resolve each conflict: information gap → re-run, genuine trade-off → ask user, false positive → dismiss
4. Record trade-off decisions in `.planning/decisions.md` (see Decision Knowledge Graph)
5. Only resolved findings proceed to gap closure or wave judge

**Skip conflict resolution** when both validators agree (both PASS, or findings are on different files with no overlap).

---

## Step 4b: Update Framework Files + Integration Checks

After the wave's plugins pass verification, update the framework files to include them. See **`build-assembly.md`** for the full barrel structure and index.ts manifest patterns.

1. **Update `src/config.ts`** — Add the wave's plugin Config and Events types to the framework Config/Events unions. For core plugins (Wave 0): add them to the `createCoreConfig({ plugins: [...] })` call and `pluginConfigs` if config overrides needed.
2. **Update `src/plugins/index.ts`** — Import the wave's plugins from their directories, add to barrel re-exports. See `build-assembly.md` Step 4b-barrel.
3. **Update `src/index.ts`** — Import from `./plugins`, add regular plugins to `createCore` default plugins list, add to grouped export sections. See `build-assembly.md` Step 4b-index. Core plugins are already registered in config.ts.
4. **Update `package.json`** — Add any new dependencies from this wave's plugin specs

Then run integration checks in the target workspace:

1. **Format** — `bun run format` (Biome auto-formats all files)
2. **Lint** — `bun run lint` -> if errors, run `bun run lint:fix` then re-check. Manually fix anything lint:fix cannot resolve.
3. **TypeScript** — `bunx tsc --noEmit` passes with zero errors. Fix all type errors.
4. **Build** — `bun run build` compiles without errors (if build script exists)

**Loop until clean**: If any check still fails after fixes, re-run the full sequence. All checks must pass with zero errors and zero warnings before proceeding.

## Step 4b2: Spec Regression Testing

After integration checks pass, re-verify ALL previously verified plugins — not just the current wave. New code (framework file updates, dependency changes, barrel modifications) can break previously passing plugins.

### When to Run

- **Skip for Wave 0**: No prior plugins exist to regress.
- **Run for Wave 1+**: Every wave after Wave 0 runs regression testing.
- **Lazy skip (hash-based)**: Use content hashes from STATE.md (Step 4d2). Skip regression tests for a previously verified plugin if ALL of these are true:
  1. The plugin's own hash hasn't changed
  2. None of its dependency plugins were modified in the current wave
  3. Framework files (`src/config.ts`, `src/plugins/index.ts`, `src/index.ts`) were NOT modified in this wave
- **If ANY framework file changed**: re-test ALL previously verified plugins regardless of hash (framework file changes can break any plugin).

### Regression Test Procedure

1. **Identify regression scope**: Read STATE.md plugins table. Collect all plugins with status `verified` from previous waves (NOT the current wave — those were just verified in Step 4a).

2. **Check framework file changes**: Did this wave modify `src/config.ts`, `src/plugins/index.ts`, or `src/index.ts`?
   - **Yes** → run regression on ALL previously verified plugins
   - **No** → run regression only on previously verified plugins whose dependencies include a plugin from the current wave (transitive dependencies count)

3. **Run targeted tests**: For each plugin in regression scope:
   ```bash
   bun test src/plugins/{name}/
   ```
   This runs the plugin's unit + integration tests. No need to re-run the full verifier — tests are the fastest regression signal.

4. **Check results**:
   - **All pass** → proceed to Step 4c (gap closure) or Step 4c3 (wave judge)
   - **Any fail** → this is a regression. Classify:
     - **Type error** (tsc fails on previously passing code) → the current wave broke a type contract
     - **Test failure** (tests fail that previously passed) → the current wave broke behavior
     - **Import error** (module not found, missing export) → barrel or wiring issue

5. **Route regressions**:
   - If regression is caused by a framework file change (config.ts, index.ts, barrel) → fix the framework file, not the regressed plugin
   - If regression is caused by a dependency plugin's API change → flag as a BLOCKER: "Wave [N] plugin [X] changed its API, breaking Wave [M] plugin [Y]. Fix [X]'s API to be backward-compatible or update [Y]'s usage."
   - Route all regressions through gap closure (Step 4c) with category `regression` — the error-diagnostician should know this is a regression, not a build failure

### Regression Output

Add a `regression` field to the wave's verification record in STATE.md:

```markdown
## Wave [N] Regression
- Scope: [count] previously verified plugins tested
- Result: PASS | [count] regressions found
- Details: [plugin]: [test file] — [failure description]
```

### Performance Optimization

For large projects (> 10 previously verified plugins), batch the regression tests:
```bash
# Run all previously verified plugin tests in one command
bun test src/plugins/router/ src/plugins/auth/ src/plugins/cache/ ...
```

This is much faster than spawning per-plugin test runs.

---

## Step 4c: Gap Closure

When verification finds issues (plugins with status `verify-failed`):

1. Collect all verification failures into a gap list
2. Spawn the **moku-error-diagnostician** agent with the error output to classify root causes and propose targeted fixes
3. Apply the diagnostician's proposed fixes (root causes first — cascading errors resolve automatically)
4. **Re-run the original validator** that found the blocker (not just the verifier). Map the diagnostician's error category to the originating validator:
   - `type-inference`, `import-type` → **moku-type-validator**
   - `test-mock`, `test-assertion` → **moku-test-validator**
   - `anti-pattern`, `config-shape`, `lifecycle`, `event-type` → **moku-spec-validator**
   - `lint-format` → no agent needed, just re-run `bun run lint`
   - `missing-export`, `dependency` → **moku-verifier** (Level 3 wiring checks)
5. After the targeted validator passes, re-run the **moku-verifier** agent on affected plugins for final confirmation
6. **Integration re-check**: Re-run the integration check suite (`bun run format`, `bun run lint`, `bunx tsc --noEmit`) to ensure the fix didn't introduce new integration-level issues. If integration fails, route back through the diagnostician (this counts toward the circuit breaker).
7. Update status: `verify-failed` → `verified` (pass) or remains `verify-failed` (still failing)
8. **Stalemate Detection + Alternative Strategy:** Before each gap closure round, record the error state AND the strategy used. After applying fixes, compare:
   - **Error count increased**: STALEMATE — fixes are making things worse
   - **Error signatures identical**: For `tsc` errors, two errors are the same signature if they share the same file path, the same error code (e.g., `TS2345`), and a line number within ±3 lines of each other. For test failures, same test name (exact match). For lint errors, same rule + same file. Hash `(file, errorCode, lineRange)` per error for comparison between rounds.
   - **Diagnostician proposed identical fix** to a previous round: STALEMATE — fixation detected

   **On stalemate — force Alternative Strategy before fresh-context retry:**

   a. **Record what was tried** — append to `.planning/build/strategy-log.md`:
      ```markdown
      ## Wave [N], Plugin [name], Round [R]
      - Strategy: [brief description of the approach — e.g., "added explicit type annotation to api.ts:42"]
      - Error: [error signature]
      - Result: STALEMATE — same error persists
      ```

   b. **Generate alternative strategies** — the error-diagnostician MUST propose a fundamentally different approach. Provide it with the strategy log so it can see what was already tried. "Fundamentally different" means:
      - If the previous strategy modified the implementation → try modifying the types instead
      - If the previous strategy added code → try removing/simplifying code instead
      - If the previous strategy worked around the issue → try fixing the root cause directly
      - If the previous strategy changed one file → try changing a different file in the dependency chain
      - If all local strategies are exhausted → propose restructuring (e.g., split a Standard plugin into two Micro plugins, change the dependency direction, merge with a related plugin)

   c. **Apply the alternative strategy** — this counts as the next gap closure round (not a free extra attempt)

   d. **If alternative strategy also fails (second stalemate on same error)** → skip to Fresh-Context Retry (Step 4c2) with both strategies recorded in the `## Fresh Retry Context`. Log: `[STUCK-LOOP] Wave N, plugin X: 2 strategies failed for same error after round Y`

   e. **Strategy diversity check**: Before the diagnostician proposes a fix, compare it against `.planning/build/strategy-log.md`. If the proposed fix has >80% text similarity to a previously attempted fix for the same error, REJECT it immediately and demand an alternative. This prevents the "same fix with slightly different wording" loop.

9. **Circuit breaker:** Maximum `gapClosureMaxRounds` (default: 2) gap closure rounds per wave. If issues persist after all rounds (and no stalemate detected earlier), enter **Fresh-Context Retry** (Step 4c2).

## Step 4c2: Fresh-Context Retry (Ralph Wiggum Loop)

When gap closure exhausts its rounds and plugins still have `verify-failed` status, the accumulated conversation context may be causing the agent to fixate on a wrong approach. A fresh context with only the error summary often produces better fixes.

**Procedure:**

1. **Collect the error summary** — For each `verify-failed` plugin, record:
   - Plugin name and tier
   - The specific errors (tsc output, test failures, lint errors)
   - What fixes were attempted and why they didn't work
   - **Strategy history** from `.planning/build/strategy-log.md` — what approaches were tried and why they failed
   - The relevant spec section (`## Verification` from `.planning/specs/0N-name.md`)

2. **Save to STATE.md** — Add a `## Fresh Retry Context` section:
   ```markdown
   ## Fresh Retry Context
   Plugins needing fresh-context retry: [plugin-list]
   Error summary:
   - [plugin]: [tsc error TS2345 in api.ts:42 — attempted fix X, still fails because Y]
   Attempted strategies (DO NOT RETRY THESE):
   - Strategy 1: [description] — Result: [why it failed]
   - Strategy 2: [description] — Result: [why it failed]
   Gap closure rounds exhausted: [N]
   Constraint: The fresh-context agent MUST try a fundamentally different approach from the listed strategies.
   ```

3. **Set status** — Mark affected plugins as `retry-pending` in the plugins table. Set:
   ```markdown
   ## Next Action: Run /moku:build resume (fresh-context retry for [plugin-list])
   ```

4. **Stop the current session** — Tell the user:
   > "Gap closure exhausted after [N] rounds for [plugin-list]. Saving error context for fresh-context retry. Run `/moku:build resume` — the next session will attempt fixes with a clean context window, which often resolves fixation loops."

   **Fresh-Context Retry always stops the current session regardless of `--continue` mode.** This is a safety boundary — the entire point is to get a fresh context window. `--continue` does not override this stop.

5. **On resume** — When `/moku:build resume` detects `retry-pending` plugins:
   - Read the `## Fresh Retry Context` section from STATE.md
   - Read `.planning/build/strategy-log.md` for full strategy history
   - Spawn the **moku-error-diagnostician** agent with ONLY:
     - The error summary (not the full conversation history)
     - The plugin spec
     - The current source files on disk
     - **The strategy history with explicit instruction: "These strategies were already tried and failed. You MUST propose a fundamentally different approach."**
   - Apply the diagnostician's fixes
   - Re-run verification (Step 4a)
   - If verification passes → mark as `verified`, remove `## Fresh Retry Context`
   - If verification still fails → mark as `needs-manual` and report to user:
     > "Fresh-context retry also failed for [plugin-list]. Remaining issues: [list]. Please review and fix manually, then run `/moku:build resume`."

**Why this works:** Agents within a long context tend to repeat the same failed approaches. A fresh session sees only the error + spec + current code, avoiding the cognitive fixation that builds up over multiple failed attempts. This is the "Ralph Wiggum Loop" pattern — deterministic verification as the halting condition, with fresh context on each iteration.

## Step 4c3: Wave Judge Evaluation

After gap closure completes (or if verification passed with no gap closure needed), spawn the **moku-wave-judge** agent to evaluate whether to proceed:

1. Provide the judge with:
   - Wave number and plugin list
   - Verification results (from moku-verifier)
   - Code review findings (from moku-code-reviewer, if run in Step 4a2)
   - Gap closure history (if any — error counts per round, what was attempted, stalemate detection results)
   - Integration check results (tsc, lint, test output)
2. Parse the judge's decision:
   - `continue` → proceed to Step 4d (spec verification ticking)
   - `stop-for-review` → save state and use `AskUserQuestion`:
     - **`--continue` mode does NOT override `stop-for-review`.** Wave judge safety stops take precedence over continuous mode. Present the AskUserQuestion even when `--continue` is active.
     - Question: "Wave judge recommends review. [judge's reasoning]. How to proceed?"
     - Header: "Review"
     - Options:
       1. label: "Continue anyway", description: "Override judge recommendation and proceed to next wave"
       2. label: "Review and fix (Recommended)", description: "Stop here — run /moku:build resume after reviewing"
       3. label: "Show details", description: "Display full judge evaluation before deciding"
     - multiSelect: false
   - After the user selects "Continue anyway," `--continue` resumes automatic wave progression. The wave judge re-evaluates each subsequent wave independently — if another `stop-for-review` occurs, the user will be asked again. A single "Continue anyway" does not disable the judge for the remainder of the build.
   - `fresh-retry` → enter Step 4c2 (Fresh-Context Retry) for affected plugins
3. Log the judge's decision to `.planning/build/agent-log.md` and `.planning/build/diagnostics.log`

**Wave judge decisions are not persisted in STATE.md.** On resume, the wave judge does NOT re-run for previously completed waves — the previous wave is considered complete (its completion state was saved in STATE.md). The judge evaluates only the CURRENT wave being built, never previous waves.

### Pipeline-Aware Decisions

When wave pipelining is active (wave N+1 is already building while wave N is being judged):

- **`continue`**: Proceed to Step 4b (integration) for wave N. After integration, run pipeline reconciliation (see `build-wave-execution.md` Wave Pipelining). If reconciliation succeeds, wave N+1 enters verification immediately.
- **`stop-for-review`**: Pipeline stops. Wave N+1 build results are **preserved** with status `pipeline-built` in STATE.md. On resume, reconciliation runs first (wave N may have changed during user review), then wave N+1 proceeds.
- **`fresh-retry`**: Pipeline stops. Wave N+1 build results are **discarded** — the session is ending for fresh context. On resume, wave N retries first, then wave N+1 rebuilds from scratch.

**Skip the judge for trivial waves** — if the wave has only 1 Nano/Micro plugin and verification passed with zero warnings, proceed directly to Step 4d.

## Step 4d: Spec Verification Ticking

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

## Step 4d2: Record Content Hashes

After spec verification ticking, compute and record a content hash for each verified plugin. This enables incremental validation — unchanged plugins can be skipped in future validation runs.

```bash
# Per-plugin hash: hash of all .ts files in the plugin directory
find src/plugins/{name} -type f -name '*.ts' | sort | xargs shasum | shasum | cut -d' ' -f1
```

Store the hash in the STATE.md plugins table as a `Hash` column: `| Name | Tier | Wave | Status | Hash |`

The validation-coordinator uses these hashes to skip per-plugin validators for unchanged plugins. Cross-plugin validators (architecture-validator) always run on the full framework regardless of hashes.

## Step 4e: Archive Completed Wave Details

After spec verification ticking and content hashes, archive the completed wave's verbose details to keep STATE.md bounded:

1. **Append to `.planning/build/STATE-history.md`** — Move the full plugins table rows for this wave's plugins (status, hash, verification notes) into the history file under a `## Wave N` header with a timestamp
2. **Collapse in STATE.md** — Replace the wave's individual plugin rows with a single summary line:
   ```
   | Wave N | 4 plugins | verified | 2025-01-15 |
   ```
3. **Keep in STATE.md** — Only the summary table, current wave details, and `needs-manual` plugins (these need visibility)

This ensures STATE.md stays under ~60 lines regardless of project size. The full history remains accessible in `STATE-history.md` for debugging.

## Step 4e2: Save Progress and Stop

**One wave per invocation (unless `--continue` mode).** After completing the wave (Steps 3 → 4a → 4b → 4d):

1. Update `.planning/STATE.md` with:
   - Wave completion status and integration check results
   - Per-plugin status (verified/needs-manual)
   - Spec verification checkbox results
   - `## Next Action: Run /moku:build resume to continue with Wave [N+1]`
2. **If `--continue` mode is active:** proceed to the next wave immediately (skip the stop). If context is getting large, stop and tell the user: `"Pausing continuous build after Wave [N]. Run /moku:build resume --continue to continue."`
3. **Otherwise, STOP and tell the user:**
   > "Wave [N] complete ([plugin list]). All integration checks pass. Run `/moku:build resume` to continue with Wave [N+1]."
4. Do NOT proceed to the next wave in the same invocation (unless `--continue`)
