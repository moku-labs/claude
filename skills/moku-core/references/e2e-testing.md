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
| `no-js-errors.spec.ts` | **Boot guard** — no `pageerror`/`console.error` on **every** page+locale; SPA hydration is alive (client nav swaps content without a full reload). Catches the bundle-throws-but-HTML-renders class. |
| `baseline.spec.ts` | **Visual goldens** — `toHaveScreenshot` for every page × locale × desktop **and** mobile (375×812). |
| `navigation.spec.ts` / `links.spec.ts` | Nav + link integrity in **both** SSG and SPA modes; no dead/!=route links. |
| `content.spec.ts` | Feature/content rendering, derived from the fixtures. |
| `seo.spec.ts` | `<title>`/meta/canonical/OG from the single `SITE` source. |
| `build-validation.spec.ts` | The fixture build **emitted** what it should (every expected page/asset/404) — the "everything built is delivered" check across stages. |
| i18n / theming / forms / filters / auth / realtime … | One spec per **app feature** from the inventory. For a worker app, an `api.spec.ts` hitting every `endpoints.ts` route (status, shape, WS) + the served-assets check. |

### `playwright.config.ts` essentials
- `webServer` runs the fixture build+preview; `port` honors `PORT` (so a stale preview on the default port
  can't be tested by accident); `reuseExistingServer: !CI`.
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
pinned image). The e2e build/serve script (`scripts/e2e-server.ts`) and `playwright` + `@playwright/test`
devDeps. Install browsers with `bunx playwright install` (and `--with-deps` in CI).

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
