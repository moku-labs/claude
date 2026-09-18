---
name: moku-sync
description: >
  Maintainer skill for THIS repo (the moku Claude Code plugin). Syncs a moku-family
  framework's skill + plugin index with its upstream npm/GitHub release: detects whether a
  new version shipped, and if so regenerates the framework's API-form section + plugin
  index and registers the new version with /moku:upgrade. Extensible to any moku-family
  framework via the shared registry. Use when: a new @moku-labs/web (or @moku-labs/core, or
  future moku-family) release ships; the user says "update the moku-web skill / check for
  new moku framework releases / sync moku frameworks / is there anything new in moku-web";
  or as a periodic freshness check. Read-only `--check` mode reports new versions without
  changing files.
---

# moku-sync — keep moku-family skills current with upstream

This is a **maintainer skill** for the moku plugin repo (it ships with the plugin, like
its sibling `spec-sync`, but only acts inside this repo). It is the
counterpart to `/moku:upgrade`: `/moku:upgrade` bumps a *consumer project's* dependency;
`moku-sync` keeps *this plugin's teaching material* (skills + plugin indexes) in step with
what those frameworks actually ship.

**Single source of truth:** [`skills/moku-core/references/moku-frameworks.md`](../moku-core/references/moku-frameworks.md)
— the moku-family framework registry. This skill loops over its `frameworks[]` entries;
nothing here is hard-coded per framework, so a new framework is onboarded by adding a
registry row (see "Onboarding a new framework" below), not by editing this skill.

## Arguments

- `moku-sync` — sync every framework in the registry.
- `moku-sync <key>` — sync one framework (e.g. `moku-sync web`).
- `moku-sync --check` (or `moku-sync <key> --check`) — **report only**: detect new
  versions and what changed; write nothing.

## Preconditions

- Run from the moku plugin repo root (a `.claude-plugin/plugin.json` with `"name": "moku"`
  exists). In any other project, STOP and report — this skill maintains the plugin itself.
- Network access to `github.com` / `raw.githubusercontent.com` / `registry.npmjs.org`
  (via `gh`, `curl`, or `WebFetch`). If unavailable, STOP and report — never fabricate an
  API surface or plugin catalog; an invented entry in a skill agents trust is worse than a
  stale one.

## Process

### 1. Load the registry
Read `skills/moku-core/references/moku-frameworks.md`, parse the ```json``` block.
Select the target entries (all, or the one matching `<key>`).

### 2. Resolve the upstream latest version (per framework)
Use the entry's `releaseSource`. Prefer, in order:
1. `gh release view --repo <owner>/<repo>` / `gh api repos/<owner>/<repo>/releases/latest`
2. `npm view <npm> version` (and `npm view <npm> dist-tags`)
3. `curl` the `packageJson` raw URL and read `version`.

Record `latest`. If the source is unreachable, STOP for that framework and report.

### 3. Detect "is there anything new?"
Compare `latest` against the registry `knownVersion` (semver):
- **Equal** → report `"<npm>: up to date at <version> — nothing new"`. Do not modify files.
- **`knownVersion` is `null`** → treat as a first sync (everything is "new").
- **`latest` is newer** → there are new things; continue to step 4.

In `--check` mode, stop here and report the per-framework verdict + (if newer) a one-line
summary of the release notes between `knownVersion` and `latest`. Change nothing.

### 4. Gather the upstream catalog
Fetch, for the `latest` version:
- Release notes for every version `> knownVersion` up to `latest` (the changelog delta).
- `package.json` — `version`, `exports`, `dependencies`/`peerDependencies` (capture the
  `@moku-labs/core` range for `dependsOn` ordering).
- `llms.txt` / `llms-full.txt` if present (preferred structured catalog), else the README
  plugin table.
From these, extract: the **API form** (createApp/createPlugin/createCore signatures + a
minimal usage example), and the **plugin catalog** (per plugin: kind core/regular, purpose,
emitted events + payloads, context API, config keys).

### 5. Regenerate the framework's teaching material
- **Plugin index** (`pluginIndex`, e.g. `skills/moku-web/references/plugin-index.md`):
  fill every `<!-- sync:populate X -->` section (API, plugins, properties, events, usage),
  update the header `Synced version`, and remove the "PENDING FIRST SYNC" status banner.
  Keep the `sync:populate` markers for the next run.
- **Skill API section** (`skill`/SKILL.md): update the **minimal** API-form section to
  match the new signatures. Keep edits surgical — update the API/usage block and link to
  the regenerated plugin index; do not rewrite unrelated guidance. Follow the moku-core
  [Public Export Shape](../moku-core/SKILL.md) convention for any export
  examples (explicit, individually-documented consts — never destructured).
- If new **plugins / events / commands** appeared, call them out in the report.

### 6. Wire /moku:upgrade
- Update the registry entry's `knownVersion` to `latest`.
- Ensure the `upgrade.migrationId` migration exists in
  [`skills/moku-core/references/upgrade-migrations.md`](../moku-core/references/upgrade-migrations.md)
  with the `detect → apply → verify → rollback` shape: detect = `package.json` contains
  `detect.packageJsonDep`; apply = bump that dependency to `latest` (respect
  `distTagPolicy`); verify = project verify gate; rollback = restore the prior range.
  The migration body reads the version **from the registry**, so a routine version bump
  only touches `knownVersion` here — not the migration text.
- If the framework's required `@moku-labs/core` range changed, note it so the core
  migration ordering (`dependsOn`) stays correct.

### 7. Verify & report
- Re-read the regenerated index and skill; confirm no `PENDING`/placeholder markers remain
  in populated sections.
- Report per framework:
  - `up to date` (no change), or
  - `synced <npm> <knownVersion> → <latest>` with: new plugins, new events, new/changed
    commands, API changes, and the files written.
- Never commit and never `--no-verify`. Leave changes staged for the maintainer to review,
  bump the plugin version (`plugin.json` + `marketplace.json` + `CHANGELOG.md`), and ship.

## Onboarding a new moku-family framework

1. Add a `frameworks[]` entry to `skills/moku-core/references/moku-frameworks.md`
   (`key`, `npm`, `repo`, `layer`, `knownVersion: null`, `skill`, `pluginIndex`,
   `dependsOn`, `detect`, `releaseSource`, `upgrade`).
2. Create `skills/<key>/SKILL.md` and `skills/<key>/references/plugin-index.md` (copy the
   moku-web index template).
3. Run `moku-sync <key>` to populate from upstream.

That is the entire extension path — this skill, `/moku:upgrade`, and the registry all
iterate the registry generically, so future moku-family frameworks (and the "migrate out
of vibe-coded" / TS7 jumps tracked in `upgrade-migrations.md`) plug in with data only.
