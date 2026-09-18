---
description: The single Moku verification command — combines root/entrypoint idiom conformance (I1–I6) with the full aggressive validator fan-out. Fans out EVERY Moku validator in parallel, root-first (root, spec, plugin-spec, jsdoc, readable-code, common, type, test, web, architecture), then FAILS on any blocker, ANY warning, or any validator that did not return a verdict; upholds each finding unless a skeptic can CITE the spec/house-style section that refutes it; then auto-fixes and re-verifies in a loop (default 3 cycles) toward clean idiomatic code. Root/entrypoint files (app.ts/spa.tsx/server.ts/cloudflare/worker.ts/routes.tsx/config.ts) are the primary focus — apps compose and never define a framework (I1), one createApp per framework/runtime with no gratuitous duplicate or facade entrypoints (I2/I6), one worker app composing resource+runtime+deploy/cli (I6), thin entries with logic in plugins/lib not routers (I4), no stray scattered functions + the lib-vs-plugin boundary (I3), committed scripts = build/dev/deploy triad only, config declared in place not generated. The web fan-out also checks reference-app conformance (flat components, zero island CSS, vendored fonts, ctx.params routing, runtime data off public/). Accepts free-form natural language. Pass --report-only to audit without editing.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion
argument-hint: (empty = whole project, root-first) or {focus: web|worker|framework|a path} [--iterations N] [--report-only] [--no-adversarial]
disable-model-invocation: true
---

## Moku Core Specification (authoritative)

Before any decision about architecture, the core API, factory chain, config, lifecycle, events, the `ctx` object, types, invariants, or plugin structure — **consult `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/spec-index.md` and open the cited `spec/NN-*.md` file.** The spec is the single source of truth; never rely on memory or guess. Cite spec section IDs (`spec/NN-*.md §N`) in output. Never stage or commit `.planning/` — it is local-only state.

The idiomatic **app shape** rules are the guardrails **I1–I6** in `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/moku-idioms.md`, the skeleton/`index.ts`/config rules in `skeleton-conventions.md`, and the canonical root layouts in the **moku-web** skill (`${CLAUDE_PLUGIN_ROOT}/skills/moku-web/references/layout-structure.md`) and the **moku-worker** skill (`${CLAUDE_PLUGIN_ROOT}/skills/moku-worker/SKILL.md`). The full detection + fix + loop protocol is **`${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/structural-conformance.md`** — read it; this command follows it. Every validator returns the JSON output contract defined in `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/agent-preamble.md`.

## Input — natural language first

`$ARGUMENTS` may be **natural language**. Resolve intent per **`${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/nl-args.md`**: empty → verify the **whole project, root-first**; a phrase naming a surface (`web`, `worker`, `framework`, or a path/file) → focus there but still gap-check the root; `--iterations N` → cap the fix cycles (default **3**); `--report-only` (or "just report / don't change anything") → find + present, change nothing; `--no-adversarial` (or "skip the skeptic pass") → take findings as-is. Echo a one-line `Interpreting as: …` only when NL was interpreted.

## Project Configuration
!`test -f .claude/moku.local.md && head -20 .claude/moku.local.md || true`

**Verify** that a Moku project is structured the way Moku ideology requires — and **fix what isn't**. This is the
**single verification entry point**: it merges the root/entrypoint idiom check with the full aggressive validator
fan-out (the former `/moku-verify` workflow). The **emphasis is the root/entrypoint files** (where the app is
composed, routes are declared, and config lives), because that is where agents most commonly violate the
framework: dumping logic into routers and entrypoints, generating config instead of declaring it in place,
duplicating entrypoints beyond the legitimate browser/server split, and scattering one-off functions. On top of
that it runs **every** Moku validator (spec, plugin-spec, jsdoc, readable-code, common, type, test, web,
architecture) so nothing is missed, **iterates (default 3 cycles), auto-fixing**, and never commits.

---

## Intent Normalization (Pre-Parse)

- `$ARGUMENTS` empty → **FOCUS = (whole project)**, root pass first, then the whole-project pass.
- A phrase naming a surface (`web` / `worker` / `framework` / a path) → **FOCUS = that surface**, but still
  gap-check the root (don't silently narrow — a botched neighbour root is still a risk).
- `--iterations N` anywhere → **ITERATIONS = N** (else **3**; `--report-only` forces a single pass).
- `--report-only` anywhere → **REPORT_ONLY = true** — run the find + present the ranked findings, apply **no** fixes.
- `--no-adversarial` anywhere → **ADVERSARIAL = false** — skip the skeptic pass (default **true**).
- `--skeptics N` anywhere → **SKEPTICS_PER_FINDING = N** (else **2**).
- Wrong-command detection: if the request is about *building*/*planning*/*e2e-testing*, point at
  `/moku:build` · `/moku:plan` · `/moku:e2e` and stop.

---

## Step 0: Guards & Scope Gate

1. **Filesystem guard:** a `package.json` must be present. If none → "Not a Moku project — run from the project root." Stop.
2. **Detect the project kind** (Framework L2 / Web app L3 / Worker app L3 / Full-stack L3) exactly as `structural-conformance.md §"Step 0"` describes. A pure non-Moku dir → decline like `/moku:check`.
3. **Parse FOCUS / ITERATIONS / REPORT_ONLY / ADVERSARIAL / SKEPTICS_PER_FINDING** (above).
4. **Discover scope:** `Glob src/plugins/*/` for the plugin list (empty list → whole-project / root-only run).

---

## The loop (follow `structural-conformance.md` — default ITERATIONS = 3)

For cycle `1..ITERATIONS`:

1. **Find (parallel, read-only).** Spawn the **full validator set** with the `Agent` tool in one parallel
   batch — reuse the fan-out pattern from `/moku:check`. Agent types **MUST** be namespaced (`moku:<name>`),
   or they silently fail to launch:
   - **`moku:moku-root-validator`** (primary — the root/entrypoint/app-shape gap, I1–I6 + lib-vs-plugin + non-triad scripts + config-in-place).
   - `moku:moku-spec-validator`, `moku:moku-plugin-spec-validator`, `moku:moku-jsdoc-validator`,
     `moku:moku-readable-code-validator`, `moku:moku-common-validator`, `moku:moku-type-validator`,
     `moku:moku-test-validator`, `moku:moku-architecture-validator`, and `moku:moku-web-validator`
     (the web validator self-skips with PASS on non-web projects).
   - Each validator must end with the JSON output contract (`agent-preamble.md`). **Retry a validator up to
     3×** if it returns no parseable verdict. A validator that *still* returns no verdict is **un-run** — that
     means the project was **not fully verified**, which is a **FAIL**, never a shrug.
2. **Rank.** Dedupe findings by `file+line+rule` (plain logic); sort **root/structural blockers first**
   (I1 → I2 → I4 → I3 → config → secondary). Under the aggressive verdict, **blockers AND warnings are both
   fail-worthy issues** — warnings are not a free pass — but keep the severity for fixing and the report.
3. **Adversarial uphold pass** (skip if `ADVERSARIAL = false`). Challenge **every** finding with
   `SKEPTICS_PER_FINDING` (default 2) `moku:moku-skeptic` agents. Each skeptic **upholds by default** and may
   **refute only by citing** the specific spec/house-style section that proves the finding is not a violation
   (or that it is out of scope — test/type-only/generated file — or misquotes the rule). A pattern repeated
   across plugins is **not** automatically a convention; refute on repetition only if `house-style.md`
   explicitly approves it (cite it). Drop a finding **only on unanimous, cited refutation** — the finding wins
   every tie. Log `N refuted (cited), M upheld`.
4. **Fix** (skip entirely if `REPORT_ONLY`): apply the recipes in `structural-conformance.md §"Step 2"` —
   **root/structural first** (drop a core dep from a Layer-3 app → extract logic out of entries → relocate
   stray functions → collapse gratuitous entrypoints → inline a `makeApp(...)`/factory wrapper back to a bare
   `export const app = createApp({ … })` literal when the parameter has no second call site), then the
   secondary fixes the validators prescribe. **Structural refactors are behaviour-preserving** — never change a
   public signature, return type, route, event name, error-message text, or runtime behaviour. **Real gaps get
   real fixes:** missing tests → write them (match the sibling plugins' conventions); stale/misleading docs →
   correct them against the source; missing type-guards / JSDoc / `import type` → add them.
5. **Re-verify:** `bun run format`, `bunx tsc --noEmit`, `bun run lint`, `bun run test` (skip gracefully if a
   script is absent). If a fix regressed a check, **revert or correct it** before the next cycle — never leave
   the tree red.
6. **Stop early** when a full pass surfaces nothing new (no issues **and** no un-run validators).

**Stop conditions:** clean pass OR `ITERATIONS` reached. If findings remain at the budget, **STOP and report
them with their fixes** — never fake clean, never loop unbounded.

---

## Disposition & Present

**Verdict — aggressive:** `PASS` **only if** the final pass is fully clean (zero blockers, zero warnings) **and**
every validator returned a verdict. Any surviving blocker, **any** warning, or **any** un-run validator → `FAIL`.

Output the per-guardrail summary from `structural-conformance.md §"Output"` — project kind, the root-file
checklist, a table of found/fixed/remaining per guardrail (I1–I6 + lib-vs-plugin + scripts + config + secondary), the validators that ran
vs. any that were un-run, the count of refuted-by-skeptic findings, cycles used, the `tsc`/`lint`/`test` result,
and any remaining items with their concrete fix. If `REPORT_ONLY`, present the full ranked findings and confirm
nothing was changed.

## Rules

- **Root files first.** The app-composition / entrypoint / config conformance is the primary job; the
  whole-project validators are the secondary pass. Always gap-check the root even under a narrow FOCUS.
- **Aggressive by default.** A blocker, ANY warning, or any validator that did not run fails the verification —
  an un-run validator means the project was not fully checked, so it is a FAIL, not a pass.
- **Uphold findings.** The skeptic pass exists to drop only *provably-wrong* findings; a finding survives unless
  it is refuted **unanimously and with a citation**. When uncertain, the finding stands.
- **Never flag an idiom.** Multiple `createApp` instances across frameworks/runtimes, two frameworks
  side-by-side, and folder-splitting are **idiomatic** (`moku-idioms.md "What's IDIOMATIC"`) — never report
  them. But every *non*-idiom is fair game: **I1–I5, config-not-in-place, and fat entries are all hard
  BLOCKERs** when violated (a `makeApp(...)`/factory wrapping `createApp` with no second call site included).
- **Fix, don't just flag** (unless `--report-only`). Apply the smallest correct structure-only refactor,
  re-verify, loop. High-blast-radius or ambiguous changes become proposals, not forced edits.
- **Confirm, don't assume.** A guardrail is "clean" only after `tsc`/`lint`/`test` pass on the fixed tree —
  never report green on an unverified change.
- **Stay in source; don't commit.** Edit app/framework source only. Never stage or commit `.planning/`;
  never `--no-verify`; never write to the plugin cache.

## Examples

- `/moku:verify` — whole project, root-first; full validator fan-out + skeptic pass; fix all structural + secondary violations across ≤3 cycles; aggressive PASS/FAIL.
- `/moku:verify web` — focus the web root (`app.ts`/`spa.tsx`/`routes.tsx`/`config.ts`), still gap-check the rest.
- `/moku:verify the worker entrypoint --report-only` — find structural + validator issues in `server.ts`/`cloudflare/worker.ts` and report; change nothing.
- `/moku:verify --iterations 5` — allow up to 5 fix cycles for a project with deep root debt.
- `/moku:verify --no-adversarial` — skip the skeptic pass and take every validator finding at face value.
