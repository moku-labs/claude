# App Build — Detailed Steps

## Step 1: Read and Validate the Plan

Read the specification from the provided path (defaults to `.planning/app-spec.md`). Verify it contains:
- Framework reference
- Plugin composition (ordered list)
- Configuration (global + per-plugin)
- Custom plugin specs (if any)
- Entry point structure

If the plan is incomplete, ask the user to run `/moku:plan app` first.

**Consult the reference app.** Before inventing an app structure, **read `demos/tracker`** (the
**Reference Projects** in `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/moku-frameworks.md`; local
clone `../demos/tracker`) — a real Layer-3 full-stack app (`@moku-labs/web` + `@moku-labs/worker`) and the
authority on idiomatic **app shape** per `moku-idioms.md`: multiple `createApp` instances (build / browser
/ worker), two frameworks side-by-side, folder split by concern, a thin `cloudflare/worker.ts` entry, and
business logic in `plugins/tracker`. Follow its structure and plugin boundaries — that is the fastest path
to an idiomatic solution. **Spec, not source:** for *design* references (e.g. `tracker-v2`) study look/feel
and re-implement, never copy a demo prototype's source (see its `design-context.md` §0).

## Step 2: Verify Framework

Check that the framework package is available:
- Read the framework's exports (createApp, createPlugin)
- Verify all referenced plugins exist
- Verify config types match

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

## Step 5: Validate

Run the post-build validation pipeline:

**Parallel Group A:**
- **moku-spec-validator** agent on all source files
- **moku-plugin-spec-validator** agent on custom plugins
- **moku-jsdoc-validator** agent on all source files
- **moku-readable-code-validator** agent on all source files (readability; WARNING/INFO only — never blocks)

**Parallel Group B:**
- **moku-test-validator** agent on custom plugin tests
- **moku-type-validator** agent (once, whole project)

If BLOCKER issues found, enter gap closure. WARNINGs included in report.

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

## Step 8: README generation / update

Generate or update the project root `README.md` (and any per-custom-plugin READMEs) now that the app
is built — follow `build-final.md` Step 5.6 (Root README) scoped to an app: what the app is, how to
run it (`bun run dev`/`build`/`start`), its plugin composition + config, entry point, and deployment
notes. If a `README.md` already exists (rebuild/update), refresh the changed sections rather than
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
