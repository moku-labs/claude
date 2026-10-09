import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Tab, TestRun } from '../types'
import {
  SAMPLE_FLOW,
  describeCall,
  detectLanguage,
  digestKey,
  digestRequest,
  headline,
  parseDigests,
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
import { words } from './words'

const PANE = 'moku-deck'
const LEDGER_FILE = '.planning/state.json'
const RUNS_FILE = '.planning/tests/runs.jsonl'
const MARKER_FILE = '.planning/moku.md'
const REFRESH_MS = 5000
const KEPT_RUNS = 50
const DIGEST_STORE = 'digests'
const DIGEST_BATCH = 10
const KEPT_DIGESTS = 300

// One model call writes the cards at a time: a second press while it runs starts nothing
let isDigesting = false

// The answer on its way to the chat. A prompt waits until the session is idle, so a press can take a while to
// show: until it has, a second press sends nothing.
let pending: string | undefined
const TABS: Tab[] = ['flow', 'ideas', 'tests']

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
const lang = atom({ plugin: 'moku-deck', key: 'lang' } as const, 'en')
const digests = atom({ plugin: 'moku-deck', key: 'digests' } as const, {})
const expanded = atom({ plugin: 'moku-deck', key: 'expanded' } as const, [])
const sending = atom({ plugin: 'moku-deck', key: 'sending' } as const, null)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'moku-deck', description: 'Open the moku deck: the flow, parked ideas and test runs' })

    // A reload cannot know which calls of the old copy are still running
    await update($, calls, () => [])
    await update($, sending, () => null)
    await update($, lastCall, () => null)
    await refresh($)
    $.clock.every(REFRESH_MS, () => void refresh($))
    await loadDigests($)
    await readLastReply($)

    return next(e)
  })

  on('command.run', { command: 'moku-deck' }, async $ => {
    // Outside a moku session the command is the one way in: it turns the preview on, with sample data
    await update($, isPreview, () => true)
    await openDeck($)

    return { text: words(await read($, lang)).opened }
  })

  // A prompt the person sends answers the reply in their own words: its offers are stale from then on
  on('prompt.submit', async ($, e, next) => {
    await follow($, e.text)
    await update($, reply, () => null)
    await update($, picked, () => [])
    await update($, isPicking, () => false)

    return next(e)
  })

  // The reply bar: every finished answer of the main loop offers its named answers and its items
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && e.answer !== '') {
      await follow($, e.answer)
      await update($, reply, () => parseReply(e.answer))
      await update($, lastCall, () => null)
      await update($, picked, () => [])
      await update($, isPicking, () => false)
    }

    return next(e)
  })

  // The status shows the description Claude gives a shell command, so Claude is asked to write it in the
  // language of the conversation. English needs no asking.
  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    const ask = words(await read($, lang)).describeIn

    return ask === '' ? composed : { ...composed, sections: [...composed.sections, { id: 'moku-deck:language', text: ask, scope: 'session' as const }] }
  })

  // The status line: every tool call is on it for as long as it runs
  on('tool.call', async ($, e, next) => {
    const id = e.tool_use_id ?? ''
    const who = e.agentId === undefined ? 'Claude' : `Agent ${e.agentId.slice(0, 4)}`

    const call = { id, who, text: describeCall(e, await read($, lang)) }

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
      summary: summarizeTests(ran.text ?? '', await read($, lang)),
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
    const w = words(await read($, lang))

    return (
      <Box gap={1}>
        <Text color={found.isRed ? PINK : MINT} bold>
          {found.isRed ? w.testsRed : w.testsGreen}
        </Text>
        <Text>{w.took(found.summary, found.seconds)}</Text>
        {found.isRepeat && <Text color={AMBER}>{w.rowNotNeeded}</Text>}
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
    const w = words(await read($, lang))
    const hasAnswers = shown.quick.length > 0 || shown.items.length > 0
    const others = Math.max(0, new Set(running.map(one => one.who)).size - 1)

    // The status and the answers take turns. With no answers the status is the bar: the call that runs, or the
    // last one that ran. Once answers are offered only work still running is said, after them.
    const said = running.at(-1) ?? (hasAnswers ? undefined : ((await read($, lastCall)) ?? undefined))
    const isRunning = running.length > 0
    const onItsWay = await read($, sending)

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
              <Button key="picking" plain label={picking ? w.hideItems : w.pickFrom(shown.items.length)} onPress={() => update($, isPicking, now => !now)} />
            )}
          </Box>
          {/* The status starts right after what is before it and is cut at the edge: it never reaches an answer */}
          <Box flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
            {onItsWay !== null && (
              <Text color={MINT} bold wrap="truncate-end">
                {w.sendingNow(onItsWay)}
              </Text>
            )}
            {onItsWay === null && said !== undefined && (
              <Text color={LAV} dimColor={!isRunning} wrap="truncate-end">
                {w.status(w.who(said.who), said.text, isRunning)}
                {others > 0 ? w.more(others) : ''}
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
                  label={chosen.includes(item.n) ? w.picked : w.pick}
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
    const speech = await read($, lang)
    const w = words(speech)
    const cards = await read($, digests)
    const onItsWay = await read($, sending)
    const open = await read($, expanded)
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
              key={`tab-${one}`}
              label={one === 'ideas' && ideas.length > 0 ? `${w.tabs[one]} ${ideas.length}` : w.tabs[one]}
              variant={active === one ? 'primary' : 'secondary'}
              onPress={async () => {
                await update($, tab, () => one)
                if (one === 'ideas') void digestIdeas($)
              }}
            />
          ))}
        </Box>

        {onItsWay !== null && (
          <Text color={MINT} bold wrap="wrap">
            {w.sendingNow(onItsWay)}
          </Text>
        )}

        {isSample && (
          <Text color={AMBER} wrap="wrap">
            {w.sample}
          </Text>
        )}

        {active === 'flow' && change === null && <Text color={MINT}>{w.noChange}</Text>}

        {active === 'flow' && change !== null && (
          <Box flexDirection="column" gap={1}>
            <Box flexDirection="column">
              <Text bold wrap="wrap">
                {change.title}
              </Text>
              <Text dimColor>
                {w.kind(change.type, change.size, isGame)}
              </Text>
            </Box>

            <Box flexDirection="column">
              {routeOf(change).map(step => {
                const { name, hint } = stationOf(step.station, isGame, speech)
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
                      {step.state === 'now' && <Text dimColor>{w.here}</Text>}
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
              <Text dimColor>{w.beforeClose}</Text>
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
                  {w.waits}
                </Text>
                <Text wrap="wrap">{change.pauseReason === '' ? w.paused : change.pauseReason}</Text>
                <Box gap={1}>
                  <Button key="approve" variant="primary" label={w.approve} onPress={() => answer($, w.approveSay)} />
                  <Button key="discuss-pause" label={w.discuss} onPress={() => void $.prompt.fill({ text: w.discussFill, mode: 'insert' })} />
                </Box>
              </Box>
            ) : (
              <Box gap={1}>
                <Button key="continue" variant="primary" label={w.go} onPress={() => answer($, w.goSay)} />
                <Button key="where" label={w.where} onPress={() => answer($, w.whereSay)} />
              </Box>
            )}

            {telemetry.repeats + telemetry.slow.length > 0 && (
              <Box gap={1} alignItems="center">
                <Text color={AMBER} wrap="wrap">
                  {w.testsLine(telemetry.repeats, telemetry.slow.length)}
                </Text>
                <Button key="to-tests" plain label={w.openTests} onPress={() => update($, tab, () => 'tests')} />
              </Box>
            )}
          </Box>
        )}

        {active === 'ideas' && (
          <Box flexDirection="column" gap={1}>
            {ideas.length === 0 && (
              <Text dimColor wrap="wrap">
                {w.ideasEmpty}
              </Text>
            )}
            {ideas.some(idea => cards[digestKey(idea, speech)] === undefined) && isDigesting && <Text color={LAV}>{w.digesting}</Text>}
            {ideas.map((idea, i) => {
              const { tag, title } = splitIdea(idea)
              const isFirstOfGroup = i === 0 || splitIdea(ideas[i - 1] ?? '').tag !== tag
              const card = cards[digestKey(idea, speech)]
              const isOpen = open.includes(idea)

              return (
                <Box flexDirection="column" rowGap={1}>
                  {isFirstOfGroup && (
                    <Box columnGap={1} alignItems="center">
                      <Text color={LAV} bold>
                        {tag === '' ? w.other : tag}
                      </Text>
                      <Text color="subtle" wrap="truncate-end">
                        {'─'.repeat(Math.max(4, width - (tag === '' ? 5 : tag.length)))}
                      </Text>
                    </Box>
                  )}
                  <Box flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1} rowGap={1}>
                    {/* The card says the idea in a few words. The note as it was written is one press away. */}
                    <Box flexDirection="column">
                      <Text bold wrap="wrap">
                        {card?.title ?? headline(idea)}
                      </Text>
                      {card?.points.map(point => (
                        <Box columnGap={1}>
                          <Text color={LAV}>•</Text>
                          <Text wrap="wrap">{point}</Text>
                        </Box>
                      ))}
                    </Box>
                    {isOpen && (
                      <Text dimColor wrap="wrap">
                        {title}
                      </Text>
                    )}
                    <Box columnGap={1}>
                      <Button key={`idea-${i}`} variant="primary" label={w.start} onPress={() => answer($, w.startSay(title))} />
                      <Button key={`drop-${i}`} label={w.remove} onPress={() => answer($, w.removeSay(title))} />
                      <Button key={`more-${i}`} plain label={isOpen ? w.less : w.details} onPress={() => update($, expanded, now => (now.includes(idea) ? now.filter(one => one !== idea) : [...now, idea]))} />
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
                  ? w.noRuns
                  : telemetry.repeats === 0
                    ? w.allNeeded(telemetry.runs)
                    : w.wasted(telemetry.repeats, telemetry.runs, telemetry.wastedSeconds)}
              </Text>
              {telemetry.runs > 0 && (
                <Box>
                  {bar(width - wastedCells, MINT)}
                  {bar(wastedCells, AMBER)}
                </Box>
              )}
              {telemetry.runs > 0 && (
                <Text dimColor>
                  {w.split(needed, telemetry.repeats)}
                </Text>
              )}
            </Box>

            <Box flexDirection="column">
              <Text bold>{telemetry.slow.length === 0 ? w.noSlow : w.slow}</Text>
              {telemetry.slow.length > 0 && <Text dimColor>{w.barHint}</Text>}
              {telemetry.slow.map(test => (
                <Box gap={1}>
                  {bar(Math.max(1, Math.round((test.ms / slowest) * 12)), AMBER)}
                  <Text color={AMBER}>{(test.ms / 1000).toFixed(1)}s</Text>
                  <Text wrap="truncate-end">{test.name}</Text>
                </Box>
              ))}
              {telemetry.slow.length > 0 && (
                <Box marginTop={1}>
                  <Button key="slow" variant="primary" label={w.speedUp} onPress={() => answer($, w.speedUpSay)} />
                </Box>
              )}
            </Box>

            <Box flexDirection="column" gap={1}>
              <Box gap={1} alignItems="center">
                <Button key="coach" variant={coaching ? 'primary' : 'secondary'} label={coaching ? w.on : w.off} onPress={() => update($, isCoaching, now => !now)} />
                <Text bold>{w.coach}</Text>
              </Box>
              <Text dimColor wrap="wrap">
                {coaching ? w.coachOn : w.coachOff}
              </Text>
            </Box>

            {runs.length > 0 && (
              <Box flexDirection="column">
                <Text bold>{w.session}</Text>
                {runs.slice(-6).map(one => {
                  const { what, how } = describeRun(one.command, speech)

                  return (
                    <Box gap={1}>
                      <Text color={one.isRed ? PINK : one.isRepeat ? AMBER : MINT}>●</Text>
                      <Text>{one.seconds}s</Text>
                      <Text bold wrap="truncate-end">
                        {what}
                      </Text>
                      <Text dimColor wrap="truncate-end">
                        {one.isRepeat ? w.notNeeded : one.isRed ? w.red : how}
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
            <Text color={MINT}>●</Text> {w.done}  <Text color={PINK}>◆</Text> {w.here}  <Text color={AMBER}>○</Text> {w.mustDo}  <Text color={LAV}>○</Text> {w.optional}
          </Text>
        )}
        {active === 'tests' && runs.length > 0 && (
          <Text dimColor>
            <Text color={MINT}>●</Text> {w.needed}  <Text color={AMBER}>●</Text> {w.notNeeded}  <Text color={PINK}>●</Text> {w.red}
          </Text>
        )}
      </Box>
    )
  })
}

/** The cards written in earlier sessions: an idea is digested once per language, not once per session. */
async function loadDigests($: EngineInterface): Promise<void> {
  try {
    const kept = await $.store.get(DIGEST_STORE)
    if (typeof kept === 'object' && kept !== null) await update($, digests, () => kept as Record<string, { title: string; points: string[] }>)
  } catch {
    // No store, no cards kept: they are written again
  }
}

/** Ask a small model for a short card of every idea that has none in the language of the conversation. */
async function digestIdeas($: EngineInterface): Promise<void> {
  if (isDigesting) return

  const speech = await read($, lang)
  const known = await read($, digests)
  const missing = (await read($, flow)).ideas.filter(idea => known[digestKey(idea, speech)] === undefined).slice(0, DIGEST_BATCH)
  if (missing.length === 0) return

  isDigesting = true
  let hasWritten = false

  try {
    const asked = await $.model.complete({ model: 'haiku', ...digestRequest(missing, speech) })
    const written = asked.isAnswered ? parseDigests(asked.text, missing.length) : []

    if (written.length > 0) {
      const added = Object.fromEntries(missing.map((idea, i) => [digestKey(idea, speech), written[i] ?? { title: headline(idea), points: [] }]))
      const all = Object.fromEntries(Object.entries({ ...known, ...added }).slice(-KEPT_DIGESTS))

      await update($, digests, () => all)
      await $.store.set(DIGEST_STORE, all)
      hasWritten = true
    }
  } catch {
    // A card that was not written leaves the idea with its opening words
  } finally {
    isDigesting = false
  }

  // The backlog can be longer than one request. It goes on only after a request that wrote cards:
  // a model that does not answer is not asked again in a loop.
  if (hasWritten && (await read($, tab)) === 'ideas') void digestIdeas($)
}

/** The deck speaks the language of the conversation: a text long enough to tell sets it, a short one keeps it. */
async function follow($: EngineInterface, text: string): Promise<void> {
  const spoken = detectLanguage(text)

  if (spoken !== undefined && spoken !== (await read($, lang))) await update($, lang, () => spoken)
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
    if (last === undefined) return

    await follow($, last.text)
    await update($, reply, () => parseReply(last.text))
  } catch {
    // A new session has no answer yet
  }
}

/** Send a short answer as the person's own prompt, or leave it in the prompt box when that is refused. */
async function answer($: EngineInterface, text: string): Promise<void> {
  if (pending !== undefined) return

  pending = text

  try {
    // Said first, so the press is seen at once
    await update($, sending, () => text)
    await update($, picked, () => [])
    await update($, isPicking, () => false)
    await update($, reply, () => null)

    try {
      await $.prompt.submit({ text, asUser: true })
    } catch {
      await $.prompt.fill({ text, mode: 'insert' })
    }
  } finally {
    pending = undefined
    await update($, sending, () => null)
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
