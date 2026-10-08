---
type: regex
# The answer is grounded in the design skill, whether the skill was invoked or its file was read: the prompt
# asks how the station would run and says not to start it. A run without the pack knows neither name.
pattern: 'design-context\.md|moku-design:design|design-mode-api'
flags: i
---
