---
type: llm
weight: 2
focus: trace
---

PASS if the trace shows the tests being run at least once against code that was broken on purpose (a mutated `rules.ts` or a mutated copy of it), and the original `rules.ts` is intact at the end.
FAIL if the tests were only ever run against the correct code.
