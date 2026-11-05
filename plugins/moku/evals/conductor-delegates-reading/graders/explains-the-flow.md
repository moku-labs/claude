---
type: llm
---

The app's real flow: the board plugin emits `board:cleared` (cells, chain) for every cascade step; the scoring plugin turns it into points (10 per cell times the chain, capped at x4) and emits `score:changed`; the hud shows the total and a combo flash; the leaderboard keeps the best five totals and asks storage to save them under the key `lb:v2`, and storage writes localStorage debounced by 500 ms; on first place the leaderboard emits `leaderboard:best` and the sound plugin plays a chime.

PASS if the response explains this chain correctly: board → scoring → score:changed → leaderboard → storage, says that the leaderboard table (top five) is what is saved, under `lb:v2` or with the debounce, and mentions the hud as a listener. Missing the sound plugin or the exact multiplier is fine.
FAIL if it gets the order of the plugins wrong, invents a plugin or event that is not in the flow, says the score itself or every change is written to storage immediately, or changes files instead of explaining.
