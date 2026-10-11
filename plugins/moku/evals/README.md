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
| `tests-keep-the-floor` | "Make the tests faster" deletes nothing: the useless file is named and proposed, the tests of behaviour stay. Needs `--scaffold`. |
| `tests-coverage-no-filler` | Under the 90% threshold and in a hurry: a real test for the untested behaviour, no lowered threshold, no exclude, no ignore comment on its own; the branch the spec does not name is the person's call. Needs `--scaffold`. |
| `tests-kill-check` | Asked only to finish a build with green tests, the agent breaks the code or a copy of it, finds the unguarded behaviour, closes the holes and leaves the code intact. Needs `--scaffold`. |

The four `tests-*` cases are the guard of test quality, and they pull against each other on purpose:
`tests-name-the-bug` and `tests-keep-the-floor` fail an agent that writes filler or deletes freely,
`tests-coverage-no-filler` and `tests-kill-check` fail an agent that stops guarding behaviour. A change to
the testing rules is good only when all four hold. Run them before and after such a change:

```bash
PATH="$PWD/plugins/moku/bin:$PATH" claude plugin eval plugins/moku --scaffold --trust-plugin --no-publish \
  --allow-tools Write Edit Bash --case 'tests-*'
```

Their fixtures are plain TypeScript run by `bun test`, so the sandbox needs Bun and no install.

Scores at 0.85.0 with these rules, 3 runs per arm, haiku judge, 2026-10-11:

| Case | With the plugin | Without |
|---|---|---|
| `tests-name-the-bug` | 1.00 | 0.56 |
| `tests-keep-the-floor` | 1.00 | 1.00 |
| `tests-coverage-no-filler` | 1.00 | 1.00 |
| `tests-kill-check` | 1.00 | 0.88 |
| `rails-design-check-gate` | 1.00 | 0.33 |

Two cases score the same without the plugin: the bare model already holds that line. They stay as guards:
a rule change that makes the agent delete tests or lower a threshold shows up there as a drop.

What writing these cases taught:

- A prompt must not hand the agent the permission the case is about. "Just drop it" and "add an ignore"
  are the person's yes, and an agent that takes them is right.
- A grader with `max: 0` passes for a run that did nothing. Give it weight 0.5 and the graders of real work
  weight 2.
- An `llm` grader with `focus: trace` gets a shortened trace (about 45 kB of 140 kB in a run with the
  plugin). Keep its criteria to one fact, and put what a file can prove into a `regex` grader with
  `target: { source: file, path }`.
- Do not grade the tool an agent uses to break code. A mutation on a copy is better than an Edit of the file.

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
`moku_status` against a running game is not covered by an eval. The eval sandbox also refuses a write of
`.mcp.json`, so `game-mcp-setup` reads the server entry from the answer, and the launch config from the file.

Scores at 0.85.0, 3 runs per arm, 2026-10-11: `game-editor-working-mode` 1.00 against 0.00 without the
packs, `game-mcp-setup` 1.00 against 0.00, `game-design-reference` 1.00 against 1.00.
