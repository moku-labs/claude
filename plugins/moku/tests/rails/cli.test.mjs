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

/** A temp project. `initialized` writes the marker the init station leaves behind; `tests` is its test script. */
function project({ initialized, tests = "node -e \"process.exit(0)\"" }) {
  const root = mkdtempSync(join(tmpdir(), "moku-rails-"));
  if (initialized) {
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "habits", dependencies: { "@moku-labs/core": "1.5.0" }, scripts: { test: tests } }));
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

    const verdict = rails(root, "enter", "build");

    assert.equal(verdict.code, 2);
    assert.match(verdict.text, /Next step: plan/);
  });

  it("walks a small fix from intake to close", () => {
    const root = project({ initialized: true });
    rails(root, "open", "2026-09-26-streak-midnight", "--size", "S", "--type", "fix", "--title", "Streak breaks at midnight");

    for (const station of ["build", "verify"]) {
      assert.equal(rails(root, "enter", station).code, 0, `enter ${station}`);
      assert.equal(rails(root, "done", station).code, 0, `done ${station}`);
    }

    assert.equal(rails(root, "close").code, 2, "close must wait for the checklist");
    for (const item of ["tests", "verify", "docs"]) rails(root, "check", item);

    assert.equal(rails(root, "close").code, 0);
    assert.match(rails(root, "status").text, /Rails: clean/);
  });

  it("refuses the tests checklist item while the test script is red, so the change cannot close", () => {
    const root = project({ initialized: true, tests: "node -e \"console.log('1 failed'); process.exit(1)\"" });
    rails(root, "open", "2026-09-26-red", "--size", "S", "--type", "fix");
    for (const station of ["build", "verify"]) {
      rails(root, "enter", station);
      rails(root, "done", station);
    }

    const verdict = rails(root, "check", "tests");
    assert.equal(verdict.code, 2);
    assert.match(verdict.text, /test script is red/);
    assert.match(verdict.text, /1 failed/);

    rails(root, "check", "verify");
    rails(root, "check", "docs");
    assert.equal(rails(root, "close").code, 2, "a red test script keeps the change open");
  });

  it("allows source writes only while the change is at a writing station", () => {
    const root = project({ initialized: true });
    rails(root, "open", "2026-09-26-fix", "--size", "S", "--type", "fix");

    assert.equal(rails(root, "guard", "src/plugins/streak/api.ts").code, 2);

    rails(root, "enter", "build");

    assert.equal(rails(root, "guard", "src/plugins/streak/api.ts").code, 0);
  });

  it("blocks stopping mid-build unless the change is paused for the user", () => {
    const root = project({ initialized: true });
    rails(root, "open", "2026-09-26-fix", "--size", "S", "--type", "fix");
    rails(root, "enter", "build");

    assert.equal(rails(root, "may-stop").code, 2);

    rails(root, "pause", "--reason", "waiting for the user");

    assert.equal(rails(root, "may-stop").code, 0);
  });

  it("refuses a new change while another is stuck inside a station, until it is parked", () => {
    const root = project({ initialized: true });
    rails(root, "open", "2026-09-20-first", "--size", "S", "--type", "fix");
    rails(root, "enter", "build");

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

  it("lets a directly invoked skill open a change and enter its station at once: opening is the intake", () => {
    const root = project({ initialized: true });

    assert.equal(rails(root, "enter", "build").code, 2, "no open change is a refusal, not a crash");
    assert.match(rails(root, "enter", "build").text, /Next step: open/);

    rails(root, "open", "2026-09-26-fix", "--size", "S", "--type", "fix");

    assert.equal(rails(root, "enter", "build").code, 0);
  });

  it("opens a window for the init station to scaffold src/, and closes it only once the marker exists", () => {
    const root = project({ initialized: false });
    writeFileSync(join(root, "package.json"), '{"dependencies":{"@moku-labs/core":"1.5.0"}}');

    assert.equal(rails(root, "guard", "src/config.ts").code, 2);

    rails(root, "init", "begin");

    assert.equal(rails(root, "guard", "src/config.ts").code, 0);
    assert.equal(rails(root, "init", "done").code, 2, "no marker yet");

    mkdirSync(join(root, ".planning"), { recursive: true });
    writeFileSync(join(root, ".planning", "moku.md"), "type: framework\n");

    assert.equal(rails(root, "init", "done").code, 0);
    assert.doesNotMatch(rails(root, "status").text, /Debt \[init\]/);
  });

  it("survives a corrupt ledger: it is set aside and the rails keep working", () => {
    const root = project({ initialized: true });
    writeFileSync(join(root, ".planning", "state.json"), "{ broken");

    const status = rails(root, "status");

    assert.equal(status.code, 0);
    assert.match(status.text, /not valid JSON/);
    assert.equal(rails(root, "guard", "src/main.ts").code, 2, "the guard still guards");
  });

  it("refuses shell writes into src/ that a Write would be refused, and ignores harmless commands", () => {
    const root = project({ initialized: false });

    assert.equal(rails(root, "guard-bash", "cat > src/plugins/streak/index.ts <<'EOF'").code, 2);
    assert.equal(rails(root, "guard-bash", "mkdir -p src/plugins/streak && touch src/plugins/streak/index.ts").code, 2);
    assert.equal(rails(root, "guard-bash", "ls src/plugins && bun test src/plugins/streak").code, 0);
    assert.equal(rails(root, "guard-bash", "echo done > .planning/notes.md").code, 0);
  });

  it("pausing with nothing open is a harmless no-op", () => {
    assert.equal(rails(project({ initialized: true }), "pause", "--reason", "x").code, 0);
  });

  it("keeps ideas in the backlog without opening a change", () => {
    const root = project({ initialized: true });

    rails(root, "idea", "compete", "with", "friends");

    assert.match(rails(root, "status").text, /1 idea/);
  });
});
