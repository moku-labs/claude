# Plan Stages — Detailed Instructions

The procedures behind the `plan` skill: the delta-spec route, the guards that protect existing
planning work, and the three stages of a full plan. Read the section you need, not the whole file.

---

## Delta Spec (size M, or new scope on an approved size-L plan)

A size-M change touches a system that already has specs. Replanning it from scratch discards work
the user approved and invites builders to rewrite plugins that were fine. Write the difference
instead. One user gate, not three.

**Entry conditions.** `.planning/specs/` holds at least one spec, and one of these is true:

- the change is size M;
- the change is size L, its full plan was already approved, and `moku-rails scope "<what is new>"`
  sent it back in front of plan (see below);
- the user passed `--delta`.

Otherwise take the full route — there is nothing to delta against.

**Size L after `moku-rails scope`.** A size-L change that grows while it is being built comes back to
the plan station with its approved plan intact. `moku-rails status --json` shows it: the change has a
`scope` list, and `.planning/specs/` plus `.planning/build/skeleton-spec.md` exist. Do not run the
three stages again. Write a delta spec for the entries of `scope` only, pass the one gate below, run
`moku-rails done plan`, and go back to `moku-rails enter build`. Builders take the touched plugins in
`delta` mode; plugins the delta does not name keep their built state. Take the full route again only
when the person asks for it at the gate ("Switch to a full plan"), or when the new scope replaces the
architecture instead of adding to it.

### 1. Locate the blast radius

Read the intake (`.planning/changes/<id>/intake.md`), then the code:

- Which plugins does the change touch? Grep `src/plugins/` for the domain, and read each candidate's
  `index.ts`, `types.ts`, `state.ts`, `api.ts`, `handlers.ts`.
- Which plugins depend on them, and which of their events or API methods are consumed elsewhere?
- Does the change fit an existing plugin, or does it need a new one? A new plugin is plugin-shaped
  when it needs its own typed API, its own events, lifecycle, or cross-cutting state. Otherwise it
  belongs inside the plugin that owns the domain.
- Does the change overlap a plugin domain enough to merge instead of adding? (`spaHead` + `spaRouter`
  → one `spa` plugin.)

Record the answers; they are the delta spec's Scope section.

### 2. Write `.planning/changes/<id>/delta-spec.md`

Use the Delta Spec Template in `plan-templates.md`. Per touched plugin it states what changes in
config, state, api and events, which tests are added or changed, and whether the plugin README or the
root README has to follow. A field that does not change is not listed — the delta is the difference,
not a copy of the spec.

Breaking changes carry a migration note naming the consumers that adapt. A tier promotion
(Micro → Standard, and so on) is named explicitly, because it changes the plugin's file layout.

### 3. Update the affected specs only

For each touched plugin, edit its spec in `.planning/specs/` in place so it describes the
post-change state. Untouched specs are not read, not renumbered and not rewritten. A new plugin gets
a new spec at the next free number, from the Plugin Specification Template.

### 4. Validate, then one gate

Run `moku-plan-checker` over the delta spec plus the specs it touched, and fix every BLOCKER before
the gate. Then `moku-rails pause --reason "waiting for delta-spec approval"` and present:

- the delta spec, one screen per touched plugin;
- the diff of what changed in each spec;
- the plan-checker report, warnings included.

`AskUserQuestion`: Approve (recommended) / Change the scope / Switch to a full plan. Approve writes
`## Next Action: Run /moku:build resume` into `STATE.md` and ends the station.

**`add plugin` is the same route** with one plugin in scope and no existing spec to edit; see
`plan-verb-add.md`.

---

## Unbuilt-Plan Guard

Every path that would delete or overwrite `.planning/specs/*.md` or
`.planning/build/skeleton-spec.md` passes this gate first. An approved-but-unbuilt plan is real,
user-approved design work, and deleting it silently is the incident this guard exists to prevent.

**Why `complete` plus populated specs means unbuilt:** after a successful build, `/moku:build` moves
the specs into `.planning/archive/cycle-N/` and resets `## Phase:` to `ready` or `build/complete`. So
a `STATE.md` at phase `complete` (or any `stageN/*`) with spec files still in `.planning/specs/` is a
plan that was never built.

1. **Detect.** At risk when both hold: `.planning/specs/` contains at least one `*.md`
   (`find .planning/specs -maxdepth 1 -name '*.md' -type f 2>/dev/null | head -1`), and `## Phase:`
   is one of `stage1*`, `stage2*`, `stage3*`, `complete`. Phase `none`, `building`, `build/*`,
   `ready`, or an empty specs directory means not at risk — continue normally.
2. **Ask.** `AskUserQuestion`: "There is an approved but unbuilt plan in `.planning/specs/` (Target:
   {current Target}, Phase: {phase}). Planning {new Target} would overwrite it."
   - **Combine (recommended)** — keep the existing specs and plan the new work together with them.
   - **Archive** — move the specs, the skeleton spec and a copy of `STATE.md` to
     `.planning/archive/{slug}/`, then plan in a clean slot.
   - **Replace** — drop the existing unbuilt specs. Only for an abandoned plan.
3. **Route.**
   - *Combine:* delete nothing. Set COMBINE_MODE=true, feed the existing spec set into the new cycle,
     add any brainstorm context behind it to CONTEXT_FILES, renumber `01..NN` across the union, tag
     each section with its source feature where two features touch one plugin, and set `## Target:`
     to a combined label.
   - *Archive:* run the helper below, then proceed as a clean cycle.
   - *Replace:* back up `STATE.md` to `.planning/STATE.md.bak`, then delete `.planning/specs/*.md`
     and `.planning/build/skeleton-spec.md`.
4. **Non-interactive:** never auto-Replace. When the gate cannot be shown, Archive and log the path.

**Archive-Plan helper.** Slugify the current `## Target:` (lowercase, `[a-z0-9-]`, spaces → `-`;
fallback `plan`), suffix `-2`, `-3`, … if the directory exists, `mkdir -p .planning/archive/{SLUG}/`,
and move in every `.planning/specs/*.md`, `.planning/build/skeleton-spec.md` if present, and a copy
of `.planning/STATE.md`. Log the path. An archive is never deleted automatically.

---

## State Persistence Protocol

Every stage reads `.planning/STATE.md` on entry and writes it on exit, so a stage can run alone and a
dropped session can resume.

All headers use the inline form `## HeaderName: value` — name, colon, space, value, one line. Each
field appears exactly once: edit in place, never append a second copy. Fields that both plan and build
write (`## Git Checkpoint:`, `## Phase:`, `## Skeleton:`) are collapsed to one line, most recent value
winning, before writing.

**On entry:** read `STATE.md`; verify `## Phase:` ends in `/approved`, otherwise tell the user the
previous stage was not approved and resume from its pending-approval phase. A stage reached from its
own `/pending-approval` phase skips this check — it is resuming itself. Then load verb, target type,
decisions, plugin table and wave grouping.

**On exit, before the user gate:**

1. Copy `.planning/STATE.md` to `.planning/STATE.md.bak`. Write the new content to
   `.planning/STATE.md.tmp` and validate it there. Required headers: `## Phase:`, `## Verb:`,
   `## Target:`, `## Next Action:`, `## PluginTable:`, `## WaveGrouping:`, `## QuickMode:`,
   `## Skeleton:`. Validation fails → delete the tmp file, leave `STATE.md` untouched, and stop with
   the reason; the `.bak` is intact. Validation passes → rename tmp over `STATE.md`, which is atomic.
   A failed rename leaves the tmp file in place; say so and stop.
2. Record the phase, what the stage completed, the artifacts it created, and the next expected action.
   Refresh the `## Recovery` block (last good step, open blockers, next action, updated) per
   `plan-templates.md`, so a cold session rehydrates in one read.
3. Set `## Phase:` to `stage{N}/pending-approval`; on approval set it to `stage{N}/approved`.
4. `## Skeleton:` is advanced only by build. Preserve `in-progress`, `verified` or `committed` if
   already set; otherwise write `not-started`.

### Phase-to-Stage Jump Table

| Phase value | Resume at |
|---|---|
| `none` or unrecognized | No plan started yet. Offer to begin one. |
| `stage1`, `stage1/pending-approval` | Re-run Stage 1 |
| `stage1/approved` | Stage 2 |
| `stage2`, `stage2/pending-approval` | Re-run Stage 2 |
| `stage2/approved` | Stage 3 |
| `stage3`, `stage3/pending-approval` | Re-run Stage 3 |
| `stage3/approved`, `complete` (verb `create`, `migrate`, `resume`) | The plan is complete; the next step is `/moku:build resume` |
| `complete` (verb `update`, `add`) | Run the Unbuilt-Plan Guard, apply the user's choice, then set only `## Phase:` to `none` and plan the new work |

A stored `## Verb: resume` is a defect: `resume` is an invocation verb, not a stored one. Tell the
user to repair `## Verb:` to the verb the plan started with.

---

## Stage 1: Analysis + Structure

**On entry**: Read `.planning/STATE.md` if it exists. Load any decisions from Step 0.5, research from Step 0.6, and steering from `.planning/steering.md` (if it exists).

### Discussing architecture decisions (all targets)

Whenever Stage 1 hits a genuine architectural decision the user should weigh in on (framework shape,
plugin boundaries, a tier choice, a dependency trade-off), present it the SAME way `/moku:brainstorm`
does — be an opinionated colleague, not a passive interviewer:

1. **Frame the trade-off** — the tension, and why it matters for THIS project.
2. **Show 2–3 concrete approaches with TypeScript code examples** (5–15 lines each) in Moku's plugin model.
3. **Give a clear recommendation with reasoning** tied to this project (not generic advice).
4. **Name specific concerns** about each alternative.

Use the **two-turn pattern** (see `brainstorm-flow.md` Step 3): present the full discussion with code
examples and your recommendation as visible text FIRST, THEN ask via `AskUserQuestion` whose option
descriptions are short summaries — never a bare "Option A / Option B" with the examples omitted. Skip
the discussion only when there is genuinely no decision to make (then proceed directly).

### Framework Target

#### If given a description:
- Ask clarifying questions about the domain (use decisions from Step 0.5 if available)
- Identify the target use case (web app, CLI, game, build tool, etc.)
- Determine what plugins are needed
- If research was performed (Step 0.6), incorporate ecosystem findings into plugin identification
- **If steering exists** (`.planning/steering.md`):
  - **Boundaries**: Reject any plugin that falls outside stated scope. If a potential plugin conflicts with a boundary, flag it to the user before including.
  - **MVP Priorities**: Mark the top-3 capabilities as `priority: high` in the plugin table. Assign these to Wave 1 when dependency constraints allow.
  - **Reference Point**: Use the stated reference project to calibrate complexity — match the reference's scope, not exceed it.
  - **Risk**: Note which plugin is most exposed to the stated risk. Stage 2 will add explicit mitigation.
  - **CI/CD**: No action in Stage 1 — Build Step 5.10 reads `## CI/CD` from steering.md to generate workflows. Include the selected CI/CD options in the Stage 3 skeleton spec's verification checklist so the user knows they will be generated at build time.

#### If given existing code:
- Read and analyze the codebase thoroughly
- Identify domain concepts that map to plugins
- Identify shared state, events, and communication patterns
- Map existing modules/classes/functions to potential plugins

#### Core Plugin Identification

Before identifying regular plugins, determine which plugins should be **core plugins**. Core plugins are self-contained infrastructure registered via `createCoreConfig({ plugins: [...] })`.

**Use this decision table:**

| Criterion | Core Plugin | Regular Plugin |
|-----------|------------|----------------|
| Needs events/hooks | No | Yes |
| Needs depends on other plugins | No | Yes |
| Needs emit | No | Yes |
| Provides utility API used by many plugins | Yes | Maybe |
| Self-contained infrastructure | Yes | No |

**Common core plugin candidates:** logging, environment detection, storage abstraction, configuration validation, feature flags, i18n utilities.

If a plugin is core, it uses `createCorePlugin(name, spec)` with NO depends/events/hooks. Its API is injected directly on every regular plugin's context (`ctx.<name>`).

#### Regular Plugin Identification

Using the **moku-core** and **moku-plugin** skills, for each identified regular plugin determine:

1. **Name** — camelCase plugin name
2. **Complexity Tier** — Nano/Micro/Standard/Complex/VeryComplex (use moku-plugin skill tier criteria)
3. **Brief Description** — One sentence explaining what it does
4. **Dependencies** — Which other plugins it depends on
5. **Has Events** — Whether it declares its own events
6. **Needs start/stop** — only if it manages a real resource (a server, a connection, a listener). Most plugins need neither.

#### Record Key Decisions

During plugin identification, record non-obvious decisions to `.planning/decisions.md` (see `decision-knowledge-graph.md`). Specifically:
- Why a concept became a standalone plugin vs. a sub-module of another plugin
- Why a specific complexity tier was chosen (especially when borderline between tiers)
- Why two related domains were merged or kept separate
- Why a dependency direction was chosen (A depends on B, not B depends on A)
- Steering boundary violations — if a potential plugin was rejected due to stated scope boundaries

Create `.planning/decisions.md` if it doesn't exist (use template from `plan-templates.md`).

#### Structure Constraints

Enforce these constraints on the proposed structure (re-checked post-build by `bin/moku-verify-artifacts` and `moku-structure-validator` against the real `src/` filesystem — keep all three in sync). The `@moku-labs/web` root (`config.ts`, `index.ts`, `browser.ts`, `testing.ts`, `plugins/`) is the exemplar:
- **Root has config and index files only** — `src/config.ts` and `src/index.ts`. This also forbids loose helper FILES at root (`src/instances.ts`, `src/env-provider.ts`, `src/utils.ts`, …), not just folders.
- **No folders other than plugins** — everything under `src/plugins/`. No `src/utils/`, `src/services/`, `src/helpers/`, `src/lib/`, `src/internal/`, `src/shared/`.
- **Shared-across-plugins helpers never live as a loose root module.** Co-locate the helper INSIDE the one owning plugin (siblings import it via `../<owner>/<file>`) or make it its own plugin (Nano/Micro, or a core plugin for a utility many plugins need, reached via `ctx.require()`). The ONLY sanctioned shared *root* module is one re-exported publicly through `src/index.ts` (part of the package's public surface).
- **CLI/client/server entry point files** (`src/cli.ts`, `src/browser.ts`, …) are allowed ONLY if absolutely necessary AND declared as a `package.json` `exports` subpath. Must be explicitly explained and justified to the user.

#### Output: Plugin Tree Diagram + Planned Skeleton

Present a tree diagram showing the proposed structure with complexity tiers AND the planned file layout:

```
src/
  config.ts                          # Framework config (Config + Events + core plugins)
  index.ts                           # Framework entry (createCore + exports)
  plugins/
    env/                             # [Core] Environment detection
      index.ts
    logger/                          # [Core] Structured logging
      index.ts
    router/                          # [Standard] Client-side routing
      index.ts, types.ts, state.ts, api.ts, handlers.ts
      __tests__/unit/, __tests__/integration/
    auth/                            # [Standard] Authentication + sessions
      index.ts, types.ts, state.ts, api.ts
      __tests__/unit/, __tests__/integration/
    renderer/                        # [Complex] Page rendering pipeline
      index.ts, types.ts, state.ts, api.ts
      __tests__/unit/, __tests__/integration/
      transforms/
        markdown.ts, html.ts, types.ts
```

Core plugins are tagged `[Core]` and stored in the same `src/plugins/` folder. They use `createCorePlugin` instead of `createPlugin`.

For each plugin, note:
- Tier in brackets
- Whether it needs `onStart`/`onStop` (and why, if yes)
- Dependencies as arrows or notes
- Files that will be created per tier

No files are created here — this is a plan, not execution.

---

### App Target

#### Step 1: Understand Requirements

Use `AskUserQuestion` to gather requirements efficiently:

1. First question — application type:
   - Question: "What kind of application are you building?"
   - Header: "App type"
   - Options: "Web app" / "Mobile app" / "Desktop app" / "CLI tool"

2. Follow-up questions as needed using `AskUserQuestion` for structured choices (framework preferences, performance priorities, etc.) or direct conversation for open-ended requirements.

#### Step 2: Analyze Available Frameworks and Plugins

Search the project for:
- Framework packages (look for `createApp` and `createPlugin` exports)
- Available plugins (both framework defaults and optional)
- Plugin APIs and their capabilities
- Framework config shape and events

Read all relevant source files to understand what's available.

**Framework-capability verification (verify, never assume).** Every composition/deploy claim the plan will
make is grounded in the **installed** package, not memory or a spec doc. For each capability you intend
to rely on — an exported plugin (`hubPlugin`, `deployPlugin`), a generator (a `wrangler.jsonc` emitter, an
SSG builder), a CLI (`server.cli.dev/deploy`), a `./subpath` export, a re-export — read the package's real
`package.json` `exports` + its `dist`/types and confirm it exists with the assumed shape. If the plan is
tempted to say "framework X IS the worker / auto-generates the deploy config," that claim is **invalid until
a source citation backs it** — never assume a framework's runtime/server export ships a deploy-config
generator (e.g. a `wrangler.jsonc` emitter); verify it against the installed package's `exports` +
`dist`/types. A capability that does not exist is **not** something to hand-roll or wrap in a facade app —
pick the framework that ships it, or record a framework-extension need. The build re-checks this at
`build-app.md` Step 2.

#### Step 3: Gap Analysis

Compare requirements against available plugins:
- Which requirements are covered by existing plugins (config / `pluginConfigs` only)?
- Which requirements are **plugin-shaped** and need a new **custom Layer-3 plugin**? A requirement is plugin-shaped when it needs a typed `app.<x>.method()` API, custom events, lifecycle (`onInit`/`onStart`), shared cross-cutting state, or a dependency on another plugin. Author these in `src/plugins/{name}/` via the framework's `createPlugin` — see `consumer-plugins.md`.
- Which requirements are better as a `lib/` helper (pure build-time data access / pure functions) or an island (client-only DOM behavior)? Those do not become plugins.
- Which requirements need framework extensions (i.e. belong in Layer 2, not this app)?
- Are there missing dependencies?

#### Step 4: Design the Application

1. **Plugin Composition** — Which plugins to include, in what order
2. **Config Overrides** — What global config values to set
3. **Plugin Configs** — Per-plugin configuration
4. **Custom Plugins** — The plugin-shaped concerns from Step 3, each authored as a custom Layer-3 plugin in `src/plugins/{name}/` (full specs; tier per the moku-plugin skill). Keep pure helpers in `lib/` and DOM behavior in islands — see `consumer-plugins.md`
5. **Entry Point** — `createApp` call structure. For a worker backend, design to the **one-worker composition idiom** (`moku-idioms.md §I6`, the `tracker` `server.ts` shape): a **single** `@moku-labs/worker` `createApp` composing the resource plugins + the app's runtime plugin (own `createPlugin` or a framework runtime/hub plugin) + `deploy` + `cli`. Do **not** plan two side-by-side apps for one worker, and do **not** plan a facade app/plugin whose only job is to generate `wrangler.jsonc` — compose `deploy`+`cli` into the one app instead.

#### Step 5: Plan Documentation

- JSDoc requirements for all custom code
- README for the application
- API documentation for custom plugins
- Integration documentation (how everything connects)

---

### Plugin Target

#### Step 1: Understand the Plugin

If referencing a spec:
- Read the spec file and find the plugin definition
- Extract all details: config, state, API, events, dependencies

If describing a new plugin:
- Ask clarifying questions about the plugin's purpose
- Design the plugin spec (config, state, API, events, dependencies)

#### Step 2: Determine Complexity Tier

Using the **moku-plugin** skill, assess:
- How many spec fields are needed?
- How much domain logic per field?
- Are there sub-domains?

Select: Nano / Micro / Standard / Complex / VeryComplex

**Domain merge check:** Before planning a new plugin, scan existing plugins for domain overlap:
- Does the new plugin share a domain prefix with existing plugins? (e.g. `spaHead` + `spaRouter` → merge into `spa`)
- Would the new plugin's events coordinate with an existing plugin's events?
- Would consumers naturally configure the new plugin alongside an existing one?

If overlap is detected, do not plan a separate plugin. Plan to add a sub-module to the existing plugin (promoting it to Very Complex if needed).

Also determine lifecycle needs:
- Does the plugin need `onStart`? (Only if opening connections, starting servers/listeners, mounting UI)
- Does the plugin need `onStop`? (Only if closing connections, flushing buffers, unmounting)
- If neither is needed, omit both — empty lifecycle methods are noise

#### Output: Plugin Design Summary

Present the plugin design: tier, config shape, state shape, API methods, events, dependencies, lifecycle justification.

---

### Update Plugin Target

**This is used when VERB is `update` and TYPE is `plugin`.**

Stage 1 is largely pre-answered for updates — the existing plugin provides the baseline. Focus on the delta:

1. Load the existing plugin analysis from Step 0.4 (current tier, config, state, API, events, dependencies)
2. Validate proposed changes against Moku constraints:
   - If tier promotion is needed, verify new tier's file structure requirements
   - If new dependencies are added, verify no cycles in the dependency graph
   - If new events are added, verify naming conventions
   - If breaking changes are proposed, identify affected consumers
3. Present the update plan: what changes, what stays, migration path for breaking changes
4. Run plan-checker before user gate

### Update App Target

**This is used when VERB is `update` and TYPE is `app`.**

1. Load existing app analysis from Step 0.4 (current composition, config, custom plugins)
2. Validate proposed changes: new plugins exist in framework, config overrides are valid types
3. If custom plugins need adding, switch to the Plugin Target flow for those
4. Present update plan: current composition vs proposed, config changes, new custom plugins
5. Run plan-checker before user gate

---

### Plan Validation Gate (all targets)

**Before presenting to the user**, run the **moku-plan-checker** agent to validate:
- Requirement coverage (every decision maps to a plugin or config)
- Dependency graph correctness (acyclic, order-satisfiable)
- Plugin identification completeness
- Event naming conventions
- **Steering alignment** (if `.planning/steering.md` exists): verify no plugin violates stated boundaries, MVP priorities are reflected in wave assignments

If the plan-checker finds BLOCKER issues, **use Interactive Triage** (read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/build-findings-triage.md`) to present each BLOCKER one-by-one via `AskUserQuestion`. The user decides: fix now, fix later, or dismiss. Fix all "Fix now" items before presenting the plan. WARNINGs are included in the presentation for transparency (no triage needed for WARNINGs).

### State Update (all targets)

**On exit**: Write/update `.planning/STATE.md` with:
- Phase: `stage1/pending-approval`
- Target type, plugin table, dependency graph, wave grouping
- Decisions from Step 0.5 (if any)
- Research summary from Step 0.6 (if any)

### User Gate (all targets)

Present the analysis along with the plan-checker validation results. Then use `AskUserQuestion`:
- Question: "Stage 1 Analysis complete. How would you like to proceed?"
- Header: "Stage 1"
- Options:
  1. label: "Approve (Recommended)", description: "Analysis looks good — proceed to Stage 2 (Specifications)"
  2. label: "Request changes", description: "Modify the plugin structure, tiers, or dependencies"
  3. label: "Add/remove plugins", description: "Change which plugins are included in the plan"
  4. label: "Start over", description: "Discard this analysis and restart Stage 1"
- multiSelect: false

Route based on selection:
- **Approve**: Update `## Phase:` to `stage1/approved`, proceed to Stage 2
- **Request changes**: Ask follow-up about what to change, re-run analysis, re-present gate
- **Add/remove plugins**: Ask which plugins to add/remove, update analysis, re-present gate
- **Start over**: Reset to pre-Stage 1 state, re-run Stage 1

---

## Stage 2: Specifications

**On entry**: Read `.planning/STATE.md`, confirm Stage 1 is approved. Load plugin table, wave grouping, and dependency graph.

### Framework Target

#### Record Spec Decisions

While creating specifications, record non-obvious design decisions to `.planning/decisions.md`:
- API shape choices (why this signature over alternatives)
- Event structure decisions (why events are structured this way)
- State design trade-offs (why mutable Map vs immutable array, etc.)
- Risk mitigations (especially for the risk identified in steering)

#### Create Plugin Specifications

For each plugin, create a detailed development specification. Save each spec as a separate file in the project's `.planning/specs/` directory:

- `.planning/specs/01-[plugin-name].md`
- `.planning/specs/02-[plugin-name].md`
- etc. (numbered by implementation order)

Each specification file must use the appropriate template from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-templates.md`:
- **Core plugins** → Core Plugin Specification Template (simplified: no events/dependencies/hooks sections)
- **Regular plugins** → Plugin Specification Template (full template)

#### Validation Loop

After all specs are created:
1. Run the **moku-plan-checker** agent to validate cross-spec concerns (dependency graph, event flow, requirement coverage, section completeness)
2. Run the **moku-structure-validator** agent over the plugin set (structure, tiers, spec compliance, family conventions)
4. Resolve any BLOCKER issues found
5. Re-run until all validators report zero BLOCKER violations

#### Final Output

Present:
- Summary of all specifications created
- Plan-checker validation report (with any remaining WARNINGs)
- Dependency graph (visual or textual)
- Communication map (events flowing between plugins)
- Wave grouping for parallel build execution
- Implementation order with rationale
- Example of the final consumer API

---

### App Target

#### Write the Specification

Save to `.planning/app-spec.md` (or user-specified path). Use the template from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-templates.md` (section: Application Specification Template).

#### Validate

1. Run the **moku-plan-checker** agent on the application plan
2. Use the **moku-structure-validator** agent to verify:
   - Plugin ordering satisfies all `depends` constraints
   - No imports from `@moku-labs/core`
   - Config types match framework expectations
   - Custom plugins follow spec

---

### Plugin Target

Write a plugin specification file to `.planning/specs/` (if within a framework project) or `.planning/` (if standalone). Use the plugin specification template from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-templates.md` — including the Verification section.

Include: overview, config, state, API, events, dependencies, hooks, lifecycle, communication, package dependencies, testing strategy, code example, and verification criteria.

1. Run the **moku-plan-checker** agent to validate the spec
2. Run the **moku-structure-validator** agent to validate the spec

---

### Update Plugin Specification

**This is used when VERB is `update`.** When updating an existing plugin, the spec file is an **update spec** rather than a full from-scratch spec. It must include:

- `## Changes` section listing what is being modified (added methods, changed config, new events, etc.)
- `## Preserved` section confirming what stays unchanged (existing API methods, config fields, event contracts)
- `## Migration` section if there are breaking changes (how existing consumers adapt, deprecation path)
- All other sections from the Plugin Specification Template, but reflecting the final post-update state (not just the delta)

The spec file overwrites the existing spec at `.planning/specs/NN-{name}.md` if one exists, or creates a new one.

### Update App Specification

When updating an existing app, write an updated `.planning/app-spec.md` that includes:

- `## Changes` section listing what is being modified
- `## Preserved` section confirming unchanged composition
- Updated Plugin Composition, Configuration, and Custom Plugins sections reflecting final state

---

### State Update (all targets)

**On exit**: Update `.planning/STATE.md` — mark Stage 2 as complete, list all spec files created.

### User Gate (all targets)

Present the completed specifications and validation results. Then use `AskUserQuestion`:
- Question: "Stage 2 Specifications complete. How would you like to proceed?"
- Header: "Stage 2"
- Options:
  1. label: "Approve (Recommended)", description: "Specs look good — proceed to Stage 3 (Skeleton Specification)"
  2. label: "Edit specs", description: "Modify specific plugin specifications before continuing"
  3. label: "Re-validate", description: "Run the validation pipeline again on current specs"
  4. label: "Go back to Stage 1", description: "Return to analysis — change plugin structure"
- multiSelect: false

Route based on selection:
- **Approve**: Update `## Phase:` to `stage2/approved`, proceed to Stage 3
- **Edit specs**: Ask which spec to edit, apply changes, re-validate, re-present gate
- **Re-validate**: Run plan-checker + validators again, re-present gate
- **Go back to Stage 1**: Reset phase to `stage1/pending-approval`, re-run Stage 1 gate

---

## Stage 3: Skeleton Specification

**On entry**: Read `.planning/STATE.md`, confirm Stage 2 is approved. Load spec file paths and plugin table from state.

### Framework Target

#### Produce the Skeleton Spec Document

Save to `.planning/build/skeleton-spec.md`. Use the Skeleton Specification Template from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-templates.md`. **Every code block satisfies `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/skeleton-conventions.md`** (≤30-line wiring index from the literal template, typed-const config, `type` not `interface` for Config/Api, `createCoreConfig` third CorePlugins arg, JSDoc tag-line rules, no inline `as`, no `wireX`, structural injectable types) — so the build doesn't have to reconcile spec code against the hooks. The document must contain all five sections:

1. **Architecture Overview** — entry structure, barrel pattern, core config registration
2. **File Structure** — complete file tree with every file annotated (tier, purpose)
3. **System Connections** — import map table, type reference chain, barrel export pattern
4. **Skeleton Build Waves** — same wave grouping as build waves; each wave contains ready-to-paste code blocks for every file (correct imports/exports, empty types, empty function bodies with correct signatures, JSDoc headers); Wave 0 must include core plugin skeletons + `src/config.ts` + `src/plugins/index.ts` + `src/index.ts`
5. **Verification Checklist** — checkboxes for format/lint/tsc/build + structural checks

**Delta vs full skeleton spec (`Verb: update`):** For an update build, the skeleton spec should add a `## Delta File Structure` section listing ONLY the NEW files the update introduces (alongside the full `## File Structure` for context). `build-skeleton.md` delta mode creates only those new files and never overwrites existing ones. If the update adds just a few new files, you may instead make `## File Structure` itself the new-files-only list and omit `## Delta File Structure` — build-skeleton treats a single structure as the delta when `Verb: update`. For `create`/`migrate`, emit one `## File Structure` (the complete framework); `## Delta File Structure` is ignored.

**Skeleton Code Block Correctness Constraints:**
- Plugin `index.ts` files import `createPlugin` from `../../config` (the framework's config.ts), not from `@moku-labs/core`. `@moku-labs/core` only exports `createCoreConfig` and `createCorePlugin`. The `createPlugin` factory comes from destructuring `createCoreConfig`'s return value.
- The plugin barrel (`src/plugins/index.ts`) uses namespace re-exports: `export * as [PascalCase] from "./[name]/types"`, not `export type *` (causes ambiguous re-export when plugins share type names like Config/State/Api). Consumers access types as `PluginName.Config`, `PluginName.Api`, etc.
- Use the `@file` tag, not `@fileoverview` (ESLint jsdoc/check-tag-names rejects it). Leave `@module` out of plugin files (flagged as redundant outside ambient context).
- Common abbreviations (`ctx`, `fn`, `cb`) are allowed — they are whitelisted in the ESLint unicorn config. Unused stub parameters should still have an underscore prefix (e.g., `_ctx`).
- Skeleton stub bodies use `throw new Error("not implemented")` for complex return types, not `return {} as X` (violates R6: no inline type assertions).
- For plugins with `handlers.ts`, the plugin `index.ts` imports `createHandlers` and include a `hooks: createHandlers` field — do not create dead handler files.

No source files are created here — this is a specification document.

---

### App Target

Produce `.planning/build/skeleton-spec.md` covering: `main.ts` structure, custom plugin skeletons per their approved tiers, framework import map, and verification checklist.

---

### Plugin Target

Produce `.planning/build/skeleton-spec.md` covering: tier-appropriate file structure, ready-to-paste code blocks for every file (imports, exports, empty types, empty function bodies, JSDoc headers), and verification checklist.

---

### State Update (all targets)

**On exit**: Update `.planning/STATE.md`:
- Phase: `stage3/pending-approval`
- `## Skeleton:` — on a fresh plan run (no prior build activity), always write `not-started`. Only preserve `in-progress`, `verified`, or `committed` if the build command already advanced the value during a prior session (i.e., the value was read from an existing STATE.md on resume and the build had already started). The plan command must never write `in-progress` — that value is reserved for the build command's first skeleton wave. If unsure, write `not-started`; the build command will advance it correctly
- Add skeleton spec path to Artifacts section: `Skeleton spec: .planning/build/skeleton-spec.md`
- Add skeleton wave rows to Wave Progress table (one row per skeleton wave + verification + commit), all with Status `not started`
- Set `Next Action: Run /moku:build resume (skeleton build will run first)`

### User Gate (all targets)

Present the completed skeleton spec document. Then use `AskUserQuestion`:
- Question: "Stage 3 Skeleton Specification complete. Ready to build?"
- Header: "Stage 3"
- Options:
  1. label: "Approve (Recommended)", description: "Skeleton spec looks good — run /moku:build resume to start building"
  2. label: "Edit skeleton", description: "Modify file structure, wave grouping, or code blocks"
  3. label: "Go back to Stage 2", description: "Return to specifications — change plugin specs"
- multiSelect: false

Route based on selection:
- **Approve**: Update `## Phase:` to `complete` (not `stage3/approved` — the jump table recognizes only `complete` for this state), update `## Next Action:`
- **Edit skeleton**: Ask what to change, apply edits, re-present gate
- **Go back to Stage 2**: Reset phase to `stage2/pending-approval`, re-run Stage 2 gate
