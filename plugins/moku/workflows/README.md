# Moku Dynamic Workflows

Canonical, version-controlled [dynamic workflow](https://code.claude.com/docs/en/workflows) scripts
shipped with the moku plugin. They orchestrate the moku agents at scale — parallel fan-out plus
deterministic control flow — instead of turn by turn.

## What they can and cannot do

- **No mid-run user input.** A workflow cannot pause for an `AskUserQuestion` gate; only per-agent
  permission prompts interrupt it. The gated lifecycle skills (`moku:plan`, `moku:brainstorm`,
  `moku:build`) stay turn-by-turn on purpose. Workflows cover the non-interactive fan-out phases.
- **Agents inherit your tool allowlist** and run in `acceptEdits` mode. Pre-add the shell commands the
  agents need so a run does not stall on prompts.
- **Opt-in.** They do not replace the skills; they are a faster path for fan-out-heavy work.

## Scripts

### `moku-build-wave.js` → `/moku-build-wave` (framework projects)

Builds one wave without stopping. Builders run in parallel in the one working tree: a git worktree has
no `node_modules` and no `.planning/`, so it gives a builder neither tooling nor spec. Builders write to
disjoint plugin folders, and the prompt bans repo-wide commands and git mutations — a stray
`git checkout` from one builder reverted a sibling in a real build. Complex and
VeryComplex plugins go to `moku-builder-deep`; everything else to `moku-builder`.

Each plugin is checked as it finishes (pipeline, not barrier) by running
`moku-verify-artifacts <plugin> --tier <tier> --run --json` through a Bash-capable agent step — the
check is a deterministic script, not an agent. The run ends with a continue / stop-for-review /
fresh-retry disposition decided against the criteria in `build-wave-execution.md`.

The gated `moku:build` skill, with its per-wave user checkpoint, stays the default. Reach for this when
you explicitly want a wave built end to end without stopping. Pass `{plugins:[{name,tier,spec}]}`, or
omit it to auto-detect the next wave from STATE.md.

### `moku-migrate-sweep.js` → `/moku-migrate-sweep` (any moku repo)

A mechanical repo-wide change: discover the sites, transform each file in parallel (one agent owns a
whole file, so writes stay disjoint), verify each, report the failures. Pass `{pattern, change}`.

### Verification lives in the `moku:verify` skill

The former `moku-verify.js` workflow is now part of `moku:verify`, the single verification entry point.
It runs the validator fan-out (`moku-structure-validator`, `moku-style-validator`,
`moku-quality-validator`, `moku-web-validator`, `moku-architecture-validator`), the uphold-biased cited
skeptic pass, and the auto-fix loop, with the root and entrypoint idioms as its primary focus. See
[`../skills/verify/SKILL.md`](../skills/verify/SKILL.md).

## Availability

These ship with the plugin and register automatically as `moku:`-namespaced skills wherever the plugin
is enabled — no per-project install step.
