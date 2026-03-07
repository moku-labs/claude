# Moku Claude Code Plugin

Development toolkit for [Moku Core](https://github.com/moku-labs/core) — the micro-kernel plugin framework for TypeScript.

## What This Plugin Does

Provides commands, skills, validation agents, and hooks for building Moku-based frameworks, plugins, and consumer applications with full specification compliance. Features wave-based parallel execution, 3-level artifact verification, mermaid diagram generation, and a 10-agent validation pipeline.

## Commands

| Command | Description |
|---------|-------------|
| `/moku:init [path]` | Scaffold a new Moku development environment with full tooling |
| `/moku:plan [target] [description]` | Gated workflow: optional discussion, optional research, analysis, specifications. Validates plans before user review. |
| `/moku:build [target] [spec-or-name]` | Build from specifications with wave-based parallel execution. Supports targeted builds: `plugin #3`, `plugins #3-#5`, `resume`. |
| `/moku:add [name] [description]` | Quickly add a single plugin to an existing framework — scaffold, implement, wire, validate in one pass. |
| `/moku:migrate [upgrade\|restructure\|from-existing]` | Upgrade @moku-labs/core, restructure plugin tiers, or migrate existing projects to Moku. |
| `/moku:check [verbose\|self-test\|graph]` | Run diagnostics on project state, tooling, plugin health, build status, generate mermaid diagrams, or validate the plugin itself. |

### Build Targets

```
/moku:build framework              # Build all plugins in parallel waves
/moku:build framework config       # Build only config.ts + index.ts
/moku:build framework plugins      # Build only plugins
/moku:build plugin #3              # Build single plugin by number
/moku:build plugins #3-#5          # Build range of plugins
/moku:build plugins #3,#5,#7       # Build specific plugins
/moku:build resume                 # Continue from STATE.md
/moku:build framework --dry-run    # Preview what would be built
```

## Skills

| Skill | Triggers On |
|-------|-------------|
| **moku-core** | "moku architecture", "moku specification", "createCoreConfig", "createCore", "createApp", "moku factory chain", "three-layer model", "moku kernel", "moku lifecycle", "moku event system", "moku context tiers" |
| **moku-plugin** | "moku plugin structure", "moku plugin tier", "moku nano/micro/standard/complex plugin", "moku wiring harness", "moku plugin file layout", "moku plugin organization", "createPlugin structure" |
| **moku-web** | "moku web", "moku component", "moku CSS architecture", "moku island pattern", "moku data attributes", "moku @scope", "moku @layer", "moku design tokens", "moku layout structure" |

Skills include dynamic context injection to auto-detect project state and planning phase.

## Agents (10 total)

### Structural Validators

| Agent | Purpose |
|-------|---------|
| **moku-spec-validator** | Validates Moku specification compliance (3-layer, factory chain, config, lifecycle, events, state) |
| **moku-plugin-spec-validator** | Validates plugin structure, tier, file organization, domain merge detection |
| **moku-jsdoc-validator** | Validates JSDoc documentation quality, examples, completeness |
| **moku-web-validator** | Validates web patterns: data-* attributes, @scope, @layer, islands, tokens |

### Quality Validators

| Agent | Purpose |
|-------|---------|
| **moku-plan-checker** | Validates plan completeness: requirement coverage, dependency graph, event flow, spec sections |
| **moku-verifier** | 3-level artifact verification: exists, substantive, wired. Runs lint + test. |
| **moku-test-validator** | Validates test quality: mock context correctness, edge cases, type-level tests |
| **moku-type-validator** | TypeScript type correctness: `tsc --noEmit`, `as any` audit, inference chain |
| **moku-architecture-validator** | Cross-plugin analysis: dependency graph, event flow, API consistency |
| **moku-researcher** | Pre-implementation research: npm ecosystem, TypeScript patterns |

### Validation Pipeline

After a full framework build, validators run in this order:

```
Parallel Group A (structure):     spec-validator + jsdoc-validator + plugin-spec-validator
Parallel Group B (quality):       test-validator + type-validator
Sequential (cross-plugin):        architecture-validator
```

## Hooks

| Hook | Event | Purpose |
|------|-------|---------|
| **PreToolUse[Write\|Edit]** | PreToolUse | Auto-approves writes to `.planning/` directory; blocks `createPlugin<` anti-pattern |
| **PostToolUse[Write\|Edit]** | PostToolUse | Auto-runs `bun run format` after file edits (if format script exists) |
| **PreCompact** | PreCompact | Re-injects `.planning/STATE.md`, `decisions.md`, `research.md` before context compaction |
| **SessionStart** | SessionStart | Detects Moku project type, planning state, and existing specifications |
| **Notification** | Notification | Logs build progress notifications to `.planning/notifications.log` for long operations |
| **SubagentStop** | SubagentStop | Auto-logs agent completions to `.planning/agent-log.md` with timestamp and result |

## Configuration

### Per-Project Settings

Create `.claude/moku.local.md` with YAML frontmatter for project-specific overrides:

```markdown
---
maxParallelAgents: 3
gapClosureMaxRounds: 2
---

Project-specific notes and context here.
```

See `skills/moku-core/references/plugin-settings.md` for supported fields. Commands inject these values dynamically via `!` backtick syntax.

## State Tracking

The plugin maintains `.planning/STATE.md` for cross-session continuity:
- Records completed phases, plugin status, wave progress
- Enables `resume` command to continue from last position
- Updated at plan completion and after each build wave
- Preserved during context compaction via PreCompact hook

## Typical Workflow

1. `/moku:init my-framework` — Scaffold the project
2. `/moku:plan framework "A static site generator"` — Design the framework
3. `/moku:build framework` — Implement all plugins in parallel waves with verification
4. `/moku:build resume` — Continue if context was heavy
5. `/moku:add cache "LRU cache with TTL"` — Quick-add a plugin without re-planning
6. `/moku:check` — Verify project health
7. `/moku:check graph` — Visualize dependency graph and event flow as mermaid diagrams
8. `/moku:migrate restructure` — Re-assess plugin tiers after growth
9. `/moku:plan app "A personal blog"` — Plan the consumer app
10. `/moku:build app` — Build the consumer app

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
