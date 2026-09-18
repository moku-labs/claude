---
name: moku-common
description: >
  Using @moku-labs/common across the Moku family: the branded CLI renderer
  (@moku-labs/common/cli — palette/BRAND_PINK, box, spinnerFrameAt, makePalette,
  createBrandConsole, styled confirm/select), logPlugin/ctx.log for structured
  logging, and envPlugin/ctx.env for validated environment access. Triggers on:
  "moku common", "@moku-labs/common", "branded cli", "brand console",
  "createBrandConsole", "ctx.log", "ctx.env", "logPlugin", "envPlugin",
  "common log/env plugin", "moku CLI output", or wiring shared CLI/log/env
  infrastructure in a Moku framework OR consumer app.
---

# Moku Common (`@moku-labs/common`)

## Current Project State
!`test -f package.json && grep -E '"@moku-labs/common"' package.json 2>/dev/null || true`
!`test -f package.json && grep -E '"(logPlugin|envPlugin)"' package.json 2>/dev/null || true`

Enforce the family-level conventions for consuming `@moku-labs/common`; keep CLI output
branded, logging structured, and env access validated. These are **family conventions** (how
moku projects consume the shared package) — separate from the upstream Moku Core invariants
R1–R8. The authoritative, citable rules with stable IDs live in
[`references/conventions.md`](references/conventions.md) — start there when validating or
justifying a finding.

## The Rule

**Render CLI output through the branded kit, log through `ctx.log`, read env through `ctx.env`.**
A Moku project never hand-rolls ANSI escapes / box-drawing / spinners, never reaches for raw
`console.*` for diagnostics, and never reads `process.env` directly. The shared package supplies
all three so output looks consistent across the family and logging/env are testable and validated.

## What `@moku-labs/common` provides

| Surface | Import | Use for |
|---------|--------|---------|
| **Branded CLI kit** | `@moku-labs/common/cli` | All human-facing CLI output — palette/`BRAND_PINK`, `box`, `spinnerFrameAt`, `makePalette`, `createBrandConsole()` (`info`/`warn`/`error`/`heading`/`check` + lockup), styled `confirm`/`select` prompts |
| **`logPlugin`** | `@moku-labs/common` | Structured diagnostic/event logging via `ctx.log` (`ctx.log.info/warn/error/debug`) |
| **`envPlugin`** | `@moku-labs/common` | Validated env access via `ctx.env` (`ctx.env.get/require`) |

`logPlugin` and `envPlugin` are **core plugins** — once registered, their APIs are injected flat
on every `ctx` (`ctx.log.*`, `ctx.env.*`), exactly like `@moku-labs/web`'s `log`/`env`. The
branded CLI kit is a plain renderer module (no plugin), imported wherever a CLI prints.

## Wiring: register `logPlugin` + `envPlugin` in `createCoreConfig`

A framework (Layer 2) composes the two core plugins once, so every plugin's `ctx` carries
`ctx.log` and `ctx.env`:

```typescript
// src/config.ts — Layer 2 framework composition
import { createCoreConfig } from "@moku-labs/core";
import { logPlugin, envPlugin } from "@moku-labs/common";

/** Global configuration shape for the framework. */
type Config = { stage: "production" | "development" | "test" };

/** Event contract for the framework. */
type Events = { "app:ready": { timestamp: number } };

export const coreConfig = createCoreConfig<Config, Events, [typeof logPlugin, typeof envPlugin]>(
  "my-framework",
  {
    config: { stage: "development" },
    plugins: [logPlugin, envPlugin], // core plugins → ctx.log + ctx.env on every ctx
  },
);

export const { createPlugin, createCore } = coreConfig;
```

> **Note (R1 still applies):** the explicit `createCoreConfig<Config, Events, [...]>` tuple is
> required only because `Config`/`Events` are given explicitly — once you give ANY explicit type
> arg the third `CorePlugins` tuple arg becomes mandatory (see `skeleton-conventions.md §2`). This
> is NOT the banned explicit-generics-on-`createPlugin` pattern; `createPlugin`/`createCorePlugin`
> calls still infer everything from the spec object.

A consumer app (Layer 3) inherits `ctx.log`/`ctx.env` from its framework — it does NOT register the
core plugins itself (that is the framework's job). Consumer plugins just call `ctx.log.*` / `ctx.env.*`.

## Using `ctx.log` and `ctx.env` inside a plugin

```typescript
// api.ts — domain factory receives ctx via closure
import type { PluginCtx } from "@moku-labs/core";

/**
 * Builds the mailer API.
 *
 * @param ctx - Plugin context (carries ctx.log + ctx.env from the common core plugins).
 * @returns The mailer API.
 * @example
 * ```ts
 * const api = createMailerApi(ctx);
 * api.send("hi@moku.dev");
 * ```
 */
export const createMailerApi = (ctx: PluginCtx) => ({
  send: (to: string) => {
    const apiKey = ctx.env.require("MAILER_API_KEY"); // validated env, not process.env
    ctx.log.info("mailer:send", { to });              // structured log, not console.log
    // ...send mail with apiKey...
  },
});
```

## Rendering CLI output through the brand kit

Any CLI surface (a `cli` plugin command, a `scripts/*.ts` entry, a `bin`) renders via
`createBrandConsole` / the kit — never raw `console.log` with ANSI codes or hand-built boxes:

```typescript
// scripts/deploy.ts — branded CLI output
import { createBrandConsole, box, spinnerFrameAt } from "@moku-labs/common/cli";

const con = createBrandConsole();

con.heading("Deploy");
con.info("Building bundle…");

// spinner via the kit's frame helper (no hand-rolled \r animation)
let frame = 0;
const timer = setInterval(() => process.stdout.write(`\r${spinnerFrameAt(frame++)} working`), 80);
// ...await work...
clearInterval(timer);

con.check("Bundle ready");
process.stdout.write(box("Deployed to https://my-app.dev"));
```

For interactive prompts use the kit's styled `confirm`/`select` (branded palette) rather than a
third-party prompt library or hand-rolled `readline` formatting.

## Anti-Patterns — DON'T Do These

```typescript
// DON'T: raw console.* for diagnostics/events — use ctx.log (MC2)
console.log("user logged in", userId);            // WRONG
console.error("send failed", err);                // WRONG
ctx.log.info("auth:login", { userId });           // CORRECT
ctx.log.error("mailer:send-failed", { err });     // CORRECT

// DON'T: raw process.env — use ctx.env (MC3)
const key = process.env.API_KEY;                  // WRONG — unvalidated, untestable
const port = Number(process.env.PORT ?? 3000);    // WRONG
const key2 = ctx.env.require("API_KEY");          // CORRECT — throws if missing
const port2 = ctx.env.get("PORT") ?? 3000;        // CORRECT — validated accessor

// DON'T: hand-rolled ANSI / box-drawing / spinner — use @moku-labs/common/cli (MC1)
console.log("\x1b[35mDeploying…\x1b[0m");          // WRONG — raw ANSI
console.log("┌────────────┐\n│  Done   │\n└────────────┘"); // WRONG — hand-built box
const frames = ["⠋", "⠙", "⠹"];                    // WRONG — hand-rolled spinner frames
// CORRECT: import { createBrandConsole, box, spinnerFrameAt } from "@moku-labs/common/cli"
const con = createBrandConsole();
con.heading("Deploying…");
process.stdout.write(box("Done"));
```

**Allowed exceptions (so validators/hooks don't false-positive):**
- The brand-kit source itself (`*/common/src/cli/*`) legitimately writes raw ANSI/box/spinner — it
  is the implementation of the kit.
- A **single documented logging sink** (the lowest-level transport `ctx.log` ultimately writes
  through) may call `console.*`; mark it with a `// @log-sink` comment so it is recognized.
- Test files (`*.test.ts`, `*.spec.ts`, `**/__tests__/**`) may use `console.*` and `process.env`
  freely.
- **Env providers** (the module that backs `envPlugin`, e.g. `*/env/*` / a `*EnvProvider`) read
  `process.env` by definition — that is where validated access is implemented.

## References

- [`references/conventions.md`](references/conventions.md) — the authoritative MC rule set (MC1
  branded CLI, MC2 `ctx.log` not `console.*`, MC3 `ctx.env` not `process.env`) with rationale, a
  correct/incorrect example, and detection guidance per rule. **Citable** by validators and the
  `moku-common-validator` agent.

## Related Skills

- **moku-core** — Architecture fundamentals, factory chain, the `ctx` object, core-plugin composition
- **moku-plugin** — Plugin structure + tiers; where domain code that calls `ctx.log`/`ctx.env` lives
- **moku-web** — `@moku-labs/web` already injects `log`/`env` core plugins (`ctx.log.*`/`ctx.env.*`);
  web CLIs (`app.cli.*`) render through the same branded kit
