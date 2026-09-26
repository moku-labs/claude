/**
 * The agents running inside a station, and what an agent's ending looks like.
 *
 * `SubagentStart` writes one file per running agent under `.planning/agents/`, `SubagentStop` removes
 * it. One file per agent, so parallel builders never race on a shared ledger. `status` names them,
 * `moku-rails pause` warns about them, and the stop hook lets a turn end while they run.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AGENTS_DIR = join(".planning", "agents");
const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Only moku agents, plain or plugin-qualified (`moku:moku-builder`, `moku-web:moku-web-validator`). */
export const MOKU_AGENT = /(^|:)(moku-|design-generator|brainstorm-challenger)/;

/** What the orchestrator does with an agent that ended without a report. */
export const RESUME_INSTRUCTION = 'A missing report is a failure, not a delay. Resume the agent exactly once with SendMessage: "Deliver your report now: the output contract with an honest verdict on what is done. Do no more work." Take what comes back. If it still has no report, record the agent as FAIL (no report), use what it left on disk, and go on. Do not wait open-ended and do not send a second reminder.';

/** @typedef {{ id: string, type: string, startedAt: string }} RunningAgent */

/**
 * Record that an agent started inside this project.
 *
 * @param {string} root project root
 * @param {{ id: string, type: string }} agent
 * @example
 * registerAgent("/work/site", { id: "agent-1", type: "moku:moku-builder" });
 */
export function registerAgent(root, agent) {
  mkdirSync(join(root, AGENTS_DIR), { recursive: true });
  writeFileSync(agentFile(root, agent.id), `${JSON.stringify({ ...agent, startedAt: new Date().toISOString() })}\n`);
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
 * The agents recorded as running, oldest first.
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
      agents.push(JSON.parse(readFileSync(join(dir, file), "utf8")));
    } catch {
      /* skipped */
    }
  }

  return agents.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
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
  const name = agentType.replace(/^[^:]*:/, "");

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

/** @param {string} root @param {string} id @returns {string} */
function agentFile(root, id) {
  return join(root, AGENTS_DIR, `${id.replace(/[^\w-]/g, "_")}.json`);
}
