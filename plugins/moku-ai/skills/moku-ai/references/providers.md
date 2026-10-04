# Providers, tasks, models, and custom plugins

Verified against `@moku-labs/ai@0.14.0` source: `src/index.ts`, `src/plugins/<task>/contract.ts`,
`src/plugins/<provider>/README.md`, `src/plugins/cli/project-config.ts`. Prices are the bundled
tables; `priceOverrides` replaces them.

## Task × provider

| Task | Providers (first = default) | Output |
|---|---|---|
| `image` | `codex`, `fal`, `ark` | one image; `images[]` for an ark group |
| `sprite` | `fal` | RGBA png, trimmed, optional resize and padding |
| `sfx` | `elevenlabs`, `fal` | mp3, always |
| `video` | `fal`, `apimodels`, `ark` | mp4 (`submit` + `poll`, job id journaled) |
| `music` | `fal` | mp3 |
| `voiceover` | `elevenlabs`, `openai` | mp3, wav or ogg |
| `translate` | `openai` | text |
| `prompt-gen` | `openai`, `codex`, `claude`, `fal` | text (fal: also tool calls) |
| `asset` | `ark` | an `AssetRecord` json that video items `$ref` |

The default is the task plugin's `defaultProvider` config (`image: codex`, `sprite: fal`,
`sfx: elevenlabs`, `video: fal`, `music: fal`, `voiceover: elevenlabs`, `translate: openai`,
`prompt-gen: openai`, `asset: ark`).
A build file overrides it with `defaults.provider` or a per-item `provider`.

## Task input fields

The runner hands a handler `{ ...input, params }`. Field names below are the contract types.

| Task | `input` fields | Notes |
|---|---|---|
| `image` | `prompt`, `negative?`, `model?`, `aspect?`, `refs?: [{ $file \| $ref }]` | `aspect` `"9:16"` (default), `"16:9"`, `"1:1"`, `"3:4"`, `"4:3"`; more on nano-banana |
| `sprite` | `source: { $ref \| $file }`, `model`, `trim?` (true), `padding?` (0), `size?: { width, height }`, `fit?` (`contain` \| `cover` \| `fill`), `pixelArt?` (false), `alphaThreshold?` (8) | `model` is required: `birefnet` or `none`. With `size` the output is exactly `size` and `padding` sits inside it |
| `sfx` | `model`, `prompt`, `durationMs?`, `promptInfluence?` (0..1), `loop?` | `model` is required. Prompt at most 450 characters. No `durationMs`: the model picks the length |
| `video` | `model`, `prompt`, `negative?`, `image?`, `endImage?`, `refs?`, `seconds?` (5), `aspect?`, `resolution?`, `audio?`, `fromDraft?` | `image` and refs are `{ $ref }` or `{ $file }` |
| `music` | `model`, `prompt`, `lengthMs`, `chunks?`, `seed?` | `model` is required, no default |
| `voiceover` | `text`, `voice`, `language?`, `model?`, `format?` (`mp3` \| `wav` \| `ogg`) | ElevenLabs `voice` is a voice id; OpenAI `voice` is `alloy` and friends |
| `translate` | `text`, `targetLang`, `sourceLang?`, `model?` | |
| `prompt-gen` | `prompt`, `system?`, `model?`, `temperature?`, `messages?`, `tools?`, `toolChoice?`, `cacheSystem?` | `messages`/`tools` only on `fal` |
| `asset` | `image: { $file }`, `url?`, `group?` | ark needs a public https `url` of the same bytes |

`params` is free per provider and part of the cache key. Common ones: `params.output_format`
(fal gpt image: `png` \| `jpeg` \| `webp`), `params.background` (fal `gpt-image-2.5` only: `auto` \|
`transparent` \| `opaque`; `transparent` sends png, and with `output_format: jpeg` it is a terminal
400; other models never send it), `params.quality` (fal gpt image), `params.resolution`
(fal image: `1K` \| `2K` \| `4K` \| `1080`), `params.images: N` (ark Seedream group, 1 to 15),
`params.draft: true` (ark 2.5 480p draft), `params.model` and `params.operating_resolution`
(fal sprite `birefnet`), `params.output_format` (elevenlabs sfx, `mp3_*` only),
`params.reasoning` (codex, claude, fal prompt-gen),
`params.responseSchema` (prompt-gen JSON answer), `params.generation` (any value; changes the key to
force a re-render).

## Models and prices

### image

| Provider | Model id | Price | Notes |
|---|---|---|---|
| `codex` | `gpt-6-astra` (default) | $0 (ChatGPT plan) | `codex exec` writes `output.png`; sizes 1024×1536 / 1536×1024 / 1024×1024 by `aspect` |
| `fal` | `gpt-image-2.5` (default) | $0.05, `@2K` $0.06 | returns **jpeg** unless `params.output_format: png`; up to 16 refs |
| `fal` | `nano-banana-pro` | $0.15 (`1K`, `2K`), $0.30 (`4K`) | always png; 10 aspects; 14 refs |
| `fal` | `seedream-4.5-edit` | $0.04 | 10 refs |
| `ark` | `seedream-5-0-lite-260128` (default) | $0.035 per image | `intl`; sizes by aspect; `params.images: N` for a consistent group |

### sprite (fal)

| Model | Price | Notes |
|---|---|---|
| `birefnet` | $0.002 per image (estimate) | `fal-ai/birefnet/v2` matte, then the pixel step. `params.model`: `General Use (Light)` (default), `General Use (Light 2K)`, `General Use (Heavy)`, `Matting`, `Portrait`, `General Use (Dynamic)`. `params.operating_resolution`: `1024x1024` (default), `2048x2048`, `2304x2304` |
| `none` | $0, no call, no key | the source is already transparent: trim, resize and pad only |

fal bills BiRefNet per compute second ($0.0008/s); $0.002 is the bundled guess. Override with
`fal.priceOverrides["sprite:birefnet"]`. The estimate reads `model` only, so it runs before the
`$ref` source exists. A sprite with no pixel above `alphaThreshold` fails:
`[ai] Sprite is empty after background removal.`

### sfx

| Provider | Model | Length | Price |
|---|---|---|---|
| `elevenlabs` (default) | `eleven_text_to_sound_v2` (the only one) | 500 to 30 000 ms, or omitted | $0.002 per started second; $0.01 when `durationMs` is omitted (estimates) |
| `fal` | `elevenlabs-sfx-v2` | 500 to 22 000 ms, or omitted | $0.002 per started second; no `durationMs` bills the 22 s cap, $0.044 |

Both return mp3; fal returning anything else is a terminal 415. The ElevenLabs prices are guesses
from its credit table; set the plan's real rate with `elevenlabs.priceOverrides`
(`"sfx:eleven_text_to_sound_v2#second"`, `"sfx:eleven_text_to_sound_v2#auto"`) or
`fal.priceOverrides["sfx:elevenlabs-sfx-v2"]`. A missing sfx price is a terminal error, never $0.

### video (fal aliases; full table in the fal README)

| Alias | Price | Notes |
|---|---|---|
| `minimax-h3` | $0.05 to $0.16 per s by resolution | native stereo audio, always on |
| `seedance-2.5`, `seedance-2.5-ref` | $0.2205 (480p), $0.473 (720p) per s | 4 to 30 s |
| `seedance-2.0-mini`, `-mini-ref` | $0.0721 (480p), $0.1547 (720p) per s | cheapest Seedance |
| `kling-3-pro`, `kling-o3-ref`, `kling-o3-v2v-ref` | $0.112 to $0.168 per s | |
| `wan-3.0-ref` | $0.05 to $0.20 per s | |
| `veo-3.1-fast` | $0.10 per s, `+audio` $0.15 | |
| `vidu-q3`, `vidu-q3-ref` | $0.07 to $0.154 per s | |
| `gemini-omni-1.1-flash`, `-ref` | $0.03 to $0.30 per s | |

`apimodels`: `seedance-2.5`, `seedance-2.5-ref`, `seedance-2.0`, `seedance-2.0-ref`
($0.092 to $0.492 per s). `ark` intl: `dreamina-seedance-2-0-260128`, `dreamina-seedance-2-0-fast-260128`,
`dreamina-seedance-2-0-mini-260615`, `dreamina-seedance-2-5-260628` (per 1M output tokens; the
estimate converts). `ark` cn: `doubao-seedance-2-0-260128`, `doubao-seedance-2-5-260628`.

### music (fal)

| Model id | Length | Price |
|---|---|---|
| `elevenlabs-music-v2.5` | 3 s to 10 min | $0.80 per started minute |
| `stable-audio-2.5` | 1 s to 190 s | $0.20 per generation |

Both return mp3. `app.fal.models("music")` lists them with prices.

### voiceover

| Provider | Model | Price |
|---|---|---|
| `elevenlabs` | `eleven_multilingual_v2` (default), `eleven_turbo_v2_5`, `eleven_flash_v2_5`, `eleven_monolingual_v1` | $0.0003 / $0.00015 / $0.00006 / $0.0003 per character |
| `openai` | `gpt-4o-mini-tts` (default), `tts-1`, `tts-1-hd` | $15 / $15 / $30 per 1M characters |

### translate and prompt-gen

| Provider | Model | Price (in / out per 1M tokens) |
|---|---|---|
| `openai` | `gpt-4o-mini` (default), `gpt-4o` | $0.15 / $0.60; $2.50 / $10 |
| `fal` | `anthropic/claude-opus-5.5` (default), `anthropic/claude-sonnet-5`, `openai/gpt-6-sol`, `openai/gpt-6-astra`, `google/gemini-3.8-flash`, `x-ai/grok-4.7` | $4 / $20; $2 / $10; $2 / $10; $10 / $50; $0.75 / $3.75; $2 / $6 |
| `codex` | codex default, or `textModel` | $0 |
| `claude` | CLI default, or `textModel`; `anthropic/claude-opus-5.5` maps to `claude-opus-5-5` | $0 |

## Env vars

| Provider | Variables |
|---|---|
| `fal` | `FAL_KEY` (also sfx and `birefnet` sprites; a `none` sprite needs no key) |
| `openai` | `OPENAI_API_KEY` |
| `elevenlabs` | `ELEVENLABS_API_KEY` (voiceover, sfx) |
| `apimodels` | `APIMODELS_API_KEY` |
| `ark` | `ARK_API_KEY`, plus `ARK_ACCESS_KEY` and `ARK_SECRET_KEY` for assets |
| `codex`, `claude` | none; local CLI login |


## Adding a custom provider or a new task

The registry is a two-level map `task → provider → handler`. A provider plugin registers a handler in
`onInit`. A task is just a string key: registering `("foley", "acme", handler)` makes `task: foley`
valid in a build file at once. The runner guards every handler with the same protocol:

```ts
type Handler = {
  estimate(request: unknown): { usd: number };
  execute?(request: unknown, opts: { signal?: AbortSignal }): Promise<Result>;
  submit?(request: unknown, opts: { signal?: AbortSignal }): Promise<{ jobId: string }>;
  poll?(jobId: string, request: unknown, opts: { signal?: AbortSignal }): Promise<JobPoll>;
};
// Result carries bytes as `body` | `audio` | `image` | `video`, or `text`, plus `mimeType` and `costUsd`.
```

Errors steer the retry class: throw with `status` (http code), or `kind: "timeout" | "network"`
(retried), `kind: "content-policy"` (flagged, never retried), `kind: "invalid-request" |
"local-failure"` (failed after one attempt). An error with no hint fails after one attempt. Set
`publicMessage` to a text that is safe to show.

### The CLI loads it from `moku.config.ts`

The `moku` bin is `loadProjectConfig` → `createApp(options)` → `start()` → `cli.dispatch(argv)` →
`stop()` (`src/bin.ts`). The loader looks in the working directory for `moku.config.ts`,
`moku.config.mts`, `moku.config.js`, `moku.config.mjs`, in that order; the first file wins.
`--config <path>` (or `--config=<path>`) on any command wins over the search, resolves against the
working directory, and is removed before the command sees argv. No file: `createApp({})`, as before.

The default export goes to `createApp` as is. Only two keys are allowed:

```ts
// moku.config.ts
import { defineConfig } from "@moku-labs/ai";
import { acmeSfxPlugin } from "./plugins/acme-sfx.ts";   // Node needs the extension

export default defineConfig({
  plugins: [acmeSfxPlugin],                      // extra plugins, registered after the built-in ones
  pluginConfigs: {                               // per-plugin config, typed
    ark: { region: "cn" },
    elevenlabs: { priceOverrides: { "sfx:eleven_text_to_sound_v2#second": 0.0025 } }
  }
});
```

`defineConfig` returns its argument. It types `pluginConfigs`, also for the custom plugins in
`plugins`, so an unknown key or a wrong value is an editor error. The core plugins (`journal`,
`store`, `limits`) are not typed there.

A config that does not load prints `[ai] Could not load <path>.` and the reason, then exits `3`
before any app exists: a `--config` file that does not exist, a module that throws, or a default
export that is not an object. `--config` with no path also exits `3`.

Node 24 strips the types of a `.ts` file; Bun loads it as is. `bunx moku` runs the bin on Node
(its shebang), so two Node rules apply to the config and every local file it imports:

- A relative import needs its extension: `./plugins/acme-sfx.ts`, not `./plugins/acme-sfx`
  (`Cannot find module` and exit `3`). The project tsconfig then needs
  `allowImportingTsExtensions`. Or run the bin on Bun, which resolves both: `bunx --bun moku`.
- In a package without `"type": "module"` Node prints a `MODULE_TYPELESS_PACKAGE_JSON` warning.
  Add `"type": "module"`, or use `.mts` files.

### Minimal example: an `acme` provider for the `sfx` task

```ts
// plugins/acme-sfx.ts
import { createPlugin, registryPlugin } from "@moku-labs/ai";
import type { Sfx } from "@moku-labs/ai";

/** Price per started second of the acme sound model, in USD. */
const USD_PER_SECOND = 0.01;

/**
 * Handler for the `("sfx", "acme")` pair. `estimate` prices by length and runs
 * with no key; `execute` calls the vendor and returns mp3 bytes with the real cost.
 */
const acmeSfxHandler: Sfx.SfxHandler = {
  estimate: request => ({ usd: Math.ceil((request.durationMs ?? 2000) / 1000) * USD_PER_SECOND }),

  execute: async (request, opts) => {
    const key = process.env.ACME_API_KEY;
    if (!key) throw Object.assign(new Error("[ai] ACME_API_KEY is not set."), { status: 401 });

    const response = await fetch("https://api.acme.example/v1/sfx", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ prompt: request.prompt, model: request.model, ms: request.durationMs }),
      signal: opts.signal ?? null
    });
    if (!response.ok) {
      throw Object.assign(new Error(`[ai] acme sfx failed: ${response.status}.`), {
        status: response.status
      });
    }

    const audio = new Uint8Array(await response.arrayBuffer());
    return { audio, mimeType: "audio/mpeg", costUsd: acmeSfxHandler.estimate(request).usd };
  }
};

/**
 * Registers the `acme` provider for the `sfx` task. Build files can use
 * `provider: acme` on an sfx item right away.
 */
export const acmeSfxPlugin = createPlugin("acmeSfx", {
  depends: [registryPlugin],
  onInit: ctx => {
    ctx.require(registryPlugin).register("sfx", "acme", acmeSfxHandler);
  }
});
```

Build file and commands, the plain `moku` bin with no script:

```yaml
version: 1
name: sfx
items:
  - id: click
    task: sfx
    provider: acme
    input: { model: acme-sfx-1, prompt: "short wooden click", durationMs: 1000 }
```

```bash
moku estimate                                   # sfx/acme × 1  $0.0100
moku run --max-cost 0.05 --flat --out features/ui/assets
moku run --config configs/acme.mts --max-cost 0.05   # another config file
```

Inside a plugin, the family convention is `ctx.env.get("ACME_API_KEY")` (MC3) and `ctx.log` (MC2)
instead of `process.env` and `console`. The sample uses `process.env` to stay short; a plugin that
ships should read the key through `ctx.env` in `onInit` or `api` and close over it.

### Handler types

The task namespaces ship the handler types: `Image.ImageHandler`, `Sprite.SpriteHandler`,
`Sfx.SfxHandler`, `Video.VideoHandler`, `Music.MusicHandler`, `Voiceover.VoiceoverHandler`,
`Translate.TranslateHandler`, `PromptGen.PromptGenHandler`, `Asset.AssetHandler`. Video, music and
asset handlers may use `submit` + `poll` for long jobs; sprite and sfx handlers are `execute` only.
A sprite handler gets `source` already resolved to `{ path, mimeType, hash }` and must return
`image/png`; the shipped pixel step `processSprite` is internal (`src/plugins/sprite/process.ts`)
and not exported from the package root.

### Lane limits for a new provider

Every handler runs under the lane `"{task}/{provider}/default"`: 60 rpm, 4 concurrent, breaker
after 5 retryable failures. A `limits.lanes` override replaces the whole map, so repeat the shipped
`video/apimodels` and `video/ark` lanes when adding one. `limits` is a core plugin: `defineConfig`
does not type it, so `pluginConfigs.limits` needs a cast. core 1.7.1 fixes the type (moku-labs/core#29); the cast
goes away once `@moku-labs/ai` ships on core 1.7.1 (0.14.1 still pins 1.6.0).
