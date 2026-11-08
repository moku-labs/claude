---
type: llm
---

Judge the final reply only. PASS when all five hold:
1. It engages with the habit-tracker idea in plain language.
2. It makes clear that no moku project exists yet. Saying that a moku session was started (the rails are on) while nothing is created or scaffolded counts as this. Claiming the project is already set up, created or initialized does not.
3. It asks at most five questions, and they decide the project's shape (platform, data, accounts, scope and the like).
4. It states that creating (initializing) the moku project is the next step, before any planning, design or building. Proposing to create it and waiting for the user's yes counts ("once you answer, I'll propose creating the project").
5. The user never has to type a slash command to move the work forward. Naming the init skill in passing is fine. A side note about permissions (prompts to expect, an optional line the user may type to allow planning writes) is not part of the workflow and does not count against this.

FAIL when the reply writes implementation code, claims the project already exists, hands the user a list of slash commands to drive the work, plans or builds before the project is created, or asks a long questionnaire with no stated next step.
