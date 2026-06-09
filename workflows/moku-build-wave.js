export const meta = {
  name: 'moku-build-wave',
  description: 'Build one Moku wave non-interactively: builders in parallel (disjoint plugin dirs), each verified as it completes (pipeline), then a wave-judge disposition',
  whenToUse: 'OPT-IN, non-interactive fan-out for a single build wave. The gated /moku:build (per-wave user checkpoint) is still the default; use this when you explicitly want a wave built end-to-end without stopping. Pass {plugins:[{name,tier,spec}]} to define the wave, or omit to auto-detect the next wave from STATE.md.',
  phases: [
    { title: 'Plan', detail: 'determine the wave plugin set' },
    { title: 'Build+Verify', detail: 'build each plugin, verify as it completes' },
    { title: 'Judge', detail: 'wave-judge disposition' },
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
// Builders touch disjoint dirs (src/plugins/<name>/), BUT a misbehaving builder can still run a
// repo-wide command (lint:fix, git checkout) that clobbers a sibling's work — this caused real data
// loss in a prior build. So for any wave with >1 builder, isolate each in its own git worktree
// (disjoint indices -> a stray git/format command can't reach siblings). The builder prompt ALSO
// hard-forbids repo-wide commands and git mutations as belt-and-suspenders.
const ISOLATE = plugins.length > 1 ? 'worktree' : undefined
const HARD_RULES =
  ' HARD RULES (filesystem safety): write ONLY under src/plugins/' +
  '<this-plugin>/ and its __tests__/ — never edit src/config.ts, src/plugins/index.ts (barrel), ' +
  'package.json, or sibling plugins. NEVER run a repo-wide command (lint:fix, bun run format, ' +
  '`biome … .`, `eslint .`) or ANY git mutation (checkout/restore/reset/stash/clean/add/commit). ' +
  'Scoped formatting only: `bunx biome format --write src/plugins/<this-plugin>/`. Report lint/format ' +
  'issues as hints; the orchestrator fixes them repo-wide after the wave.'
phase('Build+Verify')
const results = await pipeline(
  plugins,
  (p) =>
    agent(
      `You are building the Moku plugin "${p.name}" (${p.tier || 'tier per spec'}) using TDD ` +
        `(types → red → green → refactor). Spec: ${p.spec || `.planning/specs for ${p.name}`}. ${STYLE}` +
        HARD_RULES.replaceAll('<this-plugin>', p.name) +
        ` Return the build result.`,
      { label: `build:${p.name}`, phase: 'Build+Verify', schema: BUILD_RESULT, isolation: ISOLATE },
    ),
  (build, p) =>
    agent(
      `Verify the just-built plugin "${p.name}": files exist, content is substantive (not stubs), ` +
        `lint + tests pass, and it complies with the spec. Cite spec/NN-*.md §N in any blocker.`,
      { label: `verify:${p.name}`, phase: 'Build+Verify', agentType: 'moku:moku-verifier', schema: VERIFY_RESULT },
    ).then((verify) => ({ plugin: p.name, build, verify })),
)

const done = results.filter(Boolean)
const failed = done.filter((r) => r.build?.status === 'failed' || r.verify?.verdict === 'FAIL')

// --- Judge ---------------------------------------------------------------
phase('Judge')
const JUDGE = {
  type: 'object',
  required: ['decision'],
  properties: {
    decision: { type: 'string', enum: ['continue', 'stop-for-review', 'fresh-retry'] },
    reason: { type: 'string' },
  },
}
const judgment = await agent(
  `Evaluate this build wave and decide continue / stop-for-review / fresh-retry. Results: ` +
    `${JSON.stringify(done.map((r) => ({ plugin: r.plugin, build: r.build?.status, verify: r.verify?.verdict })))}`,
  { label: 'wave-judge', phase: 'Judge', agentType: 'moku:moku-wave-judge', schema: JUDGE },
)

return {
  wave: plugins.map((p) => p.name),
  built: done.length,
  failed: failed.map((r) => r.plugin),
  verdict: failed.length === 0 ? 'PASS' : 'FAIL',
  judge: judgment,
  results: done,
}
