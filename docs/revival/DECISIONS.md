# Revival 0.70: decisions and rewrite directive

The binding record of what changed between 0.62.4 and 0.70.0 and why. Every agent that edits
this repository during the revival reads this file first. Where an old file disagrees with this
document, this document wins.

## 1. Layout

One repository, one marketplace, a core plugin and one pack per framework.

| Plugin | Holds |
|---|---|
| `plugins/moku` | conductor, lifecycle skills (init, brainstorm, plan, build, verify, status, check, clean, upgrade, moku-release), knowledge skills (moku-core, moku-plugin, moku-testing, moku-readable-code, moku-common, moku-readme), core agents, hooks, `bin/moku-rails` |
| `plugins/moku-web` | `moku-web` skill, `e2e` skill, web validator and the three browser agents |
| `plugins/moku-design` | `design` skill, `moku-astra` skill, `design-generator`, `bin/moku-astra` |
| `plugins/moku-worker`, `plugins/moku-room` | one framework skill each |
| `plugins/moku-maintainer` | `spec-sync`, `moku-sync`; operates on this repository's working tree |
| `evals/<pack>/` (repository root) | eval cases of the packs; a pack needs the core loaded beside it |

**Boundary rule.** A pack depends on the core. The core never names a pack file. `${CLAUDE_PLUGIN_ROOT}`
resolves per plugin, so a pack cannot reach core files by path. A pack that needs core knowledge says:
"load the `moku:moku-core` skill with the Skill tool and read the reference it points to". The Skill
tool prints the skill's base directory, which makes its `references/` readable. Inside the core,
`${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/<file>` keeps working unchanged.

The former commands are skills now: `skills/<name>/SKILL.md`, invoked as `/moku:<name>` (or
`/moku-design:design`, `/moku-web:e2e`). `/moku:next` is gone; the conductor replaces it.

## 2. The railway

`plugins/moku/skills/moku/SKILL.md` (the conductor) is the single conversational entry. Under it,
`moku-rails` enforces the lifecycle. Read both before touching a lifecycle skill.

Every lifecycle skill, as its first action:

```bash
moku-rails enter <station>      # exit 2 = refused: stop, relay the reason and the named next step
```

and as its last action `moku-rails done <station>`. Opening a change is its intake: `open` marks that
station done, so a directly invoked skill can open a change and enter its own station at once. Before stopping to ask the user anything
mid-station: `moku-rails pause --reason "<why>"`. Stations: `intake, brainstorm, design, plan, build,
verify, e2e, release, close`. `init` is project level: it runs `moku-rails init begin` (the only window in which source files may be
written before the project is initialized), leaves `.planning/moku.md`, the marker the rails read, and
closes the window with `moku-rails init done`. A skill invoked directly by a user with no open change opens one first
(`moku-rails open <date-slug> --size S|M|L --type <type> --title "..."`), so direct use and
conductor use travel the same rails.

Two gates enforce the write rule: `pre-write.mjs` for Write and Edit, and `pre-bash.mjs`, which refuses
shell commands that write into `src/` (redirects, heredocs, `tee`, `cp`, `mv`, `touch`, `sed -i`) when a
Write to the same path would be refused. A corrupt ledger is set aside and replaced, never allowed to
crash a hook, because a crashed hook lets every write through. `clean` never removes `moku.md` or `state.json`.

`.planning/state.json` is the machine ledger and belongs to `moku-rails`. `.planning/STATE.md` stays
the human-readable phase and wave record the skills already maintain. Do not merge them.

After creation work never "ends": every later request is a change of size S, M or L (see the
conductor). `plan` supports a delta spec for M changes. `build` supports an S route: reproduce with a
failing test when practical, fix, scoped verify.

## 3. Agent roster

| 0.62.4 | 0.70.0 |
|---|---|
| spec-validator + plugin-spec-validator + root-validator + moku-common-validator | `moku-structure-validator` |
| readable-code-validator + jsdoc-validator | `moku-style-validator` |
| type-validator + test-validator | `moku-quality-validator` (runs `tsc`, tests and lint through Bash as facts, then judges test quality) |
| brainstorm-researcher + researcher | `moku-researcher` |
| brainstorm-synthesizer, design-synthesizer, wave-judge | the orchestrating session does this itself |
| design-critic | Fable and Astra review the round (see `moku-astra`) |
| verifier | `bin/moku-verify-artifacts` (deterministic script) |
| validation-coordinator | removed; `/moku:verify` fans out directly |
| unchanged names | `moku-builder`, `moku-code-reviewer`, `moku-skeptic`, `moku-error-diagnostician`, `moku-plan-checker`, `brainstorm-challenger`, `moku-architecture-validator`, `moku-web-validator`, `design-generator`, `moku-web-e2e-tester`, `moku-web-qa-explorer`, `moku-web-ux-reviewer` |
| new | `moku-builder-deep`, `moku-error-diagnostician-deep` (thin: same instructions, `effort: xhigh`) |

**Flat tree.** Only the orchestrating session spawns agents. No agent lists `Agent` in `tools`.
Wherever a skill said "spawn the coordinator" or "the e2e tester spawns the explorer and the
reviewer", the skill now spawns those agents itself.

**Merged validators keep every rule.** Merging removes duplication (shared preamble, repeated
output contract, repeated scope rules), not checks. Each rule id (R1–R9, I1–I6, MC1–MC3, tier
limits, JSDoc requirements) must still be findable in exactly one agent.

## 4. Models and effort

Fable thinks, Opus works, Sonnet and Haiku assist under supervision. Every agent and every
lifecycle skill sets both fields explicitly; nothing inherits the session by accident.

| Role | model | effort |
|---|---|---|
| Skills: brainstorm, plan, design | `fable` | `high` |
| Skills: moku (conductor), init, build, verify, e2e, moku-release | `fable` | `medium` |
| Skills: status, check, clean, upgrade | `fable` | `low` |
| moku-plan-checker, brainstorm-challenger, moku-architecture-validator | `fable` | `high` |
| moku-builder, moku-error-diagnostician, moku-code-reviewer, moku-web-e2e-tester, moku-web-qa-explorer, design-generator | `opus` | `high` |
| moku-builder-deep, moku-error-diagnostician-deep | `opus` | `xhigh` |
| moku-skeptic | `opus` | `medium` |
| moku-structure-validator, moku-style-validator, moku-quality-validator, moku-web-validator, moku-researcher, moku-web-ux-reviewer | `sonnet` | `medium` |

Haiku does not support `effort`; no agent uses Haiku after the verifier became a script.

**Supervision rule.** A Sonnet agent never closes a gate. Its findings go through `moku-skeptic`
(Opus) and the final verdict is the orchestrating session's (Fable). **Escalation:** a failed attempt
is retried once on the `-deep` variant; a second failure returns to the orchestrator with the full
error context. The orchestrator picks `moku-builder-deep` up front for plugins of tier Complex or
VeryComplex.

## 5. Tools and platform facts (Claude Code 2.1.277)

- `TodoWrite`, `TaskCreate`, `TaskUpdate`, `TaskList`, `TaskGet`, `TaskOutput` do not exist on
  current models. Remove every mention, including from `allowed-tools`. Wave progress lives in
  `STATE.md`.
- Browser preview tools are `mcp__Claude_Browser__preview_start|preview_list|preview_stop|preview_logs`
  plus `mcp__Claude_Browser__computer|read_page|navigate|...`. The old `mcp__Claude_Preview__*` names are dead.
- Context windows are 1M. Remove throttles, "open a fresh session after N waves" advice and
  remaining-context warnings.
- `ultrathink` inside a skill body is inert prose. Use the `effort` field.
- Subagents may call the Skill tool. Agents that need a knowledge skill keep it in `skills:` when it
  is in the same plugin; across plugins they invoke it with the Skill tool, so `Skill` must be in `tools`.
- Skill frontmatter in use: `name`, `description`, `when_to_use`, `argument-hint`, `allowed-tools`,
  `model`, `effort`. Drop `disable-model-invocation: true` from lifecycle skills: the conductor has to
  be able to invoke them. Keep descriptions precise so they do not fire on unrelated talk.
- Frontmatter must be valid YAML. No `<example>` blocks and no unquoted colons inside `description`.

## 6. Writing style for skills and agents

Current models follow plain instructions and overreact to shouting.

- State what to do and why, once. "The orchestrator commits after verification, so do not commit"
  instead of "NEVER commit".
- No ALL-CAPS emphasis words (MUST, NEVER, CRITICAL, IMPORTANT, MANDATORY, NON-NEGOTIABLE) and no
  bold used as shouting. Rule ids and code stay as they are.
- No persona lines ("You are a world-class…"). One sentence of role is enough.
- Remove instructions to double-check, re-verify or add verification steps; the pipeline has
  dedicated verifiers. Remove "report EVERY instance" style pressure: say "report each violation
  with file and line".
- Agent `description`: one or two sentences, third person, what it does and when the orchestrator
  uses it. No examples. It is loaded into every session, so every word costs.
- A `SKILL.md` stays under 500 lines, references one level deep. Move long procedures to
  `references/` and delete duplication between a skill and its references; the reference wins.
- Keep the JSON output contracts of agents. Make them terse: prose report first, contract last.
- English only. Short sentences.

## 7. Astra (moku-design)

`moku-astra <review|generate|edit|probe>`; exit 3 means unavailable for any reason. Astra is a second,
independent opinion on user experience and the artist for image assets. She is not a taste oracle and
never reviews code.

- **Design station:** after a concept round, Fable and Astra review the same screenshots
  independently; findings merge into one list.
- **E2E station:** after functional green, same procedure on desktop and mobile screenshots.
- **Triage by Fable, every finding:** reproducible in the browser? consistent with
  `design-context.md`? consistent with moku-web rules? worth its cost? Rejections are written down
  with the reason. At most two review passes.
- **Unavailable:** Fable reviews alone with the same findings schema; the report names the reviewer.
  The gate is never skipped. Images have no fallback: placeholders in SVG or CSS plus a to-draw list.
- **Art backend:** `codex` by default (covered by the ChatGPT plan), `api` only when the user turned it
  on; the plugin never switches to the paid backend by itself.

## 8. Release (core)

Three commands from `@moku-labs/ci` (the CLI lives beside the workflows, not in the runtime library): `bun run release:setup`, `release:doctor`,
`release <patch|minor|major|prerelease>`. Projects carry two thin workflows that call
`moku-labs/ci/.github/workflows/*@v1`. Human-only steps: `npm login`, `gh auth login`. No `NPM_TOKEN`.
`init` scaffolds the thin workflows and scripts from the first commit.

## 9. What is deliberately unchanged

The vendored spec and its index, the sandbox exemplars, spec-sync and moku-sync procedures, the
builder's isolation and TDD protocol, the rule ids, idioms I1–I6, the skeptic's cited-refute rule,
"design is a spec, not source", `.planning/` is never committed.
