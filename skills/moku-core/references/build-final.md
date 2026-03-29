# Build: Final Verification, Documentation, Testing, CI/CD & Validation (Steps 5–7.5)

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
- **STOP.** Tell the user: `"README wave complete. Run /moku:build resume for root documentation."`

**Important:** During individual plugin builds in framework waves (Step 3), sub-agents should create a minimal placeholder README only (plugin name + tier). The full README is written here with dedicated context.

## Step 5.6: Root Documentation & LLM Documentation Wave

**Separate invocation.** Generate root-level documentation and LLM-friendly documentation for the entire framework.

Spawn a single documentation agent with full framework context:
- All plugin code (index.ts, types.ts for each plugin)
- Framework config (`src/config.ts`, `src/index.ts`)
- All plugin specs from `.planning/specs/`
- Plugin dependency graph and event flow
- Agent turn limit: 25

### Root README

Generate (or fully regenerate) `README.md` at the project root covering:

1. **Project overview** — what it is, why it exists, core architecture concept
2. **Quick start** — install, create app, minimal working example (copy-pasteable)
3. **Installation** — package manager commands, peer dependencies
4. **Usage** — creating an app, configuring plugins, accessing plugin APIs
5. **Plugins** — table of all plugins with name, description, tier, key APIs
6. **Configuration** — full config reference with defaults and types
7. **Events** — event system overview, list of all events with payloads
8. **Architecture** — plugin graph, event flow, config composition diagram (text-based)
9. **Development** — how to add plugins, run tests, contribute
10. **API Reference** — links to per-plugin READMEs for detailed API docs

### LLM Documentation

Generate two files for AI/LLM consumption:

**`llms.txt`** (concise, 200–500 lines) — structured overview for quick LLM context:

```markdown
# {ProjectName}

> {one-line description}

## Core Concepts
- Plugin architecture: createPlugin, createCore, createApp
- Config composition: how plugins register config and events
- {project-specific concepts}

## Quick Reference
- Create app: `const app = createApp({ plugins: [...] })`
- Access plugin: `app.plugins.{name}.{method}()`
- {key API patterns with signatures}

## File Structure
src/config.ts — framework config type (Config + Events)
src/index.ts — public API, createApp, plugin instances
src/plugins/{name}/ — each plugin directory
src/plugins/{name}/index.ts — plugin entry point (createPlugin)
src/plugins/{name}/types.ts — plugin-specific types
src/plugins/{name}/__tests__/ — colocated tests

## Plugins
{for each plugin: name}: {one-line purpose} | Tier: {tier} | API: {key methods} | Events: {emitted events}
```

**`llms-full.txt`** (comprehensive) — complete reference for deep LLM context:

1. **Full TypeScript interfaces** — every plugin's Config, Events, State, API types
2. **All event names and payloads** — complete event catalog with TypeScript types
3. **Config schema** — every config field with type, default, and description
4. **Complete usage examples** — realistic scenarios showing plugin interactions
5. **Error handling patterns** — how plugins handle and propagate errors
6. **Plugin dependency graph** — which plugins depend on which, initialization order
7. **Extension patterns** — how to create custom plugins that integrate with the framework

After documentation agent completes:
- Run `bun run format` to normalize formatting
- Update STATE.md: mark documentation wave complete
- **STOP.** Tell the user: `"Documentation wave complete. Run /moku:build resume for documentation validation."`

## Step 5.7: Documentation Validation

**Separate invocation.** Validate that all generated documentation is accurate, complete, and usable.

Spawn a documentation validation agent with:
- All generated documentation (root README, per-plugin READMEs, `llms.txt`, `llms-full.txt`)
- All source code (for cross-referencing)
- Agent turn limit: 20

### Validation Checks

1. **Completeness:**
   - All plugins are mentioned in root README and both LLM docs
   - All public API methods documented
   - All config options listed with defaults
   - All events cataloged with payload types
   - Quick start example is complete and functional

2. **Accuracy:**
   - Every function name referenced in docs exists in source (grep verification)
   - Every import path in examples is correct
   - Config field names and types match actual `src/config.ts`
   - Event names match actual event declarations in plugin types

3. **Usability:**
   - Quick start works for a new user (no assumed prior knowledge)
   - Installation instructions are complete
   - All code examples are syntactically valid TypeScript
   - No broken internal cross-references between docs

4. **LLM doc specifics:**
   - `llms.txt` is under 500 lines (concise enough for context windows)
   - `llms-full.txt` includes all TypeScript interfaces verbatim
   - Both files have accurate plugin lists and API signatures

### Disposition

- **PASS** (zero issues): proceed to next step
- **FIX** (1+ accuracy/completeness issues): fix the documentation in-place, then re-validate the fixed sections (max 2 rounds). Only re-validate sections that were modified.
- **MANUAL** (agent failure): report to user

Update STATE.md: mark documentation validation complete.
**STOP.** Tell the user: `"Documentation validated. Run /moku:build resume for integration tests."`

## Step 5.8: Integration Test Wave

**Separate invocation.** Generate comprehensive root-level integration tests that exercise the full framework end-to-end — multiple plugins working together in realistic scenarios.

### Scenario Planning

Spawn a test planning agent with:
- All plugin specs (`.planning/specs/`)
- Plugin dependency graph from STATE.md
- Event flow (all declared events across plugins)
- Framework config (`src/config.ts`)
- Agent turn limit: 15

The planning agent produces a test plan organized by category:

1. **Core scenarios** — framework boot, plugin registration, config composition, lifecycle (start/stop)
2. **Cross-plugin scenarios** — plugins communicating via events, shared state dependencies, dependency chains exercised end-to-end
3. **User journey scenarios** — realistic end-to-end flows a consumer app would execute
4. **Edge cases** — error conditions, missing config, invalid plugin combinations, lifecycle edge cases

**Scenario count is automatic** — driven by plugin count and complexity:
- Count total plugins and their tiers
- Each plugin contributes scenarios: Nano=1, Micro=2, Standard=3, Complex=5, VeryComplex=7
- Sum all contributions → target scenario count
- Minimum: 10 scenarios regardless of project size
- Distribute across categories: ~20% core, ~40% cross-plugin, ~25% user journey, ~15% edge cases
- The goal is comprehensive aspect coverage — every plugin API, every event, every dependency chain should be exercised by at least one scenario

### Test Writing

Spawn parallel sub-agents (batched by `maxParallelAgents`), each receiving 3–5 scenarios:
- Agent turn limit: 20 per agent
- Tests go to `tests/integration/` at the project root
- Tests use the real framework — import `createApp`, register plugins, exercise actual behavior
- No mocks — integration tests exercise the full plugin stack
- Each test file covers one category or closely related scenarios
- File naming: `tests/integration/{category}-{descriptive-name}.test.ts`

### Test Execution

After all agents complete:
1. Run `bun run format` on test files
2. Run `bun run test` — verify all integration tests pass
3. If failures: route to gap closure with error-diagnostician (max 2 rounds)
4. If still failing after gap closure: report failures to user, mark as WARNING

Update STATE.md: mark integration test wave complete with scenario count.
**STOP.** Tell the user: `"Integration tests complete ({N} scenarios). Run /moku:build resume for coverage verification."`

## Step 5.9: Coverage Verification

**Separate invocation.** Run quantitative test coverage measurement and verify thresholds.

### Run Coverage

1. Execute `bun run test:coverage` — runs all unit + integration tests with Istanbul coverage
2. Read coverage summary from `coverage/coverage-summary.json` (Istanbul JSON output)
3. Extract metrics: lines, functions, branches, statements — both overall and per-plugin

### Evaluate Against Thresholds

**Overall framework thresholds (build gate):**
- Lines: ≥ 80%
- Branches: ≥ 80%
- Functions: ≥ 80%
- Statements: ≥ 80%

**Per-plugin attention threshold:**
- Flag any plugin with < 70% line coverage as needing additional tests

**Aspirational target:** The vitest.config threshold (90%) is the aspirational goal. The 80% build gate avoids blocking on legitimate edge cases (e.g., error paths that are hard to trigger in tests).

### Gap Closure for Low Coverage

If overall coverage is below 80%:
1. Identify the worst-covered plugins and specific uncovered code paths
2. Spawn agents to write additional tests targeting uncovered paths — prioritize:
   - Untested public API methods
   - Uncovered branch paths (if/else, switch cases)
   - Error handling paths
3. Re-run `bun run test:coverage` after fixes
4. Maximum 2 gap closure rounds
5. If still below 80% after 2 rounds: report to user with specific uncovered areas. Mark as WARNING (not blocker) — low coverage does not prevent build completion but is flagged prominently.

### Coverage Report

Write `.planning/build/coverage.md` with:
- Overall coverage percentages (lines, branches, functions, statements)
- Per-plugin coverage breakdown table
- List of plugins below 70% threshold with specific uncovered areas
- Total test count (unit + integration)

Update STATE.md: mark coverage verification complete with overall percentages.
**STOP.** Tell the user: `"Coverage: {lines}% lines, {branches}% branches, {functions}% functions. Run /moku:build resume for CI/CD generation."`

## Step 5.10: CI/CD Wave

**Separate invocation.** Generate GitHub Actions workflows and distribution configuration based on user choices from the steering phase.

### Read CI/CD Choices

Read `.planning/steering.md` `## CI/CD` section. If the section is missing or contains "None", skip this step entirely: "No CI/CD requested during planning. Skipping." Update STATE.md and STOP.

### Generate Workflows

Based on user selections, generate the following (only selected items):

**PR Validation** (`.github/workflows/ci.yml`):
```yaml
name: CI
on: [pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run format --check
      - run: bun run lint
      - run: bunx tsc --noEmit
      - run: bun run test
```
Adapt to the actual project: correct package manager, correct script names from `package.json`, correct Node/Bun version.

**Coverage Gate** (added to `ci.yml`):
Add a coverage step that runs `bun run test:coverage` and fails if coverage drops below the threshold from `.planning/build/coverage.md`.

**npm Publish** (`.github/workflows/release.yml`):
```yaml
name: Release
on:
  push:
    tags: ['v*']
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run test
      - run: bun run build
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```
Adapt: correct registry, correct package name, correct build steps.

**GitHub Releases** (added to `release.yml`):
Add a step using `softprops/action-gh-release` that creates a GitHub Release from the tag, attaching the changelog entry.

**Container Build** (`.github/workflows/docker.yml`):
Generate a multi-stage Dockerfile and a workflow that builds and pushes on release tags. Only if selected.

**`publishConfig` in package.json** (if npm publish selected):
Add `"publishConfig": { "access": "public" }` and verify `"files"` field includes the dist directory.

### Validate Workflows

After generating:
1. Check YAML syntax validity (parse each `.yml` file)
2. Verify all referenced scripts exist in `package.json`
3. Verify `.github/workflows/` directory structure is correct
4. If issues found: fix in-place

Update STATE.md: mark CI/CD wave complete with list of generated workflows.
**STOP.** Tell the user: `"CI/CD generated: {list of workflows}. Run /moku:build resume for post-build validation."`

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
- Documentation status (root README, per-plugin READMEs, LLM docs)
- Integration test results (scenario count, pass/fail)
- Coverage percentages (lines, branches, functions, statements)
- CI/CD workflows generated
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
- [x] Root documentation + LLM docs generated
- [x] Documentation validated
- [x] Integration tests complete ({N} scenarios)
- [x] Coverage verified ({lines}% lines, {branches}% branches)
- [x] CI/CD generated: {list}
- [x] Post-build validation passed

## Validation Summary
- Spec compliance: PASS
- JSDoc coverage: PASS
- Plugin structure: PASS
- Test quality: PASS
- Type correctness: PASS
- Architecture: PASS
- Documentation: PASS
- Integration tests: {N} scenarios, all passing
- Coverage: {lines}% lines, {branches}% branches, {functions}% functions
- CI/CD: {list of workflows}
```

## Step 7.5: Cycle Archive

**Runs automatically after Step 7.** Archives the completed build state and prepares the project for the next development cycle.

### Archive Current Cycle

1. Determine cycle number: read `## Cycle:` from STATE.md. If absent, this is Cycle 1.
2. Create archive directory: `mkdir -p .planning/archive/cycle-{N}/`
3. Archive planning artifacts:
   - Copy `.planning/specs/` → `.planning/archive/cycle-{N}/specs/`
   - Copy `.planning/STATE.md` → `.planning/archive/cycle-{N}/STATE.md`
   - Copy `.planning/build/coverage.md` → `.planning/archive/cycle-{N}/coverage.md` (if exists)
   - Copy `.planning/build/skeleton-spec.md` → `.planning/archive/cycle-{N}/skeleton-spec.md` (if exists)
   - Copy `.planning/build/findings.md` → `.planning/archive/cycle-{N}/findings.md` (if exists)
   - Copy `.planning/context-*.md` → `.planning/archive/cycle-{N}/` (if any exist — brainstorm context that fed this cycle)
4. **Wipe the build workspace:** `rm -rf .planning/build/ && mkdir -p .planning/build/`
   All ephemeral build artifacts are discarded. The archive has the important ones (coverage, findings). Logs, strategy history, and diagnostics are not preserved.
5. **Clean up consumed context files:** Delete `.planning/context-*.md` from root (already archived above).
6. **Preserve cross-cycle files** — do NOT archive or delete these (they accumulate across cycles):
   - `.planning/decisions.md`
   - `.planning/learnings.md`
   - `.planning/steering.md`

### Reset State for Next Cycle

Update `.planning/STATE.md` to the ready state:

```markdown
## Phase: ready
## Verb: (none)
## Target: (none)
## Skeleton: committed
## QuickMode: false
## Cycle: {N+1}
## PluginTable: {preserve current plugin table as read-only context}
## WaveGrouping: (none)
## Next Action: Run /moku:plan [update|add] to start the next development cycle

## Previous Cycle Summary
- Cycle {N}: {plugin count} plugins built, {coverage}% coverage, {test count} tests
- Archived at: .planning/archive/cycle-{N}/
```

Tell the user:
> "Build complete. Cycle {N} archived to `.planning/archive/cycle-{N}/`. Project is ready for the next development cycle. Run `/moku:plan update` to modify existing plugins or `/moku:plan add plugin {name}` to add new plugins."

---

## Step 8: Delta Updates (for subsequent builds)

**This step is NOT part of the initial build flow.** It runs when `/moku:build add {name}`, `/moku:build resume` after a `plan update`, or any post-initial-build invocation modifies plugins.

When a build modifies existing plugins or adds new ones after the initial build is complete, the following artifacts must be updated:

### Delta Update Checklist

1. **Plugin READMEs** — regenerate READMEs for changed plugins only. Spawn sub-agents for each changed plugin (same protocol as Step 5.5).
2. **Root README** — update the root README to reflect changes: new plugins in the plugin table, updated API references, new config options. Do NOT regenerate from scratch — read the existing README and update the relevant sections.
3. **LLM Documentation** — regenerate both `llms.txt` and `llms-full.txt` in full. LLM docs are cheap to regenerate and must always reflect the current state exactly.
4. **Integration tests** — add new integration test scenarios that exercise the changed/added functionality. Run all existing integration tests to verify no regressions. If new cross-plugin interactions were introduced, add scenarios for those.
5. **Coverage** — re-run `bun run test:coverage` and verify thresholds still hold. If coverage dropped below 80% due to new uncovered code, enter gap closure.
6. **CI/CD workflows** — if new dependencies were added to `package.json` or new scripts were added, update the CI workflow to include them. If a new plugin introduces a new test category, add it to the test step.

### Delta Update Flow

The delta update runs as a single pass (not stop-and-resume):
1. Identify what changed: diff the current plugin list against the archived STATE.md
2. Run updates 1–6 above for changed artifacts only
3. Run `bun run format` → `bun run lint` → `bunx tsc --noEmit` → `bun run test`
4. Report what was updated

This step is referenced by `build.md` rule 2c (the `add` entry point) and by the `update` verb's build flow.
