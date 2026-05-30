# Skeleton & Plugin Authoring Conventions (hook-compliant by construction)

**Why this file exists.** moku generates spec/skeleton code, but that code used to violate moku's OWN
hooks + ESLint config — so every build the agent re-discovered the rules and reworked every file
(16× `INDEX-RULE` and repeated `ANTIPATTERN`/`STRUCTURE` hits in one real build). These rules are now
**permanent** and must be honored when WRITING spec/skeleton/plugin code, so the output is correct on
the first try instead of being shrunk/fixed in review.

The spec/skeleton generator (`/moku:plan` Stage 3) and every build sub-agent MUST emit code that
already satisfies these. Read this BEFORE writing any plugin source.

## 1. `index.ts` — wiring only, ≤30 effective lines

The plugin `index.ts` connects domain code to the system. It is NOT where logic lives. Effective
lines (excluding the JSDoc header, blank lines, and `import` lines) must be ≤30. Start from this
literal template and fill the blanks — do not author freehand and shrink afterward:

```typescript
/**
 * <Tier> tier — <one-line purpose>.
 *
 * @see README.md
 */
import { createPlugin } from "../../config";
import { createXxxState } from "./state";
import { createXxxApi } from "./api";
import { handleXxxEvent } from "./handlers"; // only if hooks exist

export const xxxPlugin = createPlugin("xxx", {
  config: defaultConfig,            // typed const from ./config or inline typed
  createState: createXxxState,      // factory by direct reference
  api: createXxxApi,                // factory by direct reference (house style)
  events: (register) => ({ "xxx:done": register<{ id: string }>("…") }), // if events
  // hooks / onStart / onStop only if the spec requires them
});
```

- Extract `onInit`/`api`/`events`/default-config to sibling files; the index just wires them.
- Type the event-register callback param as `(register: RegisterFunction) => ({ … })` when extracted.

## 2. Config / types

- **No inline `as`** in `config`/`createState`. Use a typed const: `const defaultConfig: Config = { … }`
  (or a return-type annotation on the factory). No `null as X`, `{} as X`, `[] as X`.
- **`Config` and `Api` are `type` aliases, NOT `interface`** — they must satisfy `Record<string, unknown>`,
  which `interface` does not.
- **`createCoreConfig<Config, Events, [typeof p1, …]>`** — once you give ANY explicit type arg, the
  **third `CorePlugins` tuple arg is required** (TS will not infer a defaulted type parameter).

## 3. Injectable / exported function types are STRUCTURAL

Never type an injectable or exported function via a runtime package's **namespace** type
(e.g. `import("bun").SpawnOptions.OptionsObject<…>`). `tsdown`/rolldown `.d.ts` bundling drops it and
the shipped type resolves to `undefined` even though `tsc --noEmit` passes. Declare your own
`interface`/`type` for the options and return value. Verify with `bun run build` + the emitted `.d.ts`
(see `build-verification.md` Step 4b2), not just `tsc`.

## 4. No wire-factory indirection, no explicit generics

- No `function wireXPlugin(factory, dep) { … }`. Import `createPlugin` and dependencies directly.
- No explicit generics on `createPlugin`/`createCorePlugin` — types infer from the spec object.

## 5. JSDoc (matches `jsdoc/*` + the project ESLint config)

- Multi-line only (never single-line `/** … */`). `@example` on every exported function.
- **Omit `@returns` on throw-only stubs**; require it on value-returning functions. Use typed
  `@throws {Error}`. `@param` names must match exactly (including `_unused` and destructured sub-props).
- `jsdoc/tag-lines`: exactly 1 blank line between the description and the first tag, 0 between tags.
  Keep `@file` and `@see` adjacent.

## 6. SonarJS / unicorn

- No bare `void X;` statements; don't consume a throw-only return value.
- No string literal repeated 3+ times in `src` — hoist to a const.
- Abbreviations: the project ESLint ships a pre-expanded `unicorn/prevent-abbreviations` allowList
  (see `glossary.md` and the `eslint.config.ts` scaffolded by `/moku:init`). Use canonical short names
  (`ctx`, `api`, `env`, `cfg`, …) freely; do not invent new abbreviations outside the allowList.

## 7. Lifecycle

`onStart`/`onStop` ONLY when the plugin manages a real resource (server/listener/connection/handle).
If a plugin legitimately manages browser/DOM listeners or similar, keep them AND add a one-line
justification comment so the antipattern hook stays quiet, e.g.:
`// @no-resource-check — onStop tears down nav/DOM listeners (spec/08 §4)`.

## 8. Naming & structure

- Export `<name>Plugin` (suffix); the name string stays bare (`createPlugin("router", …)`). Islands
  use a domain suffix (`lightboxIsland`). See `spec/15-PLUGIN-STRUCTURE.md §7`.
- **Tier ≠ directory shape.** A flat multi-file layout (one concern per file, no subdirs) is a valid
  Complex/VeryComplex layout — the ≤30-line index rule often forces flat. Having a `generators/`-style
  subdir does NOT force a tier relabel. Pick tier by domain complexity, not by folder nesting.

## Skeleton "revisit" TODOs are tracked, not lost

If skeleton generation leaves a "revisit during build" note (e.g. a `.d.ts`/type concern), the
generator MUST record it in STATE.md under a `## Skeleton Revisit TODOs` section (not only in
`skeleton-report.md`, which nobody re-reads). The build waves clear these before marking the
framework complete.
