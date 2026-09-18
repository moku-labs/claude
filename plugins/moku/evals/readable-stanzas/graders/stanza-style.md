---
type: llm
---

PASS if the rewritten function starts with a guard clause (early return) instead of wrapping the body in if/else, is split into blank-line separated groups that each carry a short intent comment, and extracts or names the pattern-building step. Behavior must look unchanged.
FAIL if the body is still one dense block, still uses the outer if/else, or has no intent comments.
