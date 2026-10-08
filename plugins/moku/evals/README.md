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
