# App Build — Detailed Steps

## Step 1: Read and Validate the Plan

Read the specification from the provided path (defaults to `.planning/app-spec.md`). Verify it contains:
- Framework reference
- Plugin composition (ordered list)
- Configuration (global + per-plugin)
- Custom plugin specs (if any)
- Entry point structure

If the plan is incomplete, ask the user to run `/moku:plan app` first.

**Build to the idiomatic app shape** in `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/moku-idioms.md`:
multiple `createApp` instances (build / browser / worker), two frameworks side-by-side where the app is
full-stack (`@moku-labs/web` + `@moku-labs/worker`), folder split by concern, a thin `cloudflare/worker.ts`
entry, and business logic in plugins. A public worked example of this shape is the **`tracker`** app in the
public repo **`github.com/moku-labs/demos`** — consult it only if a concrete reference helps (it's
illustrative, never required, and never assume it's checked out locally). **Spec, not source:** study a
reference for *what idiomatic looks like* and re-implement to the project's conventions — never copy a demo
prototype's source.

## Step 2: Framework-Capability Verification (hard gate — verify, never assume)

Before finalizing **any** composition or deploy decision, confirm every framework capability the plan
relies on **actually exists in the installed package** — by reading its real `package.json` `exports` +
its `dist`/types, not from memory or a spec doc. This is a hard gate: a wrong assumption here forces a
multi-iteration rework downstream.

**Why this exists:** never assume a framework's runtime/server export ships a deploy-config generator (e.g.
a `wrangler.jsonc` emitter) or CLI — verify it against the installed package's `exports` + `dist`/types. A
single unverified capability assumption can force a reversal and a multi-wave rework downstream. **Never
assume a framework capability from memory or a spec doc.**

For each capability the plan names — an exported `createApp`/`createPlugin`, a specific plugin
(`hubPlugin`, `deployPlugin`, …), a generator (`wrangler.jsonc` emitter, an SSG builder), a CLI
(`server.cli.dev`/`deploy`), a re-export, or a `./subpath` export — **prove it exists:**

1. Read the installed package's `package.json` (`node_modules/<pkg>/package.json`): confirm the `exports`
   map actually has the subpath you intend to import (`"./server"`, `"./browser"`, …) **and** that it
   declares a `types` condition if you'll import types from it.
2. Read the resolved `dist`/types entry the export points at: confirm the named export (plugin, factory,
   generator, CLI method) is actually present and has the shape the plan assumes (e.g. a `deploy`/`cli`
   plugin that generates `wrangler.jsonc`; a runtime plugin with a `handle`).
3. If a capability is **absent**, STOP and revise the plan to the real shape — do **not** hand-roll the
   missing capability (a hand-rolled `wrangler.jsonc` generator was rejected) and do **not** invent a
   facade app to paper over it (I6). Reach for the framework that genuinely ships it (e.g. compose
   `@moku-labs/worker` for `deploy`/`cli`), or raise a framework-extension need.

Record, in the build notes, each assumed capability and the file:line that confirms it. Only then proceed.

## Step 3: Build Custom Plugins

Layer-3 consumer apps author their own plugins for plugin-shaped concerns (a typed `app.<x>.method()` API, custom events, lifecycle, shared state, or a dependency on another plugin). If the plan includes custom plugins, build each one in `src/plugins/{name}/` following the **Plugin Build** process (see `build-plugin.md` reference), importing `createPlugin` from the **framework package** (never `@moku-labs/core`).

Each plugin must follow the moku-plugin skill's complexity tiers. Full JSDoc, unit tests, integration tests.

For multiple custom plugins, use wave analysis (same as framework build) to identify parallel opportunities.

Not every consumer concern is a plugin — pure build-time data access belongs in `lib/`, and client-only DOM behavior belongs in an island (web). See the `consumer-plugins.md` reference for the plugin-vs-`lib`-vs-island decision guide and the Layer-3 wiring rules (no `src/config.ts`; compose via `createApp({ plugins: [...] })`; the `src/plugins/index.ts` barrel is optional at Layer 3).

## Step 4: Create Entry Point

Write `src/main.ts` (or the specified entry file):

```typescript
import { createApp, createPlugin } from 'framework-name';
// Import optional/consumer plugins
import { customPlugin } from './plugins/custom';

const app = createApp({
  plugins: [customPlugin],
  config: {
    // Global config overrides from spec
  },
  pluginConfigs: {
    // Per-plugin configs from spec
  },
  onReady: (ctx) => {
    // Setup code from spec
  },
});

await app.start();

// Application logic from spec
```

### Server / worker composition — START from the one-worker (tracker) pattern

For any worker backend, do **not** invent the composition — build to the **one-worker composition idiom**
(`${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/moku-idioms.md` §I6; worked reference `tracker/src/server.ts`):

- **ONE** `@moku-labs/worker` `createApp`, whose `plugins:[]` composes, together: the **resource plugins**
  the deploy plugin requires (`storage`/`kv`/`d1`/`queues`/`durableObjects`), **+ the app's runtime
  plugin** (its own `createPlugin`, or a framework runtime/hub plugin like `@moku-labs/room`'s `hubPlugin`),
  **+ `deploy` + `cli`**. `server.<runtime>.handle` is the runtime fetch (the thin `cloudflare/worker.ts`
  delegates to it); `server.cli.{dev,deploy}` generate `wrangler.jsonc` + run wrangler.
- Configure only the resource plugins you actually use; the rest sit at their empty `{}` default and emit
  no bindings.

**Forbidden (`moku-idioms.md §I6`):**
- a **second** app for the same worker (e.g. a runtime `createApp` plus a separate `createApp` whose only
  job is to generate `wrangler.jsonc`), and
- a **facade** app/plugin that exists only to emit config.

If the runtime framework you're composing does not itself ship a `wrangler.jsonc` generator / CLI (verified
in Step 2), that is exactly why `@moku-labs/worker`'s `deploy`+`cli` go INTO the one app — never hand-roll a
generator and never stand up a config-only facade.

## Step 5: Validate

Run the post-build validation pipeline:

**Parallel Group A:**
- **moku-spec-validator** agent on all source files
- **moku-plugin-spec-validator** agent on custom plugins (flags per-plugin `config.ts`, §17)
- **moku-jsdoc-validator** agent on all source files
- **moku-readable-code-validator** agent on all source files (readability; WARNING/INFO only — never blocks)

**Parallel Group B:**
- **moku-test-validator** agent on custom plugin tests
- **moku-type-validator** agent (once, whole project)

**Parallel Group C — structural conformance (hard gate, see Step 5.5):**
- **moku-root-validator** agent on the root/entrypoint files (I1–I6: app composition, the one-worker
  pattern + facade detection, lib-vs-plugin boundary, non-triad `scripts/`, config-in-place)
- **moku-web-validator** agent (web apps only) on `components/`/`islands/`/`styles/`/`index.html`
  (flat components, island CSS, vendored fonts, `ctx.params` routing, runtime data placement)

If BLOCKER issues found, enter gap closure. WARNINGs included in report.

## Step 5.5: Reference-App Structural-Conformance Gate (hard gate — FAIL on divergence)

"Follow the reference app" is **not** advisory here — it is an enforced gate. Compare the built output, axis
by axis, against the **nearest reference app** — `tracker` for a full-stack app, `blog` for a
web/content-only app — and FAIL the build on any confirmed divergence (Group C's validators produce these
findings; this step is where they BLOCK rather than merely inform). The axes and where each is owned:

| Axis | Idiomatic target | Owner check |
|------|------------------|-------------|
| App / worker composition | one `createApp` per runtime; the one-worker pattern; no facade app | root-validator I2/I6 |
| `components/` layout | flat `Foo.tsx`+`Foo.css` — no folder-per-component | web-validator §10 |
| `islands/` | small, flat or module-split; own **zero** `.css`; one per screen concern | web-validator §11 |
| `lib/` | pure/shared helpers + realtime seam only — stateful/lifecycle/event code is a plugin | root-validator (lib-vs-plugin) |
| `scripts/` | build/dev/deploy(+preview) triad only — passthroughs | root-validator §E |
| per-plugin layout | no `config.ts`; config inline in `index.ts` | plugin-spec-validator §17 |
| config placement | a directly-visible `createApp({...})` literal; `config.ts` = constants | root-validator §D |
| fonts/assets | vendored under `public/fonts/` + local `@font-face` — no CDN `<link>` | web-validator §12 |
| route/role selection | island `ctx.params` — no hand-parsed `location.pathname` | web-validator §13 |
| runtime app data | the web data/content mechanism — not `public/` | web-validator §14 |

Each confirmed departure is a **BLOCKER** (except the two web-validator WARNING axes — island sizing/count
and `public/` data) and routes to gap closure. This single gate catches idiom violations that all other
validators pass. Full protocol + fix recipes: `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/structural-conformance.md`.

## Step 6: Full-app integration tests (realistic end-to-end)

After validation passes, generate root-level integration tests that exercise the assembled app the
way it will actually run — **realistic real-world task scenarios**, not isolated unit checks. Reuse
the framework integration-test machinery: follow `build-final.md` Step 5.8 (Scenario Planning → Test
Writing → Test Execution), but scope scenarios to THIS app's user journeys: boot the app via
`createApp`, drive the real plugin stack through the flows a user/consumer would actually perform
(e.g. for a web app: load a route → render → navigate → handle an event end-to-end), no mocks.
Tests go to `tests/integration/`. Run `bun run test`; route failures to gap closure (max 2 rounds).

## Step 7: Runtime smoke test — boot the real artifact (delivery gate)

Static validation (Step 5) and integration tests (Step 6) run against **mocked / fake bindings** — they
prove the code is internally consistent, not that the app actually boots. An app can pass every test and
still fail on first run: an unmigrated local DB, a missing env var, bad entry wiring, an unseeded store.
**Never report an app as ready, or show it to the user, without running the exact command the README
tells them to run.** This is a hard delivery gate, not an optional check.

Mandatory for any app that produces a runnable artifact (HTTP server, Cloudflare Worker, CLI, web dev
server). Skip only for a pure library with no run command (say so explicitly in the report).

1. **Find the documented run command.** Read `package.json` scripts and the README quickstart. The first
   command a fresh user runs is the contract — usually `bun run dev` (fallback `start`).

2. **Run it from a clean state.** Everything a fresh clone needs to run (DB schema, migrations, seed data,
   generated files) must live *inside* the run command — never as a side instruction the user can miss. To
   prove that, run the smoke test from a clean state (remove local/ephemeral resource state first — e.g. a
   Cloudflare app's `.wrangler/state`). If the app only works after a manual step, that manual step is a
   bug: fold it into the run script (or a script it chains) and re-test.

3. **Boot and assert the primary surface responds** (adapt to app type):
   - **Worker / HTTP server:** start the dev server in the background, wait until it accepts connections,
     hit its primary route(s), and assert a success status — **not** a 5xx. A 500 on the first real
     request is a failed gate even if every unit test passed. Stop the server afterward.
   - **Web SPA (no API):** start the dev server and assert the root document serves `200`.
   - **CLI:** invoke the built binary with a smoke command (`--help`, `--version`, or a no-op subcommand)
     and assert exit 0.

4. **Cloudflare Worker apps (D1 / KV / R2 / Queues / DO) — the mocked-test blind spot.** Integration tests
   use fake bindings, so a missing local **D1 migration** is invisible to them yet fatal at runtime
   (`D1_ERROR: no such table: …` → 500). For any app with a `d1_databases` binding and a `migrations/` dir,
   the `dev` script MUST apply migrations to the local DB before `wrangler dev`:
   ```jsonc
   "migrate:local": "wrangler d1 migrations apply <db-name> --local",
   "dev": "bun run build && bun run migrate:local && wrangler dev"
   ```
   The smoke test (step 3) must hit at least one route that **reads from D1** to prove the schema is
   present. Apply the same reasoning to other bindings (KV/R2 seed, queue consumers).

5. **On failure:** route to gap closure — fix the run script / wiring / setup — then re-run this gate. Do
   NOT proceed until the documented run command boots and serves cleanly from a clean state.

Record the result (command run, surface checked, status) in the Step 10 report.

## Step 7.5: Comprehensive E2E + visual-baseline gate (LAST verification — web apps)

The smoke test (Step 7) proves the app **boots**; this proves it **works** — every screen, feature, and
control, in a real browser on **desktop and mobile**, pinned with visual baselines, with browser-console +
server errors caught and a modern-UX + responsive review. Full process:
`${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/e2e-testing.md`. **Pin Playwright `^1.61`** there; the
process also checks each screen against the design context (when one exists) and covers the agentic
Test-Agents/MCP accelerator and the latest assertion APIs (ARIA snapshots, axe a11y, soft assertions).

1. **Scope:** web surface present? (a `@moku-labs/web` client, incl. a worker-backed full-stack app or a
   `@moku-labs/room` app). If no web surface, skip with a one-line note (nothing to e2e) and continue.
2. **Offer the gate — confirmed skip only.** `AskUserQuestion`: *"Run the comprehensive E2E + visual-baseline
   stage now? Every screen/feature is tested + confirmed in a real browser; bugs and visual issues found are
   fixed."* — options: **"Run it (Recommended)"** · **"Skip — I confirm"** (desc: "ship without comprehensive
   e2e; recorded as skipped"). The skip is a **deliberate, confirmed** choice — never a silent default.
3. **On run:** spawn the **`web-e2e-tester`** agent (INVENTORY_SOURCES = the design context §6 inventory if
   present, the specs + what each wave delivered, and the app source; `MODE=gate`). It builds the full feature
   **and control catalog**, **gap-analyzes the whole app** (incl. features built in earlier waves),
   scaffolds/extends the Playwright suite + frozen fixture corpus + per-engine/per-OS visual baselines, **runs
   it for real** on **desktop and mobile** with **dual-side (browser + server) error capture**, checks **every
   control's behavior**, runs the **human-QA loop** (`web-qa-explorer` exploratory charters/tours/oracles → durable regression tests, plus `web-ux-reviewer` modern-UX/mobile), and **fixes
   every functional bug / behavioral defect / runtime error / visual or UX regression it finds** (app source,
   moku-web conventions) — **looping until clean**, not just green. The build is **not done** until it returns
   `PASS` — do not proceed to README/report on a red or partially-covered suite.
4. **On skip:** record it **prominently** in the Step 10 report ("⚠️ comprehensive E2E skipped by user — N
   screens unverified"), and write the outcome (run/skipped + coverage) to STATE.md so it is visible, not
   silent. (The standalone `/moku:e2e` command runs the same agent any time, without the skip offer.)

**Confirm, don't assume.** Never present the finished app as working on the strength of unit/integration
tests alone — only a green real-browser run counts (or an explicitly confirmed skip).

## Step 8: README generation / update

Generate or update the project root `README.md` (and any per-custom-plugin READMEs) now that the app
is built — follow `build-final.md` Step 5.6 (Root README) scoped to an app: what the app is, how to
run it (`bun run dev`/`build`/`start`), its plugin composition + config, entry point, and deployment
notes. Use the **`moku-readme` skill** for the house style — pick the **consumer-app** shape
(`moku-readme` §2 / `references/template.md` app deltas): the Quick start must show the *exact*
documented run command (the one Step 7's smoke test actually runs), and apps carry no npm badge.
If a `README.md` already exists (rebuild/update), refresh the changed sections rather than
overwriting hand-written prose. Run `bun run format`.

## Step 9: CI/CD, deployment & publication (user chooses)

Apps usually ship by **deployment**, not npm publish. Run `build-final.md` Step 5.10 (CI/CD,
Deployment & Publication Wave): present the shipping options with examples via `AskUserQuestion` and
let the user pick where/how to deploy (Cloudflare Pages/Workers, Vercel, Netlify, GitHub Pages,
container) and whether to add PR-validation CI. Recommend a deploy target for app projects. Generate
only the selected workflows, tell the user which repo secrets to add, and validate the YAML.

## Step 10: Report

Summarize what was built:
- Custom plugins created
- Entry point structure
- Validation results
- Integration test count + coverage (Step 6)
- **Runtime smoke test (Step 7): the run command exercised, the surface checked, and its status** — state plainly that the app was booted and served cleanly (or, for a pure library, that the gate was skipped and why)
- README + CI/CD / deployment generated (Steps 8–9)
- Any issues found and fixed

Update `.planning/STATE.md` with build results.

(Numbering note: validation is Step 5; integration tests are Step 6; the runtime smoke-test delivery gate is Step 7; README is Step 8; CI/CD is Step 9; this Report is Step 10.)

## App Quality Requirements

- Full JSDoc on ALL custom source files
- `import type` for type-only imports
- NEVER import from `@moku-labs/core` — only from the framework
- All tests must pass
- Biome and ESLint must pass
- The documented run command (`bun run dev` / `start`) boots the app **from a clean state** and serves its primary surface without error (Step 7 runtime smoke test) — passing tests alone never clear this bar
- Custom plugins follow the same quality standards as framework plugins

## Web Application

If the application is a web app (uses TSX, CSS, or web technologies), additionally enforce the **moku-web** skill patterns:
- Preact components with `data-*` attributes (no CSS classes in markup)
- CSS with `@scope` and `@layer`
- Island architecture for client-side interactivity
- Two-layer design token system
- Bundle size targets (JS < 8KB, CSS < 10KB gzipped)
