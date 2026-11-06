/**
 * A headless Chrome over the DevTools protocol with no dependencies: Node's own WebSocket and a Chrome or
 * Chromium already on the machine. Enough for the prototype check: open a page at a size, read the DOM,
 * take a screenshot, collect console errors.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const START_TIMEOUT_MS = 15_000;

/**
 * The Chrome binaries to try, the fastest first: `CHROME_PATH`, Playwright's headless shell, then a full
 * Chrome or Chromium.
 *
 * @returns {string[]}
 */
export function chromeCandidates() {
  const found = [];
  if (process.env.CHROME_PATH) found.push(process.env.CHROME_PATH);

  for (const cache of [join(homedir(), "Library/Caches/ms-playwright"), join(homedir(), ".cache/ms-playwright")]) {
    if (!existsSync(cache)) continue;
    const shells = readdirSync(cache).filter((name) => name.startsWith("chromium_headless_shell-")).sort().reverse();
    for (const shell of shells) {
      for (const sub of readdirSync(join(cache, shell))) found.push(join(cache, shell, sub, "chrome-headless-shell"));
    }
  }

  found.push(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  );
  return found;
}

/**
 * The first Chrome that exists, or undefined.
 *
 * @returns {string | undefined}
 */
export function findChrome() {
  return chromeCandidates().find((path) => existsSync(path));
}

/**
 * Starts a headless Chrome and opens one page in it.
 *
 * @param {string} binary - The Chrome to run.
 * @returns {Promise<Page>}
 */
export async function launch(binary) {
  const profile = mkdtempSync(join(tmpdir(), "moku-proto-check-"));
  const child = spawn(
    binary,
    [
      "--headless",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--hide-scrollbars",
      "--allow-file-access-from-files",
      "about:blank"
    ],
    { stdio: ["ignore", "ignore", "pipe"] }
  );

  const endpoint = await new Promise((resolve, reject) => {
    let seen = "";
    const timer = setTimeout(() => reject(new Error("Chrome did not start in 15 s")), START_TIMEOUT_MS);
    child.stderr.on("data", (chunk) => {
      seen += chunk;
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(seen);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.on("exit", (code) => reject(new Error(`Chrome exited with ${code} before it listened`)));
    child.on("error", (error) => reject(error));
  });

  const socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(new Error("cannot reach Chrome's DevTools socket")), { once: true });
  });

  const page = new Page(socket, () => {
    child.kill("SIGKILL");
    rmSync(profile, { recursive: true, force: true });
  });
  await page.open();
  return page;
}

/** One page of the headless Chrome, driven over a flattened DevTools session. */
export class Page {
  /**
   * @param {WebSocket} socket - The browser's DevTools socket.
   * @param {() => void} stop - Kills Chrome and removes its profile.
   */
  constructor(socket, stop) {
    this.socket = socket;
    this.stop = stop;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
    this.errors = [];
    socket.addEventListener("message", (event) => this.receive(JSON.parse(String(event.data))));
  }

  /**
   * Routes one DevTools message: a reply to its caller, an event to the listeners.
   *
   * @param {any} message - The parsed message.
   */
  receive(message) {
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
      return;
    }
    for (const listener of this.listeners) listener(message);
  }

  /**
   * Sends one DevTools command, to the page session unless `browser` is set.
   *
   * @param {string} method - The command.
   * @param {object} [params] - Its parameters.
   * @param {boolean} [browser] - Send to the browser target instead of the page.
   * @returns {Promise<any>}
   */
  send(method, params = {}, browser = false) {
    const id = this.nextId++;
    const message = { id, method, params };
    if (!browser) message.sessionId = this.session;
    this.socket.send(JSON.stringify(message));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  /** Creates the page target, attaches to it and starts collecting console errors. */
  async open() {
    const { targetId } = await this.send("Target.createTarget", { url: "about:blank" }, true);
    const { sessionId } = await this.send("Target.attachToTarget", { targetId, flatten: true }, true);
    this.session = sessionId;
    this.listeners.push((message) => this.collect(message));
    await this.send("Page.enable");
    await this.send("Runtime.enable");
    await this.send("Log.enable");
  }

  /**
   * Keeps the page's errors: uncaught exceptions, console.error, error log entries. A web font that cannot
   * load is not the prototype's error: the check may run offline.
   *
   * @param {any} message - A DevTools event.
   */
  collect(message) {
    if (message.sessionId !== this.session) return;
    const { method, params } = message;
    if (method === "Runtime.exceptionThrown") {
      this.errors.push(params.exceptionDetails?.exception?.description ?? params.exceptionDetails?.text ?? "exception");
    }
    if (method === "Runtime.consoleAPICalled" && params.type === "error") {
      this.errors.push(params.args.map((arg) => arg.value ?? arg.description ?? "").join(" "));
    }
    if (method === "Log.entryAdded" && params.entry.level === "error" && !/fonts\.(googleapis|gstatic)\.com/.test(params.entry.url ?? params.entry.text)) {
      this.errors.push(params.entry.text);
    }
  }

  /**
   * Sets the viewport and the reduced-motion preference.
   *
   * @param {number} width - CSS px.
   * @param {number} height - CSS px.
   * @param {boolean} [reduced] - Emulate `prefers-reduced-motion: reduce`.
   */
  async size(width, height, reduced = false) {
    await this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    await this.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" }]
    });
  }

  /**
   * Navigates and waits for the load event, then `settle` ms more for scripts and first animations.
   *
   * @param {string} url - The page.
   * @param {number} [settle] - Extra wait after load.
   */
  async goto(url, settle = 350) {
    const loaded = new Promise((resolve) => {
      const timer = setTimeout(resolve, 6000);
      const listener = (message) => {
        if (message.sessionId === this.session && message.method === "Page.loadEventFired") {
          clearTimeout(timer);
          this.listeners = this.listeners.filter((item) => item !== listener);
          resolve();
        }
      };
      this.listeners.push(listener);
    });
    await this.send("Page.navigate", { url });
    await loaded;
    await wait(settle);
  }

  /**
   * Evaluates an expression in the page and returns its value.
   *
   * @param {string} expression - JavaScript, returning a JSON-able value.
   * @returns {Promise<any>}
   */
  async evaluate(expression) {
    const { result, exceptionDetails } = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  }

  /**
   * A PNG of the viewport, base64.
   *
   * @returns {Promise<string>}
   */
  async screenshot() {
    const { data } = await this.send("Page.captureScreenshot", { format: "png" });
    return data;
  }

  /** Closes the socket and Chrome. */
  close() {
    try {
      this.socket.close();
    } finally {
      this.stop();
    }
  }
}

/**
 * Resolves after `ms`.
 *
 * @param {number} ms - Milliseconds.
 * @returns {Promise<void>}
 */
export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
