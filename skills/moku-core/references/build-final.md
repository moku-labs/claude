# Build: Final Verification, READMEs & Validation (Steps 5–7)

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

Spawn the **moku-validation-coordinator** agent to orchestrate the full validation pipeline. It handles Group A → Group B → architecture sequencing, aggregates output contracts, and returns a unified disposition (PASS/FIX/MANUAL).

If the coordinator returns FIX disposition, enter gap closure with the **moku-error-diagnostician**. If MANUAL, report to user. If PASS, proceed to Step 7.

**Fallback (if coordinator unavailable):** Run the pipeline manually:

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
