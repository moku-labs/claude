---
type: regex
# The answer is grounded in the e2e skill, whether the skill was invoked or its file was read: the prompt
# asks to be walked through a step. A run without the pack does not know the reviewer agent's name.
pattern: 'moku-web-ux-reviewer|\.planning/e2e/shots'
flags: i
---
