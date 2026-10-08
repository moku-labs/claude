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

Builds one wave without stopping, or every remaining wave with `{all: true}`. Builders run in parallel
in the one working tree: a git worktree has no `node_modules`, and its `.planning/` is a lane of its own,
so it gives a builder neither tooling nor this wave. Builders write to disjoint plugin folders, and the
prompt bans repo-wide commands and git mutations: a stray `git checkout` from one builder reverted a
sibling in a real build. Complex and VeryComplex plugins go to `moku-builder-deep`; everything else to
`moku-builder`.

Which wave is next comes from the rails, not from an agent's reading of `STATE.md`:

```bash
moku-rails waves
# Wave 0: log, env (done)
# Wave 1: router, site (not started)
# Wave 2: auth (not started)
# Next: wave 1, 2 plugin(s) in parallel.
```

It reads the `## Plugins` table and the `| Wave | Plugins | Status |` table, and refuses a plan where a
plugin sits in two waves or depends on a plugin of the same or a later wave. `moku-rails waves --done <n>`
marks wave `n` and its plugins `verified`, which brings the next wave up.

Each plugin is checked as it finishes (pipeline, not barrier) by running
`moku-verify-artifacts <plugin> --tier <tier> --run --json` through a Bash-capable agent step: the
check is a deterministic script, not an agent. Each wave ends with a continue / stop-for-review /
fresh-retry disposition decided against the criteria in `build-wave-execution.md`.

| Argument | Builds |
| --- | --- |
| none | The next wave, then stops |
| `{plugins:[{name,tier,spec}]}` | Exactly these plugins as one wave |
| `{all: true}` | Every remaining wave. After a wave that passes with the disposition `continue`, it is marked `verified` and the next one starts. It stops at the first wave that fails, at a disposition other than `continue`, and at a framework wave, which the orchestrator does by hand. |

The gated `moku:build` skill, with its per-wave user checkpoint, stays the default. Reach for this when
you explicitly want a wave, or the rest of the plan, built end to end without stopping.

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
