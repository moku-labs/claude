# Hook patterns — the hooks that exist, and the conventions they follow

The core plugin's hooks live in `hooks/` and are registered in `hooks/hooks.json`. A blocked action
should teach the session what to do next, so every refusal carries its remedy.

## The current roster

| Event | Matcher | Script | What it does |
|---|---|---|---|
| SessionStart | `*` | `detect-moku-project.sh` | Detects the project type, reads or writes the `.planning/moku.md` marker, and injects a short orientation as `additionalContext`. |
| SessionStart | `*` | `session-rails.mjs` | Prints `moku-rails status` once per session: initialized or not, open changes, debts. Silent outside a moku project. |
| PreToolUse | `Write\|Edit` | `pre-write.mjs` | The single write gate. Runs the rails guard first, then the content checks. |
| PreToolUse | `Bash` | `verify-before-commit.sh` | Blocks a `git add`/`commit` that names `.planning/`, and gates a build-wave commit behind `tsc` and lint. |
| PostToolUse | `Write\|Edit` | `format-on-save.sh` (async) | Formats the one file that was written, when biome and `node_modules` are present. |
| PostToolUse | `Bash` | `pre-commit-review.sh` | After a wave checkpoint commit, reports stubs, `TODO`s, stray `console.*`, `tsc` and lint counts as `additionalContext`. Never blocks. |
| PreCompact / PostCompact | `*` | `precompact-state.sh` / `postcompact-state.sh` | Re-inject the key `STATE.md` fields around a compaction boundary. |
| UserPromptSubmit | | `on-prompt.mjs` | Marks the person's typed message as not routed and hands over the standing. A prompt the harness wrote (hand-back, task notification, CI event, comment relay, teammate message, a subagent's own prompt) routes nothing and prints nothing, on or off the rails; one that says an agent produced no report gets the resume instruction. |
| PreToolUse | `Bash` | `pre-bash.mjs` | The shell write gate: a redirect or copy into `src/` is judged like a Write. |
| PostToolUse | `Agent` | `on-agent-result.mjs` | A foreground moku agent that returned without its output contract: the orchestrator gets the one-resume instruction as `additionalContext`. Reads the text blocks of the structured response. A background launch (`status: "async_launched"`) and a report sent through the hand-back (`handback: "send"`) print nothing. |
| SubagentStart | `.*` | `on-subagent-start.mjs` | Records a running moku agent under `.planning/agents/`: `status` names it, `pause` warns about it, the stop hook lets the turn end while it runs, and the write gate never holds it by the routing flag. |
| SubagentStop | `.*` | `on-subagent-stop.mjs` | Forgets the agent. An agent stopping without its contract is told once (`decision: block`) to deliver it; a second silence is logged as `no report (turn limit: N/N)` when the transcript shows the budget was used up. Otherwise appends the verdict and blocker counts to `.planning/build/agent-log.md`. |
| Stop | `*` | `on-stop.mjs` | Refuses to end the session while a change sits inside `build`, `verify` or `e2e` and is not paused, unless agents spawned from the station are still running (recorded under `.planning/agents/`, or listed in the payload's `background_tasks`): then the turn ends to wait for them. |

`pre-write.mjs` calls four content checks in order, each a script reading the same payload and
exiting 2 to refuse: `check-plugin-antipatterns.sh`, `validate-common-usage.sh`,
`validate-plugin-structure.sh`, `validate-plugin-index.sh`. The first refusal wins.

`moku-statusline.sh` is not a hook; it is the optional status line.

## 1. A deny carries the remedy (PreToolUse)

A PreToolUse hook refuses by writing the reason to stderr and exiting 2, or by emitting a
`permissionDecision` payload. Either way the reason states the action to take instead, with the
offending path or value interpolated so the message is specific.

```json
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny",
  "permissionDecisionReason":"<why> — <the concrete next action>"}}
```

`pre-write.mjs` relays the rails reason verbatim (`moku rails: <reason>`), because `moku-rails`
already phrases every refusal as a reason plus a named next step. `verify-before-commit.sh` names
the command to run (`bunx tsc --noEmit`, `bun run lint`) or the path to remove.

## 2. Two modes for the rails guard

`pre-write.mjs` reads `CLAUDE_PLUGIN_OPTION_RAILS`. `strict` exits 2, `warn` prints the reason to
stderr and lets the write through, `off` skips the guard entirely. The content checks run in all
three modes: they are about what is written, not when.

## 3. `continueOnBlock` (PostToolUse) — reject without aborting

A PostToolUse hook runs after the tool succeeded. `continueOnBlock: true` lets it feed its reason
back so the turn self-corrects instead of hard-stopping.

```json
{ "type": "command", "command": "bash", "args": ["…/check.sh"], "continueOnBlock": true }
```

moku's gates are PreToolUse denies, and its PostToolUse hooks (`format-on-save`,
`pre-commit-review`) are non-blocking, so none set this yet. Reach for it if a future post-check
needs to reject and continue.

## 4. Exec form vs shell form

Claude Code supports an exec form that avoids shell quoting of `${CLAUDE_PLUGIN_ROOT}`:

```json
{ "type": "command", "command": "bash", "args": ["${CLAUDE_PLUGIN_ROOT}/hooks/x.sh"] }
```

`hooks.json` uses the shell form today because it works across more Claude Code versions, and
because a runtime that ignored `args` would run a bare `bash`, exit non-zero, and block every write.
Prefer the exec form for a new hook; migrate the rest once the minimum supported version is firmly
past 2.1.139.

## 5. Degrade gracefully

A hook that cannot do its job exits 0. Missing `jq` and `python3`, unparseable input, or a directory
that is not a moku project all mean allow. A guard that errors must not become an accidental block.
Every hook here follows this; `check-plugin-antipatterns.sh` even says so in its skipped-check
message.
