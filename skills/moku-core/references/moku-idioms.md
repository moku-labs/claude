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

## The real guardrails (I1–I5)

Each: the **idiom**, the **anti-pattern** to reject, **how to detect**, the **fix**, and a **severity**.
Only **I1** is a hard BLOCKER; the rest are WARNING/guidance — bias toward *guiding to the `tracker`
pattern*, not blocking.

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

### I2 — Each `createApp` composes ONE framework's plugins; frameworks integrate at the edges  *(WARNING/guidance)*
- **Idiom:** a full-stack app uses a **separate `createApp` per framework/runtime** — a web client app
  **and** a worker server app — wired together at the edges: the worker serves the client's built bundle
  (`env.ASSETS`) and the client calls the worker's HTTP/WS API. (`tracker`: `server.ts` worker app +
  `app.ts`/`spa.tsx` web apps; `cloudflare/worker.ts` branches `/api`+`/ws` to `server.server.handle` and
  everything else to `ASSETS`.)
- **Anti-pattern:** trying to **fuse** two frameworks' plugin sets into a single `createApp` (e.g. jamming
  worker resource plugins into the web `createApp`), or inventing a bespoke "cross-framework mega-app"
  glue layer. (Largely prevented by types, so this is guidance, not a gate.)
- **Detect:** one `createApp` whose `plugins: [...]` mixes plugins imported from two different framework
  packages.
- **Fix:** one `createApp` per framework; integrate over the wire / via the ASSETS binding like `tracker`.
- **Severity:** **WARNING.** Multiple instances and multiple frameworks are EXPECTED — only the *fusing*
  shape is worth a note.

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

---

## How the validators report it

I1–I5 are checked at **two times**: at **plan time** by `brainstorm-challenger` and `moku-plan-checker`
(an **Idiomatic Architecture** section), and at **build/verify time** by **`moku-root-validator`** (the
read-only root/entrypoint finder driven by **`/moku:verify`**) — which closes
the long-standing gap where nothing enforced the app shape once code existed (`moku-verifier` even exempts
Layer-3 apps from root-structure checks). All of them check I1–I5 **against the `demos/tracker` pattern**.
Key rules for every one of these validators:

- **Never flag** multiple `createApp` instances, multiple frameworks composed side-by-side, or
  folder-splitting — those are idiomatic (see "What's IDIOMATIC" above). Reporting them is a false
  positive.
- The only hard **BLOCKER** is **I1** — a Layer-3 app that defines a framework (`createCoreConfig`/
  `createCore`) or depends on `@moku-labs/core` directly. Fold it into the blockers array, citing
  `moku-idioms.md §I1` + `consumer-plugins.md` / `architecture.md`.
- I2–I5 are **WARNING/guidance**: nudge toward the `tracker` shape; do not block a plan over them.
- When unsure whether an app shape is idiomatic, **compare it to `demos/tracker`** and prefer "matches the
  reference" over inventing a constraint.
