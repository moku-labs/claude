# Architecture Reference

## The Three Layers

```
+------------------------------------------------------------------+
|                    Layer 3: Consumer Product                       |
|  import { createApp, createPlugin } from 'my-framework';          |
|  Consumers configure, compose, and ship.                          |
|  Cannot change the core. Cannot bypass plugins.                   |
+------------------------------------------------------------------+
|                    Layer 2: Framework / Tool                       |
|  Step 1 (config.ts): createCoreConfig<Config, Events>             |
|  Step 2 (index.ts): createCore + exports createApp                |
|  Defines: Config shape, Events contract, Default plugins          |
+------------------------------------------------------------------+
|                    Layer 1: @moku-labs/core                        |
|  export { createCoreConfig }                                      |
|  One function. Zero domain knowledge. Pure machinery.             |
+------------------------------------------------------------------+
```

Each layer constrains the layer above. When an LLM generates Layer 3 code, it CANNOT break Layers 1 or 2.

## 3-Step Factory Chain (Solves Circular Dependency)

**The problem:** Plugin files need `createPlugin` bound to framework types. But `createPlugin` is a product of framework setup. If both live in one file → circular import.

**The solution:**

```
config.ts ----exports----> createPlugin, createCore
    |                           |
    v                           v
plugins/*.ts <--imports-- createPlugin     index.ts <--imports-- plugins + createCore
                                                |
                                                v
                                           exports createApp
```

1. **config.ts** calls `createCoreConfig`, exports `createPlugin` and `createCore`
2. **Plugin files** import `createPlugin` from config.ts (no circular dependency)
3. **index.ts** imports plugins and calls `createCore`, exports `createApp`

## Design Philosophy

### Brutal Simplicity
No classes. No decorators. No DI containers. No service locators. `createCoreConfig`, `createCore`, and `createPlugin` are pure factories. `createApp()` performs synchronous init. `app.start()` / `app.stop()` are optional runtime lifecycle methods.

### Functional Style
- No class hierarchies. Plugins are plain objects with optional function fields.
- No inheritance. Composition only via `ctx.require()`.
- No mutation of framework state. The `app` object is frozen.
- Factory functions over constructors.

### Type-Driven Design
Runtime < 200 lines. The type system does the heavy lifting:
- Plugin names become literal string types
- Config types enforced at `createApp()`
- Plugin API types merged into the `App` type
- Types serve as documentation, autocomplete, and compile-time validation

### Order is Explicit
Plugin order in the array determines init order, hook execution order, and teardown order (reverse). No magic. No topological sort. No `@before`/`@after` annotations.

## The Universal Structural Pattern

Every application is a kernel plus plugins:
- Website = kernel + plugins (router, auth, i18n, analytics)
- CLI = kernel + plugins (commands, env loader, config manager)
- Game = kernel + plugins (ECS, physics, input, audio)
- Build system = kernel + plugins (compiler, bundler, minifier)

The ONLY thing that changes is the content of plugins. The framework is domain-agnostic.

## What the Framework Author Decides (Layer 2)

1. **Config** — global config shape + defaults
2. **Events** — event contract (names + payload types)
3. **Default plugins** — what ships built-in (consumers cannot remove these)
4. **Plugin configs** — default overrides for built-in plugins

## Consumer Mental Model (Layer 3)

1. Import `createApp` (and optionally `createPlugin`) from the framework
2. Create custom plugins if needed
3. Call `createApp` with one flat object
4. TypeScript tells you what's required/optional
5. Use `app.pluginName.method()` — everything is typed
