---
max_turns: 40
timeout_seconds: 3600
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit, Task, Agent]
tags: [build, long, real-task]
---

The plan of this moku project is approved; its spec is .planning/specs/01-board.md (tier Complex). Build the board plugin in src/plugins/board in three stages, each a working, tested increment: stage 1 `rng.ts`, `grid.ts`, `merge.ts`; stage 2 `generators.ts`, `energy.ts`; stage 3 `orders.ts`, `save.ts`, `undo.ts`. Hand each stage to its own moku-builder-deep agent, one after another, test-first, one module per file as the spec names them, tests with `bun test`. Start a stage only after the previous one is green. When the builder reports, check its result yourself and finish the build station.

Do not commit. End with a short report: what was built, what you ran, and what is not done.
