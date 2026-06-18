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
- **Record the README-API hash.** For each plugin whose README was generated, write its current **public-API hash** (api/events/config surface — see `build-verification.md` Step 4a) into the `README-API Hash` column of the STATE.md plugins table. This is the baseline the README-freshness check (build-verification Step 4d3 / plugin-spec-validator §16) compares against — when the public API later changes, `API Hash` ≠ `README-API Hash` flags the README stale.
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

## Step 5.10: CI/CD, Deployment & Publication Wave

**Separate invocation.** Generate GitHub Actions workflows + distribution/deployment configuration.
The **user decides how and where to ship** — present concrete options with examples and let them choose.

### Choose what to ship (interactive gate)

Read `.planning/steering.md` `## CI/CD` section for any pre-selected choices. Then **confirm/extend
with the user via `AskUserQuestion`** (multiSelect) — do NOT silently skip shipping setup just because
steering was empty. Present each option with a one-line example of what it produces:

- **PR validation CI** — `.github/workflows/ci.yml`: format + lint + tsc + test on every PR.
- **Coverage gate** — adds a coverage step to CI that fails below the project threshold.
- **Publish to npm (Layer-2 framework)** — the two-workflow flow (`ci.yml` + `publish.yml`): OIDC Trusted Publishing, tag-only releases, branch protection. Authoritative spec: [ci-release.md](ci-release.md).
- **GitHub Releases** — `release.yml` step that cuts a GitHub Release from the tag + changelog.
- **Deploy: Cloudflare Pages/Workers** — `deploy.yml` using `cloudflare/wrangler-action` (for web apps/SSG/SSR).
- **Deploy: Vercel** — `deploy.yml` using `amondnet/vercel-action` (or the Vercel CLI).
- **Deploy: Netlify** — `deploy.yml` using `nwtgck/actions-netlify`.
- **Deploy: GitHub Pages** — `deploy.yml` using `actions/deploy-pages` (static SSG output).
- **Container image** — `docker.yml`: multi-stage Dockerfile build + push to a registry on release.
- **None / skip** — generate nothing.

Default the question's pre-checked options from steering.md when present. For each chosen item, show a
short example workflow snippet in the discussion BEFORE generating, and ask for the target-specific
inputs you need (e.g. Cloudflare project name + the secret names like `CLOUDFLARE_API_TOKEN`, the npm
registry/scope, the Pages output dir). If the user picks **None**, skip generation: "No CI/CD or
deployment selected. Skipping." Update STATE.md and STOP.

Frameworks/libraries lean toward **publish** (npm + GitHub Releases); apps lean toward **deploy**
(Cloudflare/Vercel/Netlify/Pages) — recommend accordingly, but the user chooses.

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

**npm Publish (Layer-2 framework package):**

> ⛔ **STOP — open [ci-release.md](ci-release.md) and apply it verbatim. Do NOT generate publish CI
> from memory, and NEVER use an `NPM_TOKEN`/`NODE_AUTH_TOKEN` secret.** Publishing is tokenless OIDC
> Trusted Publishing only — a token-based `npm publish` is insecure AND attaches no provenance / fails
> the Trusted Publisher match. If you catch yourself writing `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`,
> that's the exact mistake the spec exists to prevent.

For a framework package published to npm, do NOT scaffold a single ad-hoc `release.yml`.
Generate the **two-workflow flow** — `ci.yml` (parallel lint/types/test/build, reusable via
`workflow_call`) + `publish.yml` (one release+publish workflow, OIDC Trusted Publishing,
tag-only releases compatible with branch protection) — exactly as specified in
[ci-release.md](ci-release.md). That reference also covers SHA-pinning every action,
least-privilege per-job permissions, the no-script-injection `run:` rule, native release
notes, the branch-protection ruleset, and the acceptance checks. Apply it verbatim;
resolve each `@<SHA>` placeholder with `gh api repos/<o>/<r>/commits/<tag> --jq .sha`.

**After generating the workflows, tell the user the one-time npm setup** — it cannot be
automated (see ci-release.md "First-time setup"): the npm org/scope must exist; do a manual
**bootstrap publish** of the first version (OIDC Trusted Publishing can't be configured for a
package that doesn't exist yet); **tag** that version; then **register the Trusted Publisher**
on npmjs.com (the package → Settings → Trusted Publisher → GitHub Actions, repo + `publish.yml`).
Until the Trusted Publisher is registered, the `publish` job fails auth.

**GitHub Releases** (added to `release.yml`):
Add a step using `softprops/action-gh-release` that creates a GitHub Release from the tag, attaching the changelog entry.

**Container Build** (`.github/workflows/docker.yml`):
Generate a multi-stage Dockerfile and a workflow that builds and pushes on release tags. Only if selected.

**`publishConfig` in package.json** (if npm publish selected):
Add `"publishConfig": { "access": "public" }` and verify `"files"` field includes the dist directory.

**Deploy: Cloudflare Pages/Workers** (`.github/workflows/deploy.yml`) — for web apps/SSG/SSR:
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy ./dist --project-name=<project>
```
Adapt: `wrangler.jsonc`/`wrangler.toml` if Workers, correct output dir, correct project name.

**Deploy: Vercel** — `deploy.yml` using `amondnet/vercel-action@v25` (or `vercel --prod` CLI) with
`VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` secrets. **Deploy: Netlify** —
`nwtgck/actions-netlify@v3` with `NETLIFY_AUTH_TOKEN`/`NETLIFY_SITE_ID`, `publish-dir: ./dist`.
**Deploy: GitHub Pages** — build the static output, then `actions/upload-pages-artifact` +
`actions/deploy-pages@v4` (set `permissions: { pages: write, id-token: write }`).

Generate ONLY the targets the user selected. Use the secret names above and tell the user which repo
secrets to add. Never inline real tokens.

### Validate Workflows

After generating:
1. Check YAML syntax validity (parse each `.yml` file)
2. Verify all referenced scripts exist in `package.json`
3. Verify `.github/workflows/` directory structure is correct
4. If issues found: fix in-place

Update STATE.md: mark CI/CD wave complete with list of generated workflows.
**STOP.** Tell the user: `"CI/CD generated: {list of workflows}. Run /moku:build resume for post-build validation."`

## Step 6: Post-Build Validation Pipeline

Spawn the **moku-validation-coordinator** agent to orchestrate the full validation pipeline. It runs Group A in parallel, then Group B together with a speculative architecture-validator pass (re-run with Group B findings only if Group B surfaces cross-plugin BLOCKERs), aggregates output contracts, and returns a unified disposition (PASS/FIX/MANUAL).

If the coordinator returns FIX disposition, enter gap closure with the **moku-error-diagnostician**. If MANUAL, report to user. If PASS, proceed to Step 7.

**Fallback (if coordinator unavailable):** Run the pipeline manually:

**Parallel Group A (structure + docs):**
- **moku-spec-validator** agent — specification compliance per plugin
- **moku-jsdoc-validator** agent — documentation quality per plugin
- **moku-plugin-spec-validator** agent — structure compliance per plugin
- **moku-readable-code-validator** agent — function-body readability per plugin (wall-of-text / stanza style; WARNING/INFO only — never blocks)

**Parallel Group B + speculative architecture (quality + types + arch):**
- **moku-test-validator** agent — test quality per plugin
- **moku-type-validator** agent — TypeScript type correctness (once, whole project)
- **moku-architecture-validator** agent — cross-plugin architecture (once, whole framework) — speculative start alongside Group B

**Conditional architecture re-run:** if Group B reports BLOCKERs in categories `missing-export`, `dependency`, `event-type`, or `cross-plugin`, discard the speculative architecture results and re-run the **moku-architecture-validator** with Group B findings injected. Otherwise the speculative results are final.

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
   - `.planning/history.md` (newest-first cycle narrative; `/moku:clean` appends to it — see `commands/clean.md`)

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

1. **Plugin READMEs** — regenerate READMEs for plugins whose **public API changed**, not just any changed file. A plugin needs a README regen when its **public-API hash** (api/events/config surface — `build-verification.md` Step 4a) differs from its `README-API Hash` (the value recorded when its README was last generated). Internal-only edits (state/handlers, public-API hash unchanged) do NOT require a README regen. For each plugin that does: spawn a sub-agent (same protocol as Step 5.5), then record the new `README-API Hash`. The README-freshness check (build-verification Step 4d3 / moku-plugin-spec-validator §6) will BLOCKER any plugin whose public API moved without its README — so this delta step is what keeps that gate green.
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

> **Checkpoint cost (`--continue`):** if the repo's pre-commit hook runs the full gate (build + publint + lint + full test suite), every per-wave checkpoint re-runs it, so a `--continue` build multiplies that cost by the wave count. On large projects, prefer a lighter per-wave checkpoint (`tsc` + changed-scope tests) with the full gate once at the end. See `build-wave-execution.md` → Continue Mode.

This step is referenced by `build.md` rule 2c (the `add` entry point) and by the `update` verb's build flow.
