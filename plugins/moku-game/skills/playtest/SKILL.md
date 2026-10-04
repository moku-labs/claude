---
name: playtest
description: Proves a Moku game works: headless scenarios in Bun, visual baselines, then a real playthrough of every changed flow in the editor inside the browser pane, with shots and series saved for the report, an optional simulator leg and an optional second UX opinion. Use for the e2e station of a change in a project whose `.planning/moku.md` says `type: game`, and whenever someone asks to play the game, try the new screen, check it on a phone or see whether it looks right. Not for unit tests of rules.
when_to_use: A Moku game (@moku-labs/game) reaches the e2e station, or the user asks to play, playtest or look at a game flow, screen or popup.
argument-hint: (empty = every changed flow) or {a flow, node, screen or popup to focus} [--device] [--update-baselines]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Skill, Agent, AskUserQuestion
model: fable
effort: medium
---

# The playtest station

You prove a game on `@moku-labs/game` the way a player and an engineer would: the graph runs headless to
the end, the pictures match their baselines, and you play each changed flow yourself in the editor beside
the chat. You do the work in this session; agents are optional and rare.

For type `game` this station replaces `moku-web:e2e`. The two never run on the same project.

## Enter the rails

```bash
moku-rails enter e2e        # exit 2 = refused: stop, relay the reason and the named next step
```

Before you stop to ask the user anything mid-station: `moku-rails pause --reason "..."`. The last action
of a finished run is `moku-rails done e2e`.

## Knowledge you load

- The **moku-game** skill of this pack: `references/editor.md` (the browser pane, the doors by script,
  captures, ffmpeg) and `references/device.md` (simulator, Android, iPhone). Read `editor.md` before you
  open the pane.
- `references/plugin-index.md` for a door, a command or an event you are not sure about.
- Core knowledge (the agent preamble, `nl-args.md`, `moku-idioms.md`): load `moku:moku-core` with the
  Skill tool and read `references/<file>` under the base directory it prints.
- The built-in browser: load `anthropic-skills:built-in-browser` before the first pane step.
- Both packages change fast: when a door or a command named here is missing, read
  `node_modules/@moku-labs/game/llms.txt` (shipped since game 0.4.0) and the doors tables of
  `references/plugin-index.md`; for the editor, `node_modules/@moku-labs/editor/README.md`.

`.planning/` and `.moku/` are local state; neither is staged or committed.

## Input

`$ARGUMENTS` may be plain language (resolve it per `nl-args.md`):

| Input | Means |
|---|---|
| empty | FOCUS = every flow the open change touched (diff of `nodes/`, `flows/`, `features/`), else every flow |
| a flow, node, screen or popup name | FOCUS = that item; still run the headless suite for the rest |
| `--device`, "on the phone", "in the simulator" | DEVICE = true |
| `--update-baselines`, "I redesigned X" | UPDATE_BASELINES = true, for intended changes only |

Echo one line `Interpreting as: …` only when plain language was interpreted. A request to build a new
feature belongs in `/moku:plan` and `/moku:build`; say so and stop.

## Step 0 — guards

1. `package.json` present, else "Not a Moku project — run from the app root." Stop.
2. **Game check.** `package.json` depends on `@moku-labs/game` and a `createApp` from `@moku-labs/game`
   exists. If the project is a web app instead (`@moku-labs/web`, `src/routes.tsx`), hand over: say that
   this project has a web surface and run the `moku-web:e2e` skill with the same arguments. Stop here.
3. **Dev page check.** `web/index.html` and `web/main.ts` exist, `web/main.ts` sets `globalThis.game`
   and `globalThis.doors`, and `__MOKU_GAME_DEV__` is set by `web/dev.ts`. Missing pieces: add them from
   `references/hello-world.md` (they are dev scaffolding, not game logic), say what you added.
4. `@moku-labs/editor` in `devDependencies` and a `dev` script that runs `moku-editor`. Missing: add
   `bun add -d @moku-labs/editor@latest` and the script; say so.

## Step 1 — headless proof

```bash
bun run assets:keys -- --check    # generated/ and manifest.json are current
bun run typecheck
bun run test                       # vitest: scenarios + the headless leg of the visual tests
```

Then the gap check: every rest node of FOCUS has at least one `walk` scenario that reaches it and
leaves it through each outcome a player can trigger. List `nodes/*.ts` with `rest: true`, grep
`tests/**` for `at: "<path>"`. A missing route is a gap: write the scenario (the `createHeadless` +
`walk` shape of `hello-world.md`), run the suite again. Red is a real defect or a wrong test; fix the
game source for a defect, never widen an expectation to clear red.

## Step 2 — visual tests

If `tests/visual/` exists: start the dev server (Step 3 does it; order the steps so the server is up),
then

```bash
bun tests/visual/run.ts --url http://127.0.0.1:3000/            # both legs, compare with the baselines
bun tests/visual/run.ts --url http://127.0.0.1:3000/ --update   # only with UPDATE_BASELINES
bun tests/visual/run.ts --only <name> --no-pixels               # one test, headless leg only
```

A `state.json` or `describe.json` difference is a logic change: real or intended, decide and say which.
A pixel difference with the same state is a rendering regression; `screen.actual.webp` and
`screen.diff.webp` sit beside the baseline. The pixel leg needs `playwright-core` and a Mac; without them
say so and keep the headless leg as the proof.

A changed flow with no visual test gets one: `defineVisualTest` with a `start`, the `/control` steps that
reach the screen, and a `checkpoint` per state worth a picture. Add it to `tests/visual/tests.ts`.

## Step 3 — play it in the editor

Follow `references/editor.md`:

1. Start the dev server in the background (`preview_start` with the `game-editor` launch config, or
   `bun run dev` in the background) and open `http://127.0.0.1:3000/__editor/` in the pane. Wait for the
   link pill to say `live`.
2. `resize_window({ width: 480, height: 900 })`; use 720 when a workspace needs the room.
3. For each flow in FOCUS, play it as a player: tap through the screen in the Game workspace, or drive
   it by script through `iframe[data-game-frame]` → `doors.run(game, doors.commands.tap, { key })`. After
   each step read `doors.sources.position` and the State workspace; the path and the committed state are
   the proof, the picture is the evidence.
4. Take one screenshot per screen or popup of FOCUS with `doors.commands.capture` and the capture
   recipe of `editor.md` (receiver in Bash, `w.fetch` from the game frame, flatten on the page colour).
   For every animation the change touched take a contact sheet,
   `capture { sheet: { frames: 8, everyMs: 100 } }`; `capture { legend: true }` numbers the keyed views
   when a finding needs to point at one. With editor 0.0.2 and game 0.4.x the palette's "Take a
   screenshot" and "Record a series…" fail (`game.capture gave no picture`); use them again once the
   editor is updated. Copy what the report cites into `.planning/e2e/game/` (`<flow>-<node>.png`,
   `<animation>-sheet.png`, or `<animation>.mp4` from a series via the ffmpeg line of `editor.md`).
5. Read Console at level `warn` after the playthrough (`doors.sources.log`). Skip `registry:source-failed`
   and `link:watch-failed` for `game.sounds` / `game.effects` in a game without that plugin: editor 0.0.2
   logs the game's not-installed answer as a failure. A warning the change
   introduced is a finding.
6. Run `doors.read(game, doors.sources.ui)` once and `app.ui.lint()` through a script
   (`w.game.ui.lint()`): tap targets under 44 pt, overflowing text, absolute elements without a `reason`.
   Each is a finding.

Prefer `read_page` and `find` for text on the tools page; take a pane screenshot for the report when a
picture says it better.

## Step 4 — the device leg (optional)

Run it when DEVICE is set, or when the change touched `platform-bridge.ts`, `native.ts`, audio (also
`audio.session` and `audio.music: "stream"`), haptics, touch gestures (`Draggable` with `carry`,
`Swipeable`, `Traceable`) or the safe area. Follow `references/device.md`:
`bun run native ios --simulator`, `control({ action: "attach" })` first, `launch`, then `screenshot` and
`tap` to walk the same flow once. Expect WebGL on the simulator. Save the shots into
`.planning/e2e/game/sim-<flow>.png`. Android: `adb install -r`, `adb exec-out screencap`.

A real iPhone needs the user's signing; guide them (`device.md` → Real iPhone), never ask for credentials.

## Step 5 — a second opinion (optional)

If the `moku-design` pack is installed and `moku-astra` is on PATH, and FOCUS includes a screen or a
popup whose look changed:

```bash
moku-astra review --images <comma-separated shots> --context <design-context.md if any> --out .planning/astra/findings.json
```

Load `moku-design:moku-astra` first for the triage protocol. Exit 3 or the pack absent: review the shots
yourself with the same findings shape and say that you were the reviewer. Triage every finding
(reproducible, consistent with the design context and the game rules, worth its cost) into
`.planning/astra/triage.md`.

## Step 6 — the fix loop

At most **two rounds**. A round: fix the accepted findings and the defects in the game source, run
`bun run test` and the visual tests again, replay the touched flow in the editor, re-capture. A failing
visual baseline is updated only for an intended change, with the reason in the report. After two rounds,
present what is still open and offer to continue; do not start a third round on your own.

Before any question to the user: `moku-rails pause --reason "..."`.

## Step 7 — close

Present, in this order:

1. The flow table: each rest node of FOCUS, the scenario that walks it, the visual test that pictures
   it, played in the editor (yes/no), on a device (yes/no/skipped).
2. Headless and visual results; baselines updated with the reason.
3. Defects found and fixed, with file and line.
4. Console warnings and `ui.lint()` findings, accepted or rejected.
5. The second opinion: who reviewed, accepted and rejected counts.
6. The shots and videos under `.planning/e2e/game/`.

```bash
moku-rails done e2e
```

## Rules

- Only a run counts as proof: a route that walked, a baseline that matched, a flow played in the editor.
  "I wrote the test" is not "it passes".
- The game source changes only for a defect or an accepted finding. Baselines never move to clear red.
- `doors.run` commands with effect `route` keep the session clean; `restore` taints it. Reload the page
  (or restore a bookmark) before a proof that must start clean.
- Agents are optional. Spawn one (`general-purpose`) only for an independent side quest that would
  block the main thread, such as writing many missing scenarios while you play; give it the file list and
  the `createHeadless` shape. Never spawn an agent to drive the browser pane.
- `.moku/captures/`, `dist/`, `dist-e2e/` are local output.

## Examples

- `/moku-game:playtest` — walk every changed flow headless, picture it, play it in the editor, report.
- `/moku-game:playtest the settings popup` — focus the settings sub-flow and its popup.
- `/moku-game:playtest --device` — add the simulator leg.
- `/moku-game:playtest --update-baselines` — after an intended redesign, refresh the goldens while re-confirming.
