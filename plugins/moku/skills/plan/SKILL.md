---
name: plan
description: Turns an intake or a brainstorm context into buildable Moku specifications at the plan station. Writes a delta spec for a size-M change to an existing project, and a full three-stage gated plan for a new project or a size-L change. Never writes source code.
when_to_use: The plan station of a moku change, or a direct request to plan or spec a Moku framework, app or plugin. Not for building, and not for unrelated repositories.
argument-hint: "{free-form description} or [create|update|add|migrate|resume] [framework|app|plugin] {requirements} [--delta|--full|--quick] [--context {file}]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion, Skill
model: fable
effort: high
---

# Plan

Turn what the user wants into specifications a builder can implement without asking questions. Plan writes specs and recommends the build; it never creates or edits source files. Builders read only the specs, so anything left implicit here turns into drift there.

## First action

```bash
moku-rails enter plan
```

Exit code 2 means refused. Relay the printed `Refused:` line and `Next step:` in the user's language and stop. The common refusal is an uninitialized project: planning is not allowed before `init`, so offer the init station instead of planning anyway.

Invoked directly with no change open? Open one first, then enter:

```bash
moku-rails open 2026-09-26-nested-routes --size M --type feature --title "Nested routes"
moku-rails enter plan
```

Before every user gate run `moku-rails pause --reason "<why>"`, so stopping is recorded rather than looking like an abandoned station. When the plan is approved, finish with `moku-rails done plan`.

## Ground every decision in the spec

Before any decision about architecture, the core API, the factory chain, config, lifecycle, events, `ctx`, types, invariants or plugin structure, read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/spec-index.md` and open the cited `spec/NN-*.md`. Cite section ids (`spec/NN-*.md §N`) in the specs you write, and justify any deviation against a cited section. `.planning/` is local state and is never staged or committed.

Never put explicit generics on `createPlugin`; types are inferred from the spec object. The moku-plugin skill has the rule, the tier table and the examples.

## Input

`$ARGUMENTS` may be plain language. Resolve it per `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/nl-args.md`: map it onto the verbs, types and flags below, echo one `Interpreting as: …` line, and ask only for a missing required value. Already-structured input is used verbatim with no echo.

| Verb | Type | Means |
|---|---|---|
| `create` | framework, app, plugin | New target from a description |
| `update` | framework, app, plugin | Change an existing target |
| `add` | plugin | One new plugin spec for an existing framework |
| `migrate` | framework, app | Map an existing codebase onto Moku |
| `resume` | — | Continue a full plan from `.planning/STATE.md` |

`create` is the default for a project that does not exist yet, `update` otherwise. `migrate` requires a readable source path or URL; ask for it rather than guessing. Empty arguments: read `.planning/STATE.md` and offer the states it allows (resume, add a plugin, update, start fresh) with `AskUserQuestion` instead of printing syntax.

Run `mkdir -p .planning/build/` before the first write of the session. On a fresh project nothing under `.planning/` exists yet and every later write would fail.

## Two routes

Read the size from `moku-rails status --json` (the ledger owns it). The user may raise the size, never lower it.

| Situation | Route | User gates |
|---|---|---|
| Size M change to a project that already has specs | Delta spec | 1 |
| New project, or size L | Full plan, three stages | 3, or 1 with `--quick` |
| `add` a single plugin | Delta spec, plugin flavour | 1 |

`--delta` and `--full` override the choice explicitly. A size-M change with no `.planning/specs/` yet has nothing to delta against, so it takes the full route.

### Delta spec

A size-M change touches a known system. Replanning it from scratch throws away work the user already approved and invites the builder to rewrite plugins that were fine. Write the difference instead:

- `.planning/changes/<id>/delta-spec.md` — what changes in which plugin: config, state, api, events, new tests, README impact. Template in `plan-templates.md`.
- The affected plugin specs in `.planning/specs/` — updated in place, untouched plugins left alone.

Procedure in `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-stages.md` (Delta Spec). One gate: present the delta, the touched specs and the plan-checker report, and wait for approval.

### Full plan

Three stages, each ending in a user gate: analysis and structure, specifications, skeleton specification. Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-stages.md` for the per-stage work and `plan-templates.md` for every document template.

Then load exactly one verb reference, the one matching the verb:

| Verb | Reference |
|---|---|
| `create` | `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-verb-create.md` |
| `update` | `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-verb-update.md` |
| `add` | `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-verb-add.md` |
| `migrate` | `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-verb-migrate.md` |
| `resume` | The verb stored in `.planning/STATE.md`, resumed at the recorded phase |

`--quick` collapses the three gates into one combined gate at the end. The per-stage `STATE.md` writes still happen, so a dropped session can resume. The plan-checker still runs before that single gate.

## Context from brainstorm and design

`--context <file>` may appear more than once; all of them feed one plan. This is how two features explored in one session get planned together instead of colliding over the same spec slot. Resolution and merge rules are in `plan-verb-create.md` (Context Injection).

Each token resolves under `.planning/` only. Reject an absolute path, a path that escapes `.planning/` through `..`, shell metacharacters (`; | $ \` ( )`) and an empty token, naming the offending token. Then probe `.planning/<token>`, `.planning/<token>.md`, `.planning/context-<token>.md` in that order, and stop if none exists — silently dropping a context the user asked for is worse than stopping. Record the resolved list in `STATE.md` under `## ContextFile:`; an explicit `--context` at invocation wins over the stored value.

Design lives in the `moku-design` pack. A finished `moku-design:design` run leaves `.planning/design/<slug>/design-context.md`. If one exists whose slug or title relates to the request, offer to ground the plan in it, and append it to the context list when the user agrees.

A design context is a spec, not source. Its prototype is a demo artifact: the implementation is written from scratch against the project's conventions, never copied, ported or used as a scaffold. Carry that instruction into two places, because a note only in this skill dies here:

1. Every spec for a screen or component derived from the design, in its Overview and Verification sections, naming the conventions that apply (for web: moku-web islands, `@scope`/`@layer`, `data-*` attributes rather than class selectors, the token system, one route table, a node-free client bundle, readable-code style).
2. Every planning agent you spawn, in its prompt.

The design context says what to build; the specs and the conventions say how.

## Guards that protect user work

Read these in `plan-stages.md` before touching existing planning files:

- **Unbuilt-Plan Guard** — the single gate every spec-clearing path passes through. Approved-but-unbuilt specs are real user work; the user chooses Combine, Archive or Replace, and only Replace permits deletion.
- **State write protocol** — back up, write `.tmp`, validate the required headers, rename. One occurrence of each `## Header:` field, edited in place.
- **Resume** — the phase-to-stage jump table, and the precedence rules for values passed at invocation over values stored in `STATE.md`.

## Validation

Run `moku-plan-checker` on the assembled plan before every user gate, and resolve every BLOCKER before the gate is shown; users review validated plans only. If a BLOCKER surfaces after a gate was shown, withdraw the gate, fix, re-run the checker and present again.

The checker's one architecture BLOCKER is I1: a Layer-3 app that defines a framework (calls `createCoreConfig` or `createCore`, or depends on `@moku-labs/core` directly). Fix it with `createApp` plus the framework's `createPlugin`. Several `createApp` instances, several frameworks side by side and folder splits are idiomatic; I2 to I6 are warnings, not gate blockers. The rubric is `moku-idioms.md`, the worked reference is `demos/tracker`.

`moku-researcher` is the one agent with web access. Spawn it when the domain is unfamiliar enough that guessing the ecosystem would shape the plan wrongly; its output goes to `.planning/build/research.md`.

## Rules

- Follow the moku-plugin skill's complexity tiers.
- Every plugin gets an implementation order number and a wave assignment. Plugin 1 depends on nothing; each later plugin depends only on already-numbered plugins.
- Structure: `src/config.ts`, `src/index.ts` and `src/plugins/` only. Any other root file or folder is justified to the user explicitly.
- Consumer code imports `createApp` and `createPlugin` from the framework package, never from `@moku-labs/core`.
- Include `onStart`/`onStop` only when there is a real resource to manage, and say why in the spec either way.
- Every spec carries package dependencies, a testing strategy, verification criteria, full JSDoc requirements, and a consumer-API example with every plugin method typed.
- Specs are self-contained: someone reading them implements the whole thing without asking further questions.
- Record non-obvious trade-offs in `.planning/decisions.md` per `decision-knowledge-graph.md`, so a later agent does not undo an intentional choice.
- Read `.planning/STATE.md` at the start of each stage and write it at the end, refreshing the `## Recovery` block so a cold session rehydrates in one read.
- Plan never builds. No source files, no build references, no build steps. When the plan is approved, set `## Next Action:` and tell the user to run `/moku:build resume`.
