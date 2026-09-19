---
# A pack depends on the core plugin, so both are loaded for the run.
plugins: ["../../../plugins/moku-web", "../../../plugins/moku"]
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill, Bash]
tags: [web]
---

For my @moku-labs/web app, write a small "like" button island with its styles. It toggles between liked and not liked and shows a count.
