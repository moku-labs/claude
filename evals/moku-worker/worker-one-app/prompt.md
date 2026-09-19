---
# A pack depends on the core plugin, so both are loaded for the run.
plugins: ["../../../plugins/moku-worker", "../../../plugins/moku"]
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill, Bash]
tags: [worker]
---

I have an @moku-labs/worker backend with a KV cache and a Durable Object. I now want to deploy it and generate the wrangler config. Should I add a second small createApp just for the deploy and CLI plugins, so the deploy config stays separate from my runtime app? Sketch how you'd wire it.
