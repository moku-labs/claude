# Moku-Family Framework Registry

The single source of truth for every **published Moku-family framework** the toolkit
knows how to teach (via a skill), index (plugin/property catalog), and keep current
(`/moku:upgrade` + the `moku-sync` maintenance skill).

This file is the integration point between three systems:

- **Skills** — each framework has a skill that teaches its API and patterns.
- **`/moku:upgrade`** — reads this registry to offer bumping any *depended-on* framework
  in a consumer project to its registry version (migrations `moku-web-version` /
  `moku-core-version` in [upgrade-migrations.md](upgrade-migrations.md)).
- **`moku-sync`** (local maintainer skill) — polls each framework's release source,
  detects new versions, and regenerates the skill + plugin index + this registry.

> **Extending to a new moku-family framework:** add one entry to the JSON block below,
> create `skills/<name>/SKILL.md` + `skills/<name>/references/plugin-index.md` (copy the
> moku-web index), then run `moku-sync <name>`. No code changes — every consumer of this
> registry loops over its entries generically.

## Registry (machine-readable)

`knownVersion` is the last version this toolkit was synced against. `moku-sync` updates it
after a successful sync; a value behind the upstream latest is exactly the signal that
"there is something new." **Version-of-truth for detecting new releases is the npm registry
JSON** (`https://registry.npmjs.org/<npm>` → `dist-tags.latest`) — these packages do NOT
ship `llms.txt`, so the plugin catalog is rebuilt from `package.json` `exports` + the repo
README plugin table + `src/plugins/*`.

```json
{
  "schemaVersion": 1,
  "frameworks": [
    {
      "key": "core",
      "npm": "@moku-labs/core",
      "repo": "https://github.com/moku-labs/core",
      "localClone": "../core",
      "layer": 1,
      "role": "kernel",
      "knownVersion": "0.1.0-alpha.6",
      "skill": "skills/moku-core",
      "pluginIndex": null,
      "dependsOn": [],
      "detect": { "packageJsonDep": "@moku-labs/core" },
      "releaseSource": {
        "npm": "https://registry.npmjs.org/@moku-labs/core",
        "github": "https://github.com/moku-labs/core",
        "tagGlob": "v*",
        "packageJson": "https://raw.githubusercontent.com/moku-labs/core/main/package.json",
        "llms": null
      },
      "upgrade": { "migrationId": "moku-core-version", "distTagPolicy": "stable->latest,prerelease->next" }
    },
    {
      "key": "web",
      "npm": "@moku-labs/web",
      "repo": "https://github.com/moku-labs/web",
      "localClone": "../web",
      "layer": 2,
      "role": "framework",
      "knownVersion": "0.3.1",
      "skill": "skills/moku-web",
      "pluginIndex": "skills/moku-web/references/plugin-index.md",
      "dependsOn": ["@moku-labs/core"],
      "detect": { "packageJsonDep": "@moku-labs/web" },
      "releaseSource": {
        "npm": "https://registry.npmjs.org/@moku-labs/web",
        "github": "https://github.com/moku-labs/web",
        "tagGlob": "v*",
        "releases": "https://github.com/moku-labs/web/releases",
        "packageJson": "https://raw.githubusercontent.com/moku-labs/web/main/package.json",
        "llms": null
      },
      "upgrade": { "migrationId": "moku-web-version", "distTagPolicy": "stable->latest,prerelease->next" }
    }
  ]
}
```

> **Provenance of the `web` entry:** synced against `@moku-labs/web@0.3.1` (npm `latest`).
> The plugin/property catalog in `skills/moku-web/references/plugin-index.md` was generated
> from the source at `../web` (`src/plugins/*`); v0.3.1 vs the 0.3.0 source is CI + JSDoc
> only — no API change. `@moku-labs/web` pins `@moku-labs/core@0.1.0-alpha.6` exactly, so a
> consumer that depends only on `@moku-labs/web` gets the right core transitively and must
> NOT add a direct `@moku-labs/core` dependency.

## Field reference

| Field | Meaning |
|-------|---------|
| `key` | Short id used by `moku-sync <key>` and migration ids. |
| `npm` | Published package name; also the `package.json` dependency `/moku:upgrade` detects. |
| `repo` / `localClone` | GitHub repo (release + raw-file source) and the optional sibling working copy `moku-sync` can read offline. |
| `layer` | Moku layer: 1 = kernel (`@moku-labs/core`), 2 = framework, 3 = app (not registered — apps deploy, see `ci-release.md`). |
| `knownVersion` | Last synced version. Behind upstream ⇒ "new things available". |
| `skill` / `pluginIndex` | Skill directory this framework backs and the generated plugin/property index (`null` for the kernel — single export). |
| `dependsOn` | Other moku-family packages it requires (ordering hint: upgrade core before web). |
| `detect.packageJsonDep` | Presence of this dep in a consumer's `package.json` ⇒ the framework applies to that project. |
| `releaseSource` | `npm` (version-of-truth via `dist-tags.latest`), `github`/`releases` (notes), `packageJson` (deps/exports). `llms` is `null` — no `llms.txt` upstream. |
| `upgrade.migrationId` | The `/moku:upgrade` migration that bumps this dependency (see `upgrade-migrations.md`). |
| `upgrade.distTagPolicy` | Stable → `latest`, prerelease (`-` in version, e.g. `0.1.0-alpha.6`) → its prerelease tag (mirrors `ci-release.md`). |

## Integration contract — `/moku:upgrade`

For each registry entry, when a consumer project's `package.json` contains
`detect.packageJsonDep`, `/moku:upgrade` runs the entry's `upgrade.migrationId` migration:
bump the dependency to `knownVersion` (respecting `distTagPolicy`), then run the project's
verify gate. Upgrade `@moku-labs/core` before `@moku-labs/web` when both apply
(`dependsOn` order). The migration bodies read the target **from this registry**, so a
routine version bump only edits `knownVersion` here — not the migration text.

## Integration contract — `moku-sync`

`moku-sync` loops over `frameworks[]`, resolves each `releaseSource` latest, compares to
`knownVersion`, and on a newer version regenerates that framework's skill API section +
`pluginIndex`, then writes back the new `knownVersion` here. See
`.claude/skills/moku-sync/SKILL.md`.
