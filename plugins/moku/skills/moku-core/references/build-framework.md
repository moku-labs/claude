# Framework Build — Detailed Steps

The skeleton is already committed when you are reading this: the `build` skill routes to
`build-skeleton.md` whenever `## Skeleton:` in STATE.md is anything else. Every skeleton source file
exists.

This is the map for a framework build. Read the one file for the phase you are in; that keeps context lean.

## Step 1: Read and validate the plan

Read the specs (default `.planning/specs/`; for a directory, read `01-*.md`, `02-*.md` in order). They
need the global Config and Events types, the plugin list with implementation order (core plugins listed
separately), the per-plugin specs with config, state, API and events, and the core plugin specs on the
simplified template. Incomplete: ask the user to run `/moku:plan framework` first.

### Framework-capability verification

Whenever the plan relies on a capability of another package — `@moku-labs/core`'s re-exported factory
chain, a peer framework (`@moku-labs/worker`'s `deploy`/`cli`, `@moku-labs/room`'s `hubPlugin`), or any
`./subpath` export — prove it exists in the installed package before building to it: read that
package's `package.json` `exports` and its `dist`/types, and confirm the named export, generator, CLI or
subpath is present with the shape the plan assumes. In particular, do not assume a framework's
runtime/server export ships a deploy-config generator. Full procedure: `build-app.md` Step 2. If a
capability is absent, revise the plan rather than hand-rolling it or standing up a facade
(`moku-idioms.md` §I6).

## Steps 2–3: Wave analysis, pre-flight and execution

→ **`build-wave-execution.md`**

Dependency analysis, pre-flight checks, builder selection and prompts, parallel execution, per-plugin
tracking, pipelining, and the continue / stop-for-review / retry decision.

## Step 4: Post-wave verification and integration

→ **`build-verification.md`**

Reconciliation against disk and tooling, the artifact check, code review triage, gap closure, regression
testing, spec ticking, content hashes, the README-freshness gate, save-and-stop.

Framework file assembly (Step 4b shapes) → **`build-assembly.md`**.

## Steps 5–8: Final verification, documentation, tests and validation

→ **`build-final.md`**

Final verification (5), plugin README wave (5.5), root and LLM docs (5.6), doc validation (5.7),
integration tests (5.8), coverage (5.9), the release pointer (5.10), post-build validation (6), report
(7), cycle archive (7.5), delta updates (8).

## Phase → file

| Phase | File |
|-------|------|
| Skeleton build | `build-skeleton.md` |
| Wave analysis, building, wave disposition | `build-wave-execution.md` |
| Verification, gap closure, regression | `build-verification.md` |
| Barrel and index patterns | `build-assembly.md` |
| Final verification | `build-final.md` Step 5 |
| README wave | `build-final.md` Step 5.5 |
| Root docs and LLM docs | `build-final.md` Step 5.6 |
| Documentation validation | `build-final.md` Step 5.7 |
| Integration tests | `build-final.md` Step 5.8 |
| Coverage | `build-final.md` Step 5.9 |
| Release hand-off | `build-final.md` Step 5.10 |
| Post-build validation | `build-final.md` Step 6 |
| Report and state update | `build-final.md` Step 7 |
| Cycle archive | `build-final.md` Step 7.5 |
| Delta updates | `build-final.md` Step 8 |
