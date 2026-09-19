# Pack template

A **pack** is one marketplace plugin that teaches one moku-family framework. The core plugin (`moku`)
owns the conductor, the lifecycle skills and the shared knowledge; a pack owns a single framework's
skill, its references, its optional validator and its evals.

This directory is not a live plugin — it is a copy source. Every occurrence of `FRAMEWORK` is a
placeholder for the framework key (`web`, `worker`, `room`, `ai`, `system`, …).

```
plugins/moku-FRAMEWORK/
  .claude-plugin/plugin.json          # name moku-FRAMEWORK, dependencies ["moku"]
  skills/moku-FRAMEWORK/SKILL.md      # the framework skill
  skills/moku-FRAMEWORK/references/   # plugin-index.md and anything else one level deep
  agents/FRAMEWORK-validator.md       # optional; frontmatter name: moku-FRAMEWORK-validator
  evals/first-plugin/                 # at least one case: prompt.md + graders/
```

## The 5 steps to add a pack

### 1. Copy the template

```bash
cp -R docs/pack-template plugins/moku-FRAMEWORK
grep -rl FRAMEWORK plugins/moku-FRAMEWORK | xargs sed -i '' 's/FRAMEWORK/<key>/g'
mv plugins/moku-FRAMEWORK/skills/moku-FRAMEWORK plugins/moku-FRAMEWORK/skills/moku-<key>
rm plugins/moku-FRAMEWORK/README.md
```

Set the real `description` and `keywords` in `plugin.json`. Keep `"dependencies": ["moku"]`. A pack
that is not ready for general use keeps `"defaultEnabled": false`; remove that line once it ships.

### 2. Write the skill

Fill `skills/moku-<key>/SKILL.md`: what the framework is, its stack, its idiomatic shape, and the
minimal API form. Keep it under 500 lines and put long material in `references/`, one level deep.

The pack cannot read core files by path — `${CLAUDE_PLUGIN_ROOT}` resolves to the pack. Where the
skill needs core knowledge (`moku-idioms.md`, `moku-frameworks.md`, `spec-index.md`, …), say: load
the `moku:moku-core` skill with the Skill tool and read `references/<file>` under the base directory
it prints.

### 3. Add the validator (optional) and the eval

An agent under `agents/` whose frontmatter `name` is `moku-<key>-validator` is picked up by
`/moku:verify` through that naming convention alone — no registration. The file name is free; the
other packs use `<key>-validator.md`. Give it `model: sonnet` and `effort: medium`, and keep `Agent`
out of its `tools`.

Ship at least one eval case under `evals/`. A case is a `prompt.md` (frontmatter `max_turns`,
`allowed_tools`, `tags`; body is what the user types) plus `graders/*.md`. Include a `tool_used`
grader that asserts the skill fired:

```markdown
---
type: tool_used
tool: Skill
input_match: '"skill"\s*:\s*"(?:[\w-]+:)?moku-<key>"'
---
```

Run it from the repository root:

```bash
claude plugin eval . --trust-plugin --no-publish --case first-plugin --runs 1 --ablation none
```

### 4. Register the framework

Add a row to the registry — `plugins/moku/skills/moku-core/references/moku-frameworks.md`, the JSON
block — with `key`, `npm`, `repo`, `layer`, `knownVersion: "0.0.0"`, `pack: "moku-<key>"`,
`skill: "plugins/moku-<key>/skills/moku-<key>"`,
`pluginIndex: "plugins/moku-<key>/skills/moku-<key>/references/plugin-index.md"`, `dependsOn`,
`detect`, `releaseSource` and `upgrade`. Then populate the catalog from upstream:

```bash
# from the repository root, with the moku-maintainer pack enabled
moku-sync <key>
```

### 5. Add the marketplace entry

Add the pack to `.claude-plugin/marketplace.json`:

```json
{
  "name": "moku-<key>",
  "version": "0.70.0",
  "source": "./plugins/moku-<key>",
  "description": "@moku-labs/<key> pack: …",
  "author": { "name": "Oleksandr Kucherenko" },
  "category": "development"
}
```

The `version` here and the `version` in `plugins/moku-<key>/.claude-plugin/plugin.json` must be the
same string — `claude plugin tag` validates that they agree. Finish with:

```bash
claude plugin validate plugins/moku-<key>
```
