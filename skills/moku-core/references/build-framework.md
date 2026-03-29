# Framework Build — Detailed Steps

## Pre-requisite: Skeleton Must Be Committed

The build command's Skeleton Detection step (in `commands/build.md`) handles this automatically. If `## Skeleton:` in STATE.md is not `committed`, the build command routes to `build-skeleton.md` first and never reaches this file. If you are reading this file, the skeleton is already committed and all skeleton source files exist.

This is the master reference for `/moku:build framework`. Each step links to a dedicated reference file. Read only the file relevant to your current phase — this keeps context lean.

## Step 1: Read and Validate the Plan

Read the specification from the provided path (defaults to `.planning/specs/`). If a directory, read `01-*.md`, `02-*.md`, etc. in order. Verify it contains:
- Global Config and Events types
- Plugin list with implementation order (core plugins identified separately)
- Plugin specifications with configs, states, APIs, events
- Core plugin specifications (if any) with the simplified template

If the plan is incomplete, ask the user to run `/moku:plan framework` first.

## Steps 2–3: Wave Analysis, Pre-Flight & Execution

→ Read **`build-wave-execution.md`**

Covers: wave dependency analysis, pre-flight checks (tsc/lint/deps), builder sub-agent prompts with output contracts, agent turn limits, parallel execution strategy, per-plugin tracking (PASS/PARTIAL/FAIL).

## Step 4: Post-Wave Verification & Integration

→ Read **`build-verification.md`**

Covers: plugin verification (3-level), gap closure with error-diagnostician (circuit breaker), spec verification ticking, content hash recording, save-progress-and-stop protocol.

### Framework File Assembly (Step 4b detail)

→ Read **`build-assembly.md`**

Covers: `src/plugins/index.ts` barrel structure, `src/index.ts` self-documenting manifest pattern, integration check sequence (format → lint → tsc → build).

## Steps 5–7.5: Final Verification, Documentation, Testing, CI/CD & Validation

→ Read **`build-final.md`**

Covers: final framework verification (Step 5), plugin README wave (5.5), root documentation + LLM docs (5.6), documentation validation (5.7), integration test wave (5.8), coverage verification (5.9), CI/CD generation (5.10), post-build validation pipeline (Step 6), final report (Step 7), cycle archive (Step 7.5), and delta updates for subsequent builds (Step 8).

---

## Quick Reference: Build Phase → File

| Phase | Reference File | When to Read |
|-------|---------------|--------------|
| Skeleton build | `build-skeleton.md` | Before all other steps |
| Wave analysis & building | `build-wave-execution.md` | Starting a new wave |
| Verification & gap closure | `build-verification.md` | After wave agents return |
| Barrel & index patterns | `build-assembly.md` | Updating framework files |
| Final verification | `build-final.md` Step 5 | All waves complete |
| README wave | `build-final.md` Step 5.5 | After final verification |
| Root docs + LLM docs | `build-final.md` Step 5.6 | After plugin READMEs |
| Documentation validation | `build-final.md` Step 5.7 | After docs generated |
| Integration tests | `build-final.md` Step 5.8 | After docs validated |
| Coverage verification | `build-final.md` Step 5.9 | After integration tests |
| CI/CD generation | `build-final.md` Step 5.10 | After coverage verified |
| Post-build validation | `build-final.md` Step 6 | After CI/CD generated |
| Report + state update | `build-final.md` Step 7 | After validation passes |
| Cycle archive | `build-final.md` Step 7.5 | After report |
| Delta updates | `build-final.md` Step 8 | Subsequent builds only |
