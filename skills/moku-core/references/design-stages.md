# Design Stages — per-design state & stage detail

The state model and per-stage contract for `/moku:design`. The command and `design-flow.md` read and
write the structures defined here. Design state is **separate from plan/build state** — exactly as
brainstorm state is separate. `/moku:design` **never writes `.planning/STATE.md`**; it owns
`.planning/design/**` only.

---

## 1. Per-design isolation & the registry

Every design invocation gets its **own folder**, keyed by a slug derived from the target:

```
.planning/design/
  index.md                          # the registry — every design and its stage
  {slug}/
    state.md                        # this design's state (schema below)
    concept-spec.md                 # the shared feature checklist + frozen demo data (all concepts obey it)
    concepts/                       # round prototypes (disposable demo artifacts)
      r{N}c{M}.html                 # web: one self-contained file per concept (or .ts/.sh/.txt for cli/tui)
      gallery-r{N}.html             # the round gallery (links/embeds every concept)
    screenshots/                    # round screenshots (ephemeral, for presentation)
      r{N}c{M}.png
    index.html                      # the WINNER prototype (after convergence) — evolves during polish
    styles.scss                     # winner styles, extracted at capture (web)
    app.js                          # winner logic, extracted at capture (web)
    design-context.md               # the captured design context (the real output)
```

For `cli`/`tui`, the concept and winner files are runnable sketches / ASCII frames instead of HTML/CSS/JS
(see `design-medium.md`); the folder shape is otherwise identical.

**Designs are independent and must never collide.** A user might design the whole app, later redesign
just the footer, then a popup, then "try something new." Each is its own `{slug}/` with its own state.

**Slug derivation:** slugify the target — lowercase, `[a-z0-9-]`, spaces → `-`, strip stop words, max 50
chars, no path separators. Examples: "the settings page" → `settings-page`; "a delete-confirmation
popup" → `delete-confirmation-popup`; "whole app, a kanban tracker" → `kanban-tracker`. On collision with
an existing **different** design, suffix `-2`, `-3`, …. If the slug matches an existing design with the
same target, treat it as a **resume** of that design (see §4).

### Registry — `.planning/design/index.md`

```markdown
# Design Index

> Every `/moku:design` workspace in this project and its current stage. `/moku:design list` reads this;
> `brainstorm` and `plan` scan it to offer a matching design context.

| Slug | Target | Scope | Medium | Stage | Winner | Updated |
|------|--------|-------|--------|-------|--------|---------|
| kanban-tracker | whole app (kanban tracker) | app | web | complete | r2c3 | {ISO} |
| settings-page | the settings page | page | web | round-1-presented | (none) | {ISO} |
```

Rewrite the registry row on every state change. Never delete rows automatically — a completed design is
a permanent reference.

---

## 2. Per-design state — `.planning/design/{slug}/state.md`

Follow Moku STATE conventions: inline-colon headers, each header exactly once, atomic write
(`state.md.tmp` → validate → rename). Refresh the `## Recovery` block on every write so a cold session
rehydrates in one read.

```markdown
# Design State: {slug}

## Target: {what is being designed — e.g. "the settings page" | "a delete-confirmation popup" | "whole app (kanban tracker)"}
## Scope: {app | page | element}
## Medium: {web | cli | tui}
## Stage: {framing | round-{N}-generating | round-{N}-presented | winner-polish | iterating | complete}
## Round: {N}
## Concepts: {count generated this round}
## Winner: {concept id, e.g. r2c3 | (none)}
## ConceptSpec: {.planning/design/{slug}/concept-spec.md | (pending)}
## BrainstormContext: {.planning/context-{name}.md | (none) — consumed to ground concepts, if any}
## Created: {ISO}
## Last Updated: {ISO}
## Next Action: {the exact next step, e.g. "Run /moku:design resume to review round 1"}

## Recovery
<!-- Cold-start rehydration. Keep ≤ 6 lines; rewrite every state write. -->
- Last good step: {e.g. "Round 1 presented — 6 concepts, awaiting pick"}
- Open blockers: {short list or "none"}
- Next action: {exact command, e.g. `/moku:design resume`}
- Updated: {ISO — same as Last Updated}

## Rounds
| Round | Concepts | Outcome | Winner |
|-------|----------|---------|--------|
| 1 | 6 | new-round | (none) |
| 2 | 4 | winner | r2c3 |

Outcome values: `generating` | `presented` | `winner` | `mix` | `new-round`

## Concepts
| ID | Round | Art direction | File | Status |
|----|-------|---------------|------|--------|
| r1c1 | 1 | Editorial / Swiss | concepts/r1c1.html | removed |
| r2c3 | 2 | Warm brutalist | concepts/r2c3.html → index.html | winner |

Concept Status values: `generating` | `built` | `failed` | `removed` | `winner`
```

`## Stage:` field — the resumable stage machine (one of):
`framing` · `round-{N}-generating` · `round-{N}-presented` · `winner-polish` · `iterating` · `complete`.

---

## 3. The stages

Each stage maps to a phase in `design-flow.md`. Every stage ends at a **human gate** or a clean stop, and
every stage is **resumable** from `state.md`.

| Stage | Phase | What happens | Ends at |
|-------|-------|--------------|---------|
| `framing` | A — Frame | Resolve target/scope/medium (scope gate), detect & consume any brainstorm context, write `concept-spec.md` (feature checklist + frozen demo data). | Stop after writing concept-spec + initial state — or roll straight into round 1 generation if the frame is unambiguous. |
| `round-{N}-generating` | B — Generate | Spawn N `design-generator` agents in parallel (one concept each, all obeying `concept-spec.md`); assemble the gallery; serve + screenshot; (optional) run `design-critic`. | Stop is internal — proceeds to present once all concepts are built & verified. |
| `round-{N}-presented` | C — Converge | Present the round (screenshots + how-to-explore + live URLs). **Human gate:** pick a winner · ask for a mix/synthesis · call a new round. | **Gate.** On winner → remove losers, promote winner to `index.html`, go to `winner-polish`. On mix → generate the synthesis as the next round's seed. On new-round → `round-{N+1}-generating`. |
| `winner-polish` | D — Polish | Evolve the single winning prototype with the user — full feature set, fixes, refinement. **Every change verified in a real preview** (screenshot + DOM check), never assumed. | **Gate** each iteration: "happy, or keep going?" Loops as `iterating` until the user is satisfied. |
| `iterating` | D — Polish | Same as `winner-polish`; the label distinguishes "first polish pass" from "subsequent iteration" on resume. | **Gate** — happy → `complete`; more → stay. |
| `complete` | E — Capture | Save final design files (extract styles/logic; label as demo/reference). Spawn `design-synthesizer` to write `design-context.md` (with the verbatim §0 callout). Update registry. Restate the spec-not-source reminder on hand-off. | Terminal. Output: `.planning/design/{slug}/design-context.md`. |

---

## 4. Resume, list & switch

`/moku:design` with **no target** (bare, or `resume`) restores work:

1. Read `.planning/design/index.md`.
2. **Zero designs** → there is nothing to resume; treat as a fresh start (the empty-args prompt in
   `design.md` Step 0 takes over).
3. **Exactly one in-progress design** (stage ≠ `complete`) → load its `state.md`, announce the restored
   stage from `## Recovery`, and continue from `## Stage:`.
4. **Multiple designs** (or an explicit `list`) → present the registry via `AskUserQuestion` (each
   in-progress design + "Start a new design" + completed ones shown as reference) and resume the chosen
   one. This is also how the user **switches** between designs.

`/moku:design list` always just prints the registry table and stops.

On resume, re-enter the exact stage:
- `framing` → re-resolve any missing frame value, (re)write `concept-spec.md`.
- `round-{N}-generating` → re-check which concept files exist; regenerate only the missing/failed ones,
  then assemble/screenshot/present.
- `round-{N}-presented` → re-present the existing round (re-screenshot if needed) and re-open the pick gate.
- `winner-polish` / `iterating` → re-open `index.html`, screenshot current state, continue polishing.
- `complete` → the design is done; offer to **iterate again** (→ `iterating`), **start a new design**,
  or hand the context to `plan`.

---

## 5. Round-count & flags

- **`--count N`** sets concepts-per-round (default **6**). Honour the user's words too ("just give me
  three", "show me a dozen"). Element-scope designs (a single popup/button) may default lower if the
  user implies it, but 6 remains the default unless asked.
- **`--rounds`** is a hint that the user expects multiple rounds — never cap rounds; the loop runs until
  the user picks a winner or stops.
- **`--medium web|cli|tui`** forces the medium, bypassing detection's default (the scope gate still runs).

---

## 6. Invariants

- **Never write `.planning/STATE.md`** — design state lives only under `.planning/design/`.
- **Never commit `.planning/`** — it is local-only (already gitignored via the `.planning/` rule).
- **One human gate per round and per polish iteration** — never auto-advance past a pick or a
  "happy?" gate.
- **Verify in a real preview before claiming a change works** — screenshots + DOM checks, never assumed.
- **Prototypes are disposable demo artifacts** — they communicate look/feel/behaviour/inventory, and are
  never production code. The captured `design-context.md` is the durable output.
