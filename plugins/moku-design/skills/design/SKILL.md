---
name: design
description: Runs the moku design station. Explores the design of a change in rounds with the user and captures the result as a design context — a specification, never source. Three modes that can be combined - ui for screens and prototypes, api for the usage-first shape of a plugin or framework API, architecture for plugin boundaries and event flow. Use it when someone wants to see or decide how something will look, read or be structured before it is planned and built.
when_to_use: A change needs its look, its public API shape or its plugin boundaries decided before planning. Not for writing source code and not for architecture debates without an artifact.
argument-hint: "{what to design} or resume | list [--count N] [--medium web|cli|tui] [--mode ui,api,architecture]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion, Skill, mcp__Claude_Browser__preview_start, mcp__Claude_Browser__preview_list, mcp__Claude_Browser__preview_stop, mcp__Claude_Browser__preview_logs, mcp__Claude_Browser__computer, mcp__Claude_Browser__read_page, mcp__Claude_Browser__navigate, mcp__Claude_Browser__resize_window, mcp__Claude_Browser__read_console_messages
model: fable
effort: high
---

# The design station

Design decides what a change will look like, how its API reads, or how its plugins fit together — with
the user in the loop at every pick — and captures the answer as `design-context.md`. That document is a
specification. The prototypes under `.planning/design/{slug}/` are throwaway demo code and are
re-implemented from scratch by the builder, never copied.

Agent types are plugin-qualified when you spawn them: `moku-design:design-generator`. A bare name does not launch.

## Rails

```bash
moku-rails enter design      # exit 2 = refused: relay the reason and the named next step, then stop
```

Design is allowed before `init`, so this is often the first station a project ever enters. Before every
stop to ask the user something — each round pick, each polish gate — run `moku-rails pause --reason "..."`.
When the design is captured, `moku-rails done design`.

If the rails refuse because no change is open, open one first
(`moku-rails open <date-slug> --size M|L --type <type> --title "..."`) and enter again. Design is on
the route of M and L changes; a size-S fix has no design station.

## Moku Core rules

This pack does not reach into the core plugin by path. When a decision needs the Moku Core spec — the
factory chain, `ctx`, lifecycle, events, types, plugin structure — load the `moku:moku-core` skill with
the Skill tool and read the reference it points to. That matters most in `api` and `architecture` mode,
where the design has to agree with the spec.

## Modes

Ask at framing which modes apply. More than one may. A change can need screens and an API.

| Mode | Question it answers | Reference |
|---|---|---|
| `ui` | What does it look like and how does it behave? | `references/design-flow.md` |
| `api` | How does consumer code read when it uses this? | `references/design-mode-api.md` |
| `architecture` | Which plugins exist, what depends on what, what events flow? | `references/design-mode-architecture.md` |

`ui` keeps its sub-option, the medium: `web`, `cli` or `tui` (`references/design-medium.md`).

Every mode has the same spine: two or more alternatives, a comparison table with named axes, a human
pick, then capture into `design-context.md`. Run the modes in sequence, capture once at the end.

```
frame ──┬── ui ──────────── rounds of concepts ─────┐
        ├── api ─────────── usage snippets ─────────┼── capture design-context.md
        └── architecture ── boundary diagrams ──────┘
```

## Start

1. `mkdir -p .planning/design/` — `.planning/` is local-only and never committed.
2. No argument, or `resume` → resume from state (`references/design-stages.md` §4). `list` → print the
   registry from `.planning/design/index.md` and stop.
3. Otherwise read the argument as plain language. Pull out the target, the scope (`app`, `page`,
   `element`, `api`, `architecture`), the modes, the medium and a concept count (default 6). Echo one line:
   `Designing: {target} — mode {modes}{, medium M}{, N concepts}`.
4. If it is really an architecture debate with no artifact, offer `moku:brainstorm` instead. If it is
   planning or building, offer `moku:plan` or `moku:build`. Ask with `AskUserQuestion`; do not decide for
   the user.
5. Derive the slug from the target (lowercase, `[a-z0-9-]`, max 50 chars). If
   `.planning/design/{slug}/state.md` exists, ask: resume, start fresh (back up to `{slug}.bak-{n}`), new
   variant (`{slug}-2`), or cancel.
6. For `ui`, run the scope gate in `references/design-medium.md` before creating anything. A framework or
   library project usually has nothing visual to design; decline gracefully and offer a CLI or TUI surface,
   `api` mode, or brainstorm. `api` and `architecture` modes have no scope gate — a framework is exactly
   where they belong.
7. Create the workspace and write `state.md` per `references/design-stages.md` §2, then follow the mode
   references.

## What each mode produces

**`ui`** — `references/design-flow.md`. A shared concept spec with a feature checklist and frozen demo
data, then rounds: N `design-generator` agents in parallel, one concept each; a gallery; screenshots; the
review pass below; the human picks a winner, a mix or a new round; then polish with every change checked
in a live preview.

**`api`** — `references/design-mode-api.md`. Two or three alternative usage snippets first — how consumer
code reads — then the type-level sketch (`Config`, `State`, `api`, events) for each, then a comparison
table. The captured result is the API contract, a spec, not source.

**`architecture`** — `references/design-mode-architecture.md`. Two or three alternative plugin
decompositions as Mermaid diagrams — boundaries, dependency graph, event flow — and a comparison table.

## Reviewing a round

Concept screenshots are reviewed twice, independently, before the user ever sees them: by this session
against the checklist in `references/design-flow.md`, and by Astra. Load the `moku-astra` skill with the
Skill tool for how to call her, triage her findings and what to do when she is unavailable. Merge both
lists, triage, and present the merged findings together with the gallery so the user picks well informed.

Asset generation is offered at polish or capture, when the winner needs real art and only then. It is
never started automatically — image turns are expensive, and the user agrees to them first.

## Previews

Every round and every polish change is shown in a real preview before it is presented. A change is not
done until a screenshot or a live URL shows it.

- Preferred: `mcp__Claude_Browser__preview_start` over `.planning/design/{slug}/`, then
  `mcp__Claude_Browser__computer` for screenshots, `read_page` and `read_console_messages` to check the
  DOM and the console, `resize_window` for mobile. `preview_stop` when the step ends.
- Degraded: no preview tools at all means a Bash background static server
  (`bunx serve -l {port} .planning/design/{slug}` or `python3 -m http.server {port} -d ...`). Hand the
  user the URLs, verify with a Bash structural check instead of the DOM, and kill the server when the
  step ends.
- For `cli` and `tui` there is no server: run the sketch in Bash and capture its output.

## Rules

- Write only under `.planning/design/{slug}/` and `.planning/design/index.md`. No source files, no
  `.planning/STATE.md`, no git commands. Design explores; the builder writes code later.
- State is atomic and resumable: write `state.md` as `.tmp` then rename, refresh its `## Recovery` block
  on every write, and update the registry row. A bare `/moku-design:design` resumes from the exact stage.
- Stop at every human gate. The round pick, the polish gate and the capture are the user's decisions. One
  round per invocation is fine.
- Capture is written by this session, not an agent: `design-context.md` opens with the "spec, not source"
  callout verbatim and carries an exhaustive inventory. See `references/design-context-template.md`.
- Design never plans or builds. After capture, recommend the plan station.

## Hand-off

When the design is captured, repeat the principle and print the next step:

> Design captured → `.planning/design/{slug}/design-context.md`. This is a specification, not source.
> The prototype in that folder is throwaway demo code. Build it from scratch on the real stack with all
> the project's conventions; do not copy its CSS, JS, DOM or its bugs.

Then `moku-rails done design`, and hand the context path to the plan station.

## Gotchas

- Six concepts that are the same template in different accent colours is a failed round. Give each
  generator a genuinely distinct direction and say so in the spawn prompt.
- A concept that drops a feature or invents its own demo data is not comparable. Same features, same
  frozen data, only the design varies.
- Screenshots of a blank or erroring page produce confident findings about nothing. Check that each
  screenshot shows real state before sending it to review.
- The scope gate exists so a framework project does not end up with an empty `ui` workspace. Run it before
  creating directories, not after.
