# Component Patterns Reference

Synced against `@moku-labs/web@1.12.2` (verified: `web/src/plugins/spa/types.ts`). Framework-level
patterns for any web project. For the full project skeleton + rules see
[project-spec.md](project-spec.md); for layout/route wiring see
[layout-structure.md](layout-structure.md).

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

## Component taxonomy (organize by role, not by feature)

Group components by role; each renders a `data-component="…"` root (its CSS scope). Names below are
generic roles — use whatever your project needs:

| role | what it is | scope/notes |
|---|---|---|
| **Chrome** (persistent, outside swap region) | header, primary nav, footer, locale switcher | mounted by the layout; kept in sync after nav by islands, NOT re-rendered by the framework |
| **Views** (inside swap region) | one top-level view per page family (detail view, list/grid view, section blocks) | pages are thin wrappers around a view |
| **Items / cards** | repeated list item, card, pagination control, status strip | a child component can have NO own CSS and be styled by its parent's `@scope` |
| **Atoms** | badge, tag, button, chip | a reusable atom that must look identical everywhere is styled **without** `@scope` (global `[data-x]`) — use sparingly |
| **Interactive facades** | media player, embed, gallery, form, share control | static markup at build, paired with an island (below) |

## Component ↔ island pairing

A static Preact component renders markup at build; a same-named island (`data-component="name"`)
adds client behavior. Three general patterns:

- **Plain pairing.** A component renders markup carrying its data (e.g. a copy button with
  `data-copy-url`); a same-named island reads `el`/`el.dataset` and wires the behavior (Clipboard,
  fetch, observers). No framework involvement.
- **Customizing the framework `::gallery` directive.** The Markdown directive
  `::gallery{src="./images/dir/"}` is rendered by YOUR Preact component (wired via
  `content.gallery: { component: MyGallery }`); the framework wraps it in
  `<div data-component="gallery">`. Pair it with your own gallery island for paging/lightbox — the
  framework ships only the static markup. (Content-pipeline projects only.)
- **Customizing the framework `::embed` directive.** `::embed{src title}` renders YOUR facade
  component (wired via `content.embed: { facade: MyFacade }`) — a static click-to-activate
  placeholder. The activation island is the **framework-provided `lazyEmbed`** (imported from
  `@moku-labs/web/browser`), placed in the registry alongside your islands; on click it swaps the
  facade for the real `<iframe loading="lazy">`. (Content-pipeline projects only.)

```ts
// islands/index.ts — registry mixes your islands + framework islands (e.g. lazyEmbed)
import { lazyEmbed } from "@moku-labs/web/browser";
import { myGallery } from "./gallery";
import { myWidget } from "./widget";
export const islands = [myWidget, myGallery, lazyEmbed /* … */];
```

**Conventions that generalize:**
- **Coordinate via shared module exports, not events.** A shared module exports a function (e.g.
  `openLightbox(...)`) that several islands import + call; islands never message each other directly.
- **Persistent perf islands** mount on a node OUTSIDE the swap region (e.g. `<body>`) so they survive
  navigation — a useful one to adopt: a link-prefetch island that warms a page's `_data` JSON on
  `pointerover`/`touchstart` before the click.
