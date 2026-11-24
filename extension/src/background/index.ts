import { categoryOf } from '../detectors'
import { getDomain } from 'tldts'
import { classifyRequest } from '../detectors/trackers'
import { discover, mergeEdges, nextStep } from '../graph'
import { addEvidence, newRecord, resolveManually, serialise } from '../storage'
import { verify } from '../verification'
import {
  DEMO,
  FIXTURE,
  EMPTY,
  sitePattern,
  type Click,
  type Database,
  type RecordItem,
  type Snapshot,
  type TabMemory,
} from '../types'

const queue = serialise()
const read = async (): Promise<Database> =>
  (await chrome.storage.local.get<{ memory?: Database }>('memory')).memory ??
  structuredClone(EMPTY)
const save = (db: Database) => chrome.storage.local.set({ memory: db })
const tabKey = (id: number) => 'tab-' + id
async function tabState(id: number, origin: string): Promise<TabMemory> {
  const val = (
    await chrome.storage.session.get<Record<string, TabMemory>>(tabKey(id))
  )[tabKey(id)]
  return val?.origin === origin ? val : { origin }
}
const writeTab = (id: number, t: TabMemory) =>
  chrome.storage.session.set({ [tabKey(id)]: t })
const bound = (db: Database, id?: string) => db.records.find((r) => r.id === id)
async function cookieNames(origin: string): Promise<string[] | null> {
  // Query exact consent/analytics names only. Never enumerate a site's cookie jar.
  try {
    const groups = await Promise.all(
      [
        'cookie_consent',
        'ad_consent',
        'tracking_consent',
        'OptanonConsent',
        '_ga',
        '_gid',
        '_fbp',
      ].map((name) => chrome.cookies.getAll({ url: origin, name })),
    )
    return [...new Set(groups.flat().map((c) => c.name))].sort()
  } catch {
    return null
  }
}
const permitted = (origin: string) =>
  chrome.permissions.contains({ origins: [sitePattern(origin)] })
async function configure(db: Database) {
  configureRequestObserver(db.sites.length > 0)
  const existing = await chrome.scripting.getRegisteredContentScripts()
  const patterns = [...new Set(db.sites.map((s) => sitePattern(s.origin)))]
  if (!patterns.length) {
    if (existing.length) await chrome.scripting.unregisterContentScripts()
    return
  }
  const config = {
    id: 'observer',
    matches: patterns,
    js: ['observe.js'],
    css: ['guide.css'],
    runAt: 'document_idle' as const,
  }
  if (existing.some((s) => s.id === config.id))
    await chrome.scripting.updateContentScripts([config])
  else await chrome.scripting.registerContentScripts([config])
}
async function attach(id: number) {
  await chrome.scripting.insertCSS({
    target: { tabId: id },
    files: ['guide.css'],
  })
  await chrome.scripting.executeScript({
    target: { tabId: id },
    files: ['observe.js'],
  })
}
async function syncPermissions() {
  const db = await read()
  const checks = await Promise.all(
    db.sites.map(async (s) =>
      (await permitted(s.origin))
        ? { ...s, auditDemo: s.auditDemo && (await permitted(FIXTURE)) }
        : null,
    ),
  )
  db.sites = checks.flatMap((s) => (s ? [s] : []))
  await save(db)
  await configure(db)
}
async function setup() {
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  await syncPermissions()
}
chrome.runtime.onInstalled.addListener(() => {
  void queue(setup)
})
chrome.runtime.onStartup.addListener(() => {
  void queue(setup)
})
chrome.permissions.onRemoved.addListener(() => {
  void queue(syncPermissions)
})
chrome.tabs.onRemoved.addListener((id) => {
  void queue(() => chrome.storage.session.remove(tabKey(id)))
})
chrome.tabs.onUpdated.addListener((id, change) => {
  if (change.url)
    void queue(async () => {
      const t = (
        await chrome.storage.session.get<Record<string, TabMemory>>(tabKey(id))
      )[tabKey(id)] as TabMemory | undefined
      if (t && new URL(change.url!).origin !== t.origin)
        await chrome.storage.session.remove(tabKey(id))
    })
})
function absorb(r: RecordItem, s: Snapshot) {
  if (r.category === 'subscription' && s.terms && s.terms.source.length) {
    const terms = s.terms
    for (const key of [
      'initial',
      'recurring',
      'frequency',
      'renewal',
      'deadline',
      'autoRenew',
      'cancellation',
      'refund',
    ] as const) {
      if (!r.terms[key] && terms[key]) r.terms[key] = terms[key]
    }
    if (!r.terms.trialDays) r.terms.trialDays = terms.trialDays
    for (const quote of terms.source)
      if (!r.terms.source.includes(quote)) {
        r.terms.source.push(quote)
        addEvidence(r.evidence, 'Observed “' + quote + '” on ' + s.page)
      }
  }
  const edges = discover(s, r.category)
  r.edges = mergeEdges(r.edges, edges)
  r.current = s.page
  r.barriers = [...new Set([...r.barriers, ...s.barriers])]
  const target = s.candidates
    .filter((c) => c.category === r.category && c.url)
    .sort((a, b) => b.rank - a.rank)[0]
  if (target?.url) r.undoUrl = target.url
}
function updateSnap(db: Database, t: TabMemory, s: Snapshot) {
  const r = bound(db, t.guide ?? t.record),
    now = Date.now()
  const prior = t.last
  if (r) {
    if (
      t.guide &&
      t.pending &&
      (t.pending.page !== s.page ||
        s.signals.join() !== prior?.signals.join() ||
        (prior?.barriers.length && !s.barriers.length))
    ) {
      const p = t.pending,
        base = discover(
          {
            page: p.page,
            candidates: [p.choice],
            signals: [],
            simulated: r.simulated,
            barriers: prior?.barriers ?? [],
          },
          r.category,
        )[0]
      if (base && p.page !== s.page)
        r.edges = mergeEdges(r.edges, [
          {
            ...base,
            to: s.page,
            proof: 'Observed',
            confidence: 1,
            evidence:
              'Trusted control activation followed by observed destination.',
          },
        ])
      if (p.choice.url && p.choice.url !== s.page) r.continuous = false
      delete t.pending
    } else if (t.guide && prior && prior.page !== s.page && !t.pending) {
      r.continuous = false
    }
    absorb(r, s)
    if (
      r.status === 'Suspected' &&
      r.category === 'subscription' &&
      r.action !== 'Cancel subscription' &&
      now - r.at < 120000 &&
      s.signals.some((x) =>
        /trial is active|status\s*[:·]\s*active/i.test(x),
      ) &&
      !prior?.signals.some((x) =>
        /trial is active|status\s*[:·]\s*active/i.test(x),
      )
    ) {
      r.status = 'Active'
      r.confidence = 'Confirmed by page'
      r.completeEntry =
        r.entry.length === 2 && !r.page.endsWith('[private path]')
      addEvidence(
        r.evidence,
        s.signals.find((x) =>
          /trial is active|status\s*[:·]\s*active/i.test(x),
        )!,
      )
    }
    const fresh = s.signals.filter((x) => !prior?.signals.includes(x))
    const outcome = verify(
      r.category,
      fresh,
      t.intent?.id === r.id && now - t.intent.at < 300000,
    )
    if (
      outcome !== 'Pending verification' &&
      r.verification !== 'User marked as resolved'
    ) {
      r.verification = outcome
      r.verifiedAt = now
      fresh.forEach((x) => addEvidence(r.evidence, x))
      if (outcome === 'Verified by observable evidence') {
        r.status = 'Reversed'
        delete t.intent
        delete t.guide
        delete t.record
      }
    }
  }
  t.last = s
  const guide = bound(db, t.guide)
  const step = guide ? nextStep(guide.edges, s.page) : null
  return {
    guide: !!guide,
    label: step?.label ?? null,
    destination: step?.to ?? null,
    blocked: s.barriers.some((x) => x.startsWith('Human verification')),
    done: r?.status === 'Reversed',
  }
}
function onClick(db: Database, t: TabMemory, c: Click, now: number) {
  if (c.entry)
    t.entry = { at: now, text: 'Opened trial offer from a visible link.' }
  let current = bound(db, t.guide ?? t.record)
  if (
    c.choice &&
    t.guide &&
    current &&
    c.choice.category === current.category
  ) {
    current.reversal.push({ at: now, text: c.choice.label })
    t.pending = { page: c.page, choice: c.choice }
    if (c.page.endsWith('[private path]')) current.continuous = false
  } else if (t.guide && current && !c.action) {
    current.continuous = false
  }
  if (!c.action) return
  const category = categoryOf(c.action)
  const reversing =
    c.action === 'Cancel subscription' ||
    c.action === 'Withdraw consent' ||
    (c.action === 'Reject cookies' && current?.action === 'Accept cookies')
  if (
    reversing &&
    current?.category === category &&
    !['Reversed', 'Resolved'].includes(current.status)
  ) {
    if (
      category === 'consent' ||
      (c.action === 'Cancel subscription' && c.choice?.kind !== 'link')
    )
      t.intent = { id: current.id, at: now, category }
    addEvidence(current.evidence, 'Observed reversal control: ' + c.action, now)
    if (!t.guide) current.continuous = false
  } else {
    const entry =
      t.entry && now - t.entry.at < 300000 && c.action === 'Start free trial'
        ? t.entry
        : undefined
    current = newRecord(c, t.origin, now, crypto.randomUUID(), entry)
    db.records.unshift(current)
    if (t.last) absorb(current, t.last)
    t.record = current.id
    delete t.intent
    delete t.guide
    delete t.pending
    if (reversing && (category === 'consent' || c.choice?.kind !== 'link'))
      t.intent = { id: current.id, at: now, category }
  }
  if (category === 'subscription') delete t.entry
  if (category === 'consent') {
    let decision = current
    if (
      reversing &&
      t.intent?.id === current.id &&
      current.action !== c.action
    ) {
      decision = newRecord(c, t.origin, now, crypto.randomUUID())
      if (t.last) absorb(decision, t.last)
      db.records.unshift(decision)
    }
    t.consent = decision.id
    t.consentAt = now
    decision.cookies = { before: t.baseline ?? null, after: null }
  }
}
async function handleContent(
  msg: { type: string; click: Click; snap: Snapshot },
  sender: chrome.runtime.MessageSender,
) {
  const tabId = sender.tab?.id
  if (tabId === undefined || sender.frameId !== 0 || !sender.url)
    return { allowed: false }
  const origin = new URL(sender.url).origin,
    db = await read()
  if (!db.sites.some((s) => s.origin === origin) || !(await permitted(origin)))
    return { allowed: false }
  configureRequestObserver(true)
  const t = await tabState(tabId, origin)
  if (msg.type === 'HELLO') {
    t.baseline = (await cookieNames(origin)) ?? undefined
    await writeTab(tabId, t)
    return { allowed: true, guide: !!t.guide }
  }
  if (msg.type === 'CLICK') onClick(db, t, msg.click, Date.now())
  else if (msg.type === 'SNAP') {
    const before = JSON.stringify(db.records)
    const answer = updateSnap(db, t, msg.snap)
    if (before !== JSON.stringify(db.records)) await save(db)
    await writeTab(tabId, t)
    return { allowed: true, ...answer }
  } else if (msg.type === 'AUDIT') {
    const r = bound(db, t.consent)
    if (r && t.consentAt && Date.now() - t.consentAt < 30000) {
      r.cookies.after = await cookieNames(origin)
      t.baseline = r.cookies.after ?? undefined
    }
  } else return { allowed: false }
  await save(db)
  await writeTab(tabId, t)
  return { allowed: true }
}
async function handleUI(msg: {
  type: string
  origin: string
  id: string
  auditDemo: boolean
}) {
  const db = await read()
  if (msg.type === 'GET') return db
  if (msg.type === 'CLEAR') {
    db.records = []
    await chrome.storage.session.clear()
    await save(db)
    return true
  }
  if (msg.type === 'ALLOW') {
    const origin = new URL(msg.origin).origin
    if (!/^https?:\/\//.test(origin) || !(await permitted(origin)))
      throw Error('Site permission was not granted.')
    const auditDemo =
      origin === DEMO && !!msg.auditDemo && (await permitted(FIXTURE))
    db.sites = db.sites
      .filter((s) => s.origin !== origin)
      .concat({ origin, auditDemo })
    await save(db)
    await configure(db)
    const tabs = await chrome.tabs.query({ url: sitePattern(origin) })
    await Promise.allSettled(
      tabs
        .filter((t) => t.id && t.url && new URL(t.url).origin === origin)
        .map((t) => attach(t.id!)),
    )
    return true
  }
  if (msg.type === 'REVOKE') {
    db.sites = db.sites.filter((s) => s.origin !== msg.origin)
    await save(db)
    await configure(db)
    const pattern = sitePattern(msg.origin)
    const patterns = [
      pattern,
      ...(msg.origin === DEMO ? [sitePattern(FIXTURE)] : []),
    ]
    for (const p of patterns)
      if (
        !db.sites.some(
          (s) =>
            sitePattern(s.origin) === p ||
            (s.auditDemo && p === sitePattern(FIXTURE)),
        )
      )
        await chrome.permissions.remove({ origins: [p] })
    const sessions =
      await chrome.storage.session.get<Record<string, TabMemory>>(null)
    for (const [key, t] of Object.entries(sessions))
      if (t.origin === msg.origin) {
        await chrome.storage.session.remove(key)
        const id = Number(key.slice(4))
        await chrome.tabs.sendMessage(id, { type: 'STOP' }).catch(() => {})
      }
    return true
  }
  const r = bound(db, msg.id)
  if (!r) throw Error('This commitment is no longer in memory.')
  if (msg.type === 'RESOLVE') {
    resolveManually(r)
    await save(db)
    return true
  }
  if (msg.type === 'STOP_GUIDE') {
    const states =
      await chrome.storage.session.get<Record<string, TabMemory>>(null)
    for (const [key, t] of Object.entries(states))
      if (t.guide === r.id) {
        delete t.guide
        delete t.intent
        delete t.pending
        await chrome.storage.session.set({ [key]: t })
        await chrome.tabs
          .sendMessage(Number(key.slice(4)), { type: 'REFRESH' })
          .catch(() => {})
      }
    if (r.verification === 'Pending verification')
      r.verification = 'Unable to verify'
    r.verifiedAt = Date.now()
    r.continuous = false
    await save(db)
    return true
  }
  if (msg.type === 'GUIDE') {
    if (
      !db.sites.some((s) => s.origin === r.origin) ||
      !(await permitted(r.origin))
    )
      throw Error('Enable this site in Site access before starting a guide.')
    if (['Reversed', 'Resolved'].includes(r.status))
      throw Error('This journey is already closed.')
    const tabs = (
      await chrome.tabs.query({ url: sitePattern(r.origin) })
    ).filter((t) => t.id && t.url && new URL(t.url).origin === r.origin)
    const sessions =
      await chrome.storage.session.get<Record<string, TabMemory>>(null)
    const tab =
      tabs.find((t) => sessions[tabKey(t.id!)]?.record === r.id) ??
      tabs.find((t) => t.active) ??
      tabs[0]
    if (!tab?.id)
      throw Error(
        'Open the original website in a tab, then start the guide again.',
      )
    const t = await tabState(tab.id, r.origin)
    if (
      (t.guide && t.guide !== r.id) ||
      (t.record &&
        t.record !== r.id &&
        bound(db, t.record)?.category === r.category)
    )
      throw Error(
        'This tab belongs to another commitment. Open the relevant account in a separate tab.',
      )
    if (t.guide !== r.id) {
      r.continuous =
        t.record === r.id &&
        !r.reversal.length &&
        !!t.last &&
        !t.last.page.endsWith('[private path]')
    }
    t.guide = r.id
    t.record = r.id
    if (t.last) absorb(r, t.last)
    if (r.verification === 'Unable to verify')
      r.verification = 'Pending verification'
    await save(db)
    await writeTab(tab.id, t)
    await attach(tab.id)
    await chrome.tabs.update(tab.id, { active: true })
    await chrome.windows.update(tab.windowId, { focused: true })
    // Never wait on a content listener that can call back into this serial worker.
    void chrome.tabs.sendMessage(tab.id, { type: 'REFRESH' }).catch(() => {})
    return true
  }
  throw Error('Unknown operation.')
}
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  const extensionUI =
    sender.id === chrome.runtime.id &&
    sender.url?.startsWith(chrome.runtime.getURL(''))
  queue<unknown>(() =>
    extensionUI ? handleUI(msg) : handleContent(msg, sender),
  ).then(
    (value) => respond({ ok: true, value }),
    (e) =>
      respond({
        ok: false,
        error: e instanceof Error ? e.message : 'Operation unavailable.',
      }),
  )
  return true
})
let requestObserverRegistered = false
function configureRequestObserver(enabled: boolean) {
  if (enabled === requestObserverRegistered) return
  const requests = chrome.webRequest?.onBeforeRequest
  if (!requests) return
  if (enabled) {
    requests.addListener(observeRequest, { urls: ['http://*/*', 'https://*/*'] })
  } else {
    requests.removeListener(observeRequest)
  }
  requestObserverRegistered = enabled
}
function observeRequest(
  details: chrome.webRequest.OnBeforeRequestDetails,
): undefined {
  if (
    details.tabId < 0 ||
    !details.initiator ||
    details.type === 'main_frame'
  )
    return
  const initiator = details.initiator,
    dest = new URL(details.url)
  if (!/^https?:\/\//.test(initiator)) return
  const sourceHost = new URL(initiator).hostname
  const siteOf = (host: string) =>
    getDomain(host, { allowPrivateDomains: true }) ?? host
  if (siteOf(dest.hostname) === siteOf(sourceHost)) return
  void queue(async () => {
    const db = await read(),
      site = db.sites.find((s) => s.origin === initiator)
    if (!site) return
    const t = await tabState(details.tabId, initiator),
      r = bound(db, t.consent)
    if (
      !r ||
      !t.consentAt ||
      details.timeStamp < t.consentAt ||
      details.timeStamp - t.consentAt > 30000
    )
      return
    const classified = classifyRequest(initiator, dest)
    if (classified.simulated && !site.auditDemo) return
    if (!r.domains.some((d) => d.host === dest.hostname))
      r.domains.push({
        host: dest.hostname,
        at: details.timeStamp,
        ...classified,
      })
    if (
      classified.tracker &&
      ['Reject cookies', 'Withdraw consent'].includes(r.action)
    )
      r.inconsistent = true
    await save(db)
  })
}
