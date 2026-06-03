<!--
  Plugin & property index for @moku-labs/web — kept in sync with upstream.
  Source of truth: the `web` entry's releaseSource in
  skills/moku-core/references/moku-frameworks.md (npm + repo llms.txt/llms-full.txt
  + package.json exports + src/plugins/*). Regenerate with:  moku-sync web
-->

# @moku-labs/web — Plugin & Property Index

**Framework:** `@moku-labs/web` · **Synced version:** `0.5.6` · **Layer:** 2 (framework) ·
**Depends on:** `@moku-labs/core@0.1.0-alpha.6` · **Engines:** node ≥24 (router uses global `URLPattern`), bun ≥1.3.14 ·
**Two entry points:** `.` (ESM + CJS, full surface, Node SSG) and **`./browser`** (ESM-only, node-free by construction) · **No CLI/bin.**

> **What's new in 0.5.x (vs 0.4.0):**
> - **Two entry points** — `.` (full, dual ESM+CJS, the Node build) and **`@moku-labs/web/browser`**
>   (ESM-only client entry whose static import graph references *zero* node-only modules, so node code
>   can never reach the client bundle — stronger than relying on `sideEffects` tree-shaking). `./browser`
>   pre-wires `browserEnv()` as the default `env` provider, so env works with **zero config** in the
>   browser. (v0.5.0)
> - **Breaking: `route.layout(ctx, children)`** — was `(children)`; now receives a `LayoutContext`
>   (render ctx + `meta`) first and is **applied in SSG** (persists across spa nav). (v0.4.1)
> - **Typed `content.shikiTheme`** — a `BundledTheme` name union OR a custom theme object. (v0.5.3)
> - Fixes: build copies co-located article images + correct OG/redirect/asset paths; log production
>   sink is info+ only; spa second-consecutive-nav swap fix.
>
> The earlier **SSG → DATA → SPA** model (isomorphic `data` plugin, `route.parse()` gate, `router.mode`)
> is unchanged. This index is the catalog to consult first when building or wiring a `@moku-labs/web`
> app — what plugins exist, what each emits, what API each exposes, what lands on `ctx` / `app`.

## 1. Framework API form (v0.5.6)

`@moku-labs/web` publishes **two entries** (pick by target): **`.`** for the Node SSG build (dual
ESM+CJS, full surface) and **`@moku-labs/web/browser`** for the client bundle (ESM-only, guaranteed
node-free, `browserEnv()` pre-wired). `createApp` is **synchronous** (per Moku core spec); `start()` /
`build.run()` / `deploy.run()` are async. **Defaults are isomorphic** (`site, i18n, router, head, spa`
+ the `log`/`env` core); the **node-only** plugins (`content, build, deploy`) are exported only from
`.` and composed via `plugins: [...]` for a Node build; `data` is optional/isomorphic (exported from
both entries). For the client, import from `./browser` — do NOT rely on tree-shaking `.`.

```ts
import {
  createApp, defineRoutes, route,
  contentPlugin, buildPlugin, dataPlugin, processEnv,
} from "@moku-labs/web";

const routes = defineRoutes({
  home: route("/{lang:?}/")
    .load((_p, locale) => listCards(locale))      // → D (runs at BUILD only)
    .parse((raw) => raw as Card[])                 // client validation gate (unknown → D)
    .render((ctx) => <Home cards={ctx.data} />),
  post: route("/{lang:?}/{slug}/")
    .generate((locale) => slugs(locale).map((slug) => ({ slug })))
    .load((p, locale) => getPost(p.slug, locale))
    .parse((raw) => PostSchema.parse(raw))         // hand guard OR any Standard-Schema lib
    .render((ctx) => <Post post={ctx.data} />)
    .head((ctx) => ({ title: ctx.data.title })),
});

const app = createApp({
  config: { mode: "production" },                  // "production" | "development" (global)
  plugins: [contentPlugin, buildPlugin, dataPlugin], // node-only, ADDED to the isomorphic defaults
  pluginConfigs: {                                  // per-plugin config, keyed by plugin name
    site:    { name: "My Blog", url: "https://blog.dev", author: "Ada", description: "Notes" },
    i18n:    { locales: ["en"], defaultLocale: "en" },
    router:  { routes, mode: "hybrid" },            // the SINGLE ssg/data/spa switch (default hybrid)
    content: { contentDir: "./content" },
    head:    { titleTemplate: "%s — My Blog" },
    build:   { outDir: "dist", feeds: true, sitemap: true },
    env:     { providers: [processEnv()] },
  },
});

await app.start();
await app.build.run();   // dist/<path>/index.html + (mode!=="ssg") dist/_data/<path>/index.json
// or app runtime:  await app.start();  …  await app.stop();
```

Top-level exports (`src/index.ts`):
- **Factories:** `createApp`, `createPlugin` (types infer from the spec — never pass explicit generics).
- **Plugin instances:** `sitePlugin, i18nPlugin, routerPlugin, headPlugin, spaPlugin` (isomorphic defaults) ·
  `contentPlugin, buildPlugin, deployPlugin, dataPlugin` (node-only / optional, compose explicitly) ·
  `logPlugin, envPlugin` (core).
- **Routing DSL:** `defineRoutes`, `route` (builder methods below).
- **Head/SEO helpers:** `meta, og, twitter, jsonLd, canonical, hreflang, feedLink, buildArticleHead`.
- **Type namespaces:** `Build, Content, Data, Deploy, Env, Head, Log, Router, Spa`
  (`import { type Router } from "@moku-labs/web"` → `Router.RouteDefinition`, etc.). `site` / `i18n` keep types inline.
- **env providers:** `dotenv()`, `processEnv()`, `cloudflareBindings()` (Node) · `browserEnv()` (browser).

**`@moku-labs/web/browser` exports (`src/browser.ts`)** — the ESM-only client entry, node-free by
construction. Same `createApp`/`createPlugin` over the same isomorphic defaults, PLUS `dataPlugin`,
`defineRoutes`, `route`, `createComponent`, `browserEnv`, the SEO head primitives, and the
browser-relevant type namespaces `Data, Env, Head, Log, Router, Spa`. It **excludes** everything
node-only: `contentPlugin`/`buildPlugin`/`deployPlugin`, the node providers `dotenv`/`processEnv`/
`cloudflareBindings`, and the `Build`/`Content`/`Deploy` type namespaces. `browserEnv()` is the
**pre-wired default** `env` provider here (reads `import.meta.env` + `globalThis.__ENV__`), so no
`pluginConfigs.env.providers` is needed. A CI gate (`bun run check:bundle`) asserts zero static
node/native imports and a ~35 kB gzip budget.

```ts
// client bundle — node-free entry, env auto-wired
import { createApp, dataPlugin, defineRoutes, route } from "@moku-labs/web/browser";
const app = createApp({ plugins: [dataPlugin], pluginConfigs: { router: { mode: "spa", routes } } });
await app.start();
```

`route(pattern)` builder methods (each returns the builder):
- `.load((params, locale) => D | Promise<D>)` — data loader; widens `ctx.data` to `D`. **Runs at BUILD only.**
- `.parse((raw: unknown) => D)` — client validation gate; MUST return `.load`'s type (mismatch = compile error).
  Runs on the CLIENT before `render`; throw to reject (→ HTML fallback). **Required** for data-navigable
  routes in `hybrid`/`spa` mode, else the build fails (`assertDataValidators`).
- `.render((ctx: { params, data: D, locale }) => VNode)` — Preact render; runs at build (`renderToString`) AND on the client.
- `.head((ctx) => HeadConfig)` · `.generate((locale) => params[])` (SSG expansion) · `.meta(record)` (JSON bag in `clientManifest`).
- `.toJson((ctx) => unknown)` (feeds, separate from the data path) · `.toFile((params) => string)`.
- `.layout((ctx, children) => VNode)` — persistent chrome wrapper. `ctx` is a `LayoutContext` (render ctx + `meta`,
  so chrome can read `ctx.locale` / `ctx.meta.*`). **Applied in SSG** (v0.4.1 breaking change — was `(children)`); on
  spa navigation the chrome persists and only the inner swap region is replaced.

Pattern syntax: `{name}` required, `{name:?}` optional, `{lang:?}` the locale-prefix slot (excluded from specificity).

> `createCore` / `createCoreConfig` are **internal** to the framework (used in `src/config.ts`),
> NOT re-exported to consumers. A Layer-3 app never imports `@moku-labs/core` directly.

## 2. Plugin catalog

`kind`: **core** = `createCorePlugin`, API injected flat on every `ctx` (no events/depends);
**regular** = `createPlugin`. **Defaults** (isomorphic, auto-composed): site, i18n, router, head, spa.
**Node-only / optional** (compose via `plugins: [...]`): content, build, deploy, data. Core (log, env) load first.

| plugin (export) | kind · default? | purpose | depends | emits | key API | config keys |
|---|---|---|---|---|---|---|
| `sitePlugin` | regular · default | Site identity + canonical URL builder | — | — | `name() url() author() description() canonical(path)` | `name, url, author, description` |
| `i18nPlugin` | regular · default | Locales + translations w/ default fallback | — | — | `locales() defaultLocale() isLocale(x) localeName(l) ogLocale(l) t(locale,key)` | `locales, defaultLocale, localeNames?, ogLocaleMap?, translations?` |
| `routerPlugin` | regular · default | Type-safe named routes, matching, URL gen, mode | site, i18n | — | `match(pathname) toUrl(name,params) entries() manifest() clientManifest() mode()` | `routes, mode?` (`ssg`\|`spa`\|`hybrid`, default `hybrid`) |
| `headPlugin` | regular · default | SEO `<head>`: title tmpl, OG, Twitter, canonical, hreflang, JSON-LD | site, i18n, router | — | `render(resolvedRoute, data)` | `titleTemplate?, defaultOgImage?, twitterCard?, twitterHandle?` |
| `spaPlugin` | regular · default | Client runtime: island hydration + intercepted nav (HTML-over-fetch, or DATA nav when `data` composed); inert on Node | router, head | `spa:navigate`, `spa:navigated`, `spa:component-mount`, `spa:component-unmount` | `register(c) navigate(path) current()` (+ `createComponent(name,hooks)` island helper) | `swapSelector?` (`"main > section"`), `viewTransitions?` (`true`), `progressBar?` (`true`), `components?` |
| `contentPlugin` | regular · node-only | Markdown→sanitized HTML, frontmatter, reading time, locale model | i18n | `content:ready`, `content:invalidated` | `loadAll() load(slug,locale) renderMarkdown(md) invalidate(paths) articleToCard(a)` | `contentDir, defaultAuthor?, trustedContent?, extraRemarkPlugins?, extraRehypePlugins?, shikiTheme?` (typed: a `BundledTheme` name or a custom theme object) |
| `buildPlugin` | regular · node-only | SSG orchestrator: pages, feeds, sitemap, OG images, co-located article images; persists per-page data when `mode!=="ssg"` + `data` composed | site, i18n, content, router, head | `build:phase`, `build:complete` | `run(opts?) phases()` | `outDir, minify, feeds, sitemap, images, ogImage, injectAssets?, publicDir?, notFound?, localeRedirects?, clientEntry?, template?` |
| `deployPlugin` | regular · node-only | Deploy `outDir` to Cloudflare Pages (wrangler) | site | `deploy:complete` | `run(opts?) getLastDeployment() init(opts?)` | `target, outDir, productionBranch?, scrubAllowlist?, compatibilityDate?, ci?` |
| `dataPlugin` | regular · optional (isomorphic) | Agnostic data provider: persist per-page JSON (Node `write`) + fetch it for DATA nav (browser `at`) | — (no hard depends) | — | `write(entries,opts?) at(path) urlFor(path) fileFor(path)` | `outputDir?` (`"_data"`), `baseUrl?` (`"/_data/"`) |
| `logPlugin` | **core** | In-memory trace + `expect()` assertion DSL | — | — | `info debug warn error trace() expect() addSink(s) reset()` | `mode` (`test`\|`dev`\|`production`\|`silent`) |
| `envPlugin` | **core** | Schema-validated, frozen env access | — | — | `get(k) require(k) has(k) getPublic() getPublicMap()` | `schema, providers, publicPrefix` (default providers `[dotenv(), processEnv()]` on Node) |

## 3. Property index (what lands on `ctx` / `app`)

**Core APIs are injected flat on every plugin's `ctx`** (no `require` needed): `ctx.log.*`, `ctx.env.*`.
Cross-plugin access is a synchronous pull via `ctx.require(plugin)` (resolved by name); `ctx.has(name)`
checks registration. After `createApp(...)`, the same per-plugin APIs hang off the app: `app.<plugin>.<method>()`.

| accessor | provider | signature |
|---|---|---|
| `ctx.log.* / app.log.*` | log (core) | `info(event,data?) · debug(…) · warn(…) · error(event,data?,err?) · trace(): readonly LogEntry[] · expect(): ExpectChain · addSink(s) · reset()` |
| `ctx.env.* / app.env.*` | env (core) | `get(k): string\|undefined · require(k): string · has(k): boolean · getPublic(): Readonly<Record<string,string>> · getPublicMap(): ReadonlyMap<string,string>` |
| `app.site.*` | site | `name()/url()/author()/description(): string · canonical(path): string` |
| `app.i18n.*` | i18n | `locales(): readonly string[] · defaultLocale(): string · isLocale(x): boolean · localeName(l)/ogLocale(l): string\|undefined · t(locale,key): string` |
| `app.router.*` | router | `match(pathname): {params,route}\|null · toUrl(name,params): string · entries(): readonly TypedRoute[] · manifest(): readonly RouteDefinition[] · clientManifest(): readonly {pattern,name,meta}[] · mode(): "ssg"\|"spa"\|"hybrid"` |
| `app.content.*` | content | `loadAll(): Promise<Map<string,Article[]>> · load(slug,locale): Promise<Article> · renderMarkdown(md): Promise<string> · invalidate(paths): void · articleToCard(a): ArticleCard` |
| `app.head.*` | head | `render(resolvedRoute, data): string` |
| `app.build.*` | build | `run(opts?: {outDir?}): Promise<{outDir,pageCount,durationMs}> · phases(): PhaseName[]` |
| `app.spa.*` | spa | `register(c): void · navigate(path): void · current(): string` |
| `app.deploy.*` | deploy | `run(opts?: {branch?,build?}): Promise<DeployResult> · getLastDeployment(): Readonly<DeployResult>\|null · init(opts?: {ci?,check?}): Promise<InitResult>` |
| `app.data.*` | data | `write(entries: {path,data}[], opts?: {outDir?}): Promise<{fileCount,bytes,files}> · at(path): Promise<unknown\|null> · urlFor(path): string · fileFor(path): string` |

`island note:` islands are authored with `createComponent(name, hooks)` (lifecycle `onCreate / onMount /
onNavStart / onNavEnd / onUnMount / onDestroy`, ctx `{ el, data }`) and registered via the spa plugin —
see the moku-web skill's Island Architecture section. Match elements via `data-component="name"`.

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

`build` phase names (`PhaseName`): `bundle, content, images, pages, feeds, sitemap, og-images, public, not-found, locale-redirects, root-index`.
The `data` plugin is notification-free (no events) — it is a transport, driven synchronously by `build`.

## 5. SSG → DATA → SPA (the data flow)

```
BUILD (router.mode !== "ssg")              ON DISK                       CLIENT NAV
 per route instance:                       dist/en/post/index.html       click /en/p2/
   data = route.load(params, locale)  ───► (SSG HTML: SEO + first paint) 1. router.match(path)
   html = renderToString(render(data)) ──►                               2. data.at(path) → fetch
   app.data.write([{path,data}])      ───► dist/_data/en/post/index.json    /_data/en/p2/index.json
                                            (REAL data, never HTML)       3. route.parse(unknown) → D
                                                                          4. route.render(D) → Preact
                                                                          (miss/throw → HTML fetch → location.href)
```

- Persisted data = `load()`'s output (not a divergent projection) → the SAME `render` runs both sides → SSR/client parity is structural.
- `route.load` does NOT run on the client; the build already persisted its output. `route.parse` is the client trust boundary.
- Navigation strategy (spa): `router.mode() !== "ssg"` AND `data` composed → DATA path; otherwise HTML-over-fetch; failure → `location.href`.
- `node:*` and Preact DOM `render` are isolated behind lazy `import()` (split chunks): a data-composing browser bundle stays node-free; a no-data bundle ships no render layer.
- **Client bundle:** import from **`@moku-labs/web/browser`** (node-free by construction) rather than `.`; there is no framework `hydrate()` / `./client` export — the client runtime is just your own `createApp(...).start()` over the defaults (+ `dataPlugin` for DATA nav), with `browserEnv()` already wired.

## 6. Usage snippets

**SSG build (static only):** `import { createApp, contentPlugin, buildPlugin } from "@moku-labs/web"` → `createApp({ plugins: [contentPlugin, buildPlugin], pluginConfigs: { site, i18n, content, router: { routes, mode: "ssg" }, head, build } })` then `await app.build.run()`. No `.parse()` required.
**Hybrid (SSG + DATA nav):** add `dataPlugin` for the build (`.` entry) and give every data-navigable route a `.parse()`; build writes `dist/_data/**` sidecars. The **client entry** is `import { createApp, dataPlugin } from "@moku-labs/web/browser"` → `createApp({ plugins: [dataPlugin], pluginConfigs: { router: { mode: "hybrid", routes } } }).start()` (env auto-wired, node-free).
**Custom plugin:** `export const myPlugin = createPlugin("my", { … })` — types infer from the spec; document the export with a directly-preceding JSDoc block (never destructure exports; see moku-core "Public Export Shape").
**Deploy:** `await app.deploy.run({ build: true })` after configuring `deploy: { target: "cloudflare-pages", outDir: "dist" }`.

---

### Generation contract (for `moku-sync`)

`moku-sync web` resolves the latest version from the registry's `releaseSource` (**npm registry JSON
is the version-of-truth**; `dist-tags.latest`), then reads the upstream `llms.txt`/`llms-full.txt`
(preferred structured catalog, present since 0.4.0) plus `package.json` `exports`/`engines`/`dependencies`
and `src/plugins/*/{index,events,config,types,api}.ts`, refreshes every section above and the header
`Synced version`, then writes the new version back to `knownVersion` in
`skills/moku-core/references/moku-frameworks.md`.
