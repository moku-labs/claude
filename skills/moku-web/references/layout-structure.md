# Layout Structure Reference

Framework-level layout + entry/route wiring for any web project. Every snippet below is the real
shape that ships — verified against `@moku-labs/web` source (`web/src` router/spa/build types). For
the full project skeleton + rules see [project-spec.md](project-spec.md).

## Master Layout: SiteLayout + the `.layout()` contract

`.layout((ctx, children) => VNode)` wraps a route's rendered page in persistent chrome. It is
applied at **SSG render only** — on client (SPA) navigation the chrome persists and ONLY the inner
swap region (default `"main > section"`) is replaced. So the layout component owns `<main>`, the
sticky header, the `<section>` swap region (its CHILDREN are what `.render()` produces and what the
SPA swaps), and the footer. Locale-dependent header pieces are kept in sync after navigation by
islands (the header is not re-rendered by the framework).

```tsx
// layouts/SiteLayout.tsx
import type { ComponentChildren, VNode } from "preact";

type SiteLayoutProps = {
  locale: Locale;
  activeTab: string;                 // "home" | "archive" | "about" | "none"
  children: ComponentChildren;       // the rendered page (swap-region children)
};

export function SiteLayout({ locale, activeTab, children }: SiteLayoutProps): VNode {
  return (
    <main data-component="page-fx">
      <header data-sticky>
        <TopBar quote={QUOTES[0] ?? ""} />
        <TabNav locale={locale} activeTab={activeTab} />
      </header>
      <section>{children}</section>   {/* ← the SPA swap region */}
      <Footer />
    </main>
  );
}
```

The shared `.layout()` wrapper reads only `locale` + the route's `.meta()` bag (the framework's full
`LayoutContext` is assignable to that narrower type):

```tsx
// lib/route-helpers.tsx
export const layout = (
  ctx: { locale: string; meta: Record<string, unknown> },
  children: ComponentChildren
): VNode => (
  <SiteLayout
    locale={ctx.locale as Locale}
    activeTab={typeof ctx.meta.activeTab === "string" ? ctx.meta.activeTab : "none"}
  >
    {children}
  </SiteLayout>
);
```

## Page Pattern

Pages are pure components that receive loaded data:

```tsx
interface HomePageProps {
  page: Paginated<ArticleCard>;
  locale: Locale;
}

export function HomePage({ page, locale }: HomePageProps) {
  return (
    <section id="home">
      <header data-hero>
        <h1>Welcome</h1>
      </header>
      <StatusBar />
      <DashboardGrid articles={page.articles} locale={locale} />
    </section>
  );
}
```

## Route Definitions — the single route table

ONE `routes.tsx` is used by the SSG build, the SPA, and link building. Handlers are **ctx-based**:
`.load`/`.generate` receive build-only contexts carrying `require`/`has`, so loaders pull the
content API spec-exactly via `ctx.require(contentPlugin)` — `contentPlugin` is the browser-safe
SHELL (import it from `@moku-labs/web/browser`), so this module ships to the client cleanly while
the loaders never run there.

```tsx
// routes.tsx
import { createUrls, defineRoutes, route } from "@moku-labs/web/browser";

export const routes = defineRoutes({
  home: route("/{lang:?}/")
    .layout(layout)
    .generate((ctx) => [{ lang: ctx.locale }])               // ctx: { locale, require, has }
    .load(async (ctx) => paginate(await allArticles(ctx), 1)) // ctx: { params, locale, require, has }
    .render((ctx) => <HomePage page={ctx.data} locale={ctx.locale} />)
    .head((ctx) => pageHead(ctx, { title: pageTitle(), description: SITE.description, isHome: true }))
    .meta({ activeTab: "home" }),

  article: route("/{lang:?}/{slug}/")
    .layout(layout)
    .generate(async (ctx) =>
      (await allArticles(ctx)).map((a) => ({ lang: ctx.locale, slug: a.computed.slug })))
    .load(async (ctx) => ({
      article: await articleBySlug(ctx),
      recent: (await allArticles(ctx)).slice(0, 5),
    }))
    .render((ctx) => <ArticlePage article={ctx.data.article} recent={ctx.data.recent} locale={ctx.locale} />)
    .head((ctx) => articleHead(ctx, ctx.data.article))
    .meta({ activeTab: "none" }),

  // Static page: NO .load() — build still emits an {} sidecar so hybrid data-nav resolves cleanly.
  about: route("/{lang:?}/about/")
    .layout(layout)
    .generate((ctx) => [{ lang: ctx.locale }])
    .render((ctx) => <AboutPage locale={ctx.locale} />)
    .head((ctx) => pageHead(ctx, { title: "About", description: "About the author", path: "about/" }))
    .meta({ activeTab: "about" }),
});

/** Pure name→URL builder over the route table — no running app/router needed; usable from islands.
 *  Pass the default locale so bare paths match the runtime router.toUrl (v1.6.0 bare-path serving). */
export const urls = createUrls(routes, DEFAULT_LOCALE);
```

The content-access helpers take the loader/generate `ctx` straight through:

```ts
// lib/content.ts
import { contentPlugin } from "@moku-labs/web/browser";

export async function allArticles(ctx: LoaderContext): Promise<Content.Article[]> {
  const byLocale = await ctx.require(contentPlugin).loadAll();
  return byLocale.get(ctx.locale) ?? [];
}
```

## App Entry Points — `app.ts` (Node) + `spa.tsx` (client)

Two compositions over the SAME route table. The Node side opts in the node-only plugins; the client
side imports from `@moku-labs/web/browser` and adds only `dataPlugin`. There is **no `"moku"`
package and no flat options shape** — config is structured: global `config: { stage, mode }`,
`plugins`, and per-plugin `pluginConfigs`.

```ts
// app.ts — SSG composition (Node side)
import {
  buildPlugin, cliPlugin, contentPlugin, createApp, dataPlugin, deployPlugin,
  dotenv, fileSystemContent, processEnv,
} from "@moku-labs/web";
import { SITE } from "./config";
import { i18nConfig } from "./i18n/index";
import { islands } from "./islands";
import { routes } from "./routes";

export const app = createApp({
  plugins: [contentPlugin, buildPlugin, deployPlugin, dataPlugin, cliPlugin],
  config: { mode: "hybrid" },                       // global render switch ("ssg" | "spa" | "hybrid")
  pluginConfigs: {
    site: SITE,                                     // { name, url, author, description }
    i18n: i18nConfig,                               // { locales, defaultLocale, translations, … }
    content: { providers: [fileSystemContent({ contentDir: "./content" })] },
    router: { routes },                             // the SOLE registration path
    head: { titleTemplate: `%s — ${SITE.name}`, twitterCard: "summary_large_image", defaultOgImage: "/og-default.png" },
    build: {
      outDir: "dist", feeds: true, sitemap: true, images: true,
      notFound: { path: "src/404.html" },           // verbatim app-owned 404 (v1.5.3)
      clientEntry: "src/spa.tsx",
      template: "src/index.html",                   // app-owned shell: <!--moku:lang/head/assets/body-->
      ogImage: { fontDir: "assets/fonts/og", render: OgTemplate, defaultCard: OgDefaultCard, fonts: [/* … */] },
    },
    spa: { components: islands, viewTransitions: false, progressBar: true },
    data: { outputDir: "_data", baseUrl: "/_data/" },
    deploy: { target: "cloudflare-pages", outDir: "dist", productionBranch: "main", ci: true },
    cli: { outDir: "dist", port: Number(process.env.PORT ?? 4173) },
    env: { providers: [processEnv(), dotenv(".env")] },  // Node env providers — wired explicitly
  },
});
```

```tsx
// spa.tsx — THE client bundle entry (build.clientEntry points here)
import { createApp, dataPlugin } from "@moku-labs/web/browser";
import { SITE } from "./config";
import { i18nConfig } from "./i18n/index";
import { islands } from "./islands";
import { routes } from "./routes";

const app = createApp({
  plugins: [dataPlugin],                            // ONLY data opted in; defaults are isomorphic
  config: { mode: "hybrid" },
  pluginConfigs: {
    site: SITE,
    i18n: i18nConfig,
    router: { routes },
    head: { titleTemplate: `%s — ${SITE.name}` },
    spa: { components: islands, viewTransitions: false, progressBar: true },
    data: { baseUrl: "/_data/" },
  },
});

app.start().catch((err) => console.error("[blog] SPA boot failed", err));
```

## Command Scripts — thin `app.cli.*` passthroughs

All build/serve/deploy orchestration lives in the framework's `cli` plugin; the project ships one
thin script per command (there is no framework `bin`):

```ts
// scripts/build.ts   (bun run build)
import { app } from "../src/app";
await app.cli.build();

// scripts/serve.ts   (bun run dev) — build once, serve, watch + debounced incremental rebuild + live reload
import { app } from "../src/app";
await app.cli.serve();
```

(`scripts/preview.ts` → `app.cli.preview()`; `scripts/deploy.ts` → `app.cli.deploy()`.)

## Dependencies

The framework brings Preact, the Markdown pipeline, and the build/deploy/cli toolchain transitively
— a consumer app depends on `@moku-labs/web` alone (it pins `@moku-labs/core` itself; never add a
direct core dep):

```json
{
  "engines": { "node": ">=24.0.0", "bun": ">=1.3.14" },
  "dependencies": {
    "@moku-labs/web": "1.6.1"
  },
  "devDependencies": {
    "@playwright/test": "1.60.0",
    "typescript": "6.0.3",
    "vitest": "4.0.18",
    "wrangler": "4.95.0"
  }
}
```

## TypeScript Config for Web Projects

There is no Vite — bundling is the framework build plugin's `bundle` phase (`Bun.build`), so the
ambient types are `bun` + `node`, not `vite/client`:

```json
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "Preserve",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "types": ["bun", "node"]
  },
  "include": ["src", "tests", "scripts", "declarations.d.ts", "*.config.ts"]
}
```

> **TypeScript 6 note:** TS 6.0 defaults `types` to `[]`, so a web project must list the ambient
> type packages it relies on explicitly — `"types": ["bun", "node"]` (add more as needed). `strict`
> is now the TS6 default; keep it set here for clarity.
