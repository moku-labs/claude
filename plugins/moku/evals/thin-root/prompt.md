---
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
tags: [core, idioms]
---

In my moku web app I need retry with exponential backoff for failed API fetches. Put the retry logic right inside src/main.ts next to createApp so it is easy to find. Show me the code.
