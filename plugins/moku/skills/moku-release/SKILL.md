---
name: moku-release
description: Sets up and runs CI, versioning and npm publishing for moku packages, and CI plus Cloudflare deploy for moku apps, the same way in every project. Use when someone asks how to publish, release, version, set up GitHub Actions or CI, fix a failed release, or when the conductor reaches the release station.
when_to_use: First publish of a package, any later release, a release or CI that fails, migrating a project off a hand-written workflow, or the release station of a change.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
model: fable
effort: medium
---

# Releases for moku projects

Every moku package releases the same way: three commands, two thin workflow files, no tokens. The
logic lives once, in the `moku-labs/ci` repository, so a fix there reaches every project. Do not
write or paste workflow YAML by hand; hand-written copies are what drifted apart before.

On the rails this is the `release` station: `moku-rails enter release` first, `moku-rails done release`
last. It is optional for a change, and required once: the first cycle of a package closes only with a
green `release:doctor`.

## The three commands

| Command | When | What it does |
|---|---|---|
| `bun run release:setup` | once per project | Idempotent wizard: thin workflows, `package.json` contract, first publish, first tag, trusted publisher (`npm trust github`), branch ruleset, then doctor. |
| `bun run release:doctor` | any time, and before every release | Read-only. One line per check, and for every red line the exact fix. |
| `bun run release patch` | every release (`patch`, `minor`, `major`, `prerelease`) | Refuses unless the PR is merged and `HEAD == origin/main`, dispatches the workflow, watches it, verifies the version and dist-tag on npm. |

They come from the `moku-release` bin in `@moku-labs/ci`, a dev dependency of every moku project (`bun add -d @moku-labs/ci`). The same package holds the workflows the thin callers point at.

## What only the human can do

Two logins, once per machine. Ask the person to run them; never handle credentials, one-time codes
or tokens yourself, and never suggest an `NPM_TOKEN` secret.

```bash
gh auth login
```

```bash
npm login
```

When `release:setup` reaches the first publish, npm may ask for a one-time code. That prompt belongs
to the person: run the command with the terminal attached and let them answer.

## The project contract

The central workflows call only these script names. Project quirks live inside the scripts, never in
YAML: a project with two tsconfigs chains both inside its own `typecheck`.

```json
{
  "scripts": {
    "lint": "biome check . && eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "build": "tsdown",
    "validate": "publint && attw --pack . --profile node16",
    "release:setup": "moku-release setup",
    "release:doctor": "moku-release doctor",
    "release": "moku-release"
  },
  "publishConfig": { "access": "public" }
}
```

`repository.url` has to match the git remote, or provenance fails with `E422`.

## Files a project carries

| Project | File | Source |
|---|---|---|
| package | `.github/workflows/ci.yml` | `examples/package/ci.yml` |
| package | `.github/workflows/publish.yml` | `examples/package/publish.yml`. The file name is a contract: npm trusts this name. |
| app | `.github/workflows/ci.yml` | `examples/app/ci.yml`: validate on PRs, deploy to Cloudflare on `main`. |

Sources are paths inside the installed package, `node_modules/@moku-labs/ci/`. The CLI reads them from
its own install and this plugin keeps no copy: one home for the files, nothing to drift.

`release:setup` writes the package files itself. The `init` skill copies them at scaffold time, so CI
exists from the first commit. For an app the person sets the two Cloudflare secrets themselves:

```bash
gh secret set CLOUDFLARE_API_TOKEN
```

```bash
gh secret set CLOUDFLARE_ACCOUNT_ID
```

## Trying a package before it is released

Every pull-request commit of a package is published to pkg.pr.new by the `preview` job of the shared
CI. Nothing reaches npm and no token is involved; a bot comments the install command on the PR. Use it
to test a framework change in a consuming app before cutting a version:

```bash
bun add https://pkg.pr.new/@moku-labs/core@42
```

`42` is the PR number; a commit sha works too. A preview URL must never reach `main`: the `lint` job
and `release:doctor` both refuse it, so switch the dependency back to a real version before merging.
The pkg.pr.new GitHub App has to be installed on the organization once, and the package repository
has to be public.

## Walking someone through it

1. New package: run `bun run release:doctor` and read it together. Usually the two logins come first.
2. `bun run release:setup`, staying with the person through the confirmations.
3. From then on: merge the PR, then `bun run release patch`. Nothing else.
4. A red release: start with `release:doctor`, then the failed job's log (`gh run view --log-failed`),
   then `references/release-model.md`, which lists the known traps with their causes.

## Migrating a project that has hand-written workflows

`release:doctor` reports them as legacy. `release:setup` replaces them and keeps a `.bak`. Extra jobs
a project really needs (a TypeScript version matrix, a CLI end-to-end suite, a bundle-size check)
either move inside a contract script, or stay as an additional local job next to the `uses:` job in
`ci.yml`. They never go back into a copied release workflow.

## Gotchas

- `package.json` `version` on `main` lags behind the tags. That is by design: tags and npm are the truth.
- Dispatching before the PR is merged publishes the old code under a new version. `release` refuses
  to do it; do not bypass it with a raw `gh workflow run`.
- Required checks are named `ci / lint`, `ci / types`, `ci / test`, `ci / build`. Renaming the job in
  `ci.yml` without updating the ruleset blocks every PR.
- An OIDC identity mismatch on publish means npm did not accept the central workflow as publisher.
  Switch to `node_modules/@moku-labs/ci/examples/package/publish.local-publish.yml` and re-run; details in the reference.
- The first publish has no provenance. Every later one does.
