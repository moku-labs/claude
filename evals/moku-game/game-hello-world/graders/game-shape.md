---
type: llm
---

PASS if the response installs `@moku-labs/game` and `pixi.js` (at `@latest` or without a pinned old version) and `@moku-labs/editor` as a dev dependency, runs the game through the `moku-editor` bin and opens the tools page at `/__editor/`, and adds a sprite by putting the file under `features/<feature>/assets/` and regenerating typed keys with `moku-game-assets` (`assets:keys`), then using the generated key.
FAIL if the response adds `@moku-labs/core` as a direct dependency, imports Pixi statically into game logic, uses Vite or webpack as the dev server, hard-codes an asset path string instead of a generated key, or makes the editor a production dependency.
