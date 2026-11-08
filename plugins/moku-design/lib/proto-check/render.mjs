/**
 * The render half of the prototype check: open every state at every target size, describe each frame in a
 * line, and play every motion row to see that it moves. Cheap on purpose: DOM reads and a pair of
 * screenshots per motion, no model looks at a picture.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { parseSize } from "./contract.mjs";
import { wait } from "./cdp.mjs";

/** Reads one frame: words, size of the DOM, overflow, the acknowledged state, running animations. */
const PROBE = `(() => {
  const root = document.documentElement;
  const body = document.body;
  const text = (body ? body.innerText : "").trim();
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05; };
  const all = body ? [...body.querySelectorAll("*")] : [];
  const clipped = all.filter((el) => visible(el) && el.children.length === 0 && el.textContent.trim()
    && el.scrollWidth > el.clientWidth + 1 && ["hidden", "clip"].includes(getComputedStyle(el).overflowX)
    && getComputedStyle(el).textOverflow !== "ellipsis").length;
  const heads = [...document.querySelectorAll("h1,h2,h3,[role=heading],[role=dialog] *:first-child,button")]
    .filter(visible).map((el) => (el.innerText ?? el.textContent ?? "").trim().split("\\n")[0]).filter(Boolean).slice(0, 6);
  let hash = 0; for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return { lines: text ? text.split("\\n").filter(Boolean).length : 0, nodes: all.length,
    overflowX: root.scrollWidth > innerWidth + 1, clipped, heads, textHash: hash,
    animations: document.getAnimations().length, ack: root.dataset.state ?? null,
    play: root.dataset.play ?? null };
})()`;

/**
 * Milliseconds in a duration cell such as `320ms`, `0.4s` or `260–420 ms`; 300 when it cannot be read.
 *
 * @param {unknown} cell - The duration column.
 * @returns {number}
 */
export function durationMs(cell) {
  const match = /(\d+(?:\.\d+)?)(?:\s*[–-]\s*\d+(?:\.\d+)?)?\s*(ms|s)\b/.exec(String(cell ?? ""));
  if (!match) return 300;
  return match[2] === "s" ? Number(match[1]) * 1000 : Number(match[1]);
}

/**
 * Builds the URL of one frame.
 *
 * @param {string} file - The concept file.
 * @param {Record<string, string | undefined>} params - Query parameters; undefined ones are left out.
 * @returns {string}
 */
export function frameUrl(file, params) {
  const url = pathToFileURL(file);
  for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, value);
  return url.href;
}

/**
 * Opens every state at every size, then plays every motion row at the first size.
 *
 * @param {import("./cdp.mjs").Page} page - A launched page.
 * @param {string} file - The concept file.
 * @param {any} contract - The parsed design contract.
 * @param {{ out?: string }} [options] - Where to save one PNG per frame.
 * @returns {Promise<{ frames: any[], motion: any[], frozen?: boolean, reduced?: any, findings: string[], warnings: string[] }>}
 */
export async function renderCheck(page, file, contract, options = {}) {
  const findings = [];
  const warnings = [];
  const frames = [];
  const viewports = (contract.viewports ?? []).filter((viewport) => parseSize(viewport.size));
  const states = contract.states ?? [];

  // Every state at every target size
  for (const viewport of viewports) {
    const { width, height } = parseSize(viewport.size);
    await page.size(width, height);
    const seen = new Map();

    for (const state of states) {
      page.errors = [];
      await page.goto(frameUrl(file, { state: state.id, vp: viewport.size }));
      const frame = { vp: viewport.size, state: state.id, ...(await page.evaluate(PROBE)), errors: [...page.errors] };
      frames.push(frame);
      if (options.out) writeFileSync(join(options.out, `${viewport.id ?? viewport.size}-${state.id}.png`.replace(/[^\w.-]+/g, "_")), Buffer.from(await page.screenshot(), "base64"));

      const where = `${viewport.size} ?state=${state.id}`;
      if (frame.errors.length > 0) findings.push(`${where}: console errors: ${frame.errors.slice(0, 2).join(" | ")}`);
      if (frame.nodes < 5 && frame.lines === 0) findings.push(`${where}: the page is empty`);
      if (frame.overflowX) findings.push(`${where}: horizontal scroll`);
      if (frame.clipped > 0) warnings.push(`${where}: ${frame.clipped} text element(s) cut off`);
      if (frame.ack !== state.id) findings.push(`${where}: the prototype did not open this state (documentElement.dataset.state is "${frame.ack}")`);
      if (seen.has(frame.textHash) && frame.ack === state.id) warnings.push(`${where}: same words as ?state=${seen.get(frame.textHash)}`);
      seen.set(frame.textHash, state.id);
    }
  }

  // Every motion row plays and moves
  const first = viewports[0];
  const motion = [];
  if (first) {
    const { width, height } = parseSize(first.size);
    await page.size(width, height);
    for (const row of contract.motion ?? []) {
      motion.push(await playRow(page, file, first.size, row, findings));
    }
  }

  const signature = (contract.motion ?? []).find((row) => row.id === contract.signature);
  const result = { frames, motion, findings, warnings };

  // ?t= pauses the signature moment, so the frame can be captured
  if (first && signature) {
    page.errors = [];
    await page.goto(frameUrl(file, { state: signature.state, vp: first.size, play: signature.id, t: String(Math.round(durationMs(signature.duration) / 2)) }), 150);
    const a = await page.screenshot();
    await wait(250);
    const b = await page.screenshot();
    result.frozen = a === b;
    if (!result.frozen) findings.push(`?play=${signature.id}&t=…: the frame keeps moving; ?t= has to pause every animation at that time`);
  }

  // Reduced motion opens without errors
  if (first && signature) {
    const { width, height } = parseSize(first.size);
    await page.size(width, height, true);
    page.errors = [];
    await page.goto(frameUrl(file, { state: signature.state, vp: first.size, play: signature.id }), 120);
    result.reduced = { errors: [...page.errors], animations: (await page.evaluate(PROBE)).animations };
    if (result.reduced.errors.length > 0) findings.push(`reduced motion: console errors: ${result.reduced.errors[0]}`);
  }

  return result;
}

/**
 * Plays one motion row and looks twice: does the prototype know the id, and does anything move.
 *
 * @param {import("./cdp.mjs").Page} page - The page.
 * @param {string} file - The concept file.
 * @param {string} size - The `?vp=` size.
 * @param {any} row - The motion row.
 * @param {string[]} findings - Where problems go.
 * @returns {Promise<{ id: string, known: boolean, live: boolean, animations: number }>}
 */
async function playRow(page, file, size, row, findings) {
  page.errors = [];
  await page.goto(frameUrl(file, { state: row.state, vp: size, play: row.id }), 40);
  const a = await page.screenshot();
  const probe = await page.evaluate(PROBE);
  await wait(Math.min(Math.max(durationMs(row.duration) / 2, 120), 500));
  const b = await page.screenshot();

  const known = probe.play === row.id;
  const live = known && (probe.animations > 0 || a !== b);
  if (!known) findings.push(`?play=${row.id}: the prototype does not know this motion (documentElement.dataset.play is "${probe.play}")`);
  if (known && !live) findings.push(`?play=${row.id}: nothing moves`);
  if (page.errors.length > 0) findings.push(`?play=${row.id}: console errors: ${page.errors[0]}`);
  return { id: row.id, known, live, animations: probe.animations };
}

/**
 * One line per frame, for the generator and the orchestrator to read instead of looking at pictures.
 *
 * @param {any} frame - A frame of `renderCheck`.
 * @returns {string}
 */
export function describeFrame(frame) {
  const flags = [
    frame.overflowX ? "HORIZONTAL SCROLL" : "",
    frame.clipped ? `${frame.clipped} cut off` : "",
    frame.errors.length ? `${frame.errors.length} errors` : "",
    frame.ack === frame.state ? "" : "STATE NOT OPENED"
  ].filter(Boolean);
  const heads = frame.heads.length ? ` — ${frame.heads.map((head) => `"${head.slice(0, 28)}"`).join(", ")}` : "";
  return `${frame.vp} ?state=${frame.state}: ${frame.lines} lines, ${frame.nodes} nodes, ${frame.animations} running${heads}${flags.length ? ` [${flags.join(", ")}]` : ""}`;
}
