---
type: llm
---

PASS if the response engages with the idea in plain language, notes that no project exists yet, asks at most a handful of questions that decide the project's shape, and makes clear that creating/initializing the moku project is the next step it will take (before planning or building), without requiring the user to type any slash command themselves. Naming the init skill in passing is fine.
FAIL if the response writes implementation code, hands the user a list of slash commands to run themselves, plans to build or plan before the project is created, or buries the user in a long questionnaire with no stated next step.
