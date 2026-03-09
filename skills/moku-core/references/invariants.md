# Invariants & Anti-Patterns Reference

## Invariants (Always True — Breaking Any Is a Bug)

### Reserved Names
`start`, `stop`, `emit`, `require`, `has`, `config`, `global`, `state`, `__proto__`, `constructor`, `prototype` — plugin names using these throw TypeError. Core plugins have the same reserved names.

### Name Uniqueness
Duplicate plugin names throw during init. No silent overwrite. No merge. No "last wins." Core plugin names are cross-checked against regular plugin names — no collisions allowed.

### Dependency Validation
If `depends: [logger]` is declared:
- `logger` must exist in the plugin list
- `logger` must appear BEFORE the dependent plugin
- Validation only — does NOT change order

### Config Completeness
TypeScript rejects `createApp` without required configs. Compile-time only.

### Lifecycle Order
Forward for init/start. Reverse for stop. Always array order. No auto-reordering. Core plugins init/start BEFORE regular plugins. Regular plugins stop BEFORE core plugins.

### Hook Execution Order
Plugin registration order, sequential, each awaited.

### Immutability
After `createApp`: `app`, global config, and per-plugin configs are all `Object.freeze`'d. Only `ctx.state` is mutable.

### Supported Lifecycle Usage
- Primary contract: `createApp()` → optional `start()` → optional `stop()`.
- Repeated calls, concurrent calls, and recovery attempts after lifecycle failure are outside the primary guarantee.

### require() Contract
Instance-only. Returns typed API or throws with context-specific error messages.

### Default Plugin Immutability
Consumer cannot remove framework defaults. Final list: `[...frameworkDefaults, ...consumerExtras]`.

### Phase-Appropriate Context
`createState` → only `{ global, config }`. `onStop` → only `{ global }`. Core plugins → only `{ config, state }` (no global, emit, require, has).

### Core Plugin Self-Containment
Core plugins must NOT have `depends`, `events`, or `hooks` — throws TypeError if present. They are pure infrastructure with no inter-plugin communication.

### Sequential Execution
All async lifecycle methods execute one plugin at a time. No parallelism.

### Error Propagation
No catch-and-silence. No retry. Consumer decides.

---

## Error Message Format

```
Error: [framework-name] <description>.
  <actionable suggestion>.
```

Validation errors → `TypeError`. Lifecycle errors → `Error`.

Examples:
```
TypeError: [moku-site] Plugin name "start" conflicts with a reserved app method.
  Choose a different plugin name.

TypeError: [moku-site] Duplicate plugin name: "router".
  Each plugin must have a unique name.

TypeError: [moku-site] Plugin "router" depends on "auth", but "auth" is not registered.
  Add "auth" to your plugin list before "router".

Error: [moku-site] App already started.
  start() can only be called once.
```

---

## Anti-Patterns — NEVER DO These

### Business logic in plugin files
Plugin `index.ts` must be ~30 lines of wiring. Logic in `./api.ts`, `./state.ts`, `./handlers.ts`.

### Consumer importing from @moku-labs/core
Consumer only imports from the framework package. Never Layer 1.

### Bypassing createApp options typing
No `as any`. Let TypeScript enforce the structured options.

### Leaking state
Never return `ctx.state` directly. Return closures over state.

### God plugin
One plugin = one domain concern. Split large plugins.

### Deep config nesting
Shallow merge replaces nested objects wholesale. Prefer flat config or document clearly.

### emit for request/response
Events are notifications. Use `ctx.require(plugin)` for request/response.

### Inventing new primitives
No services, providers, managers. The primitives are: `createCoreConfig`, `createCore`, `createApp`, `createPlugin`, `createCorePlugin`. Need something else? Build a plugin.

### Making a regular plugin core when it needs events or depends
If a plugin needs `events`, `hooks`, or `depends`, it MUST be a regular plugin — not core. Core plugins are for self-contained infrastructure only.

### Wire factory pattern
Don't wrap `createPlugin` in a factory function that parameterizes the plugin constructor and dependencies. This adds indirection and defeats static analysis. Import `createPlugin` and dependencies directly.

### Inline type assertions in state/config
Don't use `null as import("foo").Bar | null` or `{} as Record<string, X>` in `createState` or `config`. For Standard+ plugins, define a proper type and use a typed factory function. For Nano/Micro, use a return-type annotation on the arrow function.
