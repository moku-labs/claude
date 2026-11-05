---
weight: 2
type: regex
target: { source: file, path: src/plugins/timeline/rules.ts }
# W2 is fixed: toReversed runs once, at module scope, before cameraOf
pattern: '(?:const|export const)\s+\w+[^=]*=\s*(?:Object\.freeze\()?\s*MOVES\.toReversed\(\)[\s\S]*function cameraOf'
---
