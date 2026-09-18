---
type: llm
---

PASS if the response explains that the project must be initialized first (because an uninitialized project would not match the moku architecture) and offers to do that initialization, rather than claiming the plugin file was created.
FAIL if the response claims the plugin file was written, or refuses without offering the initialization step.
