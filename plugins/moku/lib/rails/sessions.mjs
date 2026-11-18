/**
 * The two session commands: `checkpoint` saves the sidebar of the desktop app when the person asks, and
 * `resume-checkpoint` brings it back under the current sign-in, exactly as it was.
 *
 * One concern: turn the snapshot and the plan into commands, steps for the session that runs them, and lines for a
 * person. A restore is three phases, each finished before the next is planned: sessions the app does not show
 * (`unarchive_session`, `--open` in the Terminal panel), then one restart of the app for what only its files hold
 * (`--offline-in-terminal`, after the person's one yes), then the messages about changed ids. `--json` with no other
 * flag plans, checks and lists what is left; it never changes anything, so it is safe to run at any time.
 */

import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { checkpointFolder, checkpointsDir, latestCheckpoint, readCheckpoint, takeSnapshot, treeLines, writeCheckpoint } from "./checkpoint.mjs";
import { currentAccountKey, desktopAppRunning, desktopRoot, inTerminal, openInDesktop, readAccount, readWorktrees, worktreesFile, writeOffline } from "./desktop.mjs";
import { planRestore } from "./restore.mjs";
import { prepareFolder } from "./worktrees.mjs";

/** @typedef {import("./commands.mjs").Result} Result */
/** @typedef {import("./commands.mjs").Args} Args */

/** This CLI, by absolute path, for the lines other processes run. */
const RAILS_BIN = fileURLToPath(new URL("../../bin/moku-rails", import.meta.url));

/**
 * Save the sessions the sidebar shows: every session of the current account that is not archived, with its place
 * in the tree, title, folder, worktree, branch and permission mode. Run only when the person asks for it; nothing
 * saves on its own.
 *
 * @param {Args} args flags: --drop <local or cli ids, comma-separated>, --account <account>/<org>
 * @returns {Result}
 */
export function checkpoint({ flags }) {
  const key = currentAccountKey(text(flags.account));
  if (!key) return fail(`The desktop app keeps no Code tab sessions in ${desktopRoot()}: nothing to save.`);

  const drop = text(flags.drop)?.split(",").map((id) => id.trim()).filter(Boolean) ?? [];
  const records = readAccount(key).records;
  const saved = takeSnapshot({ key, self: process.env.CLAUDE_CODE_SESSION_ID ?? null, drop });
  if (saved.sessions.length === 0) return fail(`The sidebar of account ${key} shows no session: nothing saved.`);

  const file = writeCheckpoint(saved);
  const archived = records.filter((record) => record.archived).length;
  const unread = saved.sessions.filter((session) => !session.transcript);
  const lines = [
    `Saved the ${saved.sessions.length} session${plural(saved.sessions.length)} of the sidebar (account ${key}) to ${file}:`,
    ...treeLines(saved.sessions, (session) => [`"${session.title || session.cli.slice(0, 8)}"`, session.worktree ? `worktree ${session.worktree}` : session.cwd, session.branch, session.mode].filter(Boolean).join(" · ")),
    `Left out: ${archived} archived session${plural(archived)} of this account${drop.length > 0 ? `, ${drop.length} named with --drop` : ""}, and every session of other accounts.`,
    ...(saved.transcriptsUnread ? [`Could not read ${saved.transcriptsUnread} here, so whether each transcript is on this machine was not checked.`] : []),
    ...unread.map((session) => `Warning: "${session.title}" has no transcript on this machine, so it cannot be opened again after a sign-in.`),
    "After the new sign-in, the person says \"restore the sessions\" (\"восстанови сессии\") in any session: the restore is done with your tools.",
  ];
  return { code: 0, lines, data: { file, account: key, sessions: saved.sessions.map(summary), archivedLeftOut: archived } };
}

/**
 * Bring the saved sidebar back under the current sign-in, or say what is left and why.
 *
 * @param {Args} args positional: [file]; flags: --open, --offline, --offline-in-terminal, --sent,
 *   --account <account>/<org>, --self <cli id>
 * @returns {Result}
 */
export function resumeCheckpoint({ positional, flags }) {
  const given = positional[0] ?? [flags.open, flags.offline, flags["offline-in-terminal"], flags.sent].find((value) => typeof value === "string");
  const file = given ?? latestCheckpoint();
  const saved = file ? readCheckpoint(file) : undefined;
  if (!file || !saved) return refused(file ? `${file} is not a checkpoint of this version: save the sessions again with \`moku-rails checkpoint\`.` : `there is no checkpoint in ${checkpointsDir()}: the sessions were never saved here.`);

  // Outside the app no environment names the account, and the newest folder may be another sign-in's
  const named = text(flags.account) ?? text(process.env.MOKU_DESKTOP_ACCOUNT) ?? (process.env.CLAUDE_CODE_ACCOUNT_UUID ? "env" : undefined);
  if (flags.offline && !named) return refused("`--offline` runs with the app closed, where nothing names the current account: pass `--account <account>/<org>`, as the `--offline-in-terminal` script does. Nothing was written.");
  const key = currentAccountKey(text(flags.account));
  if (!key) return fail(`The desktop app keeps no Code tab sessions in ${desktopRoot()}.`);
  const self = text(flags.self) ?? process.env.CLAUDE_CODE_SESSION_ID ?? null;
  const context = { file, saved, key, self };

  if (flags.open) return openMissing(context);
  if (flags.offline) return applyOffline(context);
  if (flags["offline-in-terminal"]) return restartInTerminal(context);
  if (flags.sent) return markSent(context);
  return report(context);
}

/**
 * @typedef {{ file: string, saved: import("./checkpoint.mjs").Checkpoint, key: string, self: string | null }} Context
 */

/**
 * The plan against the app's files now.
 *
 * @param {Context} context
 * @returns {import("./restore.mjs").Plan}
 */
function plan({ file, saved, key, self }) {
  return planRestore(saved, readAccount(key), readWorktrees(worktreesFile()), { self, sent: sentIds(file) });
}

/**
 * Where every saved session stands, what is extra, and the steps left, in order.
 *
 * @param {Context} context
 * @returns {Result}
 */
function report(context) {
  const result = plan(context);
  const steps = stepsFor(context, result);
  const restored = result.sessions.filter((entry) => entry.state === "open" && entry.problems.length === 0).length;
  const total = result.sessions.length;
  const head = result.done
    ? `Restored: all ${total} session${plural(total)} of ${context.saved.savedAt} are in the sidebar as saved, nothing extra.`
    : `Restore of ${context.saved.savedAt}: ${restored} of ${total} session${plural(total)} as saved; not done yet.`;

  const lines = [
    head,
    ...treeLines(
      result.sessions.map((entry) => ({ ...entry, localId: entry.saved.localId, parent: entry.saved.parent, title: entry.saved.title })),
      (entry) => `${entry.problems.length === 0 ? "ok" : "NOT YET"} "${entry.saved.title}" ${entry.now ?? "(not in the app)"}${entry.problems.length > 0 ? `: ${entry.problems.join("; ")}` : ""}`,
    ),
    ...result.extra.map((entry) => `Extra: "${entry.title}" ${entry.localId} is open here and not in the checkpoint${result.offline.needed ? ": the restart archives it (by its flag, its worktree stays)" : ""}.`),
    ...(steps.length > 0 ? ["Steps left, in order (data.steps has each input whole):", ...steps.map((step, index) => `${index + 1}. ${step.tool}${stepDetail(step)}: ${step.why}`)] : []),
  ];

  return {
    code: 0,
    lines,
    data: {
      file: context.file,
      savedAt: context.saved.savedAt,
      account: context.key,
      done: result.done,
      sessions: result.sessions.map((entry) => ({ title: entry.saved.title, was: entry.saved.localId, now: entry.now, state: entry.state, problems: entry.problems })),
      extra: result.extra.map(({ localId, title }) => ({ localId, title })),
      offline: { needed: result.offline.needed, why: result.offline.why },
      idMap: Object.fromEntries(result.idMap),
      steps,
    },
  };
}

/**
 * The tool calls that take the restore one phase further. Only the session that runs the restore makes them; the
 * person answers one question at most.
 *
 * @param {Context} context
 * @param {import("./restore.mjs").Plan} result
 * @returns {{ tool: string, input: Record<string, string>, why: string }[]}
 */
function stepsFor({ file, key, self }, result) {
  const steps = [];
  const where = `${quote(file)} --account ${quote(key)}`;
  for (const entry of result.live.unarchive) steps.push({ tool: "unarchive_session", input: { session_id: /** @type {string} */ (entry.now) }, why: `"${entry.saved.title}" is archived in this account` });
  if (result.live.open.length > 0) {
    steps.push({
      tool: "run_in_terminal",
      input: { command: `${quote(RAILS_BIN)} resume-checkpoint --open ${where}`, title: "moku restore" },
      why: `${result.live.open.length} session${plural(result.live.open.length)} not in the app yet (${result.live.open.map((entry) => `"${entry.saved.title}"`).join(", ")}); in the app's Terminal panel, never Bash; read_terminal until a line starts with "Opened"`,
    });
  }
  if (steps.length > 0) return [...steps, { tool: "Bash", input: { command: `${quote(RAILS_BIN)} resume-checkpoint --json ${where}` }, why: "then check again: the next phase is planned from what the app has" }];

  if (result.offline.needed) {
    steps.push({ tool: "AskUserQuestion", input: { question: `To finish the restore, Claude has to quit and open again (about 10 seconds) and write into its files, after a backup: ${result.offline.why.join("; ")}. Go ahead?` }, why: "the one yes of the restore; ask it once, with this list" });
    steps.push({ tool: "Bash", input: { command: `${quote(RAILS_BIN)} resume-checkpoint --offline-in-terminal ${where}${self ? ` --self ${quote(self)}` : ""}` }, why: "only after the yes: Terminal.app quits Claude, writes the files after a backup and opens Claude again; when the app is back, run --json again" });
    return steps;
  }

  for (const entry of result.titles) steps.push({ tool: "set_session_title", input: { session_id: entry.sessionId, title: entry.title }, why: "the app renamed it" });
  for (const message of result.messages) steps.push({ tool: "send_message", input: { session_id: message.to, message: message.text }, why: `"${message.title}": its id or its side sessions' ids changed` });
  if (result.messages.length > 0) steps.push({ tool: "Bash", input: { command: `${quote(RAILS_BIN)} resume-checkpoint --sent ${where}` }, why: "after the messages are delivered, so no later run lists them again" });
  return steps;
}

/**
 * Open each saved session the account does not have, parents first, in the app's Terminal panel. A worktree whose
 * folder is gone is added again from its branch first. Each one is checked in the app's files, not by the exit code.
 *
 * @param {Context} context
 * @returns {Result}
 */
function openMissing(context) {
  if (!inTerminal()) return refused(`\`--open\` needs a terminal, and the Bash tool is none: run it with run_in_terminal in the app's Terminal panel. Nothing was changed.`);

  const todo = plan(context).live.open;
  const lines = [];
  const failed = [];
  for (const entry of todo) {
    const { cwd, branch, record } = entry.saved;
    if (!existsSync(cwd)) {
      const folder = prepareFolder({ cwd, repo: record.originCwd, branch });
      if (folder.line) lines.push(folder.line);
      if (!existsSync(cwd)) {
        failed.push(`"${entry.saved.title}": ${folder.line || `its folder ${cwd} is gone`}`);
        continue;
      }
    }
    const opened = openInDesktop(cwd, entry.saved.cli, context.key);
    lines.push(opened.ok ? `Opened "${entry.saved.title}" as ${opened.localId}.` : `Did not open "${entry.saved.title}": ${opened.why}.`);
    if (!opened.ok) failed.push(`"${entry.saved.title}": ${opened.why}`);
  }

  const head = `Opened ${todo.length - failed.length} of ${todo.length} session${plural(todo.length)} the app did not have.`;
  return { code: failed.length > 0 ? 1 : 0, lines: [head, ...lines, `Next: ${RAILS_BIN} resume-checkpoint --json, from the session.`], data: { opened: todo.length - failed.length, failed } };
}

/**
 * Write, with the app closed, what only its files hold: parents, folders, modes and titles of the restored
 * sessions, the worktree leases, and the archive flag of sessions not in the checkpoint. Every file is backed up
 * first, beside the checkpoint.
 *
 * @param {Context} context
 * @returns {Result}
 */
function applyOffline(context) {
  if (desktopAppRunning()) return refused("the desktop app is running, and it writes its files back from memory: quit it first. Nothing was written.");

  const result = plan(context);
  if (result.live.open.length + result.live.unarchive.length > 0) return refused(`${result.live.open.length + result.live.unarchive.length} saved session(s) are not open in the app yet: open them first. Nothing was written.`);
  if (!result.offline.needed) return ok("The app's files already hold every parent, folder, lease and mode of the checkpoint: nothing written.");

  const at = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = join(checkpointFolder(context.file), `backup-${at}`);
  const written = writeOffline(result.offline, backup, worktreesFile());
  const log = { at, written, edits: result.offline.edits, leases: result.offline.leases, archived: result.extra };
  writeFileSync(join(checkpointFolder(context.file), `offline-${at}.json`), `${JSON.stringify(log, null, 2)}\n`);

  return ok(
    `Wrote ${result.offline.why.join(", ")}: ${result.offline.edits.length} record${plural(result.offline.edits.length)}, ${result.offline.leases.length} lease${plural(result.offline.leases.length)}, ${result.extra.length} archived. The files as they were are in ${backup}.`,
  );
}

/**
 * Open Terminal.app with a script that quits Claude, runs `--offline` and opens Claude again: Terminal.app outlives
 * the app it quits. Run only after the person's yes.
 *
 * @param {Context} context
 * @returns {Result}
 */
function restartInTerminal(context) {
  const result = plan(context);
  if (!result.offline.needed) return ok("Nothing needs the app closed: no restart.");

  const env = ["MOKU_DESKTOP_SESSIONS", "MOKU_HOME"].filter((name) => process.env[name]).map((name) => `export ${name}=${quote(/** @type {string} */ (process.env[name]))}`);
  const script = [
    "#!/bin/zsh",
    ...env,
    `osascript -e 'quit app "Claude"'`,
    "while pgrep -xq Claude; do sleep 1; done",
    `${quote(RAILS_BIN)} resume-checkpoint --offline ${quote(context.file)} --account ${quote(context.key)}${context.self ? ` --self ${quote(context.self)}` : ""}`,
    "open -a Claude",
    'echo "Done. This window can be closed."',
  ].join("\n");
  const folder = checkpointFolder(context.file);
  mkdirSync(folder, { recursive: true });
  const command = join(folder, "restart.command");
  writeFileSync(command, `${script}\n`);
  chmodSync(command, 0o755);

  if (process.env.MOKU_DRY_RUN === "1") return { code: 0, lines: [`Would open ${command} in Terminal.app.`], data: { command, script } };
  // The script quits the real app: only for the app's own folder, never for a copy (a test, an eval sandbox)
  if (!existsSync(join(dirname(desktopRoot()), "config.json"))) return refused(`${dirname(desktopRoot())} is not the desktop app's own folder (it has no config.json), so no app is quit for it. Nothing was written.`);
  const run = spawnSync("open", ["-a", "Terminal", command], { encoding: "utf8", timeout: 30_000 });
  if (run.status !== 0) return fail(`Terminal.app did not open ${command} (${(run.stderr || "").trim() || `exit ${run.status}`}). Nothing was written.`);
  return { code: 0, lines: [`Terminal.app runs ${command}: Claude quits, the files are written after a backup, and Claude opens again. When it is back, run \`resume-checkpoint --json\` to check.`], data: { command } };
}

/**
 * Record the messages listed now as delivered.
 *
 * @param {Context} context
 * @returns {Result}
 */
function markSent(context) {
  const now = plan(context).messages.map((message) => message.to);
  const file = join(checkpointFolder(context.file), "sent.json");
  mkdirSync(checkpointFolder(context.file), { recursive: true });
  writeFileSync(file, `${JSON.stringify([...sentIds(context.file), ...now])}\n`);
  return { code: 0, lines: [now.length > 0 ? `Marked ${now.length} message${plural(now.length)} as delivered.` : "No message was waiting."], data: { marked: now } };
}

/**
 * @param {string} file the checkpoint
 * @returns {Set<string>}
 */
function sentIds(file) {
  try {
    const list = JSON.parse(readFileSync(join(checkpointFolder(file), "sent.json"), "utf8"));
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

/**
 * What a step does, in a few words: the question it asks, the command it runs, the session it touches.
 *
 * @param {{ tool: string, input: Record<string, string> }} step
 * @returns {string}
 */
function stepDetail({ tool, input }) {
  if (tool === "AskUserQuestion") return ` "${input.question}"`;
  if (tool === "Bash" || tool === "run_in_terminal") return ` \`${input.command}\``;
  return input.session_id ? ` ${input.session_id}` : "";
}

/**
 * @param {import("./checkpoint.mjs").SavedSession} session
 */
function summary(session) {
  return { localId: session.localId, title: session.title, parent: session.parent, cwd: session.cwd, worktree: session.worktree, branch: session.branch, mode: session.mode, transcript: session.transcript };
}

/** @param {unknown} value */
function text(value) {
  return typeof value === "string" && value ? value : undefined;
}

/** @param {number} count */
function plural(count) {
  return count === 1 ? "" : "s";
}

/** @param {string} value */
function quote(value) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/** @param {string} line @returns {Result} */
function ok(line) {
  return { code: 0, lines: [line] };
}

/** @param {string} line @returns {Result} */
function fail(line) {
  return { code: 1, lines: [line] };
}

/** @param {string} line @returns {Result} */
function refused(line) {
  return { code: 2, lines: [`Refused: ${line}`] };
}
