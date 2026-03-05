# Plugin Patterns Reference

## Plugin = Connection Point

The plugin file is the **map**. The domain files are the **territory.** An LLM reads the map (fast, ~30 lines) and navigates to the right domain file (precise, targeted).

If all code is in the plugin file, the LLM must read everything to find where to change. With the connection point pattern, the LLM reads the index, identifies the relevant domain file, and edits only that file.

## Three-Layer Complete Example

### Layer 2: Framework config.ts (Step 1)
```typescript
import { createCoreConfig } from '@moku-labs/core';

type Config = {
  siteName: string;
  description?: string;
  mode: 'development' | 'production';
};

type Events = {
  'page:render':     { path: string; html: string };
  'page:error':      { path: string; error: Error };
  'router:navigate': { from: string; to: string };
};

export const coreConfig = createCoreConfig<Config, Events>('moku-site', {
  config: { siteName: 'Untitled', mode: 'development' },
});
export const { createPlugin, createCore } = coreConfig;
```

### Layer 2: Framework plugin
```typescript
// plugins/router/index.ts
import { createPlugin } from '../../config';

export const routerPlugin = createPlugin('router', {
  config: { basePath: '/' },
  createState: () => ({ currentPath: '/' }),
  api: (ctx) => ({
    navigate: (path: string) => {
      ctx.state.currentPath = path;
      void ctx.emit('router:navigate', { from: '/', to: path });
    },
    current: () => ctx.state.currentPath,
  }),
});
```

### Layer 2: Framework index.ts (Step 2)
```typescript
import { createCore, coreConfig } from './config';
import { routerPlugin } from './plugins/router';
import { rendererPlugin } from './plugins/renderer';

const framework = createCore(coreConfig, {
  plugins: [routerPlugin, rendererPlugin],
});
export const { createApp, createPlugin } = framework;
```

### Layer 3: Consumer
```typescript
import { createApp, createPlugin } from 'my-framework';

const blogPlugin = createPlugin('blog', {
  config: { postsPerPage: 10 },
  api: (ctx) => ({ listPosts: () => ['post1', 'post2'] }),
});

const app = createApp({
  plugins: [blogPlugin],
  config: { siteName: 'My Blog', mode: 'production' },
  pluginConfigs: { blog: { postsPerPage: 5 } },
});

await app.start();
app.router.navigate('/about');  // typed — framework default
app.blog.listPosts();           // typed — consumer plugin
await app.stop();
```

### Layer 3: Custom Plugin
```typescript
// plugins/contact-form/index.ts
import { createPlugin } from 'my-framework';
import { createContactFormApi } from './api';

export const contactFormPlugin = createPlugin('contactForm', {
  depends: [rendererPlugin],
  api: createContactFormApi,
  hooks: (ctx) => ({
    'page:render': (payload) => { /* framework typed */ },
  }),
});
```

## Key Rules

1. **Never import from @moku-labs/core in consumer code.** Only import from the framework.
2. **Never put > 50 lines of logic in plugin index.ts.** Domain code in separate files.
3. **Never create new abstractions** (services, providers, managers). Use `createPlugin`.
4. **Plugin index.ts is a CONNECTION POINT.** Imports + wiring only.
5. **`createApp()` is synchronous.** Do not `await` it; use `start()` only if the app has a distinct runtime phase.
6. **Use `ctx.require(pluginInstance)` for dependencies.** Not strings.
7. **Use `ctx.has('name')` for optional deps.** Boolean check, never throws.
