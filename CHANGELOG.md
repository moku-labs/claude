# Changelog

All notable changes to the Moku Claude Code Plugin will be documented in this file.

## 0.6.0 (2026-03-07)

### Fixed
- **CRITICAL**: Hook script jq fallback truncated JSON content at first escaped quote — added python3 as intermediate fallback (jq -> python3 -> grep/sed)
- **CRITICAL**: Corrected v0.5.0 changelog entry about `color` field — it IS supported, agents correctly retain it
- PreCompact hook re-injected unbounded file content — now bounded to ~150 lines via extracted script
- `/moku:add` skipped 5 of 6 validation agents — now runs plugin-spec, type, and jsdoc validators after verifier

### Added
- Per-plugin build status tracking within waves (`built`, `agent-incomplete`, `agent-failed`, `verified`, `needs-manual`)
- `maxTurns` scaling by plugin complexity tier (Nano: 20, Micro: 30, Standard: 40, Complex: 50, VeryComplex: 60)
- `<example>` blocks on all 10 agent descriptions for improved auto-triggering accuracy
- `hooks/precompact-state.sh` — extracted bounded PreCompact hook
- `hooks/log-notification.sh` — extracted Notification hook with 3-tier JSON parsing

### Improved
- All hook scripts use 3-tier JSON parsing: jq -> python3 -> grep/sed
- Notification and PreCompact hooks extracted from inline commands to standalone scripts

## 0.5.0 (2026-03-07)

### Fixed
- **CRITICAL**: `settings.json` was using unsupported schema — emptied (agent key is for activating agents, not config)
- **CRITICAL**: PostToolUse format hook fired on ALL projects — added Moku project guard (biome.json + src/config.ts or .planning)
- **CRITICAL**: Path traversal weakness in approve-planning-writes.sh — anchored to project root
- Verified `color` field is supported — retained in all 10 agent frontmatter files

### Added
- `skills` field on all agents (agents don't inherit parent skills — now preloaded)
- `maxTurns` on all agents (circuit breaker: 30 for validators, 40 for researcher)
- `memory: user` on researcher agent for cross-session domain knowledge
- `.lsp.json` for TypeScript language server integration
- First-run welcome message in SessionStart hook for new users
- `Agent` tool added to `/moku:check` for running validation agents
- `self-test` mode for `/moku:check` — validates the plugin's own integrity
- `--dry-run` mode for `/moku:build` — previews files without creating them
- STATE.md backup protocol (`.bak` before overwrite, git checkpoint SHA)
- STATE.md validation (required headers check on read)
- Dynamic config injection via `!` backtick in build/plan commands (reads `.claude/moku.local.md`)
- Configurable `maxParallelAgents` and `gapClosureMaxRounds` (previously hardcoded)

### Improved
- Skill trigger descriptions tightened with "moku" prefix to avoid false triggers on generic terms
- PostToolUse hook now reports format errors instead of swallowing them

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
- `/moku:check` diagnostic command for plugin self-validation
- CHANGELOG.md for version tracking
- Dynamic context injection in skills for live state awareness

### Improved
- Agent descriptions trimmed from ~30 lines to ~3 lines each (saves ~240 lines of context budget)
- Consolidated repeated "no explicit generics" anti-pattern warnings
- Commands shortened via progressive disclosure (reference files for detailed steps)
- Replaced `specification/15-PLUGIN-STRUCTURE` references with actual skill references
- Auto-git-commit before each build wave for rollback safety

## 0.3.1 (2026-02-28)

### Added
- marketplace.json for plugin distribution

## 0.3.0 (2026-02-25)

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
