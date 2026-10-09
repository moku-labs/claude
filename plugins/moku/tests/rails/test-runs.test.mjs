import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { appendRun, earlierRun, fullKey, readRuns, slowThreshold, startRun, summarize, takeStart, testCommand, treeKey } from "../../lib/rails/test-runs.mjs";

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
 * A committed project with a moku session. Its `test` script prints what `node --test` prints, with one
 * test that takes `slowMs`, and turns red while the file `red` exists outside the project.
 */
function project({ scripts = {}, slowMs = 5 } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "moku-runs-")));
  const red = join(realpathSync(mkdtempSync(join(tmpdir(), "moku-runs-red-"))), "red");

  const script = `const red = require("node:fs").existsSync(${JSON.stringify(red)}); console.log("✔ counts a day (0.4ms)\\n✔ boots the app (${slowMs}ms)\\nℹ tests 2\\nℹ pass " + (red ? 1 : 2) + "\\nℹ fail " + (red ? 1 : 0) + "\\nℹ duration_ms 12"); process.exit(red ? 1 : 0);`;
  writeFileSync(join(root, "test.cjs"), script);
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "habits", scripts: { test: "node test.cjs", ...scripts } }));
  writeFileSync(join(root, ".gitignore"), ".planning/\n.claude/\n");

  rails(root, "session", "start");
  writeFileSync(join(root, ".planning", "moku.md"), "type: consumer\nname: habits\n");
  git(root, "init", "-q", "-b", "main");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "init");

  return { root, turnRed: () => writeFileSync(red, ""), turnGreen: () => rmSync(red, { force: true }) };
}

/** Open a small fix and walk it to the point where only the closing checklist is left. */
function built(root, id = "2026-10-09-fix") {
  assert.equal(rails(root, "open", id, "--size", "S", "--type", "fix").code, 0, `open ${id}`);
  for (const station of ["build", "verify"]) {
    assert.equal(rails(root, "enter", station, "--change", id).code, 0, `enter ${station}`);
    assert.equal(rails(root, "done", station, "--change", id).code, 0, `done ${station}`);
  }
}

/** A log line with the fields a test does not care about filled in. */
function run(fields) {
  return { at: "2026-10-09T10:00:00.000Z", command: "bun run test", key: "vitest run", scope: "full", outcome: "green", by: "agent", ...fields };
}

describe("testCommand", () => {
  const scripts = { test: "bun --bun vitest run", "test:unit": "vitest run --project unit", "test:all": "bun run test:unit && bun run test:e2e", "test:e2e": "playwright test", lint: "biome check ." };
  const { root } = project({ scripts });

  it("names a script by what it starts, so the script and the runner typed by hand are one command", () => {
    for (const line of ["bun run test", "npm test", "node --run test", "bunx vitest run", "CI=1 bun --bun vitest run", "cd . && pnpm test 2>&1 | tail -5"]) {
      assert.deepEqual([testCommand(line, root).key, testCommand(line, root).scope], ["vitest run", "full"], line);
    }
  });

  it("calls everything else a subset: a path, a project, another script", () => {
    assert.deepEqual([testCommand("bunx vitest run src/plugins/ui", root).key, testCommand("bunx vitest run src/plugins/ui", root).scope], ["vitest run src/plugins/ui", "subset"]);
    assert.equal(testCommand("bun run test:unit", root).key, "vitest run --project unit");
    assert.equal(testCommand("bun run test -- src/a.test.ts", root).key, "vitest run src/a.test.ts");
    assert.equal(testCommand("bun run test:all", root).key, "vitest run --project unit && playwright test");
    assert.equal(testCommand("bun test tests/a.test.ts", root).key, "bun test tests/a.test.ts");
  });

  it("keeps the command as typed, without its wrappers and what surrounds it", () => {
    assert.equal(testCommand("cd app && CI=1 bun run test:unit 2>&1 | tail -5", root).command, "bun run test:unit");
    assert.equal(testCommand("bun run test:unit && bun run test:e2e", root).command, "bun run test:unit && bun run test:e2e");
  });

  it("knows the exit status only of a plain `&&` chain", () => {
    assert.equal(testCommand("cd app && bun run test 2>&1", root).exitKnown, true);
    assert.equal(testCommand("bun run test | tail -5", root).exitKnown, false);
    assert.equal(testCommand("bun run test; echo done", root).exitKnown, false);
    assert.equal(testCommand("bun run test || true", root).exitKnown, false);
  });

  it("sees no test in other commands, in a watch mode, or in a test command that is only quoted", () => {
    for (const line of ["bun run lint", "git commit -m 'bun run test'", "vitest --watch", "vitest watch", "grep -rn 'bun test' docs/", "moku-rails check tests", "bun install"]) {
      assert.equal(testCommand(line, root), undefined, line);
    }
  });

  it("has no full script in a project without a test script", () => {
    const bare = realpathSync(mkdtempSync(join(tmpdir(), "moku-runs-bare-")));

    assert.equal(fullKey(bare), undefined);
    assert.equal(testCommand("bun test", bare).scope, "subset");
  });
});

describe("treeKey", () => {
  it("is the same for the same files and another one after an edit or a new file", () => {
    const { root } = project();
    const clean = treeKey(root);

    assert.match(clean, /^[0-9a-f]{40}$/);
    assert.equal(treeKey(root), clean);

    writeFileSync(join(root, "streak.ts"), "export const a = 1;\n");
    const edited = treeKey(root);
    assert.notEqual(edited, clean);

    writeFileSync(join(root, "streak.ts"), "export const a = 2;\n");
    assert.notEqual(treeKey(root), edited);

    rmSync(join(root, "streak.ts"));
    assert.equal(treeKey(root), clean, "back to the first files, back to the first key");
  });

  it("does not change with a commit of the same files", () => {
    const { root } = project();
    writeFileSync(join(root, "streak.ts"), "export const a = 1;\n");
    const before = treeKey(root);

    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "streak");

    assert.equal(treeKey(root), before);
    assert.equal(git(root, "rev-parse", "HEAD^{tree}"), before);
  });

  it("ignores .planning, leaves the index alone and writes no object into the repository", () => {
    const { root } = project();
    const objects = () => readdirSync(join(root, ".git", "objects"), { recursive: true }).length;
    const before = [treeKey(root), objects(), git(root, "status", "--porcelain")];

    writeFileSync(join(root, "streak.ts"), "export const a = 1;\n");
    writeFileSync(join(root, ".planning", "notes.md"), "local\n");
    treeKey(root);

    assert.equal(objects(), before[1]);
    assert.equal(git(root, "status", "--porcelain"), "?? streak.ts");

    rmSync(join(root, "streak.ts"));
    assert.equal(treeKey(root), before[0]);
  });

  it("names nothing outside a repository", () => {
    assert.equal(treeKey(realpathSync(mkdtempSync(join(tmpdir(), "moku-runs-plain-")))), undefined);
  });
});

describe("earlierRun", () => {
  const test = { command: "bun run test", key: "vitest run", scope: "full", exitKnown: true };
  const part = { command: "bunx vitest run src/ui", key: "vitest run src/ui", scope: "subset", exitKnown: true };

  it("finds the same command on the same tree, and nothing on another tree or without a tree", () => {
    const runs = [run({ tree: "aaa" })];

    assert.equal(earlierRun(runs, test, "aaa"), runs[0]);
    assert.equal(earlierRun(runs, test, "bbb"), undefined);
    assert.equal(earlierRun(runs, test, undefined), undefined);
    assert.equal(earlierRun([run({})], test, undefined), undefined);
  });

  it("answers with the latest run, so a red run takes an earlier green one away", () => {
    const runs = [run({ tree: "aaa" }), run({ tree: "aaa", outcome: "red" })];

    assert.equal(earlierRun(runs, test, "aaa").outcome, "red");
  });

  it("does not let the whole script answer for a run that asks something else: coverage, a snapshot update", () => {
    const runs = [run({ tree: "aaa" })];
    const asks = (/** @type {string} */ key) => earlierRun(runs, { command: key, key, scope: "subset", exitKnown: true }, "aaa");

    assert.equal(asks("vitest run --project unit --project integration --coverage"), undefined);
    assert.equal(asks("vitest run -u"), undefined);
    assert.equal(asks("vitest run --project unit").scope, "full");
    assert.equal(asks("vitest run src/ui -t renders").scope, "full");
  });

  it("lets a green run of the whole script answer for a part of it, and never the other way round", () => {
    assert.equal(earlierRun([run({ tree: "aaa" })], part, "aaa").scope, "full");
    assert.equal(earlierRun([run({ tree: "aaa", outcome: "red" })], part, "aaa"), undefined);
    assert.equal(earlierRun([run({ tree: "aaa", key: part.key, scope: "subset" })], test, "aaa"), undefined);
  });
});

describe("the log", () => {
  it("appends one line per run and reads them back, skipping a broken line", () => {
    const { root } = project();

    appendRun(root, run({ ms: 900 }));
    writeFileSync(join(root, ".planning", "tests", "runs.jsonl"), `${readFileSync(join(root, ".planning", "tests", "runs.jsonl"), "utf8")}{"at": \n`);
    appendRun(root, run({ ms: 100, by: "rails" }));

    assert.deepEqual(readRuns(root).map((entry) => entry.ms), [900, 100]);
  });

  it("keeps the start of a run until its end takes it, once", () => {
    const { root } = project();

    startRun(root, "toolu_01/../x", { at: "2026-10-09T10:00:00.000Z", tree: "aaa" });

    assert.equal(takeStart(root, "toolu_01/../x").tree, "aaa");
    assert.equal(takeStart(root, "toolu_01/../x"), undefined);
    assert.deepEqual(readdirSync(join(root, ".planning", "tests", "pending")), []);
  });
});

describe("summarize", () => {
  it("counts the repeats of a green run as redundant, the repeats of a red or unread run apart, with their time", () => {
    const report = summarize([run({ ms: 9000 }), run({ ms: 8000, repeats: "green" }), run({ ms: 700, repeats: "red", by: "rails" }), run({ ms: 300, repeats: "unknown" }), run({ by: "hook" })], 1000);

    assert.deepEqual([report.runs, report.ms, report.redundant, report.redundantMs, report.repeats, report.repeatsMs], [5, 18_000, 1, 8000, 2, 1000]);
    assert.deepEqual(report.by, { agent: 3, rails: 1, hook: 1 });
    assert.equal(report.since, "2026-10-09T10:00:00.000Z");
  });

  it("lists the tests at or over the threshold by their latest timing, slowest first", () => {
    const runs = [
      run({ slowest: [{ name: "boot", ms: 4000 }, { name: "streak", ms: 1200 }, { name: "quick", ms: 3 }] }),
      run({ slowest: [{ name: "boot", ms: 200 }, { name: "tests/a.test.ts", ms: 2500 }, { name: "tests/a.test.ts > deep link", ms: 2400 }] }),
    ];

    assert.deepEqual(summarize(runs, 1000).slow, [{ name: "tests/a.test.ts > deep link", ms: 2400 }, { name: "streak", ms: 1200 }]);
    assert.deepEqual(summarize(runs, 3000).slow, []);
  });
});

describe("slowThreshold", () => {
  it("is 1000 ms unless .claude/moku.local.md sets slowTestMs", () => {
    const { root } = project();
    assert.equal(slowThreshold(root), 1000);

    mkdirSync(join(root, ".claude"), { recursive: true });
    writeFileSync(join(root, ".claude", "moku.local.md"), "---\nmaxParallelAgents: 3\nslowTestMs: 250\n---\n");
    assert.equal(slowThreshold(root), 250);

    writeFileSync(join(root, ".claude", "moku.local.md"), "---\nslowTestMs: fast\n---\n");
    assert.equal(slowThreshold(root), 1000);
  });
});

describe("moku-rails check tests, in the log", () => {
  it("records its own run: who, the whole script, the tree, the duration, the totals and the timings", () => {
    const { root } = project({ slowMs: 2100 });
    built(root);

    assert.equal(rails(root, "check", "tests").code, 0);

    const [entry] = readRuns(root);
    assert.deepEqual([entry.by, entry.command, entry.key, entry.scope, entry.outcome, entry.passed, entry.failed], ["rails", "node --run test", "node test.cjs", "full", "green", 2, 0]);
    assert.equal(entry.tree, treeKey(root));
    assert.equal(typeof entry.ms, "number");
    assert.deepEqual(entry.slowest[0], { name: "boots the app", ms: 2100 });
    assert.equal(entry.repeats, undefined);
  });

  it("keeps the whole output of a red run in a file and says where", () => {
    const { root, turnRed } = project();
    built(root);
    turnRed();

    const check = rails(root, "check", "tests");

    assert.equal(check.code, 2);
    assert.match(check.text, /The whole output is in \.planning\/tests\/last\.log/);
    assert.match(readFileSync(join(root, ".planning", "tests", "last.log"), "utf8"), /ℹ fail 1/);
    assert.equal(readRuns(root)[0].outcome, "red");
  });

  it("marks a second run on an unchanged dirty tree as a repeat, and a run after an edit as a new one", () => {
    const { root } = project();
    built(root);
    writeFileSync(join(root, "streak.ts"), "export const a = 1;\n");

    rails(root, "check", "tests");
    rails(root, "check", "tests");
    writeFileSync(join(root, "streak.ts"), "export const a = 2;\n");
    rails(root, "check", "tests");

    assert.deepEqual(readRuns(root).map((entry) => entry.repeats), [undefined, "green", undefined]);
  });
});

describe("moku-rails tests", () => {
  it("refuses off the rails and writes nothing there", () => {
    const plain = realpathSync(mkdtempSync(join(tmpdir(), "moku-runs-off-")));

    assert.equal(rails(plain, "tests").code, 2);
    assert.equal(existsSync(join(plain, ".planning")), false);
  });

  it("says so when nothing ran yet", () => {
    const { root } = project();
    const report = rails(root, "tests");

    assert.equal(report.code, 0);
    assert.match(report.text, /Test runs: none recorded in this checkout yet\./);
    assert.match(report.text, /Redundant: none\./);
    assert.match(report.text, /Commit hook: none found/);
    assert.match(report.text, /Slow tests: none at or over 1000 ms/);
  });

  it("prints the runs, the redundant runs with their seconds, and the slow tests over the threshold", () => {
    const { root } = project({ slowMs: 2100 });
    built(root);
    writeFileSync(join(root, "streak.ts"), "export const a = 1;\n");
    rails(root, "check", "tests");
    rails(root, "check", "tests");

    const report = rails(root, "tests");
    assert.match(report.text, /Test runs: 2 since \d{4}-\d\d-\d\d \(2 by the rails\), [\d.]+ s in tests\./);
    assert.match(report.text, /Redundant: 1 run\(s\) repeated a green result on an unchanged tree, [\d.]+ s wasted\./);
    assert.match(report.text, /Slow tests at or over 1000 ms \(`slowTestMs` in \.claude\/moku\.local\.md\):\n\s+2100 ms {2}boots the app/);

    const data = JSON.parse(rails(root, "tests", "--json").text).data;
    assert.deepEqual([data.runs, data.redundant, data.slow.length, data.hook], [2, 1, 1, null]);

    assert.match(rails(root, "status").text, /Tests: 1 run\(s\) repeated on an unchanged tree in the last day \([\d.]+ s\), 1 slow test\(s\)\. `moku-rails tests` has the list\./);
  });

  it("leaves status silent about tests while there is nothing to say, and about runs older than a day", () => {
    const { root } = project();
    built(root);
    rails(root, "check", "tests");
    appendRun(root, run({ at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), ms: 9000, repeats: "green" }));

    assert.doesNotMatch(rails(root, "status").text, /Tests:/);
    assert.match(rails(root, "tests").text, /Redundant: 1 run\(s\)/);
  });
});

describe("moku-rails close, with the log", () => {
  it("still refuses without a green `tests` on the current tree, whatever the log holds", () => {
    const { root, turnRed } = project();
    built(root);

    // A green run by an agent on this very tree is in the log; it is not the rails' own check
    appendRun(root, run({ key: fullKey(root), tree: treeKey(root) }));
    rails(root, "check", "verify");
    rails(root, "check", "docs");
    const early = rails(root, "close");
    assert.equal(early.code, 2);
    assert.match(early.text, /tests/);

    // A red check confirms nothing, and close keeps refusing
    turnRed();
    assert.equal(rails(root, "check", "tests").code, 2);
    assert.equal(rails(root, "close").code, 2);
  });

  it("closes after a green check and offers the slow tests to the person", () => {
    const { root } = project({ slowMs: 2100 });
    built(root);
    for (const item of ["tests", "verify", "docs"]) assert.equal(rails(root, "check", item).code, 0, item);

    const closed = rails(root, "close");

    assert.equal(closed.code, 0);
    assert.match(closed.text, /Closed 2026-10-09-fix\.\nSlow tests: 1 at or over 1000 ms, the slowest is `boots the app` \(2100 ms\)\. Offer the person/);
    assert.match(closed.text, /Change no test without a yes\./);
  });

  it("closes with one line when no test is slow", () => {
    const { root } = project();
    built(root);
    for (const item of ["tests", "verify", "docs"]) rails(root, "check", item);

    assert.equal(rails(root, "close").text.trim(), "Closed 2026-10-09-fix.");
  });
});
