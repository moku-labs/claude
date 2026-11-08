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

For `web` and `game`, every art direction carries a **motion character** in numbers ("springy, 6 %
overshoot, 180–260 ms"; "heavy, smooth ease-in-out, 400 ms, no bounce") and a **signature moment** (how the
main popup opens, how the reward falls). Two directions with the same motion character are as much a
failure as two with the same palette. Motion is designed from the first round, not added at polish
(`design-motion.md`).

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
{every screen, panel, popup and state each concept must show, each with a state id that opens it by
`?state=` — `shop.default`, `shop.empty`, `reward.open`; for an element scope, one surface plus its
default, hover, active, empty and error states}

## Target sizes (web and game)
{each opened by `?vp=WxH`: web at least phone, tablet, desktop (`390x844`, `768x1024`, `1440x900`); game at
least two aspect ratios with safe areas (`390x844` safe 47/34, `390x693` 24/0)}

## Motion (web and game)
{the required events of the medium from design-motion.md §2, and any moment this feature must have — "the
reward flies into the counter", "the level-up popup". Every concept designs all of them in its own
character; the numbers are the concept's, not the spec's}

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

Spawn COUNT `design-generator` agents with the Agent tool, all in one response, foreground or background
(they have no turn limit, each writes only its own concept file, and ending your turn to wait for their
hand-backs is legitimate inside the station). No generator spawns another. Each gets:

1. its concept id (`r{N}c{M}`) and its single output path
   (`.planning/design/{SLUG}/concepts/r{N}c{M}.html`),
2. the full concept spec,
3. its own art direction with its motion character and signature moment — no two generators share one,
4. the MEDIUM and its prototype rules; for web and game, `design-motion.md` (the motion table, states, sizes
   and URL contract),
5. the framing: this prototype communicates look, feel, behaviour and inventory, is not production code,
   and will be re-implemented from scratch later,
6. the turn rule: "Keep tool calls few: write the whole file in one Write, run `moku-proto-check` on it, fix
   its FAIL lines with Edit, run it once more. Deliver the output contract before your turn budget ends."

A generator that returns without its report is resumed exactly once ("Deliver your report now: the output
contract with an honest verdict on what is done. Do no more work."). Still silent: its concept counts as
failed (`no report`) and the round goes on with the files that exist. No open-ended wait, no second
reminder (`agent-preamble.md` in moku-core → "For the orchestrator").

### B2 — Assemble the gallery

Write `.planning/design/{SLUG}/concepts/gallery-r{N}.html`, an index that links and where practical
embeds every concept live (an iframe, so the motion plays) with its id, art direction and motion character,
a replay link for its signature moment (`r1c2.html?play=reward-in`), links to each state and size, and the
frame series of B3. For `cli` and `tui` the gallery is one document collating each sketch's captured output.

### B3 — Serve, screenshot, verify

First run the cheap check on every concept (web and game; about five seconds each, no model looks at a
picture):

```bash
moku-proto-check .planning/design/{SLUG}/concepts/r{N}c{M}.html --out .planning/design/{SLUG}/screenshots/r{N}c{M}
```

Its frame lines tell you every state opened at every size; its verdict line goes into the concepts table.
A concept that says FAIL goes back to its generator once, resumed with the FAIL lines ("Fix these with
Edit, run moku-proto-check again, report."). Still failing: present it with the findings named, or drop it
with a note. Then capture the signature moment of each concept as a short series — the same `?play=<id>`
with `?t=` at 0, ¼, ½, ¾ and the end of its duration — into `screenshots/r{N}c{M}-motion-{t}.png`.

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
- **Motion** (web and game). Every required event plays in every concept (the proto-check lines); the
  motion characters are distinguishable between concepts; each concept's motion agrees with its art
  direction; reduced motion works; the gallery has each signature series. Screenshots without motion are not
  a round: a concept whose motion does not play is not shown as a candidate.
- **States and sizes.** Every state of the spec opens by `?state=` at every target size, with no horizontal
  scroll and nothing cut off.
- **Rank.** An honest strongest-to-weakest ordering with one line of reason each. If every concept looks
  equally good, look harder.

Judge design and coverage only. Code quality and framework conformance do not apply — the build
re-implements everything.

**Astra's review.** Load the `moku-astra` skill with the Skill tool and follow it: call
`moku-astra review --images <screenshots and signature series> --context <design-context if one exists>`
with `--focus "motion: expressiveness, fit with the art direction, distinctness between concepts,
readability"` added, take the findings schema as given, and on exit 3 review alone and name the reviewer in the report.

**Merge and triage.** Put both lists into one, then triage each finding with the four questions in the
`moku-astra` skill. Write every rejection and its reason into `.planning/astra/triage.md`. At most two
passes. Present the merged, triaged findings together with the gallery in Phase C.

---

## Phase C — Converge

### C1 — Present the round

Before any question, show: the screenshots by path with id and a one-line art direction and motion
character each, the live URL for every concept and the gallery (where the motion plays), the replay link of
each signature moment, an honest read on each direction with its trade-offs, and the merged
review findings.

### C2 — The pick gate

`moku-rails pause --reason "round {N} pick"`, then `AskUserQuestion`: *"Round {N}: which direction wins?"*
One option per concept, each description a self-contained one-liner of its direction and its motion, plus *"Mix two —
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

Polish is an edit of the winner in place, by this session: Grep for the element, Read only those lines,
Edit them. Do not spawn a generator again to polish — each such run cost about ten minutes and was a third
of all generator runs. A generator is for a new round, or for a rework the person asks to see as
alternatives.

Motion after the pick is **polished**, not added: timing, curve, peak values and sequence change; a new
animation is a new round, or the person's decision written into `state.md` under `## Decisions:` with
their words. Keep the `moku-design` block in step with every change.

### D2 — Check every change in a preview

After each meaningful change, run `moku-proto-check` on `index.html` (it opens every state at every size and
plays every motion), screenshot the affected surfaces (or hand over the URL when no screenshot tool
exists), check both themes if the design is themed, and show the user the result. A change is not done until a screenshot or a live URL shows it.

### D3 — Art assets (offered, never automatic)

Art is made for the winner only, never for every concept of a round. If the winner needs real art — icons,
illustrations, textures — offer one batched
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
`.planning/design/{SLUG}/design-context.md` from `design-context-template.md`. Six rules:

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
4. **The prototype is the measurement reference.** Keep the §0 paragraph "The numbers are the spec" and
   fill the §5 **Measurement reference** table: the prototype path, its frame in px, the target's units
   and the conversion (web `× 1`; a game `× reference width / frame width`, for example `× 1080 / 390`).
   Give every generated image a row in the Files table as an art asset or a style reference. Never write
   that a screen is built "from" or "in the layout of" an image: an image of a screen shows a style, the
   prototype holds the numbers.
5. **Fonts and text.** Fill the **Typography** table in §2 from the prototype's computed styles: face,
   weight, every size, the licence, the locales the face has glyphs for. Words are text: write no design
   where a label, a button word or a title is baked into an image. Lettering that is art by decision goes
   on the **Lettering as art** line with its reason; ask the person before you put a word there.

6. **Motion, states and sizes.** For `web` and `game`, copy the winner's `moku-design` block into the
   context: the motion table into §2b with all eight columns per row, the states (with their `?state=` ids),
   the target sizes and the adaptation rules into §5. Every screen, popup and state of §6 has its rows in
   §2b or an explicit "no motion" with the reason. A UI design context without the motion table is not
   finished, and the design check refuses it.

Then run the checklist at the foot of the template and close any gap before moving on.

### E2b — Fix the design check's inventory (`ui` only)

Write `.planning/design/{SLUG}/spec.json` with every target size of §5 (a game's frames with their safe
areas), the states the prototype shows (`?state=` queries) and the conversion, then run
`moku-fidelity capture .planning/design/{SLUG}`. Elements need a `data-check` id in the prototype, or a
selector in `spec.json`. The inventory it fixes is what the build is measured on, every time
(`design-check.md`, Step 1). No headless browser here: capture through the browser pane with
`moku-fidelity probe … --side expected` and `ingest`. Capture copies the prototype's motion table (its
`moku-design` block) into `spec.json` as `animations`, so each motion row × column is a row of the check too;
keep it equal to §2b.

### E3 — Update the registry and state

Write the `complete` row into `.planning/design/index.md`; set `## Stage: complete`, `## Winner:` and the
final `## Recovery` and `## Next Action:` in `state.md`.

### E4 — Hand off

Restate the spec-not-source reminder (the wording is in the skill), print the plan-station next step with
the context path, then `moku-rails done design --design {SLUG}`. The slug makes the rails hold `build`
and `e2e` until the design check passes.

---

## What is carried where

- **Into generators:** concept id and output path, the concept spec (states, sizes, motion events), the
  per-concept art direction with its motion character and signature moment, the medium and its prototype
  rules, `design-motion.md`, the disposable-demo framing.
- **Into Astra:** the round's screenshots and, once it exists, `design-context.md` as `--context`.
- **Out:** `.planning/design/{SLUG}/design-context.md` plus the registry row, consumed by the plan and
  build stations, which forward the re-implement-never-copy instruction and the **Measurement reference**
  table (prototype path, conversion) to their agents.
- **Back in after the build:** the design check (`design-check.md`) compares the build to the prototype
  by measurement. The build and e2e stations run it themselves.
