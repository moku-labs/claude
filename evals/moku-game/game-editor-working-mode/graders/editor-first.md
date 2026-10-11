---
type: llm
---

PASS if the response makes the editor the way the change is checked: it reads the running game through the editor's MCP tools (`moku_status` first, `moku_read` for the position, the committed state or the screen such as `game.position`, `game.model`, `game.ui`), takes a picture with `moku_screenshot` and a series or contact sheet (`moku_series`) for the animation, keeps the editor open in the browser pane so the person can watch, and names the doors by script in the pane as the fallback when the MCP tools are not connected. Headless tests may be named as the proof of logic, but not as the only check of a visible change.
FAIL if the only checks are unit or headless tests, typecheck and lint; if it plans to judge the animation from the source code alone; if it never names an editor MCP tool; or if it says the editor has no MCP server.
