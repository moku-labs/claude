# Component Patterns Reference

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

Islands provide client-side behavior. They are NOT framework components. They are imperative, event-driven TypeScript.

```typescript
// ShareButtonsIsland.ts
export const ShareButtons = createComponent('share', {
  onCreate(element) {
    const copyBtn = element.querySelector('[data-share="copy"]');
    copyBtn?.addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href);
    });
  },
  onDestroy(element) {
    // cleanup event listeners
  },
  onNavEnd({ doc }) {
    // update state on SPA navigation
  },
});
```

### Island Naming
- File: `ComponentNameIsland.ts`
- Mount on elements with `data-component="xxx"`
- Use `createComponent` from `moku/spa`

### Island Hooks
| Hook | When | Purpose |
|------|------|---------|
| `onCreate` | Element first appears | Attach listeners, init state |
| `onDestroy` | Element removed | Cleanup listeners |
| `onNavEnd` | SPA navigation completes | Update for new page |

## File Colocation

Components and their CSS live together:
```
components/
  DashboardGrid.tsx     # Preact component
  DashboardGrid.css     # Scoped CSS (@scope)
  ShareButtons.tsx      # Preact markup
  ShareButtonsIsland.ts # Client-side behavior
  ShareButtons.css      # Scoped CSS
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

Pages are wrapped by layouts via the routing system:

```typescript
export const homeRoute = route('/{lang:?}/')
  .load(async (params, locale) => loadPaginated(locale, 1))
  .render((ctx) => HomePage({ ...ctx }))
  .head((ctx) => buildPageHead(...))
  .meta({ activeTab: 'home' })
  .layout(SiteLayout);
```
