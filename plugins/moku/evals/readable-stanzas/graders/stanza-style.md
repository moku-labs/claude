---
type: llm
---

Judge the final reply only: a rewrite of `resolveRoute`. The structure (no outer if/else, intent comments, a named pattern step) is checked elsewhere; judge two things.
1. Behavior is unchanged. Check these: a trailing slash is stripped only when the path is longer than one character; a route matches when its method equals the request method or is "ALL"; routes are tried in order and the first match wins; each `:name` segment captures `[^/]+` in an anchored pattern; params are passed through `decodeURIComponent`; `undefined` is returned when nothing matches, including for an empty list. Moving steps into helpers, renaming variables or adding types and doc comments does not change behavior.
2. `resolveRoute`'s own body is no longer one dense block: it is split into blank-line separated groups or delegates the steps to named helpers.

PASS when both hold. FAIL when the rewrite visibly changes one of the listed behaviors, or `resolveRoute` is still one dense block.
