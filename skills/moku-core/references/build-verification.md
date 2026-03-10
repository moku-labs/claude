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
8. **Circuit breaker:** Maximum `gapClosureMaxRounds` (default: 2) gap closure rounds per wave. If issues persist, mark remaining plugins as `needs-manual` and report to user:
   > "Some verification issues remain after 2 fix attempts. Remaining issues: [list]. Please review and fix manually, then run `/moku:build resume`."

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
