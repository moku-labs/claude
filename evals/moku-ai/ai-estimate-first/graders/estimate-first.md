---
type: llm
---

PASS if the response puts the key in `.env.local` as `FAL_KEY` (kept out of git) for the person to paste themselves, writes a `*.moku.yaml` build file with `sprite` items (transparent background) and `sfx` items, runs `moku validate` and `moku estimate` first, shows the cost and waits for a yes before `moku run` with `--max-cost`, and exports straight into the game's feature assets folder (for example with `--flat`).
FAIL if the response asks the person to paste the key into the chat, types or echoes the key, runs a paid `moku run` before showing an estimate, or invents a provider, task or flag that @moku-labs/ai does not have.
