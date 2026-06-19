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

### `moku-verify.js` → `/moku-verify`  (consumer + framework projects)
Runs the full validation pipeline as a parallel fan-out: `moku-spec-validator`,
`moku-plugin-spec-validator`, `moku-jsdoc-validator`, `moku-readable-code-validator`,
`moku-common-validator`, `moku-type-validator`, `moku-test-validator`, `moku-web-validator`,
`moku-architecture-validator` — then aggregates a single deduped PASS/FAIL disposition. Mirrors
`moku-validation-coordinator` but with true concurrency. **`/moku:init` installs this into a
project's `.claude/workflows/`.**
**Adversarial mode (ON by default):** each surviving blocker is challenged by N `moku-skeptic`
agents (default 2) that try to *refute* it — including checking whether ≥2 already-verified plugins
use the same pattern (a house convention, not a per-plugin violation); a majority-refuted blocker is
downgraded to a warning. Kills plausible-but-wrong findings before they fail the build. Opt out with
`{adversarial:false}` (or args `"no-adversarial"`).
**Verdict:** `PASS` requires *every* validator to have run and returned a parseable contract;
if any is missing the verdict is `INCONCLUSIVE` (never a vacuous `PASS`). Validator `agentType`s are
namespaced (`moku:moku-spec-validator`, …) so they actually launch.

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

## Installing into a project

`/moku:init` copies the consumer-relevant workflow(s) into the project's `.claude/workflows/`,
where Claude Code registers them as `/<name>` slash commands. (`.claude/` is gitignored in the
plugin repo itself, which is why the canonical copies live here in `workflows/`.)
