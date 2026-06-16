<!--
  Project specification, rules, and recommendations for building ANY web project on
  @moku-labs/web — marketing site, documentation, dashboard/app, e-commerce/catalog,
  portfolio, content/blog. Framework-level guidance (not tied to any one example app).
  Verified against @moku-labs/web@1.12.2. Pair with: layout-structure.md (entry + route
  wiring), component-patterns.md (UI), css-architecture.md (styles), deploy-and-ci.md
  (shipping), plugin-index.md (plugin/API catalog).
-->

# @moku-labs/web — Project Specification (structure · rules · recommendations)

How to structure and build **any web-technology project** on `@moku-labs/web` — not just websites.
The framework is a web **frontend** foundation (SSG + SPA + island hydration over Preact, output =
HTML/CSS/JS), so it powers the full spectrum: static sites, single-page **web apps** and PWAs,
**embeddable widgets**, documentation portals, internal tools / admin panels, dashboards,
e-commerce, design-system / component showcases, portfolios, and content sites. This spec defines
the **standard project shape**, the **rules** every project MUST follow, and the **recommendations**
a production project SHOULD follow. It is framework-level — adapt the data layer, mode, and routes
to your project type (see the §13 project-type matrix); the skeleton is the same.

> **Scope (be honest about it).** `@moku-labs/web` produces web frontends. It is not a backend/API
> framework, a native-mobile toolkit, or a CLI framework — pair it with whatever backend/data source
> you like (it consumes data at build via loaders, or in the browser via `dataPlugin`). Within "web
> frontend," anything from a one-file landing page to an interactive app is in scope.

> **You are building a Layer-3 app.** Depend on **`@moku-labs/web` only** (it pins
> `@moku-labs/core` itself — never add a direct core dep). You never write core config or plugins;
> you call `createApp(...)` and supply `pluginConfigs`. Entry + route wiring detail lives in
> [layout-structure.md](layout-structure.md); this file is the surrounding skeleton + rules.

## 1. Architecture model

- **Two compositions over one route table.** `src/app.ts` is the **Node** composition (opts in the
  node-only plugins for the build); `src/spa.tsx` is the **browser** composition (imports from
  `@moku-labs/web/browser`, adds only `dataPlugin` for client data-nav). Both import the SAME
  `src/routes.tsx`, `src/config.ts`, `src/i18n` (if any), `src/islands`.
- **Structured config, not flags.** `createApp({ config: { stage, mode }, plugins: [...],
  pluginConfigs: {...} })`. `config.mode` is the single render switch (`"ssg" | "spa" | "hybrid"`);
  `config.stage` is `"production" | "development" | "test"`.
- **Defaults are isomorphic** (`site, i18n, router, head, spa` + `log`/`env` core). You compose the
  rest by project type: `content` (markdown) / `data` (client data-nav) / `build` / `deploy` / `cli`.

## 2. Standard directory structure

Required for any project; some dirs are conditional on project type (noted). This layout scales from a
one-page marketing site to a multi-locale app with hundreds of routes.

```
<project>/
├─ <root configs>              # §3 — same set for every project
├─ public/                     # static passthrough → copied to dist root verbatim
│  ├─ _headers                 # host cache/security rules (CF Pages; see deploy-and-ci.md)
│  ├─ fonts/                   # vendored self-hosted fonts (recommended)
│  └─ favicon.* / manifest / robots.txt …
├─ scripts/                    # thin `app.cli.*` passthroughs (build/serve/preview/deploy)
├─ src/
│  ├─ config.ts                # REQUIRED — site identity constants (single source of truth)
│  ├─ app.ts                   # REQUIRED — Node composition (build/deploy) + `makeApp(stage)`
│  ├─ spa.tsx                  # REQUIRED if `mode` is "spa"/"hybrid" — browser bundle entry
│  ├─ routes.tsx               # REQUIRED — THE route table (build + SPA + links) + `urls`
│  ├─ index.html               # REQUIRED — app-owned document shell (moku:* placeholders)
│  ├─ 404.html                 # REQUIRED for static hosts (CF Pages) — app-owned 404
│  ├─ layouts/                 # persistent chrome (header/nav/footer) + the swap region
│  ├─ pages/                   # one top-level component per route family (SSG-pure)
│  ├─ components/              # pure Preact *.tsx + colocated *.css (@scope)
│  ├─ islands/                 # vanilla-TS client behavior + index.ts registry (if any JS)
│  ├─ lib/                     # pure, browser-safe helpers (data access, head, urls, …)
│  ├─ styles/                  # global CSS (@layer) + fonts — see css-architecture.md
│  ├─ i18n/                    # OPTIONAL — Locale union + translations (multi-locale sites)
│  └─ og/                      # OPTIONAL — OG social-card components → build.ogImage
├─ <data source>               # project-type dependent — see §4 (e.g. content/ for markdown)
└─ tests/                      # unit + integration (vitest) + e2e/visual (playwright)
```

**The split that matters:** everything imported by BOTH `app.ts` and `spa.tsx` — notably
`routes.tsx` and `lib/**` — is in the **browser graph** and MUST stay node-free (Rule R3).

## 3. Root config inventory (identical for every project)

| File | Purpose | Required settings |
|---|---|---|
| `package.json` | scripts + deps | `engines.node ">=24"`, `bun ">=1.3.14"`; runtime deps = `@moku-labs/web` + `preact` only; everything else `devDependencies`; scripts are thin `app.cli.*` passthroughs |
| `bunfig.toml` | install policy | `[install] exact = true` (pin every dep) — **recommended** |
| `.bun-version` | toolchain pin | bare version; CI reads it via `setup-bun` |
| `tsconfig.json` | strict TS, no Vite | `jsx: "react-jsx"`, `jsxImportSource: "preact"`, `moduleResolution: "bundler"`, `verbatimModuleSyntax`, `noEmit`, `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, **`types: ["bun","node"]`** (TS6 defaults `types` to `[]`) |
| `biome.json` | format + lint | 2-space, double quotes, semicolons, no trailing commas; exclude `**/*.css` + `src/index.html` |
| `eslint.config.ts` | deep lint (flat) | `tseslint` + `unicorn` + `sonarjs` + `jsdoc`; **`eslint-config-biome` LAST** |
| `vitest.config.ts` | unit + integration | two `projects`; coverage on pure-logic dirs (`lib/`, `i18n/`) |
| `playwright.config.ts` | e2e + visual | `webServer` serves a built fixture corpus; per-OS baselines |
| `lefthook.yml` | git pre-commit | typecheck → biome → eslint → unit+integration |
| `wrangler.jsonc` | deploy target | `pages_build_output_dir: "dist"` — see [deploy-and-ci.md](deploy-and-ci.md) |
| `.gitignore` | ignores | `dist`, `coverage`, `.env*`, `node_modules`; commit visual baselines |

> **No Vite, no PostCSS, no bundler config, no `bin`.** Bundling is the framework `build` plugin's
> `bundle` phase (`Bun.build`); CSS is plain CSS (`@layer` + `@scope`). The only "build config" is
> `pluginConfigs.build` in `src/app.ts`.

## 4. The data layer (choose per project type)

A moku-web project's data layer is one of three strategies — pick by project type; they can mix:

1. **Markdown content** (docs, blog, content/marketing-with-copy). Compose `contentPlugin` +
   `fileSystemContent({ contentDir, … })`; author `<dir>/<slug>/<locale>.md` with YAML frontmatter;
   loaders read it via `ctx.require(contentPlugin)`. Optional build-time directives
   (`mermaid`/`::embed`/`::gallery`, all needing `trustedContent: true`) — see
   [plugin-index.md](plugin-index.md) §2.1. Use this whenever the primary content is prose.
2. **Custom data** (dashboard, app, e-commerce, anything API/DB-backed). Write build-time loaders in
   `lib/` that fetch/read your source (a JSON file, a headless CMS, a REST/GraphQL endpoint, a
   generated module) and return plain data from `.load()`. Compose `dataPlugin` so each page's data
   is persisted as a JSON sidecar and re-fetched for client (`hybrid`/`spa`) navigation. No
   `contentPlugin` needed.
3. **Static** (landing/marketing, portfolio). No data plugin — `.render()` returns markup directly;
   `mode: "ssg"`. Add `dataPlugin` later only if you introduce client data-nav.

In all three, **route loaders run at BUILD only** and reach sibling plugins the spec way
(`ctx.require(plugin)`); the persisted output is fed straight back as `ctx.data` on client nav (no
re-validation). Keep the data-access helpers in `lib/` and browser-safe (Rule R3).

## 5. Routing patterns (general)

ONE `src/routes.tsx` (`defineRoutes` + `route(...)` builders) feeds the build, the SPA, and link
generation; `export const urls = createUrls(routes, DEFAULT_LOCALE)`. Common patterns, applicable to
any project type:

| pattern | builder shape | example use |
|---|---|---|
| **Static page** | `route("/about/").render(...).head(...)` (no `.load`) | marketing, about, contact |
| **Index/list** | `.load(ctx => list(...)).render(...)` | product grid, post list, docs index |
| **Detail** | `route("/{slug}/").generate(ctx => ids).load(ctx => byId(ctx.params.slug))` | product, article, doc page |
| **Paginated list** | `route("/page/{page}/").generate(pagedParams).load(ctx => paginate(all, +ctx.params.page))` | catalog pages, archive |
| **Taxonomy/filter** | `route("/category/{cat}/").generate(ctx => categories).load(ctx => byCategory(...))` | tags, categories, collections |
| **Localized** | prefix any pattern with `{lang:?}` | multi-locale (default locale at bare paths) |

Every route: `.layout(layout)` (SSG chrome) · `.generate` (param sets, build-only) · `.load`
(data, build-only) · `.render` (Preact, build + client) · `.head` (SEO) · `.meta` (serializable bag).
See [layout-structure.md](layout-structure.md) for the full builder contract.

## 6. Rendering mode by project type

| `config.mode` | behavior | fits |
|---|---|---|
| `"ssg"` | pure static HTML, no client data-nav | landing/marketing, portfolio, simple docs |
| `"hybrid"` | SSG HTML + per-page JSON sidecars + DATA-nav (compose `dataPlugin`) | content sites, docs, most apps (default) |
| `"spa"` | client-rendered after first paint | highly interactive dashboards/apps |

`hybrid` is the sensible default: full SSG (SEO + first paint) plus instant client navigation.

## 7. UI layer (general taxonomy)

- **`layouts/`** — persistent chrome wrapping the `<section>` swap region; applied via `.layout()` at
  SSG only (on client nav the chrome persists, only the swap region re-renders).
- **`pages/`** — one top-level, SSG-pure component per route family; receives typed `ctx.data` +
  `locale`, composes `components/`.
- **`components/`** — pure Preact `*.tsx` + colocated `*.css` (`@scope`). Group by role: **chrome/nav**
  (header, nav, footer), **views** (list/grid, detail, section blocks), **cards/items**, **interactive
  facades** (forms, media, embeds). All styling via `data-*` attributes — never `className`.
- **`islands/`** — vanilla-TS client behavior (`createComponent` from `@moku-labs/web/browser`), one
  kebab file each, re-exported from `islands/index.ts` (→ `pluginConfigs.spa.components`). An island
  pairs with a component by `data-component="name"`. See [component-patterns.md](component-patterns.md).

## 8. i18n (optional)

For multi-locale sites: a typed `src/i18n/` module — a `Locale` union, a `UIStrings` **type** (not
interface, so it keeps an index signature assignable to the framework `translations` shape),
per-locale string files, and the assembled `i18nConfig` (`{ locales, defaultLocale, localeNames,
ogLocaleMap, translations }`) passed to `pluginConfigs.i18n`. The framework serves the **default
locale at bare paths** (`/`, `/about/`) and prefixes others (`/de/…`); `{lang:?}` route slots +
fallback derive from this. Localize content + nav labels + HEAD copy (`<title>`/meta — they're
search-result text); keep purely decorative UI chrome locale-invariant if that's your design.

## 9. SEO & social cards

`head` composes `<title>`/meta/canonical/hreflang/OG/Twitter/JSON-LD from each route's `.head()`.
For social cards, the `og/` dir holds Preact components rendered at build (Satori) and wired via
`pluginConfigs.build.ogImage` (`render` per-detail card, `defaultCard` site fallback, `fonts`,
`fontDir`); set `head.defaultOgImage` for the non-detail fallback. Optional but recommended for any
public site.

## 10. Testing strategy (general)

Three tiers, each guarding a different thing — applies to any project type:
- **Unit (vitest)** — pure `lib/**` (+ `i18n/**`) helpers; high coverage threshold on logic.
- **Integration (vitest)** — boots a real `createApp` over a representative data source; guards
  build invariants (head titles, bundle-safety, deploy config, security headers, draft staging).
- **E2E + visual (playwright)** — run against a **frozen fixture data source** (a small built corpus
  in `tests/fixtures/…` served via a `webServer` script), NOT live data — so shipping content/data
  never churns tests or baselines. One engine runs the full functional suite; add visual baselines
  (committed per-OS) for rendering-critical pages.

> **Principle:** decouple "data/content changes" from "code changes." Tests + visual baselines run
> on a frozen fixture set; the real data source is guarded separately by `bun run build` in CI.

## 11. RULES (MUST)

- **R1 — Layer-3 only.** Depend on `@moku-labs/web` alone; never declare core config/plugins; never
  add a direct `@moku-labs/core` dependency.
- **R2 — One route table.** All routes register via `pluginConfigs.router.routes` (no imperative
  `set()`); `routes.tsx` is shared by build + SPA + links.
- **R3 — Client bundle stays node-free.** `routes.tsx` + `lib/**` (browser graph) must NOT import
  `src/app.ts` or any node-only plugin/provider. Loaders reach data via `ctx.require(plugin)` (the
  browser-safe shell); the node provider (`fileSystemContent`) is composed ONLY in `src/app.ts`.
  Enforce with a bundle-safety integration test.
- **R4 — Identity in `config.ts`.** Site name/url/author/description live in one `SITE` const; never
  hardcode them elsewhere.
- **R5 — No classes in markup.** All styling/state via `data-*` attributes (markup, island code, and
  JSDoc examples); islands use `el.dataset.x`, never `classList`.
- **R6 — App-owned shell + 404.** `src/index.html` keeps the four placeholders
  (`<!--moku:lang/head/assets/body-->`); a static host (CF Pages) requires `dist/404.html`
  (`build.notFound`) or it flips to SPA mode.
- **R7 — Never hardcode a bundle URL.** Filenames are content-hashed; use the `<!--moku:assets-->`
  placeholders.
- **R8 — `bun` only; pinned deps; multi-line JSDoc** on every `src/**` export; `eslint-config-biome`
  LAST in the flat config.

## 12. RECOMMENDATIONS (SHOULD)

- **Default to `mode: "hybrid"`** unless the site is purely static (`ssg`) or app-like (`spa`).
- **Vendor fonts** under `public/fonts/` (self-hosted woff2, root-relative `/fonts/...`); leave font
  `url()`s external (never base64-inlined); cache them immutably in `_headers`.
- **Keep `lib/` pure** and dependency-light; one helper per concern (data access, pagination/list ops,
  head builders, url builders, locale, theme objects).
- **Parameterize the app by stage** — `makeApp(stage, io?)` so the dev loop shows drafts
  (`"development"`) and the e2e build can point at a fixture source; export a production `app`.
- **Generate OG cards** for any public site; a single `defaultCard` is enough for a small site.
- **Gate deploy on CI** and SHA-pin actions — see [deploy-and-ci.md](deploy-and-ci.md).
- **Test against a frozen fixture corpus**, commit visual baselines per-OS, keep refactors
  output-preserving.

## 13. Project-type matrix (the skeleton adapts)

The structure (§2) and rules (§11) are constant; what changes is the data layer, mode, and plugin set:

| Project type | mode | data layer | plugins beyond defaults | typical routes |
|---|---|---|---|---|
| **Landing / marketing** | `ssg` | static (none) | `build`, `deploy`, `cli` | static pages |
| **Documentation portal** | `hybrid` | markdown (`contentPlugin` + `fileSystemContent`) | + `content`, `data` | index, doc detail, taxonomy |
| **Content site / blog** | `hybrid` | markdown + directives | + `content`, `data` | index, detail, paginated, tags, localized |
| **Web app / PWA** | `spa` or `hybrid` | custom loaders + `dataPlugin` | + `data`, `build`, `deploy` | app views, detail, filtered lists |
| **Dashboard / internal tool / admin** | `spa` | custom loaders (API/DB) + `dataPlugin` | + `data`, `build` | views, detail, filtered/paginated lists |
| **E-commerce / catalog** | `hybrid` | custom loaders (CMS/API) + `dataPlugin` | + `data`, `build`, `deploy` | catalog, product detail, category, paginated |
| **Embeddable widget** | `spa` | props/host attributes or one small fetch | `build` (often NO router) | usually one mount point, no routing |
| **Design-system / component showcase** | `ssg`/`hybrid` | static or small data | `build`, `deploy` (+ `content`?) | index + per-component pages |
| **Portfolio** | `ssg`/`hybrid` | static or small markdown | `build`, `deploy` (+ `content`?) | index, project detail |

> **Minimal compositions exist.** Not every project needs the full skeleton. An **embeddable widget**
> or a single-screen tool can skip the router and most dirs: compose `createApp` over the defaults
> (or just `spa` + your island), mount one `data-component`, and ship one bundled island. Scale up to
> the full structure (§2) only as the project grows routes, pages, and data.

## 14. Scaffold sequence (any project)

1. **Root configs** — `package.json` (deps `@moku-labs/web` + `preact`; dev toolchain; `engines`),
   `bunfig.toml` (`exact`), `tsconfig`, `biome`, `eslint`, `vitest`, `playwright`, `lefthook`,
   `.bun-version`, `.gitignore`. `bun install`.
2. **Identity (+ i18n if multi-locale)** — `src/config.ts` (`SITE`); `src/i18n/` if needed.
3. **Shell + styles** — `src/index.html` (4 `moku:*` placeholders), `src/styles/main.css` (`@layer`
   entry + tokens/reset/base; see [css-architecture.md](css-architecture.md)); vendor fonts.
4. **Choose the data layer** (§4) and write its `lib/` accessors (browser-safe).
5. **UI** — `layouts/`, `components/` (+ CSS), `pages/`, `islands/` (+ registry).
6. **Routes** — `src/routes.tsx` (`defineRoutes` + `urls`) wiring loaders to `lib/`.
7. **Compositions** — `src/spa.tsx` (browser) + `src/app.ts` (`makeApp(stage)` + `app`), composing
   the plugins your project type needs (§13) + `build.ogImage` if used.
8. **Static host files** — `src/404.html`, `public/_headers`, favicons/manifest.
9. **Scripts** — `scripts/{build,serve,preview,deploy}.ts` (thin `app.cli.*`).
10. **Tests** — fixtures + unit/integration/e2e. `bun run build` to verify; ship via
    [deploy-and-ci.md](deploy-and-ci.md).
