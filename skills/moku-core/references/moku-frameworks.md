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
JSON** (`https://registry.npmjs.org/<npm>` → `dist-tags.latest`). `@moku-labs/web` ships an
upstream `llms.txt`/`llms-full.txt` (since 0.4.0) — the preferred structured catalog — which
`moku-sync` reads and cross-checks against `package.json` `exports` + `src/plugins/*`; when the
llms files and the source disagree, **the source wins** (observed at 1.6.1).
`@moku-labs/core` ships its own `llms.txt`/`llms-full.txt` since 0.1.1 (cross-check against
`src/index.ts`, the sole public-surface authority); pre-0.1.1 it had none.

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
      "knownVersion": "0.1.2",
      "skill": "skills/moku-core",
      "pluginIndex": null,
      "dependsOn": [],
      "detect": { "packageJsonDep": "@moku-labs/core" },
      "releaseSource": {
        "npm": "https://registry.npmjs.org/@moku-labs/core",
        "github": "https://github.com/moku-labs/core",
        "tagGlob": "v*",
        "packageJson": "https://raw.githubusercontent.com/moku-labs/core/main/package.json",
        "llms": "https://raw.githubusercontent.com/moku-labs/core/main/llms-full.txt"
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
      "knownVersion": "1.6.2",
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
        "llms": "https://raw.githubusercontent.com/moku-labs/web/main/llms-full.txt"
      },
      "upgrade": { "migrationId": "moku-web-version", "distTagPolicy": "stable->latest,prerelease->next" }
    }
  ]
}
```

> **Provenance of the `core` entry:** synced against `@moku-labs/core@0.1.2` (npm `latest`,
> published 2026-06-09, gitHead `9d02b96e` = GitHub tag `v0.1.2` — the first core version with a
> GitHub release; 0.1.1 had no tag, npm trusted-publish only). **0.1.1 → 0.1.2 delta:** hardening
> release from a multi-agent audit, shipped as individually reviewed PRs: (#3) **guarded `onError`** —
> a throwing error handler never aborts hook dispatch or leaks an unhandled rejection from the
> fire-and-forget `emit`; a throwing framework handler no longer blocks the consumer handler (specs
> 07/13 updated); (#6) `createCoreConfig`'s **`Events` default changed `Record<string, never>` →
> `Record<never, never>`** so frameworks that omit `Events` keep strict hook names (typo'd hooks are
> now compile errors); (#4) **`CreateCoreOptions.plugins` is now `readonly AnyPluginInstance[]`** —
> accepts `as const` tuples; technically a breaking *type* change for code that read the option as a
> mutable array; (#5) **`require()` on a registered api-less plugin returns a shared frozen `{}`**
> (matching `ExtractApi` and agreeing with `has()`) instead of a misleading "not registered" throw —
> all three call sites (plugin ctx, callback ctx, `app.require`); (#2) the **sandbox vitest suite
> (500+ tests) now runs in CI** + pre-commit; (#7) **docs-truth pass** — two runtime exports, real
> bundle size (**< 8KB gzipped**, was "< 5KB"), reserved names now documented to include
> `global`/`state` (the kernel always rejected them), removed the unimplemented "required configs are
> a compile-time guarantee" claim, fixed the `onError` JSDoc that promised teardown-failure handling
> (it handles hook-dispatch failures only; lifecycle errors propagate to the caller). **Public export
> names are unchanged** (`src/index.ts`, the sole public-surface authority, is untouched) — still
> `createCoreConfig` + `createCorePlugin` plus the type-only exports; zero runtime dependencies;
> engines `node >=22` / `bun >=1.3.8`. Known upstream doc lag at v0.1.2: spec `11-INVARIANTS.md`
> §1.4 still carries the "compile-time required configs" claim that #7 removed from spec 05/README —
> spec 05 §2/§8 is the corrected rule. The vendored spec + sandbox re-pinned to `9d02b96e` via
> `spec-sync`: 5 spec files changed (03/05/07/11/13), 0 of the 48 curated sandbox exemplars changed.
> Note `@moku-labs/web@1.6.2` still pins `@moku-labs/core@0.1.1` exactly — consumers that depend
> only on web stay on 0.1.1 until web ships a bump (`dependsOn` ordering: core before web).
>
> **Provenance of the `web` entry:** synced against `@moku-labs/web@1.6.2` (npm `latest`,
> published 2026-06-09, gitHead `5521931`; 1.6.2 is a patch over 1.6.1 — one spa behavior fix
> (PR #56): the nav scroll-to-top now honours the page's `scroll-behavior` when view transitions
> are OFF, keeping `behavior: "instant"` only when they're ON to protect the VT snapshot.
> **API surface identical:** the `v1.6.1..v1.6.2` diff touches only `src/plugins/spa/kernel.ts`
> (private `applyPendingScroll`) + its unit test + the `package.json` version field — no change to
> `src/index.ts`, `src/browser.ts`, plugin exports, config keys, events, or deps. The
> plugin/property catalog in `skills/moku-web/references/plugin-index.md` was generated from the
> source at `../web` (`src/plugins/*` + `src/index.ts` + `src/browser.ts` at tag `v1.6.1`) and
> verified unchanged at tag `v1.6.2`, cross-checked against the upstream
> `llms.txt`/`llms-full.txt` and `package.json` — note the llms files at 1.6.1 (byte-identical at
> 1.6.2) lag the source in two places (they still mention the removed `app.router.set()`
> and the dropped `URLPattern` requirement), so **`src/` is authoritative**. **0.5.6 → 1.6.1
> delta:** v1.0.0 was a breaking overhaul — ctx-based route handlers (`.load((ctx) => D)` with
> `{ params, locale, require, has }`; `.generate((ctx) => params[])`; loaders pull siblings via
> `ctx.require(contentPlugin)`), **`.parse()` removed** (fetched JSON is used directly as
> `ctx.data`; miss/malformed → HTML fallback), global `{ stage, mode }` config (3-valued `stage`;
> `mode` moved out of router config), declarative-only routes (`router.set()` removed), and the
> content plugin became an isomorphic shell + composable providers
> (`fileSystemContent({ contentDir, … })`). New since 0.5.6: the node-only **`cliPlugin`**
> (`app.cli.build/serve/preview/deploy`, boxed Panel TUI, guided deploy wizard, incremental dev
> rebuilds — no `bin`), `createUrls(routes, defaultLocale?)`, `ctx.url` in render/head,
> `head.siteHead`, build `ogImage.defaultCard` / `notFound.path` / `template` placeholders, native
> RegExp route matching (URLPattern dropped, v1.4.1), and default-locale **bare paths** for
> `{lang:?}` routes (v1.6.0). `@moku-labs/web` now pins **`@moku-labs/core@0.1.1`** exactly (was
> 0.1.0-alpha.6), so a consumer that depends only on `@moku-labs/web` gets the right core
> transitively and must NOT add a direct `@moku-labs/core` dependency. Engines: node ≥24, bun ≥1.3.14.

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
| `releaseSource` | `npm` (version-of-truth via `dist-tags.latest`), `github`/`releases` (notes), `packageJson` (deps/exports), `llms` (upstream `llms-full.txt` when present — `web` since 0.4.0; `null` for `core`). |
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
`skills/moku-sync/SKILL.md`.
