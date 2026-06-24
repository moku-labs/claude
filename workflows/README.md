# Moku Dynamic Workflows

Canonical, version-controlled [dynamic workflow](https://code.claude.com/docs/en/workflows)
scripts shipped with the moku plugin. They orchestrate the moku subagents at scale (parallel
fan-out + deterministic control flow) instead of turn-by-turn.

## Requirements & caveats (research preview)

- **Claude Code v2.1.154+.** Dynamic workflows are a research-preview feature; the runtime API
  may shift.
- **No mid-run user input.** A workflow cannot pause for an `AskUserQuestion`-style gate — only
  per-agent permission prompts can interrupt it. The interactive, *gated* commands
  (`/moku:plan`, `/moku:brainstorm`, `/moku:build`) stay turn-by-turn on purpose. Workflows are
  for the non-interactive fan-out phases only.
- **Agents inherit your tool allowlist** and always run in `acceptEdits` mode. Pre-add any shell
  commands the agents need to your allowlist so the run doesn't stall on prompts.
- **Opt-in.** These do not replace the existing commands; they're a faster path for the
  fan-out-heavy work.

## Scripts

### Verification → `/moku:verify`  (command, not a workflow)
The former `moku-verify.js` workflow has been **merged into the `/moku:verify` command** — the single
Moku verification entry point. `/moku:verify` runs the same aggressive full-validator fan-out
(`moku-root-validator`, `moku-spec-validator`, `moku-plugin-spec-validator`, `moku-jsdoc-validator`,
`moku-readable-code-validator`, `moku-common-validator`, `moku-type-validator`, `moku-test-validator`,
`moku-web-validator`, `moku-architecture-validator`), the uphold-biased **cited** skeptic pass, and the
auto-fix loop — with the **root/entrypoint idiom check (I1–I5) as its primary focus**. Aggressive by
default: any blocker, ANY warning, or any validator that did not return a verdict fails. See
[`../commands/verify.md`](../commands/verify.md); pass `--report-only`, `--iterations N`, or
`--no-adversarial`.

### `moku-build-wave.js` → `/moku-build-wave`  (framework projects, opt-in)
Builds ONE wave non-interactively: builders run in parallel over the wave's plugins. For waves with
**>1 plugin each builder runs in its own git `worktree`** (disjoint indices, so a stray repo-wide
command or `git checkout` from one builder can't clobber a sibling — this happened in a real build);
single-plugin waves run without isolation. The builder prompt also hard-forbids repo-wide commands and
git mutations. Each plugin is verified by `moku-verifier` *as it finishes* (pipeline, not barrier), and
`moku-wave-judge` returns a continue / stop-for-review / fresh-retry disposition. The gated `/moku:build` (per-wave user
checkpoint) stays the default; reach for this only when you explicitly want a wave built end-to-end
without stopping. Pass `{plugins:[{name,tier,spec}]}` or omit to auto-detect the next wave from STATE.md.

### `moku-migrate-sweep.js` → `/moku-migrate-sweep`  (any moku repo, opt-in)
Mechanical repo-wide change: discover sites → transform each file in parallel (one agent owns a
whole file = disjoint writes) → verify each → report failures. Pass `{pattern, change}`.

## Availability

These workflows ship with the plugin and are registered automatically as `moku:`-namespaced skills
wherever the plugin is enabled — no per-project install step. (Verification is no longer a workflow:
it lives in the `/moku:verify` command.)
