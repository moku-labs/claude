<!--
  Deploy + CI reference for any @moku-labs/web app — Cloudflare Pages deploy, GitHub Actions
  (CI gates deploy), _headers, and the app-owned 404 requirement.
  Framework-level guidance, verified against @moku-labs/web@1.12.2.
  Pair with: project-spec.md (structure + rules), plugin-index.md (deploy/build/cli plugins).
-->

# @moku-labs/web — Deploy & CI

How any `@moku-labs/web` site ships: **Cloudflare Pages** as the target, the framework
`deploy`/`cli` plugins as the mechanism, and **two GitHub Actions workflows** (CI gates deploy).
Verified against `@moku-labs/web@1.12.2`. The build output is a static `dist/` (HTML + fingerprinted
assets + `_data/` JSON sidecars + `_headers` + `404.html`) — host-agnostic, but the built-in
`deploy` plugin targets Cloudflare Pages. For the surrounding project structure see
[project-spec.md](project-spec.md); for the `build`/`deploy`/`cli` plugin APIs see
[plugin-index.md](plugin-index.md). (Examples use the placeholder project name `my-site`.)

## 1. Target: Cloudflare Pages

```jsonc
// wrangler.jsonc — the entire deploy target config
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "my-site",                 // CF Pages project name (used by `pages deploy --project-name`)
  "pages_build_output_dir": "dist",    // the framework build's outDir
  "compatibility_date": "2024-01-01"
}
```

Composed in `src/app.ts`:

```ts
// pluginConfigs.deploy
deploy: { target: "cloudflare-pages", outDir: "dist", productionBranch: "main", ci: true }
```

`wrangler` is a `devDependency` (pinned). Cloudflare Pages auto-detects `dist/_headers` (caching
+ security), `dist/404.html` (custom 404), and the `_data/` sidecars — no extra config.

## 2. The deploy command (guided wizard + CI-safe path)

`scripts/deploy.ts` is a thin passthrough to the `cli` plugin:

```ts
// scripts/deploy.ts  (bun run deploy)
import { app } from "../src/app";
await app.cli.deploy({ guided: !process.argv.includes("--cli") });
```

- **`bun run deploy`** → the **guided wizard**: diagnoses prerequisites, offers to scaffold
  `wrangler.jsonc` + a placeholder `.env`, hard-gates on confirmation, runs a local test, deploys,
  and offers to scaffold the CI workflow. Best for first-time/local deploys.
- **`bun run deploy --cli`** → the direct, **CI-safe** path (no prompts).
- **`app.deploy.init({ ci: true })`** scaffolds `wrangler.jsonc` (+ optionally the GitHub Actions
  deploy workflow). The reference's `deploy.yml` was generated this way, then hand-edited to gate on CI.

The deploy reads Cloudflare credentials through the `env` core plugin, so wire the Node env
providers in `src/app.ts`:

```ts
// process.env first (CI secrets win), .env (gitignored) as the local fallback
// @ts-expect-error -- core-plugin config key intentionally absent from createApp's type; runtime-supported
env: { providers: [processEnv(), dotenv(".env")] }
```

**Secrets:** `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (GitHub repo secrets in CI; `.env`
locally). `.env*` is gitignored.

## 3. `public/_headers` (security + cache)

App-owned rules live in `public/_headers` and are **appended after** the framework's generated
cache rules (so app rules win). The framework's `build.cacheHeaders` (default ON) already emits a
per-bundle `immutable, max-age=1y` rule for every fingerprinted asset + a catch-all
`max-age=0, must-revalidate`; the app file adds security headers and any overrides:

```
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()

/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/_data/*
  Cache-Control: public, max-age=0, must-revalidate
```

A `security-headers` unit test asserts these stay present. (Keep `X-Frame-Options: DENY` aware of
any `::embed` iframes you host yourself — embeds load THIRD-party iframes into your page, which is
fine; DENY only stops OTHERS from framing you.)

## 4. The custom 404 (Cloudflare Pages requirement)

Cloudflare Pages needs a `dist/404.html` at the output root — **without it CF flips the project
into SPA mode** (serving `index.html` for every unknown path). The app owns the page:

```ts
// pluginConfigs.build
notFound: { path: "src/404.html" }   // verbatim, app-owned → emitted as dist/404.html
```

`src/404.html` is a complete standalone document (its own `<head>`) and carries only
`<!--moku:assets:css-->` (the page ships no JS). Bundle filenames are content-hashed, so it cannot
hardcode the stylesheet — the build substitutes that placeholder with the fingerprinted `<link>`.
`scripts/build.ts` (via `app.cli.build()`) asserts the 404 exists at the output root after a build.

## 5. CI workflow (`.github/workflows/ci.yml`)

Two jobs on `push`/`pull_request` to `main`. **Deploy is gated on this workflow succeeding.**

**`validate` job:** checkout → `setup-bun` (reads `.bun-version`) → `setup-node@24` → `bun install
--frozen-lockfile` → `bun run lint` → `bunx tsc --noEmit` → `bun run test:unit` →
(install/cache Playwright chromium-headless-shell) → `bun run test:integration`.

**`e2e` job:** checkout → bun + node 24 → install → install/cache chromium+webkit+firefox →
`bun run build` (real-corpus build guard) → `bunx playwright test` (functional + seo only;
visual specs excluded until linux baselines land).

Three non-obvious requirements baked into the reference CI — keep them when generating:

- **Pin Node 24 explicitly** (`actions/setup-node` `node-version: 24`) even though bun runs the
  app: `vitest` and the Playwright CLI run under Node (their bin shebang), and the framework's
  route compiler uses the `URLPattern` global, which only exists on Node 24+ (matching
  `engines.node`).
- **Install Playwright browsers before the build.** `mermaid-isomorphic` renders ` ```mermaid `
  fences through Chromium's headless shell **at build time**, so the integration tests + the build
  guard need the browser present. Cache it keyed by the resolved Playwright version:
  ```yaml
  - id: pw-version
    run: echo "v=$(bunx playwright --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')" >> "$GITHUB_OUTPUT"
  - id: pw-cache
    uses: actions/cache@<sha>  # v5.0.5
    with: { path: ~/.cache/ms-playwright, key: playwright-${{ runner.os }}-shell-${{ steps.pw-version.outputs.v }} }
  - if: steps.pw-cache.outputs.cache-hit != 'true'
    run: bunx playwright install --with-deps chromium-headless-shell
  - if: steps.pw-cache.outputs.cache-hit == 'true'
    run: bunx playwright install-deps chromium-headless-shell
  ```
- **SHA-pin every action** (not floating tags) for supply-chain hygiene, e.g.
  `actions/checkout@de0fac2…  # v6.0.2`.

## 6. Deploy workflow (`.github/workflows/deploy.yml`)

Runs **only after CI is green on `main`** via `workflow_run`, plus a manual `workflow_dispatch`
escape hatch:

```yaml
name: Deploy
on:
  workflow_run: { workflows: [CI], types: [completed], branches: [main] }
  workflow_dispatch:
permissions: { contents: read }
jobs:
  deploy:
    # workflow_run fires on ANY CI completion — only deploy when CI was green
    if: github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<sha>          # v6.0.2
        with: { ref: ${{ github.event.workflow_run.head_sha || github.sha }} }  # the exact commit CI validated
      - uses: oven-sh/setup-bun@<sha>
      - run: bun install --frozen-lockfile
      - run: bunx playwright install --with-deps chromium-headless-shell   # mermaid renders at build
      - run: bun run build
      - uses: cloudflare/wrangler-action@<sha>   # v4.0.0
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          wranglerVersion: "4.95.0"
          # `--branch main` is REQUIRED: the SHA-pinned checkout leaves a detached HEAD, so wrangler
          # would infer branch "head" and file the deploy as a PREVIEW instead of promoting production.
          command: pages deploy dist --project-name my-site --branch main
```

Two gotchas to carry forward:
- **Gate deploy on CI** via `workflow_run` + the `conclusion == 'success'` guard (the generated
  default was an ungated `push` that raced CI on the same event).
- **Pass `--branch main` explicitly** — the SHA-pinned checkout is a detached HEAD, so wrangler
  otherwise files a *preview* deployment instead of promoting production.

## 7. Local dev / preview loop

| command | script | what it does |
|---|---|---|
| `bun run dev` | `makeApp("development").cli.serve()` | build once → serve `dist` → watch `content/`+`src/` → debounced incremental rebuild + live reload. **`development` stage shows drafts.** |
| `bun run preview` | `app.cli.preview()` | serve the already-built `dist` with CF-Pages-style clean-URL + nearest-404 resolution (no watch). This is also the Playwright `webServer` shape. |
| `bun run build` | `app.cli.build()` | full SSG build → `dist/` (asserts `404.html` at root). |
| `bun run deploy` | `app.cli.deploy({ guided })` | guided wizard (or `--cli` for the direct path). |

Stage matters: the dev loop uses `makeApp("development")` (drafts visible); every other entry uses
the exported production `app` (`stage: "production"`, drafts hidden). Port honors `PORT` (default
4173, the Playwright `webServer` port).

## 8. Deploy checklist (generating a new app)

1. `wrangler.jsonc` with the CF Pages project `name` + `pages_build_output_dir: "dist"` (or run
   `app.cli.deploy()` once to scaffold it).
2. `pluginConfigs.deploy: { target: "cloudflare-pages", outDir: "dist", productionBranch: "main", ci: true }`.
3. `pluginConfigs.build.notFound: { path: "src/404.html" }` + an app-owned `src/404.html`.
4. `public/_headers` for security headers (cache rules come from `build.cacheHeaders`, default ON).
5. `env: { providers: [processEnv(), dotenv(".env")] }`; set `CLOUDFLARE_API_TOKEN` +
   `CLOUDFLARE_ACCOUNT_ID` (repo secrets in CI, `.env` locally).
6. CI (`ci.yml`): lint → `tsc --noEmit` → unit → integration → build → e2e; pin Node 24; install
   Playwright browsers before the build (mermaid); SHA-pin actions.
7. Deploy (`deploy.yml`): gate on CI via `workflow_run` + success guard; checkout the validated
   SHA; `pages deploy dist --project-name <name> --branch main`.
