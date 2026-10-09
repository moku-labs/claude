import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { linkPlanning } from "../../lib/hooks/worktree.mjs";
import { readRuns, summarize, treeKey } from "../../lib/rails/test-runs.mjs";

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RAILS = join(PLUGIN, "bin", "moku-rails");
const HOOK = join(PLUGIN, "hooks", "on-test-run.mjs");

const GREEN = " ✓  unit  tests/unit/streak.test.ts (3 tests) 1210ms\n Test Files  1 passed (1)\n      Tests  3 passed (3)\n   Duration  1.40s\n";
const RED = " ❯  unit  tests/unit/streak.test.ts (3 tests | 1 failed) 12ms\n Test Files  1 failed (1)\n      Tests  1 failed | 2 passed (3)\n";
const APP_HOOK = "pre-commit:\n  skip:\n    - run: test ! -d node_modules\n  jobs:\n    - name: build\n      run: bun run build\n    - name: test\n      run: bun run test\n";
const LEFTHOOK_GREEN = "summary: (done in 9.10 seconds)\n✔️ build (0.70 seconds)\n✔️ test (8.40 seconds)\n[main 8b86c98] fix: streak\n";

/** The environment of a hook run, without the variables that switch a hook manager or the rails off. */
function cleanEnvironment(extra) {
  const kept = Object.entries(process.env).filter(([name]) => !/^(LEFTHOOK|HUSKY|SKIP_SIMPLE_GIT_HOOKS|CLAUDE_PLUGIN_OPTION_RAILS)/.test(name));

  return { ...Object.fromEntries(kept), ...extra };
}

/** Run the hook script with a JSON payload on stdin. */
function hook(payload, env = {}) {
  const run = spawnSync("node", [HOOK], { input: JSON.stringify(payload), encoding: "utf8", env: cleanEnvironment(env) });
  return { code: run.status, out: run.stdout, err: run.stderr, context: run.stdout ? JSON.parse(run.stdout).hookSpecificOutput.additionalContext : undefined };
}

function rails(root, ...args) {
  const run = spawnSync("node", [RAILS, ...args, "--root", root], { encoding: "utf8" });
  return { code: run.status, text: `${run.stdout}${run.stderr}` };
}

/** @param {string} cwd @param {string[]} args */
function git(cwd, ...args) {
  return execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.test", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

/**
 * A committed project with a moku session. Its `test` script does not exist as a program, so a test
 * that expects "not run again" fails loudly if the rails run it. `files` are written before the commit.
 */
function project(files = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "moku-test-run-")));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "habits", scripts: { test: "vitest run", "test:unit": "vitest run --project unit", build: "moku build" } }));
  writeFileSync(join(root, ".gitignore"), ".planning/\nnode_modules/\n");
  for (const [name, content] of Object.entries(files)) writeFileSync(join(root, name), content);

  rails(root, "session", "start");
  writeFileSync(join(root, ".planning", "moku.md"), "type: consumer\nname: habits\n");
  git(root, "init", "-q", "-b", "main");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "init");

  return root;
}

let calls = 0;

/** One Bash call as the three events see it: the payload before, after a success, and after a failure. */
function bash(root, command, extra = {}) {
  const base = { cwd: root, session_id: "s1", tool_name: "Bash", tool_input: { command }, tool_use_id: `toolu_${(calls += 1)}`, ...extra };

  return {
    before: () => hook({ ...base, hook_event_name: "PreToolUse" }),
    passed: (stdout = "", more = {}) => hook({ ...base, hook_event_name: "PostToolUse", tool_response: { stdout, stderr: "", interrupted: false, isImage: false }, duration_ms: 4187, ...more }),
    failed: (error = "Exit code 1", more = {}) => hook({ ...base, hook_event_name: "PostToolUseFailure", error, is_interrupt: false, duration_ms: 950, ...more }),
  };
}

/** Run one Bash call to its green end and return what the hook said before it. */
function green(root, command, stdout = GREEN) {
  const call = bash(root, command);
  const said = call.before();
  call.passed(stdout);

  return said;
}

describe("test-run hook: silence", () => {
  it("says and writes nothing in a directory without a moku session", () => {
    const plain = realpathSync(mkdtempSync(join(tmpdir(), "moku-test-run-plain-")));
    writeFileSync(join(plain, "package.json"), JSON.stringify({ scripts: { test: "vitest run" } }));
    const call = bash(plain, "bun run test");

    for (const result of [call.before(), call.passed(GREEN), call.before(), call.failed()]) assert.deepEqual([result.code, result.out, result.err], [0, "", ""]);
    assert.equal(existsSync(join(plain, ".planning")), false);
  });

  it("ignores every command that runs no tests and makes no commit", () => {
    const root = project();

    for (const command of ["bun run lint", "ls -la", "git status", "grep -rn 'bun run test' docs/"]) assert.deepEqual([green(root, command).out, readRuns(root)], ["", []]);
    assert.equal(existsSync(join(root, ".planning", "tests")), false);
  });

  it("stays out when the rails are off", () => {
    const root = project();
    const call = bash(root, "bun run test");

    call.before();
    hook({ cwd: root, hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "bun run test" }, tool_use_id: "toolu_off" }, { CLAUDE_PLUGIN_OPTION_RAILS: "off" });
    hook({ cwd: root, hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "bun run test" }, tool_use_id: "toolu_off", tool_response: { stdout: GREEN } }, { CLAUDE_PLUGIN_OPTION_RAILS: "off" });

    assert.deepEqual(readRuns(root), []);
  });
});

describe("test-run hook: the record", () => {
  it("writes one line per run: the command, its scope, the tree, the duration, the outcome and who ran it", () => {
    const root = project();

    assert.equal(green(root, "cd . && CI=1 bun run test").out, "");

    const [run] = readRuns(root);
    assert.deepEqual([run.command, run.key, run.scope, run.ms, run.outcome, run.by, run.passed, run.failed], ["bun run test", "vitest run", "full", 4187, "green", "agent", 3, 0]);
    assert.equal(run.tree, treeKey(root));
    assert.deepEqual(run.slowest, [{ name: "tests/unit/streak.test.ts", ms: 1210 }]);
    assert.equal(run.agent, undefined);
  });

  it("names the agent type of a run from a subagent, and calls a scoped run a subset", () => {
    const root = project();
    const call = bash(root, "bunx vitest run src/plugins/streak/", { agent_id: "a1", agent_type: "moku:moku-builder" });
    call.before();
    call.passed(GREEN);

    assert.deepEqual([readRuns(root)[0].agent, readRuns(root)[0].scope, readRuns(root)[0].key], ["moku:moku-builder", "subset", "vitest run src/plugins/streak/"]);
  });

  it("is red after a failed call, and red when the totals name a failure behind a filter that exits 0", () => {
    const root = project();
    const plain = bash(root, "bun run test");
    plain.before();
    plain.failed(`Exit code 1\n${RED}`);
    green(root, "bun run test 2>&1 | tail -5", RED);

    assert.deepEqual(readRuns(root).map((run) => [run.outcome, run.ms]), [["red", 950], ["red", 4187]]);
  });

  it("is unknown behind a filter that hid the totals: an exit status of the filter proves nothing", () => {
    const root = project();
    green(root, "bun run test 2>&1 | grep -c FAIL", "0\n");
    green(root, "bun run test 2>&1 | tail -3", GREEN);

    assert.deepEqual(readRuns(root).map((run) => run.outcome), ["unknown", "green"]);
  });

  it("keeps no tree for a run whose files changed while it ran", () => {
    const root = project();
    const call = bash(root, "bun run test");
    call.before();
    writeFileSync(join(root, "streak.ts"), "export const a = 1;\n");
    call.passed(GREEN);

    assert.equal(readRuns(root)[0].tree, undefined);
  });

  it("files a run under the project its `cd` leads to", () => {
    const root = project();
    const call = bash(dirname(root), `cd ${root} && bun run test`);
    call.before();
    call.passed(GREEN);

    assert.equal(readRuns(root).length, 1);
  });

  it("falls back to its own clock when the harness sends no duration, and times no background run", () => {
    const root = project();
    const timed = bash(root, "bun run test");
    timed.before();
    timed.passed(GREEN, { duration_ms: undefined });
    const background = bash(root, "bun run test:unit", { tool_input: { command: "bun run test:unit", run_in_background: true } });
    background.before();
    background.passed("");

    const [first, second] = readRuns(root);
    assert.equal(typeof first.ms, "number");
    assert.deepEqual([second.ms, second.outcome], [undefined, "unknown"]);
  });
});

describe("test-run hook: a repeat on an unchanged tree", () => {
  it("tells the agent the command was green on this tree, lets it run, and counts it", () => {
    const root = project();
    writeFileSync(join(root, "streak.ts"), "export const a = 1;\n");
    green(root, "bun run test 2>&1 | tail -5");

    const again = bash(root, "bun run test 2>&1 | grep -n streak");
    const said = again.before();
    again.passed("3: streak\n");

    assert.equal(said.code, 0, "advice, never a refusal");
    assert.match(said.context, /^moku tests: `bun run test` was already green on this exact tree [\d.]+ s ago \(by agents\)\. No file changed since/);
    assert.match(said.context, /keep the output of one run in a file/);
    assert.match(said.context, /Policy: .*skills\/moku-testing\/references\/test-runs\.md$/);

    const report = summarize(readRuns(root), 1000);
    assert.deepEqual([report.runs, report.redundant, report.redundantMs, report.repeats], [2, 1, 4187, 0]);
  });

  it("says nothing once a file changed, and nothing about another command", () => {
    const root = project();
    green(root, "bunx vitest run src/plugins/streak/");

    assert.equal(green(root, "bunx vitest run src/plugins/hud/").out, "");

    writeFileSync(join(root, "streak.ts"), "export const a = 1;\n");
    assert.equal(green(root, "bunx vitest run src/plugins/streak/").out, "");
    assert.equal(summarize(readRuns(root), 1000).redundant, 0);
  });

  it("lets a red run take the green one away: the next repeat is told red, and is not redundant", () => {
    const root = project();
    green(root, "bun run test");
    const red = bash(root, "bun run test");
    red.before();
    red.failed(`Exit code 1\n${RED}`);

    const said = green(root, "bun run test");

    assert.match(said.context, /already ran on this exact tree [\d.]+ s ago and was red\. A repeat without an edit shows the same result/);
    assert.deepEqual(readRuns(root).map((run) => run.repeats), [undefined, "green", "red"]);
    assert.deepEqual([summarize(readRuns(root), 1000).redundant, summarize(readRuns(root), 1000).repeats], [1, 1]);
  });

  it("tells a repeat of a run whose result was hidden by a filter", () => {
    const root = project();
    green(root, "bun run test 2>&1 | grep -c FAIL", "0\n");

    assert.match(green(root, "bun run test 2>&1 | tail -20").context, /was not read to its end \(a filter hid its exit status and its totals\)/);
  });

  it("lets a green run of the whole script answer for a part of it", () => {
    const root = project();
    green(root, "bun run test");

    assert.match(green(root, "bun run test:unit").context, /`bun run test:unit` was already green on this exact tree/);
    assert.equal(green(root, "bunx playwright test").out, "", "another runner is another question");
  });
});

describe("test-run hook: a commit through the project's hook", () => {
  /** A project whose lefthook runs the whole test script, with a change waiting for its closing checklist. */
  function hooked() {
    const root = project({ "lefthook.yml": APP_HOOK });
    mkdirSync(join(root, "node_modules"));
    writeFileSync(join(root, ".git", "hooks", "pre-commit"), "#!/bin/sh\nexit 0\n");
    chmodSync(join(root, ".git", "hooks", "pre-commit"), 0o755);

    rails(root, "open", "2026-10-09-streak", "--size", "S", "--type", "fix");
    for (const station of ["build", "verify"]) {
      rails(root, "enter", station);
      rails(root, "done", station);
    }

    return root;
  }

  /** Commit one edit the way an agent does: the hook sees the call before and after. */
  function commit(root, command, output = LEFTHOOK_GREEN) {
    const call = bash(root, command);
    call.before();
    writeFileSync(join(root, "streak.ts"), `export const at = ${(calls += 1)};\n`);
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "streak");

    return call.passed(output);
  }

  it("records HEAD as green when the hook ran the whole script, and `check tests` does not run it again", () => {
    const root = hooked();

    const said = commit(root, 'git add -A && git commit -m "fix: streak" 2>&1 | tail -6');

    const head = git(root, "rev-parse", "HEAD");
    assert.match(said.context, new RegExp(`^moku tests: the commit hook ran the whole test script green on ${head.slice(0, 7)}\\. Do not run it again on this tree`));
    assert.equal(JSON.parse(readFileSync(join(root, ".planning", "state.json"), "utf8")).testsGreenAt, head);

    const [run] = readRuns(root);
    assert.deepEqual([run.by, run.command, run.key, run.scope, run.outcome, run.ms, run.tree], ["hook", "bun run test", "vitest run", "full", "green", 8400, treeKey(root)]);

    const check = rails(root, "check", "tests");
    assert.equal(check.code, 0);
    assert.match(check.text, new RegExp(`green on ${head.slice(0, 7)}, not run again`));
    assert.equal(readRuns(root).length, 1, "the rails did not run the script");
  });

  it("proves nothing for a commit that skipped the hook: `check tests` runs the script and refuses", () => {
    const root = hooked();

    const said = commit(root, 'git commit --no-verify -m "wip"');

    assert.equal(said.out, "");
    assert.deepEqual(readRuns(root), []);
    assert.equal(rails(root, "check", "tests").code, 2, "the script ran, and it is red here");
    assert.equal(rails(root, "close").code, 2);
  });

  it("proves nothing when the commit's output does not show the test job passing", () => {
    const root = hooked();

    assert.equal(commit(root, 'git commit -m "fix"', "[main 8b86c98] fix\n 1 file changed\n").out, "");
    assert.equal(JSON.parse(readFileSync(join(root, ".planning", "state.json"), "utf8")).testsGreenAt, undefined);
  });

  it("proves nothing after an edit: the next commit or edit is another tree", () => {
    const root = hooked();
    commit(root, 'git commit -m "fix"');
    writeFileSync(join(root, "later.ts"), "export {};\n");

    assert.equal(rails(root, "check", "tests").code, 2, "the tree changed, so the script runs");
  });

  it("names the double when the same tests were green on the same files just before the commit", () => {
    const root = hooked();
    const call = bash(root, 'git add -A && git commit -m "fix: streak"');
    writeFileSync(join(root, "streak.ts"), "export const a = 1;\n");
    green(root, "bun run test");

    call.before();
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "streak");
    const said = call.passed(LEFTHOOK_GREEN);

    assert.match(said.context, /The same tests were green on the same files just before the commit \(`bun run test`\), so they ran twice: before a commit, leave the full run to the hook\./);
    assert.deepEqual(readRuns(root).map((run) => [run.by, run.repeats]), [["agent", undefined], ["hook", "green"]]);
    assert.equal(summarize(readRuns(root), 1000).redundant, 1);
  });

  it("tells a full run right after the commit that the hook already answered it", () => {
    const root = hooked();
    commit(root, 'git commit -m "fix"');

    assert.match(green(root, "bun run test").context, /was already green on this exact tree [\d.]+ s ago \(by the commit hook\)/);
  });
});

describe("test-run hook: a worktree lane", () => {
  it("keeps its own log, and a commit proved there says nothing about the main checkout", () => {
    const root = project({ "lefthook.yml": APP_HOOK });
    writeFileSync(join(root, ".git", "hooks", "pre-commit"), "#!/bin/sh\nexit 0\n");
    chmodSync(join(root, ".git", "hooks", "pre-commit"), 0o755);
    const lane = join(root, ".claude", "worktrees", "streak");
    git(root, "worktree", "add", "-q", "-b", "streak", lane);
    assert.equal(linkPlanning(lane), true);
    mkdirSync(join(lane, "node_modules"));

    green(lane, "bun run test");
    assert.deepEqual([readRuns(lane).length, readRuns(root).length], [1, 0]);
    assert.equal(green(root, "bun run test").out, "", "the lane's run is not the main checkout's");

    const call = bash(lane, 'git commit -m "fix: streak"');
    call.before();
    writeFileSync(join(lane, "streak.ts"), "export const a = 1;\n");
    git(lane, "add", "-A");
    git(lane, "commit", "-q", "-m", "streak");
    call.passed(LEFTHOOK_GREEN);

    const ledger = JSON.parse(readFileSync(join(root, ".planning", "state.json"), "utf8"));
    assert.equal(ledger.testsGreenAtIn[lane], git(lane, "rev-parse", "HEAD"));
    assert.equal(ledger.testsGreenAt, undefined);
    assert.deepEqual(readRuns(lane).map((run) => run.by), ["agent", "hook"]);
  });
});
