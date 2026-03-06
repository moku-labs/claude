# Moku Claude Code Plugin

Development toolkit for [Moku Core](https://github.com/moku-labs/core) — the micro-kernel plugin framework for TypeScript.

## What This Plugin Does

Provides commands, skills, and validation agents for building Moku-based frameworks, plugins, and consumer applications with full specification compliance.

## Commands

| Command | Description |
|---------|-------------|
| `/moku:init [path]` | Scaffold a new Moku development environment with full tooling |
| `/moku:plan [target] [description]` | 2-stage gated workflow: analyze requirements, write specifications. Auto-detects framework/app/plugin. |
| `/moku:build [target] [spec-or-name]` | Build from specifications. Auto-detects framework/app/plugin. Supports `/moku:build plugin #3`. |

## Skills

| Skill | Triggers On |
|-------|-------------|
| **moku-core** | "moku architecture", "three-layer", "createCoreConfig", "factory chain", "moku specification" |
| **moku-plugin** | "plugin structure", "plugin tier", "complexity tier", "plugin organization", "wiring harness" |
| **moku-web** | "web app", "TSX", "CSS", "preact", "component", "layout", "island", "frontend" |

## Agents

| Agent | Purpose | Triggers |
|-------|---------|----------|
| **moku-spec-validator** | Validates Moku specification compliance | Proactively after code changes |
| **moku-plugin-spec-validator** | Validates plugin structure and completeness | Proactively after plugin creation |
| **moku-jsdoc-validator** | Validates JSDoc documentation quality | Proactively after code changes |

## Typical Workflow

1. `/moku:init my-framework` — Scaffold the project
2. `/moku:plan framework "A static site generator"` — Design the framework
3. `/moku:build framework` — Implement all plugins
4. `/moku:plan app "A personal blog"` — Plan the consumer app
5. `/moku:build app` — Build the consumer app

## Installation

### From GitHub

Add the marketplace and install the plugin:

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
