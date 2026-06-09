---
name: moku-web
description: >
  Moku web patterns: Preact + Vite + island architecture. Triggers on:
  "moku web", "moku component", "moku CSS architecture", "moku island pattern",
  "moku data attributes", "moku @scope", "moku @layer", "moku design tokens",
  "moku layout structure", or building web apps in a Moku project.
---

# Moku Web Patterns

## Current Project State
!`test -f package.json && grep -E '"(@moku-labs/web|preact)"' package.json 2>/dev/null || true`

Enforce the established web patterns from the Moku blog reference implementation. Keep structure clear, documented, and simple. The blog reference is vendored — open `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/sandbox/demo/blog/` (`index.html`, `spa.ts` vs `main.ts` entry split, `islands/lightbox`, `islands/share-buttons`, `plugins/feed`) for the canonical island + SSG-vs-SPA structure. See `sandbox-index.md`.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | `@moku-labs/web` (SSG + SPA over Preact) |
| Build | Framework `build` plugin (`Bun.build` bundle phase) + `cli` plugin dev loop — no Vite |
| CSS | Vanilla CSS + @scope + @layer |
| Interactivity | Island architecture (vanilla TS, `createComponent`) |
| Package Manager | Bun |
| TypeScript | Strict mode, `jsxImportSource: "preact"` |
| Tests | Vitest (unit/integration) + Playwright (visual regression) |

## Framework API (@moku-labs/web v1.6.1)

`@moku-labs/web` is the Layer-2 framework these web patterns sit on. It publishes **two entry
points**: **`.`** for the Node SSG build (dual ESM+CJS, full surface) and **`@moku-labs/web/browser`**
for the client bundle (ESM-only, node-free by construction, `browserEnv()` pre-wired). `createApp` is
**synchronous**, while `start()` / `build.run()` / `cli.*` / `deploy.run()` are async. **Defaults are
isomorphic** (`site, i18n, router, head, spa` + `log`/`env` core); everything else — the isomorphic
`content` SHELL (+ node `fileSystemContent` provider), the node-only `build, deploy, cli`, the
optional isomorphic `data` — is composed explicitly via `plugins: [...]`. For the client import from
`./browser` — don't rely on tree-shaking `.`.

```tsx
// routes.tsx — ONE route table for build + SPA + links (import from ./browser: ships clean)
import { createUrls, defineRoutes, route, contentPlugin } from "@moku-labs/web/browser";

export const routes = defineRoutes({
  home: route("/{lang:?}/")
    .load(async (ctx) => listCards((await ctx.require(contentPlugin).loadAll()).get(ctx.locale) ?? []))
    .render((ctx) => <Home cards={ctx.data} url={ctx.url} />),
  post: route("/{lang:?}/{slug}/")
    .generate(async (ctx) => (await slugs(ctx)).map((slug) => ({ lang: ctx.locale, slug })))
    .load((ctx) => ctx.require(contentPlugin).load(ctx.params.slug, ctx.locale))
    .render((ctx) => <Post post={ctx.data} />)
    .head((ctx) => ({ title: ctx.data.frontmatter.title })),
});
export const urls = createUrls(routes, "en");  // pure name→URL builder (no app); 2nd arg = default locale

// app.ts — Node SSG build (full entry)
import { createApp, contentPlugin, fileSystemContent, buildPlugin, dataPlugin, cliPlugin } from "@moku-labs/web";

const app = createApp({
  config: { mode: "hybrid" },                        // GLOBAL { stage, mode }: stage "production"|"development"|"test",
                                                     // mode "ssg"|"spa"|"hybrid" — the SINGLE render switch
  plugins: [contentPlugin, buildPlugin, dataPlugin, cliPlugin],  // ADDED to the isomorphic defaults
  pluginConfigs: {                                   // per-plugin, keyed by plugin name
    site:    { name: "My Blog", url: "https://blog.dev", author: "Ada", description: "Notes" },
    content: { providers: [fileSystemContent({ contentDir: "./content" })] },
    router:  { routes },                             // SOLE registration path (no imperative set())
  },
});
await app.cli.build();   // or app.build.run() — dist/<path>/index.html + (mode!=="ssg") dist/_data/<path>/index.json
```

```ts
// Client bundle — node-free entry, env auto-wired (browserEnv is the default provider)
import { createApp, dataPlugin } from "@moku-labs/web/browser";
const app = createApp({ plugins: [dataPlugin], config: { mode: "hybrid" }, pluginConfigs: { router: { routes } } });
await app.start();
```

**Breaking since 0.5.6 (v1.0.0):** route handlers are **ctx-based** — `.load((ctx) => D)` gets
`{ params, locale, require, has }` and pulls sibling APIs via `ctx.require(contentPlugin)`;
`.generate((ctx) => params[])` gets `{ locale, require, has }`. **`.parse()` is REMOVED** — on a
client DATA nav the fetched JSON is used directly as `ctx.data` (miss/malformed → HTML fallback).
The render mode is **global** `config.mode` (no longer router config), and `config.stage`
(3-valued) replaced the old production/development mode. Routes register via
`pluginConfigs.router.routes` only (`app.router.set()` removed). `content` became an isomorphic
shell + composable providers (`fileSystemContent`).

**SSG → DATA → SPA:** the route is the contract — `route(pattern).load(ctx→D)?.layout((ctx,
children)→VNode).render(ctx→VNode).head(ctx→HeadConfig).generate(ctx→params[]).meta(bag)`. At
build, the SAME `load`/`render` produce static HTML *and* (when `mode !== "ssg"` + `dataPlugin`
composed) per-page JSON sidecars via the isomorphic `data` plugin; the browser fetches them for
DATA-driven navigation and runs the same `render`. One switch governs it all: `config.mode = "ssg" |
"spa" | "hybrid"` (default `hybrid`). Engines: **node ≥24, bun ≥1.3.14** (route matching is a native
RegExp — `URLPattern` was dropped in v1.4.1). Since v1.6.0 the **default locale is served at bare
paths** for `{lang:?}` routes.

Ships 5 isomorphic default plugins — `site, i18n, router, head, spa` — plus the explicit-compose
`content` (isomorphic shell), node-only `build, deploy, cli` (the developer CLI:
`app.cli.build/serve/preview/deploy`, no `bin`), the optional isomorphic `data` provider, and 2 core
plugins (`log`, `env`) whose APIs are injected flat on every `ctx` (`ctx.log.*`, `ctx.env.*`). Author
custom plugins with `createPlugin("name", spec)` (types infer from the spec; document the export
with a directly-preceding JSDoc block — never destructure exports, see moku-core "Public Export
Shape"). SEO `<head>` helpers (`meta/og/twitter/jsonLd/canonical/hreflang/feedLink/
buildArticleHead`), the `route()`/`defineRoutes()` builders, `createUrls(routes, defaultLocale?)`,
and `createComponent` (islands) are top-level exports.

**Full catalog — plugins, events, config, the `ctx`/`app` property index, usage:**
[`references/plugin-index.md`](references/plugin-index.md). Consult it first when wiring an
app; it is regenerated from upstream by the `moku-sync` maintainer skill.

## Project Structure

```
src/
  components/        # Preact components (pure, SSG-rendered)
    *View.tsx         # Content views
    *.tsx             # Preact components
    *.css             # Per-component CSS (colocated, @scope)
  islands/           # Vanilla TS client-side interactivity
    index.ts          # Island registry → pluginConfigs.spa.components
    share-buttons.ts, lightbox.ts, ...  # kebab-case, one island per file
  layouts/
    SiteLayout.tsx    # Master page chrome (applied via route .layout())
  pages/
    HomePage.tsx, ArticlePage.tsx, ...
  styles/            # Global CSS with @layer system
    index.css         # Layer entry point
    tokens.css        # Design system tokens
    reset.css, base.css, components.css, ...
  lib/               # Helper functions (content access, head builders, urls)
  i18n/              # Locales + translations (pluginConfigs.i18n)
  config.ts          # Site identity constants (SITE)
  routes.tsx         # THE single route table (+ createUrls) — build, SPA, links
  app.ts             # Node SSG composition (createApp + node-only plugins)
  spa.tsx            # Client bundle entry (createApp from ./browser + dataPlugin)
scripts/
  build.ts, serve.ts, preview.ts, deploy.ts  # thin app.cli.* passthroughs
```

## Core Principles

### Zero Classes in Markup
All styling and state signals via `data-*` attributes. Never use CSS classes in markup — and this
applies to **island/runtime code and JSDoc `@example` blocks too**: use `el.dataset.active = ""` /
`delete el.dataset.active`, never `el.classList.add("active")` / `el.classList.add("loading")`. A
classList call anywhere (including examples) is the regression this rule prevents.

```tsx
// CORRECT
<div data-component="titlebar">
  <span data-title>{quote}</span>
</div>

// WRONG
<div className="titlebar">
  <span className="title">{quote}</span>
</div>
```

### @scope for Component Encapsulation
Each component has a colocated `.css` file using `@scope`:

```css
@scope ([data-component="dashboard"]) {
  :scope {
    display: grid;
    gap: 0.75rem;
  }
  article {
    background: var(--surface-card);
    border: 1px solid var(--border-default);
  }
}
```

### @layer for CSS Ordering
Defined in `styles/index.css`:
```css
@layer reset, tokens, base, components, animations, utilities;
```

### Two-Layer Token System
Primitive tokens (raw values) + semantic tokens (purpose-based aliases):
```css
:root {
  /* Primitives */
  --color-stone-950: #1c1917;
  --color-amber-500: #f59e0b;

  /* Semantic */
  --surface-page: light-dark(var(--color-stone-100), var(--color-stone-950));
  --text-primary: light-dark(var(--color-stone-950), var(--color-stone-100));
}
```

### Island Architecture
Client-side interactivity via vanilla TS, not framework components. `createComponent` comes from
`@moku-labs/web/browser`; **every lifecycle hook receives a `ComponentContext` `{ el, data }`**
(`el` = the bound element, `data` = the page payload from `script#__DATA__`):

```typescript
import { createComponent } from '@moku-labs/web/browser';

export const shareButtons = createComponent('share', {
  onMount({ el }) { /* attach listeners */ },
  onDestroy({ el }) { /* cleanup */ },
  onNavEnd({ el, data }) { /* update on SPA navigation */ },
});
// register via pluginConfigs.spa.components: [shareButtons] (or app.spa.register)
```

## Common Mistakes — DON'T Do These

```tsx
// DON'T: Use className — all styling via data-* attributes
<div className="card active">           // WRONG
<div data-component="card" data-active> // CORRECT

// DON'T: Use React hooks — Preact components are pure, state in islands
function Counter() {
  const [count, setCount] = useState(0);  // WRONG — no hooks in SSG
  return <span>{count}</span>;
}

// DON'T: Use classes in CSS selectors
.card { padding: 1rem; }                 // WRONG
@scope ([data-component="card"]) {
  :scope { padding: 1rem; }              // CORRECT — scoped via data attr
}

// DON'T: Hardcode colors — use semantic tokens
article { background: #1c1917; }              // WRONG — hardcoded hex
article { background: var(--surface-card); }  // CORRECT — semantic token

// DON'T: Write unscoped CSS — component styles must use @scope
article { padding: 1rem; }              // WRONG — global pollution
@scope ([data-component="card"]) {
  article { padding: 1rem; }            // CORRECT — scoped
}
```

## Bundle Targets
- JS: < 8KB gzipped
- CSS: < 10KB gzipped

## References

- `references/component-patterns.md` — Preact components, islands, naming conventions
- `references/css-architecture.md` — Tokens, @scope, @layer, responsive design
- `references/layout-structure.md` — SiteLayout, pages, routing, entry point
- `references/plugin-index.md` — **@moku-labs/web plugin & property index** (every plugin, event, config key, `ctx`/`app` accessor + API form); the catalog to consult when wiring an app

## Advanced References (load when needed)

For projects with a `src/styles/` directory or multiple CSS files, read `references/css-architecture.md` (token system and @layer ordering).
For projects using island components (`*Island.ts`), read `references/component-patterns.md` (island lifecycle: onCreate/onDestroy/onNavEnd).

## Related Skills

- **moku-core** — Architecture fundamentals, factory chain, lifecycle, config resolution
- **moku-plugin** — Plugin structure, complexity tiers, wiring harness pattern for web plugins

### Cross-Skill Example: Blog Component with Plugin Integration

```typescript
// moku-core: Events typed in config.ts
type Events = { 'page:render': { path: string; html: string } };

// moku-plugin: Standard tier plugin emits events
export const rendererPlugin = createPlugin('renderer', {
  api: (ctx) => ({
    render: (path: string, html: string) => {
      void ctx.emit('page:render', { path, html });
    },
  }),
});

// moku-web: Preact component (pure, no hooks)
export function ArticleCard({ title, summary }: Props) {
  return (
    <article data-component="article-card">
      <h2 data-title>{title}</h2>
      <p>{summary}</p>
    </article>
  );
}
// Colocated CSS: ArticleCard.css
// @scope ([data-component="article-card"]) { ... }

// moku-web: Island for client interactivity
// article-card.ts — vanilla TS, event-driven; hooks receive ComponentContext { el, data }
export const articleCard = createComponent('article-card', {
  onMount({ el }) { el.querySelector('h2')?.addEventListener('click', expand); },
});
```
