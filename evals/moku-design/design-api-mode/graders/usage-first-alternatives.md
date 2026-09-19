---
type: llm
---

PASS if the response describes a usage-first API design: two or three alternative usage snippets (how consumer code reads) come before type definitions, the alternatives are compared in a table with named axes, and the user picks.
FAIL if it plans to go straight to types or to an implementation, plans only one shape, has no comparison, or makes the choice instead of the user. Stating a recommendation is fine as long as the user picks.
