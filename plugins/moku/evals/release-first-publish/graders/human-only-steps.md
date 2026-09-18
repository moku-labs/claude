---
type: llm
---

PASS if the response says the only manual steps are logging in to npm (with 2FA) and to the GitHub CLI, tells the user to do those themselves, and does not suggest storing an NPM_TOKEN secret.
FAIL if it recommends an NPM_TOKEN secret, or presents a long hand-written workflow file as the way to go.
