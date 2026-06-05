export const meta = {
  name: 'moku-verify',
  description: 'Fan out the full Moku validation pipeline (spec, plugin-structure, jsdoc, readability, types, tests, web, architecture) in parallel, then aggregate one disposition',
  whenToUse: 'After a build wave or before shipping — when you want every Moku validator run concurrently and a single pass/fail with deduped findings. Pass {adversarial:true} (or args "adversarial") to add a skeptic pass that downgrades unrefutable-but-weak blockers.',
  phases: [
    { title: 'Discover', detail: 'list plugins to validate' },
    { title: 'Validate', detail: 'run all validators in parallel' },
    { title: 'Synthesize', detail: 'dedupe findings + final verdict' },
    { title: 'Adversarial', detail: 'skeptics try to refute each blocker' },
  ],
}

// Adversarial verification is ON BY DEFAULT — every surviving blocker is challenged by N skeptics
// who check whether the pattern is an established repo convention before it fails the build.
// Opt OUT with {adversarial:false} (or args "no-adversarial").
const ADVERSARIAL = !(args === 'no-adversarial' || (args && args.adversarial === false))
const SKEPTICS_PER_BLOCKER = (args && args.skeptics) || 2

// Shape of every Moku validator's JSON output contract (see agent-preamble.md).
const VALIDATOR_RESULT = {
  type: 'object',
  required: ['agent', 'verdict', 'blockers', 'warnings'],
  properties: {
    agent: { type: 'string' },
    verdict: { type: 'string', enum: ['PASS', 'FAIL', 'PARTIAL'] },
    blockers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'number' },
          rule: { type: 'string' },
          message: { type: 'string' },
          fix: { type: 'string' },
        },
      },
    },
    warnings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'number' },
          rule: { type: 'string' },
          message: { type: 'string' },
          fix: { type: 'string' },
        },
      },
    },
    stats: { type: 'object' },
  },
}

const SCOPE = {
  type: 'object',
  required: ['plugins'],
  properties: {
    plugins: { type: 'array', items: { type: 'string' } },
    note: { type: 'string' },
  },
}

const SPEC_RULE =
  'Ground every finding in the vendored spec: open skills/moku-core/references/spec-index.md, ' +
  'read the relevant spec/NN-*.md files, and cite the spec section ID (spec/NN-*.md §N) in each blocker/warning. ' +
  'End with the JSON output contract.'

// --- Discover -------------------------------------------------------------
phase('Discover')
const scope = await agent(
  'List the Moku plugins to validate in this project. Glob `src/plugins/*/` for plugin ' +
    'directories and return their names. If there are no plugins yet, return an empty list ' +
    'with a note explaining what was found instead.',
  { label: 'discover-plugins', phase: 'Discover', schema: SCOPE },
)

const pluginList = (scope?.plugins ?? []).join(', ') || '(whole project)'
log(`Validating: ${pluginList}`)

// --- Validate (fan out every validator concurrently) ----------------------
phase('Validate')
const VALIDATORS = [
  { type: 'moku-spec-validator', focus: 'Moku Core specification compliance (layers, factory chain, config, lifecycle, events, state).' },
  { type: 'moku-plugin-spec-validator', focus: 'plugin structure, complexity tier, file organization, domain-merge detection.' },
  { type: 'moku-jsdoc-validator', focus: 'JSDoc completeness and quality on all exports.' },
  { type: 'moku-readable-code-validator', focus: 'function-body readability — wall-of-text functions lacking blank-line stanzas / intent comments, nested ternaries, deep nesting, fused concerns. Cite readable-code rule numbers (not spec sections); WARNING/INFO only, never blocks.' },
  { type: 'moku-type-validator', focus: 'TypeScript correctness: tsc --noEmit, type-assertion audit, inference chains, import type.' },
  { type: 'moku-test-validator', focus: 'test quality: mock-context correctness, assertion quality, edge cases, lifecycle.' },
  { type: 'moku-web-validator', focus: 'Moku web patterns (data-* attributes, @scope/@layer, islands, tokens) — skip with PASS if this is not a web project.' },
  { type: 'moku-architecture-validator', focus: 'cross-plugin architecture: dependency graph, event flow, API consistency.' },
]

// agentType MUST be namespaced (`moku:<name>`) — the registry registers these agents under the
// plugin namespace, and an unqualified type silently fails to launch (which previously produced a
// vacuous PASS with 0 validators run). If a validator returns no parseable verdict, re-spawn once
// asking explicitly for the JSON contract before giving up.
const results = await parallel(
  VALIDATORS.map((v) => () => {
    const qualified = `moku:${v.type}`
    const run = (extra) =>
      agent(
        `Validate the project (plugins: ${pluginList}). Focus: ${v.focus} ${SPEC_RULE}${extra || ''}`,
        { label: v.type.replace('moku-', ''), phase: 'Validate', agentType: qualified, schema: VALIDATOR_RESULT },
      )
    return run().then((r) =>
      r && r.verdict
        ? r
        : run(' Your LAST message MUST be the JSON output contract via StructuredOutput — do not end mid-analysis.'),
    )
  }),
)

// --- Synthesize (plain-JS aggregation — no extra agent needed) ------------
phase('Synthesize')
const ok = results.filter(Boolean)

// Dedupe blockers/warnings by file+line+rule across validators.
const keyOf = (f) => `${f.file ?? '?'}:${f.line ?? 0}:${f.rule ?? ''}`
const dedupe = (items) => {
  const seen = new Map()
  for (const it of items) if (!seen.has(keyOf(it))) seen.set(keyOf(it), it)
  return [...seen.values()]
}

let blockers = dedupe(ok.flatMap((r) => (r.blockers ?? []).map((b) => ({ ...b, from: r.agent }))))
const warnings = dedupe(ok.flatMap((r) => (r.warnings ?? []).map((w) => ({ ...w, from: r.agent }))))
const downgraded = []

// --- Adversarial pass (ON BY DEFAULT): N skeptics try to REFUTE each blocker. ----
// A blocker that a majority of skeptics refute is downgraded to a warning — this kills
// plausible-but-wrong findings (esp. ones that contradict an already-verified repo convention)
// before they fail the build. Real blockers survive.
if (ADVERSARIAL && blockers.length > 0) {
  phase('Adversarial')
  const VERDICT = {
    type: 'object',
    required: ['refuted'],
    properties: { refuted: { type: 'boolean' }, reason: { type: 'string' } },
  }
  const judged = await parallel(
    blockers.map((b) => () =>
      parallel(
        Array.from({ length: SKEPTICS_PER_BLOCKER }, (_, i) => () =>
          agent(
            `Try to REFUTE this validation finding. Default to refuted=true unless it genuinely holds.\n` +
              `Convention check: if two or more ALREADY-VERIFIED plugins in this repo use the same ` +
              `pattern (grep them), it is a house convention, not a per-plugin violation — refute it.\n` +
              `Finding: ${JSON.stringify({ file: b.file, line: b.line, rule: b.rule, message: b.message })}`,
            { label: `skeptic:${(b.file || '?').split('/').pop()}#${i + 1}`, phase: 'Adversarial', agentType: 'moku:moku-skeptic', schema: VERDICT },
          ),
        ),
      ).then((votes) => {
        const v = votes.filter(Boolean)
        const refutes = v.filter((x) => x.refuted).length
        const refuted = v.length > 0 && refutes > v.length / 2 // strict majority
        return { ...b, refuted, refuteVotes: `${refutes}/${v.length}` }
      }),
    ),
  )
  const survived = []
  for (const f of judged.filter(Boolean)) {
    if (f.refuted) downgraded.push(f)
    else survived.push(f)
  }
  blockers = survived
  log(`Adversarial: ${downgraded.length} blocker(s) refuted/downgraded, ${blockers.length} survived`)
}

// A run where not every validator actually ran + returned a parseable verdict is NOT a PASS —
// it is INCONCLUSIVE. PASS requires all validators to have run AND zero surviving blockers.
// (This guards against the prior "0 validators run -> vacuous PASS" failure.)
const missing = VALIDATORS.length - ok.length
const verdict = blockers.length > 0 ? 'FAIL' : missing > 0 ? 'INCONCLUSIVE' : 'PASS'
const disposition = {
  verdict,
  adversarial: ADVERSARIAL,
  ranValidators: ok.map((r) => r.agent),
  missing,
  missingNote: missing > 0 ? `${missing} validator(s) did not run or returned no parseable verdict — verdict is INCONCLUSIVE, not PASS.` : undefined,
  blockers,
  warnings: [...warnings, ...downgraded.map((d) => ({ ...d, note: `downgraded by skeptics (${d.refuteVotes} refuted)` }))],
  counts: { blockers: blockers.length, warnings: warnings.length + downgraded.length, refuted: downgraded.length, missing },
}

log(`Disposition: ${verdict} — ${blockers.length} blocker(s), ${disposition.counts.warnings} warning(s), ${missing} validator(s) missing`)
return disposition
