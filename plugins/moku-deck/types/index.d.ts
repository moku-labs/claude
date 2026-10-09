export type ReplyItem = { n: number; title: string }

export type Reply = { items: ReplyItem[]; quick: string[] }

export type TestRun = {
  id: string
  command: string
  who: string
  seconds: number
  summary: string
  isRed: boolean
  isRepeat: boolean
}

export type TestRuns = { runs: TestRun[]; edits: number; greenAt: Record<string, number> }

export type Change = {
  id: string
  title: string
  type: string
  size: string
  station: string | null
  done: string[]
  skipped: string[]
  open: string[]
  isPaused: boolean
  pauseReason: string
}

export type SlowTest = { name: string; ms: number }

export type Telemetry = { runs: number; repeats: number; wastedSeconds: number; slow: SlowTest[] }

export type Flow = { change: Change | null; ideas: string[]; telemetry: Telemetry; isSample: boolean; isGame: boolean }

export type Call = { id: string; who: string; text: string }

export type Lang = 'en' | 'ru'

export type Digest = { title: string; points: string[] }

export type Tab = 'flow' | 'ideas' | 'tests'

declare module 'claude-code' {
  interface PluginState {
    'moku-deck': {
      tab: Tab
      flow: Flow
      reply: Reply | null
      picked: number[]
      isPicking: boolean
      isPreview: boolean
      tests: TestRuns
      isCoaching: boolean
      calls: Call[]
      lastCall: Call | null
      lang: Lang
      digests: Record<string, Digest>
      expanded: string[]
      sending: string | null
    }
  }
}
