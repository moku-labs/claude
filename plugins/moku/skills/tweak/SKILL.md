---
name: tweak
description: The quick-edit station of a size Q change. The person sends one small edit after another (move this, recolor that, make it like the reference, rename, nudge a number) and each is made at once, by a fast agent for a small edit and by the builder for a larger one, with no plan, no validators and no checks in between. Verification runs once, at the end, when the person says the edits are right. Use when a person says "quick edits", "a few tweaks", "just move", "nudge", "make it like this", or sends a list of small visual or wording fixes.
argument-hint: (empty) the edits come from the conversation
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion, Skill
model: sonnet
effort: low
---

# Tweak

The person looks at the result and says what to change. Make each edit fast and hand the turn back.
Checking is not this station's job: it happens once, at `verify`, after the last edit.

## Rails

```bash
moku-rails open <date-slug> --size Q --type tweak --title "<what the edits are about>"
moku-rails enter tweak
```

A size Q change travels `intake → tweak → verify → close`. Inside `tweak` every message of the person is
the next edit: it needs no routing, and the turn may end after each one. The write guard still holds
everything else: no source before init, no edit outside an open change.

## One edit

1. **Find the files.** Read only what the edit needs. Name the files it will touch.
2. **Ask the rails who makes it.** The answer is counted from the files, never guessed:

   ```bash
   moku-rails tier src/plugins/hud/view.ts            # fast
   moku-rails tier src/plugins/hud/index.ts           # deep: src/plugins/hud/index.ts: it is a plugin's public surface
   ```

   | Answer | Who makes the edit |
   | --- | --- |
   | `fast` | `moku:moku-tweaker`. One agent, one edit. Several independent edits go out in one message, one agent each. |
   | `deep: …` | `moku:moku-builder`, with the edit and the named reasons as its brief |

   An edit is `deep` when it touches more than two files, creates a file, or touches a plugin's public
   surface, the root wiring, shared core code or configuration. Pass `--misses 2` when the fast agent
   already got this edit wrong twice: the third try is the builder's.

   A game has no `src/`. The rails read `type: game` from `.planning/moku.md` and count the same kinds
   of file at the game's own paths: `moku-rails tier game.ts` answers
   `deep: game.ts: it is the game's root wiring`. Pass paths relative to the project root.
3. **Give the agent a brief it cannot misread:** the files, the edit in the person's words, and the
   reference when there is one (a file to copy the pattern from, a screenshot, a value).
4. **Write it down.** Append one row to `.planning/changes/<id>/tweaks.md`:

   | # | Asked | Files | By | Result |
   | --- | --- | --- | --- | --- |
   | 3 | "move the score under the title" | `src/plugins/hud/view.ts` | fast | done |

5. **Say one line and stop.** What changed and where. Add a screenshot when the project has a way to
   take one. No report, no summary of the session, no list of what could be next.

## What does not run here

No plan, no spec, no validator, no skeptic, no test run, no lint over the project. The only command
after an edit is the formatter on the files that changed, when the project has one.

A typecheck error the editor shows in a touched file is fixed in the same edit. Everything else waits.

## When an edit is not a tweak

| The edit | Do |
| --- | --- |
| Adds a plugin, changes a public API, changes saved data | Stop. Say it needs a plan, and offer `moku-rails scope "<what is new>"` or a separate change of size M. |
| Contradicts an earlier edit of this session | Make it. The last word wins. Mark the earlier row `replaced`. |
| Is unclear | Ask one short question. Do not guess between two readings. |

## The end

The person says the edits are right ("done", "that's it", "ship it"):

```bash
moku-rails done tweak
```

Then run the `moku:verify` skill over everything the change touched, once. What it finds is fixed there.
A game or a web app with a playtest or e2e station is played once, after verify, on the person's word.

## Rules

- One edit, one line back. The person is waiting to look.
- Never batch edits to "save a run": each lands as soon as it is made.
- Never start verify on your own. The person ends the loop.
- No commit and no push at this station.
