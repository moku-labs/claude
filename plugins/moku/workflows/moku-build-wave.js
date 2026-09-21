export const meta = {
  name: 'moku-build-wave',
  description: 'Build one Moku wave non-interactively: builders in parallel (disjoint plugin dirs), each verified as it completes (pipeline), then a wave disposition',
  whenToUse: 'OPT-IN, non-interactive fan-out for a single build wave. The gated moku:build skill (per-wave user checkpoint) is still the default; use this when you explicitly want a wave built end-to-end without stopping. Pass {plugins:[{name,tier,spec}]} to define the wave, or omit to auto-detect the next wave from STATE.md.',
  phases: [
    { title: 'Plan', detail: 'determine the wave plugin set' },
    { title: 'Build+Verify', detail: 'build each plugin, verify as it completes' },
    { title: 'Disposition', detail: 'continue / stop-for-review / fresh-retry' },
  ],
}

// Per-plugin builder result + the validator contract reused for verification.
const BUILD_RESULT = {
  type: 'object',
  required: ['plugin', 'status'],
  properties: {
    plugin: { type: 'string' },
    status: { type: 'string', enum: ['built', 'failed'] },
    files: { type: 'array', items: { type: 'string' } },
    tdd: { type: 'object' },
    notes: { type: 'string' },
  },
}
const VERIFY_RESULT = {
  type: 'object',
  required: ['verdict'],
  properties: {
    verdict: { type: 'string', enum: ['PASS', 'FAIL', 'PARTIAL'] },
    blockers: { type: 'array', items: { type: 'object' } },
    stats: { type: 'object' },
  },
}

const STYLE = `Follow the moku-plugin skill. Ground every decision in ` +
  `${'$'}{CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/spec-index.md and mirror the coding style of ` +
  `the tier-matching exemplar in sandbox-index.md (file split, <name>Plugin export, JSDoc, tests).`

// --- Plan: determine the wave -------------------------------------------
phase('Plan')
let plugins = (args && Array.isArray(args.plugins) && args.plugins) || null
if (!plugins) {
  const PLAN = {
    type: 'object',
    required: ['plugins'],
    properties: {
      waveIndex: { type: 'number' },
      plugins: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string' }, tier: { type: 'string' }, spec: { type: 'string' } },
        },
      },
    },
  }
  const plan = await agent(
    `Read .planning/STATE.md and the plugin table. Identify the NEXT wave to build (plugins whose ` +
      `dependencies are already built/verified and that are not yet complete). For each, return its ` +
      `name, complexity tier, and the path to its spec (.planning/specs/0N-*.md). If the skeleton is ` +
      `not committed yet, return an empty plugins list with a note — the skeleton must be built first.`,
    { label: 'plan-wave', phase: 'Plan', schema: PLAN },
  )
  plugins = plan?.plugins ?? []
}
if (plugins.length === 0) {
  log('No buildable wave found (skeleton not committed, or all plugins complete).')
  return { built: 0, note: 'no-wave' }
}
log(`Wave: ${plugins.map((p) => p.name).join(', ')} (${plugins.length} plugins)`)

// --- Build + Verify (pipeline: verify each plugin as soon as it is built) ---
// Builders touch disjoint dirs (src/plugins/<name>/) in the one working tree. A git worktree per builder
// does not work: it has no node_modules and no .planning/ (both gitignored), so the builder would get
// no tooling and no spec. A misbehaving builder can still run a repo-wide command (lint:fix,
// git checkout) that clobbers a sibling's work — that caused real data loss in a prior build — so the
// prompt's command ban below is the isolation.
// Complex and VeryComplex plugins go to the deep builder (same instructions, higher effort).
const DEEP_TIERS = new Set(['Complex', 'VeryComplex'])
const HARD_RULES =
  ' Filesystem safety — sibling builders run concurrently, so a repo-wide command from you corrupts ' +
  'their work. Write only under src/plugins/<this-plugin>/ and its __tests__/; leave src/config.ts, ' +
  'src/plugins/index.ts (the barrel), package.json and sibling plugins alone. Run no repo-wide command ' +
  '(lint:fix, bun run format, `biome … .`, `eslint .`) and no git mutation ' +
  '(checkout/restore/reset/stash/clean/add/commit). Scoped formatting only: ' +
  '`bunx biome format --write src/plugins/<this-plugin>/`. Report lint and format issues as hints; ' +
  'the orchestrator fixes them repo-wide after the wave.'
phase('Build+Verify')
const results = await pipeline(
  plugins,
  (p) =>
    agent(
      `You are building the Moku plugin "${p.name}" (${p.tier || 'tier per spec'}) using TDD ` +
        `(types → red → green → refactor). Spec: ${p.spec || `.planning/specs for ${p.name}`}. ${STYLE}` +
        HARD_RULES.replaceAll('<this-plugin>', p.name) +
        ` Return the build result.`,
      {
        label: `build:${p.name}`,
        phase: 'Build+Verify',
        agentType: DEEP_TIERS.has(p.tier) ? 'moku:moku-builder-deep' : 'moku:moku-builder',
        schema: BUILD_RESULT,
      },
    ),
  // The artifact check is a deterministic script, so this step only runs it and reports the result.
  (build, p) =>
    agent(
      `Run \`moku-verify-artifacts ${p.name} --tier ${p.tier || 'auto'} --run --json\` with Bash and ` +
        `report what it printed. Exit 0 is PASS, exit 2 is FAIL; any other exit is PARTIAL with the ` +
        `error as a blocker. Do not fix anything and do not judge the code yourself.`,
      { label: `verify:${p.name}`, phase: 'Build+Verify', schema: VERIFY_RESULT },
    ).then((verify) => ({ plugin: p.name, build, verify })),
)

const done = results.filter(Boolean)
const failed = done.filter((r) => r.build?.status === 'failed' || r.verify?.verdict === 'FAIL')

// --- Disposition ---------------------------------------------------------
phase('Disposition')
const DISPOSITION = {
  type: 'object',
  required: ['decision'],
  properties: {
    decision: { type: 'string', enum: ['continue', 'stop-for-review', 'fresh-retry'] },
    reason: { type: 'string' },
  },
}
// No judge agent: the disposition criteria live in build-wave-execution.md ("Wave disposition").
const judgment = await agent(
  `Decide this wave's disposition: continue / stop-for-review / fresh-retry. Read ` +
    `${'$'}{CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/build-wave-execution.md → "Wave ` +
    `disposition" and apply its table. Uncertainty resolves to stop-for-review. Results: ` +
    `${JSON.stringify(done.map((r) => ({ plugin: r.plugin, build: r.build?.status, verify: r.verify?.verdict })))}`,
  { label: 'wave-disposition', phase: 'Disposition', schema: DISPOSITION },
)

return {
  wave: plugins.map((p) => p.name),
  built: done.length,
  failed: failed.map((r) => r.plugin),
  verdict: failed.length === 0 ? 'PASS' : 'FAIL',
  disposition: judgment,
  results: done,
}
