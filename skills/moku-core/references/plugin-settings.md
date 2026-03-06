# Plugin Settings (.local.md Pattern)

Moku projects can use `.local.md` files for per-project plugin configuration. These files store settings in YAML frontmatter with markdown content for documentation.

## File Location

```
.claude/moku.local.md     # Per-project Moku settings (gitignored)
.claude/moku.md            # Shared Moku settings (committed)
```

## Format

```yaml
---
# Moku Plugin Configuration
maxParallelAgents: 3
gapClosureMaxRounds: 2
validatorModel: sonnet
researcherModel: sonnet
autoFormat: true
autoCommitBeforeWaves: true
bundleSizeTarget:
  js: 8
  css: 10
---

# Project Notes

Custom notes about this project's Moku setup.
Preferences, decisions, and patterns specific to this codebase.
```

## Supported Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `maxParallelAgents` | 3 | Max agents per wave batch |
| `gapClosureMaxRounds` | 2 | Max fix attempts before manual intervention |
| `validatorModel` | sonnet | Model for validation agents |
| `researcherModel` | sonnet | Model for research agent |
| `autoFormat` | true | Auto-run `bun run format` after edits |
| `autoCommitBeforeWaves` | true | Git commit checkpoint before each wave |
| `bundleSizeTarget.js` | 8 | JS bundle target in KB (gzipped) |
| `bundleSizeTarget.css` | 10 | CSS bundle target in KB (gzipped) |

## Reading Settings

Commands and skills can read settings via shell injection:

```markdown
!`if [ -f .claude/moku.local.md ]; then head -20 .claude/moku.local.md; fi`
```

Or in hook scripts:

```bash
MAX_AGENTS=$(grep 'maxParallelAgents:' .claude/moku.local.md 2>/dev/null | awk '{print $2}')
MAX_AGENTS=${MAX_AGENTS:-3}
```
