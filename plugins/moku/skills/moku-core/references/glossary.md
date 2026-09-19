# Moku Glossary, ESLint allowList & spell-check dictionary

Shared vocabulary so agents and tools don't "correct" valid domain terms, and so a build never has to
expand abbreviation/dictionary lists mid-flight (a real build had to). There are **two distinct lists**
for two different tools — ship BOTH pre-populated (see `tooling-config.md`, scaffolded by `/moku:init`):

1. **ESLint `unicorn/prevent-abbreviations` `allowList`** — governs **code identifiers**. This is the
   one that actually blocks builds.
2. **cspell / editor dictionary `words`** — governs **prose** in comments, docs, and Markdown.

## 1. ESLint `unicorn/prevent-abbreviations` allowList (code identifiers)

Ship pre-expanded in the default `eslint.config.ts`:

```js
// unicorn/prevent-abbreviations options
{
  allowList: {
    ctx: true, fn: true, cb: true, ref: true, args: true, params: true, props: true,
    env: true, i18n: true, l10n: true, spa: true, ssg: true, ssr: true, seo: true,
    api: true, dev: true, prod: true, md: true, dir: true, doc: true, docs: true,
    db: true, util: true, utils: true, pkg: true, src: true, dist: true, config: true,
    cfg: true, e2e: true, cli: true, dom: true, css: true, html: true, url: true, uri: true,
    str: true, num: true, msg: true, err: true, req: true, res: true, opts: true, attr: true
  }
}
```

Use a scoped `eslint-disable` only for canonical spec **type names** that are abbreviations
(e.g. `EnvVarSpec`, `IslandDef`) — do NOT put PascalCase type names in the allowList.

## 2. cspell / dictionary `words` (prose in comments, docs, Markdown)

Add as `cspell.json` `words` (flatten the groups below into one array).

**Moku framework:** Moku, createCoreConfig, createCore, createApp, createPlugin, createState,
corePlugin, createCorePlugin, pluginConfigs, onInit, onStart, onStop, ctx, micro-kernel, microkernel,
three-layer, factory-chain, wiring-harness, register-callback, Nano, Micro, VeryComplex, manifest, emit.

**Build / tooling:** bun, bunx, tsdown, rolldown, vite, vitest, biome, eslint, publint, lefthook, tsc,
noEmit, monorepo, devDependency, peerDependency, frontmatter, gitignore, worktree, argv, stdout,
stderr, cwd, dotenv, cspell.

**Web / SSG / SPA:** SSG, SPA, SSR, SEO, OG, HMR, DOM, RSS, Atom, GUID, UUID, URI, slug, kebab-case,
hreflang, canonical, sitemap, favicon, viewport, preact, JSX, VNode, island, hydration, livereload,
data-attribute, design-token.

**Content pipeline:** remark, rehype, unified, shiki, satori, resvg, gray-matter, reading-time, GFM,
markdown, sanitize, rehype-sanitize, rehype-raw, hast, mdast, XSS.

**Deploy / infra / security:** Cloudflare, wrangler, Pages, JWT, SHA, SHA-pinned, entropy, Shannon,
NFKD, scrub, scrubbedStderr, allowlist, preflight, path-traversal, flag-injection, subprocess, spawn,
CI, CD, CI/CD, GitHub Actions, YAML, outDir.

**Diagnostics / testing vocabulary:** EISDIR, ANTIPATTERN, antipatterns, expectTypeOf, happy-dom,
p-limit, afplay, paplay, osascript.

**Project-specific:** @moku-labs/web, @moku-labs/core, i18n, l10n, locale, feed.

> **Maintenance rule (part of "done"):** when a build introduces a new dependency or domain term,
> append it here AND to the project's `cspell.json` / ESLint allowList. This kills the recurring
> spell-check / abbreviation friction.
