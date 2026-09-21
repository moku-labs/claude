---
name: check
description: Runs diagnostics on a Moku project and on the moku plugin installation — project type, environment (moku-rails, node, bun), tooling files, which packs are installed against what the project actually uses, planning state, plugin health, and a build smoke check. Use when something is misconfigured, when setup needs confirming, or when the user asks what is wrong.
when_to_use: Diagnosing a Moku project or the moku plugin installation. Read-only except where a subcommand says otherwise.
argument-hint: "[verbose|self-test|graph|status|astra|usage|plugin <name>|diff <name>]"
allowed-tools: Read, Bash, Glob, Grep, Agent
model: fable
effort: low
---

# check — diagnostics

## Moku Core specification

Before any decision about architecture, the core API, the factory chain, config, lifecycle, events,
`ctx`, types, invariants or plugin structure, read
`${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/spec-index.md` and open the `spec/NN-*.md` file it
cites. Cite the section id in your output. `.planning/` is local-only state and is never staged or
committed.

## Routing

| `$ARGUMENTS` | Runs |
|---|---|
| (empty) | Checks 1–7 below, summary only |
| `verbose` | Checks 1–7 with full detail per check |
| `self-test` | Validates the moku plugin installation instead of the project |
| `graph` | Mermaid diagrams: dependencies, event flow, waves (frameworks) |
| `status` | Compact plugin overview |
| `astra` | Probes the Astra backend — the one check that costs quota |
| `usage` | The plugin's context footprint |
| `plugin <name>` | Targeted validation of one plugin |
| `diff <name>` | Spec against implementation for one plugin |

`plugin` or `diff` with no name prints its usage line and lists the candidates from `src/plugins/`
or `.planning/specs/`. Anything else prints
`Unknown subcommand: <token>. Valid: verbose | self-test | graph | status | astra | usage | plugin <name> | diff <name>`
and stops.

## Check 1 — project detection

- `src/config.ts` with `createCoreConfig` → Framework (Layer 2).
- `createApp` imported from a framework package → Consumer App (Layer 3).
- `package.json` only → generic project.
- None of these → stop with: "This does not appear to be a Moku project. No package.json found in
  the current directory. Run check from the root of a Node.js or Moku project."

Report the type and, where it applies, the framework name and whether `.planning/moku.md` exists.

## Check 2 — environment

| Item | How | Failure |
|---|---|---|
| `moku-rails` on PATH | `command -v moku-rails` | The lifecycle rails cannot run. The core plugin ships `bin/moku-rails`; a missing binary means the plugin is not installed or its bin directory is not on PATH. |
| Node ≥ 24 | `node --version` | The hooks and `moku-rails` are ESM modules that need Node 24. Report the version found. |
| Bun | `bun --version` against `.bun-version` | Advisory. |
| Rails mode | `moku-rails status` | Reports initialized or not, open changes, debts. |

## Check 3 — packs against the project

Read `package.json` dependencies and compare with the installed plugins (`/plugins` or the plugin
cache). Suggest, do not install.

| Dependency found | Pack | Without it |
|---|---|---|
| `@moku-labs/web` | `moku-web` | The web validator and the e2e station are unavailable. |
| `@moku-labs/worker` | `moku-worker` | No worker knowledge skill. |
| `@moku-labs/room` | `moku-room` | No room knowledge skill. |
| `@moku-labs/native` | `moku-native` | No native packaging knowledge skill. |
| `@moku-labs/system` | `moku-system` | No system API knowledge skill. |
| any UI surface | `moku-design` | The design station is unavailable; the conductor will offer to continue without it. |

Report each as installed, missing-and-wanted, or installed-but-unused. An installed pack that the
project does not use costs only context, so it is informational.

When `moku-design` is installed and its `astra` option is on, also check that `codex` is on PATH
(`command -v codex`). Without it Astra is unavailable and Fable reviews alone. Do not run
`moku-astra probe` here: a probe spends model quota. `check astra` does that on request.

## Check 4 — tooling

- `package.json` carries the script contract: `lint`, `typecheck`, `test`, `build`, plus `validate`,
  `release:setup`, `release:doctor` and `release` for a package.
- `biome.json`, `tsconfig.json` with `strict`, `vitest.config.ts` exist.
- `.gitignore` covers `.planning/`, `dist/`, `node_modules/`.
- Packages: `.github/workflows/ci.yml` and `publish.yml` exist. Apps: `ci.yml` exists.

Report PASS or MISSING for each.

## Check 5 — planning state

`.planning/STATE.md`: current phase, completed stages, next action, and whether it is stale (last
updated more than seven days ago). Report "No active plan" when it is absent. Count the files in
`.planning/specs/`. Note any change folder under `.planning/changes/` whose change is closed in the
ledger — `clean` archives those.

## Check 6 — plugin health (frameworks)

For each directory in `src/plugins/`: file count against the expected tier, `index.ts` present and
under 50 lines, `README.md` present, `__tests__/` present. Report name, tier assessment and health.

## Check 7 — build and dependencies

- `bun run typecheck` and `bun run lint`. Report PASS or FAIL.
- `@moku-labs/core` version for a framework; peer-dependency warnings.
- Target stack: compare against
  `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/target-stack.md`. When `typescript` is pinned
  below `^6`, `tsconfig.json` has no `compilerOptions.types`, `typescript-eslint` is below 8.58.0 or
  `tsdown` below 0.22.1, report
  `INFO: project is below the current Moku target stack (v3, TypeScript 6) — run /moku:upgrade` with
  the one-line diff. Do not fix it here; `upgrade` owns that.

## Output

```
Moku Project Diagnostic Report
==============================
Project type:  Framework (Layer 2) — my-framework
Rails:         initialized · 1 change open · 0 debts

Environment:   [PASS] moku-rails on PATH · node 24.4.0 · bun 1.3.14
Packs:         [INFO] moku-web suggested (@moku-labs/web in dependencies)
Tooling:       [PASS] all config files and the script contract present
Planning:      [ACTIVE] Phase: stage2/approved (3 specs)
Plugins:       [OK] 5 plugins (2 Nano, 1 Micro, 2 Standard)
Types:         [PASS] bun run typecheck clean
Lint:          [PASS] zero warnings
Dependencies:  [OK] @moku-labs/core@0.1.3

Issues:
- WARNING: plugin "cache" has no __tests__/ directory
- INFO: .planning/STATE.md last updated 3 days ago
```

`verbose` adds the full detail of each check.

## Subcommand — astra

Only on request, because it costs quota. Requires the `moku-design` pack.

```bash
moku-astra probe        # exit 3 = unavailable for any reason
```

Report the backend in use (`codex` or `api`), whether the probe succeeded, and what happens when it
does not: Fable reviews alone with the same findings schema, and image assets fall back to SVG or
CSS placeholders plus a to-draw list. The gate is never skipped.

## Subcommand — self-test

Validates the installation, not the project. Count everything dynamically; never assume a number.

1. Every agent `.md` in `${CLAUDE_PLUGIN_ROOT}/agents/` parses with valid frontmatter carrying
   `name`, `description`, `model`, `tools`, and no agent lists `Agent` in `tools`.
2. Every skill directory under `${CLAUDE_PLUGIN_ROOT}/skills/` has a `SKILL.md` with valid YAML
   frontmatter. Lifecycle skills (the ones that enter a rails station, plus status, check, clean,
   upgrade and the conductor) carry both `model` and `effort`; knowledge skills carry neither by design.
3. `${CLAUDE_PLUGIN_ROOT}/hooks/hooks.json` parses as JSON.
4. Every script named in `hooks.json` exists and passes `test -x`. Report the exact failing path.
5. Every `references/` path mentioned in a `SKILL.md` resolves to a file that exists.
6. `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json` parses, and its version matches the entry in
   the marketplace manifest.
7. No frontmatter anywhere lists `TodoWrite` or a `Task*` tool: those do not exist on current
   models.

Report PASS or FAIL per item.

## Subcommand — graph

Frameworks only. Three mermaid diagrams, each with a short description. "No plugins found — nothing
to graph." when `src/plugins/` is empty.

**Dependencies** — a flowchart from every plugin's `depends: [...]`, node label `name (Tier)`,
arrows from dependent to dependency, colour by tier (Nano green, Micro blue, Standard orange,
Complex red, VeryComplex purple).

**Event flow** — emitters from the `events:` fields in `src/plugins/*/index.ts`, listeners from the
`hooks:` fields, and the `Events` type in `src/config.ts` as the authoritative name list. Left
emitters, centre event names, right listeners. An event name that appears in a plugin but not in
`Events` is orphaned; an event with no listener is dashed; a hook with no emitter is red.

**Waves** — a gantt from the `## Waves:` lines in `.planning/STATE.md`, one section per wave. Skip
it with "No wave data in STATE.md." when that field is absent.

## Subcommand — status

Frameworks only. A table of every plugin with tier, file count, `__tests__/`, `README.md` and build
status from `STATE.md`, then the total count, the tier distribution and the planning summary.

## Subcommand — plugin `<name>`

1. `src/plugins/<name>/` must exist.
2. Assess the tier from the file structure.
3. Fast checks first: `bun run format`, `bun run lint`, `bun run typecheck`, `bun run test`.
4. All green and no `--full` → report PASS and stop. The agent fan-out is the expensive path.
5. Otherwise spawn in parallel: `moku:moku-structure-validator` (tier, file organization, index
   quality, spec conformance), `moku:moku-style-validator` (readability and JSDoc),
   `moku:moku-quality-validator` (types and test quality).
6. Report PASS, WARN or FAIL per validator, and list each blocker with its fix.

## Subcommand — diff `<name>`

1. Find `.planning/specs/*-<name>.md`. Absent → `No spec found for plugin "<name>". Expected:
   .planning/specs/*-<name>.md` and stop. Spec sections are the H2 headers `Config`, `State`, `API`,
   `Events`, `Dependencies`, `Hooks`; other headers are ignored.
2. Read `types.ts`, `api.ts`, `state.ts` and `index.ts` from `src/plugins/<name>/`, treating an
   absent file as empty.
3. Compare section by section and report MATCH, GAP (the spec promised it, the code lacks it) or
   EXTRA (the code has more than the spec).

```
Spec-vs-Implementation Diff: router
===================================
| Section      | Spec                    | Implementation               | Status         |
|--------------|-------------------------|------------------------------|----------------|
| Config       | basePath, trailingSlash | basePath, trailingSlash      | MATCH          |
| State        | currentPath, routes     | currentPath, routes, history | EXTRA: history |
| API          | navigate, current, back | navigate, current            | GAP: back      |
```

A GAP is a blocker: the spec promised that API. An EXTRA is informational and may mean the spec
needs updating.

## Subcommand — usage

Print the component counts from `claude plugin details moku` (the live inventory and its projected
token cost), then on-disk sizes as a proxy for context cost:

```bash
echo "skills:   $(du -sh ${CLAUDE_PLUGIN_ROOT}/skills 2>/dev/null | cut -f1)"
echo "  spec/   $(du -sh ${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/spec 2>/dev/null | cut -f1)"
echo "  sandbox/ $(du -sh ${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/sandbox 2>/dev/null | cut -f1)"
echo "agents:   $(ls ${CLAUDE_PLUGIN_ROOT}/agents/*.md 2>/dev/null | wc -l | tr -d ' ')"
```

`spec/` and `sandbox/` are index-and-fetch: near zero tokens until an agent opens a file. The real
cost is the validator fan-outs. Claude Code's own `/usage` shows the per-category breakdown. Then
stop; do not run Checks 1–7.
