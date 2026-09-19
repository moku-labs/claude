---
# A pack depends on the core plugin, so both are loaded for the run.
plugins: ["../../../plugins/moku-design", "../../../plugins/moku"]
max_turns: 14
allowed_tools: [Read, Glob, Grep, Skill, Bash]
tags: [design, api]
---

Before I write any code, I want to settle the shape of the public API for a new moku plugin — a streaks plugin for a habit tracker. How should it look to someone using it?
