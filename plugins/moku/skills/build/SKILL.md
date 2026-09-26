---
name: build
description: Builds a Moku framework, consumer app or plugin from the specs in .planning/ — skeleton, dependency-ordered waves, verification and gap closure, with an S route that fixes one plugin from a failing test. The conductor runs it at the build station; a user can also invoke it directly.
argument-hint: (empty to auto-resume) or [framework|app|plugin|add|resume|fix] [spec-path-or-name] [--dry-run] [--continue] [--lean]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion, Skill
model: fable
effort: medium
---

# Build

You turn an approved plan into working code. Builders write plugins in parallel, you verify what
they claim, and the change moves one wave at a time so the user keeps control.

Agent types are plugin-qualified when you spawn them: `moku:moku-builder`, `moku:moku-code-reviewer` and so on. A bare name does not launch.

Agents may run in the background (`run_in_background: true`): the write gate never holds a subagent by the routing flag, a prompt the harness writes while they run closes nothing, and ending your turn to wait for their hand-backs is a legitimate end of turn inside the station. Several Agent calls in one response already run in parallel, so the foreground is fine too, and it is the only choice in a non-interactive session (an eval, `claude -p`), where a background completion may never arrive. Only one builder writes a given plugin at a time: never spawn two on the same `src/plugins/{name}/`, and when a builder refuses because it found another writer there, that refusal is correct. You commit after each green round; builders never commit.

## Rails first

```bash
moku-rails enter build          # exit 2 = refused: relay the reason and the named next step
```

If the user invoked this skill directly and no change is open, open one first:

```bash
moku-rails open <date-slug> --size S|M|L --type <type> --title "<what changes>"
```

Before you stop to ask the user anything mid-station, run `moku-rails pause --reason "<why>"`.
When the build is complete, run `moku-rails done build`.

## Two routes

Read the change size from `moku-rails status --json`.

| Size | Route |
|---|---|
| S | No skeleton, no waves. Reproduce the bug with a failing test when practical, fix inside the one plugin it belongs to, run lint and tests scoped to that plugin, hand over to `moku:verify`. |
| M, L | Skeleton, then dependency-ordered waves, then final verification and documentation. |

The S route ends here: report what changed, the test that now passes, and run `moku-rails done build`.
Everything below is the M/L route.

## Spec authority

Before any decision about the core API, factory chain, config, lifecycle, events, `ctx`, types or
plugin structure, read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/spec-index.md` and open the
`spec/NN-*.md` file it cites. Cite the section id in output and justify deviations against it.
`.planning/` is local state — it is never staged or committed.

## Project configuration
!`test -f .claude/moku.local.md && head -20 .claude/moku.local.md || true`

Values come from the YAML frontmatter of `.claude/moku.local.md`. Ignore invalid values and unknown keys.

| Setting | Type | Range | Default | Used by |
|---|---|---|---|---|
| `maxParallelAgents` | integer | 1–8 | `${user_config.max_parallel_agents}` (the plugin option, 3 unless changed) | wave fan-out |
| `gapClosureMaxRounds` | integer | 0–5 | 2 | gap closure |
| `skipValidation` | boolean | true/false | false | post-build validation |
| `skipTriage` | boolean | true/false | false | findings triage |
| `enablePipelining` | boolean | true/false | true | wave pipelining |
| `leanMode` | boolean / "auto" | true/false/"auto" | "auto" | prompt size |

## What to build

`$ARGUMENTS` may be free-form. Resolve it to one of the verbs below and echo one line saying how you read it.

| Input | Meaning |
|---|---|
| empty, "continue", "keep going" | `resume` from `.planning/STATE.md`; if no STATE.md but `.planning/specs/` exists, `framework` |
| `framework` [`config`\|`plugins`\|path] | build from `.planning/specs/`; `config` builds only `config.ts` + `index.ts`, `plugins` only the plugin waves (needs `src/config.ts`) |
| `app` [path] | build the consumer app from `.planning/app-spec.md` |
| `plugin <name>`, `plugin #3`, `plugin #3-#5`, `plugin #3,#5` | build those specs from `.planning/specs/` |
| `add <name>` | build one plugin whose spec came from `/moku:plan add`, then the delta updates in `build-final.md` Step 8 |
| `fix`, `fix <name>`, `fix --all` | error recovery on plugins with `needs-manual` or `verify-failed` |
| `--dry-run` | report the wave plan and the files each wave would create; write nothing |
| `--continue` | run the remaining waves without stopping between them; mutually exclusive with `--dry-run` |
| `--lean` | shorter agent prompts (`build-lean-mode.md`); a cost lever, not a requirement |
| `#wave:N` | re-run wave N; not valid with `fix` |

Resolution rules that bite: `#N` maps to `0N-*.md` below 10 and `N-*.md` at 10 and above; a spec path
must stay inside `.planning/specs/` (reject `..` or anything resolving outside the project); a name
with no glob hit gets a case-insensitive retry, then the available specs are listed and you stop.
When several specs in a range or list are missing, ask whether to build the found ones or cancel.
A plugin named after a verb (`resume`, `fix`, `add`, `framework`, `app`, `plugin`) is refused —
those names are reserved.

Nothing to build and nothing recognizable: tell the user to run `/moku:plan` first, and stop.

## State

`.planning/STATE.md` is the record of the build: phase, verb, target, skeleton status, plugin table,
wave progress and the git checkpoint. Wave progress lives there and nowhere else.

**Reading it.** No STATE.md and a `.planning/build/skeleton-spec.md` on disk: write a fresh STATE.md
with `## Skeleton: not-started` and continue. Missing or malformed `## Phase:`, `## Target:` or
`## Next Action:`: offer to regenerate it from the spec files, inferring the target, and say the values
were inferred. Every plugin already `complete` and the phase `complete`: say the build is done and stop,
unless `#wave:N` was passed — that re-runs wave N on purpose, so reset wave N's plugins to `building` first.
Plugins with status `retry-pending` route straight to fresh-context retry (`build-verification.md`);
plugins with status `pipeline-built` route to pipeline reconciliation (`build-wave-execution.md`).

**Idempotency, at wave start.** A plugin still marked `building` means the previous invocation crashed
mid-wave. If its directory holds real files, ask whether to resume from them or reset to the checkpoint;
if it holds only skeleton stubs, reset. A reset needs a valid `## Git Checkpoint:` — check the field
exists and `git cat-file -e <sha>^{commit}` succeeds, and if either fails, say so and give the manual
recovery steps instead of guessing. Set `building` at wave start, not at completion, so the next crash
is detectable.

**Writing it.** A half-written STATE.md loses the whole build, so write it through a temp file:
copy to `.planning/STATE.md.bak`, write `.planning/STATE.md.tmp`, check the tmp file has the required
headers (and still carries `## Mode:` if the previous file had it), then rename over STATE.md. On a
failed check, delete the tmp file and stop — the `.bak` is intact. Record the current commit SHA as
`## Git Checkpoint: <sha>` so a bad wave can be rolled back. An existing `.planning/STATE.md.tmp`
means another build may be running: stop and let the user resolve it.

## Skeleton before waves

Read `## Skeleton:` from STATE.md on every M/L invocation, before routing anywhere else.

| Status | What you do |
|---|---|
| absent | Old format — treat as committed |
| `not-started` | Read `.planning/build/skeleton-spec.md`, go to `build-skeleton.md` Step S1 |
| `in-progress` | Resume at the first skeleton wave that is not done |
| `verified` | Re-present `.planning/build/skeleton-report.md` and ask for approval to commit |
| `committed` | Wave analysis in `build-framework.md`, and only then plugin code |

Any argument (`resume`, `#wave:N`, `--continue`) waits until the skeleton is committed; say so, then
apply it afterwards. `--continue` does not skip the approval gate. After the commit, confirm it exists
with `git log --oneline -1`.

## Which reference to read

Read one file at a time, when you reach that phase.

| You are here | Read |
|---|---|
| Framework build, any phase | `build-framework.md` (the phase-to-file map) |
| Consumer app build | `build-app.md` |
| One plugin, any route | `build-plugin.md` |
| Skeleton waves | `build-skeleton.md` |
| Wave analysis, builder dispatch, pipelining, wave disposition | `build-wave-execution.md` |
| After builders return: reconciliation, gap closure, regression, retry | `build-verification.md` |
| Barrel and `src/index.ts` shape | `build-assembly.md` |
| Validators disagree on the same file | `build-conflict-resolution.md` |
| Findings need user decisions | `build-findings-triage.md` |
| Cutting prompt size on a large build | `build-lean-mode.md` |
| Code review passes | `build-multi-pass-review.md` |
| Final verification, docs, integration tests, coverage, release pointer | `build-final.md` |

All paths are under `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/`.

## Who does the work

Only this session spawns agents; no agent spawns another.

| Job | Who |
|---|---|
| Build a plugin | `moku-builder`; `moku-builder-deep` for tier Complex or VeryComplex, and after one failed attempt |
| Diagnose a build error | `moku-error-diagnostician`, or `-deep` on the same rule. It returns a diagnosis; you dispatch the fix |
| Check artifacts after a wave | `moku-verify-artifacts <plugin> --tier <tier> --run --json` (exit 0 pass, 2 fail) |
| Review a wave's diff | `moku-code-reviewer` |
| Validate structure, style, quality, architecture | `moku-structure-validator`, `moku-style-validator`, `moku-quality-validator`, `moku-architecture-validator` |
| Filter Sonnet validators' findings | `moku-skeptic` — a finding that does not survive it does not count |
| Decide continue / stop-for-review / retry after a wave | You do, with the table in `build-wave-execution.md` |
| An agent returns without its report | You resume it exactly once ("Deliver your report now"), then record `FAIL` (`no report`) and go on. Never an open-ended wait: `agent-preamble.md` → "For the orchestrator" |

## Error recovery (`fix`)

Entered by `fix`, or by `resume` when STATE.md says `## Verb: fix`. It needs the skeleton committed;
if it is not, say which step comes first and stop. `fix --all` with nothing failing reports that and stops.
For each target: read the partial files, the spec and the previous failure, ask the error diagnostician
for a diagnosis, apply the fix yourself, re-run format, lint, tsc and tests, and mark `verified` on green.
After two rounds without green, report what remains.

## Closing the station

Waves done, final verification green, docs written: update STATE.md, report what was built, and run

```bash
moku-rails done build
```

Then say what comes next — `moku:verify` scoped to what the change touched.
