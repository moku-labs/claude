/**
 * Tier expectations: which files a plugin of a given complexity tier must ship.
 *
 * Pure. Level 1 of the artifact verification asks this module what to look for,
 * and the caller does the filesystem work.
 */

/** @typedef {"nano" | "micro" | "standard" | "complex" | "very-complex"} Tier */

/** The tiers, in the order the plugin spec lists them. */
export const TIERS = ["nano", "micro", "standard", "complex", "very-complex"];

/** Domain files that are optional, but pull a unit test in with them when present. */
export const DOMAIN_FILES = ["state.ts", "api.ts", "handlers.ts", "helpers.ts"];

const TIER_ALIASES = {
  nano: "nano",
  micro: "micro",
  standard: "standard",
  complex: "complex",
  "very-complex": "very-complex",
  verycomplex: "very-complex",
  "very complex": "very-complex",
};

const SMALL_TIERS = new Set(["nano", "micro"]);

/**
 * Normalize a tier written by a human or read from a JSDoc header.
 *
 * @param {string | undefined | null} raw tier as written, any case
 * @returns {Tier | null} the canonical tier, or null when it is not a tier
 * @example
 * normalizeTier("VeryComplex"); // "very-complex"
 */
export function normalizeTier(raw) {
  if (typeof raw !== "string") return null;

  const key = raw.trim().toLowerCase();
  return TIER_ALIASES[key] ?? null;
}

/**
 * Read the tier out of a plugin `index.ts` header comment.
 *
 * @param {string} source the file's text
 * @returns {Tier | null} the declared tier, or null when the header does not name one
 * @example
 * readDeclaredTier("/** Tier: Standard *\/"); // "standard"
 */
export function readDeclaredTier(source) {
  const match = /tier\s*[:=]\s*([A-Za-z -]+)/i.exec(source);
  if (!match) return null;

  return normalizeTier(match[1]);
}

/**
 * Guess the tier from what the plugin directory actually contains.
 *
 * A directory with domain files is Standard at least; a flat single file is Micro.
 * Callers prefer an explicit `--tier` or the declared tier over this guess.
 *
 * @param {string[]} files paths relative to the plugin directory
 * @returns {Tier}
 * @example
 * inferTier(["index.ts", "api.ts", "types.ts"]); // "standard"
 */
export function inferTier(files) {
  const hasDomainFile = files.some((file) => DOMAIN_FILES.includes(file));
  const hasSubModule = files.some((file) => /^[^/]+\/[^/]+\.ts$/.test(file) && !file.startsWith("__tests__/"));

  if (hasSubModule) return "complex";
  if (hasDomainFile) return "standard";
  return "micro";
}

/**
 * The files a plugin of this tier must ship.
 *
 * `required` always applies. `conditional` maps a file that may or may not exist
 * to the test file it requires once it does.
 *
 * @param {Tier} tier canonical tier
 * @param {string} name plugin name, used for the integration test path
 * @returns {{ required: string[], conditional: Array<{ when: string, then: string }> }}
 * @example
 * expectedFiles("nano", "streak").required; // ["index.ts", "README.md", "__tests__/unit/index.test.ts"]
 */
export function expectedFiles(tier, name) {
  // Small tiers are one file plus its test
  if (SMALL_TIERS.has(tier)) {
    return { required: ["index.ts", "README.md", "__tests__/unit/index.test.ts"], conditional: [] };
  }

  // Standard and up: shared types, an integration test, a unit test per domain file
  const required = ["index.ts", "types.ts", "README.md", `__tests__/integration/${name}.test.ts`];
  const conditional = DOMAIN_FILES.map((file) => ({ when: file, then: `__tests__/unit/${file.replace(/\.ts$/, ".test.ts")}` }));

  return { required, conditional };
}
