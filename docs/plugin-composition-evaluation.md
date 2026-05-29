# Plugin Composition Evaluation (PR5)

Should the monolithic `moku` plugin be split into composable units? This is the evaluation the PR5
proposal asked for. **Recommendation: defer the split; ship discovery polish now.**

## Current shape

One plugin, one marketplace entry: 10 commands, 25 agents, 4 skills (moku-core, moku-plugin,
moku-web, moku-testing), 12 hook events / 21 scripts, 4 workflows, vendored spec + sandbox. The
pieces are tightly coupled through `skills/moku-core/references/` (the spec index, agent preamble,
build/plan/brainstorm reference DAG) — almost everything reaches into moku-core.

## Candidate split

| Unit | Contents | Depends on |
|------|----------|-----------|
| `moku-core` (base) | spec + index, agent-preamble, plan/build/brainstorm refs, the 3 gated commands, core validators | — |
| `moku-web` (optional) | moku-web skill + web validator + blog sandbox | moku-core |
| `moku-testing` (optional) | moku-testing skill + test-validator + TDD refs | moku-core |
| `moku-audit` (optional, maintainer) | audit command + 5 audit agents + full-cycle agents + moku-audit workflow | moku-core |

Claude Code now supports this: `defaultEnabled: false` on optional units, and `disable`/`enable`
dependency enforcement (a dependent refuses to disable its base; enabling pulls transitive deps).

## Why defer the split

1. **High blast radius.** Splitting touches `plugin.json`, `marketplace.json`, every
   `${CLAUDE_PLUGIN_ROOT}` reference path, the `/moku:init` workflow-install step, and CI/release.
   A path that resolves across plugin boundaries is the main failure risk.
2. **Coupling is real.** moku-web/testing/audit all read `skills/moku-core/references/*`. The split
   only pays off if those references stay in core and the optional units reference them across the
   plugin boundary — which needs verification that `${CLAUDE_PLUGIN_ROOT}` resolves per-plugin.
3. **Backward-compat.** Existing installs point at one plugin; a split needs a meta-package that
   installs all units so current users are not broken.
4. **Marginal benefit today.** The heavy context cost is the agent fan-outs (cost-managed via
   `effort` tiers) and references (already index+fetch, ~0 until opened) — not "too many skills
   loaded." Splitting reduces install footprint but not the dominant per-run cost.

## Ship now instead (low risk, done in this release)

- `displayName` + `$schema` in `plugin.json` (better `/plugin` discovery + `validate --strict`).
- `SKILL-INVENTORY.md` (component map for discovery + cost awareness).
- `/moku:check usage` (measure footprint; steer to `/usage`).
- `effort` tiers on agents (cost control without splitting).

## If/when the split happens (v0.29.0+)

1. Verify `${CLAUDE_PLUGIN_ROOT}` resolution and cross-plugin reference reads with a throwaway 2-unit
   split first.
2. Keep `moku-core` as the base; make web/testing/audit `defaultEnabled: false` with `moku-core`
   declared as a dependency.
3. Publish a `moku` meta-package that enables all units (backward-compat).
4. Update `/moku:init`, `audit`, and CI to the multi-unit layout; re-run the full audit + a
   real `/moku-verify` against a scratch project before release.
