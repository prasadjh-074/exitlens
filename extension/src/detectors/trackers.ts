import { DEMO, FIXTURE } from '../types'
// Small explicit classification list. See docs/privacy.md for provenance and scope.
export const trackerDomains = [
  'doubleclick.net',
  'google-analytics.com',
  'connect.facebook.net',
]
export function classifyRequest(initiator: string, url: URL) {
  const simulated =
    initiator === DEMO &&
    url.origin === FIXTURE &&
    url.pathname === '/signals/ad.gif'
  return {
    simulated,
    tracker:
      simulated ||
      trackerDomains.some(
        (h) => url.hostname === h || url.hostname.endsWith('.' + h),
      ),
  }
}
