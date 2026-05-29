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
`moku-plugin-spec-validator`, `moku-jsdoc-validator`, `moku-type-validator`,
`moku-test-validator`, `moku-web-validator`, `moku-architecture-validator` — then aggregates a
single deduped PASS/FAIL disposition. Mirrors `moku-validation-coordinator` but with true
concurrency. **`/moku:init` installs this into a project's `.claude/workflows/`.**
**Adversarial mode (opt-in):** pass `{adversarial:true}` (or args `"adversarial"`) to add a
skeptic pass — each surviving blocker is challenged by N `moku-skeptic` agents (default 2) that
try to *refute* it; a majority-refuted blocker is downgraded to a warning. Kills
plausible-but-wrong findings before they fail the build.

### `moku-build-wave.js` → `/moku-build-wave`  (framework projects, opt-in)
Builds ONE wave non-interactively: builders run in parallel over the wave's plugins (disjoint
`src/plugins/<name>/` dirs, so no worktree isolation needed), each plugin is verified by
`moku-verifier` *as it finishes* (pipeline, not barrier), and `moku-wave-judge` returns a
continue/stop/retry disposition. The gated `/moku:build` (per-wave user checkpoint) stays the
default; reach for this only when you explicitly want a wave built end-to-end without stopping.
Pass `{plugins:[{name,tier,spec}]}` or omit to auto-detect the next wave from STATE.md.

### `moku-migrate-sweep.js` → `/moku-migrate-sweep`  (any moku repo, opt-in)
Mechanical repo-wide change: discover sites → transform each file in parallel (one agent owns a
whole file = disjoint writes) → verify each → report failures. Pass `{pattern, change}`.

### `moku-audit.js` → `/moku-audit`  (plugin maintainers)
Audits one of the moku **command files** (`commands/<name>.md`): scenario-generation →
parallel simulation batches → deduped gap report + improved draft. Mirrors `/moku:audit`.
This targets the plugin's own command files, so it's only meaningful **inside the moku plugin
repo** — it is *not* installed into consumer projects. Run it from this repo:

```
Workflow({ scriptPath: "workflows/moku-audit.js", args: "plan" })
```

or copy it into this repo's local `.claude/workflows/` to get it as a `/moku-audit` slash command.

## Installing into a project

`/moku:init` copies the consumer-relevant workflow(s) into the project's `.claude/workflows/`,
where Claude Code registers them as `/<name>` slash commands. (`.claude/` is gitignored in the
plugin repo itself, which is why the canonical copies live here in `workflows/`.)
