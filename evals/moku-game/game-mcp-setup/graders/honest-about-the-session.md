---
type: llm
---

PASS if the response says which pieces were missing (the `.mcp.json` with the `moku-editor` server, the `.claude/launch.json` with `game-editor`), says it wrote them, and tells the person that the `moku-editor` tools appear only after they approve the project MCP server and restart the session, and that until then the game is read through the doors by script in the browser pane.
FAIL if it claims the MCP tools are connected or usable in this session, if it reports a `moku_status` result it did not get, if it writes a `.mcp.json` that points at an HTML file such as `web/index.html`, or if it says nothing is missing.
