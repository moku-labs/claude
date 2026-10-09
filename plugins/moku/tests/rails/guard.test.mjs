import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { guardShell, guardWrite } from "../../lib/rails/guard.mjs";
import { shellWriteTargets } from "../../lib/rails/shell.mjs";

const building = [{ status: "open", station: "build" }];

describe("guardWrite", () => {
  it("blocks a plugin file in a started session before init: the catastrophe case", () => {
    const verdict = guardWrite("src/plugins/streak/index.ts", { onRails: true, initialized: false, changes: [] });

    assert.equal(verdict.allow, false);
    assert.match(verdict.reason, /not initialized/);
  });

  it("blocks source writes in an uninitialized moku project", () => {
    const verdict = guardWrite("src/main.ts", { onRails: true, initialized: false, changes: [] });

    assert.equal(verdict.allow, false);
  });

  it("leaves a non-moku repository alone", () => {
    assert.equal(guardWrite("src/server.ts", { onRails: false, initialized: false, changes: [] }).allow, true);
  });

  it("leaves a repository off the rails alone even when it has its own src/plugins folder", () => {
    const foreign = { onRails: false, initialized: false, changes: [] };

    assert.equal(guardWrite("src/plugins/auth/index.ts", foreign).allow, true);
  });

  it("refuses source while the person's last request is not routed, although a change is being built", () => {
    const verdict = guardWrite("src/main.ts", { onRails: true, initialized: true, routed: false, changes: building });

    assert.equal(verdict.allow, false);
    assert.match(verdict.reason, /not been routed/);
  });

  it("allows source once the request is routed", () => {
    assert.equal(guardWrite("src/main.ts", { onRails: true, initialized: true, routed: true, changes: building }).allow, true);
  });

  it("always allows planning files, docs and configs", () => {
    const facts = { onRails: true, initialized: false, changes: [] };

    assert.equal(guardWrite(".planning/specs/streak.md", facts).allow, true);
    assert.equal(guardWrite("README.md", facts).allow, true);
  });

  it("blocks source writes when no change reached a writing station", () => {
    const verdict = guardWrite("src/plugins/streak/api.ts", { onRails: true, initialized: true, changes: [{ status: "open", station: "plan" }] });

    assert.equal(verdict.allow, false);
    assert.match(verdict.reason, /writing station/);
  });

  it("allows source writes while a change is being built", () => {
    assert.equal(guardWrite("src/plugins/streak/api.ts", { onRails: true, initialized: true, changes: building }).allow, true);
  });

  it("does not judge files outside the project root", () => {
    assert.equal(guardWrite("../other/src/plugins/x/index.ts", { onRails: true, initialized: false, changes: [] }).allow, true);
  });

  it("ignores closed changes", () => {
    const verdict = guardWrite("src/main.ts", { onRails: true, initialized: true, changes: [{ status: "closed", station: "build" }] });

    assert.equal(verdict.allow, false);
  });
});

describe("guardShell", () => {
  const planning = { onRails: true, initialized: true, changes: [{ status: "open", station: "plan" }] };
  const allowed = (command) => assert.equal(guardShell(command, planning).allow, true, command);
  const refused = (command) => assert.equal(guardShell(command, planning).allow, false, command);

  it("lets a read-only command through although it redirects stderr and names src/", () => {
    allowed("grep -rn createPlugin src/ 2>/dev/null");
    allowed("grep -c '=>' src/index.ts 2>&1");
    allowed('count=$(grep -rn createPlugin src/ 2>/dev/null | wc -l); echo "$count"');
  });

  it("lets a planning document be written although its body is full of source paths", () => {
    allowed("cat > .planning/STATE.md <<'EOF'\n## Next\nbuild src/kit.ts\nEOF");
    allowed("cat >> .planning/specs/03-flow.md <<EOF\ncat > src/plugins/flow/index.ts\nEOF");
    allowed("sed -i '' 's#src/old.ts#src/new.ts#' .planning/specs/03-flow.md");
    allowed("echo 'see src/kit.ts' | tee -a .planning/notes.md");
  });

  it("still refuses a redirect into a source file", () => {
    refused("cat > src/plugins/x/index.ts <<'EOF'\nexport {};\nEOF");
    refused('echo x > "src/a.ts"');
    refused("cmd &> src/a.ts");
    refused("echo x >> ./src/a.ts");
    refused('note="$(date > src/stamp.ts)"');
  });

  it("still refuses the commands that write the files they name", () => {
    refused("touch src/plugins/x/index.ts");
    refused("cp /tmp/draft.ts src/plugins/x/api.ts");
    refused("mv src/plugins/x/api.ts src/plugins/x/state.ts");
    refused("git status && sed -i 's/a/b/' src/main.ts");
    refused("echo x | tee src/a.ts");
  });

  it("refuses a writer that gets its files from a pipe or from find, when those name source paths", () => {
    refused("grep -l x src/*.ts | xargs sed -i 's/a/b/'");
    refused("ls src/plugins/x/*.ts | xargs -n 1 touch");
    refused("find src/plugins -name '*.ts' -exec sed -i 's/a/b/' {} +");
  });

  it("lets xargs and find -exec through when they only read, or write outside src/", () => {
    allowed("grep -rl TODO .planning | xargs sed -i '' 's#src/old#src/new#'");
    allowed("grep -l x src/*.ts | xargs wc -l");
    allowed("find src -name '*.ts' -exec grep -l x {} +");
    allowed("grep -l x src/*.ts; echo done | xargs touch");
  });

  it("judges the file a command writes, so copying a source file out is no write to it", () => {
    allowed("cp src/main.ts /tmp/main.backup.ts");
  });

  it("follows cd, so a relative target lands in the directory the command moved to", () => {
    assert.deepEqual(shellWriteTargets("cd ../web && echo x > src/a.ts"), ["../web/src/a.ts"]);
    assert.deepEqual(shellWriteTargets("cd /tmp/other; touch src/a.ts"), ["/tmp/other/src/a.ts"]);
    allowed("cd ../web && echo x > src/a.ts");
  });

  it("scans the rest of the command when a heredoc never closes", () => {
    refused('echo "<< EOF"\ntouch src/a.ts');
  });
});

describe("guardWrite in a game", () => {
  const game = { onRails: true, initialized: true, game: true, changes: [] };

  it("blocks game source before init", () => {
    const verdict = guardWrite("features/hello/flow/new.ts", { onRails: true, initialized: false, game: true, changes: [] });

    assert.equal(verdict.allow, false);
    assert.match(verdict.reason, /not initialized/);
  });

  it("blocks game source when no change is open", () => {
    const verdict = guardWrite("features/hello/flow/new.ts", game);

    assert.equal(verdict.allow, false);
    assert.match(verdict.reason, /writing station/);
  });

  it("blocks every source root of the layout: the three root files and the four layer folders", () => {
    for (const file of ["index.ts", "game.ts", "config.ts", "core/state.ts", "shared/rules/score.ts", "features/index.ts", "features/hello/views/hello-screen.tsx", "features/hello/strings/en.json", "plugins/exit/index.ts"]) {
      assert.equal(guardWrite(file, game).allow, false, file);
    }
  });

  it("allows game source while a change is at a writing station", () => {
    assert.equal(guardWrite("features/hello/flow/new.ts", { ...game, changes: building }).allow, true);
    assert.equal(guardWrite("game.ts", { ...game, changes: building }).allow, true);
  });

  it("allows what is not source: generated files, tests, tooling, the engine's folder and planning", () => {
    for (const file of ["generated/assets.ts", "tests/integration/hello.test.ts", "tests/visual/baselines/home/rest/state.json", "vitest.config.ts", "package.json", ".moku/main.ts", ".planning/specs/hello.md", "assets/icon.png"]) {
      assert.equal(guardWrite(file, game).allow, true, file);
    }
  });

  it("allows art in an assets folder of a layer, but not code hidden there", () => {
    assert.equal(guardWrite("features/fruit/assets/apple.png", game).allow, true);
    assert.equal(guardWrite("shared/assets/font-body.fnt", game).allow, true);
    assert.equal(guardWrite("features/fruit/assets/rules.ts", game).allow, false);
  });

  it("still gates src/ in a game, and judges shell writes by the same roots", () => {
    assert.equal(guardWrite("src/main.ts", game).allow, false);
    assert.equal(guardShell("cat > features/hello/flow/new.ts <<'EOF'", game).allow, false);
    assert.equal(guardShell("cp art/apple.png features/fruit/assets/apple.png", game).allow, true);
  });

  it("leaves the same names alone in a project that is not a game", () => {
    const framework = { onRails: true, initialized: true, changes: [] };

    for (const file of ["plugins/moku/lib/rails/guard.mjs", "plugins/index.ts", "features/hello/flow/new.ts", "core/state.ts", "shared/index.ts", "index.ts", "config.ts", "game.ts"]) {
      assert.equal(guardWrite(file, framework).allow, true, file);
      assert.equal(guardWrite(file, { ...framework, game: false }).allow, true, file);
    }
  });
});

describe("guardWrite for a subagent", () => {
  it("does not consult the routed flag: the station was routed when the agent was spawned", () => {
    assert.equal(guardWrite("src/plugins/streak/api.ts", { onRails: true, initialized: true, routed: false, subagent: true, changes: building }).allow, true);
  });

  it("is not held by the routed flag either when the station records live agents and the payload lacks agent_id", () => {
    assert.equal(guardWrite("src/plugins/streak/api.ts", { onRails: true, initialized: true, routed: false, agentsRunning: true, changes: building }).allow, true);
    assert.equal(guardWrite("src/plugins/streak/api.ts", { onRails: true, initialized: true, routed: false, agentsRunning: false, changes: building }).allow, false);
  });

  it("still refuses source outside a writing station", () => {
    const verdict = guardWrite("src/plugins/streak/api.ts", { onRails: true, initialized: true, routed: false, subagent: true, changes: [{ status: "open", station: "plan" }] });

    assert.equal(verdict.allow, false);
    assert.match(verdict.reason, /writing station/);
  });
});
