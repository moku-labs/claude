---
# A pack depends on the core plugin, so both are loaded for the run.
plugins: ["../../../plugins/moku-system", "../../../plugins/moku"]
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill, Bash]
tags: [system]
---

I'm building a Moku app that runs in the browser and in a Tauri shell. How do I save user settings persistently and show a notification when an export finishes, with one code path for both?
