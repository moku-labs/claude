---
type: regex
# What the compiler proves is not a test: "is a function", "is defined", a constant against its own copy.
target: { source: file, path: src/plugins/cart/__tests__/unit/rules.test.ts }
pattern: 'toBeTypeOf\(\s*.function|typeof\s+\w+\)\.toBe\(\s*.function|toBeDefined\(\)|expect\(\s*SHIPPING\s*\)\.toBe\(\s*490|expect\(\s*FREE_SHIPPING_FROM\s*\)\.toBe\(\s*5_?000'
match: not_contains
---
