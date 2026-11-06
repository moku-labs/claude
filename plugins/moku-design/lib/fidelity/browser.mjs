/**
 * The headless side of the design check: a Chromium driven by the project's own playwright, a static server
 * for a folder, and one pass over every size × state of the spec.
 *
 * The check never installs anything. Playwright comes from `MOKU_PLAYWRIGHT` (a path to the module) or from
 * the project's `node_modules` (`playwright-core`, `playwright`, `@playwright/test`). Without it the CLI says so
 * and the checker runs the same probe in the browser pane (`moku-fidelity probe`), then `ingest`s the result.
 */

import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { extname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { pageProbe } from "./probe.mjs";

/** Exit code when no headless browser can run here. */
export const NO_BROWSER = 3;

/**
 * Playwright's `chromium`, from the project, or undefined.
 *
 * @param {string} cwd
 * @returns {Promise<any | undefined>}
 */
export async function loadChromium(cwd) {
  const candidates = [];
  if (process.env.MOKU_PLAYWRIGHT) candidates.push(process.env.MOKU_PLAYWRIGHT);
  const require = createRequire(join(resolve(cwd), "package.json"));
  for (const name of ["playwright-core", "playwright", "@playwright/test"]) {
    try {
      candidates.push(require.resolve(name));
    } catch {
      /* not in this project */
    }
  }

  for (const candidate of candidates) {
    try {
      const mod = await import(candidate.startsWith("/") ? pathToFileURL(candidate).href : candidate);
      const chromium = mod.chromium ?? mod.default?.chromium;
      if (chromium) return chromium;
    } catch {
      /* try the next */
    }
  }

  return undefined;
}

/**
 * Serve a folder on 127.0.0.1, so fonts and ES modules load as they would in the app.
 *
 * @param {string} root
 * @returns {Promise<{ url: string, close: () => void }>}
 */
export function serveFolder(root) {
  const base = resolve(root);
  const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".json": "application/json" };
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
    let file = join(base, path);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if ((file !== base && !file.startsWith(base + sep)) || !existsSync(file)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    createReadStream(file).pipe(res);
  });

  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}

/**
 * Start a dev command and wait until a URL answers. The process is killed by `stop()`.
 *
 * @param {string} command one shell command, such as `bun run dev`
 * @param {string} url
 * @param {string} cwd
 * @param {number} [timeoutMs]
 * @returns {Promise<{ stop: () => void }>}
 */
export async function startCommand(command, url, cwd, timeoutMs = 60_000) {
  const child = spawn(command, { cwd, shell: true, detached: true, stdio: "ignore" });
  const stop = () => {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  };

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return { stop };
    } catch {
      /* not up yet */
    }
    await new Promise((ok) => setTimeout(ok, 500));
  }

  stop();
  throw new Error(`nothing answered at ${url} within ${Math.round(timeoutMs / 1000)} s after "${command}"`);
}

/**
 * Measure one page at every size × state of the spec: one probe and one shot each.
 *
 * @param {any} chromium
 * @param {{ url: string, spec: any, elements: Record<string, any> | null, shots: string, side: "expected" | "actual", origin?: string }} options
 * @returns {Promise<Record<string, Record<string, Record<string, any>>>>} size id → state id → measurement
 */
export async function measureAll(chromium, { url, spec, elements, shots, side, origin }) {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const values = {};
  try {
    for (const size of spec.sizes) {
      const page = await browser.newPage({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1 });
      values[size.id] = {};
      for (const state of spec.states) {
        const query = side === "actual" ? (state.build?.query ?? state.query ?? "") : (state.query ?? "");
        await page.goto(joinQuery(url, query), { waitUntil: "load" });
        await settle(page, side === "actual" ? state.build?.run : undefined);
        values[size.id][state.id] = await page.evaluate(pageProbe, { elements, reference: spec.conversion.reference ?? 1080, origin: side === "expected" ? (state.origin ?? origin) : state.build?.origin });
        mkdirSync(join(shots, size.id), { recursive: true });
        await page.screenshot({ path: join(shots, size.id, `${state.id}.png`), clip: { x: 0, y: 0, width: size.w, height: size.h } });
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }

  return values;
}

/**
 * Freeze motion, wait for fonts and a canvas page's ready flag, then run the state's door commands (a game).
 *
 * @param {any} page
 * @param {{ command: string, input?: any }[] | undefined} run
 */
async function settle(page, run) {
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" }).catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForFunction(() => !document.querySelector("canvas") || document.body.dataset.ready === "1" || globalThis.doors !== undefined, null, { timeout: 8000 }).catch(() => {});
  for (const step of run ?? []) {
    await page.evaluate(async ({ command, input }) => globalThis.doors.run(globalThis.game, globalThis.doors.commands[command], input), step);
  }
  await page.waitForTimeout(200);
}

/**
 * @param {string} url
 * @param {string} query `?state=x` or `state=x` or empty
 */
function joinQuery(url, query) {
  if (!query) return url;
  const clean = query.replace(/^[?&]/, "");
  return `${url}${url.includes("?") ? "&" : "?"}${clean}`;
}
