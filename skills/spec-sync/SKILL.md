---
name: spec-sync
description: >
  Maintainer skill for THIS repo (the moku Claude Code plugin). Brings ALL Moku spec AND knowledge
  in sync across the moku family: re-vendors the upstream Moku Core specification + curated sandbox
  exemplars from github.com/moku-labs/core into skills/moku-core/references/ (pinned to a resolved
  SHA), regenerates spec-index.md + sandbox-index.md, then chains the moku-sync skill to refresh
  every moku-family framework's plugin index + skill API form from its release. Use when:
  @moku-labs/core ships spec changes; you updated/bumped core and want the vendored spec plus all
  framework knowledge brought in sync; the user says "make sure all moku spec and knowledge is in
  sync", "I updated core — new version, sync the spec", "re-vendor the moku core spec", "sync moku
  spec/knowledge", or as a periodic spec-freshness check. Read-only `--dry-run`/`--check` reports
  what would change without writing.
---

# spec-sync — keep the vendored Moku spec + all family knowledge current

This is a **local maintainer skill** for the moku plugin. It is the spec-and-knowledge counterpart
to the per-framework [`moku-sync`](../../.claude/skills/moku-sync/SKILL.md) skill: where `moku-sync`
refreshes a framework's *teaching material* (plugin index + skill API form) against an npm release,
`spec-sync` re-vendors the authoritative **Moku Core specification** and **sandbox style exemplars**
from source — then runs `moku-sync` so a single prompt brings the **whole family** in sync.

It refreshes **two** vendored upstream sets, both pinned to the same resolved SHA:
- The **specification** (`specification/` → `skills/moku-core/references/spec/`, index `spec-index.md`).
- The curated **sandbox** style exemplars (`tests/sandbox/` → `skills/moku-core/references/sandbox/`,
  index `sandbox-index.md`).

Source repo: `github.com/moku-labs/core`.

## Arguments (parsed from the prompt)

- `--ref <branch|tag|sha>` — git ref to vendor from. Default: `main` (then pinned to the resolved
  commit SHA, never to the moving `main` pointer).
- `--spec-only` / `--sandbox-only` — limit the Core refresh to one set (default: both).
- `--no-family` — do the Core spec/sandbox refresh only; skip the chained `moku-sync` family pass.
- `--dry-run` / `--check` — fetch and diff only; report what would change but write nothing
  (and run `moku-sync --check` for the family pass).

## Preconditions

1. Confirm the working directory is the moku plugin repo (a `.claude-plugin/plugin.json` exists).
   If not, STOP: "spec-sync runs inside the moku plugin repo, not a consumer project."
2. Confirm `gh` or `curl` is available. Prefer `gh api` (handles auth + rate limits). If the source
   is unreachable, STOP and report — never fabricate spec content; an invented spec section in a
   skill agents trust is worse than a stale one.

## Phase A — re-vendor the Moku Core spec + sandbox

### A1. Resolve the pinned SHA

```bash
REF="${ARG_REF:-main}"
# Resolve the latest commit that touched the specification path at REF
SHA=$(gh api "repos/moku-labs/core/commits?path=specification&sha=${REF}&per_page=1" --jq '.[0].sha' 2>/dev/null)
[ -z "$SHA" ] && SHA=$(gh api "repos/moku-labs/core/commits/${REF}" --jq .sha 2>/dev/null)
echo "Resolved SHA: $SHA"
```
If `$SHA` is empty, STOP and report the failure (network/auth/rate-limit). Do not write.

Read the SHA currently recorded in `spec-index.md`'s header ("Pinned commit: `...`"). If it equals
`$SHA`, report "Spec already up to date at `<sha>`" and skip to Phase B (unless `--dry-run`, which
still prints the no-op diff).

### A2. Enumerate + fetch

```bash
# List spec files at the resolved SHA
gh api "repos/moku-labs/core/contents/specification?ref=${SHA}" --jq '.[].name'
```
For each `*.md` file, fetch the raw content:
`https://raw.githubusercontent.com/moku-labs/core/${SHA}/specification/<file>`

**Detect added/removed files** by comparing the fetched list against the current contents of
`skills/moku-core/references/spec/`. The upstream sequence currently skips `10-` — do not treat a
missing `10-*` as an error.

### A3. Diff

For each fetched file, diff against the vendored copy. Summarize:
- **Changed**: files whose content differs (short per-file line delta).
- **Added**: upstream files not yet vendored.
- **Removed**: vendored files no longer upstream.
- **Section changes**: re-grep `^## ` headings; report added/removed/renamed H2s (these drive the
  index regeneration).

**If `--dry-run`:** print the diff summary and stop Phase A here (write nothing).

### A4. Apply (spec)

1. Write each changed/added file into `skills/moku-core/references/spec/`.
2. Delete vendored files that were removed upstream.
3. Regenerate `spec-index.md`:
   - Update the header: `Pinned commit`, `Vendored` date (use `date +%F` — do not guess), and the
     missing-number note (recompute from the actual file list).
   - Rebuild the routing table and the per-file section map from the **actual** `^## ` headings of
     the vendored files (never from memory).
   - Preserve the "How to use this index" block verbatim.
4. If any spec file numbering changed, update the cross-link `> Source: spec/NN-*.md` lines in the
   distilled references (`architecture.md`, `core-api.md`, `plugin-system.md`, `type-system.md`,
   `invariants.md`) to match.

### A5. Refresh the sandbox exemplars (unless `--spec-only`)

The sandbox is a **curated subset** — do not blindly mirror all ~108 upstream files. Refresh only
the files already vendored under `skills/moku-core/references/sandbox/`:

1. For each currently-vendored path `P` under `sandbox/`, fetch
   `https://raw.githubusercontent.com/moku-labs/core/${SHA}/tests/sandbox/<P>` and diff against the
   vendored copy. Write changed files; report any path that 404s upstream (it moved/was removed —
   flag for manual curation, do not silently drop).
2. Do **not** auto-add new upstream files to the curated set — adding a new exemplar is a human
   curation decision. List notable new upstream files (e.g. a new `plugins/<tier>/`) as candidates.
3. Regenerate `sandbox-index.md`'s header (`Pinned commit`, `Vendored` date). Re-verify the style
   cheat-sheet against the refreshed files; update any claim that changed.

If `--sandbox-only`, skip A2–A4 (spec) and run only A1 + this step.

## Phase B — sync the rest of the family (chain `moku-sync`)

**Skip if `--no-family`.** A spec change in `@moku-labs/core` usually rides with framework releases,
so after the Core spec/sandbox is current, refresh every framework's teaching material in one pass:

- Invoke the **`moku-sync`** skill (no key = all frameworks in
  `skills/moku-core/references/moku-frameworks.md`). It resolves each `releaseSource` latest, and for
  any framework behind its registry `knownVersion` it regenerates the plugin index + skill API form
  and bumps `knownVersion`.
- In `--dry-run`/`--check` mode, run `moku-sync --check` (report-only) instead.

This is what makes one prompt sync **all spec AND knowledge across the moku family** — Core spec +
sandbox here, framework indexes via `moku-sync`.

## Report

Print a single umbrella report:
- **Spec (Phase A):** Old SHA → New SHA · files changed / added / removed (counts + names) +
  section-level index changes. Sandbox: files changed + any path that 404'd + new-exemplar candidates.
- **Family (Phase B):** per framework — `up to date`, or `synced <npm> <old> → <new>` with the files
  `moku-sync` wrote (delegate to its report).
- A reminder: "Review the diff, then bump the plugin version + add a CHANGELOG entry if the vendored
  spec/sandbox or any framework index changed (per project release convention — see `/ship`)."

Do **not** auto-commit. Do **not** touch the plugin cache. Leave everything staged for the maintainer.
