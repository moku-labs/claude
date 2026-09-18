# Design Context Template

The template for `design-context.md` — the single human-readable output of `/moku:design`. It is the
**design specification** the rest of the Moku workflow (`brainstorm` → `plan` → `build`) consumes. The
`design-synthesizer` agent writes it from the final, polished prototype; `/moku:plan` and `/moku:build`
read it to learn **what** to build (never **how** — see the callout below).

This template **is** the quality bar — it is self-contained. Calibrate to the section shapes and the
inventory tables below; you do not need any external example to produce a complete design context.

**Two hard rules for the synthesizer:**

1. The document **MUST open with the "spec, not source" callout** reproduced verbatim in §0 below
   (only `{NAME}` and the conventions line are substituted). This is non-negotiable — it is the
   single most important thing the document does, and `/moku:plan` and `/moku:build` rely on it being
   present to forward the "re-implement, never copy" instruction to their agents.
2. **Every section must be populated** from the actual prototype — no `TBD`, no placeholder prose, no
   invented features. The inventory (§6) must list **every** screen, panel, popup, menu, modal,
   transient element, and component the prototype actually contains.

Saved to `.planning/design/{slug}/design-context.md`.

---

## Template (web medium)

````markdown
# {NAME} — Design Context

> *"{one-line tagline / the feeling}"*
> {1–2 line description of what this is and the emotion it targets.}
> This document is the full design picture: how it feels, how it works, and every screen and
> element in it. It is intentionally non-technical — a brief for whoever reimplements {NAME} on the
> real stack.

## 0. ⚠️ How to use this document — spec, not source

**This is a design specification, not a codebase.** It captures *what* {NAME} looks like, feels like,
and how it behaves — the visual language, the interaction grammar, and the complete inventory of every
screen and element. It exists to be **re-implemented from scratch** on the real stack.

The prototype files referenced below (the HTML / CSS / JS in this folder) are **throwaway demo code** —
deliberately quick and dirty, buggy, and un-idiomatic. They were built for ONE purpose: to communicate
look, feel, behaviour, and the screen/element inventory. They are **NOT** built to this project's
framework standards, and their bugs are not part of the spec.

Therefore, whoever implements this **MUST NOT**:
- copy or lift source (CSS / JS / HTML) from the prototype,
- port its DOM structure, its class names, or its (buggy) behaviour 1:1,
- treat the prototype as a starting point or scaffold for real code.

They **MUST re-implement from scratch**, honouring **all** the patterns and conventions this project
requires. For a Layer-3 Moku web app that means the **moku-web** island architecture, `@scope` / `@layer`
CSS, `data-*` attributes (never class selectors — Rule R5), the design-token system, the one-route-table
rule (R2), the node-free client bundle (R3), and readable-code style — see the **moku-web** skill
(`references/project-spec.md`, Rules R1–R7) and **moku-readable-code**. **This document tells you WHAT to
build; the framework conventions tell you HOW.**

**Files in this folder**
| File | What it is |
|------|-----------|
| [`index.html`](./index.html) | The complete, runnable prototype. Open it in a browser — everything below is live and clickable. The behavioural source of truth — but **demo-quality**, not code to copy. |
| [`styles.scss`](./styles.scss) | The full stylesheet extracted from the prototype (theming, layout, every component). Reference for **intent**, not a file to lift. |
| [`app.js`](./app.js) | All interaction logic extracted from the prototype. Reference for **behaviour**, not a file to lift. |
| `design-context.md` | This document. |

{1–2 sentences on what is real vs stubbed in the prototype — e.g. "front-end only; demo data held in
memory; only session/theme/filters persisted; no backend."}

---

## 1. The idea
{1–2 paragraphs: the concept and the core feeling. What is it, who is it for, and the single
organising idea that makes it distinctive. State what makes it feel the way it does.}

## 2. Look & feel
**Personality —** {the art direction in a phrase — e.g. "Editorial / Swiss-modernist, warm and
print-precise."}

**Typography —** {the type voices and what each is used for. Name the fonts (Google Fonts only in the
prototype) and the role each plays.}

**Colour —** {the palette: ground, ink, accent(s); light and dark behaviour; how semantic colours
(labels, priorities, status) are used. State the restraint rules.}

**Surface & rules —** {borders, cards, depth, elevation — the material language.}

**Motion —** {what animates and how restrained; respect for "reduce motion".}

**Theming —** {light/dark story; toggle location; what's remembered; OS-preference behaviour.}

## 3. How it is organised (information architecture)
{The nesting / structure of the product, top to bottom. A small diagram is welcome:}
```
{e.g. Department → Board → Column → Card → Issue page}
```
{1 line per level explaining what it is. Note which things can be renamed / reordered / customised /
moved / deleted, and that those gestures are consistent (see §4).}

## 4. The interaction language (consistent everywhere)
{The reusable interaction grammar — the patterns that repeat across the whole product so a user learns
them once. For each: what it is, where it appears, and how it behaves. Examples: the universal "⋯" menu,
double-click-to-rename, customise (colour/icon), delete-always-confirms, filtering, drag-to-reorder,
toasts. This section is what keeps the design coherent — be specific.}

## 5. Layout & page behaviour
{How the layout flows and responds: document-flow vs fixed window, how content grows, how it compacts
on short screens, the footer, and the **full mobile behaviour** (reflow, bottom sheets, swipe, tap
targets). Note anything that differs on mobile so the implementer reproduces it.}

## 6. Screens, panels & popups — the inventory
> The complete, exhaustive list of everything a user can see. Group by type. Note mobile differences
> inline. **Every** distinct surface in the prototype must appear in exactly one table below. This is
> the screen/element inventory the planner turns into pages, components, and islands — omissions here
> become missing features later.

### A. Full screens / pages
| # | Screen | What it is |
|---|--------|-----------|
| A1 | **{name}** | {what it is, its key regions, and any demo behaviour} |

### B. Persistent regions (chrome that is always present)
| # | Region | What it is |
|---|--------|-----------|
| B1 | **{name}** | {what it is and what it contains} |

### C. Overlays — panels & drawers (slide-in, non-modal)
| # | Overlay | What it is |
|---|---------|-----------|
| C1 | **{name}** | {what it is; desktop form vs mobile form} |

### D. Menus & small popups (anchored, transient)
| # | Popup | What it is |
|---|-------|-----------|
| D1 | **{name}** | {what it is; trigger; mobile form} |

### E. Modals & prompts (centered, dimmed backdrop)
| # | Modal | What it is |
|---|-------|-----------|
| E1 | **{name}** | {what it is; its buttons} |

### F. Inline & transient elements
| # | Element | What it is |
|---|---------|-----------|
| F1 | **{name}** | {toast / drop indicator / empty state / cap line / skeleton / etc.} |

### G. Recurring components (the building blocks)
{A prose or bulleted list of the atomic, reused components — cards, chips, avatars, rows, stat blocks,
rendered markdown, etc. — with the sub-parts each one carries.}

## 7. {Richest screen} in detail (optional but recommended)
{For the single most complex screen, a focused breakdown of its layout and every field/affordance —
mirror the level of detail in the tracker-v2 "Issue page" section. Omit if no screen warrants it.}

## 8. Demo content (so screens feel real)
{The fixed demo dataset that drives every screen — the same data the implementer should seed so the UI
looks populated and coherent. Entities, sample names, labels, counts. This is the "shared concept spec"
data, frozen.}

## 9. Notes for reimplementation (high level)
- **What's faithful:** {what in the prototype is final and should be treated as the visual + behavioural
  spec — screens, states, both themes, responsive behaviour.}
- **What's stubbed:** {persistence, auth, live data, anything faked — so the implementer knows what to
  wire to real systems.}
- **The non-negotiables:** {the handful of things that *make it this design* — lose these and it stops
  being {NAME}. The implementer must preserve these above all.}
- **Re-implement, don't port:** build this on the project's real stack and conventions (for web:
  moku-web islands, `@scope`/`@layer`, `data-*` only, tokens, one route table, node-free bundle). The
  prototype is the **what**, not the **how** — see §0.

---

*{NAME} — captured by `/moku:design`. Open `index.html` to explore; build it for real on the Moku stack.*
````

---

## Medium variant — CLI / TUI / interactive "show"

When `MEDIUM` is `cli` or `tui`, keep §0 (the callout — substitute the conventions line for the
medium's idioms, e.g. "the branded CLI kit `@moku-labs/common/cli`, `ctx.log`/`ctx.env`, readable-code
style — see the **moku-common** skill") and §1, §2 (→ *Voice & texture*: prompt style, colour usage,
box-drawing, spacing, spinner/feedback character), §3, §4 (→ *Command & key grammar*), §8, §9. Replace
the visual inventory (§5–§7) with a **terminal-surface inventory**:

### A. Commands & subcommands
| # | Command | What it does | Output shape |
|---|---------|--------------|-------------|

### B. Prompts & interactive steps
| # | Prompt | Type (confirm/select/input) | Behaviour |
|---|--------|-----------------------------|-----------|

### C. Output states & frames
| # | State | What it shows | When |
|---|-------|---------------|------|
{e.g. success frame, error frame, empty result, progress/spinner, table render, the help screen, a
"transient" status line.}

### D. Recurring render components
{boxes, tables, badges, the branded header, key-hint footer — the reused building blocks.}

The "design files" for a CLI/TUI design are runnable sketches and/or ASCII frames (see `design-medium.md`):
list them in the **Files in this folder** table in place of `index.html`/`styles.scss`/`app.js`, with the
same "reference for intent, not code to lift" labelling.

---

## Synthesizer checklist (verify before writing)

1. §0 callout present and verbatim (only `{NAME}` + the conventions line substituted).
2. Every section populated from the **actual** prototype — no `TBD`, no invented features.
3. §6 inventory is **exhaustive**: every screen/region/overlay/menu/modal/transient/component the
   prototype contains is listed exactly once, in the right group.
4. §8 demo content matches the data the prototype actually renders.
5. §9 names the non-negotiables and explicitly repeats "re-implement, don't port."
6. The **Files in this folder** table labels every prototype file as demo/reference, not source.
