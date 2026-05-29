export const meta = {
  name: 'moku-migrate-sweep',
  description: 'Sweep a mechanical migration across many files: discover sites, transform each file in parallel (one agent per file = disjoint writes), verify, and report anything that fails',
  whenToUse: 'OPT-IN fan-out for a large, mechanical, repo-wide change (e.g. rename an event, change a factory call signature, adopt a new pattern across 20+ files). Pass {pattern, change} describing what to find and how to transform it.',
  phases: [
    { title: 'Discover', detail: 'find migration sites' },
    { title: 'Migrate+Verify', detail: 'transform each file, verify as it completes' },
    { title: 'Report', detail: 'aggregate + flag failures' },
  ],
}

const PATTERN = (args && args.pattern) || (typeof args === 'string' ? args : null)
const CHANGE = (args && args.change) || 'Apply the described migration faithfully; do not change unrelated code.'
if (!PATTERN) {
  log('No {pattern} provided — nothing to sweep.')
  return { error: 'no-pattern' }
}

const SITES = {
  type: 'object',
  required: ['files'],
  properties: {
    files: { type: 'array', items: { type: 'string' } },
    note: { type: 'string' },
  },
}
const MIGRATION = {
  type: 'object',
  required: ['file', 'status'],
  properties: {
    file: { type: 'string' },
    status: { type: 'string', enum: ['migrated', 'no-change', 'failed'] },
    edits: { type: 'number' },
    notes: { type: 'string' },
  },
}
const VERIFY = {
  type: 'object',
  required: ['ok'],
  properties: { ok: { type: 'boolean' }, detail: { type: 'string' } },
}

// --- Discover ------------------------------------------------------------
phase('Discover')
const sites = await agent(
  `Find every file affected by this migration. Pattern to locate sites: ${JSON.stringify(PATTERN)}. ` +
    `Use Grep/Glob. Return the de-duplicated list of file paths (one agent will own each whole file, ` +
    `so group by file, not by match). Exclude node_modules, dist, .planning, and vendored references.`,
  { label: 'discover-sites', phase: 'Discover', schema: SITES },
)
const files = [...new Set(sites?.files ?? [])]
if (files.length === 0) {
  log('No migration sites found.')
  return { pattern: PATTERN, migrated: 0, note: sites?.note || 'no-sites' }
}
log(`${files.length} file(s) to migrate`)

// --- Migrate + Verify (pipeline; one agent owns each whole file = disjoint writes) ---
phase('Migrate+Verify')
const results = await pipeline(
  files,
  (file) =>
    agent(
      `Migrate the file "${file}". Change to apply: ${CHANGE}. Pattern that located it: ` +
        `${JSON.stringify(PATTERN)}. Edit ONLY this file. Ground naming/structure decisions in ` +
        `${'$'}{CLAUDE_PLUGIN_ROOT}/skills/moku-core/references/spec-index.md. If the file does not ` +
        `actually need the change, return status "no-change". Return the migration result.`,
      { label: `migrate:${file.split('/').pop()}`, phase: 'Migrate+Verify', schema: MIGRATION },
    ),
  (mig, file) =>
    agent(
      `Verify the migrated file "${file}" is still correct: it type-checks in context, imports resolve, ` +
        `and the change was applied without collateral damage. Run \`bunx tsc --noEmit\` if cheap. ` +
        `Return ok=true/false with detail.`,
      { label: `verify:${file.split('/').pop()}`, phase: 'Migrate+Verify', schema: VERIFY },
    ).then((verify) => ({ file, mig, verify })),
)

// --- Report --------------------------------------------------------------
phase('Report')
const done = results.filter(Boolean)
const failed = done.filter((r) => r.mig?.status === 'failed' || r.verify?.ok === false)
const migrated = done.filter((r) => r.mig?.status === 'migrated')
log(`Migrated ${migrated.length}/${files.length}; ${failed.length} need attention`)

return {
  pattern: PATTERN,
  totalSites: files.length,
  migrated: migrated.length,
  noChange: done.filter((r) => r.mig?.status === 'no-change').length,
  failed: failed.map((r) => ({ file: r.file, reason: r.verify?.detail || r.mig?.notes })),
  verdict: failed.length === 0 ? 'PASS' : 'NEEDS-ATTENTION',
}
