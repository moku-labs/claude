# Pipeline: moku-ai assets into a @moku-labs/game project

Verified against `@moku-labs/ai@0.14.2` (`runner/export.ts`, `buildfile/schema.ts`, the `sfx` and
`sprite` plugins, `fal/image/models.ts`) and `@moku-labs/game@0.4.0` (`src/plugins/assets/README.md`,
`scan/keys.ts`, `scan/scan.ts`), plus the worked fixture `tests/integration/merge-game/` in the
game repository.

## What the game accepts

| File | Becomes | Key |
|---|---|---|
| `.png`, `.webp` | one texture | `<feature>.<folders>.<stem>` |
| `.fnt` + its `.png` pages | one bitmap font | the `.fnt`'s stem; pages are not keys |
| `.mp3`, `.m4a` (AAC in MP4) | one sound | stem |
| `.aac`, `.ogg`, `.opus`, `.wav`, `.flac`, `.ttf`, anything else | **left out**, with a note | |

`click.mp3` next to `click.m4a` is one key from two files: the scan fails and names both.

Files live in `features/<feature>/assets/` of the game folder, or in a layer `config.ts` names
(`assets: { layers: { shared: "ui" } }` keys `shared/assets/*` as `ui.*`). A game on the shell of
`@moku-labs/game` 0.10 and later runs the engine bin, which reads its paths and layers from `config.ts`:

```jsonc
// game package.json
"keys": "moku-game keys",
"pack": "moku-game pack"
```

`bun run keys` scans the assets, writes `generated/assets.ts` (`AssetKey`, `FontKey`, `AudioKey`) and the
dev manifest. A subfolder adds a dotted segment: `features/ui/assets/icons/sword.png` is
`ui.icons.sword`. An older game without `config.ts` runs `moku-game-assets --root .` in an `assets:keys`
script; the commands below work the same with that name.

**A `.` in a folder or file stem fails the scan** (`"sword.v2" ... would fake a folder`). So
moku-ai item ids use `-` and `/` only: `button-green`, never `button.green` or `s01.key`.
moku-ai does not reject the `.`; the game scan does.

A nine-slice texture carries its borders in the file name. The key drops the tag:

| Tag | Borders | Example | Key |
|---|---|---|---|
| `{nine=N}` | every side | `panel{nine=48}.png` | `ui.panel` |
| `{nine=H,V}` | left+right, top+bottom | `bar{nine=24,12}.png` | `ui.bar` |
| `{nine=L,T,R,B}` | left, top, right, bottom | `button-green{nine=36,40,36,40}.png` | `ui.button-green` |

A moku-ai item id takes only the four-number form: `"button-green{nine=12,12,12,12}"`. Any other
braces in an id fail `moku validate` (exit `2`). Left plus right, and top plus bottom, must stay
below the image's sides. Borders are pixels of the final file. With a `sprite` `size` the final
size is known before the run, so the borders can be written into the id up front.

## One build file per feature

Put the build file next to the feature, `features/<f>/assets.moku.yaml`, with `name: <f>`.
Ids carry no feature prefix: the export lands inside the feature folder.

```yaml
# features/ui/assets.moku.yaml
# yaml-language-server: $schema=../../../.moku/build.schema.json
version: 1
name: ui
defaults: { provider: fal }
items:
  # 1. The raw picture. Under raw/ so it is easy to delete after export.
  - id: raw/button-green
    task: image
    input:
      prompt: >
        Game UI asset for a cozy forest merge game. One horizontal rounded wooden button,
        moss green face, dark-brown ink outline, flat cel shading. Designed for 9-slice:
        straight middle edges, plain stretchable center, fixed rounded corners. No text.
      aspect: "1:1"
      refs: [{ $file: ../../../refs/style-sheet.png }]
    params: { background: transparent }          # gpt-image-2.5 only; sends png

  # 2. The sprite: trim, resize to the final size, nine-slice borders in the id.
  - id: "button-green{nine=12,12,12,12}"
    task: sprite
    input:
      source: { $ref: raw/button-green }
      model: none                                # source is already transparent: $0, no call
      size: { width: 128, height: 64 }
      padding: 2

  # 3. A sound effect, mp3.
  - id: click
    task: sfx
    provider: elevenlabs
    input: { model: eleven_text_to_sound_v2, prompt: "short wooden UI click, dry, no reverb", durationMs: 600 }
```

Keep a style reference image per project under `refs/` and attach it to every image item with
`$file`. The ref bytes are part of the cache key, so a changed reference renders the set again.

### Transparent sprites

| Source | Sprite `model` | Cost |
|---|---|---|
| fal `gpt-image-2.5` with `params.background: transparent` | `none` | image $0.05, sprite $0 |
| Any opaque source: `nano-banana-pro`, `seedream-4.5-edit`, `codex`, ark, a `$file` | `birefnet` | image + $0.002 (estimate) |

`background` is sent only on `gpt-image-2.5`; `transparent` with `output_format: jpeg` is a
terminal 400. For `birefnet`, ask for a "flat colour background" in the image prompt; it matters
more than "transparent". `params.model: Matting` helps with soft edges such as hair or smoke.

The sprite step: background removal, trim to the alpha box (`trim: true`), resize into
`size - 2 * padding` (`fit: contain` letterboxes with transparent pixels, `lanczos3`, or nearest
neighbour with `pixelArt: true`), then the transparent `padding` border. The output is exactly
`size`, an RGBA png. Changing sprite options re-cuts the stored image and never pays for the image
again.

### Sound effects

`sfx` returns mp3, always, so the file is a game sound as is.

| Provider | Model | Length | Price |
|---|---|---|---|
| `elevenlabs` (default) | `eleven_text_to_sound_v2` | 500 to 30 000 ms | $0.002 per started second; $0.01 with no `durationMs` |
| `fal` | `elevenlabs-sfx-v2` | 500 to 22 000 ms | $0.002 per started second; $0.044 with no `durationMs` |

Set `durationMs` for short effects: 600 ms is $0.002. `loop: true` asks for a seamless loop. The
prices are estimates; see `providers.md`.

## Run and land the files

Run one feature per `moku run`. `--flat` drops the `<build name>/` folder, so `--out` can point
straight at the feature's `assets/`:

```bash
moku validate "features/*/assets.moku.yaml"
moku estimate "features/*/assets.moku.yaml"
# tell the user the total, wait for a yes
moku run features/ui/assets.moku.yaml --max-cost 0.10 --flat --out features/ui/assets
rm -rf features/ui/assets/raw        # every done item is exported, the raw images too
bun run keys
```

Result: `features/ui/assets/button-green{nine=12,12,12,12}.png` (key `ui.button-green`) and
`features/ui/assets/click.mp3` (key `ui.click`). Without `--flat` the export writes
`<out>/ui/...` and the keys gain a `ui.` segment.

Two rules of `--flat`: one glob with several builds into one folder keeps the first file of a
label and lists the second as skipped; and the raw images land next to the finals unless deleted.
`moku export --flat --out <dir>` lands the newest run again at any time.

### Convert, only where moku-ai does not

| From | To | Command |
|---|---|---|
| voiceover `wav`/`ogg`, any other audio | m4a or mp3 | `ffmpeg -y -i in.wav -c:a aac -b:a 128k out.m4a`, or `-ac 1 -ar 44100 -b:a 96k out.mp3` for effects |
| png | webp (optional) | `magick in.png -quality 85 out.webp`, for large loose textures; the packer encodes atlas pages itself |

Voiceover, music and sfx are mp3 already. Sprites are png at the final size: no ImageMagick trim
or resize step is needed.

### Register and pack

```bash
bun run keys                  # scan features/*/assets and the layers, write generated/assets.ts + dev manifest
bun run keys --check          # CI: fails when outputs are stale
bun run pack                  # production: atlas pages in dist/assets (moku-game build packs too)
```

The dev pipeline serves loose files. The production packer (`--pack <dir>`, needs `sharp` as a dev
dependency of the game) puts the same textures into atlas pages and keeps keys and nine-slice
borders unchanged. A texture with a side above 512 px stays loose. Nothing to do in moku-ai for
atlases: generate single sprites, let the game pack them.

## Gaps in @moku-labs/ai for game art, and what to do

| Gap | Fact | What to do |
|---|---|---|
| No "intermediate" flag on an item | Export writes every `done` item, also a raw image that only feeds a `sprite` | Put raw items under `raw/` and `rm -rf <assets>/raw` after export. |
| No sprite-sheet or animation task | One sprite per item. An ark group (`params.images: N`) is one item; a `$ref` to it is the first output only, so a `sprite` cannot cut frames 2..N | One `image` + one `sprite` item per frame with a shared ref (`coin-spin-0` ... `coin-spin-6`). The game packer builds the atlas. |
| Nine-slice hint is the four-number form only | `buildfile/schema.ts` | Write `{nine=N,N,N,N}`; the game reads it the same as `{nine=N}`. |
| Ids with `.` break the game scan | `scan/keys.ts`; moku-ai accepts them | Use `-` and `/`. |
| sfx and `birefnet` prices are estimates | ElevenLabs bills credits, fal bills BiRefNet per second | `priceOverrides` with the plan's real rate. |
| sfx and sprite not proven against the live APIs | Upstream tests mock ElevenLabs and fal | First paid run with a small `--max-cost`; check one file by ear and eye. |
| No account pools | One key per provider (`apiKeyEnv`) | One account per provider, or a custom provider plugin. |
| No 3D | No task | Out of scope. |
| No bitmap fonts | No task | `msdf-bmfont-xml` from a licensed TTF, as in merge-game. |

## Provenance note

Every feature's `assets/` folder gets an `ASSETS.md` that says where each file came from, as in
`tests/integration/merge-game/features/ui/assets/ASSETS.md` of the game repository. The shape:

```markdown
# Assets of <game>

Where every art file and sound of this feature came from. A 9-slice piece carries its insets in
the file name as `{nine=left,top,right,bottom}` in texture px; the key drops the tag.

## Art

- Source: @moku-labs/ai 0.14.2, build file `features/ui/assets.moku.yaml`, provider `fal`,
  model `gpt-image-2.5` with a transparent background, cut by the `sprite` task (`none`),
  run on 2026-10-04.
- Style reference: `refs/style-sheet.png` (drawn by Astra, 2026-09-22).

### `ui.button-green`

- File: `features/ui/assets/button-green{nine=12,12,12,12}.png`, 128 × 64 px.
- Raw image: `raw/button-green`, 1024 × 1024 px, $0.05. Sprite: `none`, padding 2, $0.
- Prompt:

  > Game UI asset for a cozy forest merge game. One horizontal rounded wooden button ...

## Sounds

| Key | File | Source | Licence |
|---|---|---|---|
| `ui.click` | `features/ui/assets/click.mp3` | @moku-labs/ai, `sfx` elevenlabs `eleven_text_to_sound_v2`, 600 ms, 2026-10-04 | provider terms |
| `ui.theme` | `features/ui/assets/theme.mp3` | Kenney, Music Loops, `Farm Frolics.ogg`, CC0 1.0 | CC0 |
```

For each file: the final path with its size and nine-slice borders, the raw item and its cost, the
sprite options, the provider and model, the date, and the exact prompt copied from the build file.
The journal (`.moku/journal.db`) keeps no prompts, so the build file and this note are the only
record. The `moku run` box prints each file's cost; copy it.

## Checklist

1. `features/<f>/assets.moku.yaml` with `name: <f>`, ids without `.` and without the feature
   prefix, raw images under `raw/`.
2. Images: `params.background: transparent` on fal `gpt-image-2.5`, then a `sprite` item
   (`none`); other sources go through `sprite` with `birefnet`. Final `size` and the
   `{nine=l,t,r,b}` id hint on the sprite.
3. Sounds: `sfx` items with `durationMs`; music on fal; everything lands as mp3.
4. `moku validate`, `moku estimate`, tell the total, wait for a yes.
5. `moku run <file> --max-cost <n> --flat --out features/<f>/assets`, then
   `rm -rf features/<f>/assets/raw`.
6. `bun run keys`.
7. Write or update `features/<f>/assets/ASSETS.md`.
8. Commit the assets and the note. Not `.moku/`, `out/` or `.env.local`.
