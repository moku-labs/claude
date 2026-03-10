# Plan Verb: Migrate Existing Code

**This step runs when VERB is `migrate`.**

## Resolve Source

MIGRATE_PATH is set from PATH_OR_LINK:
- If PATH_OR_LINK was not provided, ask user for the path or URL.
- If PATH_OR_LINK starts with `http` or contains `github.com`, clone to a temp directory first:
  `git clone --depth 1 <URL> /tmp/moku-migrate-<hash>` and set MIGRATE_PATH to the clone path.
- TYPE from Step 0 determines migration focus: `framework` (extract plugins) or `app` (map to consumer composition).

## Prerequisites

1. Verify `MIGRATE_PATH` exists and contains a `package.json`:
   - If not: tell user "No package.json found at [path]. Provide a path to a Node/Bun project."
2. Verify clean git working tree:
   - Run `git status --porcelain` — if output is non-empty, warn: "You have uncommitted changes. Commit or stash before planning a migration."

## Research

Spawn **moku-researcher** agent with the tech stack, domain description, and key dependencies found at `MIGRATE_PATH`. The unfamiliar codebase needs ecosystem investigation. Research output is saved to `.planning/research.md`.

## Analysis

Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/migrate-flows.md` for the from-existing analysis instructions. Execute all 5 sub-steps against the code at `MIGRATE_PATH`:

1. **Tech Stack Identification** — package.json, tsconfig, build tool, test framework, runtime
2. **Architecture Analysis** — directory structure, domain boundaries, entry points, state patterns, communication patterns
3. **Pattern Mapping** — map existing patterns to Moku concepts (singletons → plugins, EventEmitter → events, etc.)
4. **Domain-to-Plugin Mapping** — for each domain, propose: plugin name, tier, config, state, API, events, dependencies, lifecycle
5. **Gap Analysis** — identify what does not map cleanly (god modules, circular deps, side effects, global state)

## Save Context

Write analysis results to `.planning/decisions.md` using the Migration decisions.md Template from `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-templates.md`. The file MUST include a `## Migration Type` header with `Flow: from-existing` so the discussion phase detects it.

Log to user: "Migration analysis complete. Saved to `.planning/decisions.md`. Proceeding to the create flow."

## Next

After migration analysis, proceed with the **create flow**: Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-verb-create.md` and follow from the discussion phase onward. The migration analysis provides context that will cause the discussion phase to be auto-skipped and the research phase to be auto-skipped (since both were already performed during migration).
