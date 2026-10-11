---
type: regex
weight: 2
# The server as `moku-editor mcp-config --port 3000` prints it: no HTML file for a shell game. The eval
# sandbox refuses a write of .mcp.json, so the content is read from the answer, not from the file.
pattern: 'moku-editor"\s*,\s*"mcp"\s*,\s*"--port"\s*,\s*"3000"'
---
