import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { commitHook, commitProof, isHookedCommit } from "../../lib/rails/commit-hook.mjs";

/** The scaffold's package block: the tests run as two scripts, one Vitest project each. */
const PACKAGE_HOOK = `pre-commit:
  skip:
    - run: test ! -d node_modules
  jobs:
    - name: build-and-validate
      run: bun run build && bun run validate
    - name: biome-format
      glob: "*.{ts,js,mjs,cjs,json,jsonc}"
      run: bunx biome check --write --no-errors-on-unmatched {staged_files}
      stage_fixed: true
    - name: test-all
      run: bun run test:unit && bun run test:integration
`;

/** The scaffold's app block: the hook runs the `test` script itself. */
const APP_HOOK = `pre-commit:
  skip:
    - run: test ! -d node_modules
  jobs:
    - name: build
      run: bun run build
    - name: typecheck
      run: bun run typecheck
    - name: test
      run: bun run test
`;

const PACKAGE_SCRIPTS = { test: "vitest run", "test:unit": "vitest run --project unit", "test:integration": "vitest run --project integration", build: "tsdown" };
const TWO_PROJECTS = `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      // the fast ones
      { test: { name: "unit", include: ["tests/unit/**/*.test.ts"] } },
      { test: { name: "integration", include: ["tests/integration/**/*.test.ts", "src/plugins/**/__tests__/integration/**/*.test.ts"] } }
    ],
    coverage: { provider: "istanbul", thresholds: { lines: 90 } }
  }
});
`;

const LEFTHOOK_GREEN = "summary: (done in 3.43 seconds)\n✔️ build-and-validate (0.98 seconds)\n✔️ test-all (1.51 seconds)\n[main 8b86c98] fix: streak\n";

/** @param {string} cwd @param {string[]} args */
function git(cwd, ...args) {
  return execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.test", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

/**
 * A committed project with the given files. `installed` puts a `pre-commit` file where git looks for it,
 * the way `lefthook install` does; `modules` adds the `node_modules` the scaffold's hook asks for.
 */
function project(files, { scripts = PACKAGE_SCRIPTS, installed = true, modules = true, extra = {} } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "moku-commit-hook-")));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "habits", scripts, ...extra }));
  writeFileSync(join(root, ".gitignore"), "node_modules/\n");
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(root, name, ".."), { recursive: true });
    writeFileSync(join(root, name), content);
  }
  if (modules) mkdirSync(join(root, "node_modules"));

  git(root, "init", "-q", "-b", "main");
  if (installed) {
    writeFileSync(join(root, ".git", "hooks", "pre-commit"), "#!/bin/sh\nexit 0\n");
    chmodSync(join(root, ".git", "hooks", "pre-commit"), 0o755);
  }
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "init");

  return root;
}

/** Make one more commit and return HEAD before it. */
function commitOnce(root) {
  const before = git(root, "rev-parse", "HEAD");
  writeFileSync(join(root, "streak.ts"), `export const at = ${Date.now()};\n`);
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "streak");

  return before;
}

describe("commitHook: lefthook", () => {
  it("reads the scaffold's package block: two scripts that are every Vitest project, so the whole test script", () => {
    const hook = commitHook(project({ "lefthook.yml": PACKAGE_HOOK, "vitest.config.ts": TWO_PROJECTS }));

    assert.equal(hook.manager, "lefthook");
    assert.deepEqual(hook.tests, [
      { job: "test-all", command: "bun run test:unit", key: "vitest run --project unit" },
      { job: "test-all", command: "bun run test:integration", key: "vitest run --project integration" },
    ]);
    assert.equal(hook.full, true);
    assert.equal(hook.doubt, undefined);
  });

  it("reads the scaffold's app block: the hook runs the test script itself", () => {
    const hook = commitHook(project({ "lefthook.yml": APP_HOOK }, { scripts: { test: "vitest run", build: "moku build", typecheck: "tsc --noEmit" } }));

    assert.deepEqual(hook.tests, [{ job: "test", command: "bun run test", key: "vitest run" }]);
    assert.equal(hook.full, true);
  });

  it("is not the whole script when the Vitest configuration has a project the hook does not run", () => {
    const three = TWO_PROJECTS.replace("],", ', { test: { name: "sandbox", include: ["tests/sandbox/**"] } }\n    ],');

    assert.equal(commitHook(project({ "lefthook.yml": PACKAGE_HOOK, "vitest.config.ts": three })).full, false);
  });

  it("is not the whole script when the projects cannot be read from the file: no guess", () => {
    const imported = TWO_PROJECTS.replace('{ test: { name: "unit", include: ["tests/unit/**/*.test.ts"] } },', "unitProject,");

    assert.equal(commitHook(project({ "lefthook.yml": PACKAGE_HOOK, "vitest.config.ts": imported })).full, false);
    assert.equal(commitHook(project({ "lefthook.yml": PACKAGE_HOOK, "vitest.config.ts": TWO_PROJECTS.replace("projects: [", 'projects: ["packages/*",') })).full, false);
    assert.equal(commitHook(project({ "lefthook.yml": PACKAGE_HOOK })).full, false, "no Vitest configuration at all");
    assert.equal(commitHook(project({ "lefthook.yml": PACKAGE_HOOK, "vitest.config.ts": TWO_PROJECTS, "vitest.workspace.ts": "export default [];\n" })).full, false);
  });

  it("compares the projects the test script names itself", () => {
    const scripts = { ...PACKAGE_SCRIPTS, test: "vitest run --project unit --project integration" };

    assert.equal(commitHook(project({ "lefthook.yml": PACKAGE_HOOK }, { scripts })).full, true);
    assert.equal(commitHook(project({ "lefthook.yml": PACKAGE_HOOK }, { scripts: { ...scripts, test: "vitest run --project unit --project integration --project smoke" } })).full, false);
  });

  it("counts no job that runs only for some commits: a glob, staged files, a skip of its own", () => {
    const staged = `pre-commit:
  commands:
    related:
      glob: "*.ts"
      run: bunx vitest related --run {staged_files}
    changed:
      run: bunx vitest run {staged_files}
    sometimes:
      skip: merge
      run: bun run test
`;
    const hook = commitHook(project({ "lefthook.yml": staged }));

    assert.deepEqual(hook.tests, []);
    assert.equal(hook.full, false);
  });

  it("counts no job whose command line is more than commands joined by &&", () => {
    const piped = "pre-commit:\n  jobs:\n    - name: test\n      run: bun run test || true\n    - name: block\n      run: |\n        bun run build || exit 1\n        bun run test\n";

    assert.deepEqual(commitHook(project({ "lefthook.yml": piped })).tests, []);
  });

  it("reads the older `commands` form and a quoted command", () => {
    const hook = commitHook(project({ "lefthook.yml": 'pre-commit:\n  parallel: true\n  commands:\n    tests:\n      run: "bun run test" # the whole suite\n' }));

    assert.deepEqual(hook.tests, [{ job: "tests", command: "bun run test", key: "vitest run" }]);
    assert.equal(hook.full, true);
  });

  it("doubts a hook that steps aside here, that has a condition it cannot check, or that another file changes", () => {
    assert.match(commitHook(project({ "lefthook.yml": APP_HOOK }, { modules: false })).doubt, /without node_modules/);
    assert.match(commitHook(project({ "lefthook.yml": APP_HOOK.replace("    - run: test ! -d node_modules", "    - merge\n    - rebase") })).doubt, /`skip` condition/);
    assert.match(commitHook(project({ "lefthook.yml": APP_HOOK, "lefthook-local.yml": "pre-commit:\n  jobs: []\n" })).doubt, /another lefthook file/);
    assert.match(commitHook(project({ "lefthook.yml": APP_HOOK }, { installed: false })).doubt, /not installed/);
  });

  it("finds no hook where the configuration has no pre-commit block, or there is no configuration", () => {
    assert.equal(commitHook(project({ "lefthook.yml": "# pre-commit:\n#   jobs:\n#     - run: bun run test\npre-push:\n  jobs:\n    - run: bun run test\n" })), undefined);
    assert.equal(commitHook(project({})), undefined);
  });
});

describe("commitHook: husky and simple-git-hooks", () => {
  it("reads the command lines of .husky/pre-commit", () => {
    const hook = commitHook(project({ ".husky/pre-commit": '#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"\n\nbunx lint-staged\nnpm test\n' }));

    assert.equal(hook.manager, "husky");
    assert.deepEqual(hook.tests, [{ job: "pre-commit", command: "npm test", key: "vitest run" }]);
    assert.equal(hook.full, true);
  });

  it("does not follow a husky script with conditions", () => {
    const hook = commitHook(project({ ".husky/pre-commit": 'if [ -n "$CI" ]; then\n  npm test\nfi\n' }));

    assert.deepEqual(hook.tests, []);
    assert.match(hook.doubt, /conditions/);
  });

  it("reads the pre-commit command of simple-git-hooks", () => {
    const hook = commitHook(project({}, { extra: { "simple-git-hooks": { "pre-commit": "bun run test:unit" } } }));

    assert.equal(hook.manager, "simple-git-hooks");
    assert.deepEqual(hook.tests, [{ job: "pre-commit", command: "bun run test:unit", key: "vitest run --project unit" }]);
    assert.equal(hook.full, false);
  });
});

describe("isHookedCommit", () => {
  it("accepts one commit beside staging, reading and output filters", () => {
    for (const line of ['git commit -m "fix: streak"', 'git add -A && git commit -m "fix" 2>&1 | tail -5', "cd app && git commit -am fix && git status --short", 'git commit -m "$(cat <<\'EOF\'\nfix: streak\n\nruns npm test; echo done\nEOF\n)"']) {
      assert.equal(isHookedCommit(line, {}), true, line);
    }
  });

  it("refuses a commit that skipped the hook, or a line that does more than commit", () => {
    for (const line of ["git commit --no-verify -m wip", "git commit -n -m wip", "git commit -nm wip", "LEFTHOOK=0 git commit -m wip", "HUSKY=0 git commit -m wip", "git -c core.hooksPath=/dev/null commit -m wip", "git commit -m fix && git checkout .", "bun run format && git commit -m fix", 'git commit -m a && git commit -m b', "git status"]) {
      assert.equal(isHookedCommit(line, {}), false, line);
    }
  });

  it("refuses while the environment switches a hook manager off", () => {
    assert.equal(isHookedCommit("git commit -m fix", { LEFTHOOK: "0" }), false);
    assert.equal(isHookedCommit("git commit -m fix", { HUSKY: "0" }), false);
  });
});

describe("commitProof", () => {
  it("proves the new HEAD when the hook ran the whole script and the commit's output shows the job passing", () => {
    const root = project({ "lefthook.yml": PACKAGE_HOOK, "vitest.config.ts": TWO_PROJECTS });
    const before = commitOnce(root);

    const proof = commitProof({ root, line: 'git add -A && git commit -m "streak"', before, output: LEFTHOOK_GREEN, environment: {} });

    assert.equal(proof.head, git(root, "rev-parse", "HEAD"));
    assert.deepEqual([proof.full, proof.ms, proof.tests.length], [true, 1510, 2]);
  });

  it("proves only the hook's own commands when they are a part of the script", () => {
    const root = project({ "lefthook.yml": PACKAGE_HOOK });
    const before = commitOnce(root);

    assert.equal(commitProof({ root, line: "git commit -m streak", before, output: LEFTHOOK_GREEN, environment: {} }).full, false);
  });

  it("proves nothing without the hook's trace in the output", () => {
    const root = project({ "lefthook.yml": PACKAGE_HOOK, "vitest.config.ts": TWO_PROJECTS });
    const before = commitOnce(root);
    const facts = { root, line: "git commit -m streak", before, environment: {} };

    assert.equal(commitProof({ ...facts, output: "[main 8b86c98] streak\n 1 file changed\n" }), undefined);
    assert.equal(commitProof({ ...facts, output: "✔️ build-and-validate (0.98 seconds)\n" }), undefined, "another job passed, not the tests");
    assert.equal(commitProof({ ...facts, output: "🥊 test-all (1.51 seconds)\n" }), undefined);
  });

  it("proves nothing when HEAD did not move, the hook was skipped, or files are left uncommitted", () => {
    const root = project({ "lefthook.yml": PACKAGE_HOOK, "vitest.config.ts": TWO_PROJECTS });
    const before = commitOnce(root);
    const facts = { root, before, output: LEFTHOOK_GREEN, environment: {} };

    assert.equal(commitProof({ ...facts, line: "git commit -m streak", before: git(root, "rev-parse", "HEAD") }), undefined, "HEAD did not move");
    assert.equal(commitProof({ ...facts, line: "git commit --no-verify -m streak" }), undefined);
    assert.equal(commitProof({ ...facts, line: "git commit -m streak", environment: { LEFTHOOK: "0" } }), undefined);

    writeFileSync(join(root, "left.ts"), "export {};\n");
    assert.equal(commitProof({ ...facts, line: "git commit -m streak" }), undefined, "the hook tested files that are not in the commit");
  });

  it("proves nothing where the hook is in doubt", () => {
    const root = project({ "lefthook.yml": PACKAGE_HOOK, "vitest.config.ts": TWO_PROJECTS }, { modules: false });
    const before = commitOnce(root);

    assert.equal(commitProof({ root, line: "git commit -m streak", before, output: LEFTHOOK_GREEN, environment: {} }), undefined);
  });

  it("takes the runner's own totals as the trace of a husky hook", () => {
    const root = project({ ".husky/pre-commit": "npm test\n" });
    const before = commitOnce(root);
    const facts = { root, line: "git commit -m streak", before, environment: {} };

    const proof = commitProof({ ...facts, output: " Test Files  2 passed (2)\n      Tests  9 passed (9)\n   Duration  1.20s\n[main 8b86c98] streak\n" });
    assert.deepEqual([proof.full, proof.ms], [true, 1200]);
    assert.equal(commitProof({ ...facts, output: "[main 8b86c98] streak\n" }), undefined);
  });
});
