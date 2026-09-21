---
# A pack depends on the core plugin, so both are loaded for the run.
plugins: ["../../../plugins/moku-native", "../../../plugins/moku"]
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill, Bash]
tags: [native]
---

I have a Moku web app (@moku-labs/web) that uses the store and deep-link system plugins. How do I package it as a macOS app and an iOS simulator build with @moku-labs/native?
