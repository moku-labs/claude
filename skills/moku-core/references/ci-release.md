# CI + Release/Publish: Framework-Level (Layer-2) Moku Package

Canonical reference for setting up — or auditing — CI and npm publishing for a
**Layer-2 framework package** (published to npm). Layer-3 apps *deploy* instead; see the
deploy targets in [build-final.md](build-final.md) Step 5.10 for those. This file is the
authoritative spec for the **npm Publish** path; do not hand-roll a different release
workflow.

Apply the rationale — these rules exist because the naive form has caused real
compromises and silent release bugs. Don't cargo-cult; understand each rule.

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
      - run: bun test
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

# Scope concurrency by workflow name (see ci.yml note) so a release's reused CI run
# is in the "Release" group and a concurrent push to main can't cancel its checks.
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
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
          base="$(git tag --list 'v*' --sort=-v:refname | head -1)"
          base="${base#v}"
          base="${base:-0.0.0}"
          # Set package.json to the base, then bump — no git tag, no push from npm.
          npm version "$base" --no-git-tag-version --allow-same-version >/dev/null
          new="$(npm version "$RELEASE_TYPE" --no-git-tag-version --preid rc)"
          new="${new#v}"
          echo "version=$new" >> "$GITHUB_OUTPUT"
          echo "tag=v$new" >> "$GITHUB_OUTPUT"
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
          GH_TOKEN: ${{ github.token }}
        run: |
          set -euo pipefail
          # Native notes — never hand-roll from `git log | grep | sed` (processes
          # attacker-influenceable commit text). --verify-tag fails closed if the tag is missing.
          # A release created with the default GITHUB_TOKEN does NOT re-fire release:published,
          # so the publish job below runs inline in this same run for the dispatch path.
          gh release create "$TAG" --generate-notes --verify-tag --title "$TAG"

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
        run: npm pack --pack-destination dist-pack
      - uses: actions/upload-artifact@<SHA> # v4.4.0
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
      - uses: actions/download-artifact@<SHA> # v4.1.8
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
          npm publish "dist-pack"/*.tgz --tag "$tag" --access public
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
   `oven-sh/setup-bun` v2.2+. Confirm each action declares `runs.using: node24`
   (`gh api repos/<owner>/<repo>/contents/action.yml --jq ...` or read action.yml).
2. **Least privilege.** Workflow-level `contents: read`. Elevate per job:
   `contents: write` ONLY on `release`; `id-token: write` ONLY on `publish`. Set
   `persist-credentials: false` on any checkout that does not push (everything except
   the `release` job's checkout).
3. **No untrusted data in any `run:` block.** Pass `${{ inputs.* }}`, tag names, refs,
   and tokens through `env:` and read them as `$VAR`. Zero `${{ }}` inside shell — this
   is the script-injection class and has caused real compromises.
4. **npm Trusted Publishing via OIDC** (tokenless, provenance auto-attached). npm matches
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
- **Concurrency reuse.** Reusing ci.yml across CI and publish requires the
  `github.workflow`-scoped concurrency group above, or a concurrent push to main can
  cancel a release's checks.
- **Tag-only release vs. package.json.** On a protected branch package.json `version`
  drifts behind the tags; always derive the next version from the latest tag, and treat
  package.json `version` on main as informational.

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
