---
max_turns: 40
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit, Agent]
tags: [build, delta, real-task]
---

Delta fix on the open change of this moku project. The verify station's architecture validator reported two warnings in src/plugins/timeline; fix both as behaviour-preserving changes (same numbers for every input), test-first where a test can catch the bug. Per-frame garbage counts here: these functions run about 60 times a frame.

W1 — `sinceStart` in src/plugins/timeline/rules.ts does `STEPS.slice(start, now)` on every call. Make it allocation-free.
W2 — `cameraOf` in the same file calls `MOVES.toReversed()` on every call. Hoist it to a module constant.

Do not commit and do not delete or weaken any test. End with a short report: what you changed and what you ran.
