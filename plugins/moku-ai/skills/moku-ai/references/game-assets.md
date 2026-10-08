# Pipeline: moku-ai assets into a @moku-labs/game project

Verified against `@moku-labs/ai@0.16.1` (`runner/export.ts`, `buildfile/schema.ts`, the `sfx` and
`sprite` plugins, `fal/image/models.ts`) and `@moku-labs/game@0.12.0` (`src/plugins/assets/README.md`,
`scan/keys.ts`, `scan/scan.ts`, `scan/pack/groups.ts`, `docs/shell.md`). The worked game is the merge
game in moku-labs/demos; it left the engine repository in game 0.8.

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
dev manifest. A subfolder adds a dotted segment: `shared/assets/icons/coin.webp` is
`ui.icons.coin`. How to group files into folders: see "Folder layout" below. An older game without `config.ts` runs `moku-game-assets --root .` in an `assets:keys`
script; the commands below work the same with that name.

**A `.` in a folder or file stem fails the scan** (`"sword.v2" ... would fake a folder`). So
moku-ai item ids use `-` and `/` only: `buttons/green`, never `buttons.green` or `s01.key`.
moku-ai does not reject the `.`; the game scan does.

A nine-slice texture carries its borders in the file name. The key drops the tag:

| Tag | Borders | Example | Key |
|---|---|---|---|
| `{nine=N}` | every side | `panels/wood{nine=48}.png` | `ui.panels.wood` |
| `{nine=H,V}` | left+right, top+bottom | `panels/bar{nine=24,12}.png` | `ui.panels.bar` |
| `{nine=L,T,R,B}` | left, top, right, bottom | `buttons/green{nine=36,40,36,40}.png` | `ui.buttons.green` |

A moku-ai item id takes only the four-number form: `"buttons/green{nine=12,12,12,12}"`. Any other
braces in an id fail `moku validate` (exit `2`). Left plus right, and top plus bottom, must stay
below the image's sides. Borders are pixels of the final file. With a `sprite` `size` the final
size is known before the run, so the borders can be written into the id up front.

## Folder layout

Verified against `@moku-labs/game` 0.12 `scan/keys.ts` and `scan/pack/groups.ts`. A folder of more
than about 8 files is grouped by kind. A folder of 3 files or fewer stays flat.

| Folder | Holds |
|---|---|
| `fonts/` | the `.fnt` and its `.png` pages |
| `buttons/` | buttons |
| `panels/` | 9-slice frames |
| `icons/` | icons |
| `fx/` | effects, one folder per animation |
| `decor/` | decoration |
| `sounds/` | sound effects |
| `music/` | music |
| `items/` | a family of game objects; name the folder after the family |
| `backgrounds/` | backgrounds, when there are several |

- The folder names the kind, so the file drops the prefix: `icons/coin.webp` (key
  `ui.icons.coin`), not `icon-coin.webp`.
- Animation frames share one folder named after the animation: `fx/coin-spin/0.webp` ...
  `fx/coin-spin/6.webp` (keys `ui.fx.coin-spin.0` ... `ui.fx.coin-spin.6`).
- The `fx/` folder needs game 0.12 or later. The packer puts the textures a particle emitter uses
  on one atlas page, the group `fx`. Before 0.12 only a file stem that starts with `fx-` went there,
  so on game 0.11 and older keep `fx-spark.webp` flat. From 0.12 everything under an `fx` folder
  goes there too, whatever its size, the frames of `fx/coin-spin/` included.
- A font's `.fnt` names its page PNG inside (`<page id="0" file="body.png" />`). Rename the PNG,
  then fix that line. The font licence is not a key. It sits beside `assets/`
  (`shared/LICENSE-fonts.txt`), as the template does.
- The text styles read `ui.font-body` and `ui.font-digits` by default. A font moved into `fonts/`
  is named in the game's `pluginConfigs`: `text: { fonts: { body: "ui.fonts.body" } }`.
- `ASSETS.md` stays at the root of `assets/`.
- Moving a file renames its key. Run `bun run keys`, then the typecheck. It finds every stale key.

The shared layer of a merge game, before and after:

```
# before: 20 files in one folder
shared/assets/
  ASSETS.md  font-body.fnt  font-body.png
  button-green{nine=12,12,12,12}.png  button-red{nine=12,12,12,12}.png
  panel-wood{nine=48}.png  panel-paper{nine=40}.png
  icon-coin.webp  icon-gear.webp  icon-star.webp
  fx-coin-spin-0.webp ... fx-coin-spin-6.webp
  decor-leaf.webp  decor-vine.webp
  sound-click.mp3  sound-merge.mp3  music-theme.mp3

# after
shared/assets/
  ASSETS.md
  fonts/      body.fnt  body.png                         ui.fonts.body
  buttons/    green{nine=12,12,12,12}.png  red{...}.png  ui.buttons.green
  panels/     wood{nine=48}.png  paper{nine=40}.png      ui.panels.wood
  icons/      coin.webp  gear.webp  star.webp            ui.icons.coin
  fx/coin-spin/  0.webp ... 6.webp                       ui.fx.coin-spin.0
  decor/      leaf.webp  vine.webp                       ui.decor.leaf
  sounds/     click.mp3  merge.mp3                       ui.sounds.click
  music/      theme.mp3                                  ui.music.theme
```

With moku-ai the id carries the folder: `id: icons/coin`, `id: fx/coin-spin/0`. `--flat` keeps it.

## One build file per feature

Put the build file next to the feature, `features/<f>/assets.moku.yaml`, with `name: <f>`. The
shared layer of a shell game has `shared/assets.moku.yaml` with `name: ui`. Ids carry no feature
prefix: the export lands inside the `assets/` folder. Ids carry the kind folder: `buttons/green`.

```yaml
# shared/assets.moku.yaml
# yaml-language-server: $schema=../.moku/build.schema.json
version: 1
name: ui
defaults: { provider: fal }
items:
  # 1. The raw picture. Under raw/ so it is easy to delete after export.
  - id: raw/buttons/green
    task: image
    input:
      prompt: >
        Game UI asset for a cozy forest merge game. One horizontal rounded wooden button,
        moss green face, dark-brown ink outline, flat cel shading. Designed for 9-slice:
        straight middle edges, plain stretchable center, fixed rounded corners. No text.
      aspect: "1:1"
      refs: [{ $file: ../refs/style-sheet.png }]
    params: { background: transparent }          # gpt-image-2.5 only; sends png

  # 2. The sprite: trim, resize to the final size, nine-slice borders in the id.
  - id: "buttons/green{nine=12,12,12,12}"
    task: sprite
    input:
      source: { $ref: raw/buttons/green }
      model: none                                # source is already transparent: $0, no call
      size: { width: 128, height: 64 }
      padding: 2

  # 3. A sound effect, mp3.
  - id: sounds/click
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
straight at the `assets/` folder:

```bash
moku validate "features/*/assets.moku.yaml"
moku estimate "features/*/assets.moku.yaml"
# tell the user the total, wait for a yes
moku run shared/assets.moku.yaml --max-cost 0.10 --flat --out shared/assets
rm -rf shared/assets/raw        # every done item is exported, the raw images too
bun run keys
```

Result: `shared/assets/buttons/green{nine=12,12,12,12}.png` (key `ui.buttons.green`) and
`shared/assets/sounds/click.mp3` (key `ui.sounds.click`). Without `--flat` the export writes
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
borders unchanged. A texture with a side above 512 px stays loose, unless it is in the `fx` group.
Nothing to do in moku-ai for atlases: generate single sprites, let the game pack them.

## Gaps in @moku-labs/ai for game art, and what to do

| Gap | Fact | What to do |
|---|---|---|
| No "intermediate" flag on an item | Export writes every `done` item, also a raw image that only feeds a `sprite` | Put raw items under `raw/` and `rm -rf <assets>/raw` after export. |
| No sprite-sheet or animation task | One sprite per item. An ark group (`params.images: N`) is one item; a `$ref` to it is the first output only, so a `sprite` cannot cut frames 2..N | One `image` + one `sprite` item per frame with a shared ref (`fx/coin-spin/0` ... `fx/coin-spin/6`). The game packer builds the atlas. |
| Nine-slice hint is the four-number form only | `buildfile/schema.ts` | Write `{nine=N,N,N,N}`; the game reads it the same as `{nine=N}`. |
| Ids with `.` break the game scan | `scan/keys.ts`; moku-ai accepts them | Use `-` and `/`. |
| sfx and `birefnet` prices are estimates | ElevenLabs bills credits, fal bills BiRefNet per second | `priceOverrides` with the plan's real rate. |
| sfx and sprite not proven against the live APIs | Upstream tests mock ElevenLabs and fal | First paid run with a small `--max-cost`; check one file by ear and eye. |
| No account pools | One key per provider (`apiKeyEnv`) | One account per provider, or a custom provider plugin. |
| No 3D | No task | Out of scope. |
| No bitmap fonts | No task | `msdf-bmfont-xml` from a licensed TTF, as in merge-game. |

## Provenance note

Every `assets/` folder, of a feature or a layer, gets an `ASSETS.md` at its root, never in a kind
folder. It says where each file came from, as in
`tests/integration/merge-game/features/ui/assets/ASSETS.md` of the game repository. The shape:

```markdown
# Assets of <game>

Where every art file and sound of this feature came from. A 9-slice piece carries its insets in
the file name as `{nine=left,top,right,bottom}` in texture px; the key drops the tag.

## Art

- Source: @moku-labs/ai 0.16.1, build file `shared/assets.moku.yaml`, provider `fal`,
  model `gpt-image-2.5` with a transparent background, cut by the `sprite` task (`none`),
  run on 2026-10-04.
- Style reference: `refs/style-sheet.png` (drawn by Astra, 2026-09-22).

### `ui.buttons.green`

- File: `shared/assets/buttons/green{nine=12,12,12,12}.png`, 128 × 64 px.
- Raw image: `raw/buttons/green`, 1024 × 1024 px, $0.05. Sprite: `none`, padding 2, $0.
- Prompt:

  > Game UI asset for a cozy forest merge game. One horizontal rounded wooden button ...

## Sounds

| Key | File | Source | Licence |
|---|---|---|---|
| `ui.sounds.click` | `shared/assets/sounds/click.mp3` | @moku-labs/ai, `sfx` elevenlabs `eleven_text_to_sound_v2`, 600 ms, 2026-10-04 | provider terms |
| `ui.music.theme` | `shared/assets/music/theme.mp3` | Kenney, Music Loops, `Farm Frolics.ogg`, CC0 1.0 | CC0 |
```

For each file: the final path with its size and nine-slice borders, the raw item and its cost, the
sprite options, the provider and model, the date, and the exact prompt copied from the build file.
The journal (`.moku/journal.db`) keeps no prompts, so the build file and this note are the only
record. The `moku run` box prints each file's cost; copy it.

## Checklist

1. `features/<f>/assets.moku.yaml` with `name: <f>` (the shared layer: `shared/assets.moku.yaml`,
   `name: ui`), ids without `.` and without the feature prefix, ids in kind folders by the
   "Folder layout" rule, raw images under `raw/`.
2. Images: `params.background: transparent` on fal `gpt-image-2.5`, then a `sprite` item
   (`none`); other sources go through `sprite` with `birefnet`. Final `size` and the
   `{nine=l,t,r,b}` id hint on the sprite.
3. Sounds: `sfx` items with `durationMs`; music on fal; everything lands as mp3.
4. `moku validate`, `moku estimate`, tell the total, wait for a yes.
5. `moku run <file> --max-cost <n> --flat --out features/<f>/assets`, then
   `rm -rf features/<f>/assets/raw`.
6. `bun run keys`.
7. Write or update `ASSETS.md` at the root of the `assets/` folder.
8. Commit the assets and the note. Not `.moku/`, `out/` or `.env.local`.
