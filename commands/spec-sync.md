---
description: Refresh the vendored Moku Core specification (skills/moku-core/references/spec/) from github.com/moku-labs/core and regenerate the fast index
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, WebFetch
argument-hint: [--ref <branch|tag|sha>] [--dry-run]
disable-model-invocation: true
---

## Moku Core Specification (authoritative)

Before any decision about architecture, the core API, factory chain, config, lifecycle, events, the `ctx` object, types, invariants, or plugin structure — **consult `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/spec-index.md` and open the cited `spec/NN-*.md` file.** The spec is the single source of truth; never rely on memory or guess. Justify any deviation against a cited section, and cite spec section IDs (`spec/NN-*.md §N`) in output. Never stage or commit `.planning/` — it is local-only state.

---

This is a **plugin-maintenance** command. It re-vendors the upstream Moku Core
specification into this plugin and regenerates the fast index. Run it when
`moku-labs/core` ships spec changes. It is **not** meant for consumer projects.

It refreshes **two** vendored upstream sets, both pinned to the same resolved SHA:
- The **specification** (`specification/` → `skills/moku-core/references/spec/`, index `spec-index.md`).
- The curated **sandbox** style exemplars (`tests/sandbox/` → `skills/moku-core/references/sandbox/`,
  index `sandbox-index.md`).

Source repo: `github.com/moku-labs/core`.

## Arguments

- `--ref <branch|tag|sha>` — git ref to vendor from. Default: `main` (the command then
  pins to the resolved commit SHA, never to the moving `main` pointer).
- `--spec-only` / `--sandbox-only` — limit the refresh to one set (default: both).
- `--dry-run` — fetch and diff only; report what would change but write nothing.

## Step 0: Preconditions

1. Confirm the working directory is the moku plugin repo (a `.claude-plugin/plugin.json`
   exists). If not, stop: "spec-sync runs inside the moku plugin repo, not a consumer project."
2. Confirm `gh` or `curl` is available. Prefer `gh api` (handles auth + rate limits).

## Step 1: Resolve the pinned SHA

```bash
REF="${ARG_REF:-main}"
# Resolve the latest commit that touched the specification path at REF
SHA=$(gh api "repos/moku-labs/core/commits?path=specification&sha=${REF}&per_page=1" --jq '.[0].sha' 2>/dev/null)
[ -z "$SHA" ] && SHA=$(gh api "repos/moku-labs/core/commits/${REF}" --jq .sha 2>/dev/null)
echo "Resolved SHA: $SHA"
```
If `$SHA` is empty, stop and report the failure (network/auth/rate-limit). Do not write.

Read the SHA currently recorded in `spec-index.md`'s header ("Pinned commit: `...`"). If
it equals `$SHA`, report "Already up to date at `<sha>`" and stop (unless `--dry-run`,
which still prints the no-op diff).

## Step 2: Enumerate + fetch

```bash
# List spec files at the resolved SHA
gh api "repos/moku-labs/core/contents/specification?ref=${SHA}" --jq '.[].name'
```
For each `*.md` file, fetch the raw content:
`https://raw.githubusercontent.com/moku-labs/core/${SHA}/specification/<file>`

**Detect added/removed files** by comparing the fetched file list against the current
contents of `skills/moku-core/references/spec/`. Note the upstream sequence currently
skips `10-` — do not treat a missing `10-*` as an error.

## Step 3: Diff

For each fetched file, diff against the vendored copy. Produce a summary:
- **Changed**: files whose content differs (show a short per-file line delta).
- **Added**: upstream files not yet vendored.
- **Removed**: vendored files no longer upstream.
- **Section changes**: re-grep `^## ` headings; report any added/removed/renamed H2s
  (these drive the index regeneration).

**If `--dry-run`:** print the diff summary and stop. Write nothing.

## Step 4: Apply

1. Write each changed/added file into `skills/moku-core/references/spec/`.
2. Delete vendored files that were removed upstream.
3. Regenerate `spec-index.md`:
   - Update the header: `Pinned commit`, `Vendored` date (use the system date), and the
     missing-number note (recompute from the actual file list).
   - Rebuild the routing table and the per-file section map from the **actual** `^## `
     headings of the vendored files (never from memory).
   - Preserve the "How to use this index" block verbatim.
4. If any spec file numbering changed, update the cross-link `> Source: spec/NN-*.md`
   lines in the distilled references (`architecture.md`, `core-api.md`, `plugin-system.md`,
   `type-system.md`, `invariants.md`) to match.

## Step 4b: Refresh the sandbox exemplars (unless `--spec-only`)

The sandbox is a **curated subset** — do not blindly mirror all ~108 upstream files. Refresh only
the files already vendored under `skills/moku-core/references/sandbox/`:

1. For each currently-vendored path `P` under `sandbox/`, fetch
   `https://raw.githubusercontent.com/moku-labs/core/${SHA}/tests/sandbox/<P>` and diff against the
   vendored copy. Write changed files; report any path that 404s upstream (it moved/was removed —
   flag for manual curation, do not silently drop).
2. Do **not** auto-add new upstream files to the curated set — adding a new exemplar is a human
   curation decision. Just list notable new upstream files (e.g. a new `plugins/<tier>/`) as
   candidates in the report.
3. Regenerate `sandbox-index.md`'s header (`Pinned commit`, `Vendored` date). Re-verify the
   style cheat-sheet against the refreshed files; update any claim that changed.

If `--sandbox-only`, skip Steps 1–4 (spec) and run only Step 0/1 + this step.

## Step 5: Report

Print:
- Old SHA → New SHA
- Spec: files changed / added / removed (counts + names) + section-level index changes
- Sandbox: files changed (counts + names) + any vendored path that 404'd + new-exemplar candidates
- A reminder: "Review the diff, then bump the plugin version and add a CHANGELOG entry if
  the vendored spec or sandbox changed (per project release convention)."

Do **not** auto-commit. Do **not** touch the plugin cache.
