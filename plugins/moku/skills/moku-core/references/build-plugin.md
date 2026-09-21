# Plugin Build — Detailed Steps

## Correct-first-try checklist

Author against this list from line 1 rather than writing freehand and fixing it in review. It pairs
with `skeleton-conventions.md` (hook-compliant authoring) and `house-style.md` (approved patterns).

1. `index.ts` is wiring only, ≤30 effective lines (JSDoc header, imports and blank lines do not count).
2. No explicit generics on `createPlugin`/`createCorePlugin` — types infer from the spec object.
3. `api: createApi` — pass the factory by direct reference, not `(ctx) => createApi(ctx)`.
4. Events via one `register<T>("desc")` per event; `register.map` is optional.
5. The export is `<name>Plugin`; the plugin name string stays bare (`"router"`, not `"routerPlugin"`).
6. `onStart`/`onStop` only for a real resource (listener, server, handle). `onStop` receives only
   `{ global }` — capture references in a closure during `onStart`. Keeping DOM or nav listeners is
   fine; add `// @no-resource-check — <why>` so the hook stays quiet.
7. `import type` for every type-only import. Multi-line JSDoc with `@param`/`@returns` on every
   export. `@example` only where `jsdoc-examples.md` asks for it: a scenario on every member of the
   public `Api` type in `types.ts`, one literal line on a private pure function, none on a function
   that takes `ctx`/state, never an echo of the signature. API method docs go on the `Api` type
   member, never on the implementation in `api.ts` — only the type ships in the `.d.mts`. No
   `@returns` on throw-only stubs; `jsdoc/tag-lines` wants 1 blank line after the description and 0
   between tags.
8. No inline type assertions (`x as T`, `{} as T`, `null as T`) in `createState`/`config` — use typed consts.
9. Injectable and exported function types are structural (your own `interface`/`type`), never a runtime
   package's namespace type (`import("bun").SpawnOptions.X`) — that breaks the bundled `.d.ts` even
   though `tsc` passes.
10. Error format exactly: `[<framework>] <description>.\n  <actionable suggestion>.` — no arrows, both
    lines end with a period.
11. Web and UI: state and styling via `data-*` attributes, never CSS classes, including inside JSDoc
    `@example` blocks.
12. A builder API that exposes an override (`.toFile()`, `.toJson()`) must be honoured by the
    compiler/runtime: `override?.(x) ?? default(x)`.
13. A `depends` edge corresponds to a real `ctx.require(dep).method()` call, or is documented inline as
    presence/ordering-only. No silent dead deps.
14. Framework-internal `__tests__` may import `createCoreConfig` from `@moku-labs/core` — that is the
    bootstrap every plugin uses, not a 3-layer violation.
15. `Config` and `Api` are `type` aliases, never `interface`. `createCoreConfig<Config, Events, [typeof p1, …]>`
    requires the third tuple argument once any explicit type argument is given.
16. The verification chain is `bunx tsc --noEmit`, `bun run lint`, `bun run test` and `bun run build` —
    the build step catches bundling bugs `tsc` misses.
17. Do not guess paths: `ls` or glob before `Read`, never `Read` a directory, and take the exact spec
    path from the STATE.md plugin table — spec numbers are not guessable.

### Filesystem safety for parallel builders

- Touch only files inside your own plugin directory. Leave shared barrels, `src/config.ts` and sibling
  plugins alone.
- Run no `lint:fix`, no repo-wide `format`, and no git mutation (checkout, restore, reset, stash, clean,
  add, commit). A stray `git checkout` reverted a sibling plugin to stubs in a real build.
- Scoped formatting only: `bunx biome format --write src/plugins/<name>/`. Report the rest as hints; the
  orchestrator fixes repo-wide after the wave.

## Step 1: Understand the plugin

From a spec (file path or `#N`): read it and extract config, state, API, events and dependencies.
From several specs (`#N-#M`, `#N,#M,#P`): read them all and order them by dependency, using wave
analysis where they can run in parallel. From a description: ask what the plugin is for, pick a tier,
and design the spec. From a hierarchy ("auth + session + permissions"): identify every plugin and order
them by dependency.

## Step 2: Determine the complexity tier

Using the **moku-plugin** skill, weigh how many spec fields are needed, how much domain logic sits
behind each, and whether there are sub-domains. Pick Nano, Micro, Standard, Complex or VeryComplex.

**Domain merge check, before creating anything.** Scan the existing plugins for overlap: does the new
plugin share a domain prefix (`spaHead` + `spaRouter` → one `spa`)? Would its events coordinate with an
existing plugin's? Would consumers configure the two together? On overlap, add a sub-module to the
existing plugin instead (promoting it to VeryComplex if needed). Creating 2+ related plugins at once
with no suitable home means one VeryComplex plugin with sub-modules from the start.

Decide lifecycle needs at the same time: `onStart` only for connections, servers, listeners or mounted
UI; `onStop` only for closing, flushing or unmounting. Neither needed means neither is written.

## Step 3: Create the directory structure

Follow the tier layout from the moku-plugin skill.

**Nano/Micro:** `index.ts`, `README.md`, `__tests__/unit/index.test.ts`

**Standard:** `index.ts`, `types.ts`, `state.ts`, `api.ts`, `handlers.ts`, `README.md`,
`__tests__/unit/*.test.ts`, `__tests__/integration/[name].test.ts`

**Complex:** the Standard set plus one `[subdomain]/` directory with its own `types.ts` and files.

**VeryComplex:** `index.ts` (~40 lines, the wiring harness), `types.ts` (shared config, state, events,
context type), one directory per module each with `types.ts`, `state.ts`, `api.ts`, plus `README.md` and
the same test layout.

## Step 4: Implement the domain files (Standard+)

1. **types.ts** — Config with documented defaults, State, the API type (the api factory's return type),
   and Events where they exist, using the `PluginCtx` utility from `@moku-labs/core`.
2. **state.ts** — the `createState` factory: receives `{ global, config }` only, returns the state
   object, full JSDoc.
3. **api.ts** — the API factory: receives the plugin context, returns the public API, JSDoc per method,
   methods close over state and never leak it.
4. **handlers.ts** — event handler factories that receive context and return handlers, JSDoc on each.

## Step 5: Implement index.ts

The wiring file, around 30 lines: a JSDoc header with tier, description, events and `@see README.md`,
the domain imports, and `createPlugin(name, spec)` with every field wired. The call carries no explicit
type parameters — everything infers from the spec fields. Wanting to write `createPlugin<...>` means the
types belong in `types.ts` instead.

## Step 6: Write tests

Plugin tests live inside the plugin directory, in `__tests__/unit/` and `__tests__/integration/`. The
root `tests/` directory is for framework-level tests.

**Unit tests**, per domain file: state creation across configs, API methods against a mocked context,
handler logic on its own. `vi.fn()` for emit, require and has.

**Integration test** (`__tests__/integration/[name].test.ts`): a minimal framework with the plugin
registered — lifecycle (init, start, stop), the API through the app object, event emission and hooks.

## Step 7: Write README.md

A standalone plugin build (`/moku:build plugin auth`) gets a full README: purpose, config options, API
reference, events, dependencies, examples. Inside a framework wave, write a placeholder only (name,
tier, one line) — the real READMEs are written in the dedicated wave (`build-final.md` Step 5.5) with
fresh context.

## Step 8: Validate

1. Artifact check — `moku-verify-artifacts <plugin> --tier <tier> --run --json` (exit 0 pass, 2 fail):
   files exist, content is substantive, the plugin is wired with lint and tests passing.
2. In parallel: `moku-structure-validator` (structure and tier compliance) and `moku-style-validator`
   (JSDoc and readable-code style).
3. Then `moku-quality-validator` (types, tests and lint as facts, then test quality).
4. Confirm no plugin tests sit in `tests/unit/plugins/` or `tests/integration/plugins/`.

Findings from the Sonnet validators pass through `moku-skeptic` before they count. Blockers enter gap
closure, at most 2 rounds.

### Step 8.5: Tick the spec checkboxes

If the spec has a `## Verification` section, evaluate each checkbox against the built plugin, tick what
passes (`- [ ]` → `- [x]`), note why the rest failed, and route real failures to gap closure.

## Large plugins

For Complex and VeryComplex:

1. Build the root structure first: `index.ts` and `types.ts` with the shared config, state, events and
   context type.
2. Build sub-modules one at a time, each with its own `types.ts`, `state.ts`, `api.ts`.
3. Wire each into the root `index.ts` as you go — namespaced API, composed state.
4. On resume, detect the existing files and continue from there.

For VeryComplex specifically: the root `types.ts` declares the shared config type (nested per
sub-module), the composed state type, the events type and the context alias
(`PluginCtx<Config, State, Events>`); each sub-module factory takes that shared context type
(`createXxxApi(ctx: PluginCtx)`); the root `index.ts` uses `register.map<Events>()` for bulk event
registration and composes the sub-module state factories.

## Design-context screens

If a Layer-3 plugin implements a screen or component from a design context, re-implement it from
scratch per the moku-web and moku conventions. Never copy or port the demo prototype's source or its
bugs, and pass that instruction into the builder's prompt.
