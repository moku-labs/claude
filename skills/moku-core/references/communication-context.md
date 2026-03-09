# Communication & Context Reference

## Two Communication Channels

### Channel 1: Lifecycle Callbacks
`onInit`, `onStart`, `onStop` — structured, predictable communication points called by the kernel in defined order.

### Channel 2: Events — emit(name, payload)
Single `emit` method. Strictly typed. Only known event names accepted. No untyped escape hatch.

## emit — Strictly Typed

```typescript
emit: <K extends string & keyof AllEvents>(name: K, payload: AllEvents[K]) => void;
```

Where `AllEvents` = Global Events + Own PluginEvents + Dependency Events.

```typescript
ctx.emit('page:render', { path: '/about', html: '<h1>About</h1>' });  // OK
ctx.emit('unknown:event', { anything: true });                         // COMPILE ERROR
```

**Hook error resilience:** `emit` is fire-and-forget. If a hook throws, error goes to `onError` handlers (framework + consumer). One failing hook does not prevent other hooks from running.

**No barrier semantics:** lifecycle completion does not imply completion of async hook work triggered by `emit()`. `createApp()` and `app.start()` may finish before those hook promises settle.

## Hooks

```typescript
hooks: (ctx: PluginContext) => ({
  'page:render': (payload) => { /* payload typed */ },
  'auth:login': (payload) => {
    ctx.state.lastLogin = payload.userId;  // Full context via closure
    ctx.emit('page:render', { path: '/dashboard', html: '...' });
  },
})
```

- Receives PluginContext via closure — handlers can access `ctx.state`, `ctx.emit`, `ctx.require`
- Payloads fully typed from merged event map
- Execution order: plugin registration order, sequential, each awaited

## Context Tiers

### CorePluginContext (core plugin api, onInit, onStart, onStop)
```typescript
{ readonly config: Readonly<C>; state: S }
```
Self-contained. No global, emit, require, has. Core plugins cannot communicate with other plugins — they are pure infrastructure.

### MinimalContext (createState)
```typescript
{ global: Readonly<Config>; config: Readonly<C> }
```
State not yet created. Other plugins may not exist. Only configuration available.

### PluginContext (api, hooks, onInit, onStart)
```typescript
{
  global: Readonly<Config>;   // Global config, frozen
  config: Readonly<C>;        // Plugin config, frozen
  state: S;                   // Mutable plugin state
  emit: EmitFunction<E>;      // Strictly typed event dispatch
  require: RequireFunction;   // Get plugin API or throw
  has: (name: string) => boolean;  // Check plugin exists
  // + core plugin APIs: ctx.<coreName>.<method>() — fully typed
}
```
Core plugin APIs (e.g., `ctx.log`, `ctx.env`) are available on PluginContext when core plugins are registered.

### TeardownContext (onStop)
```typescript
{ global: Readonly<Config> }
```
Other plugins may already be stopped. Minimal context prevents unreliable inter-plugin access.

## require and has

### `ctx.require(pluginInstance)` — Instance-Only, Fully Typed
```typescript
const routerApi = ctx.require(router);
//       ^? RouterApi — fully typed, no cast
routerApi.navigate('/about');
```
Throws with clear error if not registered. Only accepts PluginInstance references, not strings.

### `ctx.has(name)` — String-Based Boolean Check
```typescript
if (ctx.has('analytics')) {
  const analyticsApi = ctx.require(analytics);
  analyticsApi.track('pageview');
}
```
Never throws. Checks global registration, not restricted by `depends`.

## Event Merging via depends

When Plugin B declares `depends: [pluginA]`, B's hooks and emit see `Events & PluginAEvents`.

**NOT transitive:** If C depends on B which depends on A, C does NOT see A's events. C must directly declare `depends: [pluginA, pluginB]`.

## Consumer Callback Context

```typescript
type AppCallbackContext = {
  config: Readonly<Config>;
  emit: EmitFunction<Events>;
  require: RequireFunction;
  has: HasFunction;
} & BuildPluginApis<P>;
```

Consumer callbacks (`onReady`, `onStart`, `onStop`, `onError`) get full access including mounted plugin APIs.

## Convention: Event Naming

Namespace with emitting plugin name: `router:navigate`, `auth:login`, `build:complete`.
- `framework-domain:*` — framework-level events
- `pluginName:eventName` — per-plugin events
