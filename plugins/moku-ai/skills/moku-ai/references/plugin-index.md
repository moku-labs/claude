# @moku-labs/ai — Plugin & Property Index

**Synced version:** `0.14.0` (npm `dist-tags.latest`; catalog from the main branch source:
`src/index.ts`, `src/config.ts`, `src/bin.ts`, `src/plugins/*`, `README.md`, `llms.txt`,
`llms-full.txt`). Built on `@moku-labs/core@1.6.0` + `@moku-labs/common@0.3.2`. Runtime deps:
`better-sqlite3` (Node; Bun uses `bun:sqlite`), `openai`, `sharp` (0.35.5, the sprite pixel step),
`yaml`, `zod`. Engines node ≥24, bun ≥1.3.14. Bin: `moku` (`dist/bin.mjs`), which loads
`moku.config.{ts,mts,js,mjs}`.

## A Layer-2 framework

`src/config.ts` is `createCoreConfig("ai", …)` with five core plugins: `logPlugin`, `envPlugin`
(from `@moku-labs/common`), `journalPlugin`, `storePlugin`, `limitsPlugin`. `src/index.ts` is
`createCore(coreConfig, { plugins, pluginConfigs })` with 21 regular plugins and exports `createApp`,
`createPlugin` and `defineConfig`. Layer-3 apps import only from `@moku-labs/ai`.

Global `Config` and `Events` are empty by decision: every option is per plugin, and only the runner
declares bus events.

## Exports (`@moku-labs/ai`)

| Group | Names |
|---|---|
| Framework API | `createApp`, `createPlugin`, `defineConfig` (+ type `ProjectConfig`) |
| Plugins | `registryPlugin`, `buildfilePlugin`, `runnerPlugin`, `voiceoverPlugin`, `translatePlugin`, `promptGenPlugin`, `imagePlugin`, `videoPlugin`, `musicPlugin`, `sfxPlugin`, `spritePlugin`, `assetPlugin`, `elevenlabsPlugin`, `openaiPlugin`, `codexPlugin`, `claudePlugin`, `falPlugin`, `apimodelsPlugin`, `arkPlugin`, `composePlugin`, `cliPlugin`, `journalPlugin`, `storePlugin`, `limitsPlugin` |
| Helpers | `defineBuild`, `ASSET_MIME`, `encodeAssetRecord`, `parseAssetRecord`, `PromptGenUnavailableError`, `isPromptGenUnavailable`, `ToolArgumentsError`, `runToolLoop` |
| Type namespaces | `Journal`, `Store`, `Limits`, `Buildfile`, `Runner`, `Voiceover`, `Translate`, `PromptGen`, `Image`, `Video`, `Music`, `Sfx`, `Sprite`, `Asset`, `Elevenlabs`, `Openai`, `Codex`, `Claude`, `Fal`, `Apimodels`, `Ark`, `Compose`, `Cli` |
| Error classes (values) | `ApimodelsErrors`, `ArkErrors`, `ClaudeErrors`, `CodexErrors`, `ElevenlabsErrors`, `FalErrors`, `OpenaiErrors` — each with `RetryableProviderError`, `TerminalProviderError`, `FlaggedProviderError` |

## Plugins

Registration order in `src/index.ts`: `registry → buildfile → runner → voiceover → translate →
promptGen → image → video → music → sfx → sprite → asset → elevenlabs → openai → codex → claude → fal → apimodels →
ark → compose → cli`. Provider plugins register handlers in `onInit`; the first registered provider
of a task is its implicit default, but each task plugin's `defaultProvider` config decides for the
facade and the runner.

### Core (injected as `ctx.*`, also mounted on the app)

| Plugin | Tier | API (`ctx.journal` / `ctx.store` / `ctx.limits`) | Config (default) |
|---|---|---|---|
| `journal` | Complex | `openRun`, `getRun`, `latestRun`, `latestResumableRun`, `insertItems`, `requeueDispatching`, `gateToDispatching`, `recordAttempt`, `finishAttempt`, `setAttemptJob`, `findLiveJob`, `commitDone`, `findDoneArtifact`, `reuseDone`, `getItem`, `markFailed`, `markFlagged`, `setRunStatus`, `totals`, `listItems`, `readSnapshot`, `isOpen`, `findProviderRecord`, `putProviderRecords` | `path` (`.moku/journal.db`), `checkpointIntervalMs` (30000), `busyTimeoutMs` (5000) |
| `store` | Standard | `put`, `has`, `pathOf`, `read`, `hashOf`, `gc` | `dir` (`.moku/store`), `algo` (`sha256`) |
| `limits` | Standard | `acquire(lane)`, `reportOutcome`, `laneConfig`, `snapshot`, `lanes` | `defaults` (`rpm 60, concurrency 4, breakerThreshold 5, breakerCooldownMs 30000`), `lanes` (`video/apimodels: {2, 20 rpm}`, `video/ark: {3, 180 rpm}`) |
| `env` (common) | | `ctx.env.get`, `ctx.env.require` | `providers` (`[processEnv(), dotenv(".env.local")]`) |

Lane name: `"{task}/{provider}/default"`. Precedence: exact lane → `"{task}/{provider}"` → defaults.

### Regular (mounted as `app.<name>`)

| Plugin | Tier | Depends | API | Config (default) |
|---|---|---|---|---|
| `registry` | Nano | — | `register(task, provider, handler)`, `resolve(task, provider)`, `providers(task)`, `tasks()` | none |
| `buildfile` | Standard | — | `compile(source)`, `loadGlob(pattern?)`, `jsonSchema()`, `template({ name })` | `defaultGlob` (`**/*.moku.yaml`), `schemaPath` (`.moku/build.schema.json`) |
| `runner` | Complex | registry, buildfile | `run(options, { signal?, onStart? })`, `resume({ runId?, signal?, onStart? })`, `estimate({ files? })`, `status(runId?)`, `events({ runId? })`, `export({ runId?, outDir?, flat? })` | `maxAttempts` (3), `retryBaseMs` (1000), `eventBufferSize` (10000), `pollIntervalMs` (5000), `jobTimeoutMs` (1800000), `maxActiveRuns` (1) |
| `voiceover` | Standard | registry | `generate(request, { provider?, signal? })`, `estimate(request, { provider? })`, `providers()` | `defaultProvider` (`elevenlabs`), `defaultFormat` (`mp3`) |
| `translate` | Standard | registry | same three | `defaultProvider` (`openai`) |
| `promptGen` | Standard | registry | same three; fallback chain on unavailable providers | `defaultProvider` (`openai`), `fallback` (`[]`) |
| `image` | Standard | registry | same three | `defaultProvider` (`codex`) |
| `video` | Standard | registry | same three; `execute` or `submit` + `poll` | `defaultProvider` (`fal`), `pollIntervalMs` (5000) |
| `music` | Standard | registry | same three | `defaultProvider` (`fal`), `pollIntervalMs` (5000) |
| `sfx` | Standard | registry | same three; `execute` only, always mp3 | `defaultProvider` (`elevenlabs`) |
| `sprite` | Standard | registry | same three; `execute` only, always RGBA png | `defaultProvider` (`fal`) |
| `asset` | Standard | registry | `register(request, opts)`, `estimate`, `providers()` | `defaultProvider` (`ark`), `pollIntervalMs` (3000) |
| `elevenlabs` | Complex | registry | `info()`; registers `("voiceover","elevenlabs")`, `("sfx","elevenlabs")` | `apiKeyEnv` (`ELEVENLABS_API_KEY`), `baseUrl`, `defaultModel` (`eleven_multilingual_v2`), `timeoutMs` (60000), `priceOverrides` (voice model ids; `sfx:<model>#second`, `sfx:<model>#auto`) |
| `openai` | Complex | registry | `info()`; registers voiceover, translate, prompt-gen | `apiKeyEnv` (`OPENAI_API_KEY`), `baseUrl`, `models` (`{ tts: gpt-4o-mini-tts, chat: gpt-4o-mini }`), `timeoutMs`, `priceOverrides` |
| `codex` | Complex | registry | `info()`; registers image, prompt-gen over `codex exec` | `bin` (`codex`), `model` (`gpt-6-astra`), `reasoningEffort` (`low`), `timeoutMs` (600000), `workDir` (`.moku/tmp`), `priceOverrides`, `textModel`, `modelMap` |
| `claude` | Complex | registry | `info()`; registers prompt-gen over `claude -p` | `bin` (`claude`), `textModel`, `modelMap`, `timeoutMs` (600000), `workDir` |
| `fal` | Complex | registry | `info()`, `models(task)`; registers video, image, prompt-gen, music, sfx, sprite | `apiKeyEnv` (`FAL_KEY`), `queueUrl`, `uploadUrl`, `upload` (`storage`), `timeoutMs`, `priceOverrides` (video `<alias>`; `image:`, `music:`, `sfx:`, `sprite:<alias>`; `llm:<id>#in`/`#out`), `runUrl`, `imageDefaultModel` (`gpt-image-2.5`), `llmDefaultModel` (`anthropic/claude-opus-5.5`), `pollIntervalMs` (2000), `jobTimeoutMs` (900000), `requestLog` |
| `apimodels` | Complex | registry | `info()`; registers video | `apiKeyEnv` (`APIMODELS_API_KEY`), `baseUrl`, `assetGroup` (`moku-ai`), `timeoutMs`, `priceOverrides` |
| `ark` | Complex | registry | `info()`; registers video, image, asset | `region` (`intl`), `apiKeyEnv`, `accessKeyEnv`, `secretKeyEnv`, `baseUrl`, `controlUrl`, `groupId`, `groupName` (`moku-ai`), `timeoutMs`, `downloadTimeoutMs` (300000), `priceOverrides`, `cnyPerUsd` (7.1) |
| `compose` | Standard | buildfile, promptGen | `compose({ prompt, emit, name?, signal? })` → `{ spec, text, costUsd }` | `provider` (`openai`), `maxRepairAttempts` (2) |
| `cli` | Complex | runner, buildfile, compose | `dispatch(argv)` → exit code, `commands()`; `Cli.EXIT_CODES` | `plain` (false; auto when not a TTY or `NO_COLOR`) |

## Runner types

```ts
type RunOptions = { files?: string; maxCostUsd?: number; dryRun?: boolean };
type RunResultStatus = "done" | "failed" | "paused" | "budget-stopped";
type RunResult = { runId: string; status: RunResultStatus; totals: RunTotals };
type EstimateResult = { lines: { task; provider; items; usd }[]; totalUsd: number };
type ExportResult = { runId: string; outDir: string; files: ExportedFile[]; skipped: string[] };
```

Pipeline per item: plan (compile, resolve provider, planning key, insert `queued`) → admit
(`limits.acquire`) → gate (atomic budget + dedup + `queued → dispatching`) → execute → persist
(`store.put`, then `journal.commitDone`) → report. Planning key = `sha256({ task, input, params })`
with `$ref` → target planning key and `$file` → file sha256. Artifact key adds `provider` and
`packVersion`; a done artifact with the same key from any run is reused at $0.

Retry: 5xx, 429 (`Retry-After` honoured), timeout, network → backoff; other 4xx and unknown errors
→ terminal `failed`; content-policy → `flagged`. Caller abort → clean pause.

## Events

Bus events (runner only; subscribe from a plugin with `depends: [runnerPlugin]` and a `hooks` map):

| Event | Payload |
|---|---|
| `run:progress` | `{ runId, total, done, failed, flagged, spendUsd }` (≤1 per 500 ms) |
| `run:done` | `{ runId, totals }` |
| `run:failed` | `{ runId, error }` |
| `run:budget-stop` | `{ runId, spendUsd, maxCostUsd }` |
| `run:paused` | `{ runId, drained }` |

Stream records (`app.runner.events()`, an `AsyncIterable`, discriminated on `type`): `item:queued`,
`item:dispatching`, `item:done` (`costUsd`, `contentHash`, `contentHashes?`), `item:retry`,
`item:failed` (`errorClass`, `message?`), `item:flagged` (`message?`), `overflow`, `progress`,
`terminal` (always last). No per-item event touches the bus.

## Build file (zod IR)

```yaml
version: 1                     # literal
name: string                   # required; export folder
defaults: { provider?: string, maxAttempts?: number }
items:
  - task: string               # any registered task
    id?: string                # export label; "/" allowed; braces only as a trailing {nine=l,t,r,b}
    provider?: string
    input: object              # required
    params?: object            # next to input, never inside
    pack?: { name, version }
itemsFrom?: path.ndjson        # one BuildItem per line
```

`defineBuild({...})` is the TypeScript form. `moku new` writes the starter with a
`# yaml-language-server: $schema=` modeline and the JSON Schema at `buildfile.schemaPath`.

## CLI

| Command | Flags | Exit |
|---|---|---|
| `moku new [name]` | — | 0; 1 when the file exists |
| `moku validate [glob]` | — | 0; 2 invalid |
| `moku estimate [glob]` | — | 0 |
| `moku run [glob]` | `--max-cost <usd>`, `--dry-run`, `--out <dir>` (default `out`), `--flat` | 0 done, 1 failed, 4 paused, 5 budget stop, 3 bad flag |
| `moku export [runId]` | `--out <dir>`, `--flat` | 0; 1 no such run |
| `moku status [runId]` | `--follow` | 0 |
| `moku compose "<prompt>"` | `--emit build\|script`, `--out <path>` | 0; 3 usage; 2 no valid spec; 1 other |

Every command also takes `--config <path>` (or `--config=<path>`): the bin removes it from argv
and loads that file instead of `moku.config.{ts,mts,js,mjs}` in the cwd. A config that does not
load prints `[ai] Could not load <path>.` and exits `3` before the app is created.

Export path: `<out>/<build name>/<label>.<ext>`, or `<out>/<label>.<ext>` with `--flat`;
label = `id`, else `<NN>-<task>`; multi-output items add `-2 … -N`; extension from MIME
(`png jpg webp gif mp4 mov webm mp3 wav ogg m4a txt json`, else `bin`). Every `done` item is
exported. A target this export already wrote (same label in two builds with `--flat`) is skipped
and listed: `skipped: unsafe name or duplicate target`.

## Project config (`moku.config.ts`)

```ts
type ProjectConfig = { plugins?: readonly PluginInstance[]; pluginConfigs?: { ... } };
defineConfig(config) // returns config; types pluginConfigs, also for the plugins in `plugins`
```

The bin: `loadProjectConfig(argv, cwd)` → `createApp(options)` → `start()` → `cli.dispatch(argv)` →
`stop()`. Core plugin keys (`journal`, `store`, `limits`) are not typed in `pluginConfigs`.

## 0.13 and 0.14 notes (CHANGELOG "Unreleased" plus PRs #32 to #37)

- `moku` bin loads `moku.config.{ts,mts,js,mjs}` or `--config <path>`; `defineConfig` and
  `ProjectConfig`. Custom plugins and `pluginConfigs` no longer need a wrapper script.
- `runner.export({ flat })` and `--flat` on `moku run` / `moku export`.
- fal `gpt-image-2.5`: `params.background` (`auto`, `transparent`, `opaque`); `transparent` sends
  png; `transparent` + `output_format: jpeg` is a terminal 400.
- New tasks `sfx` (elevenlabs default, fal `elevenlabs-sfx-v2`; always mp3) and `sprite` (fal
  `birefnet` or `none`; trim, resize, padding, RGBA png; `sharp` dependency).
- buildfile: an item id may end with one `{nine=l,t,r,b}` hint (whole numbers); other braces fail
  validation.
- Carried from 0.12.x: `runToolLoop` `cache` option and cached-token usage, ark Seedream
  `params.images: N`, multi-output items exported as `<label>-k.<ext>`, `item:flagged` carries
  `message`.

The CHANGELOG top section still reads "Unreleased" and lacks sfx and sprite; the source
`package.json` reads `0.1.0`. The published version comes from the release workflow. Treat
`0.14.0` on npm as the synced surface (it ships `sharp` and both new tasks).
