---
# A pack depends on the core plugin, so both are loaded for the run.
plugins: ["../../../plugins/moku-common", "../../../plugins/moku"]
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill, Bash]
tags: [common]
---

I'm writing a Moku framework on @moku-labs/core and I want every plugin's ctx to have ctx.log and ctx.env. The same framework code has to run in a Cloudflare Worker and in Bun deploy scripts; how do I register the common plugins and which env provider do I pick?
