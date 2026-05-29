export const meta = {
  name: 'moku-audit',
  description: 'Audit a Moku command file: generate test scenarios, simulate them in parallel batches, then synthesize a deduped gap report with an improved command',
  whenToUse: 'Plugin maintenance — stress-test one of the moku command files (plan, build, brainstorm, …) for gaps, ambiguities, and missing error handling. Run from the moku plugin repo where commands/*.md exist.',
  phases: [
    { title: 'Generate', detail: 'derive test scenarios from the command' },
    { title: 'Simulate', detail: 'run scenario batches in parallel' },
    { title: 'Synthesize', detail: 'dedupe findings + improved command' },
  ],
}

// `args` is the command name to audit, e.g. "plan" / "build" / "brainstorm".
const COMMAND = (typeof args === 'string' && args.trim()) || (args && args.command) || 'plan'
const COMMAND_PATH = `commands/${COMMAND}.md`

const SCENARIOS = {
  type: 'object',
  required: ['scenarios'],
  properties: {
    scenarios: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'title', 'category'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          category: { type: 'string', enum: ['valid', 'edge', 'error', 'adversarial'] },
          input: { type: 'string' },
          expected: { type: 'string' },
        },
      },
    },
  },
}

const FINDINGS = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['scenarioId', 'gap', 'severity'],
        properties: {
          scenarioId: { type: 'string' },
          gap: { type: 'string' },
          severity: { type: 'string', enum: ['BLOCKER', 'WARNING', 'INFO'] },
          fix: { type: 'string' },
        },
      },
    },
  },
}

const REPORT = {
  type: 'object',
  required: ['summary', 'prioritizedGaps'],
  properties: {
    summary: { type: 'string' },
    prioritizedGaps: { type: 'array', items: { type: 'object' } },
    improvedCommandPath: { type: 'string' },
  },
}

// --- Generate -------------------------------------------------------------
phase('Generate')
const gen = await agent(
  `Read ${COMMAND_PATH} and generate a comprehensive set of test scenarios covering valid ` +
    `inputs, edge cases, error paths, and adversarial inputs. Also cross-check the command ` +
    `against skills/moku-core/references/spec-index.md — any step that decides architecture/API ` +
    `behavior should route through the spec. Return the scenarios array.`,
  { label: `gen:${COMMAND}`, phase: 'Generate', agentType: 'moku-audit-scenario-generator', schema: SCENARIOS },
)

const scenarios = gen?.scenarios ?? []
if (scenarios.length === 0) {
  log(`No scenarios generated for ${COMMAND_PATH} — does the file exist?`)
  return { command: COMMAND, error: 'no-scenarios' }
}
log(`${scenarios.length} scenarios generated for /${COMMAND}`)

// --- Simulate (parallel batches) ------------------------------------------
phase('Simulate')
const BATCH = 6
const batches = []
for (let i = 0; i < scenarios.length; i += BATCH) batches.push(scenarios.slice(i, i + BATCH))

const batchResults = await parallel(
  batches.map((batch, i) => () =>
    agent(
      `Simulate these scenarios against ${COMMAND_PATH} step-by-step (pure text analysis, no file ` +
        `changes). Identify gaps, missing error handling, ambiguities, and contradictions. ` +
        `Scenarios: ${JSON.stringify(batch)}`,
      { label: `sim:batch-${i + 1}`, phase: 'Simulate', agentType: 'moku-audit-simulator', schema: FINDINGS },
    ),
  ),
)

const findings = batchResults.filter(Boolean).flatMap((r) => r.findings ?? [])
log(`${findings.length} findings across ${batches.length} batches`)

// --- Synthesize -----------------------------------------------------------
phase('Synthesize')
const report = await agent(
  `Synthesize these audit findings for ${COMMAND_PATH} into a deduplicated, prioritized gap ` +
    `list and produce an improved version of the command. Do NOT overwrite the original — write ` +
    `any improved draft to a clearly-named file and report its path. Findings: ${JSON.stringify(findings)}`,
  { label: `synth:${COMMAND}`, phase: 'Synthesize', agentType: 'moku-audit-synthesizer', schema: REPORT },
)

return { command: COMMAND, scenarios: scenarios.length, findings: findings.length, report }
