<!--
  Plugin & property index for @moku-labs/web — kept in sync with upstream.
  Source of truth: the `web` entry's releaseSource in
  skills/moku-core/references/moku-frameworks.md (npm + repo README + src/plugins/*).
  Regenerate with the maintainer skill:  moku-sync web
-->

# @moku-labs/web — Plugin & Property Index

**Framework:** `@moku-labs/web` · **Synced version:** `0.3.1` · **Layer:** 2 (framework) ·
**Depends on:** `@moku-labs/core@0.1.0-alpha.6` · **Engines:** node ≥22, bun ≥1.3.14 · **No CLI/bin.**

> v0.3.1 changed only CI + JSDoc; the public API is identical to the v0.3.0 source. This index
> is the catalog to consult first when building or wiring a `@moku-labs/web` app — what plugins
> exist, what each emits, what API each exposes, and what lands on `ctx` / `app`.

## 1. Framework API form (v0.3.1)

`@moku-labs/web` exposes a single entry point. `createApp` is **synchronous** (per Moku core spec);
`start()` / `build.run()` / `deploy.run()` are async.

```ts
import { createApp, defineRoutes, route } from "@moku-labs/web";

const app = createApp({
  config: { mode: "production" },                 // "production" | "development"
  pluginConfigs: {                                 // per-plugin config, keyed by plugin name
    site:    { name: "My Blog", url: "https://blog.dev", author: "Ada", description: "Notes" },
    i18n:    { locales: ["en", "uk"], defaultLocale: "en" },
    content: { contentDir: "./src/content" },
    router:  { routes: defineRoutes({ home: route("/"), post: route("/blog/{slug}/") }), mode: "ssg" },
    head:    { titleTemplate: "%s — My Blog" },
    build:   { outDir: "dist", feeds: true, sitemap: true },
  },
  // plugins?: extra consumer plugins · onReady/onError/onStart/onStop?: lifecycle callbacks
});

await app.build.run();   // SSG → static site in dist/
// or app runtime:  await app.start();  …  await app.stop();
```

Top-level exports (`src/index.ts`):
- **Factories:** `createApp`, `createPlugin` (types infer from the spec — never pass explicit generics).
- **Plugin instances:** `sitePlugin, i18nPlugin, routerPlugin, contentPlugin, headPlugin, buildPlugin, spaPlugin, deployPlugin, logPlugin, envPlugin`.
- **Routing DSL:** `defineRoutes`, `route` (builder methods below).
- **Head/SEO helpers:** `meta, og, twitter, jsonLd, canonical, hreflang, feedLink, buildArticleHead`.
- **Type namespaces:** `Build, Content, Deploy, Env, Head, Log, Router, Spa` (`import { type Router } from "@moku-labs/web"` → `Router.RouteDefinition`, etc.). `site` / `i18n` keep types inline.
- **env providers:** `dotenv()`, `processEnv()`, `cloudflareBindings()`.

`route(pattern)` builder methods: `.load(loader)` (widens `ctx.data`), `.layout(c)`, `.render(h)`,
`.head(h)`, `.generate(h)` (SSG path enumeration), `.meta(m)`, `.toJson(h)`, `.toFile(h)`.

> `createCore` / `createCoreConfig` are **internal** to the framework (used in `src/config.ts`),
> NOT re-exported to consumers. A Layer-3 app never imports `@moku-labs/core` directly.

## 2. Plugin catalog

`kind`: **core** = `createCorePlugin`, API injected flat on every `ctx` (no events/hooks/depends);
**regular** = `createPlugin`. Registration order (frameworkplugins): site → i18n → router → content →
head → build → spa → deploy. Core plugins (log, env) load first.

| plugin (export) | kind | purpose | depends | emits | key API | config keys |
|---|---|---|---|---|---|---|
| `sitePlugin` | regular | Site identity + canonical URL builder | — | — | `name() url() author() description() canonical(path)` | `name, url, author, description` |
| `i18nPlugin` | regular | Locales + translations w/ default fallback | — | — | `locales() defaultLocale() isLocale(x) localeName(l) ogLocale(l) t(locale,key)` | `locales, defaultLocale, localeNames?, ogLocaleMap?, translations?` |
| `routerPlugin` | regular | Type-safe named routes, matching, URL gen | site, i18n | — | `match(pathname) toUrl(name,params) entries() manifest()` | `routes, mode?` (`ssg`\|`spa`\|`hybrid`, default `hybrid`) |
| `contentPlugin` | regular | Markdown→sanitized HTML, frontmatter, locale model | i18n | `content:ready`, `content:invalidated` | `loadAll() load(slug,locale) renderMarkdown(md) invalidate(paths) articleToCard(a)` | `contentDir, trustedContent?, extraRemarkPlugins?, extraRehypePlugins?, shikiTheme?, defaultAuthor?` |
| `headPlugin` | regular | SEO `<head>`: title tmpl, OG, Twitter, canonical, hreflang | site, i18n, router | — | `render(route,data)` | `titleTemplate?, defaultOgImage?, twitterCard?, twitterHandle?` |
| `buildPlugin` | regular | SSG orchestrator: pages, feeds, sitemap, OG images | site, i18n, content, router, head | `build:phase`, `build:complete` | `run(opts?) phases()` | `outDir, minify, feeds, sitemap, images, ogImage` |
| `spaPlugin` | regular | Client runtime: island hydration + intercepted nav | router, head | `spa:navigate`, `spa:navigated`, `spa:component-mount`, `spa:component-unmount` | `register(c) navigate(path) current()` (+ `createComponent(name,hooks)` island helper) | `swapSelector?, viewTransitions?, progressBar?, components?` |
| `deployPlugin` | regular | Deploy `outDir` to Cloudflare Pages (wrangler) | site | `deploy:complete` | `run(opts?) getLastDeployment() init(opts?)` | `target, outDir, productionBranch?, scrubAllowlist?, compatibilityDate?, ci?` |
| `logPlugin` | **core** | In-memory trace + `expect()` assertion DSL | — | — | `info debug warn error trace() expect() addSink(s) reset()` | `mode` (`test`\|`dev`\|`production`\|`silent`) |
| `envPlugin` | **core** | Schema-validated, frozen env access | — | — | `get(k) require(k) has(k) getPublic() getPublicMap()` | `schema, providers, publicPrefix` (default providers `[dotenv(), processEnv()]`) |

## 3. Property index (what lands on `ctx` / `app`)

**Core APIs are injected flat on every plugin's `ctx`** (no `require` needed): `ctx.log.*`, `ctx.env.*`.
After `createApp(...)`, the same per-plugin APIs hang off the app: `app.<plugin>.<method>()`.

| accessor | provider | signature |
|---|---|---|
| `ctx.log.* / app.log.*` | log (core) | `info(event,data?) · debug(…) · warn(…) · error(event,data?,err?) · trace(): readonly LogEntry[] · expect(): ExpectChain · addSink(s) · reset()` |
| `ctx.env.* / app.env.*` | env (core) | `get(k): string\|undefined · require(k): string · has(k): boolean · getPublic(): Readonly<Record<string,string>> · getPublicMap(): ReadonlyMap<string,string>` |
| `app.site.*` | site | `name()/url()/author()/description(): string · canonical(path): string` |
| `app.i18n.*` | i18n | `locales(): readonly string[] · defaultLocale(): string · isLocale(x): boolean · localeName(l)/ogLocale(l): string\|undefined · t(locale,key): string` |
| `app.router.*` | router | `match(pathname): {params,route}\|null · toUrl(name,params): string · entries(): readonly TypedRoute[] · manifest(): readonly RouteDefinition[]` |
| `app.content.*` | content | `loadAll(): Promise<Map<string,Article[]>> · load(slug,locale): Promise<Article> · renderMarkdown(md): Promise<string> · invalidate(paths): void · articleToCard(a): ArticleCard` |
| `app.head.*` | head | `render(route, data): string` |
| `app.build.*` | build | `run(opts?: {outDir?}): Promise<BuildResult> · phases(): PhaseName[]` |
| `app.spa.*` | spa | `register(c): void · navigate(path): void · current(): string` |
| `app.deploy.*` | deploy | `run(opts?: {branch?,build?}): Promise<DeployResult> · getLastDeployment(): Readonly<DeployResult>\|null · init(opts?: {ci?,check?}): Promise<InitResult>` |

`other-skills note:` islands are authored with `createComponent(name, hooks)` and registered via the
spa plugin — see the moku-web skill's Island Architecture section.

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

`build` phase names: `bundle, content, images, pages, feeds, sitemap, og-images, root-index`.

## 5. Usage snippets

**SSG build (most common):** `createApp({ pluginConfigs: { site, i18n, content, router(mode:"ssg"), head, build } })` then `await app.build.run()`.
**Custom plugin:** `export const myPlugin = createPlugin("my", { … })` — types infer from the spec; document the export with a directly-preceding JSDoc block (never destructure exports; see moku-core "Public Export Shape").
**Deploy:** `await app.deploy.run({ build: true })` after configuring `deploy: { target: "cloudflare-pages", outDir: "dist" }`.

---

### Generation contract (for `moku-sync`)

`moku-sync web` resolves the latest version from the registry's `releaseSource` (npm registry JSON
is the version-of-truth — there is **no** `llms.txt`), reads `package.json` `exports` + the README
plugin table + `src/plugins/*/{index,events,config,types,api}.ts`, refreshes every section above and
the header `Synced version`, then writes the new version back to `knownVersion` in
`skills/moku-core/references/moku-frameworks.md`.
