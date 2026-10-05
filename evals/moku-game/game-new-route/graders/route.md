---
type: llm
---

PASS if the response, in the user's language (Russian), treats the work as a new game and either asks one short question to confirm the folder for the game (the current one or a new folder named after the game), or, once the folder is settled, proposes to create the project: install the packages, scaffold a small hello world and show it running in the editor before the game idea is discussed. A single folder question with nothing else is a correct first reply. The eval sandbox has no `moku-rails` on PATH; a remark about that, or calling it by its full path, does not matter.
FAIL if the response writes game source files before the person said yes, asks app-vs-framework or UI/backend shape questions, asks a long questionnaire, tells the user to type another slash command, starts brainstorm or planning before the project exists, proposes a web app on `@moku-labs/web` instead of a game, or answers in English.
