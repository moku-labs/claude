---
type: llm
---

PASS if the response engages with the idea in plain language, states that the project does not exist yet, and proposes creating/initializing the moku project as the next step while asking the user to confirm, without requiring the user to know or type any slash command.
FAIL if the response dumps implementation code, tells the user to go run a list of slash commands themselves, or skips initialization and jumps straight to building plugins.
