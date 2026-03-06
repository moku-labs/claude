---
description: Run diagnostics on the Moku plugin installation and project state
allowed-tools: Read, Bash, Glob, Grep, Agent
argument-hint: [verbose|self-test]
disable-model-invocation: true
---

Run a diagnostic check on the current Moku project and plugin installation. Reports issues with project structure, planning state, and plugin health.

## Checks

### 1. Project Detection

Detect the project type:
- Check for `src/config.ts` with `createCoreConfig` → Framework (Layer 2)
- Check for `createApp` import from a framework package → Consumer App (Layer 3)
- Check for `package.json` → Generic project
- Report: project type, framework name (if applicable)

### 2. Tooling Verification

Check that required tooling is configured:
- `package.json` exists with expected scripts (`build`, `lint`, `format`, `test`)
- `biome.json` exists
- `tsconfig.json` exists with strict mode
- `vitest.config.ts` exists
- `.gitignore` includes `.planning/`, `dist/`, `node_modules/`
- Report: PASS/MISSING for each

### 3. Planning State

Check `.planning/STATE.md`:
- If exists: report current phase, completed stages, next action
- If not: report "No active plan"
- Check for stale state (last updated > 7 days ago)
- Check `specifications/` directory for spec files

### 4. Plugin Health (Framework projects)

For each plugin in `src/plugins/`:
- Check file count matches expected tier
- Check `index.ts` exists and is < 50 lines
- Check `README.md` exists
- Check `__tests__/` directory exists
- Report: plugin name, tier assessment, health status

### 5. Build Status

Run quick checks (skip if no package.json):
- `bunx tsc --noEmit` — type check
- `bun run lint` — lint check
- Report: PASS/FAIL for each

### 6. Dependency Check

- Check `@moku-labs/core` version (if framework project)
- Check for outdated dependencies
- Report any peer dependency warnings

## Output

Present a summary table:

```
Moku Project Diagnostic Report
===============================
Project type: Framework (Layer 2)
Framework: my-framework

Tooling:       [PASS] All config files present
Planning:      [ACTIVE] Phase: stage2/approved (3 specs created)
Plugins:       [OK] 5 plugins (2 Nano, 1 Micro, 2 Standard)
TypeScript:    [PASS] tsc --noEmit clean
Lint:          [PASS] Zero warnings
Dependencies:  [OK] @moku-labs/core@1.0.0

Issues:
- WARNING: Plugin "cache" has no __tests__/ directory
- INFO: .planning/STATE.md last updated 3 days ago
```

If `$ARGUMENTS` contains "verbose", show full details for each check. Otherwise show the summary only.

If `$ARGUMENTS` contains "self-test", skip project checks and instead validate the Moku Claude plugin itself:
1. Verify all 9 agent files exist in `${CLAUDE_PLUGIN_ROOT}/agents/` and have valid YAML frontmatter (name, description, model, tools)
2. Verify all 3 skill directories exist with SKILL.md files in `${CLAUDE_PLUGIN_ROOT}/skills/`
3. Verify `${CLAUDE_PLUGIN_ROOT}/hooks/hooks.json` parses as valid JSON
4. Verify all referenced hook scripts exist and are executable
5. Verify all reference files mentioned in skills/commands exist
6. Verify `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json` parses correctly
7. Report PASS/FAIL for each check
