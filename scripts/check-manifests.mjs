/**
 * Repository check: every plugin manifest parses, versions agree with the marketplace,
 * and every SKILL.md and agent file starts with parseable-looking frontmatter.
 *
 * Runs in CI where the `claude` CLI is not installed. `npm run validate` is the full local check.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const problems = [];
const marketplace = JSON.parse(readFileSync(".claude-plugin/marketplace.json", "utf8"));

// Each marketplace entry points at a plugin whose manifest carries the same name and version
for (const entry of marketplace.plugins) {
  const manifest = JSON.parse(readFileSync(join(entry.source, ".claude-plugin", "plugin.json"), "utf8"));
  if (manifest.name !== entry.name) problems.push(`${entry.source}: name "${manifest.name}" != marketplace "${entry.name}"`);
  if (manifest.version !== entry.version) problems.push(`${entry.name}: plugin.json ${manifest.version} != marketplace ${entry.version}`);
}

// Frontmatter: present, closed, with a name or description, and no example blocks that break YAML
for (const file of markdownWithFrontmatter("plugins")) {
  const text = readFileSync(file, "utf8");
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);

  if (!match) problems.push(`${file}: missing or unclosed frontmatter`);
  if (match && !/^(name|description):/m.test(match[1])) problems.push(`${file}: frontmatter has neither name nor description`);
  if (match && /<example>/.test(match[1])) problems.push(`${file}: <example> inside frontmatter breaks YAML`);
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`ok: ${marketplace.plugins.length} plugins, manifests and frontmatter are consistent`);

/**
 * SKILL.md files and agent definitions under a directory.
 *
 * @param {string} root
 * @returns {string[]}
 */
function markdownWithFrontmatter(root) {
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((path) => /(^|\/)SKILL\.md$/.test(path) || /(^|\/)agents\/[^/]+\.md$/.test(path))
    .filter((path) => !path.includes("/references/") && !path.includes("docs/"))
    .map((path) => join(root, path));
}
