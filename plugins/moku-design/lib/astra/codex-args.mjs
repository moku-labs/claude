/**
 * Build the `codex exec` argument list for one Astra call.
 *
 * Pure. Encodes the two traps found while probing the CLI:
 * `-i` is greedy and swallows the prompt unless `--` separates it,
 * and the prompt must never be read from an open stdin.
 */

/** Model id of GPT-6 Astra in Codex. */
export const ASTRA_MODEL = "gpt-6-astra";

/**
 * @param {object} call
 * @param {string} call.prompt
 * @param {string[]} [call.images] screenshot paths
 * @param {string} [call.schema] JSON schema file the final message must satisfy
 * @param {string} call.output file that receives the final message
 * @param {"read-only" | "workspace-write"} call.sandbox
 * @param {string} [call.model]
 * @returns {string[]}
 * @example
 * codexArgs({ prompt: "Review", images: ["a.png"], schema: "s.json", output: "o.json", sandbox: "read-only" });
 * // ["exec", "-m", "gpt-6-astra", "--sandbox", "read-only", "--skip-git-repo-check",
 * //  "--output-schema", "s.json", "-o", "o.json", "-i", "a.png", "--", "Review"]
 */
export function codexArgs({ prompt, images = [], schema, output, sandbox, model = ASTRA_MODEL }) {
  const args = ["exec", "-m", model, "--sandbox", sandbox, "--skip-git-repo-check"];

  // Structured output first, so the image list is the last option before the separator
  if (schema) args.push("--output-schema", schema);
  args.push("-o", output);
  if (images.length > 0) args.push("-i", images.join(","));

  // `--` ends the greedy image list; without it the prompt is parsed as an image path
  args.push("--", prompt);

  return args;
}
