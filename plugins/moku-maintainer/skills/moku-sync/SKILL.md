---
name: moku-sync
description: >
  Maintainer skill for THIS repo (the moku Claude Code plugin). Syncs a moku-family
  framework's skill + plugin index with its upstream npm/GitHub release: detects whether a
  new version shipped, and if so regenerates the framework's API-form section + plugin
  index and registers the new version with the upgrade skill (/moku:upgrade). Extensible to any moku-family
  framework via the shared registry. Use when: a new @moku-labs/web (or @moku-labs/core, or
  future moku-family) release ships; the user says "update the moku-web skill / check for
  new moku framework releases / sync moku frameworks / is there anything new in moku-web";
  or as a periodic freshness check. Read-only `--check` mode reports new versions without
  changing files.
---

# moku-sync — keep moku-family skills current with upstream

This skill ships in the **moku-maintainer** pack and operates on **this repository's working tree**.
The pack is `defaultEnabled: false`, so enable it and run the skill from the repository root. It is
the counterpart to `/moku:upgrade`: `/moku:upgrade` bumps a *consumer project's* dependency;
`moku-sync` keeps *this repository's teaching material* (skills + plugin indexes) in step with
what those frameworks actually ship. All paths below are relative to the repository root.

**Single source of truth:** `plugins/moku/skills/moku-core/references/moku-frameworks.md` — the
moku-family framework registry. This skill loops over its `frameworks[]` entries;
nothing here is hard-coded per framework, so a new framework is onboarded by adding a
registry row (see "Onboarding a new framework" below), not by editing this skill.

## Arguments

- `moku-sync` — sync every framework in the registry.
- `moku-sync <key>` — sync one framework (e.g. `moku-sync web`).
- `moku-sync --check` (or `moku-sync <key> --check`) — **report only**: detect new
  versions and what changed; write nothing.

## Preconditions

- Run from this repository's root: `.claude-plugin/marketplace.json` exists and lists a plugin named
  `moku`. In any other project, stop and report — this skill maintains the repository itself.
- Network access to `github.com` / `raw.githubusercontent.com` / `registry.npmjs.org`
  (via `gh`, `curl`, or `WebFetch`). If unavailable, stop and report. Never fabricate an
  API surface or plugin catalog: an invented entry in a skill agents trust is worse than a
  stale one.

## Process

### 1. Load the registry
Read `plugins/moku/skills/moku-core/references/moku-frameworks.md`, parse the ```json``` block.
Select the target entries (all, or the one matching `<key>`).

### 2. Resolve the upstream latest version (per framework)
Use the entry's `releaseSource`. Prefer, in order:
1. `gh release view --repo <owner>/<repo>` / `gh api repos/<owner>/<repo>/releases/latest`
2. `npm view <npm> version` (and `npm view <npm> dist-tags`)
3. `curl` the `packageJson` raw URL and read `version`.

Record `latest`. If the source is unreachable, stop for that framework and report.

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
- **Plugin index** (the entry's `pluginIndex`, e.g.
  `plugins/moku-web/skills/moku-web/references/plugin-index.md`;
  `plugins/moku-worker/skills/moku-worker/references/plugin-index.md`,
  `plugins/moku-room/skills/moku-room/references/plugin-index.md`):
  fill every `<!-- sync:populate X -->` section (API, plugins, properties, events, usage),
  update the header `Synced version`, and remove the "PENDING FIRST SYNC" status banner.
  Keep the `sync:populate` markers for the next run.
- **Skill API section** (the entry's `skill` + `/SKILL.md`, e.g.
  `plugins/moku-web/skills/moku-web/SKILL.md`): update the **minimal** API-form section to
  match the new signatures. Keep edits surgical — update the API/usage block and link to
  the regenerated plugin index; do not rewrite unrelated guidance. Export examples follow the
  Public Export Shape convention in `plugins/moku/skills/moku-core/SKILL.md` (explicit,
  individually-documented consts, not destructured).
- If new **plugins / events / commands** appeared, call them out in the report.

### 6. Wire the upgrade skill (`/moku:upgrade`, `plugins/moku/skills/upgrade/`)
- Update the registry entry's `knownVersion` to `latest`.
- Ensure the `upgrade.migrationId` migration exists in
  `plugins/moku/skills/moku-core/references/upgrade-migrations.md` with the `detect → apply → verify → rollback` shape: detect = `package.json` contains
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
- Do not commit and do not pass `--no-verify`. Leave the changes in the working tree for the
  maintainer to review, then bump every affected pack: each
  `plugins/<name>/.claude-plugin/plugin.json` **and** that plugin's entry in
  `.claude-plugin/marketplace.json` move to the same version — `claude plugin tag` validates that
  they agree — plus a CHANGELOG entry (history through 0.62 lives in `docs/changelog/0.1-0.62.md`).

## Onboarding a new moku-family framework

1. Create the pack from `docs/pack-template/` — `plugins/moku-<key>/` with
   `.claude-plugin/plugin.json` (`dependencies: ["moku"]`), `skills/moku-<key>/SKILL.md`,
   `skills/moku-<key>/references/plugin-index.md` and at least one `evals/` case. The template's
   README has the five steps, including the `.claude-plugin/marketplace.json` entry.
2. Add a `frameworks[]` entry to `plugins/moku/skills/moku-core/references/moku-frameworks.md`
   (`key`, `npm`, `repo`, `layer`, `knownVersion: "0.0.0"`, `pack`, `skill`, `pluginIndex`,
   `dependsOn`, `detect`, `releaseSource`, `upgrade`).
3. Run `moku-sync <key>` to populate from upstream.

That is the entire extension path — this skill, `/moku:upgrade`, and the registry all
iterate the registry generically, so future moku-family frameworks (and the "migrate out
of vibe-coded" / TS7 jumps tracked in `upgrade-migrations.md`) plug in with data only.
