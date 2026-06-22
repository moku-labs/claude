---
description: Comprehensively e2e-test a Layer-3 web app in a real browser (Playwright) — every screen, feature, and control tested for correct behavior + visual baselines, on desktop and mobile, with browser-console + server errors caught and a modern-UX + responsive review; bugs and UX issues fixed and looped until clean before results are shown. Accepts free-form natural language.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion
argument-hint: (empty = cover everything) or {free-form: a screen/feature to focus} [--update-baselines]
disable-model-invocation: true
---

## Moku Core Specification (authoritative)

Before any decision about architecture, the core API, lifecycle, events, types, or plugin structure — **consult `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/spec-index.md` and open the cited `spec/NN-*.md` file.** For web patterns (the app under test), the **moku-web** skill (`references/project-spec.md`) is authoritative. Never stage or commit `.planning/`.

## Input — natural language first

`$ARGUMENTS` may be **natural language**. Resolve intent per **`${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/nl-args.md`**: empty → cover **everything**; a phrase naming a screen/feature → focus there (but still gap-check the rest); `--update-baselines` (or "update the visual baselines / I redesigned X") → allow deliberate golden updates for intended changes. Echo a one-line `Interpreting as: …` only when NL was interpreted.

## Project Configuration
!`test -f .claude/moku.local.md && head -20 .claude/moku.local.md || true`

Comprehensively **e2e-test** a Layer-3 Moku **web** app and **prove it works** before showing the user anything. Every screen, panel, popup, feature, **and control** is exercised in a **real browser** (Playwright) on **desktop and mobile**, pinned with a **visual baseline**, with **browser-console + server errors** caught and a **modern-UX + responsive** review. **Nothing is assumed** — a functional bug, a behavioral defect, a runtime error, or a real visual/UX regression is **fixed** (and the suite re-run), and it **loops until clean**, not just green. This is the same engine that runs as the final App-Build gate; here it runs **on demand**.

The full process — the suite shape, the frozen fixture corpus, the engine/OS baseline matrix, the determinism knobs, the **"beyond green" error / behavior / UX / mobile checks**, and the confirm-don't-assume protocol — is **`${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/e2e-testing.md`**.

---

## Intent Normalization (Pre-Parse)

- `$ARGUMENTS` empty → **FOCUS = (all)** — cover every screen/feature.
- A phrase naming a screen/feature (e.g. "the settings page", "the filter popup") → **FOCUS = that item**, but still run the gap analysis over the whole app and flag any other uncovered feature (don't silently narrow coverage — the user asked to *test*, and an untested neighbour is still a risk).
- `--update-baselines` anywhere → **UPDATE_BASELINES = true** (deliberate golden refresh for intended changes only — never to clear a real regression).
- Wrong-command detection: if the request is about *building* or *planning* (not testing), point at `/moku:build` / `/moku:plan` and stop.

---

## Step 0: Guards & Scope Gate

1. **Filesystem guard:** the app must be present (a `package.json`). If none → "Not a Moku project — run from the app root." Stop.

2. **Scope gate (web Layer-3).** Playwright is a browser runner — detect a **web surface** the same way `check`/`build` do: a `createApp` import from a web framework (`@moku-labs/web`, or a web-bearing app on `@moku-labs/worker`/`@moku-labs/room`), an `src/index.html` + `src/routes.tsx`, or a built client (`dist/client`). 
   - **Web surface present** → proceed.
   - **No web surface** (pure framework/library, or a non-web app) → decline gracefully: "Nothing to e2e-test — `/moku:e2e` drives a browser, and this project has no web surface. (API-only? Add integration tests via `/moku:build`.)" Stop.

3. **Parse FOCUS / UPDATE_BASELINES** (above).

---

## Route to the tester

Spawn the **`web-e2e-tester`** agent (`Agent` tool) with: APP_ROOT (repo root), `MODE=standalone`, FOCUS, UPDATE_BASELINES, and the INVENTORY_SOURCES to enumerate from — a **design context** if one exists (`.planning/design/*/design-context.md` §6 inventory), the plan/specs (`.planning/specs/*`, `app-spec.md`) + what each build wave delivered, and the app source (`src/routes.tsx`, components/islands/pages, worker `endpoints.ts`). Instruct it to follow `e2e-testing.md` (the concrete template). It loops until clean — functional + **dual-side console/server errors** + **behavioral correctness** of every control — and spawns the **`web-ux-reviewer`** agent for the modern-UX + mobile/responsive pass.

When it returns, **present its coverage report** — but only treat the run as successful if its verdict is **PASS** (suite green AND every inventory item tested + confirmed). If **FAIL**, show the failing screens/features + the fix each needs and offer to continue fixing; do **not** present a "should work". If **PARTIAL** (no web surface, or Playwright/browsers unavailable here), say so plainly and how to enable it (`bunx playwright install`).

---

## Rules

- **Confirm, don't assume.** Never report a screen/feature as working without a real browser run that passed. "I wrote the test" is not "it passes."
- **Comprehensive.** Gap-analyze the **whole** app — every screen/panel/popup/feature, including ones built in earlier stages. An untested feature is a failure, not a deferral.
- **Fix what you find.** Real functional bugs and real visual regressions are **fixed in the app source** (moku-web conventions), then re-verified. Only **intended** visual changes update the goldens (with `--update-baselines`), never to silence red.
- **Per-engine/per-OS baselines.** chromium runs the full suite; webkit + firefox run the visual + boot-guard specs. Update goldens via `test:e2e:update` (local) and `test:e2e:update:linux` (pinned Docker) — never blanket-update to clear failures.
- **Never present red or unverified.** Present results only when green and fully covered; otherwise present the gaps + fixes.
- **Stay in the app; don't commit.** The agent edits app source/tests only. `.planning/` is never committed; `dist-e2e/`/`test-results/`/`playwright-report/` are gitignored artifacts.

## Examples

- `/moku:e2e` — cover **every** screen and feature; run all engines; fix anything broken; report green coverage.
- `/moku:e2e the board filter popup` — focus the filter popup (functional + visual), still gap-check the rest.
- `/moku:e2e --update-baselines` — after an **intended** redesign, refresh the visual goldens (local + Linux) while re-confirming everything passes.
