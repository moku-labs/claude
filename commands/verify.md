---
description: Verify a Moku project is structured the idiomatic way — primary focus on the ROOT/ENTRYPOINT files agents most often botch (app.ts/spa.tsx/server.ts/cloudflare/worker.ts/routes.tsx/config.ts): apps compose and never define a framework (I1), one createApp per framework with no gratuitous duplicate entrypoints (I2), thin entries with logic in plugins/lib not routers (I4), no stray scattered functions (I3), config declared in place not generated. Iterates (default 3 cycles), auto-fixing toward clean idiomatic code, re-verifying each pass. Accepts free-form natural language.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion
argument-hint: (empty = whole project, root-first) or {focus: web|worker|framework|a path} [--iterations N] [--report-only]
disable-model-invocation: true
---

## Moku Core Specification (authoritative)

Before any decision about architecture, the core API, factory chain, config, lifecycle, events, the `ctx` object, types, invariants, or plugin structure — **consult `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/spec-index.md` and open the cited `spec/NN-*.md` file.** The spec is the single source of truth; never rely on memory or guess. Cite spec section IDs (`spec/NN-*.md §N`) in output. Never stage or commit `.planning/` — it is local-only state.

The idiomatic **app shape** rules are the guardrails **I1–I5** in `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/moku-idioms.md`, the skeleton/`index.ts`/config rules in `skeleton-conventions.md`, and the canonical root layouts in the **moku-web** skill (`${CLAUDE_PLUGIN_ROOT}/skills/moku-web/references/layout-structure.md`) and the **moku-worker** skill (`${CLAUDE_PLUGIN_ROOT}/skills/moku-worker/SKILL.md`). The full detection + fix + loop protocol is **`${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/structural-conformance.md`** — read it; this command follows it.

## Input — natural language first

`$ARGUMENTS` may be **natural language**. Resolve intent per **`${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/nl-args.md`**: empty → verify the **whole project, root-first**; a phrase naming a surface (`web`, `worker`, `framework`, or a path/file) → focus there but still gap-check the root; `--iterations N` → cap the fix cycles (default **3**); `--report-only` (or "just report / don't change anything") → find + present, change nothing. Echo a one-line `Interpreting as: …` only when NL was interpreted.

## Project Configuration
!`test -f .claude/moku.local.md && head -20 .claude/moku.local.md || true`

**Verify** that a Moku project is structured the way Moku ideology requires — and **fix what isn't**. The
emphasis is the **root/entrypoint files** (where the app is composed, routes are declared, and config
lives), because that is where agents most commonly violate the framework: dumping logic into routers and
entrypoints, generating config instead of declaring it in place, duplicating entrypoints beyond the
legitimate browser/server split, and scattering one-off functions. This is the build/verify-time
counterpart to the plan-time idiom check — until now nothing enforced I1–I5 once code existed, and the
`moku-verifier` even exempts Layer-3 apps from root-structure checks. `/moku:verify` closes that gap and
**iterates (default 3 cycles), auto-fixing**, never committing.

---

## Intent Normalization (Pre-Parse)

- `$ARGUMENTS` empty → **FOCUS = (whole project)**, root pass first, then the whole-project pass.
- A phrase naming a surface (`web` / `worker` / `framework` / a path) → **FOCUS = that surface**, but still
  gap-check the root (don't silently narrow — a botched neighbour root is still a risk).
- `--iterations N` anywhere → **ITERATIONS = N** (else **3**).
- `--report-only` anywhere → **REPORT_ONLY = true** — run the find + present the ranked findings, apply **no** fixes.
- Wrong-command detection: if the request is about *building*/*planning*/*e2e-testing*, point at
  `/moku:build` · `/moku:plan` · `/moku:e2e` and stop.

---

## Step 0: Guards & Scope Gate

1. **Filesystem guard:** a `package.json` must be present. If none → "Not a Moku project — run from the project root." Stop.
2. **Detect the project kind** (Framework L2 / Web app L3 / Worker app L3 / Full-stack L3) exactly as `structural-conformance.md §"Step 0"` describes. A pure non-Moku dir → decline like `/moku:check`.
3. **Parse FOCUS / ITERATIONS / REPORT_ONLY** (above).

---

## The loop (follow `structural-conformance.md` — default ITERATIONS = 3)

For cycle `1..ITERATIONS`:

1. **Find (parallel, read-only).** Spawn validators with the `Agent` tool — reuse the fan-out pattern from
   `/moku:check` and `moku-verify.js`:
   - **`moku-root-validator`** (primary — the root/entrypoint/app-shape gap).
   - Whole-project pass: `moku-readable-code-validator`, `moku-spec-validator`,
     `moku-plugin-spec-validator`, `moku-architecture-validator`, `moku-type-validator`, and
     `moku-web-validator` (web projects only). Agent types MUST be namespaced (`moku:<name>`).
2. **Rank.** Dedupe findings by `file+line+rule` (plain logic, as in `moku-verify.js`); sort **root/structural
   blockers first** (I1 → I2 → I4 → I3 → config → secondary).
3. **Adversarially verify risky blockers.** Before fixing a structural blocker that could be a false
   positive (especially anything touching the *legitimate* multi-`createApp` split), challenge it with
   `moku:moku-skeptic`; drop the refuted ones. (Skip for the clear I1 core-dep BLOCKER.)
4. **Fix** (skip entirely if `REPORT_ONLY`): apply the recipes in `structural-conformance.md §"Step 2"` —
   root/structural first (drop core-dep → extract logic out of entries → relocate stray functions →
   collapse gratuitous entrypoints → config-in-place), then the secondary fixes the validators prescribe.
   Refactors are **structure-only** — never change a public signature, route, event name, or behavior.
5. **Re-verify:** `bun run format`, `bunx tsc --noEmit`, `bun run lint`, `bun run test` (skip gracefully if a
   script is absent). If a fix regressed a check, revert or correct it before the next cycle.
6. **Stop early** when a full pass surfaces nothing new (clean).

**Stop conditions:** clean pass OR `ITERATIONS` reached. If findings remain at the budget, **STOP and report
them with their fixes** — never fake clean, never loop unbounded.

---

## Present

Output the per-guardrail summary from `structural-conformance.md §"Output"` — project kind, the root-file
checklist, a table of found/fixed/remaining per guardrail (I1–I5 + config + secondary), cycles used, the
`tsc`/`lint`/`test` result, and any remaining items with their concrete fix. If `REPORT_ONLY`, present the
full ranked findings and confirm nothing was changed.

## Rules

- **Root files first.** The app-composition / entrypoint / config conformance is the primary job; the
  whole-project validators are the secondary pass. Always gap-check the root even under a narrow FOCUS.
- **Never flag an idiom.** Multiple `createApp` instances across frameworks/runtimes, two frameworks
  side-by-side, and folder-splitting are **idiomatic** (`moku-idioms.md "What's IDIOMATIC"`) — never report
  them. Only **I1** is a hard BLOCKER.
- **Fix, don't just flag** (unless `--report-only`). Apply the smallest correct structure-only refactor,
  re-verify, loop. High-blast-radius or ambiguous changes become proposals, not forced edits.
- **Confirm, don't assume.** A guardrail is "clean" only after `tsc`/`lint`/`test` pass on the fixed tree —
  never report green on an unverified change.
- **Stay in source; don't commit.** Edit app/framework source only. Never stage or commit `.planning/`;
  never `--no-verify`; never write to the plugin cache.

## Examples

- `/moku:verify` — whole project, root-first; fix all structural + secondary violations across ≤3 cycles; report.
- `/moku:verify web` — focus the web root (`app.ts`/`spa.tsx`/`routes.tsx`/`config.ts`), still gap-check the rest.
- `/moku:verify the worker entrypoint --report-only` — find structural issues in `server.ts`/`cloudflare/worker.ts` and report; change nothing.
- `/moku:verify --iterations 5` — allow up to 5 fix cycles for a project with deep root debt.
