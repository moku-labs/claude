# The three exemplars, side by side

The moku-labs family ships three reference READMEs. Each is the canonical form for one
repo *shape*. When authoring a new root README, find the closest shape here and follow
its section order. These are the source of truth — fetch them when this skill and the
live file disagree (the live file wins).

| Repo | Shape | Tagline style | Central table(s) | Mermaid | Status callout |
|---|---|---|---|---|---|
| [common](https://github.com/moku-labs/common) | library / catalog | **bold** | `Catalog`, `Entry points` | none | `[!NOTE]` "0.x — early" |
| [web](https://github.com/moku-labs/web) | framework | bold subtitle + elaboration | `Plugins`, `Rendering modes` | 2× `flowchart` | `[!NOTE]` + `[!TIP]` |
| [claude](https://github.com/moku-labs/claude) | toolkit / CC plugin | *italic* + witty hook | `Commands` / `Agents` / `Skills` / `Hooks` / `Workflows` | 1× `flowchart LR` | `[!IMPORTANT]` |

---

## common — library / catalog

Section order: `Install` → `Why @moku-labs/common` → `Catalog` → `Usage` →
`Entry points` → `Scripts` → `Requirements` → `License`.

What to copy:

- **Bold tagline** ("Shared, framework-agnostic plugins for the Moku family.") + a
  paragraph that ends on define-by-negation ("No framework of its own, no lock-in.").
- `<br/>`-separated badge row: npm · types · browser-entry · node · MIT — each linking
  to an in-page anchor.
- The **Catalog table** is the doc's spine: `| Export | Kind | Responsibility |`, with
  each export name linking to its source README.
- `Scripts` block lists every `bun run …` with aligned `#` comments.
- `Requirements` = Node ≥ 24 · Bun ≥ 1.3.14 · TS strict + the `@moku-labs/core` link.

## web — framework

Section order: `Why @moku-labs/web` → `Quick start` → `How it works` →
`The route is the contract` → `Plugins` → `Rendering modes` → `Scripts` →
`Requirements` → `Docs` → `License`.

What to copy:

- **Quick start shows two code blocks** (routes + app entry) plus a file-tree, so the
  reader sees a working shape immediately.
- `How it works` carries **two mermaid flowcharts** (architecture layers; build-vs-client
  render), color-coded by layer.
- A dedicated **"the contract" section** names the core abstraction in one aphorism
  ("The route IS the contract: load → render → head") — the line you remember.
- `Plugins` table links each plugin to its own docs; `Rendering modes` is a 4-row matrix
  with a `> [!TIP]`.
- Closes with a `Docs` link list before `License`.

## claude — toolkit / Claude Code plugin

Section order: `What this is` → `Install` → `The workflow` → `Commands` → `Agents` →
`Skills` → `Hooks` → `Dynamic workflows` → `Output styles` → `Configuration` → `License`.

What to copy:

- Opens with a tight **`What this is`** paragraph, not a "why" list, plus a witty italic
  hook under the H1 ("In which one AI orchestrates twenty other AIs…").
- Install uses `/plugin marketplace add` + `/plugin install` with a `> [!IMPORTANT]`
  giving the exact, correct command.
- **`The workflow`** = a mermaid `flowchart LR` (teal "you/outcome", blue machinery) plus
  a numbered `text` block of the real command sequence.
- Dense **grouped tables**: `Commands` (command | what it does), `Agents` grouped by
  role, `Skills`, `Hooks` (when | what happens), `Dynamic workflows`.
- The voice leans hardest into dry self-aware wit here — it documents its own
  "wall-of-text validator" and jokes about it. Clarity still wins.
- Footer adds an attribution flourish over the canonical `[MIT](./LICENSE) © [moku-labs]`.

---

## Picking a shape

- Publishes to npm as a reusable plugin pack with no `createApp` → **library** (common).
- Has a `createApp` / its own runtime + plugins → **framework** (web).
- A Claude Code plugin / dev tool (commands, agents, skills, hooks) → **toolkit** (claude).
- A Layer-3 app someone *runs* → **consumer app** (see `template.md` app deltas).
