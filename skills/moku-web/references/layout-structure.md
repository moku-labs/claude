# Layout Structure Reference

## Master Layout: SiteLayout

The SiteLayout wraps all pages. Receives locale, assets, page data, SEO, navigation state.

```typescript
interface SiteLayoutProps {
  locale: Locale;
  cssPath: string;
  jsPath: string;
  pageData: PageData;
  seoNodes: VNode[];
  quote: string;
  activeTab: string;
  children: VNode;
}

export function SiteLayout(props: SiteLayoutProps) {
  return (
    <PageShell locale={props.locale} css={props.cssPath} js={props.jsPath} seo={props.seoNodes}>
      <header data-sticky>
        <TopBar quote={props.quote} />
        <TabNav activeTab={props.activeTab} locale={props.locale} />
      </header>
      {props.children}
      <Footer locale={props.locale} />
    </PageShell>
  );
}
```

Structure:
```
<PageShell>           (HTML wrapper, <head>, meta)
  <header data-sticky>
    <TopBar>          (IDE window chrome with quote)
    <TabNav>          (navigation tabs + language switcher)
  </header>
  {children}          (page content)
  <Footer>
</PageShell>
```

## Page Pattern

Pages are pure components that receive loaded data:

```typescript
interface HomePageProps {
  articles: Article[];
  locale: Locale;
  totalPages: number;
}

export function HomePage({ articles, locale, totalPages }: HomePageProps) {
  return (
    <section id="home">
      <header data-hero>
        <h1>Welcome</h1>
      </header>
      <StatusBar />
      <DashboardGrid articles={articles} locale={locale} />
    </section>
  );
}
```

## Route Definitions

Routes chain load → render → head → meta → layout:

```typescript
export const homeRoute = route('/{lang:?}/')
  .load(async (params, locale) => loadPaginated(locale, 1))
  .render((ctx) => HomePage({
    articles: ctx.data.articles,
    locale: ctx.locale,
    totalPages: ctx.data.totalPages,
  }))
  .generate((locale) => [{ lang: locale }])
  .head((ctx) => buildPageHead({
    title: ctx.data.title,
    description: ctx.data.description,
  }))
  .meta({ activeTab: 'home' })
  .layout(SiteLayout);
```

## App Entry Point (main.ts)

```typescript
import { createApp } from 'moku';

const app = createApp({
  mode: 'hybrid',
  site: {
    name: 'Site Name',
    url: 'https://example.com',
    author: 'Author',
    description: 'Description',
  },
  contentDir: './content/articles',
  i18n: {
    locales: ['en', 'ru'],
    defaultLocale: 'en',
    translations: { en: enTranslations, ru: ruTranslations },
  },
  routes: {
    home: homeRoute,
    archive: archiveRoute,
    article: articleRoute,
  },
  components: [ShareButtons],  // Global islands
  spa: {
    viewTransitions: true,
    progressBar: true,
  },
});

export default app;
```

## Dependencies

```json
{
  "dependencies": {
    "preact": "^10.28.3",
    "preact-render-to-string": "^6.6.5",
    "@fontsource-variable/fira-code": "^5.2.7",
    "@fontsource-variable/ibm-plex-sans": "^5.2.8"
  },
  "devDependencies": {
    "vite": "^7.3.1",
    "vite-plugin-bundlesize": "^0.3.0",
    "typescript": "^5.9.3",
    "postcss-preset-env": "^11.1.3",
    "@playwright/test": "^1.58.2",
    "eslint": "^9.0.0",
    "@evilmartians/lefthook": "^2.1.0"
  }
}
```

## TypeScript Config for Web Projects

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "noUncheckedIndexedAccess": true,
    "allowImportingTsExtensions": true
  }
}
```

## Vite Config

```typescript
import { defineConfig } from 'vite';
import bundlesize from 'vite-plugin-bundlesize';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    sourcemap: 'hidden',
    manifest: true,
  },
  plugins: [
    bundlesize({
      limits: [
        { name: '**/*.css', limit: '10 kB', mode: 'gzip' },
        { name: '**/*.js', limit: '8 kB', mode: 'gzip' },
      ],
    }),
  ],
});
```
