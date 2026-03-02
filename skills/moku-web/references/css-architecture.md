# CSS Architecture Reference

## Two-Layer Token System

### Layer 1: Primitive Tokens (Raw Values)
```css
:root {
  /* Colors — Stone palette for neutrals */
  --color-stone-50: #fafaf9;
  --color-stone-100: #f5f5f4;
  --color-stone-200: #e7e5e4;
  --color-stone-800: #292524;
  --color-stone-900: #1c1917;
  --color-stone-950: #0c0a09;

  /* Accent colors */
  --color-amber-500: #f59e0b;
  --color-orange-500: #f97316;
  --color-rose-500: #f43f5e;
  --color-lime-500: #84cc16;

  /* Spacing (4px base) */
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-4: 1rem;      /* 16px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */

  /* Typography scale */
  --text-xs: 0.6rem;
  --text-sm: 0.7rem;
  --text-base: 0.78rem;
  --text-md: 0.85rem;
  --text-lg: 1rem;
  --text-xl: 1.2rem;
  --text-2xl: 1.4rem;
  --text-3xl: 1.8rem;
  --text-4xl: 2.5rem;

  /* Animation */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-out-back: cubic-bezier(0.34, 1.56, 0.64, 1);
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;
  --duration-enter: 600ms;
  --stagger-delay: 80ms;
}
```

### Layer 2: Semantic Tokens (Purpose-Based)
```css
:root {
  --surface-page: light-dark(var(--color-stone-100), var(--color-stone-950));
  --surface-card: light-dark(var(--color-stone-50), var(--color-stone-900));
  --text-primary: light-dark(var(--color-stone-950), var(--color-stone-100));
  --text-secondary: light-dark(var(--color-stone-600), var(--color-stone-400));
  --border-default: light-dark(var(--color-stone-200), var(--color-stone-800));
  --accent-primary: var(--color-amber-500);
}
```

Uses `light-dark()` CSS function for native theme support. No polyfill needed.

## @layer System

Defined in `styles/index.css`:
```css
@layer reset, tokens, base, components, animations, utilities;
```

| Layer | Purpose | Files |
|-------|---------|-------|
| reset | Browser reset | `reset.css` |
| tokens | CSS custom properties | `tokens.css` |
| base | Element defaults | `base.css` |
| components | Component styles | `components.css` + per-component files |
| animations | Keyframes | `animations.css` |
| utilities | Utility classes | `utilities.css` |

## @scope for Component Encapsulation

Each component has a colocated CSS file using `@scope`:

```css
/* DashboardGrid.css */
@scope ([data-component="dashboard"]) {
  :scope {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
  }

  article {
    background: var(--surface-card);
    border: 1px solid var(--border-default);
    border-radius: 0.5rem;
    padding: var(--space-4);
  }

  h2 {
    font-family: var(--font-display);
    font-size: var(--text-lg);

    a {
      color: var(--text-secondary);
      transition: color var(--duration-normal);

      &:hover {
        color: var(--accent-primary);
      }
    }
  }
}
```

### @scope Rules
- **Selector:** `@scope ([data-component="name"])` — matches the data attribute
- **:scope** refers to the scoped element itself
- **No classes in selectors** — use element selectors and data attributes
- **Nesting allowed** — CSS nesting inside @scope
- **Use semantic tokens** — never hardcode colors

## Responsive Design

```css
/* Breakpoints (reference, hardcoded in @media) */
--bp-desktop: 900px;
--bp-tablet: 768px;
--bp-mobile: 600px;
--bp-small: 375px;
--bp-tiny: 320px;

@media (max-width: 900px) { /* tablet */ }
@media (max-width: 600px) { /* mobile */ }
@media (max-width: 375px) { /* small phone */ }
@media (max-width: 320px) { /* tiny */ }
```

## PostCSS Configuration

```javascript
export default {
  plugins: {
    'postcss-preset-env': {
      stage: 2,
      features: {
        'nesting-rules': true,
        'custom-media-queries': true,
        'cascade-layers': false,      // Native CSS, no polyfill
        'light-dark-function': false,  // Native, no polyfill
        'custom-properties': false,    // Native, no polyfill
      },
    },
  },
};
```

## Bundle Targets
- CSS: < 10KB gzipped (enforced via vite-plugin-bundlesize)
- JS: < 8KB gzipped
