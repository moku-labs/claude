---
name: brainstorm
description: Explores an idea for a Moku project before planning. Analyses the codebase, researches the domain, runs one challenger pass over the position, and writes the context file that the plan station consumes. On request it puts the reasoning on a discussion page with diagrams and tables that the person comments on and corrects. Use when someone wants to discuss or think through an idea, is unsure what to build, or asks what you think before any plan exists. Writes nothing outside .planning/.
when_to_use: The brainstorm station of a size-L change, or any moment a user is unsure what to build and wants the idea explored before it is planned. Not for planning, building or unrelated repositories.
argument-hint: "{free-form description} or [create|modify|feature|migrate] {name} \"description\" [--deep [N]|--quick]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion, Skill, ToolSearch, Artifact, ArtifactComments
model: fable
effort: high
---

# Brainstorm

Explore an idea with the user until the approach is decided, then write it down. The output is one file, `.planning/context-{NAME}.md`, which `/moku:plan` reads through `--context`. You are a colleague with opinions: analyse, propose, show code, take a position. Never ask a question you can answer by reading the project.

Agent types are plugin-qualified when you spawn them: `moku:moku-researcher`, `moku:brainstorm-challenger`. A bare name does not launch.

## First action

```bash
moku-rails enter brainstorm
```

Exit code 2 means refused: relay the printed `Refused:` line and `Next step:` and stop. Brainstorm is one of the stations allowed before `init`, so an uninitialized project is not a reason to refuse — talking and sketching are safe there.

Invoked directly with no change open? Open one first, then enter:

```bash
moku-rails open 2026-09-26-offline-mode --size L --type feature --title "Offline mode"
moku-rails enter brainstorm
```

Before every user gate run `moku-rails pause --reason "<why>"`. At the end, after the context file is written, run `moku-rails done brainstorm`.

## Ground every decision in the spec

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/spec-index.md` and open the `spec/NN-*.md` files the description touches (architecture, plugin boundaries, events, types, invariants) before research and before the challenger pass. Spawn `moku-researcher` and `brainstorm-challenger` with the instruction to weigh every approach against cited sections. An approach that would break `spec/11-INVARIANTS.md` is surfaced as a challenge, not quietly adopted. The final context file carries a populated Spec Alignment table so plan verifies against the same sections.

The one hard app-shape rule is I1 in `moku-idioms.md`: a Layer-3 app composes with `createApp` and does not define a framework (`createCoreConfig`, `createCore`, or a direct `@moku-labs/core` dependency). Fix a position that violates it. Several `createApp` instances, several frameworks side by side and folder splits are idiomatic; I2 to I6 are nudges toward the `demos/tracker` shape.

## Input

`$ARGUMENTS` may be plain language. Resolve it per `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/nl-args.md`, echo one `Interpreting as: …` line, and ask only for what is genuinely missing.

| Category | Means |
|---|---|
| `create` | New framework, app or plugin from scratch |
| `modify` | Rethink an existing plugin or framework |
| `feature` | Add a capability to an existing project |
| `migrate` | Move an existing codebase onto Moku |

NAME is a short slug: strip path separators, keep `[a-z0-9-_]`, cap at 50 characters, derive it from the first meaningful words of the description when no name token is given, and append `-project` when it collides with a category keyword. DESCRIPTION is everything else; ask for it when it is empty.

Depth flags: `--quick` and `--deep [N]` are mutually exclusive, and `--deep N` needs a positive integer with no upper cap. Depth sets how many researchers run and how many debate rounds are allowed. Run `mkdir -p .planning/build/` before the first write.

**Existing context.** If `.planning/context-{NAME}.md` already exists, ask: resume from the saved scratch files, start fresh (delete `.planning/brainstorm-{NAME}-*` and the context file), or cancel. Resume restores the depth from the saved analysis instead of asking again.

**Design context.** A finished `moku-design:design` run leaves `.planning/design/<slug>/design-context.md`. If one relates to this subject, offer to ground the session in it and treat it as the design specification the architecture has to realise: debate how to build it properly on the Moku stack, not what it should look like. Note in the context file that the design's prototype is demo-only and gets re-implemented from scratch, so plan inherits that constraint.

## The discussion page

When the person brings an idea and not a task, offer once to put the reasoning on a page they can comment on and correct: diagrams of how it would work, a table of options, open questions with proposed answers, and a decisions log that becomes the context file. It is their choice; talking it through in chat stays the default. Read `references/discussion-artifact.md` for when to offer it, what goes on the page, how to publish it and how the comment loop runs. The analysis, the research and the challenger pass below feed the page; the page replaces only the question-by-question debate.

## The flow

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/brainstorm-flow.md` and follow it. Four phases: analysis, depth scoring, research, debate. The debate loop itself is in `brainstorm-debate.md`, and every document shape is in `brainstorm-templates.md`.

You write the position document and the final context file yourself, from those templates. There is no synthesizer agent: a subagent writing a document the orchestrating session then has to re-read costs a round trip and loses the debate it was not part of.

The challenger runs **one pass** by default. Repeated review loops over the same artifact measured about 25 extra minutes for identical quality, so more rounds are opt-in: `--deep N` sets N rounds, and the user can always ask for one more at the closing gate.

Context variables carried through: CATEGORY, NAME, DESCRIPTION, DEPTH_FLAG, CUSTOM_ITERATIONS.

## Rules

- Write only inside `.planning/`. Source changes happen at the build station; the rails write hook enforces this, and it refusing means a station was skipped.
- Never write `.planning/STATE.md`. Brainstorm state is separate from plan state.
- Scratch files use the `.planning/brainstorm-{NAME}-*` prefix and are deleted at the end. `.planning/context-{NAME}.md` and `.planning/learnings.md` survive.
- Spawn researchers in parallel, as several Agent calls in one response. A researcher that returns nothing is logged and skipped, never waited on.
- Detect complexity from the project. Do not ask the user to self-report what you can observe.
- Every architectural question carries TypeScript examples per option, a recommendation with reasoning, and named concerns about each alternative. Ask zero questions when the context is clear; more than three is a sign you are asking things you could answer.
- The debate converges when the user is satisfied or the round limit is reached. Do not force rounds.
- The context file is complete when plan can skip its own steering and discussion phases entirely.

## Closing

Present the finished context file for approval (pause first), then run `moku-rails done brainstorm` and say what comes next.

Before suggesting the next step, check for other unplanned contexts: `ls .planning/context-*.md`, excluding the one just written. Several features planned together produce one merged plan; planned separately they collide over the same spec slot.

- Other contexts exist: "Context saved to `.planning/context-{NAME}.md`. These other contexts are also unplanned: {list}. To plan them as one plan, run `/moku:plan create [type] \"{combined-name}\" --context context-{NAME}.md {--context each other file}`. To plan this one alone, drop the extra flags."
- Otherwise: "Context saved to `.planning/context-{NAME}.md`. Run `/moku:plan create [type] \"{NAME}\" --context context-{NAME}.md` to plan it."

Inside a conductor-driven change, say the same thing in plain words and let the conductor walk to the plan station.
