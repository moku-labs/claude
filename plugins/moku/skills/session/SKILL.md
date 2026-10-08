---
name: session
description: Starts a moku session in a directory, which is the only thing that turns the moku rails and their hooks on. Use at the start of any work on a moku project, when a person says they want to build, change or fix something on Moku and the directory is not on the rails yet, or when the prompt hook says the directory is off the rails. It settles which directory the work happens in, creates it when it is new, runs `moku-rails session start`, and hands over to the conductor.
when_to_use: The first step of moku work in a directory that has no `.planning/state.json` and no `.planning/moku.md`. Also when a person types `/moku:session`. Not for repositories where the person does other work; there the rails stay off.
argument-hint: "[directory]"
allowed-tools: Read, Glob, Grep, Bash, Skill, AskUserQuestion
model: fable
effort: low
---

# session: put a directory on the rails

The moku hooks act in one kind of directory only: one where a session was started. Everywhere else they are silent, so a person's other projects are never touched, whatever their `package.json` names. This skill is the switch.

## 1. Look before asking

```bash
moku-rails status --json
pwd && ls -A | head -30
```

`data.onRails` true means the session already exists: say so in one line and go to step 4.

## 2. Settle the directory

Decide from what you see, and ask only when it is not obvious.

| The current directory | Do |
|---|---|
| Empty, or holds a moku project (`createApp`, `createCoreConfig`, `@moku-labs/core` or a moku framework in `dependencies`) | Work here. Do not ask. |
| A parent folder of several repositories, and the person described a new project | Propose a new folder by name (`./site`) and wait for a yes. |
| Some other project with its own code | Ask: work in this directory, or create a new one beside it? Name the path of each choice. |
| The person named a directory | Use it. |
| The person wants to make a new game | Always confirm, even in an empty directory: "Make the game here, in `<pwd>`?" Offer the current directory first when it is empty, otherwise a new folder named after the game beside it. |

One question, two or three choices, a recommended one first. Ask it in the person's language: a request in Russian gets a Russian question. If the person wants neither, stop here: the rails stay off and nothing was written.

## 3. Start the session

Always pass the absolute path, also for the current directory. The Bash hook reads it and ties this conversation to that project, so the hooks find it when the conversation's working directory is a parent folder.

```bash
moku-rails session start --root "/absolute/path/to/project"
```

The command creates the directory when it is new and writes an empty ledger, `.planning/state.json`. It scaffolds nothing; that is the init station's work. Repeating it is harmless.

From here on: every request is routed before code follows it, source files are refused before init and outside a writing station, and the conversation cannot end inside a station without a pause.

## 4. Hand over

Tell the person in one or two sentences where the work happens and that the project is on the rails. Then load the `moku:moku` skill with the Skill tool and let the conductor take the request they came with. Do not answer that request yourself.

## Several features at once

Work on two things at the same time in two git worktrees of the project, one session in each. The first
session start in a worktree links it to the project: its `.planning` points at
`.planning/lanes/<worktree>/` of the main checkout.

| Shared by every checkout | One per worktree |
| --- | --- |
| The ledger `state.json`, `moku.md`, `decisions.md`, `steering.md`, `memory.md`, `learnings.md`, `app-spec.md`, `specs/`, `design/` | The open change, the last request, `STATE.md`, `build/`, `changes/`, brainstorm and context files, `e2e/`, the running agents |

Nothing in one worktree stops another: not a station left open, not a wave marked active, not a new
message. `moku-rails status` names the other checkouts' work under "Elsewhere". When a worktree is
removed, its lane folder and its change stay: `moku-rails adopt <id>` moves the change to the checkout
where the work goes on. A fresh worktree needs `bun install` before its first build.

## Turning it off

A person who wants the rails off for one project sets the plugin option `rails` to `off`, or deletes `.planning/state.json` in a project that was never initialized. Say this only when asked.
