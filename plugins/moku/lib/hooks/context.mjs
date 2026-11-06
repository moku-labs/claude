/**
 * How much context the conversation carries, read from the tail of its transcript.
 */

import { closeSync, fstatSync, openSync, readSync } from "node:fs";

/** Above this the conductor offers `/compact` at a station boundary; `MOKU_COMPACT_HINT_TOKENS` overrides it. */
export const COMPACT_HINT_TOKENS = 400_000;

const TAIL_BYTES = 512 * 1024;

/**
 * The context of the newest API call in a transcript: input plus cache reads plus cache writes. Only the tail
 * of the file is read, so a transcript of hundreds of megabytes costs no more than a small one.
 *
 * @param {string | undefined} transcriptPath the `transcript_path` of a hook payload
 * @returns {number | undefined} tokens, or undefined when no usage is found or the file cannot be read
 * @example
 * lastContextTokens(payload.transcript_path); // 452118
 */
export function lastContextTokens(transcriptPath) {
  if (typeof transcriptPath !== "string" || !transcriptPath) return undefined;

  let text;
  try {
    const fd = openSync(transcriptPath, "r");
    try {
      const size = fstatSync(fd).size;
      const length = Math.min(size, TAIL_BYTES);
      const buffer = Buffer.alloc(length);
      readSync(fd, buffer, 0, length, size - length);
      text = buffer.toString("utf8");
    } finally {
      closeSync(fd);
    }
  } catch {
    return undefined;
  }

  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const usage = usageOf(lines[i]);
    if (usage) return (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
  }
  return undefined;
}

/**
 * The usage of one transcript line when it is an assistant message of the main thread, else undefined.
 *
 * @param {string} line
 * @returns {Record<string, number> | undefined}
 */
function usageOf(line) {
  if (!line.includes('"usage"')) return undefined;

  try {
    const entry = JSON.parse(line);
    if (entry.type !== "assistant" || entry.isSidechain) return undefined;
    return entry.message?.usage;
  } catch {
    return undefined;
  }
}

/**
 * The threshold in tokens: the environment override when it is a positive number, else the default.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number}
 * @example
 * compactThreshold({ MOKU_COMPACT_HINT_TOKENS: "300000" }); // 300000
 */
export function compactThreshold(env = process.env) {
  const value = Number(env.MOKU_COMPACT_HINT_TOKENS);
  return Number.isFinite(value) && value > 0 ? value : COMPACT_HINT_TOKENS;
}
