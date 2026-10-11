/**
 * The agents running inside a station, and what an agent's ending looks like.
 *
 * `SubagentStart` writes one file per running agent under `.planning/agents/`, `SubagentStop` removes
 * it. One file per agent, so parallel builders never race on a shared ledger. `status` names them,
 * `moku-rails pause` warns about them, and the stop hook lets a turn end while they run.
 *
 * An agent that dies before its first turn gets a start and no stop, so its record would stay forever.
 * Three things drop such a record: the `Agent` failure hook (the launch that failed), the stop hook
 * (the session's turn ended and the harness no longer lists the agent), and age (a record of a session
 * that is gone).
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { laneOf } from "../rails/ledger.mjs";

const AGENTS_DIR = join(".planning", "agents");
const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Only moku agents, plain or plugin-qualified (`moku:moku-builder`, `moku-web:moku-web-validator`). */
export const MOKU_AGENT = /(^|:)(moku-|design-generator|brainstorm-challenger)/;

/** A record older than this has no live agent behind it: its session ended without a stop hook. */
export const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

/** What the orchestrator does with an agent that could not start at all. */
export const LAUNCH_FAILURE_INSTRUCTION = "A launch failure is not a missing report: the agent never had a turn, so there is nothing to resume. Spawn it again exactly once, the same way. If the launch fails again, record the agent as FAIL (launch failure) with the error text word for word, report it as not run, and go on. Do not do its work in its place and do not try a third time.";

/** What the orchestrator does with an agent that ended without a report. */
export const RESUME_INSTRUCTION = 'A missing report is a failure, not a delay. Resume the agent exactly once with SendMessage: "Deliver your report now: the output contract with an honest verdict on what is done. Do no more work." Take what comes back. If it still has no report, record the agent as FAIL (no report), use what it left on disk, and go on. Do not wait open-ended and do not send a second reminder.';

/** @typedef {{ id: string, type: string, startedAt: string, session?: string, lane?: string }} RunningAgent */

/**
 * Record that an agent started inside this project.
 *
 * @param {string} root project root
 * @param {{ id: string, type: string, session?: string }} agent `session` is the id of the session that spawned it
 * @example
 * registerAgent("/work/site", { id: "agent-1", type: "moku:moku-builder", session: "abc" });
 */
export function registerAgent(root, agent) {
  mkdirSync(join(root, AGENTS_DIR), { recursive: true });
  writeFileSync(agentFile(root, agent.id), `${JSON.stringify({ ...agent, lane: laneOf(root), startedAt: new Date().toISOString() })}\n`);
}

/**
 * Forget an agent that stopped.
 *
 * @param {string} root project root
 * @param {string} id agent id
 * @example
 * forgetAgent("/work/site", "agent-1");
 */
export function forgetAgent(root, id) {
  rmSync(agentFile(root, id), { force: true });
}

/**
 * Forget the one record a failed launch left behind: the agent of this type that this session started.
 * With several records of the type nobody can tell which launch failed, so none is dropped; the stop
 * hook and age take those.
 *
 * @param {string} root project root
 * @param {{ type: string, session?: string }} launch the agent type of the failed `Agent` call, and its session
 * @returns {boolean} true when a record was dropped
 * @example
 * forgetFailedLaunch(root, { type: "moku:moku-architecture-validator", session: "abc" });
 */
export function forgetFailedLaunch(root, launch) {
  if (!launch.session) return false;

  const mine = runningAgents(root).filter((agent) => agent.session === launch.session && plainType(agent.type) === plainType(launch.type));
  if (mine.length !== 1) return false;

  forgetAgent(root, mine[0].id);

  return true;
}

/**
 * Forget the records of a session whose turn has ended, except for agents the harness still lists.
 * A foreground agent is over when the turn ends, so only a background agent may keep its record. A
 * listed subagent with no `agent_type` could be any of them: then every record stays.
 *
 * @param {string} root project root
 * @param {string | undefined} session the session whose turn ended
 * @param {unknown} backgroundTasks the stop payload's `background_tasks`; anything but an array drops nothing
 * @example
 * forgetFinished(root, payload.session_id, payload.background_tasks);
 */
export function forgetFinished(root, session, backgroundTasks) {
  if (!session || !Array.isArray(backgroundTasks)) return;

  const live = backgroundTasks.filter((task) => task && (task.type === "subagent" || task.type === "agent" || typeof task.agent_type === "string"));
  if (live.some((task) => typeof task.agent_type !== "string")) return;

  const liveTypes = new Set(live.map((task) => plainType(task.agent_type)));
  for (const agent of runningAgents(root)) {
    if (agent.session === session && !liveTypes.has(plainType(agent.type))) forgetAgent(root, agent.id);
  }
}

/**
 * The agents recorded as running, oldest first. A record past `STALE_AFTER_MS` is deleted on the way.
 *
 * @param {string} root project root
 * @returns {RunningAgent[]}
 * @example
 * runningAgents("/work/site").map((agent) => agent.type); // ["moku:moku-builder"]
 */
export function runningAgents(root) {
  const dir = join(root, AGENTS_DIR);
  if (!existsSync(dir)) return [];

  const agents = [];
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".json"))) {
    // A file another hook is writing right now, or a damaged one, is skipped rather than fatal
    try {
      const agent = JSON.parse(readFileSync(join(dir, file), "utf8"));

      // No stop ever came for it: the agent crashed before its first turn, or its session is gone
      if (Date.now() - Date.parse(agent.startedAt) > STALE_AFTER_MS) rmSync(join(dir, file), { force: true });
      else agents.push(agent);
    } catch {
      /* skipped */
    }
  }

  // Every worktree shares the folder: an agent counts only in the checkout that started it
  const lane = laneOf(root);

  return agents.filter((agent) => (agent.lane ?? "") === lane).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

/**
 * One line naming the running agents: `2 agent(s) running: moku:moku-builder ×2`.
 *
 * @param {RunningAgent[]} agents
 * @returns {string}
 * @example
 * describeAgents(runningAgents(root));
 */
export function describeAgents(agents) {
  const counts = new Map();
  for (const agent of agents) counts.set(agent.type, (counts.get(agent.type) ?? 0) + 1);

  return `${agents.length} agent(s) running: ${[...counts].map(([type, n]) => (n > 1 ? `${type} ×${n}` : type)).join(", ")}`;
}

/**
 * The `maxTurns` of an agent definition, found by its frontmatter name in this plugin and its sibling
 * packs (the marketplace installs them next to each other). Undefined when no definition is found, and
 * for an agent that has no limit (builders, the e2e agents, the design generator).
 *
 * @param {string} agentType plain or plugin-qualified agent type
 * @returns {number | undefined}
 * @example
 * agentLimit("moku:moku-skeptic"); // 40
 */
export function agentLimit(agentType) {
  const name = plainType(agentType);

  for (const dir of agentDirs()) {
    for (const file of readdirSync(dir).filter((entry) => entry.endsWith(".md"))) {
      const text = readFileSync(join(dir, file), "utf8");
      if (!new RegExp(`^name:\\s*${name}\\s*$`, "m").test(text)) continue;

      const limit = /^maxTurns:\s*(\d+)\b/m.exec(text);
      return limit ? Number(limit[1]) : undefined;
    }
  }

  return undefined;
}

/**
 * How many assistant turns a subagent transcript holds: one per assistant message id.
 * Undefined when the transcript is missing or unreadable.
 *
 * @param {string | undefined} transcriptPath the `agent_transcript_path` of a SubagentStop payload
 * @returns {number | undefined}
 * @example
 * turnsUsed(payload.agent_transcript_path); // 150
 */
export function turnsUsed(transcriptPath) {
  if (typeof transcriptPath !== "string" || !existsSync(transcriptPath)) return undefined;

  const ids = new Set();
  let index = 0;
  for (const line of readFileSync(transcriptPath, "utf8").split("\n")) {
    if (!line.includes('"type":"assistant"')) continue;

    try {
      const entry = JSON.parse(line);
      if (entry.type === "assistant") ids.add(entry.message?.id ?? `line-${index}`);
    } catch {
      /* a partial last line */
    }
    index += 1;
  }

  return ids.size;
}

/**
 * The report an agent handed back in its current run: the `message` of its last `SubagentHandback`
 * call. The harness delivers a report through that tool, so the text is in the call and not in the
 * agent's last message. A prompt that came after the call (new work for a resumed agent) starts a new
 * run, and the old report no longer counts.
 *
 * @param {string | undefined} transcriptPath the `agent_transcript_path` of a SubagentStop payload
 * @returns {string} the report, or "" when the run has none or the transcript cannot be read
 * @example
 * extractContract(handedBack(payload.agent_transcript_path));
 */
export function handedBack(transcriptPath) {
  if (typeof transcriptPath !== "string" || !existsSync(transcriptPath)) return "";

  let report = "";
  for (const line of readFileSync(transcriptPath, "utf8").split("\n")) {
    if (!line.includes('"type":"assistant"') && !line.includes('"type":"user"')) continue;

    try {
      const entry = JSON.parse(line);
      const content = entry.message?.content;

      if (entry.type === "assistant" && Array.isArray(content)) {
        const call = content.findLast((block) => block?.type === "tool_use" && block.name === "SubagentHandback");
        if (call) report = String(call.input?.message ?? "");
      }

      // A tool result is the run going on; anything else a user entry carries is a new prompt
      if (entry.type === "user" && (!Array.isArray(content) || content.some((block) => block?.type !== "tool_result"))) report = "";
    } catch {
      /* a partial last line */
    }
  }

  return report;
}

/**
 * Whether an agent that ended without a report hit its turn limit, as far as the transcript tells.
 *
 * @param {{ agent_type?: string, agent_transcript_path?: string }} payload SubagentStop payload
 * @returns {{ limit?: number, used?: number, hitLimit: boolean }}
 * @example
 * turnBudget({ agent_type: "moku:moku-skeptic", agent_transcript_path: "/tmp/agent.jsonl" });
 */
export function turnBudget(payload) {
  const limit = agentLimit(String(payload.agent_type ?? ""));
  const used = turnsUsed(payload.agent_transcript_path);

  // The harness stops the agent when the count reaches the limit; a transcript one short is the same story
  return { limit, used, hitLimit: limit !== undefined && used !== undefined && used >= limit - 1 };
}

/**
 * The agent directories to search: this plugin's, then every sibling pack's (repo layout and marketplace cache layout).
 *
 * @returns {string[]}
 */
function agentDirs() {
  const candidates = [join(PLUGIN_ROOT, "agents")];
  for (const base of [join(PLUGIN_ROOT, ".."), join(PLUGIN_ROOT, "..", "..")]) {
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base)) {
      candidates.push(join(base, entry, "agents"));
      const nested = join(base, entry);
      if (existsSync(nested)) for (const version of safeReaddir(nested)) candidates.push(join(nested, version, "agents"));
    }
  }

  return [...new Set(candidates)].filter((dir) => existsSync(dir));
}

/** @param {string} dir @returns {string[]} */
function safeReaddir(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

/** @param {string} type plain or plugin-qualified agent type @returns {string} the name without the plugin */
function plainType(type) {
  return String(type).replace(/^[^:]*:/, "");
}

/** @param {string} root @param {string} id @returns {string} */
function agentFile(root, id) {
  return join(root, AGENTS_DIR, `${id.replace(/[^\w-]/g, "_")}.json`);
}
