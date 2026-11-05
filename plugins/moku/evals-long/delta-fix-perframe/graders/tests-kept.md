---
weight: 1
type: regex
target: { source: file, path: src/plugins/timeline/__tests__/unit/rules.test.ts }
# The original expectations are still there
pattern: '(?=[\s\S]*toBe\(1100\))(?=[\s\S]*sinceStart\(3, 3\)\)\.toBe\(0\))(?=[\s\S]*cameraOf\(9\)\)\.toBe\("hold"\))'
---
