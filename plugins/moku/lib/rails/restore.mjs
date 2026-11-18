/**
 * Restore: compare a checkpoint with what the app keeps now, and say exactly what is left to make the sidebar as it
 * was. The same function plans the restore, checks it and continues it, so running it again is always safe.
 *
 * One concern: the plan. It reads the current account's records and the worktree registry and returns, per saved
 * session, where it stands and what is wrong with it, and three phases of work:
 * 1. live, with the app open: `unarchive_session` for a session the account keeps archived; `--open` in the
 *    Terminal panel for one the account does not have (`claude --desktop --resume`);
 * 2. offline, one restart of the app after one yes: record fields the app keeps only in its files (the parent in
 *    the sidebar, the folder and worktree, the permission mode, the title), the worktree leases, and the sessions
 *    that are not in the checkpoint archived by their flag (never by `archive_session`, which removes the worktree
 *    another session may share);
 * 3. messages to the sessions whose id, or whose side sessions' ids, changed.
 * The restore is done when no saved session has a problem, nothing is extra and no message waits.
 */

/** Record fields that say which folder a session works in. */
const FOLDER_KEYS = ["cwd", "originCwd", "worktreePath", "worktreeName"];

/** Fields written with the folder, and removed when the saved record has none. */
const FOLDER_FIELDS = ["cwd", "originCwd", "branch", "sourceBranch", "worktreePath", "worktreeName", "gitAnchors", "gitAnchorsLookupOnly", "folderPlace"];

/** What a restart writes, in the order it is named to the person. */
const WHY_ORDER = ["the nesting in the sidebar", "the folders of worktree sessions", "the worktree leases", "the permission modes"];

/** Fields of the place in the sidebar. */
const LINEAGE_FIELDS = ["spawnedFrom", "startChain", "spawnSeed", "lineageDetached", "lineageDetachedBy"];

/**
 * @typedef {object} SessionState
 * @property {import("./checkpoint.mjs").SavedSession} saved
 * @property {string | null} now the local id it has now, null while the account does not have it
 * @property {"open" | "archived" | "missing"} state
 * @property {string[]} problems what still differs from the checkpoint, for a person
 */

/**
 * @typedef {object} Plan
 * @property {SessionState[]} sessions in the checkpoint's order
 * @property {{ localId: string, title: string, cli: string, file: string }[]} extra open sessions of the account the checkpoint
 *   does not have, except the one that runs the restore
 * @property {{ unarchive: SessionState[], open: SessionState[] }} live
 * @property {{ needed: boolean, why: string[], edits: import("./desktop.mjs").OfflineEdit[], leases: { name: string, from: string | null, to: string }[], archive: { dir: string, ids: string[] }[] }} offline
 * @property {{ sessionId: string, title: string }[]} titles titles to set with the tool when no restart is needed
 * @property {{ to: string, title: string, text: string }[]} messages
 * @property {Map<string, string>} idMap old local id → local id now
 * @property {boolean} done
 */

/**
 * The plan for a checkpoint against the current account.
 *
 * @param {import("./checkpoint.mjs").Checkpoint} checkpoint
 * @param {import("./desktop.mjs").Account} account
 * @param {Record<string, Record<string, any>>} worktrees the app's worktree registry
 * @param {{ self?: string | null, sent?: Set<string> }} [options] `self` is the
 *   cli id of the session that runs the restore; `sent` the sessions whose message was delivered
 * @returns {Plan}
 */
export function planRestore(checkpoint, account, worktrees, { self = null, sent = new Set() } = {}) {
  const matched = new Set();
  const sessions = checkpoint.sessions.map((saved) => {
    const record = matchRecord(account.records, saved);
    if (record) matched.add(record);
    return { saved, record };
  });
  const idMap = new Map(sessions.filter((entry) => entry.record).map((entry) => [entry.saved.localId, /** @type {any} */ (entry.record).localId]));
  const openIds = new Set(account.records.filter((record) => !record.archived).map((record) => record.localId));

  const extra = account.records
    .filter((record) => !record.archived && !matched.has(record) && record.cli !== self && record.cli !== checkpoint.self)
    .map((record) => ({ localId: record.localId, title: typeof record.data.title === "string" ? record.data.title : "", cli: record.cli, file: record.file }));

  /** @type {SessionState[]} */
  const states = [];
  const edits = [];
  const why = new Set();
  let titleOnly = [];

  for (const { saved, record } of sessions) {
    if (!record) {
      states.push({ saved, now: null, state: "missing", problems: [saved.transcript ? "not in the app yet" : "its transcript is not on this machine, so it cannot be opened again"] });
      continue;
    }
    if (record.archived) {
      states.push({ saved, now: record.localId, state: "archived", problems: ["archived in this account"] });
      continue;
    }

    const problems = [];
    const set = {};
    const unset = new Set();
    const data = record.data;

    // The place in the sidebar: under the parent's id now, or at the top
    const want = saved.parent ? (idMap.get(saved.parent) ?? null) : null;
    const parentNow = data.lineageDetached !== true && typeof data.spawnedFrom?.sessionId === "string" && openIds.has(data.spawnedFrom.sessionId) ? data.spawnedFrom.sessionId : null;
    if (saved.parent && !want) problems.push("its parent is not open yet");
    else if (parentNow !== want) {
      problems.push(want ? `not nested under "${titleOf(checkpoint, saved.parent)}"` : "nested, but it was at the top level");
      Object.assign(set, lineage(saved, want, idMap));
      for (const field of LINEAGE_FIELDS) if (!(field in set)) unset.add(field);
      why.add("the nesting in the sidebar");
    }

    // The folder: the app gives a reopened session its own folder fields, which lose the worktree
    if (FOLDER_KEYS.some((key) => !same(data[key], saved.record[key]))) {
      problems.push(same(data.cwd, saved.record.cwd) ? `its record lost its worktree ${saved.worktree ?? ""}`.trim() : `works in ${data.cwd || "no folder"}, not in ${saved.cwd}`);
      for (const field of FOLDER_FIELDS) {
        if (saved.record[field] === undefined) unset.add(field);
        else set[field] = saved.record[field];
      }
      unset.add("priorErrorMark");
      why.add("the folders of worktree sessions");
    }

    if ((data.permissionMode ?? "default") !== saved.mode) {
      problems.push(`permission mode ${data.permissionMode ?? "default"}, was ${saved.mode}`);
      set.permissionMode = saved.mode;
      why.add("the permission modes");
    }

    if (saved.title && data.title !== saved.title) {
      problems.push(`titled "${data.title ?? ""}"`);
      titleOnly.push({ sessionId: record.localId, title: saved.title, file: record.file, titleSource: saved.record.titleSource });
    }

    for (const field of Object.keys(set)) unset.delete(field);
    if (Object.keys(set).length > 0 || unset.size > 0) edits.push({ file: record.file, set, unset: [...unset].filter((field) => field in data) });
    states.push({ saved, now: record.localId, state: "open", problems });
  }

  // Leases: each worktree goes to the session that held it at the save, else to the first one that works in it
  const leases = [];
  for (const name of new Set(checkpoint.sessions.map((saved) => saved.worktree).filter(Boolean))) {
    const users = states.filter((entry) => entry.saved.worktree === name && entry.state === "open");
    if (users.length === 0) continue;
    const holder = checkpoint.leases?.[/** @type {string} */ (name)];
    const to = (holder && idMap.get(holder)) || /** @type {string} */ (users[0].now);
    const entry = worktrees[/** @type {string} */ (name)];
    if (!entry) {
      for (const user of users) user.problems.push(`the app has no worktree named ${name}: it may make a new one for the session`);
      continue;
    }
    if (entry.leasedBy === to && entry.leaseCleared !== true) continue;
    leases.push({ name: /** @type {string} */ (name), from: typeof entry.leasedBy === "string" ? entry.leasedBy : null, to });
    for (const user of users) user.problems.push(`its worktree ${name} is leased to ${entry.leasedBy ?? "nobody"}, so its turns fail`);
    why.add("the worktree leases");
  }

  const live = { unarchive: states.filter((entry) => entry.state === "archived"), open: states.filter((entry) => entry.state === "missing" && entry.saved.transcript) };
  const liveLeft = live.unarchive.length + live.open.length > 0;

  // Titles ride along with a restart; without one, the tool sets them
  const needed = !liveLeft && (why.size > 0 || extra.length > 0);
  if (needed) {
    for (const entry of titleOnly) {
      const edit = edits.find((item) => item.file === entry.file);
      const fields = { title: entry.title, ...(entry.titleSource ? { titleSource: entry.titleSource } : {}) };
      if (edit) Object.assign(edit.set, fields);
      else edits.push({ file: entry.file, set: fields, unset: [] });
    }
    titleOnly = [];
  }

  // A session not in the checkpoint is archived by its flag and the index: its worktree and its side sessions stay
  const archiveEdits = needed ? extra.map((entry) => ({ file: entry.file, set: { isArchived: true }, unset: [] })) : [];
  const reasons = WHY_ORDER.filter((reason) => why.has(reason));
  if (extra.length > 0) reasons.push(`the archive flag of ${extra.length} session${extra.length === 1 ? "" : "s"} not in the checkpoint (${extra.map((entry) => `"${entry.title}"`).join(", ")}; ${extra.length === 1 ? "its folder stays" : "their folders stay"})`);
  const offline = { needed, why: reasons, edits: needed ? [...edits, ...archiveEdits] : [], leases: needed ? leases : [], archive: needed && extra.length > 0 ? [{ dir: account.dir, ids: extra.map((entry) => entry.localId) }] : [] };

  const settled = !liveLeft && !needed;
  const messages = settled ? idMessages(states).filter((message) => !sent.has(message.to)) : [];
  const titles = settled ? titleOnly.map(({ sessionId, title }) => ({ sessionId, title })) : [];
  const done = settled && titles.length === 0 && messages.length === 0 && states.every((entry) => entry.problems.length === 0);

  return { sessions: states, extra, live, offline, titles, messages, idMap, done };
}

/**
 * The record of the current account that holds a saved session: one with its cli id, or its old local id when the
 * sessions come back to the account they were saved from. One not archived wins over an archived one, the newest
 * over older ones: an account the person used before may keep an archived copy from an earlier trip (F126 on
 * 2026-11-18 opened into its record of 2026-11-15, under another local id than `local_<cli>`).
 *
 * @param {import("./desktop.mjs").AppRecord[]} records
 * @param {import("./checkpoint.mjs").SavedSession} saved
 * @returns {import("./desktop.mjs").AppRecord | undefined}
 */
function matchRecord(records, saved) {
  return records
    .filter((record) => record.cli === saved.cli || record.localId === saved.localId)
    .sort((a, b) => Number(a.archived) - Number(b.archived) || (Number(b.data.lastActivityAt) || 0) - (Number(a.data.lastActivityAt) || 0))[0];
}

/**
 * The lineage fields that put a session under `parent`, or at the top when `parent` is null.
 *
 * @param {import("./checkpoint.mjs").SavedSession} saved
 * @param {string | null} parent its parent's local id now
 * @param {Map<string, string>} idMap
 * @returns {Record<string, any>}
 */
function lineage(saved, parent, idMap) {
  if (!parent) return {};

  const chain = saved.record.startChain;
  const first = chain?.firstSessionId ? (idMap.get(chain.firstSessionId) ?? parent) : parent;
  return {
    spawnedFrom: { ...(saved.record.spawnedFrom ?? {}), sessionId: parent },
    startChain: { ...(chain ?? { depth: 1 }), firstSessionId: first },
    ...(saved.record.spawnSeed ? { spawnSeed: saved.record.spawnSeed } : {}),
  };
}

/**
 * One message per session whose id changed or whose side sessions' ids changed: notes, HANDOFF and memory name the
 * old ids, and a message to an old id goes nowhere.
 *
 * @param {SessionState[]} states
 * @returns {{ to: string, title: string, text: string }[]}
 */
function idMessages(states) {
  const messages = [];
  for (const entry of states) {
    if (!entry.now) continue;
    const moved = entry.now !== entry.saved.localId;
    const children = states.filter((child) => child.saved.parent === entry.saved.localId && child.now && child.now !== child.saved.localId);
    if (!moved && children.length === 0) continue;

    const lines = [moved ? `The sessions were restored under a new sign-in, and your id changed: ${entry.now} (was ${entry.saved.localId}).` : `The sessions were restored under a new sign-in. Your id stays ${entry.now}.`];
    if (children.length > 0) {
      lines.push("The sessions you started have new ids. Replace the old ids wherever you wrote them (notes, HANDOFF, memory) and message them by the new one:");
      for (const child of children) lines.push(`- ${child.saved.title || child.saved.cli}: ${child.saved.localId} → ${child.now}`);
    }
    messages.push({ to: entry.now, title: entry.saved.title, text: lines.join("\n") });
  }
  return messages;
}

/**
 * @param {import("./checkpoint.mjs").Checkpoint} checkpoint
 * @param {string | null} localId
 * @returns {string}
 */
function titleOf(checkpoint, localId) {
  return checkpoint.sessions.find((session) => session.localId === localId)?.title || localId || "";
}

/**
 * Whether two field values are the same, by content.
 *
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function same(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
