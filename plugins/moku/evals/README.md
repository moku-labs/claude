# moku evals

Behavior tests for the plugin itself. Four suites, from cheap and gated to expensive and by hand:

| Suite | Where | What it guards | Cost and time of one pass | When |
|---|---|---|---|---|
| Core, the gate | `plugins/moku/evals/`, 15 cases | Conductor, rails, code shape, tests rules | $3.6 and 7.5 min per run-set; the gate runs 3: about **$11**, 6–8 min at `-j 4` | Locally, `npm run evals:gate` before merging a PR that touches `plugins/moku/` |
| Long | `plugins/moku/evals-long/`, 9 cases | Builder route, real-size builds and delta fixes, task splitting | about **$22** for one run of every case, 80 min at `-j 1` | By hand, before and after a change to the build route, the builders or the conductor's staging |
| Manual harnesses | `plugins/moku/evals-manual/` | Builder arms on a real fix, validator effort (F2) | $2 per F2 run; the real case only on a subscription session | By hand, when a model or effort of an agent changes |
| Design fidelity | `research/design-fidelity/baseline/harness` (not in the repo) | Built screens against the HTML prototype | $2–4 per screen, about $40 for the synthetic set | Nightly or by hand; never in CI |

### The gate

```bash
npm run evals:gate                                # run the 15 cases ×3 and compare (about $11)
npm run evals:gate -- --case 'tests-*'            # only the matching cases, against their part of the baseline
npm run evals:gate -- --from <aggregate-result.json>   # compare a result on disk, nothing paid
npm run evals:gate -- --write-baseline <aggregate-result.json> --source "<commit, versions, date>"
```

`scripts/evals-gate.mjs` runs `claude plugin eval plugins/moku --runs 3 --ablation none --json` with this repository's
`moku-rails` first on `PATH`, and compares with `baselines/gate.json` (main ebe03c6, moku 0.85.10: overall 0.972,
$3.58 and 453 s per run-set). It **fails** when the overall score is below the baseline − 0.03, or a case passes more
than one run of three fewer than the baseline (`readable-stanzas` and `tests-kill-check` are at 2/3 there, so they
fail at 0/3). A case missing from the run fails; a new case is listed and not judged. Cost and time are printed per
case and in total, with a **warning** above +10 %; they never fail the gate.

The gate runs **locally, before a merge**, not in CI: whoever opens a PR that changes the prose of `plugins/moku/`
(skills, agents, references) runs `npm run evals:gate` on the branch and pastes its table into the PR description.
A red gate blocks the merge. Rewrite the baseline only on purpose, from a run on `main`, and say why in the commit:
a change that lowers a score and is right moves the baseline in the same PR, with the reason.

`EVALS_MAX_COST_USD` (default 20) is the run's cost ceiling, `EVALS_CONCURRENCY` (default 4) its `-j`.

### The long suite

```bash
npm run evals:long -- --case build-board-high --max-cost-usd 10
```

| Case | Guards | One run |
|---|---|---|
| `build-board-high` | A Complex plugin built by `moku-builder` from a spec; 41 hidden tests | $1.5, 7.5 min (Sonnet builder) |
| `build-board-deep` | The same build by `moku-builder-deep` | $2.7, 10 min (Opus high) |
| `build-board-staged` | The same build in three stages, a deep builder each | $9.1, 36 min |
| `delta-fix-perframe` | Two behaviour-preserving per-frame fixes on an open change, tests kept | $0.55, 2 min |
| `delta-fix-staged` | The same fixes in two stages | $0.58, 2 min |
| `split-offer-big` | A large request gets two to five stages proposed, and no code | $0.7 |
| `split-not-for-bug` | A long bug report gets no stages | $0.8 |
| `split-not-for-tweaks` | Six small edits get no stages | $1.4 |
| `split-one-go-respected` | "In one go" is not argued with | $0.8 |

The `build-board-*` graders see the trace, not the code: the quality there is the hidden
`hidden/acceptance.test.ts` (31 rules of the spec and 10 edges: the energy remainder at max, a tie of `nearestEmpty`
across a row edge, exactly 20 undo records, a v1 save with empty cells and so on), run on the kept sandboxes:

```bash
chmod 700 /private/tmp/e-XXX /private/tmp/e-XXX/sealed   # each sandbox the run printed
python3 -I plugins/moku/evals-manual/score_kept_runs.py <aggregate-result.json> \
  plugins/moku/evals-long/build-board-deep/hidden/acceptance.test.ts <scored.json>
```

The scorer copies the hidden test into each kept sandbox and runs it with `bun test`, with the agent's own tests and
the tokens of the run. The routing finding of 2026-11-05 holds: a Complex spec sends even `build-board-high` to the
deep builder now and then (build/SKILL.md, "deep for tier Complex"), so read `agent_types` in the scored rows rather
than the case name. On 2026-11-10 (0.95.0, 3 runs each, 41/41 in every run): `build-board-high` with the
builder on Sonnet $1.50 and 7.5 min, on Opus $2.86 and 10 min; `build-board-deep` at Opus xhigh $5.36 and 20 min,
Opus high with the ceiling $2.69 and 9.6 min, Sonnet $1.33 and 6.5 min. Baselines of 2026-11-05: the hidden tests pass in every kept build (41/41 in 11 of 11), the
`split-*` cases offer stages in one run of three with or without the plugin.

### Manual harnesses

- `evals-manual/real-quiet-prompts/`: a real S fix (memory_missing 2a74eacb). `build.sh` rebuilds the tree just before
  the fix from the source repository (read only, by `git archive`), `prompt.md` is the builder brief, `score.py`
  scores a run: the real fix's test, the board's 650 tests, tsc, 5 mutants. The brief goes to the builder arm directly
  (Agent tool, or `claude -p --agent moku:moku-builder`), not through the runner: the runner's case is the main thread.
  On 2026-11-05: deep 324 s, high 123 s, Sonnet 76 s (medians, n=3), the same quality. `run_arm.sh <sonnet|high|deep>`
  spawns the arm through the Agent tool instead, so the builder stop hook checks it as in a real build; with it (0.88.0)
  Sonnet left 0 new tsc errors in 3 of 3 runs, the hook's own check took 23–37 s.
- `evals-manual/f2-validators/`: a plan and a framework with seeded holes; `run_f2.sh <plan|code> <high|medium> <rep>
  <out> <plugin copy>` runs one validator, `grade_f2.py <out>` counts the holes each report names. About $2 a run.

### Design fidelity

`research/design-fidelity/baseline/harness` (`run.sh`, `fidelity.mjs`, `score.py`) builds a screen from an HTML
prototype and measures it element by element and by pixels at five viewports. A run needs a browser and several
minutes per screen, costs $2–4, and waits when two heavy runs are already on the machine. It stays out of CI: run it
nightly or by hand, and see `research/plan/baseline-design.md` for the commands.

The design station's own rounds have two cases in `evals/moku-design/`: `design-round-motion-game` and
`design-round-motion-web` run round 1 of a design with two concepts and check that each concept carries a motion
table, plays it live and opens every state and size by URL. A run spawns two generators (about 110 thousand
tokens and 6 minutes each). Score the kept sandboxes with `moku-proto-check <concept> --json <out>`: rows with
all eight columns, required events, states × sizes, motion live.

```bash
PATH="$PWD/plugins/moku/bin:$PWD/plugins/moku-design/bin:$PATH" claude plugin eval . --case 'design-round-motion-*' \
  --scaffold --trust-plugin --no-publish --keep-temp --allow-tools Write Edit Bash Agent Task --runs 1 --ablation none -j 2
```

Keep at most two heavy runs (`claude plugin eval`, `claude -p`) on one machine at a time; they share one rate limit
and the times stop being comparable.

## Running the core cases

Run from the repository root:

```bash
claude plugin eval plugins/moku --trust-plugin --no-publish --allow-tools Write Edit Bash
```

Iterate on one case without the no-plugin baseline:

```bash
claude plugin eval plugins/moku --trust-plugin --no-publish --case conductor-idea --runs 1 --ablation none
```

| Case | Guards |
|---|---|
| `nano-plugin-shape` | R1, R4, R7: inferred generics, `<name>Plugin` export, no `as any` |
| `thin-root` | Root files stay thin composition (idiom I4) |
| `readable-stanzas` | Stanza style: guard first, intent comments. The structure is checked by three regexes (no outer `else { return undefined }`, two commented groups, a named pattern or match step); the judge only checks that behaviour is unchanged |
| `conductor-idea` | Plain-language idea reaches the conductor and the init station |
| `rails-no-init` | No code is written into an uninitialized project |
| `release-first-publish` | Release flow is three commands, no NPM_TOKEN |
| `tweak-quick-edits` | A run of quick edits opens a size Q change, asks `moku-rails tier`, makes the edit and runs no checks in between. Needs `--scaffold`. |
| `waves-next-wave` | The next wave and its parallel plugins are named right, from the rails status every turn starts with, and nothing is built on a question. Needs `--scaffold`. |
| `rails-design-check-gate` | A change that follows a design does not leave the build station without a passed design check, and the agent never passes `--no-design-check` itself. Needs `--scaffold`. |
| `rails-checkpoint` | "I'll sign in with another account, save my sessions" runs `moku-rails checkpoint`, not `pause`, leaves the sign-in to the person, names `resume-checkpoint`, and never reads a credential. The eval sandbox may not read the transcripts, so an honest "blocked, run it yourself" passes too. Needs `--scaffold`. |
| `tests-name-the-bug` | Tests written from a spec guard every promised behaviour, the boundary included, and none tests plain data, a type or that a function exists. Needs `--scaffold`. |
| `tests-keep-the-floor` | "Make the tests faster" deletes nothing: the useless file is named and proposed, the tests of behaviour stay. Needs `--scaffold`. |
| `tests-coverage-no-filler` | Under the 90% threshold and in a hurry: a real test for the untested behaviour, no lowered threshold, no exclude, no ignore comment on its own; the branch the spec does not name is the person's call. Needs `--scaffold`. |
| `tests-kill-check` | Asked only to finish a build with green tests, the agent breaks the code or a copy of it, finds the unguarded behaviour, closes the holes and leaves the code intact. Needs `--scaffold`. |

The four `tests-*` cases are the guard of test quality, and they pull against each other on purpose:
`tests-name-the-bug` and `tests-keep-the-floor` fail an agent that writes filler or deletes freely,
`tests-coverage-no-filler` and `tests-kill-check` fail an agent that stops guarding behaviour. A change to
the testing rules is good only when all four hold. Run them before and after such a change:

```bash
PATH="$PWD/plugins/moku/bin:$PATH" claude plugin eval plugins/moku --scaffold --trust-plugin --no-publish \
  --allow-tools Write Edit Bash --case 'tests-*'
```

Their fixtures are plain TypeScript run by `bun test`, so the sandbox needs Bun and no install.

Scores at 0.85.0 with these rules, 3 runs per arm, haiku judge, 2026-10-11:

| Case | With the plugin | Without |
|---|---|---|
| `tests-name-the-bug` | 1.00 | 0.56 |
| `tests-keep-the-floor` | 1.00 | 1.00 |
| `tests-coverage-no-filler` | 1.00 | 1.00 |
| `tests-kill-check` | 1.00 | 0.88 |
| `rails-design-check-gate` | 1.00 | 0.33 |

Two cases score the same without the plugin: the bare model already holds that line. They stay as guards:
a rule change that makes the agent delete tests or lower a threshold shows up there as a drop.

What writing these cases taught:

- A prompt must not hand the agent the permission the case is about. "Just drop it" and "add an ignore"
  are the person's yes, and an agent that takes them is right.
- A grader with `max: 0` passes for a run that did nothing. Give it weight 0.5 and the graders of real work
  weight 2.
- An `llm` grader with `focus: trace` gets a shortened trace (about 45 kB of 140 kB in a run with the
  plugin). Keep its criteria to one fact, and put what a file can prove into a `regex` grader with
  `target: { source: file, path }`.
- Do not grade the tool an agent uses to break code. A mutation on a copy is better than an Edit of the file.

Pack evals live in the repository's top-level `evals/<pack>/`, because a pack depends on the core and
the runner only loads plugins inside its containment root. Run them from the repository root:

```bash
PATH="$PWD/plugins/moku/bin:$PATH" claude plugin eval . --scaffold --trust-plugin --no-publish --allow-tools Write Edit Bash
```

`baselines/0.62.4.json` is the score of the last monolithic release on the original seven cases
(`web-island-attrs` has since moved to `evals/moku-web/`).
`baselines/0.70.0.json` covers the whole marketplace at 0.70.0. `baselines/0.74.0.json` covers the core plugin
at 0.74.0, 3 runs per case, haiku judge.

Run the evals with this repository's own `moku-rails` first on `PATH`, and without the installed plugin's
`bin` folders. A Claude Code session puts `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/bin` on
`PATH`: the eval sandbox can execute those files but not read the `lib/` next to them, and the no-plugin arm
sees the installed plugin. Without any `moku-rails` on `PATH` the conductor cases stall on "command not
found". `--scaffold` runs the fixture of a case that has one (`tweak-quick-edits`):

```bash
PATH="$PWD/plugins/moku/bin:$(echo "$PATH" | tr ':' '\n' | grep -v "/.claude/plugins/cache/" | paste -sd: -)" \
  claude plugin eval plugins/moku --scaffold --trust-plugin --no-publish --allow-tools Write Edit Bash -j 4
```

A failed run leaves no trace unless `--keep-temp` is passed.

Game cases in `evals/moku-game/`:

| Case | Guards |
|---|---|
| `game-editor-working-mode` | A visible change is checked in the editor through its MCP tools by name (`moku_status`, `moku_read`, `moku_screenshot`), not by tests alone. |
| `game-mcp-setup` | A game without `.mcp.json` gets it and `.claude/launch.json`, and the agent does not claim tools it does not have in this session. Needs `--scaffold`. |
| `game-design-reference` | Sizes come from the HTML prototype times 1080 / 390, never from Astra's picture. Needs `--scaffold`. |

The editor's MCP server is declared by the game's own `.mcp.json`, and the runner mocks only servers a
plugin declares. So these cases check what the agent decides, writes and says. A live call of
`moku_status` against a running game is not covered by an eval. The eval sandbox also refuses a write of
`.mcp.json`, so `game-mcp-setup` reads the server entry from the answer, and the launch config from the file.

Scores at 0.85.0, 3 runs per arm, 2026-10-11: `game-editor-working-mode` 1.00 against 0.00 without the
packs, `game-mcp-setup` 1.00 against 0.00, `game-design-reference` 1.00 against 1.00.
