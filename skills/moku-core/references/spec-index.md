# Moku Core Specification — Fast Index

> **Authoritative source of truth.** Source: `github.com/moku-labs/core/specification`
> Pinned commit: `09affbbb35065e05c71618ac6ad7479790f0225f` (tag `v1.5.0`)
> Vendored: `2026-06-21` · Files live at `skills/moku-core/references/spec/`
> Note: there is **no `10-` file** — the sequence jumps `09 → 11`. This is upstream, not a missing download.
> Refresh with `/moku:spec-sync`.

## How to use this index

The full specification is ~6,400 lines across 15 files — **do not read it all.** This index
is the cheap entry point: scan it, then **open only the one or two `spec/NN-*.md` files** that
cover your decision.

**Rule (applies to every command and agent):** Before any decision about architecture, the
core API, the factory chain, config, lifecycle, events, the context object, types, invariants,
or plugin structure — **consult this index and OPEN the cited `spec/NN-*.md` file.** Do not rely
on memory or guess. The spec is authoritative; the distilled references
(`architecture.md`, `core-api.md`, etc.) are summaries that may lag. **If you must deviate from
the spec, justify it against a specifically cited section** (e.g. "deviates from 11-INVARIANTS §Part 1").
When validating or reporting findings, **cite the spec section ID** (`spec/NN-*.md §N`).

## Routing table — "I need to decide / check…"

| Question | Open |
|----------|------|
| What is Moku / the 3-layer model / why 3 steps | `spec/01-ARCHITECTURE.md` |
| Signature of `createCoreConfig` / `createCore` / `createApp` / `createPlugin` / `createCorePlugin` / `App` | `spec/02-CORE-API.md` |
| `PluginSpec` shape, `depends`, lifecycle methods, core plugins | `spec/03-PLUGIN-SYSTEM.md` |
| How the 3-step factory chain threads types, file-by-file example | `spec/04-FACTORY-CHAIN.md` |
| Config resolution, defaults, per-plugin config, immutability | `spec/05-CONFIG-SYSTEM.md` |
| `init` / `start` / `stop` phases, execution order, error handling | `spec/06-LIFECYCLE.md` |
| Events vs hooks, `emit`, event merging via `depends`, naming | `spec/07-COMMUNICATION.md` |
| The `ctx` object, context tiers, `ctx.require/has/emit/global/state` | `spec/08-CONTEXT.md` |
| Type helpers, `BuildPluginApis`, `App` type, full type flow | `spec/09-TYPE-SYSTEM.md` |
| **Invariants & anti-patterns** (R-rules origin), error-message format | `spec/11-INVARIANTS.md` |
| Plugin = connection point, file structure, LLM guide | `spec/12-PLUGIN-PATTERNS.md` |
| Reference kernel implementation / design-decision rationale | `spec/13-KERNEL-PSEUDOCODE.md` |
| Typed event declaration (register-callback pattern), strict emit | `spec/14-EVENT-REGISTRATION.md` |
| Complexity tiers, domain scenarios, test layout, file/naming conventions | `spec/15-PLUGIN-STRUCTURE.md` |

---

## File-by-file map

### `spec/01-ARCHITECTURE.md` — Three-layer model, design principles, why 3 steps
**Open for:** the mental model behind everything; why Moku is structured as it is.
§1 What Moku Is · §2 What Moku Is Not · §3 The Three Layers · §4 Why Three Steps (Not Two) ·
§5 Why Three Layers Matter for LLMs · §6 Design Philosophy · §7 Universal Structural Pattern ·
§8 Information-Theoretic Argument · §9 What the Framework Author Decides (Layer 2) ·
§10 Consumer Mental Model (Layer 3)

### `spec/02-CORE-API.md` — Public API surface & signatures
**Open for:** exact signatures and return types of the factory functions and `App`.
Symbols: `createCoreConfig`, `createCore`, `createApp`, `createPlugin`, `createCorePlugin`, `App`.
§1 Layer 1 Public API Surface · §2 createCoreConfig · §3 createCore · §4 createApp ·
§5 createPlugin · §6 createCorePlugin · §7 The App Type · §8 Complete Three-Layer Example

### `spec/03-PLUGIN-SYSTEM.md` — Plugin spec, dependencies, lifecycle, core plugins
**Open for:** what a plugin *is*, how `depends` works, core-plugin distinction.
Symbols: `PluginSpec`, `createPlugin`, `depends`, core plugins.
§1 PluginSpec · §2 createPlugin · §3 The `depends` Field · §4 Plugin Lifecycle Methods · §5 Core Plugins

### `spec/04-FACTORY-CHAIN.md` — The 3-step factory chain
**Open for:** how types flow `createCoreConfig → createCore → createApp`; a full worked example.
§1 Overview · §2 Why 3 Steps (Not 2) · §3 Step 1 createCoreConfig · §4 Step 2 createCore ·
§5 Step 3 createApp · §6 Type Flow Diagram · §7 Complete File-by-File Example

### `spec/05-CONFIG-SYSTEM.md` — Config resolution & immutability
**Open for:** defaults, per-plugin config, `config` is full `C` not partial, immutability rules.
§1 Two Levels of Config · §1b Core Plugin Config · §2 The Rule · §3 Config Resolution ·
§4 Per-Plugin Config in createApp · §5 Global Config Resolution · §6 config Is Full C ·
§7 Optional Fields · §8 Type-Level Config Enforcement · §9 Config Immutability

### `spec/06-LIFECYCLE.md` — init / start / stop
**Open for:** phase order, async execution model, error handling, what each phase may do.
§1 Three Phases · §2 init · §3 start · §4 stop · §5 Execution Model · §6 Error Handling ·
§7 Supported Lifecycle Usage · §8 Complete Example

### `spec/07-COMMUNICATION.md` — Events & hooks
**Open for:** the two communication channels, `emit`, hooks, event merging, naming convention.
§1 Two Communication Channels · §2 Event Sources · §3 emit (strictly typed) · §4 Hooks ·
§5 Event Merging via depends · §6 Event Naming Convention · §7 Middleware / Pipes

### `spec/08-CONTEXT.md` — The `ctx` object & context tiers
**Open for:** which `ctx` methods exist in which phase; `require`/`has`/`emit`/`global`/`state`.
§1 What is ctx · §2 Context Tiers · §3 Which Method Gets What · §4 Phase-Appropriate Context Rules ·
§5 ctx.global · §6 ctx.state · §7 ctx.require and ctx.has · §8 ctx.emit · §9 Consumer Callback Context

### `spec/09-TYPE-SYSTEM.md` — Type inference & helpers
**Open for:** the type-level machinery; `BuildPluginApis`, `CoreApis` threading, the `App` type.
§1 Design Philosophy · §2 Plugin Instance Type · §2b Core Plugin Instance Type · §3 Type-Level Helpers ·
§3b BuildCorePluginApis / CoreApisFromTuple · §4 Plugin Config in CreateAppOptions · §5 BuildPluginApis ·
§5b CoreApis Generic Threading · §6 The App Type · §7 Full Type Flow · §8 Plugin Type Visibility

### `spec/11-INVARIANTS.md` — Invariants, anti-patterns, error format ⭐
**Open for:** the non-negotiable rules (origin of the R1–R8 code rules), what NOT to do, error-message format.
**Validators must cite this file.**
§Part 1 Invariants · §Part 2 Anti-Patterns · §Part 3 Error Message Format

### `spec/12-PLUGIN-PATTERNS.md` — Plugin patterns & LLM guide
**Open for:** "plugin = connection point" framing, file structure, the LLM system-prompt fragment.
§1 Plugin = Connection Point · §2 Plugin File Structure · §3 Why This Matters ·
§4 Complete Three-Layer Example · §5 LLM System Prompt Fragment

### `spec/13-KERNEL-PSEUDOCODE.md` — Reference kernel implementation
**Open for:** *why* the kernel behaves as it does; pseudocode for each factory step. (Largest rationale doc.)
§1 Design Decisions Log · §2 createCoreConfig · §3 createPlugin · §4 createCore · §5 createApp (main body) ·
§6 app.start() · §7 app.stop() · §8 Helper Functions · §9 End-to-End Flow Summary

### `spec/14-EVENT-REGISTRATION.md` — Typed event declaration
**Open for:** the register-callback pattern for declaring typed events; strict emit; visibility rules.
§1 The Problem · §2 Register Callback Pattern · §3 Core Types · §4 The events Field on PluginSpec ·
§5 Why a Callback · §6 Strict Emit (No Escape Hatch) · §7 Event Visibility Rules · §8 Examples ·
§9 Future: Beyond Plugins · §10 Design Decisions

### `spec/15-PLUGIN-STRUCTURE.md` — Complexity tiers & code organization ⭐
**Open for:** Nano/Micro/Standard/Complex tier selection, domain scenarios, test layout, file content
contracts, documentation requirements, naming conventions, decision flowchart. (Largest file.)
§1 Organizing Principle · §2 Complexity Tiers · §3 Domain Scenarios · §4 Testing Layout ·
§5 File Content Contracts · §6 Documentation Requirements (Config/API/Events/Dependencies/Usage) ·
§7 Naming Conventions · §8 Anti-Patterns · §9 Decision Flowchart

### `spec/README.md` — Upstream index
The original spec table of contents + architecture-overview diagram. Open if you need the upstream framing.
