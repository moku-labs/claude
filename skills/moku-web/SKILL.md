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
!`test -f package.json && grep -E '"(preact|vite)"' package.json 2>/dev/null || true`

Enforce the established web patterns from the Moku blog reference implementation. Keep structure clear, documented, and simple.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Preact (tiny React alternative) |
| Build | Vite |
| CSS | Vanilla CSS + @scope + @layer + postcss-preset-env |
| Interactivity | Island architecture (vanilla TS) |
| Package Manager | Bun |
| TypeScript | Strict mode, `jsxImportSource: "preact"` |
| Tests | Playwright (visual regression) |

## Project Structure

```
src/
  components/       # Preact components + vanilla TS islands
    *Layout.tsx      # Page layout wrappers
    *View.tsx        # Content views
    *.tsx            # Preact components
    *Island.ts       # Client-side interactivity
    *.css            # Per-component CSS (colocated)
  layouts/
    SiteLayout.tsx   # Master page layout
  pages/
    HomePage.tsx, ArticlePage.tsx, ...
  styles/            # Global CSS with @layer system
    index.css        # Layer entry point
    tokens.css       # Design system tokens
    reset.css, base.css, components.css, ...
  utils/             # Helper functions
  types/             # TypeScript definitions
  config.ts          # Site constants
  main.ts            # App entry point
```

## Core Principles

### Zero Classes in Markup
All styling via `data-*` attributes. Never use CSS classes in markup.

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
Client-side interactivity via vanilla TS, not framework components:

```typescript
export const ShareButtons = createComponent('share', {
  onCreate(element) { /* attach listeners */ },
  onDestroy(element) { /* cleanup */ },
  onNavEnd({ doc }) { /* update on SPA navigation */ },
});
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

## Advanced References (load when needed)

For projects with complex CSS architecture or many islands:
!`find src/styles -name '*.css' 2>/dev/null | awk 'END{if(NR>5)print "Multiple CSS files detected — consult references/css-architecture.md for token system and @layer ordering details."}' || true`
!`find src/components -name '*Island.ts' 2>/dev/null | wc -l | tr -d ' ' | grep -qv '^0$' && echo "Islands in use — consult references/component-patterns.md for island lifecycle hooks (onCreate/onDestroy/onNavEnd)." || true`

## Related Skills

- **moku-core** — Architecture fundamentals, factory chain, lifecycle, config resolution
- **moku-plugin** — Plugin structure, complexity tiers, wiring harness pattern for web plugins

### Cross-Skill Example: Blog Component with Plugin Integration

```typescript
// moku-core: Events typed in config.ts
type Events = { 'page:render': { path: string; html: string } };

// moku-plugin: Standard tier plugin emits events
export const renderer = createPlugin('renderer', {
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
// ArticleCardIsland.ts — vanilla TS, event-driven
export const ArticleCard = createComponent('article-card', {
  onCreate(el) { el.querySelector('h2')?.addEventListener('click', expand); },
});
```
