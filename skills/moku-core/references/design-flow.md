# Design Flow

Main flow coordinator for `/moku:design`. Receives context variables from the command: TARGET, SCOPE,
MEDIUM, SLUG, COUNT (concepts per round, default 6), BRAINSTORM_CONTEXT (a `.planning/context-*.md` or
`(none)`), and STAGE (the resume point from `state.md`).

This is a **multi-round, human-in-the-loop** exploration. It stops at every human gate and is resumable
at each one (`design-stages.md`). Output: `.planning/design/{SLUG}/design-context.md` — a **design
specification, never source** (see the callout the synthesizer emits).

**Formatting (terminal rendering):** as in `brainstorm-flow.md` — `**BOLD CAPS**` for section titles,
`**Bold Mixed Case**` for sub-sections, `---` rules between major sections, and a progress marker as the
first line of each phase output:

```
Design: {SLUG} | Phase {A–E}/5: {name} | {SCOPE} · {MEDIUM}
```

---

## Phase A: Frame

**Goal:** establish exactly what is being designed and a shared brief, so the only thing that varies
between concepts is the *design*.

### A0 — Load the design skill first (raises quality)
**Before doing anything else in a design run, invoke the official `frontend-design` skill** (the `Skill`
tool — it is in this command's `allowed-tools`). This loads its aesthetic guidance into context for the
whole run and is the single biggest lever on concept quality — do not skip it. Keep its principles active
through framing (A3) and **pass a distinct, skill-derived art direction to every generator** in Phase B.
Each `design-generator` also declares `frontend-design` in its own `skills`, but the orchestrator loading
it here is the guaranteed path — and lets you derive the per-concept directions before fan-out. (For
`cli`/`tui` runs the skill is still useful for layout/typography/density judgement; apply what transfers.)

### A1 — Resolve target, scope & medium (scope gate)
The command already parsed TARGET/SCOPE and ran the **scope gate** in `design-medium.md`. Confirm the
resolved MEDIUM is set; if the project gated out (non-UI, no DX surface intended), you never reach this
file. Re-state the frame in one line: *"Designing **{TARGET}** ({SCOPE}, {MEDIUM})."*

### A2 — Detect & consume prior context
- **Brainstorm context present** (BRAINSTORM_CONTEXT ≠ `(none)`, or a `.planning/context-{name}.md`
  whose feature matches TARGET): **read it** and use it to ground the concepts — pull the concept,
  feature set, non-goals, and any look/feel hints. Record it in `state.md` (`## BrainstormContext:`).
- **First command after `init`** (no brainstorm context yet): run **standalone**. You will still produce
  a full design context that `/moku:brainstorm` or `/moku:plan` can pick up later.

### A3 — Write the shared concept spec
Write `.planning/design/{SLUG}/concept-spec.md` — the **single brief every concept obeys**, so concepts
are comparable and only the art direction differs:

```markdown
# Concept Spec: {TARGET}

## Scope
{app | page | element} — {one line on the boundary: what is in/out of this design}

## Feature checklist (every concept demonstrates ALL of these)
- {feature 1}
- {feature 2}
- ...

## Screens / surfaces to include
{the list of screens/panels/popups/states each concept must show — for an element scope this may be one
surface plus its states (default/hover/active/empty/error)}

## Demo data (identical across all concepts — frozen)
{the realistic dataset every concept renders: entities, sample names, labels, counts. Make it concrete
and a little characterful so screens feel real — the tracker-v2 "Cloudflare-stack" issues are the model.}

## Constraints
- Self-contained prototype (web: one HTML file, inline CSS/JS, Google-Fonts only; cli/tui: one runnable
  sketch / ASCII frame set — see design-medium.md)
- Same features + same demo data in every concept; only the design varies
- {any hard constraints from the brainstorm context or the user}
```

Use the official **`frontend-design`** skill to raise the aesthetic bar: consult it for the art-direction
brief, and derive a **distinct direction per concept** (font pairing, palette, personality, signature
interaction) to hand each generator in A/B. The features and demo data stay identical; the *direction*
diverges.

**Gate (optional):** if the frame was ambiguous, briefly confirm the concept-spec with the user before
generating. If it's clear, proceed straight into Phase B. Write `state.md` (`## Stage: round-1-generating`).

---

## Phase B: Generate concepts (one round)

**Goal:** produce N **distinct** concepts — same features and demo data, genuinely different designs —
each a self-contained, runnable, clickable prototype.

### B1 — Spawn generators in parallel (one per concept)
Spawn **COUNT** `design-generator` agents using the `Agent` tool, **all in the same response** (parallel).
Each generator gets:
1. The **concept id** (`r{N}c{M}`) and its **output path** (`.planning/design/{SLUG}/concepts/r{N}c{M}.html`
   — strict isolation: it writes ONLY this file).
2. The **shared brief** — the full contents (or path) of `concept-spec.md`.
3. Its **distinct art direction** — the one direction assigned to this concept (from A3 / `frontend-design`).
   No two generators get the same direction.
4. The **MEDIUM** and its prototype rules (`design-medium.md`).
5. The **disposable-demo** framing: this prototype communicates look/feel/behaviour/inventory; it is
   NOT production code and will be re-implemented from scratch later — speed and fidelity-of-intent over
   code quality.

> **Distinct directions, same substance.** Instruct each generator to *commit hard* to its art direction
> — a real point of view, not a safe default. Six concepts that look like the same template with
> different accent colours is a failed round. Reuse the `frontend-design` skill to push each one.

### B2 — Assemble the gallery
Write `.planning/design/{SLUG}/concepts/gallery-r{N}.html` — an index that links (and where practical
embeds, via `<iframe>`) every concept in the round, labelled by id and art direction. For cli/tui, the
"gallery" is a single document collating each sketch's captured output.

### B3 — Serve, screenshot & verify (availability-aware — always serve the user a live preview)
**Always run a real preview the user can open**, and degrade gracefully by what tooling is present. Detect
availability and walk this chain (do not silently skip the user-facing preview):

1. **Serve locally (always).** Start a local server over `.planning/design/{SLUG}/` so every concept and
   the gallery have a live URL.
   - **Preferred — internal browser preview:** if the Claude Preview tools (`mcp__Claude_Preview__preview_*`)
     are available, use `preview_start` (it reads/creates `.claude/launch.json` — add a static-server
     entry such as `bunx serve -l {port} .planning/design/{SLUG}` or `python3 -m http.server {port} -d
     .planning/design/{SLUG}`). This renders concepts **inside the internal browser** so the user sees
     them inline.
   - **Fallback — plain local server:** if the preview tools are NOT available, start the static server
     yourself with **Bash in the background** (`bunx serve -l {port} .planning/design/{SLUG}` or
     `python3 -m http.server {port} -d .planning/design/{SLUG} &`), capture the PID, and **give the user
     the port/URLs to open in their own browser** (e.g. `http://localhost:{port}/concepts/gallery-r{N}.html`).
2. **Screenshot each concept — if available.** If `preview_screenshot` (or another screenshot tool) is
   available, capture each concept into `screenshots/r{N}c{M}.png` and reference them when presenting. If
   no screenshot tool is available, **skip screenshots** and rely on the live URLs — say so plainly
   ("Screenshots unavailable in this environment — open the URLs below"). Never block the round on
   screenshots.
3. **Verify each renders.** Best-effort: if `preview_inspect`/`preview_eval` are available, check no
   console errors and that key surfaces are present; otherwise do a **Bash structural check** of each HTML
   file (well-formed, contains the expected marker text/ids). A concept that errors is re-generated or
   dropped, with a note. For `cli`/`tui`, **run each sketch in Bash** and capture its output instead of
   serving/screenshotting.
4. **Stop the server when the round (or polish step) ends** — `preview_stop` for the MCP server, or kill
   the background PID for the Bash fallback. Don't leave a server running across invocations.

Update `state.md` concepts table (`built`/`failed`) and `## Stage: round-{N}-presented`.

### B4 — (Optional) Critic pass
For a larger round, or when convergence is slow, spawn `design-critic` on the round to surface gaps,
missing states, and which directions are strongest/weakest. Fold its read-only findings into the
presentation so the user chooses well. Skip for small/simple rounds.

---

## Phase C: Converge

**Goal:** narrow to a single winner.

### C1 — Present the round (no auto-advance)
Present round N as visible text **before** any question:
- The **screenshots** (reference them by path), each with its id + art-direction one-liner.
- **How to explore** — the live local URL for each concept (and the gallery), so the user can click
  through.
- A short, honest read on each direction (and the critic's notes, if run) — strengths and trade-offs.

### C2 — The pick gate (human)
Use `AskUserQuestion`:
- Question: *"Round {N}: which direction wins?"*
- Header: `Round {N}`
- Options (one per concept, each `description` a self-contained one-liner of its art direction), **plus**:
  - *"Mix two — synthesise"* (the system also appends a free-text "Other" for custom mixes)
  - *"New round — fresh directions"*
- multiSelect: false

Resolve:
- **Winner picked** → record `## Winner:`, mark losers `removed` in the concepts table, **delete the
  losing concept files** (keep screenshots), **promote** the winner to `.planning/design/{SLUG}/index.html`
  (move/copy), set `## Stage: winner-polish`. Proceed to Phase D.
- **Mix / synthesis** → capture which concepts and what to combine; seed the **next round** with that
  synthesis brief (one concept that fuses the chosen directions, plus any fresh siblings the user wants).
  Loop to Phase B as round N+1.
- **New round** → capture what to change ("warmer", "denser", "more playful"), update the per-concept
  directions, loop to Phase B as round N+1 with fresh directions.

> The rounds loop (B → C) repeats until there is a winner **or the user stops**. Never force convergence;
> never cap rounds. Each round is a clean stop-and-resume — one round per invocation is fine.

---

## Phase D: Polish & iterate

**Goal:** evolve the single winning prototype until the user is happy — with the full feature set, fixes,
and refinement.

### D1 — Iterate the winner
Work on `.planning/design/{SLUG}/index.html` directly with the user: complete the feature set from
`concept-spec.md`, fix rough edges, refine the design. Keep it a self-contained prototype.

### D2 — Verify every change in a real preview (mandatory)
**Never assume a change worked.** After each meaningful change, use the **same availability-aware preview
chain as B3** — always serve a live URL, screenshot if a screenshot tool is available (else point the user
at the URL), and prefer the internal browser preview when present:
- Re-serve and, **if available**, **screenshot** the affected surface(s); if no screenshot tool, show the
  user the live URL to open.
- **Check the DOM / behaviour** (`preview_inspect`/`preview_eval` if available, else a Bash structural
  check; run the sketch for cli/tui) — the element exists, the interaction fires, no console errors, both
  themes if themed.
- Show the user the result (screenshot or URL).

### D3 — The "happy?" gate (human)
After a coherent batch of changes, `AskUserQuestion`: *"Happy with this, or keep refining?"* — options:
*"Capture the design context"* (→ Phase E) · *"Keep refining"* (stay; `## Stage: iterating`) · *"Try a
new round instead"* (→ Phase B, rare). Loop D until the user is satisfied. Update `state.md` each pass.

---

## Phase E: Capture the design context

**Goal:** produce the durable, reusable output and hand it off.

### E1 — Save the final design files
Finalise the winner in `.planning/design/{SLUG}/`:
- Ensure `index.html` is the complete, runnable prototype.
- **Extract** styles and logic into `styles.scss` and `app.js` (web) — or finalise the runnable
  sketch(es) for cli/tui — so the design is legible. Label all of them as **demo/reference**, not source.

### E2 — Synthesise `design-context.md`
Spawn the **`design-synthesizer`** agent. It reads the final prototype + `concept-spec.md` and writes
`.planning/design/{SLUG}/design-context.md` using `design-context-template.md`. It **MUST**:
- Emit the **§0 "spec, not source" callout verbatim** (only `{NAME}` + the conventions line substituted).
- Populate **every** section from the actual prototype — no `TBD`, no invented features.
- Produce an **exhaustive inventory** (every screen/region/overlay/menu/modal/transient/component).

Verify the returned file has §0 present and no empty sections before continuing (the synthesizer's
output contract reports this; re-spawn once if it failed).

### E3 — Update the registry & state
Write the `## complete` row into `.planning/design/index.md`; set `state.md` `## Stage: complete`,
`## Winner:`, and the final `## Recovery`/`## Next Action:`.

### E4 — Hand off (restate the spec-not-source reminder)
Close by telling the user what was produced **and** restating the principle, verbatim in spirit:

> "Design captured → `.planning/design/{SLUG}/design-context.md`. **This is a specification, not source.**
> The prototype in this folder is throwaway demo code — when you build, **re-implement it from scratch**
> on the real stack with all the project's conventions (for web: moku-web islands, `@scope`/`@layer`,
> `data-*` only, tokens, one route table). Never copy the prototype's CSS/JS/DOM or its bugs.
>
> Next: feed it to planning — `/moku:plan create app "{TARGET}" --context design/{SLUG}/design-context.md`
> — or explore architecture first with `/moku:brainstorm`. `/moku:plan` will carry the
> re-implement-don't-copy instruction into its planning agents automatically."

Pick the `plan` VERB/TYPE from the project (`create app` for a new Layer-3 app; `update app`/`add plugin`
when extending an existing one).

---

## Context carried forward / back

- **Into generators:** concept id + output path, `concept-spec.md`, the per-concept art direction,
  MEDIUM + prototype rules, the disposable-demo framing.
- **Into the synthesizer:** the final prototype path, `concept-spec.md`, SLUG/TARGET/SCOPE/MEDIUM, and
  the mandate to emit §0 verbatim + an exhaustive inventory.
- **Out (the durable output):** `.planning/design/{SLUG}/design-context.md` + the registry row — consumed
  by `brainstorm`/`plan`/`build`, which forward the re-implement-never-copy instruction to their agents.
