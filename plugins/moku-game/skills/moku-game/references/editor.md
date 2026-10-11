# The editor from Claude's browser pane

How Claude runs `@moku-labs/editor@0.10.10` beside a game on `@moku-labs/game@0.14.12` in the chat pane, reads the live game and takes pictures. Synced to the 0.9.0 `llms.txt` and `llms-full.txt`, and to the changes of 0.9.1 to 0.10.10; the start in section 1 was run on the template scaffold with editor 0.10.10 and game 0.14.12 (the bin started, both pages answered, no browser opened them). The tools page of 0.10.9 and later was not opened: what this file says about its new controls is read from the editor's source and docs. When a detail differs from the installed editor, its `README.md` and `llms.txt` win. The
tools page is built for this: decision D-26 makes the Claude pane at 480 px (one third) or 720 px (half)
the first-class viewport.

## 0. Two ways in, one editor

The editor is the working mode of a game session (`SKILL.md` → "The editor is the working mode"). The
first way to read and drive the game is the MCP server `moku-editor`, registered by the game's
`.mcp.json`: `moku_status` first, then `moku_read`, `moku_wait`, `moku_run`, `moku_screenshot`,
`moku_series`, `moku_selection`, `moku_select`, `moku_device`, `moku_show`, `moku_files_find`, `moku_project`,
`moku_reload` and one tool per command door (`game_tap`).
The tool list is in §6 and in `plugin-index.md` → "MCP for Claude Code". The browser pane of this file is
for the person to watch and point, and it is the way to read and drive by script (§4) when the MCP server
is not connected. Both use one running bin: start it once (§1), the bridge finds it through
`.moku/editor.json`.

## 1. Start the dev server in the background

The game's `editor` script is the editor bin: `moku-editor --root .`. A game has no HTML file: the bin asks
the engine for the dev page (`preparePage` of `@moku-labs/game/cli`) with the page agent
`@moku-labs/editor/agent/page` on it, starts the engine's keys watch (`watchKeys`, since editor 0.9.5), and
serves it under `.moku/bunfig.toml`. So `generated/` is fresh before the page is served, and a saved asset
or strings file is scanned again: the log prints `› keys: <path>`. The game is on `/` with
Bun hot reload on (`--no-hmr` turns it off), the tools page on `/__editor/`, and the game's files as
static (manifest, art, sounds; dot folders and `node_modules` refused), answered with `Cache-Control:
no-store`. `--port 0` takes a free port.
Bun ≥1.4.2 only. The game must be `@moku-labs/game` 0.13.1 or later: on an older one the bin stops with
`install @moku-labs/game >=0.13.1 in the game`. It binds `127.0.0.1` only. The game's `dev` script, `moku-game dev`, serves the same page
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
Pause, Step and Hot reload are icons, the rest sits in the ⋯ menu (`data-action="more"`). The bar starts
with the game mark: the initials of the game name on a small tile (`span[data-mark]`).
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
| `H` | Hot reload switch: restarts the bin's server with hot reload flipped (see section 4) |
| `M` | Sound, in Game. Runs `game.mute`: works with game ≥0.4.4, dimmed on an older game |
| ⌘⇧C or `I` | Element picker: the Select icon button of the Game toolbar |
| ← → `b` | Previous / next shot, mark a bug, while the contact sheet is open |
| Esc | Closes one thing, outermost first |

Keys go to the game while its iframe has focus. A click on the device stage gives the game the keys; a
click outside the device returns them.

The link pill in the top bar goes `connecting` → `live · frame N` once the game page's bridge said
`hello`. `paused` while the game is paused, `silent` after 6 s without a heartbeat, `lost` with a retry
countdown, `empty` when no game page is open. Prefer `read_page` and `find` over screenshots to read
State, Console and the Element tab: they are plain DOM.

**Pick an element.** Click the Select icon button of the Game toolbar (`button[data-part="pick"]`, or
⌘⇧C, or `I`), then click the element on the stage. The picker is the one way to pick. The Element tab
shows its path, bounds, the Styles fields and the Code section (JSX and `defineStyle` block with
`file:line`). It does not show the reference block: that is in the card file. Its footer has "Copy
reference" and "Show in render tree". The pick also bookmarks the game and writes three files to today's folder
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

**The Copy Ref switch** (editor 0.10.9) sits in the Game toolbar after Safe area and Sound
(`[data-game=toolbar] [data-part=copy-on-select]`). It is the preference "Copy reference on select", on by
default and saved with the others. On: a pick writes the bookmark, the two pictures and the card, and
copies the line. Off: a pick only selects the element for the Element tab. No file, no capture card, no
clipboard, and a drag picks nothing. "Copy reference" in the Element tab writes the card either way.
`moku_select` does not ask the preference: it writes the card unless `card: false`. Before you rely on a
card after the person's pick, check that the switch is on.

**An area.** With the picker on, a drag of 4 px or more picks an area and writes `area-f<frame>.md`: the
elements inside it, each with its child tree, text and bounds. `moku_select { rect }` does the same.

**Reference mode is gone** (editor 0.10.9): key `R`, its toggle in the top bar, the palette command and
the `data-moku-*` proxies over the game. `read_page` and `find` do not see game elements any more. The
editor gives no replacement for the proxies. Read the elements as data instead: `moku_read` `game.ui`
for the tree with keys, `game.locate { key }` for a rect, `moku_select { key }` to pick one by name.

**Pending style edits** (editor 0.10.9). The Styles rows of the Element tab are fields. A value the
person changes there is a pending edit. The editor writes no file and sends no command, so the game does
not change. The edits reach you in two ways: `moku_selection` answers them as `edits`, `{ path, from,
to }` each, and "Copy for agent" in the tab puts a text block on the clipboard.

```text
@moku homePlay · features/stage/views/home-screen.tsx:199
minWidth: 556 -> 600
padding.top: 25 -> 30
```

Write the `to` values into the source at the `file:line` of the selection. An edit leaves the tab by
itself when a scene snapshot shows its `to` value. For a `text` given a text style key the tab also has
a "Text style · <key>" section with the fields of that key's `defineTextStyles` block (it needs game
0.14.11, which reports `textStyle` on the node). Such an edit belongs to the key, not to the node. In
`edits` its path is `textStyle:<key>#<field>`, for example `textStyle:ui.button#size`; in the copied
text it is a block of its own, `@moku textStyle ui.button · shared/styles/text.ts:88`. Write it into the
text styles file.

The Flow Inspector has two tabs, Info and Code. Its Styles tab left in 0.10.9 with the palette group
"Styles". Nothing in the editor writes a style into a file now: edit the file, or apply the pending edits.

## 4. Read and drive the game by script

With the MCP server connected, the same reads are `moku_read { id: "game.position" }` and the same
commands are the door tools or `moku_run`; prefer them. The script way below is the fallback, and the way
to reach what no door covers.

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
`tainted: true`. It takes about a second. A popup that was open comes back open (game 0.13.3): the
bookmark names the node that waits for the popup's answer, and that node runs again from its start. The
game is paused again only when the developer had paused it (editor 0.10.4): a pause from a hidden pane is
not kept. `editor.clock` (the door tool `editor_clock`) answers `{ frame, paused, held, reasons }`; `held`
is the developer's pause. With `--no-hmr` (or a game's own server) a save in Files still
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
file (a node, a rule, `state.ts`, a feature `index.ts`) still reloads and restores. A saved
`strings/<locale>.json` swaps too: the keys watch writes the generated file. An asset file saved with new
bytes swaps in the loaded bundles (game 0.13.2); a new, removed or renamed asset file reloads the page. The editor's
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
  `<day>/<key>-f<frame>.md`. An area drag of the picker writes `<day>/area-f<frame>.md`. Both only while
  the Copy Ref switch is on.
- Palette → "Record a series…": pick a duration (1 s … 20 s) and an interval (16 … 1000 ms). The result is
  `<day>/series-<hhmm>/` with numbered PNGs plus `index.json` (`{ label, durationMs, intervalMs, fromFrame,
  shots: [{ file, frame, atMs, bug }], device, stoppedEarly }`). Since editor 0.10.9 a series ends like a
  Shot: the capture card of its first shot and the toast "✓ N shots saved". The contact sheet opens only
  on request: "Open contact sheet" in Files, or Open on the series card.
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
  `.mcp.json`). It uses the running bin or starts one, and lists 22 `moku_*` tools (`moku_status`,
  `moku_read`, `moku_run`, `moku_wait`, `moku_screenshot`, `moku_series`, `moku_reference`,
  `moku_selection`, `moku_select`, `moku_files_read`, `moku_files_write`, `moku_reload` and the rest)
  plus one tool per command door (`game_tap`, `cheat_…`, `raw_game_restore`). Since 0.10.3:
  `moku_device { preset?, orientation?, folded? }` reads or sets the device and answers the game viewport
  `w` × `h`; `moku_show { workspace? }` reads or switches the workspace (`flow`, `game`, `render`, `state`,
  `files`, `console`); `moku_select { node }` focuses a node in Flow and answers its files and lines;
  `moku_files_find { key }` answers where a project-index key lives (`node:main/home`, `jsx:tap`);
  `moku_project { path?, prefix? }` reads the project index; `moku_hot_reload { on }` switches Bun hot
  reload, returns once the bin is back (at most 15 s), and wants a `moku_reload` after it. `moku_select`,
  `moku_device` and `moku_show` need the tools page open. The door tools stay over a restart of the bin
  (0.10.0). Pictures need the game
  page visible: a paused or hidden game answers `isError`. Without it, Claude uses the same catalogue through `javascript_tool`: list it with
  `Object.values(doors.sources).map(s => [s.id, s.input])` and
  `Object.values(doors.commands).map(c => [c.id, c.input, c.effect])`, then call `doors.read` or
  `doors.run` with the input the schema names. A game's own `.dev.ts` sources and commands appear the
  same way: the editor's page imports every `**/*.dev.ts` and hands them to the agent.
- **Editor specs of a game.** `moku-editor e2e -c <playwright config> [playwright args…]` (0.9) runs a
  game's Playwright specs against the editor: one Playwright process, so one fresh editor bin, per
  project and spec file (since 0.9.2; per project in 0.9.0), each on its own `PORT` (`PORT`, else 4417,
  plus the run's index). It prints one line per run and a summary, and holds `.moku/e2e.lock`, so two
  runs never overlap. It exists because of the Bun crash in the last bullet. An explicit `--project` or `--list` runs once as given.
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
  pops `"devtools"`. Show the pane, then resume. `editor_clock` answers the reasons: `held: false` with
  `reasons: ["background"]` is this case. Without the pane, `game.step { frames }` still advances
  the game, so step a few frames before a Shot. Not a finding.
- **Bun dev reload can break.** After many files change at once the game page can show Bun's "Failed to
  load bundled module './main.ts'", and a reload does not fix it. Bun 1.3.14 could also crash the dev
  server after many hot reloads in a row (known to the editor team); the editor needs Bun ≥1.4.2 since
  0.10.0. Whether 1.4 still crashes there is not confirmed. Restart `bun run editor`, then reload the
  tools page. `navigate` to the same URL with only a new `#hash` does not reload; use `location.reload()`.
