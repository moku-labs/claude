# @moku-labs/common — Plugin & Property Index

**Synced version:** `0.3.3` (npm `dist-tags.latest`; catalog generated from the `v0.3.3` git tag **source** +
the root `README.md` and the per-module READMEs `src/plugins/log/README.md`, `src/plugins/env/README.md`,
`src/cli/README.md`). Upstream ships **no `llms.txt`**, so the source is the only authority. One regular
dependency, pinned exactly: `@moku-labs/core@1.7.0`. No peer dependencies. Engines node ≥24, bun ≥1.3.14.
`sideEffects: false`, ESM + CJS on `.` and `./cli`, ESM only on `./browser`, types included.

⚠️ The READMEs and JSDoc disagree with the source in four places. The registry's "source wins" policy applies:

| # | Stale text | Source of truth |
|---|-----------|-----------------|
| 1 | `src/plugins/env/README.md` API table: `require` throws `[<framework>] env: …`, "the prefix is the consuming framework's id" | `src/plugins/env/api.ts` and `validate.ts`: `ERROR_PREFIX = "[web]"` is a constant. Every env error starts with `[web]` in every framework |
| 2 | `src/cli/README.md` intro: the kit "ships on the `.` / `./cli` entries" | `src/index.ts` exports no CLI symbol. The kit is on **`./cli` only** |
| 3 | `src/plugins/env/index.ts` and `types.ts` JSDoc: "the `/browser` entry pre-wires `browserEnv()`" | `src/browser.ts` re-exports the same `envPlugin` with `providers: []`. Nothing in this package pre-wires a provider; a **framework's** browser entry may (`@moku-labs/web/browser` does) |
| 4 | Root `README.md` catalog and entry-point tables list the providers as `dotenv · processEnv · cloudflareBindings` + `browserEnv` | `src/index.ts` also exports **`workerSafeProcessEnv`** (from `providers.worker.ts`) |

Also a gap, not a contradiction: the log README names `LogExpectAssertionError` as the thrown class, but no
entry exports it. Match on `error.name === "LogExpectAssertionError"`.

## A plugin catalog, not a framework

`@moku-labs/common` calls neither `createCoreConfig` nor `createCore` and has no `createApp`. It exports two
**core plugins** built with `createCorePlugin` and a set of plain functions. A Layer-2 framework registers
the plugins in its own `createCoreConfig`; a Layer-3 app inherits `ctx.log` / `ctx.env` and registers nothing.
The family rules MC1–MC3 live in the `moku:moku-common-conventions` skill; load it with the Skill tool.

## 1. Entry points (every key of `package.json` `exports`)

| Import | Format | Runtime | Runtime exports | Type exports |
|--------|--------|---------|-----------------|--------------|
| `@moku-labs/common` (`.`) | ESM + CJS | Node (Bun) | `logPlugin`, `envPlugin`, `dotenv`, `processEnv`, `cloudflareBindings`, `browserEnv`, `workerSafeProcessEnv` | namespaces `Log`, `Env`; flat `ExpectChain`, `LogApi`, `LogConfig`, `LogEntry`, `LogLevel`, `LogSink`, `LogState`, `EnvApi`, `EnvConfig`, `EnvProvider`, `EnvState`, `EnvVarSpec` |
| `@moku-labs/common/cli` | ESM + CJS | Node only | `ANSI`, `BRAND_PINK`, `box`, `boxGlyphs`, `CLEAR_BELOW`, `CLEAR_LINE`, `cursorUp`, `fg24`, `makePalette`, `SPINNER_FRAMES`, `spinnerFrameAt`, `supportsColor`, `supportsTruecolor`, `visibleWidth`, `createBrandConsole`, `createBrandPrompts`, `brandedSink` | `AnsiCode`, `BoxGlyphs`, `ColorStream`, `Palette`, `BrandConsole`, `BrandConsoleOptions`, `LockupOptions`, `BrandPrompts`, `BrandPromptsOptions` |
| `@moku-labs/common/browser` | ESM only | browser | `logPlugin`, `envPlugin`, `browserEnv` | the same namespaces and flat types as `.` |

`dotenv`, `processEnv` and `cloudflareBindings` share `src/plugins/env/providers.ts`, which imports `node:fs`.
`workerSafeProcessEnv` (`providers.worker.ts`) and `browserEnv` (`providers.browser.ts`) import nothing from
`node:*`. The browser entry is built as its own ESM pass so its graph never references the Node module; CI
asserts zero static `node:` imports and a gzip budget (`bun run check:bundle`). The flat type re-exports exist
so a framework's inferred `createApp` type can name them (a namespace-only export triggers TS4023).

## 2. Registering the core plugins (`createCoreConfig` third type argument)

```ts
import { createCoreConfig } from "@moku-labs/core";
import { envPlugin, logPlugin, workerSafeProcessEnv } from "@moku-labs/common";

type Config = { stage: "development" | "production" };
type Events = Record<string, never>;

export const coreConfig = createCoreConfig<Config, Events, [typeof logPlugin, typeof envPlugin]>(
  "my-worker-framework",
  {
    config: { stage: "development" },
    plugins: [logPlugin, envPlugin],
    pluginConfigs: {
      log: { mode: "production" },
      env: { providers: [workerSafeProcessEnv()] }, // Cloudflare Worker + Bun/Node deploy scripts
    },
  },
);
export const { createPlugin, createCore } = coreConfig;
```

| Rule | Detail |
|------|--------|
| Third type argument | Required as soon as `Config` / `Events` are explicit: `[typeof logPlugin, typeof envPlugin]`. `createPlugin` / `createCorePlugin` calls stay generic-free |
| Config cascade | 4 levels, **shallow merge**, frozen: spec default → `createCoreConfig.pluginConfigs` → `createCore.pluginConfigs` → `createApp.pluginConfigs`. An override of `env.providers` replaces the array |
| Lifecycle position | Core plugin `createState` → `api` → `onInit` run before any regular plugin. `ctx.log` and `ctx.env` exist in every regular plugin hook, including `createState` |
| Context | Core plugins see `{ config, state }` only: no `depends`, `events`, `hooks`, `onStart`, `onStop` |
| Surfaces | `ctx.log` / `ctx.env` on every regular plugin, `app.log` / `app.env` on the created app |
| Isolation | Fresh state per `createApp`. Two apps never share entries, sinks or env maps |

## 3. Plugins (2) — both core

| # | Plugin | Name / namespace | Tier | Config | `onInit` | Events |
|---|--------|------------------|------|--------|----------|--------|
| 1 | `logPlugin` | `log` / `ctx.log` | Standard (core) | `mode` | `installDefaultSinks` | — |
| 2 | `envPlugin` | `env` / `ctx.env` | Standard (core) | `schema`, `providers`, `publicPrefix` | `validateSchema` | — |

### 3.1 `log` — leveled events, in-memory trace, `expect()` chain

- **Purpose:** every call appends a `LogEntry` to an append-only in-memory trace, then fans it out to each
  registered `LogSink` in registration order. The trace is always on; `expect()` turns it into assertions.
- **Config** (`pluginConfigs.log`):

| Field | Type | Default | Effect |
|-------|------|---------|--------|
| `mode` | `"test" \| "dev" \| "production" \| "silent"` | `"production"` | Selects the default sinks installed at `onInit`. No global `Config` field maps onto it |

| Mode | Console sink | Prints | Trace |
|------|--------------|--------|-------|
| `test` | none | — | on |
| `silent` | none | — | on |
| `dev` | `consoleSink("debug")` | every level | on |
| `production` | `consoleSink("info")` | `info`, `warn`, `error` | on |

- **State:** `LogState = { entries: LogEntry[]; sinks: LogSink[] }`, created empty per app.
- **API** (`LogApi`):

```ts
type LogLevel = "debug" | "info" | "warn" | "error";
type LogEntry = { level: LogLevel; event: string; data?: unknown; ts: number; plugin?: string }; // plugin is reserved, never set
type LogSink = { write(entry: LogEntry): void };

type LogApi = {
  info(event: string, data?: unknown): void;
  debug(event: string, data?: unknown): void;
  warn(event: string, data?: unknown): void;
  error(event: string, data?: unknown, error?: Error): void; // error → data.error = { message, stack }
  trace(): readonly LogEntry[];   // Object.freeze([...entries]) — a snapshot
  expect(): ExpectChain;          // reads the live entries array on every call
  addSink(sink: LogSink): void;
  reset(): void;                  // entries.length = 0; sinks kept
  clearSinks(): void;             // sinks.length = 0; entries kept
};

type ExpectChain = {
  toHaveEvent(event: string, partial?: Record<string, unknown>): ExpectChain;
  toHaveEventInOrder(events: string[]): ExpectChain; // relative order, gaps allowed, event name only
  toNotHaveEvent(event: string, partial?: Record<string, unknown>): ExpectChain;
};
```

- **`error()` merge:** with an `Error`, `data` becomes `{ ...data, error: { message, stack } }`. A non-object
  `data` (array, primitive) is replaced by `{}` first; its value is lost.
- **Partial match** (`matchesPartial`): `Object.is` fast path; plain objects need every `partial` key to match
  recursively, extra keys ignored; arrays need equal length and element-wise matches; an object `partial`
  against `null` or a non-object never matches.
- **Console sink routing:** `error` → `console.error(entry)`, `warn` → `console.warn(entry)`, `debug` /
  `info` → `console.log(entry)`. The whole entry object is passed, so output is an object dump. Entries
  below the threshold are dropped by the sink only; the trace keeps them.
- **Lifecycle:** `createState` → `api` → `onInit` (sinks). No `onStart` / `onStop`; it owns no resource.
  Runtime touches only `console`, `Date.now`, `JSON`, so it runs unchanged in the browser.
- ⚠️ **Gotchas:** `trace()` is a frozen copy, later calls do not appear in it; `expect()` is live, a chain
  created early sees later entries. `LogExpectAssertionError` is not exported. `consoleSink` and
  `installDefaultSinks` are internal. To replace the object dump in a CLI:
  `ctx.log.clearSinks(); ctx.log.addSink(brandedSink("info"))` in a Node-only plugin's `onInit`.

### 3.2 `env` — ordered providers, schema validation, frozen result

- **Purpose:** resolve variables from an ordered provider list against a declared schema, apply defaults,
  assert required ones, enforce the public-prefix rule both ways, then freeze two maps. Fail-fast at
  `createApp` time, never at request time.
- **Config** (`pluginConfigs.env`, `EnvConfig`):

| Field | Type | Default | Effect |
|-------|------|---------|--------|
| `schema` | `Record<string, EnvVarSpec>` | `{}` | Validation and exposure rules per variable |
| `providers` | `EnvProvider[]` | `[]` | Ordered sources. First non-`undefined`, non-empty value per key wins |
| `publicPrefix` | `string` | `"PUBLIC_"` | Prefix a `public: true` key must carry, and that forces `public: true` |

| `EnvVarSpec` field | Type | Default | Effect |
|--------------------|------|---------|--------|
| `public` | `boolean` | required | `true`: key must start with `publicPrefix`; included in `getPublicMap()` |
| `required` | `boolean` | `false` | Throws when still undefined after `default` |
| `default` | `string` | — | Applied when no provider supplies the key |
| `secret` | `boolean` | `false` | Documentation marker; no runtime effect |

- **State:** `EnvState = { resolved: Map<string, string>; publicMap: Map<string, string> }`. Both frozen
  by `freezeMap`: `set` / `clear` / `delete` redefined as non-writable throwers
  (`TypeError("env: map is frozen and cannot be mutated")`), then `Object.freeze`.
- **`onInit` pipeline** (`validateSchema`, exact order): merge providers in array order with `""` coerced
  to `undefined` before precedence → prefix cross-check → apply `default` → assert `required` → fill
  `publicMap` (schema keys with `public: true` and a value) and `resolved` (**every** merged key with a
  value, schema or not) → freeze both.
- **API** (`EnvApi`):

```ts
type EnvProvider = { name: string; load(): Record<string, string | undefined> };
type EnvVarSpec = { public: boolean; required?: boolean; default?: string; secret?: boolean };

type EnvApi = {
  get(key: string): string | undefined;
  require(key: string): string; // throws Error('[web] env: required variable "<key>" is not defined.')
  has(key: string): boolean;
  getPublic(): Readonly<Record<string, string>>; // fresh frozen object from publicMap
  getPublicMap(): ReadonlyMap<string, string>;   // the frozen publicMap itself
};
```

- **Error messages** (all prefixed `[web]`): `env: "<key>" is marked public but does not start with
  "<prefix>".`, `env: "<key>" starts with "<prefix>" but is not marked public:true.`, `env: required
  variable "<key>" is not defined by any provider or default.` (`onInit`), `env: required variable "<key>"
  is not defined.` (`require()`).
- **Lifecycle:** `createState` → `api` → `onInit`. No `onStart` / `onStop`. `load()` is called **once per
  provider** at `onInit`; nothing is re-read later.
- ⚠️ **Gotchas:** `ctx.env.require("X")` (variable accessor) is unrelated to the kernel's
  `ctx.require(plugin)` (plugin resolver). `getPublicMap()` is the only sanctioned input to a browser
  `define`; `resolved` may hold unvetted provider keys and must not be inlined. `KEY=` in a `.env` file
  yields `""`, which falls through to the next provider.

## 4. Env providers (5)

| Provider | `name` | Runtime | Source of values | Module | `node:*` |
|----------|--------|---------|------------------|--------|----------|
| `dotenv(path = ".env.local")` | `dotenv:<path>` | Node, Bun | The file at `path`, re-read on every `load()`; `{}` when missing | `providers.ts` | `node:fs` |
| `processEnv()` | `process-env` | Node, Bun | Shallow copy of `process.env`; dereferences `process` unconditionally | `providers.ts` | shares the `node:fs` module |
| `cloudflareBindings()` | `cloudflare` | Node build scripts, a Worker with `nodejs_compat` | `globalThis.__CLOUDFLARE_ENV__ ?? {}`, read fresh, never cached | `providers.ts` | shares the `node:fs` module |
| `workerSafeProcessEnv()` | `worker-process-env` | Cloudflare Workers, Bun, Node | `typeof process === "undefined" ? {} : { ...process.env }` | `providers.worker.ts` | none |
| `browserEnv({ globalKey = "__ENV__" }?)` | `browser-env` | browser | `{ ...import.meta.env, ...globalThis[globalKey] }`, the global wins; each absent source is `{}`; never throws | `providers.browser.ts` | none |

- **Precedence** is array order inside `pluginConfigs.env.providers`. `[dotenv(), processEnv()]`: the file
  wins. `[processEnv(), dotenv()]`: the process wins (CI overrides). Inside one provider there is no
  precedence; it returns one record.
- **`dotenv` parser:** CRLF / LF, blank lines and full-line `#` comments skipped, split at the first `=`,
  key and value trimmed, one outer pair of `"` or `'` stripped. Trailing inline comments on unquoted values
  are **kept** (`KEY=v # c` → `"v # c"`). No variable expansion.
- **`cloudflareBindings`** reads a global the request handler must set. Because `load()` runs once at
  `onInit`, the provider sees the bindings that are on `globalThis` **when the app is created**, not per
  request, unless the app is created per request.
- **`workerSafeProcessEnv`** is the provider the `worker` and `native` frameworks seed. Under workerd
  without `nodejs_compat` it yields `{}` and the app still boots.
- **Custom provider:** any `{ name, load }` object. `name` appears only in diagnostics.

## 5. The `./cli` kit (Node only)

Plain functions, no plugin. Reads `process.stdout.isTTY`, `process.env.NO_COLOR`, `process.env.COLORTERM`;
prompts use `node:readline`. Color and Unicode glyphs appear only on a TTY with `NO_COLOR` unset; otherwise
plain ASCII.

### 5.1 Primitives (`ansi.ts`)

| Export | Signature | Purpose |
|--------|-----------|---------|
| `ANSI` | `{ reset, bold, dim, red, green, yellow, blue, magenta, cyan, gray }` | SGR escape strings |
| `BRAND_PINK` | `{ r: 255, g: 30, b: 111 }` | The brand pink `#FF1E6F` |
| `fg24(r, g, b)` | `→ string` | 24-bit foreground escape |
| `CLEAR_LINE`, `CLEAR_BELOW` | `string` | Erase the line / erase below the cursor |
| `cursorUp(n)` | `→ string` | Cursor up `n` lines; `""` for `n <= 0` |
| `SPINNER_FRAMES` | `readonly string[]` (10 braille glyphs) | Spinner frames |
| `spinnerFrameAt(elapsedMs, frameMs = 80)` | `→ string` | Frame for a wall-clock elapsed time, not a tick counter |
| `boxGlyphs(color)` | `→ BoxGlyphs` | Rounded Unicode glyphs when `true`, ASCII `+ - \|` when `false` |
| `box(lines, color, minInnerWidth = 0)` | `→ string[]` | Frames lines; pads to the widest visible line. Returns lines, writes nothing |
| `visibleWidth(text)` | `→ number` | Length without ANSI sequences |
| `supportsColor(stream = process.stdout, noColor = process.env.NO_COLOR)` | `→ boolean` | `stream.isTTY === true && noColor === undefined` |
| `supportsTruecolor(colorTerm = process.env.COLORTERM)` | `→ boolean` | `"truecolor"` or `"24bit"` |
| `makePalette(color, truecolor = false)` | `→ Palette` | `enabled`, `paint(code, text)`, `bold`, `dim`, `green`, `yellow`, `red`, `cyan`, `pink`. Every helper is identity when `color` is `false`; `pink` is exact `#FF1E6F` only with `truecolor`, else `magenta` |

### 5.2 `createBrandConsole(options?) → BrandConsole` (`console.ts`)

`BrandConsoleOptions`: `write` (default `console.log`), `writeError` (default `console.error`), `color`
(default `supportsColor()`), `truecolor` (default `color && supportsTruecolor()`), `width` (default `66`).

| Member | Signature | Renders |
|--------|-----------|---------|
| `palette`, `color`, `width` | properties | The bound `Palette`, the color flag, the rail width |
| `line(text = "")` | `→ void` | The text verbatim through `write` |
| `lockup({ wordmark, label?, version?, facts? })` | `→ void` | ` ▟▙ <wordmark>  <label>` with `version` right-aligned, a dim rule of `width - 1`, an optional dim facts line. `*` and `-` off a TTY |
| `heading(text)` | `→ void` | A blank line, then `  <bold pink text>` |
| `info(message)` | `→ void` | `  › <first line>`; continuation lines indented 4 |
| `warn(message)` | `→ void` | `  ⚠ <message>` through `writeError` |
| `error(message, cause?)` | `→ void` | `  ✗ <message>` through `writeError`, then `String(cause)` when given |
| `check(ok, label, detail?)` | `→ void` | `  ✓` or `  ✗` + label; `detail` lines dim, indented 6 |
| `railLine(left, right, width?)` | `→ string` | `left` + padding + `right` to the visible width; gap at least 1 |
| `box(lines, minInnerWidth = 0)` | `→ void` | `ansi.box(...)` written line by line |

### 5.3 `createBrandPrompts(options?) → BrandPrompts` (`prompts.ts`)

`BrandPromptsOptions`: `color`, `truecolor`, `width` (default `66`), `input` (default `process.stdin`),
`output` (default `process.stdout`), `write` (choices-block sink, default `console.log`).

| Method | Signature | Behaviour |
|--------|-----------|-----------|
| `confirm(question)` | `→ Promise<boolean>` | `true` only for `y` / `yes` (case-insensitive, trimmed). Styled `◆ question … y / N ›`; plain `question [y/N] ` |
| `select(question, choices)` | `→ Promise<number>` | Prints choices numbered from 1, resolves the **zero-based** index. Empty or out-of-range → `0`. Plain form `question [1-N] ` |

Each call opens and closes its own `readline` interface.

### 5.4 `brandedSink(minLevel = "debug") → LogSink` (`log-sink.ts`)

Creates one `createBrandConsole()` with default options and renders each entry as `<event> <dim JSON data>`:
`error` → `ui.error` (stderr), `warn` → `ui.warn` (stderr), `info` → `ui.info`, `debug` → dim `ui.line`.
Entries below `minLevel` are dropped. Non-serializable `data` falls back to `String(data)`. Depends on the
log plugin by type only, so the log plugin and the browser entry never import rendering code.

## 6. Exported types

| Where | Types |
|-------|-------|
| `.` and `./browser`, namespace `Log` | `LogConfig`, `LogLevel`, `LogEntry`, `LogSink`, `ExpectChain`, `LogState`, `LogApi` |
| `.` and `./browser`, namespace `Env` | `EnvProvider`, `EnvVarSpec`, `EnvConfig`, `EnvState`, `EnvApi` |
| `.` and `./browser`, flat | the same twelve names, for consumer declaration emit |
| `./cli` | `AnsiCode`, `BoxGlyphs`, `ColorStream`, `Palette`, `BrandConsole`, `BrandConsoleOptions`, `LockupOptions`, `BrandPrompts`, `BrandPromptsOptions` |

Not exported anywhere: `LogExpectAssertionError`, `consoleSink`, `installDefaultSinks`, `createLogApi`,
`createLogState`, `createExpectChain`, `matchesPartial`, `createEnvApi`, `createEnvState`, `validateSchema`,
`freezeMap`. `LogState` and `EnvState` are boundary types; consumers use `LogApi` / `EnvApi`.

## 7. Dependency and data flow

```
@moku-labs/core@1.7.0 ── createCorePlugin ──┬─→ logPlugin  ("log")  ─┐
                                            └─→ envPlugin  ("env")  ─┤
                                                                     │  a Layer-2 framework's createCoreConfig
providers (one per runtime) ─── pluginConfigs.env.providers ─────────┤  plugins: [logPlugin, envPlugin]
  dotenv · processEnv · cloudflareBindings   (Node, node:fs)         │
  workerSafeProcessEnv                       (Worker, no node:*)     │
  browserEnv                                 (browser, no node:*)    ▼
                                                        every regular plugin ctx: ctx.log, ctx.env
                                                        the app: app.log, app.env
                                                                     │
ctx.log.info(event, data) → state.entries.push ──→ sinks[] in order: consoleSink (dev / production)
                                    │                                 brandedSink (./cli, opt-in via clearSinks + addSink)
                                    └──→ trace() snapshot · expect() live chain

envPlugin.onInit: providers[].load() → merge (first non-empty wins) → PUBLIC_ cross-check → defaults
                  → required → resolved (all keys) + publicMap (public schema keys) → freezeMap ×2
```

Consumers of this package in the family: `@moku-labs/web`, `@moku-labs/worker`, `@moku-labs/room`,
`@moku-labs/native`, `@moku-labs/system`, each bundling an exact pin. A Layer-3 app on any of them gets
`ctx.log` / `ctx.env` without depending on `@moku-labs/common` itself.
