---
type: regex
weight: 2
# The server as `moku-editor mcp-config` prints it: no HTML file for a shell game and no port, since each
# checkout finds its own editor on any port (editor 0.10.22). The args end right after "mcp", so a pinned
# `--port` fails. The eval sandbox refuses a write of .mcp.json, so the content is read from the answer,
# not from the file.
pattern: 'moku-editor"\s*,\s*"mcp"\s*\]'
---
