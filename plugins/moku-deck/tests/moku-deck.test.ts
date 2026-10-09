import { expect, mock, test } from 'claude-code/testing'

import { describeCall, describeRun, splitIdea, isDestructive, isTestCommand, parseFlow, parseReply, routeOf, stationOf, summarizeTests } from '../hooks/parse'

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

  // A press outside the laid-out body is no press: the surface measures the region first
  await band.resize({ columns: 12, rows: 1, in: 'quick-1' })
  await band.pointer({ type: 'down', x: 1, y: 0, in: 'quick-1' })
  await band.pointer({ type: 'up', x: 40, y: 0, in: 'quick-1' })
  expect(sent).toEqual([])
  await band.pointer({ type: 'down', x: 1, y: 0, in: 'quick-1' })
  await band.pointer({ type: 'up', x: 1, y: 0, in: 'quick-1' })
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
