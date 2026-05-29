# Moku Memory & Multi-Session Resumability

Moku is heavily resume-based: brainstorm → plan → build run across many sessions, with
context compaction in between. This doc defines the durable layer that survives compaction
and lets a cold session rehydrate fast.

## The durable layer (`.planning/`)

`.planning/` is the project's **cross-compaction memory** — it persists what conversation context
cannot. It is local-only and gitignored. Treat these as the source of truth on resume:

| File | Role | Lifetime |
|------|------|----------|
| `STATE.md` | Current phase/verb/target/skeleton + the **Recovery** block + plugin tables | rewritten every wave |
| `learnings.md` | Durable architecture learnings / decisions across sessions | kept by `/moku:clean` |
| `specs/`, `skeleton-spec.md` | What to build | per project |
| `context-*.md` | Brainstorm output feeding plan | per brainstorm |
| `build/agent-log.md` | Recent agent outcomes | ephemeral |
| `memory/` (optional) | Free-form agent memory (see below) | per project |

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
  (except `learnings.md`, which `clean` preserves).

Keep memory small and high-signal — it is loaded on recall, so it competes for context budget.
