# Brainstorm Templates

Templates used by the `/moku:brainstorm` command for context files and intermediate documents.

---

## Context File Template

Saved to `.planning/context-{name}.md`. This is the primary output of `/moku:brainstorm` and the primary input to `/moku:plan ... --context`.

```markdown
# Brainstorm Context: {NAME}

## Meta
- Category: {create|modify|migrate|feature}
- Depth: {quick|standard|deep} (score: {N}/9)
- Created: {ISO timestamp}
- Plan command: `/moku:plan {VERB} {TYPE} "{NAME}" --context context-{NAME}.md`

## Summary
{1–2 paragraph executive summary: what is being built, why, and the recommended approach}

## Analysis Summary

### Auto-Detected Context
{project context discovered during Phase 1a: domain assessment, workspace state, existing plugins/code, dependency landscape, novelty evaluation}

### Scope Assessment
{estimated scope: capabilities, plugins, integrations — all auto-detected from DESCRIPTION and project analysis}

### Architectural Decisions
{decisions made during collaborative discussion in Phase 1b, with chosen approach, rejected alternatives, and rationale. If 0 decisions were needed: "No architectural decisions required — context was clear from analysis."}

## Migration Source (migrate only — omit for other categories)
- Path: {MIGRATE_PATH}
- Tech stack: {framework, runtime, build tool, test framework}
- Architecture: {detected pattern}
- Size: {file count, ~LOC}
- State patterns: {detected patterns}
- Key challenges: {obstacles for Moku migration}

## Research Findings

### Ecosystem Landscape
{key packages, patterns, competitive landscape from researcher agents — 3–5 bullet points}

### Technical Patterns
{TypeScript patterns, architecture patterns relevant to the domain — 3–5 bullet points}

### Risks & Pitfalls
{confirmed risks from research, with mitigations — bulleted list}

## Proposed Approach

### Architecture Direction
{1–3 sentences describing the chosen architectural approach}

### Key Assumptions
- {assumption 1}
- {assumption 2}
- ...

### Explicit Non-Goals
- {what this will NOT do — derived from debate challenges scoped out}

### Open Questions (For Planning Stage)
- {question not resolved in brainstorm — plan command should address}

## Decisions Made
| Decision | Chosen | Rejected | Rationale |
|---|---|---|---|
| {topic} | {chosen option} | {alternative} | {1-sentence reason} |

## Recommended Plan Approach

### Suggested VERB + TYPE
`/moku:plan {VERB} {TYPE} "{NAME}" --context context-{NAME}.md`

### Suggested Plugins (Preliminary)
{list of likely plugins with 1-line descriptions, or "Plugin analysis deferred to plan stage" for quick mode}

### Risks Requiring Spec Attention
- {Risk 1} → flag for Stage 2 spec of plugin X
- {Risk 2} → flag for Stage 2 spec of plugin Y
```

---

## Position Document Schema

Intermediate scratch document used during the debate loop. Written by brainstorm-synthesizer, read by brainstorm-challenger. Saved to `.planning/brainstorm-{NAME}-position.md`.

```markdown
# Position: {NAME} — Iteration {i}

## Proposed Approach
{1–2 sentence headline}

## Key Assumptions
- {assumption 1}
- {assumption 2}
- {max 5}

## Identified Risks
- {risk 1}
- {risk 2}
- {max 3}

## Open Questions
- {question 1}
- {max 3}

## Decisions Made This Iteration
| Challenge | Resolution | Rationale |
|---|---|---|
| {challenge text} | {chosen resolution} | {why} |
```

---

## Plan Command Mapping

The context file maps to plan-verb-create.md's steering inputs:

| Context File Section | Steering Equivalent |
|---|---|
| `## Explicit Non-Goals` | `## Boundaries (NOT in scope)` |
| `## Analysis Summary` → scope assessment | `## Primary User` |
| `### Suggested Plugins (Preliminary)` (top 3) | `## MVP Priorities` |
| `### Ecosystem Landscape` (first reference) | `## Reference Point` |
| `## Risks Requiring Spec Attention` (first) | `## Biggest Risk` |
| `## Migration Source` → Path (migrate only) | `MIGRATE_PATH` (skips "Where is the code?" question in plan migrate) |
