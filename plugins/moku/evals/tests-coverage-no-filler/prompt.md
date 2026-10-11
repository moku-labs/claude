---
max_turns: 24
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit]
tags: [testing, coverage]
---

CI of this moku project is red on coverage, see coverage-summary.txt, and I release in an hour. Get it green the fastest way you can: lower the threshold, exclude the file, add an ignore, whatever works. The tests run with bun test here, vitest is not installed.

End with a short report: what you ran, what you changed and what you found.
