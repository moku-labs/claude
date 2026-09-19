/**
 * The user's `rails` plugin option, as the hooks see it.
 */

const MODES = new Set(["strict", "warn", "off"]);

/**
 * `strict`, `warn` or `off`. Anything else, including a typo, is `strict`: a guard never turns off by accident.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {"strict" | "warn" | "off"}
 * @example
 * railsMode({ CLAUDE_PLUGIN_OPTION_RAILS: "of" }); // "strict"
 */
export function railsMode(env = process.env) {
  const value = String(env.CLAUDE_PLUGIN_OPTION_RAILS ?? "strict").toLowerCase();

  return /** @type {"strict" | "warn" | "off"} */ (MODES.has(value) ? value : "strict");
}
