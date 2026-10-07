---
name: moku-ai
description: >
  Moku AI patterns: the asset build system (@moku-labs/ai). Declarative *.moku.yaml build files in,
  AI-generated images, transparent sprites, sound effects, video, music, voiceover, translations
  and prompt text out, through the `moku` CLI with a cost estimate, a budget gate and a resumable
  cache. Triggers on: "moku ai", "@moku-labs/ai", "generate assets", "game art", "sprites",
  "sound effects", "sfx", "music for the game", "voiceover", "moku.yaml", "moku.config.ts",
  "moku run / estimate", "add a provider", "api key for fal/openai/elevenlabs", "спрайты", "звуки",
  "музыка для игры", "озвучка", "ассеты для игры", "сгенерируй картинки", or producing a
  batch of AI assets for a Moku project.
---

# Moku AI Patterns

> **Synced to `@moku-labs/ai@0.14.2`** (npm `dist-tags.latest`; catalog from the `v0.14.2` tag source).
> Peers: `@moku-labs/core ^1.7.1`, `@moku-labs/common ^0.3.4`.
> Full surface — the 24 plugins, every API, config key and event — is in
> [`references/plugin-index.md`](references/plugin-index.md). Provider keys:
> [`references/setup.md`](references/setup.md). Providers, models and custom plugins:
> [`references/providers.md`](references/providers.md). Pipeline into a `@moku-labs/game` project:
> [`references/game-assets.md`](references/game-assets.md).

## Current Project State
!`test -f package.json && grep -E '"@moku-labs/(ai|game)"' package.json 2>/dev/null || true`
!`ls *.moku.yaml assets/**/*.moku.yaml features/*/assets.moku.yaml src/features/*/assets.moku.yaml moku.config.* 2>/dev/null || true`
!`test -f .env.local && echo ".env.local present" || echo "no .env.local"`

## What it is

`@moku-labs/ai` is a **build system for AI-generated assets**, a Layer-2 Moku framework on
`@moku-labs/core`. You write a `*.moku.yaml` build file that says what should exist. The `moku` CLI
estimates the cost, runs every item through a provider, journals each step in SQLite under `.moku/`
and exports named files. A crash or Ctrl-C is safe: `moku run` again resumes. A done item is cached
by content key, so a second run bills nothing that already exists.

Tasks: `image`, `sprite` (cut an image into a trimmed, transparent PNG), `sfx` (short sound
effect, mp3), `video`, `music`, `voiceover`, `translate`, `prompt-gen`, `asset` (a registered
portrait for Ark video). Providers: `elevenlabs`, `openai`, `fal`, `apimodels`, `ark` (API keys),
`codex`, `claude` (local CLIs, billed to the user's plan, cost $0).

It is not a chat SDK. There is no MCP server, no account pools yet, and no task for sprite sheets,
bitmap fonts or 3D. See the gaps in `references/game-assets.md`.

## When to use it, and when to use Astra

| Need | Use |
|---|---|
| A few images while designing a screen, a second UX opinion | `moku-design:moku-astra` (Codex CLI, user's plan) |
| A batch of production art, 10 to 500 files, with cost control and resume | **moku-ai** |
| Video clips, music, sound effects, voiceover, translations | **moku-ai** (Astra does not do these) |
| Transparent, trimmed, resized sprites with nine-slice names | **moku-ai** `sprite` task |
| Re-render one changed asset without paying for the rest | **moku-ai** (cached by content key) |
| Art with no API key at all | Both: moku-ai `provider: codex` is the same engine Astra uses |

Rule of thumb: Astra for design time, moku-ai for production and for anything that is not an image.

## Install

```bash
bun add -d @moku-labs/ai
bunx moku new assets        # writes assets.moku.yaml + .moku/build.schema.json
```

Node 24 or newer, Bun 1.3.14 or newer. The journal uses `bun:sqlite` on Bun, `better-sqlite3` on
Node. `sharp` comes with the package (the `sprite` pixel step). Since 0.14.2 `@moku-labs/core`
(`^1.7.1`) and `@moku-labs/common` (`^0.3.4`) are peer dependencies; Bun and npm install them
with the package, so one project shares a single core. Add `.moku/` and `.env.local` to
`.gitignore` (see `references/setup.md`).

## Build file anatomy

```yaml
# yaml-language-server: $schema=.moku/build.schema.json
version: 1                      # literal 1
name: ui                        # export folder: out/<name>/
defaults:
  provider: fal                 # used when an item names none
  maxAttempts: 3
items:
  - id: ui/button-green         # label; "/" makes a folder in the export
    task: image
    input:
      prompt: "Green wooden button, storybook cartoon, front view"
      aspect: "1:1"
      refs: [{ $file: refs/style.png }]   # local file, relative to this file
    params: { background: transparent }   # provider knobs, part of the cache key
  - id: ui/button-hover
    task: image
    provider: codex             # per-item override
    input: { prompt: "Same button, lighter", refs: [{ $ref: ui/button-green }] }
  - id: "ui/button{nine=12,12,12,12}"    # nine-slice hint stays in the file name
    task: sprite                # trim + resize; model none = source already transparent, $0
    input: { source: { $ref: ui/button-green }, model: none, size: { width: 128, height: 64 } }
  - id: ui/click
    task: sfx
    provider: elevenlabs
    input: { model: eleven_text_to_sound_v2, prompt: "short wooden click", durationMs: 600 }
  - id: ui/theme
    task: music
    input: { model: elevenlabs-music-v2.5, prompt: "cozy village loop", lengthMs: 40000 }
itemsFrom: more-items.ndjson    # optional: one item per line, appended
```

Rules the schema enforces: `version`, `name`, `items` are required; `input` is an object;
`params` sits next to `input`, never inside it. `$ref: <id>` points at another item in the same
file and runs first. `$file: <path>` is relative to the build file. `music`, `sfx` and `sprite`
need `model`. Braces in an id are allowed only as one trailing `{nine=l,t,r,b}` hint with whole
numbers; anything else is exit `2`. A `.` in an id is allowed here but breaks the game asset
scanner: use `-` and `/`. `moku validate` does not open `$file` paths; `moku estimate` does.

Each task's `input` fields are in `references/providers.md`. Unknown fields are not rejected by
the schema; the provider decides at run time.

## CLI workflow, always in this order

```bash
moku validate                        # offline, no key
moku estimate                        # per task/provider cost + total, no key
# show the total to the user, wait for a yes
moku run --max-cost <total * 1.2>    # stops at the ceiling, exit 5
moku export --out shared/assets --flat   # copy done artifacts again, any time
```

1. **Estimate first.** `moku estimate` uses the same math as the budget gate. Print the box to the
   user and state the total in dollars.
2. **Wait for a yes.** Never run a paid build without the user agreeing to the number. Codex and
   Claude items estimate $0; say that they spend the user's plan limits instead.
3. **Run with `--max-cost`.** Set it a little above the estimate. The gate checks
   `done + dispatching + this item` before each dispatch. Exit `5` means the ceiling was reached.
4. **Export.** `moku run` already exports to `out/<build name>/`. `--out <dir>` changes the root;
   `--flat` drops the `<build name>/` folder so files land straight in `<dir>`. Same flags on
   `moku export` later.

Exit codes: `0` ok, `1` failure, `2` invalid build file, `3` usage or a project config that does
not load, `4` paused by Ctrl-C, `5` budget stop. `moku status --follow` watches a run from another terminal. `moku compose "<text>"`
writes a build file from a sentence, through the `prompt-gen` provider (costs a little, needs a key).

A fal model without a price fails the estimate instead of counting as $0. An OpenAI model missing
from the price table estimates as $0: add `priceOverrides` for custom models.

## Caching and resume

- Artifact key = `sha256(task, provider, input, params, keys of every $ref, sha256 of every $file)`.
  Same key in any later run: reused at $0, no provider call.
- Change one prompt: only that item and the items that `$ref` it are rendered again.
- `.moku/journal.db` holds statuses, costs and hashes. `.moku/store/` holds the bytes. Delete both
  to start clean; keep them to keep the cache. Do not commit them.
- Ctrl-C once drains to a clean pause (exit `4`). `moku run` again resumes the same run. A video
  job id is journaled before the wait, so a resumed run polls the same job instead of paying twice.
- Failures: 5xx, 429, timeout and network errors retry with backoff (`runner.maxAttempts`, default 3).
  Other 4xx is a terminal `failed`. A content-policy refusal is `flagged` and never retried.

## Output layout

```
out/<build name>/<label>.<ext>           label = item id, else <NN>-<task>
out/ui/ui/button-green.png               id "ui/button-green" in build "ui"
out/ui/ui/theme.mp3
<out>/<label>.<ext>                      with --flat: no <build name>/ folder
```

Every `done` item is exported, also an image that only feeds a `sprite`. With `--flat` the same
label in two builds keeps the first file; the second is skipped and listed.

The extension comes from the stored MIME type: `png jpg webp gif mp4 mov webm mp3 wav ogg m4a txt
json`, else `bin`. A multi-output image item (`params.images: N` on ark) writes `<label>.png`,
`<label>-2.png`, and so on. Labels that would escape `--out` (`..`, absolute) are skipped and listed.

Watch the image format: fal `gpt-image-2.5` returns **jpeg** unless `params.output_format: png`
or `params.background: transparent` (which sends png); `nano-banana-pro` is always png; codex
writes `output.png`. `sprite` is always an RGBA png, `sfx` always mp3. Voiceover defaults to mp3.

## Programmatic use

```ts
import { createApp } from "@moku-labs/ai";

const app = createApp({ pluginConfigs: { fal: { upload: "data-uri" } } });
await app.start();
const { totalUsd } = await app.runner.estimate({ files: "assets/*.moku.yaml" });
const result = await app.runner.run({ files: "assets/*.moku.yaml", maxCostUsd: totalUsd * 1.2 });
await app.runner.export({ runId: result.runId, outDir: "shared/assets" });
await app.stop();
```

The `moku` bin loads `moku.config.ts` (or `.mts`, `.js`, `.mjs`) from the working directory and
passes its default export to `createApp`. `--config <path>` on any command picks another file.
Custom providers and `pluginConfigs` go there, typed by `defineConfig`: `references/providers.md`.

## Hard rules for the agent

- Never type an API key. The user pastes it into `.env.local` (`references/setup.md`).
- Never echo `.env.local` or a key into the chat or a log.
- Never run a paid `moku run` before `moku estimate` and the user's yes.
- Never commit `.moku/`, `.env.local` or `out/`. Commit the exported, converted assets and the
  provenance note (`references/game-assets.md`).
- Do not invent provider fields. When a field is not in `references/providers.md`, read the
  provider README at `github.com/moku-labs/ai/blob/main/src/plugins/<provider>/README.md` (the npm
  package ships only `dist/` and the root README) or say that it is unverified.
