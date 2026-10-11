---
type: regex
# The server is registered the way `moku-editor mcp-config --port 3000` prints it: no HTML file for a shell game.
target: { source: file, path: .mcp.json }
pattern: '"moku-editor"[\s\S]*"command"\s*:\s*"bunx"[\s\S]*"mcp"'
---
