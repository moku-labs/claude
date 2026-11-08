import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { OFFERED_FILE, applyAccess, isApplyCommand, offerOnce, planningAccess, sharedPlanningDir, userSettingsFile } from "../../lib/rails/planning-access.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, "..", "..", "bin", "moku-rails");
const PRE_BASH = join(HERE, "..", "..", "hooks", "pre-bash.mjs");

/** A temp folder; `HOME` and `CLAUDE_CONFIG_DIR` of every run point into it, never at the real `~/.claude`. */
function sandbox() {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "moku-access-")));
  const config = join(base, "config");
  return { base, config, settings: join(config, "settings.json"), env: { ...process.env, HOME: base, CLAUDE_CONFIG_DIR: config } };
}

/** Run the CLI with the sandbox's environment. */
function rails(box, root, ...args) {
  const run = spawnSync("node", [CLI, ...args, "--root", root], { encoding: "utf8", env: box.env });
  return { code: run.status, text: `${run.stdout}${run.stderr}`, json: args.includes("--json") ? JSON.parse(run.stdout || run.stderr) : undefined };
}

/** A project folder already on the rails. */
function project(box, name = "site") {
  const root = join(box.base, name);
  rails(box, root, "session", "start");
  return root;
}

const git = (cwd, ...args) => execFileSync("git", args, { cwd, stdio: "ignore" });

describe("planning access: the user settings file", () => {
  it("lives in CLAUDE_CONFIG_DIR, else in ~/.claude", () => {
    assert.equal(userSettingsFile({ CLAUDE_CONFIG_DIR: "/c", HOME: "/h" }), "/c/settings.json");
    assert.equal(userSettingsFile({ HOME: "/h" }), "/h/.claude/settings.json");
  });

  it("counts a missing or broken file as not allowed", () => {
    const box = sandbox();
    const root = join(box.base, "site");
    mkdirSync(join(root, ".planning"), { recursive: true });

    assert.equal(planningAccess(root, box.settings).allowed, false);
    mkdirSync(box.config, { recursive: true });
    writeFileSync(box.settings, "{ not json");
    assert.equal(planningAccess(root, box.settings).allowed, false);
  });

  it("counts the folder or a parent of it in additionalDirectories as allowed", () => {
    const box = sandbox();
    const root = join(box.base, "site");
    mkdirSync(join(root, ".planning"), { recursive: true });
    mkdirSync(box.config, { recursive: true });

    writeFileSync(box.settings, JSON.stringify({ permissions: { additionalDirectories: [root] } }));
    assert.equal(planningAccess(root, box.settings).allowed, true);
    writeFileSync(box.settings, JSON.stringify({ permissions: { additionalDirectories: [`${root}-other`] } }));
    assert.equal(planningAccess(root, box.settings).allowed, false);
  });
});

describe("planning access: the offer", () => {
  it("is shown once per project and remembered in .planning/", () => {
    const box = sandbox();
    const root = join(box.base, "site");
    mkdirSync(join(root, ".planning"), { recursive: true });

    const first = offerOnce(root, "/opt/moku-rails", box.settings);
    const second = offerOnce(root, "/opt/moku-rails", box.settings);

    assert.match(first.lines.join("\n"), /! \/opt\/moku-rails allow-planning --apply --root /);
    assert.match(first.lines.join("\n"), /never run it yourself/);
    assert.ok(existsSync(join(root, ".planning", OFFERED_FILE)));
    assert.deepEqual(second.lines, []);
  });

  it("is silent when the folder is already allowed, and writes no marker", () => {
    const box = sandbox();
    const root = join(box.base, "site");
    mkdirSync(join(root, ".planning"), { recursive: true });
    mkdirSync(box.config, { recursive: true });
    writeFileSync(box.settings, JSON.stringify({ permissions: { additionalDirectories: [join(root, ".planning")] } }));

    assert.deepEqual(offerOnce(root, "/opt/moku-rails", box.settings).lines, []);
    assert.equal(existsSync(join(root, ".planning", OFFERED_FILE)), false);
  });

  it("names the main checkout's .planning from a worktree, and the worktree shares the one marker", () => {
    const box = sandbox();
    const main = join(box.base, "site");
    mkdirSync(join(main, ".planning"), { recursive: true });
    git(main, "init", "-q");
    git(main, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init");
    const tree = join(box.base, "site-fix");
    git(main, "worktree", "add", "-q", tree);

    assert.equal(sharedPlanningDir(tree), join(main, ".planning"));
    assert.notDeepEqual(offerOnce(main, "/opt/moku-rails", box.settings).lines, []);
    assert.deepEqual(offerOnce(tree, "/opt/moku-rails", box.settings).lines, []);
  });
});

describe("planning access: apply", () => {
  it("adds the one folder and keeps every other setting", () => {
    const box = sandbox();
    const root = join(box.base, "site");
    mkdirSync(join(root, ".planning"), { recursive: true });
    mkdirSync(box.config, { recursive: true });
    writeFileSync(box.settings, JSON.stringify({ model: "opus", permissions: { allow: ["Bash(ls:*)"], additionalDirectories: ["/elsewhere"] } }));

    assert.equal(applyAccess(root, box.settings).changed, true);
    assert.equal(applyAccess(root, box.settings).changed, false);
    assert.deepEqual(JSON.parse(readFileSync(box.settings, "utf8")), { model: "opus", permissions: { allow: ["Bash(ls:*)"], additionalDirectories: ["/elsewhere", join(root, ".planning")] } });
  });

  it("creates a missing settings file", () => {
    const box = sandbox();
    const root = join(box.base, "site");
    mkdirSync(join(root, ".planning"), { recursive: true });

    assert.equal(applyAccess(root, box.settings).changed, true);
    assert.deepEqual(JSON.parse(readFileSync(box.settings, "utf8")).permissions.additionalDirectories, [join(root, ".planning")]);
  });

  it("refuses to overwrite a settings file that is not JSON", () => {
    const box = sandbox();
    const root = join(box.base, "site");
    mkdirSync(join(root, ".planning"), { recursive: true });
    mkdirSync(box.config, { recursive: true });
    writeFileSync(box.settings, "{ broken");

    assert.match(applyAccess(root, box.settings).error ?? "", /not valid JSON/);
    assert.equal(readFileSync(box.settings, "utf8"), "{ broken");
  });
});

describe("moku-rails: allow-planning in the commands", () => {
  it("session start offers once, then stays silent", () => {
    const box = sandbox();
    const root = join(box.base, "site");

    const first = rails(box, root, "session", "start", "--json");
    const again = rails(box, root, "session", "start");

    assert.match(first.json.lines.join("\n"), /allow-planning --apply/);
    assert.equal(first.json.data.planningAccess.allowed, false);
    assert.doesNotMatch(again.text, /allow-planning/);
  });

  it("session start says nothing when the user settings already allow the folder", () => {
    const box = sandbox();
    const root = join(box.base, "site");
    mkdirSync(join(root, ".planning"), { recursive: true });
    mkdirSync(box.config, { recursive: true });
    writeFileSync(box.settings, JSON.stringify({ permissions: { additionalDirectories: [join(root, ".planning")] } }));

    assert.doesNotMatch(rails(box, root, "session", "start").text, /allow-planning/);
  });

  it("adopt offers it in a project that was never offered", () => {
    const box = sandbox();
    const root = join(box.base, "clone");
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "habits", dependencies: { "@moku-labs/core": "1.5.0" } }));

    assert.match(rails(box, root, "adopt").text, /allow-planning --apply/);
  });

  it("init done offers it when session start did not", () => {
    const box = sandbox();
    const root = join(box.base, "fresh");
    mkdirSync(join(root, ".planning"), { recursive: true });
    rails(box, root, "init", "begin");
    writeFileSync(join(root, ".planning", "moku.md"), "type: consumer\nname: fresh\n");

    assert.match(rails(box, root, "init", "done").text, /allow-planning --apply/);
  });

  it("--apply, run by the person, writes the sandbox settings; the plain form reports", () => {
    const box = sandbox();
    const root = project(box);

    assert.match(rails(box, root, "allow-planning").text, /Not yet allowed/);
    assert.match(rails(box, root, "allow-planning", "--apply").text, /Added .*additionalDirectories/);
    assert.match(rails(box, root, "allow-planning").text, /^Allowed/);
    assert.deepEqual(JSON.parse(readFileSync(box.settings, "utf8")).permissions.additionalDirectories, [join(root, ".planning")]);
  });
});

describe("pre-bash hook: the agent may not apply", () => {
  it("recognizes the apply command and nothing else", () => {
    assert.equal(isApplyCommand("moku-rails allow-planning --apply"), true);
    assert.equal(isApplyCommand('"/x/bin/moku-rails" allow-planning --apply --root "/w"'), true);
    assert.equal(isApplyCommand("moku-rails allow-planning"), false);
    assert.equal(isApplyCommand("moku-rails allow-planning && echo --apply"), false);
  });

  it("refuses the agent's run of --apply on any project", () => {
    const box = sandbox();
    const root = project(box);
    const payload = { cwd: root, tool_name: "Bash", tool_input: { command: `${CLI} allow-planning --apply --root ${root}` } };
    const run = spawnSync("node", [PRE_BASH], { input: JSON.stringify(payload), encoding: "utf8", env: box.env });

    assert.equal(run.status, 2);
    assert.match(run.stderr, /only the person runs/);
    assert.equal(existsSync(box.settings), false);
  });
});
