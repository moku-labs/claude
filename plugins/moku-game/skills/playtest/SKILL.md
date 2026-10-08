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
2. **Game check.** `package.json` depends on `@moku-labs/game` and the root `index.ts` default-exports
   `defineGameApp({ ... })` (an older game: a `createApp` from `@moku-labs/game`). If the project is a web app instead (`@moku-labs/web`, `src/routes.tsx`), hand over: say that
   this project has a web surface and run the `moku-web:e2e` skill with the same arguments. Stop here.
3. **Shell check.** A root `config.ts` exists and `.moku` is in `.gitignore`. The engine writes the dev
   page; the game has none of its own. A game still on `web/index.html` and `web/main.ts` is the old
   shape: say so in the report and play it with its own `dev` script, but do not migrate it here.
4. `@moku-labs/editor` in `devDependencies` and an `editor` script that runs `moku-editor --root .`.
   Missing: add `bun add --exact -d @moku-labs/editor@0.9.1` and the script; say so.

## Step 1 — headless proof

```bash
bunx moku-game keys --check       # generated/, generated/manifest.json included, is current
bun run typecheck
bun run test                       # vitest: the headless scenarios
bun run test:visual                # the headless leg of the visual tests, when the script exists
```

Then the gap check: every rest node of FOCUS has at least one `walk` scenario that reaches it and
leaves it through each outcome a player can trigger. List the node files with `rest: true`
(`features/*/flow/*.ts`, or `nodes/*.ts` on the flat layout), grep `tests/**` for `at: "<path>"`. A
missing route is a gap: write the test (`game.headless()` + `createHeadless` + `walk`, the shape of
`hello-world.md`), run the suite again. Red is a real defect or a wrong test; fix the
game source for a defect, never widen an expectation to clear red.

## Step 2 — visual tests

If `tests/visual/index.ts` exists, the engine bin runs it (game 0.12 and later). It serves its own page
from `.moku/visual/` on a free port, so it needs no dev server and runs while the editor is up.

```bash
bunx moku-game visual                          # the headless leg, and the pixel leg on a Mac
bunx moku-game visual --update                 # only with UPDATE_BASELINES
bunx moku-game visual --only <name> --no-pixels   # one test, headless leg only
bunx moku-game visual --url http://127.0.0.1:3000/   # the pixel leg on a page that is served already
```

Exit 1 means a checkpoint differs or a test failed. A game below 0.12, or one with a runner of its own,
runs its script instead (`bun tests/visual/run.ts`, the same flags).

A `state.json` or `describe.json` difference is a logic change: real or intended, decide and say which.
A pixel difference with the same state is a rendering regression; `screen.actual.webp` and
`screen.diff.webp` sit beside the baseline. The pixel leg needs `playwright-core` and a Mac; without them
say so and keep the headless leg as the proof.

A changed flow with no visual test gets one: `defineVisualTest` with a `start`, the `/control` steps that
reach the screen, and a `checkpoint` per state worth a picture, in a `tests/visual/*.visual.ts` file,
listed in `tests/visual/index.ts`: `export default { app: { app: () => game.screen().app }, tests: [...] }`.
The baselines land in `tests/visual/baselines/<test>/<checkpoint>/`; commit them. A game with no
`tests/visual/` yet gets the folder, the `index.ts` and the script `"test:visual": "moku-game visual
--no-pixels"` (`hello-world.md` → tests/visual/).

## Step 3 — play it in the editor

Follow `references/editor.md`:

1. Start the editor in the background (`preview_start` with the `game-editor` launch config, or
   `bun run editor` in the background) and open `http://127.0.0.1:3000/__editor/` in the pane. A flow deep
   in the game starts faster from a prepared save: `tests/scenarios/<name>.ts` opens with
   `http://127.0.0.1:3000/?player=<name>`; write one when a FOCUS flow needs many taps to reach. Wait for the
   link pill to say `live`. `Paused` with a hidden pane is the page's own pause; `resume` answers true and
   the game stays paused. Show the pane, then resume. Not a finding.
2. `resize_window({ width: 480, height: 900 })`; use 720 when a workspace needs the room.
3. For each flow in FOCUS, play it as a player: tap through the screen in the Game workspace, or drive
   it by script through `iframe[data-game-frame]` → `doors.run(game, doors.commands.tap, { key })`. After
   each step read `doors.sources.position` and the State workspace; the path and the committed state are
   the proof, the picture is the evidence.
4. Take one screenshot per screen or popup of FOCUS with the Shot button of the Game workspace
   (`find("Take a screenshot")`, then click it). It writes `.moku/captures/<yyyy-mm-dd>/<hhmm>-<flow>.jpg`.
   For every animation the change touched record a series
   (palette → "Record a series…", or `editor.channel.run("editor.series", …)` through the game frame); the
   palette writes the PNG frames and `index.json` under `.moku/captures/<yyyy-mm-dd>/series-<hhmm>/` and
   opens the contact sheet; flatten a PNG on the page colour before you look at it. When a finding needs to point at an element, pick it (⌘⇧C, then click) and cite the card
   `<key>-f<frame>.md` the pick writes; `capture { legend: true }` gives the rects of every keyed view as
   data. Copy what the report cites into `.planning/e2e/game/` (`<flow>-<node>.jpg`,
   `<animation>-sheet.png`, or `<animation>.mp4` from a series via the ffmpeg line of `editor.md`).
5. Read Console at level `warn` after the playthrough (`doors.sources.log`). A warning the change
   introduced is a finding. Two are not: `gameView: copy reference failed` (the pane has no clipboard
   access; the card file holds the reference) and the info line `registry:source-unavailable` for
   `game.sounds` / `game.effects` in a game without that plugin.
6. Run `doors.read(game, doors.sources.ui)` once and `app.ui.lint()` through a script
   (`w.game.ui.lint()`): tap targets under 44 pt, overflowing text, absolute elements without a `reason`.
   Each is a finding.

Prefer `read_page` and `find` for text on the tools page; take a pane screenshot for the report when a
picture says it better.

## Step 4 — the device leg (optional)

Run it when DEVICE is set, or when the change touched `native` or `system` in `config.ts`, audio (also
`audio.session` and `audio.music: "stream"`), haptics, touch gestures (`Draggable` with `carry`,
`Swipeable`, `Traceable`) or the safe area. Follow `references/device.md`:
`bun run native build ios --simulator`, `control({ action: "attach" })` first, `launch`, then `screenshot` and
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
