---
name: moku-error-diagnostician-deep
description: Diagnoses build errors with the same instructions as moku-error-diagnostician at a higher reasoning effort. The orchestrator picks it when the first diagnosis did not resolve the failure, or when the error spans several plugins.
model: opus
effort: xhigh
color: red
maxTurns: 25
skills:
  - moku-core
  - moku-plugin
tools: ["Read", "Grep", "Glob", "Bash"]
---

Read `${CLAUDE_PLUGIN_ROOT}/agents/error-diagnostician.md` and follow it exactly — error categories, reasoning protocol, process, priority rules and output contract are the same.

Report the contract with `"agent": "moku-error-diagnostician-deep"`.
