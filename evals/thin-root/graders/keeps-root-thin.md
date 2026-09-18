---
type: llm
---

PASS if the response keeps the app entry file (src/main.ts) as thin composition and places the retry logic in a plugin or a separate module, or clearly pushes back on putting logic into the entry file and proposes a plugin or module instead.
FAIL if the response puts the retry implementation (loops, timers, backoff math) directly inside src/main.ts without objection.
