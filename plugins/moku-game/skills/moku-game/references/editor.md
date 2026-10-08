# The editor from Claude's browser pane

How Claude runs `@moku-labs/editor@0.9.0` beside a game on `@moku-labs/game@0.12.0` in the chat pane, reads the live game and takes pictures. Synced to the 0.9.0 `llms.txt` and `llms-full.txt`; the start in section 1 was run on a fresh scaffold. When a detail differs from the installed editor, its `README.md` and `llms.txt` win. The
tools page is built for this: decision D-26 makes the Claude pane at 480 px (one third) or 720 px (half)
the first-class viewport.

## 1. Start the dev server in the background

The game's `editor` script is the editor bin: `moku-editor --root .`. A game has no HTML file: the bin asks
the engine for the dev page (`preparePage` of `@moku-labs/game/cli`) with the page agent
`@moku-labs/editor/agent/page` on it, and serves it under `.moku/bunfig.toml`. The game is on `/` with
Bun hot reload on (`--no-hmr` turns it off), the tools page on `/__editor/`, and the game's files as
static (manifest, art, sounds; dot folders and `node_modules` refused). `--port 0` takes a free port.
Bun only. It binds `127.0.0.1` only. The game's `dev` script, `moku-game dev`, serves the same page
without the agent and without the tools page.

The startup lines name the project index: `files:project-on {"files":…}` is good. `files:project-off`
with `parseConfigFileTextToJson is not a function` means TypeScript 7: the index needs the JS API of
TypeScript 6 (`hello-world.md` → Install). Without the index a pick has no `file:line`.

Preferred: `.claude/launch.json` plus `mcp__Claude_Browser__preview_start`, which starts the server and
opens the pane in one step.

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "game-editor",
      "runtimeExecutable": "bun",
      "runtimeArgs": ["run", "editor"],
      "port": 3000,
      "url": "http://127.0.0.1:3000"
    }
  ]
}
```

Then `preview_start({ name: "game-editor" })` and `navigate({ url: "http://127.0.0.1:3000/__editor/" })`.
Read the server output with `preview_logs` when the page does not come up. Without `launch.json`, run
`bun run editor` with the Bash tool in the background and `preview_start({ url: "http://127.0.0.1:3000/__editor/" })`.

The game page alone (no tools) is `http://127.0.0.1:3000/`. Both are the same origin, so the game iframe
inside the tools page is reachable from page scripts. `http://127.0.0.1:3000/?player=<name>` opens the
game on the scenario `tests/scenarios/<name>.ts`, on a fresh memory save.

## 2. Size the pane

```
resize_window({ width: 480, height: 900 })   // one third beside the chat (D-26)
resize_window({ width: 720, height: 900 })   // one half
resize_window({ preset: "desktop" })         // back to the pane's own size when done
```

At 480 the rail collapses and side panels overlay; at 720 they dock. Below 900 px the top bar is compact:
Pause, Step, Reference mode and Hot reload are icons, the rest sits in the ⋯ menu (`data-action="more"`).
The game iframe follows the device of the Game workspace: 21 presets, the iPhone 18 Pro by default.

## 3. Find your way on the tools page

| Key | Action |
|---|---|
| ⌘1–⌘6 (or `1`–`6`) | Game · Flow · Render · State · Files · Console. Game is the default |
| ⌘K | Palette: "Select element", "Take a screenshot", "Record a series…", "Overlay in game", "Device: …", "Density: …", "Reload" |
| `P` | Pause / resume the game |
| `.` | Step one frame, only while paused |
| `O` | Overlay in game on / off |
| `G` | Show / hide the preview of the current workspace |
| `R` | Reference mode on / off |
| `H` | Hot reload switch: restarts the bin's server with hot reload flipped (see section 4) |
| `M` | Sound, in Game. Runs `game.mute`: works with game ≥0.4.4, dimmed on an older game |
| ⌘⇧C | Element picker (Game workspace) |
| ← → `b` | Previous / next shot, mark a bug, while the contact sheet is open |
| Esc | Closes one thing, outermost first |

Keys go to the game while its iframe has focus. A click on the device stage gives the game the keys; a
click outside the device returns them.

The link pill in the top bar goes `connecting` → `live · frame N` once the game page's bridge said
`hello`. `paused` while the game is paused, `silent` after 6 s without a heartbeat, `lost` with a retry
countdown, `empty` when no game page is open. Prefer `read_page` and `find` over screenshots to read
State, Console and the Element tab: they are plain DOM.

**Pick an element.** Click "Select element" (or ⌘⇧C), then click the element on the stage. The Element tab
shows its path, bounds, style, the Code section (JSX and `defineStyle` block with `file:line`) and the
reference block. The pick also bookmarks the game and writes three files to today's folder
`.moku/captures/<yyyy-mm-dd>/`: the crop `<key>-f<frame>-crop.jpg` (the element plus 8 px), the frame
`f<frame>-full.jpg` and the card `<key>-f<frame>.md`. Read the card with the Read tool: it is the whole
reference, ready for a fix. Older captures sit flat in `.moku/captures/`; they stay.

```text
@moku tapLabel · text · main/home · f58
path: helloScreen/tap/tapLabel
source: features/hello/views/hello-screen.tsx:22
layout: tap < helloScreen (column, gap 48)
bounds: 182,462 37×15 px · ref 490,1242 100×40
state: visible
flow: home
game: hello-game 0.1.0 · s-185e · f58 · 23:52:56 · live · clean
device: iPhone 18 Pro 402×874 portrait · dpr 3 · safe 62/0/34/0
restore: bookmark tapLabel-f57
shot: .moku/captures/2026-10-08/tapLabel-f58-crop.jpg · frame: .moku/captures/2026-10-08/f58-full.jpg
```

The pick also copies one line for the chat,
`@moku <name> <type> · <flow/node> · <file:line> · ref <x>,<y> <w>×<h> · <card path>`. In Claude's pane
the clipboard write fails (toast "Copy failed", console warn `gameView: copy reference failed`). Not a
finding: the card file and the Element tab hold the same text. When the user pastes such a line, open the
card it names; `<name>` is the element key for `doors.sources.locate`.

**Reference mode** (`R`) lays invisible `data-moku-*` proxies over the game elements, so `read_page` and
`find` see them by name. A click on a proxy is a pick. A drag of 4 px or more picks an area and writes
`area-f<frame>.md`: the elements inside it, each with its child tree, text and bounds. The game gets no
input while it is on.

## 4. Read and drive the game by script

The tools page exposes **no global**. The game page does: `globalThis.game` (the app), `globalThis.doors`
(`{ read, watch, sources, run, commands }`), `globalThis.system` (the system app, or `undefined`) and,
under the editor bin, `globalThis.editor` (the agent app). Reach them through the one game iframe, `iframe[data-game-frame]`, which is same-origin.
Use `mcp__Claude_Browser__javascript_tool` on the tools page:

```js
// the handles of the embedded game page
const w = document.querySelector("iframe[data-game-frame]").contentWindow;
const { game, doors } = w;

// where the graph is and what the gate waits for
doors.read(game, doors.sources.position);          // { path: "home", flow: "main", node: "home", waiting: ["tap"] }
doors.read(game, doors.sources.model).player;      // the committed player tree
doors.read(game, doors.sources.ui);                // the live screen as plain data
doors.read(game, doors.sources.locate, { key: "tap" });  // { x, y, w, h } in CSS px of the game page
doors.read(game, doors.sources.locate, { target: { projection: "board.items", key: "i1" } }); // a view
doors.read(game, doors.sources.at, { x: 200, y: 450 });  // [{ entity, owner, key, layer }] under a page point
doors.read(game, doors.sources.explain, { entity: 12 }); // { id, owner, key, components, skipped, motions }
doors.read(game, doors.sources.schema);                  // every component and tag with its field kinds
doors.read(game, doors.sources.diff, { from: 100, to: 110 }); // world changes between two frames, dev only
doors.read(game, doors.sources.render);            // { fps, frameMs, textures, textureMb, views, pooled, renderPasses, drawCalls }
doors.read(game, doors.sources.log, { level: "warn" });

// play, like a player would (effect "route"; the session stays clean)
await doors.run(game, doors.commands.tap, { key: "tap" });
await doors.run(game, doors.commands.answer, { intent: "openSettings" });
await doors.run(game, doors.commands.drag, { from: { projection: "board.items", key: "i1" }, to: { projection: "board.items", key: "i2" } });
await doors.run(game, doors.commands.walk, { route: [{ at: "home", intent: "tap" }] });
await doors.run(game, doors.commands.trace, { path: [{ projection: "grid", key: "c1" }, { projection: "grid", key: "c2" }] });

// time
await doors.run(game, doors.commands.pause);
await doors.run(game, doors.commands.step, { frames: 10 });   // 1000/60 ms each
await doors.run(game, doors.commands.resume);
await doors.run(game, doors.commands.timeScale, { scale: 0.25 }); // slow motion; 1 is normal

// bookmark, restore (restore is "raw": it taints the session and is journaled)
const { value: mark } = await doors.run(game, doors.commands.bookmark);
await doors.run(game, doors.commands.restore, { bookmark: mark });
doors.read(game, doors.sources.tainted);           // true

// one picture of the canvas (dev build only): { png } since 0.4.0, png a data URL
(await doors.run(game, doors.commands.capture)).value.png.slice(0, 40);      // "data:image/png;base64,…"
(await doors.run(game, doors.commands.capture, { legend: true })).value.legend; // [{ n, projection, key, rect }]
await doors.run(game, doors.commands.capture, { layers: ["ui"] });            // only these layers
await doors.run(game, doors.commands.capture, { sheet: { frames: 6, everyMs: 100 } }); // contact sheet
await doors.run(game, doors.commands.capture, { diff: mark });                // red where now differs from the bookmark
```

Every `run` resolves `{ value, state: { path, frame, tainted } }`. Keep the returned objects small in
the tool result: read `.value.path`, lengths and slices, not whole trees.

`tap` and `answer` resolve when the input is delivered. The route commits on a later frame. Read the
model after a short wait, or use `walk`, which resolves after the commit.

The capture is a PNG with a transparent background: the page colour is CSS, not canvas. Flatten it
before you look at it, for example `magick shot.png -background '#10161d' -flatten shot-flat.png`.
A `diff` capture restores a bookmark and journals itself as a raw write, so it taints the session.

**A picture on disk.** A data URL is too big for a tool result. Let the tools page write it: click the
Shot button (`find("Take a screenshot")`, then `computer` `left_click` on its ref). It runs
`editor.capture` and writes `.moku/captures/<yyyy-mm-dd>/<hhmm>-<flow>.jpg` (`-2`, `-3` … when taken)
through the server's `files` sandbox; the capture card names the path. Read it. `editor.capture` answers
a JPEG at quality 0.8 by default; `{ format: "png" }` asks for the lossless picture.
For `legend`, `layers`, `sheet` or `diff`, call `doors.commands.capture` and keep only lengths and
`legend` in the tool result.

When the page set `globalThis.editor`, the agent's in-process channel runs the editor commands:

```js
const { editor } = w;
(await editor.channel.run("editor.capture")).value;        // { image: "data:image/jpeg;base64,…", frame, device: { w, h, orientation } }
(await editor.channel.run("editor.capture", { key: "tap", maxWidth: 540 })).value; // one element plus 8 px, shrunk in the page
(await editor.channel.run("editor.sheet", { frames: 6, everyMs: 100 })).value;     // a contact sheet from one game.capture
(await editor.channel.run("editor.series", { durationMs: 2000, intervalMs: 100 })).value.shots.length; // 20
await editor.channel.run("editor.seriesStop");
editor.channel.status();                                   // LinkStatus
await editor.channel.read("game.locate", { key: "tap" });  // every door source by id, through the channel
```

**Hot reload.** The bin serves with Bun hot reload on. A save of a game source, by the Files workspace or
by Claude's Edit tool, makes Bun reload the game page. The bridge keeps a `game.bookmark` in
`sessionStorage` before and restores it after, and the tools page toasts "Game reloaded · state
restored". The game comes back where it was, with a new session id, frame counting from 0 and
`tainted: true`. It takes about a second. With `--no-hmr` (or a game's own server) a save in Files still
keeps the state: the editor bookmarks, reloads the frame and restores (D-07). The Hot reload switch (`H`)
turns it off and on while the bin runs: Bun cannot change it on a running server, so the bin restarts its
server on the same port, every socket drops for about a second, and the game frame reloads with its
checkpoint. A failed switch says to restart the bin with or without `--no-hmr`. From a script,
`w.location.reload()` reloads the game page without the restore. Wait for the pill to say `live` again
after any reload.

**Hot swap.** A save of a view file does not reload at all: the engine's hot plugin swaps the module in
the running page, the session stays the same, and the tools page toasts "Game updated". View files are
`.tsx`, `styles.ts`, `view.ts`, `animations.ts`, `effects.ts`, the generated strings, and any `.ts`
directly in `styles/`, `motion/`, `effects/`, `views/`, `world/projections/` or `world/layout/`. A logic
file (a node, a rule, `state.ts`, a feature `index.ts`) still reloads and restores. The editor's
`llms.txt` gives its own numbers on the merge game: about 30 ms from save to the updated frame for a
swap, about 0.8 s for a reload with restore.

## 5. Captures on disk

Only a user action, a pick, a palette item or a `gameView` api call writes a picture; nothing captures on
its own.

Every capture goes to today's folder, `.moku/captures/<yyyy-mm-dd>/` (local date).

- The Shot button of the Game workspace, or palette → "Take a screenshot": one JPEG at
  `<day>/<hhmm>-<flow>.jpg`, written through the server's `files` sandbox (only `.moku/captures/` takes
  binary writes).
- A pick: `<day>/<key>-f<frame>-crop.jpg` (the element plus 8 px), `<day>/f<frame>-full.jpg` and the card
  `<day>/<key>-f<frame>.md`. An area drag in Reference mode writes `<day>/area-f<frame>.md`.
- Palette → "Record a series…": pick a duration (1 s … 20 s) and an interval (16 … 1000 ms). The result is
  `<day>/series-<hhmm>/` with numbered PNGs plus `index.json` (`{ label, durationMs, intervalMs, fromFrame,
  shots: [{ file, frame, atMs, bug }], device, stoppedEarly }`), and the contact sheet opens.
- Claude's own `computer({ action: "screenshot" })` of the pane is the quickest proof for a report; it
  shows the tools page, not the raw canvas.

A PNG of the canvas (a `game.capture`, a series frame) has a transparent background: the page colour is
CSS, not canvas. Flatten it before you look at it, for example `magick shot.png -background '#10161d'
-flatten shot-flat.png`. A `diff` capture restores a bookmark and journals itself as a raw write, so it
taints the session.

Turn a series into a video with ffmpeg (frame rate = 1000 / intervalMs):

```sh
ffmpeg -y -framerate 10 -pattern_type glob -i '.moku/captures/<yyyy-mm-dd>/series-<hhmm>/*.png' \
  -c:v libx264 -pix_fmt yuv420p -vf 'scale=trunc(iw/2)*2:trunc(ih/2)*2' .planning/e2e/game/<name>.mp4
```

`.moku/` is local state. Copy the shots a report cites into `.planning/e2e/game/`.

## 6. What the editor can and cannot do yet

- **MCP.** `moku-editor mcp` is a stdio MCP server: `claude mcp add moku-editor -- bunx moku-editor mcp
  --port 3000` (no HTML file for a shell game; `bunx moku-editor mcp-config --port 3000` prints the
  `.mcp.json`). It uses the running bin or starts one, and lists 17 `moku_*` tools (`moku_status`,
  `moku_read`, `moku_run`, `moku_wait`, `moku_screenshot`, `moku_series`, `moku_reference`,
  `moku_selection`, `moku_select`, `moku_files_read`, `moku_files_write`, `moku_reload` and the rest)
  plus one tool per command door (`game_tap`, `cheat_…`, `raw_game_restore`). Pictures need the game
  page visible: a paused or hidden game answers `isError`. Without it, Claude uses the same catalogue through `javascript_tool`: list it with
  `Object.values(doors.sources).map(s => [s.id, s.input])` and
  `Object.values(doors.commands).map(c => [c.id, c.input, c.effect])`, then call `doors.read` or
  `doors.run` with the input the schema names. A game's own `.dev.ts` sources and commands appear the
  same way: the editor's page imports every `**/*.dev.ts` and hands them to the agent.
- **Editor specs of a game.** `moku-editor e2e -c <playwright config> [playwright args…]` (0.9) runs a
  game's Playwright specs against the editor: one Playwright process, so one fresh editor bin, per
  project, each on its own `PORT` (`PORT`, else 4417, plus the project's index). It exists because of the
  Bun crash in the last bullet. An explicit `--project` or `--list` runs once as given.
- **Not installed is not a failure.** A game without `audioPlugin` or `effectsPlugin` has no
  `game.sounds` / `game.effects`. The registry lists them `available: false`, logs
  `registry:source-unavailable` at level info, and Render says "Effects not installed in this game".
- **Sound switch needs game ≥0.4.4 and `audioPlugin`.** Sound (`M`) runs `game.mute { muted }`, which game
  0.4.4 ships. On an older game it stays dimmed. The registry does not probe commands, so in a game
  without `audioPlugin` (the hello world) the switch is lit and a press toasts
  "Sound switch failed · [game] The command game.mute needs audioPlugin." Not a finding. Check the flag
  with `doors.read(game, doors.sources.audioMuted)`.
- **The hub is loopback only** (`127.0.0.1`, Host + Origin + token). A phone or a simulator cannot connect
  its game page to the tools page. See `device.md`.
- **Hidden pane: the game stays paused.** While the pane is hidden the game page is
  `visibilityState: hidden` and the game holds its own pause reason `"background"`. The pill says
  `Paused` and the canvas does not redraw. `game.resume` answers `true`, but the game stays paused: it only
  pops `"devtools"`. Show the pane, then resume. Without the pane, `game.step { frames }` still advances
  the game, so step a few frames before a Shot. Not a finding.
- **Bun dev reload can break.** After many files change at once the game page can show Bun's "Failed to
  load bundled module './main.ts'", and a reload does not fix it. Bun 1.3.14 can also crash the dev
  server after many hot reloads in a row (known to the editor team). Restart `bun run editor`, then reload the
  tools page. `navigate` to the same URL with only a new `#hash` does not reload; use `location.reload()`.
