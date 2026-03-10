# Framework Build — Detailed Steps

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

## Steps 5–7: Final Verification, READMEs & Validation

→ Read **`build-final.md`**

Covers: final framework verification, README wave (dedicated sub-agents), post-build validation pipeline (Group A → Group B → architecture), final report and STATE.md update.

---

## Quick Reference: Build Phase → File

| Phase | Reference File | When to Read |
|-------|---------------|--------------|
| Wave analysis & building | `build-wave-execution.md` | Starting a new wave |
| Verification & gap closure | `build-verification.md` | After wave agents return |
| Barrel & index patterns | `build-assembly.md` | Updating framework files |
| Final checks & validation | `build-final.md` | All waves complete |
