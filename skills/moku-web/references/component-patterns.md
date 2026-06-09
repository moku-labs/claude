# Component Patterns Reference

Synced against `@moku-labs/web@1.6.2` (verified: `web/src/plugins/spa/types.ts`) and the blog
reference implementation (`blog/src/components`, `blog/src/islands`).

## Preact Components (SSG Rendering)

Pure functional components with explicit Props interface. Use JSX with `jsxImportSource: "preact"`.

```typescript
interface Props {
  quote: string;
}

export function TopBar({ quote }: Props) {
  return (
    <div data-component="titlebar">
      <span data-title>{quote}</span>
    </div>
  );
}
```

### Rules
- **No classes in markup** — all styling via `data-*` attributes
- **Props interface defined explicitly** — never inline
- **Pure, functional** — no hooks, no state (state lives in islands)
- **Semantic data attributes** — `data-component`, `data-variant`, `data-id`, `data-status`

### Naming Convention
- **Components:** `PascalCase` — `TopBar.tsx`, `DashboardGrid.tsx`
- **Data attributes:** `kebab-case` — `data-component="split-pane"`
- **Element attributes:** `data-variant`, `data-id`, `data-status`

## Vanilla TS Islands (Client-Side Interactivity)

Islands provide client-side behavior. They are NOT framework components — they are imperative,
event-driven TypeScript, authored with `createComponent(name, hooks)` from
**`@moku-labs/web/browser`** and registered via `pluginConfigs.spa.components` (or
`app.spa.register`). The spa plugin mounts an island on every element whose
`data-component="<name>"` matches.

**Every lifecycle hook receives a `ComponentContext` `{ el, data }`** — `el` is the bound `Element`,
`data` is the page payload parsed from the inline `script#__DATA__` element. There is no
bare-element or `{ doc }` hook form.

```typescript
// islands/share-buttons.ts
import { createComponent } from "@moku-labs/web/browser";

/** Share-buttons island: wires the copy-link button to the Clipboard API. */
export const shareButtons = createComponent("share", {
  onMount({ el }) {
    el.querySelector('[data-share="copy"]')?.addEventListener("click", handleCopyClick);
  },
  onDestroy({ el }) {
    el.querySelector('[data-share="copy"]')?.removeEventListener("click", handleCopyClick);
  },
});
```

```typescript
// islands/index.ts — the registry passed to the spa plugin
import { shareButtons } from "./share-buttons";
import { lightbox } from "./lightbox";

/** All SPA islands registered for hydration — passed to `pluginConfigs.spa.components`. */
export const islands = [shareButtons, lightbox];
```

Use **shared module functions** as handlers (not inline closures) so the exact same reference is
added on mount and removed on unmount/destroy.

### Island Naming
- File: `islands/<kebab-case-name>.ts` (e.g. `share-buttons.ts`, `tab-nav.ts`), one island per file,
  re-exported from `islands/index.ts`
- Export: `camelCase` const (e.g. `shareButtons`)
- Mount on elements with `data-component="xxx"`
- Use `createComponent` from **`@moku-labs/web/browser`**

### Island Lifecycle Hooks (all receive `ComponentContext { el, data }`)
| Hook | When | Purpose |
|------|------|---------|
| `onCreate` | Instance created (before DOM attach) | One-time init |
| `onMount` | Instance attached to its element | Attach listeners, init state |
| `onNavStart` | SPA navigation begins (instance still mounted) | Loading state (`el.dataset.loading = ""`) |
| `onNavEnd` | SPA navigation completed | Update for the new page (`delete el.dataset.loading`) |
| `onUnMount` | Instance about to detach | Remove listeners |
| `onDestroy` | Instance destroyed (after detach) | Final cleanup |

**Persistent vs page-scoped:** islands whose element lives OUTSIDE the swap region (default
`"main > section"`) persist across navigations — they receive `onNavStart`/`onNavEnd` and are never
nav-unmounted. Islands inside the swap region are fully unmounted/destroyed and re-created on every
navigation.

## File Colocation

Pure Preact markup lives in `components/` with its scoped CSS; client behavior lives in `islands/`:

```
components/
  DashboardGrid.tsx     # Preact component
  DashboardGrid.css     # Scoped CSS (@scope)
  ShareButtons.tsx      # Preact markup (renders data-component="share")
  ShareButtons.css      # Scoped CSS
islands/
  share-buttons.ts      # Client-side behavior (createComponent("share", …))
  index.ts              # Island registry
```

## Page Components

Pages are top-level components that receive data and compose sub-components:

```typescript
export function HomePage({ articles, locale }: Props) {
  return (
    <section id="home">
      <header data-hero>...</header>
      <StatusBar />
      <DashboardGrid articles={articles} />
    </section>
  );
}
```

Pages are wrapped in chrome by the routing system. Route handlers are **ctx-based** (single
argument); the layout is a `(ctx, children)` wrapper applied at SSG only:

```typescript
export const homeRoute = route('/{lang:?}/')
  .layout(layout)                                   // (ctx, children) => VNode — SSG-only chrome
  .generate((ctx) => [{ lang: ctx.locale }])        // ctx: { locale, require, has }
  .load(async (ctx) => loadPaginated(ctx, 1))       // ctx: { params, locale, require, has } — BUILD-only
  .render((ctx) => <HomePage page={ctx.data} locale={ctx.locale} />)
  .head((ctx) => buildPageHead(ctx))
  .meta({ activeTab: 'home' });
```

There is no `.parse()` step — on a client DATA navigation the fetched JSON is fed straight in as
`ctx.data` and the same `render` runs (miss/malformed falls back to HTML-over-fetch).
