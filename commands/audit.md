---
description: Audit a moku command or the hooks system — simulate scenarios, find gaps, propose improvements
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion
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

Present the scenario plan, then use `AskUserQuestion`:
- Question: "Scenario plan for {TARGET}.md: {total} scenarios ({valid} valid, {edge} edge, {error} error, {adversarial} adversarial). {execution_value_count} will run in real temp project. Proceed?"
- Header: "Scenarios"
- Options:
  1. label: "Run all (Recommended)", description: "Execute all {total} scenarios as planned"
  2. label: "Quick audit", description: "Cap at 10 scenarios — faster but less thorough"
  3. label: "Minimal", description: "Cap at 5 scenarios — fastest, covers only critical paths"
  4. label: "Custom cap", description: "Specify a custom scenario limit"
- multiSelect: false

If user selects "Custom cap" or provides a number via "Other": trim scenarios to that count using the priority order from audit-framework.md (adversarial first, never below 2 per category).

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

Then use `AskUserQuestion`:
- Question: "{gaps_found} gap(s) found, {gaps_addressed} addressed. Pass rate: {scenario_pass_rate}. Apply improvements to commands/{TARGET}.md?"
- Header: "Apply"
- Options:
  1. label: "Apply all (Recommended)", description: "Write the improved command — {N} changes"
  2. label: "Show report only", description: "No changes applied — review the full report"
  3. label: "Edit proposal", description: "Describe adjustments before applying"
  4. label: "Apply selectively", description: "Choose which gaps to address"
- multiSelect: false

**If user selects Apply all:**
Write the complete improved command text (from the synthesizer's markdown block) to `${CLAUDE_PLUGIN_ROOT}/commands/{TARGET}.md`.
Confirm: "Updated commands/{TARGET}.md — {N} changes applied."
Record the decision in the severity calibration log (see Severity Calibration below).

**If user selects Show report only:**
Show the full audit report. Say: "No changes applied. Run `/moku:audit {TARGET}` again after manual edits to re-audit."
Record rejections in the severity calibration log.

**If user selects Edit proposal:**
Ask the user to describe what they want changed. Apply their described changes to the synthesizer's improved text, re-display the diff. Re-present the gate with `AskUserQuestion`. Track edit rounds — after 3 rounds without resolution, default to "Show report only".

**If user selects Apply selectively:**
Present each gap as a separate `AskUserQuestion` (batch up to 4 per question using multiSelect):
- Question: "Which fixes do you want to apply?"
- Header: "Select fixes"
- Options: list gap titles with severity
- multiSelect: true
Apply only selected fixes. Record per-gap decisions in severity calibration log.

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

Detect source path — if `./hooks/hooks.json` exists, the CWD is the plugin source:
```bash
SOURCE_HOOKS_DIR=""
[ -f "./hooks/hooks.json" ] && SOURCE_HOOKS_DIR="$(pwd)/hooks"
```

Read all hook files from `${CLAUDE_PLUGIN_ROOT}/hooks/`:
```bash
cat "${CLAUDE_PLUGIN_ROOT}/hooks/hooks.json"
```
!`ls -la ${CLAUDE_PLUGIN_ROOT}/hooks/*.sh`

Read each `.sh` file from the listing above.

### Step H2: Analyze Hooks Inline

Analyze all hook files directly — no agent spawn needed. Examine:

1. **hooks.json structure** — valid JSON, all `type` values are `command` or `prompt`, all referenced scripts exist and are executable, timeouts appropriate
2. **approve-planning-writes.sh** — test the allow-list against known planning files: `STATE.md`, `skeleton-spec.md`, `STATE-history.md`, `audit-*.md`, `specs/*.md`. Flag any planning files written by commands that are NOT in the allow-list
3. **check-plugin-antipatterns.sh** — verify file matcher scope (should only target `*/plugins/*` files, not top-level `index.ts` or `config.ts`), verify regex patterns for false positives
4. **validate-plugin-structure.sh** — verify source count excludes `*.test.ts`/`*.spec.ts`, verify depth checks
5. **Prompt hook** — analyze the prompt text: is `approve` the explicit default? Is output constrained to exactly one line? Does the non-plugin-file path come first?
6. **Remaining scripts** — check for: unquoted variables, exit-code correctness (all paths exit 0), missing input guards, hardcoded paths
7. **Coverage gaps** — any hook events missing from `hooks.json` that moku workflows would benefit from
8. **Diagnostics log analysis** — if `.planning/diagnostics.log` exists, analyze patterns:
   a. Count entries per category (PERM-DENY, ANTIPATTERN, INDEX-RULE, TOOL-FAIL, STOP-BLOCK, STRUCTURE)
   b. Identify recurring issues: group by message prefix, flag any that appear 3+ times
   c. For ANTIPATTERN entries: check if the same pattern was blocked multiple times — suggests Claude is not learning from the denial message. Propose rewording the denial reason for clarity.
   d. For TOOL-FAIL entries: identify most common failing tools and error patterns — suggest command improvements or missing error handling
   e. For PERM-DENY entries: if safe commands were denied (false positives), propose adding them to the safe list in auto-permissions.sh
   f. For STOP-BLOCK entries: verify they were appropriate (active wave existed at time of block)
   g. Produce a "Diagnostics Insights" section in the audit report:
      ```
      ── Diagnostics Insights ───────────────────
      Total entries: N (since last clear)

      By category:
        TOOL-FAIL:   N (%) — most common: "..." (Nx)
        ANTIPATTERN: N (%) — most common: "..." (Nx)
        PERM-DENY:   N (%) — most common: "..." (Nx)
        STOP-BLOCK:  N (%)
        INDEX-RULE:  N (%)
        STRUCTURE:   N (%)

      Recommendations:
        - [actionable insights based on patterns found]
      ```

Produce a structured report grouped by file, with severity (BLOCKER / HIGH / MEDIUM / LOW) and a concrete proposed fix for each finding.

### Step H3: User Gate (Hooks)

Display the full hooks audit report.

Show each proposed fix grouped by file, then use `AskUserQuestion`:
- Question: "Hooks audit found fixes for {N} files. How to proceed?"
- Header: "Apply fixes"
- Options:
  1. label: "Apply all (Recommended)", description: "Write fixes to all {N} hook files"
  2. label: "Report only", description: "Show full report, apply nothing"
  3. label: "Select files", description: "Choose which hook files to update"
  4. label: "Clear diagnostics", description: "Archive diagnostics.log and start fresh" (only include if `.planning/diagnostics.log` exists and has entries)
- multiSelect: false

**If Apply all:** For each proposed file change:
1. Write the fix to `${CLAUDE_PLUGIN_ROOT}/hooks/{file}` (installed/cache copy)
2. If SOURCE_HOOKS_DIR is set, also write the same fix to `${SOURCE_HOOKS_DIR}/{file}` (source copy)
3. Confirm: "Updated {file} — cache + source" or "Updated {file} — cache only"

**Note:** Use `python3` via Bash to apply fixes when the Edit/Write tool is blocked by the prompt hook (this is especially likely when editing `hooks.json` itself).

**If Select files:** Use `AskUserQuestion` with multiSelect:
- Question: "Which hook files should be updated?"
- Header: "Files"
- Options: one per file with proposed changes, label=filename, description=change count
- multiSelect: true
Apply the same dual-write logic per selected file.

**If Report only:** Show full report. "No changes applied."

**If Clear diagnostics (only shown when `.planning/diagnostics.log` exists and has entries):**
Copy `.planning/diagnostics.log` → `.planning/diagnostics-{YYYY-MM-DD}.log.bak`, then truncate `.planning/diagnostics.log` to empty. Confirm: "Diagnostics archived to diagnostics-{date}.log.bak. Fresh log started."

After hooks audit completes, if TARGET was `all`, proceed to the next command in sequence.

---

## Severity Calibration (Self-Learning)

The audit system learns from user decisions to calibrate gap severity over time. This data persists in `.planning/audit-learning.md` and is read by audit agents that have persistent memory.

### Recording Decisions

After every user gate (Step 7 or H3), record the user's decisions:

1. Read `.planning/audit-learning.md` (create if it doesn't exist)
2. For each gap in the proposal, append a row:
   ```markdown
   | {date} | {command} | {gap_type} | {severity} | {accepted/rejected/edited} | {user_rationale_if_any} |
   ```
3. "Accepted" = user applied the fix. "Rejected" = user chose report-only or skipped this gap. "Edited" = user modified the fix before applying.

### Calibration Input

When spawning audit agents (scenario-generator, synthesizer), include a severity calibration summary if `.planning/audit-learning.md` exists and has ≥ 5 entries:

1. Compute per-gap-type acceptance rate:
   ```
   missing-error-handling: 10/12 accepted (83%) → keep severity
   inefficiency: 2/8 accepted (25%) → suggest downgrading
   ambiguous-step: 6/7 accepted (86%) → keep severity
   ```
2. Include as a `## Severity Calibration` section in the agent prompt:
   - Gap types with < 40% acceptance rate → "This user rarely accepts {type} findings. Only report if HIGH confidence and clearly impactful."
   - Gap types with > 80% acceptance rate → "This user values {type} findings. Report all instances."
   - Gap types with 40-80% → no adjustment

### Calibration Decay

Entries older than 90 days are excluded from calibration calculations. Delete entries older than 180 days from the file to keep it bounded.

---

## Cross-Audit Correlation (for `all` mode)

When TARGET is `all`, after auditing all commands + hooks sequentially, add a cross-audit correlation step before the final summary:

### Step A1: Correlate Findings

1. **Collect all gaps** from all individual command audits + hooks audit
2. **Group by pattern**:
   - Same gap type appearing in 2+ commands → **Systemic issue** (e.g., `missing-error-handling` in both `plan` and `build`)
   - STATE.md-related gaps across commands → **Shared state management weakness**
   - Hook-related gaps mentioned in command audits → **Hook system gap**
   - Same wording/pattern in gaps → **Possible duplicate or shared root cause**
3. **Present correlation report** using `AskUserQuestion`:
   - Question: "Cross-audit found {N} systemic patterns across commands. Review?"
   - Header: "Correlate"
   - Options:
     1. label: "Show correlations (Recommended)", description: "View systemic patterns that affect multiple commands"
     2. label: "Skip", description: "Individual audit reports are sufficient"
   - multiSelect: false
4. If user wants to see: display the correlation report with severity, affected commands, and recommended fix approach (fix once at the root vs fix individually)

### Correlation Report Format

```
Cross-Audit Correlation ({N} systemic patterns)

1. [SYSTEMIC] missing-error-handling — affects: plan, build, audit
   Pattern: No recovery path when STATE.md is malformed
   Root fix: Add shared STATE.md validation helper

2. [SHARED-STATE] STATE.md write race — affects: plan, build
   Pattern: Both commands write STATE.md without checking concurrent access
   Root fix: Add file locking or last-writer-wins with backup

3. [HOOK-GAP] prompt hook blocks non-plugin writes — affects: build, audit
   Pattern: Commands that write to hooks/ or output-styles/ get blocked
   Root fix: Update approve-planning-writes.sh allowlist
```
