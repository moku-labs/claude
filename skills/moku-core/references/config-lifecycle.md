# Config & Lifecycle Reference

## Config System

### Two Levels of Config

1. **Global Config** — from `createCoreConfig<Config, Events>(id, { config })`. Consumer overrides via `createApp({ config: { ... } })`.
2. **Per-Plugin Config** — from `config` on plugin spec. Consumer overrides via `createApp({ pluginConfigs: { name: { ... } } })`.

### The Config Rule

| Plugin Config Type C | `config` field | Consumer must provide |
|---------------------|----------------|----------------------|
| `void` / `{}` | (ignored) | Nothing |
| `{ field: string }` | absent | **Required** — full C |
| `{ field: string }` | present | **Optional** — can omit or partially override |

**Single rule:** Config key is optional in `createApp` if and only if `config` is provided.

### Config Resolution — Shallow Merge Only

**Never deep merge.**

Per-plugin: `{ ...spec.config, ...frameworkOverrides, ...consumerOverrides }`
Global: `{ ...coreConfig.config, ...consumerOverrides }`

If `config` has `{ database: { host: 'localhost', port: 5432 } }` and consumer provides `{ database: { host: 'prod' } }`, the result is `{ database: { host: 'prod' } }`. The `port` field is **gone**. This is intentional.

### Config Completeness

`config` must provide a complete C value — all fields, even optional ones with `?`. Ensures no `undefined` surprises when consumer omits config entirely.

### Config Immutability

All resolved configs are `Object.freeze`'d. Global config and per-plugin configs are frozen and read-only at runtime.

---

## Lifecycle

### Three Phases

| Phase | Method | Direction | When | Context |
|-------|--------|-----------|------|---------|
| init | `onInit` | Forward | During `createApp()` | PluginContext |
| start | `onStart` | Forward | `await app.start()` | PluginContext |
| stop | `onStop` | **REVERSE** | `await app.stop()` | TeardownContext |

### The init Phase (during createApp)

Internal sub-steps (one phase, internal mechanics):
1. Merge plugin lists: `[...frameworkDefaults, ...consumerExtras]`
2. Validate reserved names
3. Validate no duplicate names
4. Validate dependencies (exist + appear before dependent)
5. Resolve global config (shallow merge, freeze)
6. Resolve per-plugin config (3-level merge, freeze each)
7. Create state (forward order, `createState({ global, config })`)
8. Register hooks (forward order, `hooks(PluginContext)`)
9. Build API (forward order, `api(PluginContext)`)
10. Run `onInit` (forward order, synchronous)
11. Call framework `onReady` (from `createCore`)
12. Call consumer `onReady` (from `createApp`)

After init: `createApp` returns the App object.

### Execution Model

- `createApp(options)` → `App` (synchronous)
- `app.start()` → `Promise<void>`
- `app.stop()` → `Promise<void>`

**Sequential execution:** Plugins run one at a time, awaited. No parallelism.

### Error Handling

- If `onInit` throws → `createApp` throws
- If `onStart` throws → `app.start()` rejects. No rollback.
- If `onStop` throws → `app.stop()` rejects. Propagates immediately.
- No catch-and-silence. No retry logic. Consumer decides.

### State Guards

- `start()` callable once. Second call throws: `"App already started."`
- `stop()` requires `start()` first. Otherwise: `"App not started."`
