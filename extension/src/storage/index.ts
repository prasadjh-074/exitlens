import type { Click, RecordItem, Evidence } from '../types'
import { categoryOf } from '../detectors'
export function newRecord(
  click: Click,
  origin: string,
  at: number,
  id: string,
  entry?: Evidence,
): RecordItem {
  if (!click.action) throw new Error('Missing commitment action')
  const consent = categoryOf(click.action) === 'consent'
  const observed = consent && click.action !== 'Customise preferences'
  const ev = { at, text: 'Selected “' + click.action + '”.' }
  return {
    id,
    origin,
    domain: new URL(origin).hostname,
    page: click.page,
    category: categoryOf(click.action),
    action: click.action,
    at,
    terms: click.terms,
    status: observed ? 'Recorded' : 'Suspected',
    confidence: observed ? 'Observed choice' : 'Suspected',
    verification: 'Pending verification',
    verifiedAt: null,
    simulated: click.simulated,
    evidence: [ev],
    entry: [...(entry ? [entry] : []), ev],
    completeEntry: false,
    continuous: false,
    reversal: [],
    edges: [],
    current: click.page,
    undoUrl: null,
    barriers: [],
    cookies: { before: null, after: null },
    domains: [],
    inconsistent: false,
  }
}
export function addEvidence(list: Evidence[], text: string, at = Date.now()) {
  if (!list.some((e) => e.text === text)) list.push({ at, text })
}
export function resolveManually(r: RecordItem, at = Date.now()) {
  if (r.verification === 'Verified by observable evidence') return
  r.status = 'Resolved'
  r.verification = 'User marked as resolved'
  addEvidence(r.evidence, 'User marked this commitment as resolved.', at)
}
export function serialise() {
  let tail: Promise<unknown> = Promise.resolve()
  return <T>(work: () => Promise<T>): Promise<T> => {
    const next = tail.then(work)
    tail = next.catch(() => undefined)
    return next
  }
}
