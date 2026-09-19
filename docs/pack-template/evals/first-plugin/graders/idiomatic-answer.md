---
type: llm
---

PASS if the response composes the framework the idiomatic way: `createApp` from
`@moku-labs/FRAMEWORK`, plugin types inferred from the spec object, and the framework's own hard rule
(state it here) respected.
FAIL if the response calls `createCoreConfig`/`createCore` in a Layer-3 app, imports
`@moku-labs/core` directly, or passes explicit generics to `createPlugin`.
