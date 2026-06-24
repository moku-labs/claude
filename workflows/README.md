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
**Aggressive by default (0.62.0+):** any **blocker, ANY warning, or any validator that did not return
a verdict** fails the run — warnings are not a free pass, and an un-run/crashed validator is a FAIL
(the project wasn't fully verified), never a shrugged `INCONCLUSIVE`. Each validator is retried up to
3× for a parseable contract before being counted un-run. Validator `agentType`s are namespaced
(`moku:moku-spec-validator`, …) so they actually launch.
**Adversarial mode (ON by default, uphold-biased):** each finding is challenged by N `moku-skeptic`
agents (default 2) that now **uphold** it unless they can **cite** the spec/house-style section that
disproves it; a finding is dropped only on **unanimous, cited** refutation (mere repetition across
plugins is no longer a "convention"). Opt out with `{adversarial:false}` (or args `"no-adversarial"`).
**Auto-fix loop:** unless `{reportOnly:true}` (args `"report-only"`), surviving issues are fixed and
re-verified in a loop (default 3 cycles, `{iterations:N}` to cap) — `tsc`/`lint`/`test` gate each
cycle, regressions are reverted, and it stops when clean or the budget is hit.

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
