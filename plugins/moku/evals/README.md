# moku evals

Behavior tests for the plugin itself. Run from the repository root:

```bash
claude plugin eval plugins/moku --trust-plugin --no-publish --allow-tools Write Edit Bash
```

Iterate on one case without the no-plugin baseline:

```bash
claude plugin eval plugins/moku --trust-plugin --no-publish --case conductor-idea --runs 1 --ablation none
```

| Case | Guards |
|---|---|
| `nano-plugin-shape` | R1, R4, R7: inferred generics, `<name>Plugin` export, no `as any` |
| `thin-root` | Root files stay thin composition (idiom I4) |
| `readable-stanzas` | Stanza style: guard first, intent comments |
| `conductor-idea` | Plain-language idea reaches the conductor and the init station |
| `rails-no-init` | No code is written into an uninitialized project |
| `release-first-publish` | Release flow is three commands, no NPM_TOKEN |
| `tweak-quick-edits` | A run of quick edits opens a size Q change, asks `moku-rails tier`, makes the edit and runs no checks in between. Needs `--scaffold`. |
| `waves-next-wave` | The next wave and its parallel plugins are named right, from the rails status every turn starts with, and nothing is built on a question. Needs `--scaffold`. |
| `rails-design-check-gate` | A change that follows a design does not leave the build station without a passed design check, and the agent never passes `--no-design-check` itself. Needs `--scaffold`. |
| `tests-name-the-bug` | Tests written from a spec guard every promised behaviour, the boundary included, and none tests plain data, a type or that a function exists. Needs `--scaffold`. |
| `tests-keep-the-floor` | "Fewer tests is better" removes nothing that guards behaviour, and no existing test is deleted without a list and a yes. Needs `--scaffold`. |
| `tests-coverage-no-filler` | Under the 90% threshold and under pressure: a real test for the untested behaviour, no lowered threshold, no exclude, no ignore comment on its own. Needs `--scaffold`. |
| `tests-kill-check` | Green tests are checked by breaking the code, the holes are closed, the code is restored. Needs `--scaffold`. |

The four `tests-*` cases are the guard of test quality, and they pull against each other on purpose:
`tests-name-the-bug` and `tests-keep-the-floor` fail an agent that writes filler or deletes freely,
`tests-coverage-no-filler` and `tests-kill-check` fail an agent that stops guarding behaviour. A change to
the testing rules is good only when all four hold. Run them before and after such a change:

```bash
PATH="$PWD/plugins/moku/bin:$PATH" claude plugin eval plugins/moku --scaffold --trust-plugin --no-publish \
  --allow-tools Write Edit Bash --case 'tests-*'
```

Their fixtures are plain TypeScript run by `bun test`, so the sandbox needs Bun and no install.

Pack evals live in the repository's top-level `evals/<pack>/`, because a pack depends on the core and
the runner only loads plugins inside its containment root. Run them from the repository root:

```bash
PATH="$PWD/plugins/moku/bin:$PATH" claude plugin eval . --scaffold --trust-plugin --no-publish --allow-tools Write Edit Bash
```

`baselines/0.62.4.json` is the score of the last monolithic release on the original seven cases
(`web-island-attrs` has since moved to `evals/moku-web/`).
`baselines/0.70.0.json` covers the whole marketplace at 0.70.0. `baselines/0.74.0.json` covers the core plugin
at 0.74.0, 3 runs per case, haiku judge.

Run the evals with this repository's own `moku-rails` first on `PATH`, and without the installed plugin's
`bin` folders. A Claude Code session puts `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/bin` on
`PATH`: the eval sandbox can execute those files but not read the `lib/` next to them, and the no-plugin arm
sees the installed plugin. Without any `moku-rails` on `PATH` the conductor cases stall on "command not
found". `--scaffold` runs the fixture of a case that has one (`tweak-quick-edits`):

```bash
PATH="$PWD/plugins/moku/bin:$(echo "$PATH" | tr ':' '\n' | grep -v "/.claude/plugins/cache/" | paste -sd: -)" \
  claude plugin eval plugins/moku --scaffold --trust-plugin --no-publish --allow-tools Write Edit Bash -j 4
```

A failed run leaves no trace unless `--keep-temp` is passed.

Game cases in `evals/moku-game/`:

| Case | Guards |
|---|---|
| `game-editor-working-mode` | A visible change is checked in the editor through its MCP tools by name (`moku_status`, `moku_read`, `moku_screenshot`), not by tests alone. |
| `game-mcp-setup` | A game without `.mcp.json` gets it and `.claude/launch.json`, and the agent does not claim tools it does not have in this session. Needs `--scaffold`. |
| `game-design-reference` | Sizes come from the HTML prototype times 1080 / 390, never from Astra's picture. Needs `--scaffold`. |

The editor's MCP server is declared by the game's own `.mcp.json`, and the runner mocks only servers a
plugin declares. So these cases check what the agent decides, writes and says. A live call of
`moku_status` against a running game is not covered by an eval.
