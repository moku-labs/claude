import type { Change, Flow, Reply, ReplyItem, Telemetry } from '../types'

const TEST_COMMAND =
  /(^|[\s;&|(])(bun (run )?test|bunx? vitest|vitest|npm (run )?test|pnpm (run )?test|node --run test|node --test|playwright test|moku-rails check tests)(\s|$)/

const ITEM = /^\*\*(\d)\.\s+(.+?)\*\*\s*$/gm
const CODE_SPAN = /`([^`\n]{2,40})`/g
const ASKS_FOR_A_REPLY = /(скажи|напиши|выбери|ответь|\bsay\b|\breply\b|\bchoose\b)/i
const PLAIN_WORDS = /^[\p{L}\d][\p{L}\d ]{1,30}$/u

/**
 * Whether a shell command runs a test suite.
 *
 * @example
 * isTestCommand('cd app && bun test src/plugins/router') // true
 */
export function isTestCommand(command: string): boolean {
  return TEST_COMMAND.test(command)
}

/**
 * What a reply offers to act on: its numbered items, and the short answers it asks for by name.
 *
 * @example
 * parseReply('**1. Pins are old**\n\nNext: say `fix 1`').quick // ['fix 1']
 */
export function parseReply(text: string): Reply {
  const items = new Map<number, ReplyItem>()

  for (const found of text.matchAll(ITEM)) {
    const n = Number(found[1])
    if (found[2] !== undefined && !items.has(n)) items.set(n, { n, title: found[2] })
  }

  // Only a line that asks for an answer names answers: a code span elsewhere is code
  const quick = text
    .split('\n')
    .filter(line => ASKS_FOR_A_REPLY.test(line))
    .flatMap(line => [...line.matchAll(CODE_SPAN)].map(found => found[1] ?? ''))
    .filter(answer => PLAIN_WORDS.test(answer))

  return { items: [...items.values()], quick: [...new Set(quick)].slice(0, 6) }
}

const DESTRUCTIVE = /(clean|delete|remove|drop|reset|discard|\boff\b|удал|убер|сброс)/i
const SLOW_MS = 1000

/** The stations a change of each size travels, as `lib/rails/routes.mjs` has them. */
const ROUTES: Record<string, string[]> = {
  Q: ['intake', 'tweak', 'verify', 'close'],
  S: ['intake', 'build', 'verify', 'close'],
  M: ['intake', 'design', 'plan', 'build', 'verify', 'e2e', 'release', 'close'],
  L: ['intake', 'brainstorm', 'design', 'plan', 'build', 'verify', 'e2e', 'release', 'close'],
}

/** The stations a change may skip, as `lib/rails/routes.mjs` has them. */
const OPTIONAL_STATIONS = new Set(['brainstorm', 'design', 'e2e', 'release'])

/** What a game does differently at a station: it is built by feature, proven by a playtest and shipped as a build. */
const GAME_HINTS: Record<string, string> = {
  design: 'Decide the look. Stills first, then shots of the running game.',
  tweak: 'A quick edit of the game, checked right away.',
  build: 'Build feature by feature, tests first.',
  e2e: 'Headless scenarios, baselines, then a real playthrough.',
  release: 'Ship the web build or a store build.',
}

/** What each station is for, in one line a person reads at a glance. */
const STATION_HINTS: Record<string, string> = {
  intake: 'Size the request and open the change.',
  brainstorm: 'Explore the idea before any plan.',
  design: 'Decide the look, the API or the boundaries.',
  plan: 'Write the specs. No source yet.',
  tweak: 'A small edit, checked right away.',
  build: 'Build from the specs, tests first, wave by wave.',
  verify: 'Validators check structure, style and quality.',
  e2e: 'Prove it in a real run: a browser or a playtest.',
  release: 'Version, changelog, publish or deploy.',
  close: 'Tests green, verify passed, docs updated.',
}

/** What the flow tab shows where no moku session exists, so the layout can be judged. */
export const SAMPLE_FLOW: Flow = {
  isSample: true,
  isGame: true,
  ideas: ['gameplay: Daily challenge mode', 'gameplay: Undo the last move', 'look: Colour-blind palette'],
  telemetry: { runs: 14, repeats: 3, wastedSeconds: 41, slow: [{ name: 'gravity settles a full column', ms: 2140 }] },
  change: {
    id: '2026-10-09-match-three-board',
    title: 'Match-three board with gravity',
    type: 'feature',
    size: 'M',
    station: 'build',
    done: ['intake', 'design', 'plan'],
    skipped: [],
    open: ['verify', 'docs'],
    isPaused: true,
    pauseReason: 'Wave 2 of 4 is built and green. Approve to start wave 3.',
  },
}

/**
 * A station as the person calls it and what happens there. A game calls its e2e station the playtest.
 *
 * @example
 * stationOf('e2e', true).name // 'playtest'
 */
export function stationOf(station: string, isGame: boolean): { name: string; hint: string } {
  const hint = (isGame ? GAME_HINTS[station] : undefined) ?? STATION_HINTS[station] ?? ''

  return { name: isGame && station === 'e2e' ? 'playtest' : station, hint }
}

/**
 * The stations of a change in order, each with where it stands.
 *
 * @example
 * routeOf(change).find(step => step.state === 'now')?.station // 'build'
 */
export function routeOf(change: Change): { station: string; state: 'done' | 'now' | 'skipped' | 'todo'; isOptional: boolean }[] {
  return (ROUTES[change.size] ?? ROUTES.M ?? []).map(station => ({
    station,
    isOptional: OPTIONAL_STATIONS.has(station),
    state: change.station === station ? 'now' : change.done.includes(station) ? 'done' : change.skipped.includes(station) ? 'skipped' : 'todo',
  }))
}

/**
 * The open change and the parked ideas of a moku ledger (`.planning/state.json`), with the test telemetry beside it.
 *
 * @example
 * parseFlow('{"changes":[{"id":"a","status":"open","size":"S","station":"build"}],"ideas":[]}', '').change?.station // 'build'
 */
export function parseFlow(ledger: string, runsLog: string, marker = ''): Flow {
  const parsed = json(ledger)
  const changes = Array.isArray(parsed.changes) ? parsed.changes.filter(isRecord) : []
  const open = changes.find(change => change.status === 'open')
  const ideas = Array.isArray(parsed.ideas) ? parsed.ideas.filter(idea => typeof idea === 'string') : []

  return { change: open === undefined ? null : toChange(open), ideas, telemetry: parseTelemetry(runsLog), isSample: false, isGame: /^type:[ \t]*game\b/m.test(marker) }
}

/**
 * The totals of a test-run log (`.planning/tests/runs.jsonl`): runs, repeats, seconds wasted and the slow tests.
 *
 * @example
 * parseTelemetry('{"ms":1300,"repeats":"green"}').repeats // 1
 */
export function parseTelemetry(runsLog: string): Telemetry {
  const runs = runsLog.split('\n').filter(line => line.trim() !== '').map(json)
  const repeats = runs.filter(run => typeof run.repeats === 'string')
  const slow = new Map<string, number>()

  for (const run of runs) {
    for (const test of Array.isArray(run.slowest) ? run.slowest.filter(isRecord) : []) {
      if (typeof test.name === 'string' && typeof test.ms === 'number' && test.ms >= SLOW_MS) slow.set(test.name, test.ms)
    }
  }

  return {
    runs: runs.length,
    repeats: repeats.length,
    wastedSeconds: Math.round(repeats.reduce((sum, run) => sum + (typeof run.ms === 'number' ? run.ms : 0), 0) / 1000),
    slow: [...slow].map(([name, ms]) => ({ name, ms })).sort((a, b) => b.ms - a.ms).slice(0, 5),
  }
}

const TEST_SEGMENT =
  /(moku-rails check tests|(?:bunx |npx )?playwright test|bunx? vitest(?: run)?|vitest(?: run)?|(?:bun|npm|pnpm) (?:run )?test(?::[\w-]+)?|node --run test|node --test)([^|;&>]*)/
const KINDS: Record<string, string> = { e2e: 'End-to-end tests', unit: 'Unit tests', integration: 'Integration tests', visual: 'Visual tests', coverage: 'Coverage run' }
const GENERIC_FOLDERS = new Set(['tests', 'test', '__tests__', 'src', 'plugins', 'lib', 'unit', 'integration'])

/**
 * A test command as a person names it: what was tested, and with which runner.
 *
 * @example
 * describeRun('cd app && bun test src/plugins/router | tail -5') // { what: 'router tests', how: 'bun test' }
 */
export function describeRun(command: string): { what: string; how: string } {
  const found = TEST_SEGMENT.exec(command)
  const how = found?.[1] ?? 'tests'
  const paths = (found?.[2] ?? '').split(/\s+/).filter(one => /^[\w.@"'/-]+$/.test(one) && !one.startsWith('-') && /[/.]|^[a-z]/.test(one) && !/^\d+$/.test(one))

  if (how === 'moku-rails check tests') return { what: 'Close check', how: 'whole suite' }
  if (how.includes('playwright')) return { what: 'Browser tests', how }

  const kind = KINDS[/:([\w-]+)$/.exec(how)?.[1] ?? '']
  if (kind !== undefined) return { what: kind, how }
  if (paths.length === 0) return { what: 'Whole suite', how }

  const more = paths.length > 1 ? ` and ${paths.length - 1} more` : ''

  return { what: `${targetOf(paths[0] ?? '')} tests${more}`, how }
}

/** The one folder or file name of a path that says what is under test. */
function targetOf(path: string): string {
  const parts = path.replace(/["']/g, '').replace(/\.(?:test|spec)\.\w+$|\.\w+$/, '').split('/').filter(part => part !== '' && part !== '.')
  const named = parts.filter(part => !GENERIC_FOLDERS.has(part))

  return named.at(-1) ?? parts.at(-1) ?? 'some'
}

/**
 * A parked idea as its lead word and its title: `look: dark board` has the tag `look`.
 *
 * @example
 * splitIdea('look: dark board') // { tag: 'look', title: 'dark board' }
 */
export function splitIdea(idea: string): { tag: string; title: string } {
  const found = /^([\p{L}\d -]{2,24}):\s+(.+)$/u.exec(idea)

  return { tag: found?.[1]?.trim() ?? '', title: found?.[2] ?? idea }
}

/**
 * A tool call in a few words, for a status line: what is being done, not how.
 *
 * @example
 * describeCall({ tool: 'Edit', file_path: 'lib/rails/guard.mjs' }) // 'editing guard.mjs'
 */
export function describeCall(call: Record<string, unknown>): string {
  const text = (value: unknown) => (typeof value === 'string' ? value : '')
  const file = text(call.file_path).split('/').at(-1) ?? ''

  if (call.tool === 'Bash') return isTestCommand(text(call.command)) ? `running ${describeRun(text(call.command)).what.toLowerCase()}` : short(text(call.description) || text(call.command), 60)
  if (call.tool === 'Edit' || call.tool === 'Write') return `editing ${file}`
  if (call.tool === 'Read') return `reading ${file}`
  if (call.tool === 'Agent') return `starting an agent: ${short(text(call.description), 40)}`

  return `using ${text(call.tool).replace(/^mcp__.*__/, '')}`
}

/**
 * Whether a short answer names something that deletes or discards.
 *
 * @example
 * isDestructive('cleanup') // true
 */
export function isDestructive(answer: string): boolean {
  return DESTRUCTIVE.test(answer)
}

function toChange(change: Record<string, unknown>): Change {
  const checklist = isRecord(change.checklist) ? change.checklist : {}
  const list = (value: unknown) => (Array.isArray(value) ? value.filter(one => typeof one === 'string') : [])

  return {
    id: String(change.id),
    title: typeof change.title === 'string' ? change.title : String(change.id),
    type: typeof change.type === 'string' ? change.type : 'change',
    size: typeof change.size === 'string' ? change.size : 'M',
    station: typeof change.station === 'string' ? change.station : null,
    done: list(change.done),
    skipped: list(change.skipped),
    open: Object.keys(checklist).filter(item => checklist[item] !== true),
    isPaused: change.paused === true,
    pauseReason: typeof change.pauseReason === 'string' ? change.pauseReason : '',
  }
}

function json(text: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(text)

    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * The counts a test runner printed, as one short phrase, or an empty text for an output it cannot read.
 *
 * @example
 * summarizeTests('ℹ pass 214\nℹ fail 0') // '214 passed'
 */
export function summarizeTests(output: string): string {
  const passed = /(?:ℹ pass |Tests\s+(?:\d+ failed \| )?)(\d+)/.exec(output)?.[1] ?? /(\d+) pass(?:ed)?\b/.exec(output)?.[1]
  const failed = /(?:ℹ fail )(\d+)/.exec(output)?.[1] ?? /(\d+) fail(?:ed)?\b/.exec(output)?.[1]

  if (passed === undefined && failed === undefined) return ''

  return failed !== undefined && failed !== '0' ? `${failed} failed, ${passed ?? '0'} passed` : `${passed ?? '0'} passed`
}

/**
 * A text cut to a width, ending with an ellipsis when it was cut.
 *
 * @example
 * short('bun test src/plugins/router', 12) // 'bun test sr…'
 */
export function short(value: string, width: number): string {
  return value.length > width ? `${value.slice(0, width - 1)}…` : value
}
