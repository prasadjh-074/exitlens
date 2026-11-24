import { beforeEach, expect, it, vi } from 'vitest'
import { candidate, extractTerms } from '../extension/src/detectors'
import {
  DEMO,
  FIXTURE,
  type Action,
  type Candidate,
  type Click,
  type Database,
  type Snapshot,
} from '../extension/src/types'
import { ratio } from '../extension/src/verification'

type Handler = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  reply: (value: Result) => void,
) => boolean
type Result = { ok: boolean; value: unknown; error?: string }
const ui = { id: 'test', url: 'chrome-extension://test/dashboard.html' }
const page = {
  id: 'test',
  frameId: 0,
  url: DEMO + '/',
  tab: { id: 7 },
} as chrome.runtime.MessageSender
const event = () => ({ addListener: vi.fn() })
function store() {
  const data: Record<string, unknown> = {}
  return {
    get: async (k: string | null) =>
      structuredClone(k === null ? data : { [k]: data[k] }),
    set: async (obj: object) => Object.assign(data, structuredClone(obj)),
    remove: async (k: string) => {
      delete data[k]
    },
    clear: async () => {
      for (const k in data) delete data[k]
    },
    setAccessLevel: vi.fn(),
  }
}
const local = store(),
  session = store(),
  grants = new Set<string>(),
  jar = new Set<string>()
let handler: Handler, webRequest: ((d: object) => void) | undefined
let registered: object[] = []
const mock = {
  runtime: {
    id: 'test',
    getURL: (s: string) => 'chrome-extension://test/' + s,
    onMessage: {
      addListener: (x: Handler) => {
        handler = x
      },
    },
    onStartup: event(),
    onInstalled: event(),
  },
  storage: { local, session },
  sidePanel: { setPanelBehavior: vi.fn() },
  permissions: {
    contains: async ({ origins }: { origins: string[] }) =>
      origins.every((o) => grants.has(o)),
    remove: async ({ origins }: { origins: string[] }) =>
      origins.forEach((o) => grants.delete(o)),
    onRemoved: event(),
  },
  cookies: {
    getAll: async ({ name }: { name: string }) =>
      jar.has(name) ? [{ name, value: 'never persisted' }] : [],
  },
  scripting: {
    getRegisteredContentScripts: async () => registered,
    registerContentScripts: async (x: object[]) => {
      registered = x
    },
    updateContentScripts: async (x: object[]) => {
      registered = x
    },
    unregisterContentScripts: async () => {
      registered = []
    },
    insertCSS: vi.fn(),
    executeScript: vi.fn(),
  },
  tabs: {
    query: async () => [{ id: 7, url: page.url, active: true, windowId: 1 }],
    update: vi.fn(),
    sendMessage: async () => {},
    onRemoved: event(),
    onUpdated: event(),
  },
  windows: { update: vi.fn() },
  webRequest: {
    onBeforeRequest: {
      addListener: (x: (d: object) => void) => {
        webRequest = x
      },
      removeListener: () => {
        webRequest = undefined
      },
    },
  },
}
async function start() {
  vi.resetModules()
  vi.stubGlobal('chrome', mock)
  await import('../extension/src/background')
}
async function message(
  type: string,
  data: object = {},
  sender: chrome.runtime.MessageSender = ui,
) {
  const res = await new Promise<Result>((done) =>
    handler({ type, ...data }, sender, done),
  )
  if (!res.ok) throw Error(res.error)
  return res.value
}
const get = async () => (await message('GET')) as Database
async function allow() {
  grants.add('http://127.0.0.1/*')
  grants.add('http://localhost/*')
  await message('ALLOW', { origin: DEMO, auditDemo: true })
  await message('HELLO', {}, page)
}
const choice = (label: string, href?: string) =>
  candidate(label, href ? 'link' : 'button', href ? DEMO + href : null)!
async function snap(
  path: string,
  links: Candidate[] = [],
  signals: string[] = [],
  barriers: string[] = [],
) {
  page.url = DEMO + path
  const snap: Snapshot = {
    page: page.url,
    candidates: links,
    signals,
    barriers,
    simulated: true,
  }
  return (await message('SNAP', { snap }, page)) as {
    guide: boolean
    blocked: boolean
    label: string
  }
}
async function click(
  action: Action | null,
  c: Candidate | null = null,
  entry = false,
) {
  const click: Click = {
    page: page.url!,
    terms: extractTerms(
      action === 'Start free trial'
        ? '7-day free trial. ₹0 today. ₹799 per month.'
        : '',
    ),
    label: action ?? c?.label ?? '',
    action,
    choice: c,
    simulated: true,
    entry,
  }
  await message('CLICK', { click }, page)
}
beforeEach(async () => {
  await local.clear()
  await session.clear()
  page.url = DEMO + '/'
  grants.clear()
  jar.clear()
  registered = []
  webRequest = undefined
  await start()
})
it('rejects page input before opt-in, other ports and frames', async () => {
  expect(webRequest).toBeUndefined()
  const data = { click: { action: 'Subscribe' } }
  expect(await message('CLICK', data, page)).toEqual({ allowed: false })
  await expect(message('ALLOW', { origin: DEMO })).rejects.toThrow()
  await allow()
  expect(
    await message('HELLO', {}, { ...page, url: 'http://127.0.0.1:8080/' }),
  ).toEqual({ allowed: false })
  expect(await message('HELLO', {}, { ...page, frameId: 2 })).toEqual({
    allowed: false,
  })
  expect((await get()).records).toEqual([])
})
it('correlates trial, guided controls, human checkpoint and receipt across worker restarts', async () => {
  await allow()
  await snap('/')
  await click(null, null, true)
  await snap('/trial')
  await click('Start free trial')
  const account = choice('Account settings', '/account'),
    manage = choice('Manage subscription', '/subscription'),
    cancel = choice('Cancel plan', '/retention'),
    cont = choice('Continue cancellation', '/verify'),
    human = choice('Complete human verification'),
    review = choice('Continue to confirmation', '/confirm'),
    final = choice('Confirm cancellation')
  await snap('/welcome', [account], ['Your free trial is active.'])
  let r = (await get()).records[0]
  expect(r.status).toBe('Active')
  expect(r.terms.recurring).toBe('₹799')
  expect(r.entry).toHaveLength(2)
  await message('GUIDE', { id: r.id })
  expect((await snap('/welcome', [account])).label).toBe(account.label)
  await click(null, account)
  await snap('/account', [manage])
  await click(null, manage)
  await snap('/subscription', [cancel])
  await click('Cancel subscription', cancel)
  await snap('/retention', [cont])
  await click(null, cont)
  const check = await snap(
    '/verify',
    [human],
    [],
    [
      'Human verification required. An official accessible alternative is visible.',
    ],
  )
  expect(check.blocked).toBe(true)
  await start()
  await click(null, human)
  await snap('/verify', [review])
  await click(null, review)
  await snap('/confirm', [final])
  await click('Cancel subscription', final)
  expect((await get()).records[0].verification).toBe('Pending verification')
  await snap(
    '/cancelled',
    [],
    ['Your subscription is cancelled.', 'Auto-renewal is off.'],
  )
  r = (await get()).records[0]
  expect(r.verification).toBe('Verified by observable evidence')
  expect(r.edges.some((e) => e.proof === 'Observed')).toBe(true)
  expect(r.barriers.length).toBeGreaterThan(0)
  expect(r.entry).toHaveLength(2)
  expect(r.reversal).toHaveLength(7)
  expect(ratio(r)).toBe(3.5)
  await session.clear()
  await start()
  expect((await get()).records[0]).toEqual(r)
})
it('reports bounded cookie changes and the permitted simulated request after rejection', async () => {
  await allow()
  await snap('/')
  await click('Reject cookies')
  jar.add('cookie_consent')
  await message('AUDIT', {}, page)
  expect(webRequest).toBeTypeOf('function')
  webRequest?.({
    tabId: 7,
    type: 'image',
    initiator: DEMO,
    url: FIXTURE + '/signals/ad.gif',
    timeStamp: Date.now() + 1000,
  })
  const r = (await get()).records[0]
  expect(r.cookies).toEqual({ before: [], after: ['cookie_consent'] })
  expect(r.inconsistent).toBe(true)
  expect(r.domains[0]).toMatchObject({ host: 'localhost', simulated: true })
  expect(JSON.stringify(r)).not.toContain('never persisted')
})
it('keeps manual resolution independent, supports revocation and erasure', async () => {
  await allow()
  await click('Start free trial')
  const id = (await get()).records[0].id
  await message('RESOLVE', { id })
  expect((await get()).records[0].verification).toBe('User marked as resolved')
  await message('REVOKE', { origin: DEMO })
  expect(await message('HELLO', {}, page)).toEqual({ allowed: false })
  expect((await get()).records).toHaveLength(1)
  await message('CLEAR')
  expect((await get()).records).toHaveLength(0)
})
it('ignores pre-existing status wording on the reversal control screen', async () => {
  await allow()
  const existing = ['Your subscription is cancelled.']
  await snap('/account', [], existing)
  await click('Cancel subscription')
  await snap('/account', [], existing)
  expect((await get()).records[0].verification).toBe('Pending verification')
})

it('keeps a retention-link click separate from a final cancellation attempt', async () => {
  await allow()
  await snap('/trial')
  await click('Start free trial')
  await snap('/welcome', [], ['Your free trial is active.'])
  const cancel = choice('Cancel plan', '/retention')
  await snap('/subscription', [cancel])
  await click('Cancel subscription', cancel)
  await snap('/retention', [], ['Your subscription is cancelled.'])
  expect((await get()).records[0].verification).toBe('Pending verification')
})
