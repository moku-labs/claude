/**
 * Asset manifest helpers: what makes generated art reproducible.
 */

/**
 * Add provenance to the manifest Astra returned. Pure.
 *
 * @param {{ assets: Array<Record<string, unknown>> }} manifest
 * @param {{ model: string, backend: "codex" | "api", date: string }} provenance
 * @returns {{ generated: { model: string, backend: string, date: string }, assets: Array<Record<string, unknown>> }}
 * @example
 * stampManifest({ assets: [] }, { model: "gpt-6-astra", backend: "codex", date: "2026-09-19" }).generated.backend; // "codex"
 */
export function stampManifest(manifest, provenance) {
  return { generated: { ...provenance }, assets: manifest.assets ?? [] };
}
