import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Tab, TestRun } from '../types'
import {
  SAMPLE_FLOW,
  describeCall,
  describeRun,
  isDestructive,
  isTestCommand,
  parseFlow,
  parseReply,
  routeOf,
  short,
  splitIdea,
  stationOf,
  summarizeTests,
} from './parse'

const PANE = 'moku-deck'
const LEDGER_FILE = '.planning/state.json'
const RUNS_FILE = '.planning/tests/runs.jsonl'
const MARKER_FILE = '.planning/moku.md'
const REFRESH_MS = 5000
const KEPT_RUNS = 50
const TABS: { tab: Tab; label: string }[] = [
  { tab: 'flow', label: 'Flow' },
  { tab: 'ideas', label: 'Ideas' },
  { tab: 'tests', label: 'Tests' },
]

// The moku brand: one hot pink for where you are, mint for what is good, amber for what waits, lavender for quiet text
const PINK = '#ff2e63'
const MINT = '#7be0c3'
const AMBER = '#ffcf87'
const LAV = '#cfc9ec'
const INK = '#0a0b12'

/** The room between two answers in the bar, in characters. */
const ANSWER_GAP = 1.25


const tab = atom({ plugin: 'moku-deck', key: 'tab' } as const, 'flow')
const flow = atom({ plugin: 'moku-deck', key: 'flow' } as const, SAMPLE_FLOW)
const reply = atom({ plugin: 'moku-deck', key: 'reply' } as const, null)
const picked = atom({ plugin: 'moku-deck', key: 'picked' } as const, [])
const isPicking = atom({ plugin: 'moku-deck', key: 'isPicking' } as const, false)
const isPreview = atom({ plugin: 'moku-deck', key: 'isPreview' } as const, false)
const tests = atom({ plugin: 'moku-deck', key: 'tests' } as const, { runs: [], edits: 0, greenAt: {} })
const isCoaching = atom({ plugin: 'moku-deck', key: 'isCoaching' } as const, false)
const calls = atom({ plugin: 'moku-deck', key: 'calls' } as const, [])
const lastCall = atom({ plugin: 'moku-deck', key: 'lastCall' } as const, null)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'moku-deck', description: 'Open the moku deck: the flow, parked ideas and test runs' })

    // A reload cannot know which calls of the old copy are still running
    await update($, calls, () => [])
    await update($, lastCall, () => null)
    await refresh($)
    $.clock.every(REFRESH_MS, () => void refresh($))
    await readLastReply($)

    return next(e)
  })

  on('command.run', { command: 'moku-deck' }, async $ => {
    // Outside a moku session the command is the one way in: it turns the preview on, with sample data
    await update($, isPreview, () => true)
    await openDeck($)

    return { text: 'moku deck opened.' }
  })

  // A prompt the person sends answers the reply in their own words: its offers are stale from then on
  on('prompt.submit', async ($, e, next) => {
    await update($, reply, () => null)
    await update($, picked, () => [])
    await update($, isPicking, () => false)

    return next(e)
  })

  // The reply bar: every finished answer of the main loop offers its named answers and its items
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && e.answer !== '') {
      await update($, reply, () => parseReply(e.answer))
      await update($, lastCall, () => null)
      await update($, picked, () => [])
      await update($, isPicking, () => false)
    }

    return next(e)
  })

  // The status line: every tool call is on it for as long as it runs
  on('tool.call', async ($, e, next) => {
    const id = e.tool_use_id ?? ''
    const who = e.agentId === undefined ? 'Claude' : `Agent ${e.agentId.slice(0, 4)}`

    const call = { id, who, text: describeCall(e) }

    await update($, calls, now => [...now, call].slice(-20))

    try {
      return await next(e)
    } finally {
      // The finished call stays as the last word of the status until another one takes its place
      await update($, lastCall, () => call)
      await update($, calls, now => now.filter(one => one.id !== id))
    }
  })

  // An edit names another tree: a test run after it is never a repeat
  on('tool.call', { tool: 'Write' }, ($, e, next) => countEdit($).then(() => next(e)))
  on('tool.call', { tool: 'Edit' }, ($, e, next) => countEdit($).then(() => next(e)))

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (!isTestCommand(e.command)) return next(e)

    const startedAt = await $.clock.now()
    const ran = await next(e)
    const seconds = Math.round(((await $.clock.now()) - startedAt) / 1000)

    const isRed = ran.deny !== undefined || ran.isError === true
    const who = e.agentId === undefined ? 'main' : `agent ${e.agentId.slice(0, 6)}`
    const key = `${who}\n${e.command}`
    const before = await read($, tests)
    const isRepeat = !isRed && before.greenAt[key] === before.edits
    const record: TestRun = {
      id: e.tool_use_id ?? '',
      command: e.command,
      who,
      seconds,
      summary: summarizeTests(ran.text ?? ''),
      isRed,
      isRepeat,
    }

    await update($, tests, now => ({
      runs: [...now.runs, record].slice(-KEPT_RUNS),
      edits: now.edits,
      greenAt: isRed ? without(now.greenAt, key) : { ...now.greenAt, [key]: now.edits },
    }))

    // Telling the agent is the person's switch: off, the run is only recorded
    if (!isRepeat || ran.deny !== undefined || !(await read($, isCoaching))) return ran

    const advice =
      'moku-deck: this exact test command was already green and no file was edited since. ' +
      'Do not run a suite again to read another part of its output: write the output to a file once and read the file.'

    return { ...ran, context: [...(ran.context ?? []), advice] }
  })

  // A finished test run in the transcript: one native row with the verdict instead of the raw call
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (e.props.tool !== 'Bash' || e.props.isRunning) return next(e)

    const found = (await read($, tests)).runs.find(one => one.id === e.props.tool_use_id)
    if (found === undefined) return next(e)

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box gap={1}>
        <Text color={found.isRed ? PINK : MINT} bold>
          {found.isRed ? 'Tests red' : 'Tests green'}
        </Text>
        <Text>{found.summary === '' ? `${found.seconds}s` : `${found.summary} in ${found.seconds}s`}</Text>
        {found.isRepeat && <Text color={AMBER}>Not needed: nothing was edited since the last green run</Text>}
        <Text dimColor wrap="truncate-end">
          {short(found.command, 60)}
        </Text>
      </Box>
    )
  })

  // A press on an answer the mod drew itself: the key of the instance says which answer it was
  on('ui.message', async ($, e, next) => {
    const shown = await read($, reply)
    const list = [...(await read($, picked))].sort((a, b) => a - b).join(' ')
    const quick = /^quick-(\d+)$/.exec(e.element)?.[1]
    const verb = /^verb-(apply|fix|skip)$/.exec(e.element)?.[1]
    const text = quick !== undefined ? shown?.quick[Number(quick)] : verb !== undefined && list !== '' ? `${verb} ${list}` : undefined

    if (text !== undefined) await answer($, text)

    return next(e)
  })

  // One quiet row above the prompt: the door to the deck, the answers the reply asks for, and what is running now
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const shown = (await read($, reply)) ?? { items: [], quick: [] }
    const running = await read($, calls)
    const { isSample } = await read($, flow)

    // The bar belongs to a moku session: it is always there in one, with or without answers to give, and absent
    // anywhere else unless the preview is on
    if (e.props.hasSurvey || !(!isSample || (await read($, isPreview)))) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    const chosen = [...(await read($, picked))].sort((a, b) => a - b)
    const picking = await read($, isPicking)
    const list = chosen.join(' ')
    const isTerminal = e.surface === 'terminal'
    const hasAnswers = shown.quick.length > 0 || shown.items.length > 0
    const others = Math.max(0, new Set(running.map(one => one.who)).size - 1)

    // The status and the answers take turns. With no answers the status is the bar: the call that runs, or the
    // last one that ran. Once answers are offered only work still running is said, after them.
    const said = running.at(-1) ?? (hasAnswers ? undefined : ((await read($, lastCall)) ?? undefined))
    const isRunning = running.length > 0

    // The outline of an answer says what kind it is: mint is the next step, lavender is optional, pink deletes something
    const tone = (text: string, i: number) => (isDestructive(text) ? PINK : i === 0 ? MINT : LAV)

    // Mint is the next step, grey is optional, pink deletes. On a desktop the mod draws the answer itself
    // (answer.tsx), since the app's own button cannot be made taller; a press there arrives as a `ui.message`.
    const chip = (key: string, label: string, color: string, onPress: () => void) => {
      if (e.surface !== 'desktop') return <Button key={key} label={label} variant={color === MINT ? 'primary' : 'secondary'} onPress={onPress} />

      const { Client } = $.ui.resolve(e)

      return <Client key={key} module="./answer.tsx" props={{ label, kind: color === MINT ? 'next' : color === PINK ? 'deletes' : 'optional' }} />
    }

    return (
      <Box flexDirection="column" rowGap={1}>
        <Box alignItems="center" columnGap={2}>
          {/* The answers never move: they keep their width, and the status beside them is what gets cut */}
          <Box columnGap={ANSWER_GAP} alignItems="center" flexShrink={0}>
            <Box gap={1} alignItems="center" flexShrink={0}>
              <Text color={PINK} bold>
                ◆
              </Text>
              <Button key="deck" plain label="moku" onPress={() => openDeck($)} />
            </Box>
            {shown.quick.map((text, i) => chip(`quick-${i}`, text, tone(text, i), () => void answer($, text)))}
            {shown.items.length > 0 && (
              <Button key="picking" plain label={picking ? 'Hide the items' : `Pick from ${shown.items.length} items`} onPress={() => update($, isPicking, now => !now)} />
            )}
          </Box>
          {/* The status starts right after what is before it and is cut at the edge: it never reaches an answer */}
          <Box flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
            {said !== undefined && (
              <Text color={LAV} dimColor={!isRunning} wrap="truncate-end">
                {said.who} {isRunning ? 'is' : 'was'} {short(said.text, 60)}
                {others > 0 ? `, ${others} more at work` : ''}
              </Text>
            )}
          </Box>
        </Box>

        {picking && (
          <Box flexDirection="column" rowGap={1}>
            {shown.items.map(item => (
              <Box gap={1} alignItems="center">
                <Button
                  key={`pick-${item.n}`}
                  label={chosen.includes(item.n) ? 'Picked' : 'Pick'}
                  variant={chosen.includes(item.n) ? 'primary' : 'secondary'}
                  onPress={() => update($, picked, now => toggle(now, item.n))}
                />
                <Text bold={chosen.includes(item.n)} dimColor={!chosen.includes(item.n)} wrap="truncate-end">
                  {item.n}. {item.title}
                </Text>
              </Box>
            ))}
            {chosen.length > 0 && (
              <Box columnGap={ANSWER_GAP} alignItems="center">
                {chip('verb-apply', `apply ${list}`, MINT, () => void answer($, `apply ${list}`))}
                {chip('verb-fix', `fix ${list}`, LAV, () => void answer($, `fix ${list}`))}
                {chip('verb-skip', `skip ${list}`, LAV, () => void answer($, `skip ${list}`))}
              </Box>
            )}
          </Box>
        )}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const active = await read($, tab)
    const { change, telemetry, isSample, isGame, ...rest } = await read($, flow)
    const ideas = [...rest.ideas].sort((a, b) => splitIdea(a).tag.localeCompare(splitIdea(b).tag))
    const { runs } = await read($, tests)
    const coaching = await read($, isCoaching)
    const width = Math.max(16, Math.min(40, e.props.bodyColumns - 8))
    const needed = Math.max(0, telemetry.runs - telemetry.repeats)
    const wastedCells = telemetry.runs === 0 ? 0 : Math.max(telemetry.repeats > 0 ? 1 : 0, Math.round((telemetry.repeats / telemetry.runs) * width))
    const slowest = telemetry.slow[0]?.ms ?? 1

    // A bar is a run of cells with a background: the one chart a native tree can draw
    const bar = (cells: number, color: string) => <Text color={color}>{'█'.repeat(Math.max(0, cells))}</Text>

    return (
      <Box flexDirection="column" gap={1}>
        <Box gap={1}>
          {TABS.map(one => (
            <Button
              key={`tab-${one.tab}`}
              label={one.tab === 'ideas' && ideas.length > 0 ? `${one.label} ${ideas.length}` : one.label}
              variant={active === one.tab ? 'primary' : 'secondary'}
              onPress={() => update($, tab, () => one.tab)}
            />
          ))}
        </Box>

        {isSample && (
          <Text color={AMBER} wrap="wrap">
            Sample data. This directory has no moku session, so this is how a game change would look.
          </Text>
        )}

        {active === 'flow' && change === null && <Text color={MINT}>No open change. The rails are clear for new work.</Text>}

        {active === 'flow' && change !== null && (
          <Box flexDirection="column" gap={1}>
            <Box flexDirection="column">
              <Text bold wrap="wrap">
                {change.title}
              </Text>
              <Text dimColor>
                {isGame ? 'game ' : ''}
                {change.type}, size {change.size}
              </Text>
            </Box>

            <Box flexDirection="column">
              {routeOf(change).map(step => {
                const { name, hint } = stationOf(step.station, isGame)
                const isAhead = step.state === 'todo' || step.state === 'skipped'

                return (
                  <Box flexDirection="column">
                    <Box gap={1}>
                      {step.state === 'now' && (
                        <Text color={PINK} bold>
                          ◆
                        </Text>
                      )}
                      {step.state === 'done' && <Text color={MINT}>●</Text>}
                      {/* A station still ahead is amber when the change must pass it, lavender when it may be skipped */}
                      {isAhead && <Text color={step.isOptional ? LAV : AMBER}>○</Text>}
                      <Text
                        color={step.state === 'now' ? PINK : step.state === 'done' ? 'text' : step.isOptional ? LAV : 'text'}
                        dimColor={isAhead}
                        bold={step.state === 'now'}
                        strikethrough={step.state === 'skipped'}
                      >
                        {name}
                      </Text>
                      {step.state === 'now' && <Text dimColor>you are here</Text>}
                    </Box>
                    {step.state === 'now' && (
                      <Box paddingLeft={2}>
                        <Text color={LAV} wrap="wrap">
                          {hint}
                        </Text>
                      </Box>
                    )}
                  </Box>
                )
              })}
            </Box>

            <Box gap={1} flexWrap="wrap">
              <Text dimColor>Before it can close</Text>
              {['tests', 'verify', 'docs'].map(item =>
                change.open.includes(item) ? (
                  <Text dimColor>○ {item}</Text>
                ) : (
                  <Text backgroundColor={MINT} color={INK}>{` ${item} `}</Text>
                ),
              )}
            </Box>

            {change.isPaused ? (
              <Box flexDirection="column" borderStyle="round" borderColor={AMBER} paddingX={1}>
                <Text color={AMBER} bold>
                  Waits for you
                </Text>
                <Text wrap="wrap">{change.pauseReason === '' ? 'The station is paused.' : change.pauseReason}</Text>
                <Box gap={1}>
                  <Button key="approve" variant="primary" label="Approve and continue" onPress={() => answer($, 'approved, continue')} />
                  <Button key="discuss-pause" label="Discuss first" onPress={() => void $.prompt.fill({ text: 'Before you continue: ', mode: 'insert' })} />
                </Box>
              </Box>
            ) : (
              <Box gap={1}>
                <Button key="continue" variant="primary" label="Continue" onPress={() => answer($, 'continue with the next step')} />
                <Button key="where" label="Where are we" onPress={() => answer($, 'where are we, and what is next')} />
              </Box>
            )}

            {telemetry.repeats + telemetry.slow.length > 0 && (
              <Box gap={1} alignItems="center">
                <Text color={AMBER} wrap="wrap">
                  {telemetry.repeats} test runs were not needed, {telemetry.slow.length} tests are slow
                </Text>
                <Button key="to-tests" plain label="Open tests" onPress={() => update($, tab, () => 'tests')} />
              </Box>
            )}
          </Box>
        )}

        {active === 'ideas' && (
          <Box flexDirection="column" gap={1}>
            {ideas.length === 0 && (
              <Text dimColor wrap="wrap">
                Nothing is parked. Tell Claude to park an idea and it waits here until you start it.
              </Text>
            )}
            {ideas.map((idea, i) => {
              const { tag, title } = splitIdea(idea)
              const isFirstOfGroup = i === 0 || splitIdea(ideas[i - 1] ?? '').tag !== tag

              return (
                <Box flexDirection="column" rowGap={1}>
                  {isFirstOfGroup && (
                    <Box columnGap={1} alignItems="center">
                      <Text color={LAV} bold>
                        {tag === '' ? 'other' : tag}
                      </Text>
                      <Text color="subtle" wrap="truncate-end">
                        {'─'.repeat(Math.max(4, width - (tag === '' ? 5 : tag.length)))}
                      </Text>
                    </Box>
                  )}
                  <Box flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1} rowGap={1}>
                    <Text bold wrap="wrap">
                      {title}
                    </Text>
                    <Box columnGap={1}>
                      <Button key={`idea-${i}`} variant="primary" label="Start" onPress={() => answer($, `let us start the parked idea: ${title}`)} />
                      <Button key={`drop-${i}`} label="Remove" onPress={() => answer($, `remove the parked idea: ${title}`)} />
                    </Box>
                  </Box>
                </Box>
              )
            })}
          </Box>
        )}

        {active === 'tests' && (
          <Box flexDirection="column" gap={1}>
            <Box flexDirection="column">
              <Text bold color={telemetry.repeats === 0 ? MINT : AMBER} wrap="wrap">
                {telemetry.runs === 0
                  ? 'No test run is logged yet.'
                  : telemetry.repeats === 0
                    ? `All ${telemetry.runs} test runs were needed.`
                    : `${telemetry.repeats} of ${telemetry.runs} test runs were not needed. ${telemetry.wastedSeconds}s wasted.`}
              </Text>
              {telemetry.runs > 0 && (
                <Box>
                  {bar(width - wastedCells, MINT)}
                  {bar(wastedCells, AMBER)}
                </Box>
              )}
              {telemetry.runs > 0 && (
                <Text dimColor>
                  {needed} needed, {telemetry.repeats} repeated a green run with no edit between
                </Text>
              )}
            </Box>

            <Box flexDirection="column">
              <Text bold>{telemetry.slow.length === 0 ? 'No slow tests.' : 'Slow tests'}</Text>
              {telemetry.slow.length > 0 && <Text dimColor>The bar is the time one test takes.</Text>}
              {telemetry.slow.map(test => (
                <Box gap={1}>
                  {bar(Math.max(1, Math.round((test.ms / slowest) * 12)), AMBER)}
                  <Text color={AMBER}>{(test.ms / 1000).toFixed(1)}s</Text>
                  <Text wrap="truncate-end">{test.name}</Text>
                </Box>
              ))}
              {telemetry.slow.length > 0 && (
                <Box marginTop={1}>
                  <Button key="slow" variant="primary" label="Speed up the slow tests" onPress={() => answer($, 'show the slow tests and propose how to speed them up')} />
                </Box>
              )}
            </Box>

            <Box flexDirection="column" gap={1}>
              <Box gap={1} alignItems="center">
                <Button key="coach" variant={coaching ? 'primary' : 'secondary'} label={coaching ? 'On' : 'Off'} onPress={() => update($, isCoaching, now => !now)} />
                <Text bold>Tell agents when they repeat a run</Text>
              </Box>
              <Text dimColor wrap="wrap">
                {coaching ? 'An agent that repeats a green run is told to read the saved output instead.' : 'Repeats are only counted.'}
              </Text>
            </Box>

            {runs.length > 0 && (
              <Box flexDirection="column">
                <Text bold>This session</Text>
                {runs.slice(-6).map(one => {
                  const { what, how } = describeRun(one.command)

                  return (
                    <Box gap={1}>
                      <Text color={one.isRed ? PINK : one.isRepeat ? AMBER : MINT}>●</Text>
                      <Text>{one.seconds}s</Text>
                      <Text bold wrap="truncate-end">
                        {what}
                      </Text>
                      <Text dimColor wrap="truncate-end">
                        {one.isRepeat ? 'not needed' : one.isRed ? 'red' : how}
                      </Text>
                    </Box>
                  )
                })}
              </Box>
            )}
          </Box>
        )}

        {/* The legend names only the marks the open tab draws */}
        {active === 'flow' && change !== null && (
          <Text dimColor>
            <Text color={MINT}>●</Text> done  <Text color={PINK}>◆</Text> you are here  <Text color={AMBER}>○</Text> must do  <Text color={LAV}>○</Text> optional
          </Text>
        )}
        {active === 'tests' && runs.length > 0 && (
          <Text dimColor>
            <Text color={MINT}>●</Text> needed  <Text color={AMBER}>●</Text> not needed  <Text color={PINK}>●</Text> red
          </Text>
        )}
      </Box>
    )
  })
}

/** Open the deck where the person asked for it. */
async function openDeck($: EngineInterface): Promise<void> {
  await refresh($)
  await $.ui.open({ id: PANE, title: 'moku deck' })
}

/** Read the open change, the parked ideas and the test log from disk. */
async function refresh($: EngineInterface): Promise<void> {
  try {
    const live = (await $.fs.exists(LEDGER_FILE))
      ? parseFlow(
          await $.fs.read(LEDGER_FILE),
          (await $.fs.exists(RUNS_FILE)) ? await $.fs.read(RUNS_FILE) : '',
          (await $.fs.exists(MARKER_FILE)) ? await $.fs.read(MARKER_FILE) : '',
        )
      : SAMPLE_FLOW
    if (JSON.stringify(await read($, flow)) !== JSON.stringify(live)) await update($, flow, () => live)
  } catch {
    // A file caught mid-write is read again on the next tick
  }
}

/** A reload starts with the last answer already on the bar, not with an empty one. */
async function readLastReply($: EngineInterface): Promise<void> {
  try {
    const last = (await $.session.messages()).findLast(message => message.role === 'assistant' && message.text !== '')
    if (last !== undefined) await update($, reply, () => parseReply(last.text))
  } catch {
    // A new session has no answer yet
  }
}

/** Send a short answer as the person's own prompt, or leave it in the prompt box when that is refused. */
async function answer($: EngineInterface, text: string): Promise<void> {
  await update($, picked, () => [])
  await update($, isPicking, () => false)
  await update($, reply, () => null)

  try {
    await $.prompt.submit({ text, asUser: true })
  } catch {
    await $.prompt.fill({ text, mode: 'insert' })
  }
}

function toggle(list: number[], n: number): number[] {
  return list.includes(n) ? list.filter(one => one !== n) : [...list, n]
}

function countEdit($: EngineInterface): Promise<unknown> {
  return update($, tests, now => ({ ...now, edits: now.edits + 1 }))
}

function without(record: Record<string, number>, key: string): Record<string, number> {
  return Object.fromEntries(Object.entries(record).filter(([name]) => name !== key))
}
