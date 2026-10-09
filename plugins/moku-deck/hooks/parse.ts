import type { Change, Flow, Lang, Reply, ReplyItem, Telemetry } from '../types'

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

/** What each station is for, in one line a person reads at a glance, per language. */
const STATION_HINTS: Record<Lang, Record<string, string>> = {
  en: {
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
  },
  ru: {
    intake: 'Оценить запрос и открыть изменение.',
    brainstorm: 'Обдумать идею до любого плана.',
    design: 'Решить вид, API или границы.',
    plan: 'Написать спеки. Кода пока нет.',
    tweak: 'Небольшая правка, проверка сразу.',
    build: 'Сборка по спекам, сначала тесты, волна за волной.',
    verify: 'Валидаторы проверяют структуру, стиль и качество.',
    e2e: 'Доказать в настоящем запуске: браузер или плейтест.',
    release: 'Версия, changelog, публикация или деплой.',
    close: 'Тесты зелёные, verify пройден, доки обновлены.',
  },
}

/** What a game does differently at a station: it is built by feature, proven by a playtest and shipped as a build. */
const GAME_HINTS: Record<Lang, Record<string, string>> = {
  en: {
    design: 'Decide the look. Stills first, then shots of the running game.',
    tweak: 'A quick edit of the game, checked right away.',
    build: 'Build feature by feature, tests first.',
    e2e: 'Headless scenarios, baselines, then a real playthrough.',
    release: 'Ship the web build or a store build.',
  },
  ru: {
    design: 'Решить вид. Сначала статичные кадры, потом снимки запущенной игры.',
    tweak: 'Быстрая правка игры, проверка сразу.',
    build: 'Сборка по фичам, сначала тесты.',
    e2e: 'Headless-сценарии, эталоны, потом настоящее прохождение.',
    release: 'Выпустить веб-сборку или сборку для стора.',
  },
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
 * stationOf('e2e', true, 'ru').hint // 'Headless-сценарии, эталоны, потом настоящее прохождение.'
 */
export function stationOf(station: string, isGame: boolean, lang: Lang = 'en'): { name: string; hint: string } {
  const hint = (isGame ? GAME_HINTS[lang][station] : undefined) ?? STATION_HINTS[lang][station] ?? ''

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
const KINDS: Record<Lang, Record<string, string>> = {
  en: { e2e: 'End-to-end tests', unit: 'Unit tests', integration: 'Integration tests', visual: 'Visual tests', coverage: 'Coverage run' },
  ru: { e2e: 'Сквозные тесты', unit: 'Юнит-тесты', integration: 'Интеграционные тесты', visual: 'Визуальные тесты', coverage: 'Прогон с покрытием' },
}
const RUNS = {
  en: { close: 'Close check', whole: 'Whole suite', wholeHow: 'whole suite', browser: 'Browser tests', of: (target: string) => `${target} tests`, more: (n: number) => ` and ${n} more` },
  ru: { close: 'Проверка при закрытии', whole: 'Весь набор', wholeHow: 'весь набор', browser: 'Тесты в браузере', of: (target: string) => `тесты ${target}`, more: (n: number) => ` и ещё ${n}` },
}
const GENERIC_FOLDERS = new Set(['tests', 'test', '__tests__', 'src', 'plugins', 'lib', 'unit', 'integration'])

/**
 * A test command as a person names it: what was tested, and with which runner.
 *
 * @example
 * describeRun('cd app && bun test src/plugins/router | tail -5') // { what: 'router tests', how: 'bun test' }
 */
export function describeRun(command: string, lang: Lang = 'en'): { what: string; how: string } {
  const found = TEST_SEGMENT.exec(command)
  const how = found?.[1] ?? 'tests'
  const paths = (found?.[2] ?? '').split(/\s+/).filter(one => /^[\w.@"'/-]+$/.test(one) && !one.startsWith('-') && /[/.]|^[a-z]/.test(one) && !/^\d+$/.test(one))
  const say = RUNS[lang]

  if (how === 'moku-rails check tests') return { what: say.close, how: say.wholeHow }
  if (how.includes('playwright')) return { what: say.browser, how }

  const kind = KINDS[lang][/:([\w-]+)$/.exec(how)?.[1] ?? '']
  if (kind !== undefined) return { what: kind, how }
  if (paths.length === 0) return { what: say.whole, how }

  return { what: `${say.of(targetOf(paths[0] ?? ''))}${paths.length > 1 ? say.more(paths.length - 1) : ''}`, how }
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

/** The most a status says. The bar cuts it at its own edge, so this only keeps a runaway text out of the state. */
const STATUS_WIDTH = 200

/**
 * A tool call in a few words, for a status line: what is being done, not how.
 *
 * @example
 * describeCall({ tool: 'Edit', file_path: 'lib/rails/guard.mjs' }) // 'editing guard.mjs'
 */
export function describeCall(call: Record<string, unknown>, lang: Lang = 'en'): string {
  const text = (value: unknown) => (typeof value === 'string' ? value : '')
  const file = text(call.file_path).split('/').at(-1) ?? ''
  const say = CALLS[lang]

  if (call.tool === 'Bash') {
    if (isTestCommand(text(call.command))) return say.tests(describeRun(text(call.command), lang).what.toLowerCase())

    // Claude writes the description of a command. When it is not in the deck's language, the command is named instead
    const described = text(call.description)

    return described !== '' && (detectLanguage(described) ?? lang) === lang ? short(described, STATUS_WIDTH) : say.command(programOf(text(call.command)))
  }
  if (call.tool === 'Edit' || call.tool === 'Write') return say.edit(file)
  if (call.tool === 'Read') return say.read(file)
  if (call.tool === 'Agent') return say.agent(short(text(call.description), STATUS_WIDTH))

  return say.tool(text(call.tool).replace(/^mcp__.*__/, ''))
}

/** A call in a few words. English says what the worker is doing, Russian names the work, so each fits its status line. */
const CALLS = {
  en: {
    tests: (what: string) => `running ${what}`,
    edit: (file: string) => `editing ${file}`,
    read: (file: string) => `reading ${file}`,
    agent: (task: string) => `starting an agent: ${task}`,
    tool: (name: string) => `using ${name}`,
    command: (program: string) => `running ${program}`,
  },
  ru: {
    tests: (what: string) => `прогон тестов, ${what}`,
    edit: (file: string) => `правка ${file}`,
    read: (file: string) => `чтение ${file}`,
    agent: (task: string) => `запуск агента: ${task}`,
    tool: (name: string) => `инструмент ${name}`,
    command: (program: string) => `команда ${program}`,
  },
}

const MIN_LETTERS = 12

/**
 * The program a shell command runs: its first word that is not a step into a directory or a variable.
 *
 * @example
 * programOf('cd app && FOO=1 gh pr merge 74') // 'gh'
 */
export function programOf(command: string): string {
  const words = command.split(/&&|\|\||[;|\n(]/).flatMap(part => part.trim().split(/\s+/).filter(word => !/^[A-Za-z_]\w*=/.test(word)).slice(0, 1))

  return words.find(word => word !== '' && word !== 'cd' && word !== 'export') ?? 'shell'
}

/**
 * The language a text is written in, by its letters, or nothing for a text too short to tell. Code is left out:
 * a Russian reply full of commands is still Russian.
 *
 * @example
 * detectLanguage('Сделал. Мод перезагрузится после этого сообщения.') // 'ru'
 */
export function detectLanguage(text: string): Lang | undefined {
  const letters = text.replace(/```[\s\S]*?```|`[^`\n]*`/g, '').match(/\p{L}/gu) ?? []
  // A named answer such as `style filled` is too short to say what language the conversation is in
  if (letters.length < MIN_LETTERS) return undefined

  return letters.filter(letter => /\p{Script=Cyrillic}/u.test(letter)).length / letters.length > 0.3 ? 'ru' : 'en'
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
export function summarizeTests(output: string, lang: Lang = 'en'): string {
  const passed = /(?:ℹ pass |Tests\s+(?:\d+ failed \| )?)(\d+)/.exec(output)?.[1] ?? /(\d+) pass(?:ed)?\b/.exec(output)?.[1]
  const failed = /(?:ℹ fail )(\d+)/.exec(output)?.[1] ?? /(\d+) fail(?:ed)?\b/.exec(output)?.[1]
  const [ok, bad] = lang === 'ru' ? ['прошло', 'упало'] : ['passed', 'failed']

  if (passed === undefined && failed === undefined) return ''

  return failed !== undefined && failed !== '0' ? `${failed} ${bad}, ${passed ?? '0'} ${ok}` : `${passed ?? '0'} ${ok}`
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
