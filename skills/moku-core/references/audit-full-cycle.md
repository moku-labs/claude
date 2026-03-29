# Full-Cycle Audit — Reference

Shared rules, decision tables, and templates for the `/moku:audit full-cycle` mode and its agents.

---

## Overview

The full-cycle audit drives the complete moku workflow (init → brainstorm → plan → build → next → status) in a real temp project to validate end-to-end behavior. A driver agent reads each command file and applies its steps manually, auto-answering all user gates. Two reviewer agents then analyze the results.

---

## Project Idea Pool

The orchestrator picks an unused idea from this pool. Track used ideas in `.planning/audit-full-cycle-history.md`.

Each project MUST use a mix of plugin complexity tiers to exercise all code paths. Every project should include at least one core plugin (Nano/Micro via `createCorePlugin`) and a range of regular plugins (Micro through Complex). The brainstorm description must specify the tier for each plugin explicitly.

| # | Name | Type | Description | Brainstorm Description |
|---|------|------|-------------|----------------------|
| 1 | task-scheduler | framework | Plugin-based task scheduling with cron and retry support | A TypeScript task scheduling framework using moku plugins. Needs: env core plugin (Nano — environment detection), job-registry plugin (Standard — registration, config, state, API, events, handlers for job lifecycle hooks), cron-parser plugin (Micro — pure parsing logic, no state), retry plugin (Standard — retry policies with backoff state and circuit tracking), persistence plugin (Complex — durable storage with multiple backends, sub-domain for serialization). Target: 5 plugins, mixed tiers Nano→Complex. |
| 2 | color-pipeline | framework | Image color processing pipeline with filter chain | A color processing pipeline framework. Needs: constants core plugin (Nano — color space constants and lookup tables), color-space plugin (Standard — RGB/HSL/CMYK conversion with state tracking), filter-chain plugin (Complex — composable transform pipeline with sub-domains for built-in filters and custom filter registry), histogram plugin (Micro — stateless analysis functions), output plugin (Standard — format export with config-driven encoder selection). Target: 5 plugins, mixed tiers Nano→Complex. |
| 3 | event-bridge | framework | Cross-process event bus with transport plugins | An event bridge framework. Needs: logger core plugin (Nano — structured log API), channel plugin (Standard — topic management with subscription state), memory-transport plugin (Micro — simple in-process pub/sub, no external deps), serializer plugin (Standard — message encoding with format negotiation and schema validation), router plugin (Complex — topic-based dispatch with pattern matching, dead-letter handling, and retry sub-domain). Target: 5 plugins, mixed tiers Nano→Complex. |
| 4 | form-validator | framework | Schema-driven form validation with plugin rules | A form validation framework. Needs: locale core plugin (Nano — current locale string), schema plugin (Standard — field definitions with type inference and nested object support), rules plugin (Complex — validation logic with built-in validators sub-domain, async validator support, conditional rules, cross-field validation), messages plugin (Micro — i18n error text lookup, no state), reporter plugin (Standard — error aggregation with grouping strategies and severity levels). Target: 5 plugins, mixed tiers Nano→Complex. |
| 5 | log-aggregator | framework | Structured logging with pluggable sinks | A structured logging framework. Needs: clock core plugin (Nano — timestamp provider), levels plugin (Micro — log level filtering, config-only), formatter plugin (Standard — output formatting with templates and structured JSON mode), buffer plugin (Standard — batching with flush-on-threshold and flush-on-interval, needs onStart/onStop), sink plugin (Complex — destination routing with file, console, HTTP sub-domains and per-sink error handling). Target: 5 plugins, mixed tiers Nano→Complex. |
| 6 | rate-limiter | framework | Token bucket rate limiting with policy plugins | A rate limiting framework. Needs: time core plugin (Nano — monotonic clock for token calculations), bucket plugin (Standard — token management with sliding window and fixed window modes), policy plugin (Complex — rate rules with per-route, per-user, and global policies, burst allowance sub-domain, quota tracking), store plugin (Micro — in-memory counter storage, simple Map state), middleware plugin (Standard — request interception with header injection and retry-after calculation). Target: 5 plugins, mixed tiers Nano→Complex. |
| 7 | config-vault | framework | Hierarchical configuration with environment overlays | A configuration management framework. Needs: env core plugin (Nano — process.env wrapper), source plugin (Standard — config providers for file, env, and remote with priority ordering), merger plugin (Micro — deep merge logic, stateless pure function), validator plugin (Standard — schema validation with custom rule support and error reporting), watcher plugin (Complex — change detection with polling and event-driven sub-domains, debounced reload, rollback on validation failure). Target: 5 plugins, mixed tiers Nano→Complex. |
| 8 | test-harness | framework | Parallel test runner with plugin reporters | A test execution framework. Needs: id core plugin (Nano — unique test run ID generator), runner plugin (Complex — test lifecycle with parallel execution, timeout handling, retry sub-domain, and test isolation), matcher plugin (Micro — assertion helpers, pure functions, no state), reporter plugin (Standard — output formatting with TAP, JSON, and console modes, progress tracking state), fixture plugin (Standard — setup/teardown with async resource management, needs onStart/onStop for global fixtures). Target: 5 plugins, mixed tiers Nano→Complex. |
| 9 | cache-layer | framework | Multi-tier caching with eviction policies | A caching framework. Needs: hash core plugin (Nano — consistent hash function for cache keys), store plugin (Standard — cache storage with get/set/delete, TTL tracking, size limits), policy plugin (Complex — eviction rules with LRU, LFU, TTL sub-domains, adaptive policy selection, and promotion/demotion between tiers), loader plugin (Micro — cache-miss callback handler, stateless delegation), stats plugin (Standard — hit-rate tracking with windowed counters, needs onStart for periodic stat flush). Target: 5 plugins, mixed tiers Nano→Complex. |
| 10 | auth-gate | framework | Authentication pipeline with strategy plugins | An authentication framework. Needs: crypto core plugin (Nano — hash and comparison utilities), strategy plugin (Complex — auth methods with local, OAuth, API-key sub-domains, strategy chain with fallthrough, and MFA support), session plugin (Standard — state management with creation/expiry/renewal and storage abstraction), guard plugin (Micro — route protection, stateless middleware-style check), token plugin (Standard — JWT handling with signing, verification, refresh rotation, needs onStart for key loading). Target: 5 plugins, mixed tiers Nano→Complex. |
| 11 | metric-collector | framework | Application metrics with aggregation plugins | A metrics collection framework. Needs: clock core plugin (Nano — high-resolution timestamp provider), counter plugin (Micro — simple numeric increment/decrement, minimal state), timer plugin (Standard — duration tracking with percentile calculation and histogram buckets), aggregator plugin (Complex — windowed stats with tumbling and sliding windows, rollup sub-domain, cross-metric correlation), exporter plugin (Standard — output formats with Prometheus, JSON, and StatsD modes, needs onStart/onStop for push-based export intervals). Target: 5 plugins, mixed tiers Nano→Complex. |
| 12 | workflow-engine | framework | Step-based workflow execution with plugin actions | A workflow engine framework. Needs: id core plugin (Nano — workflow instance ID generation), step plugin (Standard — action definitions with typed input/output, timeout support, retry policy per step), flow plugin (Complex — step orchestration with sequential, parallel, and conditional execution sub-domains, DAG validation, dead-path elimination), condition plugin (Micro — branching logic, pure predicate evaluation), history plugin (Standard — execution audit trail with step-level logging, needs onStop to flush pending entries). Target: 5 plugins, mixed tiers Nano→Complex. |
| 13 | template-engine | framework | String template rendering with helper plugins | A template rendering framework. Needs: escape core plugin (Nano — HTML/URL escape utilities), parser plugin (Standard — template syntax tokenizer with block and expression support, compile-to-AST), context plugin (Micro — variable resolution with dot-path access, stateless lookup), helper plugin (Complex — transform functions with built-in helpers sub-domain, custom helper registration, async helper pipeline, helper argument parsing), cache plugin (Standard — compiled template storage with LRU eviction, needs onStop to persist cache to disk). Target: 5 plugins, mixed tiers Nano→Complex. |
| 14 | queue-processor | framework | Job queue with pluggable workers | A job queue processing framework. Needs: id core plugin (Nano — job ID generation), queue plugin (Standard — job storage with priority queue, dead-letter support, and delayed job scheduling), worker plugin (Complex — job execution with concurrency control, worker pool sub-domain, graceful shutdown, and per-job timeout), scheduler plugin (Micro — dispatch ordering logic, stateless priority comparator), monitor plugin (Standard — queue health with depth tracking, throughput stats, stall detection, needs onStart for periodic health checks). Target: 5 plugins, mixed tiers Nano→Complex. |
| 15 | permission-system | framework | Role-based access control with policy plugins | An RBAC permission framework. Needs: constants core plugin (Nano — permission bit flags and role enums), role plugin (Standard — role definitions with hierarchy support and inheritance resolution), policy plugin (Complex — permission rules with attribute-based conditions sub-domain, deny-override evaluation, and wildcard matching), resolver plugin (Micro — access decision function, stateless evaluate-and-return), audit plugin (Standard — access logging with structured entries, needs onStop to flush audit buffer). Target: 5 plugins, mixed tiers Nano→Complex. |
| 16 | data-pipeline | framework | ETL pipeline with transform plugins | A data transformation pipeline. Needs: schema core plugin (Nano — field type registry), source plugin (Standard — data ingestion with file, HTTP, and stream readers, backpressure handling), transform plugin (Complex — processing steps with map, filter, aggregate sub-domains, parallel transform chains, and error-row routing), validator plugin (Micro — data quality checks, stateless predicate functions), sink plugin (Standard — output destinations with file, database, and console writers, needs onStart/onStop for connection management). Target: 5 plugins, mixed tiers Nano→Complex. |
| 17 | notification-hub | framework | Multi-channel notification dispatch | A notification dispatch framework. Needs: template core plugin (Nano — simple string interpolation for notification bodies), channel plugin (Complex — delivery methods with email, SMS, push, webhook sub-domains, per-channel rate limiting, and delivery tracking), template plugin (Standard — message formatting with rich templates, layout composition, and per-channel rendering), queue plugin (Micro — send buffering, simple in-memory FIFO), preference plugin (Standard — user notification settings with channel opt-in/out and quiet hours, needs onStart to load preferences). Target: 5 plugins, mixed tiers Nano→Complex. |
| 18 | search-index | framework | Full-text search with pluggable analyzers | A search indexing framework. Needs: tokenizer core plugin (Nano — whitespace and punctuation splitting), indexer plugin (Standard — document ingestion with inverted index construction and incremental updates), analyzer plugin (Complex — text processing with stemming, stop-words, synonym expansion, and language-specific sub-domains), query plugin (Micro — search query parsing, stateless AST builder), ranker plugin (Standard — result scoring with TF-IDF, BM25, and field boosting, needs onStart to precompute IDF values). Target: 5 plugins, mixed tiers Nano→Complex. |
| 19 | feature-flag | framework | Feature flag management with targeting plugins | A feature flag framework. Needs: hash core plugin (Nano — consistent hashing for percentage rollouts), flag plugin (Standard — flag definitions with boolean, multivariate, and experiment types), targeting plugin (Complex — user matching rules with segment definitions sub-domain, percentage rollout, user attribute matching, and override lists), evaluator plugin (Micro — flag resolution, stateless evaluate function), tracker plugin (Standard — flag usage analytics with impression counting and A/B metrics, needs onStop to flush tracked events). Target: 5 plugins, mixed tiers Nano→Complex. |
| 20 | api-gateway | framework | Request routing with middleware plugins | An API gateway framework. Needs: logger core plugin (Nano — request logging utilities), router plugin (Standard — path matching with parametric routes, method filtering, and route grouping), middleware plugin (Complex — request pipeline with auth, CORS, rate-limit, and compression sub-domains, ordered middleware chain, and error middleware), transform plugin (Micro — request/response shaping, stateless header/body mappers), circuit-breaker plugin (Standard — fault tolerance with open/closed/half-open states, health probing, needs onStart for health check intervals). Target: 5 plugins, mixed tiers Nano→Complex. |
| 21 | state-machine | framework | Finite state machine with transition plugins | A state machine framework. Needs: id core plugin (Nano — machine instance ID generation), machine plugin (Standard — state definitions with entry/exit actions and context data), transition plugin (Complex — state change rules with guarded transitions, hierarchical states sub-domain, parallel regions, and history states), guard plugin (Micro — transition conditions, pure predicate evaluation), observer plugin (Standard — state change events with middleware-style before/after hooks, needs onStart to register global observers). Target: 5 plugins, mixed tiers Nano→Complex. |
| 22 | i18n-toolkit | framework | Internationalization with locale plugins | An i18n framework. Needs: plurals core plugin (Nano — CLDR plural rule functions), locale plugin (Standard — language data with message catalogs, namespace scoping, and lazy loading), formatter plugin (Complex — number/date/currency localization with ICU message format sub-domain, relative time, and list formatting), resolver plugin (Micro — key lookup with dot-path access and fallback chain, stateless), detector plugin (Standard — locale detection from headers, cookies, URL, and user preference, needs onStart to initialize detection chain). Target: 5 plugins, mixed tiers Nano→Complex. |
| 23 | health-checker | framework | Service health monitoring with probe plugins | A health check framework. Needs: constants core plugin (Nano — health status enums: healthy/degraded/unhealthy), probe plugin (Standard — check definitions with HTTP, TCP, and custom probe types, timeout handling), scheduler plugin (Complex — check intervals with adaptive frequency sub-domain, jitter, backoff on failure, and dependency-aware ordering), aggregator plugin (Micro — overall health status from probe results, stateless reducer), reporter plugin (Standard — health endpoints with JSON and Prometheus formats, status page rendering, needs onStart to bind health endpoint). Target: 5 plugins, mixed tiers Nano→Complex. |
| 24 | migration-runner | framework | Database migration with strategy plugins | A migration framework. Needs: checksum core plugin (Nano — file hash for migration integrity checks), loader plugin (Standard — migration file discovery with glob patterns, sort-by-timestamp, and duplicate detection), executor plugin (Complex — migration application with transaction wrapping, dry-run mode, batch execution sub-domain, and concurrent migration locking), tracker plugin (Micro — migration state tracking, simple applied/pending status), rollback plugin (Standard — undo logic with dependency-aware reverse ordering, needs onStart to acquire migration lock, onStop to release). Target: 5 plugins, mixed tiers Nano→Complex. |
| 25 | retry-orchestrator | framework | Configurable retry with backoff plugins | A retry orchestration framework. Needs: jitter core plugin (Nano — random jitter calculation for backoff), policy plugin (Standard — retry rules with max attempts, retryable error matching, and per-operation overrides), backoff plugin (Complex — delay strategies with exponential, linear, polynomial, and custom function sub-domains, decorrelated jitter, and circuit-aware backoff), circuit plugin (Micro — failure threshold tracking, simple counter-based open/close), logger plugin (Standard — attempt tracking with structured per-attempt logs, needs onStop to flush final attempt records). Target: 5 plugins, mixed tiers Nano→Complex. |
| 26 | schema-registry | framework | Schema versioning with compatibility plugins | A schema registry framework. Needs: hash core plugin (Nano — schema fingerprint computation), registry plugin (Standard — schema storage with versioned entries, subject-schema binding, and lookup-by-fingerprint), version plugin (Complex — schema evolution with forward, backward, full compatibility checks, diff computation sub-domain, and migration path generation), compat plugin (Micro — compatibility check function, stateless comparator), codec plugin (Standard — serialization with JSON, Avro, and Protobuf codec support, needs onStart to preload codec libraries). Target: 5 plugins, mixed tiers Nano→Complex. |
| 27 | session-manager | framework | Session lifecycle with storage plugins | A session management framework. Needs: id core plugin (Nano — cryptographically random session ID generation), store plugin (Standard — session persistence with in-memory and external storage adapters, TTL enforcement), lifecycle plugin (Complex — create/expire/renew with sliding expiration, absolute expiration, idle timeout sub-domains, and concurrent session limits), identity plugin (Micro — session-user binding, stateless lookup/attach), cleaner plugin (Standard — expired session removal with batch cleanup, needs onStart for periodic sweep interval, onStop to run final cleanup). Target: 5 plugins, mixed tiers Nano→Complex. |
| 28 | rule-engine | framework | Business rule evaluation with condition plugins | A rule engine framework. Needs: operators core plugin (Nano — comparison operator registry: eq, gt, lt, contains, regex), rule plugin (Standard — rule definitions with typed fact schema, rule groups, and salience ordering), condition plugin (Complex — predicate evaluation with nested AND/OR/NOT trees, fact path expressions sub-domain, temporal conditions, and external data lookups), action plugin (Micro — rule outcome execution, stateless action dispatch), priority plugin (Standard — conflict resolution with salience scoring, recency weighting, and specificity ranking, needs onStart to index rules for fast evaluation). Target: 5 plugins, mixed tiers Nano→Complex. |
| 29 | dependency-injector | framework | IoC container with scope plugins | A dependency injection framework. Needs: tags core plugin (Nano — binding tag constants and metadata keys), container plugin (Standard — binding registry with named and tagged bindings, circular dependency detection), scope plugin (Complex — lifetime management with singleton, transient, request, and custom scope sub-domains, scope hierarchy, and disposal tracking), resolver plugin (Micro — dependency graph resolution, stateless topological sort), factory plugin (Standard — lazy instantiation with async factory support, needs onStart to eagerly resolve singletons, onStop to dispose all managed instances). Target: 5 plugins, mixed tiers Nano→Complex. |
| 30 | circuit-breaker | framework | Fault tolerance with health tracking plugins | A circuit breaker framework. Needs: timer core plugin (Nano — timeout and delay utilities), breaker plugin (Standard — open/closed/half-open state machine with configurable thresholds and success/failure counters), monitor plugin (Complex — failure counting with sliding window, leaky bucket, and consecutive failure sub-domains, per-operation metrics, and anomaly detection), fallback plugin (Micro — degraded response provider, stateless fallback function selection), recovery plugin (Standard — health probing with configurable probe intervals, gradual traffic restoration, needs onStart for probe scheduling, onStop to cancel pending probes). Target: 5 plugins, mixed tiers Nano→Complex. |

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
| brainstorm | Discovery questions (scored, single-select) | Pick option with highest implied complexity | Gives brainstorm more material to work with |
| brainstorm | Discovery questions (scored, multiselect) | Select the subset consistent with the project description — do not select options that contradict the domain solely to maximize complexity | Domain-appropriate answers produce better brainstorm output than artificially inflated scores |
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

The orchestrating command writes timestamp bracket markers to `.planning/build/diagnostics.log`:

```
=== FULL-CYCLE-START {HH:MM:SS} [{project-name}] ===
... cycle entries ...
=== FULL-CYCLE-END {HH:MM:SS} [{project-name}] ===
```

### Extraction

After the driver completes, extract cycle-specific entries:
```bash
awk "/=== FULL-CYCLE-START.*\[${PROJECT_NAME}\] ===/,/=== FULL-CYCLE-END.*\[${PROJECT_NAME}\] ===/" .planning/build/diagnostics.log > "$CYCLE_TMP/.planning/cycle-diagnostics.log"
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

### Limitations

1. **STATE.md dependency:** Hook diagnostics require `.planning/STATE.md` to exist in the working project (the project from which `/moku:audit full-cycle` is run). If run from a directory without STATE.md, hook logging may be incomplete. The orchestrator should warn if no STATE.md exists.

2. **No hook coverage in temp project:** The full-cycle driver operates in a temp directory (`/tmp/moku-full-cycle-*/`) that has no `.claude/settings.local.json` and no hook configuration. This means **zero hook events fire during the cycle** — anti-pattern violations (wrong field names, missing events, incorrect imports) in generated code are not caught by the hook system. Reviewers must manually inspect generated code for structural violations that hooks would normally catch in a real project environment. **Reviewers should report zero hook entries as expected** when the cycle runs in a fresh temp project — do not treat it as an anomaly requiring investigation. Set `hook_analysis.notes` to "Expected — temp project has no hook config (limitation #2)".

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
