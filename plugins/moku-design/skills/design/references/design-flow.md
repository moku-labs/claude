# Design flow — `ui` mode

The round-based flow for `ui` mode. It receives TARGET, SCOPE, MEDIUM, SLUG, COUNT (concepts per round,
default 6), BRAINSTORM_CONTEXT (a `.planning/context-*.md` or none) and STAGE (the resume point from
`state.md`).

Multi-round and human-in-the-loop. It stops at every gate and resumes at each one
(`design-stages.md`). Output: `.planning/design/{SLUG}/design-context.md`, a specification, never source.

Print one progress line at the top of each phase:

```
Design: {SLUG} | Phase {A-E}/5: {name} | {SCOPE} · {MEDIUM}
```

---

## Phase A — Frame

Goal: fix everything except the design, so the concepts differ only in art direction.

### A0 — Load the design skill

Invoke the `frontend-design` skill with the Skill tool before anything else. It carries the aesthetic
guidance for the whole run and is the biggest single lever on concept quality. Derive one distinct art
direction per concept from it here, so the directions exist before fan-out. For `cli` and `tui` apply what
transfers: density, rhythm, typography judgement.

### A1 — Restate the frame

One line: *Designing {TARGET} ({SCOPE}, {MEDIUM}).* The scope gate already ran in the skill.

### A2 — Consume prior context

If BRAINSTORM_CONTEXT exists, read it and pull the concept, the feature set, the non-goals and any look
hints. Record it in `state.md` under `## BrainstormContext:`. With no prior context the run is standalone.

### A3 — Write the concept spec

Write `.planning/design/{SLUG}/concept-spec.md` — the brief every concept obeys:

```markdown
# Concept Spec: {TARGET}

## Scope
{app | page | element} — {what is in and out of this design}

## Feature checklist (every concept demonstrates all of these)
- {feature}

## Screens / surfaces to include
{every screen, panel, popup and state each concept must show; for an element scope, one surface plus its
default, hover, active, empty and error states}

## Demo data (identical across all concepts, frozen)
{the dataset every concept renders: entities, names, labels, counts — concrete and a little characterful
so the screens feel real}

## Constraints
- Self-contained prototype (web: one HTML file, inline CSS and JS, Google Fonts only; cli/tui: one
  runnable sketch or ASCII frame set — see design-medium.md)
- Same features and same demo data in every concept; only the design varies
- {hard constraints from the brainstorm context or the user}
```

If the frame was ambiguous, `moku-rails pause` and confirm the spec with the user. If it is clear, go
straight to Phase B. Set `## Stage: round-1-generating`.

---

## Phase B — Generate one round

### B1 — Spawn generators in parallel

Spawn COUNT `design-generator` agents with the Agent tool, all in one response. Each gets:

1. its concept id (`r{N}c{M}`) and its single output path
   (`.planning/design/{SLUG}/concepts/r{N}c{M}.html`),
2. the full concept spec,
3. its own art direction — no two generators share one,
4. the MEDIUM and its prototype rules,
5. the framing: this prototype communicates look, feel, behaviour and inventory, is not production code,
   and will be re-implemented from scratch later.

### B2 — Assemble the gallery

Write `.planning/design/{SLUG}/concepts/gallery-r{N}.html`, an index that links and where practical
embeds every concept with its id and art direction. For `cli` and `tui` the gallery is one document
collating each sketch's captured output.

### B3 — Serve, screenshot, verify

Always give the user something live. Use `mcp__Claude_Browser__preview_start` over
`.planning/design/{SLUG}/` when the browser preview tools are present, screenshot each concept into
`screenshots/r{N}c{M}.png` with `mcp__Claude_Browser__computer`, and check the DOM and console with
`read_page` and `read_console_messages`. Without those tools, start a Bash background static server, hand
the user the URLs, and verify each file with a Bash structural check instead. Stop the server when the
round ends.

A concept that errors is regenerated or dropped with a note. Update the concepts table in `state.md` and
set `## Stage: round-{N}-presented`.

### B4 — Review the round twice

The round is reviewed by this session and by Astra independently, on the same screenshots, before the user
sees it.

**This session's checklist**, three lenses, every round:

- **Coverage.** For each concept, which features, screens and states from `concept-spec.md` are missing or
  thin. Cross-check the spec line by line against each prototype. Be specific: "r1c2 has no empty state for
  the board column and no delete confirmation" — not "r1c2 is unpolished".
- **Distinctiveness.** Are the concepts genuinely different directions, or do some collapse into the same
  look? Name the duplicates by id.
- **Inventory gaps.** Any screen, panel, popup, menu, modal, transient element or component the brief
  implies but no concept shows. These become missing features downstream, so they are first-class findings.
- **Rank.** An honest strongest-to-weakest ordering with one line of reason each. If every concept looks
  equally good, look harder.

Judge design and coverage only. Code quality and framework conformance do not apply — the build
re-implements everything.

**Astra's review.** Load the `moku-astra` skill with the Skill tool and follow it: call
`moku-astra review --images <screenshots> --context <design-context if one exists>`, take the findings
schema as given, and on exit 3 review alone and name the reviewer in the report.

**Merge and triage.** Put both lists into one, then triage each finding with the four questions in the
`moku-astra` skill. Write every rejection and its reason into `.planning/astra/triage.md`. At most two
passes. Present the merged, triaged findings together with the gallery in Phase C.

---

## Phase C — Converge

### C1 — Present the round

Before any question, show: the screenshots by path with id and a one-line art direction each, the live URL
for every concept and the gallery, an honest read on each direction with its trade-offs, and the merged
review findings.

### C2 — The pick gate

`moku-rails pause --reason "round {N} pick"`, then `AskUserQuestion`: *"Round {N}: which direction wins?"*
One option per concept, each description a self-contained one-liner of its direction, plus *"Mix two —
synthesise"* and *"New round — fresh directions"*.

- **Winner** → record `## Winner:`, mark the losers `removed`, delete the losing concept files (keep the
  screenshots), promote the winner to `.planning/design/{SLUG}/index.html`, set `## Stage: winner-polish`,
  go to Phase D.
- **Mix** → capture which concepts and what to combine, seed the next round with that synthesis, loop to
  Phase B as round N+1.
- **New round** → capture what to change, refresh the directions, loop to Phase B as round N+1.

Rounds are never capped and convergence is never forced. One round per invocation is fine.

---

## Phase D — Polish

### D1 — Iterate the winner

Work on `.planning/design/{SLUG}/index.html` with the user: complete the feature set from the concept
spec, fix rough edges, refine. It stays a self-contained prototype.

### D2 — Check every change in a preview

After each meaningful change, re-serve, screenshot the affected surfaces (or hand over the URL when no
screenshot tool exists), check the DOM and the console, both themes if the design is themed, and show the
user the result. A change is not done until a screenshot or a live URL shows it.

### D3 — Art assets (offered, never automatic)

If the winner needs real art — icons, illustrations, textures — offer one batched
`moku-astra generate --brief "..." --out assets/...` run and wait for the user to agree. Follow the
`moku-astra` skill for cost, backends and the manifest. Without it, use SVG or CSS placeholders and record
a to-draw list in the manifest.

### D4 — The happy gate

After a coherent batch of changes, `moku-rails pause`, then `AskUserQuestion`: *"Happy with this, or keep
refining?"* — capture the design context, keep refining (`## Stage: iterating`), or try a new round. Loop
until the user is satisfied.

---

## Phase E — Capture

This session writes `design-context.md` itself; there is no synthesizer agent.

### E1 — Finalise the design files

Make sure `index.html` is the complete runnable prototype, then extract styles and logic into
`styles.scss` and `app.js` (web) or finalise the runnable sketches (cli/tui), so the design is legible.
Label every one of them demo and reference, not source.

### E2 — Write `design-context.md`

Read the actual prototype and the concept spec, then write
`.planning/design/{SLUG}/design-context.md` from `design-context-template.md`. Three rules:

1. **§0 verbatim.** Reproduce the "spec, not source" callout exactly as the template has it, substituting
   only `{NAME}` and the conventions line for the medium. It has to be the first section after the title
   block, because the plan and build stations rely on it to carry the re-implement-never-copy instruction
   into their agents. A context without an intact §0 is not finished.
2. **Exhaustive inventory.** §6 lists every distinct surface the prototype actually contains — every full
   screen, persistent region, overlay or drawer, menu or popup, modal or prompt, inline and transient
   element, and recurring component — each in exactly one group. Walk the whole prototype before writing;
   an omission here becomes a missing feature in the build.
3. **Every section populated** from what the prototype does. No `TBD`, no placeholder prose, no invented
   features. The Files table labels each prototype file as demo or reference. §9 repeats "re-implement,
   don't port".

Then run the checklist at the foot of the template and close any gap before moving on.

### E3 — Update the registry and state

Write the `complete` row into `.planning/design/index.md`; set `## Stage: complete`, `## Winner:` and the
final `## Recovery` and `## Next Action:` in `state.md`.

### E4 — Hand off

Restate the spec-not-source reminder (the wording is in the skill), print the plan-station next step with
the context path, then `moku-rails done design`.

---

## What is carried where

- **Into generators:** concept id and output path, the concept spec, the per-concept art direction, the
  medium and its prototype rules, the disposable-demo framing.
- **Into Astra:** the round's screenshots and, once it exists, `design-context.md` as `--context`.
- **Out:** `.planning/design/{SLUG}/design-context.md` plus the registry row, consumed by the plan and
  build stations, which forward the re-implement-never-copy instruction to their agents.
