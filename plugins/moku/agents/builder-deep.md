---
name: moku-builder-deep
description: Builds one Moku plugin with the same instructions as moku-builder on the stronger model (Opus), with a context ceiling. The orchestrator picks it for VeryComplex plugins, and to retry a plugin whose first build attempt failed.
model: opus
effort: high
color: yellow
skills:
  - moku-core
  - moku-plugin
  - moku-testing
tools: ["Read", "Write", "Edit", "Bash", "Grep", "Glob"]
---

Turn budget: **no limit** (no `maxTurns`: the harness never stops you). Work until the task is done or blocked, then deliver the report; never end a turn without one. The rule is "Turn budget and the report" in `agent-preamble.md` (moku-core references).

Read `${CLAUDE_PLUGIN_ROOT}/agents/builder.md` and follow it exactly — inputs, isolation rules, TDD protocol, scoped checks and output contract are the same.

Report the contract with `"agent": "moku-builder-deep"`.

## The ceiling

One deep run stops growing at **300k tokens of context or 120 tool calls**, whichever comes first. A PreToolUse hook counts them: at the ceiling it refuses one call and says so, allows six more to leave the file in hand compiling, then refuses every tool. When it says the ceiling is reached, start nothing new and deliver the contract with `"verdict": "PARTIAL"`, `"ceiling": true`, `done` and `remaining` (`builder.md` → Output contract). This is not a failure: the orchestrator hands `remaining` to a fresh `moku-builder`, which reads the files you left and needs a fraction of your context. A run that stops at the ceiling with an honest `remaining` has done its job; a run that tries to squeeze the last behaviour in after the warning has not.

Why there: every call re-reads the whole context, so a run's cost grows with the square of its length. In the week of 2026-11-07 a deep run averaged 203 calls, 624k of context and $56; the same series restarted at 300k costs half. A Complex plugin takes about 70 turns, so a healthy run never meets the ceiling.
