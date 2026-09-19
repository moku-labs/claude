---
name: e2e
description: Proves a Moku web app works in a real browser. Covers every screen and control with Playwright, adds visual baselines, then runs exploratory QA and a UX gate on desktop and mobile screenshots, fixing what it finds. Use for the e2e station of a change with a web surface, not for unit or integration tests.
when_to_use: A Layer-3 Moku app with a web surface reaches the e2e station, or the user asks for browser-level coverage of screens, features or controls.
argument-hint: (empty = cover everything) or {a screen or feature to focus, or a visual feature to build} [--update-baselines]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Skill, Agent, AskUserQuestion
model: fable
effort: medium
---

# The e2e station

You orchestrate browser proof for a Layer-3 Moku web app: functional coverage, exploratory QA, a UX gate, and
a bounded fix loop. You spawn the agents; they do not spawn each other.

## Enter the rails

```bash
moku-rails enter e2e        # exit 2 = refused: stop, relay the reason and the named next step
```

Before you stop to ask the user anything mid-station: `moku-rails pause --reason "..."`. The last action of a
finished run is `moku-rails done e2e`.

## Knowledge you load

- `references/e2e-testing.md` (this pack) is the authoritative process: suite shape, fixtures, determinism,
  oracles, tours, the UX gate procedure. Read it before spawning anything.
- The **moku-web** skill (`references/project-spec.md`) is authoritative for the conventions of the app
  under test.
- For core knowledge — the agent preamble and output contract, rule ids, `moku-idioms.md`, `nl-args.md` —
  load the `moku:moku-core` skill with the Skill tool, then read `references/<file>` under the base
  directory it prints.

`.planning/` is local state; it is never staged or committed.

## Input

`$ARGUMENTS` may be plain language (resolve it per `nl-args.md` in the core skill):

| Input | Means |
|---|---|
| empty | FOCUS = everything |
| a phrase naming an existing screen or feature | FOCUS = that item; still gap-check the rest |
| a phrase asking to build or change a visual feature (add, build, make, redesign, "turn X into Y") | FEATURE_REQUEST = that phrase; build it first, then cover it |
| `--update-baselines`, or "I redesigned X" | UPDATE_BASELINES = true, for intended changes only |

Echo a one-line `Interpreting as: …` only when plain language was interpreted. A large multi-plugin feature
(new routes plus worker endpoints plus state) belongs in `/moku:plan` and `/moku:build`; say so and stop.

## Step 0 — guards

1. A `package.json` must be present, otherwise: "Not a Moku project — run from the app root." Stop.
2. **Web surface check.** A `createApp` from a web framework (`@moku-labs/web`, or a web-bearing app on
   `@moku-labs/worker` / `@moku-labs/room`), an `src/index.html` plus `src/routes.tsx`, or a built
   `dist/client`. No web surface: say that `/moku-web:e2e` drives a browser and this project has none, then
   `moku-rails done e2e` with that note. Stop.

## Step 1 — functional coverage

Spawn `moku-web-e2e-tester` with:

- `APP_ROOT` (repo root), `FOCUS`, `UPDATE_BASELINES`, `FEATURE_REQUEST` when set, `FIX_BUDGET` (default 4).
- `INVENTORY_SOURCES`: a design context if one exists (`.planning/design/*/design-context.md` §6), the plan
  and specs (`.planning/specs/*`, `app-spec.md`) plus what each build wave delivered, and the app source
  (`src/routes.tsx`, components, islands, pages, worker `endpoints.ts`).

It enumerates screens and controls, closes coverage gaps, runs the suite, fixes real defects, and returns a
coverage table with its verdict. A `FAIL` verdict stops the sequence here: present the failing items and the
fix each needs, and offer to continue. Never present a "should work".

## Step 2 — exploratory QA

Once functional is green, spawn `moku-web-qa-explorer` with `APP_ROOT`, the control catalog and the served
URL from Step 1. It runs charters, tours and the oracle ladder, and turns confirmed functional bugs into
committed Playwright regression tests.

Keep every regression test it authored. Feed its P0/P1 findings into the fix loop and re-run the suite.

## Step 3 — the UX gate

The gate is never skipped, and it is not "an agent's opinion" — it is two independent reviews plus your
triage. The full procedure is `references/e2e-testing.md` → "The UX gate". In short:

1. **Capture.** `moku-web-ux-reviewer` drives the app on desktop and mobile and writes one screenshot per
   screen inventory item per viewport into `.planning/e2e/shots/`. It also returns its own heuristic
   findings (measured geometry, contrast, tap targets, axe violations).
2. **Astra.** If the `moku-design` pack is installed and `moku-astra` is on PATH:

   ```bash
   moku-astra review --images <comma-separated shots> --context <design-context.md if any> --out .planning/astra/findings.json
   ```

   Exit 3, or the pack absent, means Astra is unavailable: you review the same screenshots yourself using
   the same findings shape, and the report names the reviewer.
3. **Your own review.** You review the screenshots independently in every case, Astra present or not. Merge
   your findings, Astra's and the reviewer's heuristic findings into one list.
4. **Triage.** Ask four questions of every finding: is it reproducible in the browser? is it consistent with
   `design-context.md`? is it consistent with the moku-web rules? is it worth its cost? Write every finding
   to `.planning/astra/triage.md` as accepted or rejected, each with the reason.
5. **Fix.** Accepted findings go back to `moku-web-ux-reviewer` (behavior, layout, responsive) or
   `moku-web-e2e-tester` (functional and baselines). Re-screenshot and re-review. At most two review passes.

## Step 4 — close

Present, in this order: the coverage table (each inventory item tested, baselined, behavior-checked,
confirmed), the engines and viewports exercised, defects found and fixed, exploratory findings with the
regression tests added, the UX gate result naming the reviewers and the accepted/rejected counts, and any
baselines updated with the reason.

```bash
moku-rails done e2e
```

## Rules

- Only a real browser run counts as proof. "I wrote the test" is not "it passes".
- Gap-analyze the whole app, including features from earlier waves. An untested feature is a failure, not a
  deferral.
- Real regressions are fixed in the app source. Goldens are updated only for intended changes, never to
  clear red.
- The agents edit app source, tests and config. They do not commit; the orchestrator does.
- `dist-e2e/`, `test-results/` and `playwright-report/` are gitignored build artifacts.

## Examples

- `/moku-web:e2e` — cover every screen and feature, run the UX gate, report green coverage.
- `/moku-web:e2e the board filter popup` — focus the filter popup, still gap-check the rest.
- `/moku-web:e2e add a dark-mode toggle to the header` — build the toggle, then cover it.
- `/moku-web:e2e --update-baselines` — after an intended redesign, refresh the goldens while re-confirming.
