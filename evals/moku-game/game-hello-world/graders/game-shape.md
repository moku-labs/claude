---
type: llm
---

PASS if the response installs `@moku-labs/game` and `pixi.js` (at the versions the pack's `hello-world.md` names, or at least not an old remembered version) and `@moku-labs/editor` as a dev dependency, writes the game as a root `index.ts` with `defineGameApp` and a plain-data `config.ts` (no `web/` page, no `createApp` call), runs it through `moku-editor --root .` (or `moku-game dev`) and opens the tools page at `/__editor/`, and adds a sprite by putting the file under `features/<feature>/assets/` (or a layer `config.ts` names) and regenerating typed keys with `moku-game keys` (`bun run keys`), then using the generated key.
Pinning `@moku-labs/core` and `@moku-labs/common` beside the engine is right: they are peers since 0.78.0.
FAIL if the response imports Pixi statically into game logic, uses Vite or webpack as the dev server, hard-codes an asset path string instead of a generated key, or makes the editor a production dependency.
