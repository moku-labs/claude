# Audit Framework — Reference

Shared rules, taxonomies, templates, and thresholds for the `/moku:audit` command and its agents.

---

## Scenario Taxonomy

All scenarios belong to one of four categories. Generate at least 2 per category; aim for proportional coverage across a command's documented paths.

### `valid` — Happy Path Coverage

Every documented verb/mode/argument combination needs at least one valid scenario. For each valid scenario:
- Use the exact argument format from the command's `argument-hint`
- Set realistic preconditions (e.g., STATE.md exists at the right stage)
- Expected behavior should describe the complete successful output

**For `plan.md`:** `create framework`, `create app`, `add plugin`, `update plugin`, `migrate framework`, `resume`, each with and without `--quick`

**For `build.md`:** `resume` at each skeleton state (not-started, in-progress, committed), `resume` mid-wave, `--continue` flag

**For `check.md`:** Each subcommand (verbose, status, graph, diff, self-test) with valid targets

**For `status.md`:** No args (default view), various STATE.md positions

**For `init.md`:** Minimal args, full args, with and without existing project files

### `edge` — Boundary Conditions

Scenarios at the edge of documented behavior:
- Minimum viable input (one word, required arg only)
- Maximum argument length (requirements string > 200 chars)
- Special characters in arguments (quotes, slashes, hyphens, parentheses)
- Partial/corrupt STATE.md (exists but missing required `## Phase:` header)
- Boundary values (exactly at threshold: `--quick` auto-suggest fires at ≤4 plugins)
- Resuming from a stage that is already complete
- Multiple flags combined in unexpected order
- Empty string value for a required positional argument

### `error` — Error Path Coverage

Known error conditions the command must handle gracefully:
- Unrecognized VERB or invalid VERB+TYPE combo
- Required argument missing (e.g., `migrate` with no path)
- `resume` when no STATE.md exists
- Filesystem errors (`.planning/` not writeable, file locked)
- STATE.md records wrong VERB for current invocation
- Spawned agent fails or times out mid-pipeline
- User declines at every approval gate — what does the command say next?
- Command invoked in a non-moku project (no `src/` or `package.json`)

### `adversarial` — Injection and Abuse

Inputs designed to expose missing guards:
- Shell metacharacters in arguments: `create framework "x; rm -rf ~"`
- Path traversal: `create ../../../etc/passwd "desc"`
- Argument that mimics an internal keyword: `create resume "a framework"`
- Extremely long input (stress test prompt truncation)
- Second invocation without STATE.md reset (detect and offer resume, not overwrite)
- Conflicting flags: `--quick` with `resume` verb (which wins?)

---

## Gap Taxonomy

All gaps are classified into exactly one type. Use these names in all agent output contracts.

| Type | Description | Example |
|------|-------------|---------|
| `missing-error-handling` | Reachable error condition with no documented recovery path | `migrate` with invalid URL — command doesn't say what to show |
| `ambiguous-step` | Step has multiple valid interpretations; two reasonable readers would do different things | "If no TYPE found" — token scanning order is unspecified |
| `contradiction` | Two sections give conflicting instructions | Step 0 strips `--quick` but later step references `$ARGUMENTS` raw |
| `missing-edge-case` | A real user input is not handled | `create framework` with empty description string |
| `silent-failure` | Error condition reached but command gives no user-visible output | STATE.md.bak write fails, command continues silently |
| `inefficiency` | Step does more work than needed or in wrong order | Re-reading a file already loaded in an earlier step |
| `missing-guard` | Downstream step assumes something upstream steps don't guarantee | Stage 2 assumes plugin table exists but Stage 1 approval doesn't enforce format |
| `state-corruption-risk` | Write operation can leave state inconsistent if interrupted | Writing STATE.md without backup atomicity |
| `undocumented-assumption` | Command silently assumes a tool/file/env exists without checking | Assumes `bun` is in PATH without checking |
| `user-experience-gap` | Command doesn't tell user what to do next after an outcome | After plan-checker BLOCKER, no guidance on what to fix |

---

## Circuit Breaker Thresholds

| Setting | Default | Config key in moku.local.md | Floor |
|---------|---------|------------------------------|-------|
| Max scenarios per audit | 20 | `auditMaxScenarios` | 5 |
| Simulator batch size | 5 | (hardcoded) | — |
| Max parallel simulators | min(maxParallelAgents, 5) | `maxParallelAgents` | 1 |
| Max real-execution scenarios | 5 | (hardcoded) | — |
| Max iterate passes | 3 | `auditIterateLimit` | 1 |
| Max user edit rounds at gate | 3 | (hardcoded) | — |

**AUDIT-STABLE:** Zero BLOCKERs + ≤2 WARNINGs across all simulated and real-executed scenarios. When stable, the synthesizer sets `"verdict": "PASS"` in its output contract and the command prints:

```
AUDIT-STABLE: {command}.md passed all {N} scenarios.
Zero blockers. {M} informational suggestions noted (not applied).
```

**Trimming priority when over cap:** adversarial → edge → error → valid. Never trim below 2 per category.

---

## Temp Project Bootstrap Templates

Use these exact templates when setting up `AUDIT_TMP` for real execution. The executor adjusts per-scenario preconditions after setup.

### `package.json`
```json
{
  "name": "moku-audit-testbed",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "lint": "echo 'lint ok'",
    "format": "echo 'format ok'",
    "test": "echo 'tests ok'"
  },
  "dependencies": {
    "@moku-labs/core": "*"
  }
}
```

### `src/config.ts`
```typescript
import { createCoreConfig } from '@moku-labs/core';

export interface Config {
  name: string;
}

export interface Events {
  ready: void;
}

export const { createPlugin, createCore } = createCoreConfig<Config, Events>('audit-testbed', {
  config: { name: 'testbed' },
});
```

### `src/index.ts`
```typescript
import { createCore } from './config.js';

export const { createApp } = createCore({
  plugins: [],
});
```

### `.planning/STATE.md` (neutral starting state)
```markdown
## Phase: planning
## Verb: create
## Type: framework
## Target: Audit Testbed
## Skeleton: not-started
## Next Action: /moku:build resume
```

---

## Diff Generation Rules

The synthesizer applies these rules when writing the unified diff and improved command:

1. **Context lines:** Show 3 lines before and after each change (standard unified diff)
2. **Hunk format:** `@@ -N,M +N,M @@ step-name` — include the step name as hunk context
3. **Scope:** Fix BLOCKERs (always). Fix WARNINGs (unless `deferred` with justification). Skip INFOs.
4. **Never change:** Command intent, documented verb list, existing happy-path behavior, argument-hint format
5. **Always preserve:** `disable-model-invocation: true`, `allowed-tools` list, all `!` bash inline commands
6. **Add before step:** New guards, validation, and error messages should appear as sub-bullets at the start of the relevant step — not as new steps
7. **Add after step:** Fallback handling and "what to do next" instructions appear as the last sub-bullet of the relevant step

---

## Executor Precondition Patterns

The executor sets preconditions per scenario before "running" that scenario in `AUDIT_TMP`. Common patterns:

| Precondition | How to set it |
|---|---|
| `STATE.md exists at stage N` | Write `.planning/STATE.md` with `## Phase: stage{N}` and `## Next Action:` set appropriately |
| `STATE.md missing` | Ensure `.planning/STATE.md` does not exist (delete if present) |
| `STATE.md malformed` | Write `.planning/STATE.md` with only `## Phase:` missing (all other headers present) |
| `Plugin exists` | Create `src/plugins/{name}/index.ts` with minimal content |
| `Skeleton committed` | Write STATE.md with `## Skeleton: committed` |
| `Git checkpoint` | Run `git add -A && git commit -m "checkpoint" --allow-empty` in AUDIT_TMP |
| `.planning/ not writeable` | `chmod 444 "$AUDIT_TMP/.planning"` before scenario, restore after |

Always restore filesystem state between scenarios: `chmod 755 "$AUDIT_TMP/.planning"` if permissions were changed.
