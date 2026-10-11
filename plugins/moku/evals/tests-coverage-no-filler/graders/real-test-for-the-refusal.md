---
type: regex
# Line 18 is real behaviour without a test: a negative quantity is refused.
target: { source: file, path: src/plugins/cart/__tests__/unit/rules.test.ts }
pattern: 'toThrow'
---
