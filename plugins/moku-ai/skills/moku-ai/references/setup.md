# Provider setup: keys and logins

Verified against `@moku-labs/ai@0.16.1` source (`src/index.ts`, `src/plugins/<provider>/README.md`,
`src/plugins/cli/project-config.ts`). 0.13 and 0.14 add no new env var: `sfx` uses
`ELEVENLABS_API_KEY` or `FAL_KEY`, `sprite` uses `FAL_KEY`.

## How keys are read

The framework reads the environment in this order: the shell (`processEnv()`), then `.env.local`
in the working directory (`dotenv(".env.local")`). The shell wins. A key is read at request time
through `ctx.env`, never at start, never logged. `moku validate` and `moku estimate` need no key.
`moku run` needs the key of every provider that has an item.

## The rules for the agent

1. **Never type a key.** Tell the user which variable to add and let them paste the value into
   `.env.local` themselves. Do not ask them to paste it into the chat.
2. **Never echo a key.** Do not `cat .env.local`, do not `echo $FAL_KEY`, do not log the env.
   Check presence only: `grep -c '^FAL_KEY=' .env.local` or `test -n "$FAL_KEY"`.
3. **Keep `.env.local` out of git.** Run this before the user adds a key:

```bash
grep -qxF '.env.local' .gitignore 2>/dev/null || printf '\n.env.local\n' >> .gitignore
grep -qxF '.moku/' .gitignore 2>/dev/null || printf '.moku/\n' >> .gitignore
```

4. **Verify with a $0 command.** `moku estimate` proves the build file and the price table.
   `moku run --dry-run` proves the plan. Neither sends a key. The first real `moku run --max-cost`
   with a small ceiling (for example `0.10`) proves the key.

Keys in `.env.local` look like this. The user writes the file; the agent only writes the variable
names as placeholders when asked to scaffold it:

```bash
# .env.local (gitignored)
FAL_KEY=
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
```

## Provider by provider

| Provider | Tasks | Env var | Where the key comes from |
|---|---|---|---|
| `fal` | image, sprite, sfx, video, music, prompt-gen | `FAL_KEY` | fal.ai dashboard, "Keys" page. Sent as `Authorization: Key <FAL_KEY>`. |
| `openai` | voiceover, translate, prompt-gen | `OPENAI_API_KEY` | platform.openai.com, API keys. |
| `elevenlabs` | voiceover, sfx (default) | `ELEVENLABS_API_KEY` | elevenlabs.io account, API keys. Sent as the `xi-api-key` header. |
| `apimodels` | video | `APIMODELS_API_KEY` | apimodels.app account. |
| `ark` (`intl`) | video, image, asset | `ARK_API_KEY`; assets also `ARK_ACCESS_KEY` + `ARK_SECRET_KEY` | BytePlus ModelArk console. The access and secret key pair is for the signed asset API; a video item without asset refs needs only `ARK_API_KEY`. |
| `ark` (`cn`) | same | same names | Volcengine Ark console. Set `pluginConfigs: { ark: { region: "cn" } }` in `moku.config.ts`. |
| `codex` | image, prompt-gen | none | Local Codex CLI logged in: `codex login`. Billed to the ChatGPT plan, cost $0. |
| `claude` | prompt-gen | none | Local Claude Code CLI logged in: `claude /login`. Billed to the Claude plan, cost $0. |

A `sprite` item with `model: none` makes no call and needs no key.

The variable name is a config value (`apiKeyEnv`, `accessKeyEnv`, `secretKeyEnv`), so
`moku.config.ts` can point a provider at `MY_FAL_KEY` instead:

```ts
// moku.config.ts
import { defineConfig } from "@moku-labs/ai";

export default defineConfig({ pluginConfigs: { fal: { apiKeyEnv: "MY_FAL_KEY" } } });
```

### fal

Most game work goes through fal: three image models, the `birefnet` sprite matte, the sfx model,
two music models, every video model and an OpenRouter router for text. One key covers all six
tasks. Local files (refs, keyframes, sprite sources) are uploaded to fal storage by default;
`pluginConfigs.fal.upload: "data-uri"` in `moku.config.ts` sends them inline instead.

Error text when the key is missing: `[ai] FAL_KEY is not set.` The item fails before any upload.

### openai

The chat default model is `gpt-4o-mini`, TTS `gpt-4o-mini-tts`. A `baseUrl` config points the SDK at
a proxy. A model not in the price table estimates as `$0`: add `priceOverrides` for it.

### elevenlabs

Voiceover and sfx; the default `sfx` provider. The `voice` field is an ElevenLabs voice id (for
example `21m00Tcm4TlvDq8ikWAM`), not a name. Default model `eleven_multilingual_v2`, output `mp3`
(`mp3_44100_128`). Sound effects go to `/v1/sound-generation` with model `eleven_text_to_sound_v2`.
The bundled sfx prices are estimates; set the plan's real rate with
`elevenlabs.priceOverrides` in `moku.config.ts`.

### apimodels and ark

Video providers for Seedance. apimodels resells Seedance 2.5 and 2.0 and accepts real faces. Ark is
ByteDance direct; a real face must be registered as an `asset` item first (needs the access and
secret key pair). Both are optional for game art.

Ark keeps registered faces in asset groups, at most 50 per account. Since 0.15 a process finds its group
by name (`ark.groupName`, default `moku-ai`, or the item's `groupName`) and creates one only when none
exists. `ark.groupId` pins the group of `ark.groupName` only. `app.ark.listAssetGroups()` and
`app.ark.listAssets({ groupId })` show what is registered; `deleteAsset` and `deleteAssetGroup` remove
it for good.

### codex and claude (local CLIs)

No key. The provider spawns the CLI (`codex exec`, `claude -p`). Check that both binaries are on
`PATH` first (`command -v codex claude`). The login is the user's job: `codex login` for Codex,
`claude` then `/login` for Claude Code. The agent does not drive these logins.

Not logged in is reported as `[ai] Codex CLI is not logged in.` or a `PromptGenUnavailableError`
with `reason: "auth"`. A plan or rate limit is `reason: "limit"`: wait or use another provider.
Image turns burn plan limits faster than text turns. Codex is the default `image` provider; set
`defaults.provider: fal` in the build file when the user wants API billing instead.

## Verify a new key

```bash
moku estimate                     # $0, proves the build file and prices
moku run --dry-run                # $0, proves the plan
moku run --max-cost 0.10          # one cheap item proves the key; exit 5 is fine
```

Then `moku run --max-cost <estimate * 1.2>` for the real batch.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `[ai] FAL_KEY is not set.` | Shell has no key and `.env.local` is not in the cwd | Run `moku` from the folder that holds `.env.local` |
| Exit 5 at once | `--max-cost` below the first item | Raise the ceiling to the estimate |
| Item `failed`, 401 or 403 | Wrong or expired key | Replace the value in `.env.local`; the next run adopts the same job |
| Item `flagged` | Content policy at the provider | Change the prompt; flagged items are never retried |
| `[ai] ark refused the <audio\|video\|picture> it generated: <code>.` | Ark made the clip and refused its own result (0.15.1). The inputs are fine | Run a new take with the same request; Ark did not charge this one. Bump `params.generation` to get a new key |
| `[ai] ark seconds -1 is for a video edit only.` | `seconds: -1` without `params.omni_reference_task_type: edit` | Add the param, or set a length |
| `[ai] No price for codex model "<m>".` | Unknown model | Use the default `gpt-6-astra` or add `priceOverrides` |
| `[ai] No price for ElevenLabs sfx model "<m>".` | sfx model is not `eleven_text_to_sound_v2` | Use that model, or add `sfx:<m>#second` and `#auto` to `elevenlabs.priceOverrides` |
| `[ai] Could not load <path>.`, exit 3 | `moku.config.*` throws, has no object default export, or imports a local file without its extension | Fix the file; write `./plugins/x.ts`, or run `bunx --bun moku` |
| `[ai] Sprite is empty after background removal.` | The matte removed everything, or a `none` source has no alpha above `alphaThreshold` | Check the source image; lower `alphaThreshold`; use `birefnet` for an opaque source |
