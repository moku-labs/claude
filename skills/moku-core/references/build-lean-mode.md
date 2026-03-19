# Build: Lean Execution Mode (Taskmaster)

Lean mode strips verbose context from agent prompts and orchestrator output during builds. This conserves the context window, enabling more waves per session before compaction.

## Context Budget Problem

A typical build session consumes context from:

| Source | Normal Mode | Lean Mode | Savings |
|--------|------------|-----------|---------|
| Builder agent prompts (per plugin) | ~800 tokens | ~350 tokens | ~56% |
| Builder output contracts | ~300 tokens | ~150 tokens | ~50% |
| Verification agent prompts | ~500 tokens | ~250 tokens | ~50% |
| Progress updates to user | ~100 tokens/wave | ~30 tokens/wave | ~70% |
| Gap closure diagnostician prompts | ~600 tokens | ~300 tokens | ~50% |
| Wave judge prompts | ~400 tokens | ~200 tokens | ~50% |

For a 5-wave project with 12 plugins, lean mode saves ~40-60% of context, translating to 2-3 additional waves before compaction triggers.

## Activation

Lean mode activates when ANY of these are true:
1. `leanMode: true` in `.claude/moku.local.md` project config
2. `--lean` flag passed to `/moku:build`
3. **Auto-lean**: Context usage exceeds 40% at wave start (checked via conversation length heuristic: if 3+ waves have completed in this session, auto-activate lean mode for remaining waves)

Lean mode is persisted in STATE.md as `## LeanMode: true` so it carries across resumes.

## What Gets Stripped

### 1. Builder Agent Prompts (Biggest Win)

**Normal prompt includes:**
- Full spec file (~200-400 lines)
- Full config.ts contents
- Full dependency plugin index.ts contents
- Full TDD protocol reference
- Full build rules list
- Full output contract schema with examples
- Full verification criteria

**Lean prompt includes:**
- **Spec extract** — only these sections: `## Overview` (tier + description), `## Config` (type shape), `## API` (method signatures), `## Events` (if any), `## Dependencies` (names only). Skip: Testing Strategy, Communication, Package Dependencies, Code Example, Verification (builder doesn't need these — verifier handles them).
- **Config.ts extract** — only the `export type Config` and `export type Events` blocks, not the full file
- **Dependency interfaces** — only `export type Api` from each dependency's types.ts, not the full index.ts
- **Build rules** — compressed to single line: `"Tier [tier]. TDD: types→red→green→refactor. No explicit generics. import type. JSDoc. Tests in __tests/."`
- **TDD protocol** — omit the reference read. Builder already has the skill loaded. One-line summary: `"TDD: Phase 1 types+skeleton → Phase 2 write failing tests → Phase 3 implement to pass → Phase 4 refactor."`
- **Output contract** — schema only (no examples, no field descriptions). Builder knows the format from prior waves.
- **Verification criteria** — omitted entirely. Builder focuses on building; verifier checks criteria.

**Lean builder prompt template:**
```
Build Moku plugin [name] ([tier]). TDD. No explicit generics. import type. JSDoc. Tests in __tests/.

## Spec
[Overview paragraph]
Config: [type shape from spec]
API: [method signatures from spec]
Events: [event names + payloads, or "None"]
Depends: [plugin names, or "None"]

## Types Context
[Config + Events type blocks from src/config.ts]

## Dep Interfaces
[export type Api from each dependency types.ts]

## Decisions
[Relevant decision-log entries, or omit section]

## Output
End with JSON: {agent, plugin, verdict, tdd:{red/green counts}, intent:{per-file}, filesCreated, testsPass, lintPass, issues}
```

### 2. Verification Agent Prompts

**Normal:** Full git diff + full specs for all plugins in wave + full builder intent summaries.

**Lean:**
- **Verifier**: Plugin directory list only (it reads files itself). One-line instruction: `"Verify [plugin-list]: L1 files exist, L2 real impl, L3 wired+lint+tests."`
- **Code reviewer**: Diff summary (files changed, not full diff — reviewer reads files itself) + spec API/Events sections only + intent summaries (keep — these are small and high-value).

### 3. Progress Updates

**Normal:**
```
Wave 2: Building router [Standard], content [Standard] (2 plugins in parallel)...
router built (PASS). 1 plugin remaining in wave.
content built (PASS). 0 plugins remaining in wave.
Wave 2 verification: 2/2 pass. No gap closure needed.
Integration checks pass.
```

**Lean:**
```
W2: router,content → PASS. Verified. Integration OK.
```

Single line per wave. Details only on failure.

### 4. Gap Closure Diagnostician Prompts

**Normal:** Full error output + full spec + full strategy log.

**Lean:**
- Error output: first 20 lines only (root cause is usually in the first few errors)
- Spec: only the section relevant to the error (e.g., if type error in api.ts → only `## API` section)
- Strategy log: last 2 entries only (most recent strategies are what matter for diversity check)

### 5. Wave Judge Prompts

**Normal:** Full verification results + full code review findings + full gap closure history + full integration output.

**Lean:**
- Verification: verdict + blocker count only
- Code review: pass summary (per-pass blocker/finding counts, not individual findings)
- Gap closure: rounds count + final error count only
- Integration: pass/fail only

### 6. Orchestrator Internal Context

**Normal:** The orchestrating agent (main conversation) accumulates full output from every sub-agent.

**Lean:** After processing each agent's output contract JSON, discard the prose report. Keep only:
- The JSON output contract (structured, compact)
- A one-line summary for the user
- Error details only if verdict is FAIL

## What Is NEVER Stripped

Even in lean mode, preserve:
- **Output contract JSON blocks** — these are the machine-readable interface between agents. Always full.
- **Error messages** — when something fails, full error context is needed for diagnosis
- **Decision log entries** — small, high-value, prevent regressions
- **Intent summaries** — small, high-value for code review
- **STATE.md updates** — cross-session continuity is sacred
- **Git checkpoints** — safety-critical

## Lean Mode Config

Add to project configuration:

| Setting | Type | Range | Default |
|---------|------|-------|---------|
| `leanMode` | boolean / "auto" | true/false/"auto" | "auto" |

- `true`: Always lean
- `false`: Always verbose
- `"auto"` (default): Activate lean mode when 3+ waves complete in one session or context > 40%

## Integration with Other Features

- **Wave pipelining + lean mode**: Ideal combination. Pipelining doubles active agents; lean mode halves their context cost. Net effect: pipelining works for more waves before context exhaustion.
- **Interactive triage + lean mode**: Triage is user-facing — it is NOT stripped. Findings are still presented one-by-one.
- **Multi-pass review + lean mode**: Review passes are internal to the code-reviewer agent. In lean mode, the reviewer still runs all 4 passes but reports only pass-level summaries to the orchestrator (not individual findings unless they're BLOCKERs).
- **TDD + lean mode**: TDD protocol runs inside the builder agent's own context. Lean mode strips the *prompt* sent to the agent, not the agent's internal execution. TDD still runs fully.

## Spec Extract Helper

When constructing lean builder prompts, extract spec sections programmatically:

```bash
# Extract specific sections from a spec file
# Returns content between ## SectionName and the next ## header
grep -A 100 "^## Config" .planning/specs/03-router.md | sed '/^## [^C]/,$d'
grep -A 100 "^## API" .planning/specs/03-router.md | sed '/^## [^A]/,$d'
grep -A 100 "^## Events" .planning/specs/03-router.md | sed '/^## [^E]/,$d'
```

Or use Read tool with line offsets targeting the relevant section.
