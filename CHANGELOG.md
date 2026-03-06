# Changelog

All notable changes to the Moku Claude Code Plugin will be documented in this file.

## 0.4.0 (2026-03-06)

### Fixed
- Version mismatch between plugin.json and marketplace.json
- Author name typo ("Oleksadr" -> "Oleksandr")
- Fragile JSON parsing in hook script (jq fallback added)
- Removed unsupported `version` field from skill frontmatter

### Added
- `disable-model-invocation: true` on all commands to prevent accidental auto-triggering
- PostToolUse hook for auto-formatting after Write/Edit
- PreCompact hook to preserve planning state during context compaction
- SessionStart hook to detect Moku project type and planning state
- `settings.json` with configurable defaults (parallel agent limit, model overrides)
- `/moku:check` diagnostic command for plugin self-validation
- CHANGELOG.md for version tracking
- Dynamic context injection in skills for live state awareness

### Improved
- Agent descriptions trimmed from ~30 lines to ~3 lines each (saves ~240 lines of context budget)
- Consolidated repeated "no explicit generics" anti-pattern warnings
- Commands shortened via progressive disclosure (reference files for detailed steps)
- Replaced `specification/15-PLUGIN-STRUCTURE` references with actual skill references
- Auto-git-commit before each build wave for rollback safety

## 0.3.1 (2026-02-XX)

### Added
- marketplace.json for plugin distribution

## 0.3.0 (2026-02-XX)

### Added
- 9-agent validation pipeline (spec, jsdoc, plugin-spec, plan-checker, verifier, test, type, architecture, researcher)
- Wave-based parallel execution for framework builds
- Cross-session state tracking via .planning/STATE.md
- PreToolUse hook for auto-approving .planning/ directory writes
- 3-level artifact verification (exists, substantive, wired)
- Gap closure with circuit breaker (max 2 rounds)
- Context budget management with resume support

### Commands
- `/moku:init` — Project scaffolding with full tooling
- `/moku:plan` — 3-stage gated planning workflow
- `/moku:build` — Wave-based build with parallel sub-agents

### Skills
- `moku-core` — Three-layer architecture and specification
- `moku-plugin` — Plugin structure and complexity tiers
- `moku-web` — Preact/Vite web patterns
