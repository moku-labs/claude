import { expect, mock, test } from 'claude-code/testing'

import { describeCall, describeRun, detectLanguage, digestRequest, headline, parseDigests, programOf, splitIdea, isDestructive, isTestCommand, parseFlow, parseReply, routeOf, stationOf, summarizeTests } from '../hooks/parse'

// The test environment has timers, and the declarations of a hooks module name none
declare function setTimeout(run: (value?: unknown) => void, ms: number): unknown

const REPLY = [
  '**1. Pins in the game template are old**',
  '',
  'Issue: the template installs editor 0.9.1.',
  '',
  '**2. The spec row is not in the digests**',
  '',
  '```bash',
  'gh pr merge 68 --merge',
  '```',
  '',
  'Следующий шаг: скажи `pr S1`, или скажи `fix 1 2`. Набери `/reload-plugins` в чате.',
].join('\n')

const PANE = {
  plugin: 'moku-deck',
  component: 'Pane',
  requestId: 'moku-deck',
  props: { title: 'moku deck', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { top: 0, rows: 0 }, view: { rows: 24 } } as never,
} as const

test('a reply gives its numbered items and only the answers it asks for by name', () => {
  const reply = parseReply(REPLY)

  expect(reply.items).toEqual([
    { n: 1, title: 'Pins in the game template are old' },
    { n: 2, title: 'The spec row is not in the digests' },
  ])
  expect(reply.quick).toEqual(['pr S1', 'fix 1 2'])
  expect(isDestructive('cleanup')).toBe(true)
  expect(isDestructive('fix 1 2')).toBe(false)
})

test('test commands and runner counts are read as the tools print them', () => {
  expect(isTestCommand('npm test 2>&1 | tail -5')).toBe(true)
  expect(isTestCommand('git status')).toBe(false)
  expect(summarizeTests('ℹ tests 214\nℹ pass 214\nℹ fail 0')).toBe('214 passed')
  expect(summarizeTests(' 12 pass\n 2 fail')).toBe('2 failed, 12 passed')
  expect(summarizeTests('hello')).toBe('')
})

test('a ledger gives the open change, its route and what the test log says', () => {
  const ledger = JSON.stringify({
    ideas: ['daily mode'],
    changes: [
      { id: 'old', status: 'closed', size: 'S', station: null },
      { id: 'a', title: 'Board', type: 'feature', status: 'open', size: 'S', station: 'build', done: ['intake'], checklist: { tests: true, verify: false }, paused: true, pauseReason: 'wave 2 done' },
    ],
  })
  const log = ['{"ms":1300,"outcome":"green","slowest":[{"name":"gravity","ms":1202}]}', '{"ms":1300,"repeats":"green"}'].join('\n')
  const flow = parseFlow(ledger, log)

  expect(flow.change?.open).toEqual(['verify'])
  expect(flow.ideas).toEqual(['daily mode'])
  expect(routeOf(flow.change!).map(step => step.state)).toEqual(['done', 'now', 'todo', 'todo'])
  expect(flow.telemetry).toEqual({ runs: 2, repeats: 1, wastedSeconds: 1, slow: [{ name: 'gravity', ms: 1202 }] })
  expect(flow.isGame).toBe(false)
})

test('a game names its stations its own way, and a station that may be skipped is marked', () => {
  const quick = parseFlow(JSON.stringify({ changes: [{ id: 'q', status: 'open', size: 'Q', station: 'tweak', done: ['intake'] }] }), '', 'type: game\n')
  const full = parseFlow(JSON.stringify({ changes: [{ id: 'm', status: 'open', size: 'M', station: 'build' }] }), '')

  expect(quick.isGame).toBe(true)
  expect(routeOf(quick.change!).map(step => step.station)).toEqual(['intake', 'tweak', 'verify', 'close'])
  expect(stationOf('e2e', true)).toEqual({ name: 'playtest', hint: 'Headless scenarios, baselines, then a real playthrough.' })
  expect(stationOf('e2e', false).name).toBe('e2e')
  expect(routeOf(full.change!).filter(step => step.isOptional).map(step => step.station)).toEqual(['design', 'e2e', 'release'])
})

test('the flow tab shows where a paused change stands and answers the gate with one press', async ($, on) => {
  const sent: string[] = []
  on('fs.exists', () => ({ value: false }))
  on('prompt.submit', ($, e) => {
    sent.push(e.text)

    return { text: e.text }
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const pane = await $.ui.mount({ ...PANE, surface })

    // The tab is kept for the session, so each surface starts from the flow
    await pane.press({ key: 'tab-flow' })
    expect(await pane.find({ type: 'Text', text: /Sample data/ })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: /you are here/ })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: /^playtest$/ })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: /Waits for you/ })).toBeDefined()
    await pane.press({ key: 'approve' })

    await pane.press({ key: 'tab-ideas' })
    await pane.press({ key: 'idea-0' })
    await pane.unmount()
  }

  expect(sent).toEqual(['approved, continue', 'let us start the parked idea: Daily challenge mode', 'approved, continue', 'let us start the parked idea: Daily challenge mode'])
})

test('a repeated green test run is counted, and the agent is told once the switch is on', async ($, on) => {
  const clock = mock.clock(on)
  on('fs.exists', () => ({ value: false }))
  on('tool.call', { tool: 'Bash' }, async () => {
    await clock.advance(3000)

    return { result: { stdout: '', stderr: '', interrupted: false }, text: 'ℹ pass 5\nℹ fail 0' }
  })
  on('tool.call', { tool: 'Edit' }, () => ({ result: {} }))

  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  const second = await $.tool.call({ tool: 'Bash', command: 'npm test' })

  expect(second.context).toBe(undefined)

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })

  await pane.press({ key: 'tab-tests' })
  expect(await pane.find({ type: 'Text', text: /3 of 14 test runs were not needed/ })).toBeDefined()
  expect(await pane.findAll({ type: 'Text', text: /^not needed$/ })).toHaveLength(1)
  expect(await pane.findAll({ type: 'Text', text: /^Whole suite$/ })).toHaveLength(2)
  await pane.press({ key: 'coach' })
  expect(await pane.find({ type: 'Button', key: 'coach', text: /On/ })).toBeDefined()

  const third = await $.tool.call({ tool: 'Bash', command: 'npm test' })
  expect(third.context?.[0]).toContain('already green')

  await $.tool.call({ tool: 'Edit', file_path: 'a.ts', old_string: 'a', new_string: 'b' })
  const fourth = await $.tool.call({ tool: 'Bash', command: 'npm test' })
  expect(fourth.context).toBe(undefined)
  await pane.unmount()
})

test('a test command is named by what it tested, and ideas are grouped by their lead word', () => {
  expect(describeRun('cd app && bun test src/plugins/router | tail -5')).toEqual({ what: 'router tests', how: 'bun test' })
  expect(describeRun('W=/x; (cd $W && npm test 2>&1 | grep pass)')).toEqual({ what: 'Whole suite', how: 'npm test' })
  expect(describeRun('node --test plugins/moku/tests/rails/guard.test.mjs plugins/moku/tests/rails/cli.test.mjs').what).toBe('guard tests and 1 more')
  expect(describeRun('bun run test:visual').what).toBe('Visual tests')
  expect(describeRun('moku-rails check tests').what).toBe('Close check')

  expect(splitIdea('look: dark board')).toEqual({ tag: 'look', title: 'dark board' })
  expect(splitIdea('undo')).toEqual({ tag: '', title: 'undo' })
  expect(describeCall({ tool: 'Edit', file_path: 'lib/rails/guard.mjs' })).toBe('editing guard.mjs')
  expect(describeCall({ tool: 'Bash', command: 'npm test | tail -3', description: 'Run tests' })).toBe('running whole suite')
  expect(describeCall({ tool: 'Bash', command: 'git status', description: 'Show working tree status' })).toBe('Show working tree status')
})

test('the bar says what runs while a tool call runs, and keeps it as the last word after', async ($, on) => {
  const BAND = { plugin: 'moku-deck', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 120 } as never } as const
  let during: unknown
  on('fs.exists', () => ({ value: false }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => h($.ui.resolve(e).Text, null, 'the engine band') as never)
  on('ui.open', () => ({ value: {} as never }))
  on('tool.call', { tool: 'Edit' }, async () => {
    const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
    during = await band.find({ type: 'Text', text: /Claude is editing guard\.mjs/ })
    await band.unmount()

    return { result: {} }
  })

  // Outside a moku session the command turns the preview on
  await $.command.run({ command: 'moku-deck' } as never)
  await $.tool.call({ tool: 'Edit', file_path: 'lib/rails/guard.mjs', old_string: 'a', new_string: 'b' })
  expect(during).toBeDefined()

  const after = await $.ui.mount({ ...BAND, surface: 'desktop' })
  // With no answers on the bar the finished call stays as the last word, until another call or a reply
  expect(await after.find({ type: 'Text', text: /Claude is editing/ })).toBe(undefined)
  expect(await after.find({ type: 'Text', text: /Claude was editing guard\.mjs/ })).toBeDefined()
  expect(await after.find({ type: 'Button', key: 'deck' })).toBeDefined()
  await after.unmount()
})

test('on a desktop an answer is drawn by the mod, and a press on it sends that answer', async ($, on) => {
  const BAND = { plugin: 'moku-deck', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120 } as never } as const
  const sent: string[] = []
  on('fs.exists', () => ({ value: false }))
  on('prompt.submit', ($, e) => {
    sent.push(e.text)

    return { text: e.text }
  })
  on('turn.complete', () => ({ text: '' }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => h($.ui.resolve(e).Text, null, 'the engine band') as never)

  on('ui.open', () => ({ value: {} as never }))

  // Outside a moku session the bar is absent until the command turns the preview on
  await $.turn.complete({ answer: 'Скажи `ок`.', durationMs: 1, isAborted: false, turnId: 't0', reason: 'answer' } as never)
  const hidden = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await hidden.find({ type: 'Text', text: /the engine band/ })).toBeDefined()
  await hidden.unmount()
  await $.command.run({ command: 'moku-deck' } as never)

  // A finished answer of the main loop is what fills the bar
  await $.turn.complete({ answer: 'Следующий шаг: скажи `pr S6`, или скажи `cleanup`.', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' } as never)

  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })

  expect(await band.find({ type: 'Client', key: 'quick-0' })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /^pr S6$/, in: 'quick-0' })).toBeDefined()

  // The press is taken on the way down, once: the release adds nothing
  await band.pointer({ type: 'down', x: 1, y: 0, in: 'quick-1' })
  expect(sent).toEqual(['cleanup'])
  await band.unmount()

  // The answer is sent once. The bar stays, with the door to the deck
  const after = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await after.find({ type: 'Client', key: 'quick-1' })).toBe(undefined)
  expect(await after.find({ type: 'Button', key: 'deck' })).toBeDefined()
  await after.unmount()
})

test('a prompt typed in the chat takes the offered answers off the bar', async ($, on) => {
  const BAND = { plugin: 'moku-deck', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120 } as never } as const
  on('fs.exists', () => ({ value: false }))
  on('ui.open', () => ({ value: {} as never }))
  on('turn.complete', () => ({ text: '' }))
  on('prompt.submit', ($, e) => ({ text: e.text }))

  await $.command.run({ command: 'moku-deck' } as never)
  await $.turn.complete({ answer: 'Скажи `pr S6`.', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' } as never)

  const before = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await before.find({ type: 'Client', key: 'quick-0' })).toBeDefined()
  // Answers are offered and nothing runs: the bar says nothing beside them
  expect(await before.find({ type: 'Text', text: / (is|was) / })).toBe(undefined)
  await before.unmount()

  await $.prompt.submit({ text: 'нет, давай иначе' } as never)

  const after = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await after.find({ type: 'Client', key: 'quick-0' })).toBe(undefined)
  expect(await after.find({ type: 'Button', key: 'deck' })).toBeDefined()
  await after.unmount()
})

test('the language of a text is told by its letters, code left out, and a short text tells nothing', () => {
  expect(detectLanguage('Сделал. Мод перезагрузится после этого сообщения.')).toBe('ru')
  expect(detectLanguage('Done. The mod reloads after this message.')).toBe('en')
  expect(detectLanguage('Запусти `gh pr merge 72 --merge` и потом `git pull --ff-only`, это всё.')).toBe('ru')
  expect(detectLanguage('pr S6')).toBe(undefined)
  expect(describeRun('npm test', 'ru')).toEqual({ what: 'Весь набор', how: 'npm test' })
  expect(describeCall({ tool: 'Edit', file_path: 'lib/guard.mjs' }, 'ru')).toBe('правка guard.mjs')
  expect(programOf('cd app && FOO=1 gh pr merge 74')).toBe('gh')
  expect(describeCall({ tool: 'Bash', command: 'cd x && gh pr merge 74', description: 'Merge the pull request and fast-forward main' }, 'ru')).toBe('команда gh')
  expect(describeCall({ tool: 'Bash', command: 'gh pr merge 74', description: 'Смержить pull request и подтянуть main' }, 'ru')).toBe('Смержить pull request и подтянуть main')
  expect(describeCall({ tool: 'Bash', command: 'gh pr merge 74', description: 'Merge the pull request and fast-forward main' }, 'en')).toBe('Merge the pull request and fast-forward main')
  expect(stationOf('build', true, 'ru').hint).toBe('Сборка по фичам, сначала тесты.')
  expect(summarizeTests('ℹ pass 5\nℹ fail 2', 'ru')).toBe('2 упало, 5 прошло')
})

test('the deck speaks the language of the conversation, and a short answer does not change it', async ($, on) => {
  const sent: string[] = []
  on('fs.exists', () => ({ value: false }))
  on('turn.complete', () => ({ text: '' }))
  on('prompt.submit', ($, e) => {
    sent.push(e.text)

    return { text: e.text }
  })

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await pane.press({ key: 'tab-flow' })
  expect(await pane.find({ type: 'Button', key: 'tab-ideas', text: /Ideas/ })).toBeDefined()

  // A Russian answer of the main loop switches every word of the deck
  await $.turn.complete({ answer: 'Сделал. Мод перезагрузится после этого сообщения. Скажи `ок`.', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  expect(await pane.find({ type: 'Button', key: 'tab-ideas', text: /Идеи/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /вы здесь/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /Сборка по фичам/ })).toBeDefined()
  expect(await pane.find({ type: 'Button', key: 'approve', text: /Одобрить и продолжить/ })).toBeDefined()

  // The press answers in Russian too, and `ok` is too short to switch the deck back
  await pane.press({ key: 'approve' })
  expect(sent).toEqual(['одобрено, продолжай'])
  await $.prompt.submit({ text: 'ok' } as never)
  expect(await pane.find({ type: 'Button', key: 'tab-ideas', text: /Идеи/ })).toBeDefined()

  // A long English prompt does
  await $.prompt.submit({ text: 'please continue with the next step of the build' } as never)
  expect(await pane.find({ type: 'Button', key: 'tab-ideas', text: /Ideas/ })).toBeDefined()
  await pane.unmount()
})

test('an idea gets a short card in the language of the conversation, and the note itself is one press away', async ($, on) => {
  const asked: string[] = []
  on('fs.exists', () => ({ value: false }))
  on('turn.complete', () => ({ text: '' }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('model.complete', ($, e) => {
    asked.push(e.prompt)

    const cards = [1, 2, 3].map(n => ({ title: `Карточка ${n}`, points: ['Что это', 'Зачем это'] }))

    return { value: { isAnswered: true, text: `Вот: ${JSON.stringify(cards)}`, usage: {} } } as never
  })

  expect(headline('Record & replay timeline (Alex 2026-10-04): Record button, play, Stop')).toBe('Record & replay timeline')
  expect(digestRequest(['undo'], 'ru').prompt).toContain('Write in Russian.')
  expect(parseDigests('not json', 1)).toEqual([])
  expect(parseDigests('[{"title":"A","points":["b"]}]', 2)).toEqual([])

  await $.turn.complete({ answer: 'Сделал. Мод перезагрузится после этого сообщения.', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' } as never)

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await pane.press({ key: 'tab-ideas' })

  expect(asked.length).toBe(1)
  expect(asked[0]).toContain('Write in Russian.')
  expect(await pane.findAll({ type: 'Text', text: /^Карточка \d$/ })).toHaveLength(3)
  expect(await pane.find({ type: 'Text', text: /Daily challenge mode/ })).toBe(undefined)

  await pane.press({ key: 'more-0' })
  expect(await pane.find({ type: 'Text', text: /Daily challenge mode|Undo the last move/ })).toBeDefined()

  // The cards are kept: opening the tab again asks nothing
  await pane.press({ key: 'tab-flow' })
  await pane.press({ key: 'tab-ideas' })
  expect(asked.length).toBe(1)
  await pane.unmount()
})

test('a second press while the first answer is still on its way sends nothing', async ($, on) => {
  const sent: string[] = []
  let release = () => {}
  on('fs.exists', () => ({ value: false }))
  on('prompt.submit', async ($, e) => {
    sent.push(e.text)
    // The session is busy: the prompt waits, as it does while a turn runs
    await new Promise<void>(resolve => (release = resolve))

    return { text: e.text }
  })

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await pane.press({ key: 'tab-flow' })

  const first = pane.press({ key: 'approve' })
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(await pane.find({ type: 'Text', text: /Sending: approved, continue/ })).toBeDefined()

  const second = pane.press({ key: 'approve' })
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(sent).toEqual(['approved, continue'])

  release()
  await Promise.all([first, second])
  expect(await pane.find({ type: 'Text', text: /Sending:/ })).toBe(undefined)
  expect(sent).toEqual(['approved, continue'])
  await pane.unmount()
})
