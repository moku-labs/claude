---
description: Audit a moku command or the hooks system — simulate scenarios, find gaps, propose improvements
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
argument-hint: <command-name|hooks|all> [--sim-only] [--iterate] [--max-scenarios N]
disable-model-invocation: true
---

## Project Configuration
!`test -f .claude/moku.local.md && head -20 .claude/moku.local.md || true`

Use configuration values above if present. Validate before using — ignore invalid values and use defaults:

| Setting | Type | Range | Default |
|---------|------|-------|---------|
| `maxParallelAgents` | integer | 1–5 | 3 |
| `auditMaxScenarios` | integer | 5–50 | 20 |
| `auditIterateLimit` | integer | 1–5 | 3 |

---

Audit a moku command by simulating it across generated scenarios and finding gaps. Or audit the hooks system to find bugs and the known prompt-hook false-block issue. Proposes concrete improvements for user approval.

Usage:
- `plan` → audit commands/plan.md
- `build` → audit commands/build.md
- `hooks` → audit hooks.json + all hook scripts
- `all` → audit all commands + hooks sequentially

Flags:
- `--sim-only` — skip real execution phase (faster, no temp project)
- `--iterate` — re-run after applying fixes (up to `auditIterateLimit` passes)
- `--max-scenarios N` — override scenario cap for this run

---

## Step 0: Parse Arguments

Parse `$ARGUMENTS` into TARGET and FLAGS.

**Extract flags first** (remove from string before parsing TARGET):
- If `--sim-only` present → set SIM_ONLY=true, remove from string
- If `--iterate` present → set ITERATE=true, remove from string
- If `--max-scenarios N` present → set MAX_SCENARIOS=N, remove from string; otherwise use `auditMaxScenarios` config value (default 20)

**Extract TARGET** from remaining first word:
- `plan`, `build`, `check`, `status`, `init` → command audit mode for that file
- `hooks` → hooks audit mode
- `all` → audit all 5 commands + hooks sequentially (prompt user between each)
- Anything else → stop and say: "Unknown target '{value}'. Valid targets: plan, build, check, status, init, hooks, all"

**Validate in command mode:**
!`ls ${CLAUDE_PLUGIN_ROOT}/commands/*.md 2>/dev/null | xargs -I{} basename {} .md | sort`

If TARGET is a command name, verify `${CLAUDE_PLUGIN_ROOT}/commands/{TARGET}.md` exists. If not: "Command file not found: commands/{TARGET}.md"

**Initialize iteration counter**: ITERATION=1

---

## Step 1: Route by Mode

If TARGET is `hooks` → jump to **Hooks Audit Mode** (Step H1).

If TARGET is `all` → run command audit for each of `plan`, `build`, `check`, `status`, `init` in sequence (prompt user between each), then run hooks audit. Skip to Step 2 for the first command.

Otherwise → proceed to **Command Audit Mode** (Step 2).

---

## Step 2: Read Target Command (Command Audit Mode)

Read `${CLAUDE_PLUGIN_ROOT}/commands/{TARGET}.md`.

Show:
```
Auditing: commands/{TARGET}.md
Pass {ITERATION}/{auditIterateLimit} | Scenarios cap: {MAX_SCENARIOS} | Mode: {simulation+execution | sim-only}
```

---

## Step 3: Generate Scenarios

Spawn **moku-audit-scenario-generator** with:
- The full content of `commands/{TARGET}.md`
- `auditMaxScenarios` = MAX_SCENARIOS

Wait for it to complete. Parse the JSON output contract from its response.

Present the scenario plan to the user:

```
Scenario Plan: {TARGET}.md ({total} scenarios)
  Valid inputs:     {valid}
  Edge cases:       {edge}
  Error paths:      {error}
  Adversarial:      {adversarial}
  Execution-value:  {execution_value_count} (will run in real temp project)

Press Enter to continue, or type a number to cap scenarios at that count:
```

Wait for user input. If user types a number N: trim scenarios to N using the priority order from audit-framework.md (adversarial first, never below 2 per category). Update the scenario list accordingly.

---

## Step 4: Parallel Pipeline

Run simulation and execution concurrently.

### Group A — Simulation

Split scenarios into batches of `min(maxParallelAgents, 5)`. For each batch, spawn **moku-audit-simulator** with:
- The full content of `commands/{TARGET}.md`
- The batch of scenarios
- An empty Prior Findings Summary (first pass) or the prior findings from the previous iteration

Run up to `maxParallelAgents` simulator instances at a time. Wait for all to complete.

### Group B — Real Execution (skip if SIM_ONLY=true)

Before spawning the executor, set up the temp project:

```bash
AUDIT_TMP=$(mktemp -d /tmp/moku-audit-$(date +%s)-XXXXXX)
mkdir -p "$AUDIT_TMP/src/plugins" "$AUDIT_TMP/.planning"
```

Write the bootstrap files (from audit-framework.md templates) to AUDIT_TMP using Write tool:
- `$AUDIT_TMP/package.json`
- `$AUDIT_TMP/src/config.ts`
- `$AUDIT_TMP/src/index.ts`
- `$AUDIT_TMP/.planning/STATE.md`

Then run git init:
```bash
cd "$AUDIT_TMP" && git init -q && git config user.email "audit@test.local" && git config user.name "Audit" && git add -A && git commit -m "bootstrap" -q
```

Spawn **moku-audit-executor** with:
- The full content of `commands/{TARGET}.md`
- The scenarios where `execution_value: true` (max 5)
- The AUDIT_TMP path

Groups A and B run concurrently — start Group B setup and spawning while Group A simulators are running.

Wait for ALL agents (simulators + executor) to complete.

**Safety cleanup** (if executor didn't clean up — check its output contract for `temp_dir_cleaned`):
```bash
ls /tmp/moku-audit-* 2>/dev/null && rm -rf /tmp/moku-audit-* || true
```

---

## Step 5: Cross-Inject Findings

After all agents complete, extract the Prior Findings Summary from their output contracts:

1. Collect all BLOCKER-severity gaps from all simulators, noting scenario IDs
2. Collect all execution failures from the executor (if run), with scenario IDs
3. Note agreement count for each gap: "flagged by N simulators"
4. Build a `## Prior Findings Summary` section (~20–30 lines):
   - All BLOCKERs with step reference and scenario that exposed each
   - Execution failures with exact arguments that triggered them
   - Agreement counts for high-confidence gaps

This summary will be passed to the synthesizer.

---

## Step 6: Synthesize

Spawn **moku-audit-synthesizer** with:
- The full content of `commands/{TARGET}.md` (original, unmodified)
- All simulator output contracts
- The executor output contract (or absent if SIM_ONLY)
- The Prior Findings Summary from Step 5
- The full scenario list (for pass rate calculation)

Wait for it to complete.

---

## Step 7: User Gate

Parse the synthesizer output. Display:

1. The audit report section
2. The unified diff

Then ask:

```
{gaps_found} gap(s) found | {gaps_addressed} addressed in proposal | Pass rate: {scenario_pass_rate}

Apply this improvement to commands/{TARGET}.md?
  [y] Yes — apply the proposed changes
  [n] No  — keep original, show report only
  [e] Edit — describe specific adjustments to the proposal first
```

**If user says y:**
Write the complete improved command text (from the synthesizer's markdown block) to `${CLAUDE_PLUGIN_ROOT}/commands/{TARGET}.md`.
Confirm: "Updated commands/{TARGET}.md — {N} changes applied."

**If user says n:**
Show the full audit report. Say: "No changes applied. Run `/moku:audit {TARGET}` again after manual edits to re-audit."

**If user says e (edit round):**
Ask the user to describe what they want changed in the proposal. Apply their described changes to the synthesizer's improved text, re-display the diff. Ask y/n/e again. Track edit rounds — after 3 rounds without y/n, default to n.

---

## Step 8: Iterate (if --iterate)

If ITERATE=true AND changes were applied in Step 7 AND ITERATION < auditIterateLimit:

If the synthesizer reported `"audit_stable": true`:
→ Print: "AUDIT-STABLE after {ITERATION} pass(es). No further iteration needed."
→ Stop.

Otherwise:
→ Increment ITERATION
→ Return to Step 2 using the now-updated command file

If ITERATE=true AND no changes were applied:
→ Print: "No changes applied — iteration skipped."

If ITERATION >= auditIterateLimit and still not stable:
→ Print: "Iteration limit reached ({auditIterateLimit} passes). Run `/moku:audit {TARGET}` again to continue."

---

## Hooks Audit Mode

### Step H1: Read Hooks System

Read all hook files:
```bash
cat "${CLAUDE_PLUGIN_ROOT}/hooks/hooks.json"
```
!`ls -la ${CLAUDE_PLUGIN_ROOT}/hooks/*.sh`

Read each `.sh` file from the listing above.

### Step H2: Spawn Hooks Analyzer

Spawn **moku-audit-hooks-analyzer** with:
- The full content of `hooks/hooks.json`
- The full content of all `.sh` hook scripts (provide each as named sections)

Wait for it to complete.

### Step H3: User Gate (Hooks)

Parse the hooks-analyzer output contract. Display the full hooks audit report.

Show each proposed fix grouped by file:

```
hooks.json:          {N} changes
approve-planning-writes.sh: {N} changes
[prompt hook text]:  {N} changes
...

Apply all proposed fixes?
  [y] Yes — apply all changes to hooks files
  [n] No  — show report only, apply nothing
  [s] Select — choose which files to update
```

**If y:** For each proposed file change from the hooks-analyzer:
- Edit `${CLAUDE_PLUGIN_ROOT}/hooks/hooks.json` or the relevant `.sh` file with the proposed fix
- Confirm each edit as it's applied

**If s:** List each file with a proposed change and ask individually.

**If n:** Show full report. "No changes applied."

After hooks audit completes, if TARGET was `all`, proceed to the next command in sequence.
