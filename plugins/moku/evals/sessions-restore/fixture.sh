#!/usr/bin/env bash
# After a new sign-in: a checkpoint of four sessions ("Игра" with "Альбом карточек" in a worktree and "Store" under
# it, "Координатор" at the top), and the new account where all four are open again, but as the app reopens them:
# side sessions not nested, the album's record without its worktree, modes back to default, the album's worktree
# still leased to its old id, and one stale session of an earlier trip ("Внедрение новых предметов") sharing it.
# What is left needs the app closed: one yes from the person, a restart, and nothing written by hand. The app of
# its own lives inside the sandbox; the project's settings point moku-rails at it and mark it as running.
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
const game = join(root, "work", "game");
const engine = join(root, "work", "engine");
const wt = join(game, ".claude", "worktrees", "album");
const checkpoints = join(home, ".claude", "moku-checkpoints");
for (const dir of [cur, wt, engine, checkpoints]) mkdirSync(dir, { recursive: true });

const folder = (cwd, worktree) => ({ cwd, originCwd: worktree ? game : cwd, folderPlace: { cwd, realPath: cwd }, ...(worktree ? { worktreePath: cwd, worktreeName: worktree, branch: "moku/album", sourceBranch: "main" } : {}) });
const saved = [
  { localId: "local_o1", cli: "c-game", title: "Игра: A Memory Missing", parent: null, cwd: game, worktree: null, branch: "", mode: "auto", transcript: true, record: { title: "Игра: A Memory Missing", titleSource: "user", permissionMode: "auto", ...folder(game) } },
  { localId: "local_o3", cli: "c-store", title: "Store", parent: "local_o1", cwd: game, worktree: null, branch: "", mode: "auto", transcript: true, record: { title: "Store", titleSource: "user", permissionMode: "auto", ...folder(game), spawnedFrom: { sessionId: "local_o1", sideSession: true, name: "store" }, startChain: { firstSessionId: "local_o1", depth: 1 } } },
  { localId: "local_o2", cli: "c-album", title: "Альбом карточек", parent: "local_o1", cwd: wt, worktree: "album", branch: "moku/album", mode: "auto", transcript: true, record: { title: "Альбом карточек", titleSource: "user", permissionMode: "auto", ...folder(wt, "album"), spawnedFrom: { sessionId: "local_o1", sideSession: true, name: "album" }, startChain: { firstSessionId: "local_o1", depth: 1 } } },
  { localId: "local_o4", cli: "c-coord", title: "Координатор: движок и редактор", parent: null, cwd: engine, worktree: null, branch: "", mode: "auto", transcript: true, record: { title: "Координатор: движок и редактор", titleSource: "user", permissionMode: "auto", ...folder(engine) } },
];
writeFileSync(join(checkpoints, "2026-11-18T09-37-19Z.json"), JSON.stringify({ version: 3, savedAt: "2026-11-18T09:37:19.000Z", account: "acct-old/org", self: null, sessions: saved, leases: { album: "local_o2" } }, null, 2));

const rec = (r) => writeFileSync(join(cur, `${r.sessionId}.json`), JSON.stringify({ isArchived: false, lastActivityAt: Date.now(), titleSource: "user", adoptedFromOtherSurface: true, fromCliTranscript: true, ...r }));
rec({ sessionId: "local_c-game", cliSessionId: "c-game", title: "Игра: A Memory Missing", permissionMode: "default", ...folder(game) });
rec({ sessionId: "local_c-store", cliSessionId: "c-store", title: "Store", permissionMode: "default", ...folder(game) });
rec({ sessionId: "local_c-album", cliSessionId: "c-album", title: "Альбом карточек", permissionMode: "default", cwd: wt, originCwd: wt, folderPlace: { cwd: wt, realPath: wt } });
rec({ sessionId: "local_c-coord", cliSessionId: "c-coord", title: "Координатор: движок и редактор", permissionMode: "auto", ...folder(engine) });
rec({ sessionId: "local_x9", cliSessionId: "c-items", title: "Внедрение новых предметов", permissionMode: "auto", ...folder(wt, "album"), spawnedFrom: { sessionId: "local_c-game", sideSession: true } });
writeFileSync(join(cur, "archived-sessions.idx"), JSON.stringify({ v: 1, archived: [] }));
writeFileSync(join(app, "git-worktrees.json"), JSON.stringify({ schemaVersion: 2, worktrees: { album: { name: "album", path: wt, leasedBy: "local_o2", branch: "moku/album" } } }));
NODE
printf '# work\n' > README.md
git add -A && git -c user.name=eval -c user.email=eval@example.test commit -q -m init
