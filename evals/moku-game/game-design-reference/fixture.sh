#!/usr/bin/env bash
# A game with an approved design: an HTML prototype at a 390-wide frame and a design context with the
# Measurement reference table. Astra also drew a picture of the board, and its numbers differ on purpose.
set -euo pipefail
git init -q -b main .
D=.planning/design/board
mkdir -p "$D/art" features/match
printf '{ "name": "tiles", "type": "module", "dependencies": { "@moku-labs/game": "0.13.0" }, "devDependencies": { "@moku-labs/editor": "0.9.3" } }\n' > package.json
printf 'type: game\nname: tiles\n' > .planning/moku.md
cat > "$D/index.html" <<'HTML'
<!doctype html>
<html><head><meta charset="utf-8"><link rel="stylesheet" href="styles.css"></head>
<body><div class="phone"><div class="tray"><div class="tile"></div></div><button class="play">Play</button></div></body></html>
HTML
cat > "$D/styles.scss" <<'CSS'
.phone { position: relative; width: 390px; height: 693px; }
.tray  { position: absolute; left: 41px; top: 194px; width: 308px; height: 308px; border-radius: 26px; }
.tile  { width: 100px; height: 100px; border-radius: 18px; }
.play  { position: absolute; left: 95px; top: 540px; width: 200px; height: 70px; font: 700 38px Fredoka; }
CSS
cat > "$D/design-context.md" <<'MD'
# Tiles — Design Context

## 0. How to use this document — spec, not source

**The numbers are the spec.** The code is not copied; the measurements are. The approved prototype is the
single source of truth for layout and measurements. A generated image is an art asset or a style
reference. It is never a reference for layout, sizes or positions.

**Files in this folder**
| File | What it is |
|------|-----------|
| `index.html` | The prototype. The source of truth for behaviour, layout and measurements. |
| `styles.scss` | The exact sizes, positions, radii and shadows. |
| `art/board.png` | Astra's concept image of the board. Style reference. Not a reference for layout or sizes. |

## 5. Layout & page behaviour

**Measurement reference**
| Field | Value |
|---|---|
| Prototype | `.planning/design/board/index.html` and `styles.scss` |
| Prototype frame | 390×693 CSS px |
| Target units | game reference units, 1080×1920 |
| Conversion | game units = prototype px × 1080 / 390 |
| Art | `art/board.png`: style reference only |
MD
# A stand-in for the picture, with the numbers a careless reader would take from it.
printf 'board.png: a 1024x1536 concept image. In it the tray is about 620 px wide and starts 300 px from the top.\n' > "$D/art/board.txt"
: > "$D/art/board.png"
git add -A
git -c user.name=eval -c user.email=eval@example.test commit -q -m init
