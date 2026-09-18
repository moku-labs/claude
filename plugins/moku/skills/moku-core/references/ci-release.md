# CI + Release/Publish: Framework-Level (Layer-2) Moku Package

Canonical reference for setting up — or auditing — CI and npm publishing for a
**Layer-2 framework package** (published to npm). Layer-3 apps *deploy* instead; see the
deploy targets in [build-final.md](build-final.md) Step 5.10 for those. This file is the
authoritative spec for the **npm Publish** path; do not hand-roll a different release
workflow.

Apply the rationale — these rules exist because the naive form has caused real
compromises and silent release bugs. Don't cargo-cult; understand each rule.

> ## ⛔ NEVER use `NPM_TOKEN` / `NODE_AUTH_TOKEN` to publish — this is the #1 wrong pattern
>
> If you are about to write `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` (or any `npm publish` that
> reads a long-lived npm token), **STOP — that workflow is wrong and must not ship.** Publishing in
> this template is **tokenless OIDC Trusted Publishing** (`id-token: write` on the `publish` job,
> nothing else). A token-based publish is rejected on two counts:
> 1. **Insecure** — a long-lived, exfiltratable secret sitting next to the publish step (and, if build
>    runs in the same job, exposed to every dependency's postinstall). The whole point of the
>    `package`/`publish` split + OIDC is that there is *no* token to steal.
> 2. **It won't even work for this flow** — provenance attestation requires the OIDC `id-token`, and
>    npm Trusted Publishing matches the workflow filename in the OIDC claim. A `NODE_AUTH_TOKEN`
>    publish attaches **no provenance** and bypasses the Trusted Publisher you registered.
>
> There is exactly ONE correct path: the `publish.yml` below. Do **not** hand-roll an alternative, do
> **not** add an `NPM_TOKEN` repo secret, and if you find one in an existing repo, delete it. If you
> skipped this file and reached for a token from memory: that is the exact mistake this banner exists
> to stop — read the `publish.yml` job (§"publish") and copy it verbatim.

## Shape: exactly TWO workflow files

Keep it minimal — two files, no third workflow.

### `.github/workflows/ci.yml` — the check suite

- Checks run as **parallel jobs**: `lint`, `types`, `test`, `build` (build also validates).
- Triggers: `push` (main), `pull_request`, **and** `workflow_call` so the release
  workflow reuses the IDENTICAL checks.
- Concurrency group scoped by **`github.workflow`** so a release-time reuse never cancels
  a standalone CI run; `cancel-in-progress` only on pull requests.

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
  workflow_call: # lets publish.yml reuse these exact checks

# Scope the group by github.workflow: a release's reuse of CI runs under the "Release"
# workflow name, so it never shares a group with — and never cancels — a standalone CI run.
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

permissions:
  contents: read # workflow-level least privilege; no job here needs more

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<SHA> # v6.0.0
        with:
          persist-credentials: false
      - uses: oven-sh/setup-bun@<SHA> # v2.2.0
      - run: bun install --frozen-lockfile
      - run: bun run lint
  types:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<SHA> # v6.0.0
        with:
          persist-credentials: false
      - uses: oven-sh/setup-bun@<SHA> # v2.2.0
      - run: bun install --frozen-lockfile
      - run: bun run typecheck
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<SHA> # v6.0.0
        with:
          persist-credentials: false
      - uses: oven-sh/setup-bun@<SHA> # v2.2.0
      - run: bun install --frozen-lockfile
      - run: bun run test # NOT `bun test`: Bun's native runner bleeds vitest module mocks across files
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<SHA> # v6.0.0
        with:
          persist-credentials: false
      - uses: oven-sh/setup-bun@<SHA> # v2.2.0
      - run: bun install --frozen-lockfile
      - run: bun run build
      - run: bun run validate # type/lint/test gate baked into the build job
```

The four job names — `lint`, `types`, `test`, `build` — are the required status checks
in the branch ruleset below. Keep them stable.

### `.github/workflows/publish.yml` — the ONE release + publish workflow

Two entry points, one file:

- **`workflow_dispatch`** with input `release_type` = `patch|minor|major|prerelease` —
  cut a new release, then publish.
- **`release: published`** — publish a release created in the GitHub UI.

It reuses `ci.yml` for checks (`uses: ./.github/workflows/ci.yml`) and runs
`npm publish` **inline** (OIDC rule — see below). No third workflow.

```yaml
name: Release
on:
  workflow_dispatch:
    inputs:
      release_type:
        description: Semver bump for this release
        type: choice
        required: true
        options: [patch, minor, major, prerelease]
  release:
    types: [published]

# Distinct literal group ("publish-…") — NOT github.workflow. The reused ci.yml (the `check`
# job below) computes its concurrency from the CALLER's github.workflow = "Release", i.e.
# "Release-<ref>". If this parent run also used "Release-<ref>" it would hold that slot for its
# whole duration while the child `check` waits for the same slot → deadlock, and the reusable
# workflow never starts (0 jobs, run fails). A distinct "publish-<ref>" group avoids the
# collision; the child stays in "Release-<ref>", still separate from standalone CI's "CI-<ref>".
concurrency:
  group: publish-${{ github.ref }}
  cancel-in-progress: false

permissions:
  contents: read # least privilege at the top; elevate ONLY per job below

jobs:
  # 1. Reuse the IDENTICAL checks from ci.yml.
  check:
    uses: ./.github/workflows/ci.yml

  # 2. Cut a tag-only release. Dispatch-on-main path only. NEVER writes refs/heads/main.
  release:
    needs: check
    if: github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: write # ONLY this job pushes a tag + creates a release
    outputs:
      tag: ${{ steps.bump.outputs.tag }}
      version: ${{ steps.bump.outputs.version }}
    env:
      RELEASE_TYPE: ${{ inputs.release_type }} # untrusted input -> env, never inline in run
    steps:
      - uses: actions/checkout@<SHA> # v6.0.0
        with:
          fetch-depth: 0 # need tags to derive the next version
          # persist-credentials defaults true here so the local tag push is authenticated.
      - uses: oven-sh/setup-bun@<SHA> # v2.2.0
      - name: Derive next version from the latest git tag
        id: bump
        run: |
          set -euo pipefail
          # package.json on a protected branch goes stale; the latest tag is the truth.
          prev="$(git tag --list 'v*' --sort=-v:refname | head -1)" # previous release tag, or "" on the first release
          base="${prev#v}"
          base="${base:-0.0.0}"
          # Set package.json to the base, then bump — no git tag, no push from npm.
          npm version "$base" --no-git-tag-version --allow-same-version >/dev/null
          new="$(npm version "$RELEASE_TYPE" --no-git-tag-version --preid rc)"
          new="${new#v}"
          echo "version=$new" >> "$GITHUB_OUTPUT"
          echo "tag=v$new" >> "$GITHUB_OUTPUT"
          echo "prev_tag=$prev" >> "$GITHUB_OUTPUT" # explicit changelog base for --notes-start-tag
      - name: Commit the bump locally and push the TAG ONLY
        env:
          TAG: ${{ steps.bump.outputs.tag }}
        run: |
          set -euo pipefail
          git config user.name  "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add package.json
          git commit -m "release: $TAG"
          git tag "$TAG"
          # refs/tags/* is NOT covered by a branch ruleset; refs/heads/main is never written.
          git push origin "refs/tags/$TAG"
      - name: Create the GitHub release with native notes
        env:
          TAG: ${{ steps.bump.outputs.tag }}
          PREV_TAG: ${{ steps.bump.outputs.prev_tag }}
          GH_TOKEN: ${{ github.token }}
        run: |
          set -euo pipefail
          # Native notes — never hand-roll from `git log | grep | sed` (processes
          # attacker-influenceable commit text). --verify-tag fails closed if the tag is missing.
          # A release created with the default GITHUB_TOKEN does NOT re-fire release:published,
          # so the publish job below runs inline in this same run for the dispatch path.
          # Changelog base: pass the previous tag EXPLICITLY. The tag-only model tags each version
          # on a separate bump commit that is NOT an ancestor of the next, so auto base-detection
          # fails and lists the FULL history (cumulative notes). --notes-start-tag forces a correct
          # delta; omit it on the first release (no previous tag).
          notes=(--generate-notes)
          if [ -n "$PREV_TAG" ]; then
            notes+=(--notes-start-tag "$PREV_TAG")
          fi
          # A prerelease tag (contains '-', e.g. v1.2.3-rc.0) must be flagged --prerelease so GitHub
          # does not surface an rc as the repo's "Latest release"; stable tags get --latest.
          case "$TAG" in
            *-*) gh release create "$TAG" "${notes[@]}" --verify-tag --title "$TAG" --prerelease --latest=false ;;
            *)   gh release create "$TAG" "${notes[@]}" --verify-tag --title "$TAG" --latest ;;
          esac

  # 3. Build + package the tarball WITHOUT the publish token in scope (optional hardening).
  package:
    needs: [check, release]
    # Run on dispatch (after release) OR on a UI-published release. The release job is
    # skipped on the release-published path, so gate on success-or-skipped, not success.
    if: |
      always() &&
      needs.check.result == 'success' &&
      (needs.release.result == 'success' || needs.release.result == 'skipped')
    runs-on: ubuntu-latest
    permissions:
      contents: read # NO id-token here: postinstall scripts never see the OIDC token
    steps:
      - uses: actions/checkout@<SHA> # v6.0.0
        with:
          ref: ${{ github.event_name == 'workflow_dispatch' && needs.release.outputs.tag || github.ref }}
          persist-credentials: false
      - uses: oven-sh/setup-bun@<SHA> # v2.2.0
      - run: bun install --frozen-lockfile
      - run: bun run build
      - run: bun run validate
      - name: Pack the publishable tarball
        # `npm pack --pack-destination` does NOT create the target dir (errors ENOENT on write).
        run: |
          mkdir -p dist-pack
          npm pack --pack-destination dist-pack
      - uses: actions/upload-artifact@<SHA> # v7.0.1
        with:
          name: npm-package
          path: dist-pack/*.tgz
          retention-days: 1

  # 4. Minimal credentialed job: download the tarball and run ONLY npm publish.
  publish:
    needs: [release, package]
    if: |
      always() && needs.package.result == 'success' &&
      (
        (github.event_name == 'workflow_dispatch' && needs.release.result == 'success') ||
        github.event_name == 'release'
      )
    runs-on: ubuntu-latest
    permissions:
      id-token: write # ONLY this job — tokenless Trusted Publishing via OIDC
      contents: read
    steps:
      - uses: actions/checkout@<SHA> # v6.0.0
        with:
          ref: ${{ github.event_name == 'workflow_dispatch' && needs.release.outputs.tag || github.ref }}
          persist-credentials: false
      - uses: actions/setup-node@<SHA> # v6.0.0
        with:
          node-version: 24
          registry-url: https://registry.npmjs.org
      - uses: actions/download-artifact@<SHA> # v8.0.1
        with:
          name: npm-package
          path: dist-pack
      - name: Assert npm floor for Trusted Publishing (fail closed)
        run: |
          set -euo pipefail
          # Rely on the npm bundled with Node 24 — do NOT `npm install -g npm@latest`
          # (a floating dep next to the publish token). Assert the floor instead.
          have="$(npm --version)"
          need="11.5.1"
          [ "$(printf '%s\n%s\n' "$need" "$have" | sort -V | head -1)" = "$need" ] \
            || { echo "npm $have < $need (Trusted Publishing floor)"; exit 1; }
      - name: Verify the ref matches package.json, then publish
        env:
          EVENT: ${{ github.event_name }}
          DISPATCH_VERSION: ${{ needs.release.outputs.version }}
          REF_NAME: ${{ github.ref_name }}
        run: |
          set -euo pipefail
          pkg="$(node -p "require('./package.json').version")"
          if [ "$EVENT" = "workflow_dispatch" ]; then
            want="$DISPATCH_VERSION"
          else
            want="${REF_NAME#v}" # release tag, e.g. v1.2.3
          fi
          # Fail closed on mismatch AND on an empty ref (a skipped release job falling through).
          [ -n "$want" ] || { echo "empty version/ref — refusing to publish"; exit 1; }
          [ "$pkg" = "$want" ] || { echo "package.json $pkg != ref $want"; exit 1; }
          # Prereleases (a '-' in the version) go to dist-tag 'next' so they never clobber 'latest'.
          case "$pkg" in *-*) tag=next ;; *) tag=latest ;; esac
          # Trusted Publishing: tokenless, provenance auto-attached. No NODE_AUTH_TOKEN needed.
          # Leading "./" is REQUIRED: a bare "dist-pack/foo.tgz" is parsed by npm as a GitHub
          # "owner/repo" spec (it tries `git ls-remote` and fails), not a local file.
          npm publish ./dist-pack/*.tgz --tag "$tag" --access public
```

## Non-negotiable security + correctness rules

1. **Pin every action to a 40-char commit SHA** with a `# vX.Y.Z` comment. Resolve SHAs
   via the GitHub API, not by trusting a pasted value:
   ```bash
   gh api repos/<owner>/<repo>/commits/<tag> --jq .sha
   # e.g. gh api repos/actions/checkout/commits/v6.0.0 --jq .sha
   ```
   Replace every `@<SHA>` placeholder above with the resolved 40-char SHA. Use
   Node-24-capable versions: `actions/checkout` v6+, `actions/setup-node` v6+,
   `oven-sh/setup-bun` v2.2+, `actions/upload-artifact` v7+, `actions/download-artifact` v8+
   (the v4 artifact actions are node20 — GitHub force-runs them on node24 and warns). Confirm
   each action declares `runs.using: node24` (`gh api repos/<owner>/<repo>/contents/action.yml
   --jq ...` or read action.yml).
2. **Least privilege.** Workflow-level `contents: read`. Elevate per job:
   `contents: write` ONLY on `release`; `id-token: write` ONLY on `publish`. Set
   `persist-credentials: false` on any checkout that does not push (everything except
   the `release` job's checkout).
3. **No untrusted data in any `run:` block.** Pass `${{ inputs.* }}`, tag names, refs,
   and tokens through `env:` and read them as `$VAR`. Zero `${{ }}` inside shell — this
   is the script-injection class and has caused real compromises.
4. **npm Trusted Publishing via OIDC** (tokenless, provenance auto-attached). **NEVER an
   `NPM_TOKEN`/`NODE_AUTH_TOKEN` secret** — see the ⛔ banner at the top of this file; a
   token-based publish is both insecure and incompatible with provenance + Trusted Publishing.
   The `publish` job carries `id-token: write` and nothing else. npm matches
   the **top-level workflow filename** in the OIDC claim, so keep `npm publish` INLINE in
   `publish.yml` (NOT in a reusable sub-workflow) and register only `publish.yml` on
   npmjs.com. Do NOT `npm install -g npm@latest` in the credentialed step — rely on the
   npm bundled with Node 24 and assert the floor fail-closed (`npm --version` ≥ 11.5.1).
5. **Release notes = GitHub-native.** `gh release create <tag> --generate-notes
   --verify-tag`. Never build notes from `git log | grep | sed`.
6. **No double-publish.** A release created with the default `GITHUB_TOKEN` does NOT
   re-trigger `release: published`, so the dispatch path publishes inline in the same run.
7. **Branch-protection-compatible, tag-only releases.** main blocks direct pushes, so the
   release job must NOT push to main:
   - Derive the next version from the latest git **tag** (not package.json, which goes
     stale on a protected branch): `git tag --list 'v*' --sort=-v:refname | head -1`,
     then `npm version <base> --no-git-tag-version --allow-same-version` + the bump.
   - Commit the bump LOCALLY, then `git push origin "refs/tags/<tag>"` ONLY. `refs/tags/*`
     is not covered by a branch ruleset; `refs/heads/main` is never written. package.json
     `version` on main becomes informational — tag + npm are the source of truth.
   - Gate the release job to main: `if: github.event_name == 'workflow_dispatch' &&
     github.ref == 'refs/heads/main'`, and split the publish `if:` by event so a dispatch
     whose release job was skipped can't fall through with an empty ref.
8. **Verify ref vs package.json before publishing.** Fail closed on mismatch AND on an
   empty ref. Stable versions → `latest` dist-tag; prerelease (`-` in version) → `next`,
   so prereleases never clobber `latest`.
9. **Confirm merged to `origin/main` BEFORE dispatching publish.** The publish workflow
   releases from `origin/main` at run time, not from your local tree — so a dispatch on an
   unmerged/blocked push ships the OLD code under a NEW version (and it can briefly become the
   `latest` dist-tag). Gate the dispatch on: PR **merged**, `HEAD == origin/main`, working
   tree clean; then watch the run; then verify the published tarball's **contents** (not just
   its version) before any consumer adopts it. Full procedure: §"Release-dispatch discipline".

## First-time setup (one-time, manual — the npm side)

The workflows above publish via OIDC Trusted Publishing, which **cannot be configured for a
package that does not exist yet**. So the FIRST publish is manual; the workflow takes over for
every release after. Do this once per package, in order:

1. **npm org/scope.** Ensure the scope's org exists on npmjs.com (e.g. `@your-scope`) and you
   have publish rights. `npm whoami` to confirm you're logged in (`npm login` if not).
2. **Bootstrap publish (manual, authenticated).** From a clean build, publish the first version
   yourself — this creates the package on the registry:
   ```bash
   bun run build
   npm publish --access public   # add --otp=<code> if your npm account has 2FA
   ```
   This first publish has **no provenance** — expected; OIDC publishes afterward attach it.
3. **Tag the bootstrap version.** The release workflow derives the next version from the latest
   `v*` tag; without this it starts from `0.0.0` and would regress `latest`:
   ```bash
   git tag vX.Y.Z && git push origin vX.Y.Z   # X.Y.Z = the version you just published
   ```
4. **Register the Trusted Publisher.** npmjs.com → the package → **Settings → Trusted Publisher
   → GitHub Actions**: Organization/User = `<owner>`, Repository = `<repo>`, **Workflow filename
   = `publish.yml`**, Environment = (blank). This is what lets the workflow publish tokenlessly —
   until it is registered, the `publish` job fails auth.
5. **package.json `repository.url`** must match the repo (it's in the scaffold) — required for
   provenance, else publish fails `E422`.
6. **Branch protection.** Apply the repo ruleset (next section) so the tag-only release flow is
   safe on a protected `main`.

After this, every release is one action — **Actions → Release → Run workflow** (pick
`patch`/`minor`/`major`/`prerelease`), or `gh workflow run publish.yml -f release_type=patch
--ref main`. No tokens; provenance is automatic; prereleases go to the `next` dist-tag.

## Release-dispatch discipline (confirm the change is merged BEFORE you publish)

`main` is **PR-only** (the ruleset above) and the publish workflow cuts a release from **whatever
`origin/main` points at when it runs** — not from your local working tree. So dispatching publish before
your change has actually landed on `origin/main` publishes a new version of the **OLD** code (and it can
briefly become the npm `latest` dist-tag). **Never dispatch publish on an unconfirmed or blocked push.**

Before `gh workflow run publish.yml` (or the Actions UI dispatch), in order:

1. **Confirm the change is on `origin/main`.** The PR is **merged** (not just open/green) and the commit is
   the head of `origin/main`: `git fetch origin && git log -1 origin/main` shows your change; `gh pr view
   <n> --json state,mergedAt,mergeCommit` is `MERGED`. A dispatch whose PR isn't merged publishes old code.
2. **Confirm the working tree matches `origin/main`.** `git status` clean and `git rev-parse HEAD` ==
   `git rev-parse origin/main` — so what you verified locally is exactly what will be packed.
3. **Dispatch, then watch the run to completion.** `gh run watch` (or Actions UI) — confirm the `release`
   and `publish` jobs both go green; a red/sk­ipped publish means nothing shipped.
4. **Verify the published artifact's CONTENTS before any consumer adopts it.** Don't trust the version
   number — confirm the tarball actually contains the change: `npm view <pkg> version dist-tags`, then
   inspect (`npm pack <pkg>@<version>` + unpack, or `npm view <pkg>@<version>`) to confirm the changed
   files/exports are present. Only then bump the consumer's dependency.
5. **If you published the wrong code:** ship the corrected version immediately and `npm deprecate
   <pkg>@<bad-version> "accidental publish — use <good-version>+"` (needs npm auth) so consumers don't
   adopt the spurious one.

This is also encoded as rule 9 below and a gotcha in "Gotchas to encode".

## Branch protection (repo ruleset — apply via `gh api`, not a workflow)

This is a repository ruleset, not CI. Apply once:

```bash
gh api -X POST repos/<owner>/<repo>/rulesets \
  --input - <<'JSON'
{
  "name": "protect-main",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [],
  "conditions": { "ref_name": { "include": ["refs/heads/main"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    { "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "lint" }, { "context": "types" },
          { "context": "test" }, { "context": "build" }
        ]
      }
    }
  ]
}
JSON
```

- Target `main`, enforcement active, `bypass_actors: []` — **NO bypass, admins included**.
- Require a pull request; `required_approving_review_count: 0` for a solo maintainer (you
  can't approve your own PR — a non-zero count would lock you out).
- Required status checks = the ci.yml job names (`lint`, `types`, `test`, `build`),
  strict (branch must be up to date).
- Block force-push (`non_fast_forward`) and `deletion`.
- Repo setting: `delete_branch_on_merge = true`:
  ```bash
  gh api -X PATCH repos/<owner>/<repo> -F delete_branch_on_merge=true
  ```

## Gotchas to encode

- **PR head can lag the branch.** After pushing a follow-up commit to an open PR, confirm
  `gh pr view <n> --json headRefOid` caught up BEFORE merging — a merge at the stale head
  silently drops the new commit.
- **Publish dispatched before the merge landed → ships OLD code.** The workflow releases from
  `origin/main` at run time. Dispatching before your PR is merged (main is PR-only) publishes
  a new version of the prior code, which can briefly become `latest`. Always confirm PR
  **merged** + `HEAD == origin/main` first, then verify the published tarball's contents
  (rule 9 / §"Release-dispatch discipline").
- **Concurrency reuse / parent-child deadlock.** ci.yml keeps a `github.workflow`-scoped
  group so a push-to-main CI run (`CI-<ref>`) can't cancel a release's reused checks
  (`Release-<ref>`). But publish.yml MUST use a DIFFERENT literal group (`publish-<ref>`): if
  it also used `github.workflow` it would be `Release-<ref>` — the SAME group its reused
  `check` computes (github.workflow = the caller) — so the parent holds the slot while the
  child waits → deadlock, and the reusable workflow never starts.
- **Tag-only release vs. package.json.** On a protected branch package.json `version`
  drifts behind the tags; always derive the next version from the latest tag, and treat
  package.json `version` on main as informational.
- **Cumulative release notes.** Each version tag sits on a separate bump commit that is NOT
  an ancestor of the next, so `gh release create --generate-notes` can't auto-detect the
  previous tag and lists the FULL history (every release repeats all prior PRs). Pass the
  previous tag explicitly via `--notes-start-tag` (the `prev_tag` step output) for a correct
  delta. Flag prerelease tags `--prerelease` so an rc isn't surfaced as the repo's "Latest".

## Optional hardening (recommended, included above)

The template already separates **build** from the **credentialed publish**: the `package`
job (no `id-token`) runs install + build + validate and uploads the tarball; the minimal
`publish` job (`id-token: write`) downloads it and runs ONLY `npm publish`. This keeps
dependency postinstall scripts from ever executing with the OIDC token in scope. Safe when
the package has `files: ["dist", …]` and **no `prepublish`/`prepack` lifecycle scripts**.
If you must keep it simpler, collapse `package` + `publish` into one job — but then build
runs in the credentialed job and postinstall sees the token; only do that if you fully
trust the dependency tree.

## Acceptance

- Both YAML files parse; `actionlint` is clean; every `uses:` is SHA-pinned with a
  `# vX.Y.Z` comment.
- A `workflow_dispatch` on main cuts `vX.Y.Z`, pushes ONLY the tag, creates a release with
  native notes, and publishes via OIDC — with main's branch protection fully intact.
- `gh pr checks` shows `lint` / `types` / `test` / `build` green on PRs; direct pushes to
  main are rejected for everyone (admins included).
