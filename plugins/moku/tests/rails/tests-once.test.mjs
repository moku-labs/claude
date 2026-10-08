import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { linkPlanning } from "../../lib/hooks/worktree.mjs";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "moku-rails");

/** Run the CLI inside a project directory and capture code plus output. */
function rails(root, ...args) {
  const run = spawnSync("node", [CLI, ...args, "--root", root], { encoding: "utf8" });
  return { code: run.status, text: `${run.stdout}${run.stderr}` };
}

/** @param {string} cwd @param {string[]} args */
function git(cwd, ...args) {
  return execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.test", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

/**
 * An initialized project whose test script counts its own runs. The count and the switch that turns the
 * script red live outside the project, so a run never touches the tree. With `repo`, everything is
 * committed, the ledger included: the rails write it on every command, and that must not dirty the tree.
 * With `ignored`, `.planning/` is in `.gitignore` instead, the way a project with worktrees keeps it.
 */
function project({ repo = true, ignored = false } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "moku-once-")));
  const outside = realpathSync(mkdtempSync(join(tmpdir(), "moku-once-runs-")));
  const count = join(outside, "runs");
  const red = join(outside, "red");

  const script = `const fs = require("node:fs"); fs.appendFileSync(${JSON.stringify(count)}, "x"); process.exit(fs.existsSync(${JSON.stringify(red)}) ? 1 : 0);`;
  writeFileSync(join(root, "test.cjs"), script);
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "habits", scripts: { test: "node test.cjs" } }));

  rails(root, "session", "start");
  mkdirSync(join(root, ".planning"), { recursive: true });
  writeFileSync(join(root, ".planning", "moku.md"), "type: consumer\nname: habits\n");

  if (ignored) writeFileSync(join(root, ".gitignore"), ".planning/\n");
  if (repo) {
    git(root, "init", "-q", "-b", "main");
    commit(root, "init");
  }

  return {
    root,
    runs: () => (existsSync(count) ? readFileSync(count, "utf8").length : 0),
    turnRed: () => writeFileSync(red, ""),
    turnGreen: () => rmSync(red, { force: true }),
  };
}

/** @param {string} root @param {string} message */
function commit(root, message) {
  git(root, "add", "-A");
  git(root, "commit", "-q", "--allow-empty", "-m", message);
}

/** Open a small fix and walk it to the point where only the closing checklist is left. */
function built(root, id) {
  assert.equal(rails(root, "open", id, "--size", "S", "--type", "fix").code, 0, `open ${id}`);
  for (const station of ["build", "verify"]) {
    assert.equal(rails(root, "enter", station, "--change", id).code, 0, `enter ${station}`);
    assert.equal(rails(root, "done", station, "--change", id).code, 0, `done ${station}`);
  }
}

/** Confirm the whole checklist of one change and close it; returns the answer of `check tests`. */
function close(root, id) {
  const tests = rails(root, "check", "tests", "--change", id);
  rails(root, "check", "verify", "--change", id);
  rails(root, "check", "docs", "--change", id);
  assert.equal(rails(root, "close", "--change", id).code, 0, `close ${id}: ${tests.text}`);

  return tests;
}

describe("moku-rails check tests: one green run per tree", () => {
  it("runs the script once for two changes closed on one commit, and says so", () => {
    const { root, runs } = project();
    built(root, "2026-10-08-first");
    built(root, "2026-10-08-second");

    const first = close(root, "2026-10-08-first");
    const second = close(root, "2026-10-08-second");

    assert.equal(runs(), 1);
    assert.doesNotMatch(first.text, /not run again/);
    assert.match(second.text, new RegExp(`Checklist "tests" confirmed for 2026-10-08-second \\(green on ${git(root, "rev-parse", "HEAD").slice(0, 7)}, not run again\\)\\.`));
  });

  it("runs the script again after a new commit", () => {
    const { root, runs } = project();
    built(root, "2026-10-08-first");
    built(root, "2026-10-08-second");

    close(root, "2026-10-08-first");
    writeFileSync(join(root, "streak.js"), "export const streak = 1;\n");
    commit(root, "streak");
    const second = close(root, "2026-10-08-second");

    assert.equal(runs(), 2);
    assert.doesNotMatch(second.text, /not run again/);
  });

  it("runs the script every time while a tracked file is edited and not committed", () => {
    const { root, runs } = project();
    built(root, "2026-10-08-first");
    built(root, "2026-10-08-second");
    writeFileSync(join(root, "package.json"), `${readFileSync(join(root, "package.json"), "utf8")}\n`);

    close(root, "2026-10-08-first");
    close(root, "2026-10-08-second");

    assert.equal(runs(), 2);
  });

  it("counts an untracked file as an edit", () => {
    const { root, runs } = project();
    built(root, "2026-10-08-first");
    built(root, "2026-10-08-second");
    writeFileSync(join(root, "new.test.js"), "");

    close(root, "2026-10-08-first");
    close(root, "2026-10-08-second");

    assert.equal(runs(), 2);
  });

  it("an edit after a green run runs the script again, on the same commit", () => {
    const { root, runs } = project();
    built(root, "2026-10-08-first");
    built(root, "2026-10-08-second");

    close(root, "2026-10-08-first");
    writeFileSync(join(root, "test.cjs"), `${readFileSync(join(root, "test.cjs"), "utf8")}\n`);
    close(root, "2026-10-08-second");

    assert.equal(runs(), 2);
  });

  it("a red run clears the remembered commit", () => {
    const { root, runs, turnRed, turnGreen } = project({ ignored: true });
    const green = git(root, "rev-parse", "HEAD");
    built(root, "2026-10-08-first");
    built(root, "2026-10-08-second");
    close(root, "2026-10-08-first");

    // Red on a new commit
    commit(root, "breaks");
    turnRed();
    const verdict = rails(root, "check", "tests", "--change", "2026-10-08-second");
    assert.equal(verdict.code, 2);
    assert.match(verdict.text, /test script is red/);
    assert.equal(rails(root, "close", "--change", "2026-10-08-second").code, 2);

    // Back on the commit that was green: it is not trusted any more
    turnGreen();
    git(root, "reset", "-q", "--hard", green);
    const again = rails(root, "check", "tests", "--change", "2026-10-08-second");

    assert.equal(again.code, 0);
    assert.doesNotMatch(again.text, /not run again/);
    assert.equal(runs(), 3);
  });

  it("runs the script every time outside a git repository", () => {
    const { root, runs } = project({ repo: false });
    built(root, "2026-10-08-first");
    built(root, "2026-10-08-second");

    close(root, "2026-10-08-first");
    close(root, "2026-10-08-second");

    assert.equal(runs(), 2);
  });

  it("each worktree remembers its own commit", () => {
    const { root, runs } = project({ ignored: true });
    const tree = join(root, ".claude", "worktrees", "streak");
    git(root, "worktree", "add", "-q", "-b", "streak", tree);
    assert.equal(linkPlanning(tree), true);
    built(root, "2026-10-08-main-a");
    built(root, "2026-10-08-main-b");
    built(tree, "2026-10-08-lane-a");
    built(tree, "2026-10-08-lane-b");

    close(root, "2026-10-08-main-a");
    close(tree, "2026-10-08-lane-a");
    const main = close(root, "2026-10-08-main-b");
    const lane = close(tree, "2026-10-08-lane-b");

    assert.equal(runs(), 2, "one run in the main checkout, one in the worktree");
    assert.match(main.text, /not run again/);
    assert.match(lane.text, /not run again/);
  });
});
