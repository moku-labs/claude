---
description: >
  Design-exploration process — multi-round, human-in-the-loop concept generation that produces a
  reusable design context (a spec, not source) to ground brainstorm/plan/build. Accepts free-form
  natural language.
  <example>Context: A Layer-3 web app needs its UI designed before planning. user: "/moku:design redesign the settings page" assistant: frames the page, generates N concept prototypes in parallel, converges on a winner, polishes it in a live preview, and captures design-context.md</example>
  <example>Context: A design is mid-flight from a previous session. user: "/moku:design" assistant: resumes the in-progress design from its exact saved stage</example>
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion, Skill, EnterPlanMode, ExitPlanMode, mcp__Claude_Preview__preview_start, mcp__Claude_Preview__preview_screenshot, mcp__Claude_Preview__preview_inspect, mcp__Claude_Preview__preview_eval, mcp__Claude_Preview__preview_stop, mcp__Claude_Preview__preview_list
argument-hint: {free-form: what to design} or [resume|list] [target] [--count N] [--rounds] [--medium web|cli|tui]
disable-model-invocation: true
---

## Moku Core Specification (authoritative)

Before any decision about architecture, the core API, factory chain, config, lifecycle, events, the `ctx` object, types, invariants, or plugin structure — **consult `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/spec-index.md` and open the cited `spec/NN-*.md` file.** The spec is the single source of truth; never rely on memory or guess. Cite spec section IDs (`spec/NN-*.md §N`) in output. Never stage or commit `.planning/` — it is local-only state. **Note:** `/moku:design` does not write source code — it produces a *design specification*. Spec grounding here is for the **scope gate** (deciding whether/what a project can design) and for the conventions the design context tells downstream agents to honour.

## ⚠️ A design context is a SPECIFICATION, never source

This command's prototypes — the HTML/CSS/JS (or sketches) under `.planning/design/{slug}/` — are **throwaway demo code**: deliberately quick, dirty, buggy, and un-idiomatic. They exist for ONE purpose — to communicate **look, feel, behaviour, and the screen/element inventory** so a human can judge the design and a later builder can re-implement it. They are **NOT** built to this framework's standards.

The durable output is `design-context.md`: a **non-technical design specification.** Whoever builds from it **MUST re-implement the design from scratch**, honouring **all** of this project's conventions (for a Layer-3 web app: moku-web islands, `@scope`/`@layer` CSS, `data-*` attributes — never class selectors, the design-token system, one route table, a node-free client bundle, readable-code). They **MUST NOT** copy or lift the prototype's source, port its DOM/class names/behaviour 1:1, or treat it as a scaffold. **The design context says WHAT to build; the framework conventions say HOW.** This command restates that reminder on hand-off, the `design-context-template.md` opens with it verbatim, and `/moku:plan` + `/moku:build` carry it into their agents.

## Input — natural language first

`$ARGUMENTS` may be **natural language** — you don't need exact flags. Resolve intent per **`${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/nl-args.md`**: map the request onto this command's documented controls (target/scope/medium/count + `resume`/`list` and flags), echo a one-line `Interpreting as: …`, then proceed. If a **required** value is missing or ambiguous, ask only for that gap. Already-structured input is used verbatim (no echo). NL never bypasses this command's human gates.

## Project Configuration
!`test -f .claude/moku.local.md && head -20 .claude/moku.local.md || true`

Explore the **design** of a project (or one page, or one element) before planning and building. A run is a multi-round, human-in-the-loop process — generate N distinct concepts, converge on a winner, polish it in a real browser preview, then **capture a reusable design context.** The output is `.planning/design/{slug}/design-context.md`, consumed by `/moku:plan ... --context`.

This command runs the design-exploration workflow (phases A–E):
1. **Frame** — resolve target/scope/medium (scope gate), consume any brainstorm context, write a shared concept spec (feature checklist + frozen demo data).
2. **Generate** — N distinct concept prototypes in parallel (one `design-generator` each), assembled into a gallery, screenshotted, presented.
3. **Converge** — the user picks a winner, asks for a mix, or calls a new round. Loop until there's a winner.
4. **Polish** — evolve the winner with the user; **every change verified in a real preview.**
5. **Capture** — save the design files and write `design-context.md` (via `design-synthesizer`).

**Each design is independent and isolated** under `.planning/design/{slug}/` with its own state — design the whole app, then later redesign just the footer, then a popup, then "try something new," without collision.

---

## Intent Normalization (Pre-Parse)

Normalize free-form input to this command's controls before strict parsing.

**Skip when:** `$ARGUMENTS` is empty (→ resume; Step 0.1), OR the first token is a recognized control verb (`resume`, `list`). Proceed directly to Step 0.

**When to normalize:** the input describes *what to design* (a target).

1. **Strip flags first:** extract `--count N`, `--rounds`, `--medium web|cli|tui` from anywhere.

2. **Wrong-command detection:**
   - Keywords suggesting **architecture/idea** exploration (no visual intent — "explore options", "what approach", "should we use X or Y") → likely `/moku:brainstorm`. Use `AskUserQuestion`: "This sounds like architecture exploration, not visual design. What would you like to do?" — options: "Brainstorm instead" (→ tell user to run `/moku:brainstorm {rest}` and stop) · "Keep designing" (proceed).
   - Keywords suggesting **planning/building** ("plan", "spec", "implement", "build", "scaffold the code") → Use `AskUserQuestion`: "This sounds like planning/building, not design exploration. What would you like to do?" — options: "Plan instead" (→ `/moku:plan {rest}`, stop) · "Build instead" (→ `/moku:build resume`, stop) · "Keep designing" (proceed).

3. **Extract intent:**
   - **TARGET:** the thing being designed (the descriptive phrase) — e.g. "the settings page", "a delete-confirmation popup", "the whole app, a kanban tracker".
   - **SCOPE:** infer — "app", "the whole app", "the product" → `app`; "page", "screen", "view", "dashboard" → `page`; "popup", "modal", "menu", "button", "footer", "card", "toast", "drawer", "element", "component" → `element`. If unclear, default `page` and confirm in framing.
   - **MEDIUM:** infer if obvious ("terminal", "CLI", "TUI", "wizard", "console" → `cli`/`tui`; otherwise leave unset for the scope gate to resolve — usually `web`).
   - **COUNT:** parse explicit counts ("six concepts", "just three", "a dozen") → COUNT; else default 6.

4. **Log and proceed:** `Interpreting as: /moku:design "{TARGET}" [--count N] [--medium M]` (omit defaults).

**Examples:**
| User types | Interpreting as |
|---|---|
| `redesign the settings page` | `/moku:design "the settings page"` (scope=page) |
| `a delete-confirmation popup` | `/moku:design "a delete-confirmation popup"` (scope=element) |
| `the whole app — a kanban tracker, show me 8 looks` | `/moku:design "the whole app, a kanban tracker" --count 8` (scope=app) |
| `design the init wizard's terminal flow` | `/moku:design "the init wizard flow" --medium tui` |

---

## Step 0: Parse Arguments & Guards

**Ordered startup sequence (run in this exact order):**

1. **Filesystem guard (mandatory):** `mkdir -p .planning/design/` (creates `.planning/` if absent). This must run before any state or concept write. `.planning/` is gitignored — never commit it.

2. **Control verbs & empty input:**
   - `$ARGUMENTS` empty, or first token `resume` → go to **Step 0.1 (Resume)**.
   - First token `list` → go to **Step 0.1 (List)** — print the registry and stop.

3. **Flag extraction (strip from `$ARGUMENTS`):**
   - `--count N` → COUNT=`N` (positive integer; if ≤ 0, stop: "`--count` must be a positive integer."). Default COUNT=6.
   - `--rounds` → ROUNDS_HINT=true (informational — rounds are never capped).
   - `--medium {web|cli|tui}` → MEDIUM forced to that value (the scope gate still runs). Invalid value → stop: "`--medium` must be `web`, `cli`, or `tui`."

4. **Extract TARGET & SCOPE** from the remaining text (per Intent Normalization). If TARGET is empty after parsing, use `AskUserQuestion`: "What do you want to design?" — options: "The whole app" (app) · "A single page/screen" (page) · "One element (popup, menu, footer…)" (element) · (free-text "Other"). Set SCOPE from the choice; ask a one-line follow-up for the specific TARGET.

5. **Derive SLUG** from TARGET (slugify: lowercase, `[a-z0-9-]`, spaces→`-`, strip stop words, max 50 chars, no path separators; per `design-stages.md §1`).

6. **Existing-design guard:** if `.planning/design/{SLUG}/state.md` already exists, use `AskUserQuestion`: "A design for `{SLUG}` already exists ({stage from its state}). How do you want to proceed?" — options:
   1. "Resume (Recommended)" — continue from its saved stage (→ Step 0.1 resume for this SLUG).
   2. "Start fresh" — back up `.planning/design/{SLUG}/` to `…/{SLUG}.bak-{n}/` (never delete a prior design outright), then begin a new framing.
   3. "New variant" — derive a fresh slug (`{SLUG}-2`, …) and design alongside the existing one.
   4. "Cancel" — stop.

7. **Run the Scope Gate BEFORE creating any files.** For a new design, do **not** write a workspace yet — first run the **Scope Gate** (below) to confirm the project has something to design and to resolve MEDIUM. If the gate declines (non-UI project, no DX surface intended), stop without creating a workspace — leave no empty design folder behind.

8. **Initialise the workspace** (only after the Scope Gate passes): `mkdir -p .planning/design/{SLUG}/concepts .planning/design/{SLUG}/screenshots`. Write an initial `state.md` (atomic `.tmp`→validate→rename) with `## Stage: framing`, the parsed TARGET/SCOPE/MEDIUM/COUNT, `## Winner: (none)`, and a `## Recovery` block, per the schema in `design-stages.md §2`. Add/refresh the row in `.planning/design/index.md` (create the registry if absent). Then continue at **Route to Flow**.

---

## Step 0.1: Resume / List from State

Read `.planning/design/index.md` (if absent, there are no designs).

**List** (`list`): print the registry table (slug · target · scope · medium · stage · winner · updated) and stop. Suggest `/moku:design resume` or `/moku:design "{new target}"`.

**Resume** (empty / `resume`, or chosen for a specific SLUG): follow `design-stages.md §4`:
- **Zero designs** → nothing to resume; use `AskUserQuestion` to ask what to design (as Step 0.4), then start fresh.
- **One in-progress design** (stage ≠ `complete`) → load its `state.md`, announce the restored stage from `## Recovery`, continue from `## Stage:`.
- **Multiple designs / explicit switch** → `AskUserQuestion` listing in-progress designs + "Start a new design" + completed ones (as reference). Resume the chosen one — this is also how the user **switches** designs.
- **A `complete` design chosen** → offer: "Iterate again" (→ `iterating`) · "Start a new design" · "Hand to plan" (print the `/moku:plan … --context` line).

Re-enter the exact stage per the resume table in `design-stages.md §4`, then continue at **Route to Flow**.

---

## Scope Gate — is there anything to design?

Before framing a **new** design, run the scope gate from **`${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/design-medium.md`** (skip on resume — the medium is already recorded):

1. **Detect the project** the same way `check`/`plan` do: read `.claude/moku.local.md` if present; check `src/config.ts` for `createCoreConfig` (Framework, Layer 2); check for a `createApp` import from a framework package (Consumer App, Layer 3) and note that package; else `package.json` only (Tools/Library); else not a Moku project (decline like `check`).
2. **Gate** (design-medium §2):
   - **Consumer App (Layer 3)** on a web framework → `MEDIUM=web` (the common case) — proceed.
   - **Consumer App** on a CLI/TUI framework → `MEDIUM=cli`/`tui` — proceed with the terminal format.
   - **Framework / Tools/Library** → usually **nothing to design**. **Decline gracefully** with the guidance in design-medium §2 **unless** the user is explicitly designing a **DX surface** (a CLI flow, an interactive setup/"show", a branded console) — then switch to `MEDIUM=cli`/`tui`. Offer the redirect via `AskUserQuestion` (Design a CLI/TUI surface · Switch to brainstorm · Cancel).
   - **Not a Moku project** → decline like `check`.
3. **Never assume `web` blindly.** Resolve MEDIUM from a `--medium` flag, detection, the user's words, or one `AskUserQuestion`. Hold the resolved MEDIUM as a variable — it is written into `state.md` (`## Medium:`) when the workspace is initialised (Step 0 step 8). On resume, the gate is skipped and MEDIUM is loaded from `state.md`.

**On pass:** return to **Step 0 step 8** — initialise the workspace (now that MEDIUM is known and the project can be designed), then continue to **Route to Flow**. **On decline:** stop here; no workspace is created.

---

## Route to Flow

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/design-flow.md` and follow it.

Context variables passed through: **TARGET, SCOPE, MEDIUM, SLUG, COUNT, BRAINSTORM_CONTEXT** (a matching `.planning/context-*.md` or `(none)`), and **STAGE** (the resume point from `state.md`).

Detect **BRAINSTORM_CONTEXT** before routing: if a `.planning/context-{name}.md` exists whose feature matches TARGET, set it and tell the user "Found a brainstorm context for `{name}` — grounding the concepts in it." (design-flow Phase A2 reads it).

---

## Rules

- **Write protection:** Write/Edit may target **only** files under `.planning/design/{SLUG}/` (state, concept-spec, concept prototypes, the winner, screenshots, design-context) and `.planning/design/index.md`. Never create, modify, or delete source files (`src/`, tests, project configs) — design is exploration; code happens later, re-implemented from scratch. The prototypes are demo artifacts and live only under `.planning/design/`.
- **Never write `.planning/STATE.md`** — design state is separate from plan/build state (it lives in `.planning/design/{SLUG}/state.md`). Never commit `.planning/` (gitignored).
- **State is atomic & resumable:** write `state.md` via `.tmp`→validate→rename, refresh the `## Recovery` block every write, and update the registry row — so a bare `/moku:design` resumes from the exact stage (`design-stages.md`).
- **Stop at every human gate, never auto-advance:** the round pick (winner/mix/new-round), the polish "happy?" gate, and final capture are all human decisions. One round (or one polish batch) per invocation is fine — resume continues.
- **Load the design skill first (quality lever):** at the start of a design run (framing), **invoke the official `frontend-design` skill** via the `Skill` tool so its aesthetic guidance is loaded for the whole run — this is the biggest lever on concept quality. Derive a distinct, skill-informed art direction per concept and pass it to each generator. Each `design-generator` also declares `frontend-design` in its `skills`, but the orchestrator loading it here is the guaranteed path. (See design-flow Phase A0.)
- **Concepts are parallel and isolated:** spawn one `design-generator` per concept in a single response; each writes only its own concept file. Same features + same frozen demo data across all concepts — only the design varies. Use the loaded **`frontend-design`** skill to push each art direction to a real, distinct point of view.
- **Always serve a live preview; degrade by availability (never assume a change works):** every round and every polish change must be shown in a **real preview** before presenting (design-flow B3/D2). **Always serve** the workspace on a local port so the user gets live URLs. Prefer the **internal browser preview** (`mcp__Claude_Preview__preview_*`) when available and **screenshot** each concept; if screenshots aren't available, **skip them and give the user the port/URLs** to open in their own browser; if the preview MCP isn't available at all, start a **Bash background static server** (`bunx serve`/`python3 -m http.server` over `.planning/design/{SLUG}/`) and hand over the URLs. Verify via DOM/console checks when available, else a Bash structural check (run the sketch for cli/tui). Stop the server when the step ends. A change is not "done" until a screenshot **or** a live URL shows it.
- **Capture is non-technical & exhaustive:** `design-synthesizer` writes `design-context.md` with the **verbatim §0 "spec, not source" callout** and an **exhaustive** screen/element inventory. Verify §0 is present before hand-off.
- **Restate spec-not-source on hand-off (mandatory):** when a design completes (or you hand the context to `plan`), repeat the reminder verbatim in spirit (design-flow Phase E4): the prototype is throwaway demo code; re-implement from scratch with all plugin conventions; never copy its source or replicate its bugs. Then print the `/moku:plan … --context design/{SLUG}/design-context.md` next step.
- **Design never plans or builds:** this command only explores design and writes a context. After capture, recommend `/moku:plan` (or `/moku:brainstorm` first). It must never invoke plan/build steps or write source code.

## Examples

- `/moku:design redesign the settings page` — design one page; framing → round 1 (6 concepts) → converge → polish → capture `design/settings-page/design-context.md`.
- `/moku:design a delete-confirmation popup` — element scope; concepts show the popup in every state (default/confirm/danger/loading) over the frozen demo data.
- `/moku:design "a kanban tracker" --count 8` — whole-app design, 8 concepts per round (the tracker-v2 "Atlas" run is the worked example).
- `/moku:design` (bare) — resume the in-progress design from its exact stage; if several exist, pick which to resume/switch.
- `/moku:design list` — show every design workspace and its stage.
- `/moku:design` in a pure framework project — the scope gate declines gracefully (nothing to design) and offers a CLI/TUI/DX surface or `/moku:brainstorm` instead.

## Run unattended (optional `/goal`)

`/goal` can run the rounds/polish loop toward a finish condition without re-prompting each gate. The plugin cannot set a goal for you; **offer this ready-to-paste line** as a closing tip when the user wants an unattended run:

> ```
> /goal .planning/design/{SLUG}/design-context.md exists, it opens with the "spec, not source" §0 callout, its inventory lists every screen/panel/popup, and writes stayed within .planning/design/ — or stop after 15 turns
> ```

Phrase conditions as something the transcript can demonstrate; the turn cap guards against runaway loops. `/goal clear` cancels it.
