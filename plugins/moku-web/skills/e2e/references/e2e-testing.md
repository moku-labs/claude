# End-to-end and visual testing for Layer-3 web apps

This is the process the `e2e` skill orchestrates and the three web agents execute. It is the template: it
describes concretely how the suite is built for a `@moku-labs/web` app (SSG or SPA) — the
`playwright.config.ts`, the `tests/e2e/*.spec.ts` catalog, the frozen fixture corpus, the per-engine goldens,
the exploratory method, and the UX gate. Build this; do not depend on an external example project.

> **Scope.** Playwright drives a browser, so this applies to Layer-3 apps with a web surface: a
> `@moku-labs/web` client, a `@moku-labs/worker`-backed full-stack app whose client is web, or a
> `@moku-labs/room` app. A pure non-web app has no Playwright e2e. Worker endpoints are covered too (HTTP and
> WS assertions against the served worker), but the visual baselines belong to the web client.

---

## Prime directive — confirm, fix, then report

1. **Run it for real.** Build the app, serve it, drive it in a real browser. A green unit or integration
   suite is not evidence a screen works: SSG HTML renders even when the client bundle throws on boot (a
   `process.env` leak gives a `ReferenceError`), and a layout can regress without any logic failing.
2. **Cover everything.** Every screen, page, panel, modal, menu, transient state and every feature (nav,
   forms, filters, i18n, theming, drag, live data, auth) gets a functional assertion and a visual baseline.
   That includes features built in earlier waves that were never covered, so the gap analysis spans the
   whole app.
3. **Report only what ran.** Success means the suite is green and every inventory item is tested and
   confirmed. "I wrote the test" is not "it passes".
4. **Find a defect, fix it.** A functional failure or a visual diff that reflects a real defect is fixed in
   the app source and the suite re-run. A diff that reflects an intended change is a deliberate baseline
   update. Those two are distinguished by hand, never by a blanket update.
5. **Match the design.** When `.planning/design/{slug}/design-context.md` exists it is the visual and
   interaction reference: check every screen against its layout, spacing, states and inventory, and close
   the gap in the implementation (moku-web conventions: `data-*`, tokens, `@scope` and `@layer`). A screen
   that works but visibly diverges from the design context is a defect.

---

## Toolchain — pin the runner first

An outdated Playwright on Node 24 deadlocks the test runner: it hangs at 0% CPU with no output, before any
test runs, so it looks like an infinite hang with no diagnostics. Moku web apps pin `node >= 24` in
`engines`, so an old Playwright will not even start. Pin the runner before anything else.

- Pin `@playwright/test` and `playwright` at the **current stable minor** (at the time of writing `^1.61`).
  Re-check the Playwright release notes when you scaffold, and never drop below 1.60 — that is where the
  Node 24 deadlock was fixed.
- Match the Linux Docker image in `test:e2e:update:linux` and CI to the pinned version:
  `mcr.microsoft.com/playwright:v<pinned>-noble` (at the time of writing `v1.61.0-noble`). Bump the tag with
  the dependency.
- Run through node, not bun-as-interpreter. `bun run test:e2e` is fine — it resolves the `.bin/playwright`
  node shebang. The deadlock is version-specific, not runtime-specific.
- If the runner hangs with no output, check `@playwright/test --version` first. On Node 24 an outdated
  Playwright is almost always the cause.

---

## Coverage — enumerate, then close every gap

**Step 1 — build the inventory.** Enumerate every screen and feature, in priority order, from:

- a design context if one exists (`.planning/design/{slug}/design-context.md` §6 — tables A–G are literally
  the screen, panel and popup list to cover);
- the plan and specs (`.planning/specs/*`, `app-spec.md`) and what each build wave delivered;
- the app source — routes (`src/routes.tsx`: every page, locale and param), components, islands, pages, and
  the worker `endpoints.ts` for a full-stack app.

Enumerate down to the control level. For every screen, list each interactive control (button, link, input,
toggle, tab, menu item, drag handle) and how it should behave: its effect, the resulting state, route or
feedback, and its disabled, loading, empty and error states. This **control catalog** is the target for the
behavioral checks below.

**Step 2 — map existing coverage.** Read `tests/e2e/*`; for each inventory item record `tested?` (a
functional assertion exists) and `baselined?` (a visual golden exists).

**Step 3 — close every gap.** Add a functional assertion and a visual baseline for each uncovered item. A
feature with no e2e coverage fails the station, whichever wave built it.

**Step 4 — run, fix, confirm.** Run the suite, fix real defects, re-run, bounded by the fix budget.

---

## Feature-request mode

By default the station covers what exists. Given a `FEATURE_REQUEST` — a visual feature to build or change,
such as "add a dark-mode toggle to the header" or "make the board filter a slide-over" — only the intake is
new; every mechanism below is reused. Do this before the enumerate-cover-loop:

1. **Scope it.** A focused visual feature or change (a component, island, style or interaction on existing
   screens) is built here. A large multi-plugin feature (new routes plus worker endpoints plus state) is out
   of scope: return `PARTIAL` and point at `/moku:build` rather than half-building it.
2. **Ground it.** With a design context, that is the visual and interaction reference. Without one, build to
   the request plus the app's existing tokens and patterns; a one-off look that diverges from the rest of
   the app is itself a defect.
3. **Implement it in app source** with moku-web conventions (`data-*` selectors, tokens, `@scope`/`@layer`,
   islands for client behavior, node-free client bundle). Feature logic lives in a plugin or `lib/`, not in
   `routes.tsx` or `spa.tsx` — the same root idioms `/moku:verify` enforces.
4. **Add it to the inventory** as a new item (screen, states, controls and expected behavior) so the gap
   analysis and the control catalog include it.
5. **Cover and baseline it** — functional assertion, behavioral check, a11y assertion, visual baseline on
   desktop and mobile. Look at the first render before blessing the new golden.
6. **Run the exploratory and UX passes on it** like any other feature, and report it in the coverage table
   as built, tested and confirmed, calling out the new baselines.

---

## The suite shape

### Frozen fixture corpus

The Playwright `webServer` builds and serves a frozen fixture build, not the real site. Default to an inline
`webServer.command` — a shell one-liner composing existing package scripts. A bespoke `scripts/e2e-server.ts`
is the documented exception, not the norm:

```ts
// playwright.config.ts — SSG/SPA: build the FIXTURE corpus into a dedicated dir, then preview it.
// package.json "build:e2e" = app.cli.build({ contentDir: "tests/fixtures/content", outDir: "dist-e2e" }).
webServer: { command: "bun run build:e2e && bun run preview", url: BASE_URL, reuseExistingServer: !process.env.CI }

// worker-backed app — clean local state, then the documented dev boot + seed (one line, no script):
webServer: { command: "rm -rf .wrangler && bun run dev --seed", url: BASE_URL, reuseExistingServer: !process.env.CI }
```

Fixtures deliberately include the edge cases real data may lack: pagination, locale fallback, code blocks,
embeds, empty states, error states. Because the corpus is frozen, publishing real data never changes a
baseline. For a worker-backed app, seed deterministic fixture data (the same demo dataset the design context
froze) and a local D1 or KV fixture so API responses are stable.

### Derive expectations from the fixtures

A shared `tests/e2e/_content.ts` (or `_inventory.ts`) scans the fixture tree at test time and exports the
enumeration (slugs, titles, locales, feature flags). Specs loop over it, so adding a fixture extends coverage
on its own. Parse fixture metadata with a minimal independent parser; never derive expectations from the code
under test.

### Functional spec catalog

| Spec | Covers |
|------|--------|
| `no-js-errors.spec.ts` | Boot guard — no `pageerror` or `console.error` on every page and locale; SPA hydration is alive (client nav swaps content without a full reload). Catches the bundle-throws-but-HTML-renders class. Use `page.pageErrors()` / `page.consoleMessages()` / `page.requests()` for post-hoc per-page assertions. |
| `baseline.spec.ts` | Visual goldens — `toHaveScreenshot` for every page × locale × desktop and mobile (375×812). |
| `a11y.spec.ts` | An `@axe-core/playwright` WCAG 2.1 AA scan per screen (assert `violations == []`, or a documented allowlist); one committed ARIA snapshot (`toMatchAriaSnapshot`) per screen × key state; `toHaveRole` / `toHaveAccessibleName` / `toHaveAccessibleErrorMessage` on key controls and form fields. |
| `navigation.spec.ts` / `links.spec.ts` | Nav and link integrity in both SSG and SPA modes; no dead or off-route links. |
| `content.spec.ts` | Feature and content rendering, derived from the fixtures. |
| `seo.spec.ts` | `<title>`, meta, canonical and OG from the single `SITE` source. |
| `build-validation.spec.ts` | The fixture build emitted what it should — every expected page, asset and 404. |
| i18n, theming, forms, filters, auth, realtime | One spec per app feature from the inventory. For a worker app, an `api.spec.ts` hitting every `endpoints.ts` route (status, shape, WS) plus the served-assets check. |

Techniques to apply inside those specs: `expect.soft(...)` to collect all failures per screen in one run;
`page.clock.setFixedTime()` to freeze `Date.now()`-based UI; `page.emulateMedia()` for dark, `forced-colors`
and `prefers-reduced-motion` variants; `page.routeWebSocket()` to pin a live socket deterministically;
`locator.dragTo()` / `locator.drop()` for board DnD; `page.localStorage` / `page.sessionStorage` to seed
client state without driving the UI; `addLocatorHandler()` to auto-dismiss blocking overlays; `stylePath`,
`maskColor` and `maxDiffPixelRatio` to mask volatile regions.

### `playwright.config.ts` essentials

- **`webServer` is an inline `command` by default.** Compose existing package scripts as a shell one-liner
  (`rm -rf .wrangler && bun run dev --seed` for worker apps, `bun run build:e2e && bun run preview` for
  SSG/SPA). `port` honors `PORT`, so a stale server on the default port cannot be tested by accident;
  `reuseExistingServer: !CI`. Add a `PW_EXTERNAL_SERVER` opt-out so a long session can reuse an already
  seeded server, and so the rare app that needs a supervised server can plug one in without it being the
  default. Prefer `webServer.wait` (a regex on the server's stdout ready line) over URL polling, and set
  `trace: "on-first-retry"` plus `video: "retain-on-failure"` so CI keeps evidence exactly on failure.
- **A `scripts/e2e-server.ts` is the exception**, for a boot that needs imperative logic a shell line cannot
  express. Known case: `wrangler dev`'s workerd can SIGSEGV on Apple Silicon when a hibernatable-WebSocket
  Durable Object is evicted (workers-sdk#4995, workerd#1422) and go zombie — every request 503s instead of
  exiting, which `retries` cannot recover. If that bites a suite, write a small supervisor (poll `/health`,
  kill and restart the process tree, preserving on-disk data) behind `PW_EXTERNAL_SERVER`, and keep the
  inline command as the default. Do not scaffold it pre-emptively.
- **Engine matrix.** Chromium runs the full suite; functional logic is engine-agnostic and chromium also
  tracks the Navigation API. Webkit and firefox run only the visual baselines and the boot guard
  (`testMatch: /(baseline|no-js-errors)\.spec\.ts$/`), because rendering and boot crashes are engine-specific
  and the rest is not.
- **Visual determinism.** `expect.toHaveScreenshot` with `animations: "disabled"`, `caret: "hide"`,
  `scale: "css"`, `maxDiffPixelRatio: 0.02`; `deviceScaleFactor: 1`, fixed `colorScheme`,
  `reducedMotion: "reduce"`, chromium `--font-render-hinting=none --force-color-profile=srgb`.
- In specs: freeze the clock with `page.clock.setFixedTime(...)` for time-dependent UI, and
  `await document.fonts.ready` before every screenshot, or font swap ghosts the diff.

### Per-engine and per-OS goldens

Playwright suffixes every snapshot with engine and OS (`home-en-chromium-darwin.png`, `…-firefox-linux.png`),
so each keeps an independent golden set; they cannot share. Commit the goldens and update them deliberately:

- `bun run test:e2e:update` — local (macOS gives `-darwin`).
- `bun run test:e2e:update:linux` — the pinned Linux Docker image (`mcr.microsoft.com/playwright:v<pinned>-noble`)
  for CI parity (`-linux`).

### Scripts to ensure in `package.json`

`test:e2e` (`playwright test`), `test:e2e:update` (`--update-snapshots`), `test:e2e:update:linux` (the pinned
Docker image). `playwright` and `@playwright/test` pinned as in Toolchain. The webServer is an inline command,
so there is no separate serve script to maintain unless the supervised exception applies. Install browsers
with `bunx playwright install` (add `--with-deps` in CI).

---

## Agentic authoring (optional accelerator)

Playwright ships agentic testing support. It augments this process; it does not replace the committed spec
catalog, the frozen fixtures or the visual baselines.

Two MCP servers, easily confused:

- `@playwright/mcp` (`npx @playwright/mcp@latest`) — browser automation: drive and verify the live app with
  no committed spec. Snapshot mode (the default) returns the accessibility tree with stable refs, so the
  model targets by ref; it survives reflow and costs no vision tokens. Add `--caps=vision` only for
  `<canvas>` or pixel-exact cases.
- Playwright Test MCP (`npx playwright run-test-mcp-server`, TS/JS only) — author, run and heal committed
  specs. This is what `init-agents` wires into `.mcp.json` under the key `playwright-test`.

A project `.mcp.json` loads on the next session, not mid-session.

`npx playwright init-agents --loop=claude` scaffolds three subagents into `.claude/agents/`
(`playwright-test-planner`, `-generator`, `-healer`) plus a `.mcp.json` and `tests/seed.spec.ts`. Re-run it
after every Playwright upgrade.

- **planner** explores the running app and writes a reviewable Markdown plan into `specs/`.
- **generator** turns the plan into specs, validating every locator against the live DOM. It emits
  `getByRole` and `getByTestId`, never scraped `.class` or `#id`, which removes the main failure mode of
  LLM-authored specs and matches the moku `data-*` and role convention.
- **healer** re-runs failures in debug, inspects the live page, patches surgically, and marks a test skipped
  when the app itself is broken, preserving the bug signal. Every skip is a candidate real defect.
- **Seed is the linchpin.** Put the app's real sign-in in `tests/seed.spec.ts` and persist it with
  `page.context().storageState({ path })` so agents explore signed in. It runs through the MCP `*_setup_page`
  tools, not during a normal `playwright test`.
- Human review gates: after the plan (scope), after generation (keep or discard), after a heal (diffs and
  skips).

| Capability | API or flag | Why |
|---|---|---|
| Page as text | `page.ariaSnapshot({ mode:'ai', boxes })` | The a11y tree is the page model to feed each turn. |
| Structural assertion | `expect(l).toMatchAriaSnapshot()` | One committed a11y snapshot per screen and state; resilient to styling churn (store `*.aria.yml`). |
| Selector self-repair | `locator.normalize()` | Rewrites a brittle guessed selector into `getByRole`/`getByTestId`. |
| Stable locator minting | `browser_generate_locator` | Mint committable locators from the live DOM. |
| GUI-less debug | `--debug=cli`, `npx playwright trace <cmd>` | Step through and post-mortem a trace as text. |
| Cheap heal loops | `--last-failed`, `--only-changed` | Re-run only what broke or changed. |

The audit-fix-recapture loop for design fidelity: a committed gallery spec screenshots every design-context
§6 screen × viewport × theme; each screenshot is compared against its design-context section plus the
component CSS to give a source-verified defect list with severity and a concrete fix; fixes land per disjoint
file group; then re-capture and re-score. Run it whenever a design context exists.

> Hardened `@playwright/mcp` config: `--headless --isolated --browser chromium --viewport-size 1280x720`
> `--allowed-origins "<app origins>" --output-dir ./.pw-mcp`, plus `--no-sandbox` in CI. `browser_install` is
> not a tool (run `npx playwright install chrome`), and the trace flag is `--save-session`, not
> `--save-trace`.

---

## Hard-won rules (each cost real debugging time)

- **The webServer boot runs `bun run dev` (the package script), not `bun scripts/dev.ts`.** The package
  script puts `node_modules/.bin` on PATH, so a worker app can spawn `wrangler`; otherwise you get
  "Executable not found: wrangler". Prefix `rm -rf .wrangler` before a seeded boot: the deterministic seed
  uses plain INSERTs and is the frozen fixture corpus, so it must land on a clean DB. Keep that wipe in the
  inline `webServer.command` and not in `seed.sql` — the same seed is the `deploy --seed` production fixture,
  so a destructive `DELETE` or `DROP` there would wipe production.
- **`waitForLoadState("networkidle")` never settles** when an island holds a live WebSocket. Use `"load"`
  plus an explicit `expect(locator).toBeVisible()`.
- **Anchored `waitForURL(/^\/…/)` regexes test the full URL** (`http://host/…`), so `^/` never matches. Use a
  pathname predicate: `u => u.pathname === "/" || u.pathname.startsWith("/board/")`.
- **`fullPage: true` misrepresents `position: fixed` overlays**, menus and modals by pinning them to the
  layout origin. Capture overlays with `fullPage: false` (viewport).
- **ESLint must ignore generated dirs** (`.wrangler/**`, `playwright-report/**`, `test-results/**`,
  `dist-e2e/**`) or `bun run lint` breaks once the dev server has run.
- **`bun run dev` regenerates `wrangler.jsonc`** (the deploy plugin owns it), so `git checkout wrangler.jsonc`
  before committing to keep the dev-run side effect out.
- **Playwright wipes `outputDir` (`test-results/`) each run**, so committed goldens live outside it. The
  default `*-snapshots/` dirs beside the specs are fine; an ad-hoc `test-results/gallery` is not.
- **Strict-mode multi-match** bites loose selectors (a card with two avatars, a label matching three nodes).
  Scope, add `.first()`, and target by `data-action` or role rather than a bare `getByText`.
- **Demo-auth sign-in is format-only** (any `local@domain.tld` plus a non-empty password). Drive the real
  `/signin` form to set the HttpOnly session cookie: a central 401-to-/signin gate blocks `/api/*` until
  then, and data-bearing screens only render after sign-in.

---

## Baseline policy — real defect or intended change

Decide before touching a golden:

- **Real regression** (a layout, spacing, color or overflow defect, an unintended shift): fix the app source
  with moku-web conventions and re-run. The baseline stays.
- **Intended change** (a redesign the user approved): update the golden (`test:e2e:update` and `:linux`) and
  say so in the report. A new screen gets its golden only after someone looked at the first render.

A blanket `--update-snapshots` to clear red converts a regression into a passing baseline, so it is not used.

---

## Beyond green — errors, behavior, mobile

A green suite with matching baselines is necessary and not sufficient. The station also proves zero runtime
errors on both sides, that every control behaves as specified, and that the app works on mobile.

### Capture every error, browser and server

Wire error capture into every spec, not only the boot guard, and assert zero on both sides:

- **Browser:** listen for `pageerror`, `console.error` and `console.warn`, unhandled rejections, and failed
  responses (4xx/5xx) on every page and during every interaction; aggregate with `page.pageErrors()`,
  `page.consoleMessages()` and `page.requests()`. A feature that works visually but logs a console error is a
  bug. Allowlist only documented, justified exceptions.
- **Server:** tee the e2e server's and the worker's stdout and stderr to a log file; after the run, scan for
  error-level lines (uncaught exceptions, 5xx, unhandled rejections, `D1_ERROR`) and fail on any. A UI that
  looks fine while the server logs an error is a bug.

### Behavioral correctness

Drive the control catalog. For each control assert that it exists, is reachable and labeled (role and name);
that it responds with visible feedback; that it produces its expected effect (state, route or data); and that
it handles its edge states (disabled, loading, empty, error). Dead or no-op controls, a wrong effect, missing
feedback, stuck states and behavior that diverges from the reference are defects to fix.

### Mobile

Every screen is exercised at mobile widths (375×812, plus roughly 320 and 430) with touch rather than hover.
Assert no horizontal overflow, clipping or overlap; tap targets of at least 44×44px; readable type; safe-area
insets; and that the mobile patterns work (drawers, bottom sheets, sticky bars). A desktop-correct,
mobile-broken screen is a failure, not a deferral.

### Loop until clean

Iterate run → capture (functional, console, server, behavior) → fix → re-run, and exit when a full pass
surfaces nothing new: suite green, zero errors on both sides, every control behaving, mobile verified. Bound
it with the fix budget; if findings remain at the budget, stop and report them.

---

## Exploratory QA — charters, tours, oracles

This is the method `moku-web-qa-explorer` runs. A scripted suite proves the known still works; exploration
finds what no one wrote a test for.

**Charters.** Frame every session as "Explore (target) with (resources) to discover (information)"
(Hendrickson). One charter at a time, time-boxed and scope-boxed. Generate charters across **SFDIPOT** so the
session does not tunnel on Function: Structure, Function, Data (boundaries, big, empty, invalid, unicode),
Interfaces (API, import, export), Platform (browser, viewport), Operations (personas, extreme use), Time
(concurrency, races, double submit, stale data, timezones). Time and Data are the most-missed.

**Tours.** Cycle themed lenses; each surfaces a different bug class.

| Tour | Lens | Finds |
|---|---|---|
| FedEx | Follow one piece of data end to end: create, list, detail, edit, export | Transform, persistence and encoding loss |
| Supermodel | Care only about the surface | Layout, overflow, truncation, visual inconsistency |
| Saboteur | Starve resources: offline or slow network, denied permission, empty or huge dataset, killed API | Graceful degradation and error handling |
| OCD | Repeat actions, double-click submits, undo and redo, back and forward | Idempotency and accumulation bugs |
| Antisocial | Illegal or oversized input, wrong order, XSS-ish strings | Validation and escaping |
| Rained-Out | Start an action then cancel or navigate away mid-flight | Cleanup and side effects |
| Landmark, Couch-Potato | Visit key features in odd orders; do the minimum, submit empty | Order dependence, default handling |

**Oracles — how to decide something is wrong with no spec,** cheapest and most precise first:

1. **Implicit**, run continuously and near-zero false positive: any `pageerror` or `console.error`, any
   4xx/5xx (check `response.status()`, a 404 still "finishes"), an unhandled rejection, or a hang (a spinner
   past a deadline with no terminal state). Wrong for any app, no product knowledge needed.
2. **Accessibility versus rendered** (`@axe-core/playwright`): a control that looks interactive but has no
   role or name; a dead affordance with no DOM, URL or `aria-live` change after a click.
3. **Invariants and metamorphic relations**, proposed per screen in plain language: badge count equals list
   length; add-then-remove restores the total; a filter is idempotent; a progress bar never exceeds 100%;
   submitting twice does not create two records.
4. **Visual and differential**: a committed baseline diff, or before versus after a change.
5. **FEW HICCUPPS consistency oracles**, the senior-QA judgment call: is the behavior consistent with its
   History, the brand Image, Comparable products, stated Claims (the claim may be what is wrong), Users'
   desires, the Product's own internal patterns, its Purpose, Standards and statutes, Familiarity with known
   bug patterns, Explainability (if you cannot explain the behavior, suspect it), and the World? Surprise is
   itself an oracle.

**Persona journeys.** Walk the core jobs, not isolated screens, as a first-time user (read only what is
visible, log every "what does this do?"), a power user (shortcuts, bulk, deep links; count the steps), a
screen-reader user (drive the accessibility tree and deny yourself the screenshot — an unnamed control is a
blocker), and a mobile-on-the-go user (narrow viewport, touch, low patience). Record the friction across
awareness → first run → core task → return (clear state and re-enter: does onboarding repeat? is saved work
there?). A screen that is done for one persona and a dead end for another is a finding.

**Grounding.** Act on the accessibility tree (role plus accessible name) and re-snapshot after every
navigation. Emit role and text locators (`getByRole`, `getByLabel`, `getByText`), never CSS or XPath with a
sleep. Reach for a screenshot only when the tree cannot disambiguate spatially close elements. Seed
signed-in state by driving the real `/signin` and persisting `storageState`, and use seeded fixtures or
mocked mutations for destructive flows so re-runs are idempotent.

**Durability.** A confirmed functional bug is not finished until it has a committed Playwright regression
test: reproduce deterministically, author a test asserting the correct behavior (role and text locators,
`toMatchAriaSnapshot` for structure), prove it discriminates (red on the bug, or stable as a guard), and it
joins the suite. Re-run the full suite with the additions and revert anything that turns a pre-existing test
red; the job is additive.

**Severity.** Rate each finding 0–4 (0 discard, 1 cosmetic, 2 minor, 3 major, 4 catastrophe) and prioritize
by (severity × confidence) ÷ effort. Only P0/P1 with full evidence may block. Use behavioral uncertainty
(does it reproduce? is the evidence concrete?), not a self-reported confidence number. One charter per
iteration, stop a charter at its budget, and stop the loop when a full pass surfaces no new finding at P2 or
above.

---

## The UX gate

This runs after functional green. The `e2e` skill orchestrates it; `moku-web-ux-reviewer` executes the
browser work. It is never skipped, and no single reviewer closes it.

### 1. Capture

`moku-web-ux-reviewer` drives the served app and writes one screenshot per screen-inventory item per viewport
into `.planning/e2e/shots/`, named `<screen>-<desktop|mobile>.png`. Desktop is 1280×720; mobile is 375×812
with touch. It also measures the deterministic floor — axe violations, contrast ratios, tap-target geometry,
timing — and returns those as its own findings.

### 2. Two independent reviews

Astra is a second opinion on user experience, from a different model:

```bash
moku-astra review --images <comma-separated shots> \
  --context .planning/design/<slug>/design-context.md \
  --out .planning/astra/findings.json
```

Exit 3 means Astra is unavailable for any reason, and an absent `moku-design` pack (no `moku-astra` on PATH)
is the same case. Then the orchestrator reviews the same screenshots alone, writing the same findings shape,
and the report names the reviewer. The gate still runs.

The orchestrator reviews the screenshots independently in every case, Astra present or not. Two opinions on
the same images, formed separately, then merged into one list together with the reviewer's heuristic
findings.

### 3. The findings shape

Both reviewers write the same object: a two-sentence `summary` plus a `findings` array. Each finding carries
`screen` (the screenshot file name), `region` (where, in words), `severity` (`blocker`, `major`, `minor`),
`category` (`layout`, `hierarchy`, `readability`, `consistency`, `interaction`, `responsive`,
`accessibility`, `design-fidelity`), `problem` (what a user would experience, observed rather than judged)
and `suggestion` (one concrete change). The schema lives in the `moku-design` pack at
`schemas/visual-findings.json`.

### 4. Triage

The orchestrator triages every merged finding with four questions:

1. Is it reproducible in the browser (not only in the screenshot)?
2. Is it consistent with `design-context.md`?
3. Is it consistent with the moku-web rules (`data-*`, tokens, `@scope`/`@layer`, islands)?
4. Is it worth its cost?

Write every finding to `.planning/astra/triage.md` as accepted or rejected with the reason. A rejection is
recorded, not dropped silently.

### 5. Fix and re-review

Accepted findings go to `moku-web-ux-reviewer` (behavior, layout, responsive) or `moku-web-e2e-tester`
(functional and baselines). Fixes snap to the existing design tokens and components — propose
`--color-warning-600`, never a raw `#E8A317`; a raw non-token literal is itself an inconsistency. Re-run the
suite after any edit and revert anything that regresses. Then re-screenshot and review again: at most two
review passes, after which remaining findings are reported rather than fixed.

### Reliability discipline

Model judgment about experience is high recall and high false positive on absolute or visual calls, so:

- Every finding cites a concrete artifact — a screenshot region, a measured value (contrast ratio,
  tap-target px, CLS), a DOM role or name, a console or network line, or a failed step — and names the
  heuristic, WCAG criterion or token it violates. No citation, no finding.
- Prefer the deterministic floor (axe, measured geometry and contrast, task success and time, console and
  network signals) over aesthetic opinion, and judge comparatively (before versus after) rather than scoring
  an absolute "UX = 7/10".
- Apply only clear, low-risk, reversible, standards-grounded changes. Anything subjective, visual or
  high-blast-radius is a proposal for the user.

---

## What the station reports

A coverage table — every inventory item × tested, baselined, behavior-checked, confirmed — plus the engines
and viewports exercised, the defects found and fixed, the exploratory findings with the regression tests they
became, the UX gate outcome naming both reviewers and the accepted and rejected counts, any baselines updated
with the reason, and the verdict. If the run is red, report the failing items and what each needs.
