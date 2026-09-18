# Moku Idiomatic Architecture — rubric & worked reference

The **architecture-shape** rubric: is a proposed app structured the idiomatic Moku way? It complements the
code-level rules in [`invariants.md`](invariants.md) (R1–R9, naming, lifecycle) — those check *how a
plugin is written*; this checks *how a whole app is composed*.

This catalog **describes** the idiomatic app shape directly — build to it; you do not need any example
project to follow it. A public worked example of this exact shape (a Layer-3 full-stack app on
`@moku-labs/web` client + `@moku-labs/worker` Cloudflare backend) lives in the **`tracker`** app of the
public repo **`github.com/moku-labs/demos`** — consult it only if a concrete reference helps; it is
illustrative, not required, and never assume a reader has it checked out.

> **Cite both** `demos/tracker` (the worked example) and the underlying `spec/NN-*.md §N` /
> `architecture.md` / `consumer-plugins.md` when reporting. Where this catalog and `spec/` disagree, the
> spec wins.

---

## What's IDIOMATIC — bless these, never flag them

These are normal and correct. The validators must **NOT** report them as anti-patterns (the prior version
of this rubric wrongly did — that was a bug):

- **Multiple `createApp` instances in one app.** `tracker` has **three**: `src/app.ts` (Node build
  composition, web), `src/spa.tsx` (browser SPA, web), `src/server.ts` (the worker server). Each composes
  the plugins for its framework + runtime. More than one `createApp` is expected, not a smell.
- **Composing multiple frameworks side-by-side.** `tracker` depends on **both** `@moku-labs/web` **and**
  `@moku-labs/worker` in one project — web for the client/islands, worker for the Cloudflare server (DO,
  Queues, R2, D1, KV). A full-stack Moku app routinely uses more than one framework. This is the norm.
- **Splitting the project into many folders by concern.** `tracker/src` has `cloudflare/` (the thin Worker
  entry), `components/` + `islands/` + `pages/` + `layouts/` + `styles/` (web UI), `lib/` (pure helpers),
  `plugins/{name}/` (plugin-shaped concerns), plus `config.ts`, `routes.tsx`, `endpoints.ts`, `app.ts`,
  `spa.tsx`, `server.ts`. **Folder splitting is good** — split by concern. Never flag it.
- **An app `config.ts`.** Fine — in `tracker` it's the `SITE` identity constants (web Rule R4), **not**
  `createCoreConfig`. Layer-3 apps may have a `config.ts` for app-level constants.

---

## The real guardrails (I1–I6)

Each: the **idiom**, the **anti-pattern** to reject, **how to detect**, the **fix**, and a **severity**.
The hard BLOCKERs are **I1** (an app defining a framework), **I6** (a facade/duplicate app on one runtime),
and the duplicate/facade subcase of **I2**; **I3–I5** are WARNING/guidance — bias toward *guiding to the
`tracker` pattern* there, but a confirmed I1/I2-facade/I6 departure FAILS the build.

### I1 — Apps COMPOSE; they don't DEFINE a framework  *(BLOCKER)*
- **Idiom:** a Layer-3 app uses `createApp` (and `createPlugin`) **from a framework package**; it never
  builds a kernel. (`tracker/src/*.ts` import `createApp` from `@moku-labs/web` / `@moku-labs/worker`;
  zero `@moku-labs/core`.) Cite `architecture.md` (Consumer Mental Model), `consumer-plugins.md`.
- **Anti-pattern:** a Layer-3 app that calls `createCoreConfig`/`createCore`, or declares a **direct**
  `@moku-labs/core` dependency, to "set up its own framework". That is Layer-2 work.
- **Detect:** `@moku-labs/core` in an app's `package.json` dependencies; `createCoreConfig`/`createCore`
  in app source.
- **Fix:** `createApp` from the framework package; author plugin-shaped concerns via the framework's
  re-exported `createPlugin`.
- **Severity:** **BLOCKER.** (This is the one structural rule that genuinely holds for every app —
  confirmed by `tracker`'s CLAUDE.md and source.)

### I2 — Each `createApp` composes ONE framework's plugins; frameworks integrate at the edges  *(WARNING for fusing; BLOCKER for a duplicate/facade app on one runtime)*
- **Idiom:** a full-stack app uses a **separate `createApp` per framework/runtime** — a web client app
  **and** a worker server app — wired together at the edges: the worker serves the client's built bundle
  (`env.ASSETS`) and the client calls the worker's HTTP/WS API. (`tracker`: `server.ts` worker app +
  `app.ts`/`spa.tsx` web apps; `cloudflare/worker.ts` branches `/api`+`/ws` to `server.server.handle` and
  everything else to `ASSETS`.) For one runtime there is **exactly one** `createApp` — see the worked
  worker-composition idiom in **I6** below.
- **Anti-patterns:**
  - **Fusing** two frameworks' plugin sets into a single `createApp` (e.g. jamming worker resource plugins
    into the web `createApp`), or inventing a bespoke "cross-framework mega-app" glue layer. (Largely
    prevented by types — *(WARNING)*.)
  - **Two side-by-side apps for ONE runtime** — e.g. a worker `createApp` for the runtime plus a *second*
    worker `createApp` whose only job is to generate `wrangler.jsonc` / wire deploy. This is **never**
    idiomatic: one runtime gets one `createApp` that composes BOTH the runtime plugins AND the
    deploy/cli plugins. *(BLOCKER — see I6.)*
- **Detect:** one `createApp` whose `plugins: [...]` mixes plugins from two different framework packages
  (fusing); **OR two `createApp` calls importing from the same framework package for the same runtime**
  (duplicate/facade — count `createApp` calls per framework package, not just per framework).
- **Fix:** one `createApp` per framework/runtime; integrate over the wire / via the ASSETS binding like
  `tracker`. Collapse a second same-runtime app into the first (compose its plugins into the one app).
- **Severity:** **WARNING** for fusing; **BLOCKER** for a duplicate/facade same-runtime app (I6).

### I3 — Plugin-shaped concerns are `createPlugin` plugins from the FRAMEWORK package  *(WARNING)*
- **Idiom:** custom, plugin-shaped concerns (typed `app.<x>.method()` API, events, lifecycle, shared
  state, cross-plugin deps) live in `src/plugins/{name}/` via the framework's re-exported `createPlugin`.
  (`tracker`: `trackerPlugin = createPlugin("tracker", …)` imported from `@moku-labs/worker`.) Pure
  helpers go in `lib/`; client-only DOM behaviour in `islands/`.
- **Anti-pattern:** importing `createPlugin` from `@moku-labs/core`; or folding a genuinely plugin-shaped
  concern into config/`lib/` with no plugin.
- **Detect:** `createPlugin` imported from `@moku-labs/core`; a plugin-shaped requirement covered only by
  a `lib/` helper.
- **Fix:** `createPlugin` from the framework; `src/plugins/{name}/`.
- **Severity:** **WARNING** (BLOCKER only for the `@moku-labs/core` import — that's an I1 violation too).

### I4 — Entries/adapters stay thin; logic lives in plugins  *(WARNING)*
- **Idiom:** the Cloudflare `worker.ts` default export (and any `index.ts`) is a **thin adapter** —
  route-branch + `ASSETS` passthrough + queue drain — that drives the `server` app. All resource access
  (D1/KV/Queues/R2/DO) and business logic live in plugins (`tracker`), reached via the app API /
  `ctx.require`. Mirrors R3 (index.ts is wiring only).
- **Anti-pattern:** substantial business logic or direct binding access in the entry/adapter instead of a
  plugin.
- **Detect:** the Worker entry / `index.ts` contains domain logic, DB/KV calls, etc. beyond wiring.
- **Fix:** move it into a plugin; keep the entry to adapter glue.
- **Severity:** **WARNING** (BLOCKER if the entry is clearly doing a plugin's job at length).

### I5 — Use the framework's plugins; don't reinvent primitives  *(WARNING)*
- **Idiom:** reach resources/services through the framework's plugins and `ctx.require`; events for
  notifications, `ctx.require` for request/response. (`invariants.md` "Inventing new primitives".)
- **Anti-pattern:** a bespoke service/manager/registry/DI layer, or `emit` used as RPC, layered on top of
  the kernel.
- **Detect:** new "manager/service/provider/registry/orchestrator" primitives; `emit` awaited for a reply.
- **Fix:** use framework plugins + `ctx.require`; build a `createPlugin` plugin if you need new behaviour.
- **Severity:** **WARNING** (BLOCKER if it reintroduces a forbidden primitive from `invariants.md`).

### I6 — ONE worker app composes resource plugins + the runtime plugin + deploy/cli; no facade app  *(BLOCKER)*
- **Idiom (the worker-composition / "tracker" pattern):** a worker backend is a **single**
  `@moku-labs/worker` `createApp` that composes, in one `plugins:[]`, **the resource plugins**
  (`storage`/`kv`/`d1`/`queues`/`durableObjects` as the deploy plugin requires) **+ the app's runtime
  plugin** (its own `createPlugin`, or a framework's runtime/hub plugin like `@moku-labs/room`'s
  `hubPlugin`) **+ `deploy` + `cli`**. `server.<runtime>.handle` is the runtime fetch;
  `server.cli.{dev,deploy}` generate `wrangler.jsonc` and run wrangler. The app owns its whole worker
  composition. **Worked reference:** `tracker/src/server.ts` (full-stack worker) — ONE `createApp` over
  `[storage, kv, d1, queues, durableObjects, hubPlugin, deploy, cli]`, configuring only the resources it
  uses.
- **Anti-pattern — the facade app:** a **second** app whose only purpose is to emit config — e.g. a
  worker `createApp` for the runtime, plus a separate `createApp` (or in-framework plugin) that exists
  solely to generate `wrangler.jsonc` / wire deploy because the first one "can't". The idiomatic answer is
  always to compose `deploy`+`cli` INTO the one runtime app, not to stand up a config-only facade beside
  it. (A facade worker app or a custom in-framework plugin standing in for deploy/cli is the rejected
  anti-pattern.)
- **Anti-pattern — assumed generator:** deciding "framework X's runtime IS the worker / auto-generates
  the deploy config" **without confirming it ships a generator**. Never assume a framework's
  runtime/server export ships a deploy-config generator (e.g. a `wrangler.jsonc` emitter); assuming one
  forces a multi-iteration rework when it ships no cli/generator. **Never assume a framework capability
  from memory or a spec doc** — verify it against the installed package's `exports` + `dist`/types (the
  framework-capability verification step in `build-app.md` Step 2 / `build-framework.md` / `/moku:plan`).
- **Detect:** two `createApp` for the same runtime where one configures no real runtime plugins (only
  `deploy`/`cli`); a hand-rolled `wrangler.jsonc` generator or a `*-config`/`*-facade` app/plugin; a
  composition/deploy decision that names a framework generator with no source citation.
- **Fix:** collapse to one `createApp` composing resource plugins + the runtime plugin + `deploy` + `cli`;
  delete the facade; route the runtime fetch through `server.<runtime>.handle`.
- **Severity:** **BLOCKER.** A facade/duplicate-runtime app is a confirmed departure from the worker idiom.

---

## How the validators report it

I1–I6 are checked at **two times**: at **plan time** by `brainstorm-challenger` and `moku-plan-checker`
(an **Idiomatic Architecture** section), and at **build/verify time** by **`moku-root-validator`** (the
read-only root/entrypoint finder driven by **`/moku:verify`**) — which closes
the long-standing gap where nothing enforced the app shape once code existed (`moku-verifier` even exempts
Layer-3 apps from root-structure checks). All of them check I1–I6 **against the `demos/tracker` pattern**.
Key rules for every one of these validators:

- **Never flag** multiple `createApp` instances, multiple frameworks composed side-by-side, or
  folder-splitting — those are idiomatic (see "What's IDIOMATIC" above). Reporting them is a false
  positive.
- The hard **BLOCKERs** are **I1** (a Layer-3 app that defines a framework via `createCoreConfig`/
  `createCore` or depends on `@moku-labs/core` directly), **I6** (one runtime composed by a single worker
  `createApp` — a config-only facade app/plugin beside it fails), and the **duplicate/facade subcase of
  I2** (a second `createApp` for the same framework+runtime). Fold these into the blockers array, citing
  `moku-idioms.md §I1`/`§I2`/`§I6` + `consumer-plugins.md` / `architecture.md`.
- **I3–I5** (and I2's *fusing* note) are **WARNING/guidance**: nudge toward the `tracker` shape; do not
  block a plan over them.
- When unsure whether an app shape is idiomatic, **compare it to `demos/tracker`** and prefer "matches the
  reference" over inventing a constraint.
