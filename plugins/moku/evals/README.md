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

Pack evals live in the repository's top-level `evals/<pack>/`, because a pack depends on the core and
the runner only loads plugins inside its containment root. Run them from the repository root:

```bash
claude plugin eval . --trust-plugin --no-publish --allow-tools Bash
```

`baselines/0.62.4.json` is the score of the last monolithic release on the original seven cases
(`web-island-attrs` has since moved to `evals/moku-web/`).
`baselines/0.70.0.json` covers the whole marketplace at 0.70.0. `baselines/0.74.0.json` covers the core plugin
at 0.74.0, 3 runs per case, haiku judge.

Run the evals from a plain terminal, or strip the installed plugin's `bin` folders from `PATH` first. A
Claude Code session puts `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/bin` on `PATH`, the eval
sandbox can execute those files but not read the `lib/` next to them, and the no-plugin arm sees the installed
plugin. That run under-reports every delta and fails the rails cases on a sandbox error:

```bash
PATH=$(echo "$PATH" | tr ':' '
' | grep -v "/.claude/plugins/cache/" | paste -sd: -) \
  claude plugin eval plugins/moku --trust-plugin --no-publish --allow-tools Write Edit Bash -j 4
```
