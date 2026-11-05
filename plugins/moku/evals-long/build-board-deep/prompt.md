---
max_turns: 40
timeout_seconds: 3600
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit, Task, Agent]
tags: [build, long, real-task]
---

The plan of this moku project is approved; its spec is .planning/specs/01-board.md (tier Complex). Build the board plugin in src/plugins/board: hand the build to the moku-builder-deep agent, test-first, one module per file as the spec names them, tests with `bun test`. When the builder reports, check its result yourself and finish the build station.

Do not commit. End with a short report: what was built, what you ran, and what is not done.
