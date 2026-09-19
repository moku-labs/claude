---
type: llm
---

PASS if the response treats @moku-labs/room as a standalone framework on @moku-labs/core — a sibling of @moku-labs/web and @moku-labs/worker — so the screen app calls createApp imported from "@moku-labs/room" and adds stagePlugin (with controllerPlugin for the phones). It may note that @moku-labs/core and @moku-labs/common come bundled, and that @moku-labs/worker is an optional peer needed only for the opt-in ./server signaling tier.
FAIL if the response builds room on top of @moku-labs/web or @moku-labs/worker, treats it as a plugin pack whose plugins are spread into a web app, imports createApp from @moku-labs/web or @moku-labs/core, or tells the user to install @moku-labs/web as a requirement.
