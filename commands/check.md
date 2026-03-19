---
description: Run diagnostics on the Moku plugin installation and project state
allowed-tools: Read, Bash, Glob, Grep, Agent
argument-hint: [verbose|self-test|graph|status|plugin <name>|diff <name>]
disable-model-invocation: true
---

Before routing to any subcommand, validate the raw arguments:
- If `$ARGUMENTS` is empty, proceed to the default full diagnostic (Checks 1–6).
- If `$ARGUMENTS` is `plugin` with no following token, stop and output:
  `Usage: /moku:check plugin <name>` — then list all plugin names found in `src/plugins/`.
- If `$ARGUMENTS` is `diff` with no following token, stop and output:
  `Usage: /moku:check diff <name>` — then list all spec files found in `.planning/specs/`.
- If `$ARGUMENTS` contains an unrecognized subcommand (not one of: verbose, self-test, graph, status, plugin, diff), stop and output:
  `Unknown subcommand: <token>. Valid subcommands: verbose | self-test | graph | status | plugin <name> | diff <name>`

Run a diagnostic check on the current Moku project and plugin installation. Reports issues with project structure, planning state, and plugin health.

## Checks

### 1. Project Detection

Detect the project type:
- Check for `src/config.ts` with `createCoreConfig` → Framework (Layer 2)
- Check for `createApp` import from a framework package → Consumer App (Layer 3)
- Check for `package.json` → Generic project
- If none of the above match (no `package.json`, no `src/config.ts`, no `createApp` import found),
  stop all further checks and output:
  `This does not appear to be a Moku project. No package.json found in the current directory.`
  `Run /moku:check from the root of a Node.js or Moku project.`
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
- Check `.planning/specs/` directory for spec files

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

If `$ARGUMENTS` contains "graph", generate mermaid diagrams for the project (Framework projects only):

### Dependency Graph
Build a mermaid flowchart from all plugin `depends: [...]` declarations:
```mermaid
graph TD
  env["env (Nano)"]
  logger["logger (Micro)"]
  router["router (Standard)"]
  renderer["renderer (Complex)"]
  logger --> env
  router --> logger
  renderer --> router
  renderer --> logger
```
- Each node shows plugin name and tier
- Arrows flow from dependent → dependency
- Color-code by tier: Nano=green, Micro=blue, Standard=orange, Complex=red, VeryComplex=purple

### Event Flow Map
Build a mermaid flowchart showing event declarations, emitters, and listeners:
- To find **emitters**: scan `src/plugins/*/index.ts` for `events:` fields (the register callbacks).
  Also check `src/config.ts` for the `Events` interface — this lists all known event names for the project.
- To find **listeners**: scan `src/plugins/*/index.ts` for `hooks:` fields.
- Use the `Events` interface in `src/config.ts` as the authoritative list of event names.
  Any event name in a plugin's `events:` or `hooks:` that does not appear in `src/config.ts Events` is flagged as orphaned.
```mermaid
graph LR
  subgraph Emitters
    router_emit["router"]
    auth_emit["auth"]
  end
  subgraph Events
    nav["router:navigated"]
    login["auth:login"]
    logout["auth:logout"]
  end
  subgraph Listeners
    analytics_hook["analytics"]
    logger_hook["logger"]
  end
  router_emit --> nav
  auth_emit --> login
  auth_emit --> logout
  nav --> analytics_hook
  nav --> logger_hook
  login --> analytics_hook
```
- Left: plugins that emit, Center: event names, Right: plugins that hook
- Orphan events (no listeners) shown in dashed style
- Dead hooks (no emitter) shown in red

### Wave Execution Plan
If `.planning/STATE.md` has wave grouping, generate a Gantt-style diagram:
- Wave grouping is read from lines beginning with `## Waves:` in `.planning/STATE.md`.
  Each wave entry lists the plugin names for that wave separated by commas.
  If no `## Waves:` field exists in STATE.md, skip this diagram and note "No wave data in STATE.md."
```mermaid
gantt
  title Build Wave Execution
  dateFormat X
  axisFormat %s
  section Wave 1
    env     :0, 1
    logger  :0, 1
  section Wave 2
    router  :1, 2
    auth    :1, 2
  section Wave 3
    renderer :2, 3
```

Output all three diagrams with brief descriptions. If the project has no plugins yet, report "No plugins found — nothing to graph."

If `$ARGUMENTS` contains "self-test", skip project checks and instead validate the Moku Claude plugin itself:
1. Verify all agent `.md` files exist in `${CLAUDE_PLUGIN_ROOT}/agents/` and have valid YAML frontmatter (name, description, model, tools). Count them dynamically — do not hardcode an expected number.
2. Verify all skill directories exist with SKILL.md files in `${CLAUDE_PLUGIN_ROOT}/skills/`
3. Verify `${CLAUDE_PLUGIN_ROOT}/hooks/hooks.json` parses as valid JSON
4. Verify all referenced hook scripts exist and are executable.
   Check executability using `test -x <absolute-path>` in Bash for each script path found in
   `hooks.json`. Report the exact path of any script that fails the test.
5. Verify all reference files mentioned in skills/commands exist.
   Extract referenced paths by grepping skill `SKILL.md` files and command `.md` files for patterns
   matching `` `references/ `` or `references/*.md`. Resolve each path relative to
   `${CLAUDE_PLUGIN_ROOT}` and check that the file exists with `Read` or `Bash test -f`.
6. Verify `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json` parses correctly
7. Verify version in `plugin.json` matches version in `marketplace.json` (prevents version drift regression)
8. Report PASS/FAIL for each check

If `$ARGUMENTS` contains "status", show a compact overview of all plugins and their current state (Framework projects only):

1. List all plugins in `src/plugins/` with:
   - Plugin name
   - Assessed complexity tier (based on file count and structure)
   - File count
   - Whether `__tests__/` exists
   - Whether `README.md` exists
   - Build status from `.planning/STATE.md` (if it exists)
2. Show total plugin count and tier distribution
3. Show planning state summary (if active)

Example output:
```
Moku Plugin Status
==================
| Plugin   | Tier     | Files | Tests | README | Build   |
|----------|----------|-------|-------|--------|---------|
| env      | Nano     | 3     | Yes   | Yes    | done    |
| logger   | Micro    | 3     | Yes   | Yes    | done    |
| router   | Standard | 8     | Yes   | Yes    | done    |
| renderer | Complex  | 12    | Yes   | Yes    | pending |

Total: 4 plugins (1 Nano, 1 Micro, 1 Standard, 1 Complex)
Plan: stage2/approved — Next: /moku:build #4
```

If `$ARGUMENTS` contains "plugin" followed by a plugin name, run targeted validation on that single plugin:

1. Verify the plugin directory exists in `src/plugins/<name>/`
2. Assess its complexity tier from file structure
3. Run fast checks first: `bun run format`, `bun run lint`, `bunx tsc --noEmit`, `bun run test`
4. If all fast checks pass, report PASS and skip agent-based validation (unless `--full` flag is also present)
5. If fast checks fail OR `--full` is present, spawn 3 validators in parallel:
   - **moku-plugin-spec-validator** — tier compliance, file organization, index.ts quality
   - **moku-type-validator** — tsc --noEmit, import type compliance, no `as any`
   - **moku-jsdoc-validator** — JSDoc completeness on all exports
6. Report results with PASS/WARN/FAIL for each validator
7. If any BLOCKER issues found, list them with fix suggestions

If `$ARGUMENTS` contains "diff" followed by a plugin name, compare the spec against the implementation:

1. Find the spec file in `.planning/specs/*-<name>.md`
   - Spec sections are identified by H2 headers (`## `) with these exact names: `Config`, `State`,
     `API`, `Events`, `Dependencies`, `Hooks`. Any other headers in the spec file are ignored.
   - If no spec file matching `*-<name>.md` is found in `.planning/specs/`, stop and output:
     `No spec found for plugin "<name>". Expected: .planning/specs/*-<name>.md`
2. Read the spec's Config, State, API, Events, Dependencies, and Hooks sections
3. Read the implementation from these files in `src/plugins/<name>/`:
   `types.ts`, `api.ts`, `state.ts`, `index.ts` — read each that exists; treat absent files as empty.
4. Compare each spec section against the implementation:

```
Spec-vs-Implementation Diff: [plugin-name]
============================================
| Section      | Spec                    | Implementation          | Status |
|--------------|-------------------------|-------------------------|--------|
| Config       | basePath, trailingSlash | basePath, trailingSlash | MATCH  |
| State        | currentPath, routes     | currentPath, routes, history | EXTRA: history |
| API          | navigate, current, back | navigate, current       | GAP: back |
| Events       | router:navigated        | router:navigated        | MATCH  |
| Dependencies | env                     | env                     | MATCH  |
| Hooks        | app:started             | app:started             | MATCH  |
```

5. Report MATCH (spec matches implementation), GAP (spec has item, implementation missing), EXTRA (implementation has item not in spec)
6. GAP items are flagged as BLOCKER — the spec promised this API/feature
7. EXTRA items are flagged as INFO — implementation added beyond spec (may need spec update)
