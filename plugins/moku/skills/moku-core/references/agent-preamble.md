# Moku Agent Preamble

These rules apply to every Moku agent.

## Universal Rules

1. **Scope**: Only check files in the target scope. Don't report on files you weren't asked to validate.
2. **Evidence**: Every finding must cite a specific file path and line number (or range). No vague findings.
3. **Severity**: Use exactly these levels — BLOCKER (must fix), WARNING (should fix), INFO (suggestion). No other severity names.
4. **Actionable**: Every BLOCKER and WARNING must include a concrete fix. Don't just flag — explain the fix.
5. **Surface, don't suppress**: Report each violation with file and line; do not truncate the list. A confident violation is a BLOCKER; a real issue you cannot grade confidently is a WARNING. Silence needs positive evidence that it is not a violation: out of scope, spec-compliant, or a pattern explicitly approved in `house-style.md`/the spec that you can cite. A repeated pattern is not self-justifying — the same mistake in N plugins is N findings, not a convention. The verify pipeline fixes from your list, so an omitted finding ships.
6. **Efficiency**: Read the minimum files needed. Don't read the entire codebase if checking one plugin.
7. **Spec grounding**: The vendored Moku Core specification is the source of truth — decide from it, not from memory. Before reasoning about architecture, the core API, factory chain, config, lifecycle, events, the `ctx` object, types, invariants, or plugin structure, consult `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/spec-index.md` and open the one or two cited `spec/NN-*.md` files. Cite the spec section ID (`spec/NN-*.md §N`) in every finding that asserts a rule, and treat `spec/11-INVARIANTS.md` as the canonical origin of the R1–R8 code rules below (R9 derives from `spec/09-TYPE-SYSTEM.md`). If something deviates from the spec, that is itself a BLOCKER (cite the section). The distilled references (`architecture.md`, `core-api.md`, etc.) are summaries that may lag — prefer `spec/` when they disagree. For idiomatic **coding style** (file layout, export naming, JSDoc, test structure) when writing or reviewing plugin source, also consult `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/sandbox-index.md` and open the tier-matching exemplar — the sandbox is real moku code from the same pinned commit. For where JSDoc and `@example` go, `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/jsdoc-examples.md` is the short form of `spec/15-PLUGIN-STRUCTURE.md §6`.
8. **`.planning/` stays local**: it is local-only state, so never stage, commit, or instruct anyone to commit files under it.

## Moku Code Rules

These are the canonical definitions of Moku-wide code rules. Every agent enforces these; agent prompts reference them by number instead of duplicating them. They are derived from `spec/11-INVARIANTS.md` (and the patterns in `spec/12-PLUGIN-PATTERNS.md` / `spec/15-PLUGIN-STRUCTURE.md`, plus `spec/09-TYPE-SYSTEM.md` for the type-discipline rules R6/R7/R9) — open those when you need the authoritative rationale or edge cases.

- **R1 — No explicit generics on createPlugin/createCorePlugin**: A `createPlugin(` or `createCorePlugin(` call carries no type parameters (angle brackets). Types are inferred from the spec object. A `createPlugin<` is a BLOCKER.
- **R2 — import type for type-only imports**: Use `import type { X }` when the import is only used in type positions. Enforced by `@typescript-eslint/consistent-type-imports`.
- **R3 — Plugin index.ts is wiring only (~30 lines)**: The index.ts connects domain code to the system. Business logic lives in domain files (api.ts, state.ts, handlers.ts). An index.ts > 50 lines with inline logic is a BLOCKER.
- **R4 — Plugin instance export uses the `<name>Plugin` suffix**: Per `spec/15-PLUGIN-STRUCTURE.md §7`, the exported plugin instance is named `<domainName>Plugin` in camelCase (`export const routerPlugin = createPlugin('router', …)`, `authPlugin`, `templateEnginePlugin`). The plugin **name string** (first arg) is camelCase with **no** suffix (`createPlugin('router', …)`). Islands and other non-plugin exports may use a domain-appropriate suffix (e.g. `lightboxIsland`). This is a naming convention (WARNING), not a hard invariant. (Note: earlier plugin versions inverted this rule — the spec and the vendored sandbox both use the `Plugin` suffix.)
- **R5 — No wire factory patterns**: Import `createPlugin` and dependencies directly. No `function wireXPlugin(factory, dep)` indirection.
- **R6 — No inline type assertions in createState/config**: No `null as X`, `{} as X`, `[] as X`. For Standard+, define types in `types.ts` and use typed factories. For Nano/Micro, use return-type annotations.
- **R7 — No `as any` in plugin code**: Always find the proper typing. `as any` is a BLOCKER in plugin source files.
- **R8 — Plugin tests live with the plugin**: Tests in `src/plugins/[name]/__tests__/`. Never in root `tests/unit/plugins/` or `tests/integration/plugins/`.
- **R9 — No lazy `unknown` / `any` / `Record<string, unknown>` for a knowable shape**: Moku is type-first — when the shape of a value is *derivable*, define and use an explicit type; never widen to `unknown`, `any`, or `Record<string, unknown>` and then cast field-by-field. A shape is derivable when it comes from a known contract: a DB row (the SQL schema is the type), a parsed API/queue/config payload, a function parameter with a fixed caller, the framework's own exported types (e.g. `WorkerEnv`, `Router.LayoutContext`). Before writing `unknown`/`Record<string, unknown>`, **assume the structure and look for (or declare) the type** — derive it from the schema, the spec, or the callers. `unknown` is reserved for *genuine* dynamic boundaries (untrusted `JSON.parse`/`fetch` results, `catch (e)` clauses, plugin-agnostic kernel slots) and there it is narrowed or validated immediately, not cast straight through. A `: Record<string, unknown>` / `: unknown` / `<unknown>` / `<Record<string, unknown>>` annotation (or a chain of `as` casts hung off one) where a concrete type is derivable is a **BLOCKER**. Derives from `spec/09-TYPE-SYSTEM.md`'s "full inference, zero casts" philosophy; complements R6 (no inline assertions) and R7 (no `as any`). **Allowlisted:** `as unknown as <ExternalType>` for partial **test** mocks of complex external SDK types (`D1Database`, `DurableObjectStub`, a full plugin `Ctx`); a generic's `<T = unknown>` *default*; and `unknown` at a real boundary that is narrowed before use.

## Turn budget and the report

Every agent has a turn budget: the `maxTurns` in its frontmatter, repeated as `Turn budget: **N turns**`
in its first body line. The harness ends the agent at that limit with no warning, and an agent that
ends there without a report has wasted every turn before it: the orchestrator sees "produced no
report", resumes it once, and takes whatever partial answer comes back.

The rule, for every agent:

1. **Reserve the last 10 turns for the report** (the last 20 % when the budget is under 50 turns).
2. **When 80 % of the budget is used, stop new work.** Finish the check or file in hand, run no new
   check and open no new file. The exact turn is in your `Turn budget` line.
3. **Deliver the report through the hand-back**: your final message with the output contract below,
   or `StructuredOutput` when the spawn requires it. Report what was done and what was not, with an
   honest verdict: `PARTIAL` (or `FAIL` for a builder) with the open work in `blockers`. A partial
   report with an honest verdict is a result; a full check with no report is a failure.
4. **Never end a turn without a report.** Your last message is the report, whether the work finished
   or the budget did.
5. **Keep tool calls few.** Every tool call is one turn. Read and write whole files, not fragments.
   Run one check per group (one `tsc`, one lint pass over the directory, one test run per suite), not
   one per file. Do not re-read a file you just wrote.

Count turns from the start: one tool call or one message is one turn. When you are unsure how many
are left, assume fewer.

### For the orchestrator

The skills that spawn agents (build, verify, e2e, design) apply the same rule from the other side:

- Pass "keep tool calls few: read and write whole files, run one check per group" in every spawn
  prompt, and name the turn budget when the work is large.
- **A missing report is a failure**, not a delay. Resume the agent exactly once with `SendMessage`:
  "Deliver your report now: the output contract with an honest verdict on what is done. Do no more
  work." Take what comes back. If it still has no report, record the agent as `FAIL` (`no report`),
  use what it left on disk, and go on. Never wait open-ended, never send a second reminder.
- The hooks make the pattern visible and mechanical. `SubagentStop` tells an agent that stops without
  its contract to deliver it, once, and logs `no report (turn limit: N/N)` when the transcript shows the
  budget was used up. The prompt hook prints this resume instruction when a hand-back or task
  notification says an agent produced no report; the `Agent` PostToolUse hook does the same for a
  foreground result.

## Output Contract

End your response with a fenced `json` code block containing structured results: the prose report first (for the reader), the JSON block last (for the parser). If you were spawned via a workflow that requires `StructuredOutput`, call it as your final action; otherwise emit the fenced ```json block. A run that ends without the contract counts as a failed validator, not as PASS, and a run that ends at its turn limit without the contract is the failure the section above exists to prevent. The `fix` field is allowed (optional) on warnings too — include it when you have a concrete fix.

```json
{
  "agent": "<your-agent-name>",
  "verdict": "PASS | FAIL | PARTIAL",
  "blockers": [{"file": "path", "line": N, "rule": "...", "message": "...", "fix": "..."}],
  "warnings": [{"file": "path", "line": N, "rule": "...", "message": "...", "fix": "(optional)"}],
  "stats": {"filesChecked": N, "blockers": N, "warnings": N, "infos": N}
}
```

- `verdict`: PASS (zero blockers), FAIL (1+ blockers), PARTIAL (completed with caveats)
- `blockers` and `warnings` arrays may be empty
- `stats` summarizes the full run

### Example Output

```json
{
  "agent": "moku-structure-validator",
  "verdict": "FAIL",
  "blockers": [
    {
      "file": "src/plugins/router/index.ts",
      "line": 12,
      "rule": "R1 — No explicit generics",
      "message": "createPlugin<\"router\", RouterConfig, RouterState, RouterApi> uses explicit generics",
      "fix": "Remove type parameters: createPlugin(\"router\", { ... }) — types are inferred from the spec object"
    }
  ],
  "warnings": [
    {
      "file": "src/plugins/cache/index.ts",
      "line": 8,
      "rule": "R3 — Plugin index.ts wiring only",
      "message": "index.ts is 42 lines with inline Map logic on lines 15-35",
      "fix": "Extract Map logic to state.ts as createCacheState factory, import in index.ts"
    }
  ],
  "stats": {"filesChecked": 12, "blockers": 1, "warnings": 1, "infos": 0}
}
```
