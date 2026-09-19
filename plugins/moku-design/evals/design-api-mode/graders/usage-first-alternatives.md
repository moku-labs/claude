---
type: llm
---

PASS if the response designs the API usage-first: it shows two or three alternative usage snippets (how consumer code reads when calling the plugin) before or above any type definitions, compares them in a table with named axes such as ergonomics, inference without explicit generics, testability and consistency with the Moku Core spec, and asks the user to pick.
FAIL if it goes straight to types or to an implementation, offers only one shape, skips the comparison table, or picks for the user without asking.
