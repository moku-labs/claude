# Comprehensive E2E + Visual-Baseline Testing (Layer-3 web apps)

The mandatory final delivery gate for a Layer-3 **web** app: every screen, feature, state, and interaction
is exercised in a **real browser** (Playwright) and pinned with a **visual baseline**, then **confirmed
green** before anything is shown to the user. **Nothing is assumed** — if a functional bug or a visual
regression is found, it is **fixed** (and the suite re-run) before the gate passes.

This document **is** the template — it describes, concretely, how the suite must be built for a
`@moku-labs/web` app (SSG/SPA): the `playwright.config.ts`, the `tests/e2e/*.spec.ts` catalog, the frozen
fixture corpus, and the per-engine/per-OS golden baselines. Build exactly this; do not depend on any
external example project.

This drives two entry points (same process, same agent):
- **The final App-Build stage** — runs after build + validation + the runtime smoke test. **Mandatory but
  skippable with an explicit, confirmed skip** (see "The gate").
- **The standalone `/moku:e2e` command** — "cover all e2e tests" on demand, any time.

> **Scope gate.** Playwright is a *browser* runner — this applies to Layer-3 apps with a **web** surface
> (a `@moku-labs/web` client, incl. a `@moku-labs/worker`-backed full-stack app whose client is web, and a
> `@moku-labs/room` app). For a pure non-web app there is no Playwright e2e — decline like the medium gate.
> API/worker endpoints are covered too (HTTP/WS assertions against the served worker), but the visual
> baselines are the web client's.

---

## Prime directive — confirm, don't assume; fix what you find

1. **Run it for real.** Build the app, serve it, drive it in a real browser. A passing unit/integration
   suite is **not** evidence the screen works — SSG HTML renders even when the client bundle throws on boot
   (a `process.env` leak → `ReferenceError`), and a layout can regress without any logic failing. Only a
   real browser run counts.
2. **Cover everything.** Every screen / page / panel / modal / menu / transient state and every feature
   (nav, forms, filters, i18n, theming, drag, live data, auth, …) must have a functional assertion **and**
   a visual baseline. This includes features built or changed in **earlier** build waves/stages that were
   never e2e-tested — do a **gap analysis** over the *whole* app, not just the last change.
3. **Never present red or unverified.** Do not report success until the suite is **green** and every
   inventory item is `tested + confirmed`. "I wrote the test" ≠ "it passes". "It probably works" is banned.
4. **Find a bug → fix it.** A functional failure or a visual diff that reflects a **real defect** (not a
   stale baseline) is fixed in the **app source** (then re-run). A diff that reflects an **intended** change
   is a deliberate baseline update (below). Distinguish the two — never blanket-update baselines to make red
   go green.
5. **Match the design (when a design context exists).** If `.planning/design/{slug}/design-context.md`
   exists, it is the **visual + interaction source of truth** — check every screen against its intended
   layout, spacing, states, and element inventory, and **fix the implementation to get as close as possible**
   to it (moku-web conventions: `data-*`, tokens, `@scope`/`@layer`). A screen that *works* but visibly
   diverges from the design context is a defect, not "done" — close the gap via the audit→fix→re-capture loop.

---

## Toolchain — pin Playwright ≥ 1.61 (do this first)

**Pin the runner before anything else.** An **outdated Playwright on Node 24 deadlocks the test runner** — it
hangs at 0% CPU with zero output, *before* any test runs, so it looks like an infinite hang with no
diagnostics. Moku web apps pin `node >= 24` (engines), so an old Playwright **won't even start**.

- Pin **`@playwright/test` and `playwright` at `^1.61`** (or the latest minor) — never a minor below 1.60.
- Match the pinned Linux Docker image in `test:e2e:update:linux` and CI:
  **`mcr.microsoft.com/playwright:v1.61.0-noble`** (bump the tag with the dep).
- Run via **node, not bun-the-interpreter** — `bun run test:e2e` is fine (it resolves the `.bin/playwright`
  node shebang); the deadlock is version-, not runtime-, specific.
- **If the runner hangs with no output**, check `@playwright/test --version` and bump it — on Node 24 an
  outdated Playwright is almost always the cause.

---

## Comprehensive coverage — enumerate, then close every gap

**Step 1 — build the feature inventory (the coverage target).** Enumerate every screen/feature from, in
priority order:
- a **design context** if one exists (`.planning/design/{slug}/design-context.md` §6 inventory — tables
  A–G are literally the screen/panel/popup list to cover);
- the **plan/specs** (`.planning/specs/*`, `app-spec.md`) and what each build wave delivered (so features
  built in *any* stage are in scope);
- the **app source** — routes (`src/routes.tsx` → every page + locale + params), components/islands/pages,
  and the worker `endpoints.ts` (every HTTP/WS route) for a full-stack app.

**Step 2 — map existing coverage.** Read `tests/e2e/*`; for each inventory item record `tested?` (a
functional assertion exists) and `baselined?` (a visual golden exists).

**Step 3 — close every gap.** For each untested/un-baselined item, add a functional assertion and a visual
baseline (patterns below). A feature with no e2e coverage is a gate failure, regardless of which stage
built it.

**Step 4 — run, fix, confirm.** Run the suite; fix real defects; re-run; repeat (bounded) until green and
fully covered.

---

## The suite shape

### Frozen fixture corpus — baselines never drift on real data
The Playwright `webServer` builds and serves a **frozen fixture build**, NOT the real site. Do this in a
small `scripts/e2e-server.ts` that builds a fixture corpus into a dedicated dir and previews it:

```ts
import { makeApp } from "../src/app";
// build the FIXTURE corpus into a dedicated dir, then preview it
const app = makeApp("production", { contentDir: "tests/fixtures/content", outDir: "dist-e2e" });
await app.cli.build();
await app.cli.preview();
```

Fixtures deliberately include the edge cases real data may lack (pagination, locale fallback, code blocks,
embeds, empty states, error states). Because the corpus is frozen, **publishing real data never changes a
baseline**. For a worker-backed app, seed deterministic fixture data (a fixed demo dataset — the same one
the design context froze) and a local D1/KV fixture so API responses are stable.

### Derive expectations from the fixtures
A shared `tests/e2e/_content.ts` (or `_inventory.ts`) **scans the fixture tree at test time** and exports
the enumeration (slugs/titles/locales/feature flags). Specs loop over it, so adding a fixture auto-extends
coverage. Parse fixture metadata with a **minimal independent parser** — never derive expectations from the
code under test.

### Functional spec catalog (start from these, add app-specific specs)
| Spec | Covers |
|------|--------|
| `no-js-errors.spec.ts` | **Boot guard** — no `pageerror`/`console.error` on **every** page+locale; SPA hydration is alive (client nav swaps content without a full reload). Catches the bundle-throws-but-HTML-renders class. Use `page.pageErrors()` / `page.consoleMessages()` / `page.requests()` (1.56) for post-hoc "zero JS errors / no failed requests" assertions per page. |
| `baseline.spec.ts` | **Visual goldens** — `toHaveScreenshot` for every page × locale × desktop **and** mobile (375×812). |
| `a11y.spec.ts` | **Accessibility** — an `@axe-core/playwright` WCAG 2.1 AA scan per screen (assert `violations == []`, or a documented allowlist); one committed **ARIA snapshot** (`toMatchAriaSnapshot`, 1.49) per screen × key state (structural, styling-churn-resilient); `toHaveRole`/`toHaveAccessibleName`/`toHaveAccessibleErrorMessage` on key controls + form fields. |
| `navigation.spec.ts` / `links.spec.ts` | Nav + link integrity in **both** SSG and SPA modes; no dead/!=route links. |
| `content.spec.ts` | Feature/content rendering, derived from the fixtures. |
| `seo.spec.ts` | `<title>`/meta/canonical/OG from the single `SITE` source. |
| `build-validation.spec.ts` | The fixture build **emitted** what it should (every expected page/asset/404) — the "everything built is delivered" check across stages. |
| i18n / theming / forms / filters / auth / realtime … | One spec per **app feature** from the inventory. For a worker app, an `api.spec.ts` hitting every `endpoints.ts` route (status, shape, WS) + the served-assets check. |

**Latest-feature techniques** (Playwright ≥ 1.61 ships all of these) — apply inside the specs above:
`expect.soft(...)` to collect ALL failures per screen in one run (not fail-fast → comprehensive per-screen
reports); `page.clock.setFixedTime()` to freeze `Date.now()`-based UI; `page.emulateMedia()` for dark /
`forced-colors` / `prefers-reduced-motion` variants; `page.routeWebSocket()` to pin a live socket
deterministically; `locator.dragTo()` / `locator.drop()` for board/kanban DnD; `page.localStorage` /
`page.sessionStorage` to seed/read client state without driving the UI; `addLocatorHandler()` to auto-dismiss
blocking overlays; enhanced screenshots (`stylePath`, `maskColor`, `maxDiffPixelRatio`) to mask volatile
regions.

### `playwright.config.ts` essentials
- `webServer` runs the fixture build+preview; `port` honors `PORT` (so a stale preview on the default port
  can't be tested by accident); `reuseExistingServer: !CI`. Add a **`PW_EXTERNAL_SERVER` opt-out** so a long
  session can reuse an already-running seeded server instead of re-booting it each run. Prefer `webServer.wait`
  (a regex on the server's stdout ready-line, 1.57) over URL-polling for deterministic boot detection, and set
  `trace: "on-first-retry"` (+ `video: "retain-on-failure"`) so CI keeps evidence exactly on failure.
- **Engine matrix:** **chromium runs the FULL suite** (functional logic is engine-agnostic; chromium also
  tracks the Navigation API). **webkit + firefox run ONLY** the visual baselines + the boot guard
  (`testMatch: /(baseline|no-js-errors)\.spec\.ts$/`) — rendering and boot-crashes are engine-specific;
  everything else isn't.
- **Visual determinism (non-negotiable):** `expect.toHaveScreenshot` with `animations: "disabled"`,
  `caret: "hide"`, `scale: "css"`, `maxDiffPixelRatio: 0.02`; `deviceScaleFactor: 1`, `colorScheme` fixed,
  `reducedMotion: "reduce"`, chromium `--font-render-hinting=none --force-color-profile=srgb`.
- In specs: freeze the clock (`page.clock.setFixedTime(...)`) for any time-dependent UI, and
  `await document.fonts.ready` before every screenshot (font-swap ghosting).

### Per-engine / per-OS golden baselines
Playwright suffixes every snapshot with **engine + OS** (`home-en-chromium-darwin.png`,
`…-firefox-linux.png`), so each keeps an independent golden set — they **cannot** share. Commit the goldens.
Update them **deliberately**:
- `bun run test:e2e:update` — local (macOS → `-darwin`).
- `bun run test:e2e:update:linux` — the pinned Linux Docker image
  (`mcr.microsoft.com/playwright:v<pinned>-noble`) → `-linux` (CI parity).

### Scripts to ensure (`package.json`)
`test:e2e` (`playwright test`), `test:e2e:update` (`--update-snapshots`), `test:e2e:update:linux` (Docker,
pinned **`v1.61.0-noble`** image). The e2e build/serve script (`scripts/e2e-server.ts`) and `playwright` +
`@playwright/test` devDeps **pinned at `^1.61`** (see Toolchain).
Install browsers with `bunx playwright install` (and `--with-deps` in CI).

---

## Agentic authoring (optional accelerator — Playwright Test Agents + MCP)

Playwright ships first-class agentic testing (1.56+; the `^1.61` pin already includes it). Use it to author
and self-heal the suite far faster than hand-writing specs — especially when scaffolding from scratch or doing
a comprehensive "test/fix everything" pass. It **augments** the process above; it does not replace the
committed spec catalog, the frozen fixtures, or the visual baselines.

**Two MCP servers — keep them straight (the #1 confusion):**
- **`@playwright/mcp`** (`npx @playwright/mcp@latest`) — browser automation: drive + verify the **live** app
  with no committed spec. **Snapshot mode (default)** returns the *accessibility tree with stable refs* — the
  model targets by ref (survives reflow, no vision tokens) and the snapshot both drives and verifies; add
  `--caps=vision` only for `<canvas>`/pixel-exact cases.
- **Playwright Test MCP** (`npx playwright run-test-mcp-server`; TS/JS only) — author/run/heal **committed**
  specs. It is what `init-agents` wires into `.mcp.json` (key `playwright-test`).
- A project `.mcp.json` loads on the **next** session, not mid-session.

**The Test Agents** — `npx playwright init-agents --loop=claude` scaffolds three subagents into
`.claude/agents/` (`playwright-test-planner` / `-generator` / `-healer`), plus a `.mcp.json` and a
`tests/seed.spec.ts`. Re-run after every Playwright upgrade.
- **planner** explores the running app → a reviewable Markdown plan in `specs/`.
- **generator** turns the plan into specs, **validating every locator against the live DOM** — it emits
  `getByRole`/`getByTestId`, never scraped `.class`/`#id`. This kills the #1 failure of LLM-authored specs
  (hallucinated selectors) and matches moku's `data-*`/role convention.
- **healer** re-runs failures in debug, inspects the live page (console/network/snapshot), patches
  **surgically**, and marks a test `skipped` when the **app itself** is broken — preserving the bug signal
  (investigate every skip; it may be a real defect to fix in source, not a flaky test).
- **Seed = the linchpin:** put the app's real sign-in in `tests/seed.spec.ts` and persist it
  (`page.context().storageState({ path })`) so agents explore **signed-in** (moku demo screens are
  sign-in-gated). It runs first via the MCP `*_setup_page` tools, not during a normal `playwright test`.
- **Human-review gates:** after the plan (scope), after generation (review before keeping), after heal
  (validate diffs; investigate skips).

**Agentic capabilities to lean on** (perceive / act robustly / self-heal):

| Capability | API / flag | Ver | Why |
|---|---|---|---|
| Page as text | `page.ariaSnapshot({ mode:'ai', boxes })` | 1.59 | The a11y tree is the ideal LLM page model — feed it each turn. |
| Structural assertion | `expect(l).toMatchAriaSnapshot()` | 1.49 (page 1.60) | One committed a11y snapshot per screen/state; resilient to styling churn (store `*.aria.yml`). |
| Selector self-repair | `locator.normalize()` | 1.59 | Rewrites a brittle guessed selector into `getByRole`/`getByTestId`. |
| Stable locator minting | `browser_generate_locator` | 1.56 | Mint committable locators from the live DOM, not invented ones. |
| GUI-less debug | `--debug=cli`, `npx playwright trace <cmd>` | 1.59 | Step/inspect and post-mortem a trace as text — no display. |
| LLM error context | "Copy prompt" button | 1.51 | One-click LLM-ready failure context for the healer. |
| Cheap heal loops | `--last-failed` / `--only-changed` | 1.44/1.46 | Re-run only what broke / changed. |

**The audit→fix→re-capture loop (a proven design-fidelity pass)** — the way to get the implementation **as
close as possible to the design context**: (1) a committed gallery spec screenshots every design-context §6
screen × viewport × theme; (2) **one agent per screen** compares its screenshot against the design-context
section + the component CSS → a *source-verified* fidelity-defect list (severity + concrete fix); (3) **one
fix agent per disjoint file group**; (4) re-capture + **re-audit to objectively re-score** (don't assume a fix
worked). Run it whenever a design context exists, and for any "make it comprehensive / fix the design" pass.

> Hardened `@playwright/mcp` config: `--headless --isolated --browser chromium --viewport-size 1280x720`
> `--allowed-origins "<app origins>" --output-dir ./.pw-mcp` (+ `--no-sandbox` in CI). Note: `browser_install`
> is **not** a tool (run `npx playwright install chrome`); the trace flag is `--save-session`, not
> `--save-trace`.

---

## Hard-won rules (each cost real debugging time)

- **`scripts/e2e-server.ts` runs `bun run dev` (the package script), NOT `bun scripts/dev.ts`** — the package
  script puts `node_modules/.bin` on PATH so a worker app can spawn `wrangler` ("Executable not found:
  wrangler" otherwise). `rm -rf .wrangler` before a seeded boot (the deterministic seed uses plain INSERTs and
  IS the frozen fixture corpus).
- **`waitForLoadState("networkidle")` never settles** when an island holds a live WebSocket (the board socket)
  → use `"load"` + an explicit `expect(locator).toBeVisible()`.
- **Anchored `waitForURL(/^\/…/)` regexes test the FULL URL** (`http://host/…`), so `^/` never matches → use a
  pathname predicate: `u => u.pathname === "/" || u.pathname.startsWith("/board/")`.
- **`toHaveScreenshot` / `page.screenshot` `fullPage: true` misrepresents `position: fixed`
  overlays/menus/modals** (pins them to the layout origin) → capture overlays with `fullPage: false`
  (viewport).
- **ESLint must ignore generated dirs** (`.wrangler/**`, `playwright-report/**`, `test-results/**`,
  `dist-e2e/**`) or `bun run lint` breaks once the dev server has run.
- **`bun run dev` regenerates `wrangler.jsonc`** (the deploy plugin owns it) → `git checkout wrangler.jsonc`
  before committing so the dev-run side-effect isn't committed.
- **Playwright wipes `outputDir` (`test-results/`) each run** — committed goldens must live OUTSIDE it (the
  default `*-snapshots/` dirs beside specs are fine; an ad-hoc `test-results/gallery` is not).
- **Strict-mode multi-match** bites loose selectors (a card with 2 avatars, a label matching 3 nodes) → scope
  + `.first()` + target by `data-action`/role, not a bare `getByText`.
- **Demo-auth sign-in is format-only** (any `local@domain.tld` + non-empty password) — drive the real
  `/signin` form to set the HttpOnly session cookie; a central 401→/signin gate blocks `/api/*` until then,
  and data-bearing screens only render after sign-in.

---

## Baseline policy — real defect vs intended change

When a visual diff appears, decide **before** touching goldens:
- **Real regression** (a layout/spacing/colour/overflow defect, an unintended shift): **fix the app source**
  (moku-web conventions — `data-*`, tokens, `@scope`/`@layer`), re-run; the baseline stays.
- **Intended change** (a deliberate redesign the user approved): update the golden (`test:e2e:update` +
  `:linux`), and call it out in the report. New screens get fresh goldens after you've **eyeballed the first
  render is correct** — never auto-bless an unreviewed first screenshot ("don't assume").

Never blanket `--update-snapshots` to clear red. That converts a regression into a "passing" baseline.

---

## The gate (final App-Build stage — mandatory, skippable-with-confirmation)

Runs after build → validation → **runtime smoke test** (the boot gate). Order: it is the **last
verification** before README/report.

1. **Scope check:** web surface present (else skip with a one-line note — nothing to e2e).
2. **Offer the gate (confirmed skip).** `AskUserQuestion`: *"Run the comprehensive E2E + visual-baseline
   stage now? Every screen/feature gets tested + confirmed in a real browser; bugs/visual issues found are
   fixed."* — options: **"Run it (Recommended)"** · **"Skip — I confirm"** (description: "Ship without
   comprehensive e2e; recorded as skipped"). The skip is a **deliberate, confirmed choice** — never a silent
   default. Record the outcome (run/skipped) in STATE + the build report.
3. **On run:** spawn `web-e2e-tester` (Steps 1–4 above). It scaffolds/extends the suite, runs it, fixes real
   defects, manages baselines, and returns coverage. **The build is not "done" until it returns green with
   full coverage** (or the user confirms a skip).
4. **On skip:** note it prominently in the report ("⚠️ comprehensive E2E skipped by user — N screens
   unverified") so the gap is visible, not silent.

The standalone `/moku:e2e` runs the same Steps 1–4 without the skip offer (the user invoked it to run).

---

## Output (what the gate/command reports)

A coverage table — **every** inventory item × `tested` / `baselined` / `confirmed` — plus the engines/OS
run, the count of defects found **and fixed**, any baselines updated (with why), and the final green/red.
Present **only** when green and fully covered; if red, present the failing items + what's needed, never a
"should work".
