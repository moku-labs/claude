import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { registerAgent, runningAgents } from "../../lib/hooks/agents.mjs";
import { linkPlanning } from "../../lib/hooks/worktree.mjs";
import { facts } from "../../lib/rails/commands.mjs";
import { laneOf, markPrompt } from "../../lib/rails/ledger.mjs";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "moku-rails");

/** Run the CLI inside a checkout and capture code plus output. */
function rails(root, ...args) {
  const run = spawnSync("node", [CLI, ...args, "--root", root], { encoding: "utf8" });
  return { code: run.status, text: `${run.stdout}${run.stderr}` };
}

/** @param {string} cwd @param {string[]} args */
function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

/**
 * An initialized project in a git repository, with two worktrees that got the link to its `.planning/`,
 * the way the SessionStart hook gives it to them.
 */
function projectWithWorktrees() {
  const main = realpathSync(mkdtempSync(join(tmpdir(), "moku-lanes-")));
  git(main, "init", "-q", "-b", "main");
  writeFileSync(join(main, "package.json"), JSON.stringify({ name: "habits", scripts: { test: 'node -e "process.exit(0)"' } }));
  writeFileSync(join(main, ".gitignore"), ".planning/\n");
  git(main, "add", "-A");
  git(main, "-c", "user.name=t", "-c", "user.email=t@example.test", "commit", "-q", "-m", "init");

  rails(main, "session", "start");
  mkdirSync(join(main, ".planning"), { recursive: true });
  writeFileSync(join(main, ".planning", "moku.md"), "type: consumer\nname: habits\n");

  const [first, second] = ["streak", "friends"].map((name) => {
    const tree = join(main, ".claude", "worktrees", name);
    git(main, "worktree", "add", "-q", "-b", name, tree);
    assert.equal(linkPlanning(tree), true);
    return tree;
  });

  return { main, first, second };
}

describe("moku-rails: two worktrees of one project work side by side", () => {
  it("a worktree is its own lane, the main checkout is the main lane", () => {
    const { main, first } = projectWithWorktrees();

    assert.equal(laneOf(main), "");
    assert.equal(laneOf(first), first);
  });

  it("a change inside build in one worktree does not stop another worktree from opening its own", () => {
    const { first, second } = projectWithWorktrees();
    assert.equal(rails(first, "open", "streak-midnight", "--size", "S", "--type", "fix", "--title", "Streak").code, 0);
    assert.equal(rails(first, "enter", "build").code, 0);

    const opened = rails(second, "open", "friends-list", "--size", "S", "--type", "feature", "--title", "Friends");
    assert.equal(opened.code, 0, opened.text);

    // No id is needed in either: each checkout has exactly one open change of its own
    assert.equal(rails(second, "enter", "build").code, 0);
    assert.match(rails(first, "pause", "--reason", "waiting").text, /Paused streak-midnight/);
    assert.match(rails(second, "continue").text, /Continuing friends-list/);
  });

  it("a change at build in one worktree does not open source writes in another", () => {
    const { first, second } = projectWithWorktrees();
    rails(first, "open", "streak-midnight", "--size", "S", "--type", "fix", "--title", "Streak");
    rails(first, "enter", "build");

    assert.equal(rails(first, "guard", "src/plugins/streak/index.ts").code, 0);
    const other = rails(second, "guard", "src/plugins/friends/index.ts");
    assert.equal(other.code, 2);
    assert.match(other.text, /No open change is at a writing station/);
  });

  it("a new request in one worktree does not unroute the other", () => {
    const { first, second } = projectWithWorktrees();
    for (const [tree, id] of [[first, "streak-midnight"], [second, "friends-list"]]) {
      rails(tree, "open", id, "--size", "S", "--type", "fix", "--title", id);
      rails(tree, "enter", "build");
    }

    markPrompt(first);

    assert.equal(facts(first).routed, false);
    assert.notEqual(facts(second).routed, false);
    assert.equal(rails(second, "guard", "src/plugins/friends/index.ts").code, 0);
    assert.match(rails(first, "guard", "src/plugins/streak/index.ts").text, /has not been routed yet/);
  });

  it("agents of one worktree do not count as running in another", () => {
    const { first, second } = projectWithWorktrees();

    registerAgent(first, { id: "agent-1", type: "moku:moku-builder" });

    assert.equal(runningAgents(first).length, 1);
    assert.equal(runningAgents(second).length, 0);
    assert.equal(facts(second).agentsRunning, false);
  });

  it("the stop gate of one worktree ignores a station left open in another", () => {
    const { first, second } = projectWithWorktrees();
    rails(first, "open", "streak-midnight", "--size", "S", "--type", "fix", "--title", "Streak");
    rails(first, "enter", "build");

    assert.equal(rails(first, "may-stop").code, 2);
    assert.equal(rails(second, "may-stop").code, 0);
  });

  it("status names the work of other checkouts without calling it a debt", () => {
    const { main, first, second } = projectWithWorktrees();
    rails(first, "open", "streak-midnight", "--size", "S", "--type", "fix", "--title", "Streak");
    rails(first, "enter", "build");

    const here = rails(second, "status").text;
    assert.match(here, /Rails: clean/);
    assert.match(here, new RegExp(`Elsewhere: streak-midnight is open in ${first.replaceAll("/", "\\/")}, inside "build"`));
    assert.match(rails(main, "status").text, /Elsewhere: streak-midnight/);
    assert.match(rails(first, "status").text, /streak-midnight \(S, fix\) is open/);
  });

  it("an id is unique across worktrees, and a change of another worktree is refused by name", () => {
    const { first, second } = projectWithWorktrees();
    rails(first, "open", "streak-midnight", "--size", "S", "--type", "fix", "--title", "Streak");

    assert.match(rails(second, "open", "streak-midnight", "--size", "S", "--type", "fix", "--title", "Again").text, /already exists in/);
    assert.match(rails(second, "enter", "build", "--change", "streak-midnight").text, /no change is open|belongs to the worktree/);
  });

  it("a change of a removed worktree is adopted where the work goes on", () => {
    const { main, first } = projectWithWorktrees();
    rails(first, "open", "streak-midnight", "--size", "S", "--type", "fix", "--title", "Streak");
    rails(first, "enter", "build");
    git(main, "worktree", "remove", "--force", first);
    rmSync(first, { recursive: true, force: true });

    assert.match(rails(main, "status").text, /That worktree is gone: move the change here with `moku-rails adopt streak-midnight`/);
    const adopted = rails(main, "adopt", "streak-midnight");
    assert.equal(adopted.code, 0, adopted.text);
    assert.match(adopted.text, /inside "build"/);
    assert.equal(rails(main, "guard", "src/plugins/streak/index.ts").code, 0);

    const saved = JSON.parse(readFileSync(join(main, ".planning", "state.json"), "utf8"));
    assert.equal(saved.changes.length, 1);
    assert.equal(saved.changes[0].worktree, undefined);
  });

  it("twelve saves at once from two worktrees lose nothing", async () => {
    const { first, second } = projectWithWorktrees();

    const runs = Array.from({ length: 12 }, (_, index) => {
      const tree = index % 2 === 0 ? first : second;
      return new Promise((done) => {
        spawn("node", [CLI, "open", `change-${index}`, "--size", "S", "--type", "fix", "--title", `c${index}`, "--root", tree]).on("close", done);
      });
    });
    await Promise.all(runs);

    const saved = JSON.parse(readFileSync(join(first, ".planning", "state.json"), "utf8"));
    assert.equal(saved.changes.length, 12);
    assert.equal(saved.changes.filter((change) => change.worktree === first).length, 6);
  });

  it("a ledger written before lanes existed reads as the main checkout's", () => {
    const { main, first } = projectWithWorktrees();
    const old = { version: 1, changes: [{ id: "old-one", title: "Old", type: "fix", size: "S", status: "open", station: "build", done: ["intake"], checklist: {}, paused: false }], ideas: [], turn: { promptAt: "2026-10-01T00:00:00.000Z", routed: true } };
    writeFileSync(join(main, ".planning", "state.json"), JSON.stringify(old));

    assert.equal(facts(main).changes.length, 1);
    assert.equal(facts(main).routed, true);
    assert.equal(facts(first).changes.length, 0);
  });
});
