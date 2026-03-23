# Full-Cycle Audit — Reference

Shared rules, decision tables, and templates for the `/moku:audit full-cycle` mode and its agents.

---

## Overview

The full-cycle audit drives the complete moku workflow (init → brainstorm → plan → build → next → status) in a real temp project to validate end-to-end behavior. A driver agent reads each command file and applies its steps manually, auto-answering all user gates. Two reviewer agents then analyze the results.

---

## Project Idea Pool

The orchestrator picks an unused idea from this pool. Track used ideas in `.planning/audit-full-cycle-history.md`.

| # | Name | Type | Description | Brainstorm Description |
|---|------|------|-------------|----------------------|
| 1 | task-scheduler | framework | Plugin-based task scheduling with cron and retry support | A TypeScript task scheduling framework using moku plugins. Needs: job-registry plugin for registration, cron-parser plugin for schedule parsing, retry plugin for failure recovery, and persistence plugin for durable jobs. Target: 4 plugins, Standard tier max. |
| 2 | color-pipeline | framework | Image color processing pipeline with filter chain | A color processing pipeline framework. Needs: color-space plugin for RGB/HSL/CMYK conversion, filter-chain plugin for composable transforms, histogram plugin for analysis, and output plugin for format export. Target: 4 plugins. |
| 3 | event-bridge | framework | Cross-process event bus with transport plugins | An event bridge framework for cross-process communication. Needs: channel plugin for topic management, memory-transport plugin for in-process, serializer plugin for message encoding, and router plugin for topic-based dispatch. Target: 4 plugins. |
| 4 | form-validator | framework | Schema-driven form validation with plugin rules | A form validation framework. Needs: schema plugin for field definitions, rules plugin for validation logic, messages plugin for i18n error text, and reporter plugin for error aggregation. Target: 4 plugins. |
| 5 | log-aggregator | framework | Structured logging with pluggable sinks | A structured logging framework. Needs: logger plugin for core log API, formatter plugin for output formatting, buffer plugin for batching, and sink plugin for destination routing. Target: 4 plugins. |
| 6 | rate-limiter | framework | Token bucket rate limiting with policy plugins | A rate limiting framework. Needs: bucket plugin for token management, policy plugin for rate rules, store plugin for counter persistence, and middleware plugin for request interception. Target: 4 plugins. |
| 7 | config-vault | framework | Hierarchical configuration with environment overlays | A configuration management framework. Needs: source plugin for config providers, merger plugin for deep merge logic, validator plugin for schema validation, and watcher plugin for change detection. Target: 4 plugins. |
| 8 | test-harness | framework | Parallel test runner with plugin reporters | A test execution framework. Needs: runner plugin for test lifecycle, matcher plugin for assertion helpers, reporter plugin for output formatting, and fixture plugin for setup/teardown. Target: 4 plugins. |
| 9 | cache-layer | framework | Multi-tier caching with eviction policies | A caching framework. Needs: store plugin for cache storage, policy plugin for eviction rules (LRU/TTL), loader plugin for cache-miss handling, and stats plugin for hit-rate tracking. Target: 4 plugins. |
| 10 | auth-gate | framework | Authentication pipeline with strategy plugins | An authentication framework. Needs: strategy plugin for auth methods, session plugin for state management, guard plugin for route protection, and token plugin for JWT handling. Target: 4 plugins. |
| 11 | metric-collector | framework | Application metrics with aggregation plugins | A metrics collection framework. Needs: counter plugin for numeric metrics, timer plugin for duration tracking, aggregator plugin for windowed stats, and exporter plugin for output formats. Target: 4 plugins. |
| 12 | workflow-engine | framework | Step-based workflow execution with plugin actions | A workflow engine framework. Needs: step plugin for action definitions, flow plugin for step orchestration, condition plugin for branching logic, and history plugin for execution audit trail. Target: 4 plugins. |
| 13 | template-engine | framework | String template rendering with helper plugins | A template rendering framework. Needs: parser plugin for template syntax, context plugin for variable resolution, helper plugin for transform functions, and cache plugin for compiled template storage. Target: 4 plugins. |
| 14 | queue-processor | framework | Job queue with pluggable workers | A job queue processing framework. Needs: queue plugin for job storage, worker plugin for job execution, scheduler plugin for dispatch ordering, and monitor plugin for queue health. Target: 4 plugins. |
| 15 | permission-system | framework | Role-based access control with policy plugins | An RBAC permission framework. Needs: role plugin for role definitions, policy plugin for permission rules, resolver plugin for access decisions, and audit plugin for access logging. Target: 4 plugins. |
| 16 | data-pipeline | framework | ETL pipeline with transform plugins | A data transformation pipeline. Needs: source plugin for data ingestion, transform plugin for processing steps, validator plugin for data quality, and sink plugin for output destinations. Target: 4 plugins. |
| 17 | notification-hub | framework | Multi-channel notification dispatch | A notification dispatch framework. Needs: channel plugin for delivery methods, template plugin for message formatting, queue plugin for send buffering, and preference plugin for user settings. Target: 4 plugins. |
| 18 | search-index | framework | Full-text search with pluggable analyzers | A search indexing framework. Needs: indexer plugin for document ingestion, analyzer plugin for text processing, query plugin for search parsing, and ranker plugin for result scoring. Target: 4 plugins. |
| 19 | feature-flag | framework | Feature flag management with targeting plugins | A feature flag framework. Needs: flag plugin for flag definitions, targeting plugin for user matching rules, evaluator plugin for flag resolution, and tracker plugin for flag usage analytics. Target: 4 plugins. |
| 20 | api-gateway | framework | Request routing with middleware plugins | An API gateway framework. Needs: router plugin for path matching, middleware plugin for request pipeline, transform plugin for request/response shaping, and circuit-breaker plugin for fault tolerance. Target: 4 plugins. |
| 21 | state-machine | framework | Finite state machine with transition plugins | A state machine framework. Needs: machine plugin for state definitions, transition plugin for state change rules, guard plugin for transition conditions, and observer plugin for state change events. Target: 4 plugins. |
| 22 | i18n-toolkit | framework | Internationalization with locale plugins | An i18n framework. Needs: locale plugin for language data, formatter plugin for number/date localization, resolver plugin for key lookup with fallback, and detector plugin for locale detection. Target: 4 plugins. |
| 23 | health-checker | framework | Service health monitoring with probe plugins | A health check framework. Needs: probe plugin for check definitions, scheduler plugin for check intervals, aggregator plugin for overall health status, and reporter plugin for health endpoints. Target: 4 plugins. |
| 24 | migration-runner | framework | Database migration with strategy plugins | A migration framework. Needs: loader plugin for migration file discovery, executor plugin for migration application, tracker plugin for migration state, and rollback plugin for undo logic. Target: 4 plugins. |
| 25 | retry-orchestrator | framework | Configurable retry with backoff plugins | A retry orchestration framework. Needs: policy plugin for retry rules, backoff plugin for delay strategies, circuit plugin for failure thresholds, and logger plugin for attempt tracking. Target: 4 plugins. |
| 26 | schema-registry | framework | Schema versioning with compatibility plugins | A schema registry framework. Needs: registry plugin for schema storage, version plugin for schema evolution, compat plugin for compatibility checks, and codec plugin for serialization. Target: 4 plugins. |
| 27 | session-manager | framework | Session lifecycle with storage plugins | A session management framework. Needs: store plugin for session persistence, lifecycle plugin for create/expire/renew, identity plugin for session-user binding, and cleaner plugin for expired session removal. Target: 4 plugins. |
| 28 | rule-engine | framework | Business rule evaluation with condition plugins | A rule engine framework. Needs: rule plugin for rule definitions, condition plugin for predicate evaluation, action plugin for rule outcomes, and priority plugin for conflict resolution. Target: 4 plugins. |
| 29 | dependency-injector | framework | IoC container with scope plugins | A dependency injection framework. Needs: container plugin for binding registry, scope plugin for lifetime management, resolver plugin for dependency graph resolution, and factory plugin for lazy instantiation. Target: 4 plugins. |
| 30 | circuit-breaker | framework | Fault tolerance with health tracking plugins | A circuit breaker framework. Needs: breaker plugin for open/closed/half-open state, monitor plugin for failure counting, fallback plugin for degraded responses, and recovery plugin for health probing. Target: 4 plugins. |

**Pool rotation**: When all 30 ideas are used, archive the history file as `audit-full-cycle-history-{date}.md` and start fresh.

---

## Auto-Answer Decision Table

When the driver encounters an `AskUserQuestion` gate in a command's text, apply this table. The driver does NOT call `AskUserQuestion` — it logs the gate and applies the decision.

### Default Rule

**Always select option 1** (the first listed option). All moku commands follow the convention of listing the recommended/default option first.

### Command-Specific Overrides

| Command | Gate Description | Selection | Reason |
|---------|-----------------|-----------|--------|
| init | "What type of project?" | "Framework" (option 1) | Always test framework path |
| init | Non-empty directory confirmation | Confirm/continue | CYCLE_TMP may have bootstrap files |
| brainstorm | "Existing context guard" | "Start fresh" (option 2) | Ensure clean brainstorm |
| brainstorm | "What kind of brainstorm?" | "Create" (option 1) | Matches framework creation |
| brainstorm | Discovery questions (scored) | Pick option with highest implied complexity | Gives brainstorm more material to work with |
| plan | Quick-mode offer (`--quick` suggestion) | Accept quick mode | Keeps cycle faster without losing coverage |
| plan | Stage approval gates | Approve (option 1) | Always advance |
| plan | Plan checker findings gate | Proceed (option 1) | Don't block on validation — accept findings as-is for cycle speed |
| plan | Spec validator findings gate | Proceed (option 1) | Same as plan checker — accept and continue |
| build | Skeleton approval gate | Approve (option 1) | Always advance |
| build | Wave judge stop-for-review | Continue building | Don't stop mid-cycle |
| Any | Any "Cancel"/"Dismiss"/"Skip" option | Never select | Would abort the cycle |

### Override Priority

Command-specific overrides take precedence over the default rule. If no override matches, apply the default rule.

---

## Observation Log Schema

The driver writes `$CYCLE_TMP/.planning/cycle-observations.md` with this structure:

```markdown
# Full-Cycle Observation Log

**Project:** {name}
**Type:** {type}
**Description:** {description}
**Started:** {ISO timestamp}

---

## Command: init
**Args simulated:** (default — fresh project)
**Steps executed:** [list of step numbers]

### AskUserQuestion Gates
- Gate 1 (Step N): "{question}" → Selected: "{option}" (rule: {default|override:reason})

### Files Created
- path/to/file (N lines)

### STATE.md Snapshot
(n/a or content)

### Observations
- [any divergence, unexpected behavior, or notable finding]

---

## /moku:next Check (after init)
**STATE.md exists:** yes|no
**Detected state:** {description}
**Routed to:** {command}
**Expected routing:** {command}
**Correct:** yes|no
**Observation:** {notes}

---

## Command: brainstorm
...

## /moku:next Check (after brainstorm)
...

## Command: plan (stage 1)
...

## /moku:next Check (after plan stage 1)
...

## Command: plan (stage 2)
...

## Command: plan (stage 3)
...

## /moku:next Check (after plan complete)
...

## Command: build (skeleton)
...

## Command: build (plugin waves)
...

## /moku:next Check (after build — check 1)
...

## /moku:next Check (after build — check 2)
...

## Command: status
**Full dashboard output:**
(captured output)

### Dashboard Accuracy
- Phase: correct|wrong (expected: X, got: Y)
- Plugin count: correct|wrong
- Wave progress: correct|wrong
- Next action: correct|wrong

---

## Cycle Summary
**Commands completed:** [list]
**Commands failed:** [list with failure point]
**Total AskUserQuestion gates:** N
**Total /moku:next checks:** N (correct: N, wrong: N)
**Total observations:** N
**Completed:** {ISO timestamp}
```

---

## Hook Monitoring Protocol

### Bracket Markers

The orchestrating command writes timestamp bracket markers to `.planning/diagnostics.log`:

```
=== FULL-CYCLE-START {HH:MM:SS} [{project-name}] ===
... cycle entries ...
=== FULL-CYCLE-END {HH:MM:SS} [{project-name}] ===
```

### Extraction

After the driver completes, extract cycle-specific entries:
```bash
awk "/=== FULL-CYCLE-START.*\[${PROJECT_NAME}\] ===/,/=== FULL-CYCLE-END.*\[${PROJECT_NAME}\] ===/" .planning/diagnostics.log > "$CYCLE_TMP/.planning/cycle-diagnostics.log"
```

### Classification Rules (for reviewers)

| Entry Category | Expected During Cycle? | If Unexpected |
|---|---|---|
| PERM-DENY | Rare — most writes go through Bash | Flag as hook false-positive if it blocked a legitimate workflow step |
| ANTIPATTERN | Possible during build steps | Check if the blocked pattern was correct for the context |
| INDEX-RULE | Expected during build | Should only fire for plugin index.ts files |
| TOOL-FAIL | Uncommon | Flag the failing tool and error pattern |
| STOP-BLOCK | Should not occur (driver has no Stop hook) | Flag as anomaly |
| STRUCTURE | Expected during build | Verify it matched a real structural issue |

### Limitation

Hook diagnostics require `.planning/STATE.md` to exist in the working project (the project from which `/moku:audit full-cycle` is run). If run from a directory without STATE.md, hook logging may be incomplete. The orchestrator should warn if no STATE.md exists.

---

## Finding Type Taxonomy (for reviewers)

| Type | Description |
|------|-------------|
| `ux-gap` | Missing guidance, confusing output, unclear next step after a command |
| `integration-bug` | STATE.md inconsistency between commands, broken data handoff |
| `hook-false-positive` | Hook blocked a legitimate moku workflow operation |
| `hook-gap` | Operation that should have been guarded by a hook but wasn't |
| `output-quality` | Spec, skeleton, or brainstorm output is implausible or incomplete |
| `routing-error` | `/moku:next` routed to wrong command for the current state |
| `state-inconsistency` | STATE.md content doesn't match actual project state on disk |
| `silent-failure` | Command step failed but no user-visible error or guidance |
| `missing-recovery` | No path forward after a failure — user is stuck |

---

## History File Format

`.planning/audit-full-cycle-history.md`:

```markdown
# Full-Cycle Audit History

| Date | Project | Type | Description | Findings | Completed |
|------|---------|------|-------------|----------|-----------|
| 2026-03-23 | task-scheduler | framework | Plugin-based task scheduling | 3B/5W | yes |
```
