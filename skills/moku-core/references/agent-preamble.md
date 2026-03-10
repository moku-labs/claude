# Moku Agent Preamble

These rules apply to ALL Moku agents. Follow them strictly.

## Universal Rules

1. **Scope**: Only check files in the target scope. Don't report on files you weren't asked to validate.
2. **Evidence**: Every finding must cite a specific file path and line number (or range). No vague findings.
3. **Severity**: Use exactly these levels — BLOCKER (must fix), WARNING (should fix), INFO (suggestion). No other severity names.
4. **Actionable**: Every BLOCKER and WARNING must include a concrete fix. Don't just flag — explain the fix.
5. **No false positives**: If uncertain whether something is a violation, report as WARNING, not BLOCKER.
6. **Efficiency**: Read the minimum files needed. Don't read the entire codebase if checking one plugin.
7. **Project memory**: If you have persistent memory (`memory: user`), consult it for project-specific patterns before validating. When writing to memory, use the structured format: `- [YYYY-MM-DD] description | confidence:{high|medium|low}` under one of these sections: `## Error Patterns`, `## Architecture Decisions`, or `## Validation Baselines`. This enables recency-based injection during context compaction. **Aging policy**: When writing new entries, delete entries older than 14 days with `confidence:low` and entries older than 30 days with `confidence:medium`. Keep `confidence:high` entries indefinitely.

## Moku Code Rules

These are the canonical definitions of Moku-wide code rules. All agents enforce these — individual agent prompts reference them by number instead of duplicating.

- **R1 — No explicit generics on createPlugin/createCorePlugin**: Every `createPlugin(` or `createCorePlugin(` call must NOT have type parameters (angle brackets). Types are inferred from the spec object. Any `createPlugin<` is a BLOCKER.
- **R2 — import type for type-only imports**: Use `import type { X }` when the import is only used in type positions. Enforced by `@typescript-eslint/consistent-type-imports`.
- **R3 — Plugin index.ts is wiring only (~30 lines)**: The index.ts connects domain code to the system. Business logic lives in domain files (api.ts, state.ts, handlers.ts). An index.ts > 50 lines with inline logic is a BLOCKER.
- **R4 — No "Plugin" postfix on exports**: Plugin instance exports use bare names matching the plugin string name (`router`, not `routerPlugin`).
- **R5 — No wire factory patterns**: Import `createPlugin` and dependencies directly. No `function wireXPlugin(factory, dep)` indirection.
- **R6 — No inline type assertions in createState/config**: No `null as X`, `{} as X`, `[] as X`. For Standard+, define types in `types.ts` and use typed factories. For Nano/Micro, use return-type annotations.
- **R7 — No `as any` in plugin code**: Always find the proper typing. `as any` is a BLOCKER in plugin source files.
- **R8 — Plugin tests live with the plugin**: Tests in `src/plugins/[name]/__tests__/`. Never in root `tests/unit/plugins/` or `tests/integration/plugins/`.

## Output Contract

Your response MUST end with a fenced `json` code block containing structured results. The prose report comes FIRST (for human readability), the JSON block comes LAST (for machine parsing).

```json
{
  "agent": "<your-agent-name>",
  "verdict": "PASS | FAIL | PARTIAL",
  "blockers": [{"file": "path", "line": N, "rule": "...", "message": "...", "fix": "..."}],
  "warnings": [{"file": "path", "line": N, "rule": "...", "message": "..."}],
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
