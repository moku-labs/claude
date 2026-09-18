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
      "knownVersion": "1.5.0",
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
      "knownVersion": "2.2.2",
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
    },
    {
      "key": "worker",
      "npm": "@moku-labs/worker",
      "repo": "https://github.com/moku-labs/worker",
      "localClone": "../worker",
      "layer": 2,
      "role": "framework",
      "knownVersion": "0.15.0",
      "skill": "skills/moku-worker",
      "pluginIndex": "skills/moku-worker/references/plugin-index.md",
      "dependsOn": ["@moku-labs/core"],
      "detect": { "packageJsonDep": "@moku-labs/worker" },
      "releaseSource": {
        "npm": "https://registry.npmjs.org/@moku-labs/worker",
        "github": "https://github.com/moku-labs/worker",
        "tagGlob": "v*",
        "releases": "https://github.com/moku-labs/worker/releases",
        "packageJson": "https://raw.githubusercontent.com/moku-labs/worker/main/package.json",
        "llms": "https://raw.githubusercontent.com/moku-labs/worker/main/llms-full.txt"
      },
      "upgrade": { "migrationId": "moku-worker-version", "distTagPolicy": "stable->latest,prerelease->next" }
    },
    {
      "key": "room",
      "npm": "@moku-labs/room",
      "repo": "https://github.com/moku-labs/room",
      "localClone": "../room",
      "layer": 2,
      "role": "framework",
      "knownVersion": "0.3.1",
      "skill": "skills/moku-room",
      "pluginIndex": "skills/moku-room/references/plugin-index.md",
      "dependsOn": ["@moku-labs/core"],
      "detect": { "packageJsonDep": "@moku-labs/room" },
      "releaseSource": {
        "npm": "https://registry.npmjs.org/@moku-labs/room",
        "github": "https://github.com/moku-labs/room",
        "tagGlob": "v*",
        "releases": "https://github.com/moku-labs/room/releases",
        "packageJson": "https://raw.githubusercontent.com/moku-labs/room/main/package.json",
        "llms": "https://raw.githubusercontent.com/moku-labs/room/main/llms-full.txt"
      },
      "upgrade": { "migrationId": "moku-room-version", "distTagPolicy": "stable->latest,prerelease->next" }
    }
  ]
}
```

> **Provenance of the `worker` entry (latest sync):** **re-synced 2026-06-26** to `@moku-labs/worker@0.15.0`
> (npm `dist-tags.latest`; surface from the `v0.15.0` tag source). **`0.11.0 → 0.15.0` delta — breaking +
> additive, the plugin set shrinks 10 → 9:**
> - **`0.12.0` (BREAKING, #43) `refactor(core)!`:** removed the **`stage` plugin** (deployment stage is now
>   plain global config — set `config.stage`, read via `ctx.global.stage`), made `createApp` "plain", and
>   rebranded the framework id to **`"worker"`**. This is the 10 → **9 plugins** change (the surviving set:
>   bindings, server, kv, d1, queues, storage, durableObjects, deploy, cli).
> - **`0.12.1` (#44):** sourced the env provider `workerSafeProcessEnv` from `@moku-labs/common`, bumping the
>   bundled `@moku-labs/common` **`0.2.1 → 0.3.0`**. ⚠️ The family is **no longer lockstep on `common`**:
>   web@2.2.2 / room@0.3.1 stay on `0.2.1`; only worker moved to `0.3.0`.
> - **`0.13.0` (#45):** `deploy --delete` teardown — `cli.deploy({ delete: true, stage })` routes to
>   `deploy.destroy()` to tear a stage's infra back down (`0.13.1`/#46 fixed the queue↔Worker cycle).
> - **`0.14.0` (#47):** `endpoint.new(guard)` — a chainable guard factory; a guard returning a `Response`
>   short-circuits (401 etc.), `void` continues.
> - **`0.15.0` (#48):** a guard may also return an **object**, merged onto the handler context as a **typed
>   field** (e.g. `ctx.actor`) — resolve-once, no re-resolve / null-check.
>
> `@moku-labs/core` stays `1.5.0`; `wrangler` an optional peer (`>=3`); engines node ≥24 / bun ≥1.3.14;
> exports only `.` (the `./cli` subpath was removed back in 0.11.0). The regenerated `plugin-index.md` (synced
> header `0.15.0`) is authoritative. `moku-worker-version` fires for projects behind 0.15.0; the **0.7.0
> keyed-map config** boundary AND the **0.12.0 stage-plugin removal** are the breaking crossings to flag.
>
> **Provenance of the `worker` entry (0.9.2 history):** registered 2026-06-20 (at 0.4.0); **re-synced 2026-06-21** to
> `@moku-labs/worker@0.9.2` (npm `dist-tags.latest`; public repo `github.com/moku-labs/worker`). Deps
> bumped in lockstep with the family: `@moku-labs/core` `0.1.4 → 1.5.0` (exact) + `@moku-labs/common`
> `0.2.0 → 0.2.1` (shared infra — a skill, not a framework entry); `wrangler` is now an **optional**
> peerDependency; engines node ≥24 / bun ≥1.3.14. A Layer-2 framework (`createCoreConfig`/`createCore`)
> exposing Cloudflare primitives as plugins — **10 plugins, unchanged set** (bindings, server, kv, d1,
> queues, storage, durableObjects, stage, deploy, cli). **0.4.0 → 0.9.2 delta (no new plugins, but
> breaking + additive):**
> - **Keyed-map resource config (breaking, v0.7.0).** kv/d1/queues/storage/durableObjects now take a
>   `Record<key, instance>` of named instances (`{ name, binding, … }`), expose `app.<kind>.use("key")`
>   + an implicit default, and `deployManifest()` returns an array. The old flat single-binding configs
>   (`kv.binding`, `d1.binding`, `storage.bucket`) are gone.
> - **deploy/cli moved to the package root (v0.6.0)** — `./cli` is now a tree-shaken back-compat alias;
>   `deploy.run()`/`cli.deploy()` return a structured **`DeployReport`** (was `void`) and gained verbs
>   (`seed`, `checkInfra`, `verifyAuth`, `doctor`, `whoami`, `wrangler`, …). New exported types
>   `DeployReport`, `SeedConfig`, `WorkerPluginCtx`, `PluginCtx`. `cli` config is now empty (port via
>   `dev({ port })`).
> - **`createApp` gained `onReady`/`onError`/`onStart`/`onStop`** and auto-bridges `config.stage` + a
>   workerd-safe `process.env` provider.
> - **6 new global `WorkerEvents`:** `provision:plan` `{exists,missing,ships,account}`, `provision:skip`
>   `{kind,name}`, `auth:verified` `{account,accountId,scopes}`, `dev:phase` `{phase,detail?}`,
>   `dev:rebuilt` `{files,ms}`, `dev:error` `{message}`; plugin-local events unchanged (`server:matched`,
>   `queue:message`); `queues` gained `maxBatchTimeout` (0.8.0).
>
> **Catalog source:** the **0.9.2 npm tarball + `v0.9.2` tag source (`src/**`)** — upstream
> `main`/`llms.txt`/`llms-full.txt` are **still stale at 0.1.0** (never regenerated through 0.5→0.9), so
> per the "source wins" policy the released surface (not the llms prose) is authoritative. ⚠️ Worth
> nudging worker upstream to wire catalog regeneration into its publish workflow. `moku-worker-version`
> now fires for projects behind 0.9.2; consumers crossing the 0.7.0 keyed-map config boundary need the
> config migration noted in `upgrade-migrations.md`.
>
> **Provenance of the `room` entry:** **re-synced 2026-06-27** to `@moku-labs/room@0.3.1` (npm
> `dist-tags.latest`; public repo `github.com/moku-labs/room`). **BREAKING (`#6` `feat(room)!`): the `./server`
> tier is no longer a core.** Through 0.2.0, `./server` was its own server *core* you `createApp`'d from; in
> `0.3.1` `@moku-labs/room/server` **exports `hubPlugin` (a `@moku-labs/worker` plugin) + the `Hub` Durable
> Object** instead — a Layer-3 app composes `hubPlugin` into its **own single `@moku-labs/worker` `createApp`**
> (+ `durableObjects`/`deploy`/`cli`), the one-worker idiom (`moku-idioms.md §I6`). `@moku-labs/worker@^0.15.0`
> is now an **optional `peerDependency`** (only `./server` adopters need it); `./server` ships **no `types`**
> condition (import-only). `0.3.0` was a docs-only republish (no code change). Client core + the 6 other
> plugins are **unchanged** from 0.2.0. **Catalog source:** the `v0.3.1` tag **source** (`src/server.ts`,
> `src/plugins/hub/`) + the root README. ⚠️ The upstream `llms.txt`/`llms-full.txt` are **still stale** — they
> describe the pre-0.3.1 server *core* (and the 0.1.x plugin-pack names), so per "source wins" the tag source
> is authoritative. Worth nudging room upstream to wire catalog regeneration into publish, same as worker.
>
> **History — 0.1.x → 0.2.0 re-architecture (`#4` `refactor(room)!`):** `role` `plugin-pack` → `framework`;
> `dependsOn` `["@moku-labs/web"]` → `["@moku-labs/core"]`. 0.1.x was a *plugin pack* (spread
> `roomPlugins.stage`/`.controller` arrays into a `@moku-labs/web` app); 0.2.0 rebuilt Room as its own
> `@moku-labs/core` framework (sibling to web/worker, NOT built on them) — `@moku-labs/web` dependency gone;
> `@moku-labs/core@1.5.0` + `@moku-labs/common@0.2.1` bundled; **no more role arrays**; **no `./browser` entry**;
> **7 plugins** (was 6, +`hubPlugin`); **3 signaling adapters** (was 2, +`serverSignaling(url)`); new
> `session.codeLength` + the `"room-evicted"` `room:network-warning` reason (`./server` tier only). Upgrade
> order is **core → room** (web is no longer in room's chain). `moku-room-version` (in `upgrade-migrations.md`)
> covers BOTH crossings — 0.1.x→0.2.0 (spread arrays → `createApp` from Room) and 0.2.0→0.3.1 (server core →
> `hubPlugin` composed into a `@moku-labs/worker` app).

> **Provenance of the `core` entry:** synced against `@moku-labs/core@1.5.0` (npm `latest`,
> published 2026-06-21, GitHub tag `v1.5.0`). **0.1.4 → 1.5.0 delta:** a **spec/convention rename
> with no runtime change** — (#15) `refactor(sandbox,spec)!` renames the "components" SPA exemplar →
> **"islands"** across `specification/15-PLUGIN-STRUCTURE.md` + the sandbox exemplars, plus a one-line
> `require()` clarification in `08-CONTEXT.md` (core-plugin instances resolve through the same lookup
> map; flat-injected `ctx.log`/`ctx.env` stay idiomatic). **No `src/` change** — `src/index.ts` is
> byte-identical, still `createCoreConfig` + `createCorePlugin` plus the type-only exports; zero
> runtime dependencies; engines `node >=24` / `bun >=1.3.8` (unchanged). The version jump
> `0.1.4 → 1.5.0` is a deliberate release-version choice; the breaking-marker (`!`) reflects the
> exemplar **naming** convention, not a public-API break. **No skill edit:** the `moku-core` SKILL.md
> documents the unchanged API form and pins no version — only `knownVersion` moved here. (The vendored
> spec + sandbox are re-pinned separately by `spec-sync` — now at `09affbb` / `v1.5.0`.) The whole
> family now pins `@moku-labs/core@1.5.0` **exactly**: `@moku-labs/common@0.2.1`, `@moku-labs/web@2.0.1`,
> `@moku-labs/worker@0.9.2` (each bumped in lockstep); `dependsOn` ordering (core before web/worker)
> still holds.
>
> **Provenance of the `web` entry (latest sync):** **re-synced 2026-06-26** to `@moku-labs/web@2.2.2` (npm
> `latest`, published 2026-06-26). **`2.0.1 → 2.2.2` delta — additive SPA/realtime features, no breaking
> change:**
> - **`2.1.0`:** `createChannel<T>(opts)` — a client realtime WebSocket primitive (top-level export, `.` +
>   `./browser`); per-route `route(...).transition("none"|"crossfade"|"slide"|"morph")` + `.scroll("top"|
>   "preserve")` (typed first-class, NOT `.meta()` keys); `spa.viewTransitions` widened `boolean → TransitionMode`;
>   new `spa.scrollRestoration`; `RenderResult` now also allows `null` (render nothing but stay mountable).
> - **`2.1.1`:** `app.spa.navigate` now commits the address bar (`history.pushState`).
> - **`2.2.0`:** module-level `navigate(path, opts?)` / `hardNavigate(url)` (bound to the booted app, no-op
>   pre-boot); `hardNavigate` does a REAL full-page load across a layout/auth boundary the SPA can't swap;
>   island ctx gains an always-present `ctx.navigate`.
> - **`2.2.1` (#91):** internal SPA fix (own the skipped-transition `ready` AbortError in `runSwap`) — no
>   public-surface change.
> - **`2.2.2` (#92):** `createChannel` gained a `shouldReconnect?(event: CloseEvent): boolean` guard — return
>   `false` to suppress the reconnect backoff on a terminal close (e.g. code `4401`); omitted = always reconnect.
>
> Deps unchanged from 2.0.1 (`@moku-labs/core@1.5.0` exact, `@moku-labs/common@0.2.1`, `mermaid-isomorphic`
> optional peer); engines node ≥24 / bun ≥1.3.14. The regenerated `plugin-index.md` (synced header `2.2.2`) is
> authoritative for the plugin surface. The narrative below predates the **2.0.0** major sync (#8) and is
> retained as historical catalog detail (1.8.0 → 1.12.3); where they differ, the plugin-index is the source
> of truth.
>
> **Provenance of the `web` entry (history):** synced against `@moku-labs/web@1.12.3` (npm `latest`,
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
>   click-to-activate `<figure data-island="lazy-embed">` — NO iframe (or its network/JS cost)
>   until the reader clicks, when the new **`lazyEmbed`** SPA island swaps in the real
>   `<iframe loading="lazy">`. `src` may be http(s), root-relative, or a co-located relative path
>   resolved to the shared `/<slug>/…` URL; `width`×`height` reserve the box aspect-ratio. Provider
>   option `embed?: boolean | { facade }` (consumer Preact facade; default `EmbedFacadeButton`);
>   requires `trustedContent: true`.
> - **`::gallery` folder galleries (v1.12.0, #72).** `::gallery{src="./images/dir/" caption="…"}`
>   reads the co-located folder at build, sorts its images, rewrites each to its shared `/<slug>/…`
>   URL, and renders them through a Preact component (default `GalleryTrack`, or consumer
>   `gallery.component`) into `<div data-island="gallery">`; the swipe/keyboard/lightbox island is
>   **consumer-provided**. Provider option `gallery?: boolean | { component }`; requires
>   `trustedContent: true`.
> - **SPA/build fixes.** v1.8.1 (#64) titleTemplate applied on DATA-path client nav; v1.8.2 (#67/#68)
>   `llms.txt`/`llms-full.txt` synced to the v1.8.0 cache feature + leave font `url()`s external in
>   the CSS bundle pass; v1.12.1 (#73) always scroll-to-top instant on a nav swap (never CSS smooth);
>   v1.12.2 (#74) announce the nav before the data fetch (feedback during JSON load).
>
> **New public exports (`.`):** runtime `EmbedFacadeButton`, `GalleryTrack`; types
> `EmbedFacade` / `EmbedFacadeProps` / `EmbedOptions` and `GalleryComponent` / `GalleryOptions` /
> `GalleryProps` / `GallerySlide`. **`lazyEmbed`** (+ `createIsland`) is exported from **both** `.`
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
`skills/moku-sync/SKILL.md`. (Newly-registered frameworks carry `knownVersion: "0.0.0"`, so the first
`moku-sync <key>` run treats everything as new and generates the catalog — see the worker/room
provenance above.)

## Reference Projects (Layer-3 examples — consult when building apps)

Layer-3 **apps** are not framework registry entries (they deploy, not publish — see the `layer` field
note). But the toolkit keeps a small set of **curated reference example apps** to consult for *idiomatic
solutions* when planning or building an app — "how does a real, well-built Moku app of this shape do X?".
The `/moku:plan` and `/moku:build` app flows (and `/moku:design`) should point at the closest reference.

| Key | What it is | Stack | Location | Status |
|-----|-----------|-------|----------|--------|
| `demos/tracker` | **A public worked example for app shape** — a real Layer-3 full-stack kanban app: `@moku-labs/web` client + islands and an `@moku-labs/worker` Cloudflare backend (Durable Objects, Queues, R2, D1, KV) in one project. Illustrates the idiomatic **app shape** (`moku-idioms.md`): multiple `createApp` instances (build / browser / worker), two frameworks side-by-side, folder split by concern, a thin `cloudflare/worker.ts` entry, logic in a `tracker` plugin. Consult if a concrete reference helps — **not required**, and never assume it's checked out. | `@moku-labs/web` + `@moku-labs/worker` | public repo `github.com/moku-labs/demos` (`tracker` app) | **public** |

**Spec, not source:** a reference shows *what idiomatic looks like* — study its **structure and patterns**
and re-implement to the project's conventions; never copy a demo's source. Only list **public** references
here (a public repo or a public framework) — never a local-only path, which won't exist for a user running
the toolkit elsewhere. The primary guidance is always the **described** rubric (`moku-idioms.md`); a
reference repo is illustrative, not required.

> **How apps use this:** when `/moku:build` (App Build) or `/moku:plan` (create/update app) needs a
> pattern, **follow the described rubric in `moku-idioms.md` first**; a public reference repo (above) is an
> optional concrete example. Never instruct a reader to open a local-only path.
