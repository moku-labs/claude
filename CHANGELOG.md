# Changelog

All notable changes to the Moku Claude Code Plugin will be documented in this file.

## 0.26.6 (2026-03-30)

### Fixed
- **Jump Table Phase=complete missing VERB=migrate** — resume after completed migrate plan now routes correctly instead of falling through undefined
- **Start-fresh .bak overwrite** — prior backup renamed to `.bak.YYYY-MM-DD` before overwriting, preventing silent data loss
- **`--context` probe missing `{token}.md`** — added `{token}.md` as second probe step before `context-{token}.md`, fixing the most common naming pattern (execution-confirmed)

### Changed
- **Wrong-command detection refined** — bare `build` removed from trigger list; `build a [noun]` patterns now treated as plan-intent instead of false-positive redirect
- **VERB detection priority order** — normalization now uses explicit first-match-wins numbered priority; state-based default is fallback-only
- **QuickMode validation on load** — non-boolean values (`yes`, `TRUE`, etc.) warn and default to false instead of undefined behavior
- **`--context` precedence clarified** — two-phase sequence: Step 0 sets value, Step 0.1 skips STATE.md load if already set
- **TYPE mismatch on resume** — AskUserQuestion prompt when normalized TYPE differs from STATE.md TYPE instead of silent discard
- **Context-file probe AskUserQuestion** — migrate PATH_OR_LINK prompt now explains token was matched as brainstorm context
- **Add verb STATE.md contract** — documented that add never writes STATE.md; resume after add shows "no plan state"
- **Add verb TYPE default** — auto-detect does not run for `add`; TYPE defaults immediately to `plugin`
- **Add verb sigil rejection** — path-like tokens (`../evil`, URLs) rejected as invalid plugin names
- **Output Styles guard** — `test -d` check before suggesting style switch
- **Whitespace `--context` guard** — empty/whitespace-only tokens rejected before path construction
- Version bumped to 0.26.6 in plugin.json and marketplace.json

## 0.26.5 (2026-03-30)

### Fixed
- **`--context` naming mismatch** — `--context site-gen` now probes `context-{token}.md` pattern when bare path fails, matching brainstorm output naming convention
- **`--context` absolute path handling** — absolute paths (`/tmp/file`) rejected with clear error instead of producing malformed `.planning//tmp/file`
- **`--context` shell injection guard** — metacharacter rejection (`;|$\`()`) and mandatory single-quoting prevent command injection via crafted filenames
- **`--context` path traversal** — `../` sequences resolving outside `.planning/` now rejected

### Changed
- **Fallback probe migrate-only guard** — PATH_OR_LINK fallback probe (local path + context file checks) now restricted to `migrate` verb only; `create`/`update`/`add` tokens no longer consumed as paths
- **Conflict-check cancel option** — ambiguous token AskUserQuestion now includes "Neither — treat as part of REQUIREMENTS" option
- **Duplicate `--context` handling** — last-wins rule documented for multiple `--context` flags
- **ContextFile resume fallback** — absent `## ContextFile:` in old STATE.md files defaults to `(none)` gracefully instead of undefined behavior
- Version bumped to 0.26.5 in plugin.json and marketplace.json

## 0.26.4 (2026-03-29)

### Fixed
- **`.brainstorm-active` orphan prevention** — early-exit cleanup rule ensures the brainstorm-guard marker is always deleted on validation errors, wrong-command redirects, and Cancel exits (was left orphaned, blocking subsequent brainstorms)
- **Plan-intent keyword shadowing** — `create spec` no longer silently proceeds as CATEGORY=create NAME=spec; wrong-command detection now checks token 2 when normalization is skipped
- **`--deep 0` / `--deep -1` cleanup** — invalid depth flag errors now clean up `.brainstorm-active` before stopping
- **Researcher merge crash on FAIL** — Phase 3 research merge now validates output files exist before reading; missing researcher output is logged and skipped instead of blocking

### Changed
- **`--deep` + `--quick` conflict** — explicit error when both flags present (previously undefined: last-flag-wins by prose order)
- **Wrong-command detection** — hard-stop replaced with `AskUserQuestion` offering "Continue brainstorming" escape hatch alongside redirect suggestion
- **Resume depth restoration** — resume now silently restores EFFECTIVE_DEPTH from saved analysis signals; depth confirmation AskUserQuestion no longer fires redundantly on resume
- **Resume partial state handling** — malformed analysis file on resume defaults to standard depth with logged warning instead of crashing
- **Quoted-token NAME extraction** — quoted strings (starting with `"`) now explicitly feed DESCRIPTION, not NAME
- **NAME derivation stop-word list** — "meaningful words" defined with explicit stop words (a, an, the, to, for, of, in, on, with, etc.)
- **Reserved NAME guard** — category keywords and reserved words used as NAME get `-project` suffix to avoid confusing file names and logs
- **Cancel cleanup** — Cancel exit now removes `.planning/build/` if empty (was accumulating on repeated cancellations)
- Version bumped to 0.26.4 in plugin.json and marketplace.json

## 0.26.3 (2026-03-29)

### Added
- **Custom status line** (`hooks/moku-statusline.sh`) — persistent bottom bar showing Moku phase, wave progress, plugin count, context usage bar (color-coded green/yellow/red), model name, cost, git branch, active agent, and rate limit warnings. Install via `/statusline` or configure `statusLine` in `~/.claude/settings.json`.
- **Desktop notifications** (`hooks/notify.sh`) — macOS (`osascript`) and Linux (`notify-send`) desktop notifications on key events: permission prompts, wave completion, verifier results, stop blocks, session end. Configurable via `enableNotifications` in `.claude/moku.local.md`.
- **Sound alerts** — system sounds on key events: glass (verifier pass), basso (verifier fail), submarine (stop block), hero (build/session complete), tink (permission needed), ping (session end). Configurable via `enableSounds` in `.claude/moku.local.md`.
- **activeForm task spinners** — `TaskCreate` calls in build wave execution now include `activeForm` parameter for live spinner text (e.g., "Building env...") in the task panel during builds.
- **Expanded Plan Mode UI** — `EnterPlanMode`/`ExitPlanMode` now used for build wave plan approval (before first wave starts) and brainstorm context file review (before writing final output). Provides a visually distinct read-only approval experience beyond the original plan Stage 1 usage.
- **First-run setup suggestion** — `detect-moku-project.sh` (SessionStart hook) now detects missing status line configuration and suggests `/statusline` setup on first Moku project detection.
- **Notification integration in hooks** — `log-notification.sh` fires desktop notification on permission prompts; `on-subagent-stop.sh` fires on verifier pass/fail; `check-wave-complete.sh` fires on stop block; `session-end.sh` fires on session end with phase-aware messaging.

### Changed
- `commands/build.md`: added `EnterPlanMode, ExitPlanMode` to allowed-tools; updated Task DAG section with `activeForm` parameter documentation and examples
- `commands/brainstorm.md`: added `EnterPlanMode, ExitPlanMode` to allowed-tools; added plan mode for context file review
- `skills/moku-core/references/build-wave-execution.md`: wave plan now presented in plan mode; `TaskCreate` calls include `activeForm`
- `skills/moku-core/references/plugin-settings.md`: added `enableNotifications` and `enableSounds` to supported settings table
- Version bumped to 0.26.3 in plugin.json

## 0.26.2 (2026-03-29)

### Added
- **Intent Normalization** — all three commands (`/moku:plan`, `/moku:brainstorm`, `/moku:build`) now accept free-form natural language instead of strict structured arguments. "I want to make a static site generator" normalizes to `create framework "a static site generator"`. Structured syntax still works unchanged.
- **Cross-command detection** — each command detects when the user meant a different command and suggests the right one (e.g., `/moku:plan build it` → "Run `/moku:build resume`").
- **Empty-args smart prompts** — `/moku:plan` and `/moku:brainstorm` show contextual `AskUserQuestion` menus instead of raw usage syntax when invoked with no arguments. `/moku:build` with no args auto-resumes from STATE.md.

### Changed
- Command `description` and `argument-hint` frontmatter updated to advertise free-form input support
- Version bumped to 0.26.2 in plugin.json and marketplace.json

## 0.26.1 (2026-03-29)

### Changed
- **`.planning/` restructure** — build artifacts moved to `.planning/build/` workspace. Root now contains only 4 persistent files (STATE.md, steering.md, decisions.md, learnings.md) + specs/ and archive/. Down from 17+ files.
- **Skeleton spec moved to `build/`** — `skeleton-spec.md` and `skeleton-report.md` now live in `.planning/build/`, not root. Never clutter the user's view after initial build.
- **File merges** — `decision-log.md` merged into `decisions.md` (root, persistent). `deferred-findings.md` + `dismissed-findings.md` merged into `findings.md` (build/).
- **`coverage-report.md` renamed** to `coverage.md` in `.planning/build/`.
- **Cycle archive wipes `build/`** — Step 7.5 now archives key artifacts (coverage, findings, skeleton-spec) to `archive/cycle-N/`, then wipes `build/` clean. Context files archived and removed from root.
- **Hook allowlist simplified** — `approve-planning-writes.sh` now uses `.planning/build/*` and `.planning/archive/*` glob patterns instead of individual file entries.
- **Filesystem guards** create `.planning/build/` directory (plan, brainstorm commands).
- All 27 files updated: 8 build references, 6 plan references, 5 agents, 4 hooks, 3 commands, 1 README.
- Version bumped to 0.26.1 in plugin.json and marketplace.json

## 0.26.0 (2026-03-29)

### Added
- **Deliberative steering loop** — Steering Pre-Phase now walks users through one decision at a time with WHY/EXAMPLE/RECOMMENDATION context, "Help me decide" option for discussion, relevance checks to skip redundant questions, and incremental save for session-drop recovery. 6 questions (added CI/CD).
- **`--deep [N]` brainstorm iterations** — optional numeric argument for `--deep` flag (e.g., `--deep 7`). Custom iteration count decoupled from researcher count. Error on `--deep 0` or negative values. No upper cap.
- **Root documentation wave** (Build Step 5.6) — generates comprehensive root README and LLM documentation (`llms.txt` + `llms-full.txt`) for AI-friendly framework consumption.
- **Documentation validation** (Build Step 5.7) — validates completeness, accuracy, usability, and cross-references of all generated documentation.
- **Integration test wave** (Build Step 5.8) — auto-generates comprehensive root-level integration tests. Scenario count driven by plugin count and complexity tiers. Covers core, cross-plugin, user journey, and edge case categories.
- **Coverage verification** (Build Step 5.9) — quantitative test coverage measurement with 80% build gate, per-plugin breakdown, gap closure for low coverage, coverage report generation.
- **CI/CD wave** (Build Step 5.10) — generates GitHub Actions workflows based on user steering choices: PR validation, coverage gate, npm publish, GitHub Releases, container build. Workflows adapted to actual project structure.
- **Cycle archive** (Build Step 7.5) — archives completed build state to `.planning/archive/cycle-{N}/`, resets STATE.md for next development cycle with preserved plugin context.
- **Delta updates** (Build Step 8) — subsequent builds (`add`, `update`) automatically update READMEs, LLM docs, integration tests, coverage, and CI/CD workflows for changed plugins.
- **`/moku:build add {name}`** — new entry point for building a single plugin from a spec created by `/moku:plan add`.
- **CI/CD steering question** — Question 6 in Steering Pre-Phase asks users what CI/CD and distribution they need. Contextual recommendations based on project type. Feeds into Build Step 5.10.

### Changed
- **Plan never builds** — `plan add` now creates a spec only and recommends `/moku:build add {name}`. All verbs end with a build command recommendation, never invoke build steps directly.
- **Migration path parsing** — fallback probe for tokens that don't match path sigils: checks local path first, then `.planning/context-{token}.md`, with disambiguation dialog on conflict.
- Build framework quick reference expanded with all new steps (5.6–7.5 + Step 8)
- STATE.md template updated with QuickMode, Cycle fields and new wave progress rows
- Version bumped to 0.26.0 in plugin.json and marketplace.json

### Fixed
- Stale `add` verb descriptions in plan.md, README.md, and tooling-config.md updated to reflect spec-only behavior
- CI/CD integrated into plan-stages.md Stage 1 steering consumption block
- Context injection CI/CD question now uses two-turn pattern
- `update` verb resume path in build.md now routes to delta updates

## 0.25.7 (2026-03-28)

### Fixed
- **AskUserQuestion text-blocking** — all architectural decisions and challenge presentations now use two-turn pattern: code examples and reasoning in one response, AskUserQuestion in the NEXT response. Prevents dialog overlay from obscuring the content users need to read.
- **Broken heading hierarchy** — replaced all `##` headings in brainstorm output with `**BOLD CAPS**` formatting. Terminal renders all heading levels identically; bold-caps creates actual visual hierarchy.
- **Stale label references** — "Explore fresh directions" handler matched old label, Final User Gate handlers referenced old "Proceed to planning" / "Review context file" labels. All updated to match tightened labels.
- **Duplicate "Other" option** — removed manual "Neither — let me explain" and "None — stay the course" options. System auto-appends free-text "Other" — manual versions wasted an option slot.

### Changed
- **AskUserQuestion descriptions made self-contained** — each option description now includes the full trade-off summary so users can decide even if preceding text scrolled away
- **Labels tightened** to 2-5 words: "Resume (Recommended)", "Accept position", "Fresh directions", "Plan (Recommended)", "Review first"
- **Progress markers** added to each major phase: `Brainstorm: {name} | Phase N/4: {phase} | {depth} mode`
- **`---` horizontal rules** separate information sections from decision sections
- **Key-value metadata** format (`**Category:** create | **Depth:** standard`) replaces bullet lists for metadata
- **moku-planning output style** updated with terminal rendering rules: reliable vs broken GFM features, two-turn AskUserQuestion pattern, formatting hierarchy
- Version bumped to 0.25.7 in plugin.json and marketplace.json

## 0.25.6 (2026-03-28)

### Added
- **Learning maintenance/refresh** — Phase 1a auto-validates learnings against current codebase before surfacing them. Stale entries (referencing deleted plugins/files) are moved to a `## Stale` section instead of deleted, preserving data for manual review.
- **Hook-based brainstorm write enforcement** — new `brainstorm-guard.sh` hook blocks Write/Edit outside `.planning/` during active brainstorm sessions. Uses `.brainstorm-active` marker file with 4-hour stale timeout. SessionEnd hook auto-cleans marker on session close.
- **Proactive ideation** — "Explore fresh directions" option in debate Turn 2. Spawns 2 researcher agents with Inversion and Adjacent Possible lenses to generate out-of-box ideas with TypeScript code sketches. Runs at most once per session (checked via ideation file existence).
- Brainstorm scratch files (`brainstorm-*.md`, `context-*.md`, `learnings.md`, `.brainstorm-active`, `steering.md`, `deferred-findings.md`, `dismissed-findings.md`) added to `approve-planning-writes.sh` auto-approve list

### Changed
- Version bumped to 0.25.6 in plugin.json and marketplace.json

## 0.25.5 (2026-03-28)

### Added
- **Question Validation Protocol** — 5-criteria gate before asking any brainstorm question (auto-detect, architecture impact, obvious answer, code demonstrable, senior-colleague test). Self-audit step with >60% confidence threshold. Target 0–3 questions, hard cap at 5.
- **Compound Learning** — brainstorm sessions extract 3–5 reusable learnings to `.planning/learnings.md` after completion. Future brainstorms auto-surface relevant past learnings during Phase 1a analysis.
- **Cognitive Lenses** — each researcher agent receives a perspective lens (DX & Maintainability, Security & Robustness, Performance & Scalability) to ensure research covers different angles rather than converging.
- **Anti-rubber-stamp** — quality check after challenger returns; if all challenges are LOW severity or generic (no specific position text cited), re-spawn once with combined feedback. Challenger agent now requires at least one MEDIUM or HIGH challenge.
- **Cross-model review** — challenger agent no longer hardcodes `model: sonnet`; inherits parent model for natural diversity with the sonnet-based synthesizer.
- **Write protection** — brainstorm command restricts Write/Edit to `.planning/` directory only, preventing premature code changes during exploration.

### Changed
- Version bumped to 0.25.5 in plugin.json and marketplace.json

## 0.25.4 (2026-03-28)

### Changed
- **Brainstorm command rewrite** — collaborative analysis replaces passive survey
  - Phase 1 now auto-detects complexity from project context (code, DESCRIPTION, workspace) instead of asking 4 fixed-option scoring questions
  - Architectural decisions presented with TypeScript code examples, clear recommendations, and concerns about each alternative
  - 0 questions asked when context is clear — no more forcing users through irrelevant surveys
  - For `migrate` category: source path gathered during brainstorm, carried through context file to plan command (skips "Where is the code?" re-ask)
  - Scratch file renamed from `brainstorm-{NAME}-answers.md` to `brainstorm-{NAME}-analysis.md` to reflect new content
  - Context file template: "Discovery Answers" section replaced with "Analysis Summary" (auto-detected context, scope assessment, architectural decisions)
  - Context file template: added `## Migration Source` section for migrate category (path, tech stack, architecture, LOC, patterns)
- **Init command** — added `/moku:brainstorm` as suggested next step for Framework and Consumer App projects (between init and plan)
- **Plan migrate verb** — checks context file for `## Migration Source > Path` before asking user for source location
- **Next command** — fixed brainstorm-in-progress detection glob pattern (`answers` → `analysis`)
- Version bumped to 0.25.4 in plugin.json and marketplace.json

## 0.25.3 (2026-03-24)

### Fixed
- **Full-cycle audit findings** — 13 fixes from third full-cycle audit run (event-bridge project)
  - **[BLOCKER]** build-skeleton.md S7: Phase value changed from `skeleton/committed` to `complete` — the old value had no routing row in next.md, leaving users stuck after skeleton commit
  - Skeleton template: added JSDoc with `@param` and `@example` to inline `createState`/`api` arrow functions in `createPlugin`/`createCorePlugin` spec objects (fixes `jsdoc/require-jsdoc` on nested arrow functions)
  - Skeleton template: removed `@returns` from throw-only stub functions — `jsdoc/require-returns-check` rejects `@returns` on non-returning bodies
  - Skeleton template: documented `unicorn/consistent-function-scoping` pattern for subscribe-style stubs returning inner arrow functions
  - Skeleton template: fixed `biome-ignore` comment ordering — must be after JSDoc, immediately before the declaration it suppresses
  - Skeleton template: added `@param _ctx` with destructured `@param _ctx.global` and `@param _ctx.config` entries for state factory stubs
  - build-skeleton.md S7: added instruction to populate `## Verification Results` in STATE.md from skeleton-report.md (was left as placeholder)
  - plan-templates.md: `skeleton/building`, `skeleton/verified`, `skeleton/committed` removed from Phase enum (not valid Phase values — skeleton state tracked via `## Skeleton:` field)
  - plan-templates.md: File Structure section now notes only skeleton-created files should be listed (not init-created test files)
  - next.md: empty `.planning/` now presents `AskUserQuestion` with brainstorm and plan options instead of only suggesting plan create
  - status.md: added `Skeleton:` field to dashboard header template
  - plan-verb-create.md: plugin reordering from context file now logs the reorder decision
  - tooling-config.md: added `declarations.d.ts` to ESLint ignores list (eliminates "file ignored" warning in pre-commit hook)

### Changed
- Version bumped to 0.25.3 in plugin.json and marketplace.json

## 0.25.2 (2026-03-23)

### Fixed
- **Full-cycle audit findings** — 17 fixes from second full-cycle audit run (color-pipeline project)
  - Skeleton config.ts template: `createPlugin`/`createCore` now destructured from `createCoreConfig()` return instead of imported directly from `@moku-labs/core`
  - Skeleton plugin templates: `createApi` field renamed to `api` in all 3 template blocks (core, regular, regular+deps)
  - Skeleton `createCoreConfig` call: added required `id` string argument and `config` field in options
  - Skeleton `createState` parameter: fixed from `{ global: Config }` to correct MinimalContext shape with `readonly global` and `readonly config`
  - Skeleton import map: updated to show `createCoreConfig` as only `@moku-labs/core` import, `createPlugin`/`createCore` as self-exports
  - Skeleton events: added stub guidance and verification checklist item for plugins with events in their spec
  - Skeleton types.ts: added note to use concrete types from spec, not `unknown`
  - Build skeleton Step S6: removed `.planning/skeleton-spec.md` from `git add` (`.planning/` is gitignored)
  - Build skeleton Step S2: added barrel file grouping instruction (instances then types)
  - Brainstorm: added closing CTA with next command suggestion after context file is written
  - Init Step 5d: output-styles copy now prints message instead of silent `|| true` no-op
  - Init: `bunfig.toml` must be written before `bun install` for exact version pinning
  - Plan quick mode: STATE.md now written at each stage boundary for session recovery
  - Status dashboard: added `queued` wave status to distinguish build-not-started from build-in-progress
  - Status Quick Actions: contextual "start plugin build" label when no build has started
  - Audit full-cycle: documented hook coverage gap in temp project environment
  - Audit full-cycle: split brainstorm auto-answer rule for single-select vs multiselect discovery questions

### Changed
- Version bumped to 0.25.2 in plugin.json and marketplace.json

## 0.25.1 (2026-03-23)

### Fixed
- **Full-cycle audit findings** — 13 fixes from first full-cycle audit run (task-scheduler project)
  - Skeleton spec template: `createPlugin` import path corrected from `@moku-labs/core` to `../../config`
  - Skeleton barrel: `export type *` replaced with `export * as [PascalCase]` namespace re-exports (avoids type name collisions)
  - JSDoc tags: `@fileoverview` → `@file`, removed redundant `@module` from plugin index.ts templates, all comments converted to multi-line format
  - Skeleton stubs: `return {} as Api` replaced with `throw new Error("not implemented")` (R6 compliance)
  - Skeleton completeness: added README.md and `__tests__/` placeholder files per plugin
  - Handlers wiring: plugins with `handlers.ts` now must import and wire `createHandlers` in skeleton index.ts
  - Init: added `tests/integration/setup.test.ts` placeholder (prevents vitest empty-suite failure on first commit)
- **ESLint unicorn config** — added `ctx`, `fn`, `cb` to `unicorn/prevent-abbreviations` allowList in tooling-config.md
- **Full-cycle audit UX** — added "Keep for inspection" option before temp project cleanup
- **Full-cycle project pool** — all 30 project ideas now specify mixed complexity tiers (Nano→Complex) per project

### Changed
- Version bumped to 0.25.1 in plugin.json and marketplace.json

## 0.25.0 (2026-03-23)

### Added
- **Full-cycle audit mode** (`/moku:audit full-cycle`) — end-to-end workflow audit that drives init → brainstorm → plan → build → next → status in a real temp project
  - Driver agent (`moku-full-cycle-driver`) applies all command steps manually, auto-answering all AskUserQuestion gates via decision table
  - Two reviewer agents (`moku-full-cycle-reviewer`) run in parallel: Focus A (UX + integration) and Focus B (hooks + quality)
  - 30-item project idea pool with history tracking — each run uses a novel, never-tried project
  - `/moku:next` routing validation between every command and twice after build
  - Hook monitoring via diagnostics.log bracket markers — flags false-positives during the cycle
  - Findings grouped by command with severity, evidence, and fix suggestions
  - Export report to `.planning/audit-full-cycle-{date}.md`
- **2 new agents** (full-cycle-driver, full-cycle-reviewer) — 24 agents total
- **New reference file** `audit-full-cycle.md` — auto-answer decision table, observation log schema, hook monitoring protocol, finding type taxonomy

### Changed
- Version bumped to 0.25.0 in plugin.json and marketplace.json
- Plugin description updated to reflect 24-agent count and full-cycle audit capability
- `audit.md` extended with `full-cycle` target in Step 0 dispatch, Step 1 routing, and Steps FC1–FC6

## 0.24.0 (2026-03-23)

### Added
- **Brainstorm command** (`/moku:brainstorm`) — structured pre-planning workflow with adaptive discovery, parallel research, and debate-driven context generation
  - 4 categories mirroring plan verbs: `create`, `modify`, `feature`, `migrate`
  - Adaptive depth: 4 discovery questions score complexity (0–9) → auto-routes to quick (1 agent, 1 debate round), standard (2 agents, 2 rounds), or deep (3 agents, 3 rounds); override with `--deep`/`--quick`
  - Present → Challenge → Decide debate loop with convergence detection
  - Outputs standardized `.planning/context-{NAME}.md` consumed by `/moku:plan ... --context`
- **3 new agents** (brainstorm-researcher, brainstorm-challenger, brainstorm-synthesizer) — 22 agents total
  - `brainstorm-researcher`: domain research with web access, 3 focus modes (ecosystem, technical-patterns, category-specific), runs 1–3 in parallel
  - `brainstorm-challenger`: read-only devil's advocate, 3 angles per review (technical feasibility, scope/cost, wrong assumptions)
  - `brainstorm-synthesizer`: two modes — position mode (iterative during debate) and final mode (context file assembly)
- **3 new reference files** — brainstorm-flow.md (questions, scoring, research orchestration), brainstorm-debate.md (debate loop mechanics, cleanup), brainstorm-templates.md (context file template, position doc schema)
- **Plan command `--context` flag** — `/moku:plan create ... --context context-{NAME}.md` skips steering, discussion, and research phases; synthesizes steering.md from brainstorm context; injects plugin hints into Stage 1 and risk mitigations into Stage 2
- **Next command brainstorm detection** — `/moku:next` now detects in-progress brainstorm sessions and completed context files, routing users correctly

### Changed
- Version bumped to 0.24.0 in plugin.json and marketplace.json
- Plugin description updated to include brainstorm command and 22-agent count
- `plan.md` argument parsing extended with `--context {file}` extraction, STATE.md persistence of CONTEXT_FILE, and verb-specific support warnings
- `plan-verb-create.md` extended with Context Injection Pre-Phase before Steering Pre-Phase

## 0.23.3 (2026-03-23)

### Fixed
- **Plan command audit — 21 fixes across 3 iterative passes (60 scenarios)**
  - **BLOCKER**: Jump Table missing `stage3/approved` row — resume after Stage 3 approval told user to start over, destroying completed work
  - **BLOCKER**: `## Skeleton:` required non-empty at Stage 1 exit but no initial value specified — validation deadlock prevented STATE.md persistence
  - **BLOCKER**: Start-fresh backed up STATE.md without writing replacement — session drop between Start-fresh and next stage exit lost VERB/TYPE/REQUIREMENTS
  - **BLOCKER**: Unrecognized VERB loaded from STATE.md had no error handler — Route to Workflow failed silently
  - **BLOCKER**: Start-fresh template wrote empty `PluginTable`/`WaveGrouping` values (trailing space) — resume validation rejected as malformed, creating unresumable state
  - **BLOCKER**: plan-stages.md Stage 3 unconditionally wrote `Skeleton: not-started`, contradicting plan.md's preservation rule — regressed build-advanced skeleton values
  - **HIGH**: `resume --quick` with stored `QuickMode: false` had undefined precedence — explicit invocation flag now overrides stored value
  - **HIGH**: Auto-detect resolved TYPE but VERB was never set — now defaults to `create`
  - **HIGH**: Token Extraction had no quote-handling semantics — added shell-like tokenization (quoted strings = single tokens)
  - **HIGH**: Auto-detect condition (b) "Moku framework package" was unimplementable — replaced with concrete `@moku-labs/*` pattern
  - **WARNING**: `update plugin` PLUGIN_NAME extraction undocumented in plan.md — added cross-reference to plan-verb-update.md; Step 5 retitled "add verb only"
  - **WARNING**: `--quick` strip said "strip it" (singular) but "anywhere" (plural) — changed to "strip all occurrences"
  - **WARNING**: Skeleton rule only protected Stage 1/2 exits — extended to all stage exits with "never regress build-advanced value" rule
  - **WARNING**: Step 0.1 "Load QUICK_MODE from state" could overwrite invocation-time flag — added precedence note
  - **WARNING**: VERB=resume stored in STATE.md got confusing "unrecognized" error — added special-case message explaining resume is invocation-only
  - **WARNING**: Auto-suggest fired even when `--quick` explicitly passed — now skipped when QUICK_MODE already true
  - **WARNING**: Unrecognized first word silently polluted REQUIREMENTS — documented as intentional (useful context)
  - **WARNING**: Jump Table complete+update "Set Phase: none" was ambiguous (in-place vs full rewrite) — clarified as in-place edit preserving all other headers
  - **WARNING**: User REQUIREMENTS "(none)" collided with internal sentinel — added guard to re-prompt
  - **WARNING**: Route to Workflow context handoff undocumented — added note that all Step 0 parsed values are available in routed reference files
  - **INFO**: PluginTable/WaveGrouping format for multi-plugin tables (deferred — works in practice)

### Changed
- Version bumped to 0.23.3 in plugin.json and marketplace.json.
- plan-stages.md Stage 3 State Update updated with Skeleton preservation rule (cross-file consistency fix).

## 0.23.2 (2026-03-20)

### Fixed
- **Plan command audit — 15 fixes across 1 pass (20 scenarios)**
  - **BLOCKER**: migrate `PATH_OR_LINK` now retries on empty AskUserQuestion response (2 attempts, then stop with error)
  - **HIGH**: Startup sequence explicitly numbered (1. filesystem guard → 2. empty-args check) resolving ordering ambiguity
  - **HIGH**: Path traversal resolution specified as `realpath -e` with fallback for non-existent paths
  - **MEDIUM**: `add plugin` PLUGIN_NAME extraction added as new step 5 in Token Extraction
  - **MEDIUM**: `--quick` auto-suggest placement specified ("after plugin table assembly, before Stage 1 approval gate")
  - **MEDIUM**: File preservation contradiction resolved — "Start fresh" now preserves `decisions.md` and `research.md` (aligned with jump table behavior)
  - **MEDIUM**: Phase reset value after `complete`+`update` explicitly set to `## Phase: none`
  - **MEDIUM**: Suggestion construction rule for invalid verb-type combos (fix TYPE first, then VERB)
  - **MEDIUM**: Header inline-colon format documented; `## Skeleton:` added as 8th required header in validation set
  - **MEDIUM**: Path verification mechanism specified (`test -d && test -r`)
  - **MEDIUM**: Token pointer on unrecognized first word — "do not advance, leave stream intact"
  - **MEDIUM**: REQUIREMENTS after auto-detect clarified — remaining unparsed tokens become REQUIREMENTS
  - **MEDIUM**: Phase=none guard skips unnecessary resume prompt on fresh projects
  - **MEDIUM**: QUICK_MODE persisted on first STATE.md write (not deferred to stage exit) — prevents session-drop data loss
  - **MEDIUM**: Plan Mode quick mode transition documented (ExitPlanMode → immediate Stage 2)

### Changed
- Version bumped to 0.23.2 in plugin.json and marketplace.json.

## 0.23.1 (2026-03-20)

### Fixed
- **`#wave:N` parsing and validation** — added explicit rule 1e in Step 0 with integer validation, immediate bounds checking (catches `#wave:abc`, `#wave:-1`, `#wave:`, and out-of-range values before dry-run exits), and `waveOverride` storage.
- **`#wave:N` + completed build check** — `#wave:N` now bypasses the "build already complete" guard, enabling intentional wave re-execution with automatic plugin status reset.
- **`framework config`/`plugins` sub-modes** — added routing logic in Step 0 rule 3 with `## Mode:` STATE.md field, config.ts precondition guard for plugins-only mode, and mode restoration on resume.
- **`--dry-run` + `--continue` conflict** — mutual exclusivity check (rule 1b) now rejects contradictory flags.
- **`--lean` + `--dry-run` state mutation** — lean mode is output-format-only when dry-run is active; does not write `## LeanMode: true` to STATE.md.
- **Auto-lean "session" definition** — explicitly defined as a single `--continue` invocation; auto-lean does not trigger in default one-wave-per-invocation mode.
- **Concurrency guard overhaul** — moved to pre-condition block with 5-minute staleness guidance and explicit "Stop" outcome.
- **Resume `## Verb: fix` routing** — resume now reads `## Verb:` from STATE.md and routes interrupted fix sessions to Error Recovery automatically.
- **Resume `## Mode:` restoration** — resume now reads `## Mode:` from STATE.md to restore plugins-only/config-only sub-modes.
- **Resume `## LeanMode:` restoration** — resume now explicitly reads and reactivates lean mode from STATE.md.
- **Skeleton option label alignment** — `verified` row options now match `build-skeleton.md` Step S5 (Approve and commit / Adjust skeleton / Show details).
- **`--continue` skeleton gate clarification** — verified row now explicitly states --continue does not bypass approval and resumes automatically after commit.
- **Held flags note in skeleton in-progress** — `#wave:N` and `--continue` re-application after skeleton commit now documented inline.
- **`fix --all` zero-match guard** — stops with informational message when no plugins need fixing.
- **`fix` reserved word guard** — `fix resume`, `fix framework`, etc. now rejected with clear error instead of searching for nonexistent plugin.
- **Error Recovery dual entry points** — section opening now documents both `fix` argument and `resume` → `## Verb: fix` entry paths.
- **Error Recovery prerequisite ordering** — checks now explicitly ordered: (1) skeleton prerequisite, (2) zero-match guard, (3) multi-plugin prompt.
- **Pipeline Status freshness check** — stale `## Pipeline Status` (predating last `## Git Checkpoint`) is discarded before reconciliation.
- **State Write Protocol `.bak` semantics** — documented as single-depth undo (not accumulating backup).
- **Post-wave code review triage** — added inline summary of key triage behaviors (skipTriage, BLOCKER blocking, Fix now / Fix later routing).
- **Stalemate detection cross-reference** — explicit pointer to `build-verification.md` Step 4c for error signature hashing algorithm.
- **Step 0 rule evaluation order** — explicit statement that rules 1–1e are evaluated in order with short-circuit.
- **`#wave:` empty N** — added to error message examples for completeness.
- **Plugin status reset** — documented how `#wave:N` resets wave plugins from `complete` to `building`.

### Changed
- Version bumped to 0.23.1 in plugin.json and marketplace.json.

## 0.23.0 (2026-03-20)

### Added
- **`/moku:next` command** — auto-detects project state from STATE.md and routes to the next logical step. Supports `--dry-run` to preview without executing. Resolves the most common UX gap identified in competitive analysis (GSD, Taskmaster, and Compound Eng all have auto-advance).
- **Explicit scoring rubrics for wave-judge** — all 5 evaluation dimensions (verification health, code quality trajectory, test coverage, integration stability, blocker severity) now have concrete 1-5 rubric tables with specific criteria per score.
- **Adversarial scenario examples** — audit-scenario-generator now includes 7 concrete categories: shell injection, path traversal, keyword mimicry, unicode/special chars, state poisoning, conflicting flags, boundary values.
- **App migration flow** — plan-verb-migrate.md now covers app-to-Moku migration (framework identification, route mapping, custom plugin detection, import rewriting) in addition to the existing framework migration.
- **Error handling for migration** — circular dependency detection with `MIGRATION BLOCKER` flags, unrecognizable project structure handling.
- **Complete configuration schema** — build.md now documents ALL config keys with `Used By` column: `maxParallelAgents`, `gapClosureMaxRounds`, `skipValidation`, `skipTriage`, `enablePipelining`, `leanMode`, `auditMaxScenarios`, `auditIterateLimit`.

### Fixed
- **README agent count** — corrected from "15 total" to "19 total" with proper categorization: 4 structural, 5 quality, 3 review/judgment, 2 supporting, 5 audit.
- **Build argument hints** — frontmatter now includes `resume`, `fix`, and `--lean` (previously missing from discoverability).
- **Skeleton routing ambiguity** — build.md now explicitly states that held arguments (`resume`, `--continue`, `#wave:N`) are communicated to the user and re-applied after skeleton is committed.
- **STATE.md write race condition** — build.md now uses atomic tmp→rename protocol (matching plan.md) with concurrency guard that detects stale `.tmp` files.
- **SHA-1 hash in lazy validation** — validation-coordinator changed from `shasum` to `shasum -a 256` for hash-based caching.
- **Plan checker decisions.md format** — now specifies expected H2 + list-item format with graceful fallback for non-standard files.
- **Hook silent failures** — validate-plugin-structure.sh and validate-plugin-index.sh now emit JSON context warning when neither jq nor python3 is available (instead of silent exit 0).
- **Dry-run skeleton-spec format** — build.md now documents both file path conventions (H3 sub-headers and code-block first-line comments).
- **Fragile sonarjs assertion** — tooling-config.md now has explanatory comment and fallback guidance for the `!` non-null assertion.
- **.planning/ directory guard** — plan.md now has a mandatory `mkdir -p .planning/` as the first action (previously buried in prose at Step 0).

### Changed
- **Agent memory semantics documented** — `memory: local` (project-scoped) and `memory: user` (cross-project) now have inline documentation in agent frontmatter.
- **Model tiers per validator documented** — validation-coordinator now has a full table showing default model, role, and estimated tokens per agent, plus complexity-based override rules.
- **Config schema centralized** — plan.md references build.md as the authoritative source for all configuration keys. No more fragmented documentation.
- **Status dashboard** — quick actions section now suggests `/moku:next` as a tip.
- Version bumped to 0.23.0 in plugin.json and marketplace.json.

## 0.22.0 (2026-03-19)

### Added
- **Lean execution mode** — `--lean` flag and `leanMode: "auto"` config strip verbose context from agent prompts during builds (~40-60% context savings). Auto-activates after 3+ waves in a session. New reference `build-lean-mode.md` with stripped prompt templates and context budget guidelines.
- **Lean mode persistence** — `## LeanMode:` field in STATE.md carries across sessions.

### Changed
- **Build command** — added `--lean` flag parsing, lean mode integration with wave pipelining (halves context cost while pipelining doubles throughput), auto-activation threshold (3+ waves).
- **Builder prompts** — lean mode strips framework config, dependency interfaces, and design decisions sections when plugin has no cross-plugin dependencies.

## 0.21.0 (2026-03-19)

### Added
- **Wave pipelining** — when `--continue` is active and project has 3+ waves, Wave N+1 builders start while Wave N is being verified (~30-50% throughput gain). New section in `build-wave-execution.md` covers pipeline reconciliation: interface hash comparison, `pipeline-built` status, and hash-changed rebuilds. Disable with `enablePipelining: false`.
- **Pipeline reconciliation** — after pipelined build completes, interface file hashes from `## Pipeline Status` in STATE.md are compared against current hashes on disk. Unchanged → promote to `built`; changed → reset and re-spawn.
- **Pipeline-Built Check** — STATE.md `pipeline-built` status handled on resume.

### Changed
- **STATE.md template** — added `## Pipeline Status:` section for interface hashes.
- **Build command** — added pipeline reconciliation step to State Check.

## 0.20.0 (2026-03-19)

### Changed
- **Validation documentation** — updated validator references and verification steps for consistency across all agents.
- Version bumped to 0.20.0 in plugin.json and marketplace.json.

## 0.19.0 (2026-03-18)

### Added
- **Multi-pass code review** — new `build-multi-pass-review.md` reference. Post-wave code reviewer now runs 4 focused passes: correctness, security, performance, maintainability. Each pass produces prioritized findings (P1–P3). Integrated into build-verification as Step 4a2.
- **Regression testing** — after each wave (Wave 1+), all previously verified plugins are retested (`bunx tsc --noEmit` + `bun run test`). Catches cross-plugin regressions introduced by the current wave. New section in `build-verification.md`.

### Changed
- **Build command** — framework build flow now includes `regression test` step after Wave 1+.
- **Code reviewer agent** — expanded from single-pass to multi-pass protocol.

## 0.18.0 (2026-03-18)

### Added
- **Conflict resolution protocol** — new `build-conflict-resolution.md` reference. When validators in the same group produce contradictory findings (verdict disagreements, severity disagreements, contradictory fixes on same file ±5 lines), the coordinator classifies them as information gap, genuine trade-off, false positive, or scope mismatch — and resolves accordingly.
- **Decision knowledge graph** — new `decision-knowledge-graph.md` reference. Records architectural trade-off decisions from conflict resolution and user approvals in `.planning/decision-log.md`. Builder agents receive relevant decisions as "DO NOT CONTRADICT" context.
- **Steering pre-phase** — plan-verb-create.md now includes an optional discussion phase (2–5 questions) and research phase (moku-researcher spawn) before Stage 1 analysis. Discussion results saved to `.planning/decisions.md`, research to `.planning/research.md`.

### Changed
- **Validation coordinator** — added intra-group conflict detection and resolution steps between Group A and Group B.
- **Wave judge** — added conflict resolution log as input (high unresolved count → lean toward `stop-for-review`).
- **Error diagnostician** — reads decision-log.md to avoid proposing fixes that contradict recorded decisions.
- **STATE.md template** — added `## Decisions:` and `## Research:` field tracking.

## 0.17.0 (2026-03-18)

### Added
- **TDD protocol reference** — new `tdd-protocol.md` in moku-testing skill with four phases (Types → Red → Green → Refactor), output contract extensions for builder agents, core plugin adaptations, and edge case handling.
- **Interactive findings triage** — new `build-findings-triage.md` reference. After validation, blockers and warnings are presented to the user via `AskUserQuestion` for interactive disposition: fix (enter gap closure), defer (mark as known issue), or dismiss (false positive). Deferred items recorded in decision-log.md.
- **Builder intent verification** — builder prompts now include TDD protocol summary requiring tests-before-implementation ordering.

### Changed
- **Build command** — added `skipTriage: true` config option to bypass interactive triage.
- **moku-testing SKILL.md** — expanded with TDD protocol summary and reference to the full protocol file.
- **Wave execution** — builder sub-agent prompts now include design decisions from `.planning/decision-log.md`.
- **Plan stages** — discussion phase questions refined for better decision capture.

## 0.16.2 (2026-03-18)

### Changed
- **Full command audit** — 43 fixes across all 5 commands (`plan`, `build`, `check`, `status`, `init`) in 8 iterative self-audit passes. Key improvements: stricter argument validation, better error messages, edge case handling for missing/corrupt state.

## 0.16.1 (2026-03-18)

### Changed
- **Build command audit** — 33 fixes from 3-pass iterative audit. Key improvements: dry-run skeleton reporting, plugin spec resolution hardening, error recovery prerequisite checks, continuous mode context exhaustion detection.

## 0.16.0 (2026-03-18)

### Added
- **`moku-code-reviewer` agent** — post-wave code review agent (116 lines) catching logic errors, spec deviations, security vulnerabilities, and Moku anti-patterns. Runs after verification passes in build-verification Step 4a2.
- **Output styles** — `moku-building.md` (terse, progress-focused) and `moku-planning.md` (verbose, analytical) for context-appropriate formatting.
- **Task DAG progress tracking** — build command uses `TaskCreate`/`TaskUpdate` for live progress UI during wave execution (parent task per wave, child per plugin).
- **Audit self-learning** — audit command now saves severity calibration and scenario effectiveness data to `.planning/audit-learning.md` for improved future audits.
- **Plan mode integration** — plan command uses `EnterPlanMode`/`ExitPlanMode` during Stage 1 analysis for read-only exploration.

### Changed
- **AskUserQuestion UX** — all user-facing questions across plan, build, and audit commands now use structured `AskUserQuestion` with labeled options, descriptions, and multiSelect control instead of freeform prompts.
- **Build verification** — post-wave code review spawned after verification passes.
- **Audit command** — enhanced with self-learning persistence, cross-audit correlation for `all` target, severity calibration from past audit data.
- **Plan command** — discussion and research phases use `AskUserQuestion` for better interaction.
- **Init command** — multiple robustness improvements from audit feedback.

## 0.15.1 (2026-03-18)

### Changed
- **`commands/plan.md`** — 21 fixes from 3-pass iterative audit. Key improvements:
  - **Resume flow hardened** — resume guard skips token extraction, Phase-to-Stage Jump Table with `none`/unrecognized fallback, explicit phase transition protocol (`pending-approval` → `approved`)
  - **STATE.md robustness** — read-time validation (presence + non-empty values), expanded schema (7 required headers including `PluginTable`, `WaveGrouping`, `QuickMode`), write validation with halt-on-failure, inline-colon format enforcement
  - **Argument parsing tightened** — VERB-as-TYPE rejection guard, empty REQUIREMENTS prompt for `create`/`update`, migrate REQUIREMENTS exemption (PATH_OR_LINK is primary input), backward-compat wording clarified, auto-detect follow-through with retry
  - **State management** — "start fresh" backup+cleanup, "continue" with new REQUIREMENTS confirmation, add-verb guard bypasses resume prompt, QuickMode persistence across sessions via `## QuickMode:` header
  - **Quick mode defined for all verbs** — `create`/`update` collapse stages, `resume` applies to remaining stages, `migrate` passes through, `add` always quick

## 0.15.0 (2026-03-17)

### Added
- **`verify-before-commit.sh`** — new PreToolUse hook (Bash) gates checkpoint commits with `bunx tsc --noEmit` + `bun run lint` verification. Blocks commits during active build waves if TypeScript or lint errors exist. Ensures no broken code enters git history.
- **`pre-commit-review.sh`** — new PostToolUse hook (Bash) runs lightweight self-review after checkpoint commits. Detects stubs, TODO markers, console.log statements, and re-runs tsc/lint. Injects findings as additionalContext for immediate visibility.
- **`agents/wave-judge.md`** — new **moku-wave-judge** agent completing the Planner/Worker/Judge triad. Evaluates wave quality on 5 dimensions (verification health, code quality trajectory, test coverage, integration stability, blocker severity) and outputs a continuation decision: `continue`, `stop-for-review`, or `fresh-retry`. Includes fixation detection for gap closure loops.
- **Fresh-Context Retry (Ralph Wiggum Loop)** — new Step 4c2 in `build-verification.md`. When gap closure exhausts its rounds, saves error summary to STATE.md `## Fresh Retry Context` section, sets plugins to `retry-pending`, and stops. On resume, spawns error-diagnostician with only the error context (no accumulated conversation), avoiding fixation loops. Pattern validated as industry best practice in 2026.
- **Resume with `retry-pending`** — `build-wave-execution.md` now handles `retry-pending` plugin status on resume, routing through fresh-context diagnostician before re-verification.
- **Wave Judge integration** — new Step 4c3 in `build-verification.md`. After gap closure (or if verification passed cleanly), spawns moku-wave-judge to evaluate wave quality before proceeding. Skipped for trivial waves (1 Nano/Micro plugin, zero warnings).

### Changed
- **`on-subagent-stop.sh`** — enhanced agent decision tracing. Now extracts `verdict`, `decision`, `blockers` count, and `warnings` count from agent JSON output contracts. Agent log entries show `PASS [continue] B:2 W:1` instead of just `completed`. Falls back gracefully if no JSON contract found.
- **`diagnostics-logger.sh`** — added `SELF-REVIEW` and `COMMIT-GATE` diagnostic categories.
- **`hooks.json`** — added PreToolUse Bash matcher for `verify-before-commit.sh` (timeout: 60s) and PostToolUse Bash matcher for `pre-commit-review.sh` (timeout: 30s).

## 0.14.0 (2026-03-17)

### Added
- **`auto-permissions.sh`** — new PermissionRequest hook auto-approves safe operations (read-only tools, project-scoped writes, safe bash commands) and blocks dangerous ones (sudo, force-push, rm -rf /, pipe-to-shell). Eliminates manual permission prompts for routine operations.
- **`check-wave-complete.sh`** — new Stop hook prevents Claude from stopping mid-wave during builds. Includes `stop_hook_active` guard against infinite loops.
- **`log-tool-failure.sh`** — new PostToolUseFailure hook logs tool errors to `.planning/diagnostics.log`. Skips user interrupts.
- **`diagnostics-logger.sh`** — shared logging library sourced by all hooks. Writes structured `[CATEGORY] target: message` entries to `.planning/diagnostics.log` for post-session analysis.
- **`.planning/moku.md`** — project marker file created on first session start. Caches project type, name, and core version for fast detection by all hooks (replaces per-hook `grep` on `src/config.ts`).
- **`commands/status.md`** — added `diagnostics` flag and diagnostics dashboard section reading `.planning/diagnostics.log`.
- **`commands/audit.md`** — added diagnostics log pattern analysis to hooks audit mode with `[c]` clear/archive option.

### Changed
- **`check-plugin-antipatterns.sh`** — migrated 6 deny responses from JSON `permissionDecision` output to idiomatic `exit 2` + stderr. Added diagnostics logging on each denial.
- **`validate-plugin-index.sh`** — migrated 2 deny responses to `exit 2` + stderr with diagnostics logging.
- **`validate-plugin-structure.sh`** — added diagnostics logging for structure warnings.
- **All hook guards** — replaced `grep -qE 'createCoreConfig|@moku-labs' src/config.ts` with `[ -f .planning/moku.md ]` check in 6 hooks. Only `detect-moku-project.sh` retains grep-based detection (as the marker creator).
- **`detect-moku-project.sh`** — creates `.planning/moku.md` marker on first detection, reads from it on subsequent sessions.
- **`approve-planning-writes.sh`** — added `moku.md` and `diagnostics.log` to auto-approve allow-list.
- **`hooks.json`** — added PermissionRequest, Stop, and PostToolUseFailure event entries.

### Removed
- **`auto-permissions.sh`** — removed hardcoded `/Users/alex/Projects/moku/*` path. `$CWD` check handles project-scoped writes.
- **`.claude/settings.local.json`** — trimmed 69 accumulated permission rules to 0. Auto-permissions hook handles all cases.

## 0.13.7 (2026-03-16)

### Fixed
- **`precompact-state.sh`** — `re.escape` trailing backslash from herestring `\n` caused `grep -iE` to fail with "trailing backslash" when NEXT_ACTION contained regex metacharacters. Added `.rstrip()` before `.rstrip('|')`.
- **`precompact-state.sh`** — `## Skeleton:` field was missing from the pre-compaction header loop (present in postcompact but not precompact).
- **`user-prompt-context.sh`** — `grep -c` with `|| echo 0` produced double-valued `WAVES_DONE` ("0\n0") when zero matches, causing `integer expression expected` error.
- **`approve-planning-writes.sh`** — shell glob `*` in case patterns matched `/`, allowing path traversal like `.planning/specs/../../etc/passwd.md` to pass the allow-list. Added `..` rejection guard. Also added absolute-path fallback patterns for macOS symlink resolution differences.
- **`on-subagent-stop.sh`** — unvalidated `|` in AGENT_TYPE/STATUS could corrupt the Markdown table in agent-log.md. Added pipe character sanitization.
- **`log-notification.sh`** — multiline `message` fields (with embedded `\n`) produced multiple log entries per notification. Added newline flattening.

## 0.13.6 (2026-03-16)

### Fixed
- **All hook scripts** — hooks were receiving empty input because `$TOOL_INPUT` is not a real environment variable. All scripts now read from stdin via `INPUT=$(cat)` per the official Claude Code hooks API.
- **All PreToolUse hook scripts** — JSON extraction paths used `.file_path` at the top level, but PreToolUse input nests tool parameters under `.tool_input`. Updated all jq/python3 paths to `.tool_input.file_path`, `.tool_input.content`, etc.
- **`format-on-save.sh`** — was formatting the entire project on every Write/Edit because `$TOOL_INPUT` env var was always empty. Now reads stdin and formats only the changed file.
- **`validate-plugin-structure.sh`** — JSON injection via unescaped `PLUGIN_NAME` in echo-constructed JSON. Replaced with `jq -Rs` safe encoding. Also fixed `types` import grep false-positive matching `types-utils`, `typesafe-actions`, etc.
- **`on-subagent-stop.sh`** — TOCTOU race condition on `agent-log.md` creation when parallel subagents complete simultaneously. Uses `set -o noclobber` for atomic header creation.
- **`precompact-state.sh`** — regex metacharacter escaping via `sed` was a no-op on macOS BSD sed. Replaced with portable `python3 re.escape()` approach.

### Changed
- **`hooks.json`** — removed `"$TOOL_INPUT"` from all command strings (not a real env var). Added `"async": true` to `format-on-save.sh` PostToolUse hook so formatting runs in background without blocking Claude. Added `PostCompact` hook entry.
- **`approve-planning-writes.sh`, `check-plugin-antipatterns.sh`, `validate-plugin-index.sh`** — migrated from deprecated `{"decision":"block"}` / `{"decision":"approve"}` output format to modern `hookSpecificOutput.permissionDecision` API (`"deny"` / `"allow"`).
- **`validate-plugin-structure.sh`** — warnings now use `hookSpecificOutput.additionalContext` instead of invalid `{"decision":"warn"}` which was silently ignored.
- **`check-plugin-antipatterns.sh`, `validate-plugin-structure.sh`, `validate-plugin-index.sh`** — added Moku project detection guard (`createCoreConfig`/`@moku-labs` check) so hooks exit instantly for non-Moku projects.
- **`check-plugin-antipatterns.sh`** — expanded test file exclusions to cover `*.test.tsx`, `*.spec.tsx`, `*/__tests__/*`, `vitest.setup.ts`, `vitest.config.ts`, `*.mock.ts`, `*.mock.tsx`, `*.fixture.ts`.

### Added
- **`postcompact-state.sh`** — new PostCompact hook that re-injects critical STATE.md fields (Phase, Verb, Target, Next Action, active waves) into Claude's context after compaction completes, ensuring planning state survives context compression.

## 0.13.5 (2026-03-12)

### Changed
- **`skills/moku-core/SKILL.md`, `skills/moku-plugin/SKILL.md`, `skills/moku-web/SKILL.md`** — replaced all bash inline (`!`` `) directives in "Advanced References" sections with plain prose instructions. Shell one-liners in skill files execute at load time and have caused permission prompts and exit-code noise; static prose is simpler and equally actionable.

## 0.13.4 (2026-03-12)

### Added
- **`validate-plugin-index.sh`** — new deterministic shell hook replacing the prompt-based `type: prompt` validator for `plugins/*/index.ts`. Checks rule1 (≤30 lines, Write only), rule3 (onStart/onStop require a real resource method call); rule2 (explicit type params) is already covered by `check-plugin-antipatterns.sh`. Fast-path exits 0 instantly for all non-plugin-index files — zero latency on every other write.

### Changed
- **`hooks.json` plugin index validator** — replaced `type: prompt` entry (LLM-based, 15 s timeout, prone to preamble false-blocks) with `type: command` pointing to `validate-plugin-index.sh` (5 s timeout, deterministic, no model call).
- **`commands/init.md`** — multiple robustness improvements:
  - Added **Step 0** gate requiring `tooling-config.md` to be read before any files are written; eliminates fabricated version numbers.
  - Tightened **Step 1** to collect Consumer App framework package name upfront instead of mid-flow.
  - **Step 2** uses `mkdir -p` (idempotent), skips `git init` when `.git` already exists, and confirms before overwriting non-empty directories.
  - **Step 3** adds `-y` to `bun init` and uses absolute paths throughout; documents why `rm` works before `.claude/settings.local.json` exists.
  - **Step 5b** (`lefthook install`) is now an explicit named step with a failure gate.
  - **Step 5c** (format) renamed from Step 5b for clarity.
  - **Verification checklist** — item 3 uses `bun run lint` (not format), item 7 explicitly checks Consumer App has no `@moku-labs/core` direct dependency, item 8/9 updated to match new step numbering.
  - Consumer App `src/index.ts` and `src/config.ts` templates now use a placeholder instruction to substitute the actual project name rather than hardcoding `"my-framework"`.
- **`skills/moku-core/SKILL.md`, `skills/moku-web/SKILL.md`** — replaced `test … && echo` shell one-liners in bash inlines with `awk 'END{if(NR>N)print …}'` to avoid `test` exit-code 1 being swallowed as a skill load error.

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
