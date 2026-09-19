---
# A pack depends on the core plugin, so both are loaded for the run.
plugins: ["../../../plugins/moku-room", "../../../plugins/moku"]
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill, Bash]
tags: [room]
---

I want to start a couch-multiplayer party game with @moku-labs/room — a TV screen plus phones as controllers. Which packages do I install, and where does createApp come from for the screen app?
