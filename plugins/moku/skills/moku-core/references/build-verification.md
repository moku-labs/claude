# Build: Post-Wave Verification & Gap Closure (Step 4)

## Step 4a0: Independent reconciliation

Treat builder reports as hints. In a real build two parallel builders both reported "all green" while
one had silently reverted the other's files to stubs, so check disk, git and the tools yourself before
trusting a wave:

1. `git status --short` — every plugin reported `built` must show modified or added tracked files.
   A `built` plugin whose files do not appear has probably been reverted by a sibling: mark
   `verify-failed` and route to gap closure.
2. Every path in the builder's `filesCreated` exists on disk. A missing file is `verify-failed`.
3. Run `bunx tsc --noEmit`, `bun run lint` and `bun run test` yourself. Where a builder's counts
   disagree with the tools, the tools win.
4. Builders do not commit. A wave commit in `git log` from a builder is a flag.

Only plugins that survive reconciliation reach Step 4a. Record the results in
`.planning/build/reconciliation-{wave}.md` for forensics; `/moku:clean` prunes them.

## Step 4a: Artifact check + code review (parallel)

Only plugins with status `built` are checked. Skip `agent-incomplete`, `agent-failed` and `needs-manual`.

### Lazy skip by hash

Before checking anything, skip plugins that have not changed since a prior successful verification
(common on resume after a crash mid-verification):

1. `find src/plugins/{name} -type f -name '*.ts' | sort | xargs shasum | shasum | cut -d' ' -f1`
2. Compare with the `Hash` column in the STATE.md plugin table.
3. Match, and the plugin was previously `verified`: restore `verified`, log the skip.
4. No match or no prior hash: verify normally.

This saves most of the work on resume builds.

**Public-API hash (for the README gate, Step 4d3).** A second, narrower fingerprint over the
consumer-facing surface only — the `api:`/`Api` type, emitted `events`, `Config` keys — so an internal
refactor does not force README churn:

```bash
{ for f in api.ts events.ts config.ts types.ts index.ts; do
    test -f "src/plugins/{name}/$f" && cat "src/plugins/{name}/$f"
  done; } | shasum -a 256 | cut -d' ' -f1
# Nano/Micro with a single index.ts falls back to that file's content
```

Record it beside the full hash (Step 4d2).

### Run both checks at once

1. Run the artifact check per plugin — it is a script, not an agent:
   ```bash
   moku-verify-artifacts <plugin> --tier <tier> --run --json
   ```
   Exit 0 is pass, exit 2 is fail. It covers the three levels: files exist, content is substantive
   rather than stubs, and the plugin is wired with lint and tests passing.
2. In parallel, spawn `moku-code-reviewer` with the wave's git diff, the specs, the plugin list and
   the builder intent summaries.
3. Update each plugin: `built` → `verified` on exit 0, `built` → `verify-failed` on exit 2.
4. Any `verify-failed` plugin sends the wave into gap closure (Step 4c). Hold the code review findings
   until gap closure resolves — reviewing code that is about to be rewritten is wasted. Afterwards,
   re-review only the files gap closure touched.
5. All verified: go to Step 4a2.

## Step 4a2: Code review triage

The code reviewer ran in parallel above; its output is ready.

- `verdict: PASS` → straight to Step 4b.
- `verdict: ISSUES` or `BLOCKER` → run the triage flow in
  `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/build-findings-triage.md`. Only "fix now"
  findings enter gap closure.

Before triage, check `.planning/build/findings.md` for deferred findings on files this wave modified
and re-surface them.

Skip code review for a Wave 0 made only of Nano/Micro core plugins — there is little logic to review.

Triage outcomes (fix / defer / dismiss counts) feed the wave disposition in `build-wave-execution.md`.

## Step 4a3: Conflict resolution

When the artifact check, the code reviewer and the validators disagree about the same file, resolve it
before gap closure. Protocol: `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/build-conflict-resolution.md`.
Skip this when they agree or their findings sit on different files.

Findings from Sonnet validators pass through `moku-skeptic` first; one that does not survive does not
enter triage or gap closure.

---

## Step 4b: Update framework files + integration checks

Wire the wave's plugins into the framework. Shapes: **`build-assembly.md`**.

1. `src/config.ts` — add the wave's Config and Events types to the framework unions. Core plugins go
   into `createCoreConfig({ plugins: [...] })` and `pluginConfigs` when they need overrides.
2. `src/plugins/index.ts` — add the barrel re-exports.
3. `src/index.ts` — import from `./plugins`, add regular plugins to the `createCore` plugin list and
   to the grouped exports. Core plugins are already registered in config.ts.
4. `package.json` — add any new dependencies the wave's specs introduced.

Then run the integration checks in the target workspace:

1. **Format** — `bun run format`.
2. **Lint** — `bun run lint`; on errors `bun run lint:fix`, then fix by hand what remains. Builders
   already ran scoped ESLint, so this pass should be a confirmation. New in-scope findings here mean
   that builder's PASS was overstated — route the fix and note the gap.
3. **Types** — `bunx tsc --noEmit`, zero errors.
4. **Build and bundled types** — `bun run build`. `tsc --noEmit` is not enough: it type-checks source
   and does not catch `.d.ts` bundling bugs. A real build passed `tsc --noEmit` and shipped a broken
   `.d.ts` because an injectable function type referenced a runtime package's namespace type
   (`import("bun").SpawnOptions.X`), which the bundler dropped, so the consumer-facing type resolved to
   `undefined`. After the build exits 0, sanity-check the emitted `.d.ts` — `bunx publint` if
   available, or grep the dist `.d.ts` for `undefined`/`any` where a real type belongs. Fix such a
   symbol at the source with a structural type of your own, never a runtime package's namespace type.
   This step runs every wave, not at commit time.

Re-run the whole sequence after any fix, until all four are clean.

## Step 4b2: Regression testing

New framework wiring can break plugins that passed in earlier waves, so re-test them.

**When.** Skip for Wave 0 (nothing earlier exists). Run from Wave 1 on. Skip a previously verified
plugin only when its own hash is unchanged, none of its dependencies changed this wave, and no
framework file (`src/config.ts`, `src/plugins/index.ts`, `src/index.ts`) changed. If a framework file
changed, re-test everything.

**How.**

1. Collect plugins with status `verified` from earlier waves.
2. Run their tests together — one command is far faster than one run per plugin:
   ```bash
   bun test src/plugins/router/ src/plugins/auth/ src/plugins/cache/
   ```
3. A failure is a regression. Classify it: a type error means this wave broke a type contract, a test
   failure means it broke behavior, an import error means barrel or wiring.
4. Route the fix at the cause, not the symptom. A framework file caused it → fix the framework file.
   A dependency's API change caused it → that is a blocker: "Wave N plugin X changed its API and broke
   wave M plugin Y. Make X backward-compatible or update Y." Everything goes through gap closure with
   category `regression` so the diagnostician knows this is not a fresh build failure.

Record the outcome in STATE.md:

```markdown
## Wave [N] Regression
- Scope: [count] previously verified plugins tested
- Result: PASS | [count] regressions found
- Details: [plugin]: [test file] — [failure description]
```

---

## Step 4c: Gap closure

For plugins with status `verify-failed`:

1. Collect the failures into one gap list.
2. Ask `moku-error-diagnostician` (or `-deep` after a failed round) to classify root causes and
   propose targeted fixes. It returns a diagnosis; you apply the fix.
3. Apply root causes first — cascading errors usually clear on their own.
4. Re-run the check that found the blocker, mapped by the diagnostician's category:

   | Category | Re-run |
   |---|---|
   | `type-inference`, `import-type`, `test-mock`, `test-assertion` | `moku-quality-validator` |
   | `anti-pattern`, `config-shape`, `lifecycle`, `event-type`, `missing-export`, `dependency` | `moku-structure-validator` |
   | `jsdoc`, `readable-code` | `moku-style-validator` |
   | `lint-format` | no agent — re-run `bun run lint` |
   | `docs-sync` | regenerate the plugin README, record the new `README-API Hash`, re-run `moku-structure-validator` |

5. Then re-run `moku-verify-artifacts` on the affected plugins for final confirmation.
6. Re-run the integration checks (`bun run format`, `bun run lint`, `bunx tsc --noEmit`) so the fix did
   not break something else. A failure here routes back through the diagnostician and counts against
   the circuit breaker.
7. Update status: `verify-failed` → `verified`, or leave it failing.

**Stalemate detection.** Record the error state and the strategy before each round, then compare:

- Error count rose — the fixes are making it worse.
- Error signatures identical — for `tsc`, same file, same error code, line within ±3; for tests, same
  test name; for lint, same rule and file. Hash `(file, errorCode, lineRange)` per error to compare.
- The diagnostician proposed the same fix as a previous round — fixation.

On a stalemate, force a different approach before retrying:

1. Append what was tried to `.planning/build/strategy-log.md`:
   ```markdown
   ## Wave [N], Plugin [name], Round [R]
   - Strategy: [e.g. added explicit type annotation to api.ts:42]
   - Error: [signature]
   - Result: STALEMATE — same error persists
   ```
2. Give the diagnostician the strategy log and require a fundamentally different approach: changed the
   implementation last time → change the types; added code → remove or simplify code; worked around it
   → fix the root cause; touched one file → move along the dependency chain. When local options run
   out, restructure (split a Standard plugin in two, reverse a dependency, merge with a related plugin).
3. Applying the alternative counts as the next round, not a free attempt.
4. Before applying any proposed fix, compare it with the strategy log. More than ~80% textual overlap
   with a previous attempt for the same error means reject it and ask for a real alternative — this is
   what stops the "same fix, different wording" loop.
5. A second stalemate on the same error goes to Step 4c2 with both strategies recorded.

**Circuit breaker.** At most `gapClosureMaxRounds` rounds per wave (default 2). Beyond that, Step 4c2.

## Step 4c2: Fresh-context retry

A long conversation makes an agent repeat its own failed approach. A fresh context that sees only the
error, the spec and the current code usually breaks the loop.

1. For each `verify-failed` plugin, collect: name and tier, the exact errors, what was attempted and
   why it failed, the strategy history from `.planning/build/strategy-log.md`, and the spec's
   `## Verification` section.
2. Save it to STATE.md:
   ```markdown
   ## Fresh Retry Context
   Plugins needing fresh-context retry: [plugin-list]
   Error summary:
   - [plugin]: [TS2345 in api.ts:42 — attempted fix X, still fails because Y]
   Strategies already tried, do not repeat:
   - Strategy 1: [description] — [why it failed]
   Gap closure rounds exhausted: [N]
   The next attempt must take a fundamentally different approach.
   ```
3. Mark those plugins `retry-pending` and set
   `## Next Action: Run /moku:build resume (fresh-context retry for [plugin-list])`.
4. Stop the session, even under `--continue` — a fresh context window is the entire point:
   > "Gap closure exhausted after [N] rounds for [plugin-list]. The error context is saved. Run
   > `/moku:build resume` — the next session starts with a clean context, which usually breaks the loop."
5. On resume, follow "Resume with fresh-context retry" in `build-wave-execution.md`. Green → `verified`
   and remove the section; red → `needs-manual` and report.

## Step 4d: Tick spec verification checkboxes

For each verified plugin, read its `.planning/specs/0N-name.md` `## Verification` section and evaluate
each checkbox against what was built: directory and tier structure on the filesystem, config shape
against `types.ts`, API signatures against `api.ts`, events by grepping `ctx.emit` and `events:`, lint
and format from the integration checks, no explicit generics by grepping `createPlugin<`.

Tick what passes (`- [ ]` → `- [x]`), annotate what fails (`- [ ] API methods — FAIL: missing navigate()`),
and route the failures to gap closure.

## Step 4d2: Record content hashes

```bash
find src/plugins/{name} -type f -name '*.ts' | sort | xargs shasum | shasum | cut -d' ' -f1
# Public-API hash: see Step 4a
```

Store them in the STATE.md plugin table: `| Name | Tier | Wave | Status | Hash | API Hash | README-API Hash |`

- `Hash` — full source hash, for the lazy skip.
- `API Hash` — the current public-API hash.
- `README-API Hash` — the public-API hash captured when this plugin's README was last generated.
  Update it only in a pass that actually regenerated the README; otherwise carry the old value
  forward, so a stale README keeps failing Step 4d3.

## Step 4d3: README freshness vs public API

A change to a plugin's public API requires its README to move with it. Runs for Standard+ tiers and
any lower tier that already ships a README.

1. A plugin is at risk when `API Hash` ≠ `README-API Hash`, or a Standard+ plugin has no README.
2. `moku-structure-validator` confirms it by comparing the README's `## API` / `## Events` / `## Config`
   sections against the source. A method, event or config key the README lacks or misstates is a
   blocker with category `docs-sync`. A changed hash with a README that already matches is not stale —
   just refresh `README-API Hash`.
3. A `docs-sync` blocker goes to gap closure: regenerate the README, record the new hash. The wave is
   not fully verified while one is open.

Plugins whose public-API hash is unchanged need no README work.

## Step 4e: Archive the completed wave

Keep STATE.md small — it is read on every resume.

1. Append the wave's full plugin rows (status, hashes, verification notes) to
   `.planning/build/STATE-history.md` under a `## Wave N` header with a timestamp.
2. Replace those rows in STATE.md with one summary line:
   ```
   | Wave N | 4 plugins | verified | 2025-01-15 |
   ```
3. Keep in STATE.md only the summary table, the current wave's detail, and any `needs-manual` plugins,
   which need to stay visible.

## Step 4e2: Save progress and stop

One wave per invocation unless `--continue` is active.

1. Write to STATE.md: wave completion and integration results, per-plugin status, spec checkbox results,
   and `## Next Action: Run /moku:build resume to continue with Wave [N+1]`.
2. Under `--continue`, go straight to the next wave.
3. Otherwise `moku-rails pause --reason "wave [N] complete"` and tell the user:
   > "Wave [N] complete ([plugin list]). All integration checks pass. Run `/moku:build resume` to
   > continue with Wave [N+1]."
