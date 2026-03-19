# Decision Knowledge Graph

A structured log of "Chose X over Y because Z" decisions made during planning and building. Future agents consult this to understand WHY code is shaped a certain way — preventing them from undoing intentional choices or re-litigating settled trade-offs.

## Why This Matters

Without decision context, agents encounter code and ask "why is this done this way?" They may:
- "Fix" something that was an intentional trade-off
- Re-propose an approach that was already tried and rejected
- Miss constraints that shaped the original decision

The decision log prevents this by making trade-off reasoning explicit and queryable.

## Decision Log Location

**File:** `.planning/decision-log.md`

This file persists across sessions and is read by agents before making changes.

## Decision Entry Format

Each decision is a markdown section:

```markdown
## [YYYY-MM-DD] [scope] — [short title]
- **Chose**: [what was chosen — the approach, pattern, or value]
- **Over**: [what was rejected — the alternative(s) considered]
- **Because**: [why — the reasoning, constraints, or trade-offs that drove the choice]
- **Context**: [where this applies — file paths, plugin names, or patterns]
- **Phase**: [planning | build-wave-N | gap-closure | conflict-resolution | manual]
- **Reversible**: [yes | no | with-effort] — can this be changed later without major rework?
```

## When to Record Decisions

### During Planning (plan command)

Record when:
- **Steering Pre-Phase**: User's scope boundaries, MVP choices, and risk assessments
- **Stage 1**: Plugin identification — why a concept became a plugin vs. a sub-module, why a specific tier was chosen, why two domains were merged or kept separate
- **Stage 2**: Spec decisions — why a specific API shape was chosen, why events were structured a certain way, why a dependency direction was chosen
- **Stage 3**: Skeleton decisions — why a specific file structure was chosen, barrel export strategy

**Example — planning decision:**
```markdown
## 2025-07-15 planning — Router uses event-driven navigation over direct state mutation
- **Chose**: router emits `router:navigated` event, listeners update their own state
- **Over**: router directly calls `renderer.update()` via dependency
- **Because**: Decouples router from renderer — other plugins (analytics, prefetch) can listen too. User confirmed "plugin ecosystem for third parties" as a constraint.
- **Context**: src/plugins/router/ and all navigation-aware plugins
- **Phase**: planning
- **Reversible**: with-effort — would require changing all navigation listeners
```

### During Building (build command)

Record when:
- **Conflict resolution**: Trade-off decisions between disagreeing validators (automatically recorded by build-conflict-resolution.md)
- **Gap closure**: When the error-diagnostician chooses between multiple fix approaches
- **Alternative strategy**: When a stuck-loop forces a fundamentally different approach — record what was abandoned and what replaced it
- **Implementation choices**: When the builder agent makes a non-obvious choice (e.g., using a Map instead of an object for state, choosing sync over async for an API method)

**Example — build decision:**
```markdown
## 2025-07-16 build-wave-2 — Cache plugin uses WeakMap for entry storage
- **Chose**: WeakMap<object, CacheEntry> for cache entries
- **Over**: Map<string, CacheEntry> with manual eviction
- **Because**: Automatic garbage collection when keys are dereferenced. Prevents memory leaks in long-running apps. Trade-off: no iteration/size — acceptable since cache.list() was not in the spec.
- **Context**: src/plugins/cache/state.ts
- **Phase**: build-wave-2
- **Reversible**: yes — swap WeakMap for Map if iteration needed later
```

### During Manual Review

Record when:
- User makes a judgment call during interactive triage (from build-findings-triage.md)
- User overrides a wave judge recommendation
- User manually fixes a `needs-manual` plugin and explains why

## How Agents Use the Decision Log

### Before Making Changes

When an agent is about to modify a file, it should check the decision log for entries mentioning that file or plugin:

```
Grep `.planning/decision-log.md` for the plugin name and file path.
If entries found → read them before proposing changes.
If a proposed change contradicts a recorded decision → flag the conflict to the user:
  "This change conflicts with a previous decision: [title]. Proceed anyway?"
```

### During Gap Closure

The error-diagnostician receives relevant decision log entries as context:
- Entries matching the plugin being fixed
- Entries from the same wave
- Entries tagged as `Reversible: no` (hard constraints that must not be violated)

### During Planning (Updates)

When `/moku:plan update` runs, load all decision log entries for the target plugin. The planner should:
- Preserve decisions tagged `Reversible: no`
- Flag decisions tagged `Reversible: with-effort` that would be affected by the update
- Allow reversal of decisions tagged `Reversible: yes` without special notice

## Decision Log Template

```markdown
# Decision Log

Structured record of trade-off decisions. Agents consult this before making changes.

<!-- Newest entries at the top -->

## [YYYY-MM-DD] [scope] — [short title]
- **Chose**: [approach]
- **Over**: [alternative]
- **Because**: [reasoning]
- **Context**: [file paths, plugin names]
- **Phase**: [planning | build-wave-N | gap-closure | conflict-resolution | manual]
- **Reversible**: [yes | no | with-effort]
```

## Querying the Decision Log

Agents can query the log by:
- **File path**: `grep "Context:.*router" .planning/decision-log.md` — all decisions affecting the router
- **Phase**: `grep "Phase:.*build-wave-2" .planning/decision-log.md` — all Wave 2 decisions
- **Irreversible**: `grep "Reversible:.*no" .planning/decision-log.md` — hard constraints
- **Scope**: section headers contain the scope (planning, build-wave-N, etc.)

## Housekeeping

- The decision log grows over the project lifetime — this is intentional
- Do NOT prune entries unless the decision is explicitly reversed (record the reversal as a new entry instead)
- When a decision is reversed, add `**Reversed**: [date] — [new decision title]` to the original entry
- The log is NOT a changelog — it records WHY, not WHAT. The git log records WHAT.
