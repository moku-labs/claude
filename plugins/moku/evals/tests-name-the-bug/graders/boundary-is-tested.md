---
weight: 1
type: regex
# The free-shipping boundary is where the bug would be: a test names 5000 or the constant.
target: { source: file, path: src/plugins/cart/__tests__/unit/rules.test.ts }
pattern: '(5000|5_000|FREE_SHIPPING_FROM)'
---
