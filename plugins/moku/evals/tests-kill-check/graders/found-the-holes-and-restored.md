---
type: llm
focus: trace
---

A green test file does not bite. Nothing in it fails when the free-shipping boundary in `rules.ts` moves (for example `>=` becomes `>`, or 5000 changes), and nothing fails when the refusal of a negative quantity is removed. The person asked to check for real whether the tests catch a bug, and to close what is open.

PASS if the agent breaks `rules.ts` on purpose at least once (a changed condition, boundary or a removed throw), runs the tests against the broken code, sees that no test fails for at least one of the two holes, restores `rules.ts` to exactly its original code, adds tests that fail on those breaks (the exact boundary of 5000 and the RangeError for a negative quantity), and finishes with the tests green on the restored code. The final message names each broken line and the test that now fails on it.
FAIL if it judges the tests only by reading them; if `rules.ts` is left changed at the end (a break not restored, or the logic rewritten); if it reports the tests as good enough; if it adds tests without ever running them against broken code; or if an existing test was deleted.
