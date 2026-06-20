# Design Medium — detection & branching

`/moku:design` produces a design context, but **only some projects have something to design**, and the
*medium* of that design varies. This reference defines (1) the **scope gate** — whether a project has
anything to design at all — and (2) how the concept format, prototype files, and inventory **branch by
medium**. The `design.md` command runs the gate before any work; `design-flow.md` branches on the
resolved `MEDIUM` throughout.

Reuse the same project detection that `init`, `plan`, and `check` use — never re-invent it.

---

## 1. Project detection (shared with init / plan / check)

Detect the project layer the same way `check.md` does:

- `src/config.ts` with `createCoreConfig` → **Framework (Layer 2)**
- a `createApp` import from a framework package (e.g. `@moku-labs/web`) → **Consumer App (Layer 3)**
- `.claude/moku.local.md` may record the project type explicitly — read it first (`head -20`) if present
- `package.json` only → **generic Tools/Library**
- none of the above → not a Moku project (the command declines, like `check`)

Also note the **framework package** a consumer depends on — `@moku-labs/web` strongly implies a **web**
medium; a CLI/TUI-oriented framework implies a terminal medium.

---

## 2. The scope gate — is there anything to design?

> A design context is meaningful in **most cases only for Layer-3 consumer-app projects** — they have a
> UI to design. For framework / library / Layer-1–2 projects there is usually **nothing to design
> visually**. Only **rarely**, and mostly for **utility / DX** reasons, would you design a **CLI / TUI /
> interactive "show"** (e.g. a hierarchical interactive terminal experience, a branded setup wizard).

Apply the gate **before** framing any design:

| Detected project | Default | Action |
|---|---|---|
| **Consumer App (Layer 3)** on a web framework | `MEDIUM=web` | Proceed — this is the common, expected case. |
| **Consumer App (Layer 3)** on a CLI/TUI framework | `MEDIUM=cli`/`tui` | Proceed with the terminal concept format (§3). |
| **Framework (Layer 2)** | gated | There is usually nothing to design. **Decline gracefully** with guidance (below) **unless** the user is explicitly designing a **DX surface** — a CLI, an interactive setup/"show", a branded console experience — in which case switch to `MEDIUM=cli`/`tui`. |
| **Tools/Library** | gated | Same as Framework — only proceed for a CLI/TUI/DX surface. |
| **Not a Moku project** | — | Decline like `check`: not a Moku project. |

**Never assume `web` blindly** — always resolve `MEDIUM` from detection, the user's words, or a single
`AskUserQuestion`. When the user's target makes the medium obvious ("redesign the settings page" → web;
"design the `init` wizard's terminal flow" → cli/tui), take it; otherwise ask once.

**Graceful decline (non-UI project, no DX surface intended).** Do not silently produce an empty design.
Tell the user plainly and offer the productive paths:

> "This looks like a {Framework / Tools} project (Layer {2}), which usually has no visual UI to design.
> `/moku:design` is for Layer-3 app UIs and, occasionally, CLI/TUI/DX surfaces. If you want to design a
> **terminal experience** for this project (a CLI flow, an interactive setup, a branded console), tell
> me and I'll run in `--medium cli` (or `tui`). Otherwise, for architecture exploration use
> `/moku:brainstorm`, and to plan the build use `/moku:plan`."

Offer this as an `AskUserQuestion` (Design a CLI/TUI surface · Switch to brainstorm · Cancel) so the user
can redirect in one click. Record the resolved decision in the design's `state.md` (`## Medium:`).

---

## 3. How concepts differ by medium

The **process** (frame → generate N concepts → converge → polish → capture) is identical across media.
What changes is the **artifact** each generator produces and the **inventory** the synthesizer captures.

### `web` (the common case)
- **Concept artifact:** one **self-contained, runnable, clickable HTML file** per concept — inline CSS
  and JS, Google-Fonts links only, no build step, no external assets. Open-in-a-browser is the demo.
- **Art direction per concept:** a *distinct* font pairing, palette, personality, and signature
  interaction. Same features, same demo data — only the design varies.
- **Verification:** served locally and **screenshotted** in a real browser; DOM/console checked (no
  errors) before presenting.
- **Inventory (template §6):** screens / persistent regions / overlays / menus / modals / transient
  elements / recurring components (tables A–G).
- **Re-implement-as:** moku-web islands, `@scope`/`@layer` CSS, `data-*` only, design tokens, one route
  table, node-free client bundle (moku-web Rules R1–R7).

### `cli`
- **Concept artifact:** a **runnable sketch** (a small standalone script — `bun`/node TS or a shell
  script — that prints the real frames) **and/or** an **ASCII/ANSI mockup** file showing the command
  output, prompts, and states. Colour via ANSI is welcome; keep it self-contained.
- **Art direction per concept:** a distinct *voice & texture* — prompt style, colour usage, box-drawing
  vs plain, density, spinner/feedback character, how errors read.
- **Verification:** run the sketch in a terminal (Bash) and capture its output; confirm every state
  renders. (No browser screenshots.)
- **Inventory (template medium variant):** commands & subcommands / prompts & steps / output states &
  frames / recurring render components.
- **Re-implement-as:** the branded CLI kit (`@moku-labs/common/cli` — `createBrandConsole`, `box`,
  `spinnerFrameAt`, styled `confirm`/`select`), `ctx.log`/`ctx.env`, readable-code style (moku-common
  MC1–MC3).

### `tui` / interactive "show"
- **Concept artifact:** a **runnable terminal sketch** demonstrating the interactive flow (navigation,
  selection, live regions) — or, when a faithful runnable sketch is impractical, a **storyboard** of
  ANSI frames showing each interactive state and the transitions between them.
- **Art direction per concept:** layout regions, focus/selection language, key grammar, motion/refresh
  feel, how a hierarchical/branching experience is navigated.
- **Verification:** run interactively where feasible (Bash), else walk the storyboard frames; confirm
  every state and transition is represented.
- **Inventory:** screens/regions become **views & panes**; menus become **key-driven navigation**;
  modals become **focused prompts**; transient elements become **status/live regions**.
- **Re-implement-as:** the project's terminal idioms + the branded CLI kit; readable-code style.

---

## 4. What carries through, unchanged, in every medium

- The **shared concept spec** (feature checklist + frozen demo data) so concepts are comparable.
- The **"spec, not source" callout** at the top of `design-context.md` — only the conventions line is
  swapped for the medium's idioms.
- The **re-implement-from-scratch / never-copy** instruction, forwarded by `plan`/`build` to their
  agents regardless of medium.
- The per-design isolation, state, rounds loop, and human gates (`design-stages.md`).
