# Build: Wave Analysis & Execution (Steps 2–3)

## Step 2: Wave Analysis

Group the plugin specs into dependency-ordered waves:

1. Read all `.planning/specs/0N-*.md`.
2. Core plugin specs are Wave 0 — built before everything else, with no inter-dependencies.
3. Parse each regular spec's Dependencies section into a graph.
4. Wave 1 is the plugins with no dependencies; wave N is the plugins whose dependencies all sit in
   earlier waves. Plugins in one wave build in parallel.
5. If `/moku:plan` already assigned waves, use its assignment instead of recomputing.

Present the plan as a short list with the dependency reason:

```
Wave 0 (core): log [Core], env [Core]
Wave 1 (parallel): configValidator [Nano]
Wave 2 (parallel): router [Standard] (-> env via core), content [Standard]
Wave 3: renderer [Complex] (-> router, content)
```

**Stop after presenting it.** Run `moku-rails pause --reason "wave plan needs approval"`, write
`## Next Action: Run /moku:build resume` to STATE.md, and end the invocation. The next resume starts at
Step 2.5. Re-analyzing is cheap; re-building is not, so the user gets to reject the plan before any
code exists.

**Framework-level waves.** A wave may hold non-plugin work — `package.json` exports, `src/index.ts`,
`tsdown.config.ts`, CI config. Such a row has no `src/plugins/<name>/` directory and no sub-agent:
you edit the framework files yourself, then verify (tsc, lint, test) and checkpoint. Its Plugins cell
carries a framework-target label. This is common in `Verb: update` builds.

## Step 2.5: Pre-Flight Check

Before spawning any builder, make sure the ground is clean — otherwise every parallel agent fails the
same way and the failures cost N times as much to read.

1. `bun install`
2. `bunx tsc --noEmit`
3. `bun run lint`

On failure, do not start the wave. Ask `moku-error-diagnostician` for a diagnosis, apply the fix,
re-run pre-flight. If two rounds do not clear it, report and stop.

Skip pre-flight for Wave 0 only when `src/` holds nothing but skeleton stubs. Any real implementation
on disk means pre-flight runs.

## Step 3: Build by Waves

**Protected-branch guard (Wave 0, before the first checkpoint).** If the skeleton commit did not
already move off the default branch:

```bash
branch="$(git rev-parse --abbrev-ref HEAD)"
default="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@')"; default="${default:-main}"
```

If `branch` equals `default`, `main` or `master`, do not commit. `moku-rails pause`, then ask via
`AskUserQuestion`: create `build/{target-slug}` (recommended), use the current branch, or cancel.
On the first, `git switch -c build/{target-slug}`. Later waves are already safe.

**Before each wave:**

1. Checkpoint: `git add -A && git commit -m "pre-wave-N: checkpoint before building [plugin list]"`.
2. In STATE.md, set every plugin in the wave to `building` and record `## Git Checkpoint: <sha>`.
   The `building` status is what makes a crash detectable on the next resume.

Then spawn one builder per plugin, in parallel, up to `maxParallelAgents` (default 5); larger waves
run in batches of that size. Sub-agents have their own context, so fan-out width costs you only the
summaries they return.

**Tell the user where you are:** the plugin list before spawning, each plugin as it returns, the
verification result, and the integration result. In lean mode collapse that to one line per wave
(`W2: router,content → PASS. Verified. Integration OK.`) and expand only on failure.

### Picking the builder

`moku-builder` by default. `moku-builder-deep` for a plugin of tier Complex or VeryComplex, and for
any plugin whose first attempt failed. A second failure on the deep variant comes back to you with
the full error context instead of a third attempt.

Spawn with `subagent_type: moku-builder` (or `moku-builder-deep`), never `general-purpose`. The agent
already carries the TDD protocol, the filesystem rules, the scoped-lint contract and the JSON output
contract. Pass it: plugin name and tier, the spec, the framework config, the dependency interfaces,
the relevant decisions, and a **mode** — `greenfield` (net-new, tests fail on stubs first) or `delta`
(an existing plugin: keep existing tests green, add RED-first tests for the new behavior only).

All builders of a wave run in the one working tree. Do not spawn them with `isolation: "worktree"`: a
git worktree has no `node_modules` and no `.planning/` (both are gitignored), so the builder would get
no tooling and no spec. Two rules are the isolation instead. Each builder writes only inside its own
`src/plugins/{name}/`, and the prompt bans repo-wide commands and git mutations — a stray
`git checkout` from one builder reverted a sibling's plugin to stubs in a real build.

### Builder prompt

Read `build-lean-mode.md` when lean mode is active and use the lean shape instead.

#### Normal prompt

```
You are building a Moku plugin using TDD. Follow the moku-plugin skill.
Before writing source, open `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/sandbox-index.md`
and read the tier-matching exemplar (env/counter/router/analytics/cms) to mirror file layout,
export naming (`<name>Plugin`), JSDoc, and test style.

## Specification
[Full contents of .planning/specs/0N-name.md]

## Framework Config
[Contents of src/config.ts — for import paths and type references]

## Dependency Plugin Interfaces
[For each dependency: contents of src/plugins/dep-name/index.ts]

## Design Decisions
[Relevant entries from .planning/decisions.md matching this plugin name. These are intentional
trade-offs — follow them rather than re-deciding. Omit the section when there are none.]

## Filesystem safety (parallel builders)
Sibling builders run concurrently, so a repo-wide command from you corrupts their work.
- Write only under `src/plugins/[name]/` and its `__tests__/`. Leave `src/config.ts`,
  `src/index.ts`, `src/plugins/index.ts`, `package.json` and every sibling plugin alone.
- Run no repo-wide command: no `lint:fix`, no `bun run format`, no `biome … .`, no `eslint .`.
- Run no git mutation: no `checkout`, `restore`, `reset`, `stash`, `clean`, `add`, `commit`.
- Scoped checks only: `bunx biome format --write src/plugins/[name]/` and
  `bunx eslint src/plugins/[name]/ --fix`. Biome alone misses the unicorn rules (`no-null`,
  `prevent-abbreviations`, `prefer-structured-clone`, `consistent-function-scoping`,
  `prefer-regexp-test`) and ESLint ignores `.tsx`, so a builder that runs only Biome reports
  "lint clean" and the orchestrator's repo-wide ESLint then fails.
- Report what `--fix` cannot resolve as a hint; the orchestrator fixes repo-wide after the wave.

## Build Rules
- Follow the tier [tier] file structure.
- No explicit generics on createPlugin or createCorePlugin — types infer from the spec object.
- Core plugins use createCorePlugin, with no depends/events/hooks.
- JSDoc on all exports with @param and @returns. `@example` per
  `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/jsdoc-examples.md`: a scenario on every member of
  the public `Api` type in types.ts, none on the implementation in api.ts, none on a function that
  takes ctx/state, never an echo of the signature. Every example is true: read the signature and a
  test first. API means public: every `Api` member gets a true example; when the real caller is
  another plugin, write it from that plugin's side with `ctx.require`. When no honest example
  exists, report the member in `issues` as an API finding (move it off the API into a plain
  function, or delete it) instead of inventing one. `import type` for type-only imports.
- Include onStart/onStop only when the spec names a real resource to manage.
- Tests live in `__tests__/unit/` and `__tests__/integration/` inside the plugin directory.
  The root `tests/` directory is for framework-level tests.
- Author hook-compliant from line 1: read
  `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/skeleton-conventions.md` and the
  Correct-First-Try checklist in `build-plugin.md` before writing. `index.ts` starts as the
  ≤30-line wiring template; config is a typed const; `Config`/`Api` are `type` aliases; no inline
  `as`; no `wireX()`; injectable function types are structural.

## TDD Protocol — RED → GREEN → REFACTOR
Full protocol: `${CLAUDE_PLUGIN_ROOT}/skills/moku-testing/references/tdd-protocol.md`.
1. TYPES: types.ts + skeleton index.ts (stubs only, enough for test imports).
2. RED: write every unit and integration test. Run them — they fail. If one passes on stubs, strengthen it.
3. GREEN: implement state.ts, api.ts, handlers.ts, finish index.ts. Run tsc and the tests until green.
   Fix the implementation, not the tests.
4. REFACTOR: index.ts back to ~30 lines, README.md placeholder.

## Files to Create
[List from tier: types.ts, index.ts (skeleton), tests, state.ts, api.ts, handlers.ts, index.ts (final), README.md]

## Verification Criteria
[Contents of the ## Verification section from the spec]
```

#### Delta prompt (`mode: delta`)

```
You are modifying an existing Moku plugin by adding new behavior.
Incremental TDD: read the existing code and tests → keep every existing test green → write RED-first
tests for the new behavior only → implement until the new tests pass and the old ones still do.

## Existing Source
[Current src/plugins/[name]/*.ts and __tests__/]

## New Behavior Spec
[The change description / ## Changes section from the spec]

## Filesystem safety + scoped checks
[Same as the normal prompt]
```

Do not rewrite the suite or re-test existing behavior — incremental TDD on existing code is not a TDD
violation. If the public API (api/events/config) changes, set `publicApiChanged: true` so the
README-freshness gate fires.

#### Output contract (both modes)

```
## Output Contract
End your response with a fenced `json` code block:
```json
{
  "agent": "builder",
  "plugin": "[plugin-name]",
  "verdict": "PASS | FAIL | PARTIAL",
  "tdd": { "redPhaseTests": 12, "redPhaseFailing": 12, "greenPhaseTests": 12, "greenPhasePassing": 12 },
  "intent": {
    "types.ts": "Defines Config with basePath/trailingSlash, State with routes Map and currentPath, Api with navigate/current/back, Events with router:navigated payload",
    "api.ts": "navigate() updates currentPath, pushes the old path to history, emits router:navigated. current() returns currentPath. back() pops history."
  },
  "filesCreated": ["types.ts", "api.test.ts", "api.ts", "state.ts", "index.ts"],
  "testsPass": true,
  "lintPass": true,
  "issues": [{"file": "path", "message": "description"}]
}
```
- `verdict`: PASS (files created, tests pass, lint clean), FAIL (critical files missing or errors you
  could not resolve), PARTIAL (hit the turn limit or left issues open).
- `tdd`: red == failing and green == passing means the protocol was followed.
- `intent`: one sentence per source file (not test files) saying what it does and why it is shaped
  that way. The code reviewer compares these against the spec; a mismatch is a high-confidence bug.
- `issues`: anything that went wrong, empty array if nothing did.
```

### Agent turn limits

TDD costs roughly 30% more turns than writing the implementation alone. The table is the expected
budget per tier for a net-new plugin. A delta reads the existing plugin first and often needs more.
The hard stop is the agent's own `maxTurns`: 150 for `moku-builder` and for `moku-builder-deep`.
Complex and VeryComplex plugins go to the deep builder for its higher reasoning effort, not for more
turns.

| Tier | Expected turns |
|------|----------------|
| Nano | 25 |
| Micro | 40 |
| Standard | 55 |
| Complex | 70 |
| VeryComplex | 80 |

Builders lint each file as it turns green, so the final scoped pass finds nothing new and the output
contract is never lost to a lint backlog. Near the limit with files missing, the builder finishes the GREEN phase first. Priority order:
types.ts → index.ts (skeleton) → tests → state.ts → api.ts → handlers.ts → index.ts (final) → README.md.
Tests come before implementation because failing tests still work as an executable spec.

### Per-plugin tracking

Parse each builder's output contract and update the STATE.md plugin table. Refresh the `## Recovery`
block on every write (last good step, open blockers, the exact next command, timestamp) per
`memory-schema.md`, so a fresh session rehydrates in one read.

| Builder verdict | STATE.md status |
|---|---|
| PASS | `built` |
| PARTIAL | `agent-incomplete` |
| FAIL, or no output contract | `agent-failed` |

**Stub sentinel check.** Before accepting `built`:

```bash
grep -r "not implemented" src/plugins/{name}/ --include="*.ts" --exclude-dir="__tests__"
```

A hit in `api.ts`, `handlers.ts`, `state.ts` or `index.ts` means the plugin is not implemented — mark
`agent-incomplete` and re-spawn. A deliberate `throw new Error("not implemented")` on an optional path
is fine when a `// TODO:` comment says why.

**TDD check.** For each `built` plugin:

```bash
grep -c "expect\|assert\|toEqual\|toBe\|toThrow" src/plugins/{name}/__tests__/unit/*.test.ts
```

Zero means the tests are all `it.todo()` stubs — mark `agent-incomplete`, note "no real assertions,
RED phase skipped".

`agent-incomplete` and `agent-failed` plugins do not go through gap closure — that is for verification
failures, not build failures. Re-spawn the builder (the deep variant on the second attempt) with a note
about what already exists on disk. If that also fails, mark `needs-manual`, carry on with the rest of
the wave, and report those plugins at the end. They are excluded from verification.

### Wave table format

`/moku:plan` emits this shape and build detects it to skip its own wave analysis, so the `| Wave |`
column must be fully populated. A Plugins cell may be a framework-target label.

| Wave | Plugins | Status |
|------|---------|--------|
| 0 | log, env | verified |
| 1 | router, site, i18n | building |
| 2 | _framework: src/index.ts exports, tsdown ./client, package.json engines_ | not started |

## Wave disposition — continue, stop, or retry

After verification and any gap closure, decide yourself whether the wave is good enough to build on.
Nothing is spawned for this; you have the verification output, the code review findings and the gap
closure history in front of you.

Weigh six things:

| Axis | Healthy | Worrying |
|---|---|---|
| Verification | every plugin passes | a failure pattern repeats across plugins |
| Error trajectory | error count falls each gap closure round | flat or oscillating — fixation |
| Tests | unit and integration present, passing, real assertions | missing tests or shallow assertions |
| Integration | tsc and lint clean | errors, or warnings piling up |
| Remaining blockers | none, or cosmetic | architecture, broken exports, broken inference |
| Regression (wave 1+) | prior plugins still green | this wave broke earlier work |

| Decision | When |
|---|---|
| `continue` | Verification passed, remaining issues are cosmetic, error counts reached zero. |
| `stop-for-review` | Any `needs-manual` plugin, a regression in earlier work, a systemic failure pattern, many unresolved validator conflicts, or you are unsure. Uncertainty resolves here, not toward continue. |
| `fresh-retry` | Gap closure exhausted its rounds and the error signatures or the proposed fixes repeat — fixation. Go to `build-verification.md` Step 4c2. |

`stop-for-review` stops even under `--continue`: `moku-rails pause --reason "<judgment>"`, then ask
via `AskUserQuestion` whether to continue anyway, stop and review, or see the full reasoning. A
"continue anyway" applies to this wave only; judge the next wave on its own evidence.

Skip the judgment for a wave of one Nano or Micro plugin that verified with zero warnings. Record the
decision and its reason in `.planning/build/agent-log.md`. Dispositions are not persisted in STATE.md —
a completed wave is never re-judged on resume.

## Wave Pipelining (build N+1 while verifying N)

With `--continue` and three or more waves, overlap building wave N+1 with verifying wave N, for roughly
30–50% more throughput. Disable with `enablePipelining: false`.

**Why it is safe.** Wave N+1 builders need only `types.ts` and `index.ts` from wave N, both written
during wave N's build phase. Verification fixes implementation bugs in `state.ts`, `api.ts` and
`handlers.ts`, so the interfaces rarely move.

**Conditions — all must hold:** `--continue` active; total waves ≥ 3; every wave N plugin is `built`
(no `agent-failed` or `agent-incomplete`, which would leave broken interfaces on disk); wave N+1 exists.
Otherwise fall back to sequential.

**Flow.** Spawn two groups at once: Group V verifies wave N (`build-verification.md` Step 4a), Group B
builds wave N+1. Wait for both, then reconcile. Split parallelism between them —
Group V gets `ceil(maxParallelAgents / 2)`, Group B the rest.

**Pipeline state.** While pipelining, STATE.md carries:

```markdown
## Pipeline Status
- Wave [N]: verifying (build complete, verification in progress)
- Wave [N+1]: building (pipelined start, pending verification)
- Interface files at pipeline start: [wave N types.ts/index.ts hashes]
```

Plugins built this way get status `pipeline-built`: built during a pipeline, not yet reconciled.
Remove the section after reconciliation.

**Reconciliation.**

1. Wave N passed with no gap closure, or gap closure touched no `types.ts`/`index.ts`: wave N+1's
   builds stand.
2. Gap closure changed interfaces: compare hashes against the ones recorded at pipeline start.
   ```bash
   shasum src/plugins/{wave-N-plugin}/types.ts src/plugins/{wave-N-plugin}/index.ts
   ```
   Re-build only the wave N+1 plugins whose **direct** dependency changed; transitive ones do not
   import across two levels.
3. More than half of wave N+1 invalidated: discard all of it and rebuild the wave cleanly — partial
   rebuilds on mostly-invalid code cost more than a restart.

**Interaction with the wave disposition.** `continue` proceeds to integration and then wave N+1
verification. `stop-for-review` stops the pipeline and preserves wave N+1 as `pipeline-built`.
`fresh-retry` stops the pipeline and discards wave N+1 — the session is ending for a fresh context,
and wave N retries first on resume.

**Do not pipeline** when wave N has a `needs-manual` plugin (manual work usually moves interfaces),
when wave N is the skeleton, or when wave N+1 is a single VeryComplex plugin (one big agent is harder
to invalidate than several small ones).

## Resume with fresh-context retry

When resume finds plugins with status `retry-pending`:

1. Read `## Fresh Retry Context` from STATE.md (error summary, strategies already tried).
2. Process only those plugins — the rest of the wave is done.
3. Ask `moku-error-diagnostician` (or `-deep`) for a diagnosis with a minimal prompt: the error
   summary, the plugin spec, and an instruction to read the current files on disk. Apply the fix yourself.
4. Re-run verification (`build-verification.md` Step 4c2).
5. Green: mark `verified`, remove `## Fresh Retry Context`, continue. Red: mark `needs-manual` and report.

A fresh context avoids the fixation that builds up when the same conversation keeps attempting the
same failed approach.
