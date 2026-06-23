# Prompt — improve the moku Claude plugin's E2E testing skill

> Paste this into a fresh Claude Code session **opened in `/Users/alex/Projects/moku/claude`** (the
> editable moku plugin source — NOT the `~/.claude/plugins/cache/...` copy). It distills hard-won,
> battle-tested findings from building the **Atlas** demo's comprehensive E2E + visual gate, so future
> moku app-builds get them for free.
>
> *Playwright versions below were verified against the [release notes](https://playwright.dev/docs/release-notes)
> on 2026-06-22 — latest stable is **1.61**. Re-check before scaffolding and bump the pins + `-noble` tag to
> the newest minor.*

---

## Your task

Update the moku plugin's E2E guidance so a Layer-3 web app's `/moku:build` E2E gate is **automated,
runner-works-first-try, and agentically comprehensive**. Edit these files:

- `skills/moku-core/references/e2e-testing.md` — the gate's how-to (the main target).
- `skills/moku-core/references/build-app.md` — Step 7.5 (the gate) + the "web app" rules.
- Wherever the build scaffolds `package.json` / `playwright.config.ts` / `scripts/e2e-server.ts` for a
  web app (so the pins + patterns below are emitted, not hand-fixed every time).

Keep moku conventions (data-* selectors, @scope/@layer, tokens). After editing, run the plugin's own
checks and commit with `--no-verify` if the framework pre-commit hook fails in non-TTY (see existing
moku memory).

---

## 1. HARD REQUIREMENT — Playwright >= 1.61 on Node 24 (the #1 lesson)

**An outdated Playwright on Node 24 DEADLOCKS the test runner.** On the Atlas build it hung the `playwright
test` runner at **0% CPU with zero output** — *before* any test ran, so it looked like an infinite hang with
no diagnostics. Moku web apps pin `node >= 24` (engines), so an old Playwright **won't even start** — the fix
is simply to pin a current one. So the skill MUST:
- Scaffold/pin **`@playwright/test` and `playwright` at `^1.61` (or latest)** — never a minor below 1.60.
- Bump the pinned Linux docker image to match: `mcr.microsoft.com/playwright:v1.61.0-noble` in the
  `test:e2e:update:linux` script and CI.
- Add a troubleshooting note: *"runner hangs with no output -> check `@playwright/test --version` and bump it;
  on Node 24 an outdated Playwright is almost always the cause."*
- Run the runner via **node, not bun** (`bun run test:e2e` is fine — it resolves the `.bin/playwright`
  node shebang; the deadlock is version-, not runtime-, specific).

## 2. Latest Playwright features to bake into the gate (with versions)

The skill should prescribe these for "comprehensive":

| Feature | Ver | Use in the moku gate |
|---|---|---|
| **ARIA snapshots** `expect(locator).toMatchAriaSnapshot()` | 1.49 (page-level + `boxes` 1.60) | One committed YAML accessibility-tree snapshot per screen x key state -> exhaustive *structural* assertion, resilient to styling churn. |
| **`@axe-core/playwright`** (`new AxeBuilder({page}).analyze()`) | — | Automated WCAG 2.1 AA scan per screen; assert `violations == []` (or a documented allowlist). |
| **Accessibility assertions** `toHaveRole` / `toHaveAccessibleName` / `toHaveAccessibleDescription` / `toHaveAccessibleErrorMessage` | 1.44 (errmsg 1.50) | Assert key controls' semantics + form-field error wiring (`aria-errormessage`, e.g. the sign-in form's validation). |
| **Soft assertions** `expect.soft(...)` (+ `expect.soft.poll`) | 1.19 long-stable (poll 1.61) | Collect ALL failures per screen in one run (don't stop at first) -> comprehensive per-screen reports. |
| **`page.clock`** (`setFixedTime`) | 1.45 | Freeze time so relative-time UI + due chips are deterministic (moku apps render `Date.now()`-based labels). |
| **`page.emulateMedia`** (dark / `forced-colors` / `prefers-reduced-motion`) | long-stable (forced-colors 1.15+) | Verify dark theme, high-contrast, reduced-motion per screen. |
| **`page.routeWebSocket()`** | 1.48 | Mock/pin the realtime channel (moku worker apps hold a live board socket) for deterministic live-update states. |
| **Drag & drop** `locator.dragTo()` / `locator.drop()` | `dragTo` long-stable; `drop()` 1.60 | Exercise board/kanban DnD (Atlas's core interaction — moving an issue across columns) + external file/clipboard drops. |
| **Web storage** `page.localStorage` / `page.sessionStorage` | 1.61 | Seed/read client state directly (theme preference, dismissed banners, draft state) without driving the UI. |
| **Enhanced screenshots** (`stylePath`, `maskColor`, `maxDiffPixelRatio`) | 1.35/1.41 | Inject CSS / mask volatile regions for stable visual goldens. |
| **`page.pageErrors()` / `page.consoleMessages()` / `page.requests()`** | 1.56 | Post-hoc "zero JS errors / no failed requests" assertions across every page (the boot-guard class). |
| **Screencast + action annotations / trace HAR + WS** | 1.59-1.61 | Evidence for CI failures (`trace: 'on-first-retry'`, `video: 'retain-on-failure'`; HAR/trace now capture WS frames). |
| **`addLocatorHandler`** | 1.42-1.44 | Auto-dismiss blocking overlays during flows. |

## 3. Agentic testing — the big upgrade for moku (latest Playwright)

Playwright now ships **first-class agentic testing**. Wire ALL of it into the moku gate — it turns the e2e
stage from "the model writes specs and hopes" into "the model drives a real browser, validates every
selector live, and self-heals." (Everything here is Playwright **1.56–1.61**; the `^1.61` pin already ships
it.)

### 3.1 Two MCP servers — keep them straight (the #1 source of confusion)
- **`@playwright/mcp`** (separate package, `npx @playwright/mcp@latest`) — general **browser automation**:
  the model drives a real browser to *explore and verify the live app* with no committed spec. Register for
  Claude Code: `claude mcp add playwright npx @playwright/mcp@latest`.
- **Playwright Test MCP** (built into Playwright >= 1.56: `npx playwright run-test-mcp-server`; **TS/JS
  only**) — *authoring, running, and healing committed specs*. It is what `init-agents` wires into
  `.mcp.json` (config key `playwright-test`) and it adds `planner_*` / `generator_*` / `test_*` tools on top
  of the browser tools.
- Rule of thumb: **`@playwright/mcp` finds + confirms a bug *now*; the Test Agents lock the behaviour into
  CI.** A project `.mcp.json` loads on the **next** session, not mid-session.

### 3.2 The Test Agents: planner -> generator -> healer (`init-agents`, 1.56)
`npx playwright init-agents --loop=claude` scaffolds `.claude/agents/playwright-test-{planner,generator,
healer}.md`, a `.mcp.json` (-> the `playwright-test` server), `tests/seed.spec.ts`, and uses `specs/` for the
plans. **Re-run it after every Playwright upgrade** (it regenerates the agents to pick up new tools). Drive
from Claude Code in natural language: `claude "Use the planner agent to create a test plan for <flow>"`.
- **planner** — explores the *running* app and writes a reviewable **Markdown plan** to `specs/` (user
  journeys, happy + error paths), not a guess scraped from static HTML.
- **generator** — turns a plan into `tests/*.spec.ts`, **validating every locator against the live DOM /
  accessibility tree** as it writes. It emits **`getByRole` / `getByTestId`**, never scraped `.class`/`#id`
  — this kills the #1 failure mode of LLM-authored specs (hallucinated selectors). Generated specs may still
  have errors *by design* — that's the healer's job.
- **healer** — runs the suite, re-runs failures in **debug mode**, inspects the *live page*
  (`browser_console_messages`, `browser_network_requests`, `browser_snapshot`) and patches **surgically**
  (fix a drifted locator, add a missing `waitForResponse`, correct assertion copy). Crucially, if it
  concludes the **app itself is broken** it marks the test `skipped` rather than papering over the bug —
  preserving the signal for a human.
- **The seed spec is the linchpin.** `tests/seed.spec.ts` runs **first** when the planner/generator launch
  (via the MCP `*_setup_page` tools) — *not* during a normal `playwright test`. Put the app's **real
  sign-in** here and persist it (`await page.context().storageState({ path: authFile })`) so the agents
  explore as a signed-in user. (Atlas's format-only auth: drive `/signin`, set the HttpOnly session cookie —
  see §4.)
- **Human-review gates** (don't skip): after the **plan** (is the scope right?), after **generation**
  ("always review generated code before merging"), and after **healing** (validate the diffs; investigate
  every `skipped` — it may be a real bug, not a flaky test).

### 3.3 Drive + verify the live app — the `@playwright/mcp` toolset
For exploratory "open it, sign in, do the thing, confirm it worked, check the console is clean" — no spec
committed:
- **Snapshot mode (default) beats screenshots.** `browser_snapshot` returns the **accessibility tree with
  stable element refs**; the model targets actions by ref, so they survive reflow / responsive re-renders
  and cost no vision tokens. The snapshot both *drives* and *verifies* (read it back to confirm state). Add
  **`--caps=vision`** (coordinate tools + screenshots) only for `<canvas>`/WebGL/pixel-exact cases.
- **Tools** — *navigate* (`browser_navigate`/`_back`); *act* (`browser_click`, `_type`, `_fill_form`,
  `_select_option`, `_press_key`, `_hover`, `_drag`, `_drop`, `_file_upload`, `_handle_dialog`,
  `_evaluate`); *inspect* (`browser_snapshot`, `_take_screenshot`, `_console_messages`, `_network_requests`,
  `_wait_for`); *tabs* (`browser_tabs`); *util* (`browser_resize`, `_close`, `_pdf_save`). Capability-gated:
  `--caps=devtools` (tracing/video/highlight/annotate), **storage** CRUD + `browser_storage_state`,
  **network** mocking (`browser_route`), and **testing** helpers **`browser_generate_locator` +
  `browser_verify_*`** (hand the model stable locators + assertions to bake straight into committed specs).
- **Hardened Claude config** (headless, isolated, fenced to your app): `--headless --isolated --browser
  chromium --viewport-size 1280x720 --allowed-origins "http://localhost:8787;<prod origin>" --output-dir
  ./.pw-mcp` (+ `--no-sandbox` in CI/Docker). Fence the agent to your origins with **`--allowed-origins`**;
  seed a logged-in context with **`--storage-state`**. Gotchas (changed recently): `browser_install` is
  **not** a tool — run `npx playwright install chrome`; the trace flag is **`--save-session`**, not
  `--save-trace`.

### 3.4 Agentic debugging — GUI-less (1.59), for an agent with no display
- **`npx playwright test --debug=cli`** (1.59) — a terminal debugger (prints a session id to attach): step /
  inspect locators / evaluate in page context over text, instead of the GUI Inspector.
- **`npx playwright trace open|actions|action <N>|snapshot <N>|close`** (1.59) — explore a failure trace
  entirely from the CLI (no browser), so post-mortem is a parseable text stream in headless CI.
- **`browser.bind()` + `playwright-cli show` / `PLAYWRIGHT_DASHBOARD=1`** (1.59) — one live browser, many
  clients (a script, `@playwright/mcp`, and the CLI) on one observability surface.
- **"Copy prompt"** button (1.51) in the HTML report / trace viewer / UI mode — one click emits LLM-ready
  failure context to hand straight to the healer (disable with the reporter's `noCopyPrompt`).
- **Cheap heal loops:** `--last-failed` (1.44) re-runs only the failures; `--only-changed` (1.46) only the
  git-affected specs — both slash the edit->verify cycle that dominates agent runtime.

### 3.5 Agentic-capability catalog (the full checklist, with versions)
Bake these in so the agent *perceives*, *acts robustly*, and *self-heals* (determinism rows overlap §2 by
design — here they're framed for the agent loop):

| Capability | API / flag | Ver | Why it improves agentic testing |
|---|---|---|---|
| **Perception — page as text** | `page.ariaSnapshot({ mode:'ai', depth, boxes })` | 1.59 | The a11y tree as compact YAML is the ideal LLM-consumable page model — feed it each turn; `mode:'ai'` returns an action-focused tree, `boxes` adds spatial grounding. |
| **Structural assertion** | `expect(locator).toMatchAriaSnapshot()` | 1.49 (page-level + `boxes` 1.60) | Commit one a11y-tree snapshot per screen/state; resilient to styling churn, diffs human-reviewable (store as `*.aria.yml`, 1.50). |
| **Selector self-repair** | `locator.normalize()` | 1.59 | Rewrites a brittle guessed selector into best-practice `getByRole`/`getByTestId` — directly counters the agent's most common defect. |
| **Live selector discovery** | `page.pickLocator()` | 1.59 | Resolve a real, stable locator for an element without the GUI Inspector (tooling/agent-driven). |
| **Stable locator minting** | `browser_generate_locator` (Test MCP) | 1.56 | Generator/healer mint *committable* locators from the live DOM instead of inventing them. |
| **Live verification** | `browser_verify_*` (Test MCP, testing caps) | 1.56 | `verify_element_visible` / `_text_visible` / `_value` mirror the assertions you'd commit. |
| **Auth seeding** | `storageState()` in `seed.spec.ts` / `--storage-state` | — | Agents explore as a signed-in user (Atlas's screens are sign-in-gated). |
| **Full-page failure reports** | `expect.soft(...)` (+ `expect.soft.poll` 1.61) | 1.19 | One run surfaces ALL per-screen failures — far more useful to a heal loop than fail-fast. |
| **Time determinism** | `page.clock.setFixedTime()` | 1.45 | Freezes `Date.now()`-based UI so re-runs (and the healer) don't chase wall-clock flake. |
| **Realtime determinism** | `page.routeWebSocket()` | 1.48 | Pin/mock the live board socket so live-update states are reproducible. |
| **a11y / WCAG scan** | `new AxeBuilder({ page }).analyze()` | — | `expect(violations).toEqual([])` per screen — reasons over the same a11y tree the agent does. |
| **Failure forensics** | `trace:'on-first-retry'`; video `retain-on-failure` (new modes 1.61) | 1.59-1.61 | A trace/video exists exactly when `npx playwright trace` needs it, at ~zero cost on green. |
| **Codegen sync points** | auto `toBeVisible()` assertions | 1.55 | Agent-generated specs come pre-seeded with waits -> less "acted before it existed" flake. |

### 3.6 The audit->fix->re-capture loop (the method that worked on Atlas)
(1) a committed `gallery.spec.ts` screenshots every design-context section-6 screen x viewport x theme;
(2) fan out **one agent per screen** (via the Workflow tool) to Read its screenshot + the design-context
section + the component CSS -> a *source-verified* defect list with severity + concrete fix; (3) fan out
**one fix agent per disjoint file group**; (4) re-capture + **re-audit to objectively re-score** (don't
assume a fix worked). On Atlas this drove 56 -> 51 -> 47 defects with all blockers fixed. Recommend it for
any "make it comprehensive / fix the design" request.

## 4. Gotchas to encode as rules (each cost real time on Atlas)

- **`scripts/e2e-server.ts` must run `bun run dev` (the package script), NOT `bun scripts/dev.ts`** —
  the package script puts `node_modules/.bin` on PATH so the worker can spawn `wrangler` (else
  "Executable not found: wrangler"). The deterministic seed IS the frozen fixture corpus; `rm -rf
  .wrangler` before a seeded boot (seed uses plain INSERTs).
- **`page.waitForLoadState("networkidle")` NEVER settles** when an island holds a live WebSocket (the
  board socket) -> use `"load"` + explicit `expect(locator).toBeVisible()`.
- **Anchored `waitForURL(/^\/$|^\/board\//)` regexes test the FULL URL** (`http://host/...`), so `^/`
  never matches -> use a pathname predicate `u => u.pathname === "/" || u.pathname.startsWith("/board/")`.
- **`toHaveScreenshot`/`page.screenshot` `fullPage:true` MISREPRESENTS `position:fixed` overlays/menus/
  modals** (pins them to the layout origin). Capture overlays with **`fullPage:false`** (viewport).
- **ESLint must ignore generated dirs** (`.wrangler/**`, `playwright-report/**`, `test-results/**`,
  `dist-e2e/**`) or `bun run lint` breaks once the dev server has run.
- **`bun run dev` regenerates `wrangler.jsonc`** from `server.ts` (deploy plugin owns it) -> `git
  checkout wrangler.jsonc` before committing so the dev-run side-effect isn't committed.
- **Playwright wipes its `outputDir` (`test-results/`) each run** — committed visual goldens must live
  OUTSIDE it (the default `*-snapshots/` dirs beside specs are fine; an ad-hoc `test-results/gallery`
  is not).
- **Sign-in for moku demo auth is format-only** — any `local@domain.tld` + non-empty password works;
  drive the real `/signin` form to set the HttpOnly session cookie, then the worker guard allows
  `/api/*` (a central 401->/signin gate redirects otherwise). The board/list/issue screens only load
  data after sign-in.
- **Strict-mode multi-match** bites LLM selectors (a card with 2 avatars, a menu item text matching
  3 nodes) -> scope + `.first()` + target by `data-action`/`role`, not loose `getByText`.

## 5. Config essentials the skill should emit

`playwright.config.ts`: `webServer` running the seeded e2e server with a **`PW_EXTERNAL_SERVER`
opt-out** (so a long session can reuse an already-running server instead of re-booting); prefer
`webServer.wait` (a regex on the server's stdout ready-line, 1.57) over URL-polling for deterministic boot
detection; chromium runs
the FULL suite, webkit+firefox run only `baseline`+`no-js-errors` (`testMatch`); visual determinism
(`animations:"disabled"`, `caret:"hide"`, `scale:"css"`, `maxDiffPixelRatio:0.02`, fixed `colorScheme`/
`reducedMotion`, chromium `--font-render-hinting=none --force-color-profile=srgb`); `trace:
"on-first-retry"`. Scripts: `test:e2e`, `test:e2e:update`, `test:e2e:update:linux` (docker, pinned
v1.61.0-noble). Run the local server: `nohup bun run scripts/e2e-server.ts --port 7979 &` then
`PW_EXTERNAL_SERVER=1 node node_modules/@playwright/test/cli.js test --project=chromium <spec>`.

## 6. Reference material

- Playwright release notes: https://playwright.dev/docs/release-notes
- Accessibility testing (axe): https://playwright.dev/docs/accessibility-testing
- ARIA snapshots: https://playwright.dev/docs/aria-snapshots
- Playwright MCP (browser-automation server): https://github.com/microsoft/playwright-mcp — official docs:
  https://playwright.dev/docs/getting-started-mcp
- Test Agents (planner/generator/healer) + the built-in Test MCP server (`npx playwright run-test-mcp-server`):
  https://playwright.dev/docs/test-agents (scaffold with `npx playwright init-agents --loop=claude`)
- The two MCP servers explained — browser-automation vs test (by a Playwright maintainer):
  https://dev.to/debs_obrien/playwright-mcp-servers-explained-automation-and-testing-4mo0
- Proven worked example: the **Atlas** demo (`demos/atlas`) — `tests/e2e/{gallery,_auth,no-js-errors,
  api,features,baseline}.spec.ts`, `scripts/e2e-server.ts`, and the `PW_EXTERNAL_SERVER` config opt-out
  (runner fix + audit→fix cycles against the design context).
