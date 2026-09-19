/**
 * Read the JSON payload Claude Code sends to a hook on stdin.
 */

import { readFileSync } from "node:fs";

/**
 * @returns {{ raw: string, payload: Record<string, any> }}
 * @example
 * const { payload } = readHookInput();
 * payload.tool_input?.file_path;
 */
export function readHookInput() {
  const raw = readFileSync(0, "utf8");

  try {
    return { raw, payload: JSON.parse(raw) };
  } catch {
    return { raw, payload: {} };
  }
}
