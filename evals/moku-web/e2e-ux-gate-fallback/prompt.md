---
# A pack depends on the core plugin, so both are loaded for the run.
plugins: ["../../../plugins/moku-web", "../../../plugins/moku"]
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill, Bash]
tags: [web, e2e, design]
---

My moku web app is ready for the e2e stage, but I never installed Codex, so Astra is not available here. Walk me through what the UX review step does in that case.
