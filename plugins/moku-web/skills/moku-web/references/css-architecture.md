<!--
  CSS architecture for any @moku-labs/web app. Pure CSS — NO preprocessor, NO PostCSS, NO Vite.
  Bundled by the framework build plugin's `bundle` phase (Bun.build). Framework-level guidance,
  verified against @moku-labs/web@1.12.2. Pair with project-spec.md.
-->

# CSS Architecture Reference

A moku-web project styles with **pure CSS** — `@layer` for cascade order, `@scope` for component
encapsulation, custom properties for tokens, `light-dark()` for theming. **No SCSS/Less, no
PostCSS, no Vite, no preprocessor.** The framework `build` plugin's `bundle` phase (`Bun.build`)
collects `src/styles/main.css` and the per-component sheets into a content-hashed
`assets/main-<hash>.css`. This scales cleanly to dozens of components + global styles with zero
naming collisions. (Verified against `@moku-labs/web@1.12.2`.) For the surrounding project structure
and rules see [project-spec.md](project-spec.md).

## Assembly: `main.css` is the entry

`src/styles/main.css` declares the layer order ONCE and `@import`s the rest. There is no
`index.css` and no bundler-specific entry — `build.clientEntry`'s module graph reaches `main.css`,
and the bundle phase emits the fingerprinted stylesheet.

```css
/* src/styles/main.css */
@layer reset, tokens, base, components, animations, utilities;

@import "./reset.css"      layer(reset);
@import "./tokens.css"     layer(tokens);
@import "./base.css"       layer(base);
@import "./components.css" layer(components);   /* aggregator → per-component sheets */
@import "./animations.css" layer(animations);
@import "./utilities.css"  layer(utilities);
@import "./fonts.css";                          /* @font-face — intentionally NOT layered */
```

`components.css` is the aggregator that `@import`s every per-component sheet plus the content
sheets (`article.css`, `code.css`, `Gallery.css`, `lightbox.css`, `hero.css`, …). Adding a
component = create `Foo.tsx` + `Foo.css`, then add one `@import "../components/Foo.css"` line.

| layer | file(s) | holds |
|---|---|---|
| `reset` | `reset.css` | minimal reset (`* { margin/padding/box-sizing }`, `html` scrollbar-gutter + text-size-adjust, `a` inherit/no-underline) — NOT a heavy reset |
| `tokens` | `tokens.css` | primitive + semantic custom properties |
| `base` | `base.css` | element defaults (body, h1–h6, main, img, lists) |
| `components` | `components.css` → per-component `*.css` | every `@scope`d component sheet + content typography |
| `animations` | `animations.css` | `@keyframes` (card-enter, pulse, blink-cursor) + hover/focus interactions |
| `utilities` | `utilities.css` | highest-priority overrides — e.g. `prefers-reduced-motion` killing transitions/animations (no `!important` needed, the layer wins) |
| (unlayered) | `fonts.css` | `@font-face` — kept out of layers so font loading is independent |

## Two-layer token system (`tokens.css`)

**Primitives** (raw values, named by material) → **semantics** (purpose aliases, themed). Both in
`:root`.

```css
:root {
  /* — Primitives — */
  --color-stone-950: #1c1917;  --color-stone-100: #f5f5f4;   /* 11-step warm-neutral scale */
  --color-amber-500: #f59e0b;  --color-orange-500: #f97316;  /* fixed accents (no theming) */
  --color-rose-500:  #f43f5e;  --color-lime-500:   #84cc16;
  --font-sans: "IBM Plex Sans Variable", "Segoe UI", sans-serif;
  --font-mono: "IBM Plex Mono", monospace;
  --font-code: "Fira Code Variable", "IBM Plex Mono", monospace;
  --space-1: 0.25rem; /* 4px base */    --space-12: 3rem;
  --text-xs: 0.6rem;  --text-base: 0.78rem;  --text-4xl: 2.5rem;   /* modular scale */
  --tracking-normal: 0.05em;  --tracking-widest: 0.15em;
  /* paired easings: expo ENTERS (decelerates), ease-in EXITS (accelerates) — a reversal
     mid-flight hands off at near-zero velocity, so a collapse interrupting an expand never jumps */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in:       cubic-bezier(0.4, 0, 1, 1);
  --duration-fast: 150ms;  --duration-normal: 300ms;  --duration-enter: 600ms;
  --stagger-delay: 80ms;   --width-content: 1100px;
}

:root {
  /* — Semantics (themed via light-dark) — */
  color-scheme: dark;
  --surface-page:  light-dark(var(--color-stone-100), var(--color-stone-950));
  --surface-card:  light-dark(var(--color-stone-300), var(--color-stone-850));
  --text-primary:  light-dark(var(--color-stone-950), var(--color-stone-100));
  --text-body:     light-dark(var(--color-stone-700), var(--color-stone-300));
  --border-default: var(--color-stone-800);
  --accent-primary: var(--color-amber-500);   /* accents are FIXED across themes (no light-dark) */
  --accent-success: var(--color-lime-500);
  --hover-glow: color-mix(in srgb, var(--color-amber-500) 4%, transparent);  /* derived w/ color-mix */
}
```

- **`light-dark()`** drives theming natively (no JS, no polyfill) — applied to surfaces + text;
  **accents stay fixed** (saturated, theme-invariant).
- **`color-mix(in srgb, … N%, transparent)`** derives hover glows / soft fills from a token (works
  across themes because it mixes fixed primitives).
- **Breakpoints are reference-only** (a comment in `tokens.css`) — custom properties can't be used
  in `@media`, so pixel values are written directly in queries.
- No `@property` declarations.

## `@scope` for component encapsulation

Each component sheet scopes everything to its `[data-island="…"]` root, so generic element
selectors (`article`, `h2`, `time`) never collide across components.

```css
/* components/DashboardGrid.css */
@scope ([data-island="dashboard"]) {
  :scope { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; }

  article {
    background: var(--surface-card);
    border: 1px solid var(--border-default);
    animation: card-enter var(--duration-enter) var(--ease-out-expo) both;
    &:nth-child(2) { animation-delay: calc(1 * var(--stagger-delay)); }   /* nesting OK inside @scope */
  }
  :scope[data-entered] article { animation: none; }   /* island sets [data-entered] post-play */

  h2 { font-family: var(--font-display); a { color: var(--text-secondary); } }
  [data-tags] { display: flex; gap: 0.35rem; margin-top: auto; }

  @media (max-width: 600px) { :scope { grid-template-columns: 1fr; } }   /* breakpoints stay scoped */
}
```

Two refinements the reference uses:

- **Donut scope** — exclude a nested self-scoping child:
  ```css
  @scope ([data-island="tab-nav"]) to ([data-island="lang-switcher"]) { a { /* tab-nav links, NOT lang-switcher's */ } }
  ```
- **Intentional global atoms** — a reusable leaf that must look identical everywhere is styled
  **without** `@scope` (e.g. `GitTag.css` styles bare `[data-tag]`), so it renders the same inside
  any component's scope. Use sparingly, only for true cross-context atoms.

### `@scope` rules
- Selector: `@scope ([data-island="name"])`; `:scope` is the scoped root.
- **No classes** — element selectors + `data-*` attributes only (matches the no-`className` markup rule).
- CSS nesting is allowed inside `@scope`.
- Always use semantic tokens; never hardcode colors.
- Keep media queries inside the scope so a component owns its responsive behavior.

## Content & OG typography

Long-form article HTML (from the Markdown pipeline) is styled by content sheets scoped to the
content root, so generic tags (`h2`, `p`, `table`, `pre code`, `img`) are safe:

```css
@scope ([data-content]) { h2 { /* … */ } pre code { /* Shiki tokens via inline styles */ } }
```

Shiki emits **inline `style` colors** on code tokens. Since web 1.7.0 the default sanitize pass
strips `style` — so a syntax-highlighted content site sets `trustedContent: true` on `fileSystemContent`
(author-controlled content), keeping those colors. `code.css` documents that the syntax colors
come from those inline styles.

## Font loading (self-hosted, subset, swap)

Fonts are **vendored** under `public/fonts/` (no font npm deps) and declared in `src/styles/*.css`
with root-relative URLs. The build leaves font `url()`s **external** (never base64-inlined into the
CSS bundle); `public/_headers` carries their immutable cache rule.

```css
@font-face {
  font-family: "IBM Plex Sans Variable";
  font-style: normal;
  font-display: swap;                 /* show fallback immediately, swap when loaded */
  font-weight: 100 700;               /* variable range */
  src: url(/fonts/ibm-plex-sans/…-cyrillic-ext-wght-normal.woff2) format("woff2-variations");
  unicode-range: U+0460-052F, U+1C80-1C8A, …;   /* subset per script → smaller files */
}
```

OG-render fonts are a **separate, build-time-only** set in `assets/fonts/og/` (woff, passed to
`build.ogImage.fonts`) — not the site's `public/fonts/` woff2.

## Conventions

- **Data-attribute styling, never classes** — `[data-island]`, `[data-variant]`, `[data-status]`,
  runtime state flags like `[data-entered]`/`[data-expanded]` (islands set `el.dataset.x`, never
  `classList`). This rule extends to island code and JSDoc `@example` blocks.
- **Responsive = scoped media queries** at reference breakpoints (≈900 / 600 / 375 / 320 px); no
  container queries in the reference.
- **Reduced motion** is a single `utilities`-layer rule disabling all transitions/animations — the
  layer's priority means no `!important`.
- **Gotchas the reference documents in-file** (keep when copying): use `margin-inline-end` (not flex
  `gap`) for a dot↔label pair (a real-Safari flex-gap quirk Playwright's WebKit doesn't reproduce);
  keep root scrolling instant (never `scroll-behavior: smooth` on `html` — it strands SPA
  scroll-to-top); `spa.viewTransitions: false` keeps a sticky header rock-solid (motion comes from a
  CSS/WAAPI animation on incoming content via the `page-fx` island, not a View Transition).

## Bundle targets
- CSS: < 10 KB gzipped · JS: < 8 KB gzipped per island bundle. (The framework's browser-bundle CI
  budget is 60 kB gzip; aim well under it.)
