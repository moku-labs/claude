export const meta = {
  name: 'moku-verify',
  description: 'Aggressive Moku verification: fan out every validator, FAIL on any blocker, warning, or un-run validator, uphold findings unless cited-refuted, then auto-fix and re-verify in a loop until clean.',
  whenToUse: 'After a build wave or before shipping. AGGRESSIVE by default: any blocker, ANY warning, or any validator that did not run fails the build; the skeptic pass UPHOLDS findings unless they can be refuted with a cited spec/house-style section; surviving issues are auto-fixed and re-verified in a loop (default 3 cycles). Pass {reportOnly:true} (or args "report-only") to audit without editing; {iterations:N} to cap cycles; {adversarial:false} to skip the skeptic pass.',
  phases: [
    { title: 'Discover', detail: 'list plugins to validate' },
    { title: 'Validate', detail: 'run all validators in parallel (retry on no-verdict)' },
    { title: 'Adversarial', detail: 'skeptics uphold each finding unless cited-refuted' },
    { title: 'Fix', detail: 'auto-fix surviving issues + re-verify; loop until clean' },
  ],
}

// --- Modes (aggressive defaults) ------------------------------------------
// REPORT_ONLY  — audit only, never edits a file (one pass, no fix loop).
// ADVERSARIAL  — skeptic pass ON by default, but now UPHOLD-biased (a finding only
//                dies if every skeptic refutes it WITH a cited spec section).
// MAX_CYCLES   — find -> fix -> re-verify rounds before stopping (default 3).
const REPORT_ONLY = args === 'report-only' || (args && args.reportOnly === true)
const ADVERSARIAL = !(args === 'no-adversarial' || (args && args.adversarial === false))
const SKEPTICS_PER_FINDING = (args && args.skeptics) || 2
const MAX_CYCLES = (args && args.iterations) || (REPORT_ONLY ? 1 : 3)

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
  'Be EXHAUSTIVE — report every instance, not a "top few"; when confident it violates the spec it is a BLOCKER, ' +
  'and a pattern repeated across plugins is a repeated violation, never an excuse. End with the JSON output contract.'

const VALIDATORS = [
  { type: 'moku-spec-validator', focus: 'Moku Core specification compliance (layers, factory chain, config, lifecycle, events, state).' },
  { type: 'moku-root-validator', focus: 'ROOT/ENTRYPOINT/app-shape conformance (I1–I5): app-creation files (app.ts/spa.tsx/server.ts/cloudflare/worker.ts/routes.tsx/config.ts). I1–I5, config-not-in-place (incl. a makeApp(...)/factory wrapping createApp with no second call site), fat entries, and stray functions are ALL blockers when violated. Ground in moku-idioms.md §I1–I5 + skeleton-conventions.md; NEVER flag the legitimate multi-createApp browser/server/SSG split.' },
  { type: 'moku-plugin-spec-validator', focus: 'plugin structure, complexity tier, file organization, domain-merge detection, docs-sync (a stale/misleading README — e.g. a "skeleton stub / not implemented" note on built code, or an API list that has drifted from the source — is a blocker).' },
  { type: 'moku-jsdoc-validator', focus: 'JSDoc completeness and quality on all exports.' },
  { type: 'moku-readable-code-validator', focus: 'function-body readability — wall-of-text functions lacking blank-line stanzas / intent comments, nested ternaries, deep nesting, fused concerns. Cite readable-code rule numbers (not spec sections); a clear wall-of-text is a BLOCKER (the auto-fixer refactors it structure-only), borderline cases are WARNINGs.' },
  { type: 'moku-common-validator', focus: 'family-level @moku-labs/common usage — branded CLI rendering (MC1), ctx.log not raw console.* (MC2), ctx.env not raw process.env (MC3) in plugin/CLI/script source. Read skills/moku-common/references/conventions.md and cite MC rule IDs (not spec sections); honor the documented exceptions (brand-kit source, // @log-sink, env providers, tests).' },
  { type: 'moku-type-validator', focus: 'TypeScript correctness: tsc --noEmit, type-assertion audit, inference chains, import type.' },
  { type: 'moku-test-validator', focus: 'test quality: presence (every plugin has __tests__/), mock-context correctness, assertion quality, edge cases, lifecycle.' },
  { type: 'moku-web-validator', focus: 'Moku web patterns (data-* attributes not CSS classes, @scope/@layer, islands, design tokens) — skip with PASS if this is not a web project.' },
  { type: 'moku-architecture-validator', focus: 'cross-plugin architecture: dependency graph, dead deps, event flow, API consistency.' },
]

// --- Discover (once) ------------------------------------------------------
phase('Discover')
const scope = await agent(
  'List the Moku plugins to validate in this project. Glob `src/plugins/*/` for plugin ' +
    'directories and return their names. If there are no plugins yet, return an empty list ' +
    'with a note explaining what was found instead.',
  { label: 'discover-plugins', phase: 'Discover', schema: SCOPE },
)
const pluginList = (scope?.plugins ?? []).join(', ') || '(whole project)'
log(`Validating: ${pluginList}`)

// --- Helpers --------------------------------------------------------------
const keyOf = (f) => `${f.file ?? '?'}:${f.line ?? 0}:${f.rule ?? ''}`
const dedupe = (items) => {
  const seen = new Map()
  for (const it of items) if (!seen.has(keyOf(it))) seen.set(keyOf(it), it)
  return [...seen.values()]
}

// Run every validator concurrently; retry up to 3x for a parseable verdict. agentType MUST
// be namespaced (`moku:<name>`) — an unqualified type silently fails to launch. A validator
// that STILL returns no verdict is "un-run", which fails the whole verification (an un-run
// validator means the project was not fully checked — never a pass).
async function runValidators(cycle) {
  const results = await parallel(
    VALIDATORS.map((v) => () => {
      const qualified = `moku:${v.type}`
      const run = (extra) =>
        agent(
          `Validate the project (plugins: ${pluginList}). Focus: ${v.focus} ${SPEC_RULE}${extra || ''}`,
          { label: `${v.type.replace('moku-', '')}${cycle > 1 ? `#${cycle}` : ''}`, phase: 'Validate', agentType: qualified, schema: VALIDATOR_RESULT },
        )
      return run()
        .then((r) => (r && r.verdict ? r : run(' Your LAST action MUST be the StructuredOutput call with the JSON contract — do not end mid-analysis.')))
        .then((r) => (r && r.verdict ? r : run(' FINAL ATTEMPT: emit the StructuredOutput contract NOW as your only remaining action; an empty result fails the whole verification.')))
    }),
  )
  const ok = results.filter((r) => r && r.verdict)
  const missingTypes = VALIDATORS.filter((_, i) => !(results[i] && results[i].verdict)).map((v) => v.type)
  return { ok, ranNames: ok.map((r) => r.agent), missingTypes }
}

// Aggregate findings. Under the aggressive verdict, blockers AND warnings are both fail-worthy
// "issues" (warnings are no longer a free pass) — severity is retained for the fixer + report.
function collectIssues(ok) {
  const blockers = ok.flatMap((r) => (r.blockers ?? []).map((b) => ({ ...b, from: r.agent, severity: 'blocker' })))
  const warnings = ok.flatMap((r) => (r.warnings ?? []).map((w) => ({ ...w, from: r.agent, severity: 'warning' })))
  return dedupe([...blockers, ...warnings])
}

// Adversarial UPHOLD pass: N skeptics challenge each finding, now upholding by default and
// refuting ONLY with a cited spec/house-style section. A finding is dropped only if ALL
// skeptics refute it (unanimous) — the finding wins every tie. Real issues survive; this only
// kills provably-wrong ones.
async function upholdOrRefute(issues) {
  const VERDICT = {
    type: 'object',
    required: ['refuted'],
    properties: { refuted: { type: 'boolean' }, reason: { type: 'string' }, citation: { type: 'string' } },
  }
  const judged = await parallel(
    issues.map((b) => () =>
      parallel(
        Array.from({ length: SKEPTICS_PER_FINDING }, (_, i) => () =>
          agent(
            `Decide whether this validation finding is a REAL violation. UPHOLD it (refuted=false) by default.\n` +
              `Refute (refuted=true) ONLY if you can cite the specific spec/house-style.md section that proves it is NOT a ` +
              `violation, or that it is out of scope (test / type-only / generated file) or misquotes the rule — put the ` +
              `citation in "citation". A pattern repeated across plugins is NOT automatically a convention: refute on ` +
              `repetition ONLY if house-style.md explicitly approves it (cite it). When uncertain, UPHOLD.\n` +
              `Finding: ${JSON.stringify({ file: b.file, line: b.line, rule: b.rule, message: b.message })}`,
            { label: `skeptic:${(b.file || '?').split('/').pop()}#${i + 1}`, phase: 'Adversarial', agentType: 'moku:moku-skeptic', schema: VERDICT },
          ),
        ),
      ).then((votes) => {
        const v = votes.filter(Boolean)
        const refutes = v.filter((x) => x.refuted).length
        // Unanimous, cited refutation required to drop a finding (the finding wins ties).
        const refuted = v.length > 0 && refutes === v.length
        return { ...b, refuted, refuteVotes: `${refutes}/${v.length}` }
      }),
    ),
  )
  const kept = []
  const dropped = []
  for (const f of judged.filter(Boolean)) (f.refuted ? dropped : kept).push(f)
  return { kept, dropped }
}

// One fixer per cycle applies EVERY surviving issue + runs the gates. A single agent (not
// parallel) so concurrent edits never collide; it reverts any fix that regresses a gate.
async function fixCycle(issues, cycle) {
  const list = issues
    .map((f, i) => `${i + 1}. [${f.severity}] ${f.file}:${f.line ?? 0} — ${f.rule}\n   problem: ${f.message}\n   fix: ${f.fix ?? '(derive the smallest correct fix)'}`)
    .join('\n')
  return agent(
    `You are the Moku verify auto-fixer (cycle ${cycle}). Apply a fix for EVERY issue below in the project at the ` +
      `current repo root, then prove the tree still builds. Use Edit/Write for code and Bash for the gates.\n\n` +
      `RULES:\n` +
      `- Structural fixes are behaviour-preserving: never change a public signature, return type, route, event name, ` +
      `error-message text, or runtime behaviour for a readability / entrypoint-config-in-place / stray-function / naming ` +
      `fix. Pure refactor only.\n` +
      `- Real gaps get real fixes: missing tests -> write them (match the sibling plugins' test conventions); ` +
      `stale/misleading docs -> correct them against the source; missing type-guards / JSDoc / import-type -> add them.\n` +
      `- Entrypoint / config-in-place: inline a makeApp(...)/factory wrapper back to a bare ` +
      `\`export const app = createApp({ ... })\` literal when the parameter has no second call site.\n` +
      `- Do NOT commit, do NOT touch .planning/, do NOT edit the plugin cache, never use --no-verify.\n\n` +
      `After editing, run whichever gates exist (skip a missing script gracefully): \`bun run format\`, ` +
      `\`bunx tsc --noEmit\`, \`bun run lint\`, \`bun run test\`. If a fix regressed a gate, revert or correct that fix ` +
      `before finishing — never leave the tree red.\n\n` +
      `Return a terse report: which issues you fixed, which you could NOT safely fix (and why), and the final ` +
      `tsc/lint/test results.\n\nISSUES (${issues.length}):\n${list}`,
    { label: `fix#${cycle}`, phase: 'Fix' },
  )
}

// --- Main loop: validate -> (uphold) -> fix -> re-verify, until clean or budget ----
let cycle = 0
let snapshot
while (true) {
  cycle++
  phase('Validate')
  const { ok, ranNames, missingTypes } = await runValidators(cycle)
  let issues = collectIssues(ok)
  let dropped = []
  if (ADVERSARIAL && issues.length > 0) {
    phase('Adversarial')
    const r = await upholdOrRefute(issues)
    issues = r.kept
    dropped = r.dropped
    log(`Adversarial: ${dropped.length} refuted (cited), ${issues.length} upheld`)
  }
  snapshot = { cycle, issues, dropped, missingTypes, ranNames }
  log(`Cycle ${cycle}: ${issues.length} issue(s), ${missingTypes.length} validator(s) un-run`)
  const clean = issues.length === 0 && missingTypes.length === 0
  if (clean || REPORT_ONLY || cycle >= MAX_CYCLES) break
  phase('Fix')
  await fixCycle(issues, cycle)
}

// --- Disposition (aggressive): PASS only if fully clean AND fully run ------
const blockers = snapshot.issues.filter((f) => f.severity === 'blocker')
const warnings = snapshot.issues.filter((f) => f.severity === 'warning')
const clean = snapshot.issues.length === 0 && snapshot.missingTypes.length === 0
const verdict = clean ? 'PASS' : 'FAIL'
const disposition = {
  verdict,
  mode: REPORT_ONLY ? 'report-only' : 'auto-fix',
  adversarial: ADVERSARIAL,
  cycles: cycle,
  ranValidators: snapshot.ranNames,
  unrun: snapshot.missingTypes,
  unrunNote:
    snapshot.missingTypes.length > 0
      ? `${snapshot.missingTypes.length} validator(s) never returned a verdict — the project was NOT fully verified, so this is a FAIL, not a pass.`
      : undefined,
  blockers,
  warnings,
  refuted: snapshot.dropped.map((d) => ({ ...d, note: `refuted by skeptics (${d.refuteVotes})` })),
  counts: { blockers: blockers.length, warnings: warnings.length, unrun: snapshot.missingTypes.length, refuted: snapshot.dropped.length },
}
log(
  `Disposition: ${verdict} — ${blockers.length} blocker(s), ${warnings.length} warning(s), ` +
    `${snapshot.missingTypes.length} un-run${REPORT_ONLY ? '' : `, ${cycle} cycle(s)`}`,
)
return disposition
