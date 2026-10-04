# The editor from Claude's browser pane

How Claude runs `@moku-labs/editor@0.0.2` beside a game on `@moku-labs/game@0.4.2` in the chat pane, reads the live game and takes pictures. The
tools page is built for this: decision D-26 makes the Claude pane at 480 px (one third) or 720 px (half)
the first-class viewport.

## 1. Start the dev server in the background

The game's `dev` script is the editor bin: `moku-editor web/index.html --port 3000 --root .`. It serves
the game on `/`, the tools page on `/__editor/`, and the project root's files as static (manifest, art,
sounds; dotfiles and `node_modules` refused). Bun only. It binds `127.0.0.1` only.

Preferred: `.claude/launch.json` plus `mcp__Claude_Browser__preview_start`, which starts the server and
opens the pane in one step.

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "game-editor",
      "runtimeExecutable": "bun",
      "runtimeArgs": ["run", "dev"],
      "port": 3000,
      "url": "http://127.0.0.1:3000"
    }
  ]
}
```

Then `preview_start({ name: "game-editor" })` and `navigate({ url: "http://127.0.0.1:3000/__editor/" })`.
Read the server output with `preview_logs` when the page does not come up. Without `launch.json`, run
`bun run dev` with the Bash tool in the background and `preview_start({ url: "http://127.0.0.1:3000/__editor/" })`.

The game page alone (no tools) is `http://127.0.0.1:3000/`. Both are the same origin, so the game iframe
inside the tools page is reachable from page scripts.

## 2. Size the pane

```
resize_window({ width: 480, height: 900 })   // one third beside the chat (D-26)
resize_window({ width: 720, height: 900 })   // one half
resize_window({ preset: "desktop" })         // back to the pane's own size when done
```

At 480 the rail collapses and side panels overlay; at 720 they dock. Phones are out of scope for the
tools page (D-21). The game iframe follows the Device chips of the Game workspace.

## 3. Find your way on the tools page

| Key | Action |
|---|---|
| `1`–`6` (or ⌘1–⌘6) | Flow · Game · Render · State · Files · Console |
| ⌘K | Palette: "Select element", "Take a screenshot", "Record a series…", "Overlay in game", "Device: …", "Reload" |
| `P` | Pause / resume the game |
| `.` | Step one frame, only while paused |
| `O` | Overlay in game on / off |
| `G` | Show / hide the preview of the current workspace |
| `i` or ⌘⇧C | Element picker (Game workspace) |
| ← → `b` | Previous / next shot, mark a bug, while the contact sheet is open |
| Esc | Closes one thing, outermost first |

The link pill in the top bar goes `connecting` → `live · frame N` once the game page's bridge said
`hello`. `paused` while the game is paused, `silent` after 6 s without a heartbeat, `lost` with a retry
countdown, `empty` when no game page is open. Prefer `read_page` and `find` over screenshots to read
State, Console and the Element tab: they are plain DOM.

## 4. Read and drive the game by script

The tools page exposes **no global**. The game page does: `globalThis.game` (the app), `globalThis.doors`
(`{ read, watch, sources, run, commands }`) and, when `web/main.ts` sets it, `globalThis.editor` (the
agent app). Reach them through the one game iframe, `iframe[data-game-frame]`, which is same-origin.
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

**The capture recipe.** A data URL is too big for a tool result. Save it to disk through a one-shot
receiver. Start it in the background with the Bash tool:

```sh
bun -e 'Bun.serve({ port: 3999, async fetch(r) { await Bun.write(process.argv[1], Buffer.from((await r.text()).split(",")[1], "base64")); setTimeout(() => process.exit(0), 50); return new Response("ok", { headers: { "access-control-allow-origin": "*" } }); } })' shot.png
```

Then post from the **game frame**, `w.fetch`, not the tools page: the tools page CSP allows
`connect-src 'self'` and websockets only, so its own `fetch` to another port is refused.

```js
const shot = await doors.run(game, doors.commands.capture);
await w.fetch("http://127.0.0.1:3999/", { method: "POST", body: shot.value.png });
```

When the page set `globalThis.editor`, the agent's in-process channel adds the editor commands:

```js
const { editor } = w;
(await editor.channel.run("editor.series", { durationMs: 2000, intervalMs: 100 })).value.shots.length; // 20
await editor.channel.run("editor.seriesStop");
editor.channel.status();                                   // LinkStatus
await editor.channel.read("game.locate", { key: "tap" });  // every door source by id, through the channel
```

**`editor.capture` and `editor.series` are broken with game 0.4.x.** Editor 0.0.2 expects
`game.capture` to answer a string; it now answers `{ png }`. Both throw `game.capture gave no picture`,
and so do the Shot and Series buttons of the tools page. Use `doors.commands.capture` and the receiver
above until the editor catches up.

**Reload.** Save a `.ts`/`.tsx`/`.css`/`.json` in Files and the workspace bookmarks the game, reloads the
frame and restores the bookmark (D-07). From a script: `w.location.reload()` reloads the game page
without the restore. A reload makes the session a new one; wait for the pill to say `live` again.

## 5. Captures on disk

Only a user action, a palette item or a `gameView` api call takes a picture; nothing captures on its own.
With game 0.4.x and editor 0.0.2 the Shot and Series paths below fail (`editor.capture` reads the old
`game.capture` shape, see section 4). Use the capture recipe of section 4 until the editor is updated.

- The Shot button of the Game workspace, or palette → "Take a screenshot": one PNG at
  `.moku/captures/<yyyy-mm-dd-hhmm>-<flow>.png`, written through the server's `files` sandbox (only
  `.moku/captures/` takes binary writes).
- Palette → "Record a series…": pick a duration (1 s … 20 s) and an interval (16 … 1000 ms). The result is
  `.moku/captures/series-<stamp>/NNN.png` plus `index.json` (`{ label, durationMs, intervalMs, fromFrame,
  shots: [{ file, frame, atMs, bug }], device, stoppedEarly }`), and the contact sheet opens.
- Claude's own `computer({ action: "screenshot" })` of the pane is the quickest proof for a report; it
  shows the tools page, not the raw canvas. For the raw canvas use `game.capture` above.

Turn a series into a video with ffmpeg (frame rate = 1000 / intervalMs):

```sh
ffmpeg -y -framerate 10 -pattern_type glob -i '.moku/captures/series-<stamp>/*.png' \
  -c:v libx264 -pix_fmt yuv420p -vf 'scale=trunc(iw/2)*2:trunc(ih/2)*2' .planning/e2e/game/<name>.mp4
```

`.moku/` is local state. Copy the shots a report cites into `.planning/e2e/game/`.

## 6. What the editor can and cannot do yet

- **No MCP server yet.** "MCP doors" in game 0.4.x means the catalogue is shaped for one: every source
  and command is data `{ id, title, input, effect? }` with a typed input schema, which an MCP layer
  lists as tools one to one. Neither game 0.4.2 nor editor 0.0.2 ships that server. Claude uses the same
  catalogue through `javascript_tool`: list it with
  `Object.values(doors.sources).map(s => [s.id, s.input])` and
  `Object.values(doors.commands).map(c => [c.id, c.input, c.effect])`, then call `doors.read` or
  `doors.run` with the input the schema names. A game's own `.dev` sources and commands appear the same
  way once `web/main.ts` passes them to `registry.modules`.
- **Reference mode is planned (D-27), not shipped.** The plan: key `R` turns on invisible proxy divs over
  the game frame with `aria-label` and `data-moku-*` attributes, so `read_page` and `find` see game
  elements by name, and "Copy reference" in the Element tab copies one line
  `@moku <name> · <type> · <flow/node> · <file:line> · <x>,<y> <w>×<h>`. When the user pastes such a
  line, treat it as a pointer to that element: `<name>` is the element key (`doors.read(game,
  doors.sources.locate, { key })`), `<flow/node>` the graph position, `<file:line>` where its style or view
  lives. Until the proxies ship, pick elements with `i` and read the Element tab.
- **The element picker is broken with game 0.4.x.** Editor 0.0.2 calibrates from `game.rect`, which
  0.4.0 renamed to `game.locate`: the console says `gameView: calibration failed` and the stage says
  "Picker needs one keyed element". Read rects by script with `sources.locate` and `sources.at` instead.
  Text has no style card yet. Safe areas are guides only.
- **`registry:source-failed` for `game.sounds` / `game.effects`.** A game without `audioPlugin` or
  `effectsPlugin` answers `[game] The source <id> needs <plugin>.`; editor 0.0.2 has no not-installed state
  and logs it with two `link:watch-failed`. Not a finding.
- **The hub is loopback only** (`127.0.0.1`, Host + Origin + token). A phone or a simulator cannot connect
  its game page to the tools page. See `device.md`.
- **Hidden pane stops the frames.** While the pane is hidden the game page is `visibilityState: hidden`:
  fps drops to 0 and the pill may say `Paused`. Input still reaches the model, but the canvas does not
  redraw, and `editor.series` returns a few shots instead of 20. Front the pane, or `pause` then `step`
  a few frames before a capture.
- **Bun dev reload can break.** After many files change at once the game page can show Bun's "Failed to
  load bundled module './main.ts'", and a reload does not fix it. Restart `bun run dev`, then reload the
  tools page. `navigate` to the same URL with only a new `#hash` does not reload; use `location.reload()`.
