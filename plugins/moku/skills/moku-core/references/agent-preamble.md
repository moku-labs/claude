# Moku Agent Preamble

These rules apply to ALL Moku agents. Follow them strictly.

## Universal Rules

1. **Scope**: Only check files in the target scope. Don't report on files you weren't asked to validate.
2. **Evidence**: Every finding must cite a specific file path and line number (or range). No vague findings.
3. **Severity**: Use exactly these levels — BLOCKER (must fix), WARNING (should fix), INFO (suggestion). No other severity names.
4. **Actionable**: Every BLOCKER and WARNING must include a concrete fix. Don't just flag — explain the fix.
5. **Surface, don't suppress (aggressive default)**: Report EVERY instance of a violation — never collapse repeats into one finding, never trim to a "top N", never prefer "a few high-confidence" over the full list. If you are confident it is a violation, it is a **BLOCKER**. If you are uncertain whether a *real* issue rises to BLOCKER vs WARNING, still **report it** (as WARNING) — never drop it. The only thing that justifies silence is positive evidence it is NOT a violation: in scope, spec-compliant, or a pattern **explicitly** approved in `house-style.md`/the spec that you can cite. **A repeated pattern is not self-justifying** — the same mistake in N plugins is N findings, not a "convention". (The downstream verify pipeline fails on warnings too and auto-fixes from your list, so an omitted finding is a real issue that ships; over-reporting at WARNING is cheap, under-reporting is not.)
6. **Efficiency**: Read the minimum files needed. Don't read the entire codebase if checking one plugin.
7. **Project memory**: If you have persistent memory (`memory: user`), consult it for project-specific patterns before validating. When writing to memory, use the structured format: `- [YYYY-MM-DD] description | confidence:{high|medium|low}` under one of these sections: `## Error Patterns`, `## Architecture Decisions`, or `## Validation Baselines`. This enables recency-based injection during context compaction. **Aging policy**: When writing new entries, delete entries older than 14 days with `confidence:low` and entries older than 30 days with `confidence:medium`. Keep `confidence:high` entries indefinitely.
8. **Spec grounding (authoritative)**: The vendored Moku Core specification is the single source of truth — never decide or validate from memory. Before reasoning about architecture, the core API, factory chain, config, lifecycle, events, the `ctx` object, types, invariants, or plugin structure, **consult `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/spec-index.md` and open the one or two cited `spec/NN-*.md` files**. Cite the spec section ID (`spec/NN-*.md §N`) in every finding that asserts a rule, and treat `spec/11-INVARIANTS.md` as the canonical origin of the R1–R8 code rules below (R9 derives from `spec/09-TYPE-SYSTEM.md`). If something deviates from the spec, that is itself a BLOCKER (cite the section). The distilled references (`architecture.md`, `core-api.md`, etc.) are summaries that may lag — prefer `spec/` when they disagree. For idiomatic **coding style** (file layout, export naming, JSDoc, test structure) when writing or reviewing plugin source, also consult `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/sandbox-index.md` and open the tier-matching exemplar — the sandbox is real moku code from the same pinned commit.
9. **Never commit `.planning/`**: It is local-only state. Never stage, commit, or instruct anyone to commit files under `.planning/`.

## Moku Code Rules

These are the canonical definitions of Moku-wide code rules. All agents enforce these — individual agent prompts reference them by number instead of duplicating. They are derived from `spec/11-INVARIANTS.md` (and the patterns in `spec/12-PLUGIN-PATTERNS.md` / `spec/15-PLUGIN-STRUCTURE.md`, plus `spec/09-TYPE-SYSTEM.md` for the type-discipline rules R6/R7/R9) — open those when you need the authoritative rationale or edge cases.

- **R1 — No explicit generics on createPlugin/createCorePlugin**: Every `createPlugin(` or `createCorePlugin(` call must NOT have type parameters (angle brackets). Types are inferred from the spec object. Any `createPlugin<` is a BLOCKER.
- **R2 — import type for type-only imports**: Use `import type { X }` when the import is only used in type positions. Enforced by `@typescript-eslint/consistent-type-imports`.
- **R3 — Plugin index.ts is wiring only (~30 lines)**: The index.ts connects domain code to the system. Business logic lives in domain files (api.ts, state.ts, handlers.ts). An index.ts > 50 lines with inline logic is a BLOCKER.
- **R4 — Plugin instance export uses the `<name>Plugin` suffix**: Per `spec/15-PLUGIN-STRUCTURE.md §7`, the exported plugin instance is named `<domainName>Plugin` in camelCase (`export const routerPlugin = createPlugin('router', …)`, `authPlugin`, `templateEnginePlugin`). The plugin **name string** (first arg) is camelCase with **no** suffix (`createPlugin('router', …)`). Islands and other non-plugin exports may use a domain-appropriate suffix (e.g. `lightboxIsland`). This is a naming convention (WARNING), not a hard invariant. (Note: earlier plugin versions inverted this rule — the spec and the vendored sandbox both use the `Plugin` suffix.)
- **R5 — No wire factory patterns**: Import `createPlugin` and dependencies directly. No `function wireXPlugin(factory, dep)` indirection.
- **R6 — No inline type assertions in createState/config**: No `null as X`, `{} as X`, `[] as X`. For Standard+, define types in `types.ts` and use typed factories. For Nano/Micro, use return-type annotations.
- **R7 — No `as any` in plugin code**: Always find the proper typing. `as any` is a BLOCKER in plugin source files.
- **R8 — Plugin tests live with the plugin**: Tests in `src/plugins/[name]/__tests__/`. Never in root `tests/unit/plugins/` or `tests/integration/plugins/`.
- **R9 — No lazy `unknown` / `any` / `Record<string, unknown>` for a knowable shape**: Moku is type-first — when the shape of a value is *derivable*, define and use an explicit type; never widen to `unknown`, `any`, or `Record<string, unknown>` and then cast field-by-field. A shape is derivable when it comes from a known contract: a DB row (the SQL schema is the type), a parsed API/queue/config payload, a function parameter with a fixed caller, the framework's own exported types (e.g. `WorkerEnv`, `Router.LayoutContext`). Before writing `unknown`/`Record<string, unknown>`, **assume the structure and look for (or declare) the type** — derive it from the schema, the spec, or the callers. `unknown` is reserved for *genuine* dynamic boundaries (untrusted `JSON.parse`/`fetch` results, `catch (e)` clauses, plugin-agnostic kernel slots) and there it MUST be narrowed or validated immediately, not cast straight through. A `: Record<string, unknown>` / `: unknown` / `<unknown>` / `<Record<string, unknown>>` annotation (or a chain of `as` casts hung off one) where a concrete type is derivable is a **BLOCKER**. Derives from `spec/09-TYPE-SYSTEM.md`'s "full inference, zero casts" philosophy; complements R6 (no inline assertions) and R7 (no `as any`). **Allowlisted:** `as unknown as <ExternalType>` for partial **test** mocks of complex external SDK types (`D1Database`, `DurableObjectStub`, a full plugin `Ctx`); a generic's `<T = unknown>` *default*; and `unknown` at a real boundary that is narrowed before use.

## Output Contract

Your response MUST end with a fenced `json` code block containing structured results. The prose report comes FIRST (for human readability), the JSON block comes LAST (for machine parsing). **Your LAST message MUST be that contract — never stop mid-analysis.** If you were spawned via a workflow that requires `StructuredOutput`, call it as your final action; otherwise emit the fenced ```json block. A run that ends without the contract is treated as a failed/missing validator (it does not count as PASS), so always close with it. The `fix` field is allowed (optional) on warnings too — include it when you have a concrete fix.

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
  "agent": "moku-spec-validator",
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
