---
name: moku-FRAMEWORK
description: >
  Moku FRAMEWORK patterns: what @moku-labs/FRAMEWORK is and how a Layer-3 app composes it.
  Triggers on: "moku FRAMEWORK", "@moku-labs/FRAMEWORK", plus two or three phrases a user
  would actually type for this domain. Keep the list precise so the skill does not fire on
  unrelated talk.
---

# Moku FRAMEWORK Patterns

> **Synced to `@moku-labs/FRAMEWORK@0.0.0`** (npm `dist-tags.latest`). Full surface — every plugin,
> its API/config/events, and the dependency graph — is in
> [`references/plugin-index.md`](references/plugin-index.md). Registered in the framework registry:
> load the `moku:moku-core` skill and read `references/moku-frameworks.md` (`frameworks[FRAMEWORK]`).

## Current Project State
!`test -f package.json && grep -E '"@moku-labs/FRAMEWORK"' package.json 2>/dev/null || true`

## What it is

One paragraph: the layer, the runtime it targets, what it depends on, and what it composes with.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | `@moku-labs/FRAMEWORK` |
| Kernel | `@moku-labs/core` |
| Shared infra | `@moku-labs/common` (`ctx.log`, `ctx.env`, branded CLI — MC1–MC3) |
| Package manager | Bun (pinned deps — `bunfig.toml` `exact = true`) |
| Engines | node ≥24, bun ≥1.3.14 |

## Idiomatic shape

Build to the app-shape rubric: load the `moku:moku-core` skill with the Skill tool and read
`references/moku-idioms.md` under the base directory it prints. State the framework's own hard rules
here — for example that a Layer-3 app calls `createApp` only, never `createCoreConfig`/`createCore`,
and never depends on `@moku-labs/core` directly (I1).

## Framework API (@moku-labs/FRAMEWORK v0.0.0)

```ts
import { createApp } from "@moku-labs/FRAMEWORK";

export const app = createApp({
  config: {},
  plugins: [],
  pluginConfigs: {},
});
```

Describe the default plugins, the helpers, and the context type a consumer plugin uses.

Full catalog (every plugin, API, config key, event, and the dependency graph):
**[`references/plugin-index.md`](references/plugin-index.md)**.
