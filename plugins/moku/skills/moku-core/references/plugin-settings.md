# Plugin settings — user level and project level

Two layers configure the moku plugins. The user level is Claude Code's own `userConfig`: the person
sets it once for every project. The project level is `.claude/moku.local.md`: per-repository
preferences that only the skills read.

## 1. User level — `userConfig`

Declared in each plugin's `.claude-plugin/plugin.json` and set by the user in Claude Code's plugin
settings. Claude Code exposes each value to hooks as `CLAUDE_PLUGIN_OPTION_<NAME>` in upper case.

### Core plugin (`moku`)

| Option | Type | Default | What it does |
|---|---|---|---|
| `rails` | `strict` · `warn` · `off` | `strict` | `strict` blocks a source write that skips a lifecycle station, `warn` only prints the reason, `off` disables the write guard. Read by `hooks/pre-write.mjs` as `CLAUDE_PLUGIN_OPTION_RAILS`. |
| `max_parallel_agents` | number 1–8 | `3` | How many builder or validator agents the orchestrating session may run at once. |

### Design pack (`moku-design`)

| Option | Type | Default | What it does |
|---|---|---|---|
| `astra` | boolean | `true` | Ask Astra through the Codex CLI for a second opinion on user experience and for image assets. When off, or when `moku-astra` exits 3, Fable reviews alone with the same findings schema. |
| `art_backend` | `codex` · `api` | `codex` | `codex` draws through the ChatGPT plan. `api` calls the OpenAI Images API, bills per image and needs `OPENAI_API_KEY`. The plugin never switches to `api` by itself. |

The other packs (`moku-web`, `moku-worker`, `moku-room`, `moku-maintainer`) declare no options.

## 2. Project level — `.claude/moku.local.md`

A gitignored file at the project root. YAML frontmatter holds the settings, the body holds notes.

```yaml
---
maxParallelAgents: 3
gapClosureMaxRounds: 2
autoFormat: true
bundleSizeTarget:
  js: 8
  css: 10
---

# Project notes

Anything about this repository's moku setup worth keeping next to the settings.
```

| Setting | Default | Meaning |
|---|---|---|
| `maxParallelAgents` | 3 | Overrides `max_parallel_agents` for this project. |
| `gapClosureMaxRounds` | 2 | Fix attempts before a gap goes back to the user. |
| `autoFormat` | true | Run `bun run format` after edits. |
| `bundleSizeTarget.js` | 8 | JS bundle target in KB, gzipped. |
| `bundleSizeTarget.css` | 10 | CSS bundle target in KB, gzipped. |

Model choice is not a project setting any more: every agent and skill pins `model` and `effort` in
its own frontmatter (`DECISIONS §4`). Notification and sound settings are gone with the hooks that
played them.

## Reading settings

In a skill body:

```markdown
!`test -f .claude/moku.local.md && head -20 .claude/moku.local.md || true`
```

In a hook script:

```bash
MAX_AGENTS=$(grep 'maxParallelAgents:' .claude/moku.local.md 2>/dev/null | awk '{print $2}')
MAX_AGENTS=${MAX_AGENTS:-${CLAUDE_PLUGIN_OPTION_MAX_PARALLEL_AGENTS:-3}}
```

The project value wins over the user value, and the user value wins over the built-in default.
