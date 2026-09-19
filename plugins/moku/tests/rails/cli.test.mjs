import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "moku-rails");

/** Run the CLI inside a project directory and capture code plus output. */
function rails(root, ...args) {
  const run = spawnSync("node", [CLI, ...args, "--root", root], { encoding: "utf8" });
  return { code: run.status, text: `${run.stdout}${run.stderr}` };
}

/** A temp project. `initialized` writes the marker the init station leaves behind. */
function project({ initialized }) {
  const root = mkdtempSync(join(tmpdir(), "moku-rails-"));
  if (initialized) {
    mkdirSync(join(root, ".planning"), { recursive: true });
    writeFileSync(join(root, ".planning", "moku.md"), "type: consumer\nname: habits\n");
  }
  return root;
}

describe("moku-rails: the habit tracker walkthrough", () => {
  it("refuses to write a plugin into an empty directory", () => {
    const root = project({ initialized: false });

    const verdict = rails(root, "guard", "src/plugins/streak/index.ts");

    assert.equal(verdict.code, 2);
    assert.match(verdict.text, /not initialized/);
  });

  it("refuses 'straight to code' on a medium change and names plan as the next step", () => {
    const root = project({ initialized: true });
    rails(root, "open", "2026-09-19-habits", "--size", "M", "--type", "project", "--title", "Habit tracker");
    rails(root, "enter", "intake");
    rails(root, "done", "intake");

    const verdict = rails(root, "enter", "build");

    assert.equal(verdict.code, 2);
    assert.match(verdict.text, /Next step: plan/);
  });

  it("walks a small fix from intake to close", () => {
    const root = project({ initialized: true });
    rails(root, "open", "2026-09-26-streak-midnight", "--size", "S", "--type", "fix", "--title", "Streak breaks at midnight");

    for (const station of ["intake", "build", "verify"]) {
      assert.equal(rails(root, "enter", station).code, 0, `enter ${station}`);
      assert.equal(rails(root, "done", station).code, 0, `done ${station}`);
    }

    assert.equal(rails(root, "close").code, 2, "close must wait for the checklist");
    for (const item of ["tests", "verify", "docs"]) rails(root, "check", item);

    assert.equal(rails(root, "close").code, 0);
    assert.match(rails(root, "status").text, /Rails: clean/);
  });

  it("allows source writes only while the change is at a writing station", () => {
    const root = project({ initialized: true });
    rails(root, "open", "2026-09-26-fix", "--size", "S", "--type", "fix");

    assert.equal(rails(root, "guard", "src/plugins/streak/api.ts").code, 2);

    rails(root, "enter", "intake");
    rails(root, "done", "intake");
    rails(root, "enter", "build");

    assert.equal(rails(root, "guard", "src/plugins/streak/api.ts").code, 0);
  });

  it("blocks stopping mid-build unless the change is paused for the user", () => {
    const root = project({ initialized: true });
    rails(root, "open", "2026-09-26-fix", "--size", "S", "--type", "fix");
    rails(root, "enter", "intake");
    rails(root, "done", "intake");
    rails(root, "enter", "build");

    assert.equal(rails(root, "may-stop").code, 2);

    rails(root, "pause", "--reason", "waiting for the user");

    assert.equal(rails(root, "may-stop").code, 0);
  });

  it("refuses a new change while another is stuck inside a station, until it is parked", () => {
    const root = project({ initialized: true });
    rails(root, "open", "2026-09-20-first", "--size", "S", "--type", "fix");
    rails(root, "enter", "intake");

    assert.equal(rails(root, "open", "2026-09-21-second", "--size", "S", "--type", "fix").code, 2);

    rails(root, "park", "2026-09-20-first", "--reason", "blocked on upstream");

    assert.equal(rails(root, "open", "2026-09-21-second", "--size", "S", "--type", "fix").code, 0);
    assert.match(rails(root, "status").text, /parked/);
  });

  it("reports uncommitted work that no change accounts for", () => {
    const root = project({ initialized: true });
    execFileSync("git", ["init", "-q"], { cwd: root });
    writeFileSync(join(root, "stray.ts"), "export {};\n");

    assert.match(rails(root, "status").text, /dirty-tree/);
  });

  it("records the commit a change starts from, so verify can scope its diff", () => {
    const root = project({ initialized: true });
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "start"], { cwd: root });
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();

    rails(root, "open", "2026-09-26-fix", "--size", "S", "--type", "fix");

    assert.match(rails(root, "status", "--json").text, new RegExp(`"startCommit":"${head}"`));
  });

  it("keeps ideas in the backlog without opening a change", () => {
    const root = project({ initialized: true });

    rails(root, "idea", "compete", "with", "friends");

    assert.match(rails(root, "status").text, /1 idea/);
  });
});
