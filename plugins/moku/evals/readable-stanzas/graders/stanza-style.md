---
type: llm
---

PASS if the outer if/else wrapper is gone (replaced by a guard clause with an early return, or dropped entirely when the loop already returns undefined for an empty list), the function body is split into blank-line separated groups that each carry a short intent comment, and the pattern-building step is extracted or named. Guard-style `continue` or early `return` inside the loop counts as guard clauses. Behavior must look unchanged.
FAIL if the body is still one dense block, still uses the outer if/else, or has no intent comments.
