# Moku Memory & Multi-Session Resumability

Moku is heavily resume-based: brainstorm → plan → build run across many sessions, with
context compaction in between. This doc defines the durable layer that survives compaction
and lets a cold session rehydrate fast.

## The durable layer (`.planning/`)

`.planning/` is the project's **cross-compaction memory** — it persists what conversation context
cannot. It is local-only and gitignored. Treat these as the source of truth on resume:

| File | Role | Lifetime |
|------|------|----------|
| `STATE.md` | Current phase/verb/target/skeleton + the **Recovery** block + plugin tables | rewritten every wave; removed by `/moku:clean` (unless `--keep state`) |
| `learnings.md` | Durable architecture learnings across sessions | **kept by `/moku:clean`** |
| `decisions.md` | Decision knowledge graph ("Chose X over Y because Z") | **kept by `/moku:clean`** |
| `steering.md` | Scope boundaries / MVP priorities / risk / CI-CD choices | **kept by `/moku:clean`** |
| `history.md` | Minimal newest-first trace of each cleaned cycle (what was done / decided / ideas used) — written by `/moku:clean` | **kept by `/moku:clean`** |
| `specs/`, `skeleton-spec.md` | What to build | per project; removed by `/moku:clean` (unless `--keep specs`) |
| `context-*.md` | Brainstorm output feeding plan | per brainstorm; removed by `/moku:clean` (unless `--keep context`) |
| `archive/cycle-N/` | Build-cycle snapshots (specs/STATE/coverage) | per build cycle; removed by `/moku:clean` (unless `--keep archive`) |
| `build/agent-log.md` | Recent agent outcomes | ephemeral |
| `memory/` (optional) | Free-form agent memory (see below) | per project |

> **The durable set `/moku:clean` always keeps:** `learnings.md`, `decisions.md`, `steering.md`,
> `history.md`. Before deleting the ephemeral artifacts, `/moku:clean` distills a minimal trace of
> the cycle into `history.md` so the next iteration inherits "what was done, what was decided, what
> ideas were used" without the heavy `archive/` snapshots. See `commands/clean.md`.

Anthropic's guidance (context-editing + server-side compaction): persist anything critical to a
durable store so it survives compaction boundaries — for moku that store **is `.planning/`**. Do not
rely on conversation history to remember wave progress; write it to `STATE.md`.

## The Recovery block (fast cold-start)

`STATE.md` carries a `## Recovery` block (see `plan-templates.md`) optimized for one-read
rehydration:

```
## Recovery
- Last good step: Plugin wave 1 (router, auth) verified
- Open blockers: none
- Next action: /moku:build resume
- Updated: 2026-05-29T12:00:00Z
```

**Producers** (`/moku:plan`, `/moku:build`) MUST rewrite this block every time they write STATE.md.
**Consumers** (`/moku:next`, `/moku:status`, a fresh session) read it FIRST and only fall through to
parsing the full tables when it is missing or stale (`Updated` older than the file's real changes,
or inconsistent with the plugin table).

## Optional `.planning/memory/` (agent memory)

Validator/architecture agents may keep `memory: user`/`local` notes. When a project wants an explicit
store, use `.planning/memory/`:

- `memory/project.md` — durable, human-curated facts about THIS codebase (non-obvious constraints,
  recurring pitfalls). Mirrors the structured format in `agent-preamble.md` Rule 7
  (`- [YYYY-MM-DD] note | confidence:{high|medium|low}` under `## Error Patterns` /
  `## Architecture Decisions` / `## Validation Baselines`).
- The API **memory tool** (when enabled) and **context-editing** are complementary: the model can
  CRUD a memory directory across sessions; `.planning/memory/` is the moku-convention location so
  those notes live beside the rest of the durable state and are wiped together by `/moku:clean`
  (except the durable set `clean` preserves: `learnings.md`, `decisions.md`, `steering.md`,
  `history.md`).

Keep memory small and high-signal — it is loaded on recall, so it competes for context budget.
