# App Build — Detailed Steps

## Step 1: Read and validate the plan

Read the spec (default `.planning/app-spec.md`). It needs a framework reference, the ordered plugin
composition, global and per-plugin configuration, any custom plugin specs, and the entry point
structure. If it is incomplete, ask the user to run `/moku:plan app` first.

Build to the idiomatic app shape in
`${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/moku-idioms.md`: multiple `createApp` instances
(build / browser / worker), two frameworks side by side for a full-stack app (`@moku-labs/web` +
`@moku-labs/worker`), folders split by concern, a thin `cloudflare/worker.ts` entry, business logic in
plugins. The `tracker` app in `github.com/moku-labs/demos` is a public worked example — consult it only
if a concrete reference helps, and never assume it is checked out locally. Study a reference for what
idiomatic looks like and re-implement to this project's conventions; never copy a prototype's source.

## Step 2: Framework-capability verification

Before finalizing any composition or deploy decision, prove every framework capability the plan relies
on exists in the **installed** package. A wrong assumption here forces a multi-wave rework: a real plan
assumed a framework's server export shipped a `wrangler.jsonc` generator, and it did not.

For each named capability — an exported `createApp`/`createPlugin`, a specific plugin (`hubPlugin`,
`deployPlugin`), a generator, a CLI (`server.cli.dev`/`deploy`), a re-export, a `./subpath` export:

1. Read `node_modules/<pkg>/package.json` and confirm the `exports` map has the subpath you intend to
   import, with a `types` condition if you will import types from it.
2. Read the `dist`/types entry that export points at and confirm the named export exists with the shape
   the plan assumes.
3. If it is absent, stop and revise the plan to the real shape. Do not hand-roll the missing capability
   and do not invent a facade app to paper over it (I6). Reach for the framework that genuinely ships
   it (for example compose `@moku-labs/worker` for `deploy`/`cli`), or raise a framework-extension need.

Record each assumed capability and the file:line that confirms it in the build notes.

## Step 3: Build custom plugins

Layer-3 apps author their own plugins for plugin-shaped concerns: a typed `app.<x>.method()` API,
custom events, lifecycle, shared state, or a dependency on another plugin. Build each in
`src/plugins/{name}/` per **`build-plugin.md`**, importing `createPlugin` from the framework package,
never from `@moku-labs/core`. Tiers, JSDoc, unit and integration tests are the same as framework plugins.

With several custom plugins, group them into waves the same way a framework build does.

### An app with no custom plugins still builds through builders

Many Layer-3 apps have no plugin of their own: pages, components, islands and `lib/` on top of a framework.
The work is still handed out. The unit of work is one page or one island with the components, styles, `lib/`
modules and tests the spec lists for it. Shared pieces (tokens, layout, header, footer, route table) are the
skeleton: build them first, yourself or as one unit, then fan the remaining units out.

- One `moku:moku-builder` per unit, with the unit's section of the spec, its files and the test-first protocol.
  Units write disjoint files, so they run in parallel up to the parallel-agent limit. Use `moku-builder-deep`
  for a unit with real state or timing logic, and to retry a unit whose first attempt failed.
- After the wave, one `moku:moku-code-reviewer` over the wave's diff.
- The orchestrating session plans, dispatches, reconciles and verifies. It does not write the units itself:
  a session that builds everything alone skips the test-first protocol and the review, and costs several times
  more than the builders it replaced.

The same holds for a later pass inside the same change (a delta spec after `moku-rails scope`): new pages,
islands and features are units for builders, not edits the orchestrator makes in place.

Not every concern is a plugin: pure build-time data access belongs in `lib/`, client-only DOM behavior
belongs in an island. `consumer-plugins.md` has the plugin-vs-lib-vs-island decision guide and the
Layer-3 wiring rules (no `src/config.ts`; compose via `createApp({ plugins: [...] })`; the
`src/plugins/index.ts` barrel is optional at Layer 3).

## Step 4: Create the entry point

Write `src/main.ts` (or the entry the spec names):

```typescript
import { createApp, createPlugin } from 'framework-name';
import { customPlugin } from './plugins/custom';

const app = createApp({
  plugins: [customPlugin],
  config: { /* global overrides from the spec */ },
  pluginConfigs: { /* per-plugin config from the spec */ },
  onReady: (ctx) => { /* setup from the spec */ },
});

await app.start();
```

### Server and worker composition

For any worker backend, build to the one-worker idiom (`moku-idioms.md` §I6; worked reference
`tracker/src/server.ts`) rather than inventing a composition:

- **One** `@moku-labs/worker` `createApp` whose `plugins:[]` composes the resource plugins the deploy
  plugin needs (`storage`/`kv`/`d1`/`queues`/`durableObjects`), the app's runtime plugin (its own
  `createPlugin`, or a framework runtime plugin such as `@moku-labs/room`'s `hubPlugin`), plus `deploy`
  and `cli`. `server.<runtime>.handle` is the fetch the thin `cloudflare/worker.ts` delegates to;
  `server.cli.{dev,deploy}` generates `wrangler.jsonc` and runs wrangler.
- Configure only the resource plugins you use; the rest sit at `{}` and emit no bindings.

Two things are forbidden by §I6: a second app for the same worker (a runtime `createApp` plus a
separate one whose only job is generating `wrangler.jsonc`), and a facade app or plugin that exists only
to emit config. If the runtime framework does not itself ship a generator or CLI (verified in Step 2),
that is precisely why `@moku-labs/worker`'s `deploy` and `cli` go into the one app.

## Step 5: Validate

**Group A (parallel):**
- `moku-structure-validator` — spec compliance, plugin structure and tier, root and entrypoint idioms
  I1–I6, `@moku-labs/common` usage
- `moku-style-validator` — JSDoc and readable-code style

**Group B (parallel):**
- `moku-quality-validator` — `tsc`, tests and lint as facts, then test quality
- `moku-web-validator` (web apps) — `components/`, `islands/`, `styles/`, `index.html`

Findings from these Sonnet validators go through `moku-skeptic` before they count. Blockers enter gap
closure; warnings go into the report.

## Step 5.5: Reference-app structural conformance

"Follow the reference app" is a gate, not advice. Compare the built output axis by axis against the
nearest reference — `tracker` for full-stack, `blog` for web-only — and fail on a confirmed divergence.
Group A and B produce these findings; this step is where they block.

| Axis | Idiomatic target | Owner |
|------|------------------|-------|
| App / worker composition | one `createApp` per runtime; the one-worker pattern; no facade app | structure I2/I6 |
| `components/` layout | flat `Foo.tsx` + `Foo.css`, no folder per component | web §10 |
| `islands/` | small, flat or module-split, own zero `.css`, one per screen concern | web §11 |
| `lib/` | pure shared helpers and the realtime seam only — stateful/lifecycle/event code is a plugin | structure |
| `scripts/` | build/dev/deploy(+preview) passthroughs only | structure §E |
| per-plugin layout | no `config.ts`; config inline in `index.ts` | structure §17 |
| config placement | a directly visible `createApp({...})` literal; `config.ts` holds constants | structure §D |
| fonts/assets | vendored under `public/fonts/` with local `@font-face`, no CDN `<link>` | web §12 |
| route/role selection | island `ctx.params`, no hand-parsed `location.pathname` | web §13 |
| runtime app data | the web data/content mechanism, not `public/` | web §14 |

Each confirmed departure is a blocker and routes to gap closure, except the two web warnings (island
sizing/count, `public/` data). This gate catches idiom violations every other validator passes. Full
protocol and fix recipes: `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/structural-conformance.md`.

## Step 6: Full-app integration tests

After validation, write root-level tests that exercise the assembled app the way it will run — real
task scenarios, not isolated unit checks. Follow `build-final.md` Step 5.8 (scenario planning → writing
→ execution) but scope the scenarios to this app's journeys: boot via `createApp`, drive the real plugin
stack through flows a user would perform (load a route → render → navigate → handle an event end to
end), no mocks. Tests go to `tests/integration/`. Run `bun run test`; failures route to gap closure
(max 2 rounds).

## Step 7: Runtime smoke test — boot the real artifact

Static validation and integration tests run against mocked bindings. They prove the code is internally
consistent, not that the app boots. An app can pass every test and still fail on first run: an
unmigrated local DB, a missing env var, bad entry wiring, an unseeded store. Do not report an app as
ready, or show it to the user, without running the command the README tells them to run.

Mandatory for anything with a run command (HTTP server, Worker, CLI, web dev server). Skip only for a
pure library, and say so in the report.

1. **Find the documented command.** Read `package.json` scripts and the README quickstart. The first
   command a fresh user runs is the contract — usually `bun run dev`, else `start`.
2. **Run it from a clean state.** Everything a fresh clone needs (schema, migrations, seed data,
   generated files) belongs inside the run command, not in a side instruction the user can miss. Remove
   local ephemeral state first (for a Cloudflare app, `.wrangler/state`). If the app only works after a
   manual step, that manual step is a bug: fold it into the run script and re-test.
3. **Boot and assert the primary surface responds.** Worker or HTTP server: start the dev server in the
   background, wait for connections, hit the primary routes, assert success — a 500 on the first real
   request fails the gate no matter how green the tests are. Stop the server afterwards. Web SPA: assert
   the root document serves 200. CLI: invoke the built binary with `--help` or a no-op subcommand and
   assert exit 0.
4. **Cloudflare bindings are the mocked-test blind spot.** Integration tests use fake bindings, so a
   missing local D1 migration is invisible to them and fatal at runtime (`no such table` → 500). For any
   app with a `d1_databases` binding and a `migrations/` directory, `dev` applies migrations first:
   ```jsonc
   "migrate:local": "wrangler d1 migrations apply <db-name> --local",
   "dev": "bun run build && bun run migrate:local && wrangler dev"
   ```
   The smoke test must hit a route that reads from D1 to prove the schema is there. Same reasoning for
   KV/R2 seeds and queue consumers.
5. **On failure**, fix the run script, wiring or setup through gap closure, then re-run this gate. Do
   not proceed until the documented command boots and serves cleanly from a clean state.

Record the command, the surface checked and the status in the Step 10 report.

## Step 7.5: End-to-end gate (web apps)

The smoke test proves the app boots; this proves it works — every screen, feature and control, in a
real browser on desktop and mobile, with visual baselines, console and server errors captured, and a
UX and responsiveness review.

That gate lives in the `moku-web` pack. If the `moku-web:e2e` skill is available, invoke it with the
Skill tool — it is the `e2e` station, normally driven by the conductor. If the pack is not installed,
say so plainly and continue: the station is unavailable, not silently skipped.

No web surface (no `@moku-labs/web` client, no full-stack worker-backed app, no `@moku-labs/room` app)
means there is nothing to test — note it in one line and move on.

Never present a finished web app as working on the strength of unit and integration tests alone.

## Step 8: README

Generate or update the root `README.md` (and any per-custom-plugin READMEs) now that the app exists.
Follow `build-final.md` Step 5.6 scoped to an app: what it is, how to run it, its plugin composition and
config, the entry point, deployment notes. House style comes from the **`moku-readme` skill**,
consumer-app shape (§2 / `references/template.md` app deltas): the quick start shows the exact command
Step 7's smoke test ran, and apps carry no npm badge. On a rebuild, refresh the changed sections instead
of overwriting hand-written prose. Then `bun run format`.

## Step 9: Deployment

Apps ship by deployment rather than npm publish. Present the options with examples via
`AskUserQuestion` — Cloudflare Pages or Workers, Vercel, Netlify, GitHub Pages, a container image — plus
whether to add PR-validation CI, and let the user pick. Recommend a deploy target for app projects.
Generate only the selected workflows, name the repo secrets the user must add, and check the YAML
parses. Pre-selected choices may already sit in `.planning/steering.md` `## CI/CD`; confirm them rather
than assuming. Run `moku-rails pause` before asking.

Package publishing is a different station — the `moku:moku-release` skill.

## Step 10: Report

Cover: custom plugins created, entry point structure, validation results, integration test count and
coverage, the runtime smoke test (the command, the surface, the status — state plainly that the app was
booted and served, or that the gate was skipped for a pure library), whether the e2e gate ran and what
it found, README and deployment output, and issues found and fixed. Then update `.planning/STATE.md`.

## App quality bar

- JSDoc on every custom source file, `@example` placement per `jsdoc-examples.md`; `import type` for type-only imports.
- Import from the framework package, never `@moku-labs/core`.
- Tests pass; Biome and ESLint pass.
- The documented run command boots from a clean state and serves its primary surface (Step 7).
  Passing tests never clear this bar.
- Custom plugins meet the same standard as framework plugins.

## Design context is a spec, not source

When the app spec or a screen spec references a design context (`.planning/design/*/design-context.md`)
or carries a "re-implement from the design context" note, the design's prototype is demo-only: its
HTML/CSS/JS communicates look, feel, behavior and the screen inventory, nothing more.

Re-implement every screen and component from scratch on the real stack, honouring the moku-web
conventions (island architecture, `@scope`/`@layer` CSS, `data-*` attributes and never class selectors,
the token system, one route table, a node-free client bundle — R1–R7) and readable-code style. Pass this
instruction into every builder's prompt. Do not copy or port the prototype's CSS, JS, DOM, class names
or bugs, and do not use it as a scaffold. The design context says what to build; the `moku-web` skill
says how.

## Web applications

A web app additionally follows the **`moku-web`** skill: Preact components with `data-*` attributes and
no CSS classes in markup, CSS with `@scope` and `@layer`, island architecture for interactivity, the
two-layer token system, and the bundle targets (JS under 8KB, CSS under 10KB gzipped).
