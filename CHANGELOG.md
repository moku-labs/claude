# Changelog

All notable changes to the Moku Claude Code Plugin will be documented in this file.

## 0.13.3 (2026-03-11)

### Fixed
- **`check-plugin-antipatterns.sh` empty-object assertion regex** — removed erroneous `^\s*` anchor from `{} as` pattern so it also catches inline usages (not just line-start).
- **`hooks.json` prompt hook wording** — rewrote gatekeeper prompt with stronger output constraints ("Your ENTIRE response must be exactly one of…") and an explicit closing REMINDER line; reduces residual cases where the model adds preamble before the verdict.
- **`log-notification.sh` python3 eval** — replaced `eval` + complex quoting with direct subshell capture per field (same pattern applied to `check-plugin-antipatterns.sh` in v0.13.2), eliminating quoting hazards.
- **`precompact-state.sh` regex injection** — user-supplied `KEYWORDS` string was passed directly into `grep -iE`; special regex characters could cause grep to error or match unintentionally. Now escaped with `sed` before use; falls back to `__NOMATCH__` when keywords are empty.
- **`validate-plugin-structure.sh` test directory exclusions** — depth check only excluded `__tests__`; directories named `tests/` or `spec/` (common Vitest conventions) were still flagged. Added `*/tests/*` and `*/spec*` to the exclusion list.

## 0.13.2 (2026-03-11)

### Fixed
- **`check-plugin-antipatterns.sh` python3 fallback** — replaced `eval` + here-doc approach with direct subshell capture per field; eliminates quoting hazards with special characters in file paths or content.
- **`check-plugin-antipatterns.sh` null-assertion regex** — `null as ` was too broad, matching safe casts like `null as unknown`. Tightened to `null as [A-Za-z_]` so only concrete type assertions are flagged.
- **`detect-moku-project.sh` printf format** — replaced bare `printf "$WARNINGS"` with `printf '%b' "$WARNINGS"` to avoid format-string injection when warnings contain `%` characters.
- **`format-on-save.sh`, `precompact-state.sh`, `user-prompt-context.sh`** — replaced `grep -q 'a\|b'` with `grep -qE 'a|b'` throughout; POSIX `grep` treats `|` as a literal character without `-E`, silently breaking alternation.
- **`hooks.json` prompt hook routing** — rewrote prompt to use explicit sequential routing rules (non-plugin index.ts → approve immediately) so the model outputs a bare `approve` or `deny:` with no preamble, eliminating the false-block that occurred when the model generated explanatory text.
- **`on-subagent-stop.sh` double-parse** — consolidated `agent_type` and `status` extraction into a single JSON parse pass; removes a second `<<<` redirect that re-read stdin after it was already consumed.
- **`session-end.sh` stale cleanup** — removed `hook-debug.log` deletion that was left over from debugging; debug log is no longer created so the `rm` was a no-op.
- **`user-prompt-context.sh` plugin listing** — replaced `ls src/plugins/` with `find … -mindepth 1 -maxdepth 1 -type d` to avoid parsing ls output and correctly exclude files in the plugins root.
- **`validate-plugin-structure.sh` nesting depth** — depth check used `mindepth 3 / maxdepth 3` relative to repo root, so a plugin two levels deep never triggered. Corrected to `mindepth 2 / maxdepth 2` relative to the plugin directory.

## 0.13.1 (2026-03-11)

### Fixed
- **Prompt hook false-block (root cause)** — restructured prompt hook to make `approve` the explicit default and blocking the exception. Previous phrasing caused the LLM to generate explanatory text instead of the bare word, which the framework treated as a block.
- **`approve-planning-writes.sh` allow-list gaps** — added `.planning/skeleton-spec.md`, `.planning/STATE-history.md`, and `.planning/audit-*.md` to the auto-approve list. All three are written by commands but were missing, causing unnecessary hook friction.
- **`check-plugin-antipatterns.sh` overly broad file matcher** — `*/index.ts` and `*/config.ts` matched top-level source files (e.g. `src/index.ts`), triggering anti-pattern checks on non-plugin code. Tightened to `*/plugins/*/index.ts` and `*/plugins/*/config.ts`.
- **`validate-plugin-structure.sh` test file count** — source file count included `*.test.ts` and `*.spec.ts` at the plugin root, causing false-positive "too many files" warnings. Excluded test files from the count.
- **`on-subagent-stop.sh` result column** — hardcoded `completed` regardless of outcome. Now reads `.status` from tool input and falls back to `completed` only when absent.
- **`moku-audit-hooks-analyzer` agent blocked at spawn** — agent had `skills: ["moku-core"]` which loaded a skill with `$()` bash inlines that Claude Code's permission checker blocked. Removed the unused skill dependency.

### Changed
- **`/moku:audit hooks` workflow** — H1 detects plugin source path (`SOURCE_HOOKS_DIR`) via `./hooks/hooks.json` check. H2 replaced agent spawn with inline analysis (more reliable, no spawn-blocking risk). H3 writes fixes to both cache (`${CLAUDE_PLUGIN_ROOT}/hooks/`) and source (`SOURCE_HOOKS_DIR/`) when both are present; documents python3 Bash fallback for when Edit/Write is blocked on `hooks.json` itself.

## 0.13.0 (2026-03-11)

### Added
- **`/moku:audit` command** — new self-auditing command that reads a moku command file, generates test scenarios (valid, edge, error, adversarial), simulates execution step-by-step, runs a subset in a real temp project, identifies gaps, and proposes a concrete improved version with a unified diff. User approves before changes are written.
  - `plan`, `build`, `check`, `status`, `init` — audit any command
  - `hooks` — dedicated hooks audit mode (see below)
  - `all` — audit all commands + hooks sequentially
  - `--sim-only` — skip real execution (faster)
  - `--iterate` — re-audit after applying fixes (up to `auditIterateLimit` passes, default 3)
  - `--max-scenarios N` — per-run scenario cap override
  - AUDIT-STABLE declaration when zero blockers + ≤2 warnings across all scenarios
- **`moku-audit-scenario-generator` agent** — reads a command's full argument patterns, conditional branches, and documented modes; generates a structured scenario list in 4 categories with execution-value markers for real-execution selection.
- **`moku-audit-simulator` agent** — simulates scenarios as pure text analysis (no bash, no file I/O); uses the error-diagnostician reasoning protocol (materialize per-scenario traces before writing gaps); runs in parallel batches on haiku for speed.
- **`moku-audit-executor` agent** — runs high-execution-value scenarios in a bootstrapped temp project using Bash+Write+Read; manually applies command steps and captures real divergences; always cleans up temp directory.
- **`moku-audit-synthesizer` agent** — deduplicates gaps from all simulator + executor outputs; builds a priority table by severity and agent-agreement count; produces a unified diff and complete improved command text for user approval.
- **`moku-audit-hooks-analyzer` agent** — tests every hook script with real inputs via Bash; analyzes the prompt hook for the false-block root cause (insufficient output constraints); checks allowlists for completeness (detects missing `skeleton-spec.md`); proposes concrete fixes for `hooks.json` and `.sh` files.
- **`audit-framework.md` reference** — shared taxonomy for scenario categories (valid/edge/error/adversarial), gap types (10 types including silent-failure, state-corruption-risk, user-experience-gap), temp project bootstrap templates, circuit breaker thresholds, and diff generation rules.

## 0.12.1 (2026-03-11)

### Changed
- **Plugin barrel architecture (`build-assembly.md`)** — replaced 3-section barrel (Instances + Helpers + Namespaced Types) with 2-section barrel (Plugin Instances → Plugin Types). Helpers are never exported from the barrel; types use plain `export type *` instead of namespace-qualified `export type * as Namespace`. Updated `src/index.ts` pattern to require `pluginConfigs` in `createCore` with JSDoc per-property comments, and simplified to 2 export sections (`Plugins + Types` → `Framework API + Plugin Helpers`).
- **Skeleton templates (`plan-templates.md`)** — updated Architecture Overview, File Structure comment, Barrel Pattern section, and both Wave 0 skeleton code blocks (barrel + index.ts) to match the new architecture.

### Added
- **Validator rule 15 (`plugin-spec-validator.md`)** — Rule 15 (Barrel Export Structure): validates that `src/plugins/index.ts` has the two required section headers in order, flags helpers in the barrel as violations, and validates that `src/index.ts` uses `export * from "./plugins"` and includes `pluginConfigs`.

## 0.12.0 (2026-03-11)

### Added
- **`build-skeleton.md` reference** — new step-by-step skeleton build reference (S1–S7) for creating source files from the skeleton spec, running verification, collecting user approval, and committing the initial commit. Skeleton waves are stop-and-resume (one per invocation), copying code blocks directly from the spec — no sub-agents needed.
- **Skeleton detection & routing in `build.md`** — `/moku:build` now reads `## Skeleton:` from STATE.md before any other routing. Routes to `build-skeleton.md` when status is `not-started` or `in-progress`; skeleton always takes priority over plugin build waves.
- **`## Skeleton:` field in STATE.md schema** — new field with values `not-started | in-progress | verified | committed`. Extended Wave Progress table template with skeleton wave rows (Wave 0, Wave N, verify, commit).
- **Skeleton Specification Template in `plan-templates.md`** — full ready-to-paste template for `.planning/skeleton-spec.md` covering all five required sections: Architecture Overview, File Structure, System Connections, Skeleton Build Waves (with code blocks per file), and Verification Checklist.

### Changed
- **Stage 3 of `/moku:plan` rearchitected as Skeleton Specification** — stage now produces `.planning/skeleton-spec.md` (a spec document) instead of creating actual source files. Source file creation moved to `/moku:build` via the new skeleton build system. Updates STATE.md with `## Skeleton: not-started` and skeleton wave rows.
- **`plan.md` Next Action corrected** — after plan completes, Next Action now points to `Run /moku:build resume (skeleton build will run first)` instead of `/moku:build #1`.
- **Prompt hook prompt rewritten** — plugin index.ts gatekeeper uses clearer condition A/B structure (path check first, then 3-rule quality check) instead of the previous FIRST CHECK pattern, improving instruction-following reliability.
- **`build-framework.md` pre-requisite note added** — clarifies that if you are reading the file the skeleton is already committed; updated reference table to include skeleton build stage.

## 0.11.3 (2026-03-10)

### Fixed
- **Prompt hook false-blocking on non-plugin files** — PreToolUse prompt hook for plugin index.ts validation was erroring on `.planning/specs/*.md` and other non-plugin files instead of approving them. Rewrote prompt to check file_path pattern first and immediately approve anything outside `*/plugins/*/index.ts`.

## 0.11.2 (2026-03-10)

### Fixed
- **Inline bash permission errors** — replaced all `if/then/fi` patterns in skill and command `!` backtick injections with `test && command || true` chaining. Claude Code's permission checker rejects semicolons as "ambiguous command separators"; the new pattern avoids semicolons entirely. Fixed 9 instances across 6 files (moku-plugin/SKILL.md, moku-core/SKILL.md, moku-web/SKILL.md, plan.md, build.md, plugin-settings.md).

## 0.11.1 (2026-03-10)

### Changed
- **Agent preamble canonicalized** — expanded from 33 to ~65 lines with canonical R1–R8 code rules. All 12 agents now reference preamble rules instead of duplicating them, reducing per-agent prompt size and ensuring single-source-of-truth for rule updates.
- **Error diagnostician reasoning protocol** — added 4-step materialization (error inventory → per-file grouping → dependency chain → root cause list) before writing fix proposals.
- **Build-framework.md split into stages** — 451-line monolith replaced with 45-line router + 4 focused files (`build-wave-execution.md`, `build-verification.md`, `build-assembly.md`, `build-final.md`). Each file loaded only when needed, reducing context budget per build phase.
- **Context-aware memory retrieval** — PreCompact hook extracts keywords from STATE.md's Next Action and Phase, prioritizes keyword-matching memory entries before falling back to recency sort.
- **Bounded STATE.md with archival** — completed wave details archived to `.planning/STATE-history.md`, replaced with summary lines. Keeps STATE.md under ~60 lines regardless of project size.

### Added
- **Builder sub-agent output contract** — structured JSON block (`verdict`, `filesCreated`, `testsPass`, `lintPass`, `issues`) required at end of every builder response. Parent command parses JSON instead of inferring from text.
- **Pre-flight checks** — `bun install` + `bunx tsc --noEmit` + `bun run lint` before wave execution. Catches systemic issues once instead of N times across N parallel agents.
- **Incremental tsc during builds** — builder sub-agents run `bunx tsc --noEmit` after writing all source files (before tests), catching type errors early.
- **Adaptive model selection** — validation-coordinator selects agent models based on project size: <5 plugins → all sonnet; 5-15 → defaults; 15+ → upgrade haiku to sonnet.
- **Validator cross-communication** — Group A findings parsed and injected as Prior Findings Summary into Group B and architecture validator prompts.
- **Integration re-check after gap closure** — format/lint/tsc re-run after diagnostician fixes to catch fix-introduced regressions.
- **Memory aging policy** — agents delete `confidence:low` entries >14 days and `confidence:medium` >30 days.
- **Plugin structural validation hook** — new `validate-plugin-structure.sh` PreToolUse command hook checks filesystem structure (file count, nesting depth, types.ts import).
- **PreToolUse prompt hook few-shot examples** — approve/deny examples for better instruction-following.
- **Agent preamble few-shot example** — complete realistic output contract example for haiku-level agent consistency.
- **Dynamic self-test count** — `/moku:check self-test` counts agents dynamically instead of hardcoding.

## 0.11.0 (2026-03-10)

### Changed
- **Structured memory with aging** — `memory.md` now uses dated, categorized entries (`## Error Patterns`, `## Architecture Decisions`, `## Validation Baselines`) with `confidence:{high|medium|low}`. PreCompact hook injects 5 most recent entries per section (recency-prioritized) instead of flat `head -30`. Legacy format fallback preserved.
- **Gap closure re-validates with original validator** — after error-diagnostician fixes, the original validator that found the blocker re-runs (mapped via error category → validator), not just the verifier. Ensures fixes actually resolve the flagged issue.
- **Researcher available during gap closure** — error-diagnostician can now spawn `moku-researcher` for npm ecosystem questions mid-build. Researcher has a new "gap closure mode" for focused, concise answers instead of broad surveys.
- **Actionable hook denials** — PreToolUse prompt hook now returns the specific rule violated AND the fix when denying a write (e.g., "Rule 1 violated: 45 lines. Fix: extract to api.ts as factory").
- **Architecture-validator critical reminders** — added closing section with the 5 most commonly missed rules (core plugin event flow, explicit generics, Plugin postfix, require caching, helper purity) leveraging recency effect.
- **Web-validator sections 3-4 enhanced** — @layer ordering and token system checks now have concrete grep patterns, step-by-step verification, and specific file inspection rules matching the quality of sections 1-2.

### Added
- **Context budget warnings** — `user-prompt-context.sh` injects warning after 3+ waves completed in a session, suggesting fresh session for best results.
- **Incremental validation caching** — per-plugin content hashes recorded in STATE.md after verification. Validation-coordinator skips unchanged plugins with `CACHED` verdict. Architecture-validator always runs full (cross-plugin concerns).
- **Agent preamble memory format** — rule 8 now specifies structured memory write format for agents with `memory: user`.

## 0.10.0 (2026-03-09)

### Changed
- **plan.md split into verb-module router** — reduced from 457 to ~155 lines (67% reduction). Verb-specific logic moved to 4 reference files (`plan-verb-create.md`, `plan-verb-update.md`, `plan-verb-add.md`, `plan-verb-migrate.md`) loaded on demand.
- **PreCompact state re-injection rewritten** — replaced `head -80` with section-aware awk extraction that finds critical headers regardless of position. Supports `.planning/memory.md` injection (first 30 lines).
- **Format-on-save targets single file** — extracts file path from tool input via jq/python3 and formats only the changed file instead of the entire project.
- **`.planning/` auto-approve uses allow-list** — restricted from blanket pattern to known files (STATE.md, decisions.md, research.md, memory.md, specs/*.md, etc.) to prevent anti-pattern bypass via path manipulation.
- **grep/sed JSON fallback eliminated in all hooks** — python3 promoted to primary fallback after jq. Hooks emit warning JSON when no parser available instead of silently failing.
- **Agent output standardized** — all 12 agents now use shared preamble with universal rules, standardized severity levels (BLOCKER/WARNING/INFO), and structured JSON output contract at end of response.
- **SessionStart onboarding enhanced** — decision tree with quick start vs full workflow paths, contextual quick-action suggestions from STATE.md, project memory detection.

### Added
- **`--continue` flag for `/moku:build`** — auto-advances through all remaining waves without stopping between them. Git checkpoint commits still happen per wave. Stops only on context exhaustion.
- **`--quick` mode for `/moku:plan`** — collapses 3-stage workflow into single pass for projects with ≤4 plugins.
- **Build idempotency protocol** — plugins set to `building` status at wave start (not just completion). Resume detects crashes and offers reset-to-checkpoint or continue-from-current.
- **Error-diagnostician agent** — classifies errors into 12 categories, traces root causes vs cascading errors, integrated into gap closure.
- **Validation-coordinator agent** — orchestrates full pipeline programmatically (Group A → Group B → architecture), aggregates output contracts, determines disposition (PASS/FIX/MANUAL).
- **`/moku:check status`** — compact plugin overview with tier, files, tests, README, and build status.
- **`/moku:check diff <name>`** — spec-vs-implementation comparison showing MATCH/GAP/EXTRA per section.
- **`/moku:check plugin <name>`** — fast per-plugin validation (format→lint→tsc→test first, agent-based only on failure or `--full`).
- **`/moku:status` dashboard command** — consolidated view with phase, wave progress, plugin status, recent agent activity, and contextual quick-action suggestions.
- **`/moku:build fix` sub-command** — targets failed/needs-manual plugins with enhanced error context.
- **Shared agent preamble** (`references/agent-preamble.md`) — 8 universal rules plus output contract JSON schema, referenced by all agents.
- **Reasoning protocol** for architecture-validator and plan-checker — structured chain-of-thought with 5 intermediate results before report generation.
- **moku-testing skill** — mock context factories, integration test scaffolds, type-level test patterns, test organization conventions. Preloaded on builder and test-validator agents.
- **Project-level memory** via `.planning/memory.md` — accumulated error patterns, architecture decisions, validation baselines. Injected by PreCompact hook.
- **Config validation** — `maxParallelAgents` (1–5), `gapClosureMaxRounds` (0–5) bounds documented and enforced in plan/build commands.
- **Progress emission during builds** — 4 intermediate status messages per wave (pre-spawn, post-complete, post-verify, post-gap-closure).

## 0.9.0 (2026-03-09)

### Changed
- **Verb-first argument structure for `/moku:plan`** — command now uses `[create|update|add|migrate|resume] [type] [args]` pattern instead of `[framework|app|plugin] [description]`. Old syntax still works via backward-compatible fallback parsing.
- Type synonyms: `tool`/`engine`/`library` normalize to `framework`; `app`/`application`/`service`/`server`/`game` normalize to `app`.

### Added
- `update` verb — update existing plugin specs or app composition via `/moku:plan update plugin {name} {changes}` or `/moku:plan update app {changes}`. Produces spec-only output (consistent with plan→build separation).
- `add` verb — `/moku:plan add plugin {name} {description}` runs a quick single-pass flow (plan + build + wire + verify), absorbing the former `/moku:add` command.
- `migrate` verb — explicit migration via `/moku:plan migrate [type] {path/link/github}`. Supports GitHub URLs (auto-clones). Replaces heuristic path detection.
- Update Plugin Target and Update App Target sections in plan-stages.md (Stage 1 and Stage 2).
- Update Plugin Specification and Update App Specification templates in plan-stages.md.
- `## Verb:` field in STATE.md template for resume flow awareness.

### Removed
- `/moku:add` command — fully absorbed into `/moku:plan add plugin`. The quick single-pass workflow is preserved as Step 0.7 in plan.md.

## 0.8.3 (2026-03-08)

### Removed
- `/moku:migrate` command — removed entirely. The `upgrade` and `restructure` flows are dropped; the `from-existing` flow is now built into `/moku:plan`.

### Changed
- `/moku:plan` now accepts a path to existing code as argument — auto-detects paths (contains `/`, starts with `.` or `~`) and runs from-existing migration analysis inline (new Step 0.3)
- `migrate-flows.md` simplified to from-existing analysis only (upgrade and restructure sections removed)
- Migration decisions.md template simplified to from-existing fields only (no conditional branches)

## 0.8.2 (2026-03-08)

### Added
- **Helpers pattern** — static factory functions on plugins via `helpers` spec field. Helpers are pure functions spread onto `PluginInstance`, available before `createApp` for typed config construction.
- `helpers` field in PluginSpec shape (`plugin-system.md`) with design rules (static, pure, no ctx, no conflicts with PluginInstance fields)
- Helpers usage example in `plugin-system.md` (router plugin with `route()` helper)
- Helpers pattern reference in `plugin-patterns.md`
- Helpers validation in spec-validator, plugin-spec-validator, architecture-validator, and type-validator agents

## 0.8.1 (2026-03-07)

### Changed
- **Migrate command rewrite** — simplified from 300-line self-contained workflow to ~100-line preparation-only command. Migrate now analyzes only (never modifies code), saves context to `.planning/decisions.md` + `.planning/research.md`, and hands off to `/moku:plan framework`. Principle: migrate prepares, plan plans, build builds.
- Removed `resume` argument from migrate (plan has its own resume mechanism)
- Removed `Edit` from migrate's allowed-tools (no files are modified)

### Added
- `skills/moku-core/references/migrate-flows.md` — detailed per-type analysis instructions (upgrade, restructure, from-existing) loaded on-demand by migrate command
- Migration decisions.md template in plan-templates.md with `## Migration Type` header for flow detection
- Migration context detection in plan.md Step 0.5 (skips discussion phase) and Stage 1 (uses analysis as pre-answered requirements)

## 0.8.0 (2026-03-07)

### Added
- **Negative examples** ("Common Mistakes — DON'T Do These") in all 3 skills: moku-core, moku-plugin, moku-web
- **Prompt-based hook** (`type: "prompt"`) for reasoning-based validation of plugin index.ts writes — checks wiring harness pattern, explicit generics, unnecessary lifecycle methods
- **Progressive disclosure** in all 3 skills — advanced references load conditionally based on project complexity (plugin count, sub-modules, CSS file count, islands)
- **Cross-skill examples** in all 3 skills — concrete code showing how moku-core + moku-plugin + moku-web work together
- **Environment validation** on SessionStart — checks Bun >= 1.3.8, Node >= 22, tsc availability; warns early if missing
- **Version compatibility** on SessionStart — displays `@moku-labs/core` version from package.json

## 0.7.1 (2026-03-07)

### Fixed
- **CRITICAL**: SubagentStop hook parsed wrong field names (`agent_name`/`stop_reason` → `agent_type` per official schema)
- `user-prompt-context.sh` false-positive on non-Moku projects — Tools detection now requires `@moku-labs` in package.json
- `detect-moku-project.sh` welcome message too broad — changed `'moku'` match to `'@moku-labs'` to avoid substring false positives
- Notification hook removed speculative diagnostic logging — field names (`title`/`message`/`notification_type`) confirmed correct

### Added
- `notification_type` extraction in Notification hook (uses type as fallback label when title is absent)
- SessionEnd hook for cleanup on session termination
- UserPromptSubmit hook documented in README hooks table
- Expanded anti-pattern checks: `as any` in plugin files, `as unknown` assertions
- `.gitignore` for plugin root

### Changed
- PostToolUse format hook extracted from inline command to `hooks/format-on-save.sh`
- SubagentStop hook matcher changed from `*` to `moku-*` for precision

## 0.7.0 (2026-03-07)

### Added
- **Core plugins knowledge** across all skills, references, and agents — planner recommends core vs regular, builders know `createCorePlugin`, validators check core plugin compliance
- Core Plugin Identification section in plan-stages with decision table (events/hooks/depends → regular, self-contained infrastructure → core)
- Core Plugin Specification Template in plan-templates (simplified: no events/dependencies/hooks sections)
- Core Plugin Compliance check (#10) in spec-validator
- Core Plugin Analysis check (#8) in architecture-validator (promotion candidates, validation, event flow exclusion)
- Core Plugin Plan Validation check (#9) in plan-checker (infrastructure misclassification, name collisions, Wave 0)
- Wave 0 for core plugins in build-framework, plan-checker mermaid diagrams, and STATE.md template
- `CorePluginContext` tier in communication-context (`{ config, state }` only)
- Core plugin types section in type-system (`CorePluginInstance`, `CoreApisFromTuple`, `CoreApis = {}` identity)
- `createCorePlugin` API reference in core-api with full signature and examples
- Core plugin invariants in invariants.md (self-containment, reserved names, lifecycle ordering)
- Core plugin config 4-level cascade in config-lifecycle

### Changed
- `createCoreConfig` signature updated to include `CorePlugins` generic, `plugins?`, `pluginConfigs?` options
- Plugin tree diagram uses `[Core]` tags instead of tier names for core plugins
- Mermaid diagrams across validators include core plugin subgraph with `classDef core fill:#e8f5e9`
- Architecture validator process expanded from 9 to 12 steps (core plugin classification, promotion analysis)

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
