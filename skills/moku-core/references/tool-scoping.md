# Tool Scoping — per-stage tool posture

How moku constrains what each command/agent can do, and why it uses the mechanisms it does.
Claude Code offers three levers: command/agent **allow-lists** (`allowed-tools` / `tools`),
skill/command **`disallowed-tools`** (remove a tool while active, v2.1.152+), and **hooks**
(PreToolUse can deny a specific call). They are NOT interchangeable.

## The key constraint: moku's gates are PATH-based, not tool-based

The central write rule — *"brainstorm may write only `.planning/`"*, *"plan Stage 3 writes the
skeleton **spec** but no source files"* — is about **which path** a write targets, not whether the
`Write` tool exists. `disallowed-tools` can only remove `Write` entirely, which would break these
stages (they legitimately write `.planning/context-*.md`, specs, STATE.md). Therefore:

- **Path-based write restrictions stay in hooks.** `brainstorm-guard.sh` (PreToolUse Write|Edit)
  denies writes outside `.planning/` during brainstorm; `approve-planning-writes.sh` fast-approves
  known planning paths. This is the only lever that can express "this tool, but only these paths."
- **`disallowed-tools` is reserved for genuinely-unneeded tools**, not for path gating.

## Current posture (by component)

| Component | Mechanism | Tools |
|-----------|-----------|-------|
| Read-only validator agents (`spec-`, `plugin-spec-`, `type-`, `jsdoc-`, `test-`, `web-`, `architecture-validator`, `verifier`, `code-reviewer`, `wave-judge`, `skeptic`) | `tools:` allow-list | `Read, Grep, Glob` (+ `Bash` only where it runs tsc/lint/tests) — **no `Write`/`Edit`** |
| `status`, `check`, `next` commands | `allowed-tools` allow-list | no `Write`/`Edit` (read-only dashboards/routers) |
| `clean` command | `allowed-tools` | `Read, Bash, Glob, Grep, AskUserQuestion` — deletes via `Bash`, never edits source |
| brainstorm / plan / build commands | allow-list **+ hooks** | need `Write`/`Edit` for `.planning/` (all stages) and `src/` (build only); path scope enforced by hooks |

The read-only allow-lists already achieve what a `disallowed-tools: [Write, Edit]` would, without the
risk of removing a tool a later step needs — an allow-list that omits `Write` is strictly safer than
an active list plus a disallow.

## When to reach for `disallowed-tools`

Use it for a **read-only sub-stage of a command that otherwise needs writes** — e.g. an analysis-only
pass — where you want to guarantee no write happens even though the command's overall `allowed-tools`
includes `Write`. Declare it in that command's frontmatter (commands support `disallowed-tools` as of
v2.1.152). Do **not** use it to approximate a path gate; that belongs in a hook.

## Rule of thumb

> If the restriction is "never use tool X here," use an allow-list (omit X) or `disallowed-tools`.
> If the restriction is "use tool X but only on path P," use a PreToolUse hook. Never try to fake a
> path gate with `disallowed-tools`.
