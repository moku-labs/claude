<!--
The builder brief of the real case, as the dev-speed A/B sent it (2026-11-05), word for word except the two
placeholders. One brief for every arm; the arm is the agent: moku:moku-builder (high), moku:moku-builder-deep
(xhigh), or moku:moku-builder with --model sonnet.
  <root>      the run folder that build.sh made
  <moku-game> the moku-game plugin folder (plugins/moku-game in this repository)
-->
S fix, delta, in a Moku game (type: game, on @moku-labs/game). Project root: <root>. Your folder: features/board/. Game rules and layout: read <moku-game>/skills/moku-game/SKILL.md and the project's CLAUDE.md first.

The bug (from .planning/changes/2026-10-29-second-chain-quiet/intake.md): seen in the editor, during the one-time lesson of the second chain (`player.lessons.secondChain`) the board's prompt hand keeps tapping the generator under the lesson's veil, on the lesson's `tap` step and on its `look` step. Expected: while that lesson guides the player (`tap`, `look`) the board's prompt queue keeps quiet, as it does for the welcome gift's lesson and the shop's lesson; before (`waiting`) and after (`done`) the prompts behave as today.

Reproduce it with a failing test first, fix it inside features/board/, keep every existing test green. Run tests scoped: `bunx vitest run features/board/`. Do not commit, do not update visual baselines, work only inside the project root. End with the JSON output contract.
