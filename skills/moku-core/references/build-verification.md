# Build: Post-Wave Verification & Gap Closure (Step 4)

After per-plugin tracking is complete, run verification on successfully built plugins.

## Step 4a: Plugin Verification

Only verify plugins with status `built`. Skip `agent-incomplete`, `agent-failed`, and `needs-manual` plugins.

1. Spawn the **moku-verifier** agent on all `built` plugins in the wave
   - Level 1: All tier files exist
   - Level 2: Files contain real implementations (not stubs)
   - Level 3: Plugins wired correctly, lint passes, tests pass
2. Update status: `built` → `verified` (pass) or `built` → `verify-failed` (fail)
3. If ALL verified plugins pass → proceed to Step 4b
4. If ANY plugin is `verify-failed` → enter Gap Closure (Step 4c)

## Step 4a2: Post-Wave Code Review + Interactive Triage

After verification passes (all target plugins are `verified`), spawn the **moku-code-reviewer** agent to review the wave's code changes:

1. Provide the code reviewer with:
   - The git diff for this wave: `git diff <pre-wave-checkpoint>..HEAD`
   - Plugin specifications from `.planning/specs/` for all plugins in this wave
   - The wave number and plugin list
2. **Route findings through Interactive Triage** — read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/build-findings-triage.md` and follow the triage flow:
   - `verdict: PASS` → skip triage, proceed to Step 4b
   - `verdict: ISSUES` or `verdict: BLOCKER` → present findings interactively via the triage flow
   - Triage decisions determine what enters gap closure ("Fix now"), what is deferred ("Fix later"), and what is dismissed ("Not an issue")
   - Only "Fix now" findings route to Gap Closure (Step 4c)
3. Before triage, check `.planning/deferred-findings.md` for carry-forward findings from previous waves that affect files modified in this wave — re-surface them in the triage.

**Skip code review for Wave 0** if it contains only Nano/Micro core plugins (low complexity, minimal logic to review).

**Code review findings (including triage decisions) feed into the wave judge** — the judge receives verifier results, code review findings, AND triage outcomes (fix/defer/dismiss counts) for its evaluation.

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
8. **Stalemate Detection:** Before each gap closure round, record the error state. After applying fixes, compare:
   - **Error count increased**: STALEMATE — fixes are making things worse
   - **Error signatures identical**: For `tsc` errors, two errors are the same signature if they share the same file path, the same error code (e.g., `TS2345`), and a line number within ±3 lines of each other. For test failures, same test name (exact match). For lint errors, same rule + same file. Hash `(file, errorCode, lineRange)` per error for comparison between rounds.
   - **Diagnostician proposed identical fix** to a previous round: STALEMATE — fixation detected
   - On stalemate: skip remaining gap closure rounds, enter Fresh-Context Retry immediately (Step 4c2). Log: `[STALEMATE] Wave N, plugin X: same errors after round Y`
9. **Circuit breaker:** Maximum `gapClosureMaxRounds` (default: 2) gap closure rounds per wave. If issues persist after all rounds (and no stalemate detected earlier), enter **Fresh-Context Retry** (Step 4c2).

## Step 4c2: Fresh-Context Retry (Ralph Wiggum Loop)

When gap closure exhausts its rounds and plugins still have `verify-failed` status, the accumulated conversation context may be causing the agent to fixate on a wrong approach. A fresh context with only the error summary often produces better fixes.

**Procedure:**

1. **Collect the error summary** — For each `verify-failed` plugin, record:
   - Plugin name and tier
   - The specific errors (tsc output, test failures, lint errors)
   - What fixes were attempted and why they didn't work
   - The relevant spec section (`## Verification` from `.planning/specs/0N-name.md`)

2. **Save to STATE.md** — Add a `## Fresh Retry Context` section:
   ```markdown
   ## Fresh Retry Context
   Plugins needing fresh-context retry: [plugin-list]
   Error summary:
   - [plugin]: [tsc error TS2345 in api.ts:42 — attempted fix X, still fails because Y]
   Attempted fixes: [brief list of what was tried]
   Gap closure rounds exhausted: [N]
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
   - Spawn the **moku-error-diagnostician** agent with ONLY:
     - The error summary (not the full conversation history)
     - The plugin spec
     - The current source files on disk
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
3. Log the judge's decision to `.planning/agent-log.md` and `.planning/diagnostics.log`

**Wave judge decisions are not persisted in STATE.md.** On resume, the wave judge does NOT re-run for previously completed waves — the previous wave is considered complete (its completion state was saved in STATE.md). The judge evaluates only the CURRENT wave being built, never previous waves.

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

1. **Append to `.planning/STATE-history.md`** — Move the full plugins table rows for this wave's plugins (status, hash, verification notes) into the history file under a `## Wave N` header with a timestamp
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
