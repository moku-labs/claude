---
type: regex
weight: 1
# The code under test ends as it began: the boundary and the refusal are in place.
target: { source: file, path: src/plugins/cart/rules.ts }
pattern: '(?=[\s\S]*line\.quantity < 0\) throw new RangeError)(?=[\s\S]*sum >= FREE_SHIPPING_FROM \? sum : sum \+ SHIPPING)'
---
