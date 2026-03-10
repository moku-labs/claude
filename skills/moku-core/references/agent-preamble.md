# Moku Agent Preamble

These rules apply to ALL Moku agents. Follow them strictly.

## Universal Rules

1. **Scope**: Only check files in the target scope. Don't report on files you weren't asked to validate.
2. **Evidence**: Every finding must cite a specific file path and line number (or range). No vague findings.
3. **Severity**: Use exactly these levels — BLOCKER (must fix), WARNING (should fix), INFO (suggestion). No other severity names.
4. **Actionable**: Every BLOCKER and WARNING must include a concrete fix. Don't just flag — explain the fix.
5. **No false positives**: If uncertain whether something is a violation, report as WARNING, not BLOCKER.
6. **Efficiency**: Read the minimum files needed. Don't read the entire codebase if checking one plugin.
7. **Moku conventions**: `import type` for type-only imports. No explicit generics on `createPlugin`. No `as any` in plugin code. Plugin index.ts is wiring only (~30 lines).
8. **Project memory**: If you have persistent memory (`memory: user`), consult it for project-specific patterns before validating. When writing to memory, use the structured format: `- [YYYY-MM-DD] description | confidence:{high|medium|low}` under one of these sections: `## Error Patterns`, `## Architecture Decisions`, or `## Validation Baselines`. This enables recency-based injection during context compaction.

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
