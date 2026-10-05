---
type: llm
---

PASS if the response, in Russian, plans a `*.moku.yaml` build file with `sprite` items (transparent background) and one `sfx` item, keeps the key in `.env.local` as `FAL_KEY` for the user to paste themselves, runs `moku validate` and `moku estimate` and waits for a yes on the cost before any paid `moku run --max-cost`, exports into the game feature's `assets/` folder (for example `--flat --out src/features/<f>/assets`), and then regenerates typed keys with `moku-game-assets` / `assets:keys`.
FAIL if it asks for the key in chat, echoes a key, runs a paid generation before showing the estimate, uses an audio format the game does not accept (only mp3 or m4a), skips the asset key regeneration, or invents tasks or flags.
