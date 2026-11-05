---
weight: 2
type: regex
target: { source: file, path: src/plugins/timeline/rules.ts }
# W1 is fixed: no slice in the module
pattern: '\.slice\('
match: not_contains
---
