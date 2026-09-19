---
name: verify
description: Verifies that a Moku project is structured the way Moku requires and fixes what is not. Fans out the structure, style, quality and architecture validators in parallel, root-first, challenges each finding with the skeptic, then auto-fixes and re-verifies for up to three cycles. Use at the verify station of a change, or when asked to check, validate or clean up a Moku project's structure.
when_to_use: The verify station of an open change, or a direct request to verify, validate or audit the structure of a Moku project. Not for planning, building or e2e testing.
argument-hint: (empty = the open change's scope) or {web|worker|framework|a path|whole project} [--iterations N] [--report-only] [--no-adversarial]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, Skill, AskUserQuestion
model: fable
effort: medium
---

# verify — the single verification entry

`verify` proves a Moku project is structured the idiomatic way and repairs what is not. The
emphasis is the root and entrypoint files, because that is where agents most often break the
framework: logic dumped into routers and entrypoints, config generated instead of declared,
entrypoints duplicated beyond the legitimate browser/server split, one-off functions scattered
around. On top of that it runs the whole validator set, loops while fixing, and never commits.

## Rails

```bash
moku-rails enter verify        # exit 2 = refused: relay the reason and the named next step, stop
```

Run this first. Before stopping to ask the user anything mid-station,
`moku-rails pause --reason "<why>"`. When the run ends clean:

```bash
moku-rails check verify
moku-rails done verify
```

`moku-rails check verify` records that the change's touched scope passed; the closing checklist
needs it. A run that ends `FAIL`, or one with `--report-only`, records nothing — it still calls
`moku-rails done verify` so the change is not stuck inside the station.

Invoked directly with no open change, open one first
(`moku-rails open <date-slug> --size S --type fix --title "…"`), so direct use and conductor use
travel the same rails.

## Moku Core specification

Before any decision about architecture, the core API, the factory chain, config, lifecycle, events,
`ctx`, types, invariants or plugin structure, read
`${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/spec-index.md` and open the `spec/NN-*.md` file it
cites. Cite the section id in your output. `.planning/` is local-only state and is never staged or
committed.

The app-shape rules are guardrails I1–I6 in
`${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/moku-idioms.md` and the skeleton and `index.ts`
rules in `skeleton-conventions.md`. The canonical root layouts for a web or worker project live in
their packs: load the `moku-web:moku-web` or `moku-worker:moku-worker` skill with the `Skill` tool,
which prints its base directory, and read the layout reference it points to. Do not reach for a pack
file by path — `${CLAUDE_PLUGIN_ROOT}` resolves per plugin. The detection, fix and loop protocol is
`${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/structural-conformance.md` — read it and follow
it. Every validator ends with the JSON output contract in `agent-preamble.md`.

## Project configuration
!`test -f .claude/moku.local.md && head -20 .claude/moku.local.md || true`

## Step 0 — guards, scope and arguments

1. A `package.json` must be present. Without one: "Not a Moku project — run from the project root."
   Stop.
2. Detect the project kind as `structural-conformance.md §"Step 0"` describes: Framework (L2), Web
   app (L3), Worker app (L3), Full-stack (L3).
3. Parse the arguments. `$ARGUMENTS` may be plain language; resolve it per `nl-args.md` and echo one
   `Interpreting as: …` line when you interpreted something.

| Argument | Effect |
|---|---|
| (empty) | Scope defaults to the open change (below). |
| `web`, `worker`, `framework`, a path | Focus there, and still gap-check the root. A broken neighbouring root is still a risk. |
| "whole project" | The full tree, root-first. |
| `--iterations N` | Cap the fix cycles. Default 3. `--report-only` forces one pass. |
| `--report-only` | Find and present; change nothing. |
| `--no-adversarial` | Skip the skeptic pass and take the findings as they are. |
| `--skeptics N` | Skeptics per finding. Default 2. |

**Scope when a change is open.** Default to what this change touched:
`git diff --name-only <change-start>...HEAD` plus the unstaged working tree, where `<change-start>`
is the commit recorded when the change opened (`moku-rails status --json`; fall back to the merge
base with the default branch). Say which scope you picked in one line. Widen to the whole project
only when the user asks. The root files are always gap-checked, whatever the scope.

4. Discover the plugin list with `Glob src/plugins/*/`. An empty list means a root-only run.

A request that is really about building, planning or e2e testing belongs to `moku:build`,
`moku:plan` or `moku-web:e2e`. Say so and stop.

## The validator fan-out

Spawn these with the `Agent` tool in one parallel batch. Agent types are namespaced
(`moku:<name>`), or they do not launch.

| Agent | Covers |
|---|---|
| `moku:moku-structure-validator` | The primary pass: root, entrypoints and app shape (I1–I6), the lib-vs-plugin boundary, non-triad scripts, config declared in place, spec conformance, plugin structure and tiers, `@moku-labs/common` usage (MC1–MC3). |
| `moku:moku-style-validator` | Function-body readability and JSDoc completeness. |
| `moku:moku-quality-validator` | Runs `tsc`, tests and lint through Bash as facts, then judges test quality. |
| `moku:moku-architecture-validator` | Cross-plugin dependency graph, event flow, API consistency. |
| `moku-web:moku-web-validator` | Web patterns and reference-app conformance. |

The web validator comes from the `moku-web` pack. Run it only when that pack is installed **and**
the project is a web app. When the project is a web app and the pack is absent, skip it and say so
in the report: the web axes were not checked because `moku-web` is not installed.

Each validator ends with the JSON output contract. Retry one that returns no parseable verdict, up
to three times. A validator that still returns no verdict did not run, which means the project was
not fully checked — that is a `FAIL`, not a shrug.

## The loop

For cycle `1..ITERATIONS`:

1. **Find.** The parallel fan-out above, read-only.
2. **Rank.** Dedupe by `file+line+rule`; sort root and structural blockers first
   (I1 → I2 → I4 → I3 → config → secondary). Blockers and warnings are both fail-worthy; keep the
   severity for the fix order and the report.
3. **Challenge.** Skip when `--no-adversarial`. Send every finding to `SKEPTICS_PER_FINDING`
   `moku:moku-skeptic` agents. A skeptic upholds by default and may refute only by citing the spec
   or house-style section that proves the finding is not a violation, is out of scope (test,
   type-only or generated file), or misquotes the rule. A pattern repeated across plugins is not
   automatically a convention; refute on repetition only when `house-style.md` approves it, with the
   citation. Drop a finding only on unanimous, cited refutation. Log `N refuted (cited), M upheld`.
   The validators are Sonnet, so they never close the gate: the skeptic filters, and the final
   verdict is yours.
4. **Fix.** Skip entirely when `--report-only`. Apply the recipes in
   `structural-conformance.md §"Step 2"`, structural first: drop a core dependency from a Layer-3
   app, extract logic out of entries, relocate stray functions, collapse gratuitous entrypoints,
   inline a `makeApp(...)` wrapper back to a bare `export const app = createApp({ … })` when the
   parameter has no second call site. Then the secondary fixes. Structural refactors preserve
   behaviour: no public signature, return type, route, event name, error-message text or runtime
   behaviour changes. Real gaps get real fixes — missing tests get written to match the sibling
   plugins' conventions, stale docs get corrected against the source, missing type guards, JSDoc and
   `import type` get added.
5. **Re-check.** `bun run format`, `bun run typecheck`, `bun run lint`, `bun run test`. Skip a script
   that does not exist. A fix that regressed a check is corrected or reverted before the next cycle.
6. **Stop early** when a full pass surfaces nothing new and no validator went un-run.

Stop conditions: a clean pass, or `ITERATIONS` reached. If findings remain at the budget, report
them with their fixes. Never fake a clean pass and never loop unbounded.

## Verdict and report

`PASS` only when the final pass is fully clean — zero blockers, zero warnings — and every validator
returned a verdict. Any surviving blocker, any warning, or any un-run validator is `FAIL`.

Report the per-guardrail summary from `structural-conformance.md §"Output"`: project kind, the scope
you verified, the root-file checklist, found/fixed/remaining per guardrail, the validators that ran
and any that did not, the refuted-finding count, cycles used, the typecheck/lint/test result, and
each remaining item with its concrete fix. Under `--report-only`, present the ranked findings and
confirm nothing changed.

## Rules

- Root files first. Gap-check the root under any scope.
- A blocker, a warning, or an un-run validator fails the run. An un-run validator means the project
  was not fully checked.
- Findings survive unless refuted unanimously with a citation. When uncertain, the finding stands.
- Never flag an idiom. Multiple `createApp` instances across frameworks and runtimes, two frameworks
  side by side, and folder-splitting are idiomatic (`moku-idioms.md`). Every non-idiom is fair game:
  I1–I5, config not declared in place, and fat entries are blockers, including a `makeApp(...)`
  factory wrapping `createApp` with no second call site.
- Fix rather than only flag, unless `--report-only`. A high-blast-radius or ambiguous change becomes
  a proposal instead of a forced edit.
- A guardrail is clean only after typecheck, lint and tests pass on the fixed tree.
- Edit source only. The orchestrating session commits after verification, so do not commit here,
  never pass `--no-verify`, and never write to the plugin cache or `.planning/`.
