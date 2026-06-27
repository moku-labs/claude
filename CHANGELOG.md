# Changelog

All notable changes to the Moku Claude Code Plugin will be documented in this file.

## 0.62.3 (2026-06-27)

**Idiom hardening — a non-idiomatic app build can no longer pass silently.** A real Layer-3 app build shipped riddled with non-idiomatic patterns that every validator PASSED, then needed a manual 10-violation refactor. This release turns each of those violations into a specific, checkable rule (exact anti-pattern → idiomatic target, with a spec/reference citation) across the plan-time checkers, the build/verify validators, and the build references — and adds a new app-shape guardrail. Rules are stated abstractly, with no dependence on any specific demo app or incident.

### Added
- **Guardrail I6 — ONE worker app; no facade.** `moku-idioms.md` gains `§I6`: a worker backend is a single `@moku-labs/worker` `createApp` composing resource plugins + the runtime plugin (own `createPlugin` or a framework runtime/hub plugin) + `deploy`/`cli` — the `tracker` `server.ts` shape. Two side-by-side apps for one worker, or a config-only facade app/plugin, is a **BLOCKER**. Enforced in `moku-root-validator`, `moku-plan-checker`, `brainstorm-challenger`, `structural-conformance.md`, and the app build.
- **Framework-capability verification (hard gate).** Before any composition/deploy decision, confirm the assumed export/generator/CLI/subpath actually exists in the installed package (`exports` + `dist`/types) — never assume from memory or a spec doc. Added to `build-app.md` Step 2, `build-framework.md`, and the `/moku:plan` app flow (and checked at plan time by `moku-plan-checker` / `brainstorm-challenger`).
- **Reference-app structural-conformance gate (app build).** `build-app.md` Step 5 Group C + new Step 5.5: a hard gate comparing the output against the nearest reference app (`tracker` full-stack / `blog` web-content) per axis — app composition, components, islands, lib, scripts, config placement, fonts, route selection, runtime data — FAILing on divergence.
- **New validator checks.** `moku-web-validator §10–§14`: flat components (no folder-per-component), islands own zero CSS + right-sized + one-per-screen-concern, vendored fonts (no CDN `<link>`), route/role via `ctx.params` (no hand-parsed `location.pathname`), runtime app data via the data/content layer (not `public/`). `moku-plugin-spec-validator §17`: no per-plugin `config.ts` (config declared inline in `index.ts`). `moku-root-validator`: the lib-vs-plugin boundary (stateful/lifecycle/event code is a plugin, not a `lib/` helper) + committed `scripts/` = build/dev/deploy triad only.
- **Release-dispatch discipline (`ci-release.md`).** Confirm the change is merged to `origin/main` and the working tree matches BEFORE dispatching publish (the workflow releases from `origin/main`, not your local tree); watch the run; then verify the published artifact's **contents** (not just its version) before any consumer adopts it. Added as rule 9 + a dedicated section + a gotcha.

### Changed
- Propagated the app-shape guardrail count `I1–I5 → I1–I6` across `/moku:verify`, `moku-validation-coordinator`, `moku-idioms.md`, and `structural-conformance.md`; the I2 facade / duplicate-same-runtime subcase is now a **BLOCKER** (was WARNING).
- `moku-plugin` and `moku-web` skills gained the matching authoring-time anti-patterns (no per-plugin `config.ts`; flat components, zero island CSS, vendored fonts, `ctx.params` routing, runtime data off `public/`) so the build avoids them at authoring time, not just the validator catching them after.
- Version bumped to 0.62.3 in plugin.json and marketplace.json.

## 0.62.2 (2026-06-26)

**Moku-family knowledge sync — `/moku:moku-sync` across web, worker, and room.** Brought every moku-family framework's skill + plugin index in step with its latest upstream release: web `2.0.1 → 2.2.2`, worker `0.11.0 → 0.15.0`, room `0.1.1 → 0.2.0` (core already current at `1.5.0`). This finished an in-progress sync whose `knownVersion` stamps were bumped but whose skill content + provenance lagged, advanced web past it to the newest upstream, and fully regenerated room for its breaking `0.1.x → 0.2.0` re-architecture.

### Changed
- **`@moku-labs/web` → 2.2.2.** `createChannel` gained a `shouldReconnect?(event)` guard (suppress reconnect on terminal close codes like `4401`); folded in the 2.1.0–2.2.0 SPA additions (module-level `navigate`/`hardNavigate`, per-route `.transition()`/`.scroll()`, `createChannel`). Skill API form + plugin-index headers + provenance brought current.
- **`@moku-labs/worker` → 0.15.0.** Documented `endpoint.new(guard)` request guards (typed context enrichment, 0.15.0) and the `deploy --delete` teardown (`deploy.destroy()`, 0.13.0). Registry/provenance now record the breaking **0.12.0 stage-plugin removal** (stage is plain global config — `config.stage` / `ctx.global.stage`) and the `@moku-labs/common` bump to `0.3.0` — the family is **no longer lockstep on common** (web/room stay on `0.2.1`).
- **`@moku-labs/room` → 0.2.0 — fully regenerated for a breaking re-architecture.** Room moved from a plugin-pack spread into a `@moku-labs/web` app to a **standalone `@moku-labs/core` framework** you `createApp` from. Registry entry: `role` plugin-pack → framework, `dependsOn` web → core. New plugin-index + skill cover the two cores (client `.` + opt-in `./server` Cloudflare signaling tier), 7 plugins (added `hubPlugin` + the `Hub` Durable Object), 3 signaling adapters (added `serverSignaling`), the dropped `./browser` entry, `session.codeLength`, and the new `room:network-warning "room-evicted"` reason. Catalog generated from the `v0.2.0` tag source (upstream `llms.txt` is stale at the old plugin-pack — "source wins").
- **`upgrade-migrations.md`:** rewrote `moku-room-version` (room no longer depends on web; flags the `0.1.x → 0.2.0` source rewrite) and annotated `moku-worker-version` (0.12.0 stage-plugin removal; current target 0.15.0).
- **Registry + inventory:** bumped `knownVersion` (web 2.2.2, worker 0.15.0, room 0.2.0), refreshed all provenance notes, and updated `SKILL-INVENTORY.md` for the room re-architecture + worker plugin set.
- Version bumped to 0.62.2 in plugin.json and marketplace.json.

### Fixed
- Corrected two stale refs left in the in-progress worker sync: "10 plugins" → "9" (stage plugin removed) and `@moku-labs/common@0.2.1` → `0.3.0`.

## 0.62.1 (2026-06-24)

**One verify — the `/moku-verify` workflow folds into the `/moku:verify` command.** v0.61.0 added the `/moku:verify` root/entrypoint conformance command; v0.62.0 made the separate `moku-verify` dynamic workflow aggressive. The two overlapped heavily (the workflow's fan-out already ran `moku-root-validator`), and the namespaced workflow surfaced as the awkward double-barrelled `/moku:moku-verify`. They are now a single command. `/moku:verify` keeps its root-first idiom focus and absorbs the workflow's full validator fan-out, aggressive verdict, uphold-biased cited skeptic pass, and find→fix→re-verify loop; the `moku-verify.js` workflow is removed.

### Changed
- **`/moku:verify` is the single verification entry point.** Beyond the root/entrypoint idiom check (I1–I5), it now runs the **full validator fan-out** (root, spec, plugin-spec, jsdoc, readable-code, common, type, test, web, architecture) with the **aggressive verdict** (any blocker, ANY warning, or any validator that did not return a verdict ⇒ FAIL; each retried up to 3×), the **uphold-biased cited** skeptic pass (a finding is dropped only on unanimous, cited refutation), and the **find → fix → re-verify loop** (default 3 cycles). New flags `--no-adversarial` and `--skeptics N` join `--report-only` and `--iterations N`.
- **`/moku:init`** no longer copies a per-project verification workflow (step 14b removed) — `/moku:verify` ships with the plugin, available wherever it is enabled.
- Docs realigned to the single command: `README.md` (intro, quickstart, commands table, workflows 3 → 2), `workflows/README.md`, `SKILL-INVENTORY.md` (workflows 3 → 2), and the `moku-skeptic` / `moku-root-validator` agent descriptions plus `moku-idioms.md` / `house-style.md` now point at `/moku:verify`.
- Version bumped to 0.62.1 in plugin.json and marketplace.json.

### Removed
- **`workflows/moku-verify.js`** and its `/moku:moku-verify` slash command — merged into `/moku:verify`.

## 0.62.0 (2026-06-24)

**Aggressive verification — `/moku:moku-verify` flips from pass-biased to surface-and-fix.** The validation pipeline was architecturally built to pass: validators defaulted uncertain findings to WARNING (preamble rule 5), the root-validator treated only **I1** as a hard blocker (I2–I5 were "guidance"), readable-code "never blocked", every validator downgraded a repeated pattern to an "established convention" the moment ≥2 plugins shared it, the adversarial skeptic's default stance was "the finding is wrong" (so a *repeated* mistake got refuted as house style), and the disposition ignored warnings entirely while a crashed validator merely yielded "INCONCLUSIVE". Net effect: real issues became warnings, warnings were ignored, and the few surviving blockers were refuted — the pipeline did almost nothing. 0.62.0 inverts every one of those defaults.

### Changed
- **Disposition is strict.** PASS now requires a fully-clean AND fully-run pipeline: **any blocker, ANY warning, or any validator that did not return a verdict ⇒ FAIL**. Warnings are no longer a free pass; an un-run/crashed validator is a FAIL (the project wasn't fully verified), not a shrugged "INCONCLUSIVE". Each validator is retried up to 3× for a parseable verdict before being counted un-run.
- **The skeptic upholds by default.** The adversarial pass now *upholds* every finding unless a skeptic can **cite** the spec/house-style section that disproves it (or puts it out of scope), and a finding is dropped only on **unanimous, cited** refutation. "≥2 plugins share the pattern → it's a convention → refute" is gone: a repeated mistake is N findings, not a house style (only patterns `house-style.md` *explicitly* lists are exempt). Applied to `moku-skeptic` and the spec / plugin-spec / architecture / common validators' "convention baseline" clauses.
- **Severity promoted to match.** Preamble rule 5 flips from "uncertain ⇒ WARNING, never BLOCKER" to "surface every instance; confident ⇒ BLOCKER; uncertain ⇒ still report — never drop". `moku-root-validator` now blocks on **I1–I5, config-not-in-place (incl. a `makeApp(...)`/factory wrapping `createApp` with no second call site), fat entries, and stray functions** — not just I1. `moku-readable-code-validator` now emits **BLOCKER** for a clear wall-of-text (auto-fixed structure-only).
- **`moku-verify` auto-fixes.** The workflow is now a **find → uphold → fix → re-verify loop** (default 3 cycles; `{iterations:N}` to cap, `{reportOnly:true}` / args `"report-only"` to audit only). Each cycle applies a behaviour-preserving fix for every surviving issue (structural refactors; real gaps — missing tests, stale docs, missing type-guards — get real fixes), runs `tsc`/`lint`/`test`, reverts any regression, and re-validates until clean or the budget is hit.
- **`/moku:verify` command** aligned: I1–I5 / config-not-in-place / fat entries are hard blockers (only the genuine idioms — the legitimate browser/server/SSG split, two frameworks side-by-side, folder-splitting — remain exempt).
- Version bumped to 0.62.0 in plugin.json and marketplace.json.

## 0.61.1 (2026-06-24)

**E2E setup guidance — inline `webServer` by default, not a bespoke server script.** The e2e reference taught builders to scaffold a `scripts/e2e-server.ts` to build + serve the fixture corpus; for the common case that over-engineers the boot. The Playwright `webServer` is now an **inline `command`** composing existing package scripts — `rm -rf .wrangler && bun run dev --seed` for worker apps, `bun run build:e2e && bun run preview` for SSG/SPA. A separate server script is reframed as the documented **exception** — only when the boot needs imperative supervision a shell line can't express (e.g. recovering the Apple-Silicon `workerd` SIGSEGV zombie via the `PW_EXTERNAL_SERVER` path), never scaffolded pre-emptively.

### Changed
- **`e2e-testing.md`:** `webServer` is an inline `command` by default — the fixture-corpus, `playwright.config.ts` essentials, "Scripts to ensure", and hard-won-rules sections all updated; `scripts/e2e-server.ts` is now the exception, not the norm; documents why the `rm -rf .wrangler` clean-DB wipe belongs in the command, not in `seed.sql` (the same seed is the `deploy --seed` production fixture, so a destructive clear would wipe prod).
- **`web-e2e-tester` agent:** scaffolds a `playwright.config.ts` with an inline `webServer.command`, not a bespoke server script.
- Version bumped to 0.61.1 in plugin.json and marketplace.json.

## 0.61.0 (2026-06-24)

**`/moku:verify` — root/entrypoint idiom conformance, enforced and auto-fixed; e2e gains feature-request mode.** Moku's app-shape guardrails **I1–I5** (`moku-idioms.md`) were only checked at *plan* time — at build/verify time nothing inspected the root app-creation files, and `moku-verifier` even *exempts* Layer-3 apps from root-structure checks. That is exactly where agents most often break the framework: dumping logic into routers/entrypoints, generating config instead of declaring it in place, duplicating entrypoints beyond the legitimate browser/server split, and scattering one-off functions. The new **`/moku:verify`** command closes the gap — a whole-project conformance check with a **primary focus on the root/entrypoint files**, that **iterates (default 3 cycles), auto-fixing** toward clean idiomatic code and re-verifying each pass (never committing). Separately, **`/moku:e2e`** can now take a **visual feature request**, build/adjust it in app source, and create its tests + baseline + QA/UX coverage.

### Added
- **`/moku:verify` command** (new — 12th command): orchestrates a find → rank → (adversarially verify) → fix → re-verify loop (default 3 cycles, `--iterations N`, `--report-only`). Reuses the existing read-only validators and adds the missing root coverage; applies structure-only refactors (extract logic out of entries → relocate stray functions → collapse gratuitous entrypoints → config-in-place → drop a Layer-3 `@moku-labs/core` dep), re-verifying with `tsc`/`lint`/`test`.
- **`moku-root-validator` agent** (new — 28th agent, 11th validator): the build/verify-time idiom finder. Read-only; detects project kind (L2 framework / L3 web / L3 worker / full-stack), checks **I1–I5** + root-file conventions (`app.ts`/`spa.tsx`/`routes.tsx`/`config.ts`, `server.ts`/`cloudflare/worker.ts`, framework `src/index.ts`) + skeleton/config rules, grounded in `moku-idioms.md` + `skeleton-conventions.md`. Has a loud false-positive guard: NEVER flags the legitimate multi-`createApp` browser/server split, two frameworks side-by-side, or folder-splitting; only **I1** is a hard BLOCKER.
- **`structural-conformance.md` reference**: the `/moku:verify` detection + fix-recipe + 3-cycle-loop protocol (the verify counterpart to `e2e-testing.md`).
- **`e2e-testing.md` → "Feature-request mode" section:** given a visual feature to build/change — scope it (large multi-plugin → `/moku:build`), ground it in the design context, implement/adjust in moku-web source, add it to the inventory, cover + baseline it (eyeball the first golden), then run the beyond-green + human-QA + UX/mobile passes and loop until clean.

### Changed
- **`/moku:e2e` command + `web-e2e-tester` agent:** accept an optional `FEATURE_REQUEST` (verbs add/build/create/implement/make/redesign) — build/adjust the feature *first*, then cover it. A focused visual feature is in scope; a large multi-plugin feature is pointed at `/moku:build`.
- **`moku-verify` workflow + `validation-coordinator` agent:** run `moku-root-validator` in the parallel fan-out so the broad pipeline gains root/app-shape coverage too.
- **`moku-idioms.md` → "How the validators report it":** I1–I5 are now enforced at **build/verify time** (`moku-root-validator` / `/moku:verify`), not just at plan time.
- **SKILL-INVENTORY.md:** commands 11 → 12, agents 27 → 28 (validators 10 → 11).
- Version bumped to 0.61.0 in plugin.json and marketplace.json.

## 0.60.1 (2026-06-24)

**README refresh — design + e2e and the rest of the roster.** The front page had drifted to `0.47.0`; it now documents the `/moku:design` and `/moku:e2e` commands, the Design and Browser-QA agent groups, and the `moku-common` / `moku-room` / `moku-worker` skills, with every count and badge brought current.

### Changed
- **README — commands:** document `/moku:design` (multi-round, human-in-the-loop concept exploration → a reusable `design-context.md`) and `/moku:e2e` (comprehensive real-browser Playwright QA + visual baselines + UX/mobile) across the commands table, workflow diagram, and quick-start steps (now 11 commands).
- **README — agents:** add the **Design** (`design-generator` / `design-critic` / `design-synthesizer`) and **Browser QA** (`web-e2e-tester` / `web-qa-explorer` / `web-ux-reviewer`) groups plus `moku-common-validator` (now 27 agents).
- **README — skills:** add `moku-common`, `moku-room`, and `moku-worker` (now 11 skills).
- **README — figures:** refresh stale badges and counts (version, changelog size → 204 kB, hook scripts 21 → 22) and drop the now-inaccurate "233-word run-on `plugin.json`" line.
- Version bumped to 0.60.1 in plugin.json and marketplace.json.

## 0.60.0 (2026-06-22)

**E2E becomes human-QA: explore the whole experience, judge it reliably, and improve it.** A new **`web-qa-explorer`** agent tests like a skilled manual QA — exploring with **charters** + themed **tours** + a layered **oracle** ladder (incl. FEW HICCUPPS consistency oracles) to find what the scripted suite never covered, naming the oracle each finding violates, and turning confirmed bugs into **durable committed regression tests**. The gate now runs an **explore → judge → improve → verify → regress** loop across three complementary roles (tester + explorer + experience judge), governed by a research-backed **reliability discipline** that keeps "improve everything" from hallucinating.

### Added
- **`web-qa-explorer` agent** (new): human-QA exploratory testing — **charters** ("Explore X with Y to discover Z"), **SFDIPOT** coverage, themed **tours** (FedEx / Saboteur / OCD / Supermodel / Antisocial / Rained-Out…), and a **layered oracle ladder** (implicit console/network → accessibility-vs-rendered → invariants / metamorphic → visual → **FEW HICCUPPS** consistency oracles; surprise as an oracle). Grounds every finding in a citable artifact, drives the accessibility tree, and writes durable role/text-locator regression tests.
- **`e2e-testing.md` → "Human-QA & whole-experience" section:** the three-role loop (tester / explorer / experience judge, kept separate to avoid self-rubber-stamping), persona- & journey-based evaluation (first-time / power / screen-reader / mobile-on-the-go; cognitive-walkthrough questions), and the **reliability discipline** — evidence-grounding (no citation → discard), a deterministic floor (axe + measured geometry/contrast), comparative-not-absolute judging, propose-vs-apply, a design-token allow-list, and independent verification of blockers.

### Changed
- **`web-ux-reviewer` agent:** gains a "Judge reliably" discipline (evidence-or-it-didn't-happen, deterministic floor, comparative judging, no-change-without-a-citation + snap-to-design-tokens, severity × confidence gate) and an explicit persona/journey lens.
- **`web-e2e-tester` agent:** its loop now spawns **both** `web-qa-explorer` and `web-ux-reviewer`, keeps the explorer's durable regression tests, and enforces the reliability discipline (a finding needs a citable artifact + a named oracle; only standards-grounded, reversible changes are applied).
- **`/moku:e2e` command + `build-app.md` Step 7.5:** describe the human-QA explore → judge → improve → verify → regress loop.
- **SKILL-INVENTORY.md:** agent count 26 → 27; the E2E section now lists three agents.
- Version bumped to 0.60.0 in plugin.json and marketplace.json.

## 0.59.0 (2026-06-22)

**The E2E gate now tests behavior, errors, UX, and mobile — and loops until clean.** A green suite is no longer sufficient: the gate also captures **browser-console + server-side errors** on every interaction, verifies **every control behaves as specified** (a control-level catalog with weird/dead/off-reference detection), runs a **modern-UX + mobile/responsive review** (a new agent) that applies the clear wins and proposes the rest, exercises **every screen on mobile**, and **loops run→capture→review→fix→re-run until a full pass finds nothing new**.

### Added
- **`web-ux-reviewer` agent** (new): a modern-UX-taste + responsive/mobile expert that drives the real app on desktop **and** mobile, judges each screen/flow/control against modern UX heuristics + the design context, flags questionable behavior, applies the clear low-risk wins (moku-web conventions), and proposes the subjective/larger ones.
- **`e2e-testing.md` → "Beyond green" section:** dual-side error capture (browser `pageErrors`/`consoleMessages`/`requests` + a server stdout/stderr scan), behavioral-correctness checks over a control-level inventory, the UX + mobile review phase, mobile-first requirements (≥ 375×812 plus ~320/~430, touch, tap targets ≥ 44px, no overflow), and a loop-until-clean exit condition.
- **Control catalog** (Comprehensive coverage, Step 1): the feature inventory now enumerates every interactive control + how each should behave.

### Changed
- **`web-e2e-tester` agent:** gains the `Agent` tool and orchestrates the full loop — dual-side error capture (rule 1), control-level behavioral correctness (rule 2), and a loop-until-clean that spawns `web-ux-reviewer` for the UX/mobile pass (rule 5); workflow + output updated for desktop+mobile and the UX/mobile findings.
- **`/moku:e2e` command + `build-app.md` Step 7.5:** scope/descriptions updated for the behavior / error / UX / mobile + loop-until-clean process.
- **SKILL-INVENTORY.md:** agent count 25 → 26; the E2E section now lists both e2e agents.
- Version bumped to 0.59.0 in plugin.json and marketplace.json.

## 0.58.0 (2026-06-22)

**Overhauled the comprehensive E2E + visual-baseline gate for the latest Playwright (≥ 1.61) and agentic testing.** `e2e-testing.md` — the authoritative process behind the App-Build E2E gate and `/moku:e2e` — now pins a current Playwright (an outdated Playwright on Node 24 deadlocks the test runner), prescribes the latest assertion APIs, gains a research-backed agentic-authoring section (Playwright Test Agents + the two MCP servers), captures the hard-won gotchas, and adds a **design-fidelity** requirement: when a design context exists, the gate checks every screen against it and fixes the implementation to get as close as possible to the intended design.

### Added
- **`e2e-testing.md` → Toolchain section:** pin `@playwright/test`/`playwright` at `^1.61` (Docker `v1.61.0-noble`) first — an outdated Playwright on Node 24 deadlocks the runner (0% CPU, no output), so an old pin won't even start.
- **`e2e-testing.md` → Agentic authoring section:** the Playwright Test Agents (`init-agents --loop=claude`: planner → generator → healer, with the generator validating locators live), the `@playwright/mcp` vs `playwright-test` MCP distinction, an agentic-capability catalog (ARIA-snapshot perception, `locator.normalize()`, GUI-less `--debug=cli`/`trace`, cheap `--last-failed`/`--only-changed` heal loops), and the audit→fix→re-capture loop.
- **`e2e-testing.md` → Hard-won rules section:** the `bun run dev` PATH fix, `networkidle`-vs-WebSocket, full-URL `waitForURL`, `fullPage:false` for fixed overlays, ESLint generated-dir ignores, `wrangler.jsonc` regen, `test-results` wipe, format-only sign-in, strict-mode multi-match.
- **Latest-feature techniques + a new `a11y.spec.ts`** in the spec catalog: `expect.soft`, `page.clock`, `emulateMedia`, `routeWebSocket`, `dragTo`/`drop`, `localStorage`/`sessionStorage`, `addLocatorHandler`, enhanced screenshots; an `@axe-core/playwright` WCAG scan + ARIA snapshots + accessibility assertions.
- **Design-fidelity requirement** (Prime directive #5 + `web-e2e-tester` rule + the audit loop): when `.planning/design/{slug}/design-context.md` exists, check each screen against it and fix the implementation to match as closely as possible.

### Changed
- **`playwright.config.ts` essentials:** `PW_EXTERNAL_SERVER` opt-out (reuse a running seeded server), `webServer.wait` boot detection, `trace: "on-first-retry"`.
- **`build-app.md` Step 7.5 + the `web-e2e-tester` agent:** reference the Playwright `^1.61` pin and the design-context fidelity check.
- Version bumped to 0.58.0 in plugin.json and marketplace.json.

## 0.57.0 (2026-06-21)

**Flag the `createApp` entry-point wrapper anti-pattern.** A Layer-2 framework that wraps the core-bound `createApp` / `createPlugin` in `: typeof <private> = options =>` with body casts (to inject core-plugin config) violates R6 (inline assertions) + R9 (`Record<string, unknown>` widened then cast) at the framework's front door, and hides the public signature behind `typeof` of a private const. Validators now catch it and steer authors to the plain `createApp = framework.createApp` re-export, with core-plugin defaults seeded at `createCoreConfig` (the `@moku-labs/web` pattern).

### Added
- **`moku-type-validator`** Check 2.6 (BLOCKER, R6+R9): flags an `export const createApp: typeof <private> = options =>` wrapper with body casts; allowlists the plain binding re-export and a cast-free explicitly-typed function.
- **`moku-readable-code-validator`** flag #8 (WARNING): flags an opaque public entry signature hidden behind `typeof` of a private const; exempts the plain re-export.

## 0.56.0 (2026-06-21)

**Synced `moku-worker` skill knowledge to `@moku-labs/worker@0.11.0`** (`moku-sync`; was 0.9.2). The `0.9.2 → 0.11.0` delta is the `./cli` subpath removal — `deployPlugin`/`cliPlugin` + the deploy manifest types (`ExternalManifest`/`ResourceManifest`) now ship only from the package root — plus docs/branding. No plugin/API/event/config change (still 10 plugins, same set).

### Changed
- **`skills/moku-worker/SKILL.md` + `references/plugin-index.md`** regenerated for 0.11.0: synced-version stamps bumped, all `@moku-labs/worker/cli` references dropped (entry-points table is now the single `.` entry; the plugin table + dependency graph drop the `./cli` alias).
- **`moku-frameworks.md`** registry: `worker.knownVersion` `0.9.2 → 0.11.0` + a 0.11.0 provenance note.

## 0.55.0 (2026-06-21)

**Enforce the Layer-2 `src/` root structure rule post-build.** The "root = `config.ts` + `index.ts` + justified entry points only" constraint was previously enforced only at *plan* time, so a framework could drift after planning (e.g. a loose `src/instances.ts` / `src/env-provider.ts` helper, or a non-plugin folder, added during a build). It is now re-checked against the real `src/` filesystem.

### Added
- **`moku-verifier`** Level 1 (EXISTS) now runs a deterministic `src/` root cleanliness check for frameworks: the root may contain ONLY `config.ts`, `index.ts`, `plugins/`, and entry-point files declared as `package.json` `exports` subpaths. A loose helper file or a non-plugin folder (`src/lib|internal|shared|utils|services|helpers/`) at root is a BLOCKER (`rule: "structure — src/ root"`). Layer-3 consumer apps are exempt.
- **`moku-spec-validator`** gains check §9 "Framework Structure (src/ root)" — the same rule as a spec-compliance finding, with the cross-plugin-helper fix guidance (co-locate in the owning plugin, or promote it to its own plugin).

### Changed
- **`plan-stages.md` §Structure Constraints** tightened: explicitly forbids loose helper *files* (not just folders) at `src/` root, names the cross-plugin-shared-helper homes (owning plugin / own plugin / publicly re-exported root module), adds `src/lib|internal|shared/` to the banned-folder list, and requires extra root entry points to be real `package.json` `exports` subpaths. Notes the post-build re-check.

## 0.54.0 (2026-06-21)

**Synced the vendored Moku Core spec + all family framework knowledge to the `@moku-labs/core@1.5.0`
release line** (`spec-sync` + `moku-sync`). Re-pinned the vendored spec/sandbox `v0.1.3` → `v1.5.0`
(commit `09affbb`) and refreshed every framework's teaching material against its latest npm release.

### Changed
- **Core spec re-vendored to `v1.5.0`:** `08-CONTEXT.md` `require()` clarification (core-plugin
  instances resolve via the shared lookup map), and the `components → islands` SPA-exemplar rename in
  the sandbox (`demo/blog/islands/*`); `spec-index.md` + `sandbox-index.md` re-pinned to `09affbb`.
  `moku-core` `knownVersion` `0.1.4` → `1.5.0` (no API change — `src/index.ts` byte-identical; the
  whole family now pins `@moku-labs/core@1.5.0`).
- **`moku-web` `2.0.0` → `2.0.1`:** dep-only release — now pins `@moku-labs/core@1.5.0` +
  `@moku-labs/common@0.2.1`; plugin catalog/API byte-identical.
- **`moku-worker` `0.4.0` → `0.9.2`:** major catalog regeneration from the `v0.9.2` tarball/tag source
  (upstream `llms.txt` is stale at `0.1.0`). Breaking **keyed-map resource config** (v0.7.0:
  kv/d1/queues/storage/durableObjects take `Record<key, instance>` + `app.<kind>.use("key")`);
  deploy/cli at package root with a structured `DeployReport`; `createApp` gained
  `onReady`/`onError`/`onStart`/`onStop`; 6 new `WorkerEvents` (`provision:*`, `auth:verified`,
  `dev:*`). The `moku-worker-version` migration now flags the 0.7.0 config boundary.
- Version bumped to 0.54.0 in plugin.json and marketplace.json.

## 0.53.0 (2026-06-21)

**Synced the `moku-web` skill to `@moku-labs/web@2.0.0`.** The SPA authoring API was renamed
`createComponent` → `createIsland` (a breaking major): `Component*` types → `Island*`, the
`data-component` attribute → `data-island`, `spa:component-*` events → `spa:island-*`,
`ctx.component()` / `app.spa.component()` → `.island()`, and config `spa.components` → `spa.islands`
(Preact components — `GalleryComponent`, `h(Component)`, the content `gallery.component` option —
are untouched). Bumped the framework registry `knownVersion` (`1.12.4` → `2.0.0`) so `/moku:upgrade`
now bumps consumers to web 2.0.0, and added the 1.x → 2.0.0 island-rename codemod to the
`moku-web-version` migration.

## 0.52.1 (2026-06-21)

**New `moku-readme` skill — the moku-labs main-README house style.** Captures how the family's repo
front pages (`common` / `web` / `claude`) are written, and wires it into the build flow's root-doc waves
so generated READMEs match the family look.

### Added
- **`moku-readme` skill** — the authoritative house style for root/main READMEs across the moku-labs
  family: masthead anatomy (H1 → tagline → what-it-is-*not* paragraph → brand-colored badge row → nav
  line), the section menu by repo shape (library / framework / toolkit / consumer app), voice rules, the
  badge + mermaid palettes, GitHub-callout conventions, and a 13-point authoring checklist. Ships
  `references/template.md` (copy-paste annotated skeleton + shape deltas) and `references/exemplars.md`
  (the three live READMEs distilled side by side).

### Changed
- **Build flow now defers to `moku-readme` for root-README form.** `build-final.md` Step 5.6 (Root README)
  and `build-app.md` Step 8 reference the skill for house style (masthead, palettes, table-centric body),
  keeping their existing content checklists; app READMEs use the consumer-app shape.
- Listed `moku-readme` in the plugin README's Skills table.
- Version bumped to 0.52.1 in plugin.json and marketplace.json.

## 0.52.0 (2026-06-20)

**Comprehensive E2E + visual-baseline testing for Layer-3 web apps.** Every screen and feature is now
proven to work in a **real browser** (Playwright) with **visual baselines** — as
the final App-Build gate and as a standalone command. Confirm, don't assume: bugs and visual regressions
found are **fixed** before any result is shown.

### Added
- **`/moku:e2e` command** — comprehensively e2e-test a web app on demand: enumerate every screen/feature,
  close coverage gaps, run the suite in a real browser, fix what's broken, and report green coverage. Web
  scope-gated; accepts a focus target + `--update-baselines`.
- **`web-e2e-tester` agent** (`moku-web-e2e-tester`) — builds the full feature inventory (from a design
  context §6 / specs / app source), **gap-analyzes the whole app** (incl. features built in earlier waves),
  scaffolds/extends the Playwright suite + frozen fixture corpus + per-engine/per-OS visual baselines,
  **runs it for real**, **fixes every functional bug / visual regression** in app source, and only returns
  `PASS` when green with full coverage. Bounded fix loop; never blanket-updates baselines.
- **`e2e-testing.md` reference** — the self-contained, concrete process: frozen fixture corpus, the spec
  catalog (`no-js-errors`/`baseline`/`build-validation`/`navigation`/`links`/`seo`/…), the engine matrix
  (chromium full; webkit+firefox visual+boot-guard), visual determinism knobs (clock freeze, fonts-ready,
  animations off, `maxDiffPixelRatio` 0.02), per-engine/per-OS goldens (local + pinned-Docker Linux), and
  the baseline policy (real regression → fix app; intended change → deliberate update).

### Changed
- **App Build gains a final E2E gate (`build-app.md` Step 7.5).** After the runtime smoke test, the
  comprehensive E2E + visual stage runs as the **last verification** — **mandatory but skippable only with
  an explicit, confirmed skip** (recorded prominently in the report, never silent). The build is not "done"
  until the suite is green with full coverage (or a confirmed skip). Wired into `build.md` (App Build flow +
  key rule) and surfaced in `init.md` (Consumer App next steps).
- `SKILL-INVENTORY.md` — commands 10 → 11, agents 24 → 25 (new E2E group), reference set 50 → 51.
- Version bumped to 0.52.0 in plugin.json and marketplace.json.

## 0.51.0 (2026-06-20)

**`moku-sync` of the new frameworks — real catalogs for `worker` + `room`.** The `worker`/`room` skills
(registered as stubs in 0.50.0) are now generated from their published packages, and `room` is
re-classified as a **plugin pack** (it is not a framework).

### Changed
- **`moku-sync` worker `0.0.0 → 0.4.0`** — `skills/moku-worker/` SKILL + `plugin-index.md` regenerated from
  `@moku-labs/worker@0.4.0`: the full **10-plugin** catalog (`bindings`, `server`, `kv`, `d1`, `queues`,
  `storage`, `durableObjects`, `stage` runtime + node-only `deploy`/`cli`), `WorkerConfig` + per-plugin
  config, the request/deploy events, the dependency graph, and the runtime-vs-`./cli` bundle boundary.
- **`moku-sync` room `0.0.0 → 0.1.1`**, and **re-classified `role: framework → plugin-pack`** — room has no
  Layer-2 shell and never calls `createApp`; you spread `roomPlugins.stage` / `.controller` into a
  `@moku-labs/web` app. `skills/moku-room/` regenerated: **6 plugins** (4 engines + 2 role facades),
  config, the 5 `room:*` lifecycle events, the Wire-vs-events split, signaling adapters, dependency graph.
- Registry `knownVersion` stamped (worker `0.4.0`, room `0.1.1`) — the `moku-worker-version` /
  `moku-room-version` upgrade migrations now fire against the real versions. Catalogs were generated from
  the published **npm tarball READMEs** (npm `latest` was ahead of GitHub `main`, still at 0.1.0).
- Version bumped to 0.51.0 in plugin.json and marketplace.json.

## 0.50.0 (2026-06-20)

**Idiomatic app-shape guard + three new Moku-family members.** (1) A concrete architecture-shape rubric so
`/moku:brainstorm` and `/moku:plan` stop handing back non-idiomatic app structures — grounded in the real
`demos/tracker` full-stack app. (2) The `worker` and `room` frameworks registered in the family registry,
plus a Reference Projects index pointing at `demos/tracker` as the app-shape authority.

### Added
- **`moku-idioms.md`** — the idiomatic app-shape rubric (I1–I5), worked reference `demos/tracker`. The one
  hard rule (**I1**, BLOCKER): a Layer-3 app **composes** (`createApp`) and must not **define** a framework
  (no `createCoreConfig`/`createCore`, no direct `@moku-labs/core` dep). It explicitly **blesses** the
  full-stack idioms the demo proves — **multiple `createApp` instances**, **composing multiple frameworks
  side-by-side** (`@moku-labs/web` + `@moku-labs/worker`), and **folder splits** — so the validators never
  false-flag them. Enforced by `moku-plan-checker` (check #10, BLOCKER-triaged before every plan gate) and
  `brainstorm-challenger` (mandatory check each debate round), with app-shape gates in `brainstorm.md` /
  `plan.md` that block only on the I1 violation.
- **`worker` + `room` frameworks** registered in `moku-frameworks.md` (`@moku-labs/worker` — Cloudflare
  Workers backend: Durable Objects, Queues, R2, D1, KV; `@moku-labs/room` — couch-multiplayer on
  `@moku-labs/web`), with `/moku:upgrade` migrations (`moku-worker-version`, `moku-room-version`) and
  `skills/moku-worker/` + `skills/moku-room/` stubs. `knownVersion: "0.0.0"` (never-synced sentinel) — run
  `moku-sync worker` / `moku-sync room` to generate the real catalogs and stamp versions (latest at
  registration: worker 0.4.0, room 0.1.1).
- **Reference Projects** index in `moku-frameworks.md` — the public full-stack example app
  (`github.com/moku-labs/demos`) as a worked app-shape reference. Wired into App Build (`build-app.md`):
  read `demos/tracker` before inventing an app structure.

### Changed
- `moku-plan-checker` + `brainstorm-challenger` gain the Idiomatic Architecture check; `brainstorm.md` and
  `plan.md` gain app-shape gates (block only on the I1 violation — never on multiple instances/frameworks/
  folders, which are idiomatic).
- `SKILL-INVENTORY.md` — skills 8 → 10 (worker/room stubs), reference set 49 → 50 (`moku-idioms.md`) + the
  Reference Projects note.
- Version bumped to 0.50.0 in plugin.json and marketplace.json.

## 0.49.0 (2026-06-20)

**New `/moku:design` command — human-in-the-loop design exploration that produces a reusable design
context (a spec, not source).** A multi-round process: frame the target (whole app, one page, or a single
element), generate N distinct concept prototypes in parallel, converge on a winner, polish it in a live
browser preview, then capture a non-technical `design-context.md` with an exhaustive screen/element
inventory. The design context grounds the rest of the workflow (`brainstorm` → `plan` → `build`) — and a
hard, repeated principle is wired through every layer: **the prototype is throwaway demo code; downstream
agents re-implement it from scratch on the real stack with all plugin conventions, and never copy it.**

### Added
- **`commands/design.md`** — the orchestrator: NL intent normalization (target/scope/medium + `--count`,
  `--rounds`, `--medium`, `resume`, `list`), per-design isolation under `.planning/design/{slug}/`, a scope
  gate that declines non-UI projects (or switches to a CLI/TUI/DX surface), atomic resumable per-design
  state, and human gates at every round pick / polish / capture. `disable-model-invocation: true`. Loads
  the official `frontend-design` skill at the start of a run as a quality lever, and always serves a live
  preview (internal browser + screenshots when available, else a local static-server port).
- **Agents** — `design-generator` (builds one self-contained concept prototype in parallel, invokes
  `frontend-design`, strict single-file isolation), `design-synthesizer` (writes `design-context.md`,
  always emitting the verbatim "spec, not source" callout + an exhaustive inventory), and `design-critic`
  (read-only round critique: coverage / distinctiveness / fit).
- **Reference docs** — `design-flow.md` (phases A–E, gates, rounds loop, availability-aware preview chain),
  `design-stages.md` (per-design STATE schema + registry + resume table), `design-context-template.md`
  (the tracker-v2-derived template, opening with the mandatory callout), `design-medium.md` (scope gate +
  web/cli/tui branching).
- **Runtime smoke-test delivery gate for app builds** — `build-app.md` Step 7: the documented run command
  must boot from a clean state and serve its primary surface before an app is declared done (catches
  runtime-only failures that mocked tests miss).
- **`web-validator` link check (Rule R2)** — flags hardcoded internal URL literals; internal links must be
  built from the route map's `urls` builder / `ctx.url(...)`. Documented in moku-web `SKILL.md` +
  `project-spec.md`.

### Changed
- **Spec-not-source carry-through wired into `plan` and `build`** — when a design context grounds a plan,
  the re-implement-from-scratch instruction is forwarded into the generated specs and any spawned planning
  agent; the builders (App + Plugin) carry it into every builder prompt. The demo prototype is never copied
  or ported 1:1.
- **`brainstorm` / `plan` design-context detection** — both offer to ground their work in a matching
  `.planning/design/{slug}/design-context.md`; `init` lists `/moku:design` as a next step for UI apps.
- **Plugin + marketplace description trimmed to two sentences** (now naming the design step in the
  brainstorm → design → plan → build pipeline).
- **`SKILL-INVENTORY.md`** — commands 9 → 10, agents 21 → 24 (new Design group), reference set 45 → 49.
- Version bumped to 0.49.0 in plugin.json and marketplace.json.

## 0.48.1 (2026-06-19)

**MC3 `// @env-allow` exemption.** The `validate-common-usage.sh` PreToolUse hook now honors a
`// @env-allow` inline marker on a `process.env` line, so a legitimate passthrough (e.g. spreading
`process.env` into a spawned subprocess) is no longer blocked — mirroring the `// @log-sink` escape
hatch for MC2. Documented in the `moku-common` conventions reference.

## 0.48.0 (2026-06-19)

**Enforce the `@moku-labs/common` family conventions, plus a new R9 type-first rule.** The Moku
family is standardizing how projects consume the shared `@moku-labs/common` package: render CLI
output through the branded kit (`@moku-labs/common/cli`), log via `ctx.log` (not raw `console.*`),
and read env via `ctx.env` (not raw `process.env`). This release ships the skill, the citable rule
set, a validator, and a conservative PreToolUse hook that enforces it — and wires it into
scaffolding so new projects are compliant by construction. These are family conventions (how
projects consume the common package), separate from the upstream Moku Core invariants R1–R8. It also
adds **R9**, a new Moku Core code rule that bans lazy `unknown` / `Record<string, unknown>` where the
shape is knowable.

### Added
- **R9 — type-first rule: no lazy `unknown` / `any` / `Record<string, unknown>` for a knowable
  shape.** New Moku Code Rule in `agent-preamble.md`. When a value's shape is derivable from a known
  contract — a DB row (the SQL schema *is* the type), a parsed API/queue/config payload, a parameter
  with fixed callers, a framework export like `WorkerEnv` or `Router.LayoutContext` — declare and use
  that type instead of widening to `unknown`/`Record<string, unknown>` and casting field-by-field.
  `unknown` stays allowed at genuine dynamic boundaries (narrowed immediately) and for
  `as unknown as <ExternalType>` partial test mocks. Derives from `spec/09-TYPE-SYSTEM.md`'s "full
  inference, zero casts" philosophy; complements R6 (no inline assertions) and R7 (no `as any`).
  BLOCKER when the shape is knowable.
  - `moku-type-validator` gains a dedicated audit (Check 2.5) for the *annotation* form that `tsc` and
    lint both miss — the prior assertion audit only caught `as any` / `as unknown` casts, which is why
    a `Record<string, unknown>`-heavy plugin could pass type validation cleanly.
  - `type-system.md` documents the derive-the-shape patterns (DB row types, narrow-at-boundary).
  - `builder`, `code-reviewer`, `verifier`, `spec-validator`, `architecture-validator`, and the
    multi-pass review now cite R1–R9.
- **`skills/moku-common/SKILL.md`** — new skill documenting `@moku-labs/common`: the branded CLI kit,
  `logPlugin`/`ctx.log`, `envPlugin`/`ctx.env`, with framework wiring examples
  (`createCoreConfig` composes `logPlugin`+`envPlugin`) and an Anti-Patterns section. Triggers on
  "moku common", "branded cli", "ctx.log", "ctx.env", "@moku-labs/common", etc.
- **`skills/moku-common/references/conventions.md`** — the authoritative, citable rules with stable
  IDs (**MC1** branded CLI, **MC2** `ctx.log` not `console.*`, **MC3** `ctx.env` not `process.env`),
  each with rationale, a correct/incorrect example, detection guidance, and the allowed exceptions
  (brand-kit source, a `// @log-sink`-marked sink, env providers, tests). Repo-owned (outside the
  vendored `spec/` tree, which `spec-sync` regenerates).
- **`agents/moku-common-validator.md`** — validator (model sonnet, tools Read/Grep/Glob) that reads
  `conventions.md` and flags raw `console.*` / `process.env` / hand-rolled CLI chrome in
  plugin/CLI/script source, citing MC IDs and honoring the documented exceptions. Registered in
  Group A of `validation-coordinator` and in the `moku-verify` workflow fan-out.
- **`hooks/validate-common-usage.sh`** — conservative PreToolUse (Write|Edit) hook mirroring
  `check-plugin-antipatterns.sh`: on scoped `.ts` writes (plugins, `*cli*`, `scripts/`) it blocks
  raw `console.*` (MC2) and `process.env` (MC3) with an actionable message, while skipping tests,
  the brand-kit source (`*/common/src/cli/*`), env providers, and `// @log-sink`-marked lines.
  Registered under the existing PreToolUse `Write|Edit` matcher.

### Changed
- **`skills/moku-core/references/house-style.md`** — added a "Family-level conventions" pointer (item
  4) marking the MC1–MC3 rules in `moku-common/references/conventions.md` as approved/required house
  style so other validators don't treat them as a per-project invention.
- **`agents/validation-coordinator.md`** — Group A now spawns 5 agents (added `moku-common-validator`);
  updated the model-assignment table, the per-plugin validator list, and the example results table.
- **`workflows/moku-verify.js`** + **`workflows/README.md`** — added `moku-common-validator` to the
  parallel validator fan-out (focus cites MC IDs, not spec sections).
- **`commands/init.md`** + **`skills/moku-core/references/skeleton-conventions.md`** — scaffolding now
  adds `@moku-labs/common` as a framework dependency, registers `logPlugin`+`envPlugin` in
  `createCoreConfig` (with the required `CorePlugins` tuple type arg), and documents the MC1–MC3
  family conventions (consumers inherit `ctx.log`/`ctx.env` from the framework).
- **`skills/moku-plugin/SKILL.md`** + **`skills/moku-web/SKILL.md`** — added a `moku-common` pointer
  to their Related Skills sections.

## 0.47.7 (2026-06-19)

**Hard-block `NPM_TOKEN` for npm publish.** 0.47.5/0.47.6 made the OIDC Trusted Publishing flow the
default and documented its setup — but nothing *stopped* an agent that skipped `ci-release.md` from
reinventing the insecure token-based `release.yml` from memory (it happened in the field). The
guidance existed; it wasn't unmissable. This release makes the prohibition explicit and scannable so
the wrong path can't be reached by accident.

### Changed
- **`skills/moku-core/references/ci-release.md`** — added a top-of-file ⛔ banner: NEVER use
  `NPM_TOKEN`/`NODE_AUTH_TOKEN` to publish, with the two reasons it's wrong (insecure long-lived
  secret next to the publish step; and it attaches no provenance / bypasses the Trusted Publisher so
  it doesn't even work for this flow) and the one correct path (the `publish.yml` OIDC job). Rule 4 in
  the non-negotiable rules now names the prohibition explicitly.
- **`skills/moku-core/references/build-final.md`** — Step 5.10's npm-publish block now opens with a ⛔
  STOP callout: open and apply `ci-release.md` verbatim, do NOT generate publish CI from memory, and
  never write `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`.

## 0.47.6 (2026-06-18)

**Document the one-time npm-side setup for OIDC Trusted Publishing.** 0.47.5 fixed the generated
workflows, but the template never told framework authors the *manual* prerequisites — so the first
`publish.yml` run fails auth until they're done. Add the missing human runbook.

### Added
- **`skills/moku-core/references/ci-release.md`** — a "First-time setup (one-time, manual — the
  npm side)" section: confirm the npm org/scope; do a manual **bootstrap publish** of the first
  version (OIDC Trusted Publishing can't be configured for a package that doesn't exist yet, so
  the first publish must be manual + authenticated); **tag** that version (the release workflow
  derives the next version from the latest `v*` tag); and **register the Trusted Publisher** on
  npmjs.com (the package → Settings → Trusted Publisher → GitHub Actions, repo + `publish.yml`).

### Changed
- **`skills/moku-core/references/build-final.md`** — Step 5.10 now instructs the build to surface
  that one-time npm setup to the user immediately after generating the workflows.

## 0.47.5 (2026-06-18)

**Fix the CI/release template — 8 publish-flow bugs every generated framework was hand-patching.**
The `ci-release.md` workflow template and the `tooling-config.md` package.json scaffold shipped bugs
that each Layer-2 framework (`@moku-labs/web`, `@moku-labs/worker`) re-hit and fixed by hand when first
running its release pipeline. Fixed at the source so `/moku:build` Step 5.10 emits correct workflows.
All fixes were proven end-to-end in `moku-labs/worker` (published `@moku-labs/worker@0.1.1` via OIDC
Trusted Publishing with SLSA provenance, plus `0.1.2-rc.0` to `next`, with correct per-release notes).

### Fixed
- **`skills/moku-core/references/ci-release.md`**
  - `ci.yml`: `bun test` → `bun run test` — `bun test` invokes Bun's native runner, which bleeds
    vitest module mocks across files (phantom failures); the project's `test` script is `vitest run`.
  - `publish.yml` concurrency: the reused `ci.yml` (`check`) derives its group from the **caller's**
    `github.workflow` (= "Release"), colliding with the parent's `Release-<ref>` group → the parent
    holds the slot while the child `check` waits → deadlock, reusable workflow never starts. Use a
    distinct `publish-<ref>` group.
  - Release notes: the tag-only model tags each version on a separate bump commit that is **not** an
    ancestor of the next, so `gh release create --generate-notes` can't auto-detect the previous tag
    and lists the **full** history (cumulative notes — every release repeats all prior PRs). Capture
    `prev_tag` and pass `--notes-start-tag` for a correct delta.
  - Prerelease tags get `--prerelease --latest=false` so an `rc` isn't surfaced as the repo's "Latest
    release"; stable tags get `--latest`.
  - `package` job: `mkdir -p dist-pack` before `npm pack` (`--pack-destination` does not create the dir).
  - `publish` job: `npm publish ./dist-pack/*.tgz` — a bare `dist-pack/x.tgz` is parsed by npm as a
    GitHub `owner/repo` spec (`git ls-remote` failure); the leading `./` forces local-file resolution.
  - Artifact actions off node20: `upload-artifact` v4.4.0 → v7.0.1, `download-artifact` v4.1.8 → v8.0.1
    (both node24, `@actions/artifact` v6 backend); rule #1 + the concurrency/notes gotchas updated.
- **`skills/moku-core/references/tooling-config.md`** — add `repository`/`homepage`/`bugs` to the
  package.json scaffold; `repository.url` is **required for npm provenance** (publishing with
  provenance fails `E422` without it).

## 0.47.4 (2026-06-16)

**Sync the `moku-web` skill to `@moku-labs/web@1.12.4`.** web 1.12.4 sources its `log` and `env`
core plugins from the new `@moku-labs/common@0.1.1` catalog (authored in common, re-exported by web;
public API byte-identical). Routine teaching-material sync — no consumer-facing API change.

### Changed
- **`skills/moku-web/SKILL.md`** + **`skills/moku-web/references/plugin-index.md`** — synced version
  `1.12.3` → `1.12.4`; noted that the `log`/`env` core plugins are now authored in
  `@moku-labs/common@0.1.1` and re-exported by web (consumers still use `ctx.log`/`ctx.env` and import
  the env providers from `@moku-labs/web` exactly as before).
- **`skills/moku-core/references/moku-frameworks.md`** — web `knownVersion` `1.12.3` → `1.12.4`.

## 0.47.3 (2026-06-16)

**Encourage & organize Layer-3 (consumer) plugin creation.** The toolkit contradicted the Moku Core
spec on consumer plugins: the spec treats consumer-authored plugins as first-class Layer 3 ("what
custom plugins consumers write themselves — that's Layer 3"), yet `commands/init.md` and the `moku-web`
project spec **forbade** `src/plugins/` in a consumer app while `build-app.md` and the `moku-web` skill
simultaneously **taught** authoring them with `createPlugin`. Root cause: "no core config" and "no
plugins" were flattened into one rule — only the first is true. This release fixes the contradiction
everywhere and tunes the agents so consumer-app plugins are no longer false-blocked. Framing is
**balanced**: consumer plugins are first-class, but a plugin-vs-`lib`-vs-island decision guide keeps web
apps from being over-pluginized. The single source of truth is the new `consumer-plugins.md`.

### Added
- **`skills/moku-core/references/consumer-plugins.md`** — new shared reference (source of truth) for
  Layer-3 consumer plugin authorship: the DOES/does-NOT rule (author via the framework's re-exported
  `createPlugin`; never `createCoreConfig` or a direct `@moku-labs/core` dep), where consumer plugins
  live and wire, the plugin-vs-`lib`-vs-island decision guide, web composition nuance, and quality bar.
- **Optional `src/plugins/` in the web project structure** — added to the `moku-web` project-spec
  directory tree (§2) and the `moku-web` SKILL.md Project Structure quick-view.

### Changed
- **`commands/init.md`** — Consumer App (Layer 3) tree gains an optional `src/plugins/`; the "no
  plugins" prohibition is split into the correct rule (no `src/config.ts` / `createCoreConfig` / direct
  `@moku-labs/core` dep — but consumer plugins ARE allowed); next-steps + Important section reference
  the new doc.
- **`skills/moku-web/references/project-spec.md`** — §1 architecture model, R1, §4 data layer, and §14
  scaffold sequence corrected: authoring custom plugins via the framework's `createPlugin` is allowed
  for plugin-shaped concerns (loaders/`lib`/islands remain the default for data + DOM).
- **`skills/moku-core/references/build-app.md`** & **`plan-stages.md`** — custom plugins framed as a
  first-class plugin-shaped decision with the decision guide; both cross-reference `consumer-plugins.md`.
- **`skills/moku-plugin/SKILL.md`** — broadened triggers (consumer / Layer-3 plugins) + new
  "Framework plugins vs. consumer plugins" section.
- **Agents tuned to stop false-blocking consumer apps** — `architecture-validator` (project-context
  detection; the `src/plugins/index.ts` barrel BLOCKER is now framework-only), `verifier` (consumer
  wiring via `createApp`; no required `src/config.ts`/barrel), `builder` (consumer wiring path + import
  source), `plugin-spec-validator` (barrel optional at Layer 3), `plan-checker` (app-plan plugin-shaped
  coverage check).
- Version bumped to 0.47.3 in plugin.json and marketplace.json.

## 0.47.2 (2026-06-16)

**Sync `moku-web` skill to `@moku-labs/web@1.12.3`.** Web 1.12.3 is a dependency-only release that
bumps `@moku-labs/core` `0.1.3 → 0.1.4` (no `src/` change — the API form, plugin catalog, events, and
exports are identical to 1.12.2). The teaching material is updated to match: version stamps move to
1.12.3 and every "web pins core 0.1.3" fact is corrected to **0.1.4**, so the toolkit now reflects the
family being **lockstep on `@moku-labs/core@0.1.4`** (core, web, and the new common repo all on 0.1.4).

### Changed
- **`skills/moku-core/references/moku-frameworks.md`** — `web` registry `knownVersion` `1.12.2 → 1.12.3`;
  core/web provenance notes record web now pinning core 0.1.4 (lockstep) and the dep-only delta.
- **`skills/moku-web/references/plugin-index.md`** — synced-version stamp → 1.12.3; all four
  `@moku-labs/core` pin facts corrected `0.1.3 → 0.1.4`; API-form + re-verification stamps → 1.12.3.
- **`skills/moku-web/SKILL.md`** — Framework API heading stamp → v1.12.3.
- Version bumped to 0.47.2 in plugin.json and marketplace.json.

## 0.47.1 (2026-06-16)

**Drop bundled TypeScript LSP registration.** Removed `.lsp.json`, which registered a `typescript`
language server for `.ts`/`.tsx`. The dedicated `typescript-lsp` plugin already claims those
extensions, so moku's registration was ignored (Claude Code allows one server per extension) and
surfaced a `/doctor` "LSP server not used" note. Removing it resolves the note. Note: moku projects
that relied on moku for built-in TS LSP should install the `typescript-lsp` plugin.

### Removed
- **`.lsp.json`** — redundant TypeScript language-server registration (superseded by the dedicated
  `typescript-lsp` plugin).

### Changed
- Version bumped to 0.47.1 in plugin.json and marketplace.json.

## 0.47.0 (2026-06-16)

**`moku-web` skill — project specification, rules & recommendations.** Added framework-level
guidance for building **any web-technology project** on `@moku-labs/web` (verified against
`@moku-labs/web@1.12.2`) — static site, SPA/web app, PWA, embeddable widget, documentation portal,
internal tool, dashboard, e-commerce, or content site — so the toolkit can scaffold and build full
projects, not just call the API. The guidance is framework-level (no dependency on any one example
app or external repo): standard structure, hard rules, recommended practices, and a project-type
matrix that adapts the same skeleton across project types.

### Added
- **`skills/moku-web/references/project-spec.md`** (new) — the project **specification**: the
  architecture model (two compositions over one route table), the standard directory structure
  (required vs project-type-conditional), the root-config inventory, the three **data-layer
  strategies** (markdown `content` / custom loaders + `data` / static), routing patterns, rendering
  mode by project type, the UI/i18n/SEO layers, the testing strategy, explicit **Rules (MUST)** +
  **Recommendations (SHOULD)**, a **project-type matrix** (incl. web app/PWA, embeddable widget,
  internal tool, design-system showcase — with minimal compositions), and a 10-step **scaffold
  sequence**.
- **`skills/moku-web/references/deploy-and-ci.md`** (new) — Cloudflare Pages deploy (`wrangler.jsonc`,
  the guided `app.cli.deploy({ guided })` wizard + `--cli` + `deploy.init({ ci })`), `public/_headers`
  (security + cache), the app-owned 404 requirement (or CF flips to SPA mode), and the two GitHub
  Actions workflows — CI gates deploy via `workflow_run`, with the non-obvious requirements baked in
  (pin Node 24 for `URLPattern`/vitest, install Playwright browsers before the build because
  `mermaid-isomorphic` renders at build time, SHA-pin actions, `--branch main` on the detached-HEAD
  checkout), plus secrets + the dev/preview loop.

### Changed
- **`skills/moku-web/references/css-architecture.md`** — rewritten to match reality. **Removed stale
  content**: the `postcss-preset-env` "PostCSS Configuration" block, `vite-plugin-bundlesize`, and the
  non-existent `styles/index.css` entry (a moku-web project is pure CSS, Vite-free — assembled from
  `main.css` via `@layer`/`@import`, bundled by `Bun.build`). Added the real two-layer token system
  (`light-dark()` + `color-mix()` + paired easings), `@scope` refinements (donut `to ()` + intentional
  global leaf atoms), self-hosted font loading (woff2 + `unicode-range` + `font-display: swap`), the
  reduced-motion utilities layer, and the documented browser-quirk gotchas.
- **`skills/moku-web/references/component-patterns.md`** — synced to 1.12.2; added the role-based
  component taxonomy (chrome / views / items / atoms / interactive facades) and component↔island
  pairing — including how a project customizes the `::embed`/`::gallery` framework directives
  (`content.embed.facade` / `content.gallery.component`) and pairs them with the framework `lazyEmbed`
  island.
- **`skills/moku-web/references/layout-structure.md`** — provenance generalized (framework source, no
  example-app anchor).
- **`skills/moku-web/SKILL.md`** — points at `project-spec.md` for any "create a project" task; Stack
  table gained a Deploy row + pinned-deps/TS6-types notes; Project Structure links the spec and lists
  `og/`; both reference lists updated.

### Plugin
- Version bumped to 0.47.0 in plugin.json and marketplace.json (README badge synced).

## 0.46.0 (2026-06-16)

`moku-sync` of both moku-family frameworks. **`@moku-labs/web` 1.8.0 → 1.12.2** (npm `latest`,
published 2026-06-14, gitHead `9ec62e6` = tag `v1.12.2`) — eight releases adding **four opt-in,
build-time `content` directives** (each rendered to static markup, each requiring
`trustedContent: true`) plus SPA/build fixes: **`mermaid`** (v1.9.0 — fenced ` ```mermaid ` → inline
SVG, optional peer dep `mermaid-isomorphic@^3.0.0`), **`::embed`** lazy iframe facades + the new
**`lazyEmbed`** SPA island (v1.10.0, enhanced v1.11.0 — co-located `src`, `width`×`height`,
swappable facade), and **`::gallery`** folder galleries (v1.12.0 — `GalleryTrack` or a custom
component). New top-level exports `EmbedFacadeButton`, `GalleryTrack`, `lazyEmbed` + the
`EmbedFacade*`/`Gallery*` types. Web still pins `@moku-labs/core@0.1.3` exactly (no other plugin
API/event/config change; `PhaseName` unchanged; engines unchanged). **`@moku-labs/core` 0.1.3 →
0.1.4** (gitHead `dd723ce` = tag `v0.1.4`) — a **type-only fix** (#13 `PluginLike admits core-plugin
instances`, an internal constraint) with no public-API/runtime change, so `src/index.ts` is
byte-identical and the `moku-core` skill needs no edit. The upstream `llms.txt`/`llms-full.txt` still
lag the content directives (last synced web 1.8.2), so the catalog was regenerated from `src/` at tag
`v1.12.2` — source is authoritative.

### Changed
- **`skills/moku-core/references/moku-frameworks.md`** — `frameworks[web].knownVersion 1.8.0 →
  1.12.2` and `frameworks[core].knownVersion 0.1.3 → 0.1.4`; both provenance blocks rewritten for
  the deltas (web's four content features + new exports + optional `mermaid-isomorphic` peer + the
  core-0.1.3-pin/core-latest-0.1.4 lag note; core's type-only fix). Field-reference `llms` row
  corrected — core ships `llms` since 0.1.1 (was wrongly noted `null`).
- **`skills/moku-web/references/plugin-index.md`** — regenerated for 1.12.2: header `Synced version`
  + §1 title → 1.12.2; new "What's new" block; new **§2.1 Content directives** (Mermaid · `::embed` ·
  `::gallery` — directive syntax, config, components, the `lazyEmbed` island, required
  `trustedContent`); `contentPlugin`/`spaPlugin` catalog rows, top-level + `./browser` export lists,
  island note, and a usage snippet updated; llms-lag + generation-contract notes refreshed.
- **`skills/moku-web/SKILL.md`** — API-form header → v1.12.2; surgical note on the three new
  build-time content directives + the new exports (`lazyEmbed`, `EmbedFacadeButton`, `GalleryTrack`),
  linking `references/plugin-index.md` §2.1. Unrelated guidance untouched.

### Unchanged (verified)
- The `moku-web-version` / `moku-core-version` `/moku:upgrade` migrations are registry-driven (read
  `knownVersion`), so a routine version bump touches only the registry — no migration text changed.
  Web's required `@moku-labs/core` range is still `0.1.3` exact, so the `dependsOn` (core-before-web)
  ordering holds.

### Plugin
- Version bumped to 0.46.0 in plugin.json and marketplace.json (README badge synced).

## 0.45.0 (2026-06-10)

**Stack version 3 — Node 24 runtime floor.** Both upstream frameworks now require Node ≥ 24:
`@moku-labs/core@0.1.3` raised engines to `node >=24.0.0` (PR #9, recorded in the 0.44.0 sync) and
`@moku-labs/web@1.6.2` already shipped `node >=24` — but the plugin's target stack, scaffold, and
SessionStart environment check still declared the Node 22 floor, so `/moku:init` produced projects
whose declared floor sat below what their own dependencies enforce. Per the target-stack convention
this is a stack bump, not an in-place edit: new stack version + migration, so `/moku:upgrade` can
raise existing consumer projects' engines (the same path the Bun 1.3.14 floor took via Stack 2's
`tooling-freshness`; contrast 0.42.3, which was only a lagging-hook consistency fix). The
TypeScript 6 baseline beneath it is unchanged. Remaining `>=22` strings in the repo are
intentional: historical changelog entries and the upstream `node >=22 → >=24` delta quoted in
`moku-frameworks.md` provenance.

### Changed
- **`skills/moku-core/references/target-stack.md`** — Stack version 2 → **3** (TypeScript 6
  baseline · Node 24 runtime floor, introduced in v0.45.0); engines table `engines.node`
  `>=22.0.0 → >=24.0.0` (bun floor unchanged at 1.3.14) with a provenance note pointing at the
  upstream engines; detection signature retitled "below-target project" and now flags an
  `engines.node` floor `< 24.0.0` (or absent); history row added for Stack 3; reserved
  TS7-native stack renumbered 3 → 4.
- **`skills/moku-core/references/upgrade-migrations.md`** — new "Stack version 3 migrations"
  section with the **`node24-floor`** migration (detect: `engines.node` floor `< 24` or absent →
  apply: set `>=24.0.0`, surface any `.nvmrc`/`.node-version` pin, no install needed → verify:
  tsc/lint/test + advisory warning when the local runtime is `< 24`); reserved `ts7-native`
  entry renumbered to Stack 4.
- **`skills/moku-core/references/tooling-config.md`** — canonical `package.json` engines block
  `node >=22.0.0 → >=24.0.0`; stack-version header → 3.
- **`commands/upgrade.md`** — hardcoded target → Stack version 3; intro now says "TypeScript 6
  baseline + Node 24 engines floor"; example plan/report and suggested commit message updated to
  include `node24-floor` and Stack 3.
- **`commands/init.md`** — scaffolded engines → `"node": ">=24.0.0"`.

### Fixed
- **`hooks/detect-moku-project.sh`** — SessionStart Node check now warns when Node `< 24`
  (was `< 22`), matching the new floor and the upstream engines gates.
- **`README.md`** — Requirements line now says Node ≥ 24; `/moku:upgrade` table row says
  "TS6 baseline · Node 24 floor".

### Plugin
- Version bumped to 0.45.0 in plugin.json and marketplace.json (README badges synced); the
  plugin.json `/moku:upgrade` description now reads "TypeScript 6 baseline + Node 24 engines
  floor".

## 0.44.0 (2026-06-10)

`spec-sync` of `@moku-labs/core` to **0.1.3** (npm `latest`, published 2026-06-10, gitHead
`d928159` = GitHub tag `v0.1.3`). A docs-truth + CI release with **no runtime changes** (the only
`src/` delta is a stale `await` dropped from a JSDoc `@example`): Node 24 engines floor —
`node >=22 → >=24`, bun unchanged; CI moved to Node 24-ready SHA-pinned actions (#9) — spec
`11-INVARIANTS` §1.4 rewritten "Config Completeness" → "Config Shape Checking" + the
`12-PLUGIN-PATTERNS` CONFIG RULES cheat-sheet fixed (#10), and stale async-`createApp` claims
removed + `01-ARCHITECTURE` required-config claims aligned (#11). Public API/exports unchanged
(`src/index.ts` untouched). Vendored spec + sandbox re-pinned `9d02b96 → d928159` and verified
byte-identical to `git show v0.1.3:<path>` (spec 15/15, sandbox 48/48 curated files); family
registry synced. `@moku-labs/web` verified up to date at `1.6.2` (npm `latest` == registry
`knownVersion`, checked 2026-06-10) — no web changes.

### Changed
- **`skills/moku-core/references/spec/`** — 4 of 15 files changed upstream (PRs #10/#11):
  `11-INVARIANTS` (§1.4 "Config Completeness" → "Config Shape Checking" — no compile-time required
  config; every `pluginConfigs` entry optional; overrides shape-checked against `Partial<C>`;
  consumer-required values = sentinel default + runtime `onInit` check — finishes the 0.1.2 #7
  docs-truth pass and resolves the doc lag flagged at v0.1.2), `12-PLUGIN-PATTERNS` (CONFIG RULES
  cheat-sheet rebuilt per the corrected rule; "createApp returns a Promise" → "createApp is
  synchronous; await `app.start()`/`app.stop()`"), `01-ARCHITECTURE` (required-config claims
  aligned with optional-`Partial<C>` semantics), `13-KERNEL-PSEUDOCODE` (stale
  `async function createApp` dropped from the createCore pseudocode). No files added/removed; no
  H2/numbering changes, so routing tables, section maps, and distilled cross-links stand.
- **`skills/moku-core/references/spec-index.md`** + **`sandbox-index.md`** — re-pinned
  `9d02b96 → d928159` (tag `v0.1.3`), vendored date `2026-06-10`. Sandbox: 0 of 48 curated
  exemplars changed, no upstream 404s, no new upstream sandbox files since v0.1.2; style
  cheat-sheet claims hold.
- **`skills/moku-core/references/moku-frameworks.md`** — `frameworks[core].knownVersion → 0.1.3`;
  core provenance block rewritten for the 0.1.2 → 0.1.3 delta (Node 24 engines floor, spec
  docs-truth fixes, public API/exports unchanged; records the web re-check and that
  `@moku-labs/web@1.6.2` still pins `@moku-labs/core@0.1.1` exactly, so web consumers stay on
  core 0.1.1 until web ships a bump).
- **`skills/moku-core/references/invariants.md`** — "Config Shape Checking" stale-flag resolved:
  spec/11 §1.4 no longer carries the pre-0.1.2 required-configs claim upstream (fixed in 0.1.3
  #10), so the "still stale upstream" note is gone; text aligned with the new §1.4 wording
  (config declares the complete default value; no-`config` plugins excluded from `pluginConfigs`;
  overrides checked against `Partial<C>`).
- **`skills/moku-core/references/upgrade-migrations.md`** — `moku-core-version` example refreshed
  to `0.1.3` (registry-driven, so `/moku:upgrade` now offers `0.1.3` to projects with a direct
  core dep).

## 0.43.0 (2026-06-10)

`spec-sync` of `@moku-labs/core` to **0.1.2** (npm `latest`, published 2026-06-09, gitHead
`9d02b96e` = GitHub tag `v0.1.2` — core's first tagged GitHub release). A hardening release from a
multi-agent audit: guarded `onError` (a throwing handler never aborts hook dispatch, #3),
`createCoreConfig` `Events` default `Record<string, never> → Record<never, never>` (omitted `Events`
keeps hook names strict, #6), `CreateCoreOptions.plugins` now `readonly` (accepts `as const` tuples;
technically a breaking *type* change, #4), `require()` returns a shared frozen `{}` for registered
api-less plugins (#5), the sandbox suite wired into CI (#2), and a docs-truth pass (#7). Vendored
spec + sandbox re-pinned `fe8cc15 → 9d02b96` and verified byte-identical to
`git show v0.1.2:<path>` (spec 15/15, sandbox 48/48 curated files); family registry synced.
`@moku-labs/web` verified up to date at `1.6.2` (npm `latest` == registry `knownVersion`,
checked 2026-06-10) — no web changes.

### Changed
- **`skills/moku-core/references/spec/`** — 5 of 15 files changed upstream (PRs #3/#5/#7):
  `03-PLUGIN-SYSTEM` + `11-INVARIANTS` (reserved names now include `global`/`state`),
  `05-CONFIG-SYSTEM` (removed the unimplemented "required configs are compile-time" rule —
  every `pluginConfigs` entry is optional, overrides shape-checked), `07-COMMUNICATION`
  (guarded `onError` semantics), `13-KERNEL-PSEUDOCODE` (guarded `combinedOnError`/dispatch +
  `EMPTY_API` frozen `{}` at all three `require` call sites). No files added/removed; no
  H2/numbering changes, so routing tables, section maps, and distilled cross-links stand.
- **`skills/moku-core/references/spec-index.md`** + **`sandbox-index.md`** — re-pinned
  `fe8cc15 → 9d02b96` (tag `v0.1.2`), vendored date → `2026-06-10`; fixed the sandbox-index
  raw-URL footer that still pointed at pre-0.1.1 `fdee8c06`. Sandbox: 0 of 48 curated exemplars
  changed, no upstream 404s; the only upstream sandbox change is the non-vendored
  `type-gaps.test.ts` (+149 lines of new type-gap sections — candidate for future curation,
  fetchable on demand via the pinned raw-URL pattern). Style cheat-sheet re-verified, claims hold.
- **`skills/moku-core/references/moku-frameworks.md`** — `frameworks[core].knownVersion → 0.1.2`;
  core provenance block rewritten for the 0.1.1 → 0.1.2 delta (public export names unchanged —
  `src/index.ts` untouched; engines unchanged node ≥22 / bun ≥1.3.8; flags the upstream doc lag:
  spec `11-INVARIANTS` §1.4 still carries the stale required-configs claim that #7 removed from
  spec 05/README). Notes `@moku-labs/web@1.6.2` still pins `@moku-labs/core@0.1.1` exactly, so
  web consumers stay on 0.1.1 until web ships a bump.
- **`skills/moku-core/references/core-api.md`** — `Events` default `Record<never, never>`;
  `createCore` `plugins: readonly AnyPluginInstance[]`; `onError` scope (hook-dispatch failures
  only; lifecycle errors propagate) + guard semantics; reserved-name lists now include
  `global`/`state` in both `createPlugin` and `createCorePlugin` sections; App-type note that
  `require()` yields frozen `{}` for registered api-less plugins.
- **`skills/moku-core/references/communication-context.md`** — guarded error-handler semantics on
  emit; `require()` api-less resolution documented.
- **`skills/moku-core/references/invariants.md`** — "Config Completeness" → "Config Shape
  Checking" (no compile-time required config; sentinel default + runtime `onInit` check is the
  pattern; cites spec/05 §2/§7–§8 and flags spec/11 §1.4 as stale upstream); `require()` contract
  updated; reserved-names provenance note.
- **`skills/moku-core/references/config-lifecycle.md`** — "The Config Rule" table rebuilt per
  spec/05 §2 (plugin excluded from `pluginConfigs` when no `config`; otherwise optional
  `Partial<C>` with shape-checked overrides).
- **`skills/moku-core/SKILL.md`** — Layer-1 claim corrected to "Bundle < 8KB gzipped" (docs-truth
  pass; was "< 5KB" + "Runtime < 200 lines").
- **`skills/moku-core/references/build-skeleton.md`** — empty-`Events` skeleton guidance now says
  `Record<never, never>`, not `Record<string, never>` — the old guidance recreated the exact
  hook-name-widening bug core #6 fixed.
- **`skills/moku-core/references/upgrade-migrations.md`** — `moku-core-version` example refreshed
  to `0.1.2` (registry-driven, so `/moku:upgrade` now offers `0.1.2` to projects with a direct
  core dep).

### Plugin
- Version bumped to 0.43.0 in plugin.json and marketplace.json (README badge synced).

## 0.42.4 (2026-06-10)

Follow-up to 0.42.2: one more stale description of the validation pipeline survived. The
framework-build reference (`build-final.md` Step 6) still said the validation-coordinator handles
"Group A → Group B → architecture sequencing", and its manual fallback ran the
architecture-validator strictly after Groups A + B — both contradicting the coordinator's actual
pipeline, which starts the architecture-validator speculatively alongside Group B and re-runs it
only when Group B surfaces cross-plugin BLOCKERs. Historical changelog entries describing the
old sequential pipeline are left untouched — they were accurate when written.

### Changed
- **`skills/moku-core/references/build-final.md`** — Step 6 now describes the coordinator's
  speculative pipeline (Group A parallel → Group B + architecture parallel, conditional arch
  re-run). The manual fallback (coordinator unavailable) mirrors the same shape: the
  architecture-validator starts alongside Group B and is re-run with Group B findings injected
  only if Group B reports BLOCKERs in categories `missing-export`, `dependency`, `event-type`,
  or `cross-plugin`.

### Plugin
- Version bumped to 0.42.4 in plugin.json and marketplace.json (README badge synced).

## 0.42.3 (2026-06-10)

Consistency fix: the SessionStart environment check still enforced the pre-TS6-era Bun floor
(`>= 1.3.8`) while `/moku:init` scaffolds `engines.bun: ">=1.3.14"` + `.bun-version` `1.3.14`
and the README documents Bun ≥ 1.3.14 (floor raised in 0.30.0's tooling-freshness migration,
but the hook was never updated). The hook now warns below the documented 1.3.14 floor.

### Fixed
- **`hooks/detect-moku-project.sh`** — Bun version validation now warns when Bun `< 1.3.14`
  (was `< 1.3.8`); warning message updated to match. Remaining `1.3.8` strings in the repo are
  intentional: historical changelog entries, the `bun 1.3.8 → 1.3.14` tooling-freshness migration
  docs (`commands/upgrade.md`, `upgrade-migrations.md`, `target-stack.md` era table), and upstream
  `@moku-labs/core`'s own engines field quoted in `moku-frameworks.md`.

### Plugin
- Version bumped to 0.42.3 in plugin.json and marketplace.json (README badge synced).

## 0.42.2 (2026-06-10)

Docs-only patch: the validation-coordinator agent's frontmatter description claimed a fully
sequential pipeline ("Group A → Group B → architecture"), contradicting the agent body, which
runs the architecture-validator speculatively in parallel with Group B (re-running it only when
Group B surfaces cross-plugin BLOCKERs). The description now matches the documented behavior.
Also ships the full README redesign.

### Changed
- **`agents/validation-coordinator.md`** — frontmatter description updated to "Group A (parallel)
  → Group B + architecture (parallel, speculative arch start) with a conditional arch re-run when
  Group B finds cross-plugin blockers". Agent body and `<example>` blocks unchanged.
- **`README.md`** — full redesign: centered header + badges, corrected install commands
  (`moku@moku`), mermaid workflow diagram, all 9 commands documented (adds `/moku:brainstorm` +
  `/moku:clean`), all 20 agents grouped by role, skills/hooks/dynamic-workflows/output-styles
  sections, and an accurate description of the validation pipeline's speculative arch pass.

### Plugin
- Version bumped to 0.42.2 in plugin.json and marketplace.json.

## 0.42.1 (2026-06-10)

`moku-sync web`: `@moku-labs/web` synced **1.6.1 → 1.6.2** (npm `latest`, published 2026-06-09,
gitHead `5521931`). Pure registry/provenance update — 1.6.2 is the spa scroll-before-VT-snapshot
follow-up (PR #56): the nav scroll-to-top honours the page's `scroll-behavior` when view transitions
are off, keeping `behavior: "instant"` only when they're on. The `v1.6.1..v1.6.2` diff touches only
the spa kernel's private `applyPendingScroll` + its unit test + the version field, so the **public
API surface is unchanged** (exports, config keys, events, deps all identical — core still pinned
`0.1.1`) and no skill API form or plugin-index content was regenerated.

### Changed
- **`skills/moku-core/references/moku-frameworks.md`** — `frameworks[web].knownVersion → 1.6.2`;
  web provenance note rewritten for 1.6.2 (delta, gitHead, API-identical verification; upstream
  `llms.txt`/`llms-full.txt` byte-identical at 1.6.2, so the known lag vs source persists —
  `src/` stays authoritative).
- **`skills/moku-web/references/plugin-index.md`** — provenance markers only: `Synced version →
  1.6.2`, API-form heading → v1.6.2, llms-lag note marked byte-identical at 1.6.2. Catalog content
  verified unchanged against the source at tag `v1.6.2`.
- **`skills/moku-web/SKILL.md`** + **`skills/moku-web/references/component-patterns.md`** —
  "synced against" version markers → 1.6.2 (verified surfaces unchanged; `spa/types.ts` untouched
  by the 1.6.2 diff).

### Plugin
- Version bumped to 0.42.1 in plugin.json and marketplace.json.

## 0.42.0 (2026-06-10)

Maintenance + resync release: hook/workflow reliability fixes, the `moku-sync` maintainer skill now
actually ships, moku-testing/moku-core API corrections — and **`moku-sync web`**: the moku-web
teaching material synced from `@moku-labs/web@0.5.6` to **`1.6.1`** (npm `latest`; a patch over
1.6.0 with an identical API surface). Every API claim regenerated from and verified against the
framework source at `v1.6.1` — the upstream `llms.txt`/`llms-full.txt` lag the source (removed
`router.set()`, dropped `URLPattern`), so `src/` was treated as authoritative.

### Fixed
- **`hooks/on-subagent-stop.sh`** — defines `SCRIPT_DIR` before sourcing `notify.sh` (every other
  hook already did), so desktop notifications for verifier/diagnostician completions fire again.
- **`hooks/verify-before-commit.sh`** — the "never stage/commit `.planning/`" guard now runs AFTER
  the Moku-project gate (`.planning/STATE.md` + `moku.md` checks), so plugin users no longer get
  `git add`/`git commit` hard-blocked in non-Moku repos that legitimately track such a directory;
  also fixed the `grep -c … || echo` double-line artifact embedded in the BLOCKED message.
- **`hooks/pre-commit-review.sh`** — the empty-function-body heuristic no longer flags every
  multi-line TS function as a stub (it now matches real one-line `=> {}` / `) {}` bodies only),
  and the `grep -c … || echo "0"` double-line output no longer crashes the finding-count arithmetic.
- **`hooks/check-plugin-antipatterns.sh`** — `as any` is now word-bounded (prose like
  "as anything" no longer hard-blocks a write) and the legitimate `null as const` assertion is no
  longer treated as an inline type assertion (`null as` requires an uppercase type-name start).
- **`workflows/moku-build-wave.js`** — JUDGE schema enum aligned with the wave-judge agent
  contract: `'retry'` → `'fresh-retry'` (the agent never emits `'retry'`, so a fresh-retry
  disposition failed schema validation); judge prompt + `workflows/README.md` wording updated.
- **`agents/builder.md`** — `color: orange` is not a valid agent color (blue/cyan/green/yellow/
  magenta/red); now `yellow`.

### Added
- **`skills/moku-sync/`** — the per-framework maintainer skill now SHIPS with the plugin. It lived
  in gitignored `.claude/skills/moku-sync`, so `skills/spec-sync`'s link to it was broken in every
  distribution and the chained "Phase B" family pass could never load it. Moved next to its sibling
  `spec-sync`, internal links + registry pointer rewritten, portable plugin-repo-root precondition;
  SKILL-INVENTORY 6 → 7 skills.

### Changed
- **`skills/moku-web/SKILL.md`** — API form rewritten for 1.6.1: ctx-based route handlers
  (`.load((ctx) => D)` / `.generate((ctx) => params[])` with `ctx.require(contentPlugin)` loaders),
  **`.parse()` removed** (fetched JSON used directly as `ctx.data`), global `{ stage, mode }` config
  (`mode` is the single ssg/spa/hybrid switch; 3-valued `stage` drives draft visibility),
  declarative-only routes, the `content` provider shell, the new node-only **`cliPlugin`**
  (`app.cli.build/serve/preview/deploy`, no `bin`), `createUrls(routes, defaultLocale?)`, island
  hooks with the real `ComponentContext { el, data }` signature, and the Vite-free stack
  (framework `build` plugin bundles via `Bun.build`).
- **`skills/moku-web/references/plugin-index.md`** — full catalog regenerated from
  `web/src/plugins/*`: header now `1.6.1` / core `0.1.1` / cliPlugin documented; 12-plugin table
  (incl. `cli` with its config/API and hook-driven progress rendering), updated property/event
  indexes (`head.siteHead`, `content.contentDir()`, `build.run` incremental options, spa
  `viewTransitions` default `false`, env providers default `[]`), parse-free SSG→DATA→SPA flow,
  bare-path default locale (v1.6.0), native-RegExp matcher (v1.4.1).
- **`skills/moku-web/references/layout-structure.md`** — regenerated from the real blog reference
  implementation (`@moku-labs/web@1.6.1`): structured `createApp` options, single `routes.tsx`
  table + `createUrls`, SSG-only `(ctx, children)` layout contract, `app.ts`/`spa.tsx` entry split,
  thin `app.cli.*` command scripts, bun/node tsconfig. (Previously taught a nonexistent `moku`
  package with a flat options shape no version ever had.)
- **`skills/moku-web/references/component-patterns.md`** — island hooks corrected to the six
  `ComponentContext { el, data }` lifecycle hooks from `@moku-labs/web/browser` (the `moku/spa`
  import path was fictional); persistent-vs-page-scoped semantics; ctx-based route example.
- **`skills/moku-core/references/moku-frameworks.md`** — `web.knownVersion` `0.5.6` → `1.6.1` with a
  rewritten provenance note (0.5.6→1.6.1 delta, core pin now `@moku-labs/core@0.1.1`, llms-lag
  caveat). `/moku:upgrade`'s `moku-web-version` migration needs no body change (it reads the
  registry); only its illustrative version string in `upgrade-migrations.md` was refreshed.
- **`skills/moku-testing/`** — the mock-context exemplar rebuilt around the REAL `@moku-labs/core`
  exports: core exports exactly `PluginCtx`/`EmitFn` as plugin-author type utilities — the
  previously imported `PluginContext`/`MinimalContext`/`TeardownContext` don't exist on the entry
  point, so any test written from the exemplar failed to compile. Lifecycle-tier mocks now use
  local structural types (matching the sandbox exemplars), and the nonexistent `app` context field
  is gone from SKILL.md's tier table.
- **`skills/moku-core/SKILL.md`** — "one export" → TWO runtime exports (`createCoreConfig` AND
  `createCorePlugin`, plus the `PluginCtx`/`EmitFn` type utilities), matching `core/src/index.ts`.
- **Stack descriptions** — moku-web is no longer described as a "Preact + Vite" stack anywhere
  (its frontmatter description, moku-core's Related Skills, SKILL-INVENTORY): the framework is
  Vite-free — the `build` plugin bundles via `Bun.build`, the `cli` plugin owns the dev loop.
- **Counts corrected** — 20 agents (README + plugin.json description + SKILL-INVENTORY claimed
  19/24); "the other six" skills trigger narrowly now that 7 ship.
- **Repo hygiene** — stray nested `claude/` (an accidental agent-memory write) and empty
  `experiments/` trees removed; `experiments/` gitignored as a designated local scratch area.
- Version bumped to 0.42.0 in plugin.json and marketplace.json.

## 0.41.0 (2026-06-05)

New **`moku-readable-code`** skill + **`moku-readable-code-validator`** agent, wired into the build and
check validation pipelines. Captures a function-body readability standard — the "story by layout"
stanza style: blank-line steps with one-line intent comments, guard clauses first, flat primitives,
named predicates/constants, and balanced helper extraction — plus a validator that flags "wall of text"
functions. The validator emits **WARNING/INFO only — never BLOCKER**, so it surfaces readability debt
without ever failing a build.

### Added
- **`skills/moku-readable-code/SKILL.md`** — the 10-rule stanza style (distilled from Martin's *Clean
  Code*, Ousterhout's *A Philosophy of Software Design*, Boswell & Foucher's *The Art of Readable Code*,
  Fowler's *Refactoring*, and Kernighan & Pike), with exemptions, Moku conventions, and a before/after
  example. Triggers on "readable code", "wall of text", "refactor for readability", "story by layout",
  "stanza style".
- **`agents/readable-code-validator.md`** (`moku-readable-code-validator`, model `sonnet`) — flags
  wall-of-text functions (no blank-line stanzas / intent comments, nested ternaries, deep nesting, fused
  concerns, magic literals) with a concrete per-finding fix. WARNING/INFO only, precision-over-recall to
  avoid false positives; the worst it can do is warn.

### Changed
- **Validation pipeline** — added the validator to Group A (structure + docs) in
  `agents/validation-coordinator.md`, the post-build pipeline (`build-final.md`), and the plugin/app
  build pipelines (`build-plugin.md`, `build-app.md`).
- **`commands/build.md`** — `moku-readable-code-validator` listed in the app, plugin, and `add`
  validator sets.
- **`commands/check.md`** — `--full` now spawns it as a 4th parallel validator.
- **`workflows/moku-verify.js`** — added to the parallel validator fan-out (and its description).
- **`.claude-plugin/SKILL-INVENTORY.md`** — skills 5 → 6, agents 19 → 20, validation 8 → 9.
- Version bumped to 0.41.0 in plugin.json and marketplace.json.

## 0.40.1 (2026-06-03)

`/moku:spec-sync` of `@moku-labs/core` to **0.1.1** (npm `latest`, first stable release; published
2026-06-03, gitHead `fe8cc152`). Vendored spec + sandbox re-pinned to that SHA; family registry synced.
Pure provenance/registry update — the public API surface is unchanged (`src/index.ts` byte-identical to
`0.1.0-alpha.6`), so no skill API form or spec/sandbox content changed.

### Changed
- **`skills/moku-core/references/spec-index.md`** + **`sandbox-index.md`** — re-pinned
  `fdee8c0 → fe8cc15` (npm v0.1.1 gitHead), vendored date → `2026-06-03`. Verified content byte-identical
  to v0.1.1 upstream: spec 15/15 files and sandbox 48/48 files unchanged (no drift, no 404s), no H2 or
  file-numbering changes.
- **`skills/moku-core/references/moku-frameworks.md`** — `frameworks[core].knownVersion → 0.1.1`;
  `releaseSource.llms` `null → …/core/main/llms-full.txt` (core ships `llms.txt`/`llms-full.txt` as of
  0.1.1); corrected the now-stale "core ships no llms.txt" note; added a `core` provenance block (TS 6
  support, zero deps, engines node ≥22 / bun ≥1.3.8, no GitHub tag — npm trusted-publish only).
  `@moku-labs/web` stays `0.5.6` (up to date) and still pins `@moku-labs/core@0.1.0-alpha.6` exactly.
- **`skills/moku-core/references/upgrade-migrations.md`** — refreshed the `moku-core-version` example to
  `0.1.1` (registry-driven, so `/moku:upgrade` now offers `0.1.1` to projects with a direct core dep).
- Version bumped to 0.40.1 in plugin.json and marketplace.json.

## 0.40.0 (2026-06-03)

`moku-sync` of `@moku-labs/web` `0.4.0 → 0.5.6` (npm `latest`, published 2026-06-03). Catalog rebuilt
from the upstream `llms.txt`/`llms-full.txt` cross-checked against source at tag `v0.5.6`.

### Changed
- **`skills/moku-web/references/plugin-index.md`** — `Synced version → 0.5.6`; documents the new
  **two entry points** (`.` full/dual ESM+CJS for the Node build · **`@moku-labs/web/browser`**
  ESM-only, node-free by construction, `browserEnv()` pre-wired for zero-config browser env — v0.5.0);
  the **breaking `route.layout(ctx, children)`** signature now applied in SSG (v0.4.1); typed
  `content.shikiTheme` (BundledTheme name or theme object — v0.5.3); build copies co-located article
  images; client-bundle usage snippet. SSG→DATA→SPA model unchanged.
- **`skills/moku-web/SKILL.md`** — API section → v0.5.6 with both entry examples (`.` and `./browser`)
  and the two-entry / `route.layout` notes (web-patterns guidance untouched).
- **`skills/moku-core/references/moku-frameworks.md`** — `frameworks[web].knownVersion → 0.5.6` +
  provenance delta. Core dep unchanged (`@moku-labs/core@0.1.0-alpha.6`); engines node ≥24.
- **`skills/moku-core/references/upgrade-migrations.md`** — refreshed the `moku-web-version` example to
  `0.5.6` (registry-driven, so `/moku:upgrade` now offers `0.5.6` automatically).
- Version bumped to 0.40.0 in plugin.json and marketplace.json.

## 0.39.0 (2026-06-03)

Natural-language arguments for the idea/scaffold entry-point commands — users describe intent in
plain language instead of memorizing the `verb type "name" --flags` syntax; the command translates
it (and asks only for genuinely missing pieces). Scoped to `brainstorm`, `plan`, and `init`; the
other commands take simple args and are unchanged.

### Added
- **`skills/moku-core/references/nl-args.md`** — shared natural-language argument-resolution protocol:
  resolution order (empty → no-arg · already-structured → verbatim · NL → map + echo
  `Interpreting as: …` → proceed), ask-only-for-the-gap rule, a safety clause (NL never bypasses a
  command's own gates), mapping guidance, and worked examples.
- **`## Input — natural language first` hook** in `commands/{brainstorm,plan,init}.md`, pointing at
  the protocol. `init` now also advertises NL in its description + argument-hint.

## 0.38.0 (2026-06-03)

Retire the self-audit subsystem (command-file stress-testing is better done against real
projects now) and convert the `spec-sync` maintenance command into a prompt-triggered skill that
syncs the whole moku family's spec + knowledge in one shot.

### Removed
- **`/moku:audit` command** and its entire subsystem: 7 agents (`moku-audit-scenario-generator`,
  `-simulator`, `-executor`, `-synthesizer`, `-hooks-analyzer`, `moku-full-cycle-driver`,
  `-reviewer`), the `moku-audit.js` workflow, and the `audit-framework.md` / `audit-full-cycle.md`
  references. Also dropped the `auditMaxScenarios` / `auditIterateLimit` config keys and the
  `.planning/audit-*.md` hook auto-approve pattern.
- **`commands/spec-sync.md`** — replaced by the new skill (below).

### Added
- **`skills/spec-sync/` skill** — prompt-triggered (no longer a slash command). Re-vendors the
  upstream Moku Core spec + curated sandbox from `moku-labs/core` (pinned to a resolved SHA),
  regenerates `spec-index.md` / `sandbox-index.md`, then **chains the `moku-sync` skill** to refresh
  every framework's plugin index + skill API form — so one prompt ("new core version, sync all spec
  and knowledge") brings the whole moku family in sync. `--dry-run`/`--check`/`--no-family` flags;
  STOPs outside the plugin repo.

### Changed
- Cross-references cleaned across `README.md`, `.claude-plugin/SKILL-INVENTORY.md`,
  `commands/{build,init,status}.md`, `workflows/README.md`, and `hooks/approve-planning-writes.sh`.
  Counts updated: agents 26 → 19, commands → 9, workflows → 3, skills 4 → 5.
- Version bumped to 0.38.0 in plugin.json and marketplace.json.

## 0.37.0 (2026-06-03)

`/moku:clean` now carries context into the next iteration instead of silently discarding it.
Previously it kept only `learnings.md`, deleting the decision graph, steering ideas, and all
cycle history — exactly the "what was done / what was decided / what ideas were used" context a
fresh effort needs. The fix keeps things **minimal** (a lightweight trace, not heavy snapshots).

### Added
- **`.planning/history.md`** — a new durable, newest-first **minimal cycle trace**. Before
  deleting, `/moku:clean` distills a terse entry (Did / Decided / Ideas / Open — 3–4 one-line
  bullets) from the ephemeral artifacts about to be removed (STATE.md, brainstorm `context-*.md`,
  build findings), so the next iteration starts informed. Auto-written; `--no-summary` to skip.
- **`--keep archive`** token on `/moku:clean` to retain `.planning/archive/` when wanted.

### Changed
- **`commands/clean.md`** — default always-keep set expanded to the cross-cycle durable knowledge
  (`learnings.md`, `decisions.md`, `steering.md`, `history.md`), aligning `clean` with the build
  command's cycle-archive contract. Step order is now confirm → write trace → delete (cancel
  leaves nothing behind). Added `Write`/`Edit` to `allowed-tools` for the history write.
- **`skills/moku-core/references/memory-schema.md`** — durable-layer table now lists
  `decisions.md` / `steering.md` / `history.md` (+ `archive/`) with per-file `--keep` behavior.
- **`skills/moku-core/references/build-final.md`** — build Cycle Archive now preserves
  `history.md` alongside the other cross-cycle files.

### Removed
- **`.planning/archive/` from `/moku:clean`'s default keep set** — removed by default now (the
  minimal `history.md` trace replaces the heavy snapshots); recover with `--keep archive`.
- Version bumped to 0.37.0 in plugin.json and marketplace.json.

## 0.36.0 (2026-06-01)

`moku-sync` of `@moku-labs/web` `0.3.1 → 0.4.0` (npm `latest`, published 2026-06-01).
Regenerated the framework's teaching material from the upstream `llms.txt`/`llms-full.txt`
(now shipped) cross-checked against source at tag `v0.4.0`. The headline upstream change is
the **SSG → DATA → SPA** data flow.

### Added
- **`skills/moku-web/references/plugin-index.md`** — new `data` plugin row (agnostic isomorphic
  data provider: `write`/`at`/`urlFor`/`fileFor`, config `outputDir`/`baseUrl`, no events); the
  `route.parse(unknown → D)` client-validation gate; a SSG → DATA → SPA data-flow diagram;
  `app.data.*` accessors; default-vs-node-only flags per plugin; RouterApi `clientManifest()` +
  `mode()`; new build phases (`public`, `not-found`, `locale-redirects`).

### Changed
- **`skills/moku-web/SKILL.md`** — Framework API section bumped to v0.4.0 with the
  `plugins: [...]` composition shape, `router.mode` switch, and the SSG → DATA → SPA paragraph
  (web-patterns guidance untouched).
- **`skills/moku-core/references/moku-frameworks.md`** — `frameworks[web].knownVersion → 0.4.0`;
  `releaseSource.llms` now points at the upstream `llms-full.txt`; provenance, preamble, and
  field reference updated to reflect that `@moku-labs/web` ships an `llms.txt` since 0.4.0.
  Engines noted as node ≥24 (was ≥22). Core dep unchanged (`@moku-labs/core@0.1.0-alpha.6`).
- **`skills/moku-core/references/upgrade-migrations.md`** — refreshed the `moku-web-version`
  illustrative example to `0.4.0` (the migration is registry-driven, so `/moku:upgrade` now
  offers `0.4.0` automatically).
- Version bumped to 0.36.0 in plugin.json and marketplace.json.

## 0.35.0 (2026-05-31)

Build-workflow hardening from a delta/update build report (14 issues, all confirmed). The
`Verb: update` path was largely improvised; this makes it first-class and fixes several
greenfield-only assumptions, contradictions, and agent-quality gaps.

### Added — `moku-builder` agent (#5)
- **`agents/builder.md`** — a real builder agent (was inline prose re-derived per run): TDD
  protocol, hard filesystem isolation, scoped lint, JSON output contract, and a
  **greenfield/delta mode** toggle. `build-wave-execution.md` now spawns `moku-builder`
  (`subagent_type: moku-builder`) instead of `general-purpose`.

### Added — first-class delta/update build (#2, #3)
- **`build-skeleton.md`** — delta-skeleton mode for `Verb: update`: create compiling stubs for
  NEW files only (from a `## Delta File Structure`, or existing `## File Structure` skipping
  paths that exist), never overwrite existing files; relaxed section requirements for delta.
- **`build-wave-execution.md`** — delta builder-prompt variant (read existing → add → keep
  existing tests green, RED-first only for new behavior) and a **framework-level wave** concept
  (orchestrator-executed, no sub-agent: `package.json`/`src/index.ts`/`tsdown`/CI), with the
  wave table allowed to carry framework-target rows.

### Fixed — contradictions & path/format coupling (#1, #4, #8, #9)
- **`build-skeleton.md`** reads `.planning/build/skeleton-spec.md` with a fallback to
  `.planning/skeleton-spec.md`; **`clean.md`** path references corrected to `build/` (#1).
- **`build.md`** declares its per-invocation wave-analysis **STOP authoritative** over
  `build-wave-execution.md` (which now also stops after presenting the plan) (#4).
- **`plan-templates.md`** STATE.md template now emits the canonical `| Wave | Plugins | Status |`
  table that `build` keys its skip-wave-analysis detection off; `build.md` documents the
  detection (#8). **`plan.md`** State Persistence: each field appears exactly once (no duplicate
  `## Git Checkpoint:`) (#9).

### Fixed — code reviewer quality (#6, #7)
- **`agents/code-reviewer.md`** — must always end with the structured findings + SHIP/FIX-FIRST
  verdict (never mid-analysis) (#6); strict diff-scoping (never review committed-but-unchanged
  files) (#7a); **grep-before-claiming** any "missing/absent" finding and treat spec "X or Y" as
  satisfied by either (#7b); optional self-skeptic / `moku-skeptic` pass (#7c).

### Added — guards & cost notes (#10, #11, #12)
- **`build-wave-execution.md`** — protected/default-branch guard before the first checkpoint
  commit (offer a feature branch) (#10); builders run scoped `eslint src/plugins/<name>/` so
  unicorn-style findings are caught at the source, not only at orchestrator post-wave lint
  (cross-referenced in `build-verification.md`) (#11); `--continue` pre-commit cost note (#12,
  also pointed to from `build-final.md`).

## 0.34.0 (2026-05-31)

### Added — build validators flag a stale README after a public-API change
A plugin whose **public API** changes must have its `README.md` updated; the validation
pipeline now enforces this instead of letting docs silently drift.

- **`agents/plugin-spec-validator.md`** — new check §16 "README Freshness vs Public API".
  Public API is defined narrowly as the three consumer-facing surfaces (the `api:`/`Api`
  methods, emitted `events`, and `Config` keys); state/handlers are internal and excluded.
  For Standard+ plugins (and any plugin already shipping a README), it compares the README's
  `## API`/`## Events`/`## Config` sections against the source surface and emits a
  **BLOCKER** (`rule: docs-sync`) when the API moved but the README didn't (or a Standard+
  plugin has no README). Internal-only refactors do not trigger it.
- **`build-verification.md`** — Step 4a now also computes a **public-API hash** (api/events/
  config files only); new **Step 4d3** runs the README-freshness check each wave; Step 4d2
  records `API Hash` + `README-API Hash` columns so staleness is a precise, internal-change-
  immune signal (`API Hash` ≠ `README-API Hash` ⇒ stale). Step 4c gap-closure maps the
  `docs-sync` category to README regeneration (readme-generator), not a code fix.
- **`build-final.md`** — Step 5.5 records the `README-API Hash` when a README is generated;
  the Delta Update Checklist now regenerates a plugin README when its **public-API hash**
  changed (not on any file change), keeping the Step 4d3 gate green on later builds.

## 0.33.0 (2026-05-31)

Eliminates a data-loss class: two features brainstormed + planned in one session could collide
over the single `.planning/specs/` slot, and the `complete`+`update` transition was *defined* to
delete the first feature's approved-but-unbuilt specs. Fixed at all three layers.

### Fixed — plan can never silently destroy an unbuilt plan
- **`commands/plan.md`** — new **Unbuilt-Plan Guard**, the single mandatory gate every
  spec-clearing path now runs first. An approved-but-**unbuilt** plan is detected precisely
  (specs present in `.planning/specs/` while `## Phase:` is `stageN*`/`complete` — because a built
  plan is archived and reset to `ready` by build-final Step 7.5). On collision it offers
  **Combine / Archive / Replace** instead of deleting; only Replace deletes, Archive moves specs +
  skeleton + STATE to `.planning/archive/{slug}/`, and non-interactive runs default to Archive
  (never auto-delete). The `complete`+`update`/`add` jump-table row and the Start-fresh branch now
  route through this guard.

### Added — plan accepts multiple `--context` files → one merged plan
- **`commands/plan.md` + `plan-verb-create.md`** — `--context` may be repeated; all files are
  collected into `CONTEXT_FILES`, validated per-token, persisted to `## ContextFile:`
  (comma-separated), and **merged into one plan** by the create verb (union plugin hints — same
  plugin touched by two features becomes one entry; conflicting decisions surfaced via
  AskUserQuestion; merged research/risks). This is the first-class path for planning multiple
  features together, replacing the manual spec merge the incident required.

### Added — brainstorm steers coexisting features into one plan
- **`commands/brainstorm.md`** — the closing suggestion now scans for sibling un-planned
  `context-*.md` files; when others exist it recommends the multi-`--context` combined-plan
  invocation and notes that `/moku:plan` will not overwrite an existing unbuilt plan.

### Fixed — four smaller plan/brainstorm consistency gaps
- **Researcher file-write contradiction** — `brainstorm-flow.md` Phase 3 told researcher
  agents to write `.planning/brainstorm-*-research-*.md`, but `brainstorm-researcher`/
  `researcher` have no `Write` tool (and their output contract is text-return). The flow now
  states researchers return findings as text and the **parent** assembles the merged
  `brainstorm-{NAME}-research.md` — matching what actually happens, instead of always falling
  through the missing-file guard.
- **Skeleton-spec path inconsistency** — the `/goal` completion line in `commands/plan.md`
  said `.planning/skeleton-spec.md`; every authoritative reference and the build reader use
  `.planning/build/skeleton-spec.md`. Corrected so the path the plan writes is the path the
  build reads.
- **`--quick` auto-suggest unreachable on `update`** — the ≤4-plugin auto-suggest was keyed to
  the Stage 1 gate, which `update` skips. It is now keyed to the **first gate of the run**
  (Stage 1 for create/migrate; Stage 2 for update), with the trigger documented in
  `plan-verb-update.md`, so it fires for every verb.
- **plan-checker BLOCKER triage ordering** — the rule now explicitly binds to gate ordering
  and is not relaxed by quick mode: plan-checker runs and all "Fix now" BLOCKERs are triaged
  **before** the (single, in quick mode) approval gate is shown; a gate must never be presented
  while unresolved BLOCKERs exist.

## 0.32.0 (2026-05-31)

Moku-family framework awareness: the toolkit now tracks, teaches, indexes, and auto-upgrades
the frameworks a project consumes — starting with `@moku-labs/web` v0.3.1.

### Added — `@moku-labs/web` plugin & property index
- **`skills/moku-web/references/plugin-index.md`** — a source-grounded catalog (generated from
  `@moku-labs/web@0.3.1`): the v0.3.1 API form (`createApp`/`createPlugin` + the `route()` DSL +
  `head` SEO helpers), all 10 plugins (8 framework + the `log`/`env` core plugins) with their
  `depends`, emitted events + payloads, context/app API, and config keys, a flat `ctx`/`app`
  property index, and an event index. So an agent knows what's available without reading source.
- **`skills/moku-web/SKILL.md`** — new minimal "Framework API (@moku-labs/web v0.3.1)" section
  (the skill previously covered only Preact/island/CSS patterns) linking to the plugin index.

### Added — Moku-family framework registry + auto-upgrade
- **`skills/moku-core/references/moku-frameworks.md`** — the single registry of moku-family
  frameworks (`@moku-labs/core`, `@moku-labs/web`, future): npm name, repo, local clone,
  `knownVersion`, the skill + plugin index each backs, dependency detection, release source
  (npm registry is the version-of-truth — no `llms.txt` upstream), and the upgrade migration id.
- **`/moku:upgrade` now bumps depended-on Moku frameworks.** Two registry-driven migrations
  (`moku-web-version`, `moku-core-version`) in `upgrade-migrations.md` fire when a project
  depends on `@moku-labs/web` / `@moku-labs/core` below the registry's `knownVersion`, bumping
  to it (core before web) and verifying — decoupled from the TypeScript/tooling stack version.
  `commands/upgrade.md` and `target-stack.md` wired to read the registry; the early-exit no
  longer stops when the stack is current but a `@moku-labs/*` dep is stale.

### Added — `moku-sync` maintainer skill (extensible)
- **`.claude/skills/moku-sync/SKILL.md`** — local project skill that polls each registered
  framework's release source, detects whether a new version shipped (`--check` reports only),
  and on a newer version regenerates that framework's skill API section + plugin index and
  writes the new `knownVersion` back to the registry. Onboarding a new moku-family framework is
  data-only: add a registry row, create its skill + index, run `moku-sync <key>`.

## 0.31.0 (2026-05-31)

Two changes shipped together.

### Fixed — JSDoc validator catches the two silent false-pass export shapes
- **`agents/jsdoc-validator.md`** now flags, as MISSING public-export documentation:
  (a) destructured public-API exports — `export const { createApp, createPlugin } = framework`
  (a destructured binding's JSDoc resolves only at the destructure site, so it never crosses
  the module boundary — cross-module hover and the emitted `dist/*.d.ts` get nothing); and
  (b) factory-result const exports — `export const x = createPlugin(…)` / `createApp(…)` —
  lacking a **directly-preceding** JSDoc block (ESLint `jsdoc/require-jsdoc` ignores
  call-initialized consts, so these ship undocumented with lint green). A file-level `@file`
  comment is explicitly **not** credited toward any per-export requirement. The validator
  recommends the explicit, individually-documented `export const x = source.x;` fix — the only
  form whose docs reach both editor hover and the shipped `.d.ts`. Detection grep seeds and
  Process/Output updates included. Closes the gap found in a real `@moku-labs/web` build
  (4 of 12 public exports shipped docs while the validator passed).
- **`skills/moku-core/SKILL.md`** — new "Public Export Shape (JSDoc survival)" section plus a
  Critical Design Decisions rule: public exports are explicit, individually-documented consts,
  never destructured.
- **`skills/moku-plugin/SKILL.md`** — plugin export must be an explicit, individually-documented
  const (never destructured; `@file` does not count); new anti-pattern example.
- **`skills/moku-core/references/tooling-config.md`** — optional ESLint `jsdoc/require-jsdoc`
  `contexts` backstop for the factory-const case (Gap B); notes it cannot catch Gap A.

### Added — CI/release reference for Layer-2 framework packages
- **`skills/moku-core/references/ci-release.md`** — the canonical two-workflow flow for a
  framework package published to npm: `ci.yml` (parallel lint/types/test/build, reusable via
  `workflow_call`) + a single `publish.yml` (`workflow_dispatch` + `release: published`,
  reusing ci.yml). Encodes npm OIDC Trusted Publishing (tokenless, provenance, `npm publish`
  kept inline; npm ≥ 11.5.1 asserted fail-closed, no global npm install), SHA-pinned actions
  (with the `gh api …/commits/<tag> --jq .sha` resolution rule and Node-24 floors),
  least-privilege per-job permissions, script-injection-safe `run:` blocks (no `${{ }}` in
  shell), GitHub-native release notes, no-double-publish handling, tag-only releases compatible
  with branch protection, ref↔package.json verification with `latest`/`next` dist-tag split,
  the branch-protection ruleset (`gh api …/rulesets`, no bypass), gotchas (PR-head lag,
  concurrency reuse), the optional split package/publish hardening, and acceptance checks.
- **`skills/moku-core/references/build-final.md`** — Step 5.10 now routes the npm-publish path
  to `ci-release.md` instead of scaffolding an ad-hoc token-based `release.yml`.

## 0.30.0 (2026-05-30)

TypeScript 6 baseline + the first universal stack-migration command. Researched against the TS6 GA
(last JS-codebase release; bridge to the native `tsgo`/TS7) and the moku toolchain — only two tools
actually gate TS6 (`typescript-eslint`, `tsdown`); Bun is orthogonal (own transpiler, never consumes
the `typescript` package).

### Added — `/moku:upgrade` (the official migration path)
- **`commands/upgrade.md`** — a **zero-argument**, gated, resumable command that brings any existing
  Moku project (framework/app/plugin/web) up to the **target stack hardcoded into the installed
  plugin version**. There are no version arguments: the target is whatever this plugin ships. Flow:
  detect project + git safety → compute a delta from the migration registry → present the plan →
  single approval gate (with opt-in prompts for off-by-default migrations) → apply idempotently →
  verify each step (`tsc`/lint/test, plus `build`/`publint`/`attw` for libraries) → report. Failures
  route to `moku-error-diagnostician` (bounded 3 rounds); progress persists to `.planning/UPGRADE.md`
  for stop-and-resume. Never commits, never `--no-verify`, never weakens `strict`. Distinct from
  `/moku:plan migrate` (which maps *foreign* code *into* Moku). Supports `--dry-run`.
- **`references/target-stack.md`** — the versioned, machine-readable **target stack manifest**
  (Stack version 2 = TS6). Pinned tool versions, engines, tsconfig deltas, the detection signature
  `/moku:upgrade` reads, a stack-version history table, and reserved future entries (TS7, de-vibe).
- **`references/upgrade-migrations.md`** — the extensible **migration registry**: each migration is a
  self-contained `detect → apply → verify → rollback` unit. Seeds `ts6-core`, `tooling-freshness`,
  and an **off-by-default opt-in `tsgo-fastcheck`** (TS7 native preview as a side-by-side fast
  checker; `tsc` stays authoritative). TS7 and de-vibecoding are documented as reserved entries — the
  registry is how every future stack jump (incl. "migrate out of vibe-coded") plugs in.
- **Discoverability** — `/moku:check` dependency check now flags a below-target stack and points to
  `/moku:upgrade`; README command table updated.

### Changed — TypeScript 6 baseline stack (Stack version 2)
- **`references/tooling-config.md`** (the canonical scaffold copied by `/moku:init`): `typescript`
  `5.9.3 → 6.0.3`, `typescript-eslint` `8.56.0 → 8.58.0` (first TS6-supporting release),
  `tsdown` `0.20.3 → 0.22.1` (first peer range allowing `^6`). tsconfig now sets `"types": ["bun"]`
  (TS6 defaults `types` to `[]` → otherwise `Cannot find name 'Bun'`) and `tsconfig.build.json` pins
  `"rootDir": "./src"` (TS6 changed the `rootDir` default). Freshness bumps: Bun `1.3.8 → 1.3.14`,
  `@biomejs/biome` `2.4.2 → 2.4.16`, `@types/bun` `1.3.10 → 1.3.14`, `publint` `0.3.17 → 0.3.21`,
  `attw` `0.18.2 → 0.18.3`. Web tsconfig (`moku-web`) gains `"types": ["vite/client"]`.
- **`agents/type-validator.md`** — TS6-aware tsconfig checklist: `"types"` is now a **CRITICAL**
  requirement (empty/missing breaks `tsc`); stops flagging missing explicit `isolatedModules` when
  `verbatimModuleSyntax` + `module: Preserve` are set (they enforce it); notes the `tsc` error format
  is unchanged in TS6 so output parsing needs no change.
- **`commands/init.md`, `README.md`** — engines/`.bun-version`/requirements updated to Bun 1.3.14;
  init notes the new `types: ["bun"]` requirement.
- Version bumped to 0.30.0 in `plugin.json` and `marketplace.json`; `SKILL-INVENTORY.md` commands
  count 10 → 11.

## 0.29.0 (2026-05-30)

Driven by a real end-to-end framework build that surfaced defects in v0.28.0 plus two reported regressions.

### Fixed
- **`moku-verify` (and all workflows) used unqualified `agentType`s** (`moku-spec-validator`) that don't resolve against the `moku:`-namespaced registry — every validator silently failed to launch and the disposition still returned a vacuous **PASS**. Now all workflow `agentType`s are namespaced (`moku:…`), `PASS` requires every validator to have run and returned a parseable verdict (else **INCONCLUSIVE**, never a vacuous PASS), the adversarial skeptic pass is **on by default** (checks repo conventions), warnings may carry an optional `fix`, and a validator returning prose is re-spawned once for its JSON contract.
- **Notifications only fired on session close.** The Stop hook now plays a short "your turn" chime on a genuine finish (silent on continuation), and the Notification hook beeps for *any* input-needed event (question/idle), not just permission prompts — both fire in any project, sound-only (no popup spam), suppressible via `enableSounds: false`. Added a `moku_sound` helper with a terminal-bell fallback.
- **Brainstorm/plan stopped showing worked examples + recommendations when asking the user to decide.** Reinforced that Turn A (code examples + clear recommendation + concerns) is the primary deliverable and option descriptions are summaries only; added the same "present decisions as an opinionated colleague" requirement to `plan` Stage 1 (it never had it).

### Added — correctness-on-first-try (from the build's diagnostics)
- **`references/skeleton-conventions.md`** — permanent hook-compliant authoring rules (≤30-line wiring index w/ literal template, typed-const config, `type` not `interface`, `createCoreConfig` third tuple arg, JSDoc tag-lines, structural injectable types, no inline `as`/`wireX`). The skeleton/spec generator (plan Stage 3) and every builder now emit hook-compliant code from line 1 instead of rediscovering the rules each build. Skeleton "revisit" items are carried into a STATE.md `## Skeleton Revisit TODOs` section.
- **`references/house-style.md` + convention-baseline rule** on the validators and skeptic — before a BLOCKER, check whether ≥2 already-verified plugins use the pattern; if so it's a house convention (ADVISORY), not a per-plugin blocker. Codifies three patterns as approved (`api: createApi` direct ref, framework `__tests__` importing `createCoreConfig`, per-event `register<T>()`).
- **`references/glossary.md`** + pre-expanded `unicorn/prevent-abbreviations` allowList and a `cspell.json` in `tooling-config.md` (scaffolded by `/moku:init`) so builds never widen abbreviation/dictionary lists mid-flight.
- **Correct-first-try checklist** in `build-plugin.md` + targeted rules: structural injectable types (no namespace types) + `bun run build`/`.d.ts` in the verification chain; `data-*` not `classList` (incl. JSDoc examples); exact `[fw] desc.\n  fix.` error format; honor override hooks; no dead `depends`; tier ≠ directory shape.

### Added — build safety & final stages
- **Parallel-builder filesystem safety (P0 data-loss fix):** builder prompts now hard-forbid repo-wide commands (`lint:fix`, repo `format`) and ALL git mutations and out-of-plugin writes; `moku-build-wave` isolates each builder in a `worktree` when a wave has >1 plugin. A stray `git checkout` had reverted a sibling plugin to stubs.
- **Mandatory post-wave reconciliation** (`build-verification.md`): the orchestrator independently runs `git status`/tsc/lint/test and treats builder reports as hints — a plugin reported `built` whose tracked files don't show in `git status` is a red flag.
- **Hook false-positive fixes:** `INDEX-RULE` ≤30-line check now counts effective wiring lines (excludes JSDoc/imports/blanks — killed 16 false hits); `STRUCTURE` recognizes barrel-exported `types.ts` and excludes entry files (`index/client/lifecycle`) from the tier cap; `onStart/onStop` check learned more resource verbs (incl. `addEventListener`) and a `// @no-resource-check` escape hatch.
- **Final build stages extended to app builds** (`build-app.md`): full-app realistic integration tests, README generation/update, and a CI/CD step. **CI/CD step now lets the user choose how/where to ship** with options + examples — npm publish, GitHub Releases, and deployment targets (Cloudflare Pages/Workers, Vercel, Netlify, GitHub Pages, container).

### Changed
- Version bumped to 0.29.0 in plugin.json and marketplace.json.

## 0.28.0 (2026-05-29)

### Added
- **Vendored sandbox exemplars** — 48 curated files from `moku-labs/core/tests/sandbox` (pinned to commit `fdee8c06`) under `skills/moku-core/references/sandbox/`, with a `sandbox-index.md` "open this when you want X" map + style cheat-sheet. Build agents consult the tier-matching exemplar (env→counter→router→analytics→cms) to mirror real moku coding style. Wired into `build-wave-execution.md`, the agent preamble, and the `moku-testing`/`moku-web` skills. `/moku:spec-sync` now refreshes both `spec/` and `sandbox/`.
- **`/goal` integration** — `brainstorm`, `plan`, and `build` each end with an optional, ready-to-paste `/goal` line (with anti-cheat clauses + turn caps) so users can run a stage unattended to completion. Documented that a command/hook cannot set `/goal` programmatically (it's a session-scoped wrapper around a prompt Stop hook).
- **Dynamic workflows (2 new)** — `moku-build-wave.js` (build one wave non-interactively: parallel builders over disjoint plugin dirs → verify-as-each-completes → wave-judge) and `moku-migrate-sweep.js` (repo-wide mechanical change: discover → one-agent-per-file transform → verify). Plus an opt-in **adversarial pass** in `moku-verify.js` (each blocker challenged by N `moku-skeptic` agents; majority-refuted blockers downgrade to warnings) and a new read-only `moku-skeptic` agent.
- **Multi-session resumability** — STATE.md now carries a `## Recovery` block (last good step / open blockers / next action / timestamp) for one-read cold-start rehydration; `/moku:next` and `/moku:status` read it first. New `references/memory-schema.md` documents `.planning/` as the durable cross-compaction layer.
- **Discovery + cost** — `$schema` + `displayName` in `plugin.json`; `.claude-plugin/SKILL-INVENTORY.md` component map; `/moku:check usage` footprint view; `references/tool-scoping.md` and `references/hook-patterns.md`; `docs/plugin-composition-evaluation.md` (monolith split evaluated and deferred). PR-5 proposals (`docs/proposals/2026-05-pr5.md`) implemented.
- **Capability adoption** — `subagentStatusLine` wired in `settings.json`; SessionStart hook now emits structured `hookSpecificOutput` (additionalContext + sessionTitle) when `jq` is available (plain-stdout fallback otherwise); `PostToolUseFailure` routes tsc/lint/test failures to `moku-error-diagnostician` via `additionalContext`; `effort: low` on mechanical validators (jsdoc, verifier) and `effort: high` on deep reviewers (code-reviewer, wave-judge, skeptic); `claude plugin validate --strict` step in `/moku:audit`.

### Fixed
- **Inverted R4 naming rule (spec-contradicting bug, surfaced by spec grounding)** — R4 previously forbade the `Plugin` export suffix, but the authoritative spec (`spec/15-PLUGIN-STRUCTURE.md §7`) and the vendored sandbox both mandate `export const <name>Plugin = createPlugin('<name>', …)`. Corrected R4 on all normative surfaces — `agent-preamble.md`, `plugin-spec-validator`, `architecture-validator`, `build.md`, the `moku-plugin`/`moku-core` skill bodies — and **removed the antipattern hook check that was hard-blocking the spec-correct `routerPlugin` naming**. Naming is now a WARNING-level §7 convention. The bare-name example snippets across the distilled `references/*.md` corpus (21 files) were then swept to the `<name>Plugin` convention — including all interlinked `depends`/`import`/`require`/`plugins` references — while preserving name strings, flat `app.<name>`/`ctx.<name>` accessors, `create<Name>Api` factories, import paths, event names, and types; **core plugins (`createCorePlugin`) stay bare**, and intentional anti-pattern demos keep their bare names. (This sweep dogfooded the new `/moku-migrate-sweep` workflow; output was reviewed before acceptance.)
- **`brainstorm-guard.sh` fail-open** — the deny JSON was hand-built with path interpolation and became malformed (and was silently dropped, allowing the write) when a file path contained a double-quote. Now built with `jq`/`python3` for safe escaping.
- **`verify-before-commit.sh` `.planning` false-block** — the guard matched `.planning` as a bare substring, wrongly blocking `git add some.planning-notes.md` and `git commit -m "…​.planning/…"`. Now strips `-m`/`--message` values and matches `.planning` only as a real path token.

### Changed
- **1M-context note** — recorded that Opus 4.8 ships a lean *system prompt* by default, so the plugin's lean mode is now largely redundant on 4.8 and is reserved as a lever for older models.

## 0.27.0 (2026-05-29)

### Added
- **Vendored Moku Core specification** — all 15 upstream spec files copied into `skills/moku-core/references/spec/`, pinned to commit `fdee8c06`. The plugin is now spec-grounded instead of relying on hand-distilled summaries.
- **Fast spec index** (`skills/moku-core/references/spec-index.md`) — a ~5KB routing index over the 6,400-line spec (file + section map, "when to open this file" hints, how-to-use rule). Injected into **every command** (a `## Moku Core Specification (authoritative)` header block in all 8 commands) and **every agent** (Universal Rule 8 in `agent-preamble.md`, read by all 24 agents). Commands and agents must consult the index and open the cited `spec/NN-*.md` file before architecture/API/type/lifecycle/event/structure decisions, and cite spec section IDs in findings.
- **`/moku:spec-sync`** — refresh the vendored spec from `github.com/moku-labs/core` at a given ref, re-pin the SHA, and regenerate the index (read-only network; `--dry-run` diff).
- **`/moku:clean`** — reset `.planning/` before a new large effort. Keeps `learnings.md` by default (durable architecture learnings); removes everything else with no backup, behind a confirmation gate and a mid-flight guard. Flags: `--keep specs,context,state`, `--dry-run`, `--force`.
- **Dynamic workflows** — committed `workflows/` directory with `moku-verify.js` (parallel fan-out of all validators → deduped disposition; installed into projects by `/moku:init` as `/moku-verify`) and `moku-audit.js` (maintainer command-audit fan-out). See `workflows/README.md` (requires Claude Code v2.1.154+).
- **Spec grounding in brainstorm** — `brainstorm-researcher`, `brainstorm-challenger`, and `brainstorm-synthesizer` now evaluate every approach against cited spec sections; a mandatory **Spec Alignment** section flows from the position document through the context file into `/moku:plan`.
- **PR-5 roadmap** — `docs/proposals/2026-05-pr5.md` (next-step proposals from current Claude Code capabilities).

### Changed
- **`.planning/` is never committed** — hard rule enforced by `verify-before-commit.sh` (blocks any `git add`/commit referencing `.planning`, including force-adds), documented in the agent preamble and every command header, and `init.md` now idempotently ensures `.planning/`/`.claude/` are gitignored in pre-existing repos.
- **1M-context tuning** — lean mode is now an opt-in cost lever (auto-lean raised to ~70% window usage, not 40%); the Wave-3+ parallelism throttle is relaxed on 1M models; added a "Context strategy (1M models)" section to the `moku-core` skill (index + fetch, front-load invariants for cache hits, rely on server-side compaction).
- **Validators cite the spec** — `moku-spec-validator`, `moku-plugin-spec-validator`, and `moku-architecture-validator` now map each check to a `spec/NN-*.md §N` section and cite it in every blocker/warning. The R1–R8 code rules are linked to their `spec/11-INVARIANTS.md` origin.
- **Distilled references cross-linked** — `architecture.md`, `core-api.md`, `plugin-system.md`, `type-system.md`, and `invariants.md` now carry a `> Source: spec/NN-*.md` header marking them as non-authoritative summaries.
- Version bumped to 0.27.0 in plugin.json and marketplace.json.

## 0.26.8 (2026-03-31)

### Fixed
- **Skeleton S2 stop enforcement** — STOP instruction now visually isolated block (`>>> STOP HERE <<<`) preventing drivers from skipping per-wave checkpoints and leaving STATE.md stale
- **Events type gap in skeleton** — new pre-verification step populates `src/config.ts` Events type with all plugin event names, preventing type errors when implementations call `ctx.emit()`
- **Barrel interleaving in skeleton** — new pre-verification step enforces two-section layout (instances first, then types) in `src/plugins/index.ts`
- **Context exhaustion recovery in skeleton S3** — verification loop now preserves wave progress in STATE.md before stopping, preventing full skeleton re-execution on resume
- **Phase value ambiguity** — Stage 3 approval now explicitly writes `Phase: complete` instead of ambiguous `stage3/approved (which sets complete)`
- **Skeleton field after plan** — plan command no longer writes `in-progress` on fresh runs; always writes `not-started` (reserved for build command)
- **Antipattern regex gap** — `check-plugin-antipatterns.sh` Check 6 now catches `{ content } as Type` pattern (object-spread casts), not just empty `{} as`
- **Brainstorm marker cleanup** — explicit `.brainstorm-active` deletion and confirmation log at brainstorm completion, preventing orphaned markers

### Changed
- **Wave analysis mandatory gate** — build.md now explicitly requires wave analysis before any plugin implementation after skeleton commit
- **Git checkpoint verification** — skeleton commit verified via `git log --oneline -1` before proceeding to plugin waves
- **Post-wave stub sentinel check** — `grep -r "not implemented"` blocks waves from accepting skeleton-quality stubs as real implementations
- **Post-wave TDD verification** — waves now verify at least one non-todo test assertion exists per plugin before acceptance
- **Unnecessary cast quality rule** — skeleton quality rules now prohibit redundant `as string` casts when config types are inferred from defaults
- **Core plugin spec template** — code example instruction now requires `config:` field when Config type is defined
- Version bumped to 0.26.8 in plugin.json and marketplace.json

## 0.26.7 (2026-03-30)

### Fixed
- **Delta build flag persistence** — `## Verb: update` now re-activates delta build mode on every resume, ensuring delta updates survive skeleton waves and multi-invocation builds
- **`--dry-run` + `add` precedence** — `add auth --dry-run` no longer produces a misleading framework dry-run; guard stops with clear message directing user to spec file
- **Idempotency Protocol false positive** — `#wave:N` re-runs skip the crash-recovery prompt since wave re-execution is intentional
- **Error Recovery skeleton absent-field fallback** — old STATE.md without `## Skeleton:` field now correctly assumes committed, matching Skeleton Detection behavior

### Changed
- **State Write Protocol `## Mode:` preservation** — sub-mode (config-only/plugins-only) no longer silently lost on STATE.md writes; validation now checks for Mode header carry-forward
- **Output Style detection** — replaced vague "if configured" with concrete `.claude/output-styles/moku-building.md` file existence check
- **Intent normalization state-aware** — "what would the next wave do" maps to `resume --dry-run` mid-build instead of `framework --dry-run`
- **`#wave:N` + `--continue` behavior** — documented: execute wave N, continue to N+1 only if incomplete
- **`#wave:N` + `fix` incompatibility** — explicit guard with clear error instead of silent flag drop
- **TaskCreate `addBlockedBy` clarified** — independent same-wave plugins have `addBlockedBy: []` and run in parallel
- **Add verb skeleton: verified message** — now matches Error Recovery's precise "built but not yet committed" language
- **Add verb reserved-word guard** — reserved keywords (`resume`, `framework`, etc.) rejected at add time, resolving asymmetry with fix verb
- **Reserved-word error message** — now includes `/moku:status` hint for finding plugin numbers
- **LeanMode persistence in add flow** — explicit note to write `## LeanMode: true` at add completion
- Version bumped to 0.26.7 in plugin.json and marketplace.json

## 0.26.6 (2026-03-30)

### Fixed
- **Jump Table Phase=complete missing VERB=migrate** — resume after completed migrate plan now routes correctly instead of falling through undefined
- **Start-fresh .bak overwrite** — prior backup renamed to `.bak.YYYY-MM-DD` before overwriting, preventing silent data loss
- **`--context` probe missing `{token}.md`** — added `{token}.md` as second probe step before `context-{token}.md`, fixing the most common naming pattern (execution-confirmed)

### Changed
- **Wrong-command detection refined** — bare `build` removed from trigger list; `build a [noun]` patterns now treated as plan-intent instead of false-positive redirect
- **VERB detection priority order** — normalization now uses explicit first-match-wins numbered priority; state-based default is fallback-only
- **QuickMode validation on load** — non-boolean values (`yes`, `TRUE`, etc.) warn and default to false instead of undefined behavior
- **`--context` precedence clarified** — two-phase sequence: Step 0 sets value, Step 0.1 skips STATE.md load if already set
- **TYPE mismatch on resume** — AskUserQuestion prompt when normalized TYPE differs from STATE.md TYPE instead of silent discard
- **Context-file probe AskUserQuestion** — migrate PATH_OR_LINK prompt now explains token was matched as brainstorm context
- **Add verb STATE.md contract** — documented that add never writes STATE.md; resume after add shows "no plan state"
- **Add verb TYPE default** — auto-detect does not run for `add`; TYPE defaults immediately to `plugin`
- **Add verb sigil rejection** — path-like tokens (`../evil`, URLs) rejected as invalid plugin names
- **Output Styles guard** — `test -d` check before suggesting style switch
- **Whitespace `--context` guard** — empty/whitespace-only tokens rejected before path construction
- Version bumped to 0.26.6 in plugin.json and marketplace.json

## 0.26.5 (2026-03-30)

### Fixed
- **`--context` naming mismatch** — `--context site-gen` now probes `context-{token}.md` pattern when bare path fails, matching brainstorm output naming convention
- **`--context` absolute path handling** — absolute paths (`/tmp/file`) rejected with clear error instead of producing malformed `.planning//tmp/file`
- **`--context` shell injection guard** — metacharacter rejection (`;|$\`()`) and mandatory single-quoting prevent command injection via crafted filenames
- **`--context` path traversal** — `../` sequences resolving outside `.planning/` now rejected

### Changed
- **Fallback probe migrate-only guard** — PATH_OR_LINK fallback probe (local path + context file checks) now restricted to `migrate` verb only; `create`/`update`/`add` tokens no longer consumed as paths
- **Conflict-check cancel option** — ambiguous token AskUserQuestion now includes "Neither — treat as part of REQUIREMENTS" option
- **Duplicate `--context` handling** — last-wins rule documented for multiple `--context` flags
- **ContextFile resume fallback** — absent `## ContextFile:` in old STATE.md files defaults to `(none)` gracefully instead of undefined behavior
- Version bumped to 0.26.5 in plugin.json and marketplace.json

## 0.26.4 (2026-03-29)

### Fixed
- **`.brainstorm-active` orphan prevention** — early-exit cleanup rule ensures the brainstorm-guard marker is always deleted on validation errors, wrong-command redirects, and Cancel exits (was left orphaned, blocking subsequent brainstorms)
- **Plan-intent keyword shadowing** — `create spec` no longer silently proceeds as CATEGORY=create NAME=spec; wrong-command detection now checks token 2 when normalization is skipped
- **`--deep 0` / `--deep -1` cleanup** — invalid depth flag errors now clean up `.brainstorm-active` before stopping
- **Researcher merge crash on FAIL** — Phase 3 research merge now validates output files exist before reading; missing researcher output is logged and skipped instead of blocking

### Changed
- **`--deep` + `--quick` conflict** — explicit error when both flags present (previously undefined: last-flag-wins by prose order)
- **Wrong-command detection** — hard-stop replaced with `AskUserQuestion` offering "Continue brainstorming" escape hatch alongside redirect suggestion
- **Resume depth restoration** — resume now silently restores EFFECTIVE_DEPTH from saved analysis signals; depth confirmation AskUserQuestion no longer fires redundantly on resume
- **Resume partial state handling** — malformed analysis file on resume defaults to standard depth with logged warning instead of crashing
- **Quoted-token NAME extraction** — quoted strings (starting with `"`) now explicitly feed DESCRIPTION, not NAME
- **NAME derivation stop-word list** — "meaningful words" defined with explicit stop words (a, an, the, to, for, of, in, on, with, etc.)
- **Reserved NAME guard** — category keywords and reserved words used as NAME get `-project` suffix to avoid confusing file names and logs
- **Cancel cleanup** — Cancel exit now removes `.planning/build/` if empty (was accumulating on repeated cancellations)
- Version bumped to 0.26.4 in plugin.json and marketplace.json

## 0.26.3 (2026-03-29)

### Added
- **Custom status line** (`hooks/moku-statusline.sh`) — persistent bottom bar showing Moku phase, wave progress, plugin count, context usage bar (color-coded green/yellow/red), model name, cost, git branch, active agent, and rate limit warnings. Install via `/statusline` or configure `statusLine` in `~/.claude/settings.json`.
- **Desktop notifications** (`hooks/notify.sh`) — macOS (`osascript`) and Linux (`notify-send`) desktop notifications on key events: permission prompts, wave completion, verifier results, stop blocks, session end. Configurable via `enableNotifications` in `.claude/moku.local.md`.
- **Sound alerts** — system sounds on key events: glass (verifier pass), basso (verifier fail), submarine (stop block), hero (build/session complete), tink (permission needed), ping (session end). Configurable via `enableSounds` in `.claude/moku.local.md`.
- **activeForm task spinners** — `TaskCreate` calls in build wave execution now include `activeForm` parameter for live spinner text (e.g., "Building env...") in the task panel during builds.
- **Expanded Plan Mode UI** — `EnterPlanMode`/`ExitPlanMode` now used for build wave plan approval (before first wave starts) and brainstorm context file review (before writing final output). Provides a visually distinct read-only approval experience beyond the original plan Stage 1 usage.
- **First-run setup suggestion** — `detect-moku-project.sh` (SessionStart hook) now detects missing status line configuration and suggests `/statusline` setup on first Moku project detection.
- **Notification integration in hooks** — `log-notification.sh` fires desktop notification on permission prompts; `on-subagent-stop.sh` fires on verifier pass/fail; `check-wave-complete.sh` fires on stop block; `session-end.sh` fires on session end with phase-aware messaging.

### Changed
- `commands/build.md`: added `EnterPlanMode, ExitPlanMode` to allowed-tools; updated Task DAG section with `activeForm` parameter documentation and examples
- `commands/brainstorm.md`: added `EnterPlanMode, ExitPlanMode` to allowed-tools; added plan mode for context file review
- `skills/moku-core/references/build-wave-execution.md`: wave plan now presented in plan mode; `TaskCreate` calls include `activeForm`
- `skills/moku-core/references/plugin-settings.md`: added `enableNotifications` and `enableSounds` to supported settings table
- Version bumped to 0.26.3 in plugin.json

## 0.26.2 (2026-03-29)

### Added
- **Intent Normalization** — all three commands (`/moku:plan`, `/moku:brainstorm`, `/moku:build`) now accept free-form natural language instead of strict structured arguments. "I want to make a static site generator" normalizes to `create framework "a static site generator"`. Structured syntax still works unchanged.
- **Cross-command detection** — each command detects when the user meant a different command and suggests the right one (e.g., `/moku:plan build it` → "Run `/moku:build resume`").
- **Empty-args smart prompts** — `/moku:plan` and `/moku:brainstorm` show contextual `AskUserQuestion` menus instead of raw usage syntax when invoked with no arguments. `/moku:build` with no args auto-resumes from STATE.md.

### Changed
- Command `description` and `argument-hint` frontmatter updated to advertise free-form input support
- Version bumped to 0.26.2 in plugin.json and marketplace.json

## 0.26.1 (2026-03-29)

### Changed
- **`.planning/` restructure** — build artifacts moved to `.planning/build/` workspace. Root now contains only 4 persistent files (STATE.md, steering.md, decisions.md, learnings.md) + specs/ and archive/. Down from 17+ files.
- **Skeleton spec moved to `build/`** — `skeleton-spec.md` and `skeleton-report.md` now live in `.planning/build/`, not root. Never clutter the user's view after initial build.
- **File merges** — `decision-log.md` merged into `decisions.md` (root, persistent). `deferred-findings.md` + `dismissed-findings.md` merged into `findings.md` (build/).
- **`coverage-report.md` renamed** to `coverage.md` in `.planning/build/`.
- **Cycle archive wipes `build/`** — Step 7.5 now archives key artifacts (coverage, findings, skeleton-spec) to `archive/cycle-N/`, then wipes `build/` clean. Context files archived and removed from root.
- **Hook allowlist simplified** — `approve-planning-writes.sh` now uses `.planning/build/*` and `.planning/archive/*` glob patterns instead of individual file entries.
- **Filesystem guards** create `.planning/build/` directory (plan, brainstorm commands).
- All 27 files updated: 8 build references, 6 plan references, 5 agents, 4 hooks, 3 commands, 1 README.
- Version bumped to 0.26.1 in plugin.json and marketplace.json

## 0.26.0 (2026-03-29)

### Added
- **Deliberative steering loop** — Steering Pre-Phase now walks users through one decision at a time with WHY/EXAMPLE/RECOMMENDATION context, "Help me decide" option for discussion, relevance checks to skip redundant questions, and incremental save for session-drop recovery. 6 questions (added CI/CD).
- **`--deep [N]` brainstorm iterations** — optional numeric argument for `--deep` flag (e.g., `--deep 7`). Custom iteration count decoupled from researcher count. Error on `--deep 0` or negative values. No upper cap.
- **Root documentation wave** (Build Step 5.6) — generates comprehensive root README and LLM documentation (`llms.txt` + `llms-full.txt`) for AI-friendly framework consumption.
- **Documentation validation** (Build Step 5.7) — validates completeness, accuracy, usability, and cross-references of all generated documentation.
- **Integration test wave** (Build Step 5.8) — auto-generates comprehensive root-level integration tests. Scenario count driven by plugin count and complexity tiers. Covers core, cross-plugin, user journey, and edge case categories.
- **Coverage verification** (Build Step 5.9) — quantitative test coverage measurement with 80% build gate, per-plugin breakdown, gap closure for low coverage, coverage report generation.
- **CI/CD wave** (Build Step 5.10) — generates GitHub Actions workflows based on user steering choices: PR validation, coverage gate, npm publish, GitHub Releases, container build. Workflows adapted to actual project structure.
- **Cycle archive** (Build Step 7.5) — archives completed build state to `.planning/archive/cycle-{N}/`, resets STATE.md for next development cycle with preserved plugin context.
- **Delta updates** (Build Step 8) — subsequent builds (`add`, `update`) automatically update READMEs, LLM docs, integration tests, coverage, and CI/CD workflows for changed plugins.
- **`/moku:build add {name}`** — new entry point for building a single plugin from a spec created by `/moku:plan add`.
- **CI/CD steering question** — Question 6 in Steering Pre-Phase asks users what CI/CD and distribution they need. Contextual recommendations based on project type. Feeds into Build Step 5.10.

### Changed
- **Plan never builds** — `plan add` now creates a spec only and recommends `/moku:build add {name}`. All verbs end with a build command recommendation, never invoke build steps directly.
- **Migration path parsing** — fallback probe for tokens that don't match path sigils: checks local path first, then `.planning/context-{token}.md`, with disambiguation dialog on conflict.
- Build framework quick reference expanded with all new steps (5.6–7.5 + Step 8)
- STATE.md template updated with QuickMode, Cycle fields and new wave progress rows
- Version bumped to 0.26.0 in plugin.json and marketplace.json

### Fixed
- Stale `add` verb descriptions in plan.md, README.md, and tooling-config.md updated to reflect spec-only behavior
- CI/CD integrated into plan-stages.md Stage 1 steering consumption block
- Context injection CI/CD question now uses two-turn pattern
- `update` verb resume path in build.md now routes to delta updates

## 0.25.7 (2026-03-28)

### Fixed
- **AskUserQuestion text-blocking** — all architectural decisions and challenge presentations now use two-turn pattern: code examples and reasoning in one response, AskUserQuestion in the NEXT response. Prevents dialog overlay from obscuring the content users need to read.
- **Broken heading hierarchy** — replaced all `##` headings in brainstorm output with `**BOLD CAPS**` formatting. Terminal renders all heading levels identically; bold-caps creates actual visual hierarchy.
- **Stale label references** — "Explore fresh directions" handler matched old label, Final User Gate handlers referenced old "Proceed to planning" / "Review context file" labels. All updated to match tightened labels.
- **Duplicate "Other" option** — removed manual "Neither — let me explain" and "None — stay the course" options. System auto-appends free-text "Other" — manual versions wasted an option slot.

### Changed
- **AskUserQuestion descriptions made self-contained** — each option description now includes the full trade-off summary so users can decide even if preceding text scrolled away
- **Labels tightened** to 2-5 words: "Resume (Recommended)", "Accept position", "Fresh directions", "Plan (Recommended)", "Review first"
- **Progress markers** added to each major phase: `Brainstorm: {name} | Phase N/4: {phase} | {depth} mode`
- **`---` horizontal rules** separate information sections from decision sections
- **Key-value metadata** format (`**Category:** create | **Depth:** standard`) replaces bullet lists for metadata
- **moku-planning output style** updated with terminal rendering rules: reliable vs broken GFM features, two-turn AskUserQuestion pattern, formatting hierarchy
- Version bumped to 0.25.7 in plugin.json and marketplace.json

## 0.25.6 (2026-03-28)

### Added
- **Learning maintenance/refresh** — Phase 1a auto-validates learnings against current codebase before surfacing them. Stale entries (referencing deleted plugins/files) are moved to a `## Stale` section instead of deleted, preserving data for manual review.
- **Hook-based brainstorm write enforcement** — new `brainstorm-guard.sh` hook blocks Write/Edit outside `.planning/` during active brainstorm sessions. Uses `.brainstorm-active` marker file with 4-hour stale timeout. SessionEnd hook auto-cleans marker on session close.
- **Proactive ideation** — "Explore fresh directions" option in debate Turn 2. Spawns 2 researcher agents with Inversion and Adjacent Possible lenses to generate out-of-box ideas with TypeScript code sketches. Runs at most once per session (checked via ideation file existence).
- Brainstorm scratch files (`brainstorm-*.md`, `context-*.md`, `learnings.md`, `.brainstorm-active`, `steering.md`, `deferred-findings.md`, `dismissed-findings.md`) added to `approve-planning-writes.sh` auto-approve list

### Changed
- Version bumped to 0.25.6 in plugin.json and marketplace.json

## 0.25.5 (2026-03-28)

### Added
- **Question Validation Protocol** — 5-criteria gate before asking any brainstorm question (auto-detect, architecture impact, obvious answer, code demonstrable, senior-colleague test). Self-audit step with >60% confidence threshold. Target 0–3 questions, hard cap at 5.
- **Compound Learning** — brainstorm sessions extract 3–5 reusable learnings to `.planning/learnings.md` after completion. Future brainstorms auto-surface relevant past learnings during Phase 1a analysis.
- **Cognitive Lenses** — each researcher agent receives a perspective lens (DX & Maintainability, Security & Robustness, Performance & Scalability) to ensure research covers different angles rather than converging.
- **Anti-rubber-stamp** — quality check after challenger returns; if all challenges are LOW severity or generic (no specific position text cited), re-spawn once with combined feedback. Challenger agent now requires at least one MEDIUM or HIGH challenge.
- **Cross-model review** — challenger agent no longer hardcodes `model: sonnet`; inherits parent model for natural diversity with the sonnet-based synthesizer.
- **Write protection** — brainstorm command restricts Write/Edit to `.planning/` directory only, preventing premature code changes during exploration.

### Changed
- Version bumped to 0.25.5 in plugin.json and marketplace.json

## 0.25.4 (2026-03-28)

### Changed
- **Brainstorm command rewrite** — collaborative analysis replaces passive survey
  - Phase 1 now auto-detects complexity from project context (code, DESCRIPTION, workspace) instead of asking 4 fixed-option scoring questions
  - Architectural decisions presented with TypeScript code examples, clear recommendations, and concerns about each alternative
  - 0 questions asked when context is clear — no more forcing users through irrelevant surveys
  - For `migrate` category: source path gathered during brainstorm, carried through context file to plan command (skips "Where is the code?" re-ask)
  - Scratch file renamed from `brainstorm-{NAME}-answers.md` to `brainstorm-{NAME}-analysis.md` to reflect new content
  - Context file template: "Discovery Answers" section replaced with "Analysis Summary" (auto-detected context, scope assessment, architectural decisions)
  - Context file template: added `## Migration Source` section for migrate category (path, tech stack, architecture, LOC, patterns)
- **Init command** — added `/moku:brainstorm` as suggested next step for Framework and Consumer App projects (between init and plan)
- **Plan migrate verb** — checks context file for `## Migration Source > Path` before asking user for source location
- **Next command** — fixed brainstorm-in-progress detection glob pattern (`answers` → `analysis`)
- Version bumped to 0.25.4 in plugin.json and marketplace.json

## 0.25.3 (2026-03-24)

### Fixed
- **Full-cycle audit findings** — 13 fixes from third full-cycle audit run (event-bridge project)
  - **[BLOCKER]** build-skeleton.md S7: Phase value changed from `skeleton/committed` to `complete` — the old value had no routing row in next.md, leaving users stuck after skeleton commit
  - Skeleton template: added JSDoc with `@param` and `@example` to inline `createState`/`api` arrow functions in `createPlugin`/`createCorePlugin` spec objects (fixes `jsdoc/require-jsdoc` on nested arrow functions)
  - Skeleton template: removed `@returns` from throw-only stub functions — `jsdoc/require-returns-check` rejects `@returns` on non-returning bodies
  - Skeleton template: documented `unicorn/consistent-function-scoping` pattern for subscribe-style stubs returning inner arrow functions
  - Skeleton template: fixed `biome-ignore` comment ordering — must be after JSDoc, immediately before the declaration it suppresses
  - Skeleton template: added `@param _ctx` with destructured `@param _ctx.global` and `@param _ctx.config` entries for state factory stubs
  - build-skeleton.md S7: added instruction to populate `## Verification Results` in STATE.md from skeleton-report.md (was left as placeholder)
  - plan-templates.md: `skeleton/building`, `skeleton/verified`, `skeleton/committed` removed from Phase enum (not valid Phase values — skeleton state tracked via `## Skeleton:` field)
  - plan-templates.md: File Structure section now notes only skeleton-created files should be listed (not init-created test files)
  - next.md: empty `.planning/` now presents `AskUserQuestion` with brainstorm and plan options instead of only suggesting plan create
  - status.md: added `Skeleton:` field to dashboard header template
  - plan-verb-create.md: plugin reordering from context file now logs the reorder decision
  - tooling-config.md: added `declarations.d.ts` to ESLint ignores list (eliminates "file ignored" warning in pre-commit hook)

### Changed
- Version bumped to 0.25.3 in plugin.json and marketplace.json

## 0.25.2 (2026-03-23)

### Fixed
- **Full-cycle audit findings** — 17 fixes from second full-cycle audit run (color-pipeline project)
  - Skeleton config.ts template: `createPlugin`/`createCore` now destructured from `createCoreConfig()` return instead of imported directly from `@moku-labs/core`
  - Skeleton plugin templates: `createApi` field renamed to `api` in all 3 template blocks (core, regular, regular+deps)
  - Skeleton `createCoreConfig` call: added required `id` string argument and `config` field in options
  - Skeleton `createState` parameter: fixed from `{ global: Config }` to correct MinimalContext shape with `readonly global` and `readonly config`
  - Skeleton import map: updated to show `createCoreConfig` as only `@moku-labs/core` import, `createPlugin`/`createCore` as self-exports
  - Skeleton events: added stub guidance and verification checklist item for plugins with events in their spec
  - Skeleton types.ts: added note to use concrete types from spec, not `unknown`
  - Build skeleton Step S6: removed `.planning/skeleton-spec.md` from `git add` (`.planning/` is gitignored)
  - Build skeleton Step S2: added barrel file grouping instruction (instances then types)
  - Brainstorm: added closing CTA with next command suggestion after context file is written
  - Init Step 5d: output-styles copy now prints message instead of silent `|| true` no-op
  - Init: `bunfig.toml` must be written before `bun install` for exact version pinning
  - Plan quick mode: STATE.md now written at each stage boundary for session recovery
  - Status dashboard: added `queued` wave status to distinguish build-not-started from build-in-progress
  - Status Quick Actions: contextual "start plugin build" label when no build has started
  - Audit full-cycle: documented hook coverage gap in temp project environment
  - Audit full-cycle: split brainstorm auto-answer rule for single-select vs multiselect discovery questions

### Changed
- Version bumped to 0.25.2 in plugin.json and marketplace.json

## 0.25.1 (2026-03-23)

### Fixed
- **Full-cycle audit findings** — 13 fixes from first full-cycle audit run (task-scheduler project)
  - Skeleton spec template: `createPlugin` import path corrected from `@moku-labs/core` to `../../config`
  - Skeleton barrel: `export type *` replaced with `export * as [PascalCase]` namespace re-exports (avoids type name collisions)
  - JSDoc tags: `@fileoverview` → `@file`, removed redundant `@module` from plugin index.ts templates, all comments converted to multi-line format
  - Skeleton stubs: `return {} as Api` replaced with `throw new Error("not implemented")` (R6 compliance)
  - Skeleton completeness: added README.md and `__tests__/` placeholder files per plugin
  - Handlers wiring: plugins with `handlers.ts` now must import and wire `createHandlers` in skeleton index.ts
  - Init: added `tests/integration/setup.test.ts` placeholder (prevents vitest empty-suite failure on first commit)
- **ESLint unicorn config** — added `ctx`, `fn`, `cb` to `unicorn/prevent-abbreviations` allowList in tooling-config.md
- **Full-cycle audit UX** — added "Keep for inspection" option before temp project cleanup
- **Full-cycle project pool** — all 30 project ideas now specify mixed complexity tiers (Nano→Complex) per project

### Changed
- Version bumped to 0.25.1 in plugin.json and marketplace.json

## 0.25.0 (2026-03-23)

### Added
- **Full-cycle audit mode** (`/moku:audit full-cycle`) — end-to-end workflow audit that drives init → brainstorm → plan → build → next → status in a real temp project
  - Driver agent (`moku-full-cycle-driver`) applies all command steps manually, auto-answering all AskUserQuestion gates via decision table
  - Two reviewer agents (`moku-full-cycle-reviewer`) run in parallel: Focus A (UX + integration) and Focus B (hooks + quality)
  - 30-item project idea pool with history tracking — each run uses a novel, never-tried project
  - `/moku:next` routing validation between every command and twice after build
  - Hook monitoring via diagnostics.log bracket markers — flags false-positives during the cycle
  - Findings grouped by command with severity, evidence, and fix suggestions
  - Export report to `.planning/audit-full-cycle-{date}.md`
- **2 new agents** (full-cycle-driver, full-cycle-reviewer) — 24 agents total
- **New reference file** `audit-full-cycle.md` — auto-answer decision table, observation log schema, hook monitoring protocol, finding type taxonomy

### Changed
- Version bumped to 0.25.0 in plugin.json and marketplace.json
- Plugin description updated to reflect 24-agent count and full-cycle audit capability
- `audit.md` extended with `full-cycle` target in Step 0 dispatch, Step 1 routing, and Steps FC1–FC6

## 0.24.0 (2026-03-23)

### Added
- **Brainstorm command** (`/moku:brainstorm`) — structured pre-planning workflow with adaptive discovery, parallel research, and debate-driven context generation
  - 4 categories mirroring plan verbs: `create`, `modify`, `feature`, `migrate`
  - Adaptive depth: 4 discovery questions score complexity (0–9) → auto-routes to quick (1 agent, 1 debate round), standard (2 agents, 2 rounds), or deep (3 agents, 3 rounds); override with `--deep`/`--quick`
  - Present → Challenge → Decide debate loop with convergence detection
  - Outputs standardized `.planning/context-{NAME}.md` consumed by `/moku:plan ... --context`
- **3 new agents** (brainstorm-researcher, brainstorm-challenger, brainstorm-synthesizer) — 22 agents total
  - `brainstorm-researcher`: domain research with web access, 3 focus modes (ecosystem, technical-patterns, category-specific), runs 1–3 in parallel
  - `brainstorm-challenger`: read-only devil's advocate, 3 angles per review (technical feasibility, scope/cost, wrong assumptions)
  - `brainstorm-synthesizer`: two modes — position mode (iterative during debate) and final mode (context file assembly)
- **3 new reference files** — brainstorm-flow.md (questions, scoring, research orchestration), brainstorm-debate.md (debate loop mechanics, cleanup), brainstorm-templates.md (context file template, position doc schema)
- **Plan command `--context` flag** — `/moku:plan create ... --context context-{NAME}.md` skips steering, discussion, and research phases; synthesizes steering.md from brainstorm context; injects plugin hints into Stage 1 and risk mitigations into Stage 2
- **Next command brainstorm detection** — `/moku:next` now detects in-progress brainstorm sessions and completed context files, routing users correctly

### Changed
- Version bumped to 0.24.0 in plugin.json and marketplace.json
- Plugin description updated to include brainstorm command and 22-agent count
- `plan.md` argument parsing extended with `--context {file}` extraction, STATE.md persistence of CONTEXT_FILE, and verb-specific support warnings
- `plan-verb-create.md` extended with Context Injection Pre-Phase before Steering Pre-Phase

## 0.23.3 (2026-03-23)

### Fixed
- **Plan command audit — 21 fixes across 3 iterative passes (60 scenarios)**
  - **BLOCKER**: Jump Table missing `stage3/approved` row — resume after Stage 3 approval told user to start over, destroying completed work
  - **BLOCKER**: `## Skeleton:` required non-empty at Stage 1 exit but no initial value specified — validation deadlock prevented STATE.md persistence
  - **BLOCKER**: Start-fresh backed up STATE.md without writing replacement — session drop between Start-fresh and next stage exit lost VERB/TYPE/REQUIREMENTS
  - **BLOCKER**: Unrecognized VERB loaded from STATE.md had no error handler — Route to Workflow failed silently
  - **BLOCKER**: Start-fresh template wrote empty `PluginTable`/`WaveGrouping` values (trailing space) — resume validation rejected as malformed, creating unresumable state
  - **BLOCKER**: plan-stages.md Stage 3 unconditionally wrote `Skeleton: not-started`, contradicting plan.md's preservation rule — regressed build-advanced skeleton values
  - **HIGH**: `resume --quick` with stored `QuickMode: false` had undefined precedence — explicit invocation flag now overrides stored value
  - **HIGH**: Auto-detect resolved TYPE but VERB was never set — now defaults to `create`
  - **HIGH**: Token Extraction had no quote-handling semantics — added shell-like tokenization (quoted strings = single tokens)
  - **HIGH**: Auto-detect condition (b) "Moku framework package" was unimplementable — replaced with concrete `@moku-labs/*` pattern
  - **WARNING**: `update plugin` PLUGIN_NAME extraction undocumented in plan.md — added cross-reference to plan-verb-update.md; Step 5 retitled "add verb only"
  - **WARNING**: `--quick` strip said "strip it" (singular) but "anywhere" (plural) — changed to "strip all occurrences"
  - **WARNING**: Skeleton rule only protected Stage 1/2 exits — extended to all stage exits with "never regress build-advanced value" rule
  - **WARNING**: Step 0.1 "Load QUICK_MODE from state" could overwrite invocation-time flag — added precedence note
  - **WARNING**: VERB=resume stored in STATE.md got confusing "unrecognized" error — added special-case message explaining resume is invocation-only
  - **WARNING**: Auto-suggest fired even when `--quick` explicitly passed — now skipped when QUICK_MODE already true
  - **WARNING**: Unrecognized first word silently polluted REQUIREMENTS — documented as intentional (useful context)
  - **WARNING**: Jump Table complete+update "Set Phase: none" was ambiguous (in-place vs full rewrite) — clarified as in-place edit preserving all other headers
  - **WARNING**: User REQUIREMENTS "(none)" collided with internal sentinel — added guard to re-prompt
  - **WARNING**: Route to Workflow context handoff undocumented — added note that all Step 0 parsed values are available in routed reference files
  - **INFO**: PluginTable/WaveGrouping format for multi-plugin tables (deferred — works in practice)

### Changed
- Version bumped to 0.23.3 in plugin.json and marketplace.json.
- plan-stages.md Stage 3 State Update updated with Skeleton preservation rule (cross-file consistency fix).

## 0.23.2 (2026-03-20)

### Fixed
- **Plan command audit — 15 fixes across 1 pass (20 scenarios)**
  - **BLOCKER**: migrate `PATH_OR_LINK` now retries on empty AskUserQuestion response (2 attempts, then stop with error)
  - **HIGH**: Startup sequence explicitly numbered (1. filesystem guard → 2. empty-args check) resolving ordering ambiguity
  - **HIGH**: Path traversal resolution specified as `realpath -e` with fallback for non-existent paths
  - **MEDIUM**: `add plugin` PLUGIN_NAME extraction added as new step 5 in Token Extraction
  - **MEDIUM**: `--quick` auto-suggest placement specified ("after plugin table assembly, before Stage 1 approval gate")
  - **MEDIUM**: File preservation contradiction resolved — "Start fresh" now preserves `decisions.md` and `research.md` (aligned with jump table behavior)
  - **MEDIUM**: Phase reset value after `complete`+`update` explicitly set to `## Phase: none`
  - **MEDIUM**: Suggestion construction rule for invalid verb-type combos (fix TYPE first, then VERB)
  - **MEDIUM**: Header inline-colon format documented; `## Skeleton:` added as 8th required header in validation set
  - **MEDIUM**: Path verification mechanism specified (`test -d && test -r`)
  - **MEDIUM**: Token pointer on unrecognized first word — "do not advance, leave stream intact"
  - **MEDIUM**: REQUIREMENTS after auto-detect clarified — remaining unparsed tokens become REQUIREMENTS
  - **MEDIUM**: Phase=none guard skips unnecessary resume prompt on fresh projects
  - **MEDIUM**: QUICK_MODE persisted on first STATE.md write (not deferred to stage exit) — prevents session-drop data loss
  - **MEDIUM**: Plan Mode quick mode transition documented (ExitPlanMode → immediate Stage 2)

### Changed
- Version bumped to 0.23.2 in plugin.json and marketplace.json.

## 0.23.1 (2026-03-20)

### Fixed
- **`#wave:N` parsing and validation** — added explicit rule 1e in Step 0 with integer validation, immediate bounds checking (catches `#wave:abc`, `#wave:-1`, `#wave:`, and out-of-range values before dry-run exits), and `waveOverride` storage.
- **`#wave:N` + completed build check** — `#wave:N` now bypasses the "build already complete" guard, enabling intentional wave re-execution with automatic plugin status reset.
- **`framework config`/`plugins` sub-modes** — added routing logic in Step 0 rule 3 with `## Mode:` STATE.md field, config.ts precondition guard for plugins-only mode, and mode restoration on resume.
- **`--dry-run` + `--continue` conflict** — mutual exclusivity check (rule 1b) now rejects contradictory flags.
- **`--lean` + `--dry-run` state mutation** — lean mode is output-format-only when dry-run is active; does not write `## LeanMode: true` to STATE.md.
- **Auto-lean "session" definition** — explicitly defined as a single `--continue` invocation; auto-lean does not trigger in default one-wave-per-invocation mode.
- **Concurrency guard overhaul** — moved to pre-condition block with 5-minute staleness guidance and explicit "Stop" outcome.
- **Resume `## Verb: fix` routing** — resume now reads `## Verb:` from STATE.md and routes interrupted fix sessions to Error Recovery automatically.
- **Resume `## Mode:` restoration** — resume now reads `## Mode:` from STATE.md to restore plugins-only/config-only sub-modes.
- **Resume `## LeanMode:` restoration** — resume now explicitly reads and reactivates lean mode from STATE.md.
- **Skeleton option label alignment** — `verified` row options now match `build-skeleton.md` Step S5 (Approve and commit / Adjust skeleton / Show details).
- **`--continue` skeleton gate clarification** — verified row now explicitly states --continue does not bypass approval and resumes automatically after commit.
- **Held flags note in skeleton in-progress** — `#wave:N` and `--continue` re-application after skeleton commit now documented inline.
- **`fix --all` zero-match guard** — stops with informational message when no plugins need fixing.
- **`fix` reserved word guard** — `fix resume`, `fix framework`, etc. now rejected with clear error instead of searching for nonexistent plugin.
- **Error Recovery dual entry points** — section opening now documents both `fix` argument and `resume` → `## Verb: fix` entry paths.
- **Error Recovery prerequisite ordering** — checks now explicitly ordered: (1) skeleton prerequisite, (2) zero-match guard, (3) multi-plugin prompt.
- **Pipeline Status freshness check** — stale `## Pipeline Status` (predating last `## Git Checkpoint`) is discarded before reconciliation.
- **State Write Protocol `.bak` semantics** — documented as single-depth undo (not accumulating backup).
- **Post-wave code review triage** — added inline summary of key triage behaviors (skipTriage, BLOCKER blocking, Fix now / Fix later routing).
- **Stalemate detection cross-reference** — explicit pointer to `build-verification.md` Step 4c for error signature hashing algorithm.
- **Step 0 rule evaluation order** — explicit statement that rules 1–1e are evaluated in order with short-circuit.
- **`#wave:` empty N** — added to error message examples for completeness.
- **Plugin status reset** — documented how `#wave:N` resets wave plugins from `complete` to `building`.

### Changed
- Version bumped to 0.23.1 in plugin.json and marketplace.json.

## 0.23.0 (2026-03-20)

### Added
- **`/moku:next` command** — auto-detects project state from STATE.md and routes to the next logical step. Supports `--dry-run` to preview without executing. Resolves the most common UX gap identified in competitive analysis (GSD, Taskmaster, and Compound Eng all have auto-advance).
- **Explicit scoring rubrics for wave-judge** — all 5 evaluation dimensions (verification health, code quality trajectory, test coverage, integration stability, blocker severity) now have concrete 1-5 rubric tables with specific criteria per score.
- **Adversarial scenario examples** — audit-scenario-generator now includes 7 concrete categories: shell injection, path traversal, keyword mimicry, unicode/special chars, state poisoning, conflicting flags, boundary values.
- **App migration flow** — plan-verb-migrate.md now covers app-to-Moku migration (framework identification, route mapping, custom plugin detection, import rewriting) in addition to the existing framework migration.
- **Error handling for migration** — circular dependency detection with `MIGRATION BLOCKER` flags, unrecognizable project structure handling.
- **Complete configuration schema** — build.md now documents ALL config keys with `Used By` column: `maxParallelAgents`, `gapClosureMaxRounds`, `skipValidation`, `skipTriage`, `enablePipelining`, `leanMode`, `auditMaxScenarios`, `auditIterateLimit`.

### Fixed
- **README agent count** — corrected from "15 total" to "19 total" with proper categorization: 4 structural, 5 quality, 3 review/judgment, 2 supporting, 5 audit.
- **Build argument hints** — frontmatter now includes `resume`, `fix`, and `--lean` (previously missing from discoverability).
- **Skeleton routing ambiguity** — build.md now explicitly states that held arguments (`resume`, `--continue`, `#wave:N`) are communicated to the user and re-applied after skeleton is committed.
- **STATE.md write race condition** — build.md now uses atomic tmp→rename protocol (matching plan.md) with concurrency guard that detects stale `.tmp` files.
- **SHA-1 hash in lazy validation** — validation-coordinator changed from `shasum` to `shasum -a 256` for hash-based caching.
- **Plan checker decisions.md format** — now specifies expected H2 + list-item format with graceful fallback for non-standard files.
- **Hook silent failures** — validate-plugin-structure.sh and validate-plugin-index.sh now emit JSON context warning when neither jq nor python3 is available (instead of silent exit 0).
- **Dry-run skeleton-spec format** — build.md now documents both file path conventions (H3 sub-headers and code-block first-line comments).
- **Fragile sonarjs assertion** — tooling-config.md now has explanatory comment and fallback guidance for the `!` non-null assertion.
- **.planning/ directory guard** — plan.md now has a mandatory `mkdir -p .planning/` as the first action (previously buried in prose at Step 0).

### Changed
- **Agent memory semantics documented** — `memory: local` (project-scoped) and `memory: user` (cross-project) now have inline documentation in agent frontmatter.
- **Model tiers per validator documented** — validation-coordinator now has a full table showing default model, role, and estimated tokens per agent, plus complexity-based override rules.
- **Config schema centralized** — plan.md references build.md as the authoritative source for all configuration keys. No more fragmented documentation.
- **Status dashboard** — quick actions section now suggests `/moku:next` as a tip.
- Version bumped to 0.23.0 in plugin.json and marketplace.json.

## 0.22.0 (2026-03-19)

### Added
- **Lean execution mode** — `--lean` flag and `leanMode: "auto"` config strip verbose context from agent prompts during builds (~40-60% context savings). Auto-activates after 3+ waves in a session. New reference `build-lean-mode.md` with stripped prompt templates and context budget guidelines.
- **Lean mode persistence** — `## LeanMode:` field in STATE.md carries across sessions.

### Changed
- **Build command** — added `--lean` flag parsing, lean mode integration with wave pipelining (halves context cost while pipelining doubles throughput), auto-activation threshold (3+ waves).
- **Builder prompts** — lean mode strips framework config, dependency interfaces, and design decisions sections when plugin has no cross-plugin dependencies.

## 0.21.0 (2026-03-19)

### Added
- **Wave pipelining** — when `--continue` is active and project has 3+ waves, Wave N+1 builders start while Wave N is being verified (~30-50% throughput gain). New section in `build-wave-execution.md` covers pipeline reconciliation: interface hash comparison, `pipeline-built` status, and hash-changed rebuilds. Disable with `enablePipelining: false`.
- **Pipeline reconciliation** — after pipelined build completes, interface file hashes from `## Pipeline Status` in STATE.md are compared against current hashes on disk. Unchanged → promote to `built`; changed → reset and re-spawn.
- **Pipeline-Built Check** — STATE.md `pipeline-built` status handled on resume.

### Changed
- **STATE.md template** — added `## Pipeline Status:` section for interface hashes.
- **Build command** — added pipeline reconciliation step to State Check.

## 0.20.0 (2026-03-19)

### Changed
- **Validation documentation** — updated validator references and verification steps for consistency across all agents.
- Version bumped to 0.20.0 in plugin.json and marketplace.json.

## 0.19.0 (2026-03-18)

### Added
- **Multi-pass code review** — new `build-multi-pass-review.md` reference. Post-wave code reviewer now runs 4 focused passes: correctness, security, performance, maintainability. Each pass produces prioritized findings (P1–P3). Integrated into build-verification as Step 4a2.
- **Regression testing** — after each wave (Wave 1+), all previously verified plugins are retested (`bunx tsc --noEmit` + `bun run test`). Catches cross-plugin regressions introduced by the current wave. New section in `build-verification.md`.

### Changed
- **Build command** — framework build flow now includes `regression test` step after Wave 1+.
- **Code reviewer agent** — expanded from single-pass to multi-pass protocol.

## 0.18.0 (2026-03-18)

### Added
- **Conflict resolution protocol** — new `build-conflict-resolution.md` reference. When validators in the same group produce contradictory findings (verdict disagreements, severity disagreements, contradictory fixes on same file ±5 lines), the coordinator classifies them as information gap, genuine trade-off, false positive, or scope mismatch — and resolves accordingly.
- **Decision knowledge graph** — new `decision-knowledge-graph.md` reference. Records architectural trade-off decisions from conflict resolution and user approvals in `.planning/decision-log.md`. Builder agents receive relevant decisions as "DO NOT CONTRADICT" context.
- **Steering pre-phase** — plan-verb-create.md now includes an optional discussion phase (2–5 questions) and research phase (moku-researcher spawn) before Stage 1 analysis. Discussion results saved to `.planning/decisions.md`, research to `.planning/research.md`.

### Changed
- **Validation coordinator** — added intra-group conflict detection and resolution steps between Group A and Group B.
- **Wave judge** — added conflict resolution log as input (high unresolved count → lean toward `stop-for-review`).
- **Error diagnostician** — reads decision-log.md to avoid proposing fixes that contradict recorded decisions.
- **STATE.md template** — added `## Decisions:` and `## Research:` field tracking.

## 0.17.0 (2026-03-18)

### Added
- **TDD protocol reference** — new `tdd-protocol.md` in moku-testing skill with four phases (Types → Red → Green → Refactor), output contract extensions for builder agents, core plugin adaptations, and edge case handling.
- **Interactive findings triage** — new `build-findings-triage.md` reference. After validation, blockers and warnings are presented to the user via `AskUserQuestion` for interactive disposition: fix (enter gap closure), defer (mark as known issue), or dismiss (false positive). Deferred items recorded in decision-log.md.
- **Builder intent verification** — builder prompts now include TDD protocol summary requiring tests-before-implementation ordering.

### Changed
- **Build command** — added `skipTriage: true` config option to bypass interactive triage.
- **moku-testing SKILL.md** — expanded with TDD protocol summary and reference to the full protocol file.
- **Wave execution** — builder sub-agent prompts now include design decisions from `.planning/decision-log.md`.
- **Plan stages** — discussion phase questions refined for better decision capture.

## 0.16.2 (2026-03-18)

### Changed
- **Full command audit** — 43 fixes across all 5 commands (`plan`, `build`, `check`, `status`, `init`) in 8 iterative self-audit passes. Key improvements: stricter argument validation, better error messages, edge case handling for missing/corrupt state.

## 0.16.1 (2026-03-18)

### Changed
- **Build command audit** — 33 fixes from 3-pass iterative audit. Key improvements: dry-run skeleton reporting, plugin spec resolution hardening, error recovery prerequisite checks, continuous mode context exhaustion detection.

## 0.16.0 (2026-03-18)

### Added
- **`moku-code-reviewer` agent** — post-wave code review agent (116 lines) catching logic errors, spec deviations, security vulnerabilities, and Moku anti-patterns. Runs after verification passes in build-verification Step 4a2.
- **Output styles** — `moku-building.md` (terse, progress-focused) and `moku-planning.md` (verbose, analytical) for context-appropriate formatting.
- **Task DAG progress tracking** — build command uses `TaskCreate`/`TaskUpdate` for live progress UI during wave execution (parent task per wave, child per plugin).
- **Audit self-learning** — audit command now saves severity calibration and scenario effectiveness data to `.planning/audit-learning.md` for improved future audits.
- **Plan mode integration** — plan command uses `EnterPlanMode`/`ExitPlanMode` during Stage 1 analysis for read-only exploration.

### Changed
- **AskUserQuestion UX** — all user-facing questions across plan, build, and audit commands now use structured `AskUserQuestion` with labeled options, descriptions, and multiSelect control instead of freeform prompts.
- **Build verification** — post-wave code review spawned after verification passes.
- **Audit command** — enhanced with self-learning persistence, cross-audit correlation for `all` target, severity calibration from past audit data.
- **Plan command** — discussion and research phases use `AskUserQuestion` for better interaction.
- **Init command** — multiple robustness improvements from audit feedback.

## 0.15.1 (2026-03-18)

### Changed
- **`commands/plan.md`** — 21 fixes from 3-pass iterative audit. Key improvements:
  - **Resume flow hardened** — resume guard skips token extraction, Phase-to-Stage Jump Table with `none`/unrecognized fallback, explicit phase transition protocol (`pending-approval` → `approved`)
  - **STATE.md robustness** — read-time validation (presence + non-empty values), expanded schema (7 required headers including `PluginTable`, `WaveGrouping`, `QuickMode`), write validation with halt-on-failure, inline-colon format enforcement
  - **Argument parsing tightened** — VERB-as-TYPE rejection guard, empty REQUIREMENTS prompt for `create`/`update`, migrate REQUIREMENTS exemption (PATH_OR_LINK is primary input), backward-compat wording clarified, auto-detect follow-through with retry
  - **State management** — "start fresh" backup+cleanup, "continue" with new REQUIREMENTS confirmation, add-verb guard bypasses resume prompt, QuickMode persistence across sessions via `## QuickMode:` header
  - **Quick mode defined for all verbs** — `create`/`update` collapse stages, `resume` applies to remaining stages, `migrate` passes through, `add` always quick

## 0.15.0 (2026-03-17)

### Added
- **`verify-before-commit.sh`** — new PreToolUse hook (Bash) gates checkpoint commits with `bunx tsc --noEmit` + `bun run lint` verification. Blocks commits during active build waves if TypeScript or lint errors exist. Ensures no broken code enters git history.
- **`pre-commit-review.sh`** — new PostToolUse hook (Bash) runs lightweight self-review after checkpoint commits. Detects stubs, TODO markers, console.log statements, and re-runs tsc/lint. Injects findings as additionalContext for immediate visibility.
- **`agents/wave-judge.md`** — new **moku-wave-judge** agent completing the Planner/Worker/Judge triad. Evaluates wave quality on 5 dimensions (verification health, code quality trajectory, test coverage, integration stability, blocker severity) and outputs a continuation decision: `continue`, `stop-for-review`, or `fresh-retry`. Includes fixation detection for gap closure loops.
- **Fresh-Context Retry (Ralph Wiggum Loop)** — new Step 4c2 in `build-verification.md`. When gap closure exhausts its rounds, saves error summary to STATE.md `## Fresh Retry Context` section, sets plugins to `retry-pending`, and stops. On resume, spawns error-diagnostician with only the error context (no accumulated conversation), avoiding fixation loops. Pattern validated as industry best practice in 2026.
- **Resume with `retry-pending`** — `build-wave-execution.md` now handles `retry-pending` plugin status on resume, routing through fresh-context diagnostician before re-verification.
- **Wave Judge integration** — new Step 4c3 in `build-verification.md`. After gap closure (or if verification passed cleanly), spawns moku-wave-judge to evaluate wave quality before proceeding. Skipped for trivial waves (1 Nano/Micro plugin, zero warnings).

### Changed
- **`on-subagent-stop.sh`** — enhanced agent decision tracing. Now extracts `verdict`, `decision`, `blockers` count, and `warnings` count from agent JSON output contracts. Agent log entries show `PASS [continue] B:2 W:1` instead of just `completed`. Falls back gracefully if no JSON contract found.
- **`diagnostics-logger.sh`** — added `SELF-REVIEW` and `COMMIT-GATE` diagnostic categories.
- **`hooks.json`** — added PreToolUse Bash matcher for `verify-before-commit.sh` (timeout: 60s) and PostToolUse Bash matcher for `pre-commit-review.sh` (timeout: 30s).

## 0.14.0 (2026-03-17)

### Added
- **`auto-permissions.sh`** — new PermissionRequest hook auto-approves safe operations (read-only tools, project-scoped writes, safe bash commands) and blocks dangerous ones (sudo, force-push, rm -rf /, pipe-to-shell). Eliminates manual permission prompts for routine operations.
- **`check-wave-complete.sh`** — new Stop hook prevents Claude from stopping mid-wave during builds. Includes `stop_hook_active` guard against infinite loops.
- **`log-tool-failure.sh`** — new PostToolUseFailure hook logs tool errors to `.planning/diagnostics.log`. Skips user interrupts.
- **`diagnostics-logger.sh`** — shared logging library sourced by all hooks. Writes structured `[CATEGORY] target: message` entries to `.planning/diagnostics.log` for post-session analysis.
- **`.planning/moku.md`** — project marker file created on first session start. Caches project type, name, and core version for fast detection by all hooks (replaces per-hook `grep` on `src/config.ts`).
- **`commands/status.md`** — added `diagnostics` flag and diagnostics dashboard section reading `.planning/diagnostics.log`.
- **`commands/audit.md`** — added diagnostics log pattern analysis to hooks audit mode with `[c]` clear/archive option.

### Changed
- **`check-plugin-antipatterns.sh`** — migrated 6 deny responses from JSON `permissionDecision` output to idiomatic `exit 2` + stderr. Added diagnostics logging on each denial.
- **`validate-plugin-index.sh`** — migrated 2 deny responses to `exit 2` + stderr with diagnostics logging.
- **`validate-plugin-structure.sh`** — added diagnostics logging for structure warnings.
- **All hook guards** — replaced `grep -qE 'createCoreConfig|@moku-labs' src/config.ts` with `[ -f .planning/moku.md ]` check in 6 hooks. Only `detect-moku-project.sh` retains grep-based detection (as the marker creator).
- **`detect-moku-project.sh`** — creates `.planning/moku.md` marker on first detection, reads from it on subsequent sessions.
- **`approve-planning-writes.sh`** — added `moku.md` and `diagnostics.log` to auto-approve allow-list.
- **`hooks.json`** — added PermissionRequest, Stop, and PostToolUseFailure event entries.

### Removed
- **`auto-permissions.sh`** — removed hardcoded `/Users/alex/Projects/moku/*` path. `$CWD` check handles project-scoped writes.
- **`.claude/settings.local.json`** — trimmed 69 accumulated permission rules to 0. Auto-permissions hook handles all cases.

## 0.13.7 (2026-03-16)

### Fixed
- **`precompact-state.sh`** — `re.escape` trailing backslash from herestring `\n` caused `grep -iE` to fail with "trailing backslash" when NEXT_ACTION contained regex metacharacters. Added `.rstrip()` before `.rstrip('|')`.
- **`precompact-state.sh`** — `## Skeleton:` field was missing from the pre-compaction header loop (present in postcompact but not precompact).
- **`user-prompt-context.sh`** — `grep -c` with `|| echo 0` produced double-valued `WAVES_DONE` ("0\n0") when zero matches, causing `integer expression expected` error.
- **`approve-planning-writes.sh`** — shell glob `*` in case patterns matched `/`, allowing path traversal like `.planning/specs/../../etc/passwd.md` to pass the allow-list. Added `..` rejection guard. Also added absolute-path fallback patterns for macOS symlink resolution differences.
- **`on-subagent-stop.sh`** — unvalidated `|` in AGENT_TYPE/STATUS could corrupt the Markdown table in agent-log.md. Added pipe character sanitization.
- **`log-notification.sh`** — multiline `message` fields (with embedded `\n`) produced multiple log entries per notification. Added newline flattening.

## 0.13.6 (2026-03-16)

### Fixed
- **All hook scripts** — hooks were receiving empty input because `$TOOL_INPUT` is not a real environment variable. All scripts now read from stdin via `INPUT=$(cat)` per the official Claude Code hooks API.
- **All PreToolUse hook scripts** — JSON extraction paths used `.file_path` at the top level, but PreToolUse input nests tool parameters under `.tool_input`. Updated all jq/python3 paths to `.tool_input.file_path`, `.tool_input.content`, etc.
- **`format-on-save.sh`** — was formatting the entire project on every Write/Edit because `$TOOL_INPUT` env var was always empty. Now reads stdin and formats only the changed file.
- **`validate-plugin-structure.sh`** — JSON injection via unescaped `PLUGIN_NAME` in echo-constructed JSON. Replaced with `jq -Rs` safe encoding. Also fixed `types` import grep false-positive matching `types-utils`, `typesafe-actions`, etc.
- **`on-subagent-stop.sh`** — TOCTOU race condition on `agent-log.md` creation when parallel subagents complete simultaneously. Uses `set -o noclobber` for atomic header creation.
- **`precompact-state.sh`** — regex metacharacter escaping via `sed` was a no-op on macOS BSD sed. Replaced with portable `python3 re.escape()` approach.

### Changed
- **`hooks.json`** — removed `"$TOOL_INPUT"` from all command strings (not a real env var). Added `"async": true` to `format-on-save.sh` PostToolUse hook so formatting runs in background without blocking Claude. Added `PostCompact` hook entry.
- **`approve-planning-writes.sh`, `check-plugin-antipatterns.sh`, `validate-plugin-index.sh`** — migrated from deprecated `{"decision":"block"}` / `{"decision":"approve"}` output format to modern `hookSpecificOutput.permissionDecision` API (`"deny"` / `"allow"`).
- **`validate-plugin-structure.sh`** — warnings now use `hookSpecificOutput.additionalContext` instead of invalid `{"decision":"warn"}` which was silently ignored.
- **`check-plugin-antipatterns.sh`, `validate-plugin-structure.sh`, `validate-plugin-index.sh`** — added Moku project detection guard (`createCoreConfig`/`@moku-labs` check) so hooks exit instantly for non-Moku projects.
- **`check-plugin-antipatterns.sh`** — expanded test file exclusions to cover `*.test.tsx`, `*.spec.tsx`, `*/__tests__/*`, `vitest.setup.ts`, `vitest.config.ts`, `*.mock.ts`, `*.mock.tsx`, `*.fixture.ts`.

### Added
- **`postcompact-state.sh`** — new PostCompact hook that re-injects critical STATE.md fields (Phase, Verb, Target, Next Action, active waves) into Claude's context after compaction completes, ensuring planning state survives context compression.

## 0.13.5 (2026-03-12)

### Changed
- **`skills/moku-core/SKILL.md`, `skills/moku-plugin/SKILL.md`, `skills/moku-web/SKILL.md`** — replaced all bash inline (`!`` `) directives in "Advanced References" sections with plain prose instructions. Shell one-liners in skill files execute at load time and have caused permission prompts and exit-code noise; static prose is simpler and equally actionable.

## 0.13.4 (2026-03-12)

### Added
- **`validate-plugin-index.sh`** — new deterministic shell hook replacing the prompt-based `type: prompt` validator for `plugins/*/index.ts`. Checks rule1 (≤30 lines, Write only), rule3 (onStart/onStop require a real resource method call); rule2 (explicit type params) is already covered by `check-plugin-antipatterns.sh`. Fast-path exits 0 instantly for all non-plugin-index files — zero latency on every other write.

### Changed
- **`hooks.json` plugin index validator** — replaced `type: prompt` entry (LLM-based, 15 s timeout, prone to preamble false-blocks) with `type: command` pointing to `validate-plugin-index.sh` (5 s timeout, deterministic, no model call).
- **`commands/init.md`** — multiple robustness improvements:
  - Added **Step 0** gate requiring `tooling-config.md` to be read before any files are written; eliminates fabricated version numbers.
  - Tightened **Step 1** to collect Consumer App framework package name upfront instead of mid-flow.
  - **Step 2** uses `mkdir -p` (idempotent), skips `git init` when `.git` already exists, and confirms before overwriting non-empty directories.
  - **Step 3** adds `-y` to `bun init` and uses absolute paths throughout; documents why `rm` works before `.claude/settings.local.json` exists.
  - **Step 5b** (`lefthook install`) is now an explicit named step with a failure gate.
  - **Step 5c** (format) renamed from Step 5b for clarity.
  - **Verification checklist** — item 3 uses `bun run lint` (not format), item 7 explicitly checks Consumer App has no `@moku-labs/core` direct dependency, item 8/9 updated to match new step numbering.
  - Consumer App `src/index.ts` and `src/config.ts` templates now use a placeholder instruction to substitute the actual project name rather than hardcoding `"my-framework"`.
- **`skills/moku-core/SKILL.md`, `skills/moku-web/SKILL.md`** — replaced `test … && echo` shell one-liners in bash inlines with `awk 'END{if(NR>N)print …}'` to avoid `test` exit-code 1 being swallowed as a skill load error.

## 0.13.3 (2026-03-11)

### Fixed
- **`check-plugin-antipatterns.sh` empty-object assertion regex** — removed erroneous `^\s*` anchor from `{} as` pattern so it also catches inline usages (not just line-start).
- **`hooks.json` prompt hook wording** — rewrote gatekeeper prompt with stronger output constraints ("Your ENTIRE response must be exactly one of…") and an explicit closing REMINDER line; reduces residual cases where the model adds preamble before the verdict.
- **`log-notification.sh` python3 eval** — replaced `eval` + complex quoting with direct subshell capture per field (same pattern applied to `check-plugin-antipatterns.sh` in v0.13.2), eliminating quoting hazards.
- **`precompact-state.sh` regex injection** — user-supplied `KEYWORDS` string was passed directly into `grep -iE`; special regex characters could cause grep to error or match unintentionally. Now escaped with `sed` before use; falls back to `__NOMATCH__` when keywords are empty.
- **`validate-plugin-structure.sh` test directory exclusions** — depth check only excluded `__tests__`; directories named `tests/` or `spec/` (common Vitest conventions) were still flagged. Added `*/tests/*` and `*/spec*` to the exclusion list.

## 0.13.2 (2026-03-11)

### Fixed
- **`check-plugin-antipatterns.sh` python3 fallback** — replaced `eval` + here-doc approach with direct subshell capture per field; eliminates quoting hazards with special characters in file paths or content.
- **`check-plugin-antipatterns.sh` null-assertion regex** — `null as ` was too broad, matching safe casts like `null as unknown`. Tightened to `null as [A-Za-z_]` so only concrete type assertions are flagged.
- **`detect-moku-project.sh` printf format** — replaced bare `printf "$WARNINGS"` with `printf '%b' "$WARNINGS"` to avoid format-string injection when warnings contain `%` characters.
- **`format-on-save.sh`, `precompact-state.sh`, `user-prompt-context.sh`** — replaced `grep -q 'a\|b'` with `grep -qE 'a|b'` throughout; POSIX `grep` treats `|` as a literal character without `-E`, silently breaking alternation.
- **`hooks.json` prompt hook routing** — rewrote prompt to use explicit sequential routing rules (non-plugin index.ts → approve immediately) so the model outputs a bare `approve` or `deny:` with no preamble, eliminating the false-block that occurred when the model generated explanatory text.
- **`on-subagent-stop.sh` double-parse** — consolidated `agent_type` and `status` extraction into a single JSON parse pass; removes a second `<<<` redirect that re-read stdin after it was already consumed.
- **`session-end.sh` stale cleanup** — removed `hook-debug.log` deletion that was left over from debugging; debug log is no longer created so the `rm` was a no-op.
- **`user-prompt-context.sh` plugin listing** — replaced `ls src/plugins/` with `find … -mindepth 1 -maxdepth 1 -type d` to avoid parsing ls output and correctly exclude files in the plugins root.
- **`validate-plugin-structure.sh` nesting depth** — depth check used `mindepth 3 / maxdepth 3` relative to repo root, so a plugin two levels deep never triggered. Corrected to `mindepth 2 / maxdepth 2` relative to the plugin directory.

## 0.13.1 (2026-03-11)

### Fixed
- **Prompt hook false-block (root cause)** — restructured prompt hook to make `approve` the explicit default and blocking the exception. Previous phrasing caused the LLM to generate explanatory text instead of the bare word, which the framework treated as a block.
- **`approve-planning-writes.sh` allow-list gaps** — added `.planning/skeleton-spec.md`, `.planning/STATE-history.md`, and `.planning/audit-*.md` to the auto-approve list. All three are written by commands but were missing, causing unnecessary hook friction.
- **`check-plugin-antipatterns.sh` overly broad file matcher** — `*/index.ts` and `*/config.ts` matched top-level source files (e.g. `src/index.ts`), triggering anti-pattern checks on non-plugin code. Tightened to `*/plugins/*/index.ts` and `*/plugins/*/config.ts`.
- **`validate-plugin-structure.sh` test file count** — source file count included `*.test.ts` and `*.spec.ts` at the plugin root, causing false-positive "too many files" warnings. Excluded test files from the count.
- **`on-subagent-stop.sh` result column** — hardcoded `completed` regardless of outcome. Now reads `.status` from tool input and falls back to `completed` only when absent.
- **`moku-audit-hooks-analyzer` agent blocked at spawn** — agent had `skills: ["moku-core"]` which loaded a skill with `$()` bash inlines that Claude Code's permission checker blocked. Removed the unused skill dependency.

### Changed
- **`/moku:audit hooks` workflow** — H1 detects plugin source path (`SOURCE_HOOKS_DIR`) via `./hooks/hooks.json` check. H2 replaced agent spawn with inline analysis (more reliable, no spawn-blocking risk). H3 writes fixes to both cache (`${CLAUDE_PLUGIN_ROOT}/hooks/`) and source (`SOURCE_HOOKS_DIR/`) when both are present; documents python3 Bash fallback for when Edit/Write is blocked on `hooks.json` itself.

## 0.13.0 (2026-03-11)

### Added
- **`/moku:audit` command** — new self-auditing command that reads a moku command file, generates test scenarios (valid, edge, error, adversarial), simulates execution step-by-step, runs a subset in a real temp project, identifies gaps, and proposes a concrete improved version with a unified diff. User approves before changes are written.
  - `plan`, `build`, `check`, `status`, `init` — audit any command
  - `hooks` — dedicated hooks audit mode (see below)
  - `all` — audit all commands + hooks sequentially
  - `--sim-only` — skip real execution (faster)
  - `--iterate` — re-audit after applying fixes (up to `auditIterateLimit` passes, default 3)
  - `--max-scenarios N` — per-run scenario cap override
  - AUDIT-STABLE declaration when zero blockers + ≤2 warnings across all scenarios
- **`moku-audit-scenario-generator` agent** — reads a command's full argument patterns, conditional branches, and documented modes; generates a structured scenario list in 4 categories with execution-value markers for real-execution selection.
- **`moku-audit-simulator` agent** — simulates scenarios as pure text analysis (no bash, no file I/O); uses the error-diagnostician reasoning protocol (materialize per-scenario traces before writing gaps); runs in parallel batches on haiku for speed.
- **`moku-audit-executor` agent** — runs high-execution-value scenarios in a bootstrapped temp project using Bash+Write+Read; manually applies command steps and captures real divergences; always cleans up temp directory.
- **`moku-audit-synthesizer` agent** — deduplicates gaps from all simulator + executor outputs; builds a priority table by severity and agent-agreement count; produces a unified diff and complete improved command text for user approval.
- **`moku-audit-hooks-analyzer` agent** — tests every hook script with real inputs via Bash; analyzes the prompt hook for the false-block root cause (insufficient output constraints); checks allowlists for completeness (detects missing `skeleton-spec.md`); proposes concrete fixes for `hooks.json` and `.sh` files.
- **`audit-framework.md` reference** — shared taxonomy for scenario categories (valid/edge/error/adversarial), gap types (10 types including silent-failure, state-corruption-risk, user-experience-gap), temp project bootstrap templates, circuit breaker thresholds, and diff generation rules.

## 0.12.1 (2026-03-11)

### Changed
- **Plugin barrel architecture (`build-assembly.md`)** — replaced 3-section barrel (Instances + Helpers + Namespaced Types) with 2-section barrel (Plugin Instances → Plugin Types). Helpers are never exported from the barrel; types use plain `export type *` instead of namespace-qualified `export type * as Namespace`. Updated `src/index.ts` pattern to require `pluginConfigs` in `createCore` with JSDoc per-property comments, and simplified to 2 export sections (`Plugins + Types` → `Framework API + Plugin Helpers`).
- **Skeleton templates (`plan-templates.md`)** — updated Architecture Overview, File Structure comment, Barrel Pattern section, and both Wave 0 skeleton code blocks (barrel + index.ts) to match the new architecture.

### Added
- **Validator rule 15 (`plugin-spec-validator.md`)** — Rule 15 (Barrel Export Structure): validates that `src/plugins/index.ts` has the two required section headers in order, flags helpers in the barrel as violations, and validates that `src/index.ts` uses `export * from "./plugins"` and includes `pluginConfigs`.

## 0.12.0 (2026-03-11)

### Added
- **`build-skeleton.md` reference** — new step-by-step skeleton build reference (S1–S7) for creating source files from the skeleton spec, running verification, collecting user approval, and committing the initial commit. Skeleton waves are stop-and-resume (one per invocation), copying code blocks directly from the spec — no sub-agents needed.
- **Skeleton detection & routing in `build.md`** — `/moku:build` now reads `## Skeleton:` from STATE.md before any other routing. Routes to `build-skeleton.md` when status is `not-started` or `in-progress`; skeleton always takes priority over plugin build waves.
- **`## Skeleton:` field in STATE.md schema** — new field with values `not-started | in-progress | verified | committed`. Extended Wave Progress table template with skeleton wave rows (Wave 0, Wave N, verify, commit).
- **Skeleton Specification Template in `plan-templates.md`** — full ready-to-paste template for `.planning/skeleton-spec.md` covering all five required sections: Architecture Overview, File Structure, System Connections, Skeleton Build Waves (with code blocks per file), and Verification Checklist.

### Changed
- **Stage 3 of `/moku:plan` rearchitected as Skeleton Specification** — stage now produces `.planning/skeleton-spec.md` (a spec document) instead of creating actual source files. Source file creation moved to `/moku:build` via the new skeleton build system. Updates STATE.md with `## Skeleton: not-started` and skeleton wave rows.
- **`plan.md` Next Action corrected** — after plan completes, Next Action now points to `Run /moku:build resume (skeleton build will run first)` instead of `/moku:build #1`.
- **Prompt hook prompt rewritten** — plugin index.ts gatekeeper uses clearer condition A/B structure (path check first, then 3-rule quality check) instead of the previous FIRST CHECK pattern, improving instruction-following reliability.
- **`build-framework.md` pre-requisite note added** — clarifies that if you are reading the file the skeleton is already committed; updated reference table to include skeleton build stage.

## 0.11.3 (2026-03-10)

### Fixed
- **Prompt hook false-blocking on non-plugin files** — PreToolUse prompt hook for plugin index.ts validation was erroring on `.planning/specs/*.md` and other non-plugin files instead of approving them. Rewrote prompt to check file_path pattern first and immediately approve anything outside `*/plugins/*/index.ts`.

## 0.11.2 (2026-03-10)

### Fixed
- **Inline bash permission errors** — replaced all `if/then/fi` patterns in skill and command `!` backtick injections with `test && command || true` chaining. Claude Code's permission checker rejects semicolons as "ambiguous command separators"; the new pattern avoids semicolons entirely. Fixed 9 instances across 6 files (moku-plugin/SKILL.md, moku-core/SKILL.md, moku-web/SKILL.md, plan.md, build.md, plugin-settings.md).

## 0.11.1 (2026-03-10)

### Changed
- **Agent preamble canonicalized** — expanded from 33 to ~65 lines with canonical R1–R8 code rules. All 12 agents now reference preamble rules instead of duplicating them, reducing per-agent prompt size and ensuring single-source-of-truth for rule updates.
- **Error diagnostician reasoning protocol** — added 4-step materialization (error inventory → per-file grouping → dependency chain → root cause list) before writing fix proposals.
- **Build-framework.md split into stages** — 451-line monolith replaced with 45-line router + 4 focused files (`build-wave-execution.md`, `build-verification.md`, `build-assembly.md`, `build-final.md`). Each file loaded only when needed, reducing context budget per build phase.
- **Context-aware memory retrieval** — PreCompact hook extracts keywords from STATE.md's Next Action and Phase, prioritizes keyword-matching memory entries before falling back to recency sort.
- **Bounded STATE.md with archival** — completed wave details archived to `.planning/STATE-history.md`, replaced with summary lines. Keeps STATE.md under ~60 lines regardless of project size.

### Added
- **Builder sub-agent output contract** — structured JSON block (`verdict`, `filesCreated`, `testsPass`, `lintPass`, `issues`) required at end of every builder response. Parent command parses JSON instead of inferring from text.
- **Pre-flight checks** — `bun install` + `bunx tsc --noEmit` + `bun run lint` before wave execution. Catches systemic issues once instead of N times across N parallel agents.
- **Incremental tsc during builds** — builder sub-agents run `bunx tsc --noEmit` after writing all source files (before tests), catching type errors early.
- **Adaptive model selection** — validation-coordinator selects agent models based on project size: <5 plugins → all sonnet; 5-15 → defaults; 15+ → upgrade haiku to sonnet.
- **Validator cross-communication** — Group A findings parsed and injected as Prior Findings Summary into Group B and architecture validator prompts.
- **Integration re-check after gap closure** — format/lint/tsc re-run after diagnostician fixes to catch fix-introduced regressions.
- **Memory aging policy** — agents delete `confidence:low` entries >14 days and `confidence:medium` >30 days.
- **Plugin structural validation hook** — new `validate-plugin-structure.sh` PreToolUse command hook checks filesystem structure (file count, nesting depth, types.ts import).
- **PreToolUse prompt hook few-shot examples** — approve/deny examples for better instruction-following.
- **Agent preamble few-shot example** — complete realistic output contract example for haiku-level agent consistency.
- **Dynamic self-test count** — `/moku:check self-test` counts agents dynamically instead of hardcoding.

## 0.11.0 (2026-03-10)

### Changed
- **Structured memory with aging** — `memory.md` now uses dated, categorized entries (`## Error Patterns`, `## Architecture Decisions`, `## Validation Baselines`) with `confidence:{high|medium|low}`. PreCompact hook injects 5 most recent entries per section (recency-prioritized) instead of flat `head -30`. Legacy format fallback preserved.
- **Gap closure re-validates with original validator** — after error-diagnostician fixes, the original validator that found the blocker re-runs (mapped via error category → validator), not just the verifier. Ensures fixes actually resolve the flagged issue.
- **Researcher available during gap closure** — error-diagnostician can now spawn `moku-researcher` for npm ecosystem questions mid-build. Researcher has a new "gap closure mode" for focused, concise answers instead of broad surveys.
- **Actionable hook denials** — PreToolUse prompt hook now returns the specific rule violated AND the fix when denying a write (e.g., "Rule 1 violated: 45 lines. Fix: extract to api.ts as factory").
- **Architecture-validator critical reminders** — added closing section with the 5 most commonly missed rules (core plugin event flow, explicit generics, Plugin postfix, require caching, helper purity) leveraging recency effect.
- **Web-validator sections 3-4 enhanced** — @layer ordering and token system checks now have concrete grep patterns, step-by-step verification, and specific file inspection rules matching the quality of sections 1-2.

### Added
- **Context budget warnings** — `user-prompt-context.sh` injects warning after 3+ waves completed in a session, suggesting fresh session for best results.
- **Incremental validation caching** — per-plugin content hashes recorded in STATE.md after verification. Validation-coordinator skips unchanged plugins with `CACHED` verdict. Architecture-validator always runs full (cross-plugin concerns).
- **Agent preamble memory format** — rule 8 now specifies structured memory write format for agents with `memory: user`.

## 0.10.0 (2026-03-09)

### Changed
- **plan.md split into verb-module router** — reduced from 457 to ~155 lines (67% reduction). Verb-specific logic moved to 4 reference files (`plan-verb-create.md`, `plan-verb-update.md`, `plan-verb-add.md`, `plan-verb-migrate.md`) loaded on demand.
- **PreCompact state re-injection rewritten** — replaced `head -80` with section-aware awk extraction that finds critical headers regardless of position. Supports `.planning/memory.md` injection (first 30 lines).
- **Format-on-save targets single file** — extracts file path from tool input via jq/python3 and formats only the changed file instead of the entire project.
- **`.planning/` auto-approve uses allow-list** — restricted from blanket pattern to known files (STATE.md, decisions.md, research.md, memory.md, specs/*.md, etc.) to prevent anti-pattern bypass via path manipulation.
- **grep/sed JSON fallback eliminated in all hooks** — python3 promoted to primary fallback after jq. Hooks emit warning JSON when no parser available instead of silently failing.
- **Agent output standardized** — all 12 agents now use shared preamble with universal rules, standardized severity levels (BLOCKER/WARNING/INFO), and structured JSON output contract at end of response.
- **SessionStart onboarding enhanced** — decision tree with quick start vs full workflow paths, contextual quick-action suggestions from STATE.md, project memory detection.

### Added
- **`--continue` flag for `/moku:build`** — auto-advances through all remaining waves without stopping between them. Git checkpoint commits still happen per wave. Stops only on context exhaustion.
- **`--quick` mode for `/moku:plan`** — collapses 3-stage workflow into single pass for projects with ≤4 plugins.
- **Build idempotency protocol** — plugins set to `building` status at wave start (not just completion). Resume detects crashes and offers reset-to-checkpoint or continue-from-current.
- **Error-diagnostician agent** — classifies errors into 12 categories, traces root causes vs cascading errors, integrated into gap closure.
- **Validation-coordinator agent** — orchestrates full pipeline programmatically (Group A → Group B → architecture), aggregates output contracts, determines disposition (PASS/FIX/MANUAL).
- **`/moku:check status`** — compact plugin overview with tier, files, tests, README, and build status.
- **`/moku:check diff <name>`** — spec-vs-implementation comparison showing MATCH/GAP/EXTRA per section.
- **`/moku:check plugin <name>`** — fast per-plugin validation (format→lint→tsc→test first, agent-based only on failure or `--full`).
- **`/moku:status` dashboard command** — consolidated view with phase, wave progress, plugin status, recent agent activity, and contextual quick-action suggestions.
- **`/moku:build fix` sub-command** — targets failed/needs-manual plugins with enhanced error context.
- **Shared agent preamble** (`references/agent-preamble.md`) — 8 universal rules plus output contract JSON schema, referenced by all agents.
- **Reasoning protocol** for architecture-validator and plan-checker — structured chain-of-thought with 5 intermediate results before report generation.
- **moku-testing skill** — mock context factories, integration test scaffolds, type-level test patterns, test organization conventions. Preloaded on builder and test-validator agents.
- **Project-level memory** via `.planning/memory.md` — accumulated error patterns, architecture decisions, validation baselines. Injected by PreCompact hook.
- **Config validation** — `maxParallelAgents` (1–5), `gapClosureMaxRounds` (0–5) bounds documented and enforced in plan/build commands.
- **Progress emission during builds** — 4 intermediate status messages per wave (pre-spawn, post-complete, post-verify, post-gap-closure).

## 0.9.0 (2026-03-09)

### Changed
- **Verb-first argument structure for `/moku:plan`** — command now uses `[create|update|add|migrate|resume] [type] [args]` pattern instead of `[framework|app|plugin] [description]`. Old syntax still works via backward-compatible fallback parsing.
- Type synonyms: `tool`/`engine`/`library` normalize to `framework`; `app`/`application`/`service`/`server`/`game` normalize to `app`.

### Added
- `update` verb — update existing plugin specs or app composition via `/moku:plan update plugin {name} {changes}` or `/moku:plan update app {changes}`. Produces spec-only output (consistent with plan→build separation).
- `add` verb — `/moku:plan add plugin {name} {description}` runs a quick single-pass flow (plan + build + wire + verify), absorbing the former `/moku:add` command.
- `migrate` verb — explicit migration via `/moku:plan migrate [type] {path/link/github}`. Supports GitHub URLs (auto-clones). Replaces heuristic path detection.
- Update Plugin Target and Update App Target sections in plan-stages.md (Stage 1 and Stage 2).
- Update Plugin Specification and Update App Specification templates in plan-stages.md.
- `## Verb:` field in STATE.md template for resume flow awareness.

### Removed
- `/moku:add` command — fully absorbed into `/moku:plan add plugin`. The quick single-pass workflow is preserved as Step 0.7 in plan.md.

## 0.8.3 (2026-03-08)

### Removed
- `/moku:migrate` command — removed entirely. The `upgrade` and `restructure` flows are dropped; the `from-existing` flow is now built into `/moku:plan`.

### Changed
- `/moku:plan` now accepts a path to existing code as argument — auto-detects paths (contains `/`, starts with `.` or `~`) and runs from-existing migration analysis inline (new Step 0.3)
- `migrate-flows.md` simplified to from-existing analysis only (upgrade and restructure sections removed)
- Migration decisions.md template simplified to from-existing fields only (no conditional branches)

## 0.8.2 (2026-03-08)

### Added
- **Helpers pattern** — static factory functions on plugins via `helpers` spec field. Helpers are pure functions spread onto `PluginInstance`, available before `createApp` for typed config construction.
- `helpers` field in PluginSpec shape (`plugin-system.md`) with design rules (static, pure, no ctx, no conflicts with PluginInstance fields)
- Helpers usage example in `plugin-system.md` (router plugin with `route()` helper)
- Helpers pattern reference in `plugin-patterns.md`
- Helpers validation in spec-validator, plugin-spec-validator, architecture-validator, and type-validator agents

## 0.8.1 (2026-03-07)

### Changed
- **Migrate command rewrite** — simplified from 300-line self-contained workflow to ~100-line preparation-only command. Migrate now analyzes only (never modifies code), saves context to `.planning/decisions.md` + `.planning/research.md`, and hands off to `/moku:plan framework`. Principle: migrate prepares, plan plans, build builds.
- Removed `resume` argument from migrate (plan has its own resume mechanism)
- Removed `Edit` from migrate's allowed-tools (no files are modified)

### Added
- `skills/moku-core/references/migrate-flows.md` — detailed per-type analysis instructions (upgrade, restructure, from-existing) loaded on-demand by migrate command
- Migration decisions.md template in plan-templates.md with `## Migration Type` header for flow detection
- Migration context detection in plan.md Step 0.5 (skips discussion phase) and Stage 1 (uses analysis as pre-answered requirements)

## 0.8.0 (2026-03-07)

### Added
- **Negative examples** ("Common Mistakes — DON'T Do These") in all 3 skills: moku-core, moku-plugin, moku-web
- **Prompt-based hook** (`type: "prompt"`) for reasoning-based validation of plugin index.ts writes — checks wiring harness pattern, explicit generics, unnecessary lifecycle methods
- **Progressive disclosure** in all 3 skills — advanced references load conditionally based on project complexity (plugin count, sub-modules, CSS file count, islands)
- **Cross-skill examples** in all 3 skills — concrete code showing how moku-core + moku-plugin + moku-web work together
- **Environment validation** on SessionStart — checks Bun >= 1.3.8, Node >= 22, tsc availability; warns early if missing
- **Version compatibility** on SessionStart — displays `@moku-labs/core` version from package.json

## 0.7.1 (2026-03-07)

### Fixed
- **CRITICAL**: SubagentStop hook parsed wrong field names (`agent_name`/`stop_reason` → `agent_type` per official schema)
- `user-prompt-context.sh` false-positive on non-Moku projects — Tools detection now requires `@moku-labs` in package.json
- `detect-moku-project.sh` welcome message too broad — changed `'moku'` match to `'@moku-labs'` to avoid substring false positives
- Notification hook removed speculative diagnostic logging — field names (`title`/`message`/`notification_type`) confirmed correct

### Added
- `notification_type` extraction in Notification hook (uses type as fallback label when title is absent)
- SessionEnd hook for cleanup on session termination
- UserPromptSubmit hook documented in README hooks table
- Expanded anti-pattern checks: `as any` in plugin files, `as unknown` assertions
- `.gitignore` for plugin root

### Changed
- PostToolUse format hook extracted from inline command to `hooks/format-on-save.sh`
- SubagentStop hook matcher changed from `*` to `moku-*` for precision

## 0.7.0 (2026-03-07)

### Added
- **Core plugins knowledge** across all skills, references, and agents — planner recommends core vs regular, builders know `createCorePlugin`, validators check core plugin compliance
- Core Plugin Identification section in plan-stages with decision table (events/hooks/depends → regular, self-contained infrastructure → core)
- Core Plugin Specification Template in plan-templates (simplified: no events/dependencies/hooks sections)
- Core Plugin Compliance check (#10) in spec-validator
- Core Plugin Analysis check (#8) in architecture-validator (promotion candidates, validation, event flow exclusion)
- Core Plugin Plan Validation check (#9) in plan-checker (infrastructure misclassification, name collisions, Wave 0)
- Wave 0 for core plugins in build-framework, plan-checker mermaid diagrams, and STATE.md template
- `CorePluginContext` tier in communication-context (`{ config, state }` only)
- Core plugin types section in type-system (`CorePluginInstance`, `CoreApisFromTuple`, `CoreApis = {}` identity)
- `createCorePlugin` API reference in core-api with full signature and examples
- Core plugin invariants in invariants.md (self-containment, reserved names, lifecycle ordering)
- Core plugin config 4-level cascade in config-lifecycle

### Changed
- `createCoreConfig` signature updated to include `CorePlugins` generic, `plugins?`, `pluginConfigs?` options
- Plugin tree diagram uses `[Core]` tags instead of tier names for core plugins
- Mermaid diagrams across validators include core plugin subgraph with `classDef core fill:#e8f5e9`
- Architecture validator process expanded from 9 to 12 steps (core plugin classification, promotion analysis)

## 0.6.0 (2026-03-07)

### Fixed
- **CRITICAL**: Hook script jq fallback truncated JSON content at first escaped quote — added python3 as intermediate fallback (jq -> python3 -> grep/sed)
- **CRITICAL**: Corrected v0.5.0 changelog entry about `color` field — it IS supported, agents correctly retain it
- PreCompact hook re-injected unbounded file content — now bounded to ~150 lines via extracted script
- `/moku:add` skipped 5 of 6 validation agents — now runs plugin-spec, type, and jsdoc validators after verifier

### Added
- Per-plugin build status tracking within waves (`built`, `agent-incomplete`, `agent-failed`, `verified`, `needs-manual`)
- `maxTurns` scaling by plugin complexity tier (Nano: 20, Micro: 30, Standard: 40, Complex: 50, VeryComplex: 60)
- `<example>` blocks on all 10 agent descriptions for improved auto-triggering accuracy
- `hooks/precompact-state.sh` — extracted bounded PreCompact hook
- `hooks/log-notification.sh` — extracted Notification hook with 3-tier JSON parsing

### Improved
- All hook scripts use 3-tier JSON parsing: jq -> python3 -> grep/sed
- Notification and PreCompact hooks extracted from inline commands to standalone scripts

## 0.5.0 (2026-03-07)

### Fixed
- **CRITICAL**: `settings.json` was using unsupported schema — emptied (agent key is for activating agents, not config)
- **CRITICAL**: PostToolUse format hook fired on ALL projects — added Moku project guard (biome.json + src/config.ts or .planning)
- **CRITICAL**: Path traversal weakness in approve-planning-writes.sh — anchored to project root
- Verified `color` field is supported — retained in all 10 agent frontmatter files

### Added
- `skills` field on all agents (agents don't inherit parent skills — now preloaded)
- `maxTurns` on all agents (circuit breaker: 30 for validators, 40 for researcher)
- `memory: user` on researcher agent for cross-session domain knowledge
- `.lsp.json` for TypeScript language server integration
- First-run welcome message in SessionStart hook for new users
- `Agent` tool added to `/moku:check` for running validation agents
- `self-test` mode for `/moku:check` — validates the plugin's own integrity
- `--dry-run` mode for `/moku:build` — previews files without creating them
- STATE.md backup protocol (`.bak` before overwrite, git checkpoint SHA)
- STATE.md validation (required headers check on read)
- Dynamic config injection via `!` backtick in build/plan commands (reads `.claude/moku.local.md`)
- Configurable `maxParallelAgents` and `gapClosureMaxRounds` (previously hardcoded)

### Improved
- Skill trigger descriptions tightened with "moku" prefix to avoid false triggers on generic terms
- PostToolUse hook now reports format errors instead of swallowing them

## 0.4.0 (2026-03-06)

### Fixed
- Version mismatch between plugin.json and marketplace.json
- Author name typo ("Oleksadr" -> "Oleksandr")
- Fragile JSON parsing in hook script (jq fallback added)
- Removed unsupported `version` field from skill frontmatter

### Added
- `disable-model-invocation: true` on all commands to prevent accidental auto-triggering
- PostToolUse hook for auto-formatting after Write/Edit
- PreCompact hook to preserve planning state during context compaction
- SessionStart hook to detect Moku project type and planning state
- `/moku:check` diagnostic command for plugin self-validation
- CHANGELOG.md for version tracking
- Dynamic context injection in skills for live state awareness

### Improved
- Agent descriptions trimmed from ~30 lines to ~3 lines each (saves ~240 lines of context budget)
- Consolidated repeated "no explicit generics" anti-pattern warnings
- Commands shortened via progressive disclosure (reference files for detailed steps)
- Replaced `specification/15-PLUGIN-STRUCTURE` references with actual skill references
- Auto-git-commit before each build wave for rollback safety

## 0.3.1 (2026-02-28)

### Added
- marketplace.json for plugin distribution

## 0.3.0 (2026-02-25)

### Added
- 9-agent validation pipeline (spec, jsdoc, plugin-spec, plan-checker, verifier, test, type, architecture, researcher)
- Wave-based parallel execution for framework builds
- Cross-session state tracking via .planning/STATE.md
- PreToolUse hook for auto-approving .planning/ directory writes
- 3-level artifact verification (exists, substantive, wired)
- Gap closure with circuit breaker (max 2 rounds)
- Context budget management with resume support

### Commands
- `/moku:init` — Project scaffolding with full tooling
- `/moku:plan` — 3-stage gated planning workflow
- `/moku:build` — Wave-based build with parallel sub-agents

### Skills
- `moku-core` — Three-layer architecture and specification
- `moku-plugin` — Plugin structure and complexity tiers
- `moku-web` — Preact/Vite web patterns
