# moku evals

Behavior tests for the plugin itself. Run from the repository root:

```bash
claude plugin eval . --trust-plugin --no-publish --allow-tools Write Edit Bash
```

Iterate on one case without the no-plugin baseline:

```bash
claude plugin eval . --trust-plugin --no-publish --case conductor-idea --runs 1 --ablation none
```

| Case | Guards |
|---|---|
| `nano-plugin-shape` | R1, R4, R7: inferred generics, `<name>Plugin` export, no `as any` |
| `thin-root` | Root files stay thin composition (idiom I4) |
| `web-island-attrs` | `data-*` attributes, scoped CSS, no classes |
| `readable-stanzas` | Stanza style: guard first, intent comments |
| `conductor-idea` | Plain-language idea reaches the conductor and the init station |
| `rails-no-init` | No code is written into an uninitialized project |
| `release-first-publish` | Release flow is three commands, no NPM_TOKEN |
