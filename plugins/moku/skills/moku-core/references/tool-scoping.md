# Tool scoping — which component may do what

Claude Code offers three levers: allow-lists (`allowed-tools` on a skill, `tools` on an agent),
`disallowed-tools` (removes a tool while a skill is active), and hooks (a PreToolUse deny on one
call). They are not interchangeable.

## The tree is flat

Only the orchestrating session spawns agents. No agent lists `Agent` in `tools` (`DECISIONS §3`).
Where a skill used to say "spawn the coordinator" or "the e2e tester spawns the explorer", the skill
spawns those agents itself.

A subagent may still call the `Skill` tool. An agent that needs a knowledge skill from its own
plugin keeps it in `skills:`; across plugins it invokes the skill with the `Skill` tool, so `Skill`
belongs in its `tools`.

## Tools that no longer exist

`TodoWrite`, `TaskCreate`, `TaskUpdate`, `TaskList`, `TaskGet` and `TaskOutput` are not available on
current models. They must not appear in `allowed-tools`, in `tools`, or in a skill body. Wave
progress lives in `.planning/STATE.md`; lifecycle progress lives in the rails ledger.

## The write gate is path-based, not tool-based

The central rule — brainstorm writes only `.planning/`, source files arrive only at a writing
station — is about which path a write targets, not whether `Write` exists. `disallowed-tools` can
only remove `Write` entirely, which would break stations that legitimately write `.planning/`.

- Path-based write restrictions stay in the hook. `hooks/pre-write.mjs` asks `moku-rails` whether
  this path may be written at this station. That is the only lever that can express "this tool, but
  only these paths".
- `disallowed-tools` is for a tool that is genuinely not needed, never for path gating.

## Current posture

| Component | Mechanism | Tools |
|---|---|---|
| Read-only validators (`moku-structure-validator`, `moku-style-validator`, `moku-architecture-validator`, `moku-web-validator`, `moku-skeptic`, `moku-code-reviewer`) | `tools:` allow-list | `Read, Grep, Glob`, plus `Bash` only where it runs tsc, lint or tests. No `Write` or `Edit`. |
| `moku-quality-validator` | `tools:` allow-list | `Read, Grep, Glob, Bash` — it runs the commands whose output it judges. |
| `status`, `check` | `allowed-tools` | Read-only dashboards: no `Write`, no `Edit`. |
| `clean` | `allowed-tools` | `Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion` — it writes `history.md` and archives change folders, never source. |
| `init`, `build`, `verify`, `upgrade` | allow-list plus hooks | They need `Write`/`Edit`; the rails hook decides which paths are legal right now. |

An allow-list that omits `Write` is strictly safer than an active list plus a disallow, so prefer
omission.

## When to reach for `disallowed-tools`

For a read-only sub-stage of a skill that otherwise needs writes — an analysis-only pass where no
write should happen even though the skill's `allowed-tools` includes `Write`. Declare it in that
skill's frontmatter. Do not use it to approximate a path gate.

## Rule of thumb

> "Never use tool X here" — use an allow-list that omits X, or `disallowed-tools`.
> "Use tool X but only on path P" — use a PreToolUse hook.
