---
# /moku:session expands the skill without a Skill tool call, so the grader looks for the session itself.
type: tool_used
tool: Bash
input_match: 'moku-rails\S*\s+(?:status|session)'
---
