# Structural Conformance — root/entrypoint idiom checking + auto-fix loop

The how-to for **`/moku:verify`**: prove a Moku project is structured the idiomatic way — with a
**primary focus on the root/entrypoint files** agents most often botch — and **iterate, fixing**, until
it is clean. This is the build/verify-time counterpart to the plan-time idiom check
(`brainstorm-challenger` / `moku-plan-checker`): until now **nothing** enforced the app-shape guardrails
once code existed, and the `moku-verifier` even *exempts* Layer-3 apps from root-structure checks. This
document closes that gap.

> **This file is the loop + detection protocol, not the rules.** The authoritative *rules* live in:
> the app-shape guardrails **I1–I5** in [`moku-idioms.md`](moku-idioms.md); the skeleton/`index.ts`/config
> rules in [`skeleton-conventions.md`](skeleton-conventions.md); the code invariants **R1–R9** in
> [`agent-preamble.md`](agent-preamble.md) (origin `spec/11-INVARIANTS.md`); the canonical web root in the
> **moku-web** skill ([`../../moku-web/references/layout-structure.md`](../../moku-web/references/layout-structure.md))
> and the worker root in the **moku-worker** skill ([`../../moku-worker/SKILL.md`](../../moku-worker/SKILL.md)).
> Cite those (`moku-idioms.md §I1`, `skeleton-conventions.md §1`, `spec/NN-*.md §N`) — never re-derive a rule here.

---

## Prime directive — confirm against the idiom; fix what's wrong; never invent a constraint

1. **The root files are the first thing to get right.** Where an app is *composed* (`createApp`), where
   routes are *declared* (`routes.tsx`/`endpoints.ts`), and where config *lives* (`config.ts` /
   `pluginConfigs`) determine whether the whole project reads clearly. A botched root makes every plugin
   harder to reason about. Check these **before** anything else.
2. **Fix, don't just flag.** A confirmed violation is **refactored in source** (recipes below), then
   re-verified (`tsc`/`lint`/`test`). `/moku:verify` loops (default **3 cycles**) toward clean idiomatic
   code — it is not a report generator (unless `--report-only`).
3. **Never flag an idiom.** The multiple-`createApp` browser/server/build split, two frameworks composed
   side-by-side, and folder-splitting-by-concern are **idiomatic** (`moku-idioms.md` "What's IDIOMATIC") —
   reporting them is a false positive and a bug. Only **I1** is a hard BLOCKER.
4. **Ground every finding.** Cite a file:line + the rule ID. When uncertain, WARNING not BLOCKER, and
   challenge risky structural blockers with `moku-skeptic` before fixing.

---

## Step 0 — detect the project kind (the rules differ by kind)

Mirror `architecture-validator.md §"Project context"`:

| Kind | Tell | Canonical root files |
|------|------|----------------------|
| **Framework (Layer 2)** | `src/config.ts` with `createCoreConfig`; `src/index.ts` with `createCore` re-exporting `createApp`/`createPlugin`; `src/plugins/index.ts` barrel | `src/config.ts`, `src/index.ts`, `src/plugins/index.ts` |
| **Web app (Layer 3)** | `createApp` from `@moku-labs/web`; `src/index.html` + `src/routes.tsx` | `app.ts` (Node/SSG compose), `spa.tsx` (browser entry), `routes.tsx` (the **single** route table), `config.ts` (SITE constants — **not** `createCoreConfig`), `islands/`, `pages/`, `layouts/`, `lib/`, thin `scripts/*.ts` |
| **Worker app (Layer 3)** | `createApp` from `@moku-labs/worker` | `server.ts` (worker compose), thin `cloudflare/worker.ts` (route `/api`+`/ws` → `server.handle`, else `ASSETS`), `endpoints.ts` |
| **Full-stack (Layer 3)** | depends on **both** `@moku-labs/web` and `@moku-labs/worker` | the web roots **and** the worker roots above — **all of them present is correct, not duplication** |

A pure non-code or non-Moku dir → decline (like `check`). Layer-3 apps **never** have `src/config.ts` with
`createCoreConfig`.

---

## Step 1 — the conformance checklist (root-first)

Run these in order; the first block is the user's top pain and the reason this command exists.

### A. App composition & entrypoints — `moku-idioms.md` I1–I2
- **I1 (BLOCKER):** a Layer-3 app must `createApp` from a *framework* package and must **not** call
  `createCoreConfig`/`createCore` or declare a direct `@moku-labs/core` dependency. **Detect:**
  `@moku-labs/core` in app `package.json`; `createCoreConfig`/`createCore` / `createPlugin` imported from
  `@moku-labs/core` in app source.
- **I2 (WARNING):** **one `createApp` per framework/runtime.** Count `createApp` calls and the framework
  each composes. The legit split is `app.ts` (web build) + `spa.tsx` (web browser) + `server.ts` (worker)
  — **bless it.** Flag only: (a) **fusing** — one `createApp` whose `plugins:[]` mixes two framework
  packages; or (b) **gratuitous duplication** — two `createApp` for the *same* framework+runtime with
  overlapping plugin sets / copy-pasted entries that should be one.

### B. Thin entries — logic belongs in plugins/lib — `moku-idioms.md` I4 + skeleton §1
- **I4/R3 (WARNING; BLOCKER if egregious):** entries/adapters (`cloudflare/worker.ts`, framework
  `src/index.ts`, route handlers) must be **wiring/glue only**. **Detect:** business logic, DB/KV/Queue/R2
  access, data transforms, or non-trivial helpers living *inside* `routes.tsx` handlers, `worker.ts`,
  `server.ts`, or `app.ts`/`spa.tsx` rather than in a plugin (`ctx.require`) or `lib/`. A `routes.tsx`
  loader doing real work inline (not via `lib/content.ts`-style helpers) is the canonical offense.

### C. No stray / scattered functions — `moku-idioms.md` I3 + skeleton §8
- **I3 (WARNING):** organize by concern, consistently. **Detect:** a one-off function dropped into a root
  file or an unrelated file ("random function here and there"); a plugin-shaped concern (typed API +
  events + state + deps) folded into `lib/` or config instead of a `createPlugin` plugin; a pure helper
  living inside an entry instead of `lib/`. The fix is *relocation by logic*, not new behavior.

### D. Config in place, not generated — `skeleton-conventions.md` §2 + moku-web `layout-structure.md`
- **Detect:** config *assembled dynamically* (plugins array / `pluginConfigs` built by functions, loops,
  spreads, or conditionals at module load) or split across generated files, instead of **declared as a
  typed literal** so a reader sees the whole composition at a glance. Inline `as` in `config`/`createState`
  (R6) is a BLOCKER. The idiom: a literal `createApp({ plugins:[…], config:{…}, pluginConfigs:{…} })` and a
  `config.ts` of plain constants.

### E. Wiring `index.ts` + naming — `skeleton-conventions.md` §1/§8, R3/R4
- Plugin `index.ts` ≤30 effective lines, wiring only (R3). Plugin instance export uses the `<name>Plugin`
  suffix; the name string stays bare (R4). Framework `src/plugins/index.ts` barrel present (frameworks
  only). These reuse the existing validators — `/moku:verify` leans on `moku-plugin-spec-validator` /
  `moku-spec-validator` here rather than re-checking.

### F. Whole-project pass (secondary)
After the root pass, the curated reuse set covers the rest: `moku-readable-code-validator` (wall-of-text),
`moku-type-validator` (R6/R7/R9, `tsc`), `moku-architecture-validator` (cross-plugin), `moku-web-validator`
(web patterns). Don't duplicate their checks — aggregate their findings.

---

## NEVER flag (false-positive guard — copy into the report's ground rules)
- Multiple `createApp` instances that map to distinct framework/runtime (web build + browser SPA + worker).
- Two frameworks (`@moku-labs/web` + `@moku-labs/worker`) in one project.
- Folder-splitting by concern (`components/`, `islands/`, `pages/`, `layouts/`, `lib/`, `plugins/`).
- An app `config.ts` of constants (it is **not** `createCoreConfig`).
- A flat multi-file plugin layout (tier ≠ directory shape — `skeleton-conventions.md §8`).

---

## Step 2 — fix recipes (apply in this priority; smallest correct change)

1. **Drop the framework dep (I1):** replace `createCoreConfig`/`createCore` + `@moku-labs/core` imports
   with `createApp` (+ framework-re-exported `createPlugin`); remove `@moku-labs/core` from
   `package.json`. *(Highest priority — the only hard BLOCKER.)*
2. **Extract logic out of an entry (I4):** move inline business logic from `worker.ts`/`server.ts`/
   `routes.tsx`/`app.ts` into the owning plugin (reach it via `ctx.require`) or a pure `lib/` helper;
   leave the entry as adapter glue. Pattern: the `lib/content.ts` `allArticles(ctx)` shape from
   `moku-web/layout-structure.md`.
3. **Relocate a stray function (I3):** move a misplaced helper to `lib/` (pure) or fold a plugin-shaped
   concern into `src/plugins/{name}/` via `createPlugin`. Keep imports updated; no behavior change.
4. **Collapse gratuitous entrypoints (I2):** merge duplicate same-framework `createApp`s into the canonical
   one; split a *fused* `createApp` into per-framework apps wired at the edges (`ASSETS` + over-the-wire).
5. **Config in place (skeleton §2):** replace dynamically-assembled config with a typed literal; hoist
   inline `as` to a typed const / return-type annotation.
6. **Then** the secondary-pass fixes (readability, types) as the validators prescribe.

Refactors are **structure-only** — never change a public signature, route, event name, or behavior. If a
fix is high-blast-radius or ambiguous, downgrade to a proposal and surface it instead of forcing it.

---

## Step 3 — the loop (default 3 cycles)

```
for cycle in 1..ITERATIONS (default 3):
  find    → spawn read-only validators in parallel: moku-root-validator (primary)
            + readable-code / spec / plugin-spec / architecture / type (+ web if web)
  rank    → dedupe by file+line+rule; sort root/structural blockers first
  verify? → (risky structural blockers) moku-skeptic refute-pass; drop the refuted
  fix     → apply recipes above, root/structural first  (skip entirely if --report-only)
  recheck → bun run format · bunx tsc --noEmit · bun run lint · bun run test  (skip absent scripts)
  if a full pass surfaces nothing new (clean) → STOP early
present → summary
```

**Stop conditions:** clean pass (zero new findings) **or** `ITERATIONS` reached. If findings remain at the
budget, **STOP and report them with their fixes** — never fake clean, never loop unbounded. Never commit;
never touch `.planning/`.

---

## Output — what `/moku:verify` reports

A per-guardrail summary:

```
Moku Structural Conformance — <project kind>
Root files: app.ts ✓  spa.tsx ✓  routes.tsx ✓  server.ts ✓  cloudflare/worker.ts ✓

| Guardrail | Found | Fixed | Remaining |
|-----------|-------|-------|-----------|
| I1 core-dep / createCoreConfig (BLOCKER) | 1 | 1 | 0 |
| I2 entrypoint duplication                | 2 | 2 | 0 |
| I3 stray functions                       | 3 | 3 | 0 |
| I4 logic in entry                        | 1 | 1 | 0 |
| config-in-place / R6                     | 2 | 2 | 0 |
| secondary (readable / types / arch)      | 5 | 4 | 1 |

Cycles: 2 of 3 (clean on cycle 2).  Verified: tsc ✓ lint ✓ test ✓.  No commit made.
Remaining: <file:line + the fix>  (or "none — idiomatic").
```

Present remaining items with their concrete fix; if `--report-only`, present the full ranked findings and
change nothing.
