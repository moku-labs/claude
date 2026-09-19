# Build: Final Verification, Documentation, Testing & Validation (Steps 5–8)

## Step 5: Final framework verification

Framework files are already current from Step 4b. Confirm it once at the end:

1. `src/config.ts` includes the plugin types from every wave.
2. `src/index.ts` imports and exports every plugin.
3. `package.json` carries every dependency.
4. The full chain passes: `bun run format`, `bun run lint`, `bunx tsc --noEmit`, `bun run build`.
5. Root `tests/` holds no plugin-specific directories — plugin tests live in
   `src/plugins/[name]/__tests__/`.

Fix what is left until all of it is clean, then update STATE.md
(`## Next Action: Run /moku:build resume for README wave`) and stop.

## Step 5.5: README wave

A separate invocation, so each agent has full context for writing rather than the remains of a build.

For each plugin, in parallel batched by `maxParallelAgents`, spawn an agent with the built plugin code,
`src/config.ts`, the plugin spec, and the instruction to write a comprehensive `README.md` covering
purpose, config options, API reference, events, usage examples and integration with other plugins.
Turn limit 15.

Afterwards: `bun run format`; write each plugin's current **public-API hash** into the
`README-API Hash` column (this is the baseline the freshness gate in `build-verification.md` Step 4d3
compares against); mark the wave complete in STATE.md; stop.

During plugin waves the builders write a placeholder README only (name and tier). The real one is written here.

## Step 5.6: Root documentation and LLM docs

A separate invocation. Spawn one documentation agent with the whole framework in view: every plugin's
`index.ts` and `types.ts`, `src/config.ts`, `src/index.ts`, the specs, the dependency graph and the
event flow. Turn limit 25.

### Root README

Form comes from the **`moku-readme` skill** — masthead, badges, nav line, mermaid palette, the "why"
bullets, table-centric body, callouts, footer. Pick the repo shape (library / framework / toolkit /
app) per `moku-readme` §2 and follow that section order. Content covers:

1. What it is, why it exists, the core architecture idea
2. Quick start — install, create an app, a copy-pasteable minimal example
3. Installation, including peer dependencies
4. Usage — creating an app, configuring plugins, reaching plugin APIs
5. Plugins — a table of name, description, tier, key APIs
6. Configuration — full reference with defaults and types
7. Events — the system and every event with its payload
8. Architecture — plugin graph, event flow, config composition
9. Development — adding plugins, running tests, contributing
10. API reference — links to the per-plugin READMEs

### LLM docs

**`llms.txt`** (200–500 lines) — a structured overview: core concepts (createPlugin, createCore,
createApp, config composition), a quick reference of the key API patterns with signatures, the file
structure, and one line per plugin with purpose, tier, key methods and emitted events.

**`llms-full.txt`** — the complete reference: every plugin's Config, Events, State and API types
verbatim, the full event catalog with payload types, every config field with type, default and
description, realistic multi-plugin usage examples, error-handling patterns, the dependency graph with
initialization order, and how to write a custom plugin that integrates.

Then `bun run format`, mark the wave complete, stop.

## Step 5.7: Documentation validation

A separate invocation. Spawn a validation agent with all generated docs and all source. Turn limit 20.

- **Completeness** — every plugin appears in the root README and both LLM docs; every public API
  method, config option (with default) and event (with payload) is documented; the quick start is complete.
- **Accuracy** — every function name in the docs exists in source (grep it); import paths in examples
  resolve; config names and types match `src/config.ts`; event names match the plugin declarations.
- **Usability** — the quick start works with no prior knowledge, installation is complete, examples are
  valid TypeScript, internal cross-references resolve.
- **LLM docs** — `llms.txt` under 500 lines; `llms-full.txt` carries the interfaces verbatim; both list
  the plugins and signatures accurately.

Zero issues: continue. Issues: fix the docs in place and re-validate only the modified sections, at
most twice. Agent failure: report it. Then mark complete and stop.

## Step 5.8: Integration test wave

A separate invocation. Root-level tests that exercise the assembled framework end to end.

**Scenario planning.** Spawn a planning agent with the specs, the dependency graph, the event flow and
`src/config.ts`. Turn limit 15. It produces a plan in four categories: core (boot, registration, config
composition, lifecycle), cross-plugin (events, shared state, dependency chains), user journeys, and
edge cases (error conditions, missing config, invalid combinations).

Scenario count follows the project: Nano contributes 1, Micro 2, Standard 3, Complex 5, VeryComplex 7;
minimum 10 overall. Distribute roughly 20% core, 40% cross-plugin, 25% user journey, 15% edge cases.
The target is aspect coverage — every plugin API, every event and every dependency chain exercised at
least once.

**Writing.** Parallel agents batched by `maxParallelAgents`, 3–5 scenarios each, turn limit 20. Tests go
to `tests/integration/{category}-{name}.test.ts`, import the real `createApp`, register real plugins,
and use no mocks.

**Execution.** `bun run format`, then `bun run test`. Failures route to gap closure (max 2 rounds);
anything still failing is reported as a warning. Record the scenario count in STATE.md and stop.

## Step 5.9: Coverage verification

A separate invocation.

1. `bun run test:coverage`, then read `coverage/coverage-summary.json` for lines, functions, branches
   and statements, overall and per plugin.
2. Build gate: 80% on each of the four, overall. The vitest config's 90% is the aspirational target;
   the 80% gate avoids blocking on error paths that are genuinely hard to trigger.
3. Flag any plugin under 70% line coverage.
4. Below the gate: write tests for the worst-covered plugins, prioritizing untested public API methods,
   uncovered branches and error paths; re-run coverage; at most 2 rounds. Still below after that, report
   it prominently as a warning rather than a blocker.
5. Write `.planning/build/coverage.md`: overall percentages, the per-plugin table, plugins under 70%
   with their uncovered areas, and the total test count.

Record the percentages in STATE.md and stop.

## Step 5.10: Release

Releasing is its own station. The `moku:moku-release` skill owns the release commands, the thin
workflows and the first-time setup, so do not write release or publish CI here. When the change needs
to ship, hand over to it; the conductor drives that station.

For an app that deploys rather than publishes, the deployment target is part of the app build —
see `build-app.md` Step 9.

## Step 6: Post-build validation

Spawn the validators yourself, in two groups. Nothing coordinates them but you.

**Group A — structure and style (parallel):**

- `moku-structure-validator` — spec compliance, plugin structure and tier, root and entrypoint idioms
  I1–I6, and `@moku-labs/common` usage (MC1–MC3), per plugin plus the project root
- `moku-style-validator` — JSDoc quality and readable-code style, per plugin

Wait for both, parse their output contracts, then resolve conflicts inside the group
(`build-conflict-resolution.md`) before going on.

**Cross-group summary.** Build a 20–30 line `## Prior Findings (from Group A)` block — the blockers
with file paths and rule ids, plugins flagged for a domain merge, lifecycle concerns, low JSDoc
coverage, and how each conflict was resolved — and inject it into the Group B prompts so they focus
where the problems are and do not re-raise settled findings.

**Group B — quality and architecture (parallel):**

- `moku-quality-validator` — runs `tsc`, tests and lint through Bash as facts, then judges test quality
- `moku-architecture-validator` — cross-plugin architecture, whole framework, started speculatively
- `moku-web-validator` — web projects only, on `components/`, `islands/`, `styles/`, `index.html`

The architecture validator runs alongside Group B rather than after it, which saves 10–15% of the
pipeline. It sees Group A's findings but not Group B's, so: if Group B reports blockers with category
`missing-export`, `dependency`, `event-type` or `cross-plugin`, discard the speculative result and
re-run the architecture validator with those findings injected. Otherwise the speculative result stands.

**Skeptic pass.** `moku-structure-validator`, `moku-style-validator`, `moku-quality-validator`,
`moku-web-validator` and `moku-architecture-validator` are Sonnet agents, so none of them closes a gate
on its own. Each finding goes through `moku-skeptic`, which upholds it unless it can cite the spec or
house-style section that refutes it. Only surviving findings count. The verdict is yours.

**Lazy skip.** Before spawning per-plugin validators, compare each plugin's hash from the STATE.md
table (see `build-verification.md` Step 4d2). A plugin whose hash matches and whose status is
`verified` is skipped and reported as `CACHED`. The architecture validator always runs on the whole
framework — cross-plugin concerns cannot be cached per plugin. `fix --all` always runs everything.

**Disposition.** All verdicts PASS → proceed to Step 7. Any blocker → gap closure with
`moku-error-diagnostician`. A validator that returned no parseable contract → report it to the user
rather than assuming it passed.

Aggregate into one report:

```
### Group A
| Validator | Verdict | Blockers | Warnings |
|-----------|---------|----------|----------|
| structure | PASS | 0 | 2 |
| style | PARTIAL | 0 | 5 |

### Group B
| Validator | Verdict | Blockers | Warnings |
|-----------|---------|----------|----------|
| quality | FAIL | 2 | 3 |
| architecture | PASS | 0 | 4 |

### Blockers
1. [validator] [file:line] [message] — Fix: [fix]
```

## Step 7: Report and state update

Summarize: plugins created per wave, files per plugin, validation results, documentation status,
integration test scenarios and results, coverage percentages, issues found and fixed during gap
closure, and remaining warnings for the user.

Update `.planning/STATE.md`:

```markdown
## Phase: build/complete
## Completed
- [x] Wave 0: [core plugins] — verified — integration checks passed
- [x] Wave N: [plugins] — verified — integration checks passed — spec checkboxes ticked
- [x] Final framework verification passed
- [x] README wave complete
- [x] Root documentation + LLM docs generated and validated
- [x] Integration tests complete ({N} scenarios)
- [x] Coverage verified ({lines}% lines, {branches}% branches)
- [x] Post-build validation passed

## Validation Summary
- Structure: PASS
- Style: PASS
- Quality: PASS
- Architecture: PASS
- Documentation: PASS
- Integration tests: {N} scenarios, all passing
- Coverage: {lines}% lines, {branches}% branches, {functions}% functions
```

## Step 7.5: Cycle archive

Runs right after Step 7.

1. Read `## Cycle:` from STATE.md; absent means cycle 1.
2. `mkdir -p .planning/archive/cycle-{N}/`
3. Copy in: `.planning/specs/`, `.planning/STATE.md`, and if they exist
   `.planning/build/coverage.md`, `.planning/build/skeleton-spec.md`, `.planning/build/findings.md`
   and any `.planning/context-*.md`.
4. Wipe the workspace: `rm -rf .planning/build/ && mkdir -p .planning/build/`. Logs, strategy history
   and diagnostics are ephemeral; the archive keeps what matters.
5. Delete the consumed `.planning/context-*.md` from the root (already archived).
6. Leave these alone — they accumulate across cycles: `.planning/decisions.md`,
   `.planning/learnings.md`, `.planning/steering.md`, `.planning/history.md`.

Then reset STATE.md for the next cycle:

```markdown
## Phase: ready
## Verb: (none)
## Target: (none)
## Skeleton: committed
## Cycle: {N+1}
## PluginTable: {preserve the current plugin table as read-only context}
## Next Action: Run /moku:plan [update|add] to start the next development cycle

## Previous Cycle Summary
- Cycle {N}: {plugin count} plugins built, {coverage}% coverage, {test count} tests
- Archived at: .planning/archive/cycle-{N}/
```

Tell the user the build is complete, where the cycle was archived, and that `/moku:plan update` or
`/moku:plan add plugin {name}` starts the next one.

---

## Step 8: Delta updates

Not part of the initial build. This runs for `/moku:build add {name}`, for a resume after
`plan update`, and for any invocation that changes plugins after the first build completed.

1. **Plugin READMEs** — regenerate only where the **public API** moved: the plugin's public-API hash
   differs from its `README-API Hash` (`build-verification.md` Step 4a). Internal-only edits need
   nothing. For each one, spawn the Step 5.5 agent and record the new hash. This is what keeps the
   freshness gate in Step 4d3 green.
2. **Root README** — update the plugin table, API references and config options in place. Read the
   existing file and edit the affected sections rather than regenerating it.
3. **LLM docs** — regenerate `llms.txt` and `llms-full.txt` in full; they are cheap and must match the
   current state exactly.
4. **Integration tests** — add scenarios for the changed or added behavior and any new cross-plugin
   interaction, then run the whole suite for regressions.
5. **Coverage** — re-run `bun run test:coverage`. New uncovered code that drops it below 80% goes to
   gap closure.
6. **Release** — if the change ships, hand over to the `moku:moku-release` skill (Step 5.10).

Delta updates run as one pass, not stop-and-resume: work out what changed by diffing the current plugin
list against the archived STATE.md, run items 1–5 for what it touched, then
`bun run format` → `bun run lint` → `bunx tsc --noEmit` → `bun run test`, and report.

> **Checkpoint cost under `--continue`:** when the pre-commit hook runs the full gate (build, publint,
> lint, whole test suite), every per-wave checkpoint pays it, multiplied by the wave count. On a large
> project prefer a lighter per-wave checkpoint (`tsc` plus the changed scope's tests) and the full gate
> once at the end.
