/**
 * Who wrote a prompt: the person at the keyboard, or the harness.
 *
 * `UserPromptSubmit` fires for more than typed messages: a subagent's hand-back, a task notification, a
 * CI-monitor event, an artifact-comment relay, a scheduled wake-up, and the spawn prompt a subagent
 * starts with. Only a typed message is a new request; the rest carry no routing decision.
 */

/** Markers the harness puts at the start of a line of a prompt it wrote itself. */
const SYSTEM_MARKERS = /^\s*(?:<task-notification\b|<agent-message\b|<ci-monitor-event\b|<scheduled-wakeup\b|<cron-event\b|\[SYSTEM NOTIFICATION\b|\[Subagent hand-back\]|\[Artifact comment sent to Claude\])/m;

/**
 * The prompt text, whichever field the harness put it in.
 *
 * @param {Record<string, any>} payload UserPromptSubmit payload
 * @returns {string}
 * @example
 * promptText({ prompt: "fix it" }); // "fix it"
 */
export function promptText(payload) {
  return String(payload.prompt ?? payload.text ?? payload.prompt_text ?? "");
}

/**
 * True when the prompt did not come from the person: a subagent context, a flag the harness sets, or a
 * system marker in the text. A doubt counts as system: the cost of a missed typed message is one skipped
 * routing check, the cost of a mistaken one is a builder refused mid-batch.
 *
 * @param {Record<string, any>} payload UserPromptSubmit payload
 * @returns {boolean}
 * @example
 * isSystemPrompt({ prompt: "[SYSTEM NOTIFICATION - NOT USER INPUT]\n<task-notification>..." }); // true
 * isSystemPrompt({ prompt: "add a streak counter" }); // false
 */
export function isSystemPrompt(payload) {
  // Inside a subagent the prompt is the orchestrator's spawn prompt or a resume, never the person
  if (isSubagent(payload)) return true;

  // Flags the harness may set on an injected prompt
  if (payload.is_system_injected === true || payload.isMeta === true) return true;
  const originKind = payload.origin?.kind ?? payload.origin;
  if (typeof originKind === "string" && originKind !== "user") return true;

  return SYSTEM_MARKERS.test(promptText(payload));
}

/**
 * True when the hook fired inside a subagent: the harness adds `agent_id` to every hook payload there.
 *
 * @param {Record<string, any>} payload any hook payload
 * @returns {boolean}
 * @example
 * isSubagent({ agent_id: "agent-1", tool_name: "Write" }); // true
 */
export function isSubagent(payload) {
  return typeof payload.agent_id === "string" && payload.agent_id !== "";
}
