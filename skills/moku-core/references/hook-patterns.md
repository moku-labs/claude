# Hook Patterns — informative, self-correcting hooks

Conventions for moku's hook scripts so a blocked action teaches Claude what to do next instead of
just failing. Applies to the scripts in `hooks/`.

## 1. Structured, self-correcting rejection reasons (PreToolUse deny)

A PreToolUse hook that denies should emit a `permissionDecision: "deny"` with a
`permissionDecisionReason` that states **what to do instead**, not just what went wrong. The reason
is fed back to Claude, so a good one turns a hard stop into a redirect.

```json
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny",
  "permissionDecisionReason":"<why> — <the concrete alternative action to take now>"}}
```

Examples in this repo:
- `brainstorm-guard.sh` — denies writes outside `.planning/` and tells Claude to write to `.planning/`
  instead (or finish brainstorm and run `/moku:plan`), echoing the attempted path.
- `verify-before-commit.sh` — blocks staging/committing `.planning/` and a failing commit gate, each
  with the exact remedy (`bunx tsc --noEmit` / `bun run lint`; remove the `.planning` path).

Rule: every `deny` includes the remedy. Interpolate the offending path/value so the message is specific.

## 2. `continueOnBlock` (PostToolUse) — feed the reason back without aborting

For **PostToolUse** hooks (which run *after* a tool succeeds), `continueOnBlock: true` lets the hook
reject the result and feed its reason back to Claude so the turn continues and self-corrects, rather
than hard-stopping. Use it when a post-check (e.g. "the file you wrote violates X") should prompt a
fix in the same turn.

```json
// hooks.json entry
{ "type": "command", "command": "bash", "args": ["…/check.sh"], "continueOnBlock": true }
```

Note: `continueOnBlock` is a **PostToolUse** field. moku's *gates* are PreToolUse denies (above);
moku's PostToolUse hooks today are non-blocking (`format-on-save`, `pre-commit-review`), so none set
`continueOnBlock` yet. Adopt it if a future PostToolUse check needs to reject-and-continue.

## 3. `PostToolUseFailure` additionalContext — route failures to a fix path

A `PostToolUseFailure` hook can attach a hint via `hookSpecificOutput.additionalContext`. moku's
`log-tool-failure.sh` matches `tsc`/`lint`/`vitest` failure signatures and injects a hint to run the
relevant check and spawn `moku-error-diagnostician` (and "don't delete tests to pass"). Hint only —
it does not block.

## 4. Exec form vs shell form for the command path

Claude Code supports an **exec form** that avoids shell quoting of `${CLAUDE_PLUGIN_ROOT}`:

```json
{ "type": "command", "command": "bash", "args": ["${CLAUDE_PLUGIN_ROOT}/hooks/x.sh"] }
```

It is the documented best practice for path placeholders that could contain spaces. moku's
`hooks.json` currently uses the **shell form** (`"command": "${CLAUDE_PLUGIN_ROOT}/hooks/x.sh"`)
deliberately: it works across more Claude Code versions, and the severe failure mode if a runtime
ignored `args` (a PreToolUse hook running bare `bash` could exit non-zero and block all
writes/commands) outweighs the marginal robustness gain for the typical space-free cache path.
**Prefer exec form for any NEW hook**, and migrate the existing entries to exec form once the
plugin's minimum Claude Code version is firmly ≥ 2.1.139 across the user base.

## 5. Degrade gracefully

Every hook must `exit 0` (allow) when it cannot do its job — missing `jq`/`python3`, unparriseable
input, not a moku project. A guard that errors must never become a hard block by accident. All moku
hooks follow this (e.g. `brainstorm-guard.sh` exits 0 if no JSON parser is available).
