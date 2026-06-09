<!--
  Plugin & property index for @moku-labs/web — kept in sync with upstream.
  Source of truth: the `web` entry's releaseSource in
  skills/moku-core/references/moku-frameworks.md (npm + repo llms.txt/llms-full.txt
  + package.json exports + src/plugins/*). Regenerate with:  moku-sync web
-->

# @moku-labs/web — Plugin & Property Index

**Framework:** `@moku-labs/web` · **Synced version:** `1.6.2` · **Layer:** 2 (framework) ·
**Depends on:** `@moku-labs/core@0.1.1` (exact pin — consumers must NOT add a direct core dep) ·
**Engines:** node ≥24, bun ≥1.3.14 · **Two entry points:** `.` (ESM + CJS, full surface, Node SSG)
and **`./browser`** (ESM-only, node-free by construction) · **No `bin`** — the developer CLI ships
as the node-only **`cliPlugin`** (`app.cli.build/serve/preview/deploy`, driven by thin per-command scripts).

> **What's new in 1.x (vs 0.5.6):**
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
> - **`@moku-labs/core` is now `0.1.1`** (exact pin; was `0.1.0-alpha.6`). Browser-bundle CI budget
>   is 50 kB gzip (currently ~45 kB).
>
> ⚠️ The upstream `llms.txt`/`llms-full.txt` at 1.6.1 (byte-identical at 1.6.2) lag the source in two places (they still
> mention `app.router.set()` and the `URLPattern` requirement). This index is generated from
> `src/` — **the source is authoritative**.

## 1. Framework API form (v1.6.2)

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
- **Islands:** `createComponent(name, hooks)`.
- **Head/SEO helpers:** `meta, og, twitter, jsonLd, canonical, hreflang, feedLink, buildArticleHead`.
- **Providers:** env — `dotenv()`, `processEnv()`, `cloudflareBindings()` (Node), `browserEnv()`
  (browser) · content — `fileSystemContent({ contentDir, … })` (Node).
- **Type namespaces:** `Build, Cli, Content, Data, Deploy, Env, Head, Log, Router, Spa`
  (`import { type Router } from "@moku-labs/web"` → `Router.RouteDefinition`, `Router.LoadContext`,
  etc.). `site` / `i18n` keep types inline — there are NO `Site`/`I18n` namespaces.

**`@moku-labs/web/browser` exports (`src/browser.ts`)** — the ESM-only client entry, node-free by
construction. Same `createApp`/`createPlugin` over the same isomorphic defaults, PLUS `dataPlugin`,
`contentPlugin` (the browser-safe SHELL, so route modules can reference it for `ctx.require` in
build-only loaders), `defineRoutes`, `route`, `createUrls`, `createComponent`, `browserEnv`, the SEO
head primitives, and the type namespaces `Content, Data, Env, Head, Log, Router, Spa`. It **excludes**
everything node-only: `buildPlugin`/`deployPlugin`/`cliPlugin`, `fileSystemContent`, the node
providers `dotenv`/`processEnv`/`cloudflareBindings`, and the `Build`/`Cli`/`Deploy` type namespaces.
`browserEnv()` is the **pre-wired default** `env` provider here (reads `import.meta.env` +
`globalThis.__ENV__`), so no `pluginConfigs.env.providers` is needed. A CI gate
(`bun run check:bundle`) asserts zero static node/native imports and a 50 kB gzip budget.

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
| `spaPlugin` | regular · default | Client runtime: island hydration + intercepted nav (HTML-over-fetch, or DATA nav when `data` composed); inert on Node | router, head | `spa:navigate`, `spa:navigated`, `spa:component-mount`, `spa:component-unmount` | `register(c) navigate(path) current()` (+ top-level `createComponent(name,hooks)` island helper) | `swapSelector?` (`"main > section"`), `viewTransitions?` (`false`), `progressBar?` (`true`), `components?` (`[]`) |
| `contentPlugin` | regular · explicit (isomorphic SHELL) | Provider-driven Markdown model: sanitized HTML, frontmatter, reading time, locale fallback, per-build memo; drafts hidden only when global `stage === "production"` | i18n | `content:ready`, `content:invalidated` | `loadAll(opts?) load(slug,locale) renderMarkdown(md) invalidate(paths) articleToCard(a) contentDir()` | `providers: ContentProvider[]` — compose `fileSystemContent({ contentDir, defaultAuthor?, trustedContent?, extraRemarkPlugins?, extraRehypePlugins?, shikiTheme? })` (node; `shikiTheme` = `BundledTheme` name OR custom theme object) |
| `buildPlugin` | regular · node-only | SSG orchestrator: pages, feeds, sitemap, OG images (+ default OG card), co-located article images, custom shell/404; persists per-page data when `mode!=="ssg"` + `data` composed; incremental dev rebuilds | site, i18n, content, router, head | `build:phase`, `build:complete` | `run(opts?: {outDir?, skipClean?, overrides?, changed?}) phases()` | `outDir, minify, feeds, sitemap, images, ogImage` (`OgImageConfig \| false`; incl. `fontDir, template?, size?, fonts?, render?, defaultCard?`), `injectAssets?` (`true`), `publicDir?` (`"public"`), `notFound?` (`boolean \| { body?, path? }`), `localeRedirects?` (`false`), `clientEntry?, template?` (shell w/ `<!--moku:lang/head/assets/body-->` placeholders) |
| `deployPlugin` | regular · node-only | Deploy `outDir` to Cloudflare Pages (wrangler); scaffolds `wrangler.jsonc` (+ optional GH Actions workflow) | site | `deploy:complete` | `run(opts?) getLastDeployment() init(opts?)` | `target` (`"cloudflare-pages"`), `outDir`, `productionBranch?` (`"main"`), `scrubAllowlist`, `compatibilityDate?, ci?` |
| `cliPlugin` | regular · node-only | Developer CLI: `build`/`serve`/`preview`/`deploy` with boxed Panel TUI + live progress; driven from thin per-command scripts (no argv parser / no `bin`) | build, deploy | — (listens: `build:phase`, `build:complete`, `deploy:complete`) | `build(opts?) serve(opts?) preview(opts?) deploy(opts?)` (`deploy({ guided: true })` = interactive wizard; non-TTY/CI never prompts) | `outDir` (`"dist"`), `port` (`4173`), `watchDirs` (`["content","src"]`), `debounceMs` (`150`), `notFoundFile` (`"404.html"`), `liveReload` (`true`) |
| `dataPlugin` | regular · optional (isomorphic) | Agnostic data provider: persist per-page JSON (Node `write`) + fetch it for DATA nav (browser `at`) | — (no hard depends) | — | `write(entries,opts?) at(path) urlFor(path) fileFor(path)` | `outputDir?` (`"_data"`), `baseUrl?` (`"/_data/"`) |
| `logPlugin` | **core** | In-memory trace + `expect()` assertion DSL; console sink by mode (production = info+) | — | — | `info debug warn error trace() expect() addSink(s) reset()` | `mode` (`test`\|`dev`\|`production`\|`silent`; framework default `production`) |
| `envPlugin` | **core** | Schema-validated, frozen env access | — | — | `get(k) require(k) has(k) getPublic() getPublicMap()` | `schema, providers, publicPrefix` (`"PUBLIC_"`). Providers default to `[]` — the consumer wires them per target (`[processEnv(), dotenv()]` on Node); ONLY `./browser` pre-wires `browserEnv()` |

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

`island note:` islands are authored with `createComponent(name, hooks)` (lifecycle `onCreate / onMount /
onNavStart / onNavEnd / onUnMount / onDestroy`; **every hook receives a `ComponentContext` `{ el, data }`**,
where `data` is the page payload from `script#__DATA__`) and registered via `pluginConfigs.spa.components`
or `app.spa.register` — see the moku-web skill's Island Architecture section and
`references/component-patterns.md`. Match elements via `data-component="name"`; islands OUTSIDE the
swap region are persistent across navigations (they get `onNavStart`/`onNavEnd`, never nav-unmounts).

## 4. Event index

| event | payload | emitted by |
|---|---|---|
| `content:ready` | `{ locales: readonly string[]; articleCount: number }` | content |
| `content:invalidated` | `{ paths: readonly string[] }` | content |
| `build:phase` | `{ phase: PhaseName; status: "start" \| "done"; durationMs?: number }` | build |
| `build:complete` | `{ outDir: string; pageCount: number; durationMs: number }` | build |
| `spa:navigate` | `{ from: string; to: string }` | spa |
| `spa:navigated` | `{ url: string }` | spa |
| `spa:component-mount` | `{ name: string; el: Element }` | spa |
| `spa:component-unmount` | `{ name: string; el: Element }` | spa |
| `deploy:complete` | `{ url: string; deploymentId: string; branch: string; durationMs: number }` | deploy |

`build` phase names (`PhaseName`, execution order): `bundle, content, images, pages, content-images,
feeds, sitemap, og-images, public, not-found, locale-redirects, root-index`.
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
**Hybrid (SSG + DATA nav):** add `dataPlugin` for the build (`.` entry); build writes `dist/_data/**` sidecars. The **client entry** is `import { createApp, dataPlugin } from "@moku-labs/web/browser"` → `createApp({ plugins: [dataPlugin], config: { mode: "hybrid" }, pluginConfigs: { site, i18n, router: { routes }, spa: { components: islands } } }).start()` (env auto-wired, node-free).
**Dev loop / scripts:** compose `cliPlugin` (+ build/deploy) and write thin per-command scripts — `scripts/build.ts` is just `import { app } from "../src/app"; await app.cli.build();`; likewise `app.cli.serve()` (watch + debounced incremental rebuild + live reload), `app.cli.preview()`, `app.cli.deploy()`.
**Custom plugin:** `export const myPlugin = createPlugin("my", { … })` — types infer from the spec; document the export with a directly-preceding JSDoc block (never destructure exports; see moku-core "Public Export Shape").
**Deploy:** `await app.cli.deploy()` (TTY confirm; `{ yes: true }` skips; `{ guided: true }` wizard) or `await app.deploy.run({ build: true })` after configuring `deploy: { target: "cloudflare-pages", outDir: "dist" }`.

---

### Generation contract (for `moku-sync`)

`moku-sync web` resolves the latest version from the registry's `releaseSource` (**npm registry JSON
is the version-of-truth**; `dist-tags.latest`), then reads the upstream `llms.txt`/`llms-full.txt`
(structured catalog, present since 0.4.0) plus `package.json` `exports`/`engines`/`dependencies`
and `src/plugins/*/{index,events,config,types,api}.ts`, refreshes every section above and the header
`Synced version`, then writes the new version back to `knownVersion` in
`skills/moku-core/references/moku-frameworks.md`. When the llms files and `src/` disagree, **`src/`
wins** (verified at 1.6.1: llms still mentioned the removed `router.set()` and `URLPattern`).
