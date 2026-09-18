# Plan Verb: Migrate Existing Code

**This step runs when VERB is `migrate`.**

## Resolve Source

**Check brainstorm context first:** If CONTEXT_FILE is set and contains a `## Migration Source` section with a non-empty `Path:` field:
- Extract MIGRATE_PATH from the context file's `## Migration Source > Path` value
- Log: "Migration source detected from brainstorm context: `{MIGRATE_PATH}`"
- Skip the source question below — proceed directly to Prerequisites

**Otherwise**, set MIGRATE_PATH from PATH_OR_LINK:
- If PATH_OR_LINK was not provided, use `AskUserQuestion`:
  - Question: "Where is the code to migrate?"
  - Header: "Source"
  - Options:
    1. label: "Local path", description: "Enter a local directory path (e.g., ~/Projects/legacy-app)"
    2. label: "GitHub URL", description: "Enter a GitHub repository URL to clone"
  - multiSelect: false
  Then get the path/URL from the user's response.
- If PATH_OR_LINK starts with `http` or contains `github.com`, clone to a temp directory first:
  `git clone --depth 1 <URL> /tmp/moku-migrate-<hash>` and set MIGRATE_PATH to the clone path.
- TYPE from Step 0 determines migration focus: `framework` (extract plugins) or `app` (map to consumer composition).

## Prerequisites

1. Verify `MIGRATE_PATH` exists and contains a `package.json`:
   - If not: tell user "No package.json found at [path]. Provide a path to a Node/Bun project."
2. Verify clean git working tree:
   - Run `git status --porcelain` — if output is non-empty, warn: "You have uncommitted changes. Commit or stash before planning a migration."

## Research

Spawn **moku-researcher** agent with the tech stack, domain description, and key dependencies found at `MIGRATE_PATH`. The unfamiliar codebase needs ecosystem investigation. Research output is saved to `.planning/build/research.md`.

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

## App Migration (TYPE = app)

When migrating to a consumer app (TYPE is `app`), the analysis differs:

1. **Framework Identification**: Identify which Moku framework the app will consume. Check if one exists in the workspace or ask the user:
   - Use `AskUserQuestion`: "Which Moku framework should this app consume?"
   - Options: list detected framework packages from the source project's dependencies, plus "New framework (will plan both)"
2. **Route Mapping**: Map existing entry points and routes to Moku `createApp` composition
3. **Custom Plugin Detection**: Identify app-specific logic that should become custom consumer-side plugins (e.g., app-specific middleware, custom UI components, authentication wrappers)
4. **Import Rewriting**: Map existing imports to framework package imports (consumer code NEVER imports from `@moku-labs/core`)

Write app migration analysis to `.planning/decisions.md` with `## Migration Type: app-from-existing`.

## Error Handling

If the source project cannot be analyzed (e.g., no recognizable structure, binary files only, unsupported language):
- Tell the user: "Cannot analyze source at [path] — no recognizable TypeScript/JavaScript project structure found. Moku migration requires a Node.js/Bun project with package.json."
- Stop.

If the source project has circular dependencies that prevent clean plugin mapping:
- Document all cycles in the Gap Analysis section of decisions.md
- Flag each cycle as a "MIGRATION BLOCKER — requires manual restructuring"
- Continue with the rest of the analysis (partial results are still valuable)

## Next

After migration analysis, proceed with the **create flow**: Read `${CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/plan-verb-create.md` and follow from the discussion phase onward. The migration analysis provides context that will cause the discussion phase to be auto-skipped and the research phase to be auto-skipped (since both were already performed during migration).
