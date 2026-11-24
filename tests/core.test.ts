import { describe, it, expect } from 'vitest'
import {
  candidate,
  classify,
  extractTerms,
  pageKey,
  safeUrl,
  statusSignals,
} from '../extension/src/detectors'
import { classifyRequest } from '../extension/src/detectors/trackers'
import {
  discover,
  mergeEdges,
  nextStep,
  shortestPath,
} from '../extension/src/graph'
import { newRecord, resolveManually, serialise } from '../extension/src/storage'
import { verify, ratio } from '../extension/src/verification'
import { DEMO, FIXTURE, type Click, type Edge } from '../extension/src/types'
const click: Click = {
  label: 'Start free trial',
  action: 'Start free trial',
  entry: false,
  page: DEMO + '/trial',
  choice: null,
  simulated: true,
  terms: extractTerms('7-day free trial. ₹0 today, then ₹799 per month.'),
}
describe('commitment recognition', () => {
  it.each([
    ['Accept all', 'Cookie preferences', 'Accept cookies'],
    ['Reject all', 'Tracking consent', 'Reject cookies'],
    ['Customise preferences', 'Advertising cookies', 'Customise preferences'],
    ['Start my free trial', '', 'Start free trial'],
    ['Subscribe', 'Billed per month', 'Subscribe'],
    ['Enable auto-renewal', '', 'Enable auto-renewal'],
    ['Cancel plan', '', 'Cancel subscription'],
    ['Withdraw consent', '', 'Withdraw consent'],
    ['Accept additional cookies', 'Cookies on GOV.UK', 'Accept cookies'],
    ['Reject additional cookies', 'Cookies on GOV.UK', 'Reject cookies'],
    ['Subscribe', 'Newsletter', null],
    ['Accept all', 'Team invites', null],
    ['Learn how to cancel plan', 'Billing', null],
  ])('%s within %s', (label, context, action) =>
    expect(classify(label, context)).toBe(action),
  )
  it('keeps the observed financial phrases and explicit date', () => {
    const t = extractTerms(
      '7-day free trial. ₹0 today. Then ₹799 per month. Automatically renews. Cancel before 2026-12-01. No refunds after renewal.',
    )
    expect(t).toMatchObject({
      initial: '₹0',
      recurring: '₹799',
      frequency: 'month',
      trialDays: 7,
      deadline: '2026-12-01',
      renewal: null,
      refund: 'No refunds after renewal',
    })
    expect(t.source).toContain('₹799 per month')
  })
  it('retains conflicting quotes without picking a plan', () => {
    const t = extractTerms('₹799 per month or ₹399 per month')
    expect(t.recurring).toBeNull()
    expect(t.source).toContain('₹399 per month')
  })
  it('does not infer a price or date from missing terms', () =>
    expect(extractTerms('try it free; renews on 2026-02-31')).toMatchObject({
      trialDays: null,
      initial: null,
      recurring: null,
      renewal: null,
    }))
  it('preserves only safe, same-origin navigation paths', () => {
    for (const url of [
      '/account/jane',
      '/account?token=secret',
      '/billing#access',
      'https://other.example/account',
      'javascript:alert(1)',
      'http://user@127.0.0.1:4173/',
    ])
      expect(safeUrl(url, DEMO)).toBeNull()
    expect(safeUrl('/account/settings', DEMO)).toBe(DEMO + '/account/settings')
    expect(pageKey(DEMO + '/profile/1234', DEMO)).toBe(DEMO + '/[private path]')
  })
})
describe('route choice', () => {
  const edge = (from: string, to: string, cost: number): Edge => ({
    from,
    to,
    cost,
    proof: 'Discovered',
    label: 'Manage subscription',
    kind: 'link',
    confirm: false,
    confidence: 0.85,
    evidence: 'Visible link',
    obstacles: [],
  })
  it('finds lowest total friction across branches and cycles', () => {
    const edges = [
      edge('a', 'd', 11),
      edge('a', 'b', 2),
      edge('b', 'c', 2),
      edge('c', 'a', 1),
      edge('c', 'd', 2),
    ]
    expect(shortestPath(edges, 'a', new Set(['d'])).map((e) => e.to)).toEqual([
      'b',
      'c',
      'd',
    ])
    expect(shortestPath(edges, 'a', new Set(['missing']))).toEqual([])
  })
  it('does not promote button intent to an inspected destination', () => {
    const c = candidate('Confirm cancellation', 'button', null)!
    const [e] = discover(
      {
        page: DEMO + '/confirm',
        signals: [],
        simulated: true,
        barriers: [],
        candidates: [c],
      },
      'subscription',
    )
    expect(e.proof).toBe('Discovered')
    expect(e.confirm).toBe(true)
    expect(e.to).toContain(' → ')
    expect(nextStep([e], e.from)?.label).toBe('Confirm cancellation')
    expect(mergeEdges([{ ...e, proof: 'Observed' }], [e])[0].proof).toBe(
      'Observed',
    )
  })
})
describe('local records and verification', () => {
  it('records clicks conservatively and keeps manual closure distinct', () => {
    const r = newRecord(click, DEMO, 100, 'id')
    expect(r.status).toBe('Suspected')
    expect(ratio(r)).toBeNull()
    resolveManually(r, 200)
    expect(r.verification).toBe('User marked as resolved')
    expect(r.verifiedAt).toBeNull()
  })
  it('requires a fresh positive status and a linked reversal attempt', () => {
    const signals = statusSignals([
      'How to cancel your subscription',
      'Your subscription is cancelled.',
      'Subscription status: active',
      'If your subscription is cancelled',
    ])
    expect(signals).toHaveLength(2)
    expect(verify('subscription', signals, false)).toBe('Pending verification')
    expect(verify('subscription', signals, true)).toBe(
      'Verified by observable evidence',
    )
    expect(verify('subscription', ['Auto-renewal is off.'], true)).toBe(
      'Partially verified',
    )
    expect(verify('consent', [], true)).toBe('Pending verification')
    expect(verify('consent', ['Advertising cookies are disabled.'], true)).toBe(
      'Verified by observable evidence',
    )
  })
  it('shows a ratio only with complete observed segments', () => {
    const r = newRecord(click, DEMO, 100, 'id', {
      at: 90,
      text: 'Opened trial offer',
    })
    r.completeEntry = true
    r.continuous = true
    r.verification = 'Verified by observable evidence'
    r.reversal = Array.from({ length: 6 }, () => ({ at: 200, text: 'Step' }))
    expect(ratio(r)).toBe(3)
    r.continuous = false
    expect(ratio(r)).toBeNull()
  })
  it('serialises competing writes and recovers after an exception', async () => {
    const queue = serialise(),
      seen: number[] = []
    const a = queue(async () => {
      await Promise.resolve()
      seen.push(1)
      throw Error('failed')
    })
    const b = queue(async () => {
      seen.push(2)
    })
    await expect(a).rejects.toThrow()
    await b
    expect(seen).toEqual([1, 2])
  })
  it('requires the exact loopback fixture and domain boundaries', () => {
    expect(classifyRequest(DEMO, new URL(FIXTURE + '/signals/ad.gif'))).toEqual(
      { simulated: true, tracker: true },
    )
    expect(
      classifyRequest(DEMO, new URL('https://doubleclick.net.other.test/'))
        .tracker,
    ).toBe(false)
    expect(
      classifyRequest(DEMO, new URL('https://ad.doubleclick.net/')).tracker,
    ).toBe(true)
  })
})
