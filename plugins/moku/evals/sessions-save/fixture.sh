#!/usr/bin/env bash
# A desktop app of its own, inside the sandbox: the Code tab sessions of two accounts, and the worktree registry. The project's settings point moku-rails at it, so the eval never reads or writes the person's real app.
# The current account's sidebar: "Игра" with two side sessions (one in a worktree), "Координатор" at the top, and one
# archived session. The other account has a session of its own. Only the four sidebar sessions may be saved.
set -euo pipefail
git init -q -b main .
# Never over a real app: the eval sandbox's HOME has none, and a real one always keeps its config.json
if [ -e "$(dirname "$PWD")/Library/Application Support/Claude/config.json" ]; then echo "refusing: a real Claude app lives under $(dirname "$PWD")" >&2; exit 1; fi
node - "$PWD" "$(dirname "$PWD")" "${CLAUDE_CODE_ACCOUNT_UUID:-acct}/${CLAUDE_CODE_ORGANIZATION_UUID:-org}" <<'NODE'
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const root = process.argv[2];
// The sandbox's HOME is the folder above the project: the app and the checkpoints sit where moku-rails looks by default
const home = process.argv[3];
const account = process.argv[4];
const app = join(home, "Library", "Application Support", "Claude");
const sessions = join(app, "claude-code-sessions");
const cur = join(sessions, account);
const other = join(sessions, "acct-other", "org");
const game = join(root, "work", "game");
const wt = join(game, ".claude", "worktrees", "album");
for (const dir of [cur, other, wt, join(root, "work", "engine")]) mkdirSync(dir, { recursive: true });
const rec = (dir, r) => writeFileSync(join(dir, `${r.sessionId}.json`), JSON.stringify({ isArchived: false, permissionMode: "auto", lastActivityAt: Date.now(), titleSource: "user", originCwd: r.cwd, ...r }));
rec(cur, { sessionId: "local_a1", cliSessionId: "c-game", title: "Игра: A Memory Missing", cwd: game });
rec(cur, { sessionId: "local_a2", cliSessionId: "c-album", title: "Альбом карточек", cwd: wt, originCwd: game, worktreePath: wt, worktreeName: "album", branch: "moku/album", spawnedFrom: { sessionId: "local_a1", sideSession: true }, startChain: { firstSessionId: "local_a1", depth: 1 } });
rec(cur, { sessionId: "local_a3", cliSessionId: "c-store", title: "Store", cwd: game, spawnedFrom: { sessionId: "local_a1", sideSession: true } });
rec(cur, { sessionId: "local_a4", cliSessionId: "c-coord", title: "Координатор: движок и редактор", cwd: join(root, "work", "engine") });
rec(cur, { sessionId: "local_a5", cliSessionId: "c-old", title: "Старая архивная сессия", cwd: game, isArchived: true });
writeFileSync(join(cur, "archived-sessions.idx"), JSON.stringify({ v: 1, archived: ["local_a5"] }));
rec(other, { sessionId: "local_b1", cliSessionId: "c-foreign", title: "Сессия другого аккаунта", cwd: game, lastActivityAt: 1 });
writeFileSync(join(app, "git-worktrees.json"), JSON.stringify({ schemaVersion: 2, worktrees: { album: { name: "album", path: wt, leasedBy: "local_a2", branch: "moku/album" } } }));
NODE
# The sandbox may not write under its HOME's .claude: the checkpoints folder there points into the project instead
mkdir -p "$(dirname "$PWD")/.claude" .checkpoints
[ -e "$(dirname "$PWD")/.claude/moku-checkpoints" ] || ln -s "$PWD/.checkpoints" "$(dirname "$PWD")/.claude/moku-checkpoints"
printf '# work\n' > README.md
git add -A && git -c user.name=eval -c user.email=eval@example.test commit -q -m init
