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
!`if [ -f package.json ]; then grep -E '"(preact|vite)"' package.json 2>/dev/null; fi`

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

## Bundle Targets
- JS: < 8KB gzipped
- CSS: < 10KB gzipped

## References

- `references/component-patterns.md` — Preact components, islands, naming conventions
- `references/css-architecture.md` — Tokens, @scope, @layer, responsive design
- `references/layout-structure.md` — SiteLayout, pages, routing, entry point
