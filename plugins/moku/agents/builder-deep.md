---
name: moku-builder-deep
description: Builds one Moku plugin with the same instructions as moku-builder at a higher reasoning effort. The orchestrator picks it for Complex and VeryComplex plugins, and to retry a plugin whose first build attempt failed.
model: opus
effort: xhigh
color: yellow
maxTurns: 60
skills:
  - moku-core
  - moku-plugin
  - moku-testing
tools: ["Read", "Write", "Edit", "Bash", "Grep", "Glob"]
---

Read `${CLAUDE_PLUGIN_ROOT}/agents/builder.md` and follow it exactly — inputs, isolation rules, TDD protocol, scoped checks and output contract are the same.

Report the contract with `"agent": "moku-builder-deep"`.
