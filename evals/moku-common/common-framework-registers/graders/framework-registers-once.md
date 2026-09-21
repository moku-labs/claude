---
type: llm
---

PASS if the response registers logPlugin and envPlugin from "@moku-labs/common" once, in the framework's createCoreConfig (with the third type argument [typeof logPlugin, typeof envPlugin] when Config and Events are given explicitly), seeds pluginConfigs.env.providers with workerSafeProcessEnv() because it is the provider that runs in a Cloudflare Worker as well as in Bun and Node (cloudflareBindings() may be added next to it), and says that a Layer-3 app registers nothing and inherits ctx.log and ctx.env from the framework. It may add that the env is resolved and frozen at onInit, or that an app override of pluginConfigs.env replaces the providers array.
FAIL if the response picks processEnv() or dotenv() for the Worker bundle, registers the plugins inside createApp or inside a consumer plugin, imports from "@moku-labs/common/browser" for the Worker, invents config fields or APIs that the package does not have (for example log.level, a createApp from @moku-labs/common, ctx.env.set), or gives explicit Config and Events type arguments without the third CorePlugins tuple.
