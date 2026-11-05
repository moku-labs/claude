---
type: llm
weight: 1
focus: trace
---

PASS if, before or alongside the fix, a test was added that pins behaviour the old code had and a careless allocation-free rewrite could break (for example `sinceStart` with `now` past the last step, or with `now` before `start`, or `cameraOf` for a middle move).
FAIL if no new test was added.
---
