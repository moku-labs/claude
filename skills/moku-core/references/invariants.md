# Invariants & Anti-Patterns Reference

## Invariants (Always True — Breaking Any Is a Bug)

### Reserved Names
`start`, `stop`, `emit`, `require`, `has`, `config`, `__proto__`, `constructor`, `prototype` — plugin names using these throw TypeError.

### Name Uniqueness
Duplicate plugin names throw during init. No silent overwrite. No merge. No "last wins."

### Dependency Validation
If `depends: [loggerPlugin]` is declared:
- `logger` must exist in the plugin list
- `logger` must appear BEFORE the dependent plugin
- Validation only — does NOT change order

### Config Completeness
TypeScript rejects `createApp` without required configs. Compile-time only.

### Lifecycle Order
Forward for init/start. Reverse for stop. Always array order. No auto-reordering.

### Hook Execution Order
Plugin registration order, sequential, each awaited.

### Immutability
After `createApp`: `app`, global config, and per-plugin configs are all `Object.freeze`'d. Only `ctx.state` is mutable.

### Lifecycle Guards
- `start()` once only. Second call throws.
- `stop()` requires `start()` first.

### require() Contract
Instance-only. Returns typed API or throws with context-specific error messages.

### Default Plugin Immutability
Consumer cannot remove framework defaults. Final list: `[...frameworkDefaults, ...consumerExtras]`.

### Phase-Appropriate Context
`createState` → only `{ global, config }`. `onStop` → only `{ global }`.

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
No services, providers, managers. The primitives are: `createCoreConfig`, `createCore`, `createApp`, `createPlugin`. Need something else? Build a plugin.
