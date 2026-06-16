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
      "knownVersion": "0.1.4",
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
      "knownVersion": "1.12.3",
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

> **Provenance of the `core` entry:** synced against `@moku-labs/core@0.1.4` (npm `latest`,
> published 2026-06-11, gitHead `dd723ce` = GitHub tag `v0.1.4`). **0.1.3 → 0.1.4 delta:** a
> **type-only fix** with no runtime/behavior change — (#13) `fix(types): PluginLike admits
> core-plugin instances` widens the INTERNAL `PluginLike` constraint so a `createCorePlugin`
> instance satisfies it, plus (#14) the release chore. `PluginLike` is **not** in the public
> surface (`src/index.ts`), so the **public API/exports are unchanged** — `src/index.ts` is
> byte-identical, still `createCoreConfig` + `createCorePlugin` plus the type-only exports; zero
> runtime dependencies; engines `node >=24` / `bun >=1.3.8` (unchanged). **No skill edit:** the
> `moku-core` SKILL.md documents the unchanged API form and pins no version — only `knownVersion`
> moved here. (The vendored spec + sandbox are re-pinned separately by `spec-sync`, not this skill.)
> `@moku-labs/web` now pins `@moku-labs/core@0.1.4` **exactly** (bumped from 0.1.3 in web v1.12.3,
> PR moku-labs/web#75) — so core and web are now **lockstep** on 0.1.4; `dependsOn` ordering (core
> before web) still holds. See the web provenance below.
>
> **Provenance of the `web` entry:** synced against `@moku-labs/web@1.12.3` (npm `latest`,
> published 2026-06-16, GitHub tag `v1.12.3`). **1.12.2 → 1.12.3 is a dep-only release** — it bumped
> `@moku-labs/core` `0.1.3 → 0.1.4` (PR moku-labs/web#75) with **no `src/` change**, so the API form,
> plugin catalog, events, and exports are byte-identical to 1.12.2; only the core pin and version stamp
> moved. The 1.12.2 catalog below remains authoritative — it was regenerated from the source at tag
> `v1.12.2` (via a clean `/tmp` worktree of `../web`), cross-checked against release notes
> (`v1.8.0..v1.12.2`) + `package.json`.
> **1.8.0 → 1.12.2 delta — four content features + SPA/build fixes (8 releases):**
> - **Build-time Mermaid (v1.9.0, #69).** Fenced ` ```mermaid ` blocks render to static inline SVG
>   at build (zero client JS). Provider option `mermaid?: boolean | { mermaidConfig?,
>   renderDiagrams? (test-only seam) }`; requires `trustedContent: true` and the **OPTIONAL peer dep
>   `mermaid-isomorphic@^3.0.0`** (+ playwright/browser).
> - **`::embed` lazy iframe facades + `lazyEmbed` island (v1.10.0, #70; enhanced v1.11.0, #71).**
>   `::embed{src="…" title="…" width? height?}` leaf directives rewrite to a static
>   click-to-activate `<figure data-component="lazy-embed">` — NO iframe (or its network/JS cost)
>   until the reader clicks, when the new **`lazyEmbed`** SPA island swaps in the real
>   `<iframe loading="lazy">`. `src` may be http(s), root-relative, or a co-located relative path
>   resolved to the shared `/<slug>/…` URL; `width`×`height` reserve the box aspect-ratio. Provider
>   option `embed?: boolean | { facade }` (consumer Preact facade; default `EmbedFacadeButton`);
>   requires `trustedContent: true`.
> - **`::gallery` folder galleries (v1.12.0, #72).** `::gallery{src="./images/dir/" caption="…"}`
>   reads the co-located folder at build, sorts its images, rewrites each to its shared `/<slug>/…`
>   URL, and renders them through a Preact component (default `GalleryTrack`, or consumer
>   `gallery.component`) into `<div data-component="gallery">`; the swipe/keyboard/lightbox island is
>   **consumer-provided**. Provider option `gallery?: boolean | { component }`; requires
>   `trustedContent: true`.
> - **SPA/build fixes.** v1.8.1 (#64) titleTemplate applied on DATA-path client nav; v1.8.2 (#67/#68)
>   `llms.txt`/`llms-full.txt` synced to the v1.8.0 cache feature + leave font `url()`s external in
>   the CSS bundle pass; v1.12.1 (#73) always scroll-to-top instant on a nav swap (never CSS smooth);
>   v1.12.2 (#74) announce the nav before the data fetch (feedback during JSON load).
>
> **New public exports (`.`):** runtime `EmbedFacadeButton`, `GalleryTrack`; types
> `EmbedFacade` / `EmbedFacadeProps` / `EmbedOptions` and `GalleryComponent` / `GalleryOptions` /
> `GalleryProps` / `GallerySlide`. **`lazyEmbed`** (+ `createComponent`) is exported from **both** `.`
> and `./browser` (the island runs client-side); the facade/gallery **components + named types are
> `.`-only** build-time concerns (also reachable as `Content.*` via the `Content` namespace on
> `./browser`). **New optional `peerDependency` `mermaid-isomorphic@^3.0.0`** (only when `mermaid` is
> enabled); `preact` / `preact-render-to-string` peers unchanged. No change to
> site/i18n/router/head/build/deploy/cli/data/log/env APIs, events, or config; `PhaseName` unchanged
> (13 phases, incl. `cache-headers`); pins **`@moku-labs/core@0.1.4`** exactly (bumped from 0.1.3 in
> v1.12.3, now lockstep with core); engines node ≥24, bun ≥1.3.14 (unchanged). ⚠️ The upstream
> `llms.txt`/`llms-full.txt` (last synced v1.8.2 for the cache feature) still describe `content` as
> the plain markdown pipeline — **no** Mermaid/`::embed`/`::gallery` — so **`src/` is authoritative**
> (the index below is generated from source).
>
> **Earlier deltas (compressed).** **1.6.2 → 1.8.0:** `preact`+`preact-render-to-string` → peer deps;
> bundle code-splitting; sanitize hardening (`trustedContent` keeps inline styles); router
> percent-encoding; core 0.1.1 → 0.1.3; then **cache protection (v1.8.0, #62)** —
> content-hashed bundle filenames + a `cache-headers` build phase emitting `outDir/_headers`
> (`build.cacheHeaders?: boolean | { assets?, pages? }`, default ON) + split `<!--moku:assets:css/js-->`
> shell placeholders. **0.5.6 → 1.6.1:** the v1.0.0 breaking overhaul — ctx-based route handlers
> (`.load((ctx) => D)`, `ctx.require(contentPlugin)`), **`.parse()` removed**, global `{ stage, mode }`
> config, declarative-only routes (`router.set()` removed), content → isomorphic shell + composable
> providers (`fileSystemContent`); plus the node-only **`cliPlugin`**, `createUrls`, `ctx.url`,
> `head.siteHead`, native RegExp matching (v1.4.1), and default-locale **bare paths** (v1.6.0).

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
| `releaseSource` | `npm` (version-of-truth via `dist-tags.latest`), `github`/`releases` (notes), `packageJson` (deps/exports), `llms` (upstream `llms-full.txt` — `web` since 0.4.0, `core` since 0.1.1; cross-checked against `src/`, which wins on disagreement). |
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
