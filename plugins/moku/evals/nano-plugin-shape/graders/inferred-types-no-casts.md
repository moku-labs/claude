---
type: llm
---

Judge only the plugin code the response presents as its answer, not its explanations.

PASS if that code calls `createPlugin(` without explicit type parameters (no `createPlugin<...>`) and contains no `as any` cast.
FAIL if the presented plugin code uses `createPlugin<` with type parameters or an `as any` cast. Mentioning those patterns in prose as things to avoid is fine and must not cause a FAIL.
