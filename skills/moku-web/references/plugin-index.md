<!--
  Plugin & property index for @moku-labs/web — kept in sync with upstream.
  Source of truth: the `web` entry's releaseSource in
  skills/moku-core/references/moku-frameworks.md (npm + repo llms.txt/llms-full.txt
  + package.json exports + src/plugins/*). Regenerate with:  moku-sync web
-->

# @moku-labs/web — Plugin & Property Index

**Framework:** `@moku-labs/web` · **Synced version:** `2.0.0` · **Layer:** 2 (framework) ·
**Depends on:** `@moku-labs/core@0.1.4` (exact pin — consumers must NOT add a direct core dep; now
lockstep with core's own registry version 0.1.4) + `@moku-labs/common@0.1.1` (**since 1.12.4** — the
`log`/`env` core plugins are authored in `@moku-labs/common` and re-exported by `web`; public API
byte-identical, so consumers use `ctx.log`/`ctx.env` and import the env providers from
`@moku-labs/web` exactly as before) · **Peer deps (since 1.7.0):** `preact@^10.29.2` +
`preact-render-to-string@^6.6.0` — the APP installs them; **optional** `mermaid-isomorphic@^3.0.0` (since
1.9.0, only when content `mermaid` is enabled) · **Engines:** node ≥24, bun ≥1.3.14 · **Two entry
points:** `.` (ESM + CJS, full surface, Node SSG) and **`./browser`** (ESM-only, node-free by
construction) · **No `bin`** — the developer CLI ships as the node-only **`cliPlugin`**
(`app.cli.build/serve/preview/deploy`, driven by thin per-command scripts).

> **What's new in 1.x (vs 0.5.6):**
> - **Content directives — build-time, zero-JS-by-default (v1.9.0–v1.12.0).** Three opt-in
>   `fileSystemContent` features, each rendered to STATIC markup at build and each requiring
>   `trustedContent: true` (they emit raw HTML the sanitize pass would otherwise strip):
>   - **`mermaid` (v1.9.0).** Fenced ` ```mermaid ` code blocks → static inline SVG at build (no
>     client JS). `mermaid: boolean | { mermaidConfig?, renderDiagrams? }`. Needs the **optional peer
>     dep `mermaid-isomorphic@^3.0.0`** (+ playwright/browser).
>   - **`::embed` + `lazyEmbed` island (v1.10.0, enhanced v1.11.0).** `::embed{src title width? height?}`
>     → a click-to-activate `<figure data-island="lazy-embed">` facade; **no iframe** (or its
>     network/JS cost) until the reader clicks, when the new **`lazyEmbed`** SPA island swaps in the
>     real `<iframe loading="lazy">`. `src` = http(s) | root-relative | co-located relative (resolved
>     to `/<slug>/…`); `width`×`height` reserve the box. `embed: boolean | { facade }` (default
>     `EmbedFacadeButton`).
>   - **`::gallery` (v1.12.0).** `::gallery{src="./images/dir/" caption?}` reads the co-located folder
>     at build, sorts its images, and renders them through a Preact component (default `GalleryTrack`,
>     or `gallery.component`) into `<div data-island="gallery">`. The swipe/keyboard island is
>     **consumer-provided**. `gallery: boolean | { component }`.
> - **SPA/build fixes (v1.8.1–v1.12.2).** titleTemplate applied on DATA-path client nav (1.8.1);
>   `llms.txt` synced + font `url()`s kept external in the CSS bundle pass (1.8.2); nav swap always
>   scrolls to top instant — never CSS smooth (1.12.1); nav announced before the data fetch so a
>   screen reader gets feedback during the JSON load (1.12.2).
> - **New top-level exports:** runtime `EmbedFacadeButton`, `GalleryTrack`, `lazyEmbed`; types
>   `EmbedFacade`/`EmbedFacadeProps`/`EmbedOptions`, `GalleryComponent`/`GalleryOptions`/`GalleryProps`/`GallerySlide`.
>   `@moku-labs/core` is pinned `0.1.4` (bumped from `0.1.3` in v1.12.3 — a dep-only release, PR #75;
>   now lockstep with core). `PhaseName` unchanged; events unchanged.
> - **BREAKING — ctx-based route handlers (v1.0.0).** `.load((ctx) => D)` takes a single
>   `LoadContext` `{ params, locale, require, has }` (was `(params, locale)`); `.generate((ctx) =>
>   params[])` takes a `GenerateContext` `{ locale, require, has }` (was `(locale)`). Loaders pull
>   sibling plugin APIs the spec way — `ctx.require(contentPlugin)` — no module globals.
> - **BREAKING — `.parse()` REMOVED (v1.0.0).** There is no client validation gate. On a client
>   DATA navigation the fetched JSON (which the build wrote from `load()`) is used **directly** as
>   `ctx.data`; a missing/malformed sidecar falls back to HTML-over-fetch (→ `location.href`).
> - **BREAKING — global `{ stage, mode }` config (v1.0.0).** The render mode moved from router
>   config to the GLOBAL `createApp({ config: { mode } })` (`"ssg" | "spa" | "hybrid"`, default
>   `"hybrid"`), and the old `mode: "production" | "development"` was replaced by the 3-valued
>   `stage: "production" | "development" | "test"` (drafts suppressed only in `"production"`).
> - **BREAKING — declarative routes only (v1.0.0).** Routes register via
>   `pluginConfigs.router.routes` (compiled at init; an `import * as routes` namespace works). The
>   imperative `app.router.set()` was removed.
> - **BREAKING — content is a provider-driven shell (v1.0.0).** `content: { providers:
>   [fileSystemContent({ contentDir, … })] }`. The plugin SHELL is isomorphic/browser-safe (also
>   exported from `./browser`, so loaders can `ctx.require(contentPlugin)`); the node Markdown
>   source lives in the `fileSystemContent` provider (exported from `.` only). `notFound.route` →
>   `notFound.body`.
> - **New `cliPlugin` (v0.6.0, grown through v1.3.x).** Node-only developer CLI:
>   `build`/`serve`/`preview`/`deploy` with a boxed Panel TUI, live build progress (hooks on
>   `build:phase`/`build:complete`/`deploy:complete`), fast incremental dev rebuilds, a guided
>   interactive deploy wizard (`cli.deploy({ guided: true })`).
> - **New `createUrls(routes, defaultLocale?)`** — pure, app-free name→URL builder for
>   components/islands; `.render`/`.head` ctx gained `ctx.url(name, params)`.
> - **`head.siteHead({ url, locale? })`** (v1.5.0) + site-level OG defaults; build can generate a
>   default OG card (`ogImage.defaultCard: true | (input) => VNode`, v1.5.1–2); `notFound.path`
>   verbatim custom 404 (v1.5.3); custom shell `template` placeholders incl. `<!--moku:lang-->` (v1.4.0).
> - **Default locale at BARE paths (v1.6.0).** `{lang:?}` routes serve the default locale at `/`,
>   `/archive/`, … (non-default locales keep `/{locale}/`); `/{defaultLocale}/…` is emitted as a
>   content-identical alias whose canonical points to bare. No config flag.
> - **Router matcher is native RegExp (v1.4.1)** — `URLPattern` dropped, so client matching works in
>   Safari < 18.4 / older Firefox. (`engines.node >=24` still applies.)
> - **`@moku-labs/core` is now `0.1.4`** (exact pin; was `0.1.3` through 1.12.2, `0.1.0-alpha.6` pre-1.x, `0.1.1` at 1.6.x).
>   Browser-bundle CI budget is 60 kB gzip (currently ~50 kB).
> - **v1.7.0 (fix wave, 22 PRs).** `preact` + `preact-render-to-string` moved to
>   **peerDependencies** (the app must install them); bundle **code splitting ON** (dynamic
>   imports become lazy `assets/chunk-*.js`); content sanitize hardening (the UNTRUSTED schema
>   drops the global `style` allowlist — pass `trustedContent: true` on `fileSystemContent` to
>   keep inline styles, e.g. Shiki token colors) and `load()` now serves from the article cache;
>   spa nav fixes (same-page hash links jump natively, query strings carried through interception,
>   superseded navigations aborted via `navEvent.signal` + History fallback, full-reload fallback
>   when the swap region is missing); router `toUrl` percent-encodes params / matcher decodes
>   groups; feeds absolutize root-relative URLs; sitemap XML-escapes `<loc>`; the clean phase
>   refuses a catastrophic `outDir`.
> - **Cache protection (v1.8.0).** Bundle filenames are **content-hashed** (`assets/main-<hash>.css`,
>   `assets/spa-<hash>.js` — entry points included), and a new `cache-headers` build phase emits
>   `outDir/_headers` (Cloudflare Pages rules): a per-file `immutable, max-age=1y` rule per
>   fingerprinted bundle + a catch-all `max-age=0, must-revalidate` for every other URL, with the
>   app's `<publicDir>/_headers` content appended after (app rules can override). Config:
>   `build.cacheHeaders?: boolean | { assets?, pages? }` (default ON). The 404 page now gets the
>   `<!--moku:assets-->` placeholder family substituted (it can't hardcode a hashed bundle URL),
>   and shells gained split `<!--moku:assets:css-->` / `<!--moku:assets:js-->` placeholders.
>
> ⚠️ The upstream `llms.txt`/`llms-full.txt` were last re-synced at 1.8.2 (for the v1.8.0 cache
> feature) and still describe `content` as the plain markdown pipeline — they do NOT mention the
> v1.9.0–v1.12.0 content directives (`mermaid`/`::embed`/`::gallery`) or `cacheHeaders`/fingerprinted
> bundle naming. This index is generated from `src/` — **the source is authoritative**.

## 1. Framework API form (v2.0.0)

`@moku-labs/web` publishes **two entries** (pick by target): **`.`** for the Node SSG build (dual
ESM+CJS, full surface) and **`@moku-labs/web/browser`** for the client bundle (ESM-only, guaranteed
node-free, `browserEnv()` pre-wired). `createApp` is **synchronous** (per Moku core spec); `start()` /
`build.run()` / `cli.*` / `deploy.run()` are async. **Defaults are isomorphic** (`site, i18n, router,
head, spa` + the `log`/`env` core); everything else (`content` shell + provider, `build`, `deploy`,
`data`, `cli`) is composed explicitly via `plugins: [...]`. For the client, import from `./browser` —
do NOT rely on tree-shaking `.`.

```tsx
// routes.tsx — ONE route table for build + SPA + links. Import from ./browser so it ships clean.
import { createUrls, defineRoutes, route, contentPlugin } from "@moku-labs/web/browser";

export const routes = defineRoutes({
  home: route("/{lang:?}/")
    .layout(layout)                                        // (ctx, children) => VNode — SSG-only chrome
    .generate((ctx) => [{ lang: ctx.locale }])             // ctx: { locale, require, has }
    .load(async (ctx) => paginate((await ctx.require(contentPlugin).loadAll()).get(ctx.locale) ?? [], 1))
    .render((ctx) => <Home page={ctx.data} locale={ctx.locale} />)
    .head((ctx) => ({ title: "Home" }))
    .meta({ activeTab: "home" }),
  post: route("/{lang:?}/{slug}/")
    .layout(layout)
    .generate(async (ctx) =>
      [...((await ctx.require(contentPlugin).loadAll()).get(ctx.locale) ?? [])]
        .map((a) => ({ lang: ctx.locale, slug: a.computed.slug })))
    .load((ctx) => ctx.require(contentPlugin).load(ctx.params.slug, ctx.locale))  // ctx: { params, locale, require, has }
    .render((ctx) => <Post post={ctx.data} url={ctx.url} />)
    .head((ctx) => ({ title: ctx.data.frontmatter.title })),
});

/** Pure name→URL builder — no running app needed; usable from components/islands. */
export const urls = createUrls(routes, "en");              // 2nd arg = default locale → bare paths
```

```ts
// app.ts — Node SSG composition (the `.` entry)
import {
  buildPlugin, cliPlugin, contentPlugin, createApp, dataPlugin, deployPlugin,
  dotenv, fileSystemContent, processEnv,
} from "@moku-labs/web";
import { routes } from "./routes";

export const app = createApp({
  config: { mode: "hybrid" },                        // GLOBAL { stage, mode }; defaults production/hybrid
  plugins: [contentPlugin, buildPlugin, deployPlugin, dataPlugin, cliPlugin],
  pluginConfigs: {                                   // per-plugin, keyed by plugin name
    site:    { name: "My Blog", url: "https://blog.dev", author: "Ada", description: "Notes" },
    i18n:    { locales: ["en"], defaultLocale: "en" },
    content: { providers: [fileSystemContent({ contentDir: "./content" })] },
    router:  { routes },                             // SOLE registration path (compiled at init)
    head:    { titleTemplate: "%s — My Blog" },
    build:   { outDir: "dist", feeds: true, sitemap: true },
    cli:     { outDir: "dist", port: 4173 },
    deploy:  { target: "cloudflare-pages", outDir: "dist" },
    env:     { providers: [processEnv(), dotenv(".env")] },  // Node providers — wire explicitly
  },
});

await app.cli.build();   // or: await app.build.run()
// dist/<path>/index.html + (mode!=="ssg") dist/_data/<path>/index.json
```

Top-level exports (`src/index.ts`):
- **Factories:** `createApp`, `createPlugin` (types infer from the spec — never pass explicit generics).
- **Plugin instances:** `sitePlugin, i18nPlugin, routerPlugin, headPlugin, spaPlugin` (isomorphic
  defaults) · `contentPlugin` (isomorphic shell, compose explicitly) · `buildPlugin, deployPlugin,
  cliPlugin` (node-only) · `dataPlugin` (optional/isomorphic) · `logPlugin, envPlugin` (core).
- **Routing DSL:** `defineRoutes`, `route` (builder methods below), `createUrls(routes, defaultLocale?)`.
- **Islands:** `createIsland(name, hooks)` · `lazyEmbed` (built-in `::embed` activation island — see §2.1).
- **Content directive components** (`.`-only, build-time SSR'd to static markup; swap via content
  `embed.facade` / `gallery.component`): `EmbedFacadeButton` (default `::embed` facade — a labelled
  `<button>`), `GalleryTrack` (default `::gallery` component — a horizontal slide track). Both also
  serve as composable building blocks for a custom facade/component.
- **Head/SEO helpers:** `meta, og, twitter, jsonLd, canonical, hreflang, feedLink, buildArticleHead`.
- **Providers:** env — `dotenv()`, `processEnv()`, `cloudflareBindings()` (Node), `browserEnv()`
  (browser) · content — `fileSystemContent({ contentDir, … })` (Node).
- **Type namespaces:** `Build, Cli, Content, Data, Deploy, Env, Head, Log, Router, Spa`
  (`import { type Router } from "@moku-labs/web"` → `Router.RouteDefinition`, `Router.LoadContext`,
  etc.). `site` / `i18n` keep types inline — there are NO `Site`/`I18n` namespaces.
- **Content directive types** (top-level type exports; also reachable as `Content.*`):
  `EmbedFacade`, `EmbedFacadeProps`, `EmbedOptions`, `GalleryComponent`, `GalleryOptions`,
  `GalleryProps`, `GallerySlide`.

**`@moku-labs/web/browser` exports (`src/browser.ts`)** — the ESM-only client entry, node-free by
construction. Same `createApp`/`createPlugin` over the same isomorphic defaults, PLUS `dataPlugin`,
`contentPlugin` (the browser-safe SHELL, so route modules can reference it for `ctx.require` in
build-only loaders), `defineRoutes`, `route`, `createUrls`, `createIsland`, **`lazyEmbed`** (the
`::embed` island runs client-side), `browserEnv`, the SEO head primitives, and the type namespaces
`Content, Data, Env, Head, Log, Router, Spa`. It **excludes** everything node-only:
`buildPlugin`/`deployPlugin`/`cliPlugin`, `fileSystemContent`, the node providers
`dotenv`/`processEnv`/`cloudflareBindings`, the `Build`/`Cli`/`Deploy` type namespaces, **and the
`.`-only build-time content-directive components `EmbedFacadeButton`/`GalleryTrack`** (their named
types are still reachable as `Content.EmbedFacade`, `Content.GalleryProps`, … via the `Content`
namespace).
`browserEnv()` is the **pre-wired default** `env` provider here (reads `import.meta.env` +
`globalThis.__ENV__`), so no `pluginConfigs.env.providers` is needed. A CI gate
(`bun run check:bundle`) asserts zero static node/native imports and a 60 kB gzip budget.

```ts
// client bundle — node-free entry, env auto-wired
import { createApp, dataPlugin } from "@moku-labs/web/browser";
import { routes } from "./routes";
const app = createApp({ plugins: [dataPlugin], config: { mode: "hybrid" }, pluginConfigs: { router: { routes } } });
await app.start();
```

`route(pattern)` builder methods (each returns the builder; only `.load` widens `D`):
- `.load((ctx: LoadContext) => D | Promise<D>)` — OPTIONAL data loader; widens `ctx.data` to `D`.
  `ctx` is `{ params, locale, require, has }` — pull sibling APIs via `ctx.require(contentPlugin)`
  (instance-only). **Runs at BUILD only** (never on the client). Omit for a static page (`ctx.data`
  stays `unknown`; the build still writes an `{}` sidecar so hybrid nav resolves).
- `.render((ctx: { params, data: D, locale, url }) => VNode)` — Preact render; runs at build
  (`renderToString`) AND on the client (DATA nav). `ctx.url(name, params)` builds links (same output
  as `router.toUrl`).
- `.head((ctx) => HeadConfig)` — SEO head (same render ctx, incl. `ctx.url`).
- `.generate((ctx: GenerateContext) => params[] | Promise<params[]>)` — SSG param producer; `ctx` is
  `{ locale, require, has }` (build-only, like `.load`).
- `.meta(record)` — JSON-serializable bag, shipped verbatim in `clientManifest()`.
- `.toJson((ctx) => unknown)` (feeds — separate from the data path) · `.toFile((params) => string)`.
- `.layout((ctx, children) => VNode)` — persistent chrome wrapper. `ctx` is a `LayoutContext`
  (render ctx + `meta`, so chrome reads `ctx.locale` / `ctx.meta.activeTab`). **Applied in SSG
  ONLY** — on client navigation the chrome persists and only the inner swap region is replaced.

Pattern syntax: `{name}` required, `{name:?}` optional, `{lang:?}` the locale-prefix slot (excluded
from specificity). Matching is specificity-sorted (fewest dynamic segments first) and backed by a
**native RegExp** matcher (no `URLPattern`). Since v1.6.0 the **default locale is served at bare
paths** for `{lang:?}` routes — `toUrl`/`toFile`/canonical/hreflang/sitemap/SPA nav all emit bare
URLs for it, and `/{defaultLocale}/…` is built as a content-identical alias (canonical → bare).

> `createCore` / `createCoreConfig` are **internal** to the framework (used in `src/config.ts`),
> NOT re-exported to consumers. A Layer-3 app never imports `@moku-labs/core` directly.

## 2. Plugin catalog

`kind`: **core** = `createCorePlugin`, API injected flat on every `ctx` (no events/depends);
**regular** = `createPlugin`. **Defaults** (isomorphic, auto-composed): site, i18n, router, head, spa.
**Composed explicitly** (`plugins: [...]`): content (isomorphic shell + node provider), data
(optional, isomorphic), build / deploy / cli (node-only). Core (log, env) load first.

| plugin (export) | kind · composition | purpose | depends | emits | key API | config keys |
|---|---|---|---|---|---|---|
| `sitePlugin` | regular · default | Site identity + canonical URL builder (onInit validates: `name` non-empty, `url` absolute) | — | — | `name() url() author() description() canonical(path)` | `name, url, author, description` |
| `i18nPlugin` | regular · default | Locales + translations w/ default fallback; default locale served at BARE paths (v1.6.0) | — | — | `locales() defaultLocale() isLocale(x) localeName(l) ogLocale(l) t(locale,key)` | `locales, defaultLocale, localeNames?, ogLocaleMap?, translations?` |
| `routerPlugin` | regular · default | Typed route DSL, RegExp matching, URL gen; routes from config ONLY (no `set()`) | site, i18n | — | `match(pathname) toUrl(name,params) entries() manifest() clientManifest() mode()` | `routes?` — the render mode is GLOBAL `config.mode` (`ssg`\|`spa`\|`hybrid`, default `hybrid`) |
| `headPlugin` | regular · default | SEO `<head>`: title tmpl, OG, Twitter, canonical, hreflang, JSON-LD; site-level head for bare-path redirects | site, i18n, router | — | `render(resolvedRoute, data) siteHead({url, locale?})` | `titleTemplate?, defaultOgImage?, twitterCard?, twitterHandle?` |
| `spaPlugin` | regular · default | Client runtime: island hydration + intercepted nav (HTML-over-fetch, or DATA nav when `data` composed); inert on Node | router, head | `spa:navigate`, `spa:navigated`, `spa:island-mount`, `spa:island-unmount` | `register(c) navigate(path) current()` (+ top-level island helpers `createIsland(name,hooks)` and the built-in `lazyEmbed` island for `::embed` facades — register it in `islands`) | `swapSelector?` (`"main > section"`), `viewTransitions?` (`false`), `progressBar?` (`true`), `islands?` (`[]`) |
| `contentPlugin` | regular · explicit (isomorphic SHELL) | Provider-driven Markdown model: sanitized HTML, frontmatter, reading time, locale fallback, per-build memo; drafts hidden only when global `stage === "production"`; build-time directives (`mermaid`/`::embed`/`::gallery`) on the node provider — see §2.1 | i18n | `content:ready`, `content:invalidated` | `loadAll(opts?) load(slug,locale) renderMarkdown(md) invalidate(paths) articleToCard(a) contentDir()` | `providers: ContentProvider[]` — compose `fileSystemContent({ contentDir, defaultAuthor?, trustedContent?, extraRemarkPlugins?, extraRehypePlugins?, shikiTheme?, mermaid?, embed?, gallery? })` (node; `shikiTheme` = `BundledTheme` name OR custom theme object; `mermaid`/`embed`/`gallery` each `boolean \| options` and each REQUIRE `trustedContent: true` — see §2.1) |
| `buildPlugin` | regular · node-only | SSG orchestrator: pages, feeds, sitemap, OG images (+ default OG card), co-located article images, custom shell/404; **content-hashed bundle filenames + Cloudflare `_headers` cache rules (v1.8.0)**; persists per-page data when `mode!=="ssg"` + `data` composed; incremental dev rebuilds | site, i18n, content, router, head | `build:phase`, `build:complete` | `run(opts?: {outDir?, skipClean?, overrides?, changed?}) phases()` | `outDir, minify, feeds, sitemap, images, ogImage` (`OgImageConfig \| false`; incl. `fontDir, template?, size?, fonts?, render?, defaultCard?`), `injectAssets?` (`true`), `publicDir?` (`"public"`), `notFound?` (`boolean \| { body?, path? }` — asset placeholders substituted, v1.8.0), `localeRedirects?` (`false`), `clientEntry?, template?` (shell w/ `<!--moku:lang/head/assets/body-->` + split `<!--moku:assets:css/js-->` placeholders), `cacheHeaders?` (`boolean \| { assets?, pages? }`, default `true` — emits `outDir/_headers`) |
| `deployPlugin` | regular · node-only | Deploy `outDir` to Cloudflare Pages (wrangler); scaffolds `wrangler.jsonc` (+ optional GH Actions workflow) | site | `deploy:complete` | `run(opts?) getLastDeployment() init(opts?)` | `target` (`"cloudflare-pages"`), `outDir`, `productionBranch?` (`"main"`), `scrubAllowlist`, `compatibilityDate?, ci?` |
| `cliPlugin` | regular · node-only | Developer CLI: `build`/`serve`/`preview`/`deploy` with boxed Panel TUI + live progress; driven from thin per-command scripts (no argv parser / no `bin`) | build, deploy | — (listens: `build:phase`, `build:complete`, `deploy:complete`) | `build(opts?) serve(opts?) preview(opts?) deploy(opts?)` (`deploy({ guided: true })` = interactive wizard; non-TTY/CI never prompts) | `outDir` (`"dist"`), `port` (`4173`), `watchDirs` (`["content","src"]`), `debounceMs` (`150`), `notFoundFile` (`"404.html"`), `liveReload` (`true`) |
| `dataPlugin` | regular · optional (isomorphic) | Agnostic data provider: persist per-page JSON (Node `write`) + fetch it for DATA nav (browser `at`) | — (no hard depends) | — | `write(entries,opts?) at(path) urlFor(path) fileFor(path)` | `outputDir?` (`"_data"`), `baseUrl?` (`"/_data/"`) |
| `logPlugin` | **core** | In-memory trace + `expect()` assertion DSL; console sink by mode (production = info+) | — | — | `info debug warn error trace() expect() addSink(s) reset()` | `mode` (`test`\|`dev`\|`production`\|`silent`; framework default `production`) |
| `envPlugin` | **core** | Schema-validated, frozen env access | — | — | `get(k) require(k) has(k) getPublic() getPublicMap()` | `schema, providers, publicPrefix` (`"PUBLIC_"`). Providers default to `[]` — the consumer wires them per target (`[processEnv(), dotenv()]` on Node); ONLY `./browser` pre-wires `browserEnv()` |

## 2.1 Content directives (build-time; node `fileSystemContent` provider only)

Three opt-in `fileSystemContent` options (since v1.9.0–v1.12.0). Each renders to **static markup at
build** (no client JS by default) and each **REQUIRES `trustedContent: true`** — they emit raw HTML the
untrusted-content sanitize pass would otherwise strip, so `fileSystemContent` fails fast at construction
if the flag is missing (`validate.ts`). All three default OFF. None add events or build phases (the
co-located embed bundles / gallery folders are copied by the existing `content-images` phase).

**Mermaid diagrams** — `mermaid?: boolean | MermaidDiagramOptions`
- Fenced ` ```mermaid ` code blocks → static inline SVG at build (no runtime Mermaid, zero client JS).
- `MermaidDiagramOptions = { mermaidConfig?: Record<string,unknown>` (passed straight through, e.g.
  `{ theme: "dark" }`)`, renderDiagrams?: (sources, mermaidConfig) => Promise<string[]> }` — `renderDiagrams`
  is a **TEST-ONLY** seam (deterministic SVG without a headless browser); never set it in an app.
- Needs the **optional peer dep `mermaid-isomorphic@^3.0.0`** (+ playwright with an installed browser).

**`::embed` lazy iframe facades** — `embed?: boolean | EmbedOptions` + the `lazyEmbed` SPA island
- Leaf directive: `::embed{src="…" title="…" width? height?}`. `src` = http(s) URL · root-relative `/…` ·
  or co-located relative (`./game/index.html`, resolved to the shared `/<slug>/…` URL the
  `content-images` phase copies the bundle to); protocol-relative / `javascript:` / `data:` are rejected.
  `src` + `title` are required; `width`+`height` (positive integer px, both-or-neither) reserve the box
  aspect-ratio so the embed never shifts layout.
- Renders `<figure class="lazy-embed" data-island="lazy-embed" data-embed-src data-embed-title
  [data-embed-width/height + inline aspect-ratio style]>` wrapping the facade's inner content, SSR'd from a
  Preact component: the built-in **`EmbedFacadeButton`** (a labelled `<button>`) or a consumer
  `facade`. **No iframe is built** — the page costs nothing (no request, no third-party JS) until a click.
- The built-in **`lazyEmbed` island** (register in `pluginConfigs.spa.islands`) listens for a click
  anywhere on the facade and swaps it for the real `<iframe loading="lazy" allow="fullscreen; autoplay;
  gamepad">`, marking `data-embed-active`. All `.lazy-embed*` chrome is consumer CSS.
- `EmbedOptions = { facade?: EmbedFacade }` · `EmbedFacade = FunctionComponent<EmbedFacadeProps>` ·
  `EmbedFacadeProps = { src, title, width?, height?, attributes: Readonly<Record<string,string>> }` —
  `attributes` is the full raw directive bag, so a custom facade can read extra options
  (e.g. `::embed{… poster="/p.jpg"}`).

**`::gallery` folder galleries** — `gallery?: boolean | GalleryOptions`
- Leaf directive: `::gallery{src="./images/dir/" caption?}`. Unlike `::embed`, `src` is a co-located
  **folder** read at build: the framework lists it (`.webp/.jpg/.jpeg/.png/.gif/.avif`), sorts
  alphabetically, and rewrites each image to its shared `/<slug>/<dir>/<file>` URL. `src` required; a
  missing/empty folder fails the build. Skipped on the standalone `renderMarkdown()` path (no slug context).
- Renders `<div class="gallery" data-island="gallery">` wrapping inner content SSR'd from a Preact
  component: the built-in **`GalleryTrack`** (a horizontal `<img>` track, usable bare) or a consumer
  `component`. The swipe/keyboard/lightbox island is **consumer-provided** (mount on
  `[data-island="gallery"]`) — the framework ships only the static track.
- `GalleryOptions = { component?: GalleryComponent }` · `GalleryComponent = FunctionComponent<GalleryProps>` ·
  `GalleryProps = { slides: readonly GallerySlide[], caption: string, attributes }` ·
  `GallerySlide = { src, alt }` (alt = `"<caption> · N"`, or just `"N"` when no caption).

## 3. Property index (what lands on `ctx` / `app`)

**Core APIs are injected flat on every plugin's `ctx`** (no `require` needed): `ctx.log.*`, `ctx.env.*`.
Cross-plugin access is a synchronous pull via `ctx.require(pluginInstance)`; `ctx.has(name)` checks
registration (by name). Route `.load`/`.generate` contexts carry the same `require`/`has`. After
`createApp(...)`, the same per-plugin APIs hang off the app: `app.<plugin>.<method>()`.

| accessor | provider | signature |
|---|---|---|
| `ctx.log.* / app.log.*` | log (core) | `info(event,data?) · debug(…) · warn(…) · error(event,data?,err?) · trace(): readonly LogEntry[] · expect(): ExpectChain · addSink(s) · reset()` |
| `ctx.env.* / app.env.*` | env (core) | `get(k): string\|undefined · require(k): string · has(k): boolean · getPublic(): Readonly<Record<string,string>> · getPublicMap(): ReadonlyMap<string,string>` |
| `app.site.*` | site | `name()/url()/author()/description(): string · canonical(path): string` |
| `app.i18n.*` | i18n | `locales(): readonly string[] · defaultLocale(): string · isLocale(x): boolean · localeName(l)/ogLocale(l): string\|undefined · t(locale,key): string` |
| `app.router.*` | router | `match(pathname): {params,route}\|null · toUrl(name,params): string · entries(): readonly TypedRoute[] · manifest(): readonly RouteDefinition[] · clientManifest(): readonly {pattern,name,meta}[] · mode(): "ssg"\|"spa"\|"hybrid"` — NO `set()` (removed v1.0.0) |
| `app.head.*` | head | `render(resolvedRoute, data): string · siteHead(input: {url, locale?}): string` |
| `app.content.*` | content | `loadAll(opts?: {reuse?}): Promise<Map<string,Article[]>> · load(slug,locale): Promise<Article> · renderMarkdown(md): Promise<string> · invalidate(paths): void · articleToCard(a): ArticleCard · contentDir(): string` |
| `app.build.*` | build | `run(opts?: {outDir?, skipClean?, overrides?, changed?}): Promise<{outDir,pageCount,durationMs}> · phases(): PhaseName[]` |
| `app.spa.*` | spa | `register(c): void · navigate(path): void · current(): string` |
| `app.deploy.*` | deploy | `run(opts?: {branch?,build?}): Promise<DeployResult> · getLastDeployment(): Readonly<DeployResult>\|null · init(opts?: {ci?,check?}): Promise<InitResult>` |
| `app.cli.*` | cli | `build(opts?: {assertNotFound?}): Promise<BuildSummary> · serve(opts?: {port?, open?, og?, sitemap?, feeds?}): Promise<void> · preview(opts?: {port?}): Promise<void> · deploy(opts?: {branch?, yes?, guided?}): Promise<DeployOutcome>` |
| `app.data.*` | data | `write(entries: {path,data}[], opts?: {outDir?}): Promise<{fileCount,bytes,files}> · at(path): Promise<unknown\|null> · urlFor(path): string · fileFor(path): string` |

`island note:` islands are authored with `createIsland(name, hooks)` (lifecycle `onCreate / onMount /
onNavStart / onNavEnd / onUnMount / onDestroy`; **every hook receives a `IslandContext` `{ el, data }`**,
where `data` is the page payload from `script#__DATA__`) and registered via `pluginConfigs.spa.islands`
or `app.spa.register` — see the moku-web skill's Island Architecture section and
`references/component-patterns.md`. Match elements via `data-island="name"`; islands OUTSIDE the
swap region are persistent across navigations (they get `onNavStart`/`onNavEnd`, never nav-unmounts).
The framework ships one built-in island, **`lazyEmbed`** (`data-island="lazy-embed"`, for `::embed`
facades — see §2.1); register it like any other in `pluginConfigs.spa.islands`.

## 4. Event index

| event | payload | emitted by |
|---|---|---|
| `content:ready` | `{ locales: readonly string[]; articleCount: number }` | content |
| `content:invalidated` | `{ paths: readonly string[] }` | content |
| `build:phase` | `{ phase: PhaseName; status: "start" \| "done"; durationMs?: number }` | build |
| `build:complete` | `{ outDir: string; pageCount: number; durationMs: number }` | build |
| `spa:navigate` | `{ from: string; to: string }` | spa |
| `spa:navigated` | `{ url: string }` | spa |
| `spa:island-mount` | `{ name: string; el: Element }` | spa |
| `spa:island-unmount` | `{ name: string; el: Element }` | spa |
| `deploy:complete` | `{ url: string; deploymentId: string; branch: string; durationMs: number }` | deploy |

`build` phase names (`PhaseName`, execution order): `bundle, content, images, pages, content-images,
feeds, sitemap, og-images, public, not-found, locale-redirects, cache-headers, root-index`
(`cache-headers` since v1.8.0; gated by `cacheHeaders`, default on).
The `data` plugin is notification-free (a transport, driven synchronously by `build`). The `cli`
plugin emits nothing — it CONSUMES `build:phase`/`build:complete`/`deploy:complete` via `hooks` to
render live progress (the in-repo example of the hooks mechanism).

## 5. SSG → DATA → SPA (the data flow)

```
BUILD (router.mode !== "ssg")              ON DISK                       CLIENT NAV
 per route instance:                       dist/en/post/index.html       click /en/p2/
   data = route.load(ctx)             ───► (SSG HTML: SEO + first paint) 1. router.match(path)
   html = renderToString(render(data)) ──►                               2. data.at(path) → fetch
   app.data.write([{path,data}])      ───► dist/_data/en/post/index.json    /_data/en/p2/index.json
                                            (REAL data, never HTML)       3. ctx.data = fetched JSON
                                                                          4. route.render(ctx) → Preact
                                                                          (miss/parse-fail → HTML fetch → location.href)
```

- Persisted data = `load()`'s output (not a divergent projection) → the SAME `render` runs both sides → SSR/client parity is structural.
- `route.load` does NOT run on the client; the build already persisted its output. There is **no client
  validation step** (`.parse()` was removed in v1.0.0) — the fetched JSON is used directly as `ctx.data`;
  a missing/malformed sidecar falls back to HTML-over-fetch.
- Static routes (no `.load`) still get an `{}` sidecar, so hybrid nav to them resolves cleanly.
- Navigation strategy (spa): `router.mode() !== "ssg"` AND `data` composed → DATA path; otherwise HTML-over-fetch; failure → `location.href`.
- `node:*` and Preact DOM `render` are isolated behind lazy `import()` (split chunks): a data-composing browser bundle stays node-free; a no-data bundle ships no render layer.
- **Client bundle:** import from **`@moku-labs/web/browser`** (node-free by construction) rather than `.`; there is no framework `hydrate()` / `./client` export — the client runtime is just your own `createApp(...).start()` over the defaults (+ `dataPlugin` for DATA nav), with `browserEnv()` already wired.

## 6. Usage snippets

**SSG build (static only):** `import { createApp, contentPlugin, fileSystemContent, buildPlugin } from "@moku-labs/web"` → `createApp({ config: { mode: "ssg" }, plugins: [contentPlugin, buildPlugin], pluginConfigs: { site, i18n, content: { providers: [fileSystemContent({ contentDir })] }, router: { routes }, head, build } })` then `await app.build.run()`.
**Hybrid (SSG + DATA nav):** add `dataPlugin` for the build (`.` entry); build writes `dist/_data/**` sidecars. The **client entry** is `import { createApp, dataPlugin } from "@moku-labs/web/browser"` → `createApp({ plugins: [dataPlugin], config: { mode: "hybrid" }, pluginConfigs: { site, i18n, router: { routes }, spa: { islands } } }).start()` (env auto-wired, node-free).
**Dev loop / scripts:** compose `cliPlugin` (+ build/deploy) and write thin per-command scripts — `scripts/build.ts` is just `import { app } from "../src/app"; await app.cli.build();`; likewise `app.cli.serve()` (watch + debounced incremental rebuild + live reload), `app.cli.preview()`, `app.cli.deploy()`.
**Content directives (`mermaid` · `::embed` · `::gallery`):** enable on the node provider —
`fileSystemContent({ contentDir: "./content", trustedContent: true, mermaid: true, embed: true, gallery: true })`
(all three REQUIRE `trustedContent: true`; `mermaid` also needs the optional `mermaid-isomorphic` peer).
Authors then write ` ```mermaid ` fences, `::embed{src="https://…" title="…" width="400" height="711"}`,
and `::gallery{src="./images/dir/" caption="…"}`. Register the built-in embed island —
`import { lazyEmbed } from "@moku-labs/web/browser"` → `pluginConfigs.spa.islands: [lazyEmbed]` — and
supply your own `[data-island="gallery"]` island for swipe/lightbox. Swap the rendered components via
`embed: { facade: MyFacade }` / `gallery: { component: MyGallery }` (compose `EmbedFacadeButton` /
`GalleryTrack` inside a richer one).
**Custom plugin:** `export const myPlugin = createPlugin("my", { … })` — types infer from the spec; document the export with a directly-preceding JSDoc block (never destructure exports; see moku-core "Public Export Shape").
**Deploy:** `await app.cli.deploy()` (TTY confirm; `{ yes: true }` skips; `{ guided: true }` wizard) or `await app.deploy.run({ build: true })` after configuring `deploy: { target: "cloudflare-pages", outDir: "dist" }`.

---

### Generation contract (for `moku-sync`)

`moku-sync web` resolves the latest version from the registry's `releaseSource` (**npm registry JSON
is the version-of-truth**; `dist-tags.latest`), then reads the upstream `llms.txt`/`llms-full.txt`
(structured catalog, present since 0.4.0) plus `package.json` `exports`/`engines`/`dependencies`
and `src/plugins/*/{index,events,config,types,api,validate}.ts` + `src/plugins/content/pipeline/*` +
`src/plugins/spa/lazy-embed.ts`, refreshes every section above and the header `Synced version`, then
writes the new version back to `knownVersion` in `skills/moku-core/references/moku-frameworks.md`. When
the llms files and `src/` disagree, **`src/` wins** (verified at 1.6.1: llms still mentioned the removed
`router.set()` and `URLPattern`; at 1.8.0: llms missing `cacheHeaders` / fingerprinted naming;
re-verified at 1.12.4: llms last synced 1.8.2, missing the `mermaid`/`::embed`/`::gallery` content
directives — all read from `src/` here).
