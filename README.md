# Moku Claude Code Plugin

Development toolkit for [Moku Core](https://github.com/moku-labs/core) — the micro-kernel plugin framework for TypeScript.

## What This Plugin Does

Provides commands, skills, validation agents, and hooks for building Moku-based frameworks, plugins, and consumer applications with full specification compliance. Features wave-based parallel execution, 3-level artifact verification, and a 9-agent validation pipeline.

## Commands

| Command | Description |
|---------|-------------|
| `/moku:init [path]` | Scaffold a new Moku development environment with full tooling |
| `/moku:plan [target] [description]` | Gated workflow: optional discussion, optional research, analysis, specifications. Validates plans before user review. |
| `/moku:build [target] [spec-or-name]` | Build from specifications with wave-based parallel execution. Supports targeted builds: `plugin #3`, `plugins #3-#5`, `resume`. |

### Build Targets

```
/moku:build framework              # Build all plugins in parallel waves
/moku:build framework config       # Build only config.ts + index.ts
/moku:build framework plugins      # Build only plugins
/moku:build plugin #3              # Build single plugin by number
/moku:build plugins #3-#5          # Build range of plugins
/moku:build plugins #3,#5,#7       # Build specific plugins
/moku:build resume                 # Continue from STATE.md
```

## Skills

| Skill | Triggers On |
|-------|-------------|
| **moku-core** | "moku architecture", "three-layer", "createCoreConfig", "factory chain", "moku specification" |
| **moku-plugin** | "plugin structure", "plugin tier", "complexity tier", "plugin organization", "wiring harness" |
| **moku-web** | "web app", "TSX", "CSS", "preact", "component", "layout", "island", "frontend" |

## Agents (9 total)

### Structural Validators (existing)

| Agent | Purpose | Triggers |
|-------|---------|----------|
| **moku-spec-validator** | Validates Moku specification compliance (3-layer, factory chain, config, lifecycle, events, state) | Proactively after code changes |
| **moku-plugin-spec-validator** | Validates plugin structure, tier, file organization, domain merge detection | Proactively after plugin creation |
| **moku-jsdoc-validator** | Validates JSDoc documentation quality, examples, completeness | Proactively after code changes |

### Quality Validators (new in v0.3.0)

| Agent | Purpose | Triggers |
|-------|---------|----------|
| **moku-plan-checker** | Validates plan completeness: requirement coverage, dependency graph, event flow, spec sections | Before user gates in `/moku:plan` |
| **moku-verifier** | 3-level artifact verification: exists, substantive, wired. Runs lint + test. | After each build wave |
| **moku-test-validator** | Validates test quality: mock context correctness, edge cases, type-level tests, integration lifecycle | After plugin build |
| **moku-type-validator** | TypeScript type correctness: `tsc --noEmit`, `as any` audit, inference chain, import type | After plugin build |
| **moku-architecture-validator** | Cross-plugin analysis: dependency graph, event flow, API consistency, performance flags | After full framework build |
| **moku-researcher** | Pre-implementation research: npm ecosystem, TypeScript patterns, reference implementations | During plan research phase |

### Validation Pipeline

After a full framework build, validators run in this order:

```
Parallel Group A (structure):     spec-validator + jsdoc-validator + plugin-spec-validator
Parallel Group B (quality):       test-validator + type-validator
Sequential (cross-plugin):        architecture-validator
```

## Hooks

| Hook | Purpose |
|------|---------|
| **PreToolUse[Write\|Edit]** | Auto-approves writes to `.planning/` directory for frictionless state tracking |

## State Tracking

The plugin maintains `.planning/STATE.md` for cross-session continuity:
- Records completed phases, plugin status, wave progress
- Enables `resume` command to continue from last position
- Updated at plan completion and after each build wave

## Typical Workflow

1. `/moku:init my-framework` — Scaffold the project
2. `/moku:plan framework "A static site generator"` — Design the framework (with optional discussion + research)
3. `/moku:build framework` — Implement all plugins in parallel waves with verification
4. `/moku:build resume` — Continue if context was heavy
5. `/moku:plan app "A personal blog"` — Plan the consumer app
6. `/moku:build app` — Build the consumer app

## Installation

### From GitHub

```bash
/plugin marketplace add moku-labs/claude
/plugin install moku@moku-labs-claude
```

### Local development

```bash
/plugin marketplace add ~/Projects/moku/claude
/plugin install moku@local
```

## Requirements

- [Bun](https://bun.sh/) >= 1.3.8
- Node.js >= 22.0.0
- [@moku-labs/core](https://github.com/moku-labs/core)

## License

MIT
