# Test runs: when to run what

The one place this rule is written. Every station, agent and pack that runs tests follows it and points
here; none of them repeats it.

Why it exists: across 5,177 test runs in 43 moku sessions, 28% repeated a run on files nobody had
edited, nearly always to read another part of the same output, and 22% of the commits came right after
a full run that the commit hook then ran a second time.

## The rule

1. **One run per tree.** The tree is the files as they are now. The same command on the same files
   gives the same result, so it runs once. An edit makes a new tree, and then the run is needed.
2. **Run once, read many times.** Keep the output of a run in a file and read the file. Never start the
   tests again to see another part of what they printed.

   ```bash
   bunx vitest run src/plugins/streak/ > "$TMPDIR/moku-test.log" 2>&1; echo "exit $?"
   tail -30 "$TMPDIR/moku-test.log"        # then grep, head or sed on the same file
   ```

   `moku-rails check tests` keeps its whole output in `.planning/tests/last.log`.
3. **Scope to what changed.** While a plugin is built, run that plugin's tests. The whole script runs
   once per wave and once at the close.
4. **A red run is fixed, then run.** A red result is never reused, and it is not run again to be read:
   read the file from rule 2.
5. **The commit hook counts.** When the project's pre-commit hook runs the whole test script, a commit
   that goes through is the full run on the new HEAD. Do not run the script right before that commit or
   right after it.
6. **The close run is mandatory.** `moku-rails close` refuses without a green `tests` on the current
   tree. Nothing in this file removes that run.

## Who runs what

| Moment | Run | Do not run |
|---|---|---|
| A builder works on one plugin | That plugin's tests: `bunx vitest run src/plugins/<name>/` | The whole script |
| A wave is reconciled (`build-verification.md` Step 4a0) | The whole script, once: `bun run test` | A second whole run before anything was edited |
| The regression check after the wave is wired (Step 4b2) | The earlier plugins' tests, in one command | That command when the whole script was green on this exact tree: it ran them |
| A gap-closure fix | The tests of what the fix touched | The whole script after every fix |
| The coverage step | `bun run test:coverage`. It runs every test | `bun run test` beside it on the same tree |
| A verify fix cycle | `bun run test` once, after the last fix of the cycle | One run per fix |
| A commit whose hook runs the whole script | Nothing. The hook runs it | The script before or after the commit |
| The close of a change | `moku-rails check tests`, always | Another run when it answers `green on <sha>, not run again` |

## What the commit hook proves

`moku-rails tests` prints what the hook runs. Three answers are possible.

| The hook | A commit that went through proves | `moku-rails check tests` afterwards |
|---|---|---|
| Runs the whole script on every commit. The scaffold's app hook runs `bun run test`; its package hook runs `test:unit` and `test:integration`, which are every project of `vitest.config.ts` | The whole script green on the new HEAD | Answers `green on <sha>, not run again` |
| Runs a part of the script, or only for staged files | Those commands only | Runs the script |
| Was skipped (`--no-verify`, `LEFTHOOK=0`), is not installed, steps aside without `node_modules`, or left no passed test job in the commit's output | Nothing | Runs the script |

So when changes close together: commit first, then `moku-rails check tests` for each. With a hook that
runs the whole script that is zero extra runs; without one it is one run for all of them.

Only two things confirm `tests` for the close: the rails' own run, and a commit through a hook that runs
the whole script. A test run from a shell never does, however green it was.

## What is recorded

Every run goes to `.planning/tests/runs.jsonl`, one line each: when, the command, whether it was the
whole script, the tree, the duration, the outcome, and who ran it (an agent, the rails, the commit
hook). A git worktree keeps its own log. The Bash hook tells an agent when it starts a command that
already ran on the same tree. That is advice: the run is never refused, and it is counted.

```bash
moku-rails tests          # runs, repeated runs and the seconds they cost, the hook, the slow tests
moku-rails tests --json   # the same as numbers
```

## Slow tests

`moku-rails tests` lists the tests at or over the threshold, from the timings the runner prints
(Vitest, `bun test`, `node --test`; another runner gives no timings). The threshold is 1000 ms; a
project sets its own with `slowTestMs: <ms>` in the frontmatter of `.claude/moku.local.md`.

When a change closes with slow tests, `moku-rails close` prints a `Slow tests:` line. The conductor
then offers the person to speed them up as a change of its own, or keeps it with `moku-rails idea`.
No test is changed, skipped or deleted to make a run faster without the person's yes.
