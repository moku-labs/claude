---
type: llm
---

PASS if the response rejects the second createApp and composes everything into ONE @moku-labs/worker createApp: the resource plugins (kv, durableObjects) plus the runtime/server plugin plus deployPlugin and cliPlugin in the same app, with a thin cloudflare/worker.ts entry delegating fetch to that app's server handler. The answer may cite idiom I6 or call the second app a facade.
FAIL if the response agrees to the second createApp, proposes a config-only or facade worker app beside the runtime app, invents a deploy-config generator the framework does not ship, or splits deploy/cli into their own app "so the config stays separate".
