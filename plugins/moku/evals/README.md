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
