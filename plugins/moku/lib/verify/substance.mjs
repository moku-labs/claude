/**
 * Level 2: is a file a real implementation or a stub.
 *
 * Pure text analysis. The caller reads the file; this module judges the text,
 * so the rules stay testable without a filesystem.
 */

/** @typedef {{ stub: boolean, realLines: number, reasons: string[] }} Substance */

/** A source file below this many real lines carries no implementation. */
export const MIN_REAL_LINES = 3;

/** A test file below this many real lines cannot be exercising much. */
export const MIN_TEST_LINES = 3;

const NOT_IMPLEMENTED = /throw\s+new\s+Error\(\s*["'`][^"'`]*not\s+implemented/i;
const EMPTY_ARROW_BODIES = /=>\s*\{\s*\}/g;
const PLACEHOLDER_RETURN = /^return\s*(null|\{\}|\[\]|undefined)\s*;?$/;
const ASSERTION = /\b(expect|expectTypeOf|assert)\s*[.(]/;
const EMPTY_ASSERTION = /expect\(\s*(true|1)\s*\)\.toBe\(\s*(true|1)\s*\)/;

/**
 * The lines that carry implementation: no blanks, no comments, no imports.
 *
 * @param {string} source file text
 * @returns {string[]} trimmed real lines
 * @example
 * realLines("// a\nimport x from 'y';\nconst a = 1;"); // ["const a = 1;"]
 */
export function realLines(source) {
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith("//") && !line.startsWith("*") && !line.startsWith("/*") && !line.startsWith("*/"))
    .filter((line) => !line.startsWith("import ") && !line.startsWith("export type {") && line !== "}" && line !== "};" && line !== "});");
}

/**
 * Judge a source file: real implementation, or a stub wearing a filename.
 *
 * @param {string} source file text
 * @returns {Substance}
 * @example
 * judgeSource("export const api = () => {};").stub; // true
 */
export function judgeSource(source) {
  const lines = realLines(source);
  const reasons = [];

  // The three shapes a placeholder takes
  if (NOT_IMPLEMENTED.test(source)) reasons.push("throws \"not implemented\"");
  // One empty body among real logic is idiomatic (`destroy: () => {}`); only a short file made of them is a stub
  const emptyBodies = source.match(EMPTY_ARROW_BODIES)?.length ?? 0;
  if (emptyBodies > 0 && lines.length < MIN_REAL_LINES * 2) reasons.push("empty function body");
  if (lines.length > 0 && lines.every((line) => PLACEHOLDER_RETURN.test(line))) reasons.push("placeholder return only");

  // A body that is only a TODO, or is too short to hold logic
  const todoOnly = lines.length === 0 && /\b(TODO|FIXME)\b/.test(source);
  if (todoOnly) reasons.push("TODO comment is the whole file");
  if (lines.length < MIN_REAL_LINES && !todoOnly) reasons.push(`only ${lines.length} real line(s), minimum ${MIN_REAL_LINES}`);

  return { stub: reasons.length > 0, realLines: lines.length, reasons };
}

/**
 * Judge a test file: does it assert anything worth asserting.
 *
 * @param {string} source test file text
 * @returns {Substance}
 * @example
 * judgeTest("it('works', () => { expect(true).toBe(true); });").stub; // true
 */
export function judgeTest(source) {
  const lines = realLines(source);
  const reasons = [];

  // A test without assertions proves nothing, and a tautology proves less
  if (!ASSERTION.test(source)) reasons.push("no assertions");
  else if (EMPTY_ASSERTION.test(source) && source.split(/\bexpect\s*\(/).length === 2) reasons.push("only a tautological assertion");

  if (lines.length < MIN_TEST_LINES) reasons.push(`only ${lines.length} real line(s), minimum ${MIN_TEST_LINES}`);

  return { stub: reasons.length > 0, realLines: lines.length, reasons };
}
